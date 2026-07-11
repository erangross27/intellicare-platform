/**
 * FunctionalAssessmentsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: functional_assessments
 *
 * 5 Sections:
 *   1. adl-mobility: adlScore, iadlScore, barthelsIndex, functionalIndependenceMeasure
 *   2. cognitive: miniMentalStateScore, montrealCognitiveAssessment, cogatScore
 *   3. performance: karnofskyPerformanceScale, ecogPerformanceStatus, nyhaClassification
 *   4. physical: sixMinuteWalkDistance, timedUpAndGoTest, bergBalanceScale,
 *                functionalReachTest, dynamicGaitIndex, gripStrengthPounds,
 *                manualMuscleTestGrade(string), rangeOfMotionMeasurements(array)
 *   5. neuro-specialty: glasgowComaScale, rankinScale, ashworthScale,
 *                       pusherSyndromeScale, motorAssessmentScale,
 *                       westernOntarioMcMasterScore, lowExtremetyFunctionalScale
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FunctionalAssessmentsDocumentPDFTemplate from '../pdf-templates/FunctionalAssessmentsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './FunctionalAssessmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { localValue, put: { field, value, arrayIndex? } } } }
   - localValue is what getFieldValue/pdfData reads (string | number | array)
   - put is the exact payload Approve PUTs to the server (preserves array/subfield shape) */
const DRAFT_KEY = 'functional_assessmentsPendingEdits';
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
  'adl-mobility': 'ADL & Mobility',
  'cognitive': 'Cognitive Assessments',
  'performance': 'Performance Scales',
  'physical': 'Physical Function & Strength',
  'neuro-specialty': 'Neuro & Specialty Scales',
};

const FIELD_LABELS = {
  adlScore: 'ADL Score',
  iadlScore: 'IADL Score',
  barthelsIndex: 'Barthel\'s Index',
  functionalIndependenceMeasure: 'Functional Independence Measure (FIM)',
  miniMentalStateScore: 'Mini-Mental State Exam (MMSE)',
  montrealCognitiveAssessment: 'Montreal Cognitive Assessment (MoCA)',
  cogatScore: 'CogAT Score',
  karnofskyPerformanceScale: 'Karnofsky Performance Scale (KPS)',
  ecogPerformanceStatus: 'ECOG Performance Status',
  nyhaClassification: 'NYHA Classification',
  sixMinuteWalkDistance: '6-Minute Walk Distance (m)',
  timedUpAndGoTest: 'Timed Up and Go Test (s)',
  bergBalanceScale: 'Berg Balance Scale',
  functionalReachTest: 'Functional Reach Test (cm)',
  dynamicGaitIndex: 'Dynamic Gait Index',
  gripStrengthPounds: 'Grip Strength (lbs)',
  manualMuscleTestGrade: 'Manual Muscle Test Grade',
  rangeOfMotionMeasurements: 'Range of Motion Measurements',
  glasgowComaScale: 'Glasgow Coma Scale',
  rankinScale: 'Modified Rankin Scale',
  ashworthScale: 'Modified Ashworth Scale',
  pusherSyndromeScale: 'Pusher Syndrome Scale',
  motorAssessmentScale: 'Motor Assessment Scale',
  westernOntarioMcMasterScore: 'WOMAC Score',
  lowExtremetyFunctionalScale: 'Lower Extremity Functional Scale (LEFS)',
};

const SECTION_FIELDS = {
  'adl-mobility': ['adlScore', 'iadlScore', 'barthelsIndex', 'functionalIndependenceMeasure'],
  'cognitive': ['miniMentalStateScore', 'montrealCognitiveAssessment', 'cogatScore'],
  'performance': ['karnofskyPerformanceScale', 'ecogPerformanceStatus', 'nyhaClassification'],
  'physical': ['sixMinuteWalkDistance', 'timedUpAndGoTest', 'bergBalanceScale', 'functionalReachTest', 'dynamicGaitIndex', 'gripStrengthPounds', 'manualMuscleTestGrade', 'rangeOfMotionMeasurements'],
  'neuro-specialty': ['glasgowComaScale', 'rankinScale', 'ashworthScale', 'pusherSyndromeScale', 'motorAssessmentScale', 'westernOntarioMcMasterScore', 'lowExtremetyFunctionalScale'],
};

