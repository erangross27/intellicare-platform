/**
 * WoundCareAssessmentsDocument.jsx
 * March 2026 -- Complete rewrite with inline editing, blue glow theme
 * Collection: wound_care_assessments
 *
 * 16 Sections (nested sub-objects):
 *   1. wound-identification: woundIdentification.woundNumber, woundIdentification.anatomicLocation, woundIdentification.woundEtiology
 *   2. wound-classification: woundClassification (dynamic keys)
 *   3. wound-measurements: woundMeasurements (array of objects)
 *   4. wound-bed: woundBedCharacteristics (dynamic keys)
 *   5. exudate: exudate (dynamic keys)
 *   6. periwound-skin: periwoundSkin (dynamic keys)
 *   7. infection-assessment: infectionAssessment (dynamic keys)
 *   8. vascular-assessment: vascularAssessment (dynamic keys)
 *   9. neuropathy-assessment: neuropathyAssessment (dynamic keys)
 *  10. debridement: debridement (array of objects)
 *  11. dressing-regimen: dressingRegimen (dynamic keys)
 *  12. offloading: offloading (dynamic keys)
 *  13. adjunctive-therapies: adjunctiveTherapies (array of strings)
 *  14. healing-progress: healingProgress (array of objects)
 *  15. amputation-risk: amputationRisk (dynamic keys)
 *  16. patient-education: patientEducation (dynamic keys)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import WoundCareAssessmentsDocumentPDFTemplate from '../pdf-templates/WoundCareAssessmentsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './WoundCareAssessmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'wound_care_assessmentsPendingEdits';
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
  'wound-identification': 'Wound Identification',
  'wound-classification': 'Wound Classification',
  'wound-measurements': 'Wound Measurements',
  'wound-bed': 'Wound Bed Characteristics',
  'exudate': 'Exudate',
  'periwound-skin': 'Periwound Skin',
  'infection-assessment': 'Infection Assessment',
  'vascular-assessment': 'Vascular Assessment',
  'neuropathy-assessment': 'Neuropathy Assessment',
  'debridement': 'Debridement',
  'dressing-regimen': 'Dressing Regimen',
  'offloading': 'Off-loading',
  'adjunctive-therapies': 'Adjunctive Therapies',
  'healing-progress': 'Healing Progress',
  'amputation-risk': 'Amputation Risk',
  'patient-education': 'Patient Education',
};

const FIELD_LABELS = {
  'woundIdentification.woundNumber': 'Wound Number',
  'woundIdentification.anatomicLocation': 'Anatomic Location',
  'woundIdentification.woundEtiology': 'Wound Etiology',
  'dressingRegimen.dressingFrequency': 'Dressing Frequency',
  'dressingRegimen.primaryDressing': 'Primary Dressing',
  'dressingRegimen.secondaryDressing': 'Secondary Dressing',
  'dressingRegimen.dressingChangeTechnique': 'Dressing Change Technique',
  'patientEducation.dressingChangeTechnique': 'Dressing Change Technique',
  'patientEducation.signsOfInfection': 'Signs Of Infection',
  'patientEducation.activityModifications': 'Activity Modifications',
  'patientEducation.nutritionalGuidance': 'Nutritional Guidance',
  'patientEducation.followUpInstructions': 'Follow-Up Instructions',
};

/* These sections use known sub-fields */
const SECTION_FIELDS = {
  'wound-identification': ['woundIdentification.woundNumber', 'woundIdentification.anatomicLocation', 'woundIdentification.woundEtiology'],
  'wound-classification': [], // dynamic
  'wound-measurements': [], // array
  'wound-bed': [], // dynamic
  'exudate': [], // dynamic
  'periwound-skin': [], // dynamic
  'infection-assessment': [], // dynamic
  'vascular-assessment': [], // dynamic
  'neuropathy-assessment': [], // dynamic
  'debridement': [], // array
  'dressing-regimen': [], // dynamic
  'offloading': [], // dynamic
  'adjunctive-therapies': [], // array of strings
  'healing-progress': [], // array
  'amputation-risk': [], // dynamic
  'patient-education': [], // dynamic
};

