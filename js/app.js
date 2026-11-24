// By Bruno Mota - METAbio
/**
 * The page: controls, state and animation.
 *
 * How it works.  The whole solution from t = 0 to T is computed whenever a control changes (from the closed
 * form when there is one, by Runge-Kutta otherwise: see Fisica.solve), and the three plots show all of it at
 * once; the animation only moves a time cursor along it.  Dragging a control therefore redraws the complete
 * phase portrait, energy curves and x(t) as it moves.
 *
 *   GROUPS       the controls: symbol, range, step and default value of each, and the caption of each group
 *   EXAMPLES     the configurations offered in the "Exemplos" menu
 *   compute()    builds the model (solution, energies, equilibria, ranges of the plots) from the controls
 *   syncRanges() makes the thin sliders and the ranges of x0 and p0 follow the phase diagram
 *   decorate()   colored segments and marks of the bars: damping regimes, resonance, shape of the potential
 *   formulas()   equation of motion and solution, rendered by KaTeX; legends; method of computation
 *   tick()       animation loop: recomputes if needed, advances the time cursor, redraws
 */
(function () {
  'use strict';
  const F = window.Fisica, Fm = window.Formulas, G = window.Graficos, C = window.Controles;
  const $ = id => document.getElementById(id);

  /** Largest |x0| (m) and |p0| (kg m/s) the controls accept, whatever the range of the diagram. */
  const X_MAX = 100, P_MAX = 1000;
  /** Smallest half-width of the phase diagram, in m and in kg m/s: where its two thin sliders start. */
  const SMALLEST = 0.01;
  /** The arrows of the phase diagram show the displacement during ARROW_TIME / w0 seconds. */
  const ARROW_TIME = 0.35;
  /** Gravity at the surface of three bodies (m/s^2), marked on the bar of g. */
  const GRAVITIES = [{ at: 1.62, label: 'Lua', snap: true }, { at: 9.81, label: 'Terra', snap: true }, { at: 24.79, label: 'Júpiter', snap: true }];

  /**
   * The groups of controls.  `only` restricts a control or a group to one system; `systems` puts the switch
   * between the two systems at the head of the group; `caption` lists [class of the segment, text, tooltip].
   */
  const GROUPS = [
    { systems: true, controls: [
      { id: 'M', symbol: 'M', name: 'massa', unit: 'kg', min: 0.1, max: 5, step: 0.05, value: 1, decimals: 2 },
      { id: 'k', only: 'oscillator', symbol: 'k', name: 'constante elástica', unit: 'N/m', min: 0.5, max: 20, step: 0.1, value: 4, decimals: 2 },
      { id: 'L', only: 'pendulum', symbol: 'L', name: 'comprimento', unit: 'm', min: 0.2, max: 5, step: 0.05, value: 1, decimals: 2 },
      { id: 'g', only: 'pendulum', symbol: 'g', name: 'gravidade', unit: 'm/s²', min: 1, max: 25, step: 0.05, value: 9.81, decimals: 2 },
      { id: 'b', symbol: 'b', name: 'amortecimento', unit: 'kg/s', min: 0, max: 10, step: 0.05, value: 0.4, decimals: 2 },
    ], caption: [['sub', 'subamortecido'], ['super', 'superamortecido']] },
    { title: 'Termos anarmônicos', only: 'oscillator', controls: [
      { id: 'l3', symbol: '\\lambda_3', name: 'cúbico', unit: 'N/m²', min: -5, max: 5, step: 0.05, value: 0, decimals: 2 },
      { id: 'l4', symbol: '\\lambda_4', name: 'quártico', unit: 'N/m³', min: -5, max: 5, step: 0.05, value: 0, decimals: 2 },
    ], caption: [
      ['neutro', 'estável', 'Um só poço: o potencial confina a massa.'],
      ['pocos', 'biestável', 'Dois poços, separados por uma barreira.'],
      ['escape', 'instável', 'O potencial não confina: a massa que passa da barreira escapa.'],
    ] },
    { title: 'Força externa', controls: [
      { id: 'F0', symbol: 'F_0', name: 'amplitude', unit: 'N', min: 0, max: 5, step: 0.05, value: 0, decimals: 2 },
      { id: 'w', symbol: '\\omega', name: 'frequência angular', unit: 'rad/s', min: 0, max: 10, step: 0.02, value: 2, decimals: 2 },
    ], caption: [['res', 'ressonância: potência absorvida acima de metade da máxima (largura 2γ)',
      'A potência média absorvida no regime estacionário é máxima em ω₀ e cai à metade nas bordas da faixa.']] },
    { title: 'Condições iniciais', controls: [
      { id: 'x0', symbol: 'x_0', name: 'posição', unit: 'm', min: -1.2, max: 1.2, step: 0.01, value: 1, decimals: 2 },
      { id: 'p0', symbol: 'p_0', name: 'momento', unit: 'kg·m/s', min: -2, max: 2, step: 0.02, value: 0, decimals: 2 },
    ] },
    { title: 'Tempo', controls: [
      { id: 'T', symbol: 'T', name: 'duração', unit: 's', min: 10, max: 120, step: 5, value: 30, decimals: 0 },
    ] },
  ];

  /** Each example lists only what differs from the first one.  The last one is quoted in the derivations. */
  const ROOT_G = Math.sqrt(9.81);
  const EXAMPLES = [
    { name: 'Subamortecido', system: 'oscillator', M: 1, k: 4, L: 1, g: 9.81, b: 0.4, l3: 0, l4: 0, F0: 0, w: 2, x0: 1, p0: 0, T: 30 },
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
    { name: 'Pêndulo: pequenas oscilações', system: 'pendulum', b: 0, x0: 0.3, T: 10 },
    { name: 'Pêndulo: grande amplitude', system: 'pendulum', b: 0, x0: 2.8, T: 20 },
    { name: 'Pêndulo: sobre a separatriz', system: 'pendulum', b: 0, x0: 0, p0: 2 * ROOT_G, T: 10 },
    { name: 'Pêndulo: rotação', system: 'pendulum', b: 0, x0: 0, p0: 7, T: 10 },
    { name: 'Pêndulo amortecido, lançado em rotação', system: 'pendulum', b: 0.3, x0: 0, p0: 14, T: 30 },
    // Baker & Gollub: theta'' + theta'/q + sin(theta) = a cos(w_D tau), with q = 2, a = 1.5, w_D = 2/3, tau = w0 t.
    { name: 'Pêndulo amortecido e forçado: caos', system: 'pendulum', M: 0.3, b: 0.3 * ROOT_G / 2, F0: 1.5 * 0.3 * 9.81, w: 2 * ROOT_G / 3, x0: 0, T: 120 },
  ];

  const controls = {};                      // id -> Controles.Control
  const ladders = {};                       // x, p -> Controles.Ladder: ranges of the phase diagram
  const fieldsets = [];                     // {group, element}
  const state = {
    system: 'oscillator',
    t: 0, playing: true, speed: 1,
    components: true,                       // draw the two terms of the forced linear solution
    approx: true,                           // draw the harmonic approximation of a nonlinear system
    fit: true,                              // the phase diagram rescales to fit the trajectory
    frozen: null,                           // {xr, pr}: ranges held while the initial condition is dragged
  };
  let timeBar = null;
  let model = null;                         // see graficos.js
  let stale = true;                         // the controls changed: the model must be recomputed
  let redraw = true;                        // the screen must be redrawn
  let plots = [];

  // ------------------------------------------------------------------------------------------ model

  /** Index of the last sample of the solution with |x| <= limit (-1 if there is none). */
  function lastInside(sol, limit) {
    for (let i = sol.n - 1; i >= 0; i--) if (Math.abs(sol.x[i]) <= limit) return i;
    return -1;
  }

  /**
   * Half-widths {xr, pr} of the phase diagram that fit the trajectory.
   *
   * Oscillator: round numbers just beyond the extremes of the trajectory.  If the mass escapes, the
   * trajectory is unbounded: x goes up to `reach` (or as far as the mass went on the other side before
   * leaving for good), and p as far as the trajectory reaches inside that range.
   * A mass at rest gives no scale (in p; nor in x, if it rests at the origin): that range stays as it was in
   * `before`, the ranges {xr, pr} of the diagram until now (null if there were none).
   * Pendulum: one whole turn in x, and in p enough for the trajectory and for the separatrix, whose top is at
   * p = 2 M sqrt(g L), so that the whole portrait is always in view.
   */
  function fitted(m, reach, before) {
    const sol = m.sol, P = m.P;
    const largest = (values, count) => { let most = 0; for (let i = 0; i < count; i++) most = Math.max(most, Math.abs(values[i])); return most; };
    const around = (most, kept) => (most > 0 ? G.niceCeil(Math.max(1.04 * most, SMALLEST)) : kept);
    if (P.system === 'pendulum') {
      return { xr: Math.PI * P.L, pr: G.niceCeil(1.04 * Math.max(largest(sol.p, sol.n), 2 * P.M * Math.sqrt(P.g * P.L))) };
    }
    if (sol.escaped) {
      const farthest = largest(sol.x, lastInside(sol, reach) + 1);        // beyond `reach` only on an earlier excursion
      const xr = G.niceCeil(farthest > reach ? 1.04 * farthest : reach);
      return { xr, pr: around(largest(sol.p, lastInside(sol, xr) + 1), before ? before.pr : 1) };
    }
    return { xr: around(largest(sol.x, sol.n), before ? before.xr : 1), pr: around(largest(sol.p, sol.n), before ? before.pr : 1) };
  }

  /**
   * Range [lower, upper] of the x(t) plot, from the first `count` samples: symmetric about zero unless x
   * stays far to one side.  Positions beyond `cut` (the edge of what is shown of an escaping mass) count as cut.
   */
  function rangeOfX(sol, count, cut) {
    let lo = 0, hi = 0;
    for (let i = 0; i < count; i++) { lo = Math.min(lo, sol.x[i]); hi = Math.max(hi, sol.x[i]); }
    const end = extreme => (extreme >= cut ? cut : extreme > 0 ? G.niceCeil(1.04 * extreme) : 0);
    const up = end(hi), down = end(-lo), most = Math.max(up, down, 0.1);
    return Math.min(up, down) > 0.25 * most ? [-most, most] : [down ? -down : -0.04 * most, up ? up : 0.04 * most];
  }

  /** Builds the model from the values of the controls. */
  function compute() {
    const P = { system: state.system }, pendulum = state.system === 'pendulum';
    for (const id of ['M', 'k', 'L', 'g', 'b', 'l3', 'l4', 'F0', 'w']) P[id] = controls[id].value;
    const x0 = controls.x0.value, p0 = controls.p0.value, T = controls.T.value;
    const sol = F.solve(P, x0, p0, T), D = F.derived(P);
    const before = model && model.P.system === P.system ? model.view : null;
    model = {
      P, D, x0, p0, T, sol,
      en: F.energies(P, sol),
      an: sol.exact,
      approx: D.harmonic ? null : F.analytic(F.harmonicApproximation(P), x0, p0),
      steady: F.steadyState(P),
      eq: F.equilibria(P),
      components: state.components,
      showApprox: state.approx,
      tau: ARROW_TIME / D.w0,
      index: 0,
    };

    // Positions as drawn in the phase diagram: for the pendulum, reduced to one turn.
    model.wrap = pendulum;
    model.xw = sol.x;
    if (pendulum) {
      const turn = 2 * Math.PI * P.L;
      model.xw = new Float64Array(sol.n);
      for (let i = 0; i < sol.n; i++) model.xw[i] = Math.abs(sol.x[i]) <= turn / 2 ? sol.x[i] : sol.x[i] - turn * Math.round(sol.x[i] / turn);
    }

    // If the mass escapes, the trajectory is unbounded.  The diagram then reaches 1.5 times the distance of
    // the farthest barrier (unstable equilibrium), where the cubic potential is back to its value at the
    // bottom of the well: this shows the well, the barrier and the beginning of the runaway.  A mass that
    // starts beyond the barrier gets the same room beyond its starting point.
    let reach = Infinity;
    if (sol.escaped) {
      const barriers = model.eq.filter(e => !e.stable).map(e => Math.abs(e.x));
      reach = Math.max(1.5 * Math.max.apply(null, barriers), 1.5 * Math.abs(x0), 0.1);
    }

    // Ranges of the phase diagram: held while the initial condition is dragged, so that the point follows
    // the pointer; fitted to the trajectory; or set by the two thin sliders.
    let view;
    if (state.frozen) view = { xr: state.frozen.xr, pr: state.frozen.pr };
    else if (state.fit) view = fitted(model, reach, before);
    else view = { xr: pendulum ? Math.min(ladders.x.value, Math.PI * P.L) : ladders.x.value, pr: ladders.p.value };
    model.view = view;

    // An escaping mass is shown until it leaves the diagram for good (and at least up to `reach`): the three
    // plots stop at the first sample beyond that, and their ranges are fitted to what is shown.  The time
    // axis goes on to the instant at which x reaches infinity.
    const cut = sol.escaped ? Math.max(view.xr, reach) : Infinity;
    view.nView = sol.escaped ? Math.min(sol.n, lastInside(sol, cut) + 2) : sol.n;
    model.tEscape = sol.escaped ? sol.t[sol.n - 1] : null;
    model.tEnd = sol.t[view.nView - 1];
    model.tAxis = model.tEscape === null ? T : 1.03 * model.tEscape;
    model.xRange = rangeOfX(sol, view.nView, cut);

    state.t = Math.min(state.t, model.tEnd);
    timeBar.setRange(0, Math.max(model.tEnd, 0.01), 0.01, 2);
  }

  /** Gives a control of an initial condition the range -a to a, with a step of about 1/240 of it. */
  function setHalfRange(control, a) {
    const step = G.niceStep(2 * a, 240);
    control.setRange(-a, a, step, Math.max(2, -Math.floor(Math.log10(step) + 1e-9)));
  }

  /**
   * After a change of the model: the thin sliders show the ranges of the diagram when these are fitted, and
   * the controls of x0 and p0 take the ranges of the diagram, so that the initial condition can be anywhere
   * in it (and stays in range if the diagram is made smaller than it).  Nothing moves while a slider or the
   * initial condition is being dragged.  Returns true if a value had to be changed to fit its range.
   */
  function syncRanges() {
    const v = model.view, pendulum = state.system === 'pendulum';
    if (state.frozen) return false;
    if (state.fit) { ladders.x.show(v.xr); ladders.p.show(v.pr); }
    if (controls.x0.dragging || controls.p0.dragging) return false;
    const half = (ofView, value, cap) => Math.min(cap, Math.max(ofView, value === 0 ? 0 : G.niceCeil(Math.abs(value))));
    setHalfRange(controls.x0, half(v.xr, model.x0, pendulum ? Math.PI * model.P.L : X_MAX));
    setHalfRange(controls.p0, half(v.pr, model.p0, P_MAX));
    return controls.x0.value !== model.x0 || controls.p0.value !== model.p0;
  }

  // ------------------------------------------------------------------------------------------ bars

  /**
   * Segments and marks of the bars.
   *
   *   b            underdamped below the critical value, overdamped above; marks at zero and at the critical value
   *   M, k, L, g   the same boundary seen from each parameter, with a mark at its critical value:
   *                the system is overdamped for M below it, k or g below it, L above it
   *   g            marks at the gravity of the Moon, the Earth and Jupiter
   *   F0, x0, p0   mark at zero
   *   w            marks at the natural frequency w0 and at the frequency of largest amplitude w_R;
   *                band where the absorbed power exceeds half its maximum: sqrt(w0^2 + gamma^2) -+ gamma
   *   l3, l4       where the potential has two wells (bistable), and where it does not confine (unstable)
   *
   * The damping and resonance marks describe the linear part of the force: with anharmonic terms, and for the
   * pendulum, they hold for small amplitudes.
   */
  function decorate() {
    const { P, D } = model, c = controls, damped = P.b > 0;
    const zero = { at: 0, label: '0', snap: true };
    const critical = at => ({ at, label: 'crítico', snap: true });
    /** Segments of a bar on which the values below `at` give one regime and those above the other. */
    const split = (control, at, below, above) => (damped
      ? [{ from: control.spec.min, to: at, kind: below }, { from: at, to: control.spec.max, kind: above }] : []);

    c.b.decorate([{ from: 0, to: D.bc, kind: 'sub' }, { from: D.bc, to: c.b.spec.max, kind: 'super' }], [zero, critical(D.bc)]);
    c.M.decorate(split(c.M, D.Mc, 'super', 'sub'), damped ? [critical(D.Mc)] : []);
    if (P.system === 'pendulum') {
      c.L.decorate(split(c.L, D.Lc, 'sub', 'super'), damped ? [critical(D.Lc)] : []);
      c.g.decorate(split(c.g, D.gc, 'super', 'sub'), GRAVITIES.concat(damped ? [critical(D.gc)] : []));
    } else {
      c.k.decorate(split(c.k, D.kc, 'super', 'sub'), damped ? [critical(D.kc)] : []);
    }

    c.F0.decorate([], [zero]);
    const marks = [{ at: D.w0, label: 'ω<sub>0</sub>', snap: true }];
    if (D.wr !== null) {
      const apart = Math.abs(c.w.fraction(D.w0) - c.w.fraction(D.wr)) > 0.09;
      marks.push({ at: D.wr, label: apart ? 'ω<sub>R</sub>' : '', snap: true, kind: 'fina' });
    }
    c.w.decorate(D.band ? [{ from: D.band[0], to: D.band[1], kind: 'res' }] : [], marks);

    if (P.l4 > 0) {
      const edge = 2 * Math.sqrt(P.k * P.l4);           // |l3| above which k + l3 x + l4 x^2 has real roots
      c.l3.decorate([{ from: c.l3.spec.min, to: -edge, kind: 'pocos' }, { from: edge, to: c.l3.spec.max, kind: 'pocos' }], [zero]);
    } else {
      c.l3.decorate([{ from: c.l3.spec.min, to: c.l3.spec.max, kind: 'escape' }], [zero]);
    }
    const l4 = [{ from: c.l4.spec.min, to: 0, kind: 'escape' }];
    if (P.l3 !== 0) l4.push({ from: 0, to: P.l3 * P.l3 / (4 * P.k), kind: 'pocos' });
    c.l4.decorate(l4, [zero]);

    c.x0.decorate([], [zero]);
    c.p0.decorate([], [zero]);
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

  /** Equation, solution, legends and notes: everything written that depends on the model. */
  function formulas() {
    const { P, D, an, sol } = model, pendulum = P.system === 'pendulum';
    const eq = Fm.equation(P), s = Fm.solution(P, D, an);
    tex($('eqSimbolica'), eq.symbolic);
    tex($('eqNumerica'), eq.numeric);
    $('regime').textContent = (D.harmonic ? '' : pendulum ? 'aproximação harmônica: ' : 'parte linear: ') + s.regime;
    $('regime').dataset.regime = D.regime;
    tex($('solFormula'), s.formula || '');
    texList($('solDefinicoes'), s.definitions);
    texList($('solValores'), s.values);
    $('solNota').textContent = s.note;
    tex($('potencial'), Fm.potential(P), false);
    $('metodo').textContent = Fm.method(sol.step);
    $('escalaSetas').textContent = 'τ = ' + ARROW_TIME.toString().replace('.', ',') + '/ω₀ = ' + Fm.text(model.tau) + ' s';

    // Legends follow what the plots show.
    const forcedLinear = !!an && an.kind === 'linear' && an.particular !== 'none';
    $('nomeCurva').textContent = !an ? 'numérica' : an.kind === 'pendulum' ? 'exata' : 'analítica';
    $('legTransiente').hidden = $('legParticular').hidden = !(forcedLinear && state.components);
    $('opcaoComponentes').hidden = !forcedLinear;
    $('nomeHomogenea').textContent = D.gamma > 0 ? 'transiente' : 'solução homogênea';
    $('nomeParticular').textContent = D.gamma > 0 ? 'regime estacionário' : 'solução particular';
    $('opcaoAproximacao').hidden = !model.approx;
    $('legEstacionario').hidden = !(model.steady && D.harmonic && D.gamma > 0 && P.w > 0);
    $('legSeparatriz').hidden = $('legInstavel').hidden = !model.eq.some(e => !e.stable);
    $('legForca').hidden = P.F0 === 0;

    const aviso = $('aviso');
    aviso.hidden = !(sol.escaped || sol.failed);
    if (sol.escaped) {
      aviso.textContent = 'A massa ultrapassa a barreira do potencial e não volta: x → ∞ em t ≈ ' +
        Fm.fixed(model.tEscape, 2) + ' s. O potencial não é confinante.';
    } else if (sol.failed) {
      aviso.textContent = 'O movimento é rápido demais para o menor passo da integração numérica: a curva foi interrompida.';
    }
  }

  /** Values under the time cursor. */
  function readout() {
    const i = model.index, s = model.sol;
    const items = ['x = ' + Fm.text(s.x[i]) + ' m', 'p = ' + Fm.text(s.p[i]) + ' kg·m/s', 'E = ' + Fm.text(model.en.E[i]) + ' J'];
    if (model.P.system === 'pendulum') items.splice(1, 0, 'θ = x/L = ' + Fm.text(s.x[i] / model.P.L) + ' rad');
    const html = items.map(item => '<span>' + item + '</span>').join('');
    if (readout.shown !== html) { $('leitura').innerHTML = html; readout.shown = html; }
  }

  // ------------------------------------------------------------------------------------------ animation

  function setPlaying(on) {
    state.playing = on;
    const button = $('tocar'), label = on ? 'Pausar' : 'Reproduzir';
    button.dataset.estado = on ? 'tocando' : 'parado';
    button.title = label;
    button.setAttribute('aria-label', label);
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
    if (stale) {
      compute();
      if (syncRanges()) compute();
      decorate();
      formulas();
    }
    if (stale || resized) { for (const plot of plots) plot.render(model); redraw = true; }
    stale = false;
    if (redraw) {
      model.index = Math.min(Math.round(state.t / model.sol.dt), model.sol.n - 1);
      for (const plot of plots) plot.update(model);
      readout();
      if (!timeBar.dragging) timeBar.set(state.t);
      redraw = false;
    }
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------------------------------ interaction

  /**
   * Dragging on the phase diagram chooses the initial condition.  While the pointer is down the mass is held
   * at that point and the axes stay put; on release the motion starts from it.
   */
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
      state.frozen = { xr: model.view.xr, pr: model.view.pr };
      state.t = 0;
      setPlaying(false);
      place(event);
    });
    canvas.addEventListener('pointermove', event => { if (state.frozen) place(event); });
    const release = () => { if (state.frozen) { state.frozen = null; state.t = 0; stale = true; setPlaying(true); } };
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

  /** Switches between the oscillator and the pendulum: shows the controls of the system and restarts. */
  function setSystem(system) {
    state.system = system;
    for (const button of document.querySelectorAll('.alternancia button')) button.setAttribute('aria-checked', button.dataset.sistema === system);
    for (const id in controls) controls[id].el.hidden = !!controls[id].spec.only && controls[id].spec.only !== system;
    for (const entry of fieldsets) entry.element.hidden = !!entry.group.only && entry.group.only !== system;
    if (system === 'pendulum') {            // the position is kept within one turn
      const limit = Math.PI * controls.L.value;
      controls.x0.set(Math.max(-limit, Math.min(limit, controls.x0.value)));
    }
    state.t = 0; stale = true;
    setPlaying(true);
  }

  function applyExample(index) {
    const values = Object.assign({}, EXAMPLES[0], EXAMPLES[index]);
    for (const id in controls) {
      if (id === 'x0' || id === 'p0') setHalfRange(controls[id], Math.max(controls[id].spec.max, G.niceCeil(Math.abs(values[id]) || 1)));
      controls[id].set(values[id]);
    }
    state.fit = true; $('ajustar').checked = true;
    setSystem(values.system);
  }

  /** Builds the controls of one group inside a fieldset: title or system switch, sliders, caption. */
  function buildGroup(group, host) {
    const box = document.createElement('fieldset');
    host.appendChild(box);
    fieldsets.push({ group, element: box });
    if (group.systems) {
      const toggle = document.createElement('div');
      toggle.className = 'alternancia';
      toggle.setAttribute('role', 'radiogroup');
      toggle.setAttribute('aria-label', 'Sistema');
      toggle.innerHTML = '<button type="button" role="radio" data-sistema="oscillator">Oscilador harmônico</button>' +
        '<button type="button" role="radio" data-sistema="pendulum">Pêndulo</button>';
      toggle.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button && button.dataset.sistema !== state.system) setSystem(button.dataset.sistema);
      });
      box.appendChild(toggle);
    } else {
      box.appendChild(Object.assign(document.createElement('legend'), { textContent: group.title }));
    }
    for (const spec of group.controls) controls[spec.id] = new C.Control(box, spec, () => { stale = true; });
    if (group.caption) {
      const list = document.createElement('ul');
      list.className = 'legenda do-grupo';
      for (const [kind, text, tip] of group.caption) {
        const item = document.createElement('li');
        item.innerHTML = '<i class="amostra ' + kind + '"></i>';
        item.appendChild(Object.assign(document.createElement('span'), { textContent: text }));
        if (tip) item.title = tip;
        list.appendChild(item);
      }
      box.appendChild(list);
    }
  }

  /** Tabs: clicking or the left and right arrows show one panel and hide the others. */
  function buildTabs() {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const select = chosen => {
      for (const tab of tabs) {
        const on = tab === chosen;
        tab.setAttribute('aria-selected', on);
        tab.tabIndex = on ? 0 : -1;
        $(tab.getAttribute('aria-controls')).hidden = !on;
      }
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', event => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        const next = tabs[(i + step + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  }

  function start() {
    for (const group of GROUPS) buildGroup(group, $('controles'));
    for (const element of document.querySelectorAll('.m')) C.math(element, element.textContent, element.tagName === 'DIV');
    buildTabs();

    const phase = new G.Phase($('fase')), energy = new G.Energy($('energia')), solution = new G.Solution($('solucao'));
    plots = [phase, energy, solution];
    dragInitialCondition(phase);
    dragTime(energy);
    dragTime(solution);
    // Releasing x0 or p0 lets their ranges follow the diagram again.
    for (const id of ['x0', 'p0']) controls[id].input.addEventListener('change', () => { stale = true; });

    // The thin sliders of the phase diagram, lined up with its plot area.  Moving one sets that range by hand.
    for (const side of ['l', 'r', 't', 'b']) $('painelFase').style.setProperty('--margem-' + side, phase.area.m[side] + 'px');
    const byHand = () => { state.fit = false; $('ajustar').checked = false; stale = true; };
    const plain = v => String(v).replace('.', ',');
    const exponent = powerOfTen => Math.round(Math.log10(powerOfTen));
    ladders.x = new C.Ladder($('escalaX'), { values: G.roundNumbers(exponent(SMALLEST), exponent(X_MAX)), label: 'Intervalo de x no diagrama',
      format: v => 'x de −' + plain(v) + ' a ' + plain(v) + ' m', onChange: byHand });
    ladders.p = new C.Ladder($('escalaP'), { vertical: true, values: G.roundNumbers(exponent(SMALLEST), exponent(P_MAX)), label: 'Intervalo de p no diagrama',
      format: v => 'p de −' + plain(v) + ' a ' + plain(v) + ' kg·m/s', onChange: byHand });
    $('ajustar').addEventListener('change', event => { state.fit = event.target.checked; stale = true; });

    // Time bar: dragging it moves the cursor; clicking its zero restarts the motion.
    timeBar = new C.Control($('tempoBarra'), { id: 't', symbol: 't', name: 'instante', unit: 's', min: 0, max: 30, step: 0.01, value: 0, decimals: 2 },
      (control, origin) => { state.t = control.value; setPlaying(origin === 'mark'); redraw = true; });
    timeBar.decorate([], [{ at: 0, label: '0', snap: true }]);

    const menu = $('exemplos');
    for (const [label, system] of [['Oscilador', 'oscillator'], ['Pêndulo', 'pendulum']]) {
      const set = document.createElement('optgroup');
      set.label = label;
      EXAMPLES.forEach((example, i) => { if ((example.system || 'oscillator') === system) set.appendChild(new Option(example.name, i)); });
      menu.appendChild(set);
    }
    menu.addEventListener('change', event => applyExample(+event.target.value));
    $('tocar').addEventListener('click', () => {
      if (!state.playing && state.t >= model.tEnd) state.t = 0;
      setPlaying(!state.playing); redraw = true;
    });
    $('velocidade').addEventListener('change', event => { state.speed = +event.target.value; });
    $('componentes').addEventListener('change', event => { state.components = event.target.checked; stale = true; });
    $('aproximacao').addEventListener('change', event => { state.approx = event.target.checked; stale = true; });

    // The plots take their colors from the page: redraw when the theme changes or the fonts arrive.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { stale = true; });
    new MutationObserver(() => { stale = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stale = true; });

    setSystem('oscillator');
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
