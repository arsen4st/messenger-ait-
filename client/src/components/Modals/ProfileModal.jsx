import { useState, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import useUIStore from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import { getSocket } from '../../socket';
import api from '../../api';
import { Frame, Divider } from '../tui/Frame';

function ProfileModal() {
  const { activeModal, closeModal } = useUIStore();
  const { user, updateUser, logout } = useAuthStore();
  const { setActiveChat, addChat } = useChatStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const isOpen = activeModal === 'profile';

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', { display_name: displayName, bio });
      updateUser({ display_name: displayName, bio });
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAvatarUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', f);
      const r = await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ avatar: r.data.user.avatar });
    } catch (err) { console.error(err); }
    finally { setUploadingAvatar(false); }
  };

  const handleEmojiSelect = async (data) => {
    try {
      await api.patch('/users/me', { emoji_avatar: data.emoji });
      updateUser({ emoji_avatar: data.emoji });
      setShowEmojiPicker(false);
    } catch (err) { console.error(err); }
  };

  const getAvatarUrl = (a) => !a ? null : a.startsWith('http') ? a : a;

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6" onClick={closeModal}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Frame
          title="user.profile"
          badge={`@${user.username}`}
          footer="s=save · esc=close · q=logout"
          accent="phosphor"
          innerClassName="p-4 space-y-3"
        >
          {/* Avatar */}
          <div className="flex items-start gap-4">
            <div className="border border-fg bg-card w-24 h-24 flex items-center justify-center overflow-hidden flex-shrink-0">
              {uploadingAvatar ? (
                <span className="text-fg animate-cursor-blink">›</span>
              ) : user.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-fg glow text-3xl">
                  {user.emoji_avatar || user.display_name[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="text-fg-dim">
                <span className="text-fg">$</span> user_id: <span className="text-fg">{user.id?.slice(0, 12)}...</span>
              </div>
              <div className="text-fg-dim">
                <span className="text-fg">$</span> username: <span className="text-fg">@{user.username}</span>
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                <button onClick={() => fileInputRef.current?.click()} className="btn-tui">upload</button>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="btn-tui">emoji</button>
                {user.avatar && (
                  <button
                    onClick={async () => { await api.patch('/users/me', { avatar: null }); updateUser({ avatar: null }); }}
                    className="btn-tui hover:!text-danger"
                  >
                    remove
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              {showEmojiPicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowEmojiPicker(false)} />
                  <div className="absolute z-40">
                    <EmojiPicker onEmojiClick={handleEmojiSelect} theme="dark" width={280} height={360} />
                  </div>
                </>
              )}
            </div>
          </div>

          <Divider accent="text" />

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg mb-1">› display_name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="field px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg mb-1">› bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="// optional"
                className="field px-2 py-1.5 text-sm resize-none"
              />
              <div className="text-muted text-[10px] mt-0.5 text-right">{bio.length}/200</div>
            </div>
          </div>

          <Divider accent="text" />

          <div className="space-y-1">
            <button
              onClick={async () => {
                try {
                  const r = await api.get('/chats/saved');
                  addChat(r.data.chat);
                  setActiveChat(r.data.chat);
                  const s = getSocket();
                  if (s) s.emit('join_chat', { chatId: r.data.chat.id });
                  closeModal();
                } catch (err) { console.error(err); }
              }}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-card text-fg flex items-center gap-2"
            >
              <span className="text-warn">★</span> open saved messages
            </button>
            <button
              onClick={logout}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-card text-danger flex items-center gap-2"
            >
              <span>⏻</span> logout
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-solid flex-1 justify-center disabled:opacity-50">
              {saving ? '... saving' : '› save'}
            </button>
            <button onClick={closeModal} className="btn-tui hover:!text-fg">cancel</button>
          </div>
        </Frame>
      </div>
    </div>
  );
}

export default ProfileModal;
