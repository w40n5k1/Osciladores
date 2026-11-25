// By Bruno Mota - METAbio
/**
 * The polynomial, its roots and its vertex written out as LaTeX strings (rendered by KaTeX in the page), and
 * the number formatting used everywhere in the page (decimal comma, three significant figures).
 *
 *   polynomial(b, c)        {symbolic, numeric}: y = x^2 + b x + c, and the same with the values of b and c
 *   roots(r, v)             {regime, formula, values, spoken, note}: the roots, for display
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

  const FORMULA = {
    real: 'x_{1,2} = \\dfrac{-b \\mp \\sqrt{\\Delta}}{2}',
    double: 'x_1 = x_2 = -\\dfrac{b}{2}',
    complex: 'x_{1,2} = \\dfrac{-b \\mp i\\sqrt{-\\Delta}}{2}',
  };

  /** A complex number {re, im} as plain text, like complex(). */
  function complexText(z) {
    if (z.im === 0) return text(z.re);
    const imaginary = text(Math.abs(z.im)) + ' i';
    if (z.re === 0) return (z.im < 0 ? '−' : '') + imaginary;
    return text(z.re) + (z.im < 0 ? ' − ' : ' + ') + imaginary;
  }

  /**
   * The roots, for display.
   *   regime     name of the case, shown beside the title
   *   formula    the roots in LaTeX, in terms of b and the discriminant
   *   values     LaTeX of the discriminant and of the roots
   *   spoken     the roots in plain text
   *   note       a sentence in Portuguese shown under the plot of y for x real: where y vanishes there
   */
  function roots(r, v) {
    const out = { regime: REGIME_NAME[r.kind], formula: FORMULA[r.kind], values: ['\\Delta = b^2 - 4c = ' + tex(r.delta)], spoken: '', note: '' };
    if (r.kind === 'double') {
      out.values.push('x_1 = x_2 = ' + complex(r.x1));
      out.spoken = 'x₁ = x₂ = ' + complexText(r.x1);
      out.note = 'y = 0 só em ' + out.spoken + ': a parábola é tangente ao eixo.';
    } else {
      out.values.push('x_1 = ' + complex(r.x1), 'x_2 = ' + complex(r.x2));
      out.spoken = 'x₁ = ' + complexText(r.x1) + ' e em x₂ = ' + complexText(r.x2);
      out.note = r.kind === 'real'
        ? 'y = 0 em ' + out.spoken + '.'
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
