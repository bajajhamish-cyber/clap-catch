// ======================================================================
//  admin.js: admin panel (press P). Only shows for bajajhamish, and the
//  SERVER refuses these actions from anyone else anyway.
// ======================================================================
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() !== "p" || e.repeat || inGame) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (!PROFILE || !PROFILE.isAdmin) return;
  const open = el("adminPanel").style.display === "flex";
  el("adminPanel").style.display = open ? "none" : "flex";
  if (!open) refreshAdmin();
});
el("adminClose").onclick = () => el("adminPanel").style.display = "none";

let adminCfg = { antiTeaming: true };
async function adminDo(op, args, msg) {
  try { await api(op, args); if (msg) toast(msg); refreshAdmin(); } catch (e) { toast(e.message, true); }
}
el("adminLuckyBtn").onclick = () => { const u = el("adminLuckyUser").value.trim(); adminDo("adminLucky", { username: u, on: true }, `🍀 ${u}'s next pack will be the rarest item`); el("adminLuckyUser").value = ""; };
el("adminNearBtn").onclick = () => {
  const u = el("adminNearUser").value.trim(), lv = +el("adminNearLevel").value;
  adminDo("adminNearMiss", { username: u, level: lv }, `🎯 ${u}'s next pack: ${lv === 2 ? "double near miss" : "near miss"}`); el("adminNearUser").value = "";
};
el("adminBanBtn").onclick = () => { const u = el("adminBanUser").value.trim(); adminDo("adminBan", { username: u, on: true }, `⛔ ${u} is banned for 30 minutes`); el("adminBanUser").value = ""; };
el("adminEventId").innerHTML = Object.entries(EVENTS).map(([id, e]) => `<option value="${id}">${e.icon} ${e.name}</option>`).join("");
el("adminEventBtn").onclick = () => {
  const id = el("adminEventId").value, mins = Math.floor((+el("adminEventMins").value || 0) * (+el("adminEventUnit").value || 1));
  adminDo("adminConfig", { event: id, minutes: mins }, `${EVENTS[id].icon} ${EVENTS[id].name} is on for ${timeLeft(mins * 60000)}`).then(() => api("me").then(setProfile));
};
el("adminEventStop").onclick = () => adminDo("adminConfig", { stopEvent: true }, "Event stopped").then(() => api("me").then(setProfile));
el("adminWorld3Btn").onclick = () => adminDo("adminConfig", { world3: adminCfg.world3 === false }, `Story World 3 is now ${adminCfg.world3 === false ? "ON" : "OFF"}`).then(() => api("me").then(setProfile));
el("adminWorld4Btn").onclick = () => adminDo("adminConfig", { world4: !adminCfg.world4 }, `Story World 4 is now ${adminCfg.world4 ? "OFF" : "ON"}`).then(() => api("me").then(setProfile));
el("adminWorld2Btn").onclick = () => adminDo("adminConfig", { world2: !adminCfg.world2 }, `Story World 2 is now ${adminCfg.world2 ? "OFF" : "ON"}`).then(() => api("me").then(setProfile));
el("adminTeamBtn").onclick = () => adminDo("adminConfig", { antiTeaming: !adminCfg.antiTeaming }, `Anti-teaming is now ${adminCfg.antiTeaming ? "OFF" : "ON"}`);

