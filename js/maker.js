// ======================================================================
//  maker.js: the Level Maker (unlocked by beating World 4).
//  Making a new level costs points (the server keeps up to 10 per player).
//  Saving one is free: the server checks it and signs its share code
//  (CC4-…), and only signed codes play. Publishing puts it on the list
//  everyone can browse (3 per player, free).
// ======================================================================
let JOIN_EXTRA = "", mkData = null;
let mkDrafts = [], mkDraft = null, mkSaved = "", mkSavedBody = "", mkDrafted = false;
try { mkDraft = localStorage.getItem("cc_draft") || null; } catch (e) {}
const MK_MOD_NAMES = { curve: "Curve balls", ghost: "Ghost balls", bomb: "Bombs", split: "Split balls", glitch: "Glitched balls", fake: "Fake balls" };

let mkCur = "make";
// it's its own tab now: this just switches to it (used by the Story menu and "Back" after playing a level)
function openMaker(tab) {
  if (!PROFILE || !PROFILE.story4Unlocked) return toast("Beat World 4 to unlock the Level Maker", true);
  if (tab) mkCur = tab;
  document.querySelector('[data-tab="maker"]').click();
}
function makerShown() {
  if (!el("mkMods").children.length) {
    el("mkMods").innerHTML = LMAKER.MODS.map(k => `<label>${MK_MOD_NAMES[k]} <b id="mkM_${k}V"></b><input type="range" min="0" max="100" step="10" value="0" data-mod="${k}"></label>`).join("");
    el("makerModal").querySelectorAll("input, select").forEach(i => { if (!["mkPlayCode", "arLoad"].includes(i.id) && !i.closest("#arLines")) i.addEventListener("input", mkUpdate); });
    arInit(); mkDraftInit();
    try { el("mkDimFx").checked = localStorage.getItem("cc_dimfx") === "1"; } catch (e) {}
    el("mkTourBtn").onclick = () => makerTour(0);
    el("mkDimFx").onchange = () => { try { localStorage.setItem("cc_dimfx", el("mkDimFx").checked ? "1" : "0"); } catch (e) {} };
  }
  mkUpdate(); mkTab(mkCur);
  if (!mkDrafted) { mkDrafted = true; mkDraftsLoad(); }
}
// ---------------------------------------------------------------- your levels (paid for, saved on the server)
function mkDraftInit() {
  el("mkNewBtn").onclick = async () => {
    if ((PROFILE.points || 0) < LMAKER.COST) return toast(`Making a level costs ${LMAKER.COST} points (you have ${PROFILE.points || 0})`, true);
    if (!confirm(`Make a new level for ${LMAKER.COST} points? Editing, playing and publishing it are free.`)) return;
    try {
      const r = await api("lvlNew"); setProfile(r.me); mkDrafts = r.drafts;
      AR = arStarter(); arPh = 0; PH = AR.ph[0]; arSel = -1; tlSel = null; mkSelect(r.id, true);
      toast("New level made. Build it, then press Play it or Save.");
      makerTourFirstTime();                     // first level ever: the tutorial shows how everything works
    } catch (e) { toast(e.message, true); }
  };
  el("mkSaveBtn").onclick = () => mkSave().then(ok => ok && toast("Saved"));
  el("mkDraftDel").onclick = async () => {
    const d = mkDrafts.find(x => x.id === mkDraft); if (!d || !confirm(`Delete "${d.name}"? You won't get the ${LMAKER.COST} points back. (Published copies stay on the list.)`)) return;
    try { mkDrafts = (await api("lvlDraftDelete", { id: d.id })).drafts; mkSelect(mkDrafts.length ? mkDrafts[mkDrafts.length - 1].id : null); } catch (e) { toast(e.message, true); }
  };
  el("mkDraftSel").onchange = async () => { if (mkDirty()) await mkSave(); mkSelect(el("mkDraftSel").value); };
}
async function mkDraftsLoad() {
  try { const r = await api("lvlList"); mkData = r; mkDrafts = r.drafts || []; } catch (e) { return; }
  mkSelect(mkDrafts.some(x => x.id === mkDraft) ? mkDraft : mkDrafts.length ? mkDrafts[mkDrafts.length - 1].id : null);
}
// open one of your levels in the editor
function mkSelect(id, fresh) {
  mkDraft = id || null; try { id ? localStorage.setItem("cc_draft", id) : localStorage.removeItem("cc_draft"); } catch (e) {}
  const d = mkDrafts.find(x => x.id === mkDraft);
  el("mkDraftSel").innerHTML = mkDrafts.map(x => `<option value="${esc(x.id)}" ${x.id === mkDraft ? "selected" : ""}>${esc(x.name || "New level")}</option>`).join("") || "<option>No levels yet</option>";
  el("mkDraftSel").disabled = !mkDrafts.length; el("mkDraftDel").hidden = !d; el("mkSaveBtn").hidden = !d;
  el("mkLocked").hidden = !!d; el("mkEditor").hidden = !d;
  el("mkNewBtn").textContent = `New level · ${LMAKER.COST}`;
  mkSaved = d && d.code || ""; mkSavedBody = mkSaved.split(".")[0];
  if (d && d.code && !fresh) {
    const lv = levelFromCode(d.code);
    if (lv && lv.data.v === 2) { arLoadLevel(lv.data); mkSetMode("build"); arShow(); }
    else if (lv) { qkShow(lv.data); mkSetMode("quick"); }
  } else if (d) { mkSetMode("build"); arShow(); }
  mkUpdate();
}
function qkShow(x) {        // a Quick level -> the sliders
  el("mkName").value = x.n || ""; el("mkType").value = x.t; el("mkLanes").value = x.l; el("mkSpeed").value = Math.round(x.s * 100);
  if (x.w) el("mkWaves").value = x.w; if (x.b) el("mkBalls").value = x.b; if (x.k) el("mkNeed").value = x.k; if (x.h) el("mkHp").value = x.h;
  document.querySelectorAll("[data-mod]").forEach(i => { i.value = (x.m && x.m[i.dataset.mod]) || 0; });
  el("mkInv").checked = !!x.inv; el("mkDel").checked = !!x.del;
}
function mkSetMode(m) { mkMode = m; document.querySelectorAll("[data-mkmode]").forEach(x => x.classList.toggle("active", x.dataset.mkmode === m)); el("mkBuild").hidden = m !== "build"; el("mkQuick").hidden = m !== "quick"; }
function mkLocal() { return levelToCode(mkMode === "build" ? AR : mkLevel()); }       // what's on screen (not signed yet)
function mkDirty() { return !!mkDraft && mkLocal().slice(4) !== mkSavedBody.slice(4); }
// save to the server (free): it checks the level and signs the code. Resolves true when saved.
async function mkSave() {
  if (!mkDraft) { toast(`Make a new level first (${LMAKER.COST} points)`, true); return false; }
  if (!mkDirty() && mkSaved) return true;
  try {
    const r = await api("lvlSave", { id: mkDraft, code: mkLocal() });
    mkDrafts = r.drafts; mkSaved = r.code; mkSavedBody = r.code.split(".")[0];
    const sel = el("mkDraftSel").querySelector(`option[value="${mkDraft}"]`), d = mkDrafts.find(x => x.id === mkDraft); if (sel && d) sel.textContent = d.name;
    mkUpdate(); return true;
  } catch (e) { toast(e.message, true); return false; }
}
function mkShowCode() {
  const dirty = mkDirty();
  el("mkCode").value = dirty || !mkSaved ? "Save (free) to get the share code" : mkSaved;
  el("mkSaveState").textContent = !mkDraft ? "" : dirty || !mkSaved ? "Unsaved changes" : "Saved";
}
document.querySelectorAll("[data-mk]").forEach(b => b.onclick = () => mkTab(b.dataset.mk));
function mkTab(name) {
  mkCur = name;
  document.querySelectorAll("[data-mk]").forEach(b => b.classList.toggle("active", b.dataset.mk === name));
  document.querySelectorAll("[data-mkpane]").forEach(p => p.hidden = p.dataset.mkpane !== name);
  if (name !== "make") mkLoad();
}
// the settings on screen -> a level
function mkLevel() {
  const v = id => +el(id).value, m = {};
  document.querySelectorAll("[data-mod]").forEach(i => { if (+i.value) m[i.dataset.mod] = +i.value; });
  return { n: el("mkName").value.trim() || "My level", t: el("mkType").value, l: v("mkLanes"), s: v("mkSpeed") / 100,
    w: v("mkWaves"), b: v("mkBalls"), k: v("mkNeed"), h: v("mkHp"), m, inv: el("mkInv").checked ? 1 : 0, del: el("mkDel").checked ? 1 : 0 };
}
function mkUpdate() {
  if (mkMode === "build") { arRead(); arDraw(); mkShowCode(); return; }
  const t = el("mkType").value;
  el("makerModal").querySelectorAll("[data-for]").forEach(x => x.hidden = !x.dataset.for.split(" ").includes(t));
  el("mkWaves").max = t === "boss" ? 40 : 20; el("mkWaves").min = t === "boss" ? 10 : 3;
  const sp = +el("mkSpeed").value;
  el("mkLanesV").textContent = el("mkLanes").value; el("mkWavesV").textContent = el("mkWaves").value; el("mkBallsV").textContent = el("mkBalls").value;
  el("mkNeedV").textContent = el("mkNeed").value; el("mkHpV").textContent = el("mkHp").value;
  el("mkSpeedV").textContent = sp === 100 ? "normal" : sp < 100 ? `${100 - sp}% faster` : `${sp - 100}% slower`;
  document.querySelectorAll("[data-mod]").forEach(i => { el("mkM_" + i.dataset.mod + "V").textContent = i.value + "%"; });
  mkShowCode();
}
// every made level starts with the flashing lights warning (with the "Dim flashes" setting right there)
function epiWarn() {
  return new Promise(res => {
    const m = el("epiModal"); let dim = false; try { dim = localStorage.getItem("cc_dimfx") === "1"; } catch (e) {}
    el("epiDim").checked = dim; m.style.display = "flex";
    el("epiDim").onchange = () => { try { localStorage.setItem("cc_dimfx", el("epiDim").checked ? "1" : "0"); } catch (e) {} };
    el("epiGo").onclick = () => { m.style.display = "none"; res(true); };
    el("epiBack").onclick = () => { m.style.display = "none"; res(false); };
  });
}
async function playLevelCode(code, id) {
  if (!levelFromCode(code)) return toast("That isn't a level code", true);
  if (!(await epiWarn())) return;
  JOIN_EXTRA = "&lvl=" + encodeURIComponent(code) + (id ? "&lvlid=" + id : "");
  enterRoom(async () => "CUSTOM" + Math.random().toString(36).slice(2, 10).toUpperCase()).finally(() => { JOIN_EXTRA = ""; });
}
el("mkPlay").onclick = async () => { if (await mkSave()) playLevelCode(mkSaved); };
el("mkCopy").onclick = async () => { if (!(await mkSave())) return; try { await navigator.clipboard.writeText(mkSaved); toast("Level code copied: send it to a friend!"); } catch (e) { el("mkCode").select(); toast("Select the code and copy it"); } };
el("mkPasteBtn").onclick = async () => { try { el("mkPlayCode").value = (await navigator.clipboard.readText()).trim(); } catch (e) { el("mkPlayCode").focus(); toast("Press Ctrl+V to paste the code"); } };
el("mkPlayCodeBtn").onclick = () => playLevelCode(el("mkPlayCode").value.trim());
el("mkPublish").onclick = async () => {
  if (!(await mkSave())) return;
  try { const r = await api("lvlPublish", { code: mkSaved }); toast("Published! It shows on the list within 10 minutes."); if (mkData) mkData.mine = r.mine; mkTab("mine"); }
  catch (e) { toast(e.message, true); }
};

