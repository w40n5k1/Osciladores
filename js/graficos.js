// By Bruno Mota - METAbio
/**
 * The three plots of the page, drawn on canvas elements:
 *
 *   Graficos.Phase      phase diagram, momentum p against position x
 *   Graficos.Energy     kinetic, potential and total energy against time
 *   Graficos.Solution   x(t): the numerical solution and, for the linear oscillator, the closed form
 *
 * Each plot has two layers.  `render(model)` draws everything that does not depend on the time cursor
 * (axes, curves) on an off-screen canvas; `update(model)` copies that layer to the screen and adds the cursor.
 * `render` runs when a parameter or the size of the canvas changes, `update` at every step of the animation.
 * `area` is the Frame of the plot: its ranges, and `area.at(event)` for the data coordinates of a pointer.
 *
 * The model is the object assembled by app.js:
 *   P, D          parameters and derived quantities (see fisica.js)
 *   x0, p0, T     initial conditions and duration
 *   sol, en       numerical solution {t, x, p, n, dt, escaped} and its energies {K, U, E}
 *   an, steady    closed-form solution and steady state, or null
 *   eq            equilibrium points [{x, stable}]
 *   view          {xr, pr, nView}: half-widths of the phase diagram and number of samples inside it
 *   tEnd, tEscape last instant the cursor can reach; instant at which an escaping mass reaches infinity, or null
 *   index         index of the sample under the time cursor
 *   components    true to draw the two terms of the closed form separately
 *
 * Colors are read from the CSS custom properties of the page, so the plots follow the light and dark themes.
 */
