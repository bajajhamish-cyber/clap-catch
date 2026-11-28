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
    if (r.limited || r.platinum) return;
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
    a += `<div class="ab ${why ? "off" : ""}"><kbd>${keyName(abilityKey(i))}</kbd><div><b>${R.icon} ${R.name}</b> <span class="tag">×${left}</span>
          ${why ? `<div class="why">${why}</div>` : `<div class="why" style="color:#7ee787">Ready!</div>`}</div></div>`;
  });
  // stolen abilities that aren't in the room's 3 slots can't happen (stealing only copies room abilities)
  let r = "";
  const all = Object.keys(rules).filter(id => RULES[id]).sort((x, y) => rules[x] - rules[y]);
  if (!all.length) r = "<div style='color:#8a90a2'>Classic rules. No extras yet.</div>";
  all.forEach(id => {
    const R = RULES[id];
    const key = R.type === "ability" && abil.includes(id) ? ` <kbd>${keyName(abilityKey(abil.indexOf(id)))}</kbd>` : "";
    r += `<div class="ab"><div><b>${R.icon} ${R.name}</b><span class="tag">${R.type}</span>${key}<div class="why">${R.desc}</div></div></div>`;
  });
  const html = a + "||" + r;
  if (html !== lastHud) { lastHud = html; $("abilBox").innerHTML = a; $("rulesBox").innerHTML = r; }
}

