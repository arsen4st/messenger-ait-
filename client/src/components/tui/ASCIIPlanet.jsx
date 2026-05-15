import { useEffect, useMemo, useRef, useState } from 'react';

// Brightness → char ramp (per spec)
const RAMP = ' .:;+=?#&@';

// Light direction (upper-right-front), normalized
const LIGHT = (() => {
  const x = 0.55, y = 0.4, z = 0.74;
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
})();

// ──────────────────────────────────────────────────────────────
//  Preset "planets" — different textures + labels
// ──────────────────────────────────────────────────────────────
const PLANETS = [
  {
    name: 'EARTH-CLASS',
    mass: '5.97e24 KG',
    radiusKm: '6,371',
    tilt: 0.41,             // axial tilt (rad)
    rotMul: 1,
    // continents via overlaid sines (looks vaguely earthy)
    isLand: (lat, lon) => (
      Math.sin(lat * 3.2 + 0.4) * Math.cos(lon * 2.5)
      + 0.35 * Math.sin(lon * 5.1 + lat * 4.0)
    ) > 0.18,
    waterDelta: -3,
  },
  {
    name: 'MARS-CLASS',
    mass: '6.39e23 KG',
    radiusKm: '3,389',
    tilt: 0.44,
    rotMul: 0.97,
    // mostly land, big dusty regions
    isLand: (lat, lon) => (
      Math.sin(lat * 1.8) * Math.cos(lon * 1.6 + 0.3) + 0.4 * Math.sin(lon * 3 + lat * 2)
    ) > -0.20,
    waterDelta: -1,
  },
  {
    name: 'JUPITER-CLASS',
    mass: '1.90e27 KG',
    radiusKm: '69,911',
    tilt: 0.05,
    rotMul: 2.2,             // gas giants rotate fast
    // horizontal bands
    isLand: (lat, lon) => (
      Math.sin(lat * 7 + Math.sin(lon * 1.2) * 0.5) > 0
    ),
    waterDelta: -2,
  },
  {
    name: 'PULSAR-X1',
    mass: '4.2e30 KG',
    radiusKm: '11.4',
    tilt: 0.2,
    rotMul: 6,               // pulsars spin like crazy
    // tight ring pattern
    isLand: (lat, lon) => (
      Math.sin(lon * 14 + lat * 3) > 0.6
    ),
    waterDelta: -1,
  },
  {
    name: 'GAS GIANT',
    mass: '1.02e26 KG',
    radiusKm: '24,622',
    tilt: -0.5,
    rotMul: 1.8,
    isLand: (lat, lon) => (
      Math.sin(lat * 4.5 + Math.cos(lon * 2) * 1.2) > -0.2
    ),
    waterDelta: -2,
  },
];

// Cheap deterministic hash for stable star positions
function hash32(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h;
}

