// By Bruno Mota - METAbio
/**
 * Physics of the two one-dimensional systems shown by the page.
 *
 * Oscillator (P.system = 'oscillator', the default).  Newton's second law for a mass M:
 *
 *     M x'' + b x' + k x + l3 x^2 + l4 x^3 = F0 cos(w t) ,        V(x) = k x^2/2 + l3 x^3/3 + l4 x^4/4 ,
 *
 * so l3 and l4 multiply x^2 and x^3 in the FORCE (x^3/3 and x^4/4 in the potential).
 *
 * Pendulum (P.system = 'pendulum').  A mass M on a rigid rod of length L, in gravity g.  The coordinate x is
 * the arc length along the circular path, measured from the lowest point: the angle is x / L.  Friction and
 * the external force act along the path, so the tangential component of Newton's law reads
 *
 *     M x'' + b x' + M g sin(x / L) = F0 cos(w t) ,               V(x) = M g L [1 - cos(x / L)] .
 *
 * In both systems p = M x' is the momentum conjugate to x, and the units are SI.  For |x| << L the pendulum
 * is the oscillator with k = M g / L: that is its "harmonic approximation".
 *
 * A set of parameters is a plain object  P = {system, M, k, b, l3, l4, F0, w, L, g};  k, l3 and l4 are used
 * by the oscillator only, L and g by the pendulum only.  M, k, L and g are positive.
 *
 * What is here:
 *   derived(P)                   natural frequency, damping rate and regime, resonance, critical values
 *   potential, force, curvature, energy
 *   equilibria(P), confining(P)
 *   analytic(P, x0, p0)          closed-form solution when there is one, null otherwise:
 *                                  the linear oscillator (l3 = l4 = 0), in every damping regime, free or forced;
 *                                  the pendulum without friction or forcing, in Jacobi elliptic functions;
 *                                  a mass at rest at an equilibrium point
 *   integrate(P, x0, p0, T)      numerical solution by the classical fourth-order Runge-Kutta method
 *   solve(P, x0, p0, T)          the solution the page shows: the closed form if there is one, Runge-Kutta if not
 *   steadyState(P)               amplitude and phase lag of the forced linear oscillator
 *   harmonicApproximation(P)     parameters of the linear oscillator that approximates P for small amplitudes
 *   jacobi, ellipticK, ellipticF Jacobi elliptic functions and elliptic integrals of the first kind
 *
 * No browser objects are used: the file also loads in node, where tests/teste_fisica.js checks it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fisica = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Relative tolerance within which the damping counts as critical (gamma = w0). */
  const CRITICAL_TOL = 1e-9;
  /** |x| beyond which a trajectory in a potential that does not confine counts as gone to infinity. */
  const ESCAPE_X = 1e6;
  /** |1 - kappa^2| below which the pendulum counts as being exactly on the separatrix. */
  const SEPARATRIX_TOL = 1e-13;
  /** Largest product (rate of the motion) x (Runge-Kutta step) accepted by solve(). */
  const RESOLUTION = 0.05;
  /** Largest number of Runge-Kutta steps between two stored samples, and in one solution. */
  const MAX_SUBSTEPS = 200, MAX_STEPS = 1.5e6;

  const isPendulum = P => P.system === 'pendulum';

  // ----------------------------------------------------------------------------------- parameters

  /** Constant of the linear part of the restoring force: k, or M g / L for the pendulum. */
  function stiffness(P) {
    return isPendulum(P) ? P.M * P.g / P.L : P.k;
  }

  /** The linear oscillator that P reduces to for small amplitudes (same M, b and forcing). */
  function harmonicApproximation(P) {
    return { system: 'oscillator', M: P.M, k: stiffness(P), b: P.b, l3: 0, l4: 0, F0: P.F0, w: P.w };
  }

  /**
   * Quantities that follow from the parameters.  All refer to the linear part of the force.
   *   w0      natural angular frequency: sqrt(k/M), or sqrt(g/L) for the pendulum
   *   gamma   damping rate b/2M: the free amplitude falls as exp(-gamma t)
   *   regime  'none' (b = 0), 'under' (gamma < w0), 'critical' (gamma = w0), 'over' (gamma > w0)
   *   w1      angular frequency of the damped oscillation, sqrt(w0^2 - gamma^2)   ('none' and 'under')
   *   q       sqrt(gamma^2 - w0^2): the two decay rates are gamma -+ q             ('over')
   *   Q       quality factor w0 / 2 gamma
   *   wr      forcing frequency of maximum steady-state amplitude, sqrt(w0^2 - 2 gamma^2); null if there is none
   *   band    [lower, upper] forcing frequencies at which the absorbed power is half its maximum (which is
   *           at w0): sqrt(w0^2 + gamma^2) -+ gamma, a band of width exactly 2 gamma; null without damping
   *   bc, Mc, kc, Lc, gc   value of b, M, k, L or g that makes the damping critical, the others held fixed
   *   harmonic             true for the linear oscillator (not the pendulum, and l3 = l4 = 0)
   */
  function derived(P) {
    const pendulum = isPendulum(P);
    const w0 = pendulum ? Math.sqrt(P.g / P.L) : Math.sqrt(P.k / P.M);
    const gamma = P.b / (2 * P.M);
    let regime;
    if (gamma === 0) regime = 'none';
    else if (Math.abs(gamma - w0) <= CRITICAL_TOL * w0) regime = 'critical';
    else regime = gamma < w0 ? 'under' : 'over';
    const wr2 = w0 * w0 - 2 * gamma * gamma, center = Math.hypot(w0, gamma);
    return {
      w0, gamma, regime,
      w1: regime === 'none' || regime === 'under' ? Math.sqrt(w0 * w0 - gamma * gamma) : 0,
      q: regime === 'over' ? Math.sqrt(gamma * gamma - w0 * w0) : 0,
      Q: gamma > 0 ? w0 / (2 * gamma) : Infinity,
      wr: gamma > 0 && wr2 > 0 ? Math.sqrt(wr2) : null,
      band: gamma > 0 ? [center - gamma, center + gamma] : null,
      bc: pendulum ? 2 * P.M * w0 : 2 * Math.sqrt(P.k * P.M),
      Mc: pendulum ? P.b / (2 * w0) : P.b * P.b / (4 * P.k),
      kc: P.b * P.b / (4 * P.M),
      Lc: pendulum && gamma > 0 ? P.g / (gamma * gamma) : null,
      gc: pendulum ? gamma * gamma * P.L : null,
      harmonic: !pendulum && P.l3 === 0 && P.l4 === 0,
    };
  }

  /** Potential energy V(x). */
  function potential(P, x) {
    if (isPendulum(P)) return P.M * P.g * P.L * (1 - Math.cos(x / P.L));
    return x * x * (P.k / 2 + x * (P.l3 / 3 + x * P.l4 / 4));
  }

  /** Conservative force -dV/dx. */
  function force(P, x) {
    if (isPendulum(P)) return -P.M * P.g * Math.sin(x / P.L);
    return -x * (P.k + x * (P.l3 + x * P.l4));
  }

  /** Curvature of the potential, d2V/dx2. */
  function curvature(P, x) {
    if (isPendulum(P)) return P.M * P.g / P.L * Math.cos(x / P.L);
    return P.k + x * (2 * P.l3 + 3 * x * P.l4);
  }

  /** Mechanical energy p^2/2M + V(x). */
  function energy(P, x, p) {
    return p * p / (2 * P.M) + potential(P, x);
  }

  /**
   * Equilibrium points, in increasing order.  Each is {x, stable}: stable where the potential has a minimum.
   * Oscillator: the zeros of x (k + l3 x + l4 x^2).  Pendulum: the lowest point and the two inverted positions
   * at x = -+ pi L that bound one turn (the same point of the circle).
   */
  function equilibria(P) {
    if (isPendulum(P)) {
      return [{ x: -Math.PI * P.L, stable: false }, { x: 0, stable: true }, { x: Math.PI * P.L, stable: false }];
    }
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

  /**
   * True when no trajectory can run away to infinity in a finite time: the pendulum (bounded force), and the
   * oscillator whose potential grows without bound on both sides.
   */
  function confining(P) {
    return isPendulum(P) || P.l4 > 0 || (P.l4 === 0 && P.l3 === 0);
  }

  // ----------------------------------------------------------------------------------- elliptic functions

  /**
   * The arithmetic-geometric mean sequences a_n, c_n for the parameter m = k^2 (0 <= m < 1), with mc = 1 - m:
   *     a_0 = 1, b_0 = sqrt(mc), c_0 = sqrt(m);   a_{n+1} = (a_n + b_n)/2, b_{n+1} = sqrt(a_n b_n), c_{n+1} = (a_n - b_n)/2.
   * They converge quadratically; a_N is the mean.  (Abramowitz & Stegun 16.4 and 17.6; DLMF 19.8, 22.20.)
   */
  function agm(m, mc) {
    const a = [1], c = [Math.sqrt(m)];
    let b = Math.sqrt(mc), n = 0;
    while (Math.abs(c[n]) > 1e-16 * a[n] && n < 40) {
      const an = a[n];
      a.push((an + b) / 2); c.push((an - b) / 2); b = Math.sqrt(an * b); n++;
    }
    return { a, c, n };
  }

  /** Complete elliptic integral of the first kind, K(m) = pi / (2 agm(1, sqrt(1 - m))).  mc = 1 - m. */
  function ellipticK(m, mc) {
    const s = agm(m, mc === undefined ? 1 - m : mc);
    return Math.PI / (2 * s.a[s.n]);
  }

  /**
   * Jacobi elliptic functions of parameter m = k^2, 0 <= m < 1.  Returns the function u -> {sn, cn, dn, am},
   * where am is the amplitude: sn = sin(am), cn = cos(am), d(am)/du = dn.
   *
   * Method (Abramowitz & Stegun 16.4): with phi_N = 2^N a_N u, descend  phi_{n-1} = [phi_n + asin(c_n sin(phi_n) / a_n)] / 2
   * to phi_0 = am(u).  dn is taken from dn^2 = mc + m cn^2, a sum of positive terms.
   * mc = 1 - m may be passed when it is known more accurately than by subtraction (m close to 1).
   */
  function jacobi(m, mc) {
    if (mc === undefined) mc = 1 - m;
    const { a, c, n } = agm(m, mc), scale = Math.pow(2, n) * a[n];
    return function (u) {
      let phi = scale * u;
      for (let i = n; i > 0; i--) phi = (phi + Math.asin(c[i] * Math.sin(phi) / a[i])) / 2;
      const sn = Math.sin(phi), cn = Math.cos(phi);
      return { sn, cn, dn: Math.sqrt(mc + m * cn * cn), am: phi };
    };
  }

  /**
   * Carlson's symmetric integral R_F(x, y, z) = (1/2) int_0^inf dt / sqrt((t + x)(t + y)(t + z)), by duplication
   * (B. C. Carlson, Numer. Math. 33, 1 (1979)): the arguments are brought together by repeated use of the
   * duplication theorem and the result is a short series about their mean.  x, y, z >= 0, at most one zero.
   */
  function carlsonRF(x, y, z) {
    let dx, dy, dz, mean;
    do {
      const sx = Math.sqrt(x), sy = Math.sqrt(y), sz = Math.sqrt(z), lambda = sx * (sy + sz) + sy * sz;
      x = (x + lambda) / 4; y = (y + lambda) / 4; z = (z + lambda) / 4;
      mean = (x + y + z) / 3;
      dx = (mean - x) / mean; dy = (mean - y) / mean; dz = (mean - z) / mean;
    } while (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) > 0.0025);
    const e2 = dx * dy - dz * dz, e3 = dx * dy * dz;
    return (1 + (e2 / 24 - 0.1 - 3 * e3 / 44) * e2 + e3 / 14) / Math.sqrt(mean);
  }

  /**
   * Incomplete elliptic integral of the first kind, F(phi | m) = int_0^phi dt / sqrt(1 - m sin^2 t), for any
   * real phi and 0 <= m < 1.  For |phi| <= pi/2, F = sin(phi) R_F(cos^2 phi, 1 - m sin^2 phi, 1); otherwise
   * F(phi + n pi) = F(phi) + 2 n K(m).  It is the inverse of the amplitude: am(F(phi | m)) = phi.
   */
  function ellipticF(phi, m, mc) {
    if (mc === undefined) mc = 1 - m;
    const turns = Math.round(phi / Math.PI), rest = phi - turns * Math.PI;
    const s = Math.sin(rest), c = Math.cos(rest);
    const part = s * carlsonRF(c * c, mc + m * c * c, 1);
    return turns === 0 ? part : part + 2 * turns * ellipticK(m, mc);
  }

  // ----------------------------------------------------------------------------------- closed forms

  /**
   * Steady state of the forced linear oscillator, x_p(t) = A cos(w t - delta), with
   *
   *     A = (F0/M) / sqrt((w0^2 - w^2)^2 + 4 gamma^2 w^2) ,     tan(delta) = 2 gamma w / (w0^2 - w^2) ,
   *
   * delta between 0 and pi.  Returns {A, delta}; null when there is no forcing or when A is infinite
   * (no damping and w = w0 exactly).  For the pendulum and the anharmonic oscillator this is the steady state
   * of the harmonic approximation.
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
   * Closed-form solution of the linear oscillator with x(0) = x0 and p(0) = p0.
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
   * Returns {kind: 'linear', homogeneous, particular, C1, C2, A, delta, x(t), v(t), xh(t), xp(t)}.
   */
  function linearExact(P, x0, p0) {
    const D = derived(P);
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
      kind: 'linear', homogeneous: D.regime, particular, C1, C2, A, delta, xh, xp,
      x: t => xh(t) + xp(t),
      v: t => vh(t) + vp(t),
    };
  }

  /**
   * Exact solution of the pendulum without friction or forcing.
   *
   * With theta = x/L and w0 = sqrt(g/L), the energy E = p^2/2M + M g L (1 - cos theta) is constant.  Writing
   * kappa^2 = E / (2 M g L) and 1 - cos theta = 2 sin^2(theta/2):
   *
   *     theta'^2 = 4 w0^2 [kappa^2 - sin^2(theta/2)] .
   *
   *   'libration' (kappa < 1): the pendulum swings between -+ theta_max, kappa = sin(theta_max / 2).  The
   *       substitution sin(theta/2) = kappa sin(phi) gives phi' = w0 sqrt(1 - kappa^2 sin^2 phi), hence
   *           sin(theta/2) = kappa sn(w0 t + u0 | kappa^2) ,    theta' = 2 kappa w0 cn(w0 t + u0 | kappa^2) ,
   *       with period 4 K(kappa^2) / w0.
   *   'rotation' (kappa > 1): theta' never vanishes; with phi = theta/2, phi' = +- kappa w0 sqrt(1 - sin^2 phi / kappa^2):
   *           theta = 2 am(+- kappa w0 t + u0 | 1/kappa^2) ,    theta' = +- 2 kappa w0 dn(same) ,
   *       one turn taking 2 K(1/kappa^2) / (kappa w0).
   *   'separatrix' (kappa = 1): sin(theta/2) = tanh(+- w0 t + u0): the inverted position is approached and
   *       never reached.  (Written below as theta = 2 atan(sinh u), the same function.)
   *
   * u0 is fixed by the initial condition through the incomplete integral F.  Returns
   * {kind: 'pendulum', motion, kappa, u0, sign, base, period, amplitude, x(t), v(t)}: sign is that of the
   * initial velocity, base the bottom of the well the motion starts in, amplitude is theta_max.  x is not
   * reduced to one turn.
   */
  function pendulumExact(P, x0, p0) {
    const L = P.L, w0 = Math.sqrt(P.g / L), turn = 2 * Math.PI * L;
    // Lowest point of the well the motion starts in (x0 = -+ pi L counts as the well around 0), and the
    // initial angle, in [-pi, pi], and angular velocity.
    const base = Math.abs(x0) <= turn / 2 ? 0 : turn * Math.round(x0 / turn);
    const theta0 = (x0 - base) / L, rate0 = p0 / (P.M * L);
    const s0 = Math.sin(theta0 / 2), c0 = Math.cos(theta0 / 2), r0 = rate0 / (2 * w0);
    const m = s0 * s0 + r0 * r0;                               // kappa^2
    const mc = c0 * c0 - r0 * r0;                              // 1 - kappa^2
    const kappa = Math.sqrt(m), sign = rate0 < 0 ? -1 : 1;
    const out = { kind: 'pendulum', kappa, base, sign };

    if (Math.abs(mc) <= SEPARATRIX_TOL) {
      const u0 = Math.atanh(s0);
      const u = t => sign * w0 * t + u0;
      return Object.assign(out, {
        motion: 'separatrix', u0, period: Infinity, amplitude: Math.PI,
        x: t => base + 2 * L * Math.atan(Math.sinh(u(t))),
        v: t => 2 * L * w0 * sign / Math.cosh(u(t)),
      });
    }
    if (mc > 0) {
      const fn = jacobi(m, mc), u0 = ellipticF(Math.atan2(s0, r0), m, mc);
      return Object.assign(out, {
        motion: 'libration', u0, period: 4 * ellipticK(m, mc) / w0, amplitude: 2 * Math.asin(kappa),
        x: t => base + 2 * L * Math.asin(kappa * fn(w0 * t + u0).sn),
        v: t => 2 * L * w0 * kappa * fn(w0 * t + u0).cn,
      });
    }
    const mr = 1 / m, mrc = -mc / m;                           // parameter 1/kappa^2 and its complement
    const fn = jacobi(mr, mrc), u0 = ellipticF(theta0 / 2, mr, mrc);
    return Object.assign(out, {
      motion: 'rotation', u0, period: 2 * ellipticK(mr, mrc) / (kappa * w0), amplitude: null,
      x: t => base + 2 * L * fn(sign * kappa * w0 * t + u0).am,
      v: t => 2 * L * w0 * kappa * sign * fn(sign * kappa * w0 * t + u0).dn,
    });
  }

  /** True for a mass placed at rest exactly on an equilibrium point, with no external force. */
  function atRest(P, x0, p0) {
    if (p0 !== 0 || P.F0 !== 0) return false;
    const scale = isPendulum(P) ? P.M * P.g : P.k * Math.abs(x0);
    return Math.abs(force(P, x0)) <= 1e-12 * scale;
  }

  /**
   * Closed-form solution with x(0) = x0 and p(0) = p0, or null if there is none:
   *   {kind: 'linear', ...}     the linear oscillator (see linearExact)
   *   {kind: 'pendulum', ...}   the pendulum without friction or forcing (see pendulumExact)
   *   {kind: 'rest', stable}    a mass at rest on an equilibrium point of a nonlinear system: it stays there
   * Every kind has x(t) and v(t).
   */
  function analytic(P, x0, p0) {
    if (derived(P).harmonic) return linearExact(P, x0, p0);
    if (atRest(P, x0, p0)) return { kind: 'rest', stable: curvature(P, x0) > 0, x: () => x0, v: () => 0 };
    if (isPendulum(P) && P.b === 0 && P.F0 === 0) return pendulumExact(P, x0, p0);
    return null;
  }

  // ----------------------------------------------------------------------------------- numerical solution

  /**
   * Numerical solution from t = 0 to T, starting at (x0, p0), by the classical fourth-order Runge-Kutta method
   * applied to the first-order system
   *
   *     x' = p / M ,      p' = -b p / M - dV/dx + F0 cos(w t) .
   *
   * dtOut is the spacing of the stored samples and `substeps` the number of Runge-Kutta steps between two of
   * them: the step is h = dtOut / substeps, 1 ms with the defaults.
   *
   * Returns {t, x, p, n, dt, escaped, failed}: t, x and p are Float64Arrays of which the first n entries are
   * valid.  If the potential does not confine, the mass can run away to infinity in a finite time: the
   * integration then stops (escaped = true).  If it confines and the numbers still overflow, the step was too
   * long for the method (failed = true).
   */
  function integrate(P, x0, p0, T, options) {
    const dtOut = (options && options.dtOut) || 0.005;
    const substeps = (options && options.substeps) || 5;
    const nMax = Math.round(T / dtOut) + 1;
    const h = dtOut / substeps, half = h / 2;
    const { M, k, l3, l4, F0, w, L } = P, weight = M * P.g, friction = P.b / M, forced = F0 !== 0;
    const conservative = isPendulum(P) ? x => -weight * Math.sin(x / L) : x => -x * (k + x * (l3 + x * l4));
    const bounded = confining(P);

    const t = new Float64Array(nMax), xs = new Float64Array(nMax), ps = new Float64Array(nMax);
    let x = x0, p = p0, n = 1, escaped = false, failed = false;
    let f0 = F0;                            // external force at the start of the step: F0 cos(0)
    xs[0] = x; ps[0] = p;
    for (let i = 1; i < nMax; i++) {
      for (let s = 0; s < substeps; s++) {
        // The four stages: at the start of the step, twice at its middle, and at its end.  The external force
        // at the end of one step is reused at the start of the next.
        const ts = ((i - 1) * substeps + s) * h;
        const fm = forced ? F0 * Math.cos(w * (ts + half)) : 0, f1 = forced ? F0 * Math.cos(w * (ts + h)) : 0;
        const k1x = p / M, k1p = conservative(x) - friction * p + f0;
        const p2 = p + half * k1p, k2x = p2 / M, k2p = conservative(x + half * k1x) - friction * p2 + fm;
        const p3 = p + half * k2p, k3x = p3 / M, k3p = conservative(x + half * k2x) - friction * p3 + fm;
        const p4 = p + h * k3p, k4x = p4 / M, k4p = conservative(x + h * k3x) - friction * p4 + f1;
        x += h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
        p += h / 6 * (k1p + 2 * k2p + 2 * k3p + k4p);
        f0 = f1;
      }
      if (!isFinite(x) || !isFinite(p)) { escaped = !bounded; failed = bounded; break; }
      if (!bounded && Math.abs(x) > ESCAPE_X) { escaped = true; break; }
      t[i] = i * dtOut; xs[i] = x; ps[i] = p; n = i + 1;
    }
    return { t, x: xs, p: ps, n, dt: dtOut, escaped, failed };
  }

  /**
   * The fastest rate (1/s) in a numerical solution: the local angular frequency sqrt(|V''(x)| / M), the
   * friction rate b/M, the forcing frequency and, for the pendulum, the angular velocity (the rate at which
   * the force sin(x/L) varies in a fast rotation).  Samples of a mass already running away, beyond twice the
   * farthest barrier, are left out.
   */
  function fastestRate(P, sol) {
    const pendulum = isPendulum(P);
    let limit = Infinity, bend = 0, speed = 0;
    if (!confining(P)) limit = 2 * Math.max.apply(null, equilibria(P).filter(e => !e.stable).map(e => Math.abs(e.x)));
    for (let i = 0; i < sol.n; i++) {
      if (Math.abs(sol.x[i]) > limit) continue;
      bend = Math.max(bend, Math.abs(curvature(P, sol.x[i])));
      if (pendulum) speed = Math.max(speed, Math.abs(sol.p[i]));
    }
    return Math.max(Math.sqrt(bend / P.M), P.b / P.M, P.w, pendulum ? speed / (P.M * P.L) : 0);
  }

  /**
   * The solution shown by the page, from t = 0 to T, sampled every dtOut (5 ms).
   *
   * If there is a closed form (see analytic) the samples are computed from it.  Otherwise the equation is
   * integrated by Runge-Kutta with a step of 1 ms, and integrated again with a shorter step if the motion
   * turns out to be too fast for it: the step is reduced until (fastest rate) x (step) <= 0.05.  Two limits
   * keep the page responsive: the step is never below 25 microseconds, and a solution never takes more than
   * 1.5 million steps.  `step` in the result is the step actually used.
   *
   * Returns the object of integrate() plus  exact  (the closed form, or null)  and  step  (the Runge-Kutta
   * step in seconds, or null when the closed form was used).
   */
  function solve(P, x0, p0, T, options) {
    const dtOut = (options && options.dtOut) || 0.005;
    const exact = analytic(P, x0, p0);
    if (exact) {
      const n = Math.round(T / dtOut) + 1;
      const t = new Float64Array(n), x = new Float64Array(n), p = new Float64Array(n);
      for (let i = 0; i < n; i++) { t[i] = i * dtOut; x[i] = exact.x(t[i]); p[i] = P.M * exact.v(t[i]); }
      return { t, x, p, n, dt: dtOut, escaped: false, failed: false, exact, step: null };
    }
    const most = Math.max(5, Math.min(MAX_SUBSTEPS, Math.floor(MAX_STEPS / Math.round(T / dtOut))));
    let substeps = 5, sol;
    for (;;) {
      sol = integrate(P, x0, p0, T, { dtOut, substeps });
      const needed = Math.ceil(fastestRate(P, sol) * dtOut / RESOLUTION);
      const next = Math.min(most, Math.max(needed, sol.failed ? 4 * substeps : 0));
      if (next <= substeps) break;
      substeps = next;
    }
    sol.exact = null;
    sol.step = dtOut / substeps;
    return sol;
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

  return {
    derived, stiffness, harmonicApproximation, potential, force, curvature, energy, equilibria, confining,
    analytic, steadyState, integrate, solve, energies, jacobi, ellipticK, ellipticF, carlsonRF, ESCAPE_X,
  };
});
