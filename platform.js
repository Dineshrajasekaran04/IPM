/* platform.js — UI audio and CrazyGames rewarded-ad integration */
(function () {
  'use strict';
  const IPM = window.IPM, UI = IPM.UI, S = IPM.S, U = IPM.U, P = (IPM.Platform = {});
  let ctx = null, sdkMuted = false;
  const activeSamples = new Set();
  const tones = { ui: [640], ok: [660, 880], buy: [520, 700], ring: [900, 700], bad: [220] };
  const audioRoot = 'assets/audio/kenney-ui-audio/';
  const samples = { ui: 'click1.wav', ok: 'click2.wav', buy: 'switch1.wav', ring: 'rollover1.wav', bad: 'click1.wav' };
  let musicTimer = 0, musicStep = 0, drone = [];
  const musicNotes = new Set();
  const audioContext = () => { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  P.play = (k) => {
    try {
      if (sdkMuted || !S.cur || !S.cur.settings.sound || !tones[k]) return;
      const sample = new Audio(audioRoot + (samples[k] || samples.ui)); sample.volume = k === 'ring' ? 0.22 : 0.3;
      sample.muted = sdkMuted; activeSamples.add(sample); sample.addEventListener('ended', () => activeSamples.delete(sample), { once: true });
      sample.play().catch(() => { activeSamples.delete(sample); if (!sdkMuted) tones[k].forEach((f, i) => { const audio = audioContext(), o = audio.createOscillator(), v = audio.createGain(); o.frequency.value = f; v.gain.value = 0.04; o.connect(v); v.connect(audio.destination); const t = audio.currentTime + i * 0.1; o.start(t); o.stop(t + 0.09); }); });
    } catch (e) {}
  };
  P.setSdkMuted = (muted) => { sdkMuted = !!muted; activeSamples.forEach((sample) => { sample.muted = sdkMuted; }); if (sdkMuted) { P.stopMusic(); musicNotes.forEach((osc) => { try { osc.stop(); } catch (e) {} }); musicNotes.clear(); } else if (S.cur && S.cur.settings.music !== false) P.startMusic(); };
  function musicNote(freq, delay, length, volume) {
    if (sdkMuted) return;
    const audio = audioContext(), start = audio.currentTime + delay, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'sine'; osc.frequency.value = freq; gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + 0.08); gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain); gain.connect(audio.destination); musicNotes.add(osc); osc.addEventListener('ended', () => musicNotes.delete(osc), { once: true }); osc.start(start); osc.stop(start + length + 0.02);
  }
  P.startMusic = () => {
    if (sdkMuted || !S.cur || S.cur.settings.music === false || musicTimer) return;
    try {
      const audio = audioContext(); audio.resume();
      drone = [146.83, 220].map((freq, i) => { const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = freq; gain.gain.value = i ? 0.003 : 0.005; osc.connect(gain); gain.connect(audio.destination); osc.start(); return osc; });
      const notes = [293.66, 349.23, 392, 440, 523.25, 440, 392, 349.23];
      const playBar = () => {
        if (!S.cur || S.cur.settings.music === false) return P.stopMusic();
        musicNote(notes[musicStep % notes.length], 0, 0.55, 0.012);
        if (musicStep % 4 === 0) musicNote(146.83, 0.01, 1.8, 0.009);
        musicStep = (musicStep + 1) % 8;
        musicTimer = window.setTimeout(playBar, 720);
      };
      musicTimer = window.setTimeout(playBar, 80);
    } catch (e) { P.stopMusic(); }
  };
  P.stopMusic = () => { if (musicTimer) window.clearTimeout(musicTimer); musicTimer = 0; drone.forEach((osc) => { try { osc.stop(); } catch (e) {} }); drone = []; };
  P.submitLeaderboardScore = async (score) => {
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    const config = IPM.D.CONFIG;
    if (!sdk || sdk.environment !== 'crazygames') return { ok: false, msg: 'Online scores can only be submitted on CrazyGames.' };
    if (!config.leaderboardEnabled || !config.leaderboardEncryptionKey) return { ok: false, msg: 'Online leaderboard is not configured for this game yet.' };
    if (!Number.isSafeInteger(score) || score < 0 || score > 999999999999999) return { ok: false, msg: 'This company score cannot be submitted.' };
    try {
      const keyBytes = Uint8Array.from(atob(config.leaderboardEncryptionKey), (char) => char.charCodeAt(0));
      if (keyBytes.length !== 32) throw new Error('Invalid leaderboard key');
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const algorithm = { name: 'AES-GCM', iv };
      const key = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);
      const encrypted = await window.crypto.subtle.encrypt(algorithm, key, new TextEncoder().encode(String(score)));
      const combined = new Uint8Array(iv.length + encrypted.byteLength); combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
      const encryptedScore = btoa(String.fromCharCode(...combined));
      if (!sdk.user || typeof sdk.user.submitScore !== 'function') throw new Error('Score submission is unavailable');
      await sdk.user.submitScore({ encryptedScore, score });
      return { ok: true, msg: 'Company score submitted to the CrazyGames leaderboard.' };
    } catch (error) { return { ok: false, msg: 'Score submission failed. Please try again later.' }; }
  };
  const note = UI.note;
  UI.note = (m, k, o) => { note(m, k, o); P.play((o && o.sound) || (k === 'bad' ? 'bad' : null)); };
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act="buyveh"],[data-act="hire"]'); if (t) P.play('buy'); });
  P.sdk = { gameplayStart() {}, gameplayStop() {}, happytime() {} };
  let adRequest = null;
  const adEnabled = () => {
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    return !!(sdk && (sdk.environment === 'local' || (sdk.environment === 'crazygames' && IPM.D.CONFIG.rewardedAdsEnabled)));
  };
  const adGate = (active) => {
    let gate = document.getElementById('ad-request-gate');
    if (active && !gate) {
      gate = document.createElement('div'); gate.id = 'ad-request-gate'; gate.setAttribute('role', 'status'); gate.setAttribute('aria-live', 'polite');
      gate.innerHTML = '<span class="ad-spinner" aria-hidden="true"></span><b>Checking for a sponsored video…</b><small>Your company is paused while the offer is checked.</small>';
      document.body.appendChild(gate);
    } else if (!active && gate) gate.remove();
  };
  P.adsTick = (dt) => {
    const g = S.cur; if (!g) return;
    g.adOffer = Object.assign({ roll: 0, nextAt: 480, dismissUntil: 0, active: false, rewardPending: false }, g.adOffer || {});
    const offer = g.adOffer;
    if (!adEnabled() || offer.active || offer.rewardPending || g.stats.deliveries < 3 || g.time < Math.max(offer.nextAt, offer.dismissUntil)) return;
    offer.roll += dt;
    if (offer.roll >= 38) {
      offer.roll = 0; offer.nextAt = g.time + 45;
      if (Math.random() < 0.16) { offer.active = true; UI.render(); }
    }
  };
  P.renderOffer = () => {
    const host = document.getElementById('map-shell'); if (!host) return;
    let card = document.getElementById('map-bonus-offer');
    const offer = S.cur && S.cur.adOffer, show = offer && adEnabled() && (offer.active || offer.rewardPending);
    if (!show) { if (card) card.remove(); return; }
    if (!card) { card = document.createElement('aside'); card.id = 'map-bonus-offer'; card.className = 'map-bonus-offer'; host.appendChild(card); }
    card.innerHTML = offer.rewardPending
      ? '<div class="bonus-stamp">2×</div><div class="bonus-copy"><small>NEXT PAYMENT</small><b>Bonus ready for dispatch</b><span>Your next completed delivery earns double payment.</span></div>'
      : '<div class="bonus-stamp">2×</div><div class="bonus-copy"><small>SPONSORED DISPATCH</small><b>Double one delivery payment</b><span>Choose to watch a short video for the next completed job.</span></div><button type="button" class="bonus-watch" data-act="adReward">Watch video</button><button type="button" class="bonus-dismiss" data-act="adDismiss" aria-label="Dismiss offer">×</button>';
  };
  const originalComplete = IPM.O.complete;
  IPM.O.complete = (order) => {
    const offer = S.cur && S.cur.adOffer;
    if (offer && offer.rewardPending) {
      offer.rewardPending = false; order.rewardMultiplier = 2; order.price *= 2;
      try { originalComplete(order); } finally { order.price /= 2; }
      UI.note('Sponsored bonus applied: ' + U.money(order.paid) + ' paid on this delivery.', 'good');
      P.renderOffer(); return;
    }
    originalComplete(order);
  };
  UI.A.adDismiss = () => {
    const offer = S.cur && S.cur.adOffer; if (!offer) return;
    offer.active = false; offer.roll = 0; offer.dismissUntil = S.cur.time + 360; IPM.V.save(); UI.render();
  };
  UI.A.adReward = () => {
    const sdk = window.CrazyGames && window.CrazyGames.SDK, g = S.cur;
    if (!g || !g.adOffer || !g.adOffer.active || !adEnabled() || !sdk || !sdk.ad || adRequest) return;
    const before = { paused: g.paused, sound: g.settings.sound, music: g.settings.music, started: false, settled: false };
    adRequest = before; g.paused = true; adGate(true); UI.render();
    const restore = (earned) => {
      if (before.settled) return; before.settled = true;
      const current = S.cur;
      if (current) {
        if (before.started) { current.settings.sound = before.sound; current.settings.music = before.music; if (before.music) P.startMusic(); }
        current.paused = before.paused;
        if (earned) { current.adOffer.active = false; current.adOffer.rewardPending = true; current.adOffer.nextAt = current.time + 600; }
        else { current.adOffer.active = false; current.adOffer.nextAt = current.time + 60; }
      }
      adGate(false); adRequest = null; IPM.V.save(); UI.render();
      if (earned) UI.note('Bonus secured. Your next completed delivery pays double.', 'good');
      else UI.note('No video is available right now. Your company can keep operating.', 'info');
    };
    try {
      sdk.ad.requestAd('rewarded', {
        adStarted: () => { before.started = true; adGate(false); const current = S.cur; if (current) { current.settings.sound = false; current.settings.music = false; P.stopMusic(); } },
        adFinished: () => restore(true),
        adError: () => restore(false),
      });
      window.setTimeout(() => { if (!before.settled) restore(false); }, 60000);
    } catch (e) { restore(false); }
  };
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act="adReward"],[data-act="adDismiss"]');
    if (action && !action.disabled) UI.A[action.dataset.act]();
  });
  const sp = UI.panels.settings;
  UI.panels.settings = () => sp() + '<div class="card"><button class="b n" data-act="sound">Sound: ' + (S.cur.settings.sound ? 'ON' : 'OFF') + '</button></div>';
  UI.A.sound = () => { S.cur.settings.sound = !S.cur.settings.sound; UI.render(); IPM.V.save(); };
  UI.A.music = () => { S.cur.settings.music = S.cur.settings.music === false; if (S.cur.settings.music) P.startMusic(); else P.stopMusic(); UI.render(); IPM.V.save(); };
  document.addEventListener('click', (event) => {
    if (S.cur && S.cur.settings.music !== false) P.startMusic();
    const target = event.target.closest('[data-play-section],[data-play],[data-rail],[data-map-action],[data-act="speed"],[data-act="pause"]');
    if (target && target.dataset.act !== 'sound' && target.dataset.act !== 'music') P.play('ui');
  });
})();
