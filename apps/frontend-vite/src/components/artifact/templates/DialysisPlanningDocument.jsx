/**
 * DialysisPlanningDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dialysis_planning
 *
 * 8 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. modality: modalityPreference, modalityOptions
 *   3. vascular-access: accessPlanning.* (nested dot-notation), accessStatus (recursive object), urgentStartCriteria (array), contraindications (array)
 *   4. education: educationStatus, educationCompleted (bool), educationInitiated.* (nested bools), renalEducationClassDate, dialysisUnitTour.*
 *   5. timeline: estimatedStartDate (date), estimatedTimeToDialysis
 *   6. social-work: socialWorkReferral
 *   7. home-assessment: homeAssessment (recursive object)
 *   8. findings-assessment-plan: findings, assessment, plan, recommendations (array of {recommendation,date}) (hide if empty)
 *   9. notes-section: notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DialysisPlanningDocumentPDFTemplate from '../pdf-templates/DialysisPlanningDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DialysisPlanningDocument.css';
import BlueDatePicker from '../components/BlueDatePicker';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the dotted field path, e.g. "findings" or "accessPlanning.veinMappingStatus") */
const DRAFT_KEY = 'dialysisPlanningPendingEdits';
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
  'session-info': 'Session Information',
  'modality': 'Modality',
  'vascular-access': 'Vascular Access Planning',
  'education': 'Education',
  'timeline': 'Timeline',
  'social-work': 'Social Work',
  'home-assessment': 'Home Assessment',
  'findings-assessment-plan': 'Findings / Assessment / Plan',
  'notes-section': 'Notes',
};

/* humanizeKey: camelCase / snake_case object keys -> Title Case labels */
const KEY_OVERRIDES = { avf: 'AVF', avg: 'AVG', pd: 'PD', cvc: 'CVC', picc: 'PICC', hd: 'HD' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ======= VALUE HELPERS (recursive objects / arrays) ======= */
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  modalityPreference: 'Modality Preference',
  modalityOptions: 'Modality Options',
  'accessPlanning.veinMappingStatus': 'Vein Mapping Status',
  'accessPlanning.vascularSurgeryReferralTiming': 'Vascular Surgery Referral Timing',
  'accessPlanning.protectLeftArm': 'Protect Left Arm',
  'accessPlanning.protectNonDominantArm': 'Protect Non-Dominant Arm',
  'accessPlanning.avoidPICCLines': 'Avoid PICC Lines',
  'accessPlanning.avoidSubclavianAccess': 'Avoid Subclavian Access',
  'accessPlanning.referralToVascularSurgery': 'Referral to Vascular Surgery',
  accessStatus: 'Access Status',
  urgentStartCriteria: 'Urgent Start Criteria',
  contraindications: 'Contraindications',
  homeAssessment: 'Home Assessment',
  recommendations: 'Recommendations',
  educationStatus: 'Education Status',
  educationCompleted: 'Education Completed',
  'educationInitiated.modalityOptionsDiscussed': 'Modality Options Discussed',
  'educationInitiated.referredToRenalEducationClass': 'Referred to Renal Education Class',
  'educationInitiated.tourOfDialysisUnitScheduled': 'Tour of Dialysis Unit Scheduled',
  renalEducationClassDate: 'Renal Education Class Date',
  'dialysisUnitTour.scheduled': 'Tour Scheduled',
  'dialysisUnitTour.status': 'Tour Status',
  estimatedStartDate: 'Estimated Start Date',
  estimatedTimeToDialysis: 'Estimated Time to Dialysis',
  socialWorkReferral: 'Social Work Referral',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'modality': ['modalityPreference', 'modalityOptions'],
  'vascular-access': [
    'accessPlanning.veinMappingStatus',
    'accessPlanning.vascularSurgeryReferralTiming',
    'accessPlanning.protectLeftArm',
    'accessPlanning.protectNonDominantArm',
    'accessPlanning.avoidPICCLines',
    'accessPlanning.avoidSubclavianAccess',
    'accessPlanning.referralToVascularSurgery',
    'accessStatus',
    'urgentStartCriteria',
    'contraindications',
  ],
  'education': [
    'educationStatus',
    'educationCompleted',
    'educationInitiated.modalityOptionsDiscussed',
    'educationInitiated.referredToRenalEducationClass',
    'educationInitiated.tourOfDialysisUnitScheduled',
    'renalEducationClassDate',
    'dialysisUnitTour.scheduled',
    'dialysisUnitTour.status',
  ],
  'timeline': ['estimatedStartDate', 'estimatedTimeToDialysis'],
  'social-work': ['socialWorkReferral'],
  'home-assessment': ['homeAssessment'],
  'findings-assessment-plan': ['findings', 'assessment', 'plan', 'recommendations'],
  'notes-section': ['notes'],
};

