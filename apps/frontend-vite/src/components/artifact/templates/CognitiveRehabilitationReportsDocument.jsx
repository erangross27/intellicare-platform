/**
 * CognitiveRehabilitationReportsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: cognitive_rehabilitation_reports
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CognitiveRehabilitationReportsDocumentPDFTemplate from '../pdf-templates/CognitiveRehabilitationReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CognitiveRehabilitationReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cognitive_rehabilitation_reportsPendingEdits';
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
  clinicalScales: 'Clinical Scales',
  neuropsychTesting: 'Neuropsychological Testing',
  cognitiveProfile: 'Cognitive Profile',
  treatment: 'Treatment',
  rehabGoals: 'Rehabilitation Goals',
};

const FIELD_LABELS = {
  cognitiveAssessmentScore: 'Cognitive Assessment Score', miniMentalStateExam: 'Mini-Mental State Exam', glasgowComaScale: 'Glasgow Coma Scale',
  ranchosLosAmigosLevel: 'Rancho Los Amigos Level', disabilityRatingScale: 'Disability Rating Scale', functionalIndependenceMeasure: 'Functional Independence Measure',
  galvestonOrientationTest: 'Galveston Orientation Test',
  trailMakingTestA: 'Trail Making Test A', trailMakingTestB: 'Trail Making Test B', digitsSpanForward: 'Digits Span Forward', digitsSpanBackward: 'Digits Span Backward',
  wechslerMemoryScale: 'Wechsler Memory Scale', stroopTestScore: 'Stroop Test', wisconsinCardSort: 'Wisconsin Card Sort', clockDrawingTest: 'Clock Drawing Test', bostonNamingTest: 'Boston Naming Test',
  attentionDeficitSeverity: 'Attention Deficit Severity', executiveFunctionDeficit: 'Executive Function Deficit', workingMemoryCapacity: 'Working Memory Capacity',
  processingSpeedIndex: 'Processing Speed Index', neurocognitiveDisorderType: 'Neurocognitive Disorder Type',
  repetitiveTranscranialMagneticStimulation: 'Repetitive TMS',
  cognitiveRehabilitationGoals: 'Rehabilitation Goals',
};

const SECTION_FIELDS = {
  clinicalScales: ['cognitiveAssessmentScore', 'miniMentalStateExam', 'glasgowComaScale', 'ranchosLosAmigosLevel', 'disabilityRatingScale', 'functionalIndependenceMeasure', 'galvestonOrientationTest'],
  neuropsychTesting: ['trailMakingTestA', 'trailMakingTestB', 'digitsSpanForward', 'digitsSpanBackward', 'wechslerMemoryScale', 'stroopTestScore', 'wisconsinCardSort', 'clockDrawingTest', 'bostonNamingTest'],
  cognitiveProfile: ['attentionDeficitSeverity', 'executiveFunctionDeficit', 'workingMemoryCapacity', 'processingSpeedIndex', 'neurocognitiveDisorderType'],
  treatment: ['repetitiveTranscranialMagneticStimulation'],
  rehabGoals: ['cognitiveRehabilitationGoals'],
};

const SENTENCE_FIELDS = ['neurocognitiveDisorderType'];
const ARRAY_FIELDS = ['cognitiveRehabilitationGoals'];
const BOOLEAN_FIELDS = ['repetitiveTranscranialMagneticStimulation', 'executiveFunctionDeficit'];
const NUMBER_FIELDS = [
  'cognitiveAssessmentScore', 'miniMentalStateExam', 'glasgowComaScale', 'ranchosLosAmigosLevel',
  'disabilityRatingScale', 'functionalIndependenceMeasure', 'galvestonOrientationTest',
  'trailMakingTestA', 'trailMakingTestB', 'digitsSpanForward', 'digitsSpanBackward',
  'wechslerMemoryScale', 'stroopTestScore', 'wisconsinCardSort', 'clockDrawingTest',
  'bostonNamingTest', 'processingSpeedIndex',
];
// All numeric clinical scores use 0 as a "not assessed" sentinel (e.g. GCS minimum is 3),
// so 0 is never meaningful for these fields and should be hidden.
const MEANINGFUL_ZERO_FIELDS = [];
// Copy dividers (mirror the PDF): '=' under record + section titles, '-' under each field label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Decimal-aware step for the −/+ number stepper (clinical scores are integers → step 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const CognitiveRehabilitationReportsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.cognitive_rehabilitation_reports) return Array.isArray(r.cognitive_rehabilitation_reports) ? r.cognitive_rehabilitation_reports : [r.cognitive_rehabilitation_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_rehabilitation_reports) return Array.isArray(dd.cognitive_rehabilitation_reports) ? dd.cognitive_rehabilitation_reports : [dd.cognitive_rehabilitation_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        else nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }, []);

  // Field-aware presence: numeric clinical scores use 0 as a "not assessed" sentinel.
  const hasFieldVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn) && typeof v === 'number' && v === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn)) return false;
    return hasVal(v);
  }, [hasVal]);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
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

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    if (!hasFieldVal(fn, val)) return false;
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal, hasFieldVal]);

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
      else if (hasFieldVal(f, val)) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, hasFieldVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Cognitive Rehabilitation Report ${idx + 1}`.toLowerCase();
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
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    // Type coercion: numbers must save as numbers, booleans as booleans (never strings).
    let outVal = editValue;
    if (NUMBER_FIELDS.includes(fn)) {
      const n = parseFloat(editValue);
      if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
      outVal = n;
    } else if (BOOLEAN_FIELDS.includes(fn)) {
      outVal = editValue === 'yes' || editValue === 'Yes' || editValue === true;
    }
    setSaveError(null);
    const editKeyState = editingField;
    const isArray = ARRAY_FIELDS.includes(fn);
    const localKey = `${fn}-${idx}`;
    let draftValue;
    if (isArray) {
      const arrMatch = editKeyState?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) return;
      const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue;
      draftValue = arr;
      setLocalEdits(prev => ({ ...prev, [localKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    } else {
      draftValue = outVal;
      setLocalEdits(prev => ({ ...prev, [localKey]: outVal }));
      setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = draftValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Save one sentence = stage a DRAFT locally (full field text) + write to localStorage. No DB write
  // until the user clicks Approve (handleApproveSection commits).
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(fullText);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(fullText);
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Commit each staged field in this section to the DB now.
      const committedKeys = [];
      for (const fn of fields) {
        const localKey = `${fn}-${idx}`;
        if (!pendingEdits[localKey] || localEdits[localKey] === undefined) continue;
        const value = localEdits[localKey];
        if (ARRAY_FIELDS.includes(fn) && Array.isArray(value)) {
          for (let ai = 0; ai < value.length; ai++) {
            const resp = await secureApiClient.put(`/api/edit/cognitive_rehabilitation_reports/${id}/edit`, { field: fn, value: value[ai], arrayIndex: ai });
            if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
          }
        } else {
          const resp = await secureApiClient.put(`/api/edit/cognitive_rehabilitation_reports/${id}/edit`, { field: fn, value });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
        committedKeys.push(localKey);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/cognitive_rehabilitation_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(fn => { delete store[id][fn]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CognitiveRehabilitationReports] Approve error:', err); } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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

  // Single section-copy builder (mirrors JSX + PDF): "TITLE\n=(40)\n\nLabel\n-(40)\n1. value\n\n...".
  // valueOf(f)/arrayOf(f) abstract the source — Copy Section reads live edits, Copy All reads pdfData.
  // SINGLE-NAME RULE: a field whose label == the section title has no sub-label (rows go under the EQ).
  const buildSectionCopy = (sid, valueOf, arrayOf) => {
    const title = SECTION_TITLES[sid]; const blocks = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f; const val = valueOf(f);
      let rows;
      if (ARRAY_FIELDS.includes(f)) { const arr = (arrayOf(f) || []).filter(x => hasVal(x)); if (!arr.length) return; rows = arr.map(String); }
      else if (!hasFieldVal(f, val)) return;
      else if (SENTENCE_FIELDS.includes(f)) { const s = splitBySentence(fmtVal(val)); rows = s.length ? s : [fmtVal(val)]; }
      else rows = [fmtVal(val)];
      const numbered = rows.map((r, i) => `${i + 1}. ${r}`).join('\n');
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      blocks.push(showLabel ? `${label}\n${COPY_LINE_DASH}\n${numbered}` : numbered);
    });
    return blocks.length ? `${title.toUpperCase()}\n${COPY_LINE_EQ}\n\n${blocks.join('\n\n')}` : '';
  };

  const buildSectionCopyText = useCallback((record, idx, sid) =>
    buildSectionCopy(sid, f => getFieldValue(record, f, idx), f => getEffectiveArray(record, f, idx)),
    [getFieldValue, getEffectiveArray, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    const chunks = pdfData.map((r, idx) => {
      const dateBlock = r.date ? `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}` : '';
      const secs = Object.keys(SECTION_FIELDS).map(sid => buildSectionCopy(sid, f => r[f], f => (Array.isArray(r[f]) ? r[f] : []))).filter(Boolean);
      const body = [dateBlock, ...secs].filter(Boolean).join('\n\n');
      return `COGNITIVE REHABILITATION REPORT ${idx + 1}\n${COPY_LINE_EQ}\n\n${body}`;
    });
    const text = `COGNITIVE REHABILITATION REPORTS\n\n${chunks.join('\n\n\n')}`;
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val); const isModified = editedFields[editKey]; const itemId = `${fn}-${idx}`;
    const isNumber = NUMBER_FIELDS.includes(fn); const isBool = BOOLEAN_FIELDS.includes(fn);
    const startEdit = () => { if (!isEditing) { setSaveError(null); setEditingField(editKey); setEditValue(isBool ? (val ? 'yes' : 'no') : displayVal); } };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>
          {isEditing ? (<div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>
            ) : isNumber ? (
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={ev => { ev.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} autoFocus onClick={ev => ev.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveField(record, fn, idx, sid); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={ev => { ev.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
            )}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#x270E;</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {arr.map((item, ai) => {
            const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">&#x270E;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasFieldVal(f, getFieldValue(record, f, idx)); });
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
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayItem(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="cognitive-rehabilitation-reports" ref={containerRef}><div className="document-header"><h2 className="document-title">Cognitive Rehabilitation Reports</h2></div><div className="empty-state">No cognitive rehabilitation reports records available</div></div>);
  }

  return (
    <div className="cognitive-rehabilitation-reports" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cognitive Rehabilitation Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CognitiveRehabilitationReportsDocumentPDFTemplate document={pdfData} />} fileName="Cognitive_Rehabilitation_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search cognitive rehabilitation reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Cognitive Rehabilitation Report ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'clinicalScales')}
            {renderMixedSection(record, idx, 'neuropsychTesting')}
            {renderMixedSection(record, idx, 'cognitiveProfile')}
            {renderMixedSection(record, idx, 'treatment')}
            {renderMixedSection(record, idx, 'rehabGoals')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CognitiveRehabilitationReportsDocument;
