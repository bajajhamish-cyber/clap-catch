// ======================================================================
//  minigame.js: the daily minigame (Play tab card + its own game screen).
//  The server runs everything; this file shows it and sends key presses.
// ======================================================================
let MG_INFO = null, MG = null, MG_SOCK = null, MG_ME = null, MG_KEY = null, mgJoined = false, mgOffsets = [], mgDir = { x: 0, y: 0 };
const MG_DRAW = {};                 // smoothed positions: id -> { x, y }
const mgKeys = { up: 0, down: 0, left: 0, right: 0 };
const mgNow = () => { const o = mgOffsets.slice().sort((a, b) => a - b); return Date.now() + (o.length ? o[o.length >> 1] : 0); };
const mgClock = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, "0")}`; };

// ---------------------------------------------------------------- Play tab card
async function loadMiniInfo() {
  try { MG_INFO = await api("mini"); MG_INFO.got = Date.now(); } catch (e) { MG_INFO = MG_INFO || null; }
  renderMiniCard();
}
function renderMiniCard() {
  const box = el("miniCard"); if (!box) return;
  const m = MG_INFO;
  if (!m) { box.innerHTML = `<div class="muted small">Loading today's minigame…</div>`; return; }
  const id = m.today, t = Date.now(), nextIn = mgClock(m.nextAt - t);
  if (m.off) {
    box.innerHTML = `<div class="miniHead"><span class="miniIcon">💤</span><div style="flex:1"><div class="muted small">Daily minigame</div><h3>Switched off for now</h3></div></div>
      <div class="muted small">An admin has turned the daily minigame off. Check back later!</div>`;
    return;
  }
  let btn = "", note = "";
  if (id === "ultra" && m.ultra) {
    const u = m.ultra;
    if (t < u.joinAt) { btn = `<button type="button" disabled>Doors open at 11:15 am</button>`; note = `Opens in ${mgClock(u.joinAt - t)}`; }
    else if (t < u.startAt) { btn = `<button type="button" id="miniPlay">Join the Ultra Boss</button>`; note = `The boss wakes up in ${mgClock(u.startAt - t)}`; }
    else if (t < u.endAt) { btn = `<button type="button" disabled>Already started</button>`; note = `It's on now. Ends in ${mgClock(u.endAt - t)}`; }
    else { btn = `<button type="button" disabled>Over for today</button>`; }
  } else if (id === "clicker") btn = `<button type="button" id="miniPlay">Play Idle Clicker</button>`;
  else btn = `<button type="button" id="miniPlay">Find a match</button>`;
  box.innerHTML = `<div class="miniHead"><span class="miniIcon">${MINI.ICONS[id]}</span>
      <div style="flex:1"><div class="muted small">Today's minigame</div><h3>${MINI.NAMES[id]}</h3></div>
      <div class="miniGo">${btn}${note ? `<div class="muted small">${note}</div>` : ""}</div></div>
    <div class="small">${MINI.DESC[id]}</div>
    <div class="muted small miniNext">Tomorrow: ${MINI.ICONS[m.tomorrow]} ${MINI.NAMES[m.tomorrow]} · changes at midnight, in ${nextIn}${m.lastClicker ? ` · Last Idle Clicker winner: <b>${esc(m.lastClicker.name)}</b>` : ""}</div>`;
  const b = el("miniPlay"); if (b) b.onclick = () => playMini();
}
setInterval(() => {
  if (!PROFILE || !el("miniCard") || el("menuScreen").hidden) return;
  if (MG_INFO && Date.now() >= MG_INFO.nextAt) loadMiniInfo(); else renderMiniCard();
}, 1000);

async function playMini() {
  const m = MG_INFO; if (!m || busy) return;
  busy = true;
  try {
    let key;
    if (m.today === "ultra") key = m.ultra.key;
    else if (m.today === "clicker") key = m.clicker.key;
    else key = (await api("miniMatch", { mode: m.today })).key;
    await joinMini(key);
  } catch (e) { toast(e.message, true); showScreen("menuScreen"); }
  finally { busy = false; }
}