// ---- the one-time switch for the new update (press twice to be sure)
let updateArmed = 0;
el("adminUpdateBtn").onclick = async () => {
  if (Date.now() - updateArmed > 4000) { updateArmed = Date.now(); el("adminUpdateBtn").textContent = "Click again to confirm"; setTimeout(() => { if (el("adminUpdateBtn")) el("adminUpdateBtn").textContent = "Switch on the update"; }, 4000); return; }
  updateArmed = 0;
  try { await api("adminActivate"); toast("The update is on"); el("adminUpdateCard").hidden = true; setTimeout(() => location.reload(), 900); }
  catch (e) { toast(e.message, true); }
};
// ---- Creator Pack pictures: shrink to 128x128 in the browser, then upload
const CREATOR_LABEL = { creator_c: "Common", creator_r: "Rare", creator_l: "Legendary" };
function creatorRows(skinsNow) {
  el("adminCreatorRows").innerHTML = Object.keys(CREATOR_LABEL).map(id => {
    const cur = skinsNow[id];
    return `<div class="adminRow creatorRow"><span class="creatorPrev">${cur ? `<img src="${cur.img}" alt="">` : "<span class='muted small'>none yet</span>"}</span>
      <b style="width:84px">${CREATOR_LABEL[id]}</b>
      <input type="text" maxlength="24" placeholder="Skin name" data-cname="${id}" value="${cur ? esc(cur.name) : ""}">
      <input type="file" accept="image/png,image/jpeg,image/webp" data-cfile="${id}">
      <button type="button" data-cup="${id}">Upload</button></div>`;
  }).join("");
  document.querySelectorAll("[data-cup]").forEach(b => b.onclick = async () => {
    const id = b.dataset.cup, f = document.querySelector(`[data-cfile="${id}"]`).files[0], name = document.querySelector(`[data-cname="${id}"]`).value.trim();
    if (!f) return toast("Pick a picture first", true);
    try {
      const img = await shrinkImage(f, 128);
      await api("creatorUpload", { id, img, name }); toast(`${CREATOR_LABEL[id]} skin uploaded`);
      CREATOR = null; loadCreatorSkins().then(refreshAdmin);
    } catch (e) { toast(e.message, true); }
  });
}
function shrinkImage(file, size) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("Couldn't read that file"));
    r.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error("That isn't a picture"));
      im.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = size;
        const s = Math.min(im.width, im.height), cx = c.getContext("2d");
        cx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);       // centre square crop
        res(c.toDataURL("image/png"));
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

async function refreshAdmin() {
  if (!PROFILE || !PROFILE.isAdmin) return;
  if (typeof refreshMiniAdmin === "function") refreshMiniAdmin();
  el("ogTabBtn").hidden = !PROFILE.isOwner;            // the OG skins tab is for bajajhamish only, no secret keys needed
  el("annTabBtn").hidden = !PROFILE.annUnlocked;        // bajajhamish always; kythor once his Announcements quest is done
  if (el("annTabBtn").hidden && document.querySelector('[data-apane="ann"]:not([hidden])')) adminTab("main");
  try {
    const d = await api("adminLists");
    adminCfg = d.config;
    const owner = d.role !== "helper";
    el("adminUpdateCard").hidden = !(owner && !adminCfg.update3);
    el("adminCreatorCard").hidden = !(owner && adminCfg.update3);
    el("adminEventCard").hidden = !owner;
    el("adminLuckyLimit").textContent = owner ? "" : " You can give 1 a day, and not to yourself.";
    if (owner && adminCfg.update3) creatorRows((await loadCreatorSkins()) || {});
    el("adminTeamBtn").textContent = adminCfg.antiTeaming ? "ON" : "OFF";
    const ev = adminCfg.event && adminCfg.event.until > Date.now() ? adminCfg.event : null;
    el("adminEventNow").innerHTML = ev ? `Now: <b>${EVENTS[ev.id].icon} ${EVENTS[ev.id].name}</b>, ${timeLeft(ev.until - Date.now())} left` : "No event on right now.";
    el("adminTeamBtn").style.background = adminCfg.antiTeaming ? "#1f6f3a" : "#555";
    el("adminWorld2Btn").textContent = adminCfg.world2 ? "ON" : "OFF";
    el("adminWorld2Btn").style.background = adminCfg.world2 ? "#1f6f3a" : "#555";
    // World 3: only bajajhamish. World 4: only bajajhamish until he's switched it on once, then kythor too
    el("statsTabBtn").hidden = !owner;
    el("adminWorld3Row").hidden = !owner; el("adminWorld4Row").hidden = !(owner || adminCfg.world4Opened);
    el("adminWorld34").hidden = el("adminWorld3Row").hidden && el("adminWorld4Row").hidden;
    const w3 = adminCfg.world3 !== false;
    el("adminWorld3Btn").textContent = w3 ? "ON" : "OFF"; el("adminWorld3Btn").style.background = w3 ? "#1f6f3a" : "#555";
    el("adminWorld4Btn").textContent = adminCfg.world4 ? "ON" : "OFF"; el("adminWorld4Btn").style.background = adminCfg.world4 ? "#1f6f3a" : "#555";
    el("adminBanList").innerHTML = d.banned.length ? d.banned.map(b =>
      `<div class="adminRow"><span><b>${esc(b.username)}</b> · ${Math.ceil((b.until - Date.now()) / 60000)} min left</span><button type="button" data-unban="${esc(b.username)}">Unban</button></div>`).join("")
      : "<div class='muted'>Nobody is banned.</div>";
    el("adminLuckyList").innerHTML = d.lucky.map(l =>
      `<div class="adminRow"><span>🍀 <b>${esc(l.username)}</b> (waiting for their next pack)</span><button type="button" class="secondary" data-unlucky="${esc(l.username)}">Cancel</button></div>`).join("");
    document.querySelectorAll("[data-unban]").forEach(b => b.onclick = () => adminDo("adminBan", { username: b.dataset.unban, on: false }, `✅ ${b.dataset.unban} is unbanned`));
    el("adminNearList").innerHTML = (d.near || []).map(l =>
      `<div class="adminRow"><span>🎯 <b>${esc(l.username)}</b> (${l.level === 2 ? "double near miss" : "near miss"}, waiting for their next pack)</span><button type="button" class="secondary" data-unnear="${esc(l.username)}">Cancel</button></div>`).join("");
    document.querySelectorAll("[data-unnear]").forEach(b => b.onclick = () => adminDo("adminNearMiss", { username: b.dataset.unnear, level: 0 }, "Near miss removed"));
    document.querySelectorAll("[data-unlucky]").forEach(b => b.onclick = () => adminDo("adminLucky", { username: b.dataset.unlucky, on: false }, "Lucky spin removed"));
  } catch (e) { toast("Couldn't load admin lists: " + e.message, true); }
}

