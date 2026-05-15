import { useState, useEffect, useRef } from 'react';
import ChatItem from './ChatItem';

function ChatList({ chats }) {
  const [pinnedChats, setPinnedChats] = useState([]);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem('pinnedChats');
    if (saved) {
      try { setPinnedChats(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Animate only on first mount — not on every filter change
  const animateThisRender = firstRenderRef.current;
  useEffect(() => { firstRenderRef.current = false; }, []);

  const togglePin = (chatId) => {
    const next = pinnedChats.includes(chatId)
      ? pinnedChats.filter((id) => id !== chatId)
      : [...pinnedChats, chatId];
    setPinnedChats(next);
    localStorage.setItem('pinnedChats', JSON.stringify(next));
  };

  const sorted = [...chats].sort((a, b) => {
    if (a.type === 'saved' && b.type !== 'saved') return -1;
    if (b.type === 'saved' && a.type !== 'saved') return 1;
    const ap = pinnedChats.includes(a.id);
    const bp = pinnedChats.includes(b.id);
    if (ap && !bp) return -1;
    if (bp && !ap) return 1;
    return (b.last_message?.created_at || 0) - (a.last_message?.created_at || 0);
  });

  if (chats.length === 0) {
    return (
      <div className="p-4 text-center text-muted text-xs font-mono space-y-2">
        <pre className="text-fg-dim text-[10px] inline-block text-left">
{`   ┌──────────────────┐
   │   no_chats.dat   │
   │   ──────────     │
   └──────────────────┘`}
        </pre>
        <div>press <span className="text-fg">[N]</span> to start a new chat</div>
      </div>
    );
  }

  return (
    <div className="py-1">
      {sorted.map((chat, idx) => (
        <div
          key={chat.id}
          className={animateThisRender ? 'ticker-in' : ''}
          style={animateThisRender ? { animationDelay: `${idx * 50}ms` } : undefined}
        >
          <ChatItem
            chat={chat}
            isPinned={pinnedChats.includes(chat.id)}
            onTogglePin={() => togglePin(chat.id)}
          />
          {idx < sorted.length - 1 && (
            <div className="text-fg-dim leading-none select-none overflow-hidden whitespace-nowrap text-[10px] px-2">
              {'─'.repeat(200)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChatList;