const DATE_FIELDS = ['date', 'renalEducationClassDate', 'estimatedStartDate'];
/* ARRAY of strings -> renderArrayField */
const ARRAY_FIELDS = ['urgentStartCriteria', 'contraindications'];
/* OBJECT (recursive) -> renderObjectField */
const OBJECT_FIELDS = ['accessStatus', 'homeAssessment'];
/* ARRAY of {recommendation, date} -> renderRecommendationsField */
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const BOOLEAN_FIELDS = [
  'educationCompleted',
  'accessPlanning.protectLeftArm',
  'accessPlanning.avoidPICCLines',
  'accessPlanning.avoidSubclavianAccess',
  'educationInitiated.modalityOptionsDiscussed',
  'educationInitiated.referredToRenalEducationClass',
  'educationInitiated.tourOfDialysisUnitScheduled',
  'dialysisUnitTour.scheduled',
];
const SENTENCE_FIELDS = ['estimatedTimeToDialysis', 'findings', 'assessment', 'plan', 'notes'];
const HIDE_IF_EMPTY_SECTIONS = ['findings-assessment-plan'];

/* parseLabel: detect "Label: value" patterns. The label char class includes clinical comparators /
   units (< > ~ % + = / &) and the lazy cap is 120 so a long clinical clause like
   "…estimated time to eGFR <15 mL/min (dialysis threshold): approximately…" still splits at its
   colon into a nested-subtitle + value (memory 6a48e3ef — expand parseLabel when label:value renders
   inline). Requires a non-empty value after the colon so a trailing-colon HEADER is NOT matched here. */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
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

