// ============================================================
// ASCII utilities for the Aurora TUI messenger.
//
// Exports:
//   asciiBox(width, height, title?)   — multiline border string
//   typewriter(element, text, speed?) — typewriter effect (returns abort fn)
//   matrixRain(canvas, options?)      — green/amber digital rain (returns stop fn)
// ============================================================

// Unicode box-drawing characters
export const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h:  '─', v:  '│',
  teeL: '├', teeR: '┤', teeT: '┬', teeB: '┴',
  cross: '┼',
  // Double-line variant
  d: {
    tl: '╔', tr: '╗', bl: '╚', br: '╝',
    h:  '═', v:  '║',
    teeL: '╠', teeR: '╣', teeT: '╦', teeB: '╩', cross: '╬',
  },
  // Rounded variant
  r: { tl: '╭', tr: '╮', bl: '╰', br: '╯' },
};

/**
 * Build an ASCII box of given dimensions as a multi-line string.
 * Width and height are in characters (the OUTER size of the box).
 *
 * @param {number}  width   total width in chars (>= 2)
 * @param {number}  height  total height in lines (>= 2)
 * @param {string} [title]  optional title inserted into the top border:
 *                          ┌─ TITLE ──────┐
 * @param {object} [opts]
 * @param {'single'|'double'|'rounded'} [opts.style] border style
 * @param {string} [opts.fill] character used to fill the interior
 * @returns {string} the rendered box (lines joined with '\n')
 *
 * @example
 *   asciiBox(20, 5, "HELLO")
 *   →
 *     ┌─ HELLO ──────────┐
 *     │                  │
 *     │                  │
 *     │                  │
 *     └──────────────────┘
 */
export function asciiBox(width, height, title = '', opts = {}) {
  const w = Math.max(2, Math.floor(width));
  const h = Math.max(2, Math.floor(height));
  const style = opts.style || 'single';
  const fill = (opts.fill ?? ' ').slice(0, 1);

  const set =
    style === 'double'  ? BOX.d :
    style === 'rounded' ? { ...BOX, ...BOX.r } :
                          BOX;

  // Build top border with embedded title
  const innerWidth = w - 2;
  let topMid;
  if (title) {
    const t = ` ${title} `.toUpperCase();
    if (t.length >= innerWidth) {
      topMid = t.slice(0, innerWidth);
    } else {
      const remaining = innerWidth - t.length;
      const left = Math.max(1, Math.min(remaining, 1));
      const right = remaining - left;
      topMid = set.h.repeat(left) + t + set.h.repeat(right);
    }
  } else {
    topMid = set.h.repeat(innerWidth);
  }

  const top = set.tl + topMid + set.tr;
  const bottom = set.bl + set.h.repeat(innerWidth) + set.br;
  const middle = set.v + fill.repeat(innerWidth) + set.v;

  const lines = [top];
  for (let i = 0; i < h - 2; i++) lines.push(middle);
  lines.push(bottom);

  return lines.join('\n');
}

/**
 * Render text into an HTMLElement one character at a time.
 * Returns an `abort` function to cancel the animation early.
 *
 * @param {HTMLElement} element  target element (textContent will be replaced)
 * @param {string}      text     full text to type out
 * @param {number}      [speed]  delay between chars in ms (default 40)
 * @param {object}      [opts]
 * @param {boolean}     [opts.caret] append a blinking █ caret while typing
 * @param {function}    [opts.onDone] called when finished
 * @returns {() => void} abort function
 *
 * @example
 *   const stop = typewriter(myEl, "Hello world!", 30);
 */
export function typewriter(element, text, speed = 40, opts = {}) {
  if (!element || typeof text !== 'string') return () => {};
  const caret = opts.caret !== false;
  const onDone = opts.onDone || (() => {});
  let i = 0;
  let cancelled = false;

  element.textContent = '';
  if (caret) element.classList.add('caret-inline');

  function tick() {
    if (cancelled) return;
    if (i < text.length) {
      element.textContent += text.charAt(i++);
      setTimeout(tick, speed);
    } else {
      if (caret) element.classList.remove('caret-inline');
      onDone();
    }
  }
  tick();

  return () => {
    cancelled = true;
    if (caret) element.classList.remove('caret-inline');
  };
}

