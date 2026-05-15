import { create } from 'zustand';

const useUIStore = create((set) => ({
  theme: 'dark',
  sidebarWidth: 360,
  activeModal: null,
  replyTo: null,
  editMessage: null,

  setModal: (name) => set({ activeModal: name }),

  closeModal: () => set({ activeModal: null }),

  setReplyTo: (message) => set({ replyTo: message }),

  clearReplyTo: () => set({ replyTo: null }),

  setEditMessage: (message) => set({ editMessage: message }),

  clearEditMessage: () => set({ editMessage: null }),

  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return { theme: newTheme };
    });
  },

  setSidebarWidth: (width) => set({ sidebarWidth: width })
}));

export default useUIStore;
