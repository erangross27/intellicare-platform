/**
 * FamilyMedicineVisitsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: family_medicine_visits
 *
 * 11 Sections:
 *   1. visit-info: visitDate (date picker), visitType, status
 *   2. provider-details: providerName, providerSpecialty, facilityName
 *   3. chief-complaint: chiefComplaint (sentence)
 *   4. hpi: historyOfPresentIllness (sentence)
 *   5. ros: reviewOfSystems (object with 11 sub-fields)
 *   6. physical-exam: physicalExam (object with 10 sub-fields)
 *   7. assessment-section: assessment[] (array of strings)
 *   8. plan-section: plan (sentence)
 *   9. medications-section: medications[] (array of objects)
 *   10. orders-section: orders[] (array of strings)
 *   11. follow-up-notes: followUp (sentence), notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FamilyMedicineVisitsDocumentPDFTemplate from '../pdf-templates/FamilyMedicineVisitsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './FamilyMedicineVisitsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart = "field" | "parent.sub" | "medications.N.sub" | "field.arrayIndex" */
const DRAFT_KEY = 'family_medicine_visitsPendingEdits';
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
  'visit-info': 'Visit Information',
  'provider-details': 'Provider Details',
  'chief-complaint': 'Chief Complaint',
  'hpi': 'History of Present Illness',
  'ros': 'Review of Systems',
  'physical-exam': 'Physical Exam',
  'assessment-section': 'Assessment',
  'plan-section': 'Plan',
  'medications-section': 'Medications',
  'orders-section': 'Orders',
  'follow-up-notes': 'Follow-Up & Notes',
};

const FIELD_LABELS = {
  visitDate: 'Visit Date',
  visitType: 'Visit Type',
  status: 'Status',
  providerName: 'Provider',
  providerSpecialty: 'Specialty',
  facilityName: 'Facility',
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  reviewOfSystems: 'Review of Systems',
  physicalExam: 'Physical Exam',
  assessment: 'Assessment',
  plan: 'Plan',
  medications: 'Medications',
  orders: 'Orders',
  followUp: 'Follow-Up',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'visit-info': ['visitDate', 'visitType', 'status'],
  'provider-details': ['providerName', 'providerSpecialty', 'facilityName'],
  'chief-complaint': ['chiefComplaint'],
  'hpi': ['historyOfPresentIllness'],
  'ros': ['reviewOfSystems'],
  'physical-exam': ['physicalExam'],
  'assessment-section': ['assessment'],
  'plan-section': ['plan'],
  'medications-section': ['medications'],
  'orders-section': ['orders'],
  'follow-up-notes': ['followUp', 'notes'],
};

const DATE_FIELDS = ['visitDate'];
const SENTENCE_FIELDS = ['chiefComplaint', 'historyOfPresentIllness', 'plan', 'followUp', 'notes'];
const OBJECT_FIELDS = ['reviewOfSystems', 'physicalExam'];
const ARRAY_OF_STRINGS_FIELDS = ['assessment', 'orders'];
const MED_BOOLEAN_FIELDS = ['active', 'prn'];
const MED_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'route', label: 'Route' },
  { key: 'indication', label: 'Indication' },
  { key: 'status', label: 'Status' },
  { key: 'active', label: 'Active' },
  { key: 'prn', label: 'PRN' },
];

/* Readable sub-field labels for nested objects */
const ROS_LABELS = {
  constitutional: 'Constitutional',
  heent: 'HEENT',
  cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory',
  gi: 'Gastrointestinal',
  gu: 'Genitourinary',
  musculoskeletal: 'Musculoskeletal',
  neurological: 'Neurological',
  psychiatric: 'Psychiatric',
  endocrine: 'Endocrine',
  skin: 'Skin',
};

const PE_LABELS = {
  general: 'General',
  heent: 'HEENT',
  neck: 'Neck',
  cardiovascular: 'Cardiovascular',
  pulmonary: 'Pulmonary',
  abdomen: 'Abdomen',
  extremities: 'Extremities',
  neurological: 'Neurological',
  skin: 'Skin',
  musculoskeletal: 'Musculoskeletal',
};

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

const camelToTitle = (str) => {
  if (!str) return '';
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
};

