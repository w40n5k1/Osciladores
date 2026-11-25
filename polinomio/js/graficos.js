// By Bruno Mota - METAbio
/**
 * The two plots of the page, drawn on canvas elements:
 *
 *   Graficos.Sheet      the surface |y| over the complex plane of x, in parallel projection
 *   Graficos.RealLine   y against x, for x real
 *
 * Each plot has `draw(model)`, which redraws it whole, and `area`, the Frame of its canvas.
 *
 * The model is the object assembled by app.js:
 *   b, c       the coefficients
 *   roots      Polinomio.roots(b, c): {kind, delta, plus, minus}
 *   vertex     Polinomio.vertex(b, c): {x, y}
 *   box        what the plots show: {u, v, zMax, step, height}
 *                u, v     ranges [lower, upper] of Re x and Im x
 *                zMax     largest |y| (the real plot shows y from -zMax to zMax)
 *                step     side of a cell of the mesh of the surface
 *                height   height of the box, in the units of the complex plane: zMax is drawn with this length
 *   view       {azimuth, elevation}: where the surface is seen from, in radians (see Camera)
 *   cut        true to draw the section of the surface along the line Re x = -b/2
 *
 * Colors are read from the CSS custom properties of the page, so the plots follow the light and dark themes.
 * Frame is that of the Osciladores page, reduced to one layer (nothing here moves by itself).
 */
