/**
 * DeepBrainStimulationDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: deep_brain_stimulation
 *
 * 5 Sections:
 *   1. dbs-info: date (date), provider, facility, status
 *   2. stimulation-details: target, laterality, implantDate (string), programmingSettings (object, recursive)
 *   3. clinical-response: response (sentence), complications (array)
 *   4. findings-results: findings (sentence), results (object, recursive)
 *   5. assessment-plan: assessment (sentence + parseLabel + comma-split), plan (sentence), recommendations (object-array), notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DeepBrainStimulationDocumentPDFTemplate from '../pdf-templates/DeepBrainStimulationDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './DeepBrainStimulationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value = the FULL field value: string/array/object) */
const DRAFT_KEY = 'deep_brain_stimulationPendingEdits';
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
  'dbs-info': 'DBS Information',
  'stimulation-details': 'Stimulation Details',
  'clinical-response': 'Clinical Response',
  'findings-results': 'Findings & Results',
  'assessment-plan': 'Assessment & Plan',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  target: 'Target',
  laterality: 'Laterality',
  implantDate: 'Implant Date',
  programmingSettings: 'Programming Settings',
  response: 'Response',
  complications: 'Complications',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'dbs-info': ['date', 'type', 'provider', 'facility', 'status'],
  'stimulation-details': ['target', 'laterality', 'implantDate', 'programmingSettings'],
  'clinical-response': ['response', 'complications'],
  'findings-results': ['findings', 'results'],
  'assessment-plan': ['assessment', 'plan', 'recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['response', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['results'];

/* parseLabel: detect "Label: value" patterns — medical regex */
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

const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

/* ═══════ OBJECT-FIELD HELPERS (recursive results renderer) ═══════ */
const KEY_OVERRIDES = {
  ef: 'EF', lvef: 'LVEF', bpm: 'BPM', stn: 'STN', gpi: 'GPi', vim: 'VIM',
  rightSide: 'Right Side', leftSide: 'Left Side', lastAdjustment: 'Last Adjustment',
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* number+unit leaf splitter — returns null for plain text and "4/5" ratios */
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

/* ═══════ COMPONENT ═══════ */
const DeepBrainStimulationDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${field}-${idx}`) staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.deep_brain_stimulation) return Array.isArray(r.deep_brain_stimulation) ? r.deep_brain_stimulation : [r.deep_brain_stimulation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.deep_brain_stimulation) return Array.isArray(dd.deep_brain_stimulation) ? dd.deep_brain_stimulation : [dd.deep_brain_stimulation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const safeIdLocal = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeIdLocal(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Restore an "edited" marker so the row shows modified + the Approve button appears.
        // SENTENCE_FIELDS / recommendations use editedSentences; everything else uses editedFields.
        if (SENTENCE_FIELDS.includes(fieldName) || fieldName === 'recommendations') {
          nSentences[`${fieldName}-${idx}-s0`] = 'edited';
        } else {
          nFields[editKey] = 'edited';
        }
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
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const formatDateInput = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
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

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
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
      const rt = `Deep Brain Stimulation ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const sFields of Object.values(SECTION_FIELDS)) {
        for (const f of sFields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined) {
            if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
            else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft: persist a field's FULL value into the localStorage draft store (NOT MongoDB).
     The whole field value lives under store[recordId][fieldName] — array/object/string alike. */
  const stageDraft = useCallback((record, fieldName, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldName] = value;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(record, fn, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const currentArr = [...(getEffectiveArray(record, fn, idx))];
    currentArr[arrayIndex] = editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: 'edited' }));
    stageDraft(record, fn, currentArr);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.foo) — value stays a STRING/number/bool.
     Staged locally (the FULL root object is kept in localEdits/draft store); committed on Approve. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${rootField}-${idx}`;
    let clone;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [editKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Recompute the full root object (same mutation) for the draft store so it survives refresh.
    const base = localEdits[editKey] !== undefined ? localEdits[editKey] : record[rootField];
    const draftClone = JSON.parse(JSON.stringify(base ?? {}));
    let dn = draftClone;
    for (let i = 0; i < path.length - 1; i++) dn = dn[path[i]];
    dn[path[path.length - 1]] = newVal;
    stageDraft(record, rootField, draftClone);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stageDraft(record, fn, fullText);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveCommaItem(record, fn, idx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    items[commaIdx] = newItemText.trim();
    const fullText = items.join(', ');
    const editKey = `${fn}-${idx}`;
    const commaKey = `${fn}-${idx}-c${commaIdx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveCommaItemInSentence(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const editKey = `${fn}-${idx}`;
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    stageDraft(record, fn, fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this record's pending field-level edits that belong to this section.
      // localEdits keys are always `${field}-${idx}` and hold the FULL field value
      // (string / array / object), so each commits as a single field PUT (no arrayIndex).
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(editKey => pendingEdits[editKey] && localEdits[editKey] !== undefined);
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, editKey.length - `-${idx}`.length);
        const resp = await secureApiClient.put(`/api/edit/deep_brain_stimulation/${id}/edit`, { field: fn, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/deep_brain_stimulation/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DeepBrainStimulation] Approve error:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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
  const objectCopyLines = useCallback((label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  }, []);

  const recommendationsCopyLines = useCallback((arr) => {
    const recs = Array.isArray(arr) ? arr : [];
    const out = []; let n = 1; let lastDate = null;
    recs.forEach(rec => {
      if (isEmptyDeep(rec)) return;
      const text = (rec?.recommendation || '').trim();
      const d = (rec?.date || '').trim();
      if (!text) return;
      if (d && d !== lastDate) { out.push(d + ':'); lastDate = d; }
      out.push(`${n++}. ${text}`);
    });
    return out;
  }, []);

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
        } else { lines.push(`${n++}. ${s}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const COPY_LINE_EQ = '='.repeat(40);
  const COPY_LINE_DASH = '-'.repeat(40);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const showLabelCopy = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
      const singleName = !showLabelCopy;

      if (DATE_FIELDS.includes(f)) {
        if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
        text += `${formatDate(val)}\n\n`;
      } else if (f === 'complications') {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
        items.forEach((item, i) => { text += `${i + 1}. ${stripDelims ? stripDelims(item) : item}\n`; });
        text += '\n';
      } else if (f === 'programmingSettings' || f === 'results') {
        if (typeof val === 'object' && Object.keys(val).length > 0) {
          if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
          objectCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
          text += '\n';
        }
      } else if (f === 'recommendations') {
        const lines = recommendationsCopyLines(val);
        if (lines.length > 0) { 
          if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
          lines.forEach(l => { text += `${l}\n`; }); text += '\n'; 
        }
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        if (!singleName) { text += `${label}\n${COPY_LINE_DASH}\n`; }
        text += `1. ${stripDelims ? stripDelims(fmtVal(val)) : fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatDate, formatSentenceFieldLines, objectCopyLines, recommendationsCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== DEEP BRAIN STIMULATION ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Deep Brain Stimulation ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const fields = SECTION_FIELDS[sid];
        const hasAny = fields.some(f => {
          const val = r[f];
          return hasVal(val);
        });
        if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${COPY_LINE_DASH}\n`;
        fields.forEach(f => {
          const label = FIELD_LABELS[f] || f;
          const val = r[f];
          if (!hasVal(val)) return;
          if (DATE_FIELDS.includes(f)) { text += `${label}\n${formatDate(val)}\n\n`; }
          else if (f === 'complications') {
            const items = Array.isArray(val) ? val.filter(Boolean) : [];
            if (items.length > 0) { text += `${label}\n${COPY_LINE_DASH}\n`; items.forEach((item, i) => { text += `${i + 1}. ${stripDelims(item)}\n`; }); text += '\n'; }
          }
          else if (f === 'programmingSettings' || f === 'results') {
            if (typeof val === 'object' && Object.keys(val).length > 0) {
              text += `${label}\n${COPY_LINE_DASH}\n`;
              objectCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
              text += '\n';
            }
          }
          else if (f === 'recommendations') {
            const lines = recommendationsCopyLines(val);
            if (lines.length > 0) { text += `${label}\n${COPY_LINE_DASH}\n`; lines.forEach(l => { text += `${l}\n`; }); text += '\n'; }
          }
          else if (SENTENCE_FIELDS.includes(f)) {
            text += `${label}\n${COPY_LINE_DASH}\n`;
            formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
            text += '\n';
          }
          else { text += `${label}\n${COPY_LINE_DASH}\n1. ${stripDelims(fmtVal(val))}\n\n`; }
        });
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, formatSentenceFieldLines, objectCopyLines, recommendationsCopyLines]);

  /* ═══════ RENDER: DATE FIELD (BlueDatePicker per checklist - no native) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(formatDateInput(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
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

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
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

  /* ═══════ RENDER: PROGRAMMING SETTINGS (object, skip if empty) ═══════ */
  const renderProgrammingSettings = (record, idx, sid) => {
    const val = getFieldValue(record, 'programmingSettings', idx);
    if (!val || typeof val !== 'object' || Object.keys(val).length === 0) return null;
    const label = FIELD_LABELS.programmingSettings;
    if (searchTerm.trim() && !sectionTitleMatches(sid) && !contentMatches(label)) return null;

    return (
      <div key="programmingSettings" className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {Object.entries(val).map(([k, v]) => {
          const dotPath = `programmingSettings.${k}`;
          const editKey = `${dotPath}-${idx}`;
          const isEditing = editingField === editKey;
          const badge = editedFields[editKey];
          const displayVal = fmtVal(v);
          return (
            <div key={k} className="nested-mini-card">
              <div className="nested-subtitle sub-label">{highlightText(k)}</div>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, 'programmingSettings', idx, sid, null, { ...val, [k]: editValue }, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${k}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (complications) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, ai) => {
          const itemKey = `${fn}-${idx}-a${ai}`;
          const isEditing = editingField === itemKey;
          const badge = editedFields[itemKey];
          const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim() && !record._showAllSections) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(String(item)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, "4/5" stays text, bool -> select) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) - s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); }}>-</button>
                  <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(null); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); /* save */ } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); }}>+</button>
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) {
                    newVal = editValue === 'yes';
                  } else if (ratio) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = `${n}/${ratio.denom}`;
                  } else if (nu) {
                    const n = parseFloat(editValue);
                    if (isNaN(n)) { setSaveError('Please enter a valid number'); return; }
                    newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n);
                  } else {
                    newVal = editValue.trim();
                  }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

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
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
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
                              // Stage as a DRAFT (no DB write). Approve commits the full array.
                              const editKey = `${fn}-${idx}`;
                              setLocalEdits(prev => ({ ...prev, [editKey]: newArr }));
                              setPendingEdits(prev => ({ ...prev, [editKey]: true }));
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                              stageDraft(record, fn, newArr);
                              setEditingField(null); setEditValue(''); setSaveError(null);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">✎</span></div>
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

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            /* parseLabel for Label: value patterns */
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const textToSplit = parsed.value;
              const commaItems = splitByComma(textToSplit);
              if (commaItems.length >= 2) {
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      const ciMatches = phraseMatch || labelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                      if (!ciMatches && searchTerm.trim()) return null;
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItemInSentence(record, fn, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
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
            }

            /* Regular sentence row */
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const reconstructed = `${parsed.label}: ${editValue.trim()}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const editKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey]: fullText })); setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' })); stageDraft(record, fn, fullText); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div>
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
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (f === 'complications') return getEffectiveArray(record, f, idx).length > 0;
      if (f === 'recommendations') { const v = getFieldValue(record, f, idx); return Array.isArray(v) && v.some(r => !isEmptyDeep(r)); }
      if (f === 'programmingSettings' || OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f, idx); return v && typeof v === 'object' && !isEmptyDeep(v); }
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (f === 'complications') return renderArrayField(record, f, idx, sid);
            if (f === 'recommendations') return renderRecommendationsField(record, f, idx, sid);
            if (f === 'programmingSettings') return renderProgrammingSettings(record, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="deep-brain-stimulation-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Deep Brain Stimulation</h2></div>
        <div className="empty-state">No deep brain stimulation records available</div>
      </div>
    );
  }

  return (
    <div className="deep-brain-stimulation-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Deep Brain Stimulation</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DeepBrainStimulationDocumentPDFTemplate document={pdfData} />} fileName={`deep-brain-stimulation-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search deep brain stimulation..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Deep Brain Stimulation ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'dbs-info')}
            {renderSection(record, idx, 'stimulation-details')}
            {renderSection(record, idx, 'clinical-response')}
            {renderSection(record, idx, 'findings-results')}
            {renderSection(record, idx, 'assessment-plan')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeepBrainStimulationDocument;
