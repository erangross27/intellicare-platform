/**
 * IbdConsultationDetailsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: ibd_consultation_details
 *
 * Sections:
 *   1. provider-details: date (date), provider (string), facility (string), status (string)
 *   2. mayo-score: mayoScore.stoolFrequency (num), mayoScore.rectalBleeding (num),
 *                  mayoScore.endoscopicFindings (num), mayoScore.physicianGlobalAssessment (num),
 *                  mayoScore.totalScore (num), mayoScore.interpretation (string)
 *   3. fecal-calprotectin: fecalCalprotectin (string)
 *   4. drug-monitoring: infliximabDrugMonitoring object
 *   5. symptom-timeline: symptomProgressionTimeline array
 *   6. findings: findings (long string)
 *   7. assessment: assessment (long string)
 *   8. plan: plan (long string)
 *   9. results: results object (recursive)
 *  10. recommendations: recommendations array of {recommendation, date}
 *  11. rescue-therapy: rescueTherapyOptions array
 *  12. care-team: ibdCareTeam array
 *  13. barriers: barriersAndPsychosocialIssues object
 *  14. notes: notes (long string)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import IbdConsultationDetailsDocumentPDFTemplate from '../pdf-templates/IbdConsultationDetailsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './IbdConsultationDetailsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = dotted field name; value may be a string or array) */
const DRAFT_KEY = 'ibd_consultation_detailsPendingEdits';
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
  'provider-details': 'Provider Details',
  'mayo-score': 'Mayo Score',
  'fecal-calprotectin': 'Fecal Calprotectin',
  'drug-monitoring': 'Infliximab Drug Monitoring',
  'symptom-timeline': 'Symptom Progression Timeline',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'rescue-therapy': 'Rescue Therapy Options',
  'care-team': 'IBD Care Team',
  'barriers': 'Barriers & Psychosocial Issues',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'mayoScore.stoolFrequency': 'Stool Frequency',
  'mayoScore.rectalBleeding': 'Rectal Bleeding',
  'mayoScore.endoscopicFindings': 'Endoscopic Findings',
  'mayoScore.physicianGlobalAssessment': 'Physician Global Assessment',
  'mayoScore.totalScore': 'Total Score',
  'mayoScore.interpretation': 'Interpretation',
  fecalCalprotectin: 'Fecal Calprotectin',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility', 'status'],
  'mayo-score': ['mayoScore.stoolFrequency', 'mayoScore.rectalBleeding', 'mayoScore.endoscopicFindings', 'mayoScore.physicianGlobalAssessment', 'mayoScore.totalScore', 'mayoScore.interpretation'],
  'fecal-calprotectin': ['fecalCalprotectin'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'notes': ['notes'],
};

const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const KEY_OVERRIDES = { ibd: 'IBD', crp: 'CRP', esr: 'ESR', bmi: 'BMI', wbc: 'WBC', hgb: 'Hgb' };

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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
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

/* Number fields in mayoScore (nested) */
const NUMBER_FIELDS = [
  'mayoScore.stoolFrequency', 'mayoScore.rectalBleeding', 'mayoScore.endoscopicFindings',
  'mayoScore.physicianGlobalAssessment', 'mayoScore.totalScore',
];

const STRING_FIELDS = ['provider', 'facility', 'status', 'mayoScore.interpretation', 'fecalCalprotectin'];
const LONG_STRING_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const DATE_FIELDS = ['date'];