(function (root) {
  'use strict';
  const P = root.Polinomio;

  /** Value of a CSS custom property of the page. */
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const ITALIC = 'italic 13px "KaTeX_Math", "Times New Roman", serif';
  const SUBSCRIPT = '9.5px "KaTeX_Main", "Times New Roman", serif';

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /** A step of 1, 2 or 5 times a power of ten that divides `span` into about `count` intervals. */
  function niceStep(span, count) {
    const raw = span / count, power = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / power;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power;
  }

  /** The multiples of `step` from `lower` to `upper`, zero written without rounding noise. */
  function multiples(lower, upper, step) {
    const out = [];
    for (let k = Math.ceil(lower / step - 1e-9); k * step <= upper + 1e-9 * step; k++) out.push(k === 0 ? 0 : k * step);
    return out;
  }

  /** A tick value as text, with the decimal places its step calls for and a decimal comma. */
  function tickText(v, step) {
    const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(decimals).replace('.', ',').replace('-', '−');
  }

  /** [r, g, b] of a color written as #rgb or #rrggbb. */
  function rgb(hex) {
    const h = hex.replace('#', ''), full = h.length === 3 ? h.replace(/./g, d => d + d) : h;
    return [0, 2, 4].map(k => parseInt(full.slice(k, k + 2), 16));
  }

  /** The color at the fraction f of the way from `a` to `b` ([r, g, b] each), with the given opacity. */
  function mix(a, b, f, opacity) {
    const part = k => Math.round(a[k] + (b[k] - a[k]) * f);
    return 'rgba(' + part(0) + ',' + part(1) + ',' + part(2) + ',' + opacity + ')';
  }

  /**
   * Writes pieces of text one after the other: pieces = [[text, font, drop], ...], where `drop` lowers the piece
   * by that many pixels (a subscript).  `align` is 'left', 'center' or 'right'; with `halo`, each piece is
   * outlined in that color first, so that it reads over the lines of a plot.
   */
  function write(ctx, pieces, x, y, align, halo) {
    const widths = pieces.map(piece => { ctx.font = piece[1]; return ctx.measureText(piece[0]).width; });
    const total = widths.reduce((sum, w) => sum + w, 0);
    let at = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    pieces.forEach((piece, k) => {
      ctx.font = piece[1];
      if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeText(piece[0], at, y + (piece[2] || 0)); }
      ctx.fillText(piece[0], at, y + (piece[2] || 0));
      at += widths[k];
    });
  }

  /** The pieces of "x" with a subscript, for write(). */
  const xSub = sign => [['x', ITALIC], [sign, SUBSCRIPT, 3]];
  /** The pieces of the label of a root: "x+" or "x−" for sign '+' or '−', and "x+ = x−" for a double root (sign ''). */
  const rootLabel = sign => (sign ? xSub(sign) : xSub('+').concat([[' = ', FONT]], xSub('−')));

  /**
   * A canvas with data coordinates: margins, ranges, axes and clipped polylines.
   */
  class Frame {
    constructor(canvas, margins) {
      this.canvas = canvas;
      this.m = margins;
      this.x = [0, 1];
      this.y = [0, 1];
      this.w = this.h = 0;
    }

    /** Matches the pixel size of the canvas to the size of the element.  True if the size changed. */
    resize() {
      const box = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.round(box.width), h = Math.round(box.height);
      if (w === this.w && h === this.h && dpr === this.dpr) return false;
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      return true;
    }

    get left() { return this.m.l; }
    get right() { return this.w - this.m.r; }
    get top() { return this.m.t; }
    get bottom() { return this.h - this.m.b; }

    X(v) { return this.left + (v - this.x[0]) / (this.x[1] - this.x[0]) * (this.right - this.left); }
    Y(v) { return this.bottom - (v - this.y[0]) / (this.y[1] - this.y[0]) * (this.bottom - this.top); }

    /** Context of the canvas, cleared and scaled to CSS pixels. */
    begin() {
      const ctx = this.canvas.getContext('2d');
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
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
     * Grid, tick labels, frame and axis labels.  A label is the symbol of the quantity, set in italic.
     * With `zero` the lines x = 0 and y = 0 are drawn a little stronger.
     */
    axes(ctx, xLabel, yLabel, zero) {
      const { left, right, top, bottom } = this;
      const xStep = niceStep(this.x[1] - this.x[0], Math.max(2, (right - left) / 70));
      const yStep = niceStep(this.y[1] - this.y[0], Math.max(2, (bottom - top) / 60));
      ctx.lineWidth = 1; ctx.font = FONT; ctx.fillStyle = css('--tinta-2');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const value of multiples(this.x[0], this.x[1], xStep)) {
        const px = Math.round(this.X(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
        ctx.fillText(tickText(value, xStep), px, bottom + 5);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const value of multiples(this.y[0], this.y[1], yStep)) {
        const py = Math.round(this.Y(value)) + 0.5;
        ctx.strokeStyle = zero && value === 0 ? css('--eixo') : css('--grade');
        ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
        ctx.fillText(tickText(value, yStep), left - 6, py);
      }
      ctx.strokeStyle = css('--eixo');
      ctx.strokeRect(left + 0.5, top + 0.5, right - left, bottom - top);
      ctx.fillStyle = css('--tinta-2');
      write(ctx, [[xLabel, ITALIC]], right, this.h - 5, 'right');
      write(ctx, [[yLabel, ITALIC]], 4, top - 10, 'left');
    }

    /**
     * Polyline through (xs[i], ys[i]) for i from `from` to `to` (exclusive).  style: {color, width, dash}.
     * Points far outside the ranges break the line.
     */
    line(ctx, xs, ys, from, to, style) {
      const limit = 4 * Math.max(this.w, this.h);
      ctx.strokeStyle = style.color; ctx.lineWidth = style.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(style.dash || []);
      ctx.beginPath();
      let pen = false;
      for (let i = from; i < to; i++) {
        const px = this.X(xs[i]), py = this.Y(ys[i]);
        if (!isFinite(px) || !isFinite(py) || Math.abs(px) > limit || Math.abs(py) > limit) { pen = false; continue; }
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** A filled dot at the pixel (px, py), with a ring of the surface color around it: a root. */
  function disc(ctx, px, py, radius) {
    ctx.beginPath(); ctx.arc(px, py, radius + 2, 0, 2 * Math.PI); ctx.fillStyle = css('--painel'); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, radius, 0, 2 * Math.PI); ctx.fillStyle = css('--tinta'); ctx.fill();
  }

  /** An open dot at the pixel (px, py): the vertex of the parabola, the saddle of the surface. */
  function ring(ctx, px, py, radius) {
    ctx.beginPath(); ctx.arc(px, py, radius, 0, 2 * Math.PI);
    ctx.fillStyle = css('--painel'); ctx.fill();
    ctx.strokeStyle = css('--tinta'); ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
  }

  // ------------------------------------------------------------------------------------------ surface |y|

  /** Opacity of the surface where its upper face is seen, and where its lower face is. */
  const FACE = 0.88, UNDERSIDE = 0.2;
  /** Opacity of a mark that is behind an opaque part of the surface. */
  const FAINT = 0.45;
  /** The light: its direction in the frame of the screen (right, up, towards the viewer), and the ambient share. */
  const LIGHT = [-0.45, 0.55, 0.7], AMBIENT = 0.3;

  /**
   * Parallel projection of the box  u0 <= Re x <= u1,  v0 <= Im x <= v1,  0 <= |y| <= zMax  onto the canvas.
   *
   * Scene coordinates have their origin at the centre of the box:  X = u - uMid  and  Y = v - vMid  on the
   * complex plane, with one scale for both, and  Z = rise (z - zMax/2)  upwards, where rise = height / zMax
   * is the length given to one unit of |y|.  The box is seen from the elevation e above the plane and from the
   * azimuth a: for a = 0 the viewer looks along the imaginary axis, with the real axis pointing to the right of
   * the screen, and as a grows the box turns about the vertical, its near side moving to the right.  The three
   * unit vectors
   *
   *     right = ( cos a,       -sin a,        0     )     to the right of the screen
   *     up    = ( sin a sin e,  cos a sin e,  cos e )     up the screen
   *     out   = (-sin a cos e, -cos a cos e,  sin e )     from the scene towards the viewer
   *
   * are orthonormal, with right x up = out.  A point S of the scene goes to the pixel
   * (cx + scale S.right, cy - scale S.up).  The scale fits the eight corners of the box inside the margins of
   * the frame; it therefore changes as the box turns.
   *
   *   near, far    {u, v}: the sides of the box nearest to the viewer and farthest from it
   */
  class Camera {
    constructor(box, view, frame) {
      const ca = Math.cos(view.azimuth), sa = Math.sin(view.azimuth), ce = Math.cos(view.elevation), se = Math.sin(view.elevation);
      this.right = [ca, -sa, 0];
      this.up = [sa * se, ca * se, ce];
      this.out = [-sa * ce, -ca * ce, se];
      this.box = box;
      this.mid = [(box.u[0] + box.u[1]) / 2, (box.v[0] + box.v[1]) / 2, box.zMax / 2];
      this.rise = box.height / box.zMax;
      this.near = { u: box.u[this.out[0] >= 0 ? 1 : 0], v: box.v[this.out[1] >= 0 ? 1 : 0] };
      this.far = { u: box.u[this.out[0] >= 0 ? 0 : 1], v: box.v[this.out[1] >= 0 ? 0 : 1] };

      // Half-extents of the box along `right` and `up` (the box is symmetric about the origin of the scene).
      let a = 0, b = 0;
      for (const u of box.u) for (const v of box.v) for (const z of [0, box.zMax]) {
        const s = this.scene(u, v, z);
        a = Math.max(a, Math.abs(dot(s, this.right))); b = Math.max(b, Math.abs(dot(s, this.up)));
      }
      const m = frame.m, w = frame.w - m.l - m.r, h = frame.h - m.t - m.b;
      this.scale = Math.max(1, Math.min(w / (2 * a), h / (2 * b)));
      this.cx = m.l + w / 2; this.cy = m.t + h / 2;
    }

    /** Scene coordinates of the point (u, v) of the complex plane at the height z. */
    scene(u, v, z) {
      return [u - this.mid[0], v - this.mid[1], this.rise * (z - this.mid[2])];
    }

    /** Pixel of a point given in scene coordinates. */
    screen(s) {
      return [this.cx + this.scale * dot(s, this.right), this.cy - this.scale * dot(s, this.up)];
    }

    /** Pixel of the point (u, v) of the complex plane at the height z. */
    pixel(u, v, z) {
      return this.screen(this.scene(u, v, z));
    }

    /**
     * Direction on the screen (unit vector, y downwards) of the direction (du, dv) of the complex plane;
     * straight down if that direction points along the line of sight.
     */
    heading(du, dv) {
      const x = du * this.right[0] + dv * this.right[1], y = -(du * this.up[0] + dv * this.up[1]), length = Math.hypot(x, y);
      return length > 0.05 * Math.hypot(du, dv) ? [x / length, y / length] : [0, 1];
    }
  }

  /**
   * The part of a polygon at or below the height zMax (Sutherland-Hodgman, for one plane).
   * `points` are [u, v, z]; `edges[k]` is the kind of the edge from point k to the next: 0 not drawn, 1 a line
   * of the mesh, 2 an edge of the surface.  The edge left by the cut is of kind 2.  Null if nothing remains.
   */
  function below(points, edges, zMax) {
    const n = points.length, keptPoints = [], keptEdges = [];
    for (let k = 0; k < n; k++) {
      const A = points[k], B = points[(k + 1) % n], inA = A[2] <= zMax, inB = B[2] <= zMax;
      if (inA) { keptPoints.push(A); keptEdges.push(edges[k]); }
      if (inA !== inB) {
        const t = (zMax - A[2]) / (B[2] - A[2]);
        keptPoints.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), zMax]);
        keptEdges.push(inA ? 2 : edges[k]);         // leaving the surface: the next edge runs along the cut
      }
    }
    return keptPoints.length >= 3 ? { points: keptPoints, edges: keptEdges } : null;
  }

  /**
   * The surface z = |y(u + i v)| over the complex plane, with the plane itself, the roots and the scales.
   *
   * Hidden surfaces.  The surface is a mesh of flat cells, painted from the farthest to the nearest, so that a
   * cell covers what is behind it.  For a single-valued surface in parallel projection this order needs no
   * sorting: a point can only hide points that lie behind it along the line of sight, and those are, on the
   * plane, farther along the direction (-out_x, -out_y).  A cell (i, j) can therefore hide the cell (i', j')
   * only if (i', j') is not nearer than it along either axis, and running both indices from far to near
   * draws every cell after all those it can hide.
   *
   * The surface is a bowl, and its near wall stands between the viewer and the roots.  So a cell is painted
   * almost opaque where its upper face is seen, and almost transparent where the viewer looks at its lower
   * face: the inside of the bowl shows through the wall in front of it.  The roots and the saddle are marked
   * over everything, faint if an opaque cell is in front of them (see `marks`).
   */
  class Sheet {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 50, r: 50, t: 26, b: 48 });      // room for the scales around the box
    }

    draw(model) {
      const fr = this.area;
      if (!fr.w || !fr.h) return;
      const ctx = fr.begin(), cam = new Camera(model.box, model.view, fr);
      this.floor(ctx, cam);
      this.surface(ctx, cam, model);
      this.marks(ctx, cam, model);
      this.scales(ctx, cam);
    }

    /** Step of the scale of |y|: a tick about every 24 pixels of the vertical edges of the box, five at most. */
    riseStep(cam) {
      return niceStep(cam.box.zMax, Math.min(5, Math.max(2, cam.scale * cam.box.height * cam.up[2] / 24)));
    }

    /** Draws the open polyline through points [u, v, z]. */
    path(ctx, cam, points) {
      ctx.beginPath();
      points.forEach((p, k) => { const q = cam.pixel(p[0], p[1], p[2]); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    }

    /** The two walls of the box behind the surface, and the complex plane with its grid and axes. */
    floor(ctx, cam) {
      const { u, v, zMax } = cam.box, far = cam.far;
      const stroke = (points, color) => { this.path(ctx, cam, points); ctx.strokeStyle = color; ctx.stroke(); };
      ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.setLineDash([]);

      // Walls: a line at each tick of |y|, and the outline.
      const grade = css('--grade'), borda = css('--borda'), eixo = css('--eixo');
      for (const z of multiples(0, zMax, this.riseStep(cam))) {
        stroke([[far.u, v[0], z], [far.u, v[1], z]], grade);
        stroke([[u[0], far.v, z], [u[1], far.v, z]], grade);
      }
      stroke([[far.u, v[0], 0], [far.u, v[0], zMax], [far.u, v[1], zMax], [far.u, v[1], 0]], borda);
      stroke([[u[0], far.v, 0], [u[0], far.v, zMax], [u[1], far.v, zMax], [u[1], far.v, 0]], borda);

      // The plane |y| = 0: unit grid, the real and imaginary axes, and the outline.
      const corners = [[u[0], v[0], 0], [u[1], v[0], 0], [u[1], v[1], 0], [u[0], v[1], 0]];
      this.path(ctx, cam, corners); ctx.closePath(); ctx.fillStyle = css('--plano'); ctx.fill();
      for (const value of multiples(u[0], u[1], 1)) stroke([[value, v[0], 0], [value, v[1], 0]], value === 0 ? eixo : borda);
      for (const value of multiples(v[0], v[1], 1)) stroke([[u[0], value, 0], [u[1], value, 0]], value === 0 ? eixo : borda);
      this.path(ctx, cam, corners); ctx.closePath(); ctx.strokeStyle = eixo; ctx.stroke();
    }

    /** The surface, cell by cell from the farthest to the nearest, with the curves drawn on it. */
    surface(ctx, cam, model) {
      const { b, c, roots, vertex } = model, box = cam.box, zMax = box.zMax;
      const nu = Math.round((box.u[1] - box.u[0]) / box.step), nv = Math.round((box.v[1] - box.v[0]) / box.step);
      const hu = (box.u[1] - box.u[0]) / nu, hv = (box.v[1] - box.v[0]) / nv;
      const U = i => (box.u[0] * (nu - i) + box.u[1] * i) / nu, V = j => (box.v[0] * (nv - j) + box.v[1] * j) / nv;

      // Heights at the nodes of the mesh.
      const Z = new Float64Array((nu + 1) * (nv + 1));
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) Z[j * (nu + 1) + i] = P.modulus(b, c, U(i), V(j));
      const node = (i, j) => [U(i), V(j), Z[j * (nu + 1) + i]];

      // Order of drawing: each index runs towards the viewer (see the note on hidden surfaces above).
      const towardsU = cam.out[0] >= 0, towardsV = cam.out[1] >= 0;
      const order = (n, ascending) => Array.from({ length: n }, (_, k) => (ascending ? k : n - 1 - k));
      const turn = (i, j) => (towardsV ? j : nv - 1 - j) * nu + (towardsU ? i : nu - 1 - i);     // position of a cell in that order

      /** The cells whose footprint, edges included, holds the point (u, v): one, two (on a line of the mesh) or four (on a node). */
      const cellsAt = (u, v) => {
        const fu = (u - box.u[0]) / hu, fv = (v - box.v[0]) / hv, e = 1e-9, cells = [];
        for (const i of new Set([Math.floor(fu - e), Math.floor(fu + e)])) {
          for (const j of new Set([Math.floor(fv - e), Math.floor(fv + e)])) if (i >= 0 && i < nu && j >= 0 && j < nv) cells.push([i, j]);
        }
        return cells;
      };

      // A cell that holds a root is drawn as triangles that meet at the root, so that the surface comes down
      // to the plane exactly there, wherever the root is in the cell.  (If both roots are in one cell, no point
      // of it is farther than its diagonal from either, and |y| is below 2 step^2 all over it: one is enough.)
      const tip = new Map();          // index of a cell -> [u, v, 0] of the root in it
      for (const x of roots.kind === 'double' ? [roots.plus] : [roots.plus, roots.minus]) {
        for (const [i, j] of cellsAt(x.re, x.im)) tip.set(j * nu + i, [x.re, x.im, 0]);
      }

      /**
       * The polygons of the cell (i, j), as [points, edges] (see `below`), counterclockwise seen from above:
       * the cell itself or, around a root R, the triangles from R to each side of the cell.  A side on which R
       * lies gives no triangle, and the two halves of it are then edges of the neighbouring triangles.
       */
      const polygons = (i, j) => {
        const corners = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
        const sides = [j === 0 ? 2 : 1, i === nu - 1 ? 2 : 1, j === nv - 1 ? 2 : 1, i === 0 ? 2 : 1];
        const R = tip.get(j * nu + i);
        if (!R) return [[corners, sides]];
        const e = 1e-9, on = [Math.abs(R[1] - V(j)) < e * hv, Math.abs(R[0] - U(i + 1)) < e * hu, Math.abs(R[1] - V(j + 1)) < e * hv, Math.abs(R[0] - U(i)) < e * hu];
        const triangles = [];
        for (let k = 0; k < 4; k++) {
          if (on[k]) continue;
          const before = (k + 3) % 4, after = (k + 1) % 4;
          triangles.push([[R, corners[k], corners[after]], [on[before] ? sides[before] : 0, sides[k], on[after] ? sides[after] : 0]]);
        }
        // From the farthest to the nearest, like the cells.
        const towards = t => (t[0][0][0] + t[0][1][0] + t[0][2][0]) * cam.out[0] + (t[0][0][1] + t[0][1][1] + t[0][2][1]) * cam.out[1];
        return triangles.sort((p, q) => towards(p) - towards(q));
      };

      // Colors.  The light keeps its direction on the screen as the box turns.
      const bright = rgb(css('--folha-luz')), dark = rgb(css('--folha-sombra')), mesh = rgb(css('--malha')), edge = rgb(css('--eixo'));
      const norm = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]);
      const light = [0, 1, 2].map(k => (LIGHT[0] * cam.right[k] + LIGHT[1] * cam.up[k] + LIGHT[2] * cam.out[k]) / norm);
      const tint = (color, opacity) => mix(color, color, 0, opacity);
      const lines = {                 // by kind of edge (see `below`)
        1: { width: 0.6, face: tint(mesh, 0.5), underside: tint(mesh, 0.14) },
        2: { width: 1.1, face: tint(edge, 1), underside: tint(edge, 0.5) },
      };

      /** Paints one polygon: shaded by the angle between its normal and the light, then its edges. */
      const paint = (points, edges) => {
        const S = points.map(p => cam.scene(p[0], p[1], p[2])), n = S.length;
        // Normal, by Newell's formula (the sum of the cross products of consecutive vertices), turned upwards.
        let nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < n; k++) {
          const A = S[k], B = S[(k + 1) % n];
          nx += (A[1] - B[1]) * (A[2] + B[2]); ny += (A[2] - B[2]) * (A[0] + B[0]); nz += (A[0] - B[0]) * (A[1] + B[1]);
        }
        const length = Math.hypot(nx, ny, nz) * (nz < 0 ? -1 : 1);
        if (!(Math.abs(length) > 1e-14)) return;
        const normal = [nx / length, ny / length, nz / length];
        const face = dot(normal, cam.out) > 0;                              // the upper face is the one seen
        const lit = Math.max(0, (face ? 1 : -1) * dot(normal, light));

        const px = S.map(s => cam.screen(s));
        ctx.beginPath();
        px.forEach((q, k) => { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.closePath();
        ctx.fillStyle = mix(dark, bright, AMBIENT + (1 - AMBIENT) * lit, face ? FACE : UNDERSIDE);
        ctx.fill();
        for (const kind of [1, 2]) {
          let any = false;
          ctx.beginPath();
          for (let k = 0; k < n; k++) {
            if (edges[k] !== kind) continue;
            const A = px[k], B = px[(k + 1) % n];
            ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); any = true;
          }
          if (any) { ctx.lineWidth = lines[kind].width; ctx.strokeStyle = face ? lines[kind].face : lines[kind].underside; ctx.stroke(); }
        }
      };

      /**
       * A curve on the surface, over a straight line of the plane: `at(t)` gives the point (u, v) of the line,
       * and `stops` the values of t between which the curve is taken as straight.  Each piece is kept below
       * zMax and filed under the cell that is painted last among those it lies on, to be drawn right after it.
       */
      const pieces = new Map();       // index of a cell -> [[A, B, color], ...] with A and B as [u, v, z]
      const curve = (at, stops, color) => {
        const ts = Array.from(new Set(stops)).sort((p, q) => p - q);
        const point = t => { const q = at(t); return [q[0], q[1], P.modulus(b, c, q[0], q[1])]; };
        for (let k = 0; k + 1 < ts.length; k++) {
          let A = point(ts[k]), B = point(ts[k + 1]);
          if (A[2] > zMax && B[2] > zMax) continue;
          const cells = cellsAt((A[0] + B[0]) / 2, (A[1] + B[1]) / 2);
          if (!cells.length) continue;
          const cut = (inside, outside) => { const t = (zMax - inside[2]) / (outside[2] - inside[2]); return [0, 1, 2].map(m => inside[m] + t * (outside[m] - inside[m])); };
          if (A[2] > zMax) A = cut(B, A); else if (B[2] > zMax) B = cut(A, B);
          const owner = cells.reduce((best, cell) => (turn(cell[0], cell[1]) > turn(best[0], best[1]) ? cell : best));
          const index = owner[1] * nu + owner[0];
          if (!pieces.has(index)) pieces.set(index, []);
          pieces.get(index).push([A, B, color]);
        }
      };
      // The nodes of the mesh along a line and the points halfway between them: where a curve bends.
      const stopsAlong = (n, coordinate) => Array.from({ length: 2 * n + 1 }, (_, k) => (k % 2 ? (coordinate((k - 1) / 2) + coordinate((k + 1) / 2)) / 2 : coordinate(k / 2)));
      // Over the real axis, where |y| = |yv + (u - xv)^2|.
      curve(t => [t, 0], stopsAlong(nu, U).concat(roots.kind === 'complex' ? [] : [roots.minus.re, roots.plus.re]), css('--serie-1'));
      // Over the line Re x = xv, where |y| = |yv - v^2|.
      if (model.cut) curve(t => [vertex.x, t], stopsAlong(nv, V).concat(roots.kind === 'real' ? [] : [roots.minus.im, roots.plus.im]), css('--serie-2'));

      ctx.lineJoin = 'round'; ctx.setLineDash([]);
      const columns = order(nu, towardsU);
      for (const j of order(nv, towardsV)) {
        for (const i of columns) {
          const index = j * nu + i;
          const above = !tip.has(index) && Z[j * (nu + 1) + i] > zMax && Z[j * (nu + 1) + i + 1] > zMax && Z[(j + 1) * (nu + 1) + i] > zMax && Z[(j + 1) * (nu + 1) + i + 1] > zMax;
          if (!above) {
            for (const [points, edges] of polygons(i, j)) {
              const kept = below(points, edges, zMax);
              if (kept) paint(kept.points, kept.edges);
            }
          }
          for (const [A, B, color] of pieces.get(index) || []) {
            this.path(ctx, cam, [A, B]);
            ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
          }
        }
      }
      ctx.lineCap = 'butt';
    }

    /**
     * The saddle of the surface and the roots, the points where the surface touches the plane, with their labels.
     * They are drawn over the surface; one that is behind an opaque part of it is drawn faint.
     */
    marks(ctx, cam, model) {
      const { b, c, roots, vertex } = model, box = cam.box, paper = css('--painel');

      /**
       * True if the point (u, v, z) of the surface is behind a part of the surface that shows its upper face.
       * Along the line of sight, from the point towards the viewer, the height of the line minus that of the
       * surface changes from negative to positive where the line comes out through the upper face.  (A change
       * the other way is where the line goes under the surface, whose lower face is drawn transparent.)
       * The search ends where the line leaves the box.
       */
      const hidden = (u, v, z) => {
        const rate = [cam.out[0], cam.out[1], cam.out[2] / cam.rise], ds = box.step / 4;
        let before = 0;
        for (let s = ds; ; s += ds) {
          const pu = u + s * rate[0], pv = v + s * rate[1], pz = z + s * rate[2];
          if (pz > box.zMax || pu < box.u[0] || pu > box.u[1] || pv < box.v[0] || pv > box.v[1]) return false;
          const gap = pz - P.modulus(b, c, pu, pv);
          if (before < 0 && gap > 0) return true;
          before = gap;
        }
      };
      /** Draws with the opacity of a point at (u, v, z): full, or FAINT if it is hidden. */
      const show = (u, v, z, draw) => {
        ctx.globalAlpha = hidden(u, v, z) ? FAINT : 1;
        draw(cam.pixel(u, v, z));
        ctx.globalAlpha = 1;
      };

      if (roots.kind !== 'double' && Math.abs(vertex.y) <= box.zMax) show(vertex.x, 0, Math.abs(vertex.y), q => ring(ctx, q[0], q[1], 3.5));

      /** A root and its label (see `rootLabel`), which goes (dx, dy) away from it. */
      const root = (x, sign, dx, dy) => show(x.re, x.im, 0, q => {
        disc(ctx, q[0], q[1], 4.5);
        ctx.fillStyle = css('--tinta');
        write(ctx, rootLabel(sign), q[0] + dx, q[1] + dy + 4, dx > 6 ? 'left' : dx < -6 ? 'right' : 'center', paper);
      });
      if (roots.kind === 'double') {
        // Both curves pass through the root: the label goes between them, on the side that is lowest on the screen.
        const re = cam.heading(1, 0), im = cam.heading(0, 1);
        let best = [0, 1], lowest = -Infinity;
        for (const s of [1, -1]) for (const t of [1, -1]) {
          const d = [s * re[0] + t * im[0], s * re[1] + t * im[1]], length = Math.hypot(d[0], d[1]);
          if (length > 1e-6 && d[1] / length > lowest) { lowest = d[1] / length; best = [d[0] / length, d[1] / length]; }
        }
        root(roots.plus, '', 24 * best[0], 24 * best[1]);
        return;
      }
      // Each label goes to one side of the line through the two roots (the side that is lower on the screen,
      // clear of the curve that passes through them) and a little beyond its root, away from the other one.
      const from = cam.pixel(roots.minus.re, roots.minus.im, 0), to = cam.pixel(roots.plus.re, roots.plus.im, 0);
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const along = length > 1 ? [(to[0] - from[0]) / length, (to[1] - from[1]) / length] : [1, 0];      // from x− to x+
      const aside = along[0] > 0 ? [-along[1], along[0]] : [along[1], -along[0]];       // perpendicular, with y >= 0
      root(roots.minus, '−', 13 * aside[0] - 10 * along[0], 13 * aside[1] - 10 * along[1]);
      root(roots.plus, '+', 13 * aside[0] + 10 * along[0], 13 * aside[1] + 10 * along[1]);
    }

    /** Ticks and names of the three axes, outside the box. */
    scales(ctx, cam) {
      const { u, v, zMax } = cam.box, near = cam.near, far = cam.far;
      ctx.lineWidth = 1; ctx.setLineDash([]); ctx.fillStyle = css('--tinta-2'); ctx.strokeStyle = css('--eixo');
      /**
       * Scale along one edge of the plane: `point(t)` is the pixel of the edge at the value t, (du, dv) the
       * direction of the plane that points out of the box there, and `name` the pieces of the name of the axis,
       * which goes halfway between two ticks, farther out than their labels.
       */
      const edge = (range, point, du, dv, name) => {
        const n = cam.heading(du, dv), first = point(range[0]), last = point(range[1]);
        // A tick about every 45 pixels of the edge on the screen, five at most.
        const step = niceStep(range[1] - range[0], Math.min(5, Math.max(2, Math.hypot(last[0] - first[0], last[1] - first[1]) / 45)));
        ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const t of multiples(range[0], range[1], step)) {
          const q = point(t);
          ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + 5 * n[0], q[1] + 5 * n[1]); ctx.stroke();
          ctx.fillText(tickText(t, step), q[0] + 15 * n[0], q[1] + 15 * n[1]);
        }
        const q = point((range[0] + range[1] + step) / 2);
        write(ctx, name, q[0] + 31 * n[0], q[1] + 31 * n[1] + 4, 'center');
      };
      const outwards = (nearValue, range) => (nearValue === range[1] ? 1 : -1);
      edge(u, t => cam.pixel(t, near.v, 0), 0, outwards(near.v, v), [['Re ', FONT], ['x', ITALIC]]);
      edge(v, t => cam.pixel(near.u, t, 0), outwards(near.u, u), 0, [['Im ', FONT], ['x', ITALIC]]);

      // |y|: on the free vertical edge of a wall, the one more to the left of the screen.  Its zero is the plane.
      const one = cam.pixel(far.u, near.v, 0), other = cam.pixel(near.u, far.v, 0);
      const [eu, ev] = one[0] <= other[0] ? [far.u, near.v] : [near.u, far.v];
      const foot = cam.pixel(eu, ev, 0), top = cam.pixel(eu, ev, zMax);
      if (foot[1] - top[1] < 30) return;                    // seen from above, the edge is too short for a scale
      const step = this.riseStep(cam);
      ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const z of multiples(0, zMax, step)) {
        const q = cam.pixel(eu, ev, z);
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - 5, q[1]); ctx.stroke();
        if (z > 0) ctx.fillText(tickText(z, step), q[0] - 8, q[1]);
      }
      write(ctx, [['|', FONT], ['y', ITALIC], ['|', FONT]], top[0] - 4, top[1] - 12, 'right');
    }
  }

  // ------------------------------------------------------------------------------------------ y for x real

  class RealLine {
    constructor(canvas) {
      this.area = new Frame(canvas, { l: 46, r: 12, t: 24, b: 34 });
    }

    draw(model) {
      const fr = this.area;
      if (!fr.w || !fr.h) return;
      const { b, c, roots, vertex, box } = model, ctx = fr.begin();
      fr.x = box.u; fr.y = [-box.zMax, box.zMax];
      fr.axes(ctx, 'x', 'y', true);
      fr.clip(ctx);

      const sample = (from, to, n, sign) => {
        const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
        for (let k = 0; k <= n; k++) { xs[k] = from + (to - from) * k / n; ys[k] = sign * P.value(b, c, xs[k], 0)[0]; }
        return [xs, ys];
      };
      const blue = css('--serie-1');
      // |y| where it differs from y: between the two real roots.
      if (roots.kind === 'real') {
        const [xs, ys] = sample(roots.minus.re, roots.plus.re, 80, -1);
        fr.line(ctx, xs, ys, 0, xs.length, { color: blue, width: 1.3, dash: [5, 4] });
      }
      const [xs, ys] = sample(fr.x[0], fr.x[1], 240, 1);
      fr.line(ctx, xs, ys, 0, xs.length, { color: blue, width: 2.2 });

      // The vertex, and the zeros of y.
      ring(ctx, fr.X(vertex.x), fr.Y(vertex.y), 3.5);
      if (roots.kind !== 'complex') {
        const mark = (x, sign, align) => {
          const px = fr.X(x), py = fr.Y(0);
          disc(ctx, px, py, 4.5);
          ctx.fillStyle = css('--tinta');
          // Below the axis, on the side of the root where the curve is above it; turned inwards at the edge of the plot.
          const room = align === 'right' ? px - fr.left : fr.right - px, side = room < 26 ? (align === 'right' ? 'left' : 'right') : align;
          write(ctx, rootLabel(sign), px + (side === 'center' ? 0 : side === 'right' ? -7 : 7), py + 17, side, css('--painel'));
        };
        if (roots.kind === 'double') mark(roots.plus.re, '', 'center');
        else { mark(roots.minus.re, '−', 'right'); mark(roots.plus.re, '+', 'left'); }
      }
      ctx.restore();
    }
  }

  root.Graficos = { Sheet, RealLine };
})(window);
