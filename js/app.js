// ======================================================================
//  app.js: login, menus, shop, inventory, trading, High Risk list.
//  Every change goes through the server (api(...)); nothing here can
//  change an account by itself.
// ======================================================================
const EMAIL_DOMAIN = "@clapcatch.game";   // players never see this; it just lets Firebase store username logins
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
let PROFILE = null, pendingSignupName = null, busy = false, tutAutoShown = false;
let trades = { incoming: [], outgoing: [] }, riskGames = [];

const el = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg, bad) {
  const t = el("toast");
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = "", 2800);
}
function showScreen(name) { ["authScreen", "menuScreen", "game", "banScreen"].forEach(id => el(id).hidden = id !== name); }
function setProfile(p) { if (!p) return; PROFILE = p; if (!checkBan()) renderAll(); }
function onPoints(points) { if (PROFILE) { PROFILE.points = points; el("gamePoints").textContent = "⭐ " + points; } }

// ---------------------------------------------------------------- login / sign up
function authError(e) {
  const c = (e && e.code) || "";
  if (c.includes("email-already-in-use")) return "That username is taken.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-login")) return "Wrong username or password.";
  if (c.includes("weak-password")) return "Password needs at least 6 characters.";
  if (c.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (c.includes("network")) return "No internet connection.";
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
el("logoutBtn").onclick = el("banLogout").onclick = async () => { await auth.signOut(); location.reload(); };

auth.onAuthStateChanged(async user => {
  if (!user) { PROFILE = null; showScreen("authScreen"); return; }
  try {
    let p;
    try { p = await api("me"); }
    catch (e) {
      if (!/No account yet/.test(e.message)) throw e;
      p = await api("init", { username: pendingSignupName || user.email.split("@")[0] });   // first time: make the account
    }
    setProfile(p);
    if (!inGame && el("banScreen").hidden) showScreen("menuScreen");
    if (p.tutorialDone === false && !tutAutoShown) { tutAutoShown = true; openTutorial(true, p.tutorialSeenBefore); }
    refreshTrades();
  } catch (e) { el("authErr").textContent = "Couldn't load your account: " + e.message; showScreen("authScreen"); }
});

// ---------------------------------------------------------------- bans
let banTimer = null;
function checkBan() {
  const until = (PROFILE && PROFILE.bannedUntil) || 0;
  if (until <= Date.now()) { if (!el("banScreen").hidden) { clearInterval(banTimer); showScreen(inGame ? "game" : "menuScreen"); } return false; }
  showScreen("banScreen");
  clearInterval(banTimer);
  const upd = () => {
    const left = until - Date.now();
    if (left <= 0) { clearInterval(banTimer); api("me").then(setProfile).catch(() => {}); return; }
    el("banTime").textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
  };
  upd(); banTimer = setInterval(upd, 500);
  return true;
}

// ---------------------------------------------------------------- tabs
let currentTab = "play";
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  currentTab = b.dataset.tab;
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
  document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-" + currentTab);
  if (currentTab === "trade") refreshTrades();
  if (currentTab === "risk") refreshRisk();
  if (currentTab === "friends") refreshFriends();
  if (currentTab === "board") refreshBoard();
});
function renderAll() {
  if (!PROFILE) return;
  el("whoami").textContent = "👤 " + PROFILE.username;
  el("pointsLbl").textContent = "⭐ " + PROFILE.points + " points";
  el("gamePoints").textContent = "⭐ " + PROFILE.points;
  renderPlay(); renderShop(); renderInventory(); renderTrades(); renderRisk(); renderEvent();
  el("friendBadge").textContent = PROFILE.friendIn ? `(${PROFILE.friendIn})` : "";
  showNotices();
}
// ---------------------------------------------------------------- messages (e.g. board results)
function showNotices() {
  const n = PROFILE.notices || [];
  if (!n.length || inGame || el("noticeModal").style.display === "flex") return;
  el("noticeList").innerHTML = n.map(x => `<div class="notice ${x.big ? "big" : ""}">${esc(x.msg)}</div>`).join("");
  el("noticeModal").style.display = "flex";
}
el("noticeClose").onclick = () => { el("noticeModal").style.display = "none"; PROFILE.notices = []; api("noticesSeen").then(setProfile).catch(() => {}); };