/* formatDate: '' for empty AND for the epoch sentinel (1970-01-01 = extractor "unknown date").
   estimatedStartDate is stored as 1970-01-01 when no start date is known → hidden in all 4 areas. */
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    if (d.getUTCFullYear() <= 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Resolve dot-notation field paths from record */
const resolveField = (record, fieldPath) => {
  const parts = fieldPath.split('.');
  let val = record;
  for (const part of parts) {
    if (val == null) return undefined;
    val = val[part];
  }
  return val;
};

/* ======= COMPONENT ======= */
const DialysisPlanningDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fieldPath}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.dialysis_planning) return Array.isArray(r.dialysis_planning) ? r.dialysis_planning : [r.dialysis_planning];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_planning) return Array.isArray(dd.dialysis_planning) ? dd.dialysis_planning : [dd.dialysis_planning]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = safeIdOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // A single edited marker keyed `${fieldPart}-${idx}` satisfies sectionHasEdits for every field type
        // (it matches both `k.startsWith(`${f}-${idx}`)` and the dotted `${f}.`/`-${idx}` form).
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, safeIdOf]);

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  /* searchVal: flatten objects/arrays (incl. recommendations) for search matching */
  const searchVal = useCallback((fn, v) => {
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return (Array.isArray(v) ? v : []).map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
    if (v && typeof v === 'object') return flattenSearchable(v);
    return fmtVal(v);
  }, [fmtVal]);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    /* Source-numbered list ("lead-in: 1. a 2. b 3. c") → split on the "N. " boundaries and DROP the
       source numbers (keeping any lead-in). The JSX must NOT show numbering (one-pass item 3); Copy/PDF
       re-number sequentially. Requires >=2 enumerators so a stray "see item 3." is not mistaken for a list. */
    if ((text.match(/(?:^|\s)\d+\.\s/g) || []).length >= 2) {
      return text.split(/(?:^|\s)\d+\.\s+/).map(s => s.trim()).filter(Boolean);
    }
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

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; }
    const raw = resolveField(record, fn);
    return Array.isArray(raw) ? raw : [];
  }, [localEdits]);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return resolveField(record, fn);
  }, [localEdits]);

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

  /* ======= SEARCH ======= */
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
        if (searchVal(f, val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, searchVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      return searchVal(fn, val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, searchVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dialysis Planning ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && searchVal(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, searchVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            if (!merged[parent]) merged[parent] = { ...(record[parent] || {}) };
            else merged[parent] = { ...merged[parent] };
            merged[parent][child] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= DRAFT STAGING (defer-save-until-approve) =======
     stageDraft writes a pending edit into localEdits + pendingEdits + the edited markers and the
     localStorage draft store. NO DB write happens here — Approve (handleApproveSection) is the only writer.
     fieldPart is the dotted field path (e.g. "findings" or "accessPlanning.veinMappingStatus").
     value is the FULL field value (full text / full array) — exactly what the old code PUT to the DB. */
  const stageDraft = useCallback((record, fieldPart, idx, sid, value, markFields, markSentences) => {
    const rid = safeId(record); if (!rid) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (markFields) setEditedFields(prev => ({ ...prev, ...markFields }));
    if (markSentences) setEditedSentences(prev => ({ ...prev, ...markSentences }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* ======= EDIT HANDLERS ======= */
  // Save = stage a DRAFT locally + localStorage (survives refresh). NOT written to MongoDB and NOT in
  // the PDF until the user clicks Approve (handleApproveSection commits). No DB call here.
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    if (arrayIndex !== undefined && arrayIndex !== null) {
      // Stage the WHOLE updated array under fieldPart=fn (no numeric dot-suffix → approve writes the full array).
      const arr = [...getEffectiveArray(record, fn, idx)]; arr[arrayIndex] = saveVal;
      const trackKey = editTrackingKey || `${fn}-${idx}-ai${arrayIndex}`;
      stageDraft(record, fn, idx, _sid, arr, { [trackKey]: 'edited' });
    } else {
      const trackKey = editTrackingKey || `${fn}-${idx}`;
      stageDraft(record, fn, idx, _sid, saveVal, { [trackKey]: 'edited' });
    }
  }, [editValue, safeId, getEffectiveArray, stageDraft]);

  /* saveLeaf: stage an updated object leaf as a DRAFT (whole root object value). No DB write — Approve commits. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Stage whole root object under fieldPart=rootField → approve writes { field: rootField, value: clone }
    stageDraft(record, rootField, idx, sid, clone, { [leafKeyTrack]: 'edited' });
  }, [safeId, localEdits, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      // Stage DRAFT only — no DB write. Approve commits.
      stageDraft(record, fn, idx, sid, fullText, null, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const marks = {};
    if (changed) marks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    // Stage DRAFT only — no DB write. Approve commits.
    stageDraft(record, fn, idx, sid, fullText, null, marks);
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values
  // flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Pending edit keys for THIS section + record. localEdits keys are `${fieldPart}-${idx}`; the
    // fieldPart is the dotted field path which equals one of this section's field names.
    const suffix = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      return fields.includes(fieldPart);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // dotted field path; possibly "field.<n>"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverse of handleSaveField)
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/dialysis_planning/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/dialysis_planning/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      const rid = safeId(record);
      if (rid && store[rid]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[rid][fp]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DialysisPlanning] Approve error:', err); }
  }, [safeId, localEdits, pendingEdits]);

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
  /* Mirrors the JSX sentence blocks. Every sub-label (a header sentence ending ':' OR a "Label: value"
     clause) gets a '-'.repeat(40) divider under it (one-pass item 2) and RESTARTS the numbering
     (item 3); values under it number 1..N. Values with no preceding sub-label continue their own count. */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let num = 0;
    /* blank line before each sub-label that follows content (visually separates the prior group) */
    const sub = (t) => { if (lines.length) lines.push(''); lines.push(t); lines.push(COPY_LINE_DASH); num = 0; };
    const value = (t) => { lines.push(`${++num}. ${t}`); };
    sentences.forEach(s => {
      if (/:\s*$/.test(s)) { sub(s.replace(/\s*:\s*$/, '')); return; }
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        sub(parsed.label);
        (parts.length >= 2 ? parts : [parsed.value]).forEach(value);
        return;
      }
      const parts = splitByComma(s);
      if (parts.length >= 2) {
        parts.forEach(part => { const pp = parseLabel(part); if (pp.isLabeled) { sub(pp.label); value(pp.value); } else { value(part); } });
        return;
      }
      value(s);
    });
    return lines;
  }, [splitBySentence]);

  /* objectCopyLines: recursive lines for object/array fields */
  const objectCopyLines = useCallback((label, value, indent) => {
    const out = []; const pad = '  '.repeat(indent);
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    const childIndent = indent + (label ? 1 : 0);
    if (Array.isArray(value)) { value.filter(v => !isEmptyDeep(v)).forEach(v => out.push(...objectCopyLines('', v, childIndent))); }
    else Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, childIndent)));
    return out;
  }, []);

  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value row(s).
     NEVER side-by-side "Label: value" (one-pass items 1-3). Single-name fields (label == section
     title, e.g. Notes / Home Assessment) skip the sub-label — the section header carries the name. */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      const singleName = label.toLowerCase() === title.toLowerCase();
      const head = singleName ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        const d = formatDate(val); if (!d) return; // epoch sentinel → skip
        text += `${head}1. ${d}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        text += `${head}1. ${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx); if (arr.length === 0) return;
        text += head;
        arr.forEach((item, i) => { text += `${i + 1}. ${fmtVal(item)}\n`; });
        text += '\n';
      } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const recs = Array.isArray(val) ? val : []; if (recs.length === 0) return;
        text += head;
        recs.forEach((r, i) => { text += `${i + 1}. ${(r?.recommendation || '').trim()}${r?.date ? ` (${r.date})` : ''}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        if (!hasVal(val) || isScalar(val)) return;
        text += head;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; }));
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        if (!hasVal(val)) return;
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatSentenceFieldLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = `Dialysis Planning\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dialysis Planning ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty
        // lines) has no real content — skip it so empty sections don't leak their heading.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD ======= */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    if (!displayVal) return null; // epoch sentinel (1970-01-01) → hide, mirrors copy + PDF
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: BOOLEAN SELECT FIELD ======= */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof val === 'boolean' ? (val ? 'yes' : 'no') : String(val).toLowerCase()); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SIMPLE EDITABLE FIELD ======= */
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SENTENCE EDITABLE — comma-split + parseLabel per part, header grouping ======= */
  /* Each converted sub-label (a header sentence ending ':' OR a "Label: value" clause) OWNS a
     nested-mini-card that wraps the rows it heads (memory 697ba540). Plain rows with no header render
     bare. JSX rows are UNNUMBERED; Copy/PDF re-number. */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    /* Build display CARDS. A card with a `header` = nested-mini-card (sub-label + its rows); a card
       without a header = bare standalone rows. Each row carries an onSave that reconstructs the field. */
    const stage = (sentences2, rKey) => { setSaveError(null); stageDraft(record, fn, idx, sid, reconstructFullText(sentences2), null, { [rKey]: 'edited' }); };
    const cards = [];
    let openHeader = null;
    const addRow = (row) => { if (openHeader) openHeader.rows.push(row); else cards.push({ header: null, key: row.key, rows: [row] }); };

    sentences.forEach((sentence, sIdx) => {
      const sKey = `${fn}-${idx}-s${sIdx}`;
      if (/:\s*$/.test(sentence)) {
        openHeader = { header: sentence.replace(/\s*:\s*$/, ''), key: `${sKey}-h`, rows: [] };
        cards.push(openHeader);
        return;
      }
      const parsed = parseLabel(sentence);
      if (parsed.isLabeled) {
        const items = splitByComma(parsed.value);
        const useItems = items.length >= 2 ? items : [parsed.value];
        const card = { header: parsed.label, key: `${sKey}-lbl`, rows: [] };
        useItems.forEach((it, vIdx) => {
          const rKey = `${sKey}-c${vIdx}`;
          card.rows.push({ key: rKey, shown: it.replace(/[;.]+$/, ''), seed: it.replace(/[;.]+$/, ''),
            onSave: () => { const s2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); const p2 = parseLabel(s2[sIdx] || ''); if (!p2.isLabeled) return; const it2 = splitByComma(p2.value); it2[vIdx] = editValue.trim(); s2[sIdx] = `${p2.label}: ${it2.join(', ')}`; stage(s2, rKey); } });
        });
        cards.push(card);
        openHeader = null;
        return;
      }
      const parts = splitByComma(sentence);
      if (parts.length >= 2) {
        parts.forEach((part, cIdx) => {
          const pp = parseLabel(part);
          const rKey = `${sKey}-c${cIdx}`;
          const onSave = () => { const s2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); const pt2 = splitByComma(s2[sIdx] || ''); pt2[cIdx] = pp.isLabeled ? `${pp.label}: ${editValue.trim()}` : editValue.trim(); s2[sIdx] = pt2.join(', '); stage(s2, rKey); };
          if (pp.isLabeled) {
            cards.push({ header: pp.label, key: `${rKey}-lbl`, rows: [{ key: rKey, shown: pp.value.replace(/[;.]+$/, ''), seed: pp.value.replace(/[;.]+$/, ''), onSave }] });
            openHeader = null;
          } else {
            addRow({ key: rKey, shown: part.replace(/[;.]+$/, ''), seed: part.replace(/[;.]+$/, ''), onSave });
          }
        });
        return;
      }
      const rKey = sKey;
      addRow({ key: rKey, shown: sentence.replace(/[;.]+$/, ''), seed: sentence.replace(/[;.]+$/, ''),
        onSave: () => { const s2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); s2[sIdx] = editValue.trim(); stage(s2, rKey); } });
    });

    const renderRow = (row) => {
      const isEditing = editingField === row.key;
      const badge = editedSentences[row.key];
      if (searchTerm.trim() && !(phraseMatch || labelMatch || row.shown.toLowerCase().includes(searchTerm.toLowerCase().trim()))) return null;
      return (
        <div key={row.key}>
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(row.key); setEditValue(row.seed); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); row.onSave(); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(row.shown)}</span><span className="edit-indicator">&#x270E;</span></div>
                <button className={`copy-btn ${copiedItems[row.key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(row.shown, row.key); }}>{copiedItems[row.key] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    };

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {cards.map(card => (
            card.header ? (
              <div key={card.key} className="nested-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle sub-label">{highlightText(card.header)}</div>
                {card.rows.map(renderRow)}
              </div>
            ) : (
              <React.Fragment key={card.key}>{card.rows.map(renderRow)}</React.Fragment>
            )
          ))}
        </div>
      </div>
    );
  };

  /* ======= RENDER: ARRAY OF STRINGS (editable per item, dotted array-index save) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, ai) => {
          const editKey = `${fn}-${idx}-ai${ai}`;
          const isEditing = editingField === editKey;
          const badge = editedFields[editKey];
          const itemStr = fmtVal(item);
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue.trim(), editKey, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: OBJECT LEAF (editable; bool -> Yes/No select, else textarea) ======= */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(isBool ? (value ? 'yes' : 'no') : leafValueString); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? (editValue === 'yes') : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: OBJECT NODE (recursive) ======= */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (
        <React.Fragment key={path.join('-') || rootField}>
          {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
          <div className="nested-group">
            {items.map((v, i) => (
              isScalar(v) ? renderObjectLeaf(record, rootField, [...path, String(i)], idx, sid, v)
                : <div className="nested-mini-card" key={i}>{renderObjectNode(record, rootField, idx, sid, '', v, [...path, String(i)], depth + 1)}</div>
            ))}
          </div>
        </React.Fragment>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  /* ======= RENDER: OBJECT FIELD (top-level recursive object) ======= */
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

  /* ======= RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ======= */
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
                              setSaveError(null);
                              // Stage DRAFT only — no DB write. Approve commits.
                              stageDraft(record, fn, idx, sid, newArr, null, { [itemKey]: 'edited' });
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#x270E;</span></div>
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

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) {
      // Hide empty sections for findings-assessment-plan
      if (HIDE_IF_EMPTY_SECTIONS.includes(sid)) return null;
      // Still hide if entirely empty
      return null;
    }

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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="dialysis-planning-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dialysis Planning</h2></div>
        <div className="empty-state">No dialysis planning records available</div>
      </div>
    );
  }

  return (
    <div className="dialysis-planning-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dialysis Planning</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DialysisPlanningDocumentPDFTemplate document={pdfData} />} fileName="Dialysis_Planning.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dialysis planning..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {/* Canonical record title only — date renders in the Session Information section */}
              <h3 className="record-name">{highlightText(`Dialysis Planning ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'modality')}
            {renderSection(record, idx, 'vascular-access')}
            {renderSection(record, idx, 'education')}
            {renderSection(record, idx, 'timeline')}
            {renderSection(record, idx, 'social-work')}
            {renderSection(record, idx, 'home-assessment')}
            {renderSection(record, idx, 'findings-assessment-plan')}
            {renderSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DialysisPlanningDocument;
