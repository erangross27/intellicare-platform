/**
 * DialysateCompositionDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dialysate_composition
 *
 * 6 Sections:
 *   1. electrolytes: sodium/potassium/calcium/magnesium/chloride/bicarbonate/acetate/glucose/phosphate
 *   2. physical-properties: temperature/pH/osmolarity/conductivity/flowRate
 *   3. buffer-dialyzer: bufferType/dialyzerType/dialysisModalityType
 *   4. manufacturing: dialysateBatchNumber/manufacturerName/expirationDate
 *   5. water-quality: waterTreatmentType/endotoxinLevel/bacterialCount/qualityControlVerified
 *   6. additives: additives[] (hide if empty)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DialysateCompositionDocumentPDFTemplate from '../pdf-templates/DialysateCompositionDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DialysateCompositionDocument.css';
import BlueDatePicker from '../components/BlueDatePicker';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'electrolytes': 'Electrolyte Concentrations',
  'physical-properties': 'Physical Properties',
  'buffer-dialyzer': 'Buffer & Dialyzer',
  'manufacturing': 'Manufacturing',
  'water-quality': 'Water Quality',
  'additives': 'Additives',
};

const FIELD_LABELS = {
  sodiumConcentration: 'Sodium',
  potassiumConcentration: 'Potassium',
  calciumConcentration: 'Calcium',
  magnesiumConcentration: 'Magnesium',
  chlorideConcentration: 'Chloride',
  bicarbonateConcentration: 'Bicarbonate',
  acetateConcentration: 'Acetate',
  glucoseConcentration: 'Glucose',
  phosphateConcentration: 'Phosphate',
  dialysateTemperature: 'Temperature',
  dialysatePH: 'pH',
  osmolarity: 'Osmolarity',
  conductivity: 'Conductivity',
  dialysateFlowRate: 'Flow Rate',
  bufferType: 'Buffer Type',
  dialyzerType: 'Dialyzer Type',
  dialysisModalityType: 'Modality Type',
  dialysateBatchNumber: 'Batch Number',
  manufacturerName: 'Manufacturer',
  expirationDate: 'Expiration Date',
  waterTreatmentType: 'Water Treatment',
  endotoxinLevel: 'Endotoxin Level',
  bacterialCount: 'Bacterial Count',
  qualityControlVerified: 'QC Verified',
  additives: 'Additives',
};

const FIELD_UNITS = {
  sodiumConcentration: ' mEq/L',
  potassiumConcentration: ' mEq/L',
  calciumConcentration: ' mEq/L',
  magnesiumConcentration: ' mEq/L',
  chlorideConcentration: ' mEq/L',
  bicarbonateConcentration: ' mEq/L',
  acetateConcentration: ' mEq/L',
  glucoseConcentration: ' mg/dL',
  phosphateConcentration: ' mEq/L',
  dialysateTemperature: ' \u00B0C',
  osmolarity: ' mOsm/L',
  conductivity: ' mS/cm',
  dialysateFlowRate: ' mL/min',
  endotoxinLevel: ' EU/mL',
  bacterialCount: ' CFU/mL',
};

const SECTION_FIELDS = {
  'electrolytes': ['sodiumConcentration', 'potassiumConcentration', 'calciumConcentration', 'magnesiumConcentration', 'chlorideConcentration', 'bicarbonateConcentration', 'acetateConcentration', 'glucoseConcentration', 'phosphateConcentration'],
  'physical-properties': ['dialysateTemperature', 'dialysatePH', 'osmolarity', 'conductivity', 'dialysateFlowRate'],
  'buffer-dialyzer': ['bufferType', 'dialyzerType', 'dialysisModalityType'],
  'manufacturing': ['dialysateBatchNumber', 'manufacturerName', 'expirationDate'],
  'water-quality': ['waterTreatmentType', 'endotoxinLevel', 'bacterialCount', 'qualityControlVerified'],
  'additives': ['additives'],
};

const NUMBER_FIELDS = ['sodiumConcentration', 'potassiumConcentration', 'calciumConcentration', 'magnesiumConcentration', 'chlorideConcentration', 'bicarbonateConcentration', 'acetateConcentration', 'glucoseConcentration', 'phosphateConcentration', 'dialysateTemperature', 'dialysatePH', 'osmolarity', 'conductivity', 'dialysateFlowRate', 'endotoxinLevel', 'bacterialCount'];

/* MEANINGFUL_ZERO_FIELDS: numerics where 0 is a real clinical value, not a "not recorded" sentinel.
   - Electrolyte concentrations: 0 mEq/L = ion deliberately absent from the bath (K-free, Ca-free,
     acetate-free, glucose-free, bicarbonate-free formulations are all real prescriptions).
   - endotoxinLevel/bacterialCount: 0 = clean / sterile water (a genuine, desirable result).
   Excluded (0 = impossible -> hidden as sentinel): temperature, pH, osmolarity, conductivity, flowRate. */
