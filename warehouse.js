/* warehouse.js — expansion, level/upgrades, repair, manager rules, research tab (extends UI via hooks) */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG, S = IPM.S, E = IPM.E, UI = IPM.UI, WH = (IPM.WH = {});
  const short = (n) => 'Not enough cash — short by ' + U.money(E.short(n)) + '.';
  WH.openCost = (c) => U.round(c.cost * 1.6 * D.fx(S.cur).whCost, 100);
  WH.open = (id) => {
    const g = S.cur, c = D.city(id);
    if (!c || S.owns(id)) return { ok: false, msg: 'Already owned or unknown.' };
    const req = { level: c.minLevel, rep: c.minRep };
    if (!IPM.P.reqOk(req)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(req) };
    const cost = WH.openCost(c);
    if (cost >= C.confirmAbove && !window.confirm('Open ' + c.name + ' warehouse for ' + U.money(cost) + '?')) return { ok: false, msg: 'Cancelled.' };
    if (!E.spend(cost, 'warehouse', 'Opened ' + c.name + ' warehouse', id)) return { ok: false, msg: short(cost) };
    const w = S.newWarehouse(id); w.openedAt = Math.max(1, g.time); g.warehouses.push(w); IPM.P.addXp(60);
    return { ok: true, msg: c.name + ' warehouse opened!', sound: 'buy' };
  };
  WH.levelCost = (w) => C.wh.levelCost[w.level];
  WH.levelUp = (id) => {
    const w = S.wh(id); if (!w || w.level >= C.wh.maxLevel) return { ok: false, msg: 'Max warehouse level.' };
    const c = WH.levelCost(w); if (!E.spend(c, 'warehouse', 'Upgrade ' + D.city(id).name + ' to level ' + (w.level + 1), id)) return { ok: false, msg: short(c) };
    w.level++; IPM.P.addXp(40); return { ok: true, msg: D.city(id).name + ' warehouse is now level ' + w.level + '.', sound: 'buy' };
  };
  WH.upgCost = (w, k) => U.round(D.WH_UPG[k].base * Math.pow(D.WH_UPG[k].mult, w.upg[k]), 100);
  WH.upg = (id, k) => {
    const w = S.wh(id), d = D.WH_UPG[k]; if (!w || !d) return { ok: false, msg: 'Invalid upgrade.' };
    if (w.upg[k] >= d.max) return { ok: false, msg: 'Already at max level.' };
    const c = WH.upgCost(w, k); if (!E.spend(c, 'warehouse', d.label + ' (' + D.city(id).name + ')', id)) return { ok: false, msg: short(c) };
    w.upg[k]++; IPM.P.addXp(15); return { ok: true, msg: d.label + ' upgraded to level ' + w.upg[k] + '.', sound: 'buy' };
  };
  WH.repair = (id) => {
    const w = S.wh(id), c = Math.round((100 - w.cond) * C.wh.repairPerPoint);
    if (c <= 0) return { ok: false, msg: 'Warehouse is in perfect condition.' };
    if (!E.spend(c, 'repairs', 'Warehouse repair', id)) return { ok: false, msg: short(c) };
    w.cond = 100; return { ok: true, msg: 'Warehouse repaired.' };
  };

  const btn = (act, a, l, cls, dis) => '<button class="b ' + (cls || '') + '" data-act="' + act + '" data-a="' + a + '"' + (dis ? ' disabled' : '') + '>' + l + '</button>';
  UI.panels.wh = () => {
    const id = UI.sel, c = D.city(id), g = S.cur;
    const region = D.START_REGIONS.states.concat(D.START_REGIONS.unionTerritories).find((item) => item[0] === c.state);
    const stateName = region ? region[1] : c.state;
    if (!S.owns(id)) {
      const req = { level: c.minLevel, rep: c.minRep }, unlocked = IPM.P.reqOk(req);
      const reqText = 'Company level ' + c.minLevel + (c.minRep ? ' · Reputation ' + c.minRep : '');
      return '<h3>' + U.esc(c.name) + ' · ' + U.esc(stateName) + '</h3><div class="card"><div class="row"><b>State expansion</b><span class="tag' + (unlocked ? ' warn' : ' bad') + '">' + (unlocked ? 'Available' : 'Locked') + '</span></div><p class="mu">Unlocking establishes this state warehouse immediately. No separate construction step is needed.</p><div class="mu">Expansion payment ' + U.money(WH.openCost(c)) + ' · local demand ×' + c.demand + '</div><p class="mu">Requirements: ' + (unlocked ? 'Met' : IPM.P.reqText(req) || reqText) + '</p>' + btn('openwh', id, 'Unlock state · ' + U.money(WH.openCost(c)), 'g', !unlocked || g.cash < WH.openCost(c)) + '</div>';
    }
    const w = S.wh(id), ws = S.whStats(w), atCapacity = w.level >= C.wh.maxLevel, upgradeCost = WH.levelCost(w);
    const assignedEmployees = S.cur.employees.filter((employee) => employee.whId === id);
    const crewCount = (role) => assignedEmployees.filter((employee) => employee.role === role).length;
    const assignedVehicles = S.cur.vehicles.filter((vehicle) => vehicle.whId === id);
    const next = atCapacity ? null : S.whStats(Object.assign({}, w, { level: w.level + 1 }));
    const nextBenefits = next ? [
      ['Storage', next.storageCap - ws.storageCap, ' units'], ['Vehicle slots', next.vehicleSlots - ws.vehicleSlots, ''],
      ['Staff slots', next.staffSlots - ws.staffSlots, ''], ['Simultaneous jobs', next.maxJobs - ws.maxJobs, ''],
      ['Enquiry queue', next.pendingCap - ws.pendingCap, ''],
    ].filter((item) => item[1] > 0).map((item) => item[0] + ' +' + item[1] + item[2]) : [];
    const nextLevel = next ? '<div class="warehouse-next-level"><b>Next level brings</b><span>' + (nextBenefits.length ? nextBenefits.join(' · ') : 'Higher warehouse capacity') + '</span><small>Upkeep also rises by ' + U.money(next.upkeep - ws.upkeep) + ' per pay cycle.</small></div>' : '<div class="warehouse-next-level"><b>Maximum warehouse level reached</b></div>';
    const manager = ws.manager;
    const roleCards = [['packer', 'Packer', crewCount('packer'), 'Faster cargo loading'], ['driver', 'Driver', crewCount('driver'), 'Shorter route travel'], ['manager', 'Manager', crewCount('whManager'), 'Wider auto-dispatch range']].map(([role, label, count, effect]) => {
      const level = w.crewLevels[role] || 0, maxed = level >= 5, cost = maxed ? 0 : IPM.W.crewUpgradeCost(w, role);
      const ticks = Array.from({ length: 5 }, (_, i) => '<i class="crew-level' + (i < level ? ' is-filled' : '') + '"></i>').join('');
      const employeeRole = role === 'manager' ? 'whManager' : role, candidate = IPM.W.cands(employeeRole)[0];
      const staffFull = role !== 'manager' && ws.staffCount >= ws.staffSlots, managerFull = role === 'manager' && !!manager;
      const hireDisabled = !candidate || !IPM.P.reqOk(D.ROLES[employeeRole].req) || S.cur.cash < candidate.recruit || staffFull || managerFull;
      const hireLabel = managerFull ? 'Manager hired' : staffFull ? 'No staff space' : candidate ? 'Hire · ' + U.money(candidate.recruit) : 'No candidate';
      return '<article class="crew-upgrade-row"><div><b>' + label + ' <span class="crew-assignment">' + count + ' assigned</span></b><small>Level ' + level + '/5 · ' + effect + '</small><small class="crew-candidate-cost">' + (candidate ? 'Next hire: ' + U.money(candidate.recruit) + ' · ' + U.money(candidate.wage) + '/cycle' : 'No candidate available') + '</small><span class="crew-level-track" aria-label="' + label + ' level ' + level + ' of 5">' + ticks + '</span></div><div class="crew-upgrade-actions">' + btn('crewHire', id + '|' + employeeRole + '|' + (candidate ? candidate.id : ''), hireLabel, 'n', hireDisabled) + btn('crewUpgrade', id + '|' + role, maxed ? 'Max level' : 'Improve · ' + U.money(cost), 'n', maxed || S.cur.cash < cost || !count) + '</div></article>';
    }).join('');
    const setting = (key, label, value) => '<button type="button" class="manager-setting" data-act="rule" data-a="' + id + '|' + key + '|1" aria-pressed="' + value + '"><span>' + label + '</span><b>' + (value ? 'On' : 'Off') + '</b></button>';
    const instructions = manager ? '<section class="warehouse-manager"><div class="row"><b>Manager instructions</b><span class="tag">Manager assigned</span></div><p class="mu">The manager follows these rules while the simulation runs.</p><div class="manager-instruction-list">' + setting('autoAccept', 'Accept profitable matching orders', w.mgr.autoAccept) + setting('express', 'Include express enquiries', w.mgr.express) + setting('autoRepair', 'Repair idle vehicles below 60%', w.mgr.autoRepair) + '<div class="manager-setting"><span>Minimum order profit</span><b>' + U.money(w.mgr.minProfit) + '</b><span>' + btn('rule', id + '|minProfit|-250', '−', 'n') + btn('rule', id + '|minProfit|250', '+', 'n') + '</span></div><div class="manager-setting"><span>Maximum route distance</span><b>' + w.mgr.maxDist + ' km</b><span>' + btn('rule', id + '|maxDist|-50', '−', 'n') + btn('rule', id + '|maxDist|50', '+', 'n') + '</span></div><div class="manager-setting"><span>Cash reserve</span><b>' + U.money(w.mgr.keepCash) + '</b><span>' + btn('rule', id + '|keepCash|-500', '−', 'n') + btn('rule', id + '|keepCash|500', '+', 'n') + '</span></div></div></section>' : '<section class="warehouse-manager"><div class="row"><b>Manager instructions</b><span class="tag warn">No manager</span></div><p class="mu">Hire a manager in Assigned crew to set order acceptance and vehicle repair instructions.</p></section>';
    let h = '<h3>' + U.esc(c.name) + ' warehouse</h3><section class="card warehouse-overview"><div class="row"><div><b>Level ' + w.level + '/' + C.wh.maxLevel + '</b><p class="mu">' + U.esc(stateName) + ' · ' + U.esc(c.note || 'Service location') + '</p></div><span class="tag">' + Math.round(w.cond) + '% condition</span></div><div class="warehouse-operating-facts"><span>Storage capacity <b>' + ws.storageCap + '</b></span><span>Workers <b>' + assignedEmployees.filter((employee) => employee.status === 'idle').length + ' available / ' + assignedEmployees.length + '</b></span><span>Vehicles <b>' + assignedVehicles.filter((vehicle) => vehicle.status === 'Idle' && vehicle.cond >= C.wear.minCond).length + ' available / ' + assignedVehicles.length + '</b></span><span>Vehicle slots <b>' + ws.vehicleSlots + '</b></span><span>Staff capacity <b>' + ws.staffSlots + '</b></span><span>Active jobs <b>' + ws.maxJobs + '</b></span><span>Upkeep <b>' + U.money(ws.upkeep) + '/cycle</b></span></div>' + nextLevel + '<p class="mu">' + w.stats.delivered + ' deliveries · ' + U.money(w.stats.revenue) + ' revenue</p><div class="warehouse-actions">' + btn('whlevel', id, atCapacity ? 'Maximum level' : 'Upgrade warehouse · ' + U.money(upgradeCost), 'g', atCapacity || S.cur.cash < upgradeCost) + btn('whrepair', id, 'Repair · ' + U.money(Math.round((100 - w.cond) * C.wh.repairPerPoint)), 'n', w.cond >= 100) + '</div></section><section class="crew-upgrades"><h4>Assigned crew</h4><p class="mu">Role improvements apply to this warehouse and its assigned team. Costs rise sharply at each level.</p>' + roleCards + '</section>' + instructions;
    return h;
  };
  UI.panels.research = () => {
    const company = S.cur;
    const tracks = D.RD_CATEGORIES.map((category) => {
      const level = IPM.P.researchLevel(category.id), next = level + 1, maxed = level >= category.max;
      const req = IPM.P.researchRequirement(next), unlocked = !maxed && IPM.P.reqOk(req), cost = maxed ? 0 : IPM.P.researchCost(category, next);
      const milestones = D.rdMilestones.map((step) => '<span class="research-milestone' + (level >= step ? ' reached' : '') + '">Level ' + step + '</span>').join('');
      const status = maxed ? 'Complete' : unlocked ? 'Requires company level ' + req.level : 'Locked until company level ' + req.level;
      const action = maxed ? '<span class="tag">Maximum level</span>' : btn('researchLevel', category.id, 'Upgrade · ' + U.money(cost), '', !unlocked || company.cash < cost);
      return '<article class="card research-card"><div class="row"><b>' + U.esc(category.name) + '</b><span class="tag">Level ' + level + '/' + category.max + '</span></div><p class="mu">' + U.esc(category.desc) + '</p><div class="research-progress" role="progressbar" aria-label="' + U.esc(category.name) + ' research progress" aria-valuemin="0" aria-valuemax="' + category.max + '" aria-valuenow="' + level + '"><i style="width:' + (level / category.max * 100) + '%"></i></div><div class="research-milestones" aria-label="Milestone levels">' + milestones + '</div><p class="mu">Current benefit: ' + U.esc(IPM.P.researchBenefit(category, level)) + '</p><p class="mu">' + (maxed ? 'Next benefit: maximum reached.' : 'Next level: ' + U.esc(IPM.P.researchBenefit(category, next))) + '</p><div class="row"><span class="mu">' + status + (maxed ? '' : ' · ' + U.money(cost)) + '</span>' + action + '</div></article>';
    }).join('');
    const oneTime = D.RESEARCH.map((r) => {
      const done = !!company.research[r.id], ok = IPM.P.reqOk(r.req);
      return '<article class="card"><div class="row"><b>' + U.esc(r.name) + '</b><span>' + U.money(r.cost) + '</span></div><p class="mu">' + U.esc(r.desc) + ' · ' + U.esc(r.fx) + '</p>' + (done ? '<span class="tag">Researched</span>' : ok ? btn('researchLegacy', r.id, 'Research') : '<span class="tag">Locked: ' + U.esc(IPM.P.reqText(r.req)) + '</span>') + '</article>';
    }).join('');
    return '<h3>Company-wide R&D</h3><p class="mu">Research benefits every current and future warehouse. Levels unlock gradually, and milestone levels 3, 6, and 9 improve the effect further.</p>' + tracks + '<h4>One-time programmes</h4>' + oneTime;
  };
  Object.assign(UI.A, {
    openwh: (a) => UI.res(WH.open(a)), whlevel: (a) => UI.res(WH.levelUp(a)), whrepair: (a) => UI.res(WH.repair(a)),
    crewHire: (a) => { const p = a.split('|'); UI.res(IPM.W.hire(p[1], p[2], p[0])); },
    whupg: (a) => { const p = a.split('|'); UI.res(WH.upg(p[0], p[1])); },
    crewUpgrade: (a) => { const p = a.split('|'); UI.res(IPM.W.crewUpgrade(p[0], p[1])); },
    rule: (a) => { const p = a.split('|'); IPM.W.setRule(p[0], p[1], +p[2]); UI.render(); IPM.V.save(); },
    opsauto: () => { S.cur.fin.opsAuto = !S.cur.fin.opsAuto; UI.render(); },
    researchLevel: (a) => UI.res(IPM.P.upgradeResearch(a)), researchLegacy: (a) => UI.res(IPM.P.research(a)),
  });
})();
