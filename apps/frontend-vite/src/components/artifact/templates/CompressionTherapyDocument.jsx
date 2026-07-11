/**
 * CompressionTherapyDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: compression_therapy
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CompressionTherapyDocumentPDFTemplate from '../pdf-templates/CompressionTherapyDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CompressionTherapyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'compressionTherapyPendingEdits';
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
  'garment-info': 'Garment Information',
  'vascular-assessment': 'Vascular Assessment',
  'clinical-status': 'Clinical Status',
  measurements: 'Measurements',
  response: 'Response',
};

const FIELD_LABELS = {
  compressionGarmentType: 'Garment Type', compressionClass: 'Compression Class',
  anklePressureMmHg: 'Ankle Pressure (mmHg)', pressureGradient: 'Pressure Gradient',
  compressionBandageLayers: 'Bandage Layers', compressionDurationWeeks: 'Duration (Weeks)',
  ankleBrachialIndex: 'Ankle-Brachial Index', toeBrachialIndex: 'Toe-Brachial Index',
  venousRefillTime: 'Venous Refill Time', ceapClassification: 'CEAP Classification',
  duplexUltrasoundFindings: 'Duplex Ultrasound Findings', venousClaudication: 'Venous Claudication',
  edemaGrading: 'Edema Grading', lymphedemaStaging: 'Lymphedema Staging',
  skinIntegrity: 'Skin Integrity', lipodermatosclerosis: 'Lipodermatosclerosis',
  venousUlceration: 'Venous Ulceration', mobilityStatus: 'Mobility Status',
  limbCircumferenceMeasurements: 'Limb Circumference Measurements',
  adverseReactions: 'Adverse Reactions', contraindications: 'Contraindications',
  therapeuticResponse: 'Therapeutic Response', compressionTherapyCompliance: 'Compliance',
};

const SECTION_FIELDS = {
  'garment-info': ['compressionGarmentType', 'compressionClass', 'anklePressureMmHg', 'pressureGradient', 'compressionBandageLayers', 'compressionDurationWeeks'],
  'vascular-assessment': ['ankleBrachialIndex', 'toeBrachialIndex', 'venousRefillTime', 'ceapClassification', 'duplexUltrasoundFindings', 'venousClaudication'],
  'clinical-status': ['edemaGrading', 'lymphedemaStaging', 'skinIntegrity', 'lipodermatosclerosis', 'venousUlceration', 'mobilityStatus'],
  measurements: ['limbCircumferenceMeasurements', 'adverseReactions', 'contraindications'],
  response: ['therapeuticResponse', 'compressionTherapyCompliance'],
};

// compressionClass ("Class I: 18-21 mmHg (current), upgrading...") and skinIntegrity ("No erythema,
// warmth, or signs of infection" — a NEGATED list) render WHOLE as plain strings, never comma-split.
const SENTENCE_FIELDS = ['duplexUltrasoundFindings'];
const ARRAY_FIELDS = ['limbCircumferenceMeasurements', 'adverseReactions', 'contraindications'];
const BOOLEAN_FIELDS = ['venousClaudication', 'lipodermatosclerosis', 'venousUlceration'];
const NUMBER_FIELDS = ['ankleBrachialIndex', 'toeBrachialIndex', 'anklePressureMmHg', 'compressionDurationWeeks', 'venousRefillTime', 'compressionBandageLayers'];
// 0 is a sentinel ("not measured/not applied"), never physiologically meaningful — hide it everywhere (JSX, Copy, search, PDF).
const HIDE_ZERO_FIELDS = ['ankleBrachialIndex', 'toeBrachialIndex', 'anklePressureMmHg', 'compressionDurationWeeks', 'venousRefillTime', 'compressionBandageLayers'];
// Fixed-choice clinical fields → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = {
  lymphedemaStaging: ['Stage 0', 'Stage I', 'Stage II', 'Stage III'],
  compressionTherapyCompliance: ['poor', 'fair', 'good', 'excellent'],
  therapeuticResponse: ['improved', 'stable', 'unchanged', 'worsened'],
  mobilityStatus: ['ambulatory', 'ambulatory with assistance', 'wheelchair-bound', 'bedbound'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence / per array item, >=3 gate). Paren-aware; keeps Oxford
// ", and/or X" attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
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

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#>-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const CompressionTherapyDocument = ({ document: docProp }) => {
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
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.compression_therapy) return Array.isArray(r.compression_therapy) ? r.compression_therapy : [r.compression_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.compression_therapy) return Array.isArray(dd.compression_therapy) ? dd.compression_therapy : [dd.compression_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = safeIdOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      // Group array-item drafts (field.arrayIndex) so the whole array lands in one localEdits entry
      const arrayBuckets = {};
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        if (dotIdx !== -1 && /^\d+$/.test(tail)) {
          const fn = fieldPart.slice(0, dotIdx);
          const aIdx = parseInt(tail, 10);
          if (!arrayBuckets[fn]) arrayBuckets[fn] = [...(Array.isArray(record[fn]) ? record[fn] : [])];
          arrayBuckets[fn][aIdx] = value;
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fn}-${idx}-a${aIdx}`] = 'edited';
        } else {
          const fn = fieldPart;
          nLocal[`${fn}-${idx}`] = value;
          nPending[`${fn}-${idx}`] = true;
          if (SENTENCE_FIELDS.includes(fn)) nSentences[`${fn}-${idx}-s0`] = 'edited';
          else nFields[`${fn}-${idx}`] = 'edited';
        }
      });
      Object.entries(arrayBuckets).forEach(([fn, arr]) => { nLocal[`${fn}-${idx}`] = arr; });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && Number(v) === 0) return false; return hasVal(v); }, [hasVal]);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const safeArray = useCallback((v) => { if (!v) return []; return Array.isArray(v) ? v : [v]; }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mmHg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

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
      if (ARRAY_FIELDS.includes(f)) { const items = safeArray(val); if (items.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (hasFieldVal(f, val) && fmtVal(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, safeArray, hasFieldVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (ARRAY_FIELDS.includes(fn)) { const items = safeArray(val); return items.some(item => String(item).toLowerCase().includes(phrase)); }
    return hasFieldVal(fn, val) && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal, safeArray, hasFieldVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Compression Therapy ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt) || 'compression therapy'.includes(phrase)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (ARRAY_FIELDS.includes(f)) { if (safeArray(val).some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (hasFieldVal(f, val) && fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm, fmtVal, safeArray, hasFieldVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  /* ---- field type validation ---- */
  const validateFieldType = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) { if (isNaN(Number(val))) return 'Please enter a valid number'; return null; }
    if (BOOLEAN_FIELDS.includes(fn)) { const low = String(val).toLowerCase().trim(); if (!['yes', 'no', 'true', 'false'].includes(low)) return 'Please enter Yes or No'; return null; }
    return null;
  }, []);
  const convertFieldValue = useCallback((fn, val) => {
    if (NUMBER_FIELDS.includes(fn)) return Number(val);
    if (BOOLEAN_FIELDS.includes(fn)) { const low = String(val).toLowerCase().trim(); return low === 'yes' || low === 'true'; }
    return val;
  }, []);

  // helper: find the section id that owns a field (to clear its approved flag on re-edit)
  const sectionIdForField = useCallback((fn) => { for (const sid of Object.keys(SECTION_FIELDS)) { if ((SECTION_FIELDS[sid] || []).includes(fn)) return sid; } return null; }, []);
  const clearApprovedForField = useCallback((fn, idx) => {
    const sid = sectionIdForField(fn); if (!sid) return;
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  }, [sectionIdForField]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, valueOverride) => {
    const raw = valueOverride !== undefined ? valueOverride : editValue;
    const err = validateFieldType(fn, raw);
    if (err) { setSaveError(err); return; }
    const id = safeId(record); if (!id) return; setSaveError(null);
    const converted = convertFieldValue(fn, raw);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: converted }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    clearApprovedForField(fn, idx);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = converted;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, validateFieldType, convertFieldValue, clearApprovedForField]);

  // Save = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageFieldDraft(id, fn, fullText) {
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); clearApprovedForField(fn, idx); stageFieldDraft(id, fn, fullText); setEditingField(null); setEditValue(''); return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    clearApprovedForField(fn, idx); stageFieldDraft(id, fn, fullText); setEditingField(null); setEditValue('');
  }
  // Save one comma-part of a sentence group (labeled OR unlabeled) = stage a DRAFT. Rebuilds that sentence
  // (preserving a "Label:" head), then the full field text; an empty edit removes the part.
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = curSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    const content = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) curSentences[sIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else curSentences.splice(sIdx, 1);
    const fullText = reconstructFullText(curSentences);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    clearApprovedForField(fn, idx); stageFieldDraft(id, fn, fullText); setEditingField(null); setEditValue('');
  }

  // Save = stage a DRAFT (no DB write). Whole array kept in localEdits for render/PDF; the per-item
  // draft (field.arrayIndex) is stored so Approve can replay the exact original arrayIndex DB write.
  function stageArrayElement(record, fn, idx, arrayIdx, elementVal) {
    const id = safeId(record); if (!id) return;
    const currentArr = [...safeArray(getFieldValue(record, fn, idx))]; currentArr[arrayIdx] = elementVal;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    clearApprovedForField(fn, idx);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrayIdx}`] = elementVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }
  const saveArrayItem = useCallback((record, fn, idx, arrayIdx) => {
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}`]: 'edited' }));
    stageArrayElement(record, fn, idx, arrayIdx, editValue.trim());
  }, [editValue]); // eslint-disable-line react-hooks/exhaustive-deps
  // Numeric array element (e.g. limbCircumferenceMeasurements) — validate + stage as a NUMBER so the stored type is preserved.
  function saveArrayNumberItem(record, fn, idx, arrayIdx) {
    const num = Number(editValue);
    if (editValue === '' || isNaN(num)) { setSaveError('Please enter a valid number'); return; }
    setSaveError(null);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}`]: 'edited' }));
    stageArrayElement(record, fn, idx, arrayIdx, num);
  }
  // Save one comma-part of a >=3 list held in a single array element.
  function saveArrayCommaItem(record, fn, idx, arrayIdx, commaIdx) {
    const element = String(safeArray(getFieldValue(record, fn, idx))[arrayIdx] || '');
    const parsed = parseLabel(element);
    const content = parsed ? parsed.content : element.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    const rebuilt = kept.length > 0 ? (parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ')) : '';
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIdx}-c${commaIdx}`]: 'edited' }));
    stageArrayElement(record, fn, idx, arrayIdx, rebuilt);
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      // Replay each staged draft for this record's section fields as the original DB write.
      // fieldPart "field" → { field, value }; "field.N" (numeric tail) → { field, value, arrayIndex: N }.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedKeys = []; // localEdits keys "${fn}-${idx}" cleared from pendingEdits after commit
      const committedFieldParts = []; // draft keys to remove from the store
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const baseField = (dotIdx !== -1 && /^\d+$/.test(tail)) ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue; // only this section
        const payload = { field: baseField, value };
        if (dotIdx !== -1 && /^\d+$/.test(tail)) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/compression_therapy/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedKeys.push(`${baseField}-${idx}`);
        committedFieldParts.push(fieldPart);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/compression_therapy/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed); remove record entry if emptied
      const store2 = readDrafts();
      if (store2[id]) { committedFieldParts.forEach(fp => delete store2[id][fp]); if (Object.keys(store2[id]).length === 0) delete store2[id]; writeDrafts(store2); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (e) { console.error('[CompressionTherapy] Approve error:', e); } finally { setSaving(false); }
  }, [safeId]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
     Copy All passes pdfData's committed values. Sentence fields split by sentence then comma (>=3, sub-label
     only on a genuine >=3 split); array items likewise; sentinel-0 numbers hidden. '' when empty. */
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const emitList = (arr) => {
      let n = 0;
      arr.forEach(item => {
        const p = parseLabel(String(item));
        const content = p ? p.content : String(item).replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        if (c.length >= 3) { if (p) { lines.push(p.label, COPY_LINE_DASH); n = 0; } c.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`)); }
        else lines.push(`${++n}. ${String(item).replace(/[;.]+$/, '').trim()}`);
      });
    };
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = safeArray(valueOf(f)).filter(x => hasVal(x));
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitList(arr);
        lines.push('');
      } else if (SENTENCE_FIELDS.includes(f)) {
        const val = valueOf(f); if (!hasFieldVal(f, val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitList(splitBySentence(fmtVal(val)));
        lines.push('');
      } else {
        const val = valueOf(f); if (!hasFieldVal(f, val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [hasVal, hasFieldVal, fmtVal, splitBySentence, safeArray]);

  const copyAllText = useCallback(async () => {
    let text = '=== COMPRESSION THERAPY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Compression Therapy ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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

  /* ---- renderEditableField — plain strings + enum dropdowns ---- */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const startEdit = () => { setSaveError(null); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(displayVal); };
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ---- renderNumberField — −/+ stepper (sentinel 0 hidden via hasFieldVal) ---- */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {numberStepper(() => handleSaveField(record, fn, idx))}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ---- renderBooleanField — Yes/No select ---- */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ---- shared editable text row (sentence / comma-part / array item) ---- */
  const renderTextRow = (value, keyId, badge, onSave) => {
    const isEditing = editingField === keyId;
    return (
      <div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(keyId); setEditValue(String(value).replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
            </div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(String(value))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[keyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(value), keyId); }}>{copiedItems[keyId] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
      </div>
    );
  };

  /* ---- renderSentenceEditableField — labeled + unlabeled >=3 comma-split ---- */
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
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence);
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(rawContent);
            if (commaItems.length >= 3) {
              return (
                <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
                  {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  {commaItems.map((ci, ciIdx) => {
                    const commaKey = `${sentenceKey}-c${ciIdx}`;
                    return <React.Fragment key={ciIdx}>{renderTextRow(ci, commaKey, editedFields[commaKey], () => saveCommaItem(record, fn, idx, sid, sIdx, ciIdx))}</React.Fragment>;
                  })}
                </div>
              );
            }
            return <React.Fragment key={sIdx}>{renderTextRow(sentence, sentenceKey, badge, () => saveSentence(record, fn, idx, sid, sIdx))}</React.Fragment>;
          })}
        </div>
      </div>
    );
  };

  /* ---- renderArrayField — per-item editing; items with a >=3 comma list split into rows ---- */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const items = safeArray(getFieldValue(record, fn, idx)); if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, aIdx) => {
          const itemStr = String(item);
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          // Numeric array element (e.g. limbCircumferenceMeasurements) → −/+ stepper editor, saved as a NUMBER.
          if (typeof item === 'number') {
            const numKey = `${fn}-${idx}-a${aIdx}`; const numEditing = editingField === numKey; const numBadge = editedFields[numKey];
            return (
              <div key={aIdx}>
                <div className={`numbered-row ${numBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!numEditing) { setSaveError(null); setEditingField(numKey); setEditValue(itemStr); } }}>
                  {numEditing ? (
                    <div className="edit-field-container">
                      {numberStepper(() => saveArrayNumberItem(record, fn, idx, aIdx))}
                      <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayNumberItem(record, fn, idx, aIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                      {saveError && editingField === numKey && <div className="save-error">{saveError}</div>}
                    </div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[numKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, numKey); }}>{copiedItems[numKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {numBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          const parsed = parseLabel(itemStr);
          const content = parsed ? parsed.content : itemStr;
          const commaItems = splitByComma(content);
          if (commaItems.length >= 3) {
            return (
              <div key={aIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: aIdx > 0 ? 8 : 0 } : undefined}>
                {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                {commaItems.map((ci, ciIdx) => {
                  const commaKey = `${fn}-${idx}-a${aIdx}-c${ciIdx}`;
                  return <React.Fragment key={ciIdx}>{renderTextRow(ci, commaKey, editedFields[commaKey], () => saveArrayCommaItem(record, fn, idx, aIdx, ciIdx))}</React.Fragment>;
                })}
              </div>
            );
          }
          const arrKey = `${fn}-${idx}-a${aIdx}`;
          return <React.Fragment key={aIdx}>{renderTextRow(itemStr, arrKey, editedFields[arrKey], () => saveArrayItem(record, fn, idx, aIdx))}</React.Fragment>;
        })}
      </div>
    );
  };

  /* ---- renderMixedSection — dispatches each field to the right renderer ---- */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return safeArray(getFieldValue(record, f, idx)).length > 0; return hasFieldVal(f, getFieldValue(record, f, idx)); });
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) return (<div className="compression-therapy-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Compression Therapy</h2></div><div className="empty-state">No compression therapy records available</div></div>);

  return (
    <div className="compression-therapy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Compression Therapy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CompressionTherapyDocumentPDFTemplate document={pdfData} />} fileName="Compression_Therapy.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search compression therapy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}</div><h3 className="record-name">{highlightText(`Compression Therapy ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'garment-info')}
            {renderMixedSection(record, idx, 'vascular-assessment')}
            {renderMixedSection(record, idx, 'clinical-status')}
            {renderMixedSection(record, idx, 'measurements')}
            {renderMixedSection(record, idx, 'response')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompressionTherapyDocument;
