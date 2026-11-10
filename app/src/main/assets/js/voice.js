// Range result: the voice type your range fits best, a chart against the typical voice types and a few plain facts.
(function (V) {
  const { $, el } = V.ui;
  const FROM = 36, TO = 88;   // C2 to E6, the chart's note axis
  const LANE_LEFT = 102;      // px taken by the voice names, matches .vc-axis margin

  const pct = (m) => ((Math.max(FROM, Math.min(TO, m)) - FROM) / (TO - FROM)) * 100;
  const steps = (n) => n === 1 ? '1 semitone' : n + ' semitones';

  function chart(range, type) {
    const rows = V.notes.VOICES.map(([name, lo, hi]) => el('div', { class: 'vc-row' + (name === type ? ' match' : '') }, [
      el('span', { text: name.replace('-soprano', '') }),
      el('div', { class: 'vc-lane' }, [el('i', { style: 'left:' + pct(lo) + '%;width:' + (pct(hi) - pct(lo)) + '%' })])
    ]));
    const axis = el('div', { class: 'vc-axis' },
      [36, 48, 60, 72, 84].map((m) => el('span', { style: 'left:' + pct(m) + '%', text: V.notes.name(m) })));
    // The box covers the lanes only: offset by the name column, scaled to the lane width.
    const you = el('div', { class: 'vc-you', style:
      'left:calc(' + LANE_LEFT + 'px + (100% - ' + LANE_LEFT + 'px) * ' + pct(range.low) / 100 + ');' +
      'width:calc((100% - ' + LANE_LEFT + 'px) * ' + (pct(range.high) - pct(range.low)) / 100 + ')' });
    const legend = el('div', { class: 'vc-legend' }, [
      el('span', {}, [el('b', { style: 'background:var(--surf2)' }), 'Typical range']),
      el('span', {}, [el('b', { style: 'border:2px solid var(--acc)' }), 'You'])
    ]);
    return [el('div', { class: 'vc-rows' }, [...rows, you]), axis, legend];
  }

  function facts(range, type) {
    const [, lo, hi] = V.notes.VOICES.find((v) => v[0] === type);
    const semis = range.high - range.low;
    const out = [];
    const edge = (diff, word) => diff > 0 ? steps(diff) + ' ' + word + ' a typical ' + type.toLowerCase() : null;
    const top = edge(range.high - hi, 'above') || (range.high < hi ? 'Room to grow: a typical ' + type.toLowerCase() + ' reaches ' + V.notes.name(hi) : 'Right at a typical ' + type.toLowerCase() + '’s top');
    const bottom = edge(lo - range.low, 'below') || (range.low > lo ? 'A typical ' + type.toLowerCase() + ' goes down to ' + V.notes.name(lo) : 'Right at a typical ' + type.toLowerCase() + '’s bottom');
    out.push(['Top note', V.notes.name(range.high), top]);
    out.push(['Bottom note', V.notes.name(range.low), bottom]);
    const width = semis < 18 ? 'Narrower than most people. It usually widens with practice.'
      : semis <= 26 ? 'About what most people sing without training (1½–2 octaves).'
      : 'Wider than most people sing without training.';
    out.push(['Span', V.notes.span(range.low, range.high), width]);
    return out.map(([label, value, note]) => el('div', { class: 'row' }, [
      el('span', {}, [label, el('small', { text: note })]), el('b', { text: value })
    ]));
  }

  V.app.register('voice', {
    enter() {
      const range = V.store.get('range');
      if (!range) return;
      const type = V.notes.voiceType(range.low, range.high);
      $('voice-type').textContent = type;
      $('voice-range').textContent = V.notes.name(range.low) + ' – ' + V.notes.name(range.high) + ' · ' + V.notes.span(range.low, range.high);
      $('voice-chart').replaceChildren(...chart(range, type));
      $('voice-facts').replaceChildren(...facts(range, type));
    }
  });
})(window.V = window.V || {});
