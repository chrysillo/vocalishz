const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');

function setup() {
  let t = 1000;
  const calls = [];
  const android = {
    startMic: () => calls.push('start'),
    stopMic: () => calls.push('stop'),
    playTone: () => calls.push('tone')
  };
  const env = load(['notes.js', 'store.js', 'audio.js'], { now: () => t, android });
  return { V: env.V, window: env.window, calls, tick: (ms) => { t += ms; } };
}

test('setMic only calls the bridge when the wanted state changes', () => {
  const { V, calls } = setup();
  V.audio.setMic(true); V.audio.setMic(true); V.audio.setMic(false);
  assert.deepStrictEqual(calls, ['start', 'stop']);
});

for (const state of ['denied', 'unavailable']) {
  test(`after '${state}' the next setMic(true) asks for the mic again`, () => {
    const { V, window, calls } = setup();
    const seen = [];
    V.audio.onMicState((s) => seen.push(s));
    V.audio.setMic(true);
    window.onMicState(state);
    V.audio.setMic(true);
    assert.deepStrictEqual(calls, ['start', 'start']);
    assert.deepStrictEqual(seen, [state]);
    assert.strictEqual(V.audio.micState(), state);
  });
}

test('pitch frames read as silence while a reference tone plays', () => {
  const { V, window, tick } = setup();
  const got = [];
  V.audio.onPitch((hz) => got.push(hz));
  V.audio.playNote(69, 1);
  window.onPitch(440, 0.9);
  tick(1300);
  window.onPitch(440, 0.9);
  assert.deepStrictEqual(got, [0, 440]);
});
