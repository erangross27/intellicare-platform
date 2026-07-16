/**
 * VisualAcuityReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: visual_acuity_reports
 *
 * 7 Sections:
 *   1. snellen-chart: snellenChartRightEye, snellenChartLeftEye
 *   2. corrected-uncorrected: correctedVisionRightEye, correctedVisionLeftEye, uncorrectedVisionRightEye, uncorrectedVisionLeftEye
 *   3. near-vision-pinhole: nearVisionRightEye, nearVisionLeftEye, pinholeAcuityRightEye, pinholeAcuityLeftEye
 *   4. logmar-etdrs: logmarRightEye, logmarLeftEye, etdrsLetterScoreRightEye, etdrsLetterScoreLeftEye
 *   5. refractive-pupillary: refractiveErrorRightEye, refractiveErrorLeftEye, pupillaryDefectRightEye, pupillaryDefectLeftEye
 *   6. contrast-binocular: contrastSensitivityRightEye, contrastSensitivityLeftEye, binocularVisionStatus
 *   7. testing-field-defects: testingDistance, testingConditions, visualFieldDefects
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import VisualAcuityReportsDocumentPDFTemplate from '../pdf-templates/VisualAcuityReportsDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './VisualAcuityReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'visual_acuity_reportsPendingEdits';
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
  'snellen-chart': 'Snellen Chart',
  'corrected-uncorrected': 'Corrected & Uncorrected Vision',
  'near-vision-pinhole': 'Near Vision & Pinhole Acuity',
  'logmar-etdrs': 'LogMAR & ETDRS Scores',
  'refractive-pupillary': 'Refractive Error & Pupillary',
  'contrast-binocular': 'Contrast Sensitivity & Binocular Vision',
  'testing-field-defects': 'Testing Conditions & Visual Field Defects',
};

const FIELD_LABELS = {
  snellenChartRightEye: 'Snellen Chart - Right Eye (OD)',
  snellenChartLeftEye: 'Snellen Chart - Left Eye (OS)',
  correctedVisionRightEye: 'Corrected Vision - Right Eye (OD)',
  correctedVisionLeftEye: 'Corrected Vision - Left Eye (OS)',
  uncorrectedVisionRightEye: 'Uncorrected Vision - Right Eye (OD)',
  uncorrectedVisionLeftEye: 'Uncorrected Vision - Left Eye (OS)',
  nearVisionRightEye: 'Near Vision - Right Eye (OD)',
  nearVisionLeftEye: 'Near Vision - Left Eye (OS)',
  pinholeAcuityRightEye: 'Pinhole Acuity - Right Eye (OD)',
  pinholeAcuityLeftEye: 'Pinhole Acuity - Left Eye (OS)',
  logmarRightEye: 'LogMAR - Right Eye (OD)',
  logmarLeftEye: 'LogMAR - Left Eye (OS)',
  etdrsLetterScoreRightEye: 'ETDRS Letter Score - Right Eye (OD)',
  etdrsLetterScoreLeftEye: 'ETDRS Letter Score - Left Eye (OS)',
  refractiveErrorRightEye: 'Refractive Error - Right Eye (OD)',
  refractiveErrorLeftEye: 'Refractive Error - Left Eye (OS)',
  pupillaryDefectRightEye: 'Pupillary Defect - Right Eye (OD)',
  pupillaryDefectLeftEye: 'Pupillary Defect - Left Eye (OS)',
  contrastSensitivityRightEye: 'Contrast Sensitivity - Right Eye (OD)',
  contrastSensitivityLeftEye: 'Contrast Sensitivity - Left Eye (OS)',
  binocularVisionStatus: 'Binocular Vision Status',
  testingDistance: 'Testing Distance',
  testingConditions: 'Testing Conditions',
  visualFieldDefects: 'Visual Field Defects',
};

const SECTION_FIELDS = {
  'snellen-chart': ['snellenChartRightEye', 'snellenChartLeftEye'],
  'corrected-uncorrected': ['correctedVisionRightEye', 'correctedVisionLeftEye', 'uncorrectedVisionRightEye', 'uncorrectedVisionLeftEye'],
  'near-vision-pinhole': ['nearVisionRightEye', 'nearVisionLeftEye', 'pinholeAcuityRightEye', 'pinholeAcuityLeftEye'],
  'logmar-etdrs': ['logmarRightEye', 'logmarLeftEye', 'etdrsLetterScoreRightEye', 'etdrsLetterScoreLeftEye'],
  'refractive-pupillary': ['refractiveErrorRightEye', 'refractiveErrorLeftEye', 'pupillaryDefectRightEye', 'pupillaryDefectLeftEye'],
  'contrast-binocular': ['contrastSensitivityRightEye', 'contrastSensitivityLeftEye', 'binocularVisionStatus'],
  'testing-field-defects': ['testingDistance', 'testingConditions', 'visualFieldDefects'],
};

const BOOLEAN_FIELDS = ['pupillaryDefectRightEye', 'pupillaryDefectLeftEye'];
const NUMBER_FIELDS = ['logmarRightEye', 'logmarLeftEye', 'etdrsLetterScoreRightEye', 'etdrsLetterScoreLeftEye'];
const DATE_FIELDS = [];
const ARRAY_FIELDS = ['visualFieldDefects'];
const SCORE_RATIO_FIELDS = [
  'snellenChartRightEye', 'snellenChartLeftEye',
  'correctedVisionRightEye', 'correctedVisionLeftEye',
  'uncorrectedVisionRightEye', 'uncorrectedVisionLeftEye',
  'pinholeAcuityRightEye', 'pinholeAcuityLeftEye',
];
const COMMA_ARRAY_FIELDS = Array.of('visualFieldDefects');
const STRING_FIELDS = [
  'snellenChartRightEye', 'snellenChartLeftEye',
  'correctedVisionRightEye', 'correctedVisionLeftEye',
  'uncorrectedVisionRightEye', 'uncorrectedVisionLeftEye',
  'nearVisionRightEye', 'nearVisionLeftEye',
  'pinholeAcuityRightEye', 'pinholeAcuityLeftEye',
  'refractiveErrorRightEye', 'refractiveErrorLeftEye',
  'contrastSensitivityRightEye', 'contrastSensitivityLeftEye',
  'binocularVisionStatus', 'testingDistance', 'testingConditions',
];

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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

const splitScoreRatio = value => {
  const source = String(value || '');
  const match = source.match(/^(\s*)(-?\d+(?:\.\d+)?)(\s*\/\s*(\d+(?:\.\d+)?)[\s\S]*)$/);
  if (!match) return null;
  const decimals = (match[2].split('.')[1] || '').length;
  return { prefix: match[1], number: match[2], suffix: match[3], denominator: Number(match[4]), step: decimals ? Number(`0.${'0'.repeat(decimals - 1)}1`) : 1, decimals };
};

/* ═══════ COMPONENT ═══════ */
const VisualAcuityReportsDocument = ({ document: docProp, data, templateData }) => {
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
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r?.records || r?._records)) return r.records || r._records;
      if (r?.visual_acuity_reports) return Array.isArray(r.visual_acuity_reports) ? r.visual_acuity_reports : [r.visual_acuity_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.visual_acuity_reports) return Array.isArray(dd.visual_acuity_reports) ? dd.visual_acuity_reports : [dd.visual_acuity_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    const arrayBuckets = {}; // `${fn}-${idx}` -> { base: [...], parts: { arrIdx: value } }
    records.forEach((record, idx) => {
      const id = recordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const lastSeg = dotIdx !== -1 ? fieldPart.slice(fieldPart.lastIndexOf('.') + 1) : '';
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(lastSeg);
        if (isArrayItem) {
          const fn = fieldPart.slice(0, fieldPart.lastIndexOf('.'));
          const arrIdx = parseInt(lastSeg, 10);
          const localKey = `${fn}-${idx}`;
          if (!arrayBuckets[localKey]) {
            const base = Array.isArray(record[fn]) ? [...record[fn]] : [];
            arrayBuckets[localKey] = { base, fn, idx };
          }
          arrayBuckets[localKey].base[arrIdx] = value;
          nPending[localKey] = true;
          nFields[`${fn}.${arrIdx}-${idx}`] = 'edited';
        } else {
          const localKey = `${fieldPart}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          nFields[`${fieldPart}-${idx}`] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    Object.entries(arrayBuckets).forEach(([localKey, b]) => { nLocal[localKey] = b.base; });
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recordId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s+|(?<!\d)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    return record[fn];
  }, [localEdits]);

  const numberShows = useCallback((record, fn, idx) => {
    const value = getFieldValue(record, fn, idx);
    if (value === null || value === undefined || value === '') return false;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return false;
    if (numericValue !== 0) return true;
    const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
    return Boolean(editedFields[`${fn}-${idx}`]) || doctorEdited;
  }, [getFieldValue, editedFields]);

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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      const rt = `Visual Acuity Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
          merged[m[1]] = localEdits[key];
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
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Persist the draft (fieldPart = field name; survives refresh, not in DB/PDF)
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // stageDraft — stage a full-field DRAFT locally + persist to localStorage. NO DB write.
  const stageDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  };

  // Save one sentence = stage a DRAFT locally (survives refresh). NOT written to DB until Approve.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
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

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Commit staged drafts for this record+section to the DB. Drive writes from the draft store
      // (fieldPart = "field" or "field.arrayIndex"); arrayIndex only when last dot-segment is numeric.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedLocalKeys = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const dotIdx = fieldPart.indexOf('.');
        const lastSeg = dotIdx !== -1 ? fieldPart.slice(fieldPart.lastIndexOf('.') + 1) : '';
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(lastSeg);
        const baseField = isArrayItem ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        if (!fields.includes(baseField)) continue; // only this section's fields
        const payload = { field: fieldPart, value };
        const resp = await secureApiClient.put(`/api/edit/visual_acuity_reports/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedLocalKeys.push(`${baseField}-${idx}`);
        delete recDrafts[fieldPart];
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/visual_acuity_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

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
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      const visible = NUMBER_FIELDS.includes(f) ? numberShows(record, f, idx) : hasVal(val);
      if (!visible) return;
      let rows;
      if (ARRAY_FIELDS.includes(f)) rows = (Array.isArray(val) ? val : [val]).flatMap(item => { const parsed = parseLabel(String(item)); return splitByComma(parsed.value); });
      else rows = splitBySentence(fmtVal(val)).map(item => { const parsed = parseLabel(item); return parsed.isLabeled ? `${parsed.label}: ${parsed.value}` : parsed.value; });
      text += `${label}\n${'-'.repeat(40)}\n`;
      rows.filter(Boolean).forEach((row, rowIndex) => { text += `${rowIndex + 1}. ${row}\n`; });
      text += '\n';
    });
    return text;
  }, [getFieldValue, numberShows, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== VISUAL ACUITY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Visual Acuity Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
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
              <input type="text" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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

  /* ═══════ RENDER: BOOLEAN FIELD — select Yes/No, convert to boolean on save ═══════ */
  const renderBooleanFieldLegacy = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD — validate numeric on save ═══════ */
  const renderNumberFieldLegacy = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="text" inputMode="decimal" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (editValue.trim() === '' || isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayFieldLegacy = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; const localKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [localKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [localKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringFieldLegacy = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const id3 = safeId(record); if (!id3) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  const renderBooleanField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (typeof value !== 'boolean') return null;
    const editKey = `${fn}-${idx}`, isEditing = editingField === editKey, label = FIELD_LABELS[fn] || fn, displayValue = value ? 'Yes' : 'No', isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return <div key={fn} className="rec-mini-card nested-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div data-edit-field={fn}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); } }}>{isEditing ? <div className="edit-field-container"><BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} /><div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'Yes'); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div></div>;
  };

  const renderNumberField = (record, fn, idx, sid) => {
    if (!numberShows(record, fn, idx)) return null;
    const value = getFieldValue(record, fn, idx), editKey = `${fn}-${idx}`, isEditing = editingField === editKey, label = FIELD_LABELS[fn] || fn, displayValue = String(value), isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const saveNumber = () => { const parsed = Number(editValue); if (!Number.isFinite(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsed); };
    return <div key={fn} className="rec-mini-card nested-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div data-edit-field={fn}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); } }}>{isEditing ? <div className="edit-field-container"><div className="number-edit-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div>{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); saveNumber(); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div></div>;
  };

  const renderScoreRatioField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (!hasVal(value)) return null;
    const ratio = splitScoreRatio(value); if (!ratio) return renderStringField(record, fn, idx, sid);
    const editKey = `${fn}-${idx}`, isEditing = editingField === editKey, label = FIELD_LABELS[fn] || fn, isModified = editedFields[editKey];
    const change = delta => { const current = Number(editValue); const next = Math.max(0, Math.min(ratio.denominator, (Number.isFinite(current) ? current : 0) + delta)); setEditValue(next.toFixed(ratio.decimals)); };
    const save = () => { const number = Number(editValue); if (!Number.isFinite(number) || number < 0 || number > ratio.denominator) { setSaveError(`Enter a value from 0 to ${ratio.denominator}`); return; } handleSaveField(record, fn, idx, sid, null, `${ratio.prefix}${number.toFixed(ratio.decimals)}${ratio.suffix}`); };
    return <div key={fn} className="rec-mini-card nested-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div data-edit-field={fn}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(ratio.number); } }}>{isEditing ? <div className="edit-field-container"><div className="number-edit-row score-ratio-editor"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(-ratio.step); }}>−</button><input type="text" inputMode="decimal" min="0" max={ratio.denominator} step={ratio.step} className="edit-number" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(ratio.step); }}>+</button><span className="number-edit-unit">{ratio.suffix}</span></div>{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); save(); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(String(value))}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${value}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div></div>;
  };

  const renderStringField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (!hasVal(value)) return null;
    const label = FIELD_LABELS[fn] || fn; if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rows = splitBySentence(fmtVal(value)).map((row, rowIndex) => ({ value: parseLabel(row).value, label: parseLabel(row).isLabeled ? parseLabel(row).label : '', rowIndex }));
    const groups = []; rows.forEach(row => { const previous = groups[groups.length - 1]; if (previous && previous.label === row.label) previous.rows.push(row); else groups.push({ label: row.label, rows: [row] }); });
    const saveRow = row => { const updated = rows.map(item => item.label ? `${item.label}: ${item.value}` : item.value); updated[row.rowIndex] = row.label ? `${row.label}: ${editValue.trim()}` : editValue.trim(); handleSaveField(record, fn, idx, sid, null, updated.join('; '), `${fn}-${idx}-r${row.rowIndex}`); };
    return <div key={fn} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{groups.map((group, groupIndex) => <div key={`${group.label}-${groupIndex}`} className="nested-mini-card">{group.label && <div className="nested-subtitle sub-label">{highlightText(group.label)}</div>}{group.rows.map(row => { const editKey = `${fn}-${idx}-r${row.rowIndex}`, isEditing = editingField === editKey, isModified = editedFields[editKey]; return <div key={editKey} data-edit-field={fn}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(row.value); } }}>{isEditing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); saveRow(row); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(row.value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.value, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>; })}</div>)}</div>;
  };

  const renderArrayField = (record, fn, idx, sid) => {
    const sourceItems = getFieldValue(record, fn, idx); if (!Array.isArray(sourceItems) || !sourceItems.some(Boolean)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const saveClause = (itemIndex, clauseIndex, parsed, clauses) => { const nextClauses = [...clauses]; nextClauses[clauseIndex] = editValue.trim(); const reconstructed = parsed.isLabeled ? `${parsed.label}: ${nextClauses.join(', ')}` : nextClauses.join(', '); const id = safeId(record); if (!id) return; const array = [...sourceItems]; array[itemIndex] = reconstructed; setLocalEdits(previous => ({ ...previous, [`${fn}-${idx}`]: array })); setPendingEdits(previous => ({ ...previous, [`${fn}-${idx}`]: true })); setEditedFields(previous => ({ ...previous, [`${fn}.${itemIndex}.clause${clauseIndex}-${idx}`]: 'edited' })); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][`${fn}.${itemIndex}`] = reconstructed; writeDrafts(store); setEditingField(null); setEditValue(''); };
    return <div key={fn} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{sourceItems.map((item, itemIndex) => { if (!item) return null; const parsed = parseLabel(String(item)); const clauses = COMMA_ARRAY_FIELDS.includes(fn) ? splitByComma(parsed.value) : [parsed.value]; return <div key={itemIndex} className="nested-mini-card">{parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}{clauses.map((clause, clauseIndex) => { const editKey = `${fn}.${itemIndex}-r${clauseIndex}-${idx}`, trackingKey = `${fn}.${itemIndex}.clause${clauseIndex}-${idx}`, isEditing = editingField === editKey, isModified = editedFields[trackingKey]; return <div key={editKey} data-edit-field={`${fn}.${itemIndex}`}><div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(clause); } }}>{isEditing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); saveClause(itemIndex, clauseIndex, parsed, clauses); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(clause)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(clause, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>; })}</div>; })}</div>;
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return NUMBER_FIELDS.includes(f) ? numberShows(record, f, idx) : hasVal(val);
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
            if (SCORE_RATIO_FIELDS.includes(f)) return renderScoreRatioField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="visual-acuity-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Visual Acuity Reports</h2></div>
        <div className="empty-state">No visual acuity reports available</div>
      </div>
    );
  }

  return (
    <div className="visual-acuity-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Visual Acuity Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<VisualAcuityReportsDocumentPDFTemplate document={pdfData} />} fileName="Visual_Acuity_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search visual acuity reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Visual Acuity Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'snellen-chart')}
            {renderSection(record, idx, 'corrected-uncorrected')}
            {renderSection(record, idx, 'near-vision-pinhole')}
            {renderSection(record, idx, 'logmar-etdrs')}
            {renderSection(record, idx, 'refractive-pupillary')}
            {renderSection(record, idx, 'contrast-binocular')}
            {renderSection(record, idx, 'testing-field-defects')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VisualAcuityReportsDocument;
