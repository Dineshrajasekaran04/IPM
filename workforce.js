/* workforce.js — candidates, hiring, training, promotion, reassignment, managers */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur;
  const W = (IPM.W = {});
  const cityName = (id) => (D.city(id) ? D.city(id).name : id);
  const short = (n) => 'Not enough cash — short by ' + U.money(IPM.E.short(n)) + '.';
  const MGR = ['whManager', 'opsManager'];
  W.isManager = (role) => MGR.indexOf(role) >= 0;

  W.gen = (role) => {
    const g = G(), r = D.ROLES[role];
    const skill = W.isManager(role) ? U.randInt(4, 8) : role === 'supervisor' ? U.randInt(3, 7) : U.randInt(2, 6);
    const f = (skill - 1) / 9;
    return {
      id: 'K' + IPM.S.id(g, 'cand'), name: U.person(), skill,
      wage: U.round(r.wage[0] + (r.wage[1] - r.wage[0]) * f + U.rand(-20, 20), 10),
      recruit: U.round(r.recruit * (0.7 + skill * 0.08), 100),
    };
  };
  W.cands = (role) => {
    const g = G();
    g.candidates[role] = g.candidates[role] || [];
    while (g.candidates[role].length < 3) g.candidates[role].push(W.gen(role));
    return g.candidates[role];
  };
  W.refresh = (role) => {
    const g = G();
    if (!IPM.E.spend(C.train.refreshCost, 'hiring', 'Candidate search: ' + D.ROLES[role].label)) return { ok: false, msg: short(C.train.refreshCost) };
    g.candidates[role] = [];
    W.cands(role);
    return { ok: true, msg: 'New ' + D.ROLES[role].label.toLowerCase() + ' candidates found.' };
  };

  W.hire = (role, candId, whId) => {
    const g = G(), S = IPM.S, r = D.ROLES[role];
    if (!r) return { ok: false, msg: 'Unknown role.' };
    if (!IPM.P.reqOk(r.req)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(r.req) };
    const list = W.cands(role);
    const cand = list.find((c) => c.id === candId);
    if (!cand) return { ok: false, msg: 'Candidate is no longer available.' };
    if (role === 'opsManager') {
      if (S.opsManager()) return { ok: false, msg: 'You already employ an Operations Manager.' };
      whId = '';
    } else {
      const wh = S.wh(whId);
      if (!wh) return { ok: false, msg: 'Choose a warehouse for this hire.' };
      const ws = S.whStats(wh);
      if (role === 'whManager' && ws.manager) return { ok: false, msg: cityName(whId) + ' already has a manager.' };
      if (!W.isManager(role) && ws.staffCount >= ws.staffSlots) return { ok: false, msg: cityName(whId) + ' staff slots are full (' + ws.staffCount + '/' + ws.staffSlots + '). Upgrade the warehouse level.' };
    }
    if (!IPM.E.spend(cand.recruit, 'hiring', 'Hired ' + cand.name + ' (' + r.label + ')', whId)) return { ok: false, msg: short(cand.recruit) };
    g.employees.push(S.mkEmployee(g, role, whId, { name: cand.name, skill: cand.skill, wage: cand.wage }));
    g.candidates[role] = list.filter((c) => c.id !== candId);
    return { ok: true, msg: cand.name + ' joined as ' + r.label + '.', sound: 'buy' };
  };

  const mult = { packer: 1, driver: 1, supervisor: 2, whManager: 3, opsManager: 4 };
  W.trainCost = (e) => U.round(C.train.costBase * Math.pow(C.train.costScale, e.level - 1) * mult[e.role], 100);
  const level = (e) => Math.max(0, (e && e.level || 1) - 1);
  W.packingFactor = (e) => e && e.role === 'packer' ? Math.max(0.72, 1 - 0.025 * level(e)) : 1;
  W.drivingFactor = (e) => e && e.role === 'driver' ? Math.max(0.84, 1 - 0.018 * level(e)) : 1;
  W.crewUpgradeCost = (wh, role) => Math.round((role === 'manager' ? 50000 : role === 'driver' ? 30000 : 25000) * Math.pow(2.4, wh.crewLevels[role]));
  W.crewUpgrade = (whId, role) => {
    const wh = IPM.S.wh(whId), allowed = ['packer', 'driver', 'manager'];
    if (!wh || !allowed.includes(role)) return { ok: false, msg: 'Choose a warehouse role to improve.' };
    wh.crewLevels = Object.assign({ packer: 0, driver: 0, manager: 0 }, wh.crewLevels || {});
    if (wh.crewLevels[role] >= 5) return { ok: false, msg: 'This role is already at level 5.' };
    if (role === 'manager' && !IPM.S.whStats(wh).manager) return { ok: false, msg: 'Hire a warehouse manager before improving manager instructions.' };
    if (role !== 'manager' && !G().employees.some((employee) => employee.whId === whId && employee.role === role)) return { ok: false, msg: 'Assign a ' + role + ' to this warehouse first.' };
    const cost = W.crewUpgradeCost(wh, role);
    if (!IPM.E.spend(cost, 'training', role[0].toUpperCase() + role.slice(1) + ' team improvement · ' + cityName(whId), whId)) return { ok: false, msg: short(cost) };
    wh.crewLevels[role]++;
    return { ok: true, msg: cityName(whId) + ' ' + role + ' team improved to level ' + wh.crewLevels[role] + '/5.', sound: 'buy' };
  };
  W.supervisorFactor = (e) => e && e.role === 'supervisor' ? Math.max(0.88, 1 - 0.012 * level(e)) : 1;
  W.operationsFactor = (e) => IPM.S.opsActive() && e && e.role === 'opsManager' ? Math.max(0.88, 1 - 0.012 * level(e)) : 1;
  W.damageFactor = (e) => e && e.role === 'packer' ? Math.max(0.7, 1 - 0.035 * level(e)) : 1;
  W.drivingDamageFactor = (e) => e && e.role === 'driver' ? Math.max(0.78, 1 - 0.025 * level(e)) : 1;
  W.trainingBenefit = (e, next) => {
    const n = Math.max(0, (next ? e.level : e.level - 1));
    const pct = (x) => Math.round(x * 100) + '%';
    if (e.role === 'packer') return 'Packing time -' + pct(Math.min(0.28, n * 0.025)) + ' · damage risk -' + pct(Math.min(0.3, n * 0.035));
    if (e.role === 'driver') return 'Travel time -' + pct(Math.min(0.16, n * 0.018)) + ' · damage risk -' + pct(Math.min(0.22, n * 0.025));
    if (e.role === 'supervisor') return 'Crew loading time -' + pct(Math.min(0.12, n * 0.012));
    if (e.role === 'whManager') return 'Auto-dispatch range +' + pct(Math.min(0.4, n * 0.02));
    return 'Cross-warehouse travel time -' + pct(Math.min(0.12, n * 0.012));
  };
  W.train = (id) => {
    const e = IPM.S.emp(id);
    if (!e) return { ok: false, msg: 'Employee not found.' };
    if (e.status !== 'idle') return { ok: false, msg: e.name + ' is busy right now.' };
    if (e.level >= C.train.maxLevel) return { ok: false, msg: e.name + ' is fully trained.' };
    const cost = W.trainCost(e);
    if (!IPM.E.spend(cost, 'training', 'Training: ' + e.name, e.whId)) return { ok: false, msg: short(cost) };
    e.status = 'training'; e.trainT = 0; e.trainDur = C.train.secPerLevel * e.level;
    return { ok: true, msg: e.name + ' started training (' + e.trainDur + 's).', sound: 'buy' };
  };

  W.trainSummary = (ids) => {
    const selected = Array.from(new Set(ids || [])).map((id) => IPM.S.emp(id)).filter(Boolean);
    const eligible = selected.filter((e) => e.status === 'idle' && e.level < C.train.maxLevel);
    const excluded = selected.filter((e) => !eligible.includes(e)).map((e) => ({
      employee: e,
      reason: e.status !== 'idle' ? e.status === 'training' ? 'Already training' : e.status === 'busy' ? 'Assigned to an active job' : e.status === 'absent' ? 'Away from work' : 'Unavailable' : 'Maximum training level reached',
    }));
    const items = eligible.map((e) => ({ employee: e, cost: W.trainCost(e), duration: C.train.secPerLevel * e.level }));
    return { eligible: items, excluded, totalCost: items.reduce((sum, item) => sum + item.cost, 0), duration: items.reduce((max, item) => Math.max(max, item.duration), 0) };
  };
  W.trainMany = (ids) => {
    const summary = W.trainSummary(ids), g = G();
    if (!summary.eligible.length) return { ok: false, msg: 'No selected employees are available for training.' };
    if (!IPM.E.spend(summary.totalCost, 'training', 'Bulk employee training (' + summary.eligible.length + ')')) return { ok: false, msg: short(summary.totalCost) };
    summary.eligible.forEach(({ employee }) => {
      employee.status = 'training'; employee.trainT = 0; employee.trainDur = C.train.secPerLevel * employee.level;
    });
    return { ok: true, msg: summary.eligible.length + ' employees started training. Longest training period: ' + summary.duration + 's.', sound: 'buy' };
  };

  W.dismissSummary = (ids) => {
    const selected = Array.from(new Set(ids || [])).map((id) => IPM.S.emp(id)).filter(Boolean);
    const eligible = selected.filter((e) => e.status === 'idle');
    const excluded = selected.filter((e) => e.status !== 'idle').map((e) => ({
      employee: e,
      reason: e.status === 'training' ? 'Training in progress' : e.status === 'busy' ? 'Assigned to an active job' : e.status === 'absent' ? 'Away from work' : 'Unavailable',
    }));
    return { eligible, excluded, savingsPerCycle: eligible.reduce((sum, e) => sum + e.wage, 0) };
  };
  W.dismissMany = (ids) => {
    const summary = W.dismissSummary(ids), g = G();
    if (!summary.eligible.length) return { ok: false, msg: 'No selected employees are available for dismissal.' };
    const dismissed = new Set(summary.eligible.map((e) => e.id));
    g.employees = g.employees.filter((e) => !dismissed.has(e.id));
    return { ok: true, msg: summary.eligible.length + ' employees dismissed. Payroll reduced by ' + U.money(summary.savingsPerCycle) + ' per pay cycle.' };
  };

  W.canPromote = (e) => (e.role === 'packer' || e.role === 'driver') && e.level >= C.train.promoteMinLevel;
  W.promote = (id) => {
    const e = IPM.S.emp(id);
    if (!e || !W.canPromote(e)) return { ok: false, msg: 'Needs level ' + C.train.promoteMinLevel + ' packer or driver.' };
    if (!IPM.P.reqOk(D.ROLES.supervisor.req)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(D.ROLES.supervisor.req) };
    if (e.status !== 'idle') return { ok: false, msg: e.name + ' is busy right now.' };
    if (!IPM.E.spend(C.train.promoteCost, 'training', 'Promotion: ' + e.name, e.whId)) return { ok: false, msg: short(C.train.promoteCost) };
    e.role = 'supervisor'; e.wage = U.round(e.wage * 1.5, 10);
    return { ok: true, msg: e.name + ' promoted to Supervisor.', sound: 'buy' };
  };

  W.reassign = (id, whId) => {
    const S = IPM.S, e = S.emp(id), wh = S.wh(whId);
    if (!e || !wh) return { ok: false, msg: 'Invalid reassignment.' };
    if (e.role === 'opsManager') return { ok: false, msg: 'The Operations Manager works across all warehouses.' };
    if (e.status !== 'idle') return { ok: false, msg: e.name + ' is busy right now.' };
    if (e.whId === whId) return { ok: false, msg: 'Already assigned there.' };
    const ws = S.whStats(wh);
    if (e.role === 'whManager' && ws.manager) return { ok: false, msg: cityName(whId) + ' already has a manager.' };
    if (!W.isManager(e.role) && ws.staffCount >= ws.staffSlots) return { ok: false, msg: cityName(whId) + ' staff slots are full.' };
    e.whId = whId;
    return { ok: true, msg: e.name + ' moved to ' + cityName(whId) + '.' };
  };

  W.dismiss = (id) => {
    const g = G(), e = IPM.S.emp(id);
    if (!e) return { ok: false, msg: 'Employee not found.' };
    if (e.status !== 'idle') return { ok: false, msg: e.name + ' is busy — wait until they are idle.' };
    g.employees = g.employees.filter((x) => x.id !== id);
    return { ok: true, msg: e.name + ' left the company.' };
  };

  W.setRule = (whId, key, val) => {
    const wh = IPM.S.wh(whId);
    if (!wh) return;
    const m = wh.mgr;
    if (key === 'autoAccept' || key === 'express' || key === 'autoRepair') m[key] = !m[key];
    else if (key === 'minProfit') m.minProfit = U.clamp(m.minProfit + val, 0, 10000);
    else if (key === 'maxDist') m.maxDist = U.clamp(m.maxDist + val, 50, 800);
    else if (key === 'keepCash') m.keepCash = U.clamp(m.keepCash + val, 0, 100000);
  };

  W.efficiency = (e) => 0.8 + (0.2 * e.morale) / 100;

  W.tick = (dt) => {
    const g = G();
    g.employees.forEach((e) => {
      if (e.status === 'training') {
        e.trainT += dt;
        if (e.trainT >= e.trainDur) {
          e.status = 'idle'; e.trainT = 0; e.trainDur = 0; e.level++; e.skill = Math.min(10, e.skill + 1);
          e.wage = U.round(e.wage * C.train.wageGrowth, 10);
          IPM.UI && IPM.UI.note(e.name + ' finished training (level ' + e.level + ').', 'good');
        }
      } else if (e.status === 'absent') {
        e.absentT = Math.max(0, (e.absentT || 0) - dt);
        if (!e.absentT) { e.status = 'idle'; IPM.UI && IPM.UI.note(e.name + ' returned to work.', 'good'); }
      } else if (g.fin.wagesOwed <= 0 && e.morale < 80) e.morale = Math.min(80, e.morale + 0.1 * dt);
    });
  };
})();
