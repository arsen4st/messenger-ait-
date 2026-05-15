import { useState } from 'react';
import { ASCII_EMOJI } from '../../utils/asciiEmoji';
import { keyClick } from '../../utils/sound';

/**
 * Popup grid of every ASCII emoji alternative.
 *
 *   ┌─[ASCII EMOJI]──────────────────────┐
 *   │ <3   :D   :'(  >:(  \o/  [+1] ...   │
 *   └────────────────────────────────────┘
 *
 * @param {(ascii:string)=>void} onPick   inserts the chosen ASCII
 * @param {()=>void}             onClose
 */
export default function AsciiEmojiPicker({ onPick, onClose }) {
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const list = query
    ? ASCII_EMOJI.filter(
        (it) =>
          it.n.some((name) => name.includes(query)) ||
          it.a.toLowerCase().includes(query)
      )
    : ASCII_EMOJI;

  return (
    <>
      {/* click-away */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div
        className="absolute bottom-full right-0 mb-2 z-40 bg-bg border border-fg w-[420px] font-mono"
        style={{ boxShadow: '0 0 12px var(--c-accent)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* title bar */}
        <div className="flex items-center px-2 py-1 border-b border-fg-dim text-xs">
          <span className="text-fg-dim">┌─</span>
          <span className="px-1 text-fg glow tracking-widest">[ASCII EMOJI]</span>
          <span className="flex-1 text-fg-dim overflow-hidden whitespace-nowrap">
            {'─'.repeat(200)}
          </span>
          <button onClick={onClose} className="ml-1 text-fg-dim hover:text-danger">
            [X]
          </button>
        </div>

        {/* filter */}
        <div className="px-2 py-1 border-b border-fg-dim flex items-center gap-2 text-xs">
          <span className="text-fg select-none">/</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter (name or glyph)"
            className="flex-1 bg-transparent text-fg placeholder:text-muted outline-none"
          />
          <span className="text-fg-dim">{list.length}</span>
        </div>

        {/* grid */}
        <div className="p-2 max-h-[240px] overflow-y-auto tty-scroll flex flex-wrap gap-1">
          {list.length === 0 && (
            <div className="text-muted text-xs px-1 py-2">// no matches</div>
          )}
          {list.map((it) => (
            <button
              key={it.e + it.a}
              title={`${it.e}  :${it.n[0]}:`}
              onClick={() => {
                keyClick();
                onPick(it.a);
              }}
              className="px-2 py-1 text-sm text-fg border border-fg-dim hover:bg-fg hover:!text-bg whitespace-pre transition-none"
            >
              {it.a}
            </button>
          ))}
        </div>

        <div className="px-2 py-1 border-t border-fg-dim text-[11px] text-fg-dim">
          click to insert · type <span className="text-fg">:name</span> in the box
          for inline suggestions · <span className="text-fg">[F2]</span> converts
          unicode emoji
        </div>
      </div>
    </>
  );
}
