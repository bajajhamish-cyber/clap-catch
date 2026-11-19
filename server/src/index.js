// ======================================================================
//  index.js: the front door. Checks who you are, then passes your
//  request to the Bank (accounts), the Lobby (matchmaking) or a Room (game).
// ======================================================================
import { verifyIdToken } from "./google.js";
import { ECON } from "./shared.js";
export { Bank } from "./bank.js";
export { Lobby } from "./lobby.js";
export { Room } from "./room.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
// Cloudflare's own "you've used today's free amount" errors
const CF_LIMIT = /exceeded|free tier|daily request limit|quota|too many requests|error 1027/i;
const LIMIT_MSG = "The game has reached its free daily limit";
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json" }, CORS) });
// what players are allowed to ask the Bank to do (everything else is server-only)
const BANK_OPS = new Set(["init", "me", "tutorialDone", "loadout", "skin", "buy", "findUser", "trades", "tradeSend", "tradeAnswer", "tradeCancel",
  "friendRequest", "friendAnswer", "friendCancel", "friendRemove", "boardGet", "boardBuy", "noticesSeen",
  "adminLucky", "adminBan", "adminLists", "adminConfig"]);

function limitCheck(res) {
  if (res && !res.ok && !res.limit && CF_LIMIT.test(res.error || "")) { res.limit = "cloudflare"; res.error = LIMIT_MSG; }
  if (res && res.limit) { const e = new Error(LIMIT_MSG); e.limit = res.limit; throw e; }
  return res;
}
async function bank(env, op, uid, email, args) {
  const r = await env.BANK.get(env.BANK.idFromName("bank")).fetch("https://bank/", { method: "POST", body: JSON.stringify({ op, uid, email, args }) });
  return limitCheck(await r.json());
}
async function lobby(env, op, uid, args) {
  const r = await env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch("https://lobby/", { method: "POST", body: JSON.stringify({ op, uid, args }) });
  return limitCheck(await r.json());
}
// tells you (on the server's front page) whether the Firebase key was pasted in properly. Never shows the key itself.
function keyStatus(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    const names = Object.keys(env).filter(k => !["BANK", "LOBBY", "ROOM"].includes(k));
    return "MISSING: no secret called FIREBASE_SERVICE_ACCOUNT" + (names.length ? " (found these names instead: " + names.join(", ") + ")" : "") + ". See README step 4";
  }
  let j; try { j = JSON.parse(String(raw).trim()); } catch (e) {
    return "BROKEN: the secret is there but isn't the whole .json file (" + String(raw).length + " characters, starts with '" + String(raw).trim().slice(0, 1) + "'). Paste everything from { to }";
  }
  if (!j || !j.private_key || !j.client_email) return "BROKEN: that .json isn't a Firebase service account key (no private_key). Use the file from Project settings > Service accounts > Generate new private key";
  return "loaded (" + j.project_id + ")";
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      // ---------------------------------------------------------- game rooms (WebSocket)
      if (url.pathname.startsWith("/ws/")) {
        const key = url.pathname.slice(4);
        if (!/^[A-Z0-9]{1,24}$/.test(key)) return json({ ok: false, error: "bad room" }, 400);
        const who = await verifyIdToken(env, url.searchParams.get("token"));
        const headers = new Headers(req.headers);
        headers.set("X-Uid", who.uid); headers.set("X-Key", key);
        return env.ROOM.get(env.ROOM.idFromName(key)).fetch(new Request(req.url, { headers }));
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        const out = { ok: true, game: "clap-catch", firebaseKey: keyStatus(env) };
        if (url.searchParams.has("deep")) {   // the website asks this when something fails, to tell players about the daily limit
          try { await lobby(env, "ping"); } catch (e) { out.limit = e.limit || "cloudflare"; }
          if (!out.limit) { const b = await bank(env, "ping").catch(e => ({ ok: false, error: e.message, limit: e.limit })); if (b.limit) out.limit = b.limit; else if (!b.ok && CF_LIMIT.test(b.error || "")) out.limit = "cloudflare"; }
        }
        return json(out);
      }
      if (url.pathname === "/test/dropcache" && env.TEST_MODE === "1") return json(await bank(env, "dropCache"));   // tests only
      // ---------------------------------------------------------- everything else needs a login
      if (req.method !== "POST" || !url.pathname.startsWith("/api/")) return json({ ok: false, error: "not found" }, 404);
      const op = url.pathname.slice(5);
      const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      const who = await verifyIdToken(env, token);
      const args = await req.json().catch(() => ({}));
      if (BANK_OPS.has(op)) {
        const res = await bank(env, op, who.uid, who.email, args);
        if (res.ok && op === "adminBan" && args.on) await lobby(env, "kick", who.uid, { uid: res.data.uid });   // throw them out of games now
        return json(res, res.ok ? 200 : 400);
      }
      if (op === "match") {
        const avoid = await bank(env, "teamAvoid", who.uid);
        if (!avoid.ok) return json(avoid, 400);
        return json(await lobby(env, "match", who.uid, { avoid: avoid.data }));
      }
      if (op === "friendsList") {
        const res = await bank(env, "friendsList", who.uid);
        if (!res.ok) return json(res, 400);
        const where = (await lobby(env, "where", who.uid, { uids: res.data.friends.map(f => f.uid) })).data || {};
        res.data.friends.forEach(f => { f.game = where[f.uid] || null; if (f.game) f.online = true; });
        return json(res);
      }
      if (op === "joinFriend") {
        const friend = String(args.uid || "");
        const [ids, me] = await Promise.all([bank(env, "friendIds", who.uid), bank(env, "me", who.uid)]);
        if (!me.ok) return json(me, 400);
        if (me.data.bannedUntil > Date.now()) return json({ ok: false, error: "You're banned" }, 400);
        if (!(ids.data || []).includes(friend)) return json({ ok: false, error: "You can only join your friends" }, 400);
        const r = await lobby(env, "joinFriend", who.uid, { friend });
        return json(r, r.ok ? 200 : 400);
      }
      if (op === "riskList") return json(await lobby(env, "riskList", who.uid, {}));
      if (op === "riskJoin") return json(await lobby(env, "riskJoin", who.uid, { key: String(args.key || "") }));
      if (op === "riskCreate") {
        const stake = Math.floor(+args.stake || 0);
        const me = await bank(env, "me", who.uid);
        if (!me.ok) return json(me, 400);
        if (me.data.bannedUntil > Date.now()) return json({ ok: false, error: "You're banned" }, 400);
        if (stake < ECON.RISK_MIN_STAKE) return json({ ok: false, error: `Stake must be at least ${ECON.RISK_MIN_STAKE}` }, 400);
        if (stake > me.data.points) return json({ ok: false, error: "You don't have that many points" }, 400);
        return json(await lobby(env, "riskCreate", who.uid, { stake, host: me.data.username }));
      }
      return json({ ok: false, error: "Unknown request" }, 404);
    } catch (e) {
      if (e.limit || CF_LIMIT.test(e.message || "")) return json({ ok: false, limit: e.limit || "cloudflare", error: LIMIT_MSG }, 503);
      return json({ ok: false, error: e.message }, 401);
    }
  },
};
