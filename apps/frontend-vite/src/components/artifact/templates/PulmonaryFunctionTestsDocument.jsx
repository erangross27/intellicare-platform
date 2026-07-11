/**
 * PulmonaryFunctionTestsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pulmonary_function_tests
 *
 * 9 Sections:
 *   1. test-info: testDate, provider, technician, qualityGrade
 *   2. pre-bronchodilator: preBronchodilator.fev1.percentPredicted, preBronchodilator.fvc.percentPredicted, preBronchodilator.fev1FvcRatio
 *   3. post-bronchodilator: postBronchodilator.fev1.percentPredicted, postBronchodilator.fev1.percentChange
 *   4. interpretation-section: interpretation, reversibility
 *   5. lung-volumes: lungVolumes, comprehensiveLungVolumes
 *   6. diffusion-capacity: dlco, dlcoComprehensive
 *   7. bronchodilator-response: bronchodilatorResponse
 *   8. exercise-testing: sixMinuteWalkTest, cardiopulmonaryExerciseTest
 *   9. quality-section: qualityAssessment, flowVolumeLoop
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PulmonaryFunctionTestsDocumentPDFTemplate from '../pdf-templates/PulmonaryFunctionTestsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PulmonaryFunctionTestsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the full dot-path field name, e.g.
   "interpretation" or "preBronchodilator.fev1.percentPredicted") */
const DRAFT_KEY = 'pulmonaryFunctionTestsPendingEdits';
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
  'test-info': 'Test Information',
  'pre-bronchodilator': 'Pre-Bronchodilator',
  'post-bronchodilator': 'Post-Bronchodilator',
  'interpretation-section': 'Interpretation',
  'lung-volumes': 'Lung Volumes',
  'diffusion-capacity': 'Diffusion Capacity',
  'bronchodilator-response': 'Bronchodilator Response',
  'exercise-testing': 'Exercise Testing',
  'quality-section': 'Quality Assessment',
};

const FIELD_LABELS = {
  testDate: 'Test Date',
  provider: 'Provider',
  technician: 'Technician',
  qualityGrade: 'Quality Grade',
  'preBronchodilator.fev1.percentPredicted': 'FEV1 (% Predicted)',
  'preBronchodilator.fvc.percentPredicted': 'FVC (% Predicted)',
  'preBronchodilator.fev1FvcRatio': 'FEV1/FVC Ratio',
  'postBronchodilator.fev1.percentPredicted': 'FEV1 (% Predicted)',
  'postBronchodilator.fev1.percentChange': 'FEV1 (% Change)',
  interpretation: 'Interpretation',
  reversibility: 'Reversibility',
  predictedPostoperativeFev1: 'Predicted Postoperative FEV1',
  lungVolumes: 'Lung Volumes',
  comprehensiveLungVolumes: 'Comprehensive Lung Volumes',
  dlco: 'DLCO',
  dlcoComprehensive: 'DLCO Comprehensive',
  bronchodilatorResponse: 'Bronchodilator Response',
  sixMinuteWalkTest: 'Six-Minute Walk Test',
  cardiopulmonaryExerciseTest: 'Cardiopulmonary Exercise Test',
  qualityAssessment: 'Quality Assessment',
  flowVolumeLoop: 'Flow-Volume Loop',
};

const SECTION_FIELDS = {
  'test-info': ['testDate', 'provider', 'technician', 'qualityGrade'],
  'pre-bronchodilator': ['preBronchodilator.fev1.percentPredicted', 'preBronchodilator.fvc.percentPredicted', 'preBronchodilator.fev1FvcRatio'],
  'post-bronchodilator': ['postBronchodilator.fev1.percentPredicted', 'postBronchodilator.fev1.percentChange'],
  'interpretation-section': ['interpretation', 'reversibility'],
  'lung-volumes': ['lungVolumes', 'comprehensiveLungVolumes', 'predictedPostoperativeFev1'],
  'diffusion-capacity': ['dlco', 'dlcoComprehensive'],
  'bronchodilator-response': ['bronchodilatorResponse'],
  'exercise-testing': ['sixMinuteWalkTest', 'cardiopulmonaryExerciseTest'],
  'quality-section': ['qualityAssessment', 'flowVolumeLoop'],
};

