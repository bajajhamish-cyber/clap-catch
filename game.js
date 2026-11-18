// ======================================================================
//  game.js: the live game (Realtime Database)
// ======================================================================
//  Game tuning
// ======================================================================
const CHARGE_TIME      = 1400;  // ms to fill the throw bar
const FLIGHT_TIME      = 750;   // ms ball takes to travel
const CATCH_FROM       = 0.6;   // catch allowed after 60% of the flight
const DROP_GRACE       = 280;   // ms after arrival before it counts as dropped
const CUBE             = 46;    // player cube size
const CLAP_TOLERANCE   = 120;   // ms: a clap this close before the throw still counts (network lag)
const CLAP_JUDGE_DELAY = 300;   // ms to wait before calling a clap "juked"
const HOT_POTATO_MS    = 3000;
const SPIN_MS          = 5000;
const FIREBALL_WINDOW  = 0.35;  // fireball must be used before the ball is 35% of the way
const REDO_GRACE_MS    = 2500;
const DF_GRACE_MS      = 3000;  // time to Ward before a dead double-forcer takes you out
const FIREBALL_LOCK_MS = 600;   // after a fireball lands on you, Space does nothing until your bar shows  // when 1 player is left, wait this long if someone can still REDO
const MAX_ABILITIES    = 3;
const ABILITY_KEYS     = ["j", "k", "l", "u", "i", "o"];   // J K L for your 3, U I O for stolen extras
const WIN_POINTS       = 25;
// matchmaking (Competitive → Find a match)
const FAST = typeof window !== "undefined" && window.CC_TEST_FAST;   // tests only
const MATCH_MAX        = 6;                       // most players a matchmade room takes
const MATCH_STALE_MS   = 2 * 60 * 1000;           // an open room older than this isn't offered any more
const BOT_WAIT_MS      = FAST ? 1500 : 25000;     // alone this long -> 4 bots join
const START_COUNTDOWN  = FAST ? 1000 : 10000;     // once 2+ real players are in, start after this
const RULE_PICK_MS     = FAST ? 1500 : 25000;     // winner has this long to pick a rule
const NEXT_ROUND_MS    = FAST ? 800 : 5000;       // gap before the next round starts by itself
const MATCH_BOTS       = ["hard", "hard", "medium", "easy"];
const COLORS = ["#4fc3f7","#ffb74d","#ba68c8","#4db6ac","#f06292","#aed581","#ffd54f","#7986cb","#e57373","#90a4ae"];

// ======================================================================
let roomRef, playersRef, ballRef, logRef, rulesRef, doublesRef, myRef;
let me = { id: Math.random().toString(36).slice(2, 10), name: "" };
let players = {}, ball = null, rules = {}, doubles = {};
let serverOffset = 0;
const now = () => Date.now() + serverOffset;

let mouse = { x: 480, y: 320, moved: false };
let lockedTarget = null;
let charging = false, chargeStart = 0, myCharge = 0;
let lastSentAim = null;
let roomCleanupArmed = false;
let resolvedSeq = -1, throwingSeq = -1, dfSeq = -1, endingSeq = -1, hpSeq = -1;
let overPending = 0;
let pickMode = null;           // "counter" while choosing a counter-force target
let gTimes = [];
let flash = { msg: "", until: 0 };
let clapFx = {}, lastClapSeen = {};
let dispAng = {}, lastPos = {};
let MODE = "casual";          // "casual" or "competitive"
let awardSeq = -1;
let inGame = false;
let IS_PUBLIC = false, ROOM_KEY = "";
let startingRound = false, overTimerSeq = -1, overTimerAt = 0, nextRoundAt = 0, lobbyStartedSeq = -1;

const $ = id => document.getElementById(id);
const canvas = $("c"), ctx = canvas.getContext("2d");

// ---------------------------------------------------------------- matchmaking
// One shared "open room" slot. A transaction means two people pressing Play at once
// end up in the same room instead of two empty ones.
async function findMatch(profile) {
  rtdb.ref(".info/serverTimeOffset").once("value", s => serverOffset = s.val() || 0);
  const myKey = "PUB" + Math.random().toString(36).slice(2, 10).toUpperCase().replace(/[^A-Z0-9]/g, "0");
  const res = await rtdb.ref("matchmaking/open").transaction(cur => {
    const t = Date.now() + serverOffset;
    if (cur && cur.key && cur.count < MATCH_MAX && t - (cur.createdAt || 0) < MATCH_STALE_MS) return Object.assign({}, cur, { count: cur.count + 1 });
    return { key: myKey, count: 1, createdAt: t };
  });
  const key = res && res.snapshot && res.snapshot.val() && res.snapshot.val().key;
  if (!key) throw new Error("Matchmaking failed, try again");
  await joinRoom("competitive", null, profile, key);
}
function closeMatchmaking() {
  rtdb.ref("matchmaking/open").transaction(cur => (cur && cur.key === ROOM_KEY) ? null : undefined);
}

// ---------------------------------------------------------------- joining (called from the menu)
const roomKey = (mode, code) => (mode === "competitive" ? "COMP" : "CAS") + code;

async function joinRoom(mode, code, profile, matchKey) {
  MODE = mode;
  me.name = profile.username;
  const key = matchKey || roomKey(mode, code);
  ROOM_KEY = key;
  IS_PUBLIC = key.startsWith("PUB");
  rtdb.ref(".info/serverTimeOffset").on("value", s => serverOffset = s.val() || 0);

  roomRef    = rtdb.ref("rooms/" + key);
  playersRef = roomRef.child("players");
  ballRef    = roomRef.child("ball");
  logRef     = roomRef.child("log");
  rulesRef   = roomRef.child("rules");
  doublesRef = roomRef.child("doubles");
  myRef      = playersRef.child(me.id);

  await sweepEmptyRooms(key);

  if (IS_PUBLIC) {   // a fresh matchmade room starts in the waiting lobby
    await ballRef.transaction(cur => cur ? undefined : { state: "lobby", seq: Date.now(), createdAt: now() });
  }
  const existingBall = (await ballRef.once("value")).val();
  const roundRunning = existingBall && ["held", "flying", "nuke"].includes(existingBall.state);
  const existingPlayers = (await playersRef.once("value")).val() || {};
  const used = Object.values(existingPlayers).map(p => p.color);
  const color = COLORS.find(c => !used.includes(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
  const owned = profile.abilities || {};
  const loadout = mode === "competitive" ? (profile.loadout || []).filter(id => owned[id] > 0 && RULES[id]).slice(0, 3) : [];
  const skin = (profile.skins || {})[profile.equippedSkin] > 0 ? profile.equippedSkin : "default";

  await myRef.set({
    name: me.name, uid: profile.uid, color, skin, loadout,
    joinedAt: firebase.database.ServerValue.TIMESTAMP, seat: Date.now() + Math.random(),
    out: !!roundRunning, chargeStart: 0, aim: null, clapAt: 0, prevClapAt: 0, uses: {}, stole: false
  });
  myRef.onDisconnect().remove();

  playersRef.on("value", s => { players = s.val() || {}; armRoomCleanup(); hostDuties(); });
  ballRef.on("value", s => {
    ball = s.val();
    if (!iHaveBall()) stopCharge(false);
    if (!ball || ball.state !== "held") pickMode = null;
    hostDuties();
  });
  rulesRef.on("value", s => { rules = s.val() || {}; });
  doublesRef.on("value", s => { doubles = s.val() || {}; });
  logRef.limitToLast(6).on("value", s => {
    const items = Object.values(s.val() || {});
    $("log").innerHTML = "";
    items.reverse().forEach(t => { const d = document.createElement("div"); d.textContent = t.msg; $("log").appendChild(d); });
  });

  addLog(`${me.name} joined${roundRunning ? " (watching until next round)" : ""}`);
  $("roomLabel").textContent = IS_PUBLIC ? "🔎 Matchmade · 🏆 Competitive · earns points"
    : `Room ${code} · ${mode === "competitive" ? "🏆 Competitive · private, no points" : "🎉 Casual"}`;
  $("startBtn").style.display = IS_PUBLIC ? "none" : "";
  inGame = true;
  requestAnimationFrame(loop);
}

function addLog(msg) {
  logRef.push({ msg, t: firebase.database.ServerValue.TIMESTAMP });
  if (isHost()) trimLog();
}
function trimLog() {
  logRef.once("value", s => {
    const keys = Object.keys(s.val() || {});
    if (keys.length <= 20) return;
    const del = {};
    keys.slice(0, keys.length - 20).forEach(k => del[k] = null);
    logRef.update(del);
  });
}

// ---------------------------------------------------------------- room cleanup
function armRoomCleanup() {
  const humans = Object.keys(players).filter(id => !players[id].bot);
  const alone = humans.length === 1 && humans[0] === me.id;
  if (alone && !roomCleanupArmed) {
    roomRef.onDisconnect().remove();
    roomCleanupArmed = true;
  } else if (!alone && roomCleanupArmed) {
    roomRef.onDisconnect().cancel();
    myRef.onDisconnect().remove();
    roomCleanupArmed = false;
  }
}
async function sweepEmptyRooms(myRoom) {
  try {
    const all = (await rtdb.ref("rooms").once("value")).val() || {};
    const del = {};
    Object.entries(all).forEach(([code, r]) => {
      if (code !== myRoom && (!r.players || !Object.keys(r.players).length)) del[code] = null;
    });
    if (Object.keys(del).length) await rtdb.ref("rooms").update(del);
  } catch (e) { console.warn("sweep failed", e); }
}

// ---------------------------------------------------------------- helpers
const nm = id => players[id] ? players[id].name : "someone";
const randomOf = arr => arr[Math.floor(Math.random() * arr.length)];
function sortedIds() { return Object.keys(players).sort((a, b) => (players[a].joinedAt || 0) - (players[b].joinedAt || 0)); }
function seatIds() { return Object.keys(players).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0)); }
function hostId() { return sortedIds()[0]; }
function isHost() { return hostId() === me.id; }
function aliveIds() { return seatIds().filter(id => !players[id].out); }
function isAlive(id) { return players[id] && !players[id].out; }
// the Ward countdown starts when the holder has the ball AND their forcer is out, whichever came last
// Is the holder about to go out from forces? Returns { start, why } or null.
function doomOf(h) {
  if (!ball || ball.state !== "held" || ball.holder !== h || ball.nullified || !isAlive(h)) return null;
  const deadBy = Object.keys(doubles[h] || {}).find(by => players[by] && players[by].out);
  if (deadBy) return { start: wardStart(h, deadBy), why: `had to pass to ${nm(deadBy)}, who's out` };
  if (forcedSet(h).length >= 2) return { start: Math.max(ball.heldSince || 0, (players[h] && players[h].forcedAt) || 0), why: "couldn't throw to two people at once" };
  return null;
}
function wardStart(h, by) { return Math.max(ball.heldSince || 0, (players[by] && players[by].outAt) || 0); }
function hasRule(id) { return !!rules[id]; }
function activeAbilities() {
  return Object.keys(rules).filter(id => RULES[id] && RULES[id].type === "ability").sort((a, b) => rules[a] - rules[b]).slice(0, MAX_ABILITIES);
}
// Casual: everyone gets the room's abilities. Competitive: everyone has their own 3.
function baseAbilities(a) {
  if (MODE === "competitive") {
    const lo = (players[a] && players[a].loadout) || [];
    return (Array.isArray(lo) ? lo : Object.values(lo)).filter(id => RULES[id] && RULES[id].type === "ability").slice(0, 3);
  }
  return activeAbilities();
}
// what's on your keys: your abilities, then any extras you stole
function abilitiesOf(a) {
  const base = baseAbilities(a), u = (players[a] && players[a].uses) || {};
  const extra = Object.keys(u).filter(id => u[id] > 0 && RULES[id] && !base.includes(id));
  return [...base, ...extra].slice(0, ABILITY_KEYS.length);
}
function humanCount() { return Object.keys(players).filter(id => !players[id].bot).length; }
function activePassives() { return Object.keys(rules).filter(id => RULES[id] && RULES[id].type === "passive"); }
function roundRunning() { return ball && ["held", "flying", "nuke"].includes(ball.state); }
function holds(a) { return ball && ball.state === "held" && ball.holder === a && isAlive(a); }
function comingTo(a) { return ball && ball.state === "flying" && ball.to === a; }
function iHaveBall() { return holds(me.id); }
function ballComingToMe() { return comingTo(me.id); }
const pref = a => playersRef.child(a);
function isMyBot(id) { return !!(players[id] && players[id].bot && players[id].owner === me.id); }
function chargeOf(a) {
  if (a === me.id) return myCharge;
  const st = botState[a];
  return st && st.cs ? Math.min(1, (performance.now() - st.cs) / CHARGE_TIME) : 0;
}
function progress(b) { return (now() - b.t0) / b.dur; }
function heldBall(holder, lastFrom, seq) { return { state: "held", holder, lastFrom: lastFrom || null, seq, heldSince: now() }; }
function say(msg) { flash = { msg, until: performance.now() + 1800 }; }

