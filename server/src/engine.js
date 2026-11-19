// ======================================================================
//  engine.js: the whole game, run by the server (one Engine per room).
//  Players only send button presses; everything is decided here.
// ======================================================================
import { RULES, ECON, GOLDEN_JACKPOT, JACKPOT_PRIZES } from "./shared.js";

export const TUNING = {
  CHARGE_TIME: 1400, FLIGHT_TIME: 750, CATCH_FROM: 0.6, DROP_GRACE: 280,
  CLAP_TOLERANCE: 120, CLAP_JUDGE_DELAY: 700, LAG_ALLOW: 400,
  HOT_POTATO_MS: 3000, SPIN_MS: 5000, FIREBALL_WINDOW: 0.35, REDO_GRACE_MS: 2500,
  DF_GRACE_MS: 3000, FIREBALL_LOCK_MS: 600, MAX_ABILITIES: 3,
  BOT_WAIT_MS: 25000, START_COUNTDOWN: 10000, RULE_PICK_MS: 25000, NEXT_ROUND_MS: 5000,
  DUEL_SPEEDUP: 0.88, MIN_FLIGHT: 300, RISK_PAY_MS: 6000, STUCK_MS: 8000,
  HOLD_LIMIT_MS: 30000, RUSH_MS: 900, STAMPEDE_MS: 450, WHEEL_MS: 5000, FLASH_WARN_MS: 200, QUAKE_MS: 2000, MONEY_TIMEOUT_MS: 8000,
};
const FAST = { BOT_WAIT_MS: 1500, START_COUNTDOWN: 1000, RULE_PICK_MS: 1500, NEXT_ROUND_MS: 800, RISK_PAY_MS: 1500 };
const COLORS = ["#4fc3f7", "#ffb74d", "#ba68c8", "#4db6ac", "#f06292", "#aed581", "#ffd54f", "#7986cb", "#e57373", "#90a4ae"];
const MATCH_BOTS = ["hard", "hard", "medium", "easy"];
const BOT_LEVELS = {
  easy:   { react: [260, 460], catchAt: [0.70, 0.92], forgetClap: 0.08,  miss: 0.05,  fireCatch: 0.25, juke: 0.30, nukeFail: 0.12, think: [600, 1200], fakes: [0, 1], switchProb: 0.15, rate: 0.35, sacrifice: 0 },
  medium: { react: [160, 320], catchAt: [0.68, 0.88], forgetClap: 0.03,  miss: 0.02,  fireCatch: 0.08, juke: 0.12, nukeFail: 0.04, think: [400, 900],  fakes: [0, 1], switchProb: 0.35, rate: 0.6,  sacrifice: 0.25 },
  hard:   { react: [140, 280], catchAt: [0.67, 0.86], forgetClap: 0.02,  miss: 0.015, fireCatch: 0.05, juke: 0.08, nukeFail: 0.02, think: [350, 800],  fakes: [0, 1], switchProb: 0.4,  rate: 0.7,  sacrifice: 0.3 },
};
const STICKY = ["risk", "stake", "pot", "duel", "jackpot", "bounty"];
// the abilities bots may get (the limited ones need points or careful timing)
const BOT_POOL = Object.keys(RULES).filter(id => RULES[id].type === "ability" && !RULES[id].limited);
const PAUSED = ["rush", "wheel"];          // ball states where the game is briefly frozen

export function roomType(key) {
  if (key.startsWith("PUB")) return { mode: "competitive", isPublic: true, isRisk: false };
  if (key.startsWith("RISK")) return { mode: "competitive", isPublic: false, isRisk: true };
  if (key.startsWith("COMP")) return { mode: "competitive", isPublic: false, isRisk: false };
  return { mode: "casual", isPublic: false, isRisk: false };
}

export class Engine {
  // hooks: addPoints(uid, n, why), payStake(uid, n) -> Promise<bool>, recordMatch(uid, otherUids), changed()
  constructor({ key, now, rand, fast, hooks, stake }) {
    this.key = key;
    this.now = now || (() => Date.now());
    this.rand = rand || Math.random;
    this.T = Object.assign({}, TUNING, fast ? FAST : {});
    this.hooks = hooks || {};
    const rt = roomType(key);
    this.s = { key, mode: rt.mode, isPublic: rt.isPublic, isRisk: rt.isRisk, players: {}, ball: null, rules: {}, doubles: {}, log: [] };
    if (rt.isPublic) this.s.ball = { state: "lobby", seq: 1, createdAt: this.now() };
    if (rt.isRisk) this.s.ball = { state: "lobby", seq: 1, createdAt: this.now(), risk: true, stake: stake || ECON.RISK_MIN_STAKE };
    this.lat = {}; this.realAim = {}; this.bot = {}; this.judges = []; this.decoyPick = {};
    this.recorded = {}; this.paying = {};
    this.turn = 0;            // +1 every throw. "For 2 turns" effects last until 2 more throws have happened.
    this.round = 0;           // +1 every round (so late answers from the bank can't affect a new round)
    this.event = null;        // the admin's limited-time event (set by the room)
    this.s.fx = {};
    this.overPending = 0; this.lowAliveSince = 0; this.overTimerSeq = -1; this.overTimerAt = 0; this.nextRoundAt = 0;
    this.dirty = true;
  }

  // ------------------------------------------------------------ small helpers
  get P() { return this.s.players; }
  get B() { return this.s.ball; }
  nm(id) { return this.P[id] ? this.P[id].name : "someone"; }
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
  rnd(lo, hi) { return lo + this.rand() * (hi - lo); }
  rr(a) { return this.rnd(a[0], a[1]); }
  chance(p) { return this.rand() < p; }
  log(m) { this.s.log.push({ m, t: this.now() }); if (this.s.log.length > 14) this.s.log.shift(); this.dirty = true; }
  ids() { return Object.keys(this.P).sort((a, b) => (this.P[a].seat || 0) - (this.P[b].seat || 0)); }
  humans() { return Object.keys(this.P).filter(id => !this.P[id].bot); }
  humanCount() { return this.humans().length; }
  aliveIds() { return this.ids().filter(id => !this.P[id].out); }
  isAlive(id) { return !!(this.P[id] && !this.P[id].out); }
  hasRule(id) { return !!this.s.rules[id]; }
  running() { const b = this.B; return !!b && ["held", "flying", "nuke", "rush", "wheel"].includes(b.state); }
  paused() { const b = this.B; return !!b && PAUSED.includes(b.state); }
  fxOn(k) { const f = this.s.fx[k]; return !!f && (f.untilTurn == null || this.turn <= f.untilTurn) && (f.until == null || this.now() < f.until); }
  gripOf(id) { const g = this.P[id] && this.P[id].grip; return g && this.turn <= g.untilTurn ? g.mult : 1; }
  catchFrom(id) { return Math.max(0.05, 1 - (1 - this.T.CATCH_FROM) * this.gripOf(id)); }
  neighbours(h) {
    const al = this.aliveIds(), i = al.indexOf(h);
    if (i < 0 || al.length < 3) return al.filter(x => x !== h);
    return [...new Set([al[(i + 1) % al.length], al[(i - 1 + al.length) % al.length]])];
  }
  holds(a) { const b = this.B; return !!b && b.state === "held" && b.holder === a && this.isAlive(a); }
  comingTo(a) { const b = this.B; return !!b && b.state === "flying" && b.to === a; }
  progress(b) { return (this.now() - b.t0) / b.dur; }
  latOf(id) { return Math.min(this.T.LAG_ALLOW, Math.max(0, this.lat[id] || 0)); }
  maxLat() { return Math.max(0, ...this.humans().map(id => this.latOf(id))); }
  chargeOf(a) { const p = this.P[a]; return p && p.chargeStart ? Math.min(1, (this.now() - p.chargeStart) / this.T.CHARGE_TIME) : 0; }
  activeAbilities() {
    return Object.keys(this.s.rules).filter(id => RULES[id] && RULES[id].type === "ability")
      .sort((a, b) => this.s.rules[a] - this.s.rules[b]).slice(0, this.T.MAX_ABILITIES);
  }
  baseAbilities(a) {
    if (this.s.mode === "competitive") return ((this.P[a] && this.P[a].loadout) || []).filter(id => RULES[id] && RULES[id].type === "ability").slice(0, 3);
    return this.activeAbilities().filter(id => !RULES[id].limited);
  }
  abilitiesOf(a) {
    const base = this.baseAbilities(a), u = (this.P[a] && this.P[a].uses) || {};
    return [...base, ...Object.keys(u).filter(id => u[id] > 0 && RULES[id] && !base.includes(id))].slice(0, 6);
  }
  heldBall(holder, lastFrom) {
    const nb = { state: "held", holder, lastFrom: lastFrom || null, seq: ((this.B && this.B.seq) || 0) + 1, heldSince: this.now() };
    return this.sticky(nb);
  }
  sticky(nb, from) { const src = from || this.B; if (src) STICKY.forEach(k => { if (src[k] != null && nb[k] == null) nb[k] = src[k]; }); return nb; }
  setBall(b) { this.s.ball = b; this.dirty = true; }
  clappedFor(id, t0) {
    const p = this.P[id]; if (!p) return false;
    const ok = x => (x || 0) >= t0 - this.T.CLAP_TOLERANCE;
    return this.hasRule("doubleClap") ? ok(p.clapAt) && ok(p.prevClapAt) : ok(p.clapAt);
  }
  forcedSet(h) {
    const b = this.B;
    if (!b || b.nullified) return [];
    const set = new Set(Object.keys(this.s.doubles[h] || {}).filter(id => this.P[id]));
    if (b.counter && this.P[b.counter.to] && b.counter.to !== h) set.add(b.counter.to);
    return [...set];
  }
  cloneActive() { const c = this.s.fx.clone, b = this.B; return !!c && !!b && b.state === "held" && b.holder === c.holder && this.isAlive(c.of) && !b.nullified; }
  allowedTargets(h) {
    if (this.cloneActive() && this.B.holder === h) return [this.s.fx.clone.of, this.s.fx.clone.id];
    let opts = this.aliveIds().filter(id => id !== h);
    const req = this.forcedSet(h).filter(id => this.isAlive(id));
    if (req.length) return req;
    const b = this.B;
    if (b && !b.nullified && b.anti && this.aliveIds().length > 2) {
      const f = opts.filter(id => !b.anti[id]);
      if (f.length) opts = f;
    }
    const p = this.P[h];
    if (p && p.cornered && this.turn < p.cornered && !(b && b.nullified)) {   // Stampede: only the people next to you
      const nb = this.neighbours(h), f = opts.filter(id => nb.includes(id));
      if (f.length) opts = f;
    }
    return opts;
  }
  wardStart(h, by) { return Math.max(this.B.heldSince || 0, (this.P[by] && this.P[by].outAt) || 0); }
  doomOf(h) {
    const b = this.B;
    if (!b || b.state !== "held" || b.holder !== h || b.nullified || !this.isAlive(h)) return null;
    const deadBy = Object.keys(this.s.doubles[h] || {}).find(by => this.P[by] && this.P[by].out);
    if (deadBy) return { start: this.wardStart(h, deadBy), why: `had to pass to ${this.nm(deadBy)}, who's out` };
    if (this.forcedSet(h).length >= 2) return { start: Math.max(b.heldSince || 0, (this.P[h] && this.P[h].forcedAt) || 0), why: "couldn't throw to two people at once" };
    return null;
  }
  shownAim(a, real) {
    const b = this.B;
    if (b && b.holder === a && b.phantom && !b.nullified) return null;                         // Phantom Throw: no aim line
    if (this.event === "blackout" && this.chargeOf(a) < 0.5) return null;                      // Blackout: hidden until half charged
    if (!b || !b.decoy || b.nullified || b.holder !== a) return real;
    const others = this.allowedTargets(a).filter(x => x !== real);
    if (!others.length) return real;
    const k = a + ":" + b.seq;
    if (!this.decoyPick[k] || this.decoyPick[k] === real || !others.includes(this.decoyPick[k])) this.decoyPick[k] = this.pick(others);
    return this.decoyPick[k];
  }
  spinTarget(opts) { const b = this.B; return opts[(Math.floor((this.now() - (b.heldSince || this.now())) / this.T.SPIN_MS) + (b.seq % 97)) % opts.length]; }
  // where a human holder is really aiming (validated)
  aimFor(a) {
    const opts = this.allowedTargets(a);
    if (!opts.length) return null;
    if (opts.length === 1) return opts[0];
    if (this.hasRule("spinning")) return this.spinTarget(opts);
    return opts.includes(this.realAim[a]) ? this.realAim[a] : opts[0];
  }

