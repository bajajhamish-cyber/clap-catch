// ======================================================================
//  extras.js: the newer features (accessories, Weekly Shop, World 3,
//  Creator Pack, the new look). None of it shows until the admin has
//  switched the update on; the server refuses all of it before that too.
// ======================================================================
let U3 = false;
function setU3(on) {
  if (!on || setU3.done) return;
  setU3.done = true; U3 = true;
  try { localStorage.setItem("cc_u3", "1"); } catch (e) {}
  document.body.classList.add("u3");
  el("weeklyTabBtn").hidden = false;
  RULES.fireball.desc = "Use while you hold the ball to make your next throw a fireball, or right after you throw (before 35% of the way). They don't need to clap, but if they press catch they're OUT. If it lands, it's theirs.";
  const ab4 = KEY_ACTIONS.find(a => a[0] === "ab4"); if (ab4) ab4[1] = "Ability 4 (Backpack) / stolen ability 1";
  document.querySelectorAll("[data-u3]").forEach(n => { n.textContent = n.dataset.u3; });     // shorter wording
  startPlainText();
}

// ---------------------------------------------------------------- accessories: drawing
const accOf = p => (U3 && p && p.acc) || {};
function accHat(c, a, x, y, s) {
  if (a.hat === "tophat") {
    c.fillStyle = "#2e2e33"; c.strokeStyle = "#8a8a94"; c.lineWidth = 1.5;
    c.fillRect(x + s * 0.25, y - s * 0.5, s * 0.5, s * 0.46); c.strokeRect(x + s * 0.25, y - s * 0.5, s * 0.5, s * 0.46);
    c.fillRect(x + s * 0.1, y - s * 0.07, s * 0.8, s * 0.1); c.strokeRect(x + s * 0.1, y - s * 0.07, s * 0.8, s * 0.1);
    c.fillStyle = "#c62828"; c.fillRect(x + s * 0.25, y - s * 0.17, s * 0.5, s * 0.08);
  } else if (a.hat === "cap") {
    const col = a.capColor || CAP_COLORS[0];
    c.fillStyle = col; c.beginPath(); c.moveTo(x + s * 0.12, y + s * 0.02); c.quadraticCurveTo(x + s * 0.5, y - s * 0.42, x + s * 0.88, y + s * 0.02); c.closePath(); c.fill();
    c.fillRect(x + s * 0.5, y - s * 0.03, s * 0.62, s * 0.08);              // peak
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(x + s * 0.5, y + s * 0.02, s * 0.62, s * 0.03);
  }
}
function accFace(c, a, x, y, s) {
  if (a.face === "shades") {
    c.fillStyle = "#111";
    c.fillRect(x + s * 0.14, y + s * 0.3, s * 0.3, s * 0.17); c.fillRect(x + s * 0.56, y + s * 0.3, s * 0.3, s * 0.17);
    c.fillRect(x + s * 0.4, y + s * 0.33, s * 0.2, s * 0.05);
    c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + s * 0.18, y + s * 0.32, s * 0.08, s * 0.04); c.fillRect(x + s * 0.6, y + s * 0.32, s * 0.08, s * 0.04);
  } else if (a.face === "smiley") {
    c.strokeStyle = "#1b1b1b"; c.fillStyle = "#1b1b1b"; c.lineWidth = Math.max(2, s * 0.05); c.lineCap = "round";
    c.beginPath(); c.arc(x + s * 0.33, y + s * 0.38, s * 0.05, 0, Math.PI * 2); c.arc(x + s * 0.67, y + s * 0.38, s * 0.05, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + s * 0.5, y + s * 0.52, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); c.lineCap = "butt";
  }
}
function accAura(c, a, x, y, s, t) {
  if (a.aura === "pulse") {
    const k = (t % 1300) / 1300, r = s * 0.55 + k * s * 0.5;
    c.strokeStyle = `rgba(120,200,255,${0.7 * (1 - k)})`; c.lineWidth = 3;
    c.beginPath(); c.arc(x + s / 2, y + s / 2, r, 0, Math.PI * 2); c.stroke();
  }
}
function accWave(c, a, x, y, s, t) {               // drawn on top of the cube: a light band moving top to bottom
  if (a.aura !== "wave") return;
  const k = (t % 1600) / 1600, by = y - s * 0.3 + k * s * 1.6;
  c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip();
  const g = c.createLinearGradient(0, by - s * 0.18, 0, by + s * 0.18);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(x, by - s * 0.18, s, s * 0.36); c.restore();
}
function accShake(a, t) { return a.motion === "shake" ? [Math.sin(t / 23) * 1.6, Math.cos(t / 29) * 1.3] : [0, 0]; }
function accFill(c, a, x, y, s, k) {                // red liquid filling up in time with the throw bar
  if (a.charge !== "fill" || k <= 0) return;
  const h = s * Math.min(1, k), top = y + s - h, t = performance.now();
  c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip();
  c.fillStyle = "#c62828"; c.beginPath(); c.moveTo(x, y + s);
  for (let i = 0; i <= 10; i++) { const px = x + (s * i) / 10; c.lineTo(px, top + Math.sin(t / 120 + i * 0.9) * Math.min(3, h / 6)); }
  c.lineTo(x + s, y + s); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x + s * 0.12, top + 3, s * 0.1, Math.max(0, h - 6));
  c.restore();
}
// out animations: a lightning strike from the person who got them out (if they have it), then their own animation
const LIGHTNING_MS = 420, DEATH_MS = 950;
function deathState(p, t) {
  if (!U3 || !p.out || !p.outAt) return null;
  const since = t - p.outAt, killer = p.killer && players[p.killer];
  const zap = accOf(killer).kill === "lightning" ? LIGHTNING_MS : 0;
  const anim = accOf(p).death;
  if (since < 0 || since > zap + (anim ? DEATH_MS : 0)) return null;
  if (since < zap) return { kind: "zap", k: since / zap };
  return anim ? { kind: anim, k: (since - zap) / DEATH_MS } : null;
}
function drawDeath(c, p, st, x, y, s) {
  const skin = () => drawSkin(c, p.skin || "default", x, y, s, p.color, performance.now());
  if (st.kind === "zap") {
    skin();
    const cx = x + s / 2, flick = Math.random() > 0.3;
    c.strokeStyle = flick ? "#fff59d" : "#ffffff"; c.lineWidth = 4; c.shadowColor = "#fff176"; c.shadowBlur = 18;
    c.beginPath(); let px = cx + 10, py = 0; c.moveTo(px, py);
    while (py < y + s / 2) { py += 34; px = cx + (Math.random() - 0.5) * 40; c.lineTo(px, Math.min(py, y + s / 2)); }
    c.stroke(); c.shadowBlur = 0;
    c.fillStyle = `rgba(255,255,220,${0.6 * (1 - st.k)})`; c.fillRect(x - 6, y - 6, s + 12, s + 12);
    return;
  }
  const k = Math.min(1, st.k);
  if (st.kind === "fade") { c.save(); c.globalAlpha = 1 - k; skin(); c.restore(); }
  else if (st.kind === "split") {
    [-1, 1].forEach(side => {
      c.save();
      const dx = side * k * s * 0.7, dy = k * k * s * 2.2, rot = side * k * 0.9;
      c.translate(x + s / 2 + dx, y + s / 2 + dy); c.rotate(rot); c.globalAlpha = 1 - k * 0.7;
      c.beginPath(); c.rect(side < 0 ? -s / 2 : 0, -s / 2, s / 2, s); c.clip();
      drawSkin(c, p.skin || "default", -s / 2, -s / 2, s, p.color, performance.now());
      c.restore();
    });
  } else if (st.kind === "explode") {
    if (k < 0.25) { c.fillStyle = `rgba(255,200,80,${1 - k * 4})`; c.beginPath(); c.arc(x + s / 2, y + s / 2, s * (0.6 + k * 3), 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i, d = k * s * (1.2 + (i % 4) * 0.35), sz = s * 0.18 * (1 - k * 0.6);
      c.fillStyle = i % 3 === 0 ? "#ff7043" : i % 3 === 1 ? "#ffca28" : (p.color || "#4fc3f7");
      c.globalAlpha = 1 - k; c.fillRect(x + s / 2 + Math.cos(a) * d - sz / 2, y + s / 2 + Math.sin(a) * d + k * k * 30 - sz / 2, sz, sz);
    }
    c.globalAlpha = 1;
  }
}
// a small picture of an accessory on a plain cube (shop and inventory)
function drawAccPreview(cv, id) {
  const c = cv.getContext("2d"), W = cv.width, s = W * 0.5, x = (W - s) / 2, y = W * 0.34, a = {}, A = ACCESSORIES[id];
  a[A.slot] = id; if (id === "cap") a.capColor = (PROFILE && PROFILE.capColor) || CAP_COLORS[0];
  let start = performance.now();
  (function frame() {
    if (!cv.isConnected) return;
    const t = performance.now(), k = ((t - start) % 2200) / 2200;
    c.clearRect(0, 0, W, W);
    if (A.slot === "wallpaper") { const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, "#1e4f9a"); g.addColorStop(1, "#0b2552"); c.fillStyle = g; c.fillRect(0, 0, W, W); }
    const [sx, sy] = accShake(a, t);
    if (A.slot === "death" || A.slot === "kill") {
      const p = { skin: "default", color: "#4fc3f7" };
      if (k < 0.15) drawSkin(c, "default", x, y, s, "#4fc3f7", t);
      else if (A.slot === "kill") { const kk = (k - 0.15) / 0.85; if (kk < 0.5) drawDeath(c, p, { kind: "zap", k: kk * 2 }, x, y, s); }
      else drawDeath(c, p, { kind: id, k: Math.min(1, (k - 0.15) / 0.6) }, x, y, s);
    } else {
      accAura(c, a, x + sx, y + sy, s, t);
      drawSkin(c, "default", x + sx, y + sy, s, "#4fc3f7", t);
      if (A.slot === "charge") accFill(c, a, x, y, s, Math.min(1, k * 1.3));
      accWave(c, a, x + sx, y + sy, s, t);
      accFace(c, a, x + sx, y + sy, s); accHat(c, a, x + sx, y + sy, s);
      if (id === "backpack") { c.fillStyle = "#6d4c41"; c.fillRect(x + s * 0.92, y + s * 0.15, s * 0.28, s * 0.7); c.fillStyle = "#4e342e"; c.fillRect(x + s * 0.95, y + s * 0.45, s * 0.22, s * 0.12); }
    }
    requestAnimationFrame(frame);
  })();
}

