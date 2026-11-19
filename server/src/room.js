// ======================================================================
//  room.js: one game room. Holds the players' connections and runs the
//  Engine 30 times a second. Players can only send button presses.
// ======================================================================
import { DurableObject } from "cloudflare:workers";
import { Engine, roomType } from "./engine.js";

const TICK_MS = 33, SEND_MS = 50, IDLE_SEND_MS = 500, PING_MS = 3000, REPORT_MS = 10000;
const MAX_MSG = 2000, MAX_MSGS_PER_SEC = 40, EVENT_CHECK_MS = 20000;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.engine = null; this.key = null; this.socks = new Map(); this.timer = null;
    this.lastSend = 0; this.lastPing = 0; this.lastReport = 0; this.lastHumans = -1;
  }
  bank(op, uid, args) {
    return this.env.BANK.get(this.env.BANK.idFromName("bank")).fetch("https://bank/", { method: "POST", body: JSON.stringify({ op, uid, args }) })
      .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error); return j.data; });
  }
  lobby(op, args) {
    return this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).fetch("https://lobby/", { method: "POST", body: JSON.stringify({ op, args }) }).catch(() => {});
  }
  ensureEngine(key, stake) {
    if (this.engine) return;
    this.key = key;
    this.engine = new Engine({ key, stake, fast: this.env.TEST_MODE === "1" && this.env.TEST_FAST === "1", hooks: {
      addPoints: (uid, n) => this.bank("addPoints", uid, { n }).then(d => d && this.sendTo(uid, { t: "points", points: d.points })).catch(e => console.error("addPoints", e)),
      payStake: (uid, n) => this.bank("payStake", uid, { n }).then(d => { if (d.paid) this.sendTo(uid, { t: "points", points: d.points }); return !!d.paid; }),
      recordMatch: (uid, others) => this.bank("recordMatch", uid, { others }).catch(() => {}),
      // abilities that cost real points: the bank does the money part, the answer comes back to the game
      spend: (uid, n) => this.money(this.bank("spend", uid, { n }), uid),
      transfer: (uid, to, n) => this.money(this.bank("transfer", uid, { to: this.isHuman(to) ? to : null, n }), uid, to),
      devilsDeal: (uid, to) => this.money(this.bank("devilsDeal", uid, { to }), uid, to),
      grant: (uid, id) => this.bank("grant", uid, { id }).catch(e => console.error("grant", e)),
    } });
    this.lastEventCheck = 0;
  }
  isHuman(id) { return !!(this.engine && this.engine.P[id] && !this.engine.P[id].bot); }
  money(p, uid, to) {
    return p.then(d => {
      if (d && d.points != null) this.sendTo(uid, { t: "points", points: d.points });
      if (to && d && d.toPoints != null) this.sendTo(to, { t: "points", points: d.toPoints });
      return Object.assign({ ok: true }, d);
    }).catch(e => ({ ok: false, error: e.message }));
  }
  checkEvent() {           // which limited-time event is on (the admin turns them on and off)
    this.lastEventCheck = Date.now();
    this.bank("event").then(id => { if (this.engine && this.engine.event !== id) { this.engine.event = id; this.engine.dirty = true; } }).catch(() => {});
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/init") {            // the Lobby made this room (matchmade / High Risk)
      const { key, stake } = await req.json();
      await this.ctx.storage.put("init", { key, stake: stake || 0 });
      return Response.json({ ok: true });
    }
    if (url.pathname === "/kick") {            // banned: out you go
      const { uid } = await req.json();
      this.kick(uid, "You've been banned");
      return Response.json({ ok: true });
    }
    // ---------------------------------------------------------- a player connecting
    const uid = req.headers.get("X-Uid"), key = req.headers.get("X-Key");
    if (req.headers.get("Upgrade") !== "websocket" || !uid || !key) return new Response("expected websocket", { status: 400 });
    const pair = new WebSocketPair(), client = pair[0], ws = pair[1];
    ws.accept();
    ws.uid = uid; ws.ready = false; ws.msgs = 0; ws.msgWindow = Date.now();
    ws.addEventListener("message", ev => this.onMessage(ws, ev.data));
    ws.addEventListener("close", () => this.onClose(ws));
    ws.addEventListener("error", () => this.onClose(ws));
    this.join(ws, uid, key);
    return new Response(null, { status: 101, webSocket: client });
  }

  async join(ws, uid, key) {
    try {
      const rt = roomType(key);
      let stake = 0;
      if (rt.isPublic || rt.isRisk) {
        const init = await this.ctx.storage.get("init");
        if (!init || init.key !== key) throw new Error("That game doesn't exist anymore");
        stake = init.stake;
      }
      let via = null;
      if (rt.isPublic) {                       // matchmade rooms: only people the Lobby sent here
        const a = await this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).fetch("https://lobby/", { method: "POST", body: JSON.stringify({ op: "admit", uid, args: { key } }) }).then(r => r.json());
        if (!a.ok) throw new Error(a.error);
        via = a.data.via;
      }
      const prof = await this.bank("roomProfile", uid);
      this.ensureEngine(key, stake);
      const old = this.socks.get(uid);
      if (old && old !== ws) { try { old.send(JSON.stringify({ t: "kicked", m: "You opened the game somewhere else" })); old.close(4000, "replaced"); } catch (e) {} old.replaced = true; }
      const r = this.engine.addPlayer(uid, { name: prof.username, uid, loadout: prof.loadout, skin: prof.skin, viaFriend: via || undefined });
      if (!r.ok) throw new Error(r.error);
      this.socks.set(uid, ws);
      ws.ready = true;
      ws.send(JSON.stringify({ t: "hello", you: uid, state: this.engine.snapshot() }));
      this.startLoop();
      this.report(true);
    } catch (e) {
      try { ws.send(JSON.stringify({ t: "error", m: e.message })); ws.close(4001, "refused"); } catch (x) {}
    }
  }

  onMessage(ws, data) {
    if (!ws.ready || !this.engine || ws.replaced) return;
    const t = Date.now();
    if (t - ws.msgWindow > 1000) { ws.msgWindow = t; ws.msgs = 0; }
    if (++ws.msgs > MAX_MSGS_PER_SEC) return;          // spamming: ignored
    if (typeof data !== "string" || data.length > MAX_MSG) return;
    let msg; try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "pong") {                              // how laggy is this player?
      const rtt = t - (+msg.s || t);
      if (rtt >= 0 && rtt < 5000) this.engine.lat[ws.uid] = this.engine.lat[ws.uid] == null ? rtt / 2 : this.engine.lat[ws.uid] * 0.7 + (rtt / 2) * 0.3;
      return;
    }
    const err = this.engine.input(ws.uid, msg);
    if (err) ws.send(JSON.stringify({ t: "err", m: err }));
  }

  onClose(ws) {
    if (ws.closedDone) return;
    ws.closedDone = true;
    if (this.socks.get(ws.uid) === ws) {
      this.socks.delete(ws.uid);
      if (this.engine) this.engine.removePlayer(ws.uid);
      this.report(true);
    }
    if (this.engine && !this.engine.humanCount()) this.shutdown();
  }
  kick(uid, why) {
    const ws = this.socks.get(uid);
    if (ws) { try { ws.send(JSON.stringify({ t: "kicked", m: why })); ws.close(4002, "kicked"); } catch (e) {} this.onClose(ws); }
    else if (this.engine) this.engine.removePlayer(uid);
  }
  sendTo(uid, obj) { const ws = this.socks.get(uid); if (ws) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } }

  startLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => this.loop(), TICK_MS);
  }
  shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.report(true, true);
    this.engine = null;
  }
  loop() {
    const e = this.engine; if (!e) return;
    const t = Date.now();
    if (t - this.lastEventCheck > EVENT_CHECK_MS) this.checkEvent();
    try { e.tick(); } catch (err) { console.error("tick", err); }
    if (e.kicked && e.kicked.length) { e.kicked.splice(0).forEach(uid => this.kick(uid, "You couldn't pay the stake")); }
    if (t - this.lastPing > PING_MS) { this.lastPing = t; this.broadcast({ t: "ping", s: t }); }
    if ((e.dirty && t - this.lastSend >= SEND_MS) || t - this.lastSend > IDLE_SEND_MS) {
      e.dirty = false; this.lastSend = t;
      this.broadcast({ t: "state", state: e.snapshot() });
    }
    const st = e.B && e.B.state === "lobby" ? "lobby" : "playing";   // the lobby only needs to know this, not every throw
    if (t - this.lastReport > REPORT_MS || e.humanCount() !== this.lastHumans || st !== this.lastState) { this.lastState = st; this.report(true); }
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.socks.values()) { try { ws.send(s); } catch (e) {} }
  }
  report(force, closed) {
    const e = this.engine; if (!e) return;
    const t = Date.now();
    if (!force && t - this.lastReport < 500) return;
    this.lastReport = t; this.lastHumans = e.humanCount();
    const rt = roomType(this.key), b = e.B;
    this.lobby("update", {
      key: this.key, type: rt.isPublic ? "pub" : rt.isRisk ? "risk" : "private", humans: e.humanCount(),
      uids: e.humans(), state: b ? b.state : "waiting", stake: b && b.stake, host: e.hostId() ? e.nm(e.hostId()) : null, closed: !!closed,
    });
  }
}
