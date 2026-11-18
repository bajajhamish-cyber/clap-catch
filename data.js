// ======================================================================
//  data.js: rules, packs, skins (shared by the menu and the game)
// ======================================================================
const RULES = {
  doubleClap:      { name: "Clap x2",          type: "passive", icon: "👏👏", desc: "You must clap twice before catching (and twice for a nuke)." },
  noJuke:          { name: "No Juke",          type: "passive", icon: "🚫🎭", desc: "Space throws instantly. No charging, no faking." },
  hotPotato:       { name: "Hot Potato",       type: "passive", icon: "🥔", desc: "Hold the ball longer than 3s and you're OUT." },
  spinning:        { name: "Spinning",         type: "passive", icon: "🌀", desc: "Your aim cycles to the next player every 5s by itself. You can't control it." },
  soulsteal:       { name: "Soulsteal",        type: "passive", icon: "👻", desc: "The first player you get out each round by making them mess up a catch (no clap, drop or fireball): you steal their unused abilities (not Redo)." },
  fireball:        { name: "Fireball",         type: "ability", icon: "🔥", desc: "Right after you throw (before 35% of the way): they don't need to clap, but if they press catch they're OUT. If it lands, it's theirs: wait for their bar to show before they can throw." },
  swap:            { name: "Swap",             type: "ability", icon: "🔄", desc: "While you hold the ball: swap places with whoever threw it to you. Not while the ball's flying, or once your bar is at 50%." },
  doubleForce:     { name: "Double Force",     type: "ability", icon: "⛓️", desc: "The holder must throw to you now AND the next time they get the ball. If you're out by then, they're out. If two people are forcing you to throw to them, you have 3 seconds to Ward or for someone to use Full Counter, or you're out. The forcer can press G G G to sacrifice themselves so the holder can't pass to them." },
  antiForce:       { name: "Anti Force",       type: "ability", icon: "🛡️", desc: "The holder can't throw to you this turn. Not in 1v1, not if they're double-forced." },
  counterForce:    { name: "Counter Force",    type: "ability", icon: "🎯", desc: "Click a player: the holder must throw to them this turn (can't be you). Not allowed if a force is already on them." },
  absoluteCounter: { name: "Full Counter", type: "ability", icon: "⛔", desc: "This turn, all active abilities and any used after it don't work. Also clears double forces on whoever has the ball, and cancels a nuke." },
  ward:            { name: "Ward",             type: "ability", icon: "🔰", desc: "While you hold the ball: remove every force, counter force and anti force on you." },
  nuke:            { name: "Nuke",             type: "ability", icon: "☢️", desc: "Throw it to the middle at half speed. EVERYONE (you too) must clap before it lands or they're out. If nobody claps, the round resets and everyone comes back." },
  brace:           { name: "Brace",            type: "ability", icon: "🧱", desc: "For 3 seconds, clapping on a fake doesn't get you out." },
  speedUp:         { name: "Speed Up",         type: "ability", icon: "⏩", desc: "Use when someone else has the ball: their next throw flies 40% faster, so it's harder to clap and catch." },
  decoy:           { name: "Decoy",            type: "ability", icon: "🪞", desc: "While you hold the ball: everyone else sees your aim line pointing at the wrong person until you throw." },
  redo:            { name: "Redo",             type: "ability", icon: "💖", desc: "Once per round, come back in after you get out. Can't be stolen." },
};

const RARITY = {
  common:    { label: "Common",    color: "#9aa4b2" },
  rare:      { label: "Rare",      color: "#4fc3f7" },
  legendary: { label: "Legendary", color: "#ffb300" },
};

// ---------------------------------------------------------------- ability packs (50 points)
// [ability, chance %, rarity]
const ABILITY_PACKS = {
  guardian:  { name: "Guardian Pack",  icon: "🛡️", theme: "Defence: block and cancel",
               items: [["antiForce", 45, "common"], ["brace", 40, "common"], ["ward", 14, "rare"], ["absoluteCounter", 1, "legendary"]] },
  control:   { name: "Control Pack",   icon: "⛓️", theme: "Control: tell people where to throw",
               items: [["counterForce", 45, "common"], ["speedUp", 40, "common"], ["doubleForce", 14, "rare"], ["nuke", 1, "legendary"]] },
  trickster: { name: "Trickster Pack", icon: "🃏", theme: "Tricks: swap, come back, burn",
               items: [["swap", 45, "common"], ["decoy", 40, "common"], ["redo", 14, "rare"], ["fireball", 1, "legendary"]] },
};
function abilityRarity(id) {
  for (const p of Object.values(ABILITY_PACKS)) for (const [a, , r] of p.items) if (a === id) return r;
  return "common";
}

