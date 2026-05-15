import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import MusicPlayer from '../Music/MusicPlayer';
import MusicLibrary from '../Music/MusicLibrary';
import useChatStore from '../../store/chatStore';
import useUIStore from '../../store/uiStore';
import { getSocket } from '../../socket';
import api from '../../api';
import { matrixRain } from '../../utils/ascii';

function ChatWindow({ webrtc, musicSession }) {
  const [musicLibraryOpen, setMusicLibraryOpen] = useState(false);
  const { activeChat, messages, setMessages, markChatRead } = useChatStore();
  const { clearReplyTo, clearEditMessage } = useUIStore();
  const loadingRef = useRef(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!activeChat) return;
    clearReplyTo();
    clearEditMessage();
    if (!messages[activeChat.id] || messages[activeChat.id].length === 0) loadMessages();
    const socket = getSocket();
    if (socket) {
      socket.emit('join_chat', { chatId: activeChat.id });
      socket.emit('mark_chat_read', { chatId: activeChat.id });
    }
    markChatRead(activeChat.id);
    return () => {
      if (socket) socket.emit('leave_chat', { chatId: activeChat.id });
    };
  }, [activeChat?.id]);

  // Matrix rain background
  useEffect(() => {
    if (!canvasRef.current) return;
    const stop = matrixRain(canvasRef.current, { fontSize: 16, fps: 14 });
    return stop;
  }, []);

  const loadMessages = async () => {
    if (!activeChat || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await api.get(`/messages/${activeChat.id}?limit=50`);
      setMessages(activeChat.id, res.data.messages || []);
    } catch (err) { console.error(err); }
    finally { loadingRef.current = false; }
  };

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: () => {},
    noClick: true,
    noKeyboard: true
  });

  if (!activeChat) return null;

  return (
    <div {...getRootProps()} className="h-full bg-bg relative flex flex-col overflow-hidden">
      {/* Matrix rain background — very faint */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.03 }}
      />

      {isDragActive && (
        <div className="absolute inset-3 z-50 border-2 border-dashed border-fg bg-bg/90 flex items-center justify-center">
          <pre className="text-fg glow text-center text-sm">
{`  ┌──────────────────────┐
  │  >> DROP TO UPLOAD   │
  └──────────────────────┘`}
          </pre>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <ChatHeader webrtc={webrtc} onOpenMusic={() => setMusicLibraryOpen(true)} />
        <MessageList />
        <TypingIndicator />
        {musicSession && (
          <MusicPlayer
            chatId={activeChat.id}
            session={musicSession}
            members={activeChat.members || []}
          />
        )}
        <MessageInput />
      </div>

      <MusicLibrary
        open={musicLibraryOpen}
        onClose={() => setMusicLibraryOpen(false)}
        chatId={activeChat.id}
      />
    </div>
  );
}

export default ChatWindow;
