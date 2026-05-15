import { useEffect, useRef, useState } from 'react';

// Symbol pool — varied density / shapes
const SYMBOLS = ['░','▒','▓','█','●','○','◐','◑','◒','◓','★','☆','◆','◇','+','×','∗'];

// Read live CSS theme vars (matrix / amber)
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function hexToRgb(hex) {
  const m = hex.replace('#','');
  return [
    parseInt(m.slice(0,2),16),
    parseInt(m.slice(2,4),16),
    parseInt(m.slice(4,6),16),
  ];
}
function rgba([r,g,b], a) { return `rgba(${r},${g},${b},${a})`; }

function pickSymbol() { return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }

function ASCIIParticles({
  count = 140,
  fontSize = 14,
  linkDistance = 80,
  collideDistance = 6,
  className = '',
  style,
  showHud = true,
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const particlesRef = useRef([]);
  const sparksRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, inside: false, alt: false });
  const modeRef = useRef('IDLE');
  const vortexRef = useRef(false);
  const [hudMode, setHudMode] = useState('IDLE');

  // ── Init + resize handling ────────────────────────────────
  useEffect(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Recreate particles to fit new canvas
      const w = rect.width, h = rect.height;
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        char: pickSymbol(),
        brightness: 0.45 + Math.random() * 0.55,
        cooldown: 0,
      }));
      sparksRef.current = [];
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [count]);

  // ── Input listeners (window-level so pointer-events:none works) ──
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;

    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      mouseRef.current.x = x;
      mouseRef.current.y = y;
      mouseRef.current.inside = inside;
      mouseRef.current.alt = e.altKey;
    };
    const onLeave = () => { mouseRef.current.inside = false; };
    const onKey = (e) => {
      // track alt for repel
      mouseRef.current.alt = e.altKey;
      if ((e.key === 'v' || e.key === 'V') && !e.repeat) {
        vortexRef.current = !vortexRef.current;
      }
    };
    const onKeyUp = (e) => { mouseRef.current.alt = e.altKey; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Animation loop ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, last = 0;

    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / 30) return; // throttle ~30fps
      last = t;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      const particles = particlesRef.current;
      const sparks = sparksRef.current;
      const mouse = mouseRef.current;

      // Decide mode
      let mode;
      if (vortexRef.current) mode = 'VORTEX';
      else if (mouse.inside && mouse.alt) mode = 'REPELLED';
      else if (mouse.inside) mode = 'ATTRACTED';
      else mode = 'IDLE';
      modeRef.current = mode;

      // ── Apply forces + integrate ──
      const cxC = w / 2, cyC = h / 2;
      const vortexR = Math.min(w, h) * 0.32;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let ax = 0, ay = 0;

        if (mode === 'VORTEX') {
          const dx = p.x - cxC, dy = p.y - cyC;
          const r = Math.hypot(dx, dy) || 0.001;
          // tangential swirl
          ax += -dy / r * 0.18;
          ay +=  dx / r * 0.18;
          // pull toward a ring of radius vortexR
          const tx = cxC + (dx / r) * vortexR;
          const ty = cyC + (dy / r) * vortexR;
          ax += (tx - p.x) * 0.0015;
          ay += (ty - p.y) * 0.0015;
        } else if (mode === 'ATTRACTED' || mode === 'REPELLED') {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const range = mode === 'REPELLED' ? 120 : 260;
          if (d < range) {
            const sign = mode === 'REPELLED' ? -1 : 1;
            const k = (1 - d / range) * 0.16 * sign;
            ax += (dx / d) * k;
            ay += (dy / d) * k;
          }
        } else { // IDLE
          ax += (Math.random() - 0.5) * 0.03;
          ay += (Math.random() - 0.5) * 0.03;
        }

        p.vx = (p.vx + ax) * 0.985;
        p.vy = (p.vy + ay) * 0.985;
        // cap speed
        const sp = Math.hypot(p.vx, p.vy);
        const MAX = mode === 'VORTEX' ? 2.4 : 1.4;
        if (sp > MAX) { p.vx *= MAX / sp; p.vy *= MAX / sp; }

        p.x += p.vx;
        p.y += p.vy;

        // wrap edges
        if (p.x < -fontSize)  p.x = w + fontSize;
        if (p.x > w + fontSize) p.x = -fontSize;
        if (p.y < -fontSize)  p.y = h + fontSize;
        if (p.y > h + fontSize) p.y = -fontSize;

        if (p.cooldown > 0) p.cooldown--;
      }

      // ── Collisions → sparks ──
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        if (a.cooldown > 0) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          if (b.cooldown > 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < collideDistance && d > 0.0001) {
            // spawn sparks radiating out
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            for (let k = 0; k < 7; k++) {
              const ang = (k / 7) * Math.PI * 2 + Math.random() * 0.4;
              sparks.push({
                x: cx, y: cy,
                vx: Math.cos(ang) * (1.4 + Math.random()),
                vy: Math.sin(ang) * (1.4 + Math.random()),
                life: 18, maxLife: 18,
                char: '*',
              });
            }
            // elastic bounce
            const nx = dx / d, ny = dy / d;
            const va = a.vx * nx + a.vy * ny;
            const vb = b.vx * nx + b.vy * ny;
            const diff = vb - va;
            a.vx += nx * diff; a.vy += ny * diff;
            b.vx -= nx * diff; b.vy -= ny * diff;
            a.cooldown = 22; b.cooldown = 22;
            // mutate symbol on collision for visual zip
            a.char = pickSymbol();
            b.char = pickSymbol();
          }
        }
      }

      // ── Update sparks ──
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.93; s.vy *= 0.93;
        s.life--;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      // ── Render ──
      const fg = cssVar('--c-fg', '#00FF41');
      const fgDim = cssVar('--c-fg-dim', '#00A82B');
      const bg = cssVar('--c-bg', '#0D0D0D');
      const rgbFg = hexToRgb(fg);
      const rgbDim = hexToRgb(fgDim);

      // background fade (instead of full clear → comet trails)
      ctx.fillStyle = rgba(hexToRgb(bg), 0.55);
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${fontSize}px "Courier New", monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // ── Connecting lines (ASCII chars along segments) ──
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx*dx + dy*dy;
          if (d2 > linkDistance * linkDistance || d2 < 1) continue;
          const d = Math.sqrt(d2);
          const alpha = (1 - d / linkDistance) * 0.55;
          ctx.fillStyle = rgba(rgbDim, alpha);

          const absDx = Math.abs(dx), absDy = Math.abs(dy);
          let ch;
          if (absDx < 1)                ch = '│';
          else if (absDy < 1)           ch = '─';
          else if (absDx / absDy > 2.4) ch = '─';
          else if (absDy / absDx > 2.4) ch = '│';
          else                          ch = (dx * dy > 0) ? '\\' : '/';

          const steps = Math.max(1, Math.floor(d / fontSize));
          for (let k = 1; k < steps; k++) {
            const t = k / steps;
            ctx.fillText(ch, a.x + dx * t, a.y + dy * t);
          }
        }
      }

      // ── Particles ──
      for (const p of particles) {
        ctx.fillStyle = rgba(rgbFg, p.brightness);
        ctx.fillText(p.char, p.x, p.y);
      }

      // ── Sparks ──
      for (const s of sparks) {
        const a = s.life / s.maxLife;
        ctx.fillStyle = rgba(rgbFg, a);
        ctx.fillText(s.char, s.x, s.y);
      }

      // Update HUD state (only when changed)
      setHudMode((prev) => (prev === mode ? prev : mode));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, fontSize, linkDistance, collideDistance]);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full h-full ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      {showHud && (
        <div className="absolute top-2 left-2 z-10 font-mono text-[11px] tracking-widest pointer-events-none">
          <span className="text-fg-dim">[</span>
          <span className={
            hudMode === 'VORTEX'    ? 'text-warn glow'
            : hudMode === 'ATTRACTED' ? 'text-fg glow'
            : hudMode === 'REPELLED'  ? 'text-danger glow'
            : 'text-fg-dim'
          }>{hudMode}</span>
          <span className="text-fg-dim">]</span>
          <span className="text-muted ml-2">
            hover · alt=repel · [V]=vortex
          </span>
        </div>
      )}
    </div>
  );
}

export default ASCIIParticles;
