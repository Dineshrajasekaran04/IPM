/* marketing.js — campaigns and demand modifiers */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur;
  const M = (IPM.M = {});
  const cityName = (id) => (D.city(id) ? D.city(id).name : id);
  const short = (n) => 'Not enough cash — short by ' + U.money(IPM.E.short(n)) + '.';

  M.target = (campaign) => campaign.scope === 'company' ? 'all' : campaign.targetId || campaign.whId;
  M.active = (type, targetId) => G().campaigns.find((c) => c.type === type && M.target(c) === (targetId || 'all'));
  M.referral = (whId) => G().campaigns.find((c) => c.type === 'referral' && (M.target(c) === 'all' || M.target(c) === whId));
  M.cost = (def, targetId) => Math.round(def.cost * (targetId === 'all' ? Math.max(1, G().warehouses.length) : 1));

  // demand multiplier for one channel at one warehouse
  M.mult = (wh, ch) => {
    const g = G();
    const lifts = [];
    g.campaigns.forEach((c) => {
      if (M.target(c) !== 'all' && M.target(c) !== wh.id) return;
      const def = D.CAMPAIGNS[c.type], f = def && def.mult[ch];
      if (f > 1) lifts.push(f - 1);
    });
    lifts.sort((a, b) => b - a);
    let m = 1 + lifts.reduce((sum, lift, index) => sum + lift * (C.marketing.diminishing[index] || 0.25), 0);
    m = Math.min(1 + C.marketing.maxLift, m);
    if (ch === 'web' || ch === 'app') m *= 1 + D.SEO.per * g.seo;
    return m;
  };

  M.recordLead = (wh, ch) => {
    G().campaigns.forEach((campaign) => {
      const def = D.CAMPAIGNS[campaign.type];
      if ((M.target(campaign) === 'all' || M.target(campaign) === wh.id) && def && def.mult[ch] > 1) campaign.leads = (campaign.leads || 0) + 1;
    });
  };

  M.start = (type, targetId) => {
    const g = G(), def = D.CAMPAIGNS[type], scope = targetId === 'all' ? 'company' : 'city', wh = scope === 'city' && IPM.S.wh(targetId);
    if (!def || (scope === 'city' && !wh)) return { ok: false, msg: 'Choose a company or owned-city target.' };
    if (!IPM.P.reqOk(def.req)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(def.req) };
    if (M.active(type, targetId)) return { ok: false, msg: def.name + ' is already running for ' + (targetId === 'all' ? 'the company' : cityName(targetId)) + '.' };
    const totalCost = M.cost(def, targetId);
    if (g.cash < totalCost) return { ok: false, msg: short(totalCost) };
    const id = 'C' + IPM.S.id(g, 'cmp');
    const targetName = scope === 'company' ? 'All locations' : cityName(targetId), c = { id, type, scope, targetId, whId: wh ? wh.id : '', start: g.time, end: g.time + def.dur, acc: 0, spent: 0, costTotal: totalCost, leads: 0 };
    if (!def.spread) { IPM.E.spend(totalCost, 'marketing', def.name + ' (' + targetName + ')', c.whId); c.spent = totalCost; }
    g.campaigns.push(c);
    return { ok: true, msg: def.name + ' launched for ' + targetName + '.', sound: 'buy' };
  };
  M.stop = (id) => {
    const g = G(), c = g.campaigns.find((x) => x.id === id);
    if (!c) return { ok: false, msg: 'Campaign not found.' };
    g.campaigns = g.campaigns.filter((x) => x.id !== id);
    return { ok: true, msg: D.CAMPAIGNS[c.type].name + ' stopped. Money already spent is not refunded.' };
  };

  M.seoCost = () => U.round(D.SEO.baseCost * Math.pow(D.SEO.mult, G().seo), 100);
  M.buySeo = () => {
    const g = G();
    if (!IPM.P.reqOk(D.SEO.req)) return { ok: false, msg: 'Locked: ' + IPM.P.reqText(D.SEO.req) };
    if (g.seo >= D.SEO.max) return { ok: false, msg: 'Search listing is at max level.' };
    const cost = M.seoCost();
    if (!IPM.E.spend(cost, 'marketing', 'Search listing level ' + (g.seo + 1))) return { ok: false, msg: short(cost) };
    g.seo++;
    IPM.P.addXp(15);
    return { ok: true, msg: 'Search listing upgraded to level ' + g.seo + '.', sound: 'buy' };
  };

  M.effectText = (type) => {
    const def = D.CAMPAIGNS[type], names = { phone: 'phone', web: 'website', app: 'app', walk: 'walk-in' };
    return Object.keys(def.mult).map((k) => '+' + Math.round((def.mult[k] - 1) * 100) + '% ' + names[k]).join(' · ');
  };

  M.tick = (dt) => {
    const g = G();
    for (let i = g.campaigns.length - 1; i >= 0; i--) {
      const c = g.campaigns[i], def = D.CAMPAIGNS[c.type];
      if (def.spread) {
        c.acc += (c.costTotal || M.cost(def, M.target(c))) * dt / Math.max(1, def.dur);
        const pay = Math.floor(c.acc);
        if (pay >= 1) {
          c.acc -= pay;
          const paid = IPM.E.charge(pay, 'marketing', def.name + ' budget', c.whId);
          c.spent += paid;
          if (paid < pay) c.end = g.time;
        }
      }
      if (g.time >= c.end) {
        g.campaigns.splice(i, 1);
        IPM.UI && IPM.UI.note(def.name + ' for ' + (M.target(c) === 'all' ? 'the company' : cityName(M.target(c))) + ' has ended.', 'info');
      }
    }
  };
})();