// ---------------------------------------------------------------- side tabs (Main / OG skins / You)
// The OG skins tab always shows for bajajhamish. The Wheel and You tabs only appear for him after typing L, I, O with the panel open.
function adminTab(name) {
  document.querySelectorAll("[data-atab]").forEach(b => b.classList.toggle("active", b.dataset.atab === name));
  document.querySelectorAll("[data-apane]").forEach(p => p.hidden = p.dataset.apane !== name);
  if (name === "og") refreshOg();
  if (name === "ann") refreshAnnAdmin();
  if (name === "you") refreshYou();
  if (name === "wheel") { refreshWheel(); refreshSure(); }
  if (name === "main") refreshMiniAdmin();
  if (name === "stats") refreshStats();
}
// ---------------------------------------------------------------- owner stats (bajajhamish only: the server checks)
async function refreshStats() {
  const box = el("osBody");
  let d; try { d = await api("ownerStats"); } catch (e) { box.innerHTML = `<div class="muted">${esc(e.message)}</div>`; return; }
  const n = x => Math.round(x || 0).toLocaleString(), sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const today = d.days[d.days.length - 1] || { players: 0, newAcc: 0, games: {}, wins: {}, roomSecs: {}, lvlNew: 0, lvlPub: 0, lvlBeat: 0, minis: {} };
  const fsT = (d.fs[d.fs.length - 1] || [null, [0, 0, 0]])[1], cfT = (d.cf[d.cf.length - 1] || [null, [0, 0]])[1];
  const hrs = s => (s / 3600);
  const at = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (new Date(t).toDateString() !== new Date().toDateString() ? " tomorrow" : "");
  const bar = (label, v, max, note, fmt) => {
    const p = Math.min(100, (v / max) * 100), col = p >= 80 ? "#e53935" : p >= 50 ? "#ffb300" : "#43a047";
    return `<div class="osBar"><div class="row" style="justify-content:space-between"><b>${label}</b><span>${fmt ? fmt(v) : n(v)} / ${n(max)} <span class="muted small">(${p.toFixed(0)}%)</span></span></div>
      <div class="osTrack"><div style="width:${p}%;background:${col}"></div></div>${note ? `<div class="muted small">${note}</div>` : ""}</div>`;
  };
  const roomHrsToday = hrs(sum(today.roomSecs));
  const liveRooms = d.live ? sum(d.live.rooms) : null;
  let h = `<div class="osCards">
    <div class="osCard"><div class="osBig">${liveRooms == null ? "?" : n(liveRooms)}</div>games open now${d.live ? ` · ${n(d.live.players)} players in them` : ""}</div>
    <div class="osCard"><div class="osBig">${n(today.players)}</div>players today</div>
    <div class="osCard"><div class="osBig">${n(today.newAcc)}</div>new accounts today</div>
    <div class="osCard"><div class="osBig">${n(sum(today.games))}</div>games played today</div></div>
  <h4>Today vs the free limits</h4>
  ${bar("Database reads (Firebase)", fsT[0], d.limits.fsReads, `Resets at ${at(d.resets.firebase)} (midnight in California). If this runs out, nobody can log in or save.`)}
  ${bar("Database writes (Firebase)", fsT[1], d.limits.fsWrites, "Saving accounts, games, trades, messages.")}
  ${fsT[2] ? bar("Database deletes (Firebase)", fsT[2], d.limits.fsDeletes) : ""}
  ${bar("≈ Requests (Cloudflare)", cfT[0] + cfT[1], d.limits.requests, `Player requests ${n(cfT[0])} + game connections ${n(cfT[1])}. Resets at ${at(d.resets.cloudflare)} (midnight UTC).`)}
  ${bar("≈ Game-room hours (Cloudflare)", roomHrsToday, d.limits.roomHours, "How long games were open today. The free plan keeps rooms awake for about 28 hours a day in total. Closing idle games keeps this down.", v => v.toFixed(1))}
  <h4>Games today</h4>`;
  const kinds = Object.keys(Object.assign({}, today.games, today.roomSecs)).sort((a, b) => (today.games[b] || 0) - (today.games[a] || 0));
  h += kinds.length ? `<table class="osTable"><tr><th>Kind</th><th>Games</th><th>Room hours</th></tr>${kinds.map(k => `<tr><td>${esc(k)}</td><td>${n(today.games[k])}</td><td>${hrs(today.roomSecs[k] || 0).toFixed(1)}</td></tr>`).join("")}</table>` : `<div class="muted small">No games yet today.</div>`;
  const mi = Object.entries(today.minis || {});
  h += `<div class="small" style="margin-top:6px">Level Maker today: <b>${n(today.lvlNew)}</b> made · <b>${n(today.lvlPub)}</b> published · <b>${n(today.lvlBeat)}</b> beaten${mi.length ? ` · Minigame results: ${mi.map(([k, v]) => `${esc(k)} ${n(v)}`).join(", ")}` : ""}</div>`;
  // last 7 days
  const fsBy = Object.fromEntries(d.fs), cfBy = Object.fromEntries(d.cf);
  h += `<h4>Last 7 days</h4><table class="osTable"><tr><th>Day</th><th>Players</th><th>New</th><th>Games</th><th>Room hrs</th><th>DB reads*</th><th>DB writes*</th><th>Requests*</th></tr>
    ${d.days.slice().reverse().map(x => { const f = fsBy[x.day] || [0, 0, 0], c = cfBy[x.day] || [0, 0]; return `<tr><td>${x.day.slice(5)}</td><td>${n(x.players)}</td><td>${n(x.newAcc)}</td><td>${n(sum(x.games))}</td><td>${hrs(sum(x.roomSecs)).toFixed(1)}</td><td>${n(f[0])}</td><td>${n(f[1])}</td><td>${n(c[0] + c[1])}</td></tr>`; }).join("")}</table>
    <div class="muted small">*Database numbers are per California day and requests per UTC day (that's when their limits reset), so they're a few hours off from the Sydney day.</div>`;
  // abilities
  const ab = Object.entries(d.abilities || {}).map(([id, [u, w]]) => ({ id, u, w, p: u ? w / u : 0 })).sort((a, b) => b.u - a.u);
  h += `<h4>Abilities (last 7 days)</h4>`;
  h += ab.length ? `<div class="muted small">"Win %": how often the player who used it went on to win that round. With 4 to 6 players, about 20% is normal. ⚠️ = wins a lot (40%+, used in 10+ rounds).</div>
    <table class="osTable"><tr><th>Ability</th><th>Rounds used</th><th>Win %</th></tr>${ab.slice(0, 30).map(x => `<tr><td>${esc((RULES[x.id] && RULES[x.id].name) || x.id)}</td><td>${n(x.u)}</td><td>${(x.p * 100).toFixed(0)}%${x.u >= 10 && x.p >= 0.4 ? " ⚠️" : ""}</td></tr>`).join("")}</table>`
    : `<div class="muted small">No abilities used yet.</div>`;
  box.innerHTML = h;
}
el("osRefresh").onclick = () => refreshStats();
document.querySelectorAll("[data-atab]").forEach(b => b.onclick = () => adminTab(b.dataset.atab));
let secretKeys = "";
document.addEventListener("keydown", e => {
  if (el("adminPanel").style.display !== "flex" || !PROFILE || !PROFILE.isOwner || e.repeat) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  secretKeys = (secretKeys + e.key.toLowerCase()).slice(-3);
  if (secretKeys === "lio") { document.querySelectorAll('[data-atab="wheel"], [data-atab="you"]').forEach(b => b.hidden = false); secretKeys = ""; }
});

