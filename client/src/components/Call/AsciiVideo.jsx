// Real-time ASCII video renderer with 4 modes:
//   'grayscale' — luminance → char ramp, all-phosphor color
//   'color'     — luminance → char ramp, char tinted by pixel RGB
//   'matrix'    — chars replaced by Japanese katakana, phosphor color
//   'braille'   — each cell is a 2×4 braille block (8 dots), higher detail
//
// Plus: a `glitchProbability` prop swaps random chars to █ each frame.

import { useEffect, useRef } from 'react';

// Ramp per the spec — 10 buckets covering 0..255
const SPEC_RAMP = ' .,:;+=?#%@';   // 11 chars, 10 levels of density
const MATRIX_RAMP = ' .ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';

function pickRampChar(lum, ramp) {
  const idx = Math.min(ramp.length - 1, Math.max(0, Math.round((lum / 255) * (ramp.length - 1))));
  return ramp[idx];
}

function escapeHtml(ch) {
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '&') return '&amp;';
  return ch;
}

function AsciiVideo({
  stream,
  mode = 'grayscale',          // 'grayscale' | 'color' | 'matrix' | 'braille'
  cols = 100,
  rows = 38,
  fps = 18,
  mirrored = false,
  glitchProbability = 0,
  className = '',
  style,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const preRef = useRef(null);

  useEffect(() => {
    if (!stream) {
      if (preRef.current) preRef.current.textContent = '';
      return;
    }
    const v = videoRef.current;
    const c = canvasRef.current;
    const pre = preRef.current;
    if (!v || !c || !pre) return;

    v.srcObject = stream;
    v.play().catch(() => {});

    // For braille we need 2× width / 4× height pixels per output char
    const sampleW = mode === 'braille' ? cols * 2 : cols;
    const sampleH = mode === 'braille' ? rows * 4 : rows;
    c.width = sampleW;
    c.height = sampleH;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    let intervalId;

    const draw = () => {
      if (!v.videoWidth) return;
      ctx.save();
      if (mirrored) {
        ctx.translate(sampleW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, sampleW, sampleH);
      ctx.restore();

      let img;
      try { img = ctx.getImageData(0, 0, sampleW, sampleH); }
      catch { return; }
      const data = img.data;

      let html = '';

      if (mode === 'braille') {
        // Threshold-based braille. Bit positions inside 2×4 block:
        //   dot1=0x01 dot4=0x08
        //   dot2=0x02 dot5=0x10
        //   dot3=0x04 dot6=0x20
        //   dot7=0x40 dot8=0x80
        const DOT = [
          [0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80],
        ];
        const threshold = 110;
        for (let by = 0; by < rows; by++) {
          for (let bx = 0; bx < cols; bx++) {
            let bits = 0;
            for (let dy = 0; dy < 4; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const px = bx * 2 + dx;
                const py = by * 4 + dy;
                const i = (py * sampleW + px) * 4;
                const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                if (lum > threshold) bits |= DOT[dy][dx];
              }
            }
            let ch = String.fromCharCode(0x2800 + bits);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';
            html += ch;
          }
          html += '\n';
        }
        pre.textContent = html;          // braille is plain text, fast path
        return;
      }

      // grayscale / color / matrix all read pixel-per-cell from the same buffer
      const ramp = mode === 'matrix' ? MATRIX_RAMP : SPEC_RAMP;
      const useColor = mode === 'color';

      if (useColor) {
        // build HTML once
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            let ch = pickRampChar(lum, ramp);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';
            // Brighten low-light pixels so they remain visible
            const boost = lum < 40 ? 1.6 : 1.0;
            const rr = Math.min(255, Math.round(r * boost));
            const gg = Math.min(255, Math.round(g * boost));
            const bb = Math.min(255, Math.round(b * boost));
            html += `<span style="color:rgb(${rr},${gg},${bb})">${escapeHtml(ch)}</span>`;
          }
          html += '\n';
        }
        pre.innerHTML = html;
      } else {
        // grayscale or matrix — plain textContent (much faster)
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            let ch = pickRampChar(lum, ramp);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';
            html += ch;
          }
          html += '\n';
        }
        pre.textContent = html;
      }
    };

    intervalId = setInterval(draw, Math.max(20, 1000 / fps));
    return () => {
      clearInterval(intervalId);
      v.srcObject = null;
    };
  }, [stream, mode, cols, rows, fps, mirrored, glitchProbability]);

  return (
    <div className={`relative ${className}`} style={style}>
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
      <pre
        ref={preRef}
        className="m-0 whitespace-pre leading-[0.9] select-none"
        style={{
          color: mode === 'color' ? undefined : 'var(--c-fg)',
          fontSize: 'clamp(6px, 0.95vw, 12px)',
          fontFamily: '"Courier New", monospace',
          textShadow: mode === 'color' ? 'none' : '0 0 4px var(--c-fg)',
        }}
      />
    </div>
  );
}

export default AsciiVideo;