function clappedFor(id, t0) {
  const p = players[id]; if (!p) return false;
  const ok = x => (x || 0) >= t0 - CLAP_TOLERANCE;
  return hasRule("doubleClap") ? ok(p.clapAt) && ok(p.prevClapAt) : ok(p.clapAt);
}

// Who can the holder throw to right now?
// Everyone the holder is forced to throw to right now (double forces + counter force)
function forcedSet(h) {
  if (!ball || ball.nullified) return [];
  const set = new Set(Object.keys(doubles[h] || {}).filter(id => players[id]));
  if (ball.counter && players[ball.counter.to] && ball.counter.to !== h) set.add(ball.counter.to);
  return [...set];
}
function allowedTargets(h) {
  let opts = aliveIds().filter(id => id !== h);
  const req = forcedSet(h).filter(isAlive);
  if (req.length) return req;
  if (ball && !ball.nullified && ball.anti && aliveIds().length > 2) {
    const filtered = opts.filter(id => !ball.anti[id]);
    if (filtered.length) opts = filtered;
  }
  return opts;
}

// Eliminate someone (with Soulsteal if it's on)
function eliminate(victim, by, msg) {
  if (!players[victim]) return;
  const u = {};
  u[`players/${victim}/out`] = true;
  u[`players/${victim}/outAt`] = now();
  // "by" is only given for messed-up catches (no clap / drop / fireball). Forces, jukes, nukes, hot potato: nobody steals.
  if (by && by !== victim && hasRule("soulsteal") && isAlive(by) && !players[by].stole) {
    u[`players/${by}/stole`] = true;
    const vu = players[victim].uses || {}, bu = Object.assign({}, players[by].uses || {});
    let got = [];
    Object.keys(vu).forEach(k => {
      if (k !== "redo" && vu[k] > 0) { bu[k] = (bu[k] || 0) + vu[k]; u[`players/${victim}/uses/${k}`] = 0; got.push(RULES[k].name); }
    });
    u[`players/${by}/uses`] = bu;
    if (got.length) msg += ` 👻 ${nm(by)} stole: ${got.join(", ")}`;
  }
  roomRef.update(u);
  addLog(msg);
}

// ---------------------------------------------------------------- host jobs
function hostDuties() {
  if (!isHost() || !ball) return;
  const alive = aliveIds();
  // clean up double forces where someone left
  Object.entries(doubles).forEach(([v, d]) => {
    if (!players[v]) return doublesRef.child(v).remove();
    Object.keys(d || {}).forEach(by => { if (!players[by]) doublesRef.child(v + "/" + by).remove(); });
  });

  if (ball.state === "held" && !players[ball.holder] && alive.length) {
    ballRef.set(heldBall(randomOf(alive), null, (ball.seq || 0) + 1));
  } else if (ball.state === "flying" && !players[ball.to]) {
    const back = isAlive(ball.from) ? ball.from : alive[0];
    if (back) ballRef.set(heldBall(back, null, (ball.seq || 0) + 1));
  }
}

function endRound(winner) {
  if (endingSeq === ball.seq) return;
  endingSeq = ball.seq;
  ballRef.transaction(cur => (cur && ["held", "flying", "nuke"].includes(cur.state))
    ? { state: "over", winner: winner || null, seq: cur.seq + 1, ruleChosen: !winner,
        award: !!(IS_PUBLIC && winner && players[winner] && !players[winner].bot) } : undefined,
    (e, ok) => {
      if (!ok) return;
      if (!winner) return addLog("Round over, nobody left!");
      const pts = MODE !== "competitive" ? "" : !IS_PUBLIC ? " (private room, no points)" : (players[winner] && !players[winner].bot ? " +25 points!" : "");
      addLog(`🏆 ${nm(winner)} wins!${pts} They get to ${MODE === "competitive" ? "add or remove a passive" : "add or remove a rule"}.`);
    });
}

$("startBtn").onclick = () => startRoundNow(false);

async function startRoundNow(auto) {
  if (startingRound) return;
  if (ball && ball.state === "over" && !ball.ruleChosen && players[ball.winner]) { say(`Waiting for ${nm(ball.winner)} to pick a rule…`); return; }
  startingRound = true;
  try {
    if (Object.keys(players).length < 2) {
      const lv = IS_PUBLIC ? MATCH_BOTS : ["easy", "medium", "hard"];
      const want = Object.keys(players).length + lv.length;
      await addBots(lv);
      for (let i = 0; i < 60 && Object.keys(players).length < want; i++) await new Promise(r => setTimeout(r, 50));
    }
    await roomRef.update(freshRoundUpdates());
    addLog(auto ? "New round!" : `New round started by ${me.name}`);
  } finally { startingRound = false; }
}

