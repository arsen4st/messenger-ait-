import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import useUIStore from '../../store/uiStore';
import ChatList from './ChatList';
import StoriesStrip from './StoriesStrip';
import ThemeToggle from '../tui/ThemeToggle';
import { transition } from '../../store/transitionStore';

function Sidebar() {
  const { user } = useAuthStore();
  const { chats, onlineUsers } = useChatStore();
  const { setModal } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    // Reflect socket connection in header
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (chat.type === 'direct') {
      const other = chat.members?.find((m) => m.id !== user.id);
      return other?.display_name?.toLowerCase().includes(q) ||
             other?.username?.toLowerCase().includes(q);
    }
    return chat.name?.toLowerCase().includes(q);
  });

  // Count online/offline based on direct-chat partners
  let onlineCount = 0, offlineCount = 0;
  chats.forEach((c) => {
    if (c.type !== 'direct') return;
    const other = c.members?.find((m) => m.id !== user.id);
    if (!other) return;
    if (onlineUsers.has(other.id)) onlineCount++;
    else offlineCount++;
  });

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden font-mono">
      {/* ─── HEADER ─── */}
      <div className="border-b border-fg-dim">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-fg text-sm glow">
            <span className="text-fg-dim">&gt;</span>
            <span className="font-bold">MESSENGER v2.4.1</span>
            <span className="ml-auto text-xs">
              [<span className={connected ? 'text-fg pulse-dot' : 'text-danger'}>
                {connected ? 'CONNECTED' : 'OFFLINE'}
              </span>]
            </span>
          </div>
          <button
            onClick={() => setModal('profile')}
            className="block text-left text-fg-dim text-sm mt-0.5 hover:text-fg"
          >
            <span className="text-fg-dim">&gt;</span> USER:{' '}
            <span className="text-fg">{user.display_name}</span>
            <span className="text-fg animate-cursor-blink ml-px">█</span>
          </button>
        </div>

        <DividerLine />

        {/* SEARCH row */}
        <div className="px-3 py-1.5 flex items-center gap-2 text-sm">
          <span className="text-fg">SEARCH &gt;</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="_______________________"
            className="flex-1 bg-transparent border-none outline-none text-fg placeholder:text-muted caret-fg p-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted hover:text-danger text-xs">
              [x]
            </button>
          )}
        </div>

        <DividerLine />

        {/* Counts row */}
        <div className="px-3 py-1.5 text-xs flex items-center gap-4">
          <span className="text-fg flex items-center gap-1">
            <span className="pulse-dot">●</span> ONLINE
            <span className="text-fg-dim">({onlineCount})</span>
          </span>
          <span className="text-fg-dim flex items-center gap-1">
            <span>○</span> OFFLINE
            <span>({offlineCount})</span>
          </span>
          <ThemeToggle className="ml-auto" />
        </div>

        <DividerLine />
      </div>

      {/* ─── STORIES ─── */}
      {!searchQuery && <StoriesStrip />}

      {/* ─── CHAT LIST ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto tty-scroll">
        <ChatList chats={filteredChats} />
      </div>

      {/* ─── FOOTER COMMANDS ─── */}
      <div className="border-t border-fg-dim px-3 py-1.5 text-[11px] flex items-center gap-3 text-muted">
        <button onClick={() => setModal('newChat')} className="hover:text-fg">
          <span className="text-fg">[N]</span> NEW
        </button>
        <button onClick={() => setModal('profile')} className="hover:text-fg">
          <span className="text-fg">[P]</span> PROFILE
        </button>
        <button
          onClick={() => transition('clear', () => setModal('settings'))}
          className="hover:text-fg"
        >
          <span className="text-fg">[S]</span> SETTINGS
        </button>
        <span className="ml-auto text-fg-dim">
          {filteredChats.length} chat{filteredChats.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

function DividerLine() {
  return (
    <div className="text-fg-dim leading-none select-none overflow-hidden whitespace-nowrap text-xs">
      {'─'.repeat(200)}
    </div>
  );
}

export default Sidebar;
