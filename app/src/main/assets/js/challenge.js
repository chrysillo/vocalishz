// Challenge: drop the ball. Sing a major scale from Do up to Do with no prompts. Each rung only
// breaks, and lets the ball fall to the next, once you hold its note in tune. The clock runs
// from Start until the last rung breaks.
(function (V) {
  const { $, el, tuneState, formatTime } = V.ui;
  const DEGREES = V.notes.MAJOR;
  const METER_CENTS = 100;  // the side meter spans ± this many cents

  const tracker = new V.pitch.Tracker();
  const holder = new V.pitch.Holder();
  let phase = 'ready';      // ready | playing | done
  let step = 0, startedAt = 0, finishedIn = 0, clock = null, unsubscribe = null;

  /** Lowest tonic whose octave fits inside the range, preferring C. */
  function defaultRoot() {
    const range = V.store.get('range');
    if (!range) return 48; // C3
    const fits = [];
    for (let r = range.low + 1; r + 12 <= range.high - 1; r++) fits.push(r);
    if (!fits.length) return Math.max(36, Math.min(72, range.low));
    return fits.find((r) => r % 12 === 0) || fits[0];
  }
  const root = () => { const r = V.store.get('challengeRoot'); return r === null ? defaultRoot() : r; };
  const notes = () => DEGREES.map((d) => root() + d);

  function renderLadder() {
    const style = V.store.get('names');
    const rungs = notes().map((m, i) => {
      const label = V.notes.label(m, root(), style);
      const state = phase === 'ready' ? '' : i < step ? 'done' : i === step && phase === 'playing' ? 'current' : '';
      return el('div', { class: 'rung', 'data-state': state }, [
        el('div', { class: 'rung-label' }, [
          el('b', { text: label.main }),
          el('small', { text: state === 'current' && label.aside ? ' · ' + label.aside : '' })
        ]),
        el('div', { class: 'rung-bar' }, [el('i'), el('i')])
      ]);
    });
    $('challenge-ladder').replaceChildren(...rungs, el('div', { class: 'ball', id: 'challenge-ball' }));
    placeBall();
  }

  function placeBall() {
    const ball = $('challenge-ball');
    const rungs = $('challenge-ladder').querySelectorAll('.rung');
    const i = Math.min(step, rungs.length - 1);
    const bar = rungs[i] && rungs[i].querySelector('.rung-bar');
    if (!bar) return;
    ball.style.transform = 'translate(-50%, ' + (bar.offsetTop - 36) + 'px)';
    ball.hidden = phase === 'done';
  }

  function renderHeader() {
    $('challenge-sub').textContent = V.notes.letter(root()) + ' major · Do to Do';
    $('challenge-key').textContent = V.notes.letter(root()) + ' major';
    $('challenge-key-oct').textContent = 'from ' + V.notes.name(root());
    $('challenge-key-down').disabled = root() <= 36;
    $('challenge-key-up').disabled = root() >= 72;
    $('challenge-time').textContent = formatTime(phase === 'playing' ? Date.now() - startedAt : phase === 'done' ? finishedIn : 0);
  }

  function render() {
    $('s-challenge').dataset.phase = phase;
    renderHeader();
    renderLadder();
    if (phase === 'done') $('challenge-result').textContent = 'Done in ' + formatTime(finishedIn);
    if (phase !== 'playing') meter(null);
  }

  function meter(cents, m) {
    const mark = $('challenge-marker');
    if (cents === null) { mark.hidden = true; return; }
    mark.hidden = false;
    const c = Math.max(-METER_CENTS, Math.min(METER_CENTS, cents));
    mark.style.top = (50 - c / METER_CENTS * 50) + '%';
    mark.dataset.state = tuneState(cents, V.store.get('tolerance'));
    $('challenge-you').textContent = V.notes.name(m);
  }

  function stopClock() { if (clock) { clearInterval(clock); clock = null; } }

  function start() {
    step = 0; startedAt = Date.now();
    tracker.reset(); holder.reset();
    phase = 'playing';
    stopClock();
    clock = setInterval(renderHeader, 250);
    V.app.refreshMic();
    render();
  }

  function stop(toPhase) {
    stopClock();
    phase = toPhase;
    V.app.refreshMic();
    render();
  }

  function onFrame(hz, clarity) {
    if (phase !== 'playing') return;
    const reading = tracker.update(hz, clarity);
    const target = notes()[step];
    const h = holder.update(reading ? reading.midi : null, target, V.store.get('tolerance'), V.store.get('hold'));
    // The meter compares you with the nearest octave of the target, so an octave slip still reads.
    if (reading) {
      const off = reading.midi - target;
      meter((off - 12 * Math.round(off / 12)) * 100, Math.round(reading.midi));
    } else meter(null);
    if (!h.passed) return;
    holder.reset();
    step++;
    if (step >= DEGREES.length) { finishedIn = Date.now() - startedAt; stop('done'); return; }
    renderLadder();
  }

  $('challenge-start').addEventListener('click', start);
  $('challenge-again').addEventListener('click', start);
  $('challenge-stop').addEventListener('click', () => stop('ready'));
  $('challenge-key-down').addEventListener('click', () => V.store.set('challengeRoot', root() - 1));
  $('challenge-key-up').addEventListener('click', () => V.store.set('challengeRoot', root() + 1));
  V.store.onChange((key) => {
    if (key === 'challengeRoot' || key === 'range' || key === 'names') { if (phase !== 'playing') phase = 'ready'; render(); }
  });

  V.app.register('challenge', {
    enter() { unsubscribe = V.audio.onPitch(onFrame); phase = 'ready'; render(); },
    leave() { if (unsubscribe) unsubscribe(); stopClock(); phase = 'ready'; },
    wantsMic: () => phase === 'playing'
  });
})(window.V = window.V || {});
