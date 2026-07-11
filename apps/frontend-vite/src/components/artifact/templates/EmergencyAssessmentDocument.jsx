/**
 * EmergencyAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: emergency_assessment
 *
 * 10 Sections:
 *   1. session-info: date (date picker), provider, facility, status
 *   2. triage-arrival: triageLevel, arrivalMode, chiefComplaintDuration
 *   3. primary-survey: primarySurvey.airway, .breathing, .circulation, .disability, .exposure
 *   4. trauma-assessment: traumaAssessment (dynamic keys)
 *   5. resuscitation-info: resuscitation.ivAccess, .fluids[], .medications[], .procedures[]
 *   6. disposition-info: disposition.outcome, disposition.admitTo
 *   7. results-section: results (recursive OBJECT)
 *   8. findings-section: findings (sentence)
 *   9. assessment-section: assessment (sentence)
 *  10. plan-section: plan (sentence)
 *  11. recommendations-section: recommendations (ARRAY of {recommendation, date}, date-grouped)
 *  12. notes-section: notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EmergencyAssessmentDocumentPDFTemplate from '../pdf-templates/EmergencyAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './EmergencyAssessmentDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'triage-arrival': 'Triage & Arrival',
  'primary-survey': 'Primary Survey',
  'trauma-assessment': 'Trauma Assessment',
  'resuscitation-info': 'Resuscitation',
  'disposition-info': 'Disposition',
  'results-section': 'Results',
  'findings-section': 'Findings',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  triageLevel: 'Triage Level',
  arrivalMode: 'Arrival Mode',
  chiefComplaintDuration: 'Chief Complaint Duration',
  'primarySurvey.airway': 'Airway',
  'primarySurvey.breathing': 'Breathing',
  'primarySurvey.circulation': 'Circulation',
  'primarySurvey.disability': 'Disability',
  'primarySurvey.exposure': 'Exposure',
  'resuscitation.ivAccess': 'IV Access',
  'resuscitation.fluids': 'Fluids',
  'resuscitation.medications': 'Medications',
  'resuscitation.procedures': 'Procedures',
  'disposition.outcome': 'Outcome',
  'disposition.admitTo': 'Admit To',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'triage-arrival': ['triageLevel', 'arrivalMode', 'chiefComplaintDuration'],
  'primary-survey': ['primarySurvey.airway', 'primarySurvey.breathing', 'primarySurvey.circulation', 'primarySurvey.disability', 'primarySurvey.exposure'],
  'trauma-assessment': ['_traumaDynamic'],
  'resuscitation-info': ['resuscitation.ivAccess', 'resuscitation.fluids', 'resuscitation.medications', 'resuscitation.procedures'],
  'disposition-info': ['disposition.outcome', 'disposition.admitTo'],
  'results-section': ['results'],
  'findings-section': ['findings'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
// Impression/narrative fields kept WHOLE — their unlabeled commas are sub-lists, not separate
// items (Findings "ST elevation in II, III, aVF" — II/III/aVF are ECG leads that shatter into
// meaningless standalone rows). Plan/Notes are action lists and still comma-split.
const WHOLE_UNLABELED_FIELDS = new Set(['findings']);
const DATE_FIELDS = ['date'];
const NESTED_ARRAY_FIELDS = ['resuscitation.fluids', 'resuscitation.medications', 'resuscitation.procedures'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* Fixed-choice clinical fields → BlueSelect (case-insensitive per memory 6a4b38d2: no duplicate
   option; an off-scale stored value is kept via enumOptionsWith). NOTE: `status` is deliberately NOT
   an enum — this collection stores free-text clinical states ('Stabilized but critical' / 'Complete'),
   so it stays a plain text field. */
