// ======================================================================
//  maker-tour.js: the Level Maker tutorial. A step-by-step tour that
//  lights up each part of the Level Maker and says what it does.
//  Shows by itself the first time you make a level, and any time from
//  the "📖 Tutorial" button at the top of the Level Maker tab.
// ======================================================================
const MT_STEPS = [
  { title: "Welcome to the Level Maker!", text: `Here you build your own Clap Catch levels, play them, share them with friends, and play everyone else's.<br><br>
    <b>Making a new level costs 150 points.</b> After that, editing it, playing it, sharing its code and publishing it are all free. You can keep 10 levels and publish 3.<br><br>
    This tour shows you every part. It takes about 2 minutes. You can skip it any time and open it again with the <b>📖 Tutorial</b> button.` },
  { sel: ".mkDraftRow", tab: "make", title: "Your level", text: `This bar is for <b>your</b> levels.<br>
    • <b>The list</b> switches between the levels you've made.<br>
    • <b>New level · 150</b> makes another one.<br>
    • <b>Save</b> is free. It checks your level and gives you its share code. "Unsaved changes" means you've changed something since you last saved.<br>
    • <b>Delete</b> removes a level (you don't get the 150 back).` },
  { sel: ".mkModes", build: true, title: "Two ways to make a level", text: `<b>Build your own</b> (what you'll see in this tour): put dots, arrows and enemies anywhere, with a timeline of phases, speech and effects.<br><br>
    <b>Quick level</b>: just sliders. Pick dodge, catch or boss, then lanes, speed, waves and special balls. Good for a fast idea.` },
  { sel: "#arCanvas", build: true, title: "The board", text: `This is your level. The <b>white circles are dots</b>: the only places the player can stand. The <b>green</b> one is where they start.<br>
    The <b>coloured squares are enemies</b>. They throw balls at the dots.<br><br>
    Pick a tool above the board, then click the board to use it.` },
  { sel: '[data-tool="dot"]', build: true, title: "● Dots", text: `Click anywhere on the board to add a dot (up to 16).<br><br>
    Handy: each new dot gets an arrow from the one before, so clicking dots in order already makes a path.<br>
    Dots can't go right on top of an enemy or its walk path.` },
  { sel: '[data-tool="arrow"]', build: true, title: "➜ Arrows: how the player moves", text: `The player moves with <b>W and S</b>:<br>
    • <b>W</b> follows the arrow <b>out of</b> their dot.<br>
    • <b>S</b> goes back along the arrow <b>into</b> it.<br><br>
    To draw one, click a dot, then the dot W should go to. Click a dot twice to remove its arrow. Each dot has one arrow out and one in. Arrows can loop round. With no arrow out, W does nothing (a dead end).` },
  { sel: '[data-tool="start"]', build: true, title: "⚑ Start", text: "Click a dot to make it the start. It turns green. That's where the player stands when the level begins." },
  { sel: '[data-tool="enemy"]', build: true, title: "■ Enemies", text: `Click empty space to add an enemy (up to 6). Enemies can stand anywhere <b>except on your dots</b>.<br><br>
    Click an enemy with this tool to pick it. Its settings open below the timeline.` },
  { sel: "#arEnemyBox", build: true, enemy: true, title: "Enemy settings", text: `For the picked enemy:<br>
    • <b>Name</b>: shown under it and when it talks.<br>
    • <b>Shoots every</b>: how often it throws (0.5 to 6 seconds).<br>
    • <b>White balls</b>: how many of its balls are white. The rest are red.<br>
    • <b>Shoots at</b>: at <b>you</b> (wherever the player is), at <b>random dots</b>, or in <b>a set pattern</b>.<br>
    • <b>Walk speed</b>: 0 means it stands still.` },
  { sel: '[data-tool="path"]', build: true, title: "⋯ Walk path", text: `Pick an enemy, then click to add stops (up to 6). It walks from its spot through the stops, then back, over and over.<br><br>
    Enemies <b>can't walk over your dots</b>. A stop that would make it cross one is refused.` },
  { sel: '[data-tool="pattern"]', build: true, title: "◎ Shoot pattern", text: `Set the enemy to "Shoots at: A set pattern", then click dots in the order it should throw at them. You'll see ◎1, ◎2… next to the dots.<br><br>
    It repeats the pattern. Patterns are great for making a fair rhythm the player can learn.` },
  { sel: '[data-tool="erase"]', build: true, title: "✕ Erase and Clear all", text: `<b>Erase</b>: click a dot, an enemy or a walk stop to remove it.<br>
    <b>Clear all</b> empties the phase you're editing (it asks first).` },
  { sel: "#tlCanvas", build: true, title: "The timeline", text: `This runs through your whole level, left to right: 120 seconds across. It has 3 rows:<br>
    <b>Phases</b>, <b>Speech</b> and <b>Effects</b>. The yellow line is the <b>END</b> of your level.<br><br>
    Click a row to add or pick something, and drag things to move them.` },
  { sel: "#tlCanvas", build: true, title: "Row 1: Phases", text: `A level can have up to <b>3 phases</b>. Each has its own dots, arrows and enemies. Click a phase to edit it on the board.<br>
    • <b>+ Phase</b> adds one as a copy of the last, so "same map, new attacks" is easy. You can also make it totally different.<br>
    • <b>Drag a phase's right edge</b> to change how long it lasts (5 seconds at least). The last edge is the end of the level, 120 seconds at most.<br>
    • Click a phase to pick its <b>transition</b>: none, fade, or slide left, right, up or down.<br><br>
    Players get a "Phase 2 in 2…" warning, and nobody throws during a transition. If their dot isn't in the new phase, they jump to its start dot.` },
  { sel: "#tlCanvas", build: true, title: "Row 2: Speech", text: `Click the Speech row to add a line at that second. Then pick <b>who says it</b> (an enemy in that phase, or no one, which shows at the top), and type it.<br><br>
    Drag a line to change when it's said. Up to 16 lines. Swear words are filtered.` },
  { sel: "#tlCanvas", build: true, title: "Row 3: Effects", text: `Click the Effects row to add a <b>flash</b> (pick its colour) or a <b>shake</b>. Set how long it lasts and how strong it is, and press <b>Preview</b> to see it.<br><br>
    Two effects can't happen at once, and flashes are limited to 3 a second. Please keep flashes gentle: some people get seizures from flashing lights. Players always see a warning first.` },
  { sel: "#mkBuild .makerGrid", build: true, title: "Level settings", text: `• <b>Name</b>: what everyone sees on the list.<br>
    • <b>To win</b>: <b>catch</b> a number of white balls before the end, or <b>survive</b> to the end.<br>
    • <b>Lives</b>: how many hits the player can take (1 to 5).<br>
    • <b>Ball speed</b>: faster or slower balls for the whole level.<br>
    • <b>Intro line</b>: said when the level starts.` },
  { sel: "#arLoad", build: true, title: "Remix a level", text: "Paste any level code here and press <b>Copy into this level</b> to load it into the level you have open. Then change it however you like and save it as yours." },
  { sel: "#mkPlay", build: true, title: "Play it, share it, publish it", text: `• <b>Play it</b> saves your level, then lets you play it. Always test your level! Make sure it can be beaten.<br>
    • <b>Copy code</b> copies its share code. Friends paste it in Play levels to play it.<br>
    • <b>Publish</b> puts it on the list for everyone (free, 3 at a time). The list updates every 10 minutes.` },
  { sel: "#arCanvas", build: true, title: "How players play your level", text: `• <b>W / S</b> move along your arrows.<br>
    • <b>Red balls</b>: get off that dot before it lands, or lose a life. A red ring shows where it's going.<br>
    • <b>White balls</b>: be on the dot it's flying to, press <b>C to clap</b> while it's in the air, then <b>Space to catch</b> it as it arrives. Standing on its dot and not catching it costs a life. Catching without clapping does too.<br>
    • Top right shows lives, how many they've caught and the time left.` },
  { sel: '[data-mk="browse"]', pane: "browse", title: "Play levels", text: `Here you play everyone else's levels:<br>
    • <b>⭐ Admin's choice</b>: 5 levels picked by bajajhamish and kythor.<br>
    • <b>Most liked</b> (top 20) and <b>Newest</b> (the last 50).<br>
    • <b>Paste a code</b> to play a level a friend sent you.<br>
    • <b>♥ Like</b> levels you enjoy (once each).<br><br>
    Published levels nobody plays for 30 days are removed.` },
  { sel: '[data-mk="mine"]', pane: "mine", title: "My levels", text: "Your published levels, with their likes and plays. Delete one to free up a publish slot." },
  { sel: "#mkDimFx", title: "Dim flashes", text: "Turn this on and flashes in every made level are much softer. Before any made level starts, everyone sees a flashing-lights warning, and this switch is there too." },
  { title: "You're ready!", text: `When you beat someone's level, it's added to your <b>Levels beaten</b>. Friends can see that from the Friends tab. There's no reward, just bragging rights.<br><br>
    <b>Tips:</b> start small (a few dots and 1 or 2 enemies), play it, then add more. Use phases to surprise players, and lines to give your enemies personality.<br><br>
    Have fun! You can see this tour again with <b>📖 Tutorial</b>.` },
];
let mtI = 0, mtOn = false, mtShowedEditor = false;
function makerTour(start) {
  if (!el("mtCard")) {
    document.body.insertAdjacentHTML("beforeend", `<div id="mtShade"></div><div id="mtSpot"></div><div id="mtCard"><div class="mtTop"><b id="mtTitle"></b><span class="muted small" id="mtCount"></span></div><div id="mtText"></div>
      <div class="row mtNav"><button type="button" class="ghost" id="mtSkip">Skip tutorial</button><span style="flex:1"></span><button type="button" class="secondary" id="mtBack">← Back</button><button type="button" id="mtNext">Next →</button></div></div>`);
    el("mtSkip").onclick = () => mtEnd();
    el("mtBack").onclick = () => mtGo(mtI - 1);
    el("mtNext").onclick = () => (mtI + 1 >= MT_STEPS.length ? mtEnd() : mtGo(mtI + 1));
    addEventListener("resize", () => mtOn && mtPlace()); addEventListener("scroll", () => mtOn && mtPlace(), true);
    addEventListener("keydown", e => { if (!mtOn) return; if (e.key === "Escape") mtEnd(); if (e.key === "ArrowRight") el("mtNext").click(); if (e.key === "ArrowLeft") el("mtBack").click(); });
  }
  mtOn = true; mtShowedEditor = false;
  el("mtShade").style.display = el("mtSpot").style.display = el("mtCard").style.display = "block";
  mtGo(start || 0);
}
function mtGo(i) {
  mtI = Math.max(0, Math.min(MT_STEPS.length - 1, i));
  const s = MT_STEPS[mtI];
  // get the Level Maker ready for this step
  if (typeof mkTab === "function" && mkCur !== (s.pane || "make") && (s.pane || s.tab || s.build)) mkTab(s.pane || "make");   // show the part being talked about
  if (s.build) {
    if (el("mkEditor").hidden) { el("mkEditor").hidden = false; el("mkLocked").hidden = true; mtShowedEditor = true; }   // no level yet: show the editor just for the tour
    if (mkMode !== "build") mkSetMode("build"), mkUpdate();
  }
  if (s.enemy && (typeof PH !== "undefined") && PH.e.length && arSel < 0) { arSel = 0; arEnemyShow(); arDraw(); }
  el("mtTitle").innerHTML = s.title; el("mtText").innerHTML = s.text;
  el("mtCount").textContent = `${mtI + 1} / ${MT_STEPS.length}`;
  el("mtBack").disabled = mtI === 0; el("mtNext").textContent = mtI + 1 >= MT_STEPS.length ? "Done ✓" : "Next →";
  const t = s.sel && document.querySelector(s.sel);
  if (t && t.offsetParent) t.scrollIntoView({ block: "center", behavior: "instant" });
  mtPlace();
}
function mtPlace() {
  const s = MT_STEPS[mtI], t = s.sel && document.querySelector(s.sel), spot = el("mtSpot"), card = el("mtCard");
  const vw = innerWidth, vh = innerHeight, cw = Math.min(440, vw - 24); card.style.width = cw + "px";
  if (!t || !t.offsetParent) {           // nothing to point at: card in the middle, whole screen dimmed
    spot.style.display = "none"; el("mtShade").style.display = "block"; el("mtShade").style.background = "rgba(0,0,0,.72)";
    card.style.left = (vw - cw) / 2 + "px"; card.style.top = Math.max(12, (vh - card.offsetHeight) / 2) + "px"; return;
  }
  el("mtShade").style.display = "block"; el("mtShade").style.background = "transparent"; spot.style.display = "block";   // the shade still stops stray clicks
  const r = t.getBoundingClientRect(), pad = 8;
  Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
  const ch = card.offsetHeight, below = r.bottom + pad + 12, above = r.top - pad - 12 - ch;
  let top = below + ch <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - ch - 8);
  let left = Math.min(Math.max(8, r.left + r.width / 2 - cw / 2), vw - cw - 8);
  card.style.left = left + "px"; card.style.top = top + "px";
}
function mtEnd() {
  mtOn = false;
  ["mtShade", "mtSpot", "mtCard"].forEach(id => el(id).style.display = "none");
  try { localStorage.setItem("cc_mktut", "1"); } catch (e) {}
  if (mtShowedEditor && typeof mkSelect === "function") mkSelect(mkDraft);       // put the lock back if you have no level yet
  if (typeof mkTab === "function") mkTab("make");
}
// the first time someone makes a level, the tour starts by itself
function makerTourFirstTime() { let seen = false; try { seen = localStorage.getItem("cc_mktut") === "1"; } catch (e) {} if (!seen) setTimeout(() => makerTour(0), 400); }
