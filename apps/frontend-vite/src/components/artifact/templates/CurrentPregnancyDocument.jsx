/**
 * CurrentPregnancyDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: current_pregnancy
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CurrentPregnancyDocumentPDFTemplate from '../pdf-templates/CurrentPregnancyDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueMonthPicker from '../components/BlueMonthPicker';
import secureApiClient from '../../../services/secureApiClient';
import './CurrentPregnancyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field key, e.g.
   "provider", "fetalEcho.performed", or a whole array/object value) */
const DRAFT_KEY = 'current_pregnancyPendingEdits';
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
  pregnancyInfo: 'Pregnancy Info',
  complicationsRisk: 'Complications & Risk',
  fetalAssessment: 'Fetal Assessment',
  insulinManagement: 'Insulin Management',
  monitoringSupport: 'Monitoring & Support',
  clinicalNarrative: 'Clinical Narrative',
  recommendationsResults: 'Recommendations & Results',
  notesSection: 'Notes',
};

const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  gestationalAge: 'Gestational Age', edd: 'EDD', eddConfirmationMethod: 'EDD Confirmation Method',
  lmp: 'LMP', conceptionMethod: 'Conception Method', singleton: 'Singleton',
  multipleGestation: 'Multiple Gestation',
  pregnancyComplications: 'Pregnancy Complications', highRiskFactors: 'High Risk Factors',
  currentSymptoms: 'Current Symptoms',
  'fetalEcho.performed': 'Performed', 'fetalEcho.result': 'Result', 'fetalEcho.indication': 'Indication',
  'insulinAdjustmentProtocol.fastingInsulin': 'Fasting Insulin',
  'insulinAdjustmentProtocol.mealInsulin': 'Meal Insulin',
  'insulinAdjustmentProtocol.adjustmentInstructions': 'Adjustment Instructions',
  ketoneMonitoringInstructions: 'Ketone Monitoring Instructions',
  virtualCheckIns: 'Virtual Check-Ins',
  culturalConsiderations: 'Cultural Considerations',
  riskCounseling: 'Risk Counseling',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', notes: 'Notes',
};

const SECTION_FIELDS = {
  pregnancyInfo: ['date', 'type', 'provider', 'facility', 'status', 'gestationalAge', 'edd', 'eddConfirmationMethod', 'lmp', 'conceptionMethod', 'singleton', 'multipleGestation'],
  complicationsRisk: ['pregnancyComplications', 'highRiskFactors', 'currentSymptoms'],
  fetalAssessment: ['fetalEcho.performed', 'fetalEcho.result', 'fetalEcho.indication'],
  insulinManagement: ['insulinAdjustmentProtocol.fastingInsulin', 'insulinAdjustmentProtocol.mealInsulin', 'insulinAdjustmentProtocol.adjustmentInstructions'],
  monitoringSupport: ['ketoneMonitoringInstructions', 'virtualCheckIns', 'culturalConsiderations', 'riskCounseling'],
  clinicalNarrative: ['findings', 'assessment', 'plan'],
  recommendationsResults: ['recommendations', 'results'],
  notesSection: ['notes'],
};

const SECTION_ORDER = ['pregnancyInfo', 'complicationsRisk', 'fetalAssessment', 'insulinManagement', 'monitoringSupport', 'clinicalNarrative', 'recommendationsResults', 'notesSection'];