const DATE_FIELDS = ['testDate'];
/* OBJECT_FIELDS: rendered via recursive renderObjectNode/renderObjectLeaf (nested editable leaves) */
const OBJECT_FIELDS = ['predictedPostoperativeFev1'];
const STRING_FIELDS = ['provider', 'technician', 'qualityGrade', 'interpretation', 'reversibility',
  'preBronchodilator.fev1.percentPredicted', 'preBronchodilator.fvc.percentPredicted', 'preBronchodilator.fev1FvcRatio',
  'postBronchodilator.fev1.percentPredicted', 'postBronchodilator.fev1.percentChange',
  'lungVolumes', 'comprehensiveLungVolumes', 'dlco', 'dlcoComprehensive',
  'bronchodilatorResponse', 'sixMinuteWalkTest', 'cardiopulmonaryExerciseTest',
  'qualityAssessment', 'flowVolumeLoop'];

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

/* ═══════ CHART HELPERS ═══════ */
const extractPftPercentage = (val) => {
  if (!val) return null;
  const str = typeof val === 'object' ? (val.percentPredicted || val.value || '') : String(val);
  if (!str) return null;
  const percentMatch = String(str).match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return parseFloat(percentMatch[1]);
  const numMatch = String(str).match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
};

const getPftColor = (pct) => { if (pct >= 80) return '#22c55e'; if (pct >= 60) return '#3b82f6'; if (pct >= 40) return '#f59e0b'; return '#ef4444'; };
const getPftInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 60) return 'Mildly Reduced'; if (pct >= 40) return 'Moderately Reduced'; return 'Severely Reduced'; };
const getRatioColor = (pct) => { if (pct >= 80) return '#22c55e'; if (pct >= 70) return '#3b82f6'; if (pct >= 60) return '#f59e0b'; return '#ef4444'; };
const getRatioInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 70) return 'Low Normal'; if (pct >= 60) return 'Mild Obstruction'; return 'Significant Obstruction'; };

const prepareChartData = (test) => {
  const charts = [];
  const pre = test.preBronchodilator || {};
  const fev1Pct = extractPftPercentage(pre.fev1?.percentPredicted || pre.fev1?.value || test.fev1?.percentPredicted || test.fev1?.value);
  if (fev1Pct !== null && fev1Pct > 0) charts.push({ label: 'FEV1 (% Predicted)', percentage: Math.min(100, fev1Pct), rawValue: `${fev1Pct}%`, color: getPftColor(fev1Pct), interpretation: getPftInterpretation(fev1Pct) });
  const fvcPct = extractPftPercentage(pre.fvc?.percentPredicted || pre.fvc?.value || test.fvc?.percentPredicted || test.fvc?.value);
  if (fvcPct !== null && fvcPct > 0) charts.push({ label: 'FVC (% Predicted)', percentage: Math.min(100, fvcPct), rawValue: `${fvcPct}%`, color: getPftColor(fvcPct), interpretation: getPftInterpretation(fvcPct) });
  let ratioVal = pre.fev1FvcRatio || test.fev1FvcRatio; if (typeof ratioVal === 'object' && ratioVal?.value) ratioVal = ratioVal.value;
  const ratioPct = extractPftPercentage(ratioVal);
  if (ratioPct !== null && ratioPct > 0) charts.push({ label: 'FEV1/FVC Ratio', percentage: Math.min(100, ratioPct), rawValue: `${ratioPct}%`, color: getRatioColor(ratioPct), interpretation: getRatioInterpretation(ratioPct) });
  const dlcoPct = extractPftPercentage(test.dlco?.percentPredicted || test.dlco?.value || test.dlco);
  if (dlcoPct !== null && dlcoPct > 0) charts.push({ label: 'DLCO (% Predicted)', percentage: Math.min(100, dlcoPct), rawValue: `${dlcoPct}%`, color: getPftColor(dlcoPct), interpretation: getPftInterpretation(dlcoPct) });
  return charts;
};

