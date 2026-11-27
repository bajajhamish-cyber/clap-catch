// ======================================================================
//  hub.js: one quiet connection to the server while you're in the menus.
//  The server pokes it when something changes for you (a friend request,
//  a message, a trade, an announcement, an admin switch). Then, and only
//  then, the page asks for the new data. While HUB_OK is true the old
//  "ask every few seconds" timers slow right down (see app.js and
//  announce.js), which saves most of the daily request budget.
// ======================================================================
let hubWs = null, hubTries = 0, hubMeTimer = null, hubPing = null, hubMePending = false;
function hubUrl(t) { return SERVER.replace(/^http/, "ws") + "/hub?token=" + encodeURIComponent(t); }
async function hubConnect() {
  if (hubWs || !PROFILE) return;
  let t; try { t = await token(); } catch (e) { return; }
  let ws; try { ws = new WebSocket(hubUrl(t)); } catch (e) { return hubRetry(); }
  hubWs = ws;
  ws.onopen = () => { HUB_OK = true; hubTries = 0; clearInterval(hubPing); hubPing = setInterval(() => { try { ws.send("ping"); } catch (e) {} }, 50000); };
  ws.onmessage = e => {
    if (e.data === "pong") return;
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (m.t === "ann") { pollAnn(true); hubMe(); }
    else if (m.t === "me") hubMe();
  };
  ws.onclose = ws.onerror = () => { if (hubWs !== ws) return; hubWs = null; HUB_OK = false; clearInterval(hubPing); hubRetry(); };
}
function hubRetry() {
  hubTries = Math.min(hubTries + 1, 6);
  setTimeout(hubConnect, 2000 * Math.pow(2, hubTries) + Math.random() * 1000);   // 4s, 8s, ... up to about 2 min
}
// something changed for you: refresh once (a burst of pokes becomes one request)
function hubMe() {
  if (inGame || document.hidden) { hubMePending = true; return; }
  clearTimeout(hubMeTimer);
  hubMeTimer = setTimeout(async () => {
    hubMePending = false; HUB_LAST_ME = Date.now();
    try { setProfile(await api("me")); } catch (e) { return; }
    if (currentTab === "friends") refreshFriends();
    refreshTrades();   // also keeps the trade badge right
    if (typeof dmWith !== "undefined" && dmWith) loadDm();
  }, 400 + Math.random() * 600);
}
// catch up on anything that happened while you were in a game or on another tab
setInterval(() => { if (hubMePending && !inGame && !document.hidden) hubMe(); }, 2000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && hubMePending) hubMe(); });
setInterval(() => { if (PROFILE && !hubWs) hubConnect(); }, 5000);
