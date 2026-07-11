/**
 * OutcomesPredictionsSmartDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: outcomes_prediction
 *
 * 7 Sections:
 *   1. prognosis: prognosis, priority
 *   2. modifiable-factors: modifiableFactors (array of {factor, impact, recommendation})
 *   3. expected-outcomes: expectedOutcomes
 *   4. predictions: predictions (array of {outcome, probability, riskLevel, timeframe, confidenceInterval, contributingFactors, mitigationStrategies})
 *   5. risk-overview: mortalityRisk, mortalityTimeframe, readmissionRisk, readmissionTimeframe, riskScores
 *   6. risk-factors: complicationRisks, protectiveFactors, modifiableRiskFactors, nonModifiableRiskFactors
 *   7. interventions: interventionRecommendations
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import OutcomesPredictionsPDFTemplate from '../pdf-templates/OutcomesPredictionTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './OutcomesPredictionsSmartDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the field path "fn", possibly dotted) */
const DRAFT_KEY = 'outcomes_predictions_smartPendingEdits';
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
  'prognosis': 'Prognosis',
  'modifiable-factors': 'Modifiable Factors',
  'expected-outcomes': 'Expected Outcomes',
  'predictions': 'Outcome Predictions',
  'risk-overview': 'Risk Overview',
  'risk-factors': 'Risk Factors',
  'interventions': 'Intervention Recommendations',
};

const FIELD_LABELS = {
  prognosis: 'Prognosis',
  priority: 'Priority',
  expectedOutcomes: 'Expected Outcomes',
  mortalityRisk: 'Mortality Risk',
  mortalityTimeframe: 'Mortality Timeframe',
  readmissionRisk: 'Readmission Risk',
  readmissionTimeframe: 'Readmission Timeframe',
};

const SECTION_FIELDS = {
  'prognosis': ['prognosis', 'priority'],
  'modifiable-factors': ['modifiableFactors'],
  'expected-outcomes': ['expectedOutcomes'],
  'predictions': ['predictions'],
  'risk-overview': ['mortalityRisk', 'mortalityTimeframe', 'readmissionRisk', 'readmissionTimeframe', 'riskScores'],
  'risk-factors': ['complicationRisks', 'protectiveFactors', 'modifiableRiskFactors', 'nonModifiableRiskFactors'],
  'interventions': ['interventionRecommendations'],
};

