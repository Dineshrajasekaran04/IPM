/* tycoon-ui.js — map-first play shell layered over the existing game systems */
(function () {
  'use strict';
  const IPM = window.IPM, UI = IPM.UI, S = IPM.S, D = IPM.D, U = IPM.U, C = D.CONFIG;
  const state = (UI.play = { panel: '', section: 'warehouse', cityTab: 'overview', modal: false, sdkReady: false, sdkPlaying: false });
  UI.tab = 'orders'; UI.ordersView = 'incoming';
  const basePanelHtml = UI.panelHtml;
  const $ = (id) => document.getElementById(id), esc = U.esc;
  const city = (id) => D.city(id) || { id, name: id, state: '' };
  const short = (s) => U.money(s);
  const action = (a, id, label, cls, disabled) => '<button type="button" class="b ' + (cls || '') + '" data-act="' + a + '" data-a="' + esc(id || '') + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  const game = () => S.cur;

  function ensureRail() {
    let rail = $('game-rail');
    if (rail) return rail;
    rail = document.createElement('nav'); rail.id = 'game-rail'; rail.setAttribute('aria-label', 'Game controls');
    const main = $('main'); main.insertBefore(rail, main.firstChild);
    rail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-rail]'); if (!button) return;
      const key = button.dataset.rail;
      if (key === 'network') { state.panel = 'network'; UI.mapCityPanel = false; }
      else if (key === 'jobs') { state.panel = 'global'; state.section = 'orders'; UI.tab = 'orders'; UI.mapCityPanel = false; }
      else if (key === 'company') { state.panel = state.panel === 'global' ? '' : 'global'; state.section = 'company'; UI.tab = 'company'; UI.mapCityPanel = false; }
      else if (key === 'settings') UI.A.utilitySettings();
      else if (key === 'help') help();
      else if (key === 'leaderboard') leaderboard();
      UI.render();
    });
    return rail;
  }

  function railHtml() {
    const open = !!state.panel || UI.mapCityPanel;
    return '<div class="rail-group"><button type="button" data-rail="network" class="rail-button' + (state.panel === 'network' ? ' is-active' : '') + '" aria-label="Open network" title="Network"><span>⌖</span><small>NETWORK</small></button>' +
      '<button type="button" data-rail="jobs" class="rail-button' + (state.panel === 'global' && UI.tab === 'orders' ? ' is-active' : '') + '" aria-label="Open jobs" title="Jobs"><span>⇢</span><small>JOBS</small></button></div>' +
      '<span class="rail-spacer"></span><div class="rail-group"><button type="button" data-rail="settings" class="rail-button" aria-label="Settings" title="Settings"><span>⚙</span><small>SETTINGS</small></button>' +
      '<button type="button" data-rail="leaderboard" class="rail-button" aria-label="Rank" title="Rank"><span>♜</span><small>RANK</small></button>' +
      '<button type="button" data-rail="help" class="rail-button" aria-label="Help" title="Help"><span>?</span><small>HELP</small></button></div>';
  }

  function cityHeader(c, wh) {
    const reg = D.START_REGIONS.states.concat(D.START_REGIONS.unionTerritories).find((x) => x[0] === c.state);
    const incoming = game().orders.filter((o) => o.whId === c.id && o.status === 'new').length;
    return '<header class="play-panel-head"><div><p class="play-kicker">' + (wh ? 'WAREHOUSE · LEVEL ' + wh.level : 'STATE SERVICE HUB') + '</p><h2>' + esc(c.name) + '</h2><small>' + esc(reg ? reg[1] : c.state) + (incoming ? ' · ' + incoming + ' order' + (incoming === 1 ? '' : 's') : '') + '</small></div><button type="button" class="panel-close" data-play="close" aria-label="Close panel">×</button></header>';
  }

  function cityOverview(c, wh) {
    if (!wh) return '<div class="play-section">' + UI.panels.wh() + '</div>';
    const vehicles = game().vehicles.filter((v) => v.whId === c.id);
    const crew = game().employees.filter((e) => e.whId === c.id);
    const orders = game().orders.filter((o) => o.whId === c.id && (o.status === 'new' || o.status === 'transit'));
    return '<div class="play-city-stats"><div><small>JOBS</small><b>' + orders.length + '</b></div><div><small>TRUCKS</small><b>' + vehicles.length + '</b></div><div><small>CREW</small><b>' + crew.length + '</b></div></div>' +
      '<section class="play-section"><p class="muted">' + esc(c.note || 'Service location') + '</p>' + UI.panels.wh() + '</section>';
  }

  function cityOrders(c, wh) {
    if (!wh) return '<div class="play-section"><p class="muted">Open this state to receive orders.</p>' + UI.panels.wh() + '</div>';
    const orders = game().orders.filter((o) => o.whId === c.id && (o.status === 'new' || o.status === 'transit')).sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1));
    const activeHtml = orders.map((o) => {
      const dest = city(o.dest), size = D.SIZES[o.size], urgent = D.URG[o.urg];
      if (o.status === 'transit') {
        const phases = { load: 'Preparing cargo', travel: 'On the road', unload: 'Unloading' };
        return '<article class="play-order is-active" data-play-order="' + esc(o.id) + '"><div class="play-order-route"><span>' + esc(c.name) + '</span><i></i><b>' + esc(dest.name) + '</b></div><div class="play-order-meta"><span class="play-phase">' + phases[o.phase] + '</span> · <span class="play-time">' + U.time(IPM.O.remaining(o)) + '</span> left</div><div class="play-progress" role="progressbar"><i style="width:' + Math.round(IPM.O.progress(o) * 100) + '%"></i></div></article>';
      }
      const r = IPM.O.resources(o), v = r.v, cost = v ? IPM.O.cost(o, v) : null;
      return '<article class="play-order" data-play-order="' + esc(o.id) + '"><div class="play-order-route"><span>' + esc(c.name) + '</span><i></i><b>' + esc(dest.name) + '</b></div><div class="play-order-meta">' + esc(o.cust) + ' · ' + esc(size.label) + ' · ' + o.units + ' units</div><div class="play-order-meta">' + o.dist + ' km · ' + esc(urgent.label) + ' · expires <span class="play-expiry">' + U.time(o.expire - game().time) + '</span></div><div class="play-order-money"><span>Quote <b>' + short(o.price) + '</b></span>' + (cost ? '<span>Est. profit <b>' + short(o.price - cost.fuel - cost.maint - cost.mat) + '</b></span>' : '') + '</div><p class="play-resource ' + (r.why ? 'is-warning' : '') + '">' + esc(r.why || ('Ready · ' + v.name)) + '</p><div class="play-inline-actions">' + action('reject', o.id, 'Reject', 'reject') + action('accept', o.id, 'Dispatch', 'g', !!r.why) + '</div></article>';
    }).join('');
    const recent = game().orders.filter((o) => o.whId === c.id && o.status === 'completed').slice(-3).reverse();
    const recentHtml = recent.length ? '<div class="play-section"><h3>Recent deliveries</h3>' + recent.map((o) => '<button type="button" class="play-delivery-link" data-act="deliveryBreakdown" data-a="' + esc(o.id) + '"><span><b>' + esc(c.name) + ' → ' + esc(city(o.dest).name) + '</b><small>' + esc(o.id) + ' · ' + (o.late ? 'Late' : 'On time') + (o.damaged ? ' · Cargo damaged' : '') + '</small></span><strong>+' + short(o.paid || 0) + '</strong></button>').join('') + '</div>' : '';
    const empty = !activeHtml ? '<div class="play-empty"><span>◇</span><b>Waiting for the next enquiry</b><small>New jobs appear here as your warehouse receives calls.</small></div>' : '';
    return (activeHtml || empty) + recentHtml;
  }

  function cityFleet(c, wh) {
    if (!wh) return '<div class="play-section">' + UI.panels.wh() + '</div>';
    UI.hireWarehouse = c.id;
    const vehicles = game().vehicles.filter((v) => v.whId === c.id);
    const rows = vehicles.length ? vehicles.map((v) => {
      const status = v.status === 'Idle' && v.cond >= C.wear.minCond ? 'READY' : v.status.toUpperCase();
      const order = v.orderId && S.ord(v.orderId);
      return '<article class="truck-card"><div class="truck-art"><svg viewBox="0 0 150 64" aria-hidden="true"><path d="M12 14h77v31H12zM89 24h27l19 16v5H89z"/><path d="M99 28h13l12 11H99z"/><circle cx="39" cy="48" r="10"/><circle cx="112" cy="48" r="10"/><path d="M19 22h54M19 28h39"/></svg><span class="truck-number">' + esc(v.id) + '</span></div><div class="truck-card-copy"><div><b>' + esc(v.name) + '</b><small>' + esc(D.VEH[v.type].name) + ' · ' + (D.VEH[v.type].capacity || D.VEH[v.type].cap || '—') + ' capacity</small></div><span class="truck-status">' + esc(status) + '</span><div class="truck-condition"><i style="width:' + Math.round(v.cond) + '%"></i></div><small>' + Math.round(v.cond) + '% condition' + (order ? ' · ' + esc(city(order.dest).name) : ' · ' + esc(city(v.whId).name)) + '</small></div>' + action('repair', v.id, 'Repair', 'n', v.status !== 'Idle' || v.cond >= 100) + '</article>';
    }).join('') : '<p class="muted">No vehicles based here yet.</p>';
    const market = D.VEHICLES.map((v) => IPM.P.reqOk(v.unlock) ? '<article class="truck-buy"><span class="truck-buy-art">▰</span><span><b>' + esc(v.name) + '</b><small>' + (v.capacity || v.cap || '—') + ' capacity · ' + short(v.price) + '</small></span>' + action('buyveh', v.id, 'Buy', 'n', game().cash < v.price) + '</article>' : '<p class="locked-entry">' + esc(v.name) + ' · ' + esc(IPM.P.reqText(v.unlock)) + '</p>').join('');
    return '<div class="play-section"><h3>Trucks at ' + esc(c.name) + '</h3>' + rows + '</div><div class="play-section"><h3>Truck yard</h3>' + market + '</div>';
  }

  function cityHtml() {
    const c = city(UI.sel), wh = S.wh(c.id), tabs = [['overview', 'BASE'], ['orders', 'JOBS'], ['fleet', 'TRUCKS']];
    const view = UI.play.cityTab || 'orders';
    const content = view === 'overview' ? cityOverview(c, wh) : view === 'fleet' ? cityFleet(c, wh) : cityOrders(c, wh);
    return cityHeader(c, wh) + '<nav class="city-tabs" aria-label="' + esc(c.name) + ' management">' + tabs.map(([id, label]) => '<button type="button" data-play="citytab" data-a="' + id + '" class="' + (view === id ? 'is-active' : '') + '" aria-pressed="' + (view === id) + '">' + label + '</button>').join('') + '</nav><section class="play-panel-body">' + content + '</section>';
  }

  function sideHtml() {
    if (UI.mapCityPanel) state.panel = 'city';
    if (!state.panel) return '';
    const side = $('side'); side.classList.toggle('is-open', true);
    if (state.panel === 'city') return cityHtml();
    if (state.panel === 'network') return '<header class="play-panel-head"><div><p class="play-kicker">INDIA SERVICE NETWORK</p><h2>Network</h2><small>' + game().warehouses.length + ' operating locations</small></div><button type="button" class="panel-close" data-play="close" aria-label="Close panel">×</button></header><section class="play-panel-body">' + UI.panels.map() + '</section>';
    const g = game();
    const warehouseOptions = g.warehouses.map((w) => '<option value="' + esc(w.id) + '"' + (UI.sel === w.id ? ' selected' : '') + '>' + esc(city(w.id).name) + '</option>').join('');
    const pageChoices = state.section === 'revenue' ? [['analytics','Analytics'],['income','Income'],['expenses','Expenses'],['loans','Loans']] : state.section === 'orders' ? [['incoming','Incoming jobs'],['active','Active jobs'],['completed','Completed jobs']] : [['overview','Overview'],['workforce','Team']];
    const currentPage = state.section === 'revenue' ? UI.revenueView : state.section === 'orders' ? UI.ordersView : UI.companyView;
    const pageLabel = state.section === 'revenue' ? 'Accounts page' : state.section === 'orders' ? 'Jobs page' : 'Company page';
    const primary = '<nav class="primary-tabs play-primary-tabs" aria-label="Company sections">' + [['warehouse','Warehouse'],['company','Company'],['orders','Jobs'],['trucks','Trucks'],['revenue','Accounts']].map(([id,label]) => '<button type="button" class="game-tab' + (state.section === id ? ' is-active' : '') + '" data-play-section="' + id + '" aria-current="' + (state.section === id ? 'page' : 'false') + '">' + label + '</button>').join('') + '</nav>';
    const pageButtons = ['company', 'orders', 'revenue'].includes(state.section) ? '<nav class="play-page-tabs" aria-label="' + pageLabel + '">' + pageChoices.map(([id, label]) => '<button type="button" class="' + (currentPage === id ? 'is-active' : '') + '" data-play-page="' + id + '" aria-pressed="' + (currentPage === id) + '">' + label + '</button>').join('') + '</nav>' : '';
    const selectors = '<div class="play-selector-row"><label><span>Warehouse</span><select data-play-select="warehouse" aria-label="Choose warehouse">' + warehouseOptions + '</select></label></div>';
    const sectionName = { warehouse: 'Warehouse', company: 'Company', orders: 'Jobs', trucks: 'Trucks', revenue: 'Accounts' }[state.section] || 'Company';
    return basePanelHtml().replace('<header class="panel-toolbar"><b>', '<header class="play-global-toolbar"><b>')
      .replace(/<button type="button" data-act="sound"[^>]*>[\s\S]*?<\/button>/, '')
      .replace(/<button type="button" data-act="save">[\s\S]*?<\/button>/, '')
      .replace('<button type="button" data-act="utilitySettings" aria-label="Open settings">SET</button>', '')
      .replace(/<header class="play-global-toolbar"><b>[^<]*<\/b>/, '<header class="play-global-toolbar"><b>' + sectionName + '</b>')
      .replace('</b><div class="panel-utilities">', '</b><div class="drawer-actions"><button type="button" class="b n loans-drawer" data-play-loans>Loans</button><button type="button" class="b n prestige-drawer" data-act="prestigeOpen" title="Prestige starts a new season and adds a permanent route-income bonus">Prestige</button></div><div class="panel-utilities">')
      .replace(/<nav class="primary-tabs"[\s\S]*?<\/nav>/, selectors + primary + pageButtons)
      .replace(/<nav class="secondary-tabs"[\s\S]*?<\/nav>/, '')
      .replace('Fleet', 'Trucks').replace('FLEET', 'TRUCKS').replace('Revenue', 'Accounts').replace('Workers', 'Team').replace('Workforce', 'Team');
  }

  function install() {
    ensureRail();
    UI.panelHtml = sideHtml;
    const render = UI.render;
    UI.render = () => {
      if (!game()) return render();
      const side = $('side'), previous = side.dataset.playKey;
      const key = [state.panel, state.section, UI.tab, UI.play.cityTab, UI.sel, game().level, Math.floor(game().cash), game().fin.lifetimeRevenue, game().fin.lifetimeExpense, game().settings.autoDispatch, JSON.stringify(game().warehouses.map((w) => [w.id, w.level, w.crewLevels, w.mgr])), game().orders.map((o) => o.id + o.status + o.phase).join(','), game().vehicles.map((v) => v.id + v.status + Math.round(v.cond)).join(','), game().employees.map((e) => e.id + e.status).join(',')].join('|');
      if (previous !== key) { delete side.dataset.panelKey; side.dataset.playKey = key; }
      const scrollNode = side.querySelector('.play-panel-body, .panel-content'), scrollTop = scrollNode ? scrollNode.scrollTop : 0;
      render();
      const nextScroll = side.querySelector('.play-panel-body, .panel-content'); if (nextScroll && scrollNode && side.dataset.panelKey !== previous) nextScroll.scrollTop = scrollTop;
      side.querySelectorAll('[data-play-order]').forEach((card) => {
        const order = game().orders.find((item) => item.id === card.dataset.playOrder); if (!order) return;
        if (order.status === 'new') { const expiry = card.querySelector('.play-expiry'); if (expiry) expiry.textContent = U.time(order.expire - game().time); }
        if (order.status === 'transit') { const phase = { load: 'Preparing cargo', travel: 'On the road', unload: 'Unloading' }[order.phase]; const label = card.querySelector('.play-phase'), timer = card.querySelector('.play-time'), bar = card.querySelector('.play-progress i'); if (label) label.textContent = phase; if (timer) timer.textContent = U.time(IPM.O.remaining(order)); if (bar) bar.style.width = Math.round(IPM.O.progress(order) * 100) + '%'; }
      });
      side.classList.toggle('is-open', !!state.panel || !!UI.mapCityPanel);
      side.setAttribute('aria-hidden', String(!state.panel && !UI.mapCityPanel));
      const arrow = $('company-arrow'); if (arrow) { const isOpen = !!state.panel || !!UI.mapCityPanel; arrow.classList.toggle('is-open', isOpen); arrow.setAttribute('aria-expanded', String(isOpen)); arrow.setAttribute('aria-label', isOpen ? 'Close company menu' : 'Open company menu'); arrow.textContent = isOpen ? '›' : '‹'; }
      const rail = ensureRail(), markup = railHtml();
      if (rail.dataset.markup !== markup) { rail.innerHTML = markup; rail.dataset.markup = markup; }
      const pending = game().offlineSummary;
      if (pending && !UI.modalOpen()) {
        game().offlineSummary = null;
        UI.modal('<section class="play-dialog"><p class="play-kicker">WHILE YOU WERE AWAY</p><h2>Back on the road</h2><p>' + esc(pending.duration) + ' elapsed. ' + pending.deliveries + ' delivery' + (pending.deliveries === 1 ? '' : 'ies') + ' completed.</p><div class="play-payout ' + (pending.cash >= 0 ? 'is-positive' : 'is-negative') + '">' + (pending.cash >= 0 ? '+' : '−') + short(Math.abs(pending.cash)) + '</div><small>Net cash change across active jobs, payroll and vehicle returns.</small>' + action('close', '', 'Continue', 'g') + '</section>');
      }
    };
    const modal = UI.modal, close = UI.close;
    UI.A.prestigeOpen = prestige;
    UI.modal = (html) => { modal(html); state.modal = true; SDK.sync(); };
    UI.close = () => { close(); state.modal = false; SDK.sync(); };
    const oldCity = UI.A.cityPanel;
    UI.A.cityPanel = (id) => { oldCity(id); state.panel = 'city'; UI.play.cityTab = 'overview'; };
    const oldWarehouse = UI.A.warehousePanel;
    UI.A.warehousePanel = (id) => { oldWarehouse(id); state.panel = 'city'; UI.play.cityTab = 'overview'; };
    const oldList = UI.A.warehouseList;
    UI.A.warehouseList = () => { oldList(); state.panel = 'network'; };
    const oldOpen = UI.A.openwh;
    if (oldOpen) UI.A.openwh = (id) => { oldOpen(id); state.panel = 'city'; UI.play.cityTab = 'overview'; };
    const oldPause = UI.A.pause;
    UI.A.pause = () => { oldPause(); SDK.sync(); };
    const oldSpeed = UI.A.speed;
    UI.A.speed = (speed) => { oldSpeed(speed); SDK.sync(); };
    const oldNote = UI.note;
    UI.note = (message, kind, options) => {
      oldNote(message, kind, options);
      if (document.body && message) toast(message, kind || 'info');
    };
    UI.feed = () => {};
    document.addEventListener('click', (event) => {
      if (event.target.closest('#company-arrow')) { state.panel = state.panel ? '' : 'global'; if (state.panel) { state.section = 'warehouse'; UI.tab = 'fleet'; UI.fleetView = 'warehouses'; } UI.mapCityPanel = false; UI.render(); return; }
      const sectionButton = event.target.closest('[data-play-section]');
      if (sectionButton) {
        const section = sectionButton.dataset.playSection; state.panel = 'global'; state.section = section; UI.mapCityPanel = false;
        if (section === 'warehouse') { UI.tab = 'fleet'; UI.fleetView = 'warehouses'; }
        else if (section === 'trucks') { UI.tab = 'fleet'; UI.fleetView = 'vehicles'; }
        else UI.tab = section === 'orders' ? 'orders' : section === 'revenue' ? 'revenue' : 'company';
        UI.render(); return;
      }
      if (event.target.closest('[data-play-loans]')) { state.panel = 'global'; state.section = 'revenue'; UI.tab = 'revenue'; UI.revenueView = 'loans'; UI.mapCityPanel = false; UI.render(); return; }
      const pageButton = event.target.closest('[data-play-page]');
      if (pageButton) { const page = pageButton.dataset.playPage; if (state.section === 'revenue') UI.revenueView = page; else if (state.section === 'orders') UI.ordersView = page; else UI.companyView = page; UI.render(); return; }
      const button = event.target.closest('[data-play]'); if (!button) return;
      if (button.dataset.play === 'close') { state.panel = ''; UI.mapCityPanel = false; }
      if (button.dataset.play === 'citytab') { UI.play.cityTab = button.dataset.a; }
      delete $('side').dataset.panelKey; UI.render();
    });
    document.addEventListener('change', (event) => {
      const select = event.target.closest('[data-play-select]'); if (!select) return;
      if (select.dataset.playSelect === 'warehouse') {
        if (select.value && S.owns(select.value)) { UI.sel = select.value; UI.tab = 'fleet'; UI.fleetView = 'warehouses'; UI.mapCityPanel = true; state.section = 'warehouse'; }
      }
      state.panel = 'global'; delete $('side').dataset.panelKey; UI.render();
    });
  }

  function toast(message, kind) {
    let stack = $('toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.id = 'toast-stack'; stack.setAttribute('aria-live', 'polite'); stack.setAttribute('aria-relevant', 'additions'); document.body.appendChild(stack); }
    const item = document.createElement('div'); item.className = 'play-toast tone-' + kind; item.textContent = message;
    stack.prepend(item);
    while (stack.children.length > 3) stack.lastElementChild.remove();
    window.setTimeout(() => { item.classList.add('is-leaving'); window.setTimeout(() => item.remove(), 250); }, 3800);
  }

  function help() {
    UI.modal('<section class="play-dialog"><p class="play-kicker">FIELD GUIDE</p><h2>How to play</h2><div class="play-guide"><p><b>1 · Start a route</b><span>Open ORDERS at a warehouse, check the quote and dispatch when a truck and crew are ready.</span></p><p><b>2 · Build your network</b><span>Select a state on the map. Expansion unlocks at the level and reputation shown, then opens a warehouse for its listed cost.</span></p><p><b>3 · Grow the fleet</b><span>Buy trucks at a warehouse, hire packers and drivers, and repair vehicles before condition falls too low.</span></p><p><b>4 · Keep the company moving</b><span>Orders, wages, loan payments, warehouse upkeep and random road events use the existing company rules. Speed and pause controls sit in the top HUD.</span></p><p><b>5 · Save and return</b><span>Your company saves on this device. Active jobs may progress while you are away, for up to four hours.</span></p></div>' + action('close', '', 'Back to map', 'g') + '</section>');
  }

  function leaderboard() {
    const g = game(), score = g.stats.deliveries * 100 + g.level * 25 + g.warehouses.length * 10;
    let best = { score: 0, deliveries: 0, level: 0 };
    try { best = Object.assign(best, JSON.parse(IPM.V.getItem('ipm_tycoon_career_v1') || '{}')); if (score > best.score) { best = { score, deliveries: g.stats.deliveries, level: g.level }; IPM.V.setItem('ipm_tycoon_career_v1', JSON.stringify(best)); } } catch (e) {}
    const online = !!(C.leaderboardEnabled && C.leaderboardEncryptionKey);
    UI.modal('<section class="play-dialog"><p class="play-kicker">CAREER BOARD</p><h2>Company standing</h2><p class="muted">Your company score · higher is better</p><div class="play-rank-row"><span class="rank-medal">IPM</span><b>' + esc(g.company.name) + '</b><small>Level ' + g.level + ' · ' + g.stats.deliveries + ' deliveries</small><strong>' + score.toLocaleString('en-IN') + '</strong></div><div class="play-rank-row is-record"><span class="rank-medal">★</span><b>Career best</b><small>Level ' + best.level + ' · ' + best.deliveries + ' deliveries</small><strong>' + best.score.toLocaleString('en-IN') + '</strong></div><p class="muted">' + (online ? 'Submit your career score to CrazyGames. World and country rankings are shown by the CrazyGames leaderboard.' : 'Online standings are not configured yet. CrazyGames enables one leaderboard per invited game; its platform provides world and country rankings.') + '</p><div class="play-inline-actions">' + (online ? action('leaderboardSubmit', '', 'Submit score', 'g') : '') + action('close', '', 'Back to map', 'n') + '</div></section>');
  }

  function prestige() {
    const g = game(), ready = g.level >= 5 && g.stats.deliveries >= 8, count = g.prestige && g.prestige.count || 0, bonus = Math.min(0.2, count * 0.02);
    const heading = ready ? 'Start a new company season?' : 'Build a national network';
    const body = ready
      ? '<p>Prestige ends this season and starts again with your original two states and ₹50,000. Warehouses, vehicles, crew, cash, orders, and research reset. In return, delivery income gains a permanent 2% bonus per seal, up to 20%.</p><div class="play-payout">Next season route income bonus: +' + Math.round(Math.min(0.2, (count + 1) * 0.02) * 100) + '%</div>'
      : '<p>Prestige is a long-term reset. Reach company level 5 and complete 8 deliveries to qualify. Starting a new season restores your original two states and ₹50,000, resets warehouses, vehicles, crew, cash, orders and research, and adds a permanent 2% delivery-income bonus per seal (maximum 20%).</p><div class="prestige-progress"><span>Company level <b>' + g.level + ' / 5</b></span><i><b style="width:' + Math.min(100, g.level / 5 * 100) + '%"></b></i><span>Completed deliveries <b>' + g.stats.deliveries + ' / 8</b></span><i><b style="width:' + Math.min(100, g.stats.deliveries / 8 * 100) + '%"></b></i></div>';
    UI.modal('<section class="play-dialog"><p class="play-kicker">NETWORK PRESTIGE · ' + count + ' SEALS</p><h2>' + heading + '</h2>' + body + '<p class="muted">Permanent income bonus now: +' + Math.round(bonus * 100) + '% · Maximum +20%.</p><div class="play-inline-actions">' + action('close', '', 'Not now', 'n') + (ready ? action('prestigeConfirm', '', 'Prestige company', 'g') : '') + '</div></section>');
  }

  const originalEarn = IPM.E.earn;
  IPM.E.earn = (amount, category, note, warehouseId) => {
    const count = game() && game().prestige && game().prestige.count || 0;
    const multiplier = category === 'revenue' ? 1 + Math.min(0.2, count * 0.02) : 1;
    return originalEarn(Math.round(amount * multiplier), category, note, warehouseId);
  };
  const originalComplete = IPM.O.complete;
  IPM.O.complete = (order) => {
    const g = game(), before = Object.assign({}, g.fin.totals), xpBefore = g.xp, repBefore = g.rep;
    originalComplete(order);
    const delta = (key) => Math.round((g.fin.totals[key] || 0) - (before[key] || 0));
    order.breakdown = {
      revenue: delta('revenue'), fuel: -delta('fuel'), maintenance: -delta('maintenance'), materials: -delta('materials'),
      xp: g.xp - xpBefore, reputation: Math.round((g.rep - repBefore) * 100) / 100, duration: Math.max(0, g.time - (order.start || g.time)),
    };
  };
  const originalFix = S.fix;
  S.fix = (g) => { g = originalFix(g); g.prestige = Object.assign({ count: 0 }, g.prestige || {}); return g; };
  const originalBase = S.base;
  S.base = () => { const g = originalBase(); g.prestige = { count: 0 }; return g; };

  UI.A.prestigeConfirm = () => {
    const g = game();
    if (!g || g.level < 5 || g.stats.deliveries < 8) return;
    const prestige = Object.assign({ count: 0 }, g.prestige || {}); prestige.count++;
    const name = g.company.name, starts = (g.company.stateIds || [g.company.stateId]).filter(Boolean).slice(0, 2);
    if (starts.length < 2) starts.push(D.START_REGIONS.states.find(([id]) => id !== starts[0])[0]);
    S.cur = S.create(name, 'A', starts); S.cur.prestige = prestige;
    state.panel = ''; UI.mapCityPanel = false; UI.close(); UI.note('Network Prestige earned. Permanent route income bonus +' + Math.round(Math.min(0.2, prestige.count * 0.02) * 100) + '%.', 'good', { toast: true, sound: 'ok' }); UI.render(); IPM.V.save();
  };
  UI.A.deliveryBreakdown = (id) => {
    const order = S.ord(id); if (!order || order.status !== 'completed') return;
    const b = order.breakdown || { revenue: order.paid || 0, fuel: 0, maintenance: 0, materials: 0, xp: 0, reputation: 0 };
    const net = b.revenue - b.fuel - b.maintenance - b.materials;
    UI.modal('<section class="play-dialog"><p class="play-kicker">' + esc(order.id) + ' · DELIVERY COMPLETE</p><h2>' + esc(city(order.whId).name) + ' → ' + esc(city(order.dest).name) + '</h2><div class="breakdown-rows"><div><span>Customer payment</span><b>+' + short(b.revenue) + '</b></div><div><span>Fuel</span><b>−' + short(b.fuel) + '</b></div><div><span>Vehicle upkeep</span><b>−' + short(b.maintenance) + '</b></div><div><span>Packing materials</span><b>−' + short(b.materials) + '</b></div><div class="breakdown-total"><span>Net delivery profit</span><b>' + (net >= 0 ? '+' : '−') + short(Math.abs(net)) + '</b></div></div><p class="muted">' + (order.late ? 'Late delivery' : 'On time') + (order.damaged ? ' · Cargo damaged' : ' · Cargo delivered safely') + ' · ' + U.time(b.duration || 0) + '</p><p class="muted">Reputation ' + (b.reputation > 0 ? '+' : '') + b.reputation + ' · +' + b.xp + ' XP</p>' + action('close', '', 'Back to orders', 'g') + '</section>');
  };

  const originalOffline = IPM.V.offline;
  IPM.V.offline = () => {
    const g = game(); if (!g) return originalOffline();
    const beforeCash = g.cash, beforeDeliveries = g.stats.deliveries, away = Math.min(C.offlineCapSec, Math.max(0, (Date.now() - (g.lastSave || Date.now())) / 1000));
    originalOffline();
    if (away >= 30) g.offlineSummary = { cash: Math.round(g.cash - beforeCash), deliveries: g.stats.deliveries - beforeDeliveries, duration: U.longTime(away) };
  };

  const sdk = window.CrazyGames && window.CrazyGames.SDK;
  const SDK = {
    async init() {
      let existing = window.CrazyGames && window.CrazyGames.SDK;
      const host = location.hostname;
      const allowed = host === 'localhost' || host === '127.0.0.1' || host === 'crazygames.com' || host.endsWith('.crazygames.com');
      if (!existing && allowed) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script'); script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'; script.async = true;
            script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
          });
          existing = window.CrazyGames && window.CrazyGames.SDK;
        } catch (e) { return; }
      }
      if (!existing || typeof existing.init !== 'function') return;
      try { await existing.init(); state.sdkReady = true; this.sync(); } catch (e) { state.sdkReady = false; }
      if (state.sdkReady && existing.game) {
        const applyMute = (settings) => { if (IPM.Platform.setSdkMuted) IPM.Platform.setSdkMuted(!!(settings && settings.muteAudio)); };
        applyMute(existing.game.settings);
        if (typeof existing.game.addSettingsChangeListener === 'function') existing.game.addSettingsChangeListener(applyMute);
      }
    },
    sync() {
      if (!state.sdkReady) return;
      const sdkNow = window.CrazyGames && window.CrazyGames.SDK;
      if (!sdkNow || !sdkNow.game) return;
      const shouldPlay = !!game() && !game().paused && !UI.modalOpen();
      try {
        if (shouldPlay && !state.sdkPlaying) { sdkNow.game.gameplayStart(); state.sdkPlaying = true; }
        else if (!shouldPlay && state.sdkPlaying) { sdkNow.game.gameplayStop(); state.sdkPlaying = false; }
      } catch (e) {}
    },
  };
  IPM.Platform.sdk = {
    gameplayStart: () => { if (state.sdkReady) { try { window.CrazyGames.SDK.game.gameplayStart(); state.sdkPlaying = true; } catch (e) {} } },
    gameplayStop: () => { if (state.sdkReady) { try { window.CrazyGames.SDK.game.gameplayStop(); state.sdkPlaying = false; } catch (e) {} } },
    happytime: () => { if (state.sdkReady) { try { window.CrazyGames.SDK.game.happytime(); } catch (e) {} } },
  };
  UI.A.leaderboardSubmit = async () => {
    const g = game();
    const local = (() => { try { return JSON.parse(IPM.V.getItem('ipm_tycoon_career_v1') || '{}'); } catch (e) { return {}; } })();
    const score = Math.max(local.score || 0, g.stats.deliveries * 100 + g.level * 25 + g.warehouses.length * 10);
    const result = await IPM.Platform.submitLeaderboardScore(score);
    UI.note(result.msg, result.ok ? 'good' : 'warn');
  };

  function patchActions() {
    const mapClick = $('map');
    mapClick.addEventListener('click', (event) => {
      const statePath = event.target.closest('.india-region');
      if (statePath) { state.panel = 'city'; UI.play.cityTab = 'overview'; }
      const marker = event.target.closest('.state-warehouse-marker');
      if (marker) { state.panel = 'city'; UI.play.cityTab = 'overview'; }
    });
    const note = UI.note;
    UI.note = (message, kind, options) => note(message, kind, options);
  }

  install(); patchActions();
  function compactTop() {
    const g = game(), top = $('top'); if (!g || !top) return;
    const speed = g.speed || 1;
    if (!top.dataset.miniBuilt) {
      top.innerHTML = '<section class="hud-company" aria-label="Company overview"><div class="mini-brand"><span>IPM</span><b data-mini="name"></b><small data-mini="level"></small></div><div class="mini-cash"><small>CASH</small><b data-mini="cash"></b></div><div class="hud-cost" aria-label="Operating cost"><small>OPERATING COST</small><b data-mini="cost"></b><span data-mini="hour"></span></div><div class="mini-reputation"><small>REPUTATION</small><b data-mini="rep"></b></div><div class="mini-trucks"><small>TRUCKS</small><b data-mini="trucks"></b></div></section><section class="hud-running" aria-label="Game pace"><div class="mini-speed" role="group" aria-label="Game pace">' + [1,2,3].map((n) => '<button type="button" data-act="speed" data-a="' + n + '">' + n + '×</button>').join('') + '<button type="button" class="pause-control" data-act="pause">Pause</button></div></section>';
      top.dataset.miniBuilt = '1';
    }
    top.querySelector('[data-mini="name"]').textContent = g.company.name;
    top.querySelector('[data-mini="level"]').textContent = 'Level ' + g.level;
    top.querySelector('[data-mini="cash"]').textContent = short(g.cash);
    top.querySelector('[data-mini="trucks"]').textContent = String(g.vehicles.length);
    top.querySelector('[data-mini="rep"]').textContent = IPM.P.stars().toFixed(1) + ' / 5';
    const rate = IPM.E.rate();
    top.querySelector('[data-mini="cost"]').textContent = short(rate.expPerMin) + ' / min';
    top.querySelector('[data-mini="hour"]').textContent = short(rate.expPerMin * 60) + ' / hour';
    top.querySelectorAll('.mini-speed [data-act="speed"]').forEach((button) => button.classList.toggle('is-active', +button.dataset.a === speed && !g.paused));
    const pause = top.querySelector('[data-act="pause"]'); pause.textContent = g.paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-label', g.paused ? 'Resume game' : 'Pause game'); pause.setAttribute('aria-pressed', String(g.paused));
  }
  UI.top = compactTop;
  const arrow = document.createElement('button'); arrow.id = 'company-arrow'; arrow.type = 'button'; arrow.className = 'company-arrow'; arrow.setAttribute('aria-label', 'Open company menu'); arrow.textContent = '‹'; $('main').appendChild(arrow);
  IPM.Platform.ready = SDK.init();
  const bootRender = UI.render;
  UI.render = () => { bootRender(); SDK.sync(); IPM.Platform.renderOffer(); };
})();
