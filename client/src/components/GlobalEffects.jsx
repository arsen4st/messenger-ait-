import { useEffect, useRef, useState } from 'react';
import { matrixRain } from '../utils/ascii';

/**
 * Always-on ambient CRT effects layered above the app but below the
 * global scanline (body::before, z 9998):
 *
 *   • faint matrix rain  — opacity 0.02, screen-blended
 *   • random glitch      — every 30–60s a UI patch flips to ░▓ noise
 *
 * Scanline + CRT brightness/contrast are handled in index.css.
 */
const GLITCH_CHARS = '░▒▓█ ░▓ ▒░';

export default function GlobalEffects() {
  const canvasRef = useRef(null);
  const [glitch, setGlitch] = useState(null); // { top,left,w,h,text } | null

  // ── faint matrix rain ─────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const stop = matrixRain(c, { fontSize: 16, fps: 18 });
    return stop;
  }, []);

  // ── periodic glitch burst ─────────────────────────────────
  useEffect(() => {
    let timer;
    let frameTimers = [];

    const burst = () => {
      const cols = 8 + ((Math.random() * 30) | 0);
      const rows = 3 + ((Math.random() * 8) | 0);
      const make = () =>
        Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () =>
            GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0]
          ).join('')
        ).join('\n');

      const rect = {
        top: `${(Math.random() * 75) | 0}vh`,
        left: `${(Math.random() * 75) | 0}vw`,
      };

      // 2–3 frames of churn, ~60ms each, then gone
      const frames = 2 + ((Math.random() * 2) | 0);
      let f = 0;
      const step = () => {
        if (f >= frames) {
          setGlitch(null);
        } else {
          setGlitch({ ...rect, text: make() });
          f++;
          frameTimers.push(setTimeout(step, 60));
        }
      };
      step();

      timer = setTimeout(burst, 30000 + Math.random() * 30000);
    };

    timer = setTimeout(burst, 30000 + Math.random() * 30000);
    return () => {
      clearTimeout(timer);
      frameTimers.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {/* matrix rain — barely-there background texture */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[9996]"
        style={{ opacity: 0.02, mixBlendMode: 'screen' }}
      />

      {/* random glitch patch */}
      {glitch && (
        <pre
          aria-hidden="true"
          className="fixed pointer-events-none z-[9997] m-0 leading-none select-none"
          style={{
            top: glitch.top,
            left: glitch.left,
            color: 'var(--c-fg)',
            textShadow: '0 0 6px var(--c-fg)',
            fontFamily: '"Courier New", monospace',
            fontSize: '14px',
            opacity: 0.85,
          }}
        >
          {glitch.text}
        </pre>
      )}
    </>
  );
}