/* Map section-id to the record key holding the sub-object / array */
const SECTION_ROOT_KEY = {
  'wound-identification': 'woundIdentification',
  'wound-classification': 'woundClassification',
  'wound-measurements': 'woundMeasurements',
  'wound-bed': 'woundBedCharacteristics',
  'exudate': 'exudate',
  'periwound-skin': 'periwoundSkin',
  'infection-assessment': 'infectionAssessment',
  'vascular-assessment': 'vascularAssessment',
  'neuropathy-assessment': 'neuropathyAssessment',
  'debridement': 'debridement',
  'dressing-regimen': 'dressingRegimen',
  'offloading': 'offloading',
  'adjunctive-therapies': 'adjunctiveTherapies',
  'healing-progress': 'healingProgress',
  'amputation-risk': 'amputationRisk',
  'patient-education': 'patientEducation',
};

/* Sections whose root value is an array */
const ARRAY_SECTIONS = new Set(['wound-measurements', 'debridement', 'adjunctive-therapies', 'healing-progress']);
/* Sections whose root value is a sub-object with dynamic keys */
const OBJECT_SECTIONS = new Set(['wound-identification', 'wound-classification', 'wound-bed', 'exudate', 'periwound-skin', 'infection-assessment', 'vascular-assessment', 'neuropathy-assessment', 'dressing-regimen', 'offloading', 'amputation-risk', 'patient-education']);
/* Ordered section IDs for rendering in logical order */
const SECTION_ORDER = [
  'wound-identification', 'wound-classification', 'wound-measurements',
  'wound-bed', 'exudate', 'periwound-skin',
  'infection-assessment', 'vascular-assessment', 'neuropathy-assessment',
  'debridement', 'dressing-regimen', 'offloading',
  'adjunctive-therapies', 'healing-progress', 'amputation-risk', 'patient-education',
];

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

const keyToLabel = (key) => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const lastPart = key.includes('.') ? key.split('.').pop() : key;
  return lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ======= COMPONENT ======= */
