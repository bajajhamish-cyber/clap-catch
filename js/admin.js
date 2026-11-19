// ======================================================================
//  admin.js: admin panel (press P). Only shows for bajajhamish, and the
//  SERVER refuses these actions from anyone else anyway.
// ======================================================================
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() !== "p" || e.repeat) return;
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
el("adminBanBtn").onclick = () => { const u = el("adminBanUser").value.trim(); adminDo("adminBan", { username: u, on: true }, `⛔ ${u} is banned for 30 minutes`); el("adminBanUser").value = ""; };
el("adminTeamBtn").onclick = () => adminDo("adminConfig", { antiTeaming: !adminCfg.antiTeaming }, `Anti-teaming is now ${adminCfg.antiTeaming ? "OFF" : "ON"}`);

async function refreshAdmin() {
  if (!PROFILE || !PROFILE.isAdmin) return;
  try {
    const d = await api("adminLists");
    adminCfg = d.config;
    el("adminTeamBtn").textContent = adminCfg.antiTeaming ? "ON" : "OFF";
    el("adminTeamBtn").style.background = adminCfg.antiTeaming ? "#1f6f3a" : "#555";
    el("adminBanList").innerHTML = d.banned.length ? d.banned.map(b =>
      `<div class="adminRow"><span><b>${esc(b.username)}</b> · ${Math.ceil((b.until - Date.now()) / 60000)} min left</span><button type="button" data-unban="${esc(b.username)}">Unban</button></div>`).join("")
      : "<div class='muted'>Nobody is banned.</div>";
    el("adminLuckyList").innerHTML = d.lucky.map(l =>
      `<div class="adminRow"><span>🍀 <b>${esc(l.username)}</b> (waiting for their next pack)</span><button type="button" class="secondary" data-unlucky="${esc(l.username)}">Cancel</button></div>`).join("");
    document.querySelectorAll("[data-unban]").forEach(b => b.onclick = () => adminDo("adminBan", { username: b.dataset.unban, on: false }, `✅ ${b.dataset.unban} is unbanned`));
    document.querySelectorAll("[data-unlucky]").forEach(b => b.onclick = () => adminDo("adminLucky", { username: b.dataset.unlucky, on: false }, "Lucky spin removed"));
  } catch (e) { toast("Couldn't load admin lists: " + e.message, true); }
}