// ---------------------------------------------------------------- everything that needs a re-draw when your account changes
function renderU3() {
  el("weeklyTabBtn").hidden = false;
  // Creator Pack pictures: load them (again, if they weren't all there last time we looked)
  const complete = CREATOR && CREATOR_SKINS.every(id => CREATOR[id]);
  if (!complete && !creatorLoading && Date.now() - (renderU3.triedAt || 0) > 20000) {
    renderU3.triedAt = Date.now(); CREATOR = null;
    loadCreatorSkins().then(d => { if (d && Object.keys(d).length && PROFILE) { renderShop(); renderInventory(); } });
  }
  renderAccInventory();
  if (currentTab === "weekly" && weeklyData) renderWeekly();
}
function renderAccInventory() {
  const own = PROFILE.acc || {}, eq = PROFILE.accEq || {}, ids = Object.keys(ACCESSORIES).filter(id => own[id]);
  el("invAccWrap").hidden = !ids.length;
  if (!ids.length) return;
  el("invAcc").innerHTML = `<div class="accGrid">${ids.map(id => {
    const A = ACCESSORIES[id], on = eq[A.slot] === id;
    return `<div class="accCard ${on ? "on" : ""}"><canvas class="accPrev" data-acc="${id}" width="84" height="84"></canvas>
      <div><b>${A.name}</b></div>${rarityTag(A.rarity)}<div class="muted small">${A.desc}</div>
      ${id === "cap" ? `<div class="capColors">${CAP_COLORS.map(col => `<button type="button" class="capDot ${PROFILE.capColor === col ? "on" : ""}" data-cap="${col}" style="background:${col}" aria-label="cap colour"></button>`).join("")}</div>` : ""}
      <button type="button" data-acc-eq="${id}" class="${on ? "secondary" : ""}">${on ? "Take off" : "Wear"}</button></div>`;
  }).join("")}</div>`;
  document.querySelectorAll("#invAcc .accPrev").forEach(cv => drawAccPreview(cv, cv.dataset.acc));
  document.querySelectorAll("[data-acc-eq]").forEach(b => b.onclick = () => {
    const id = b.dataset.accEq, A = ACCESSORIES[id], on = (PROFILE.accEq || {})[A.slot] === id;
    api("accEquip", { slot: A.slot, id: on ? null : id }).then(setProfile).catch(e => toast(e.message, true));
  });
  document.querySelectorAll("[data-cap]").forEach(b => b.onclick = () => api("accEquip", { capColor: b.dataset.cap }).then(setProfile).catch(e => toast(e.message, true)));
}

