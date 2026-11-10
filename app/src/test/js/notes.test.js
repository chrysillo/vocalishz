const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');

const { V } = load(['notes.js']);
const N = V.notes;

test('hz and midi round-trip at A4 = 440', () => {
  assert.strictEqual(N.hzToMidi(440, 440), 69);
  assert.ok(Math.abs(N.hzToMidi(41.2034, 440) - 28) < 0.001);   // bass low E
  assert.ok(Math.abs(N.midiToHz(60, 440) - 261.6256) < 0.001);  // middle C
  assert.ok(Math.abs(N.hzToMidi(N.midiToHz(57.3, 432), 432) - 57.3) < 1e-9);
});

test('names and octaves', () => {
  assert.strictEqual(N.name(60), 'C4');
  assert.strictEqual(N.name(28), 'E1');
  assert.strictEqual(N.name(70), 'A♯4');
  assert.strictEqual(N.letter(-1), 'B');
});

test('movable-do solfège follows the root', () => {
  assert.strictEqual(N.solfege(67, 60), 'Sol');
  assert.strictEqual(N.solfege(62, 62), 'Do');
  assert.strictEqual(N.solfege(61, 62), 'Ti');
});

test('label follows the note-names setting', () => {
  assert.deepStrictEqual({ ...N.label(64, 60, 'solfege') }, { main: 'Mi', aside: 'E4' });
  assert.deepStrictEqual({ ...N.label(64, 60, 'letters') }, { main: 'E4', aside: '' });
  assert.deepStrictEqual({ ...N.label(64, 60, 'both') }, { main: 'E4', aside: 'Mi' });
});

test('span describes the range', () => {
  assert.strictEqual(N.span(60, 60), 'one note');
  assert.strictEqual(N.span(60, 67), 'a 5th');
  assert.strictEqual(N.span(60, 72), '1 octave');
  assert.strictEqual(N.span(48, 74), '2 octaves + a 2nd');
});

test('voice type picks the closest typical range', () => {
  assert.strictEqual(N.voiceType(40, 64), 'Bass');
  assert.strictEqual(N.voiceType(48, 72), 'Tenor');
  assert.strictEqual(N.voiceType(61, 86), 'Soprano');
});
