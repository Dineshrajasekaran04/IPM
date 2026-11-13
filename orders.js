/* orders.js — enquiries, quotes, accept/reject, delivery simulation, vehicle return/repair ticks */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur, O = (IPM.O = {});
  const note = (m, k, o) => IPM.UI && IPM.UI.note(m, k, o);
  const srcOpen = (ch) => ch === 'web' ? G().unlocks.website : ch === 'app' ? G().unlocks.mobileApp : true;
  const active = (o) => o.status === 'transit';

  O.availability = (whId) => {
    const vehicles = G().vehicles.filter((vehicle) => whId == null || vehicle.whId === whId);
    return vehicles.reduce((counts, vehicle) => {
      if (vehicle.status === 'Idle' && vehicle.cond >= C.wear.minCond) counts.available++;
      else if (vehicle.status === 'Returning') counts.returning++;
      else if (vehicle.status === 'Maintenance' || (vehicle.status === 'Idle' && vehicle.cond < C.wear.minCond)) counts.maintenance++;
      else counts.working++;
      return counts;
    }, { available: 0, working: 0, returning: 0, maintenance: 0 });
  };

  const orderStage = (g) => g.stats.deliveries < 4 ? 0 : g.stats.deliveries < 10 ? 1 : g.stats.deliveries < 25 ? 2 : 3;

  O.gen = (wh, ch) => {
    const g = G(), S = IPM.S;
    let cities = g.warehouses.map((warehouse) => D.city(warehouse.id)).filter((city) => city && city.id !== wh.id && (city.state !== D.city(wh.id).state || city.hub));
    if (!cities.length && D.city(wh.id).state === 'tn') cities = D.CITIES.filter((city) => city.state === 'tn' && city.id !== wh.id && !city.hub);
    if (!cities.length) return null;
    const w = {}; cities.forEach((c) => (w[c.id] = c.demand + 0.2));
    const dest = U.weighted(w);
    const stage = orderStage(g), weights = [
      { room: 0.94, bhk1: 0.06 },
      { room: 0.62, bhk1: 0.3, bhk2: 0.08 },
      { room: 0.35, bhk1: 0.32, bhk2: 0.25, bhk3: 0.08 },
      { room: 0.2, bhk1: 0.25, bhk2: 0.28, bhk3: 0.17, office: 0.1 },
    ][stage];
    const ownedCap = g.vehicles.reduce((max, v) => Math.max(max, S.vehEff(v).cap), 0);
    const capacity = ownedCap || D.VEHICLES[0].cap;
    const ranges = [
      { room: [1, 5], bhk1: [4, 5], bhk2: [5, 5], bhk3: [5, 5], office: [5, 5] },
      { room: [1, 5], bhk1: [4, 8], bhk2: [8, 8], bhk3: [8, 8], office: [8, 8] },
      { room: [1, 5], bhk1: [4, 10], bhk2: [8, 15], bhk3: [12, 15], office: [12, 15] },
      { room: [1, 5], bhk1: [4, 10], bhk2: [8, 18], bhk3: [15, 30], office: [15, 28] },
    ][stage];
    const eligibleSizes = {};
    Object.keys(weights).forEach((key) => { if (ranges[key][0] <= capacity) eligibleSizes[key] = weights[key]; });
    const size = U.weighted(Object.keys(eligibleSizes).length ? eligibleSizes : { room: 1 }), sz = D.SIZES[size];
    const range = ranges[size];
    const minUnits = Math.min(range[0], capacity), maxUnits = Math.max(minUnits, Math.min(range[1], capacity));
    const units = U.randInt(minUnits, maxUnits);
    const pool = D.ITEMS[size === 'office' ? 'office' : 'home'];
    const items = U.shuffle(pool.slice()).slice(0, U.randInt(sz.items[0], sz.items[1]));
    const fragile = items.filter((i) => i[1]).length;
    const dist = D.dist(wh.id, dest), P = C.pricing, urg = U.weighted({ flex: 0.25, std: 0.5, exp: 0.25 });
    const rep = g.customers.length && Math.random() < 0.1 + (ch === 'app' ? 0.15 : 0);
    const cust = rep ? U.pick(g.customers) : U.person();
    let sub = sz.base + Math.round(dist * P.distRate) + sz.matCharge + fragile * P.fragileFee;
    let m = 1 + (urg === 'exp' ? P.express : urg === 'flex' ? -P.flex : 0) + (ch === 'web' ? P.web : ch === 'app' ? P.app : 0) + (rep ? P.repeat : 0) + Math.min(P.repCap, g.rep * P.repBoost);
    const o = { id: 'O' + S.id(g, 'ord'), status: 'new', src: ch, whId: wh.id, dest, size, cargoType: size === 'office' ? 'office' : 'home', units, items: items.map((i) => i[0]), fragile, dist, urg, cust, price: U.round(sub * m, 10), mat: Math.round(sz.mat * D.fx(g).materials), expire: g.time + U.rand(C.demand.patience[0], C.demand.patience[1]) * D.fx(g).patience, phase: '', pt: 0, vehicleId: '', driverId: '', packerId: '', deadline: 0, born: g.time };
    return o;
  };
  O.recommendVehicle = (o) => {
    const g = G(), S = IPM.S;
    const ops = S.opsActive(), owned = g.vehicles.filter((v) => ops || v.whId === o.whId).map((v) => ({ v, cap: S.vehEff(v).cap })).filter((x) => x.cap >= o.units && D.VEH[x.v.type].cargo.includes(o.cargoType || 'home')).sort((a, b) => a.cap - b.cap);
    if (owned.length) return { name: owned[0].v.name, type: D.VEH[owned[0].v.type].name, owned: true, capacity: owned[0].cap };
    const next = D.VEHICLES.find((v) => v.cap >= o.units);
    return next && next.cargo.includes(o.cargoType || 'home') ? { name: next.name, type: next.name, owned: false, capacity: next.cap } : null;
  };
  O.cost = (o, v) => { const t = D.VEH[v.type], e = IPM.S.vehEff(v); const eventFuel = IPM.Events ? IPM.Events.fuelMultiplier() : 1; const f = Math.round(o.dist * e.fuelKm * D.fx(G()).fuel * eventFuel), mt = Math.round(o.dist * t.maintKm); return { fuel: f, maint: mt, mat: o.mat }; };
  O.dur = (o, v, driver, packer) => {
    const e = IPM.S.vehEff(v), wh = IPM.S.wh(o.whId), up = wh ? wh.upg.loading : 0;
    const team = IPM.W, supervisor = G().employees.filter((staff) => staff.role === 'supervisor' && staff.whId === o.whId && staff.status !== 'training' && staff.status !== 'absent').sort((a, b) => b.level - a.level)[0];
    const crewLevels = wh && wh.crewLevels || {};
    const loadFactor = (team ? team.packingFactor(packer) : 1) * (1 - 0.025 * (crewLevels.packer || 0)) * (team ? team.supervisorFactor(supervisor) : 1) * D.fx(G()).loading;
    const travelFactor = (team ? team.drivingFactor(driver) : 1) * (1 - 0.018 * (crewLevels.driver || 0)) * (team ? team.operationsFactor(IPM.S.opsManager()) : 1);
    const load = Math.max(3, (C.time.loadBase + o.units * 0.15) * (1 - C.wh.loadingPerUpg * up) * loadFactor);
    return { load, travel: U.clamp((o.dist / (C.time.kmPerSec * e.speed)) * D.fx(G()).travel * travelFactor, C.time.minTravel, C.time.maxTravel), unload: load * C.time.unloadFactor };
  };
  // find resources for an order; returns {v,d,p} or {why}
  O.vehicleCandidates = (o) => {
    const S = IPM.S, ops = S.opsActive();
    return G().vehicles.filter((v) => (ops || v.whId === o.whId) && v.status === 'Idle' && v.cond >= C.wear.minCond && D.VEH[v.type].cargo.includes(o.cargoType || 'home') && S.vehEff(v).cap >= o.units).sort((a, b) => S.vehEff(a).cap - S.vehEff(b).cap);
  };
  O.resources = (o, preferredVehicleId) => {
    const g = G(), S = IPM.S, wh = S.wh(o.whId), ws = S.whStats(wh), ops = S.opsActive();
    const here = (x) => ops || x.whId === o.whId;
    if (g.orders.filter((x) => active(x) && x.whId === o.whId).length >= ws.maxJobs) return { why: 'All job slots busy at ' + D.city(o.whId).name + ' (upgrade order handling).' };
    if (preferredVehicleId) {
      const requested = S.veh(preferredVehicleId);
      if (requested && requested.status === 'Returning' && requested.ret && requested.ret.from === o.whId && requested.ret.to === o.dest && S.vehEff(requested).cap >= o.units && D.VEH[requested.type].cargo.includes(o.cargoType || 'home')) {
        const packer = g.employees.filter((e) => e.role === 'packer' && e.whId === o.whId && e.status === 'idle').sort((a, b) => b.skill - a.skill)[0];
        return packer ? { v: requested, d: S.emp(requested.driverId), p: packer, returning: true } : { why: 'No idle packer at ' + D.city(o.whId).name + ' for the return order.' };
      }
    }
    if (g.settings.autoDispatch && !preferredVehicleId) {
      const loading = g.vehicles.filter((v) => v.status === 'Loading' && v.dispatch && v.dispatch.origin === o.whId && v.dispatch.dest === o.dest && S.vehEff(v).cap >= v.dispatch.cargoUnits + o.units && D.VEH[v.type].cargo.includes(o.cargoType || 'home'));
      for (const v of loading) {
        const packer = g.employees.filter((e) => e.role === 'packer' && e.whId === o.whId && e.status === 'idle').sort((a, b) => b.skill - a.skill)[0];
        const driver = S.emp(v.driverId);
        if (packer && driver) return { v, d: driver, p: packer, group: v.dispatch };
      }
    }
    let vs = g.vehicles.filter((v) => here(v) && v.status === 'Idle' && v.cond >= C.wear.minCond && D.VEH[v.type].cargo.includes(o.cargoType || 'home'));
    if (preferredVehicleId) vs = vs.filter((vehicle) => vehicle.id === preferredVehicleId);
    if (!vs.length) {
      const availability = O.availability(ops ? null : o.whId);
      const summary = 'Available ' + availability.available + ' · Working ' + availability.working + ' · Returning ' + availability.returning + ' · Maintenance ' + availability.maintenance + '.';
      if (availability.returning) {
        const returning = g.vehicles.filter((vehicle) => vehicle.status === 'Returning' && vehicle.ret);
        const eta = returning.length ? Math.min(...returning.map((vehicle) => Math.max(0, vehicle.ret.dur - vehicle.ret.t))) : 0;
        return { why: 'Your vehicle is returning to the warehouse' + (eta ? ' (about ' + U.time(eta) + ')' : '') + '. It will be available when it arrives. ' + summary, availability };
      }
      if (availability.working) return { why: 'Your vehicles are assigned to active orders. ' + summary, availability };
      return { why: g.vehicles.length ? 'No vehicle is ready for a new order. Check vehicle condition or warehouse assignment. ' + summary : 'Buy a compatible vehicle in Company. The Mini Truck carries up to 10 units. ' + summary, availability };
    }
    if (!g.settings.autoDispatch && !preferredVehicleId) return { why: 'Choose a vehicle for this order in the selector below.' };
    const v = vs.filter((x) => S.vehEff(x).cap >= o.units).sort((a, b) => S.vehEff(a).cap - S.vehEff(b).cap)[0];
    if (!v) return { why: 'Load of ' + o.units + ' units needs a bigger vehicle.' };
    const free = (r) => g.employees.filter((e) => e.role === r && e.status === 'idle' && here(e)).sort((a, b) => b.skill - a.skill)[0];
    const d = free('driver'), p = free('packer');
    if (!d) return { why: 'No idle driver — hire one in Company.' };
    if (!p) return { why: 'No idle packer — hire one in Company.' };
    return { v, d, p };
  };
  O.accept = (id, preferredVehicleId) => {
    const g = G(), o = IPM.S.ord(id);
    if (!o || o.status !== 'new') return { ok: false, msg: 'Order no longer available.' };
    const r = O.resources(o, preferredVehicleId);
    if (!r.v) return { ok: false, msg: r.why };
    const du = O.dur(o, r.v, r.d, r.p), tot = du.load + du.travel + du.unload;
    let dispatch = r.group;
    if (dispatch) {
      dispatch.load = Math.max(dispatch.load, dispatch.elapsed + du.load);
      dispatch.unload = Math.max(dispatch.unload, du.unload);
      dispatch.travel = Math.max(dispatch.travel, du.travel);
      dispatch.cargoUnits += o.units;
      dispatch.orderIds.push(o.id);
    } else {
      dispatch = { id: 'D' + o.id, orderIds: [o.id], origin: o.whId, dest: o.dest, phase: 'load', elapsed: 0, load: du.load, travel: du.travel, unload: du.unload, cargoUnits: o.units };
      r.v.dispatch = dispatch;
    }
    const groupDu = { load: dispatch.load, travel: dispatch.travel, unload: dispatch.unload };
    Object.assign(o, { status: 'transit', phase: dispatch.phase, pt: dispatch.elapsed, vehicleId: r.v.id, driverId: r.d.id, packerId: r.p.id, dispatchId: dispatch.id, groupLoadStart: dispatch.elapsed, groupLoadDuration: du.load, du: groupDu, deadline: g.time + (r.group ? Math.max(0, dispatch.load - dispatch.elapsed) + dispatch.travel + dispatch.unload : tot) * D.URG[o.urg].mult, start: g.time });
    dispatch.orderIds.forEach((orderId) => {
      const order = IPM.S.ord(orderId);
      if (order) { order.du = groupDu; order.deadline = order.start + (dispatch.load + dispatch.travel + dispatch.unload) * D.URG[order.urg].mult; }
    });
    r.v.status = 'Loading'; r.v.ret = null; r.v.orderId = dispatch.orderIds[0]; r.v.driverId = r.d.id; r.d.status = 'busy'; r.d.orderId = dispatch.orderIds[0]; r.p.status = 'busy'; r.p.orderId = o.id;
    g.stats.accepted++; g.stats.bySource[o.src].orders++;
    return { ok: true, msg: r.group ? 'Order added to the vehicle load for ' + D.city(o.dest).name + '.' : r.returning ? 'Suitable return order assigned to the vehicle.' : 'Job accepted — crew is loading.', sound: 'ok' };
  };
  O.reject = (id) => {
    const o = IPM.S.ord(id);
    if (!o || o.status !== 'new') return { ok: false, msg: 'Order not available.' };
    o.status = 'rejected'; G().stats.rejected++;
    return { ok: true, msg: 'Enquiry rejected.' };
  };
  O.complete = (o) => {
    const g = G(), S = IPM.S, v = S.veh(o.vehicleId), d = S.emp(o.driverId), p = S.emp(o.packerId), st = g.stats;
    const late = g.time > o.deadline;
    const risk = Math.max(0.02, 0.12 - 0.015 * ((p ? p.skill : 3) + (d ? d.skill : 3))) * D.fx(g).damage * (IPM.W ? IPM.W.damageFactor(p) * IPM.W.drivingDamageFactor(d) : 1) + (o.eventDamageRisk || 0);
    const dmg = !!o.eventDamage || Math.random() < U.clamp(risk, 0.02, 0.8);
    let pay = o.price * (late ? C.pricing.late : 1) * (dmg ? C.pricing.damage : 1);
    const cs = v ? O.cost(o, v) : { fuel: 0, maint: 0, mat: o.mat };
    if (v && v.dispatch && v.dispatch.orderIds.length > 1) {
      const share = o.units / Math.max(1, v.dispatch.cargoUnits);
      cs.fuel = Math.round(cs.fuel * share); cs.maint = Math.round(cs.maint * share);
    }
    IPM.E.earn(pay, 'revenue', o.id + ' ' + D.city(o.whId).name + '→' + D.city(o.dest).name, o.whId);
    IPM.E.charge(cs.fuel, 'fuel', 'Fuel ' + o.id, o.whId); IPM.E.charge(cs.maint, 'maintenance', 'Vehicle upkeep ' + o.id, o.whId); IPM.E.charge(cs.mat, 'materials', 'Packing ' + o.id, o.whId);
    const R = C.rep; IPM.P.gainRep(late ? R.late : R.onTime + (o.urg === 'exp' ? R.express : 0) + (dmg ? R.damage : R.perfect));
    IPM.P.addXp(20 + pay / 250);
    st.deliveries++; late ? st.late++ : st.onTime++; if (dmg) st.damaged++;
    st.ratingSum += late ? 3 : dmg ? 4 : 5; st.ratingCount++; st.timeSum += g.time - o.start;
    const sb = st.bySource[o.src]; sb.done++; sb.revenue += Math.round(pay);
    const rk = o.whId + '>' + o.dest; st.routes[rk] = (st.routes[rk] || 0) + Math.round(pay - cs.fuel - cs.maint - cs.mat); st.dest[o.dest] = (st.dest[o.dest] || 0) + 1; st.origin[o.whId] = (st.origin[o.whId] || 0) + 1;
    const wh = S.wh(o.whId); if (wh) { wh.stats.delivered++; wh.stats.revenue += Math.round(pay); wh.cond = Math.max(0, wh.cond - C.wh.condPerJob); }
    if (!g.customers.some((c) => c === o.cust) && g.customers.length < 40) g.customers.push(o.cust);
    if (p) { p.status = 'idle'; p.orderId = ''; p.exp += 10; }
    if (d) d.exp += 10;
    if (v) {
      if (!v.dispatch || !v.dispatch.wearApplied) {
        v.trips++;
        v.cond = Math.max(0, v.cond - (C.wear.base + o.dist * C.wear.perKm) * S.vehEff(v).wear * D.fx(g).wear);
        if (v.dispatch) v.dispatch.wearApplied = true;
      }
      v.earned += Math.round(pay);
      if (!v.dispatch) {
        v.whId = o.dest;
        O.free(v);
      }
    }
    o.status = 'completed'; o.paid = Math.round(pay); o.late = late; o.damaged = dmg;
    note((late ? 'Late delivery ' : 'Delivered ') + o.id + ' to ' + D.city(o.dest).name + ': ' + U.money(pay), late ? 'warn' : 'good', { sound: 'ok' });
  };
  O.free = (v) => { const d = IPM.S.emp(v.driverId); if (d && d.status === 'busy') { d.status = 'idle'; d.orderId = ''; } v.status = 'Idle'; v.orderId = ''; v.driverId = ''; v.ret = null; v.dispatch = null; };

  O.dispatchComplete = (v, dispatch) => {
    const orders = dispatch.orderIds.map((id) => IPM.S.ord(id)).filter((o) => o && o.status === 'transit');
    orders.forEach(O.complete);
    v.dispatch = null;
    if (!orders.length) { O.free(v); return; }
    const destination = dispatch.dest;
    v.whId = destination;
    O.free(v);
  };

  O.tick = (dt, off) => {
    const g = G(), S = IPM.S;
    // spawn enquiries
    (off ? [] : g.warehouses).forEach((wh) => {
      const city = D.city(wh.id), ws = S.whStats(wh);
      let pend = g.orders.filter((o) => o.status === 'new' && o.whId === wh.id).length;
      if (pend >= ws.pendingCap) return;
      Object.keys(C.demand.rates).forEach((ch) => {
        if (pend >= ws.pendingCap) return;
        if (!srcOpen(ch)) return;
        const crews = g.employees.filter((e) => e.whId === wh.id && (e.role === 'driver' || e.role === 'packer') && e.status !== 'training' && e.status !== 'absent').length;
        const localVehicles = g.vehicles.filter((v) => v.whId === wh.id && v.status !== 'Maintenance').length;
        const capacityFactor = 0.55 + 0.12 * Math.min(3, localVehicles) + 0.08 * Math.min(2, crews);
        const queueFactor = Math.max(0.2, 1 - (pend / ws.pendingCap) * 0.7);
        const eventDemand = IPM.Events ? IPM.Events.demandMultiplier(city.id) : 1;
        let r = C.demand.rates[ch] * city.demand * IPM.M.mult(wh, ch) * eventDemand * capacityFactor * queueFactor * (1 + Math.min(C.demand.repCap, g.rep * C.demand.repPer)) * (1 + C.demand.levelBonus * (g.level - 1)) * (1 + C.wh.reachPerUpg * wh.upg.reach);
        if (ch === 'walk') r *= 1 + C.wh.walkPerLevel * (wh.level - 1);
        if (Math.random() < r * dt) { const o = O.gen(wh, ch); if (o) { g.orders.push(o); g.lastOrderAt = g.time; pend++; if (IPM.M.recordLead) IPM.M.recordLead(wh, ch); note('New ' + D.SOURCES[ch].label.toLowerCase() + ' enquiry: ' + D.city(o.dest).name + ' (' + D.SIZES[o.size].label + ')', 'info', { sound: 'ring' }); } }
      });
    });
    g.orderTick += dt;
    if (!off && !g.stats.deliveries && !g.orders.length && g.orderTick > 4) { const o = O.gen(g.warehouses[0], 'phone'); if (o) { o.size = 'room'; o.units = 4; g.orders.push(o); g.lastOrderAt = g.time; } }
    const hasOpenWork = g.orders.some((o) => o.status === 'new' || o.status === 'transit');
    if (!off && !hasOpenWork && g.warehouses.length && g.time - (g.lastOrderAt || 0) >= 30) {
      const origin = g.warehouses.find((wh) => g.vehicles.some((v) => v.whId === wh.id && v.status === 'Idle' && v.cond >= C.wear.minCond) && g.employees.some((e) => e.whId === wh.id && e.role === 'driver' && e.status === 'idle') && g.employees.some((e) => e.whId === wh.id && e.role === 'packer' && e.status === 'idle')) || g.warehouses[0];
      const o = O.gen(origin, 'phone');
      if (o) {
        g.orders.push(o); g.lastOrderAt = g.time;
        note('A new moving enquiry is waiting at ' + D.city(origin.id).name + '.', 'info', { sound: 'ring', toast: true });
      }
    }
    // expire / auto-accept
    g.orders.forEach((o) => {
      if (off || o.status !== 'new') return;
      const wh = S.wh(o.whId), mgr = wh && S.whStats(wh).manager;
      if (mgr && wh.mgr.autoAccept && (o.urg !== 'exp' || wh.mgr.express) && g.cash >= wh.mgr.keepCash) {
        const r = O.resources(o), est = r.v ? o.price - (function (c) { return c.fuel + c.maint + c.mat; })(O.cost(o, r.v)) : 0;
        const managerSkill = wh.crewLevels && wh.crewLevels.manager || 0;
        if (r.v && est >= wh.mgr.minProfit && o.dist <= wh.mgr.maxDist * (1 + Math.min(0.4, 0.02 * Math.max(0, mgr.level - 1) + 0.08 * managerSkill))) { O.accept(o.id); return; }
      }
      if (g.time > o.expire) { o.status = 'expired'; g.stats.expired++; P_rep(C.rep.expired); }
    });
    // progress deliveries
    g.vehicles.filter((vehicle) => vehicle.dispatch).forEach((vehicle) => {
      const dispatch = vehicle.dispatch, duration = dispatch[dispatch.phase];
      dispatch.elapsed += dt;
      dispatch.orderIds.forEach((id) => { const order = IPM.S.ord(id); if (order && active(order)) { order.phase = dispatch.phase; order.pt = Math.min(dispatch.elapsed, duration); order.du = { load: dispatch.load, travel: dispatch.travel, unload: dispatch.unload }; } });
      if (dispatch.elapsed < duration) return;
      if (dispatch.phase === 'load') { dispatch.phase = 'travel'; vehicle.status = 'In Transit'; }
      else if (dispatch.phase === 'travel') { dispatch.phase = 'unload'; vehicle.status = 'Unloading'; }
      else { O.dispatchComplete(vehicle, dispatch); return; }
      dispatch.elapsed = 0;
      dispatch.orderIds.forEach((id) => { const order = IPM.S.ord(id); if (order && active(order)) { order.phase = dispatch.phase; order.pt = 0; } });
    });
    g.orders.filter((o) => active(o) && !(IPM.S.veh(o.vehicleId) || {}).dispatch).forEach((o) => {
      const v = S.veh(o.vehicleId); if (!v) return;
      o.pt += dt; const ph = o.phase;
      if (o.pt >= o.du[ph]) {
        o.pt = 0;
        if (ph === 'load') { o.phase = 'travel'; v.status = 'In Transit'; }
        else if (ph === 'travel') { o.phase = 'unload'; v.status = 'Unloading'; }
        else O.complete(o);
      }
    });
    g.vehicles.forEach((v) => {
      if (v.status === 'Returning' && v.ret) { v.ret.t += dt; if (v.ret.t >= v.ret.dur) { v.whId = v.ret.from || v.whId; O.free(v); note(v.name + ' is waiting at ' + D.city(v.whId).name + ' for a job.', 'info'); } }
      else if (v.status === 'Maintenance') { v.maintT += dt; if (v.maintT >= v.maintDur) { v.status = 'Idle'; v.cond = 100; v.maintT = 0; } }
      else if (v.status === 'Idle') { const wh = S.wh(v.whId), m = wh && S.whStats(wh).manager; if (m && wh.mgr.autoRepair && v.cond < 60 && g.cash - IPM.F.repairCost(v) > wh.mgr.keepCash) IPM.F.repair(v.id); }
    });
    g.orders = g.orders.filter((o) => active(o) || o.status === 'new' || g.time - (o.start || o.born) < 600 || o.status === 'accepted').slice(-120);
  };
  const P_rep = (n) => IPM.P.gainRep(n);
  O.remaining = (o) => {
    const v = o && IPM.S.veh(o.vehicleId), dispatch = v && v.dispatch;
    if (dispatch && o.dispatchId === dispatch.id) return Math.max(0, dispatch[dispatch.phase] - dispatch.elapsed);
    return Math.max(0, (o && o.du && o.du[o.phase] || 0) - (o && o.pt || 0));
  };
  O.progress = (o) => {
    if (!o || o.status !== 'transit') return 0;
    const v = IPM.S.veh(o.vehicleId), dispatch = v && v.dispatch;
    if (dispatch && o.dispatchId === dispatch.id) {
      if (dispatch.phase === 'load' && o.groupLoadDuration) return U.clamp((dispatch.elapsed - o.groupLoadStart) / o.groupLoadDuration, 0, 1);
      const duration = dispatch[dispatch.phase];
      return duration > 0 ? U.clamp(dispatch.elapsed / duration, 0, 1) : 0;
    }
    const duration = o.du && o.du[o.phase];
    return duration > 0 ? U.clamp((o.pt || 0) / duration, 0, 1) : 0;
  };
})();
