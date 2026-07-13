/**
 * RehabilitationGoalsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: rehabilitation_goals
 *
 * 7 Sections:
 *   1. goal-overview: goalDescription, functionalCategory, priorityLevel, achievementStatus, date
 *   2. timeline: startDate, targetDate, duration, frequency
 *   3. performance: baselinePerformance, currentPerformance, targetPerformance, measurableOutcome, percentComplete
 *   4. therapy: therapyDiscipline, responsibleTherapist, interventionApproach
 *   5. barriers-facilitators: barriers, facilitators, equipmentRequired
 *   6. patient-involvement: patientAgreement, caregiverInvolvement
 *   7. discharge: dischargeCriteria, anticipatedDischargeDisposition, outcomeScale, modificationReason
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import RehabilitationGoalsDocumentPDFTemplate from '../pdf-templates/RehabilitationGoalsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RehabilitationGoalsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'rehabilitation_goalsPendingEdits';
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
  'goal-overview': 'Goal Overview',
  'timeline': 'Timeline & Schedule',
  'performance': 'Performance & Outcomes',
  'therapy': 'Therapy & Interventions',
  'barriers-facilitators': 'Barriers & Facilitators',
  'patient-involvement': 'Patient Involvement',
  'discharge': 'Discharge Planning',
};

const FIELD_LABELS = {
  goalDescription: 'Goal Description',
  functionalCategory: 'Functional Category',
  priorityLevel: 'Priority Level',
  achievementStatus: 'Achievement Status',
  date: 'Date',
  startDate: 'Start Date',
  targetDate: 'Target Date',
  duration: 'Duration',
  frequency: 'Frequency',
  baselinePerformance: 'Baseline Performance',
  currentPerformance: 'Current Performance',
  targetPerformance: 'Target Performance',
  measurableOutcome: 'Measurable Outcome',
  percentComplete: 'Percent Complete',
  therapyDiscipline: 'Therapy Discipline',
  responsibleTherapist: 'Responsible Therapist',
  interventionApproach: 'Intervention Approach',
  barriers: 'Barriers',
  facilitators: 'Facilitators',
  equipmentRequired: 'Equipment Required',
  patientAgreement: 'Patient Agreement',
  caregiverInvolvement: 'Caregiver Involvement',
  dischargeCriteria: 'Discharge Criteria',
  anticipatedDischargeDisposition: 'Anticipated Discharge Disposition',
  outcomeScale: 'Outcome Scale',
  modificationReason: 'Modification Reason',
};

const SECTION_FIELDS = {
  'goal-overview': ['goalDescription', 'functionalCategory', 'priorityLevel', 'achievementStatus', 'date'],
  'timeline': ['startDate', 'targetDate', 'duration', 'frequency'],
  'performance': ['baselinePerformance', 'currentPerformance', 'targetPerformance', 'measurableOutcome', 'percentComplete'],
  'therapy': ['therapyDiscipline', 'responsibleTherapist', 'interventionApproach'],
  'barriers-facilitators': ['barriers', 'facilitators', 'equipmentRequired'],
  'patient-involvement': ['patientAgreement', 'caregiverInvolvement'],
  'discharge': ['dischargeCriteria', 'anticipatedDischargeDisposition', 'outcomeScale', 'modificationReason'],
};

const BOOLEAN_FIELDS = ['patientAgreement'];
const DATE_FIELDS = ['date', 'startDate', 'targetDate'];
const NUMBER_FIELDS = ['percentComplete'];
const ARRAY_FIELDS = ['interventionApproach', 'barriers', 'facilitators', 'equipmentRequired'];
const STRING_FIELDS = ['goalDescription', 'functionalCategory', 'priorityLevel', 'achievementStatus', 'duration', 'frequency', 'baselinePerformance', 'currentPerformance', 'targetPerformance', 'measurableOutcome', 'therapyDiscipline', 'responsibleTherapist', 'caregiverInvolvement', 'dischargeCriteria', 'anticipatedDischargeDisposition', 'outcomeScale', 'modificationReason'];
const CLINICAL_TEXT_DELIMITER = /[.;]\s/;
const ENUM_FIELDS = {
  functionalCategory: ['mobility', 'activities-of-daily-living', 'communication', 'cognition', 'strength', 'endurance', 'balance', 'pain-management', 'other'],
  priorityLevel: ['low', 'medium', 'high', 'urgent'],
  achievementStatus: ['not-started', 'in-progress', 'achieved', 'on-hold', 'modified', 'discontinued'],
};
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const parseNestedClinicalLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '', displayValue: text || '', rebuild: value => value };
  const withDisplay = parsed => ({
    ...parsed,
    displayValue: parsed.isLabeled && /^[<>~]?\d+(?:\.\d+)?%?$/.test(parsed.value) ? `Score ${parsed.value}` : parsed.value,
  });
  const parenthetical = text.match(/^(.+?)\s*\(([^():]+):\s*([^()]+)\)$/);
  if (parenthetical) {
    return withDisplay({
      isLabeled: true,
      label: `${parenthetical[1].trim()} — ${parenthetical[2].trim()}`,
      value: parenthetical[3].trim(),
      rebuild: value => `${parenthetical[1].trim()} (${parenthetical[2].trim()}: ${String(value).trim()})`,
    });
  }
  const direct = parseLabel(text);
  if (!direct.isLabeled) return withDisplay({ ...direct, rebuild: value => value });
  return withDisplay({ ...direct, rebuild: value => `${direct.label}: ${String(value).trim()}` });
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
      const before = current.trim();
      const after = text.slice(i + 1);
      const afterTrimmed = after.trimStart();
      const nextWord = (afterTrimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
      const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
      const numericThousands = /\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed);
      const noFollowingSpace = after.length === afterTrimmed.length;
      const linkedByConjunction = ['and', 'or'].includes(nextWord) || ['and', 'or'].includes(previousWord);
      if (numericThousands || noFollowingSpace || linkedByConjunction) current += ch;
      else { if (before) result.push(before); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const CREDENTIAL_TOKEN = /^(?:MD|DO|RN|LPN|NP|PA|PhD|PharmD|FACC|FACP|FACS|FAAP|FACOG|MPH|MBA|BSN|MSN|DDS|DMD|DVM|DPT|Esq|Jr|Sr)\b/i;
const commaRowsForDisplay = (text) => {
  const rows = splitByComma(text);
  if (rows.length < 3 || rows.slice(1).some(row => CREDENTIAL_TOKEN.test(row.trim()))) return [text];
  return rows;
};
const displayString = (value) => String(value ?? '').replace(/\u2265/g, '>=');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime()) || d.getFullYear() < 1971) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const RehabilitationGoalsDocument = ({ document: docProp }) => {
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
      if (r?.rehabilitation_goals) return Array.isArray(r.rehabilitation_goals) ? r.rehabilitation_goals : [r.rehabilitation_goals];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rehabilitation_goals) return Array.isArray(dd.rehabilitation_goals) ? dd.rehabilitation_goals : [dd.rehabilitation_goals]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Stable record-id resolver (handles _id string + _id.$oid). */
  const idOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
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
    /* eslint-disable react-hooks/set-state-in-effect -- rehydrate one local draft snapshot after records resolve */
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [records, idOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return displayString(v); }, []);

  const splitTextSegments = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const segments = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      const isCandidate = depth === 0 && (ch === ';' || ch === '.');
      const protectedTitle = ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g)$/.test(current);
      const decimal = ch === '.' && /\d$/.test(current) && /^\d/.test(text[i + 1] || '');
      const boundary = isCandidate && !protectedTitle && !decimal && (!text[i + 1] || CLINICAL_TEXT_DELIMITER.test(`${ch}${text[i + 1]}`));
      if (!boundary) { current += ch; continue; }
      let separator = ch;
      while (/\s/.test(text[i + 1] || '')) { separator += text[i + 1]; i += 1; }
      const value = current.trim();
      if (value) segments.push({ text: value, separator });
      current = '';
    }
    const tail = current.trim();
    if (tail) segments.push({ text: tail, separator: '' });
    return segments;
  }, []);

  const splitBySentence = useCallback((text) => splitTextSegments(text).map(segment => segment.text), [splitTextSegments]);

  const replaceSegment = useCallback((originalText, segmentIndex, replacementText) => {
    const original = splitTextSegments(String(originalText || ''));
    if (!original[segmentIndex]) return String(originalText || '');
    const replacement = splitTextSegments(String(replacementText || '').trim());
    const originalSeparator = original[segmentIndex].separator;
    if (!replacement.length) original.splice(segmentIndex, 1);
    else {
      replacement[replacement.length - 1].separator = originalSeparator;
      original.splice(segmentIndex, 1, ...replacement);
    }
    return original.map(part => `${part.text}${part.separator}`).join('').trim();
  }, [splitTextSegments]);

  function reconstructFullText(sentences) {
    return (sentences || []).map(sentence => String(sentence || '').replace(/[;.]+$/, '').trim()).filter(Boolean).join('. ');
  }

  const setAtPath = useCallback((source, path, value) => {
    const parts = String(path).split('.');
    const root = Array.isArray(source) ? [...source] : { ...source };
    let cursor = root;
    let originalCursor = source;
    parts.forEach((part, partIndex) => {
      const isLast = partIndex === parts.length - 1;
      if (isLast) { cursor[part] = value; return; }
      const originalNext = originalCursor?.[part];
      const clone = Array.isArray(originalNext) ? [...originalNext] : { ...(originalNext || {}) };
      cursor[part] = clone;
      cursor = clone;
      originalCursor = originalNext;
    });
    return root;
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = record[fn];
    if (Array.isArray(value)) {
      value = [...value];
      Object.entries(localEdits).forEach(([editKey, editValue]) => {
        const match = editKey.match(new RegExp(`^${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)-${idx}$`));
        if (match) value[Number(match[1])] = editValue;
      });
    }
    return value;
  }, [localEdits]);

  const stepEditValue = (direction) => {
    setEditValue(previous => {
      const numeric = Number.parseFloat(previous);
      const next = Math.min(100, Math.max(0, (Number.isNaN(numeric) ? 0 : numeric) + direction));
      return String(next);
    });
  };

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
  const shouldShowSection = useCallback((record, idx, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
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
      const rt = `Rehabilitation Goals ${idx + 1}`.toLowerCase();
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
      let merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged = setAtPath(merged, m[1], localEdits[key]);
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, setAtPath]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a field DRAFT in a draft store under fieldPart (= "field", or "field.arrayIndex" for array
  // elements). Updates local state + localStorage so it survives refresh; NOT written to DB/PDF until Approve.
  const stageDraft = useCallback((record, idx, sid, fieldPart, value) => {
    const id = idOf(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending.
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [idOf]);

  // Save = stage a DRAFT locally + localStorage (survives refresh). NOT written to MongoDB and NOT shown
  // in the PDF until the user clicks Approve (handleApproveSection commits). No DB write here.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = idOf(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, idx, sid, fn, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, idOf, stageDraft]);

  // Stage one edited sentence as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = idOf(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const editedVal = editValue.trim();
    setSaveError(null);
    const replacement = /^[;.,!?]+$/.test(editedVal) ? '' : editedVal;
    const fullText = replaceSegment(currentVal, sentenceIdx, replacement);
    stageDraft(record, idx, sid, fn, fullText);
    const marks = { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' };
    const extra = Math.max(0, splitTextSegments(replacement).length - 1);
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed values
  // now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = idOf(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      // Collect this record's pending edits whose field belongs to this section.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/rehabilitation_goals/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/rehabilitation_goals/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); delete store[id][fieldPart]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError(err.message || 'Unable to approve edits'); } finally { setSaving(false); }
  }, [idOf, localEdits, pendingEdits]);

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
    const lines = []; let unlabeledNumber = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const rows = commaRowsForDisplay(parsed.value);
        lines.push(parsed.label, COPY_LINE_DASH);
        let rowNumber = 1;
        rows.forEach(item => {
          const clinical = parseNestedClinicalLabel(item);
          if (clinical.isLabeled) lines.push(clinical.label, COPY_LINE_DASH, `1. ${clinical.displayValue}`);
          else lines.push(`${rowNumber++}. ${item}`);
        });
      } else {
        const rows = commaRowsForDisplay(s);
        rows.forEach(item => {
          const clinical = parseNestedClinicalLabel(item);
          if (clinical.isLabeled) lines.push(clinical.label, COPY_LINE_DASH, `1. ${clinical.displayValue}`);
          else lines.push(`${unlabeledNumber++}. ${item}`);
        });
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const body = [];
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (!sameAsTitle(label, title)) body.push(label, COPY_LINE_DASH);
      if (DATE_FIELDS.includes(f)) body.push(`1. ${formatDate(val)}`);
      else if (ARRAY_FIELDS.includes(f)) {
        let itemNumber = 1;
        (Array.isArray(val) ? val : [val]).forEach(item => {
          const clinical = parseNestedClinicalLabel(fmtVal(item));
          if (clinical.isLabeled) body.push(clinical.label, COPY_LINE_DASH, `1. ${clinical.displayValue}`);
          else body.push(`${itemNumber++}. ${fmtVal(item)}`);
        });
      }
      else if (STRING_FIELDS.includes(f)) body.push(...formatSentenceFieldLines(fmtVal(val)));
      else body.push(`1. ${fmtVal(val)}`);
      body.push('');
    });
    if (!body.length) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body.join('\n').trim()}\n\n`;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Rehabilitation Goals\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Rehabilitation Goal ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
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

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  const enumOptionsWith = (fieldName, currentValue) => {
    const base = ENUM_FIELDS[fieldName] || [];
    const current = String(currentValue ?? '').trim();
    if (!current || base.some(o => o.toLowerCase() === current.toLowerCase())) return base;
    return [current, ...base];
  };

  const enumCanonical = (fieldName, currentValue) => {
    const current = String(currentValue ?? '').trim();
    return (ENUM_FIELDS[fieldName] || []).find(option => option.toLowerCase() === current.toLowerCase()) || current;
  };

  /* ═══════ RENDER: FIXED-CHOICE FIELD ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(fn, displayVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={enumOptionsWith(fn, editValue)} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>−</button>
                <input type="text" inputMode="numeric" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal) || numVal < 0 || numVal > 100) { setSaveError('Enter a number from 0 to 100'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.map((item, itemIdx) => ({ item, itemIdx })).filter(entry => hasVal(entry.item)) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map(({ item, itemIdx }) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = fmtVal(item);
          const itemClinical = parseNestedClinicalLabel(itemStr);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={`${fn}.${itemIdx}`} className={itemClinical.isLabeled ? 'rec-mini-card nested-mini-card' : ''}>
              {itemClinical.isLabeled && <div className="nested-subtitle">{highlightText(itemClinical.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemClinical.value); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = idOf(record); if (!id) return; const exactPath = `${fn}.${itemIdx}`; stageDraft(record, idx, sid, exactPath, itemClinical.rebuild(editValue)); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemClinical.displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const firstParsed = sentences[0] ? parseLabel(sentences[0]) : { isLabeled: false };
    const firstCommaItems = firstParsed.isLabeled ? [] : commaRowsForDisplay(strVal);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1 || firstParsed.isLabeled || firstCommaItems.length >= 3) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card nested-mini-card">
            {!sameAsTitle(label, title) && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              const plainCommaItems = parsed.isLabeled ? [] : commaRowsForDisplay(sentence);
              if (parsed.isLabeled) {
                const commaItems = commaRowsForDisplay(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 3) {
                  return (
                    <div key={sIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciClinical = parseNestedClinicalLabel(ci);
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx} data-edit-field={fn} className={ciClinical.isLabeled ? 'rec-mini-card nested-mini-card' : ''}>
                            {ciClinical.isLabeled && <div className="nested-subtitle">{highlightText(ciClinical.label)}</div>}
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ciClinical.value); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ciClinical.rebuild(subParts[0]), ...subParts.slice(1)); } else { items2[ciIdx] = ciClinical.rebuild(trimmed.replace(/[;.]+$/, '').trim()); } const rebuilt = `${p2.label}: ${items2.join(', ')}`; const fullText2 = replaceSegment(currentVal2, sIdx, rebuilt); setSaveError(null); stageDraft(record, idx, sid, fn, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ciClinical.displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
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

              if (plainCommaItems.length >= 3) {
                return (
                  <React.Fragment key={sIdx}>
                    {plainCommaItems.map((commaItem, commaIndex) => {
                      const commaKey = `${sentenceKey}-u${commaIndex}`;
                      const commaEditing = editingField === commaKey;
                      const commaBadge = editedSentences[commaKey];
                      const commaClinical = parseNestedClinicalLabel(commaItem);
                      return (
                        <div key={commaIndex} data-edit-field={fn} className={commaClinical.isLabeled ? 'rec-mini-card nested-mini-card' : ''}>
                          {commaClinical.isLabeled && <div className="nested-subtitle">{highlightText(commaClinical.label)}</div>}
                          <div className={`numbered-row ${commaBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!commaEditing) { setEditingField(commaKey); setEditValue(commaClinical.value); setSaveError(null); } }}>
                            {commaEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const currentValue = String(getFieldValue(record, fn, idx) || ''); const currentSentences = splitBySentence(currentValue); const currentItems = splitByComma(currentSentences[sIdx] || ''); const trimmed = editValue.trim(); const replacementItems = trimmed.split(/\.\s+/).map(item => item.replace(/[;.]+$/, '').trim()).filter(Boolean); if (replacementItems.length > 1) currentItems.splice(commaIndex, 1, commaClinical.rebuild(replacementItems[0]), ...replacementItems.slice(1)); else currentItems[commaIndex] = commaClinical.rebuild(trimmed); const fullText = replaceSegment(currentValue, sIdx, currentItems.join(', ')); stageDraft(record, idx, sid, fn, fullText); const marks = { [commaKey]: 'edited' }; for (let extraIndex = 1; extraIndex < replacementItems.length; extraIndex += 1) marks[`${sentenceKey}-u${commaIndex + extraIndex}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(commaClinical.displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                                <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(commaItem, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                              </>
                            )}
                          </div>
                          {commaBadge && <span className={`modified-badge ${commaBadge === 'added' ? 'added' : ''}`}>{commaBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} data-edit-field={fn} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, idx, sid, fn, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, title) && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, idx, sid)) return null;
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid);
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
      <div className="rehabilitation-goals-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Rehabilitation Goals</h2></div>
        <div className="empty-state">No rehabilitation goals records available</div>
      </div>
    );
  }

  return (
    <div className="rehabilitation-goals-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Rehabilitation Goals</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RehabilitationGoalsDocumentPDFTemplate document={pdfData} />} fileName="Rehabilitation_Goals.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search rehabilitation goals..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Rehabilitation Goal ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'goal-overview')}
            {renderSection(record, idx, 'timeline')}
            {renderSection(record, idx, 'performance')}
            {renderSection(record, idx, 'therapy')}
            {renderSection(record, idx, 'barriers-facilitators')}
            {renderSection(record, idx, 'patient-involvement')}
            {renderSection(record, idx, 'discharge')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RehabilitationGoalsDocument;
