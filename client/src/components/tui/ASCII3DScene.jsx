import { Children, useEffect, useRef, useState } from 'react';
import ASCIIRenderer from '../../utils/ascii3d';

/**
 * Declarative ASCII 3D scene.
 *
 *   <ASCII3DScene fps={30} width={60} height={26}>
 *     <Cube position={[0,0,0]} rotation={(t) => [t, t*0.7, 0]} size={1} />
 *     <Sphere position={[3,0,0]} radius={1} />
 *   </ASCII3DScene>
 *
 * Any prop (position / rotation / camera / light) may be a value
 * or a function `(t) => value` where `t` is elapsed seconds — so
 * objects animate without the parent re-rendering.
 */
const PRIM = {
  cube: (r, p) => r.drawCube(...p.pos, p.size ?? 1, p.rot),
  sphere: (r, p) => r.drawSphere(...p.pos, p.radius ?? 1),
  torus: (r, p) => r.drawTorus(...p.pos, p.R ?? 1.5, p.r ?? 0.5, p.rot),
  tetra: (r, p) => r.drawTetrahedron(...p.pos, p.size ?? 1, p.rot),
};

const ev = (v, t, fb) =>
  v == null ? fb : typeof v === 'function' ? v(t) : v;

export function ASCII3DScene({
  width = 60,
  height = 26,
  fps = 30,
  fov,
  camera = [0, 0, 6],
  target = [0, 0, 0],
  light = [-4, 5, 4],
  charset,
  glow = true,
  paused = false,
  className = '',
  style,
  children,
}) {
  const [text, setText] = useState('');
  const rendRef = useRef(null);
  const childRef = useRef([]);

  // Flatten children → primitive descriptors each frame source.
  childRef.current = Children.toArray(children)
    .map((c) => {
      const kind = c?.type?.__prim;
      return kind ? { kind, props: c.props } : null;
    })
    .filter(Boolean);

  useEffect(() => {
    const r = new ASCIIRenderer(width, height, fov ?? Math.PI / 4);
    if (charset) r.setCharset(charset);
    rendRef.current = r;
  }, [width, height, fov, charset]);

  useEffect(() => {
    let raf;
    let last = 0;
    const start = performance.now();
    const frameMs = 1000 / Math.max(1, fps);

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (paused || now - last < frameMs) return;
      last = now;
      const r = rendRef.current;
      if (!r) return;
      const t = (now - start) / 1000;

      const cam = ev(camera, t, [0, 0, 6]);
      const tgt = ev(target, t, [0, 0, 0]);
      const lit = ev(light, t, [-4, 5, 4]);
      r.setCameraPosition(cam[0], cam[1], cam[2]);
      r.lookAt(tgt[0], tgt[1], tgt[2]);
      r.setLight(lit[0], lit[1], lit[2]);
      r.clear();

      for (const { kind, props } of childRef.current) {
        const draw = PRIM[kind];
        if (!draw) continue;
        draw(r, {
          pos: ev(props.position, t, [0, 0, 0]),
          rot: ev(props.rotation, t, [0, 0, 0]),
          size: ev(props.size, t),
          radius: ev(props.radius, t),
          R: ev(props.R, t),
          r: ev(props.r, t),
        });
      }
      setText(r.render().join('\n'));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, paused, camera, target, light]);

  return (
    <pre
      aria-hidden="true"
      className={`select-none m-0 leading-[0.92] inline-block ${className}`}
      style={{
        color: 'var(--c-fg)',
        textShadow: glow ? '0 0 6px var(--c-fg)' : 'none',
        fontFamily: '"Courier New", monospace',
        ...style,
      }}
    >
      {text}
    </pre>
  );
}

// ── Declarative marker primitives (render nothing themselves) ──
export const Cube = () => null;
Cube.__prim = 'cube';
export const Sphere = () => null;
Sphere.__prim = 'sphere';
export const Torus = () => null;
Torus.__prim = 'torus';
export const Tetrahedron = () => null;
Tetrahedron.__prim = 'tetra';

export default ASCII3DScene;
