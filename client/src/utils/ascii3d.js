// ============================================================
// Mini ASCII 3D render engine.
//
// Point-sampling rasterizer with a per-cell Z-buffer and Lambert
// shading. Each primitive emits surface points (+ normals); points
// are transformed into camera space, perspective-projected, depth-
// tested, then shaded into a brightness ramp.
//
//   const r = new ASCIIRenderer(80, 36);
//   r.setCameraPosition(0, 0, 6);
//   r.lookAt(0, 0, 0);
//   r.setLight(-4, 5, 3);
//   r.clear();
//   r.drawTorus(0, 0, 0, 1.6, 0.6, [t, t * 0.5, 0]);
//   const lines = r.render();   // string[]
// ============================================================

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

// Rotate a point by Euler angles (X→Y→Z), reusable for normals too.
function rot(p, ax, ay, az) {
  let { x, y, z } = p;
  const cx = Math.cos(ax), sx = Math.sin(ax);
  let y1 = y * cx - z * sx;
  let z1 = y * sx + z * cx;
  const cy = Math.cos(ay), sy = Math.sin(ay);
  let x2 = x * cy + z1 * sy;
  let z2 = -x * sy + z1 * cy;
  const cz = Math.cos(az), sz = Math.sin(az);
  return { x: x2 * cz - y1 * sz, y: x2 * sz + y1 * cz, z: z2 };
}

export class ASCIIRenderer {
  constructor(width, height, fov = Math.PI / 4) {
    this.W = Math.max(2, Math.floor(width));
    this.H = Math.max(2, Math.floor(height));
    this.fov = fov;
    this.focal = 1 / Math.tan(fov / 2);
    this.charset = ' .:-=+*#%@';
    this.ambient = 0.15;

    this.camPos = { x: 0, y: 0, z: 6 };
    this.target = { x: 0, y: 0, z: 0 };
    this.light = norm({ x: -0.5, y: 0.8, z: 0.6 });
    this.lightPos = null; // when set, light is positional, not directional

    this._buildBasis();
    this.clear();
  }

  // ── configuration ───────────────────────────────────────
  setCharset(chars) {
    if (chars && chars.length >= 2) this.charset = chars;
    return this;
  }
  setCameraPosition(x, y, z) {
    this.camPos = { x, y, z };
    this._buildBasis();
    return this;
  }
  lookAt(x, y, z) {
    this.target = { x, y, z };
    this._buildBasis();
    return this;
  }
  /** Positional light source (shading uses direction to this point). */
  setLight(x, y, z) {
    this.lightPos = { x, y, z };
    return this;
  }

  _buildBasis() {
    const fwd = norm(sub(this.target, this.camPos));
    let right = cross(fwd, { x: 0, y: 1, z: 0 });
    if (Math.hypot(right.x, right.y, right.z) < 1e-6) right = { x: 1, y: 0, z: 0 };
    right = norm(right);
    const up = cross(right, fwd);
    this._fwd = fwd;
    this._right = right;
    this._up = up;
  }

  clear() {
    const n = this.W * this.H;
    this.cells = new Array(n).fill(' ');
    this.zbuf = new Float32Array(n).fill(-Infinity); // store 1/depth (bigger = nearer)
    return this;
  }

  // Project + depth-test + shade a single world-space surface point.
  _plot(p, normal) {
    const rel = sub(p, this.camPos);
    const cz = dot(rel, this._fwd); // depth in front of camera
    if (cz <= 0.05) return;
    const cx = dot(rel, this._right);
    const cy = dot(rel, this._up);

    const sY = (this.H * 0.5);
    // chars are ~2× taller than wide → widen X to keep shapes round
    const px = this.W / 2 + (cx * this.focal / cz) * sY * 2;
    const py = this.H / 2 - (cy * this.focal / cz) * sY;
    const gx = Math.round(px);
    const gy = Math.round(py);
    if (gx < 0 || gx >= this.W || gy < 0 || gy >= this.H) return;

    const idx = gy * this.W + gx;
    const inv = 1 / cz;
    if (inv <= this.zbuf[idx]) return; // something nearer already here
    this.zbuf[idx] = inv;

    // Lambert diffuse + ambient
    const Ldir = this.lightPos
      ? norm(sub(this.lightPos, p))
      : this.light;
    const d = Math.max(0, dot(norm(normal), Ldir));
    const intensity = Math.min(1, this.ambient + (1 - this.ambient) * d);
    const ci = Math.min(
      this.charset.length - 1,
      Math.max(0, Math.round(intensity * (this.charset.length - 1)))
    );
    this.cells[idx] = this.charset[ci];
  }

  // Sample count adapted to how big the primitive looks on screen.
  _density(center, extent, factor = 1.4) {
    const rel = sub(center, this.camPos);
    const cz = Math.max(0.2, dot(rel, this._fwd));
    const pxPerUnit = (this.focal * this.H * 0.5) / cz;
    return Math.max(10, Math.min(160, Math.ceil(extent * pxPerUnit * factor)));
  }