const ENUM_OPTIONS = {
  triageLevel: ['ESI Level 1 (Resuscitation)', 'ESI Level 2 (Emergent)', 'ESI Level 3 (Urgent)', 'ESI Level 4 (Less Urgent)', 'ESI Level 5 (Non-Urgent)'],
  arrivalMode: ['EMS/Ambulance', 'Ambulatory / Walk-in', 'Private Vehicle', 'Wheelchair', 'Helicopter', 'Police', 'Public Transport', 'Air Transport'],
};
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };
const enumOptionsWith = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; return base.some(o => o.toLowerCase() === String(cur ?? '').toLowerCase()) ? base : (cur ? [cur, ...base] : base); };

/* Canonical Copy dividers (memory 6a45e766 item 2): EQ under section titles, DASH under field labels. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ OBJECT / RECURSIVE VALUE HELPERS (donor: PointOfCareUltrasoundHeartRateDocument) ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const recsToText = (recs) => (Array.isArray(recs) ? recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ') : '');

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (text[i + 1] && text[i + 1] !== ' ') { current += ch; continue; }                 // no-space comma (2,024 / $18,000)
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }                           // ", and/or …" Oxford tail
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }                      // "… and/or ,"
      if (/\d\s*$/.test(current) && /^\d{4}\b/.test(rest)) { current += ch; continue; }       // date "Month D, YYYY"
      const t = current.trim(); if (t) result.push(t); current = '';
    }
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

const safeArray = (val) => (Array.isArray(val) ? val.filter(Boolean) : []);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection).
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, field, arrayIndex? } } }  — we store the exact DB
   payload each save would have made (value here is the localEdits override; field/arrayIndex are
   what gets PUT on Approve), keyed by the file's own editKey so rehydrate + commit are unambiguous. */
