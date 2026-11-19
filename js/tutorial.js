// ======================================================================
//  tutorial.js: slideshow for new accounts (and the 📖 Tutorial button)
// ======================================================================
const TUT_MIN_MS = 500;   // you have to stay on each slide at least this long

// --- little drawing helpers (canvas is 480 x 260)
function tCube(c, x, y, col, label, s = 40, skin) {
  c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x - s / 2 + 3, y - s / 2 + 4, s, s);
  if (skin) drawSkin(c, skin, x - s / 2, y - s / 2, s, col, performance.now());
  else { c.fillStyle = col; c.fillRect(x - s / 2, y - s / 2, s, s); }
  if (label) { c.fillStyle = "#fff"; c.font = "bold 13px system-ui"; c.textAlign = "center"; c.fillText(label, x, y + s / 2 + 16); }
}
function tBall(c, x, y, s = 12, fire) {
  c.save(); c.translate(x, y); c.rotate(performance.now() / 150);
  c.fillStyle = fire ? "#ff7043" : "#fff"; c.fillRect(-s / 2, -s / 2, s, s);
  c.strokeStyle = fire ? "#bf360c" : "#ff9800"; c.lineWidth = 2; c.strokeRect(-s / 2, -s / 2, s, s); c.restore();
}
function tBar(c, x, y, f) {
  c.fillStyle = "#000a"; c.fillRect(x - 32, y - 2, 64, 10);
  c.fillStyle = chargeColor(f); c.fillRect(x - 30, y, 60 * f, 6);
}
function tLine(c, a, b, col) {
  c.strokeStyle = col; c.lineWidth = 3; c.setLineDash([10, 7]); c.lineDashOffset = -performance.now() / 30;
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
}
function tText(c, txt, x, y, col = "#cfd3e0", size = 16) { c.fillStyle = col; c.font = `bold ${size}px system-ui`; c.textAlign = "center"; c.fillText(txt, x, y); }
function tX(c, x, y) { c.strokeStyle = "#ff5252"; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 12, y - 12); c.lineTo(x + 12, y + 12); c.moveTo(x + 12, y - 12); c.lineTo(x - 12, y + 12); c.stroke(); }
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