// ---------------------------------------------------------------- friends
let friendData = { friends: [], incoming: [], outgoing: [] };
async function refreshFriends() { try { friendData = await api("friendsList"); renderFriends(); } catch (e) {} }
function gameLabel(g) {
  if (!g) return "";
  if (g.type === "pub") return `in a matchmade game (${g.humans}/6)`;
  if (g.type === "risk") return g.state === "lobby" ? `in a High Risk lobby, stake ⭐ ${g.stake} (${g.humans}/6)` : "in a High Risk game (started)";
  return `in a private room (${g.humans}/6)`;
}
function renderFriends() {
  const d = friendData;
  el("friendBadge").textContent = d.incoming.length ? `(${d.incoming.length})` : "";
  el("friendInCard").hidden = !d.incoming.length;
  el("friendIn").innerHTML = d.incoming.map(f => `<div class="tradeItem"><div>👋 <b>${esc(f.username)}</b> wants to be friends</div>
    <div class="row"><button type="button" data-fr-yes="${esc(f.uid)}">Accept</button><button type="button" class="secondary" data-fr-no="${esc(f.uid)}">Decline</button></div></div>`).join("");
  el("friendOutCard").hidden = !d.outgoing.length;
  el("friendOut").innerHTML = d.outgoing.map(f => `<div class="tradeItem"><div>⏳ <b>${esc(f.username)}</b> hasn't answered yet</div>
    <button type="button" class="secondary" data-fr-cancel="${esc(f.uid)}">Cancel</button></div>`).join("");
  const order = f => f.game ? 0 : f.online ? 1 : 2;
  el("friendList").innerHTML = d.friends.length ? d.friends.slice().sort((a, b) => order(a) - order(b) || a.username.localeCompare(b.username)).map(f => {
    const canJoin = f.game && !(f.game.type === "risk" && f.game.state !== "lobby") && f.game.humans < 6;
    return `<div class="tradeItem"><div><span class="dot ${f.game ? "ingame" : f.online ? "on" : ""}"></span><b>${esc(f.username)}</b>
      <span class="muted small">${f.game ? gameLabel(f.game) : f.online ? "online" : "offline"}</span></div>
      <div class="row">${f.game ? `<button type="button" data-fr-join="${esc(f.uid)}" ${canJoin ? "" : "disabled"}>${canJoin ? "Join" : "Can't join"}</button>` : ""}
      <button type="button" class="ghost small" data-fr-remove="${esc(f.uid)}" data-name="${esc(f.username)}">Remove</button></div></div>`;
  }).join("") : "<div class='muted'>No friends yet. Add someone by their username!</div>";
  const act = (op, args, msg) => api(op, args).then(() => { if (msg) toast(msg); refreshFriends(); }).catch(e => toast(e.message, true));
  document.querySelectorAll("[data-fr-yes]").forEach(b => b.onclick = () => act("friendAnswer", { uid: b.dataset.frYes, accept: true }, "New friend! 🎉"));
  document.querySelectorAll("[data-fr-no]").forEach(b => b.onclick = () => act("friendAnswer", { uid: b.dataset.frNo, accept: false }));
  document.querySelectorAll("[data-fr-cancel]").forEach(b => b.onclick = () => act("friendCancel", { uid: b.dataset.frCancel }));
  document.querySelectorAll("[data-fr-remove]").forEach(b => b.onclick = () => { if (confirm(`Remove ${b.dataset.name} from your friends?`)) act("friendRemove", { uid: b.dataset.frRemove }, "Removed"); });
  document.querySelectorAll("[data-fr-join]").forEach(b => b.onclick = () => enterRoom(async () => (await api("joinFriend", { uid: b.dataset.frJoin })).key));
}
el("friendAddBtn").onclick = async () => {
  const u = el("friendUser").value.trim(); if (!u) return;
  try { const r = await api("friendRequest", { username: u }); toast(r.friends ? `You and ${u} are now friends! 🎉` : `Request sent to ${u}`); el("friendUser").value = ""; refreshFriends(); }
  catch (e) { toast(e.message, true); }
};
el("friendUser").addEventListener("keydown", e => { if (e.key === "Enter") el("friendAddBtn").click(); });

