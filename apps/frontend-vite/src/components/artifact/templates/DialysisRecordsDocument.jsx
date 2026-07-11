/**
 * DialysisRecordsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dialysis_records
 *
 * 8 Sections (NO date/provider/facility):
 *   1. weight-fluid: patientWeight, dryWeight, fluidRemovalGoal, actualFluidRemoved
 *   2. treatment: bloodFlowRate, dialysateFlowRate, treatmentTime
 *   3. adequacy: ktVRatio, ureReductionRatio
 *   4. access: accessType, accessSite, accessThrill, accessBruit
 *   5. blood-pressure: systolicBloodPressurePre, diastolicBloodPressurePre, systolicBloodPressurePost, diastolicBloodPressurePost
 *   6. dialysate: dialyzerType, dialysateBath (comma-delimited string), heparinDose
 *   7. pressures: venousPressure, arterialPressure, transmembranePressure
 *   8. complications: complications[]
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DialysisRecordsDocumentPDFTemplate from '../pdf-templates/DialysisRecordsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DialysisRecordsDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'weight-fluid': 'Weight & Fluid',
  'treatment': 'Treatment',
  'adequacy': 'Adequacy',
  'access': 'Access',
  'blood-pressure': 'Blood Pressure',
  'dialysate': 'Dialysate',
  'pressures': 'Pressures',
  'complications': 'Complications',
};

const FIELD_LABELS = {
  patientWeight: 'Patient Weight',
  dryWeight: 'Dry Weight',
  fluidRemovalGoal: 'Fluid Removal Goal',
  actualFluidRemoved: 'Actual Fluid Removed',
  bloodFlowRate: 'Blood Flow Rate',
  dialysateFlowRate: 'Dialysate Flow Rate',
  treatmentTime: 'Treatment Time',
  ktVRatio: 'Kt/V Ratio',
  ureReductionRatio: 'URR',
  accessType: 'Access Type',
  accessSite: 'Access Site',
  accessThrill: 'Thrill Present',
  accessBruit: 'Bruit Present',
  systolicBloodPressurePre: 'Systolic Pre',
  diastolicBloodPressurePre: 'Diastolic Pre',
  systolicBloodPressurePost: 'Systolic Post',
  diastolicBloodPressurePost: 'Diastolic Post',
  dialyzerType: 'Dialyzer Type',
  dialysateBath: 'Dialysate Bath',
  heparinDose: 'Heparin Dose',
  venousPressure: 'Venous Pressure',
  arterialPressure: 'Arterial Pressure',
  transmembranePressure: 'Transmembrane Pressure',
  complications: 'Complications',
};

const FIELD_UNITS = {
  patientWeight: ' kg',
  dryWeight: ' kg',
  fluidRemovalGoal: ' mL',
  actualFluidRemoved: ' mL',
  bloodFlowRate: ' mL/min',
  dialysateFlowRate: ' mL/min',
  treatmentTime: ' min',
  heparinDose: ' units',
  ureReductionRatio: '%',
  venousPressure: ' mmHg',
  arterialPressure: ' mmHg',
  transmembranePressure: ' mmHg',
  systolicBloodPressurePre: ' mmHg',
  diastolicBloodPressurePre: ' mmHg',
  systolicBloodPressurePost: ' mmHg',
  diastolicBloodPressurePost: ' mmHg',
};

const SECTION_FIELDS = {
  'weight-fluid': ['patientWeight', 'dryWeight', 'fluidRemovalGoal', 'actualFluidRemoved'],
  'treatment': ['bloodFlowRate', 'dialysateFlowRate', 'treatmentTime'],
  'adequacy': ['ktVRatio', 'ureReductionRatio'],
  'access': ['accessType', 'accessSite', 'accessThrill', 'accessBruit'],
  'blood-pressure': ['systolicBloodPressurePre', 'diastolicBloodPressurePre', 'systolicBloodPressurePost', 'diastolicBloodPressurePost'],
  'dialysate': ['dialyzerType', 'dialysateBath', 'heparinDose'],
  'pressures': ['venousPressure', 'arterialPressure', 'transmembranePressure'],
  'complications': ['complications'],
};

const NUMBER_FIELDS = [
  'patientWeight', 'dryWeight', 'fluidRemovalGoal', 'actualFluidRemoved',
  'bloodFlowRate', 'dialysateFlowRate', 'treatmentTime',
  'ktVRatio', 'ureReductionRatio',
  'systolicBloodPressurePre', 'diastolicBloodPressurePre',
  'systolicBloodPressurePost', 'diastolicBloodPressurePost',
  'heparinDose',
  'venousPressure', 'arterialPressure', 'transmembranePressure',
];

const BOOLEAN_FIELDS = ['accessThrill', 'accessBruit'];
const ARRAY_FIELDS = ['complications'];
const COMMA_STRING_FIELDS = ['dialysateBath'];

/* ENUM_FIELDS: known clinical dropdown (standing "act like a medical professional" directive).
   accessType is the vascular access used this session — full canonical scale; a lowercase-stored
   value ("arteriovenous fistula") displays/edits as the canonical title-case ("Arteriovenous
   Fistula") in all 4 areas. accessSite (anatomical description) + dialyzerType (device model) stay
   free text. */
