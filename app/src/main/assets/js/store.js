// Persistent settings, kept in localStorage under "vocalishz". Every write is validated.
(function (V) {
  const KEY = 'vocalishz';
  const CHOICES = {
    mode: ['chromatic', 'guitar', 'dropd', 'dadgad', 'bass', 'bass5', 'ukulele'],
    tunerView: ['dial', 'bar'],
    names: ['letters', 'solfege', 'both'],
    hold: [0.3, 0.6, 1],
    noteTime: [0, 5, 8, 12],   // seconds to hit each warm-up note before the rep starts over; 0 is off
    screenOn: ['tuner', 'always'],
    theme: ['system', 'light', 'dark'],
    challengeLevel: ['echo', 'scale', 'down', 'thirds', 'arpeggio', 'leaps', 'minor', 'intervals']
  };
  const DEFAULTS = {
    mode: 'chromatic', a4: 440, tunerView: 'dial', names: 'both', hold: 0.6, tolerance: 25, noteTime: 8, screenOn: 'tuner', theme: 'system', challengeLevel: 'scale', bests: {}, rangeHistory: [],
    range: null,          // { low, high, tested: 'YYYY-MM-DD' }
    challengeRoot: null   // MIDI tonic of the challenge scale; null picks one from the range
  };

  function valid(key, v) {
    if (CHOICES[key]) return CHOICES[key].indexOf(v) >= 0;
    switch (key) {
      case 'tolerance': return Number.isInteger(v) && v >= 5 && v <= 50 && v % 5 === 0;   // cents either side, set by a slider
      case 'a4': return Number.isInteger(v) && v >= 415 && v <= 466;
      case 'range': return v === null || (v && Number.isInteger(v.low) && Number.isInteger(v.high) &&
        v.low >= 24 && v.high <= 96 && v.low < v.high);
      case 'bests': return !!v && typeof v === 'object' && !Array.isArray(v) &&
        Object.keys(v).every((k) => CHOICES.challengeLevel.indexOf(k) >= 0 && Number.isFinite(v[k]) && v[k] > 0);
      case 'rangeHistory': return Array.isArray(v) && v.length <= 10 && v.every((r) => valid('range', r) && r !== null);
      case 'challengeRoot': return v === null || (Number.isInteger(v) && v >= 36 && v <= 72);
      default: return false;
    }
  }

  const state = Object.assign({}, DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    Object.keys(DEFAULTS).forEach((k) => { if (k in saved && valid(k, saved[k])) state[k] = saved[k]; });
  } catch (e) { /* keep defaults */ }

  const listeners = [];

  V.store = {
    CHOICES,
    get: (key) => state[key],
    set(key, value) {
      if (!valid(key, value) || state[key] === value) return;
      state[key] = value;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* not persisted */ }
      listeners.forEach((fn) => fn(key, value));
    },
    /** Calls fn(key, value) after every change. */
    onChange(fn) { listeners.push(fn); }
  };
})(window.V = window.V || {});
