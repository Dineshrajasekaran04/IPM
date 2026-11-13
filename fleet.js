/* fleet.js — vehicle purchase, sale, upgrades, repairs, relocation */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur;
  const F = (IPM.F = {});
  const cityName = (id) => (D.city(id) ? D.city(id).name : id);
  const short = (n) => 'Not enough cash — short by ' + U.money(IPM.E.short(n)) + '.';

  F.buy = (typeId, whId) => {
    const g = G(), S = IPM.S, t = D.VEH[typeId], wh = S.wh(whId);
    if (!t || !wh) return { ok: false, msg: 'Choose a warehouse first.' };
    if (!IPM.P.reqOk(t.unlock)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(t.unlock) };
    const ws = S.whStats(wh);
    if (ws.vehCount >= ws.vehicleSlots) return { ok: false, msg: cityName(whId) + ' has no free vehicle slots (' + ws.vehCount + '/' + ws.vehicleSlots + '). Upgrade the warehouse level.' };
    if (!IPM.E.spend(t.price, 'vehicle', 'Bought ' + t.name, whId)) return { ok: false, msg: short(t.price) };
    const n = S.id(g, 'veh');
    g.vehicles.push({ id: 'V' + n, type: typeId, name: t.name + ' #' + n, plate: U.plate(), whId, cond: 100, upg: { cap: 0, speed: 0, fuel: 0, rel: 0 }, status: 'Idle', orderId: '', driverId: '', trips: 0, earned: 0, ret: null, maintT: 0, maintDur: 0 });
    return { ok: true, msg: t.name + ' added to your vehicles at ' + cityName(whId) + '.', sound: 'buy' };
  };

  F.sellValue = (v) => Math.round(D.VEH[v.type].price * C.wear.sellRate * (0.5 + 0.5 * v.cond / 100));
  F.sell = (id) => {
    const g = G(), v = IPM.S.veh(id);
    if (!v) return { ok: false, msg: 'Vehicle not found.' };
    if (v.status !== 'Idle') return { ok: false, msg: 'Only idle vehicles can be sold.' };
    const val = F.sellValue(v);
    g.vehicles = g.vehicles.filter((x) => x.id !== id);
    IPM.E.earn(val, 'sale', 'Sold ' + v.name, v.whId);
    return { ok: true, msg: v.name + ' sold for ' + U.money(val) + '.', sound: 'ok' };
  };

  F.upgradeCost = (v, key) => U.round(D.VEH[v.type].price * 0.18 * (v.upg[key] + 1), 100);
  F.upgrade = (id, key) => {
    const v = IPM.S.veh(id);
    if (!v || !D.VUP[key]) return { ok: false, msg: 'Vehicle not found.' };
    if (v.status !== 'Idle') return { ok: false, msg: 'Upgrade only while the vehicle is idle.' };
    if (v.upg[key] >= D.VUP[key].max) return { ok: false, msg: 'Already at max level.' };
    const cost = F.upgradeCost(v, key);
    if (!IPM.E.spend(cost, 'vehicle', D.VUP[key].label + ' on ' + v.name, v.whId)) return { ok: false, msg: short(cost) };
    v.upg[key]++;
    IPM.P.addXp(10);
    return { ok: true, msg: D.VUP[key].label + ' upgraded to level ' + v.upg[key] + '.', sound: 'buy' };
  };

  F.repairCost = (v, expedite) => Math.round((100 - v.cond) * D.VEH[v.type].price * C.wear.repairPerPoint * (expedite ? 2 : 1));
  F.repair = (id, expedite) => {
    const v = IPM.S.veh(id);
    if (!v) return { ok: false, msg: 'Vehicle not found.' };
    if (v.status !== 'Idle') return { ok: false, msg: 'Vehicle must be idle to be repaired.' };
    if (v.cond >= 100) return { ok: false, msg: 'Vehicle is already in perfect condition.' };
    const cost = F.repairCost(v, expedite);
    if (!IPM.E.spend(cost, 'repairs', 'Repair ' + v.name, v.whId)) return { ok: false, msg: short(cost) };
    if (expedite) {
      v.cond = 100;
      return { ok: true, msg: v.name + ' repaired instantly.', sound: 'buy' };
    }
    v.status = 'Maintenance';
    v.maintT = 0;
    v.maintDur = Math.max(4, (100 - v.cond) * C.wear.repairSecPerPoint);
    return { ok: true, msg: v.name + ' is in the workshop.', sound: 'buy' };
  };

  F.move = (id, whId) => {
    const S = IPM.S, v = S.veh(id), wh = S.wh(whId);
    if (!v || !wh) return { ok: false, msg: 'Invalid move.' };
    if (v.status !== 'Idle') return { ok: false, msg: 'Only idle vehicles can change warehouse.' };
    if (v.whId === whId) return { ok: false, msg: 'Already based there.' };
    const ws = S.whStats(wh);
    if (ws.vehCount >= ws.vehicleSlots) return { ok: false, msg: cityName(whId) + ' has no free vehicle slots.' };
    v.whId = whId;
    return { ok: true, msg: v.name + ' now based in ' + cityName(whId) + '.' };
  };

  F.effCap = (v) => IPM.S.vehEff(v).cap;
})();
