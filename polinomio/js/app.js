// By Bruno Mota - METAbio
/**
 * The page: controls, state and drawing.
 *
 * How it works.  The two sliders give b and c.  Whenever one moves, the model (roots and vertex) is rebuilt and
 * both plots are redrawn whole.  Dragging on the surface turns it: only that plot is redrawn then.
 *
 *   BOX, VIEW    what the plots show; where the surface is seen from when the page opens
 *   GROUPS       the controls: symbol, range, step and default value of each, and the caption of the group
 *   compute()    builds the model from the controls
 *   decorate()   colored segments and marks of the bars: where the roots are real and where complex
 *   formulas()   polynomial, roots and vertex, rendered by KaTeX; legends and notes
 *   tick()       loop: recomputes and redraws when something changed
 */
(function () {
  'use strict';
  const P = window.Polinomio, Fm = window.Formulas, G = window.Graficos, C = window.Controles;
  const $ = id => document.getElementById(id);
  const radians = degrees => degrees * Math.PI / 180;

  /**
   * What the plots show (see graficos.js): ranges of Re x and Im x, largest |y|, side of a cell of the mesh of
   * the surface, height of the box.  With the ranges of the sliders below (|b| <= 3, -3 <= c <= 4), the box
   * holds every root, |Re x| <= |b|/2 + sqrt(b^2/4 - c) <= 1.5 + sqrt(5.25) and |Im x| <= sqrt(c) <= 2, and
   * every saddle, whose height is |c - b^2/4| <= 5.25.  Over the line Re x = -b/2 the surface stays below zMax
   * for (Im x)^2 <= zMax + c - b^2/4 <= 12: the range of Im x holds that too.
   */
  const BOX = { u: [-4, 4], v: [-3.5, 3.5], zMax: 8, step: 0.25, height: 2.2 };
  /**
   * Where the surface is seen from when the page opens: azimuth and elevation, in degrees (see Camera in
   * graficos.js).  Near a simple root the surface is a cone of slope |x1 - x2|, drawn with the slope
   * |x1 - x2| height / zMax; seen from an elevation below that slope, a root can be hidden by the side of its
   * own cone.  For complex roots |x1 - x2| = 2 sqrt(c - b^2/4) <= 4, and tan(48 deg) = 1.11 >= 4 x 2.2 / 8:
   * from this elevation no complex root is hidden, whatever the azimuth.
   */
  const VIEW = { azimuth: -25, elevation: 48 };
  /** Range of the elevation (degrees); radians turned per pixel dragged, and per press of an arrow key. */
  const ELEVATION = [12, 90], TURN = 0.008, KEY_TURN = radians(5);

  /** The groups of controls.  `caption` lists [class of the segment, text]. */
  const GROUPS = [
    { title: 'Coeficientes', controls: [
      { id: 'b', symbol: 'b', name: 'coeficiente de x', unit: '', min: -3, max: 3, step: 0.05, value: 1, decimals: 2 },
      { id: 'c', symbol: 'c', name: 'termo independente', unit: '', min: -3, max: 4, step: 0.05, value: 2, decimals: 2 },
    ], caption: [['reais', 'raízes reais'], ['complexas', 'raízes complexas']] },
  ];

  const controls = {};                      // id -> Controles.Control
  const state = {
    view: { azimuth: radians(VIEW.azimuth), elevation: radians(VIEW.elevation) },
    cut: true,                              // draw the section of the surface along the line Re x = -b/2
  };
  let model = null;                         // see graficos.js
  let stale = true;                         // the controls changed: the model must be recomputed
  let turned = false;                       // the view changed: the surface must be redrawn
  let sheet = null, plots = [];

  // ------------------------------------------------------------------------------------------ model

  /** Builds the model from the values of the controls. */
  function compute() {
    const b = controls.b.value, c = controls.c.value;
    model = { b, c, roots: P.roots(b, c), vertex: P.vertex(b, c), box: BOX, view: state.view, cut: state.cut };
  }

  // ------------------------------------------------------------------------------------------ bars

  /**
   * Segments and marks of the two bars.  The discriminant b^2 - 4c vanishes at |b| = 2 sqrt(c) and at
   * c = b^2/4: each bar is split there into the stretch where the roots are real and the one where they are
   * complex, with a mark that catches the slider, so that the double root can be selected exactly.
   * The mark at zero loses its label when a critical mark is too close to it for both to be read.
   */
  function decorate() {
    const { b, c } = model, barB = controls.b, barC = controls.c;
    const critical = (at, label) => ({ at, label: label === false ? '' : 'Δ = 0', snap: true });
    const zero = crowded => ({ at: 0, label: crowded ? '' : '0', snap: true, kind: crowded ? 'fina' : '' });
    const all = (bar, kind) => [{ from: bar.spec.min, to: bar.spec.max, kind }];

    const edge = P.criticalB(c);
    if (edge === null) barB.decorate(all(barB, 'reais'), [zero(false)]);
    else if (edge === 0) barB.decorate(all(barB, 'reais'), [critical(0)]);
    else {
      const gap = barB.fraction(edge) - barB.fraction(0);
      barB.decorate([{ from: barB.spec.min, to: -edge, kind: 'reais' }, { from: -edge, to: edge, kind: 'complexas' }, { from: edge, to: barB.spec.max, kind: 'reais' }],
        [critical(-edge, gap >= 0.07), zero(gap < 0.11), critical(edge)]);
    }

    const level = P.criticalC(b);
    const split = [{ from: barC.spec.min, to: level, kind: 'reais' }, { from: level, to: barC.spec.max, kind: 'complexas' }];
    if (level === 0) barC.decorate(split, [critical(0)]);
    else barC.decorate(split, [zero(Math.abs(barC.fraction(level) - barC.fraction(0)) < 0.11), critical(level)]);
  }

  // ------------------------------------------------------------------------------------------ formulas

  const rendered = new Map();               // element -> LaTeX it currently shows

  /** Renders LaTeX into an element, unless it already shows it. */
  function tex(element, source, display) {
    if (rendered.get(element) === source) return;
    rendered.set(element, source);
    if (source) C.math(element, source, display !== false);
    else element.textContent = '';
  }

  /** Shows a list of short formulas, each in its own box so that the list wraps between them. */
  function texList(element, sources) {
    const key = sources.join('\n');
    if (rendered.get(element) === key) return;
    rendered.set(element, key);
    element.textContent = '';
    for (const source of sources) {
      const item = document.createElement('span');
      C.math(item, source);
      element.appendChild(item);
    }
  }

  /** Polynomial, roots, vertex, legends and notes: everything written that depends on the model. */
  function formulas() {
    const { b, c, roots, vertex } = model, polynomial = Fm.polynomial(b, c), r = Fm.roots(roots, vertex);
    tex($('polSimbolico'), polynomial.symbolic);
    tex($('polNumerico'), polynomial.numeric);
    $('regime').textContent = r.regime;
    $('regime').dataset.regime = roots.kind;
    tex($('raizFormula'), r.formula);
    texList($('raizValores'), r.values);
    texList($('verticeValores'), Fm.vertex(vertex));
    $('retaNota').textContent = r.note;

    // Legends follow what the plots show.
    $('legSela').hidden = roots.kind === 'double';
    $('legModulo').hidden = roots.kind !== 'real';
    $('legZero').hidden = roots.kind === 'complex';

    // What the two plots show, in words, for those who cannot see them.
    $('folha').setAttribute('aria-label', 'Superfície do módulo de y sobre o plano complexo de x. Ela toca o plano em ' + r.spoken + '.');
    $('reta').setAttribute('aria-label', 'Gráfico de y para x real. ' + r.note);
  }

  // ------------------------------------------------------------------------------------------ loop

  function tick() {
    let resized = false;
    for (const plot of plots) resized = plot.area.resize() || resized;
    if (stale) {
      compute();
      decorate();
      formulas();
    }
    if (stale || resized) for (const plot of plots) plot.draw(model);
    else if (turned) sheet.draw(model);
    stale = turned = false;
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------------------------------ interaction

  /**
   * Dragging on the surface turns it, and so do the arrow keys when it has the focus: sideways about the
   * vertical, up and down between the lowest elevation and the view from straight above.
   */
  function turnWith(canvas) {
    const turn = (azimuth, elevation) => {
      const view = state.view, [lowest, highest] = ELEVATION.map(radians);
      view.azimuth += azimuth;
      view.elevation = Math.min(highest, Math.max(lowest, view.elevation + elevation));
      turned = true;
    };
    let last = null;                        // where the pointer was, while it is down
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      last = [event.clientX, event.clientY];
    });
    canvas.addEventListener('pointermove', event => {
      if (!last) return;
      turn((event.clientX - last[0]) * TURN, (event.clientY - last[1]) * TURN);
      last = [event.clientX, event.clientY];
    });
    const release = () => { last = null; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('keydown', event => {
      const step = { ArrowLeft: [-KEY_TURN, 0], ArrowRight: [KEY_TURN, 0], ArrowUp: [0, KEY_TURN], ArrowDown: [0, -KEY_TURN] }[event.key];
      if (!step) return;
      turn(step[0], step[1]);
      event.preventDefault();
    });
  }

  /** Builds the controls of one group inside a fieldset: title, sliders, caption. */
  function buildGroup(group, host) {
    const box = document.createElement('fieldset');
    host.appendChild(box);
    box.appendChild(Object.assign(document.createElement('legend'), { textContent: group.title }));
    for (const spec of group.controls) controls[spec.id] = new C.Control(box, spec, () => { stale = true; });
    if (group.caption) {
      const list = document.createElement('ul');
      list.className = 'legenda do-grupo';
      for (const [kind, text] of group.caption) {
        const item = document.createElement('li');
        item.innerHTML = '<i class="amostra ' + kind + '"></i>';
        item.appendChild(Object.assign(document.createElement('span'), { textContent: text }));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
  }

  function start() {
    for (const group of GROUPS) buildGroup(group, $('controles'));
    for (const element of document.querySelectorAll('.m')) C.math(element, element.textContent, element.tagName === 'DIV');
    C.math($('alturaMaxima'), '|y| = ' + String(BOX.zMax).replace('.', '{,}'));

    sheet = new G.Sheet($('folha'));
    plots = [sheet, new G.RealLine($('reta'))];
    turnWith($('folha'));
    $('vistaInicial').addEventListener('click', () => {
      state.view.azimuth = radians(VIEW.azimuth); state.view.elevation = radians(VIEW.elevation);
      turned = true;
    });
    $('corte').addEventListener('change', event => { state.cut = event.target.checked; stale = true; });

    // The plots take their colors from the page: redraw when the theme changes or the fonts arrive.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { stale = true; });
    new MutationObserver(() => { stale = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stale = true; });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