(function (root) {
  'use strict';
  const F = root.Fisica;

  /** Value of a CSS custom property of the page. */
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const ITALIC = 'italic 13px "KaTeX_Math", "Times New Roman", serif';

  /** A step of 1, 2 or 5 times a power of ten that divides `span` into about `count` intervals. */
  function niceStep(span, count) {
    const raw = span / count, power = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / power;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power;
  }

  /** The smallest "round" number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten) not below v. */
  function niceCeil(v) {
    const power = Math.pow(10, Math.floor(Math.log10(v))), m = v / power;
    for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m <= c * (1 + 1e-12)) return c * power;
    return 10 * power;
  }

  /** A tick value as text, with the decimal places its step calls for and a decimal comma. */
  function tickText(v, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    if (Math.abs(v) >= 1e5) return v.toExponential(0).replace('e+', 'e');
    return v.toFixed(decimals).replace('.', ',').replace('-', '−');
  }

  /**
   * A canvas with data coordinates: margins, ranges, axes, clipped polylines, and the off-screen layer.
   */
  class Frame {
    constructor(canvas, margins) {
      this.canvas = canvas;
      this.layer = document.createElement('canvas');
      this.m = margins;
      this.x = [0, 1];
      this.y = [0, 1];
      this.w = this.h = 0;
    }

    /** Matches the pixel size of both layers to the size of the element.  True if the size changed. */
    resize() {
      const box = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.round(box.width), h = Math.round(box.height);
      if (w === this.w && h === this.h && dpr === this.dpr) return false;
      this.w = w; this.h = h; this.dpr = dpr;
      for (const c of [this.canvas, this.layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      return true;
    }

    X(v) { return this.m.l + (v - this.x[0]) / (this.x[1] - this.x[0]) * (this.w - this.m.l - this.m.r); }
    Y(v) { return this.h - this.m.b - (v - this.y[0]) / (this.y[1] - this.y[0]) * (this.h - this.m.t - this.m.b); }
    /** Data coordinates of a pointer event. */
    at(event) {
      const box = this.canvas.getBoundingClientRect();
      const fx = (event.clientX - box.left - this.m.l) / (this.w - this.m.l - this.m.r);
      const fy = (this.h - this.m.b - (event.clientY - box.top)) / (this.h - this.m.t - this.m.b);
      return { x: this.x[0] + fx * (this.x[1] - this.x[0]), y: this.y[0] + fy * (this.y[1] - this.y[0]) };
    }

    /** Context of the off-screen layer, cleared and scaled to CSS pixels. */
    begin() {
      const ctx = this.layer.getContext('2d');
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      return ctx;
    }

    /** Context of the visible canvas, holding a copy of the off-screen layer. */
    screen() {
      const ctx = this.canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.layer.width && this.layer.height) ctx.drawImage(this.layer, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return ctx;
    }

    /** Restricts drawing to the plot area, until ctx.restore(). */
    clip(ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.m.l, this.m.t, this.w - this.m.l - this.m.r, this.h - this.m.t - this.m.b);
      ctx.clip();
    }

    /**
     * Grid, tick labels, frame and axis labels.  A label is [symbol, unit]: the symbol is set in italic.
     * With `zero` the lines x = 0 and y = 0 are drawn a little stronger.
     */
    axes(ctx, xLabel, yLabel, zero) {
      const left = this.m.l, right = this.w - this.m.r, top = this.m.t, bottom = this.h - this.m.b;
      const xStep = niceStep(this.x[1] - this.x[0], Math.max(2, (right - left) / 70));
      const yStep = niceStep(this.y[1] - this.y[0], Math.max(2, (bottom - top) / 60));
      ctx.lineWidth = 1; ctx.font = FONT; ctx.fillStyle = css('--tinta-2');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = Math.ceil(this.x[0] / xStep - 1e-9) * xStep; v <= this.x[1] + 1e-9 * xStep; v += xStep) {
        const value = Math.abs(v) < 1e-9 * xStep ? 0 : v, px = Math.round(this.X(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
        ctx.fillText(tickText(value, xStep), px, bottom + 5);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(this.y[0] / yStep - 1e-9) * yStep; v <= this.y[1] + 1e-9 * yStep; v += yStep) {
        const value = Math.abs(v) < 1e-9 * yStep ? 0 : v, py = Math.round(this.Y(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
        ctx.fillText(tickText(value, yStep), left - 6, py);
      }
      ctx.strokeStyle = css('--eixo');
      ctx.strokeRect(left + 0.5, top + 0.5, right - left, bottom - top);

      const label = (parts, x, y, align) => {
        ctx.font = ITALIC; const ws = ctx.measureText(parts[0]).width;
        ctx.font = FONT; const wu = ctx.measureText(parts[1]).width;
        let start = align === 'right' ? x - ws - wu : x;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = css('--tinta-2');
        ctx.font = ITALIC; ctx.fillText(parts[0], start, y);
        ctx.font = FONT; ctx.fillText(parts[1], start + ws, y);
      };
      label(xLabel, right, this.h - 5, 'right');
      label(yLabel, 4, top - 8, 'left');
    }

    /**
     * Polyline through (xs[i], ys(i)) for i from `from` to `to` (exclusive), every `stride` samples.
     * ys is an array or a function of the index.  Points far outside the ranges break the line.
     */
    line(ctx, xs, ys, from, to, color, width, dash, stride) {
      const value = typeof ys === 'function' ? ys : i => ys[i];
      const limit = 4 * Math.max(this.w, this.h);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      let pen = false;
      for (let i = from; i < to; i += stride || 1) {
        const px = this.X(xs[i]), py = this.Y(value(i));
        if (!isFinite(px) || !isFinite(py) || Math.abs(px) > limit || Math.abs(py) > limit) { pen = false; continue; }
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /** A dot of the given color with a ring of the surface color around it. */
    dot(ctx, x, y, color, radius) {
      const px = this.X(x), py = this.Y(y);
      ctx.beginPath(); ctx.arc(px, py, radius + 2, 0, 2 * Math.PI); ctx.fillStyle = css('--painel'); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, radius, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
    }
  }

  /** Vertical line at the time of the cursor (time plots). */
  function timeLine(ctx, frame, t) {
    const px = Math.round(frame.X(t)) + 0.5;
    ctx.strokeStyle = css('--tinta-2'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, frame.m.t); ctx.lineTo(px, frame.h - frame.m.b); ctx.stroke();
  }

  /** Dashed vertical line at the instant an escaping mass reaches infinity (time plots). */
  function escapeMark(ctx, frame, model) {
    if (model.tEscape === null) return;
    const px = Math.round(frame.X(model.tEscape)) + 0.5;
    ctx.strokeStyle = css('--escape'); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, frame.m.t); ctx.lineTo(px, frame.h - frame.m.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT; ctx.fillStyle = css('--tinta-2'); ctx.textBaseline = 'top';
    ctx.textAlign = px > frame.w - 80 ? 'right' : 'left';
    ctx.fillText('x → ∞', px + (ctx.textAlign === 'left' ? 5 : -5), frame.m.t + 4);
  }

  // ------------------------------------------------------------------------------------------ phase diagram

  class Phase {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
    }

    /**
     * One curve of constant energy, p = +-sqrt(2 M (E - V(x))), over the visible range of x.
     * Where E - V changes sign between two samples the turning point is found by linear interpolation,
     * so that the two branches meet on the axis p = 0.
     */
    levelCurve(ctx, P, E) {
      const fr = this.area, n = 240, dx = (fr.x[1] - fr.x[0]) / n;
      const pieces = [];
      let piece = null, xPrev = 0, dPrev = -1;
      for (let i = 0; i <= n; i++) {
        const x = fr.x[0] + i * dx, d = E - F.potential(P, x);
        if (d >= 0) {
          if (!piece) { piece = []; pieces.push(piece); if (i > 0) piece.push([xPrev + dx * dPrev / (dPrev - d), 0]); }
          piece.push([x, Math.sqrt(2 * P.M * d)]);
        } else if (piece) {
          piece.push([xPrev + dx * dPrev / (dPrev - d), 0]);
          piece = null;
        }
        xPrev = x; dPrev = d;
      }
      ctx.beginPath();
      for (const points of pieces) {
        for (const sign of [1, -1]) {
          points.forEach((q, j) => { const px = fr.X(q[0]), py = fr.Y(sign * q[1]); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        }
      }
      ctx.stroke();
    }

    render(model) {
      const fr = this.area, { P, sol, view } = model;
      fr.x = [-view.xr, view.xr]; fr.y = [-view.pr, view.pr];
      const ctx = fr.begin();
      fr.axes(ctx, ['x', ' (m)'], ['p', ' (kg·m/s)'], true);
      fr.clip(ctx);

      // Curves of constant energy of the oscillator without damping or forcing: eight of them, from the bottom
      // of the deepest well in view to the energy that reaches the top of the diagram at x = 0.  The energies
      // go as the square of j, which spaces the ellipses of the harmonic oscillator evenly.
      let vWell = 0;
      for (const e of model.eq) if (e.stable && Math.abs(e.x) <= view.xr) vWell = Math.min(vWell, F.potential(P, e.x));
      const eTop = view.pr * view.pr / (2 * P.M);
      ctx.strokeStyle = css('--nivel'); ctx.lineWidth = 1;
      for (let j = 1; j <= 8; j++) this.levelCurve(ctx, P, vWell + (eTop - vWell) * (j / 8) * (j / 8));
      // Separatrices: the curves through the unstable equilibria.
      ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--tinta-3');
      for (const e of model.eq) if (!e.stable) this.levelCurve(ctx, P, F.potential(P, e.x));
      ctx.setLineDash([]);

      // Steady state of the forced, damped linear oscillator: an ellipse with semi-axes A and M A w.
      if (model.steady && model.D.harmonic && model.D.gamma > 0 && P.w > 0) {
        const A = model.steady.A;
        ctx.strokeStyle = css('--serie-3'); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let j = 0; j <= 180; j++) {
          const u = j * Math.PI / 90, px = fr.X(A * Math.cos(u)), py = fr.Y(P.M * A * P.w * Math.sin(u));
          if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      fr.line(ctx, sol.x, sol.p, 0, view.nView, css('--serie-1'), 1.6);

      // Equilibrium points: filled where stable, open where unstable.
      for (const e of model.eq) {
        const px = fr.X(e.x), py = fr.Y(0);
        ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fillStyle = e.stable ? css('--tinta') : css('--painel'); ctx.fill();
        ctx.strokeStyle = css('--tinta'); ctx.lineWidth = 1.5; ctx.stroke();
      }
      // Initial condition: a ring, which can be dragged.
      ctx.beginPath(); ctx.arc(fr.X(model.x0), fr.Y(model.p0), 6, 0, 2 * Math.PI);
      ctx.strokeStyle = css('--serie-1'); ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    update(model) {
      const fr = this.area, { sol, view } = model, i = Math.min(model.index, view.nView - 1);
      const ctx = fr.screen();
      fr.clip(ctx);
      const tail = Math.max(0, i - Math.round(0.6 / sol.dt));
      fr.line(ctx, sol.x, sol.p, tail, i + 1, css('--serie-1'), 3.5);
      fr.dot(ctx, sol.x[i], sol.p[i], css('--serie-1'), 5);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------------------------------ energy

  class Energy {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
    }

    render(model) {
      const fr = this.area, { sol, en, view } = model;
      let lo = 0, hi = 0;
      for (let i = 0; i < view.nView; i++) {
        lo = Math.min(lo, en.U[i], en.E[i]);
        hi = Math.max(hi, en.K[i], en.U[i], en.E[i]);
      }
      // The energy axis always includes zero; its ends are round numbers just beyond the extremes.
      fr.x = [0, model.T];
      fr.y = [lo < 0 ? -niceCeil(-1.02 * lo) : 0, niceCeil(Math.max(1.02 * hi, 1e-3))];
      const ctx = fr.begin();
      fr.axes(ctx, ['t', ' (s)'], ['', 'energia (J)'], true);
      fr.clip(ctx);
      fr.line(ctx, sol.t, en.U, 0, view.nView, css('--serie-3'), 1.4);
      fr.line(ctx, sol.t, en.K, 0, view.nView, css('--serie-2'), 1.4);
      fr.line(ctx, sol.t, en.E, 0, view.nView, css('--serie-1'), 2.2);
      escapeMark(ctx, fr, model);
      ctx.restore();
    }

    update(model) {
      const fr = this.area, { sol, en, view } = model, i = Math.min(model.index, view.nView - 1);
      const ctx = fr.screen();
      fr.clip(ctx);
      timeLine(ctx, fr, sol.t[i]);
      fr.dot(ctx, sol.t[i], en.U[i], css('--serie-3'), 3.5);
      fr.dot(ctx, sol.t[i], en.K[i], css('--serie-2'), 3.5);
      fr.dot(ctx, sol.t[i], en.E[i], css('--serie-1'), 4);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------------------------------ solution x(t)

  class Solution {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
    }

    render(model) {
      const fr = this.area, { sol, an, view } = model;
      fr.x = [0, model.T]; fr.y = [-view.xr, view.xr];
      const ctx = fr.begin();
      fr.axes(ctx, ['t', ' (s)'], ['x', ' (m)'], true);
      fr.clip(ctx);
      if (an && model.components && an.particular !== 'none') {
        fr.line(ctx, sol.t, i => an.xh(sol.t[i]), 0, sol.n, css('--serie-2'), 1.2);
        fr.line(ctx, sol.t, i => an.xp(sol.t[i]), 0, sol.n, css('--serie-3'), 1.2);
      }
      fr.line(ctx, sol.t, sol.x, 0, view.nView, css('--serie-1'), 2.4);
      if (an) fr.line(ctx, sol.t, i => an.x(sol.t[i]), 0, sol.n, css('--tinta'), 1, [5, 4]);
      escapeMark(ctx, fr, model);
      ctx.restore();
    }

    update(model) {
      const fr = this.area, { sol, view } = model, i = Math.min(model.index, view.nView - 1);
      const ctx = fr.screen();
      fr.clip(ctx);
      timeLine(ctx, fr, sol.t[i]);
      fr.dot(ctx, sol.t[i], sol.x[i], css('--serie-1'), 4.5);
      ctx.restore();
    }
  }

  root.Graficos = { Phase, Energy, Solution, niceCeil };
})(window);
