// ======================================================================
//  bank.js: the ONLY thing that changes accounts (points, packs, trades,
//  bans...). One Bank for the whole game, doing one job at a time,
//  so two actions can never clash.
// ======================================================================
import { DurableObject } from "cloudflare:workers";
import { Store } from "./google.js";
import { RULES, ABILITY_PACKS, LIMITED_PACKS, EVENTS, SKIN_PACKS, SKIN_ODDS, SKIN_IDS, ECON, RARITY_RANK, luckyOdds, abilityRarity, JACKPOT_PRIZES } from "./shared.js";

const USERNAME_RE = /^[a-z0-9_]{3,16}$/;
const clean = s => String(s || "").trim().toLowerCase();
const fail = m => { const e = new Error(m); e.user = true; throw e; };

function roll(items) {   // items: [[thing, weight, ...], ...]
  const total = items.reduce((s, it) => s + it[1], 0);
  let r = Math.random() * total;
  for (const it of items) { if ((r -= it[1]) < 0) return it; }
  return items[items.length - 1];
}
function cleanBundle(b) {
  b = b || {};
  const out = { points: Math.max(0, Math.floor(+b.points || 0)), abilities: {}, skins: {} };
  Object.entries(b.abilities || {}).forEach(([k, v]) => { const n = Math.floor(+v || 0); if (n > 0 && RULES[k] && RULES[k].type === "ability") out.abilities[k] = Math.min(n, 999); });
  Object.entries(b.skins || {}).forEach(([k, v]) => { const n = Math.floor(+v || 0); if (n > 0 && SKIN_IDS.includes(k)) out.skins[k] = Math.min(n, 999); });
  out.points = Math.min(out.points, 1e9);
  return out;
}
const bundleEmpty = b => !b.points && !Object.keys(b.abilities).length && !Object.keys(b.skins).length;
function missingFrom(p, b) {
  if ((p.points || 0) < b.points) return `${b.points} points`;
  for (const [k, n] of Object.entries(b.abilities)) if (((p.abilities || {})[k] || 0) < n) return `${n}× ${RULES[k].name}`;
  for (const [k, n] of Object.entries(b.skins)) if (((p.skins || {})[k] || 0) < n) return `${n}× ${k} skin`;
  return null;
}
function applyBundle(p, b, sign) {
  const ab = Object.assign({}, p.abilities || {}), sk = Object.assign({}, p.skins || {});
  Object.entries(b.abilities).forEach(([k, n]) => { ab[k] = (ab[k] || 0) + sign * n; if (ab[k] <= 0) delete ab[k]; });
  Object.entries(b.skins).forEach(([k, n]) => { sk[k] = (sk[k] || 0) + sign * n; if (sk[k] <= 0) delete sk[k]; });
  return Object.assign({}, p, {
    points: (p.points || 0) + sign * b.points, abilities: ab, skins: sk,
    loadout: (p.loadout || []).filter(id => ab[id] > 0),
    equippedSkin: sk[p.equippedSkin] > 0 ? p.equippedSkin : "default",
  });
}
function publicProfile(p) {   // what other players may see
  return { username: p.username, points: p.points || 0, abilities: p.abilities || {}, skins: p.skins || {} };
}

