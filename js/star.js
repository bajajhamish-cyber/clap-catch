// ======================================================================
//  star.js: the Bonus Star. Every 10 minutes it pops up somewhere on
//  everyone's screen at the same moment (menu or mid-game) for 60 seconds.
//  Click it for points: 5 (80%), 10 (15%) or 25 (5%), rolled by the server.
// ======================================================================
(function () {
  const el2 = document.createElement("div");
  el2.id = "bonusStar"; el2.innerHTML = "⭐"; el2.title = "Bonus Star! Click it!";
  document.body.appendChild(el2);
  let showingW = null, busy = false;
  const serverNow = () => Date.now() + (typeof clockSkew === "number" ? clockSkew : 0);
  const claimed = w => { try { return localStorage.getItem("cc_star") === String(w); } catch (e) { return false; } };
  function place() {
    const m = 60, x = m + Math.random() * (window.innerWidth - 2 * m - 70), y = m + Math.random() * (window.innerHeight - 2 * m - 70);
    el2.style.left = x + "px"; el2.style.top = y + "px";
  }
  function hide() { el2.classList.remove("on"); showingW = null; }
  setInterval(() => {
    if (!PROFILE) { hide(); return; }
    const t = serverNow(), w = Math.floor(t / STAR.EVERY), at = starAt(w);
    const live = t >= at && t < at + STAR.SHOW && !claimed(w);
    if (live && showingW !== w) { showingW = w; place(); el2.classList.add("on"); }
    else if (!live && showingW !== null && !busy) hide();
  }, 500);
  el2.addEventListener("click", async e => {
    e.stopPropagation();
    if (busy || showingW === null) return;
    busy = true;
    const w = showingW, x = el2.style.left, y = el2.style.top;
    try {
      const r = await api("starClaim", { w });
      try { localStorage.setItem("cc_star", String(w)); } catch (x2) {}
      hide(); pop(`+${r.n} ⭐`, x, y, r.n >= 25 ? "big" : r.n >= 10 ? "mid" : "");
      if (typeof onPoints === "function") onPoints(r.me.points);
      if (!inGame) setProfile(r.me); else PROFILE.points = r.me.points;
    } catch (err) {
      if (/already|gone/.test(err.message)) { try { localStorage.setItem("cc_star", String(w)); } catch (x2) {} hide(); }
      toast(err.message, true);
    }
    busy = false;
  });
  function pop(text, x, y, cls) {
    const p = document.createElement("div");
    p.className = "starPop " + cls; p.textContent = text; p.style.left = x; p.style.top = y;
    document.body.appendChild(p); setTimeout(() => p.remove(), 1600);
  }
})();