// ---------------------------------------------------------------- connection
function joinMini(key) {
  return new Promise(async (resolve, reject) => {
    let settled = false;
    const tok = await token();
    MG_KEY = key; MG = null; MG_ME = null; mgOffsets = []; Object.keys(MG_DRAW).forEach(k => delete MG_DRAW[k]);
    const ws = MG_SOCK = new WebSocket(SERVER.replace(/^http/, "ws") + "/ws/" + key + "?token=" + encodeURIComponent(tok));
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "hello") { me.id = m.you; mgApply(m.state); mgJoined = true; mgOpen(); if (!settled) { settled = true; resolve(); } }
      else if (m.t === "state") mgApply(m.state);
      else if (m.t === "me") { MG_ME = m.me; mgClickerUI(); }
      else if (m.t === "ping") mgSend({ t: "pong", s: m.s });
      else if (m.t === "err") toast(m.m, true);
      else if (m.t === "error") { if (!settled) { settled = true; reject(new Error(m.m)); } }
      else if (m.t === "kicked") { toast(m.m, true); setTimeout(() => location.reload(), 2500); mgJoined = false; }
      else if (m.t === "points") { onPoints(m.points); el("miniPoints").textContent = "⭐ " + m.points; }
    };
    ws.onclose = () => {
      if (!settled) { settled = true; reject(new Error("Couldn't connect to the game server")); return; }
      if (mgJoined) { mgJoined = false; toast("Disconnected from the minigame", true); setTimeout(() => location.reload(), 2500); }
    };
    ws.onerror = () => {};
  });
}
function mgSend(o) { if (MG_SOCK && MG_SOCK.readyState === 1) MG_SOCK.send(JSON.stringify(o)); }
function mgApply(st) {
  MG = st;
  mgOffsets.push(st.now - Date.now()); if (mgOffsets.length > 25) mgOffsets.shift();
  mgOverlay();
}
function mgOpen() {
  ["authScreen", "menuScreen", "game", "banScreen"].forEach(id => el(id).hidden = true);
  el("miniScreen").hidden = false; inGame = true;
  const id = MG.mini;
  el("miniLabel").textContent = `${MINI.ICONS[id]} ${MINI.NAMES[id]}`;
  el("miniPoints").textContent = PROFILE ? "⭐ " + PROFILE.points : "";
  el("clickerUI").hidden = id !== "clicker"; el("mc").hidden = id === "clicker";
  el("miniHelp").innerHTML = id === "duel" ? "<kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd> move · <kbd>Space</kbd> throw (when you have the ball)"
    : id === "clicker" ? "Click the big square (or press <kbd>Space</kbd>). At most 20 clicks a second count."
    : "Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys";
  if (id === "clicker") mgClickerUI();
  requestAnimationFrame(mgFrame);
}
el("miniLeave").onclick = () => {
  if (MG && MG.mini === "tag" && MG.state === "play" && MG.players[me.id] && !MG.players[me.id].l) {
    const first = MG.first === me.id;
    if (!confirm(`Leave now? Leaving in the middle costs ${first ? MINI.TAG_IT_LEAVE : MINI.TAG_LEAVE} points.`)) return;
  }
  location.reload();
};

// ---------------------------------------------------------------- keys
function mgKey(e, down) {
  if (el("miniScreen").hidden || !MG) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (MG.mini === "duel") {
    if (!down) return;
    if (k === "w" || k === "arrowup") { mgSend({ t: "move", d: -1 }); e.preventDefault(); }
    else if (k === "s" || k === "arrowdown") { mgSend({ t: "move", d: 1 }); e.preventDefault(); }
    else if (k === " ") { mgSend({ t: "throw" }); e.preventDefault(); }
    return;
  }
  if (MG.mini === "clicker") { if (down && k === " " && !e.repeat) { mgClick(); e.preventDefault(); } return; }
  const map = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  if (!map[k]) return;
  e.preventDefault();
  mgKeys[map[k]] = down ? 1 : 0;
  const x = mgKeys.right - mgKeys.left, y = mgKeys.down - mgKeys.up;
  if (x !== mgDir.x || y !== mgDir.y) { mgDir = { x, y }; mgSend({ t: "dir", x, y }); }
}
window.addEventListener("keydown", e => mgKey(e, true));
window.addEventListener("keyup", e => mgKey(e, false));
window.addEventListener("blur", () => { if (MG && (mgDir.x || mgDir.y)) { Object.keys(mgKeys).forEach(k => mgKeys[k] = 0); mgDir = { x: 0, y: 0 }; mgSend({ t: "dir", x: 0, y: 0 }); } });

