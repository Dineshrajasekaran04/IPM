/* save.js — local persistence and CrazyGames data saves with versioning */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, C = IPM.D.CONFIG, V = (IPM.V = {});
  const storage = () => {
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    return sdk && sdk.environment === 'crazygames' && sdk.data ? sdk.data : localStorage;
  };
  V.prepare = () => {
    try {
      const target = storage();
      if (target !== localStorage) {
        [C.saveKey, 'ipm_tycoon_career_v1'].forEach((key) => {
          if (!target.getItem(key)) {
            const previous = localStorage.getItem(key);
            if (previous) target.setItem(key, previous);
          }
        });
      }
    } catch (e) {}
  };
  V.getItem = (key) => { try { return storage().getItem(key); } catch (e) { return null; } };
  V.setItem = (key, value) => { try { storage().setItem(key, value); return true; } catch (e) { return false; } };
  V.has = () => { try { return !!storage().getItem(C.saveKey); } catch (e) { return false; } };
  V.save = () => {
    const g = IPM.S.cur; if (!g) return false;
    try { g.lastSave = Date.now(); g.v = C.version; storage().setItem(C.saveKey, JSON.stringify(g)); return true; } catch (e) { return false; }
  };
  V.load = () => {
    try {
      const raw = storage().getItem(C.saveKey); if (!raw) return null;
      const g = U.merge(IPM.S.base(), JSON.parse(raw));
      if (!g.company || !g.warehouses.length) return null;
      g.paused = false; return IPM.S.fix(g);
    } catch (e) { return null; }
  };
  V.reset = () => { try { storage().removeItem(C.saveKey); } catch (e) {} };
})();
/* offline progress: only in-progress jobs, returns, repairs and training continue; no new enquiries, capped */
(function () {
  const IPM = window.IPM, C = IPM.D.CONFIG, V = IPM.V;
  V.offline = () => {
    const g = IPM.S.cur; if (!g) return;
    const el = Math.min(C.offlineCapSec, Math.max(0, (Date.now() - (g.lastSave || Date.now())) / 1000));
    if (el < 30) return;
    const d0 = g.stats.deliveries, c0 = g.cash;
    for (let t = 0; t < el; t++) { g.time += 1; IPM.O.tick(1, true); IPM.W.tick(1); }
    g.lastSave = Date.now();
    IPM.UI.note('Welcome back! Away ' + IPM.U.longTime(el) + ': ' + (g.stats.deliveries - d0) + ' jobs finished, cash ' + IPM.U.money(g.cash - c0) + '.', 'good');
  };
})();
