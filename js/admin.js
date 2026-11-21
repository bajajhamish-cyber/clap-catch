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
el("adminWorld2Btn").onclick = () => adminDo("adminConfig", { world2: !adminCfg.world2 }, `Story World 2 is now ${adminCfg.world2 ? "OFF" : "ON"}`).then(() => api("me").then(setProfile));
el("adminTeamBtn").onclick = () => adminDo("adminConfig", { antiTeaming: !adminCfg.antiTeaming }, `Anti-teaming is now ${adminCfg.antiTeaming ? "OFF" : "ON"}`);

async function refreshAdmin() {
  if (!PROFILE || !PROFILE.isAdmin) return;
  try {
    const d = await api("adminLists");
    adminCfg = d.config;
    el("adminTeamBtn").textContent = adminCfg.antiTeaming ? "ON" : "OFF";
    const ev = adminCfg.event && adminCfg.event.until > Date.now() ? adminCfg.event : null;
    el("adminEventNow").innerHTML = ev ? `Now: <b>${EVENTS[ev.id].icon} ${EVENTS[ev.id].name}</b>, ${timeLeft(ev.until - Date.now())} left` : "No event on right now.";
    el("adminTeamBtn").style.background = adminCfg.antiTeaming ? "#1f6f3a" : "#555";
    el("adminWorld2Btn").textContent = adminCfg.world2 ? "ON" : "OFF";
    el("adminWorld2Btn").style.background = adminCfg.world2 ? "#1f6f3a" : "#555";
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
