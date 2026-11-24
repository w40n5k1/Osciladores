// By Bruno Mota - METAbio
/**
 * The three plots of the page, drawn on canvas elements:
 *
 *   Graficos.Phase      phase diagram, momentum p against position x, with the arrows of velocity and force;
 *                       .forceZoom is the factor by which the arrow of the external force is magnified
 *   Graficos.Energy     kinetic, potential and total energy against time, with the potential V(x) in an inset
 *   Graficos.Solution   x(t)
 *
 * Each plot has two layers.  `render(model)` draws everything that does not depend on the time cursor
 * (axes, curves) on an off-screen canvas; `update(model)` copies that layer to the screen and adds what moves
 * with the cursor.  `render` runs when a parameter or the size of the canvas changes, `update` at every step
 * of the animation.  `area` is the Frame of the plot: its ranges, margins, and `area.at(event)` for the data
 * coordinates of a pointer.
 *
 * The model is the object assembled by app.js:
 *   P, D          parameters and derived quantities (see fisica.js)
 *   x0, p0, T     initial conditions and duration
 *   sol, en       the solution {t, x, p, n, dt, escaped, exact, step} and its energies {K, U, E}
 *   an            closed-form solution used for the curves (sol.exact), or null
 *   approx        closed form of the harmonic approximation of a nonlinear system, or null
 *   steady        steady state of the forced linear oscillator, or null
 *   eq            equilibrium points [{x, stable}]
 *   view          {xr, pr, nView}: half-widths of the phase diagram; number of samples to draw (all of them,
 *                 unless the mass escapes to infinity: then up to the first one after it leaves the diagram)
 *   xw, wrap      positions as drawn in the phase diagram: for the pendulum, x reduced to one turn
 *                 (-pi L, pi L], and wrap = true; otherwise sol.x itself
 *   xRange        [lower, upper] of the x(t) plot
 *   tAxis         end of the time axis
 *   tEnd, tEscape last instant the cursor can reach; instant at which an escaping mass reaches infinity, or null
 *   tau           time (s) over which the arrows of the phase diagram show the displacement
 *   index         index of the sample under the time cursor
 *   components    true to draw the two terms of the closed form of the forced linear oscillator
 *   showApprox    true to draw the harmonic approximation
 *
 * Colors are read from the CSS custom properties of the page, so the plots follow the light and dark themes.
 */