const DRAFT_KEY = 'emergency_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
// DO NOT TOUCH these props - AIDocumentRenderer passes all 3: document, data, templateData
// Different code paths use different prop names. Keep ALL of them or template breaks (white page).
const EmergencyAssessmentDocument = ({ document: docProp }) => {
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
      if (r?.emergency_assessment) return Array.isArray(r.emergency_assessment) ? r.emergency_assessment : [r.emergency_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_assessment) return Array.isArray(dd.emergency_assessment) ? dd.emergency_assessment : [dd.emergency_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     The draft store keys each edit by the file's own editKey and records which marker map it belongs to
     (editedFields vs editedSentences) so the visual "edited" state is restored exactly. */
  const safeIdStatic = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nApproved = {};
    records.forEach((record, idx) => {
      const rid = safeIdStatic(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        // localKey: where the override actually lives (object-leaf stores the whole cloned root under rootKey)
        const localKey = entry.localKey || editKey;
        nLocal[localKey] = entry.value;
        nPending[localKey] = true;
        if (entry.track === 'sentence') {
          if (entry.extraMarkers && typeof entry.extraMarkers === 'object') Object.assign(nSentences, entry.extraMarkers);
          else nSentences[editKey] = entry.badge || 'edited';
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
    setApprovedSections(prev => ({ ...prev, ...nApproved }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0; if (typeof v === 'object') return !isEmptyDeep(v); return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (OBJECT_ARRAY_FIELDS.includes(f)) return recsToText(val);
    if (OBJECT_FIELDS.includes(f)) return flattenSearchable(val);
    if (Array.isArray(val)) return val.map(x => fmtVal(x)).join(' ');
    return fmtVal(val);
  }, [fmtVal]);

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

  /** Resolve a field value, supporting dot-notation for nested objects */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
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
      if (f === '_traumaDynamic') {
        const ta = record.traumaAssessment;
        if (ta && typeof ta === 'object') {
          for (const [k, v] of Object.entries(ta)) {
            if (k === '_id') continue;
            const kl = k.replace(/([A-Z])/g, ' $1').toLowerCase();
            if (kl.includes(phrase) || String(v || '').toLowerCase().includes(phrase)) return true;
          }
        }
        continue;
      }
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f)) {
          if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        } else if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (OBJECT_FIELDS.includes(fn) || OBJECT_ARRAY_FIELDS.includes(fn)) {
        return fieldSearchText(fn, val).toLowerCase().includes(phrase);
      }
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Emergency Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (f === '_traumaDynamic') {
            const ta = record.traumaAssessment;
            if (ta && typeof ta === 'object') {
              for (const [k, v] of Object.entries(ta)) {
                if (k === '_id') continue;
                if (String(v || '').toLowerCase().includes(phrase)) return true;
              }
            }
            continue;
          }
          const val = getFieldValue(record, f, idx);
          if (val && (OBJECT_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f))) {
            if (fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
          } else if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 1) {
            // top-level: scalar, OBJECT (results clone), or recommendations array
            merged[fieldPath] = localEdits[key];
          } else {
            // nested dot path — deep clone + set (primarySurvey.airway, results.a.b, ...)
            const root = dotParts[0];
            const base = merged[root] !== undefined ? merged[root] : record[root];
            const clone = base && typeof base === 'object' ? JSON.parse(JSON.stringify(base)) : {};
            let node = clone;
            for (let i = 1; i < dotParts.length - 1; i++) {
              if (!node[dotParts[i]] || typeof node[dotParts[i]] !== 'object') node[dotParts[i]] = {};
              node = node[dotParts[i]];
            }
            node[dotParts[dotParts.length - 1]] = localEdits[key];
            merged[root] = clone;
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft = the ONLY thing a Save does now. It stages a DRAFT locally (localEdits override +
     pendingEdits flag + the edited/sentence marker the old handler set + clears the section's
     approvedSections key so re-edit returns to yellow Pending Approve) and writes it to the
     pending-drafts localStorage store (survives refresh). NO backend call / NO DB write on save.
     dbPayload is the EXACT { field, value, arrayIndex? } the old handler PUT — replayed on Approve.
     localValue is what localEdits[editKey] should hold (may differ from dbPayload.value for
     object-leaf / array fields where localEdits stores the whole cloned root). */
  const stageDraft = useCallback((record, editKey, sid, idx, localValue, marker, dbPayload) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (marker === 'sentence' || marker === 'sentence-added') {
      setEditedSentences(prev => ({ ...prev, [editKey]: marker === 'sentence-added' ? 'added' : 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    if (sid != null) {
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][editKey] = { value: localValue, field: dbPayload.field, track: (marker === 'sentence' || marker === 'sentence-added') ? 'sentence' : 'field', badge: marker === 'sentence-added' ? 'added' : 'edited' };
    if (dbPayload.arrayIndex !== undefined) store[id][editKey].arrayIndex = dbPayload.arrayIndex;
    if (dbPayload.value !== undefined) store[id][editKey].dbValue = dbPayload.value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, trackKey, sid, idx, saveVal, 'field', { field: fn, value: saveVal });
  }, [editValue, safeId, stageDraft]);

  /** Save an item in a nested array (resuscitation.fluids, etc.) — staged as a DRAFT (no DB write). */
  const handleSaveNestedArrayItem = useCallback((record, parentField, arrField, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    const field = `${parentField}.${arrField}`;
    const editKey = `${field}.${arrIdx}-${idx}`;
    stageDraft(record, editKey, null, idx, value, 'field', { field, value, arrayIndex: arrIdx });
  }, [safeId, stageDraft]);

  /** Save a nested OBJECT leaf by dot-path (e.g. results.ef) — staged as a DRAFT (no DB write).
     localEdits stores the WHOLE cloned root object under `${rootField}-${idx}` (gated by pendingEdits
     on that key so pdfData skips it). The visual marker lives on leafKeyTrack. The exact dotted-field
     DB PUT this would have made is recorded in the draft store under leafKeyTrack for replay on Approve. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const rootKey = `${rootField}-${idx}`;
    setLocalEdits(prev => {
      const cur = prev[rootKey] !== undefined ? prev[rootKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      // Persist the staged cloned root into the draft store (so refresh repopulates the localEdits override)
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][leafKeyTrack] = { value: clone, localKey: rootKey, field: dottedField, dbValue: newVal, track: 'field', badge: 'edited' };
      writeDrafts(store);
      return { ...prev, [rootKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [rootKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* stageSentenceDraft = stage a full-text sentence-field DRAFT (no DB write). localEdits lives under
     `${fn}-${idx}` (gated by pendingEdits); the visual marker(s) live on sentence keys. The exact
     { field: fn, value: fullText } PUT is recorded under the primary sentence key for replay on Approve. */
  const stageSentenceDraft = useCallback((record, fn, idx, fullText, markerKeys) => {
    const id = safeId(record); if (!id) return;
    const rootKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [rootKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [rootKey]: true }));
    setEditedSentences(prev => ({ ...prev, ...markerKeys }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    const primaryKey = Object.keys(markerKeys)[0] || rootKey;
    store[id][primaryKey] = { value: fullText, localKey: rootKey, field: fn, dbValue: fullText, track: 'sentence', badge: markerKeys[primaryKey] || 'edited', extraMarkers: markerKeys };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const markers = {};
    if (changed) markers[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) markers[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    if (Object.keys(markers).length === 0) markers[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    stageSentenceDraft(record, fn, idx, fullText, markers);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  /* Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
     values now flow into pdfData/PDF. This is the ONLY path that writes to the database. */
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Does an editKey belong to this section? (mirror of sectionHasEdits' field→key matching,
    // incl. the dynamic trauma keys whose base field is "traumaAssessment".)
    const keyInSection = (editKey) => fields.some(f => {
      const base = f === '_traumaDynamic' ? 'traumaAssessment' : f;
      return editKey.startsWith(`${base}-${idx}`) || editKey.startsWith(`${base}-${idx}-`) ||
             (editKey.startsWith(`${base}.`) && editKey.endsWith(`-${idx}`));
    });
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedLocalKeys = new Set();
      const committedDraftKeys = [];
      for (const [editKey, entry] of Object.entries(recDrafts)) {
        if (!entry || typeof entry !== 'object') continue;
        if (!keyInSection(editKey)) continue;
        const payload = { field: entry.field, value: entry.dbValue !== undefined ? entry.dbValue : entry.value };
        // arrayIndex ONLY for nested-array element saves (purely-numeric trailing index) — stored explicitly.
        if (entry.arrayIndex !== undefined) payload.arrayIndex = entry.arrayIndex;
        const resp = await secureApiClient.put(`/api/edit/emergency_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedLocalKeys.add(entry.localKey || editKey);
        committedDraftKeys.push(editKey);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/emergency_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      committedDraftKeys.forEach(k => { delete recDrafts[k]; });
      if (Object.keys(recDrafts).length === 0) delete store[id]; else store[id] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { const base = f === '_traumaDynamic' ? 'traumaAssessment' : f; if (k.startsWith(`${base}-${idx}`) || (k.startsWith(`${base}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { const base = f === '_traumaDynamic' ? 'traumaAssessment' : f; if (k.startsWith(`${base}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EmergencyAssessment] Approve error:', err); }
  }, [safeId]);

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
  const keyToLabel = useCallback((key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(), []);

  const formatSentenceFieldLines = useCallback((text, fn) => {
    const sentences = splitBySentence(text);
    const whole = WHOLE_UNLABELED_FIELDS.has(fn);
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
        const parts = whole ? [] : splitByComma(String(s).replace(/[;.]+$/, '').trim());
        if (parts.length >= 2) parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        else lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  /* recursive canonical copy lines for an OBJECT leaf/node (results): each key on its own line +
     DASH divider + numbered value (NEVER 'key: value' side-by-side). */
  const objectCopyLines = useCallback((label, value, depth) => {
    if (isScalar(value)) return [`${label}`, COPY_LINE_DASH, `1. ${fmtScalar(value)}`, ''];
    const lines = [`${label}`, COPY_LINE_DASH];
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      objectCopyLines(humanizeKey(k), v, depth + 1).forEach(l => lines.push(l));
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    const sameAsTitle = (lbl) => String(lbl).trim().toLowerCase() === (title || '').trim().toLowerCase();
    let body = '';
    fields.forEach(f => {
      if (f === '_traumaDynamic') {
        const ta = record.traumaAssessment;
        if (ta && typeof ta === 'object') {
          Object.entries(ta).filter(([k]) => k !== '_id').forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') body += `${keyToLabel(k)}\n${COPY_LINE_DASH}\n1. ${v}\n\n`;
          });
        }
        return;
      }
      if (NESTED_ARRAY_FIELDS.includes(f)) {
        const label = FIELD_LABELS[f] || f;
        const arr = safeArray(getFieldValue(record, f, idx));
        if (arr.length > 0) {
          body += `${label}\n${COPY_LINE_DASH}\n`;
          arr.forEach((item, i) => { body += `${i + 1}. ${item}\n`; });
          body += '\n';
        }
        return;
      }
      const labelEarly = FIELD_LABELS[f] || f;
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
        if (recs.length === 0) return;
        if (!sameAsTitle(labelEarly)) body += `${labelEarly}\n${COPY_LINE_DASH}\n`;
        let lastDate = null; let n = 1;
        recs.forEach((r) => {
          const rec = (r?.recommendation || '').trim();
          const date = (r?.date || '').trim();
          if (date !== lastDate) { if (date) body += `${date}\n`; lastDate = date; n = 1; }
          body += `${n++}. ${rec}\n`;
        });
        body += '\n';
        return;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val) || isScalar(val)) return;
        if (!sameAsTitle(labelEarly)) body += `${labelEarly}\n${COPY_LINE_DASH}\n`;
        Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { body += `${l}\n`; }));
        body += '\n';
        return;
      }
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const head = sameAsTitle(label) ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (ENUM_FIELDS.includes(f)) {
        body += `${head}1. ${enumCanonical(f, fmtVal(val))}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        body += head;
        formatSentenceFieldLines(fmtVal(val), f).forEach(l => { body += `${l}\n`; });
        body += '\n';
      } else {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, keyToLabel, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EMERGENCY ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Emergency Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso || '')} />
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = enumCanonical(fn, fmtVal(val));
    const opts = enumOptionsWith(fn, displayVal);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue || displayVal} options={opts} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue || displayVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NESTED ARRAY FIELD (resuscitation.fluids, .medications, .procedures) ═══════ */
  const renderNestedArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const arr = safeArray(val);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const parts = fn.split('.');
    const parentField = parts[0];
    const arrField = parts[1];
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          // Check for local edit override
          const itemEditKey = `${fn}.${arrIdx}-${idx}`;
          const displayItem = localEdits[itemEditKey] !== undefined ? localEdits[itemEditKey] : item;
          const isEditing = editingField === itemEditKey;
          const isModified = editedFields[itemEditKey];

          if (searchTerm.trim() && !phraseMatch && !String(displayItem).toLowerCase().includes(searchTerm.toLowerCase().trim()) && !label.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemEditKey); setEditValue(String(displayItem)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveNestedArrayItem(record, parentField, arrField, idx, arrIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(String(displayItem))}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(displayItem), itemEditKey); }}>{copiedItems[itemEditKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: TRAUMA ASSESSMENT (dynamic keys) ═══════ */
  const renderTraumaSection = (record, idx, sid) => {
    const ta = record.traumaAssessment;
    if (!ta || typeof ta !== 'object') return null;
    const entries = Object.entries(ta).filter(([k, v]) => k !== '_id' && v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return entries.map(([key, value], ei) => {
      const dotField = `traumaAssessment.${key}`;
      const editKey = `${dotField}-${idx}`;
      const isEditing = editingField === editKey;
      const displayVal = localEdits[editKey] !== undefined ? localEdits[editKey] : String(value);
      const isModified = editedFields[editKey];
      const lbl = keyToLabel(key);

      if (searchTerm.trim() && !phraseMatch && !lbl.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !displayVal.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

      return (
        <div key={key} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(lbl)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, dotField, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${lbl}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageSentenceDraft(record, fn, idx, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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

            /* UNLABELED sentence that is a comma list → split into per-comma editable rows
               (guarded: never inside (), never around and/or, keeps no-space + date commas). */
            if (!parsed.isLabeled && !WHOLE_UNLABELED_FIELDS.has(fn)) {
              const commaItems = splitByComma(sentence.replace(/[;.]+$/, '').trim());
              if (commaItems.length >= 2) {
                return (
                  <React.Fragment key={sIdx}>
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const items2 = splitByComma(String(sentences2[sIdx] || '').replace(/[;.]+$/, '').trim()); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (!trimmed) { items2.splice(ciIdx, 1); } else if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const allS = [...sentences2]; allS[sIdx] = items2.join(', '); const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageSentenceDraft(record, fn, idx, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                  </React.Fragment>
                );
              }
            }

            /* Regular sentence row -- with nested subtitle if labeled */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageSentenceDraft(record, fn, idx, fullText, marks); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, ratio -> text, bool -> select) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'Yes' : 'No') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              ) : (ratio || nu) ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); let n = (parseFloat(editValue) || 0) - (dec ? 0.1 : 1); if (n < 0) n = 0; setEditValue(String(Math.round(n * 100) / 100)); }}>−</button>
                  <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} autoFocus onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); const n = (parseFloat(editValue) || 0) + (dec ? 0.1 : 1); setEditValue(String(Math.round(n * 100) / 100)); }}>+</button>
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
                    newVal = /^yes$/i.test(editValue);
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
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: OBJECT FIELD (results — recursive key-value) ═══════ */
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
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
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
                              // Stage a DRAFT (no DB write). localEdits[`${fn}-${idx}`] holds the whole array (gated by pendingEdits).
                              stageSentenceDraft(record, fn, idx, newArr, { [itemKey]: 'edited' });
                              setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values
    const hasAnyVal = fields.some(f => {
      if (f === '_traumaDynamic') {
        const ta = record.traumaAssessment;
        return ta && typeof ta === 'object' && Object.entries(ta).filter(([k, v]) => k !== '_id' && v !== null && v !== undefined && v !== '').length > 0;
      }
      if (NESTED_ARRAY_FIELDS.includes(f)) {
        return safeArray(getFieldValue(record, f, idx)).length > 0;
      }
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const v = getFieldValue(record, f, idx);
        return Array.isArray(v) && v.filter(r => !isEmptyDeep(r)).length > 0;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const v = getFieldValue(record, f, idx);
        return hasVal(v) && !isScalar(v);
      }
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
            if (f === '_traumaDynamic') return renderTraumaSection(record, idx, sid);
            if (NESTED_ARRAY_FIELDS.includes(f)) return renderNestedArrayField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid, title);
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
      <div className="emergency-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Emergency Assessment</h2></div>
        <div className="empty-state">No emergency assessment records available</div>
      </div>
    );
  }

  return (
    <div className="emergency-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Emergency Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EmergencyAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Emergency_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search emergency assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Emergency Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'triage-arrival')}
            {renderSection(record, idx, 'primary-survey')}
            {renderSection(record, idx, 'trauma-assessment')}
            {renderSection(record, idx, 'resuscitation-info')}
            {renderSection(record, idx, 'disposition-info')}
            {renderSection(record, idx, 'results-section')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'recommendations-section')}
            {renderSection(record, idx, 'notes-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyAssessmentDocument;
