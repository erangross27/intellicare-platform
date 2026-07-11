/**
 * FallsPreventionProgramAssessmentDocument.jsx
 * June 2026 — Falls Prevention Program Assessment (unified flat schema)
 * Data collection: falls_prevention_program_assessment
 * Edit route: falls_prevention_program_assessment
 *
 * 4 Sections (covering all 15 extractable fields, none added):
 *   1. falls-history:       fallsHistory (ARRAY OF OBJECTS — nested-mini-card per item, scalar leaves editable via dot-path)
 *   2. mobility-balance:    tugTest, bergBalance, chairStand, gaitSpeed, gaitPattern
 *   3. risk-interventions:  fallRiskFactors, interventions, recommendations
 *   4. program:             assessmentDate, programType, findings, goals, progress, followUp
 *
 * Field handling:
 *   - SIMPLE STRINGS → click-to-edit textarea (renderEditableField)
 *   - NARRATIVE STRINGS → per-sentence editing (renderSentenceEditableField)
 *   - ARRAYS OF STRINGS → per-item editing with arrayIndex (splitByComma + parseLabel)
 *   - ARRAY OF OBJECTS → nested-mini-card per item, each scalar leaf editable via dot-path
 *   - DATE → editable date input + header badge (parseDate; 1970-epoch/null hidden)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FallsPreventionProgramAssessmentDocumentPDFTemplate from '../pdf-templates/FallsPreventionProgramAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './FallsPreventionProgramAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [markerKey]: { value, dbField, arrayIndex? } } }
     - markerKey is the SAME key used in editedFields/editedSentences (e.g. "tugTest-0",
       "fallRiskFactors-0-i2", "fallsHistory-0-i1-injury", "findings-0-s0").
     - value is the value to store in localEdits for rendering (a string, OR the full array
       for ARRAY/OBJECT_ARRAY fields — exactly what the save handler put into localEdits).
     - dbField + (optional) arrayIndex are the EXACT payload the original save handler PUT to
       /api/edit (so Approve replays the identical DB write). */
const DRAFT_KEY = 'falls_prevention_program_assessmentPendingEdits';
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
  'falls-history': 'Falls History',
  'mobility-balance': 'Mobility & Balance Tests',
  'risk-interventions': 'Risk & Interventions',
  'program': 'Program',
};

const FIELD_LABELS = {
  fallsHistory: 'Falls History',
  tugTest: 'TUG Test',
  bergBalance: 'Berg Balance',
  chairStand: 'Chair Stand',
  gaitSpeed: 'Gait Speed',
  gaitPattern: 'Gait Pattern',
  fallRiskFactors: 'Fall Risk Factors',
  interventions: 'Interventions',
  recommendations: 'Recommendations',
  assessmentDate: 'Assessment Date',
  programType: 'Program Type',
  findings: 'Findings',
  goals: 'Goals',
  progress: 'Progress',
  followUp: 'Follow-up',
};

const SECTION_FIELDS = {
  'falls-history': ['fallsHistory'],
  'mobility-balance': ['tugTest', 'bergBalance', 'chairStand', 'gaitSpeed', 'gaitPattern'],
  'risk-interventions': ['fallRiskFactors', 'interventions', 'recommendations'],
  'program': ['assessmentDate', 'programType', 'findings', 'goals', 'progress', 'followUp'],
};

// Simple strings → click-to-edit textarea (renderEditableField)
const SIMPLE_STRING_FIELDS = ['tugTest', 'bergBalance', 'chairStand', 'gaitSpeed', 'gaitPattern', 'programType'];
// Narrative strings → per-sentence editing (renderSentenceEditableField)
const NARRATIVE_STRING_FIELDS = ['recommendations', 'findings', 'goals', 'progress', 'followUp'];
// Arrays of strings → per-item editing with arrayIndex
const ARRAY_FIELDS = ['fallRiskFactors', 'interventions'];
// Array of objects → nested-mini-card per item, scalar leaves editable via dot-path
const OBJECT_ARRAY_FIELDS = ['fallsHistory'];
// Date → editable date input + header badge
const DATE_FIELDS = ['assessmentDate'];

