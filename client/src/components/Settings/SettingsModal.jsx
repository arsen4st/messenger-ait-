import { useEffect, useState } from 'react';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';
import { beep, chirpUp } from '../../utils/sound';
import { Toggle, Slider, Dropdown, TextInput, NumberStepper } from './controls';

/* Config schema → drives the right-hand content area. */
const SECTIONS = [
  {
    id: 'profile',
    label: 'Profile',
    fields: [
      { key: 'STATUS_MESSAGE', type: 'text', width: 26 },
      { key: 'AUTO_REPLY', type: 'toggle' },
    ],
  },
  {
    id: 'display',
    label: 'Display',
    fields: [
      {
        key: 'ASCII_DENSITY',
        type: 'dropdown',
        options: ['LOW', 'MED', 'HIGH', 'ULTRA'],
        hint: '(░▒▓█)',
      },
      { key: 'SCAN_LINES', type: 'toggle' },
      { key: 'CRT_FLICKER', type: 'toggle' },
      {
        key: 'COLOR_THEME',
        type: 'dropdown',
        options: ['GREEN', 'AMBER', 'WHITE', 'CYAN'],
        dots: true,
      },
      { key: 'GLOW_LEVEL', type: 'slider', min: 0, max: 12 },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    fields: [
      { key: 'READ_RECEIPTS', type: 'toggle' },
      { key: 'TYPING_SIGNAL', type: 'toggle' },
      { key: 'E2E_ENCRYPTION', type: 'toggle' },
      { key: 'AUTO_LOCK_MIN', type: 'number', min: 0, max: 120, step: 5 },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    fields: [
      { key: 'RECONNECT', type: 'toggle' },
      { key: 'SYNC_INTERVAL', type: 'number', min: 5, max: 300, step: 5 },
      { key: 'MESH_NODES', type: 'number', min: 1, max: 9, step: 1 },
      { key: 'RELAY_HOST', type: 'text', width: 24 },
    ],
  },
  { id: 'about', label: 'About', fields: [] },
];

function Field({ field, draft, dirty, setDraft }) {
  const val = draft[field.key];
  let control = null;
  switch (field.type) {
    case 'toggle':
      control = <Toggle value={val} onChange={(v) => setDraft(field.key, v)} />;
      break;
    case 'slider':
      control = (
        <Slider
          value={val}
          min={field.min}
          max={field.max}
          onChange={(v) => setDraft(field.key, v)}
        />
      );
      break;
    case 'dropdown':
      control = (
        <Dropdown
          value={val}
          options={field.options}
          hint={
            field.dots
              ? field.options.map((o) => (o === val ? '●' : '○')).join('')
              : field.hint
          }
          onChange={(v) => setDraft(field.key, v)}
        />
      );
      break;
    case 'number':
      control = (
        <NumberStepper
          value={val}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(v) => setDraft(field.key, v)}
        />
      );
      break;
    case 'text':
    default:
      control = (
        <TextInput
          value={String(val)}
          width={field.width}
          onChange={(v) => setDraft(field.key, v)}
        />
      );
  }

  return (
    <div
      className={`flex items-center gap-3 px-2 py-1 ${
        dirty ? 'bg-accent' : ''
      }`}
    >
      <span
        className={`whitespace-pre ${dirty ? 'text-fg glow' : 'text-fg-dim'}`}
      >
        {field.key.padEnd(16)} =
      </span>
      <span className="text-sm">{control}</span>
      {dirty && (
        <span className="ml-auto text-warn text-[11px] animate-cursor-blink select-none">
          [MODIFIED]
        </span>
      )}
    </div>
  );
}

function SaveAnimation({ onDone }) {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let p = 0;
    beep({ frequency: 220, duration: 80, volume: 0.1, type: 'square' });
    const id = setInterval(() => {
      p = Math.min(100, p + 7 + ((Math.random() * 6) | 0));
      setPct(p);
      if (p >= 100) {
        clearInterval(id);
        setDone(true);
        chirpUp();
        setTimeout(onDone, 700);
      }
    }, 55);
    return () => clearInterval(id);
  }, [onDone]);

  const cells = 20;
  const filled = Math.round((pct / 100) * cells);

  return (
    <div className="absolute inset-0 z-[70] bg-bg/95 flex items-center justify-center font-mono text-sm">
      <pre className="text-fg glow leading-relaxed">
        {`> Writing ~/.messengerrc...\n`}
        {`> [`}
        <span className="text-fg">{'█'.repeat(filled)}</span>
        <span className="text-fg-dim">{'░'.repeat(cells - filled)}</span>
        {`] ${String(pct).padStart(3)}%\n`}
        {done ? (
          <span className="text-fg glow">{`> Settings saved.`}</span>
        ) : (
          <span className="text-fg-dim">{`> flushing buffer...`}</span>
        )}
        {done && <span className="animate-cursor-blink"> █</span>}
      </pre>
    </div>
  );
}

