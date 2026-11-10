// Loads the page's plain scripts into a sandbox with just enough of a browser for pure code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '../../main/assets/js');

function load(files, { saved = null, now = () => 0 } = {}) {
  const store = new Map(saved == null ? [] : [['vocalishz', saved]]);
  const window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v))
    }
  };
  const ctx = vm.createContext({ window, localStorage: window.localStorage, Date: { now } });
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f }));
  return { V: window.V, saved: () => store.get('vocalishz') };
}

module.exports = { load };
