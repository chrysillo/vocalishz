// Tuner tab: instrument picker, dial or bar gauge, note readout and string buttons.
(function (V) {
  const { $, el, svg, icon, tuneState } = V.ui;
  const INSTRUMENTS = {
    chromatic: { label: 'Chromatic', strings: null },
    guitar: { label: 'Guitar · Standard', strings: [40, 45, 50, 55, 59, 64] },
    bass: { label: 'Bass · Standard', strings: [28, 33, 38, 43] },
    ukulele: { label: 'Ukulele · Standard', strings: [67, 60, 64, 69] } // re-entrant G
  };
  const IN_TUNE = 5;          // cents
  const TUNED_AFTER = 0.6;    // seconds in tune before a string gets its check mark
  const IDLE_MS = 900;
  const BAR_STEP = 2.5;       // cents per bar in the bar view

  const tracker = new V.pitch.Tracker();
  const holder = new V.pitch.Holder();
  let target = null, smooth = null, lastSeen = 0;
  let tuned = new Set();
  let unsubscribe = null;
  let needle, bars = [];

  const strings = () => INSTRUMENTS[V.store.get('mode')].strings;

  // ---- gauges ----
  function buildDial() {
    const cx = 175, cy = 178, r = 150;
    const at = (deg, rad) => [cx + rad * Math.sin(deg * Math.PI / 180), cy - rad * Math.cos(deg * Math.PI / 180)];
    const arc = (from, to) => {
      const a = at(from, r), b = at(to, r);
      return 'M' + a[0] + ' ' + a[1] + ' A' + r + ' ' + r + ' 0 0 1 ' + b[0] + ' ' + b[1];
    };
    const parts = [
      svg('path', { class: 'dial-track', d: arc(-90, 90) }),
      svg('path', { class: 'dial-zone', d: arc(-IN_TUNE * 1.8, IN_TUNE * 1.8) })
    ];
    for (let c = -50; c <= 50; c += 2) {
      const major = c % 10 === 0, a = at(c * 1.8, r - 14), b = at(c * 1.8, r - 14 - (major ? 16 : 8));
      parts.push(svg('line', { class: major ? 'dial-tick major' : 'dial-tick', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
    }
    [-50, -25, 0, 25, 50].forEach((c) => {
      const p = at(c * 1.8, r - 52);
      parts.push(svg('text', { x: p[0], y: p[1] + 4, text: c > 0 ? '+' + c : c === 0 ? '0' : '−' + -c }));
    });
    needle = svg('g', { class: 'dial-needle' }, [
      svg('polygon', { points: (cx - 5) + ',' + cy + ' ' + (cx + 5) + ',' + cy + ' ' + cx + ',' + (cy - r + 8) }),
      svg('circle', { cx: cx, cy: cy - r + 8, r: 7 })
    ]);
    parts.push(needle, svg('circle', { class: 'dial-pivot', cx: cx, cy: cy, r: 9 }));
    return svg('svg', { class: 'dial', viewBox: '0 0 350 190', 'aria-hidden': 'true' }, parts);
  }

  function buildBars() {
    bars = [];
    for (let c = -50; c <= 50; c += BAR_STEP) {
      const t = 1 - Math.abs(c) / 50;
      const b = el('i', { style: 'height:' + Math.round(32 + 52 * t * t) + 'px' });
      if (c === 0) b.className = 'mid';
      bars.push(b);
    }
    return el('div', { class: 'bars' }, [
      el('div', { class: 'bars-row', 'aria-hidden': 'true' }, bars),
      el('div', { class: 'bars-scale' }, [el('span', { text: '♭ −50' }), el('span', { text: '0' }), el('span', { text: '+50 ♯' })])
    ]);
  }

  function renderView() {
    const view = V.store.get('tunerView');
    $('s-tuner').dataset.view = view;
    const host = $('tuner-gauge');
    host.replaceChildren(view === 'dial' ? buildDial() : buildBars());
    if (view === 'dial') needle.style.opacity = 0;
  }

  // ---- strings ----
  function renderStrings() {
    const box = $('tuner-strings');
    const list = strings();
    box.replaceChildren();
    box.hidden = !list;
    if (!list) return;
    list.forEach((m) => box.append(el('button', {
      'data-midi': m, 'aria-label': 'Play ' + V.notes.name(m), onclick: () => V.audio.playNote(m, 1.6)
    }, [V.notes.name(m), el('span', { class: 'badge' }, [icon('check')])])));
  }

  function renderStringState(active, good) {
    $('tuner-strings').querySelectorAll('button').forEach((b) => {
      const m = +b.dataset.midi;
      b.classList.toggle('active', m === active && !good);
      b.classList.toggle('good', m === active && good);
      b.classList.toggle('tuned', tuned.has(m) && !(m === active));
    });
  }

  // ---- readout ----
  function idle() {
    target = null; smooth = null;
    tracker.reset(); holder.reset();
    $('tuner-note').textContent = '–';
    $('tuner-oct').textContent = '';
    $('tuner-sub').innerHTML = '&nbsp;';
    $('tuner-readout').dataset.state = 'idle';
    if (needle) { needle.style.opacity = 0; needle.dataset.state = ''; }
    bars.forEach((b) => { b.dataset.state = ''; });
    renderStringState(null, false);
  }

  function show(m, cents, hz) {
    const state = tuneState(cents, IN_TUNE);
    const good = state === 'good';
    $('tuner-readout').dataset.state = good ? 'good' : '';
    $('tuner-note').textContent = V.notes.letter(m);
    $('tuner-oct').textContent = V.notes.octave(m);
    const r = Math.round(cents);
    $('tuner-sub').innerHTML = '';
    $('tuner-sub').append(hz.toFixed(1) + ' Hz · ', el('b', { text: (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + '¢' }));

    const clamped = Math.max(-50, Math.min(50, cents));
    if (needle) {
      needle.style.opacity = 1;
      needle.style.transform = 'rotate(' + clamped * 1.8 + 'deg)';
      needle.dataset.state = state;
    }
    if (bars.length) {
      const hit = Math.round((clamped + 50) / BAR_STEP);
      bars.forEach((b, i) => { b.dataset.state = i === hit ? state : Math.abs(i - hit) <= 2 ? 'near' : ''; });
    }
    renderStringState(m, good);
  }

  function onFrame(hz, clarity) {
    const reading = tracker.update(hz, clarity);
    if (!reading) {
      if (lastSeen && Date.now() - lastSeen > IDLE_MS) { lastSeen = 0; idle(); }
      return;
    }
    lastSeen = Date.now();
    const list = strings();
    const m = list
      ? list.reduce((best, s) => Math.abs(s - reading.midi) < Math.abs(best - reading.midi) ? s : best, list[0])
      : Math.round(reading.midi);
    if (m !== target) { target = m; smooth = null; holder.reset(); }
    const cents = (reading.midi - m) * 100;
    smooth = smooth === null ? cents : smooth + (cents - smooth) * 0.35;
    if (list && holder.update(m + smooth / 100, m, IN_TUNE, TUNED_AFTER).passed) tuned.add(m);
    show(m, smooth, reading.hz);
  }

  // ---- wiring ----
  const select = $('tuner-mode');
  Object.keys(INSTRUMENTS).forEach((k) => select.append(el('option', { value: k, text: INSTRUMENTS[k].label })));
  select.value = V.store.get('mode');
  select.addEventListener('change', () => V.store.set('mode', select.value));

  V.store.onChange((key) => {
    if (key === 'tunerView') { renderView(); idle(); }
    if (key === 'mode') { select.value = V.store.get('mode'); tuned = new Set(); renderStrings(); idle(); }
  });

  renderView();
  renderStrings();
  idle();

  V.app.register('tuner', {
    enter() { unsubscribe = V.audio.onPitch(onFrame); },
    leave() { if (unsubscribe) unsubscribe(); idle(); },
    wantsMic: () => true
  });
})(window.V = window.V || {});
