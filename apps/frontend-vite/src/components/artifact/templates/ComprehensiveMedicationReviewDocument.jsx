/**
 * ComprehensiveMedicationReviewDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: comprehensive_medication_review
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ComprehensiveMedicationReviewPDFTemplate from '../pdf-templates/ComprehensiveMedicationReviewPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ComprehensiveMedicationReviewDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value may be a scalar or the full array) */
const DRAFT_KEY = 'comprehensive_medication_reviewPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  'review-info': 'Review Information',
  'risk-scores': 'Risk Scores',
  'high-risk': 'High Risk & Therapy Problems',
  interactions: 'Interactions & Criteria',
  'dosing-adjustments': 'Dosing Adjustments & Monitoring',
};

const FIELD_LABELS = {
  reviewDate: 'Review Date',
  totalMedicationCount: 'Total Medication Count',
  polypharmacyStatus: 'Polypharmacy Status',
  medicationAdherenceScore: 'Medication Adherence Score',
  proportionDaysCovered: 'Proportion Days Covered',
  medicationReconciliationCompleted: 'Medication Reconciliation Completed',
  personalMedicationRecord: 'Personal Medication Record',
  medicationActionPlan: 'Medication Action Plan',
  anticholinergicBurdenScore: 'Anticholinergic Burden Score',
  sedativeLoadScore: 'Sedative Load Score',
  medicationCostBarriers: 'Medication Cost Barriers',
  highRiskMedications: 'High Risk Medications',
  medicationTherapyProblems: 'Medication Therapy Problems',
  drugDrugInteractions: 'Drug-Drug Interactions',
  drugFoodInteractions: 'Drug-Food Interactions',
  beersListMedications: 'Beers List Medications',
  stoppStartCriteria: 'STOPP/START Criteria',
  narrowTherapeuticIndexDrugs: 'Narrow Therapeutic Index Drugs',
  qtcProlongingMedications: 'QTc Prolonging Medications',
  renalDosingAdjustments: 'Renal Dosing Adjustments',
  hepaticDosingAdjustments: 'Hepatic Dosing Adjustments',
  therapeuticDuplication: 'Therapeutic Duplication',
  fallRiskMedications: 'Fall Risk Medications',
  deprescribingCandidates: 'Deprescribing Candidates',
  inrTherapeuticRange: 'INR Therapeutic Range',
};

const SECTION_FIELDS = {
  'review-info': ['reviewDate', 'totalMedicationCount', 'polypharmacyStatus', 'medicationAdherenceScore', 'proportionDaysCovered', 'medicationReconciliationCompleted', 'personalMedicationRecord', 'medicationActionPlan'],
  'risk-scores': ['anticholinergicBurdenScore', 'sedativeLoadScore', 'medicationCostBarriers'],
  'high-risk': ['highRiskMedications', 'medicationTherapyProblems'],
  interactions: ['drugDrugInteractions', 'drugFoodInteractions', 'beersListMedications', 'stoppStartCriteria', 'narrowTherapeuticIndexDrugs', 'qtcProlongingMedications'],
  'dosing-adjustments': ['renalDosingAdjustments', 'hepaticDosingAdjustments', 'therapeuticDuplication', 'fallRiskMedications', 'deprescribingCandidates', 'inrTherapeuticRange'],
};

