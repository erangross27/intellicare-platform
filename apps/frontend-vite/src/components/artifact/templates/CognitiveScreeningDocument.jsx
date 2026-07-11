/**
 * CognitiveScreeningDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: cognitive_screening
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CognitiveScreeningDocumentPDFTemplate from '../pdf-templates/CognitiveScreeningDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './CognitiveScreeningDocument.css';

// Copy dividers (mirror the PDF): '=' under record + section titles, '-' under each field label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Decimal-aware step for the −/+ number stepper (scores/durations are integers → step 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative concern-lists (applied per sentence, gated at >=3 parts). Guards:
// parenthesis-aware (sub-lists like "(finances, transportation)" stay whole); keep Oxford ", and/or X"
// attached; skip commas with no following space ("$18,000"); skip date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }                  // "$18,000"
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }     // Oxford ", and X"
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; } // "January 8, 2026"
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const SECTION_TITLES = {
  'test-info': 'Test Information',
  'domain-scores': 'Domain Scores',
  'clinical-observations': 'Clinical Observations',
  'functional-status': 'Functional Status',
  recommendations: 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date', screeningTool: 'Screening Tool', totalScore: 'Total Score', maximumPossibleScore: 'Maximum Score', cognitiveImpairmentSeverity: 'Impairment Severity', testDuration: 'Test Duration (min)', educationYears: 'Education (years)',
  orientationScore: 'Orientation', registrationScore: 'Registration', attentionCalculationScore: 'Attention/Calculation', recallScore: 'Recall', languageScore: 'Language', visuospatialScore: 'Visuospatial', executiveFunctionScore: 'Executive Function',
  informantPresent: 'Informant Present', informantConcerns: 'Informant Concerns', delirium: 'Delirium', behavioralDisturbances: 'Behavioral Disturbances',
  functionalImpairment: 'Functional Impairment', baselineCognitiveState: 'Baseline Cognitive State', hearingAidUsed: 'Hearing Aid Used', visualAidUsed: 'Visual Aid Used', primaryLanguage: 'Primary Language',
  referralIndicated: 'Referral Indicated', comparisonToPriorScore: 'Comparison to Prior Score', clinicalDementiaSeverity: 'Clinical Dementia Severity',
};

const SECTION_FIELDS = {
  'test-info': ['date', 'screeningTool', 'totalScore', 'maximumPossibleScore', 'cognitiveImpairmentSeverity', 'testDuration', 'educationYears'],
  'domain-scores': ['orientationScore', 'registrationScore', 'attentionCalculationScore', 'recallScore', 'languageScore', 'visuospatialScore', 'executiveFunctionScore'],
  'clinical-observations': ['informantPresent', 'informantConcerns', 'delirium', 'behavioralDisturbances'],
  'functional-status': ['functionalImpairment', 'baselineCognitiveState', 'hearingAidUsed', 'visualAidUsed', 'primaryLanguage'],
  recommendations: ['referralIndicated', 'comparisonToPriorScore', 'clinicalDementiaSeverity'],
};

const ARRAY_FIELDS = ['behavioralDisturbances'];
const SENTENCE_FIELDS = ['informantConcerns', 'functionalImpairment', 'baselineCognitiveState', 'comparisonToPriorScore'];
const BOOLEAN_FIELDS = ['informantPresent', 'delirium', 'hearingAidUsed', 'visualAidUsed', 'referralIndicated'];
const DATE_FIELDS = ['date'];
// Numeric fields. Domain subscores / total / maximum: 0 is a clinically meaningful score (e.g. recall=0).
const NUMBER_FIELDS = ['totalScore', 'maximumPossibleScore', 'testDuration', 'educationYears', 'orientationScore', 'registrationScore', 'attentionCalculationScore', 'recallScore', 'languageScore', 'visuospatialScore', 'executiveFunctionScore'];
// For these numeric fields a stored 0 is a "not recorded" sentinel, not a real value — hide it.
const ZERO_SENTINEL_FIELDS = ['testDuration', 'educationYears'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field key, e.g. "totalScore") */
const DRAFT_KEY = 'cognitive_screeningPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CognitiveScreeningDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState('');
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.cognitive_screening) return Array.isArray(r.cognitive_screening) ? r.cognitive_screening : [r.cognitive_screening];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_screening) return Array.isArray(dd.cognitive_screening) ? dd.cognitive_screening : [dd.cognitive_screening]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record?._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
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

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const toInputDate = useCallback((d) => {
    if (!d) return '';
    try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; }
  }, []);

  // True when a numeric field should be displayed (handles zero-sentinel fields).
  const numberShows = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    const v = localEdits[k] !== undefined ? localEdits[k] : record[fn];
    if (typeof v !== 'number' || isNaN(v)) return false;
    if (v === 0 && ZERO_SENTINEL_FIELDS.includes(fn)) return false;
    return true;
  }, [localEdits]);

  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  // Narrative sentence field → sentences (semicolon/period), each further split into comma parts when it
  // yields >=3 (Rule #73): a genuine list becomes one row per item; a 1–2 comma clause stays whole.
  // Returns an array-of-arrays: outer = sentences, inner = comma parts (or [wholeSentence]).
  const sentenceCommaGroups = useCallback((text) => {
    return splitBySentence(text).map(s => { const parts = splitByComma(s); return parts.length >= 3 ? parts : [s]; });
  }, [splitBySentence]);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

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
      const recordTitle = `Cognitive Screening ${idx + 1}`.toLowerCase();
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
  const handleSaveField = useCallback(async (record, fn, idx, sid, _unused, overrideValue) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    const originalVal = record[fn];
    const hasOverride = overrideValue !== undefined;

    // Field type validation — preserve original types
    let saveVal = hasOverride ? overrideValue : trimmed;
    if (!hasOverride) {
      if (typeof originalVal === 'number' && !ARRAY_FIELDS.includes(fn)) {
        if (isNaN(Number(trimmed))) { setSaveError('Please enter a valid number'); return; }
        saveVal = Number(trimmed);
      }
      if (typeof originalVal === 'boolean') {
        const lower = trimmed.toLowerCase();
        if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
        saveVal = ['true', 'yes', '1'].includes(lower);
      }
      if (fn === 'date') {
        const testDate = new Date(trimmed);
        if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; }
      }
    }
    setSaveError('');

    // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
    // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
    const isArray = ARRAY_FIELDS.includes(fn);
    const editKey = editingField;
    const localKey = `${fn}-${idx}`;
    let stagedValue;
    if (isArray) {
      const arrMatch = editKey?.match(/-ai(\d+)$/);
      const arrayIndex = arrMatch ? parseInt(arrMatch[1]) : null;
      if (arrayIndex === null) return;
      const arr = [...(getEffectiveArray(record, fn, idx))]; arr[arrayIndex] = editValue; stagedValue = arr;
      setLocalEdits(prev => ({ ...prev, [localKey]: arr }));
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-ai${arrayIndex}`]: 'edited' }));
    } else {
      stagedValue = saveVal;
      setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
      setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = stagedValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Save one comma-part (or whole sentence) of a sentence field. Rebuilds the full field text from the
  // (sentence, comma-part) grid: the edited part replaces groups[si][ci] (re-split if it has its own
  // commas), each sentence is its parts joined by ', ', sentences rejoined with period restoration.
  function saveCommaPart(record, fn, idx, sid, si, ci) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const groups = sentenceCommaGroups(currentVal);
    if (!groups[si]) return;
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      groups[si].splice(ci, 1);
      if (groups[si].length === 0) groups.splice(si, 1);
      const fullText = reconstructFullText(groups.map(g => g.join(', ')).filter(s => s.trim()));
      stageDraft(fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newParts = splitByComma(editedVal); const insert = newParts.length ? newParts : [editedVal];
    const originalPart = groups[si][ci] || '';
    groups[si].splice(ci, 1, ...insert);
    const fullText = reconstructFullText(groups.map(g => g.join(', ')).filter(s => s.trim()));
    stageDraft(fullText);
    const changed = insert[0].replace(/[;.]+$/, '').trim() !== originalPart.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${si}-c${ci}`] = 'edited'; for (let e = 1; e < insert.length; e++) n[`${fn}-${idx}-s${si}-c${ci + e}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Pending drafts belonging to this section's fields (localEdits key = `${field}-${idx}`).
    const toCommit = fields
      .map(f => `${f}-${idx}`)
      .filter(localKey => pendingEdits[localKey] && localEdits[localKey] !== undefined);
    setSaving(true);
    try {
      for (const localKey of toCommit) {
        // Reverse the `${fieldName}-${idx}` convention; the trailing dot-segment rule does not apply here
        // (these keys never carry a ".<arrayIndex>" suffix — array fields store the full array as the value).
        const fieldPart = localKey.slice(0, -`-${idx}`.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[localKey] };
        if (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) {
          payload.field = fieldPart.slice(0, dotIdx);
          payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/cognitive_screening/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/cognitive_screening/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CognitiveScreening] Approve error:', err); } finally { setSaving(false); }
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
  // valueOf(f) abstracts the source — Copy Section reads live edits, Copy All reads committed pdfData.
  const buildSectionCopy = (sid, valueOf) => {
    const title = SECTION_TITLES[sid]; const blocks = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f; const val = valueOf(f);
      if (!hasVal(val)) return;
      if (val === 0 && ZERO_SENTINEL_FIELDS.includes(f)) return;
      let rows;
      if (ARRAY_FIELDS.includes(f)) { const arr = (Array.isArray(val) ? val : []).filter(hasVal); if (!arr.length) return; rows = arr.map(String); }
      else if (SENTENCE_FIELDS.includes(f)) { const g = sentenceCommaGroups(fmtVal(val)).flat(); rows = g.length ? g : [fmtVal(val)]; }
      else if (DATE_FIELDS.includes(f)) { rows = [formatDate(val)]; }
      else rows = [fmtVal(val)];
      const numbered = rows.map((r, i) => `${i + 1}. ${r}`).join('\n');
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      blocks.push(showLabel ? `${label}\n${COPY_LINE_DASH}\n${numbered}` : numbered);
    });
    return blocks.length ? `${title.toUpperCase()}\n${COPY_LINE_EQ}\n\n${blocks.join('\n\n')}` : '';
  };

  const buildSectionCopyText = useCallback((record, idx, sid) =>
    buildSectionCopy(sid, f => getFieldValue(record, f, idx)),
    [getFieldValue, hasVal, fmtVal, formatDate, splitBySentence]);

  const copyAllText = useCallback(async () => {
    // 'date' lives in the test-info section, so it prints there — no separate header Date block.
    const chunks = pdfData.map((r, idx) => {
      const secs = Object.keys(SECTION_FIELDS).map(sid => buildSectionCopy(sid, f => r[f])).filter(Boolean);
      return `COGNITIVE SCREENING ${idx + 1}\n${COPY_LINE_EQ}\n\n${secs.join('\n\n')}`;
    });
    const text = `COGNITIVE SCREENING RECORDS\n\n${chunks.join('\n\n\n')}`;
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence]);

  // ========== RENDER HELPERS ==========
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val); const isModified = editedFields[editKey]; const itemId = `${fn}-${idx}`;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(''); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(''); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />{saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  // Narrative field → one row per sentence, and per comma-part when a sentence is a >=3-item list.
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const groups = sentenceCommaGroups(val); if (groups.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {groups.map((parts, si) => parts.map((part, ci) => {
            const rowKey = `${fn}-${idx}-s${si}-c${ci}`; const isEditing = editingField === rowKey; const badge = editedSentences[rowKey];
            const rowMatches = phraseMatch || (searchTerm.trim() && part.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!rowMatches && searchTerm.trim()) return null;
            return (
              <div key={`${si}-${ci}`}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(part.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaPart(record, fn, idx, sid, si, ci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          }))}
        </div>
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, title) => {
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
            const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!itemMatches && searchTerm.trim()) return null;
            return (
              <div key={ai}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNumberField = (record, fn, idx, sid, title) => {
    if (!numberShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = String(val); const isModified = editedFields[editKey]; const itemId = editKey;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={ev => { ev.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); setSaveError(''); }}>−</button>
                <input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} onChange={e => { setEditValue(e.target.value); setSaveError(''); }} autoFocus onClick={ev => ev.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={ev => { ev.stopPropagation(); const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); setSaveError(''); }}>+</button>
              </div>
              {saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div>
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (typeof val !== 'boolean') return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No'; const isModified = editedFields[editKey]; const itemId = editKey;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'true' : 'false'); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'true'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div>
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderDateField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = formatDate(val); const isModified = editedFields[editKey]; const itemId = editKey;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(''); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => { setEditValue(iso); setSaveError(''); }} />
              {saveError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div>
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[itemId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, itemId); }}>{copiedItems[itemId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx); return hasVal(getFieldValue(record, f, idx)); });
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid, title);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="cognitive-screening" ref={containerRef}><div className="document-header"><h2 className="document-title">Cognitive Screening</h2></div><div className="empty-state">No cognitive screening records available</div></div>);
  }

  return (
    <div className="cognitive-screening" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cognitive Screening</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CognitiveScreeningDocumentPDFTemplate document={pdfData} />} fileName="Cognitive_Screening.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search cognitive screening..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Cognitive Screening ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'test-info')}
            {renderMixedSection(record, idx, 'domain-scores')}
            {renderMixedSection(record, idx, 'clinical-observations')}
            {renderMixedSection(record, idx, 'functional-status')}
            {renderMixedSection(record, idx, 'recommendations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CognitiveScreeningDocument;
