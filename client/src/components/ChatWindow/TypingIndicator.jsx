import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import useTypingDots from '../../hooks/useTypingDots';

function TypingIndicator() {
  const { activeChat, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const dots = useTypingDots();

  if (!activeChat) return null;
  const ids = typingUsers[activeChat.id] || [];
  const members = activeChat.members?.filter(
    (m) => ids.includes(m.id) && m.id !== user.id
  ) || [];

  if (members.length === 0) return null;

  const name = (members.length === 1
    ? members[0].display_name
    : members.length === 2
    ? `${members[0].display_name}+${members[1].display_name}`
    : `${members.length} people`
  ).toUpperCase();

  return (
    <div className="px-6 pb-1 text-xs text-fg-dim font-mono flex items-center gap-1">
      <span className="text-fg">{name}</span>
      <span>&gt;</span>
      <span className="text-fg-dim w-[3ch]">{dots}</span>
      <span className="text-fg animate-cursor-blink">█</span>
    </div>
  );
}

export default TypingIndicator;
