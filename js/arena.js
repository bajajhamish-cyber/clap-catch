// ======================================================================
//  arena.js: drawing "Build your own" Level Maker levels (the game and
//  the editor share arenaBoard). Server rules are in server/src/arena.js.
// ======================================================================
const AR_COLS = ["#e53935", "#fb8c00", "#8e24aa", "#00897b", "#3949ab", "#6d4c41"];
function arenaArrow(c, a, b, col, w) {
  const [x1, y1] = arenaPx(a[0], a[1]), [x2, y2] = arenaPx(b[0], b[1]), ang = Math.atan2(y2 - y1, x2 - x1), r = 16;
  const sx = x1 + Math.cos(ang) * r, sy = y1 + Math.sin(ang) * r, ex = x2 - Math.cos(ang) * r, ey = y2 - Math.sin(ang) * r;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w || 3;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
  c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(ang - 0.45) * 13, ey - Math.sin(ang - 0.45) * 13); c.lineTo(ex - Math.cos(ang + 0.45) * 13, ey - Math.sin(ang + 0.45) * 13); c.closePath(); c.fill();
}
function arenaEnemy(c, e, i, x, y, sel) {
  const s = 40;
  c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x - s / 2 + 4, y - s / 2 + 5, s, s);
  c.fillStyle = AR_COLS[i % AR_COLS.length]; c.fillRect(x - s / 2, y - s / 2, s, s);
  c.fillStyle = "#fff"; c.fillRect(x - 11, y - 7, 6, 6); c.fillRect(x + 5, y - 7, 6, 6);
  c.fillStyle = "#111"; c.fillRect(x - 13, y - 12, 9, 3); c.fillRect(x + 4, y - 12, 9, 3);
  if (sel) { c.strokeStyle = "#ffd54f"; c.lineWidth = 3; c.strokeRect(x - s / 2 - 5, y - s / 2 - 5, s + 10, s + 10); }
  c.font = "bold 13px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(e.n, x, y + s / 2 + 16);
}
// the board: arrows, dots, enemy paths (editor), enemies. opts: { at(i) -> [x,y] grid, sel, paths, labels }
function arenaBoard(c, A, opts) {
  opts = opts || {};
  c.fillStyle = "#151821"; c.fillRect(0, 0, 960, 640);
  c.strokeStyle = "rgba(255,255,255,.035)"; c.lineWidth = 1;
  for (let x = 0; x <= 48; x++) { c.beginPath(); c.moveTo(x * 20, 20); c.lineTo(x * 20, 620); c.stroke(); }
  for (let y = 0; y <= 30; y++) { c.beginPath(); c.moveTo(0, 20 + y * 20); c.lineTo(960, 20 + y * 20); c.stroke(); }
  if (opts.paths) A.e.forEach((e, i) => {                       // where each enemy walks
    const pts = [[e.x, e.y], ...(e.m || [])]; if (pts.length < 2) return;
    c.setLineDash([6, 8]); c.strokeStyle = AR_COLS[i % AR_COLS.length]; c.lineWidth = 2; c.beginPath();
    pts.forEach((p, k) => { const [x, y] = arenaPx(p[0], p[1]); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
    pts.slice(1).forEach((p, k) => { const [x, y] = arenaPx(p[0], p[1]); c.fillStyle = AR_COLS[i % AR_COLS.length]; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = "#fff"; c.font = "bold 10px system-ui"; c.textAlign = "center"; c.fillText(k + 1, x, y + 3.5); });
  });
  A.a.forEach((to, i) => { if (to >= 0 && A.p[to]) arenaArrow(c, A.p[i], A.p[to], "rgba(130,200,255,.55)"); });
  A.p.forEach((d, i) => {
    const [x, y] = arenaPx(d[0], d[1]);
    c.fillStyle = "rgba(255,255,255,.08)"; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = i === A.st ? "#7ee787" : "#fff"; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    if (opts.labels) { c.fillStyle = "#9aa3b5"; c.font = "bold 11px system-ui"; c.textAlign = "center"; c.fillText(i === A.st ? "start" : i + 1, x, y - 20); }
    if (opts.hot === i) { c.strokeStyle = "#ffd54f"; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.stroke(); }
  });
  A.e.forEach((e, i) => { const g = opts.at ? opts.at(i) : [e.x, e.y], [x, y] = arenaPx(g[0], g[1]); arenaEnemy(c, e, i, x, y, opts.sel === i); });
}

// ---------------------------------------------------------------- in the game
let arDot = null, arDotUntil = 0, arGlide = null;
function arenaKey(act) {
  const st = S.story, A = st.arena;
  if (act === "up" || act === "down") {
    const cur = arShownDot(st), to = act === "up" ? A.a[cur] : A.a.indexOf(cur);
    if (st.state === "play" && to >= 0) { arDot = to; arDotUntil = performance.now() + 2 * (st.lat || 0) + 300; }
    send({ t: "move", d: act === "up" ? -1 : 1 });
  } else if (act === "clap") { send({ t: "clap" }); storyClapAt = performance.now(); playClap(); }
  else if (act === "throw") send({ t: "spaceDown" });
  else return false;
  return true;
}
function arShownDot(st) { if (arDot != null && performance.now() < arDotUntil && st.state === "play") return arDot; arDot = null; return st.dot; }
function drawArena(t) {
  const st = S.story, A = st.arena, c = ctx, tn = now();
  const at = i => arenaPos(A.e[i], st.state === "play" && st.t0 ? Math.max(0, tn - st.t0) : 0);
  arenaBoard(c, A, { at });
  c.font = "bold 18px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#c9b8ff"; c.fillText(`Level Maker · ${st.custom}`, 16, 16);
  // balls
  st.balls.forEach(b => {
    const p = Math.max(0, Math.min(1, (tn - b.t0) / b.dur)), [fx, fy] = arenaPx(b.fx, b.fy), [tx, ty] = arenaPx(b.tx, b.ty);
    const x = fx + (tx - fx) * p, y = fy + (ty - fy) * p - Math.sin(p * Math.PI) * 30;
    c.globalAlpha = 0.35; c.strokeStyle = b.kind === "dodge" ? "#e53935" : "#fff"; c.lineWidth = 2; c.setLineDash([3, 7]); c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.save(); c.translate(x, y); ballShape(c, b.kind, 20, b); c.restore();
    if (b.kind === "dodge") { c.strokeStyle = "rgba(229,57,53,.6)"; c.lineWidth = 2; c.beginPath(); c.arc(tx, ty, 20 + 4 * Math.sin(performance.now() / 90), 0, Math.PI * 2); c.stroke(); }
  });
  // you
  const d = A.p[arShownDot(st)] || A.p[0], [gx, gy] = arenaPx(d[0], d[1]);
  if (!arGlide || Math.hypot(arGlide[0] - gx, arGlide[1] - gy) > 900) arGlide = [gx, gy];
  arGlide[0] += (gx - arGlide[0]) * 0.35; arGlide[1] += (gy - arGlide[1]) * 0.35;
  const [x, y] = arGlide, s = 36, me2 = players[me.id] || {};
  if (st.hurtAt && tn - st.hurtAt < 500 && Math.floor(performance.now() / 80) % 2) c.globalAlpha = 0.4;
  drawSkin(c, me2.skin || "default", x - s / 2, y - s / 2, s, me2.color || "#4fc3f7", performance.now());
  c.lineWidth = 3; c.strokeStyle = "#fff"; c.strokeRect(x - s / 2, y - s / 2, s, s); c.globalAlpha = 1;
  if (performance.now() - storyClapAt < 250) { c.font = "22px Nunito, system-ui"; c.textAlign = "center"; c.fillText("👏", x + 28, y - 22); }
  // speech
  if (st.say && st.say.text) {
    const g = st.say.who ? at(st.say.who - 1) : [24, 2], [bx0, by0] = arenaPx(g[0], g[1]), bx = Math.min(820, Math.max(140, bx0)), by = Math.max(60, by0 - 40);
    c.font = "bold 15px Nunito, system-ui"; const w = c.measureText(st.say.text).width + 26;
    c.fillStyle = "#fff"; c.beginPath(); c.roundRect(bx - w / 2, by - 28, w, 36, 10); c.fill();
    c.fillStyle = "#111"; c.textAlign = "center"; c.fillText(st.say.text, bx, by - 5);
  }
  // top right: lives + progress
  c.textAlign = "right"; c.font = "bold 16px Nunito, system-ui"; c.fillStyle = "#ff8a80"; c.fillText("♥".repeat(Math.max(0, st.lives)) + "♡".repeat(Math.max(0, A.l - st.lives)), 944, 16);
  c.fillStyle = "#ffd54f";
  c.fillText(st.need ? `Caught ${st.count} / ${st.need}` : `Survive ${Math.max(0, (st.survive - (st.t0 ? tn - st.t0 : 0)) / 1000).toFixed(0)}s`, 944 - 18 * A.l - 20, 16);
  c.textAlign = "center"; c.fillStyle = "#cfd3e0"; c.font = "14px Nunito, system-ui";
  c.fillText("W: follow the arrow · S: go back · Red: get off that dot · White: clap (C), then catch (Space)", 480, 636);
}