// ---------------------------------------------------------------- Weekly Shop
let weeklyData = null;
async function refreshWeekly() { try { weeklyData = await api("weeklyShop"); renderWeekly(); } catch (e) { toast(e.message, true); } }
function renderWeekly() {
  const d = weeklyData; if (!d) return;
  const pts = PROFILE.points || 0;
  el("weeklyItems").innerHTML = (!d.unlocked ? `<div class="warn" style="grid-column:1/-1">Beat World 3 in Story mode to buy from the Weekly Shop.</div>` : "") + d.items.map((it, i) => {
    const A = ACCESSORIES[it.id];
    return `<div class="pack weeklyItem r-${A.rarity}"><canvas class="accPrev" data-acc="${it.id}" width="120" height="120"></canvas>
      <div><b>${A.name}</b> ${rarityTag(A.rarity)}</div><div class="muted small">${A.desc}</div>
      <button type="button" data-wbuy="${i}" data-wid="${it.id}" ${it.owned || !d.unlocked || pts < it.price ? "disabled" : ""}>${it.owned ? "Owned" : `Buy · ${it.price}`}</button></div>`;
  }).join("");
  document.querySelectorAll("#weeklyItems .accPrev").forEach(cv => drawAccPreview(cv, cv.dataset.acc));
  document.querySelectorAll("[data-wbuy]").forEach(b => b.onclick = async () => {
    if (busy) return; busy = true;
    try { weeklyData = await api("weeklyBuy", { slot: +b.dataset.wbuy, id: b.dataset.wid }); toast(`${ACCESSORIES[b.dataset.wid].name} is yours. Wear it from your Inventory.`); setProfile(weeklyData.me); renderWeekly(); }
    catch (e) { toast(e.message, true); refreshWeekly(); } finally { busy = false; }
  });
  el("weeklyTarget").textContent = d.poolTarget.toLocaleString();
  el("weeklyPoolFill").style.width = Math.min(100, (100 * d.pool) / d.poolTarget) + "%";
  el("weeklyPoolText").textContent = `${d.pool.toLocaleString()} / ${d.poolTarget.toLocaleString()} points`;
  el("weeklyChipBtn").disabled = !d.unlocked;
  weeklyClock();
}
function weeklyClock() {
  if (!weeklyData) return;
  const left = weeklyData.nextRefresh - (Date.now() + clockSkew);
  el("weeklyReset").textContent = left > 0 ? `Next refresh in ${timeLeft(left)}.` : "Refreshing…";
  if (left < -3000 && currentTab === "weekly" && !weeklyClock.pending) { weeklyClock.pending = true; refreshWeekly().finally(() => (weeklyClock.pending = false)); }
}
setInterval(() => { if (U3) weeklyClock(); }, 30000);
el("weeklyChipBtn").onclick = async () => {
  const n = Math.floor(+el("weeklyChipN").value || 0);
  if (busy) return; busy = true;
  try {
    const r = await api("weeklyChip", { amount: n });
    weeklyData = r; setProfile(r.me); renderWeekly();
    toast(r.refreshed ? "That filled the pool. The shop has refreshed for everyone!" : `Put in ${n} points.`);
  } catch (e) { toast(e.message, true); } finally { busy = false; }
};