  // ------------------------------------------------------------ players
  addPlayer(id, info) {
    const s = this.s, P = this.P;
    if (P[id]) { Object.assign(P[id], info, { away: false }); this.dirty = true; return { ok: true }; }
    if (!info.bot && this.humanCount() >= ECON.MAX_PLAYERS) return { ok: false, error: "That room is full (6 players)" };
    if (s.isRisk && (!this.B || this.B.state !== "lobby")) return { ok: false, error: "That High Risk game has already started or closed" };
    const used = Object.values(P).map(p => p.color);
    P[id] = Object.assign({
      color: COLORS.find(c => !used.includes(c)) || this.pick(COLORS), skin: "default", loadout: [],
      joinedAt: this.now(), seat: this.now() + this.rand(),
      out: this.running(), outAt: 0, clapAt: 0, prevClapAt: 0, chargeStart: 0, aim: null, uses: {}, stole: false,
    }, info);
    if (!info.bot) this.log(`${info.name} joined${P[id].out ? " (watching until next round)" : ""}`);
    this.dirty = true;
    return { ok: true };
  }
  removePlayer(id) {
    if (!this.P[id]) return;
    const b = this.B;
    delete this.P[id];
    delete this.realAim[id]; delete this.lat[id]; delete this.bot[id];
    Object.keys(this.s.doubles).forEach(v => { if (v === id) delete this.s.doubles[v]; else if (this.s.doubles[v]) delete this.s.doubles[v][id]; });
    if (b && b.state === "held" && b.holder === id) { const al = this.aliveIds(); if (al.length) this.setBall(this.heldBall(this.pick(al), null)); }
    if (b && b.state === "flying" && b.to === id) { const back = this.isAlive(b.from) ? b.from : this.aliveIds()[0]; if (back) this.setBall(this.heldBall(back, null)); }
    if (b && PAUSED.includes(b.state)) { const al = this.aliveIds(); if (b.state === "wheel" && b.resume && this.P[b.resume.holder]) {} else if (al.length) this.setBall(this.heldBall(this.isAlive(b.by) ? b.by : this.pick(al), null)); }
    if (this.s.fx.clone && (this.s.fx.clone.of === id || this.s.fx.clone.holder === id)) delete this.s.fx.clone;
    this.dirty = true;
  }
  addBots(levels) {
    const pool = () => BOT_POOL.slice().sort(() => this.rand() - 0.5).slice(0, 3);
    const seen = {};
    levels.forEach((lvl, i) => {
      seen[lvl] = (seen[lvl] || 0) + 1;
      const name = "🤖 " + lvl[0].toUpperCase() + lvl.slice(1) + (levels.filter(x => x === lvl).length > 1 ? " " + seen[lvl] : "");
      const id = "bot_" + Math.floor(this.rand() * 1e9).toString(36);
      this.addPlayer(id, { name, bot: lvl, loadout: this.s.mode === "competitive" ? pool() : [], seat: this.now() + i + 1 });
    });
    this.log(`🤖 ${levels.length} bots joined (${levels.join(", ")})`);
  }

  // ------------------------------------------------------------ eliminations & points
  mult(why) { return this.event === "golden" && ["win", "elimination", "bounty"].includes(why) ? 2 : 1; }
  award(uid, n, why) { if (n > 0 && this.P[uid] && !this.P[uid].bot && this.hooks.addPoints) this.hooks.addPoints(uid, n * this.mult(why), why); }
  eliminate(victim, by, msg, credit) {
    const P = this.P;
    if (!P[victim] || P[victim].out) return;
    const raw = [].concat(credit || []).filter(c => c && c !== victim && P[c]);
    const credited = raw.filter((c, i, a) => !P[c].bot && a.indexOf(c) === i);
    const paid = this.s.isPublic || this.s.isRisk;
    if (paid && credited.length) {
      credited.forEach(c => this.award(c, ECON.ELIM_POINTS, "elimination"));
      msg += ` (+${ECON.ELIM_POINTS * this.mult("elimination")} ${credited.map(c => this.nm(c)).join(", ")})`;
    }
    const b0 = this.B;
    if (b0 && b0.bounty === victim) {
      if (paid && credited.length) { credited.forEach(c => this.award(c, ECON.BOUNTY_POINTS, "bounty")); msg += ` 💰 BOUNTY +${ECON.BOUNTY_POINTS * this.mult("bounty")}!`; }
      else msg += " 💰 The bounty is gone!";
      b0.bounty = null;
    }
    P[victim].out = true; P[victim].outAt = this.now();
    P[victim].killer = raw[0] || null; P[victim].outTurn = this.turn;
    if (by && by !== victim && this.hasRule("soulsteal") && this.isAlive(by) && !P[by].stole) {
      P[by].stole = true;
      const vu = P[victim].uses || {}, bu = P[by].uses || (P[by].uses = {});
      const got = [];
      Object.keys(vu).forEach(k => { if (k !== "redo" && vu[k] > 0) { bu[k] = (bu[k] || 0) + vu[k]; vu[k] = 0; got.push(RULES[k].name); } });
      if (got.length) msg += ` 👻 ${this.nm(by)} stole: ${got.join(", ")}`;
    }
    this.log(msg);
  }

