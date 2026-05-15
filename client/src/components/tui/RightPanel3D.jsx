import { useState } from 'react';
import { ASCII3DScene, Torus, Cube, Sphere } from './ASCII3DScene';

/* The right 200px column — a rotating ASCII 3D object the user can
   cycle through (torus / cube / sphere). */
const OBJECTS = ['torus', 'cube', 'sphere'];

export default function RightPanel3D() {
  const [obj, setObj] = useState('torus');

  return (
    <div className="h-full flex flex-col bg-bg select-none">
      <div className="px-2 py-1 border-b border-fg-dim text-[11px] text-fg-dim tracking-widest flex items-center">
        <span className="text-fg">▞</span>
        <span className="ml-1">ASCII 3D</span>
        <button
          onClick={() =>
            setObj((o) => OBJECTS[(OBJECTS.indexOf(o) + 1) % OBJECTS.length])
          }
          className="ml-auto text-fg-dim hover:text-fg"
          title="cycle object"
        >
          [{obj.toUpperCase()}]
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <ASCII3DScene
          width={34}
          height={26}
          fps={30}
          camera={[0, 0, 6]}
          light={(t) => [Math.cos(t * 0.6) * 5, 4, Math.sin(t * 0.6) * 5 + 2]}
          style={{ fontSize: '9px', lineHeight: '0.95' }}
        >
          {obj === 'torus' && (
            <Torus position={[0, 0, 0]} R={1.7} r={0.6} rotation={(t) => [t * 1.1, t * 0.6, 0]} />
          )}
          {obj === 'cube' && (
            <Cube position={[0, 0, 0]} size={1.1} rotation={(t) => [t * 0.7, t, 0]} />
          )}
          {obj === 'sphere' && <Sphere position={[0, 0, 0]} radius={1.6} />}
        </ASCII3DScene>
      </div>

      <div className="px-2 py-1 border-t border-fg-dim text-[10px] text-fg-dim text-center">
        rendered @ 30fps · z-buffered
      </div>
    </div>
  );
}