/* ═══════ COMPONENT ═══════ */
const PulmonaryFunctionTestsDocument = ({ document: docProp }) => {
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
      if (r?.pulmonary_function_tests) return Array.isArray(r.pulmonary_function_tests) ? r.pulmonary_function_tests : [r.pulmonary_function_tests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pulmonary_function_tests) return Array.isArray(dd.pulmonary_function_tests) ? dd.pulmonary_function_tests : [dd.pulmonary_function_tests]; return [dd]; }
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
      const rid = idOf(record);
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
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0 && Object.values(v).some(vv => vv !== null && vv !== undefined && vv !== ''); return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (typeof v === 'object' && v !== null) { if (v.percentPredicted) return String(v.percentPredicted); if (v.value) return String(v.value); return JSON.stringify(v); } return String(v || ''); }, []);

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

  /* Nested field getter with dot-path support */
  const getNestedVal = useCallback((obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((cur, key) => cur && cur[key] !== undefined ? cur[key] : undefined, obj);
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedVal(record, fn) !== undefined ? getNestedVal(record, fn) : record[fn];
  }, [localEdits, getNestedVal]);

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
      const rt = `Pulmonary Function Test ${idx + 1}`.toLowerCase();
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
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Stage as a DRAFT in localStorage (keyed by the full dot-path field name). Approve commits it.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(record, fn, idx, sid, fullText) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
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
      stageSentenceDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageSentenceDraft(record, fn, idx, sid, fullText);
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

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's pending edits whose field belongs to this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      return fields.includes(fieldPart);
    });
    try {
      // Persist each staged field to the DB now. Field is the full dot-path; arrayIndex ONLY when the
      // segment after the LAST dot is purely numeric (none here — all are object/dot-path names).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = (lastDot !== -1 && /^\d+$/.test(tail))
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(tail, 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        await secureApiClient.put(`/api/edit/pulmonary_function_tests/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/pulmonary_function_tests/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { if (store[id]) delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
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
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (OBJECT_FIELDS.includes(f)) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          text += `${label}\n`;
          const walk = (obj, indent) => {
            Object.entries(obj).forEach(([k, v]) => {
              if (!hasVal(v)) return;
              const lbl = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
              const isDisplayObj = v && typeof v === 'object' && !Array.isArray(v) && (v.value !== undefined || v.percentPredicted !== undefined) && Object.keys(v).every(kk => kk === 'value' || kk === 'percentPredicted');
              if (v && typeof v === 'object' && !Array.isArray(v) && !isDisplayObj) {
                text += `${'  '.repeat(indent)}${lbl}:\n`;
                walk(v, indent + 1);
              } else {
                text += `${'  '.repeat(indent)}${lbl}: ${fmtVal(v)}\n`;
              }
            });
          };
          walk(val, 1);
          text += '\n';
        } else {
          text += `${label}\n${fmtVal(val)}\n\n`;
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
    let text = '=== PULMONARY FUNCTION TESTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pulmonary Function Test ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageSentenceDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageSentenceDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (editable scalar within a nested object) ═══════ */
  const prettyKey = useCallback((k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/\bFev1\b/i, 'FEV1').replace(/\bFvc\b/i, 'FVC').replace(/\bDlco\b/i, 'DLCO').trim(), []);

  const renderObjectLeaf = (record, fn, idx, sid, dotPath, leafKey, leafVal) => {
    const fullPath = `${fn}.${dotPath}`;
    const editKey = `${fullPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const strVal = fmtVal(leafVal);
    const label = prettyKey(leafKey);
    return (
      <div key={leafKey} className="rec-mini-card">
        <div className="object-leaf-label">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fullPath, idx, sid, null, editValue, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: OBJECT NODE (recursive — walks nested objects) ═══════ */
  const renderObjectNode = (record, fn, idx, sid, dotPath, nodeKey, nodeVal, depth) => {
    if (!hasVal(nodeVal)) return null;
    /* Scalar leaf (or {value,percentPredicted}-style display object that fmtVal flattens) */
    const isPlainScalar = nodeVal === null || typeof nodeVal !== 'object' || Array.isArray(nodeVal);
    const isDisplayObj = typeof nodeVal === 'object' && !Array.isArray(nodeVal) &&
      (nodeVal.value !== undefined || nodeVal.percentPredicted !== undefined) &&
      Object.keys(nodeVal).every(k => k === 'value' || k === 'percentPredicted');
    if (isPlainScalar || isDisplayObj) {
      return renderObjectLeaf(record, fn, idx, sid, dotPath, nodeKey, nodeVal);
    }
    /* Nested object — recurse */
    return (
      <div key={nodeKey} className="object-node">
        <div className="object-node-title">{highlightText(prettyKey(nodeKey))}</div>
        {Object.entries(nodeVal).filter(([, v]) => hasVal(v)).map(([k, v]) =>
          renderObjectNode(record, fn, idx, sid, `${dotPath}.${k}`, k, v, depth + 1)
        )}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT FIELD (top-level recursive object) ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    /* Non-object value fell into an object slot — render as string */
    if (typeof val !== 'object' || Array.isArray(val)) {
      return renderStringField(record, fn, idx, sid);
    }
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => renderObjectNode(record, fn, idx, sid, k, k, v, 0))}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
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
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ CHART COMPONENTS ═══════ */
  const Legend = () => (
    <div className="chart-legend">
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal (80%+)</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>Mild (60-79%)</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }} /><span>Moderate (40-59%)</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>Severe (&lt;40%)</span></div>
    </div>
  );

  const BarChart = ({ label, percentage, rawValue, color, interpretation }) => (
    <div className="bar-chart-row">
      <div className="bar-label">{highlightText(label)}</div>
      <div className="bar-container">
        <div className="bar-background">
          <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }} />
        </div>
        <div className="bar-value">{highlightText(rawValue)}</div>
      </div>
      {interpretation && <div className="bar-interpretation" style={{ color }}>{highlightText(interpretation)}</div>}
    </div>
  );

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="pulmonary-function-tests-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pulmonary Function Tests</h2></div>
        <div className="empty-state">No pulmonary function test records available</div>
      </div>
    );
  }

  return (
    <div className="pulmonary-function-tests-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pulmonary Function Tests</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PulmonaryFunctionTestsDocumentPDFTemplate document={pdfData} />} fileName={`pulmonary-function-tests-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search pulmonary function tests..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const chartData = prepareChartData(record);
          const testDate = record.date || record.testDate;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                {hasVal(testDate) && (
                  <div className="record-meta-row">
                    <span className="record-date">{formatDate(testDate)}</span>
                  </div>
                )}
                <h3 className="record-name">{highlightText(`PFT ${idx + 1}`)}</h3>
              </div>
              {/* Score Overview Bar Chart */}
              {chartData.length > 0 && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Score Overview')}</h4>
                    </div>
                    <div className="chart-container">
                      <Legend />
                      {chartData.map((chart, cIdx) => (
                        <BarChart key={cIdx} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {renderSection(record, idx, 'test-info')}
              {renderSection(record, idx, 'pre-bronchodilator')}
              {renderSection(record, idx, 'post-bronchodilator')}
              {renderSection(record, idx, 'interpretation-section')}
              {renderSection(record, idx, 'lung-volumes')}
              {renderSection(record, idx, 'diffusion-capacity')}
              {renderSection(record, idx, 'bronchodilator-response')}
              {renderSection(record, idx, 'exercise-testing')}
              {renderSection(record, idx, 'quality-section')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PulmonaryFunctionTestsDocument;
