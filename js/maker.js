// ======================================================================
//  maker.js: the Level Maker (unlocked by beating World 4).
//  A level is just a few settings packed into a share code (CC4-…), so
//  making and sharing levels stores nothing. Publishing puts it on the
//  list everyone can browse (3 per player).
// ======================================================================
let JOIN_EXTRA = "", mkData = null;
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
    arInit();
  }
  mkUpdate(); mkTab(mkCur);
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
  if (mkMode === "build") { arRead(); arDraw(); el("mkCode").value = levelToCode(AR); try { localStorage.setItem("cc_ar", JSON.stringify(AR)); } catch (e) {} return; }
  const t = el("mkType").value;
  el("makerModal").querySelectorAll("[data-for]").forEach(x => x.hidden = !x.dataset.for.split(" ").includes(t));
  el("mkWaves").max = t === "boss" ? 40 : 20; el("mkWaves").min = t === "boss" ? 10 : 3;
  const sp = +el("mkSpeed").value;
  el("mkLanesV").textContent = el("mkLanes").value; el("mkWavesV").textContent = el("mkWaves").value; el("mkBallsV").textContent = el("mkBalls").value;
  el("mkNeedV").textContent = el("mkNeed").value; el("mkHpV").textContent = el("mkHp").value;
  el("mkSpeedV").textContent = sp === 100 ? "normal" : sp < 100 ? `${100 - sp}% faster` : `${sp - 100}% slower`;
  document.querySelectorAll("[data-mod]").forEach(i => { el("mkM_" + i.dataset.mod + "V").textContent = i.value + "%"; });
  el("mkCode").value = levelToCode(mkLevel());
}
function playLevelCode(code, id) {
  if (!levelFromCode(code)) return toast("That isn't a level code", true);
  JOIN_EXTRA = "&lvl=" + encodeURIComponent(code) + (id ? "&lvlid=" + id : "");
  enterRoom(async () => "CUSTOM" + Math.random().toString(36).slice(2, 10).toUpperCase()).finally(() => { JOIN_EXTRA = ""; });
}
el("mkPlay").onclick = () => playLevelCode(el("mkCode").value);
el("mkCopy").onclick = async () => { try { await navigator.clipboard.writeText(el("mkCode").value); toast("Level code copied: send it to a friend!"); } catch (e) { el("mkCode").select(); toast("Select the code and copy it"); } };
el("mkPasteBtn").onclick = async () => { try { el("mkPlayCode").value = (await navigator.clipboard.readText()).trim(); } catch (e) { el("mkPlayCode").focus(); toast("Press Ctrl+V to paste the code"); } };
el("mkPlayCodeBtn").onclick = () => playLevelCode(el("mkPlayCode").value.trim());
el("mkPublish").onclick = async () => {
  try { const r = await api("lvlPublish", { code: el("mkCode").value }); toast("Published! It shows on the list within 10 minutes."); if (mkData) mkData.mine = r.mine; mkTab("mine"); }
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
  const code = id => (all[id] && all[id].code) || null;
  document.querySelectorAll("[data-mkplay]").forEach(b => b.onclick = () => { const c = code(b.dataset.mkplay); if (c) playLevelCode(c, b.dataset.mkplay); else toast("It's not on the list yet (it updates every 10 minutes)", true); });
  document.querySelectorAll("[data-mkcopy]").forEach(b => b.onclick = async () => { const c = code(b.dataset.mkcopy); if (!c) return toast("It's not on the list yet", true); try { await navigator.clipboard.writeText(c); toast("Code copied"); } catch (e) { el("mkPlayCode").value = c; } });
  document.querySelectorAll("[data-mklike]").forEach(b => b.onclick = async () => { try { await api("lvlLike", { id: b.dataset.mklike }); document.querySelectorAll(`[data-mklike="${b.dataset.mklike}"]`).forEach(x => { x.textContent = "♥ Liked"; x.disabled = true; }); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll("[data-mkpick]").forEach(b => b.onclick = async () => { try { await api("lvlPick", { id: b.dataset.mkpick, on: b.dataset.on === "1" }); mkLoad(); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll("[data-mkdel]").forEach(b => b.onclick = async () => { if (!confirm("Delete this level?")) return; try { await api("lvlDelete", { id: b.dataset.mkdel }); toast("Deleted"); mkLoad(); } catch (e) { toast(e.message, true); } });
}

// ======================================================================
//  Build your own: place dots, draw the W/S arrows between them, put
//  enemies anywhere (not on your dots), give them walk paths, shoot
//  patterns and lines to say. The level is still just a share code.
// ======================================================================
let mkMode = "build", arTool = "dot", arSel = -1, arHot = -1;
let AR = arStarter();
try { const saved = JSON.parse(localStorage.getItem("cc_ar") || "null"); if (saved && saved.v === 2) AR = saved; } catch (e) {}   // your level is kept while you play-test it
function arStarter() {
  return { v: 2, n: "", p: [[6, 6], [6, 15], [6, 24], [15, 15]], a: [1, 2, 3, 0], st: 1,
    e: [{ n: "Bob", x: 38, y: 9, m: [[38, 21]], ms: 3, r: 1800, wh: 40, a: "you", pt: [], t: [[1, "Catch this!"]] }], k: 5, w: 45, l: 3, sp: 1, i: "" };
}
const AR_HELP = { dot: "Click anywhere to add a dot you can stand on (up to 16).", arrow: "Click a dot, then the dot W should take you to. S goes back the same way.",
  start: "Click the dot you start on (it turns green).", enemy: "Click empty space to add an enemy (up to 6), or click one to change it.",
  path: "Click to add stops to the selected enemy's walk. It walks there and back. It can't walk over your dots.",
  pattern: "Click dots in the order the selected enemy shoots at them. It repeats the pattern.", erase: "Click a dot, an enemy or a walk stop to remove it." };
function arInit() {
  document.querySelectorAll("[data-mkmode]").forEach(b => b.onclick = () => { mkMode = b.dataset.mkmode; document.querySelectorAll("[data-mkmode]").forEach(x => x.classList.toggle("active", x === b)); el("mkBuild").hidden = mkMode !== "build"; el("mkQuick").hidden = mkMode !== "quick"; mkUpdate(); });
  document.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { arTool = b.dataset.tool; arHot = -1; document.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("active", x === b)); el("arHelp").textContent = AR_HELP[arTool]; arDraw(); });
  el("arHelp").textContent = AR_HELP.dot;
  el("arClear").onclick = () => { if (!confirm("Clear the whole level?")) return; AR = { v: 2, n: AR.n, p: [], a: [], st: 0, e: [], k: AR.k, w: AR.w, l: AR.l, sp: AR.sp, i: AR.i }; arSel = -1; arShow(); };
  el("arCanvas").addEventListener("pointerdown", arClick);
  el("arLoadBtn").onclick = () => { const lv = levelFromCode(el("arLoad").value); if (!lv || lv.data.v !== 2) return toast("That isn't a Build-your-own level code", true); AR = JSON.parse(JSON.stringify(lv.data)); arSel = AR.e.length ? 0 : -1; arShow(); toast("Loaded. Change it, then Play or Publish."); };
  arShow();
}
// level -> the inputs
function arShow() {
  el("arName").value = AR.n || ""; el("arWin").value = AR.k ? "catch" : "survive"; el("arK").value = AR.k || 5; el("arW").value = AR.w; el("arL").value = AR.l; el("arSp").value = Math.round(AR.sp * 100); el("arIntro").value = AR.i || "";
  arEnemyShow(); mkUpdate();
}
function arEnemyShow() {
  const e = AR.e[arSel]; el("arEnemyBox").hidden = !e; if (!e) return;
  el("arEnTitle").textContent = `Enemy ${arSel + 1}`; el("arEnTitle").style.color = AR_COLS[arSel % AR_COLS.length];
  el("arEnName").value = e.n; el("arEnR").value = e.r; el("arEnWh").value = e.wh; el("arEnA").value = e.a; el("arEnMs").value = e.ms;
  const lines = (e.t || []).concat([[0, ""], [0, ""], [0, ""], [0, ""]]).slice(0, ARENA.LINES);   // always 4 rows to fill in
  el("arLines").innerHTML = lines.map((l, i) => `<div class="row"><input class="sec" type="number" min="0" max="600" value="${+l[0] || 0}" data-ls="${i}"><span class="muted small">s</span><input maxlength="60" value="${escHtml(l[1] || "")}" data-lt="${i}" placeholder="Something to say…"></div>`).join("");
  el("arLines").querySelectorAll("input").forEach(i => i.addEventListener("change", () => { arReadLines(); mkUpdate(); }));
}
function arReadLines() {
  const e = AR.e[arSel]; if (!e) return;
  e.t = [...el("arLines").querySelectorAll("[data-lt]")].map(i => { if (i.value && cleanChat(i.value) !== i.value.trim()) { i.value = cleanChat(i.value); toast("Swear words aren't allowed", true); } return [+el("arLines").querySelector(`[data-ls="${i.dataset.lt}"]`).value || 0, cleanChat(i.value)]; }).filter(l => l[1]).sort((x, y) => x[0] - y[0]);
}
// the inputs -> level
function arRead() {
  AR.n = el("arName").value.trim(); AR.k = el("arWin").value === "catch" ? +el("arK").value : 0; AR.w = +el("arW").value; AR.l = +el("arL").value; AR.sp = +el("arSp").value / 100; AR.i = cleanChat(el("arIntro").value);
  el("arKL").hidden = el("arWin").value !== "catch"; el("arWL").hidden = el("arWin").value === "catch";
  el("arKV").textContent = el("arK").value; el("arWV").textContent = el("arW").value + "s"; el("arLV").textContent = AR.l; el("arSpV").textContent = "×" + AR.sp.toFixed(1);
  const e = AR.e[arSel];
  if (e) {
    e.n = cleanChat(el("arEnName").value).slice(0, 16) || `Enemy ${arSel + 1}`; e.r = +el("arEnR").value; e.wh = +el("arEnWh").value; e.a = el("arEnA").value; e.ms = +el("arEnMs").value;
    el("arEnRV").textContent = (e.r / 1000).toFixed(1) + "s"; el("arEnWhV").textContent = e.wh + "%"; el("arEnMsV").textContent = e.ms ? e.ms + " squares/s" : "stands still";
    if (e.a === "pat" && !(e.pt || []).length) el("arHelp").textContent = "Now pick the ◎ Shoot pattern tool and click the dots it should shoot at, in order.";
  }
}
function arDraw() {
  const c = el("arCanvas").getContext("2d");
  arenaBoard(c, AR, { sel: arSel, paths: true, labels: true, hot: arHot });
  const e = AR.e[arSel];
  if (e && e.a === "pat") (e.pt || []).forEach((d, k) => { const q = AR.p[d]; if (!q) return; const [x, y] = arenaPx(q[0], q[1]); c.fillStyle = AR_COLS[arSel % AR_COLS.length]; c.font = "bold 12px system-ui"; c.textAlign = "left"; c.fillText("◎" + (k + 1), x + 12 + (k % 3) * 0, y + 16 + Math.floor(k / 3) * 0); });
  c.font = "bold 14px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#9aa3b5";
  c.fillText(`${AR.p.length}/${ARENA.DOTS} dots · ${AR.e.length}/${ARENA.ENEMIES} enemies`, 12, 14);
}
function arGrid(ev) {
  const r = el("arCanvas").getBoundingClientRect(), px = (ev.clientX - r.left) * 960 / r.width, py = (ev.clientY - r.top) * 640 / r.height;
  return [Math.max(1, Math.min(ARENA.GX - 1, Math.round(px / 20))), Math.max(0, Math.min(ARENA.GY, Math.round((py - 20) / 20)))];
}
const arNear = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;
function arDotAt(g) { return AR.p.findIndex(d => arNear(d, g, 1.2)); }
function arEnemyAt(g) { return AR.e.findIndex(e => arNear([e.x, e.y], g, 1.5)); }
function arPathOk(e, k, q) {               // can enemy e's walk go through stop q (as stop number k)?
  const pts = [[e.x, e.y], ...e.m]; pts.splice(k + 1, 0, q);
  return AR.p.every(d => pts.every((p, i) => !i || segDist(d, pts[i - 1], p) >= ARENA.CLEAR));
}
function arClick(ev) {
  ev.preventDefault();
  const g = arGrid(ev), di = arDotAt(g), ei = arEnemyAt(g), e = AR.e[arSel];
  const say = m => toast(m, true);
  if (arTool === "dot") {
    if (di >= 0) return;
    if (AR.p.length >= ARENA.DOTS) return say(`${ARENA.DOTS} dots at most`);
    if (AR.e.some(x => [[x.x, x.y], ...x.m].some((p, i, a) => arNear(p, g, ARENA.CLEAR - 0.01) || (i && segDist(g, a[i - 1], p) < ARENA.CLEAR)))) return say("Too close to an enemy or its walk path");
    AR.p.push(g); AR.a.push(-1);
    if (AR.p.length > 1 && AR.a[AR.p.length - 2] < 0 && !AR.a.includes(AR.p.length - 1)) AR.a[AR.p.length - 2] = AR.p.length - 1;   // handy: new dots link on from the last one
  }
  if (arTool === "arrow") {
    if (di < 0) { arHot = -1; return arDraw(); }
    if (arHot < 0) { arHot = di; return arDraw(); }
    if (di === arHot) AR.a[arHot] = -1;                                      // click the same dot again: remove its arrow
    else { AR.a = AR.a.map(t => t === di ? -1 : t); AR.a[arHot] = di; }       // only one arrow into each dot
    arHot = -1;
  }
  if (arTool === "start" && di >= 0) AR.st = di;
  if (arTool === "enemy") {
    if (ei >= 0) arSel = ei;
    else {
      if (AR.e.length >= ARENA.ENEMIES) return say(`${ARENA.ENEMIES} enemies at most`);
      if (AR.p.some(d => arNear(d, g, ARENA.CLEAR - 0.01))) return say("Enemies can't stand on your dots");
      AR.e.push({ n: `Enemy ${AR.e.length + 1}`, x: g[0], y: g[1], m: [], ms: 3, r: 2000, wh: 40, a: "you", pt: [], t: [] }); arSel = AR.e.length - 1;
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
    const wi = AR.e.map((x, i) => [i, x.m.findIndex(p => arNear(p, g, 1))]).find(([, k]) => k >= 0);
    if (ei >= 0) { AR.e.splice(ei, 1); arSel = Math.min(arSel, AR.e.length - 1); arEnemyShow(); }
    else if (wi) AR.e[wi[0]].m.splice(wi[1], 1);
    else if (di >= 0) {
      const fix = t => t === di ? -1 : t > di ? t - 1 : t;
      AR.p.splice(di, 1); AR.a.splice(di, 1); AR.a = AR.a.map(fix);
      AR.st = AR.st === di ? 0 : AR.st > di ? AR.st - 1 : AR.st;
      AR.e.forEach(x => { x.pt = (x.pt || []).filter(d => d !== di).map(d => d > di ? d - 1 : d); if (x.a === "pat" && !x.pt.length) x.a = "you"; });
    }
  }
  mkUpdate();
}
