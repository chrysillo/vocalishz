const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');

const { V } = load(['notes.js', 'courses.js']);
const C = V.courses;

test('fixed levels build the same course in any key', () => {
  assert.deepStrictEqual([...C.course('scale', 48)], [48, 50, 52, 53, 55, 57, 59, 60]);
  assert.deepStrictEqual([...C.course('minor', 57)], [57, 59, 60, 62, 64, 65, 67, 69]);
  assert.deepStrictEqual([...C.course('down', 48)].reverse(), [...C.course('scale', 48)]);
});

test('random levels stay in the key, inside one octave, with no note twice in a row', () => {
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  ['echo', 'intervals'].forEach((id) => {
    for (let run = 0; run < 50; run++) {
      const notes = C.course(id, 50, rand);
      assert.strictEqual(notes.length, 8);
      notes.forEach((m, i) => {
        assert.ok(V.notes.MAJOR.indexOf(m - 50) >= 0, id + ' note outside the major scale: ' + m);
        if (i) assert.notStrictEqual(m, notes[i - 1]);
      });
    }
  });
});

test('every level has a course and a name', () => {
  C.ids.forEach((id) => {
    assert.ok(C.LEVELS[id].name);
    assert.ok(C.course(id, 48).length >= 7);
  });
});

test('degrees colour Do to high Do, with chromatic notes on the degree below', () => {
  assert.deepStrictEqual([...C.course('scale', 48)].map((m) => C.degree(m, 48)), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(C.degree(51, 48), 2);   // minor 3rd shares Mi's colour
  assert.strictEqual(C.degree(36, 48), 0);   // an octave below Do is still Do
});

test('minor-key solfège uses Me, Le and Te', () => {
  assert.deepStrictEqual([63, 68, 70].map((m) => V.notes.solfege(m, 60)), ['Me', 'Le', 'Te']);
});
