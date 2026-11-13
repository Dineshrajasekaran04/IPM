/* data.js — ALL balance values, locations, vehicles, upgrades, campaigns, research and map geometry.
   Change numbers here to rebalance the game. */
(function () {
  'use strict';
  const IPM = (window.IPM = window.IPM || {});
  const U = IPM.U;
  const D = (IPM.D = {});

  /* ---------------- Economy / system configuration ---------------- */
  D.CONFIG = {
    version: 1,
    saveKey: 'ipm_tycoon_save_v1',
    autosaveSec: 15,
    offlineCapSec: 4 * 3600,
    rewardedAdsEnabled: false, // Enable after CrazyGames approves ads; Basic Launch disables video ads.
    // Leaderboards are invite-only; set these from the CrazyGames Developer Portal to enable submissions.
    leaderboardEnabled: false,
    leaderboardEncryptionKey: '',
    startCash: 50000,
    confirmAbove: 100000, // purchases at/above this ask for confirmation
    maxLedger: 150, maxHistory: 50, maxLog: 60,
    roadFactor: 1.12, // straight-line km -> road km
    payCycleSec: 60, // wages & warehouse upkeep are paid once per cycle
    loan: { principal: 50000, rate: 0.02, cycleSec: 180, installment: 2500, lateFee: 250, step: 25000, maxPerLevel: 75000, emergency: 25000 },
    time: { kmPerSec: 10, minTravel: 8, maxTravel: 70, loadBase: 5.5, unloadFactor: 0.8, returnFactor: 0.7 },
    pricing: { distRate: 14, fragileFee: 150, express: 0.25, flex: 0.05, web: 0.04, app: 0.06, repeat: 0.05, repBoost: 0.002, repCap: 0.2, late: 0.75, damage: 0.9 },
    demand: {
      rates: { phone: 1 / 110, web: 1 / 150, app: 1 / 180, walk: 1 / 130 }, // organic enquiries per second at multiplier 1
      repPer: 0.012, repCap: 1.0, levelBonus: 0.1, patience: [70, 110],
    },
    rep: { onTime: 1, express: 0.5, perfect: 0.5, late: -2, damage: -1, expired: -0.4, failed: -3, cancel: -1 },
    xp: [0, 100, 300, 650, 1200, 2000, 3200, 5000, 8000, 12000, 18000],
    wear: { base: 1.5, perKm: 1 / 200, minCond: 20, repairPerPoint: 0.0018, repairSecPerPoint: 0.5, sellRate: 0.55 },
    wh: {
      baseStorage: 45, storagePerLevel: 20, storagePerUpg: 25, baseVeh: 3, vehPerLevel: 2, baseStaff: 6, staffPerLevel: 3,
      baseUpkeep: 150, upkeepPerLevel: 120, baseJobs: 2, jobsPerUpg: 1, jobsLevel3: 1, basePending: 4, pendingPerUpg: 2, pendingPerLevel: 1,
      loadingPerUpg: 0.08, packingPerUpg: 0.06, reachPerUpg: 0.1, walkPerLevel: 0.2, maxLevel: 5,
      levelCost: [0, 15000, 35000, 70000, 130000], condPerJob: 0.6, repairPerPoint: 25, lowCond: 50,
    },
    soft: { checkSec: 5, cooldown: 120 },
    train: { costBase: 900, costScale: 1.22, secPerLevel: 25, maxLevel: 10, wageGrowth: 1.04, promoteCost: 2500, promoteMinLevel: 3, refreshCost: 300 },
    marketing: { diminishing: [1, 0.62, 0.38], maxLift: 0.75, leadWeight: 0.65 },
    events: { rollSec: 30, chance: 0.18, cooldownSec: 120, repeatSec: 240, minDeliveriesForRisk: 3 },
  };
  const C = D.CONFIG;

  D.LEVEL_NAMES = ['Local Mover', 'Neighbourhood Pro', 'City Carrier', 'Regional Hauler', 'State Logistics', 'Zonal Network', 'National Mover', 'Logistics Baron', 'Freight Tycoon', 'Empire Builder', 'Legend of the Road'];

  // Company registration choices. These are selectable starting jurisdictions;
  // map and city data remain limited to Tamil Nadu for the current game build.
  D.START_REGIONS = {
    states: [
      ['ap', 'Andhra Pradesh'], ['ar', 'Arunachal Pradesh'], ['as', 'Assam'], ['br', 'Bihar'],
      ['cg', 'Chhattisgarh'], ['ga', 'Goa'], ['gj', 'Gujarat'], ['hr', 'Haryana'],
      ['hp', 'Himachal Pradesh'], ['jh', 'Jharkhand'], ['ka', 'Karnataka'], ['kl', 'Kerala'],
      ['mp', 'Madhya Pradesh'], ['mh', 'Maharashtra'], ['mn', 'Manipur'], ['ml', 'Meghalaya'],
      ['mz', 'Mizoram'], ['nl', 'Nagaland'], ['od', 'Odisha'], ['pb', 'Punjab'],
      ['rj', 'Rajasthan'], ['sk', 'Sikkim'], ['tn', 'Tamil Nadu'], ['ts', 'Telangana'],
      ['tr', 'Tripura'], ['up', 'Uttar Pradesh'], ['uk', 'Uttarakhand'], ['wb', 'West Bengal'],
    ],
    unionTerritories: [
      ['ch', 'Chandigarh'],
      ['dn', 'Dadra and Nagar Haveli and Daman and Diu'], ['dl', 'Delhi'],
      ['jk-ut', 'Jammu and Kashmir'], ['la', 'Ladakh'], ['ld', 'Lakshadweep'], ['py', 'Puducherry'],
    ],
  };

  /* ---------------- Order content ---------------- */
  D.SOURCES = {
    phone: { label: 'Phone Call', icon: 'phone' },
    web: { label: 'Website', icon: 'globe' },
    app: { label: 'Mobile App', icon: 'mobile' },
    walk: { label: 'Walk-in', icon: 'walk' },
  };
  D.URG = {
    flex: { label: 'Flexible', cls: '', mult: 2.2 },
    std: { label: 'Standard', cls: 'info', mult: 1.6 },
    exp: { label: 'Express', cls: 'warn', mult: 1.25 },
  };
  D.SIZES = {
    room: { label: 'Single Room', base: 900, units: [3, 5], mat: 120, matCharge: 150, items: [3, 4] },
    bhk1: { label: '1BHK', base: 1800, units: [8, 10], mat: 220, matCharge: 300, items: [5, 6] },
    bhk2: { label: '2BHK', base: 3000, units: [14, 18], mat: 380, matCharge: 520, items: [7, 8] },
    bhk3: { label: '3BHK', base: 4500, units: [26, 34], mat: 600, matCharge: 820, items: [9, 10] },
    office: { label: 'Small Office', base: 3500, units: [20, 28], mat: 450, matCharge: 620, items: [6, 8] },
  };
  // size weights by company level (highest key <= level is used)
  D.SIZE_W = {
    1: { room: 0.4, bhk1: 0.4, bhk2: 0.2 },
    2: { room: 0.25, bhk1: 0.3, bhk2: 0.3, bhk3: 0.1, office: 0.05 },
    3: { room: 0.15, bhk1: 0.25, bhk2: 0.3, bhk3: 0.2, office: 0.1 },
  };
  D.ITEMS = {
    home: [['Double bed', 0], ['Sofa set', 0], ['Dining table', 0], ['Wardrobe', 0], ['Refrigerator', 0], ['Washing machine', 0], ['LED TV', 1], ['Mattress', 0], ['Study table', 0], ['Kitchen cartons', 0], ['Glassware box', 1], ['Wall mirror', 1], ['Microwave oven', 1], ['Chairs', 0], ['Bicycle', 0], ['Pooja shelf', 0]],
    office: [['Desks', 0], ['Office chairs', 0], ['Computers', 1], ['Server rack', 1], ['Printer', 1], ['File cabinets', 0], ['Whiteboard', 1], ['Water dispenser', 0], ['Cartons of files', 0]],
  };

  /* ---------------- Vehicles ---------------- */
  D.VEHICLES = [
    { id: 'mini', name: 'Mini Truck', sub: 'Compact city mover', price: 28000, cap: 10, speed: 1.3, fuelKm: 4, maintKm: 1.5, unlock: {}, cargo: ['home', 'office'] },
    { id: 'medium', name: 'Medium Truck', sub: 'Inter-city household mover', price: 260000, cap: 60, speed: 0.85, fuelKm: 13, maintKm: 4.5, unlock: {}, cargo: ['home', 'office'] },
    { id: 'heavy', name: 'Heavy Truck', sub: 'Heavy-load freight truck', price: 520000, cap: 100, speed: 0.7, fuelKm: 17, maintKm: 6, unlock: { level: 4 }, cargo: ['home', 'office'] },
    { id: 'container', name: 'Container Truck', sub: 'Long-haul container carrier', price: 850000, cap: 160, speed: 0.62, fuelKm: 21, maintKm: 7.5, unlock: { level: 6 }, cargo: ['home', 'office'] },
  ];
  D.VEH = {
    pickup: { id: 'pickup', name: 'Pickup', price: 55000, cap: 18, speed: 1.25, fuelKm: 6, maintKm: 2, unlock: { flag: 'pickup' }, cargo: ['home', 'office'] },
    light: { id: 'light', name: 'Light Truck', price: 120000, cap: 35, speed: 1, fuelKm: 9, maintKm: 3, unlock: { level: 2 }, cargo: ['home', 'office'] },
    large: { id: 'large', name: 'Large Container', price: 520000, cap: 100, speed: 0.7, fuelKm: 17, maintKm: 6, unlock: { level: 6 }, cargo: ['home', 'office'] },
  };
  D.VEHICLES.forEach((v) => (D.VEH[v.id] = v));
  D.VUP = {
    cap: { label: 'Load frame', desc: '+10% capacity', per: 0.1, max: 3 },
    speed: { label: 'Engine tune', desc: '+8% speed', per: 0.08, max: 3 },
    fuel: { label: 'Fuel system', desc: '-8% fuel cost', per: 0.08, max: 3 },
    rel: { label: 'Reliability', desc: '-15% wear', per: 0.15, max: 3 },
  };

  /* ---------------- Staff ---------------- */
  D.ROLES = {
    packer: { label: 'Packer', recruit: 900, wage: [280, 380], req: {}, desc: 'Faster loading & fewer damages.' },
    driver: { label: 'Driver', recruit: 1200, wage: [360, 480], req: {}, desc: 'Safer, faster driving.' },
    supervisor: { label: 'Supervisor', recruit: 3500, wage: [700, 900], req: { level: 2 }, desc: '+1 simultaneous job, faster crews.' },
    whManager: { label: 'Warehouse Manager', recruit: 8000, wage: [1400, 1800], req: { level: 1 }, desc: 'Automates profitable order acceptance and idle vehicle repairs.' },
    opsManager: { label: 'Operations Manager', recruit: 20000, wage: [3000, 3600], req: { flag: 'opsManager', level: 4 }, desc: 'Lends vehicles & crews across warehouses.' },
  };

  /* ---------------- Warehouse upgrades ---------------- */
  D.WH_UPG = {
    storage: { label: 'Storage Racks', desc: '+25 storage units', max: 5, base: 6000, mult: 1.6 },
    loading: { label: 'Loading Bay', desc: '-8% loading time', max: 5, base: 5000, mult: 1.6 },
    handling: { label: 'Order Desk', desc: '+1 simultaneous job, +2 enquiry queue', max: 4, base: 9000, mult: 1.8 },
    packing: { label: 'Packing Station', desc: '-6% material cost, fewer damages', max: 5, base: 5000, mult: 1.6 },
    reach: { label: 'Local Reach', desc: '+10% local enquiries', max: 5, base: 7000, mult: 1.7 },
  };

  /* ---------------- Marketing ---------------- */
  D.CAMPAIGNS = {
    flyers: { name: 'Local Flyers', cost: 1500, dur: 90, mult: { phone: 1.5, walk: 1.9 }, req: { flag: 'flyers' }, desc: 'Boosts walk-in and phone enquiries around a warehouse.' },
    newspaper: { name: 'Newspaper Ad', cost: 4500, dur: 150, mult: { phone: 1.35, web: 1.25, walk: 1.35, app: 1.15 }, req: { level: 2 }, desc: 'Moderate regional demand increase on every channel.' },
    social: { name: 'Social Media Campaign', cost: 3600, dur: 120, spread: true, mult: { web: 1.9, app: 1.8 }, req: { flag: 'website' }, desc: 'Budget spent over time. Boosts website and app enquiries.' },
    referral: { name: 'Referral Programme', cost: 2500, dur: 180, reward: 150, repBonus: 0.5, mult: { phone: 1.2, web: 1.2, walk: 1.2, app: 1.2 }, req: { level: 3 }, desc: 'More repeat customers and reputation. Pays ₹150 per completed referred job.' },
  };
  D.SEO = { name: 'Search Listing / SEO', baseCost: 6000, mult: 1.8, max: 3, per: 0.2, req: { flag: 'website' }, desc: 'Permanent online enquiry bonus (+20% website & app per level).' };

  /* ---------------- Research ---------------- */
  D.RD_CATEGORIES = [
    { id: 'packTech', name: 'Packing Technology', max: 10, baseCost: 4200, scale: 1.58, reqLevel: 1, desc: 'Lower material use and fewer damaged goods.' },
    { id: 'routeOptimization', name: 'Route Optimization', max: 10, baseCost: 4800, scale: 1.58, reqLevel: 1, desc: 'Shorter trips reduce delivery time.' },
    { id: 'vehicleEngineering', name: 'Vehicle Engineering', max: 10, baseCost: 5200, scale: 1.6, reqLevel: 1, desc: 'Reduce fuel use and vehicle wear.' },
    { id: 'warehouseOperations', name: 'Warehouse Operations', max: 10, baseCost: 4500, scale: 1.58, reqLevel: 1, desc: 'Prepare and process jobs faster at every warehouse.' },
    { id: 'customerService', name: 'Customer Service', max: 10, baseCost: 4000, scale: 1.6, reqLevel: 1, desc: 'Improve delivery outcomes, customer patience and reputation gains.' },
  ];
  D.rdEffect = (id, level) => {
    level = Math.max(0, Math.min(10, level || 0));
    const marks = Math.floor(level / 3);
    if (id === 'packTech') return { materials: level * 0.02 + marks * 0.01, damage: level * 0.02 + marks * 0.015 };
    if (id === 'routeOptimization') return { travel: level * 0.01 + marks * 0.01 };
    if (id === 'vehicleEngineering') return { fuel: level * 0.01 + marks * 0.01, wear: level * 0.01 + marks * 0.005 };
    if (id === 'warehouseOperations') return { loading: level * 0.015 + marks * 0.005 };
    if (id === 'customerService') return { patience: level * 0.015 + marks * 0.01, repGain: level * 0.01 + marks * 0.005, damage: level * 0.01 + marks * 0.01 };
    return {};
  };
  D.rdText = (id, level) => {
    const fx = D.rdEffect(id, level), pct = (x) => Math.round(x * 100) + '%';
    if (id === 'packTech') return 'Materials -' + pct(fx.materials) + ' · damage risk -' + pct(fx.damage);
    if (id === 'routeOptimization') return 'Travel time -' + pct(fx.travel);
    if (id === 'vehicleEngineering') return 'Fuel -' + pct(fx.fuel) + ' · wear -' + pct(fx.wear);
    if (id === 'warehouseOperations') return 'Loading time -' + pct(fx.loading);
    return 'Customer patience +' + pct(fx.patience) + ' · reputation gains +' + pct(fx.repGain) + ' · damage risk -' + pct(fx.damage);
  };
  D.rdMilestones = [3, 6, 9];
  D.RESEARCH = [
    { id: 'booking', name: 'Online Booking System', cost: 7000, req: { flag: 'website' }, desc: 'Customers book and pay online.', fx: 'Website +25% enquiries, higher order value' },
    { id: 'app', name: 'Mobile App Development', cost: 18000, req: { level: 2 }, desc: 'Launch the customer app (alternative to the ₹1,00,000 revenue milestone).', fx: 'Unlocks Mobile App enquiries', sets: 'mobileApp' },
  ];
  D.fx = (g) => {
    const r = g.research || {};
    const fx = (id) => D.rdEffect(id, r[id]);
    const p = fx('packTech'), route = fx('routeOptimization'), veh = fx('vehicleEngineering'), wh = fx('warehouseOperations'), care = fx('customerService');
    return {
      travel: (r.route ? 0.92 : 1) * (1 - route.travel), materials: (r.packing ? 0.85 : 1) * (1 - p.materials),
      fuel: (r.fleet ? 0.88 : 1) * (1 - veh.fuel), wear: 1 - veh.wear, loading: 1 - wh.loading,
      damage: (1 - p.damage) * (1 - care.damage), web: r.booking ? 1.25 : 1,
      patience: (r.care ? 1.3 : 1) * (1 + care.patience), repGain: (r.care ? 1.1 : 1) * (1 + care.repGain), whCost: r.regional ? 0.85 : 1,
    };
  };

  D.EVENTS = {
    rollSec: C.events.rollSec, chance: C.events.chance, cooldownSec: C.events.cooldownSec, repeatSec: C.events.repeatSec,
    events: [
      { id: 'appreciation', name: 'Customer appreciation', tone: 'good', weight: 1, kind: 'delivery', condition: 'completed', reward: [180, 450], msg: 'A customer sent a tip after a smooth delivery.' },
      { id: 'referral', name: 'Customer referral', tone: 'good', weight: 0.8, kind: 'delivery', condition: 'completed', reward: [350, 700], msg: 'A customer recommended your company. The referral brought a booking advance.' },
        { id: 'unexpectedReward', name: 'Unexpected reward', tone: 'good', weight: 0.45, kind: 'reward', condition: 'company', reward: [500, 1200], msg: 'A local business association awarded your company a small service grant.' },
        { id: 'reputationMilestone', name: 'Reputation milestone', tone: 'good', weight: 0.3, kind: 'rep-reward', condition: 'reputation_milestone', reward: 2000, msg: 'Your company has earned a strong local reputation. A trade association recognized the milestone.' },
        { id: 'localOpportunity', name: 'Local business opportunity', tone: 'good', weight: 0.45, kind: 'demand', condition: 'warehouse', duration: 100, multiplier: 1.18, msg: 'A nearby housing society is moving this week and has begun requesting quotes.' },
      { id: 'festival', name: 'Festival season', tone: 'info', weight: 0.7, kind: 'demand', condition: 'warehouse', duration: 120, multiplier: 1.25, msg: 'Local moving enquiries are up during the festival period.' },
      { id: 'supplier', name: 'Supplier discount', tone: 'good', weight: 0.7, kind: 'discount', condition: 'company', duration: 150, discount: 0.12, msg: 'A packing supplier offered a short discount on vehicle purchases and repairs.' },
        { id: 'fuelPrice', name: 'Fuel price increase', tone: 'warn', weight: 0.5, kind: 'fuel-price', condition: 'travelling_vehicle', duration: 100, multiplier: 1.12, msg: 'A temporary fuel price increase is affecting active routes.' },
        { id: 'accident', name: 'Vehicle accident', tone: 'warn', weight: 0.35, kind: 'accident', condition: 'idle_vehicle', minDeliveries: 3 },
      { id: 'trafficCheck', name: 'Traffic police check', tone: 'warn', weight: 0.55, kind: 'travel-fine', condition: 'travelling_vehicle', minDeliveries: 3, fine: [350, 750] },
      { id: 'puncture', name: 'Vehicle puncture', tone: 'warn', weight: 0.65, kind: 'vehicle-repair', condition: 'travelling_vehicle', minDeliveries: 3, cost: [300, 650], conditionLoss: 5 },
      { id: 'traffic', name: 'Unexpected traffic', tone: 'warn', weight: 0.8, kind: 'delay', condition: 'active_route', minDeliveries: 3, delay: [8, 15] },
        { id: 'packingDamage', name: 'Package damage', tone: 'warn', weight: 0.55, kind: 'damage', condition: 'fragile_packing', minDeliveries: 3, msg: 'A fragile package was damaged during handling.' },
        { id: 'absence', name: 'Worker injury', tone: 'warn', weight: 0.35, kind: 'injury', condition: 'staff_surplus', minDeliveries: 3, duration: 55 },
      { id: 'marketNote', name: 'Local market note', tone: 'info', weight: 0.4, kind: 'notice', condition: 'warehouse', msg: 'The local movers association reports steady demand this week.' },
      { id: 'monsoonDelay', name: 'Monsoon showers', tone: 'warn', weight: 0.65, kind: 'delay', condition: 'active_route', minDeliveries: 3, delay: [10, 22], msg: 'Heavy monsoon showers slowed a delivery route.' },
      { id: 'highwayCheck', name: 'Highway permit check', tone: 'warn', weight: 0.45, kind: 'travel-fine', condition: 'travelling_vehicle', minDeliveries: 4, fine: [450, 950] },
      { id: 'housingReferral', name: 'Housing society referral', tone: 'good', weight: 0.55, kind: 'reward', condition: 'warehouse', reward: [650, 1400], msg: 'A housing society referred several local families to your company.' },
      { id: 'packingRush', name: 'Seasonal packing rush', tone: 'info', weight: 0.55, kind: 'demand', condition: 'warehouse', duration: 90, multiplier: 1.16, msg: 'A local festival brought a short wave of moving enquiries.' },
    ],
  };

  /* ---------------- Milestones ---------------- */
  D.MILESTONES = [
    { id: 'first', name: 'First Delivery', desc: 'Complete your first delivery', unlock: 'website', reward: 'Website enquiries unlocked', xp: 30, prog: (g) => [g.stats.deliveries, 1] },
      { id: 'd5', name: 'Getting Busy', desc: 'Complete 5 deliveries', reward: 'Bonus XP', xp: 50, prog: (g) => [g.stats.deliveries, 5] },
    { id: 'rep10', name: 'Known Locally', desc: 'Reach reputation 10', unlock: 'flyers', reward: 'Local flyer campaign unlocked', xp: 50, prog: (g) => [Math.floor(g.rep), 10] },
    { id: 'd20', name: 'Reliable Movers', desc: 'Complete 20 deliveries', reward: 'Bonus XP', xp: 80, prog: (g) => [g.stats.deliveries, 20] },
    { id: 'rev1l', name: 'First Lakh', desc: 'Earn lifetime revenue of ₹1,00,000', unlock: 'mobileApp', reward: 'Mobile app channel unlocked', xp: 100, prog: (g) => [g.fin.lifetimeRevenue, 100000] },
    { id: 'wh2', name: 'Two-State Network', desc: 'Establish warehouses in two states', reward: 'Network milestone', xp: 100, prog: (g) => [new Set(g.warehouses.map((w) => { const city = D.city(w.id); return city && city.state; })).size, 2], eligible: (g) => g.warehouses.some((w) => w.openedAt > 0) },
    { id: 'fleet5', name: 'Fleet Owner', desc: 'Own 5 vehicles', reward: 'Bonus XP', xp: 100, prog: (g) => [g.vehicles.length, 5] },
    { id: 'd50', name: 'Statewide Name', desc: 'Complete 50 deliveries', unlock: 'interstate', reward: 'Interstate expansion preview unlocked', xp: 300, prog: (g) => [g.stats.deliveries, 50] },
    { id: 'rev10l', name: 'Ten Lakh Club', desc: 'Earn lifetime revenue of ₹10,00,000', reward: 'Bonus XP', xp: 250, prog: (g) => [g.fin.lifetimeRevenue, 1000000] },
  ];
  D.FLAG_NAMES = { website: 'Website enquiries', pickup: 'Pickup vehicle', flyers: 'Local flyers', mobileApp: 'Mobile app channel', opsManager: 'Operations Manager', interstate: 'Interstate preview' };

  /* ---------------- Tamil Nadu locations (data-driven; add more rows freely) ---------------- */
  D.CITIES = [
    { id: 'chennai', name: 'Chennai', state: 'tn', lat: 13.08, lon: 80.27, demand: 1.0, cost: 0, minLevel: 1, minRep: 0, label: [14, -6, 'start'], note: 'Starting hub' },
    { id: 'tiruvallur', name: 'Tiruvallur', state: 'tn', lat: 13.14, lon: 79.91, demand: 0.5, cost: 70000, minLevel: 2, minRep: 5, label: [-12, -8, 'end'], note: 'Nearby district' },
    { id: 'kanchipuram', name: 'Kanchipuram', state: 'tn', lat: 12.83, lon: 79.7, demand: 0.5, cost: 75000, minLevel: 2, minRep: 5, label: [-12, 16, 'end'], note: 'Nearby district' },
    { id: 'chengalpattu', name: 'Chengalpattu', state: 'tn', lat: 12.69, lon: 79.98, demand: 0.55, cost: 60000, minLevel: 2, minRep: 5, label: [12, 18, 'start'], note: 'First expansion candidate' },
    { id: 'vellore', name: 'Vellore', state: 'tn', lat: 12.92, lon: 79.13, demand: 0.6, cost: 120000, minLevel: 3, minRep: 12, label: [0, -14, 'middle'], note: 'Mid-range route' },
    { id: 'villupuram', name: 'Villupuram', state: 'tn', lat: 11.94, lon: 79.49, demand: 0.4, cost: 120000, minLevel: 3, minRep: 12, label: [12, 4, 'start'], note: 'Mid-range route' },
    { id: 'salem', name: 'Salem', state: 'tn', lat: 11.66, lon: 78.15, demand: 0.7, cost: 180000, minLevel: 4, minRep: 20, label: [-12, 4, 'end'], note: 'Long route' },
    { id: 'thanjavur', name: 'Thanjavur', state: 'tn', lat: 10.79, lon: 79.14, demand: 0.45, cost: 200000, minLevel: 4, minRep: 20, label: [12, 4, 'start'], note: 'Regional route' },
    { id: 'trichy', name: 'Tiruchirappalli', state: 'tn', lat: 10.8, lon: 78.7, demand: 0.8, cost: 260000, minLevel: 5, minRep: 30, label: [-12, 4, 'end'], note: 'Major regional hub' },
    { id: 'coimbatore', name: 'Coimbatore', state: 'tn', lat: 11.02, lon: 76.96, demand: 0.9, cost: 300000, minLevel: 5, minRep: 30, label: [-12, 4, 'end'], note: 'Major western hub' },
    { id: 'madurai', name: 'Madurai', state: 'tn', lat: 9.93, lon: 78.12, demand: 0.85, cost: 300000, minLevel: 5, minRep: 30, label: [-12, 4, 'end'], note: 'Major southern hub' },
    { id: 'tirunelveli', name: 'Tirunelveli', state: 'tn', lat: 8.73, lon: 77.7, demand: 0.45, cost: 350000, minLevel: 6, minRep: 40, label: [-12, 4, 'end'], note: 'Southern route' },
  ];
  D.STATE_HUBS = [
    ['ap', 'Amaravati', 16.57, 80.36], ['ar', 'Itanagar', 27.08, 93.62], ['as', 'Dispur', 26.14, 91.79], ['br', 'Patna', 25.61, 85.14],
    ['cg', 'Raipur', 21.25, 81.63], ['ga', 'Panaji', 15.49, 73.83], ['gj', 'Gandhinagar', 23.22, 72.64], ['hr', 'Chandigarh', 30.73, 76.78],
    ['hp', 'Shimla', 31.10, 77.17], ['jh', 'Ranchi', 23.36, 85.33], ['ka', 'Bengaluru', 12.97, 77.59], ['kl', 'Thiruvananthapuram', 8.52, 76.94],
    ['mp', 'Bhopal', 23.26, 77.41], ['mh', 'Mumbai', 19.07, 72.87], ['mn', 'Imphal', 24.82, 93.94], ['ml', 'Shillong', 25.58, 91.89],
    ['mz', 'Aizawl', 23.73, 92.72], ['nl', 'Kohima', 25.67, 94.11], ['od', 'Bhubaneswar', 20.29, 85.82], ['pb', 'Chandigarh', 30.73, 76.78],
    ['rj', 'Jaipur', 26.91, 75.79], ['sk', 'Gangtok', 27.33, 88.61], ['tn', 'Chennai', 13.08, 80.27], ['ts', 'Hyderabad', 17.39, 78.49],
    ['tr', 'Agartala', 23.83, 91.28], ['up', 'Lucknow', 26.85, 80.95], ['uk', 'Dehradun', 30.32, 78.03], ['wb', 'Kolkata', 22.57, 88.36],
    ['an', 'Port Blair', 11.67, 92.74], ['ch', 'Chandigarh', 30.73, 76.78], ['dn', 'Daman', 20.42, 72.83], ['dl', 'New Delhi', 28.61, 77.20],
    ['jk-ut', 'Srinagar', 34.08, 74.80], ['la', 'Leh', 34.15, 77.58], ['ld', 'Kavaratti', 10.56, 72.64], ['py', 'Puducherry', 11.93, 79.83],
  ].filter(([state]) => state !== 'tn').map(([state, name, lat, lon]) => ({ id: 'hub-' + state, state, name, lat, lon, demand: 0.8, cost: 75000, minLevel: 2, minRep: 5, note: 'State service hub', hub: true }));
  D.CITIES.push(...D.STATE_HUBS);
  D.stateHub = (state) => state === 'tn' ? D.CITY.chennai : D.CITY['hub-' + state];
  D.CITY = {};
  D.CITIES.forEach((c) => (D.CITY[c.id] = c));
  D.city = (id) => D.CITY[id];
  D.ROADS = [['chennai', 'tiruvallur'], ['chennai', 'chengalpattu'], ['chennai', 'kanchipuram'], ['chengalpattu', 'kanchipuram'], ['kanchipuram', 'vellore'], ['tiruvallur', 'vellore'], ['vellore', 'salem'], ['vellore', 'villupuram'], ['salem', 'coimbatore'], ['salem', 'trichy'], ['chengalpattu', 'villupuram'], ['villupuram', 'trichy'], ['villupuram', 'thanjavur'], ['trichy', 'thanjavur'], ['trichy', 'madurai'], ['madurai', 'tirunelveli']];

  const distCache = {};
  D.dist = (a, b) => {
    if (a === b) return 0;
    const key = a < b ? a + '|' + b : b + '|' + a;
    if (distCache[key] == null) {
      const A = D.CITY[a], B = D.CITY[b];
      distCache[key] = Math.max(10, Math.round(U.haversine(A.lat, A.lon, B.lat, B.lon) * C.roadFactor));
    }
    return distCache[key];
  };
  D.STATE_HUBS.forEach((hub) => {
    const distance = D.dist('chennai', hub.id);
    hub.cost = Math.round((60000 + distance * 45) / 1000) * 1000;
    hub.minLevel = Math.max(2, Math.min(8, 2 + Math.floor(distance / 650)));
    hub.minRep = Math.max(5, Math.min(45, 5 + Math.floor(distance / 240) * 2));
  });
})();
