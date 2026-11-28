// ======================================================================
//  app.js: login, menus, shop, inventory, trading, High Risk list.
//  Every change goes through the server (api(...)); nothing here can
//  change an account by itself.
// ======================================================================
const EMAIL_DOMAIN = "@clapcatch.game";   // players never see this; it just lets Firebase store username logins
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
let PROFILE = null, pendingSignupName = null, busy = false, tutAutoShown = false, newsAutoShown = false;
let trades = { incoming: [], outgoing: [] }, riskGames = [];

const el = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg, bad) {
  const t = el("toast");
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = "", 2800);
}
function showScreen(name) { ["authScreen", "menuScreen", "game", "banScreen", "miniScreen"].forEach(id => el(id).hidden = id !== name); }
function setProfile(p) { if (!p) return; PROFILE = p; if (p.update3 && typeof setU3 === "function") setU3(true); if (!checkBan()) renderAll(); }
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
  if (signup && typeof U3 !== "undefined" && U3 && badName(u)) { el("authErr").textContent = "That username isn't allowed. Pick another one."; return; }
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
    // "Next level" in Story: the page reloaded, now open that level
    let nextLv = 0; try { nextLv = +sessionStorage.getItem("cc_next_story") || 0; sessionStorage.removeItem("cc_next_story"); } catch (e) {}
    if (nextLv && !inGame && el("banScreen").hidden && STORY_LEVELS[nextLv - 1]) openNextStory(nextLv, 4);
    let again = 0; try { again = +sessionStorage.getItem("cc_next_rogue") || 0; sessionStorage.removeItem("cc_next_rogue"); } catch (e) {}
    let maker = 0; try { maker = +sessionStorage.getItem("cc_open_maker") || 0; sessionStorage.removeItem("cc_open_maker"); } catch (e) {}
    if (maker && !inGame && PROFILE.story4Unlocked) setTimeout(() => openMaker(), 300);
    if (again && !nextLv && !inGame && el("banScreen").hidden) enterRoom(async () => rogueRoomKey());
    let miniAgain = 0; try { miniAgain = +sessionStorage.getItem("cc_mini_again") || 0; sessionStorage.removeItem("cc_mini_again"); } catch (e) {}
    loadMiniInfo().then(() => { if (miniAgain && !inGame && el("banScreen").hidden) playMini(); });
    if (p.tutorialDone === false && !tutAutoShown) { tutAutoShown = true; openTutorial(true, p.tutorialSeenBefore); }
    if (p.whatsNew && !newsAutoShown && !inGame) { newsAutoShown = true; el("newsModal").style.display = "flex"; }      // "What's new" page: players who have played before, once
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
  if (currentTab === "quests" || currentTab === "level") api("me").then(setProfile).catch(() => {});
  if (currentTab === "leaders") loadLeaders().then(renderLeaders);
  if (currentTab === "shop" && PROFILE) renderShop();
  if (currentTab === "weekly" && typeof refreshWeekly === "function") refreshWeekly();
  if (currentTab === "maker") makerShown();
});
let ogTried = false;
function renderAll() {
  if (!PROFILE) return;
  el("whoami").textContent = "👤 " + PROFILE.username + (PROFILE.level ? " · Lv " + PROFILE.level.level : "");
  el("pointsLbl").textContent = "⭐ " + PROFILE.points + " points";
  el("gamePoints").textContent = "⭐ " + PROFILE.points;
  renderPlay(); renderShop(); renderInventory(); renderTrades(); renderRisk(); renderEvent(); renderPlatinum(); renderQuests(); renderLevel();
  if (PROFILE.update3 && typeof renderU3 === "function") renderU3();
  if (!OG_SKINS && !ogTried) { ogTried = true; loadOgSkins().then(d => { if (d && Object.keys(d).length && PROFILE) { renderInventory(); renderQuests(); } }); }
  friendBadge(PROFILE.friendIn || 0, PROFILE.dmUnread || 0);
  showNotices();
}
// ---------------------------------------------------------------- messages (e.g. board results)
function showNotices() {
  const n = PROFILE.notices || [];
  if (!n.length || inGame || el("noticeModal").style.display === "flex") return;
  el("noticeList").innerHTML = n.map(x => `<div class="notice ${x.big ? "big" : ""}">${esc(x.msg)}</div>`).join("");
  el("noticeModal").style.display = "flex";
}
el("newsClose").onclick = () => { el("newsModal").style.display = "none"; if (PROFILE) PROFILE.whatsNew = false; api("newsSeen").then(setProfile).catch(() => {}); };
el("noticeClose").onclick = () => { el("noticeModal").style.display = "none"; PROFILE.notices = []; api("noticesSeen").then(setProfile).catch(() => {}); };