// ---------------------------------------------------------------- lobby / results window
function mgOverlay() {
  const box = el("miniOverlay"), st = MG; if (!st) return;
  let html = "";
  const n = st.players ? Object.keys(st.players).length : 0;
  if (st.state === "lobby" && st.mini !== "ultra" && st.mini !== "clicker") {
    const left = st.countdownAt ? Math.max(0, Math.ceil((st.countdownAt - mgNow()) / 1000)) : null;
    const slots = MINI.SLOTS[st.mini];
    html = `<h2>${MINI.ICONS[st.mini]} ${MINI.NAMES[st.mini]}</h2><p>${n} of ${slots} players here.</p>
      <p class="muted small">${left == null ? "Waiting…" : st.mini === "duel" && n < 2 ? `If nobody else comes, a bot plays you in ${left}s` : `Starting in ${left}s. Bots fill any empty spots.`}</p>`;
  } else if (st.state === "over" && st.results && st.mini !== "clicker") {
    const r = st.results, mine = st.players && st.players[me.id];
    let head = "", body = "";
    if (st.mini === "color") { const won = r.survivors.some(s => s.id === me.id); head = won ? `You survived! +${r.pts} points` : "You're out"; body = r.survivors.length ? `Survivors: ${r.survivors.map(s => esc(s.name)).join(", ")}` : "Nobody made it to the end."; }
    if (st.mini === "tag") { const won = r.winners.some(w => w.id === me.id), first = r.first === me.id; head = won ? `Last one standing! +${MINI.TAG_WIN + (first ? MINI.TAG_IT_STAY : MINI.TAG_STAY)} points` : `You stayed to the end: +${first ? MINI.TAG_IT_STAY : MINI.TAG_STAY} points`; body = r.winners.length ? `Winner${r.winners.length > 1 ? "s" : ""}: ${r.winners.map(w => esc(w.name)).join(", ")}` : "Everyone got built up."; }
    if (st.mini === "duel") { head = r.winner === me.id ? `You win! +${r.pts} points` : `${esc(r.winnerName)} wins`; body = `${esc(r.why)} (${r.throws} throws)`; }
    if (st.mini === "ultra") { const alive = mine && mine.a; head = alive ? `You survived the Ultra Boss! +${r.pts} points` : "The Ultra Boss got you"; body = `${r.survivors} of ${r.total} survived.`; }
    const again = st.mini !== "ultra" && MG_INFO && MG_INFO.today === st.mini;
    html = `<h2>${head}</h2><p>${body}</p><div class="row" style="justify-content:center">${again ? `<button type="button" id="mgAgain">Play again</button>` : ""}<button type="button" class="secondary" id="mgBack">Back to menu</button></div>`;
  }
  if (!html) { box.hidden = true; box.dataset.k = ""; return; }
  const k = st.state + ":" + html.length + ":" + (st.state === "lobby" ? Math.floor(mgNow() / 1000) : "");
  if (box.dataset.k === k) return;
  box.dataset.k = k; el("miniOverlayBox").innerHTML = html; box.hidden = false;
  const a = el("mgAgain"), bk = el("mgBack");
  if (bk) bk.onclick = () => location.reload();
  if (a) a.onclick = () => { try { sessionStorage.setItem("cc_mini_again", "1"); } catch (e) {} location.reload(); };
}

