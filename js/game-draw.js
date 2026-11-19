// ======================================================================
//  game-draw.js: drawing the game (same look as before)
// ======================================================================
const CUBE = 46;

function renderRulePanel() {
  const show = ball && ball.state === "over" && !ball.ruleChosen && ball.winner === me.id;
  $("rulePanel").style.display = show ? "flex" : "none";
  if (!show || $("rulePanel").dataset.seq == ball.seq) return;
  $("rulePanel").dataset.seq = ball.seq;
  const abilityFull = activeAbilities().length >= 3;
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
    const p = Math.min(1, Math.max(0, localProgress(ball)));
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
      const a = pos[ball.from], b = pos[ball.to], p = Math.min(1, Math.max(0, localProgress(ball)));
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
      const a = pos[ball.by], p = Math.min(1, Math.max(0, localProgress(ball)));
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
  if (roundRunning() && aliveIds().length === 2) {
    const next = Math.max(MIN_FLIGHT, FLIGHT_TIME * Math.pow(DUEL_SPEEDUP, (ball.duel || 0) + 1));
    ctx.font = "bold 16px system-ui"; ctx.fillStyle = "#ffd54f"; ctx.textAlign = "center";
    ctx.fillText(`⚡ Final two! Ball speed ×${(FLIGHT_TIME / next).toFixed(1)}`, 480, 82);
  }
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
  if (IS_RISK && ball && ball.state === "lobby") {
    msg = `🎲 High Risk lobby · stake ⭐ ${ball.stake} · ${humanCount()}/6 players · ${isHost() ? "press Start when ready" : "waiting for " + nm(hostId()) + " to start"}`;
  } else if (IS_RISK && ball && ball.state === "paying") {
    const h = Object.keys(players).filter(id => !players[id].bot);
    msg = `🎲 Paying stakes… ${h.filter(id => players[id].paid != null).length}/${h.length}`;
  } else if (IS_RISK && ball && ball.state === "over") {
    msg = ball.winner ? `🎲 ${nm(ball.winner)} won ⭐ ${ball.pot}! Press ← Leave` : "🤝 Tie: stakes refunded. Press ← Leave";
  } else if (ball && ball.state === "lobby") {
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