// ---------------------------------------------------------------- the 100-slot board
let boardData = null;
async function refreshBoard() { try { boardData = await api("boardGet"); renderBoard(); } catch (e) {} }
function renderBoard() {
  const b = boardData; if (!b) return;
  const n = b.slots.length, left = b.size - n, mine = new Set(b.mine);
  el("boardCount").textContent = `${n} / ${b.size} slots filled`;
  el("boardBar").style.width = (100 * n / b.size) + "%";
  el("boardMine").textContent = b.mine.length ? `You have ${b.mine.length} slot${b.mine.length > 1 ? "s" : ""} (${Math.round(100 * b.mine.length / b.size)}% chance to win the limited pack)` : "";
  el("boardN").max = left;
  const want = Math.max(1, Math.min(left, Math.floor(+el("boardN").value || 1)));
  el("boardBuyBtn").textContent = `Buy ${want} slot${want > 1 ? "s" : ""} · ⭐ ${want * b.cost}`;
  el("boardBuyBtn").disabled = !left || (PROFILE.points || 0) < want * b.cost;
  let g = "";
  for (let i = 0; i < b.size; i++) g += i < n ? `<div class="slot ${mine.has(i) ? "mine" : "taken"}" title="${esc(b.slots[i])}">${esc(b.slots[i].slice(0, 2))}</div>` : `<div class="slot"></div>`;
  el("boardGrid").innerHTML = g;
  const L = b.last;
  el("boardLast").innerHTML = L ? `<b>Last board (#${L.id}):</b> 🏆 <b>${esc(L.winner)}</b> won the ${esc(L.pack)} → ${L.isSkin ? (SKINS[L.prize] ? SKINS[L.prize].name + " skin" : L.prize) : (RULES[L.prize] ? RULES[L.prize].icon + " " + RULES[L.prize].name : L.prize)} ${rarityTag(L.rarity)} · ${L.players} players took part`
    : "<span class='muted'>No board has finished yet. Be part of the first!</span>";
}
el("boardN").addEventListener("input", renderBoard);
el("boardBuyBtn").onclick = async () => {
  const want = Math.max(1, Math.floor(+el("boardN").value || 1));
  el("boardBuyBtn").disabled = true;
  try { const r = await api("boardBuy", { count: want }); boardData = r.board; setProfile(r.me); renderBoard(); if (!(r.me.notices || []).length) toast(`🎟️ You bought ${want} slot${want > 1 ? "s" : ""}!`); }
  catch (e) { toast(e.message, true); renderBoard(); }
};
// ---------------------------------------------------------------- limited-time events
let clockSkew = 0;
function currentEvent() { const e = PROFILE && PROFILE.event; return e && EVENTS[e.id] && e.until > Date.now() + clockSkew ? e : null; }
function timeLeft(ms) {
  ms = Math.max(0, ms); const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}
