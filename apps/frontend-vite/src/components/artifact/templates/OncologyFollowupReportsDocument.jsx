/**
 * OncologyFollowupReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: oncology_followup_reports
 *
 * 14 Sections:
 *   1. followup-info: date (date), provider (string), facility (string)
 *   2. cancer-overview: cancerType (string), cancerStage (string), currentDiseaseStatus (string), diagnosisDate (date)
 *   3. progression-free: progressionFreeInterval (number) — bar chart
 *   4. treatment-info: treatmentRegimen (string), treatmentIntent (string), treatmentStartDate (date), cycleDayNumber (number)
 *   5. performance-status: performanceStatus (string)
 *   6. tumor-markers: tumorMarkers (array)
 *   7. imaging-results: imagingModality (string), imagingDate (date)
 *   8. radiation-therapy: radiationTherapy.site (string), radiationTherapy.totalDose (string),
 *                         radiationTherapy.fractions (string), radiationTherapy.completionDate (string)
 *   9. adverse-events: adverseEvents (array)
 *  10. symptoms-reported: symptomsReported (array)
 *  11. supportive-medications: supportiveMedications (array)
 *  12. surgical-history: surgicalHistory (string)
 *  13. genetic-mutations: geneticMutations (array)
 *  14. upcoming-care: nextFollowupDate (date), nextTreatmentDate (date), weightChange (number)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import OncologyFollowupReportsDocumentPDFTemplate from '../pdf-templates/OncologyFollowupReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './OncologyFollowupReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'oncology_followup_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'followup-info': 'Follow-up Information',
  'cancer-overview': 'Cancer Overview',
  'progression-free': 'Progression-Free Interval',
  'treatment-info': 'Treatment Information',
  'performance-status': 'Performance Status',
  'tumor-markers': 'Tumor Markers',
  'imaging-results': 'Imaging Results',
  'radiation-therapy': 'Radiation Therapy',
  'adverse-events': 'Adverse Events',
  'symptoms-reported': 'Symptoms Reported',
  'supportive-medications': 'Supportive Medications',
  'surgical-history': 'Surgical History',
  'genetic-mutations': 'Genetic Mutations',
  'upcoming-care': 'Upcoming Care',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  cancerType: 'Cancer Type',
  cancerStage: 'Cancer Stage',
  currentDiseaseStatus: 'Current Disease Status',
  diagnosisDate: 'Diagnosis Date',
  progressionFreeInterval: 'Progression-Free Interval',
  treatmentRegimen: 'Treatment Regimen',
  treatmentIntent: 'Treatment Intent',
  treatmentStartDate: 'Treatment Start Date',
  cycleDayNumber: 'Cycle Day Number',
  performanceStatus: 'Performance Status',
  tumorMarkers: 'Tumor Markers',
  imagingModality: 'Imaging Modality',
  imagingDate: 'Imaging Date',
  'radiationTherapy.site': 'Site',
  'radiationTherapy.totalDose': 'Total Dose',
  'radiationTherapy.fractions': 'Fractions',
  'radiationTherapy.completionDate': 'Completion Date',
  adverseEvents: 'Adverse Events',
  symptomsReported: 'Symptoms Reported',
  supportiveMedications: 'Supportive Medications',
  surgicalHistory: 'Surgical History',
  geneticMutations: 'Genetic Mutations',
  nextFollowupDate: 'Next Follow-up Date',
  nextTreatmentDate: 'Next Treatment Date',
  weightChange: 'Weight Change',
};

const SECTION_FIELDS = {
  'followup-info': ['date', 'provider', 'facility'],
  'cancer-overview': ['cancerType', 'cancerStage', 'currentDiseaseStatus', 'diagnosisDate'],
  'progression-free': ['progressionFreeInterval'],
  'treatment-info': ['treatmentRegimen', 'treatmentIntent', 'treatmentStartDate', 'cycleDayNumber'],
  'performance-status': ['performanceStatus'],
  'tumor-markers': ['tumorMarkers'],
  'imaging-results': ['imagingModality', 'imagingDate'],
  'radiation-therapy': ['radiationTherapy.site', 'radiationTherapy.totalDose', 'radiationTherapy.fractions', 'radiationTherapy.completionDate'],
  'adverse-events': ['adverseEvents'],
  'symptoms-reported': ['symptomsReported'],
  'supportive-medications': ['supportiveMedications'],
  'surgical-history': ['surgicalHistory'],
  'genetic-mutations': ['geneticMutations'],
  'upcoming-care': ['nextFollowupDate', 'nextTreatmentDate', 'weightChange'],
};

const NUMBER_FIELDS = ['cycleDayNumber', 'weightChange', 'progressionFreeInterval'];
const BOOLEAN_FIELDS = [];
const STRING_FIELDS = ['provider', 'facility', 'cancerType', 'cancerStage', 'currentDiseaseStatus', 'treatmentRegimen', 'treatmentIntent', 'performanceStatus', 'imagingModality', 'surgicalHistory', 'radiationTherapy.site', 'radiationTherapy.totalDose', 'radiationTherapy.fractions'];
const DATE_FIELDS = ['date', 'diagnosisDate', 'treatmentStartDate', 'imagingDate', 'nextFollowupDate', 'nextTreatmentDate', 'radiationTherapy.completionDate'];
const ARRAY_FIELDS = ['tumorMarkers', 'adverseEvents', 'symptomsReported', 'supportiveMedications', 'geneticMutations'];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands-guarded) */
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

