// ============================================================
// ASCII FACE AVATAR generator.
//
// Deterministic per-username "face" assembled from pre-made
// feature blocks (shape / eyes / nose / mouth), wrapped in a
// frame that matches the face shape. Scales to any grid size.
//
//   generateFace('john', 8)        → string[]  (framed art)
//   generateFace('john', 8, 2)     → expression variant #2
//
// This is intentionally separate from asciiAvatar() in ascii.js
// (that one is a block identicon used by the chat list).
// ============================================================

// ── Feature banks ──────────────────────────────────────────
const SHAPES = ['oval', 'square', 'angular'];
const EYES = ['oo', '@@', '**', '◉◉', '><', '^^'];
const NOSE = ['.', 'v', 'ω', '~'];
const MOUTH = ['─', '∪', '◡', '^', '▼'];

// FNV-1a 32-bit — same hash family used elsewhere in the app.
function hash(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Center `str` inside a field of `width` chars (left-biased on odd gap).
function center(str, width) {
  if (str.length >= width) return str.slice(0, width);
  const total = width - str.length;
  const left = Math.floor(total / 2);
  return ' '.repeat(left) + str + ' '.repeat(total - left);
}

/**
 * Build a framed ASCII face for a username.
 *
 * @param {string} username   any string (deterministic per value)
 * @param {number} [size=8]   inner grid side length in chars
 * @param {number} [expr=0]   expression variant (rotates eyes + mouth);
 *                             0 = the user's canonical face
 * @returns {string[]}        lines of the framed avatar
 */
export function generateFace(username, size = 8, expr = 0) {
  const n = Math.max(4, Math.floor(size));
  const h = hash(username);

  // Independent feature indices from disjoint bit-slices of the hash.
  const shape = SHAPES[h % SHAPES.length];
  const baseEyes = (h >>> 3) % EYES.length;
  const baseMouth = (h >>> 11) % MOUTH.length;
  const noseIdx = (h >>> 19) % NOSE.length;

  // Expression rotates eyes + mouth so hover visibly "changes face".
  const eyes = EYES[(baseEyes + expr) % EYES.length];
  const mouth = MOUTH[(baseMouth + expr) % MOUTH.length];
  const nose = NOSE[noseIdx];

  // ── Blank inner grid ──
  const grid = Array.from({ length: n }, () => ' '.repeat(n));
  const put = (row, text) => {
    if (row >= 0 && row < n) grid[row] = center(text, n);
  };

  // Feature rows scale with the grid height.
  const rHair = Math.round(n * 0.12);
  const rEyes = Math.round(n * 0.38);
  const rNose = Math.round(n * 0.58);
  const rMouth = Math.round(n * 0.78);

  // Hair / forehead line depends on the face shape.
  if (shape === 'oval') {
    put(rHair, '◠◡'.repeat(Math.ceil(n / 2)).slice(0, n - 2));
  } else if (shape === 'square') {
    put(rHair, '█'.repeat(n - 2));
  } else {
    put(rHair, '/' + ' '.repeat(Math.max(0, n - 4)) + '\\');
  }

  // Eyes: split with a shape-scaled gap between them.
  const gap = Math.max(2, n - 6);
  put(rEyes, eyes[0] + ' '.repeat(gap) + eyes[eyes.length - 1]);

  // Nose + mouth (mouth widens slightly on larger grids).
  put(rNose, nose);
  const mouthW = Math.min(3, Math.max(1, Math.round(n / 4)));
  put(rMouth, mouth.repeat(mouthW));

  // Oval gets a chin curve on the last row.
  if (shape === 'oval' && n >= 6) put(n - 1, '◡'.repeat(Math.max(2, n - 4)));

  // ── Frame matching the shape ──
  const F =
    shape === 'oval'
      ? { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' }
      : shape === 'square'
      ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };

  const innerW = n + 2; // 1 char padding each side
  const top = F.tl + F.h.repeat(innerW) + F.tr;
  const bottom = F.bl + F.h.repeat(innerW) + F.br;
  const body = grid.map((line) => `${F.v} ${line} ${F.v}`);

  return [top, ...body, bottom];
}

/** Convenience: the canonical face as a single string. */
export function faceString(username, size = 8) {
  return generateFace(username, size, 0).join('\n');
}
