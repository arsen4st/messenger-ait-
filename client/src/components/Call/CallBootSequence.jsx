// Terminal-boot animation that plays whenever a call is initiated.
// Lines stream in, then signals onReady() after the final "CONNECTION ESTABLISHED".

import { useEffect, useState, useRef } from 'react';
import { chirpUp, keyClick } from '../../utils/sound';

function makeBootScript({ username = 'user', node = 34, ping = 23, bandwidth = '2.4' } = {}) {
  return [
    { delay: 300, text: '> INITIALIZING SECURE CHANNEL...' },
    { delay: 150, text: '> ESTABLISHING P2P CONNECTION...' },
    { delay: 130, text: '> ENCRYPTION: AES-256-GCM [OK]' },
    { delay: 120, text: '> CODEC: VP9 ASCII RENDERER [OK]' },
    { delay: 120, text: `> CONNECTING TO: ${username}@node-${node}.mesh.net` },
    { delay: 110, text: `> PING: ${ping}ms [GOOD]` },
    { delay: 100, text: `> BANDWIDTH: ${bandwidth} Mbps [SUFFICIENT]` },
    { delay: 120, text: '__PROGRESS__' },             // special — animated progress
    { delay: 700, text: '> CONNECTION ESTABLISHED', established: true },
  ];
}

function Progress({ width = 36, durationMs = 600, onDone }) {
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const cells = Math.round(t * width);
      setFilled(cells);
      // small click every 4 cells
      if (cells > 0 && cells % 4 === 0) keyClick();
      if (t < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    tick();
    return () => raf && cancelAnimationFrame(raf);
  }, []);
  const pct = Math.round((filled / width) * 100);
  return (
    <span>
      <span className="text-fg-dim">{'>'} </span>
      <span className="text-fg-dim">{'.'.repeat(Math.max(0, 24 - filled))}</span>
      <span className="text-fg-dim">[</span>
      <span className="text-fg">{'█'.repeat(filled)}</span>
      <span className="text-fg-dim">{'░'.repeat(width - filled)}</span>
      <span className="text-fg-dim">]</span>
      <span className="text-fg tabular ml-2">{pct.toString().padStart(3, ' ')}%</span>
    </span>
  );
}

function BootLine({ text, isLast }) {
  return (
    <div className="leading-tight">
      <span className={isLast ? 'text-fg glow' : 'text-fg'}>{text}</span>
    </div>
  );
}

function CallBootSequence({ username = 'remote_user', onReady }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [progressDone, setProgressDone] = useState(false);
  const script = useRef(makeBootScript({ username })).current;
  const timersRef = useRef([]);

  useEffect(() => {
    // schedule lines
    let acc = 0;
    script.forEach((line, idx) => {
      acc += line.delay;
      const t = setTimeout(() => {
        setVisibleCount(idx + 1);
        if (line.established) chirpUp();
        else if (line.text !== '__PROGRESS__') keyClick();
      }, acc);
      timersRef.current.push(t);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  // When the LAST line shows AND progress completed, fire onReady after short pause
  useEffect(() => {
    const lastIdx = script.length - 1;
    if (visibleCount > lastIdx && progressDone) {
      const t = setTimeout(() => onReady?.(), 350);
      return () => clearTimeout(t);
    }
  }, [visibleCount, progressDone, onReady, script.length]);

  // Show cursor on the active line (the one being "typed" next)
  const shownLines = script.slice(0, visibleCount);
  // typing of the LAST visible line will use whole-line ticker-in
  return (
    <div className="call-frame">
      {/* 4 corners — pop at 0ms */}
      <span className="cf-corner tl">╔</span>
      <span className="cf-corner tr">╗</span>
      <span className="cf-corner bl">╚</span>
      <span className="cf-corner br">╝</span>

      {/* 4 lines — horizontal at 150ms, vertical at 350ms */}
      <div className="cf-line top" />
      <div className="cf-line bottom" />
      <div className="cf-line left" />
      <div className="cf-line right" />

      {/* content fades in at 550ms, then boot text prints */}
      <div className="cf-content font-mono text-sm md:text-base text-fg leading-relaxed select-none p-6">
        {shownLines.map((line, idx) => {
          const isLast = idx === shownLines.length - 1;
          if (line.text === '__PROGRESS__') {
            return (
              <div key={idx} className="leading-tight">
                <Progress width={36} durationMs={600} onDone={() => setProgressDone(true)} />
              </div>
            );
          }
          return (
            <div key={idx} className={isLast ? 'ticker-in' : ''}>
              <BootLine text={line.text} isLast={line.established} />
            </div>
          );
        })}
        <div className="text-fg">
          <span className="text-fg animate-cursor-blink">█</span>
        </div>
      </div>
    </div>
  );
}

export default CallBootSequence;
