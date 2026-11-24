// By Bruno Mota - METAbio
/**
 * The controls of the page.
 *
 * Control: a slider whose bar carries colored segments and labelled marks.  The segments and marks say what
 * the value of the control means given the values of the others: for the damping coefficient, for example,
 * the stretch of the bar where the oscillator is underdamped, the stretch where it is overdamped, and a mark at
 * the critical value between them.  The page decides what to show (see `decorate` in app.js); this file only
 * draws it.
 *
 *     const c = new Controles.Control(hostElement, spec, onChange);
 *     c.value                          current value (exact, also when snapped to a mark)
 *     c.set(v)                         sets the value without calling onChange
 *     c.setRange(min, max, step, decimals)   changes the range of the slider
 *     c.valueAt(i), c.indexOf(v), c.count    the grid of values the slider moves over (see `layout`)
 *     c.decorate(segments, marks)      redraws the bar
 *     c.dragging                       true while a pointer holds the slider
 *     c.el.hidden = true               hides the control
 *
 * spec:      {id, symbol, name, unit, min, max, step, value, decimals}   (symbol is LaTeX)
 * segments:  [{from, to, kind}]            kind is a CSS class that gives the color
 * marks:     [{at, label, kind, snap}]     label is HTML; with snap the slider catches on the mark, so that
 *                                          the exact value (zero, critical damping, resonance) can be selected;
 *                                          clicking the label of a mark selects its value too
 * onChange(control, origin): origin is 'input' (the slider moved) or 'mark' (the label of a mark was clicked).
 *
 * Ladder: a thin slider, horizontal or vertical, over a fixed list of values; it sets the range of an axis
 * of the phase diagram.
 *
 *     const l = new Controles.Ladder(hostElement, {vertical, values, label, format, onChange});
 *     l.value          current value
 *     l.show(v)        moves the thumb to the first value of the list not below v, without calling onChange
 *
 * Controles.math(element, latex, display) typesets a formula; the whole page uses it.
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
      this.spec = Object.assign({}, spec);
      this.onChange = onChange;
      this.value = spec.value;
      this.segments = [];                   // as last given to decorate()
      this.allMarks = [];
      this.marks = [];                      // the marks that fall inside the range
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

      this.layout();
      this.input.setAttribute('aria-label', spec.name);
      this.input.addEventListener('pointerdown', () => { this.dragging = true; });
      for (const type of ['pointerup', 'pointercancel', 'change', 'keydown', 'blur']) this.input.addEventListener(type, () => { this.dragging = false; });
      this.input.addEventListener('input', () => {
        this.value = this.snap(this.valueAt(+this.input.value));
        this.show();
        this.onChange(this, 'input');
      });
      this.markLayer.addEventListener('click', event => {
        const at = event.target.closest('[data-at]');
        if (!at) return;
        this.set(parseFloat(at.dataset.at));
        this.onChange(this, 'mark');
      });
      this.set(spec.value);
    }

    /**
     * Sets up the grid of values of the slider: the two ends of the range and every multiple of the step
     * between them.  The native slider moves over the indices 0 .. count - 1 of this grid.  Zero and the
     * round values are therefore on it whatever the ends are (the range of x0 of the pendulum ends at -+ pi L,
     * the time bar at the last instant computed), and both ends can be reached exactly.
     */
    layout() {
      const s = this.spec, tolerance = 1e-9;
      this.low = Math.ceil(s.min / s.step - tolerance);                          // first and last multiples of the step
      this.high = Math.floor(s.max / s.step + tolerance);
      this.padLow = this.low * s.step - s.min > tolerance * s.step ? 1 : 0;      // 1 if that end is not itself a multiple
      this.padHigh = s.max - this.high * s.step > tolerance * s.step ? 1 : 0;
      this.count = Math.max(0, this.high - this.low + 1) + this.padLow + this.padHigh;
      this.input.min = 0; this.input.max = this.count - 1; this.input.step = 1;
    }

    /** Value at index i of the grid. */
    valueAt(i) {
      if (i <= 0) return this.spec.min;
      if (i >= this.count - 1) return this.spec.max;
      return Number(((this.low + i - this.padLow) * this.spec.step).toFixed(12));
    }

    /** Index of the value of the grid nearest to v. */
    indexOf(v) {
      const s = this.spec, multiple = Math.min(this.high, Math.max(this.low, Math.round(v / s.step)));
      let i = Math.min(this.count - 1, Math.max(0, multiple - this.low + this.padLow));
      if (this.padLow && Math.abs(v - s.min) < Math.abs(v - this.valueAt(i))) i = 0;
      if (this.padHigh && Math.abs(v - s.max) < Math.abs(v - this.valueAt(i))) i = this.count - 1;
      return i;
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
      this.input.value = this.indexOf(this.value);
      this.show();
    }

    /** Writes the value beside the name, and gives it to the slider as the text read out for its position. */
    show() {
      const text = root.Formulas.fixed(this.value, this.spec.decimals) + ' ' + this.spec.unit;
      this.output.textContent = text;
      this.input.setAttribute('aria-valuetext', text);
    }

    /** Changes the range, the step and the number of decimals shown; the value is kept if it still fits. */
    setRange(min, max, step, decimals) {
      const s = this.spec;
      if (s.min === min && s.max === max && s.step === step && s.decimals === decimals) return;
      s.min = min; s.max = max; s.step = step; s.decimals = decimals;
      this.layout();
      this.set(this.value);
      this.decorate(this.segments, this.allMarks);
    }

    /** Redraws the segments and marks of the bar (only if they changed). */
    decorate(segments, marks) {
      this.segments = segments; this.allMarks = marks;
      this.marks = marks.filter(m => m.at >= this.spec.min && m.at <= this.spec.max);
      const key = JSON.stringify([this.spec.min, this.spec.max, segments, this.marks]);
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

  class Ladder {
    /**
     * options: {vertical, values, label, format, onChange}
     *   values     the increasing list of values the slider steps through
     *   label      accessible name
     *   format     value -> text read out for the current value
     *   onChange   called with the ladder when the user moves it
     */
    constructor(host, options) {
      this.values = options.values;
      this.vertical = !!options.vertical;
      this.format = options.format || String;
      this.onChange = options.onChange;
      this.index = 0;

      const el = document.createElement('div');
      el.className = 'escala' + (this.vertical ? ' vertical' : '');
      el.innerHTML = '<div class="escala-trilho"></div><div class="escala-botao"></div>';
      el.tabIndex = 0;
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', options.label);
      el.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');
      el.setAttribute('aria-valuemin', 0);
      el.setAttribute('aria-valuemax', this.values.length - 1);
      host.appendChild(el);
      this.el = el;
      this.thumb = el.querySelector('.escala-botao');

      const fromPointer = event => {
        const box = el.getBoundingClientRect();
        const f = this.vertical ? (box.bottom - event.clientY) / box.height : (event.clientX - box.left) / box.width;
        this.move(Math.round(Math.min(1, Math.max(0, f)) * (this.values.length - 1)));
      };
      let held = false;
      el.addEventListener('pointerdown', event => { held = true; el.setPointerCapture(event.pointerId); fromPointer(event); });
      el.addEventListener('pointermove', event => { if (held) fromPointer(event); });
      for (const type of ['pointerup', 'pointercancel']) el.addEventListener(type, () => { held = false; });
      el.addEventListener('keydown', event => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[event.key];
        if (step) this.move(this.index + step);
        else if (event.key === 'Home') this.move(0);
        else if (event.key === 'End') this.move(this.values.length - 1);
        else return;
        event.preventDefault();
      });
      this.place(0);
    }

    get value() {
      return this.values[this.index];
    }

    /** Puts the thumb on entry i of the list. */
    place(i) {
      this.index = Math.min(this.values.length - 1, Math.max(0, i));
      const percent = 100 * this.index / (this.values.length - 1);
      if (this.vertical) this.thumb.style.bottom = percent + '%'; else this.thumb.style.left = percent + '%';
      this.el.setAttribute('aria-valuenow', this.index);
      this.el.setAttribute('aria-valuetext', this.format(this.value));
      this.el.title = this.format(this.value);
    }

    /** The user moved the thumb to entry i. */
    move(i) {
      const before = this.index;
      this.place(i);
      if (this.index !== before) this.onChange(this);
    }

    /** Shows the first value of the list that is not below v (the last one if v is beyond the list). */
    show(v) {
      let i = this.values.findIndex(entry => entry >= v * (1 - 1e-9));
      if (i < 0) i = this.values.length - 1;
      if (i !== this.index) this.place(i);
    }
  }

  root.Controles = { Control, Ladder, math };
})(window);