const MEANINGFUL_ZERO_FIELDS = new Set(['sodiumConcentration', 'potassiumConcentration', 'calciumConcentration', 'magnesiumConcentration', 'chlorideConcentration', 'bicarbonateConcentration', 'acetateConcentration', 'glucoseConcentration', 'phosphateConcentration', 'endotoxinLevel', 'bacterialCount']);
const STRING_FIELDS = ['bufferType', 'dialyzerType', 'dialysisModalityType', 'dialysateBatchNumber', 'manufacturerName', 'waterTreatmentType'];
const BOOLEAN_FIELDS = ['qualityControlVerified'];
const DATE_FIELDS = ['expirationDate'];
const ARRAY_FIELDS = ['additives'];

/* ENUM_FIELDS: known clinical dropdowns (standing "act like a medical professional" directive).
   Edit-widget ONLY — stored value/casing is unchanged, so Copy/PDF/backend stay untouched. Buffer
   and dialysis modality are small clinical sets; dialyzerType (device model) + waterTreatmentType
   (abbreviation) stay free text. */
const ENUM_FIELDS = {
  bufferType: ['Bicarbonate', 'Acetate', 'Citrate'],
  dialysisModalityType: ['Hemodialysis', 'Peritoneal Dialysis', 'Hemodiafiltration', 'Hemofiltration'],
};
/* enumCanonical: seed the <select> with the case-matched canonical option so a stored lowercase
   value ("bicarbonate") shows the canonical entry ("Bicarbonate") selected. Returns the stored
   value verbatim when no case-insensitive match (kept as an extra option by enumOptionsWith). */
