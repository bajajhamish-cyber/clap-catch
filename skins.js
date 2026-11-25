// ======================================================================
//  skins.js: how each cube skin is drawn (website only)
// ======================================================================
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

  // Legendary Skin Pack
  brown:       { name: "Brown", draw: (c, x, y, s) => _fill(c, x, y, s, "#7a4a24") },
  mage:        { name: "Illusioner Mage", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
                   c.fillStyle = _grad(c, x, y, s, ["#2a0b4a", "#5b1f8f", "#2a0b4a"]); c.fillRect(x, y, s, s);
                   c.fillStyle = "#3a1166"; c.beginPath(); c.moveTo(x + s * .5, y - s * .05); c.lineTo(x + s * .82, y + s * .42); c.lineTo(x + s * .18, y + s * .42); c.fill();   // hat
                   c.fillStyle = "#ffd54f"; c.fillRect(x + s * .18, y + s * .38, s * .64, s * .06);
                   for (let i = 0; i < 6; i++) { const a = t / 600 + i, r = s * .32;
                     c.globalAlpha = .5 + .5 * Math.sin(t / 200 + i); _dot(c, x + s * .5 + Math.cos(a) * r, y + s * .68 + Math.sin(a) * r * .4, 2, "#e1bee7"); }
                   c.globalAlpha = 1; }) },
  barbarian:   { name: "Barbarian", draw: (c, x, y, s) => _clip(c, x, y, s, () => {
                   _fill(c, x, y, s, "#8d6e63");
                   c.fillStyle = "#5d4037"; for (let i = 0; i < 7; i++) c.fillRect(x + i * s / 7, y + s * .62 + (i % 2) * 3, s / 7 - 1, s * .4);   // fur
                   c.fillStyle = "#9e9e9e"; c.fillRect(x, y, s, s * .3);                                                                     // helmet
                   c.fillStyle = "#eeeeee"; c.beginPath(); c.moveTo(x + s * .02, y + s * .28); c.lineTo(x - s * .02, y - s * .02); c.lineTo(x + s * .2, y + s * .2); c.fill();
                   c.beginPath(); c.moveTo(x + s * .98, y + s * .28); c.lineTo(x + s * 1.02, y - s * .02); c.lineTo(x + s * .8, y + s * .2); c.fill();
                   c.fillStyle = "#3e2723"; c.fillRect(x + s * .28, y + s * .42, s * .1, s * .06); c.fillRect(x + s * .62, y + s * .42, s * .1, s * .06); }) },
  angel:       { name: "Angel", draw: (c, x, y, s, b, t) => {
                   c.save(); c.fillStyle = "rgba(255,255,255,.85)";                               // wings (drawn outside the cube)
                   const f = Math.sin(t / 250) * s * .06;
                   [[-1, x], [1, x + s]].forEach(([d, ex]) => { c.beginPath(); c.moveTo(ex, y + s * .35); c.quadraticCurveTo(ex + d * s * .45, y + s * .05 - f, ex + d * s * .38, y + s * .55); c.quadraticCurveTo(ex + d * s * .2, y + s * .6, ex, y + s * .6); c.fill(); });
                   c.restore();
                   c.fillStyle = _grad(c, x, y, s, ["#ffffff", "#fff8e1", "#ffe082"]); c.fillRect(x, y, s, s);
                   c.strokeStyle = "#ffd54f"; c.lineWidth = 3; c.beginPath(); c.ellipse(x + s / 2, y - s * .12, s * .3, s * .08, 0, 0, Math.PI * 2); c.stroke(); } },
  devil:       { name: "Devil", draw: (c, x, y, s, b, t) => {
                   c.fillStyle = "#b71c1c";                                                       // horns (outside the cube)
                   c.beginPath(); c.moveTo(x + s * .12, y); c.lineTo(x + s * .02, y - s * .28); c.lineTo(x + s * .32, y); c.fill();
                   c.beginPath(); c.moveTo(x + s * .88, y); c.lineTo(x + s * .98, y - s * .28); c.lineTo(x + s * .68, y); c.fill();
                   c.fillStyle = _grad(c, x, y, s, ["#7f0000", "#d32f2f", "#7f0000"]); c.fillRect(x, y, s, s);
                   const g = .6 + .4 * Math.sin(t / 180);
                   _dot(c, x + s * .32, y + s * .42, s * .07, `rgba(255,235,59,${g})`); _dot(c, x + s * .68, y + s * .42, s * .07, `rgba(255,235,59,${g})`);
                   c.strokeStyle = "#ffeb3b"; c.lineWidth = 2; c.beginPath(); c.arc(x + s * .5, y + s * .6, s * .18, 0.2, Math.PI - 0.2); c.stroke(); } },

  // Story boss rewards
  rain:      { name: "Rain", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               _fill(c, x, y, s, "#455a64"); c.strokeStyle = "#90caf9"; c.lineWidth = 2;
               for (let i = 0; i < 7; i++) { const yy = y + ((t / 6 + i * 37) % (s + 12)) - 12, xx = x + (i * 13) % s; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - 3, yy + 9); c.stroke(); } }) },
  lightning: { name: "Lightning", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               _fill(c, x, y, s, "#1a237e"); const on = Math.floor(t / 120) % 9 < 2;
               c.strokeStyle = on ? "#ffffff" : "#ffeb3b"; c.lineWidth = on ? 4 : 3; c.beginPath();
               c.moveTo(x + s * .6, y); c.lineTo(x + s * .35, y + s * .5); c.lineTo(x + s * .6, y + s * .5); c.lineTo(x + s * .4, y + s); c.stroke(); }) },
  tornado:   { name: "Tornado", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               _fill(c, x, y, s, "#78909c"); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 2;
               for (let i = 0; i < 6; i++) { const yy = y + s * (0.1 + i * 0.15), w = s * (0.45 - i * 0.06), off = Math.sin(t / 150 + i) * s * .08;
                 c.beginPath(); c.ellipse(x + s / 2 + off, yy, w, s * .05, 0, 0, Math.PI * 2); c.stroke(); } }) },
  velvet:    { name: "Velvet", draw: (c, x, y, s) => { c.fillStyle = _grad(c, x, y, s, ["#4a148c", "#7b1fa2", "#4a148c"]); c.fillRect(x, y, s, s);
               c.strokeStyle = "#ffd54f"; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, s - 8, s - 8); } },
  crown:     { name: "Crown", draw: (c, x, y, s, b, t) => {
               c.fillStyle = _grad(c, x, y, s, ["#b71c1c", "#e53935", "#b71c1c"]); c.fillRect(x, y, s, s);
               c.fillStyle = "#ffd54f"; c.beginPath(); c.moveTo(x + s * .12, y + s * .1); c.lineTo(x + s * .3, y - s * .22); c.lineTo(x + s * .5, y + s * .02); c.lineTo(x + s * .7, y - s * .22); c.lineTo(x + s * .88, y + s * .1); c.closePath(); c.fill();
               _dot(c, x + s * .5, y - s * .02, 3, `hsl(${t / 8 % 360},90%,70%)`); } },
  dragon:    { name: "Dragon Scales", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               _fill(c, x, y, s, "#1b5e20");
               for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const cx = x + k * s / 3.5 + (r % 2) * s / 7, cy = y + r * s / 4.5;
                 c.fillStyle = `hsl(${120 + Math.sin(t / 300 + r + k) * 20},60%,${30 + r * 4}%)`; c.beginPath(); c.arc(cx, cy, s / 7, 0, Math.PI); c.fill(); }
               const g = .5 + .5 * Math.sin(t / 200); _dot(c, x + s * .3, y + s * .45, s * .06, `rgba(255,${120 + g * 100},0,1)`); _dot(c, x + s * .7, y + s * .45, s * .06, `rgba(255,${120 + g * 100},0,1)`); }) },
  pebble:    { name: "Pebble", draw: (c, x, y, s) => _clip(c, x, y, s, () => { _fill(c, x, y, s, "#9e9e9e");
               [[.25, .3, .12], [.65, .25, .09], [.45, .7, .15], [.8, .7, .08]].forEach(([a, b2, r]) => _dot(c, x + s * a, y + s * b2, s * r, "#757575")); }) },
  crystal:   { name: "Crystal", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               c.fillStyle = _grad(c, x, y, s, ["#80deea", "#e1f5fe", "#4dd0e1"]); c.fillRect(x, y, s, s);
               c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + s * .6); c.lineTo(x + s * .4, y); c.lineTo(x + s, y + s * .5); c.lineTo(x + s * .5, y + s); c.closePath(); c.stroke();
               const sx = x + ((t / 8) % (s * 2)) - s / 2; c.fillStyle = "rgba(255,255,255,.4)"; c.fillRect(sx, y, 6, s); }) },
  titanCore: { name: "Titan Core", draw: (c, x, y, s, b, t) => _clip(c, x, y, s, () => {
               _fill(c, x, y, s, "#37474f");
               c.strokeStyle = "#ff9100"; c.lineWidth = 2; [[.2, 0, .35, .4], [.8, 0, .6, .45], [0, .8, .4, .6], [1, .9, .62, .58]].forEach(([a1, b1, a2, b2]) => { c.beginPath(); c.moveTo(x + s * a1, y + s * b1); c.lineTo(x + s * a2, y + s * b2); c.stroke(); });
               const g = .6 + .4 * Math.sin(t / 160); const gr = c.createRadialGradient(x + s / 2, y + s / 2, 1, x + s / 2, y + s / 2, s * .3);
               gr.addColorStop(0, `rgba(255,${200 * g},60,1)`); gr.addColorStop(1, "rgba(255,80,0,0)"); c.fillStyle = gr; c.fillRect(x, y, s, s); }) },
};
Object.entries(EXTRA_SKINS).forEach(([sid, r]) => { SKINS[sid].rarity = r; SKINS[sid].pack = "legendary"; });
// fill in rarity/pack from SKIN_PACKS
Object.entries(SKIN_PACKS).forEach(([pid, p]) => p.skins.forEach((sid, i) => { SKINS[sid].pack = pid; SKINS[sid].rarity = SKIN_ODDS[i][0]; }));

