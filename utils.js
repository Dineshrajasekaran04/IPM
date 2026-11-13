/* utils.js — formatting, random helpers, small utilities */
(function () {
  'use strict';
  const IPM = (window.IPM = window.IPM || {});
  const U = (IPM.U = {});

  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  U.weighted = (obj) => {
    let t = 0;
    for (const k in obj) t += obj[k];
    let r = Math.random() * t;
    for (const k in obj) {
      r -= obj[k];
      if (r <= 0) return k;
    }
    return Object.keys(obj)[0];
  };

  const trimNum = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  U.money = (n) => {
    n = Math.round(n || 0);
    return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');
  };
  U.short = (n) => {
    n = Math.round(n || 0);
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e7) return s + '₹' + trimNum(a / 1e7) + 'Cr';
    if (a >= 1e5) return s + '₹' + trimNum(a / 1e5) + 'L';
    return U.money(n);
  };
  U.time = (s) => {
    s = Math.max(0, Math.ceil(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  U.longTime = (s) => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
  };
  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.merge = function merge(def, src) {
    if (Array.isArray(def)) return Array.isArray(src) ? src : def.slice();
    if (def === null) return src === undefined ? null : src;
    if (typeof def === 'object') {
      const out = {};
      src = src && typeof src === 'object' ? src : {};
      for (const k in def) out[k] = merge(def[k], src[k]);
      for (const k in src) if (!(k in def)) out[k] = src[k];
      return out;
    }
    return src === undefined || src === null || typeof src !== typeof def ? def : src;
  };
  U.round = (n, step) => Math.round(n / step) * step;
  U.plural = (n, a, b) => (n === 1 ? a : b || a + 's');

  const FIRST = ['Arun', 'Priya', 'Karthik', 'Divya', 'Suresh', 'Meena', 'Ravi', 'Lakshmi', 'Vignesh', 'Anitha', 'Mohan', 'Kavya', 'Rajesh', 'Nisha', 'Senthil', 'Deepa', 'Imran', 'Fathima', 'Joseph', 'Sneha', 'Ganesh', 'Revathi', 'Harish', 'Pooja', 'Balaji', 'Swathi', 'Naveen', 'Gayathri', 'Prakash', 'Uma', 'Dinesh', 'Shalini'];
  const LAST = ['Kumar', 'Raman', 'Iyer', 'Nair', 'Reddy', 'Pillai', 'Menon', 'Sharma', 'Rao', 'Krishnan', 'Selvam', 'Murugan', 'Das', 'Fernandez', 'Khan', 'Thomas', 'Natarajan', 'Subramani', 'Ahmed', 'Devi'];
  U.person = () => U.pick(FIRST) + ' ' + U.pick(LAST);
  U.plate = () => {
    const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    return 'TN ' + String(U.randInt(1, 99)).padStart(2, '0') + ' ' + U.pick(L.split('')) + U.pick(L.split('')) + ' ' + U.randInt(1000, 9999);
  };
})();
