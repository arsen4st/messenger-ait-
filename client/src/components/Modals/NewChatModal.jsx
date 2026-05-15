import { useState } from 'react';
import useUIStore from '../../store/uiStore';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../socket';
import api from '../../api';
import { Frame } from '../tui/Frame';

function NewChatModal() {
  const { activeModal, closeModal } = useUIStore();
  const { setActiveChat, setChats, chats } = useChatStore();
  const { user } = useAuthStore();
  const [tab, setTab] = useState('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const isOpen = activeModal === 'newChat';

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try { setSearchResults((await api.get(`/users/search?q=${encodeURIComponent(q)}`)).data.users || []); }
    catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  const handleCreateDirect = async (target) => {
    setCreating(true);
    try {
      const res = await api.post('/chats/direct', { userId: target.id });
      const newChat = res.data.chat;
      if (!chats.find((c) => c.id === newChat.id)) setChats([newChat, ...chats]);
      const s = getSocket();
      if (s) s.emit('join_chat', { chatId: newChat.id });
      setActiveChat(newChat);
      closeModal();
    } catch (err) { alert(err.response?.data?.error || 'failed'); }
    finally { setCreating(false); }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setCreating(true);
    try {
      const res = await api.post('/chats/group', {
        name: groupName, description: groupDescription,
        memberIds: selectedMembers.map((m) => m.id)
      });
      const newChat = res.data.chat;
      setChats([newChat, ...chats]);
      const s = getSocket();
      if (s) s.emit('join_chat', { chatId: newChat.id });
      setActiveChat(newChat);
      closeModal();
    } catch (err) { alert(err.response?.data?.error || 'failed'); }
    finally { setCreating(false); }
  };

  const handleCreateChannel = async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/chats/channel', { name: groupName, description: groupDescription });
      const newChat = res.data.chat;
      setChats([newChat, ...chats]);
      const s = getSocket();
      if (s) s.emit('join_chat', { chatId: newChat.id });
      setActiveChat(newChat);
      closeModal();
    } catch (err) { alert(err.response?.data?.error || 'failed'); }
    finally { setCreating(false); }
  };

  const toggleMember = (u) => {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === u.id) ? prev.filter((m) => m.id !== u.id) : [...prev, u]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6" onClick={closeModal}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Frame
          title="new_conversation"
          badge={`mode=${tab}`}
          footer="enter=create · esc=cancel"
          accent="cyan"
          innerClassName="p-4 space-y-3"
        >
          {/* Tabs */}
          <div className="flex gap-3 text-xs">
            {['direct', 'group', 'channel'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`btn-tui ${tab === t ? '!text-fg glow' : ''}`}
              >
                {t}
              </button>
            ))}
            <button onClick={closeModal} className="btn-tui hover:!text-danger ml-auto">esc</button>
          </div>

          {tab === 'direct' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 border border-fg-dim bg-card px-2">
                <span className="text-info">/</span>
                <input
                  type="text"
                  placeholder="find_user..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm py-1.5 outline-none placeholder:text-muted"
                  autoFocus
                />
              </div>

              <div className="max-h-[50vh] overflow-y-auto scrollbar-thin space-y-px">
                {searching ? (
                  <div className="py-4 text-center text-muted text-xs">
                    <span className="text-fg animate-cursor-blink">›</span> searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleCreateDirect(r)}
                      disabled={creating}
                      className="w-full text-left px-2 py-1.5 hover:bg-card text-sm flex items-center gap-2"
                    >
                      <span className="text-muted">○</span>
                      <span className="text-fg">{r.display_name}</span>
                      <span className="text-muted text-xs">@{r.username}</span>
                      <span className="ml-auto text-info text-xs">[connect]</span>
                    </button>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <div className="py-4 text-center text-muted text-xs">no_users_found</div>
                ) : (
                  <div className="py-4 text-center text-muted text-xs">
                    type ≥ 2 chars to search
                  </div>
                )}
              </div>
            </div>
          )}

          {(tab === 'group' || tab === 'channel') && (
            <div className="space-y-3">
              <Field label="name" value={groupName} onChange={setGroupName} placeholder={`${tab}_name`} />
              <Field label="description" value={groupDescription} onChange={setGroupDescription} placeholder="optional..." multiline />

              {tab === 'group' && (
                <div>
                  <div className="text-xs text-info mb-1">› members</div>
                  <div className="flex items-center gap-2 border border-fg-dim bg-card px-2 mb-2">
                    <span className="text-info">/</span>
                    <input
                      type="text"
                      placeholder="add_users..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm py-1.5 outline-none placeholder:text-muted"
                    />
                  </div>

                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 text-xs">
                      {selectedMembers.map((m) => (
                        <span key={m.id} className="border border-fg text-fg px-1.5">
                          {m.display_name}
                          <button onClick={() => toggleMember(m)} className="ml-1 hover:text-danger">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-px">
                      {searchResults.map((r) => {
                        const selected = !!selectedMembers.find((m) => m.id === r.id);
                        return (
                          <button
                            key={r.id}
                            onClick={() => toggleMember(r)}
                            className={`w-full text-left px-2 py-1 text-sm flex items-center gap-2 ${
                              selected ? 'bg-fg/10 text-fg' : 'hover:bg-card text-fg'
                            }`}
                          >
                            <span>{selected ? '[x]' : '[ ]'}</span>
                            <span>{r.display_name}</span>
                            <span className="text-muted text-xs">@{r.username}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={tab === 'group' ? handleCreateGroup : handleCreateChannel}
                disabled={creating || !groupName.trim()}
                className="btn-solid w-full justify-center disabled:opacity-50"
              >
                {creating ? '... creating' : `› create_${tab}`}
              </button>
            </div>
          )}
        </Frame>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <div>
      <label className="block text-xs text-info mb-1">› {label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="field px-2 py-1.5 text-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

export default NewChatModal;
