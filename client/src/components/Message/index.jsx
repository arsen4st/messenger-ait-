import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import useChatStore from '../../store/chatStore';
import api from '../../api';

const QUICK_REACTS = ['<3', 'OK', '!!!', '?'];
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function bytesToHuman(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function fileUrl(u) {
  if (!u) return '';
  return u.startsWith('http') ? u : u;
}

function Message({ message, groupWithPrevious }) {
  const { user } = useAuthStore();
  const { setReplyTo, setEditMessage } = useUIStore();
  const { activeChat } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const isOwn = message.sender_id === user.id;
  const isSystem = message.type === 'system';

  const senderName = isOwn ? 'YOU' : (message.sender?.display_name || 'ANON').toUpperCase();
  const time = format(new Date(message.created_at * 1000), 'HH:mm:ss');

  // Delivery status: SENT → DELIVERED → READ
  const isTemp = String(message.id || '').startsWith('temp-');
  let status;
  if (isTemp) status = 'SENT';
  else if ((message.read_count || 0) > 0) status = 'READ';
  else status = 'DELIVERED';

  // Animate status transitions
  const prevStatusRef = useRef(status);
  const [statusFlash, setStatusFlash] = useState(false);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      setStatusFlash(true);
      const t = setTimeout(() => setStatusFlash(false), 200);
      return () => clearTimeout(t);
    }
  }, [status]);

  // Typewriter reveal on first mount for fresh text messages (controlled state)
  const isFresh = (Date.now() / 1000 - message.created_at) < 4;
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    if (message.type !== 'text') return;
    const text = message.content || '';

    if (!isFresh) {
      setDisplayedText(text);
      return;
    }

    // Typewriter animation via controlled state
    let i = 0;
    const iv = setInterval(() => {
      setDisplayedText(text.slice(0, ++i));
      if (i >= text.length) clearInterval(iv);
    }, 18);
    return () => clearInterval(iv);
  }, [message.content, message.type, isFresh]);

  const handleReply = () => { setReplyTo(message); setShowMenu(false); };
  const handleEdit = () => { if (message.type === 'text') { setEditMessage(message); setShowMenu(false); } };
  const handleDelete = async () => {
    if (!window.confirm('DELETE THIS MESSAGE?')) return;
    try { await api.delete(`/messages/${message.id}`); setShowMenu(false); }
    catch (err) { console.error(err); }
  };
  const handleReaction = async (token) => {
    try { await api.post(`/messages/${message.id}/react`, { emoji: token }); setShowReactions(false); }
    catch (err) { console.error(err); }
  };

  // ── SYSTEM MESSAGE ──────────────────────────────────────
  if (isSystem) {
    return (
      <div className="flex items-center gap-2 my-3 select-none text-fg-dim text-xs px-2">
        <span className="overflow-hidden whitespace-nowrap">{'─'.repeat(200)}</span>
        <span className="text-fg whitespace-nowrap glow">
          [{(message.content || 'SYSTEM').toUpperCase()}]
        </span>
        <span className="overflow-hidden whitespace-nowrap flex-1">{'─'.repeat(200)}</span>
      </div>
    );
  }

  return (
    <div className={`group relative ${isOwn ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={`msg-box ${isOwn ? 'is-own' : ''} font-mono text-[13px]`}>
        <span className="corner-glyph tl">┌</span>
        <span className="corner-glyph tr">┐</span>
        <span className="corner-glyph bl">└</span>
        <span className="corner-glyph br">┘</span>

        {/* Top label: ─[Name]─[time]── */}
        <div className="msg-label">
          <span className="text-fg-dim">─[</span>
          <span className={isOwn ? 'text-fg glow' : 'text-fg'}>{senderName}</span>
          <span className="text-fg-dim">]─[</span>
          <span className="text-fg-dim">{time}</span>
          <span className="text-fg-dim">]─</span>
        </div>

        {/* Reply quote */}
        {message.reply_to && (
          <div className="text-fg-dim text-[11px] mb-1 truncate">
            ↳ REPLY TO: {message.reply_to}
          </div>
        )}

        {/* Forwarded */}
        {message.forwarded_from && (
          <div className="text-warn text-[11px] mb-1">⤳ FORWARDED</div>
        )}

        {/* Content */}
        <div className="text-fg leading-relaxed whitespace-pre-wrap break-words">
          {message.type === 'text' && (
            isFresh ? (
              <span>{displayedText}</span>
            ) : (
              renderLinkified(displayedText)
            )
          )}

          {message.type === 'image' && (
            <div className="space-y-1">
              <div className="text-fg-dim">
                [IMAGE: <span className="text-fg">{message.file_name || 'image'}</span>
                {' | '}<span>{bytesToHuman(message.file_size)}</span>]
              </div>
              <a href={fileUrl(message.file_url)} target="_blank" rel="noreferrer">
                <img
                  src={fileUrl(message.file_url)}
                  alt=""
                  className="max-w-xs border border-fg-dim"
                />
              </a>
            </div>
          )}

          {message.type === 'file' && (
            <a
              href={fileUrl(message.file_url)}
              download
              className="text-fg hover:glow inline-block"
            >
              [FILE: <span className="text-fg">{message.file_name || 'file'}</span>
              {message.file_size ? <span className="text-fg-dim"> | {bytesToHuman(message.file_size)}</span> : null}
              {' | '}<span className="text-fg">CLICK TO DOWNLOAD</span>]
            </a>
          )}

          {message.type === 'voice' && (
            <div className="space-y-1">
              <div className="text-fg-dim">[VOICE | {bytesToHuman(message.file_size)}]</div>
              <audio
                controls
                src={fileUrl(message.file_url)}
                className="max-w-[260px] h-7 align-middle"
                style={{ filter: 'invert(1) hue-rotate(180deg)' }}
              />
            </div>
          )}

          {message.type === 'video' && (
            <div className="space-y-1">
              <div className="text-fg-dim">[VIDEO: {message.file_name || 'video'} | {bytesToHuman(message.file_size)}]</div>
              <video controls src={fileUrl(message.file_url)} className="max-w-md border border-fg-dim" />
            </div>
          )}

          {message.type === 'geo' && (
            <a
              href={`https://www.google.com/maps?q=${message.content}`}
              target="_blank"
              rel="noreferrer"
              className="text-fg hover:glow"
            >
              [GEO: {message.content} | CLICK TO OPEN]
            </a>
          )}
        </div>

        {/* Edited mark */}
        {message.edited && (
          <div className="text-fg-dim text-[10px] mt-1 italic">[EDITED]</div>
        )}

        {/* Delivery status (own messages only) */}
        {isOwn && !isSystem && (
          <div className={`msg-status ${status === 'READ' ? 'is-read' : ''} ${statusFlash ? 'status-flash' : ''}`}>
            [{status}]
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute ${isOwn ? '-left-12' : '-right-12'} top-1 opacity-0 group-hover:opacity-100 flex flex-col items-center gap-0.5 text-[11px]`}>
          <button onClick={() => setShowReactions(!showReactions)} className="text-fg-dim hover:text-fg w-8 text-center">[+]</button>
          <button onClick={handleReply} className="text-fg-dim hover:text-fg w-8 text-center">[r]</button>
          <button onClick={() => setShowMenu(!showMenu)} className="text-fg-dim hover:text-fg w-8 text-center">[…]</button>
        </div>

        {/* Quick reactions popup */}
        {showReactions && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowReactions(false)} />
            <div className={`absolute z-40 ${isOwn ? 'right-0' : 'left-0'} -bottom-[2.4em] flex gap-1 bg-bg border border-fg-dim px-1 py-0.5`}>
              {QUICK_REACTS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReaction(r)}
                  className="px-1 hover:bg-fg hover:text-bg text-fg-dim text-xs"
                >
                  [+{r}]
                </button>
              ))}
            </div>
          </>
        )}

        {/* Action menu */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
            <div className={`absolute z-40 ${isOwn ? 'right-0' : 'left-0'} top-full mt-2 border border-fg-dim bg-bg min-w-[140px] py-1 text-xs`}>
              {isOwn && message.type === 'text' && (
                <button onClick={handleEdit} className="w-full px-2 py-1 text-left hover:bg-fg hover:text-bg text-fg">
                  [e] EDIT
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(message.content || ''); setShowMenu(false); }}
                className="w-full px-2 py-1 text-left hover:bg-fg hover:text-bg text-fg"
              >
                [c] COPY
              </button>
              {isOwn && (
                <button onClick={handleDelete} className="w-full px-2 py-1 text-left hover:bg-danger hover:text-bg text-danger">
                  [d] DELETE
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reactions row below the bubble */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`absolute ${isOwn ? 'right-2' : 'left-2'} -bottom-3 flex flex-wrap gap-1 text-[10px]`}>
          {Object.entries(
            message.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
          ).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="px-1 border border-fg-dim bg-bg text-fg-dim hover:text-fg hover:border-fg"
            >
              [+{emoji} {count}]
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Linkify text — wrap URLs in [URL: ... | CLICK TO OPEN] format
function renderLinkified(text) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const url = m[0];
    const display = url.length > 40 ? url.slice(0, 37) + '...' : url;
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noreferrer" className="text-fg underline hover:glow whitespace-nowrap">
        [URL: {display} | CLICK TO OPEN]
      </a>
    );
    lastIdx = m.index + url.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length ? parts : text;
}

export default Message;
