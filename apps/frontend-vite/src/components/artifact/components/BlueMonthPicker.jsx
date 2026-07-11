/**
 * BlueMonthPicker.jsx — custom dark-blue MONTH picker (year stepper + 12-month grid).
 * Companion to BlueDatePicker/BlueTimePicker; for MONTH-granularity fields (EDD, LMP) whose values are
 * month + year with NO day ("January 2026"). Controlled: `value` is any month-ish string, `onSelect(str)`
 * fires with a "Month YYYY" string (e.g. "January 2026"). Theme matches the blue-glow templates.
 * SSR-safe: new Date() runs only in event handlers / at first render inside edit mode (never in view mode).
 */
import React, { useState } from 'react';
import './BlueMonthPicker.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ABBR = MONTHS.map(m => m.slice(0, 3));

/* Seed from any month-ish string: "January 2026" / "2025-11-22" / "Approximately October 2026 (based on...)". */
const parseMonthValue = (v) => {
  const s = String(v || '');
  let m = null;
  const nm = new RegExp(`\\b(${MONTHS.join('|')}|${ABBR.join('|')})\\b`, 'i').exec(s);
  if (nm) { const t = nm[1].toLowerCase(); let i = MONTHS.findIndex(x => x.toLowerCase() === t); if (i === -1) i = ABBR.findIndex(x => x.toLowerCase() === t); if (i >= 0) m = i; }
  const iso = /(\d{4})-(\d{2})\b/.exec(s);
  let y = null;
  if (iso) { y = +iso[1]; if (m === null) m = Math.min(11, Math.max(0, +iso[2] - 1)); }
  else { const yr = /\b(?:19|20)\d{2}\b/.exec(s); if (yr) y = +yr[0]; }
  return { y, m };
};

const BlueMonthPicker = ({ value, onSelect }) => {
  const parsed = parseMonthValue(value);
  const now = new Date();
  const [viewY, setViewY] = useState(parsed.y || now.getFullYear());
  const selM = parsed.m;
  const isSelected = (i) => selM === i && parsed.y === viewY;
  const isThisMonth = (i) => now.getFullYear() === viewY && now.getMonth() === i;
  const selectedLabel = (selM !== null) ? `${MONTHS[selM]} ${parsed.y ?? viewY}` : 'No month selected';

  return (
    <div className="blue-month-picker">
      <div className="bmp-header">
        <button type="button" className="bmp-nav" title="Previous year" onClick={() => setViewY(y => y - 1)}>‹</button>
        <div className="bmp-title">{viewY}</div>
        <button type="button" className="bmp-nav" title="Next year" onClick={() => setViewY(y => y + 1)}>›</button>
      </div>
      <div className="bmp-grid">
        {MONTHS.map((mo, i) => (
          <button type="button" key={mo} className={`bmp-month${isSelected(i) ? ' selected' : ''}${isThisMonth(i) ? ' today' : ''}`} onClick={() => onSelect(`${MONTHS[i]} ${viewY}`)}>{ABBR[i]}</button>
        ))}
      </div>
      <div className="bmp-footer">
        <span className="bmp-selected">{selectedLabel}</span>
        <button type="button" className="bmp-today-btn" onClick={() => { setViewY(now.getFullYear()); onSelect(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`); }}>This Month</button>
      </div>
    </div>
  );
};

export default BlueMonthPicker;
