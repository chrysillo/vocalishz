// Challenge, "Thread the Needle": sing a course of notes as fast as you can, from memory (or, on
// the Echo level, by ear: each note is played as its wall arrives). A ball follows your pitch and each note is a wall with a hole at that note;
// hold the ball in the hole to go through. Levels and courses are in courses.js; each level keeps
// your best time.
(function (V) {
  const { $, el, tuneState, formatTime } = V.ui;
  const LEVELS = V.courses.LEVELS;
  const level = () => LEVELS[V.store.get('challengeLevel')];
  const PREVIEW_S = 1;   // a tapped chip plays its note this long, as in the warm-ups
  const STEP_MS = 600;   // note spacing when Listen plays the course, as in the warm-ups

  const tracker = new V.pitch.Tracker();
  const holder = new V.pitch.Holder();
  const game = V.ui.holeGame($('challenge-chart'), () => V.store.get('tolerance'),
    (m) => V.notes.label(m, root(), V.store.get('names')).main);
  let phase = 'ready';      // ready | playing | done
  let step = 0, startedAt = 0, finishedIn = 0, newBest = false, clock = null, unsubscribe = null;
  let listenIdx = -1, cancelListen = null;   // Listen playing the course before a run

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
  // The course is drawn once per run, so random levels stay put until you start again.
  let course = null;
  const newCourse = () => { course = V.courses.course(V.store.get('challengeLevel'), root()); };
  const notes = () => { if (!course) newCourse(); return course; };

  /** The walls, the header and the chips for each scale degree. */
  function renderLadder() {
    const style = V.store.get('names'), list = notes();
    const playing = phase === 'playing';
    game.set(list, phase === 'done' ? list.length : step, root());
    const listening = listenIdx >= 0;
    const current = list[listening ? listenIdx : Math.min(step, list.length - 1)], label = V.notes.label(current, root(), style);
    $('challenge-cue').textContent = phase === 'done' ? '' : playing ? 'Sing' : listening ? 'Listen' : 'Start on';
    $('challenge-note').textContent = phase === 'done' ? '✓' : label.main;
    $('challenge-aside').textContent = phase === 'done' ? '' : label.aside || '';
    // Each chip takes its wall's colour: solid once cleared, outlined while it's the one to sing (or
    // the one Listen is playing). Before a run, tap one to hear its note, as in the warm-ups.
    const ready = phase === 'ready';
    $('challenge-chips').replaceChildren(...list.map((m, i) => {
      const done = phase === 'done' || i < step, current = (playing && i === step) || i === listenIdx;
      const text = V.notes.label(m, root(), style).main;
      return el(ready ? 'button' : 'span', Object.assign({
        class: done ? 'done' : current ? 'current' : '',
        style: done ? 'background:' + game.color(m) + ';color:#fff' : current ? 'background:transparent;color:inherit;box-shadow:inset 0 0 0 2px ' + game.color(m) : '',
        text: text
      }, ready ? { 'aria-label': 'Play ' + text, onclick: () => preview(i) } : {}));
    }));
  }

  /** Listen: plays the course before a run, a note at a time; tapping it again stops. */
  function listen() {
    if (cancelListen) { stopListen(); return; }
    if (phase !== 'ready') return;
    $('challenge-listen').classList.add('on');
    listenIdx = 0;
    cancelListen = V.audio.playSequence(notes(), STEP_MS, (i) => { listenIdx = i; renderLadder(); }, stopListen);
    renderLadder();
  }

  function stopListen() {
    if (cancelListen) cancelListen();
    cancelListen = null;
    $('challenge-listen').classList.remove('on');
    if (listenIdx < 0) return;
    listenIdx = -1;
    renderLadder();
  }

  /** Plays a chip's note on its own. Before a run only, and not while Listen is playing. */
  function preview(i) {
    if (phase !== 'ready' || cancelListen) return;
    V.audio.playNote(notes()[i], PREVIEW_S);
    const chip = $('challenge-chips').children[i];
    chip.classList.remove('play'); void chip.offsetWidth; chip.classList.add('play');
  }

  function hitChip(i) {
    const chip = $('challenge-chips').children[i];
    if (chip) { chip.classList.remove('hit'); void chip.offsetWidth; chip.classList.add('hit'); }
  }

  function renderHeader() {
    $('challenge-sub').textContent = V.notes.letter(root()) + ' major · ' + level().name;
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
    if (phase === 'done') $('challenge-result').textContent = (newBest ? 'New best! ' : 'Done in ') + formatTime(finishedIn);
    const best = V.store.get('bests')[V.store.get('challengeLevel')];
    $('challenge-best').textContent = best ? 'Best ' + formatTime(best) : 'No best time yet';
    if (phase !== 'playing') game.progress(0);
  }

  /** Echo level: play the note to sing as its wall slides in. The mic is muted while it sounds. */
  function echo() {
    if (phase === 'playing' && level().echo) V.audio.playNote(notes()[step], 0.9);
  }

  function stopClock() { if (clock) { clearInterval(clock); clock = null; } }

  function start() {
    stopListen();
    step = 0; startedAt = Date.now();
    if (level().random && phase === 'done') newCourse();  // a fresh course for each retry
    tracker.reset(); holder.reset(); game.reset();
    phase = 'playing';
    stopClock();
    clock = setInterval(renderHeader, 250);
    V.app.refreshMic();
    render();
    echo();
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
    game.push(reading ? reading.midi : null, h.cents === null ? '' : tuneState(h.cents, V.store.get('tolerance')));
    game.progress(h.progress);
    if (!h.passed) return;
    holder.reset();
    game.pass();
    step++;
    if (step >= notes().length) {
      finishedIn = Date.now() - startedAt;
      const bests = V.store.get('bests'), id = V.store.get('challengeLevel');
      newBest = !bests[id] || finishedIn < bests[id];
      if (newBest) V.store.set('bests', Object.assign({}, bests, { [id]: finishedIn }));
      stop('done'); hitChip(step - 1); return;
    }
    renderLadder();
    hitChip(step - 1);
    echo();
  }

  const levelSelect = $('challenge-level');
  Object.keys(LEVELS).forEach((k) => levelSelect.append(el('option', { value: k, text: LEVELS[k].name })));
  levelSelect.value = V.store.get('challengeLevel');
  levelSelect.addEventListener('change', () => V.store.set('challengeLevel', levelSelect.value));
  $('challenge-listen').addEventListener('click', listen);
  $('challenge-start').addEventListener('click', start);
  $('challenge-again').addEventListener('click', start);
  $('challenge-stop').addEventListener('click', () => stop('ready'));
  $('challenge-key-down').addEventListener('click', () => V.store.set('challengeRoot', root() - 1));
  $('challenge-key-up').addEventListener('click', () => V.store.set('challengeRoot', root() + 1));
  V.store.onChange((key) => {
    if (key === 'challengeLevel') levelSelect.value = V.store.get('challengeLevel');
    if (key === 'challengeRoot' || key === 'range' || key === 'challengeLevel') { stopListen(); course = null; }
    if (key === 'challengeRoot' || key === 'range' || key === 'names' || key === 'challengeLevel') { if (phase !== 'playing') phase = 'ready'; render(); }
  });

  V.app.register('challenge', {
    enter() { game.start(); unsubscribe = V.audio.onPitch(onFrame); phase = 'ready'; render(); },
    leave() { stopListen(); if (unsubscribe) unsubscribe(); game.stop(); stopClock(); phase = 'ready'; },
    wantsMic: () => phase === 'playing'
  });
})(window.V = window.V || {});