const enumCanonical = (options, current) => {
  const c = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === c.toLowerCase());
  return hit || c;
};
/* enumOptionsWith: prepend the current value as an extra option when it is off-scale. */
const enumOptionsWith = (options, current) => {
  const canon = enumCanonical(options, current);
  return options.includes(canon) ? options : [canon, ...options];
};

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   values by 0.1, two-decimal by 0.01. The customer TYPES the exact value; we NEVER impose a fixed
   measurement increment (dose/time/flow) unless medically certain (STANDING user directive, July 5 2026). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dialysate_compositionPendingEdits';
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
const DialysateCompositionDocument = ({ document: docProp }) => {
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
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.dialysate_composition) return Array.isArray(r.dialysate_composition) ? r.dialysate_composition : [r.dialysate_composition];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysate_composition) return Array.isArray(dd.dialysate_composition) ? dd.dialysate_composition : [dd.dialysate_composition]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft store shape: { [recordId]: { [fieldPart]: value } } where fieldPart = "field" or "field.arrayIndex". */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = (() => { if (!record?._id) return null; if (typeof record._id === 'string') return record._id; if (record._id.$oid) return record._id.$oid; return String(record._id); })();
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrayElem) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const baseKey = `${fn}-${idx}`;
          const currentArr = [...(nLocal[baseKey] || record[fn] || [])];
          currentArr[arrIdx] = value;
          nLocal[baseKey] = currentArr;
          nPending[`${fieldPart}-${idx}`] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
        } else {
          nLocal[`${fieldPart}-${idx}`] = value;
          nPending[`${fieldPart}-${idx}`] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  /* fieldHasVal: number-aware presence. For NUMBER_FIELDS not flagged meaningful-zero, a value of 0 is a
     "not recorded" sentinel and is hidden (e.g. pH 0, osmolarity 0). Non-number fields fall back to hasVal. */
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn)) {
      if (v === null || v === undefined || v === '') return false;
      const n = Number(v);
      if (Number.isNaN(n)) return false;
      if (n === 0) return MEANINGFUL_ZERO_FIELDS.has(fn);
      return true;
    }
    return hasVal(v);
  }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const fmtWithUnit = useCallback((fn, v) => {
    const unit = FIELD_UNITS[fn];
    const base = fmtVal(v);
    return unit ? `${base}${unit}` : base;
  }, [fmtVal]);

  /* −/+ stepper: nudge editValue by the field's step, clamped >= 0, rounded to 2 decimals. */
  const stepEditValue = (fn, dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const stepStr = stepFor(prev);
      const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat(((isNaN(n) ? 0 : n) + dir * step).toFixed(decimals));
      if (next < 0) next = 0;
      return String(next);
    });
  };

  const getFieldValue = useCallback((record, fn, idx) => {
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (fmtWithUnit(f, val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtWithUnit]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtWithUnit(fn, val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtWithUnit]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dialysate Composition ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
          } else if (val && fmtWithUnit(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtWithUnit]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending scalar drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          // For array fields, localEdits holds the whole array under "<field>-<idx>" while pending
          // markers are per-element ("<field>.<n>-<idx>"). Skip merging the array if any element is pending.
          if (Object.keys(pendingEdits).some(pk => pk.startsWith(`${m[1]}.`) && pk.endsWith(`-${idx}`))) return;
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;

    // Number validation
    if (NUMBER_FIELDS.includes(fn)) {
      const num = parseFloat(saveVal);
      if (isNaN(num)) { setSaveError('Please enter a valid number'); return; }
      saveVal = num;
    }
    // Boolean conversion
    if (BOOLEAN_FIELDS.includes(fn)) {
      saveVal = saveVal === 'yes' || saveVal === true;
    }

    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    // Stage to localStorage draft store (survives refresh). Scalar fieldPart = field name.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value, sid) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setLocalEdits(prev => {
      const currentArr = [...(prev[`${fn}-${idx}`] || record[fn] || [])];
      currentArr[arrIdx] = value;
      return { ...prev, [`${fn}-${idx}`]: currentArr };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    // Stage to localStorage draft store with per-element fieldPart "field.arrayIndex".
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrIdx}`] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)))
    );
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending edit keys for this section's fields: "<field>-<idx>" (scalar) or "<field>.<n>-<idx>" (array elem)
      const toCommit = Object.keys(pendingEdits).filter(k =>
        pendingEdits[k] && k.endsWith(suffix) &&
        fields.some(f => k === `${f}${suffix}` || k.startsWith(`${f}.`))
      );
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrayElem) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const arr = localEdits[`${fn}${suffix}`] || record[fn] || [];
          await secureApiClient.put(`/api/edit/dialysate_composition/${id}/edit`, { field: fn, value: arr[arrIdx], arrayIndex: arrIdx });
        } else {
          await secureApiClient.put(`/api/edit/dialysate_composition/${id}/edit`, { field: fieldPart, value: localEdits[editKey] });
        }
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/dialysate_composition/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => { delete store[id][editKey.slice(0, -suffix.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[DialysateComposition] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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
     NEVER side-by-side "Label: value" (one-pass items 1-3). Additives is single-name (label ==
     section title) → items numbered directly under the section '=' with no sub-label. */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        if (Array.isArray(arr) && arr.length > 0) {
          arr.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
          text += '\n';
        }
        return;
      }
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      const value = DATE_FIELDS.includes(f) ? formatDate(val)
        : BOOLEAN_FIELDS.includes(f) ? (val ? 'Yes' : 'No')
        : fmtWithUnit(f, val);
      text += `${label}\n${COPY_LINE_DASH}\n1. ${value}\n\n`;
    });
    return text;
  }, [getFieldValue, fieldHasVal, fmtWithUnit]);

  const copyAllText = useCallback(async () => {
    let text = `Dialysate Composition\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dialysate Composition ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty
        // lines) has no real content — skip it so empty sections don't leak their heading.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER EDITABLE FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtWithUnit(fn, val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(typeof val === 'number' ? val : '')); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx, sid); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
              </div>
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

  /* ═══════ RENDER: STRING EDITABLE FIELD ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const isEnum = !!ENUM_FIELDS[fn];
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'yes' : 'no'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
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

  /* ═══════ RENDER: ADDITIVES ARRAY ═══════ */
  const renderAdditivesSection = (record, idx, sid) => {
    const arr = getFieldValue(record, 'additives', idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    const copyId = `${sid}-${idx}`;
    const copyText = `Additives\n${'='.repeat(40)}\n\n${arr.map((item, i) => `${i + 1}. ${String(item)}`).join('\n')}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Additives')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {arr.map((item, arrIdx) => {
            const itemStr = String(item);
            if (searchTerm.trim() && !phraseMatch && !contentMatches(itemStr)) return null;
            const editKey = `additives.${arrIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];

            return (
              <div key={arrIdx} className="rec-mini-card">
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'additives', idx, arrIdx, editValue, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{arrIdx + 1}. {highlightText(itemStr)}</span><span className="edit-indicator">{'\u270E'}</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC FIELD ROUTER ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    if (STRING_FIELDS.includes(fn)) return renderStringField(record, fn, idx, sid);
    if (BOOLEAN_FIELDS.includes(fn)) return renderBooleanField(record, fn, idx, sid);
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    return null;
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (sid === 'additives') return renderAdditivesSection(record, idx, sid);

    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return fieldHasVal(f, val);
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
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dialysate-composition-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dialysate Composition</h2></div>
        <div className="empty-state">No dialysate composition records available</div>
      </div>
    );
  }

  return (
    <div className="dialysate-composition-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dialysate Composition</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DialysateCompositionDocumentPDFTemplate document={pdfData} />} fileName="Dialysate_Composition.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dialysate composition..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dialysate Composition ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'electrolytes')}
            {renderSection(record, idx, 'physical-properties')}
            {renderSection(record, idx, 'buffer-dialyzer')}
            {renderSection(record, idx, 'manufacturing')}
            {renderSection(record, idx, 'water-quality')}
            {renderSection(record, idx, 'additives')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DialysateCompositionDocument;
