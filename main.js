/* main.js — boot, game loop, autosave */
(function () {
  'use strict';
  const IPM = window.IPM, S = IPM.S, C = IPM.D.CONFIG;
  let last = performance.now(), uiT = 0, saveT = 0;
  function step(dt) {
    const g = S.cur; g.time += dt;
    IPM.O.tick(dt); IPM.W.tick(dt); IPM.M.tick(dt); IPM.Events.tick(dt); IPM.E.tick(dt); IPM.P.tick(dt); IPM.Platform.adsTick(dt);
  }
  function loop(now) {
    let dt = Math.min(0.25, (now - last) / 1000); last = now;
    const g = S.cur;
    if (g && !g.paused && !IPM.UI.modalOpen()) {
      let r = dt * g.speed; while (r > 0) { const s = Math.min(r, 0.5); step(s); r -= s; }
      uiT += dt; saveT += dt;
      if (uiT > 0.4) { uiT = 0; IPM.UI.render(); }
      if (saveT > C.autosaveSec) { saveT = 0; IPM.V.save(); }
    }
    requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.cur) IPM.V.save(); });
  window.addEventListener('beforeunload', () => IPM.V.save());
  async function boot() {
    try { await IPM.Platform.ready; } catch (e) {}
    IPM.V.prepare();
    const loaded = IPM.V.has() ? IPM.V.load() : null;
    if (loaded) { S.cur = loaded; IPM.V.offline(); IPM.UI.render(); IPM.UI.feed(); IPM.Events.present(); }
    else { if (IPM.V.has()) IPM.V.reset(); S.cur = S.base(); IPM.UI.setup(); S.cur = null; }
    requestAnimationFrame(loop);
  }
  boot();
})();