async function mkLoad() {
  try { mkData = await api("lvlList"); } catch (e) { toast(e.message, true); return; }
  const liked = new Set(mkData.liked || []), admin = PROFILE && PROFILE.isAdmin;
  const row = (x, mine) => `<div class="mkRow"><span class="mkName"><b>${esc(x.name)}</b> <span class="muted small">${mine ? "" : `by ${esc(x.by)} · `}${x.type || ""}${mine ? "" : ` · ${x.likes} like${x.likes === 1 ? "" : "s"} · ${x.plays} play${x.plays === 1 ? "" : "s"}`}</span></span>
    <button type="button" data-mkplay="${esc(x.id)}">Play</button>
    ${mine ? "" : `<button type="button" class="secondary" data-mklike="${esc(x.id)}" ${liked.has(x.id) || x.by === PROFILE.username ? "disabled" : ""}>${liked.has(x.id) ? "♥ Liked" : "♥ Like"}</button>`}
    <button type="button" class="secondary" data-mkcopy="${esc(x.id)}">Copy code</button>
    ${mine || admin ? `<button type="button" class="secondary" data-mkdel="${esc(x.id)}">Delete</button>` : ""}</div>`;
  const all = {}; [...(mkData.mine || []), ...(mkData.top || []), ...(mkData.newest || [])].forEach(x => all[x.id] = Object.assign({}, all[x.id], x));
  const P = mkData.picks || { owner: [], helper: [] }, role = PROFILE.adminRole === "helper" ? "helper" : "owner";
  const mySide = admin ? P[role] : [], picked = new Set(mySide.map(x => x.id));
  const pickBtn = x => admin ? `<button type="button" class="secondary" data-mkpick="${esc(x.id)}" data-on="${picked.has(x.id) ? 0 : 1}">${picked.has(x.id) ? "Unpick" : "⭐ Pick"}</button>` : "";
  const picks = [...P.owner.map(x => Object.assign({ who: "bajajhamish" }, x)), ...P.helper.map(x => Object.assign({ who: "kythor" }, x))];
  picks.forEach(x => all[x.id] = Object.assign({ likes: 0, plays: 0 }, x, all[x.id]));
  el("mkPicks").innerHTML = picks.map(x => row(all[x.id]).replace('<span class="muted small">', `<span class="muted small">${esc(x.who)}'s pick · `).replace("</div>", pickBtn(x) + "</div>")).join("") || "<div class='muted small'>Nothing picked yet.</div>";
  if (admin) el("mkPicks").insertAdjacentHTML("beforeend", `<div class="muted small">You have ${mySide.length}/${role === "owner" ? LMAKER.PICKS.owner : LMAKER.PICKS.helper} picks. Use ⭐ Pick on any level below.</div>`);
  const withPick = x => row(x).replace(/<\/div>$/, pickBtn(x) + "</div>");
  el("mkTop").innerHTML = (mkData.top || []).map(withPick).join("") || "<div class='muted small'>No levels yet. Be the first!</div>";
  el("mkNew").innerHTML = (mkData.newest || []).map(withPick).join("") || "<div class='muted small'>No levels yet.</div>";
  el("mkMine").innerHTML = (mkData.mine || []).map(x => row(Object.assign({ type: "" }, all[x.id] || x), true)).join("") + `<div class="muted small">${(mkData.mine || []).length} of ${mkData.slots} published. Make one in the Make tab.</div>`;
  el("mkSlots").textContent = `${(mkData.mine || []).length}/${mkData.slots} published`;
  // the list only has names: the level itself is fetched when you press Play or Copy (keeps the list small)
  const code = async id => { if (all[id] && all[id].code) return all[id].code; try { const r = await api("lvlGet", { id }); all[id] = Object.assign({}, all[id], { code: r.code }); return r.code; } catch (e) { toast(e.message, true); return null; } };
  document.querySelectorAll("[data-mkplay]").forEach(b => b.onclick = async () => { const c = await code(b.dataset.mkplay); if (c) playLevelCode(c, b.dataset.mkplay); });
  document.querySelectorAll("[data-mkcopy]").forEach(b => b.onclick = async () => { const c = await code(b.dataset.mkcopy); if (!c) return; try { await navigator.clipboard.writeText(c); toast("Code copied"); } catch (e) { el("mkPlayCode").value = c; } });
  document.querySelectorAll("[data-mklike]").forEach(b => b.onclick = async () => { try { await api("lvlLike", { id: b.dataset.mklike }); document.querySelectorAll(`[data-mklike="${b.dataset.mklike}"]`).forEach(x => { x.textContent = "♥ Liked"; x.disabled = true; }); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll("[data-mkpick]").forEach(b => b.onclick = async () => { try { await api("lvlPick", { id: b.dataset.mkpick, on: b.dataset.on === "1" }); mkLoad(); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll("[data-mkdel]").forEach(b => b.onclick = async () => { if (!confirm("Delete this level?")) return; try { await api("lvlDelete", { id: b.dataset.mkdel }); toast("Deleted"); mkLoad(); } catch (e) { toast(e.message, true); } });
}

// ======================================================================
//  Build your own: place dots, draw the W/S arrows between them, put
//  enemies anywhere (not on your dots), give them walk paths, shoot
//  patterns and lines to say. The level is still just a share code.
// ======================================================================
let mkMode = "build", arTool = "dot", arSel = -1, arHot = -1, arPh = 0;
let AR = arStarter(), PH = AR.ph[0];          // AR: the whole level, PH: the phase being edited
function arStarter() {
  return { v: 2, n: "", k: 5, l: 3, sp: 1, i: "",
    ph: [{ d: 60, tr: "none", p: [[6, 6], [6, 15], [6, 24], [15, 15]], a: [1, 2, 3, 0], st: 1,
      e: [{ n: "Bob", x: 38, y: 9, m: [[38, 21]], ms: 3, r: 1800, wh: 40, a: "you", pt: [] }] }],
    say: [[1, 1, "Catch this!"]], fx: [] };
}
// open a level in the editor (any format: it's cleaned into phases first)
function arLoadLevel(data) { AR = JSON.parse(JSON.stringify(arenaClean(data))); arPh = 0; PH = AR.ph[0]; arSel = PH.e.length ? 0 : -1; tlSel = null; }
function arUsePhase(i) { arPh = Math.max(0, Math.min(AR.ph.length - 1, i)); PH = AR.ph[arPh]; arSel = PH.e.length ? 0 : -1; arHot = -1; arEnemyShow(); }
const AR_HELP = { dot: "Click anywhere to add a dot you can stand on (up to 16).", arrow: "Click a dot, then the dot W should take you to. S goes back the same way.",
  start: "Click the dot you start on (it turns green).", enemy: "Click empty space to add an enemy (up to 6), or click one to change it.",
  path: "Click to add stops to the selected enemy's walk. It walks there and back. It can't walk over your dots.",
  pattern: "Click dots in the order the selected enemy shoots at them. It repeats the pattern.", erase: "Click a dot, an enemy or a walk stop to remove it." };
function arInit() {
  document.querySelectorAll("[data-mkmode]").forEach(b => b.onclick = () => { mkMode = b.dataset.mkmode; document.querySelectorAll("[data-mkmode]").forEach(x => x.classList.toggle("active", x === b)); el("mkBuild").hidden = mkMode !== "build"; el("mkQuick").hidden = mkMode !== "quick"; mkUpdate(); });
  document.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { arTool = b.dataset.tool; arHot = -1; document.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("active", x === b)); el("arHelp").textContent = AR_HELP[arTool]; arDraw(); });
  el("arHelp").textContent = AR_HELP.dot;
  el("arClear").onclick = () => { if (!confirm(`Clear phase ${arPh + 1}?`)) return; Object.assign(PH, { p: [], a: [], st: 0, e: [] }); arSel = -1; arShow(); };
  tlInit();
  el("arCanvas").addEventListener("pointerdown", arClick);
  el("arLoadBtn").onclick = () => {        // copy any level code into the level you have open (then Save it as yours)
    const lv = levelFromCode(el("arLoad").value); if (!lv) return toast("That isn't a level code", true);
    if (lv.data.v === 2) { arLoadLevel(lv.data); mkSetMode("build"); arShow(); } else { qkShow(lv.data); mkSetMode("quick"); mkUpdate(); }
    toast("Loaded into this level. Change it, then Save or Play.");
  };
  arShow();
}
// level -> the inputs
function arShow() {
  if (!AR.ph) arLoadLevel(AR); PH = AR.ph[Math.min(arPh, AR.ph.length - 1)];
  el("arName").value = AR.n || ""; el("arWin").value = AR.k ? "catch" : "survive"; el("arK").value = AR.k || 5; el("arL").value = AR.l; el("arSp").value = Math.round(AR.sp * 100); el("arIntro").value = AR.i || "";
  arEnemyShow(); mkUpdate();
}
function arEnemyShow() {
  const e = PH.e[arSel]; el("arEnemyBox").hidden = !e; if (!e) return;
  el("arEnTitle").textContent = `Enemy ${arSel + 1}`; el("arEnTitle").style.color = AR_COLS[arSel % AR_COLS.length];
  el("arEnName").value = e.n; el("arEnR").value = e.r; el("arEnWh").value = e.wh; el("arEnA").value = e.a; el("arEnMs").value = e.ms;
}
// the inputs -> level
function arRead() {
  AR.n = el("arName").value.trim(); AR.k = el("arWin").value === "catch" ? +el("arK").value : 0; AR.l = +el("arL").value; AR.sp = +el("arSp").value / 100; AR.i = cleanChat(el("arIntro").value);
  el("arKL").hidden = el("arWin").value !== "catch";
  el("arKV").textContent = el("arK").value; el("arLV").textContent = AR.l; el("arSpV").textContent = "×" + AR.sp.toFixed(1);
  const e = PH.e[arSel];
  if (e) {
    e.n = cleanChat(el("arEnName").value).slice(0, 16) || `Enemy ${arSel + 1}`; e.r = +el("arEnR").value; e.wh = +el("arEnWh").value; e.a = el("arEnA").value; e.ms = +el("arEnMs").value;
    el("arEnRV").textContent = (e.r / 1000).toFixed(1) + "s"; el("arEnWhV").textContent = e.wh + "%"; el("arEnMsV").textContent = e.ms ? e.ms + " squares/s" : "stands still";
    if (e.a === "pat" && !(e.pt || []).length) el("arHelp").textContent = "Now pick the ◎ Shoot pattern tool and click the dots it should shoot at, in order.";
  }
}
function arDraw() {
  const c = el("arCanvas").getContext("2d");
  arenaBoard(c, PH, { sel: arSel, paths: true, labels: true, hot: arHot });
  const e = PH.e[arSel];
  if (e && e.a === "pat") (e.pt || []).forEach((d, k) => { const q = PH.p[d]; if (!q) return; const [x, y] = arenaPx(q[0], q[1]); c.fillStyle = AR_COLS[arSel % AR_COLS.length]; c.font = "bold 12px system-ui"; c.textAlign = "left"; c.fillText("◎" + (k + 1), x + 12 + (k % 3) * 0, y + 16 + Math.floor(k / 3) * 0); });
  c.font = "bold 14px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#9aa3b5";
  c.fillText(`Phase ${arPh + 1}: ${PH.p.length}/${ARENA.DOTS} dots · ${PH.e.length}/${ARENA.ENEMIES} enemies`, 12, 14);
  el("arPhLabel").textContent = AR.ph.length > 1 ? `Editing phase ${arPh + 1} of ${AR.ph.length}` : "Your level";
  tlDraw();
}
function arGrid(ev) {
  const r = el("arCanvas").getBoundingClientRect(), px = (ev.clientX - r.left) * 960 / r.width, py = (ev.clientY - r.top) * 640 / r.height;
  return [Math.max(1, Math.min(ARENA.GX - 1, Math.round(px / 20))), Math.max(0, Math.min(ARENA.GY, Math.round((py - 20) / 20)))];
}
const arNear = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;
function arDotAt(g) { return PH.p.findIndex(d => arNear(d, g, 1.2)); }
function arEnemyAt(g) { return PH.e.findIndex(e => arNear([e.x, e.y], g, 1.5)); }
function arPathOk(e, k, q) {               // can enemy e's walk go through stop q (as stop number k)?
  const pts = [[e.x, e.y], ...e.m]; pts.splice(k + 1, 0, q);
  return PH.p.every(d => pts.every((p, i) => !i || segDist(d, pts[i - 1], p) >= ARENA.CLEAR));
}
function arClick(ev) {
  ev.preventDefault();
  const g = arGrid(ev), di = arDotAt(g), ei = arEnemyAt(g), e = PH.e[arSel];
  const say = m => toast(m, true);
  if (arTool === "dot") {
    if (di >= 0) return;
    if (PH.p.length >= ARENA.DOTS) return say(`${ARENA.DOTS} dots at most`);
    if (PH.e.some(x => [[x.x, x.y], ...x.m].some((p, i, a) => arNear(p, g, ARENA.CLEAR - 0.01) || (i && segDist(g, a[i - 1], p) < ARENA.CLEAR)))) return say("Too close to an enemy or its walk path");
    PH.p.push(g); PH.a.push(-1);
    if (PH.p.length > 1 && PH.a[PH.p.length - 2] < 0 && !PH.a.includes(PH.p.length - 1)) PH.a[PH.p.length - 2] = PH.p.length - 1;   // handy: new dots link on from the last one
  }
  if (arTool === "arrow") {
    if (di < 0) { arHot = -1; return arDraw(); }
    if (arHot < 0) { arHot = di; return arDraw(); }
    if (di === arHot) PH.a[arHot] = -1;                                      // click the same dot again: remove its arrow
    else { PH.a = PH.a.map(t => t === di ? -1 : t); PH.a[arHot] = di; }       // only one arrow into each dot
    arHot = -1;
  }
  if (arTool === "start" && di >= 0) PH.st = di;
  if (arTool === "enemy") {
    if (ei >= 0) arSel = ei;
    else {
      if (PH.e.length >= ARENA.ENEMIES) return say(`${ARENA.ENEMIES} enemies at most`);
      if (PH.p.some(d => arNear(d, g, ARENA.CLEAR - 0.01))) return say("Enemies can't stand on your dots");
      PH.e.push({ n: `Enemy ${PH.e.length + 1}`, x: g[0], y: g[1], m: [], ms: 3, r: 2000, wh: 40, a: "you", pt: [] }); arSel = PH.e.length - 1;
    }
    arEnemyShow();
  }
  if (arTool === "path") {
    if (!e) return say("Select an enemy first (■ Enemies tool)");
    if (e.m.length >= ARENA.WPTS) return say(`${ARENA.WPTS} walk stops at most`);
    if (!arPathOk(e, e.m.length, g)) return say("Enemies can't walk over your dots. Pick another spot.");
    e.m.push(g); if (!e.ms) { e.ms = 3; arEnemyShow(); }
  }
  if (arTool === "pattern") {
    if (!e) return say("Select an enemy first (■ Enemies tool)");
    if (di < 0) return;
    e.pt = (e.pt || []).concat(di).slice(-ARENA.PAT); e.a = "pat"; arEnemyShow();
  }
  if (arTool === "erase") {
    const wi = PH.e.map((x, i) => [i, x.m.findIndex(p => arNear(p, g, 1))]).find(([, k]) => k >= 0);
    if (ei >= 0) { PH.e.splice(ei, 1); arSel = Math.min(arSel, PH.e.length - 1); arEnemyShow(); }
    else if (wi) PH.e[wi[0]].m.splice(wi[1], 1);
    else if (di >= 0) {
      const fix = t => t === di ? -1 : t > di ? t - 1 : t;
      PH.p.splice(di, 1); PH.a.splice(di, 1); PH.a = PH.a.map(fix);
      PH.st = PH.st === di ? 0 : PH.st > di ? PH.st - 1 : PH.st;
      PH.e.forEach(x => { x.pt = (x.pt || []).filter(d => d !== di).map(d => d > di ? d - 1 : d); if (x.a === "pat" && !x.pt.length) x.a = "you"; });
    }
  }
  mkUpdate();
}

// ======================================================================
//  The timeline: phases (row 1), speech (row 2), flashes/shakes (row 3).
//  120 seconds across. Click to add or pick, drag to move.
// ======================================================================
const TL = { X0: 70, W: 880, ROW: [[26, 66], [76, 116], [126, 166]] }, TL_SEC = TL.W / ARENA.MAX_SEC;
let tlSel = null, tlDrag = null;
const tlX = sec => TL.X0 + sec * TL_SEC, tlSec = x => Math.max(0, Math.min(ARENA.MAX_SEC, (x - TL.X0) / TL_SEC));
const tlEnd = () => AR.ph.reduce((t, q) => t + q.d, 0);
const tlStarts = () => { const s = []; AR.ph.reduce((t, q) => { s.push(t); return t + q.d; }, 0); return s; };
const tlPhaseAt = sec => { const s = tlStarts(); let i = 0; while (i + 1 < s.length && sec >= s[i + 1]) i++; return i; };
const TR_NAMES = { none: "No transition", fade: "Fade out and in", left: "Slide left", right: "Slide right", up: "Slide up", down: "Slide down" };
function tlInit() {
  const cv = el("tlCanvas");
  cv.addEventListener("pointerdown", tlDown); cv.addEventListener("pointermove", tlMove);
  cv.addEventListener("pointerup", tlUp); cv.addEventListener("pointercancel", tlUp);
  el("tlAddPhase").onclick = () => {
    if (AR.ph.length >= ARENA.PHASES) return toast(`${ARENA.PHASES} phases at most`, true);
    const room = ARENA.MAX_SEC - tlEnd(); if (room < ARENA.MIN_PHASE) return toast(`No room: the level is already ${tlEnd()}s (120s at most). Shorten a phase first.`, true);
    const copy = JSON.parse(JSON.stringify(AR.ph[AR.ph.length - 1]));      // starts as a copy, so "same map, new attacks" is easy
    copy.d = Math.min(20, room); copy.tr = "fade"; AR.ph.push(copy);
    arUsePhase(AR.ph.length - 1); tlSel = { kind: "phase", i: arPh }; tlBoxShow(); mkUpdate();
  };
  el("tlDelPhase").onclick = () => {
    if (AR.ph.length < 2) return toast("A level needs at least one phase", true);
    if (!confirm(`Delete phase ${arPh + 1}?`)) return;
    AR.ph.splice(arPh, 1); AR.ph[0].tr = "none"; tlTrim(); arUsePhase(Math.min(arPh, AR.ph.length - 1)); tlSel = null; tlBoxShow(); mkUpdate();
  };
}
function tlTrim() { const end = tlEnd(); AR.say = AR.say.filter(l => l[0] < end); AR.fx = AR.fx.filter(f => f[0] < end); }
function tlPoint(ev) { const r = el("tlCanvas").getBoundingClientRect(); return [(ev.clientX - r.left) * 960 / r.width, (ev.clientY - r.top) * 190 / r.height]; }
function tlRowAt(y) { return TL.ROW.findIndex(([a, b]) => y >= a - 4 && y <= b + 4); }
function tlDown(ev) {
  ev.preventDefault();
  const [x, y] = tlPoint(ev), row = tlRowAt(y), sec = tlSec(x), end = tlEnd();
  el("tlCanvas").setPointerCapture(ev.pointerId);
  if (row === 0) {
    const st = tlStarts(), edge = AR.ph.findIndex((q, i) => Math.abs(tlX(st[i] + q.d) - x) < 8);
    if (edge >= 0) { tlDrag = { kind: "edge", i: edge }; return; }                   // drag a phase's right edge
    if (sec < end) { arUsePhase(tlPhaseAt(sec)); tlSel = { kind: "phase", i: arPh }; tlBoxShow(); mkUpdate(); }
    return;
  }
  if (row === 1) {
    const hit = AR.say.findIndex(l => x >= tlX(l[0]) - 5 && x <= tlX(l[0]) + 18);           // the pin at its time (lines can be close together)
    if (hit >= 0) { tlSel = { kind: "say", i: hit }; tlDrag = { kind: "say", i: hit, dx: x - tlX(AR.say[hit][0]), moved: false }; tlBoxShow(); return tlDraw(); }
    if (sec >= end) return toast("That's after the end of the level", true);
    if (AR.say.length >= ARENA.SAYS) return toast(`${ARENA.SAYS} lines at most`, true);
    const t = Math.round(sec * 2) / 2, P = AR.ph[tlPhaseAt(t)];
    AR.say.push([t, P.e.length ? 1 : 0, ""]); AR.say.sort((a, b) => a[0] - b[0]);
    tlSel = { kind: "say", i: AR.say.findIndex(l => l[0] === t && l[2] === "") }; tlBoxShow(); mkUpdate();
    setTimeout(() => { const i = el("tlSayText"); if (i) i.focus(); }, 0);
    return;
  }
  if (row === 2) {
    const hit = AR.fx.findIndex(f => x >= tlX(f[0]) - 3 && x <= tlX(f[0] + f[2] / 1000) + 3);
    if (hit >= 0) { tlSel = { kind: "fx", i: hit }; tlDrag = { kind: "fx", i: hit, dx: x - tlX(AR.fx[hit][0]) }; tlBoxShow(); return tlDraw(); }
    if (sec >= end) return toast("That's after the end of the level", true);
    if (AR.fx.length >= ARENA.FX) return toast(`${ARENA.FX} effects at most`, true);
    const f = [Math.round(sec * 10) / 10, "f", 300, 5, "#ffffff"];
    if (!tlFxFits(f, -1)) return toast("Effects can't overlap (and flashes need a third of a second between them)", true);
    AR.fx.push(f); AR.fx.sort((a, b) => a[0] - b[0]); tlSel = { kind: "fx", i: AR.fx.indexOf(f) }; tlBoxShow(); mkUpdate();
  }
}
function tlMove(ev) {
  if (!tlDrag) return;
  const [x] = tlPoint(ev);
  if (tlDrag.kind === "edge") {
    const st = tlStarts(), q = AR.ph[tlDrag.i], others = tlEnd() - q.d;
    q.d = Math.max(ARENA.MIN_PHASE, Math.min(ARENA.MAX_SEC - others, Math.round(tlSec(x) - st[tlDrag.i])));
  } else if (tlDrag.kind === "say") {
    const l = AR.say[tlDrag.i]; l[0] = Math.max(0, Math.min(tlEnd() - 0.5, Math.round(tlSec(x - tlDrag.dx) * 2) / 2)); tlDrag.moved = true;
  } else if (tlDrag.kind === "fx") {
    const f = AR.fx[tlDrag.i], t = Math.max(0, Math.min(tlEnd() - f[2] / 1000, Math.round(tlSec(x - tlDrag.dx) * 10) / 10));
    if (tlFxFits([t, f[1], f[2]], tlDrag.i)) f[0] = t;                   // never onto another effect
  }
  tlDraw();
}
function tlUp() {
  if (!tlDrag) return;
  if (tlDrag.kind === "edge") { tlTrim(); }
  if (tlDrag.kind === "say") { const l = AR.say[tlDrag.i]; AR.say.sort((a, b) => a[0] - b[0]); tlSel = { kind: "say", i: AR.say.indexOf(l) }; }
  if (tlDrag.kind === "fx") { const f = AR.fx[tlDrag.i]; AR.fx.sort((a, b) => a[0] - b[0]); tlSel = { kind: "fx", i: AR.fx.indexOf(f) }; }
  tlDrag = null; tlBoxShow(); mkUpdate();
}
// does effect f fit (no overlap, flashes a third of a second apart), ignoring effect number skip?
function tlFxFits(f, skip) {
  const a0 = f[0], a1 = f[0] + f[2] / 1000;
  return AR.fx.every((g, i) => i === skip || ((a1 <= g[0] || a0 >= g[0] + g[2] / 1000) && !(f[1] === "f" && g[1] === "f" && Math.abs(a0 - g[0]) < 0.34)));
}
function tlDraw() {
  const cv = el("tlCanvas"); if (!cv || !AR.ph) return;
  const c = cv.getContext("2d"), end = tlEnd(), st = tlStarts();
  c.clearRect(0, 0, 960, 190);
  c.font = "bold 12px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#9aa3b5";
  ["Phases", "Speech", "Effects"].forEach((n, i) => c.fillText(n, 8, TL.ROW[i][0] + 24));
  for (let s = 0; s <= ARENA.MAX_SEC; s += 10) { c.fillStyle = "#596075"; c.textAlign = "center"; c.fillText(s + "s", tlX(s), 14); c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(tlX(s), 20, 1, 150); }
  c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(tlX(end), 20, tlX(ARENA.MAX_SEC) - tlX(end), 150);      // after the end
  AR.ph.forEach((q, i) => {
    const x0 = tlX(st[i]), x1 = tlX(st[i] + q.d), [y0, y1] = TL.ROW[0];
    c.fillStyle = ["#3949ab", "#00897b", "#8e24aa"][i]; c.globalAlpha = i === arPh ? 1 : 0.55; c.beginPath(); c.roundRect(x0 + 1, y0, x1 - x0 - 2, y1 - y0, 6); c.fill(); c.globalAlpha = 1;
    if (i === arPh) { c.strokeStyle = "#ffd54f"; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = "#fff"; c.textAlign = "left"; c.font = "bold 12px Nunito, system-ui";
    c.fillText(`Phase ${i + 1} · ${q.d}s`, x0 + 8, y0 + 17);
    if (i > 0) { c.font = "11px Nunito, system-ui"; c.fillText(TR_NAMES[q.tr] || "", x0 + 8, y0 + 33); }
    c.fillStyle = "#fff"; c.fillRect(x1 - 3, y0 + 8, 2, y1 - y0 - 16);                          // drag handle
  });
  c.fillStyle = "#ffd54f"; c.fillRect(tlX(end) - 1, 20, 3, 150); c.textAlign = "center"; c.font = "bold 11px Nunito, system-ui"; c.fillText(`END ${end}s`, Math.min(tlX(end), 930), 186);
  AR.say.forEach((l, i) => {
    const x = tlX(l[0]), [y0] = TL.ROW[1], sel = tlSel && tlSel.kind === "say" && tlSel.i === i;
    c.fillStyle = sel ? "#ffd54f" : "#fff"; c.fillRect(x - 1, y0 + 2, 3, 36);                                  // the pin: when it's said
    c.beginPath(); c.roundRect(x + 2, y0 + 8 + (i % 2) * 14, 16, 14, 4); c.fill();
    c.globalAlpha = 0.85; c.fillStyle = sel ? "#ffd54f" : "#cfd3dc"; c.textAlign = "left"; c.font = "10px Nunito, system-ui"; c.fillText((l[2] || "…").slice(0, 10), x + 20, y0 + 19 + (i % 2) * 14); c.globalAlpha = 1;
  });
  AR.fx.forEach((f, i) => {
    const x0 = tlX(f[0]), x1 = Math.max(x0 + 6, tlX(f[0] + f[2] / 1000)), [y0, y1] = TL.ROW[2], sel = tlSel && tlSel.kind === "fx" && tlSel.i === i;
    c.fillStyle = f[1] === "f" ? f[4] : "#78909c"; c.globalAlpha = 0.35 + f[3] / 16; c.fillRect(x0, y0 + 4, x1 - x0, y1 - y0 - 8); c.globalAlpha = 1;
    if (sel) { c.strokeStyle = "#ffd54f"; c.lineWidth = 2; c.strokeRect(x0, y0 + 4, x1 - x0, y1 - y0 - 8); }
    c.fillStyle = f[1] === "f" && f[4] > "#999999" ? "#111" : "#fff"; c.font = "bold 11px Nunito, system-ui"; c.textAlign = "left"; c.fillText(f[1] === "f" ? "⚡" : "≋", x0 + 2, y0 + 25);
  });
  el("tlInfo").textContent = `${AR.ph.length}/${ARENA.PHASES} phases · ends at ${end}s (120s at most) · ${AR.say.length} lines · ${AR.fx.length} effects`;
  el("tlDelPhase").hidden = AR.ph.length < 2; el("tlAddPhase").disabled = AR.ph.length >= ARENA.PHASES;
}
// the settings box under the timeline, for whatever is picked
function tlBoxShow() {
  const box = el("tlBox"); if (!tlSel) { box.hidden = true; return; }
  box.hidden = false;
  if (tlSel.kind === "phase") {
    const q = AR.ph[tlSel.i]; if (!q) { box.hidden = true; return; }
    box.innerHTML = `<div class="row"><b>Phase ${tlSel.i + 1}</b>
      <label>Lasts <input id="tlPhD" type="number" min="${ARENA.MIN_PHASE}" max="120" value="${q.d}" style="width:70px"> seconds</label>
      ${tlSel.i ? `<label>Transition into it <select id="tlPhTr">${ARENA.TR.map(t => `<option value="${t}" ${q.tr === t ? "selected" : ""}>${TR_NAMES[t]}</option>`).join("")}</select></label>` : `<span class="muted small">The first phase starts straight away.</span>`}</div>
      <div class="muted small">Its dots, arrows and enemies are on the board above. It can be totally different from the other phases, or the same map with new attacks.</div>`;
    el("tlPhD").onchange = () => { const others = tlEnd() - q.d; q.d = Math.max(ARENA.MIN_PHASE, Math.min(ARENA.MAX_SEC - others, Math.round(+el("tlPhD").value || q.d))); el("tlPhD").value = q.d; tlTrim(); mkUpdate(); };
    if (tlSel.i) el("tlPhTr").onchange = () => { q.tr = el("tlPhTr").value; mkUpdate(); };
  } else if (tlSel.kind === "say") {
    const l = AR.say[tlSel.i]; if (!l) { box.hidden = true; return; }
    const P = AR.ph[tlPhaseAt(l[0])];
    box.innerHTML = `<div class="row"><b>Line at ${l[0]}s</b> <label>Who says it <select id="tlSayWho"><option value="0">No one (top of the screen)</option>${P.e.map((e, i) => `<option value="${i + 1}" ${l[1] === i + 1 ? "selected" : ""}>${esc(e.n)}</option>`).join("")}</select></label>
      <input id="tlSayText" maxlength="${ARENA.LINE_MAX}" placeholder="What they say…" value="${escHtml(l[2])}" style="flex:1;min-width:200px"><button type="button" class="secondary" id="tlSayDel">Delete</button></div>`;
    if (!l[1]) el("tlSayWho").value = "0";
    el("tlSayWho").onchange = () => { l[1] = +el("tlSayWho").value; mkUpdate(); };
    el("tlSayText").oninput = () => { const v = el("tlSayText").value, c = cleanChat(v); l[2] = c; tlDraw(); mkShowCode(); };
    el("tlSayText").onchange = () => { const v = el("tlSayText").value; if (v && cleanChat(v) !== v.trim()) { el("tlSayText").value = cleanChat(v); toast("Swear words aren't allowed", true); } l[2] = cleanChat(v); mkUpdate(); };
    el("tlSayDel").onclick = () => { AR.say.splice(tlSel.i, 1); tlSel = null; tlBoxShow(); mkUpdate(); };
  } else if (tlSel.kind === "fx") {
    const f = AR.fx[tlSel.i]; if (!f) { box.hidden = true; return; }
    box.innerHTML = `<div class="row"><b>Effect at ${f[0]}s</b>
      <label><select id="tlFxK"><option value="f" ${f[1] === "f" ? "selected" : ""}>Flash</option><option value="s" ${f[1] === "s" ? "selected" : ""}>Shake</option></select></label>
      <label>Length <input id="tlFxMs" type="number" min="100" max="2000" step="100" value="${f[2]}" style="width:80px"> ms</label>
      <label>Strength <b id="tlFxSV">${f[3]}</b> <input id="tlFxS" type="range" min="1" max="10" value="${f[3]}"></label>
      ${f[1] === "f" ? `<label>Colour <input id="tlFxC" type="color" value="${f[4] || "#ffffff"}"></label>` : ""}
      <button type="button" class="secondary" id="tlFxTry">Preview</button><button type="button" class="secondary" id="tlFxDel">Delete</button></div>
      <div class="muted small">Never two effects at once. Flashes are limited to 3 a second, and players see a flashing-lights warning before any made level.</div>`;
    const upd = (k, v) => { const g = f.slice(); g[k] = v; if (k === 1 && v === "f" && !g[4]) g[4] = "#ffffff"; if (!tlFxFits(g, tlSel.i)) { toast("That would overlap another effect", true); tlBoxShow(); return; } f[k] = v; if (k === 1) { if (v === "f") f[4] = f[4] || "#ffffff"; tlBoxShow(); } mkUpdate(); };
    el("tlFxK").onchange = () => upd(1, el("tlFxK").value);
    el("tlFxMs").onchange = () => upd(2, Math.max(100, Math.min(2000, Math.round(+el("tlFxMs").value / 100) * 100 || 300)));
    el("tlFxS").oninput = () => { f[3] = +el("tlFxS").value; el("tlFxSV").textContent = f[3]; mkUpdate(); };
    if (el("tlFxC")) el("tlFxC").oninput = () => { f[4] = el("tlFxC").value; mkUpdate(); };
    el("tlFxTry").onclick = () => tlPreview(f);
    el("tlFxDel").onclick = () => { AR.fx.splice(tlSel.i, 1); tlSel = null; tlBoxShow(); mkUpdate(); };
  }
}
// show an effect on the editor's board for a moment
function tlPreview(f) {
  const cv = el("arCanvas"), t0 = performance.now(), dur = f[2];
  const step = () => {
    const k = 1 - (performance.now() - t0) / dur; arDraw();
    if (k <= 0) { cv.style.transform = ""; return; }
    const c = cv.getContext("2d");
    if (f[1] === "f") { let dim = false; try { dim = localStorage.getItem("cc_dimfx") === "1"; } catch (e) {} c.globalAlpha = Math.min(0.85, f[3] / 10 * 0.85 * k * (dim ? 0.3 : 1)); c.fillStyle = f[4]; c.fillRect(0, 0, 960, 640); c.globalAlpha = 1; }
    else { const m = f[3] * 1.8 * k * (cv.getBoundingClientRect().width / 960); cv.style.transform = `translate(${(Math.random() * 2 - 1) * m}px, ${(Math.random() * 2 - 1) * m}px)`; }
    requestAnimationFrame(step);
  };
  step();
}