// ---------------------------------------------------------------- OG skins (pictures for doom, kythor, cookie_clicker, imsmaat)
async function refreshOg() {
  let cur = {};
  try { cur = await api("ogSkins"); } catch (e) { toast(e.message, true); }
  el("adminOgRows").innerHTML = OG.USERS.map(u => {
    const c = cur[u];
    return `<div class="adminRow creatorRow ogRow"><span class="creatorPrev">${c ? `<img src="${c.img}" alt="">` : "<span class='muted small'>none yet</span>"}</span>
      <b style="width:110px">${esc(u)}</b>
      <input type="text" maxlength="24" placeholder="Skin name" data-oname="${u}" value="${c ? esc(c.name) : ""}">
      <input type="file" accept="image/png,image/jpeg,image/webp" data-ofile="${u}">
      <button type="button" data-oup="${u}">${c ? "Replace" : "Upload"}</button></div>`;
  }).join("");
  document.querySelectorAll("[data-oup]").forEach(b => b.onclick = async () => {
    const u = b.dataset.oup, f = document.querySelector(`[data-ofile="${u}"]`).files[0], name = document.querySelector(`[data-oname="${u}"]`).value.trim();
    if (!f) return toast("Pick a picture first", true);
    try {
      const img = await shrinkImage(f, 128);
      await api("ogUpload", { username: u, img, name }); toast(`${u}'s OG skin is set`);
      OG_SKINS = null; loadOgSkins(); refreshOg();
    } catch (e) { toast(e.message, true); }
  });
}

