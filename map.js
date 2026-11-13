/* map.js: interactive India boundaries, service hubs and delivery corridors. */
(function () {
  'use strict';
  const IPM = window.IPM, D = IPM.D, U = IPM.U, G = D.MAP_GEOMETRY;
  const ZOOM = { min: 1, max: 5, step: 1.2 };
  const M = (IPM.Map = { view: 'india', byId: {}, byIso: {}, selected: null, hovered: null, scale: 1, tx: 0, ty: 0 });
  const displayedCamera = { scale: 1, tx: 0, ty: 0 };
  let cameraFrame = 0;
  const regionIso = {
    ap: 'IN-AP', ar: 'IN-AR', as: 'IN-AS', br: 'IN-BR', cg: 'IN-CG', ga: 'IN-GA', gj: 'IN-GJ',
    hr: 'IN-HR', hp: 'IN-HP', jh: 'IN-JH', ka: 'IN-KA', kl: 'IN-KL', mp: 'IN-MP', mh: 'IN-MH',
    mn: 'IN-MN', ml: 'IN-ML', mz: 'IN-MZ', nl: 'IN-NL', od: 'IN-OD', pb: 'IN-PB', rj: 'IN-RJ',
    sk: 'IN-SK', tn: 'IN-TN', ts: 'IN-TS', tr: 'IN-TR', up: 'IN-UP', uk: 'IN-UK', wb: 'IN-WB',
    ch: 'IN-CH', dn: 'IN-DH', dl: 'IN-DL', 'jk-ut': 'IN-JK', la: 'IN-LK', ld: 'IN-LD', py: 'IN-PY',
  };
  const regionList = D.START_REGIONS.states.concat(D.START_REGIONS.unionTerritories)
    .map(([id, name]) => ({ id, name, iso: regionIso[id] }));
  regionList.forEach((r) => { M.byId[r.id] = r; M.byIso[r.iso] = r; });
  const mapRoot = () => document.getElementById('map');
  const stage = () => document.getElementById('map-stage');
  const esc = U.esc;
  const view = G.viewBox.split(/\s+/).map(Number);
  const vb = { x: view[0] - 58, y: view[1] - 44, width: view[2] + 116, height: view[3] + 82 };
  const geoBounds = { west: 68.1, east: 97.4, north: 37.2, south: 6.7 };
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

  // The amCharts boundary paths use a fitted Mercator viewBox. Match city lon/lat to
  // the source map's geographic coverage so routes and city pins share its projection.
  const project = (lon, lat) => {
    const paths = G.regions;
    if (!M.geometryBounds) {
      const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      paths.forEach((shape) => {
        const n = shape.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
        for (let i = 0; i < n.length; i += 2) {
          b.minX = Math.min(b.minX, n[i]); b.maxX = Math.max(b.maxX, n[i]);
          b.minY = Math.min(b.minY, n[i + 1]); b.maxY = Math.max(b.maxY, n[i + 1]);
        }
      });
      M.geometryBounds = b;
    }
    const b = M.geometryBounds;
    const x = b.minX + (lon - geoBounds.west) / (geoBounds.east - geoBounds.west) * (b.maxX - b.minX);
    const n = merc(geoBounds.north), s = merc(geoBounds.south);
    const y = b.minY + (n - merc(lat)) / (n - s) * (b.maxY - b.minY);
    return [x, y];
  };
  M.project = project;

  // These connected road corridors are illustrative, so long-haul truck paths
  // follow the Indian land network instead of drawing a misleading sea chord.
  const roadNodes = {
    chennai:[80.27,13.08], bengaluru:[77.59,12.97], amaravati:[80.36,16.57], hyderabad:[78.49,17.39],
    visakhapatnam:[83.30,17.69], bhubaneswar:[85.82,20.29], kolkata:[88.36,22.57], raipur:[81.63,21.25],
    nagpur:[79.09,21.15], bhopal:[77.41,23.26], lucknow:[80.95,26.85], patna:[85.14,25.61],
    delhi:[77.21,28.61], jaipur:[75.79,26.91], ahmedabad:[72.64,23.22], mumbai:[72.87,19.07],
    pune:[73.86,18.52], surat:[72.83,21.17], indore:[75.86,22.72], dehradun:[78.03,30.32],
    guwahati:[91.74,26.14], shillong:[91.89,25.58], imphal:[93.94,24.82],
  };
  const roadEdges = [
    ['chennai','bengaluru'],['chennai','amaravati'],['amaravati','visakhapatnam'],['visakhapatnam','bhubaneswar'],['bhubaneswar','kolkata'],
    ['bengaluru','hyderabad'],['hyderabad','amaravati'],['hyderabad','raipur'],['raipur','bhubaneswar'],['raipur','nagpur'],
    ['nagpur','bhopal'],['bhopal','indore'],['indore','jaipur'],['bhopal','lucknow'],['lucknow','patna'],['patna','kolkata'],
    ['lucknow','delhi'],['jaipur','delhi'],['jaipur','ahmedabad'],['ahmedabad','surat'],['surat','mumbai'],['mumbai','pune'],['pune','bengaluru'],
    ['delhi','dehradun'],['patna','guwahati'],['guwahati','shillong'],['shillong','imphal'],
  ];
  const roadKm = (a, b) => {
    const p = roadNodes[a], q = roadNodes[b], lat = (p[1] + q[1]) / 2 * Math.PI / 180;
    return Math.hypot((p[0] - q[0]) * Math.cos(lat) * 111, (p[1] - q[1]) * 111);
  };
  const roadPath = (from, to) => {
    const a = D.city(from), b = D.city(to);
    if (!a || !b) return [];
    const start = [a.lon, a.lat], finish = [b.lon, b.lat];
    if (roadKmCoord(start, finish) < 220) return [start, finish];
    const graph = {};
    Object.keys(roadNodes).forEach((key) => { graph[key] = []; });
    roadEdges.forEach(([u, v]) => { const weight = roadKm(u, v); graph[u].push([v, weight]); graph[v].push([u, weight]); });
    const links = [];
    [[start, 'route-start'], [finish, 'route-end']].forEach(([point, key]) => {
      roadNodes[key] = point; graph[key] = [];
      const nearest = Object.keys(roadNodes).filter((id) => id !== 'route-start' && id !== 'route-end').sort((u, v) => roadKmCoord(point, roadNodes[u]) - roadKmCoord(point, roadNodes[v])).slice(0, 2);
      nearest.forEach((id) => { const km = roadKmCoord(point, roadNodes[id]); graph[key].push([id, km]); graph[id].push([key, km]); });
    });
    const dist = { 'route-start': 0 }, prev = {}, pending = new Set(Object.keys(graph));
    while (pending.size) {
      let current = null;
      pending.forEach((id) => { if (current === null || (dist[id] ?? Infinity) < (dist[current] ?? Infinity)) current = id; });
      if (current === null || !Number.isFinite(dist[current]) || current === 'route-end') break;
      pending.delete(current);
      graph[current].forEach(([next, cost]) => { const candidate = dist[current] + cost; if (candidate < (dist[next] ?? Infinity)) { dist[next] = candidate; prev[next] = current; } });
    }
    let cursor = 'route-end', chain = [];
    while (cursor && cursor !== 'route-start') { chain.unshift(cursor); cursor = prev[cursor]; }
    if (!cursor) return [start, finish];
    const result = [start, ...chain.map((id) => roadNodes[id]).filter(Boolean), finish];
    delete graph['route-start']; delete graph['route-end']; delete roadNodes['route-start']; delete roadNodes['route-end'];
    return result;
  };
  function roadKmCoord(p, q) { const lat = (p[1] + q[1]) / 2 * Math.PI / 180; return Math.hypot((p[0] - q[0]) * Math.cos(lat) * 111, (p[1] - q[1]) * 111); }
  const alongPath = (path, fraction) => {
    const pts = path.map(([lon, lat]) => project(lon, lat));
    const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lengths.reduce((sum, n) => sum + n, 0), target = total * U.clamp(fraction, 0, 1);
    let walked = 0;
    for (let i = 0; i < lengths.length; i++) {
      if (walked + lengths[i] >= target || i === lengths.length - 1) {
        const t = lengths[i] ? (target - walked) / lengths[i] : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      }
      walked += lengths[i];
    }
    return pts[0];
  };
  M.setSelected = (id) => { M.selected = M.byId[id] ? id : 'tn'; updateRegionStyles(); };
  M.setHovered = (id) => {
    const next = M.byId[id] ? id : null;
    if (M.hovered === next) return;
    M.hovered = next;
    updateRegionStyles();
    document.querySelectorAll('.region-pick').forEach((button) => button.classList.toggle('is-hovered', button.dataset.a === next));
  };
  M.coverageStatus = (region, game) => {
    if (game && game.warehouses.some((w) => { const city = D.city(w.id); return city && city.state === region.id; })) return 'Warehouse active';
    const hub = D.stateHub(region.id);
    return hub && IPM.P.reqOk({ level: hub.minLevel, rep: hub.minRep }) ? 'Ready to expand' : 'Expansion locked';
  };
  M.regionList = regionList;

  function regionMarkup(game) {
    return G.regions.map((shape) => {
      const region = M.byIso[shape.id];
      if (!region) return '';
      const status = M.coverageStatus(region, game);
      const active = status === 'Warehouse active';
      const preview = !active && status === 'Ready to expand';
      return '<g class="india-region-group"><path class="india-region ' + (active ? 'is-operational' : preview ? 'is-preview' : 'is-locked') + '" id="region-' + region.id + '" data-region="' + region.id + '" d="' + shape.d + '" tabindex="0" role="button" aria-label="' + esc(region.name + '. ' + status) + '" aria-pressed="false"><title>' + esc(region.name + ' · ' + status) + '</title></path><text class="region-code" data-for="' + region.id + '" aria-hidden="true">' + region.id.toUpperCase() + '</text></g>';
    }).join('');
  }

  function mapContextMarkup() {
    const labels = [
      ['PAKISTAN', 66.3, 27.4, 'west'], ['CHINA', 86.8, 36.3, 'north'], ['NEPAL', 82.2, 29.5, 'north'],
      ['BHUTAN', 91.2, 27.8, 'east'], ['BANGLADESH', 93.1, 24.2, 'east'], ['MYANMAR', 97.8, 22.5, 'east'],
      ['SRI LANKA', 80.8, 5.5, 'south'],
    ];
    return '<g class="map-context" aria-label="Nearby countries, shown for geographic context only">' + labels.map(([name, lon, lat, side]) => {
      const [x, y] = project(lon, lat);
      return '<text class="map-country-label map-country-' + side + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + name + '</text>';
    }).join('') + '</g>';
  }

  function cityMarkup(game) {
    if (!game) return '';
    const activeStates = [...new Set(game.warehouses.map((w) => { const city = D.city(w.id); return city && city.state; }).filter(Boolean))];
    const points = activeStates.map((state) => {
      const city = D.stateHub(state);
      if (!city || !M.byId[state]) return '';
      let [x, y] = project(city.lon, city.lat);
      if (state === 'hr') { x -= 5; y += 4; }
      if (state === 'pb') { x += 5; y -= 3; }
      if (state === 'ch') { x += 8; y += 4; }
      const selected = IPM.Map.selected === state;
      const label = city.name + (city.name === M.byId[state].name ? '' : ' · ' + M.byId[state].name), warehouse = game.warehouses.find((w) => { const item = D.city(w.id); return item && item.state === state; });
      return '<g class="state-warehouse-marker' + (selected ? ' is-current' : '') + '" data-act="city" data-region="' + state + '" data-a="' + city.id + '" tabindex="0" role="button" aria-pressed="' + selected + '" aria-label="' + esc(label + ' warehouse, level ' + (warehouse ? warehouse.level : 1)) + '"><title>' + esc(label + ' warehouse') + '</title><circle class="warehouse-halo" cx="' + x + '" cy="' + y + '" r="14"/><circle class="warehouse-plaza" cx="' + x + '" cy="' + y + '" r="10"/><circle class="city-dot" cx="' + x + '" cy="' + y + '" r="7"/><path class="warehouse-glyph" d="M' + (x - 5) + ' ' + (y + 1) + 'l5 -4 5 4v5h-10z M' + (x - 1) + ' ' + (y + 6) + 'v-4h2v4"/><text class="city-label" x="' + (x + 16) + '" y="' + (y - 10) + '">' + esc(label) + '</text></g>';
    }).join('');
    const routeLines = [], seen = new Set(), trucks = [];
    const addRoute = (from, to, key, fraction, title, returning) => {
      const a = D.city(from), b = D.city(to);
      if (!a || !b) return;
      const road = roadPath(from, to), points = road.map(([lon, lat]) => project(lon, lat)), routeKey = from + '>' + to;
      if (!seen.has(routeKey)) {
        seen.add(routeKey);
        const path = points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ');
        routeLines.push('<path class="route-casing" d="' + path + '" aria-hidden="true"/><path class="active-route' + (returning ? ' return-route' : '') + '" d="' + path + '"><title>' + esc(title + ' · indicative overland corridor') + '</title></path>');
      }
      const [x, y] = alongPath(road, fraction);
      trucks.push('<g class="route-vehicle" transform="translate(' + x + ' ' + y + ')" role="img" aria-label="' + esc(title) + '"><rect class="truck-shadow" x="-10" y="-4" width="17" height="9" rx="1.4"/><rect class="truck-cargo" x="-9" y="-5" width="10" height="7" rx="1"/><path class="truck-cab" d="M1 -4h4l4 4v2H1z"/><path class="truck-window" d="M3 -3h2l2 2H3z"/><circle class="truck-wheel" cx="-5" cy="5" r="2.1"/><circle class="truck-wheel" cx="6" cy="5" r="2.1"/></g>');
    };
    const seenVehicles = new Set();
    game.orders.filter((o) => o.status === 'transit').forEach((o) => {
      if (seenVehicles.has(o.vehicleId)) return;
      seenVehicles.add(o.vehicleId);
      const fraction = o.phase === 'travel' ? IPM.O.progress(o) : o.phase === 'unload' ? 1 : 0;
      addRoute(o.whId, o.dest, o.id, fraction, o.id + ' · ' + D.city(o.whId).name + ' to ' + D.city(o.dest).name, false);
    });
    game.vehicles.filter((v) => v.status === 'Returning' && v.ret).forEach((v) => {
      addRoute(v.ret.from, v.ret.to, v.id, v.ret.dur ? v.ret.t / v.ret.dur : 1, v.name + ' returning to home warehouse', true);
    });
    return points + routeLines.join('') + trucks.join('');
  }

  function placeCodeLabels() {
    const svg = stage().querySelector('svg');
    svg.querySelectorAll('.india-region').forEach((path) => {
      const label = svg.querySelector('.region-code[data-for="' + path.dataset.region + '"]');
      const box = path.getBBox();
      if (box.width < 17 || box.height < 16) { label.remove(); return; }
      label.setAttribute('x', box.x + box.width / 2);
      label.setAttribute('y', box.y + box.height / 2 + 3);
    });
  }

  function updateRegionStyles() {
    const root = stage();
    if (!root) return;
    root.querySelectorAll('.india-region').forEach((path) => {
      const id = path.dataset.region;
      path.classList.toggle('is-selected', id === M.selected);
      path.classList.toggle('is-hovered', id === M.hovered);
      path.setAttribute('aria-pressed', String(id === M.selected));
    });
  }

  function updateCityMarkers() {
    const game = IPM.S.cur, root = stage();
    if (!game || !root) return;
    root.querySelectorAll('.state-warehouse-marker').forEach((marker) => marker.classList.toggle('is-current', marker.dataset.region === M.selected));
    updateCityLabels();
  }

  function updateCityLabels() {
    const root = stage(), game = IPM.S.cur;
    if (!root || !game) return;
    const showAll = M.scale >= 1.55;
    const labels = [...root.querySelectorAll('.state-warehouse-marker')].map((marker) => ({
      marker, label: marker.querySelector('.city-label'), priority: marker.classList.contains('is-current') ? 3 : marker.classList.contains('has-warehouse') ? 2 : 1,
    })).sort((a, b) => b.priority - a.priority);
    const occupied = [];
    labels.forEach(({ marker, label, priority }) => {
      const show = showAll || priority > 1;
      label.style.display = show ? '' : 'none';
      if (!show || label.getBBox().width === 0) return;
      const r = label.getBoundingClientRect();
      const collision = occupied.some((box) => r.left < box.right + 3 && r.right + 3 > box.left && r.top < box.bottom + 2 && r.bottom + 2 > box.top);
      if (collision && priority === 1) label.style.display = 'none';
      else occupied.push(r);
    });
  }

  function applyCamera(transition) {
    const viewport = stage().querySelector('.map-viewport');
    if (!viewport) return;
    if (cameraFrame) cancelAnimationFrame(cameraFrame);
    cameraFrame = 0;
    const from = { ...displayedCamera }, to = { scale: M.scale, tx: M.tx, ty: M.ty };
    const write = (camera) => {
      displayedCamera.scale = camera.scale; displayedCamera.tx = camera.tx; displayedCamera.ty = camera.ty;
      viewport.setAttribute('transform', 'translate(' + camera.tx + ' ' + camera.ty + ') scale(' + camera.scale + ')');
    };
    if (transition && !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (from.scale !== to.scale || from.tx !== to.tx || from.ty !== to.ty)) {
      const start = performance.now(), duration = 180;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
        write({ scale: from.scale + (to.scale - from.scale) * eased, tx: from.tx + (to.tx - from.tx) * eased, ty: from.ty + (to.ty - from.ty) * eased });
        if (t < 1) cameraFrame = requestAnimationFrame(tick);
        else { cameraFrame = 0; updateCityLabels(); }
      };
      cameraFrame = requestAnimationFrame(tick);
    } else {
      write(to);
      updateCityLabels();
    }
    const max = M.scale >= ZOOM.max, min = M.scale <= ZOOM.min;
    document.querySelector('[data-map-action="zoom-in"]').disabled = max;
    document.querySelector('[data-map-action="zoom-out"]').disabled = min;
  }

  function clampCamera() {
    const maxX = vb.x + vb.width - M.scale * (vb.x + vb.width);
    const minX = vb.x - M.scale * vb.x;
    const maxY = vb.y + vb.height - M.scale * (vb.y + vb.height);
    const minY = vb.y - M.scale * vb.y;
    M.tx = M.scale === 1 ? 0 : Math.max(maxX, Math.min(minX, M.tx));
    M.ty = M.scale === 1 ? 0 : Math.max(maxY, Math.min(minY, M.ty));
  }

  function screenToMap(clientX, clientY) {
    const svg = stage().querySelector('svg'), pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  M.zoomAt = (factor, clientX, clientY, smooth) => {
    const svg = stage().querySelector('svg');
    if (!svg) return;
    const point = clientX == null ? screenToMap(svg.getBoundingClientRect().left + svg.getBoundingClientRect().width / 2, svg.getBoundingClientRect().top + svg.getBoundingClientRect().height / 2) : screenToMap(clientX, clientY);
    const next = Math.max(ZOOM.min, Math.min(ZOOM.max, displayedCamera.scale * factor));
    if (next === displayedCamera.scale) return;
    const worldX = (point.x - displayedCamera.tx) / displayedCamera.scale, worldY = (point.y - displayedCamera.ty) / displayedCamera.scale;
    M.scale = next;
    M.tx = point.x - worldX * next; M.ty = point.y - worldY * next;
    clampCamera(); applyCamera(smooth !== false);
  };

  M.fitIndia = () => { M.scale = 1; M.tx = 0; M.ty = 0; applyCamera(true); };
  M.focusRegion = (id) => {
    const path = stage().querySelector('[data-region="' + id + '"]');
    if (!path) return;
    const r = path.getBoundingClientRect(), area = stage().getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx >= area.left && cx <= area.right && cy >= area.top && cy <= area.bottom) return;
    const point = path.getBBox();
    const center = screenToMap(area.left + area.width / 2, area.top + area.height / 2);
    M.scale = Math.max(M.scale, 1.5);
    M.tx = center.x - (point.x + point.width / 2) * M.scale;
    M.ty = center.y - (point.y + point.height / 2) * M.scale;
    clampCamera(); applyCamera(true);
  };

  M.render = () => {
    const game = IPM.S.cur, root = stage();
    if (!game) return;
    if (!M.byId[M.selected]) M.setSelected(game.company.stateId || 'tn');
    const region = M.byId[M.selected] || M.byId.tn;
    document.getElementById('map-title').textContent = region.name;
    document.getElementById('map-subtitle').textContent = 'Warehouse yards and moving delivery trucks follow indicative overland corridors; nearby country labels are for context.';
    document.getElementById('map-legend').innerHTML = '<span class="legend-item"><i class="legend-swatch active"></i>Warehouse active</span><span class="legend-item"><i class="legend-swatch locked"></i>Locked state</span><span class="legend-item"><i class="legend-swatch selected"></i>Selected state</span><span class="legend-total">' + game.warehouses.length + ' warehouses · ' + game.orders.filter((o) => o.status === 'transit').length + ' active jobs</span>';
    let svg = root.querySelector('svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('india-map'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('role', 'group'); svg.setAttribute('aria-labelledby', 'india-map-title india-map-description');
      svg.setAttribute('viewBox', [vb.x, vb.y, vb.width, vb.height].join(' '));
      svg.innerHTML = '<title id="india-map-title">India state and Union Territory map</title><desc id="india-map-description">Select an Indian state to view its warehouse. Nearby country labels add geographic context and do not represent playable areas.</desc><g class="map-viewport"><g class="region-layer">' + regionMarkup(game) + '</g><g class="route-layer"></g>' + mapContextMarkup() + '</g>';
      root.appendChild(svg);
      placeCodeLabels();
      applyCamera(false);
    }
    const status = M.coverageStatus(region, game);
    root.querySelectorAll('.india-region').forEach((path) => {
      const r = M.byId[path.dataset.region], st = M.coverageStatus(r, game), title = path.querySelector('title');
      const supported = M.coverageStatus(r, game) === 'Warehouse active', preview = !supported && M.coverageStatus(r, game) === 'Ready to expand';
      path.classList.toggle('is-operational', supported); path.classList.toggle('is-preview', !!preview); path.classList.toggle('is-locked', !supported && !preview);
      path.setAttribute('aria-label', r.name + '. ' + st); title.textContent = r.name + ' · ' + st;
    });
    const routeLayer = root.querySelector('.route-layer');
    if (routeLayer) routeLayer.innerHTML = cityMarkup(game);
    updateRegionStyles(); updateCityMarkers();
    const signature = [M.selected, game.unlocks.interstate, game.warehouses.map((w) => w.id + ':' + w.level).join(',')].join('|');
    if (signature !== M.renderedSignature) {
      M.renderedSignature = signature;
      document.getElementById('map-legend').dataset.coverage = status;
    }
  };

  function selectRegion(id) {
    if (!M.byId[id]) return;
    M.setSelected(id); M.setHovered(null);
    M.focusRegion(id);
    const hub = D.stateHub(id);
    IPM.UI.tab = 'fleet'; IPM.UI.fleetView = 'warehouses';
    if (hub) { IPM.UI.sel = hub.id; IPM.UI.mapCityPanel = true; }
    else IPM.UI.mapCityPanel = false;
    IPM.UI.render();
  }
  function openCityDetails(id) {
    if (IPM.UI.A && IPM.UI.A.cityPanel) IPM.UI.A.cityPanel(id);
  }

  let drag = null, suppressClick = false;
  const map = mapRoot();
  map.addEventListener('wheel', (event) => {
    if (!event.target.closest('#map-stage')) return;
    event.preventDefault(); M.zoomAt(Math.exp(-event.deltaY * 0.0012), event.clientX, event.clientY, true);
  }, { passive: false });
  map.addEventListener('pointerdown', (event) => {
    if (M.scale <= 1 || !event.target.closest('#map-stage')) return;
    if (cameraFrame) { M.scale = displayedCamera.scale; M.tx = displayedCamera.tx; M.ty = displayedCamera.ty; applyCamera(false); }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  });
  map.addEventListener('pointermove', (event) => {
    const path = event.target.closest('.india-region');
    if (path) M.setHovered(path.dataset.region);
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true; stage().classList.add('is-dragging');
      try { event.target.setPointerCapture(event.pointerId); } catch (e) {}
    }
    if (!drag.moved) return;
    const mapMatrix = stage().querySelector('svg').getScreenCTM();
    M.tx += dx / mapMatrix.a; M.ty += dy / mapMatrix.d;
    clampCamera(); applyCamera(false); drag.x = event.clientX; drag.y = event.clientY;
  });
  map.addEventListener('pointerup', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved; drag = null; stage().classList.remove('is-dragging');
    if (suppressClick) applyCamera(true);
    if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
  });
  map.addEventListener('pointercancel', () => { drag = null; stage().classList.remove('is-dragging'); applyCamera(true); });
  map.addEventListener('pointerout', (event) => {
    const from = event.target.closest('[data-region]'), to = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-region]') : null;
    if (from && (!to || to.dataset.region !== from.dataset.region)) M.setHovered(to && to.dataset.region);
  });
  map.addEventListener('click', (event) => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); return; }
    const path = event.target.closest('.india-region');
    if (path) { selectRegion(path.dataset.region); return; }
    const city = event.target.closest('[data-act="city"]');
    if (city) openCityDetails(city.dataset.a);
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-action]');
    if (!button || button.disabled) return;
    if (button.dataset.mapAction === 'zoom-in') M.zoomAt(ZOOM.step, null, null, true);
    if (button.dataset.mapAction === 'zoom-out') M.zoomAt(1 / ZOOM.step, null, null, true);
    if (button.dataset.mapAction === 'fit') M.fitIndia();
  });
  map.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const path = event.target.closest('[data-region]');
    if (path) { event.preventDefault(); selectRegion(path.dataset.region); return; }
    const city = event.target.closest('[data-act="city"]');
    if (city) { event.preventDefault(); openCityDetails(city.dataset.a); }
  });
  document.getElementById('side').addEventListener('pointerover', (event) => {
    const button = event.target.closest('.region-pick');
    if (button) M.setHovered(button.dataset.a);
  });
  document.getElementById('side').addEventListener('pointerout', (event) => {
    const button = event.target.closest('.region-pick'), next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('.region-pick') : null;
    if (button && (!next || next.dataset.a !== button.dataset.a)) M.setHovered(next && next.dataset.a);
  });
  document.getElementById('side').addEventListener('click', (event) => {
    const button = event.target.closest('.region-pick');
    if (button) selectRegion(button.dataset.a);
  });
  window.addEventListener('resize', () => { clampCamera(); applyCamera(false); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { clampCamera(); applyCamera(false); updateCityLabels(); }).observe(stage());
})();
