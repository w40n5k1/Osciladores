// By Bruno Mota - METAbio
/**
 * Tests of js/fisica.js and js/formulas.js, and of the grid of values of the sliders (js/controles.js).
 * Run from the folder of the project:
 *
 *     node tests/teste_fisica.js
 *
 * Linear oscillator
 *  1. The closed forms satisfy the equation of motion and the initial conditions (checked by finite differences,
 *     without the integrator), in every damping regime, free and forced.
 *  2. The Runge-Kutta solution agrees with the closed forms in the same cases.
 *  3. The steady-state amplitude is largest at w_r = sqrt(w0^2 - 2 gamma^2), and equals F0 / (b w0) at w = w0;
 *     the absorbed power is largest at w0 and falls to half at the two ends of the band of width 2 gamma.
 *  4. Damping regimes, and the values of b, k, M (and L, g for the pendulum) that make the damping critical.
 * Anharmonic oscillator
 *  5. Without damping or forcing the energy is conserved: to one part in a million over 60 s in the stiffest
 *     case the fixed 1 ms step is used for (M = 0.1, k = 20, l4 = 5), much better elsewhere.
 *  6. The period of the quartic oscillator equals the period integral  T = 4 int_0^a dx / sqrt(2 (E - V) / M).
 *  7. For small amplitude a the frequency is  w0 + [3 l4 / (8 M w0) - 5 l3^2 / (12 M^2 w0^3)] a^2
 *     (Landau & Lifshitz, Mechanics, par. 28).
 *  8. Equilibria are zeros of the force, with the stability given by the curvature of the potential.
 *  9. In a cubic potential a mass released above the barrier escapes, and one released below it does not.
 * Pendulum
 * 10. Elliptic integrals and Jacobi functions agree with direct quadrature and with their defining identities.
 * 11. The exact solution satisfies the equation of motion and the initial conditions, conserves the energy,
 *     and agrees with Runge-Kutta, for libration, rotation and the separatrix.  The equations in the angle
 *     and the angular momentum are Newton's second law along the path, with friction and forcing.
 * 12. The period is 4 K / w0: it matches the simulated one, and for small amplitude the series
 *     T0 (1 + a^2/16 + 11 a^4/3072).  A small oscillation coincides with the harmonic approximation.
 * The solution shown by the page
 * 13. solve() uses the closed form when there is one and Runge-Kutta otherwise, shortens the step when the
 *     motion is fast, and keeps a mass at rest on an equilibrium point.
 *     advance() continues a solution: in pieces it gives the same as solve() at once.
 * 14. Every formula the page can show is valid LaTeX for KaTeX.
 * 15. A slider moves over the two ends of its range and the multiples of its step between them, whatever
 *     the ends are: zero is on the grid, and both ends are reached exactly.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const F = require('../js/fisica.js');
const Formulas = require('../js/formulas.js');

const BASE = { M: 1, k: 4, b: 0, l3: 0, l4: 0, F0: 0, w: 2 };
const with_ = changes => Object.assign({}, BASE, changes);
const PENDULUM = { system: 'pendulum', M: 1, L: 1, g: 9.81, b: 0, F0: 0, w: 2 };
const pendulum = changes => Object.assign({}, PENDULUM, changes);

/** Largest differences in x and in p between a sampled solution and functions x(t), v(t). */
function distance(sol, P, an) {
  let dx = 0, dp = 0, scale = 0;
  for (let i = 0; i < sol.n; i++) {
    dx = Math.max(dx, Math.abs(sol.x[i] - an.x(sol.t[i])));
    dp = Math.max(dp, Math.abs(sol.p[i] - F.inertia(P) * an.v(sol.t[i])));
    scale = Math.max(scale, Math.abs(sol.x[i]));
  }
  return { dx, dp, scale };
}

/** Angular frequency of a sampled oscillation, from the times of its maxima (zeros of p, interpolated). */
function frequency(sol) {
  const maxima = [];
  for (let i = 1; i < sol.n; i++) {
    if (sol.p[i - 1] > 0 && sol.p[i] <= 0) maxima.push(sol.t[i - 1] + sol.dt * sol.p[i - 1] / (sol.p[i - 1] - sol.p[i]));
  }
  return 2 * Math.PI * (maxima.length - 1) / (maxima[maxima.length - 1] - maxima[0]);
}

/** int_0^phi dt / sqrt(1 - m sin^2 t) by the midpoint rule. */
function quadratureF(phi, m) {
  const n = 100000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 1 / Math.sqrt(1 - m * Math.sin((i + 0.5) * phi / n) ** 2);
  return sum * phi / n;
}

