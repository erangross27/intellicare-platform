/**
 * BlueTimePicker.jsx — custom dark-blue time picker (compact single-row layout).
 * Companion to BlueDatePicker; replaces the time half of a native datetime-local / time input so the
 * whole widget can be themed. Controlled: `value` is 'HH:mm' (24-hour, or ''), `onChange(hhmm)` fires
 * with a zero-padded 24-hour 'HH:mm' on every step. Theme matches the blue-glow templates.
 *
 * Layout: one horizontal row that fills the edit-row width —
 *   [−] HH [+]  :  [−] MM [+]      [ AM | PM ]      Now
 * The HH/MM cells double as the display (no separate big time line), keeping the height minimal.
 */
import React from 'react';
import './BlueTimePicker.css';

const pad2 = (n) => String(n).padStart(2, '0');
const parseHM = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
  if (!m) return { h: 0, min: 0 };
  return { h: Math.min(23, +m[1]), min: Math.min(59, +m[2]) };
};

const BlueTimePicker = ({ value, onChange }) => {
  const { h, min } = parseHM(value);
  const mer = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;

  const to24 = (nh12, m) => (m === 'AM' ? nh12 % 12 : (nh12 % 12) + 12);
  const emit = (nh24, nmin) => onChange(`${pad2(nh24)}:${pad2(nmin)}`);

  const stepHour = (d) => { let nh = h12 + d; if (nh > 12) nh = 1; if (nh < 1) nh = 12; emit(to24(nh, mer), min); };
  const stepMin = (d) => { let nm = min + d; if (nm > 59) nm = 0; if (nm < 0) nm = 59; emit(h, nm); };
  const setMer = (m) => { if (m !== mer) emit(to24(h12, m), min); };
  const setNow = () => { const d = new Date(); emit(d.getHours(), d.getMinutes()); };

  return (
    <div className="blue-time-picker">
      <div className="btp-time">
        <div className="btp-unit">
          <button type="button" className="btp-step" title="Hour −" onClick={() => stepHour(-1)}>−</button>
          <span className="btp-num">{pad2(h12)}</span>
          <button type="button" className="btp-step" title="Hour +" onClick={() => stepHour(1)}>+</button>
        </div>
        <span className="btp-colon">:</span>
        <div className="btp-unit">
          <button type="button" className="btp-step" title="Minute −" onClick={() => stepMin(-1)}>−</button>
          <span className="btp-num">{pad2(min)}</span>
          <button type="button" className="btp-step" title="Minute +" onClick={() => stepMin(1)}>+</button>
        </div>
      </div>

      <div className="btp-mer-toggle" role="group" aria-label="AM or PM">
        <button type="button" className={`btp-mer ${mer === 'AM' ? 'active' : ''}`} onClick={() => setMer('AM')}>AM</button>
        <button type="button" className={`btp-mer ${mer === 'PM' ? 'active' : ''}`} onClick={() => setMer('PM')}>PM</button>
      </div>

      <button type="button" className="btp-now-btn" onClick={setNow}>Now</button>
    </div>
  );
};

export default BlueTimePicker;