const ARRAY_FIELDS = ['highRiskMedications', 'medicationTherapyProblems', 'drugDrugInteractions', 'drugFoodInteractions', 'beersListMedications', 'stoppStartCriteria', 'narrowTherapeuticIndexDrugs', 'qtcProlongingMedications', 'renalDosingAdjustments', 'hepaticDosingAdjustments', 'therapeuticDuplication', 'fallRiskMedications'];
const BOOLEAN_FIELDS = ['medicationReconciliationCompleted', 'medicationCostBarriers', 'personalMedicationRecord', 'medicationActionPlan'];
const DATE_FIELDS = ['reviewDate', 'deprescribingCandidates'];
const NUMBER_FIELDS = ['totalMedicationCount', 'medicationAdherenceScore', 'proportionDaysCovered', 'anticholinergicBurdenScore', 'sedativeLoadScore'];
// Magnitude scores where a stored 0 is a "not measured" extraction default — hidden unless the doctor edited it.
const MEANINGFUL_ZERO_FIELDS = [];
// Fixed-choice clinical field → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = {
  polypharmacyStatus: ['no polypharmacy', 'polypharmacy', 'hyperpolypharmacy'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative array items (>=3 gate). Paren-aware; keeps Oxford ", and/or X" attached;
// skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#>:+-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Epoch-0 (1970-01-01) is a null/default sentinel for date-typed fields — never a real value.
const isDefaultDate = (v) => { if (!v) return true; const s = String(v); return s.startsWith('1970-01-01') || s === ''; };

const ComprehensiveMedicationReviewDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.comprehensive_medication_review) return Array.isArray(r.comprehensive_medication_review) ? r.comprehensive_medication_review : [r.comprehensive_medication_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.comprehensive_medication_review) return Array.isArray(dd.comprehensive_medication_review) ? dd.comprehensive_medication_review : [dd.comprehensive_medication_review]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, safeId]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => {
    if (!d) return '';
    try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
  }, []);
  const toDateInputValue = useCallback((d) => {
    if (!d) return '';
    try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; }
  }, []);
  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  // Numeric 0 is a "not measured" sentinel for these score fields — hide it unless the doctor edited it.
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
  // A scalar field is visible if it holds a real value (numbers gated by numberShows, epoch-0 dates hidden).
  const fieldShows = useCallback((record, fn, idx) => {
    if (NUMBER_FIELDS.includes(fn)) return numberShows(record, fn, idx);
    const val = getFieldValue(record, fn, idx);
    if (DATE_FIELDS.includes(fn)) return hasVal(val) && !isDefaultDate(val);
    return hasVal(val);
  }, [getFieldValue, hasVal, numberShows]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Comprehensive Medication Review ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      ARRAY_FIELDS.forEach(field => {
        const k = `${field}-${idx}`;
        merged[field] = pendingEdits[k] ? (Array.isArray(record[field]) ? record[field] : []) : getEffectiveArray(record, field, idx);
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  // ========== EDIT ==========
  const validateScalar = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) { if (isNaN(Number(val))) return 'Please enter a valid number'; return null; }
    if (BOOLEAN_FIELDS.includes(fn)) { const lower = String(val).trim().toLowerCase(); if (!['yes', 'no', 'true', 'false'].includes(lower)) return 'Please enter Yes or No'; return null; }
    if (DATE_FIELDS.includes(fn)) { const d = new Date(val); if (isNaN(d.getTime())) return 'Please enter a valid date'; return null; }
    return null;
  }, []);
  const convertScalar = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) return Number(val);
    if (BOOLEAN_FIELDS.includes(fn)) { const lower = String(val).trim().toLowerCase(); return lower === 'yes' || lower === 'true'; }
    if (DATE_FIELDS.includes(fn)) return new Date(val).toISOString();
    return val;
  }, []);

  function dropSectionApproval(sid, idx) {
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  }
  function stageDraft(id, fn, idx, value, trackKey) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey || editKey]: 'edited' }));
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = value; writeDrafts(store);
  }

  // Save a scalar field (date/number/boolean/enum/string) = stage a DRAFT (no DB write).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const raw = valueOverride !== undefined ? valueOverride : editValue;
    const error = validateScalar(fn, raw);
    if (error) { setSaveError(error); return; }
    setSaveError(null);
    stageDraft(id, fn, idx, convertScalar(fn, raw));
    dropSectionApproval(sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, validateScalar, convertScalar]);

  // Save one whole array item = stage a DRAFT.
  function saveArrayItem(record, fn, idx, sid, arrayIdx) {
    const id = safeId(record); if (!id) return;
    const arr = [...getEffectiveArray(record, fn, idx)]; arr[arrayIdx] = editValue.trim();
    stageDraft(id, fn, idx, arr, `${fn}-${idx}-ai${arrayIdx}`);
    dropSectionApproval(sid, idx);
    setEditingField(null); setEditValue('');
  }
  // Save one comma-part of a labeled/unlabeled array item (>=3 list) = stage a DRAFT.
  function saveArrayCommaItem(record, fn, idx, sid, arrayIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const arr = [...getEffectiveArray(record, fn, idx)];
    const item = String(arr[arrayIdx] || '');
    const parsed = parseLabel(item);
    const content = parsed ? parsed.content : item.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) arr[arrayIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else arr.splice(arrayIdx, 1);
    stageDraft(id, fn, idx, arr, `${fn}-${idx}-ai${arrayIdx}-c${commaIdx}`);
    dropSectionApproval(sid, idx);
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const committedKeys = [];
      for (const fn of fields) {
        const editKey = `${fn}-${idx}`;
        if (!pendingEdits[editKey] || localEdits[editKey] === undefined) continue;
        const value = localEdits[editKey];
        if (ARRAY_FIELDS.includes(fn) && Array.isArray(value)) {
          for (let arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
            await secureApiClient.put(`/api/edit/comprehensive_medication_review/${id}/edit`, { field: fn, value: value[arrayIndex], arrayIndex });
          }
        } else {
          await secureApiClient.put(`/api/edit/comprehensive_medication_review/${id}/edit`, { field: fn, value });
        }
        committedKeys.push(editKey);
      }
      await secureApiClient.put(`/api/edit/comprehensive_medication_review/${id}/approve`, { sectionId: sid, approved: true });

      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      const store = readDrafts();
      if (store[id]) { fields.forEach(fn => { delete store[id][fn]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ComprehensiveMedicationReview] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
     Copy All passes pdfData's committed values. Arrays split labeled/unlabeled items at >=3 commas
     (labeled groups restart numbering); NUMBER_FIELDS hidden unless numberShows; epoch-0 dates hidden. */
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        let n = 0;
        arr.forEach(item => {
          const p = parseLabel(String(item));
          const content = p ? p.content : String(item).replace(/[;.]+$/, '').trim();
          const c = splitByComma(content);
          const parts = c.length >= 3 ? c : [content];
          if (p) { lines.push(p.label, COPY_LINE_DASH); let m = 0; parts.forEach(part => lines.push(`${++m}. ${part}`)); }
          else parts.forEach(part => lines.push(`${++n}. ${part}`));
        });
        lines.push('');
      } else if (NUMBER_FIELDS.includes(f)) {
        if (!numberShows(record, f, idx)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(valueOf(f))}`, '');
      } else if (DATE_FIELDS.includes(f)) {
        const val = valueOf(f); if (!hasVal(val) || isDefaultDate(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${formatDate(val)}`, '');
      } else {
        const val = valueOf(f); if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [getEffectiveArray, hasVal, fmtVal, formatDate, numberShows]);

  const copyAllText = useCallback(async () => {
    let text = '=== COMPREHENSIVE MEDICATION REVIEW ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Comprehensive Medication Review ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(null); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(null); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    if (!fieldShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDate = DATE_FIELDS.includes(fn); const isNumber = NUMBER_FIELDS.includes(fn); const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const enumOpts = !isBoolean && !isNumber && !isDate && ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isDate ? formatDate(val) : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const startEdit = () => {
      setSaveError(null); setEditingField(editKey);
      if (isDate) setEditValue(toDateInputValue(val));
      else if (isBoolean) setEditValue(val ? 'Yes' : 'No');
      else if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); }
      else setEditValue(fmtVal(val));
    };
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBoolean ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
              ) : isDate ? (
                <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              ) : isNumber ? (
                numberStepper(() => handleSaveField(record, fn, idx, sid))
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  // Shared text row (whole array item OR one comma part).
  const renderTextRow = (value, keyId, badge, onSave) => {
    const isEditing = editingField === keyId;
    return (
      <div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(keyId); setEditValue(String(value)); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && editingField === keyId && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(String(value))}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[keyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(value), keyId); }}>{copiedItems[keyId] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
      </div>
    );
  };

  const renderArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, ai) => {
          const itemStr = String(item);
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;
          const parsed = parseLabel(itemStr);
          const content = parsed ? parsed.content : itemStr;
          const commaItems = splitByComma(content);
          if (commaItems.length >= 3) {
            return (
              <div key={ai} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: ai > 0 ? 8 : 0 } : undefined}>
                {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}-${idx}-ai${ai}-c${ciIdx}`;
                  return <React.Fragment key={ciIdx}>{renderTextRow(ci, commaKey, editedFields[commaKey], () => saveArrayCommaItem(record, fn, idx, sid, ai, ciIdx))}</React.Fragment>;
                })}
              </div>
            );
          }
          const arrKey = `${fn}-${idx}-ai${ai}`;
          return <React.Fragment key={ai}>{renderTextRow(itemStr, arrKey, editedFields[arrKey], () => saveArrayItem(record, fn, idx, sid, ai))}</React.Fragment>;
        })}
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return fieldShows(record, f, idx);
    });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="comprehensive-medication-review" ref={containerRef}><div className="document-header"><h2 className="document-title">Comprehensive Medication Review</h2></div><div className="empty-state">No comprehensive medication review records available</div></div>);
  }

  return (
    <div className="comprehensive-medication-review" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Comprehensive Medication Review</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ComprehensiveMedicationReviewPDFTemplate document={pdfData} />} fileName="Comprehensive_Medication_Review.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search comprehensive medication review..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Comprehensive Medication Review ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'review-info')}
            {renderMixedSection(record, idx, 'risk-scores')}
            {renderMixedSection(record, idx, 'high-risk')}
            {renderMixedSection(record, idx, 'interactions')}
            {renderMixedSection(record, idx, 'dosing-adjustments')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComprehensiveMedicationReviewDocument;
