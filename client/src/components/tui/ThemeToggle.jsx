import useThemeStore from '../../store/themeStore';

function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <button
      onClick={toggleTheme}
      className={`btn-bracket text-xs ${className}`}
      title={`switch to ${theme === 'matrix' ? 'amber' : 'matrix'} crt`}
    >
      {theme === 'matrix' ? '◉ matrix' : '◉ amber'}
    </button>
  );
}

export default ThemeToggle;
