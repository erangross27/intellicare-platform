/**
 * CgmDataDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + sentence-split + array. Collection: cgm_data
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CgmDataDocumentPDFTemplate from '../pdf-templates/CgmDataDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import './CgmDataDocument.css';

const SECTION_FIELDS = {
  device: ['deviceType', 'dataPeriod', 'sensorWearTime', 'readingsPerDay'],
  metrics: ['averageGlucose', 'gmi', 'timeInRange', 'timeBelowRange', 'timeAboveRange', 'coefficientOfVariation'],
  provider: ['date', 'provider', 'facility'],
  findings: ['findings'],
  results: ['results'],
  assessment: ['assessment'],
  plan: ['plan'],
  notes: ['notes'],
  status: ['status'],
  recommendations: ['recommendations'],
};
const FIELD_LABELS = {
  deviceType: 'Device Type', dataPeriod: 'Data Period', sensorWearTime: 'Sensor Wear Time', readingsPerDay: 'Readings/Day',
  averageGlucose: 'Average Glucose', gmi: 'GMI', timeInRange: 'Time in Range', timeBelowRange: 'Time Below Range', timeAboveRange: 'Time Above Range', coefficientOfVariation: 'Coefficient of Variation',
  provider: 'Provider', facility: 'Facility',
  findings: 'Findings', results: 'Results',
  assessment: 'Assessment', plan: 'Plan', notes: 'Notes', status: 'Status',
};
const KEY_OVERRIDES = { ef: 'EF', gmi: 'GMI', hba1c: 'HbA1c', id: 'ID' };
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];
const DATE_FIELDS = ['date'];
const SENTENCE_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan', 'notes']);
const SIMPLE_FIELDS = new Set(['status']);
// Fixed-choice fields edit via dropdown; casing matches the stored value ("active").
const ENUM_FIELDS = { status: ['active', 'not active'] };
// Metric fields whose values are numbers with units ("174 mg/dL", "7.5%", "5% (<70); 1% (<54)"):
// edit the NUMBERS via steppers, units/separators preserved verbatim.
const NUMERIC_UNIT_FIELDS = new Set(['averageGlucose', 'gmi', 'timeInRange', 'timeBelowRange', 'timeAboveRange', 'coefficientOfVariation', 'sensorWearTime', 'readingsPerDay']);
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// "174 mg/dL" -> { nums: ['174'], literals: ['', ' mg/dL'] }; literals.length === nums.length + 1
const parseNumeric = (v) => {
  const s = String(v ?? ''); const nums = []; const literals = []; let last = 0;
  const re = /-?\d+(?:\.\d+)?/g; let m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  literals.push(s.slice(last));
  return { nums, literals };
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.values(v).some(hasVal); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
/* guarded comma split: never inside parentheses; ", and …"/", or …" stays connected (both sides);
   no-space commas ("50,000") kept whole */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0, 10); } catch { return ''; } };
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart conventions (reverse of each save handler):
     "field"               flat string/date/sentence-reconstructed field      → PUT {field}
     "field.<n>" (numeric) array element (handleSaveArrayItem)                 → PUT {field, arrayIndex:<n>}
     "results.<leaf>"      nested object leaf (saveLeaf), trailing seg NON-num → PUT {field:"results.<leaf>"} */
