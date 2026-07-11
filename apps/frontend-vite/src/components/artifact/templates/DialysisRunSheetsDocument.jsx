/**
 * DialysisRunSheetsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dialysis_run_sheets
 *
 * 9 Sections:
 *   1. weight-fluid: patientWeight, dryWeight, fluidRemovalGoal, actualFluidRemoval
 *   2. treatment-params: treatmentTime, bloodFlowRate, dialysateFlowRate, heparinDose
 *   3. blood-pressure: preDialysisBP, postDialysisBP
 *   4. adequacy: ktVRatio, ureaReductionRatio, clearanceGoal
 *   5. access-section: vascularAccessType, accessThrill (bool), accessBruit (bool), accessRecirculation
 *   6. dialysate-section: dialyzerType, dialysateBath (comma-split string), conductivity
 *   7. pressures-section: transmembranePressure, venousPressure, arterialPressure
 *   8. machine-info: machineNumber
 *   9. complications-section: complications[] (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DialysisRunSheetsDocumentPDFTemplate from '../pdf-templates/DialysisRunSheetsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DialysisRunSheetsDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'weight-fluid': 'Weight & Fluid',
  'treatment-params': 'Treatment Parameters',
  'blood-pressure': 'Blood Pressure',
  'adequacy': 'Adequacy',
  'access-section': 'Access',
  'dialysate-section': 'Dialysate',
  'pressures-section': 'Pressures',
  'machine-info': 'Machine Info',
  'complications-section': 'Complications',
};

const FIELD_LABELS = {
  patientWeight: 'Patient Weight (kg)',
  dryWeight: 'Dry Weight (kg)',
  fluidRemovalGoal: 'Fluid Removal Goal (mL)',
  actualFluidRemoval: 'Actual Fluid Removal (mL)',
  treatmentTime: 'Treatment Time (min)',
  bloodFlowRate: 'Blood Flow Rate (mL/min)',
  dialysateFlowRate: 'Dialysate Flow Rate (mL/min)',
  heparinDose: 'Heparin Dose (units)',
  preDialysisBP: 'Pre-Dialysis BP',
  postDialysisBP: 'Post-Dialysis BP',
  ktVRatio: 'Kt/V Ratio',
  ureaReductionRatio: 'Urea Reduction Ratio (%)',
  clearanceGoal: 'Clearance Goal',
  vascularAccessType: 'Vascular Access Type',
  accessThrill: 'Access Thrill',
  accessBruit: 'Access Bruit',
  accessRecirculation: 'Access Recirculation (%)',
  dialyzerType: 'Dialyzer Type',
  dialysateBath: 'Dialysate Bath',
  conductivity: 'Conductivity',
  transmembranePressure: 'Transmembrane Pressure (mmHg)',
  venousPressure: 'Venous Pressure (mmHg)',
  arterialPressure: 'Arterial Pressure (mmHg)',
  machineNumber: 'Machine Number',
  complications: 'Complications',
};

const SECTION_FIELDS = {
  'weight-fluid': ['patientWeight', 'dryWeight', 'fluidRemovalGoal', 'actualFluidRemoval'],
  'treatment-params': ['treatmentTime', 'bloodFlowRate', 'dialysateFlowRate', 'heparinDose'],
  'blood-pressure': ['preDialysisBP', 'postDialysisBP'],
  'adequacy': ['ktVRatio', 'ureaReductionRatio', 'clearanceGoal'],
  'access-section': ['vascularAccessType', 'accessThrill', 'accessBruit', 'accessRecirculation'],
  'dialysate-section': ['dialyzerType', 'dialysateBath', 'conductivity'],
  'pressures-section': ['transmembranePressure', 'venousPressure', 'arterialPressure'],
  'machine-info': ['machineNumber'],
  'complications-section': ['complications'],
};

const NUMBER_FIELDS = [
  'patientWeight', 'dryWeight', 'fluidRemovalGoal', 'actualFluidRemoval',
  'treatmentTime', 'bloodFlowRate', 'dialysateFlowRate', 'heparinDose',
  'ktVRatio', 'ureaReductionRatio', 'clearanceGoal',
  'conductivity', 'transmembranePressure', 'venousPressure', 'arterialPressure',
  'accessRecirculation',
];
const BOOLEAN_FIELDS = ['accessThrill', 'accessBruit'];
const ARRAY_FIELDS = ['complications'];
const COMMA_SPLIT_FIELDS = ['dialysateBath'];

/* ENUM_FIELDS: known clinical dropdown (standing "act like a medical professional" directive).
   vascularAccessType — full canonical scale; a lowercase-stored value ("arteriovenous fistula")
   displays/edits as the canonical title-case ("Arteriovenous Fistula") in all 4 areas. dialyzerType
   (device model) + machineNumber (machine ID) stay free text. */
