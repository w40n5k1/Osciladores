// By Bruno Mota - METAbio
/**
 * Tests of js/fisica.js and js/formulas.js.  Run from the folder of the project:
 *
 *     node tests/teste_fisica.js
 *
 * 1. The closed forms satisfy the equation of motion and the initial conditions (checked by finite differences,
 *    without the integrator), in every damping regime, free and forced.
 * 2. The Runge-Kutta solution agrees with the closed forms in the same cases.
 * 3. Without damping or forcing the energy is conserved, also with anharmonic terms: to one part in a million
 *    over 60 s in the stiffest case the controls allow (M = 0.1, k = 20, l4 = 5), much better elsewhere.
 * 4. The period of the quartic oscillator equals the period integral  T = 4 int_0^a dx / sqrt(2 (E - V) / M).
 * 5. The steady-state amplitude is largest at w_r = sqrt(w0^2 - 2 gamma^2), and equals F0 / (b w0) at w = w0.
 * 6. Equilibria are zeros of the force, with the stability given by the curvature of the potential.
 * 7. In a cubic potential a mass released above the barrier escapes, and one released below it does not.
 * 8. Every formula the page can show is valid LaTeX for KaTeX.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const F = require('../js/fisica.js');
const Formulas = require('../js/formulas.js');

const BASE = { M: 1, k: 4, b: 0, l3: 0, l4: 0, F0: 0, w: 2 };
const with_ = changes => Object.assign({}, BASE, changes);

/** The linear cases: every damping regime, free and forced, plus the undamped resonance and a static force. */
const LINEAR = [
  ['free, no damping', with_({}), 1, 0.5],
  ['free, underdamped', with_({ b: 0.4 }), 1, -0.3],
  ['free, critical', with_({ b: 4 }), 1, 2],
  ['free, overdamped', with_({ b: 9, M: 0.7 }), -0.5, 3],
  ['forced, underdamped', with_({ b: 0.4, F0: 1.5, w: 1.7 }), 0.2, 0.1],
  ['forced at w0, underdamped', with_({ b: 0.4, F0: 1, w: 2 }), 0, 0],
  ['forced, critical', with_({ b: 4, F0: 2, w: 3 }), 1, 0],
  ['forced, overdamped', with_({ b: 7, F0: 2, w: 0.8 }), 1, 0],
  ['forced, no damping, beats', with_({ F0: 1, w: 1.8 }), 0, 0],
  ['forced, no damping, above w0', with_({ F0: 1, w: 3.1 }), 0.4, -0.2],
  ['resonance without damping', with_({ F0: 0.5, w: 2 }), 0.3, 0],
  ['static force', with_({ b: 0.5, F0: 2, w: 0 }), 0, 0],
];

test('closed forms satisfy the equation of motion and the initial conditions', () => {
  for (const [name, P, x0, p0] of LINEAR) {
    const an = F.analytic(P, x0, p0);
    assert.ok(Math.abs(an.x(0) - x0) < 1e-12, name + ': x(0)');
    assert.ok(Math.abs(P.M * an.v(0) - p0) < 1e-12, name + ': p(0)');
    const h = 1e-4;
    for (const t of [0.3, 1.1, 2.7, 6.4]) {
      const acc = (an.x(t + h) - 2 * an.x(t) + an.x(t - h)) / (h * h);
      const vel = (an.x(t + h) - an.x(t - h)) / (2 * h);
      const residual = P.M * acc + P.b * vel + P.k * an.x(t) - P.F0 * Math.cos(P.w * t);
      assert.ok(Math.abs(residual) < 1e-5, `${name}: residual ${residual} at t = ${t}`);
      assert.ok(Math.abs(vel - an.v(t)) < 1e-6, name + ': v(t) is the derivative of x(t)');
    }
  }
});

test('Runge-Kutta solution agrees with the closed forms', () => {
  for (const [name, P, x0, p0] of LINEAR) {
    const an = F.analytic(P, x0, p0);
    const sol = F.integrate(P, x0, p0, 40);
    assert.strictEqual(sol.escaped, false);
    let worst = 0, scale = 0;
    for (let i = 0; i < sol.n; i++) {
      worst = Math.max(worst, Math.abs(sol.x[i] - an.x(sol.t[i])), Math.abs(sol.p[i] / P.M - an.v(sol.t[i])));
      scale = Math.max(scale, Math.abs(sol.x[i]));
    }
    assert.ok(worst < 1e-8 * Math.max(scale, 1), `${name}: worst difference ${worst}`);
  }
});

test('energy is conserved without damping or forcing', () => {
  const cases = [with_({}), with_({ l4: 3 }), with_({ l3: -1.5 }), with_({ k: 1, l3: -3, l4: 1.5 }), with_({ M: 0.1, k: 20, l4: 5 })];
  for (const P of cases) {
    const x0 = P.l3 === -1.5 ? 1 : 2.5;
    const sol = F.integrate(P, x0, 0, 60), en = F.energies(P, sol);
    let drift = 0;
    for (let i = 0; i < sol.n; i++) drift = Math.max(drift, Math.abs(en.E[i] - en.E[0]));
    assert.ok(drift < 1e-6 * Math.abs(en.E[0]), `relative drift ${drift / Math.abs(en.E[0])} for ${JSON.stringify(P)}`);
  }
});