const DRAFT_KEY = 'cgm_dataPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CgmDataDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editNums, setEditNums] = useState([]);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.cgm_data) return Array.isArray(r.cgm_data) ? r.cgm_data : [r.cgm_data];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cgm_data) return Array.isArray(dd.cgm_data) ? dd.cgm_data : [dd.cgm_data]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          // array element: "field.<n>"
          const field = fieldPart.slice(0, lastDot);
          const ek = `${field}-${idx}-${trailing}`;
          nLocal[ek] = value; nPending[ek] = true; nFields[ek] = 'edited';
        } else if (lastDot !== -1) {
          // nested object leaf: "results.<leaf...>" — merge value into the cloned root object
          const root = fieldPart.slice(0, lastDot);
          const path = fieldPart.slice(root.length + 1).split('.');
          const ek = `${root}-${idx}`;
          const cur = nLocal[ek] !== undefined ? nLocal[ek] : record[root];
          const clone = JSON.parse(JSON.stringify(cur ?? {}));
          let node = clone;
          for (let i = 0; i < path.length - 1; i++) { if (typeof node[path[i]] !== 'object' || node[path[i]] === null) node[path[i]] = {}; node = node[path[i]]; }
          node[path[path.length - 1]] = value;
          nLocal[ek] = clone; nPending[ek] = true; nFields[`${root}-${idx}-${path.join('.')}`] = 'edited';
        } else {
          // flat string/date/sentence-reconstructed field
          const ek = `${fieldPart}-${idx}`;
          nLocal[ek] = value; nPending[ek] = true; nFields[ek] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, overrideValue) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CgmData] Cannot save — no record ID'); return; }
    const val = overrideValue !== undefined ? overrideValue : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = val; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a nested-object-leaf DRAFT locally + localStorage. Committed to DB only on Approve.
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CgmData] Cannot save leaf — no record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const ek = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[ek] !== undefined ? prev[ek] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [ek]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][dottedField] = newVal; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  // Save = stage an array-element DRAFT locally + localStorage. Committed to DB only on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CgmData] Cannot save array item — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][`${fn}.${arrayIndex}`] = editValue; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a sentence-edited DRAFT locally + localStorage (full field reconstructed).
  // Committed to DB only on Approve.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CgmData] Cannot save sentence — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); }
    else {
      const newSentences = splitBySentence(editedVal);
      sentences.splice(sentenceIdx, 1, ...newSentences);
      if (newSentences.length > 1) { const extraCount = newSentences.length - 1; setEditedFields(prev => { const n = { ...prev }; n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); }
      else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); }
    }
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = newValue; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    setApproving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record's drafts for fields in this section.
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      const committed = []; // editKeys (local-edit keys) to clear from pendingEdits
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(trailing);
        const baseField = isArrayItem ? fieldPart.slice(0, lastDot) : (lastDot !== -1 ? fieldPart.slice(0, lastDot) : fieldPart);
        if (!sf.includes(baseField)) continue; // belongs to another section
        // Build the PUT payload (reverse of the save handlers). arrayIndex ONLY when trailing is numeric.
        const payload = isArrayItem
          ? { field: baseField, value, arrayIndex: parseInt(trailing, 10) }
          : { field: fieldPart, value }; // flat field OR dotted object leaf (e.g. "results.target")
        const resp = await sc.put(`/api/edit/cgm_data/${rid}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
        // Track the corresponding local-edit key so we can clear its pending flag.
        if (isArrayItem) committed.push(`${baseField}-${idx}-${trailing}`);
        else committed.push(`${baseField}-${idx}`); // dotted leaf shares the root localEdits key
        delete recDrafts[fieldPart];
      }
      await sc.put(`/api/edit/cgm_data/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committed.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (Object.keys(recDrafts).length === 0) delete store[rid]; else store[rid] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CgmData] Approve failed:', err); }
    finally { setApproving(false); }
  }, []);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `CGM Data ${idx + 1}`;
      const allText = [title, formatDate(record.date), ...Object.keys(FIELD_LABELS).map(f => OBJECT_FIELDS.includes(f) ? flattenSearchable(record[f]) : fmtVal(record[f])), ...(Array.isArray(record.recommendations) ? record.recommendations : []), ...Object.values(FIELD_LABELS)].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const enumOpts = ENUM_FIELDS[fn];
    const parsed = NUMERIC_UNIT_FIELDS.has(fn) ? parseNumeric(dv) : null;
    const isNumUnit = !!(parsed && parsed.nums.length > 0);
    const stepAt = (i, dir) => {
      const sv = parseFloat(stepFor(parsed.nums[i])) || 1;
      const dec = (String(sv).split('.')[1] || '').length;
      setEditNums(prev => prev.map((x, xi) => xi === i ? ((isNaN(parseFloat(x)) ? 0 : parseFloat(x)) + dir * sv).toFixed(dec) : x));
    };
    const saveNumUnit = () => {
      if (editNums.some(n => isNaN(parseFloat(n)))) return;
      // rebuild the original string with edited numbers spliced between the verbatim literals
      let out = parsed.literals[0];
      editNums.forEach((n, i) => { out += String(parseFloat(n)) + parsed.literals[i + 1]; });
      handleSaveField(record, fn, idx, sid, out);
    };
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">
      {enumOpts ? (
        <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
          {!enumOpts.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
          {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : isNumUnit ? (
        <div className="num-unit-row">
          {parsed.literals[0] ? <span className="number-edit-unit">{parsed.literals[0]}</span> : null}
          {editNums.map((n, i) => (
            <React.Fragment key={i}>
              <span className="num-seg">
                <button type="button" className="num-step" disabled={saving} onClick={() => stepAt(i, -1)}>−</button>
                <input type="number" step={stepFor(parsed.nums[i])} className="edit-number" value={n} onChange={e => { const v = e.target.value; setEditNums(prev => prev.map((x, xi) => xi === i ? v : x)); }} autoFocus={i === 0} disabled={saving} onKeyDown={e => { if (e.key === 'Enter') saveNumUnit(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={() => stepAt(i, 1)}>+</button>
              </span>
              {parsed.literals[i + 1] ? <span className="number-edit-unit">{parsed.literals[i + 1]}</span> : null}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
      )}
      <div className="edit-actions"><button className="save-btn" onClick={() => { if (isNumUnit) saveNumUnit(); else handleSaveField(record, fn, idx, sid); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); if (NUMERIC_UNIT_FIELDS.has(fn)) { setEditNums(parseNumeric(dv).nums.slice()); setEditValue(''); } else { setEditValue(dv); } }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderDateField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const dv = formatDate(raw);
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey; const ed = editedFields[leafKey];
    if (ie) return (<div key={path[path.length - 1]} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLeaf(record, rootField, path, idx, sid, leafKey, editValue.trim()); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLeaf(record, rootField, path, idx, sid, leafKey, editValue.trim())} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={path[path.length - 1]} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(leafValueString); }}><div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid, showLabel = true) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  // Save one comma-part of one sentence: splice the edited part back, rejoin ', ', rebuild the field.
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CgmData] Cannot save part — no record ID'); return; }
    const sentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const parts = splitByComma(sentences[si] || '');
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    if (parts.length) sentences[si] = parts.join(', '); else sentences.splice(si, 1);
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = newValue; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue]);

  /* sentences split first, then each sentence comma-split (guarded) — every part is its own editable row */
  const renderSentenceSplitField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const sentences = splitBySentence(String(raw));
    if (sentences.length === 0) return null;
    const rows = sentences.flatMap((sentence, si) => splitByComma(sentence).map((part, ci) => ({ part: part.replace(/[.;]+$/, '').trim(), si, ci })));
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {rows.map(({ part, si, ci }) => {
          const sk = `${fn}-${idx}-s${si}-c${ci}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}-${ci}`;
          if (ie) return (<div key={sk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(record, fn, idx, sid, si, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => savePart(record, fn, idx, sid, si, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={sk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: merge only NON-pending element edits.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { device: 'DEVICE & PERIOD', metrics: 'GLUCOSE METRICS', provider: 'PROVIDER INFORMATION', findings: 'FINDINGS', results: 'RESULTS', assessment: 'ASSESSMENT', plan: 'PLAN', notes: 'NOTES', status: 'STATUS', recommendations: 'RECOMMENDATIONS' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    // single-name rule: label == section title → hide the label (title already shown)
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (hasVal(pr[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(pr[fn])}\n\n`; } };
    const addSentenceSplit = (fn) => { if (!hasVal(pr[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; let n = 0; splitBySentence(String(pr[fn])).forEach(s => { splitByComma(s).forEach(p => { text += `${++n}. ${p.replace(/[.;]+$/, '').trim()}\n`; }); }); };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    const addObj = (value, indent) => { Object.entries(value || {}).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { text += `${indent}${humanizeKey(k)}\n${indent}${COPY_LINE_DASH}\n`; if (isScalar(v)) text += `${indent}1. ${fmtScalar(v)}\n\n`; else addObj(v, indent + '  '); }); };
    if (sid === 'recommendations') { addArr('recommendations'); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (OBJECT_FIELDS.includes(fn)) { if (hasVal(pr[fn]) && !isScalar(pr[fn])) addObj(pr[fn], ''); } else if (DATE_FIELDS.includes(fn)) { if (hasVal(pr[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || 'Date'}\n${COPY_LINE_DASH}\n`; text += `1. ${formatDate(pr[fn])}\n\n`; } } else if (SENTENCE_SPLIT_FIELDS.has(fn)) { if (hasVal(pr[fn])) { addSentenceSplit(fn); text += '\n'; } } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CGM DATA\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `CGM Data ${idx + 1}\n${COPY_LINE_EQ}\n`;
      let curTitle = '';
      const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== curTitle.toLowerCase();
      const addF = (fn) => { if (hasVal(r[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } };
      const addSentenceSplit = (fn) => { if (!hasVal(r[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`; let n = 0; splitBySentence(String(r[fn])).forEach(s => { splitByComma(s).forEach(p => { text += `${++n}. ${p.replace(/[.;]+$/, '').trim()}\n`; }); }); text += '\n'; };
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const addObj = (value, indent) => { Object.entries(value || {}).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { text += `${indent}${humanizeKey(k)}\n${indent}${COPY_LINE_DASH}\n`; if (isScalar(v)) text += `${indent}1. ${fmtScalar(v)}\n\n`; else addObj(v, indent + '  '); }); };
      const addObjF = (title, fn) => { if (!hasVal(r[fn]) || isScalar(r[fn])) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; addObj(r[fn], ''); };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { curTitle = title; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (DATE_FIELDS.includes(fn)) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || 'Date'}\n${COPY_LINE_DASH}\n`; text += `1. ${formatDate(r[fn])}\n\n`; } else if (SENTENCE_SPLIT_FIELDS.has(fn)) addSentenceSplit(fn); else addF(fn); }); } };
      simpleFs('DEVICE & PERIOD', SECTION_FIELDS.device);
      simpleFs('GLUCOSE METRICS', SECTION_FIELDS.metrics);
      simpleFs('PROVIDER INFORMATION', SECTION_FIELDS.provider);
      simpleFs('FINDINGS', ['findings']);
      addObjF('RESULTS', 'results');
      simpleFs('ASSESSMENT', ['assessment']);
      simpleFs('PLAN', ['plan']);
      simpleFs('NOTES', ['notes']);
      simpleFs('STATUS', ['status']);
      addArr('RECOMMENDATIONS', 'recommendations');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (OBJECT_FIELDS.includes(f)) return <React.Fragment key={f}>{renderObjectField(record, f, idx, sid, sl)}</React.Fragment>; if (DATE_FIELDS.includes(f)) return <React.Fragment key={f}>{renderDateField(record, f, idx, sid, sl)}</React.Fragment>; if (SENTENCE_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderSentenceSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cgm-data-document"><header className="document-header"><h1 className="document-title">CGM Data</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cgm-data-document">
      <header className="document-header">
        <h1 className="document-title">CGM Data</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CgmDataDocumentPDFTemplate document={pdfData} />} fileName="CGM_Data.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {/* date renders in Provider Information — no duplicate pill here */}
              <div className="record-title-row"><h3 className="record-name">{highlightText(`CGM Data ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'device', 'Device & Period', SECTION_FIELDS.device)}
            {renderMultiFieldSection(record, idx, 'metrics', 'Glucose Metrics', SECTION_FIELDS.metrics)}
            {renderMultiFieldSection(record, idx, 'provider', 'Provider Information', SECTION_FIELDS.provider)}
            {renderMultiFieldSection(record, idx, 'findings', 'Findings', ['findings'])}
            {renderMultiFieldSection(record, idx, 'results', 'Results', ['results'])}
            {renderMultiFieldSection(record, idx, 'assessment', 'Assessment', ['assessment'])}
            {renderMultiFieldSection(record, idx, 'plan', 'Plan', ['plan'])}
            {renderMultiFieldSection(record, idx, 'notes', 'Notes', ['notes'])}
            {renderMultiFieldSection(record, idx, 'status', 'Status', ['status'])}
            {renderArraySection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CgmDataDocument;
