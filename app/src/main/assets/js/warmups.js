// Warm-ups: an optional guided session. The tab lists the stages; the session screen runs them
// one after another. Each rep is played to you first, then you sing it back one note at a time,
// and a note passes once held in tune. Reps move up a semitone at a time within your range.
(function (V) {
  const { $, el, ring, tuneState } = V.ui;
  const STAGES = [
    { name: 'Siren', siren: true },
    { name: '5-note scale', pattern: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
    { name: 'Triad arpeggio', pattern: [0, 4, 7, 12, 7, 4, 0] },
    { name: 'Fifth jumps', pattern: [0, 7, 0, 7, 12, 7, 0] }
  ];
  const MARGIN = 2;      // semitones kept clear of each end of your range
  const MAX_REPS = 6;
  const STEP_MS = 600;   // note spacing when the app plays a rep
  const SIREN_TOLERANCE = 50;
  const SIREN_HOLD = 0.3;

  /** The reps of a stage for a range: [{ root, notes }]. */
  function plan(stage, range) {
    const lo = Math.min(range.low + MARGIN, range.high), hi = Math.max(range.high - MARGIN, lo);
    if (stage.siren) return [{ root: lo, notes: [lo, hi, lo] }];
    const top = Math.max(...stage.pattern);
    const reps = [];
    for (let r = lo; r + top <= hi && reps.length < MAX_REPS; r++) reps.push({ root: r, notes: stage.pattern.map((p) => r + p) });
    if (!reps.length) {
      const r = Math.max(range.low, range.high - top);
      reps.push({ root: r, notes: stage.pattern.map((p) => r + p) });
    }
    return reps;
  }

  // ---- Warm-ups tab ----
  function renderList() {
    const range = V.store.get('range');
    const body = $('warmups-body');
    if (!range) {
      $('warmups-sub').textContent = 'Fitted to your range';
      body.replaceChildren(el('div', { class: 'card empty' }, [
        el('p', { text: 'Warm-ups are built around your range. Test it first; it takes under a minute.' }),
        el('button', { class: 'btn primary block', 'data-go': 'range', text: 'Test my range' })
      ]));
      return;
    }
    $('warmups-sub').textContent = 'Fitted to your range, ' + V.notes.name(range.low) + ' – ' + V.notes.name(range.high);
    const items = STAGES.map((stage, i) => {
      const reps = plan(stage, range);
      const first = reps[0].notes, last = reps[reps.length - 1].notes;
      const detail = stage.siren
        ? 'Slide ' + V.notes.name(first[0]) + ' – ' + V.notes.name(first[1]) + ' and back'
        : reps.length + (reps.length === 1 ? ' rep · ' : ' reps · ') +
          V.notes.name(Math.min(...first)) + ' to ' + V.notes.name(Math.max(...last));
      return el('li', {}, [
        el('span', { class: 'step-num', text: i + 1 }),
        el('div', {}, [el('div', { class: 'step-name', text: stage.name }), el('div', { class: 'step-detail', text: detail })])
      ]);
    });
    body.replaceChildren(
      el('ol', { class: 'card steps' }, items),
      el('button', { class: 'btn primary block', 'data-go': 'session', text: 'Start warm-up' })
    );
  }

  V.store.onChange((key) => { if (key === 'range') renderList(); });
  renderList();
  V.app.register('warmups', {});

  // ---- session ----
  const tracker = new V.pitch.Tracker();
  const holder = new V.pitch.Holder();
  const dial = ring($('session-ring'));
  let stageIdx = 0, reps = [], repIdx = 0, noteIdx = 0;
  let phase = 'listen';    // listen | turn | paused | done
  let pausedFrom = null, cancelPlayback = null, unsubscribe = null;

  const stage = () => STAGES[stageIdx];
  const rep = () => reps[repIdx];
  const target = () => rep().notes[noteIdx];

  function setPhase(p) {
    phase = p;
    V.app.refreshMic();
    render();
  }

  function stopPlayback() {
    if (cancelPlayback) { cancelPlayback(); cancelPlayback = null; }
  }

  function startStage(i) {
    stageIdx = i;
    reps = plan(stage(), V.store.get('range'));
    repIdx = 0;
    startRep();
  }

  function startRep() {
    noteIdx = 0;
    renderChips();
    listen();
  }

  function listen() {
    stopPlayback();
    noteIdx = 0;
    setPhase('listen');
    cancelPlayback = V.audio.playSequence(rep().notes, STEP_MS, (i) => { noteIdx = i; render(); }, () => {
      cancelPlayback = null;
      turn();
    });
  }

  function turn() {
    noteIdx = 0;
    holder.reset(); tracker.reset();
    setPhase('turn');
  }

  function advance() {
    holder.reset();
    noteIdx++;
    if (noteIdx < rep().notes.length) { render(); return; }
    repIdx++;
    if (repIdx < reps.length) startRep();
    else if (stageIdx + 1 < STAGES.length) startStage(stageIdx + 1);
    else { stopPlayback(); setPhase('done'); }
  }

  /** The siren is a slide, not a scale, so it always uses letter names. */
  function noteLabel(m) { return V.notes.label(m, rep().root, stage().siren ? 'letters' : V.store.get('names')); }

  function renderChips() {
    $('session-chips').replaceChildren(...rep().notes.map((m) => {
      return el('span', { text: noteLabel(m).main });
    }));
  }

  function render() {
    const done = phase === 'done';
    $('s-session').dataset.phase = phase;
    if (done) return;
    $('session-title').textContent = stage().name;
    $('session-sub').textContent = 'Stage ' + (stageIdx + 1) + ' of ' + STAGES.length +
      ' · rep ' + (repIdx + 1) + ' of ' + reps.length;
    $('session-listen').classList.toggle('on', phase === 'listen');
    $('session-turn').classList.toggle('on', phase === 'turn');
    $('session-pause').textContent = phase === 'paused' ? 'Resume' : 'Pause';

    const m = target(), label = noteLabel(m);
    $('session-cue').textContent = phase === 'listen' ? 'Listen' : phase === 'paused' ? 'Paused' : 'Sing';
    $('session-note').textContent = label.main;
    $('session-aside').textContent = (label.aside ? label.aside + ' · ' : '') + V.notes.midiToHz(m, V.store.get('a4')).toFixed(1) + ' Hz';
    $('session-chips').querySelectorAll('span').forEach((c, i) => {
      c.className = phase === 'turn' && i < noteIdx ? 'done' : i === noteIdx ? 'current' : '';
    });
    if (phase !== 'turn') { dial.progress(0); dial.state(''); dial.marker(null); }
  }

  function onFrame(hz, clarity) {
    if (phase !== 'turn') return;
    const reading = tracker.update(hz, clarity);
    const siren = stage().siren;
    const tolerance = siren ? SIREN_TOLERANCE : V.store.get('tolerance');
    const h = holder.update(reading ? reading.midi : null, target(), tolerance, siren ? SIREN_HOLD : V.store.get('hold'));
    dial.progress(h.progress);
    dial.marker(h.cents);
    dial.state(h.cents === null ? '' : tuneState(h.cents, tolerance));
    if (h.passed) advance();
  }

  $('session-listen').addEventListener('click', () => { if (phase === 'turn') listen(); });
  $('session-skip').addEventListener('click', () => {
    if (phase === 'listen') { stopPlayback(); turn(); } else if (phase === 'turn') advance();
  });
  $('session-pause').addEventListener('click', () => {
    if (phase === 'paused') { if (pausedFrom === 'listen') listen(); else setPhase('turn'); return; }
    if (phase !== 'listen' && phase !== 'turn') return;
    pausedFrom = phase;
    stopPlayback();
    setPhase('paused');
  });

  V.app.register('session', {
    enter() { unsubscribe = V.audio.onPitch(onFrame); startStage(0); },
    leave() { stopPlayback(); if (unsubscribe) unsubscribe(); phase = 'listen'; },
    wantsMic: () => phase === 'turn'
  });
})(window.V = window.V || {});
