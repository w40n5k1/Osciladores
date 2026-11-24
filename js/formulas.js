// By Bruno Mota - METAbio
/**
 * The equation of motion and its solution written out as LaTeX strings (rendered by KaTeX in the page), and
 * the number formatting used everywhere in the page (decimal comma, three significant figures).
 *
 *   equation(P)                {symbolic, numeric}: the equation with only the terms that are present
 *   solution(P, D, an)         {regime, formula, definitions, values, note}: the closed form when there is one
 *   potential(P)               V(x) = ... of the oscillator, or V(theta) = ... of the pendulum
 *   method(step)               the sentence that says how the curves were computed
 *   tex(v), text(v), fixed(v, decimals)     a number as LaTeX and as plain text
 *   superscript(n)                          an integer in superscript characters (exponents in plain text)
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

  /** Joins signed terms [{c, t}] as "c1 t1 + c2 t2 - ...", writing each coefficient with tex(). */
  function sum(terms) {
    let out = '';
    terms.forEach((term, i) => {
      const sign = term.c < 0 ? '-' : (i ? '+' : '');
      out += (i ? ' ' : '') + sign + (i ? ' ' : '') + tex(Math.abs(term.c)) + '\\,' + term.t;
    });
    return out;
  }

  const unit = u => '\\ \\mathrm{' + u + '}';

  /**
   * The equation of motion, with the terms whose coefficient is zero left out.
   * `symbolic` uses the symbols of the controls; `numeric` has their current values (SI units).
   */
  function equation(P) {
    const forcing = (amplitude, value) => (P.F0 !== 0
      ? [amplitude + (P.w !== 0 ? '\\cos(\\omega t)' : ''), tex(value) + (P.w !== 0 ? '\\cos(' + tex(P.w) + '\\,t)' : '')] : ['0', '0']);
    if (P.system === 'pendulum') {
      // Torques about the pivot: M L^2 theta'' + b L^2 theta' + M g L sin(theta) = F0 L cos(w t).
      const L2 = P.L * P.L, terms = [{ c: P.M * L2, t: '\\ddot{\\theta}' }];
      let symbolic = 'M L^2\\,\\ddot{\\theta}';
      if (P.b !== 0) { symbolic += ' + b L^2\\,\\dot{\\theta}'; terms.push({ c: P.b * L2, t: '\\dot{\\theta}' }); }
      symbolic += ' + M g L\\operatorname{sen}\\theta';
      terms.push({ c: P.M * P.g * P.L, t: '\\operatorname{sen}\\theta' });
      const rhs = forcing('F_0 L', P.F0 * P.L);
      return { symbolic: symbolic + ' = ' + rhs[0], numeric: sum(terms) + ' = ' + rhs[1] };
    }
    let symbolic = 'M\\,\\ddot{x}';
    const terms = [{ c: P.M, t: '\\ddot{x}' }];
    if (P.b !== 0) { symbolic += ' + b\\,\\dot{x}'; terms.push({ c: P.b, t: '\\dot{x}' }); }
    symbolic += ' + k\\,x'; terms.push({ c: P.k, t: 'x' });
    if (P.l3 !== 0) { symbolic += ' + \\lambda_3\\,x^2'; terms.push({ c: P.l3, t: 'x^2' }); }
    if (P.l4 !== 0) { symbolic += ' + \\lambda_4\\,x^3'; terms.push({ c: P.l4, t: 'x^3' }); }
    const rhs = forcing('F_0', P.F0);
    return { symbolic: symbolic + ' = ' + rhs[0], numeric: sum(terms) + ' = ' + rhs[1] };
  }

  /** The potential energy of the system, as LaTeX. */
  function potential(P) {
    if (P.system === 'pendulum') return 'V(\\theta) = M g L\\,(1 - \\cos\\theta)';
    return 'V(x) = \\tfrac{1}{2}k\\,x^2 + \\tfrac{1}{3}\\lambda_3\\,x^3 + \\tfrac{1}{4}\\lambda_4\\,x^4';
  }

  /** How the curves were computed: `step` is the Runge-Kutta step in seconds, or null for a closed form. */
  function method(step) {
    if (step === null) return 'Calculado analiticamente.';
    const ms = step * 1000, plain = v => String(Number(v.toPrecision(2))).replace('.', ',');
    return 'Integração numérica: Runge–Kutta de 4ª ordem, passo de ' + (ms < 0.1 ? plain(ms * 1000) + ' µs' : plain(ms) + ' ms') + '.';
  }

  const REGIME_NAME = {
    none: 'sem amortecimento',
    under: 'subamortecido',
    critical: 'amortecimento crítico',
    over: 'superamortecido',
  };

  const HOMOGENEOUS = {
    none: 'C_1\\cos(\\omega_0 t) + C_2\\operatorname{sen}(\\omega_0 t)',
    under: 'e^{-\\gamma t}\\left[C_1\\cos(\\omega_1 t) + C_2\\operatorname{sen}(\\omega_1 t)\\right]',
    critical: '\\left(C_1 + C_2\\,t\\right)e^{-\\gamma t}',
    over: 'C_1\\,e^{-(\\gamma-q)\\,t} + C_2\\,e^{-(\\gamma+q)\\,t}',
  };

  /** Closed form of the linear oscillator: fills formula, definitions, values and note of `out`. */
  function linear(out, P, D, an) {
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

    const notes = ['C₁ e C₂ são fixadas pelas condições iniciais x(0) = x₀ e p(0) = p₀.'];
    if (an.particular === 'steady' && P.w !== 0 && D.gamma > 0) {
      notes.push('O primeiro termo é o transiente, que decai; o segundo é o regime estacionário.');
    }
    if (an.particular === 'steady' && P.w !== 0 && D.gamma === 0) {
      notes.push('Sem amortecimento o primeiro termo não decai: as duas frequências se superpõem (batimentos quando ω ≈ ω₀).');
    }
    if (an.particular === 'resonant') {
      notes.push('Ressonância sem amortecimento: a amplitude cresce linearmente com o tempo.');
    }
    out.note = notes.join(' ');
  }

  /** Exact solution of the pendulum without friction or forcing (see Fisica.analytic). */
  function pendulum(out, P, D, an) {
    // The formulas are written for the well in which the motion starts; `shifted` is the angle measured from its bottom.
    const shifted = an.base === 0 ? '\\theta(t)' : '\\theta(t) - \\theta_n';
    if (an.base !== 0) out.values.push('\\theta_n = ' + tex(an.base) + unit('rad'));
    const time = (rate) => (an.sign < 0 ? '-' : '') + rate + ' t + u_0';
    out.definitions.push('\\omega_0 = \\sqrt{g/L}', '\\kappa^2 = \\dfrac{E}{2MgL}');
    out.values.push('\\kappa = ' + tex(an.kappa, 4));
    if (isFinite(an.u0)) out.values.push('u_0 = ' + tex(an.u0));
    const harmonicPeriod = '2\\pi/\\omega_0 = ' + tex(2 * Math.PI / D.w0) + unit('s');

    if (an.motion === 'libration') {
      out.formula = '\\operatorname{sen}\\dfrac{' + shifted + '}{2} = \\kappa\\,\\operatorname{sn}(\\omega_0 t + u_0,\\ \\kappa)';
      out.definitions.push('T = \\dfrac{4K(\\kappa)}{\\omega_0}');
      out.values.push('\\theta_{\\text{máx}} = ' + tex(an.amplitude) + unit('rad'), 'T = ' + tex(an.period) + unit('s'), harmonicPeriod);
      out.note = 'Solução exata, em funções elípticas de Jacobi: sn é o seno elíptico de módulo κ e K(κ) a integral elíptica ' +
        'completa de primeira espécie. κ = sen(θmáx/2), sendo θmáx a amplitude da oscilação; u₀ é fixado pelas ' +
        'condições iniciais. ' +
        'Para κ → 0, sn → sen e T → 2π/ω₀: o oscilador harmônico.';
    } else if (an.motion === 'rotation') {
      out.formula = shifted + ' = 2\\operatorname{am}(' + time('\\kappa\\,\\omega_0') + ',\\ 1/\\kappa)';
      out.definitions.push('T_{\\text{volta}} = \\dfrac{2K(1/\\kappa)}{\\kappa\\,\\omega_0}');
      out.values.push('T_{\\text{volta}} = ' + tex(an.period) + unit('s'), harmonicPeriod);
      out.note = 'Solução exata: am é a amplitude de Jacobi, de módulo 1/κ. Com κ > 1 a energia supera a da posição ' +
        'invertida (E > 2MgL) e o pêndulo gira sempre no mesmo sentido; u₀ é fixado pelas condições iniciais.';
    } else {
      out.formula = '\\operatorname{sen}\\dfrac{' + shifted + '}{2} = \\tanh(' + time('\\omega_0') + ')';
      out.note = 'Separatriz: a energia é exatamente a da posição invertida (E = 2MgL, κ = 1). O pêndulo se aproxima ' +
        'dela sem nunca a alcançar; o período é infinito.';
    }
  }

  /**
   * The closed-form solution, for display.
   *   regime        name of the damping regime of the linear part
   *   formula       the solution in LaTeX, or null when the page has no closed form for it
   *   definitions   LaTeX of the definitions of the symbols in the formula
   *   values        LaTeX of the current values of those symbols, with units
   *   note          a sentence in Portuguese shown under the formula
   */
  function solution(P, D, an) {
    const out = { regime: REGIME_NAME[D.regime], formula: null, definitions: [], values: [], note: '' };
    out.values.push('\\omega_0 = ' + tex(D.w0) + unit('rad/s'));
    if (D.gamma > 0) out.values.push('\\gamma = ' + tex(D.gamma) + unit('s^{-1}'), 'Q = ' + tex(D.Q));

    if (an && an.kind === 'linear') linear(out, P, D, an);
    else if (an && an.kind === 'pendulum') pendulum(out, P, D, an);
    else if (an && an.kind === 'rest') {
      out.formula = P.system === 'pendulum' ? '\\theta(t) = \\theta_0' : 'x(t) = x_0';
      out.note = an.stable
        ? 'A massa está em repouso sobre um ponto de equilíbrio estável e aí permanece.'
        : 'A massa está em repouso sobre um ponto de equilíbrio instável: aí permanece, mas qualquer perturbação a afasta.';
    } else if (P.system === 'pendulum') {
      out.note = 'Com amortecimento ou força externa a curva é a solução numérica (Runge–Kutta de 4ª ordem). ' +
        'ω₀, γ e Q referem-se à aproximação harmônica, sen θ ≈ θ, válida para |θ| ≪ 1.';
    } else {
      out.note = 'Com termos anarmônicos não há solução em funções elementares: a curva é a solução ' +
        'numérica (Runge–Kutta de 4ª ordem). ω₀, γ e Q referem-se à parte linear, ' +
        'válida para pequenas amplitudes.';
    }
    return out;
  }

  return { tex, text, fixed, superscript, equation, solution, potential, method, REGIME_NAME };
});