  // ------------------------------------------------------------ actions
  throwBall(a, tgt) {
    const b = this.B;
    if (!this.holds(a) || !tgt || tgt === a) return false;
    const clone = this.cloneActive() && this.s.fx.clone;
    if (clone && tgt === clone.id) {                      // threw to the clone: the thrower is out
      delete this.s.fx.clone; this.turn++;
      const p = this.P[a]; p.chargeStart = 0; p.aim = null;
      this.setBall(Object.assign(this.heldBall(clone.of, a), { duel: b.duel || 0 }));
      this.eliminate(a, null, `👥 ${this.nm(a)} threw to the CLONE! OUT!`, clone.of);
      return true;
    }
    if (!this.isAlive(tgt)) return false;
    if (this.s.fx.clone) delete this.s.fx.clone;
    this.turn++;
    const on = k => b[k] && !b.nullified;
    const req = b.nullified ? [] : this.forcedSet(a);
    const duel = this.aliveIds().length === 2 ? (b.duel || 0) + 1 : 0;
    const speed = (on("fast") ? 0.6 : 1) * (on("slow") ? 3 : 1) * (on("hellfire") ? 1.5 : 1);
    const dur = Math.max(this.T.MIN_FLIGHT, Math.round(this.T.FLIGHT_TIME * speed * Math.pow(this.T.DUEL_SPEEDUP, duel)));
    const nb = this.sticky({ state: "flying", from: a, to: tgt, t0: this.now(), dur, seq: b.seq + 1, nullified: !!b.nullified, duel }, b);
    if (on("ghost")) nb.ghost = true;
    if (on("hellfire")) nb.hellfire = true;
    if (on("phantom")) { const f = this.aliveIds().filter(id => id !== a && id !== tgt); if (f.length) nb.fake = this.pick(f); }
    this.setBall(nb);
    const p = this.P[a]; p.chargeStart = 0; p.aim = null;
    if (!b.nullified) {
      const d = this.s.doubles[a] || {};
      if (d[tgt]) { if (d[tgt] <= 1) delete d[tgt]; else d[tgt]--; if (!Object.keys(d).length) delete this.s.doubles[a]; }
      const unmet = req.filter(id => id !== tgt);
      if (unmet.length) this.eliminate(a, null, `⛓️ ${this.nm(a)} couldn't throw to everyone they were forced to (${unmet.map(x => this.nm(x)).join(", ")}). OUT!`, unmet);
    }
    return true;
  }
  clap(a, lat = 0) {
    const p = this.P[a], b = this.B;
    if (!p || p.out || !this.running() || this.holds(a)) return;
    const t = this.now() - Math.min(lat, this.T.LAG_ALLOW);
    p.prevClapAt = p.clapAt || 0; p.clapAt = t; p.clapFx = this.now();
    this.dirty = true;
    if (this.comingTo(a) || b.state === "nuke") return;      // good clap
    if (b.state === "wheel") return;                        // game paused for the Devil's Deal wheel
    const juker = b.state === "held" ? b.holder : b.state === "rush" ? b.by : b.from;
    this.judges.push({ a, t, juker, at: this.now() + this.T.CLAP_JUDGE_DELAY });
  }
  judgeClap(j) {
    const b = this.B, p = this.P[j.a];
    if (!p || p.out || !b || ["over", "lobby", "paying", "wheel"].includes(b.state)) return;
    if (((b.state === "flying" && b.to === j.a) || b.state === "nuke") && j.t >= b.t0 - this.T.CLAP_TOLERANCE) return;
    if (b.state === "held" && b.holder === j.a) return;
    if ((p.braceUntil || 0) >= j.t) { this.log(`🧱 ${this.nm(j.a)} clapped on a fake, but Brace saved them!`); return; }
    this.eliminate(j.a, null, `🤡 ${this.nm(j.a)} got juked and clapped. OUT!`, j.juker);
  }
  dispT0(b, id) { return b.t0 + this.latOf(id); }   // when that player sees the throw start
  tryCatch(a, lat = 0) {
    const b = this.B;
    if (!this.isAlive(a) || !this.comingTo(a)) return;
    const seen = this.now() - Math.min(lat, this.T.LAG_ALLOW);     // when they pressed, on their screen
    const sp = (seen - this.dispT0(b, a)) / b.dur;
    if (sp < this.catchFrom(a) - 0.02) return;   // too early: ignored
    if (!b.nullified && (b.fireball || (b.hellfire && sp >= 0.8))) return this.resolveFlight("fireballCatch");
    this.resolveFlight(this.clappedFor(a, b.t0) ? "catch" : "noclap");
  }
  resolveFlight(kind) {
    const b = this.B, rid = b.to;
    if (kind === "fireballLand" && !this.isAlive(rid)) kind = "drop";   // they got knocked out while it flew: ball goes back, nobody else is out
    const safe = kind === "catch" || kind === "fireballLand";
    const back = this.isAlive(b.from) ? b.from : this.pick(this.aliveIds().filter(id => id !== rid));
    const nb = safe ? this.heldBall(rid, b.from) : this.heldBall(back, rid);
    nb.duel = b.duel || 0;
    if (kind === "fireballLand") nb.lockUntil = this.now() + this.T.FIREBALL_LOCK_MS;
    if (!nb.holder) { this.setBall(Object.assign(nb, { holder: rid })); return; }
    this.setBall(nb);
    if (!safe && this.P[rid] && this.P[rid].out) { this.log(`↩️ ${this.nm(rid)} was already out, ball goes back to ${this.nm(back)}`); return; }
    if (kind === "catch") this.log(`✅ ${this.nm(rid)} clapped and caught it!`);
    else if (kind === "fireballLand") this.log(`🔥 ${this.nm(rid)} let the fireball land. Safe!`);
    else if (kind === "noclap") this.eliminate(rid, b.from, `❌ ${this.nm(rid)} caught without clapping. OUT! Ball goes back to ${this.nm(back)}.`, b.from);
    else if (kind === "fireballCatch") this.eliminate(rid, b.from, `🔥 ${this.nm(rid)} tried to catch a fireball. BURNED, OUT!`, b.from);
    else this.eliminate(rid, b.from, `💥 ${this.nm(rid)} dropped it. OUT!`, b.from);
  }
  resolveNuke() {
    const b = this.B, alive = this.aliveIds();
    const fails = alive.filter(id => !this.clappedFor(id, b.t0));
    if (fails.length === alive.length) {
      this.freshRound(null, { pot: b.pot || 0 });
      this.log("☢️ Nobody clapped for the nuke! Round reset, everyone's back in!");
      return;
    }
    const survivors = alive.filter(id => !fails.includes(id));
    this.setBall(this.heldBall(survivors.includes(b.by) ? b.by : this.pick(survivors), null));
    if (!fails.length) this.log("☢️ The nuke landed. Everyone clapped in time!");
    fails.forEach(id => this.eliminate(id, null, `☢️ ${this.nm(id)} didn't clap for the nuke. BOOM, OUT!`, b.by));
  }
  ggg(a) {
    const b = this.B;
    if (!b || !this.running() || !this.isAlive(a)) return;
    if (this.holds(a)) {
      const others = this.aliveIds().filter(id => id !== a);
      if (!others.length) return;
      const to = others.includes(b.lastFrom) ? b.lastFrom : this.pick(others);
      this.setBall(this.heldBall(to, null));
      this.eliminate(a, null, `⬇️ ${this.nm(a)} slammed the ball down and took themselves out. Ball goes to ${this.nm(to)}`);
      return;
    }
    const forcing = b.state === "held" && this.isAlive(b.holder) && !b.nullified && (this.s.doubles[b.holder] || {})[a];
    this.eliminate(a, null, forcing
      ? `⬇️ ${this.nm(a)} slammed it down and sacrificed themselves! ${this.nm(b.holder)} can't pass to them now, so they're out unless they Ward or someone uses Full Counter!`
      : `⬇️ ${this.nm(a)} slammed it down and took themselves out`);
  }