(function (root) {
  'use strict';
  const F = root.Fisica, Fm = root.Formulas;

  /** Value of a CSS custom property of the page. */
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const SMALL = '10.5px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const ITALIC = 'italic 13px "KaTeX_Math", "Times New Roman", serif';
  const ROUND = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

  /** A step of 1, 2 or 5 times a power of ten that divides `span` into about `count` intervals. */
  function niceStep(span, count) {
    const raw = span / count, power = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / power;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power;
  }

  /** The smallest "round" number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten) not below v. */
  function niceCeil(v) {
    const power = Math.pow(10, Math.floor(Math.log10(v))), m = v / power;
    for (const c of ROUND) if (m <= c * (1 + 1e-12)) return c * power;
    return 10 * power;
  }

  /** The round numbers from 10^fromExponent to 10^toExponent, in increasing order. */
  function roundNumbers(fromExponent, toExponent) {
    const out = [];
    for (let e = fromExponent; e < toExponent; e++) for (const c of ROUND) out.push(Number((c * Math.pow(10, e)).toPrecision(6)));
    out.push(Math.pow(10, toExponent));
    return out;
  }

  /** A tick value as text, with the decimal places its step calls for and a decimal comma. */
  function tickText(v, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(decimals).replace('.', ',').replace('-', '−');
  }

  /**
   * Exponent of the power of ten taken out of the tick labels of an axis and written with its unit, as in
   * "energia (10⁵ J)": the exponent of the largest value of the range when that is 10⁵ or more, or below
   * 10⁻³; zero (nothing taken out) otherwise.
   */
  function decade(range) {
    const exponent = Math.floor(Math.log10(Math.max(Math.abs(range[0]), Math.abs(range[1]))) + 1e-9);
    return exponent >= 5 || exponent <= -4 ? exponent : 0;
  }

  /** A number as short text: three significant figures at most, decimal comma. */
  const brief = v => String(Number(v.toPrecision(3))).replace('.', ',').replace('-', '−');

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

    get left() { return this.m.l; }
    get right() { return this.w - this.m.r; }
    get top() { return this.m.t; }
    get bottom() { return this.h - this.m.b; }

    X(v) { return this.left + (v - this.x[0]) / (this.x[1] - this.x[0]) * (this.right - this.left); }
    Y(v) { return this.bottom - (v - this.y[0]) / (this.y[1] - this.y[0]) * (this.bottom - this.top); }
    /** Data coordinates of a pointer event. */
    at(event) {
      const box = this.canvas.getBoundingClientRect();
      const fx = (event.clientX - box.left - this.left) / (this.right - this.left);
      const fy = (this.bottom - (event.clientY - box.top)) / (this.bottom - this.top);
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
      ctx.rect(this.left, this.top, this.right - this.left, this.bottom - this.top);
      ctx.clip();
    }

    /**
     * Grid, tick labels, frame and axis labels.  A label is [symbol, unit]: the symbol is set in italic, and
     * the unit comes in parentheses, where a power of ten goes if one is taken out of the tick labels.
     * With `zero` the lines x = 0 and y = 0 are drawn a little stronger.
     */
    axes(ctx, xLabel, yLabel, zero) {
      const { left, right, top, bottom } = this;
      const xStep = niceStep(this.x[1] - this.x[0], Math.max(2, (right - left) / 70));
      const yStep = niceStep(this.y[1] - this.y[0], Math.max(2, (bottom - top) / 60));
      const xDecade = decade(this.x), yDecade = decade(this.y), xUnit = Math.pow(10, xDecade), yUnit = Math.pow(10, yDecade);
      const withDecade = (parts, exponent) => (exponent ? [parts[0], parts[1].replace('(', '(10' + Fm.superscript(exponent) + ' ')] : parts);
      ctx.lineWidth = 1; ctx.font = FONT; ctx.fillStyle = css('--tinta-2');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = Math.ceil(this.x[0] / xStep - 1e-9) * xStep; v <= this.x[1] + 1e-9 * xStep; v += xStep) {
        const value = Math.abs(v) < 1e-9 * xStep ? 0 : v, px = Math.round(this.X(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
        ctx.fillText(tickText(value / xUnit, xStep / xUnit), px, bottom + 5);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(this.y[0] / yStep - 1e-9) * yStep; v <= this.y[1] + 1e-9 * yStep; v += yStep) {
        const value = Math.abs(v) < 1e-9 * yStep ? 0 : v, py = Math.round(this.Y(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
        ctx.fillText(tickText(value / yUnit, yStep / yUnit), left - 6, py);
      }
      ctx.strokeStyle = css('--eixo');
      ctx.strokeRect(left + 0.5, top + 0.5, right - left, bottom - top);

      const label = (parts, x, y, align) => {
        ctx.font = ITALIC; const ws = ctx.measureText(parts[0]).width;
        ctx.font = FONT; const wu = ctx.measureText(parts[1]).width;
        const start = align === 'right' ? x - ws - wu : x;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = css('--tinta-2');
        ctx.font = ITALIC; ctx.fillText(parts[0], start, y);
        ctx.font = FONT; ctx.fillText(parts[1], start + ws, y);
      };
      label(withDecade(xLabel, xDecade), right, this.h - 5, 'right');
      label(withDecade(yLabel, yDecade), 4, top - 10, 'left');
    }

    /**
     * Polyline through (xs[i], ys(i)) for i from `from` to `to` (exclusive).  ys is an array or a function of
     * the index.  style: {color, width, dash, jump}.  Points far outside the ranges break the line; with
     * `jump`, so does a horizontal leap of more than half the plot (a pendulum passing from one end of the
     * turn to the other).
     */
    line(ctx, xs, ys, from, to, style) {
      const value = typeof ys === 'function' ? ys : i => ys[i];
      const limit = 4 * Math.max(this.w, this.h), leap = style.jump ? (this.right - this.left) / 2 : Infinity;
      ctx.strokeStyle = style.color; ctx.lineWidth = style.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(style.dash || []);
      ctx.beginPath();
      let pen = false, last = 0;
      for (let i = from; i < to; i++) {
        const px = this.X(xs[i]), py = this.Y(value(i));
        if (!isFinite(px) || !isFinite(py) || Math.abs(px) > limit || Math.abs(py) > limit) { pen = false; continue; }
        if (pen && Math.abs(px - last) <= leap) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true; last = px;
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

  /** An arrow from (ax, ay) to (bx, by), in pixels.  Nothing is drawn for less than two pixels. */
  function arrow(ctx, ax, ay, bx, by, color, width) {
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
    if (!(length >= 2)) return;
    const head = Math.min(2.6 * width + 4.5, 0.6 * length), ux = dx / length, uy = dy / length;
    const half = Math.max(0.42 * head, 0.9 * width + 1);              // the head stays wider than the shaft when the arrow is short
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - 0.8 * head * ux, by - 0.8 * head * uy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - head * ux - half * uy, by - head * uy + half * ux);
    ctx.lineTo(bx - head * ux + half * uy, by - head * uy - half * ux);
    ctx.closePath(); ctx.fill();
  }

  /** Vertical line at the time of the cursor, from the bottom of the plot up to the pixel row `upTo`. */
  function timeLine(ctx, frame, t, upTo) {
    const px = Math.round(frame.X(t)) + 0.5;
    ctx.strokeStyle = css('--tinta-2'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, upTo); ctx.lineTo(px, frame.bottom); ctx.stroke();
  }

  /** Dashed vertical line at the instant an escaping mass reaches infinity (time plots). */
  function escapeMark(ctx, frame, model) {
    if (model.tEscape === null) return;
    const px = Math.round(frame.X(model.tEscape)) + 0.5;
    ctx.strokeStyle = css('--escape'); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, frame.top); ctx.lineTo(px, frame.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT; ctx.fillStyle = css('--tinta-2'); ctx.textBaseline = 'bottom'; ctx.textAlign = 'right';
    ctx.fillText('x → ∞', px - 5, frame.bottom - 5);
  }

  // ------------------------------------------------------------------------------------------ phase diagram

  /** Length in pixels the arrow of the external force reaches, at least, when the force is at its peak F0. */
  const FORCE_ARROW = 30;

  /**
   * Factor by which the arrow of the external force is magnified: the smallest of 1, 2, 5, 10, 20, 50, ...
   * that makes an arrow of `length` pixels reach FORCE_ARROW.
   */
  function magnification(length) {
    if (!(length > 0) || length >= FORCE_ARROW) return 1;
    const needed = FORCE_ARROW / length, power = Math.pow(10, Math.floor(Math.log10(needed) + 1e-9)), m = needed / power;
    return (m <= 1 + 1e-9 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
  }

  class Phase {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
      this.forceZoom = 1;                   // magnification of the arrow of the external force (see render)
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
      // On the scale of the other arrows the external force at its peak spans F0 tau; if that is too few
      // pixels to see, its arrow is magnified by a round factor, which the page shows in the legend.
      this.forceZoom = magnification(P.F0 * model.tau * (fr.bottom - fr.top) / (2 * view.pr));
      const ctx = fr.begin();
      fr.axes(ctx, ['x', ' (m)'], ['p', ' (kg·m/s)'], true);
      fr.clip(ctx);
      const visible = model.eq.filter(e => Math.abs(e.x) <= view.xr * (1 + 1e-9));

      // Curves of constant energy of the system without friction or forcing: eight of them, from the bottom
      // of the deepest well in view to the energy that reaches the top of the diagram at x = 0.  The energies
      // go as the square of j, which spaces the ellipses of the harmonic oscillator evenly.
      let vWell = 0;
      for (const e of visible) if (e.stable) vWell = Math.min(vWell, F.potential(P, e.x));
      const eTop = view.pr * view.pr / (2 * P.M);
      ctx.strokeStyle = css('--nivel'); ctx.lineWidth = 1;
      for (let j = 1; j <= 8; j++) this.levelCurve(ctx, P, vWell + (eTop - vWell) * (j / 8) * (j / 8));
      // Separatrices: the curves through the unstable equilibria.
      ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--tinta-3');
      const drawn = [];
      for (const e of model.eq) {
        const E = F.potential(P, e.x);
        if (e.stable || drawn.some(other => Math.abs(other - E) <= 1e-9 * Math.abs(E))) continue;
        drawn.push(E);
        this.levelCurve(ctx, P, E);
      }
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

      fr.line(ctx, model.xw, sol.p, 0, view.nView, { color: css('--serie-1'), width: 1.6, jump: model.wrap });

      // Equilibrium points: filled where stable, open where unstable.
      for (const e of visible) {
        const px = fr.X(e.x), py = fr.Y(0);
        ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fillStyle = e.stable ? css('--tinta') : css('--painel'); ctx.fill();
        ctx.strokeStyle = css('--tinta'); ctx.lineWidth = 1.5; ctx.stroke();
      }
      // Initial condition: a ring, which can be dragged.
      ctx.beginPath(); ctx.arc(fr.X(model.xw[0]), fr.Y(model.p0), 6, 0, 2 * Math.PI);
      ctx.strokeStyle = css('--serie-1'); ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    /**
     * The moving point, the stretch of trajectory just behind it, and the arrows at the point.
     *
     * The tangent to the trajectory is (x', p') = (velocity, total force).  The arrows show this vector and
     * its two components multiplied by the time tau, that is, the displacement in the diagram during tau if
     * the rates stayed as they are: velocity (horizontal) and total force (vertical) in gray, their sum in
     * the color of the text, and the external force F0 cos(w t), a part of the total force, thicker and red.
     * On that scale the red arrow is often too short to see (at resonance the external force is 1/Q of the
     * elastic force), so it is magnified by this.forceZoom, and drawn last, over the point and the thin arrows.
     */
    update(model) {
      const fr = this.area, { P, sol, view } = model, i = Math.min(model.index, view.nView - 1);
      const ctx = fr.screen();
      fr.clip(ctx);
      const tail = Math.max(0, i - Math.round(0.6 / sol.dt));
      fr.line(ctx, model.xw, sol.p, tail, i + 1, { color: css('--serie-1'), width: 3.5, jump: model.wrap });

      const x = model.xw[i], p = sol.p[i], velocity = p / P.M;
      const external = P.F0 * Math.cos(P.w * sol.t[i]), total = F.force(P, sol.x[i]) - P.b * velocity + external;
      const ox = fr.X(x), oy = fr.Y(p);
      const ex = fr.X(x + velocity * model.tau), ey = fr.Y(p + total * model.tau);
      arrow(ctx, ox, oy, ex, oy, css('--tinta-2'), 1.25);
      arrow(ctx, ox, oy, ox, ey, css('--tinta-2'), 1.25);
      arrow(ctx, ox, oy, ex, ey, css('--tinta'), 1.25);
      fr.dot(ctx, x, p, css('--serie-1'), 5);
      arrow(ctx, ox, oy, ox, fr.Y(p + this.forceZoom * external * model.tau), css('--forca'), 3.5);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------------------------------ energy

  class Energy {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
      this.inset = null;
    }

    /**
     * Places the inset with the potential in the upper right corner of the plot and sets its scales:
     * x over the range of the phase diagram; energy from the bottom of the potential in that range up to a
     * little above the largest total energy of the motion (or the highest barrier in view, if higher).
     */
    layoutInset(model) {
      const fr = this.area, plotW = fr.right - fr.left, plotH = fr.bottom - fr.top;
      const w = Math.min(Math.max(0.42 * plotW, 110), 220, 0.62 * plotW), h = Math.min(Math.max(0.32 * plotH, 76), 140, 0.5 * plotH);
      const box = { x: fr.right - w - 6, y: fr.top + 6, w, h };
      const xr = model.view.xr, n = 120;
      box.xs = new Float64Array(n + 1); box.vs = new Float64Array(n + 1);
      let vMin = 0, top = 0;
      for (let j = 0; j <= n; j++) {
        box.xs[j] = -xr + 2 * xr * j / n; box.vs[j] = F.potential(model.P, box.xs[j]);
        vMin = Math.min(vMin, box.vs[j]);
      }
      for (let i = 0; i < model.view.nView; i++) top = Math.max(top, model.en.E[i]);
      for (const e of model.eq) if (!e.stable && Math.abs(e.x) <= xr * (1 + 1e-9)) top = Math.max(top, F.potential(model.P, e.x));
      if (!(top > vMin)) top = Math.max(box.vs[0], box.vs[n], vMin + 1);          // a mass at rest at the bottom
      const span = 1.12 * (top - vMin);
      box.vLo = vMin - 0.07 * span; box.vHi = vMin + span;
      box.X = v => box.x + 7 + (v + xr) / (2 * xr) * (w - 14);
      box.Y = e => box.y + h - 13 - (e - box.vLo) / (box.vHi - box.vLo) * (h - 13 - 16);
      box.xr = xr;
      return box;
    }

    render(model) {
      const fr = this.area, { sol, en, view } = model;
      fr.x = [0, model.tAxis];
      const box = this.inset = this.layoutInset(model);

      // The energy axis always includes zero; its ends are round numbers just beyond the extremes.  The upper
      // end is raised, if needed and by no more than needed, so that no curve passes behind the inset.
      let lo = 0, hi = 0, hiBehind = 0;
      for (let i = 0; i < view.nView; i++) {
        const most = Math.max(en.K[i], en.U[i], en.E[i]);
        lo = Math.min(lo, en.U[i], en.E[i]); hi = Math.max(hi, most);
        if (fr.X(sol.t[i]) >= box.x - 4) hiBehind = Math.max(hiBehind, most);
      }
      const bottom = lo < 0 ? -niceCeil(-1.02 * lo) : 0;
      const free = Math.max(0.2, (fr.bottom - (box.y + box.h + 7)) / (fr.bottom - fr.top));   // fraction of the height below the inset
      fr.y = [bottom, Math.max(hi > 0 ? niceCeil(1.02 * hi) : 1, bottom + (hiBehind - bottom) / free)];   // (0 to 1 J for a mass at rest)

      const ctx = fr.begin();
      fr.axes(ctx, ['t', ' (s)'], ['', 'energia (J)'], true);
      fr.clip(ctx);
      fr.line(ctx, sol.t, en.U, 0, view.nView, { color: css('--serie-3'), width: 1.4 });
      fr.line(ctx, sol.t, en.K, 0, view.nView, { color: css('--serie-2'), width: 1.4 });
      fr.line(ctx, sol.t, en.E, 0, view.nView, { color: css('--serie-1'), width: 2.2 });
      escapeMark(ctx, fr, model);
      ctx.restore();

      // Inset: frame, the line V = 0, the curve V(x), and the ends of its x axis.
      ctx.fillStyle = css('--painel'); ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.lineWidth = 1; ctx.strokeStyle = css('--eixo'); ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x + 1, box.y + 1, box.w - 2, box.h - 2); ctx.clip();
      const zero = Math.round(box.Y(0)) + 0.5;
      ctx.strokeStyle = css('--grade'); ctx.beginPath(); ctx.moveTo(box.x, zero); ctx.lineTo(box.x + box.w, zero); ctx.stroke();
      ctx.strokeStyle = css('--serie-3'); ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let j = 0; j < box.xs.length; j++) { if (j) ctx.lineTo(box.X(box.xs[j]), box.Y(box.vs[j])); else ctx.moveTo(box.X(box.xs[j]), box.Y(box.vs[j])); }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = css('--tinta-2'); ctx.textBaseline = 'alphabetic';
      ctx.font = ITALIC; ctx.textAlign = 'center'; ctx.fillText('V(x)', box.x + box.w / 2, box.y + 14);
      ctx.font = SMALL; ctx.textAlign = 'left';
      ctx.fillText(brief(-box.xr), box.x + 4, box.y + box.h - 3);
      ctx.textAlign = 'right'; ctx.fillText(brief(box.xr) + ' m', box.x + box.w - 4, box.y + box.h - 3);
    }

    update(model) {
      const fr = this.area, { sol, en, view } = model, i = Math.min(model.index, view.nView - 1), box = this.inset;
      const ctx = fr.screen();
      fr.clip(ctx);
      timeLine(ctx, fr, sol.t[i], fr.X(sol.t[i]) >= box.x - 1 ? box.y + box.h : fr.top);
      fr.dot(ctx, sol.t[i], en.U[i], css('--serie-3'), 3.5);
      fr.dot(ctx, sol.t[i], en.K[i], css('--serie-2'), 3.5);
      fr.dot(ctx, sol.t[i], en.E[i], css('--serie-1'), 4);
      ctx.restore();

      // In the inset: the level of the total energy over the stretch where it exceeds V, the kinetic energy as
      // the vertical distance from the curve to that level, and the mass as a dot on the curve.
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x + 1, box.y + 1, box.w - 2, box.h - 2); ctx.clip();
      const E = en.E[i], level = box.Y(E);
      ctx.strokeStyle = css('--serie-1'); ctx.lineWidth = 1.5; ctx.beginPath();
      let pen = false;
      for (let j = 0; j < box.xs.length; j++) {
        if (box.vs[j] <= E) { if (pen) ctx.lineTo(box.X(box.xs[j]), level); else ctx.moveTo(box.X(box.xs[j]), level); pen = true; } else pen = false;
      }
      ctx.stroke();
      const px = box.X(model.xw[i]), py = box.Y(en.U[i]);
      ctx.strokeStyle = css('--serie-2'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, level); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 5.5, 0, 2 * Math.PI); ctx.fillStyle = css('--painel'); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 2 * Math.PI); ctx.fillStyle = css('--serie-3'); ctx.fill();
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
      fr.x = [0, model.tAxis]; fr.y = model.xRange;
      const ctx = fr.begin();
      fr.axes(ctx, ['t', ' (s)'], ['x', ' (m)'], true);
      fr.clip(ctx);
      if (an && an.kind === 'linear' && an.particular !== 'none' && model.components) {
        fr.line(ctx, sol.t, i => an.xh(sol.t[i]), 0, sol.n, { color: css('--serie-2'), width: 1.2 });
        fr.line(ctx, sol.t, i => an.xp(sol.t[i]), 0, sol.n, { color: css('--serie-3'), width: 1.2 });
      }
      fr.line(ctx, sol.t, sol.x, 0, view.nView, { color: css('--serie-1'), width: 2.2 });
      if (model.approx && model.showApprox) {
        fr.line(ctx, sol.t, i => model.approx.x(sol.t[i]), 0, sol.n, { color: css('--tinta'), width: 1, dash: [5, 4] });
      }
      escapeMark(ctx, fr, model);
      ctx.restore();
    }

    update(model) {
      const fr = this.area, { sol, view } = model, i = Math.min(model.index, view.nView - 1);
      const ctx = fr.screen();
      fr.clip(ctx);
      timeLine(ctx, fr, sol.t[i], fr.top);
      fr.dot(ctx, sol.t[i], sol.x[i], css('--serie-1'), 4.5);
      ctx.restore();
    }
  }

  root.Graficos = { Phase, Energy, Solution, niceCeil, niceStep, roundNumbers };
})(window);