const TUT_SLIDES = [
  {
    title: "👏 Welcome to Clap Catch!",
    text: "Throw the ball at people. They have to <b>clap before they catch it</b>. But you can <b>fake</b> a throw, and if they clap on a fake, they're out. Last one standing wins.",
    draw(c, t) {
      const pts = [[240, 50], [400, 130], [240, 215], [80, 130]], cols = ["#4fc3f7", "#ffb74d", "#ba68c8", "#aed581"];
      pts.forEach((p, i) => tCube(c, p[0], p[1], cols[i], ["Ana", "Ben", "You", "Cal"][i], 36));
      const k = (t / 900) % 4, i = Math.floor(k), f = k - i, a = pts[i], b = pts[(i + 1) % 4];
      tBall(c, lerp(a[0], b[0], f), lerp(a[1], b[1], f), 12 + Math.sin(f * Math.PI) * 8);
    },
  },
  {
    title: "🎯 Throwing",
    text: "When you have the ball, aim with your <b>mouse</b> (or A / D). Your aim locks onto a player and <b>everyone can see who you're aiming at</b>. Hold <kbd>Space</kbd> to charge. You turn green → red and a bar fills. When it's full, the ball flies.",
    draw(c, t) {
      const f = Math.min(1, (t % 2600) / 1800), me = [120, 140], tgts = [[360, 60], [380, 200]], tg = tgts[Math.floor(t / 2600) % 2];
      tLine(c, me, tg, chargeColor(f));
      c.strokeStyle = "#ff4d4d"; c.lineWidth = 3; c.beginPath(); c.arc(tg[0], tg[1], 32, 0, Math.PI * 2); c.stroke();
      tgts.forEach((p, i) => tCube(c, p[0], p[1], ["#4fc3f7", "#ba68c8"][i], ["Ana", "Ben"][i], 36));
      tCube(c, me[0], me[1], chargeColor(f), "You", 44);
      tBar(c, me[0], me[1] - 40, f);
      if (f >= 1) tText(c, "THROW!", me[0], me[1] + 60, "#ffd54f");
      else tText(c, "holding Space…", me[0], me[1] + 60, "#8a90a2", 13);
    },
  },
  {
    title: "🎭 Faking (juking)",
    text: "Let go of <kbd>Space</kbd> <b>before</b> the bar is full and nothing gets thrown. That's a fake! Or switch who you're aiming at right at the end. If someone claps when the ball isn't coming to them, <b>they're out</b>.",
    draw(c, t) {
      const k = t % 3000, f = k < 1500 ? k / 1700 : 0, me = [120, 140], tg = [360, 140];
      tLine(c, me, tg, chargeColor(f));
      tCube(c, me[0], me[1], chargeColor(f), "You", 44);
      if (f > 0) tBar(c, me[0], me[1] - 40, f);
      tCube(c, tg[0], tg[1], k > 1700 ? "#3a3d46" : "#4fc3f7", "Ana", 40);
      if (k > 1300 && k < 1900) tText(c, "👏", tg[0] + 34, tg[1] - 26, "#fff", 26);
      if (k > 1500) tText(c, "let go! (fake)", me[0], me[1] + 60, "#ffd54f", 13);
      if (k > 1700) { tX(c, tg[0], tg[1]); tText(c, "Clapped on a fake: OUT!", tg[0], tg[1] + 60, "#ff8a80", 14); }
    },
  },
  {
    title: "🙌 Clapping and catching",
    text: "When the ball is really coming at you, press <kbd>B</kbd> to <b>clap</b>, then press <kbd>Space</kbd> to <b>catch</b> when it reaches you (a yellow ring shows up). Now it's your ball!",
    draw(c, t) {
      const k = t % 2600, p = Math.min(1, k / 1300), a = [100, 140], b = [380, 140];
      tCube(c, a[0], a[1], "#ffb74d", "Ben", 40); tCube(c, b[0], b[1], "#4fc3f7", "You", 44);
      if (k < 1500) tBall(c, lerp(a[0], b[0], p), lerp(a[1], b[1], p) - Math.sin(p * Math.PI) * 30, 12 + Math.sin(p * Math.PI) * 6);
      if (k > 350 && k < 1000) tText(c, "👏 B", b[0], b[1] - 40, "#fff", 18);
      if (p > 0.6 && k < 1500) { c.strokeStyle = "#ffeb3b"; c.lineWidth = 3; c.beginPath(); c.arc(b[0], b[1], 40, 0, Math.PI * 2); c.stroke(); tText(c, "SPACE!", b[0], b[1] - 48, "#ffeb3b"); }
      if (k >= 1500) { tBall(c, b[0] - 30, b[1], 12); tText(c, "✅ Caught!", b[0], b[1] + 60, "#7ee787"); }
    },
  },
  {
    title: "❌ How you get out",
    text: "You're out if you: <b>clap when it isn't coming to you</b>, <b>catch without clapping</b>, or <b>don't catch it</b> in time. You can also press <kbd>G</kbd><kbd>G</kbd><kbd>G</kbd> to take yourself out.",
    draw(c, t) {
      const show = Math.floor(t / 700);
      [["👏 on a fake", 90], ["catch, no clap", 240], ["dropped it", 390]].forEach(([label, x], i) => {
        const out = show > i;
        tCube(c, x, 110, out ? "#3a3d46" : ["#4fc3f7", "#ffb74d", "#ba68c8"][i], "", 46);
        if (out) tX(c, x, 110);
        tText(c, label, x, 175, out ? "#ff8a80" : "#cfd3e0", 14);
      });
    },
  },
  {
    title: "🎉 Casual (Original) mode",
    text: "Join any room with a code. When someone wins a round, they <b>add or remove one rule</b>. That can be a passive (like Hot Potato) or an ability that <b>everyone</b> gets on <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd>. No points. Just for fun with friends. Alone? Press Start and 3 bots join.",
    draw(c, t) {
      tText(c, "🏆 Winner picks:", 240, 40, "#ffd54f");
      const cards = [["➕ 🔥 Fireball", "#1f6f3a"], ["➕ 🥔 Hot Potato", "#1f6f3a"], ["➖ 👏👏 Clap x2", "#7a2323"]];
      cards.forEach(([txt, col], i) => {
        const appear = Math.min(1, Math.max(0, (t % 3600 - i * 500) / 300));
        c.globalAlpha = appear; c.fillStyle = col; c.fillRect(90, 64 + i * 58 + (1 - appear) * 20, 300, 44);
        tText(c, txt, 240, 92 + i * 58 + (1 - appear) * 20, "#fff", 16); c.globalAlpha = 1;
      });
    },
  },
  {
    title: "🏆 Competitive mode",
    text: "Bring <b>your own 3 abilities</b> (equip them in Inventory). The winner can only add or remove <b>passive</b> rules. Press <b>Find a match</b> to play for points: <b>+25 per win</b> and <b>+5 for every player you get out</b>. Brave? Try <b>🎲 High Risk</b>: everyone bets points, the winner takes the pot. If nobody else is online after 25 seconds, 4 bots join. Private rooms with a code don't give points.",
    draw(c, t) {
      [["🔥", "J"], ["☢️", "K"], ["🧱", "L"]].forEach(([ic, key], i) => {
        const x = 70 + i * 74, y = 90;
        c.fillStyle = "#262a35"; c.fillRect(x, y, 58, 58); c.strokeStyle = "#7ee787"; c.lineWidth = 3; c.strokeRect(x, y, 58, 58);
        tText(c, ic, x + 29, y + 39, "#fff", 26);
        c.fillStyle = "#fff"; c.fillRect(x - 6, y - 8, 20, 20); tText(c, key, x + 4, y + 7, "#14161c", 13);
      });
      tText(c, "your loadout", 144, 178, "#8a90a2", 13);
      const k = (t % 2000) / 2000;
      c.globalAlpha = 1 - k; tText(c, "+25 ⭐", 370, 120 - k * 40, "#ffd54f", 30); c.globalAlpha = 1;
      tText(c, "🔎 Find a match", 370, 175, "#9ec1ff", 15);
    },
  },
  {
    title: "✨ Abilities",
    text: "Press <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> to use abilities, once per round each. Glowing green = ready. The panel under the game says what each one does. Some examples: <b>Fireball</b> (don't catch it!), <b>Nuke</b> (everyone must clap), <b>Double Force</b> (they must throw to you).",
    draw(c, t) {
      const a = [100, 150], b = [380, 150], p = (t % 1800) / 1400;
      tCube(c, a[0], a[1], "#ffb74d", "Ben", 40); tCube(c, b[0], b[1], "#4fc3f7", "You", 40);
      if (p <= 1) tBall(c, lerp(a[0], b[0], p), lerp(a[1], b[1], p) - Math.sin(p * Math.PI) * 30, 16, true);
      if (p > 0.5 && p <= 1) tText(c, "🔥 DON'T CATCH!", b[0], b[1] - 44, "#ff5722", 15);
      tText(c, "🔥 Fireball", 240, 40, "#ffb300", 18);
    },
  },
  {
    title: "🛒 Shop, skins and trading",
    text: "Spend points on <b>ability packs (50)</b> and <b>skin packs (100)</b>. Rarest items are very rare! Equip skins in Inventory. Trade abilities, skins and points with other players in Trade (sending a request costs 5).",
    draw(c, t) {
      const skins = ["gold", "galaxy", "lava", "glitch", "rainbow"], i = Math.floor(t / 400) % skins.length;
      c.fillStyle = "#1e2129"; c.fillRect(150, 30, 180, 190);
      drawSkin(c, skins[i], 200, 60, 80, "#4fc3f7", performance.now());
      tText(c, SKINS[skins[i]].name, 240, 175, RARITY[SKINS[skins[i]].rarity].color, 16);
      tText(c, "🎁 opening…", 240, 205, "#8a90a2", 13);
    },
  },
  {
    title: "⏳ Limited-time events",
    text: "Sometimes an <b>event</b> switches on for a while. A banner shows at the top and a <b>⏳ Limited</b> tab appears. <b>🏆 Golden Games</b> turns everything gold with <b>2x points</b>. <b>🍀 Lucky</b> makes rare items more likely. <b>🎯 Bounty Hunt</b> puts a 💰 on someone. <b>🌑 Blackout</b> turns the lights off. <b>Trading is free</b> during any event!",
    draw(c, t) {
      const ev = [["🏆", "Golden Games", "#ffd54f"], ["🍀", "Lucky", "#81c784"], ["🎯", "Bounty Hunt", "#ff8a65"], ["🌑", "Blackout", "#9fa8da"]][Math.floor(t / 1300) % 4];
      if (ev[1] === "Golden Games") { const g = c.createRadialGradient(240, 130, 20, 240, 130, 260); g.addColorStop(0, "#5a4608"); g.addColorStop(1, "#1f1803"); c.fillStyle = g; c.fillRect(0, 0, 480, 260); }
      if (ev[1] === "Blackout") { c.fillStyle = "#000"; c.fillRect(0, 0, 480, 260); }
      c.fillStyle = "#3a2a6b"; c.fillRect(40, 20, 400, 34); tText(c, `${ev[0]} ${ev[1]} is on!  Ends in 59m`, 240, 43, "#fff", 15);
      tText(c, ev[0], 240, 150, ev[2], 64);
      tText(c, ev[1], 240, 205, ev[2], 20);
      if (ev[1] === "Bounty Hunt") tText(c, "💰", 300, 110, "#fff", 30);
    },
  },
  {
    title: "😈 Limited packs",
    text: "Some events bring a special pack to the shop: <b>🎩 Illusioner</b>, <b>🪓 Barbaric</b>, <b>😇 Angel</b>, <b>😈 Devil</b> (new abilities) or the <b>💎 Legendary Skin Pack</b>. They leave when the event ends, but <b>what you get is yours forever</b>. Look out for the new <b style='color:#ff4dff'>Mythical</b> rarity!",
    draw(c, t) {
      const packs = [["🎩", "Illusioner"], ["🪓", "Barbaric"], ["😇", "Angel"], ["😈", "Devil"], ["💎", "Legendary"]];
      packs.forEach(([ic, nm2], i) => {
        const x = 56 + i * 92, y = 95 + Math.sin(t / 300 + i) * 6;
        c.fillStyle = "#262a35"; c.fillRect(x - 38, y - 40, 76, 92); c.strokeStyle = i === Math.floor(t / 700) % 5 ? "#ff4dff" : "#3a3f4e"; c.lineWidth = 3; c.strokeRect(x - 38, y - 40, 76, 92);
        tText(c, ic, x, y + 8, "#fff", 34); tText(c, nm2, x, y + 40, "#cfd3e0", 12);
      });
      const g = 0.5 + 0.5 * Math.sin(t / 200);
      tText(c, "✨ MYTHICAL ✨", 240, 225, `rgba(255,77,255,${0.5 + g * 0.5})`, 22);
    },
  },
  {
    title: "🌀 Wild new abilities",
    text: "The limited packs have tricks you've never seen. <b>👥 Clone</b> makes a copy of you, and if they throw to the copy, <b>they're</b> out. <b>🐂 Bull Rush</b> steals the ball. <b>⚡ Flash</b> blinds everyone. <b>🎡 Devil's Deal</b> pauses the game and spins a wheel to steal someone's best ability forever. Some cost points, so you click a player to use them.",
    draw(c, t) {
      const k = Math.floor(t / 2400) % 2, f = (t % 2400) / 2400;
      if (k === 0) {
        tCube(c, 100, 130, "#4fc3f7", "Ana", 40);
        tCube(c, 340, 80, "#ffb74d", "Ben", 40); tCube(c, 380, 190, "#ffb74d", "Ben", 40);
        tLine(c, [100, 130], f < 0.5 ? [340, 80] : [380, 190], "#2ecc40");
        tText(c, "Which one is real? 👥", 240, 245, "#ffd54f", 16);
      } else {
        const ang = (1 - Math.pow(1 - f, 3)) * Math.PI * 8;
        for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(240, 125); c.arc(240, 125, 80, ang + i * Math.PI / 5, ang + (i + 1) * Math.PI / 5); c.closePath(); c.fillStyle = i === 0 ? "#c62828" : i % 2 ? "#333" : "#444"; c.fill(); }
        c.fillStyle = "#ffeb3b"; c.beginPath(); c.moveTo(228, 30); c.lineTo(252, 30); c.lineTo(240, 50); c.fill();
        tText(c, "🎡 Devil's Deal: 10% to steal!", 240, 238, "#fff", 16);
      }
    },
  },
  {
    title: "👥 Friends",
    text: "Add friends in the <b>👥 Friends</b> tab. You can see who's online and press <b>Join</b> to go into their game, even matchmade ones. To keep points fair, if <b>everyone</b> in a matchmade game came in through a friend, it waits for someone else, or <b>bots join after 25 seconds</b>.",
    draw(c, t) {
      const f = (t % 4000) / 4000;
      tCube(c, 150, 120, "#4fc3f7", "You", 40); tCube(c, 330, 120, "#ffb74d", "Friend", 40);
      c.strokeStyle = "#2e7dff"; c.lineWidth = 3; c.beginPath(); c.moveTo(175, 120); c.lineTo(305, 120); c.stroke(); tText(c, "👥", 240, 112, "#fff", 22);
      if (f > 0.55) [[90, 210], [190, 220], [290, 220], [390, 210]].forEach((p, i) => { if (f > 0.55 + i * 0.08) tCube(c, p[0], p[1], ["#e57373", "#90a4ae", "#aed581", "#7986cb"][i], "🤖", 28); });
      else tText(c, `Waiting for someone else… ${Math.ceil((0.55 - f) * 45)}s`, 240, 215, "#8a90a2", 14);
    },
  },
  {
    title: "🎟️ The Board",
    text: "In the <b>🎟️ Board</b> tab, buy slots for <b>⭐ 100</b> each, as many as you like. When all 100 are full, <b>1 random slot wins a limited pack</b> and every other slot gets a <b>free ability pack</b>. More slots = better chance!",
    draw(c, t) {
      const filled = Math.floor(((t % 4000) / 3200) * 100);
      for (let i = 0; i < 100; i++) {
        const x = 40 + (i % 20) * 20, y = 30 + Math.floor(i / 20) * 20;
        c.fillStyle = i < filled ? (i % 7 === 0 ? "#2e7dff" : "#3a3f4e") : "#1e2129"; c.fillRect(x, y, 17, 17);
      }
      if (filled >= 100) { const w = 37; c.strokeStyle = "#ffd54f"; c.lineWidth = 3; c.strokeRect(40 + (w % 20) * 20 - 2, 30 + Math.floor(w / 20) * 20 - 2, 21, 21); tText(c, "🏆 Slot 38 wins a limited pack!", 240, 160, "#ffd54f", 17); tText(c, "Everyone else: a free pack each", 240, 190, "#cfd3e0", 14); }
      else tText(c, `${filled} / 100`, 240, 170, "#cfd3e0", 18);
    },
  },
  {
    title: "🚀 You're ready!",
    text: "Quick recap: <kbd>Space</kbd> = charge/throw and catch · <kbd>B</kbd> = clap · <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> = abilities · fake people out! You can watch this again any time with the 📖 button at the top.",
    draw(c, t) {
      const pts = [[240, 60], [370, 140], [240, 210], [110, 140]];
      pts.forEach((p, i) => tCube(c, p[0], p[1], ["#4fc3f7", "#ffb74d", "#ba68c8", "#aed581"][i], "", 34, i === 2 ? "rainbow" : null));
      tText(c, "👏", 240 + Math.sin(t / 200) * 6, 145, "#fff", 34);
    },
  },
];

