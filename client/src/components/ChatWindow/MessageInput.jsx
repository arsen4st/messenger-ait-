import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import useChatStore from '../../store/chatStore';
import useUIStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../socket';
import api from '../../api';
import { emojiToAscii, asciiSuggest } from '../../utils/asciiEmoji';
import AsciiEmojiPicker from './AsciiEmojiPicker';

function MessageInput() {
  const { activeChat, addMessage, replaceTempMessage } = useChatStore();
  const { replyTo, editMessage, clearReplyTo, clearEditMessage } = useUIStore();
  const { user } = useAuthStore();

  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAsciiPicker, setShowAsciiPicker] = useState(false);
  const [asciiMode, setAsciiMode] = useState(false);
  // { query, start, caret, items, index } | null
  const [suggest, setSuggest] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sending, setSending] = useState(false);

  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editMessage) {
      setText(editMessage.content || '');
      textareaRef.current?.focus();
    }
  }, [editMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleTyping = () => {
    const s = getSocket();
    if (!s || !activeChat) return;
    s.emit('typing_start', { chatId: activeChat.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => s.emit('typing_stop', { chatId: activeChat.id }), 3000);
  };

  const stopTyping = () => {
    const s = getSocket();
    if (!s || !activeChat) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    s.emit('typing_stop', { chatId: activeChat.id });
  };

  // ── ASCII emoji helpers ───────────────────────────────────
  // ":token" immediately before the caret → suggestion list.
  const refreshSuggest = (value, caret) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|[\s.,!?(])\:([a-zA-Z0-9_+\-]*)$/);
    if (!m) {
      setSuggest(null);
      return;
    }
    const query = m[1];
    const items = asciiSuggest(query);
    if (!items.length) {
      setSuggest(null);
      return;
    }
    setSuggest({ query, start: caret - query.length - 1, caret, items, index: 0 });
  };

  const handleChange = (e) => {
    let value = e.target.value;
    let caret = e.target.selectionStart;
    if (asciiMode) {
      const converted = emojiToAscii(value);
      if (converted !== value) {
        caret += converted.length - value.length;
        value = converted;
      }
    }
    setText(value);
    handleTyping();
    refreshSuggest(value, caret);
  };

  // Replace the typed ":token" with the chosen ASCII alternative.
  const applySuggest = (item) => {
    if (!suggest) return;
    const { start, caret } = suggest;
    const next = text.slice(0, start) + item.a + ' ' + text.slice(caret);
    const pos = start + item.a.length + 1;
    setText(next);
    setSuggest(null);
    const ta = textareaRef.current;
    if (ta) setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos; ta.focus(); }, 0);
  };

  // Insert ASCII at the caret (used by the picker).
  const insertAscii = (ascii) => {
    const ta = textareaRef.current;
    const start = ta ? ta.selectionStart : text.length;
    const end = ta ? ta.selectionEnd : text.length;
    const next = text.slice(0, start) + ascii + text.slice(end);
    setText(next);
    const pos = start + ascii.length;
    if (ta) setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos; ta.focus(); }, 0);
  };

  // F2: convert every unicode emoji already in the box to ASCII.
  const convertEmoji = () => {
    const ta = textareaRef.current;
    const caret = ta ? ta.selectionStart : text.length;
    const converted = emojiToAscii(text);
    setText(converted);
    setSuggest(null);
    if (ta) {
      const pos = caret + (converted.length - text.length);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos; ta.focus(); }, 0);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !activeChat || sending) return;
    stopTyping();
    const txt = text.trim();
    setText('');

    if (editMessage) {
      setSending(true);
      try {
        await api.patch(`/messages/${editMessage.id}`, { content: txt });
        clearEditMessage();
      } catch (err) { setText(txt); }
      finally { setSending(false); }
    } else {
      const tempId = `temp-${Date.now()}`;
      const temp = {
        id: tempId, chat_id: activeChat.id, sender_id: user.id, type: 'text',
        content: txt, reply_to: replyTo?.id || null,
        created_at: Math.floor(Date.now() / 1000),
        sender: { id: user.id, username: user.username, display_name: user.display_name, avatar: user.avatar, emoji_avatar: user.emoji_avatar },
        reactions: []
      };
      addMessage(activeChat.id, temp);
      clearReplyTo();
      setSending(true);
      try {
        const res = await api.post(`/messages/${activeChat.id}`, {
          type: 'text', content: txt, reply_to: replyTo?.id || null
        });
        replaceTempMessage(activeChat.id, tempId, res.data.message);
      } catch (err) { console.error(err); }
      finally { setSending(false); }
    }
  };

  const handleKeyDown = (e) => {
    // Suggestion list captures navigation/commit keys first.
    if (suggest && suggest.items.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggest((s) => ({ ...s, index: (s.index + 1) % s.items.length }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggest((s) => ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggest(suggest.items[suggest.index]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    else if (e.key === 'Escape') { clearReplyTo(); clearEditMessage(); }
    else if (e.key === 'F2') { e.preventDefault(); convertEmoji(); }
    else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fileInputRef.current?.click(); }
  };

  const trackCaret = (e) => {
    if (!suggest && !text.includes(':')) return;
    refreshSuggest(e.target.value, e.target.selectionStart);
  };

  const handleEmojiClick = (data) => {
    const emoji = data.emoji;
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart, end = ta.selectionEnd;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      }, 0);
    } else setText(text + emoji);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const f of files) await uploadFile(f);
    e.target.value = '';
  };

  const uploadFile = async (file) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { url, name, size, type } = res.data;
      const isImg = type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name || '');
      const msgRes = await api.post(`/messages/${activeChat.id}`, {
        type: isImg ? 'image' : 'file', file_url: url, file_name: name, file_size: size
      });
      addMessage(activeChat.id, msgRes.data.message);
      useChatStore.getState().updateChatLastMessage(activeChat.id, msgRes.data.message);
    } catch (err) { console.error(err); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadVoice(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
  };

  const uploadVoice = async (blob) => {
    try {
      const fd = new FormData();
      fd.append('voice', blob, 'voice.webm');
      const res = await api.post('/files/voice', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { url, size } = res.data;
      const msgRes = await api.post(`/messages/${activeChat.id}`, { type: 'voice', file_url: url, file_size: size });
      addMessage(activeChat.id, msgRes.data.message);
      useChatStore.getState().updateChatLastMessage(activeChat.id, msgRes.data.message);
    } catch (err) { console.error(err); }
  };

  const fmtRec = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!activeChat) return null;

  return (
    <div className="p-2">
      {(replyTo || editMessage) && (
        <div className="mb-1 border border-fg-dim bg-bg px-2 py-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-warn">{editMessage ? '[EDIT]' : '[REPLY]'}</span>
            <span className="text-fg-dim truncate">{editMessage?.content || replyTo?.content}</span>
          </div>
          <button
            onClick={() => { clearReplyTo(); clearEditMessage(); }}
            className="text-muted hover:text-danger"
          >
            [ESC]
          </button>
        </div>
      )}

      {isRecording && (
        <div className="mb-1 border border-danger bg-bg px-2 py-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-danger animate-cursor-blink">●</span>
            <span className="text-danger font-bold">REC</span>
            <span className="text-fg tabular">{fmtRec(recordingTime)}</span>
            <span className="text-fg-dim">RECORDING VOICE...</span>
          </div>
          <button onClick={cancelRecording} className="text-danger hover:underline">[CANCEL]</button>
        </div>
      )}

      <div className="dbl-box px-3 pt-2 pb-1 relative">
        <span className="corner-glyph tl">╔</span>
        <span className="corner-glyph tr">╗</span>
        <span className="corner-glyph bl">╚</span>
        <span className="corner-glyph br">╝</span>

        <div className="flex items-start gap-2">
          <span className="text-fg pt-1 select-none">&gt;</span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={trackCaret}
            onClick={trackCaret}
            placeholder={asciiMode ? 'TYPE MESSAGE [ASCII MODE]' : 'TYPE MESSAGE'}
            rows={1}
            className="flex-1 bg-transparent text-fg placeholder:text-muted resize-none outline-none max-h-32 py-1 text-sm font-mono"
          />
          <span className="text-fg animate-cursor-blink pt-1 select-none">█</span>
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="btn-solid disabled:opacity-30 text-xs ml-1"
          >
            SEND
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-fg-dim mt-1 pt-1 border-t border-fg-dim">
          <span><span className="text-fg">[ENTER]</span> SEND</span>
          <span><span className="text-fg">[CTRL+F]</span> FILE</span>
          <span>
            <button onClick={convertEmoji} className="hover:text-fg" title="convert emoji → ASCII">
              <span className="text-fg">[F2]</span> →ASCII
            </button>
          </span>
          <span>
            <button
              onClick={() => { setShowAsciiPicker((p) => !p); setShowEmojiPicker(false); }}
              className="hover:text-fg"
            >
              <span className="text-fg">[:)]</span> PICK
            </button>
          </span>
          <span>
            <button
              onClick={() => setAsciiMode((m) => !m)}
              className={asciiMode ? 'text-fg glow' : 'hover:text-fg'}
              title="auto-convert emoji as you type"
            >
              [ASCII MODE{asciiMode ? ':ON' : ':OFF'}]
            </button>
          </span>
          <span>
            <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAsciiPicker(false); }} className="hover:text-fg">
              <span className="text-fg">[U]</span> UNI
            </button>
          </span>
          <span>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={isRecording ? stopRecording : undefined}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className="hover:text-fg"
            >
              <span className="text-fg">[HOLD]</span> REC
            </button>
          </span>
          <span className="ml-auto text-muted">{text.length} chars</span>
        </div>

        {showEmojiPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowEmojiPicker(false)} />
            <div className="absolute bottom-full right-0 mb-2 z-40">
              <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" width={320} height={400} />
            </div>
          </>
        )}

        {showAsciiPicker && (
          <AsciiEmojiPicker
            onPick={(a) => insertAscii(a)}
            onClose={() => setShowAsciiPicker(false)}
          />
        )}

        {/* Inline ":token" suggestions */}
        {suggest && suggest.items.length > 0 && (
          <div
            className="absolute bottom-full left-8 mb-2 z-40 bg-bg border border-fg min-w-[280px] font-mono text-sm"
            style={{ boxShadow: '0 0 10px var(--c-accent)' }}
          >
            <div className="px-2 py-0.5 border-b border-fg-dim text-[11px] text-fg-dim">
              :{suggest.query}
              <span className="text-fg animate-cursor-blink">_</span>
              <span className="ml-2">↑↓ select · TAB/ENTER insert · ESC close</span>
            </div>
            {suggest.items.map((it, i) => {
              const on = i === suggest.index;
              return (
                <button
                  key={it.e + it.a}
                  onMouseDown={(e) => { e.preventDefault(); applySuggest(it); }}
                  onMouseEnter={() => setSuggest((s) => (s ? { ...s, index: i } : s))}
                  className={`flex w-full items-center gap-3 px-2 py-0.5 text-left ${
                    on ? 'bg-fg !text-bg' : 'text-fg-dim hover:text-fg'
                  }`}
                >
                  <span className={`w-28 whitespace-pre ${on ? '' : 'text-fg'}`}>
                    {it.a}
                  </span>
                  <span className="opacity-70">:{it.n[0]}:</span>
                </button>
              );
            })}
          </div>
        )}

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
      </div>
    </div>
  );
}

export default MessageInput;
