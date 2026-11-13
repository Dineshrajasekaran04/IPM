/* events.js — condition-based company events and their saved effects */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, E = (IPM.Events = {}), G = () => IPM.S.cur;
  const state = () => {
    const g = G();
    if (!g.eventState) g.eventState = { rollAcc: 0, lastAt: -999, lastByType: {}, pending: null, festival: null, supplierDiscountUntil: 0, supplierDiscount: 0, history: [] };
    return g.eventState;
  };
  const city = (id) => D.city(id) ? D.city(id).name : id;
  const travelVehicles = () => G().vehicles.filter((v) => ['Loading', 'In Transit', 'Unloading', 'Returning'].includes(v.status));
  const travellingOrders = () => G().orders.filter((o) => o.status === 'transit' && o.phase === 'travel');
  const conditions = {
    completed: () => G().orders.some((o) => o.status === 'completed' && !o.eventChecked),
    warehouse: () => G().warehouses.length > 0,
    company: () => !!G().company,
    travelling_vehicle: () => travelVehicles().length > 0,
    idle_vehicle: () => G().vehicles.some((v) => v.status === 'Idle' && v.cond >= D.CONFIG.wear.minCond),
    active_route: () => travellingOrders().length > 0 || G().vehicles.some((v) => v.status === 'Returning' && v.ret),
    fragile_packing: () => G().orders.some((o) => o.status === 'transit' && o.phase === 'load' && o.fragile > 0 && !o.eventDamage && !o.eventDamageRisk),
    staff_surplus: () => G().employees.filter((e) => ['packer', 'driver'].includes(e.role) && e.status === 'idle').length > 2,
    reputation_milestone: () => G().rep >= 10 && !state().reputationRewarded,
  };

  E.discount = (category) => {
    const s = state();
    return G().time < s.supplierDiscountUntil && ['vehicle', 'repairs'].includes(category) ? s.supplierDiscount : 0;
  };
  E.demandMultiplier = (cityId) => {
    const festival = state().festival;
    if (!festival || G().time >= festival.end) return 1;
    return festival.cityId === cityId ? festival.multiplier : 1;
  };
  E.fuelMultiplier = () => {
    const s = state();
    return G().time < (s.fuelIncreaseUntil || 0) ? (s.fuelIncrease || 1) : 1;
  };
  E.present = () => {
    const s = state();
    if (s.pending && IPM.UI && !IPM.UI.modalOpen()) IPM.UI.showEvent(s.pending);
  };

  const eligible = (def) => {
    const g = G(), s = state(), last = s.lastByType[def.id] || -999;
    if (g.time - last < D.EVENTS.repeatSec) return false;
    if (def.minDeliveries && g.stats.deliveries < def.minDeliveries) return false;
    if (!conditions[def.condition] || !conditions[def.condition]()) return false;
    if (def.kind === 'demand' && s.festival && g.time < s.festival.end) return false;
    if (def.kind === 'discount' && g.time < s.supplierDiscountUntil) return false;
    if (def.kind === 'fuel-price' && g.time < (s.fuelIncreaseUntil || 0)) return false;
    if (def.kind === 'travel-fine' && g.cash < def.fine[1]) return false;
    return true;
  };

  const makePending = (def, message, impact, extra) => {
    const s = state(), event = Object.assign({ id: def.id, kind: def.kind, title: def.name, tone: def.tone, message: message || def.msg || '', impact: impact || '', fine: 0 }, extra || {});
    if (!event.decision) event.decision = 'event-response';
    s.lastAt = G().time;
    s.lastByType[def.id] = G().time;
    s.history.unshift({ id: def.id, title: event.title, t: G().time, impact: event.impact });
    s.history.length = Math.min(20, s.history.length);
    s.pending = event;
    E.present();
  };
  const apply = (def) => {
    const g = G(), s = state();
    if (def.kind === 'delivery') {
      const order = g.orders.find((o) => o.status === 'completed' && !o.eventChecked);
      if (!order) return false;
      order.eventChecked = true;
      const amount = U.randInt(def.reward[0], def.reward[1]);
      IPM.E.earn(amount, 'revenue', def.name + ' tip', order.whId);
      if (!order.late && !order.damaged) IPM.P.gainRep(0.15);
      return { message: def.msg, impact: 'Company cash +' + U.money(amount) + (!order.late && !order.damaged ? ' · reputation +0.15' : '') };
    }
    if (def.kind === 'demand') {
      const wh = U.pick(g.warehouses);
      s.festival = { cityId: wh.id, end: g.time + def.duration, multiplier: def.multiplier };
      return { message: def.msg, impact: city(wh.id) + ' demand +' + Math.round((def.multiplier - 1) * 100) + '% for ' + U.time(def.duration) };
    }
    if (def.kind === 'discount') {
      s.supplierDiscount = def.discount; s.supplierDiscountUntil = g.time + def.duration;
      return { message: def.msg, impact: 'Vehicle purchases and repairs -' + Math.round(def.discount * 100) + '% for ' + U.time(def.duration) };
    }
    if (def.kind === 'reward') {
      const amount = U.randInt(def.reward[0], def.reward[1]);
      IPM.E.earn(amount, 'revenue', def.name);
      return { message: def.msg, impact: 'Company cash +' + U.money(amount) };
    }
    if (def.kind === 'rep-reward') {
      s.reputationRewarded = true;
      IPM.E.earn(def.reward, 'revenue', def.name);
      return { message: def.msg, impact: 'Company cash +' + U.money(def.reward) };
    }
    if (def.kind === 'fuel-price') {
      s.fuelIncrease = def.multiplier; s.fuelIncreaseUntil = g.time + def.duration;
      return { message: def.msg, impact: 'Route fuel costs +' + Math.round((def.multiplier - 1) * 100) + '% for ' + U.time(def.duration) };
    }
    if (def.kind === 'accident') {
      const v = U.pick(g.vehicles.filter((vehicle) => vehicle.status === 'Idle' && vehicle.cond >= D.CONFIG.wear.minCond));
      if (!v) return false;
      v.cond = Math.min(v.cond, Math.max(0, D.CONFIG.wear.minCond - 1));
      IPM.P.gainRep(-0.25);
      return { message: v.name + ' was damaged in a road accident and has been taken off the available fleet.', impact: 'Condition reduced to ' + Math.round(v.cond) + '% · reputation -0.25. Choose an immediate or standard repair.', extra: { decision: 'accident', vehicleId: v.id } };
    }
    if (def.kind === 'travel-fine') {
      const v = U.pick(travelVehicles()), fine = U.randInt(def.fine[0], def.fine[1]);
      const paid = IPM.E.charge(fine, 'repairs', 'Traffic police challan', v.whId);
      return { message: 'Traffic police issued a challan to ' + v.name + ' during its journey.', impact: 'Fine paid ' + U.money(paid) };
    }
    if (def.kind === 'vehicle-repair') {
      const v = U.pick(travelVehicles()), cost = U.randInt(def.cost[0], def.cost[1]);
      const paid = IPM.E.charge(cost, 'repairs', 'Roadside puncture service', v.whId);
      v.cond = Math.max(0, v.cond - def.conditionLoss);
      return { message: 'A tyre puncture slowed ' + v.name + ' on its route.', impact: 'Repair paid ' + U.money(paid) + ' · vehicle condition -' + def.conditionLoss + '%' };
    }
    if (def.kind === 'delay') {
      const delay = U.randInt(def.delay[0], def.delay[1]), orders = travellingOrders();
      if (orders.length) {
        const order = U.pick(orders); order.du.travel += delay;
        return { message: 'Traffic is heavier than expected on an active route.', impact: order.id + ' travel time +' + U.time(delay) };
      }
      const v = U.pick(g.vehicles.filter((item) => item.status === 'Returning' && item.ret));
      if (v) { v.ret.dur += delay; return { message: 'Traffic is heavier than expected on the return route.', impact: v.name + ' return ETA +' + U.time(delay) }; }
      return false;
    }
    if (def.kind === 'damage') {
      const orders = g.orders.filter((o) => o.status === 'transit' && o.phase === 'load' && o.fragile > 0 && !o.eventDamage && !o.eventDamageRisk);
      if (!orders.length) return false;
      const order = U.pick(orders); order.eventDamage = true;
      const compensation = U.randInt(250, 650);
      IPM.E.charge(compensation, 'compensation', 'Package damage compensation', order.whId);
      return { message: def.msg, impact: order.id + ' · compensation paid ' + U.money(compensation) + ' · delivery reputation will reflect the damage' };
    }
    if (def.kind === 'injury') {
      const staff = U.pick(g.employees.filter((e) => ['packer', 'driver'].includes(e.role) && e.status === 'idle'));
      if (!staff) return false;
      staff.status = 'absent'; staff.absentT = def.duration;
      const medical = U.randInt(300, 700);
      IPM.E.charge(medical, 'medical', 'Worker injury treatment', staff.whId);
      IPM.P.gainRep(-0.2);
      return { message: 'A workplace injury has temporarily sidelined a team member.', impact: 'Medical costs ' + U.money(medical) + ' · unavailable for ' + U.time(def.duration) + ' · reputation -0.2' };
    }
    if (def.kind === 'absence') {
      const staff = U.pick(g.employees.filter((e) => ['packer', 'driver'].includes(e.role) && e.status === 'idle'));
      if (!staff) return false;
      staff.status = 'absent'; staff.absentT = def.duration;
      return { message: staff.name + ' is away from work unexpectedly.', impact: staff.name + ' unavailable for ' + U.time(def.duration) };
    }
    if (def.kind === 'notice') return { message: def.msg, impact: 'No changes to cash, order demand, delivery times or reputation.' };
    return false;
  };

  E.tick = (dt) => {
    const g = G(), s = state();
    if (s.pending) { E.present(); return; }
    if (s.festival && g.time >= s.festival.end) s.festival = null;
    s.rollAcc += dt;
    if (s.rollAcc < D.EVENTS.rollSec || g.time - s.lastAt < D.EVENTS.cooldownSec) return;
    s.rollAcc -= D.EVENTS.rollSec;
    const completed = g.orders.find((o) => o.status === 'completed' && !o.eventChecked);
    let pool = D.EVENTS.events.filter((def) => eligible(def));
    if (completed) {
      const deliveryEvents = pool.filter((def) => def.kind === 'delivery');
      if (deliveryEvents.length && Math.random() < 0.2) pool = deliveryEvents;
      else { completed.eventChecked = true; pool = pool.filter((def) => def.kind !== 'delivery'); }
    } else pool = pool.filter((def) => def.kind !== 'delivery');
    if (!pool.length || Math.random() >= D.EVENTS.chance) return;
    const def = U.weighted(pool.reduce((weights, item) => { weights[item.id] = item.weight; return weights; }, {}));
    const eventDef = pool.find((item) => item.id === def), result = apply(eventDef);
    if (!result) return;
    makePending(eventDef, result.message, result.impact, result.extra || null);
  };

  E.acknowledge = (payFine) => {
    const s = state(), pending = s.pending;
    if (!pending) return;
    let message = 'Event acknowledged.';
    if (pending.decision === 'accident') {
      const vehicle = IPM.S.veh(pending.vehicleId);
      if (!vehicle) message = 'The damaged vehicle is no longer in the fleet.';
      else if (payFine === 'later') message = 'The damaged vehicle remains parked until the company can repair it.';
      else {
        const result = vehicle && IPM.F.repair(vehicle.id, !!payFine);
        if (!result || !result.ok) { IPM.UI.note(result ? result.msg : 'The damaged vehicle is no longer available.', 'bad'); return; }
        message = result.msg;
      }
    }
    if (payFine === 'recover' && pending.decision === 'event-response') {
      const cost = 500;
      if (G().cash < cost) return;
      IPM.E.spend(cost, 'repairs', 'Customer-care follow-up: ' + pending.title);
      IPM.P.gainRep(0.25);
      message = 'Service recovery approved for ' + U.money(cost) + '. Reputation +0.25.';
    } else if (pending.decision === 'event-response') message = 'You accepted the event outcome.';
    if (pending.fine) {
      if (!payFine) return;
      const vehicle = IPM.S.veh(pending.vehicleId), paid = IPM.E.charge(pending.fine, 'repairs', 'Traffic police challan', vehicle && vehicle.whId);
      message = 'Traffic challan paid: ' + U.money(paid) + ' deducted from company cash.';
      pending.impact = 'Fine paid ' + U.money(paid);
    }
    s.pending = null;
    IPM.UI.close(); IPM.UI.note(message, 'info'); IPM.UI.render(); IPM.V.save();
  };
})();
