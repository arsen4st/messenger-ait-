import { useEffect, useRef, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import Message from '../Message';
import useChatStore from '../../store/chatStore';
import api from '../../api';

function MessageList() {
  const { activeChat, messages, prependMessages } = useChatStore();
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const prevScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const chatMessages = messages[activeChat?.id] || [];

  useEffect(() => {
    isInitialLoadRef.current = true;
    setHasMore(true);
  }, [activeChat?.id]);

  useEffect(() => {
    if (isInitialLoadRef.current && chatMessages.length > 0) {
      scrollToBottom('instant');
      isInitialLoadRef.current = false;
    }
  }, [chatMessages.length]);

  useEffect(() => {
    if (!isInitialLoadRef.current && chatMessages.length > 0) {
      const c = containerRef.current;
      if (c) {
        const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 200;
        if (nearBottom) scrollToBottom('smooth');
      }
    }
  }, [chatMessages.length]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight, behavior
      });
    }
  };

  const handleScroll = async () => {
    const c = containerRef.current;
    if (!c || loading || !hasMore) return;
    if (c.scrollTop < 100) await loadMore();
  };

  const loadMore = async () => {
    if (!activeChat || loading || !hasMore) return;
    const oldest = chatMessages[0];
    if (!oldest) return;
    setLoading(true);
    prevScrollHeightRef.current = containerRef.current?.scrollHeight || 0;
    try {
      const res = await api.get(`/messages/${activeChat.id}?limit=50&before=${oldest.id}`);
      const newOnes = res.data.messages || [];
      if (newOnes.length === 0) setHasMore(false);
      else {
        prependMessages(activeChat.id, newOnes);
        setTimeout(() => {
          if (containerRef.current) {
            const diff = containerRef.current.scrollHeight - prevScrollHeightRef.current;
            containerRef.current.scrollTop = diff;
          }
        }, 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const dateLabel = (ts) => {
    const d = new Date(ts * 1000);
    if (isToday(d)) return 'TODAY';
    if (isYesterday(d)) return 'YESTERDAY';
    return format(d, 'MMMM d, yyyy').toUpperCase();
  };
  const showDate = (cur, prev) => {
    if (!prev) return true;
    return !isSameDay(new Date(cur.created_at * 1000), new Date(prev.created_at * 1000));
  };
  const groupWith = (cur, prev) => {
    if (!prev) return false;
    if (cur.sender_id !== prev.sender_id) return false;
    return (cur.created_at - prev.created_at) < 300;
  };

  if (!activeChat) return null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto tty-scroll px-4 py-4 font-mono"
    >
      {loading && (
        <div className="text-center py-2 text-fg-dim text-xs">
          <span className="text-fg animate-cursor-blink">›</span> LOADING HISTORY...
        </div>
      )}

      {chatMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <pre className="text-fg-dim text-xs text-center leading-tight">
{`     ╔═════════════════════════════╗
     ║     NO MESSAGES YET         ║
     ║   START TYPING BELOW        ║
     ╚═════════════════════════════╝`}
          </pre>
        </div>
      ) : (
        <div className="space-y-2 max-w-4xl mx-auto">
          {chatMessages.map((m, i) => {
            const prev = i > 0 ? chatMessages[i - 1] : null;
            return (
              <div key={m.id}>
                {showDate(m, prev) && (
                  <div className="flex items-center gap-2 my-4 text-fg-dim text-xs select-none">
                    <span className="overflow-hidden whitespace-nowrap">{'─'.repeat(200)}</span>
                    <span className="text-fg whitespace-nowrap glow tracking-widest">
                      [{dateLabel(m.created_at)}]
                    </span>
                    <span className="overflow-hidden whitespace-nowrap flex-1">{'─'.repeat(200)}</span>
                  </div>
                )}
                <Message message={m} groupWithPrevious={groupWith(m, prev)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MessageList;
