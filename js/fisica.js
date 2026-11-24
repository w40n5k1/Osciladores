// By Bruno Mota - METAbio
/**
 * Physics of the one-dimensional oscillator shown by the page.
 *
 * Equation of motion (Newton's second law for a mass M):
 *
 *     M x'' + b x' + k x + l3 x^2 + l4 x^3 = F0 cos(w t)
 *
 * The conservative force derives from the potential
 *
 *     V(x) = k x^2 / 2 + l3 x^3 / 3 + l4 x^4 / 4 ,
 *
 * so l3 and l4 are the coefficients of the quadratic and cubic terms of the FORCE (cubic and quartic terms of
 * the potential, up to the factors 1/3 and 1/4).  The momentum is p = M x'.
 *
 * A set of parameters is a plain object  P = {M, k, b, l3, l4, F0, w}  in SI units
 * (kg, N/m, kg/s, N/m^2, N/m^3, N, rad/s).  M > 0 and k > 0 are assumed throughout.
 *
 * What is here:
 *   derived(P)                 natural frequency, damping rate, damping regime, resonance, critical values
 *   potential, force, energy   V(x), -dV/dx, p^2/2M + V
 *   equilibria(P), confining(P)
 *   integrate(P, x0, p0, T)    numerical solution by the classical fourth-order Runge-Kutta method
 *   analytic(P, x0, p0)        closed-form solution of the linear case (l3 = l4 = 0); null otherwise
 *   steadyState(P)             amplitude and phase lag of the forced linear oscillator
 *
 * No browser objects are used: the file also loads in node, where tests/teste_fisica.js checks the numerical
 * solution against the closed forms.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fisica = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Relative tolerance within which the damping counts as critical (gamma = w0). */
  const CRITICAL_TOL = 1e-9;
  /** |x| beyond which a trajectory counts as having escaped to infinity. */
  const ESCAPE_X = 1e6;

  /**
   * Quantities that follow from the parameters.
   *   w0      natural angular frequency of the linear oscillator, sqrt(k/M)
   *   gamma   damping rate b/2M: the free amplitude falls as exp(-gamma t)
   *   regime  'none' (b = 0), 'under' (gamma < w0), 'critical' (gamma = w0), 'over' (gamma > w0)
   *   w1      angular frequency of the damped oscillation, sqrt(w0^2 - gamma^2)   ('none' and 'under')
   *   q       sqrt(gamma^2 - w0^2): the two decay rates are gamma -+ q             ('over')
   *   Q       quality factor w0 / 2 gamma
   *   wr      forcing frequency of maximum steady-state amplitude, sqrt(w0^2 - 2 gamma^2); null if there is none
   *   bc, kc, Mc   value of b, k or M that makes the damping critical, the other two held fixed
   *   harmonic     true when l3 = l4 = 0
   */
  function derived(P) {
    const w0 = Math.sqrt(P.k / P.M);
    const gamma = P.b / (2 * P.M);
    let regime;
    if (gamma === 0) regime = 'none';
    else if (Math.abs(gamma - w0) <= CRITICAL_TOL * w0) regime = 'critical';
    else regime = gamma < w0 ? 'under' : 'over';
    const wr2 = w0 * w0 - 2 * gamma * gamma;
    return {
      w0, gamma, regime,
      w1: regime === 'none' || regime === 'under' ? Math.sqrt(w0 * w0 - gamma * gamma) : 0,
      q: regime === 'over' ? Math.sqrt(gamma * gamma - w0 * w0) : 0,
      Q: gamma > 0 ? w0 / (2 * gamma) : Infinity,
      wr: gamma > 0 && wr2 > 0 ? Math.sqrt(wr2) : null,
      bc: 2 * Math.sqrt(P.k * P.M),
      kc: P.b * P.b / (4 * P.M),
      Mc: P.b * P.b / (4 * P.k),
      harmonic: P.l3 === 0 && P.l4 === 0,
    };
  }

  /** Potential energy V(x). */
  function potential(P, x) {
    return x * x * (P.k / 2 + x * (P.l3 / 3 + x * P.l4 / 4));
  }

  /** Conservative force -dV/dx. */
  function force(P, x) {
    return -x * (P.k + x * (P.l3 + x * P.l4));
  }

  /** Curvature of the potential, d2V/dx2. */
  function curvature(P, x) {
    return P.k + x * (2 * P.l3 + 3 * x * P.l4);
  }

  /** Mechanical energy p^2/2M + V(x). */
  function energy(P, x, p) {
    return p * p / (2 * P.M) + potential(P, x);
  }

  /**
   * Equilibrium points: the zeros of the force, x (k + l3 x + l4 x^2) = 0, in increasing order.
   * Each is {x, stable}: stable where the potential has a minimum (positive curvature).
   */
  function equilibria(P) {
    const xs = [0];
    if (P.l4 === 0) {
      if (P.l3 !== 0) xs.push(-P.k / P.l3);
    } else {
      const disc = P.l3 * P.l3 - 4 * P.l4 * P.k;
      if (disc > 0) {
        const s = Math.sqrt(disc);
        xs.push((-P.l3 - s) / (2 * P.l4), (-P.l3 + s) / (2 * P.l4));
      }
    }
    return xs.sort((a, b) => a - b).map(x => ({ x, stable: curvature(P, x) > 0 }));
  }

  /** True when V(x) grows without bound on both sides, so that no trajectory can run away. */
  function confining(P) {
    return P.l4 > 0 || (P.l4 === 0 && P.l3 === 0);
  }

  /**
   * Numerical solution from t = 0 to T, starting at (x0, p0), by the classical fourth-order Runge-Kutta method
   * applied to the first-order system
   *
   *     x' = p / M ,      p' = -b p / M - k x - l3 x^2 - l4 x^3 + F0 cos(w t) .
   *
   * dtOut is the spacing of the stored samples and `substeps` the number of Runge-Kutta steps between two of
   * them.  With the defaults the step is 1 ms, some 150 steps in the shortest period the controls allow.
   *
   * Returns {t, x, p, n, dt, escaped}: t, x and p are Float64Arrays of which the first n entries are valid.
   * If the potential is not confining the mass can run away to infinity in a finite time; the integration then
   * stops (escaped = true) and n is smaller than the length of the arrays.
   */
  function integrate(P, x0, p0, T, options) {
    const dtOut = (options && options.dtOut) || 0.005;
    const substeps = (options && options.substeps) || 5;
    const nMax = Math.round(T / dtOut) + 1;
    const h = dtOut / substeps;
    const { M, k, b, l3, l4, F0, w } = P;
    const dp = (t, x, p) => -b * p / M - x * (k + x * (l3 + x * l4)) + F0 * Math.cos(w * t);

    const t = new Float64Array(nMax), xs = new Float64Array(nMax), ps = new Float64Array(nMax);
    let x = x0, p = p0, n = 1, escaped = false;
    xs[0] = x; ps[0] = p;
    for (let i = 1; i < nMax && !escaped; i++) {
      for (let s = 0; s < substeps; s++) {
        const ts = ((i - 1) * substeps + s) * h;
        const k1x = p / M, k1p = dp(ts, x, p);
        const k2x = (p + h / 2 * k1p) / M, k2p = dp(ts + h / 2, x + h / 2 * k1x, p + h / 2 * k1p);
        const k3x = (p + h / 2 * k2p) / M, k3p = dp(ts + h / 2, x + h / 2 * k2x, p + h / 2 * k2p);
        const k4x = (p + h * k3p) / M, k4p = dp(ts + h, x + h * k3x, p + h * k3p);
        x += h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
        p += h / 6 * (k1p + 2 * k2p + 2 * k3p + k4p);
      }
      if (!isFinite(x) || !isFinite(p) || Math.abs(x) > ESCAPE_X) { escaped = true; break; }
      t[i] = i * dtOut; xs[i] = x; ps[i] = p; n = i + 1;
    }
    return { t, x: xs, p: ps, n, dt: dtOut, escaped };
  }

  /** Kinetic, potential and total energy along a solution: {K, U, E}, arrays of length sol.n. */
  function energies(P, sol) {
    const K = new Float64Array(sol.n), U = new Float64Array(sol.n), E = new Float64Array(sol.n);
    for (let i = 0; i < sol.n; i++) {
      K[i] = sol.p[i] * sol.p[i] / (2 * P.M);
      U[i] = potential(P, sol.x[i]);
      E[i] = K[i] + U[i];
    }
    return { K, U, E };
  }

  /**
   * Steady state of the forced linear oscillator, x_p(t) = A cos(w t - delta), with
   *
   *     A = (F0/M) / sqrt((w0^2 - w^2)^2 + 4 gamma^2 w^2) ,     tan(delta) = 2 gamma w / (w0^2 - w^2) ,
   *
   * delta between 0 and pi.  Returns {A, delta}; null when there is no forcing or when A is infinite
   * (no damping and w = w0 exactly).
   */
  function steadyState(P) {
    if (P.F0 === 0) return null;
    const D = derived(P);
    const re = D.w0 * D.w0 - P.w * P.w, im = 2 * D.gamma * P.w;
    const den = Math.hypot(re, im);
    if (den <= CRITICAL_TOL * D.w0 * D.w0) return null;
    return { A: (P.F0 / P.M) / den, delta: Math.atan2(im, re) };
  }

  /**
   * Closed-form solution of the linear oscillator (l3 = l4 = 0) with x(0) = x0 and p(0) = p0; null if the
   * oscillator is not linear.
   *
   * The solution is x = x_h + x_p: a solution x_h of the equation without forcing, which carries the initial
   * conditions, plus a particular solution x_p of the forced equation.
   *
   *   homogeneous      'none'      C1 cos(w0 t) + C2 sin(w0 t)
   *                    'under'     exp(-gamma t) [C1 cos(w1 t) + C2 sin(w1 t)]
   *                    'critical'  (C1 + C2 t) exp(-gamma t)
   *                    'over'      C1 exp(-(gamma - q) t) + C2 exp(-(gamma + q) t)
   *   particular       'none'      0                                        (F0 = 0)
   *                    'steady'    A cos(w t - delta)                       (see steadyState)
   *                    'resonant'  (F0 / 2 M w0) t sin(w0 t)                (no damping and w = w0)
   *
   * Returns {homogeneous, particular, C1, C2, A, delta, x(t), v(t), xh(t), xp(t)}.
   */
  function analytic(P, x0, p0) {
    const D = derived(P);
    if (!D.harmonic) return null;
    const { w0, gamma, w1, q } = D;
    const v0 = p0 / P.M;

    // Particular solution and its value and derivative at t = 0.
    let particular = 'none', A = 0, delta = 0, xp = () => 0, vp = () => 0;
    if (P.F0 !== 0) {
      const st = steadyState(P);
      if (st) {
        particular = 'steady'; A = st.A; delta = st.delta;
        xp = t => A * Math.cos(P.w * t - delta);
        vp = t => -A * P.w * Math.sin(P.w * t - delta);
      } else {
        particular = 'resonant'; A = P.F0 / (2 * P.M * w0);
        xp = t => A * t * Math.sin(w0 * t);
        vp = t => A * (Math.sin(w0 * t) + w0 * t * Math.cos(w0 * t));
      }
    }

    // Homogeneous solution with x_h(0) = a and x_h'(0) = c.
    const a = x0 - xp(0), c = v0 - vp(0);
    let C1, C2, xh, vh;
    if (D.regime === 'none' || D.regime === 'under') {
      C1 = a; C2 = (c + gamma * a) / w1;
      xh = t => Math.exp(-gamma * t) * (C1 * Math.cos(w1 * t) + C2 * Math.sin(w1 * t));
      vh = t => Math.exp(-gamma * t) * ((C2 * w1 - gamma * C1) * Math.cos(w1 * t) - (C1 * w1 + gamma * C2) * Math.sin(w1 * t));
    } else if (D.regime === 'critical') {
      C1 = a; C2 = c + gamma * a;
      xh = t => (C1 + C2 * t) * Math.exp(-gamma * t);
      vh = t => (C2 - gamma * (C1 + C2 * t)) * Math.exp(-gamma * t);
    } else {
      const r1 = -(gamma - q), r2 = -(gamma + q);
      C1 = (c - r2 * a) / (2 * q); C2 = (r1 * a - c) / (2 * q);
      xh = t => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
      vh = t => C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t);
    }
    return {
      homogeneous: D.regime, particular, C1, C2, A, delta, xh, xp,
      x: t => xh(t) + xp(t),
      v: t => vh(t) + vp(t),
    };
  }

  return { derived, potential, force, curvature, energy, equilibria, confining, integrate, energies, steadyState, analytic, ESCAPE_X };
});