// ---------------------------------------------------------------- skin packs (100 points)
const SKIN_ODDS = [["common", 65], ["rare", 28], ["legendary", 7]];
const SKIN_PACKS = {
  classic: { name: "Classic Pack", icon: "🎨", skins: ["mint", "sunset", "gold"] },
  neon:    { name: "Neon Pack",    icon: "💡", skins: ["neonPink", "neonCyan", "rainbow"] },
  nature:  { name: "Nature Pack",  icon: "🌿", skins: ["leaf", "ocean", "lava"] },
  space:   { name: "Space Pack",   icon: "🌌", skins: ["moon", "galaxy", "blackHole"] },
  candy:   { name: "Candy Pack",   icon: "🍬", skins: ["candyStripe", "cookie", "sprinkles"] },
  tech:    { name: "Tech Pack",    icon: "💾", skins: ["circuit", "checker", "glitch"] },
};

// small drawing helpers
function _clip(c, x, y, s, fn) { c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip(); fn(); c.restore(); }
function _fill(c, x, y, s, col) { c.fillStyle = col; c.fillRect(x, y, s, s); }
function _grad(c, x, y, s, cols) {
  const g = c.createLinearGradient(x, y, x + s, y + s);
  cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
  return g;
}
function _dot(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
// fixed "random" spots so patterns don't flicker
const _SPOTS = [[.18,.22],[.72,.15],[.45,.48],[.82,.62],[.25,.75],[.6,.85],[.9,.35],[.1,.5],[.38,.12],[.55,.3],[.3,.92],[.78,.9]];

const SKINS = {
  default:     { name: "Default", rarity: "common", draw: (c, x, y, s, base) => _fill(c, x, y, s, base || "#4fc3f7") },

  // Classic
  mint:        { name: "Mint", rarity: "common", draw: (c, x, y, s) => _fill(c, x, y, s, "#7ee7c1") },
  sunset:      { name: "Sunset", rarity: "rare", draw: (c, x, y, s) => { c.fillStyle = _grad(c, x, y, s, ["#ff7e5f", "#feb47b", "#ff5e99"]); c.fillRect(x, y, s, s); } },
  gold:        { name: "Solid Gold", rarity: "legendary", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
                   c.fillStyle = _grad(c, x, y, s, ["#b8860b", "#ffd700", "#fff3b0", "#ffd700", "#b8860b"]); c.fillRect(x, y, s, s);
                   const p = ((t / 1400) % 1) * s * 2.4 - s * 0.4;
                   c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath();
                   c.moveTo(x + p, y); c.lineTo(x + p + s * 0.18, y); c.lineTo(x + p + s * 0.18 - s, y + s); c.lineTo(x + p - s, y + s); c.fill(); }) },
  // Neon
  neonPink:    { name: "Neon Pink", rarity: "common", draw: (c, x, y, s) => { _fill(c, x, y, s, "#1a0b16");
                   c.save(); c.shadowColor = "#ff4fd8"; c.shadowBlur = 12; c.strokeStyle = "#ff4fd8"; c.lineWidth = 3; c.strokeRect(x + 5, y + 5, s - 10, s - 10); c.restore(); } },
  neonCyan:    { name: "Neon Grid", rarity: "rare", draw: (c, x, y, s) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#061a20");
                   c.save(); c.shadowColor = "#21e6ff"; c.shadowBlur = 8; c.strokeStyle = "#21e6ff"; c.lineWidth = 1.5;
                   for (let i = 1; i < 4; i++) { const k = x + s * i / 4, m = y + s * i / 4; c.beginPath(); c.moveTo(k, y); c.lineTo(k, y + s); c.moveTo(x, m); c.lineTo(x + s, m); c.stroke(); }
                   c.lineWidth = 3; c.strokeRect(x + 2, y + 2, s - 4, s - 4); c.restore(); }) },
  rainbow:     { name: "Rainbow Shift", rarity: "legendary", draw: (c, x, y, s, b, t) => { const h = (t / 8) % 360;
                   c.fillStyle = _grad(c, x, y, s, [`hsl(${h},90%,60%)`, `hsl(${h + 120},90%,60%)`, `hsl(${h + 240},90%,60%)`]); c.fillRect(x, y, s, s); } },
  // Nature
  leaf:        { name: "Leaf", rarity: "common", draw: (c, x, y, s) => { _fill(c, x, y, s, "#4caf50");
                   c.strokeStyle = "#2e7d32"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + s * .15, y + s * .85); c.lineTo(x + s * .85, y + s * .15);
                   for (let i = 1; i < 4; i++) { const k = i / 4; c.moveTo(x + s * (.15 + .7 * k), y + s * (.85 - .7 * k)); c.lineTo(x + s * (.15 + .7 * k) + s * .14, y + s * (.85 - .7 * k) + s * .14); } c.stroke(); } },
  ocean:       { name: "Ocean", rarity: "rare", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#1565c0");
                   c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2;
                   for (let r = 0; r < 3; r++) { c.beginPath(); for (let i = 0; i <= s; i += 2) { const yy = y + s * (.25 + r * .25) + Math.sin(i / 6 + t / 300 + r) * 3; i ? c.lineTo(x + i, yy) : c.moveTo(x + i, yy); } c.stroke(); } }) },
  lava:        { name: "Lava", rarity: "legendary", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#3b0a00");
                   _SPOTS.slice(0, 7).forEach(([px, py], i) => { const r = s * (.12 + .06 * Math.sin(t / 400 + i));
                     _dot(c, x + s * px, y + s * ((py + t / 6000 * (1 + i % 3)) % 1), r, i % 2 ? "#ff6d00" : "#ffd600"); }); }) },
  // Space
  moon:        { name: "Moon", rarity: "common", draw: (c, x, y, s) => { _fill(c, x, y, s, "#b0b4bb");
                   [[.3,.3,.12],[.7,.4,.08],[.45,.72,.1],[.78,.78,.06]].forEach(([px, py, r]) => _dot(c, x + s * px, y + s * py, s * r, "#8e939b")); } },
  galaxy:      { name: "Galaxy", rarity: "rare", draw: (c, x, y, s, b, t) => { c.fillStyle = _grad(c, x, y, s, ["#2b1055", "#5b3fa8", "#7597de"]); c.fillRect(x, y, s, s);
                   _SPOTS.forEach(([px, py], i) => _dot(c, x + s * px, y + s * py, 1 + ((i + Math.floor(t / 300)) % 4 === 0 ? 1 : 0), "#fff")); } },
  blackHole:   { name: "Black Hole", rarity: "legendary", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#000");
                   const cx = x + s / 2, cy = y + s / 2;
                   for (let i = 0; i < 3; i++) { c.strokeStyle = ["#ff9100", "#d500f9", "#ffea00"][i]; c.lineWidth = 3;
                     c.beginPath(); c.arc(cx, cy, s * (.18 + i * .1), t / (250 + i * 120) + i, t / (250 + i * 120) + i + Math.PI * 1.2); c.stroke(); }
                   _dot(c, cx, cy, s * .12, "#000"); }) },
  // Candy
  candyStripe: { name: "Candy Stripe", rarity: "common", draw: (c, x, y, s) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#fff");
                   c.strokeStyle = "#ff4d6d"; c.lineWidth = s / 8; for (let i = -s; i < s * 2; i += s / 3.5) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i - s, y + s); c.stroke(); } }) },
  cookie:      { name: "Cookie", rarity: "rare", draw: (c, x, y, s) => { _fill(c, x, y, s, "#c68b59");
                   _SPOTS.slice(0, 8).forEach(([px, py]) => _dot(c, x + s * px, y + s * py, s * .06, "#4e2a0e")); } },
  sprinkles:   { name: "Sprinkle Donut", rarity: "legendary", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#f8a5c2");
                   const cols = ["#fff176", "#4fc3f7", "#81c784", "#ffffff", "#ba68c8", "#ff8a65"];
                   _SPOTS.forEach(([px, py], i) => { c.save(); c.translate(x + s * px, y + s * py); c.rotate(i * 1.3); c.fillStyle = cols[i % cols.length]; c.fillRect(-s * .07, -s * .02, s * .14, s * .04); c.restore(); });
                   const k = Math.floor(t / 200) % _SPOTS.length; _dot(c, x + s * _SPOTS[k][0], y + s * _SPOTS[k][1], 2.5, "#fff"); }) },
  // Tech
  circuit:     { name: "Circuit", rarity: "common", draw: (c, x, y, s) => { _fill(c, x, y, s, "#0b3d20");
                   c.strokeStyle = "#2ecc71"; c.lineWidth = 2; c.beginPath();
                   c.moveTo(x + s * .15, y + s * .3); c.lineTo(x + s * .5, y + s * .3); c.lineTo(x + s * .5, y + s * .7); c.lineTo(x + s * .85, y + s * .7);
                   c.moveTo(x + s * .3, y + s * .85); c.lineTo(x + s * .3, y + s * .55); c.stroke();
                   [[.15,.3],[.85,.7],[.3,.85],[.5,.5]].forEach(([px, py]) => _dot(c, x + s * px, y + s * py, 3, "#a5ffcf")); } },
  checker:     { name: "Checkerboard", rarity: "rare", draw: (c, x, y, s) => { const n = 4, q = s / n;
                   for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? "#111" : "#f5f5f5"; c.fillRect(x + i * q, y + j * q, q + .5, q + .5); } } },
  glitch:      { name: "Glitch", rarity: "legendary", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#111");
                   const f = Math.floor(t / 90);
                   for (let i = 0; i < 6; i++) { const r = Math.sin(f * 12.9898 + i * 78.233) * 43758.5453; const off = ((r - Math.floor(r)) - .5) * s * .4;
                     c.fillStyle = ["#00e5ff", "#ff00e5", "#ffffff"][i % 3]; c.globalAlpha = .8; c.fillRect(x + off, y + i * s / 6, s, s / 12); }
                   c.globalAlpha = 1; }) },
};
// fill in rarity/pack from SKIN_PACKS
Object.entries(SKIN_PACKS).forEach(([pid, p]) => p.skins.forEach((sid, i) => { SKINS[sid].pack = pid; SKINS[sid].rarity = SKIN_ODDS[i][0]; }));

function drawSkin(c, id, x, y, s, base, t) {
  const sk = SKINS[id] || SKINS.default;
  try { sk.draw(c, x, y, s, base, t || 0); } catch (e) { _fill(c, x, y, s, base || "#4fc3f7"); }
}
