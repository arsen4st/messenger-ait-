// ASCII / box-drawing frame component.
// Renders true Unicode corners (┌┐└┘) overlaid on top of a 1px border.
// Use the `accent` prop to recolor via inline style (still token-driven).

export function Frame({
  title,
  badge,
  footer,
  className = '',
  innerClassName = '',
  children,
  variant = 'single', // 'single' | 'double' | 'rounded'
}) {
  const corners = variant === 'double'
    ? { tl: '╔', tr: '╗', bl: '╚', br: '╝' }
    : variant === 'rounded'
      ? { tl: '╭', tr: '╮', bl: '╰', br: '╯' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘' };

  return (
    <div className={`tui-box ${className}`}>
      <span className="corner tl">{corners.tl}</span>
      <span className="corner tr">{corners.tr}</span>
      <span className="corner bl">{corners.bl}</span>
      <span className="corner br">{corners.br}</span>

      {title && (
        <div
          className="absolute -top-[0.65em] left-3 px-1 text-[12px] tracking-widest uppercase select-none z-[2]"
          style={{ background: 'var(--c-bg)', color: 'var(--c-fg)' }}
        >
          ─ {title} ─
        </div>
      )}

      {badge && (
        <div
          className="absolute -top-[0.65em] right-3 px-1 text-[11px] select-none z-[2]"
          style={{ background: 'var(--c-bg)', color: 'var(--c-fg-dim)' }}
        >
          ─ {badge} ─
        </div>
      )}

      {footer && (
        <div
          className="absolute -bottom-[0.65em] left-3 px-1 text-[11px] select-none z-[2]"
          style={{ background: 'var(--c-bg)', color: 'var(--c-fg-dim)' }}
        >
          ─ {footer} ─
        </div>
      )}

      <div className={innerClassName}>{children}</div>
    </div>
  );
}

// Inline horizontal divider — ─────── LABEL ───────
export function Divider({ label, className = '' }) {
  if (!label) {
    return (
      <div className={`overflow-hidden whitespace-nowrap select-none dim ${className}`}>
        {'─'.repeat(200)}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 select-none dim ${className}`}>
      <span>──</span>
      <span className="text-[11px] tracking-widest uppercase" style={{ color: 'var(--c-fg)' }}>{label}</span>
      <span className="flex-1 overflow-hidden whitespace-nowrap">{'─'.repeat(200)}</span>
    </div>
  );
}
