/**
 * RadiationTherapyRecordsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: radiation_therapy_records
 *
 * 5 Sections:
 *   1. treatment-info: startDate, endDate, site
 *   2. dose-info: totalDose, fractions, technique
 *   3. treatment-planning: planning.fractionDose, planning.schedule, planning.target
 *   4. side-effects: sideEffects
 *   5. treatment-response: response
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RadiationTherapyRecordsDocumentPDFTemplate from '../pdf-templates/RadiationTherapyRecordsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './RadiationTherapyRecordsDocument.css';

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (value) => {
  const decimals = String(value ?? '').split('.')[1];
  return decimals ? `0.${'0'.repeat(Math.max(0, decimals.length - 1))}1` : '1';
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (fieldName may be a dotted nested path) */
const DRAFT_KEY = 'radiation_therapy_recordsPendingEdits';
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
  'treatment-info': 'Treatment Information',
  'dose-info': 'Dose Information',
  'treatment-planning': 'Treatment Planning',
  'side-effects': 'Side Effects',
  'treatment-response': 'Treatment Response',
};

const FIELD_LABELS = {
  startDate: 'Start Date',
  endDate: 'End Date',
  site: 'Treatment Site',
  totalDose: 'Total Dose',
  fractions: 'Fractions',
  technique: 'Technique',
  'planning.fractionDose': 'Fraction Dose',
  'planning.schedule': 'Schedule',
  'planning.target': 'Target',
  sideEffects: 'Side Effects',
  response: 'Treatment Response',
};

const SECTION_FIELDS = {
  'treatment-info': ['startDate', 'endDate', 'site'],
  'dose-info': ['totalDose', 'fractions', 'technique'],
  'treatment-planning': ['planning.fractionDose', 'planning.schedule', 'planning.target'],
  'side-effects': ['sideEffects'],
  'treatment-response': ['response'],
};

const DATE_FIELDS = ['startDate', 'endDate'];
const NUMBER_FIELDS = ['fractions'];
const ARRAY_FIELDS = ['sideEffects'];
const STRING_FIELDS = ['site', 'totalDose', 'technique', 'planning.fractionDose', 'planning.schedule', 'planning.target', 'response'];
const MEASUREMENT_FIELDS = ['totalDose', 'planning.fractionDose'];

const splitNumberUnit = (value) => {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!match || !/\d/.test(match[1])) return null;
  return { number: match[1].replace(/,/g, ''), separator: match[2] || ' ', unit: (match[3] || '').trim() };
};

const setValueAtPath = (source, dottedPath, value) => {
  const path = String(dottedPath).split('.').filter(Boolean);
  if (path.length === 0) return source;
  const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor = root;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      cursor[part] = value;
      return;
    }
    const nextPart = path[index + 1];
    const current = cursor[part];
    cursor[part] = Array.isArray(current)
      ? [...current]
      : (current && typeof current === 'object')
        ? { ...current }
        : /^\d+$/.test(nextPart) ? [] : {};
    cursor = cursor[part];
  });
  return root;
};

const valueAtPath = (source, dottedPath) => String(dottedPath).split('.').reduce((value, part) => value?.[part], source);

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