const ENUM_FIELDS = {
  vascularAccessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
};
const enumCanonical = (options, current) => {
  const c = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === c.toLowerCase());
  return hit || c;
};
const enumOptionsWith = (options, current) => {
  const canon = enumCanonical(options, current);
  return options.includes(canon) ? options : [canon, ...options];
};
const enumDisplay = (fn, val) => (ENUM_FIELDS[fn] ? enumCanonical(ENUM_FIELDS[fn], val) : String(val ?? ''));

/* NEGATIVE_OK_FIELDS: numeric fields that are legitimately negative — arterial (pre-pump) pressure
   in hemodialysis is a suction/negative value (e.g. -200 mmHg). The −/+ stepper must NOT clamp these
   at 0; every other numeric clamps >= 0. */
const NEGATIVE_OK_FIELDS = new Set(['arterialPressure']);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   values by 0.1, two-decimal by 0.01. The customer TYPES the exact value; we NEVER impose a fixed
   measurement increment (dose/time/flow) unless medically certain (STANDING user directive, July 5 2026). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a real clinical value, not a "not recorded" sentinel.
   - accessRecirculation: 0% recirculation is ideal/normal.
   - heparinDose: 0 units = heparin-free dialysis (a real prescription).
   All other NUMBER_FIELDS (weights, volumes, times, flow rates, pressures, conductivity, Kt/V, URR,
   clearanceGoal) are physiologically non-zero during a real treatment, so 0 is a sentinel -> hidden. */
