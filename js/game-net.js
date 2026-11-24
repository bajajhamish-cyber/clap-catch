// ======================================================================
//  game-net.js: the game screen. The SERVER runs the game; this file only
//  sends your key presses and draws what the server says is happening.
// ======================================================================
const $ = id => document.getElementById(id);
const canvas = $("c"), ctx = canvas.getContext("2d");
const COLORS = ["#4fc3f7", "#ffb74d", "#ba68c8", "#4db6ac", "#f06292", "#aed581", "#ffd54f", "#7986cb", "#e57373", "#90a4ae"];

// ---------------------------------------------------------------- what the server last told us
let SD = null, S = null, players = {}, ball = null, rules = {}, doubles = {}, fx = {}, EVENT_ID = null, TURN = 0;
// abilities where you click a player after pressing the key
const TARGET_ABILITIES = { counterForce: "who they must throw to", neutralise: "who to Neutralise (costs you 5 points)",
  heavenlyWrath: "who gets Heavenly Wrath (you give them 5 points)", devilsDeal: "who to make a Devil's Deal with (you pay them 500 points)",
  silence: "who to Silence" };
const baseAbility = id => (id && id.startsWith("plat_") ? id.slice(5) : id);      // Platinum versions pick a target the same way
const targetText = id => TARGET_ABILITIES[baseAbility(id)];
let me = { id: null, name: "" };
let MODE = "casual", IS_PUBLIC = false, IS_RISK = false, ROOM_KEY = "", inGame = false;
let CHARGE_TIME = 1400, FLIGHT_TIME = 750, CATCH_FROM = 0.6, DF_GRACE_MS = 3000, HOT_POTATO_MS = 3000, BOT_WAIT_MS = 25000, DUEL_SPEEDUP = 0.88, MIN_FLIGHT = 300;
let sock = null, joinedOK = false;
// server clock: we keep the biggest (server time - our time) seen; that's the server clock as it reaches us
let offsets = [];
const now = () => Date.now() + (offsets.length ? Math.max(...offsets) : 0);

// ---------------------------------------------------------------- local-only (your screen)
let mouse = { x: 480, y: 320, moved: false };
let lockedTarget = null, lastSentAim = undefined;
let charging = false, chargeStart = 0, myCharge = 0;
let pickMode = null, gTimes = [];
let flash = { msg: "", until: 0 };
let clapFx = {}, lastClapSeen = {};
let dispAng = {}, lastPos = {};

function say(msg) { flash = { msg, until: performance.now() + 2200 }; }
function send(msg) { if (sock && sock.readyState === 1) sock.send(JSON.stringify(msg)); }

