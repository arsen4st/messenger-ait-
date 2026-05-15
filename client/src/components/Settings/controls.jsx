import { useEffect, useRef, useState } from 'react';
import { keyClick } from '../../utils/sound';

/* ── Toggle:  [ON ] / [OFF] ─────────────────────────────────── */
export function Toggle({ value, onChange }) {
  const on = value === 'ON';
  return (
    <button
      onClick={() => {
        keyClick();
        onChange(on ? 'OFF' : 'ON');
      }}
      className={`px-1 border ${
        on ? 'border-fg text-fg glow' : 'border-fg-dim text-fg-dim'
      } hover:bg-fg hover:!text-bg transition-none whitespace-pre`}
    >
      [{on ? 'ON ' : 'OFF'}]
    </button>
  );
}

/* ── Slider:  [████████░░]  arrows / drag ───────────────────── */
export function Slider({ value, min = 0, max = 12, onChange }) {
  const ref = useRef(null);
  const cells = 12;
  const pct = (value - min) / (max - min);
  const filled = Math.round(pct * cells);

  const fromClientX = (clientX) => {
    const el = ref.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(min + t * (max - min));
  };

  const drag = (e) => {
    const move = (ev) => onChange(fromClientX(ev.clientX));
    move(e);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span
        ref={ref}
        tabIndex={0}
        onPointerDown={drag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChange(Math.max(min, value - 1));
          if (e.key === 'ArrowRight') onChange(Math.min(max, value + 1));
        }}
        className="cursor-pointer text-fg select-none whitespace-pre outline-none focus:glow"
        title="◄ ► or drag"
      >
        [{'█'.repeat(filled)}
        <span className="text-fg-dim">{'░'.repeat(cells - filled)}</span>]
      </span>
      <span className="text-fg-dim tabular text-[11px]">{value}</span>
    </span>
  );
}

/* ── Dropdown:  [OPTION▼] → framed list ─────────────────────── */
export function Dropdown({ value, options, onChange, hint }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return;
    const off = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', off);
    return () => window.removeEventListener('mousedown', off);
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-block">
      <button
        onClick={() => {
          keyClick();
          setOpen((o) => !o);
        }}
        className="text-fg hover:glow whitespace-pre"
      >
        [{String(value).padEnd(6)}{open ? '▲' : '▼'}]
      </button>
      {hint && <span className="text-fg-dim ml-2">{hint}</span>}

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[60] bg-bg border border-fg min-w-[14ch]"
          style={{ boxShadow: '0 0 8px var(--c-fg)' }}
        >
          {options.map((opt) => {
            const sel = opt === value;
            return (
              <button
                key={opt}
                onClick={() => {
                  keyClick();
                  onChange(opt);
                  setOpen(false);
                }}
                className={`block w-full text-left px-2 py-0.5 whitespace-pre ${
                  sel ? 'bg-fg !text-bg' : 'text-fg-dim hover:bg-card hover:text-fg'
                }`}
              >
                {sel ? '› ' : '  '}
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/* ── Text input:  field = [value_____█] ─────────────────────── */
export function TextInput({ value, onChange, width = 22 }) {
  const [focus, setFocus] = useState(false);
  const padded =
    value.length >= width ? value.slice(0, width) : value;
  const fillers = '_'.repeat(Math.max(0, width - padded.length));

  return (
    <span className="relative inline-flex items-center text-fg whitespace-pre">
      [
      <span className="relative">
        <span className="invisible">{padded || ' '}</span>
        <input
          value={value}
          maxLength={64}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          className="absolute inset-0 bg-transparent border-0 outline-none text-fg p-0 w-full"
        />
      </span>
      <span className="text-fg-dim">{fillers}</span>
      <span className={focus ? 'animate-cursor-blink' : 'text-fg-dim'}>█</span>]
    </span>
  );
}

/* ── Number stepper:  [< 42 >] ──────────────────────────────── */
export function NumberStepper({ value, min = 0, max = 999, step = 1, onChange }) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  return (
    <span
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step));
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step));
      }}
      className="inline-flex items-center text-fg whitespace-pre outline-none focus:glow"
    >
      [
      <button
        onClick={() => {
          keyClick();
          onChange(clamp(value - step));
        }}
        className="px-1 text-fg-dim hover:text-fg hover:glow"
      >
        &lt;
      </button>
      <span className="tabular text-center" style={{ minWidth: '4ch' }}>
        {value}
      </span>
      <button
        onClick={() => {
          keyClick();
          onChange(clamp(value + step));
        }}
        className="px-1 text-fg-dim hover:text-fg hover:glow"
      >
        &gt;
      </button>
      ]
    </span>
  );
}
