// ======================================================================
//  net.js: logging in (Firebase), and talking to the game server
// ======================================================================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const SERVER = (window.CC_SERVER || SERVER_URL).replace(/\/$/, "");

async function token() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");
  return window.CC_TEST_TOKEN ? window.CC_TEST_TOKEN(u) : u.getIdToken();
}
// ask the server to do something; throws with a friendly message if it says no
async function api(op, args) {
  let r;
  try {
    r = await fetch(SERVER + "/api/" + op, { method: "POST", headers: { authorization: "Bearer " + await token(), "content-type": "application/json" }, body: JSON.stringify(args || {}) });
  } catch (e) {
    if (SERVER.includes("YOURNAME")) throw new Error("The game server address isn't set yet (js/config.js, see README)");
    if (await checkLimit()) throw new Error("The game is resting until its daily limit resets");
    throw new Error("Can't reach the game server. Check your internet.");
  }
  let j; try { j = await r.json(); } catch (e) {
    if (await checkLimit()) throw new Error("The game is resting until its daily limit resets");
    throw new Error("The game server sent a bad reply");
  }
  if (j.limit) { showLimit(j.limit); throw new Error("The game is resting until its daily limit resets"); }
  if (!j.ok) throw new Error(j.error || "Something went wrong");
  return j.data;
}

// ---------------------------------------------------------------- free daily limits
// The game runs on free plans (Cloudflare + Firebase). If everyone plays a LOT in one day,
// the free amount runs out and the server stops answering until it resets. This explains
// that to players instead of showing a confusing error.
let limitShown = false;
async function checkLimit() {           // called when something fails: is it the daily limit?
  try {
    const r = await fetch(SERVER + "/health?deep=1", { cache: "no-store" });
    const j = await r.json();
    if (j.limit) { showLimit(j.limit); return true; }
    return false;
  } catch (e) {
    // The normal check failed. If the server still answers at all, Cloudflare is blocking it = daily limit.
    try { await fetch(SERVER + "/health", { mode: "no-cors", cache: "no-store" }); showLimit("cloudflare"); return true; }
    catch (x) { return false; }      // can't reach anything: the player's internet is down
  }
}
function nextReset(kind) {
  const now = Date.now();
  if (kind === "firebase") {           // Firebase resets at midnight in California
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(now)).map(x => [x.type, +x.value]));
    const secs = ((p.hour % 24) * 3600) + p.minute * 60 + p.second;
    return new Date(now + (86400 - secs) * 1000);
  }
  const d = new Date(now);               // Cloudflare resets at midnight UTC (11am in Sydney in summer)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}
function showLimit(kind) {
  const box = document.getElementById("limitScreen");
  if (!box) return;
  const at = nextReset(kind);
  const sameDay = at.toDateString() === new Date().toDateString();
  document.getElementById("limitTime").textContent = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (sameDay ? " today" : " tomorrow");
  box.hidden = false;
  if (!limitShown) { limitShown = true; clearInterval(showLimit._t); showLimit._t = setInterval(() => { if (Date.now() >= at.getTime()) location.reload(); }, 30000); }
}