/**
 * Classic falling-character "matrix rain" on a canvas element.
 * Reads --c-fg / --c-bg from CSS variables so it adapts to the theme.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {string} [options.chars]  glyph alphabet
 * @param {number} [options.fontSize] px (default 16)
 * @param {number} [options.fps]    redraw rate (default 24)
 * @returns {() => void} stop function
 */
export function matrixRain(canvas, options = {}) {
  if (!canvas || !canvas.getContext) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const fontSize = options.fontSize || 16;
  const fps = options.fps || 24;
  const chars =
    options.chars ||
    'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';

  // Read live CSS variables (so the rain matches matrix/amber themes)
  const root = document.documentElement;
  const getVar = (name, fallback) =>
    getComputedStyle(root).getPropertyValue(name).trim() || fallback;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
  }
  resize();

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  let columns = Math.floor(canvas.width / fontSize) || 1;
  let drops = Array.from({ length: columns }, () =>
    Math.floor(Math.random() * -50)
  );

  function step() {
    columns = Math.floor(canvas.width / fontSize) || 1;
    if (drops.length !== columns) {
      drops = Array.from({ length: columns }, () =>
        Math.floor(Math.random() * -50)
      );
    }

    const bg = getVar('--c-bg', '#0D0D0D');
    const fg = getVar('--c-fg', '#00FF41');
    const fgDim = getVar('--c-fg-dim', '#00A82B');

    // Trailing fade
    ctx.fillStyle = bg + 'CC'; // ~80% bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < drops.length; i++) {
      const ch = chars.charAt(Math.floor(Math.random() * chars.length));
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // First glyph at head — bright; tail — dim
      ctx.fillStyle = drops[i] === 0 ? fg : fgDim;
      ctx.fillText(ch, x, y);

      // Recycle drop
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  const interval = setInterval(step, 1000 / fps);

  return () => {
    clearInterval(interval);
    window.removeEventListener('resize', onResize);
  };
}

// ============================================================
// Bonus helpers (handy elsewhere in the app)
// ============================================================

/** Horizontal divider line of given width with optional label. */
export function asciiDivider(width, label) {
  const w = Math.max(2, Math.floor(width));
  if (!label) return BOX.h.repeat(w);
  const t = ` ${label.toUpperCase()} `;
  if (t.length >= w) return t.slice(0, w);
  const left = 2;
  const right = w - t.length - left;
  return BOX.h.repeat(left) + t + BOX.h.repeat(right);
}

/** Build a progress bar like `[████████░░░░░░░░] 50%`. */
export function asciiProgress(percent, width = 32) {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

/**
 * Generate a deterministic 4x4 (or N×N) ASCII avatar from a seed string.
 * Identicon-style: symmetric horizontally for aesthetic.
 * Cells use: ' ' (empty), '░', '▒', '▓', '█' depending on hash bits.
 *
 * @param {string} seed   any string (user id, name, etc.)
 * @param {number} [size] grid side length in chars (default 4)
 * @returns {string[]}    array of `size` strings, each `size` chars long
 *
 * @example
 *   asciiAvatar('alice', 4)
 *   → [ '█░░█', '▓██▓', '░██░', '█▓▓█' ]
 */
export function asciiAvatar(seed, size = 4) {
  // FNV-1a 32-bit hash (deterministic, well-distributed)
  let h = 2166136261;
  const s = String(seed ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }

  const palette = [' ', ' ', '░', '▒', '▓', '█', '█', '▓']; // weighted
  const halfW = Math.ceil(size / 2);
  const rows = [];

  // Use rotating hash so each cell gets fresh bits
  let bits = h;
  function take(n) {
    if (bits === 0) bits = (h ^ 0xdeadbeef) >>> 0 || 1;
    const v = bits & ((1 << n) - 1);
    bits = (bits >>> n) | (bits << (32 - n));
    bits = bits >>> 0;
    return v;
  }

  for (let y = 0; y < size; y++) {
    let half = '';
    for (let x = 0; x < halfW; x++) {
      const idx = take(3);
      half += palette[idx % palette.length];
    }
    const mirrored = half.split('').reverse().join('');
    const full = half + mirrored.slice(size % 2);
    rows.push(full.slice(0, size));
  }
  return rows;
}
