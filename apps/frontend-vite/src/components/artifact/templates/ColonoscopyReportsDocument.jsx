/**
 * ColonoscopyReportsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: colonoscopy_reports
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ColonoscopyReportsDocumentPDFTemplate from '../pdf-templates/ColonoscopyReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ColonoscopyReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKeyWithoutIdx]: { value, payload } } }
   editKeyWithoutIdx mirrors the localEdits editKey with the trailing "-<idx>" stripped; `payload`
   is the exact body the DB write needs (so Approve replays the same field/arrayIndex/subField). */
const DRAFT_KEY = 'colonoscopy_reportsPendingEdits';
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
  'procedure-details': 'Procedure Details',
  findings: 'Findings',
  techniques: 'Techniques',
  biopsies: 'Biopsies',
  'complications-scores': 'Complications & Scores',
  surveillance: 'Surveillance',
};

const FIELD_LABELS = {
  patientPreparation: 'Patient Preparation', bostonBowelPrepScale: 'Boston Bowel Prep Scale',
  scopeInsertionDepth: 'Scope Insertion Depth', cecalIntubationTime: 'Cecal Intubation Time',
  withdrawalTime: 'Withdrawal Time', cecalLandmarks: 'Cecal Landmarks', sedationUsed: 'Sedation Used',
  polypsIdentified: 'Polyps Identified', inflammatoryChanges: 'Inflammatory Changes',
  histopathologyResults: 'Histopathology Results', adenomaDetectionRate: 'Adenoma Detection Rate',
  polypectomyTechnique: 'Polypectomy Technique', parisClassification: 'Paris Classification',
  chromoendoscopyUsed: 'Chromoendoscopy Used',
  biopsiesTaken: 'Biopsies Taken',
  complicationsDuringProcedure: 'Complications', mayoScore: 'Mayo Score', cdaiScore: 'CDAI Score',
  diverticulosisPresent: 'Diverticulosis Present', vascularLesions: 'Vascular Lesions', tattoosPlaced: 'Tattoos Placed',
  nextSurveillanceInterval: 'Next Surveillance Interval',
};

const SECTION_FIELDS = {
  'procedure-details': ['scopeInsertionDepth', 'cecalIntubationTime', 'withdrawalTime', 'bostonBowelPrepScale', 'patientPreparation', 'sedationUsed', 'cecalLandmarks'],
  findings: ['polypsIdentified', 'inflammatoryChanges', 'histopathologyResults', 'adenomaDetectionRate'],
  techniques: ['polypectomyTechnique', 'parisClassification', 'chromoendoscopyUsed'],
  biopsies: ['biopsiesTaken'],
  'complications-scores': ['complicationsDuringProcedure', 'mayoScore', 'cdaiScore', 'diverticulosisPresent', 'vascularLesions', 'tattoosPlaced'],
  surveillance: ['nextSurveillanceInterval'],
};

const SENTENCE_FIELDS = ['nextSurveillanceInterval', 'patientPreparation', 'sedationUsed'];
const ARRAY_FIELDS = ['cecalLandmarks', 'histopathologyResults', 'inflammatoryChanges', 'complicationsDuringProcedure', 'polypectomyTechnique', 'parisClassification', 'vascularLesions', 'tattoosPlaced'];
const OBJECT_ARRAY_FIELDS = ['polypsIdentified', 'biopsiesTaken'];
const BOOLEAN_FIELDS = ['adenomaDetectionRate', 'diverticulosisPresent', 'chromoendoscopyUsed'];
const NUMBER_FIELDS = ['bostonBowelPrepScale', 'cecalIntubationTime', 'withdrawalTime', 'mayoScore', 'cdaiScore'];
// Numbers where a stored 0 is a "not recorded"/extraction-default sentinel (hide). Boston/cecal/withdrawal
// are procedure measurements; cdaiScore (Crohn's index) cannot realistically be 0 — a real 0 means unassessed.
// mayoScore is NOT here: Mayo 0 = endoscopic remission, a meaningful result.
const HIDE_ZERO_FIELDS = ['bostonBowelPrepScale', 'cecalIntubationTime', 'withdrawalTime', 'cdaiScore'];
// Ordered subfields per object-array field (drives per-subfield editable rows that preserve object shape).
const OBJECT_SUBFIELDS = {
  polypsIdentified: [{ key: 'size', label: 'Size' }, { key: 'location', label: 'Location' }, { key: 'morphology', label: 'Morphology' }, { key: 'pathology', label: 'Pathology' }],
  biopsiesTaken: [{ key: 'location', label: 'Location' }, { key: 'number', label: 'Number' }],
};
// Singular per-item labels for object-array mini-card subtitles (generic index subtitle — every subfield,
// including the identity field, then renders as its own labeled row → no primary-field double, memory 6a4746da).
const OBJECT_ITEM_LABEL = { polypsIdentified: 'Polyp', biopsiesTaken: 'Biopsy' };
// Numeric object subfields (get the −/+ stepper, kept numeric on save).
const OBJECT_NUMBER_SUBKEYS = { biopsiesTaken: ['number'] };

// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence, >=3 gate). Paren-aware; keeps Oxford ", and/or X"
// attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
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

const formatObjectItem = (item, fn) => {
  if (!item || typeof item !== 'object') return String(item || '');
  if (fn === 'polypsIdentified') return `Size: ${item.size || 'N/A'}, Location: ${item.location || 'N/A'}, Morphology: ${item.morphology || 'N/A'}`;
  if (fn === 'biopsiesTaken') return `Location: ${item.location || 'N/A'}, Number: ${item.number !== undefined ? item.number : 'N/A'}`;
  return JSON.stringify(item);
};

const ColonoscopyReportsDocument = ({ document: templateData }) => {
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
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.colonoscopy_reports) return Array.isArray(r.colonoscopy_reports) ? r.colonoscopy_reports : [r.colonoscopy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colonoscopy_reports) return Array.isArray(dd.colonoscopy_reports) ? dd.colonoscopy_reports : [dd.colonoscopy_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const { lk, value, marker } = entry;
        if (lk === undefined) return;
        const localKey = `${lk}-${idx}`;
        nLocal[localKey] = value;       // the value rendered in the JSX
        nPending[localKey] = true;      // keep it OUT of the PDF until approved
        // Re-apply the SAME edited/sentence marker the original save handler set.
        if (marker && marker.map === 'sentences') nSentences[`${marker.keyPart}-${idx}`] = marker.badge || 'edited';
        else if (marker && marker.map === 'fields') nFields[`${marker.keyPart}-${idx}`] = marker.badge || 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // Stage one DB-bound edit as a DRAFT: persist value + the exact DB payload to localStorage so a
  // Save survives refresh and Approve can replay it. draftKey is unique per editable item.
  // entry = { lk: localEditsKeyPart(no -idx), value: localEditsValue, payload: dbBody, marker: {map,keyPart,badge} }
  const stageDraft = useCallback((id, draftKey, entry) => {
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][draftKey] = entry;
    writeDrafts(store);
  }, []);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.map((item, i) => typeof item === 'object' ? formatObjectItem(item) : String(item)).join(', '); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  // Sentence field → outer sentences; each comma-split into part rows only when it yields >=3 (Rule #73), else kept whole.
  const sentenceCommaGroups = useCallback((text) => splitBySentence(text).map(s => { const p = splitByComma(s); return p.length >= 3 ? p : [s]; }), [splitBySentence]);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  // Field-aware presence: procedure-measurement numbers treat 0 as a "not recorded" sentinel.
  const fieldHasVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0')) return false; return hasVal(v); }, [hasVal]);
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
      if (fieldHasVal(f, val) && fmtVal(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, fieldHasVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    return fieldHasVal(fn, val) && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal, fieldHasVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Colonoscopy Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) { const val = record[f]; if (val && fmtVal(val).toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => {
    const m = { ...r };
    Object.keys(localEdits).forEach(k => {
      if (pendingEdits[k]) return; // pending drafts stay OUT of the PDF/Copy All until approved
      // Object-subfield edit key shape: "field.arrayIndex.subField-idx"
      const sub = k.match(/^(.+)\.(\d+)\.(.+)-(\d+)$/);
      if (sub && parseInt(sub[4]) === idx) {
        const [, field, arrIdxStr, subField] = sub;
        const arrIdx = parseInt(arrIdxStr);
        const arr = Array.isArray(m[field]) ? m[field].map(it => (it && typeof it === 'object' ? { ...it } : it)) : [];
        if (arr[arrIdx] && typeof arr[arrIdx] === 'object') { arr[arrIdx][subField] = localEdits[k]; m[field] = arr; }
        return;
      }
      const mt = k.match(/^(.+)-(\d+)$/);
      if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k];
    });
    return m;
  }), [filteredRecords, localEdits, pendingEdits]);

  // Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB / NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    let saveVal = trimmed;

    // Number: typed input → parseFloat/isNaN
    if (NUMBER_FIELDS.includes(fn)) {
      const n = parseFloat(trimmed);
      if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
      saveVal = n;
    } else if (BOOLEAN_FIELDS.includes(fn)) {
      // Boolean: Yes/No select → editValue is already 'true'/'false'
      saveVal = trimmed === 'true';
    }
    setSaveError('');
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const sids = Object.keys(SECTION_FIELDS); sids.forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn) && k === `${sid}-${idx}`) delete n[k]; }); }); return n; });
    stageDraft(id, fn, { lk: fn, value: saveVal, payload: { field: fn, value: saveVal }, marker: { map: 'fields', keyPart: fn } });
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const currentArr = [...(getFieldValue(record, fn, idx) || [])];
    currentArr[arrayIndex] = editValue;
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: 'edited' }));
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const sids = Object.keys(SECTION_FIELDS); sids.forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn) && k === `${sid}-${idx}`) delete n[k]; }); }); return n; });
    stageDraft(id, `${fn}-a${arrayIndex}`, { lk: fn, value: currentArr, payload: { field: fn, value: editValue, arrayIndex }, marker: { map: 'fields', keyPart: `${fn}-a${arrayIndex}` } });
  }, [editValue, safeId, getFieldValue, stageDraft]);

  // Per-subfield save that PRESERVES object shape (number subfields kept numeric).
  const handleSaveObjectSubField = useCallback((record, fn, idx, arrayIndex, subField, isNumber) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    let saveVal = trimmed;
    if (isNumber) { const n = parseFloat(trimmed); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveVal = n; }
    setSaveError('');
    const lk = `${fn}.${arrayIndex}.${subField}`;
    const localKey = `${lk}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [localKey]: 'edited' }));
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const sids = Object.keys(SECTION_FIELDS); sids.forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn) && k === `${sid}-${idx}`) delete n[k]; }); }); return n; });
    stageDraft(id, lk, { lk, value: saveVal, payload: { field: fn, value: saveVal, arrayIndex, subField }, marker: { map: 'fields', keyPart: lk } });
  }, [editValue, safeId, stageDraft]);

  // String item save for object-array fields whose items are plain strings (mixed-shape data).
  const handleSaveObjectArrayStringItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return; setSaveError('');
    const currentArr = (getFieldValue(record, fn, idx) || []).map(it => (it && typeof it === 'object' ? { ...it } : it));
    currentArr[arrayIndex] = editValue;
    const localKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [localKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-o${arrayIndex}`]: 'edited' }));
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const sids = Object.keys(SECTION_FIELDS); sids.forEach(sid => { if ((SECTION_FIELDS[sid] || []).includes(fn) && k === `${sid}-${idx}`) delete n[k]; }); }); return n; });
    stageDraft(id, `${fn}-o${arrayIndex}`, { lk: fn, value: currentArr, payload: { field: fn, value: editValue, arrayIndex }, marker: { map: 'fields', keyPart: `${fn}-o${arrayIndex}` } });
  }, [editValue, safeId, getFieldValue, stageDraft]);

  // Stage a single comma-part edit within a sentence group as a DRAFT. Rebuilds the full field text from the
  // grid (each group re-joined with ", ", groups re-joined by reconstructFullText). Empty edit deletes the part.
  function saveCommaPart(record, fn, idx, sid, si, ci) {
    const id = safeId(record); if (!id) return;
    const localKey = `${fn}-${idx}`;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const groups = sentenceCommaGroups(currentVal);
    if (!groups[si]) return;
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      groups[si].splice(ci, 1);
    } else {
      const newParts = splitByComma(editedVal);
      groups[si].splice(ci, 1, ...(newParts.length ? newParts : [editedVal]));
    }
    const rebuilt = groups.map(g => g.join(', ').trim()).filter(s => s);
    const fullText = reconstructFullText(rebuilt);
    setLocalEdits(prev => ({ ...prev, [localKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' }));
    setEditingField(null); setEditValue('');
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(id, `${fn}-s${si}-c${ci}`, { lk: fn, value: fullText, payload: { field: fn, value: fullText }, marker: { map: 'sentences', keyPart: `${fn}-s${si}-c${ci}` } });
  }

  // Edit keys start with the field name + "-" (flat/string-array/sentence) or "." (object subfield),
  // and encode the record idx as "-<idx>" once item/sentence suffixes (-a#/-o#/-s#) are stripped.
  const fieldKeyMatch = useCallback((k, f, idx) => {
    if (!k.startsWith(`${f}-`) && !k.startsWith(`${f}.`)) return false;
    const base = k.replace(/-s\d+-c\d+$/, '').replace(/-(?:a|o|s)\d+$/, '');
    return base.endsWith(`-${idx}`);
  }, []);
  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => fieldKeyMatch(k, f, idx)) || Object.keys(editedSentences).some(k => fieldKeyMatch(k, f, idx))); }, [editedFields, editedSentences, fieldKeyMatch]);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY path that writes to the DB),
  // then flag the section approved, clear pending so committed values flow into pdfData/PDF, and
  // drop the committed drafts from localStorage.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Replay each staged DB write for fields in this section (preserving field/arrayIndex/subField).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedDraftKeys = [];
      const committedLocalKeys = new Set();
      for (const [draftKey, entry] of Object.entries(recDrafts)) {
        if (!entry || typeof entry !== 'object' || !entry.payload) continue;
        if (!fields.includes(entry.payload.field)) continue;
        const resp = await secureApiClient.put(`/api/edit/colonoscopy_reports/${id}/edit`, entry.payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedDraftKeys.push(draftKey);
        if (entry.lk !== undefined) committedLocalKeys.add(`${entry.lk}-${idx}`);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/colonoscopy_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed values now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      if (committedDraftKeys.length > 0) {
        const s2 = readDrafts();
        if (s2[id]) { committedDraftKeys.forEach(k => delete s2[id][k]); if (Object.keys(s2[id]).length === 0) delete s2[id]; writeDrafts(s2); }
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (fieldKeyMatch(k, f, idx)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (fieldKeyMatch(k, f, idx)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, fieldKeyMatch]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
  // Copy All passes pdfData's committed values. Object arrays mirror the JSX mini-cards: a generic
  // "Polyp N"/"Biopsy N" subtitle then every present subfield as a labeled numbered row (no primary double).
  // Returns '' when the section has no present fields (Copy All empty-section guard).
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const val = valueOf(f);
      if (!fieldHasVal(f, val)) return;
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        (Array.isArray(val) ? val : [val]).forEach((item, i) => {
          if (!item || typeof item !== 'object') { lines.push(`${i + 1}. ${String(item)}`); return; }
          lines.push(`${OBJECT_ITEM_LABEL[f] || label} ${i + 1}`);
          (OBJECT_SUBFIELDS[f] || []).forEach(sf => {
            const sv = item[sf.key];
            if (sv === undefined || sv === null || String(sv).trim() === '') return;
            lines.push(sf.label, `1. ${sv}`);
          });
        });
        lines.push('');
      } else if (ARRAY_FIELDS.includes(f)) {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        (Array.isArray(val) ? val : [val]).forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`));
        lines.push('');
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        sentenceCommaGroups(fmtVal(val)).flat().forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        lines.push('');
      } else {
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [fieldHasVal, fmtVal, sentenceCommaGroups]);

  const copyAllText = useCallback(async () => {
    let text = '=== COLONOSCOPY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Colonoscopy Report ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      if (r.date) text += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopy, formatDate]);

  /* ---- Render helpers ---- */

  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so row-click
  // doesn't re-open/close the editor. onSave is the field- or subfield-specific commit.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(''); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isBool = BOOLEAN_FIELDS.includes(fn);
    const isNumber = NUMBER_FIELDS.includes(fn);
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(editKey); setEditValue(isBool ? String(val) : (isNumber ? String(val) : displayVal)); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : isNumber ? (
                numberStepper(() => handleSaveField(record, fn, idx))
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <span className="content-value">{highlightText(displayVal)}</span>
                <span className="edit-indicator">✎</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || '');
    if (!val.trim()) return null;
    // Outer = sentences; inner = comma parts when a sentence yields >=3 (else the whole sentence). Each part
    // is its own editable row keyed (si,ci); saveCommaPart splices that part and rebuilds the full text.
    const groups = sentenceCommaGroups(val);
    if (groups.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {groups.map((parts, sIdx) => parts.map((part, cIdx) => {
            const partKey = `${fn}-${idx}-s${sIdx}-c${cIdx}`;
            const isEditing = editingField === partKey;
            const badge = editedSentences[partKey];
            const partMatches = phraseMatch || labelMatch || (searchTerm.trim() && part.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!partMatches && searchTerm.trim()) return null;
            return (
              <div key={`${sIdx}-${cIdx}`}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(partKey); setEditValue(part.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaPart(record, fn, idx, sid, sIdx, cIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(part)}</span>
                        <span className="edit-indicator">✎</span>
                      </div>
                      <button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          }))}
        </div>
      </div>
    );
  };

  const renderArrayField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, ai) => {
          const itemStr = String(item);
          const arrayKey = `${fn}-${idx}-a${ai}`;
          const isEditing = editingField === arrayKey;
          const badge = editedFields[arrayKey];
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrayKey); setEditValue(itemStr); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      <span className="content-value">{highlightText(itemStr)}</span>
                      <span className="edit-indicator">✎</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[arrayKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrayKey); }}>{copiedItems[arrayKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderObjectArrayField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();
    const subDefs = OBJECT_SUBFIELDS[fn] || [];
    const numberSubKeys = fn === 'biopsiesTaken' ? ['number'] : [];
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, oi) => {
          // Plain-string item (mixed-shape data): single editable string row preserving array slot.
          if (!item || typeof item !== 'object') {
            const itemStr = String(item);
            const objKey = `${fn}-${idx}-o${oi}`;
            const isEditing = editingField === objKey;
            const badge = editedFields[objKey];
            const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(phrase);
            if (!itemMatches) return null;
            return (
              <div key={oi}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(objKey); setEditValue(itemStr); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectArrayStringItem(record, fn, idx, oi); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[objKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, objKey); }}>{copiedItems[objKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          // Object item: generic index subtitle ("Polyp 1") + every present subfield as its own labeled row.
          // The identity value (location/size) is NOT baked into the subtitle → it renders once, as its own
          // row, never doubled (memory 6a4746da).
          const visibleSubs = subDefs.filter(sf => {
            const sfVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
            return sfVal !== undefined && sfVal !== null && String(sfVal).trim() !== '';
          });
          if (visibleSubs.length === 0) return null;
          // Search filter at item level
          if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !labelMatch) {
            const anyMatch = visibleSubs.some(sf => String(localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key]).toLowerCase().includes(phrase));
            if (!anyMatch) return null;
          }
          return (
            <div key={oi} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(`${OBJECT_ITEM_LABEL[fn] || label.replace(/s$/, '')} ${oi + 1}`)}</div>
              {visibleSubs.map(sf => {
                const sfVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
                const sfEditKey = `${fn}.${oi}.${sf.key}-${idx}`;
                const isEditing = editingField === sfEditKey;
                const badge = editedFields[sfEditKey];
                const isNum = numberSubKeys.includes(sf.key);
                return (
                  <div key={sf.key}>
                    <div className="nested-subtitle" style={{ fontSize: 14, marginTop: 4, borderBottom: 'none', paddingBottom: 0 }}>{sf.label}</div>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(''); setEditingField(sfEditKey); setEditValue(String(sfVal)); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {isNum ? (
                            numberStepper(() => handleSaveObjectSubField(record, fn, idx, oi, sf.key, true))
                          ) : (
                            <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(''); setEditingField(null); setEditValue(''); } }} />
                          )}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectSubField(record, fn, idx, oi, sf.key, isNum); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(''); setEditingField(null); setEditValue(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(sfVal))}</span><span className="edit-indicator">✎</span></div>
                          <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${sfVal}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
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

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => fieldHasVal(f, getFieldValue(record, f, idx)));
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
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) return (<div className="colonoscopy-reports" ref={containerRef}><div className="document-header"><h2 className="document-title">Colonoscopy Reports</h2></div><div className="empty-state">No colonoscopy report records available</div></div>);

  return (
    <div className="colonoscopy-reports" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Colonoscopy Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ColonoscopyReportsDocumentPDFTemplate document={pdfData} />} fileName="Colonoscopy_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search colonoscopy reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Colonoscopy Report ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'procedure-details')}
            {renderMixedSection(record, idx, 'findings')}
            {renderMixedSection(record, idx, 'techniques')}
            {renderMixedSection(record, idx, 'biopsies')}
            {renderMixedSection(record, idx, 'complications-scores')}
            {renderMixedSection(record, idx, 'surveillance')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColonoscopyReportsDocument;
