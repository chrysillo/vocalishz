// Settings: your voice (range and keyboard), practice options and tuner options.
// The segmented controls are bound generically in app.js through data-setting.
(function (V) {
  const { $, el } = V.ui;
  const isBlack = (m) => [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0;

  function keyboard(low, high) {
    const from = Math.floor(low / 12) * 12;            // C at or below the low note
    const to = Math.max(Math.ceil((high + 1) / 12) * 12, from + 36); // at least three octaves
    const whites = [];
    for (let m = from; m <= to; m++) if (!isBlack(m)) whites.push(m);
    const w = 100 / whites.length;
    const keys = [], labels = [];
    whites.forEach((m, i) => {
      keys.push(el('i', { class: 'white' + (m >= low && m <= high ? ' in' : ''), style: 'left:' + i * w + '%;width:' + w + '%' }));
      if (m % 12 === 0) labels.push(el('span', { style: 'left:' + i * w + '%', text: V.notes.name(m) }));
      if (isBlack(m + 1) && m + 1 <= to) {
        const b = m + 1;
        keys.push(el('i', { class: 'black' + (b >= low && b <= high ? ' in' : ''), style: 'left:' + ((i + 1) * w - w * 0.3) + '%;width:' + w * 0.6 + '%' }));
      }
    });
    return el('div', { class: 'keyboard' }, [el('div', { class: 'keys', 'aria-hidden': 'true' }, keys), el('div', { class: 'key-labels' }, labels)]);
  }

  function testedText(date) {
    if (!date) return '';
    if (date === V.ui.today()) return 'tested today';
    return 'tested ' + new Date(date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /** Earlier tests, newest first, skipping the one shown above; nothing until there are two. */
  function history() {
    const past = V.store.get('rangeHistory').slice(1);
    if (!past.length) return '';
    return el('div', { class: 'voice-history' }, [el('div', { class: 'voice-history-title', text: 'Earlier tests' })].concat(
      past.map((r) => el('div', { class: 'voice-history-row' }, [
        el('span', { text: testedText(r.tested).replace('tested ', '') }),
        el('span', { text: V.notes.name(r.low) + ' – ' + V.notes.name(r.high) }),
        el('span', { text: V.notes.voiceType(r.low, r.high) })
      ]))));
  }

  function renderVoice() {
    const range = V.store.get('range');
    const card = $('settings-voice');
    if (!range) {
      card.replaceChildren(el('div', { class: 'voice-empty', text: 'No range yet. Test it once and warm-ups and the challenge fit your voice.' }));
      $('settings-test').textContent = 'Test my range';
      return;
    }
    card.replaceChildren(
      el('div', { class: 'voice-head' }, [
        el('div', {}, [
          el('div', { class: 'voice-type', text: V.notes.voiceType(range.low, range.high) }),
          el('div', { class: 'voice-meta', text: V.notes.span(range.low, range.high) + (range.tested ? ' · ' + testedText(range.tested) : '') })
        ]),
        el('div', { class: 'voice-range', text: V.notes.name(range.low) + ' – ' + V.notes.name(range.high) })
      ]),
      keyboard(range.low, range.high),
      history()
    );
    $('settings-test').textContent = 'Test my range again';
  }

  function renderA4() {
    const a4 = V.store.get('a4');
    $('settings-a4').textContent = a4 + ' Hz';
    $('settings-a4-down').disabled = a4 <= 415;
    $('settings-a4-up').disabled = a4 >= 466;
  }

  $('settings-a4-down').addEventListener('click', () => V.store.set('a4', V.store.get('a4') - 1));
  $('settings-a4-up').addEventListener('click', () => V.store.set('a4', V.store.get('a4') + 1));
  V.store.onChange((key) => {
    if (key === 'range' || key === 'rangeHistory') renderVoice();
    if (key === 'a4') renderA4();
  });

  renderVoice();
  renderA4();
  V.app.register('settings', {});
})(window.V = window.V || {});