/* ═══════ COMPONENT ═══════ */
const FamilyMedicineVisitsDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.family_medicine_visits) return Array.isArray(r.family_medicine_visits) ? r.family_medicine_visits : [r.family_medicine_visits];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.family_medicine_visits) return Array.isArray(dd.family_medicine_visits) ? dd.family_medicine_visits : [dd.family_medicine_visits]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          // Array element draft: fieldPart = "field.arrayIndex" → merge into the field's array under "field-idx"
          const arrField = fieldPart.slice(0, lastDot);
          const arrIdx = parseInt(trailing, 10);
          const base = Array.isArray(nLocal[`${arrField}-${idx}`])
            ? nLocal[`${arrField}-${idx}`]
            : [...(Array.isArray(record[arrField]) ? record[arrField] : [])];
          base[arrIdx] = value;
          nLocal[`${arrField}-${idx}`] = base;
          nPending[`${arrField}-${idx}`] = true;
          nFields[`${arrField}.${arrIdx}-${idx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
          else nFields[editKey] = 'edited';
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

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

  const getNestedFieldValue = useCallback((record, parentField, subField, idx) => {
    const k = `${parentField}.${subField}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const obj = record[parentField];
    if (!obj || typeof obj !== 'object') return undefined;
    return obj[subField];
  }, [localEdits]);

  const getMedFieldValue = useCallback((record, arrIdx, subField, idx) => {
    const k = `medications.${arrIdx}.${subField}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record.medications;
    if (!Array.isArray(arr) || !arr[arrIdx]) return undefined;
    return arr[arrIdx][subField];
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
            if (typeof item === 'object') {
              const itemText = Object.values(item).filter(Boolean).map(String).join(' ').toLowerCase();
              if (itemText.includes(phrase)) return true;
            } else {
              if (String(item).toLowerCase().includes(phrase)) return true;
            }
          }
        } else if (typeof val === 'object' && !Array.isArray(val)) {
          const objText = Object.entries(val).map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase();
          if (objText.includes(phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (Array.isArray(val)) {
        return val.some(item => {
          if (typeof item === 'object') return Object.values(item).filter(Boolean).map(String).join(' ').toLowerCase().includes(phrase);
          return String(item).toLowerCase().includes(phrase);
        });
      }
      if (typeof val === 'object') return Object.entries(val).map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Family Medicine Visit ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'object') { if (Object.values(item).filter(Boolean).map(String).join(' ').toLowerCase().includes(phrase)) return true; }
              else { if (String(item).toLowerCase().includes(phrase)) return true; }
            }
          } else if (val && typeof val === 'object') {
            if (Object.entries(val).map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase().includes(phrase)) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 3) {
            const [arrField, arrIdx2, subField] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            const ai = parseInt(arrIdx2);
            if (merged[arrField][ai]) {
              merged[arrField][ai] = { ...merged[arrField][ai], [subField]: localEdits[key] };
            }
          } else if (dotParts.length === 2) {
            const [parentField, subField] = dotParts;
            if (!merged[parentField]) merged[parentField] = { ...(record[parentField] || {}) };
            else merged[parentField] = { ...merged[parentField] };
            merged[parentField][subField] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* All Save handlers STAGE a DRAFT locally (localEdits + pendingEdits + edited markers) and write it
     to the pending-drafts localStorage store (survives refresh). NOTHING is written to MongoDB and
     nothing reaches the PDF/Copy until the user clicks Pending Approve (handleApproveSection commits). */

  // Find the sectionId that owns a base field name (for clearing the approved flag on re-edit).
  const sectionIdForField = useCallback((baseField) => {
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) {
      if (fields.includes(baseField)) return sid;
    }
    return null;
  }, []);

  // Stage one draft: persist to localStorage under the record id + fieldPart, mark pending, and on
  // re-edit after approval drop the section's approved flag so the button returns to yellow.
  const stageDraft = useCallback((record, idx, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    const baseField = fieldPart.split('.')[0];
    const sid = sectionIdForField(baseField);
    if (sid) {
      setApprovedSections(prev => {
        if (!prev[`${sid}-${idx}`]) return prev;
        const next = { ...prev }; delete next[`${sid}-${idx}`]; return next;
      });
    }
  }, [safeId, sectionIdForField]);

  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, idx, fn, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveNestedField = useCallback((record, parentField, subField, idx) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue;
    const fieldPart = `${parentField}.${subField}`;
    setLocalEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fieldPart}-${idx}`]: 'edited' }));
    stageDraft(record, idx, fieldPart, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveMedField = useCallback((record, arrIdx, subField, idx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const fieldPart = `medications.${arrIdx}.${subField}`;
    setLocalEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fieldPart}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fieldPart}-${idx}`]: 'edited' }));
    stageDraft(record, idx, fieldPart, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, arrIdx, idx) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue;
    setLocalEdits(prev => {
      const currentArr = prev[`${fn}-${idx}`] !== undefined ? [...prev[`${fn}-${idx}`]] : [...(record[fn] || [])];
      currentArr[arrIdx] = saveVal;
      return { ...prev, [`${fn}-${idx}`]: currentArr };
    });
    // Whole array shares one localEdits key, so mark that key pending (keeps the array out of PDF until approve).
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}.${arrIdx}-${idx}`]: 'edited' }));
    // Draft fieldPart "field.arrayIndex" → approve emits { field, value, arrayIndex }.
    stageDraft(record, idx, `${fn}.${arrIdx}`, saveVal);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      stageDraft(record, idx, fn, fullText);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    stageDraft(record, idx, fn, fullText);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Pull this record's staged drafts and commit only the fieldParts belonging to this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedFieldParts = [];
      const clearedLocalKeys = new Set();
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const baseField = fieldPart.split('.')[0];
        if (!fields.includes(baseField)) continue;
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric.
        const payload = (lastDot !== -1 && /^\d+$/.test(trailing))
          ? { field: fieldPart.slice(0, lastDot), value, arrayIndex: parseInt(trailing, 10) }
          : { field: fieldPart, value };
        const resp = await secureApiClient.put(`/api/edit/family_medicine_visits/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
        // Map fieldPart → its localEdits key so we can clear pending (arrays share "field-idx").
        clearedLocalKeys.add((lastDot !== -1 && /^\d+$/.test(trailing)) ? `${fieldPart.slice(0, lastDot)}-${idx}` : `${fieldPart}-${idx}`);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/family_medicine_visits/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; clearedLocalKeys.forEach(k => delete next[k]); return next; });
      // Drop this section's committed drafts from localStorage
      if (committedFieldParts.length > 0) {
        const s2 = readDrafts();
        if (s2[id]) { committedFieldParts.forEach(fp => delete s2[id][fp]); if (Object.keys(s2[id]).length === 0) delete s2[id]; writeDrafts(s2); }
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[FamilyMedicineVisits] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
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
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += `${label}\n`;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        /* single-name (label == section title) → sub-fields only, STACKED (label / ---- / value), never side-by-side */
        const labelsMap = f === 'reviewOfSystems' ? ROS_LABELS : PE_LABELS;
        Object.entries(val).forEach(([k, v]) => {
          if (v && String(v).trim()) {
            const subLabel = labelsMap[k] || camelToTitle(k);
            text += `${subLabel}\n${'-'.repeat(40)}\n${String(v)}\n`;
          }
        });
        text += '\n';
      } else if (f === 'medications' && Array.isArray(val)) {
        val.forEach((med, mi) => {
          const medName = getMedFieldValue(record, mi, 'name', idx) ?? med.name;
          text += `${mi + 1}. ${medName || 'Unknown'}\n${'-'.repeat(40)}\n`;
          MED_FIELDS.slice(1).forEach(mf => {
            const mv = getMedFieldValue(record, mi, mf.key, idx) ?? med[mf.key];
            if (mv !== null && mv !== undefined && mv !== '') {
              const display = typeof mv === 'boolean' ? (mv ? 'Yes' : 'No') : String(mv);
              text += `${mf.label}\n${display}\n`;
            }
          });
          text += '\n';
        });
      } else if (Array.isArray(val)) {
        text += `${label}\n`;
        val.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, getMedFieldValue]);

  const copyAllText = useCallback(async () => {
    let text = '=== FAMILY MEDICINE VISITS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Family Medicine Visit ${idx + 1}\n${'='.repeat(40)}\n\n`;
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

  /* ═══════ RENDER: NESTED OBJECT SECTION (reviewOfSystems, physicalExam) ═══════ */
  const renderObjectSection = (record, idx, fn, sid) => {
    const obj = record[fn];
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const labelsMap = fn === 'reviewOfSystems' ? ROS_LABELS : PE_LABELS;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    const entries = Object.entries(obj).filter(([, v]) => v && String(v).trim());
    if (entries.length === 0) return null;

    return entries.map(([subKey, subVal]) => {
      const subLabel = labelsMap[subKey] || camelToTitle(subKey);
      const val = getNestedFieldValue(record, fn, subKey, idx) ?? subVal;
      if (!val || !String(val).trim()) return null;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!subLabel.toLowerCase().includes(phrase) && !String(val).toLowerCase().includes(phrase)) return null;
      }

      const editKey = `${fn}.${subKey}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];

      return (
        <div key={subKey} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(subLabel)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveNestedField(record, fn, subKey, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(String(val))}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${subLabel}\n${String(val)}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: ARRAY OF STRINGS (assessment, orders) ═══════ */
  const renderArraySection = (record, idx, fn, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return arr.map((item, arrIdx) => {
      const val = String(item);
      if (!val.trim()) return null;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!val.toLowerCase().includes(phrase)) return null;
      }

      const editKey = `${fn}.${arrIdx}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];

      return (
        <div key={arrIdx} className="rec-mini-card">
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, arrIdx, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(val)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(val, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: MEDICATIONS ARRAY ═══════ */
  const renderMedicationsSection = (record, idx, sid) => {
    const meds = record.medications;
    if (!Array.isArray(meds) || meds.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return meds.map((med, medIdx) => {
      const medName = getMedFieldValue(record, medIdx, 'name', idx) ?? med.name;

      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        const medText = MED_FIELDS.map(mf => {
          const mv = getMedFieldValue(record, medIdx, mf.key, idx) ?? med[mf.key];
          return mv ? String(mv) : '';
        }).join(' ').toLowerCase();
        if (!medText.includes(phrase) && !'medications'.includes(phrase)) return null;
      }

      const medNameMatches = !searchTerm.trim() || phraseMatch || (medName && String(medName).toLowerCase().includes(searchTerm.toLowerCase().trim()));

      return (
        <div key={medIdx} className="rec-mini-card" style={{ position: 'relative' }}>
          <div className="nested-subtitle">{highlightText(medName || `Medication ${medIdx + 1}`)}</div>
          {MED_FIELDS.map(mf => {
            const mv = getMedFieldValue(record, medIdx, mf.key, idx) ?? med[mf.key];
            if (mv === null || mv === undefined || mv === '') return null;

            if (searchTerm.trim() && !medNameMatches && !phraseMatch) {
              const phrase = searchTerm.toLowerCase().trim();
              if (!mf.label.toLowerCase().includes(phrase) && !String(mv).toLowerCase().includes(phrase)) return null;
            }

            const editKey = `medications.${medIdx}.${mf.key}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const isBool = MED_BOOLEAN_FIELDS.includes(mf.key);
            const displayVal = typeof mv === 'boolean' ? (mv ? 'Yes' : 'No') : String(mv);

            return (
              <div key={mf.key}>
                {mf.key !== 'name' && (
                  <>
                  <div className="nested-subtitle sub-label">{highlightText(mf.label)}</div>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => {
                    if (!isEditing) {
                      setEditingField(editKey);
                      if (isBool) { setEditValue(typeof mv === 'boolean' ? (mv ? 'yes' : 'no') : String(mv).toLowerCase()); }
                      else { setEditValue(String(mv)); }
                      setSaveError(null);
                    }
                  }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        {isBool ? (
                          <BlueSelect value={editValue === 'yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'yes' : 'no')} />
                        ) : (
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        )}
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => {
                            e.stopPropagation();
                            if (isBool) { handleSaveMedField(record, medIdx, mf.key, idx, editValue === 'yes'); }
                            else { handleSaveMedField(record, medIdx, mf.key, idx); }
                          }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content">
                          <span className="content-value">{highlightText(displayVal)}</span>
                          <span className="edit-indicator">&#9998;</span>
                        </div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${mf.label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  </>
                )}
                {mf.key === 'name' && (() => {
                  const nameEditing = editingField === editKey;
                  if (!nameEditing) return null;
                  return (
                    <div className="edit-field-container" style={{ marginBottom: 8 }}>
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveMedField(record, medIdx, 'name', idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  );
                })()}
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
          {editingField !== `medications.${medIdx}.name-${idx}` && (
            <div style={{ position: 'absolute', top: 12, right: 50, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setEditingField(`medications.${medIdx}.name-${idx}`); setEditValue(String(medName || '')); setSaveError(null); }}>
              <span className="edit-indicator" style={{ opacity: 0.5 }}>&#9998;</span>
            </div>
          )}
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, idx, fn, fullText2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const idL = safeId(record); if (!idL) return; const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, idx, fn, fullText); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (OBJECT_FIELDS.includes(f)) { const obj = record[f]; return obj && typeof obj === 'object' && Object.values(obj).some(v => v && String(v).trim()); }
      if (f === 'medications') return Array.isArray(record.medications) && record.medications.length > 0;
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
            if (OBJECT_FIELDS.includes(f)) return renderObjectSection(record, idx, f, sid);
            if (f === 'medications') return renderMedicationsSection(record, idx, sid);
            if (ARRAY_OF_STRINGS_FIELDS.includes(f)) return renderArraySection(record, idx, f, sid);
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
      <div className="family-medicine-visits-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Family Medicine Visits</h2></div>
        <div className="empty-state">No family medicine visits records available</div>
      </div>
    );
  }

  return (
    <div className="family-medicine-visits-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Family Medicine Visits</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FamilyMedicineVisitsDocumentPDFTemplate document={pdfData} />} fileName="Family_Medicine_Visits.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search family medicine visits..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Family Medicine Visit ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'visit-info')}
            {renderSection(record, idx, 'provider-details')}
            {renderSection(record, idx, 'chief-complaint')}
            {renderSection(record, idx, 'hpi')}
            {renderSection(record, idx, 'ros')}
            {renderSection(record, idx, 'physical-exam')}
            {renderSection(record, idx, 'assessment-section')}
            {renderSection(record, idx, 'plan-section')}
            {renderSection(record, idx, 'medications-section')}
            {renderSection(record, idx, 'orders-section')}
            {renderSection(record, idx, 'follow-up-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FamilyMedicineVisitsDocument;
