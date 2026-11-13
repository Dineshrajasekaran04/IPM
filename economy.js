/* economy.js — cash, central ledger, payroll tick, loans */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG;
  const G = () => IPM.S.cur;
  const E = (IPM.E = {});
  const note = (m, k, o) => IPM.UI && IPM.UI.note(m, k, o);

  // op:true => operating revenue/expense (counts toward profit); others are investments / financing
  E.CATS = {
    revenue: { label: 'Delivery revenue', op: true },
    wages: { label: 'Wages', op: true },
    fuel: { label: 'Fuel & route costs', op: true },
    maintenance: { label: 'Vehicle maintenance', op: true },
    materials: { label: 'Packing materials', op: true },
    upkeep: { label: 'Warehouse upkeep', op: true },
    marketing: { label: 'Marketing', op: true },
    repairs: { label: 'Repairs', op: true },
    interest: { label: 'Loan interest', op: true },
    vehicle: { label: 'Vehicle purchases' },
    sale: { label: 'Vehicle sales' },
    warehouse: { label: 'Warehouses & upgrades' },
    hiring: { label: 'Recruitment' },
    training: { label: 'Training' },
    research: { label: 'Research' },
    loanIn: { label: 'Loan drawn' },
    loanPay: { label: 'Loan repayment' },
  };
  E.OP_COSTS = ['wages', 'fuel', 'maintenance', 'materials', 'upkeep', 'marketing', 'repairs', 'interest'];

  E.record = (cat, amt, text, whId) => {
    const g = G();
    amt = Math.round(amt);
    if (!amt) return;
    const meta = E.CATS[cat] || {};
    g.ledger.unshift({ t: Math.round(g.time), cat, amt, note: text || '', wh: whId || '' });
    if (g.ledger.length > C.maxLedger) g.ledger.length = C.maxLedger;
    g.fin.totals[cat] = (g.fin.totals[cat] || 0) + amt;
    if (meta.op) {
      if (amt > 0) { g.fin.lifetimeRevenue += amt; g.fin.bucketRev += amt; }
      else { g.fin.lifetimeExpense += -amt; g.fin.bucketExp += -amt; }
      g.recent.push({ t: g.time, amt, wh: whId || '' });
    }
    if (whId) {
      const w = IPM.S.wh(whId);
      if (w && cat in w.fin) w.fin[cat] += cat === 'revenue' ? amt : -amt;
    }
  };

  E.can = (amt) => G().cash >= amt;
  E.short = (amt) => Math.max(0, Math.round(amt - G().cash));
  E.earn = (amt, cat, text, whId) => {
    amt = Math.round(amt);
    G().cash += amt;
    E.record(cat, amt, text, whId);
  };
  // purchase: refuses if cash is insufficient
  E.spend = (amt, cat, text, whId) => {
    const g = G();
    amt = Math.round(amt);
    const discount = IPM.Events ? IPM.Events.discount(cat) : 0;
    const charged = Math.max(0, Math.round(amt * (1 - discount)));
    if (g.cash < charged) return false;
    g.cash -= charged;
    E.record(cat, -charged, discount ? text + ' (supplier discount)' : text, whId);
    return true;
  };
  // forced running cost: never drives cash below zero
  E.charge = (amt, cat, text, whId) => {
    const g = G();
    const pay = Math.min(g.cash, Math.round(amt));
    g.cash -= pay;
    E.record(cat, -pay, text, whId);
    return pay;
  };

  E.payrollTotals = (whId) => {
    const g = G();
    let wages = 0, upkeep = 0;
    g.employees.forEach((e) => { if (!whId || e.whId === whId) wages += e.wage; });
    g.warehouses.forEach((w) => { if (!whId || w.id === whId) upkeep += IPM.S.whStats(w).upkeep; });
    return { wages, upkeep };
  };
  E.nextPayroll = () => C.payCycleSec - G().fin.payAcc;

  E.payroll = () => {
    const g = G(), f = g.fin;
    const byWh = {};
    let cycle = 0;
    g.employees.forEach((e) => { cycle += e.wage; byWh[e.whId || ''] = (byWh[e.whId || ''] || 0) + e.wage; });
    const owed = f.wagesOwed;
    const due = cycle + owed;
    if (due > 0) {
      if (g.cash >= due) {
        g.cash -= due;
        Object.keys(byWh).forEach((k) => E.record('wages', -byWh[k], 'Payroll', k));
        if (owed > 0) E.record('wages', -owed, 'Overdue wages cleared', '');
        f.wagesOwed = 0;
        g.employees.forEach((e) => (e.morale = U.clamp(e.morale + 3, 0, 100)));
      } else {
        f.wagesOwed = due;
        g.employees.forEach((e) => (e.morale = U.clamp(e.morale - 4, 0, 100)));
        note('Cannot pay wages (' + U.money(due) + ' owed). Staff morale is falling!', 'bad', { toast: true });
      }
    }
    g.warehouses.forEach((w) => E.charge(IPM.S.whStats(w).upkeep, 'upkeep', 'Warehouse upkeep', w.id));
  };

  E.loanPlan = (debt) => {
    const L = C.loan;
    let d = debt, n = 0, interest = 0;
    while (d > 0 && n < 500) {
      interest += Math.round(d * L.rate);
      d -= Math.min(L.installment, d);
      n++;
    }
    return { payments: n, interest, seconds: n * L.cycleSec };
  };
  E.loanCycle = () => {
    const g = G(), L = C.loan;
    const interest = Math.round(g.debt * L.rate);
    const principal = Math.min(L.installment, g.debt);
    const total = interest + principal;
    if (g.cash >= total) {
      g.cash -= total;
      E.record('interest', -interest, 'Loan interest');
      E.record('loanPay', -principal, 'Loan instalment');
      g.debt -= principal;
      note('Loan instalment paid: ' + U.money(principal) + ' + ' + U.money(interest) + ' interest.', 'info');
    } else {
      g.debt += L.lateFee;
      g.fin.missed++;
      note('Missed loan instalment of ' + U.money(total) + '! Late fee ' + U.money(L.lateFee) + ' added to debt.', 'bad', { toast: true });
    }
    if (g.debt <= 0) { g.debt = 0; note('Loan fully repaid. Debt-free!', 'good', { toast: true }); }
  };
  E.maxDebt = () => G().level * C.loan.maxPerLevel;
  E.borrow = (amt) => {
    const g = G();
    if (g.debt + amt > E.maxDebt()) return { ok: false, msg: 'Credit limit reached (' + U.money(E.maxDebt()) + ' at company level ' + g.level + ').' };
    if (g.debt <= 0) g.fin.loanAcc = 0;
    g.cash += amt;
    g.debt += amt;
    E.record('loanIn', amt, 'Loan drawn');
    return { ok: true, msg: 'Borrowed ' + U.money(amt) + '. Interest of ' + (C.loan.rate * 100) + '% applies every ' + C.loan.cycleSec / 60 + ' min.' };
  };
  E.repay = (amt) => {
    const g = G();
    amt = Math.min(amt, g.debt, g.cash);
    if (amt <= 0) return { ok: false, msg: g.debt <= 0 ? 'You have no debt.' : 'Not enough cash to repay.' };
    g.cash -= amt;
    g.debt -= amt;
    E.record('loanPay', -amt, 'Early repayment');
    return { ok: true, msg: 'Repaid ' + U.money(amt) + '.' };
  };

  E.rate = (whId) => {
    const g = G();
    const win = Math.max(15, Math.min(60, g.time));
    let rev = 0, exp = 0;
    g.recent.forEach((r) => {
      if (r.t < g.time - win || (whId && r.wh !== whId)) return;
      if (r.amt > 0) rev += r.amt; else exp -= r.amt;
    });
    return { revPerSec: rev / win, revPerMin: (rev * 60) / win, expPerMin: (exp * 60) / win, netPerMin: ((rev - exp) * 60) / win };
  };

  E.tick = (dt) => {
    const g = G(), f = g.fin;
    f.payAcc += dt;
    while (f.payAcc >= C.payCycleSec) { f.payAcc -= C.payCycleSec; E.payroll(); }
    if (g.debt > 0) {
      f.loanAcc += dt;
      while (f.loanAcc >= C.loan.cycleSec && g.debt > 0) { f.loanAcc -= C.loan.cycleSec; E.loanCycle(); }
    } else f.loanAcc = 0;
    f.bucketT += dt;
    if (f.bucketT >= 30) {
      f.bucketT -= 30;
      g.series.push({ t: Math.round(g.time), rev: f.bucketRev, exp: f.bucketExp });
      f.bucketRev = 0; f.bucketExp = 0;
      if (g.series.length > 60) g.series.shift();
    }
    while (g.recent.length && g.recent[0].t < g.time - 120) g.recent.shift();
  };
})();