export default function SettingsModal() {
  const { activeModal, closeModal } = useUIStore();
  const { draft, saved, lastModified, setDraft, save, revert, isDirty, isFieldDirty } =
    useSettingsStore();
  const [active, setActive] = useState('display');
  const [writing, setWriting] = useState(false);

  const isOpen = activeModal === 'settings';
  const dirty = isOpen && isDirty();

  const handleClose = () => {
    revert(); // discard unsaved edits + restore visuals
    closeModal();
  };

  const handleSave = () => {
    if (!isDirty()) return;
    setWriting(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || dirty)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dirty]);

  if (!isOpen) return null;

  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4 font-mono"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-bg border-[3px] border-double border-fg"
        style={{ boxShadow: '0 0 16px var(--c-accent)' }}
      >
        {/* ═══ TITLE BAR ═══ */}
        <div className="px-4 py-2 border-b border-fg-dim">
          <div className="flex items-center">
            <span className="text-fg-dim">╔════</span>
            <span className="px-2 text-fg glow tracking-[0.3em]">SETTINGS</span>
            <span className="flex-1 text-fg-dim overflow-hidden whitespace-nowrap">
              {'═'.repeat(200)}
            </span>
            <button
              onClick={handleClose}
              className="ml-2 text-fg-dim hover:text-danger"
              title="esc"
            >
              [X]
            </button>
          </div>
          <div className="text-[11px] text-fg-dim mt-1 leading-relaxed">
            <div>
              <span className="text-fg">&gt;</span> config file:{' '}
              <span className="text-fg">~/.messengerrc</span>
            </div>
            <div>
              <span className="text-fg">&gt;</span> last modified:{' '}
              <span className="text-fg">{lastModified}</span>
              {dirty && (
                <span className="text-warn ml-3 animate-cursor-blink">
                  ● unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BODY: NAV ║ CONTENT ═══ */}
        <div className="flex min-h-[340px]">
          {/* NAVIGATION */}
          <nav className="w-[180px] border-r border-fg-dim py-2 select-none">
            <div className="px-3 text-[11px] text-fg-dim mb-1 tracking-widest">
              [NAVIGATION]
            </div>
            {SECTIONS.map((s) => {
              const on = s.id === active;
              const secDirty = s.fields.some((f) => isFieldDirty(f.key));
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`block w-full text-left px-3 py-1 text-sm whitespace-pre ${
                    on
                      ? 'bg-fg !text-bg'
                      : 'text-fg-dim hover:text-fg hover:bg-card'
                  }`}
                >
                  {on ? '> ' : '  '}
                  {s.label}
                  {secDirty && !on && <span className="text-warn"> *</span>}
                </button>
              );
            })}
          </nav>

          {/* CONTENT AREA */}
          <div className="flex-1 p-3 min-w-0">
            <div className="text-[11px] text-fg-dim tracking-widest mb-1">
              [CONTENT AREA]
            </div>
            <div className="text-fg glow text-sm">
              SECTION: {section.label.toUpperCase()}
            </div>
            <div className="text-fg-dim overflow-hidden whitespace-nowrap mb-2">
              {'─'.repeat(200)}
            </div>

            {section.id === 'about' ? (
              <pre className="text-fg-dim text-xs leading-relaxed">
                {`  MESSENGER v2.4.1  (build 20240115)
  ─────────────────────────────────────
  protocol      = mesh/p2p e2e
  license       = MIT
  source        = github.com/messenger
  uptime        = 13:37:42
  ─────────────────────────────────────
  "stay in the terminal."`}
              </pre>
            ) : (
              <div className="space-y-0.5">
                {section.fields.map((f) => (
                  <Field
                    key={f.key}
                    field={f}
                    draft={draft}
                    dirty={isFieldDirty(f.key)}
                    setDraft={setDraft}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ FOOTER: SAVE ═══ */}
        <div className="border-t border-fg-dim px-4 py-3 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={`relative px-1 ${
              dirty
                ? 'text-fg cursor-pointer'
                : 'text-fg-dim cursor-not-allowed opacity-50'
            }`}
          >
            <pre className={`leading-tight ${dirty ? 'glow' : ''}`}>
              {`╔══════════════════════╗
║ [ENTER] SAVE CHANGES ║
╚══════════════════════╝`}
            </pre>
          </button>
          <button
            onClick={() => revert()}
            disabled={!dirty}
            className="btn-tui disabled:opacity-40 disabled:cursor-not-allowed"
          >
            revert
          </button>
          <span className="ml-auto text-[11px] text-fg-dim">
            esc=close · ↑↓/drag=adjust · click=toggle
          </span>
        </div>

        {writing && (
          <SaveAnimation
            onDone={() => {
              save();
              setWriting(false);
              closeModal();
            }}
          />
        )}
      </div>
    </div>
  );
}
