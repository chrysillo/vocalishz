// Range test, opened from Settings. Step 1 finds your lowest steady note, step 2 your highest.
(function (V) {
  const { $, el, ring } = V.ui;
  const STEADY_MS = 1000;   // how long a note must stay put to count
  const STEADY_CENTS = 40;  // how far it may wander from the semitone
  const ROWS = 13;          // semitones shown on the ladder
  const MAX_DT = 100;

  const tracker = new V.pitch.Tracker();
  const dial = ring($('range-ring'));
  let step = 1, low = null, best = null;
  let holdNote = null, holdMs = 0, lastFrame = 0, centre = 52;
  let unsubscribe = null;

  const better = (m) => best === null || (step === 1 ? m < best : m > best);
  const pos = (m) => ((centre + (ROWS - 1) / 2 - m) / (ROWS - 1) * 100) + '%';

  function renderLadder() {
    const rows = [];
    for (let i = 0; i < ROWS; i++) {
      const m = centre + (ROWS - 1) / 2 - i;
      rows.push(el('div', { class: 'rung' + (m % 12 === 0 ? ' c' : ''), style: 'top:' + pos(m) }, [el('span', { text: V.notes.name(m) })]));
    }
    rows.push(el('div', { class: 'best', id: 'range-best-line' }), el('div', { class: 'you', id: 'range-you' }));
    $('range-ladder').replaceChildren(...rows);
    renderBest();
  }

  function renderBest() {
    const line = $('range-best-line');
    line.hidden = best === null;
    if (best !== null) line.style.top = pos(best);
    $('range-best').hidden = best === null;
    if (best !== null) $('range-best').textContent = 'Your best so far: ' + V.notes.name(best);
    $('range-next').disabled = best === null || (step === 2 && best <= low);
  }

  function renderStep() {
    $('range-sub').textContent = step === 1 ? 'Step 1 of 2 · lowest note' : 'Step 2 of 2 · highest note';
    $('range-steps').dataset.step = step;
    $('range-next').textContent = step === 1 ? 'That’s my lowest' : 'That’s my highest';
    $('range-hint').textContent = step === 1 ? 'Slide down and hold' : 'Slide up and hold';
    $('range-note').textContent = '–';
    dial.progress(0); dial.state(''); dial.marker(null);
    centre = step === 1 ? 45 : 64;
    renderLadder();
  }

  function reset(toStep) {
    step = toStep; best = null; holdNote = null; holdMs = 0;
    tracker.reset();
    renderStep();
  }

  function onFrame(hz, clarity) {
    const now = Date.now();
    const dt = lastFrame ? Math.min(MAX_DT, now - lastFrame) : 0;
    lastFrame = now;
    const reading = tracker.update(hz, clarity);
    const you = $('range-you');
    if (!reading) {
      holdMs = Math.max(0, holdMs - 2 * dt);
      dial.progress(holdMs / STEADY_MS);
      if (holdMs === 0) { you.hidden = true; dial.marker(null); }
      return;
    }
    const nearest = Math.round(reading.midi);
    const cents = (reading.midi - nearest) * 100;
    if (nearest === holdNote && Math.abs(cents) <= STEADY_CENTS) holdMs += dt;
    else { holdNote = nearest; holdMs = 0; }

    if (Math.abs(reading.midi - centre) > (ROWS - 1) / 2 - 1) { centre = nearest; renderLadder(); }
    you.hidden = false;
    you.style.top = pos(reading.midi);

    const held = holdMs >= STEADY_MS;
    if (held && better(nearest)) { best = nearest; renderBest(); }
    $('range-note').textContent = V.notes.name(nearest);
    $('range-hint').textContent = held ? 'Held' : 'Hold… ' + (holdMs / 1000).toFixed(1) + ' s';
    dial.progress(holdMs / STEADY_MS);
    dial.state(held ? 'good' : '');
    dial.marker(cents);
  }

  $('range-restart').addEventListener('click', () => reset(step));
  $('range-next').addEventListener('click', () => {
    if (best === null) return;
    if (step === 1) { low = best; reset(2); return; }
    V.store.set('range', { low: low, high: best, tested: V.ui.today() });
    V.app.back();
  });

  V.app.register('range', {
    enter() { low = null; reset(1); lastFrame = 0; unsubscribe = V.audio.onPitch(onFrame); },
    leave() { if (unsubscribe) unsubscribe(); },
    wantsMic: () => true
  });
})(window.V = window.V || {});