// ---------------------------------------------------------------- friends
let friendData = { friends: [], incoming: [], outgoing: [] };
async function refreshFriends() { try { friendData = await api("friendsList"); renderFriends(); } catch (e) {} }
function gameLabel(g) {
  if (!g) return "";
  if (g.type === "solo") return "playing on their own (Story or Bot Grind)";
  if (g.type === "pub") return `in a matchmade game (${g.humans}/6)`;
  if (g.type === "risk") return g.state === "lobby" ? `in a High Risk lobby, stake ⭐ ${g.stake} (${g.humans}/6)` : "in a High Risk game (started)";
  return `in a private room (${g.humans}/6)`;
}
function renderFriends() {
  const d = friendData;
  friendBadge(d.incoming.length, d.friends.reduce((n, f) => n + (f.unread || 0), 0));
  el("friendInCard").hidden = !d.incoming.length;
  el("friendIn").innerHTML = d.incoming.map(f => `<div class="tradeItem"><div>👋 <b>${esc(f.username)}</b> wants to be friends</div>
    <div class="row"><button type="button" data-fr-yes="${esc(f.uid)}">Accept</button><button type="button" class="secondary" data-fr-no="${esc(f.uid)}">Decline</button></div></div>`).join("");
  el("friendOutCard").hidden = !d.outgoing.length;
  el("friendOut").innerHTML = d.outgoing.map(f => `<div class="tradeItem"><div>⏳ <b>${esc(f.username)}</b> hasn't answered yet</div>
    <button type="button" class="secondary" data-fr-cancel="${esc(f.uid)}">Cancel</button></div>`).join("");
  const order = f => f.game ? 0 : f.online ? 1 : 2;
  el("friendList").innerHTML = d.friends.length ? d.friends.slice().sort((a, b) => order(a) - order(b) || a.username.localeCompare(b.username)).map(f => {
    const canJoin = f.game && f.game.type !== "solo" && !(f.game.type === "risk" && f.game.state !== "lobby") && f.game.humans < 6;
    return `<div class="tradeItem"><div><span class="dot ${f.game ? "ingame" : f.online ? "on" : ""}"></span><b>${esc(f.username)}</b>
      <span class="tag">Level ${f.level || 1}</span> <span class="muted small">${f.game ? gameLabel(f.game) : f.online ? "online" : "offline"}</span></div>
      <div class="row">${f.game ? `<button type="button" data-fr-join="${esc(f.uid)}" ${canJoin ? "" : "disabled"}>${canJoin ? "Join" : "Can't join"}</button>` : ""}
      <button type="button" class="secondary small" data-fr-chat="${esc(f.uid)}" data-name="${esc(f.username)}">💬 Chat${f.unread ? ` <span class="unread">${f.unread}</span>` : ""}</button>
      ${PROFILE.world4 ? `<button type="button" class="secondary small" data-fr-levels="${esc(f.uid)}">🏁 Levels beaten</button>` : ""}
      <button type="button" class="ghost small" data-fr-remove="${esc(f.uid)}" data-name="${esc(f.username)}">Remove</button></div></div>`;
  }).join("") : "<div class='muted'>No friends yet. Add someone by their username!</div>";
  const act = (op, args, msg) => api(op, args).then(() => { if (msg) toast(msg); refreshFriends(); }).catch(e => toast(e.message, true));
  document.querySelectorAll("[data-fr-yes]").forEach(b => b.onclick = () => act("friendAnswer", { uid: b.dataset.frYes, accept: true }, "New friend! 🎉"));
  document.querySelectorAll("[data-fr-no]").forEach(b => b.onclick = () => act("friendAnswer", { uid: b.dataset.frNo, accept: false }));
  document.querySelectorAll("[data-fr-cancel]").forEach(b => b.onclick = () => act("friendCancel", { uid: b.dataset.frCancel }));
  document.querySelectorAll("[data-fr-remove]").forEach(b => b.onclick = () => { if (confirm(`Remove ${b.dataset.name} from your friends?`)) act("friendRemove", { uid: b.dataset.frRemove }, "Removed"); });
  document.querySelectorAll("[data-fr-chat]").forEach(b => b.onclick = () => openDm(b.dataset.frChat, b.dataset.name));
  document.querySelectorAll("[data-fr-join]").forEach(b => b.onclick = () => enterRoom(async () => (await api("joinFriend", { uid: b.dataset.frJoin })).key));
  document.querySelectorAll("[data-fr-levels]").forEach(b => b.onclick = () => showBeaten(b.dataset.frLevels));
}
// a friend's beaten Level Maker levels (newest first, last 50)
async function showBeaten(uid) {
  el("flvTitle").textContent = "🏁 Levels beaten"; el("flvList").innerHTML = "<div class='muted small'>Loading…</div>"; el("flvModal").style.display = "flex";
  try {
    const r = await api("friendLevels", { uid });
    el("flvTitle").textContent = `🏁 Levels ${r.username} has beaten`;
    el("flvList").innerHTML = r.beaten.length ? r.beaten.map(x => `<div class="mkRow"><span><b>${esc(x.n)}</b> <span class="muted small">${x.by ? "by " + esc(x.by) + " · " : ""}${new Date(x.at).toLocaleDateString()}</span></span></div>`).join("")
      : `<div class='muted'>${esc(r.username)} hasn't beaten any made levels yet.</div>`;
  } catch (e) { el("flvList").innerHTML = `<div class='muted'>${esc(e.message)}</div>`; }
}
el("flvClose").onclick = () => { el("flvModal").style.display = "none"; };
function friendBadge(requests, unread) {
  el("friendBadge").textContent = requests + unread ? `(${requests + unread})` : "";
}
// chatting with a friend: the server keeps the last 10 messages between you two
let dmWith = null, dmTimer = null, dmLastSig = "", dmTick = 0;
async function openDm(uid, name) {
  dmWith = uid; dmLastSig = "";
  el("dmTitle").textContent = "💬 " + name;
  el("dmList").innerHTML = "<div class='muted small'>Loading…</div>";
  el("dmModal").style.display = "flex"; el("dmInput").value = ""; el("dmInput").focus();
  await loadDm();
  const f = friendData.friends.find(x => x.uid === uid); if (f && f.unread) { f.unread = 0; renderFriends(); }
  clearInterval(dmTimer); dmTick = 0; dmTimer = setInterval(() => { if (!document.hidden && (!HUB_OK || ++dmTick % 8 === 0)) loadDm(); }, 4000);   // with the hub, new messages are pushed
}
function closeDm() { dmWith = null; clearInterval(dmTimer); el("dmModal").style.display = "none"; refreshFriends(); }
async function loadDm(data) {
  const who = dmWith; if (!who) return;
  try {
    const d = data || await api("dmGet", { with: who });
    if (who !== dmWith) return;
    const sig = JSON.stringify(d.msgs); if (sig === dmLastSig) return; dmLastSig = sig;
    const box = el("dmList");
    box.innerHTML = d.msgs.length ? d.msgs.map(m => `<div class="dm ${m.f === PROFILE.uid ? "mine" : ""}"><div>${esc(m.m)}</div><span>${new Date(m.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>`).join("")
      : "<div class='muted small'>No messages yet. Say hi! 👋</div>";
    box.scrollTop = box.scrollHeight;
  } catch (e) { toast(e.message, true); closeDm(); }
}
async function sendDm() {
  const text = el("dmInput").value.trim(); if (!text || !dmWith) return;
  el("dmInput").value = "";
  try { await loadDm(await api("dmSend", { with: dmWith, text })); }
  catch (e) { toast(e.message, true); el("dmInput").value = text; }
}
el("dmSend").onclick = sendDm;
el("dmInput").onkeydown = e => { if (e.key === "Enter") sendDm(); if (e.key === "Escape") closeDm(); };
el("dmClose").onclick = closeDm;
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
  el("makerTabBtn").hidden = !PROFILE.story4Unlocked;   // beating World 4 unlocks the Level Maker tab
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
setInterval(() => { if (PROFILE && !inGame && !document.hidden && (!HUB_OK || Date.now() - HUB_LAST_ME > 300000)) { HUB_LAST_ME = Date.now(); api("me").then(setProfile).catch(() => {}); } }, 45000);   // notice events starting/stopping
// keep lists fresh while you're looking at them
let listTick = 0;
setInterval(() => {
  if (!PROFILE || inGame || document.hidden) return;
  if (HUB_OK && ++listTick % 5) return;   // with the hub: every 30s instead of 6s (friends/trades also refresh when poked)
  if (currentTab === "trade") refreshTrades();
  if (currentTab === "risk") refreshRisk();
  if (currentTab === "friends") refreshFriends();
  if (currentTab === "board") refreshBoard();
}, 6000);
setInterval(() => { if (PROFILE && !inGame && !document.hidden && !HUB_OK) refreshTrades(); }, 30000);