// ---------------------------------------------------------------- drawing
let mgLast = 0;
function mgFrame(ts) {
  if (el("miniScreen").hidden) return;
  requestAnimationFrame(mgFrame);
  const dt = Math.min(0.1, (ts - (mgLast || ts)) / 1000); mgLast = ts;
  if (!MG || MG.mini === "clicker") return;
  if (MG.state === "lobby") mgOverlay();
  const c = el("mc").getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 960, 640);
  ({ color: drawColor, tag: drawTag, ultra: drawUltra, duel: drawDuel })[MG.mini](c, dt);
  // messages
  const msgs = (MG.msgs || []).filter(m => mgNow() - m.at < 4000).slice(-3);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = "600 15px system-ui, sans-serif"; c.textAlign = "left";
  msgs.forEach((m, i) => { c.fillStyle = "rgba(0,0,0,.55)"; const w = c.measureText(m.m).width + 16; c.fillRect(10, 596 - i * 28, w, 24); c.fillStyle = "#fff"; c.fillText(m.m, 18, 613 - i * 28); });
}
// smooth movement (your own cube moves straight away; everyone else glides to where the server says)
function mgPos(id, p, dt, speed) {
  const d = MG_DRAW[id] || (MG_DRAW[id] = { x: p.x, y: p.y });
  if (id === me.id && p.a && MG.state !== "over") {
    if (mgDir.x || mgDir.y) { const l = Math.hypot(mgDir.x, mgDir.y); d.x += mgDir.x / l * speed * dt; d.y += mgDir.y / l * speed * dt; }
    d.x += (p.x - d.x) * Math.min(1, dt * 7); d.y += (p.y - d.y) * Math.min(1, dt * 7);
  } else { d.x += (p.x - d.x) * Math.min(1, dt * 14); d.y += (p.y - d.y) * Math.min(1, dt * 14); }
  if (Math.hypot(p.x - d.x, p.y - d.y) > 120) { d.x = p.x; d.y = p.y; }
  return d;
}
function mgCube(c, p, x, y, s, mine, t) {
  c.save();
  if (!p.a) c.globalAlpha = 0.25;
  drawSkin(c, p.s || "default", x - s / 2, y - s / 2, s, p.c || "#4fc3f7", t);
  c.lineWidth = mine ? 3 : 1.5; c.strokeStyle = mine ? "#ffcc33" : "rgba(0,0,0,.6)"; c.strokeRect(x - s / 2, y - s / 2, s, s);
  c.restore();
  c.font = `${mine ? 700 : 600} 12px system-ui, sans-serif`; c.textAlign = "center"; c.fillStyle = p.a ? "#fff" : "rgba(255,255,255,.4)";
  c.fillText(mine ? "You" : p.n, x, y - s / 2 - 6);
}
function mgBanner(c, text, sub, col) {
  c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(0, 0, 960, sub ? 62 : 44);
  c.font = "700 24px system-ui, sans-serif"; c.textAlign = "center"; c.fillStyle = col || "#fff"; c.fillText(text, 480, 30);
  if (sub) { c.font = "14px system-ui, sans-serif"; c.fillStyle = "#cfd3d8"; c.fillText(sub, 480, 52); }
}

// ---- Color Mode
function drawColor(c, dt) {
  const st = MG, t = mgNow(), ph = st.phase, TW = 960 / st.cols, TH = 640 / st.rows;
  st.tiles.forEach((ci, i) => {
    const x = (i % st.cols) * TW, y = Math.floor(i / st.cols) * TH;
    let col = st.palette[ci][1], fall = 0;
    if (ph && ph.kind === "drop" && ci !== ph.target) fall = Math.min(1, (t - ph.at) / 500);
    c.fillStyle = col; c.globalAlpha = 1 - fall * 0.85;
    const sh = fall * 18; c.fillRect(x + 3 + sh / 2, y + 3 + sh / 2, TW - 6 - sh, TH - 6 - sh);
    c.globalAlpha = 1;
  });
  if (st.state === "play" && ph) {
    const [name, col] = st.palette[ph.target];
    if (ph.kind === "pick") {
      const k = Math.max(0, (ph.until - t) / (ph.until - ph.at));
      mgBanner(c, `Get on ${name.toUpperCase()}!`, `Round ${st.round} of ${st.rounds}`, col);
      c.fillStyle = col; c.fillRect(0, 62, 960 * k, 6);
    } else mgBanner(c, `${name.toUpperCase()}!`, `Round ${st.round} of ${st.rounds}`, col);
  }
  Object.entries(st.players).forEach(([id, p]) => { if (id === me.id) return; const d = mgPos(id, p, dt, 290); mgCube(c, p, d.x, d.y, 30, false, t); });
  const mine = st.players[me.id]; if (mine) { const d = mgPos(me.id, mine, dt, 290); mgCube(c, mine, d.x, d.y, 30, true, t); }
}

