import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  typingUsers: {},
  onlineUsers: new Set(),

  setChats: (chats) => set({ chats }),

  initOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),

  updateMessagesReadCount: (chatId, messageIds) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      const idSet = new Set(messageIds);
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map(msg =>
            idSet.has(msg.id) ? { ...msg, read_count: (msg.read_count || 0) + 1 } : msg
          )
        }
      };
    });
  },

  addChat: (chat) => {
    set((state) => {
      // Check if chat already exists
      const exists = state.chats.some(c => c.id === chat.id);
      if (exists) {
        return state;
      }
      return { chats: [chat, ...state.chats] };
    });
  },

  setActiveChat: (chat) => set({ activeChat: chat }),

  addMessage: (chatId, message) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: [...chatMessages, message]
        }
      };
    });
  },

  replaceTempMessage: (chatId, tempId, realMessage) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map(msg => msg.id === tempId ? realMessage : msg)
        }
      };
    });
  },

  prependMessages: (chatId, messages) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: [...messages, ...chatMessages]
        }
      };
    });
  },

  setMessages: (chatId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: messages
      }
    }));
  },

  updateMessage: (chatId, updatedMessage) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((msg) =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          )
        }
      };
    });
  },

  deleteMessage: (chatId, messageId) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.filter((msg) => msg.id !== messageId)
        }
      };
    });
  },

  setTyping: (chatId, userId, isTyping) => {
    set((state) => {
      const chatTyping = state.typingUsers[chatId] || [];
      let newTyping;

      if (isTyping) {
        newTyping = chatTyping.includes(userId) ? chatTyping : [...chatTyping, userId];
      } else {
        newTyping = chatTyping.filter((id) => id !== userId);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [chatId]: newTyping
        }
      };
    });
  },

  setUserOnline: (userId) => {
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.add(userId);
      return { onlineUsers: newOnlineUsers };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.delete(userId);
      return { onlineUsers: newOnlineUsers };
    });
  },

  updateUnread: (chatId, count) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unread_count: count } : chat
      )
    }));
  },

  markChatRead: (chatId) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unread_count: 0 } : chat
      )
    }));
  },

  updateChatLastMessage: (chatId, message) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              last_message: {
                id: message.id,
                type: message.type,
                content: message.content,
                sender_id: message.sender_id,
                sender_name: message.sender?.display_name,
                created_at: message.created_at
              }
            }
          : chat
      )
    }));
  },

  addReaction: (chatId, messageId, reaction) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((msg) => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || [];
              return { ...msg, reactions: [...reactions, reaction] };
            }
            return msg;
          })
        }
      };
    });
  },

  removeReaction: (chatId, messageId, userId, emoji) => {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((msg) => {
            if (msg.id === messageId) {
              const reactions = (msg.reactions || []).filter(
                (r) => !(r.user_id === userId && r.emoji === emoji)
              );
              return { ...msg, reactions };
            }
            return msg;
          })
        }
      };
    });
  }
}));

export default useChatStore;
