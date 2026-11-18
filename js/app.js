// ======================================================================
//  app.js: accounts, menu, shop, inventory, trading (Firestore)
// ======================================================================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const fs = firebase.firestore();
const rtdb = firebase.database();
const FV = firebase.firestore.FieldValue;

const START_POINTS = 0;
const PACK_COST = 50;
const SKIN_PACK_COST = 100;
const TRADE_COST = 5;
const EMAIL_DOMAIN = "@clapcatch.game";   // players never see this; it just lets Firebase store username logins

let UID = null, PROFILE = null, pendingSignupName = null;
let unsubs = [];
let incoming = [], outgoing = [];
let busy = false;
let tutAutoShown = false;                 // stops double clicks on buy / trade buttons
const claiming = new Set();

const el = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const userRef = uid => fs.collection("users").doc(uid);

function toast(msg, bad) {
  const t = el("toast");
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = "", 2600);
}
function showScreen(name) {
  ["authScreen", "menuScreen", "game"].forEach(id => el(id).hidden = id !== name);
}

// ---------------------------------------------------------------- login / sign up
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
function authError(e) {
  const c = e && e.code || "";
  if (c.includes("email-already-in-use")) return "That username is taken.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-login")) return "Wrong username or password.";
  if (c.includes("weak-password")) return "Password needs at least 6 characters.";
  if (c.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (c.includes("network")) return "No internet connection.";
  if (c.includes("operation-not-allowed")) return "Login isn't switched on in Firebase yet (see README step 3).";
  return (e && e.message) || "Something went wrong.";
}
async function doAuth(signup) {
  const u = el("authUser").value.trim(), p = el("authPass").value;
  el("authErr").textContent = "";
  if (!USERNAME_RE.test(u)) { el("authErr").textContent = "Username: 3-16 letters, numbers or _"; return; }
  if (p.length < 6) { el("authErr").textContent = "Password needs at least 6 characters."; return; }
  el("loginBtn").disabled = el("signupBtn").disabled = true;
  try {
    if (signup) { pendingSignupName = u; await auth.createUserWithEmailAndPassword(u.toLowerCase() + EMAIL_DOMAIN, p); }
    else await auth.signInWithEmailAndPassword(u.toLowerCase() + EMAIL_DOMAIN, p);
  } catch (e) { el("authErr").textContent = authError(e); pendingSignupName = null; }
  el("loginBtn").disabled = el("signupBtn").disabled = false;
}
el("loginBtn").onclick = () => doAuth(false);
el("signupBtn").onclick = () => doAuth(true);
el("authPass").addEventListener("keydown", e => { if (e.key === "Enter") doAuth(false); });
el("logoutBtn").onclick = async () => { await auth.signOut(); location.reload(); };

async function ensureProfile(user) {
  const ref = userRef(user.uid);
  const snap = await ref.get();
  if (snap.exists) return;
  const name = pendingSignupName || user.email.split("@")[0];
  const batch = fs.batch();
  batch.set(fs.collection("usernames").doc(name.toLowerCase()), { uid: user.uid });
  batch.set(ref, {
    username: name, points: START_POINTS, abilities: {}, skins: {}, loadout: [], equippedSkin: "default", tutorialDone: false,
    createdAt: FV.serverTimestamp()
  });
  await batch.commit();
}

auth.onAuthStateChanged(async user => {
  unsubs.forEach(f => f()); unsubs = [];
  if (!user) { UID = null; PROFILE = null; showScreen("authScreen"); return; }
  UID = user.uid;
  try { await ensureProfile(user); }
  catch (e) { console.error(e); el("authErr").textContent = "Couldn't load your account: " + e.message; showScreen("authScreen"); return; }
  unsubs.push(userRef(UID).onSnapshot(s => {
    PROFILE = s.data() || null; renderAll();
    // brand-new accounts see the tutorial once
    if (PROFILE && PROFILE.tutorialDone === false && !tutAutoShown && !inGame) { tutAutoShown = true; openTutorial(true); }
  }, e => console.error(e)));
  unsubs.push(fs.collection("trades").where("to", "==", UID).onSnapshot(s => {
    incoming = s.docs.map(d => Object.assign({ id: d.id }, d.data())); renderTrades();
  }, e => console.error(e)));
  unsubs.push(fs.collection("trades").where("from", "==", UID).onSnapshot(s => {
    outgoing = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    outgoing.forEach(t => { if (t.status === "accepted" || t.status === "declined") claimTrade(t.id); });
    renderTrades();
  }, e => console.error(e)));
  if (!inGame) showScreen("menuScreen");
});