export class Bank extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new Store(env);
    this.queue = Promise.resolve();
    this.adminUid = null; this.adminCheckedAt = 0;
    this.seen = new Map();   // uid -> last time we heard from them (for "online" in friends lists)
  }
  // every job waits for the one before it to finish
  async fetch(req) {
    const body = await req.json();
    const job = this.queue.then(() => this.run(body));
    this.queue = job.catch(() => {});
    try { return Response.json({ ok: true, data: await job }); }
    catch (e) {
      if (e.limit) return Response.json({ ok: false, limit: e.limit, error: "The game has reached its free daily limit" }, { status: 503 });
      return Response.json({ ok: false, error: e.user ? e.message : "Server error: " + e.message }, { status: e.user ? 400 : 500 });
    }
  }

  // ------------------------------------------------------------ helpers
  async profile(uid) { const p = await this.store.get("users/" + uid); if (!p) fail("No account yet"); return p; }
  async save(uid, p) { await this.store.set("users/" + uid, p); return p; }
  async config() { return Object.assign({ antiTeaming: true }, await this.store.get("config/global") || {}); }
  // the event that's on right now (or null). It switches itself off when its timer runs out.
  activeEvent(cfg) { const e = cfg && cfg.event; return e && EVENTS[e.id] && e.until > Date.now() ? e : null; }
  async isAdmin(uid) {
    if (!this.adminUid || Date.now() - this.adminCheckedAt > 60_000) {
      const a = await this.store.get("usernames/" + ECON.ADMIN_USERNAME);
      this.adminUid = a ? a.uid : null; this.adminCheckedAt = Date.now();
    }
    return !!uid && uid === this.adminUid;
  }
  banned(p) { return (p.bannedUntil || 0) > Date.now(); }
  async uidOf(name) { const u = await this.store.get("usernames/" + clean(name)); if (!u) fail("No player called " + clean(name)); return u.uid; }

  async run({ op, uid, email, args }) {
    args = args || {};
    if (uid && !["roomProfile", "addPoints", "recordMatch", "spend", "transfer", "devilsDeal", "grant", "payStake", "friendIds"].includes(op)) this.seen.set(uid, Date.now());
    const admin = () => this.isAdmin(uid).then(ok => { if (!ok) fail("Admins only"); });
    switch (op) {
      // ---------------------------------------------------------- account
      case "init": {      // first login after sign-up: make the account
        const name = String(args.username || "").trim();
        if (!USERNAME_RE.test(name.toLowerCase())) fail("Username: 3-16 letters, numbers or _");
        if ((email || "").split("@")[0] !== name.toLowerCase()) fail("Username doesn't match your login");
        const existing = await this.store.get("users/" + uid);
        if (existing) return this.me(uid, existing);
        const taken = await this.store.get("usernames/" + name.toLowerCase());
        if (taken && taken.uid !== uid) fail("That username is taken");
        const p = { username: name, points: ECON.START_POINTS, abilities: {}, skins: {}, loadout: [], equippedSkin: "default", tutorialDone: false, createdAt: Date.now() };
        const ops = [{ set: "users/" + uid, data: p, mustNotExist: true }];
        if (!taken) ops.push({ set: "usernames/" + name.toLowerCase(), data: { uid }, mustNotExist: true });
        await this.store.commit(ops);
        return this.me(uid, p);
      }
      case "dropCache": if (this.env.TEST_MODE !== "1") fail("no"); this.store.cache.clear(); this.store.qcache.clear(); return true;
      case "ping": await this.store.get("config/global"); return true;
      case "me": return this.me(uid, await this.profile(uid));
      case "tutorialDone": { const p = await this.profile(uid); p.tutorialDone = true; p.tutorialVersion = ECON.TUTORIAL_VERSION; await this.save(uid, p); return this.me(uid, p); }
      case "loadout": {
        const p = await this.profile(uid); if (this.banned(p)) fail("You're banned");
        const ids = [...new Set((args.ids || []).map(String))].filter(id => RULES[id] && RULES[id].type === "ability" && (p.abilities || {})[id] > 0);
        if (ids.length > 3) fail("You can only equip 3");
        p.loadout = ids; await this.save(uid, p); return this.me(uid, p);
      }
      case "skin": {
        const p = await this.profile(uid); if (this.banned(p)) fail("You're banned");
        const id = String(args.id || "default");
        if (id !== "default" && !((p.skins || {})[id] > 0)) fail("You don't own that skin");
        p.equippedSkin = id; await this.save(uid, p); return this.me(uid, p);
      }
      case "buy": {
        const p = await this.profile(uid); if (this.banned(p)) fail("You're banned");
        const ev = this.activeEvent(await this.config());
        const lucky = ev && ev.id === "lucky";
        let kind = args.kind === "skin" ? "skin" : args.kind === "limited" ? "limited" : "ability";
        let pack, cost, items;
        if (kind === "limited") {
          pack = LIMITED_PACKS[args.pack];
          if (!pack) fail("No such pack");
          if (!ev || EVENTS[ev.id].pack !== args.pack) fail("That pack isn't in the shop right now");
          cost = pack.cost; items = pack.items;
        } else if (kind === "ability") {
          pack = ABILITY_PACKS[args.pack]; if (!pack) fail("No such pack");
          cost = ECON.PACK_COST; items = pack.items;
        } else {
          pack = SKIN_PACKS[args.pack]; if (!pack) fail("No such pack");
          cost = ECON.SKIN_PACK_COST; items = pack.skins.map((sid, i2) => [sid, SKIN_ODDS[i2][1], SKIN_ODDS[i2][0]]);
        }
        if ((p.points || 0) < cost) fail("Not enough points");
        if (lucky) items = luckyOdds(items);
        // the admin's lucky spin works on the normal packs only (not limited ones)
        const forced = kind !== "limited" && p.nextLegendary === true;
        const it = forced ? items.find(x => x[2] === "legendary") : roll(items);
        if (forced) p.nextLegendary = false;
        const prize = it[0], rarity = it[2];
        const isSkin = kind === "skin" || pack.kind === "skin";
        const field = isSkin ? "skins" : "abilities";
        p[field] = Object.assign({}, p[field] || {}); p[field][prize] = (p[field][prize] || 0) + 1;
        p.points -= cost;
        await this.save(uid, p);
        return { prize, rarity, isSkin, count: p[field][prize], me: await this.me(uid, p) };
      }
      case "findUser": {
        const id = await this.uidOf(args.username);
        if (id === uid) fail("You can't trade with yourself");
        return Object.assign({ uid: id }, publicProfile(await this.profile(id)));
      }
      // ---------------------------------------------------------- trades (both sides change together or not at all)
      case "trades": {
        const [inc, out] = await Promise.all([this.store.query("trades", "to", "EQUAL", uid), this.store.query("trades", "from", "EQUAL", uid)]);
        for (const t of out) await this.legacyClaim(uid, t);   // trades sent before the server existed
        return { incoming: inc, outgoing: out };
      }
      case "tradeSend": {
        const me = await this.profile(uid); if (this.banned(me)) fail("You're banned");
        const toUid = await this.uidOf(args.to); if (toUid === uid) fail("You can't trade with yourself");
        const them = await this.profile(toUid);
        const give = cleanBundle(args.give), want = cleanBundle(args.want);
        if (bundleEmpty(give) && bundleEmpty(want)) fail("Pick something to give or get");
        const fee = this.activeEvent(await this.config()) ? 0 : ECON.TRADE_COST;   // trading is free during events
        const m1 = missingFrom(me, { points: give.points + fee, abilities: give.abilities, skins: give.skins });
        if (m1) fail("You don't have " + m1 + (fee ? ` (sending costs ${fee} points)` : ""));
        const m2 = missingFrom(them, want); if (m2) fail(`${them.username} doesn't have ${m2}`);
        me.points -= fee;
        const id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await this.store.commit([
          { set: "users/" + uid, data: me },
          { set: "trades/" + id, data: { v: 2, from: uid, fromName: me.username, to: toUid, toName: them.username, give, want, status: "pending", createdAt: Date.now() }, mustNotExist: true },
        ]);
        return { id, me: await this.me(uid, me) };
      }
      case "tradeAnswer": {
        const t = await this.store.get("trades/" + args.id);
        if (!t || t.to !== uid) fail("Trade not found");
        if (t.status !== "pending") fail("This trade isn't open anymore");
        const me = await this.profile(uid); if (this.banned(me)) fail("You're banned");
        const give = cleanBundle(t.give), want = cleanBundle(t.want);
        if (!args.accept) {
          const ops = [{ set: "trades/" + args.id, data: Object.assign(t, { status: t.v === 2 ? "declined" : "declined" }) }];
          await this.store.commit(ops);
          return { me: await this.me(uid, me) };
        }
        const sender = await this.profile(t.from);
        const m1 = missingFrom(me, want); if (m1) fail("You don't have " + m1);
        if (t.v === 2) { const m2 = missingFrom(sender, give); if (m2) fail(`${t.fromName} doesn't have ${m2} anymore`); }
        const newMe = applyBundle(applyBundle(me, want, -1), give, +1);
        const newSender = t.v === 2 ? applyBundle(applyBundle(sender, give, -1), want, +1) : applyBundle(sender, want, +1);
        await this.store.commit([
          { set: "users/" + uid, data: newMe },
          { set: "users/" + t.from, data: newSender },
          { set: "trades/" + args.id, data: Object.assign(t, { status: "done", doneAt: Date.now() }) },
        ]);
        return { me: await this.me(uid, newMe) };
      }
      case "tradeCancel": {
        const t = await this.store.get("trades/" + args.id);
        if (!t || t.from !== uid) fail("Trade not found");
        if (t.status !== "pending") fail("Too late, they already answered");
        const me = await this.profile(uid);
        const ops = [{ set: "trades/" + args.id, data: Object.assign(t, { status: "cancelled" }) }];
        let p = me;
        if (t.v !== 2) { p = applyBundle(me, cleanBundle(t.give), +1); ops.push({ set: "users/" + uid, data: p }); }   // old trades held your items
        await this.store.commit(ops);
        return { me: await this.me(uid, p) };
      }
      // ---------------------------------------------------------- called by game rooms (never by players directly)
      case "roomProfile": {
        const p = await this.store.get("users/" + uid);
        if (!p) fail("No account yet");
        if (this.banned(p)) fail("You're banned");
        return { username: p.username, loadout: (p.loadout || []).filter(id => (p.abilities || {})[id] > 0), skin: (p.skins || {})[p.equippedSkin] > 0 ? p.equippedSkin : "default" };
      }
      case "addPoints": {
        const n = Math.floor(+args.n || 0); if (n <= 0) return null;
        const p = await this.store.get("users/" + uid); if (!p) return null;
        p.points = (p.points || 0) + n; await this.save(uid, p); return { points: p.points };
      }
      // ---------------------------------------------------------- friends
      case "friendsList": {
        const p = await this.profile(uid), names = p.fnames || {};
        const row = id => ({ uid: id, username: names[id] || "?", online: Date.now() - (this.seen.get(id) || 0) < 90_000 });
        return { friends: (p.friends || []).map(row), incoming: (p.friendIn || []).map(row), outgoing: (p.friendOut || []).map(row) };
      }
      case "friendIds": { const p = await this.store.get("users/" + uid); return p ? (p.friends || []) : []; }
      case "friendRequest": {
        const me = await this.profile(uid); if (this.banned(me)) fail("You're banned");
        const to = await this.uidOf(args.username); if (to === uid) fail("You can't add yourself");
        const them = await this.profile(to);
        const has = (x, k, v) => (x[k] || []).includes(v);
        if (has(me, "friends", to)) fail(`${them.username} is already your friend`);
        if (has(me, "friendOut", to)) fail("You already sent them a request");
        const add = (x, k, v) => { x[k] = [...new Set([...(x[k] || []), v])]; }, del = (x, k, v) => { x[k] = (x[k] || []).filter(y => y !== v); };
        me.fnames = Object.assign({}, me.fnames, { [to]: them.username }); them.fnames = Object.assign({}, them.fnames, { [uid]: me.username });
        if (has(me, "friendIn", to)) {               // they already asked you: that's a yes from both
          del(me, "friendIn", to); del(them, "friendOut", uid); add(me, "friends", to); add(them, "friends", uid);
        } else {
          if ((me.friends || []).length >= 100) fail("You have 100 friends already");
          if ((them.friendIn || []).length >= 50) fail(`${them.username} has too many requests waiting`);
          add(me, "friendOut", to); add(them, "friendIn", uid);
        }
        await this.store.commit([{ set: "users/" + uid, data: me }, { set: "users/" + to, data: them }]);
        return { friends: has(me, "friends", to) };
      }
      case "friendAnswer": case "friendCancel": case "friendRemove": {
        const other = String(args.uid || "");
        const me = await this.profile(uid), them = await this.store.get("users/" + other);
        const del = (x, k, v) => { if (x) x[k] = (x[k] || []).filter(y => y !== v); }, add = (x, k, v) => { x[k] = [...new Set([...(x[k] || []), v])]; };
        if (op === "friendAnswer") {
          if (!(me.friendIn || []).includes(other)) fail("That request isn't there anymore");
          del(me, "friendIn", other); del(them, "friendOut", uid);
          if (args.accept && them) { add(me, "friends", other); add(them, "friends", uid); }
        } else if (op === "friendCancel") { del(me, "friendOut", other); del(them, "friendIn", uid); }
        else { del(me, "friends", other); del(them, "friends", uid); }
        const ops = [{ set: "users/" + uid, data: me }]; if (them) ops.push({ set: "users/" + other, data: them });
        await this.store.commit(ops);
        return true;
      }
      // ---------------------------------------------------------- the 100-slot board
      case "boardGet": return this.boardView(uid);
      case "boardBuy": {
        const p = await this.profile(uid); if (this.banned(p)) fail("You're banned");
        const board = await this.board();
        const left = ECON.BOARD_SLOTS - board.slots.length;
        const n = Math.floor(+args.count || 0);
        if (n < 1) fail("Pick how many slots");
        if (n > left) fail(`Only ${left} slot${left === 1 ? "" : "s"} left`);
        if ((p.points || 0) < n * ECON.BOARD_SLOT_COST) fail(`${n} slot${n > 1 ? "s" : ""} cost ${n * ECON.BOARD_SLOT_COST} points`);
        p.points -= n * ECON.BOARD_SLOT_COST;
        for (let i = 0; i < n; i++) board.slots.push({ u: uid, n: p.username });
        if (board.slots.length < ECON.BOARD_SLOTS) {
          await this.store.commit([{ set: "users/" + uid, data: p }, { set: "board/current", data: board }]);
        } else await this.boardDraw(board, uid, p);
        return { board: await this.boardView(uid), me: await this.me(uid, await this.profile(uid)) };
      }
      case "noticesSeen": { const p = await this.profile(uid); if ((p.notices || []).length) { p.notices = []; await this.save(uid, p); } return this.me(uid, p); }
      case "event": { const e = this.activeEvent(await this.config()); return e ? e.id : null; }
      case "spend": {          // Neutralise: pay from your points
        const n = Math.floor(+args.n || 0), p = await this.profile(uid);
        if (n <= 0 || (p.points || 0) < n) fail(`You need ${n} points`);
        p.points -= n; await this.save(uid, p); return { points: p.points };
      }
      case "transfer": {       // Heavenly Wrath: give someone points
        const n = Math.floor(+args.n || 0), p = await this.profile(uid);
        if (n <= 0 || (p.points || 0) < n) fail(`You need ${n} points`);
        p.points -= n;
        const ops = [{ set: "users/" + uid, data: p }];
        let to = null;
        if (args.to && args.to !== uid) { to = await this.store.get("users/" + args.to); if (to) { to.points = (to.points || 0) + n; ops.push({ set: "users/" + args.to, data: to }); } }
        await this.store.commit(ops);
        return { points: p.points, toPoints: to ? to.points : null };
      }
      case "devilsDeal": {     // pay 500, 10% chance to steal their rarest ability forever
        const p = await this.profile(uid), them = args.to && args.to !== uid ? await this.store.get("users/" + args.to) : null;
        if (!them) fail("You can only make a deal with a real player");
        if ((p.points || 0) < ECON.DEAL_COST) fail(`You need ${ECON.DEAL_COST} points`);
        const owned = Object.keys(them.abilities || {}).filter(k => them.abilities[k] > 0 && RULES[k]);
        if (!owned.length) fail(`${them.username} has no abilities to steal`);
        p.points -= ECON.DEAL_COST; them.points = (them.points || 0) + ECON.DEAL_COST;
        const win = Math.random() < (this.env.TEST_MODE === "1" && this.env.TEST_DEAL_WIN === "1" ? 1 : 0.1);
        let ability = null;
        let np = p, nt = them;
        if (win) {
          const top = Math.max(...owned.map(k => RARITY_RANK[abilityRarity(k)] || 0));
          const best = owned.filter(k => (RARITY_RANK[abilityRarity(k)] || 0) === top);
          ability = best[Math.floor(Math.random() * best.length)];
          const one = { points: 0, abilities: { [ability]: 1 }, skins: {} };
          nt = applyBundle(them, one, -1); np = applyBundle(p, one, +1);
        }
        await this.store.commit([{ set: "users/" + uid, data: np }, { set: "users/" + args.to, data: nt }]);
        return { win, ability, points: np.points, toPoints: nt.points };
      }
      case "grant": {          // Golden Games jackpot: a free legendary ability
        const id = JACKPOT_PRIZES.includes(args.id) ? args.id : JACKPOT_PRIZES[0];
        const p = await this.store.get("users/" + uid); if (!p) return null;
        p.abilities = Object.assign({}, p.abilities || {}); p.abilities[id] = (p.abilities[id] || 0) + 1;
        await this.save(uid, p); return { id };
      }
      case "payStake": {
        const n = Math.floor(+args.n || 0);
        const p = await this.store.get("users/" + uid);
        if (!p || this.banned(p) || n <= 0 || (p.points || 0) < n) return { paid: false };
        p.points -= n; await this.save(uid, p); return { paid: true, points: p.points };
      }
      case "recordMatch": {
        const p = await this.store.get("users/" + uid); if (!p) return null;
        const others = (args.others || []).map(String);
        let hist = [...(p.matchHistory || []).map(h => (h && h.u) || []), others].slice(-ECON.TEAM_STREAK);
        let cd = p.teamCooldown && p.teamCooldown.left > 0 ? { group: p.teamCooldown.group, left: p.teamCooldown.left - 1 } : null;
        if (!cd && hist.length === ECON.TEAM_STREAK) {
          const same = hist[0].filter(u => hist.every(h => h.includes(u)));
          if (same.length) { cd = { group: same, left: ECON.TEAM_COOLDOWN }; hist = []; }
        }
        p.matchHistory = hist.map(u => ({ u })); p.teamCooldown = cd && cd.left > 0 ? cd : null;
        await this.save(uid, p); return null;
      }
      case "teamAvoid": {
        const [p, cfg] = await Promise.all([this.profile(uid), this.config()]);
        if (this.banned(p)) fail("You're banned");
        const cd = p.teamCooldown;
        return (cfg.antiTeaming !== false && cd && cd.left > 0) ? cd.group : [];
      }
      // ---------------------------------------------------------- admin (bajajhamish only)
      case "adminLucky": { await admin(); const id = await this.uidOf(args.username); const p = await this.profile(id); p.nextLegendary = !!args.on; await this.save(id, p); return { username: p.username }; }
      case "adminBan": {
        await admin();
        const id = await this.uidOf(args.username);
        if (id === uid) fail("You can't ban yourself");
        const p = await this.profile(id); p.bannedUntil = args.on ? Date.now() + ECON.BAN_MS : 0; await this.save(id, p);
        return { uid: id, username: p.username };
      }
      case "adminLists": {
        await admin();
        const [banned, lucky] = await Promise.all([this.store.query("users", "bannedUntil", "GREATER_THAN", Date.now()), this.store.query("users", "nextLegendary", "EQUAL", true)]);
        return { banned: banned.map(u => ({ username: u.username, until: u.bannedUntil })), lucky: lucky.map(u => ({ username: u.username })), config: await this.config() };
      }
      case "adminConfig": {
        await admin();
        const cfg = await this.config();
        if ("antiTeaming" in args) cfg.antiTeaming = !!args.antiTeaming;
        if (args.stopEvent) cfg.event = null;
        if (args.event) {        // start a limited-time event (only one at a time: this replaces any other)
          if (!EVENTS[args.event]) fail("No such event");
          const mins = Math.floor(+args.minutes || 0);
          if (mins < 1 || mins > 60 * 24 * 30) fail("Pick a time between 1 minute and 30 days");
          cfg.event = { id: args.event, startedAt: Date.now(), until: Date.now() + mins * 60000 };
        }
        await this.store.set("config/global", cfg); return cfg;
      }
    }
    fail("Unknown request");
  }

  // ------------------------------------------------------------ board helpers
  async board() { const b = await this.store.get("board/current"); return b && Array.isArray(b.slots) ? b : { id: 1, slots: [], startedAt: Date.now() }; }
  async boardView(uid) {
    const [b, last] = await Promise.all([this.board(), this.store.get("board/last")]);
    return { id: b.id, slots: b.slots.map(x => x.n), mine: b.slots.reduce((a, x, i) => (x.u === uid ? a.concat(i) : a), []), size: ECON.BOARD_SLOTS, cost: ECON.BOARD_SLOT_COST, last: last || null };
  }
  rollPack(packs, lucky) {     // open a random pack from a list: [prizeId, rarity, isSkin, packId]
    const ids = Object.keys(packs), pid = ids[Math.floor(Math.random() * ids.length)], pack = packs[pid];
    const items = lucky ? luckyOdds(pack.items) : pack.items;
    const it = roll(items);
    return { pack: pid, packName: pack.name, prize: it[0], rarity: it[2], isSkin: pack.kind === "skin" };
  }
  // the board is full: one random slot wins a limited pack, the other 99 each get a regular 50-point pack
  async boardDraw(board, buyer, buyerProfile) {
    const lucky = (this.activeEvent(await this.config()) || {}).id === "lucky";
    const win = Math.floor(Math.random() * board.slots.length);
    const users = {}; users[buyer] = buyerProfile;
    for (const sl of board.slots) if (!users[sl.u]) users[sl.u] = await this.store.get("users/" + sl.u);
    const got = {};
    let winPrize = null;
    board.slots.forEach((sl, i) => {
      const r = i === win ? this.rollPack(LIMITED_PACKS, lucky) : this.rollPack(ABILITY_PACKS, lucky);
      if (i === win) { r.win = true; winPrize = Object.assign({ u: sl.u, n: sl.n }, r); }
      const p = users[sl.u]; if (!p) return;
      const f = r.isSkin ? "skins" : "abilities";
      p[f] = Object.assign({}, p[f] || {}); p[f][r.prize] = (p[f][r.prize] || 0) + 1;
      (got[sl.u] || (got[sl.u] = [])).push(r);
    });
    const label = r => r.isSkin ? `🎨 ${r.prize[0].toUpperCase() + r.prize.slice(1).replace(/([A-Z])/g, " $1")} skin` : `${RULES[r.prize].icon} ${RULES[r.prize].name}`;
    const ops = [];
    for (const [u, list] of Object.entries(got)) {
      const p = users[u]; if (!p) continue;
      const mineWon = winPrize && winPrize.u === u;
      const normal = list.filter(r => !r.win);
      let msg = `🎟️ The board filled up! You had ${list.length} slot${list.length > 1 ? "s" : ""}.`;
      if (mineWon) msg += ` 🏆 ONE OF YOUR SLOTS WON! ${winPrize.packName}: ${label(winPrize)} (${winPrize.rarity}).`;
      else msg += ` ${winPrize.n} won the ${winPrize.packName}.`;
      if (normal.length) msg += ` You got: ${normal.map(label).join(", ")}.`;
      p.notices = [...(p.notices || []), { at: Date.now(), msg, big: !!mineWon }].slice(-10);
      ops.push({ set: "users/" + u, data: p });
    }
    ops.push({ set: "board/current", data: { id: (board.id || 1) + 1, slots: [], startedAt: Date.now() } });
    ops.push({ set: "board/last", data: { id: board.id || 1, finishedAt: Date.now(), winner: winPrize.n, pack: winPrize.packName, prize: winPrize.prize, rarity: winPrize.rarity, isSkin: winPrize.isSkin, players: Object.keys(got).length } });
    await this.store.commit(ops);
  }

  async me(uid, p) {
    const [isAdmin, cfg] = await Promise.all([this.isAdmin(uid), this.config()]);
    return {
      uid, username: p.username, points: p.points || 0, abilities: p.abilities || {}, skins: p.skins || {},
      loadout: (p.loadout || []).filter(id => (p.abilities || {})[id] > 0),
      equippedSkin: (p.skins || {})[p.equippedSkin] > 0 ? p.equippedSkin : "default",
      // seen the CURRENT tutorial? (when new slides are added the version goes up, so everyone sees it again)
      tutorialDone: (p.tutorialVersion || 0) >= ECON.TUTORIAL_VERSION, tutorialSeenBefore: p.tutorialDone === true, bannedUntil: p.bannedUntil || 0,
      teamCooldown: cfg.antiTeaming !== false ? (p.teamCooldown || null) : null,
      isAdmin, config: { antiTeaming: cfg.antiTeaming !== false }, event: this.activeEvent(cfg), serverNow: Date.now(),
      notices: p.notices || [], friendIn: (p.friendIn || []).length,
    };
  }
  // trades sent before the server existed held the sender's items; finish them off
  async legacyClaim(uid, t) {
    if (t.v === 2 || t.from !== uid) return;
    if (t.status !== "accepted" && t.status !== "declined") return;
    const p = await this.profile(uid);
    const b = cleanBundle(t.status === "accepted" ? t.want : t.give);
    const np = applyBundle(p, b, +1);
    const id = t.id; delete t.id;
    await this.store.commit([{ set: "users/" + uid, data: np }, { set: "trades/" + id, data: Object.assign(t, { status: t.status === "accepted" ? "done" : "closed" }) }]);
    t.id = id; t.status = t.status === "accepted" ? "done" : "closed";
  }
}
