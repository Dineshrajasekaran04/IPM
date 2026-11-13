/* progression.js — XP, company levels, requirements/unlocks, milestones, research, soft-failure detection */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur;
  const P = (IPM.P = {});
  const note = (m, k, o) => IPM.UI && IPM.UI.note(m, k, o);

  P.reqOk = (req) => {
    const g = G();
    if (!req) return true;
    if (req.level && g.level < req.level) return false;
    if (req.flag && !g.unlocks[req.flag]) return false;
    if (req.rep && g.rep < req.rep) return false;
    return true;
  };
  // text describing only the requirements that are NOT yet met
  P.reqText = (req) => {
    const g = G(), out = [];
    if (!req) return '';
    if (req.level && g.level < req.level) out.push('Company level ' + req.level);
    if (req.flag && !g.unlocks[req.flag]) {
      const m = D.MILESTONES.find((x) => x.unlock === req.flag);
      out.push(m ? m.desc : D.FLAG_NAMES[req.flag] || req.flag);
    }
    if (req.rep && g.rep < req.rep) out.push('Reputation ' + req.rep);
    return out.join(' + ');
  };

  P.levelName = (lvl) => D.LEVEL_NAMES[Math.min(D.LEVEL_NAMES.length - 1, lvl - 1)];
  P.xpInfo = () => {
    const g = G(), t = C.xp;
    const lvl = g.level;
    const cur = t[lvl - 1] || 0;
    const next = t[lvl];
    if (next == null) return { level: lvl, cur: g.xp, need: 0, pct: 100, max: true };
    return { level: lvl, cur: g.xp - cur, need: next - cur, pct: ((g.xp - cur) / (next - cur)) * 100, max: false };
  };
  P.stars = () => U.clamp(1 + G().rep / 15, 1, 5);

  P.unlocksAt = (lvl) => {
    const out = [];
    D.VEHICLES.forEach((v) => { if (v.unlock.level === lvl) out.push(v.name); });
    Object.keys(D.ROLES).forEach((k) => { if (D.ROLES[k].req.level === lvl) out.push(D.ROLES[k].label); });
    Object.keys(D.CAMPAIGNS).forEach((k) => { if (D.CAMPAIGNS[k].req.level === lvl) out.push(D.CAMPAIGNS[k].name); });
    D.RESEARCH.forEach((r) => { if (r.req.level === lvl && lvl > 1) out.push(r.name); });
    D.CITIES.forEach((c) => { if (c.minLevel === lvl && c.cost) out.push(c.name + ' warehouse'); });
    return out;
  };

  P.addXp = (n) => {
    const g = G();
    g.xp += Math.round(n);
    while (g.level < C.xp.length && g.xp >= C.xp[g.level]) {
      g.level++;
      const u = P.unlocksAt(g.level);
      note('Company level ' + g.level + ' — ' + P.levelName(g.level) + '!' + (u.length ? ' Unlocked: ' + u.join(', ') + '.' : ''), 'good', { toast: true, sound: 'ok' });
    }
  };
  P.gainRep = (n) => {
    const g = G();
    if (n > 0) n *= D.fx(g).repGain;
    g.rep = Math.max(0, g.rep + n);
  };

  P.checkMilestones = () => {
    const g = G();
    D.MILESTONES.forEach((m) => {
      if (g.milestones[m.id]) return;
      if (m.eligible && !m.eligible(g)) return;
      const p = m.prog(g);
      if (p[0] >= p[1]) {
        g.milestones[m.id] = true;
        if (m.unlock) g.unlocks[m.unlock] = true;
        P.addXp(m.xp);
        note('Milestone: ' + m.name + ' — ' + m.reward + ' (+' + m.xp + ' XP)', 'good', { toast: true, sound: 'ok' });
      }
    });
  };

  P.research = (id) => {
    const g = G(), r = D.RESEARCH.find((x) => x.id === id);
    if (!r || g.research[id]) return { ok: false, msg: 'Already researched.' };
    if (!P.reqOk(r.req)) return { ok: false, msg: 'Locked: ' + P.reqText(r.req) };
    if (!IPM.E.spend(r.cost, 'research', 'Research: ' + r.name)) return { ok: false, msg: 'Not enough cash — short by ' + U.money(IPM.E.short(r.cost)) + '.' };
    g.research[id] = true;
    if (r.sets) g.unlocks[r.sets] = true;
    P.addXp(25);
    return { ok: true, msg: r.name + ' researched.' };
  };

  P.researchLevel = (id) => Number(G().research[id]) || 0;
  P.researchRequirement = (level) => ({ level: Math.max(1, Math.ceil(level / 2)) });
  P.researchCost = (category, nextLevel) => U.round(category.baseCost * Math.pow(category.scale, nextLevel - 1), 100);
  P.researchBenefit = (category, level) => D.rdText(category.id, level);
  P.upgradeResearch = (id) => {
    const g = G(), category = D.RD_CATEGORIES.find((item) => item.id === id);
    if (!category) return { ok: false, msg: 'Research programme not found.' };
    const level = P.researchLevel(id), next = level + 1;
    if (next > category.max) return { ok: false, msg: category.name + ' is fully researched.' };
    const req = P.researchRequirement(next);
    if (!P.reqOk(req)) return { ok: false, msg: 'Locked: ' + P.reqText(req) };
    const cost = P.researchCost(category, next);
    if (!IPM.E.spend(cost, 'research', category.name + ' level ' + next)) return { ok: false, msg: 'Not enough cash. Need ' + U.money(IPM.E.short(cost)) + ' more.' };
    g.research[id] = next;
    P.addXp(10 + next * 3);
    return { ok: true, msg: category.name + ' advanced to level ' + next + '. Company-wide benefit: ' + P.researchBenefit(category, next) + '.', sound: 'buy' };
  };

  P.checkSoftFail = () => {
    const g = G();
    if (g.time - g.softFailAt < C.soft.cooldown) return;
    if (IPM.UI && IPM.UI.modalOpen()) return;
    const busy = g.orders.some((o) => o.status === 'transit' || o.status === 'accepted') || g.vehicles.some((v) => v.status === 'Returning' || v.status === 'Maintenance');
    const need = g.vehicles.length ? 500 : D.VEHICLES[0].price;
    if (!busy && g.cash < need && IPM.UI) {
      g.softFailAt = g.time;
      IPM.UI.softFail();
    }
  };

  let acc = 0, acc2 = 0;
  P.tick = (dt, opts) => {
    acc += dt; acc2 += dt;
    if (acc >= 1) { acc = 0; P.checkMilestones(); }
    if (acc2 >= C.soft.checkSec) { acc2 = 0; if (!(opts && opts.offline)) P.checkSoftFail(); }
  };
})();
