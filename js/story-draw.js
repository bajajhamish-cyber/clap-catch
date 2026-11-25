// ======================================================================
//  story-draw.js: draws the side-on Story levels and the level
//  intro / "level complete" / "try again" windows for all 20 levels.
// ======================================================================
let storyClapAt = 0, storyShownState = "", storyLevelShown = 0;
// smooth movement: your lane changes show straight away (the server checks them a moment later)
// and every character glides to its lane instead of jumping
let predRow = null, predUntil = 0, glide = {}, glideAt = 0;
function rogueRoomKey() { return "ROGUE" + Math.random().toString(36).slice(2, 10).toUpperCase(); }
function storyRoomKey(lv) { return "STORY" + String(lv).padStart(2, "0") + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function shownRow(st) {
  if (predRow != null && performance.now() < predUntil && st.state === "play") return Math.max(0, Math.min(st.you.lanes.length - 1, predRow));
  predRow = null; return st.you.row;
}

function isStory() { return !!(S && (S.story || S.storyLevel)); }
function storyLevelNow() { return S ? (S.story ? S.story.level : S.storyLevel) : 0; }

// ---------------------------------------------------------------- keys in story levels 2-6
function storyKey(act, k) {
  const st = S && S.story; if (!st) return false;
  if (act === "up" || act === "down") {
    const d = act === "up" ? -1 : 1;
    if (st.state === "play" && st.you.lanes.length > 1) {
      predRow = Math.max(0, Math.min(st.you.lanes.length - 1, shownRow(st) + d));
      predUntil = performance.now() + 2 * (st.lat || 0) + 300;
    }
    send({ t: "move", d });
  }
  else if (act === "left") send({ t: "aim", d: -1 });
  else if (act === "right") send({ t: "aim", d: 1 });
  else if (act === "clap") { send({ t: "clap" }); storyClapAt = performance.now(); playClap(); }
  else if (act === "throw") send({ t: "spaceDown" });
  else if (act === "dodge") send({ t: "dodge" });
  else return false;
  return true;
}

// ---------------------------------------------------------------- windows (intro / won / lost)
function storyWindows() {
  const box = $("storyModal"); if (!box) return;
  if (S.story && S.story.rogue) return rogueWindows(box);
  const lv = storyLevelNow(); if (!lv) { box.style.display = "none"; return; }
  const L = STORY_LEVELS[lv - 1];
  let state;
  if (S.story) state = S.story.state;
  else {                                        // level 1 is a normal game against 3 easy bots
    const b = ball;
    state = !b || (!b.state || b.state === "waiting") && !Object.values(players).some(p => p.bot) ? "intro"
      : b.state === "over" ? (b.winner === me.id ? "won" : "lost") : "play";
  }
  const key = state + ":" + JSON.stringify((S.story && S.story.result) || S.storyResult || null);
  if (key === storyShownState) return;
  storyShownState = key;
  if (state === "play") { box.style.display = "none"; return; }
  let html = "";
  if (state === "intro") {
    html = `<div class="storyBig">${L.icon}</div><h2>${L.title}</h2><p>${L.text}</p>
      <div class="muted small">Keys: ${keyName(KEYS.up)}/${keyName(KEYS.down)} move · ${keyName(KEYS.clap)} clap · ${keyName(KEYS.throw)} catch / throw · ${keyName(KEYS.left)}/${keyName(KEYS.right)} aim · ${keyName(KEYS.dodge)} dodgeball (change them in ⌨️ Keys)</div>
      <button type="button" id="storyGo">Let's go!</button>`;
  } else if (state === "won") {
    const r = (S.story && S.story.result) || S.storyResult;
    const pts = !r || r.pending ? "Saving…" : r.error ? "Couldn't save, try again later" : r.first ? "+20 points!" : (typeof U3 !== "undefined" && U3 ? "No points: you've beaten this one before" : "Already beaten before (no points this time)");
    html = `<div class="storyBig">🏆</div><h2>Level ${lv} complete!</h2><p class="storyPts">${pts}</p>
      ${lv === 10 ? `<p>👑 You took your full power back from the boss!${r && r.unlocked ? " New packs are waiting in your Shop: the ⚡ Titan Pack and 3 new skin packs." : ""}${PROFILE && PROFILE.world2 ? " But who was giving him orders? World 2 is open…" : ""}</p>` : ""}
      ${lv === 20 ? `<p>🦹 The Captain is beaten and the Shadow League is finished!${r && r.unlocked ? " The 🌑 Shadow Pack is in your Shop, and you now get 2 extra daily quests." : ""}${PROFILE && PROFILE.update3 ? " But someone started the Shadow League…" : ""}</p>` : ""}
      ${lv === 30 ? `<p>The Founder is beaten.${r && r.unlocked ? " The Weekly Shop and the Creator Pack are now unlocked." : ""}</p>` : ""}
      <div class="row" style="justify-content:center">${lv < 10 || (lv >= 10 && lv < 20 && PROFILE && PROFILE.world2) || (lv >= 20 && lv < 30 && PROFILE && PROFILE.world2 && PROFILE.update3) ? `<button type="button" id="storyNext" ${r ? "" : "disabled"}>${r ? "Next level ▶" : "Saving…"}</button>` : ""}<button type="button" class="secondary" id="storyMenu">Back to menu</button></div>`;
  } else {
    html = `<div class="storyBig">💥</div><h2>Not this time</h2><p>${escHtml((S.story && S.story.reason) || "The bots won this one.")}</p>
      <div class="row" style="justify-content:center"><button type="button" id="storyRetry">Try again</button><button type="button" class="secondary" id="storyMenu">Back to menu</button></div>`;
  }
  box.querySelector(".box").innerHTML = html;
  box.style.display = "flex";
  const go = $("storyGo"), retry = $("storyRetry"), next = $("storyNext"), menu = $("storyMenu");
  if (go) go.onclick = () => { box.style.display = "none"; send(S.story ? { t: "go" } : { t: "start" }); };
  if (retry) retry.onclick = () => { box.style.display = "none"; storyShownState = ""; send(S.story ? { t: "retry" } : { t: "start" }); };
  if (menu) menu.onclick = () => { box.style.display = "none"; $("leaveBtn").click(); };
  if (next) next.onclick = () => {      // leaving reloads the page, so remember where to go next
    box.style.display = "none";
    try { sessionStorage.setItem("cc_next_story", String(lv + 1)); } catch (e) {}
    $("leaveBtn").click();
  };
}

// ---------------------------------------------------------------- Boss Rush windows
function rogueWindows(box) {
  const st = S.story, best = Math.max((PROFILE && PROFILE.rogueBest) || 0, st.cleared || 0);
  const key = "rogue:" + st.state + ":" + st.rogue + ":" + JSON.stringify(st.result || null);
  if (key === storyShownState) return;
  storyShownState = key;
  let html = "";
  if (st.state === "intro") {
    html = `<div class="storyBig">☠️</div><h2>Boss Rush</h2><p>One boss after another, each one harder. One life: lose once and the run is over.</p>
      <p class="muted small">Every 10 levels pays points (10 each up to level 50, then 20 each, and level 100 pays 150). Level 30 is as hard as the Captain, 60 as hard as the Founder. Nobody has beaten level 100.</p>
      <p><b>Your best: ${best ? "level " + best : "none yet"}</b></p>
      <button type="button" id="storyGo">Start</button>`;
  } else if (st.state === "cleared") {
    const r = st.result, pts = r && r.reward ? `+${r.reward} points!` : "";
    html = `<div class="storyBig">✔️</div><h2>Level ${st.rogue} cleared</h2>${pts ? `<p class="storyPts">${pts}</p>` : ""}<p class="muted small">Next: level ${st.rogue + 1}…</p>`;
  } else if (st.state === "lost") {
    if (PROFILE) PROFILE.rogueBest = best;
    html = `<div class="storyBig">💀</div><h2>Run over</h2><p>${escHtml(st.reason || "The boss got you.")}</p><p>You cleared <b>${st.cleared || 0}</b> level${st.cleared === 1 ? "" : "s"}. Best: level ${best || 0}.</p>
      <div class="row" style="justify-content:center"><button type="button" id="rogueAgain">Try again</button><button type="button" class="secondary" id="storyMenu">Back to menu</button></div>`;
  } else if (st.state === "done") {
    html = `<div class="storyBig">🏆</div><h2>All 250 levels</h2><p>That was supposed to be impossible.</p>
      <div class="row" style="justify-content:center"><button type="button" id="storyMenu">Back to menu</button></div>`;
  } else { box.style.display = "none"; return; }
  box.querySelector(".box").innerHTML = html;
  box.style.display = "flex";
  const go = $("storyGo"), again = $("rogueAgain"), menu = $("storyMenu");
  if (go) go.onclick = () => { box.style.display = "none"; send({ t: "go" }); };
  if (menu) menu.onclick = () => { box.style.display = "none"; $("leaveBtn").click(); };
  if (again) again.onclick = () => { box.style.display = "none"; try { sessionStorage.setItem("cc_next_rogue", "1"); } catch (e) {} $("leaveBtn").click(); };
}

// ---------------------------------------------------------------- effects: particles, shake, flashes
let storyFx = [], shakeUntil = 0, shakePow = 0, flashUntil = 0, flashCol = "#fff", bossSeen = {}, splitSeen = {}, phaseSeen = -1;
function burst(x, y, n, cols, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (speed || 260);
    storyFx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.6, age: 0, col: cols[i % cols.length], r: 2 + Math.random() * 4 });
  }
  if (storyFx.length > 600) storyFx.splice(0, storyFx.length - 600);
}
function floatText(x, y, text, col) { storyFx.push({ x, y, vx: 0, vy: -70, life: 0.9, age: 0, text, col }); }
function shake(ms, pow) { const n = performance.now(); shakePow = n > shakeUntil ? pow : Math.max(shakePow, pow); shakeUntil = Math.max(shakeUntil, n + ms); }
function screenFlash(ms, col) { flashUntil = performance.now() + ms; flashCol = col || "#fff"; }
function drawFx(c, dt) {
  storyFx = storyFx.filter(f => (f.age += dt) < f.life);
  storyFx.forEach(f => {
    f.x += f.vx * dt; f.y += f.vy * dt; if (!f.text) f.vy += 420 * dt;
    const a = 1 - f.age / f.life; c.globalAlpha = Math.max(0, a);
    if (f.text) { c.font = "bold 22px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = f.col; c.fillText(f.text, f.x, f.y); }
    else { c.fillStyle = f.col; c.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r); }
  });
  c.globalAlpha = 1;
}
// where a ball is on screen at progress p (curving balls head for one lane, then turn)
function ballPath(st, b, p) {
  const mine = b.by === "you", realY = mine ? b.toY : st.you.lanes[b.lane];
  const x = b.fromX + (b.toX - b.fromX) * p;
  if (mine || !b.curve) return { x, y: b.fromY + (realY - b.fromY) * p, ty: realY };
  const fakeY = st.you.lanes[b.curve.from], at = b.curve.at;
  if (b.curve.hidden || p <= at) return { x, y: b.fromY + (fakeY - b.fromY) * p, ty: fakeY, bend: null };
  const yAt = b.fromY + (fakeY - b.fromY) * at;
  return { x, y: yAt + (realY - yAt) * ((p - at) / (1 - at)), ty: realY, bend: { x: b.fromX + (b.toX - b.fromX) * at, y: yAt } };
}
function ghostAlpha(p) { return p < 0.26 ? 1 : p < 0.34 ? 1 - (p - 0.26) / 0.08 : p < 0.72 ? 0 : p < 0.8 ? (p - 0.72) / 0.08 : 1; }

