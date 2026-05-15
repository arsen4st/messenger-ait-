import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CallBootSequence from './CallBootSequence';
import AsciiVideo from './AsciiVideo';
import MicLevel from './MicLevel';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import useTypingDots from '../../hooks/useTypingDots';
import { beep } from '../../utils/sound';

const MODES = [
  { key: 'g', id: 'grayscale', label: 'GRAY' },
  { key: 'c', id: 'color',     label: 'COLOR' },
  { key: 'm', id: 'matrix',    label: 'MTRX' },
  { key: 'b', id: 'braille',   label: 'BRLE' },
];

function CallModal({
  callState, callType, caller,
  localStream, remoteStream,
  isMuted, isVideoEnabled,
  answerCall, rejectCall, endCall, toggleMute, toggleVideo,
  getStats,
}) {
  const { activeChat } = useChatStore();
  const { user } = useAuthStore();
  const [bootDone, setBootDone] = useState(false);
  const [closing, setClosing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [renderMode, setRenderMode] = useState('grayscale');
  const [stats, setStats] = useState({ ping: null, bw: 0, loss: 0, quality: 0 });
  const callStartRef = useRef(null);
  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(0);

  // reset on idle
  useEffect(() => {
    if (callState === 'idle') {
      setBootDone(false);
      setClosing(false);
      callStartRef.current = null;
      setCallDuration(0);
      lastBytesRef.current = 0;
      lastTimeRef.current = 0;
    }
  }, [callState]);

  // duration ticker
  useEffect(() => {
    if (callState === 'active' && !callStartRef.current) {
      callStartRef.current = Date.now();
      const id = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [callState]);

  // poll network stats every 1s while active
  useEffect(() => {
    if (callState !== 'active' || !getStats) return;
    let cancelled = false;
    const poll = async () => {
      const s = await getStats();
      if (!s || cancelled) return;
      const now = Date.now();
      let bwKbps = 0;
      if (lastTimeRef.current && s.bytesInbound > lastBytesRef.current) {
        const deltaBytes = s.bytesInbound - lastBytesRef.current;
        const deltaSec = (now - lastTimeRef.current) / 1000;
        bwKbps = Math.round((deltaBytes * 8) / 1000 / Math.max(deltaSec, 0.5));
      }
      lastBytesRef.current = s.bytesInbound;
      lastTimeRef.current = now;
      const ping = s.rtt != null ? Math.round(s.rtt) : null;
      const total = s.packetsLost + s.packetsReceived;
      const loss = total > 0 ? (s.packetsLost / total) * 100 : 0;
      // 0–5 quality bars
      let q = 5;
      if (ping == null) q = 0;
      else if (ping > 400 || loss > 5) q = 1;
      else if (ping > 200 || loss > 2) q = 2;
      else if (ping > 100 || loss > 1) q = 3;
      else if (ping > 50) q = 4;
      setStats({ ping, bw: bwKbps, loss: loss.toFixed(1), quality: q });
    };
    const id = setInterval(poll, 1000);
    poll();
    return () => { cancelled = true; clearInterval(id); };
  }, [callState, getStats]);

  // incoming ring tone
  useEffect(() => {
    if (callState !== 'incoming') return;
    const id = setInterval(() => beep({ frequency: 800, duration: 80, volume: 0.08 }), 1400);
    return () => clearInterval(id);
  }, [callState]);

  // global key shortcuts when in active call
  useEffect(() => {
    if (callState !== 'active' || !bootDone) return;
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'g') { e.preventDefault(); setRenderMode('grayscale'); }
      else if (k === 'c') { e.preventDefault(); setRenderMode('color'); }
      else if (k === 'm') { e.preventDefault(); setRenderMode('matrix'); }
      else if (k === 'b') { e.preventDefault(); setRenderMode('braille'); }
      else if (e.key === 'F1') { e.preventDefault(); toggleMute(); }
      else if (e.key === 'F2') { e.preventDefault(); toggleVideo(); }
      else if (e.key === 'F10') { e.preventDefault(); handleEnd(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [callState, bootDone, toggleMute, toggleVideo]);

  const handleEnd = () => {
    if (closing) return;
    setClosing(true);
    beep({ frequency: 220, duration: 180, volume: 0.12 });
    setTimeout(() => endCall(), 450);
  };

  if (callState === 'idle') return null;

  const otherUser = activeChat?.members?.find((m) => m.id !== user.id);
  const remoteName = caller
    ? (activeChat?.members?.find((m) => m.id === caller.id)?.display_name || 'UNKNOWN')
    : (otherUser?.display_name || activeChat?.name || 'UNKNOWN');

  const fmtDur = (s) =>
    `${Math.floor(s / 3600).toString().padStart(2,'0')}:` +
    `${Math.floor((s % 3600) / 60).toString().padStart(2,'0')}:` +
    `${(s % 60).toString().padStart(2,'0')}`;

  // Glitch probability: bad quality → more glitches
  const glitch = stats.quality === 1 ? 0.04
               : stats.quality === 2 ? 0.015
               : 0;

  // ─── INCOMING ────────────────────────────────────────────
  if (callState === 'incoming') {
    return createPortal(
      <IncomingCallScreen
        callerName={remoteName.toUpperCase()}
        callType={callType}
        onAccept={answerCall}
        onReject={rejectCall}
      />,
      document.body
    );
  }

  // ─── OUTGOING — boot then active view ─────────────────────
  return createPortal(
    <div className={`fixed inset-0 z-[100] bg-bg font-mono flex flex-col ${closing ? 'call-collapsing' : ''}`}>
      {!bootDone ? (
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-2xl">
            <div className="text-fg-dim text-xs tracking-widest uppercase mb-3">
              ─ outbound call ─ {callType.toUpperCase()} ─
            </div>
            <CallBootSequence
              username={remoteName.toLowerCase().replace(/\s+/g, '_')}
              onReady={() => setBootDone(true)}
            />
          </div>
        </div>
      ) : (
        <ActiveCallView
          callType={callType}
          remoteName={remoteName}
          remoteStream={remoteStream}
          localStream={localStream}
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          duration={fmtDur(callDuration)}
          waiting={callState === 'calling'}
          renderMode={renderMode}
          setRenderMode={setRenderMode}
          stats={stats}
          glitch={glitch}
          onMute={toggleMute}
          onVideo={toggleVideo}
          onEnd={handleEnd}
        />
      )}
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────
function ActiveCallView({
  callType, remoteName, remoteStream, localStream,
  isMuted, isVideoEnabled, duration, waiting,
  renderMode, setRenderMode, stats, glitch,
  onMute, onVideo, onEnd,
}) {
  // Quality bar rendering
  const qBar = '█'.repeat(stats.quality) + '░'.repeat(5 - stats.quality);
  const pingStr = stats.ping == null ? '---ms' : `${stats.ping}ms`;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0">
      {/* TOP BAR ── SECURE CALL header */}
      <div className="dbl-box relative px-4 py-1 mb-2 text-fg">
        <span className="corner-glyph tl">╔</span>
        <span className="corner-glyph tr">╗</span>
        <span className="corner-glyph bl">╠</span>
        <span className="corner-glyph br">╣</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-fg glow font-bold">SECURE CALL</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">PEER:</span>
          <span className="text-fg">{remoteName.toUpperCase()}</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">DURATION:</span>
          <span className="text-fg tabular">{duration}</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">QUALITY:</span>
          <span className="text-fg-dim">[</span>
          <span className={
            stats.quality >= 4 ? 'text-fg glow'
            : stats.quality >= 2 ? 'text-warn'
            : 'text-danger'
          }>{qBar}</span>
          <span className="text-fg-dim">]</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">PING:</span>
          <span className={
            stats.quality >= 4 ? 'text-fg'
            : stats.quality >= 2 ? 'text-warn'
            : 'text-danger'
          }>{pingStr}</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">BW:</span>
          <span className="text-fg tabular">{stats.bw || 0}kbps</span>
        </div>
      </div>

      {/* MAIN — remote (big) + local (small) */}
      <div className="dbl-box flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-0 relative">
        <span className="corner-glyph tl">╠</span>
        <span className="corner-glyph tr">╣</span>
        <span className="corner-glyph bl">╠</span>
        <span className="corner-glyph br">╣</span>

        {/* REMOTE */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden p-2 border-r border-fg-dim">
          <div className="absolute top-1 left-2 text-fg-dim text-[10px] tracking-widest">
            ─ REMOTE FEED [{renderMode.toUpperCase()}] ─
          </div>
          {waiting ? (
            <div className="text-fg-dim text-sm tracking-widest text-center">
              <div className="text-fg glow text-lg mb-2">[WAITING FOR PEER ANSWER]</div>
              <div className="text-fg animate-cursor-blink inline-block">█</div>
            </div>
          ) : callType === 'video' && remoteStream ? (
            <AsciiVideo
              stream={remoteStream}
              mode={renderMode}
              cols={renderMode === 'braille' ? 130 : 110}
              rows={renderMode === 'braille' ? 50 : 42}
              fps={renderMode === 'color' ? 12 : 18}
              glitchProbability={glitch}
            />
          ) : callType === 'audio' ? (
            <pre className="text-fg glow text-xs leading-tight">
{`     ╔════════════════════════╗
     ║                        ║
     ║   ░▒▓█  AUDIO  █▓▒░   ║
     ║   ──── LIVE STREAM ── ║
     ║                        ║
     ╚════════════════════════╝`}
            </pre>
          ) : (
            <div className="text-fg-dim text-sm">
              <span className="text-fg animate-cursor-blink">█</span> AWAITING REMOTE STREAM...
            </div>
          )}
          {callType === 'audio' && remoteStream && (
            <audio autoPlay playsInline ref={(el) => { if (el) el.srcObject = remoteStream; }} />
          )}
        </div>

        {/* LOCAL PREVIEW */}
        <div className="relative flex flex-col p-2">
          <div className="text-fg-dim text-[10px] tracking-widest mb-1">─ LOCAL PREVIEW ─</div>
          {callType === 'video' && localStream && isVideoEnabled ? (
            <AsciiVideo
              stream={localStream}
              mode={renderMode}
              cols={renderMode === 'braille' ? 56 : 48}
              rows={renderMode === 'braille' ? 32 : 24}
              fps={renderMode === 'color' ? 8 : 12}
              mirrored
              glitchProbability={glitch}
            />
          ) : (
            <pre className="text-fg-dim text-[10px] leading-tight">
{`  ╔══════════╗
  ║  ░░░░░░  ║
  ║   CAM    ║
  ║   OFF    ║
  ║  ░░░░░░  ║
  ╚══════════╝`}
            </pre>
          )}

          {/* Render mode switcher */}
          <div className="mt-auto pt-2 space-y-1 text-[10px]">
            <div className="text-fg-dim tracking-widest">─ MODE ─</div>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setRenderMode(m.id)}
                className={`block w-full text-left px-1 ${
                  renderMode === m.id ? 'bg-fg text-bg' : 'text-fg-dim hover:text-fg'
                }`}
              >
                [{m.key.toUpperCase()}] {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MIC LEVEL strip */}
      <div className="dbl-box mt-2 px-3 py-1 relative">
        <span className="corner-glyph tl">╠</span>
        <span className="corner-glyph tr">╣</span>
        <span className="corner-glyph bl">╠</span>
        <span className="corner-glyph br">╣</span>
        <div className="flex items-center gap-4 text-xs">
          {localStream ? (
            <MicLevel stream={localStream} bands={36} muted={isMuted} />
          ) : (
            <span className="text-fg-dim">MIC [────────────────────────]</span>
          )}
          <span className="ml-auto text-fg-dim text-[10px]">
            LOSS: <span className="text-fg tabular">{stats.loss}%</span>
          </span>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="dbl-box mt-2 px-3 py-1 relative">
        <span className="corner-glyph tl">╠</span>
        <span className="corner-glyph tr">╣</span>
        <span className="corner-glyph bl">╚</span>
        <span className="corner-glyph br">╝</span>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <button
            onClick={onMute}
            className={isMuted ? 'btn !text-danger !border-danger' : 'btn'}
          >
            [F1]{isMuted ? ' MIC OFF' : ' MIC ON '}
          </button>
          {callType === 'video' && (
            <button
              onClick={onVideo}
              className={!isVideoEnabled ? 'btn !text-danger !border-danger' : 'btn'}
            >
              [F2]{isVideoEnabled ? ' CAM ON ' : ' CAM OFF'}
            </button>
          )}
          <button className="btn !text-fg-dim cursor-not-allowed" disabled>
            [F3] SHARE
          </button>
          <span className="text-fg-dim text-[10px] ml-2">
            [G/C/M/B] = MODE · [F1]=MIC · [F2]=CAM · [F10]=END
          </span>
          <button
            onClick={onEnd}
            className="ml-auto btn-solid !bg-danger !border-danger !text-bg"
          >
            [F10] END CALL
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function IncomingCallScreen({ callerName, callType, onAccept, onReject }) {
  const dots = useTypingDots();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'a' || e.key === 'A') onAccept();
      else if (e.key === 'r' || e.key === 'R' || e.key === 'Escape') onReject();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAccept, onReject]);

  return (
    <div className="fixed inset-0 z-[100] bg-bg font-mono flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-xl">
        <div className="text-fg-dim text-xs tracking-widest uppercase">
          ─ incoming transmission ─
        </div>
        <pre className="text-fg glow text-xs leading-tight inline-block text-left">
{`  ╔═════════════════════════════════════╗
  ║      INCOMING ${callType.toUpperCase().padEnd(5)} CALL          ║
  ║         RING${dots}                     ║
  ╚═════════════════════════════════════╝`}
        </pre>
        <div className="text-fg text-2xl glow tracking-widest">{callerName}</div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={onAccept} className="btn-solid !text-bg">[A] ANSWER</button>
          <button onClick={onReject} className="btn !text-danger !border-danger">[R] REJECT</button>
        </div>
      </div>
    </div>
  );
}

export default CallModal;
