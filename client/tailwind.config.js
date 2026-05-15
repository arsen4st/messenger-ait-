/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // 768 / 1024 are tailwind defaults (md / lg); add the 480 stop
        xs: '480px',
      },
      fontFamily: {
        // Courier New everywhere, by mandate
        mono: ['"Courier New"', '"Courier"', 'monospace'],
        sans: ['"Courier New"', '"Courier"', 'monospace'],
      },
      colors: {
        // Tokens are sourced from CSS vars (theme-aware)
        fg:      'var(--c-fg)',
        'fg-dim':'var(--c-fg-dim)',
        bg:      'var(--c-bg)',
        card:    'var(--c-card)',
        accent:  'var(--c-accent)',
        muted:   'var(--c-muted)',
        warn:    'var(--c-warn)',
        danger:  'var(--c-danger)',
        info:    'var(--c-info)',
        border:  'var(--c-border)',
      },
      borderRadius: {
        // NO rounding anywhere
        none: '0',
        DEFAULT: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '0',
      },
      animation: {
        'cursor-blink':  'cursor-blink 0.8s steps(2, start) infinite',
        'scanline':      'scanline 6s linear infinite',
        'crt-flicker':   'crt-flicker 10s infinite',
        'spin-ascii':    'spin-ascii 0.6s steps(8) infinite',
        'type-blink':    'type-blink 0.5s steps(2) infinite',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'scanline': {
          '0%':   { transform: 'translateY(-10vh)' },
          '100%': { transform: 'translateY(110vh)' },
        },
        'crt-flicker': {
          '0%, 96%, 100%': { filter: 'brightness(1)' },
          '97%':           { filter: 'brightness(0.92)' },
          '98%':           { filter: 'brightness(1.05)' },
          '99%':           { filter: 'brightness(0.96)' },
        },
        'spin-ascii': {
          '0%, 100%': { content: '"|"' },
          '25%':      { content: '"/"' },
          '50%':      { content: '"-"' },
          '75%':      { content: '"\\\\"' },
        },
        'type-blink': {
          '0%, 50%':   { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
