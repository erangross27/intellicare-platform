/**
 * PediatricVisitsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: pediatric_visits
 *
 * 8 Sections:
 *   1. visit-info: visitDate, age, chiefComplaint
 *   2. developmental-milestones: developmentalMilestones.grossMotor, .fineMotor, .language, .socialEmotional, .cognitive
 *   3. immunization-status: immunizationStatus
 *   4. growth-parameters: growthParameters.height, growthParameters.weight, growthParameters.bmi
 *   5. physical-examination: physicalExamination
 *   6. assessment: assessment
 *   7. plan: plan
 *   8. anticipatory-guidance: anticipatoryGuidance
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PediatricVisitsDocumentPDFTemplate from '../pdf-templates/PediatricVisitsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './PediatricVisitsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, payload, markers... } } }
   where editKey is the file's own "<fn>-<idx>" localEdits key and payload is the EXACT PUT body
   the save would have sent ({ field, value } or { field, value, arrayIndex }). Replaying the stored
   payload on Approve preserves every save handler's exact semantics (dotted fields, array indexes). */
const DRAFT_KEY = 'pediatric_visitsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'developmental-milestones': 'Developmental Milestones',
  'immunization-status': 'Immunization Status',
  'growth-parameters': 'Growth Parameters',
  'physical-examination': 'Physical Examination',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'anticipatory-guidance': 'Anticipatory Guidance',
};

const FIELD_LABELS = {
  visitDate: 'Visit Date',
  age: 'Age',
  chiefComplaint: 'Chief Complaint',
  'developmentalMilestones.grossMotor': 'Gross Motor',
  'developmentalMilestones.fineMotor': 'Fine Motor',
  'developmentalMilestones.language': 'Language',
  'developmentalMilestones.socialEmotional': 'Social/Emotional',
  'developmentalMilestones.cognitive': 'Cognitive',
  immunizationStatus: 'Immunization Status',
  'growthParameters.height': 'Height',
  'growthParameters.weight': 'Weight',
  'growthParameters.bmi': 'BMI',
  physicalExamination: 'Physical Examination',
  assessment: 'Assessment',
  plan: 'Plan',
  anticipatoryGuidance: 'Anticipatory Guidance',
};

const SECTION_FIELDS = {
  'visit-info': ['visitDate', 'age', 'chiefComplaint'],
  'developmental-milestones': ['developmentalMilestones.grossMotor', 'developmentalMilestones.fineMotor', 'developmentalMilestones.language', 'developmentalMilestones.socialEmotional', 'developmentalMilestones.cognitive'],
  'immunization-status': ['immunizationStatus'],
  'growth-parameters': ['growthParameters.height', 'growthParameters.weight', 'growthParameters.bmi'],
  'physical-examination': ['physicalExamination'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'anticipatory-guidance': ['anticipatoryGuidance'],
};

/* dynamic-key sections: edits land under a root prefix (e.g. growthParameters.headCircumference.value-idx) */
const SECTION_DYNAMIC_ROOT = { 'developmental-milestones': 'developmentalMilestones', 'growth-parameters': 'growthParameters' };

/* single-name gate: hide a field label that merely duplicates its own section title (JSX/copy/PDF) */
const showFieldLabel = (label, sid) => String(label).trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();

const DATE_FIELDS = ['visitDate'];
const ARRAY_FIELDS = ['immunizationStatus', 'anticipatoryGuidance'];
const STRING_FIELDS = ['age', 'chiefComplaint', 'developmentalMilestones.grossMotor', 'developmentalMilestones.fineMotor', 'developmentalMilestones.language', 'developmentalMilestones.socialEmotional', 'developmentalMilestones.cognitive', 'growthParameters.height', 'growthParameters.weight', 'growthParameters.bmi', 'physicalExamination', 'assessment', 'plan'];

/* CLAUSE_OPENER: a leading conditional/subordinate clause ("If X: Y") whose colon is grammatical, NOT a data Label:Value */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;

/* parseLabel: detect "Label: value" patterns (skips conditional clauses; strips a leading "N." list marker off the value) */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
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

/* Helper: Extract percentile from a string ("46 inches - 75th percentile") OR an
 * object form { value, percentile } where percentile may be "25th"/"25"/25. */
const extractPercentile = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const p = val.percentile;
    if (p === null || p === undefined || p === '') return extractPercentile(val.value);
    if (typeof p === 'number') return Number.isNaN(p) ? null : p;
    const pm = String(p).match(/(\d+)/);
    return pm ? parseInt(pm[1], 10) : null;
  }
  if (typeof val === 'number') return Number.isNaN(val) ? null : val;
  if (typeof val !== 'string') return null;
  const match = val.match(/(\d+)(?:th|st|nd|rd)\s*percentile/i);
  return match ? parseInt(match[1], 10) : null;
};

