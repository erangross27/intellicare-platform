/**
 * BlueDatePicker.jsx — custom dark-blue date picker (compact single-row layout).
 * Companion to BlueTimePicker; replaces native <input type="date"> in template edit mode so the
 * whole widget can be themed. Controlled: `value` is 'YYYY-MM-DD' (or ''), `onSelect(iso)` fires
 * with the ISO day string on every step / manual edit / Today. Theme matches the blue-glow templates.
 *
 * Layout: one horizontal row that fills the edit-row width (mirrors BlueTimePicker) —
 *   [−] Mon [+]   [−] DD [+]   [−] YYYY [+]      Today
 * Each Mon/DD/YYYY cell is a TYPEABLE input (type a month name or 1–12, a day, a year) AND has
 * −/+ steppers — no calendar grid, minimal height. A typed value commits on Enter/blur (Esc cancels).
 * When `value` is empty the cells seed to today for display but do NOT emit until the user acts.
 */
import React, { useState } from 'react';
import './BlueDatePicker.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const parseISO = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const clampDay = (y, m, d) => Math.min(Math.max(1, d), daysIn(y, m));

// parse a typed month: a number 1–12, or a name / prefix ('feb', 'February') → 0-based index, else null
const parseMonth = (s) => {
  const t = String(s).trim().toLowerCase();
  if (!t) return null;
  if (/^\d+$/.test(t)) { const n = +t; return n >= 1 && n <= 12 ? n - 1 : null; }
  const i = MONTHS_FULL.findIndex((full, idx) => full.startsWith(t) || MONTHS[idx].toLowerCase() === t);
  return i >= 0 ? i : null;
};

const BlueDatePicker = ({ value, onSelect }) => {
  const sel = parseISO(value);
  // seed to today when no value yet (a stepper always shows a concrete date; render stays pure)
  const base = sel || (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; })();
  const { y, m, d } = base;

  const [editing, setEditing] = useState(null); // 'm' | 'd' | 'y' — which cell is being typed
  const [draft, setDraft] = useState('');

  // clamp the day to the target month's length (Jan 31 → Feb → 28/29)
  const emit = (ny, nm, nd) => onSelect(toISO(ny, nm, clampDay(ny, nm, nd)));

  // −/+ steppers
  const stepMonth = (delta) => { let nm = m + delta, ny = y; if (nm < 0) { nm = 11; ny -= 1; } if (nm > 11) { nm = 0; ny += 1; } emit(ny, nm, d); };
  const stepDay = (delta) => { const dim = daysIn(y, m); let nd = d + delta; if (nd < 1) nd = dim; if (nd > dim) nd = 1; emit(y, m, nd); };
  const stepYear = (delta) => emit(y + delta, m, d);
  const setToday = () => { const n = new Date(); onSelect(toISO(n.getFullYear(), n.getMonth(), n.getDate())); };

  // manual entry — commit a typed cell (ignores unparseable input, keeping the prior value)
  const commit = (segKey) => {
    if (segKey === 'm') { const nm = parseMonth(draft); if (nm != null) emit(y, nm, d); }
    else if (segKey === 'd') { const nd = parseInt(draft, 10); if (!Number.isNaN(nd)) emit(y, m, nd); }
    else if (segKey === 'y') { const ny = parseInt(draft, 10); if (!Number.isNaN(ny) && ny >= 1 && ny <= 9999) emit(ny, m, d); }
    setEditing(null); setDraft('');
  };
  const onKeyDown = (segKey) => (e) => {
    if (e.key === 'Enter') { commit(segKey); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { setEditing(null); setDraft(''); e.currentTarget.blur(); }
  };

  const cell = (segKey, display, extraClass, title) => (
    <input
      type="text"
      className={`bdp-num bdp-input ${extraClass}`.trim()}
      inputMode={segKey === 'm' ? 'text' : 'numeric'}
      title={title}
      value={editing === segKey ? draft : String(display)}
      onFocus={() => { setEditing(segKey); setDraft(String(display)); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(segKey)}
      onKeyDown={onKeyDown(segKey)}
    />
  );

  return (
    <div className="blue-date-picker">
      <div className="bdp-unit">
        <button type="button" className="bdp-step" title="Month −" onClick={() => stepMonth(-1)}>−</button>
        {cell('m', MONTHS[m], 'bdp-mon', 'Type a month name or 1–12')}
        <button type="button" className="bdp-step" title="Month +" onClick={() => stepMonth(1)}>+</button>
      </div>
      <div className="bdp-unit">
        <button type="button" className="bdp-step" title="Day −" onClick={() => stepDay(-1)}>−</button>
        {cell('d', pad2(d), '', 'Type a day')}
        <button type="button" className="bdp-step" title="Day +" onClick={() => stepDay(1)}>+</button>
      </div>
      <div className="bdp-unit">
        <button type="button" className="bdp-step" title="Year −" onClick={() => stepYear(-1)}>−</button>
        {cell('y', y, 'bdp-year', 'Type a year')}
        <button type="button" className="bdp-step" title="Year +" onClick={() => stepYear(1)}>+</button>
      </div>

      <button type="button" className="bdp-today-btn" onClick={setToday}>Today</button>
    </div>
  );
};

export default BlueDatePicker;
