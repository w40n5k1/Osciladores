// By Bruno Mota - METAbio
/**
 * The equation of motion and its solution written out as LaTeX strings (rendered by KaTeX in the page), and
 * the number formatting used everywhere in the page (decimal comma, three significant figures).
 *
 *   equation(P)                {symbolic, numeric}: the equation with only the terms that are present
 *   solution(P, D, an)         {regime, formula, definitions, values, note}: the closed form when there is one
 *   tex(v), text(v)            a number as LaTeX and as plain text
 *
 * P is the parameter object of fisica.js, D = Fisica.derived(P) and an = Fisica.analytic(P, x0, p0).
 * The texts are in Portuguese; the sine is written "sen".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Formulas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Mantissa (as a string with a decimal point) and power of ten of v at `sig` significant figures. */
  function split(v, sig) {
    if (v === 0 || !isFinite(v)) return { m: isFinite(v) ? '0' : String(v), e: 0 };
    const e = Math.floor(Math.log10(Math.abs(v)));
    if (e >= 4 || e < -3) return { m: (v / Math.pow(10, e)).toFixed(sig - 1), e };
    return { m: v.toFixed(Math.max(0, sig - 1 - e)), e: 0 };
  }

  /** v as LaTeX: decimal comma, `sig` significant figures, powers of ten beyond 10^4 and below 10^-3. */
  function tex(v, sig) {
    const s = split(v, sig || 3);
    const m = s.m.replace('.', '{,}');
    return s.e ? m + '\\times 10^{' + s.e + '}' : m;
  }

  /** v as plain text, same conventions as tex(). */
  function text(v, sig) {
    const s = split(v, sig || 3);
    const m = s.m.replace('.', ',').replace('-', '\u2212');
    return s.e ? m + '\u00d710^' + String(s.e).replace('-', '\u2212') : m;
  }

  /** v with a fixed number of decimal places, as plain text. */
  function fixed(v, decimals) {
    return v.toFixed(decimals).replace('.', ',').replace('-', '\u2212');
  }

  /** Joins signed terms [{c, t}] as "c1 t1 + c2 t2 - ...", writing each coefficient with tex(). */
  function sum(terms) {
    let out = '';
    terms.forEach((term, i) => {
      const sign = term.c < 0 ? '-' : (i ? '+' : '');
      out += (i ? ' ' : '') + sign + (i ? ' ' : '') + tex(Math.abs(term.c)) + '\\,' + term.t;
    });
    return out;
  }

  /**
   * The equation of motion, with the terms whose coefficient is zero left out.
   * `symbolic` uses the symbols of the controls; `numeric` has their current values (SI units).
   */
  function equation(P) {
    let symbolic = 'M\\,\\ddot{x}';
    const terms = [{ c: P.M, t: '\\ddot{x}' }];
    if (P.b !== 0) { symbolic += ' + b\\,\\dot{x}'; terms.push({ c: P.b, t: '\\dot{x}' }); }
    symbolic += ' + k\\,x'; terms.push({ c: P.k, t: 'x' });
    if (P.l3 !== 0) { symbolic += ' + \\lambda_3\\,x^2'; terms.push({ c: P.l3, t: 'x^2' }); }
    if (P.l4 !== 0) { symbolic += ' + \\lambda_4\\,x^3'; terms.push({ c: P.l4, t: 'x^3' }); }
    const rhsSymbolic = P.F0 !== 0 ? (P.w !== 0 ? 'F_0\\cos(\\omega t)' : 'F_0') : '0';
    const rhsNumeric = P.F0 !== 0 ? tex(P.F0) + (P.w !== 0 ? '\\cos(' + tex(P.w) + '\\,t)' : '') : '0';
    return { symbolic: symbolic + ' = ' + rhsSymbolic, numeric: sum(terms) + ' = ' + rhsNumeric };
  }

  const REGIME_NAME = {
    none: 'sem amortecimento',
    under: 'subamortecido',
    critical: 'amortecimento cr\u00edtico',
    over: 'superamortecido',
  };

  const HOMOGENEOUS = {
    none: 'C_1\\cos(\\omega_0 t) + C_2\\operatorname{sen}(\\omega_0 t)',
    under: 'e^{-\\gamma t}\\left[C_1\\cos(\\omega_1 t) + C_2\\operatorname{sen}(\\omega_1 t)\\right]',
    critical: '\\left(C_1 + C_2\\,t\\right)e^{-\\gamma t}',
    over: 'C_1\\,e^{-(\\gamma-q)\\,t} + C_2\\,e^{-(\\gamma+q)\\,t}',
  };

  /**
   * The closed-form solution, for display.
   *   regime        name of the damping regime of the linear part
   *   formula       x(t) = ... in LaTeX, or null when there is no closed form (l3 or l4 different from zero)
   *   definitions   LaTeX of the definitions of the symbols in the formula
   *   values        LaTeX of the current values of those symbols, with units
   *   note          a sentence in Portuguese shown under the formula
   */
  function solution(P, D, an) {
    const out = { regime: REGIME_NAME[D.regime], formula: null, definitions: [], values: [], note: '' };
    const unit = u => '\\ \\mathrm{' + u + '}';
    out.values.push('\\omega_0 = ' + tex(D.w0) + unit('rad/s'));
    if (D.gamma > 0) out.values.push('\\gamma = ' + tex(D.gamma) + unit('s^{-1}'), 'Q = ' + tex(D.Q));

    if (!an) {
      out.note = 'Com termos anarm\u00f4nicos n\u00e3o h\u00e1 solu\u00e7\u00e3o em fun\u00e7\u00f5es elementares: a curva \u00e9 a solu\u00e7\u00e3o ' +
        'num\u00e9rica (Runge\u2013Kutta de 4\u00aa ordem). \u03c9\u2080, \u03b3 e Q referem-se \u00e0 parte linear, ' +
        'v\u00e1lida para pequenas amplitudes.';
      return out;
    }

    let formula = 'x(t) = ' + HOMOGENEOUS[an.homogeneous];
    out.definitions.push('\\omega_0 = \\sqrt{k/M}');
    if (D.regime !== 'none') out.definitions.push('\\gamma = \\dfrac{b}{2M}');
    if (D.regime === 'under') {
      out.definitions.push('\\omega_1 = \\sqrt{\\omega_0^2-\\gamma^2}');
      out.values.push('\\omega_1 = ' + tex(D.w1) + unit('rad/s'));
    }
    if (D.regime === 'over') {
      out.definitions.push('q = \\sqrt{\\gamma^2-\\omega_0^2}');
      out.values.push('q = ' + tex(D.q) + unit('s^{-1}'));
    }
    // A constant that vanishes comes out of the arithmetic as rounding noise (1e-17): show it as zero.
    const size = Math.max(Math.abs(an.C1), Math.abs(an.C2), Math.abs(an.A));
    const clean = v => (Math.abs(v) < 1e-12 * size ? 0 : v);
    out.values.push('C_1 = ' + tex(clean(an.C1)) + unit('m'), 'C_2 = ' + tex(clean(an.C2)) + unit(D.regime === 'critical' ? 'm/s' : 'm'));

    if (an.particular === 'steady') {
      if (P.w !== 0) {
        formula += ' + A\\cos(\\omega t - \\delta)';
        if (D.regime === 'none') {
          out.definitions.push('A = \\dfrac{F_0/M}{\\left|\\omega_0^2-\\omega^2\\right|}',
            '\\delta = 0\\ (\\omega<\\omega_0)\\ \\text{ou}\\ \\pi\\ (\\omega>\\omega_0)');
        } else {
          out.definitions.push('A = \\dfrac{F_0/M}{\\sqrt{(\\omega_0^2-\\omega^2)^2 + 4\\gamma^2\\omega^2}}',
            '\\tan\\delta = \\dfrac{2\\gamma\\,\\omega}{\\omega_0^2-\\omega^2}');
        }
        out.values.push('A = ' + tex(an.A) + unit('m'), '\\delta = ' + tex(an.delta) + unit('rad'));
      } else {
        formula += ' + \\dfrac{F_0}{k}';
        out.values.push('F_0/k = ' + tex(an.A) + unit('m'));
      }
    } else if (an.particular === 'resonant') {
      formula += ' + \\dfrac{F_0}{2M\\omega_0}\\,t\\operatorname{sen}(\\omega_0 t)';
      out.values.push('\\dfrac{F_0}{2M\\omega_0} = ' + tex(an.A) + unit('m/s'));
    }
    out.formula = formula;

    const notes = [];
    notes.push('C\u2081 e C\u2082 s\u00e3o fixadas pelas condi\u00e7\u00f5es iniciais x(0) = x\u2080 e p(0) = p\u2080.');
    if (an.particular === 'steady' && P.w !== 0 && D.gamma > 0) {
      notes.push('O primeiro termo \u00e9 o transiente, que decai; o segundo \u00e9 o regime estacion\u00e1rio.');
    }
    if (an.particular === 'steady' && P.w !== 0 && D.gamma === 0) {
      notes.push('Sem amortecimento o primeiro termo n\u00e3o decai: as duas frequ\u00eancias se superp\u00f5em (batimentos quando \u03c9 \u2248 \u03c9\u2080).');
    }
    if (an.particular === 'resonant') {
      notes.push('Resson\u00e2ncia sem amortecimento: a amplitude cresce linearmente com o tempo.');
    }
    out.note = notes.join(' ');
    return out;
  }

  return { tex, text, fixed, equation, solution, REGIME_NAME };
});