// ---------------------------------------------------------------- Story World 3 (in the Story list)
function storyW3Html(row) {
  const done = PROFILE.storyDone || [];
  const w3 = STORY_LEVELS.map((L, i) => [L, i]).filter(([L]) => L.world === 3);
  let h = `<h3 class="worldHead">World 3: The Founder</h3>`;
  h += done.includes(STORY_W2) ? w3.map(([L, i]) => row(L, i)).join("") : `<div class="muted small">Beat the World 2 boss (level 20) to open World 3.</div>`;
  if (PROFILE.story3Unlocked) h += `<div class="muted small" style="margin-top:8px">You beat the Founder. The Weekly Shop and the Creator Pack are unlocked.</div>`;
  h += `<div class="card rogueCard"><div><h3 style="margin:0">Boss Rush</h3><div class="muted small">Endless bosses, each one harder, one life. 5 points a boss, 50 every 10th, 1,000 every 100th.${PROFILE.story3Unlocked ? ` Your best: ${PROFILE.rogueBest ? "level " + PROFILE.rogueBest : "none yet"}.` : " Beat World 3 to unlock it."}</div></div>
    <button type="button" id="rogueBtn" ${PROFILE.story3Unlocked ? "" : "disabled"}>${PROFILE.story3Unlocked ? "Play" : "Locked"}</button></div>`;
  setTimeout(() => { const b = el("rogueBtn"); if (b) b.onclick = () => enterRoom(async () => rogueRoomKey()); }, 0);
  return h;
}

