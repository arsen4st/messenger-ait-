import { useEffect, useRef, useState } from 'react';

/**
 * ASCII loaders / spinners for the terminal messenger.
 *
 *   <ASCIILoader type={1} progress={61} label="LOADING..." />
 *   <ASCIILoader type={3} />                       // self-animating spinner
 *   <ASCIILoader type={6} progress={42} label="Receiving data..." />
 *
 * Types
 *   1  progress bar     [████████░░░░] 61% LOADING...
 *   2  thin progress     ━━━━━━━━━────────── 72%
 *   3  ascii spinner     [|] PROCESSING...      (| / - \, 150ms)
 *   4  block spinner     ▖ ▘ ▝ ▗                (clockwise, 150ms)
 *   5  braille spinner   ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏           (100ms)
 *   6  matrix transfer   > line + ░→█ fill bar
 *
 * Progress (types 1,2,6): pass `progress` 0–100 for controlled mode.
 * Omit it for an auto-incrementing demo (uses `autoMs` per step).
 *
 * @param {object}  props
 * @param {1|2|3|4|5|6} props.type
 * @param {number}  [props.progress]   0–100; omit → auto
 * @param {string}  [props.label]
 * @param {number}  [props.width]      bar width in cells
 * @param {number}  [props.speed]      spinner frame ms
 * @param {number}  [props.autoMs]     ms per step in auto mode
 * @param {boolean} [props.glow]       phosphor text-glow (default true)
 * @param {string}  [props.className]
 */
const SPINNERS = {
  3: { frames: ['|', '/', '-', '\\'], ms: 150 },
  4: { frames: ['▖', '▘', '▝', '▗'], ms: 150 }, // clockwise corners
  5: {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    ms: 100,
  },
};

const DEFAULT_LABEL = {
  1: 'LOADING...',
  2: '',
  3: 'PROCESSING...',
  4: 'PROCESSING...',
  5: 'PROCESSING...',
  6: 'Receiving data...',
};

export default function ASCIILoader({
  type = 1,
  progress,
  label,
  width,
  speed,
  autoMs = 90,
  glow = true,
  className = '',
}) {
  const controlled = typeof progress === 'number';
  const isSpinner = type === 3 || type === 4 || type === 5;

  // ── Spinner frame index ───────────────────────────────────
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!isSpinner) return;
    const cfg = SPINNERS[type];
    const id = setInterval(
      () => setFrame((f) => (f + 1) % cfg.frames.length),
      speed || cfg.ms
    );
    return () => clearInterval(id);
  }, [type, speed, isSpinner]);

  // ── Auto progress (uncontrolled bar / matrix) ─────────────
  const [auto, setAuto] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (isSpinner || controlled) return;
    setAuto(0);
    const id = setInterval(() => {
      setAuto((p) => {
        if (p >= 100) return 0; // loop the demo
        return Math.min(100, p + 1 + ((Math.random() * 3) | 0));
      });
    }, type === 6 ? 100 : autoMs);
    raf.current = id;
    return () => clearInterval(id);
  }, [type, controlled, isSpinner, autoMs]);

  const pct = Math.max(
    0,
    Math.min(100, Math.round(controlled ? progress : auto))
  );
  const text = label ?? DEFAULT_LABEL[type] ?? '';
  const glowCls = glow ? 'glow' : '';

  // ── Renderers ─────────────────────────────────────────────
  if (type === 1) {
    const w = width || 20;
    const filled = Math.round((pct / 100) * w);
    return (
      <span
        className={`font-mono text-fg whitespace-pre tabular ${glowCls} ${className}`}
      >
        [<span className="text-fg">{'█'.repeat(filled)}</span>
        <span className="text-fg-dim">{'░'.repeat(w - filled)}</span>]{' '}
        {String(pct).padStart(2)}% {text}
      </span>
    );
  }

  if (type === 2) {
    const w = width || 36;
    const filled = Math.round((pct / 100) * w);
    return (
      <span
        className={`font-mono whitespace-pre tabular ${glowCls} ${className}`}
      >
        <span className="text-fg">{'━'.repeat(filled)}</span>
        <span className="text-fg-dim">{'─'.repeat(w - filled)}</span>{' '}
        <span className="text-fg">{String(pct).padStart(2)}%</span>
        {text && <span className="text-fg-dim"> {text}</span>}
      </span>
    );
  }

  if (isSpinner) {
    const glyph = SPINNERS[type].frames[frame];
    return (
      <span
        className={`font-mono text-fg whitespace-pre ${glowCls} ${className}`}
      >
        [<span className="inline-block w-[1ch] text-center">{glyph}</span>]
        {text && <span className="text-fg-dim"> {text}</span>}
      </span>
    );
  }

  // type 6 — matrix file transfer
  const w = width || 20;
  const filled = Math.round((pct / 100) * w);
  return (
    <pre
      className={`font-mono text-fg leading-snug m-0 ${glowCls} ${className}`}
    >
      <span className="text-fg-dim">&gt; </span>
      {text}
      {'\n'}
      <span className="text-fg-dim">&gt; </span>
      <span className="text-fg">{'█'.repeat(filled)}</span>
      <span className="text-fg-dim">{'░'.repeat(w - filled)}</span>
      <span className="tabular">  {String(pct).padStart(3)}%</span>
      {pct >= 100 && <span className="text-fg"> [DONE]</span>}
    </pre>
  );
}