// matchmade rooms run themselves: lobby countdown, bots if nobody comes, winner timer, next round
function publicHostTick(t) {
  if (!IS_PUBLIC || !isHost() || startingRound) return;
  if (!ball) {   // self-heal: the lobby should always exist
    ballRef.transaction(cur => cur ? undefined : { state: "lobby", seq: Date.now(), createdAt: t });
    return;
  }
  if (ball.state === "lobby") {
    if (lobbyStartedSeq === ball.seq) return;   // already starting this lobby, don't start it twice
    const humans = humanCount();
    if (humans >= 2) {
      if (!ball.startAt) ballRef.transaction(cur => (cur && cur.state === "lobby" && !cur.startAt) ? Object.assign({}, cur, { startAt: t + START_COUNTDOWN }) : undefined);
      else if (t >= ball.startAt) { lobbyStartedSeq = ball.seq; closeMatchmaking(); startRoundNow(true); }
    } else {
      if (ball.startAt) ballRef.transaction(cur => (cur && cur.state === "lobby") ? Object.assign({}, cur, { startAt: null }) : undefined);
      if (t - (ball.createdAt || t) > BOT_WAIT_MS) {
        lobbyStartedSeq = ball.seq;
        closeMatchmaking();
        addLog("Not enough players online, so 4 bots are joining (2 hard, 1 medium, 1 easy)");
        startRoundNow(true);
      }
    }
    return;
  }
  if (ball.state === "over") {
    if (overTimerSeq !== ball.seq) { overTimerSeq = ball.seq; overTimerAt = t; nextRoundAt = 0; }
    if (!ball.ruleChosen) {
      if (t - overTimerAt > RULE_PICK_MS && !isMyBot(ball.winner)) {
        const seq = ball.seq;
        ballRef.transaction(cur => (cur && cur.seq === seq && cur.state === "over" && !cur.ruleChosen) ? Object.assign({}, cur, { ruleChosen: true }) : undefined,
          (e, ok) => { if (ok) addLog(`${nm(ball.winner)} took too long to pick a rule, so nothing changed`); });
      }
    } else {
      if (!nextRoundAt) nextRoundAt = t + NEXT_ROUND_MS;
      if (t >= nextRoundAt) { nextRoundAt = Infinity; startRoundNow(true); }
    }
  }
}

function freshRoundUpdates() {
  const ids = Object.keys(players);
  const updates = {};
  ids.forEach(id => {
    const fresh = {};
    baseAbilities(id).forEach(x => fresh[x] = 1);
    Object.assign(updates, {
      [`players/${id}/out`]: false, [`players/${id}/clapAt`]: 0, [`players/${id}/prevClapAt`]: 0,
      [`players/${id}/chargeStart`]: 0, [`players/${id}/aim`]: null, [`players/${id}/stole`]: false,
      [`players/${id}/uses`]: fresh
    });
  });
  updates["doubles"] = null;
  updates["ball"] = heldBall(randomOf(ids), null, Date.now());
  return updates;
}

// ---------------------------------------------------------------- winner's rule choice
function renderRulePanel() {
  const show = ball && ball.state === "over" && !ball.ruleChosen && ball.winner === me.id;
  $("rulePanel").style.display = show ? "flex" : "none";
  if (!show || $("rulePanel").dataset.seq == ball.seq) return;
  $("rulePanel").dataset.seq = ball.seq;
  const abilityFull = activeAbilities().length >= MAX_ABILITIES;
  $("rulePanelTitle").innerHTML = MODE === "competitive" ? `🏆 You won!${ball.award ? " +25 points." : ""} Add <u>or</u> remove one passive rule` : "🏆 You won! Add <u>or</u> remove one rule";
  const add = $("addList"), rem = $("remList");
  add.innerHTML = ""; rem.innerHTML = "";
  Object.entries(RULES).forEach(([id, r]) => {
    if (MODE === "competitive" && r.type !== "passive") return;
    const b = document.createElement("button");
    const active = hasRule(id);
    b.className = active ? "rem" : "add";
    b.innerHTML = `${r.icon} ${r.name} <span class="tag">${r.type}</span><small>${r.desc}</small>`;
    if (!active && r.type === "ability" && abilityFull) { b.disabled = true; b.innerHTML += "<small>(3 abilities max, remove one first)</small>"; }
    b.onclick = () => chooseRule(active ? "remove" : "add", id);
    (active ? rem : add).appendChild(b);
  });
  if (!rem.children.length) rem.innerHTML = "<div style='color:#8a90a2'>No rules yet</div>";
}
$("skipRule").onclick = () => chooseRule("skip");

function chooseRule(action, id, a = me.id) {
  if (action !== "skip" && (!RULES[id] || (MODE === "competitive" && RULES[id].type !== "passive"))) return;
  const seq = ball.seq;
  ballRef.transaction(cur => (cur && cur.seq === seq && cur.state === "over" && !cur.ruleChosen) ? Object.assign({}, cur, { ruleChosen: true }) : undefined,
    (e, ok) => {
      if (!ok) return;
      if (action === "add") { rulesRef.child(id).set(firebase.database.ServerValue.TIMESTAMP); addLog(`➕ ${nm(a)} added ${RULES[id].icon} ${RULES[id].name}`); }
      else if (action === "remove") { rulesRef.child(id).remove(); addLog(`➖ ${nm(a)} removed ${RULES[id].icon} ${RULES[id].name}`); }
      else addLog(`${nm(a)} kept the rules the same`);
    });
}

// ---------------------------------------------------------------- input
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
canvas.addEventListener("mousemove", e => { const p = canvasPoint(e); mouse.x = p.x; mouse.y = p.y; mouse.moved = true; });
canvas.addEventListener("click", e => {
  if (pickMode !== "counter") return;
  const p = canvasPoint(e);
  const hit = Object.keys(lastPos).find(id => Math.abs(p.x - lastPos[id].x) < CUBE * 0.8 && Math.abs(p.y - lastPos[id].y) < CUBE * 0.8);
  if (hit) applyCounter(hit);
});

window.addEventListener("keydown", e => {
  if (!myRef || document.activeElement.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === " ") e.preventDefault();
  if (e.repeat) return;

  if (k === " ") {
    if (iHaveBall()) {
      if (ball.lockUntil && now() < ball.lockUntil) return;   // wait for your bar to show
      if (hasRule("noJuke")) throwBall();
      else { charging = true; chargeStart = performance.now(); myRef.update({ chargeStart: now() }); }
    } else if (ballComingToMe()) tryCatch();
  } else if (k === "b") clap();
  else if (k === "g") groundSlam();
  else if (k === "escape") pickMode = null;
  else if (ABILITY_KEYS.includes(k)) useAbility(abilitiesOf(me.id)[ABILITY_KEYS.indexOf(k)]);
  else if (iHaveBall() && ["a", "arrowleft", "d", "arrowright", "q", "e"].includes(k)) cycleTarget(["a", "arrowleft", "q"].includes(k) ? -1 : 1);
});
window.addEventListener("keyup", e => { if (e.key === " " && charging) stopCharge(true); });

function stopCharge(sync) {
  if (!charging && myCharge === 0) return;
  charging = false; myCharge = 0;
  if (sync && myRef) myRef.update({ chargeStart: 0 });
}

