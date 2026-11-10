// Warm-ups: get the voice ready, gently, from the middle of your range outwards. The order follows
// the usual teaching sequence: find a comfortable note, small slides, then steps, then leaps, and
// only then the full-range siren. Each rep is played first, then you sing it back a note at a time;
// a note passes once held in tune. Skill and speed live in the Challenge tab instead.
(function (V) {
  const { $, el, tuneState } = V.ui;
  // sound: what to sing it on. Gentle, semi-occluded sounds (hum, lip trill) come first, as voice
  // teachers recommend; the app hears the pitch the same way whatever the sound.
  // slide: a glide between the notes rather than separate steps, with a looser tolerance.
  // centre: where in your range the first rep starts, as a share from the bottom.
  const STAGES = [
    { name: 'Find your note', sound: 'Hum', about: 'Hold an easy note, step up and back', pattern: [0], roots: [0, 2, 4, 2, 0], centre: 0.3 },
    { name: 'Gentle slides', sound: 'Lip trill', about: 'Glide down from Sol to Do', pattern: [7, 0], slide: true, roots: [0, 1, 2, 3], centre: 0.3 },
    { name: '5-note scale', sound: 'Ah', about: 'Do to Sol and back, step by step', pattern: [0, 2, 4, 5, 7, 5, 4, 2, 0], roots: [0, 1, 2, 3, 2, 1], centre: 0.25 },
    { name: 'Arpeggio', sound: 'Ah', about: 'Do, Mi, Sol and back down', pattern: [0, 4, 7, 4, 0], roots: [0, 1, 2, 3, 4], centre: 0.3 },
    { name: 'Octave arpeggio', sound: 'Ah', about: 'Do, Mi, Sol, high Do and back', pattern: [0, 4, 7, 12, 7, 4, 0], roots: [0, 1, 2, 3], centre: 0.2 },
    { name: 'Siren', sound: 'Lip trill or oo', about: 'One slow slide through your whole range', siren: true, slide: true }
  ];
  const MARGIN = 2;      // semitones kept clear of each end of your range
  const STEP_MS = 600;   // note spacing when the app plays a rep
  const SLIDE_TOLERANCE = 50;
  const SLIDE_HOLD = 0.3;

  /** The reps of a stage for a range: [{ root, notes }], kept inside the range. */
  function plan(stage, range) {
    const lo = Math.min(range.low + MARGIN, range.high), hi = Math.max(range.high - MARGIN, lo);
    if (stage.siren) return [{ root: lo, notes: [lo, hi, lo] }];
    const top = Math.max(...stage.pattern);
    const start = Math.round(lo + (hi - lo) * stage.centre);
    const fit = (r) => Math.max(lo, Math.min(hi - top, r));
    const reps = [];
    stage.roots.forEach((d) => {
      const r = fit(start + d);
      if (!reps.length || reps[reps.length - 1].root !== r || stage.pattern.length === 1) reps.push({ root: r, notes: stage.pattern.map((p) => r + p) });
    });
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
      const notes = [].concat(...reps.map((r) => r.notes));
      const detail = stage.about + ' · ' + V.notes.name(Math.min(...notes)) + '–' + V.notes.name(Math.max(...notes));
      // Each warm-up starts on its own; "Start warm-up" below runs them all in order.
      return el('li', {}, [el('button', { class: 'step', 'aria-label': 'Start ' + stage.name, onclick: () => V.app.push('session', { stage: i, only: true }) }, [
        el('span', { class: 'step-num', text: i + 1 }),
        el('div', { class: 'grow' }, [el('div', { class: 'step-name' }, [stage.name, el('span', { class: 'step-sound', text: stage.sound })]), el('div', { class: 'step-detail', text: detail })]),
        el('span', { class: 'step-go', text: '›' })
      ])]);
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
  const chart = V.ui.pitchChart($('session-chart'), () => stage().slide ? SLIDE_TOLERANCE : V.store.get('tolerance'));
  const holder = new V.pitch.Holder();
  let stageIdx = 0, reps = [], repIdx = 0, noteIdx = 0;
  let onlyOne = false;     // a single warm-up picked from the list, rather than the full run
  let playIdx = -1;        // note sounding while listening; noteIdx keeps your place
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
    playIdx = 0;
    setPhase('listen');
    cancelPlayback = V.audio.playSequence(rep().notes, STEP_MS, (i) => { playIdx = i; render(); }, () => {
      cancelPlayback = null;
      turn();
    });
  }

  function turn() {
    stopPlayback();
    playIdx = -1;
    holder.reset(); tracker.reset();
    setPhase('turn');
  }

  /** Flashes the target on the chart and bounces the chip just finished, so a hit is obvious. */
  function celebrate(i) {
    chart.hit(rep().notes[i]);
    const chip = $('session-chips').children[i];
    if (chip) { chip.classList.remove('hit'); void chip.offsetWidth; chip.classList.add('hit'); }
  }

  function advance(hit) {
    if (hit) celebrate(noteIdx);
    holder.reset();
    noteIdx++;
    if (noteIdx < rep().notes.length) { render(); return; }
    repIdx++;
    if (repIdx < reps.length) startRep();
    else if (!onlyOne && stageIdx + 1 < STAGES.length) startStage(stageIdx + 1);
    else { stopPlayback(); setPhase('done'); }
  }

  /** The siren spans your range rather than a key, so it always uses letter names. */
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
    $('session-sub').textContent = stage().sound + ' · ' +
      (onlyOne ? '' : 'Stage ' + (stageIdx + 1) + ' of ' + STAGES.length + ' · ') + 'Rep ' + (repIdx + 1) + ' of ' + reps.length;
    $('session-listen').classList.toggle('on', phase === 'listen');
    $('session-turn').classList.toggle('on', phase === 'turn');
    $('session-pause').textContent = phase === 'paused' ? 'Resume' : 'Pause';
    $('session-skip').textContent = phase === 'listen' ? 'Start singing' : 'Skip note';

    const shown = phase === 'listen' && playIdx >= 0 ? playIdx : noteIdx;
    const m = rep().notes[shown], label = noteLabel(m);
    $('session-cue').textContent = phase === 'listen' ? 'Listen' : phase === 'paused' ? 'Paused' : 'Sing';
    $('session-note').textContent = label.main;
    $('session-aside').textContent = label.aside || '';
    $('session-chips').querySelectorAll('span').forEach((c, i) => {
      const hit = c.classList.contains('hit') ? ' hit' : '';
      c.className = (i < noteIdx ? 'done' : i === shown ? 'current' : '') + hit;
    });
    chart.setTarget(m, rep().notes);
    if (phase !== 'turn') chart.progress(0);
  }

  function onFrame(hz, clarity) {
    if (phase !== 'turn') return;
    const reading = tracker.update(hz, clarity);
    const slide = stage().slide;
    const tolerance = slide ? SLIDE_TOLERANCE : V.store.get('tolerance');
    const h = holder.update(reading ? reading.midi : null, target(), tolerance, slide ? SLIDE_HOLD : V.store.get('hold'));
    chart.push(reading ? reading.midi : null, h.cents === null ? '' : tuneState(h.cents, tolerance));
    chart.progress(h.progress);
    if (h.passed) advance(true);
  }

  // Listen replays the notes without losing your place; tapping it again while they play gets you singing straight away.
  $('session-listen').addEventListener('click', () => { if (phase === 'turn') listen(); else if (phase === 'listen') turn(); });
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
    enter(params) {
      onlyOne = !!params.only;
      chart.start(); unsubscribe = V.audio.onPitch(onFrame); startStage(params.stage || 0);
    },
    leave() { stopPlayback(); chart.stop(); if (unsubscribe) unsubscribe(); phase = 'listen'; },
    wantsMic: () => phase === 'turn'
  });
})(window.V = window.V || {});