function renderEvent() {
  if (!PROFILE) return;
  if (PROFILE.serverNow) { clockSkew = PROFILE.serverNow - Date.now(); PROFILE.serverNow = 0; }
  const ev = currentEvent(), E = ev && EVENTS[ev.id];
  document.body.classList.toggle("ev-golden", !!ev && ev.id === "golden");
  document.body.classList.toggle("ev-blackout", !!ev && ev.id === "blackout");
  el("limitedTabBtn").hidden = !ev;
  el("eventBanner").hidden = !ev;
  if (!ev && currentTab === "limited") document.querySelector('.tabs button[data-tab="play"]').click();
  if (!ev) { el("limitedBox").innerHTML = ""; return; }
  const left = timeLeft(ev.until - Date.now() - clockSkew);
  el("eventBanner").innerHTML = `${E.icon} <b>${E.name}</b> is on! <span class="muted">Ends in <b class="evLeft">${left}</b> · trading is free</span>`;
  const key = ev.id + ":" + ev.until + ":" + (PROFILE.points || 0);
  if (el("limitedBox").dataset.key === key) { el("limitedBox").querySelectorAll(".evLeft").forEach(x => x.textContent = left); return; }
  el("limitedBox").dataset.key = key;
  let html = `<div class="card eventCard"><div class="eventIcon">${E.icon}</div><h2>${E.name}</h2><div>${E.desc}</div>
    <div class="muted" style="margin-top:8px">Ends in <b class="evLeft">${left}</b> · 🤝 Trading is free while it's on</div>`;
  if (ev.id === "golden") html += `<div class="jackpotNote">🌈 One in 10,000 wins gives you a FREE legendary (🔥 Fireball, ⛔ Full Counter or ☢️ Nuke). If your game has one, <b>the ball runs rainbow</b>. Win that game!</div>`;
  html += `</div>`;
  if (E.pack) {
    const P = LIMITED_PACKS[E.pack], pts = PROFILE.points || 0;
    html += `<div class="pack limitedPack"><div class="packHead">${P.icon} <b>${P.name}</b> <span class="tag">limited</span></div><div class="muted small">${P.theme}. Leaves the shop when the event ends; what you get is yours forever.</div><ul>` +
      P.items.map(([id, pct, r]) => P.kind === "skin"
        ? `<li><canvas class="skinprev" data-skin="${id}" width="28" height="28"></canvas> ${SKINS[id].name} ${rarityTag(r)} <span class="muted">${pct}%</span></li>`
        : `<li>${RULES[id].icon} <b>${RULES[id].name}</b> ${rarityTag(r)} <span class="muted">${pct}%</span><div class="muted small">${RULES[id].desc}</div></li>`).join("") +
      `</ul><button data-buy-limited="${E.pack}" ${pts < P.cost ? "disabled" : ""}>Buy · ⭐ ${P.cost}</button></div>`;
  }
  el("limitedBox").innerHTML = html;
  document.querySelectorAll("[data-buy-limited]").forEach(b => b.onclick = () => buyPack("limited", b.dataset.buyLimited));
}
setInterval(() => { if (PROFILE && !inGame) renderEvent(); }, 1000);
setInterval(() => { if (PROFILE && !inGame && !document.hidden) api("me").then(setProfile).catch(() => {}); }, 45000);   // notice events starting/stopping
// keep lists fresh while you're looking at them
setInterval(() => {
  if (!PROFILE || inGame || document.hidden) return;
  if (currentTab === "trade") refreshTrades();
  if (currentTab === "risk") refreshRisk();
  if (currentTab === "friends") refreshFriends();
  if (currentTab === "board") refreshBoard();
}, 6000);
setInterval(() => { if (PROFILE && !inGame && !document.hidden) refreshTrades(); }, 30000);