// ---------------------------------------------------------------- the "you" account (kythor's alt)
const youApi = (op, args) => api("asYou", { op, args: args || {} });
let youFriendsData = null;
function abilityOptions(first) { return `<option value="">${first}</option>` + Object.entries(RULES).filter(([, r]) => r.type === "ability").map(([id, r]) => `<option value="${id}">${esc(r.name)}</option>`).join(""); }
function skinOptions(first) { return `<option value="">${first}</option>` + SKIN_IDS.filter(id => SKINS[id]).map(id => `<option value="${id}">${esc(SKINS[id].name)}</option>`).join(""); }
function youFill() {
  if (el("youGiveAb").options.length) return;
  el("youGiveAb").innerHTML = abilityOptions("Ability…"); el("youGiveSk").innerHTML = skinOptions("Skin…");
  el("youTGAb").innerHTML = el("youTWAb").innerHTML = abilityOptions("(no ability)");
  el("youTGSk").innerHTML = el("youTWSk").innerHTML = skinOptions("(no skin)");
}
async function youDo(op, args, msg) {
  try { const r = await youApi(op, args); if (msg) toast(msg); refreshYou(); return r; } catch (e) { toast(e.message, true); }
}
async function refreshYou() {
  youFill();
  try {
    const [fl, tr] = await Promise.all([youApi("friendsList"), youApi("trades")]);
    youFriendsData = fl;
    el("youStatus").innerHTML = `Signed in as <b>${esc(fl.username)}</b> · ⭐ ${fl.points} points · ${fl.friends.length} friend${fl.friends.length === 1 ? "" : "s"}`;
    const row = (f, btns) => `<div class="youRow"><b>${esc(f.username)}</b>${btns}</div>`;
    el("youFriends").innerHTML =
      (fl.incoming.length ? "<div class='muted'>Requests to you:</div>" + fl.incoming.map(f => row(f, `<button type="button" data-yacc="${f.uid}">Accept</button><button type="button" class="secondary" data-ydec="${f.uid}">Decline</button>`)).join("") : "")
      + (fl.outgoing.length ? "<div class='muted'>Sent by you:</div>" + fl.outgoing.map(f => row(f, `<button type="button" class="secondary" data-ycan="${f.uid}">Cancel</button>`)).join("") : "")
      + (fl.left.length ? "<div class='muted'>Unfriended you:</div>" + fl.left.map(f => row(f, `<button type="button" data-yforce="${esc(f.username)}">Make friends again</button>`)).join("") : "")
      + "<div class='muted'>Friends:</div>" + (fl.friends.length ? fl.friends.map(f => row(f, `${f.online ? "<span class='muted'>online</span>" : ""}<button type="button" class="secondary" data-ychat="${f.uid}">Chat</button><button type="button" class="secondary" data-yrem="${f.uid}" data-yname="${esc(f.username)}">Remove</button>`)).join("") : "<div class='muted'>None yet.</div>");
    const sel = el("youChatWith"), was = sel.value;
    sel.innerHTML = fl.friends.map(f => `<option value="${f.uid}">${esc(f.username)}</option>`).join("");
    if (was && fl.friends.some(f => f.uid === was)) sel.value = was;
    document.querySelectorAll("[data-yacc]").forEach(b => b.onclick = () => youDo("friendAnswer", { uid: b.dataset.yacc, accept: true }, "Accepted"));
    document.querySelectorAll("[data-ydec]").forEach(b => b.onclick = () => youDo("friendAnswer", { uid: b.dataset.ydec, accept: false }, "Declined"));
    document.querySelectorAll("[data-ycan]").forEach(b => b.onclick = () => youDo("friendCancel", { uid: b.dataset.ycan }, "Cancelled"));
    document.querySelectorAll("[data-yforce]").forEach(b => b.onclick = () => youDo("forceFriend", { username: b.dataset.yforce }, `You and ${b.dataset.yforce} are friends again`));
    document.querySelectorAll("[data-yrem]").forEach(b => b.onclick = () => youDo("friendRemove", { uid: b.dataset.yrem }, `Removed ${b.dataset.yname}`));
    document.querySelectorAll("[data-ychat]").forEach(b => b.onclick = () => { el("youChatWith").value = b.dataset.ychat; youChat(); });
    // trades
    const bundle = b => { const out = []; if (b.points) out.push(`⭐ ${b.points}`); Object.entries(b.abilities || {}).forEach(([k, n]) => out.push(`${n}× ${RULES[k] ? RULES[k].name : k}`)); Object.entries(b.skins || {}).forEach(([k, n]) => out.push(`${n}× ${SKINS[k] ? SKINS[k].name : k}`)); return out.join(", ") || "nothing"; };
    const open = t => t.status === "pending";
    el("youTrades").innerHTML = [
      ...tr.incoming.filter(open).map(t => `<div class="youRow"><b>From ${esc(t.fromName)}</b><span>gives ${esc(bundle(t.give))} · wants ${esc(bundle(t.want))}</span><button type="button" data-ytacc="${t.id}">Accept</button><button type="button" class="secondary" data-ytdec="${t.id}">Decline</button></div>`),
      ...tr.outgoing.filter(open).map(t => `<div class="youRow"><b>To ${esc(t.toName)}</b><span>you give ${esc(bundle(t.give))} · you get ${esc(bundle(t.want))}</span><button type="button" class="secondary" data-ytcan="${t.id}">Cancel</button></div>`),
    ].join("") || "<div class='muted'>No open trades.</div>";
    document.querySelectorAll("[data-ytacc]").forEach(b => b.onclick = () => youDo("tradeAnswer", { id: b.dataset.ytacc, accept: true }, "Trade accepted"));
    document.querySelectorAll("[data-ytdec]").forEach(b => b.onclick = () => youDo("tradeAnswer", { id: b.dataset.ytdec, accept: false }, "Trade declined"));
    document.querySelectorAll("[data-ytcan]").forEach(b => b.onclick = () => youDo("tradeCancel", { id: b.dataset.ytcan }, "Trade cancelled"));
  } catch (e) { el("youStatus").textContent = e.message; }
}
async function youChat() {
  const w = el("youChatWith").value; if (!w) return;
  try {
    const d = await youApi("dmGet", { with: w });
    el("youChatList").innerHTML = (d.msgs || []).map(m => `<div class="m ${m.f !== w ? "mine" : ""}">${esc(m.m)}</div>`).join("") || "<div class='muted'>No messages yet.</div>";
    el("youChatList").scrollTop = 1e6;
  } catch (e) { toast(e.message, true); }
}
el("youRefresh").onclick = refreshYou;
el("youFriendReq").onclick = () => { const u = el("youFriendUser").value.trim(); if (u) youDo("friendRequest", { username: u }, `Request sent to ${u}`); };
el("youFriendForce").onclick = () => { const u = el("youFriendUser").value.trim(); if (u) youDo("forceFriend", { username: u }, `You and ${u} are friends now`); };
el("youChatLoad").onclick = youChat;
el("youChatWith").onchange = youChat;
el("youChatSend").onclick = async () => {
  const w = el("youChatWith").value, text = el("youChatText").value.trim(); if (!w || !text) return;
  try { await youApi("dmSend", { with: w, text }); el("youChatText").value = ""; youChat(); } catch (e) { toast(e.message, true); }
};
el("youChatText").addEventListener("keydown", e => { if (e.key === "Enter") el("youChatSend").click(); });
el("youGivePtsBtn").onclick = () => { const n = Math.floor(+el("youGivePts").value || 0); if (n > 0) youDo("give", { points: n }, `Gave you ${n} points`); };
el("youGiveAbBtn").onclick = () => { const a = el("youGiveAb").value, n = Math.floor(+el("youGiveAbN").value || 1); if (a) youDo("give", { ability: a, count: n }, `Gave you ${n}× ${RULES[a].name}`); };
el("youGiveSkBtn").onclick = () => { const k = el("youGiveSk").value; if (k) youDo("give", { skin: k }, `Gave you ${SKINS[k].name}`); };
el("youTradeSend").onclick = () => {
  const side = (p, a, k) => { const b = { points: Math.max(0, Math.floor(+el(p).value || 0)), abilities: {}, skins: {} }; if (el(a).value) b.abilities[el(a).value] = 1; if (el(k).value) b.skins[el(k).value] = 1; return b; };
  const to = el("youTradeTo").value.trim(); if (!to) return toast("Who to?", true);
  youDo("tradeSend", { to, give: side("youTGPts", "youTGAb", "youTGSk"), want: side("youTWPts", "youTWAb", "youTWSk") }, `Trade sent to ${to}`);
};