/* 23 number fields — ALL use input[type=number step=any] + parseFloat+isNaN→block save */
const NUMBER_FIELDS = [
  'adlScore', 'iadlScore', 'barthelsIndex', 'functionalIndependenceMeasure',
  'miniMentalStateScore', 'montrealCognitiveAssessment', 'cogatScore',
  'karnofskyPerformanceScale', 'ecogPerformanceStatus', 'nyhaClassification',
  'sixMinuteWalkDistance', 'timedUpAndGoTest', 'bergBalanceScale',
  'functionalReachTest', 'dynamicGaitIndex', 'gripStrengthPounds',
  'glasgowComaScale', 'rankinScale', 'ashworthScale',
  'pusherSyndromeScale', 'motorAssessmentScale',
  'westernOntarioMcMasterScore', 'lowExtremetyFunctionalScale',
];

const STRING_FIELDS = ['manualMuscleTestGrade'];
const ARRAY_FIELDS = ['rangeOfMotionMeasurements'];
/* SENTINEL-ZERO: these are positive clinical scores; a stored 0 = "not assessed" (batch ingestion default),
   NOT a real score. Showing "ADL Score: 0 / GCS 0 / ECOG 0 ..." for unperformed scales is dangerous
   misinformation (reads as "scored 0 on everything"). Hide 0 for ALL number fields; a real assessed value is non-zero. */
const HIDE_ZERO_FIELDS = [...NUMBER_FIELDS];
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? parseFloat('0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1') : 1; };

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