// ---------------------------------------------------------------- play
let chosenMode = "casual";
document.querySelectorAll(".mode").forEach(m => m.onclick = () => { chosenMode = m.dataset.mode; renderPlay(); });
el("roomCode").value = localStorage.getItem("cc_room") || "";
el("joinBtn").onclick = joinFromMenu;
el("roomCode").addEventListener("keydown", e => { if (e.key === "Enter") joinFromMenu(); });
function renderPlay() {
  document.querySelectorAll(".mode").forEach(m => m.classList.toggle("active", m.dataset.mode === chosenMode));
  const comp = chosenMode === "competitive";
  el("matchBox").hidden = !comp; el("privateWarn").hidden = !comp;
  el("joinBtn").textContent = comp ? "Join private room" : "Join room";
  const cd = PROFILE.teamCooldown;
  el("teamNote").textContent = (comp && cd && cd.left > 0)
    ? `You've played 3 matchmade games in a row with the same people, so Find a match will keep you apart for ${cd.left} more game${cd.left > 1 ? "s" : ""}.` : "";
  const lo = PROFILE.loadout || [];
  el("loadoutSummary").innerHTML = !comp ? "" :
    `<b>Your loadout:</b> ${lo.length ? lo.map((id, i) => `<kbd>${keyName(abilityKey(i))}</kbd> ${RULES[id].icon} ${RULES[id].name}`).join(" &nbsp; ") : "<span class='muted'>nothing equipped. Buy packs in the Shop, then equip up to 3 in Inventory.</span>"}`;
}
async function enterRoom(getKey) {
  showScreen("game");
  try { const key = await getKey(); await joinGame(key); }
  catch (e) { showScreen("menuScreen"); toast(e.message, true); }
}
function joinFromMenu() {
  const code = el("roomCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code || code.length > 10) { toast("Type a room code (letters/numbers, up to 10)", true); return; }
  try { localStorage.setItem("cc_room", code); } catch (e) {}
  enterRoom(async () => (chosenMode === "competitive" ? "COMP" : "CAS") + code);
}
el("matchBtn").onclick = () => enterRoom(async () => (await api("match")).key);
el("leaveBtn").onclick = () => location.reload();   // leaving = reload; the server removes you

// ---------------------------------------------------------------- shop
function rarityTag(r) { return `<span class="rar" style="color:${RARITY[r].color}">${RARITY[r].label}</span>`; }
function renderShop() {
  const pts = PROFILE.points || 0;
  const ev = currentEvent(), lucky = ev && ev.id === "lucky";
  const odds = items => lucky ? luckyOdds(items) : items;
  el("abilityPacks").innerHTML = (lucky ? `<div class="warn" style="grid-column:1/-1">🍀 <b>Lucky Event:</b> legendary items are 1.5% more likely!</div>` : "") + Object.entries(ABILITY_PACKS).map(([pid, p]) => `
    <div class="pack"><div class="packHead">${p.icon} <b>${p.name}</b></div><div class="muted small">${p.theme}</div>
      <ul>${odds(p.items).map(([id, pct, r]) => `<li>${RULES[id].icon} ${RULES[id].name} ${rarityTag(r)} <span class="muted">${pct}%</span></li>`).join("")}</ul>
      <button data-buy-ability="${pid}" ${pts < ECON.PACK_COST ? "disabled" : ""}>Buy · ⭐ ${ECON.PACK_COST}</button></div>`).join("");
  const skinOdds = odds(SKIN_ODDS.map(o => [o[0], o[1], o[0]]));
  el("skinPacks").innerHTML = Object.entries(SKIN_PACKS).map(([pid, p]) => `
    <div class="pack"><div class="packHead">${p.icon} <b>${p.name}</b></div>
      <div class="skinRow">${p.skins.map((sid, i) => `<div class="skinCell"><canvas class="skinprev" data-skin="${sid}" width="46" height="46"></canvas>
        <div class="small">${SKINS[sid].name}</div>${rarityTag(skinOdds[i][2])} <span class="muted small">${skinOdds[i][1]}%</span></div>`).join("")}</div>
      <button data-buy-skin="${pid}" ${pts < ECON.SKIN_PACK_COST ? "disabled" : ""}>Buy · ⭐ ${ECON.SKIN_PACK_COST}</button></div>`).join("");
  document.querySelectorAll("[data-buy-ability]").forEach(b => b.onclick = () => buyPack("ability", b.dataset.buyAbility));
  document.querySelectorAll("[data-buy-skin]").forEach(b => b.onclick = () => buyPack("skin", b.dataset.buySkin));
}
async function buyPack(kind, pid) {
  if (busy) return;
  busy = true;
  try { const r = await api("buy", { kind, pack: pid }); showRoll(kind, pid, r.prize, r.rarity, r.count, r.me, r.isSkin); }
  catch (e) { toast(e.message, true); busy = false; }
}
function showRoll(kind0, pid, prize, rarity, count, newMe, isSkin) {
  const pack = kind0 === "limited" ? LIMITED_PACKS[pid] : kind0 === "ability" ? ABILITY_PACKS[pid] : SKIN_PACKS[pid];
  const kind = (kind0 === "skin" || isSkin) ? "skin" : "ability";
  const pool = pack.items ? pack.items.map(i => i[0]) : pack.skins;
  const box = el("rollBox");
  el("rollModal").style.display = "flex"; el("rollClose").hidden = true;
  el("rollTitle").textContent = `Opening ${pack.name}…`;
  let n = 0;
  const spin = setInterval(() => {
    const id = pool[n++ % pool.length];
    box.innerHTML = kind === "ability" ? `<div class="bigIcon">${RULES[id].icon}</div>` : `<canvas class="skinprev big" data-skin="${id}" width="96" height="96"></canvas>`;
  }, 90);
  setTimeout(() => {
    clearInterval(spin);
    const name = kind === "ability" ? RULES[prize].name : SKINS[prize].name;
    el("rollTitle").innerHTML = `You got <span class="rar-${rarity}" style="color:${RARITY[rarity].color}">${RARITY[rarity].label}</span>!`;
    if (rarity === "mythical" || rarity === "legendary") el("rollModal").classList.add("rare-" + rarity), setTimeout(() => el("rollModal").classList.remove("rare-" + rarity), 2500);
    box.innerHTML = (kind === "ability" ? `<div class="bigIcon">${RULES[prize].icon}</div>` : `<canvas class="skinprev big" data-skin="${prize}" width="96" height="96"></canvas>`) +
      `<div class="rollName" style="color:${RARITY[rarity].color}">${esc(name)}</div>` + (count > 1 ? `<div class="muted small">You now have ${count}. Extras can be traded!</div>` : "");
    el("rollClose").hidden = false;
    setProfile(newMe);
    busy = false;
  }, 1500);
}
el("rollClose").onclick = () => el("rollModal").style.display = "none";

// ---------------------------------------------------------------- inventory
function renderInventory() {
  const ab = PROFILE.abilities || {}, sk = PROFILE.skins || {}, lo = PROFILE.loadout || [];
  const owned = Object.keys(ab).filter(id => ab[id] > 0 && RULES[id]);
  el("invAbilities").innerHTML = owned.length ? owned.map(id => {
    const on = lo.includes(id);
    return `<div class="invItem ${on ? "on" : ""}"><div class="bigIconSm">${RULES[id].icon}</div>
      <div class="grow"><b>${RULES[id].name}</b> ×${ab[id]} ${rarityTag(abilityRarity(id))}<div class="muted small">${RULES[id].desc}</div></div>
      <button data-equip-ab="${id}" class="${on ? "secondary" : ""}">${on ? `Equipped (${keyName(abilityKey(lo.indexOf(id)))})` : "Equip"}</button></div>`;
  }).join("") : "<div class='muted'>No abilities yet. Buy packs in the Shop!</div>";
  document.querySelectorAll("[data-equip-ab]").forEach(b => b.onclick = () => toggleLoadout(b.dataset.equipAb));
  const skins = ["default", ...Object.keys(sk).filter(id => sk[id] > 0 && SKINS[id])];
  const eq = PROFILE.equippedSkin || "default";
  el("invSkins").innerHTML = skins.map(id => `
    <div class="skinCard ${id === eq ? "on" : ""}"><canvas class="skinprev" data-skin="${id}" width="60" height="60"></canvas>
      <div><b>${SKINS[id].name}</b>${id !== "default" ? " ×" + sk[id] : ""}</div>
      ${id !== "default" ? rarityTag(SKINS[id].rarity) : "<span class='muted small'>always yours</span>"}
      <button data-equip-skin="${id}" ${id === eq ? "disabled" : ""}>${id === eq ? "Equipped" : "Equip"}</button></div>`).join("");
  document.querySelectorAll("[data-equip-skin]").forEach(b => b.onclick = () => {
    PROFILE.equippedSkin = b.dataset.equipSkin; renderInventory();
    api("skin", { id: b.dataset.equipSkin }).then(setProfile).catch(e => toast(e.message, true));
  });
}
function toggleLoadout(id) {
  let lo = (PROFILE.loadout || []).slice();
  if (lo.includes(id)) lo = lo.filter(x => x !== id);
  else if (lo.length >= 3) { toast("You can only equip 3. Unequip one first.", true); return; }
  else lo.push(id);
  PROFILE.loadout = lo; renderInventory(); renderPlay();       // show it straight away
  api("loadout", { ids: lo }).then(setProfile).catch(e => toast(e.message, true));
}

// ---------------------------------------------------------------- trading
function bundleText(b) {
  const parts = [];
  if (b && b.points) parts.push(`⭐ ${b.points} points`);
  Object.entries((b && b.abilities) || {}).forEach(([k, n]) => parts.push(`${RULES[k] ? RULES[k].icon + " " + RULES[k].name : k} ×${n}`));
  Object.entries((b && b.skins) || {}).forEach(([k, n]) => parts.push(`🎨 ${SKINS[k] ? SKINS[k].name : k} ×${n}`));
  return parts.length ? parts.join(", ") : "nothing";
}
let tradeTarget = null;
el("findBtn").onclick = async () => {
  el("tradeForm").innerHTML = ""; tradeTarget = null;
  const name = el("tradeUser").value.trim();
  if (!USERNAME_RE.test(name)) { toast("Type their username", true); return; }
  try { tradeTarget = await api("findUser", { username: name }); renderTradeForm(); } catch (e) { toast(e.message, true); }
};
function invInputs(prefix, prof) {
  const ab = prof.abilities || {}, sk = prof.skins || {}, rows = [];
  Object.keys(ab).filter(k => ab[k] > 0 && RULES[k]).forEach(k => rows.push(`<label class="tradeRow">${RULES[k].icon} ${RULES[k].name} <span class="muted">(has ${ab[k]})</span><input type="number" min="0" max="${ab[k]}" value="0" data-${prefix}-ab="${k}"></label>`));
  Object.keys(sk).filter(k => sk[k] > 0 && SKINS[k]).forEach(k => rows.push(`<label class="tradeRow">🎨 ${SKINS[k].name} <span class="muted">(has ${sk[k]})</span><input type="number" min="0" max="${sk[k]}" value="0" data-${prefix}-sk="${k}"></label>`));
  return `<label class="tradeRow">⭐ Points <span class="muted">(has ${prof.points || 0})</span><input type="number" min="0" max="${prof.points || 0}" value="0" data-${prefix}-pts></label>` + rows.join("");
}
function renderTradeForm() {
  el("tradeForm").innerHTML = `<div class="tradeCols"><div class="col"><h4>You give</h4>${invInputs("give", PROFILE)}</div>
      <div class="col"><h4>You get from ${esc(tradeTarget.username)}</h4>${invInputs("want", tradeTarget)}</div></div>
    <button id="sendTradeBtn">Send trade request · ⭐ ${ECON.TRADE_COST}</button>
    <div class="muted small">Sending costs ${ECON.TRADE_COST} points. If they accept, both sides swap at the same moment. Nothing leaves your account until then.</div>`;
  el("sendTradeBtn").onclick = sendTrade;
}
function readBundle(prefix) {
  const b = { points: 0, abilities: {}, skins: {} };
  const p = document.querySelector(`[data-${prefix}-pts]`); if (p) b.points = +p.value || 0;
  document.querySelectorAll(`[data-${prefix}-ab]`).forEach(i => { if (+i.value > 0) b.abilities[i.getAttribute(`data-${prefix}-ab`)] = +i.value; });
  document.querySelectorAll(`[data-${prefix}-sk]`).forEach(i => { if (+i.value > 0) b.skins[i.getAttribute(`data-${prefix}-sk`)] = +i.value; });
  return b;
}
async function sendTrade() {
  if (busy || !tradeTarget) return;
  busy = true;
  try {
    const r = await api("tradeSend", { to: tradeTarget.username, give: readBundle("give"), want: readBundle("want") });
    setProfile(r.me); toast("Trade request sent!");
    el("tradeForm").innerHTML = ""; el("tradeUser").value = ""; tradeTarget = null; refreshTrades();
  } catch (e) { toast(e.message, true); }
  busy = false;
}
async function tradeAction(op, args, msg) {
  if (busy) return;
  busy = true;
  try { const r = await api(op, args); setProfile(r.me); toast(msg); refreshTrades(); } catch (e) { toast(e.message, true); }
  busy = false;
}
async function refreshTrades() { try { trades = await api("trades"); renderTrades(); } catch (e) {} }
const STATUS_TEXT = { pending: "⏳ waiting", accepted: "✅ accepted", done: "✅ done", declined: "❌ declined", closed: "❌ declined", cancelled: "🚫 cancelled" };
function renderTrades() {
  if (!PROFILE) return;
  const inc = trades.incoming.filter(t => t.status === "pending").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  el("tradeBadge").textContent = inc.length ? `(${inc.length})` : "";
  el("incomingTrades").innerHTML = inc.length ? inc.map(t => `<div class="tradeItem">
      <div><b>${esc(t.fromName)}</b> gives: ${bundleText(t.give)}<br>and wants: ${bundleText(t.want)}</div>
      <div class="row"><button data-accept="${t.id}">Accept</button><button class="secondary" data-decline="${t.id}">Decline</button></div></div>`).join("") : "<div class='muted'>No trade requests.</div>";
  const out = trades.outgoing.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
  el("outgoingTrades").innerHTML = out.length ? out.map(t => `<div class="tradeItem">
      <div>To <b>${esc(t.toName)}</b>: you give ${bundleText(t.give)}, you get ${bundleText(t.want)}<br><span class="muted">${STATUS_TEXT[t.status] || t.status}</span></div>
      ${t.status === "pending" ? `<button class="secondary" data-cancel="${t.id}">Cancel</button>` : ""}</div>`).join("") : "<div class='muted'>You haven't sent any trades.</div>";
  document.querySelectorAll("[data-accept]").forEach(b => b.onclick = () => tradeAction("tradeAnswer", { id: b.dataset.accept, accept: true }, "Trade done! 🤝"));
  document.querySelectorAll("[data-decline]").forEach(b => b.onclick = () => tradeAction("tradeAnswer", { id: b.dataset.decline, accept: false }, "Trade declined"));
  document.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => tradeAction("tradeCancel", { id: b.dataset.cancel }, "Trade cancelled"));
}