// Field ordering within fallsHistory items (date first as the head)
const FALLS_HISTORY_KEY_ORDER = ['date', 'location', 'injury', 'circumstances'];
const FALLS_HISTORY_LABELS = { date: 'Date', location: 'Location', injury: 'Injury', circumstances: 'Circumstances' };

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

/* parseDate — returns formatted date string or '' (1970-epoch/null/invalid hidden) */
const parseDate = (dateValue) => {
  if (dateValue === null || dateValue === undefined || dateValue === '') return '';
  try {
    const raw = (typeof dateValue === 'object' && dateValue.$date) ? dateValue.$date : dateValue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    if (d.getTime() === 0 || d.getUTCFullYear() <= 1970) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

/* dateInputValue — yyyy-mm-dd for the BlueDatePicker */
const dateInputValue = (dateValue) => {
  if (dateValue === null || dateValue === undefined || dateValue === '') return '';
  try {
    const raw = (typeof dateValue === 'object' && dateValue.$date) ? dateValue.$date : dateValue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch { return ''; }
};

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isFalleEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/* ═══════ COMPONENT ═══════ */
const FallsPreventionProgramAssessmentDocument = ({ document: docProp, data, templateData }) => {
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
  // markerKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Value = exact DB
  // payload to replay on Approve: { value, dbField, arrayIndex? }. Cleared per-section on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    const pick = (r) => r?.falls_prevention_program_assessment;
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      const p = pick(r);
      if (p) return Array.isArray(p) ? p : [p];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; const pp = pick(dd); if (pp) return Array.isArray(pp) ? pp : [pp]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* ═══════ REHYDRATE DRAFTS ═══════ */
  // Repopulate staged drafts from localStorage so a Save survives refresh (shown in JSX, NOT DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idFor(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([markerKey, payload]) => {
        // markerKey is stored against record id; remap its idx segment to this render index.
        const remapped = markerKey.replace(/-(\d+)(?=(-|$))/, `-${idx}`);
        const localKey = remapped.replace(/-(?:i\d+(?:-[^-]+)?|s\d+)$/, ''); // strip -iN[-key] / -sN suffix
        nLocal[localKey] = payload && typeof payload === 'object' ? payload.value : payload;
        nPending[remapped] = payload && typeof payload === 'object' ? payload : { value: payload };
        if (/-s\d+$/.test(remapped)) nSentences[remapped] = 'edited';
        else nFields[remapped] = 'edited';
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

  const objectArrayHasVal = useCallback((v) => {
    if (!Array.isArray(v)) return false;
    return v.some(item => item && typeof item === 'object' && Object.values(item).some(x => !isFalleEmpty(x)));
  }, []);

  const dateHasVal = useCallback((v) => parseDate(v) !== '', []);

  // Per-field presence
  const fieldHasVal = useCallback((fn, v) => {
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return objectArrayHasVal(v);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    if (DATE_FIELDS.includes(fn)) return dateHasVal(v);
    return hasVal(v);
  }, [hasVal, objectArrayHasVal, dateHasVal]);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    if (!searchTerm.trim() || text === null || text === undefined) return text;
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

  /* searchable flatten for object-array fields */
  const flattenObjectArray = useCallback((v) => {
    if (!Array.isArray(v)) return '';
    return v.map(item => (item && typeof item === 'object') ? Object.values(item).map(x => fmtScalar(x)).join(' ') : fmtScalar(item)).join(' ');
  }, []);

  /* display string for a field */
  const fieldDisplay = useCallback((fn, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return flattenObjectArray(val);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : fmtVal(val);
    if (DATE_FIELDS.includes(fn)) return parseDate(val);
    return fmtVal(val);
  }, [fmtVal, flattenObjectArray]);

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
      if (fieldHasVal(f, val)) {
        if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (fieldHasVal(fn, val)) {
      return fieldDisplay(fn, val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Falls Prevention Program Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (fieldHasVal(f, val)) {
            if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    // A localEdits key (`field-idx`) is a pending draft if ANY pendingEdits marker targets that
    // same field+idx (markers: `field-idx`, `field-idx-iN[-key]`, `field-idx-sN`).
    const pendingKeys = Object.keys(pendingEdits);
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const base = `${m[1]}-${idx}`;
          const isPending = pendingKeys.some(pk => pk === base || pk.startsWith(`${base}-`));
          if (isPending) return; // pending drafts stay OUT of the PDF until approved
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleStartEdit = (field, idx, val, sentenceIdx = 0) => {
    setEditingField(sentenceIdx ? `${field}-${idx}-s${sentenceIdx}` : `${field}-${idx}`);
    setEditValue(val);
    setSaveError(null);
  };

  // Save = stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, sentenceIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const markerKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [markerKey]: saveVal }));
    setEditedFields(prev => ({ ...prev, [markerKey]: 'edited' }));
    setPendingEdits(prev => ({ ...prev, [markerKey]: { value: saveVal, dbField: field } }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][markerKey] = { value: saveVal, dbField: field };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* array item edit — uses arrayIndex */
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    currentArr[arrayIndex] = saveVal;
    setSaveError(null);
    const markerKey = `${field}-${idx}-i${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: currentArr }));
    setEditedFields(prev => ({ ...prev, [markerKey]: 'edited' }));
    setPendingEdits(prev => ({ ...prev, [markerKey]: { value: currentArr, dbField: field, arrayIndex, dbValue: saveVal } }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][markerKey] = { value: currentArr, dbField: field, arrayIndex, dbValue: saveVal };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  /* object-array leaf edit — dot-path `fallsHistory.<arrayIndex>.<key>` */
  const handleSaveObjectLeaf = useCallback((record, field, idx, sectionId, arrayIndex, key, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? cur.map(it => (it && typeof it === 'object') ? { ...it } : it) : [];
    const dotField = `${field}.${arrayIndex}.${key}`;
    if (currentArr[arrayIndex] && typeof currentArr[arrayIndex] === 'object') currentArr[arrayIndex][key] = saveVal;
    setSaveError(null);
    const markerKey = `${field}-${idx}-i${arrayIndex}-${key}`;
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: currentArr }));
    setEditedFields(prev => ({ ...prev, [markerKey]: 'edited' }));
    setPendingEdits(prev => ({ ...prev, [markerKey]: { value: currentArr, dbField: dotField, dbValue: saveVal } }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][markerKey] = { value: currentArr, dbField: dotField, dbValue: saveVal };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  // Save one sentence = stage a DRAFT (full rebuilt text) locally + localStorage. NOT a DB write;
  // Approve (handleApproveSection) commits it. Sentence markers drive the per-sentence badges.
  function saveSentence(record, field, idx, sectionId, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const markerKey = `${field}-${idx}`;
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][markerKey] = { value: fullText, dbField: field };
      writeDrafts(store);
    };
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...allCurrent]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [markerKey]: fullText }));
      setEditedFields(prev => ({ ...prev, [markerKey]: 'edited' }));
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) { if (!key.startsWith(`${field}-${idx}-s`)) cleaned[key] = prev[key]; }
        return cleaned;
      });
      setPendingEdits(prev => ({ ...prev, [markerKey]: { value: fullText, dbField: field } }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue('');
      return;
    }
    const updated = [...allCurrent]; updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    setLocalEdits(prev => ({ ...prev, [markerKey]: fullText }));
    const editedMap = {};
    editedMap[`${field}-${idx}-s${sentenceIdx}`] = 'edited';
    if (extraCount > 0) {
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${field}-${idx}-s${si}`] = 'added';
      }
    }
    setEditedSentences(prev => {
      const cleaned = {};
      for (const key of Object.keys(prev)) { if (!key.startsWith(`${field}-${idx}-s`)) cleaned[key] = prev[key]; }
      return { ...cleaned, ...editedMap };
    });
    setEditedFields(prev => ({ ...prev, [markerKey]: 'edited' }));
    setPendingEdits(prev => ({ ...prev, [markerKey]: { value: fullText, dbField: field } }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    stageDraft(fullText);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB (the ONLY DB-write path), then
  // clear pending so committed values flow into pdfData/PDF, drop drafts from localStorage, and
  // clear this section's edited markers.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Pending markers belonging to this record's section: `<field>-<idx>` or `<field>-<idx>-...`
    const toCommit = Object.keys(pendingEdits).filter(k =>
      fields.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`))
    );
    setSaving(true); setSaveError(null);
    try {
      for (const markerKey of toCommit) {
        const p = pendingEdits[markerKey];
        if (!p) continue;
        const payload = { field: p.dbField, value: p.dbValue !== undefined ? p.dbValue : p.value };
        if (typeof p.arrayIndex === 'number') payload.arrayIndex = p.arrayIndex;
        const resp = await secureApiClient.put(`/api/edit/falls_prevention_program_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/falls_prevention_program_assessment/${id}/approve`, { sectionId: sid, approved: true });

      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[FallsPreventionProgramAssessment] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits]);

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
        // Unlabeled sentence: split only REAL lists (≥3 items — adjective pairs stay whole).
        const parts = splitByComma(s);
        if (parts.length >= 3) { parts.forEach(item => { lines.push(`${n++}. ${item}`); }); }
        else { lines.push(`${n++}. ${s}`); }
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid] || '';
    const COPY_LINE_EQ = '='.repeat(40);
    const COPY_LINE_DASH = '-'.repeat(40);
    let text = '';
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sl = label.toLowerCase() !== title.toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(it => it && typeof it === 'object' && Object.values(it).some(x => !isFalleEmpty(x))) : [];
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        items.forEach(item => {
          // STACKED sub-label / value (never side-by-side "key: value")
          FALLS_HISTORY_KEY_ORDER.forEach(k => {
            if (!isFalleEmpty(item[k])) text += `${FALLS_HISTORY_LABELS[k] || k}\n${COPY_LINE_DASH}\n${fmtScalar(item[k])}\n`;
          });
          Object.keys(item).filter(k => !FALLS_HISTORY_KEY_ORDER.includes(k)).forEach(k => {
            if (!isFalleEmpty(item[k])) text += `${k}\n${COPY_LINE_DASH}\n${fmtScalar(item[k])}\n`;
          });
          text += '\n';
        });
      } else if (DATE_FIELDS.includes(f)) {
        text += sl ? `${label}\n${COPY_LINE_DASH}\n${parseDate(val)}\n\n` : `${parseDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        items.forEach((item, i) => { const p = parseLabel(String(item)); text += `${i + 1}. ${p.value || item}\n`; });
        text += '\n';
      } else {
        const strVal = fieldDisplay(f, val);
        const sentences = splitBySentence(strVal);
        if (NARRATIVE_STRING_FIELDS.includes(f) && sentences.length > 1) {
          if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += sl ? `${label}\n${COPY_LINE_DASH}\n${strVal}\n\n` : `${strVal}\n\n`;
        }
      }
    });
    // Empty-section drop: a section with no populated fields emits NOTHING (never a bare title+divider).
    return text.trim() ? `${title}\n${COPY_LINE_EQ}\n\n${text}` : '';
  }, [getFieldValue, fieldHasVal, fieldDisplay, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== FALLS PREVENTION PROGRAM ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      const rt = `Falls Prevention Program Assessment ${idx + 1}`;
      text += `${rt}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE STRING FIELD (textarea) ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, strVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, 0, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DATE FIELD (editable date input) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = parseDate(val);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(dateInputValue(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (String(editValue).trim() === '') { setSaveError('This field cannot be empty.'); return; } const iso = new Date(`${editValue}T00:00:00.000Z`).toISOString(); handleSaveField(record, fn, idx, sid, 0, iso); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD — per-item editing with arrayIndex ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rawArr = Array.isArray(val) ? val : splitByComma(String(val));
    const items = rawArr.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, aIdx) => {
          const parsed = parseLabel(String(item));
          const itemVal = parsed.value || String(item);
          const itemKey = `${fn}-${idx}-i${aIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={aIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(String(item)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, aIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      {parsed.isLabeled && <span className="content-subtitle-label">{highlightText(parsed.label)}</span>}
                      <span className="content-value">{highlightText(itemVal)}</span>
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: OBJECT-ARRAY FIELD (fallsHistory) — nested-mini-card per item, scalar leaves editable ═══════ */
  const renderObjectLeaf = (record, fn, idx, sid, aIdx, key, value) => {
    const leafKey = `${fn}-${idx}-i${aIdx}-${key}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const display = fmtScalar(value);
    return (
      <div className="nested-mini-card" key={key}>
        <div className="nested-subtitle sub-label">{highlightText(FALLS_HISTORY_LABELS[key] || key)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(display); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectLeaf(record, fn, idx, sid, aIdx, key, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(display)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${FALLS_HISTORY_LABELS[key] || key}\n${display}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    // keep ORIGINAL indices so dot-paths stay correct after hide-empty
    const indexed = [];
    (Array.isArray(val) ? val : []).forEach((item, oi) => {
      if (item && typeof item === 'object' && Object.values(item).some(x => !isFalleEmpty(x))) indexed.push([oi, item]);
    });
    if (indexed.length === 0) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {indexed.map(([oi, item]) => {
          const orderedKeys = [
            ...FALLS_HISTORY_KEY_ORDER.filter(k => !isFalleEmpty(item[k])),
            ...Object.keys(item).filter(k => !FALLS_HISTORY_KEY_ORDER.includes(k) && !isFalleEmpty(item[k])),
          ];
          if (orderedKeys.length === 0) return null;
          const headKey = orderedKeys[0];
          const restKeys = orderedKeys.slice(1);
          return (
            <div className="rec-mini-card" key={oi}>
              {renderObjectLeaf(record, fn, idx, sid, oi, headKey, item[headKey])}
              {restKeys.map(k => renderObjectLeaf(record, fn, idx, sid, oi, k, item[k]))}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: NARRATIVE FIELD — per-sentence editing ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, sentence.replace(/[;.]+$/, '').trim(), sIdx); }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    /* Single-sentence narrative */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey || editingField === `${fn}-${idx}-s0`;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, strVal, 0); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, 0); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ FIELD DISPATCH ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return renderObjectArrayField(record, fn, idx, sid);
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    if (NARRATIVE_STRING_FIELDS.includes(fn)) return renderSentenceEditableField(record, fn, idx, sid);
    return renderEditableField(record, fn, idx, sid);
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="falls-prevention-program-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Falls Prevention Program Assessment</h2></div>
        <div className="empty-state">No falls prevention program assessment records available</div>
      </div>
    );
  }

  return (
    <div className="falls-prevention-program-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Falls Prevention Program Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FallsPreventionProgramAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Falls_Prevention_Program_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search falls prevention program assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `Falls Prevention Program Assessment ${idx + 1}`;
          /* assessmentDate renders in the Program section — no header date pill (one-pass item 10) */
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {renderSection(record, idx, 'falls-history')}
              {renderSection(record, idx, 'mobility-balance')}
              {renderSection(record, idx, 'risk-interventions')}
              {renderSection(record, idx, 'program')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FallsPreventionProgramAssessmentDocument;
