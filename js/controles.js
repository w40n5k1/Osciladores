// By Bruno Mota - METAbio
/**
 * A slider whose bar carries colored segments and labelled marks.
 *
 * The segments and marks say what the value of the control means given the values of the others: for the
 * damping coefficient, for example, the stretch of the bar where the oscillator is underdamped, the stretch
 * where it is overdamped, and a mark at the critical value between them.  The page decides what to show
 * (see `decorate` in app.js); this file only draws it.
 *
 *     const c = new Controles.Control(hostElement, spec, onChange);
 *     c.value                      current value (exact, also when snapped to a mark)
 *     c.set(v)                     sets the value without calling onChange
 *     c.decorate(segments, marks)  redraws the bar
 *     Controles.math(element, latex, display)   typesets a formula (used by the whole page)
 *
 * spec:      {id, symbol, name, unit, min, max, step, value, decimals}   (symbol is LaTeX)
 * segments:  [{from, to, kind}]            kind is a CSS class that gives the color
 * marks:     [{at, label, kind, snap}]     label is HTML; with snap the slider catches on the mark, so that
 *                                          the exact value (critical damping, resonance) can be selected;
 *                                          clicking the label of a mark selects its value too
 */
(function (root) {
  'use strict';

  /**
   * Typesets LaTeX into an element with KaTeX (display style if `display` is true).
   * It goes through katex.renderToString because katex.render refuses to run in a document without a
   * standards-mode doctype, which is how some viewers embed the page; the string version has no such check.
   */
  function math(element, source, display) {
    element.innerHTML = root.katex.renderToString(source, { throwOnError: false, displayMode: !!display });
  }

  class Control {
    constructor(host, spec, onChange) {
      this.spec = spec;
      this.onChange = onChange;
      this.value = spec.value;
      this.marks = [];
      this.drawn = '';
      this.dragging = false;                // a pointer is down on the slider

      const el = document.createElement('div');
      el.className = 'controle';
      el.innerHTML =
        '<div class="rotulo"><span class="simbolo"></span><span class="nome"></span><output class="valor"></output></div>' +
        '<div class="barra"><div class="trilho"></div><div class="marcas"></div><input type="range"></div>';
      host.appendChild(el);
      this.el = el;
      this.track = el.querySelector('.trilho');
      this.markLayer = el.querySelector('.marcas');
      this.output = el.querySelector('.valor');
      this.input = el.querySelector('input');
      el.querySelector('.nome').textContent = spec.name;
      math(el.querySelector('.simbolo'), spec.symbol);

      this.input.min = spec.min; this.input.max = spec.max; this.input.step = spec.step;
      this.input.setAttribute('aria-label', spec.name);
      this.input.addEventListener('pointerdown', () => { this.dragging = true; });
      for (const type of ['pointerup', 'pointercancel', 'change', 'keydown', 'blur']) this.input.addEventListener(type, () => { this.dragging = false; });
      this.input.addEventListener('input', () => {
        this.value = this.snap(parseFloat(this.input.value));
        this.show();
        this.onChange(this);
      });
      this.markLayer.addEventListener('click', event => {
        const at = event.target.closest('[data-at]');
        if (!at) return;
        this.set(parseFloat(at.dataset.at));
        this.onChange(this);
      });
      this.set(spec.value);
    }

    /** Fraction of the bar (0 to 1) at which the value v sits. */
    fraction(v) {
      return (v - this.spec.min) / (this.spec.max - this.spec.min);
    }

    /**
     * The value itself, or the position of a snapping mark if one is close enough.
     * With the pointer the mark holds the slider over a short stretch of the bar (0.8 % of it to each side).
     * With the keyboard it catches only a value within one step, and not a second time in a row, so that
     * the arrow keys can step across the mark.
     */
    snap(v) {
      const reach = this.dragging ? Math.max(0.75 * this.spec.step, 0.008 * (this.spec.max - this.spec.min)) : 0.75 * this.spec.step;
      let best = v, distance = reach;
      for (const mark of this.marks) {
        if (!mark.snap || (!this.dragging && mark.at === this.value)) continue;
        if (Math.abs(mark.at - v) <= distance) { best = mark.at; distance = Math.abs(mark.at - v); }
      }
      return best;
    }

    /** Sets the value (clamped to the range of the control) and shows it. */
    set(v) {
      this.value = Math.min(this.spec.max, Math.max(this.spec.min, v));
      this.input.value = this.value;
      this.show();
    }

    show() {
      this.output.textContent = root.Formulas.fixed(this.value, this.spec.decimals) + ' ' + this.spec.unit;
    }

    /** Redraws the segments and marks of the bar (only if they changed). */
    decorate(segments, marks) {
      this.marks = marks.filter(m => m.at >= this.spec.min && m.at <= this.spec.max);
      const key = JSON.stringify([segments, this.marks]);
      if (key === this.drawn) return;
      this.drawn = key;

      this.track.innerHTML = segments.map(s => {
        const a = Math.max(0, this.fraction(s.from)), b = Math.min(1, this.fraction(s.to));
        return b > a ? `<i class="segmento ${s.kind}" style="left:${100 * a}%;width:${100 * (b - a)}%"></i>` : '';
      }).join('');
      this.markLayer.innerHTML = this.marks.map(m => {
        const f = this.fraction(m.at), side = f < 0.1 ? ' esquerda' : f > 0.9 ? ' direita' : '';
        const label = m.label ? `<span>${m.label}</span>` : '';
        return `<i class="marca ${m.kind || ''}${side}" style="left:${100 * f}%" data-at="${m.at}">${label}</i>`;
      }).join('');
    }
  }

  root.Controles = { Control, math };
})(window);
