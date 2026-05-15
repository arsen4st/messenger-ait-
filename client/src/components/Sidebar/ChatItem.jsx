import { formatDistanceToNow } from 'date-fns';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../socket';
import { asciiAvatar } from '../../utils/ascii';

function ChatItem({ chat, isPinned, onTogglePin }) {
  const { user } = useAuthStore();
  const { activeChat, setActiveChat, onlineUsers } = useChatStore();
  const isActive = activeChat?.id === chat.id;

  const handleClick = () => {
    setActiveChat(chat);
    const socket = getSocket();
    if (socket) socket.emit('join_chat', { chatId: chat.id });
  };

  const info = (() => {
    if (chat.type === 'saved') {
      return {
        name: 'SAVED.TXT',
        seed: 'saved-' + user.id,
        isOnline: false,
        isSelf: true,
      };
    }
    if (chat.type === 'direct') {
      const other = chat.members?.find((m) => m.id !== user.id);
      return {
        name: (other?.display_name || 'unknown').toUpperCase(),
        seed: other?.id || other?.username || 'x',
        isOnline: other ? onlineUsers.has(other.id) : false,
      };
    }
    return {
      name: `#${(chat.name || 'group').toUpperCase()}`,
      seed: chat.id,
      isGroup: true,
      isOnline: false,
    };
  })();

  const avatar = asciiAvatar(info.seed, 4);

  const formatTime = (ts) => {
    if (!ts) return '--:--';
    try {
      const d = new Date(ts * 1000);
      // HH:MM 24h
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return '--:--'; }
  };

  const previewText = () => {
    if (!chat.last_message) return '— no messages —';
    const m = chat.last_message;
    const own = m.sender_id === user.id ? 'YOU: ' : '';
    const types = {
      image: '[IMG]', voice: '[VOICE]', audio: '[AUDIO]',
      video: '[VIDEO]', file: '[FILE]', poll: '[POLL]', geo: '[GEO]',
    };
    if (m.type === 'text') {
      return own + (m.content?.substring(0, 60) || '');
    }
    return own + (types[m.type] || '[MSG]');
  };

  const senderIsOwn = chat.last_message?.sender_id === user.id;
  const hasRead = (chat.last_message?.read_count || 0) > 0;
  const unread = chat.unread_count || 0;

  return (
    <button
      onClick={handleClick}
      className={`block w-full text-left invert-hover px-2 py-1 font-mono text-[13px] leading-tight ${
        isActive ? 'is-active' : 'text-fg-dim'
      }`}
    >
      <div className="grid grid-cols-[4ch_1fr_auto] gap-2 items-start">
        {/* 4×4 ASCII avatar */}
        <pre className="text-fg leading-[1.0] select-none whitespace-pre">
          {avatar.join('\n')}
        </pre>

        {/* Body — 4 lines tall */}
        <div className="flex flex-col leading-[1.0] gap-[2px] min-w-0">
          {/* Line 1: status + name */}
          <div className="flex items-center gap-1 min-w-0">
            <span className={info.isOnline ? 'text-fg pulse-dot' : 'text-fg-dim'}>
              {info.isOnline ? '●' : '○'}
            </span>
            <span className={`truncate ${unread > 0 ? 'text-fg' : 'text-fg'}`}>
              {info.name}
            </span>
            {isPinned && <span className="text-warn ml-1">[P]</span>}
          </div>

          {/* Line 2: arrow + preview */}
          <div className="truncate">
            <span className="text-fg-dim">{'>'}</span>{' '}
            <span className="text-fg-dim">{previewText()}</span>
          </div>

          {/* Line 3: reads / new badge / pad */}
          <div className="flex items-center gap-2 min-w-0">
            {senderIsOwn && chat.last_message && (
              <span className={hasRead ? 'text-fg' : 'text-fg-dim'}>
                {hasRead ? '✓✓' : '✓ '}
              </span>
            )}
            <span className="text-fg-dim flex-1 truncate select-none">
              {unread > 0
                ? '░'.repeat(20).slice(0, 14)
                : '─'.repeat(20).slice(0, 14)}
            </span>
            {unread > 0 && (
              <span className="unread-blink text-warn font-bold flex-shrink-0">
                [{unread > 99 ? '99+' : unread} NEW]
              </span>
            )}
          </div>

          {/* Line 4: empty filler so the row matches the 4-line avatar height */}
          <div className="text-fg-dim/0 select-none">.</div>
        </div>

        {/* Time on the right */}
        <span className="text-fg-dim text-[11px] tabular leading-[1.0] mt-px">
          {formatTime(chat.last_message?.created_at)}
        </span>
      </div>
    </button>
  );
}

export default ChatItem;