const ARRAY_FIELDS = ['pregnancyComplications', 'highRiskFactors', 'currentSymptoms', 'insulinAdjustmentProtocol.adjustmentInstructions', 'culturalConsiderations', 'riskCounseling', 'recommendations'];
const SENTENCE_FIELDS = ['ketoneMonitoringInstructions', 'insulinAdjustmentProtocol.fastingInsulin', 'insulinAdjustmentProtocol.mealInsulin', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['multipleGestation', 'results'];
const BOOLEAN_FIELDS = ['singleton', 'fetalEcho.performed'];
const DATE_FIELDS = ['date'];

const KEY_OVERRIDES = { edd: 'EDD', lmp: 'LMP', gdm: 'GDM', poc: 'POC', bmi: 'BMI', hr: 'HR' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

/* Fixed-choice fields → dropdown (status). fmtEnumVal maps stored value (any case) to its canonical option. */
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const fmtEnumVal = (f, v) => { const opts = ENUM_FIELDS[f]; if (opts) { const hit = opts.find(o => o.toLowerCase() === String(v ?? '').toLowerCase().trim()); if (hit) return hit; } return null; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
/* Guarded: paren-aware; keep Oxford ", and/or X"; skip no-space commas ("$18,000") and date commas ("January 8, 2026"). */
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
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};
/* An array item may be a {recommendation,date} object — render its text, never "[object Object]". */
const arrItemText = (item) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return String(item.recommendation || item.text || item.value || item.description || Object.values(item).filter(v => v !== null && typeof v !== 'object').join(' — ') || '').trim();
  }
  return String(item ?? '').trim();
};
/* MONTH-granularity date fields (month + year, no day: "January 2026") → BlueMonthPicker (stores "Month YYYY"). */
const MONTH_FIELDS = ['edd', 'lmp'];
/* −/+ stepper for a number+unit MEASUREMENT value ("70%", "174 mg/dL", "7.5%"). Unit REQUIRED so bare years
   ("2026") and ranges ("6-8") and word-dates ("January 2026", "24 weeks 2 days") are NOT caught (memory 6a479b59). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const MEAS_RE = /^-?\d+(?:\.\d+)?\s*(?:%|[A-Za-z]{1,6}(?:\/[A-Za-z]{1,6})?)$/;
const splitMeasurement = (text) => { const s = String(text ?? '').trim(); if (!MEAS_RE.test(s)) return null; const m = s.match(/^(-?\d+(?:\.\d+)?)(\s*)(.*)$/); if (!m) return null; return { num: m[1], sep: m[2] || '', unit: (m[3] || '').trim() }; };

const CurrentPregnancyDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.current_pregnancy) return Array.isArray(r.current_pregnancy) ? r.current_pregnancy : [r.current_pregnancy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.current_pregnancy) return Array.isArray(dd.current_pregnancy) ? dd.current_pregnancy : [dd.current_pregnancy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const safeRecordId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeRecordId(record);
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

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const toDateInputValue = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  /* Canonical: splits on '.' AND ';' with the abbreviation+decimal guard. */
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }

  const getDotValue = useCallback((record, dotPath) => {
    const parts = dotPath.split('.');
    let val = record;
    for (const p of parts) { if (val == null) return undefined; val = val[p]; }
    return val;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) return getDotValue(record, fn);
    return record[fn];
  }, [localEdits, getDotValue]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; }
    const raw = fn.includes('.') ? getDotValue(record, fn) : record[fn];
    return Array.isArray(raw) ? raw : [];
  }, [localEdits, getDotValue]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

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
      if (OBJECT_FIELDS.includes(f)) { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
      else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
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
    if (OBJECT_FIELDS.includes(fn)) return flattenSearchable(val).toLowerCase().includes(phrase);
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
      const recordTitle = `Current Pregnancy ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = getFieldValue(record, f, idx);
        if (OBJECT_FIELDS.includes(f)) { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
        else if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal, getFieldValue]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) { const path = m[1]; if (path.includes('.')) { const parts = path.split('.'); if (!merged[parts[0]] || typeof merged[parts[0]] !== 'object') merged[parts[0]] = {}; merged[parts[0]] = { ...merged[parts[0]], [parts.slice(1).join('.')]: localEdits[key] }; } else { merged[path] = localEdits[key]; } } });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Stage a DRAFT locally (localStorage survives refresh) + mark pending + clear the section's
  // approve flag. NO DB write here — handleApproveSection is the ONLY path that writes to MongoDB.
  const stageDraft = useCallback((record, fieldPart, idx, sid, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    if (!safeId(record)) return;
    stageDraft(record, fn, idx, sid, editValue);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex, sid) => {
    if (!safeId(record)) return;
    const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
    stageDraft(record, fn, idx, sid, arr);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  const handleSaveDateField = useCallback((record, fn, idx, sid) => {
    if (!safeId(record)) return;
    const isoDate = editValue ? new Date(editValue + 'T00:00:00.000Z').toISOString() : editValue;
    stageDraft(record, fn, idx, sid, isoDate);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveBooleanField = useCallback((record, fn, idx, sid) => {
    if (!safeId(record)) return;
    const boolVal = editValue === 'Yes' || editValue === 'true' || editValue === true;
    stageDraft(record, fn, idx, sid, boolVal);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    if (!safeId(record)) return;
    // Build the updated whole-object value (stored in localEdits under `${rootField}-${idx}`),
    // then stage it as a draft. The draft stores the same whole object so refresh rehydrates it.
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] == null || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
    node[path[path.length - 1]] = newVal;
    stageDraft(record, rootField, idx, sid, clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // localEdits keys are `${fieldPart}-${idx}`; commit only this section's pending field keys.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        return fields.includes(fieldPart);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" / "a.b" / "field.<numericArrayIndex>"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // Trailing dot-segment is an arrayIndex ONLY when purely numeric (mirrors save's fieldPart build)
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        const resp = await secureApiClient.put(`/api/edit/current_pregnancy/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/current_pregnancy/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts (this section's field keys) from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CurrentPregnancy] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* object → copy lines: each scalar leaf → key (sub-label), DASH, "1. value"; nested/array → key + rows. */
  const objectLinesCopy = useCallback((value) => {
    const out = [];
    if (!value || typeof value !== 'object') return out;
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      const key = humanizeKey(k);
      if (isScalar(v)) { out.push(key, COPY_LINE_DASH, `1. ${fmtScalar(v)}`); }
      else if (Array.isArray(v)) { out.push(key, COPY_LINE_DASH); v.filter(x => !isEmptyDeep(x)).forEach((it, i) => out.push(`${i + 1}. ${isScalar(it) ? fmtScalar(it) : arrItemText(it)}`)); }
      else { out.push(key, COPY_LINE_DASH); objectLinesCopy(v).forEach(l => out.push(l)); }
    });
    return out;
  }, []);

  /* EQ/DASH numbered lines for ONE field — the exact mirror of the PDF fieldLines (draft-aware via getFieldValue).
     head = label + DASH, hidden when the field label == the section title (single-name rule). */
  const buildFieldLines = useCallback((record, f, idx, sectionTitle) => {
    const label = FIELD_LABELS[f] || f;
    const val = getFieldValue(record, f, idx);
    const lines = [];
    if (!hasVal(val)) return lines;
    const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
    const head = showLabel ? [label, COPY_LINE_DASH] : [];
    if (OBJECT_FIELDS.includes(f)) {
      if (isScalar(val)) return lines;
      lines.push(...head);
      objectLinesCopy(val).forEach(l => lines.push(l));
      lines.push('');
    } else if (ARRAY_FIELDS.includes(f)) {
      const arr = getEffectiveArray(record, f, idx).filter(x => !isEmptyDeep(x));
      if (arr.length === 0) return lines;
      lines.push(...head);
      arr.forEach((item, i) => lines.push(`${i + 1}. ${arrItemText(item)}`));
      lines.push('');
    } else if (DATE_FIELDS.includes(f)) {
      lines.push(...head, `1. ${formatDate(val)}`, '');
    } else if (BOOLEAN_FIELDS.includes(f)) {
      lines.push(...head, `1. ${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}`, '');
    } else if (SENTENCE_FIELDS.includes(f)) {
      lines.push(...head);
      let n = 0;
      splitBySentence(fmtVal(val)).forEach(s => {
        const p = parseLabel(s);
        if (p) { const ci = splitByComma(p.content); lines.push(p.label, COPY_LINE_DASH); n = 0; if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`)); else lines.push(`${++n}. ${p.content}`); }
        else { const ci = splitByComma(s); if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`)); else lines.push(`${++n}. ${s}`); }
      });
      lines.push('');
    } else {
      const strVal = ENUM_FIELDS[f] ? (fmtEnumVal(f, val) ?? fmtVal(val)) : fmtVal(val);
      lines.push(...head, `1. ${strVal}`, '');
    }
    return lines;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatDate, splitBySentence, objectLinesCopy]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = (SECTION_FIELDS[sid] || []).flatMap(f => buildFieldLines(record, f, idx, title));
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [buildFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== CURRENT PREGNANCY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Current Pregnancy ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const block = buildSectionCopyText(r, idx, sid); if (block) text += `${block}\n`; });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (DATE_FIELDS.includes(fn)) {
      const displayVal = formatDate(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toDateInputValue(val)); } }}>
            {isEditing ? (<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveDateField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    if (MONTH_FIELDS.includes(fn)) {
      const displayVal = fmtVal(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
            {isEditing ? (<div className="edit-field-container"><BlueMonthPicker value={editValue} onSelect={(s) => setEditValue(s)} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    if (BOOLEAN_FIELDS.includes(fn)) {
      const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
            {isEditing ? (<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveBooleanField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    const enumOpts = ENUM_FIELDS[fn];
    if (enumOpts) {
      const enumDisplay = fmtEnumVal(fn, val) ?? fmtVal(val);
      return (
        <div key={fn}>
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumDisplay); } }}>
            {isEditing ? (<div className="edit-field-container"><select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>{enumOptionsWith(enumOpts, editValue).map(o => <option key={o} value={o}>{o}</option>)}</select><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(enumDisplay)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${enumDisplay}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    const displayVal = fmtVal(val);
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  // Per-comma-item save for sentence fields
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
    const rawValue = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(rawValue);
    const trimmed = editValue.trim();
    if (!trimmed) { items.splice(commaIdx, 1); }
    else { const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items.splice(commaIdx, 1, ...subParts); } else { items[commaIdx] = trimmed.replace(/[;.]+$/, '').trim(); } }
    const rebuilt = items.length > 0 ? (parsed ? `${parsed.label}: ${items.join(', ')}` : items.join(', ')) : '';
    const updated = [...sentences]; if (rebuilt) { updated[sIdx] = rebuilt; } else { updated.splice(sIdx, 1); }
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence.replace(/[;.]+$/, '').trim());
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(rawContent);
            const showCommaRows = commaItems.length >= 3;

            const parsedLabelMatch = searchTerm.trim() && parsed && parsed.label && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());

            if (showCommaRows) {
              return (<div key={sIdx} className={parsed ? 'rec-mini-card' : ''}>
                {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}-${idx}-s${sIdx}-c${ciIdx}`;
                  const ciEditing = editingField === commaKey;
                  const ciBadge = editedSentences[commaKey];
                  const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                  if (!ciMatches && searchTerm.trim()) return null;
                  if (ciEditing) {
                    return (<div key={ciIdx} className="numbered-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                  }
                  return (<React.Fragment key={ciIdx}>
                    <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { setEditingField(commaKey); setEditValue(ci.trim()); }}>
                      <div className="row-content"><span className="content-value">{highlightText(ci.trim())}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci.trim(), commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                    </div>
                    {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </React.Fragment>);
                })}
              </div>);
            }

            return (<div key={sIdx}>
              {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim()); } }}>
                {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed) { const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || '')); curSentences[sIdx] = `${parsed.label}: ${editValue.trim()}`; const fullText = reconstructFullText(curSentences); handleSaveField(record, fn, idx, sid, sIdx, fullText); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed ? parsed.content : sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
              </div>
              {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>);
          })}
        </div>
      </div>
    );
  };

  const renderArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
            const itemStr = arrItemText(item);
            const itemMatches = phraseMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(itemStr);
            if (parsed) {
              const meas = splitMeasurement(parsed.content);   // number+unit content ("70%") → −/+ stepper (unit preserved)
              const bump = (delta) => { const st = parseFloat(stepFor(editValue)); const cur = parseFloat(editValue); setEditValue(String(parseFloat(((isNaN(cur) ? 0 : cur) + delta * st).toFixed(6)))); };
              const saveParsedItem = () => { if (!safeId(record)) return; const newContent = meas ? `${editValue}${meas.sep}${meas.unit}` : editValue.trim(); const a = [...(getEffectiveArray(record, fn, idx))]; a[ai] = `${parsed.label}: ${newContent}`; stageDraft(record, fn, idx, sid, a); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); };
              return (
                <div key={ai} className="rec-mini-card" style={{ marginTop: ai > 0 ? 8 : 0 }}>
                  <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(meas ? meas.num : parsed.content); } }}>
                    {isEditing ? (<div className="edit-field-container">{meas ? (<div className="num-stepper-row"><button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>&minus;</button><input type="number" step={stepFor(editValue)} className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>{meas.unit && <span className="number-edit-unit">{meas.unit}</span>}</div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveParsedItem(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                    ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed.content)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            }
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== OBJECT (recursive, editable leaves) ==========
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? (editValue === 'Yes') : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button></>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
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

  const renderObjectField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
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

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; if (OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f, idx); return !isEmptyDeep(v) && !isScalar(v); } return hasVal(getFieldValue(record, f, idx)); });
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
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="current-pregnancy-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Current Pregnancy</h2></div><div className="empty-state">No current pregnancy records available</div></div>);
  }

  return (
    <div className="current-pregnancy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Current Pregnancy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CurrentPregnancyDocumentPDFTemplate document={pdfData} />} fileName="Current_Pregnancy.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search current pregnancy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Current Pregnancy ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderMixedSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CurrentPregnancyDocument;