const WoundCareAssessmentsDocument = ({ document: docProp }) => {
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

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.wound_care_assessments) return Array.isArray(r.wound_care_assessments) ? r.wound_care_assessments : [r.wound_care_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.wound_care_assessments) return Array.isArray(dd.wound_care_assessments) ? dd.wound_care_assessments : [dd.wound_care_assessments]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = record?._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

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

  /* getFieldValue: supports dot-path notation like 'woundIdentification.woundNumber' */
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

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ======= SECTION HELPERS ======= */
  /* Get all dynamic field paths for a section from the record */
  const getSectionFieldPaths = useCallback((record, sid) => {
    const staticFields = SECTION_FIELDS[sid];
    if (staticFields && staticFields.length > 0) return staticFields;
    const rootKey = SECTION_ROOT_KEY[sid];
    if (!rootKey) return [];
    const rootVal = record[rootKey];
    if (!rootVal || typeof rootVal !== 'object') return [];
    if (Array.isArray(rootVal)) return [rootKey]; // array sections have just the root key
    return Object.keys(rootVal).filter(k => k !== '_id').map(k => `${rootKey}.${k}`);
  }, []);

  /* Determine if a field is boolean */
  const isFieldBoolean = useCallback((record, fn) => {
    const val = fn.includes('.') ? fn.split('.').reduce((o, k) => o?.[k], record) : record[fn];
    return typeof val === 'boolean';
  }, []);

  /* Determine if a field is a date */
  const isFieldDate = useCallback((fn) => {
    const lastPart = fn.includes('.') ? fn.split('.').pop() : fn;
    return /date/i.test(lastPart) && !/update/i.test(lastPart);
  }, []);

  /* Determine if a field is a number */
  const isFieldNumber = useCallback((record, fn) => {
    const val = fn.includes('.') ? fn.split('.').reduce((o, k) => o?.[k], record) : record[fn];
    return typeof val === 'number';
  }, []);

  /* ======= SEARCH -- 4-LEVEL ======= */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = getSectionFieldPaths(record, sid);
    for (const f of fields) {
      const label = keyToLabel(f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    /* Also check dynamic sub-object values */
    const rootKey = SECTION_ROOT_KEY[sid];
    const rootVal = record[rootKey];
    if (rootVal && typeof rootVal === 'object' && !Array.isArray(rootVal)) {
      for (const v of Object.values(rootVal)) {
        if (v && String(v).toLowerCase().includes(phrase)) return true;
      }
    }
    if (Array.isArray(rootVal)) {
      for (const item of rootVal) {
        if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
        if (typeof item === 'object' && item) {
          for (const v of Object.values(item)) {
            if (v && String(v).toLowerCase().includes(phrase)) return true;
          }
        }
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, getSectionFieldPaths]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = keyToLabel(fn).toLowerCase();
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
      const rt = `Wound Care Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      /* Check all nested values */
      for (const sid of Object.keys(SECTION_ROOT_KEY)) {
        const rootKey = SECTION_ROOT_KEY[sid];
        const rootVal = record[rootKey];
        if (!rootVal) continue;
        if (typeof rootVal === 'string' && rootVal.toLowerCase().includes(phrase)) return true;
        if (Array.isArray(rootVal)) {
          for (const item of rootVal) {
            if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            if (typeof item === 'object' && item) {
              for (const v of Object.values(item)) { if (v && String(v).toLowerCase().includes(phrase)) return true; }
            }
          }
        } else if (typeof rootVal === 'object') {
          for (const v of Object.values(rootVal)) {
            if (v && String(v).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      if (record.date && formatDate(record.date).toLowerCase().includes(phrase)) return true;
      return false;
    });
  }, [records, searchTerm]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]] || typeof merged[parts[0]] !== 'object') merged[parts[0]] = {};
              merged[parts[0]] = { ...merged[parts[0]], [parts[1]]: localEdits[key] };
            }
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a narrative field draft locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageDraft(record, fn, idx, sid, fullText) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = getSectionFieldPaths(records[idx] || {}, sid);
    const rootKey = SECTION_ROOT_KEY[sid];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    ) || Object.keys(editedFields).some(k => k.startsWith(`${rootKey}.`) && k.endsWith(`-${idx}`)) ||
    Object.keys(editedSentences).some(k => k.startsWith(`${rootKey}.`) && k.endsWith(`-${idx}`));
  }, [editedFields, editedSentences, getSectionFieldPaths, records]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const fieldsForSection = getSectionFieldPaths(record, sid);
      const rootKeyForSection = SECTION_ROOT_KEY[sid];
      const suffix = `-${idx}`;
      // Collect this record's pending edits that belong to this section (by field path / root key).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseRoot = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        if (baseRoot === rootKeyForSection) return true;
        return fieldsForSection.some(f => fieldPart === f || fieldPart.startsWith(`${f}.`));
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for numeric array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" / "a.b" / "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/wound_care_assessments/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/wound_care_assessments/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const draftStore = readDrafts();
      if (draftStore[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete draftStore[id][fp]; });
        if (Object.keys(draftStore[id]).length === 0) delete draftStore[id];
        writeDrafts(draftStore);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const fields = getSectionFieldPaths(record, sid);
      const rootKey = SECTION_ROOT_KEY[sid];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); if (k.startsWith(`${rootKey}.`) && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); if (k.startsWith(`${rootKey}.`) && k.endsWith(`-${idx}`)) delete n[k]; }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, getSectionFieldPaths, localEdits, pendingEdits]);

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

  /* flattenValue: render any value as nested-subtitle + content lines mirroring the
     on-screen mini-cards — label on its own line, value/numbered items indented below. */
  const flattenValue = useCallback((label, val, indent) => {
    const pad = '  '.repeat(indent);
    const sub = '  '.repeat(indent + 1);
    const lines = [];
    if (!hasVal(val)) return lines;
    if (Array.isArray(val)) {
      const allScalar = val.every(v => v === null || typeof v !== 'object');
      if (allScalar) {
        if (label) lines.push(`${pad}${label}:`);
        val.filter(v => hasVal(v)).forEach((v, i) => lines.push(`${sub}${i + 1}. ${fmtVal(v)}`));
        return lines;
      }
      if (label) lines.push(`${pad}${label}:`);
      val.forEach((item, i) => {
        if (item && typeof item === 'object') flattenValue(`${label || 'Item'} ${i + 1}`, item, indent + 1).forEach(l => lines.push(l));
        else if (hasVal(item)) lines.push(`${sub}${i + 1}. ${fmtVal(item)}`);
      });
      return lines;
    }
    if (typeof val === 'object') {
      if (label) lines.push(`${pad}${label}:`);
      Object.entries(val).filter(([k, v]) => k !== '_id' && hasVal(v)).forEach(([k, v]) => { flattenValue(keyToLabel(k), v, indent + 1).forEach(l => lines.push(l)); });
      return lines;
    }
    /* scalar — label, then value (numbered for labeled comma-lists / multi-sentence) below */
    if (label) lines.push(`${pad}${label}:`);
    if (typeof val === 'string') {
      const parsed = parseLabel(val);
      if (parsed.isLabeled) {
        const items = splitByComma(parsed.value);
        if (items.length >= 2) {
          lines.push(`${sub}${parsed.label}:`);
          items.forEach((it, i) => lines.push(`${'  '.repeat(indent + 2)}${i + 1}. ${it}`));
          return lines;
        }
      }
      const sentences = splitBySentence(val);
      if (sentences.length > 1) { sentences.forEach((s, i) => lines.push(`${sub}${i + 1}. ${s}`)); return lines; }
    }
    lines.push(`${sub}${fmtVal(val)}`);
    return lines;
  }, [hasVal, fmtVal, splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const rootKey = SECTION_ROOT_KEY[sid];
    const rootVal = record[rootKey];
    if (!rootVal) return text;

    if (Array.isArray(rootVal)) {
      const allScalar = rootVal.every(v => v === null || typeof v !== 'object');
      if (allScalar) {
        rootVal.filter(v => hasVal(v)).forEach((v, i) => { text += `${i + 1}. ${fmtVal(v)}\n`; });
        text += '\n';
      } else {
        rootVal.forEach((item, i) => {
          if (item && typeof item === 'object') {
            flattenValue(`${title} ${i + 1}`, item, 0).forEach(l => { text += `${l}\n`; });
            text += '\n';
          } else if (hasVal(item)) { text += `${i + 1}. ${fmtVal(item)}\n`; }
        });
      }
    } else if (typeof rootVal === 'object') {
      Object.entries(rootVal).filter(([k]) => k !== '_id').forEach(([k, v]) => {
        if (!hasVal(v)) return;
        flattenValue(keyToLabel(`${rootKey}.${k}`), v, 0).forEach(l => { text += `${l}\n`; });
        text += '\n';
      });
    }
    return text;
  }, [hasVal, fmtVal, flattenValue]);

  const copyAllText = useCallback(async () => {
    let text = '=== WOUND CARE ASSESSMENTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Wound Care Assessment ${idx + 1}\n${'='.repeat(40)}\n`;
      if (r.date) text += `Date: ${formatDate(r.date)}\n`;
      text += '\n';
      Object.keys(SECTION_TITLES).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
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
    const label = keyToLabel(fn);
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
      </div>
    );
  };

  /* ======= RENDER: BOOLEAN FIELD ======= */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = keyToLabel(fn);
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = keyToLabel(fn);
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-textarea" style={{ minHeight: 'auto' }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const num = Number(editValue); if (isNaN(num)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, num); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = keyToLabel(fn);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* A single labeled "Label: a, b, c" string (>=2 paren-aware comma items) routes
       through the multi-sentence path so it renders as sub-label + split comma rows. */
    const singleParsed = sentences.length === 1 ? parseLabel(strVal) : { isLabeled: false, value: strVal };
    const isLabeledCommaList = singleParsed.isLabeled && splitByComma(singleParsed.value).length >= 2;

    /* Multi-sentence (or single labeled comma-list): render with splitBySentence */
    if (sentences.length > 1 || isLabeledCommaList) {
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
                    <div key={sIdx} className="nested-mini-card">
                      <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                <div key={sIdx} className="nested-mini-card">
                  {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        <div className="nested-mini-card">
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
      </div>
    );
  };

  /* ======= RENDER: GENERIC EDITABLE LEAF ROW (any dot-path; scalar/bool/number/date) =======
   * Used for nested object subfields (e.g. woundMeasurements.0.undermining.present).
   * Saves via dot-path field name -> route $set preserves surrounding object/array shape. */
  const renderLeafRow = (record, fn, idx, sid, rawVal) => {
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const label = keyToLabel(fn);
    const isBool = typeof rawVal === 'boolean';
    const isNum = typeof rawVal === 'number';
    const isDate = isFieldDate(fn) && typeof rawVal !== 'boolean' && typeof rawVal !== 'number';
    const displayVal = isBool ? (rawVal ? 'Yes' : 'No') : isDate ? formatDate(rawVal) : fmtVal(rawVal);

    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    return (
      <div key={fn} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (rawVal ? 'Yes' : 'No') : isDate ? toInputDate(rawVal) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : isDate ? (
                <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : isNum ? (
                <input type="number" className="edit-textarea" style={{ minHeight: 'auto' }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let saveVal;
                  if (isBool) saveVal = editValue === 'Yes';
                  else if (isNum) { const n = Number(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveVal = n; }
                  else if (isDate) { if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } saveVal = editValue + 'T00:00:00.000Z'; }
                  else saveVal = editValue;
                  handleSaveField(record, fn, idx, sid, null, saveVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: READ-ONLY ROW (for array-of-scalars where editing would corrupt the array shape) ======= */
  const renderReadOnlyRow = (fn, label, displayVal, copyKey, sid) => {
    if (searchTerm.trim() && !sectionTitleMatches(sid)) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !String(displayVal).toLowerCase().includes(phrase)) return null;
    }
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card">
        <div className="numbered-row">
          <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span></div>
          <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
        </div>
        </div>
      </div>
    );
  };

  /* ======= RENDER: SCALAR ARRAY (one nested-mini-card per item; read-only) =======
   * Array of strings/scalars -> the field label as nested-subtitle, each item in its
   * OWN nested-mini-card (split — not joined into "a, b, c"). */
  const renderScalarArrayField = (fn, label, arr, idx, sid) => {
    const items = (Array.isArray(arr) ? arr : []).filter(v => hasVal(v));
    if (items.length === 0) return null;
    if (searchTerm.trim() && !sectionTitleMatches(sid) && !records[idx]?._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !items.some(it => String(it).toLowerCase().includes(phrase))) return null;
    }
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((it, i) => {
          const copyKey = `${fn}-${i}`;
          return (
            <div className="nested-mini-card" key={i}>
              <div className="numbered-row">
                <div className="row-content"><span className="content-value">{highlightText(String(it))}</span></div>
                <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(it), copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: a single sub-value of an object/array item =======
   * Recurses into nested objects and arrays-of-objects so they never render as [object Object]. */
  const renderSubValue = (record, fn, idx, sid, val, label) => {
    if (val === null || val === undefined || val === '') return null;
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      const allScalar = val.every(v => v === null || typeof v !== 'object');
      if (allScalar) {
        /* array of strings/scalars -> read-only joined row (editing would overwrite the array shape with a string) */
        return renderScalarArrayField(fn, label || keyToLabel(fn), val, idx, sid);
      }
      /* array of objects -> nested card per item, recurse per subfield */
      return (
        <div key={fn} className="rec-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {val.map((item, i) => {
            if (item === null || typeof item !== 'object') return renderLeafRow(record, `${fn}.${i}`, idx, sid, item);
            const subEntries = Object.entries(item).filter(([k, v]) => k !== '_id' && hasVal(v));
            if (subEntries.length === 0) return null;
            return (
              <div key={i} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(`${label || keyToLabel(fn)} ${i + 1}`)}</div>
                {subEntries.map(([k, v]) => renderSubValue(record, `${fn}.${i}.${k}`, idx, sid, v, keyToLabel(k)))}
              </div>
            );
          })}
        </div>
      );
    }
    if (typeof val === 'object') {
      const subEntries = Object.entries(val).filter(([k, v]) => k !== '_id' && hasVal(v));
      if (subEntries.length === 0) return null;
      return (
        <div key={fn} className="rec-mini-card">
          {label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {subEntries.map(([k, v]) => renderSubValue(record, `${fn}.${k}`, idx, sid, v, keyToLabel(k)))}
        </div>
      );
    }
    return renderLeafRow(record, fn, idx, sid, val);
  };

  /* ======= RENDER: ARRAY SECTION (array of objects or strings) ======= */
  const renderArraySection = (record, idx, sid) => {
    const rootKey = SECTION_ROOT_KEY[sid];
    const arr = record[rootKey];
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const title = SECTION_TITLES[sid];
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
          {arr.map((item, itemIdx) => {
            if (typeof item === 'string') {
              const editKey = `${rootKey}.${itemIdx}-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];

              if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                const phrase = searchTerm.toLowerCase().trim();
                if (!item.toLowerCase().includes(phrase)) return null;
              }

              return (
                <div key={itemIdx} className="nested-mini-card">
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, rootKey, idx)) ? getFieldValue(record, rootKey, idx) : (Array.isArray(record[rootKey]) ? record[rootKey] : []))]; currentArr[itemIdx] = editValue; const rootEditKey = `${rootKey}-${idx}`; setLocalEdits(prev => ({ ...prev, [rootEditKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [rootEditKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][rootKey] = currentArr; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            }

            /* Object item in array */
            if (typeof item === 'object' && item) {
              const entries = Object.entries(item).filter(([k, v]) => k !== '_id' && hasVal(v));
              if (entries.length === 0) return null;

              return (
                <div key={itemIdx} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(`${title} ${itemIdx + 1}`)}</div>
                  {entries.map(([subKey, subVal]) => {
                    const fn = `${rootKey}.${itemIdx}.${subKey}`;
                    /* Nested object / array-of-objects (e.g. undermining, tunneling) -> recurse so it never becomes [object Object] */
                    if (subVal && typeof subVal === 'object') {
                      return renderSubValue(record, fn, idx, sid, subVal, keyToLabel(subKey));
                    }
                    return renderLeafRow(record, fn, idx, sid, subVal);
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: OBJECT SECTION (dynamic keys from sub-object) ======= */
  const renderObjectSection = (record, idx, sid) => {
    const rootKey = SECTION_ROOT_KEY[sid];
    const obj = record[rootKey];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && hasVal(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;

    const title = SECTION_TITLES[sid];
    const copyId = `${sid}-${idx}`;
    const fieldPaths = entries.map(([k]) => `${rootKey}.${k}`);

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
          {fieldPaths.map(fn => {
            const rawVal = getFieldValue(record, fn, idx);
            /* Nested object or array-of-objects -> recurse so it never becomes [object Object] */
            if (rawVal && typeof rawVal === 'object') {
              if (Array.isArray(rawVal)) {
                const allScalar = rawVal.every(v => v === null || typeof v !== 'object');
                if (!allScalar) return renderSubValue(record, fn, idx, sid, rawVal, keyToLabel(fn));
                if (rawVal.length === 0) return null;
                /* array of scalars -> read-only joined row (editing would overwrite the array with a string) */
                return renderScalarArrayField(fn, keyToLabel(fn), rawVal, idx, sid);
              }
              return renderSubValue(record, fn, idx, sid, rawVal, keyToLabel(fn));
            }
            if (isFieldBoolean(record, fn)) return renderBooleanField(record, fn, idx, sid);
            if (isFieldDate(fn)) return renderDateField(record, fn, idx, sid);
            if (isFieldNumber(record, fn)) return renderNumberField(record, fn, idx, sid);
            return renderStringField(record, fn, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="wound-care-assessments-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Wound Care Assessments</h2></div>
        <div className="empty-state">No wound care assessments records available</div>
      </div>
    );
  }

  return (
    <div className="wound-care-assessments-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Wound Care Assessments</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<WoundCareAssessmentsDocumentPDFTemplate document={pdfData} />} fileName={`wound-care-assessments-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search wound care assessments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(record.woundIdentification?.woundNumber || `Wound Care Assessment ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => ARRAY_SECTIONS.has(sid) ? renderArraySection(record, idx, sid) : renderObjectSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WoundCareAssessmentsDocument;