  // ------------------------------------------------------------ abilities
  canUse(id, a) {
    const p = this.P[a], b = this.B;
    if (!id || !p) return "-";
    if (!RULES[id] || !this.abilitiesOf(a).includes(id)) return "You don't have that ability";
    if (!this.running()) return "Round not running";
    if (((p.uses || {})[id] || 0) <= 0) return "Used up this round";
    if (id === "redo") return p.out ? "" : "Use after you get out";
    if (id === "vengeance") {
      if (!p.out) return "Use after you get knocked out";
      if (!p.killer || !this.isAlive(p.killer)) return "Nobody to take revenge on";
      if (this.turn > (p.outTurn || 0) + 1) return "Too late (1 turn after you're out)";
      return this.paused() ? "Wait…" : "";
    }
    if (p.out) return "You're out";
    if (this.paused()) return "Wait…";
    if (b.nullified) return "Full Counter is on this turn";
    if (p.pending) return "Waiting for the bank…";
    const othersHold = b.state === "held" && b.holder !== a;
    const someoneElse = () => this.aliveIds().some(x => x !== a) ? "" : "Nobody to use it on";
    switch (id) {
      case "mirage": return this.fxOn("mirage") ? "Already on" : "";
      case "wideGrip": case "giant": return this.gripOf(a) > 1 ? "Already on" : "";
      case "ghostBall": return !this.holds(a) ? "Use while you hold the ball" : b.ghost ? "Already on" : "";
      case "clone":
        if (!othersHold) return "Use when someone else has the ball";
        if (this.s.fx.clone) return "There's already a clone";
        if (this.forcedSet(b.holder).length) return "A force is already on them";
        return "";
      case "flash": return this.fxOn("flash") ? "Already flashing" : "";
      case "quake": return this.fxOn("quake") ? "Already shaking" : "";
      case "warCry":
        if (!othersHold) return "Use when someone else has the ball";
        return b.warcry ? "Already on" : "";
      case "bullRush": case "stampede":
        if (!othersHold) return "Use when someone else has the ball";
        return this.chargeOf(b.holder) >= 0.6 ? "Too late, their bar is past 60%" : "";
      case "blindingLight":
        if (!othersHold) return "Use when someone else has the ball";
        return b.slow ? "Already on" : "";
      case "angelicScream":
        if (!this.comingTo(a)) return "Use while the ball is flying to you";
        if (this.progress(b) >= 0.5) return "Too late, it's past halfway";
        return this.isAlive(b.from) ? "" : "The thrower is out";
      case "fullWipe": return Object.keys(this.s.rules).some(r => RULES[r] && RULES[r].type === "passive") ? "" : "No passive rules to wipe";
      case "neutralise": case "heavenlyWrath": return someoneElse();
      case "devilsDeal":
        if (b.state !== "held") return "Use while someone is holding the ball";
        return this.humans().some(x => x !== a) ? "" : "Needs another real player";
      case "hellfire": return !this.holds(a) ? "Use while you hold the ball" : b.hellfire ? "Already on" : "";
      case "jumpScare": return this.holds(a) ? "Not while you hold the ball" : "";
      case "phantomThrow":
        if (!this.holds(a)) return "Use while you hold the ball";
        if (b.phantom) return "Already on";
        return this.aliveIds().length < 3 ? "Needs 3+ players left" : "";
      case "fireball": return (b.state === "flying" && b.from === a && !b.fireball && this.progress(b) < this.T.FIREBALL_WINDOW) ? "" : "Use right after you throw";
      case "swap":
        if (!this.holds(a)) return "Use while you hold the ball";
        if (this.chargeOf(a) >= 0.5) return "Too late, your bar is past 50%";
        if (!b.lastFrom || !this.P[b.lastFrom] || b.lastFrom === a) return "Nobody threw it to you";
        return "";
      case "doubleForce":
        if (!othersHold) return "Use when someone else has the ball";
        return (this.s.doubles[b.holder] || {})[a] ? "You already double-forced them" : "";
      case "antiForce":
        if (!othersHold) return "Use when someone else has the ball";
        if (this.aliveIds().length <= 2) return "Disabled in 1v1";
        if (Object.keys(this.s.doubles[b.holder] || {}).length) return "They're double-forced";
        if (b.counter && b.counter.to === a) return "You're their counter-force target";
        if (b.anti && b.anti[a]) return "Already on";
        return "";
      case "counterForce":
        if (!othersHold) return "Use when someone else has the ball";
        if (this.forcedSet(b.holder).length) return "A force is already on them";
        return this.aliveIds().length <= 2 ? "Need 3+ players left" : "";
      case "absoluteCounter": return "";
      case "ward": case "nuke": return this.holds(a) ? "" : "Use while you hold the ball";
      case "brace": return (p.braceUntil || 0) > this.now() ? "Already braced" : "";
      case "speedUp":
        if (!othersHold) return "Use when someone else has the ball";
        return b.fast ? "Already sped up" : "";
      case "decoy":
        if (!this.holds(a)) return "Use while you hold the ball";
        if (b.decoy) return "Already on";
        return this.allowedTargets(a).length < 2 ? "Needs 2+ people you could throw to" : "";
    }
    return "Unknown ability";
  }
  useAbility(id, a, target) {
    const why = this.canUse(id, a);
    if (why) return why;
    const b = this.B, R = RULES[id], p = this.P[a];
    const done = msg => { p.uses[id] = Math.max(0, (p.uses[id] || 0) - 1); this.log(`${R.icon} ${msg}`); this.dirty = true; };
    switch (id) {
      case "fireball": b.fireball = true; done(`${this.nm(a)} turned it into a FIREBALL at ${this.nm(b.to)}! Don't catch it!`); break;
      case "swap": {
        const o = b.lastFrom, ps = p.seat; p.seat = this.P[o].seat; this.P[o].seat = ps;
        done(`${this.nm(a)} SWAPPED places with ${this.nm(o)}`); break;
      }
      case "doubleForce": {
        const h = b.holder;
        (this.s.doubles[h] || (this.s.doubles[h] = {}))[a] = 2;
        this.P[h].forcedAt = this.now();
        done(`${this.nm(a)} DOUBLE FORCED ${this.nm(h)}: they must throw to ${this.nm(a)} now and next time`); break;
      }
      case "brace": p.braceUntil = this.now() + 3000; done(`${this.nm(a)} used BRACE. Fakes can't get them for 3 seconds`); break;
      case "speedUp": b.fast = true; done(`${this.nm(a)} used SPEED UP. ${this.nm(b.holder)}'s next throw will be 40% faster!`); break;
      case "decoy": b.decoy = true; done(`${this.nm(a)} used DECOY. Their aim line can't be trusted this turn`); break;
      case "antiForce": (b.anti || (b.anti = {}))[a] = true; done(`${this.nm(a)} used ANTI FORCE. ${this.nm(b.holder)} can't throw to them this turn`); break;
      case "counterForce": {
        if (target === a) return "Counter Force can't be yourself";
        if (!this.isAlive(target) || target === b.holder) return "Pick someone else who's still in";
        b.counter = { to: target, by: a }; this.P[b.holder].forcedAt = this.now();
        done(`${this.nm(a)} COUNTER FORCED ${this.nm(b.holder)} to throw to ${this.nm(target)}`); break;
      }
      case "absoluteCounter": {
        const victim = b.state === "held" ? b.holder : (b.state === "flying" ? b.from : null);
        if (b.state === "nuke") this.setBall(Object.assign(this.heldBall(b.by, null), { nullified: true }));
        else b.nullified = true;
        if (victim) delete this.s.doubles[victim];
        done(`${this.nm(a)} used FULL COUNTER. No abilities work this turn!`); break;
      }
      case "ward": delete b.counter; delete b.anti; delete this.s.doubles[a]; done(`${this.nm(a)} put up a WARD. All forces on them are gone`); break;
      case "nuke":
        p.chargeStart = 0;
        this.setBall(this.sticky({ state: "nuke", by: a, t0: this.now(), dur: this.T.FLIGHT_TIME * 2, seq: b.seq + 1 }, b));
        done(`${this.nm(a)} launched a NUKE! EVERYONE CLAP!`); break;
      case "redo": p.out = false; p.clapAt = 0; p.prevClapAt = 0; done(`${this.nm(a)} used REDO and is back in!`); break;
      // ---- Illusioner
      case "mirage": this.s.fx.mirage = { by: a, untilTurn: this.turn + 2 }; done(`${this.nm(a)} cast a MIRAGE. Who's who?`); break;
      case "wideGrip": p.grip = { mult: 2.5, untilTurn: this.turn + 2 }; done(`${this.nm(a)} used WIDE GRIP. They can catch much earlier for 2 turns`); break;
      case "ghostBall": b.ghost = true; done(`${this.nm(a)} used GHOST BALL. Their next throw is invisible!`); break;
      case "clone": {
        const id = Array.from({ length: 28 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(this.rand() * 62)]).join("");
        const o = this.P[a];
        this.s.fx.clone = { id, of: a, holder: b.holder, look: { name: o.name, color: o.color, skin: o.skin, seat: o.seat + 0.0001 * (this.chance(0.5) ? 1 : -1), joinedAt: o.joinedAt, bot: o.bot || undefined, out: false, uses: {}, loadout: [] } };
        done(`${this.nm(a)} made a CLONE! ${this.nm(b.holder)} must throw to one of them. Pick the clone and you're OUT`); break;
      }
      case "flash": this.s.fx.flash = { by: a, at: this.now() + this.T.FLASH_WARN_MS, until: this.now() + this.T.FLASH_WARN_MS + 1600 }; done(`${this.nm(a)}: FLASH INCOMING!`); break;
      // ---- Barbaric
      case "quake": this.s.fx.quake = { by: a, at: this.now(), until: this.now() + this.T.QUAKE_MS }; done(`${this.nm(a)} caused a QUAKE!`); break;
      case "giant": p.grip = { mult: 1.5, untilTurn: this.turn + 1, giant: true }; done(`${this.nm(a)} went GIANT!`); break;
      case "warCry": {
        const h = b.holder, hp = this.P[h];
        if (this.hasRule("noJuke")) { done(`${this.nm(a)} let out a WAR CRY! ${this.nm(h)} panics and throws!`); this.throwBall(h, hp.bot ? (this.bot[h] && this.bot[h].aim) || this.aimFor(h) : this.aimFor(h)); break; }
        b.warcry = true; if (!hp.chargeStart) hp.chargeStart = this.now();
        done(`${this.nm(a)} let out a WAR CRY! ${this.nm(h)}'s bar is filling and they can't stop it!`); break;
      }
      case "bullRush": case "stampede": {
        const h = b.holder, fast = id === "stampede";
        this.P[h].chargeStart = 0;
        if (fast) this.P[h].cornered = this.turn + 3;     // their next 3 throws
        this.setBall(this.sticky({ state: "rush", by: a, victim: h, from: a, t0: this.now(), dur: fast ? this.T.STAMPEDE_MS : this.T.RUSH_MS, seq: b.seq + 1, duel: b.duel || 0 }, b));
        done(fast ? `${this.nm(a)} STAMPEDED into ${this.nm(h)} and took the ball! ${this.nm(h)} can only throw to their neighbours for 3 turns` : `${this.nm(a)} BULL RUSHED ${this.nm(h)} and stole the ball!`); break;
      }
      // ---- Angel
      case "blindingLight": b.slow = true; done(`${this.nm(a)} used BLINDING LIGHT. ${this.nm(b.holder)}'s next throw will be 3x slower`); break;
      case "angelicScream": {
        const back = b.from, pr = Math.min(0.5, Math.max(0, this.progress(b)));
        this.turn++;
        const dur = Math.max(this.T.MIN_FLIGHT, Math.round(b.dur * 0.6));
        this.setBall(this.sticky({ state: "flying", from: a, to: back, t0: this.now(), dur, seq: b.seq + 1, duel: b.duel || 0, mid: { from: back, to: a, p: pr } }, b));
        done(`${this.nm(a)} let out an ANGELIC SCREAM! The ball flies back to ${this.nm(back)}: clap and catch!`); break;
      }
      case "fullWipe": {
        const gone = Object.keys(this.s.rules).filter(r => RULES[r] && RULES[r].type === "passive");
        gone.forEach(r => delete this.s.rules[r]);
        done(`${this.nm(a)} used FULL WIPE. Gone: ${gone.map(r => RULES[r].name).join(", ")}`); break;
      }
      case "neutralise": case "heavenlyWrath": case "devilsDeal": return this.moneyAbility(id, a, target);
      // ---- Devil
      case "hellfire": b.hellfire = true; done(`${this.nm(a)} used HELLFIRE. Their next throw turns to fire near the end!`); break;
      case "jumpScare": {
        const victim = this.pick(this.humans().length ? this.humans() : Object.keys(this.P));
        this.s.fx.scare = { by: a, victim, at: this.now(), until: this.now() + 1500 };
        done(`${this.nm(a)} used JUMP SCARE… on ${victim === a ? "THEMSELVES" : this.nm(victim)}!`); break;
      }
      case "phantomThrow": b.phantom = true; done(`${this.nm(a)} used PHANTOM THROW. Two balls are coming. Only one is real!`); break;
      case "vengeance": {
        const k = p.killer;
        done(`${this.nm(a)} took VENGEANCE!`);
        if (this.B.state === "held" && this.B.holder === k) { const al = this.aliveIds().filter(x => x !== k); if (al.length) this.setBall(this.heldBall(this.pick(al), k)); }
        if (this.B.state === "flying" && (this.B.to === k)) { const al = this.aliveIds().filter(x => x !== k); if (al.length) this.setBall(this.heldBall(this.isAlive(this.B.from) ? this.B.from : this.pick(al), k)); }
        this.eliminate(k, null, `🗡️ ${this.nm(k)} was struck down by ${this.nm(a)}'s VENGEANCE. OUT!`, a);
        break;
      }
    }
    this.dirty = true;
    return "";
  }

