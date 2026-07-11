/**
 * BlueDiplotypePicker.jsx — themed CYP450 star-allele DIPLOTYPE picker.
 * Companion to BlueDatePicker / BlueTimePicker / BlueMonthPicker; for pharmacogenomic genotype fields whose
 * value is a star-allele diplotype "*A/*B" with an optional copy-number multiplier "xN" (gene duplication),
 * e.g. "*1/*1x3", "*2/*2", "*1/*2". Two allele dropdowns (common star alleles + Other…) joined by "/",
 * each with a −/+ copy-number stepper. Controlled: `value` is the diplotype string, `onChange(str)` fires
 * with the recomposed "*A/*B(xN)". SSR-safe (no Date/window; only ever rendered in edit mode).
 *
 * NOTE: only for PURE star-allele genes (CYP2D6/2C19/2C9/3A4/3A5/2B6/2C8/DPYD/TPMT/NUDT15). rs-notation genes
 * (VKORC1 "-1639G>A", SLCO1B1 "521T>C") and phenotype/status strings are NOT diplotypes — keep those as text.
 */
import React, { useState } from 'react';
import './BlueDiplotypePicker.css';

const COMMON_ALLELES = ['*1', '*2', '*3', '*4', '*5', '*6', '*7', '*9', '*10', '*17', '*41'];
const OTHER = '__other__';

/* "*1x3" -> { allele:'*1', copies:3 }; "*1" -> { allele:'*1', copies:1 }; tolerates "*1F", "1x2", "" */
const parseAllele = (raw) => {
  const t = String(raw || '').trim();
  if (!t) return { allele: '*1', copies: 1 };
  const m = t.match(/^(\*?[0-9A-Za-z.]+?)(?:x(\d+))?$/i);
  if (!m) return { allele: t.startsWith('*') ? t : `*${t}`, copies: 1 };
  let allele = m[1];
  if (!allele.startsWith('*')) allele = `*${allele}`;
  return { allele, copies: m[2] ? Math.max(1, parseInt(m[2], 10)) : 1 };
};

/* "*1/*1x3" -> [{allele,copies}, {allele,copies}] (mirrors a lone allele to both sides) */
const parseDiplotype = (value) => {
  const parts = String(value || '').split('/');
  const left = parseAllele(parts[0] || '*1');
  const right = parseAllele(parts[1] !== undefined && parts[1] !== '' ? parts[1] : (parts[0] || '*1'));
  return [left, right];
};

const composeAllele = (a) => `${a.allele}${a.copies > 1 ? `x${a.copies}` : ''}`;
const compose = (l, r) => `${composeAllele(l)}/${composeAllele(r)}`;

const alleleOptions = (cur) => {
  const opts = [...COMMON_ALLELES];
  if (cur && !opts.includes(cur)) opts.unshift(cur);
  return opts;
};

const BlueDiplotypePicker = ({ value, onChange }) => {
  const [left, right] = parseDiplotype(value);
  const [custom, setCustom] = useState({ left: false, right: false });

  const emit = (nl, nr) => onChange(compose(nl, nr));
  const setAllele = (side, allele) => (side === 'left' ? emit({ ...left, allele }, right) : emit(left, { ...right, allele }));
  const setCopies = (side, copies) => {
    const c = Math.max(1, copies);
    return side === 'left' ? emit({ ...left, copies: c }, right) : emit(left, { ...right, copies: c });
  };

  const renderSide = (side, a) => {
    const isCustom = custom[side];
    const opts = alleleOptions(a.allele);
    return (
      <div className="bdp-allele">
        <div className="bdp-allele-label">Allele {side === 'left' ? '1' : '2'}</div>
        {isCustom ? (
          <input
            type="text"
            className="bdp-custom-input"
            value={a.allele}
            placeholder="*1"
            autoFocus
            onChange={(e) => setAllele(side, e.target.value.trim())}
          />
        ) : (
          <select
            className="bdp-select"
            value={opts.includes(a.allele) ? a.allele : OTHER}
            onChange={(e) => {
              if (e.target.value === OTHER) setCustom((s) => ({ ...s, [side]: true }));
              else setAllele(side, e.target.value);
            }}
          >
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value={OTHER}>Other…</option>
          </select>
        )}
        <div className="bdp-copies-label">copies</div>
        <div className="bdp-stepper">
          <button type="button" className="bdp-step" onClick={() => setCopies(side, a.copies - 1)} disabled={a.copies <= 1}>−</button>
          <span className="bdp-copies">{a.copies}</span>
          <button type="button" className="bdp-step" onClick={() => setCopies(side, a.copies + 1)}>+</button>
        </div>
      </div>
    );
  };

  return (
    <div className="blue-diplotype-picker">
      <div className="bdp-row">
        {renderSide('left', left)}
        <div className="bdp-slash">/</div>
        {renderSide('right', right)}
      </div>
      <div className="bdp-result">result: <strong>{compose(left, right)}</strong></div>
    </div>
  );
};

export default BlueDiplotypePicker;