/* ═══════ COMPONENT ═══════ */
const RadiationTherapyRecordsDocument = ({ document: docProp }) => {
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
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.radiation_therapy_records) return Array.isArray(r.radiation_therapy_records) ? r.radiation_therapy_records : [r.radiation_therapy_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiation_therapy_records) return Array.isArray(dd.radiation_therapy_records) ? dd.radiation_therapy_records : [dd.radiation_therapy_records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (record && record._id) ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        nLocal[`${fieldName}-${idx}`] = value;
        nPending[`${fieldName}-${idx}`] = true;
        nFields[`${fieldName}-${idx}`] = 'edited';
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
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const getMergedRecord = useCallback((record, idx, includePending = true) => {
    let merged = Array.isArray(record) ? [...record] : { ...record };
    const suffix = `-${idx}`;
    Object.entries(localEdits).forEach(([key, value]) => {
      if (!key.endsWith(suffix)) return;
      if (!includePending && pendingEdits[key]) return;
      merged = setValueAtPath(merged, key.slice(0, -suffix.length), value);
    });
    return merged;
  }, [localEdits, pendingEdits]);

  /* getFieldValue: supports arbitrary-depth dot paths and pending array-item drafts. */
  const getFieldValue = useCallback((record, fn, idx) => {
    const value = valueAtPath(getMergedRecord(record, idx), fn);
    return value === undefined || value === null ? '' : value;
  }, [getMergedRecord]);

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
      const rt = `Radiation Therapy Record ${idx + 1}`.toLowerCase();
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
    return filteredRecords.map((record, idx) => getMergedRecord(record, idx, false));
  }, [filteredRecords, getMergedRecord]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    if (sid) setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev }; delete next[key]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageFullText = (record, fn, idx, sid, fullText, sentenceMarks) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sentenceMarks) setEditedSentences(prev => ({ ...prev, ...sentenceMarks }));
    if (sid) setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev }; delete next[key]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageFullText(record, fn, idx, sid, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const marks = {};
    marks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    stageFullText(record, fn, idx, sid, fullText, marks);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // localEdits keys are `${fieldName}-${idx}` (fieldName may be a dotted nested path like planning.fractionDose).
    const suffix = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fn = k.slice(0, -suffix.length);
      return fields.some(field => fn === field || fn.startsWith(`${field}.`));
    });
    try {
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, -suffix.length);
        // Per GOTCHA: a trailing dot-segment is an arrayIndex only when purely numeric. fn here is a
        // field name (nested dotted paths like planning.fractionDose are NOT array indices), and array
        // fields are staged as the full array under `${fn}-${idx}` — so always send field=fn, no arrayIndex.
        const payload = { field: fn, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/radiation_therapy_records/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/radiation_therapy_records/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's section drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        Object.keys(store[id]).forEach(key => {
          if (fields.some(field => key === field || key.startsWith(`${field}.`))) delete store[id][key];
        });
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
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${formatDate(val)}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${val}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (label.toLowerCase() !== title.toLowerCase()) text += `${label}\n${COPY_LINE_DASH}\n`;
        text += `${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (label.toLowerCase() !== title.toLowerCase()) text += `${label}\n${COPY_LINE_DASH}\n`;
        if (sentences.length > 1) {
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `1. ${strVal}\n\n`;
        }
      } else {
        text += `${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `RADIATION THERAPY RECORDS\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Radiation Therapy Record ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
      <div key={fn} className="nested-mini-card labeled-row-group">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <BlueDatePicker value={editValue} onSelect={value => { setEditValue(value || ''); setSaveError(null); }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${COPY_LINE_DASH}\n1. ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD — validate numeric on save ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="nested-mini-card labeled-row-group">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const current = Number(editValue); setEditValue(String((Number.isFinite(current) ? current : 0) - 1)); }}>−</button>
                  <input type="text" inputMode="numeric" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const current = Number(editValue); setEditValue(String((Number.isFinite(current) ? current : 0) + 1)); }}>+</button>
                </div>
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${COPY_LINE_DASH}\n1. ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    return (
      <div key={fn} className={`nested-mini-card ${showLabel ? 'labeled-row-group' : 'regular-row-group'}`}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const fieldPath = `${fn}.${itemIdx}`;
          const editKey = `${fieldPath}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={fieldPath}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fieldPath, idx, sid, null, editValue, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with semantic labeled/unlabeled grouping ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== String(title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const measurement = MEASUREMENT_FIELDS.includes(fn) ? splitNumberUnit(strVal) : null;
    if (measurement) {
      const editKey = `${fn}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const step = stepFor(measurement.number);
      const decimalPlaces = (String(step).split('.')[1] || '').length;
      const adjust = (delta) => {
        const current = Number(editValue);
        setEditValue(((Number.isFinite(current) ? current : 0) + delta * Number(step)).toFixed(decimalPlaces));
      };
      return (
        <div key={fn} className={`nested-mini-card ${showLabel ? 'labeled-row-group' : 'regular-row-group'}`}>
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div data-edit-field={fn}>
            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(measurement.number); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <div className="num-stepper-row">
                    <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); adjust(-1); }}>−</button>
                    <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={event => setEditValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); adjust(1); }}>+</button>
                    {measurement.unit && <span className="number-edit-unit">{measurement.unit}</span>}
                  </div>
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); const numeric = Number(editValue); if (!Number.isFinite(numeric)) { setSaveError('Please enter a valid number'); return; } const nextValue = `${editValue}${measurement.unit ? measurement.separator || ' ' : ''}${measurement.unit}`; handleSaveField(record, fn, idx, sid, null, nextValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${showLabel ? `${label}\n${COPY_LINE_DASH}\n` : ''}1. ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
            {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
          </div>
        </div>
      );
    }

    const saveLabeledPart = (sentenceIndex, itemIndex, parsed, trackingKey) => {
      const currentSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const currentParsed = parseLabel(currentSentences[sentenceIndex] || '');
      if (!currentParsed.isLabeled) return;
      const parts = splitByComma(currentParsed.value);
      parts[itemIndex] = editValue.trim().replace(/[;.]+$/, '');
      currentSentences[sentenceIndex] = `${parsed.label}: ${parts.join(', ')}`;
      stageFullText(record, fn, idx, sid, reconstructFullText(currentSentences), { [trackingKey]: 'edited' });
    };

    if (sentences.length > 1) {
      const groups = [];
      sentences.forEach((sentence, sentenceIndex) => {
        const parsed = parseLabel(sentence);
        const row = { sentence, sentenceIndex, parsed, values: parsed.isLabeled ? splitByComma(parsed.value) : [sentence.replace(/[;.]+$/, '').trim()] };
        if (parsed.isLabeled) {
          groups.push({ type: 'labeled', label: parsed.label, rows: [row] });
        } else {
          const previous = groups[groups.length - 1];
          if (previous?.type === 'regular') previous.rows.push(row);
          else groups.push({ type: 'regular', rows: [row] });
        }
      });

      return (
        <div key={fn} className="nested-group">
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {groups.map((group, groupIndex) => (
            <div key={`${fn}-group-${groupIndex}`} className={`nested-mini-card ${group.type === 'labeled' ? 'labeled-row-group' : 'regular-row-group'}`}>
              {group.type === 'labeled' && <div className="nested-subtitle sub-label">{highlightText(group.label)}</div>}
              {group.rows.flatMap(row => row.values.map((value, valueIndex) => {
                const trackingKey = `${fn}-${idx}-s${row.sentenceIndex}${row.parsed.isLabeled ? `-c${valueIndex}` : ''}`;
                const isEditing = editingField === trackingKey;
                const badge = editedSentences[trackingKey];
                return (
                  <div key={trackingKey} data-edit-field={fn}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(trackingKey); setEditValue(value); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); if (row.parsed.isLabeled) saveLabeledPart(row.sentenceIndex, valueIndex, row.parsed, trackingKey); else saveSentence(record, fn, idx, sid, row.sentenceIndex); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(value)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[trackingKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(value, trackingKey); }}>{copiedItems[trackingKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              }))}
            </div>
          ))}
        </div>
      );
    }

    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className={`nested-mini-card ${showLabel ? 'labeled-row-group' : 'regular-row-group'}`}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${showLabel ? `${label}\n${COPY_LINE_DASH}\n` : ''}1. ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
      <div className="radiation-therapy-records-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Radiation Therapy Records</h2></div>
        <div className="empty-state">No radiation therapy records available</div>
      </div>
    );
  }

  return (
    <div className="radiation-therapy-records-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Radiation Therapy Records</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RadiationTherapyRecordsDocumentPDFTemplate document={pdfData} />} fileName="Radiation_Therapy_Records.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search radiation therapy records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Radiation Therapy Record ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'treatment-info')}
            {renderSection(record, idx, 'dose-info')}
            {renderSection(record, idx, 'treatment-planning')}
            {renderSection(record, idx, 'side-effects')}
            {renderSection(record, idx, 'treatment-response')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadiationTherapyRecordsDocument;
