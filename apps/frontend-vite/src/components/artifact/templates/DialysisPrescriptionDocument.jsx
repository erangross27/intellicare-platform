/**
 * DialysisPrescriptionDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dialysis_prescription
 *
 * 9 Sections:
 *   1. treatment-params: dialysisModalityType, treatmentFrequency, sessionDurationMinutes
 *   2. flow-rates: ultrafiltrationGoalMl, bloodFlowRateMlMin, dialysateFlowRateMlMin
 *   3. dialyzer-access: dialyzerType, vascularAccessType, dryWeightKg
 *   4. dialysate-composition: dialysateSodiumMeqL, dialysatePotassiumMeqL, dialysateCalciumMeqL, dialysateBicarbonateLevel
 *   5. anticoagulation: heparinDoseUnits
 *   6. targets: targetKtVRatio, temperatureControlCelsius
 *   7. profiling: sodiumProfiling, ultrafiltrationProfiling
 *   8. medications: phosphorusBinders[], erythropoietinDoseUnits, ironSupplementationMg, vitaminDAnalogDose
 *   9. residual-function: residualRenalFunction
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DialysisPrescriptionDocumentPDFTemplate from '../pdf-templates/DialysisPrescriptionDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DialysisPrescriptionDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'treatment-params': 'Treatment Parameters',
  'flow-rates': 'Flow Rates',
  'dialyzer-access': 'Dialyzer & Access',
  'dialysate-composition': 'Dialysate Composition',
  'anticoagulation': 'Anticoagulation',
  'targets': 'Targets',
  'profiling': 'Profiling',
  'medications': 'Medications',
  'residual-function': 'Residual Function',
};

const FIELD_LABELS = {
  dialysisModalityType: 'Dialysis Modality',
  treatmentFrequency: 'Treatment Frequency',
  sessionDurationMinutes: 'Session Duration',
  ultrafiltrationGoalMl: 'Ultrafiltration Goal',
  bloodFlowRateMlMin: 'Blood Flow Rate',
  dialysateFlowRateMlMin: 'Dialysate Flow Rate',
  dialyzerType: 'Dialyzer Type',
  vascularAccessType: 'Vascular Access Type',
  dryWeightKg: 'Dry Weight',
  dialysateSodiumMeqL: 'Sodium',
  dialysatePotassiumMeqL: 'Potassium',
  dialysateCalciumMeqL: 'Calcium',
  dialysateBicarbonateLevel: 'Bicarbonate',
  heparinDoseUnits: 'Heparin Dose',
  targetKtVRatio: 'Target Kt/V Ratio',
  temperatureControlCelsius: 'Temperature Control',
  sodiumProfiling: 'Sodium Profiling',
  ultrafiltrationProfiling: 'Ultrafiltration Profiling',
  phosphorusBinders: 'Phosphorus Binders',
  erythropoietinDoseUnits: 'Erythropoietin Dose',
  ironSupplementationMg: 'Iron Supplementation',
  vitaminDAnalogDose: 'Vitamin D Analog Dose',
  residualRenalFunction: 'Residual Renal Function',
};

const FIELD_UNITS = {
  treatmentFrequency: ' sessions/week',
  sessionDurationMinutes: ' minutes',
  ultrafiltrationGoalMl: ' mL',
  bloodFlowRateMlMin: ' mL/min',
  dialysateFlowRateMlMin: ' mL/min',
  dryWeightKg: ' kg',
  dialysateSodiumMeqL: ' mEq/L',
  dialysatePotassiumMeqL: ' mEq/L',
  dialysateCalciumMeqL: ' mEq/L',
  dialysateBicarbonateLevel: ' mEq/L',
  heparinDoseUnits: ' units',
  temperatureControlCelsius: ' \u00b0C',
  erythropoietinDoseUnits: ' units',
  ironSupplementationMg: ' mg',
  vitaminDAnalogDose: ' mcg',
};

const SECTION_FIELDS = {
  'treatment-params': ['dialysisModalityType', 'treatmentFrequency', 'sessionDurationMinutes'],
  'flow-rates': ['ultrafiltrationGoalMl', 'bloodFlowRateMlMin', 'dialysateFlowRateMlMin'],
  'dialyzer-access': ['dialyzerType', 'vascularAccessType', 'dryWeightKg'],
  'dialysate-composition': ['dialysateSodiumMeqL', 'dialysatePotassiumMeqL', 'dialysateCalciumMeqL', 'dialysateBicarbonateLevel'],
  'anticoagulation': ['heparinDoseUnits'],
  'targets': ['targetKtVRatio', 'temperatureControlCelsius'],
  'profiling': ['sodiumProfiling', 'ultrafiltrationProfiling'],
  'medications': ['phosphorusBinders', 'erythropoietinDoseUnits', 'ironSupplementationMg', 'vitaminDAnalogDose'],
  'residual-function': ['residualRenalFunction'],
};

const NUMBER_FIELDS = [
  'treatmentFrequency', 'sessionDurationMinutes', 'ultrafiltrationGoalMl',
  'bloodFlowRateMlMin', 'dialysateFlowRateMlMin', 'dryWeightKg',
  'dialysateSodiumMeqL', 'dialysatePotassiumMeqL', 'dialysateCalciumMeqL',
  'dialysateBicarbonateLevel', 'heparinDoseUnits', 'targetKtVRatio',
  'temperatureControlCelsius', 'erythropoietinDoseUnits', 'ironSupplementationMg',
  'vitaminDAnalogDose',
];
const BOOLEAN_FIELDS = ['sodiumProfiling', 'ultrafiltrationProfiling', 'residualRenalFunction'];
const ARRAY_FIELDS = ['phosphorusBinders'];

/* ENUM_FIELDS: known clinical dropdowns (standing "act like a medical professional" directive).
   Edit widget offers the full canonical scale; the stored value seeds the case-matched option so a
   lowercase "hemodialysis" shows "Hemodialysis". dialyzerType (device model, e.g. "Fresenius FX80
   CorDiax") stays free text. */
const ENUM_FIELDS = {
  dialysisModalityType: ['Hemodialysis', 'Peritoneal Dialysis', 'Hemodiafiltration', 'Hemofiltration'],
  vascularAccessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
};
/* enumCanonical: case-insensitively map a stored value to its canonical option (so "arteriovenous
   fistula" displays/edits as "Arteriovenous Fistula"). Returns the stored value verbatim when there
   is no match (kept as an extra <option> by enumOptionsWith). Also used for DISPLAY in all 4 areas. */
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
/* enumDisplay: canonical title-case for enum fields, raw string otherwise. */
const enumDisplay = (fn, val) => (ENUM_FIELDS[fn] ? enumCanonical(ENUM_FIELDS[fn], val) : String(val ?? ''));

/* MEANINGFUL_ZERO_FIELDS: numerics where 0 is a real prescription, not a "not recorded" sentinel —
   potassium 0 = K-free bath, calcium 0 = Ca-free bath, heparin 0 = heparin-free (bleeding-risk)
   protocol. Every OTHER numeric 0 (frequency/duration/flows/weight/sodium/bicarbonate/Kt-V/temp/
   doses) is a sentinel and hidden. */
const MEANINGFUL_ZERO_FIELDS = new Set(['dialysatePotassiumMeqL', 'dialysateCalciumMeqL', 'heparinDoseUnits']);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   values by 0.1, two-decimal by 0.01. The customer TYPES the exact value; we NEVER impose a fixed
   measurement increment (dose/time/flow) unless medically certain (STANDING user directive, July 5 2026). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dialysisPrescriptionPendingEdits';
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
const DialysisPrescriptionDocument = ({ document: docProp }) => {
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
      if (r?.dialysis_prescription) return Array.isArray(r.dialysis_prescription) ? r.dialysis_prescription : [r.dialysis_prescription];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_prescription) return Array.isArray(dd.dialysis_prescription) ? dd.dialysis_prescription : [dd.dialysis_prescription]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrIdx = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrIdx) {
          // Array element: localEdits holds the whole array under "field-idx"; editedFields uses "field.arrayIndex-idx".
          const arrField = fieldPart.slice(0, dotIdx);
          const arrIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const baseKey = `${arrField}-${idx}`;
          const arr = [...(nLocal[baseKey] || record[arrField] || [])];
          arr[arrIndex] = value;
          nLocal[baseKey] = arr;
          nPending[baseKey] = true;
          nFields[`${arrField}.${arrIndex}-${idx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v, fn) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') { const unit = FIELD_UNITS[fn] || ''; return String(v) + unit; }
    if (typeof v === 'string') { const unit = FIELD_UNITS[fn] || ''; return v + unit; }
    return String(v || '');
  }, []);
  const rawVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  /* fieldHasVal: number-aware presence. For NUMBER_FIELDS not flagged meaningful-zero, a value of 0
     is a "not recorded" sentinel and is hidden (e.g. a UF goal of 0). Non-number fields → hasVal. */
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
        } else if (rawVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, rawVal]);

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
      return rawVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, rawVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dialysis Prescription ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && rawVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, rawVal]);

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
  const handleSaveField = useCallback((record, fn, idx, _sid, valueOverride) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // number coercion
    if (NUMBER_FIELDS.includes(fn)) {
      const num = parseFloat(saveVal);
      if (isNaN(num)) { setSaveError('Please enter a valid number'); return; }
      saveVal = num;
    }
    // boolean coercion
    if (BOOLEAN_FIELDS.includes(fn)) {
      saveVal = saveVal === 'yes' || saveVal === true;
    }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending
    if (_sid) setApprovedSections(prev => {
      const k = `${_sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    // Stage as a DRAFT in localStorage (survives refresh). fieldPart = plain field name (scalar/boolean).
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one array element as a DRAFT locally (no DB write). localStorage keeps it across refresh.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value, _sid) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const baseKey = `${fn}-${idx}`;
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setLocalEdits(prev => {
      const currentArr = [...(prev[baseKey] || record[fn] || [])];
      currentArr[arrIdx] = value;
      return { ...prev, [baseKey]: currentArr };
    });
    setPendingEdits(prev => ({ ...prev, [baseKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    if (_sid) setApprovedSections(prev => {
      const k = `${_sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    // Stage the array element as a DRAFT: fieldPart = "field.arrayIndex" (numeric suffix).
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
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Collect this section's pending drafts from localStorage (recordId → fieldPart → value).
      const store = readDrafts();
      const recDrafts = (store && store[id]) || {};
      const committed = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrIdx = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const baseField = isArrIdx ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue; // only this section's fields
        const payload = { field: baseField, value };
        if (isArrIdx) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/dialysis_prescription/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committed.push(fieldPart);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/dialysis_prescription/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const n = { ...prev };
        fields.forEach(f => { delete n[`${f}-${idx}`]; });
        return n;
      });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) {
        committed.forEach(fp => { delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DialysisPrescription] Approve error:', err); }
  }, [safeId]);

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

  /* ═══════ COPY TEXT BUILDERS ═══════ */
  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value row(s).
     NEVER side-by-side "Label: value" (one-pass items 1-3). Numbers carry their unit, enums show the
     canonical title-case, booleans Yes/No. Array fields (phosphorusBinders) → sub-label + numbered
     items. Every value row is numbered ("1." even singles). */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getFieldValue(record, f, idx);
        const items = Array.isArray(arr) ? arr.filter(hasVal) : [];
        if (items.length > 0) {
          text += `${label}\n${COPY_LINE_DASH}\n`;
          items.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
          text += '\n';
        }
        return;
      }
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      const value = BOOLEAN_FIELDS.includes(f) ? (val ? 'Yes' : 'No')
        : ENUM_FIELDS[f] ? enumDisplay(f, val)
        : fmtVal(val, f);
      text += `${label}\n${COPY_LINE_DASH}\n1. ${value}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fieldHasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = `Dialysis Prescription\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dialysis Prescription ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val, fn);
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
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: EDITABLE STRING FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isEnum = !!ENUM_FIELDS[fn];
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isEnum ? enumDisplay(fn, val) : fmtVal(val, fn);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isEnum ? enumCanonical(ENUM_FIELDS[fn], val) : rawVal(val)); setSaveError(null); } }}>
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

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No select) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof val === 'boolean' ? (val ? 'yes' : 'no') : String(val).toLowerCase()); setSaveError(null); } }}>
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

  /* ═══════ RENDER: ARRAY FIELD (phosphorusBinders) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      if (!item) return null;
      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!String(item).toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
      }

      const arrEditKey = `${fn}.${arrIdx}-${idx}`;
      const isEditing = editingField === arrEditKey;
      const isModified = editedFields[arrEditKey];

      return (
        <div key={arrIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(arr.length > 1 ? `${label} ${arrIdx + 1}` : label)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrEditKey); setEditValue(String(item)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">{'\u270E'}</span></div>
                <button className={`copy-btn ${copiedItems[arrEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), arrEditKey); }}>{copiedItems[arrEditKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values
    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dialysis-prescription-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dialysis Prescription</h2></div>
        <div className="empty-state">No dialysis prescription records available</div>
      </div>
    );
  }

  return (
    <div className="dialysis-prescription-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dialysis Prescription</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DialysisPrescriptionDocumentPDFTemplate document={pdfData} />} fileName="Dialysis_Prescription.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dialysis prescriptions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dialysis Prescription ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'treatment-params')}
            {renderSection(record, idx, 'flow-rates')}
            {renderSection(record, idx, 'dialyzer-access')}
            {renderSection(record, idx, 'dialysate-composition')}
            {renderSection(record, idx, 'anticoagulation')}
            {renderSection(record, idx, 'targets')}
            {renderSection(record, idx, 'profiling')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'residual-function')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DialysisPrescriptionDocument;
