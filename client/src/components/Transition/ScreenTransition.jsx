import { useEffect, useMemo, useRef, useState } from 'react';
import useTransitionStore from '../../store/transitionStore';
import { beep, keyClick } from '../../utils/sound';

/* Per-type timing (ms). cover + reveal stays inside the 300–500ms budget. */
const TIMING = {
  wipe: { cover: 250, reveal: 240 },
  clear: { cover: 170, reveal: 160 },
  glitch: { cover: 140, reveal: 130 },
};

const BLOCK = '█';
const WIPE_CHARS = 'ｱｲｳｴｵｶｷｸｹｺ#@$%&░▒▓█+=*0123456789';
const CLEAR_CHARS = ' ░▒▓█/\\|<>[]{}=+-*0123456789abcdef$#@%&';
const GLITCH_CHARS = '  ░░▒▓██▓▒░ █▓ ░'; // weighted toward gaps so content shows through

function randStr(pool, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += pool[(Math.random() * pool.length) | 0];
  return s;
}

function grid() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return { cols: Math.ceil(w / 8.5), rows: Math.ceil(h / 16) };
}

/* ── WIPE ─────────────────────────────────────────────────────
   Block-char rows sweep in left→right (cover) with a small per-row
   stagger for a ragged edge, then retreat to the right (reveal). */
function WipeOverlay({ phase }) {
  const { cols, rows } = useMemo(grid, []);
  const lines = useMemo(
    () =>
      Array.from({ length: rows }, () => ({
        text: randStr(WIPE_CHARS, cols),
        delay: (Math.random() * 50) | 0, // ragged leading edge
        dur: 170 + ((Math.random() * 40) | 0),
      })),
    [cols, rows]
  );
  return (
    <pre className="st-pre">
      {lines.map((ln, i) => (
        <div
          key={i}
          className={phase === 'cover' ? 'st-wipe-cover' : 'st-wipe-reveal'}
          style={{ animationDelay: `${ln.delay}ms`, animationDuration: `${ln.dur}ms` }}
        >
          {ln.text}
        </div>
      ))}
    </pre>
  );
}

/* ── TERMINAL CLEAR ───────────────────────────────────────────
   A tall slab of random junk scrolls through (cover), then the
   slab scrolls up and off, dropping the new screen in (reveal). */
function ClearOverlay({ phase }) {
  const { cols, rows } = useMemo(grid, []);
  const [, force] = useState(0);

  // Re-randomize fast while covering → looks like junk scrolling past.
  useEffect(() => {
    if (phase !== 'cover') return;
    let raf;
    let last = 0;
    const tick = (t) => {
      if (t - last > 28) {
        force((n) => n + 1);
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const text = useMemo(
    () => Array.from({ length: rows }, () => randStr(CLEAR_CHARS, cols)).join('\n'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase === 'cover' ? Math.random() : 0]
  );

  return (
    <pre className={`st-pre ${phase === 'cover' ? 'st-clear-cover' : 'st-clear-reveal'}`}>
      {text}
    </pre>
  );
}

/* ── GLITCH ───────────────────────────────────────────────────
   Three frames of █▓ corruption (gaps let the screen bleed through),
   then a hard cut on the last frame. */
function GlitchOverlay() {
  const { cols, rows } = useMemo(grid, []);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 60);
    return () => clearInterval(id);
  }, []);

  const text = useMemo(
    () => Array.from({ length: rows }, () => randStr(GLITCH_CHARS, cols)).join('\n'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame, cols, rows]
  );

  return (
    <pre
      className="st-pre st-glitch"
      style={{ transform: `translate(${(frame % 2 ? 2 : -3)}px, ${frame % 3 ? -2 : 1}px)` }}
    >
      {text}
    </pre>
  );
}

export default function ScreenTransition() {
  const { type, phase, token, _runCallback, _setPhase, _end } = useTransitionStore();
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!type || phase === 'idle') return;
    const t = TIMING[type] || TIMING.wipe;

    if (phase === 'cover') {
      try {
        if (type === 'wipe') beep({ frequency: 180, duration: 200, volume: 0.1, type: 'square' });
        else if (type === 'clear') keyClick();
        else if (type === 'glitch') beep({ frequency: 90, duration: 160, volume: 0.16, type: 'sawtooth' });
      } catch {}

      const id = setTimeout(() => {
        _runCallback(); // swap the screen while it's hidden
        _setPhase('reveal');
      }, t.cover);
      timers.current.push(id);
    } else if (phase === 'reveal') {
      const id = setTimeout(() => _end(), t.reveal);
      timers.current.push(id);
    }

    return clearTimers;
    // re-run on every new transition (token) and every phase change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, phase, type]);

  useEffect(() => () => clearTimers(), []);

  if (!type || phase === 'idle') return null;

  return (
    <div className="st-root" key={token} aria-hidden="true">
      {type === 'wipe' && <WipeOverlay phase={phase} />}
      {type === 'clear' && <ClearOverlay phase={phase} />}
      {type === 'glitch' && <GlitchOverlay />}
    </div>
  );
}
