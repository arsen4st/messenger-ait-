import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../socket';
import useAuthStore from '../../store/authStore';

function fmt(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Build a `[████████░░░░░░░░] 50%` ASCII bar
function asciiBar(pct, width = 32) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function MusicPlayer({ chatId, session, members = [] }) {
  const { user } = useAuthStore();
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(session?.position || 0);
  const [muted, setMuted] = useState(false);
  const lastSessionIdRef = useRef(null);

  const song = session?.song;
  const isPlaying = !!session?.isPlaying;
  const duration = song?.duration || audioRef.current?.duration || 0;

  useEffect(() => {
    if (!session || !song) return;
    const a = audioRef.current;
    if (!a) return;
    if (lastSessionIdRef.current !== song.id) {
      lastSessionIdRef.current = song.id;
      a.src = song.file_url;
      a.load();
    }
    const target = session.position || 0;
    if (Math.abs(a.currentTime - target) > 1.5) { try { a.currentTime = target; } catch {} }
    setCurrentTime(target);
    if (isPlaying) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } else a.pause();
  }, [session?.song?.id, session?.startedSyncId]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !song) return;
    if (isPlaying) {
      if (typeof session?.position === 'number' && Math.abs(a.currentTime - session.position) > 1.5) {
        try { a.currentTime = session.position; } catch {}
      }
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      a.pause();
      if (typeof session?.position === 'number') {
        try { a.currentTime = session.position; } catch {}
        setCurrentTime(session.position);
      }
    }
  }, [isPlaying, session?.position]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : 0.85;
  }, [muted]);

  if (!session || !song) return null;
  const total = duration || song.duration || 0;
  const pct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  const others = Math.max(0, (members?.length || 0) - 1);
  const isHost = session.hostId === user?.id;

  const onTogglePlay = () => {
    const s = getSocket();
    if (!s) return;
    s.emit(isPlaying ? 'music_pause' : 'music_play', { chatId });
  };
  const onSeekClick = (e) => {
    const s = getSocket();
    if (!s || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    s.emit('music_seek', { chatId, position: r * total });
  };
  const onEnd = () => {
    const s = getSocket();
    if (!s) return;
    s.emit('music_stop_session', { chatId });
  };

  return (
    <div className="border-t border-warn/40 bg-warn/[0.04] px-3 py-2 font-mono text-sm">
      <audio ref={audioRef} preload="auto" />
      <div className="flex items-center gap-2">
        <span className="text-warn glow">♪</span>
        <span className="text-warn tracking-widest text-[10px] uppercase">now playing</span>
        <span className="text-muted text-[11px] flex-1 truncate">
          <span className="text-fg">{song.title}</span>
          {song.artist && <span className="text-fg-dim"> — {song.artist}</span>}
        </span>
        {others > 0 && (
          <span className="text-info text-[11px]">⚇ +{others} listening</span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onTogglePlay}
          className="text-warn hover:text-fg px-1 transition-colors"
          title={isPlaying ? 'pause' : 'play'}
        >
          [{isPlaying ? '❚❚' : ' ▶ '}]
        </button>
        <span className="text-muted text-[11px] tabular-nums w-12 text-right">{fmt(currentTime)}</span>
        <div
          onClick={onSeekClick}
          className="flex-1 cursor-pointer text-warn select-none tracking-tighter no-liga text-[13px] hover:text-fg transition-colors"
          title="click to seek"
        >
          [{asciiBar(pct, 40)}]
        </div>
        <span className="text-muted text-[11px] tabular-nums w-12">{fmt(total)}</span>
        <button onClick={() => setMuted(!muted)} className="text-fg-dim hover:text-warn px-1" title="mute">
          [{muted ? 'M' : 'm'}]
        </button>
        {isHost && (
          <button onClick={onEnd} className="text-fg-dim hover:text-danger px-1" title="end session">
            [✕]
          </button>
        )}
      </div>
    </div>
  );
}

export default MusicPlayer;