// ---------------------------------------------------------------- play
let chosenMode = "casual";
document.querySelectorAll(".mode").forEach(m => m.onclick = () => { chosenMode = m.dataset.mode; renderPlay(); });
el("roomCode").value = localStorage.getItem("cc_room") || "";
el("joinBtn").onclick = joinFromMenu;
el("roomCode").addEventListener("keydown", e => { if (e.key === "Enter") joinFromMenu(); });
function renderPlay() {
  document.querySelectorAll(".mode").forEach(m => m.classList.toggle("active", m.dataset.mode === chosenMode));
  const comp = chosenMode === "competitive", story = chosenMode === "story", grind = chosenMode === "grind";
  el("matchBox").hidden = !comp; el("privateWarn").hidden = !comp;
  el("privateBox").hidden = story || grind; el("storyBox").hidden = !story; el("grindBox").hidden = !grind;
  if (story) renderStory();
  el("joinBtn").textContent = comp ? "Join private room" : "Join room";
  const cd = PROFILE.teamCooldown;
  el("teamNote").textContent = (comp && cd && cd.left > 0)
    ? `You've played 3 matchmade games in a row with the same people, so Find a match will keep you apart for ${cd.left} more game${cd.left > 1 ? "s" : ""}.` : "";
  const lo = PROFILE.loadout || [];
  el("loadoutSummary").innerHTML = !(comp || grind) ? "" :
    `<b>Your loadout:</b> ${lo.length ? lo.map((id, i) => `<kbd>${keyName(abilityKey(i))}</kbd> ${RULES[id].icon} ${RULES[id].name}`).join(" &nbsp; ") : "<span class='muted'>nothing equipped. Buy packs in the Shop, then equip up to 3 in Inventory.</span>"}`;
}
// "Next level": if the server is still saving the last win, wait a moment and try again
async function openNextStory(lv, tries) {
  showScreen("game");
  try { await joinGame(storyRoomKey(lv)); }
  catch (e) {
    if (/Beat level/.test(e.message) && tries > 0) return void setTimeout(() => openNextStory(lv, tries - 1), 1200);
    showScreen("menuScreen"); toast(e.message, true);
  }
}
async function enterRoom(getKey) {
  showScreen("game");
  try { const key = await getKey(); await joinGame(key); }
  catch (e) { showScreen("menuScreen"); toast(e.message, true); }
}
function renderStory() {
  const done = PROFILE.storyDone || [], paid = PROFILE.storyPaid || [];
  const row = (L, i) => {
    const n = i + 1, cleared = done.includes(n), open = n === 1 || done.includes(n - 1);
    const note = cleared ? "✅ Beaten" : !open ? "Beat the level before to unlock" : paid.includes(n) ? "Beaten before the update (no points again)" : "+20 points the first time you beat it";
    return `<div class="storyLevel ${cleared ? "cleared" : open ? "open" : "locked"}"><div class="storyIcon">${open || cleared ? L.icon : "🔒"}</div>
      <div><b>${n}. ${L.name}</b><div class="muted small">${note}</div></div>
      <button type="button" data-story="${n}" ${open ? "" : "disabled"}>${cleared ? "Play again" : "Play"}</button></div>`;
  };
  const w1 = STORY_LEVELS.filter(L => L.world === 1), w2 = STORY_LEVELS.filter(L => L.world === 2);
  let html = (PROFILE.storyReset && !done.includes(STORY_W1) ? `<div class="warn">📖 Story mode got bigger: 10 levels now! Everyone starts again from level 1, and every level pays +20 again. The story packs are locked again until you beat the new boss, but anything you already got from them stays in your inventory.</div>` : "")
    + `<h3 class="worldHead">🌍 World 1: Get your power back</h3>` + w1.map(row).join("")
    + (PROFILE.storyUnlocked ? `<div class="muted small" style="margin:8px 0">👑 You beat the boss! The Titan Pack and 3 new skin packs are in your Shop.</div>` : "");
  if (PROFILE.world2) {
    html += `<h3 class="worldHead">🌒 World 2: The Shadow League</h3>`
      + (done.includes(STORY_W1) ? w2.map((L, i) => row(L, i + STORY_W1)).join("") : `<div class="muted small">🔒 Beat the World 1 boss (level 10) to open World 2.</div>`)
      + (PROFILE.story2Unlocked ? `<div class="muted small" style="margin-top:8px">🦹 You beat the Captain! The Shadow Pack is in your Shop and you get 2 extra daily quests.</div>` : "");
    if (PROFILE.update3 && PROFILE.world3 !== false && typeof storyW3Html === "function") html += storyW3Html(row);
    if (PROFILE.update3 && PROFILE.world3 !== false && PROFILE.world4 && typeof storyW4Html === "function") html += storyW4Html(row);
    if (PROFILE.update3 && typeof bossRushHtml === "function") html += bossRushHtml();      // always at the bottom
  }
  el("storyLevels").innerHTML = html;
  document.querySelectorAll("[data-story]").forEach(b => b.onclick = () => enterRoom(async () => storyRoomKey(+b.dataset.story)));
}
document.querySelectorAll("[data-grind]").forEach(b => b.onclick = () => enterRoom(async () => "GRIND" + b.dataset.grind + Math.random().toString(36).slice(2, 8).toUpperCase()));

