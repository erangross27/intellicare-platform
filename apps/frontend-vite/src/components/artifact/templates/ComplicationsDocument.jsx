/**
 * ComplicationsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: complications
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ComplicationsDocumentPDFTemplate from '../pdf-templates/ComplicationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './ComplicationsDocument.css';

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'clinical-notes': 'Clinical Notes',
  'complications-data': 'Complications Data',
  'results': 'Results',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', type: 'Type', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  intraoperative: 'Intraoperative', immediate: 'Immediate', management: 'Management', recommendations: 'Recommendations',
  results: 'Results',
};

const SECTION_FIELDS = {
  'provider-info': ['date', 'provider', 'facility', 'type', 'status'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'complications-data': ['intraoperative', 'immediate', 'management', 'recommendations'],
  'results': ['results'],
};

const OBJECT_FIELDS = ['results'];

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const ARRAY_FIELDS = ['intraoperative', 'immediate', 'management', 'recommendations'];
const DATE_FIELDS = ['date'];
// Fixed-choice fields → dropdown (keep an unmatched current value as an extra option so nothing is lost).
const ENUM_FIELDS = { status: ['none', 'resolved', 'ongoing', 'completed'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group / key label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
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

/* ═══════ OBJECT-FIELD HELPERS (for `results` recursive renderer) ═══════ */
const KEY_OVERRIDES = { ekg: 'EKG', ecg: 'ECG', wbc: 'WBC', rbc: 'RBC', bun: 'BUN', inr: 'INR', ct: 'CT', mri: 'MRI', xray: 'X-Ray', hr: 'HR', bp: 'BP' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isScalar = (v) => v === null || typeof v !== 'object';
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const objectCopyLines = (label, value, indent) => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (label) out.push(`${pad}${label}:`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/);
  return m ? { label: m[1].trim(), content: m[2].trim() } : null;
};
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field name, e.g. "findings" / "results") */
const DRAFT_KEY = 'complicationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ComplicationsDocument = ({ document: docProp }) => {
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

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.complications) return Array.isArray(r.complications) ? r.complications : [r.complications];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.complications) return Array.isArray(dd.complications) ? dd.complications : [dd.complications]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recordId(record);
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
  }, [records, recordId]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; const val = record[fn]; return Array.isArray(val) ? val : []; }, [localEdits]);
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
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (OBJECT_FIELDS.includes(f) && typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
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
      if (OBJECT_FIELDS.includes(fn) && typeof val === 'object') return flattenSearchable(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Complications ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (OBJECT_FIELDS.includes(f) && val && typeof val === 'object') { if (flattenSearchable(val).toLowerCase().includes(phrase)) return true; }
        else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => {
    const m = { ...r };
    Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; });
    // Arrays: use the staged edit only when it is NOT a pending draft; otherwise fall back to original.
    ARRAY_FIELDS.forEach(field => { const k = `${field}-${idx}`; m[field] = pendingEdits[k] ? (Array.isArray(r[field]) ? r[field] : []) : getEffectiveArray(r, field, idx); });
    return m;
  }), [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  /* --- Field type validation --- */
  const getOriginalType = useCallback((record, fn) => {
    const orig = record[fn];
    if (orig === null || orig === undefined) return 'string';
    if (typeof orig === 'boolean') return 'boolean';
    if (typeof orig === 'number') return 'number';
    if (orig instanceof Date || (typeof orig === 'string' && /^\d{4}-\d{2}-\d{2}/.test(orig) && fn === 'date')) return 'date';
    return 'string';
  }, []);

  const validateFieldValue = useCallback((val, origType) => {
    if (origType === 'number') { if (isNaN(Number(val))) return 'Please enter a valid number'; return null; }
    if (origType === 'boolean') { const lower = val.toLowerCase().trim(); if (!['yes', 'no', 'true', 'false'].includes(lower)) return 'Please enter Yes or No'; return null; }
    if (origType === 'date') { const d = new Date(val); if (isNaN(d.getTime())) return 'Please enter a valid date'; return null; }
    return null;
  }, []);

  const convertFieldValue = useCallback((val, origType) => {
    if (origType === 'number') return Number(val);
    if (origType === 'boolean') { const lower = val.toLowerCase().trim(); return lower === 'yes' || lower === 'true'; }
    if (origType === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(val).trim()) ? `${String(val).trim()}T00:00:00.000Z` : val;
    return val;
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fn, idx, sectionId, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending Approve
    if (sectionId) setApprovedSections(prev => { const k = `${sectionId}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const origType = getOriginalType(record, fn);
    if (valueOverride === undefined) {
      const error = validateFieldValue(saveVal, origType);
      if (error) { setSaveError(error); return; }
    }
    const finalVal = valueOverride !== undefined ? saveVal : convertFieldValue(saveVal, origType);
    setSaveError(null);
    stageDraft(record, fn, idx, sectionId, finalVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getOriginalType, validateFieldValue, convertFieldValue, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sectionId, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentValue = String(getFieldValue(record, fn, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const sentence = currentSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    const content = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    items[commaIdx] = newItemText.trim();
    const filteredItems = items.map(p => p.trim()).filter(Boolean);
    if (filteredItems.length > 0) { currentSentences[sIdx] = parsed ? `${parsed.label}: ${filteredItems.join(', ')}` : filteredItems.join(', '); }
    else { currentSentences.splice(sIdx, 1); }
    const fullText = reconstructFullText(currentSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setSaveError(null);
    stageDraft(record, fn, idx, sectionId, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  const saveArrayItem = useCallback((record, fn, idx, arrIdx) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const currentArr = [...getEffectiveArray(record, fn, idx)];
    currentArr[arrIdx] = editValue.trim();
    // ARRAY_FIELDS all live in the 'complications-data' section
    stageDraft(record, fn, idx, 'complications-data', currentArr);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${arrIdx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  /* Save a nested OBJECT leaf by dot-path (e.g. results.wbc) — value stays a STRING */
  const saveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    // Build the updated whole-object value (kept as a STRING leaf), then stage it as a DRAFT.
    const editKey = `${rootField}-${idx}`;
    const cur = localEdits[editKey] !== undefined ? localEdits[editKey] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] === undefined || node[path[i]] === null) node[path[i]] = {}; node = node[path[i]]; }
    node[path[path.length - 1]] = newVal;
    // OBJECT_FIELDS (e.g. results) live in the 'results' section
    stageDraft(record, rootField, idx, 'results', clone);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [safeId, localEdits, stageDraft]);

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Collect this record's pending edits for this section (editKey convention: `${fn}-${idx}`)
    const suffix = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      return fields.includes(fieldPart);
    });
    try {
      // Persist each staged field to the DB now. fieldPart has no embedded numeric arrayIndex here
      // (arrays/objects are stored whole), so we add arrayIndex ONLY if the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        const resp = await secureApiClient.put(`/api/edit/complications/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/complications/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); delete store[id][fieldPart]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[Complications] Approve error:', err); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
  // Copy All passes pdfData's committed values. Sentence fields split by sentence then comma (>=3), labeled
  // groups restart numbering; object (results) walks key→value as sub-label + DASH + numbered row.
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const objectBlock = (obj) => Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      if (isScalar(v)) lines.push(humanizeKey(k), COPY_LINE_DASH, `1. ${fmtScalar(v)}`, '');
      else { lines.push(humanizeKey(k), COPY_LINE_DASH); objectBlock(v); }
    });
    const emitSentence = (text) => {
      let n = 0;
      splitBySentence(text).forEach(s => {
        const p = parseLabel(s);
        const content = p ? p.content : s.replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        const parts = c.length >= 3 ? c : [content];
        if (p) { lines.push(p.label, COPY_LINE_DASH); n = 0; }
        parts.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`));
      });
    };
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const val = valueOf(f);
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (OBJECT_FIELDS.includes(f)) {
        if (isEmptyDeep(val) || isScalar(val)) return;
        objectBlock(val);
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        arr.forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`));
        lines.push('');
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitSentence(fmtVal(val));
        lines.push('');
      } else if (DATE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${formatDate(val)}`, '');
      } else {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [hasVal, fmtVal, formatDate, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== COMPLICATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Complications ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  /* --- Render: simple editable field --- */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDate = DATE_FIELDS.includes(fn);
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isDate ? formatDate(val) : fmtVal(val); const isModified = editedFields[editKey];
    const startEdit = () => { setSaveError(null); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(isDate ? toInputDate(val) : displayVal); };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => { setSaveError(null); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
              ) : isDate ? (
                <BlueDatePicker value={editValue} onSelect={(iso) => { setSaveError(null); setEditValue(iso); }} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* --- Render: sentence editable field (with parseLabel + comma-split) --- */
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
            const parsed = parseLabel(sentence);
            // Guarded comma-split (paren/Oxford aware); comma rows only for a genuine list (>=3, Rule #73).
            // Labeled → sub-label + rows; unlabeled >=3 → rows (no sub-label). saveCommaItem handles both.
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(rawContent);
            if (commaItems.length >= 3) {
                return (
                  <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
                    {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                                {saveError && editingField === commaKey && <div className="save-error">{saveError}</div>}
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
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
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                      {saveError && editingField === sentenceKey && <div className="save-error">{saveError}</div>}
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? `added - click Pending Approve to save` : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* --- Render: array editable field --- */
  const renderArrayEditableField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {arr.map((item, arrIdx) => {
            const arrKey = `${fn}-${idx}-${arrIdx}`;
            const isEditing = editingField === arrKey;
            const isModified = editedFields[arrKey];
            const itemStr = String(item);
            const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches) return null;
            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, arrIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                      {saveError && editingField === arrKey && <div className="save-error">{saveError}</div>}
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* --- Render: editable OBJECT leaf (scalar) by dot-path --- */
  const renderObjectLeaf = (record, rootField, path, idx, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    return (
      <div key={path[path.length - 1]} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(leafValueString); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(record, rootField, path, idx, leafKey, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
              {saveError && editingField === leafKey && <div className="save-error">{saveError}</div>}
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leafValueString, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* --- Render: recursively render an OBJECT node --- */
  const renderObjectNode = (record, rootField, idx, label, value, path) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, rootField, [...path, k], idx, v)
            : <div className="rec-mini-card" key={k}>{renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k])}</div>
        ))}
      </React.Fragment>
    );
  };

  /* --- Render: object section (e.g. `results`) --- */
  const renderObjectSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fn = (SECTION_FIELDS[sid] || [])[0];
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
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
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, fn, [k], idx, v)
              : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fn, idx, humanizeKey(k), v, [k])}</div>
          ))}
        </div>
      </div>
    );
  };

  /* --- Render: mixed section --- */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    });
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayEditableField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) return (<div className="complications" ref={containerRef}><div className="document-header"><h2 className="document-title">Complications</h2></div><div className="empty-state">No complications records available</div></div>);

  return (
    <div className="complications" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Complications</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ComplicationsDocumentPDFTemplate document={pdfData} />} fileName="Complications.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search complications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div><h3 className="record-name">{highlightText(`Complications ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'provider-info')}
            {renderMixedSection(record, idx, 'clinical-notes')}
            {renderMixedSection(record, idx, 'complications-data')}
            {renderObjectSection(record, idx, 'results')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComplicationsDocument;
