import { create } from 'zustand';

let _seq = 0;

const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * Show a toast.
   *
   * @param {object} input
   * @param {'INFO'|'SUCCESS'|'ERROR'|'WARNING'} [input.type='INFO']
   * @param {string} [input.title]                — optional bold header line
   * @param {string[]} [input.lines]              — body lines (each gets a `> ` prefix)
   * @param {string} [input.message]              — convenience: single body line
   * @param {{key:string,label:string,onClick?:Function}[]} [input.actions]
   * @param {number} [input.duration=5000]        — auto-dismiss after ms; 0 = sticky
   */
  show: (input = {}) => {
    const id = ++_seq;
    const t = {
      id,
      type: (input.type || 'INFO').toUpperCase(),
      title: input.title,
      lines: input.lines || (input.message ? [input.message] : []),
      actions: input.actions,
      duration: input.duration ?? 5000,
      dismissing: false,
    };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration > 0) {
      setTimeout(() => get().dismiss(id), t.duration);
    }
    return id;
  },

  /** Begin dismiss animation. Toast component calls remove() when done. */
  dismiss: (id) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, dismissing: true } : t)),
    })),

  /** Hard-remove (after exit animation finished). */
  remove: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),
}));

export default useToastStore;

// Tiny imperative facade so non-React code can trigger toasts
export function toast(input) { return useToastStore.getState().show(input); }
toast.info    = (input) => toast({ ...input, type: 'INFO'    });
toast.success = (input) => toast({ ...input, type: 'SUCCESS' });
toast.error   = (input) => toast({ ...input, type: 'ERROR'   });
toast.warn    = (input) => toast({ ...input, type: 'WARNING' });