  // abilities that move real points/abilities: the bank does that part, then we carry on
  moneyAbility(id, a, target) {
    const p = this.P[a], R = RULES[id];
    if (!target || target === a || !this.P[target]) return "Click another player";
    if (id !== "devilsDeal" && !this.isAlive(target)) return "Pick someone who's still in";
    if (id === "devilsDeal" && this.P[target].bot) return "Bots don't have abilities to steal";
    if (p.bot) return "Bots can't use this";
    const round = this.round, h = this.hooks;
    const call = id === "neutralise" ? h.spend && h.spend(a, ECON.NEUTRALISE_COST)
      : id === "heavenlyWrath" ? h.transfer && h.transfer(a, target, ECON.WRATH_COST)
      : h.devilsDeal && h.devilsDeal(a, target);
    if (!call) return "Not available here";
    p.pending = true; this.dirty = true;
    const finish = r => {
      if (this.P[a]) this.P[a].pending = false;
      this.dirty = true;
      const ok = r === true || (r && r.ok);
      if (!ok) { this.log(`${R.icon} ${this.nm(a)} couldn't use ${R.name}: ${(r && r.error) || "not enough points"}`); return; }
      if (this.round !== round) return;            // a new round started meanwhile
      if (this.P[a]) this.P[a].uses[id] = 0;
      if (id === "neutralise") {
        const tp = this.P[target]; if (tp) Object.keys(tp.uses || {}).forEach(k => tp.uses[k] = 0);
        this.log(`🚫 ${this.nm(a)} paid ${ECON.NEUTRALISE_COST} points and NEUTRALISED ${this.nm(target)}. All their abilities are gone this round!`);
      } else if (id === "heavenlyWrath") {
        const hit = this.chance(0.5);
        this.log(`⚖️ ${this.nm(a)} gave ${this.nm(target)} ${ECON.WRATH_COST} points and called down HEAVENLY WRATH… ${hit ? "STRUCK!" : "they survived!"}`);
        if (hit && this.isAlive(target) && this.running()) {
          const b = this.B;
          if ((b.state === "held" && b.holder === target) || (b.state === "flying" && b.to === target)) {
            const al = this.aliveIds().filter(x => x !== target);
            if (al.length) this.setBall(this.heldBall(b.state === "flying" && this.isAlive(b.from) ? b.from : this.pick(al), target));
          }
          this.eliminate(target, null, `⚖️ ${this.nm(target)} was smitten. OUT!`, a);
        }
      } else {
        this.log(`🎡 ${this.nm(a)} paid ${this.nm(target)} ${ECON.DEAL_COST} points for a DEVIL'S DEAL. The wheel is spinning…`);
        const b = this.B;
        const wheel = { state: "wheel", by: a, target, t0: this.now(), dur: this.T.WHEEL_MS, win: !!r.win, prize: r.ability || null, seq: ((b && b.seq) || 0) + 1 };
        if (b && b.state === "held") { wheel.resume = b; this.setBall(wheel); }
        else this.s.fx.wheelLog = wheel;
        this.wheelResult = { a, target, win: !!r.win, prize: r.ability, at: this.now() + this.T.WHEEL_MS };
      }
    };
    Promise.race([Promise.resolve(call), new Promise(res => setTimeout(() => res({ ok: false, error: "the bank took too long" }), this.T.MONEY_TIMEOUT_MS))])
      .then(finish, e => finish({ ok: false, error: e && e.message }));
    return "";
  }

  // ------------------------------------------------------------ rounds
  freshRound(onlyIds, extraBall) {
    const ids = onlyIds || Object.keys(this.P);
    ids.forEach(id => {
      const p = this.P[id]; if (!p) return;
      const fresh = {};
      this.baseAbilities(id).forEach(x => fresh[x] = 1);
      Object.assign(p, { out: false, outAt: 0, clapAt: 0, prevClapAt: 0, chargeStart: 0, aim: null, stole: false, uses: fresh, braceUntil: 0, forcedAt: 0,
        grip: null, cornered: 0, killer: null, outTurn: 0, pending: false });
    });
    this.s.doubles = {}; this.s.fx = {}; this.round++; this.wheelResult = null;
    const nb = this.heldBall(this.pick(ids), null);
    nb.duel = 0; nb.seq = ((this.B && this.B.seq) || 0) + 1;
    STICKY.forEach(k => { if (k !== "duel" && !this.s.isRisk) delete nb[k]; });
    if (extraBall) Object.assign(nb, extraBall);
    if (this.event === "bounty" && ids.length >= 2) nb.bounty = this.pick(ids);
    if (this.event === "golden" && this.s.isPublic && this.rand() < (this.goldenOdds != null ? this.goldenOdds : GOLDEN_JACKPOT)) nb.jackpot = true;
    this.setBall(nb);
    this.overPending = 0; this.lowAliveSince = 0;
  }
  // Everyone here came in through "Join friend" links (or is the friend they followed): the game waits
  // for a stranger, or for bots after the usual wait. People who matched normally never count as a group.
  friendsOnly() {
    const h = this.humans();
    if (!this.s.isPublic || h.length < 2) return false;
    const parent = {}; h.forEach(id => parent[id] = id);
    const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
    h.forEach(id => { const v = this.P[id].viaFriend; if (v && parent[v] !== undefined) parent[find(id)] = find(v); });
    const roots = new Set(h.map(find));
    return roots.size === 1 && h.some(id => this.P[id].viaFriend);
  }
  botVotes() {
    const h = this.humans(), votes = h.filter(id => this.P[id].botVote).length;
    // you can't vote bots in on your own (that would skip the wait and let you farm bots): it needs 2+ real players
    return { votes, humans: h.length, need: Math.max(2, Math.floor(h.length / 2) + 1), passed: h.length >= 2 && votes > h.length / 2 };
  }
  startRound(by) {
    const s = this.s;
    if (s.isRisk) return by ? this.riskBegin(by) : "";
    const b = this.B;
    if (b && this.running()) return "A round is already running";
    if (b && b.state === "over" && !b.ruleChosen && this.P[b.winner]) return `Waiting for ${this.nm(b.winner)} to pick a rule…`;
    const total = () => Object.keys(this.P).length, v = this.botVotes();
    if (total() < 2) this.addBots(s.isPublic ? MATCH_BOTS : ["easy", "medium", "hard"]);
    else if (this.friendsOnly() && !Object.values(this.P).some(p => p.bot)) {
      this.log("Only friends are here, so bots are joining to keep it fair");
      this.addBots(MATCH_BOTS.slice(0, Math.max(1, ECON.MAX_PLAYERS - total())));
    }
    else if (v.passed && total() < ECON.MAX_PLAYERS) {
      this.log(`🤖 Vote passed (${v.votes}/${v.humans}): bots are filling the room`);
      this.addBots(["hard", "medium", "easy", "medium", "hard", "easy"].slice(0, ECON.MAX_PLAYERS - total()));
    }
    // too many players: bots leave so real players get a spot
    const bots = Object.keys(this.P).filter(id => this.P[id].bot);
    const extra = Math.max(0, total() - ECON.MAX_PLAYERS);
    const leaving = extra ? bots.slice(-extra) : [];
    leaving.forEach(id => this.removePlayer(id));
    if (leaving.length) this.log(`🤖 ${leaving.length} bot${leaving.length > 1 ? "s" : ""} left to make room for players`);
    if (v.passed) this.humans().forEach(id => this.P[id].botVote = false);
    this.freshRound();
    this.log(by ? `New round started by ${this.nm(by)}` : "New round!");
    return "";
  }
  endRound(winner) {
    const b = this.B, s = this.s;
    if (!this.running()) return;
    const human = winner && this.P[winner] && !this.P[winner].bot;
    this.setBall({ state: "over", winner: winner || null, seq: b.seq + 1, ruleChosen: s.isRisk ? true : !winner,
      award: !!(s.isPublic && human), risk: s.isRisk, pot: b.pot || 0, stake: b.stake || 0, endedAt: this.now() });
    if (s.isRisk) {
      if (winner && human && b.pot > 0) this.award(winner, b.pot, "pot");
      if (!winner) this.humans().forEach(id => { if (this.P[id].paid > 0) this.award(id, this.P[id].paid, "refund"); });
      this.log(winner ? `🎲 ${this.nm(winner)} wins the pot of ⭐ ${b.pot || 0}!` : "🤝 Tie! Everyone gets their stake back.");
      return;
    }
    if (!winner) { this.log("🤝 Everyone went out at once. Tie, nobody wins!"); return; }
    if (s.isPublic && human) this.award(winner, ECON.WIN_POINTS, "win");
    const pts = s.mode !== "competitive" ? "" : !s.isPublic ? " (private room, no points)" : (human ? ` +${ECON.WIN_POINTS * this.mult("win")} points!` : "");
    if (b.jackpot && s.isPublic && human && this.hooks.grant) {
      const prize = this.pick(JACKPOT_PRIZES);
      this.hooks.grant(winner, prize);
      this.log(`🌈 JACKPOT! ${this.nm(winner)} won a FREE ${RULES[prize].icon} ${RULES[prize].name}!`);
    }
    this.log(`🏆 ${this.nm(winner)} wins!${pts} They get to ${s.mode === "competitive" ? "add or remove a passive" : "add or remove a rule"}.`);
  }
  chooseRule(a, action, id) {
    const b = this.B, s = this.s;
    if (!b || b.state !== "over" || b.ruleChosen || b.winner !== a) return "Not your pick";
    if (action !== "skip") {
      if (!RULES[id] || RULES[id].limited || (s.mode === "competitive" && RULES[id].type !== "passive")) return "Can't pick that";
      if (action === "add") {
        if (s.rules[id]) return "Already on";
        if (RULES[id].type === "ability" && this.activeAbilities().length >= this.T.MAX_ABILITIES) return "3 abilities max";
        s.rules[id] = this.now();
        this.log(`➕ ${this.nm(a)} added ${RULES[id].icon} ${RULES[id].name}`);
      } else if (action === "remove") {
        if (!s.rules[id]) return "Not on";
        delete s.rules[id];
        this.log(`➖ ${this.nm(a)} removed ${RULES[id].icon} ${RULES[id].name}`);
      } else return "?";
    } else this.log(`${this.nm(a)} kept the rules the same`);
    b.ruleChosen = true; this.dirty = true;
    return "";
  }

