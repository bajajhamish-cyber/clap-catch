// ======================================================================
//  keys.js: your key bindings (saved in this browser)
// ======================================================================
const KEY_ACTIONS = [
  ["throw", "Throw (hold to charge) / catch", " "],
  ["clap", "Clap", "b"],
  ["left", "Aim left", "a"],
  ["right", "Aim right", "d"],
  ["ab1", "Ability 1", "j"],
  ["ab2", "Ability 2", "k"],
  ["ab3", "Ability 3", "l"],
  ["ab4", "Stolen ability 1", "u"],
  ["ab5", "Stolen ability 2", "i"],
  ["ab6", "Stolen ability 3", "o"],
  ["sac", "Take yourself out (press 3 times)", "g"],
  ["up", "Move up (Story)", "w"],
  ["down", "Move down (Story)", "s"],
  ["dodge", "Make it a dodgeball (Story)", "t"],
];
const KEY_DEFAULTS = Object.fromEntries(KEY_ACTIONS.map(a => [a[0], a[2]]));
let KEYS = Object.assign({}, KEY_DEFAULTS);
try { const saved = JSON.parse(localStorage.getItem("cc_keys") || "{}"); Object.keys(KEY_DEFAULTS).forEach(k => { if (typeof saved[k] === "string" && saved[k]) KEYS[k] = saved[k]; }); } catch (e) {}
function saveKeys() { try { localStorage.setItem("cc_keys", JSON.stringify(KEYS)); } catch (e) {} }
function keyName(k) {
  const names = { " ": "Space", arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", enter: "Enter", shift: "Shift", control: "Ctrl", alt: "Alt", backspace: "Backspace", tab: "Tab", capslock: "Caps" };
  return names[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
}
const abilityKey = i => KEYS["ab" + (i + 1)];
function actionFor(k) { return Object.keys(KEYS).find(a => KEYS[a] === k) || null; }

// ---------------------------------------------------------------- the settings window
let keyWaiting = null;
function renderKeys() {
  const box = document.getElementById("keyList"); if (!box) return;
  box.innerHTML = KEY_ACTIONS.map(([id, label]) => `<div class="keyRow"><span>${label}</span>
    <button type="button" class="keyBtn ${keyWaiting === id ? "waiting" : ""}" data-key-act="${id}">${keyWaiting === id ? "Press a key…" : keyName(KEYS[id])}</button></div>`).join("");
  box.querySelectorAll("[data-key-act]").forEach(b => b.onclick = () => { keyWaiting = b.dataset.keyAct; renderKeys(); });
  renderControls();
}
function openKeys() { keyWaiting = null; renderKeys(); document.getElementById("keyModal").style.display = "flex"; }
function closeKeys() { keyWaiting = null; document.getElementById("keyModal").style.display = "none"; }
document.addEventListener("keydown", e => {
  if (!keyWaiting) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k = e.key.toLowerCase();
  if (k === "escape") { keyWaiting = null; renderKeys(); return; }
  if (k === "p") { if (typeof toast === "function") toast("P is used for other things, pick another key", true); return; }
  const other = actionFor(k);
  if (other && other !== keyWaiting) KEYS[other] = KEYS[keyWaiting];     // that key was taken: the two swap
  KEYS[keyWaiting] = k; keyWaiting = null; saveKeys(); renderKeys();
}, true);
// the help text under the game
function renderControls() {
  const c = document.getElementById("controls"); if (!c) return;
  const K = a => `<kbd>${keyName(KEYS[a])}</kbd>`;
  c.innerHTML = `<b>Holding the ball:</b> aim with <kbd>mouse</kbd> or ${K("left")}/${K("right")} · hold ${K("throw")} to charge, let go early to fake<br>
    <b>Everyone else:</b> ${K("clap")} clap · ${K("throw")} catch · <b>Abilities:</b> ${K("ab1")} ${K("ab2")} ${K("ab3")} (stolen extras: ${K("ab4")} ${K("ab5")} ${K("ab6")}) · <kbd>Esc</kbd> cancel picking<br>
    ${K("sac")}${K("sac")}${K("sac")} = take yourself out, any time (if you've double-forced the holder, they can't pass to you, so they're out too) · <a href="#" onclick="openKeys();return false">⌨️ change keys</a>`;
}
window.addEventListener("DOMContentLoaded", renderControls);
