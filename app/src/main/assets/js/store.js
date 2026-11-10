// Persistent settings, kept in localStorage under "vocalishz". Every write is validated.
(function (V) {
  const KEY = 'vocalishz';
  const CHOICES = {
    mode: ['chromatic', 'guitar', 'bass', 'ukulele'],
    tunerView: ['dial', 'bar'],
    names: ['letters', 'solfege', 'both'],
    hold: [0.3, 0.6, 1],
    tolerance: [50, 25, 10]
  };
  const DEFAULTS = {
    mode: 'chromatic', a4: 440, tunerView: 'dial', names: 'both', hold: 0.6, tolerance: 25,
    range: null,          // { low, high, tested: 'YYYY-MM-DD' }
    challengeRoot: null   // MIDI tonic of the challenge scale; null picks one from the range
  };

  function valid(key, v) {
    if (CHOICES[key]) return CHOICES[key].indexOf(v) >= 0;
    switch (key) {
      case 'a4': return Number.isInteger(v) && v >= 415 && v <= 466;
      case 'range': return v === null || (v && Number.isInteger(v.low) && Number.isInteger(v.high) &&
        v.low >= 24 && v.high <= 96 && v.low < v.high);
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
