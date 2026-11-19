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
    throw new Error("Can't reach the game server. Check your internet.");
  }
  let j; try { j = await r.json(); } catch (e) { throw new Error("The game server sent a bad reply"); }
  if (!j.ok) throw new Error(j.error || "Something went wrong");
  return j.data;
}