let tutIdx = 0, tutShownAt = 0, tutFirstTime = false, tutOpen = false, tutTimer = null;
let tutWhatsNew = false;
function openTutorial(firstTime, seenBefore) {
  tutFirstTime = !!firstTime; tutIdx = 0; tutOpen = true; tutWhatsNew = !!(firstTime && seenBefore);
  el("tutModal").style.display = "flex";
  showTutSlide();
  requestAnimationFrame(tutLoop);
}
function showTutSlide() {
  const s = TUT_SLIDES[tutIdx];
  el("tutTitle").textContent = s.title;
  el("tutText").innerHTML = (tutWhatsNew && tutIdx === 0 ? `<div class="tutNew">✨ The game got new features! Here's the tutorial again with the new slides.</div>` : "") + s.text;
  el("tutDots").innerHTML = TUT_SLIDES.map((_, i) => `<span class="${i === tutIdx ? "on" : ""}"></span>`).join("");
  el("tutBack").disabled = tutIdx === 0;
  el("tutNext").textContent = tutIdx === TUT_SLIDES.length - 1 ? "Let's play!" : "Next →";
  tutShownAt = performance.now();
  el("tutNext").disabled = true;
  el("tutNext").classList.add("waiting");
  clearTimeout(tutTimer);
  tutTimer = setTimeout(() => { el("tutNext").disabled = false; el("tutNext").classList.remove("waiting"); }, TUT_MIN_MS);
}
function tutLoop() {
  if (!tutOpen) return;
  const cv = el("tutCanvas"), c = cv.getContext("2d");
  c.clearRect(0, 0, cv.width, cv.height);
  try { TUT_SLIDES[tutIdx].draw(c, performance.now() - tutShownAt); } catch (e) { console.error(e); }
  requestAnimationFrame(tutLoop);
}
function tutNext() {
  if (performance.now() - tutShownAt < TUT_MIN_MS) return;   // must stay 0.5s on each slide
  if (tutIdx < TUT_SLIDES.length - 1) { tutIdx++; showTutSlide(); return; }
  tutOpen = false;
  el("tutModal").style.display = "none";
  if (tutFirstTime) api("tutorialDone").catch(e => console.error(e));
}
function tutBack() { if (tutIdx > 0) { tutIdx--; showTutSlide(); } }
el("tutNext").onclick = tutNext;
el("tutBack").onclick = tutBack;
el("tutBtn").onclick = () => openTutorial(false);
document.addEventListener("keydown", e => {
  if (!tutOpen) return;
  if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); tutNext(); }
  if (e.key === "ArrowLeft") tutBack();
});
