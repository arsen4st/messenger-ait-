import { useEffect, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────
//  3D geometry: 8 vertices, 12 edges, 6 faces with outward normals.
// ──────────────────────────────────────────────────────────────
const VERTICES = [
  { x: -1, y: -1, z: -1 }, // 0  back-bottom-left
  { x:  1, y: -1, z: -1 }, // 1  back-bottom-right
  { x:  1, y:  1, z: -1 }, // 2  back-top-right
  { x: -1, y:  1, z: -1 }, // 3  back-top-left
  { x: -1, y: -1, z:  1 }, // 4  front-bottom-left
  { x:  1, y: -1, z:  1 }, // 5  front-bottom-right
  { x:  1, y:  1, z:  1 }, // 6  front-top-right
  { x: -1, y:  1, z:  1 }, // 7  front-top-left
];

const EDGES = [
  [0,1],[1,2],[2,3],[3,0], // back  square
  [4,5],[5,6],[6,7],[7,4], // front square
  [0,4],[1,5],[2,6],[3,7], // four connectors
];

// CCW winding when looking AT the face from outside → normal points outward.
// vertices are listed as [topLeft, topRight, bottomRight, bottomLeft] in screen-ish order.
const FACES = [
  { v: [0,1,2,3], n: { x:0,  y:0,  z:-1 } }, // back
  { v: [5,4,7,6], n: { x:0,  y:0,  z: 1 } }, // front
  { v: [4,0,3,7], n: { x:-1, y:0,  z: 0 } }, // left
  { v: [1,5,6,2], n: { x: 1, y:0,  z: 0 } }, // right
  { v: [4,5,1,0], n: { x:0,  y:-1, z: 0 } }, // bottom
  { v: [3,2,6,7], n: { x:0,  y: 1, z: 0 } }, // top
];

// Light direction (from object toward source). Upper-right-front feel.
const LIGHT = (() => {
  const x = 0.45, y = 0.8, z = 0.6;
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
})();

// ──────────────────────────────────────────────────────────────
//  Math helpers
// ──────────────────────────────────────────────────────────────
function rotatePoint(p, ax, ay, az) {
  let { x, y, z } = p;
  // Rotate around X
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const y1 = y * cx - z * sx;
  const z1 = y * sx + z * cx;
  // Rotate around Y
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const x2 = x * cy + z1 * sy;
  const z2 = -x * sy + z1 * cy;
  // Rotate around Z
  const cz = Math.cos(az), sz = Math.sin(az);
  return {
    x: x2 * cz - y1 * sz,
    y: x2 * sz + y1 * cz,
    z: z2,
  };
}

// ──────────────────────────────────────────────────────────────
//  Renderer: produces a multi-line string with the rasterized cube
// ──────────────────────────────────────────────────────────────
export function renderCube(W, H, angles, options = {}) {
  const grid = Array.from({ length: H }, () => new Array(W).fill(' '));
  const symbolOverride = options.symbol;

  // Rotate vertices and face normals
  const rotV = VERTICES.map((v) => rotatePoint(v, angles.x, angles.y, angles.z));
  const rotN = FACES.map((f) => rotatePoint(f.n, angles.x, angles.y, angles.z));

  // Perspective projection — camera at z = +dist, looking toward -z
  // chars are ~2× taller than wide, so we compress Y when mapping to grid rows
  const scale = Math.min(W * 0.18, H * 0.36);
  const dist = 5;
  const project = (p) => {
    const f = dist / (dist - p.z);
    return {
      x: W / 2 + p.x * scale * f * 2,   // ×2 for monospace aspect
      y: H / 2 - p.y * scale * f,
      z: p.z,
    };
  };
  const proj = rotV.map(project);

  // Visible faces (normal.z > 0), painter's order back→front
  const visible = FACES
    .map((face, idx) => ({ face, idx, normal: rotN[idx] }))
    .filter((f) => f.normal.z > 0)
    .map((f) => ({
      ...f,
      depth: f.face.v.reduce((s, i) => s + rotV[i].z, 0) / 4,
    }))
    .sort((a, b) => a.depth - b.depth); // farther first

  // ── 1. Fill each visible face with a shade based on light ──
  for (const { face, normal } of visible) {
    // Diffuse light coefficient (Lambert)
    const dot = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
    const diffuse = Math.max(0, dot);

    let ch;
    if (symbolOverride) ch = symbolOverride;
    else if (diffuse < 0.30) ch = '░';
    else if (diffuse < 0.65) ch = '▒';
    else                     ch = '▓';

    const [a, b, c, d] = face.v.map((i) => proj[i]); // TL, TR, BR, BL
    const maxEdge = Math.max(
      Math.hypot(b.x - a.x, b.y - a.y),
      Math.hypot(c.x - b.x, c.y - b.y),
      Math.hypot(d.x - c.x, d.y - c.y),
      Math.hypot(a.x - d.x, a.y - d.y),
    );
    const samples = Math.max(14, Math.ceil(maxEdge * 1.6));

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      for (let j = 0; j <= samples; j++) {
        const v = j / samples;
        // bilinear interpolation across the quad
        const tx = a.x + (b.x - a.x) * u;
        const ty = a.y + (b.y - a.y) * u;
        const bx = d.x + (c.x - d.x) * u;
        const by = d.y + (c.y - d.y) * u;
        const px = tx + (bx - tx) * v;
        const py = ty + (by - ty) * v;
        const gx = Math.round(px), gy = Math.round(py);
        if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
          grid[gy][gx] = ch;
        }
      }
    }
  }

  // ── 2. Draw all 12 edges over the fills ──
  for (const [i, j] of EDGES) {
    const p0 = proj[i], p1 = proj[j];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    let edgeCh;
    if (absDx < 0.5)               edgeCh = '|';
    else if (absDy < 0.5)          edgeCh = '-';
    else if (absDx / absDy > 2.5)  edgeCh = '-';
    else if (absDy / absDx > 2.5)  edgeCh = '|';
    else                           edgeCh = (dx * dy > 0) ? '\\' : '/';

    const len = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(len * 1.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const gx = Math.round(p0.x + dx * t);
      const gy = Math.round(p0.y + dy * t);
      if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
        grid[gy][gx] = edgeCh;
      }
    }
  }

  // ── 3. Stamp + at each projected vertex (corners) ──
  for (const v of proj) {
    const gx = Math.round(v.x), gy = Math.round(v.y);
    if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
      grid[gy][gx] = '+';
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

// ──────────────────────────────────────────────────────────────
//  React component
// ──────────────────────────────────────────────────────────────
function ASCIICube({
  size = 24,
  speed = 1,
  symbol,
  autoRotate = true,
  onHover = true,             // bool: pause on hover · or fn: hover-state callback
  className = '',
  style,
}) {
  const [text, setText] = useState('');
  const angleRef = useRef({ x: 0.42, y: 0.6, z: 0 });
  const pausedRef = useRef(false);

  // monospace chars are taller than wide → width ≈ 2× height for square cube
  const W = Math.max(10, Math.floor(size * 2));
  const H = Math.max(5,  Math.floor(size));

  useEffect(() => {
    let raf;
    let lastTime = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - lastTime < 1000 / 30) return;  // throttle to 30fps
      lastTime = t;
      if (autoRotate && !pausedRef.current) {
        angleRef.current.x += 0.012 * speed;
        angleRef.current.y += 0.018 * speed;
        angleRef.current.z += 0.005 * speed;
      }
      setText(renderCube(W, H, angleRef.current, { symbol }));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [W, H, speed, autoRotate, symbol]);

  const handleEnter = () => {
    if (onHover === true) pausedRef.current = true;
    if (typeof onHover === 'function') onHover(true);
  };
  const handleLeave = () => {
    if (onHover === true) pausedRef.current = false;
    if (typeof onHover === 'function') onHover(false);
  };

  return (
    <pre
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`select-none m-0 leading-[0.92] inline-block ${className}`}
      style={{
        color: 'var(--c-fg)',
        textShadow: '0 0 6px var(--c-fg)',
        fontFamily: '"Courier New", monospace',
        ...style,
      }}
    >{text}</pre>
  );
}

export default ASCIICube;