/* parseLabel: detect "Label: value" patterns (guard grammatical/conditional colons; strip leading list-marker from value) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
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
const IbdConsultationDetailsDocument = ({ document: docProp }) => {
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
      if (r?.ibd_consultation_details) return Array.isArray(r.ibd_consultation_details) ? r.ibd_consultation_details : [r.ibd_consultation_details];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ibd_consultation_details) return Array.isArray(dd.ibd_consultation_details) ? dd.ibd_consultation_details : [dd.ibd_consultation_details]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* Get nested field value (supports dotted paths like mayoScore.stoolFrequency) */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return val;
    }
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

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
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
        if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  /* shouldShowRow for custom sections (objects/arrays) */
  const shouldShowRow = useCallback((...args) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const arg of args) {
      if (arg && String(arg).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `IBD Consultation Details ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Flat field values */
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      /* Mayo score nested */
      const mayo = record.mayoScore;
      if (mayo) {
        const mayoVals = [mayo.stoolFrequency, mayo.rectalBleeding, mayo.endoscopicFindings, mayo.physicianGlobalAssessment, mayo.totalScore, mayo.interpretation].filter(v => v !== null && v !== undefined);
        for (const v of mayoVals) { if (String(v).toLowerCase().includes(phrase)) return true; }
      }
      /* Infliximab drug monitoring */
      const drug = record.infliximabDrugMonitoring;
      if (drug) {
        const drugVals = [drug.troughLevel, drug.therapeuticRange, drug.interpretation, drug.antibodies, drug.dateChecked].filter(Boolean);
        for (const v of drugVals) { if (String(v).toLowerCase().includes(phrase)) return true; }
      }
      /* Symptom timeline */
      if (record.symptomProgressionTimeline) {
        for (const s of record.symptomProgressionTimeline) {
          if ([s.week, s.bowelMovementsPerDay, s.bloodAmount].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
        }
      }
      /* Rescue therapy */
      if (record.rescueTherapyOptions) {
        for (const r of record.rescueTherapyOptions) {
          if ([r.therapy, r.indication].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
        }
      }
      /* Care team */
      if (record.ibdCareTeam) {
        for (const t of record.ibdCareTeam) {
          if ([t.name, t.role, t.credentials].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
        }
      }
      /* Barriers */
      const b = record.barriersAndPsychosocialIssues;
      if (b) {
        const bVals = [b.workStress, b.insurance, b.caregiverBurden, b.familyDiagnosis, b.bodyImageConcerns].filter(Boolean);
        for (const v of bVals) { if (String(v).toLowerCase().includes(phrase)) return true; }
      }
      /* Results (object, recursive) */
      if (record.results && flattenSearchable(record.results).toLowerCase().includes(phrase)) return true;
      /* Recommendations (object array) */
      if (Array.isArray(record.recommendations)) {
        for (const r of record.recommendations) {
          if ([r?.recommendation, r?.date].some(v => v && String(v).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (fn.includes('.')) {
            const parts = fn.split('.');
            if (!merged[parts[0]]) merged[parts[0]] = {};
            merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.ef) — value stays a STRING */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      // Stage the full nested object as a DRAFT (no DB write). Approve commits it.
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][rootField] = clone;
      writeDrafts(store);
      return { ...prev, [`${rootField}-${idx}`]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageDraft(id, fn, idx, value, sid) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(id, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(id, fn, idx, fullText, sid);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this record's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // dotted field name (e.g. "mayoScore.interpretation")
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (e.g. "recommendations.2")
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        await secureApiClient.put(`/api/edit/ibd_consultation_details/${id}/edit`, payload);
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/ibd_consultation_details/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => hasVal(getFieldValue(record, f, idx)))) return '';
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : [];
        text += `${label}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((rec) => {
          const recTxt = (rec?.recommendation || '').trim();
          const d = (rec?.date || '').trim();
          if (d !== lastDate) { if (d) text += `${d}\n`; lastDate = d; n = 1; }
          text += `${n++}. ${recTxt}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const objLines = (lbl, value, indent) => {
          const pad = '  '.repeat(indent); const out = [];
          if (isEmptyDeep(value)) return out;
          if (isScalar(value)) { out.push(`${pad}${lbl ? lbl + ': ' : ''}${fmtScalar(value)}`); return out; }
          if (lbl) out.push(`${pad}${lbl}:`);
          Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objLines(humanizeKey(k), v, indent + (lbl ? 1 : 0))));
          return out;
        };
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (LONG_STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== IBD CONSULTATION DETAILS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `IBD Consultation Details ${idx + 1}\n${'='.repeat(40)}\n\n`;
      /* Provider details */
      text += buildSectionCopyText(r, idx, 'provider-details');
      /* Mayo score */
      if (r.mayoScore) {
        text += `Mayo Score\n${'='.repeat(40)}\n\n`;
        const mayo = r.mayoScore;
        if (mayo.stoolFrequency !== undefined) text += `Stool Frequency\n${mayo.stoolFrequency}\n\n`;
        if (mayo.rectalBleeding !== undefined) text += `Rectal Bleeding\n${mayo.rectalBleeding}\n\n`;
        if (mayo.endoscopicFindings !== undefined) text += `Endoscopic Findings\n${mayo.endoscopicFindings}\n\n`;
        if (mayo.physicianGlobalAssessment !== undefined) text += `Physician Global Assessment\n${mayo.physicianGlobalAssessment}\n\n`;
        if (mayo.totalScore !== undefined) text += `Total Score\n${mayo.totalScore}\n\n`;
        if (mayo.interpretation) text += `Interpretation\n${mayo.interpretation}\n\n`;
      }
      /* Fecal calprotectin */
      text += buildSectionCopyText(r, idx, 'fecal-calprotectin');
      /* Drug monitoring */
      if (r.infliximabDrugMonitoring) {
        const drug = r.infliximabDrugMonitoring;
        text += `Infliximab Drug Monitoring\n${'='.repeat(40)}\n\n`;
        if (drug.troughLevel) text += `Trough Level\n${drug.troughLevel}\n\n`;
        if (drug.therapeuticRange) text += `Therapeutic Range\n${drug.therapeuticRange}\n\n`;
        if (drug.interpretation) text += `Interpretation\n${drug.interpretation}\n\n`;
        if (drug.antibodies) text += `Antibodies\n${drug.antibodies}\n\n`;
        if (drug.dateChecked) text += `Date Checked\n${drug.dateChecked}\n\n`;
      }
      /* Symptom timeline */
      if (r.symptomProgressionTimeline?.length > 0) {
        text += `Symptom Progression Timeline\n${'='.repeat(40)}\n\n`;
        r.symptomProgressionTimeline.forEach((s) => {
          text += `${s.week}\n`;
          if (s.bowelMovementsPerDay) text += `  Bowel Movements Per Day: ${s.bowelMovementsPerDay}\n`;
          if (s.bloodAmount) text += `  Blood Amount: ${s.bloodAmount}\n`;
          text += '\n';
        });
      }
      /* Findings, Assessment, Plan */
      text += buildSectionCopyText(r, idx, 'findings');
      text += buildSectionCopyText(r, idx, 'assessment');
      text += buildSectionCopyText(r, idx, 'plan');
      /* Results (object, recursive) */
      if (r.results && !isEmptyDeep(r.results)) {
        text += `Results\n${'='.repeat(40)}\n\n`;
        const objLines = (label, value, indent) => {
          const pad = '  '.repeat(indent); const out = [];
          if (isEmptyDeep(value)) return out;
          if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
          if (label) out.push(`${pad}${label}:`);
          Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
          return out;
        };
        Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      }
      /* Recommendations (object array, date-grouped) */
      if (Array.isArray(r.recommendations) && r.recommendations.filter(x => !isEmptyDeep(x)).length > 0) {
        text += `Recommendations\n${'='.repeat(40)}\n\n`;
        let lastDate = null; let n = 1;
        r.recommendations.forEach((rec) => {
          const recTxt = (rec?.recommendation || '').trim();
          const d = (rec?.date || '').trim();
          if (d !== lastDate) { if (d) text += `${d}\n`; lastDate = d; n = 1; }
          text += `${n++}. ${recTxt}\n`;
        });
        text += '\n';
      }
      /* Rescue therapy */
      if (r.rescueTherapyOptions?.length > 0) {
        text += `Rescue Therapy Options\n${'='.repeat(40)}\n\n`;
        r.rescueTherapyOptions.forEach((opt, i) => { text += `${i + 1}. ${opt.therapy} - ${opt.indication}\n`; });
        text += '\n';
      }
      /* Care team */
      if (r.ibdCareTeam?.length > 0) {
        text += `IBD Care Team\n${'='.repeat(40)}\n\n`;
        r.ibdCareTeam.forEach((t, i) => { text += `${i + 1}. ${t.name} (${t.credentials}) - ${t.role}\n`; });
        text += '\n';
      }
      /* Barriers */
      if (r.barriersAndPsychosocialIssues) {
        const b = r.barriersAndPsychosocialIssues;
        if (b.workStress || b.insurance || b.caregiverBurden || b.familyDiagnosis || b.bodyImageConcerns) {
          text += `Barriers & Psychosocial Issues\n${'='.repeat(40)}\n\n`;
          if (b.workStress) text += `Work Stress\n${b.workStress}\n\n`;
          if (b.insurance) text += `Insurance\n${b.insurance}\n\n`;
          if (b.caregiverBurden) text += `Caregiver Burden\n${b.caregiverBurden}\n\n`;
          if (b.familyDiagnosis) text += `Family Diagnosis\n${b.familyDiagnosis}\n\n`;
          if (b.bodyImageConcerns) text += `Body Image Concerns\n${b.bodyImageConcerns}\n\n`;
        }
      }
      /* Notes */
      text += buildSectionCopyText(r, idx, 'notes');
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD — input[type=number step=any] + parseFloat+isNaN block save ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) && val !== 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&#8722;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (short) ═══════ */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: LONG STRING FIELD with splitBySentence ═══════ */
  const renderLongStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(id2, fn, idx, fullText2, sid); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const id3 = safeId(record); if (!id3) return; stageDraft(id3, fn, idx, fullText, sid); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: READ-ONLY VALUE ROW (no editable-row → not a probed widget) ═══════ */
  const readOnlyRow = (valueText, copyKey, copyText) => (
    <div className="numbered-row">
      <div className="row-content"><span className="content-value">{highlightText(valueText)}</span></div>
      <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(copyText, copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
    </div>
  );

  /* ═══════ RENDER: READ-ONLY NESTED NODE (recursive; subtitle=key ABOVE decomposed value rows — never side-by-side) ═══════ */
  const renderReadOnlyNode = (label, value, keyPrefix, depth) => {
    if (isEmptyDeep(value)) return null;
    const subClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) {
      const vs = fmtScalar(value);
      return (
        <div key={keyPrefix} className="nested-mini-card">
          {label && <div className={subClass}>{highlightText(label)}</div>}
          {readOnlyRow(vs, keyPrefix, `${label ? label + '\n' : ''}${vs}`)}
        </div>
      );
    }
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={keyPrefix}>
          {label && <div className={subClass}>{highlightText(label)}</div>}
          {items.map((it, i) => (
            <div key={i} className="nested-mini-card">
              {isScalar(it)
                ? readOnlyRow(fmtScalar(it), `${keyPrefix}-${i}`, fmtScalar(it))
                : Object.entries(it).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderReadOnlyNode(humanizeKey(k), v, `${keyPrefix}-${i}-${k}`, depth + 1))}
            </div>
          ))}
        </React.Fragment>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={keyPrefix}>
        {label && <div className={subClass}>{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderReadOnlyNode(humanizeKey(k), v, `${keyPrefix}-${k}`, depth + 1))}
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: OBJECT FIELD (results — read-only, recursive, decomposed) ═══════ */
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
        {entries.map(([k, v]) => renderReadOnlyNode(humanizeKey(k), v, `${fn}-${idx}-${k}`, 1))}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, gIdx) => {
          const anyVisible = !searchTerm.trim() || phraseMatch || labelMatch || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedSentences[itemKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              stageDraft(id2, fn, idx, newArr, sid);
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setEditingField(null); setEditValue(''); setSaveError(null);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION (for flat fields) ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val) || val === 0;
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (LONG_STRING_FIELDS.includes(f)) return renderLongStringField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: MAYO SCORE (object with nested number fields) ═══════ */
  const renderMayoScoreSection = (record, idx) => {
    const mayo = record.mayoScore;
    if (!mayo) return null;
    const sid = 'mayo-score';
    if (!shouldShowSection(record, sid)) return null;

    const fields = SECTION_FIELDS[sid];
    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val) || val === 0;
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Mayo Score')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Mayo Score\n${'='.repeat(40)}\n\n`;
                if (mayo.stoolFrequency !== undefined) text += `Stool Frequency\n${mayo.stoolFrequency}\n\n`;
                if (mayo.rectalBleeding !== undefined) text += `Rectal Bleeding\n${mayo.rectalBleeding}\n\n`;
                if (mayo.endoscopicFindings !== undefined) text += `Endoscopic Findings\n${mayo.endoscopicFindings}\n\n`;
                if (mayo.physicianGlobalAssessment !== undefined) text += `Physician Global Assessment\n${mayo.physicianGlobalAssessment}\n\n`;
                if (mayo.totalScore !== undefined) text += `Total Score\n${mayo.totalScore}\n\n`;
                if (mayo.interpretation) text += `Interpretation\n${mayo.interpretation}\n\n`;
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: DRUG MONITORING (object section) ═══════ */
  const renderDrugMonitoringSection = (record, idx) => {
    const drug = record.infliximabDrugMonitoring;
    if (!drug) return null;
    const sid = 'drug-monitoring';
    const showAll = !searchTerm.trim() || record._showAllSections;
    const stMatches = sectionTitleMatches(sid);

    const drugFields = [
      ['Trough Level', drug.troughLevel, 'troughLevel'],
      ['Therapeutic Range', drug.therapeuticRange, 'therapeuticRange'],
      ['Interpretation', drug.interpretation, 'interpretation'],
      ['Antibodies', drug.antibodies, 'antibodies'],
      ['Date Checked', drug.dateChecked, 'dateChecked'],
    ].filter(([, val]) => hasVal(val));
    if (drugFields.length === 0) return null;

    if (!showAll && !stMatches && !drugFields.some(([label, val]) => shouldShowRow(label, val))) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Infliximab Drug Monitoring')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Infliximab Drug Monitoring\n${'='.repeat(40)}\n\n`;
                drugFields.forEach(([label, val]) => { text += `${label}\n${val}\n\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {drugFields.map(([label, val, key]) => {
            if (!showAll && !stMatches && !shouldShowRow(label, val)) return null;
            const itemKey = `infliximabDrugMonitoring.${key}-${idx}`;
            return (
              <div key={key} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(label)}</div>
                {readOnlyRow(String(val), itemKey, `${label}\n${val}`)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SYMPTOM TIMELINE (array as mini-cards) ═══════ */
  const renderSymptomTimelineSection = (record, idx) => {
    const timeline = record.symptomProgressionTimeline;
    if (!timeline || timeline.length === 0) return null;
    const sid = 'symptom-timeline';
    const showAll = !searchTerm.trim() || record._showAllSections;
    const stMatches = sectionTitleMatches(sid);

    if (!showAll && !stMatches && !timeline.some(s => shouldShowRow(s.week, s.bowelMovementsPerDay, s.bloodAmount))) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Symptom Progression Timeline')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Symptom Progression Timeline\n${'='.repeat(40)}\n\n`;
                timeline.forEach((s) => {
                  text += `${s.week}\n`;
                  if (hasVal(s.bowelMovementsPerDay)) text += `  Bowel Movements Per Day: ${s.bowelMovementsPerDay}\n`;
                  if (hasVal(s.bloodAmount)) text += `  Blood Amount: ${s.bloodAmount}\n`;
                  text += '\n';
                });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {timeline.map((symptom, sIdx) => {
            if (!showAll && !stMatches && !shouldShowRow(symptom.week, symptom.bowelMovementsPerDay, symptom.bloodAmount)) return null;
            const rows = [
              ['Bowel Movements Per Day', symptom.bowelMovementsPerDay],
              ['Blood Amount', symptom.bloodAmount],
            ].filter(([, v]) => hasVal(v));
            return (
              <div key={sIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(symptom.week || `Week ${sIdx + 1}`)}</div>
                {rows.map(([rlabel, rval], ri) => {
                  const itemKey = `timeline-${idx}-${sIdx}-${ri}`;
                  return (
                    <div key={rlabel} className="nested-mini-card">
                      <div className="nested-subtitle sub-label">{highlightText(rlabel)}</div>
                      {readOnlyRow(String(rval), itemKey, `${rlabel}\n${rval}`)}
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

  /* ═══════ RENDER: RESCUE THERAPY (array as mini-cards) ═══════ */
  const renderRescueTherapySection = (record, idx) => {
    const options = record.rescueTherapyOptions;
    if (!options || options.length === 0) return null;
    const sid = 'rescue-therapy';
    const showAll = !searchTerm.trim() || record._showAllSections;
    const stMatches = sectionTitleMatches(sid);

    if (!showAll && !stMatches && !options.some(r => shouldShowRow(r.therapy, r.indication))) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Rescue Therapy Options')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Rescue Therapy Options\n${'='.repeat(40)}\n\n`;
                options.forEach((r, i) => { text += `${i + 1}. ${r.therapy} - ${r.indication}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {options.map((option, oIdx) => {
            if (!showAll && !stMatches && !shouldShowRow(option.therapy, option.indication)) return null;
            const itemKey = `rescue-${idx}-${oIdx}`;
            return (
              <div key={oIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(option.therapy)}</div>
                <div className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(option.indication)}</span>
                  </div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${option.therapy} - ${option.indication}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: CARE TEAM (array as mini-cards) ═══════ */
  const renderCareTeamSection = (record, idx) => {
    const team = record.ibdCareTeam;
    if (!team || team.length === 0) return null;
    const sid = 'care-team';
    const showAll = !searchTerm.trim() || record._showAllSections;
    const stMatches = sectionTitleMatches(sid);

    if (!showAll && !stMatches && !team.some(t => shouldShowRow(t.name, t.role, t.credentials))) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('IBD Care Team')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `IBD Care Team\n${'='.repeat(40)}\n\n`;
                team.forEach((t, i) => { text += `${i + 1}. ${t.name} (${t.credentials}) - ${t.role}\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {team.map((member, tIdx) => {
            if (!showAll && !stMatches && !shouldShowRow(member.name, member.role, member.credentials)) return null;
            const itemKey = `team-${idx}-${tIdx}`;
            return (
              <div key={tIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(`${member.name}${member.credentials ? ` (${member.credentials})` : ''}`)}</div>
                <div className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(member.role)}</span>
                  </div>
                  <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${member.name} (${member.credentials}) - ${member.role}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: BARRIERS (object section) ═══════ */
  const renderBarriersSection = (record, idx) => {
    const b = record.barriersAndPsychosocialIssues;
    if (!b) return null;
    const sid = 'barriers';
    const showAll = !searchTerm.trim() || record._showAllSections;
    const stMatches = sectionTitleMatches(sid);

    const barrierFields = [
      ['Work Stress', b.workStress, 'workStress'],
      ['Insurance', b.insurance, 'insurance'],
      ['Caregiver Burden', b.caregiverBurden, 'caregiverBurden'],
      ['Family Diagnosis', b.familyDiagnosis, 'familyDiagnosis'],
      ['Body Image Concerns', b.bodyImageConcerns, 'bodyImageConcerns'],
    ].filter(([, val]) => hasVal(val));
    if (barrierFields.length === 0) return null;

    if (!showAll && !stMatches && !barrierFields.some(([label, val]) => shouldShowRow(label, val))) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Barriers & Psychosocial Issues')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `Barriers & Psychosocial Issues\n${'='.repeat(40)}\n\n`;
                barrierFields.forEach(([label, val]) => { text += `${label}\n${val}\n\n`; });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {barrierFields.map(([label, val, key]) => {
            if (!showAll && !stMatches && !shouldShowRow(label, val)) return null;
            const itemKey = `barriersAndPsychosocialIssues.${key}-${idx}`;
            return (
              <div key={key} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(label)}</div>
                {readOnlyRow(String(val), itemKey, `${label}\n${val}`)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="ibd-consultation-details-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">IBD Consultation Details</h2></div>
        <div className="empty-state">No IBD consultation details records available</div>
      </div>
    );
  }

  return (
    <div className="ibd-consultation-details-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">IBD Consultation Details</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<IbdConsultationDetailsDocumentPDFTemplate document={pdfData} />} fileName="Ibd_Consultation_Details.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search IBD consultation details..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`IBD Consultation Details ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'provider-details')}
            {renderMayoScoreSection(record, idx)}
            {renderSection(record, idx, 'fecal-calprotectin')}
            {renderDrugMonitoringSection(record, idx)}
            {renderSymptomTimelineSection(record, idx)}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'recommendations')}
            {renderRescueTherapySection(record, idx)}
            {renderCareTeamSection(record, idx)}
            {renderBarriersSection(record, idx)}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IbdConsultationDetailsDocument;