// ---------------------------------------------------------------- Daily quests
const QUEST_ICON = { win: "🏆", play: "🎮", elim: "💥", mode: "🗺️", storywin: "🌒", rare: "🎁" };
function renderQuests() {
  const Q = PROFILE.quests; if (!Q) return;
  const ready = Q.list.filter(q => q.progress >= q.target && !q.claimed).length;
  el("questBadge").textContent = ready ? `(${ready})` : "";
  el("questList").innerHTML = ogQuestHtml() + annQuestHtml() + Q.list.map((q, i) => {
    const pct = Math.round(100 * Math.min(1, q.progress / q.target)), done = q.progress >= q.target;
    const icon = q.kind === "mode" ? (q.mode.startsWith("grind") ? "🤖" : "📖") : QUEST_ICON[q.kind];
    return `<div class="card quest ${q.claimed ? "claimed" : done ? "ready" : ""}"><div class="questTop"><span class="platIcon">${icon}</span>
      <div style="flex:1"><b>${esc(q.text)}</b><div class="muted small">Reward: ⭐ ${q.reward}</div></div></div>
      <div class="questBar"><div style="width:${pct}%"></div></div>
      <div class="row" style="justify-content:space-between"><span class="small">${q.progress} / ${q.target}</span>
      ${q.claimed ? `<span class="small" style="color:#7ee787">✅ Claimed</span>` : `<button type="button" data-quest="${i}" ${done ? "" : "disabled"}>Claim ⭐ ${q.reward}</button>`}</div></div>`;
  }).join("");
  const ogb = el("ogUnlockBtn");
  if (ogb) ogb.onclick = async () => {
    if (busy) return; busy = true;
    try { const r = await api("ogUnlock"); toast("Your OG skin is unlocked!"); playTone(990, 0.3, "triangle", 0.15); setProfile(r); }
    catch (e) { toast(e.message, true); } finally { busy = false; }
  };
  const annb = el("annUnlockBtn");
  if (annb) annb.onclick = async () => {
    if (busy) return; busy = true;
    try { const r = await api("annUnlock"); toast("Announcements unlocked!"); playTone(990, 0.3, "triangle", 0.15); setProfile(r); }
    catch (e) { toast(e.message, true); } finally { busy = false; }
  };
  document.querySelectorAll("[data-quest]").forEach(b => b.onclick = async () => {
    if (busy) return; busy = true;
    try { const r = await api("questClaim", { i: +b.dataset.quest }); toast(`+${r.reward} points!`); playTone(990, 0.3, "triangle", 0.15); setProfile(r.me); }
    catch (e) { toast(e.message, true); } finally { busy = false; }
  });
  questClock();
}
// ---------------------------------------------------------------- Level up
function renderLevel() {
  const L = PROFILE.level; if (!L || !el("levelBox")) return;
  el("levelBadge").textContent = L.ready ? "(!)" : "";
  const done = L.quests.filter(q => q.prog >= q.target).length;
  el("levelBox").innerHTML = `<div class="card levelCard ${L.ready ? "ready" : ""}">
    <div class="levelHead"><div class="levelBadge"><small>LEVEL</small><b>${L.level}</b></div>
      <div style="flex:1"><b>Level ${L.level} quests</b><div class="muted small">${done} of 3 done. Finish all 3 to reach level ${L.next}.${L.level >= 50 ? " Past level 50 the quests repeat and get harder every level." : ""}</div></div></div>
    ${L.quests.map(q => `<div class="levelTask ${q.prog >= q.target ? "done" : ""}"><div class="small"><span>${q.icon} ${esc(q.text)}</span><span>${q.prog >= q.target ? "✅ " : ""}${q.prog} / ${q.target}</span></div>
      <div class="questBar"><div style="width:${Math.round(100 * Math.min(1, q.prog / q.target))}%"></div></div></div>`).join("")}
    <div class="levelFoot"><span class="small">Reward for level ${L.next}: ⭐ ${L.reward}</span>
      <button type="button" id="levelUpBtn" ${L.ready ? "" : "disabled"}>Level Up · ⭐ ${L.reward}</button></div></div>`;
  el("levelUpBtn").onclick = async () => {
    if (busy) return; busy = true;
    try { const r = await api("levelUp"); toast(`Level ${r.level}! +${r.reward} points`); playTone(990, 0.3, "triangle", 0.15); setProfile(r.me); }
    catch (e) { toast(e.message, true); } finally { busy = false; }
  };
}
// the OG skin quest: only for its player, and only once bajajhamish has set their picture
function ogQuestHtml() {
  const o = PROFILE.og; if (!o) return "";
  const g = Math.min(o.games, o.needGames), w = Math.min(o.wins, o.needWins), ready = g >= o.needGames && w >= o.needWins;
  const bar = (n, of) => `<div class="questBar"><div style="width:${Math.round(100 * n / of)}%"></div></div>`;
  return `<div class="card quest ogQuest ${o.owned ? "claimed" : ready ? "ready" : ""}"><div class="questTop"><canvas class="skinprev" data-skin="${o.id}" width="46" height="46"></canvas>
      <div style="flex:1"><b>OG skin</b><div class="muted small">${esc(o.name || "Your OG skin")}. Only you can get this one.</div></div></div>
    <div class="small">Play games (any kind): ${g} / ${o.needGames}</div>${bar(g, o.needGames)}
    <div class="small">Win matchmade Competitive games: ${w} / ${o.needWins}</div>${bar(w, o.needWins)}
    <div class="row" style="justify-content:space-between"><span class="small">Then pay ⭐ ${o.cost}</span>
    ${o.owned ? `<span class="small" style="color:#7ee787">Unlocked. Wear it from your Inventory.</span>` : `<button type="button" id="ogUnlockBtn" ${ready && (PROFILE.points || 0) >= o.cost ? "" : "disabled"}>Unlock · ⭐ ${o.cost}</button>`}</div></div>`;
}
// kythor's quest: same tasks as the OG skin quest but twice the wins. It unlocks the Announcements tab in his admin panel.
function annQuestHtml() {
  const o = PROFILE.annQuest; if (!o) return "";
  const g = Math.min(o.games, o.needGames), w = Math.min(o.wins, o.needWins), ready = g >= o.needGames && w >= o.needWins;
  const bar = (n, of) => `<div class="questBar"><div style="width:${Math.round(100 * n / of)}%"></div></div>`;
  return `<div class="card quest ogQuest ${o.owned ? "claimed" : ready ? "ready" : ""}"><div class="questTop"><span class="platIcon">📢</span>
      <div style="flex:1"><b>Announcements</b><div class="muted small">Unlocks the Announcements tab in your admin panel (press P).</div></div></div>
    <div class="small">Play games (any kind): ${g} / ${o.needGames}</div>${bar(g, o.needGames)}
    <div class="small">Win matchmade Competitive games: ${w} / ${o.needWins}</div>${bar(w, o.needWins)}
    <div class="row" style="justify-content:space-between"><span class="small">Then pay ⭐ ${o.cost}</span>
    ${o.owned ? `<span class="small" style="color:#7ee787">Unlocked. Find it in the admin panel.</span>` : `<button type="button" id="annUnlockBtn" ${ready && (PROFILE.points || 0) >= o.cost ? "" : "disabled"}>Unlock · ⭐ ${o.cost}</button>`}</div></div>`;
}
// tiny countdown in the top-left corner of the Free Daily Pack: next leaderboard check (midnight, when quests reset too)
setInterval(() => {
  const Q = PROFILE && PROFILE.quests, t = el("lbCheckTimer"); if (!Q || !t) return;
  const ms = Math.max(0, Q.resetsAt - (Date.now() + clockSkew)), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  t.textContent = isFinite(ms) ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : "";
}, 1000);
function questClock() {
  const Q = PROFILE && PROFILE.quests; if (!Q) return;
  const left = Q.resetsAt - (Date.now() + clockSkew);
  el("questReset").textContent = left > 0 ? `New quests in ${timeLeft(left)}.` : "New quests are ready!";
}
setInterval(() => { questClock(); if (PROFILE && PROFILE.quests && Date.now() + clockSkew > PROFILE.quests.resetsAt + 2000 && !inGame) { PROFILE.quests.resetsAt = Infinity; api("me").then(setProfile).catch(() => {}); } }, 30000);