const ENUM_FIELDS = {
  accessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
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
   in hemodialysis is measured as a suction/negative value (e.g. -200 mmHg). The −/+ stepper must
   NOT clamp these at 0. Every other numeric clamps >= 0. */
const NEGATIVE_OK_FIELDS = new Set(['arterialPressure']);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   values by 0.1, two-decimal by 0.01. The customer TYPES the exact value; we NEVER impose a fixed
   measurement increment (dose/time/flow) unless medically certain (STANDING user directive, July 5 2026). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a clinically valid value.
 * For dialysis sessions NO physiologic measurement (weight, fluid, flow rate,
 * blood pressure, Kt/V, URR, heparin, pressures) can legitimately be 0 — a 0 is
 * always a "not recorded" sentinel. So this list is intentionally empty; sentinel
 * zeros are hidden unless the doctor explicitly edited the field to 0. */
const MEANINGFUL_ZERO_FIELDS = [];

/* splitByComma: parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dialysis_recordsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const DialysisRecordsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.dialysis_records) return Array.isArray(r.dialysis_records) ? r.dialysis_records : [r.dialysis_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_records) return Array.isArray(dd.dialysis_records) ? dd.dialysis_records : [dd.dialysis_records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const fmtWithUnit = useCallback((v, fn) => { const unit = FIELD_UNITS[fn]; if (!hasVal(v)) return ''; const s = fmtVal(v); return unit ? `${s}${unit}` : s; }, [hasVal, fmtVal]);
  const safeArray = useCallback((v) => Array.isArray(v) ? v.filter(Boolean) : [], []);

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

  /* hide-zero: numeric "not recorded" (0) is hidden unless the field has a
   * meaningful zero or the doctor explicitly edited it to 0. */
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0) {
      if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
      const editKey = `${fn}-${idx}`;
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
      return Boolean(editedFields[editKey]) || doctorEdited;
    }
    return true;
  }, [getFieldValue, editedFields]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
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
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (COMMA_STRING_FIELDS.includes(f)) {
          const items = splitByComma(fmtVal(val));
          for (const item of items) { if (String(item).toLowerCase().includes(phrase)) return true; }
        } else if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (COMMA_STRING_FIELDS.includes(fn)) {
        return splitByComma(fmtVal(val)).some(item => String(item).toLowerCase().includes(phrase));
      }
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dialysis Record ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
          } else if (val && COMMA_STRING_FIELDS.includes(f)) {
            if (splitByComma(fmtVal(val)).some(item => String(item).toLowerCase().includes(phrase))) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; /* pending drafts stay OUT of the PDF until approved */ const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ VALIDATION ═══════ */
  const validateFieldType = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) { const trimmed = String(val).trim(); if (trimmed === '' || isNaN(parseFloat(trimmed))) return 'Please enter a valid number'; return null; }
    if (BOOLEAN_FIELDS.includes(fn)) { const low = String(val).toLowerCase().trim(); if (!['yes', 'no', 'true', 'false'].includes(low)) return 'Please enter Yes or No'; return null; }
    return null;
  }, []);
  const convertFieldValue = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) return parseFloat(String(val).trim());
    if (BOOLEAN_FIELDS.includes(fn)) { const low = String(val).toLowerCase().trim(); return low === 'yes' || low === 'true'; }
    return val;
  }, []);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const err = validateFieldType(fn, editValue);
    if (err) { setSaveError(err); return; }
    const id = safeId(record); if (!id) return; setSaveError(null);
    const converted = convertFieldValue(fn, editValue);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: converted }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = converted;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, validateFieldType, convertFieldValue]);

  const saveArrayItem = useCallback((record, fn, idx, arrayIdx, sid) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const currentArr = [...safeArray(getFieldValue(record, fn, idx))]; currentArr[arrayIdx] = editValue.trim();
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}`]: 'edited' }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = currentArr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, safeArray]);

  const saveCommaItem = useCallback((record, fn, idx, commaIdx, sid) => {
    const id = safeId(record); if (!id) return; setSaveError(null);
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    items[commaIdx] = editValue.trim();
    const newVal = items.join(', ');
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-c${commaIdx}`]: 'edited' }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this section's staged (pending) edits — editKey = `${fieldPart}-${idx}`.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length).split('.')[0]));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIndex = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/dialysis_records/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/dialysis_records/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (e) { console.error('[DialysisRecords] Approve error:', e); setSaveError('Save failed. Please try again.'); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value row(s).
     NEVER side-by-side "Label: value" (one-pass items 1-3). Numbers carry their unit, accessType
     shows the canonical title-case, booleans Yes/No. Array (complications) + comma-string
     (dialysateBath) fields → sub-label + numbered items. Every value row numbered ("1." even singles). */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      // single-name rule (item 4): field label == section title → hide the sub-label (e.g. Complications)
      const sl = label.toLowerCase() !== title.toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) {
        const items = safeArray(val); if (items.length === 0) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n'; return;
      }
      if (COMMA_STRING_FIELDS.includes(f)) {
        const items = splitByComma(fmtVal(val)); if (items.length === 0) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n'; return;
      }
      if (NUMBER_FIELDS.includes(f) ? !numberShows(record, f, idx) : !hasVal(val)) return;
      const value = BOOLEAN_FIELDS.includes(f) ? (val ? 'Yes' : 'No')
        : ENUM_FIELDS[f] ? enumDisplay(f, val)
        : fmtWithUnit(val, f);
      text += `${label}\n${COPY_LINE_DASH}\n1. ${value}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, fmtWithUnit, safeArray, numberShows]);

  const copyAllText = useCallback(async () => {
    let text = `Dialysis Records\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dialysis Record ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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

  /* ═══════ RENDER: EDITABLE FIELD (number, string, boolean) ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (NUMBER_FIELDS.includes(fn) ? !numberShows(record, fn, idx) : !hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const isNumber = NUMBER_FIELDS.includes(fn);
    const isEnum = !!ENUM_FIELDS[fn];
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isBoolean ? (val ? 'Yes' : 'No') : isEnum ? enumDisplay(fn, val) : fmtWithUnit(val, fn);
    const rawForEdit = isBoolean ? (val ? 'yes' : 'no') : isEnum ? enumCanonical(ENUM_FIELDS[fn], val) : fmtVal(val);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rawForEdit); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              {isBoolean ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : isEnum ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  {enumOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : isNumber ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'\u2212'}</button>
                  <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx, sid); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: COMMA-SPLIT STRING FIELD (dialysateBath) ═══════ */
  const renderCommaStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitByComma(fmtVal(val));
    if (items.length === 0) return null;

    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, ci) => {
          const commaKey = `${fn}-${idx}-c${ci}`;
          const ciEditing = editingField === commaKey;
          const ciBadge = editedFields[commaKey];
          const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!ciMatches && searchTerm.trim()) return null;
          return (
            <div key={ci}>
              <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(item); setSaveError(null); } }}>
                {ciEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, ci, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">{'\u270E'}</span></div>
                    <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (complications) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = safeArray(val);
    if (items.length === 0) return null;

    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && (FIELD_LABELS[fn] || fn).toLowerCase().includes(searchTerm.toLowerCase().trim());

    return items.map((item, ai) => {
      const arrKey = `${fn}-${idx}-a${ai}`;
      const aiEditing = editingField === arrKey;
      const aiBadge = editedFields[arrKey];
      const aiMatches = phraseMatch || labelMatch || !searchTerm.trim() || String(item).toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!aiMatches && searchTerm.trim()) return null;
      return (
        <div key={ai}>
          <div className={`numbered-row ${aiBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!aiEditing) { setEditingField(arrKey); setEditValue(String(item)); setSaveError(null); } }}>
            {aiEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, ai, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">{'\u270E'}</span></div>
                <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {aiBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: BLOOD PRESSURE BAR CHART ═══════ */
  const renderBloodPressureSection = (record, idx) => {
    const sid = 'blood-pressure';
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid];
    const bpData = fields.map(f => {
      const val = getFieldValue(record, f, idx);
      if (!numberShows(record, f, idx)) return null;
      return [f, val];
    }).filter(Boolean);
    if (bpData.length === 0) return null;

    const maxBP = 220;
    const getBarColor = (fn) => {
      if (fn === 'systolicBloodPressurePre') return '#ef4444';
      if (fn === 'diastolicBloodPressurePre') return '#f97316';
      if (fn === 'systolicBloodPressurePost') return '#22c55e';
      if (fn === 'diastolicBloodPressurePost') return '#3b82f6';
      return '#60a5fa';
    };

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bar-chart-section">
            {bpData.map(([fn, numVal]) => {
              const label = FIELD_LABELS[fn];
              const displayVal = fmtWithUnit(numVal, fn);
              const percentage = Math.min(100, Math.max(0, (numVal / maxBP) * 100));
              const color = getBarColor(fn);
              const editKey = `${fn}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];

              if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

              return (
                <div key={fn}>
                  <div className={`bar-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fmtVal(numVal)); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container" onClick={e => e.stopPropagation()}>
                        <div className="bar-label">{highlightText(label)}</div>
                        <div className="num-stepper-row">
                          <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'−'}</button>
                          <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx); } }} />
                          <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
                        </div>
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bar-label">{highlightText(label)}<span className="edit-indicator" style={{ marginLeft: 6 }}>{'\u270E'}</span></div>
                        <div className="bar-container">
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
                          </div>
                          <div className="bar-value">{highlightText(displayVal)}</div>
                        </div>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (sid === 'blood-pressure') return renderBloodPressureSection(record, idx);
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return safeArray(val).length > 0;
      if (COMMA_STRING_FIELDS.includes(f)) return splitByComma(fmtVal(val)).length > 0;
      if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx);
      return hasVal(val);
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (COMMA_STRING_FIELDS.includes(f)) return renderCommaStringField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dialysis-records-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dialysis Records</h2></div>
        <div className="empty-state">No dialysis records data available</div>
      </div>
    );
  }

  return (
    <div className="dialysis-records-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dialysis Records</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DialysisRecordsDocumentPDFTemplate records={pdfData} />} fileName="Dialysis_Records.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dialysis records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dialysis Record ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'weight-fluid')}
            {renderSection(record, idx, 'treatment')}
            {renderSection(record, idx, 'adequacy')}
            {renderSection(record, idx, 'access')}
            {renderSection(record, idx, 'blood-pressure')}
            {renderSection(record, idx, 'dialysate')}
            {renderSection(record, idx, 'pressures')}
            {renderSection(record, idx, 'complications')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DialysisRecordsDocument;
