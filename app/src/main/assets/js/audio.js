// Bridge to the native side: microphone, pitch events and reference tones.
// Native calls window.onPitch(hz, clarity, level) and window.onMicState(state).
(function (V) {
  const NATIVE = !!window.Android;
  const pitchListeners = new Set();
  const micListeners = new Set();
  let micOn = false;
  let muteUntil = 0;
  let micState = NATIVE ? 'off' : 'unavailable';

  window.onPitch = function (hz, clarity) {
    // Our own reference tones would be picked up by the mic, so report silence while they play.
    if (Date.now() < muteUntil) hz = 0;
    pitchListeners.forEach((fn) => fn(hz, clarity));
  };

  window.onMicState = function (state) {
    micState = state;
    // A denial, or a mic that is busy or failed, leaves it off, so the next setMic(true) asks again.
    if (state === 'denied' || state === 'unavailable') micOn = false;
    micListeners.forEach((fn) => fn(state));
  };

  V.audio = {
    native: NATIVE,
    micState: () => micState,

    setMic(on) {
      if (on === micOn) return;
      micOn = on;
      if (NATIVE) { if (on) Android.startMic(); else Android.stopMic(); }
    },

    /** Subscribes to pitch frames (about 43 a second). Returns an unsubscribe function. */
    onPitch(fn) { pitchListeners.add(fn); return () => pitchListeners.delete(fn); },
    onMicState(fn) { micListeners.add(fn); return () => micListeners.delete(fn); },

    playNote(midi, seconds) {
      muteUntil = Math.max(muteUntil, Date.now() + seconds * 1000 + 200);
      if (NATIVE) Android.playTone(V.notes.midiToHz(midi, V.store.get('a4')), seconds);
    },

    /**
     * Plays notes one after another, calling onNote(index) as each starts and onDone() at the end.
     * Returns a function that cancels whatever has not played yet.
     */
    playSequence(midis, stepMs, onNote, onDone) {
      const timers = midis.map((m, i) => setTimeout(() => {
        V.audio.playNote(m, stepMs / 1000 * 0.95);
        if (onNote) onNote(i);
      }, i * stepMs));
      timers.push(setTimeout(() => { if (onDone) onDone(); }, midis.length * stepMs + 250));
      return () => timers.forEach(clearTimeout);
    }
  };
})(window.V = window.V || {});