// ---------------------------------------------------------------- Platinum tab
function renderPlatinum() {
  const ab = PROFILE.abilities || {};
  const ids = Object.keys(PLATINUM).filter(id => ab[id] > 0);
  el("platList").innerHTML = ids.length ? ids.map(id => {
    const R = RULES[id], P2 = RULES["plat_" + id], have = ab["plat_" + id] || 0;
    return `<div class="platItem"><div class="platTop"><span class="platIcon">${R.icon}</span><div><b>${R.name}</b> ${rarityTag(abilityRarity(id))} <span class="muted small">you have ${ab[id]}</span>
        ${have ? `<div class="small" style="color:#b9f2ff">💎 You own ${have} Platinum</div>` : ""}</div></div>
      <div class="small platBonus"><b style="color:#b9f2ff">💎 Platinum:</b> ${PLATINUM[id]}</div>
      <button type="button" data-plat="${id}">Risk 1 ${R.name}</button></div>`;
  }).join("") : "<div class='card muted'>You don't have any abilities to risk yet. Get some from the Shop!</div>";
  document.querySelectorAll("[data-plat]").forEach(b => b.onclick = () => riskPlatinum(b.dataset.plat));
  // Diamond: risk a Platinum
  const pids = Object.keys(DIAMOND).filter(id => ab["plat_" + id] > 0);
  el("diaList").innerHTML = pids.length ? pids.map(id => {
    const R = RULES[id], have = ab["dia_" + id] || 0;
    return `<div class="platItem diaItem"><div class="platTop"><span class="platIcon">${R.icon}</span><div><b style="color:#b9f2ff">Platinum ${R.name}</b> <span class="muted small">you have ${ab["plat_" + id]}</span>
        ${have ? `<div class="small" style="color:#7df9ff">🔷 You own ${have} Diamond</div>` : ""}</div></div>
      <div class="small platBonus"><b style="color:#7df9ff">🔷 Diamond:</b> ${DIAMOND[id]}</div>
      <button type="button" data-dia="${id}">Risk 1 Platinum ${R.name}</button></div>`;
  }).join("") : "<div class='card muted'>You don't have any Platinum abilities yet. Make one above first!</div>";
  document.querySelectorAll("[data-dia]").forEach(b => b.onclick = () => riskDiamond(b.dataset.dia));
}
async function riskDiamond(id) {
  const R = RULES[id];
  if (!confirm(`Risk 1 Platinum ${R.name}?\n\n20%: it becomes Diamond ${R.name}.\n80%: it stops being Platinum (you get a normal ${R.name} back).`)) return;
  if (busy) return; busy = true;
  el("rollModal").style.display = "flex"; el("rollClose").hidden = true;
  el("rollTitle").textContent = `Diamond-ising ${R.name}…`;
  el("rollBox").innerHTML = `<div class="platSpin diaSpin">${R.icon}</div><div id="rollResult"></div>`;
  let r;
  try { r = await api("diamondRisk", { id }); }
  catch (e) { el("rollModal").style.display = "none"; busy = false; toast(e.message, true); return; }
  setTimeout(() => {
    el("rollBox").querySelector(".platSpin").classList.add(r.win ? "win" : "lose");
    el("rollTitle").innerHTML = r.win ? `<span style="color:#7df9ff">🔷 DIAMOND!</span>` : "It lost its shine…";
    el("rollResult").innerHTML = r.win ? `<div class="rollName" style="color:#7df9ff">Diamond ${esc(R.name)}</div><div class="small">${DIAMOND[id]}</div>` : `<div class="muted">Your Platinum ${esc(R.name)} is a normal ${esc(R.name)} again.</div>`;
    playTone(r.win ? 1500 : 180, r.win ? 0.7 : 0.5, r.win ? "triangle" : "sawtooth", 0.2);
    el("rollClose").hidden = false; setProfile(r.me); busy = false;
  }, 2600);
}
async function riskPlatinum(id) {
  const R = RULES[id], last = (PROFILE.abilities[id] || 0) === 1;
  if (!confirm(`Risk 1 ${R.name}?\n\n10%: it becomes Platinum ${R.name}.\n90%: it's gone forever.${last ? "\n\nThis is your LAST one." : ""}`)) return;
  if (busy) return; busy = true;
  el("rollModal").style.display = "flex"; el("rollClose").hidden = true;
  el("rollTitle").textContent = `Platinum-ising ${R.name}…`;
  el("rollBox").innerHTML = `<div class="platSpin">${R.icon}</div><div id="rollResult"></div>`;
  let r;
  try { r = await api("platinumRisk", { id }); }
  catch (e) { el("rollModal").style.display = "none"; busy = false; toast(e.message, true); return; }
  setTimeout(() => {
    el("rollBox").querySelector(".platSpin").classList.add(r.win ? "win" : "lose");
    el("rollTitle").innerHTML = r.win ? `<span style="color:#b9f2ff">💎 PLATINUM!</span>` : "It shattered…";
    el("rollResult").innerHTML = r.win ? `<div class="rollName" style="color:#b9f2ff">Platinum ${esc(R.name)}</div><div class="small">${PLATINUM[id]}</div>` : `<div class="muted">Your ${esc(R.name)} is gone. Better luck next time!</div>`;
    playTone(r.win ? 1320 : 180, r.win ? 0.6 : 0.5, r.win ? "triangle" : "sawtooth", 0.2);
    el("rollClose").hidden = false; setProfile(r.me); busy = false;
  }, 2600);
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
  el("abilityPacks").innerHTML = (lucky ? `<div class="warn" style="grid-column:1/-1">🍀 <b>Lucky Event:</b> legendary items are 1.5% more likely!</div>` : "") + Object.entries(ABILITY_PACKS).filter(([, p]) => !p.story || (p.story === 2 ? PROFILE.story2Unlocked : PROFILE.storyUnlocked)).map(([pid, p]) => `
    <div class="pack ${p.story ? "storyPack" : ""}"><div class="packHead">${p.icon} <b>${p.name}</b> ${p.story ? '<span class="tag">boss reward</span>' : ""}</div><div class="muted small">${p.theme}</div>
      <ul>${odds(p.items).map(([id, pct, r]) => `<li>${RULES[id].icon} ${RULES[id].name} ${rarityTag(r)} <span class="muted">${pct}%</span></li>`).join("")}</ul>
      <button data-buy-ability="${pid}" ${pts < ECON.PACK_COST ? "disabled" : ""}>Buy · ⭐ ${ECON.PACK_COST}</button></div>`).join("") + freePackHtml();
  const skinOdds = odds(SKIN_ODDS.map(o => [o[0], o[1], o[0]]));
  el("skinPacks").innerHTML = Object.entries(SKIN_PACKS).filter(([, p]) => !p.story || PROFILE.storyUnlocked).map(([pid, p]) => `
    <div class="pack ${p.story ? "storyPack" : ""}"><div class="packHead">${p.icon} <b>${p.name}</b> ${p.story ? '<span class="tag">boss reward</span>' : ""}</div>
      <div class="skinRow">${p.skins.map((sid, i) => `<div class="skinCell"><canvas class="skinprev" data-skin="${sid}" width="46" height="46"></canvas>
        <div class="small">${SKINS[sid].name}</div>${rarityTag(skinOdds[i][2])} <span class="muted small">${skinOdds[i][1]}%</span></div>`).join("")}</div>
      <button data-buy-skin="${pid}" ${pts < ECON.SKIN_PACK_COST ? "disabled" : ""}>Buy · ⭐ ${ECON.SKIN_PACK_COST}</button></div>`).join("");
  if (PROFILE.update3 && typeof creatorPackHtml === "function") el("skinPacks").innerHTML += creatorPackHtml(pts);
  document.querySelectorAll("[data-buy-creator]").forEach(b => b.onclick = () => buyPack("creator", "creator"));
  document.querySelectorAll("[data-buy-free]").forEach(b => b.onclick = () => buyPack("lbfree", "free"));
  if (!LB || Date.now() - LB.got > 120000) { if (!lbLoading) { lbLoading = true; loadLeaders().then(() => { lbLoading = false; if (currentTab === "shop") renderShop(); }); } }
  document.querySelectorAll("[data-buy-ability]").forEach(b => b.onclick = () => buyPack("ability", b.dataset.buyAbility));
  document.querySelectorAll("[data-buy-skin]").forEach(b => b.onclick = () => buyPack("skin", b.dataset.buySkin));
}
async function buyPack(kind, pid) {
  if (busy) return;
  busy = true;
  try {
    const r = await api("buy", { kind, pack: pid });
    if (kind === "lbfree") { if (LB && LB.free) LB.free.left = Math.max(0, LB.free.left - 1); showRoll("ability", r.pack, r.prize, r.rarity, r.count, r.me, r.isSkin, r.near); }
    else showRoll(kind, pid, r.prize, r.rarity, r.count, r.me, r.isSkin, r.near);
  }
  catch (e) { toast(e.message, true); busy = false; }
}
// Opening a pack: a strip of items spins past and slows down onto yours. Your item (and the two
// next to it) were already decided by the server; the rest of the strip is just random filler.
const REEL_CELL = 104, REEL_LEN = 46, REEL_AT = 38, REEL_MS = 5600;
function packItems(kind0, pid) {
  const ev = currentEvent(), lucky = ev && ev.id === "lucky";
  let items = kind0 === "limited" ? LIMITED_PACKS[pid].items : kind0 === "ability" ? ABILITY_PACKS[pid].items
    : kind0 === "creator" ? CREATOR_PACK.items : SKIN_PACKS[pid].skins.map((sid, i) => [sid, SKIN_ODDS[i][1], SKIN_ODDS[i][0]]);
  return lucky && kind0 !== "limited" ? luckyOdds(items) : items;
}
function reelCell(id, isSkin) {
  const r = isSkin ? (SKINS[id] && SKINS[id].rarity) || "common" : abilityRarity(id);
  const look = isSkin ? `<canvas class="skinprev" data-skin="${id}" width="56" height="56"></canvas>` : `<div class="reelIcon">${RULES[id].icon}</div>`;
  return `<div class="reelCell r-${r}" style="--rc:${RARITY[r].color}">${look}<div class="reelName">${esc(isSkin ? SKINS[id].name : RULES[id].name)}</div></div>`;
}
function showRoll(kind0, pid, prize, rarity, count, newMe, isSkin, near) {
  const pack = kind0 === "limited" ? LIMITED_PACKS[pid] : kind0 === "ability" ? ABILITY_PACKS[pid] : kind0 === "creator" ? CREATOR_PACK : SKIN_PACKS[pid];
  const skin = kind0 === "skin" || kind0 === "creator" || !!isSkin;
  const items = packItems(kind0, pid), total = items.reduce((a, b) => a + b[1], 0);
  const pickRandom = () => { let r = Math.random() * total; for (const it of items) if ((r -= it[1]) < 0) return it[0]; return items[0][0]; };
  const strip = [];
  for (let i = 0; i < REEL_LEN; i++) strip.push(i === REEL_AT ? prize : i === REEL_AT - 1 && near ? near[0] : i === REEL_AT + 1 && near ? near[1] : pickRandom());
  const box = el("rollBox");
  el("rollModal").style.display = "flex"; el("rollClose").hidden = true;
  el("rollTitle").textContent = `Opening ${pack.name}…`;
  box.innerHTML = `<div class="reel"><div class="reelStrip">${strip.map(id => reelCell(id, skin)).join("")}</div><div class="reelMarker"></div></div><div id="rollResult"></div>`;
  const reel = box.querySelector(".reel"), st = box.querySelector(".reelStrip");
  const viewW = reel.clientWidth || 560;
  const jitter = (Math.random() - 0.5) * REEL_CELL * 0.7;              // land somewhere inside your item, not always dead centre
  const end = REEL_AT * REEL_CELL + REEL_CELL / 2 - viewW / 2 + jitter;
  const t0 = performance.now(); let lastCell = -1;
  (function frame() {
    const k = Math.min(1, (performance.now() - t0) / REEL_MS), e = 1 - Math.pow(1 - k, 4);
    const x = end * e;
    st.style.transform = `translateX(${-x}px)`;
    const cell = Math.floor((x + viewW / 2) / REEL_CELL);
    if (cell !== lastCell) { lastCell = cell; playTone(1400, 0.03, "square", 0.05); }
    if (k < 1) { requestAnimationFrame(frame); return; }
    st.children[REEL_AT].classList.add("won");
    const name = skin ? SKINS[prize].name : RULES[prize].name;
    el("rollTitle").innerHTML = `You got <span class="rar-${rarity}" style="color:${RARITY[rarity].color}">${RARITY[rarity].label}</span>!`;
    if (rarity === "mythical" || rarity === "legendary") { el("rollModal").classList.add("rare-" + rarity); setTimeout(() => el("rollModal").classList.remove("rare-" + rarity), 2500); playTone(880, 0.5, "triangle", 0.2); }
    el("rollResult").innerHTML = `<div class="rollName" style="color:${RARITY[rarity].color}">${skin ? "" : RULES[prize].icon + " "}${esc(name)}</div>` +
      (count > 1 ? `<div class="muted small">You now have ${count}. Extras can be traded!</div>` : "");
    el("rollClose").hidden = false;
    setProfile(newMe);
    busy = false;
  })();
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
  else if (lo.length >= (PROFILE.maxLoadout || 3)) { toast(`You can only equip ${PROFILE.maxLoadout || 3}. Unequip one first.`, true); return; }
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

// ---------------------------------------------------------------- Leaderboard (top 10s) + the free daily pack in the Shop
let LB = null, lbLoading = false;
async function loadLeaders() {
  try { const d = await api("leaderboard"); LB = Object.assign(d, { got: Date.now() }); }
  catch (e) { if (!LB) LB = { boards: {}, free: { allowed: 0, left: 0 }, got: Date.now() }; if (currentTab === "leaders") toast(e.message, true); }
  return LB;
}
const LB_BOARDS = [["compWins", "Most matchmade wins", "wins"], ["rogueBest", "Best Boss Rush level", "level"], ["points", "Most points now", "points"], ["spent", "Most points spent", "spent"], ["level", "🏅 Highest level (number 1 gets an extra free pack)", "level"]];
function renderLeaders() {
  if (!LB) return;
  const mine = PROFILE && PROFILE.username;
  el("lbGrid").innerHTML = LB_BOARDS.map(([k, title, unit]) => {
    const rows = (LB.boards[k] || []);
    return `<div class="card"><h3 style="margin:0">${title}</h3><ol class="lbList">${rows.length ? rows.map((r, i) =>
      `<li class="${r.username === mine ? "me" : ""}"><span>${i + 1}. ${esc(r.username)}</span><b>${unit === "level" ? "Level " + r.value : Number(r.value).toLocaleString()}</b></li>`).join("") : "<li class='muted'>Nobody yet</li>"}</ol></div>`;
  }).join("");
  const f = LB.free || { allowed: 0, left: 0 };
  el("lbNote").innerHTML = (f.allowed ? `You were on the leaderboard at midnight: <b>${f.left}</b> of ${f.allowed} free pack${f.allowed === 1 ? "" : "s"} left (in the Shop). ` : "")
    + `Free packs are decided next at midnight (Canberra time)${f.nextAt ? ", in " + timeLeft(f.nextAt - Date.now()) : ""}.`;
}
function freePackHtml() {
  const f = LB && LB.free;
  const on = f && f.allowed > 0, left = on ? f.left : 0;
  return `<div class="pack freePack"><span id="lbCheckTimer" class="lbCheckTimer" title="Next leaderboard check (midnight)"></span><div class="packHead">🎁 <b>Free Daily Pack</b> <span class="tag">leaderboard</span></div>
    <div class="muted small">A random ability pack, free. Decided every day at midnight (Canberra time) from the leaderboards right then. ${on ? `You got ${f.allowed} today${f.firsts > 1 ? " for being number 1 on " + f.firsts + " boards" : ""}${f.levelFirst ? (f.firsts > 1 ? ", plus" : " including") + " 1 extra for the highest level" : ""}.` : "Be on any leaderboard at midnight to get one. Number 1 on more than one board gets one for each, and the highest level gets an extra one."}</div>
    <ul><li class="muted">Opens one of the 5 ability packs at random</li></ul>
    <button data-buy-free="1" ${on && left > 0 ? "" : "disabled"}>${!f ? "Loading…" : on ? (left > 0 ? `Open free (${left} left)` : "Next ones at midnight") : "Leaderboard only"}</button></div>`;
}