// ---------------------------------------------------------------- the wheel (bajajhamish only, behind L I O)
const WHEEL_COLORS = ["#ef5f2a", "#2f80ed", "#27ae60", "#9b51e0", "#f2c94c", "#eb5757", "#00a8a8", "#e07bb5"];
let wheelPlayers = [], wheelRot = 0, wheelSpinning = false;
function drawWheel() {
  const c = el("wheelCanvas"), g = c.getContext("2d"), W = c.width, R = W / 2 - 6, n = wheelPlayers.length;
  g.clearRect(0, 0, W, W); g.save(); g.translate(W / 2, W / 2);
  if (!n) { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fillStyle = "#1e2129"; g.fill(); g.strokeStyle = "#3a3f4e"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#a3a7b5"; g.font = "600 18px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("Add players", 0, 6); g.restore(); return; }
  g.rotate(wheelRot);
  const seg = Math.PI * 2 / n;
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i * seg, (i + 1) * seg); g.closePath();
    g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; g.fill(); g.strokeStyle = "#0b0c0d"; g.lineWidth = 2; g.stroke();
    g.save(); g.rotate((i + 0.5) * seg); g.textAlign = "right"; g.textBaseline = "middle"; g.fillStyle = "#fff";
    g.font = `700 ${n > 12 ? 13 : 17}px system-ui, sans-serif`; g.shadowColor = "#000a"; g.shadowBlur = 3;
    g.fillText(wheelPlayers[i], R - 14, 0); g.restore();
  }
  g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fillStyle = "#171a21"; g.fill(); g.strokeStyle = "#ffcc33"; g.lineWidth = 3; g.stroke();
  g.restore();
}
function wheelChips() {
  el("wheelPlayers").innerHTML = wheelPlayers.length ? wheelPlayers.map(n => `<span class="wheelChip">${esc(n)}<button type="button" data-wrem="${esc(n)}" title="Remove">×</button></span>`).join("") : "<span class='muted small'>Nobody on the wheel yet.</span>";
  document.querySelectorAll("[data-wrem]").forEach(b => b.onclick = async () => { if (wheelSpinning) return; try { const r = await api("wheelRemove", { username: b.dataset.wrem }); wheelPlayers = r.players; wheelChips(); drawWheel(); } catch (e) { toast(e.message, true); } });
  el("wheelSpinBtn").disabled = wheelSpinning || wheelPlayers.length < 2;
}
async function refreshWheel() {
  try {
    const d = await api("wheelGet");
    if (!wheelSpinning) { wheelPlayers = d.players; wheelChips(); drawWheel(); }
    el("wheelPending").innerHTML = d.pending.length ? d.pending.map(l =>
      `<div class="adminRow"><span>${l.mode === "mythical" ? "🔮" : "🌟"} <b>${esc(l.username)}</b> (guaranteed ${l.mode}, waiting for their next limited pack)</span><button type="button" class="secondary" data-wcan="${esc(l.username)}">Cancel</button></div>`).join("") : "<div class='muted'>Nobody right now.</div>";
    document.querySelectorAll("[data-wcan]").forEach(b => b.onclick = async () => { try { await api("wheelCancel", { username: b.dataset.wcan }); toast("Cancelled"); refreshWheel(); } catch (e) { toast(e.message, true); } });
  } catch (e) { toast(e.message, true); }
}
el("wheelAddBtn").onclick = async () => {
  const u = el("wheelUser").value.trim(); if (!u || wheelSpinning) return;
  try { const r = await api("wheelAdd", { username: u }); wheelPlayers = r.players; el("wheelUser").value = ""; wheelChips(); drawWheel(); } catch (e) { toast(e.message, true); }
};
el("wheelUser").addEventListener("keydown", e => { if (e.key === "Enter") el("wheelAddBtn").click(); });
el("wheelClearBtn").onclick = async () => { if (wheelSpinning) return; try { const r = await api("wheelClear"); wheelPlayers = r.players; wheelChips(); drawWheel(); } catch (e) { toast(e.message, true); } };
el("wheelSpinBtn").onclick = async () => {
  if (wheelSpinning || wheelPlayers.length < 2) return;
  const mode = el("wheelMode").value;
  wheelSpinning = true; el("wheelSpinBtn").disabled = true; el("wheelResult").textContent = "";
  let r;
  try { r = await api("wheelSpin", { mode }); } catch (e) { wheelSpinning = false; toast(e.message, true); wheelChips(); return; }
  wheelPlayers = r.players; wheelChips(); el("wheelSpinBtn").disabled = true;
  const n = wheelPlayers.length, seg = Math.PI * 2 / n;
  const land = -Math.PI / 2 - (r.index + 0.5 + (Math.random() - 0.5) * 0.7) * seg;       // puts the winner's slice under the pointer
  const from = wheelRot, spins = 6 + Math.floor(Math.random() * 3);
  let to = land - Math.PI * 2 * spins; while (to > from - Math.PI * 2 * 5) to -= Math.PI * 2;
  const t0 = performance.now(), dur = 5200;
  await new Promise(done => { (function frame(now) {
    const t = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - t, 4);
    wheelRot = from + (to - from) * ease; drawWheel();
    if (t < 1) requestAnimationFrame(frame); else done();
  })(t0); });
  wheelRot = ((to % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  wheelSpinning = false; drawWheel(); wheelChips();
  el("wheelResult").innerHTML = `🎉 <b>${esc(r.winner)}</b> won! Their next limited pack will give a guaranteed <b>${r.mode}</b>.`;
  try { playTone(880, 0.25, "triangle", 0.15); } catch (e) {}
  refreshWheel();
};
