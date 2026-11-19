// ======================================================================
//  lobby.js: one Lobby for the whole game. Knows every matchmade and
//  High Risk room, picks rooms for "Find a match", lists High Risk games.
//  It does one thing at a time, so two people pressing Play at once
//  always get sensible answers (no overfull rooms).
// ======================================================================
import { DurableObject } from "cloudflare:workers";
import { ECON } from "./shared.js";

const newKey = prefix => prefix + Math.random().toString(36).slice(2, 10).toUpperCase().replace(/[^A-Z0-9]/g, "0");
const STALE = 30_000;

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rooms = {};   // key -> { type: "pub"|"risk", humans, uids, state, stake, host, reserved: [{uid, until}], updatedAt, createdAt }
  }
  room(key) { return this.env.ROOM.get(this.env.ROOM.idFromName(key)); }
  live(r) { return Date.now() - r.updatedAt < STALE; }
  seats(r) { const t = Date.now(); r.reserved = (r.reserved || []).filter(x => x.until > t); return (r.humans || 0) + r.reserved.length; }
  has(r, uid) { return (r.uids || []).includes(uid) || (r.reserved || []).some(x => x.uid === uid); }

  async fetch(req) {
    const { op, uid, args } = await req.json();
    const t = Date.now();
    for (const k in this.rooms) if (t - this.rooms[k].updatedAt > 60_000) delete this.rooms[k];   // gone
    try {
      switch (op) {
        case "match": {
          const avoid = args.avoid || [];
          const allIn = r => avoid.length > 0 && avoid.every(u => (r.uids || []).includes(u));
          const cands = Object.entries(this.rooms)
            .filter(([k, r]) => r.type === "pub" && this.live(r) && r.state !== "closed" && this.seats(r) < ECON.MAX_PLAYERS && !allIn(r))
            .sort((a, b) => (this.seats(b[1]) - this.seats(a[1])) || (a[1].createdAt - b[1].createdAt));
          const already = cands.find(([k, r]) => this.has(r, uid));
          let key = already ? already[0] : cands.length ? cands[0][0] : null;
          if (!key) {
            key = newKey("PUB");
            this.rooms[key] = { type: "pub", humans: 0, uids: [], state: "lobby", reserved: [], updatedAt: t, createdAt: t };
            await this.room(key).fetch("https://room/init", { method: "POST", body: JSON.stringify({ key }) });
          }
          if (!this.has(this.rooms[key], uid)) this.rooms[key].reserved.push({ uid, until: t + 15_000, via: null });
          return Response.json({ ok: true, data: { key } });
        }
        case "where": {        // which game each of these players is in (for friends lists)
          const out = {};
          for (const [k, r] of Object.entries(this.rooms)) {
            if (!this.live(r) || r.state === "closed") continue;
            (r.uids || []).forEach(u => { if ((args.uids || []).includes(u)) out[u] = { key: k, type: r.type, humans: r.humans || 0, state: r.state, stake: r.stake || 0 }; });
          }
          return Response.json({ ok: true, data: out });
        }
        case "joinFriend": {   // follow a friend into their game
          const e = Object.entries(this.rooms).find(([k, r]) => this.live(r) && r.state !== "closed" && (r.uids || []).includes(args.friend));
          if (!e) throw new Error("They're not in a game right now");
          const [key, r] = e;
          if (r.type === "risk") {
            if (r.state !== "lobby") throw new Error("Their High Risk game has already started");
            if (!this.has(r, uid) && this.seats(r) >= ECON.MAX_PLAYERS) throw new Error("Their game is full");
            if (!this.has(r, uid)) r.reserved.push({ uid, until: t + 15_000, via: null });
          } else if (r.type === "pub") {
            if (!this.has(r, uid) && this.seats(r) >= ECON.MAX_PLAYERS) throw new Error("Their game is full");
            r.reserved = (r.reserved || []).filter(x => x.uid !== uid);
            r.reserved.push({ uid, until: t + 15_000, via: args.friend });
          } else if ((r.humans || 0) >= ECON.MAX_PLAYERS) throw new Error("Their game is full");
          return Response.json({ ok: true, data: { key, type: r.type } });
        }
        case "admit": {        // a matchmade room asking: may this player come in?
          const r = this.rooms[args.key];
          if (!r) return Response.json({ ok: true, data: { via: null } });          // we don't know the room (just restarted): let them in
          const res = (r.reserved || []).find(x => x.uid === uid && x.until > t);
          if (res) return Response.json({ ok: true, data: { via: res.via || null } });
          if ((r.uids || []).includes(uid)) return Response.json({ ok: true, data: { via: null } });
          throw new Error("Use Find a match (or Join on a friend) to get into matchmade games");
        }
        case "riskCreate": {
          const key = newKey("RISK");
          this.rooms[key] = { type: "risk", humans: 0, uids: [], state: "lobby", stake: args.stake, host: args.host, reserved: [{ uid, until: t + 15_000 }], updatedAt: t, createdAt: t };
          await this.room(key).fetch("https://room/init", { method: "POST", body: JSON.stringify({ key, stake: args.stake }) });
          return Response.json({ ok: true, data: { key } });
        }
        case "riskList": {
          const list = Object.entries(this.rooms).filter(([k, r]) => r.type === "risk" && r.state === "lobby" && this.live(r))
            .map(([k, r]) => ({ key: k, host: r.host, stake: r.stake, humans: this.seats(r), createdAt: r.createdAt }));
          return Response.json({ ok: true, data: list });
        }
        case "riskJoin": {     // reserve a seat so two people can't take the last one together
          const r = this.rooms[args.key];
          if (!r || r.type !== "risk" || r.state !== "lobby") throw new Error("That High Risk game has already started or closed");
          if (!this.has(r, uid) && this.seats(r) >= ECON.MAX_PLAYERS) throw new Error("That game is full");
          if (!this.has(r, uid)) r.reserved.push({ uid, until: t + 15_000 });
          return Response.json({ ok: true, data: { key: args.key } });
        }
        case "ping": return Response.json({ ok: true });
        case "update": {       // a room telling us how it's doing
          const r = this.rooms[args.key] || (this.rooms[args.key] = { type: args.type, createdAt: t, reserved: [] });
          Object.assign(r, { type: args.type, humans: args.humans, uids: args.uids, state: args.state, stake: args.stake, host: args.host || r.host, updatedAt: t });
          r.reserved = (r.reserved || []).filter(x => !(args.uids || []).includes(x.uid));
          if (args.closed) delete this.rooms[args.key];
          return Response.json({ ok: true });
        }
        case "kick": {         // admin banned someone: throw them out of any room
          await Promise.all(Object.entries(this.rooms).filter(([k, r]) => (r.uids || []).includes(args.uid))
            .map(([k]) => this.room(k).fetch("https://room/kick", { method: "POST", body: JSON.stringify({ uid: args.uid }) }).catch(() => {})));
          return Response.json({ ok: true });
        }
      }
      return Response.json({ ok: false, error: "Unknown request" }, { status: 400 });
    } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 400 }); }
  }
}