  // ------------------------------------------------------------ High Risk
  riskBegin(by) {
    const b = this.B;
    if (!b || b.state !== "lobby") return "Already started";
    if (this.hostId() !== by) return "Only the host can start";
    if (this.humanCount() < 2) return "Need at least 2 players";
    this.humans().forEach(id => { delete this.P[id].paid; });
    this.setBall(Object.assign({}, b, { state: "paying", seq: b.seq + 1, until: this.now() + this.T.RISK_PAY_MS }));
    this.log(`🎲 Paying the stake of ⭐ ${b.stake}…`);
    this.humans().forEach(id => {
      if (!this.hooks.payStake) { this.P[id].paid = b.stake; return; }
      this.hooks.payStake(id, b.stake).then(ok => { if (this.P[id]) { this.P[id].paid = ok ? b.stake : 0; this.dirty = true; } })
        .catch(() => { if (this.P[id]) { this.P[id].paid = 0; this.dirty = true; } });
    });
    return "";
  }
  riskTick(t) {
    const b = this.B;
    if (!b || b.state !== "paying") return;
    const h = this.humans();
    if (!h.every(id => this.P[id].paid != null) && t < b.until) return;
    const paid = h.filter(id => this.P[id].paid > 0);
    h.filter(id => !(this.P[id].paid > 0)).forEach(id => { this.kicked = (this.kicked || []).concat(id); this.removePlayer(id); });
    if (paid.length < 2) {
      paid.forEach(id => this.award(id, this.P[id].paid, "refund"));
      this.setBall({ state: "over", winner: null, seq: b.seq + 1, ruleChosen: true, risk: true, pot: 0, stake: b.stake });
      this.log("🎲 Not enough players paid. Stakes refunded.");
      return;
    }
    this.freshRound(paid, { pot: b.stake * paid.length, risk: true, stake: b.stake });
    this.log(`🎲 ${paid.length} players paid. Pot: ⭐ ${b.stake * paid.length}. Go!`);
  }
  hostId() { const h = this.humans().sort((a, b) => this.P[a].joinedAt - this.P[b].joinedAt); return h.find(id => !this.P[id].away) || h[0]; }

  // ------------------------------------------------------------ inputs from players
  input(a, msg) {
    const p = this.P[a];
    if (!p || !msg || typeof msg.t !== "string") return "";
    const lat = this.latOf(a);
    this.dirty = true;
    switch (msg.t) {
      case "spaceDown": {
        if (this.holds(a)) {
          const b = this.B;
          if (b.lockUntil && this.now() < b.lockUntil) return "";
          if (this.hasRule("noJuke")) { this.throwBall(a, this.aimFor(a)); return ""; }
          if (!p.chargeStart) p.chargeStart = this.now() - lat;
        } else if (this.comingTo(a)) this.tryCatch(a, lat);
        return "";
      }
      case "spaceUp":
        if (this.holds(a) && this.B.warcry && !this.B.nullified) return "";      // War Cry: can't let go
        if (this.holds(a) && p.chargeStart && (this.now() - lat) - p.chargeStart < this.T.CHARGE_TIME) p.chargeStart = 0;   // let go early: fake
        return "";
      case "aim": if (typeof msg.target === "string" || msg.target === null) this.realAim[a] = msg.target; return "";
      case "clap": this.clap(a, lat); return "";
      case "ggg": this.ggg(a); return "";
      case "ability": return this.useAbility(String(msg.id || ""), a, typeof msg.target === "string" ? msg.target : null);
      case "rule": return this.chooseRule(a, msg.action, msg.id);
      case "start": if (this.s.isPublic) return "Matchmade rounds start by themselves"; return this.startRound(a);
      case "vote": if (this.s.isRisk) return ""; if (this.humanCount() < 2) return "You need at least 2 real players to vote for bots"; p.botVote = !p.botVote; return "";
      case "removeBots":
        if (this.hostId() !== a) return "";
        Object.keys(this.P).filter(id => this.P[id].bot).forEach(id => this.removePlayer(id));
        this.log(`🤖 ${this.nm(a)} removed the bots`); return "";
      case "away": p.away = !!msg.away; return "";
    }
    return "";
  }

