import { create } from 'zustand';

const STORAGE_KEY = 'aurora-theme';

// Order is the cycle order for the status-bar switcher.
export const THEMES = ['matrix', 'amber', 'white', 'cyan'];
export const THEME_LABEL = {
  matrix: 'GREEN',
  amber: 'AMBER',
  white: 'WHITE',
  cyan: 'CYAN',
};

function getInitialTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(t)) return t;
  } catch {}
  return 'matrix';
}

const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    if (!THEMES.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    set({ theme });
  },
  /** Advance to the next theme in THEMES (wraps). */
  cycleTheme: () => {
    const i = THEMES.indexOf(get().theme);
    get().setTheme(THEMES[(i + 1) % THEMES.length]);
  },
  // kept for backwards compat (Sidebar/ThemeToggle older callers)
  toggleTheme: () => get().cycleTheme(),
}));

// Sync on first import
document.documentElement.setAttribute('data-theme', getInitialTheme());

export default useThemeStore;
