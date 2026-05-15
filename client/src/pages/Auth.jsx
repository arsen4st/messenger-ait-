import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import useAuthStore from '../store/authStore';
import { Frame, Divider } from '../components/tui/Frame';
import ThemeToggle from '../components/tui/ThemeToggle';
import { matrixRain, typewriter } from '../utils/ascii';

const LOGO = `
   █████╗ ██╗   ██╗██████╗  ██████╗ ██████╗  █████╗
  ██╔══██╗██║   ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗
  ███████║██║   ██║██████╔╝██║   ██║██████╔╝███████║
  ██╔══██║██║   ██║██╔══██╗██║   ██║██╔══██╗██╔══██║
  ██║  ██║╚██████╔╝██║  ██║╚██████╔╝██║  ██║██║  ██║
  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
`;

function Auth() {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    username: '', password: '', display_name: '', confirm_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.username || !formData.password) return 'Username and password required';
    if (formData.username.length < 3 || formData.username.length > 20) return 'Username must be 3-20 chars';
    if (formData.password.length < 6) return 'Password must be at least 6 chars';
    if (mode === 'register') {
      if (!formData.display_name) return 'Display name required';
      if (formData.password !== formData.confirm_password) return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { username: formData.username, password: formData.password }
        : { username: formData.username, password: formData.password, display_name: formData.display_name };
      const response = await api.post(endpoint, payload);
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'connection refused');
    } finally {
      setLoading(false);
    }
  };

  // matrix rain background
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const stop = matrixRain(canvasRef.current, { fontSize: 14, fps: 22 });
    return stop;
  }, []);

  // typewriter subtitle
  const subtitleRef = useRef(null);
  useEffect(() => {
    if (!subtitleRef.current) return;
    const stop = typewriter(
      subtitleRef.current,
      '── encrypted messaging terminal ──',
      35,
      { caret: false }
    );
    return stop;
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Matrix rain canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
      />

      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-3">
        {/* ASCII Logo */}
        <pre className="text-fg text-[10px] sm:text-[12px] leading-tight text-center glow select-none">{LOGO}</pre>

        <div
          ref={subtitleRef}
          className="text-center text-fg-dim text-xs tracking-[0.4em] uppercase min-h-[1.2em]"
        />
        <div className="text-center text-muted text-[10px]">
          ▸ system ready · awaiting credentials
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-3 text-sm pt-2">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`btn-tui ${mode === 'login' ? '!text-fg glow' : ''}`}
          >
            login
          </button>
          <span className="text-muted self-center">·</span>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`btn-tui ${mode === 'register' ? '!text-fg glow' : ''}`}
          >
            register
          </button>
        </div>

        {/* Form Frame */}
        <Frame
          title={mode === 'login' ? 'auth::login' : 'auth::register'}
          badge={`mode=${mode}`}
          footer="esc=cancel · enter=submit"
          accent="phosphor"
          className="mt-6"
          innerClassName="p-6 space-y-4"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="agent_42"
              autoFocus
            />

            {mode === 'register' && (
              <Field
                label="display_name"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                placeholder="Agent 42"
              />
            )}

            <Field
              label="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-fg-dim hover:text-fg text-xs"
                >
                  [{showPassword ? 'hide' : 'show'}]
                </button>
              }
            />

            {mode === 'register' && (
              <Field
                label="confirm"
                name="confirm_password"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            )}

            {error && (
              <div className="text-danger text-xs flex items-start gap-2 py-1">
                <span className="text-danger">!</span>
                <span>error: {error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-solid disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> processing
                  </span>
                ) : (
                  <span>{mode === 'login' ? '› authenticate' : '› create_account'}</span>
                )}
              </button>
              <span className="text-muted text-xs">[press enter]</span>
            </div>
          </form>
        </Frame>

        <div className="text-center text-muted text-[11px] mt-6 space-y-1">
          <div>aurora v1.0.0 · build {new Date().toISOString().slice(0,10)}</div>
          <div>made with &lt;3 and box-drawing characters</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, placeholder, type = 'text', autoFocus, rightSlot }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-1 text-xs">
        <span className="text-info">›</span>
        <span className="text-fg-dim">{label}</span>
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-fg select-none">$</span>
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className="field pl-7 pr-16 text-sm"
        />
        {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
      </div>
    </div>
  );
}

function Spinner() {
  const [idx, setIdx] = useState(0);
  const frames = ['|', '/', '-', '\\'];
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % frames.length), 100);
    return () => clearInterval(id);
  }, []);
  return <span className="text-fg inline-block w-3">{frames[idx]}</span>;
}

export default Auth;