function drawSkin(c, id, x, y, s, base, t) {
  const sk = SKINS[id] || SKINS.default;
  try { sk.draw(c, x, y, s, base, t || 0); } catch (e) { _fill(c, x, y, s, base || "#4fc3f7"); }
}

// ---- Creator Pack skins: pictures uploaded by the admin (only after the update is switched on)
let CREATOR = null, CREATOR_IMG = {}, creatorLoading = null;
function loadCreatorSkins() {
  if (CREATOR) return Promise.resolve(CREATOR);
  if (!creatorLoading) creatorLoading = api("creatorSkins").then(d => {
    CREATOR = d || {};
    Object.entries(CREATOR).forEach(([id, sk]) => {
      const im = new Image(); im.src = sk.img; CREATOR_IMG[id] = im;
      SKINS[id] = { name: sk.name, rarity: skinRarity(id), pack: "creator",
        draw: (c, x, y, s, base) => { const i = CREATOR_IMG[id]; if (i && i.complete && i.naturalWidth) c.drawImage(i, x, y, s, s); else _fill(c, x, y, s, base || "#4fc3f7"); } };
    });
    return CREATOR;
  }).catch(() => { CREATOR = null; return null; }).finally(() => { creatorLoading = null; });
  return creatorLoading;
}

// ---- OG skins: one picture each for a few original players (uploaded by the admin)
let OG_SKINS = null, OG_IMG = {}, ogLoading = null;
function loadOgSkins() {
  if (OG_SKINS) return Promise.resolve(OG_SKINS);
  if (!ogLoading) ogLoading = api("ogSkins").then(d => {
    OG_SKINS = d || {};
    Object.entries(OG_SKINS).forEach(([u, sk]) => {
      const id = "og_" + u, im = new Image(); im.src = sk.img; OG_IMG[id] = im;
      SKINS[id] = { name: sk.name || `${u}'s OG skin`, rarity: "og", pack: "og",
        draw: (c, x, y, s, base, t) => {
          const i = OG_IMG[id];
          if (i && i.complete && i.naturalWidth) c.drawImage(i, x, y, s, s); else _fill(c, x, y, s, base || "#4fc3f7");
          const k = ((t || 0) / 1400) % 1;      // a gold shine sweeps across
          c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip();
          const g = c.createLinearGradient(x + s * (k * 3 - 1.5), y, x + s * (k * 3 - 0.9), y + s);
          g.addColorStop(0, "rgba(255,215,64,0)"); g.addColorStop(0.5, "rgba(255,235,150,.35)"); g.addColorStop(1, "rgba(255,215,64,0)");
          c.fillStyle = g; c.fillRect(x, y, s, s); c.restore();
        } };
    });
    return OG_SKINS;
  }).catch(() => { OG_SKINS = null; return null; }).finally(() => { ogLoading = null; });
  return ogLoading;
}