  // ── primitives ──────────────────────────────────────────
  drawSphere(x, y, z, radius = 1) {
    const c = { x, y, z };
    const n = this._density(c, radius * 2);
    for (let i = 0; i <= n; i++) {
      const phi = (i / n) * Math.PI; // 0..π (pole→pole)
      const sp = Math.sin(phi), cp = Math.cos(phi);
      const ring = Math.max(4, Math.ceil(n * sp));
      for (let j = 0; j < ring; j++) {
        const th = (j / ring) * Math.PI * 2;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        this._plot(
          { x: x + nx * radius, y: y + ny * radius, z: z + nz * radius },
          { x: nx, y: ny, z: nz }
        );
      }
    }
    return this;
  }

  drawTorus(x, y, z, R = 1.5, r = 0.5, rotation = [0, 0, 0]) {
    const [ax, ay, az] = rotation;
    const c = { x, y, z };
    const nU = this._density(c, (R + r) * 2, 1.1);
    const nV = Math.max(8, Math.round(nU * 0.45));
    for (let i = 0; i < nU; i++) {
      const u = (i / nU) * Math.PI * 2;
      const cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j < nV; j++) {
        const v = (j / nV) * Math.PI * 2;
        const cv = Math.cos(v), sv = Math.sin(v);
        // point on torus + outward normal (toward tube center → outside)
        let p = { x: (R + r * cv) * cu, y: r * sv, z: (R + r * cv) * su };
        let nrm = { x: cv * cu, y: sv, z: cv * su };
        p = rot(p, ax, ay, az);
        nrm = rot(nrm, ax, ay, az);
        this._plot({ x: x + p.x, y: y + p.y, z: z + p.z }, nrm);
      }
    }
    return this;
  }

  drawCube(x, y, z, size = 1, rotation = [0, 0, 0]) {
    const [ax, ay, az] = rotation;
    const s = size;
    const c = { x, y, z };
    const n = this._density(c, size * 2);
    // 6 faces: axis the face is perpendicular to + its sign
    const faces = [
      ['x', 1], ['x', -1],
      ['y', 1], ['y', -1],
      ['z', 1], ['z', -1],
    ];
    for (const [axis, sign] of faces) {
      const nrm0 = { x: 0, y: 0, z: 0 };
      nrm0[axis] = sign;
      const nrm = rot(nrm0, ax, ay, az);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 * s - s;
        for (let j = 0; j <= n; j++) {
          const b = (j / n) * 2 * s - s;
          let local;
          if (axis === 'x') local = { x: sign * s, y: a, z: b };
          else if (axis === 'y') local = { x: a, y: sign * s, z: b };
          else local = { x: a, y: b, z: sign * s };
          const pr = rot(local, ax, ay, az);
          this._plot({ x: x + pr.x, y: y + pr.y, z: z + pr.z }, nrm);
        }
      }
    }
    return this;
  }

  drawTetrahedron(x, y, z, size = 1, rotation = [0, 0, 0]) {
    const [ax, ay, az] = rotation;
    const s = size;
    // 4 vertices of a regular tetrahedron
    const V = [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: -1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },
    ].map((p) => ({ x: p.x * s, y: p.y * s, z: p.z * s }));
    const tris = [
      [0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2],
    ];
    const center = { x: 0, y: 0, z: 0 };
    const n = this._density({ x, y, z }, size * 2);
    for (const [i0, i1, i2] of tris) {
      const A = V[i0], B = V[i1], C = V[i2];
      // outward face normal
      let fn = cross(sub(B, A), sub(C, A));
      if (dot(fn, sub(A, center)) < 0) fn = { x: -fn.x, y: -fn.y, z: -fn.z };
      fn = rot(fn, ax, ay, az);
      const steps = Math.max(8, Math.round(n * 0.7));
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps - i; j++) {
          const u = i / steps;
          const v = j / steps;
          const w = 1 - u - v;
          const local = {
            x: A.x * w + B.x * u + C.x * v,
            y: A.y * w + B.y * u + C.y * v,
            z: A.z * w + B.z * u + C.z * v,
          };
          const pr = rot(local, ax, ay, az);
          this._plot({ x: x + pr.x, y: y + pr.y, z: z + pr.z }, fn);
        }
      }
    }
    return this;
  }

  /** Plot an array of {p:{x,y,z}, n:{x,y,z}} points (used for particles). */
  drawPoints(points) {
    for (const pt of points) this._plot(pt.p, pt.n || { x: 0, y: 0, z: 1 });
    return this;
  }

  render() {
    const lines = new Array(this.H);
    for (let y = 0; y < this.H; y++) {
      lines[y] = this.cells
        .slice(y * this.W, y * this.W + this.W)
        .join('');
    }
    return lines;
  }
}

export default ASCIIRenderer;