const MEANINGFUL_ZERO_FIELDS = new Set(['accessRecirculation', 'heparinDose']);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dialysisRunSheetsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* splitByComma: parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ COMPONENT ═══════ */
const DialysisRunSheetsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.dialysis_run_sheets) return Array.isArray(r.dialysis_run_sheets) ? r.dialysis_run_sheets : [r.dialysis_run_sheets];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_run_sheets) return Array.isArray(dd.dialysis_run_sheets) ? dd.dialysis_run_sheets : [dd.dialysis_run_sheets]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft store shape: { [recordId]: { [fieldPart]: value } } where fieldPart is "field" (string/array
     value) or "field.arrayIndex" (single array element). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        if (dotIdx !== -1 && /^\d+$/.test(trailing)) {
          // single array element draft → merge into the effective array under "field-idx"
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(trailing, 10);
          const editKey = `${fn}-${idx}`;
          const base = nLocal[editKey] !== undefined ? nLocal[editKey] : (Array.isArray(record[fn]) ? [...record[fn]] : []);
          base[arrIdx] = value;
          nLocal[editKey] = base;
          nPending[editKey] = true;
          nFields[`${fn}-${idx}-a${arrIdx}`] = 'edited';
        } else {
          const fn = fieldPart;
          const editKey = `${fn}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          if (COMMA_SPLIT_FIELDS.includes(fn)) nSentences[`${fn}-${idx}-c0`] = 'edited';
          else nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  /* fieldHasVal: like hasVal, but for NUMBER_FIELDS not in MEANINGFUL_ZERO_FIELDS a value of 0 is a "not recorded" sentinel and is hidden. */
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.has(fn) && typeof v === 'number' && v === 0) return false;
    return hasVal(v);
  }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  /* −/+ stepper: nudge editValue by the field's step, rounded to 2 decimals. Clamped >= 0 except for
     NEGATIVE_OK_FIELDS (arterial pressure is a negative suction value). */
  const stepEditValue = (fn, dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const stepStr = stepFor(prev);
      const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat(((isNaN(n) ? 0 : n) + dir * step).toFixed(decimals));
      if (next < 0 && !NEGATIVE_OK_FIELDS.has(fn)) next = 0;
      return String(next);
    });
  };

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = ARRAY_FIELDS.includes(f) ? getEffectiveArray(record, f, 0) : getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = ARRAY_FIELDS.includes(fn) ? getEffectiveArray(record, fn, idx) : getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dialysis Run Sheet ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = ARRAY_FIELDS.includes(f) ? getEffectiveArray(record, f, idx) : getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (String(item).toLowerCase().includes(phrase)) return true;
            }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally (single array element) + persist to localStorage. Committed on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue.trim();
    const currentArr = [...(getEffectiveArray(record, fn, idx) || [])];
    currentArr[arrIdx] = saveVal;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrIdx}`]: 'edited' }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrIdx}`] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  /* saveCommaItem: for dialysateBath comma-split string */
  const saveCommaItem = useCallback(async (record, fn, idx, commaIdx) => {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    if (subParts.length > 1) {
      items.splice(commaIdx, 1, ...subParts);
    } else {
      items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim();
    }
    const fullText = items.join(', ');
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const marks = { [`${fn}-${idx}-c${commaIdx}`]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-c${commaIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // This section's staged (pending) edits — editKey `${field}-${idx}` holds the whole value
      // (scalar / comma-string / full array). Commit each field's whole value ($set).
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const field = editKey.slice(0, -suffix.length);
        await secureApiClient.put(`/api/edit/dialysis_run_sheets/${id}/edit`, { field, value: localEdits[editKey] });
      }
      await secureApiClient.put(`/api/edit/dialysis_run_sheets/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (both "field" and "field.N" element keys)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => { const field = editKey.slice(0, -suffix.length); Object.keys(store[id]).forEach(dk => { if (dk === field || dk.startsWith(`${field}.`)) delete store[id][dk]; }); });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DialysisRunSheets] Approve error:', err); setSaveError('Save failed. Please try again.'); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value row(s).
     NEVER side-by-side "Label: value" (one-pass items 1-3). Units are carried in the FIELD_LABELS
     (e.g. "Patient Weight (kg)"), so values are bare; vascularAccessType shows the canonical
     title-case. Array (complications) + comma (dialysateBath) → numbered items. single-name rule
     (item 4): field label == section title (Complications) → hide the sub-label. */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sl = label.toLowerCase() !== title.toLowerCase();
      const val = ARRAY_FIELDS.includes(f) ? getEffectiveArray(record, f, idx) : getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f) ? !hasVal(val) : !fieldHasVal(f, val)) return;
      if (ARRAY_FIELDS.includes(f) && Array.isArray(val)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        val.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else if (COMMA_SPLIT_FIELDS.includes(f)) {
        const items = splitByComma(fmtVal(val));
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n';
      } else {
        const value = ENUM_FIELDS[f] ? enumDisplay(f, val) : fmtVal(val);
        text += `${label}\n${COPY_LINE_DASH}\n1. ${value}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fieldHasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = `Dialysis Run Sheets\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dialysis Run Sheet ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty lines) has
        // no real content — skip it so empty sections don't leak their heading.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD (numbers + strings) ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isEnum = !!ENUM_FIELDS[fn];
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isEnum ? enumDisplay(fn, val) : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isEnum ? enumCanonical(ENUM_FIELDS[fn], val) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              {isEnum ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  {enumOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const sv = editValue.trim(); const numVal = Number(sv); handleSaveField(record, fn, idx, sid, null, !isEnum && !isNaN(numVal) && sv !== '' && typeof val === 'number' ? numVal : sv); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD (parseFloat + isNaN → warning + block) ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No select) ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof val === 'boolean' ? (val ? 'yes' : 'no') : String(val).toLowerCase()); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus ref={el => { if (el) { try { el.focus(); el.click(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: COMMA-SPLIT FIELD (dialysateBath) ═══════ */
  const renderCommaSplitField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const items = splitByComma(fmtVal(val));
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {items.map((item, ciIdx) => {
            const commaKey = `${fn}-${idx}-c${ciIdx}`;
            const ciEditing = editingField === commaKey;
            const ciBadge = editedSentences[commaKey];
            const ciMatches = phraseMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!ciMatches && searchTerm.trim()) return null;

            return (
              <div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(item); setSaveError(null); } }}>
                  {ciEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (complications) ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {arr.map((item, arrIdx) => {
            const arrKey = `${fn}-${idx}-a${arrIdx}`;
            const isEditing = editingField === arrKey;
            const badge = editedFields[arrKey];
            const itemStr = String(item);
            const itemMatches = phraseMatch || !searchTerm.trim() || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = ARRAY_FIELDS.includes(f) ? getEffectiveArray(record, f, idx) : getFieldValue(record, f, idx);
      return ARRAY_FIELDS.includes(f) ? hasVal(val) : fieldHasVal(f, val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaSplitField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dialysis-run-sheets-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dialysis Run Sheets</h2></div>
        <div className="empty-state">No dialysis run sheet records available</div>
      </div>
    );
  }

  return (
    <div className="dialysis-run-sheets-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dialysis Run Sheets</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DialysisRunSheetsDocumentPDFTemplate document={pdfData} />} fileName="Dialysis_Run_Sheets.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dialysis run sheets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dialysis Run Sheet ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'weight-fluid')}
            {renderSection(record, idx, 'treatment-params')}
            {renderSection(record, idx, 'blood-pressure')}
            {renderSection(record, idx, 'adequacy')}
            {renderSection(record, idx, 'access-section')}
            {renderSection(record, idx, 'dialysate-section')}
            {renderSection(record, idx, 'pressures-section')}
            {renderSection(record, idx, 'machine-info')}
            {renderSection(record, idx, 'complications-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DialysisRunSheetsDocument;