// ---------------------------------------------------------------- joining a room
function joinGame(key) {
  return new Promise(async (resolve, reject) => {
    let settled = false;
    const tok = await token();
    const url = SERVER.replace(/^http/, "ws") + "/ws/" + key + "?token=" + encodeURIComponent(tok);
    sock = new WebSocket(url);
    sock.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "hello") { me.id = m.you; applyState(m.state); joinedOK = true; startGameScreen(key); if (!settled) { settled = true; resolve(); } }
      else if (m.t === "state") applyState(m.state);
      else if (m.t === "ping") send({ t: "pong", s: m.s });
      else if (m.t === "err") say(m.m);
      else if (m.t === "error") { if (!settled) { settled = true; if (/daily limit/i.test(m.m)) checkLimit(); reject(new Error(m.m)); } }
      else if (m.t === "kicked") { toast(m.m, true); setTimeout(() => location.reload(), 2500); joinedOK = false; }
      else if (m.t === "points" && typeof onPoints === "function") onPoints(m.points);
      else if (m.t === "quests" && m.done) m.done.forEach(t => toast(`🎯 Quest done: ${t}! Claim it in the Quests tab.`));
    };
    sock.onclose = () => {
      if (!settled) { settled = true; checkLimit().then(lim => reject(new Error(lim ? "The game is resting until its daily limit resets" : "Couldn't connect to the game server"))); return; }
      if (joinedOK) {
        joinedOK = false;
        checkLimit().then(lim => { if (!lim) { toast("Disconnected from the game", true); setTimeout(() => location.reload(), 2500); } });
      }
    };
    sock.onerror = () => {};
  });
}
function applyState(st) {
  S = st; players = st.players || {}; ball = st.ball; rules = st.rules || {}; doubles = st.doubles || {};
  fx = st.fx || {}; EVENT_ID = st.event || null; TURN = st.turn || 0; SD = st.sd || null;
  if (fx.clone && fx.clone.look) players = Object.assign({}, players, { [fx.clone.id]: fx.clone.look });   // the clone looks exactly like a player
  effectSounds();
  MODE = st.mode; IS_PUBLIC = st.isPublic; IS_RISK = st.isRisk;
  if (st.tune) ({ CHARGE_TIME, FLIGHT_TIME, CATCH_FROM, DF_GRACE_MS, HOT_POTATO_MS, BOT_WAIT_MS, DUEL_SPEEDUP, MIN_FLIGHT } = st.tune);
  offsets.push(st.now - Date.now()); if (offsets.length > 30) offsets.shift();
  if (!iHaveBall()) { charging = false; myCharge = 0; }
  if (pickMode && canUse(pickMode)) pickMode = null;
}
function startGameScreen(key) {
  ROOM_KEY = key; inGame = true;
  me.name = players[me.id] ? players[me.id].name : "";
  const sl = /^STORY(\d\d)/.exec(key), gr = /^GRIND([EMHS])/.exec(key), slv = sl ? +sl[1] : 0;
  $("roomLabel").textContent = sl && STORY_LEVELS[slv - 1] ? `📖 Story · ${STORY_LEVELS[slv - 1].world > 1 ? `World ${STORY_LEVELS[slv - 1].world} · ` : ""}Level ${slv}: ${STORY_LEVELS[slv - 1].name}`
    : gr ? `🤖 Bot Grind · 2x ${({ E: "Easy", M: "Medium", H: "Hard", S: "Super Hard" })[gr[1]]} · +${({ E: 5, M: 10, H: 20, S: 40 })[gr[1]]} a win`
    : IS_RISK ? `🎲 High Risk · stake ⭐ ${(ball && ball.stake) || 0}`
    : IS_PUBLIC ? "🔎 Matchmade · 🏆 Competitive · earns points"
    : `Room ${key.replace(/^(CAS|COMP)/, "")} · ${MODE === "competitive" ? "🏆 Competitive · private, no points" : "🎉 Casual"}`;
  document.addEventListener("visibilitychange", () => send({ t: "away", away: !!document.hidden }));
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- helpers (read-only views of the server's state)
const nm = id => players[id] ? players[id].name : "someone";
const randomOf = arr => arr[Math.floor(Math.random() * arr.length)];
function seatIds() { return Object.keys(players).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0)); }
function aliveIds() { return seatIds().filter(id => !players[id].out); }
function isAlive(id) { return players[id] && !players[id].out; }
function hasRule(id) { return !!rules[id]; }
function humanCount() { return Object.keys(players).filter(id => !players[id].bot).length; }
function hostId() { return S && S.host; }
function isHost() { return S && S.host === me.id; }
function roundRunning() { return ball && ["held", "flying", "nuke", "rush", "wheel"].includes(ball.state); }
function iHaveBall() { return ball && ball.state === "held" && ball.holder === me.id && isAlive(me.id); }
function ballComingToMe() { return ball && ball.state === "flying" && ball.to === me.id; }
function progress(b) { return (now() - b.t0) / b.dur; }
function localProgress(b) { return progress(b); }
function myAbilities() { return ((S && S.abil && S.abil[me.id]) || []).map(x => x[0]); }
function abilitiesOf() { return myAbilities(); }
function canUse(id) { const x = ((S && S.abil && S.abil[me.id]) || []).find(y => y[0] === id); return x ? x[1] : "-"; }
function activeAbilities() { return Object.keys(rules).filter(id => RULES[id] && RULES[id].type === "ability").sort((a, b) => rules[a] - rules[b]).slice(0, 3); }
function clappedFor(id, t0) {
  const p = players[id]; if (!p) return false;
  const ok = x => (x || 0) >= t0 - 120;
  return hasRule("doubleClap") ? ok(p.clapAt) && ok(p.prevClapAt) : ok(p.clapAt);
}
function forcedSet(h) {
  if (!ball || ball.nullified) return [];
  const set = new Set(Object.keys(doubles[h] || {}).filter(id => players[id]));
  if (ball.counter && players[ball.counter.to] && ball.counter.to !== h) set.add(ball.counter.to);
  return [...set];
}
function myCatchFrom() { return (S && S.catchFrom && S.catchFrom[me.id]) || CATCH_FROM; }
function gripOf(id) { const g = players[id] && players[id].grip; return g && TURN <= g.untilTurn ? g : null; }
function fxOn(k) { const f = fx[k]; return !!f && (f.untilTurn == null || TURN <= f.untilTurn) && (f.until == null || now() < f.until); }
function pickValid(id, target) {
  if (!players[target] || target === me.id) return false;
  id = baseAbility(id);
  if (id === "counterForce") return isAlive(target) && !(ball && ball.holder === target);
  if (id === "devilsDeal") return !players[target].bot && !(fx.clone && fx.clone.id === target);
  return isAlive(target);
}
function allowedTargets(h) {
  if (S && S.allowed && ball && ball.state === "held" && ball.holder === h) return S.allowed.slice();
  let opts = aliveIds().filter(id => id !== h);
  const req = forcedSet(h).filter(isAlive);
  if (req.length) return req;
  if (ball && !ball.nullified && ball.anti && aliveIds().length > 2) { const f = opts.filter(id => !ball.anti[id]); if (f.length) opts = f; }
  return opts;
}
function wardStart(h, by) { return Math.max(ball.heldSince || 0, (players[by] && players[by].outAt) || 0); }
function doomOf(h) {
  if (!ball || ball.state !== "held" || ball.holder !== h || ball.nullified || !isAlive(h)) return null;
  const deadBy = Object.keys(doubles[h] || {}).find(by => players[by] && players[by].out);
  if (deadBy) return { start: wardStart(h, deadBy) };
  if (forcedSet(h).length >= 2) return { start: Math.max(ball.heldSince || 0, (players[h] && players[h].forcedAt) || 0) };
  return null;
}
function botVotes() { return (S && S.votes) || { votes: 0, need: 1 }; }

