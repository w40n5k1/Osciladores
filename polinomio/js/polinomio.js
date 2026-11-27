// By Bruno Mota - METAbio
/**
 * The polynomial shown by the page:
 *
 *     y(x) = x^2 + b x + c ,        b and c real, x complex.
 *
 * Completing the square,
 *
 *     y = (x - xv)^2 + yv ,         xv = -b/2 ,     yv = c - b^2/4 = -D/4 ,     D = b^2 - 4c ,
 *
 * where D is the discriminant and (xv, yv) is the vertex of the parabola y(x) for x real.  The two roots,
 * x+ and x-, are (-b +- sqrt(D)) / 2 = xv +- sqrt(-yv):
 *
 *     D > 0    two real roots,              xv +- sqrt(D)/2
 *     D = 0    one double root,             xv
 *     D < 0    two complex conjugate roots, xv +- i sqrt(-D)/2
 *
 * With x = u + i v and s = u - xv,
 *
 *     Re y = s^2 - v^2 + yv ,       Im y = 2 s v ,       |y|^2 = (s^2 - v^2 + yv)^2 + 4 s^2 v^2 .
 *
 * y is real on two lines of the complex plane, which cross at xv:
 *
 *     the real axis (v = 0),        where  y = yv + s^2 ;
 *     the line Re x = xv (s = 0),   where  y = yv - v^2 .
 *
 * The roots are on the first line if yv <= 0 and on the second if yv >= 0.  Unless yv = 0, the surface |y| over
 * the complex plane has a saddle at xv, of height |yv|: |y| has a minimum there along one of the two lines and
 * a maximum along the other.  The gradient of |y| vanishes nowhere else (it does only where dy/dx = 2x + b = 0),
 * so the only minima of |y| are its zeros, the roots.
 *
 * What is here:
 *   discriminant(b, c), vertex(b, c)
 *   value(b, c, u, v), modulus(b, c, u, v)    y and |y| at x = u + i v
 *   roots(b, c)                               the two roots and their kind
 *   criticalB(c), criticalC(b)                where the discriminant vanishes, seen from each coefficient
 *
 * No browser objects are used: the file also loads in node, where tests/teste_polinomio.js checks it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Polinomio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Relative tolerance within which the discriminant counts as zero (double root). */
  const DOUBLE_TOL = 1e-9;

  /** v, with -0 turned into 0 (so that it is written without a sign). */
  const plain = v => v || 0;

  /**
   * The discriminant D = b^2 - 4c.  It counts as exactly zero within DOUBLE_TOL of the size of its two terms,
   * so that a slider stopped at the critical value of b (2 sqrt(c), which is not a round number) gives a
   * double root, and not two roots a rounding error apart.
   */
  function discriminant(b, c) {
    const D = b * b - 4 * c;
    return Math.abs(D) <= DOUBLE_TOL * (b * b + 4 * Math.abs(c)) ? 0 : D;
  }

  /** The vertex {x, y} of the parabola, (-b/2, -D/4): y = (x - vertex.x)^2 + vertex.y. */
  function vertex(b, c) {
    return { x: plain(-b / 2), y: plain(-discriminant(b, c) / 4) };
  }

  /** y at the complex point x = u + i v, as [Re y, Im y]. */
  function value(b, c, u, v) {
    return [u * u - v * v + b * u + c, v * (2 * u + b)];
  }

  /** |y| at the complex point x = u + i v. */
  function modulus(b, c, u, v) {
    const y = value(b, c, u, v);
    return Math.hypot(y[0], y[1]);
  }

  /**
   * The two roots, x+ and x- = (-b +- sqrt(D)) / 2, as complex numbers {re, im}:
   *   kind          'real' (two distinct real roots, x- < x+), 'double' (x- = x+), or
   *                 'complex' (a conjugate pair, Im x- < 0 < Im x+)
   *   delta         the discriminant (see `discriminant`)
   *   plus, minus   the roots x+ and x-
   *
   * Real roots are computed without subtracting nearly equal numbers: the root of larger modulus is
   * q = -(b + sign(b) sqrt(D)) / 2, and the other is c / q, since the product of the roots is c.
   */
  function roots(b, c) {
    const D = discriminant(b, c), xv = plain(-b / 2);
    if (D === 0) return { kind: 'double', delta: 0, plus: { re: xv, im: 0 }, minus: { re: xv, im: 0 } };
    if (D > 0) {
      const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(D)) / 2, other = plain(c / q);
      return { kind: 'real', delta: D, plus: { re: Math.max(q, other), im: 0 }, minus: { re: Math.min(q, other), im: 0 } };
    }
    const half = Math.sqrt(-D) / 2;
    return { kind: 'complex', delta: D, plus: { re: xv, im: half }, minus: { re: xv, im: -half } };
  }

  /** |b| at which the discriminant vanishes for a given c: 2 sqrt(c); null if c < 0 (the roots are real for every b). */
  function criticalB(c) {
    return c >= 0 ? 2 * Math.sqrt(c) : null;
  }

  /** c at which the discriminant vanishes for a given b: b^2/4. */
  function criticalC(b) {
    return b * b / 4;
  }

  return { DOUBLE_TOL, discriminant, vertex, value, modulus, roots, criticalB, criticalC };
});