// ---- Buildups
function drawTag(c, dt) {
  const st = MG, t = mgNow(), b = st.bounds || { x0: 15, y0: 15, x1: 945, y1: 625 };
  c.fillStyle = "#3a1414"; c.fillRect(0, 0, 960, 640);
  c.fillStyle = "#1b2a1b"; c.fillRect(b.x0 - 15, b.y0 - 15, b.x1 - b.x0 + 30, b.y1 - b.y0 + 30);
  c.strokeStyle = "rgba(255,255,255,.06)"; c.lineWidth = 1;
  for (let x = 0; x < 960; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 640); c.stroke(); }
  for (let y = 0; y < 640; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(960, y); c.stroke(); }
  c.strokeStyle = "#e74c3c"; c.lineWidth = 3; c.strokeRect(b.x0 - 15, b.y0 - 15, b.x1 - b.x0 + 30, b.y1 - b.y0 + 30);
  const all = Object.entries(st.players), runners = all.filter(([, p]) => !p.it && !p.l).length;
  const draw = (id, p) => {
    const d = mgPos(id, p, dt, p.it ? 310 : 285), mine = id === me.id;
    mgCube(c, Object.assign({}, p, { a: 1 }), d.x, d.y, 30, mine, t);
    if (p.it) {
      c.save(); c.globalAlpha = 0.55; c.fillStyle = "#6ee76e"; c.fillRect(d.x - 15, d.y - 15, 30, 30); c.restore();
      c.font = "700 11px system-ui, sans-serif"; c.fillStyle = "#0b2"; c.textAlign = "center"; c.fillText(p.f ? "IT 👑" : "IT", d.x, d.y + 30);
    }
  };
  all.forEach(([id, p]) => { if (id !== me.id && !p.l) draw(id, p); });
  if (st.players[me.id]) draw(me.id, st.players[me.id]);
  if (st.state === "play") {
    const mine = st.players[me.id];
    mgBanner(c, mine && mine.it ? "You're IT: touch the others!" : "Don't get touched!", `${runners} still standing`, mine && mine.it ? "#6ee76e" : "#fff");
  }
}

