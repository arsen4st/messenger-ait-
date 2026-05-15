// ASCII bar-graph of microphone input level.
// Reads an AnalyserNode tap on the local audio track and renders chars like
//   MIC ▁▂▃▅▇▆▄▂▁  per band.

import { useEffect, useRef, useState } from 'react';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function MicLevel({ stream, bands = 24, label = 'MIC', muted = false }) {
  const [chars, setChars] = useState(() => Array(bands).fill('▁').join(''));
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks?.() || [];
    if (audioTracks.length === 0) return;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLen = analyser.frequencyBinCount; // 64
      const buf = new Uint8Array(bufferLen);
      const groupSize = Math.max(1, Math.floor(bufferLen / bands));

      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let out = '';
        if (muted) {
          out = '─'.repeat(bands);
        } else {
          for (let i = 0; i < bands; i++) {
            // average over a group of bins
            let sum = 0;
            for (let j = 0; j < groupSize; j++) sum += buf[i * groupSize + j] || 0;
            const avg = sum / groupSize;
            const idx = Math.min(BLOCKS.length - 1, Math.floor((avg / 255) * BLOCKS.length));
            out += BLOCKS[idx];
          }
        }
        setChars(out);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { console.error('MicLevel init failed:', e); }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { sourceRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, bands, muted]);

  return (
    <div className="flex items-center gap-2 font-mono text-fg text-sm leading-none">
      <span className="text-fg-dim tracking-widest text-xs">{label}</span>
      <span className="text-fg-dim">[</span>
      <span className={muted ? 'text-danger' : 'text-fg glow'}>{chars}</span>
      <span className="text-fg-dim">]</span>
    </div>
  );
}

export default MicLevel;
