// Pitch chart shared by the warm-up session and the challenge: your voice as a line scrolling
// left, against the note you need. Pitch runs bottom to top with a line per semitone.
(function (V) {
  const WINDOW_MS = 4000;   // history shown left of "now"
  const NOW_X = 0.96;       // "now" as a share of the plot width, with a little room for the dot
  const LABEL_W = 34;       // px kept for note names on the left
  const FLASH_MS = 500;
  const HOP_MS = 450;
  const BLACK = [1, 3, 6, 8, 10];

  /**
   * `host` holds a <canvas>. `tolerance()` gives the current tolerance in cents, which sets the
   * target band's height. With `opts.rungs`, only the rung notes are labelled (via `opts.label`)
   * and a ball rests on the target, hopping to the next one on each hit.
   */
  function pitchChart(host, tolerance, opts) {
    opts = opts || {};
    const canvas = host.querySelector('canvas'), ctx = canvas.getContext('2d');
    let samples = [], hits = [], flash = null, drop = null;
    let target = null, rungs = null, lo = 48, hi = 60, held = 0, raf = 0, colors = {};

    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const label = (m) => opts.label ? opts.label(m) : V.notes.name(m);

    function size() {
      const dpr = window.devicePixelRatio || 1, r = host.getBoundingClientRect();
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [r.width, r.height];
    }

    function draw() {
      raf = requestAnimationFrame(draw);
      const [w, h] = size(), now = Date.now(), nowX = LABEL_W + (w - LABEL_W) * NOW_X;
      if (!w || !h) return;
      const y = (m) => h - ((m - lo) / (hi - lo)) * h;
      const x = (t) => nowX - ((now - t) / WINDOW_MS) * (nowX - LABEL_W);
      const rowH = h / (hi - lo);
      const band = Math.max(8, (tolerance() / 100) * 2 * rowH);
      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      ctx.font = '600 11px system-ui, sans-serif';

      // grid: a line per semitone, stronger on C; names on every note when there is room, else naturals
      for (let m = Math.ceil(lo); m <= hi; m++) {
        ctx.fillStyle = colors.line;
        ctx.fillRect(LABEL_W, Math.round(y(m)), w - LABEL_W, m % 12 === 0 ? 2 : 1);
        const natural = BLACK.indexOf(((m % 12) + 12) % 12) < 0;
        if (!rungs && m !== target && rowH >= 7 && (rowH >= 15 || natural) && y(m) > 8 && y(m) < h - 8) {
          ctx.fillStyle = colors.muted; ctx.fillText(V.notes.name(m), 6, y(m));
        }
      }
      ctx.fillStyle = colors.line; ctx.fillRect(nowX, 0, 1, h);

      // rungs: done ones green, the rest faint, the current one drawn as the target below
      if (rungs) {
        rungs.forEach((r) => {
          if (r.midi === target) return;
          const done = r.state === 'done';
          ctx.fillStyle = done ? colors.good : colors.muted;
          ctx.globalAlpha = done ? 0.9 : 0.45;
          ctx.fillRect(LABEL_W, y(r.midi) - 1.5, w - LABEL_W, 3);
          ctx.globalAlpha = 1;
          ctx.font = (done ? '700' : '600') + ' 11px system-ui, sans-serif';
          ctx.fillText(label(r.midi), 4, y(r.midi));
        });
      }

      if (target !== null) {
        const ty = y(target), top = ty - band / 2;
        ctx.fillStyle = colors.accSoft; ctx.fillRect(LABEL_W, top, nowX - LABEL_W, band);
        ctx.fillStyle = colors.goodSoft; ctx.fillRect(LABEL_W, top, (nowX - LABEL_W) * held, band);
        ctx.fillStyle = colors.acc; ctx.fillRect(LABEL_W, ty - 1, rungs ? w - LABEL_W : nowX - LABEL_W, 2);
        ctx.font = '800 13px system-ui, sans-serif'; ctx.fillText(label(target), 4, ty);
      }

      // hit: the band flashes and a ring pulses out from "now"
      if (flash && now - flash.t < FLASH_MS) {
        const f = 1 - (now - flash.t) / FLASH_MS, fy = y(flash.midi);
        ctx.globalAlpha = f; ctx.fillStyle = colors.good;
        ctx.fillRect(LABEL_W, fy - band / 2 - 4 * (1 - f), nowX - LABEL_W, band + 8 * (1 - f));
        ctx.strokeStyle = colors.good; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(nowX, fy, 10 + 40 * (1 - f), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // the ball sits on the target in the strip right of "now" and hops to the next one on a hit
      if (rungs && (target !== null || drop)) {
        const bx = nowX + (w - nowX) / 2, r = Math.min(11, (w - nowX) / 2 - 3);
        let by = target !== null ? y(target) : y(drop.from);
        if (drop && now - drop.t < HOP_MS) {
          const p = (now - drop.t) / HOP_MS;
          by = y(drop.from) + (by - y(drop.from)) * p - Math.sin(Math.PI * p) * 24;   // a small arc
        }
        ctx.fillStyle = colors.acc; ctx.beginPath(); ctx.arc(bx, by - r - 1, r, 0, Math.PI * 2); ctx.fill();
      }

      // your voice, coloured by how close each stretch was
      samples = samples.filter((s) => now - s.t < WINDOW_MS + 200);
      ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        if (a.midi == null || b.midi == null) continue;
        ctx.strokeStyle = colors[b.state] || colors.muted;
        ctx.beginPath(); ctx.moveTo(x(a.t), y(a.midi)); ctx.lineTo(x(b.t), y(b.midi)); ctx.stroke();
      }
      hits = hits.filter((t) => now - t.t < WINDOW_MS);
      ctx.fillStyle = colors.good;
      hits.forEach((t) => { ctx.beginPath(); ctx.arc(x(t.t), y(t.midi), 6, 0, Math.PI * 2); ctx.fill(); });
      const last = samples[samples.length - 1];
      if (last && last.midi != null && now - last.t < 300) {
        ctx.fillStyle = colors[last.state] || colors.muted;
        ctx.beginPath(); ctx.arc(nowX, Math.max(8, Math.min(h - 8, y(last.midi))), 8, 0, Math.PI * 2); ctx.fill();
      }
    }

    /** Solid colour with an alpha, for canvases that do not take color-mix(). */
    const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

    return {
      start() {
        colors = { line: css('--line'), muted: css('--muted'), acc: css('--acc'), good: css('--good'), warn: css('--warn'), bad: css('--bad') };
        colors.accSoft = alpha(colors.acc, 0.16);
        colors.goodSoft = alpha(colors.good, 0.4);
        samples = []; hits = []; flash = null; drop = null; held = 0;
        if (!raf) draw();
      },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      /** The note to hit (or null) and the notes that set the visible span. */
      setTarget(m, notes) {
        target = m;
        const a = Math.min(...notes) - 3, b = Math.max(...notes) + 3;
        const span = Math.max(10, b - a), mid = (a + b) / 2;
        lo = mid - span / 2; hi = mid + span / 2;
      },
      /** [{ midi, state: 'done' | '' }] for ladder-style screens; null for none. */
      setRungs(list) { rungs = list; },
      push(midi, state) { samples.push({ t: Date.now(), midi: midi, state: state }); },
      progress(p) { held = Math.max(0, Math.min(1, p)); },
      hit(midi) {
        const t = Date.now();
        flash = { t: t, midi: midi }; hits.push({ t: t, midi: midi }); held = 0;
        if (rungs) drop = { t: t, from: midi };
      },
      clear() { samples = []; hits = []; held = 0; }
    };
  }

  V.ui.pitchChart = pitchChart;
})(window.V = window.V || {});