// ---- Ultra Boss
function drawUltra(c, dt) {
  const st = MG, t = mgNow(), S = 960 / st.world.w, B = st.boss;
  c.fillStyle = "#14121a"; c.fillRect(0, 0, 960, 640);
  c.save(); c.scale(S, S);
  // floor
  c.strokeStyle = "rgba(255,255,255,.05)"; c.lineWidth = 1;
  for (let x = 0; x <= st.world.w; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, st.world.h); c.stroke(); }
  for (let y = 0; y <= st.world.h; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(st.world.w, y); c.stroke(); }
  const W = st.world.w, H = st.world.h;
  // attacks underneath players: halves and fire
  (st.attacks || []).forEach(a => {
    const live = t >= a.live, k = live ? 1 : (t - a.at) / (a.live - a.at);
    if (a.kind === "half") {
      const r = a.side === "left" ? [0, 0, W / 2, H] : a.side === "right" ? [W / 2, 0, W / 2, H] : a.side === "top" ? [0, 0, W, H / 2] : [0, H / 2, W, H / 2];
      if (live) { c.fillStyle = `rgba(255,${60 + 40 * Math.sin(t / 60)},0,.75)`; c.fillRect(...r); }
      else {
        c.save(); c.beginPath(); c.rect(...r); c.clip();
        c.fillStyle = `rgba(255,40,40,${0.12 + 0.12 * Math.sin(t / 90)})`; c.fillRect(...r);
        c.strokeStyle = "rgba(255,60,60,.35)"; c.lineWidth = 18;
        for (let i = -H; i < W; i += 70) { c.beginPath(); c.moveTo(i + (t / 20) % 70, 0); c.lineTo(i + H + (t / 20) % 70, H); c.stroke(); }
        c.restore();
        c.font = "800 64px system-ui, sans-serif"; c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.85)";
        c.fillText(Math.ceil((a.live - t) / 1000), r[0] + r[2] / 2, r[1] + r[3] / 2 + 22);
      }
    }
    if (a.kind === "fire") a.spots.forEach(s => {
      if (live) { const g = c.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r); g.addColorStop(0, "#fff6c0"); g.addColorStop(0.4, "#ff9d00"); g.addColorStop(1, "rgba(255,40,0,.2)"); c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill(); }
      else {
        c.fillStyle = `rgba(255,70,0,${0.1 + 0.25 * k})`; c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "rgba(255,90,40,.9)"; c.lineWidth = 3; c.beginPath(); c.arc(s.x, s.y, s.r * k, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = "rgba(255,90,40,.5)"; c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.stroke();
      }
    });
  });
  // boss
  const pulse = 0.5 + 0.5 * Math.sin(t / 220), charging = (st.attacks || []).some(a => t < a.live);
  const g = c.createRadialGradient(B.x, B.y, B.r * 0.5, B.x, B.y, B.r * 2.2); g.addColorStop(0, `rgba(255,${charging ? 40 : 120},40,${0.35 + 0.25 * pulse})`); g.addColorStop(1, "rgba(255,60,0,0)");
  c.fillStyle = g; c.fillRect(B.x - B.r * 2.3, B.y - B.r * 2.3, B.r * 4.6, B.r * 4.6);
  c.fillStyle = "#3b0d0d"; c.beginPath(); c.arc(B.x, B.y, B.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#ff6b2a"; c.lineWidth = 6; c.stroke();
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + t / 1600; c.fillStyle = "#ff6b2a"; c.beginPath(); c.moveTo(B.x + Math.cos(an) * B.r, B.y + Math.sin(an) * B.r); c.lineTo(B.x + Math.cos(an + 0.2) * (B.r + 26), B.y + Math.sin(an + 0.2) * (B.r + 26)); c.lineTo(B.x + Math.cos(an + 0.4) * B.r, B.y + Math.sin(an + 0.4) * B.r); c.fill(); }
  c.fillStyle = charging ? "#fff" : "#ffcc33"; [-1, 1].forEach(s => { c.beginPath(); c.arc(B.x + s * 24, B.y - 12, 11 + (charging ? 3 * pulse : 0), 0, Math.PI * 2); c.fill(); });
  c.fillStyle = "#1a0505"; [-1, 1].forEach(s => { c.beginPath(); c.arc(B.x + s * 24, B.y - 10, 5, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = "#ffcc33"; c.fillRect(B.x - 26, B.y + 26, 52, 8);
  // lasers and rings on top
  (st.attacks || []).forEach(a => {
    const live = t >= a.live;
    if (a.kind === "laser") {
      const ang = a.a0 + a.spin * (Math.max(t, a.at) - a.at) / 1000;
      for (let i = 0; i < a.n; i++) {
        const th = ang + i * Math.PI * 2 / a.n, ex = B.x + Math.cos(th) * 1600, ey = B.y + Math.sin(th) * 1600;
        if (live) {
          c.strokeStyle = "rgba(255,80,40,.45)"; c.lineWidth = 52; c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(ex, ey); c.stroke();
          c.strokeStyle = "#fff3b0"; c.lineWidth = 14; c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(ex, ey); c.stroke();
        } else {
          c.strokeStyle = `rgba(255,60,60,${0.35 + 0.35 * Math.sin(t / 50)})`; c.lineWidth = 3; c.setLineDash([16, 12]);
          c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
          // which way it will turn
          const end = th + a.spin * (a.until - a.live) / 1000;
          c.strokeStyle = "rgba(255,60,60,.25)"; c.lineWidth = 2; c.beginPath(); c.arc(B.x, B.y, 260, Math.min(th, end), Math.max(th, end)); c.stroke();
        }
      }
    }
    if (a.kind === "ring") {
      const rad = live ? B.r + a.speed * (t - a.live) / 1000 : B.r + 10;
      c.lineWidth = live ? 30 : 8; c.strokeStyle = live ? "rgba(255,170,60,.85)" : `rgba(255,60,60,${0.4 + 0.4 * Math.sin(t / 50)})`;
      const gs = a.gaps.map(g => ((g % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((x, y) => x - y);
      for (let i = 0; i < gs.length; i++) {
        const from = gs[i] + a.gap / 2, to = (i + 1 < gs.length ? gs[i + 1] : gs[0] + Math.PI * 2) - a.gap / 2;
        c.beginPath(); c.arc(B.x, B.y, rad, from, to); c.stroke();
      }
      if (!live) gs.forEach(g => { c.fillStyle = "#7ee787"; c.beginPath(); c.arc(B.x + Math.cos(g) * (B.r + 40), B.y + Math.sin(g) * (B.r + 40), 7, 0, Math.PI * 2); c.fill(); });
    }
  });
  // players
  Object.entries(st.players).forEach(([id, p]) => {
    if (id === me.id || p.l) return;
    const d = mgPos(id, p, dt, 290); mgCube(c, p, d.x, d.y, 24, false, t);
  });
  const mine = st.players[me.id];
  if (mine) { const d = mgPos(me.id, mine, dt, 290); mgCube(c, mine, d.x, d.y, 26, true, t); if (mine.a) { c.strokeStyle = "rgba(255,204,51,.7)"; c.lineWidth = 2; c.beginPath(); c.arc(d.x, d.y, 26, 0, Math.PI * 2); c.stroke(); } }
  c.restore();
  // header
  if (st.state === "lobby") mgBanner(c, `The Ultra Boss wakes up in ${mgClock(st.startAt - t)}`, "Find a good spot. Once it starts, one hit and you're out.", "#ffcc33");
  else if (st.state === "play") mgBanner(c, `Survive! ${mgClock(st.endAt - t)} left`, `${st.alive} still standing${mine && !mine.a ? " · you're out, watching" : ""}`, mine && mine.a ? "#fff" : "#a3a7b5");
}

// ---- Dodgeball
function drawDuel(c, dt) {
  const st = MG, t = mgNow();
  c.fillStyle = "#16202b"; c.fillRect(0, 0, 960, 640);
  c.fillStyle = "#1e2c3a"; c.fillRect(470, 0, 20, 640);
  st.laneY.forEach((y, i) => { c.fillStyle = i % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)"; c.fillRect(0, y - 30, 960, 60); });
  const ids = Object.keys(st.players), b = st.ball;
  // where the ball will go
  if (b && b.state === "flying") { const y = st.laneY[Math.min(b.lane, st.laneY.length - 1)]; c.fillStyle = "rgba(255,60,60,.13)"; c.fillRect(0, y - 30, 960, 60); }
  ids.forEach(id => {
    const p = st.players[id], x = st.x[p.side], y = st.laneY[Math.min(p.row, st.laneY.length - 1)];
    const d = MG_DRAW[id] || (MG_DRAW[id] = { x, y }); d.x = x; d.y += (y - d.y) * Math.min(1, dt * 22);
    mgCube(c, Object.assign({}, p, { a: !(st.state === "over" && st.winner && st.winner !== id) ? 1 : 0 }), d.x, d.y, 46, id === me.id, t);
  });
  if (b) {
    let bx, by;
    if (b.state === "held") {
      const h = st.players[b.holder], d = MG_DRAW[b.holder]; bx = st.x[h.side] + (h.side === "L" ? 40 : -40); by = d ? d.y : 320;
      const k = Math.max(0, (b.deadline - t) / (b.deadline - b.at));
      c.strokeStyle = "#ffcc33"; c.lineWidth = 4; c.beginPath(); c.arc(bx, by, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke();
    } else if (b.state === "flying") {
      const from = st.players[b.from], to = from.side === "L" ? "R" : "L", p = Math.min(1, (t - b.t0) / b.dur);
      bx = st.x[from.side] + (st.x[to] - st.x[from.side]) * p; by = st.laneY[Math.min(b.lane, st.laneY.length - 1)];
      c.fillStyle = "rgba(255,80,60,.35)"; for (let i = 1; i <= 4; i++) { c.beginPath(); c.arc(bx - (st.x[to] - st.x[from.side]) * 0.025 * i, by, 14 - i * 2, 0, Math.PI * 2); c.fill(); }
    }
    if (bx != null) { c.fillStyle = "#e53935"; c.beginPath(); c.arc(bx, by, 15, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 2; c.stroke(); }
  }
  if (st.state === "play") {
    const mine = b && b.state === "held" && b.holder === me.id;
    mgBanner(c, mine ? "Your ball: line up and press Space!" : b && b.state === "flying" && b.from !== me.id ? "DODGE!" : "Get ready…", `${st.lanes} lanes · throw ${st.throws + 1}`, mine ? "#ffcc33" : "#fff");
  }
}

// ---------------------------------------------------------------- Idle Clicker
let mgPending = 0, mgFlush = null;
function mgClick() {
  mgPending++;
  const b = el("clickBtn"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  if (MG_ME) { MG_ME.sq += MG_ME.click; el("clickSq").textContent = Math.floor(MG_ME.sq).toLocaleString(); }
  if (!mgFlush) mgFlush = setTimeout(() => { mgFlush = null; const n = mgPending; mgPending = 0; if (n) mgSend({ t: "click", n }); }, 200);
}
el("clickBtn").onclick = mgClick;
function mgClickerUI() {
  if (!MG || MG.mini !== "clicker") return;
  const m = MG_ME;
  if (m) {
    el("clickSq").textContent = Math.floor(m.sq).toLocaleString();
    el("clickRates").textContent = `${m.click} per click · ${m.auto.toLocaleString()} every second (even while you're away)`;
    el("clickRank").textContent = m.rank ? `You're number ${m.rank}` : "";
    el("clickShop").innerHTML = Object.entries(MINI.CLICK_UPGRADES).map(([k, u]) =>
      `<button type="button" class="clickUp" data-cu="${k}" ${m.sq >= m.costs[k] ? "" : "disabled"}><b>${u.name}</b> <span class="muted small">(you have ${m.lv[k] || 0})</span><br><span class="small">${u.desc}</span><span class="clickCost">🟦 ${m.costs[k].toLocaleString()}</span></button>`).join("");
    document.querySelectorAll("[data-cu]").forEach(b => b.onclick = () => mgSend({ t: "buy", item: b.dataset.cu }));
  }
  if (MG.top) el("clickTop").innerHTML = MG.top.map(x => `<li class="${PROFILE && x.name === PROFILE.username ? "me" : ""}"><span>${esc(x.name)}</span><b>${x.sq.toLocaleString()}</b></li>`).join("") || "<li class='muted'>Nobody yet</li>";
  el("clickEnds").textContent = MG.state === "over" ? "Today's Idle Clicker is over." : `Most squares at midnight wins ${MINI.CLICK_WIN} points. Ends in ${mgClock(MG.endsAt - mgNow())}. ${MG.count} playing today.`;
}
setInterval(() => { if (MG && MG.mini === "clicker" && !el("miniScreen").hidden) mgClickerUI(); }, 1000);

// ---------------------------------------------------------------- admin: pick tomorrow's minigame
async function refreshMiniAdmin(d) {
  if (!PROFILE || !PROFILE.isAdmin || !el("adminMiniCard")) return;
  try { d = d || await api("mini"); } catch (e) { el("adminMiniNow").textContent = e.message; return; }
  el("adminMiniNow").innerHTML = `Today: <b>${MINI.ICONS[d.today]} ${MINI.NAMES[d.today]}</b> · Tomorrow: <b>${MINI.ICONS[d.tomorrow]} ${MINI.NAMES[d.tomorrow]}</b>${d.pending ? ` <span class="tag">picked by ${esc(d.pending.by)}</span>` : " (next in the list)"}`;
  const sel = el("adminMiniPick");
  if (!sel.options.length) sel.innerHTML = MINI.ORDER.map(id => `<option value="${id}">${MINI.ICONS[id]} ${MINI.NAMES[id]}</option>`).join("");
  el("adminMiniCancel").hidden = !d.pending;
  el("adminMiniOffRow").hidden = !PROFILE.isOwner;        // only bajajhamish can switch it off and on
  el("adminMiniOff").textContent = d.off ? "Turn the daily minigame back on" : "Turn the daily minigame off";
  el("adminMiniOff").className = d.off ? "" : "secondary";
  el("adminMiniOffNote").textContent = d.off ? `It's OFF${d.offBy ? ` (turned off by ${d.offBy})` : ""}: players see "switched off" and can't start one. Games already running finish normally.` : "";
}
el("adminMiniOff").onclick = async () => {
  const off = !/back on/.test(el("adminMiniOff").textContent);
  if (off && !confirm("Turn the daily minigame off for everyone? (Games already running finish normally.)")) return;
  try { const d = await api("miniOff", { off }); toast(off ? "Daily minigame switched off" : "Daily minigame is back on"); refreshMiniAdmin(d); loadMiniInfo(); } catch (e) { toast(e.message, true); }
};
el("adminMiniSet").onclick = async () => { try { const d = await api("miniSet", { id: el("adminMiniPick").value }); toast(`Tomorrow's minigame: ${MINI.NAMES[d.tomorrow]}`); refreshMiniAdmin(); loadMiniInfo(); } catch (e) { toast(e.message, true); } };
el("adminMiniCancel").onclick = async () => { try { await api("miniCancel"); toast("Cancelled: back to the normal order"); refreshMiniAdmin(); loadMiniInfo(); } catch (e) { toast(e.message, true); } };

// ---------------------------------------------------------------- admin (L-I-O): sure thing
async function refreshSure() {
  try {
    const list = await api("sureList");
    el("sureList").innerHTML = list.length ? list.map(u => `<div class="adminRow"><span>💎 <b>${esc(u.username)}</b>: their next Platinum or Diamond will work</span><button type="button" class="secondary" data-sureoff="${esc(u.username)}">Cancel</button></div>`).join("") : "<div class='muted'>Nobody right now.</div>";
    document.querySelectorAll("[data-sureoff]").forEach(b => b.onclick = async () => { try { await api("sureSet", { username: b.dataset.sureoff, on: false }); refreshSure(); } catch (e) { toast(e.message, true); } });
  } catch (e) { el("sureList").textContent = e.message; }
}
el("sureAddBtn").onclick = async () => {
  const u = el("sureUser").value.trim(); if (!u) return;
  try { const r = await api("sureSet", { username: u }); el("sureUser").value = ""; toast(`${r.username}'s next Platinum or Diamond will work`); refreshSure(); } catch (e) { toast(e.message, true); }
};
