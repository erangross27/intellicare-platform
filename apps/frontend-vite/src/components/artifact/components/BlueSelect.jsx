/**
 * BlueSelect.jsx — custom dark-blue dropdown (listbox).
 * Replaces the native <select> in template edit mode: the browser/OS popup for <select> is native
 * chrome (an NSMenu on macOS) that ignores CSS `direction`, so on an RTL OS (e.g. Hebrew) it opens
 * right-aligned. This renders its own absolutely-positioned option list that we fully control → always
 * LTR / left-aligned, and themed to match the blue-glow templates (#0F1B33 / #60a5fa / #93c5fd).
 * Controlled: `value` is the current string, `options` a string[], `onChange(value)` fires on pick.
 * SSR-safe (no window/Date at module load; the click-outside listener is attached only in useEffect).
 */
import React, { useState, useRef, useEffect } from 'react';
import './BlueSelect.css';

const BlueSelect = ({ value, options = [], onChange, placeholder = 'Select…' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const pick = (opt) => { onChange?.(opt); setOpen(false); };

  return (
    <div className="blue-select" ref={ref}>
      <button
        type="button"
        className="blue-select-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      >
        <span className="blue-select-value">{value || placeholder}</span>
        <span className="blue-select-caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="blue-select-list" role="listbox">
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={`blue-select-option${opt === value ? ' selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); pick(opt); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BlueSelect;