/* ═══════ COMPONENT ═══════ */
const FunctionalAssessmentsDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.functional_assessments) return Array.isArray(r.functional_assessments) ? r.functional_assessments : [r.functional_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.functional_assessments) return Array.isArray(dd.functional_assessments) ? dd.functional_assessments : [dd.functional_assessments]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        const trackKey = `${editKey}-${idx}`;
        // Array-subfield drafts store the array localValue under "fn-idx" (localField), keyed by trackKey.
        const localKey = draft.localField ? `${draft.localField.replace(/-\d+$/, '')}-${idx}` : trackKey;
        nLocal[localKey] = draft.localValue;
        nPending[localKey] = true;
        nPending[trackKey] = true;
        // Restore the edited/sentence markers using the editKey's own shape.
        if (editKey.includes('-s')) nSentences[trackKey] = 'edited';
        else nFields[trackKey] = 'edited';
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
  /* presence check with per-field sentinel-zero hiding (mirrored in PDF) */
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return hasVal(v); }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  /* flattenItem: render an array item readably ("Joint: x, Degrees: y") — never [object Object] */
  const flattenItem = useCallback((item) => {
    if (item === null || item === undefined) return '';
    if (typeof item !== 'object' || Array.isArray(item)) return fmtVal(item);
    return Object.entries(item)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${fmtVal(v)}`)
      .join(', ');
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

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (flattenItem(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, flattenItem]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        return val.some(item => flattenItem(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, flattenItem]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Functional Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (flattenItem(item).toLowerCase().includes(phrase)) return true;
            }
          } else if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, flattenItem]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* stageDraft = the ONLY persistence on Save: stage a DRAFT locally + write it to the pending-drafts
     localStorage store (survives refresh). NOT written to MongoDB and NOT shown in the PDF until the
     user clicks Pending Approve (handleApproveSection commits). The draft records BOTH the localEdits
     value (for getFieldValue/pdfData) and the exact PUT payload (so Approve preserves array/subfield
     shape). trackKey is the editKey-with-idx ("fn-idx", "fn-idx-sN", "fn.arr.sub-idx", ...); we strip
     the "-idx" suffix for the per-record draft store key (which only spans one record). */
  const stageDraft = useCallback((record, idx, trackKey, localValue, putPayload, markKind) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [trackKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [trackKey]: true }));
    if (markKind === 'sentence') setEditedSentences(prev => ({ ...prev, [trackKey]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    const suffix = `-${idx}`;
    const draftKey = trackKey.endsWith(suffix) ? trackKey.slice(0, -suffix.length) : trackKey;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][draftKey] = { localValue, put: putPayload };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, idx, trackKey, saveVal, { field: fn, value: saveVal }, 'field');
  }, [editValue, safeId, stageDraft]);

  /* Save a single subfield of an array-of-objects item via arrayIndex + subField
     dot-path — preserves the object shape on the server (no flat overwrite). */
  const saveArraySubField = useCallback((record, fn, idx, arrIdx, subKey, saveVal, trackKey) => {
    const id = safeId(record); if (!id) return;
    const field = subKey ? `${fn}.${arrIdx}.${subKey}` : `${fn}.${arrIdx}`;
    setSaveError(null);
    // Build the updated array as the local value (so getFieldValue/pdfData reflect the draft);
    // the PUT preserves the subfield dot-path shape on the server when Approved.
    const current = getFieldValue(record, fn, idx);
    const arr = Array.isArray(current) ? current.map(it => (it && typeof it === 'object' && !Array.isArray(it)) ? { ...it } : it) : [];
    if (subKey) { if (arr[arrIdx] && typeof arr[arrIdx] === 'object') arr[arrIdx][subKey] = saveVal; }
    else { arr[arrIdx] = saveVal; }
    // Local value lives under "fn-idx" (the array field) so getFieldValue/pdfData read it; the draft
    // store keys it by trackKey but carries the array localValue + the dot-path PUT payload.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: arr }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true, [trackKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    const sIid = safeId(record);
    const store = readDrafts();
    if (!store[sIid]) store[sIid] = {};
    const suffix = `-${idx}`;
    const draftKey = trackKey.endsWith(suffix) ? trackKey.slice(0, -suffix.length) : trackKey;
    store[sIid][draftKey] = { localValue: arr, localField: `${fn}-${idx}`, put: { field, value: saveVal } };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    // stageSentenceDraft: stage locally + persist to draft store (NO DB write). Approve commits.
    const stageSentenceDraft = (fullText, markFn) => {
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => markFn({ ...prev }));
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = { localValue: fullText, put: { field: fn, value: fullText } };
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(fullText, (n) => { n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; return n; });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    stageSentenceDraft(fullText, (n) => {
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB (the ONLY DB-write path), then clear
  // pending so the committed values flow into pdfData/PDF, drop this record's drafts, and mark approved.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const store = readDrafts();
    const recDrafts = store[id] || {};
    // Select this section's draft entries: a draft key is "field" or "field.arr[.sub]" / "field-sN..."
    const sectionDraftKeys = Object.keys(recDrafts).filter(dk => {
      const base = dk.split(/[-.]/)[0];
      return fields.includes(base);
    });
    setSaving(true); setSaveError(null);
    try {
      // Persist each staged draft to the DB now using its stored PUT payload (preserves shape).
      for (const dk of sectionDraftKeys) {
        const draft = recDrafts[dk];
        const payload = draft && draft.put ? draft.put : { field: dk, value: draft && draft.localValue };
        await secureApiClient.put(`/api/edit/functional_assessments/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail) — existing endpoint preserved.
      await secureApiClient.put(`/api/edit/functional_assessments/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); });
        return n;
      });
      // Drop this section's drafts from localStorage (now committed).
      if (store[id]) { sectionDraftKeys.forEach(dk => delete store[id][dk]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed. Please try again.'); }
    finally { setSaving(false); }
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
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (Array.isArray(val)) {
        body += head;
        val.forEach((item, i) => { body += `${i + 1}. ${flattenItem(item)}\n`; });
        body += '\n';
      } else if (NUMBER_FIELDS.includes(f)) {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      } else {
        body += head;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
        else body += `1. ${strVal}\n`;
        body += '\n';
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [getFieldValue, hasFieldVal, fmtVal, splitBySentence, formatSentenceFieldLines, flattenItem]);

  const copyAllText = useCallback(async () => {
    let text = `Functional Assessments\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Functional Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sec = buildSectionCopyText(r, idx, sid);
        if (sec) text += sec;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD — input[type=number step=any] + parseFloat+isNaN→block save ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const step = stepFor(editValue);
    const bump = (delta) => { const cur = parseFloat(editValue); const base = isNaN(cur) ? 0 : cur; setEditValue(String(Math.max(0, Math.round((base + delta) * 1e6) / 1e6))); };
    const saveNum = () => { const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); };

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-step); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); saveNum(); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(step); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
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
            <div className="nested-subtitle">{highlightText(label)}</div>
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][fn] = { localValue: fullText2, put: { field: fn, value: fullText2 } }; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const sid2 = safeId(record); setSaveError(null); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); if (sid2) { const store = readDrafts(); if (!store[sid2]) store[sid2] = {}; store[sid2][fn] = { localValue: fullText, put: { field: fn, value: fullText } }; writeDrafts(store); } setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: ARRAY-OF-OBJECTS FIELD — per-subfield editable rows ═══════
     rangeOfMotionMeasurements: [{ joint, degrees }] — each subfield is an
     editable row that saves via arrayIndex + subField dot-path so the SAVE
     preserves the object shape (no flat-string overwrite). */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!Array.isArray(val) || val.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {val.map((item, arrIdx) => {
          /* Primitive item: single editable row (no object subfields) */
          if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            const itemKey = `${fn}-${idx}-${arrIdx}`;
            const isEditing = editingField === itemKey;
            const isModified = editedFields[itemKey];
            const itemStr = fmtVal(item);
            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArraySubField(record, fn, idx, arrIdx, null, editValue, itemKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          /* Object item: one editable row per subfield */
          const subKeys = Object.keys(item);
          return (
            <div key={arrIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {subKeys.map(subKey => {
                const subVal = item[subKey];
                if (!hasVal(subVal)) return null;
                const subLabel = subKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const isNum = typeof subVal === 'number';
                const subKeyId = `${fn}.${arrIdx}.${subKey}-${idx}`;
                const isEditing = editingField === subKeyId;
                const isModified = editedFields[subKeyId];
                const subStr = fmtVal(subVal);
                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const p = searchTerm.toLowerCase().trim();
                  const labelHit = (FIELD_LABELS[fn] || fn).toLowerCase().includes(p);
                  if (!labelHit && !subLabel.toLowerCase().includes(p) && !subStr.toLowerCase().includes(p)) return null;
                }
                return (
                  <div key={subKey}>
                    <div className="nested-subtitle">{highlightText(subLabel)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(subKeyId); setEditValue(subStr); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {isNum ? (
                            <div className="num-stepper-row">
                              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); const b = isNaN(c) ? 0 : c; setEditValue(String(Math.max(0, Math.round((b - stepFor(editValue)) * 1e6) / 1e6))); }}>−</button>
                              <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const nv = parseFloat(editValue); if (isNaN(nv) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } saveArraySubField(record, fn, idx, arrIdx, subKey, nv, subKeyId); } }} />
                              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const c = parseFloat(editValue); const b = isNaN(c) ? 0 : c; setEditValue(String(Math.max(0, Math.round((b + stepFor(editValue)) * 1e6) / 1e6))); }}>+</button>
                            </div>
                          ) : (
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          )}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNum) { const nv = parseFloat(editValue); if (isNaN(nv) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } saveArraySubField(record, fn, idx, arrIdx, subKey, nv, subKeyId); } else { saveArraySubField(record, fn, idx, arrIdx, subKey, editValue, subKeyId); } }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(subStr)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[subKeyId] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}: ${subStr}`, subKeyId); }}>{copiedItems[subKeyId] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
      return hasFieldVal(f, val);
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
      <div className="functional-assessments-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Functional Assessments</h2></div>
        <div className="empty-state">No functional assessment records available</div>
      </div>
    );
  }

  return (
    <div className="functional-assessments-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Functional Assessments</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FunctionalAssessmentsDocumentPDFTemplate document={pdfData} />} fileName="Functional_Assessments.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search functional assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Functional Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'adl-mobility')}
            {renderSection(record, idx, 'cognitive')}
            {renderSection(record, idx, 'performance')}
            {renderSection(record, idx, 'physical')}
            {renderSection(record, idx, 'neuro-specialty')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FunctionalAssessmentsDocument;
