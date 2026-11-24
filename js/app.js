// By Bruno Mota - METAbio
/**
 * The page: controls, state and animation.
 *
 * How it works.  The whole solution from t = 0 to T is computed whenever a control changes (a few
 * milliseconds), and the three plots show all of it at once; the animation only moves a time cursor along
 * it.  Dragging a control therefore redraws the complete phase portrait, energy curves and x(t) as it moves.
 *
 *   GROUPS      the controls: symbol, range, step and default value of each
 *   EXAMPLES    the configurations offered in the "Exemplos" menu
 *   compute()   builds the model (numerical solution, energies, closed form, equilibria, view) from the controls
 *   decorate()  colored segments and marks of the bars: damping regimes, resonance, shape of the potential
 *   formulas()  equation of motion and solution, rendered by KaTeX
 *   tick()      animation loop: recomputes if needed, advances the time cursor, redraws
 */
(function () {
  'use strict';
  const F = window.Fisica, Fm = window.Formulas, G = window.Graficos;
  const $ = id => document.getElementById(id);

  const GROUPS = [
    { title: 'Oscilador', controls: [
      { id: 'M', symbol: 'M', name: 'massa', unit: 'kg', min: 0.1, max: 5, step: 0.05, value: 1, decimals: 2 },
      { id: 'k', symbol: 'k', name: 'constante elástica', unit: 'N/m', min: 0.5, max: 20, step: 0.1, value: 4, decimals: 2 },
      { id: 'b', symbol: 'b', name: 'amortecimento', unit: 'kg/s', min: 0, max: 10, step: 0.05, value: 0.4, decimals: 2 },
    ] },
    { title: 'Termos anarmônicos', controls: [
      { id: 'l3', symbol: '\\lambda_3', name: 'cúbico', unit: 'N/m²', min: -5, max: 5, step: 0.05, value: 0, decimals: 2 },
      { id: 'l4', symbol: '\\lambda_4', name: 'quártico', unit: 'N/m³', min: -5, max: 5, step: 0.05, value: 0, decimals: 2 },
    ] },
    { title: 'Força externa', controls: [
      { id: 'F0', symbol: 'F_0', name: 'amplitude', unit: 'N', min: 0, max: 5, step: 0.05, value: 0, decimals: 2 },
      { id: 'w', symbol: '\\omega', name: 'frequência angular', unit: 'rad/s', min: 0, max: 10, step: 0.02, value: 2, decimals: 2 },
    ] },
    { title: 'Condições iniciais', controls: [
      { id: 'x0', symbol: 'x_0', name: 'posição', unit: 'm', min: -3, max: 3, step: 0.05, value: 1, decimals: 2 },
      { id: 'p0', symbol: 'p_0', name: 'momento', unit: 'kg·m/s', min: -6, max: 6, step: 0.05, value: 0, decimals: 2 },
    ] },
    { title: 'Tempo', controls: [
      { id: 'T', symbol: 'T', name: 'duração', unit: 's', min: 10, max: 120, step: 5, value: 30, decimals: 0 },
    ] },
  ];

  /** Each example lists only what differs from the first one. */
  const EXAMPLES = [
    { name: 'Subamortecido', M: 1, k: 4, b: 0.4, l3: 0, l4: 0, F0: 0, w: 2, x0: 1, p0: 0, T: 30 },
    { name: 'Livre, sem amortecimento', b: 0 },
    { name: 'Amortecimento crítico', b: 4, T: 10 },
    { name: 'Superamortecido', b: 8, T: 10 },
    { name: 'Forçado: ressonância', F0: 1, w: 2, x0: 0, T: 40 },
    { name: 'Forçado, sem amortecimento: batimentos', b: 0, F0: 1, w: 1.8, x0: 0, T: 70 },
    { name: 'Ressonância sem amortecimento', b: 0, F0: 0.5, w: 2, x0: 0, T: 40 },
    { name: 'Quártico: mola que endurece', b: 0, l4: 3, x0: 1.5, T: 20 },
    { name: 'Quártico forçado (Duffing)', b: 0.3, l4: 2, F0: 2.5, w: 2.6, x0: 0, T: 80 },
    { name: 'Dois poços', k: 1, b: 0.05, l3: -3, l4: 1.5, x0: 2.4, T: 60 },
    { name: 'Cúbico: oscilação assimétrica', b: 0, l3: -1.5, x0: 1.6, T: 20 },
    { name: 'Cúbico: escape', b: 0, l3: -1.5, x0: -1.8, T: 20 },
  ];

  const controls = {};                      // id -> Controles.Control
  const state = { t: 0, playing: true, speed: 1, components: true, frozen: null };
  let model = null;                         // see graficos.js
  let stale = true;                         // the controls changed: the model must be recomputed
  let redraw = true;                        // the screen must be redrawn
  let plots = [];

  // ------------------------------------------------------------------------------------------ model

  /** Number of leading samples of the solution with |x| <= limit. */
  function samplesInside(sol, limit) {
    for (let i = 0; i < sol.n; i++) if (Math.abs(sol.x[i]) > limit) return Math.max(i, 1);
    return sol.n;
  }

  /**
   * Half-widths of the phase diagram.  They follow the trajectory.  If the mass escapes, the trajectory is
   * unbounded: the diagram then extends to 1.6 times the distance of the farthest barrier (unstable
   * equilibrium), which shows the well, the barrier and the beginning of the runaway.  (Just beyond 1.5
   * times that distance the potential of the cubic case is back to its value at the bottom of the well.)
   */
  function viewOf(m) {
    let limit = Infinity;
    if (m.sol.escaped) {
      const barriers = m.eq.filter(e => !e.stable).map(e => Math.abs(e.x));
      limit = Math.max(1.6 * Math.max.apply(null, barriers), 1.5 * Math.abs(m.x0), 0.5);
    }
    const nView = samplesInside(m.sol, limit);
    let xm = 0, pm = 0;
    for (let i = 0; i < nView; i++) { xm = Math.max(xm, Math.abs(m.sol.x[i])); pm = Math.max(pm, Math.abs(m.sol.p[i])); }
    if (m.sol.escaped) xm = limit;
    return { xr: G.niceCeil(Math.max(1.04 * xm, 0.1)), pr: G.niceCeil(Math.max(1.04 * pm, 0.1)), nView };
  }

  /** Builds the model from the values of the controls. */
  function compute() {
    const P = {};
    for (const id of ['M', 'k', 'b', 'l3', 'l4', 'F0', 'w']) P[id] = controls[id].value;
    const x0 = controls.x0.value, p0 = controls.p0.value, T = controls.T.value;
    const sol = F.integrate(P, x0, p0, T);
    model = {
      P, D: F.derived(P), x0, p0, T, sol,
      en: F.energies(P, sol),
      an: F.analytic(P, x0, p0),
      steady: F.steadyState(P),
      eq: F.equilibria(P),
      components: state.components,
      index: 0,
    };
    // While the initial condition is being dragged the axes stay put, so the point follows the pointer.
    model.view = state.frozen
      ? { xr: state.frozen.xr, pr: state.frozen.pr, nView: samplesInside(sol, 3 * state.frozen.xr) }
      : viewOf(model);
    // The time cursor runs to the end of the solution, or to the instant an escaping mass leaves the diagram.
    model.tEnd = sol.t[model.view.nView - 1];
    model.tEscape = sol.escaped ? sol.t[sol.n - 1] : null;
    state.t = Math.min(state.t, model.tEnd);
    $('tempo').max = model.tEnd;
  }

  // ------------------------------------------------------------------------------------------ bars

  /**
   * Segments and marks of the bars.
   *
   *   b        underdamped below the critical value 2 sqrt(k M), overdamped above; mark at the critical value
   *   k, M     the same boundary seen from k and from M (critical at k = b^2/4M and at M = b^2/4k);
   *            the oscillator is overdamped BELOW these values
   *   w        marks at the natural frequency w0 and at the frequency of largest amplitude w_R;
   *            band w0 +- gamma, the half-width of the resonance (shown only when there is a resonance)
   *   l3, l4   where the potential has a second well, and where it does not confine the mass
   *
   * The damping and resonance marks describe the linear part of the force: with anharmonic terms they hold
   * for small amplitudes.
   */
  function decorate() {
    const { P, D } = model, c = controls, damped = P.b > 0;
    const critical = at => ({ at, label: 'crítico', snap: true });

    c.b.decorate([{ from: 0, to: D.bc, kind: 'sub' }, { from: D.bc, to: c.b.spec.max, kind: 'super' }], [critical(D.bc)]);
    c.k.decorate(damped ? [{ from: c.k.spec.min, to: D.kc, kind: 'super' }, { from: D.kc, to: c.k.spec.max, kind: 'sub' }] : [],
      damped ? [critical(D.kc)] : []);
    c.M.decorate(damped ? [{ from: c.M.spec.min, to: D.Mc, kind: 'super' }, { from: D.Mc, to: c.M.spec.max, kind: 'sub' }] : [],
      damped ? [critical(D.Mc)] : []);

    const marks = [{ at: D.w0, label: 'ω<sub>0</sub>', snap: true }];
    if (D.wr !== null) {
      const apart = Math.abs(c.w.fraction(D.w0) - c.w.fraction(D.wr)) > 0.09;
      marks.push({ at: D.wr, label: apart ? 'ω<sub>R</sub>' : '', snap: true, kind: 'fina' });
    }
    c.w.decorate(D.wr !== null ? [{ from: D.w0 - D.gamma, to: D.w0 + D.gamma, kind: 'res' }] : [], marks);

    const zero = { at: 0, label: '0', snap: true };
    if (P.l4 > 0) {
      const edge = 2 * Math.sqrt(P.k * P.l4);           // |l3| above which k + l3 x + l4 x^2 has real roots
      c.l3.decorate([{ from: c.l3.spec.min, to: -edge, kind: 'pocos' }, { from: edge, to: c.l3.spec.max, kind: 'pocos' }], [zero]);
    } else {
      c.l3.decorate([{ from: c.l3.spec.min, to: c.l3.spec.max, kind: 'escape' }], [zero]);
    }
    const l4 = [{ from: c.l4.spec.min, to: 0, kind: 'escape' }];
    if (P.l3 !== 0) l4.push({ from: 0, to: P.l3 * P.l3 / (4 * P.k), kind: 'pocos' });
    c.l4.decorate(l4, [zero]);
  }

  // ------------------------------------------------------------------------------------------ formulas

  const rendered = new Map();               // element -> LaTeX it currently shows

  /** Renders LaTeX into an element, unless it already shows it. */
  function tex(element, source, display) {
    if (rendered.get(element) === source) return;
    rendered.set(element, source);
    if (source) window.Controles.math(element, source, display !== false);
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
      window.Controles.math(item, source);
      element.appendChild(item);
    }
  }

  function formulas() {
    const { P, D, an } = model;
    const eq = Fm.equation(P), s = Fm.solution(P, D, an);
    tex($('eqSimbolica'), eq.symbolic);
    tex($('eqNumerica'), eq.numeric);
    $('regime').textContent = (D.harmonic ? '' : 'parte linear: ') + s.regime;
    $('regime').dataset.regime = D.regime;
    tex($('solFormula'), s.formula || '');
    texList($('solDefinicoes'), s.definitions);
    texList($('solValores'), s.values);
    $('solNota').textContent = s.note;

    // Legends follow what the plots show.
    const forcedLinear = !!an && an.particular !== 'none';
    $('legAnalitica').hidden = !an;
    $('legTransiente').hidden = $('legParticular').hidden = !(forcedLinear && state.components);
    $('opcaoComponentes').hidden = !forcedLinear;
    $('nomeHomogenea').textContent = D.gamma > 0 ? 'transiente' : 'solução homogênea';
    $('nomeParticular').textContent = D.gamma > 0 ? 'regime estacionário' : 'solução particular';
    $('legEstacionario').hidden = !(model.steady && D.harmonic && D.gamma > 0 && P.w > 0);
    $('legSeparatriz').hidden = $('legInstavel').hidden = !model.eq.some(e => !e.stable);

    const aviso = $('aviso');
    aviso.hidden = !model.sol.escaped;
    if (model.sol.escaped) {
      aviso.textContent = 'A massa ultrapassa a barreira do potencial e não volta: x → ∞ em t ≈ ' +
        Fm.fixed(model.tEscape, 2) + ' s. O potencial não é confinante.';
    }
  }

  /** Values under the time cursor. */
  function readout() {
    const i = model.index, s = model.sol;
    const items = ['t = ' + Fm.fixed(s.t[i], 2) + ' s', 'x = ' + Fm.text(s.x[i]) + ' m', 'p = ' + Fm.text(s.p[i]) + ' kg·m/s',
      'E = ' + Fm.text(model.en.E[i]) + ' J'];
    const html = items.map(item => '<span>' + item + '</span>').join('');
    if (readout.shown !== html) { $('leitura').innerHTML = html; readout.shown = html; }
  }

  // ------------------------------------------------------------------------------------------ animation

  function setPlaying(on) {
    state.playing = on;
    $('tocar').textContent = on ? 'Pausar' : 'Reproduzir';
  }

  let lastTime = null;
  function tick(now) {
    if (state.playing && lastTime !== null && model) {
      state.t += Math.min(0.1, (now - lastTime) / 1000) * state.speed;
      if (state.t >= model.tEnd) { state.t = model.tEnd; setPlaying(false); }
      redraw = true;
    }
    lastTime = now;

    let resized = false;
    for (const plot of plots) resized = plot.area.resize() || resized;
    if (stale) { compute(); decorate(); formulas(); }
    if (stale || resized) { for (const plot of plots) plot.render(model); redraw = true; }
    stale = false;
    if (redraw) {
      model.index = Math.min(Math.round(state.t / model.sol.dt), model.sol.n - 1);
      for (const plot of plots) plot.update(model);
      readout();
      $('tempo').value = state.t;
      redraw = false;
    }
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------------------------------ interaction

  /** Dragging on the phase diagram chooses the initial condition. */
  function dragInitialCondition(phase) {
    const canvas = phase.area.canvas;
    const place = event => {
      const q = phase.area.at(event);
      const round = (v, spec) => Math.round(v / spec.step) * spec.step;
      controls.x0.set(round(q.x, controls.x0.spec));
      controls.p0.set(round(q.y, controls.p0.spec));
      stale = true;
    };
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      state.frozen = model.view;
      state.t = 0;
      place(event);
    });
    canvas.addEventListener('pointermove', event => { if (state.frozen) place(event); });
    const release = () => { if (state.frozen) { state.frozen = null; stale = true; } };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  /** Dragging on a time plot moves the time cursor. */
  function dragTime(plot) {
    const canvas = plot.area.canvas;
    let dragging = false, wasPlaying = false;
    const place = event => { state.t = Math.min(model.tEnd, Math.max(0, plot.area.at(event).x)); redraw = true; };
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      dragging = true; wasPlaying = state.playing; setPlaying(false);
      place(event);
    });
    canvas.addEventListener('pointermove', event => { if (dragging) place(event); });
    const release = () => { if (dragging) { dragging = false; setPlaying(wasPlaying && state.t < model.tEnd); } };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  function applyExample(index) {
    const values = Object.assign({}, EXAMPLES[0], EXAMPLES[index]);
    for (const id in controls) controls[id].set(values[id]);
    state.t = 0; stale = true;
    setPlaying(true);
  }

  function start() {
    const host = $('controles');
    for (const group of GROUPS) {
      const box = document.createElement('fieldset');
      box.innerHTML = '<legend>' + group.title + '</legend>';
      host.appendChild(box);
      for (const spec of group.controls) {
        controls[spec.id] = new window.Controles.Control(box, spec, () => { stale = true; });
      }
    }
    window.Controles.math($('potencial'), 'V(x) = \\tfrac{1}{2}k\\,x^2 + \\tfrac{1}{3}\\lambda_3\\,x^3 + \\tfrac{1}{4}\\lambda_4\\,x^4');

    const phase = new G.Phase($('fase')), energy = new G.Energy($('energia')), solution = new G.Solution($('solucao'));
    plots = [phase, energy, solution];
    dragInitialCondition(phase);
    dragTime(energy);
    dragTime(solution);

    EXAMPLES.forEach((example, i) => $('exemplos').add(new Option(example.name, i)));
    $('exemplos').addEventListener('change', event => applyExample(+event.target.value));
    $('tocar').addEventListener('click', () => {
      if (!state.playing && state.t >= model.tEnd) state.t = 0;
      setPlaying(!state.playing); redraw = true;
    });
    $('reiniciar').addEventListener('click', () => { state.t = 0; setPlaying(true); redraw = true; });
    $('tempo').addEventListener('input', event => { state.t = +event.target.value; setPlaying(false); redraw = true; });
    $('velocidade').addEventListener('change', event => { state.speed = +event.target.value; });
    $('componentes').addEventListener('change', event => { state.components = event.target.checked; stale = true; });

    // The plots take their colors from the page: redraw when the theme changes or the fonts arrive.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { stale = true; });
    new MutationObserver(() => { stale = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stale = true; });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
