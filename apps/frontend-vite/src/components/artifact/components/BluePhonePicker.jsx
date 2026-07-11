/**
 * BluePhonePicker.jsx — themed US phone-number picker.
 * Companion to BlueDatePicker / BlueTimePicker / BlueMonthPicker / BlueDiplotypePicker; for phone-number
 * fields whose value is a US phone "(AAA) PPP-LLLL" (e.g. "(602) 555-0482"). Three numeric segments —
 * area (3) / prefix (3) / line (4) — laid out as "( ___ ) ___-____", with a live formatted result line.
 * Controlled: `value` is the phone string, `onChange(str)` fires with the recomposed "(AAA) PPP-LLLL".
 * Edit-widget-only + SSR-safe (no Date/window; only ever rendered in edit mode).
 */
import React from 'react';
import './BluePhonePicker.css';

/* "(602) 555-0482" / "6025550482" / "+1 602-555-0482" -> { area, prefix, line } (digits only, ≤10). */
const parsePhone = (value) => {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);  // drop a US country code
  return { area: d.slice(0, 3), prefix: d.slice(3, 6), line: d.slice(6, 10) };
};

/* Recompose to "(AAA) PPP-LLLL", degrading gracefully while segments are only partially filled. */
const compose = ({ area, prefix, line }) => {
  let s = '';
  if (area) s += `(${area})`;
  if (prefix) s += (s ? ' ' : '') + prefix;
  if (line) s += (prefix ? '-' : (s ? ' ' : '')) + line;
  return s;
};

const BluePhonePicker = ({ value, onChange }) => {
  const parts = parsePhone(value);
  const setSeg = (key, max) => (e) =>
    onChange(compose({ ...parts, [key]: e.target.value.replace(/\D/g, '').slice(0, max) }));

  return (
    <div className="blue-phone-picker">
      <div className="bpp-row">
        <span className="bpp-sep">(</span>
        <input type="text" inputMode="numeric" className="bpp-seg bpp-area" value={parts.area}
          placeholder="602" maxLength={3} autoFocus aria-label="Area code" onChange={setSeg('area', 3)} />
        <span className="bpp-sep">)</span>
        <input type="text" inputMode="numeric" className="bpp-seg bpp-prefix" value={parts.prefix}
          placeholder="555" maxLength={3} aria-label="Prefix" onChange={setSeg('prefix', 3)} />
        <span className="bpp-sep bpp-dash">-</span>
        <input type="text" inputMode="numeric" className="bpp-seg bpp-line" value={parts.line}
          placeholder="0000" maxLength={4} aria-label="Line number" onChange={setSeg('line', 4)} />
      </div>
      <div className="bpp-result">result: <strong>{compose(parts) || '—'}</strong></div>
    </div>
  );
};

export default BluePhonePicker;