// ---------------------------------------------------------------- tabs
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
  document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-" + b.dataset.tab);
});

function renderAll() {
  if (!PROFILE) return;
  el("whoami").textContent = "👤 " + PROFILE.username;
  el("pointsLbl").textContent = "⭐ " + PROFILE.points + " points";
  el("gamePoints").textContent = "⭐ " + PROFILE.points;
  renderPlay(); renderShop(); renderInventory(); renderTrades();
}

// ---------------------------------------------------------------- play
let chosenMode = "casual";
document.querySelectorAll(".mode").forEach(m => m.onclick = () => { chosenMode = m.dataset.mode; renderPlay(); });
el("roomCode").value = localStorage.getItem("cc_room") || "";
el("joinBtn").onclick = joinFromMenu;
el("roomCode").addEventListener("keydown", e => { if (e.key === "Enter") joinFromMenu(); });

function renderPlay() {
  document.querySelectorAll(".mode").forEach(m => m.classList.toggle("active", m.dataset.mode === chosenMode));
  const comp = chosenMode === "competitive";
  el("matchBox").hidden = !comp;
  el("privateWarn").hidden = !comp;
  el("joinBtn").textContent = comp ? "Join private room" : "Join room";
  const lo = (PROFILE.loadout || []).filter(id => (PROFILE.abilities || {})[id] > 0);
  el("loadoutSummary").innerHTML = chosenMode !== "competitive" ? "" :
    `<b>Your loadout:</b> ${lo.length ? lo.map((id, i) => `<kbd>${"JKL"[i]}</kbd> ${RULES[id].icon} ${RULES[id].name}`).join(" &nbsp; ") : "<span class='muted'>nothing equipped. Buy packs in the Shop, then equip up to 3 in Inventory.</span>"}`;
}
async function joinFromMenu() {
  const code = el("roomCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code || code.length > 10) { toast("Type a room code (letters/numbers, up to 10)", true); return; }
  if (!PROFILE) return;
  try { localStorage.setItem("cc_room", code); } catch (e) {}
  el("joinBtn").disabled = true;
  try {
    showScreen("game");
    await joinRoom(chosenMode, code, Object.assign({ uid: UID }, PROFILE));
  } catch (e) {
    console.error(e); showScreen("menuScreen"); toast("Couldn't join: " + e.message, true);
  }
  el("joinBtn").disabled = false;
}
el("matchBtn").onclick = async () => {
  if (!PROFILE || el("matchBtn").disabled) return;
  el("matchBtn").disabled = true;
  try {
    showScreen("game");
    await findMatch(Object.assign({ uid: UID }, PROFILE));
  } catch (e) {
    console.error(e); showScreen("menuScreen"); toast("Couldn't find a match: " + e.message, true);
  }
  el("matchBtn").disabled = false;
};
el("leaveBtn").onclick = () => location.reload();   // leaving = reload; the server removes you

// called by game.js when you win a competitive round
async function awardWinPoints(n) {
  try {
    await fs.runTransaction(async tx => {
      const d = (await tx.get(userRef(UID))).data();
      tx.update(userRef(UID), { points: (d.points || 0) + n, lastWinAt: FV.serverTimestamp() });
    });
    toast(`🏆 +${n} points!`);
  } catch (e) { console.error(e); toast("Couldn't add your points: " + e.message, true); }
}

// ---------------------------------------------------------------- shop
function rollWeighted(items) {
  const total = items.reduce((s, it) => s + it[1], 0);
  let r = Math.random() * total;
  for (const it of items) { if ((r -= it[1]) < 0) return it; }
  return items[items.length - 1];
}
function rarityTag(r) { return `<span class="rar" style="color:${RARITY[r].color}">${RARITY[r].label}</span>`; }

function renderShop() {
  const pts = PROFILE.points || 0;
  el("abilityPacks").innerHTML = Object.entries(ABILITY_PACKS).map(([pid, p]) => `
    <div class="pack">
      <div class="packHead">${p.icon} <b>${p.name}</b></div>
      <div class="muted small">${p.theme}</div>
      <ul>${p.items.map(([id, pct, r]) => `<li>${RULES[id].icon} ${RULES[id].name} ${rarityTag(r)} <span class="muted">${pct}%</span></li>`).join("")}</ul>
      <button data-buy-ability="${pid}" ${pts < PACK_COST ? "disabled" : ""}>Buy · ⭐ ${PACK_COST}</button>
    </div>`).join("");
  el("skinPacks").innerHTML = Object.entries(SKIN_PACKS).map(([pid, p]) => `
    <div class="pack">
      <div class="packHead">${p.icon} <b>${p.name}</b></div>
      <div class="skinRow">${p.skins.map((sid, i) => `<div class="skinCell"><canvas class="skinprev" data-skin="${sid}" width="46" height="46"></canvas>
        <div class="small">${SKINS[sid].name}</div>${rarityTag(SKIN_ODDS[i][0])} <span class="muted small">${SKIN_ODDS[i][1]}%</span></div>`).join("")}</div>
      <button data-buy-skin="${pid}" ${pts < SKIN_PACK_COST ? "disabled" : ""}>Buy · ⭐ ${SKIN_PACK_COST}</button>
    </div>`).join("");
  document.querySelectorAll("[data-buy-ability]").forEach(b => b.onclick = () => buyPack("ability", b.dataset.buyAbility));
  document.querySelectorAll("[data-buy-skin]").forEach(b => b.onclick = () => buyPack("skin", b.dataset.buySkin));
}

async function buyPack(kind, pid) {
  if (busy) return;
  busy = true;
  const cost = kind === "ability" ? PACK_COST : SKIN_PACK_COST;
  let prize, rarity;
  if (kind === "ability") { const it = rollWeighted(ABILITY_PACKS[pid].items); prize = it[0]; rarity = it[2]; }
  else { const pack = SKIN_PACKS[pid], it = rollWeighted(SKIN_ODDS); rarity = it[0]; prize = pack.skins[SKIN_ODDS.findIndex(o => o[0] === rarity)]; }
  try {
    await fs.runTransaction(async tx => {
      const d = (await tx.get(userRef(UID))).data();
      if ((d.points || 0) < cost) throw new Error("Not enough points");
      const field = kind === "ability" ? "abilities" : "skins";
      const inv = Object.assign({}, d[field] || {});
      inv[prize] = (inv[prize] || 0) + 1;
      tx.update(userRef(UID), { points: d.points - cost, [field]: inv });
    });
    showRoll(kind, pid, prize, rarity);
  } catch (e) { toast(e.message, true); busy = false; }
}

function showRoll(kind, pid, prize, rarity) {
  const pack = kind === "ability" ? ABILITY_PACKS[pid] : SKIN_PACKS[pid];
  const pool = kind === "ability" ? pack.items.map(i => i[0]) : pack.skins;
  const box = el("rollBox"), m = el("rollModal");
  m.style.display = "flex"; el("rollClose").hidden = true;
  el("rollTitle").textContent = `Opening ${pack.name}…`;
  let n = 0;
  const spin = setInterval(() => {
    const id = pool[n++ % pool.length];
    box.innerHTML = kind === "ability" ? `<div class="bigIcon">${RULES[id].icon}</div>` : `<canvas class="skinprev big" data-skin="${id}" width="96" height="96"></canvas>`;
  }, 90);
  setTimeout(() => {
    clearInterval(spin);
    const name = kind === "ability" ? RULES[prize].name : SKINS[prize].name;
    const count = kind === "ability" ? (PROFILE.abilities || {})[prize] : (PROFILE.skins || {})[prize];
    el("rollTitle").innerHTML = `You got <span style="color:${RARITY[rarity].color}">${RARITY[rarity].label}</span>!`;
    box.innerHTML = (kind === "ability" ? `<div class="bigIcon">${RULES[prize].icon}</div>` : `<canvas class="skinprev big" data-skin="${prize}" width="96" height="96"></canvas>`) +
      `<div class="rollName" style="color:${RARITY[rarity].color}">${esc(name)}</div>` +
      (count > 1 ? `<div class="muted small">You now have ${count}. Extras can be traded!</div>` : "");
    el("rollClose").hidden = false;
    busy = false;
  }, 1500);
}
el("rollClose").onclick = () => el("rollModal").style.display = "none";

// ---------------------------------------------------------------- inventory
function renderInventory() {
  const ab = PROFILE.abilities || {}, sk = PROFILE.skins || {};
  const lo = (PROFILE.loadout || []).filter(id => ab[id] > 0);
  const owned = Object.keys(ab).filter(id => ab[id] > 0 && RULES[id]);
  el("invAbilities").innerHTML = owned.length ? owned.map(id => {
    const on = lo.includes(id);
    return `<div class="invItem ${on ? "on" : ""}">
      <div class="bigIconSm">${RULES[id].icon}</div>
      <div class="grow"><b>${RULES[id].name}</b> ×${ab[id]} ${rarityTag(abilityRarity(id))}<div class="muted small">${RULES[id].desc}</div></div>
      <button data-equip-ab="${id}" class="${on ? "secondary" : ""}">${on ? `Equipped (${"JKL"[lo.indexOf(id)]})` : "Equip"}</button></div>`;
  }).join("") : "<div class='muted'>No abilities yet. Buy packs in the Shop!</div>";
  document.querySelectorAll("[data-equip-ab]").forEach(b => b.onclick = () => toggleLoadout(b.dataset.equipAb));

  const skins = ["default", ...Object.keys(sk).filter(id => sk[id] > 0 && SKINS[id])];
  const eq = sk[PROFILE.equippedSkin] > 0 ? PROFILE.equippedSkin : "default";
  el("invSkins").innerHTML = skins.map(id => `
    <div class="skinCard ${id === eq ? "on" : ""}">
      <canvas class="skinprev" data-skin="${id}" width="60" height="60"></canvas>
      <div><b>${SKINS[id].name}</b>${id !== "default" ? " ×" + sk[id] : ""}</div>
      ${id !== "default" ? rarityTag(SKINS[id].rarity) : "<span class='muted small'>always yours</span>"}
      <button data-equip-skin="${id}" ${id === eq ? "disabled" : ""}>${id === eq ? "Equipped" : "Equip"}</button>
    </div>`).join("");
  document.querySelectorAll("[data-equip-skin]").forEach(b => b.onclick = () => {
    PROFILE.equippedSkin = b.dataset.equipSkin; renderInventory();
    userRef(UID).update({ equippedSkin: b.dataset.equipSkin }).catch(e => toast(e.message, true));
  });
}
function toggleLoadout(id) {
  const ab = PROFILE.abilities || {};
  let lo = (PROFILE.loadout || []).filter(x => ab[x] > 0);
  if (lo.includes(id)) lo = lo.filter(x => x !== id);
  else if (lo.length >= 3) { toast("You can only equip 3. Unequip one first.", true); return; }
  else lo.push(id);
  PROFILE.loadout = lo; renderInventory(); renderPlay();   // show it straight away (fast clicks don't get lost)
  userRef(UID).update({ loadout: lo }).catch(e => toast(e.message, true));
}

// ---------------------------------------------------------------- trading
// How it's kept fair: when you send a trade, what you're giving is taken out of your account and held in the trade.
// When they accept, they pay what you asked for and receive what you gave; your computer then collects what they paid.
// Nobody ever writes to someone else's account.
function cleanBundle(b) {
  const out = { points: Math.max(0, Math.floor(+b.points || 0)), abilities: {}, skins: {} };
  Object.entries(b.abilities || {}).forEach(([k, v]) => { const n = Math.floor(+v || 0); if (n > 0 && RULES[k] && RULES[k].type === "ability") out.abilities[k] = n; });
  Object.entries(b.skins || {}).forEach(([k, v]) => { const n = Math.floor(+v || 0); if (n > 0 && SKINS[k] && k !== "default") out.skins[k] = n; });
  return out;
}
const bundleEmpty = b => !b.points && !Object.keys(b.abilities).length && !Object.keys(b.skins).length;
function missingFrom(prof, b) {
  if ((prof.points || 0) < b.points) return `${b.points} points`;
  for (const [k, n] of Object.entries(b.abilities)) if (((prof.abilities || {})[k] || 0) < n) return `${n}× ${RULES[k].name}`;
  for (const [k, n] of Object.entries(b.skins)) if (((prof.skins || {})[k] || 0) < n) return `${n}× ${SKINS[k].name} skin`;
  return null;
}
function applyBundle(prof, b, sign) {
  const ab = Object.assign({}, prof.abilities || {}), sk = Object.assign({}, prof.skins || {});
  Object.entries(b.abilities).forEach(([k, n]) => { ab[k] = (ab[k] || 0) + sign * n; if (ab[k] <= 0) delete ab[k]; });
  Object.entries(b.skins).forEach(([k, n]) => { sk[k] = (sk[k] || 0) + sign * n; if (sk[k] <= 0) delete sk[k]; });
  return {
    points: (prof.points || 0) + sign * b.points, abilities: ab, skins: sk,
    loadout: (prof.loadout || []).filter(id => ab[id] > 0),
    equippedSkin: sk[prof.equippedSkin] > 0 ? prof.equippedSkin : "default",
  };
}
function bundleText(b) {
  const parts = [];
  if (b.points) parts.push(`⭐ ${b.points} points`);
  Object.entries(b.abilities || {}).forEach(([k, n]) => parts.push(`${RULES[k] ? RULES[k].icon + " " + RULES[k].name : k} ×${n}`));
  Object.entries(b.skins || {}).forEach(([k, n]) => parts.push(`🎨 ${SKINS[k] ? SKINS[k].name : k} ×${n}`));
  return parts.length ? parts.join(", ") : "nothing";
}

let tradeTarget = null;   // { uid, username, profile }
el("findBtn").onclick = async () => {
  const name = el("tradeUser").value.trim().toLowerCase();
  el("tradeForm").innerHTML = "";
  tradeTarget = null;
  if (!USERNAME_RE.test(name)) { toast("Type their username", true); return; }
  try {
    const u = await fs.collection("usernames").doc(name).get();
    if (!u.exists) { toast("No player called " + name, true); return; }
    const uid = u.data().uid;
    if (uid === UID) { toast("You can't trade with yourself", true); return; }
    const prof = (await userRef(uid).get()).data();
    if (!prof) { toast("That player has no account data yet", true); return; }
    tradeTarget = { uid, username: prof.username, profile: prof };
    renderTradeForm();
  } catch (e) { toast(e.message, true); }
};
function invInputs(prefix, prof) {
  const ab = prof.abilities || {}, sk = prof.skins || {};
  const rows = [];
  Object.keys(ab).filter(k => ab[k] > 0 && RULES[k]).forEach(k => rows.push(`<label class="tradeRow">${RULES[k].icon} ${RULES[k].name} <span class="muted">(has ${ab[k]})</span><input type="number" min="0" max="${ab[k]}" value="0" data-${prefix}-ab="${k}"></label>`));
  Object.keys(sk).filter(k => sk[k] > 0 && SKINS[k]).forEach(k => rows.push(`<label class="tradeRow">🎨 ${SKINS[k].name} <span class="muted">(has ${sk[k]})</span><input type="number" min="0" max="${sk[k]}" value="0" data-${prefix}-sk="${k}"></label>`));
  return `<label class="tradeRow">⭐ Points <span class="muted">(has ${prof.points || 0})</span><input type="number" min="0" max="${prof.points || 0}" value="0" data-${prefix}-pts></label>` + rows.join("");
}
function renderTradeForm() {
  const t = tradeTarget;
  el("tradeForm").innerHTML = `
    <div class="tradeCols">
      <div class="col"><h4>You give</h4>${invInputs("give", PROFILE)}</div>
      <div class="col"><h4>You get from ${esc(t.username)}</h4>${invInputs("want", t.profile)}</div>
    </div>
    <button id="sendTradeBtn">Send trade request · ⭐ ${TRADE_COST}</button>
    <div class="muted small">Sending costs ${TRADE_COST} points (not refunded). What you give is held until they answer. If they decline or you cancel, you get it back.</div>`;
  el("sendTradeBtn").onclick = sendTrade;
}
function readBundle(prefix) {
  const b = { points: 0, abilities: {}, skins: {} };
  const p = document.querySelector(`[data-${prefix}-pts]`); if (p) b.points = p.value;
  document.querySelectorAll(`[data-${prefix}-ab]`).forEach(i => b.abilities[i.getAttribute(`data-${prefix}-ab`)] = i.value);
  document.querySelectorAll(`[data-${prefix}-sk]`).forEach(i => b.skins[i.getAttribute(`data-${prefix}-sk`)] = i.value);
  return cleanBundle(b);
}
async function sendTrade() {
  if (busy || !tradeTarget) return;
  const give = readBundle("give"), want = readBundle("want");
  if (bundleEmpty(give) && bundleEmpty(want)) { toast("Pick something to give or get", true); return; }
  const miss = missingFrom(tradeTarget.profile, want);
  if (miss) { toast(`${tradeTarget.username} doesn't have ${miss}`, true); return; }
  busy = true;
  const t = tradeTarget;
  try {
    await fs.runTransaction(async tx => {
      const me = (await tx.get(userRef(UID))).data();
      const cost = { points: give.points + TRADE_COST, abilities: give.abilities, skins: give.skins };
      const m = missingFrom(me, cost);
      if (m) throw new Error("You don't have " + m + (give.points ? ` (sending costs ${TRADE_COST} points too)` : ""));
      tx.update(userRef(UID), applyBundle(me, cost, -1));
      tx.set(fs.collection("trades").doc(), {
        from: UID, fromName: me.username, to: t.uid, toName: t.username,
        give, want, status: "pending", createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp()
      });
    });
    toast("Trade request sent!");
    el("tradeForm").innerHTML = ""; el("tradeUser").value = ""; tradeTarget = null;
  } catch (e) { toast(e.message, true); }
  busy = false;
}

async function answerTrade(id, accept) {
  if (busy) return;
  busy = true;
  const tRef = fs.collection("trades").doc(id);
  try {
    await fs.runTransaction(async tx => {
      const t = (await tx.get(tRef)).data();
      const me = (await tx.get(userRef(UID))).data();
      if (!t || t.status !== "pending" || t.to !== UID) throw new Error("This trade isn't open anymore");
      if (accept) {
        const want = cleanBundle(t.want), give = cleanBundle(t.give);
        const m = missingFrom(me, want);
        if (m) throw new Error("You don't have " + m);
        const after = Object.assign({}, me, applyBundle(me, want, -1));
        tx.update(userRef(UID), applyBundle(after, give, +1));
      }
      tx.update(tRef, { status: accept ? "accepted" : "declined", updatedAt: FV.serverTimestamp() });
    });
    toast(accept ? "Trade done! 🤝" : "Trade declined");
  } catch (e) { toast(e.message, true); }
  busy = false;
}

// sender side: collect what they paid (accepted) or get your items back (declined / cancelled)
async function claimTrade(id) {
  if (claiming.has(id)) return;
  claiming.add(id);
  const tRef = fs.collection("trades").doc(id);
  try {
    let msg = "";
    await fs.runTransaction(async tx => {
      const t = (await tx.get(tRef)).data();
      const me = (await tx.get(userRef(UID))).data();
      if (!t || t.from !== UID) return;
      if (t.status === "accepted") {
        tx.update(userRef(UID), applyBundle(me, cleanBundle(t.want), +1));
        tx.update(tRef, { status: "done", updatedAt: FV.serverTimestamp() });
        msg = `🤝 ${t.toName} accepted your trade!`;
      } else if (t.status === "declined") {
        tx.update(userRef(UID), applyBundle(me, cleanBundle(t.give), +1));
        tx.update(tRef, { status: "closed", updatedAt: FV.serverTimestamp() });
        msg = `${t.toName} declined your trade. Your items are back.`;
      }
    });
    if (msg) toast(msg);
  } catch (e) { console.error(e); }
  claiming.delete(id);
}
async function cancelTrade(id) {
  if (busy) return;
  busy = true;
  const tRef = fs.collection("trades").doc(id);
  try {
    await fs.runTransaction(async tx => {
      const t = (await tx.get(tRef)).data();
      const me = (await tx.get(userRef(UID))).data();
      if (!t || t.status !== "pending" || t.from !== UID) throw new Error("Too late, they already answered");
      tx.update(userRef(UID), applyBundle(me, cleanBundle(t.give), +1));
      tx.update(tRef, { status: "cancelled", updatedAt: FV.serverTimestamp() });
    });
    toast("Trade cancelled, your items are back");
  } catch (e) { toast(e.message, true); }
  busy = false;
}

const STATUS_TEXT = { pending: "⏳ waiting", accepted: "✅ accepted", done: "✅ done", declined: "❌ declined", closed: "❌ declined", cancelled: "🚫 cancelled" };
const ts = t => (t.createdAt && t.createdAt.toMillis ? t.createdAt.toMillis() : Date.now());
function renderTrades() {
  if (!PROFILE) return;
  const inc = incoming.filter(t => t.status === "pending").sort((a, b) => ts(b) - ts(a));
  el("tradeBadge").textContent = inc.length ? `(${inc.length})` : "";
  el("incomingTrades").innerHTML = inc.length ? inc.map(t => `
    <div class="tradeItem">
      <div><b>${esc(t.fromName)}</b> gives: ${bundleText(t.give)}<br>and wants: ${bundleText(t.want)}</div>
      <div class="row"><button data-accept="${t.id}">Accept</button><button class="secondary" data-decline="${t.id}">Decline</button></div>
    </div>`).join("") : "<div class='muted'>No trade requests.</div>";
  const out = outgoing.slice().sort((a, b) => ts(b) - ts(a)).slice(0, 10);
  el("outgoingTrades").innerHTML = out.length ? out.map(t => `
    <div class="tradeItem">
      <div>To <b>${esc(t.toName)}</b>: you give ${bundleText(t.give)}, you get ${bundleText(t.want)}<br><span class="muted">${STATUS_TEXT[t.status] || t.status}</span></div>
      ${t.status === "pending" ? `<button class="secondary" data-cancel="${t.id}">Cancel</button>` : ""}
    </div>`).join("") : "<div class='muted'>You haven't sent any trades.</div>";
  document.querySelectorAll("[data-accept]").forEach(b => b.onclick = () => answerTrade(b.dataset.accept, true));
  document.querySelectorAll("[data-decline]").forEach(b => b.onclick = () => answerTrade(b.dataset.decline, false));
  document.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => cancelTrade(b.dataset.cancel));
}

// ---------------------------------------------------------------- animated skin previews in the menu
(function previewLoop() {
  const t = performance.now();
  document.querySelectorAll("canvas.skinprev").forEach(cv => {
    if (!cv.offsetParent) return;      // hidden
    const c = cv.getContext("2d"), s = cv.width;
    c.clearRect(0, 0, s, s);
    drawSkin(c, cv.dataset.skin, 0, 0, s, "#4fc3f7", t);
  });
  requestAnimationFrame(previewLoop);
})();
