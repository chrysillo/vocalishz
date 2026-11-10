// Turns raw pitch frames into a steady reading, and decides when a target note has been held.
(function (V) {
  const MIN_CLARITY = 0.85;
  const GAP_MS = 300;   // a gap this long starts a fresh reading
  const MAX_DT = 100;   // clamp frame gaps so a stall doesn't count as holding

  function median(a) {
    const b = a.slice().sort((x, y) => x - y);
    return b[b.length >> 1];
  }

  /** Median-of-5 over clear frames. update() returns { hz, midi } or null while unclear or silent. */
  class Tracker {
    constructor() { this.reset(); }
    reset() { this.recent = []; this.lastSeen = 0; }
    update(hz, clarity) {
      const now = Date.now();
      if (!hz || clarity < MIN_CLARITY) {
        if (now - this.lastSeen > GAP_MS) this.recent = [];
        return null;
      }
      this.lastSeen = now;
      this.recent.push(hz);
      if (this.recent.length > 5) this.recent.shift();
      const f = median(this.recent);
      return { hz: f, midi: V.notes.hzToMidi(f, V.store.get('a4')) };
    }
  }

  /**
   * Accumulates time spent within `tolerance` cents of a target. Time drains twice as fast as it
   * fills when off target, so a brief wobble costs a little rather than everything.
   */
  class Holder {
    constructor() { this.reset(); }
    reset() { this.ms = 0; this.last = 0; }
    update(midi, target, tolerance, holdSeconds) {
      const now = Date.now();
      const dt = this.last ? Math.min(MAX_DT, now - this.last) : 0;
      this.last = now;
      const cents = midi == null ? null : (midi - target) * 100;
      const inTune = cents !== null && Math.abs(cents) <= tolerance;
      this.ms = inTune ? this.ms + dt : Math.max(0, this.ms - 2 * dt);
      const need = holdSeconds * 1000;
      return { cents, inTune, progress: Math.min(1, this.ms / need), passed: this.ms >= need };
    }
  }

  V.pitch = { Tracker, Holder };
})(window.V = window.V || {});
