// Small DOM helpers shared by the screens.
(function (V) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    setAttrs(node, attrs);
    (children || []).forEach((c) => node.append(c));
    return node;
  }

  function svg(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    setAttrs(node, attrs);
    (children || []).forEach((c) => node.append(c));
    return node;
  }

  function setAttrs(node, attrs) {
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
  }

  function icon(name, cls) {
    return svg('svg', { class: 'icon' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' },
      [svg('use', { href: '#i-' + name })]);
  }

  /**
   * Circular progress ring with an optional marker dot. The marker sits at 12 o'clock when
   * `cents` is 0 and swings up to 60° either way at ±50 cents.
   */
  function ring(host) {
    const R = 110, C = 2 * Math.PI * R;
    const track = svg('circle', { class: 'ring-track', cx: 130, cy: 130, r: R });
    const bar = svg('circle', {
      class: 'ring-bar', cx: 130, cy: 130, r: R,
      'stroke-dasharray': C, 'stroke-dashoffset': C, transform: 'rotate(-90 130 130)'
    });
    const dot = svg('circle', { class: 'ring-dot', cx: 130, cy: 130 - R, r: 9 });
    host.prepend(svg('svg', { class: 'ring', viewBox: '0 0 260 260', 'aria-hidden': 'true' }, [track, bar, dot]));
    return {
      progress(p) { bar.setAttribute('stroke-dashoffset', C * (1 - Math.max(0, Math.min(1, p)))); },
      state(s) { host.dataset.state = s || ''; },
      marker(cents) {
        if (cents == null) { dot.style.opacity = 0; return; }
        dot.style.opacity = 1;
        dot.style.transform = 'rotate(' + Math.max(-60, Math.min(60, cents * 1.2)) + 'deg)';
      }
    };
  }

  /** Colour state for a pitch error, shared by every screen. */
  function tuneState(cents, tolerance) {
    const a = Math.abs(cents);
    return a <= tolerance ? 'good' : a <= tolerance * 2 + 10 ? 'warn' : 'bad';
  }

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  const today = () => new Date().toISOString().slice(0, 10);

  V.ui = { $: (id) => document.getElementById(id), el, svg, icon, ring, tuneState, formatTime, today };
})(window.V = window.V || {});