function cycleTarget(dir) {
  if (hasRule("spinning")) return;
  const opts = allowedTargets(me.id);
  if (opts.length < 2) return;
  let i = opts.indexOf(lockedTarget);
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

// ---------------------------------------------------------------- throwing / catching
function throwBall(a = me.id, tgtArg) {
  const b = ball, tgt = tgtArg !== undefined ? tgtArg : lockedTarget;
  if (!holds(a) || !tgt || !isAlive(tgt) || throwingSeq === b.seq) return;
  throwingSeq = b.seq;
  const req = b.nullified ? [] : forcedSet(a);
  const dur = (b.fast && !b.nullified) ? Math.round(FLIGHT_TIME * 0.6) : FLIGHT_TIME;   // Speed Up
  const nb = { state: "flying", from: a, to: tgt, t0: now(), dur, seq: b.seq + 1, nullified: !!b.nullified };
  ballRef.transaction(cur => (cur && cur.seq === b.seq && cur.state === "held" && cur.holder === a) ? nb : undefined, (e, ok) => {
    if (!ok) return;
    if (b.nullified) return;
    const left = (doubles[a] || {})[tgt];
    if (left) { if (left <= 1) doublesRef.child(a + "/" + tgt).remove(); else doublesRef.child(a + "/" + tgt).set(left - 1); }
    const unmet = req.filter(id => id !== tgt);
    if (unmet.length) eliminate(a, null, `⛓️ ${nm(a)} couldn't throw to everyone they were forced to (${unmet.map(nm).join(", ")}). OUT!`);
  });
  pref(a).update({ chargeStart: 0, aim: null });
  if (a === me.id) { charging = false; myCharge = 0; }
  else if (botState[a]) botState[a].cs = 0;
}

function groundSlam() {
  const t = performance.now();
  gTimes = gTimes.filter(x => t - x < 1200); gTimes.push(t);
  if (gTimes.length < 3) return;
  gTimes = [];
  doSacrifice(me.id);
}

// GGG: take yourself out, any time.
// If you've double-forced the player holding the ball, they can't pass to you, so they're out too
// (unless they Ward / someone uses Full Counter in time).
function doSacrifice(a) {
  const b = ball;
  if (!b || !roundRunning() || !isAlive(a)) return;
  if (holds(a)) {                                   // holding it: drop it, ball goes to someone else
    if (a === me.id) stopCharge(true);
    const others = aliveIds().filter(id => id !== a);
    if (!others.length) return;
    const to = others.includes(b.lastFrom) ? b.lastFrom : randomOf(others);
    ballTx(b.seq, cur => (cur.state === "held" && cur.holder === a) ? heldBall(to, null, cur.seq + 1) : undefined,
      () => eliminate(a, null, `⬇️ ${nm(a)} slammed the ball down and took themselves out. Ball goes to ${nm(to)}`));
    return;
  }
  const forcing = b.state === "held" && isAlive(b.holder) && !b.nullified && (doubles[b.holder] || {})[a];
  eliminate(a, null, forcing
    ? `⬇️ ${nm(a)} slammed it down and sacrificed themselves! ${nm(b.holder)} can't pass to them now, so they're out unless they Ward or someone uses Full Counter!`
    : `⬇️ ${nm(a)} slammed it down and took themselves out`);
}

function clap(a = me.id) {
  const p = players[a];
  if (!p || p.out || !roundRunning() || holds(a)) return;
  if (a === me.id) playClap();
  const t = now();
  pref(a).update({ clapAt: t, prevClapAt: p.clapAt || 0 });
  if (comingTo(a) || ball.state === "nuke") return;          // good clap
  setTimeout(() => {                                               // maybe a throw is already on its way
    const b = ball, mine = players[a];
    if (!mine || mine.out || !b || b.state === "over") return;
    if ((b.state === "flying" && b.to === a || b.state === "nuke") && t >= b.t0 - CLAP_TOLERANCE) return;
    if (b.state === "held" && b.holder === a) return;
    if (((players[a] || {}).braceUntil || 0) >= t) { addLog(`🧱 ${nm(a)} clapped on a fake, but Brace saved them!`); return; }
    eliminate(a, null, `🤡 ${nm(a)} got juked and clapped. OUT!`);
  }, CLAP_JUDGE_DELAY);
}

function tryCatch(a = me.id) {
  const b = ball;
  if (!isAlive(a)) return;
  if (progress(b) < CATCH_FROM) return;
  if (b.fireball && !b.nullified) return resolveFlight(b, "fireballCatch");
  resolveFlight(b, clappedFor(a, b.t0) ? "catch" : "noclap");
}

// kind: catch | noclap | drop | fireballCatch | fireballLand
function resolveFlight(b, kind) {
  if (resolvedSeq === b.seq) return;
  resolvedSeq = b.seq;
  const rid = b.to;
  const safe = kind === "catch" || kind === "fireballLand";
  const back = isAlive(b.from) ? b.from : randomOf(aliveIds().filter(id => id !== rid));
  const nb = safe ? heldBall(rid, b.from, b.seq + 1) : heldBall(back, rid, b.seq + 1);
  if (kind === "fireballLand") nb.lockUntil = now() + FIREBALL_LOCK_MS;
  ballRef.transaction(cur => (cur && cur.seq === b.seq && cur.state === "flying") ? nb : undefined, (e, ok) => {
    if (!ok) return;
    if (!safe && players[rid] && players[rid].out) { addLog(`↩️ ${nm(rid)} was already out, ball goes back to ${nm(back)}`); return; }
    if (kind === "catch") addLog(`✅ ${nm(rid)} clapped and caught it!`);
    else if (kind === "fireballLand") addLog(`🔥 ${nm(rid)} let the fireball land. Safe!`);
    else if (kind === "noclap") eliminate(rid, b.from, `❌ ${nm(rid)} caught without clapping. OUT! Ball goes back to ${nm(back)}.`);
    else if (kind === "fireballCatch") eliminate(rid, b.from, `🔥 ${nm(rid)} tried to catch a fireball. BURNED, OUT!`);
    else eliminate(rid, b.from, `💥 ${nm(rid)} dropped it. OUT!`);
  });
}

function resolveNuke(b) {
  if (resolvedSeq === b.seq) return;
  resolvedSeq = b.seq;
  const alive = aliveIds();
  const fails = alive.filter(id => !clappedFor(id, b.t0));
  if (fails.length === alive.length) {                           // nobody clapped: round resets, everyone's back
    ballRef.transaction(cur => (cur && cur.seq === b.seq && cur.state === "nuke") ? heldBall(b.by, null, b.seq + 1) : undefined, (e, ok) => {
      if (!ok) return;
      roomRef.update(freshRoundUpdates());
      addLog("☢️ Nobody clapped for the nuke! Round reset, everyone's back in!");
    });
    return;
  }
  const survivors = alive.filter(id => !fails.includes(id));
  const holder = survivors.includes(b.by) ? b.by : randomOf(survivors);
  ballRef.transaction(cur => (cur && cur.seq === b.seq && cur.state === "nuke") ? heldBall(holder, null, b.seq + 1) : undefined, (e, ok) => {
    if (!ok) return;
    if (!fails.length) addLog("☢️ The nuke landed. Everyone clapped in time!");
    fails.forEach(id => eliminate(id, null, `☢️ ${nm(id)} didn't clap for the nuke. BOOM, OUT!`));
  });
}

// ---------------------------------------------------------------- abilities
function canUse(id, a = me.id) {
  const mine = players[a], b = ball;
  if (!id || !mine) return "-";
  if (!roundRunning()) return "Round not running";
  if (((mine.uses || {})[id] || 0) <= 0) return "Used up this round";
  if (id === "redo") return mine.out ? "" : "Use after you get out";
  if (mine.out) return "You're out";
  if (b.nullified) return "Full Counter is on this turn";
  const othersHold = b.state === "held" && b.holder !== a;
  switch (id) {
    case "fireball": return (b.state === "flying" && b.from === a && !b.fireball && progress(b) < FIREBALL_WINDOW) ? "" : "Use right after you throw";
    case "swap":
      if (!holds(a)) return "Use while you hold the ball";
      if (chargeOf(a) >= 0.5) return "Too late, your bar is past 50%";
      if (!b.lastFrom || !players[b.lastFrom] || b.lastFrom === a) return "Nobody threw it to you";
      return "";
    case "doubleForce":
      if (!othersHold) return "Use when someone else has the ball";
      return (doubles[b.holder] || {})[a] ? "You already double-forced them" : "";
    case "antiForce":
      if (!othersHold) return "Use when someone else has the ball";
      if (aliveIds().length <= 2) return "Disabled in 1v1";
      if (Object.keys(doubles[b.holder] || {}).length) return "They're double-forced";
      if (b.counter && b.counter.to === a) return "You're their counter-force target";
      if (b.anti && b.anti[a]) return "Already on";
      return "";
    case "counterForce":
      if (!othersHold) return "Use when someone else has the ball";
      if (forcedSet(b.holder).length) return "A force is already on them";
      return aliveIds().length <= 2 ? "Need 3+ players left" : "";
    case "absoluteCounter": return "";
    case "ward": case "nuke": return holds(a) ? "" : "Use while you hold the ball";
    case "brace": return ((players[a] || {}).braceUntil || 0) > now() ? "Already braced" : "";
    case "speedUp":
      if (!othersHold) return "Use when someone else has the ball";
      return b.fast ? "Already sped up" : "";
    case "decoy":
      if (!holds(a)) return "Use while you hold the ball";
      if (b.decoy) return "Already on";
      return allowedTargets(a).length < 2 ? "Needs 2+ people you could throw to" : "";
  }
  return "";
}

function spend(id, a = me.id) {
  pref(a).child("uses/" + id).transaction(n => Math.max(0, (n || 0) - 1));
}

// change the ball only if it's still the same turn
function ballTx(seq, fn, onDone) {
  ballRef.transaction(cur => (cur && cur.seq === seq) ? fn(cur) : undefined, (e, ok) => { if (ok && onDone) onDone(); });
}

function useAbility(id, a = me.id, target) {
  if (!id) return;
  const why = canUse(id, a);
  if (why) { if (a === me.id) say(`${RULES[id].name}: ${why}`); return; }
  const b = ball, R = RULES[id];
  const done = msg => () => { spend(id, a); addLog(`${R.icon} ${msg}`); };

  switch (id) {
    case "fireball":
      ballTx(b.seq, cur => cur.state === "flying" && !cur.nullified ? Object.assign({}, cur, { fireball: true }) : undefined,
        done(`${nm(a)} turned it into a FIREBALL at ${nm(b.to)}! Don't catch it!`));
      break;
    case "swap": {
      const other = b.lastFrom;
      const u = {};
      u[`players/${a}/seat`] = players[other].seat;
      u[`players/${other}/seat`] = players[a].seat;
      roomRef.update(u);
      done(`${nm(a)} SWAPPED places with ${nm(other)}`)();
      break;
    }
    case "doubleForce": {
      const h = b.holder;
      doublesRef.child(h + "/" + a).transaction(cur => cur ? undefined : 2, (e, ok) => {
        if (ok) { pref(h).update({ forcedAt: now() }); done(`${nm(a)} DOUBLE FORCED ${nm(h)}: they must throw to ${nm(a)} now and next time`)(); }
      });
      break;
    }
    case "brace":
      pref(a).update({ braceUntil: now() + 3000 });
      done(`${nm(a)} used BRACE. Fakes can't get them for 3 seconds`)();
      break;
    case "speedUp":
      ballTx(b.seq, cur => (cur.state === "held" && !cur.nullified && !cur.fast) ? Object.assign({}, cur, { fast: true }) : undefined,
        done(`${nm(a)} used SPEED UP. ${nm(b.holder)}'s next throw will be 40% faster!`));
      break;
    case "decoy":
      ballTx(b.seq, cur => (cur.state === "held" && cur.holder === a && !cur.nullified && !cur.decoy) ? Object.assign({}, cur, { decoy: true }) : undefined,
        done(`${nm(a)} used DECOY. Their aim line can't be trusted this turn`));
      break;
    case "antiForce":
      ballTx(b.seq, cur => {
        if (cur.state !== "held" || cur.nullified) return;
        return Object.assign({}, cur, { anti: Object.assign({}, cur.anti || {}, { [a]: true }) });
      }, done(`${nm(a)} used ANTI FORCE. ${nm(b.holder)} can't throw to them this turn`));
      break;
    case "counterForce":
      if (a !== me.id) { applyCounter(target, a); break; }
      pickMode = "counter";
      say("Click who they must throw to (Esc to cancel)");
      break;
    case "absoluteCounter":
      ballTx(b.seq, cur => {
        if (cur.nullified) return;
        if (cur.state === "nuke") return Object.assign(heldBall(cur.by, null, cur.seq + 1), { nullified: true });
        return Object.assign({}, cur, { nullified: true });
      }, () => {
        const victim = b.state === "held" ? b.holder : (b.state === "flying" ? b.from : null);
        if (victim) doublesRef.child(victim).remove();
        done(`${nm(a)} used FULL COUNTER. No abilities work this turn!`)();
      });
      break;
    case "ward":
      ballTx(b.seq, cur => {
        if (cur.state !== "held" || cur.holder !== a || cur.nullified) return;
        const c = Object.assign({}, cur); delete c.counter; delete c.anti; return c;
      }, () => { doublesRef.child(a).remove(); done(`${nm(a)} put up a WARD. All forces on them are gone`)(); });
      break;
    case "nuke":
      if (a === me.id) stopCharge(true);
      ballTx(b.seq, cur => (cur.state === "held" && cur.holder === a && !cur.nullified)
        ? { state: "nuke", by: a, t0: now(), dur: FLIGHT_TIME * 2, seq: cur.seq + 1 } : undefined,
        done(`${nm(a)} launched a NUKE! EVERYONE CLAP!`));
      break;
    case "redo":
      pref(a).update({ out: false, clapAt: 0, prevClapAt: 0 });
      done(`${nm(a)} used REDO and is back in!`)();
      break;
  }
}

function applyCounter(target, a = me.id) {
  const b = ball;
  if (a === me.id) pickMode = null;
  const why = canUse("counterForce", a);
  const no = m => { if (a === me.id) say(m); };
  if (why) return no(why);
  if (target === a) return no("Counter Force can't be yourself");
  if (target === b.holder || !isAlive(target)) return no("Pick someone else who's still in");
  if (forcedSet(b.holder).length) return no("A force is already on them");
  ballTx(b.seq, cur => (cur.state === "held" && !cur.nullified) ? Object.assign({}, cur, { counter: { to: target, by: a } }) : undefined, () => {
    spend("counterForce", a);
    pref(b.holder).update({ forcedAt: now() });
    addLog(`🎯 ${nm(a)} COUNTER FORCED ${nm(b.holder)} to throw to ${nm(target)}`);
  });
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

// ---------------------------------------------------------------- layout (you're always at the bottom, smooth rotation)
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

// ---------------------------------------------------------------- loop
function loop() {
  const pos = layout(); lastPos = pos;
  const t = now();

  if (ball) {
    // --- holder: aim, charge, hot potato
    if (iHaveBall()) {
      const opts = allowedTargets(me.id);
      if (opts.length === 1) lockedTarget = opts[0];
      else if (hasRule("spinning") && opts.length) lockedTarget = opts[(Math.floor((t - (ball.heldSince || t)) / SPIN_MS) + (ball.seq % 97)) % opts.length];
      else {
        if (!opts.includes(lockedTarget)) lockedTarget = null;
        if (mouse.moved || !lockedTarget) lockedTarget = pickTargetFromMouse(pos, opts);
      }
      if (charging) {
        myCharge = Math.min(1, (performance.now() - chargeStart) / CHARGE_TIME);
        if (myCharge >= 1) throwBall();
      }
      hotPotatoCheck(me.id, t);
      const shown = shownAim(me.id, lockedTarget, opts);
      if (shown !== lastSentAim) { myRef.update({ aim: shown || null }); lastSentAim = shown; }
    }

    // --- double force: if the person you must pass to is already out, you're out
    if (ball && ball.state === "held" && isMyBot(ball.holder)) hotPotatoCheck(ball.holder, t);
    if (ball.state === "held" && !ball.nullified && dfSeq !== ball.seq && (ball.holder === me.id || isMyBot(ball.holder) || isHost())) {
      const h = ball.holder, doom = doomOf(h);
      if (doom && t - doom.start > DF_GRACE_MS) {
        dfSeq = ball.seq;
        const b = ball, others = aliveIds().filter(id => id !== h);
        const msg = `⛓️ ${nm(h)} ${doom.why}. OUT!`;
        if (!others.length) eliminate(h, null, msg);
        else {
          const next = others.includes(b.lastFrom) ? b.lastFrom : randomOf(others);
          ballTx(b.seq, cur => (cur.state === "held" && cur.holder === h) ? heldBall(next, null, cur.seq + 1) : undefined, () => {
            doublesRef.child(h).remove();
            eliminate(h, null, msg);
          });
        }
      }
    }

    // --- flight resolution (receiver decides; host backs up)
    if (ball.state === "flying") {
      const late = t - (ball.t0 + ball.dur);
      const kind = ball.fireball && !ball.nullified ? "fireballLand" : "drop";
      if ((ball.to === me.id || isMyBot(ball.to)) && late > DROP_GRACE) resolveFlight(ball, kind);
      else if (isHost() && late > DROP_GRACE + 1500) resolveFlight(ball, kind);
    }

    // --- nuke resolution (nuker decides; host backs up)
    if (ball.state === "nuke") {
      const late = t - (ball.t0 + ball.dur);
      if (((ball.by === me.id || isMyBot(ball.by)) && late > 350) || (isHost() && late > 1700)) resolveNuke(ball);
    }

    // --- round end (host). Waits a moment if someone could still REDO.
    if (isHost() && roundRunning() && Object.keys(players).length >= 2) {
      const alive = aliveIds();
      const pendingDF = ball.state === "held" && !ball.nullified && isAlive(ball.holder) &&
        Object.keys(doubles[ball.holder] || {}).some(by => players[by] && players[by].out);
      if (alive.length === 0 && endingSeq !== ball.seq) {
        endingSeq = ball.seq;
        roomRef.update(freshRoundUpdates());
        addLog("Everyone's out! Round reset, everyone's back in.");
      } else if (alive.length === 1 && pendingDF) {
        overPending = 0;   // let the double force finish first
      } else if (alive.length <= 1) {
        const canRedo = Object.keys(players).some(id => players[id].out && ((players[id].uses || {}).redo || 0) > 0);
        if (!canRedo) endRound(alive[0]);
        else if (!overPending) overPending = performance.now();
        else if (performance.now() - overPending > REDO_GRACE_MS) endRound(alive[0]);
      } else overPending = 0;
    }
  }

  publicHostTick(now());

  // competitive: the winner's own computer adds the points to their account
  if (ball && ball.state === "over" && ball.award && ball.winner === me.id && awardSeq !== ball.seq) {
    awardSeq = ball.seq;
    if (typeof awardWinPoints === "function") awardWinPoints(WIN_POINTS);
  }

  // bots I own
  if (ball) Object.keys(players).forEach(id => { if (isMyBot(id)) { try { botTick(id, t); } catch (e) { console.error("bot", e); } } });
  botRuleChoice();
  $("removeBotsBtn").style.display = Object.keys(players).some(isMyBot) ? "" : "none";

  // clap animations from others
  Object.entries(players).forEach(([id, p]) => {
    if (p.clapAt && p.clapAt !== lastClapSeen[id]) {
      if (lastClapSeen[id] !== undefined && id !== me.id) playClap();
      lastClapSeen[id] = p.clapAt; clapFx[id] = performance.now();
    }
  });

  draw(pos, t);
  renderHud();
  renderRulePanel();
  requestAnimationFrame(loop);
}


// ======================================================================
//  BOTS  (run on the computer of the player who added them)
// ======================================================================
const BOT_LEVELS = {
  //          clap reaction   catch at (of flight)  forgets clap  misses catch  catches fireball  falls for juke  fails nuke  think time    fakes   last-second switch  ability use
  easy:   { react: [260, 460], catchAt: [0.70, 0.92], forgetClap: 0.08,  miss: 0.05,  fireCatch: 0.25, juke: 0.30, nukeFail: 0.12,  think: [600, 1200], fakes: [0, 1], switchProb: 0.15, rate: 0.35, sacrifice: 0 },
  medium: { react: [160, 320], catchAt: [0.68, 0.88], forgetClap: 0.03,  miss: 0.02,  fireCatch: 0.08, juke: 0.12, nukeFail: 0.04,  think: [400, 900],  fakes: [0, 1], switchProb: 0.35, rate: 0.6, sacrifice: 0.25 },
  hard:   { react: [90, 190],  catchAt: [0.66, 0.82], forgetClap: 0.005, miss: 0.005, fireCatch: 0.01, juke: 0.03, nukeFail: 0.005, think: [250, 650],  fakes: [0, 2], switchProb: 0.6,  rate: 0.9, sacrifice: 0.4 },
};
const botState = {};
let botPickAt = 0;
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const rr = arr => rnd(arr[0], arr[1]);
const chance = p => Math.random() < p;

async function addBots(levels = ["easy", "medium", "hard"]) {
  const used = Object.values(players).map(p => p.color);
  const seen = {};
  const free = COLORS.filter(c => !used.includes(c));
  for (let i = 0; i < levels.length; i++) {
    const id = "bot_" + Math.random().toString(36).slice(2, 8);
    const lvl = levels[i];
    seen[lvl] = (seen[lvl] || 0) + 1;
    const label = "🤖 " + lvl[0].toUpperCase() + lvl.slice(1) + (levels.filter(x => x === lvl).length > 1 ? " " + seen[lvl] : "");
    const pool = Object.keys(RULES).filter(x => RULES[x].type === "ability").sort(() => Math.random() - 0.5);
    await pref(id).set({
      loadout: MODE === "competitive" ? pool.slice(0, 3) : [], skin: "default",
      name: label, color: free[i] || COLORS[i], bot: lvl, owner: me.id,
      joinedAt: firebase.database.ServerValue.TIMESTAMP, seat: Date.now() + i + 1,
      out: false, chargeStart: 0, aim: null, clapAt: 0, prevClapAt: 0, uses: {}, stole: false
    });
    pref(id).onDisconnect().remove();   // bots leave when you do
  }
  addLog(`🤖 ${levels.length} bots joined (${levels.join(", ")})`);
}
$("removeBotsBtn").onclick = () => {
  Object.keys(players).filter(isMyBot).forEach(id => pref(id).remove());
  addLog(`🤖 ${me.name} removed the bots`);
};

function hotPotatoCheck(a, t) {
  if (!hasRule("hotPotato") || !holds(a) || t - (ball.heldSince || t) <= HOT_POTATO_MS || hpSeq === ball.seq) return;
  hpSeq = ball.seq;
  const b = ball, others = aliveIds().filter(id => id !== a);
  if (!others.length) return;
  if (a === me.id) stopCharge(true);
  ballTx(b.seq, cur => (cur.state === "held" && cur.holder === a) ? heldBall(randomOf(others), a, cur.seq + 1) : undefined,
    () => eliminate(a, null, `🥔 ${nm(a)} held the hot potato too long. OUT!`));
}

// use an ability if allowed (with a small cooldown so it isn't fired twice)
function botUse(a, st, t, id, target) {
  if (!abilitiesOf(a).includes(id) || t < (st.cool || 0) || canUse(id, a)) return false;
  st.cool = t + 600;
  useAbility(id, a, target);
  return true;
}

function botSpinTarget(opts, t) {
  return opts[(Math.floor((t - (ball.heldSince || t)) / SPIN_MS) + (ball.seq % 97)) % opts.length];
}

function botPickAim(a, t, mode, current) {
  const opts = allowedTargets(a);
  if (!opts.length) return null;
  if (opts.length === 1) return opts[0];
  if (hasRule("spinning")) return botSpinTarget(opts, t);
  if (mode === "other") { const o = opts.filter(id => id !== current); return o.length ? randomOf(o) : current; }
  return randomOf(opts);
}

function botSetAim(a, st, aim) {
  st.aim = aim;
}
// Decoy: everyone else is shown a different target than the real one
const decoyPick = {};
function shownAim(a, real, opts) {
  if (!ball || !ball.decoy || ball.nullified || ball.holder !== a) return real;
  const others = opts.filter(x => x !== real);
  if (!others.length) return real;
  const k = a + ":" + ball.seq;
  if (!decoyPick[k] || decoyPick[k] === real || !others.includes(decoyPick[k])) decoyPick[k] = randomOf(others);
  return decoyPick[k];
}

function makePlan(L) {
  const steps = [];
  const potato = hasRule("hotPotato"), noJuke = hasRule("noJuke");
  let tt = rr(L.think);
  if (potato) tt = Math.min(tt, 450);
  let fakes = noJuke ? 0 : Math.round(rr([L.fakes[0], L.fakes[1] + 0.49]));
  for (let i = 0; i < fakes; i++) {
    const len = CHARGE_TIME * rnd(0.45, 0.9);
    if (potato && tt + 100 + len + 300 + 100 + CHARGE_TIME > HOT_POTATO_MS - 250) break;   // no time to fake
    steps.push({ at: tt, act: "aim" }, { at: tt + 100, act: "charge" }, { at: tt + 100 + len, act: "release" });
    tt += 100 + len + rnd(150, 350);
  }
  steps.push({ at: tt, act: "aim" }, { at: tt + 100, act: "charge" });
  if (!noJuke && chance(L.switchProb)) steps.push({ at: tt + 100 + CHARGE_TIME * rnd(0.82, 0.95), act: "switch" });
  return steps;
}

function botTick(a, t) {
  const p = players[a], L = BOT_LEVELS[p.bot] || BOT_LEVELS.medium;
  const st = botState[a] || (botState[a] = {});
  const b = ball;
  if (!roundRunning()) { st.cs = 0; return; }

  // ----- out: use Redo
  if (p.out) {
    if (!canUse("redo", a)) {
      if (!st.redoAt) st.redoAt = t + rnd(500, 1500);
      if (t >= st.redoAt) { st.redoAt = 0; botUse(a, st, t, "redo"); }
    }
    st.cs = 0;
    return;
  }

  // ----- holding the ball
  if (holds(a)) {
    if (st.holdSeq !== b.seq) {
      st.holdSeq = b.seq; st.planStart = t; st.cs = 0; st.aim = null; st.sentAim = undefined;
      st.wantDecoy = chance(0.5 * L.rate);
      st.plan = makePlan(L);
      st.wantNuke = chance(0.3 * L.rate) && aliveIds().length >= 3;
      st.wantSwap = chance(0.12 * L.rate);
    }
    // danger: 2+ forces, or a double-forcer who's already out
    const req = forcedSet(a);
    const deadForcer = Object.keys(doubles[a] || {}).some(by => players[by] && players[by].out);
    if (req.length >= 2 || deadForcer) {
      if (botUse(a, st, t, "ward") || botUse(a, st, t, "absoluteCounter")) return;
    }
    const el = t - st.planStart;
    if (st.wantSwap && el > 200 && !st.cs) { st.wantSwap = false; botUse(a, st, t, "swap"); }
    if (st.wantDecoy && el > 150) { st.wantDecoy = false; botUse(a, st, t, "decoy"); }
    if (st.wantNuke && st.plan.length && el >= st.plan[0].at) { st.wantNuke = false; if (botUse(a, st, t, "nuke")) return; }

    // keep aim valid (forces / spinning / someone got out)
    const opts = allowedTargets(a);
    if (opts.length && (!opts.includes(st.aim) || opts.length === 1 || hasRule("spinning"))) botSetAim(a, st, botPickAim(a, t, "any", st.aim));

    while (st.plan.length && el >= st.plan[0].at) {
      const step = st.plan.shift();
      if (step.act === "aim") botSetAim(a, st, botPickAim(a, t, "any", st.aim));
      else if (step.act === "switch") botSetAim(a, st, botPickAim(a, t, "other", st.aim));
      else if (step.act === "charge") {
        if (hasRule("noJuke")) { throwBall(a, st.aim); return; }
        st.cs = performance.now(); pref(a).update({ chargeStart: now() });
      } else if (step.act === "release") { st.cs = 0; pref(a).update({ chargeStart: 0 }); }
    }
    const shown = shownAim(a, st.aim, allowedTargets(a));
    if (shown !== st.sentAim) { st.sentAim = shown; pref(a).update({ aim: shown || null }); }
    if (st.cs && chargeOf(a) >= 1) throwBall(a, st.aim);
    return;
  }
  st.cs = 0;

  // ----- I just threw: maybe fireball
  if (b.state === "flying" && b.from === a) {
    if (st.fireSeq !== b.seq) { st.fireSeq = b.seq; st.fireAt = chance(0.6 * L.rate) ? b.t0 + b.dur * rnd(0.08, 0.25) : 0; }
    if (st.fireAt && t >= st.fireAt) { st.fireAt = 0; botUse(a, st, t, "fireball"); }
  }

  // ----- ball flying at me: clap then catch
  if (b.state === "flying" && b.to === a) {
    const key = b.seq + ":" + b.t0;
    if (st.recvKey !== key) {
      st.recvKey = key; st.fireDecided = false;
      const r = rr(L.react);
      st.claps = chance(L.forgetClap) ? [] : (hasRule("doubleClap") ? [b.t0 + r, b.t0 + r + rnd(80, 150)] : [b.t0 + r]);
      st.catchAt = chance(L.miss) ? 0 : b.t0 + b.dur * rr(L.catchAt);
    }
    if (b.fireball && !b.nullified && !st.fireDecided) {
      st.fireDecided = true;
      if (!chance(L.fireCatch)) st.catchAt = 0;          // smart: let the fireball land
    }
    while (st.claps.length && t >= st.claps[0]) { st.claps.shift(); clap(a); }
    if (st.catchAt && t >= st.catchAt) { st.catchAt = 0; tryCatch(a); }
    return;
  }

  // ----- nuke: everybody claps
  if (b.state === "nuke") {
    if (st.nukeKey !== b.seq) {
      st.nukeKey = b.seq;
      const r = rr(L.react) * 1.5;
      st.nClaps = chance(L.nukeFail) ? [] : (hasRule("doubleClap") ? [b.t0 + r, b.t0 + r + rnd(80, 150)] : [b.t0 + r]);
    }
    while (st.nClaps.length && t >= st.nClaps[0]) { st.nClaps.shift(); clap(a); }
    return;
  }

  // ----- someone else holds it: watch for jukes, maybe use abilities
  if (b.state === "held" && b.holder !== a) {
    const h = b.holder, hp = players[h] || {};
    const c = hp.chargeStart ? (t - hp.chargeStart) / CHARGE_TIME : 0;
    if (hp.aim === a && hp.chargeStart) {
      const key = h + ":" + hp.chargeStart;
      if (st.watchKey !== key) { st.watchKey = key; st.jukeAt = rnd(0.72, 0.96); st.jukeDone = false; st.antiDone = false; }
      if (!st.antiDone && c > 0.3) { st.antiDone = true; if (chance(0.45 * L.rate)) botUse(a, st, t, "antiForce"); else if (chance(0.5 * L.rate)) botUse(a, st, t, "brace"); }
      if (!st.jukeDone && c > st.jukeAt) { st.jukeDone = true; if (chance(L.juke)) clap(a); }   // fell for it!
    }
    // GGG: I double-forced the holder. Sacrifice myself so they can't pass to me?
    if ((doubles[h] || {})[a] && !b.nullified && st.sacSeq !== b.seq) {
      st.sacSeq = b.seq;
      const saved = ["ward", "absoluteCounter"].some(id => ((hp.uses || {})[id] || 0) > 0);
      if (!saved && aliveIds().length >= 3 && chance(L.sacrifice)) st.sacAt = t + rnd(300, 900);
    }
    if (st.sacAt && t >= st.sacAt) { st.sacAt = 0; doSacrifice(a); return; }
    if (st.oppSeq !== b.seq) { st.oppSeq = b.seq; st.oppAt = t + rnd(300, 1300); }
    if (st.oppAt && t >= st.oppAt) {
      st.oppAt = 0;
      const already = Object.keys(doubles[h] || {}).filter(by => by !== a).length;
      if (already && chance(0.9 * L.rate) && botUse(a, st, t, "doubleForce")) return;      // 2 forces = they're out
      if (chance(0.25 * L.rate) && botUse(a, st, t, "doubleForce")) return;
      if (chance(0.3 * L.rate) && botUse(a, st, t, "speedUp")) return;
      if (chance(0.2 * L.rate)) {
        const tgt = aliveIds().filter(id => id !== a && id !== h);
        if (tgt.length && botUse(a, st, t, "counterForce", randomOf(tgt))) return;
      }
    }
  }
}

// a bot that wins picks a rule by itself
function botRuleChoice() {
  if (!(ball && ball.state === "over" && !ball.ruleChosen && isMyBot(ball.winner))) { botPickAt = 0; return; }
  if (!botPickAt) { botPickAt = performance.now() + 1500; return; }
  if (performance.now() < botPickAt) return;
  botPickAt = performance.now() + 5000;
  const full = activeAbilities().length >= MAX_ABILITIES;
  const ok = id => MODE !== "competitive" || RULES[id].type === "passive";
  const add = Object.keys(RULES).filter(id => ok(id) && !hasRule(id) && !(full && RULES[id].type === "ability"));
  const rem = Object.keys(rules).filter(id => RULES[id] && ok(id));
  const r = Math.random();
  if (add.length && r < 0.7) chooseRule("add", randomOf(add), ball.winner);
  else if (rem.length && r < 0.9) chooseRule("remove", randomOf(rem), ball.winner);
  else chooseRule("skip", null, ball.winner);
}

// ---------------------------------------------------------------- HUD panels
let lastHud = "";
function renderHud() {
  const mine = players[me.id] || {};
  const abil = abilitiesOf(me.id);
  let a = "";
  if (!abil.length) a = MODE === "competitive" ? "<div style='color:#8a90a2'>No abilities equipped. Get some in the Shop and equip them in Inventory.</div>" : "<div style='color:#8a90a2'>No abilities in this room yet. Win a round to add some!</div>";
  abil.forEach((id, i) => {
    const R = RULES[id], left = (mine.uses || {})[id] || 0, why = canUse(id);
    a += `<div class="ab ${why ? "off" : ""}"><kbd>${ABILITY_KEYS[i].toUpperCase()}</kbd><div><b>${R.icon} ${R.name}</b> <span class="tag">×${left}</span>
          ${why ? `<div class="why">${why}</div>` : `<div class="why" style="color:#7ee787">Ready!</div>`}</div></div>`;
  });
  // stolen abilities that aren't in the room's 3 slots can't happen (stealing only copies room abilities)
  let r = "";
  const all = Object.keys(rules).filter(id => RULES[id]).sort((x, y) => rules[x] - rules[y]);
  if (!all.length) r = "<div style='color:#8a90a2'>Classic rules. No extras yet.</div>";
  all.forEach(id => {
    const R = RULES[id];
    const key = R.type === "ability" && abil.includes(id) ? ` <kbd>${ABILITY_KEYS[abil.indexOf(id)].toUpperCase()}</kbd>` : "";
    r += `<div class="ab"><div><b>${R.icon} ${R.name}</b><span class="tag">${R.type}</span>${key}<div class="why">${R.desc}</div></div></div>`;
  });
  const html = a + "||" + r;
  if (html !== lastHud) { lastHud = html; $("abilBox").innerHTML = a; $("rulesBox").innerHTML = r; }
}

// ---------------------------------------------------------------- drawing
function draw(pos, t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#262a35"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.ellipse(480, 330, 350, 225, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

  const holder = ball && ball.state === "held" ? ball.holder : null;
  const holderP = holder && players[holder];
  const holderCharge = holder === me.id ? myCharge
    : (holderP && holderP.chargeStart ? Math.min(0.97, Math.max(0, (t - holderP.chargeStart) / CHARGE_TIME)) : 0);
  const holderAim = holder === me.id ? lockedTarget : (holderP ? holderP.aim : null);
  const forced = holder ? forcedSet(holder).length > 0 : false;

  // aim line
  if (holder && holderAim && pos[holder] && pos[holderAim]) {
    const a = pos[holder], b = pos[holderAim];
    ctx.strokeStyle = forced ? "#c77dff" : chargeColor(holderCharge); ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -performance.now() / 30;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    const r = CUBE * 0.9 + Math.sin(performance.now() / 120) * 3;
    ctx.strokeStyle = forced ? "#c77dff" : "#ff4d4d"; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(b.x, b.y, r, ang - 0.4, ang + 0.4); ctx.stroke(); }
    if (forced) { ctx.fillStyle = "#c77dff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.fillText("FORCED", (a.x + b.x) / 2, (a.y + b.y) / 2 - 8); }
  }

  // nuke target zone
  if (ball && ball.state === "nuke") {
    const p = Math.min(1, Math.max(0, progress(ball)));
    ctx.strokeStyle = `rgba(255,60,60,${0.5 + Math.sin(performance.now() / 80) * 0.3})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(480, 330, 90 * (1 - p) + 20, 0, Math.PI * 2); ctx.stroke();
  }

  // players
  seatIds().forEach(id => {
    const p = players[id], q = pos[id]; if (!q) return;
    const isHolder = id === holder;

    let sx = 0, sy = 0;
    if (isHolder && holderCharge > 0.6) { const s = (holderCharge - 0.6) * 8; sx = (Math.random() - 0.5) * s; sy = (Math.random() - 0.5) * s; }

    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(q.x - CUBE / 2 + 4 + sx, q.y - CUBE / 2 + 6 + sy, CUBE, CUBE);
    const X = q.x - CUBE / 2 + sx, Y = q.y - CUBE / 2 + sy;
    if (p.out) { ctx.fillStyle = "#3a3d46"; ctx.fillRect(X, Y, CUBE, CUBE); }
    else {
      drawSkin(ctx, p.skin || "default", X, Y, CUBE, p.color, performance.now());
      if (isHolder) {   // the charge colour still shows over any skin: green -> red -> dark red
        ctx.globalAlpha = 0.55 + 0.45 * holderCharge; ctx.fillStyle = chargeColor(holderCharge);
        ctx.fillRect(X, Y, CUBE, CUBE); ctx.globalAlpha = 1;
      }
    }
    ctx.lineWidth = id === me.id ? 4 : 2; ctx.strokeStyle = id === me.id ? "#fff" : "rgba(255,255,255,0.25)";
    if (pickMode === "counter" && isAlive(id) && id !== me.id && id !== holder) { ctx.strokeStyle = "#c77dff"; ctx.lineWidth = 4; }
    ctx.strokeRect(q.x - CUBE / 2 + sx, q.y - CUBE / 2 + sy, CUBE, CUBE);

    if (p.out) {
      ctx.strokeStyle = "#ff5252"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 14); ctx.lineTo(q.x + 14, q.y + 14); ctx.moveTo(q.x + 14, q.y - 14); ctx.lineTo(q.x - 14, q.y + 14); ctx.stroke();
    }

    ctx.fillStyle = p.out ? "#777" : "#fff"; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center";
    ctx.fillText(p.name + (id === me.id ? " (you)" : ""), q.x, q.y + CUBE / 2 + 20);

    // status icons under name
    let tags = [];
    const d = doubles[id] || {};
    const dk = Object.keys(d).filter(by => players[by]);
    if (dk.length) tags.push(`⛓️ → ${dk.map(by => nm(by) + "×" + d[by]).join(", ")}`);
    if (ball && ball.state === "held" && !ball.nullified && ball.anti && ball.anti[id] && aliveIds().length > 2) tags.push("🛡️ anti");
    if (ball && ball.state === "nuke" && !p.out) tags.push(clappedFor(id, ball.t0) ? "✅" : "…");
    if (!p.out && (p.braceUntil || 0) > t) tags.push("🧱 braced");
    if (ball && ball.state === "held" && ball.holder === id && ball.fast && !ball.nullified) tags.push("⏩ fast throw");
    if (ball && ball.state === "held" && ball.holder === id && ball.decoy && !ball.nullified && id === me.id) tags.push("🪞 decoy on");
    if (tags.length) { ctx.font = "12px system-ui"; ctx.fillStyle = "#c9b8ff"; ctx.fillText(tags.join("  "), q.x, q.y + CUBE / 2 + 36); }

    // empty bar outline = "they've got it and can throw"
    if (isHolder && !p.out && !(ball.lockUntil && t < ball.lockUntil)) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 36, q.y - CUBE / 2 - 23, 72, 11);
    }
    // double-force warnings for the holder
    if (isHolder && ball && !ball.nullified) {
      const doom = doomOf(id);
      if (doom) {
        ctx.font = "bold 13px system-ui"; ctx.fillStyle = "#ff8a80";
        ctx.fillText(`⛓️ WARD or FULL COUNTER! ${Math.max(0, (DF_GRACE_MS - (t - doom.start)) / 1000).toFixed(1)}s`, q.x, q.y - CUBE / 2 - 46);
      }
    }
    // throw bar
    if (isHolder && holderCharge > 0.001) {
      const w = 70, h = 9, bx = q.x - w / 2, by = q.y - CUBE / 2 - 22;
      ctx.fillStyle = "#000a"; ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
      ctx.fillStyle = chargeColor(holderCharge); ctx.fillRect(bx, by, w * holderCharge, h);
    }
    // hot potato timer
    if (isHolder && hasRule("hotPotato") && ball.heldSince) {
      const left = Math.max(0, (HOT_POTATO_MS - (t - ball.heldSince)) / 1000);
      ctx.fillStyle = "#ffb74d"; ctx.font = "bold 14px system-ui"; ctx.fillText(`🥔 ${left.toFixed(1)}s`, q.x, q.y - CUBE / 2 - 30);
    }

    const cf = clapFx[id];
    if (cf && performance.now() - cf < 500) {
      const k = (performance.now() - cf) / 500;
      ctx.globalAlpha = 1 - k; ctx.font = `${26 + k * 12}px system-ui`;
      ctx.fillText("👏", q.x + 30, q.y - CUBE / 2 - 10 - k * 20);
      ctx.globalAlpha = 1;
    }
  });

  // ball
  if (roundRunning()) {
    let bx, by, scale = 1, fire = false;
    if (ball.state === "held" && pos[ball.holder]) {
      const h = pos[ball.holder], tgt = holderAim && pos[holderAim];
      const ang = tgt ? Math.atan2(tgt.y - h.y, tgt.x - h.x) : 0;
      bx = h.x + Math.cos(ang) * (CUBE * 0.75); by = h.y + Math.sin(ang) * (CUBE * 0.75);
    } else if (ball.state === "flying" && pos[ball.from] && pos[ball.to]) {
      const a = pos[ball.from], b = pos[ball.to], p = Math.min(1, Math.max(0, progress(ball)));
      bx = a.x + (b.x - a.x) * p; by = a.y + (b.y - a.y) * p;
      scale = 1 + Math.sin(p * Math.PI) * 0.6;
      fire = ball.fireball && !ball.nullified;
      if (ball.to === me.id && p >= CATCH_FROM) {
        ctx.strokeStyle = fire ? "#ff5722" : "#ffeb3b"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, CUBE, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = fire ? "#ff5722" : "#ffeb3b"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "center";
        ctx.fillText(fire ? "🔥 DON'T CATCH!" : "SPACE!", b.x, b.y - CUBE - 8);
      }
    } else if (ball.state === "nuke" && pos[ball.by]) {
      const a = pos[ball.by], p = Math.min(1, Math.max(0, progress(ball)));
      bx = a.x + (480 - a.x) * p; by = a.y + (330 - a.y) * p;
      scale = 1 + Math.sin(p * Math.PI) * 1.4;
      fire = true;
    }
    if (bx !== undefined) {
      const s = 16 * scale;
      if (fire) { ctx.fillStyle = "rgba(255,87,34,0.35)"; ctx.beginPath(); ctx.arc(bx, by, s * 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.translate(bx, by); ctx.rotate(performance.now() / 150);
      ctx.fillStyle = fire ? "#ff7043" : "#fff"; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = fire ? "#bf360c" : "#ff9800"; ctx.lineWidth = 2; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  // banners
  ctx.textAlign = "center";
  if (ball && ball.nullified && roundRunning()) { ctx.font = "bold 18px system-ui"; ctx.fillStyle = "#ff8a80"; ctx.fillText("⛔ FULL COUNTER: no abilities this turn", 480, 30); }
  if (pickMode === "counter") { ctx.font = "bold 18px system-ui"; ctx.fillStyle = "#c77dff"; ctx.fillText("🎯 Click who they must throw to (Esc to cancel)", 480, 56); }
  if (performance.now() < flash.until) { ctx.font = "bold 16px system-ui"; ctx.fillStyle = "#ffd54f"; ctx.fillText(flash.msg, 480, 620); }

  // ability buttons, bottom left
  const abil = abilitiesOf(me.id), mine0 = players[me.id] || {};
  abil.forEach((id, i) => {
    const x = 16 + i * 66, y = canvas.height - 72, w = 58, h = 58;
    const left = (mine0.uses || {})[id] || 0, ready = !canUse(id);
    ctx.globalAlpha = ready ? 1 : 0.35;
    ctx.fillStyle = "#262a35"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ready ? "#7ee787" : "#3a3f4e"; ctx.lineWidth = ready ? 3 : 2; ctx.strokeRect(x, y, w, h);
    ctx.font = "28px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(RULES[id].icon, x + w / 2, y + h / 2 + 2);
    ctx.fillStyle = "#fff"; ctx.fillRect(x - 6, y - 8, 20, 20);
    ctx.fillStyle = "#14161c"; ctx.font = "bold 13px system-ui"; ctx.fillText(ABILITY_KEYS[i].toUpperCase(), x + 4, y + 2);
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "right"; ctx.fillText("×" + left, x + w - 4, y + h - 9);
    ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  });
  ctx.textAlign = "center";

  // centre status
  ctx.font = "bold 20px system-ui"; ctx.fillStyle = "#cfd3e0";
  let msg = "";
  const mine = players[me.id];
  if (ball && ball.state === "lobby") {
    const humans = humanCount();
    if (ball.startAt) msg = `Match found! ${humans} players. Starting in ${Math.max(0, Math.ceil((ball.startAt - now()) / 1000))}s`;
    else msg = `🔎 Looking for players… bots join in ${Math.max(0, Math.ceil((BOT_WAIT_MS - (now() - (ball.createdAt || now()))) / 1000))}s`;
  } else if (!ball || ball.state === "over") {
    if (ball && ball.state === "over" && !ball.ruleChosen && players[ball.winner]) msg = ball.winner === me.id ? "Pick a rule!" : `🏆 ${nm(ball.winner)} won and is picking a rule…`;
    else if (ball && ball.state === "over") msg = `${ball.winner ? "🏆 " + nm(ball.winner) + " won! " : ""}${IS_PUBLIC ? "Next round starting…" : 'Press "Start new round"'}`;
    else msg = `Waiting for players… (${Object.keys(players).length} in room). Press "Start new round"`;
  } else if (ball.state === "nuke") msg = "☢️ NUKE! EVERYONE PRESS B!" + (hasRule("doubleClap") ? " (twice)" : "");
  else if (mine && mine.out) msg = ((mine.uses || {}).redo > 0) ? "You're out. Use REDO to come back!" : "You're out. Watch the others!";
  else if (iHaveBall()) {
    if (hasRule("noJuke")) msg = "You've got the ball. SPACE throws instantly";
    else msg = charging ? "Charging… let go to fake!" : "You've got the ball. Aim, then hold SPACE";
  }
  else if (ballComingToMe()) msg = ball.fireball && !ball.nullified ? "🔥 FIREBALL! Don't catch it!" : `IT'S COMING TO YOU! B${hasRule("doubleClap") ? " B" : ""} then SPACE`;
  else if (ball.state === "held" && !ball.nullified && (doubles[ball.holder] || {})[me.id]) msg = `G G G to sacrifice and take ${nm(ball.holder)} out with you`;
  else msg = "Watch the thrower… B = clap, SPACE = catch";
  ctx.fillText(msg, 480, 330);
}