/* Helper: Human-readable measurement text for a growth subfield (string OR {value, percentile}) */
const growthMeasurementText = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && !Array.isArray(val)) {
    const v = val.value !== undefined && val.value !== null ? String(val.value) : '';
    const p = val.percentile !== undefined && val.percentile !== null && val.percentile !== '' ? String(val.percentile) : '';
    if (v && p) return `${v} - ${p} percentile`;
    return v || (p ? `${p} percentile` : '');
  }
  return String(val);
};

/* Helper: Get percentile color (PROTECTIVE: higher = better = green) */
const getPercentileColor = (percentile) => {
  if (percentile === null) return '#6b7280';
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#3b82f6';
  if (percentile >= 25) return '#f59e0b';
  return '#ef4444';
};

/* Helper: humanize a camelCase dynamic key -> "Gross Motor" */
const humanizeKey = (key) => {
  if (!key || typeof key !== 'string') return String(key || '');
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/* Helper: Milestone category display names (falls back to humanizeKey for dynamic keys) */
const getMilestoneDisplayName = (key) => {
  const names = { grossMotor: 'Gross Motor', fineMotor: 'Fine Motor', language: 'Language', socialEmotional: 'Social/Emotional', cognitive: 'Cognitive' };
  return names[key] || humanizeKey(key);
};

/* ======= COMPONENT ======= */
const PediatricVisitsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Value = exact PUT
  // payload to replay on Approve. Cleared on Approve. Truthy → kept OUT of pdfData until approved.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.pediatric_visits) return Array.isArray(r.pediatric_visits) ? r.pediatric_visits : [r.pediatric_visits];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pediatric_visits) return Array.isArray(dd.pediatric_visits) ? dd.pediatric_visits : [dd.pediatric_visits]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((draft) => {
        if (!draft || typeof draft !== 'object') return;
        const editKey = `${draft.fn}-${idx}`;
        nLocal[editKey] = draft.value;
        nPending[editKey] = draft.payload || { field: draft.fn, value: draft.value };
        if (draft.fields) Object.keys(draft.fields).forEach(k => { nFields[k.replace(/-\d+$/, `-${idx}`)] = draft.fields[k]; });
        if (draft.sentences) Object.keys(draft.sentences).forEach(k => { nSentences[k.replace(/(-)(\d+)(-s)/, `$1${idx}$3`)] = draft.sentences[k]; });
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getFieldValue: supports dot-path notation for nested fields */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; }
      return val;
    }
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

  /* deepScan: recursively test every primitive in a nested object/array for the phrase */
  const deepScan = useCallback((val, phrase) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.some(v => deepScan(v, phrase));
    if (typeof val === 'object') return Object.values(val).some(v => deepScan(v, phrase));
    return String(val).toLowerCase().includes(phrase);
  }, []);

  /* ======= SEARCH -- 4-LEVEL ======= */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    /* deep-scan dynamic-key objects whose extra keys are not in SECTION_FIELDS */
    if (sid === 'developmental-milestones' && deepScan(getFieldValue(record, 'developmentalMilestones', 0), phrase)) return true;
    if (sid === 'growth-parameters' && deepScan(getFieldValue(record, 'growthParameters', 0), phrase)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') {
          for (const v of Object.values(val)) { if (v && String(v).toLowerCase().includes(phrase)) return true; }
        }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, deepScan]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val) || typeof val === 'object') return deepScan(val, phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, deepScan]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Pediatric Visit ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) || typeof val === 'object' ? deepScan(val, phrase) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      /* dynamic-key objects (extra keys not in SECTION_FIELDS) */
      if (deepScan(getFieldValue(record, 'developmentalMilestones', idx), phrase)) return true;
      if (deepScan(getFieldValue(record, 'growthParameters', idx), phrase)) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, deepScan]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldName = m[1];
          if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]] || typeof merged[parts[0]] !== 'object') merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fieldName] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  /* stageDraft: the single local-staging primitive shared by every save handler. Stages a DRAFT in
     localEdits + pendingEdits (value + exact PUT payload) and the localStorage draft store; sets the
     edited/sentence markers the caller already used; and (re-edit after approval) drops the section's
     approved flag so the button returns to yellow Pending Approve. NO DB write happens here.
     The stored payload is replayed verbatim by handleApproveSection — the ONLY DB writer. */
  const stageDraft = useCallback((record, fn, idx, value, payload, { fields = {}, sentences = {} } = {}) => {
    const id = safeId(record); if (!id) return false;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: payload }));
    if (Object.keys(fields).length) setEditedFields(prev => ({ ...prev, ...fields }));
    if (Object.keys(sentences).length) setEditedSentences(prev => ({ ...prev, ...sentences }));
    // Re-edit after approval → drop the approved flag for any section this field belongs to.
    setApprovedSections(prev => {
      const next = { ...prev }; let changed = false;
      Object.entries(SECTION_FIELDS).forEach(([sid, sfields]) => {
        const root = SECTION_DYNAMIC_ROOT[sid];
        const belongs = sfields.includes(fn) || (root && fn.startsWith(`${root}.`));
        if (belongs && next[`${sid}-${idx}`]) { delete next[`${sid}-${idx}`]; changed = true; }
      });
      return changed ? next : prev;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = { fn, value, payload, fields, sentences };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
    return true;
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, fn, idx, saveVal, { field: fn, value: saveVal }, { fields: { [trackKey]: 'edited' } });
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
      // Stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      stageDraft(record, fn, idx, fullText, { field: fn, value: fullText }, { sentences: { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' } });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const sentMarks = {};
    if (changed) sentMarks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) sentMarks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    // Stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, fullText, { field: fn, value: fullText }, { sentences: sentMarks });
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const root = SECTION_DYNAMIC_ROOT[sid];
    const rootMatch = (k) => root && k.startsWith(`${root}.`) && k.endsWith(`-${idx}`);
    return Object.keys(editedFields).some(k => rootMatch(k)) ||
      Object.keys(editedSentences).some(k => rootMatch(k)) ||
      fields.some(f =>
        Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
        Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
      );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section/record to MongoDB by replaying each stored
  // PUT payload, then flag the section approved, then clear pending so the committed values now flow
  // into pdfData/PDF and drop this record's drafts from localStorage. The ONLY path that writes to DB.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const root = SECTION_DYNAMIC_ROOT[sid];
    const suffix = `-${idx}`;
    // Collect this record's pending editKeys ("<fn>-<idx>") that belong to THIS section.
    const belongsToSection = (fn) => fields.includes(fn) || (root && fn.startsWith(`${root}.`));
    const toCommit = Object.keys(pendingEdits).filter(k => {
      if (!k.endsWith(suffix)) return false;
      const fn = k.slice(0, -suffix.length);
      return belongsToSection(fn);
    });
    setSaving(true); setSaveError(null);
    try {
      // Persist each staged field to the DB now by replaying its exact stored PUT payload.
      for (const editKey of toCommit) {
        const payload = pendingEdits[editKey];
        if (!payload || typeof payload !== 'object') continue;
        await secureApiClient.put(`/api/edit/pediatric_visits/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/pediatric_visits/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { delete store[id][k]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const rootMatch = (k) => root && k.startsWith(`${root}.`) && k.endsWith(`-${idx}`);
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (rootMatch(k)) { delete n[k]; return; } fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (rootMatch(k)) { delete n[k]; return; } fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[PediatricVisits] Approve error:', err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY ======= */
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
    let text = `${title}\n${'='.repeat(40)}\n\n`;

    /* Developmental Milestones: dynamic keys, string OR array subfields */
    if (sid === 'developmental-milestones') {
      const dm = getFieldValue(record, 'developmentalMilestones', idx);
      if (dm && typeof dm === 'object') {
        const known = ['grossMotor', 'fineMotor', 'language', 'socialEmotional', 'cognitive'];
        const keys = [...known.filter(k => k in dm), ...Object.keys(dm).filter(k => !known.includes(k))];
        keys.forEach(k => {
          const v = dm[k];
          if (!hasVal(v)) return;
          const label = getMilestoneDisplayName(k);
          if (Array.isArray(v)) {
            text += `${label}\n${v.filter(Boolean).map((it, i) => `${i + 1}. ${it}`).join('\n')}\n\n`;
          } else {
            const sentences = splitBySentence(fmtVal(v));
            if (sentences.length > 1) { text += `${label}\n`; formatSentenceFieldLines(fmtVal(v)).forEach(l => { text += `${l}\n`; }); text += '\n'; }
            else { text += `${label}\n${fmtVal(v)}\n\n`; }
          }
        });
      }
      return text;
    }

    /* Growth Parameters: dynamic keys, string OR {value, percentile} object subfields */
    if (sid === 'growth-parameters') {
      const gp = getFieldValue(record, 'growthParameters', idx);
      if (gp && typeof gp === 'object') {
        const known = ['height', 'weight', 'bmi'];
        const keys = [...known.filter(k => k in gp), ...Object.keys(gp).filter(k => !known.includes(k))];
        keys.forEach(k => {
          const v = gp[k];
          if (!hasVal(v)) return;
          const label = { height: 'Height', weight: 'Weight', bmi: 'BMI' }[k] || humanizeKey(k);
          text += `${label}\n${growthMeasurementText(v)}\n\n`;
        });
      }
      return text;
    }

    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      /* single-name gate: a field label that duplicates the section title is suppressed in Copy too */
      const head = showFieldLabel(label, sid) ? `${label}\n` : '';
      if (DATE_FIELDS.includes(f)) {
        text += `${head}${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${head}${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          text += head;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${head}${strVal}\n\n`;
        }
      } else {
        text += `${head}${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PEDIATRIC VISITS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Pediatric Visit ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD (BlueDatePicker) ======= */
  const isEpochSentinel = (v) => { try { const d = new Date(v?.$date || v); return !isNaN(d.getTime()) && d.getFullYear() === 1970; } catch { return false; } };
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isEpochSentinel(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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

  /* ======= RENDER: ARRAY FIELD (per-item editing with dot-path keys) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showFieldLabel(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          const parsed = parseLabel(itemStr);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              {parsed.isLabeled && <div className="nested-subtitle" style={{ fontSize: 15, marginTop: 4 }}>{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const trimmed = editValue.trim(); const saveValue = trimmed; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = saveValue; /* Stage DRAFT (no DB write); Approve replays this payload. */ stageDraft(record, fn, idx, currentArr, { field: fn, value: saveValue, arrayIndex: itemIdx }, { fields: { [editKey]: 'edited' } }); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showFieldLabel(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; /* Stage DRAFT (no DB write); Approve replays this payload. */ stageDraft(record, fn, idx, fullText2, { field: fn, value: fullText2 }, { sentences: marks }); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
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
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; /* Stage DRAFT (no DB write); Approve replays this payload. */ stageDraft(record, fn, idx, fullText, { field: fn, value: fullText }, { sentences: marks }); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      <div key={fn} className="rec-mini-card">
        {showFieldLabel(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ======= RENDER: GROWTH OBJECT SUBFIELD ({value, percentile}) — per-subfield editable rows ======= */
  /* Preserves the nested object shape: saves growthParameters.<key>.value / .percentile via dot-path. */
  const renderGrowthObjectField = (record, fn, idx, sid, label) => {
    const obj = getFieldValue(record, fn, idx);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    /* known sub-props first (value, percentile), then any extras */
    const known = ['value', 'percentile'];
    const subKeys = [...known.filter(k => k in obj), ...Object.keys(obj).filter(k => !known.includes(k))];
    const subLabels = { value: 'Measurement', percentile: 'Percentile' };

    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {subKeys.map(sk => {
          const subVal = obj[sk];
          if (!hasVal(subVal)) return null;
          const subFn = `${fn}.${sk}`;
          const editKey = `${subFn}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const subStr = fmtVal(subVal);
          const subLabel = subLabels[sk] || humanizeKey(sk);
          return (
            <div key={sk}>
              <div className="nested-subtitle" style={{ fontSize: 15, marginTop: 4 }}>{highlightText(subLabel)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(subStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const saveValue = editValue.trim(); const curObj = { ...(getFieldValue(record, fn, idx) || {}), [sk]: saveValue }; /* Stage DRAFT (no DB write); Approve replays the subfield payload (field=subFn). localEdits key stays the parent fn so the merged object shape is preserved. */ stageDraft(record, fn, idx, curObj, { field: subFn, value: saveValue }, { fields: { [editKey]: 'edited' } }); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(subStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${subStr}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: GROWTH PARAMETERS with Bar Chart (dynamic keys, string OR object subfields) ======= */
  const renderGrowthSection = (record, idx) => {
    const sid = 'growth-parameters';
    if (!shouldShowSection(record, sid)) return null;
    const gp = record.growthParameters;
    if (!gp || typeof gp !== 'object') return null;

    /* Dynamic: known params first, then any extra keys (headCircumference, birthWeight, length, etc.) */
    const known = ['height', 'weight', 'bmi'];
    const keys = [...known.filter(k => k in gp), ...Object.keys(gp).filter(k => !known.includes(k))];
    if (!keys.some(k => hasVal(getFieldValue(record, `growthParameters.${k}`, idx)))) return null;

    /* Build chart bars from any subfield that yields a percentile */
    const bars = keys
      .map(k => ({ key: k, val: getFieldValue(record, `growthParameters.${k}`, idx) }))
      .filter(b => hasVal(b.val))
      .map(b => ({ ...b, percentile: extractPercentile(b.val), text: growthMeasurementText(b.val) }))
      .filter(b => b.percentile !== null);

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Growth Parameters')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {bars.length > 0 && (
            <div className="chart-container">
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>75th+ percentile</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>50-74th percentile</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>25-49th percentile</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>Below 25th</span>
              </div>
              {bars.map(bar => (
                <div className="bar-chart-row" key={bar.key}>
                  <div className="bar-label">{highlightText(humanizeKey(bar.key))}</div>
                  <div className="bar-container">
                    <div className="bar-background">
                      <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, bar.percentile))}%`, backgroundColor: getPercentileColor(bar.percentile) }} />
                    </div>
                    <span className="bar-value" style={{ color: getPercentileColor(bar.percentile) }}>{bar.percentile}th</span>
                  </div>
                  <div className="bar-measurement">{highlightText(bar.text)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Editable fields for every growth key (string OR {value, percentile} object) */}
          {keys.map(k => {
            const fn = `growthParameters.${k}`;
            const val = getFieldValue(record, fn, idx);
            if (!hasVal(val)) return null;
            const label = { height: 'Height', weight: 'Weight', bmi: 'BMI' }[k] || humanizeKey(k);
            if (val && typeof val === 'object' && !Array.isArray(val)) return renderGrowthObjectField(record, fn, idx, sid, label);
            return renderStringField(record, fn, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: MILESTONE ARRAY SUBFIELD (per-item editing, preserves array shape) ======= */
  /* For developmentalMilestones.<cat> when the value is an array of strings. */
  const renderMilestoneArray = (record, fn, idx, label) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          if (searchTerm.trim() && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const saveValue = editValue.trim(); const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; cur[itemIdx] = saveValue; /* Stage DRAFT (no DB write); Approve replays this payload. */ stageDraft(record, fn, idx, cur, { field: fn, value: saveValue, arrayIndex: itemIdx }, { fields: { [editKey]: 'edited' } }); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: DEVELOPMENTAL MILESTONES (dynamic keys, string OR array subfields) ======= */
  const renderDevelopmentalSection = (record, idx) => {
    const sid = 'developmental-milestones';
    if (!shouldShowSection(record, sid)) return null;
    const dm = record.developmentalMilestones;
    if (!dm || typeof dm !== 'object') return null;

    /* Dynamic: known categories first (stable order), then any extra keys present (e.g. concerns) */
    const known = ['grossMotor', 'fineMotor', 'language', 'socialEmotional', 'cognitive'];
    const extra = Object.keys(dm).filter(k => !known.includes(k));
    const categories = [...known.filter(k => k in dm), ...extra];
    const hasAny = categories.some(cat => hasVal(getFieldValue(record, `developmentalMilestones.${cat}`, idx)));
    if (!hasAny) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Developmental Milestones')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {categories.map(cat => {
            const fn = `developmentalMilestones.${cat}`;
            const val = getFieldValue(record, fn, idx);
            if (!hasVal(val)) return null;
            const label = getMilestoneDisplayName(cat);
            if (Array.isArray(val)) return renderMilestoneArray(record, fn, idx, label);
            return renderStringField(record, fn, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: GENERIC SECTION ======= */
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="pediatric-visits-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Pediatric Visits</h2></div>
        <div className="empty-state">No pediatric visit records available</div>
      </div>
    );
  }

  return (
    <div className="pediatric-visits-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Pediatric Visits</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PediatricVisitsDocumentPDFTemplate document={pdfData} />} fileName="Pediatric_Visits.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search pediatric visits..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Pediatric Visit ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'visit-info')}
            {renderDevelopmentalSection(record, idx)}
            {renderSection(record, idx, 'immunization-status')}
            {renderGrowthSection(record, idx)}
            {renderSection(record, idx, 'physical-examination')}
            {renderSection(record, idx, 'assessment')}
            {renderSection(record, idx, 'plan')}
            {renderSection(record, idx, 'anticipatory-guidance')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PediatricVisitsDocument;