// ---------------------------------------------------------------- High Risk
async function refreshRisk() { try { riskGames = await api("riskList"); renderRisk(); } catch (e) {} }
function renderRisk() {
  if (!PROFILE) return;
  const pts = PROFILE.points || 0;
  el("riskGames").innerHTML = riskGames.length ? riskGames.slice().sort((a, b) => b.createdAt - a.createdAt).map(g => {
    const full = g.humans >= 6, poor = pts < g.stake;
    return `<div class="tradeItem"><div><b>${esc(g.host)}</b>'s game · stake <b>⭐ ${g.stake}</b> · ${g.humans}/6 players</div>
      <button type="button" data-risk-join="${esc(g.key)}" ${full || poor ? "disabled" : ""}>${full ? "Full" : poor ? "Not enough points" : "Join"}</button></div>`;
  }).join("") : "<div class='muted'>No High Risk games open right now. Make one!</div>";
  document.querySelectorAll("[data-risk-join]").forEach(b => b.onclick = () => enterRoom(async () => (await api("riskJoin", { key: b.dataset.riskJoin })).key));
}
el("riskCreateBtn").onclick = () => {
  const stake = Math.floor(+el("riskStake").value || 0);
  if (stake < ECON.RISK_MIN_STAKE) { toast(`Stake must be at least ${ECON.RISK_MIN_STAKE}`, true); return; }
  if (stake > (PROFILE.points || 0)) { toast("You don't have that many points", true); return; }
  enterRoom(async () => (await api("riskCreate", { stake })).key);
};

// ---------------------------------------------------------------- animated skin previews in the menu
(function previewLoop() {
  const t = performance.now();
  document.querySelectorAll("canvas.skinprev").forEach(cv => {
    if (!cv.offsetParent) return;
    const c = cv.getContext("2d"), s = cv.width;
    c.clearRect(0, 0, s, s);
    drawSkin(c, cv.dataset.skin, 0, 0, s, "#4fc3f7", t);
  });
  requestAnimationFrame(previewLoop);
})();
