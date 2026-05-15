import { create } from 'zustand';

/**
 * Screen-transition manager.
 *
 * One entry point for every screen change:
 *
 *   import { transition } from '../store/transitionStore';
 *   transition('wipe',  () => uiStore.setModal('settings'));
 *   transition('clear', () => openCall());
 *   transition('glitch', () => showError());
 *
 * The callback is invoked at the *midpoint* of the animation — when the
 * screen is fully covered — so the underlying DOM swap is hidden. The
 * <ScreenTransition /> overlay (rendered once in App.jsx) reads this store
 * and plays the matching animation.
 *
 * Types:
 *   'wipe'   — block chars sweep in left→right, then retreat the other way.
 *   'clear'  — terminal-style scroll of random junk, then new screen drops in.
 *   'glitch' — 3 frames of █▓ corruption, then a hard cut.
 */
const useTransitionStore = create((set, get) => ({
  type: null, // 'wipe' | 'clear' | 'glitch' | null
  phase: 'idle', // 'idle' | 'cover' | 'reveal'
  callback: null,
  token: 0, // bumps each run so the overlay can re-key its animation

  /**
   * Start a transition.
   * @param {'wipe'|'clear'|'glitch'} type
   * @param {() => void} [callback] run while the screen is fully covered
   */
  transition: (type = 'wipe', callback = null) => {
    // Re-entrant calls (transition fired mid-transition): don't stack
    // overlays — just run the swap so the app stays consistent.
    if (get().phase !== 'idle') {
      callback?.();
      return;
    }
    set((s) => ({
      type: ['wipe', 'clear', 'glitch'].includes(type) ? type : 'wipe',
      phase: 'cover',
      callback,
      token: s.token + 1,
    }));
  },

  // ── internal: driven by <ScreenTransition /> ──────────────────
  _runCallback: () => {
    const cb = get().callback;
    set({ callback: null });
    cb?.();
  },

  _setPhase: (phase) => set({ phase }),

  _end: () => set({ type: null, phase: 'idle', callback: null }),
}));

/** Imperative helper — usable outside React components. */
export const transition = (type, cb) =>
  useTransitionStore.getState().transition(type, cb);

export default useTransitionStore;
