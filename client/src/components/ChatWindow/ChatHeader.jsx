import { formatDistanceToNow } from 'date-fns';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';

function ChatHeader({ webrtc, onOpenMusic }) {
  const { activeChat, onlineUsers } = useChatStore();
  const { user } = useAuthStore();
  if (!activeChat) return null;

  const getInfo = () => {
    if (activeChat.type === 'saved') {
      return { name: 'SAVED.TXT', subtitle: 'PRIVATE BUFFER', isSaved: true };
    }
    if (activeChat.type === 'direct') {
      const other = activeChat.members?.find((m) => m.id !== user.id);
      const isOnline = other ? onlineUsers.has(other.id) : false;
      let subtitle = 'OFFLINE';
      if (isOnline) subtitle = 'ONLINE';
      else if (other?.last_seen) {
        try {
          subtitle = `LAST SEEN ${formatDistanceToNow(new Date(other.last_seen * 1000), { addSuffix: true })}`.toUpperCase();
        } catch {}
      }
      return {
        name: (other?.display_name || 'UNKNOWN').toUpperCase(),
        isOnline,
        subtitle,
        userId: other?.id,
        isDirect: true,
      };
    }
    const count = activeChat.members?.length || 0;
    const online = activeChat.members?.filter((m) => onlineUsers.has(m.id)).length || 0;
    return {
      name: (activeChat.name || 'GROUP').toUpperCase(),
      isGroup: true,
      subtitle: `${count} MEMBER${count !== 1 ? 'S' : ''} · ${online} ONLINE`,
    };
  };

  const info = getInfo();
  const status = info.isSaved ? 'PRIVATE' : info.isOnline ? 'ONLINE' : info.isDirect ? 'OFFLINE' : info.subtitle;

  return (
    <div className="p-2">
      <div className="dbl-box px-4 py-2 flex items-center gap-3">
        <span className="corner-glyph tl">╔</span>
        <span className="corner-glyph tr">╗</span>
        <span className="corner-glyph bl">╚</span>
        <span className="corner-glyph br">╝</span>

        {/* Username | Status | Encryption */}
        <div className="flex items-center gap-2 text-sm text-fg flex-1 min-w-0">
          <span className="font-bold truncate glow">{info.name}</span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">STATUS:</span>
          <span className={info.isOnline ? 'text-fg pulse-dot' : 'text-fg-dim'}>
            {status}
          </span>
          <span className="text-fg-dim">|</span>
          <span className="text-fg-dim">ENCRYPTION:</span>
          <span className="text-fg">[AES-256]</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 text-xs flex-shrink-0">
          {!info.isSaved && (
            <button onClick={onOpenMusic} className="btn-tui" title="music">♪</button>
          )}
          {info.isDirect && (
            <>
              <button
                className="btn-tui"
                title="call"
                onClick={() => {
                  const other = activeChat.members?.find((m) => m.id !== user.id);
                  if (other && webrtc) webrtc.initCall(other.id, 'audio');
                }}
              >
                CALL
              </button>
              <button
                className="btn-tui"
                title="video"
                onClick={() => {
                  const other = activeChat.members?.find((m) => m.id !== user.id);
                  if (other && webrtc) webrtc.initCall(other.id, 'video');
                }}
              >
                VID
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatHeader;