// ---------------------------------------------------------------- Creator Pack (in the Shop)
function creatorPackHtml(pts) {
  if (!PROFILE.story3Unlocked || !CREATOR || !CREATOR_SKINS.every(id => CREATOR[id])) return "";
  return `<div class="pack storyPack"><div class="packHead"><b>${CREATOR_PACK.name}</b> <span class="tag">World 3 reward</span></div>
    <div class="skinRow">${CREATOR_PACK.items.map(([sid, pct, r]) => `<div class="skinCell"><canvas class="skinprev" data-skin="${sid}" width="46" height="46"></canvas>
      <div class="small">${esc(SKINS[sid] ? SKINS[sid].name : sid)}</div>${rarityTag(r)} <span class="muted small">${pct}%</span></div>`).join("")}</div>
    <button data-buy-creator="1" ${pts < CREATOR_PACK.cost ? "disabled" : ""}>Buy · ${CREATOR_PACK.cost}</button></div>`;
}

// ---------------------------------------------------------------- the plainer look: no emoji stuck in front of text
// Emoji that sit next to words are dropped from the menus (item icons that stand on their own stay).
const EMOJI_RX = /(?![©®™])(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*️? ?/gu;
const HAS_EMOJI = /(?![©®™])(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;
function plain(text) {
  if (!text || !HAS_EMOJI.test(text)) return text;
  const stripped = text.replace(EMOJI_RX, "");
  return /[A-Za-z0-9]/.test(stripped) ? stripped : text;        // only emoji? then it's an icon on its own: keep it
}
function plainNode(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(".keepEmoji, script, style, canvas") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  list.forEach(n => { const v = plain(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
}
function startPlainText() {
  if (startPlainText.on) return; startPlainText.on = true;
  plainNode(document.body);
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === "characterData") { const v = plain(m.target.nodeValue); if (v !== m.target.nodeValue) m.target.nodeValue = v; }
    m.addedNodes.forEach(n => { if (n.nodeType === 3) { const v = plain(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } else if (n.nodeType === 1) plainNode(n); });
  })).observe(document.body, { childList: true, subtree: true, characterData: true });
  // the same for words drawn on the game screen
  const ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxW) {
    if (this.font.indexOf("Nunito") >= 0) this.font = this.font.replace("Nunito", "Barlow");
    const v = plain(String(text)); return maxW === undefined ? ft.call(this, v, x, y) : ft.call(this, v, x, y, maxW);
  };
}
// opening the Shop checks for new Creator Pack pictures straight away
document.querySelector('[data-tab="shop"]').addEventListener("click", () => { if (U3 && PROFILE && PROFILE.update3) { renderU3.triedAt = 0; renderU3(); } });

// the server says whether the update is on (needed before login, for the look and the username check).
// The last answer is remembered so the page doesn't flash the old look while it asks.
let u3Saved = false;
try { u3Saved = localStorage.getItem("cc_u3") === "1"; } catch (e) {}
if (u3Saved) setU3(true);
fetch(SERVER + "/flags").then(r => r.json()).then(d => { if (d && d.u3) setU3(true); else try { localStorage.removeItem("cc_u3"); } catch (e) {} }).catch(() => {});
