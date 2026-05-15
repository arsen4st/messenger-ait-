// Optimized real-time ASCII video renderer with improved FPS
// Uses requestAnimationFrame, pre-allocated buffers, and optimized DOM updates

import { useEffect, useRef } from 'react';

// Enhanced charset ramps from glyphcast
const CHARSETS = {
  standard: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  matrix: ' .ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
  blocks: ' ░▒▓█',
  binary: ' 01',
  simple: ' .,:;+=?#%@',
};

function pickChar(lum, charset, contrast = 1.0) {
  // Apply contrast boost
  let adjusted = ((lum / 255 - 0.5) * contrast + 0.5) * 255;
  adjusted = Math.max(0, Math.min(255, adjusted));

  const idx = Math.floor((adjusted / 255) * (charset.length - 1));
  return charset[Math.max(0, Math.min(charset.length - 1, idx))];
}

function escapeHtml(ch) {
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '&') return '&amp;';
  return ch;
}

// Calculate luminance using BT.709 (better for modern displays)
function getLuminance(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function AsciiVideo({
  stream,
  mode = 'grayscale',
  cols = 100,
  rows = 38,
  fps = 18,
  mirrored = false,
  glitchProbability = 0,
  contrast = 1.2,
  className = '',
  style,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const preRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

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

    // Select charset based on mode
    let charset;
    switch (mode) {
      case 'matrix': charset = CHARSETS.matrix; break;
      case 'blocks': charset = CHARSETS.blocks; break;
      case 'binary': charset = CHARSETS.binary; break;
      case 'color':
      case 'grayscale':
      default: charset = CHARSETS.standard; break;
    }

    // For braille we need 2× width / 4× height pixels per output char
    const sampleW = mode === 'braille' ? cols * 2 : cols;
    const sampleH = mode === 'braille' ? rows * 4 : rows;
    c.width = sampleW;
    c.height = sampleH;
    const ctx = c.getContext('2d', {
      willReadFrequently: true,
      alpha: false, // Optimization: no alpha channel needed
    });

    const frameInterval = 1000 / fps;
    const useColor = mode === 'color';

    // Pre-allocate string array for better performance
    const lines = new Array(rows);

    const draw = (timestamp) => {
      rafRef.current = requestAnimationFrame(draw);

      // Throttle to target FPS
      if (timestamp - lastFrameTimeRef.current < frameInterval) return;
      lastFrameTimeRef.current = timestamp;

      if (!v.videoWidth) return;

      // Draw video to canvas
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

      if (mode === 'braille') {
        // Braille mode - optimized
        const DOT = [
          [0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80],
        ];
        const threshold = 128;

        for (let by = 0; by < rows; by++) {
          let line = '';
          for (let bx = 0; bx < cols; bx++) {
            let bits = 0;
            for (let dy = 0; dy < 4; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const px = bx * 2 + dx;
                const py = by * 4 + dy;
                const i = (py * sampleW + px) * 4;
                const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
                if (lum > threshold) bits |= DOT[dy][dx];
              }
            }
            let ch = String.fromCharCode(0x2800 + bits);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';
            line += ch;
          }
          lines[by] = line;
        }
        pre.textContent = lines.join('\n');
        return;
      }

      if (useColor) {
        // Color mode - build HTML in chunks for better performance
        for (let y = 0; y < rows; y++) {
          let line = '';
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = getLuminance(r, g, b);

            let ch = pickChar(lum, charset, contrast);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';

            // Adaptive brightness boost for dark pixels
            const boost = lum < 60 ? 1.8 : lum < 120 ? 1.3 : 1.0;
            const rr = Math.min(255, Math.round(r * boost));
            const gg = Math.min(255, Math.round(g * boost));
            const bb = Math.min(255, Math.round(b * boost));

            line += `<span style="color:rgb(${rr},${gg},${bb})">${escapeHtml(ch)}</span>`;
          }
          lines[y] = line;
        }
        pre.innerHTML = lines.join('\n');
      } else {
        // Grayscale/matrix/blocks/binary - fastest path
        for (let y = 0; y < rows; y++) {
          let line = '';
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const lum = getLuminance(data[i], data[i + 1], data[i + 2]);

            let ch = pickChar(lum, charset, contrast);
            if (glitchProbability > 0 && Math.random() < glitchProbability) ch = '█';
            line += ch;
          }
          lines[y] = line;
        }
        pre.textContent = lines.join('\n');
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      v.srcObject = null;
    };
  }, [stream, mode, cols, rows, fps, mirrored, glitchProbability, contrast]);

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
          willChange: 'contents', // Hint browser for optimization
        }}
      />
    </div>
  );
}

export default AsciiVideo;
