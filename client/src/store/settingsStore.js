import { create } from 'zustand';
import useThemeStore, { THEME_LABEL } from './themeStore';

const STORAGE_KEY = 'messenger-settings';

// COLOR_THEME label (settings) ↔ themeStore name
const THEME_NAME = { GREEN: 'matrix', AMBER: 'amber', WHITE: 'white', CYAN: 'cyan' };

/* Default config — mirrors a ~/.messengerrc dotfile. */
const DEFAULTS = {
  // [profile]
  STATUS_MESSAGE: 'online // do not disturb',
  AUTO_REPLY: 'OFF',
  // [display]
  ASCII_DENSITY: 'HIGH',
  SCAN_LINES: 'ON',
  CRT_FLICKER: 'ON',
  COLOR_THEME: 'GREEN',
  GLOW_LEVEL: 6,
  // [security]
  READ_RECEIPTS: 'ON',
  TYPING_SIGNAL: 'ON',
  E2E_ENCRYPTION: 'ON',
  AUTO_LOCK_MIN: 15,
  // [network]
  RECONNECT: 'ON',
  SYNC_INTERVAL: 30,
  MESH_NODES: 3,
  RELAY_HOST: 'node-34.mesh.net',
};

function load() {
  let cfg = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cfg = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  // themeStore (status-bar switcher) is the source of truth for the
  // active theme — mirror it into COLOR_THEME so they never disagree.
  cfg.COLOR_THEME = THEME_LABEL[useThemeStore.getState().theme] || 'GREEN';
  return cfg;
}

/* Apply the settings that have a real visual effect. */
function applyEffects(v) {
  const el = document.documentElement;
  el.setAttribute('data-scanlines', v.SCAN_LINES === 'ON' ? 'on' : 'off');
  el.setAttribute('data-crt', v.CRT_FLICKER === 'ON' ? 'on' : 'off');
  el.style.setProperty('--glow-blur', `${v.GLOW_LEVEL}px`);
  el.setAttribute('data-density', String(v.ASCII_DENSITY).toLowerCase());
  // COLOR_THEME bridges to the theme store (GREEN/AMBER/WHITE/CYAN)
  useThemeStore.getState().setTheme(THEME_NAME[v.COLOR_THEME] || 'matrix');
}

const useSettingsStore = create((set, get) => ({
  // committed (saved) values
  saved: load(),
  // working copy shown in the editor
  draft: load(),
  lastModified:
    (() => {
      try {
        return localStorage.getItem(STORAGE_KEY + ':mtime') || '2024-01-15 14:22:11';
      } catch {
        return '2024-01-15 14:22:11';
      }
    })(),

  /** True if any field differs from the saved config. */
  isDirty: () => {
    const { saved, draft } = get();
    return Object.keys(draft).some((k) => draft[k] !== saved[k]);
  },

  /** True if a single field differs from saved. */
  isFieldDirty: (key) => get().draft[key] !== get().saved[key],

  /** Edit one field in the working copy (applies live visual effects). */
  setDraft: (key, value) =>
    set((s) => {
      const draft = { ...s.draft, [key]: value };
      applyEffects(draft);
      return { draft };
    }),

  /** Discard edits and revert visuals to the saved config. */
  revert: () =>
    set((s) => {
      applyEffects(s.saved);
      return { draft: { ...s.saved } };
    }),

  /** Commit the working copy to localStorage. */
  save: () =>
    set((s) => {
      const mtime = new Date()
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, '');
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s.draft));
        localStorage.setItem(STORAGE_KEY + ':mtime', mtime);
      } catch {}
      applyEffects(s.draft);
      return { saved: { ...s.draft }, lastModified: mtime };
    }),
}));

// Apply persisted settings on first import (before first paint).
applyEffects(useSettingsStore.getState().saved);

export default useSettingsStore;
