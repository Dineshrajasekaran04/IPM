/* ui.js — map, panels, modals, notifications (event delegation) */
(function () {
  'use strict';
  const IPM = window.IPM, U = IPM.U, D = IPM.D, C = D.CONFIG, S = IPM.S, E = IPM.E;
  const UI = (IPM.UI = { tab: 'company', companyView: 'overview', ordersView: 'incoming', fleetView: 'vehicles', revenueView: 'income', selectedVehicle: '', sel: 'chennai', mapCityPanel: false, hireWarehouse: 'chennai' }), $ = (id) => document.getElementById(id), g = () => S.cur;
  const TABS = [['company', 'COMPANY'], ['orders', 'ORDERS'], ['fleet', 'FLEET'], ['revenue', 'REVENUE']];
  let modal = false;
  UI.modalOpen = () => modal;
  UI.note = (m, k, o) => {
    const gg = g(); if (!gg) return;
    gg.log.unshift({ m, k: k || 'info' }); gg.log.length = Math.min(gg.log.length, C.maxLog);
    UI.feed();
  };
  UI.feed = () => ($('feed').innerHTML = g().log.slice(0, 8).map((l) => '<div class="' + l.k + '">' + U.esc(l.m) + '</div>').join(''));
  UI.softFail = () => {
    const gg = g(); if (IPM.E.maxDebt() - gg.debt < C.loan.emergency) return UI.note('Low on cash with nothing in progress — sell a vehicle or review borrowing in Company.', 'bad');
    UI.modal('<h3>Out of cash</h3><p>No jobs in progress and not enough cash to continue. Take an emergency loan of ' + U.money(C.loan.emergency) + '?</p><div class="row"><button class="b g" data-act="emerg">Take loan</button><button class="b n" data-act="close">Not now</button></div>');
  };
  UI.modal = (h) => { modal = true; $('modal').style.display = 'flex'; $('modal').innerHTML = '<div class="modal-card">' + h + '</div>'; };
  UI.close = () => { modal = false; $('modal').style.display = 'none'; };
  UI.showEvent = (event) => {
    const vehicle = event.vehicleId && S.veh(event.vehicleId);
    const decision = event.decision === 'accident' && vehicle
      ? '<div class="event-choices"><button type="button" class="b g" data-act="eventRepairNow"' + (S.cur.cash < IPM.F.repairCost(vehicle, true) ? ' disabled' : '') + '>Repair now · ' + U.money(IPM.F.repairCost(vehicle, true)) + '</button><button type="button" class="b n" data-act="eventRepairStandard"' + (S.cur.cash < IPM.F.repairCost(vehicle, false) ? ' disabled' : '') + '>Workshop repair · ' + U.money(IPM.F.repairCost(vehicle, false)) + ' · about ' + U.time(Math.max(4, (100 - vehicle.cond) * C.wear.repairSecPerPoint)) + '</button><button type="button" class="b n" data-act="eventLeaveParked">Leave parked for now</button></div>'
      : event.decision === 'event-response' ? '<div class="event-choices"><button type="button" class="b n" data-act="eventAcknowledge">Accept outcome</button><button type="button" class="b g" data-act="eventRecovery"' + (S.cur.cash < 500 ? ' disabled' : '') + '>Customer-care follow-up · ₹500 · +0.25 reputation</button></div>' : event.decision ? '<button type="button" class="b n" data-act="eventAcknowledge">Continue</button>' : event.fine ? '<button type="button" class="b g" data-act="eventPay">Pay fine ' + U.money(event.fine) + '</button>' : '<button type="button" class="b g" data-act="eventAcknowledge">Acknowledge</button>';
    UI.modal('<section class="event-dialog"><p class="eyebrow">Business event</p><h3>' + U.esc(event.title) + '</h3><p>' + U.esc(event.message) + '</p><p class="event-impact ' + U.esc(event.tone || 'info') + '">' + U.esc(event.impact) + '</p>' + decision + '</section>');
  };
  const res = (r) => { if (r && r.msg) UI.note(r.msg, r.ok ? 'good' : 'bad'); UI.render(); IPM.V.save(); };
  const btn = (act, a, label, cls, dis) => '<button class="b ' + (cls || '') + '" data-act="' + act + '" data-a="' + a + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  const vehicleArt = (typeId, name) => {
    const widths = { mini: 70, medium: 123, heavy: 139, container: 154 };
    const cargo = widths[typeId] || 86, left = 20, cabinX = left + cargo, cabinW = 29;
    return '<svg class="vehicle-art" viewBox="0 0 210 90" role="img" aria-label="Illustration of ' + U.esc(name) + '"><rect x="1" y="1" width="208" height="88" rx="4" fill="#f1eee5"/><path d="M12 61h' + (cargo + 40) + '" stroke="#758679" stroke-width="2"/><rect x="' + left + '" y="34" width="' + cargo + '" height="26" rx="2" fill="#db8b48" stroke="#263b41" stroke-width="2"/><path d="M' + cabinX + ' 60V42q0-3 4-3h14l11 10v11" fill="#f5f0e3" stroke="#263b41" stroke-width="2"/><path d="M' + (cabinX + 5) + ' 42h11l7 8h-18z" fill="#aebeb0"/><path d="M' + (left + 7) + ' 41h' + Math.max(32, cargo - 14) + '" stroke="#f5e6c9" stroke-width="2" opacity=".8"/><circle cx="' + (left + 15) + '" cy="63" r="8" fill="#263b41"/><circle cx="' + (left + 15) + '" cy="63" r="3" fill="#d7d4ca"/><circle cx="' + (cabinX + 20) + '" cy="63" r="8" fill="#263b41"/><circle cx="' + (cabinX + 20) + '" cy="63" r="3" fill="#d7d4ca"/><path d="M' + (cabinX + 27) + ' 55h5" stroke="#be6840" stroke-width="3"/></svg>';
  };

  let setupAttempted = false;
  const regionOptions = (regions) => regions.map(([id, name]) => '<option value="' + id + '">' + U.esc(name) + '</option>').join('');
  UI.setup = () => {
    const options = D.START_REGIONS.states;
    UI.modal('<section class="setup-dialog" aria-labelledby="setup-title">' +
      '<header class="setup-header"><div class="setup-mark" aria-hidden="true">IPM<span>•</span></div><div><p class="setup-kicker">A new route begins</p><h1 id="setup-title">Build your moving company</h1><p class="setup-intro">Choose a name, two starting states, and your opening capital.</p></div></header>' +
      '<form id="setupForm" novalidate><div class="setup-name-row">' +
      '<div class="setup-field"><label for="cn">Company name <span>3 to 24 characters</span></label><input id="cn" name="company" type="text" placeholder="Enter your company name" minlength="3" maxlength="24" required autocomplete="organization" aria-describedby="cn-error"><small id="cn-error" class="field-error" aria-live="polite"></small></div></div>' +
      '<div class="setup-location-row"><div class="setup-field"><label for="st">Start warehouses in</label><select id="st" name="region" required aria-describedby="st-error"><option value="">Select first state</option>' + regionOptions(options) + '</select><small id="st-error" class="field-error" aria-live="polite"></small></div>' +
      '<div class="setup-field"><label for="st2">And in</label><select id="st2" name="region2" required aria-describedby="st2-error"><option value="">Select another state</option>' + regionOptions(options) + '</select><small id="st2-error" class="field-error" aria-live="polite"></small></div></div>' +
      '<section class="capital-section" aria-labelledby="capital-title"><div class="section-heading"><div><p class="setup-kicker">Opening funds</p><h2 id="capital-title">Choose your capital</h2></div><span class="section-note">You can borrow later</span></div><div class="capital-options">' +
      '<label class="capital-card"><input type="radio" name="cap" value="A" checked><span class="choice-mark" aria-hidden="true"></span><span class="capital-copy"><strong>₹50,000</strong><span class="capital-label">Starting capital</span><span class="capital-detail">No loan</span></span></label>' +
      '<label class="capital-card"><input type="radio" name="cap" value="B"><span class="choice-mark" aria-hidden="true"></span><span class="capital-copy"><strong>₹1,00,000</strong><span class="capital-label">₹50,000 capital + ₹50,000 loan</span><span class="capital-detail">2% interest every 3 minutes · ₹2,500 instalments</span></span></label></div></section>' +
      '<p class="region-note"><span aria-hidden="true">↳</span> Both states start with a warehouse. New orders connect your unlocked state network.</p>' +
      '<div class="setup-footer"><p id="setup-error" class="setup-error" role="alert" aria-live="assertive"></p><button class="b g setup-submit" type="button" data-act="start">ESTABLISH COMPANY</button></div></form></section>');
    setupAttempted = false;
    const form = $('setupForm');
    form.addEventListener('submit', (event) => { event.preventDefault(); A.start(); });
    form.addEventListener('input', () => { if (setupAttempted) validateSetup(false); });
    form.addEventListener('change', () => { if (setupAttempted) validateSetup(false); });
  };

  function validateSetup(focusInvalid) {
    const nameField = $('cn'), stateField = $('st'), stateField2 = $('st2');
    const name = nameField.value.trim();
    const nameError = !name ? 'Enter a company name.' : name.length < 3 ? 'Use at least 3 characters.' : name.length > 24 ? 'Use 24 characters or fewer.' : '';
    const stateError = !stateField.value ? 'Choose your first starting state.' : stateField.value === stateField2.value ? 'Choose two different states.' : '';
    const stateError2 = !stateField2.value ? 'Choose your second starting state.' : stateField.value === stateField2.value ? 'Choose two different states.' : '';
    nameField.setAttribute('aria-invalid', nameError ? 'true' : 'false');
    stateField.setAttribute('aria-invalid', stateError ? 'true' : 'false');
    stateField2.setAttribute('aria-invalid', stateError2 ? 'true' : 'false');
    $('cn-error').textContent = nameError;
    $('st-error').textContent = stateError;
    $('st2-error').textContent = stateError2;
    $('setup-error').textContent = nameError || stateError || stateError2 ? 'Complete the required fields to establish your company.' : '';
    if (focusInvalid && nameError) nameField.focus();
    else if (focusInvalid && stateError) stateField.focus();
    else if (focusInvalid && stateError2) stateField2.focus();
    return { valid: !nameError && !stateError && !stateError2, name, stateIds: [stateField.value, stateField2.value] };
  }

  UI.top = () => {
    const x = g(), xp = IPM.P.xpInfo(), r = E.rate();
    const registered = D.START_REGIONS.states.concat(D.START_REGIONS.unionTerritories).find((item) => item[0] === x.company.stateId);
    const registeredStates = x.company.stateIds && x.company.stateIds.length ? x.company.stateIds : [x.company.stateId || 'tn'];
    const regionName = registered ? registeredStates.map((id) => (D.START_REGIONS.states.find((item) => item[0] === id) || [id, id])[1]).join(' · ') : 'Tamil Nadu';
    const top = $('top');
    if (!top.dataset.built) {
      top.innerHTML = '<div class="top-brand"><span class="brand-sigil" aria-hidden="true">IPM</span><div class="brand-copy"><strong data-top="company-name"></strong><small>Registered in <span data-top="region"></span></small></div></div>' +
        '<div class="top-metrics" aria-label="Company metrics"><div class="top-metric"><span>Level</span><strong data-top="level"></strong><small><span data-top="xp"></span>% to next</small></div><div class="top-metric"><span>Cash</span><strong class="money" data-top="cash"></strong></div><div class="top-metric"><span>Standing</span><strong data-top="reputation"></strong></div><div class="top-metric"><span>Vehicles</span><strong data-top="vehicles"></strong></div><div class="top-metric"><span>Workers</span><strong data-top="workers"></strong></div><div class="top-metric"><span>Net/min</span><strong data-top="net"></strong></div></div>' +
        '<div class="speed-control" role="group" aria-label="Game speed">' + [1, 2, 3].map((s) => '<button type="button" aria-label="Set speed to ' + s + ' times" data-act="speed" data-a="' + s + '">' + s + '×</button>').join('') + '<button type="button" data-act="pause">Ⅱ</button></div>';
      top.dataset.built = 'true';
    }
    const setTop = (key, value) => { top.querySelector('[data-top="' + key + '"]').textContent = value; };
    setTop('company-name', x.company.name); setTop('region', regionName); setTop('level', x.level);
    setTop('xp', String(Math.round(xp.pct))); setTop('cash', U.money(x.cash));
    setTop('reputation', IPM.P.stars().toFixed(1) + '/5'); setTop('vehicles', x.vehicles.length); setTop('workers', x.employees.length);
    setTop('net', U.money(r.netPerMin));
    top.querySelectorAll('[data-act="speed"]').forEach((button) => {
      const active = x.speed === +button.dataset.a && !x.paused;
      button.classList.toggle('on', active); button.setAttribute('aria-pressed', String(active));
    });
    const pause = top.querySelector('[data-act="pause"]');
    pause.setAttribute('aria-label', x.paused ? 'Resume game' : 'Pause game'); pause.setAttribute('aria-pressed', String(x.paused)); pause.textContent = x.paused ? '▶' : 'Ⅱ';
  };

  /* ---------- panels ---------- */
  UI.map = () => IPM.Map.render();
  const panels = {
    map() {
      if (UI.mapCityPanel) return '<button type="button" class="b n map-back" data-act="mapBack">Back to map</button>' + UI.panels.wh();
      const region = IPM.Map.byId[IPM.Map.selected] || IPM.Map.byId.tn;
      const game = g(), hub = D.stateHub(region.id), warehouse = hub && game.warehouses.find((w) => w.id === hub.id);
      const regions = IPM.Map.regionList.map((item) => '<button type="button" class="region-pick' + (item.id === region.id ? ' is-selected' : '') + '" aria-pressed="' + (item.id === region.id) + '" data-region-pick="' + item.id + '" data-a="' + item.id + '" data-region-name="' + U.esc(item.name.toLowerCase()) + '">' + U.esc(item.name) + '<span class="region-state">' + U.esc(IPM.Map.coverageStatus(item, game)) + '</span></button>').join('');
      const coverage = IPM.Map.coverageStatus(region, game);
      const cityPanel = '<section class="mapped-cities" aria-labelledby="mapped-cities-title"><h4 id="mapped-cities-title">State warehouse</h4>' + (hub
        ? '<button type="button" class="city-pick' + (UI.sel === hub.id ? ' is-current' : '') + '" aria-pressed="' + (UI.sel === hub.id) + '" data-act="cityPanel" data-a="' + hub.id + '"><span class="city-copy"><b>' + U.esc(hub.name) + ' hub</b><small>' + U.esc(warehouse ? 'Warehouse · level ' + warehouse.level : 'Unlock this state to establish a warehouse') + '</small></span><span class="tag' + (warehouse ? '' : ' warn') + '">' + (warehouse ? 'Open' : 'Locked') + '</span></button>'
        : '<p class="coverage-note">A service hub is not available for this region.</p>') + '</section>';
      const regionBrowser = '<section class="region-browser" aria-label="States and territories"><h4>States and territories</h4><input id="regionSearch" class="region-search" type="search" placeholder="Find a state or territory" aria-label="Find a state or territory"><div class="region-list">' + regions + '</div></section>';
      return '<div class="region-summary"><div><p class="eyebrow">Selected region</p><h2>' + U.esc(region.name) + '</h2></div><span class="tag' + (warehouse ? '' : ' warn') + '">' + U.esc(coverage) + '</span></div>' + cityPanel + regionBrowser;
    },
    orders() {
      const x = g(), list = x.orders.filter((o) => o.status === 'new' || o.status === 'transit');
      const done = x.orders.filter((o) => o.status === 'completed').slice(-3).reverse();
      const phases = { load: 'Packing', travel: 'In transit', unload: 'Unloading' };
      const availability = IPM.O.availability();
      const availabilitySummary = '<div class="availability-heading"><span>Vehicle availability</span><small>All warehouses</small></div><div class="availability-summary" aria-label="Company-wide vehicle availability"><span><b>' + availability.available + '</b> Available</span><span><b>' + availability.working + '</b> Working</span><span><b>' + availability.returning + '</b> Returning</span><span><b>' + availability.maintenance + '</b> Maintenance</span></div>';
      return '<h3>Orders <span class="order-count">(' + list.length + ' open)</span></h3>' + availabilitySummary + (list.length ? '' : '<p class="mu">No open orders. Enquiries arrive from phone, website, app and walk-ins.</p>') + list.map((o) => {
        const c = D.city(o.dest), isNew = o.status === 'new', manualVehicles = isNew && !x.settings.autoDispatch ? IPM.O.vehicleCandidates(o) : [], r = isNew ? IPM.O.resources(o, manualVehicles.length ? manualVehicles[0].id : undefined) : null, v = r && r.v;
        const cs = v ? IPM.O.cost(o, v) : null, recommended = IPM.O.recommendVehicle(o);
        const vehiclePicker = isNew && !x.settings.autoDispatch ? '<label class="manual-vehicle-label" for="manual-' + U.esc(o.id) + '">Vehicle</label><select id="manual-' + U.esc(o.id) + '" data-manual-vehicle="' + U.esc(o.id) + '"' + (!manualVehicles.length ? ' disabled' : '') + '>' + (manualVehicles.length ? manualVehicles.map((vehicle) => '<option value="' + U.esc(vehicle.id) + '">' + U.esc(vehicle.name) + ' · ' + IPM.F.effCap(vehicle) + ' units</option>').join('') : '<option value="">No compatible vehicle ready</option>') + '</select>' : '';
        return '<div class="card order-card" data-order-id="' + U.esc(o.id) + '"><div class="row"><b>' + U.esc(D.city(o.whId).name) + ' → ' + U.esc(c.name) + '</b><span class="tag">' + U.esc(D.SOURCES[o.src].label) + '</span></div><div class="mu">' + U.esc(o.cust) + ' · ' + D.SIZES[o.size].label + ' · ' + o.units + ' units · ' + o.dist + ' km · ' + D.URG[o.urg].label + (o.fragile ? ' · ' + o.fragile + ' fragile' : '') + '</div><div class="mu">' + U.esc(o.items.slice(0, 5).join(', ')) + '…</div>' + (recommended ? '<div class="order-recommendation">Recommended vehicle: <b>' + U.esc(recommended.type) + '</b>' + (recommended.owned ? '' : ' <span class="mu">(purchase required)</span>') + '</div>' : '') + '<div class="row"><span>Quote <b>' + U.money(o.price) + '</b>' + (cs ? ' <span class="mu">costs ~' + U.money(cs.fuel + cs.maint + cs.mat) + ' → profit ~' + U.money(o.price - cs.fuel - cs.maint - cs.mat) + '</span>' : '') + '</span></div>' +
          (isNew ? '<div class="row mu"><span>Expires in <span class="order-expiry">' + U.time(o.expire - x.time) + '</span></span></div>' + vehiclePicker + (r.why ? '<div class="warn">' + U.esc(r.why) + '</div>' : '<div class="good">Vehicle and crew ready · ' + U.esc(v.name) + '</div>') + '<div class="row">' + btn('accept', o.id, 'Accept', 'g', !!r.why) + btn('reject', o.id, 'Reject', 'n') + '</div>'
            : '<div class="row"><span class="tag order-phase">' + phases[o.phase] + '</span><span class="mu">Time left <span class="order-remaining">' + U.time(IPM.O.remaining(o)) + '</span></span></div><div class="bar order-progress" role="progressbar" aria-label="' + phases[o.phase] + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(IPM.O.progress(o) * 100) + '"><i style="width:' + Math.round(IPM.O.progress(o) * 100) + '%"></i></div>') + '</div>';
      }).join('') + (done.length ? '<h4>Recent</h4>' + done.map((o) => '<div class="mu">' + o.id + ' ' + D.city(o.dest).name + ' +' + U.money(o.paid) + (o.late ? ' (late)' : '') + '</div>').join('') : '');
    },
    fleet() {
      const x = g();
      const owned = x.vehicles.length ? x.vehicles.map((v) => {
        const type = D.VEH[v.type], order = v.orderId && S.ord(v.orderId);
        const returning = v.status === 'Returning' && v.ret;
        const working = ['Loading', 'In Transit', 'Unloading'].includes(v.status);
        const status = returning ? 'Returning' : v.status === 'Idle' ? (v.cond >= C.wear.minCond ? 'Available' : 'Needs service') : v.status === 'Maintenance' ? 'In maintenance' : v.status;
        const assignment = returning ? 'To ' + U.esc(D.city(v.ret.to).name) + ' Warehouse · ' + U.time(Math.max(0, v.ret.dur - v.ret.t)) + ' remaining' : working && order ? U.esc(D.city(order.whId).name) + ' → ' + U.esc(D.city(order.dest).name) + ' · ' + (order.phase === 'load' ? 'Packing' : order.phase === 'travel' ? 'In transit' : 'Unloading') : 'Based at ' + U.esc(D.city(v.whId).name);
        return '<article class="card vehicle-card"><div class="vehicle-card-head">' + vehicleArt(v.type, type.name) + '<div class="vehicle-card-title"><b>' + U.esc(v.name) + '</b><small>' + U.esc(type.name) + ' · ' + U.esc(v.plate) + '</small></div><span class="tag' + (v.status === 'Idle' && v.cond >= C.wear.minCond ? '' : ' warn') + '">' + status + '</span></div><p class="mu">' + assignment + '</p><div class="vehicle-facts"><span>Capacity <b>' + IPM.F.effCap(v) + ' units</b></span><span>Condition <b>' + Math.round(v.cond) + '%</b></span><span>Trips <b>' + v.trips + '</b></span></div><div class="row">' + btn('repair', v.id, 'Repair ' + U.money(IPM.F.repairCost(v)), 'n', v.cond >= 100 || v.status !== 'Idle') + btn('sell', v.id, 'Sell ' + U.money(IPM.F.sellValue(v)), 'n', v.status !== 'Idle') + '</div></article>';
      }).join('') : '<p class="empty-state">No vehicles owned yet. Buy a Mini Truck to take your first orders.</p>';
      const marketTypes = D.VEHICLES.filter((type) => IPM.P.reqOk(type.unlock));
      const market = marketTypes.map((t) => { const canAfford = x.cash >= t.price; return '<article class="card market-card">' + vehicleArt(t.id, t.name) + '<div class="market-card-copy"><div class="row"><b>' + U.esc(t.name) + '</b><strong>' + U.money(t.price) + '</strong></div><p class="mu">' + U.esc(t.sub) + '</p><p class="mu">Capacity ' + t.cap + ' units · Speed ' + t.speed + '</p>' + btn('buyveh', t.id, canAfford ? 'Buy vehicle' : 'Need ' + U.money(t.price - x.cash) + ' more', '', !canAfford) + '</div></article>'; }).join('');
      return '<h3>Vehicles</h3><section aria-labelledby="owned-vehicles-heading"><h4 id="owned-vehicles-heading">Owned vehicles <span class="section-count">' + x.vehicles.length + '</span></h4>' + owned + '</section><section aria-labelledby="vehicle-market-heading"><h4 id="vehicle-market-heading">Vehicle market</h4>' + market + (marketTypes.length < D.VEHICLES.length ? '<p class="mu">More vehicle types become available as your company grows.</p>' : '') + '</section>';
    },
    staff() {
      const x = g(), employees = x.employees, selected = new Set(UI.staffSelection);
      const managers = employees.filter((e) => ['supervisor', 'whManager', 'opsManager'].includes(e.role));
      const count = (list, status) => list.filter((e) => e.status === status).length;
      const summary = '<section class="staff-overview" aria-label="Workforce overview"><article class="staff-total"><span>Total employees</span><b>' + employees.length + '</b></article><article><span>Packers</span><b>' + employees.filter((e) => e.role === 'packer').length + '</b></article><article><span>Drivers</span><b>' + employees.filter((e) => e.role === 'driver').length + '</b></article><article><span>Managers</span><b>' + managers.length + '</b></article></section><p class="staff-status-summary">Working ' + count(employees, 'busy') + ' · Available ' + count(employees, 'idle') + ' · Training ' + count(employees, 'training') + ' · Assigned to warehouses ' + employees.filter((e) => !!e.whId).length + '</p>';
      const tabs = '<div class="staff-tabs" role="group" aria-label="Staff sections">' + [['workforce', 'Workforce'], ['hire', 'Hire Staff']].map(([id, label]) => '<button type="button" aria-pressed="' + (UI.staffView === id) + '" class="' + (UI.staffView === id ? 'is-active' : '') + '" data-act="staffView" data-a="' + id + '">' + label + '</button>').join('') + '</div>';
      const filters = [['all', 'All staff'], ['packer', 'Packers'], ['driver', 'Drivers'], ['manager', 'Managers']].map(([id, label]) => '<button type="button" class="staff-filter' + (UI.staffFilter === id ? ' is-active' : '') + '" aria-pressed="' + (UI.staffFilter === id) + '" data-act="staffFilter" data-a="' + id + '">' + label + '</button>').join('');
      const matches = (e) => UI.staffFilter === 'all' || e.role === UI.staffFilter || (UI.staffFilter === 'manager' && ['supervisor', 'whManager', 'opsManager'].includes(e.role));
      const rows = employees.filter(matches).map((e) => {
        const status = e.status === 'training' ? 'Training' : e.status === 'absent' ? 'Away from work' : e.status === 'busy' ? 'Working' : 'Available';
        const location = e.whId ? D.city(e.whId).name : 'Company-wide';
        return '<div class="staff-row"><label class="staff-select"><input type="checkbox" data-staff-select="' + U.esc(e.id) + '" aria-label="Select ' + U.esc(e.name) + '"' + (selected.has(e.id) ? ' checked' : '') + '><span class="sr-only">Select ' + U.esc(e.name) + '</span></label><span class="staff-row-main"><b>' + U.esc(e.name) + '</b><small>' + U.esc(D.ROLES[e.role].label) + ' · Level ' + e.level + ' · Skill ' + e.skill + ' · ' + U.esc(location) + '</small></span><span class="tag' + (e.status === 'idle' ? '' : ' warn') + '">' + status + '</span><button type="button" class="staff-profile-link" data-act="employeeProfile" data-a="' + U.esc(e.id) + '">Details</button></div>';
      }).join('');
      const selectedEmployees = employees.filter((e) => selected.has(e.id));
      const trainSummary = IPM.W.trainSummary(UI.staffSelection), dismissSummary = IPM.W.dismissSummary(UI.staffSelection);
      const blocked = Math.max(trainSummary.excluded.length, dismissSummary.excluded.length);
      const bulk = '<section class="staff-bulk" aria-label="Selected employee actions"><div><b>' + selectedEmployees.length + ' selected</b><small>' + (blocked ? 'Ineligible selections are skipped; each action shows who can participate.' : 'Choose employees individually before applying an action.') + '</small></div><div><button type="button" class="b n" data-act="previewTrain"' + (trainSummary.eligible.length ? '' : ' disabled') + '>Train selected</button><button type="button" class="b" data-act="previewDismiss"' + (dismissSummary.eligible.length ? '' : ' disabled') + '>Dismiss selected</button></div></section>';
      const candidates = (role) => {
        const R = D.ROLES[role];
        if (!IPM.P.reqOk(R.req)) return '<p class="mu">' + U.esc(R.label) + ' unlocks at ' + U.esc(IPM.P.reqText(R.req)) + '.</p>';
        const existing = role === 'opsManager' ? employees.some((e) => e.role === role) : role === 'whManager' && employees.some((e) => e.role === role && e.whId === UI.hireWarehouse);
        return IPM.W.cands(role).map((candidate) => '<article class="card candidate-card"><div><b>' + U.esc(candidate.name) + '</b><p class="mu">Skill ' + candidate.skill + '/10 · salary ' + U.money(candidate.wage) + '/pay cycle</p><p class="mu">' + U.esc(R.desc) + '</p></div><div class="candidate-action"><span>Hiring cost <b>' + U.money(candidate.recruit) + '</b></span>' + btn('hire', role + '|' + candidate.id, existing ? 'Position filled' : 'Hire', '', existing) + '</div></article>').join('');
      };
      const hireTarget = '<label class="hire-target-label" for="hireWarehouse">Assign location</label><select id="hireWarehouse" class="hire-target">' + x.warehouses.map((w) => '<option value="' + U.esc(w.id) + '"' + (UI.hireWarehouse === w.id ? ' selected' : '') + '>' + U.esc(D.city(w.id).name) + ' warehouse</option>').join('') + '</select>';
      const hire = '<section class="hire-pane"><h3>Hire staff</h3><p class="mu">Candidates are independent of the current workforce. Payroll runs every ' + C.payCycleSec + ' seconds.</p>' + hireTarget + '<h4>Packers</h4>' + candidates('packer') + '<h4>Drivers</h4>' + candidates('driver') + '<h4>Managers</h4>' + candidates('supervisor') + candidates('whManager') + candidates('opsManager') + '</section>';
      const workforce = '<section class="workforce-pane"><div class="staff-filters" aria-label="Filter staff">' + filters + '</div>' + bulk + '<div class="staff-list" aria-label="Employees">' + (rows || '<p class="empty-state">No employees in this group.</p>') + '</div></section>';
      return '<h3>Staff</h3>' + summary + tabs + (UI.staffView === 'hire' ? hire : workforce);
    },
    company() {
      const x = g(), people = x.employees.filter((e) => ['packer', 'driver'].includes(e.role));
      const count = (role) => people.filter((e) => e.role === role).length;
      if (!x.warehouses.some((w) => w.id === UI.hireWarehouse)) UI.hireWarehouse = x.warehouses[0] && x.warehouses[0].id;
      const upgrades = [['packTech', 'Better Packaging'], ['routeOptimization', 'Route Planning'], ['vehicleEngineering', 'Fleet Efficiency'], ['customerService', 'Customer Service']].map(([id, name]) => {
        const def = D.RD_CATEGORIES.find((item) => item.id === id), level = IPM.P.researchLevel(id), cost = IPM.P.researchCost(def, level + 1);
        return '<div class="company-upgrade"><div><b>' + name + '</b><small>Level ' + level + ' · ' + U.esc(IPM.P.researchBenefit(def, level)) + '</small></div>' + btn('companyUpgrade', id, 'Upgrade · ' + U.money(cost), 'n', level >= 10 || x.cash < cost) + '</div>';
      }).join('');
      const workforce = '<section class="company-section"><h3>Workforce</h3><div class="company-workforce-counts"><span>Packers <b>' + count('packer') + '</b></span><span>Drivers <b>' + count('driver') + '</b></span></div><label for="hireWarehouse">Hire at</label><select id="hireWarehouse">' + x.warehouses.map((w) => '<option value="' + U.esc(w.id) + '"' + (UI.hireWarehouse === w.id ? ' selected' : '') + '>' + U.esc(D.city(w.id).name) + '</option>').join('') + '</select>' + ['packer', 'driver'].map((role) => { const candidate = IPM.W.cands(role)[0], label = role === 'packer' ? 'Hire Packer' : 'Hire Driver'; return '<div class="company-hire-row"><span>' + label + '<small>' + U.money(candidate.wage) + ' salary per pay cycle</small></span>' + btn('quickHire', role, 'Hire · ' + U.money(candidate.recruit), 'n') + '</div>'; }).join('') + '</section>';
      const fleetGroups = new Map();
      x.vehicles.forEach((vehicle) => {
        const typeName = D.VEH[vehicle.type].name;
        const statusName = vehicle.status === 'Idle' ? vehicle.cond < C.wear.minCond ? 'Needs service' : 'Available' : vehicle.status === 'Maintenance' ? 'In maintenance' : vehicle.status === 'Returning' ? 'Returning' : 'Working';
        const key = typeName + ' · ' + statusName;
        if (!fleetGroups.has(key)) fleetGroups.set(key, []);
        fleetGroups.get(key).push(vehicle);
      });
      const vehicles = Array.from(fleetGroups, ([groupName, group]) => '<section class="company-fleet-group"><h4>' + U.esc(groupName) + ' <span class="section-count">' + group.length + '</span></h4>' + group.map((v) => {
        const cap = D.VUP.cap, loaded = v.dispatch ? v.dispatch.cargoUnits : 0;
        return '<div class="company-vehicle-row"><div><b>' + U.esc(v.name) + '</b><small>Cargo ' + loaded + ' / ' + IPM.F.effCap(v) + ' units · ' + U.esc(D.city(v.whId).name) + ' base</small></div><div class="company-vehicle-actions">' + (v.status === 'Idle' && v.cond < 100 ? btn('repair', v.id, 'Repair · ' + U.money(IPM.F.repairCost(v)), 'n') : '') + (v.status === 'Idle' && v.upg.cap < cap.max ? btn('vehUpgrade', v.id, 'Capacity · ' + U.money(IPM.F.upgradeCost(v, 'cap')), 'n', x.cash < IPM.F.upgradeCost(v, 'cap')) : '') + (v.status === 'Idle' ? btn('sell', v.id, 'Sell · ' + U.money(IPM.F.sellValue(v)), 'n') : '') + '</div></div>';
      }).join('') + '</section>').join('');
      const market = D.VEHICLES.filter((v) => IPM.P.reqOk(v.unlock)).map((v) => btn('buyveh', v.id, 'Buy ' + v.name + ' · ' + U.money(v.price), 'n', x.cash < v.price)).join('');
      const lockedMarket = D.VEHICLES.filter((v) => !IPM.P.reqOk(v.unlock)).map((v) => '<p class="mu company-locked-vehicle">' + U.esc(v.name) + ' · ' + U.esc(IPM.P.reqText(v.unlock)) + '</p>').join('');
      const xp = IPM.P.xpInfo();
      const loan = '<section class="company-section"><h3>Finances</h3><p class="mu">Debt ' + U.money(x.debt) + (x.debt ? ' · Interest ' + Math.round(C.loan.rate * 100) + '% every ' + Math.round(C.loan.cycleSec / 60) + ' minutes · instalments ' + U.money(C.loan.installment) : ' · No outstanding loan') + '</p><div class="company-finance-actions">' + btn('borrow', '', 'Borrow ' + U.money(C.loan.step), 'n', x.debt + C.loan.step > E.maxDebt()) + btn('repay', '', 'Repay ' + U.money(C.loan.step), 'n', !x.debt) + '</div></section>';
      return '<h3>Company</h3><div class="company-summary"><span>Level <b>' + x.level + '</b></span><span>Cash <b>' + U.money(x.cash) + '</b></span><span>Reputation <b>' + IPM.P.stars().toFixed(1) + '/5</b></span><span>Deliveries <b>' + x.stats.deliveries + '</b></span><span>Vehicles <b>' + x.vehicles.length + '</b></span><span>Workers <b>' + x.employees.length + '</b></span></div><div class="company-progress"><span>Progress to level ' + (x.level + 1) + '</span><div class="bar"><i style="width:' + Math.round(xp.pct) + '%"></i></div></div><section class="company-section"><h3>Company upgrades</h3>' + upgrades + '</section>' + workforce + '<section class="company-section"><h3>Fleet</h3>' + (vehicles || '<p class="mu">No vehicles yet.</p>') + '<div class="company-vehicle-market">' + market + '</div>' + lockedMarket + '</section>' + loan;
    },
    market() {
      const companyTabs = '<div class="company-tabs" role="group" aria-label="Company management"><button type="button" aria-pressed="' + (UI.companyView === 'marketing') + '" class="' + (UI.companyView === 'marketing' ? 'is-active' : '') + '" data-act="companyView" data-a="marketing">Marketing</button><button type="button" aria-pressed="' + (UI.companyView === 'research') + '" class="' + (UI.companyView === 'research' ? 'is-active' : '') + '" data-act="companyView" data-a="research">Research &amp; Development</button></div>';
      if (UI.companyView === 'research') return '<h3>Company</h3>' + companyTabs + UI.panels.research();
      const x = g(), target = UI.marketingTarget === 'all' || !S.wh(UI.marketingTarget) ? 'all' : UI.marketingTarget;
      const options = '<option value="all"' + (target === 'all' ? ' selected' : '') + '>All company locations</option>' + x.warehouses.map((w) => '<option value="' + U.esc(w.id) + '"' + (target === w.id ? ' selected' : '') + '>' + U.esc(D.city(w.id).name) + ' only</option>').join('');
      const campaigns = Object.keys(D.CAMPAIGNS).map((k) => {
        const d = D.CAMPAIGNS[k], campaign = IPM.M.active(k, target), cost = IPM.M.cost(d, target);
        const controls = !IPM.P.reqOk(d.req) ? '<span class="tag">Locked: ' + U.esc(IPM.P.reqText(d.req)) + '</span>' : campaign ? '<div class="campaign-running"><span class="tag">Active · ' + U.time(campaign.end - x.time) + ' left</span><span class="mu">Spent ' + U.money(campaign.spent || 0) + ' / ' + U.money(campaign.costTotal || cost) + ' · leads ' + (campaign.leads || 0) + '</span>' + btn('stopcmp', campaign.id, 'Stop campaign', 'n') + '</div>' : btn('cmp', k, 'Launch · ' + U.money(cost), '', x.cash < cost);
        return '<article class="card campaign-card"><div class="row"><b>' + U.esc(d.name) + '</b><span>' + U.money(cost) + '</span></div><p class="mu">' + U.esc(d.desc) + '</p><p class="mu">' + U.esc(IPM.M.effectText(k)) + ' · ' + U.time(d.dur) + ' duration</p>' + controls + '</article>';
      }).join('');
      return '<h3>Company</h3>' + companyTabs + '<h3>Marketing</h3><p class="mu">Choose an all-location campaign or target an owned city. Leads count only enquiries received while a campaign is active.</p><label class="campaign-target-label" for="marketingTarget">Campaign target</label><select id="marketingTarget" class="campaign-target">' + options + '</select><h4>Marketing campaigns</h4>' + campaigns + '<div class="card"><b>' + U.esc(D.SEO.name) + '</b> (level ' + x.seo + '/' + D.SEO.max + ')<p class="mu">' + U.esc(D.SEO.desc) + '</p>' + btn('seo', '', 'Upgrade ' + U.money(IPM.M.seoCost()), '', x.seo >= D.SEO.max || !IPM.P.reqOk(D.SEO.req)) + '</div>';
    },
    finance() {
      const x = g(), f = x.fin, r = E.rate(), t = E.nextPayroll();
      return '<h3>Finance</h3><div class="card">Cash ' + U.money(x.cash) + '<br>Debt ' + U.money(x.debt) + ' (max ' + U.money(E.maxDebt()) + ')<br>Lifetime revenue ' + U.short(f.lifetimeRevenue) + ' · expenses ' + U.short(f.lifetimeExpense) + '<br>Net/min ' + U.money(r.netPerMin) + ' · next payroll ' + U.time(t) + (f.wagesOwed ? '<br><span class="bad">Wages owed ' + U.money(f.wagesOwed) + '</span>' : '') + '<div class="row" style="margin-top:8px">' + btn('borrow', '', 'Borrow ' + U.money(C.loan.step), '', x.debt + C.loan.step > E.maxDebt()) + btn('repay', '', 'Repay ' + U.money(C.loan.step), 'n', !x.debt) + '</div></div><h4>Ledger</h4>' + x.ledger.slice(0, 25).map((l) => '<div class="row mu"><span>' + U.esc(l.note) + '</span><span class="' + (l.amt > 0 ? 'good' : 'bad') + '">' + U.money(l.amt) + '</span></div>').join('');
    },
    stats() {
      const s = g().stats;
      return '<h3>Analytics</h3><section class="card reputation-breakdown" aria-labelledby="rep-heading"><div class="row"><b id="rep-heading">Company reputation</b><strong>' + IPM.P.stars().toFixed(1) + '/5</strong></div><p class="mu">Customer trust reflects service quality. On-time, undamaged deliveries build it; late or damaged deliveries and expired enquiries can reduce it.</p><div class="reputation-facts"><span>Successful deliveries <b>' + s.deliveries + '</b></span><span>On time <b>' + s.onTime + '</b></span><span>Late <b>' + s.late + '</b></span><span>Damaged goods <b>' + s.damaged + '</b></span><span>Expired enquiries <b>' + s.expired + '</b></span><span>Rejected enquiries <b>' + s.rejected + '</b> <small>no reputation change</small></span><span>Cancelled orders <b>Not tracked</b></span><span>Average delivery score <b>' + (s.ratingCount ? (s.ratingSum / s.ratingCount).toFixed(2) + '/5' : 'No deliveries yet') + '</b><small>Outcome score from timing and condition</small></span></div></section><div class="card">Average completed delivery time <b>' + (s.deliveries ? U.time(s.timeSum / s.deliveries) : '–') + '</b></div><div class="card"><b>By channel</b>' + Object.keys(s.bySource).map((k) => '<div class="row"><span>' + D.SOURCES[k].label + '</span><span class="mu">' + s.bySource[k].orders + ' orders · ' + s.bySource[k].done + ' done · ' + U.money(s.bySource[k].revenue) + '</span></div>').join('') + '</div><div class="card"><b>Route profit</b>' + (Object.keys(s.routes).sort((a, b) => s.routes[b] - s.routes[a]).slice(0, 6).map((k) => '<div class="row"><span>' + k.split('>').map((i) => D.city(i).name).join(' → ') + '</span><span>' + U.money(s.routes[k]) + '</span></div>').join('') || '<span class="mu">No routes yet.</span>') + '</div>' + '<h4>Milestones</h4>' + D.MILESTONES.map((m) => '<div class="' + (g().milestones[m.id] ? 'good' : 'mu') + '">' + (g().milestones[m.id] ? '✓ ' : '○ ') + m.name + ' — ' + m.desc + '</div>').join('');
    },
    settings() {
      const st = g().settings;
      return '<h3>Settings</h3><div class="card"><div class="row"><span>Vehicle dispatch</span><button type="button" class="b n" data-act="toggleDispatch" aria-pressed="' + !!g().settings.autoDispatch + '">' + (g().settings.autoDispatch ? 'Automatic' : 'Choose vehicle per order') + '</button></div><p class="mu">Automatic assignment is recommended. Manual mode lets you pick an available vehicle when accepting an order.</p>' + btn('save', '', 'Save now', 'n') + ' ' + btn('newgame', '', 'Reset progress') + '<p class="mu">Autosaves every ' + C.autosaveSec + 's. Starting and unlocked state hubs appear on the India map.</p></div>';
    },
  };
  const subTabs = {
    company: [['overview', 'Overview'], ['workforce', 'Team']],
    orders: [['incoming', 'Incoming'], ['active', 'Active'], ['completed', 'Completed']],
    fleet: [['vehicles', 'Vehicles'], ['warehouses', 'Warehouses'], ['maintenance', 'Maintenance']],
    revenue: [['analytics', 'Analytics'], ['income', 'Income'], ['expenses', 'Expenses'], ['loans', 'Loans']],
  };
  const subState = { company: 'companyView', orders: 'ordersView', fleet: 'fleetView', revenue: 'revenueView' };
  const currentSub = () => UI[subState[UI.tab]];
  const switchButtons = (items, action, selected) => items.map(([id, label]) => '<button type="button" role="tab" aria-selected="' + (id === selected) + '" class="game-tab' + (id === selected ? ' is-active' : '') + '" data-act="' + action + '" data-a="' + id + '">' + label + '</button>').join('');

  panels.company = () => {
    const x = g(), xp = IPM.P.xpInfo(), view = UI.companyView;
    if (!x.warehouses.some((w) => w.id === UI.hireWarehouse)) UI.hireWarehouse = x.warehouses[0] && x.warehouses[0].id || '';
    if (!x.warehouses.some((w) => w.id === UI.hireWarehouse)) UI.hireWarehouse = x.warehouses[0] && x.warehouses[0].id;
    if (view === 'warehouse') {
      const city = D.city(UI.sel), vehicles = x.vehicles.filter((v) => v.whId === UI.sel);
      const workers = x.employees.filter((e) => e.whId === UI.sel && ['packer', 'driver'].includes(e.role));
      const count = (status) => vehicles.filter((v) => v.status === status).length;
      const incoming = x.orders.filter((o) => o.status === 'new' && o.whId === UI.sel).length;
      const activity = S.owns(UI.sel) ? '<div class="warehouse-activity"><span>Vehicles <b>' + count('Idle') + ' ready · ' + count('Loading') + count('In Transit') + count('Unloading') + ' working · ' + count('Returning') + ' returning</b></span><span>Workers <b>' + workers.filter((e) => e.status === 'idle').length + ' available / ' + workers.length + '</b></span><span>Incoming <b>' + incoming + ' orders</b></span></div>' : '';
      return '<div class="panel-location"><span>Selected location</span><b>' + U.esc(city ? city.name : 'Service hub') + '</b></div>' + activity + IPM.UI.panels.wh();
    }
    if (view === 'workforce') {
      const packers = x.employees.filter((e) => e.role === 'packer').length, drivers = x.employees.filter((e) => e.role === 'driver').length;
      const candidates = ['packer', 'driver'].map((role) => {
        const candidate = IPM.W.cands(role)[0], label = role === 'packer' ? 'Hire packer' : 'Hire driver';
        return '<div class="game-row"><div><b>' + label + '</b><small>' + U.money(candidate.wage) + ' wages per cycle</small></div>' + btn('quickHire', role, 'Hire · ' + U.money(candidate.recruit), 'n') + '</div>';
      }).join('');
      const choices = x.warehouses.map((w) => '<option value="' + U.esc(w.id) + '"' + (UI.hireWarehouse === w.id ? ' selected' : '') + '>' + U.esc(D.city(w.id).name) + '</option>').join('');
      return '<div class="workforce-counts"><span>Packers <b>' + packers + '</b></span><span>Drivers <b>' + drivers + '</b></span></div><label class="game-field-label" for="hireWarehouse">Assign hires to</label><select id="hireWarehouse" class="game-select">' + choices + '</select>' + candidates;
    }
    return '<div class="panel-location"><span>Company overview</span><b>Level ' + x.level + ' · ' + IPM.P.levelName(x.level) + '</b></div>' +
      '<div class="progress-line"><span>Progress to level ' + (x.level + 1) + '</span><b>' + Math.round(xp.pct) + '%</b></div><div class="game-progress"><i style="width:' + Math.round(xp.pct) + '%"></i></div>' +
      '<div class="overview-line"><span>Reputation</span><b>' + IPM.P.stars().toFixed(1) + ' / 5</b></div><div class="overview-line"><span>Deliveries completed</span><b>' + x.stats.deliveries + '</b></div><div class="overview-line"><span>Vehicles · workers</span><b>' + x.vehicles.length + ' · ' + x.employees.length + '</b></div><div class="overview-line"><span>State warehouses</span><b>' + x.warehouses.length + '</b></div><button class="game-link" type="button" data-play-section="revenue">Open operating analytics</button>';
  };

  panels.orders = () => {
    const x = g(), view = UI.ordersView, availability = IPM.O.availability();
    const orderSet = view === 'incoming' ? x.orders.filter((o) => o.status === 'new') : view === 'active' ? x.orders.filter((o) => o.status === 'transit') : x.orders.filter((o) => o.status === 'completed').slice(-25).reverse();
    const phaseNames = { load: 'Packing', travel: 'On route', unload: 'Unloading' };
    const readiness = '<div class="fleet-readiness"><span>Ready <b>' + availability.available + '</b></span><span>Working <b>' + availability.working + '</b></span><span>Return <b>' + availability.returning + '</b></span><span>Service <b>' + availability.maintenance + '</b></span></div>';
    if (!orderSet.length) return readiness + '<p class="game-empty">' + (view === 'incoming' ? 'Waiting for new enquiries.' : view === 'active' ? 'No deliveries are underway.' : 'Completed deliveries will appear here.') + '</p>';
    return readiness + orderSet.map((o) => {
      const isNew = o.status === 'new', dest = D.city(o.dest), recommended = IPM.O.recommendVehicle(o), vehicleOptions = !x.settings.autoDispatch && isNew ? IPM.O.vehicleCandidates(o) : [];
      const resources = isNew ? IPM.O.resources(o, vehicleOptions.length ? vehicleOptions[0].id : undefined) : null;
      const vehicle = resources && resources.v, cost = vehicle ? IPM.O.cost(o, vehicle) : null;
      const picker = isNew && !x.settings.autoDispatch ? '<label class="game-field-label" for="manual-' + U.esc(o.id) + '">Dispatch with</label><select class="game-select" id="manual-' + U.esc(o.id) + '" data-manual-vehicle="' + U.esc(o.id) + '"' + (!vehicleOptions.length ? ' disabled' : '') + '>' + (vehicleOptions.length ? vehicleOptions.map((v) => '<option value="' + U.esc(v.id) + '">' + U.esc(v.name) + ' · ' + IPM.F.effCap(v) + ' units</option>').join('') : '<option value="">No compatible vehicle ready</option>') + '</select>' : '';
      const goods = D.SIZES[o.size].label + ' · ' + o.units + ' units' + (o.fragile ? ' · ' + o.fragile + ' fragile' : '');
      const economics = '<div class="order-money"><span>Quote <b>' + U.money(o.price) + '</b></span>' + (cost ? '<span>Est. profit <b>' + U.money(o.price - cost.fuel - cost.maint - cost.mat) + '</b></span>' : '') + '</div>';
      const details = isNew ? '<div class="order-facts"><span>' + U.esc(o.cust) + ' · ' + U.esc(goods) + ' · ' + o.dist + ' km · ' + U.esc(D.URG[o.urg].label) + '</span><span>Vehicle ' + U.esc(recommended ? recommended.type : 'none owned') + ' · Expires <span class="order-expiry">' + U.time(o.expire - x.time) + '</span></span></div>' + economics + picker + (resources.why ? '<small class="order-alert">' + U.esc(resources.why) + '</small>' : '<small class="order-ready">Crew ready · ' + U.esc(vehicle.name) + '</small>') + '<div class="order-actions">' + btn('accept', o.id, 'Accept', 'g', !!resources.why) + btn('reject', o.id, 'Reject', 'n') + '</div>'
        : view === 'active' ? '<div class="order-facts"><span>' + U.esc(goods) + ' · ' + o.dist + ' km · ' + U.esc(D.URG[o.urg].label) + '</span><span><b class="order-phase">' + U.esc(phaseNames[o.phase]) + '</b> · <span class="order-remaining">' + U.time(IPM.O.remaining(o)) + '</span> left</span></div><div class="bar order-progress" role="progressbar" aria-label="' + U.esc(phaseNames[o.phase]) + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(IPM.O.progress(o) * 100) + '"><i style="width:' + Math.round(IPM.O.progress(o) * 100) + '%"></i></div>'
        : '<div class="order-facts"><span>' + U.esc(goods) + ' · ' + o.dist + ' km</span><span>' + (o.late ? 'Late delivery' : 'Completed') + (o.damaged ? ' · Cargo damaged' : '') + '</span></div>' + economics;
      return '<article class="order-entry order-card" data-order-id="' + U.esc(o.id) + '"><header><b>' + U.esc(D.city(o.whId).name) + ' → ' + U.esc(dest ? dest.name : 'Unknown') + '</b>' + (isNew ? '<span class="order-source">' + U.esc(D.SOURCES[o.src].label) + '</span>' : '') + '</header>' + details + '</article>';
    }).join('');
  };

  panels.fleet = () => {
    const x = g(), view = UI.fleetView;
    if (!x.warehouses.some((w) => w.id === UI.hireWarehouse)) UI.hireWarehouse = x.warehouses[0] && x.warehouses[0].id || '';
    if (view === 'warehouses') {
      if (!UI.mapCityPanel && !S.owns(UI.sel)) UI.sel = x.warehouses[0] && x.warehouses[0].id || '';
      const selected = D.city(UI.sel), owned = S.owns(UI.sel);
      const whRows = x.warehouses.map((w) => '<button type="button" class="warehouse-entry' + (w.id === UI.sel ? ' is-selected' : '') + '" data-act="warehousePanel" data-a="' + U.esc(w.id) + '"><span><b>' + U.esc(D.city(w.id).name) + '</b><small>' + U.esc((D.START_REGIONS.states.concat(D.START_REGIONS.unionTerritories).find((r) => r[0] === D.city(w.id).state) || ['', ''])[1]) + '</small></span><span>Level ' + w.level + '</span></button>').join('');
      if (UI.mapCityPanel && selected) {
        const vehicles = x.vehicles.filter((v) => v.whId === UI.sel), workers = x.employees.filter((e) => e.whId === UI.sel && ['packer', 'driver'].includes(e.role));
        const summary = owned ? '<div class="warehouse-activity"><span>Vehicles <b>' + vehicles.filter((v) => v.status === 'Idle' && v.cond >= C.wear.minCond).length + ' ready · ' + vehicles.filter((v) => ['Loading', 'In Transit', 'Unloading'].includes(v.status)).length + ' working · ' + vehicles.filter((v) => v.status === 'Returning').length + ' returning</b></span><span>Workers <b>' + workers.filter((e) => e.status === 'idle').length + ' available / ' + workers.length + '</b></span><span>Incoming <b>' + x.orders.filter((o) => o.status === 'new' && o.whId === UI.sel).length + ' orders</b></span></div>' : '';
        return '<button type="button" class="game-link" data-act="warehouseList">All warehouses</button>' + summary + IPM.UI.panels.wh();
      }
      const city = selected || D.city(x.warehouses[0] && x.warehouses[0].id);
      return '<p class="panel-location"><span>Warehouse network</span><b>' + x.warehouses.length + ' operating locations</b></p>' + whRows + (city ? '<div class="warehouse-activity"><span>Incoming orders <b>' + x.orders.filter((o) => o.status === 'new' && o.whId === city.id).length + '</b></span><span>Vehicles at base <b>' + x.vehicles.filter((v) => v.whId === city.id).length + '</b></span></div>' : '');
    }
    if (view === 'maintenance') {
      const needsService = x.vehicles.filter((v) => v.status === 'Maintenance' || (v.status === 'Idle' && v.cond < 100));
      return needsService.length ? needsService.map((v) => '<div class="game-row"><div><b>' + U.esc(v.name) + '</b><small>' + U.esc(D.VEH[v.type].name) + ' · ' + Math.round(v.cond) + '% condition · ' + (v.status === 'Maintenance' ? 'In workshop' : 'Needs repair') + '</small></div>' + btn('repair', v.id, 'Repair · ' + U.money(IPM.F.repairCost(v)), 'n', v.status !== 'Idle' || v.cond >= 100) + '</div>').join('') : '<p class="game-empty">Fleet is ready. No vehicles need service.</p>';
    }
    const groups = new Map();
    x.vehicles.forEach((v) => {
      const status = v.status === 'Idle' ? v.cond >= C.wear.minCond ? 'Available' : 'Needs service' : v.status === 'Returning' ? 'Returning' : ['Loading', 'In Transit', 'Unloading'].includes(v.status) ? 'Working' : v.status;
      const key = D.VEH[v.type].name + ' · ' + status;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    });
    const list = Array.from(groups, ([group, vehicles]) => '<div class="fleet-group"><p>' + U.esc(group) + ' <span>' + vehicles.length + '</span></p>' + vehicles.map((v) => '<button type="button" class="vehicle-entry' + (v.id === UI.selectedVehicle ? ' is-selected' : '') + '" data-act="selectVehicle" data-a="' + U.esc(v.id) + '"><b>' + U.esc(v.name) + '</b><span>' + IPM.F.effCap(v) + ' units</span><span>' + (v.dispatch ? v.dispatch.cargoUnits + ' loaded' : '0 loaded') + '</span></button>').join('') + '</div>').join('');
    const v = S.veh(UI.selectedVehicle);
    const journeyOrder = v && v.orderId ? S.ord(v.orderId) : null;
    const journey = v && v.status === 'Returning' && v.ret ? D.city(v.ret.to).name + ' · ' + U.time(Math.max(0, v.ret.dur - v.ret.t)) + ' left' : journeyOrder ? D.city(journeyOrder.whId).name + ' → ' + D.city(journeyOrder.dest).name + ' · ' + U.time(IPM.O.remaining(journeyOrder)) + ' left' : 'At ' + (v ? D.city(v.whId).name : 'warehouse');
    const selected = v ? '<div class="vehicle-details"><b>' + U.esc(v.name) + '</b><span>' + U.esc(D.VEH[v.type].name) + ' · ' + Math.round(v.cond) + '% · ' + U.esc(journey) + '</span><div>' + btn('repair', v.id, 'Repair ' + U.money(IPM.F.repairCost(v)), 'n', v.status !== 'Idle' || v.cond >= 100) + btn('vehUpgrade', v.id, 'Capacity', 'n', v.status !== 'Idle' || v.upg.cap >= D.VUP.cap.max || x.cash < IPM.F.upgradeCost(v, 'cap')) + btn('sell', v.id, 'Sell ' + U.money(IPM.F.sellValue(v)), 'n', v.status !== 'Idle') + '</div></div>' : '';
    const market = D.VEHICLES.map((type) => IPM.P.reqOk(type.unlock) ? btn('buyveh', type.id, 'Buy ' + type.name + ' · ' + U.money(type.price), 'n', x.cash < type.price) : '<small class="locked-entry">' + U.esc(type.name) + ' · ' + U.esc(IPM.P.reqText(type.unlock)) + '</small>').join('');
    const baseOptions = x.warehouses.map((w) => '<option value="' + U.esc(w.id) + '"' + (UI.hireWarehouse === w.id ? ' selected' : '') + '>' + U.esc(D.city(w.id).name) + '</option>').join('');
    return (list || '<p class="game-empty">No vehicles yet. Choose a truck below.</p>') + selected + '<label class="game-field-label" for="hireWarehouse">Purchase at</label><select id="hireWarehouse" class="game-select">' + baseOptions + '</select><div class="fleet-market">' + market + '</div>';
  };

  panels.revenue = () => {
    const x = g(), f = x.fin, view = UI.revenueView;
    const rate = E.rate(), rateSummary = '<section class="card rate-summary"><b>Current operating rate</b><div class="overview-line"><span>Cost per minute</span><b>' + U.money(rate.expPerMin) + '</b></div><div class="overview-line"><span>Estimated cost per hour</span><b>' + U.money(rate.expPerMin * 60) + '</b></div><div class="overview-line"><span>Net per minute</span><b>' + U.money(rate.netPerMin) + '</b></div></section>';
    if (view === 'analytics') return UI.panels.stats() + '<section class="card"><b>Operating rate</b><div class="overview-line"><span>Income per minute</span><b>' + U.money(rate.revPerMin) + '</b></div><div class="overview-line"><span>Operating costs per minute</span><b>' + U.money(rate.expPerMin) + '</b></div><div class="overview-line"><span>Estimated costs per hour</span><b>' + U.money(rate.expPerMin * 60) + '</b></div><div class="overview-line"><span>Net per minute</span><b>' + U.money(rate.netPerMin) + '</b></div></section>';
    if (view === 'loans') return rateSummary + '<div class="panel-location"><span>Company debt</span><b>' + U.money(x.debt) + ' outstanding</b></div><p class="revenue-note">Interest ' + Math.round(C.loan.rate * 100) + '% every ' + Math.round(C.loan.cycleSec / 60) + ' minutes. Instalments ' + U.money(C.loan.installment) + '.</p><div class="game-actions">' + btn('borrow', '', 'Borrow ' + U.money(C.loan.step), 'n', x.debt + C.loan.step > E.maxDebt()) + btn('repay', '', 'Repay ' + U.money(C.loan.step), 'n', !x.debt) + '</div>';
    const income = view === 'income', rows = x.ledger.filter((entry) => income ? entry.cat === 'revenue' : E.OP_COSTS.includes(entry.cat) && entry.amt < 0).slice(0, 25);
    const total = income ? f.lifetimeRevenue : f.lifetimeExpense;
    return '<div class="panel-location"><span>Lifetime ' + (income ? 'income' : 'operating expenses') + '</span><b>' + U.short(total) + '</b></div>' + (f.wagesOwed && !income ? '<p class="order-alert">Wages owed ' + U.money(f.wagesOwed) + '</p>' : '') + (rows.length ? rows.map((entry) => '<div class="ledger-entry"><span>' + U.esc(entry.note) + '</span><b class="' + (income ? 'positive' : 'negative') + '">' + U.money(entry.amt) + '</b></div>').join('') : '<p class="game-empty">No ' + (income ? 'delivery income' : 'operating expenses') + ' recorded yet.</p>');
  };

  UI.panelHtml = () => {
    const tabs = switchButtons(TABS, 'tab', UI.tab), subtabs = switchButtons(subTabs[UI.tab], 'subtab', currentSub());
    const utilities = '<div class="panel-utilities"><button type="button" data-act="sound" aria-label="Toggle sound">' + (g().settings.sound ? 'SND ON' : 'SND OFF') + '</button><button type="button" data-act="save">SAVE</button><button type="button" data-act="utilitySettings" aria-label="Open settings">SET</button></div>';
    let title = UI.tab === 'company' ? 'Company' : UI.tab === 'orders' ? 'Dispatch' : UI.tab === 'fleet' ? 'Fleet' : 'Revenue';
    let content = panels[UI.tab]();
    return '<header class="panel-toolbar"><b>' + title + '</b>' + utilities + '</header><nav class="primary-tabs" role="tablist" aria-label="Management sections">' + tabs + '</nav><nav class="secondary-tabs" role="tablist" aria-label="' + title + ' sections">' + subtabs + '</nav><section class="panel-content">' + content + '</section>';
  };
  function panelSignature(game) {
    const view = [UI.tab, currentSub(), UI.sel, UI.mapCityPanel, UI.selectedVehicle].join(':');
    if (UI.tab === 'orders') return [view, game.orders.map((o) => o.id + ':' + o.status + ':' + o.phase).join(','), game.vehicles.map((v) => v.id + ':' + v.status + ':' + (v.ret ? Math.ceil(v.ret.dur - v.ret.t) : '')).join(',')].join('|');
    if (UI.tab === 'fleet') return [view, game.level, Math.floor(game.cash), game.warehouses.map((w) => w.id + ':' + w.level).join(','), game.vehicles.map((v) => v.id + ':' + v.status + ':' + Math.ceil(v.ret ? v.ret.dur - v.ret.t : 0) + ':' + Math.round(v.cond) + ':' + v.orderId).join(',')].join('|');
    if (UI.tab === 'company') return [view, Math.floor(game.cash), game.level, game.xp, game.rep, game.stats.deliveries, game.warehouses.map((w) => w.id + ':' + w.level).join(','), game.vehicles.map(v => v.whId + ':' + v.status).join(','), game.employees.map(e => e.whId + ':' + e.role + ':' + e.status).join(','), D.RD_CATEGORIES.map(c => game.research[c.id] || 0).join(',')].join('|');
    if (UI.tab === 'revenue') return [view, Math.floor(game.cash), game.debt, game.ledger.length, game.ledger[0] && game.ledger[0].amt, game.fin.lifetimeRevenue, game.fin.lifetimeExpense].join('|');
    if (UI.tab === 'staff') return ['staff', UI.staffView, UI.staffFilter, UI.staffSelection.join(','), UI.hireWarehouse, game.level, Math.floor(game.cash), JSON.stringify(game.candidates), game.employees.map((e) => e.id + ':' + e.status + ':' + e.level + ':' + e.skill + ':' + Math.ceil(e.trainT || e.absentT || 0) + ':' + e.wage + ':' + e.whId).join(',')].join('|');
    if (UI.tab === 'research') return ['research', game.level, Math.floor(game.cash), game.xp, D.RD_CATEGORIES.map((category) => game.research[category.id] || 0).join(','), D.RESEARCH.map((item) => !!game.research[item.id]).join(',')].join('|');
    if (UI.tab === 'wh') {
      const warehouse = game.warehouses.find((w) => w.id === UI.sel);
      const team = game.employees.filter((e) => e.whId === UI.sel).map((e) => [e.id, e.status, e.wage, e.level, e.skill].join(':')).join(',');
      return ['wh', UI.sel, game.level, game.rep, JSON.stringify(warehouse || null), team].join('|');
    }
    return view;
  }
  function refreshLivePanel(game) {
    if (UI.tab !== 'orders') return;
    $('side').querySelectorAll('.order-card[data-order-id]').forEach((card) => {
      const order = game.orders.find((item) => item.id === card.dataset.orderId);
      if (!order) return;
      const expiry = card.querySelector('.order-expiry');
      if (order.status === 'new' && expiry) expiry.textContent = U.time(order.expire - game.time);
      if (order.status !== 'transit') return;
      const phases = { load: 'Packing', travel: 'In transit', unload: 'Unloading' };
      const phase = phases[order.phase], remaining = IPM.O.remaining(order);
      const progress = Math.round(IPM.O.progress(order) * 100), phaseTag = card.querySelector('.order-phase'), timer = card.querySelector('.order-remaining'), bar = card.querySelector('.order-progress');
      if (phaseTag) phaseTag.textContent = phase;
      if (timer) timer.textContent = U.time(remaining);
      if (bar) { bar.setAttribute('aria-valuenow', String(progress)); bar.setAttribute('aria-label', phase + ' progress'); bar.firstElementChild.style.width = progress + '%'; }
    });
  }
  UI.render = () => {
    if (!g()) return;
    UI.top(); UI.map();
    const game = g();
    const panelKey = panelSignature(game);
    if ($('side').dataset.panelKey === panelKey) { refreshLivePanel(game); return; }
    const sc = $('side').scrollTop;
    $('side').innerHTML = UI.panelHtml(); $('side').dataset.panelKey = panelKey; $('side').scrollTop = sc;
    if (IPM.Map.hovered) document.querySelectorAll('.region-pick').forEach((button) => button.classList.toggle('is-hovered', button.dataset.a === IPM.Map.hovered));
  };

  /* ---------- actions (delegated) ---------- */
  const A = {
    tab: (a) => { UI.tab = a; if (a !== 'fleet') UI.mapCityPanel = false; UI.render(); },
    sel: (a) => { UI.sel = a; UI.render(); },
    toggleDispatch: () => { g().settings.autoDispatch = !g().settings.autoDispatch; UI.render(); IPM.V.save(); },
    companyView: (a) => { UI.companyView = a; UI.render(); },
    subtab: (a) => { UI[subState[UI.tab]] = a; if (UI.tab === 'fleet') UI.mapCityPanel = a === 'warehouses' && UI.mapCityPanel; UI.render(); },
    staffView: (a) => { UI.staffView = a; UI.staffSelection = []; UI.render(); },
    staffFilter: (a) => { UI.staffFilter = a; UI.staffSelection = []; UI.render(); },
    cityPanel: (a) => { UI.sel = a; UI.mapCityPanel = true; UI.tab = 'fleet'; UI.fleetView = 'warehouses'; const city = D.city(a); if (city) { IPM.Map.setSelected(city.state); IPM.Map.focusRegion(city.state); } UI.render(); },
    warehousePanel: (a) => { UI.sel = a; UI.mapCityPanel = true; UI.tab = 'fleet'; UI.fleetView = 'warehouses'; const city = D.city(a); if (city) IPM.Map.setSelected(city.state); UI.render(); },
    warehouseList: () => { UI.mapCityPanel = false; UI.render(); },
    selectVehicle: (a) => { UI.selectedVehicle = a; UI.render(); },
    speed: (a) => { g().speed = +a; g().paused = false; UI.render(); },
    pause: () => { g().paused = !g().paused; UI.render(); },
    accept: (a) => { const select = document.querySelector('[data-manual-vehicle="' + a + '"]'); res(IPM.O.accept(a, !g().settings.autoDispatch && select ? select.value : undefined)); }, reject: (a) => res(IPM.O.reject(a)),
    buyveh: (a) => res(IPM.F.buy(a, S.owns(UI.hireWarehouse) ? UI.hireWarehouse : g().warehouses[0].id)),
    vehUpgrade: (a) => res(IPM.F.upgrade(a, 'cap')),
    quickHire: (role) => { const c = IPM.W.cands(role)[0]; res(IPM.W.hire(role, c.id, UI.hireWarehouse)); },
    companyUpgrade: (id) => res(IPM.P.upgradeResearch(id)),
    sell: (a) => res(IPM.F.sell(a)), repair: (a) => res(IPM.F.repair(a, false)),
    hire: (a) => { const p = a.split('|'); res(IPM.W.hire(p[0], p[1], UI.hireWarehouse)); },
    train: (a) => res(IPM.W.train(a)), dismiss: (a) => res(IPM.W.dismiss(a)),
    employeeProfile: (a) => UI.employeeProfile(a),
    previewTrain: () => UI.previewTraining(), previewDismiss: () => UI.previewDismissal(),
    confirmTrain: () => { const ids = UI.pendingBulkIds || []; UI.pendingBulkIds = []; UI.close(); UI.staffSelection = []; res(IPM.W.trainMany(ids)); },
    confirmDismiss: () => { const ids = UI.pendingBulkIds || []; UI.pendingBulkIds = []; UI.close(); UI.staffSelection = []; res(IPM.W.dismissMany(ids)); },
    profileTrain: (a) => { UI.close(); res(IPM.W.train(a)); },
    profileDismiss: (a) => { UI.staffSelection = [a]; UI.previewDismissal(); },
    cmp: (a) => res(IPM.M.start(a, UI.marketingTarget)), stopcmp: (a) => res(IPM.M.stop(a)), seo: () => res(IPM.M.buySeo()),
    borrow: () => res(E.borrow(C.loan.step)), repay: () => res(E.repay(C.loan.step)),
    emerg: () => { res(E.borrow(C.loan.emergency)); UI.close(); },
    save: () => res({ ok: IPM.V.save(), msg: 'Game saved.' }),
    utilitySettings: () => UI.modal('<section class="utility-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><h3 id="settings-title">Game settings</h3><div class="setting-audio"><button type="button" class="b n" data-act="sound">Effects · ' + (g().settings.sound ? 'ON' : 'OFF') + '</button><button type="button" class="b n" data-act="music">Music · ' + (g().settings.music === false ? 'OFF' : 'ON') + '</button></div><p>Dispatch mode</p><button type="button" class="b n" data-act="toggleDispatch" aria-pressed="' + !!g().settings.autoDispatch + '">' + (g().settings.autoDispatch ? 'Automatic dispatch' : 'Choose a vehicle for each order') + '</button><p class="mu">Autosaves every ' + C.autosaveSec + ' seconds. Speed and pause controls sit over the map.</p><section class="credits-list" aria-labelledby="credits-title"><h4 id="credits-title">Credits</h4><p><b>UI audio</b> Kenney Vleugels · <a href="https://kenney.nl/assets/ui-audio" target="_blank" rel="noreferrer">Kenney UI Audio</a> · CC0</p><p><b>India map boundaries</b> amCharts · <a href="https://amcharts.com/svg-maps/india-2023/" target="_blank" rel="noreferrer">India 2023 map data</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p><p><b>Background music</b> Procedurally generated in the game with Web Audio.</p></section><div class="game-actions">' + btn('save', '', 'Save now', 'n') + btn('newgame', '', 'Reset progress') + btn('close', '', 'Close', 'n') + '</div></section>'),
    newgame: () => UI.modal('<h3>Reset all progress?</h3><p>This permanently deletes your company.</p><div class="row"><button class="b" data-act="reset">Yes, reset</button><button class="b n" data-act="close">Cancel</button></div>'),
    reset: () => { IPM.V.reset(); location.reload(); },
    close: () => UI.close(),
    eventPay: () => IPM.Events.acknowledge(true), eventAcknowledge: () => IPM.Events.acknowledge(false), eventRecovery: () => IPM.Events.acknowledge('recover'),
    eventRepairNow: () => IPM.Events.acknowledge(true), eventRepairStandard: () => IPM.Events.acknowledge(false), eventLeaveParked: () => IPM.Events.acknowledge('later'),
    repHelp: () => UI.modal('<h3>Company reputation</h3><p>Company reputation represents how satisfied and confident customers are with your service. Successful and reliable deliveries help build trust, while poor delivery experiences can reduce it.</p><p>On-time deliveries raise reputation. Express jobs and undamaged completion add bonuses. Late deliveries and expired enquiries reduce reputation; damage replaces the undamaged-service bonus with a penalty. Rejecting an enquiry does not change reputation.</p><button type="button" class="b n" data-act="close">Close</button>'),
    start: () => {
      setupAttempted = true;
      const validation = validateSetup(true);
      if (!validation.valid) return;
      const cap = document.querySelector('input[name=cap]:checked').value;
      S.cur = S.create(validation.name, cap, validation.stateIds); UI.close(); UI.note('Company established. Buy a vehicle and accept your first order.', 'good'); UI.render(); IPM.V.save();
    },
  };
  UI.employeeProfile = (id) => {
    const employee = S.emp(id);
    if (!employee) return;
    const role = D.ROLES[employee.role], status = employee.status === 'training' ? 'Training · ' + U.time(employee.trainDur - employee.trainT) + ' remaining' : employee.status === 'busy' ? 'Assigned to an active job' : employee.status === 'absent' ? 'Away from work · ' + U.time(employee.absentT) + ' remaining' : 'Available';
    const location = employee.whId ? D.city(employee.whId).name + ' warehouse' : 'Company-wide';
    const benefit = employee.level >= C.train.maxLevel ? 'Maximum training level reached.' : IPM.W.trainingBenefit(employee, true) + ' · next level costs ' + U.money(IPM.W.trainCost(employee)) + ' and takes ' + U.time(C.train.secPerLevel * employee.level) + '.';
    UI.modal('<section class="employee-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title"><p class="eyebrow">Employee profile</p><h3 id="employee-dialog-title">' + U.esc(employee.name) + '</h3><p>' + U.esc(role.label) + ' · ' + U.esc(location) + '</p><div class="employee-profile-facts"><span>Status <b>' + U.esc(status) + '</b></span><span>Skill <b>' + employee.skill + '/10</b></span><span>Training level <b>' + employee.level + '/' + C.train.maxLevel + '</b></span><span>Salary <b>' + U.money(employee.wage) + '/pay cycle</b></span><span>Morale <b>' + Math.round(employee.morale) + '</b></span></div><p class="mu">Next training benefit: ' + U.esc(benefit) + '</p>' + (employee.status !== 'idle' ? '<p class="warn">Training and dismissal are unavailable while this employee is not available.</p>' : '') + '<div class="employee-dialog-actions">' + btn('profileTrain', employee.id, 'Train', 'n', employee.status !== 'idle' || employee.level >= C.train.maxLevel) + btn('profileDismiss', employee.id, 'Dismiss', '', employee.status !== 'idle') + btn('close', '', 'Close', 'n') + '</div></section>');
  };
  UI.previewTraining = () => {
    const summary = IPM.W.trainSummary(UI.staffSelection), names = summary.eligible.map((item) => '<li>' + U.esc(item.employee.name) + ' · ' + U.money(item.cost) + ' · ' + U.time(item.duration) + '</li>').join('');
    if (!summary.eligible.length) { UI.note('No selected employees are eligible for training.', 'bad'); return; }
    const skipped = summary.excluded.map((item) => '<li>' + U.esc(item.employee.name) + ' · skipped: ' + U.esc(item.reason) + '</li>').join('');
    UI.pendingBulkIds = summary.eligible.map((item) => item.employee.id);
    UI.modal('<section class="bulk-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-train-title"><p class="eyebrow">Training plan</p><h3 id="bulk-train-title">Train selected employees</h3><p>' + summary.eligible.length + ' employees · Total cost ' + U.money(summary.totalCost) + ' · Longest duration ' + U.time(summary.duration) + '</p><p class="mu">Available cash: ' + U.money(g().cash) + (g().cash < summary.totalCost ? ' · Not enough cash for this selection.' : '') + '</p><ul>' + names + skipped + '</ul><div class="row"><button type="button" class="b g" data-act="confirmTrain"' + (g().cash < summary.totalCost ? ' disabled' : '') + '>Confirm training</button><button type="button" class="b n" data-act="close">Cancel</button></div></section>');
  };
  UI.previewDismissal = () => {
    const summary = IPM.W.dismissSummary(UI.staffSelection), names = summary.eligible.map((employee) => '<li>' + U.esc(employee.name) + ' · saves ' + U.money(employee.wage) + ' per pay cycle</li>').join('');
    if (!summary.eligible.length) { UI.note('No selected employees are available for dismissal.', 'bad'); return; }
    const skipped = summary.excluded.map((item) => '<li>' + U.esc(item.employee.name) + ' · skipped: ' + U.esc(item.reason) + '</li>').join('');
    UI.pendingBulkIds = summary.eligible.map((employee) => employee.id);
    UI.modal('<section class="bulk-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-dismiss-title"><p class="eyebrow">Confirm change</p><h3 id="bulk-dismiss-title">Dismiss ' + summary.eligible.length + ' employees?</h3><p>Payroll savings: ' + U.money(summary.savingsPerCycle) + ' per pay cycle.</p><ul>' + names + skipped + '</ul><div class="row"><button type="button" class="b" data-act="confirmDismiss">Confirm dismissal</button><button type="button" class="b n" data-act="close">Cancel</button></div></section>');
  };
  UI.TABS = TABS; UI.panels = panels; UI.A = A; UI.res = res;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const f = A[t.getAttribute('data-act')];
    if (f) { delete $('side').dataset.panelKey; f(t.getAttribute('data-a')); }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'regionSearch') return;
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.region-pick').forEach((button) => {
      button.hidden = !button.dataset.regionName.includes(query);
    });
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'hireWarehouse') UI.hireWarehouse = event.target.value;
    else if (event.target.matches('[data-staff-select]')) {
      const id = event.target.dataset.staffSelect, current = new Set(UI.staffSelection);
      if (event.target.checked) current.add(id); else current.delete(id);
      UI.staffSelection = Array.from(current);
    } else return;
    delete $('side').dataset.panelKey; UI.render();
  });
})();