  // ------------------------------------------------------------ the clock
  tick() {
    const t = this.now(), s = this.s, b = this.B, T = this.T;
    // clap judgements that are due
    if (this.judges.length) { const due = this.judges.filter(j => j.at <= t); this.judges = this.judges.filter(j => j.at > t); due.forEach(j => this.judgeClap(j)); }
    if (b && b.state === "rush" && t >= b.t0 + b.dur) {          // Bull Rush / Stampede: the rusher arrives back with the ball
      const to = this.isAlive(b.by) ? b.by : this.isAlive(b.victim) ? b.victim : this.pick(this.aliveIds());
      if (to) this.setBall(Object.assign(this.heldBall(to, b.victim), { duel: b.duel || 0 }));
    }
    if (b && b.state === "wheel" && t >= b.t0 + b.dur) {         // Devil's Deal wheel finished: carry on where we were
      const r = b.resume;
      const holder = r && this.isAlive(r.holder) ? r.holder : this.pick(this.aliveIds());
      if (holder) this.setBall(Object.assign({}, r || {}, { state: "held", holder, seq: b.seq + 1, heldSince: t, lockUntil: 0 }));
      if (this.P[holder]) this.P[holder].chargeStart = 0;
    }
    if (this.wheelResult && t >= this.wheelResult.at) {
      const w = this.wheelResult; this.wheelResult = null; delete this.s.fx.wheelLog;
      const R = w.prize && RULES[w.prize];
      this.log(w.win && R ? `🎡 The wheel says YES! ${this.nm(w.a)} stole ${this.nm(w.target)}'s ${R.icon} ${R.name} forever!` : `🎡 The wheel says no. ${this.nm(w.target)} keeps their abilities (and the 500 points)`);
    }
    for (const k of ["flash", "quake", "scare", "mirage"]) if (this.s.fx[k] && !this.fxOn(k)) { delete this.s.fx[k]; this.dirty = true; }
    if (this.s.fx.clone && !this.cloneActive()) { delete this.s.fx.clone; this.dirty = true; }
    if (this.running()) {
      const b0 = this.B;
      // human holders: aim (with decoy), throw when the bar is full
      if (b0.state === "held" && this.P[b0.holder] && !this.P[b0.holder].bot && this.isAlive(b0.holder)) {
        const h = b0.holder, p = this.P[h], aim = this.aimFor(h), shown = this.shownAim(h, aim);
        if (p.aim !== shown) { p.aim = shown; this.dirty = true; }
        if (p.chargeStart && t - p.chargeStart >= T.CHARGE_TIME + this.latOf(h) + 30) this.throwBall(h, aim);
        else if (t - (b0.heldSince || t) > T.HOLD_LIMIT_MS && aim) {    // gone quiet (left the tab, lost connection…): don't freeze everyone
          this.log(`⏰ ${this.nm(h)} held the ball for ${Math.round(T.HOLD_LIMIT_MS / 1000)}s, so it was thrown for them`);
          this.throwBall(h, aim);
        }
      }
      // hot potato
      const b1 = this.B;
      if (b1.state === "held" && this.hasRule("hotPotato") && this.isAlive(b1.holder) && t - (b1.heldSince || t) > T.HOT_POTATO_MS) {
        const others = this.aliveIds().filter(id => id !== b1.holder);
        if (others.length) { const h = b1.holder; this.setBall(this.heldBall(this.pick(others), h)); this.eliminate(h, null, `🥔 ${this.nm(h)} held the hot potato too long. OUT!`); }
      }
      // double force doom
      const b2 = this.B;
      if (b2.state === "held" && !b2.nullified) {
        const h = b2.holder, doom = this.doomOf(h);
        if (doom && t - doom.start > T.DF_GRACE_MS) {
          const others = this.aliveIds().filter(id => id !== h);
          const forcers = [...Object.keys(s.doubles[h] || {}), ...(b2.counter ? [b2.counter.by] : [])];
          if (others.length) this.setBall(this.heldBall(others.includes(b2.lastFrom) ? b2.lastFrom : this.pick(others), null));
          delete s.doubles[h];
          this.eliminate(h, null, `⛓️ ${this.nm(h)} ${doom.why}. OUT!`, forcers);
        }
      }
      // flight: dropped? (the receiver gets their full time even if their connection is slow)
      const b3 = this.B;
      if (b3.state === "flying" && b3.hellfire && !b3.fireball && !b3.nullified && t >= this.dispT0(b3, b3.to) + b3.dur * 0.8) { b3.fireball = true; this.dirty = true; }
      if (b3.state === "flying" && t > this.dispT0(b3, b3.to) + b3.dur + T.DROP_GRACE * Math.max(1, this.gripOf(b3.to)) + this.latOf(b3.to))
        this.resolveFlight(b3.fireball && !b3.nullified ? "fireballLand" : "drop");
      const b4 = this.B;
      if (b4.state === "nuke" && t > b4.t0 + b4.dur + 350 + this.maxLat()) this.resolveNuke();
    }
    if (this.running()) this.roundEndCheck(t);
    if (s.isRisk) this.riskTick(t); else this.autoTick(t);
    if (this.running()) this.botsTick(t);
    this.botRuleChoice(t);
    this.recordMatches();
  }
  roundEndCheck(t) {
    const alive = this.aliveIds(), b = this.B;
    // safety net: the ball must never sit with someone who is out (nobody could ever throw it)
    if (b.state === "held" && alive.length >= 2 && !this.isAlive(b.holder)) {
      const to = this.isAlive(b.lastFrom) ? b.lastFrom : this.pick(alive);
      this.log(`↩️ ${this.nm(b.holder) || "Someone"} is out, so the ball goes to ${this.nm(to)}`);
      this.setBall(Object.assign(this.heldBall(to, b.holder), { duel: b.duel || 0 }));
      return;
    }
    if (alive.length <= 1) {
      if (!this.lowAliveSince) this.lowAliveSince = t;
      else if (t - this.lowAliveSince > this.T.STUCK_MS) { this.endRound(alive[0]); return; }
    } else this.lowAliveSince = 0;
    const pendingDF = b.state === "held" && !b.nullified && this.isAlive(b.holder) && Object.keys(this.s.doubles[b.holder] || {}).some(by => this.P[by] && this.P[by].out);
    if (alive.length === 0) this.endRound(null);
    else if (alive.length === 1 && pendingDF) this.overPending = 0;
    else if (alive.length <= 1) {
      const canRedo = Object.keys(this.P).some(id => {
        const x = this.P[id], u = x.uses || {};
        return x.out && ((u.redo || 0) > 0 || ((u.vengeance || 0) > 0 && this.canUse("vengeance", id) === ""));
      });
      const waiting = this.paused() || Object.values(this.P).some(x => x.pending);   // a wheel spin or a bank answer is still coming
      if (waiting) { this.overPending = t; return; }
      if (!canRedo) this.endRound(alive[0]);
      else if (!this.overPending) this.overPending = t;
      else if (t - this.overPending > this.T.REDO_GRACE_MS) this.endRound(alive[0]);
    } else this.overPending = 0;
  }
  // lobby countdown, bots if nobody comes, winner timer, next round
  autoTick(t) {
    const s = this.s, b = this.B, T = this.T;
    if (!b) return;
    if (b.state === "over" && !b.ruleChosen) {
      if (this.overTimerSeq !== b.seq) { this.overTimerSeq = b.seq; this.overTimerAt = t; }
      if (t - this.overTimerAt > T.RULE_PICK_MS && !(this.P[b.winner] && this.P[b.winner].bot)) {
        b.ruleChosen = true; this.dirty = true;
        this.log(`${this.nm(b.winner)} took too long to pick a rule, so nothing changed`);
      }
      return;
    }
    if (!s.isPublic) return;
    if (b.state === "lobby") {
      const fo = this.friendsOnly();
      if (this.humanCount() >= 2 && !fo) {
        if (!b.startAt) { b.startAt = t + T.START_COUNTDOWN; this.dirty = true; }
        else if (t >= b.startAt) this.startRound();
      } else {
        if (b.startAt) { b.startAt = null; this.dirty = true; }
        if (this.humanCount() >= 1 && (t - (b.createdAt || t) > T.BOT_WAIT_MS || (this.botVotes().passed && !fo))) {
          if (!this.botVotes().passed && !fo) this.log("Not enough players online, so 4 bots are joining (2 hard, 1 medium, 1 easy)");
          this.startRound();
        }
      }
      return;
    }
    if (b.state === "over" && b.ruleChosen && this.humanCount() >= 1) {
      if (this.nextSeq !== b.seq) { this.nextSeq = b.seq; this.nextAt = t + T.NEXT_ROUND_MS; }   // counts from when the rule was picked
      else if (t >= this.nextAt) { this.nextSeq = -1; this.startRound(); }
    }
  }
  // anti-teaming: remember who each real player played a matchmade round with
  recordMatches() {
    const b = this.B;
    if (!this.s.isPublic || !b || b.state !== "held" || !this.hooks.recordMatch) return;
    this.humans().forEach(id => {
      if (this.recorded[id] || !this.isAlive(id)) return;
      this.recorded[id] = true;
      this.hooks.recordMatch(id, this.humans().filter(x => x !== id));
    });
  }