// ──────────────────────────────────────────────────────────────
//  Renderer
// ──────────────────────────────────────────────────────────────
export function renderPlanet(W, H, rotY, planet) {
  const grid = Array.from({ length: H }, () => new Array(W).fill(' '));
  const cx = W / 2;
  const cy = H / 2;
  // monospace cells are about 2× taller than wide → compress X dist
  // pick radius based on the smaller axis
  const rx = W / 2 - 1;          // cells horizontally
  const ry = H / 2 - 1;          // cells vertically
  const aspect = 0.5;            // char w/h ratio
  // unit-sphere radius in char-cells
  const radiusCells = Math.min(rx * aspect, ry);

  const cTilt = Math.cos(planet.tilt);
  const sTilt = Math.sin(planet.tilt);

  // ── 1. Stars in the background (deterministic) ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = hash32(x, y);
      const slot = h % 220;
      if (slot < 1)      grid[y][x] = '*';
      else if (slot < 4) grid[y][x] = '.';
      else if (slot < 5) grid[y][x] = '·';
    }
  }

  // ── 2. Sphere surface ──
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Normalized coords relative to sphere unit radius
      const nx = ((x - cx) * aspect) / radiusCells;
      const ny = (y - cy) / radiusCells;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue; // outside sphere → keep star/space

      const nz = Math.sqrt(1 - r2);

      // Surface normal in world space (unit vector)
      const Nx = nx, Ny = ny, Nz = nz;

      // Diffuse light (Lambert) in world space — used for shading
      const lightDot = Nx * LIGHT.x + Ny * LIGHT.y + Nz * LIGHT.z;
      const brightness = Math.max(0, lightDot);

      // To sample texture, undo:
      //   1) Y-axis rotation by rotY
      //   2) Axial tilt around Z
      //
      // First reverse tilt (so the planet's pole becomes y-axis again):
      const tNx =  Nx * cTilt + Ny * sTilt;
      const tNy = -Nx * sTilt + Ny * cTilt;
      const tNz =  Nz;
      // Reverse Y rotation:
      const c = Math.cos(-rotY), s = Math.sin(-rotY);
      const tx = tNx * c - tNz * s;
      const ty = tNy;
      const tz = tNx * s + tNz * c;

      // Geographic coords on the (now upright) sphere
      const lat = Math.asin(Math.max(-1, Math.min(1, ty)));
      const lon = Math.atan2(tx, tz);

      // Sample two-symbol "texture" (checker / continents)
      const land = planet.isLand(lat, lon);

      // Map brightness to RAMP index; ocean is darker
      let idx = Math.round(brightness * (RAMP.length - 1));
      if (!land) idx = Math.max(0, idx + planet.waterDelta);
      idx = Math.max(0, Math.min(RAMP.length - 1, idx));

      // Limb darkening — extra dimming near the edge
      const edge = Math.sqrt(r2);
      if (edge > 0.9 && idx > 1) idx -= 1;

      grid[y][x] = RAMP[idx];
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

// ──────────────────────────────────────────────────────────────
//  React component
// ──────────────────────────────────────────────────────────────
function ASCIIPlanet({
  size = 18,
  speed = 1,
  initialPlanet = 0,
  hoverSpeedMultiplier = 3.5,
  showCaption = true,
  className = '',
}) {
  const [text, setText] = useState('');
  const [planetIdx, setPlanetIdx] = useState(initialPlanet % PLANETS.length);
  const rotRef = useRef(0);
  const hoverRef = useRef(false);

  // Width 2× height so the rendered sphere looks round in monospace
  const W = useMemo(() => Math.max(20, Math.floor(size * 2.4)), [size]);
  const H = useMemo(() => Math.max(10, Math.floor(size)), [size]);

  const planet = PLANETS[planetIdx];

  useEffect(() => {
    let raf;
    let last = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / 30) return; // ~30fps
      last = t;
      const hoverBoost = hoverRef.current ? hoverSpeedMultiplier : 1;
      rotRef.current += 0.04 * speed * planet.rotMul * hoverBoost;
      setText(renderPlanet(W, H, rotRef.current, planet));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [W, H, speed, planet, hoverSpeedMultiplier]);

  const cyclePlanet = () => setPlanetIdx((i) => (i + 1) % PLANETS.length);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <pre
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
        onClick={cyclePlanet}
        title="click → next body · hover → faster"
        className="select-none m-0 leading-[0.92] cursor-pointer"
        style={{
          color: 'var(--c-fg)',
          textShadow: '0 0 6px var(--c-fg)',
          fontFamily: '"Courier New", monospace',
        }}
      >{text}</pre>

      {showCaption && (
        <div className="mt-3 font-mono text-[12px] tracking-wider">
          <div className="text-fg-dim">
            <span className="text-fg">&gt;</span> ROTATING BODY:{' '}
            <span className="text-fg glow">{planet.name}</span>
            <span className="text-fg-dim mx-1">|</span>
            MASS: <span className="text-fg">{planet.mass}</span>
            <span className="text-fg-dim mx-1">|</span>
            R: <span className="text-fg">{planet.radiusKm} km</span>
          </div>
          <div className="text-muted text-[10px] mt-1 text-center">
            [click] cycle body  ·  [hover] spin faster
          </div>
        </div>
      )}
    </div>
  );
}

export default ASCIIPlanet;
