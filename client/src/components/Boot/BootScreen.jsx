import { useEffect, useRef, useState } from 'react';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import { beep, chirpUp, keyClick } from '../../utils/sound';

const LOGO = [
  '███╗   ███╗███████╗███████╗███████╗',
  '████╗ ████║██╔════╝██╔════╝██╔════╝',
  '██╔████╔██║█████╗  ███████╗███████╗',
  '██║╚██╔╝██║██╔══╝  ╚════██║╚════██║',
  '██║ ╚═╝ ██║███████╗███████║███████║',
  '╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝',
];

const WIPE_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789#@$%&░▒▓█+=*';

// tone → className for the body of a line
const TONE = {
  log: 'text-fg-dim',
  system: 'text-fg glow',
  welcome: 'text-fg glow',
};

function buildScript({ username, unread, lastLogin }) {
  return [
    { kind: 'logo' },
    { kind: 'gap', ms: 380 },
    { kind: 'line', prefix: '> ', body: 'Booting system...', speed: 26, tone: 'log', pause: 160 },
    { kind: 'line', prefix: '> ', body: 'Loading cryptography module...', tag: ' [OK]', tagCls: 'text-fg glow', speed: 18, tone: 'log', pause: 110 },
    { kind: 'line', prefix: '> ', body: 'Initializing P2P network...', tag: ' [OK]', tagCls: 'text-fg glow', speed: 11, tone: 'log', pause: 90 },
    { kind: 'line', prefix: '> ', body: 'Connecting to mesh nodes...', speed: 32, tone: 'log', pause: 260 },
    { kind: 'line', prefix: '>   ', body: 'Node 1: node-34.mesh.net', tag: ' [OK]', tagCls: 'text-fg glow', speed: 10, tone: 'log', pause: 90 },
    { kind: 'line', prefix: '>   ', body: 'Node 2: node-89.mesh.net', tag: ' [OK]', tagCls: 'text-fg glow', speed: 10, tone: 'log', pause: 90 },
    { kind: 'line', prefix: '>   ', body: 'Node 3: node-12.mesh.net', tag: ' [TIMEOUT - SKIPPING]', tagCls: 'text-danger glow', speed: 17, tone: 'log', pause: 420 },
    { kind: 'line', prefix: '> ', body: 'Authenticating user...', tag: ' [OK]', tagCls: 'text-fg glow', speed: 22, tone: 'log', pause: 140 },
    { kind: 'progress', prefix: '> ', body: 'Fetching message history... ', speed: 16, width: 16, durationMs: 950, pause: 200 },
    { kind: 'line', prefix: '> ', body: 'SYSTEM READY.', speed: 50, tone: 'system', pause: 520, chirp: true },
    { kind: 'gap', ms: 120 },
    { kind: 'line', prefix: '> ', body: '', speed: 0, tone: 'log', pause: 60 },
    { kind: 'line', prefix: '> ', body: `Welcome back, ${username}.`, speed: 46, tone: 'welcome', pause: 220 },
    { kind: 'line', prefix: '> ', body: `You have ${unread} unread message${unread === 1 ? '' : 's'}.`, speed: 26, tone: 'log', pause: 160 },
    { kind: 'line', prefix: '> ', body: `Last login: ${lastLogin}`, speed: 11, tone: 'log', pause: 140 },
    { kind: 'line', prefix: '> ', body: '', speed: 0, tone: 'log', pause: 200 },
  ];
}

function LineView({ item, typed }) {
  const pfx = item.prefix.length;
  const bodyEnd = pfx + item.body.length;
  const pre = typed.slice(0, Math.min(typed.length, pfx));
  const body = typed.slice(pfx, Math.min(typed.length, bodyEnd));
  const tag = typed.slice(bodyEnd);
  return (
    <div className="whitespace-pre leading-snug">
      <span className="text-fg-dim">{pre}</span>
      <span className={TONE[item.tone] || 'text-fg-dim'}>{body}</span>
      {tag && <span className={item.tagCls || 'text-fg-dim'}>{tag}</span>}
    </div>
  );
}

function ProgressView({ item, typedPrefix, filled }) {
  const pct = Math.round((filled / item.width) * 100);
  const head = item.prefix + item.body;
  const shown = typedPrefix.slice(0, head.length);
  const barReady = typedPrefix.length >= head.length;
  return (
    <div className="whitespace-pre leading-snug">
      <span className="text-fg-dim">{shown.slice(0, item.prefix.length)}</span>
      <span className="text-fg-dim">{shown.slice(item.prefix.length)}</span>
      {barReady && (
        <>
          <span className="text-fg-dim">[</span>
          <span className="text-fg glow">{'█'.repeat(filled)}</span>
          <span className="text-fg-dim">{'░'.repeat(item.width - filled)}</span>
          <span className="text-fg-dim">] </span>
          <span className="text-fg tabular">{pct}%</span>
        </>
      )}
    </div>
  );
}

