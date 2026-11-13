/* state.js — the single central game state, default shape, lookups and derived stats */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const S = (IPM.S = { cur: null });
  const G = () => S.cur;

  S.base = () => ({
    v: C.version,
    company: { name: '', stateId: '', stateIds: [], createdAt: 0 },
    cash: 0, debt: 0, time: 0, speed: 1, paused: false,
    xp: 0, level: 1, rep: 0,
    unlocks: {}, milestones: {},
    warehouses: [], vehicles: [], employees: [], orders: [], customers: [],
    candidates: {}, campaigns: [], research: {}, seo: 0,
    counters: { ord: 0, veh: 0, emp: 0, cmp: 0, cand: 0 },
    eventState: { rollAcc: 0, lastAt: -999, lastByType: {}, pending: null, festival: null, supplierDiscountUntil: 0, supplierDiscount: 0, history: [] },
    fin: { totals: {}, lifetimeRevenue: 0, lifetimeExpense: 0, payAcc: 0, loanAcc: 0, wagesOwed: 0, missed: 0, bucketT: 0, bucketRev: 0, bucketExp: 0, opsAuto: true },
    ledger: [], series: [], recent: [],
    stats: {
      deliveries: 0, accepted: 0, onTime: 0, late: 0, damaged: 0, cancelled: 0, expired: 0, rejected: 0, ratingSum: 0, ratingCount: 0, timeSum: 0,
      bySource: { phone: { orders: 0, done: 0, revenue: 0 }, web: { orders: 0, done: 0, revenue: 0 }, app: { orders: 0, done: 0, revenue: 0 }, walk: { orders: 0, done: 0, revenue: 0 } },
      routes: {}, dest: {}, origin: {},
    },
    settings: { sound: true, autoDispatch: true, reducedMotion: false },
    adOffer: { roll: 0, nextAt: 480, dismissUntil: 0, active: false, rewardPending: false },
    tutorial: { skipped: false, done: false, opened: false },
    log: [], lastSave: 0, softFailAt: -999, orderTick: 0, autoTick: 0, lastOrderAt: 0,
  });

  S.id = (g, key) => {
    g.counters[key] = (g.counters[key] || 0) + 1;
    return g.counters[key];
  };

  S.newWarehouse = (cityId) => ({
    id: cityId, level: 1, cond: 100,
    upg: { storage: 0, loading: 0, handling: 0, packing: 0, reach: 0 },
    fin: { revenue: 0, wages: 0, fuel: 0, maintenance: 0, materials: 0, marketing: 0, upkeep: 0, repairs: 0 },
    stats: { delivered: 0, revenue: 0 },
    mgr: { autoAccept: true, express: true, autoRepair: true, minProfit: 500, maxDist: 400, keepCash: 3000 },
    crewLevels: { packer: 0, driver: 0, manager: 0 },
    openedAt: 0,
  });

  S.mkEmployee = (g, role, whId, o) => {
    o = o || {};
    const r = D.ROLES[role];
    const skill = o.skill || U.randInt(2, 5);
    return {
      id: 'E' + S.id(g, 'emp'), name: o.name || U.person(), role, skill, level: 1, exp: 0,
      wage: o.wage || U.round(U.rand(r.wage[0], r.wage[1]), 10), morale: 80,
      whId: whId || '', status: 'idle', orderId: '', trainT: 0, trainDur: 0, hired: g.time,
    };
  };

  S.create = (name, capital, stateIds) => {
    const g = S.base();
    stateIds = Array.isArray(stateIds) ? stateIds.slice(0, 2) : [stateIds || 'tn'];
    if (!stateIds[1]) stateIds.push(D.START_REGIONS.states.find(([id]) => id !== stateIds[0])[0]);
    g.company.name = name;
    g.company.stateId = stateIds[0];
    g.company.stateIds = stateIds;
    g.company.createdAt = Date.now();
    g.cash = C.startCash;
    if (capital === 'B') {
      g.cash += C.loan.principal;
      g.debt = C.loan.principal;
    }
    const hubs = stateIds.map((state) => D.stateHub(state)).filter(Boolean);
    hubs.forEach((hub) => g.warehouses.push(S.newWarehouse(hub.id)));
    const home = hubs[0] || D.city('chennai');
    g.employees.push(S.mkEmployee(g, 'packer', home.id, { skill: 3, wage: 300, name: 'Murugan S.' }));
    g.employees.push(S.mkEmployee(g, 'driver', home.id, { skill: 3, wage: 400, name: 'Selvam R.' }));
    g.lastSave = Date.now();
    return g;
  };

  S.wh = (id) => G().warehouses.find((w) => w.id === id);
  S.veh = (id) => G().vehicles.find((v) => v.id === id);
  S.emp = (id) => G().employees.find((e) => e.id === id);
  S.ord = (id) => G().orders.find((o) => o.id === id);
  S.owns = (id) => !!S.wh(id);

  S.vehEff = (v) => {
    const t = D.VEH[v.type], u = v.upg, U2 = D.VUP;
    return {
      cap: Math.round(t.cap * (1 + U2.cap.per * u.cap)),
      speed: t.speed * (1 + U2.speed.per * u.speed),
      fuelKm: t.fuelKm * (1 - U2.fuel.per * u.fuel),
      wear: 1 - U2.rel.per * u.rel,
    };
  };

  S.whStats = (wh) => {
    const g = G(), W = C.wh, L = wh.level - 1;
    const emps = g.employees.filter((e) => e.whId === wh.id);
    const sup = emps.filter((e) => e.role === 'supervisor' && e.status !== 'training').length;
    return {
      storageCap: W.baseStorage + W.storagePerLevel * L + W.storagePerUpg * wh.upg.storage,
      vehicleSlots: W.baseVeh + W.vehPerLevel * L,
      staffSlots: W.baseStaff + W.staffPerLevel * L,
      upkeep: W.baseUpkeep + W.upkeepPerLevel * L,
      maxJobs: W.baseJobs + W.jobsPerUpg * wh.upg.handling + sup + (wh.level >= 3 ? W.jobsLevel3 : 0),
      pendingCap: W.basePending + W.pendingPerUpg * wh.upg.handling + W.pendingPerLevel * L,
      supervisors: sup,
      manager: emps.find((e) => e.role === 'whManager') || null,
      staffCount: emps.filter((e) => e.role === 'packer' || e.role === 'driver' || e.role === 'supervisor').length,
      vehCount: g.vehicles.filter((v) => v.whId === wh.id).length,
    };
  };

  S.opsManager = () => G().employees.find((e) => e.role === 'opsManager') || null;
  S.opsActive = () => !!S.opsManager() && G().fin.opsAuto;

  // Make loaded data consistent (no vehicle/crew stuck on missing jobs)
  S.fix = (g) => {
    if (!Array.isArray(g.company.stateIds)) g.company.stateIds = g.company.stateId ? [g.company.stateId] : [];
    if (!g.company.stateId && g.company.stateIds.length) g.company.stateId = g.company.stateIds[0];
    g.warehouses.forEach((wh) => { const city = D.city(wh.id); if (city && city.hub && !g.company.stateIds.includes(city.state)) g.company.stateIds.push(city.state); });
    g.warehouses.forEach((wh) => { wh.crewLevels = Object.assign({ packer: 0, driver: 0, manager: 0 }, wh.crewLevels || {}); wh.mgr = Object.assign({ autoAccept: true, express: true, autoRepair: true, minProfit: 500, maxDist: 400, keepCash: 3000 }, wh.mgr || {}); });
    g.orders.forEach((o) => {
      if ((o.status === 'transit' || o.status === 'accepted') && (!g.vehicles.find((v) => v.id === o.vehicleId) || !g.employees.find((e) => e.id === o.driverId))) {
        o.status = 'cancelled';
        o.cancelReason = 'Lost on reload';
      }
    });
    const active = new Set(g.orders.filter((o) => o.status === 'transit' || o.status === 'accepted').map((o) => o.id));
    g.vehicles.forEach((v) => {
      if (['Reserved', 'Loading', 'In Transit', 'Unloading'].includes(v.status) && !active.has(v.orderId)) { v.status = 'Idle'; v.orderId = ''; v.driverId = ''; }
      if (v.status === 'Returning' && !v.ret) v.status = 'Idle';
      if (v.status === 'Maintenance' && !(v.maintDur > 0)) v.status = 'Idle';
    });
    g.employees.forEach((e) => {
      if (e.status === 'busy') {
        const ret = g.vehicles.some((v) => v.driverId === e.id && v.status === 'Returning');
        if (!active.has(e.orderId) && !ret) { e.status = 'idle'; e.orderId = ''; }
      }
      if (e.status === 'training' && !(e.trainDur > 0)) e.status = 'idle';
    });
    g.warehouses.forEach((w) => {
      const t = S.newWarehouse(w.id);
      w.upg = U.merge(t.upg, w.upg); w.fin = U.merge(t.fin, w.fin); w.stats = U.merge(t.stats, w.stats); w.mgr = U.merge(t.mgr, w.mgr);
    });
    g.vehicles.forEach((v) => { v.upg = U.merge({ cap: 0, speed: 0, fuel: 0, rel: 0 }, v.upg); });
    return g;
  };
})();
