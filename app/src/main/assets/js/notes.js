// Note maths and naming. Pure functions, no DOM.
(function (V) {
  const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  // Lowered 3rd, 6th and 7th as Me, Le, Te so the minor scale reads the usual way.
  const SOLFEGE = ['Do', 'Di', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'Sol', 'Le', 'La', 'Te', 'Ti'];
  const INTERVALS = ['', 'a minor 2nd', 'a 2nd', 'a minor 3rd', 'a 3rd', 'a 4th', 'a tritone',
    'a 5th', 'a minor 6th', 'a 6th', 'a minor 7th', 'a 7th'];
  // Typical comfortable ranges, low to high voices.
  const VOICES = [
    ['Bass', 40, 64], ['Baritone', 43, 67], ['Tenor', 48, 72],
    ['Alto', 53, 77], ['Mezzo-soprano', 57, 81], ['Soprano', 60, 84]
  ];

  const mod12 = (n) => ((n % 12) + 12) % 12;

  V.notes = {
    hzToMidi: (hz, a4) => 69 + 12 * Math.log2(hz / a4),
    midiToHz: (m, a4) => a4 * Math.pow(2, (m - 69) / 12),
    letter: (m) => LETTERS[mod12(m)],
    octave: (m) => Math.floor(m / 12) - 1,
    name: (m) => LETTERS[mod12(m)] + (Math.floor(m / 12) - 1),
    /** Movable-do syllable of `m` in the major key whose tonic is `root`. */
    solfege: (m, root) => SOLFEGE[mod12(m - root)],

    /** Label for a sung note, following the "Note names" setting. */
    label(m, root, style) {
      if (style === 'solfege') return { main: V.notes.solfege(m, root), aside: V.notes.name(m) };
      if (style === 'letters') return { main: V.notes.name(m), aside: '' };
      return { main: V.notes.name(m), aside: V.notes.solfege(m, root) };
    },

    /** "2 octaves + a 2nd" */
    span(low, high) {
      const semis = high - low, oct = Math.floor(semis / 12), rest = INTERVALS[semis % 12];
      if (!oct) return rest || 'one note';
      const o = oct === 1 ? '1 octave' : oct + ' octaves';
      return rest ? o + ' + ' + rest : o;
    },

    voiceType(low, high) {
      let best = VOICES[0], bestCost = Infinity;
      VOICES.forEach((v) => {
        const cost = Math.abs(v[1] - low) + Math.abs(v[2] - high);
        if (cost < bestCost) { best = v; bestCost = cost; }
      });
      return best[0];
    },

    /** Typical voice types as [name, low, high] MIDI notes. */
    VOICES: VOICES,

    MAJOR: [0, 2, 4, 5, 7, 9, 11, 12]
  };
})(window.V = window.V || {});