  // ------------------------------------------------------------ bots
  botsTick(t) { Object.keys(this.P).forEach(id => { if (this.P[id] && this.P[id].bot) { try { this.botTick(id, t); } catch (e) { console.error("bot", e); } } }); }
  botUse(a, st, t, id, target) {
    if (!this.abilitiesOf(a).includes(id) || t < (st.cool || 0) || this.canUse(id, a)) return false;
    st.cool = t + 600;
    return !this.useAbility(id, a, target);
  }
  botPickAim(a, mode, current) {
    const opts = this.allowedTargets(a);
    if (!opts.length) return null;
    if (opts.length === 1) return opts[0];
    if (this.hasRule("spinning")) return this.spinTarget(opts);
    if (mode === "other") { const o = opts.filter(id => id !== current); return o.length ? this.pick(o) : current; }
    return this.pick(opts);
  }
  makePlan(L) {
    const steps = [], T = this.T, potato = this.hasRule("hotPotato"), noJuke = this.hasRule("noJuke");
    let tt = this.rr(L.think);
    if (potato) tt = Math.min(tt, 450);
    const fakes = noJuke ? 0 : Math.round(this.rr([L.fakes[0], L.fakes[1] + 0.49]));
    for (let i = 0; i < fakes; i++) {
      const len = T.CHARGE_TIME * this.rnd(0.45, 0.9);
      if (potato && tt + 100 + len + 300 + 100 + T.CHARGE_TIME > T.HOT_POTATO_MS - 250) break;
      steps.push({ at: tt, act: "aim" }, { at: tt + 100, act: "charge" }, { at: tt + 100 + len, act: "release" });
      tt += 100 + len + this.rnd(150, 350);
    }
    steps.push({ at: tt, act: "aim" }, { at: tt + 100, act: "charge" });
    if (!noJuke && this.chance(L.switchProb)) steps.push({ at: tt + 100 + T.CHARGE_TIME * this.rnd(0.82, 0.95), act: "switch" });
    return steps;
  }
  botTick(a, t) {
    const p = this.P[a], L = BOT_LEVELS[p.bot] || BOT_LEVELS.medium, T = this.T, s = this.s;
    const st = this.bot[a] || (this.bot[a] = {});
    const b = this.B;
    if (p.out) {
      if (!this.canUse("redo", a)) { if (!st.redoAt) st.redoAt = t + this.rnd(500, 1500); if (t >= st.redoAt) { st.redoAt = 0; this.botUse(a, st, t, "redo"); } }
      p.chargeStart = 0; return;
    }
    if (this.paused()) { p.chargeStart = 0; return; }
    if (this.holds(a)) {
      if (st.holdSeq !== b.seq) {
        st.holdSeq = b.seq; st.planStart = t; st.aim = null; p.chargeStart = 0;
        st.plan = this.makePlan(L);
        st.wantDecoy = this.chance(0.5 * L.rate);
        st.wantNuke = this.chance(0.3 * L.rate) && this.aliveIds().length >= 3;
        st.wantSwap = this.chance(0.12 * L.rate);
      }
      const deadForcer = Object.keys(s.doubles[a] || {}).some(by => this.P[by] && this.P[by].out);
      if (this.forcedSet(a).length >= 2 || deadForcer) { if (this.botUse(a, st, t, "ward") || this.botUse(a, st, t, "absoluteCounter")) return; }
      const el = t - st.planStart;
      if (st.wantSwap && el > 200 && !p.chargeStart) { st.wantSwap = false; this.botUse(a, st, t, "swap"); }
      if (st.wantDecoy && el > 150) { st.wantDecoy = false; this.botUse(a, st, t, "decoy"); }
      if (st.wantNuke && st.plan.length && el >= st.plan[0].at) { st.wantNuke = false; if (this.botUse(a, st, t, "nuke")) return; }
      const opts = this.allowedTargets(a);
      if (opts.length && (!opts.includes(st.aim) || opts.length === 1 || this.hasRule("spinning"))) st.aim = this.botPickAim(a, "any", st.aim);
      while (st.plan.length && el >= st.plan[0].at) {
        const step = st.plan.shift();
        if (step.act === "aim") st.aim = this.botPickAim(a, "any", st.aim);
        else if (step.act === "switch") st.aim = this.botPickAim(a, "other", st.aim);
        else if (step.act === "charge") { if (this.hasRule("noJuke")) { this.throwBall(a, st.aim); return; } p.chargeStart = t; }
        else if (step.act === "release") { if (!b.warcry) p.chargeStart = 0; }
      }
      const shown = this.shownAim(a, st.aim);
      if (p.aim !== shown) p.aim = shown;
      if (b.warcry && !b.nullified && !p.chargeStart) p.chargeStart = t;
      // safety net: a bot holding the ball with nothing left to do starts a new throw (never stands still)
      if (!st.plan.length && !p.chargeStart) {
        if (!st.idleSince) st.idleSince = t;
        else if (t - st.idleSince > 1200) {
          st.idleSince = 0; st.aim = this.botPickAim(a, "any", st.aim);
          if (this.hasRule("noJuke")) { this.throwBall(a, st.aim); return; }
          p.chargeStart = t;
        }
      } else st.idleSince = 0;
      if (p.chargeStart && this.chargeOf(a) >= 1) this.throwBall(a, st.aim);
      return;
    }
    p.chargeStart = 0;
    if (b.state === "flying" && b.from === a) {
      if (st.fireSeq !== b.seq) { st.fireSeq = b.seq; st.fireAt = this.chance(0.6 * L.rate) ? b.t0 + b.dur * this.rnd(0.08, 0.25) : 0; }
      if (st.fireAt && t >= st.fireAt) { st.fireAt = 0; this.botUse(a, st, t, "fireball"); }
    }
    if (b.state === "flying" && b.to === a) {
      const key = b.seq + ":" + b.t0;
      if (st.recvKey !== key) {
        st.recvKey = key; st.fireDecided = false;
        const r = this.rr(L.react);
        st.claps = this.chance(L.forgetClap) ? [] : (this.hasRule("doubleClap") ? [b.t0 + r, b.t0 + r + this.rnd(80, 150)] : [b.t0 + r]);
        st.catchAt = this.chance(L.miss) ? 0 : Math.max(b.t0 + b.dur * this.rr(L.catchAt), (st.claps[st.claps.length - 1] || 0) + 40);
      }
      if ((b.fireball || b.hellfire) && !b.nullified && !st.fireDecided && (b.fireball || this.progress(b) > 0.75)) { st.fireDecided = true; if (!this.chance(L.fireCatch)) st.catchAt = 0; }
      while (st.claps.length && t >= st.claps[0]) { st.claps.shift(); this.clap(a, 0); }
      if (st.catchAt && t >= st.catchAt) { st.catchAt = 0; this.tryCatch(a, 0); }
      return;
    }
    if (b.state === "nuke") {
      if (st.nukeKey !== b.seq) {
        st.nukeKey = b.seq;
        const r = this.rr(L.react) * 1.5;
        st.nClaps = this.chance(L.nukeFail) ? [] : (this.hasRule("doubleClap") ? [b.t0 + r, b.t0 + r + this.rnd(80, 150)] : [b.t0 + r]);
      }
      while (st.nClaps.length && t >= st.nClaps[0]) { st.nClaps.shift(); this.clap(a, 0); }
      return;
    }
    if (b.state === "held" && b.holder !== a) {
      const h = b.holder, hp = this.P[h] || {};
      const c = hp.chargeStart ? (t - hp.chargeStart) / T.CHARGE_TIME : 0;
      if (hp.aim === a && hp.chargeStart) {
        const key = h + ":" + hp.chargeStart;
        if (st.watchKey !== key) { st.watchKey = key; st.jukeAt = this.rnd(0.72, 0.96); st.jukeDone = false; st.antiDone = false; }
        if (!st.antiDone && c > 0.3) { st.antiDone = true; if (this.chance(0.45 * L.rate)) this.botUse(a, st, t, "antiForce"); else if (this.chance(0.5 * L.rate)) this.botUse(a, st, t, "brace"); }
        if (!st.jukeDone && c > st.jukeAt) { st.jukeDone = true; if (this.chance(L.juke)) this.clap(a, 0); }
      }
      if ((s.doubles[h] || {})[a] && !b.nullified && st.sacSeq !== b.seq) {
        st.sacSeq = b.seq;
        const saved = ["ward", "absoluteCounter"].some(id => ((hp.uses || {})[id] || 0) > 0);
        if (!saved && this.aliveIds().length >= 3 && this.chance(L.sacrifice)) st.sacAt = t + this.rnd(300, 900);
      }
      if (st.sacAt && t >= st.sacAt) { st.sacAt = 0; this.ggg(a); return; }
      if (st.oppSeq !== b.seq) { st.oppSeq = b.seq; st.oppAt = t + this.rnd(300, 1300); }
      if (st.oppAt && t >= st.oppAt) {
        st.oppAt = 0;
        const already = Object.keys(s.doubles[h] || {}).filter(by => by !== a).length;
        if (already && this.chance(0.9 * L.rate) && this.botUse(a, st, t, "doubleForce")) return;
        if (this.chance(0.25 * L.rate) && this.botUse(a, st, t, "doubleForce")) return;
        if (this.chance(0.3 * L.rate) && this.botUse(a, st, t, "speedUp")) return;
        if (this.chance(0.2 * L.rate)) {
          const tg = this.aliveIds().filter(id => id !== a && id !== h);
          if (tg.length && this.botUse(a, st, t, "counterForce", this.pick(tg))) return;
        }
      }
    }
  }
  botRuleChoice(t) {
    const b = this.B;
    if (!(b && b.state === "over" && !b.ruleChosen && this.P[b.winner] && this.P[b.winner].bot)) { this.botPickAt = 0; return; }
    if (!this.botPickAt) { this.botPickAt = t + 1500; return; }
    if (t < this.botPickAt) return;
    this.botPickAt = 0;
    const ok = id => this.s.mode !== "competitive" || RULES[id].type === "passive";
    const full = this.activeAbilities().length >= this.T.MAX_ABILITIES;
    const add = Object.keys(RULES).filter(id => ok(id) && !RULES[id].limited && !this.hasRule(id) && !(full && RULES[id].type === "ability"));
    const rem = Object.keys(this.s.rules).filter(id => RULES[id] && ok(id));
    const r = this.rand();
    if (add.length && r < 0.7) this.chooseRule(b.winner, "add", this.pick(add));
    else if (rem.length && r < 0.9) this.chooseRule(b.winner, "remove", this.pick(rem));
    else this.chooseRule(b.winner, "skip");
  }

  // ------------------------------------------------------------ what players are sent
  snapshot() {
    const b = this.B;
    return { key: this.key, mode: this.s.mode, isPublic: this.s.isPublic, isRisk: this.s.isRisk,
      players: this.P, ball: b, rules: this.s.rules, doubles: this.s.doubles, log: this.s.log,
      fx: this.s.fx, turn: this.turn, event: this.event,
      allowed: b && b.state === "held" && this.isAlive(b.holder) ? this.allowedTargets(b.holder) : null,
      catchFrom: Object.fromEntries(this.humans().map(id => [id, this.catchFrom(id)])),
      host: this.hostId() || null, votes: this.botVotes(), now: this.now(), friendsOnly: this.friendsOnly(),
      // for each real player: their ability keys and whether each one can be used right now ("" = ready)
      abil: Object.fromEntries(this.humans().map(id => [id, this.abilitiesOf(id).map(x => [x, this.canUse(x, id)])])),
      tune: { CHARGE_TIME: this.T.CHARGE_TIME, FLIGHT_TIME: this.T.FLIGHT_TIME, CATCH_FROM: this.T.CATCH_FROM, DF_GRACE_MS: this.T.DF_GRACE_MS,
        HOT_POTATO_MS: this.T.HOT_POTATO_MS, BOT_WAIT_MS: this.T.BOT_WAIT_MS, DUEL_SPEEDUP: this.T.DUEL_SPEEDUP, MIN_FLIGHT: this.T.MIN_FLIGHT, LAG_ALLOW: this.T.LAG_ALLOW } };
  }
}
