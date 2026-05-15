import { useEffect, useRef, useState } from 'react';
import api from '../../api';
import { getSocket } from '../../socket';
import useAuthStore from '../../store/authStore';
import { Frame } from '../tui/Frame';

function fmt(s) {
  if (!Number.isFinite(s) || s <= 0) return '--:--';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function MusicLibrary({ open, onClose, chatId }) {
  const { user } = useAuthStore();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { if (open) loadSongs(); }, [open]);

  const loadSongs = async () => {
    setLoading(true); setError('');
    try { setSongs((await api.get('/music')).data.songs || []); }
    catch { setError('failed to load library'); }
    finally { setLoading(false); }
  };

  const probeDuration = (file) => new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.src = url;
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? Math.round(d) : null); };
      a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    } catch { resolve(null); }
  });

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('audio/')) { setError('audio files only'); return; }
    setUploading(true); setError('');
    try {
      const d = await probeDuration(f);
      const fd = new FormData();
      fd.append('file', f);
      fd.append('title', f.name.replace(/\.[^/.]+$/, ''));
      if (d) fd.append('duration', String(d));
      const r = await api.post('/music/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (r.data?.song) setSongs((p) => [r.data.song, ...p]);
    } catch (err) { setError(err?.response?.data?.error || 'upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handlePlay = (song) => {
    if (!chatId) return;
    const s = getSocket();
    if (!s) return;
    s.emit('music_start_session', { chatId, songId: song.id });
    onClose?.();
  };

  const handleDelete = async (song) => {
    if (!confirm(`delete "${song.title}"?`)) return;
    try { await api.delete(`/music/${song.id}`); setSongs((p) => p.filter((x) => x.id !== song.id)); }
    catch (err) { setError(err?.response?.data?.error || 'delete failed'); }
  };

  const filtered = songs.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q);
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl"
      >
        <Frame
          title="music.library"
          badge={`${songs.length} tracks`}
          footer="enter=play · u=upload · d=delete · esc=close"
          accent="amber"
          innerClassName="p-4"
        >
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-warn">/</span>
            <input
              type="text"
              placeholder="search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field px-2 py-1 text-sm flex-1"
            />
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-solid disabled:opacity-50 text-xs"
            >
              {uploading ? '... uploading' : '+ upload'}
            </button>
            <button onClick={onClose} className="btn-tui hover:!text-danger">esc</button>
          </div>

          {error && (
            <div className="text-danger text-xs mb-2">! {error}</div>
          )}

          {/* Songs */}
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin font-mono text-sm">
            {loading ? (
              <div className="text-center py-8 text-muted text-xs">
                <span className="text-warn animate-cursor-blink">›</span> scanning library...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <pre className="text-fg-dim text-[10px] inline-block text-left mb-2">
{`   ┌─────────────────┐
   │   no_music.dat  │
   └─────────────────┘`}
                </pre>
                <div className="text-xs">{query ? 'no matches' : 'upload your first track'}</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] tracking-widest uppercase text-muted border-b border-fg-dim">
                    <th className="text-left font-normal px-2 py-1 w-8">#</th>
                    <th className="text-left font-normal px-2 py-1">title</th>
                    <th className="text-left font-normal px-2 py-1">artist</th>
                    <th className="text-right font-normal px-2 py-1 w-16">time</th>
                    <th className="text-right font-normal px-2 py-1 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((song, idx) => (
                    <tr
                      key={song.id}
                      className="border-b border-fg-dim/40 group hover:bg-card/60 transition-colors"
                    >
                      <td className="px-2 py-1.5 text-muted text-xs tabular-nums">
                        <span className="group-hover:hidden">{(idx + 1).toString().padStart(2, '0')}</span>
                        <button
                          onClick={() => handlePlay(song)}
                          disabled={!chatId}
                          className="hidden group-hover:inline text-warn hover:text-fg"
                          title={chatId ? 'play together' : 'open a chat first'}
                        >
                          ▶
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-fg truncate max-w-[200px]">{song.title}</td>
                      <td className="px-2 py-1.5 text-fg-dim truncate max-w-[160px]">{song.artist || '—'}</td>
                      <td className="px-2 py-1.5 text-muted text-right tabular-nums text-xs">{fmt(song.duration)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {song.uploaded_by === user?.id && (
                          <button
                            onClick={() => handleDelete(song)}
                            className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 text-xs"
                          >
                            [del]
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Frame>
      </div>
    </div>
  );
}

export default MusicLibrary;
