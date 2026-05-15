import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import Modals from '../components/Modals';
import StatusBar from '../components/StatusBar';
import RightPanel3D from '../components/tui/RightPanel3D';
import useUIStore from '../store/uiStore';
import ASCIIPlanet from '../components/tui/ASCIIPlanet';
import ASCIIParticles from '../components/tui/ASCIIParticles';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';
import { getSocket } from '../socket';
import api from '../api';

function Messenger({ webrtc }) {
  const { user } = useAuthStore();
  const { activeChat, setChats, addChat, addMessage, setTyping, setUserOnline, setUserOffline, updateMessage, deleteMessage, updateChatLastMessage, initOnlineUsers, updateMessagesReadCount } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false); // mobile sidebar drawer
  const { setModal } = useUIStore();
  // Music sessions keyed by chatId: { songId, position, isPlaying, hostId, song, startedSyncId }
  const [musicSessions, setMusicSessions] = useState({});

  useEffect(() => {
    loadChats();
    setupSocketListeners();

    // Re-join all chats on socket reconnect (rooms are lost on disconnect)
    const socket = getSocket();
    if (socket) {
      socket.on('connect', handleSocketReconnect);
    }

    return () => {
      cleanupSocketListeners();
      const s = getSocket();
      if (s) s.off('connect', handleSocketReconnect);
    };
  }, []);

  const handleSocketReconnect = () => {
    const { chats } = useChatStore.getState();
    const socket = getSocket();
    if (socket && chats.length > 0) {
      chats.forEach((chat) => socket.emit('join_chat', { chatId: chat.id }));
    }
  };

  // Ask the server for current music session whenever the active chat changes
  useEffect(() => {
    if (!activeChat?.id) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('music_get_session', { chatId: activeChat.id });
  }, [activeChat?.id]);

  const loadChats = async () => {
    try {
      const response = await api.get('/chats');
      setChats(response.data.chats);

      // Seed online users from initial member data
      const onlineIds = [];
      response.data.chats.forEach(chat => {
        chat.members?.forEach(m => { if (m.online) onlineIds.push(m.id); });
      });
      initOnlineUsers(onlineIds);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('chat_created', (chat) => {
      addChat(chat);
    });

    socket.on('new_message', async (message) => {
      // Skip own messages — already handled optimistically in MessageInput
      if (message.sender_id === user.id) return;

      const state = useChatStore.getState();
      let chat = state.chats.find(c => c.id === message.chat_id);

      // If chat not in store yet, fetch and add it
      if (!chat) {
        try {
          const res = await api.get(`/chats/${message.chat_id}`);
          chat = res.data.chat;
          state.addChat(chat);
        } catch {}
      }

      addMessage(message.chat_id, message);
      updateChatLastMessage(message.chat_id, message);

      if (!state.activeChat || state.activeChat.id !== message.chat_id) {
        state.updateUnread(message.chat_id, (chat?.unread_count || 0) + 1);
      }
    });

    socket.on('user_typing', ({ userId, chatId }) => {
      if (userId !== user.id) {
        setTyping(chatId, userId, true);
      }
    });

    socket.on('user_stop_typing', ({ userId, chatId }) => {
      setTyping(chatId, userId, false);
    });

    socket.on('user_online', ({ userId }) => {
      setUserOnline(userId);
    });

    socket.on('user_offline', ({ userId }) => {
      setUserOffline(userId);
    });

    socket.on('message_edited', (message) => {
      updateMessage(message.chat_id, message);
    });

    socket.on('message_deleted', ({ messageId, chatId }) => {
      deleteMessage(chatId, messageId);
    });

    socket.on('message_reaction', ({ messageId, reactions }) => {
      // Handle reactions update
      console.log('Reaction update:', messageId, reactions);
    });

    socket.on('poll_updated', ({ pollId, messageId, results }) => {
      console.log('Poll updated:', pollId, results);
    });

    socket.on('messages_read', ({ chatId, messageIds }) => {
      updateMessagesReadCount(chatId, messageIds);
    });

    // ============================================
    // MUSIC LISTENING SESSIONS
    // ============================================
    socket.on('music_session', ({ chatId, songId, position, isPlaying, hostId, song }) => {
      setMusicSessions((prev) => ({
        ...prev,
        [chatId]: {
          songId,
          position: position || 0,
          isPlaying: !!isPlaying,
          hostId,
          song,
          startedSyncId: Date.now()
        }
      }));
    });

    socket.on('music_state', ({ chatId, isPlaying, position, hostId }) => {
      setMusicSessions((prev) => {
        const existing = prev[chatId];
        if (!existing) return prev;
        return {
          ...prev,
          [chatId]: {
            ...existing,
            isPlaying: !!isPlaying,
            position: typeof position === 'number' ? position : existing.position,
            hostId: hostId || existing.hostId
          }
        };
      });
    });

    socket.on('music_session_ended', ({ chatId }) => {
      setMusicSessions((prev) => {
        if (!prev[chatId]) return prev;
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
    });
  };

  const cleanupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('chat_created');
    socket.off('new_message');
    socket.off('user_typing');
    socket.off('user_stop_typing');
    socket.off('user_online');
    socket.off('user_offline');
    socket.off('message_edited');
    socket.off('message_deleted');
    socket.off('message_reaction');
    socket.off('poll_updated');
    socket.off('messages_read');
    socket.off('music_session');
    socket.off('music_state');
    socket.off('music_session_ended');
  };

  if (loading) {
    return (
      <div className="h-screen bg-bg flex items-center justify-center font-mono">
        <pre className="text-fg glow text-xs leading-tight text-center">
{`  ┌─────────────────────────────┐
  │  loading conversations...   │
  │  [█████░░░░░░░░░░░░░░░░░]   │
  └─────────────────────────────┘`}
        </pre>
      </div>
    );
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-bg overflow-hidden border-[3px] border-double border-fg crt">
        {/* ═══ TITLE BAR ═══ */}
        <header className="h-7 flex-shrink-0 flex items-center px-2 border-b border-fg-dim relative">
          {/* mobile nav toggle */}
          <button
            onClick={() => setNavOpen((o) => !o)}
            className="md:hidden text-fg hover:glow px-1"
            title="contacts"
          >
            [≡]
          </button>
          <div className="absolute inset-x-0 text-center text-xs tracking-[0.3em] text-fg glow pointer-events-none">
            MESSENGER v2.4.1 <span className="text-fg-dim">[SECURE]</span>
          </div>
        </header>

        {/* ═══ BODY: CONTACTS ║ CHAT ║ 3D ═══ */}
        <div className="flex-1 flex min-h-0" style={{ paddingBottom: 20 }}>
          {/* contacts — full column on tablet/desktop */}
          <aside className="hidden md:block w-[250px] flex-shrink-0 border-r border-fg-dim">
            <Sidebar />
          </aside>

          {/* chat area */}
          <main className="flex-1 flex flex-col min-w-0">
            {activeChat ? (
              <ChatWindow
                webrtc={webrtc}
                musicSession={musicSessions[activeChat.id] || null}
              />
            ) : (
              <EmptyState />
            )}
          </main>

          {/* ASCII 3D — desktop only (hidden < 1024) */}
          <aside className="hidden lg:block w-[200px] flex-shrink-0 border-l border-fg-dim">
            <RightPanel3D />
          </aside>
        </div>

        {/* mobile contacts drawer */}
        {navOpen && (
          <div className="md:hidden fixed inset-0 z-[80] flex">
            <div className="w-[80vw] max-w-[320px] bg-bg border-r border-fg h-full">
              <Sidebar />
            </div>
            <div
              className="flex-1 bg-bg/70"
              onClick={() => setNavOpen(false)}
            />
          </div>
        )}

        {/* mobile/tablet-small bottom symbol nav */}
        <nav className="md:hidden fixed left-0 right-0 z-[60] flex items-center justify-around text-xs bg-bg border-t border-fg-dim h-6" style={{ bottom: 20 }}>
          <button onClick={() => setNavOpen(true)} className="text-fg-dim hover:text-fg">≡ chats</button>
          <button onClick={() => setModal('newChat')} className="text-fg-dim hover:text-fg">[N]</button>
          <button onClick={() => setModal('profile')} className="text-fg-dim hover:text-fg">[P]</button>
          <button onClick={() => setModal('settings')} className="text-fg-dim hover:text-fg">[S]</button>
        </nav>
      </div>
      <StatusBar />
      <Modals />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 relative bg-bg overflow-hidden font-mono">
      {/* Background particle field */}
      <div className="absolute inset-0">
        <ASCIIParticles count={130} fontSize={14} linkDistance={90} />
      </div>

      {/* Foreground content */}
      <div className="relative z-[1] h-full flex items-center justify-center pointer-events-none">
        <div className="text-center flex flex-col items-center gap-6 pointer-events-auto">
          <ASCIIPlanet size={20} speed={1} />

          <div className="text-fg-dim text-xs tracking-[0.3em] uppercase">
            ── no buffer selected ──
          </div>
          <div className="text-muted text-xs space-y-1">
            <div>select a conversation from the left</div>
            <div>or press <span className="text-fg">[N]</span> to start a new one</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Messenger;
