/**
 * DischargePlanningDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: discharge_planning
 *
 * 13 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. discharge-overview: expectedLOS, dischargeDestination, returnToWork (sentence)
 *   3. followup-instructions: followUpInstructions[] (string array)
 *   4. activity-restrictions: activityRestrictions[] (string array)
 *   5. warning-signs: warningSignsToWatch[] (string array)
 *   6. discharge-meds: comprehensiveDischargeReadiness.dischargeMedications — reconciliationCompleted (bool), newMedications[] ({medication,indication,duration})
 *   7. patient-education: comprehensiveDischargeReadiness.patientEducation — teachBackCompleted (bool), writtenInstructions (bool), topicsReviewed[]
 *   8. followup-scheduling: comprehensiveDischargeReadiness.followUpScheduling.appointments[] ({provider,timing,scheduled})
 *   9. readmission-risk: comprehensiveDischargeReadiness.readmissionRisk — riskLevel, riskFactors[], mitigationStrategies[]
 *  10. assessment-section: assessment (sentence)
 *  11. plan-section: plan (sentence)
 *  12. recommendations-section: recommendations[] ({recommendation, date})
 *  13. notes-section: notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DischargePlanningDocumentPDFTemplate from '../pdf-templates/DischargePlanningDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DischargePlanningDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles, '-' under every field
   sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   by 0.1, etc. The customer TYPES the exact value; we NEVER impose a fixed increment (memory 6a4a3fae). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = localEdits key minus the "-<idx>" suffix) */
const DRAFT_KEY = 'discharge_planningPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'discharge-overview': 'Discharge Overview',
  'followup-instructions': 'Follow-up Instructions',
  'activity-restrictions': 'Activity Restrictions',
  'warning-signs': 'Warning Signs to Watch',
  'medical-stability': 'Medical Stability',
  'discharge-meds': 'Discharge Medications',
  'patient-education': 'Patient Education',
  'followup-scheduling': 'Follow-up Scheduling',
  'readmission-risk': 'Readmission Risk',
  'findings-section': 'Findings',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  expectedLOS: 'Expected Length of Stay',
  dischargeDestination: 'Discharge Destination',
  returnToWork: 'Return to Work',
  followUpInstructions: 'Follow-up Instructions',
  activityRestrictions: 'Activity Restrictions',
  warningSignsToWatch: 'Warning Signs to Watch',
  reconciliationCompleted: 'Reconciliation Completed',
  newMedications: 'New Medications',
  teachBackCompleted: 'Teach-Back Completed',
  writtenInstructions: 'Written Instructions Provided',
  topicsReviewed: 'Topics Reviewed',
  appointments: 'Appointments',
  riskLevel: 'Risk Level',
  riskFactors: 'Risk Factors',
  mitigationStrategies: 'Mitigation Strategies',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'discharge-overview': ['expectedLOS', 'dischargeDestination', 'returnToWork'],
  'followup-instructions': ['followUpInstructions'],
  'activity-restrictions': ['activityRestrictions'],
  'warning-signs': ['warningSignsToWatch'],
  'medical-stability': ['comprehensiveDischargeReadiness.medicalStability'],
  'discharge-meds': ['comprehensiveDischargeReadiness.dischargeMedications'],
  'patient-education': ['comprehensiveDischargeReadiness.patientEducation'],
  'followup-scheduling': ['comprehensiveDischargeReadiness.followUpScheduling'],
  'readmission-risk': ['comprehensiveDischargeReadiness.readmissionRisk'],
  'findings-section': ['findings'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'returnToWork'];
const DATE_FIELDS = ['date'];
const STRING_ARRAY_FIELDS = ['followUpInstructions', 'activityRestrictions', 'warningSignsToWatch'];

/* humanizeKey: camelCase / snake_case → "Title Case" */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "4/5" ratios */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

const splitRatio = (text) => {
  if (text === null || text === undefined) return null;
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: m[1], denom: m[2] };
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
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

/* splitBySemicolon: split a sentence part on semicolons. */
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);

