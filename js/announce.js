// ======================================================================
//  announce.js: admin announcements.
//   - Temp announcement: a banner at the top of everyone's screen (menus and
//     games) for 10 seconds.
//   - Long announcement: an "Announcements" tab everyone can read, until its
//     timer runs out or the admin who made it stops it.
//  The server decides what is live and for how long; this page only asks
//  (every few seconds) and shows it. Times come from the server as "ms left",
//  so a wrong clock on someone's computer doesn't matter.
// ======================================================================
const ANN_POLL_MS = 4000;
let ANN_DATA = { temp: null, long: [] };
let annTempShown = 0, annTempTimer = null, annBusy = false, annFails = 0, annNextTry = 0;

// ---------------------------------------------------------------- asking the server
let annLast = 0;
async function pollAnn(force) {
  if (!PROFILE || annBusy || document.hidden || Date.now() < annNextTry) return;
  if (HUB_OK && force !== true && Date.now() - annLast < 300000) return;   // the hub pokes us when there's a new one
  annBusy = true; annLast = Date.now();
  try { applyAnn(await api("annGet")); annFails = 0; }
  catch (e) { annFails = Math.min(annFails + 1, 5); annNextTry = Date.now() + ANN_POLL_MS * Math.pow(2, annFails); }   // back off if the server isn't answering
  finally { annBusy = false; }
}
function applyAnn(d) {
  if (!d) return;
  const at = Date.now();
  ANN_DATA = {
    temp: d.temp ? Object.assign({}, d.temp, { endsAt: at + d.temp.left }) : null,
    long: (d.long || []).map(x => Object.assign({}, x, { endsAt: at + x.left })),
  };
  showTemp(); renderAnnouncements(); renderAnnAdmin();
}
setInterval(() => pollAnn(), ANN_POLL_MS);
setTimeout(() => pollAnn(), 1500);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pollAnn(); });

// ---------------------------------------------------------------- temp announcement (10-second banner)
function hideTemp() { el("annTemp").hidden = true; clearTimeout(annTempTimer); }
function showTemp() {
  const t = ANN_DATA.temp, box = el("annTemp");
  if (!t) { if (!box.hidden) hideTemp(); return; }              // the admin stopped it early
  if (t.id === annTempShown) return;                            // already showing (or already shown) this one
  const left = t.endsAt - Date.now();
  if (left <= 0) return;
  annTempShown = t.id;
  el("annTempBy").textContent = "Announcement from " + t.by;
  el("annTempMsg").textContent = t.msg;
  box.hidden = false;
  const fill = el("annTempFill");
  fill.style.transition = "none"; fill.style.width = "100%"; void fill.offsetWidth;     // restart the bar
  fill.style.transition = `width ${left}ms linear`; fill.style.width = "0%";
  clearTimeout(annTempTimer); annTempTimer = setTimeout(hideTemp, left);
  playTone(660, 0.18, "triangle", 0.12);
}

// ---------------------------------------------------------------- long announcements: the tab everyone can read
const ANN_SEEN_KEY = "cc_ann_seen";
function annSeenList() { try { return JSON.parse(localStorage.getItem(ANN_SEEN_KEY) || "[]"); } catch (e) { return []; } }
function annMarkSeen(ids) { try { localStorage.setItem(ANN_SEEN_KEY, JSON.stringify(Array.from(new Set(annSeenList().concat(ids))).slice(-50))); } catch (e) {} }
const annLive = () => ANN_DATA.long.filter(x => x.endsAt > Date.now());

function renderAnnouncements() {
  const L = annLive(), btn = el("announceTabBtn");
  btn.hidden = !L.length;
  if (!L.length) {
    el("announceBox").innerHTML = ""; el("announceBox").dataset.key = "";
    if (currentTab === "announce") document.querySelector('.tabs button[data-tab="play"]').click();
    el("announceBadge").textContent = "";
    return;
  }
  if (currentTab === "announce") annMarkSeen(L.map(x => x.id));
  const unseen = L.filter(x => !annSeenList().includes(x.id)).length;
  el("announceBadge").textContent = unseen ? `(${unseen})` : "";
  const box = el("announceBox"), key = L.map(x => x.id).join(",");
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.innerHTML = L.slice().sort((a, b) => b.at - a.at).map(x => `<div class="card annCard">
      <div class="annHead"><h3>${esc(x.title)}</h3><span class="muted small">from ${esc(x.by)} · ends in <b class="annLeft" data-end="${x.endsAt}"></b></span></div>
      <div class="annBody">${esc(x.msg)}</div></div>`).join("");
  }
  tickAnn();
}
function tickAnn() {
  const now = Date.now();
  document.querySelectorAll(".annLeft").forEach(n => { n.textContent = timeLeft(+n.dataset.end - now); });
  if (ANN_DATA.long.some(x => x.endsAt <= now)) { ANN_DATA.long = ANN_DATA.long.filter(x => x.endsAt > now); renderAnnouncements(); renderAnnAdmin(); }
}
setInterval(() => { if (PROFILE) tickAnn(); }, 1000);
// The Announcements button lives in the top bar (not in the tab row), so a long announcement can never push the other tabs onto a second row.
// It opens the announcements page the same way a tab does.
el("announceTabBtn").addEventListener("click", () => {
  currentTab = "announce";
  document.querySelectorAll(".tabs button").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-announce");
  el("announceTabBtn").classList.add("active");
  annMarkSeen(annLive().map(x => x.id)); el("announceBadge").textContent = "";
  renderAnnouncements();
});
// picking any normal tab leaves the announcements page
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => el("announceTabBtn").classList.remove("active")));

// ---------------------------------------------------------------- admin panel: the Announcements tab
let annKind = "temp";
function annSetKind(k) {
  annKind = k;
  document.querySelectorAll("[data-annkind]").forEach(b => { b.classList.toggle("active", b.dataset.annkind === k); b.classList.toggle("secondary", b.dataset.annkind !== k); });
  el("annTempForm").hidden = k !== "temp"; el("annLongForm").hidden = k !== "long";
}
document.querySelectorAll("[data-annkind]").forEach(b => b.onclick = () => annSetKind(b.dataset.annkind));
el("annTempText").addEventListener("input", () => { el("annTempCount").textContent = `${el("annTempText").value.length} / 200`; });
el("annTempText").addEventListener("keydown", e => { if (e.key === "Enter") el("annTempSend").click(); });

async function annSend(btn, args, okMsg, after) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { applyAnn(await api("annPost", args)); toast(okMsg); if (after) after(); }
  catch (e) { toast(e.message, true); }
  btn.disabled = false;
}
el("annTempSend").onclick = () => {
  const text = el("annTempText").value.trim();
  if (!text) return toast("Type the announcement first", true);
  annSend(el("annTempSend"), { kind: "temp", text }, "📢 Sent. It shows for 10 seconds", () => { el("annTempText").value = ""; el("annTempCount").textContent = ""; });
};
el("annLongSend").onclick = () => {
  const title = el("annLongTitle").value.trim(), text = el("annLongText").value.trim(), mins = Math.floor((+el("annLongMins").value || 0) * (+el("annLongUnit").value || 1));
  if (!title) return toast("Give it a title", true);
  if (!text) return toast("Type the announcement first", true);
  if (mins < 1) return toast("Pick how long it lasts", true);
  annSend(el("annLongSend"), { kind: "long", title, text, minutes: mins }, `📢 Published for ${timeLeft(mins * 60000)}`, () => { el("annLongTitle").value = ""; el("annLongText").value = ""; });
};
function renderAnnAdmin() {
  const list = el("annAdminList");
  if (!list || !PROFILE || !PROFILE.isAdmin) return;
  const L = annLive().slice().sort((a, b) => b.at - a.at);
  list.innerHTML = L.length ? L.map(x => {
    const canStop = PROFILE.isOwner || x.by === PROFILE.username;
    return `<div class="adminRow"><span><b>${esc(x.title)}</b> · from ${esc(x.by)} · ${timeLeft(x.endsAt - Date.now())} left</span>${canStop ? `<button type="button" class="secondary" data-annstop="${x.id}">Stop</button>` : ""}</div>`;
  }).join("") : "<div class='muted'>No long announcements are up.</div>";
  list.querySelectorAll("[data-annstop]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { applyAnn(await api("annStop", { id: +b.dataset.annstop })); toast("Announcement stopped"); }
    catch (e) { toast(e.message, true); pollAnn(); }
  });
}
async function refreshAnnAdmin() {
  annNextTry = 0; annBusy = false;
  try { applyAnn(await api("annGet")); } catch (e) { toast(e.message, true); }
  renderAnnAdmin();
}