function BootScreen({ onComplete }) {
  const { user } = useAuthStore();
  const { chats } = useChatStore();

  const [phase, setPhase] = useState('cursor'); // cursor | booting | ready | wiping
  const [doneCount, setDoneCount] = useState(0);
  const [active, setActive] = useState(null); // { idx, typed, filled }
  const [wipeRows, setWipeRows] = useState(0);

  const scriptRef = useRef(null);
  const skipRef = useRef(false);
  const wipeTimersRef = useRef([]);

  // Build the script once the user is available
  if (!scriptRef.current && user) {
    const unread =
      chats?.reduce((s, c) => s + (c.unread_count || 0), 0) || 3;
    const d = new Date(Date.now() - 6 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    const lastLogin =
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} from 192.168.1.100`;
    scriptRef.current = buildScript({
      username: (user.display_name || 'user').toUpperCase(),
      unread,
      lastLogin,
    });
  }

  useEffect(() => {
    if (!user || !scriptRef.current) return;
    const SCRIPT = scriptRef.current;

    // Per-run state — a fresh closure each effect invocation, so React 18
    // StrictMode's mount→cleanup→mount only aborts the throwaway first run.
    let cancelled = false;
    const timers = [];

    const sleep = (ms) =>
      new Promise((res) => {
        if (cancelled) return res();
        const real = skipRef.current ? 0 : ms;
        const t = setTimeout(res, real);
        timers.push(t);
      });

    const run = async () => {
      // 1. Black screen, blinking cursor
      await sleep(900);
      if (cancelled) return;
      setPhase('booting');

      for (let i = 0; i < SCRIPT.length; i++) {
        if (cancelled) return;
        const item = SCRIPT[i];

        if (item.kind === 'gap') {
          await sleep(item.ms);
          continue;
        }

        if (item.kind === 'logo') {
          for (let l = 0; l <= LOGO.length; l++) {
            if (cancelled) return;
            setActive({ idx: i, logo: l });
            if (l > 0 && !skipRef.current) keyClick();
            await sleep(skipRef.current ? 0 : 70);
          }
          setDoneCount(i + 1);
          setActive(null);
          continue;
        }

        const full =
          item.prefix + item.body + (item.tag || '');

        if (item.kind === 'progress') {
          // type the "prompt" part first
          for (let c = 1; c <= full.length; c++) {
            if (cancelled) return;
            setActive({ idx: i, typed: full.slice(0, c), filled: 0 });
            if (c % 4 === 0 && !skipRef.current) keyClick();
            await sleep(item.speed);
          }
          // animate the bar
          const start = Date.now();
          for (;;) {
            if (cancelled) return;
            const t = skipRef.current
              ? 1
              : Math.min(1, (Date.now() - start) / item.durationMs);
            const filled = Math.round(t * item.width);
            setActive({ idx: i, typed: full, filled });
            if (filled > 0 && filled % 4 === 0 && !skipRef.current) keyClick();
            if (t >= 1) break;
            await sleep(40);
          }
          setDoneCount(i + 1);
          setActive(null);
          await sleep(item.pause);
          continue;
        }

        // regular line
        if (item.body === '') {
          setActive({ idx: i, typed: full });
          setDoneCount(i + 1);
          setActive(null);
          await sleep(item.pause);
          continue;
        }
        for (let c = 1; c <= full.length; c++) {
          if (cancelled) return;
          setActive({ idx: i, typed: full.slice(0, c) });
          if (c % 3 === 0 && !skipRef.current) keyClick();
          await sleep(item.speed);
        }
        if (item.chirp && !skipRef.current) chirpUp();
        setDoneCount(i + 1);
        setActive(null);
        await sleep(item.pause);
      }

      if (cancelled) return;
      setPhase('ready');
    };

    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [user]);

  // Clear any pending wipe timers if the component unmounts mid-transition
  useEffect(() => () => wipeTimersRef.current.forEach(clearTimeout), []);

  // Keyboard: skip while booting, ENTER to continue when ready
  useEffect(() => {
    const onKey = (e) => {
      if (phase === 'booting' || phase === 'cursor') {
        skipRef.current = true;
        return;
      }
      if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startWipe();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const startWipe = () => {
    if (phase === 'wiping') return;
    setPhase('wiping');
    beep({ frequency: 200, duration: 220, volume: 0.12, type: 'square' });
    const totalRows = Math.ceil(window.innerHeight / 18) + 2;
    let r = 0;
    const step = () => {
      r += 1;
      setWipeRows(r);
      if (r >= totalRows) {
        const t = setTimeout(() => onComplete?.(), 180);
        wipeTimersRef.current.push(t);
        return;
      }
      const t = setTimeout(step, 16);
      wipeTimersRef.current.push(t);
    };
    step();
  };

  const SCRIPT = scriptRef.current || [];

  // ── WIPE OVERLAY ────────────────────────────────────────────
  const wipeCols = Math.ceil((typeof window !== 'undefined' ? window.innerWidth : 1200) / 9);
  const wipeLine = () => {
    let s = '';
    for (let i = 0; i < wipeCols; i++) {
      s += WIPE_CHARS[(Math.random() * WIPE_CHARS.length) | 0];
    }
    return s;
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg font-mono overflow-hidden cursor-default"
      onClick={() => phase === 'ready' && startWipe()}
    >
      <div className="h-full w-full p-4 md:p-8 overflow-hidden text-[13px] md:text-sm">
        {/* Phase 1: bare cursor */}
        {phase === 'cursor' && (
          <span className="text-fg animate-cursor-blink">█</span>
        )}

        {/* Logo + log */}
        {phase !== 'cursor' && (
          <div className="flex flex-col">
            {/* LOGO */}
            {(() => {
              const logoItemIdx = SCRIPT.findIndex((s) => s.kind === 'logo');
              const logoDone = doneCount > logoItemIdx;
              const logoLines =
                logoDone
                  ? LOGO.length
                  : active && active.idx === logoItemIdx
                  ? active.logo || 0
                  : 0;
              if (logoLines === 0) return null;
              return (
                <pre className="text-fg glow leading-[1.05] select-none mb-1">
                  {LOGO.slice(0, logoLines).join('\n')}
                  {logoLines === LOGO.length && (
                    <>{'\n'}<span className="text-fg-dim">{'                  MESSENGER v2.4.1'}</span></>
                  )}
                </pre>
              );
            })()}

            {/* COMPLETED LINES */}
            {SCRIPT.slice(0, doneCount).map((item, i) => {
              if (item.kind === 'logo' || item.kind === 'gap') return null;
              const full = item.prefix + item.body + (item.tag || '');
              if (item.kind === 'progress') {
                return (
                  <ProgressView
                    key={i}
                    item={item}
                    typedPrefix={item.prefix + item.body}
                    filled={item.width}
                  />
                );
              }
              return <LineView key={i} item={item} typed={full} />;
            })}

            {/* ACTIVE LINE */}
            {active && SCRIPT[active.idx] && SCRIPT[active.idx].kind !== 'logo' && (
              SCRIPT[active.idx].kind === 'progress' ? (
                <ProgressView
                  item={SCRIPT[active.idx]}
                  typedPrefix={active.typed || ''}
                  filled={active.filled || 0}
                />
              ) : (
                <div className="whitespace-pre leading-snug">
                  <LineViewInline item={SCRIPT[active.idx]} typed={active.typed || ''} />
                  <span className="text-fg animate-cursor-blink">█</span>
                </div>
              )
            )}

            {/* PROMPT */}
            {phase === 'ready' && (
              <div className="mt-4 text-fg">
                <span className="text-fg glow">Press </span>
                <span className="text-fg glow font-bold">[ENTER]</span>
                <span className="text-fg glow"> to continue </span>
                <span className="text-fg animate-cursor-blink">_</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WIPE TRANSITION — chars flood top → bottom */}
      {phase === 'wiping' && (
        <div className="absolute inset-0 z-[210] pointer-events-none">
          <pre className="text-fg glow leading-[18px] m-0 select-none">
            {Array.from({ length: wipeRows }, () => wipeLine()).join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}

// Active line uses same colour rules as LineView but without the wrapping div
function LineViewInline({ item, typed }) {
  const pfx = item.prefix.length;
  const bodyEnd = pfx + item.body.length;
  const pre = typed.slice(0, Math.min(typed.length, pfx));
  const body = typed.slice(pfx, Math.min(typed.length, bodyEnd));
  const tag = typed.slice(bodyEnd);
  return (
    <>
      <span className="text-fg-dim">{pre}</span>
      <span className={TONE[item.tone] || 'text-fg-dim'}>{body}</span>
      {tag && <span className={item.tagCls || 'text-fg-dim'}>{tag}</span>}
    </>
  );
}

export default BootScreen;