// ------------------------------------------------------------------------------------- linear oscillator

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

test('linear oscillator: closed forms satisfy the equation of motion and the initial conditions', () => {
  for (const [name, P, x0, p0] of LINEAR) {
    const an = F.analytic(P, x0, p0);
    assert.strictEqual(an.kind, 'linear');
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

test('linear oscillator: Runge-Kutta agrees with the closed forms', () => {
  for (const [name, P, x0, p0] of LINEAR) {
    const sol = F.integrate(P, x0, p0, 40), d = distance(sol, P, F.analytic(P, x0, p0));
    assert.strictEqual(sol.escaped || sol.failed, false);
    assert.ok(Math.max(d.dx, d.dp) < 1e-8 * Math.max(d.scale, 1), `${name}: worst difference ${Math.max(d.dx, d.dp)}`);
  }
});

test('linear oscillator: resonance of the amplitude and of the absorbed power', () => {
  const P = with_({ b: 1.2, F0: 1 }), D = F.derived(P);
  const power = w => { const s = F.steadyState(with_({ b: 1.2, F0: 1, w })); return 0.5 * P.b * w * w * s.A * s.A; };
  let best = 0, wBest = 0, bestPower = 0, wPower = 0;
  for (let w = 0.5; w < 3.5; w += 1e-4) {
    const A = F.steadyState(with_({ b: 1.2, F0: 1, w })).A;
    if (A > best) { best = A; wBest = w; }
    if (power(w) > bestPower) { bestPower = power(w); wPower = w; }
  }
  assert.ok(Math.abs(wBest - D.wr) < 2e-4, `amplitude peak at ${wBest}, w_r = ${D.wr}`);
  assert.ok(Math.abs(D.wr - Math.sqrt(4 - 2 * 0.36)) < 1e-12);
  assert.ok(Math.abs(best - (P.F0 / P.M) / (2 * D.gamma * D.w1)) < 1e-7, 'largest amplitude is (F0/M) / (2 gamma w1)');
  const atW0 = F.steadyState(with_({ b: 1.2, F0: 1, w: D.w0 }));
  assert.ok(Math.abs(atW0.A - 1 / (1.2 * D.w0)) < 1e-12);
  assert.ok(Math.abs(atW0.delta - Math.PI / 2) < 1e-12, 'the phase lag is a quarter of a period at w0');
  assert.strictEqual(F.derived(with_({ b: 3.5 })).wr, null, 'no amplitude resonance when 2 gamma^2 > w0^2');

  assert.ok(Math.abs(wPower - D.w0) < 2e-4, `power peak at ${wPower}, w0 = ${D.w0}`);
  assert.ok(Math.abs(power(D.w0) - P.F0 * P.F0 / (2 * P.b)) < 1e-12, 'largest power is F0^2 / 2b');
  for (const edge of D.band) assert.ok(Math.abs(power(edge) - power(D.w0) / 2) < 1e-12, 'half power at the ends of the band');
  assert.ok(Math.abs(D.band[1] - D.band[0] - 2 * D.gamma) < 1e-12, 'the band is 2 gamma wide');
  assert.ok(Math.abs(D.band[0] * D.band[1] - D.w0 * D.w0) < 1e-12, 'and its ends have w0 as geometric mean');
  assert.strictEqual(F.derived(with_({})).band, null);
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
  for (const [M, L, g] of [[1, 1, 9.81], [0.3, 2.35, 1.62], [4.2, 0.25, 24.79]]) {
    const D0 = F.derived(pendulum({ M, L, g, b: 1.3 }));
    assert.ok(Math.abs(D0.w0 - Math.sqrt(g / L)) < 1e-12, 'the frequency of the pendulum does not depend on the mass');
    assert.strictEqual(F.derived(pendulum({ M, L, g, b: D0.bc })).regime, 'critical', 'pendulum, b = bc');
    assert.strictEqual(F.derived(pendulum({ M: D0.Mc, L, g, b: 1.3 })).regime, 'critical', 'pendulum, M = Mc');
    assert.strictEqual(F.derived(pendulum({ M, L: D0.Lc, g, b: 1.3 })).regime, 'critical', 'pendulum, L = Lc');
    assert.strictEqual(F.derived(pendulum({ M, L, g: D0.gc, b: 1.3 })).regime, 'critical', 'pendulum, g = gc');
    assert.strictEqual(F.derived(pendulum({ M, L: 1.5 * D0.Lc, g, b: 1.3 })).regime, 'over', 'a longer pendulum is overdamped');
  }
});

// ------------------------------------------------------------------------------------- anharmonic oscillator

test('anharmonic oscillator: energy is conserved without damping or forcing', () => {
  const cases = [with_({}), with_({ l4: 3 }), with_({ l3: -1.5 }), with_({ k: 1, l3: -3, l4: 1.5 }), with_({ M: 0.1, k: 20, l4: 5 })];
  for (const P of cases) {
    const x0 = P.l3 === -1.5 ? 1 : 2.5;
    const sol = F.integrate(P, x0, 0, 60), en = F.energies(P, sol);
    let drift = 0;
    for (let i = 0; i < sol.n; i++) drift = Math.max(drift, Math.abs(en.E[i] - en.E[0]));
    assert.ok(drift < 1e-6 * Math.abs(en.E[0]), `relative drift ${drift / Math.abs(en.E[0])} for ${JSON.stringify(P)}`);
  }
});

test('anharmonic oscillator: period of the quartic oscillator equals the period integral', () => {
  const P = with_({ l4: 3 }), a = 1.5, E = F.potential(P, a);
  // With x = a sin(u) the integrand is finite at the turning point: midpoint rule in u.
  const n = 20000;
  let T = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * (Math.PI / 2) / n, x = a * Math.sin(u);
    T += a * Math.cos(u) / Math.sqrt(2 * (E - F.potential(P, x)) / P.M) * (Math.PI / 2) / n;
  }
  T *= 4;
  const simulated = 2 * Math.PI / frequency(F.integrate(P, a, 0, 30));
  assert.ok(T < 2 * Math.PI / Math.sqrt(P.k / P.M), 'a hardening spring oscillates faster than the linear one');
  assert.ok(Math.abs(simulated - T) < 1e-5 * T, `period ${simulated} against ${T}`);
});

test('anharmonic oscillator: frequency shift at small amplitude', () => {
  // The amplitude a of the formula is that of the fundamental; the release point differs from it at order a^2,
  // which changes the shift at relative order a: hence the tolerance of a few per cent.
  for (const [l3, l4] of [[0, 3], [-1.5, 0], [2, -1], [1, 2]]) {
    const P = with_({ M: 1.3, l3, l4 }), w0 = Math.sqrt(P.k / P.M), a = 0.05;
    const shift = (3 * l4 / (8 * P.M * w0) - 5 * l3 * l3 / (12 * P.M * P.M * w0 ** 3)) * a * a;
    const measured = frequency(F.integrate(P, a, 0, 400)) - w0;
    assert.ok(Math.abs(measured - shift) < 0.03 * Math.abs(shift), `l3 = ${l3}, l4 = ${l4}: ${measured} against ${shift}`);
  }
});

test('equilibria are zeros of the force, stable where the potential has a minimum', () => {
  const cases = [[with_({}), 1], [with_({ l3: -1.5 }), 2], [with_({ l4: -2 }), 3], [with_({ k: 1, l3: -3, l4: 1.5 }), 3],
    [with_({ l3: 1, l4: 2 }), 1], [pendulum({}), 3], [pendulum({ L: 2.3 }), 3]];
  for (const [P, count] of cases) {
    const eq = F.equilibria(P);
    assert.strictEqual(eq.length, count, JSON.stringify(P));
    for (const e of eq) {
      assert.ok(Math.abs(F.force(P, e.x)) < 1e-12 * (P.system === 'pendulum' ? P.M * P.g * P.L : 1));
      const h = 1e-4, curvature = (F.potential(P, e.x + h) - 2 * F.potential(P, e.x) + F.potential(P, e.x - h)) / (h * h);
      assert.strictEqual(e.stable, curvature > 0);
      assert.ok(Math.abs(curvature - F.curvature(P, e.x)) < 1e-5 * Math.abs(curvature));
      const slope = (F.potential(P, e.x + 0.3 + h) - F.potential(P, e.x + 0.3 - h)) / (2 * h);
      assert.ok(Math.abs(slope + F.force(P, e.x + 0.3)) < 1e-6 * (1 + Math.abs(slope)), 'the force is minus the slope of the potential');
    }
    assert.ok(eq.some(e => e.x === 0 && e.stable), 'x = 0 is always a stable equilibrium');
  }
  assert.strictEqual(F.confining(with_({ l4: 0.1, l3: -4 })), true);
  assert.strictEqual(F.confining(with_({ l3: 0.1 })), false);
  assert.strictEqual(F.confining(with_({ l4: -0.1 })), false);
  assert.strictEqual(F.confining(pendulum({})), true);
});

test('escape over the barrier of a cubic potential', () => {
  const P = with_({ l3: -1.5 });                         // barrier at x = k / 1.5 = 2.67, of height V = 4.74 J
  const barrier = F.equilibria(P).find(e => !e.stable);
  assert.ok(Math.abs(barrier.x - 4 / 1.5) < 1e-12);
  assert.ok(F.potential(P, -1.8) > F.potential(P, barrier.x));
  assert.strictEqual(F.solve(P, -1.8, 0, 30).escaped, true, 'released above the barrier');
  assert.strictEqual(F.solve(P, 1.0, 0, 30).escaped, false, 'released below the barrier');
});

// ------------------------------------------------------------------------------------- pendulum

test('elliptic integrals and Jacobi functions', () => {
  for (const m of [0, 0.3, 0.9, 0.999]) {
    assert.ok(Math.abs(F.ellipticK(m) - quadratureF(Math.PI / 2, m)) < 1e-9, 'K against quadrature, m = ' + m);
    const fn = F.jacobi(m);
    for (const phi of [0.4, 1.2, -1.0, 2.5, 7.0, -4.2]) {
      const u = F.ellipticF(phi, m), j = fn(u);
      assert.ok(Math.abs(u - quadratureF(phi, m)) < 1e-8, `F against quadrature, m = ${m}, phi = ${phi}`);
      assert.ok(Math.abs(j.am - phi) < 1e-12, 'the amplitude is the inverse of F');
      assert.ok(Math.abs(j.sn - Math.sin(phi)) < 1e-12 && Math.abs(j.cn - Math.cos(phi)) < 1e-12);
      assert.ok(Math.abs(j.dn * j.dn + m * j.sn * j.sn - 1) < 1e-12, 'dn^2 + m sn^2 = 1');
      const h = 1e-5, slope = (fn(u + h).sn - fn(u - h).sn) / (2 * h);
      assert.ok(Math.abs(slope - j.cn * j.dn) < 1e-8, 'd sn / du = cn dn');
    }
    assert.ok(Math.abs(fn(F.ellipticK(m)).sn - 1) < 1e-12, 'sn(K) = 1');
  }
  assert.ok(Math.abs(F.ellipticK(0) - Math.PI / 2) < 1e-15);
  assert.ok(Math.abs(F.ellipticK(0.5) - 1.8540746773013719) < 1e-13, 'K(1/2) = Gamma(1/4)^2 / (4 sqrt(pi))');
  assert.ok(Math.abs(F.jacobi(0)(0.7).sn - Math.sin(0.7)) < 1e-15, 'for m = 0, sn is the sine');
});

/** Initial conditions of the pendulum: [name, theta0, p_theta0, expected motion]. */
const SEPARATRIX_P = 2 * F.inertia(PENDULUM) * Math.sqrt(PENDULUM.g / PENDULUM.L);   // angular momentum that just reaches the top from theta = 0
const SWINGS = [
  ['small oscillation', 0.3, 0, 'libration'],
  ['large oscillation', 2.8, 0, 'libration'],
  ['oscillation, released moving', -2, 3, 'libration'],
  ['just below the separatrix', 0, 0.999 * SEPARATRIX_P, 'libration'],
  ['separatrix', 0, SEPARATRIX_P, 'separatrix'],
  ['separatrix, backwards', 0.5, -SEPARATRIX_P * Math.cos(0.25), 'separatrix'],
  ['just above the separatrix', 0, 1.001 * SEPARATRIX_P, 'rotation'],
  ['rotation', 0, 7, 'rotation'],
  ['rotation, backwards', 1, -9, 'rotation'],
  ['rotation from the top', Math.PI, 0.2, 'rotation'],
];

test('pendulum: exact solution satisfies the equation of motion and conserves the energy', () => {
  // Another mass and length: the momenta of SWINGS scale as I w0 = M L^2 sqrt(g / L), the angles do not change.
  const P = pendulum({ M: 1.4, L: 0.8 }), I = F.inertia(P);
  const scale = I * Math.sqrt(P.g / P.L) / (F.inertia(PENDULUM) * Math.sqrt(PENDULUM.g / PENDULUM.L));
  assert.ok(Math.abs(I - 1.4 * 0.64) < 1e-15);
  for (const [name, x0, p0raw] of SWINGS) {
    const p0 = p0raw * scale, an = F.analytic(P, x0, p0);
    assert.strictEqual(an.kind, 'pendulum');
    assert.ok(Math.abs(an.x(0) - x0) < 1e-12 && Math.abs(I * an.v(0) - p0) < 1e-11, name + ': initial conditions');
    const E0 = F.energy(P, x0, p0), h = 1e-4;
    for (const t of [0.2, 0.9, 2.3, 5.1, 11.7]) {
      const acc = (an.x(t + h) - 2 * an.x(t) + an.x(t - h)) / (h * h), vel = (an.x(t + h) - an.x(t - h)) / (2 * h);
      assert.ok(Math.abs(I * acc - F.force(P, an.x(t))) < 2e-5 * P.M * P.g * P.L, `${name}: residual at t = ${t}`);
      assert.ok(Math.abs(vel - an.v(t)) < 1e-6, name + ': v(t) is the derivative of theta(t)');
      assert.ok(Math.abs(F.energy(P, an.x(t), I * an.v(t)) - E0) < 1e-10 * P.M * P.g * P.L, name + ': energy');
    }
  }
});

test('pendulum: the equations in theta are Newton\'s second law along the path', () => {
  // Independent of inertia(), drive() and of the code of the integrator: the arc length s = L theta of the
  // numerical solution must obey  M s'' = -M g sin(s / L) - b s' + F0 cos(w t),  with s' = p_theta / (M L).
  const P = pendulum({ M: 0.6, L: 1.7, g: 9.81, b: 0.35, F0: 2.2, w: 1.9 }), dt = 0.001;
  const sol = F.integrate(P, 0.9, -0.4, 12, { dtOut: dt, substeps: 4 });
  let worst = 0;
  for (let i = 1; i < sol.n - 1; i++) {
    const s = P.L * sol.x[i], acc = P.L * (sol.x[i + 1] - 2 * sol.x[i] + sol.x[i - 1]) / (dt * dt), v = sol.p[i] / (P.M * P.L);
    worst = Math.max(worst, Math.abs(P.M * acc + P.M * P.g * Math.sin(s / P.L) + P.b * v - P.F0 * Math.cos(P.w * sol.t[i])));
    assert.ok(Math.abs(P.L * (sol.x[i + 1] - sol.x[i - 1]) / (2 * dt) - v) < 1e-5, 'the velocity is p_theta / (M L)');
  }
  assert.ok(worst < 1e-5 * P.M * P.g, 'residual of Newton\'s law: ' + worst);
  // The energy changes by the work of friction and of the external force: dE/dt = -b v^2 + F0 cos(w t) v.
  let work = 0;
  const power = i => { const v = sol.p[i] / (P.M * P.L); return -P.b * v * v + P.F0 * Math.cos(P.w * sol.t[i]) * v; };
  for (let i = 1; i < sol.n; i++) work += dt * (power(i - 1) + power(i)) / 2;
  const gained = F.energy(P, sol.x[sol.n - 1], sol.p[sol.n - 1]) - F.energy(P, sol.x[0], sol.p[0]);
  assert.ok(Math.abs(gained - work) < 1e-5 * P.M * P.g * P.L, `energy balance: ${gained} against ${work}`);
});

test('pendulum: exact solution agrees with Runge-Kutta, and the motions are told apart', () => {
  for (const [name, x0, p0, motion] of SWINGS) {
    const an = F.analytic(PENDULUM, x0, p0);
    assert.strictEqual(an.motion, motion, name);
    // On and next to the separatrix the motion is unstable: compare over 4 s only.
    const T = name.includes('separatrix') ? 4 : 20;
    const d = distance(F.integrate(PENDULUM, x0, p0, T), PENDULUM, an);
    assert.ok(Math.max(d.dx, d.dp) < 1e-7, `${name}: worst difference ${Math.max(d.dx, d.dp)}`);
  }
  const top = F.analytic(PENDULUM, 0, SEPARATRIX_P);
  assert.ok(Math.abs(top.x(40) - Math.PI) < 1e-12 && top.x(40) <= Math.PI, 'on the separatrix the top is approached, not passed');
  assert.ok(F.analytic(PENDULUM, 0, 7).x(20) > 20 * Math.PI, 'in rotation the angle keeps growing');
});

test('pendulum: period, and the harmonic limit', () => {
  const w0 = Math.sqrt(PENDULUM.g / PENDULUM.L), T0 = 2 * Math.PI / w0;
  for (const amplitude of [0.3, 1.0, 2.0, 3.0]) {
    const an = F.analytic(PENDULUM, amplitude, 0);
    assert.ok(Math.abs(an.amplitude - amplitude) < 1e-12 && Math.abs(an.kappa - Math.sin(amplitude / 2)) < 1e-15);
    assert.ok(Math.abs(an.period - 4 * quadratureF(Math.PI / 2, an.kappa ** 2) / w0) < 1e-8, 'period is 4 K / w0');
    const simulated = 2 * Math.PI / frequency(F.integrate(PENDULUM, amplitude, 0, 60));
    assert.ok(Math.abs(simulated - an.period) < 1e-6 * an.period, `amplitude ${amplitude}: ${simulated} against ${an.period}`);
    assert.ok(an.period > T0, 'the period grows with the amplitude');
  }
  const a = 0.3, series = T0 * (1 + a * a / 16 + 11 * a ** 4 / 3072);
  assert.ok(Math.abs(F.analytic(PENDULUM, a, 0).period - series) < 2e-7 * T0, 'series in the amplitude');
  const turn = F.analytic(PENDULUM, 0, 7);
  assert.ok(Math.abs(turn.x(turn.period) - 2 * Math.PI) < 1e-10, 'in rotation one turn takes the period');

  // A small oscillation is a harmonic oscillator in theta, of inertia M L^2 and constant M g L, up to terms of
  // relative order amplitude^2; with friction and forcing its coefficients are b L^2 and F0 L.
  const small = 1e-3, P = pendulum({ M: 0.7, L: 1.6 }), H = F.harmonicApproximation(P);
  assert.ok(Math.abs(H.k - P.M * P.g * P.L) < 1e-14 && Math.abs(H.M - P.M * P.L * P.L) < 1e-15 && H.system === 'oscillator');
  const full = pendulum({ M: 0.7, L: 1.6, b: 0.9, F0: 0.4 }), HF = F.harmonicApproximation(full);
  assert.ok(Math.abs(HF.b - 0.9 * 1.6 * 1.6) < 1e-15 && Math.abs(HF.F0 - 0.4 * 1.6) < 1e-15);
  assert.ok(Math.abs(F.derived(HF).w0 - F.derived(full).w0) < 1e-14 && Math.abs(F.derived(HF).gamma - F.derived(full).gamma) < 1e-15);
  const tiny = pendulum({ M: 0.7, L: 1.6, b: 0.9, F0: 1e-3 }), dForced = distance(F.solve(tiny, small, 0, 10), tiny, F.analytic(F.harmonicApproximation(tiny), small, 0));
  assert.ok(dForced.dx < 1e-5 * small, 'damped, forced small oscillation against the harmonic approximation: ' + dForced.dx);
  const d = distance(F.solve(P, small, 0, 10), P, F.analytic(H, small, 0));
  assert.ok(d.dx < 1e-5 * small, 'small oscillation against the harmonic approximation: ' + d.dx);
});

// ------------------------------------------------------------------------------------- the solution shown

test('solve: closed form when there is one, Runge-Kutta otherwise', () => {
  const linear = F.solve(with_({ b: 0.4, F0: 1 }), 1, 0, 30);
  assert.ok(linear.exact && linear.exact.kind === 'linear' && linear.step === null);
  assert.strictEqual(distance(linear, with_({ b: 0.4, F0: 1 }), linear.exact).dx, 0, 'the samples are those of the closed form');
  const free = F.solve(PENDULUM, 2, 0, 30);
  assert.ok(free.exact && free.exact.kind === 'pendulum' && free.step === null);
  for (const P of [pendulum({ b: 0.1 }), pendulum({ F0: 1 }), with_({ l4: 1 }), with_({ l3: 1, b: 2 })]) {
    const sol = F.solve(P, 1, 0, 10);
    assert.ok(sol.exact === null && sol.step === 1e-3, 'numerical, 1 ms: ' + JSON.stringify(P));
    assert.strictEqual(sol.n, 2001);
  }
});

test('solve: the step is shortened when the motion is fast', () => {
  const drift = (P, sol) => {
    const en = F.energies(P, sol);
    let worst = 0;
    for (let i = 0; i < sol.n; i++) worst = Math.max(worst, Math.abs(en.E[i] - en.E[0]));
    return worst / Math.abs(en.E[0]);
  };
  // Stiff quartic well released far out: the local frequency sqrt((k + 3 l4 x^2) / M) is 123 rad/s at x = 10,
  // so the step must be 0.05 / 123 s or less: 13 steps in the 5 ms between samples.
  const P = with_({ M: 0.1, k: 20, l4: 5 }), sol = F.solve(P, 10, 0, 20);
  assert.ok(Math.abs(sol.step - 0.005 / 13) < 1e-15 && !sol.failed && !sol.escaped, 'step ' + sol.step);
  assert.ok(drift(P, sol) < 5e-6, 'relative energy drift ' + drift(P, sol));
  assert.ok(drift(P, F.integrate(P, 10, 0, 20)) > 50 * drift(P, sol), 'the fixed step of 1 ms is much worse');
  // Ten times farther out (1225 rad/s): 123 steps between samples.
  const far = F.solve(P, 100, 0, 20);
  assert.ok(Math.abs(far.step - 0.005 / 123) < 1e-15 && drift(P, far) < 5e-5, 'far out: drift ' + drift(P, far));
  // The same over 120 s would take 3 million steps: the limit of 1.5 million sets the step instead.
  assert.ok(Math.abs(F.solve(P, 100, 0, 120).step - 0.005 / 62) < 1e-15);
  // Strong friction on a light mass: b / M = 100 per second.
  assert.strictEqual(F.solve(with_({ M: 0.1, b: 10, l4: 1 }), 1, 0, 10).step, 5e-4);
  // A pendulum spinning fast: the torque changes at the rate p / (M L^2) = 300 rad/s.
  assert.ok(Math.abs(F.solve(pendulum({ b: 0.01 }), 0, 300, 10).step - 0.005 / 30) < 1e-15);
});

test('advance: a solution continued in pieces is the solution computed at once', () => {
  // Forced and damped, so that the phase of the force and the state both have to carry over; none is chaotic.
  const cases = [['linear, closed form', with_({ b: 0.4, F0: 1, w: 1.7 }), 1, 0, 1e-12],
    ['undamped resonance, closed form', with_({ F0: 0.5, w: 2 }), 0.3, 0, 1e-11],
    ['pendulum, closed form', PENDULUM, 2.8, 0, 1e-12],
    ['anharmonic, Runge-Kutta', with_({ b: 0.3, l3: -0.5, l4: 1, F0: 1, w: 1.3 }), 0.5, 0, 1e-9],
    ['pendulum, Runge-Kutta', pendulum({ b: 0.5, F0: 2, w: 1.1 }), 1, 0, 1e-9]];
  for (const [name, P, x0, p0, tolerance] of cases) {
    const whole = F.solve(P, x0, p0, 45);
    let piece = F.solve(P, x0, p0, 15);
    for (let block = 1; block <= 2; block++) {
      const first = piece.n - 1;
      piece = F.advance(P, piece, 15);
      assert.strictEqual(piece.n, 3001, name);
      assert.ok(Math.abs(piece.t[0] - 15 * block) < 1e-9 && Math.abs(piece.t[piece.n - 1] - 15 * (block + 1)) < 1e-9, name + ': times');
      assert.strictEqual(piece.exact, whole.exact === null ? null : piece.exact, name);
      assert.strictEqual(piece.step, whole.step, name + ': step');
      for (const j of [0, 1, 700, 1999, 3000]) {
        const i = 3000 * block + j;
        assert.ok(Math.abs(piece.x[j] - whole.x[i]) < tolerance && Math.abs(piece.p[j] - whole.p[i]) < tolerance,
          `${name}: block ${block}, sample ${j}: ${piece.x[j] - whole.x[i]}`);
      }
      assert.ok(first === 3000);
    }
  }
  // The step of a continuation is never longer than the one before, and is shortened when the motion speeds up.
  const slow = F.solve(with_({ l4: 5, M: 0.1, k: 20, F0: 5, w: 14.1 }), 0, 0, 5), later = F.advance(with_({ l4: 5, M: 0.1, k: 20, F0: 5, w: 14.1 }), slow, 60);
  assert.ok(later.step <= slow.step);
});

test('solve: a mass at rest on an equilibrium point stays there', () => {
  for (const [P, x0, stable] of [[pendulum({ b: 0.3 }), Math.PI, false], [pendulum({ L: 2, b: 0 }), -Math.PI, false],
    [pendulum({ b: 0.3 }), 0, true], [with_({ l4: 2, b: 1 }), 0, true]]) {
    const sol = F.solve(P, x0, 0, 60);
    assert.ok(sol.exact && sol.exact.kind === 'rest' && sol.exact.stable === stable);
    assert.ok(sol.x[sol.n - 1] === x0 && sol.p[sol.n - 1] === 0);
  }
  assert.strictEqual(F.solve(pendulum({ b: 0.3, F0: 1 }), Math.PI, 0, 5).exact, null, 'not with an external force');
  assert.strictEqual(F.solve(pendulum({ b: 0.3 }), Math.PI, 1e-9, 5).exact, null, 'nor with any momentum');
});

test('every formula is valid LaTeX', () => {
  const katex = require(path.join('..', 'vendor', 'katex', 'katex.min.js'));
  const render = s => katex.renderToString(s, { throwOnError: true, displayMode: true });
  const all = LINEAR.concat([['anharmonic', with_({ b: 0.3, l3: -1, l4: 2, F0: 1 }), 1, 0], ['anharmonic at rest', with_({ l4: 2 }), 0, 0],
    ['damped pendulum', pendulum({ b: 0.3 }), 1, 0], ['inverted pendulum', pendulum({ b: 0.3 }), Math.PI, 0]],
    SWINGS.map(([name, x0, p0]) => ['pendulum, ' + name, PENDULUM, x0, p0]), [['pendulum in another well', PENDULUM, 7, 1]]);
  for (const [name, P, x0, p0] of all) {
    const an = F.analytic(P, x0, p0), eq = Formulas.equation(P), D = F.derived(P), s = Formulas.solution(P, D, an);
    for (const piece of [eq.symbolic, eq.numeric, Formulas.potential(P)].concat(s.formula || [], s.definitions, s.values)) {
      assert.doesNotThrow(() => render(piece), name + ': ' + piece);
    }
    assert.strictEqual(s.formula === null, an === null, name);
    assert.ok(s.note.length > 0);
  }
  assert.strictEqual(Formulas.text(-0.4), '−0,400');
  assert.strictEqual(Formulas.text(12345.6), '1,23×10⁴');
  assert.strictEqual(Formulas.text(-0.000123), '−1,23×10⁻⁴');
  assert.strictEqual(Formulas.text(99996), '1,00×10⁵');
  assert.strictEqual(Formulas.tex(2), '2{,}00');
  assert.strictEqual(Formulas.method(null), 'Calculado analiticamente.');
  assert.ok(Formulas.method(1e-3).endsWith('passo de 1 ms.') && Formulas.method(5e-4).endsWith('passo de 0,5 ms.') && Formulas.method(2.5e-5).endsWith('passo de 25 µs.'));
});

test('sliders: the grid has the ends of the range and the multiples of the step', () => {
  global.window = {};
  require('../js/controles.js');
  const { Control } = global.window.Controles;
  /** The grid of a slider with this range and step, without building the slider itself. */
  const grid = (min, max, step) => {
    const control = Object.create(Control.prototype);
    control.spec = { min, max, step };
    control.input = {};
    control.layout();
    return control;
  };

  const round = grid(-1.2, 1.2, 0.01);                  // both ends are multiples of the step
  assert.strictEqual(round.count, 241);
  assert.deepStrictEqual([round.valueAt(0), round.valueAt(120), round.valueAt(150), round.valueAt(240)], [-1.2, 0, 0.3, 1.2]);
  assert.deepStrictEqual([round.indexOf(-5), round.indexOf(0), round.indexOf(0.3), round.indexOf(0.304), round.indexOf(5)], [0, 120, 150, 150, 240]);

  const turn = grid(-Math.PI, Math.PI, 0.02);           // neither end is: x0 of a pendulum with L = 1 m
  assert.strictEqual(turn.count, 317);
  assert.deepStrictEqual([turn.valueAt(0), turn.valueAt(1), turn.valueAt(158), turn.valueAt(315), turn.valueAt(316)], [-Math.PI, -3.14, 0, 3.14, Math.PI]);
  assert.deepStrictEqual([turn.indexOf(-Math.PI), turn.indexOf(-3.1412), turn.indexOf(0), turn.indexOf(3.1403), turn.indexOf(Math.PI)], [0, 0, 158, 315, 316]);

  const time = grid(0, 1.745, 0.01);                    // only the upper end is not: the time bar
  assert.strictEqual(time.count, 176);
  assert.deepStrictEqual([time.valueAt(0), time.valueAt(174), time.valueAt(175)], [0, 1.74, 1.745]);

  const narrow = grid(0.011, 0.019, 0.01);              // no multiple of the step inside: the two ends alone
  assert.deepStrictEqual([narrow.count, narrow.valueAt(0), narrow.valueAt(1), narrow.indexOf(0.012), narrow.indexOf(0.018)], [2, 0.011, 0.019, 0, 1]);

  for (const g of [round, turn, time, narrow, grid(0, 120, 5), grid(-1000, 1000, 10), grid(0.1, 5, 0.05)]) {
    assert.deepStrictEqual([g.input.min, g.input.max, g.input.step], [0, g.count - 1, 1]);
    for (let i = 0; i < g.count; i++) {
      assert.strictEqual(g.indexOf(g.valueAt(i)), i, 'index of value ' + i);
      if (i) assert.ok(g.valueAt(i) > g.valueAt(i - 1), 'increasing at ' + i);
    }
  }
});