// ---------------------------------------------------------------- the side-on arena
function drawStory(t) {
  const st = S.story, c = ctx, lat = st.lat || 0;
  c.clearRect(0, 0, 960, 640);
  const g = c.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, "#151821"); g.addColorStop(1, "#1d2230"); c.fillStyle = g; c.fillRect(0, 0, 960, 640);
  c.strokeStyle = "#2a3040"; c.setLineDash([8, 12]); c.lineWidth = 2; c.beginPath(); c.moveTo(480, 60); c.lineTo(480, 600); c.stroke(); c.setLineDash([]);
  const L = st.rogue ? { icon: "☠️", world: 0, name: "Boss Rush" } : STORY_LEVELS[st.level - 1];
  c.font = "bold 18px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#c9b8ff";
  c.fillText(st.rogue ? `☠️ Boss Rush · Level ${st.rogue}` : `${L.icon} ${L.world > 1 ? `World ${L.world} · ` : ""}Level ${st.level}: ${L.name}`, 16, 30);
  // smooth gliding between lanes
  const lvKey = st.rogue ? "R" + st.rogue : st.level;
  if (storyLevelShown !== lvKey) { storyLevelShown = lvKey; glide = {}; predRow = null; bossSeen = {}; phaseSeen = -1; }
  const pnow = performance.now(), dt = Math.min(0.1, (pnow - (glideAt || pnow)) / 1000); glideAt = pnow;
  c.save();
  if (pnow < shakeUntil) c.translate((Math.random() - 0.5) * shakePow, (Math.random() - 0.5) * shakePow);
  // the Founder changes phase: banner + flash
  if (st.phase && st.phase !== phaseSeen) {
    if (phaseSeen >= 0 || now() - (st.phaseAt || 0) < 1500) { screenFlash(350, st.phase >= 3 ? "#ff1744" : "#ffd54f"); shake(600, 14); const e0 = st.enemies[0]; if (e0) burst(e0.x, 320, 60, ["#ffd54f", "#fff", "#c9a227"], 380); }
    phaseSeen = st.phase;
  } else if (!st.phase && phaseSeen < 0) phaseSeen = 0;
  const ease = (k, target) => {
    if (glide[k] == null || Math.abs(glide[k] - target) > 600) glide[k] = target;
    glide[k] += (target - glide[k]) * (1 - Math.exp(-dt * 20));
    if (Math.abs(glide[k] - target) < 0.5) glide[k] = target;
    return glide[k];
  };
  // lanes: a white dot in the middle of each one (you stand right on it)
  const dots = (x, ys) => ys.forEach(y => {
    c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 50, y); c.lineTo(x + 50, y); c.stroke();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
  });
  dots(st.you.x, st.you.lanes);
  st.enemies.forEach(e => { if (!e.boss && e.lanes.length > 1) dots(e.x, e.lanes); });
  // aiming (levels 4 and 5)
  const myRow = shownRow(st), yy = ease("you", st.you.lanes[myRow]);
  if (st.holding && st.targets && st.targets.length && (st.type === "aim" || st.type === "cross")) {
    const tg = st.targets[st.aim % st.targets.length], e = st.enemies[tg.e];
    c.strokeStyle = "#ff5252"; c.lineWidth = 3; c.beginPath(); c.arc(e.x, tg.y, 34, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(e.x - 44, tg.y); c.lineTo(e.x + 44, tg.y); c.moveTo(e.x, tg.y - 44); c.lineTo(e.x, tg.y + 44); c.stroke();
    c.setLineDash([6, 8]); c.strokeStyle = "rgba(255,82,82,.5)"; c.beginPath(); c.moveTo(st.you.x, yy); c.lineTo(e.x, tg.y); c.stroke(); c.setLineDash([]);
  }
  // enemies
  st.enemies.forEach(e => {
    if (e.boss) { drawBoss(c, e, t, st, pnow); return; }
    const y = ease("e:" + e.id, e.lanes[e.row]);
    if (!e.alive) { c.globalAlpha = 0.3; }
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(e.x - CUBE / 2 + 4, y - CUBE / 2 + 6, CUBE, CUBE);
    c.fillStyle = "#e53935"; c.fillRect(e.x - CUBE / 2, y - CUBE / 2, CUBE, CUBE);
    c.fillStyle = "#fff"; c.fillRect(e.x - 12, y - 8, 7, 7); c.fillRect(e.x + 5, y - 8, 7, 7);
    c.fillStyle = "#111"; c.fillRect(e.x - 14, y - 14, 10, 3); c.fillRect(e.x + 4, y - 14, 10, 3);
    c.font = "bold 14px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(e.alive ? e.name : "💫 " + e.name, e.x, y + CUBE / 2 + 34);
    c.globalAlpha = 1;
    if (e.shield && e.alive) {                 // shield: up most of the time, drops for a moment
      const ph = (now() + e.shield.off) % e.shield.cycle, up = ph >= e.shield.open, soon = up && e.shield.cycle - ph < 450;
      if (up && !(soon && Math.floor(pnow / 70) % 2)) {
        const gr = c.createRadialGradient(e.x, y, 20, e.x, y, 52); gr.addColorStop(0, "rgba(77,208,225,0)"); gr.addColorStop(1, "rgba(77,208,225,.55)");
        c.fillStyle = gr; c.beginPath(); c.arc(e.x, y, 52, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#4dd0e1"; c.lineWidth = 3; c.beginPath(); c.arc(e.x, y, 52, 0, Math.PI * 2); c.stroke();
      } else if (!up) { c.font = "bold 13px Nunito, system-ui"; c.fillStyle = "#2ecc40"; c.fillText("OPEN!", e.x, y - CUBE / 2 - 14); }
    }
  });
  // you
  const me2 = players[me.id] || {};
  c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(st.you.x - CUBE / 2 + 4, yy - CUBE / 2 + 6, CUBE, CUBE);
  drawSkin(c, me2.skin || "default", st.you.x - CUBE / 2, yy - CUBE / 2, CUBE, me2.color || "#4fc3f7", performance.now());
  c.lineWidth = 4; c.strokeStyle = "#fff"; c.strokeRect(st.you.x - CUBE / 2, yy - CUBE / 2, CUBE, CUBE);
  c.font = "bold 14px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText("You", st.you.x, yy + CUBE / 2 + 34);
  if (performance.now() - storyClapAt < 250) { c.font = "26px Nunito, system-ui"; c.fillText("👏", st.you.x + 34, yy - 28); }
  if (st.holding) {
    c.save(); c.translate(st.you.x + (st.you.side === "R" ? -36 : 36), yy - 6); c.rotate(performance.now() / 300);
    ballShape(c, st.dodgeMode ? "dodge" : "normal", 20); c.restore();
  }
  // balls in the air
  let coming = null;
  st.balls.forEach(b => {
    const mine = b.by === "you";
    const p = Math.max(0, Math.min(1, (now() - (b.t0 + (mine ? 0 : lat))) / b.dur));
    const pos = ballPath(st, b, p), ga = b.ghost ? ghostAlpha(p) : 1;
    if (!mine && b.kind === "normal") coming = { b, p };
    if (b.split && pos.bend && !splitSeen[b.id]) { splitSeen[b.id] = 1; burst(pos.bend.x, pos.bend.y, 14, ["#ff8a80", "#fff"], 160); }
    if (b.curve && pos.bend && !b.split && !splitSeen[b.id]) { splitSeen[b.id] = 1; burst(pos.bend.x, pos.bend.y, 8, ["#ce93d8"], 120); }
    // path line (not for a ghost that has gone see-through: you have to remember where it was going)
    if (!mine && (!b.ghost || p < 0.26)) {
      c.strokeStyle = b.kind === "dodge" ? "rgba(255,60,60,.15)" : "rgba(255,255,255,.1)"; c.lineWidth = 2; c.beginPath(); c.moveTo(b.fromX, b.fromY);
      if (pos.bend) { c.lineTo(pos.bend.x, pos.bend.y); c.lineTo(b.toX, pos.ty); } else c.lineTo(b.toX, pos.ty);
      c.stroke();
    }
    // a bomb hits three lanes: the red danger zone shows from the moment it's shot until it lands (it never fades to clear)
    if (b.bomb && ga > 0.5) {
      const Y = st.you.lanes, a = 0.22 + 0.08 * Math.sin(pnow / 90);
      c.fillStyle = `rgba(255,60,0,${a})`;
      for (let k = b.lane - 1; k <= b.lane + 1; k++) if (Y[k] != null) c.fillRect(st.you.x - 60, Y[k] - 34, 120, 68);
    }
    if (ga <= 0.02) { c.globalAlpha = 0.07; c.fillStyle = "#fff"; c.beginPath(); c.arc(pos.x, pos.y, 4, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; return; }
    c.globalAlpha = ga;
    c.save(); c.translate(pos.x, pos.y); c.rotate(performance.now() / 150);
    ballShape(c, b.bomb ? "bomb" : b.kind, 20 * (1 + Math.sin(p * Math.PI) * 0.4) * (b.bomb ? 1.5 : 1), b);
    c.restore(); c.globalAlpha = 1;
  });
  if (coming && coming.p >= 0.6 && (!coming.b.ghost || coming.p >= 0.72)) {
    c.strokeStyle = "#2ecc40"; c.lineWidth = 4; c.beginPath(); c.arc(st.you.x, yy, 40, 0, Math.PI * 2); c.stroke();
    c.font = "bold 16px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = "#2ecc40"; c.fillText("SPACE!", st.you.x, yy - 50);
  }
  // speech bubble
  if (st.say && st.say.text) {
    const e = st.enemies[st.say.who] || st.enemies[0], bx = Math.min(800, Math.max(160, e.x)), by = e.boss ? 120 : e.lanes[e.row] - 70;
    c.font = "bold 16px Nunito, system-ui"; const w = c.measureText(st.say.text).width + 30;
    c.fillStyle = "#fff"; c.beginPath(); c.roundRect(bx - w / 2, by - 30, w, 40, 10); c.fill();
    c.beginPath(); c.moveTo(bx - 8, by + 10); c.lineTo(bx + 8, by + 10); c.lineTo(bx, by + 22); c.fill();
    c.fillStyle = "#111"; c.textAlign = "center"; c.fillText(st.say.text, bx, by - 4);
  }
  // progress + hint
  let info = "", hint = "";
  const dodgingWave = st.balls.some(b => b.by === "enemy" && b.kind === "dodge");
  if (st.type === "catch") { info = st.holding ? `${st.need} in a row!` : `Caught ${st.count} / ${st.need} in a row`; hint = st.holding ? `Throw it back with ${keyName(KEYS.throw)}!` : `${keyName(KEYS.up)}/${keyName(KEYS.down)} to move · ${keyName(KEYS.clap)} clap · ${keyName(KEYS.throw)} catch`; }
  if (st.type === "dodge") { info = st.holding ? "Throw it back!" : st.wave < st.waves || dodgingWave ? `Wave ${Math.max(1, st.wave)} / ${st.waves}` : "Catch it!"; hint = st.holding ? (st.dodgeMode ? `It's a dodgeball now. Throw it with ${keyName(KEYS.throw)}!` : `Press ${keyName(KEYS.dodge)} to make it a dodgeball`) : "Red ones: get out of the way. White ones: clap and catch."; }
  if (st.type === "aim") { info = `Balls left: ${Math.max(0, st.ballsMax - st.thrown)}`; hint = `${keyName(KEYS.left)}/${keyName(KEYS.right)} to aim at a lane · ${keyName(KEYS.throw)} to throw. Time it!`; }
  if (st.type === "cross") { info = `Enemies left: ${st.enemies.filter(e => e.alive).length}`; hint = st.holding ? `${keyName(KEYS.left)}/${keyName(KEYS.right)} aim at an enemy lane · ${keyName(KEYS.throw)} throw · keep dodging!` : "Dodge the red ones. Catch the white one!"; }
  if (st.type === "boss") { const w = st.wave || 0; info = w <= st.waves ? `Wave ${Math.max(1, Math.min(st.waves, w))} / ${st.waves}` : "Final attack: catch the white ball!"; hint = "Dodge red · clap and catch white"; }
  if (st.balls.some(b => b.bomb)) hint = "Bombs hit 3 lanes: get well clear!";
  else if (st.balls.some(b => b.ghost)) hint = "Ghost balls vanish halfway. Remember where they were going!";
  else if (st.balls.some(b => b.curve)) hint = "Curve balls change lane partway. Watch them!";
  if (st.type === "aim" && st.enemies.some(e => e.shield)) hint = `Wait for the shield to drop, then throw with ${keyName(KEYS.throw)}!`;
  drawFx(c, dt);
  c.restore();
  if (pnow < flashUntil) { c.globalAlpha = Math.min(0.6, (flashUntil - pnow) / 400); c.fillStyle = flashCol; c.fillRect(0, 0, 960, 640); c.globalAlpha = 1; }
  // phase banner
  if (st.phase && now() - (st.phaseAt || 0) < 2200) {
    const k = (now() - st.phaseAt) / 2200, slide = Math.min(1, k * 5), out = k > 0.8 ? (k - 0.8) / 0.2 : 0;
    c.globalAlpha = 1 - out; c.fillStyle = "rgba(0,0,0,.7)"; c.fillRect(0, 250, 960, 110);
    c.font = "bold 46px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = st.phase >= 3 ? "#ff5252" : "#ffd54f";
    c.fillText(st.phase >= 3 ? "FINAL ATTACK" : `PHASE ${st.phase + 1}`, 480 - (1 - slide) * 600, 312);
    c.font = "16px Nunito, system-ui"; c.fillStyle = "#fff";
    c.fillText(st.phase === 1 ? "Curve balls!" : st.phase === 2 ? "Bombs, ghosts and curves!" : "Catch the white ball!", 480 + (1 - slide) * 600, 342);
    c.globalAlpha = 1;
  }
  c.font = "bold 16px Nunito, system-ui"; c.textAlign = "left"; c.fillStyle = "#ffd54f"; c.fillText(info, 16, 56);
  c.textAlign = "center"; c.fillStyle = "#cfd3e0"; c.font = "15px Nunito, system-ui"; c.fillText(hint, 480, 625);
}
function ballShape(c, kind, s, b) {
  if (kind === "bomb") {
    c.fillStyle = "#212121"; c.strokeStyle = "#ff6d00"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s / 2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = "#ff6d00"; c.beginPath(); c.arc(0, -s / 2 - 3, 3 + Math.random() * 3, 0, Math.PI * 2); c.fill();
    return;
  }
  if (b && b.curve && kind === "dodge") { c.fillStyle = "#ab47bc"; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s / 2, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(0, 0, s / 4, 0, Math.PI * 1.3); c.stroke(); return; }
  if (kind === "dodge") { c.fillStyle = "#e53935"; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s / 2, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else { c.fillStyle = "#fff"; c.fillRect(-s / 2, -s / 2, s, s); }
}
function drawBoss(c, e, t, st, pnow) {
  pnow = pnow || performance.now();
  const seen = bossSeen[e.id] || (bossSeen[e.id] = { hp: e.hp, alive: e.alive, hitAt: 0, deadAt: e.alive ? 0 : 1 });
  const x0 = e.x, s = 190, angry = e.hp <= 2, cap = e.look === "captain", founder = e.look === "founder", maxHp = e.maxHp || 5;
  if (e.hp < seen.hp) {                     // got hit
    seen.hitAt = pnow; shake(260, 9);
    burst(x0 - 60, 320, 26, founder ? ["#ffd54f", "#fff", "#c9a227"] : cap ? ["#4dd0e1", "#fff", "#e53935"] : ["#ce93d8", "#fff", "#ffd54f"], 300);
    floatText(x0, 190, "-1", "#ff5252");
  }
  if (seen.alive && !e.alive) { seen.deadAt = pnow; shake(900, 22); screenFlash(500, "#fff"); burst(x0, 320, 120, ["#ffd54f", "#ff6d00", "#fff", "#e53935"], 520); }
  seen.hp = e.hp; seen.alive = e.alive;
  const hitK = Math.max(0, 1 - (pnow - seen.hitAt) / 260), deadK = e.alive ? 0 : Math.min(1, (pnow - seen.deadAt) / 1200);
  // idle bob, angry tremble, a lunge when it throws
  const firing = st && st.balls.some(b => b.by === "enemy" && now() - b.t0 < 260);
  const x = x0 + (firing ? -14 : 0) + (angry && e.alive ? Math.sin(pnow / 30) * 2 : 0) + hitK * 16;
  const y = 320 + Math.sin(pnow / 520) * 7 + deadK * 160;
  // aura
  if (e.alive) {
    const pulse = 0.5 + 0.5 * Math.sin(pnow / (angry ? 120 : 300)), col = founder ? "255,213,79" : cap ? "77,208,225" : "186,104,200";
    const gr = c.createRadialGradient(x, y, s * 0.3, x, y, s * 0.95); gr.addColorStop(0, `rgba(${col},${0.25 + 0.25 * pulse})`); gr.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gr; c.fillRect(x - s, y - s, s * 2, s * 2);
    if (founder && st && st.phase >= 2) { c.strokeStyle = `rgba(255,82,82,${0.4 + 0.4 * pulse})`; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x, y, s * 0.62 + i * 14 + (pnow / 20) % 14, 0, Math.PI * 2); c.stroke(); } }
  }
  c.save();
  c.translate(x, y); c.rotate(deadK * 0.6); const sc = (1 - deadK * 0.5) * (1 + hitK * 0.08); c.scale(sc * (1 + hitK * 0.06), sc * (1 - hitK * 0.06)); c.translate(-x, -y);
  if (!e.alive) c.globalAlpha = Math.max(0.15, 0.6 - deadK * 0.45);
  c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(x - s / 2 + 8, y - s / 2 + 10, s, s);
  const g = c.createLinearGradient(x, y - s / 2, x, y + s / 2);
  g.addColorStop(0, founder ? "#eceff1" : cap ? "#263238" : "#6a1b9a"); g.addColorStop(1, founder ? "#90a4ae" : cap ? "#0d1117" : "#311b92"); c.fillStyle = g; c.fillRect(x - s / 2, y - s / 2, s, s);
  if (founder) {      // the Founder: pale stone with a gold band and a key mark
    c.fillStyle = "#c9a227"; c.fillRect(x - s / 2, y - s / 2 + 18, s, 10);
    c.strokeStyle = "#c9a227"; c.lineWidth = 5; c.beginPath(); c.arc(x, y - s / 2 - 22, 13, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x, y - s / 2 - 9); c.lineTo(x, y - s / 2 + 2); c.stroke();
  } else if (cap) {          // the Captain: a dark captain's hat with a red badge
    c.fillStyle = "#111"; c.fillRect(x - 80, y - s / 2 - 12, 160, 14); c.fillRect(x - 55, y - s / 2 - 52, 110, 42);
    c.fillStyle = "#e53935"; c.beginPath(); c.arc(x, y - s / 2 - 30, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#4dd0e1"; c.fillRect(x - s / 2, y + s / 2 - 16, s, 6);
  } else {
    c.fillStyle = "#ffd54f"; c.beginPath(); c.moveTo(x - 60, y - s / 2); c.lineTo(x - 40, y - s / 2 - 34); c.lineTo(x - 15, y - s / 2); c.lineTo(x, y - s / 2 - 44); c.lineTo(x + 15, y - s / 2); c.lineTo(x + 40, y - s / 2 - 34); c.lineTo(x + 60, y - s / 2); c.fill();
  }
  const blink = Math.floor(t / 2400) % 8 === 0 && (t % 2400) < 150;
  c.fillStyle = "#fff"; c.fillRect(x - 55, y - 40, 36, blink ? 4 : 30); c.fillRect(x + 19, y - 40, 36, blink ? 4 : 30);
  if (!blink) { c.fillStyle = angry ? "#ff1744" : "#111"; c.fillRect(x - 45, y - 30, 14, 14); c.fillRect(x + 29, y - 30, 14, 14); }
  c.strokeStyle = "#111"; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 62, y - 52); c.lineTo(x - 18, y - 44); c.moveTo(x + 62, y - 52); c.lineTo(x + 18, y - 44); c.stroke();
  c.fillStyle = "#111"; c.beginPath(); if (e.alive) c.ellipse(x, y + 45, 46, angry ? 22 : 12, 0, 0, Math.PI * 2); else c.ellipse(x, y + 50, 30, 6, 0, 0, Math.PI * 2); c.fill();
  if (e.alive) { c.fillStyle = "#fff"; for (let i = -3; i <= 3; i++) c.fillRect(x + i * 12 - 4, y + 36, 8, 8); }
  if (hitK > 0) { c.globalAlpha = hitK * 0.8; c.fillStyle = "#fff"; c.fillRect(x - s / 2, y - s / 2, s, s); }
  c.globalAlpha = 1;
  c.restore();
  // health bar
  c.fillStyle = "#111"; c.fillRect(x0 - 100, 40, 200, 22);
  const seg = 196 / maxHp;
  for (let i = 0; i < maxHp; i++) { c.fillStyle = i < e.hp ? "#e53935" : "#3a3d46"; c.fillRect(x0 - 96 + i * seg, 44, seg - 3, 14); }
  c.font = "bold 14px Nunito, system-ui"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(`${founder ? "" : cap ? "🦹 " : "👹 "}${(e.name || "The Boss").toUpperCase()}`, x0, 34);
}
