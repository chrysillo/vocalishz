// Screen router, shared bindings and start-up. Loaded before the screen scripts.
//
// A screen is <section class="screen" id="s-NAME"> plus an object registered with
// V.app.register(NAME, { enter(params), leave(), wantsMic() }), all optional.
// Tabs replace the history; other screens are pushed on top and closed with back().
(function (V) {
  const { $ } = V.ui;
  const TABS = ['tuner', 'warmups', 'challenge'];
  const screens = {};
  let stack = [];
  let current = null;

  function enter(name, params) {
    if (current) {
      const prev = screens[current];
      if (prev.leave) prev.leave();
      $('s-' + current).classList.remove('on');
    }
    current = name;
    const node = $('s-' + name);
    node.classList.add('on');
    node.scrollTop = 0;
    document.body.classList.toggle('overlay', TABS.indexOf(name) < 0);
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === stack[0]));
    if (screens[name].enter) screens[name].enter(params || {});
    V.app.refreshMic();
  }

  V.app = {
    register(name, screen) { screens[name] = screen; },
    current: () => current,
    tab(name) { stack = [name]; enter(name); },
    push(name, params) { stack.push(name); enter(name, params); },
    /** Returns false when there is nowhere to go back to, so the app can close. */
    back() {
      if (stack.length > 1) { stack.pop(); enter(stack[stack.length - 1]); return true; }
      if (stack[0] !== 'tuner') { V.app.tab('tuner'); return true; }
      return false;
    },
    refreshMic() {
      const s = screens[current];
      V.audio.setMic(!!(s && s.wantsMic && s.wantsMic()));
    }
  };

  // ---- navigation ----
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab], [data-go], [data-back]');
    if (!t) return;
    if (t.dataset.tab) V.app.tab(t.dataset.tab);
    else if (t.dataset.go) V.app.push(t.dataset.go);
    else V.app.back();
  });

  // ---- segmented controls bound to a setting: <div class="seg" data-setting="KEY"><button data-value> ----
  function renderSegs() {
    document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      const value = String(V.store.get(seg.dataset.setting));
      seg.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.value === value;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      });
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-setting] button');
    if (!b) return;
    const key = b.closest('.seg').dataset.setting;
    const choice = V.store.CHOICES[key].find((c) => String(c) === b.dataset.value);
    V.store.set(key, choice);
  });
  V.store.onChange(renderSegs);

  // ---- microphone notice ----
  V.audio.onMicState((state) => {
    $('mic-msg').hidden = state !== 'denied';
  });

  // Screens register themselves in the scripts after this one; start once they all have.
  document.addEventListener('DOMContentLoaded', () => {
    renderSegs();
    if (!V.audio.native) {
      $('mic-msg').textContent = 'Open in the Android app to use the microphone.';
      $('mic-msg').hidden = false;
    }
    V.app.tab('tuner');
  });
})(window.V = window.V || {});
