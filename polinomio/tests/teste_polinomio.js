// By Bruno Mota - METAbio
/**
 * Checks of js/polinomio.js.  Run from the root of the repository with:   node polinomio/tests/teste_polinomio.js
 *
 * Each check is an identity that follows from y = x^2 + b x + c = (x - xv)^2 + yv, tested over a grid of b and c
 * that covers the ranges of the sliders of the page, and at a few extreme values.
 */
'use strict';
const assert = require('assert');
const P = require('../js/polinomio.js');

let checks = 0;
const close = (got, expected, tolerance, what) => {
  checks++;
  assert.ok(Math.abs(got - expected) <= tolerance, `${what}: got ${got}, expected ${expected} (tolerance ${tolerance})`);
};

const grid = [];
for (let b = -4; b <= 4 + 1e-9; b += 0.25) for (let c = -4; c <= 6 + 1e-9; c += 0.25) grid.push([b, c]);

// 1. The roots are roots; their sum is -b and their product is c (Vieta); their kind follows the discriminant.
for (const [b, c] of grid) {
  const r = P.roots(b, c), D = b * b - 4 * c, tag = `b = ${b}, c = ${c}`;
  for (const x of [r.minus, r.plus]) close(P.modulus(b, c, x.re, x.im), 0, 1e-12, `|y| at a root (${tag})`);
  close(r.minus.re + r.plus.re, -b, 1e-12, `sum of the roots, real part (${tag})`);
  close(r.minus.im + r.plus.im, 0, 0, `sum of the roots, imaginary part (${tag})`);
  close(r.minus.re * r.plus.re - r.minus.im * r.plus.im, c, 1e-12, `product of the roots (${tag})`);
  assert.strictEqual(r.kind, D > 0 ? 'real' : D < 0 ? 'complex' : 'double', `kind (${tag})`); checks++;
  if (r.kind === 'real') { assert.ok(r.minus.re < r.plus.re, `order of the real roots (${tag})`); checks++; }
  if (r.kind === 'complex') { assert.ok(r.minus.im < 0 && r.plus.im > 0, `order of the complex roots (${tag})`); checks++; }
}

// 2. |y| = |x - x+| |x - x-| at any point of the plane.
for (const [b, c] of grid) {
  const r = P.roots(b, c);
  for (const [u, v] of [[0.3, -1.7], [-4.1, 2.2], [2.5, 0], [-0.5 * b, 1.1]]) {
    const product = Math.hypot(u - r.minus.re, v - r.minus.im) * Math.hypot(u - r.plus.re, v - r.plus.im);
    close(P.modulus(b, c, u, v), product, 1e-11 * (1 + product), `factorization at ${u} + ${v} i (b = ${b}, c = ${c})`);
  }
}

// 3. The two lines on which y is real: y = yv + s^2 on the real axis, y = yv - t^2 on the line Re x = xv.
for (const [b, c] of grid) {
  const { x: xv, y: yv } = P.vertex(b, c);
  for (const t of [-2.3, -0.4, 0, 0.9, 3.1]) {
    const onAxis = P.value(b, c, xv + t, 0), onLine = P.value(b, c, xv, t);
    close(onAxis[0], yv + t * t, 1e-12, 'y on the real axis'); close(onAxis[1], 0, 0, 'Im y on the real axis');
    close(onLine[0], yv - t * t, 1e-12, 'y on the line Re x = xv'); close(onLine[1], 0, 1e-15, 'Im y on the line Re x = xv');
  }
}

// 4. The saddle of |y| at xv, of height |yv|: a minimum along one of the two lines and a maximum along the other.
for (const [b, c] of grid) {
  const { x: xv, y: yv } = P.vertex(b, c), e = 1e-3;
  if (Math.abs(yv) < 0.05) continue;
  const here = P.modulus(b, c, xv, 0);
  const alongAxis = P.modulus(b, c, xv + e, 0) - here, alongLine = P.modulus(b, c, xv, e) - here;
  close(here, Math.abs(yv), 1e-12, 'height of the saddle');
  close(alongAxis, Math.sign(yv) * e * e, 1e-9, 'curvature along the real axis');
  close(alongLine, -Math.sign(yv) * e * e, 1e-9, 'curvature along the line Re x = xv');
}

// 5. Critical values: the discriminant counts as zero there, roots() reports a double root at the vertex, and
//    the vertex is on the axis exactly (no rounding noise left in what the page writes).
const critical = [];
for (const c of [0, 0.3, 1, 2, 3.7, 6]) for (const sign of [1, -1]) critical.push([sign * P.criticalB(c), c]);
for (const b of [-4, -1.3, 0, 0.7, 2.9]) critical.push([b, P.criticalC(b)]);
for (const [b, c] of critical) {
  const r = P.roots(b, c), tag = `b = ${b}, c = ${c}`;
  assert.strictEqual(r.kind, 'double', `double root (${tag})`); checks++;
  close(P.discriminant(b, c), 0, 0, `discriminant (${tag})`); close(r.delta, 0, 0, `delta of the roots (${tag})`);
  close(r.minus.re, -b / 2, 0, `position of the double root (${tag})`); close(r.plus.re, -b / 2, 0, `second copy of the double root (${tag})`);
  close(P.vertex(b, c).y, 0, 0, `height of the vertex (${tag})`);
}
assert.strictEqual(P.criticalB(-1), null); checks++;
// Away from the critical values the tolerance changes nothing.
for (const [b, c] of grid) {
  close(P.discriminant(b, c), b * b - 4 * c, 0, 'discriminant on the grid'); close(P.vertex(b, c).y, c - b * b / 4, 1e-15, 'height of the vertex on the grid');
}

// 6. No sign on a zero: -0 would be written "-0".
for (const [b, c] of [[0, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]) {
  const r = P.roots(b, c);
  for (const part of [r.minus.re, r.plus.re, P.vertex(b, c).x, P.vertex(b, c).y]) { assert.ok(!Object.is(part, -0), `-0 for b = ${b}, c = ${c}`); checks++; }
}

// 7. No loss of digits when the roots have very different sizes: x^2 + 1e8 x + 1 has the roots -1e8 and -1e-8.
{
  const r = P.roots(1e8, 1);
  close(r.minus.re, -1e8, 1e-7, 'large root'); close(r.plus.re / -1e-8, 1, 1e-15, 'small root, relative');
}

console.log(`teste_polinomio: ${checks} checks passed`);
