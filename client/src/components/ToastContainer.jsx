import { useEffect, useRef, useState } from 'react';
import useToastStore from '../store/toastStore';
import { typewriter } from '../utils/ascii';

const TOAST_COLORS = {
  INFO: '#00aa44',
  SUCCESS: '#00ff44',
  ERROR: '#ff3300',
  WARNING: '#ff8800',
};

const TOAST_LABELS = {
  INFO: 'INFO',
  SUCCESS: 'OK',
  ERROR: 'ERR',
  WARNING: 'WARN',
};

function Toast({ id, type, title, lines, onDismiss }) {
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const abortTypewriterRef = useRef(null);

  const color = TOAST_COLORS[type] || TOAST_COLORS.INFO;
  const label = TOAST_LABELS[type] || TOAST_LABELS.INFO;

  // Entrance animation: frame expands, then typewriter
  useEffect(() => {
    if (!contentRef.current) return;

    // Wait for frame expansion (CSS animation ~300ms)
    const timer = setTimeout(() => {
      setIsEntering(false);
      const bodyLines = (lines || []).map(l => `> ${l}`).join('\n');
      const fullText = title
        ? `> ${title}\n${bodyLines}\n${'─'.repeat(26)}\n[ESC: DISMISS]`
        : `${bodyLines}\n${'─'.repeat(26)}\n[ESC: DISMISS]`;
      abortTypewriterRef.current = typewriter(contentRef.current, fullText, 15);
    }, 320);

    return () => {
      clearTimeout(timer);
      if (abortTypewriterRef.current) abortTypewriterRef.current();
    };
  }, [title, lines]);

  // Handle dismiss
  const handleDismiss = () => {
    if (isExiting) return;
    setIsExiting(true);

    // Reverse typewriter: erase text character by character
    if (contentRef.current) {
      const text = contentRef.current.textContent;
      let i = text.length;
      const eraseInterval = setInterval(() => {
        if (i <= 0) {
          clearInterval(eraseInterval);
          // Then collapse frame
          setTimeout(() => onDismiss(id), 200);
          return;
        }
        contentRef.current.textContent = text.slice(0, i);
        i--;
      }, 8);
    } else {
      setTimeout(() => onDismiss(id), 200);
    }
  };

  // ESC to dismiss
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExiting]);

  return (
    <div
      ref={frameRef}
      className={`toast-item ${isEntering ? 'toast-entering' : ''} ${isExiting ? 'toast-exiting' : ''}`}
      style={{ '--toast-color': color }}
      onClick={handleDismiss}
    >
      {/* Corners */}
      <span className={`toast-corner tl ${type === 'ERROR' ? 'toast-corner-blink' : ''}`}>╔</span>
      <span className={`toast-corner tr ${type === 'ERROR' ? 'toast-corner-blink' : ''}`}>╗</span>
      <span className="toast-corner bl">╚</span>
      <span className="toast-corner br">╝</span>

      {/* Top border with label */}
      <div className="toast-border-top">
        ══[{label}]{'═'.repeat(Math.max(0, 20 - label.length))}
      </div>

      {/* Content */}
      <div className="toast-content">
        <pre ref={contentRef} className="toast-text" />
      </div>

      {/* Bottom border */}
      <div className="toast-border-bottom">
        {'═'.repeat(26)}
      </div>

      {/* Side borders */}
      <span className="toast-border-left">║</span>
      <span className="toast-border-right">║</span>
    </div>
  );
}

function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          lines={toast.lines}
          onDismiss={remove}
        />
      ))}
    </div>
  );
}

export default ToastContainer;
