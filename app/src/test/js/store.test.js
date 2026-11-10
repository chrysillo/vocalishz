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
