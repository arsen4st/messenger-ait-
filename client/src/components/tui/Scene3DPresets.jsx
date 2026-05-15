import { useEffect, useRef, useState } from 'react';
import ASCIIRenderer from '../../utils/ascii3d';
import { ASCII3DScene, Torus, Sphere } from './ASCII3DScene';

/* ── Rotating torus — corner "loading" widget ──────────────── */
export function Torus3DLoader({ size = 22, label = 'LOADING', className = '' }) {
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <ASCII3DScene
        width={size * 2}
        height={size}
        fps={30}
        camera={[0, 0, 6]}
        charset=" .:-=+*#%@"
      >
        <Torus
          position={[0, 0, 0]}
          R={1.7}
          r={0.6}
          rotation={(t) => [t * 1.1, t * 0.6, 0]}
        />
      </ASCII3DScene>
      <div className="text-fg-dim text-[11px] tracking-[0.3em] animate-cursor-blink">
        {label}...
      </div>
    </div>
  );
}

/* ── Sphere avatar for "Bot" contacts ──────────────────────── */
export function BotSphere({ size = 8, className = '' }) {
  // The sphere itself doesn't spin — orbit the light so it "breathes".
  return (
    <ASCII3DScene
      width={size * 2}
      height={size}
      fps={24}
      camera={[0, 0, 5]}
      light={(t) => [Math.cos(t) * 5, 3, Math.sin(t) * 5 + 2]}
      charset=" .:-=+*#%@"
      className={className}
    >
      <Sphere position={[0, 0, 0]} radius={1.5} />
    </ASCII3DScene>
  );
}

/* ── Cube that bursts into particles (logout transition) ────── */
export function CubeExplosion({
  size = 26,
  trigger = false,
  onDone,
  className = '',
}) {
  const [text, setText] = useState('');
  const stateRef = useRef({ phase: 'idle', t0: 0, parts: null });

  useEffect(() => {
    const W = size * 2;
    const H = size;
    const r = new ASCIIRenderer(W, H, Math.PI / 4);
    r.setCameraPosition(0, 0, 6);
    r.setLight(-4, 5, 4);

    // Seed particles from the cube surface (lazily, on first frame).
    const seedParticles = () => {
      const pts = [];
      const N = 12;
      for (const [ax, sg] of [
        ['x', 1], ['x', -1], ['y', 1], ['y', -1], ['z', 1], ['z', -1],
      ]) {
        for (let i = 0; i <= N; i++)
          for (let j = 0; j <= N; j++) {
            const a = (i / N) * 2 - 1;
            const b = (j / N) * 2 - 1;
            const p = { x: 0, y: 0, z: 0 };
            if (ax === 'x') { p.x = sg; p.y = a; p.z = b; }
            else if (ax === 'y') { p.x = a; p.y = sg; p.z = b; }
            else { p.x = a; p.y = b; p.z = sg; }
            pts.push({
              p: { ...p },
              n: { x: p.x, y: p.y, z: p.z },
              v: {
                x: p.x * (0.8 + Math.random()),
                y: p.y * (0.8 + Math.random()) + 0.4,
                z: p.z * (0.8 + Math.random()),
              },
            });
          }
      }
      return pts;
    };

    let raf;
    let last = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / 30) return;
      last = now;
      const st = stateRef.current;
      const t = now / 1000;
      r.clear();

      if (st.phase !== 'boom') {
        // intact, slowly rotating cube
        r.drawCube(0, 0, 0, 1, [t * 0.6, t * 0.9, 0]);
      } else {
        if (!st.parts) st.parts = seedParticles();
        const dt = (now - st.t0) / 1000;
        for (const pt of st.parts) {
          pt.p.x += pt.v.x * 0.045;
          pt.p.y += pt.v.y * 0.045;
          pt.p.z += pt.v.z * 0.045;
          pt.v.y -= 0.012; // gravity
        }
        r.drawPoints(st.parts);
        if (dt > 1.6) {
          cancelAnimationFrame(raf);
          onDone?.();
          return;
        }
      }
      setText(r.render().join('\n'));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, onDone]);

  useEffect(() => {
    if (trigger && stateRef.current.phase === 'idle') {
      stateRef.current.phase = 'boom';
      stateRef.current.t0 = performance.now();
    }
  }, [trigger]);

  return (
    <pre
      aria-hidden="true"
      className={`select-none m-0 leading-[0.92] inline-block ${className}`}
      style={{
        color: 'var(--c-fg)',
        textShadow: '0 0 6px var(--c-fg)',
        fontFamily: '"Courier New", monospace',
      }}
    >
      {text}
    </pre>
  );
}
