// Challenge levels and the note course each one builds. Pure functions, no DOM.
// Levels run in the usual pitch-training order: match a heard note, steps, thirds, leaps, then
// the minor scale and random intervals.
(function (V) {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
  const COURSE_LENGTH = 8;   // walls in a random course

  // pattern: semitones above Do, the same every run. random: a scale to draw notes from.
  // echo: each note is played as its wall arrives, so you sing it back by ear.
  const LEVELS = {
    echo: { name: 'Echo', random: MAJOR, echo: true },
    scale: { name: 'Up the scale', pattern: [0, 2, 4, 5, 7, 9, 11, 12] },
    down: { name: 'Down the scale', pattern: [12, 11, 9, 7, 5, 4, 2, 0] },
    thirds: { name: 'Scale in thirds', pattern: [0, 4, 2, 5, 4, 7, 5, 9, 7, 11, 9, 12] },
    arpeggio: { name: 'Arpeggio', pattern: [0, 4, 7, 12, 7, 4, 0] },
    leaps: { name: 'Fifths & octaves', pattern: [0, 7, 0, 12, 7, 12, 0] },
    minor: { name: 'Minor scale', pattern: MINOR },
    intervals: { name: 'Random intervals', random: MAJOR }
  };

  /**
   * The notes (MIDI) of a level in the key whose Do is `root`. Random levels never repeat a note
   * back to back; `rand` returns 0 ≤ x < 1 and defaults to Math.random.
   */
  function course(id, root, rand) {
    const level = LEVELS[id];
    if (level.pattern) return level.pattern.map((d) => root + d);
    rand = rand || Math.random;
    const out = [];
    while (out.length < COURSE_LENGTH) {
      const m = root + level.random[Math.floor(rand() * level.random.length)];
      if (m !== out[out.length - 1]) out.push(m);
    }
    return out;
  }

  /** Scale degree 0–7 of a note (7 is high Do), for colouring; chromatic notes take the one below. */
  function degree(m, root) {
    const off = m - root, pc = ((off % 12) + 12) % 12;
    if (off >= 12 && pc === 0) return 7;
    return [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][pc];
  }

  V.courses = { LEVELS, course, degree, ids: Object.keys(LEVELS) };
})(window.V = window.V || {});