// ---------------------------------------------------------------- your inputs
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
canvas.addEventListener("mousemove", e => { const p = canvasPoint(e); mouse.x = p.x; mouse.y = p.y; mouse.moved = true; });
canvas.addEventListener("click", e => {
  if (!pickMode) return;
  const p = canvasPoint(e);
  const hit = Object.keys(lastPos).find(id => Math.abs(p.x - lastPos[id].x) < 37 && Math.abs(p.y - lastPos[id].y) < 37);
  if (hit && pickValid(pickMode, hit)) { send({ t: "ability", id: pickMode, target: hit }); pickMode = null; }
  else if (hit) say("You can't pick them for that");
});
window.addEventListener("keydown", e => {
  if (!inGame) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  const k = e.key.toLowerCase(), act = actionFor(k);
  if (act === "throw" || k === " ") e.preventDefault();
  if (e.repeat) return;
  if (S && S.story) { storyKey(act, k); return; }          // story levels 2-6 have their own controls
  if (act === "throw") {
    if (iHaveBall()) {
      if (ball.lockUntil && now() < ball.lockUntil) return;
      if (!hasRule("noJuke")) { charging = true; chargeStart = performance.now(); }
    }
    send({ t: "spaceDown" });
  } else if (act === "clap") {
    const p = players[me.id];
    if (p && !p.out && roundRunning() && !iHaveBall()) { playClap(); clapFx[me.id] = performance.now(); }
    send({ t: "clap" });
  } else if (act === "sac") {
    const t = performance.now(); gTimes = gTimes.filter(x => t - x < 1200); gTimes.push(t);
    if (gTimes.length >= 3) { gTimes = []; send({ t: "ggg" }); }
  } else if (k === "escape") pickMode = null;
  else if (act && act.startsWith("ab")) {
    const id = myAbilities()[+act.slice(2) - 1];
    if (!id) return;
    const why = canUse(id);
    if (why) { say(`${RULES[id].name}: ${why}`); return; }
    if (targetText(id)) { pickMode = id; say(`Click ${targetText(id)} (Esc to cancel)`); return; }
    send({ t: "ability", id });
  } else if (iHaveBall() && (act === "left" || act === "right")) cycleTarget(act === "left" ? -1 : 1);
  else if (iHaveBall() && !act && ["arrowleft", "arrowright"].includes(k)) cycleTarget(k === "arrowleft" ? -1 : 1);
});
window.addEventListener("keyup", e => {
  if (!inGame || actionFor(e.key.toLowerCase()) !== "throw" || (S && S.story)) return;
  charging = false; myCharge = 0;
  send({ t: "spaceUp" });
});
function cycleTarget(dir) {
  if (hasRule("spinning")) return;
  const opts = allowedTargets(me.id);
  if (opts.length < 2) return;
  const i = opts.indexOf(lockedTarget);
  lockedTarget = opts[(i + dir + opts.length) % opts.length];
  mouse.moved = false;
}
function pickTargetFromMouse(pos, opts) {
  const myPos = pos[me.id]; if (!myPos) return null;
  const aim = Math.atan2(mouse.y - myPos.y, mouse.x - myPos.x);
  let best = null, bestDiff = Infinity;
  opts.forEach(id => {
    if (!pos[id]) return;
    const a = Math.atan2(pos[id].y - myPos.y, pos[id].x - myPos.x);
    let d = Math.abs(a - aim); if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestDiff) { bestDiff = d; best = id; }
  });
  return best;
}
$("startBtn").onclick = () => send({ t: "start" });
$("removeBotsBtn").onclick = () => send({ t: "removeBots" });
$("voteBotsBtn").onclick = () => send({ t: "vote" });
$("skipRule").onclick = () => send({ t: "rule", action: "skip" });
function chooseRule(action, id) { send({ t: "rule", action, id }); }

