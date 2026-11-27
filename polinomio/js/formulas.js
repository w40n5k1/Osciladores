// By Bruno Mota - METAbio
/**
 * The polynomial, its roots and its vertex written out as LaTeX strings (rendered by KaTeX in the page), and
 * the number formatting used everywhere in the page (decimal comma, three significant figures).
 *
 *   polynomial(b, c)        {symbolic, numeric}: y = x^2 + b x + c, and the same with the values of b and c
 *   roots(b, r, v)          {regime, formula, values, spoken, note}: the roots x+ and x-, for display
 *   vertex(v)               LaTeX of the coordinates of the vertex
 *   tex(v), text(v), fixed(v, decimals)     a number as LaTeX and as plain text
 *
 * r = Polinomio.roots(b, c) and v = Polinomio.vertex(b, c).  The texts are in Portuguese.
 * The number formatting is that of the Osciladores page.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Formulas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Mantissa (as a string with a decimal point) and power of ten of v at `sig` significant figures. */
  function split(v, sig) {
    if (v === 0 || !isFinite(v)) return { m: isFinite(v) ? '0' : String(v), e: 0 };
    let e = Math.floor(Math.log10(Math.abs(v)));
    if (e >= 4 || e < -3) {
      let m = v / Math.pow(10, e);
      if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) { m /= 10; e += 1; }   // 9.999 rounds to 10.0: one more power of ten
      return { m: m.toFixed(sig - 1), e };
    }
    return { m: v.toFixed(Math.max(0, sig - 1 - e)), e: 0 };
  }

  /** v as LaTeX: decimal comma, `sig` significant figures, powers of ten beyond 10^4 and below 10^-3. */
  function tex(v, sig) {
    if (!isFinite(v)) return (v < 0 ? '-' : '') + '\\infty';
    const s = split(v, sig || 3);
    const m = s.m.replace('.', '{,}');
    return s.e ? m + '\\times 10^{' + s.e + '}' : m;
  }

  /** An integer in superscript characters: the exponent of a power of ten in plain text. */
  function superscript(n) {
    return String(n).replace(/./g, c => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]));
  }

  /** v as plain text, same conventions as tex(). */
  function text(v, sig) {
    const s = split(v, sig || 3);
    const m = s.m.replace('.', ',').replace('-', '−');
    return s.e ? m + '×10' + superscript(s.e) : m;
  }

  /** v with a fixed number of decimal places, as plain text. */
  function fixed(v, decimals) {
    return v.toFixed(decimals).replace('.', ',').replace('-', '−');
  }

  /** A complex number {re, im} as LaTeX: "a", "a + d i", "a - d i", or "d i" alone when a = 0. */
  function complex(z) {
    if (z.im === 0) return tex(z.re);
    const imaginary = tex(Math.abs(z.im)) + '\\,i';
    if (z.re === 0) return (z.im < 0 ? '-' : '') + imaginary;
    return tex(z.re) + (z.im < 0 ? ' - ' : ' + ') + imaginary;
  }

  /**
   * The polynomial.  `symbolic` uses the symbols of the controls; `numeric` has their current values, written
   * with two decimal places like the values beside the sliders, with the terms whose coefficient is zero left out.
   */
  function polynomial(b, c) {
    const term = (coefficient, symbol) => (coefficient === 0 ? ''
      : (coefficient < 0 ? ' - ' : ' + ') + Math.abs(coefficient).toFixed(2).replace('.', '{,}') + (symbol ? '\\,' + symbol : ''));
    return { symbolic: 'y = x^2 + b\\,x + c', numeric: 'y = x^2' + term(b, 'x') + term(c, '') };
  }

  const REGIME_NAME = {
    real: 'reais e distintas',
    double: 'reais e iguais',
    complex: 'complexas conjugadas',
  };

  /**
   * The roots x+ and x- in terms of b and of the discriminant, as LaTeX: (-b +- sqrt(D)) / 2, with i sqrt(-D)
   * in the place of sqrt(D) when D < 0, so that what is under the root is positive.  With b = 0 the term -b is
   * left out.
   */
  function formula(kind, b) {
    if (kind === 'double') return 'x_+ = x_- = ' + (b === 0 ? '0' : '-\\dfrac{b}{2}');
    const root = kind === 'real' ? '\\sqrt{\\Delta}' : 'i\\sqrt{-\\Delta}';
    return 'x_\\pm = \\dfrac{' + (b === 0 ? '' : '-b ') + '\\pm ' + root + '}{2}';
  }

  /** A complex number {re, im} as plain text, like complex(). */
  function complexText(z) {
    if (z.im === 0) return text(z.re);
    const imaginary = text(Math.abs(z.im)) + ' i';
    if (z.re === 0) return (z.im < 0 ? '−' : '') + imaginary;
    return text(z.re) + (z.im < 0 ? ' − ' : ' + ') + imaginary;
  }

  /**
   * The roots, for display.  b is the coefficient, r = Polinomio.roots(b, c) and v = Polinomio.vertex(b, c).
   *   regime     name of the case, shown beside the title
   *   formula    the roots in LaTeX, in terms of b and the discriminant (see `formula`)
   *   values     LaTeX of the discriminant and of the roots
   *   spoken     the roots in plain text
   *   note       a sentence in Portuguese (HTML) shown under the plot of y for x real: where y vanishes there
   */
  function roots(b, r, v) {
    const out = { regime: REGIME_NAME[r.kind], formula: formula(r.kind, b), values: ['\\Delta = b^2 - 4c = ' + tex(r.delta)], spoken: '', note: '' };
    const plus = 'x<sub>+</sub>', minus = 'x<sub>−</sub>';
    if (r.kind === 'double') {
      if (b !== 0) out.values.push('x_+ = x_- = ' + complex(r.plus));           // with b = 0 the formula already reads 0
      out.spoken = 'x+ = x− = ' + complexText(r.plus);
      out.note = 'y = 0 só em ' + plus + ' = ' + minus + ' = ' + complexText(r.plus) + ': a parábola é tangente ao eixo.';
    } else {
      out.values.push('x_+ = ' + complex(r.plus), 'x_- = ' + complex(r.minus));
      out.spoken = 'x− = ' + complexText(r.minus) + ' e em x+ = ' + complexText(r.plus);
      out.note = r.kind === 'real'
        ? 'y = 0 em ' + minus + ' = ' + complexText(r.minus) + ' e em ' + plus + ' = ' + complexText(r.plus) + '.'
        : 'y não se anula para x real: seu menor valor é c − b²/4 = ' + text(v.y) + '. As duas raízes estão fora do eixo real.';
    }
    return out;
  }

  /** The coordinates of the vertex, as LaTeX. */
  function vertex(v) {
    return ['x_v = -\\dfrac{b}{2} = ' + tex(v.x), 'y_v = c - \\dfrac{b^2}{4} = ' + tex(v.y)];
  }

  return { tex, text, fixed, superscript, polynomial, roots, vertex, REGIME_NAME };
});