const STRING_FIELDS = ['prognosis', 'priority', 'expectedOutcomes', 'mortalityRisk', 'mortalityTimeframe', 'readmissionRisk', 'readmissionTimeframe'];
const ARRAY_FIELDS = ['modifiableFactors', 'predictions', 'complicationRisks', 'protectiveFactors', 'modifiableRiskFactors', 'nonModifiableRiskFactors', 'interventionRecommendations'];

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (rest.startsWith('#')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const OutcomesPredictionsSmartDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.outcomes_prediction) return Array.isArray(r.outcomes_prediction) ? r.outcomes_prediction : [r.outcomes_prediction];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.outcomes_prediction) return Array.isArray(dd.outcomes_prediction) ? dd.outcomes_prediction : [dd.outcomes_prediction]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
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
        if (Array.isArray(val)) { if (val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (JSON.stringify(val).toLowerCase().includes(phrase)) return true; }
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
      if (Array.isArray(val)) return val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  /* parsedLabelMatch: when label matches search, show ALL comma items */
  const parsedLabelMatch = useCallback((text) => {
    if (!searchTerm.trim() || !text) return false;
    const parsed = parseLabel(String(text));
    if (!parsed.isLabeled) return false;
    return parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Outcomes Prediction ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase)) : typeof val === 'object' ? JSON.stringify(val).toLowerCase().includes(phrase) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
  /* Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
     fieldPart = the field path "fn" (possibly dotted); localEdits key = `${fn}-${idx}`. */
  const stageDraft = useCallback((record, fn, idx, value, sectionId) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    if (sectionId) setApprovedSections(prev => {
      const k = `${sectionId}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal, sid);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }

    /* ". Test" handling: add as new comma items in labeled sentence */
    const parsed = parseLabel(sentences[sentenceIdx] || '');
    if (parsed.isLabeled && editedVal.startsWith('. ')) {
      const newItems = editedVal.slice(2).split(/\.\s+/).map(s => s.trim()).filter(Boolean);
      const existingCommaItems = splitByComma(parsed.value);
      const updatedValue = [...existingCommaItems, ...newItems].join(', ');
      const updatedSentence = `${parsed.label}: ${updatedValue}`;
      const updated = [...sentences]; updated[sentenceIdx] = updatedSentence;
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }

    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, fullText, sid);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItemInSentence(record, fn, idx, sid, sentenceIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sentenceIdx] || '';
    const parsed = parseLabel(sentence);
    const editedVal = editValue.trim();

    setSaveError(null);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      /* ". Test" handling: add new comma items */
      if (editedVal.startsWith('. ')) {
        const newItems = editedVal.slice(2).split(/\.\s+/).map(s => s.trim()).filter(Boolean);
        const updatedItems = [...commaItems, ...newItems];
        const updatedSentence = `${parsed.label}: ${updatedItems.join(', ')}`;
        const updated = [...sentences]; updated[sentenceIdx] = updatedSentence;
        const fullText = reconstructFullText(updated);
        stageDraft(record, fn, idx, fullText, sid);
        setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}-c${commaIdx}`]: 'edited' }));
        setEditingField(null); setEditValue('');
        return;
      }
      if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
        commaItems.splice(commaIdx, 1);
      } else {
        commaItems[commaIdx] = editedVal;
      }
      const updatedSentence = `${parsed.label}: ${commaItems.join(', ')}`;
      const updated = [...sentences]; updated[sentenceIdx] = updatedSentence;
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}-c${commaIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
    } else {
      /* non-labeled comma split */
      const commaItems = splitByComma(sentence);
      if (editedVal.startsWith('. ')) {
        const newItems = editedVal.slice(2).split(/\.\s+/).map(s => s.trim()).filter(Boolean);
        const updatedItems = [...commaItems, ...newItems];
        const updated = [...sentences]; updated[sentenceIdx] = updatedItems.join(', ');
        const fullText = reconstructFullText(updated);
        stageDraft(record, fn, idx, fullText, sid);
        setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}-c${commaIdx}`]: 'edited' }));
        setEditingField(null); setEditValue('');
        return;
      }
      if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
        commaItems.splice(commaIdx, 1);
      } else {
        commaItems[commaIdx] = editedVal;
      }
      const updated = [...sentences]; updated[sentenceIdx] = commaItems.join(', ');
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}-c${commaIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
    }
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
    const suffix = `-${idx}`;
    // Pending drafts for this record+section: localEdits key = `${fn}-${idx}`; base field of fn must be in this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fn = k.slice(0, -suffix.length); // "field" or dotted path like "modifiableFactors.0.factor"
      const baseField = fn.includes('.') ? fn.split('.')[0] : fn;
      return fields.includes(baseField);
    });
    try {
      // Persist each staged field to the DB now (field = the full path "fn", value = staged value).
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, -suffix.length);
        const resp = await secureApiClient.put(`/api/edit/outcomes_predictions_smart/${id}/edit`, { field: fn, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/outcomes_predictions_smart/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => { const fn = editKey.slice(0, -suffix.length); delete store[id][fn]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

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
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) {
          parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        } else { lines.push(`${n++}. ${s}`); }
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;

    if (sid === 'prognosis') {
      const prog = getFieldValue(record, 'prognosis', idx);
      const pri = getFieldValue(record, 'priority', idx);
      if (hasVal(pri)) text += `Priority: ${pri}\n\n`;
      if (hasVal(prog)) {
        text += 'Prognosis\n';
        formatSentenceFieldLines(fmtVal(prog)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }
    } else if (sid === 'modifiable-factors') {
      const factors = getFieldValue(record, 'modifiableFactors', idx);
      if (hasVal(factors)) {
        factors.forEach((mf, i) => {
          text += `${i + 1}. ${mf.factor || ''}\n`;
          if (mf.impact) text += `   Impact: ${mf.impact}\n`;
          if (mf.recommendation) text += `   Recommendation: ${mf.recommendation}\n`;
          text += '\n';
        });
      }
    } else if (sid === 'expected-outcomes') {
      const eo = getFieldValue(record, 'expectedOutcomes', idx);
      if (hasVal(eo)) {
        text += fmtVal(eo) + '\n\n';
      }
    } else if (sid === 'predictions') {
      const preds = getFieldValue(record, 'predictions', idx);
      if (hasVal(preds)) {
        preds.forEach((pred, i) => {
          text += `${i + 1}. ${pred.outcome || pred.condition || ''}\n`;
          if (pred.probability || pred.risk) text += `   Probability: ${pred.probability || pred.risk}\n`;
          if (pred.riskLevel) text += `   Risk Level: ${pred.riskLevel}\n`;
          if (pred.timeframe) text += `   Timeframe: ${pred.timeframe}\n`;
          if (pred.confidenceInterval) text += `   Confidence Interval: ${pred.confidenceInterval}\n`;
          if (pred.contributingFactors?.length > 0) {
            text += `   Contributing Factors:\n`;
            pred.contributingFactors.forEach(f => { text += `     - ${f}\n`; });
          }
          if (pred.mitigationStrategies?.length > 0) {
            text += `   Mitigation Strategies:\n`;
            pred.mitigationStrategies.forEach(s => { text += `     - ${s}\n`; });
          }
          text += '\n';
        });
      }
    } else if (sid === 'risk-overview') {
      ['mortalityRisk', 'mortalityTimeframe', 'readmissionRisk', 'readmissionTimeframe'].forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (hasVal(val)) text += `${FIELD_LABELS[f]}: ${fmtVal(val)}\n`;
      });
      const scores = getFieldValue(record, 'riskScores', idx);
      if (hasVal(scores)) {
        text += '\nRisk Scores:\n';
        Object.entries(scores).forEach(([k, v]) => { text += `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}\n`; });
      }
      text += '\n';
    } else if (sid === 'risk-factors') {
      const groups = [
        { field: 'complicationRisks', label: 'Complication Risks' },
        { field: 'protectiveFactors', label: 'Protective Factors' },
        { field: 'modifiableRiskFactors', label: 'Modifiable Risk Factors' },
        { field: 'nonModifiableRiskFactors', label: 'Non-Modifiable Risk Factors' },
      ];
      groups.forEach(({ field, label }) => {
        const val = getFieldValue(record, field, idx);
        if (hasVal(val)) {
          text += `${label}:\n`;
          val.forEach((item, i) => {
            if (typeof item === 'object') {
              text += `  ${i + 1}. ${item.complication || item.factor || JSON.stringify(item)}\n`;
            } else {
              text += `  ${i + 1}. ${item}\n`;
            }
          });
          text += '\n';
        }
      });
    } else if (sid === 'interventions') {
      const recs = getFieldValue(record, 'interventionRecommendations', idx);
      if (hasVal(recs)) {
        recs.forEach((rec, i) => {
          if (typeof rec === 'object') {
            text += `${i + 1}. ${rec.intervention || ''}\n`;
            if (rec.expectedImpact) text += `   Expected Impact: ${rec.expectedImpact}\n`;
            if (rec.priority) text += `   Priority: ${rec.priority}\n`;
          } else {
            text += `${i + 1}. ${rec}\n`;
          }
          text += '\n';
        });
      }
    }
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== OUTCOMES & PREDICTIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      if (pdfData.length > 1) text += `Outcomes Prediction ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: STRING FIELD with sentence/comma splitting ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Duplicate label suppression: skip nested-subtitle when label === section title */
    const sectionTitle = (SECTION_TITLES[sid] || '').toLowerCase().trim();
    const showLabel = label.toLowerCase().trim() !== sectionTitle;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);

          /* Labeled sentence with comma items */
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            /* parsedLabelMatch: when label matches search, show ALL comma items */
            const labelMatchesSearch = parsedLabelMatch(sentence);
            if (commaItems.length >= 2) {
              /* Duplicate label suppression for labeled sentence */
              const showSentenceLabel = parsed.label.toLowerCase().trim() !== sectionTitle;
              return (
                <div key={sIdx}>
                  {showSentenceLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  {commaItems.map((item, cIdx) => {
                    if (searchTerm.trim() && !labelMatchesSearch && !item.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
                    const editKey = `${fn}-${idx}-s${sIdx}-c${cIdx}`;
                    const isEditing = editingField === editKey;
                    const isModified = editedSentences[editKey];
                    return (
                      <div key={cIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fn, idx, sid, sIdx, cIdx); }}>Save</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="row-content"><span className="content-value">{highlightText(item)}</span></span>
                            {isModified && <span className="modified-badge">{isModified === 'added' ? 'added' : 'modified by doctor'}</span>}
                            <span className="edit-indicator">{'\u270E'}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }
            /* Single-value labeled sentence: show nested-subtitle + value row */
            const editKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === editKey;
            const isModified = editedSentences[editKey];
            const showSentenceLabel = parsed.label.toLowerCase().trim() !== sectionTitle;
            return (
              <div key={sIdx}>
                {showSentenceLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.value); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>Save</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="row-content"><span className="content-value">{highlightText(parsed.value)}</span></span>
                      {isModified && <span className="modified-badge">{isModified === 'added' ? 'added' : 'modified by doctor'}</span>}
                      <span className="edit-indicator">{'\u270E'}</span>
                    </>
                  )}
                </div>
              </div>
            );
          }

          /* Non-labeled sentence — also comma-split if 2+ items */
          const commaItems = splitByComma(sentence);
          if (commaItems.length >= 2) {
            return (
              <div key={sIdx}>
                {commaItems.map((item, cIdx) => {
                  if (searchTerm.trim() && !item.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !sectionTitleMatches(sid)) return null;
                  const editKey = `${fn}-${idx}-s${sIdx}-c${cIdx}`;
                  const isEditing = editingField === editKey;
                  const isModified = editedSentences[editKey];
                  return (
                    <div key={cIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fn, idx, sid, sIdx, cIdx); }}>Save</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="row-content"><span className="content-value">{highlightText(item)}</span></span>
                          {isModified && <span className="modified-badge">{isModified === 'added' ? 'added' : 'modified by doctor'}</span>}
                          <span className="edit-indicator">{'\u270E'}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          /* Simple sentence — single row */
          const editKey = `${fn}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isModified = editedSentences[editKey];
          return (
            <div key={sIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(sentence); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>Save</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="row-content"><span className="content-value">{highlightText(sentence + (sentence.endsWith('.') ? '' : '.'))}</span></span>
                  {isModified && <span className="modified-badge">{isModified === 'added' ? 'added' : 'modified by doctor'}</span>}
                  <span className="edit-indicator">{'\u270E'}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: simple string field (short, single-line) ═══════ */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fmtVal(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>Save</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <span className="row-content"><span className="content-value">{highlightText(fmtVal(val))}</span></span>
              {isModified && <span className="modified-badge">modified by doctor</span>}
              <span className="edit-indicator">{'\u270E'}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: array of objects (modifiableFactors, predictions, interventionRecommendations) ═══════ */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || !Array.isArray(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return val.map((item, aIdx) => {
      if (typeof item === 'object' && item !== null) {
        const entries = Object.entries(item).filter(([k]) => !k.startsWith('_'));
        const titleKey = entries.length > 0 ? entries[0] : null;
        return (
          <div key={aIdx} className="rec-mini-card">
            {titleKey && <div className="nested-subtitle">{highlightText(`${aIdx + 1}. ${String(titleKey[1])}`)}</div>}
            {entries.slice(titleKey ? 1 : 0).map(([subKey, subVal]) => {
              if (!hasVal(subVal)) return null;
              const subLabel = subKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              if (Array.isArray(subVal)) {
                return (
                  <div key={subKey}>
                    <div className="nested-subtitle" style={{ fontSize: '15px', borderBottom: 'none', marginBottom: 2, paddingBottom: 0 }}>{highlightText(subLabel)}</div>
                    {subVal.map((si, siIdx) => {
                      const editKey = `${fn}.${aIdx}.${subKey}.${siIdx}-${idx}`;
                      const isEditing = editingField === editKey;
                      const isModified = editedFields[editKey];
                      return (
                        <div key={siIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(si)); setSaveError(null); } }}>
                          {isEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, `${fn}.${aIdx}.${subKey}`, idx, sid, null, editValue, editKey); }}>Save</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="row-content"><span className="content-value">{highlightText(String(si))}</span></span>
                              {isModified && <span className="modified-badge">modified by doctor</span>}
                              <span className="edit-indicator">{'\u270E'}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              const editKey = `${fn}.${aIdx}.${subKey}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              return (
                <div key={subKey} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(fmtVal(subVal)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveField(record, `${fn}.${aIdx}.${subKey}`, idx, sid, null, undefined, editKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, `${fn}.${aIdx}.${subKey}`, idx, sid, null, undefined, editKey); }}>Save</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="row-content"><span style={{ color: '#93c5fd', fontWeight: 600, marginRight: 8 }}>{highlightText(subLabel)}:</span><span className="content-value">{highlightText(fmtVal(subVal))}</span></span>
                      {isModified && <span className="modified-badge">modified by doctor</span>}
                      <span className="edit-indicator">{'\u270E'}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      /* Simple string item in array */
      const editKey = `${fn}.${aIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      return (
        <div key={aIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid, null, editValue, editKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue, editKey); }}>Save</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <span className="row-content"><span className="content-value">{highlightText(String(item))}</span></span>
              {isModified && <span className="modified-badge">modified by doctor</span>}
              <span className="edit-indicator">{'\u270E'}</span>
            </>
          )}
        </div>
      );
    });
  };

  /* ═══════ RENDER: riskScores object ═══════ */
  const renderRiskScoresField = (record, idx, sid) => {
    const scores = getFieldValue(record, 'riskScores', idx);
    if (!hasVal(scores) || typeof scores !== 'object') return null;
    if (searchTerm.trim() && !JSON.stringify(scores).toLowerCase().includes(searchTerm.toLowerCase().trim()) && !sectionTitleMatches(sid)) return null;

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText('Risk Scores')}</div>
        {Object.entries(scores).map(([key, value]) => {
          const editKey = `riskScores.${key}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const displayLabel = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          return (
            <div key={key} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, `riskScores.${key}`, idx, sid, null, undefined, editKey); }}>Save</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="row-content"><span style={{ color: '#93c5fd', fontWeight: 600, marginRight: 8 }}>{highlightText(displayLabel)}:</span><span className="content-value">{highlightText(displayVal)}</span></span>
                  {isModified && <span className="modified-badge">modified by doctor</span>}
                  <span className="edit-indicator">{'\u270E'}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    const copyText = buildSectionCopyText(record, idx, sid);

    let content;
    if (sid === 'prognosis') {
      const priField = renderSimpleField(record, 'priority', idx, sid);
      const progField = renderSentenceEditableField(record, 'prognosis', idx, sid);
      if (!priField && !progField) return null;
      content = <>{priField}{progField}</>;
    } else if (sid === 'modifiable-factors') {
      const rendered = renderObjectArrayField(record, 'modifiableFactors', idx, sid);
      if (!rendered || (Array.isArray(rendered) && rendered.every(r => r === null))) return null;
      content = rendered;
    } else if (sid === 'expected-outcomes') {
      const rendered = renderSentenceEditableField(record, 'expectedOutcomes', idx, sid);
      if (!rendered) return null;
      content = rendered;
    } else if (sid === 'predictions') {
      const rendered = renderObjectArrayField(record, 'predictions', idx, sid);
      if (!rendered || (Array.isArray(rendered) && rendered.every(r => r === null))) return null;
      content = rendered;
    } else if (sid === 'risk-overview') {
      const fields = ['mortalityRisk', 'mortalityTimeframe', 'readmissionRisk', 'readmissionTimeframe'].map(f => renderSimpleField(record, f, idx, sid));
      const scoresField = renderRiskScoresField(record, idx, sid);
      if (fields.every(f => f === null) && !scoresField) return null;
      content = <>{fields}{scoresField}</>;
    } else if (sid === 'risk-factors') {
      const groups = ['complicationRisks', 'protectiveFactors', 'modifiableRiskFactors', 'nonModifiableRiskFactors'];
      const rendered = groups.map(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return null;
        const groupLabel = f.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        return (
          <div key={f} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(groupLabel)}</div>
            {val.map((item, aIdx) => {
              const displayText = typeof item === 'object' ? (item.complication ? `${item.complication}: ${item.probability || item.risk || ''}` : JSON.stringify(item)) : String(item);
              const editKey = `${f}.${aIdx}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              return (
                <div key={aIdx} className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof item === 'string' ? item : displayText); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, f, idx, sid, null, editValue, editKey); }}>Save</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="row-content"><span className="content-value">{highlightText(displayText)}</span></span>
                      {isModified && <span className="modified-badge">modified by doctor</span>}
                      <span className="edit-indicator">{'\u270E'}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      });
      if (rendered.every(r => r === null)) return null;
      content = rendered;
    } else if (sid === 'interventions') {
      const rendered = renderObjectArrayField(record, 'interventionRecommendations', idx, sid);
      if (!rendered || (Array.isArray(rendered) && rendered.every(r => r === null))) return null;
      content = rendered;
    }

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              {renderApproveButton(record, sid, idx)}
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copySection(copyText, copyId); }}>{copiedSection === copyId ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          {content}
        </div>
      </div>
    );
  };

  /* ═══════ EMPTY STATE ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="outcomes-predictions-smart-document" ref={containerRef}>
        <div className="empty-state">No outcomes prediction data available.</div>
      </div>
    );
  }

  return (
    <div className="outcomes-predictions-smart-document" ref={containerRef}>
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Outcomes & Predictions</h1>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied' : 'Copy All'}</button>
          {pdfData.length > 0 && (
            <PDFDownloadLink
              document={<OutcomesPredictionsPDFTemplate documents={pdfData} />}
              fileName={`Outcomes_Predictions_${new Date().toISOString().split('T')[0]}.pdf`}
              className="copy-btn"
            >
              {({ loading }) => loading ? 'Preparing...' : 'Export PDF'}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input className="search-input" type="text" placeholder="Search outcomes, predictions, risk factors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm.trim() && <div className="search-results">{filteredRecords.length} of {records.length} records match</div>}
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            {filteredRecords.length > 1 && (
              <div className="record-header">
                <h2 className="record-name">{highlightText(`Outcomes Prediction ${idx + 1}`)}</h2>
              </div>
            )}
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>

      {/* Empty search state */}
      {searchTerm.trim() && filteredRecords.length === 0 && (
        <div className="empty-state">No results found for "{searchTerm}".</div>
      )}
    </div>
  );
};

export default OutcomesPredictionsSmartDocument;