// ---------------------------------------------------------------- chat (the server filters swearing)
let chatShown = -1;
function renderChat() {
  const c = (S && S.chat) || [], last = c.length ? c[c.length - 1].id : 0;
  if (last === chatShown) return;
  chatShown = last;
  const box = $("chatMsgs");
  box.innerHTML = c.length ? c.map(x => `<div><b style="color:${(players[x.by] && players[x.by].color) || "#cfd3e0"}">${escHtml(x.n)}:</b> ${escHtml(x.m)}</div>`).join("") : `<div class="muted small">No messages yet. Say hi!</div>`;
  box.scrollTop = box.scrollHeight;
}
function sendChat() {
  const v = $("chatIn").value.trim(); if (!v) return;
  send({ t: "chat", m: v }); $("chatIn").value = "";
}
$("chatSend").onclick = sendChat;
$("chatIn").addEventListener("keydown", e => {
  e.stopPropagation();
  if (e.key === "Enter") sendChat();
  if (e.key === "Escape") $("chatIn").blur();
});
$("chatIn").addEventListener("keyup", e => e.stopPropagation());

// ---------------------------------------------------------------- effects other players cause (sounds + overlays)
let seenFx = {};
function effectSounds() {
  const f = fx.flash;
  if (f && seenFx.flash !== f.at) { seenFx.flash = f.at; if (f.by !== me.id) playTone(1800, 0.12, "square", 0.25); }
  const sc = fx.scare;
  if (sc && seenFx.scare !== sc.at) { seenFx.scare = sc.at; if (sc.victim === me.id) { playScream(); jumpScareUntil = performance.now() + 1100; } }
  const q = fx.quake;
  if (q && seenFx.quake !== q.at) { seenFx.quake = q.at; if (q.by !== me.id) playTone(55, 0.8, "sawtooth", 0.35); }
  if (ball && ball.state === "wheel" && seenFx.wheel !== ball.t0) { seenFx.wheel = ball.t0; playTone(660, 0.1, "triangle", 0.2); }
  if (ball && ball.mid && seenFx.scream !== ball.t0) { seenFx.scream = ball.t0; playTone(1200, 0.5, "sine", 0.2); }
}
let jumpScareUntil = 0;
function overlays() {      // full-screen Flash and Jump Scare
  const ov = $("fxOverlay"); if (!ov) return;
  const f = fx.flash, t = now();
  let white = 0;
  const wd = (f && f.white) || 1000;
  if (f && f.by !== me.id) { if (t >= f.at && t < f.at + wd) white = 1; else if (t >= f.at + wd) white = Math.max(0, 1 - (t - f.at - wd) / 600); }
  const scary = performance.now() < jumpScareUntil;
  ov.style.display = white > 0 || scary ? "flex" : "none";
  ov.style.background = scary ? "#000" : `rgba(255,255,255,${white})`;
  ov.innerHTML = scary ? `<div class="scare">👹</div>` : "";
}
function playTone(freq, secs, type, vol) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.value = freq; g.gain.value = vol || 0.2;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + secs);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + secs);
  } catch (e) {}
}
function playScream() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(900, actx.currentTime); o.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.7);
    g.gain.value = 0.4; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.8);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.8);
  } catch (e) {}
}

// ---------------------------------------------------------------- sound
let actx;
function playClap() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const len = actx.sampleRate * 0.12, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    f.type = "bandpass"; f.frequency.value = 1500; g.gain.value = 0.8;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(actx.destination); src.start();
  } catch (e) {}
}

// ---------------------------------------------------------------- layout (you're always at the bottom)
function layout() {
  const ids = seatIds(), n = ids.length, cx = 480, cy = 330, rx = 350, ry = 225;
  const myIdx = Math.max(0, ids.indexOf(me.id)), pos = {};
  ids.forEach((id, i) => {
    const target = Math.PI / 2 + ((i - myIdx) / Math.max(n, 1)) * Math.PI * 2;
    if (dispAng[id] === undefined) dispAng[id] = target;
    else { let d = target - dispAng[id]; d = Math.atan2(Math.sin(d), Math.cos(d)); dispAng[id] += d * 0.12; }
    pos[id] = { x: cx + Math.cos(dispAng[id]) * rx, y: cy + Math.sin(dispAng[id]) * ry };
  });
  return pos;
}
function lerpColor(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16)), pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",") + ")";
}
function chargeColor(c) {
  if (c < 0.5) return lerpColor("#2ecc40", "#ff2a1a", c / 0.5);
  return lerpColor("#ff2a1a", "#4a0000", (c - 0.5) / 0.5);
}

// ---------------------------------------------------------------- every frame
function loop() {
  if (!inGame) return;
  const solo = S && (S.story || S.storyLevel || S.grind);
  $("chatBox").style.display = solo ? "none" : ""; $("panels").style.display = S && S.story ? "none" : "";
  $("controls").style.display = S && S.story ? "none" : ""; $("logRow").style.display = S && S.story ? "none" : "";
  if (S && S.story) {                                       // story levels 2-6: side-on arena
    $("startBtn").style.display = "none"; $("voteBotsBtn").style.display = "none"; $("removeBotsBtn").style.display = "none";
    drawStory(now()); storyWindows(); overlays();
    $("log").innerHTML = "";
    requestAnimationFrame(loop); return;
  }
  const pos = layout(); lastPos = pos;
  const t = now();
  // my aim (the server checks it; this just tells it where I'm pointing)
  if (iHaveBall()) {
    const opts = allowedTargets(me.id);
    if (opts.length === 1) lockedTarget = opts[0];
    else if (hasRule("spinning") && opts.length) lockedTarget = opts[(Math.floor((t - (ball.heldSince || t)) / 5000) + (ball.seq % 97)) % opts.length];
    else { if (!opts.includes(lockedTarget)) lockedTarget = null; if (mouse.moved || !lockedTarget) lockedTarget = pickTargetFromMouse(pos, opts); }
    if (lockedTarget !== lastSentAim) { send({ t: "aim", target: lockedTarget || null }); lastSentAim = lockedTarget; }
    if (charging) myCharge = Math.min(1, (performance.now() - chargeStart) / (CHARGE_TIME * (ball.heavy && !ball.nullified ? (ball.heavy === 3 ? 3 : 2) : 1)));
  } else lastSentAim = undefined;
  // other people's claps (sound + animation)
  Object.entries(players).forEach(([id, p]) => {
    if (p.clapFx && p.clapFx !== lastClapSeen[id]) {
      if (lastClapSeen[id] !== undefined && id !== me.id) { playClap(); clapFx[id] = performance.now(); }
      lastClapSeen[id] = p.clapFx;
    }
  });
  const vb = $("voteBotsBtn"), bv = botVotes();
  const showVote = !IS_RISK && Object.keys(players).length < 6 && players[me.id] && humanCount() >= 2;   // can't vote bots in alone
  vb.style.display = showVote ? "" : "none";
  if (showVote) { const mineV = !!players[me.id].botVote; const txt = `🤖 ${mineV ? "Voted" : "Vote"}: add bots (${bv.votes}/${bv.need})`; if (vb.textContent !== txt) vb.textContent = txt; vb.classList.toggle("secondary", mineV); }
  $("removeBotsBtn").style.display = isHost() && Object.values(players).some(p => p.bot) && !IS_PUBLIC && !(S && (S.storyLevel || S.grind)) ? "" : "none";
  if (IS_RISK) { const host = isHost() && ball && ball.state === "lobby"; $("startBtn").style.display = host ? "" : "none"; if (host) $("startBtn").textContent = `Start (everyone pays ⭐ ${ball.stake})`; }
  else $("startBtn").style.display = IS_PUBLIC ? "none" : "";
  $("log").innerHTML = ((S && S.log) || []).slice(-6).reverse().map(l => `<div>${escHtml(l.m)}</div>`).join("");
  renderChat();
  draw(pos, t);
  overlays();
  if (S && S.storyLevel) { storyWindows(); $("startBtn").style.display = "none"; }
  renderHud();
  renderRulePanel();
  requestAnimationFrame(loop);
}
function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