test('period of the quartic oscillator equals the period integral', () => {
  const P = with_({ l4: 3 }), a = 1.5, E = F.potential(P, a);
  // With x = a sin(u) the integrand is finite at the turning point: midpoint rule in u.
  const n = 20000;
  let T = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * (Math.PI / 2) / n, x = a * Math.sin(u);
    T += a * Math.cos(u) / Math.sqrt(2 * (E - F.potential(P, x)) / P.M) * (Math.PI / 2) / n;
  }
  T *= 4;
  // Simulated period: time between successive upward zero crossings of x, by linear interpolation.
  const sol = F.integrate(P, a, 0, 30), crossings = [];
  for (let i = 1; i < sol.n; i++) {
    if (sol.x[i - 1] < 0 && sol.x[i] >= 0) crossings.push(sol.t[i - 1] + sol.dt * (-sol.x[i - 1]) / (sol.x[i] - sol.x[i - 1]));
  }
  const simulated = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  assert.ok(T < 2 * Math.PI / Math.sqrt(P.k / P.M), 'a hardening spring oscillates faster than the linear one');
  assert.ok(Math.abs(simulated - T) < 1e-4 * T, `period ${simulated} against ${T}`);
});

test('steady-state amplitude peaks at w_r and equals F0 / (b w0) at w0', () => {
  const P = with_({ b: 1.2, F0: 1 }), D = F.derived(P);
  let best = 0, wBest = 0;
  for (let w = 0.5; w < 3.5; w += 1e-4) {
    const A = F.steadyState(with_({ b: 1.2, F0: 1, w })).A;
    if (A > best) { best = A; wBest = w; }
  }
  assert.ok(Math.abs(wBest - D.wr) < 2e-4, `peak at ${wBest}, w_r = ${D.wr}`);
  assert.ok(Math.abs(D.wr - Math.sqrt(4 - 2 * 0.36)) < 1e-12);
  const atW0 = F.steadyState(with_({ b: 1.2, F0: 1, w: D.w0 }));
  assert.ok(Math.abs(atW0.A - 1 / (1.2 * D.w0)) < 1e-12);
  assert.ok(Math.abs(atW0.delta - Math.PI / 2) < 1e-12, 'the phase lag is a quarter of a period at w0');
  assert.strictEqual(F.derived(with_({ b: 3.5 })).wr, null, 'no amplitude resonance when 2 gamma^2 > w0^2');
});

test('damping regimes and critical values', () => {
  assert.strictEqual(F.derived(with_({})).regime, 'none');
  assert.strictEqual(F.derived(with_({ b: 0.4 })).regime, 'under');
  assert.strictEqual(F.derived(with_({ b: 9 })).regime, 'over');
  for (const [M, k] of [[1, 4], [0.35, 7.3], [4.95, 0.6], [0.1, 20]]) {
    const D0 = F.derived(with_({ M, k, b: 1.3 }));
    assert.strictEqual(F.derived(with_({ M, k, b: D0.bc })).regime, 'critical', 'b = bc');
    assert.strictEqual(F.derived(with_({ M, k: D0.kc, b: 1.3 })).regime, 'critical', 'k = kc');
    assert.strictEqual(F.derived(with_({ M: D0.Mc, k, b: 1.3 })).regime, 'critical', 'M = Mc');
  }
});

test('equilibria are zeros of the force, stable where the potential has a minimum', () => {
  const cases = [[with_({}), 1], [with_({ l3: -1.5 }), 2], [with_({ l4: -2 }), 3], [with_({ k: 1, l3: -3, l4: 1.5 }), 3], [with_({ l3: 1, l4: 2 }), 1]];
  for (const [P, count] of cases) {
    const eq = F.equilibria(P);
    assert.strictEqual(eq.length, count, JSON.stringify(P));
    for (const e of eq) {
      assert.ok(Math.abs(F.force(P, e.x)) < 1e-12);
      const h = 1e-4, curvature = (F.potential(P, e.x + h) - 2 * F.potential(P, e.x) + F.potential(P, e.x - h)) / (h * h);
      assert.strictEqual(e.stable, curvature > 0);
    }
    assert.ok(eq.some(e => e.x === 0 && e.stable), 'x = 0 is always a stable equilibrium');
  }
  assert.strictEqual(F.confining(with_({ l4: 0.1, l3: -4 })), true);
  assert.strictEqual(F.confining(with_({ l3: 0.1 })), false);
  assert.strictEqual(F.confining(with_({ l4: -0.1 })), false);
});

test('escape over the barrier of a cubic potential', () => {
  const P = with_({ l3: -1.5 });                         // barrier at x = k / 1.5 = 2.67, of height V = 4.74 J
  const barrier = F.equilibria(P).find(e => !e.stable);
  assert.ok(Math.abs(barrier.x - 4 / 1.5) < 1e-12);
  assert.ok(F.potential(P, -1.8) > F.potential(P, barrier.x));
  assert.strictEqual(F.integrate(P, -1.8, 0, 30).escaped, true, 'released above the barrier');
  assert.strictEqual(F.integrate(P, 1.0, 0, 30).escaped, false, 'released below the barrier');
});

test('every formula is valid LaTeX', () => {
  const katex = require(path.join('..', 'vendor', 'katex', 'katex.min.js'));
  const render = s => katex.renderToString(s, { throwOnError: true, displayMode: true });
  const all = LINEAR.concat([['anharmonic', with_({ b: 0.3, l3: -1, l4: 2, F0: 1 }), 1, 0]]);
  for (const [name, P, x0, p0] of all) {
    const eq = Formulas.equation(P), D = F.derived(P), s = Formulas.solution(P, D, F.analytic(P, x0, p0));
    for (const piece of [eq.symbolic, eq.numeric].concat(s.formula || [], s.definitions, s.values)) {
      assert.doesNotThrow(() => render(piece), name + ': ' + piece);
    }
    assert.strictEqual(s.formula === null, !D.harmonic);
  }
  assert.strictEqual(Formulas.text(-0.4), '−0,400');
  assert.strictEqual(Formulas.text(12345.6), '1,23×10^4');
  assert.strictEqual(Formulas.tex(2), '2{,}00');
});