function rusherPos(pos, id) {           // Bull Rush / Stampede: the rusher runs to the holder and back
  if (!ball || ball.state !== "rush" || ball.by !== id || !pos[id] || !pos[ball.victim]) return pos[id];
  const k = Math.min(1, Math.max(0, (now() - ball.t0) / ball.dur)), f = (k < 0.5 ? k * 2 : (1 - k) * 2) * 0.85;
  return { x: pos[id].x + (pos[ball.victim].x - pos[id].x) * f, y: pos[id].y + (pos[ball.victim].y - pos[id].y) * f };
}
function draw(pos0, t) {
  const pos = Object.assign({}, pos0);
  draw.ballAt = null;
  if (ball && ball.state === "rush") pos[ball.by] = rusherPos(pos0, ball.by);
  const mirage = fxOn("mirage") && fx.mirage.by !== me.id;
  const golden = EVENT_ID === "golden", blackout = EVENT_ID === "blackout";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (fxOn("quake") && fx.quake.by !== me.id) ctx.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
  if (golden) { const g = ctx.createRadialGradient(480, 330, 60, 480, 330, 520); g.addColorStop(0, "#4a3a08"); g.addColorStop(1, "#1f1803"); ctx.fillStyle = g; ctx.fillRect(-20, -20, 1000, 680); }
  else if (U3 && accOf(players[me.id]).wallpaper === "bluewall") { const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, "#1e4f9a"); g.addColorStop(1, "#0b2552"); ctx.fillStyle = g; ctx.fillRect(-20, -20, 1000, 680); }
  ctx.strokeStyle = golden ? "#8a6d12" : "#262a35"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.ellipse(480, 330, 350, 225, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

  const holder = ball && ball.state === "held" ? ball.holder : null;
  const holderP = holder && players[holder];
  const holderCharge = holder === me.id ? myCharge
    : (holderP && holderP.chargeStart ? Math.min(0.97, Math.max(0, (t - holderP.chargeStart) / (CHARGE_TIME * (ball.heavy && !ball.nullified ? (ball.heavy === 3 ? 3 : 2) : 1)))) : 0);
  const holderAim = holder === me.id ? lockedTarget : (holderP ? holderP.aim : null);
  const forced = holder ? forcedSet(holder).length > 0 : false;

  // Hellfire: a wall of flame on the floor between two players. Nobody can throw across it.
  if (S && S.wall && pos[S.wall.a] && pos[S.wall.b]) {
    const a = pos[S.wall.a], b = pos[S.wall.b], tt = performance.now() / 1000, n = 26;
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,90,0,.35)"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (let i = 1; i < n; i++) {                       // flickering flames along the line
      const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, h = 10 + 8 * Math.abs(Math.sin(tt * 7 + i * 1.7));
      const g = ctx.createLinearGradient(x, y, x, y - h); g.addColorStop(0, "rgba(255,80,0,.95)"); g.addColorStop(0.6, "rgba(255,190,0,.8)"); g.addColorStop(1, "rgba(255,240,150,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 6, y + 2); ctx.quadraticCurveTo(x, y - h * 1.3, x + 6, y + 2); ctx.fill();
    }
    ctx.fillStyle = "#ffb74d"; ctx.font = "bold 13px Nunito, system-ui"; ctx.textAlign = "center";
    ctx.fillText(`🔥 WALL OF FLAME · ${S.wall.left} turn${S.wall.left === 1 ? "" : "s"}`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 18);
    ctx.restore();
  }
  // aim line
  const smoked = ball && ball.smoke && !ball.nullified && holder && holder !== me.id;       // Smokescreen: you can't see their bar (Platinum: or aim)
  if (holder && holderAim && pos[holder] && pos[holderAim] && !(smoked && ball.smoke === 2)) {
    const a = pos[holder], b = pos[holderAim];
    ctx.strokeStyle = forced ? "#c77dff" : chargeColor(holderCharge); ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -performance.now() / 30;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    const r = CUBE * 0.9 + Math.sin(performance.now() / 120) * 3;
    ctx.strokeStyle = forced ? "#c77dff" : "#ff4d4d"; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(b.x, b.y, r, ang - 0.4, ang + 0.4); ctx.stroke(); }
    if (forced) { ctx.fillStyle = "#c77dff"; ctx.font = "bold 13px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText("FORCED", (a.x + b.x) / 2, (a.y + b.y) / 2 - 8); }
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
    const acc = mirage ? {} : accOf(p);
    if (!p.out) { const [jx, jy] = accShake(acc, performance.now()); sx += jx; sy += jy; }

    const gr = gripOf(id), C = gr && gr.giant ? CUBE * (gr.giant === true ? 1.5 : gr.giant) : CUBE;
    const dying = U3 ? deathState(p, t) : null;
    if (dying) {           // out animation (accessories): drawn instead of the grey "out" cube for a moment
      drawDeath(ctx, p, dying, q.x - C / 2, q.y - C / 2, C);
      ctx.fillStyle = "#777"; ctx.font = "bold 15px Nunito, system-ui"; ctx.textAlign = "center";
      ctx.fillText(p.name + (id === me.id ? " (you)" : ""), q.x, q.y + C / 2 + 20);
      return;
    }
    if (!p.out) accAura(ctx, acc, q.x - C / 2 + sx, q.y - C / 2 + sy, C, performance.now());
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(q.x - C / 2 + 4 + sx, q.y - C / 2 + 6 + sy, C, C);
    const X = q.x - C / 2 + sx, Y = q.y - C / 2 + sy;
    if (p.out) { ctx.fillStyle = "#3a3d46"; ctx.fillRect(X, Y, C, C); }
    else {
      if (mirage) { ctx.fillStyle = "#8e8e9e"; ctx.fillRect(X, Y, C, C); }
      else drawSkin(ctx, p.skin || "default", X, Y, C, p.color, performance.now());
      if (isHolder && !(U3 && smoked) && !(acc.charge === "fill" && !smoked)) {   // the charge colour shows over any skin (Smokescreen hides it too, after the update)
        ctx.globalAlpha = 0.55 + 0.45 * holderCharge; ctx.fillStyle = chargeColor(holderCharge);
        ctx.fillRect(X, Y, C, C); ctx.globalAlpha = 1;
      }
      if (isHolder && !smoked) accFill(ctx, acc, X, Y, C, holderCharge);      // Fill Up: red liquid in time with the bar
      accWave(ctx, acc, X, Y, C, performance.now());
      if (ball && ball.bounty === id && !mirage) { ctx.font = "22px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText("💰", q.x + C / 2, q.y - C / 2 + 4); }
    }
    ctx.lineWidth = id === me.id ? 4 : 2; ctx.strokeStyle = id === me.id ? "#fff" : "rgba(255,255,255,0.25)";
    if (pickMode && pickValid(pickMode, id)) { ctx.strokeStyle = "#c77dff"; ctx.lineWidth = 4; }
    ctx.strokeRect(q.x - C / 2 + sx, q.y - C / 2 + sy, C, C);
    if (!p.out && !mirage) { accFace(ctx, acc, X, Y, C); accHat(ctx, acc, X, Y, C); }

    if (p.out) {
      ctx.strokeStyle = "#ff5252"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 14); ctx.lineTo(q.x + 14, q.y + 14); ctx.moveTo(q.x + 14, q.y - 14); ctx.lineTo(q.x - 14, q.y + 14); ctx.stroke();
    }

    ctx.fillStyle = p.out ? "#777" : "#fff"; ctx.font = "bold 15px Nunito, system-ui"; ctx.textAlign = "center";
    if (!mirage) ctx.fillText(p.name + (id === me.id ? " (you)" : ""), q.x, q.y + C / 2 + 20);
    else if (id === me.id) ctx.fillText("(you)", q.x, q.y + C / 2 + 20);

    // sudden death: how long they've held the ball during the 30 seconds
    if (SD && roundRunning() && !p.out && !mirage) {
      const ms = sdHeld(id, t), lead = sdLeader(t) === id && ms > 0;
      ctx.font = "bold 14px Nunito, system-ui"; ctx.textAlign = "left"; ctx.fillStyle = lead ? "#ff5252" : "#ffcc80";
      ctx.fillText(`⏱️ ${(ms / 1000).toFixed(1)}s`, q.x + C / 2 + 8, q.y + 5); ctx.textAlign = "center";
    }

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
    const heldBy = ball && ball.state === "held" && ball.holder === id && !ball.nullified;
    if (heldBy && ball.slow) tags.push("🌟 slow throw");
    if (heldBy && ball.heavy) tags.push("🪨 heavy ball");
    if (heldBy && id === me.id && ball.boomerang) tags.push("🪃 boomerang");
    if (heldBy && ball.warcry) tags.push("📢 can't stop!");
    if (heldBy && id === me.id && ball.ghost) tags.push("👻 ghost throw");
    if (heldBy && id === me.id && ball.hellfire) tags.push("😈 wall of flame next throw");
    if (heldBy && id === me.id && ball.phantom) tags.push("🎭 phantom");
    if (p.silenced && p.silenced >= TURN && !p.out) tags.push("🤫 silenced");
    if (!p.out && p.cornered && TURN < p.cornered) tags.push("🦬 neighbours only");
    if (!p.out && gr && !gr.giant) tags.push("🙌 wide grip");
    if (p.out && id === me.id && canUse("vengeance") === "") tags.push("🗡️ VENGEANCE ready!");
    if (mirage) tags = [];
    if (tags.length) { ctx.font = "12px Nunito, system-ui"; ctx.fillStyle = "#c9b8ff"; ctx.fillText(tags.join("  "), q.x, q.y + CUBE / 2 + 36); }

    // empty bar outline = "they've got it and can throw"
    if (isHolder && !p.out && !(ball.lockUntil && t < ball.lockUntil)) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.strokeRect(q.x - 36, q.y - CUBE / 2 - 23, 72, 11);
    }
    // double-force warnings for the holder
    if (isHolder && ball && !ball.nullified) {
      const doom = doomOf(id);
      if (doom) {
        ctx.font = "bold 13px Nunito, system-ui"; ctx.fillStyle = "#ff8a80";
        ctx.fillText(`⛓️ WARD or FULL COUNTER! ${Math.max(0, (DF_GRACE_MS - (t - doom.start)) / 1000).toFixed(1)}s`, q.x, q.y - CUBE / 2 - 46);
      }
    }
    // throw bar
    if (isHolder && holderCharge > 0.001 && !smoked) {
      const w = 70, h = 9, bx = q.x - w / 2, by = q.y - CUBE / 2 - 22;
      ctx.fillStyle = "#000a"; ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
      ctx.fillStyle = chargeColor(holderCharge); ctx.fillRect(bx, by, w * holderCharge, h);
    }
    if (isHolder && smoked) { ctx.font = "bold 13px Nunito, system-ui"; ctx.fillStyle = "#b0bec5"; ctx.fillText("💨 ???", q.x, q.y - CUBE / 2 - 14); }
    // Short Fuse timer
    if (isHolder && ball.fuse && !ball.nullified) {
      const left = Math.max(0, (ball.fuse - t) / 1000);
      ctx.fillStyle = "#ff7043"; ctx.font = "bold 14px Nunito, system-ui"; ctx.fillText(`🧨 ${left.toFixed(1)}s`, q.x, q.y - CUBE / 2 - 30);
    }
    // hot potato timer
    if (isHolder && hasRule("hotPotato") && ball.heldSince) {
      const left = Math.max(0, (HOT_POTATO_MS - (t - ball.heldSince)) / 1000);
      ctx.fillStyle = "#ffb74d"; ctx.font = "bold 14px Nunito, system-ui"; ctx.fillText(`🥔 ${left.toFixed(1)}s`, q.x, q.y - CUBE / 2 - 30);
    }

    const cf = clapFx[id];
    if (cf && performance.now() - cf < 500) {
      const k = (performance.now() - cf) / 500;
      ctx.globalAlpha = 1 - k; ctx.font = `${26 + k * 12}px Nunito, system-ui`;
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
      let a = pos[ball.from];
      const b = pos[ball.to], p = Math.min(1, Math.max(0, localProgress(ball)));
      if (ball.mid && pos[ball.mid.from] && pos[ball.mid.to]) {        // Angelic Scream: starts from where it was turned back
        const m = ball.mid; a = { x: pos[m.from].x + (pos[m.to].x - pos[m.from].x) * m.p, y: pos[m.from].y + (pos[m.to].y - pos[m.from].y) * m.p };
        const w = (now() - ball.t0) / 500;
        if (w < 1) { ctx.strokeStyle = `rgba(255,255,200,${1 - w})`; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(pos[ball.from].x, pos[ball.from].y, 30 + w * 80 + i * 18, 0, Math.PI * 2); ctx.stroke(); } }
      }
      bx = a.x + (b.x - a.x) * p; by = a.y + (b.y - a.y) * p;
      scale = 1 + Math.sin(p * Math.PI) * 0.6;
      const ghostTo = ball.ghost === 2 ? 0.97 : 0.9;
      fire = !ball.nullified && !!ball.fireball;
      if (ball.ghost && !ball.nullified && ball.from !== me.id && p < ghostTo) bx = undefined;       // Ghost Ball: invisible until it's nearly there
      [ball.fake, ball.fake2].forEach(fk => {                                                        // Phantom Throw: see-through fakes
        if (!fk || !pos[fk] || ball.nullified) return;
        const f = pos[fk], fx2 = a.x + (f.x - a.x) * p, fy2 = a.y + (f.y - a.y) * p, s2 = 16 * scale;
        ctx.save(); ctx.globalAlpha = 0.3; ctx.translate(fx2, fy2); ctx.rotate(performance.now() / 150);
        ctx.fillStyle = "#fff"; ctx.fillRect(-s2 / 2, -s2 / 2, s2, s2); ctx.restore();
      });
      const ghostHide = ball.ghost && !ball.nullified && p < ghostTo;
      if (ball.to === me.id && p >= myCatchFrom() && !ghostHide) {
        ctx.strokeStyle = fire ? "#ff5722" : "#ffeb3b"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, CUBE, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = fire ? "#ff5722" : "#ffeb3b"; ctx.font = "bold 18px Nunito, system-ui"; ctx.textAlign = "center";
        ctx.fillText(fire ? "🔥 DON'T CATCH!" : "SPACE!", b.x, b.y - CUBE - 8);
      }
    } else if (ball.state === "rush" && pos[ball.by] && (now() - ball.t0) / ball.dur > 0.5) {
      bx = pos[ball.by].x; by = pos[ball.by].y - CUBE * 0.7;
    } else if (ball.state === "nuke" && pos[ball.by]) {
      const a = pos[ball.by], p = Math.min(1, Math.max(0, localProgress(ball)));
      bx = a.x + (480 - a.x) * p; by = a.y + (330 - a.y) * p;
      scale = 1 + Math.sin(p * Math.PI) * 1.4;
      fire = true;
    }
    draw.ballAt = bx !== undefined ? { x: bx, y: by } : null;
    if (bx !== undefined) {
      const s = 16 * scale;
      if (fire) { ctx.fillStyle = "rgba(255,87,34,0.35)"; ctx.beginPath(); ctx.arc(bx, by, s * 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.translate(bx, by); ctx.rotate(performance.now() / 150);
      ctx.fillStyle = fire ? (ball.platFire ? `hsl(${190 + Math.sin(performance.now() / 90) * 20},100%,75%)` : "#ff7043") : ball.jackpot ? `hsl(${(performance.now() / 4) % 360},90%,60%)` : "#fff"; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = fire ? "#bf360c" : "#ff9800"; ctx.lineWidth = 2; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  // Blackout: everything dark except glowing players and the ball
  if (blackout) {
    const dk = draw.dark || (draw.dark = document.createElement("canvas")); dk.width = 960; dk.height = 640;
    const d = dk.getContext("2d"); d.fillStyle = "rgba(0,0,0,0.93)"; d.fillRect(0, 0, 960, 640); d.globalCompositeOperation = "destination-out";
    const hole = (x, y, r) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2); };
    Object.values(pos).forEach(q => hole(q.x, q.y + 8, 62));
    if (draw.ballAt) hole(draw.ballAt.x, draw.ballAt.y, 70);
    ctx.drawImage(dk, 0, 0);
  }
  // banners
  if (EVENT_ID && EVENTS[EVENT_ID]) { ctx.font = "bold 14px Nunito, system-ui"; ctx.textAlign = "left"; ctx.fillStyle = golden ? "#ffd54f" : "#c9b8ff"; ctx.fillText(`${EVENTS[EVENT_ID].icon} ${EVENTS[EVENT_ID].name}`, 14, 24); }
  if (ball && ball.jackpot && roundRunning()) { ctx.font = "bold 15px Nunito, system-ui"; ctx.textAlign = "right"; ctx.fillStyle = `hsl(${(performance.now() / 4) % 360},90%,65%)`; ctx.fillText("🌈 JACKPOT GAME: win for a free legendary!", 946, 24); }
  if (fxOn("flash") && fx.flash.by !== me.id && now() < fx.flash.at) { ctx.font = "bold 34px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff176"; ctx.fillText("⚡ FLASH INCOMING ⚡", 480, 200); }
  if (roundRunning() && aliveIds().length === 2) {
    const next = Math.max(MIN_FLIGHT, FLIGHT_TIME * Math.pow(DUEL_SPEEDUP, (ball.duel || 0) + 1));
    ctx.font = "bold 16px Nunito, system-ui"; ctx.fillStyle = "#ffd54f"; ctx.textAlign = "center";
    ctx.fillText(`⚡ Final two! Ball speed ×${(FLIGHT_TIME / next).toFixed(1)}`, 480, 82);
  }
  ctx.textAlign = "center";
  if (ball && ball.nullified && roundRunning()) { ctx.font = "bold 18px Nunito, system-ui"; ctx.fillStyle = "#ff8a80"; ctx.fillText("⛔ FULL COUNTER: no abilities this turn", 480, 30); }
  // Eclipse: everything goes dark except a circle of light around you
  if (fxOn("eclipse") && fx.eclipse.by !== me.id && pos[me.id]) {
    const m = pos[me.id], fade = Math.min(1, (fx.eclipse.until - now()) / 400, (now() - fx.eclipse.at) / 200);
    const g = ctx.createRadialGradient(m.x, m.y, 55, m.x, m.y, 125);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(4,3,10,${0.97 * Math.max(0, fade)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 640);
    ctx.font = "bold 16px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(200,190,255,.6)"; ctx.fillText("🌑 ECLIPSE", 480, 30);
  }
  if (pickMode) { ctx.font = "bold 18px Nunito, system-ui"; ctx.fillStyle = "#c77dff"; ctx.fillText(`${RULES[pickMode].icon} Click ${targetText(pickMode)} (Esc to cancel)`, 480, 56); }
  if (performance.now() < flash.until) { ctx.font = "bold 16px Nunito, system-ui"; ctx.fillStyle = "#ffd54f"; ctx.fillText(flash.msg, 480, 620); }

  // ability buttons, bottom left
  const abil = abilitiesOf(me.id), mine0 = players[me.id] || {};
  abil.forEach((id, i) => {
    const x = 16 + i * 66, y = canvas.height - 72, w = 58, h = 58;
    const left = (mine0.uses || {})[id] || 0, ready = !canUse(id);
    ctx.globalAlpha = ready ? 1 : 0.35;
    ctx.fillStyle = "#262a35"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ready ? "#7ee787" : "#3a3f4e"; ctx.lineWidth = ready ? 3 : 2; ctx.strokeRect(x, y, w, h);
    ctx.font = "28px Nunito, system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(RULES[id].icon, x + w / 2, y + h / 2 + 2);
    ctx.fillStyle = "#fff"; ctx.fillRect(x - 6, y - 8, 20, 20);
    ctx.fillStyle = "#14161c"; ctx.font = "bold 13px Nunito, system-ui"; { const kn = keyName(abilityKey(i)); ctx.font = `bold ${kn.length > 2 ? 9 : 13}px Nunito, system-ui`; ctx.fillText(kn.length > 5 ? kn.slice(0, 5) : kn, x + 4, y + 2); }
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px Nunito, system-ui"; ctx.textAlign = "right"; ctx.fillText("×" + left, x + w - 4, y + h - 9);
    ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  });
  ctx.textAlign = "center";

  // centre status
  ctx.font = "bold 20px Nunito, system-ui"; ctx.fillStyle = "#cfd3e0";
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
    if (S && S.friendsOnly) msg = `👥 Only friends here. Waiting for someone else… bots join in ${Math.max(0, Math.ceil((BOT_WAIT_MS - (now() - (ball.createdAt || now()))) / 1000))}s`;
    else if (ball.startAt) msg = `Match found! ${humans} players. Starting in ${Math.max(0, Math.ceil((ball.startAt - now()) / 1000))}s`;
    else msg = `🔎 Looking for players… bots join in ${Math.max(0, Math.ceil((BOT_WAIT_MS - (now() - (ball.createdAt || now()))) / 1000))}s`;
  } else if (!ball || ball.state === "over") {
    if (ball && ball.state === "over" && !ball.ruleChosen && players[ball.winner]) msg = ball.winner === me.id ? "Pick a rule!" : `🏆 ${nm(ball.winner)} won and is picking a rule…`;
    else if (ball && ball.state === "over") msg = `${ball.winner ? "🏆 " + nm(ball.winner) + " won! " : ""}${IS_PUBLIC ? "Next round starting…" : 'Press "Start new round"'}`;
    else msg = `Waiting for players… (${Object.keys(players).length} in room). Press "Start new round"`;
  } else if (ball.state === "wheel") msg = "";
  else if (ball.state === "rush") msg = `🐂 ${nm(ball.by)} is charging at ${nm(ball.victim)}!`;
  else if (ball.state === "nuke") msg = "☢️ NUKE! EVERYONE PRESS B!" + (hasRule("doubleClap") ? " (twice)" : "");
  else if (mine && mine.out) msg = ((mine.uses || {}).redo > 0) ? "You're out. Use REDO to come back!" : canUse("vengeance") === "" ? "You're out… use VENGEANCE now!" : "You're out. Watch the others!";
  else if (iHaveBall()) {
    if (hasRule("noJuke")) msg = "You've got the ball. SPACE throws instantly";
    else msg = charging ? "Charging… let go to fake!" : "You've got the ball. Aim, then hold SPACE";
  }
  else if (ballComingToMe() && ball.ghost && !ball.nullified && localProgress(ball) < 0.9) msg = "Watch the thrower… B = clap, SPACE = catch";
  else if (ballComingToMe() && ball.platFire && !ball.nullified) msg = "💎🔥 PLATINUM FIREBALL! DON'T CLAP, DON'T CATCH!";
  else if (ballComingToMe()) msg = ball.fireball && !ball.nullified ? "🔥 FIREBALL! Don't catch it!" : `IT'S COMING TO YOU! B${hasRule("doubleClap") ? " B" : ""} then SPACE`;
  else if (ball.state === "held" && !ball.nullified && (doubles[ball.holder] || {})[me.id]) msg = `G G G to sacrifice and take ${nm(ball.holder)} out with you`;
  else msg = "Watch the thrower… B = clap, SPACE = catch";
  ctx.fillText(msg, 480, 330);
  if (SD && roundRunning() && ball.state !== "wheel") {
    const left = Math.max(0, (SD.endsAt - t) / 1000);
    ctx.font = "bold 24px Nunito, system-ui"; ctx.fillStyle = left < 10 ? "#ff5252" : "#ffb74d";
    ctx.fillText(`⏱️ ${left.toFixed(1)}s`, 480, 262);
    ctx.font = "bold 14px Nunito, system-ui"; ctx.fillStyle = "#ffcc80";
    ctx.fillText("Unless someone gets out, whoever holds the ball the longest is OUT", 480, 288);
  }
  if (ball && ball.state === "wheel") drawWheel();      // Devil's Deal: covers everything while it spins
  ctx.restore();
}
// sudden death: time held so far (counts up live for whoever has the ball now)
function sdHeld(id, t) {
  if (!SD) return 0;
  return (SD.held[id] || 0) + (SD.holder === id ? Math.max(0, Math.min(t, SD.endsAt) - SD.since) : 0);
}
function sdLeader(t) {
  let best = null, bm = -1;
  Object.keys(players).forEach(id => { if (players[id].out) return; const m = sdHeld(id, t); if (m > bm) { bm = m; best = id; } });
  return best;
}
function drawWheel() {
  const b = ball, k = Math.min(1, Math.max(0, (now() - b.t0) / b.dur));
  ctx.fillStyle = "rgba(10,0,0,0.75)"; ctx.fillRect(0, 0, 960, 640);
  const cx = 480, cy = 320, r = 150, slices = 10;
  // spin fast, then slow down and land on the result (slice 0 = STEAL)
  const land = b.win ? 0 : 1 + (b.t0 % 8);
  const final = -Math.PI / 2 - (land + 0.5) * (Math.PI * 2 / slices) + Math.PI * 2 * 6;
  const ang = final * (1 - Math.pow(1 - k, 3));
  for (let i = 0; i < slices; i++) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, ang + i * Math.PI * 2 / slices, ang + (i + 1) * Math.PI * 2 / slices); ctx.closePath();
    ctx.fillStyle = i === 0 ? "#c62828" : (i % 2 ? "#333" : "#444"); ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang + (i + 0.5) * Math.PI * 2 / slices); ctx.fillStyle = "#fff"; ctx.font = "bold 13px Nunito, system-ui"; ctx.textAlign = "right";
    ctx.fillText(i === 0 ? "😈 STEAL" : "nope", r - 10, 5); ctx.restore();
  }
  ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.moveTo(cx - 14, cy - r - 22); ctx.lineTo(cx + 14, cy - r - 22); ctx.lineTo(cx, cy - r + 4); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 22px Nunito, system-ui"; ctx.textAlign = "center";
  ctx.fillText(`🎡 DEVIL'S DEAL: ${nm(b.by)} paid ${nm(b.target)} 500 points`, cx, 80);
  if (k >= 1 || now() > b.t0 + b.dur - 300) ctx.fillText(b.win ? `😈 STOLEN: ${RULES[b.prize] ? RULES[b.prize].icon + " " + RULES[b.prize].name : ""}!` : "No luck this time", cx, cy + r + 50);
  else ctx.fillText("10% chance to steal their rarest ability forever…", cx, cy + r + 50);
}
