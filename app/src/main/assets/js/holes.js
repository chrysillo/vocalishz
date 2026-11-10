// Thread the Needle: a ball that follows your pitch, and a wall per scale note with a hole at
// that note. The wall slides in and waits in front of the ball; hold the ball in the hole until
// it fills, the ball shoots through, the wall bursts and the next one slides in.
(function (V) {
  const BALL_X = 0.28;       // ball position as a share of the width
  const WALL_W = 28;
  const SLIDE_MS = 700;      // a new wall sliding in from the right
  const PASS_MS = 450;       // ball shooting through
  const BURST_MS = 900;
  const BALL_R = 14;
  // One hue per scale degree, Do to high Do, so a note keeps its colour wherever it comes up. No greens: green is
  // the ball's "in tune" colour.
  const HUES = [350, 22, 45, 180, 205, 232, 268, 310];

  function holeGame(host, tolerance, label) {
    const canvas = host.querySelector('canvas'), ctx = canvas.getContext('2d');
    let notes = [], root = 48, step = 0, lo = 48, hi = 60, held = 0, raf = 0, colors = {}, dark = false;
    let ballY = null, ballState = '', lastSeen = 0;
    let slideAt = 0, pass = null, trail = [], bits = [], stars = [];

    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    /** Scale degree 0–7 of a note in the current key; high Do is 7 so it gets its own colour. */
    const degree = (m) => V.courses.degree(m, root);
    const hue = (m, l, a) => 'hsla(' + HUES[degree(m)] + ', 85%, ' + (l == null ? (dark ? 62 : 52) : l) + '%, ' + (a == null ? 1 : a) + ')';

    function size() {
      const dpr = window.devicePixelRatio || 1, r = host.getBoundingClientRect();
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; makeStars(r.width, r.height); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [r.width, r.height];
    }
    function makeStars(w, h) {
      stars = [];
      for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 });
    }

    function pill(x, y, w, h, r) {
      if (h <= 0) return;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); ctx.fill();
    }

    /** A wall in note m's colour with a hole at gy; `fill` shows how long you've held. */
    function wall(i, x, gy, gap, h, fill, a) {
      i = notes[i];
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(x - WALL_W / 2, 0, x + WALL_W / 2, 0);
      g.addColorStop(0, hue(i, dark ? 50 : 58)); g.addColorStop(0.5, hue(i, dark ? 62 : 66)); g.addColorStop(1, hue(i, dark ? 45 : 48));
      ctx.fillStyle = g;
      pill(x - WALL_W / 2, -20, WALL_W, gy - gap / 2 + 20, 12);
      pill(x - WALL_W / 2, gy + gap / 2, WALL_W, h - gy - gap / 2 + 20, 12);
      // the hole's rim, and its fill rising as you hold
      ctx.strokeStyle = hue(i, null, 0.9); ctx.lineWidth = 3; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.roundRect(x - WALL_W / 2 - 4, gy - gap / 2 + 2, WALL_W + 8, gap - 4, 10); ctx.stroke();
      ctx.setLineDash([]);
      if (fill > 0) {
        ctx.fillStyle = hue(i, null, 0.55);
        pill(x - WALL_W / 2, gy + gap / 2 - (gap - 4) * fill - 2, WALL_W, (gap - 4) * fill, 8);
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      raf = requestAnimationFrame(draw);
      const [w, h] = size(), now = Date.now();
      if (!w || !h) return;
      const y = (m) => h - ((m - lo) / (hi - lo)) * h;
      const rowH = h / (hi - lo);
      const gap = Math.max(BALL_R * 2 + 12, (tolerance() / 100) * 2 * rowH + BALL_R * 2);
      const bx = w * BALL_X, restX = bx + BALL_R + WALL_W / 2 + 12;

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (dark) { sky.addColorStop(0, '#1b1440'); sky.addColorStop(1, '#3a1d3a'); }
      else { sky.addColorStop(0, '#cfe8ff'); sky.addColorStop(1, '#ffe2cc'); }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      stars.forEach((s) => {
        ctx.globalAlpha = (dark ? 0.6 : 0.5) + 0.4 * Math.sin(now / 600 + s.p);
        ctx.fillStyle = dark ? '#ffffff' : '#ffffff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (dark ? 1 : 1.6), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // a lane per note in the course, in its colour, labelled on the right
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      const now_ = notes[step];
      [...new Set(notes)].forEach((m) => {
        const on = m === now_;
        ctx.fillStyle = hue(m, null, on ? 0.5 : 0.22);
        ctx.fillRect(0, Math.round(y(m)) - (on ? 1 : 0), w, on ? 3 : 2);
        ctx.font = (on ? '800 14px' : '700 11px') + ' system-ui, sans-serif';
        ctx.fillStyle = hue(m, dark ? 72 : 38, on ? 1 : 0.75);
        ctx.fillText(label(m), w - 8, y(m) - 10);
      });
      ctx.textAlign = 'left';

      // the current wall slides in and waits; a faded one behind shows where the next hole is
      if (step < notes.length) {
        const p = Math.min(1, (now - slideAt) / SLIDE_MS), ease = 1 - Math.pow(1 - p, 3);
        const x = w + WALL_W - (w + WALL_W - restX) * ease;
        if (step + 1 < notes.length) wall(step + 1, Math.min(w + WALL_W, x + w * 0.42), y(notes[step + 1]), gap, h, 0, 0.35);
        wall(step, x, y(notes[step]), gap, h, held, 1);
      }

      // burst: coloured confetti from the wall that just broke
      bits = bits.filter((b) => now - b.t < BURST_MS);
      bits.forEach((b) => {
        const k = (now - b.t) / BURST_MS;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate(b.x + b.vx * k * 140, b.y + b.vy * k * 140 + 160 * k * k);
        ctx.rotate(b.spin * k * 6);
        ctx.fillStyle = b.color; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });

      // trail and ball; during a pass the ball dashes through the hole and back
      let x = bx, by = ballY;
      if (pass && now - pass.t < PASS_MS) {
        const k = (now - pass.t) / PASS_MS;
        x = bx + Math.sin(Math.PI * k) * (restX - bx + 44);
        by = pass.y;
      }
      trail = trail.filter((t) => now - t.t < 400);
      trail.forEach((t) => {
        const k = (now - t.t) / 400;
        ctx.globalAlpha = 0.35 * (1 - k);
        ctx.fillStyle = colors[t.state] || colors.muted;
        ctx.beginPath(); ctx.arc(t.x - k * 30, t.y, BALL_R * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (by != null && now - lastSeen < 400) {
        by = Math.max(BALL_R, Math.min(h - BALL_R, by));
        const passing = pass && now - pass.t < PASS_MS;
        const color = passing ? colors.good : colors[ballState] || colors.muted;
        const g = ctx.createRadialGradient(x - BALL_R * 0.35, by - BALL_R * 0.4, 2, x, by, BALL_R);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, color);
        ctx.shadowColor = color; ctx.shadowBlur = ballState === 'good' || passing ? 22 : 8;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, by, BALL_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        trail.push({ t: now, x: x, y: by, state: passing ? 'good' : ballState });
      } else if (step < notes.length) {
        // no voice: a hollow ball parked at the target so you know where to aim
        ctx.strokeStyle = hue(notes[step], null, 0.9); ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(bx, y(notes[step]), BALL_R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    function burst(x, y0, count, spread, colorAt) {
      for (let i = 0; i < count; i++) {
        bits.push({ t: Date.now(), x: x, y: y0 + (Math.random() - 0.5) * spread, vx: Math.random() * 2 - 0.5, vy: Math.random() * 2 - 1.3,
          spin: Math.random() * 2 - 1, s: 6 + Math.random() * 6, color: colorAt(i) });
      }
    }

    return {
      start() {
        colors = { muted: css('--muted'), good: css('--good'), warn: css('--warn'), bad: css('--bad') };
        // dark sky when the page background is dark
        const bg = css('--bg').replace('#', ''), n = parseInt(bg.length === 3 ? bg.replace(/./g, '$&$&') : bg, 16);
        dark = ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 128;
        if (!raf) draw();
      },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      /** The course's notes, the wall you're on (the length when done) and the key's Do. */
      set(list, i, keyRoot) {
        if (i !== step || list.join() !== notes.join()) slideAt = Date.now();
        notes = list; step = i; root = keyRoot;
        lo = Math.min(...list) - 3; hi = Math.max(...list) + 3;
      },
      push(midi, state) {
        if (midi == null) return;
        const h = host.getBoundingClientRect().height, target = h - ((midi - lo) / (hi - lo)) * h;
        ballY = ballY == null || Date.now() - lastSeen > 400 ? target : ballY + (target - ballY) * 0.5;
        ballState = state; lastSeen = Date.now();
      },
      progress(p) { held = Math.max(0, Math.min(1, p)); },
      /** The ball goes through the current hole and the wall bursts; the last one sets off every colour. */
      pass() {
        const r = host.getBoundingClientRect(), x = r.width * BALL_X + BALL_R + WALL_W / 2 + 12;
        const gy = r.height - ((notes[step] - lo) / (hi - lo)) * r.height, m = notes[step];
        pass = { t: Date.now(), y: gy };
        burst(x, gy, 26, 160, () => hue(m, 50 + Math.random() * 25));
        if (step === notes.length - 1) burst(r.width / 2, r.height / 2, 90, r.height, (k) => 'hsl(' + HUES[k % HUES.length] + ', 85%, 55%)');
        held = 0;
      },
      /** CSS colour for a note, so the chips can match their walls. */
      color: (m) => hue(m),
      reset() { ballY = null; trail = []; bits = []; pass = null; held = 0; lastSeen = 0; slideAt = Date.now(); }
    };
  }

  V.ui.holeGame = holeGame;
})(window.V = window.V || {});