/* splitGuardedComma: comma split with the 4 guards (memory 6a4a4cd5 / 6a4771843) — paren-aware; skip
   no-space commas ("$18,000"); keep Oxford ", and/or X" attached on EITHER side; skip date commas
   ("January 8, 2026"); next non-space char must be a letter/'('/'>'. Gated to >=3 items by the caller. */
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const DischargePlanningDocument = ({ document: docProp }) => {
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
      if (r?.discharge_planning) return Array.isArray(r.discharge_planning) ? r.discharge_planning : [r.discharge_planning];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.discharge_planning) return Array.isArray(dd.discharge_planning) ? dd.discharge_planning : [dd.discharge_planning]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE DRAFTS ═══════ */
  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      let rid = null;
      if (record && record._id) rid = typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id));
      const recDrafts = rid ? store[rid] : null;
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
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    // Support dot-notation for nested fields
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return val;
    }
    return record[fn];
  }, [localEdits]);

  const getNestedValue = useCallback((record, path, idx) => {
    const k = `${path}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const parts = path.split('.');
    let val = record;
    for (const p of parts) { val = val?.[p]; }
    return val;
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) {
      const v = localEdits[k];
      return Array.isArray(v) ? v : [];
    }
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return Array.isArray(val) ? val : [];
    }
    return Array.isArray(record[fn]) ? record[fn] : [];
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

    // Check all content in the section
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;

      // Nested path handling
      if (f.includes('.')) {
        const parts = f.split('.');
        let val = record;
        for (const p of parts) { val = val?.[p]; }
        if (val && typeof val === 'object') {
          const objStr = JSON.stringify(val).toLowerCase();
          if (objStr.includes(phrase)) return true;
        }
        continue;
      }

      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'object') {
              if (JSON.stringify(item).toLowerCase().includes(phrase)) return true;
            } else {
              if (String(item).toLowerCase().includes(phrase)) return true;
            }
          }
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
      if (Array.isArray(val)) {
        return val.some(item => {
          if (typeof item === 'object') return JSON.stringify(item).toLowerCase().includes(phrase);
          return String(item).toLowerCase().includes(phrase);
        });
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Discharge Planning ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      // Deep search across all fields
      const allText = JSON.stringify(record).toLowerCase();
      if (allText.includes(phrase)) return true;
      return false;
    });
  }, [records, searchTerm]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length >= 2) {
            // Nested set: comprehensiveDischargeReadiness.dischargeMedications.reconciliationCompleted etc
            let obj = merged;
            for (let i = 0; i < dotParts.length - 1; i++) {
              if (!obj[dotParts[i]]) obj[dotParts[i]] = {};
              obj[dotParts[i]] = { ...obj[dotParts[i]] };
              obj = obj[dotParts[i]];
            }
            obj[dotParts[dotParts.length - 1]] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // stageDraft = stage a single field edit as a DRAFT locally + persist to the pending-drafts
  // localStorage store (survives refresh). NOT written to MongoDB and NOT shown in the PDF until the
  // user clicks Approve (handleApproveSection commits). `extraLocal` lets a caller also seed companion
  // localEdits keys (e.g. the full array) that should render but are NOT themselves pending.
  const stageDraft = useCallback((record, idx, editKey, value, extraLocal) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, ...(extraLocal || {}), [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // fieldPart = editKey minus the trailing "-<idx>" suffix
    const suffix = `-${idx}`;
    const fieldPart = editKey.endsWith(suffix) ? editKey.slice(0, -suffix.length) : editKey;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, idx, editKey, saveVal);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrIdx}-${idx}`;
    // Seed the full-array localEdits key for rendering/copy parity, but keep ONLY the per-item key
    // pending so Approve commits one write (field=fn, arrayIndex=arrIdx) — mirroring the original.
    const currentArr = getEffectiveArray(record, fn, idx);
    const updated = [...currentArr];
    updated[arrIdx] = value;
    stageDraft(record, idx, editKey, value, { [`${fn}-${idx}`]: updated });
  }, [safeId, getEffectiveArray, stageDraft]);

  const handleSaveNestedField = useCallback((record, fieldPath, idx, value, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = editTrackingKey || `${fieldPath}-${idx}`;
    stageDraft(record, idx, editKey, value);
  }, [safeId, stageDraft]);

  const handleSaveNestedArrayItem = useCallback((record, fieldPath, idx, arrIdx, subField, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fieldPath}.${arrIdx}.${subField}-${idx}`;
    stageDraft(record, idx, editKey, value);
  }, [safeId, stageDraft]);

  // saveSentence = stage the rebuilt full-text DRAFT locally (no DB write). Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, idx, editKey, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, idx, editKey, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
  }

  /* −/+ stepper: nudge editValue by the value's own precision (stepFor), clamped >= 0. */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev); const base = isNaN(n) ? 0 : n;
      const stepStr = stepFor(prev); const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat((base + dir * step).toFixed(decimals));
      if (next < 0) next = 0;
      return String(next);
    });
  };

  /* saveSentenceLeaf: edit ONE leaf of an unlabeled sentence addressed by (sIdx, pi=semicolon-part,
     ci=guarded-comma-item). Rebuilds part=items.join(', '), sentence=parts.join('; '), full text via
     reconstructFullText. Empty edit removes the leaf (memory 6a4a4cd5). */
  function saveSentenceLeaf(record, fn, idx, sIdx, pi, ci, isComma) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const semParts = splitBySemicolon(sentences[sIdx] || '');
    const edited = editValue.trim();
    if (isComma) {
      const items = splitGuardedComma(semParts[pi] || '');
      if (!edited || /^[;.,!?]+$/.test(edited)) { items.splice(ci, 1); }
      else { const subParts = splitGuardedComma(edited); if (subParts.length > 1) items.splice(ci, 1, ...subParts); else items[ci] = edited; }
      semParts[pi] = items.join(', ');
    } else {
      if (!edited || /^[;.,!?]+$/.test(edited)) { semParts.splice(pi, 1); }
      else { semParts[pi] = edited; }
    }
    sentences[sIdx] = semParts.filter(p => p && p.trim()).join('; ');
    const fullText = reconstructFullText(sentences);
    setSaveError(null);
    stageDraft(record, idx, `${fn}-${idx}`, fullText);
    setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-p${pi}-c${ci}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`) || (k.includes(f) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`) || k.includes(f))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then flag approved, then
  // clear pending so the committed values now flow into pdfData/PDF. This is the ONLY DB writer.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending edit keys for THIS record whose field belongs to THIS section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
      return fields.some(f => f === fieldPart || f === baseField || fieldPart.startsWith(`${f}.`) || fieldPart === f);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.../.../<index>"
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        // Trailing dot-segment is an arrayIndex ONLY when it is purely numeric.
        if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(lastSeg, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/discharge_planning/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/discharge_planning/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`) || k.includes(f)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.includes(f)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DischargePlanning] Approve error:', err); }
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
  /* Copy lines for a sentence field: labeled group (label + comma rows) OR unlabeled → semicolon parts,
     each guarded-comma (>=3) expanded. Running number (unlabeled continues) — memory 6a4a4cd5. */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        lines.push(parsed.label + ':');
        if (parts.length >= 2) parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        else lines.push(`  ${n++}. ${parsed.value}`);
        return;
      }
      splitBySemicolon(s).forEach(part => {
        const items = splitGuardedComma(part);
        if (items.length >= 3) items.forEach(it => { lines.push(`${n++}. ${it}`); });
        else lines.push(`${n++}. ${part.replace(/[;.]+$/, '').trim()}`);
      });
    });
    return lines;
  }, [splitBySentence]);

  /* Canonical section copy: title + '='; every field = sub-label + '-' + numbered value row(s). NEVER
     side-by-side "Label: value" (one-pass items 1-3). Array-of-objects (meds/appts) = identity header
     numbered running + each secondary attr as its own sub-label + numbered value (mirrors the JSX). */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const scalarBlock = (label, val, isDate) => { text += `${label}\n${COPY_LINE_DASH}\n1. ${isDate ? formatDate(val) : fmtVal(val)}\n\n`; };
    const arrayBlock = (label, arr) => { if (label) text += `${label}\n${COPY_LINE_DASH}\n`; arr.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; };
    const objectsBlock = (items, headerFmt, subFields) => {
      let n = 1;
      items.forEach(item => {
        const hv = headerFmt(item);
        if (hv === undefined || hv === null || hv === '') return;
        text += `${n++}. ${hv}\n`;
        subFields.forEach(f => {
          const v = item[f.key];
          if (v === undefined || v === null || v === '') return;
          const disp = f.type === 'date' ? formatDate(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
          text += `${f.label}\n${COPY_LINE_DASH}\n1. ${disp}\n`;
        });
      });
      text += '\n';
    };
    const cdr = record.comprehensiveDischargeReadiness || {};

    if (sid === 'session-info') {
      ['date', 'provider', 'facility', 'status'].forEach(f => { const val = getFieldValue(record, f, idx); if (!hasVal(val)) return; scalarBlock(FIELD_LABELS[f] || f, val, f === 'date'); });
    } else if (sid === 'discharge-overview') {
      ['expectedLOS', 'dischargeDestination', 'returnToWork'].forEach(f => {
        const val = getFieldValue(record, f, idx); if (!hasVal(val)) return;
        const label = FIELD_LABELS[f] || f;
        if (SENTENCE_FIELDS.includes(f)) { text += `${label}\n${COPY_LINE_DASH}\n`; formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; }); text += '\n'; }
        else scalarBlock(label, val, false);
      });
    } else if (['followup-instructions', 'activity-restrictions', 'warning-signs'].includes(sid)) {
      const fn = sid === 'followup-instructions' ? 'followUpInstructions' : sid === 'activity-restrictions' ? 'activityRestrictions' : 'warningSignsToWatch';
      const label = FIELD_LABELS[fn] || fn;
      arrayBlock(label.toLowerCase() === title.toLowerCase() ? '' : label, getEffectiveArray(record, fn, idx));
    } else if (sid === 'medical-stability') {
      const ms = cdr.medicalStability || {};
      if (ms.vitalSignsStable !== undefined) scalarBlock('Vital Signs Stable', ms.vitalSignsStable, false);
      if (ms.mobilizing !== undefined) scalarBlock('Mobilizing', ms.mobilizing, false);
    } else if (sid === 'discharge-meds') {
      const dm = cdr.dischargeMedications || {};
      if (dm.reconciliationCompleted !== undefined) scalarBlock('Reconciliation Completed', dm.reconciliationCompleted, false);
      const meds = dm.newMedications || [];
      if (meds.length > 0) { text += `New Medications\n${COPY_LINE_DASH}\n`; objectsBlock(meds, m => m.medication || '', [{ key: 'indication', label: 'Indication' }, { key: 'duration', label: 'Duration' }]); }
    } else if (sid === 'patient-education') {
      const pe = cdr.patientEducation || {};
      if (pe.teachBackCompleted !== undefined) scalarBlock('Teach-Back Completed', pe.teachBackCompleted, false);
      if (pe.writtenInstructions !== undefined) scalarBlock('Written Instructions Provided', pe.writtenInstructions, false);
      const topics = pe.topicsReviewed || [];
      if (topics.length > 0) arrayBlock('Topics Reviewed', topics);
    } else if (sid === 'followup-scheduling') {
      const appts = (cdr.followUpScheduling || {}).appointments || [];
      if (appts.length > 0) objectsBlock(appts, a => a.provider || '', [{ key: 'timing', label: 'Timing' }, { key: 'appointmentDate', label: 'Appointment Date', type: 'date' }, { key: 'scheduled', label: 'Scheduled' }]);
    } else if (sid === 'readmission-risk') {
      const rr = cdr.readmissionRisk || {};
      if (hasVal(rr.riskLevel)) scalarBlock('Risk Level', rr.riskLevel, false);
      if (rr.riskFactors?.length > 0) arrayBlock('Risk Factors', rr.riskFactors);
      if (rr.mitigationStrategies?.length > 0) arrayBlock('Mitigation Strategies', rr.mitigationStrategies);
    } else if (sid === 'recommendations-section') {
      const recs = getEffectiveArray(record, 'recommendations', idx);
      const grouped = {};
      recs.forEach(r2 => { const d = r2.date || 'Unknown'; if (!grouped[d]) grouped[d] = []; grouped[d].push(r2.recommendation || ''); });
      Object.entries(grouped).forEach(([d, items]) => { text += `${formatDate(d) || d}\n${COPY_LINE_DASH}\n`; items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; });
    } else if (sid === 'results-section') {
      const val = getFieldValue(record, 'results', idx);
      if (hasVal(val) && typeof val === 'object') {
        const walk = (obj) => { Object.entries(obj).forEach(([k, v]) => { if (isEmptyDeep(v)) return; if (isScalar(v)) { text += `${humanizeKey(k)}\n${COPY_LINE_DASH}\n1. ${fmtScalar(v)}\n`; } else { text += `${humanizeKey(k)}\n${COPY_LINE_DASH}\n`; walk(v); } }); };
        walk(val); text += '\n';
      }
    } else {
      const fn = sid === 'findings-section' ? 'findings' : sid === 'assessment-section' ? 'assessment' : sid === 'plan-section' ? 'plan' : 'notes';
      const val = getFieldValue(record, fn, idx);
      if (hasVal(val)) { formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; }); text += '\n'; }
    }
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Discharge Planning\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Discharge Planning ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty lines) is empty.
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
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
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
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING ARRAY SECTION ═══════ */
  const renderStringArraySection = (record, idx, fn, sid) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      if (!item) return null;
      const itemStr = String(item);
      if (searchTerm.trim() && !phraseMatch && !contentMatches(itemStr)) return null;

      const editKey = `${fn}.${arrIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const effectiveVal = localEdits[editKey] !== undefined ? localEdits[editKey] : itemStr;

      return (
        <div key={arrIdx}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(effectiveVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(effectiveVal)}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(effectiveVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: BOOLEAN FIELD (nested) ═══════ */
  const renderBooleanField = (record, fieldPath, idx, label, sid) => {
    const val = getNestedValue(record, fieldPath, idx);
    if (val === undefined || val === null) return null;
    const editKey = `${fieldPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = val ? 'Yes' : 'No';

    return (
      <div key={fieldPath} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'yes' : 'no'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveNestedField(record, fieldPath, idx, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NESTED ARRAY OF OBJECTS (medications, appointments) ═══════ */
  const renderNestedArrayOfObjects = (record, idx, basePath, fields, sid, groupLabel) => {
    const parts = basePath.split('.');
    let arr = record;
    for (const p of parts) { arr = arr?.[p]; }
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    const cards = arr.map((item, arrIdx) => {
      if (!item || typeof item !== 'object') return null;
      const itemStr = JSON.stringify(item).toLowerCase();
      if (searchTerm.trim() && !phraseMatch && !itemStr.includes(searchTerm.toLowerCase().trim())) return null;

      return (
        <div key={arrIdx} className="rec-mini-card">
          {fields.map(({ key, label, type }, fi) => {
            const rawVal = item[key];
            if (rawVal === undefined || rawVal === null || rawVal === '') return null;
            const fieldPath = `${basePath}.${arrIdx}.${key}`;
            const editKey = `${fieldPath}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const effectiveVal = localEdits[editKey] !== undefined ? localEdits[editKey] : rawVal;
            const isBool = typeof rawVal === 'boolean';
            const isDate = type === 'date';
            const isHeader = fi === 0; // first field = the item's identity (medication / provider) — no sub-label
            const displayVal = isBool ? (effectiveVal ? 'Yes' : 'No') : isDate ? formatDate(effectiveVal) : String(effectiveVal);

            return (
              <div key={key}>
                {!isHeader && <div className="nested-subtitle sub-label" style={{ marginTop: 4 }}>{highlightText(label)}</div>}
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (effectiveVal ? 'yes' : 'no') : isDate ? toInputDate(effectiveVal) : displayVal); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {isBool ? (
                        <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : isDate ? (
                        <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
                      ) : (
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      )}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const sv = isBool ? (editValue === 'yes') : editValue.trim(); handleSaveNestedArrayItem(record, basePath, idx, arrIdx, key, sv); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(isHeader ? displayVal : `${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
    if (!groupLabel) return cards;
    return (<><div className="nested-subtitle">{highlightText(groupLabel)}</div>{cards}</>);
  };

  /* ═══════ RENDER: NESTED STRING ARRAY ═══════ */
  const renderNestedStringArray = (record, idx, basePath, label, sid) => {
    const parts = basePath.split('.');
    let arr = record;
    for (const p of parts) { arr = arr?.[p]; }
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          const itemStr = String(item);
          if (searchTerm.trim() && !phraseMatch && !contentMatches(itemStr)) return null;
          const editKey = `${basePath}.${arrIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const effectiveVal = localEdits[editKey] !== undefined ? localEdits[editKey] : itemStr;

          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(effectiveVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveNestedField(record, `${basePath}.${arrIdx}`, idx, editValue.trim(), editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(effectiveVal)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(effectiveVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS (grouped by date) ═══════ */
  const renderRecommendationsSection = (record, idx, sid) => {
    const recs = getEffectiveArray(record, 'recommendations', idx);
    if (recs.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    // Group by date
    const grouped = {};
    recs.forEach((r2, rIdx) => {
      const d = r2.date || 'Unknown';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({ ...r2, _origIdx: rIdx });
    });

    return Object.entries(grouped).map(([dateKey, items]) => (
      <div key={dateKey} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(formatDate(dateKey) || dateKey)}</div>
        {items.map((item) => {
          const recText = item.recommendation || '';
          if (searchTerm.trim() && !phraseMatch && !contentMatches(recText) && !contentMatches(dateKey)) return null;
          const editKey = `recommendations.${item._origIdx}.recommendation-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const effectiveVal = localEdits[editKey] !== undefined ? localEdits[editKey] : recText;

          return (
            <div key={item._origIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(effectiveVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveNestedArrayItem(record, 'recommendations', idx, item._origIdx, 'recommendation', editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(effectiveVal)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(effectiveVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    ));
  };

  /* ═══════ SAVE: OBJECT LEAF (dotted path) ═══════ */
  // Stage the rebuilt root-object clone as a DRAFT (no DB write). Approve commits field=rootField
  // with the whole updated object (equivalent end-state to the original dotted-leaf $set).
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraft(record, idx, `${rootField}-${idx}`, clone);
    // Granular badge marker on the specific leaf row
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
  }, [safeId, localEdits, stageDraft]);

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) {
                    newVal = editValue === 'yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
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

  /* ═══════ RENDER: OBJECT FIELD (root entry for OBJECT-typed fields like results) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (commaItems.length >= 2) {
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                      if (!ciMatches && searchTerm.trim()) return null;
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s3 => s3.replace(/[;.]+$/, '').trim()).filter(s3 => s3); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, idx, `${fn}-${idx}`, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
                                <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              }
            }

            /* Labeled sentence with < 2 comma items → single labeled row */
            if (parsed.isLabeled) {
              return (
                <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                  <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.value); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = `${parsed.label}: ${editValue.trim()}`; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, idx, `${fn}-${idx}`, fullText); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.value)}</span><span className="edit-indicator">✎</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            }

            /* Unlabeled sentence → split by semicolon, then guarded comma (>=3) into leaf rows (6a4a4cd5) */
            const semParts = splitBySemicolon(sentence);
            const leaves = [];
            semParts.forEach((part, pi) => {
              const items = splitGuardedComma(part);
              if (items.length >= 3) items.forEach((it, ci) => leaves.push({ pi, ci, text: it, comma: true }));
              else leaves.push({ pi, ci: 0, text: part.replace(/[;.]+$/, '').trim(), comma: false });
            });
            return (
              <div key={sIdx}>
                {leaves.map((leaf, li) => {
                  const leafKey = `${fn}-${idx}-s${sIdx}-p${leaf.pi}-c${leaf.ci}`;
                  const leafEditing = editingField === leafKey;
                  const leafBadge = editedSentences[leafKey];
                  const leafMatches = phraseMatch || labelMatch || !searchTerm.trim() || leaf.text.toLowerCase().includes(searchTerm.toLowerCase().trim());
                  if (!leafMatches && searchTerm.trim()) return null;
                  return (
                    <div key={li}>
                      <div className={`numbered-row ${leafBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!leafEditing) { setEditingField(leafKey); setEditValue(leaf.text); setSaveError(null); } }}>
                        {leafEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentenceLeaf(record, fn, idx, sIdx, leaf.pi, leaf.ci, leaf.comma); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(leaf.text)}</span><span className="edit-indicator">✎</span></div>
                            <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leaf.text, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {leafBadge && <span className={`modified-badge ${leafBadge === 'added' ? 'added' : ''}`}>{leafBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                    </div>
                  );
                })}
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

    // Check if section has any values
    let hasAnyVal = false;
    if (sid === 'session-info') {
      hasAnyVal = ['date', 'provider', 'facility', 'status'].some(f => hasVal(getFieldValue(record, f, idx)));
    } else if (sid === 'discharge-overview') {
      hasAnyVal = ['expectedLOS', 'dischargeDestination', 'returnToWork'].some(f => hasVal(getFieldValue(record, f, idx)));
    } else if (['followup-instructions', 'activity-restrictions', 'warning-signs'].includes(sid)) {
      const fn = sid === 'followup-instructions' ? 'followUpInstructions' : sid === 'activity-restrictions' ? 'activityRestrictions' : 'warningSignsToWatch';
      hasAnyVal = getEffectiveArray(record, fn, idx).length > 0;
    } else if (sid === 'medical-stability') {
      const cdr = record.comprehensiveDischargeReadiness || {};
      const ms = cdr.medicalStability || {};
      hasAnyVal = ms.vitalSignsStable !== undefined || ms.mobilizing !== undefined;
    } else if (sid === 'discharge-meds') {
      const cdr = record.comprehensiveDischargeReadiness || {};
      const dm = cdr.dischargeMedications || {};
      hasAnyVal = dm.reconciliationCompleted !== undefined || (dm.newMedications && dm.newMedications.length > 0);
    } else if (sid === 'patient-education') {
      const cdr = record.comprehensiveDischargeReadiness || {};
      const pe = cdr.patientEducation || {};
      hasAnyVal = pe.teachBackCompleted !== undefined || pe.writtenInstructions !== undefined || (pe.topicsReviewed && pe.topicsReviewed.length > 0);
    } else if (sid === 'followup-scheduling') {
      const cdr = record.comprehensiveDischargeReadiness || {};
      const fs = cdr.followUpScheduling || {};
      hasAnyVal = fs.appointments && fs.appointments.length > 0;
    } else if (sid === 'readmission-risk') {
      const cdr = record.comprehensiveDischargeReadiness || {};
      const rr = cdr.readmissionRisk || {};
      hasAnyVal = hasVal(rr.riskLevel) || (rr.riskFactors && rr.riskFactors.length > 0) || (rr.mitigationStrategies && rr.mitigationStrategies.length > 0);
    } else if (sid === 'recommendations-section') {
      hasAnyVal = getEffectiveArray(record, 'recommendations', idx).length > 0;
    } else if (sid === 'results-section') {
      const val = getFieldValue(record, 'results', idx);
      hasAnyVal = hasVal(val) && !isScalar(val) && Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).length > 0;
    } else {
      const fn = sid === 'findings-section' ? 'findings' : sid === 'assessment-section' ? 'assessment' : sid === 'plan-section' ? 'plan' : 'notes';
      hasAnyVal = hasVal(getFieldValue(record, fn, idx));
    }
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

          {/* Session Info */}
          {sid === 'session-info' && (
            <>
              {renderDateField(record, 'date', idx, sid)}
              {renderEditableField(record, 'provider', idx, sid, title)}
              {renderEditableField(record, 'facility', idx, sid, title)}
              {renderEditableField(record, 'status', idx, sid, title)}
            </>
          )}

          {/* Discharge Overview */}
          {sid === 'discharge-overview' && (
            <>
              {renderEditableField(record, 'expectedLOS', idx, sid, title)}
              {renderEditableField(record, 'dischargeDestination', idx, sid, title)}
              {SENTENCE_FIELDS.includes('returnToWork') ? renderSentenceEditableField(record, 'returnToWork', idx, sid, title) : renderEditableField(record, 'returnToWork', idx, sid, title)}
            </>
          )}

          {/* String arrays */}
          {sid === 'followup-instructions' && renderStringArraySection(record, idx, 'followUpInstructions', sid)}
          {sid === 'activity-restrictions' && renderStringArraySection(record, idx, 'activityRestrictions', sid)}
          {sid === 'warning-signs' && renderStringArraySection(record, idx, 'warningSignsToWatch', sid)}

          {/* Medical Stability */}
          {sid === 'medical-stability' && (
            <>
              {renderBooleanField(record, 'comprehensiveDischargeReadiness.medicalStability.vitalSignsStable', idx, 'Vital Signs Stable', sid)}
              {renderBooleanField(record, 'comprehensiveDischargeReadiness.medicalStability.mobilizing', idx, 'Mobilizing', sid)}
            </>
          )}

          {/* Discharge Medications */}
          {sid === 'discharge-meds' && (
            <>
              {renderBooleanField(record, 'comprehensiveDischargeReadiness.dischargeMedications.reconciliationCompleted', idx, 'Reconciliation Completed', sid)}
              {renderNestedArrayOfObjects(record, idx, 'comprehensiveDischargeReadiness.dischargeMedications.newMedications', [
                { key: 'medication', label: 'Medication' },
                { key: 'indication', label: 'Indication' },
                { key: 'duration', label: 'Duration' },
              ], sid, 'New Medications')}
            </>
          )}

          {/* Patient Education */}
          {sid === 'patient-education' && (
            <>
              {renderBooleanField(record, 'comprehensiveDischargeReadiness.patientEducation.teachBackCompleted', idx, 'Teach-Back Completed', sid)}
              {renderBooleanField(record, 'comprehensiveDischargeReadiness.patientEducation.writtenInstructions', idx, 'Written Instructions Provided', sid)}
              {renderNestedStringArray(record, idx, 'comprehensiveDischargeReadiness.patientEducation.topicsReviewed', 'Topics Reviewed', sid)}
            </>
          )}

          {/* Follow-up Scheduling */}
          {sid === 'followup-scheduling' && (
            <>
              {renderNestedArrayOfObjects(record, idx, 'comprehensiveDischargeReadiness.followUpScheduling.appointments', [
                { key: 'provider', label: 'Provider' },
                { key: 'timing', label: 'Timing' },
                { key: 'appointmentDate', label: 'Appointment Date', type: 'date' },
                { key: 'scheduled', label: 'Scheduled' },
              ], sid)}
            </>
          )}

          {/* Readmission Risk */}
          {sid === 'readmission-risk' && (
            <>
              {renderEditableField(record, 'comprehensiveDischargeReadiness.readmissionRisk.riskLevel', idx, sid, title)}
              {renderNestedStringArray(record, idx, 'comprehensiveDischargeReadiness.readmissionRisk.riskFactors', 'Risk Factors', sid)}
              {renderNestedStringArray(record, idx, 'comprehensiveDischargeReadiness.readmissionRisk.mitigationStrategies', 'Mitigation Strategies', sid)}
            </>
          )}

          {/* Findings / Assessment / Plan / Notes (sentence fields) */}
          {sid === 'findings-section' && renderSentenceEditableField(record, 'findings', idx, sid, title)}
          {sid === 'assessment-section' && renderSentenceEditableField(record, 'assessment', idx, sid, title)}
          {sid === 'plan-section' && renderSentenceEditableField(record, 'plan', idx, sid, title)}
          {sid === 'notes-section' && renderSentenceEditableField(record, 'notes', idx, sid, title)}

          {/* Results (recursive object) */}
          {sid === 'results-section' && renderObjectField(record, 'results', idx, sid)}

          {/* Recommendations */}
          {sid === 'recommendations-section' && renderRecommendationsSection(record, idx, sid)}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="discharge-planning-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Discharge Planning</h2></div>
        <div className="empty-state">No discharge planning records available</div>
      </div>
    );
  }

  return (
    <div className="discharge-planning-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Discharge Planning</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DischargePlanningDocumentPDFTemplate document={pdfData} />} fileName="Discharge_Planning.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search discharge planning..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Discharge Planning ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'discharge-overview')}
            {renderSection(record, idx, 'followup-instructions')}
            {renderSection(record, idx, 'activity-restrictions')}
            {renderSection(record, idx, 'warning-signs')}
            {renderSection(record, idx, 'medical-stability')}
            {renderSection(record, idx, 'discharge-meds')}
            {renderSection(record, idx, 'patient-education')}
            {renderSection(record, idx, 'followup-scheduling')}
            {renderSection(record, idx, 'readmission-risk')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'results-section')}
            {renderSection(record, idx, 'recommendations-section')}
            {renderSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DischargePlanningDocument;
