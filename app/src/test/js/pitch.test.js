const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');

function setup() {
  let t = 1000;
  const env = load(['notes.js', 'store.js', 'pitch.js'], { now: () => t });
  return { P: env.V.pitch, tick: (ms) => { t += ms; } };
}

test('Tracker ignores unclear frames and takes the median of recent clear ones', () => {
  const { P, tick } = setup();
  const tr = new P.Tracker();
  assert.strictEqual(tr.update(440, 0.5), null);
  assert.strictEqual(tr.update(0, 1), null);
  [440, 441, 900, 439, 440].forEach((hz) => { tick(23); tr.update(hz, 0.95); });
  const r = tr.update(440, 0.95);
  assert.strictEqual(r.hz, 440);     // the 900 Hz outlier is voted out
  assert.ok(Math.abs(r.midi - 69) < 1e-9);
});

test('Tracker starts fresh after a gap', () => {
  const { P, tick } = setup();
  const tr = new P.Tracker();
  [220, 220, 220].forEach(() => { tick(23); tr.update(220, 0.95); });
  tick(400); tr.update(0, 0);        // silence longer than the gap clears the history
  tick(23);
  assert.strictEqual(tr.update(440, 0.95).hz, 440);
});

test('Holder passes after the hold time in tune', () => {
  const { P, tick } = setup();
  const h = new P.Holder();
  let r = h.update(69.1, 69, 25, 0.6);   // first frame starts the clock
  for (let i = 0; i < 6; i++) { tick(100); r = h.update(69.1, 69, 25, 0.6); }
  assert.ok(r.inTune);
  assert.ok(Math.abs(r.cents - 10) < 1e-9);
  assert.ok(r.passed);
  assert.strictEqual(r.progress, 1);
});

test('Holder drains twice as fast off target and clamps stalls', () => {
  const { P, tick } = setup();
  const h = new P.Holder();
  h.update(69, 69, 25, 1);
  for (let i = 0; i < 4; i++) { tick(100); h.update(69, 69, 25, 1); }   // 400 ms held
  tick(100); let r = h.update(69.5, 69, 25, 1);                          // 50 cents off: -200 ms
  assert.ok(!r.inTune);
  assert.ok(Math.abs(r.progress - 0.2) < 1e-9);
  tick(5000); r = h.update(69, 69, 25, 1);                               // a stall counts as 100 ms at most
  assert.ok(Math.abs(r.progress - 0.3) < 1e-9);
  tick(100); r = h.update(null, 69, 25, 1);
  assert.strictEqual(r.cents, null);
  assert.ok(Math.abs(r.progress - 0.1) < 1e-9);
});
