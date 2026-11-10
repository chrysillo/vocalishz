const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');

test('defaults when nothing is saved or the save is corrupt', () => {
  assert.strictEqual(load(['store.js']).V.store.get('a4'), 440);
  assert.strictEqual(load(['store.js'], { saved: '{not json' }).V.store.get('mode'), 'chromatic');
});

test('invalid saved values are dropped, valid ones kept', () => {
  const saved = JSON.stringify({ a4: 999, mode: 'bass', range: { low: 50, high: 40 }, extra: 1 });
  const { V } = load(['store.js'], { saved });
  assert.strictEqual(V.store.get('a4'), 440);
  assert.strictEqual(V.store.get('mode'), 'bass');
  assert.strictEqual(V.store.get('range'), null);
});

test('set validates, persists and notifies', () => {
  const env = load(['store.js']);
  const seen = [];
  env.V.store.onChange((k, v) => seen.push([k, v]));
  env.V.store.set('a4', 432.5);
  env.V.store.set('hold', 2);
  env.V.store.set('a4', 432);
  assert.strictEqual(env.V.store.get('a4'), 432);
  assert.strictEqual(env.V.store.get('hold'), 0.6);
  assert.deepStrictEqual(seen, [['a4', 432]]);
  assert.strictEqual(JSON.parse(env.saved()).a4, 432);
});

test('range history keeps at most ten valid tests', () => {
  const { V } = load(['store.js']);
  const r = { low: 43, high: 67, tested: '2026-11-10' };
  V.store.set('rangeHistory', [r, r]);
  assert.strictEqual(V.store.get('rangeHistory').length, 2);
  V.store.set('rangeHistory', Array(11).fill(r));
  assert.strictEqual(V.store.get('rangeHistory').length, 2);
  V.store.set('rangeHistory', [{ low: 60, high: 50 }]);
  assert.strictEqual(V.store.get('rangeHistory').length, 2);
});

test('best times only for known levels', () => {
  const { V } = load(['store.js']);
  V.store.set('bests', { echo: 12000, minor: 30000 });
  assert.deepStrictEqual({ ...V.store.get('bests') }, { echo: 12000, minor: 30000 });
  V.store.set('bests', { nope: 1 });
  assert.deepStrictEqual({ ...V.store.get('bests') }, { echo: 12000, minor: 30000 });
});