/* Progression-Free Interval severity */
const getProgressionFreeSeverity = (months) => {
  if (months === null || months === undefined) return null;
  const numMonths = Number(months);
  if (isNaN(numMonths)) return null;
  const percentage = Math.min(100, Math.max(15, (numMonths / 60) * 100));
  if (numMonths >= 24) return { level: numMonths, label: 'Excellent', description: '2+ years progression-free - strong prognosis', color: '#22c55e', percentage };
  if (numMonths >= 12) return { level: numMonths, label: 'Good', description: '1-2 years progression-free - favorable outcome', color: '#3b82f6', percentage };
  if (numMonths >= 6) return { level: numMonths, label: 'Moderate', description: '6-12 months progression-free - ongoing monitoring', color: '#f59e0b', percentage };
  return { level: numMonths, label: 'Early', description: 'Less than 6 months - close surveillance required', color: '#ef4444', percentage };
};

/* ======= COMPONENT ======= */
const OncologyFollowupReportsDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState(null);
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.oncology_followup_reports) return Array.isArray(r.oncology_followup_reports) ? r.oncology_followup_reports : [r.oncology_followup_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.oncology_followup_reports) return Array.isArray(dd.oncology_followup_reports) ? dd.oncology_followup_reports : [dd.oncology_followup_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      // Group per-base-field drafts so array fields rebuild into a full array under `${fn}-${idx}`.
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        if (isArrayElem) {
          const fn = fieldPart.slice(0, lastDot);
          const arrIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
          const editKey = `${fn}-${idx}`;
          const base = nLocal[editKey] !== undefined
            ? nLocal[editKey]
            : (Array.isArray(record[fn]) ? [...record[fn]] : []);
          base[arrIndex] = value;
          nLocal[editKey] = base;
          nPending[editKey] = true;
          nFields[`${fn}.${arrIndex}-${idx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ======= UTILS ======= */
  // hide-zero: a numeric 0 counts as empty (memory numeric-0-is-empty rule) — e.g. cycleDayNumber/weightChange 0 skip.
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  // Epoch 1970-01-01 is a "not set" sentinel → treat as empty in date checks.
  const isEpochDate = useCallback((v) => { if (!v) return false; try { const d = new Date(v.$date || v); return d.getTime() === 0 || String(d.toISOString()).startsWith('1970-01-01'); } catch { return false; } }, []);

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

  /* Get field value supporting dotted paths (e.g., radiationTherapy.site) */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
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

  /* ======= SEARCH — 4-LEVEL ======= */
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
          if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* Progression-free bar chart severity search */
    if (sid === 'progression-free') {
      const pfi = getFieldValue(record, 'progressionFreeInterval', 0);
      const severity = getProgressionFreeSeverity(pfi);
      if (severity) {
        const extras = [severity.label, severity.description, `${severity.level} months`, 'excellent', 'good', 'moderate', 'early', '24+ mo', '12-23 mo', '6-11 mo', '<6 mo'].join(' ').toLowerCase();
        if (extras.includes(phrase)) return true;
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
        return val.some(item => String(item).toLowerCase().includes(phrase));
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
      const rt = `Oncology Follow-up Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      /* Search bar chart severity labels */
      const pfi = getFieldValue(record, 'progressionFreeInterval', idx);
      const severity = getProgressionFreeSeverity(pfi);
      if (severity) {
        const extras = [severity.label, severity.description, `${severity.level} months`].join(' ').toLowerCase();
        if (extras.includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          if (ARRAY_FIELDS.includes(fn)) {
            merged[fn] = localEdits[key];
          } else if (fn.includes('.')) {
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

  /* ======= EDIT HANDLERS ======= */
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
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve.
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // Stage in the pending-drafts store (fn carries dotted path as-is; non-numeric tail = NOT an arrayIndex).
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally + localStorage (survives refresh). NO DB write here.
  function stageSentenceDraft(record, fn, idx, sid, fullText, markers) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setEditedSentences(prev => ({ ...prev, ...markers }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, sid, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const markers = {};
    if (changed) markers[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) markers[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    stageSentenceDraft(record, fn, idx, sid, fullText, markers);
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Persist each staged draft belonging to THIS section's fields now.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedParts = [];
      for (const fieldPart of Object.keys(recDrafts)) {
        // fieldPart is a section field iff it equals a field name or is "<field>.<arrayIndex>" of one.
        const ownsPart = fields.some(f => fieldPart === f || fieldPart.startsWith(`${f}.`));
        if (!ownsPart) continue;
        // Treat a dot-suffix as arrayIndex ONLY when the segment after the LAST dot is purely numeric.
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = isArrayElem
          ? { field: fieldPart.slice(0, lastDot), value: recDrafts[fieldPart], arrayIndex: parseInt(fieldPart.slice(lastDot + 1), 10) }
          : { field: fieldPart, value: recDrafts[fieldPart] };
        await secureApiClient.put(`/api/edit/oncology_followup_reports/${id}/edit`, payload);
        committedParts.push(fieldPart);
      }
      // Flag the section approved (audit trail).
      await secureApiClient.put(`/api/edit/oncology_followup_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF (keyed by `${fn}-${idx}`).
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      // Drop this section's committed drafts from localStorage.
      if (committedParts.length > 0) {
        const s2 = readDrafts();
        if (s2[id]) { committedParts.forEach(p => delete s2[id][p]); if (Object.keys(s2[id]).length === 0) delete s2[id]; writeDrafts(s2); }
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY ======= */
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
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];

    /* Special handling for progression-free bar chart */
    if (sid === 'progression-free') {
      const pfi = getFieldValue(record, 'progressionFreeInterval', idx);
      if (hasVal(pfi)) {
        const severity = getProgressionFreeSeverity(pfi);
        text += `Progression-Free Interval: ${pfi} months`;
        if (severity) text += ` - ${severity.label} (${severity.description})`;
        text += '\n\n';
      }
      return text;
    }

    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (items.length > 0) {
          text += `${label}\n`;
          items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
          text += '\n';
        }
      } else if (STRING_FIELDS.includes(f)) {
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
    let text = '=== ONCOLOGY FOLLOW-UP REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Oncology Follow-up Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD ======= */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isEpochDate(val)) return null;
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD — input[type=number step=any] + parseFloat+isNaN->block save ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
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
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
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
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: ARRAY FIELD ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          const itemParsed = parseLabel(itemStr);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              {itemParsed.isLabeled && <div className="nested-subtitle">{highlightText(itemParsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; const localKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [localKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [localKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemParsed.isLabeled ? itemParsed.value : itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label !== title;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence */
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newItems = [...commaItems]; newItems[ciIdx] = editValue; const newSentence = `${parsed.label}: ${newItems.join(', ')}`; const allSentences = [...sentences]; allSentences[sIdx] = newSentence; const fullText = reconstructFullText(allSentences); const id = safeId(record); if (!id) return; const localKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [localKey]: fullText })); setPendingEdits(prev => ({ ...prev, [localKey]: true })); setEditedFields(prev => ({ ...prev, [localKey]: 'edited' })); setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added' : 'edited'} — click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              return (
                <div key={sIdx}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added' : 'edited'} — click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single value */
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= BAR CHART COMPONENTS ======= */
  const BarChart = ({ label, severity }) => {
    if (!severity) return null;
    return (
      <div className="bar-chart-row">
        <div className="bar-label">{highlightText(label)}</div>
        <div className="bar-category-row">
          <div className="bar-category-value" style={{ color: severity.color }}>
            {highlightText(`${severity.level} months - ${severity.label}`)}
          </div>
          <div className="bar-interpretation" style={{ color: severity.color }}>
            {highlightText(severity.description)}
          </div>
        </div>
        <div className="bar-container">
          <div className="bar-background">
            <div className="bar-fill" style={{ width: `${severity.percentage}%`, backgroundColor: severity.color }} />
          </div>
        </div>
        <div className="bar-scale">
          <span className="scale-item" style={{ left: '0%' }}>0</span>
          <span className="scale-item" style={{ left: '10%' }}>6</span>
          <span className="scale-item" style={{ left: '20%' }}>12</span>
          <span className="scale-item" style={{ left: '40%' }}>24</span>
          <span className="scale-item" style={{ left: '60%' }}>36</span>
          <span className="scale-item" style={{ left: '80%' }}>48</span>
          <span className="scale-item" style={{ left: '100%' }}>60</span>
        </div>
        <div className="bar-scale-labels">
          <span className="scale-label" style={{ color: '#ef4444' }}>Early</span>
          <span className="scale-label" style={{ color: '#f59e0b' }}>Moderate</span>
          <span className="scale-label" style={{ color: '#3b82f6' }}>Good</span>
          <span className="scale-label" style={{ color: '#22c55e' }}>Excellent</span>
        </div>
      </div>
    );
  };

  const Legend = () => (
    <div className="chart-legend">
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#22c55e' }} />
        <span className="legend-text">Excellent (24+ mo)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#3b82f6' }} />
        <span className="legend-text">Good (12-23 mo)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
        <span className="legend-text">Moderate (6-11 mo)</span>
      </div>
      <div className="legend-item">
        <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
        <span className="legend-text">Early (&lt;6 mo)</span>
      </div>
    </div>
  );

  /* ======= RENDER: PROGRESSION-FREE SECTION (bar chart + number edit) ======= */
  const renderProgressionFreeSection = (record, idx) => {
    const sid = 'progression-free';
    const fn = 'progressionFreeInterval';
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (!shouldShowSection(record, sid)) return null;

    const pfSeverity = getProgressionFreeSeverity(val);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Progression-Free Interval')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          <div className="chart-container">
            <Legend />
            {pfSeverity && <BarChart label="Progression-Free Interval" severity={pfSeverity} />}
          </div>
          {/* Editable number row for the value */}
          <div className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText('Months')}</div>
            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <div className="num-stepper-row">
                    <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
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
                  <div className="row-content"><span className="content-value">{highlightText(`${val} months`)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Progression-Free Interval: ${val} months`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
            {isModified && <span className="modified-badge">edited — click Pending Approve to save</span>}
          </div>
        </div>
      </div>
    );
  };

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    if (sid === 'progression-free') return renderProgressionFreeSection(record, idx);

    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="oncology-followup-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Oncology Follow-up Reports</h2></div>
        <div className="empty-state">No oncology follow-up reports available</div>
      </div>
    );
  }

  return (
    <div className="oncology-followup-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Oncology Follow-up Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<OncologyFollowupReportsDocumentPDFTemplate document={pdfData} />} fileName="Oncology_Followup_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search oncology follow-up reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const isNED = String(record.currentDiseaseStatus || '').toLowerCase().includes('ned');
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <div className="record-meta-row">
                  {hasVal(record.date) && <span className="record-date">{formatDate(record.date)}</span>}
                  {record.currentDiseaseStatus && (
                    <span className={`status-badge ${isNED ? 'status-good' : 'status-alert'}`}>
                      {highlightText(record.currentDiseaseStatus)}
                    </span>
                  )}
                </div>
                <h3 className="record-name">{highlightText(`Oncology Follow-up Report ${idx + 1}`)}</h3>
              </div>
              {renderSection(record, idx, 'followup-info')}
              {renderSection(record, idx, 'cancer-overview')}
              {renderSection(record, idx, 'progression-free')}
              {renderSection(record, idx, 'treatment-info')}
              {renderSection(record, idx, 'performance-status')}
              {renderSection(record, idx, 'tumor-markers')}
              {renderSection(record, idx, 'imaging-results')}
              {renderSection(record, idx, 'radiation-therapy')}
              {renderSection(record, idx, 'adverse-events')}
              {renderSection(record, idx, 'symptoms-reported')}
              {renderSection(record, idx, 'supportive-medications')}
              {renderSection(record, idx, 'surgical-history')}
              {renderSection(record, idx, 'genetic-mutations')}
              {renderSection(record, idx, 'upcoming-care')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OncologyFollowupReportsDocument;
