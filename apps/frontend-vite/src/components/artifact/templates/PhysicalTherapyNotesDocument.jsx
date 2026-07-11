/**
 * PhysicalTherapyNotesDocument.jsx
 * June 2026 — Physical Therapy Notes (unified flat schema)
 * Data collection: physical_therapy_notes
 * Edit route: physical_therapy_notes
 *
 * 5 Sections (covering all 21 extractable fields, none added):
 *   1. mobility-function: patientMobilityLevel, gaitPattern, assistiveDeviceUsed, transferAbility,
 *                         functionalIndependenceMeasure, sixMinuteWalkTest, timedUpAndGoTest
 *   2. strength-rom:      rangeOfMotionMeasurements, muscleStrengthGrading, coordinationTesting,
 *                         edemaGrading, postureAnalysis
 *   3. balance-neuro:     balanceAssessmentScore, neurologicalDeficits, fallRiskAssessment,
 *                         cardiovascularResponse
 *   4. pain:              painLevelNumericRating
 *   5. treatment-goals:   treatmentInterventions, rehabilitationGoals, patientCompliance,
 *                         dischargeReadiness
 *
 * Field handling:
 *   - SIMPLE STRINGS → click-to-edit textarea (renderEditableField)
 *   - NARRATIVE STRINGS → per-sentence editing (renderSentenceEditableField)
 *   - NUMBER  → numeric presence check (0/absent hidden, NEVER truthiness), doctor-edit-0 exception
 *   - ARRAYS OF STRINGS → per-item editing with arrayIndex
 *
 * No top-level `date` field → TITLE-ONLY record header (no date badge).
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PhysicalTherapyNotesDocumentPDFTemplate from '../pdf-templates/PhysicalTherapyNotesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PhysicalTherapyNotesDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'mobility-function': 'Mobility & Function',
  'strength-rom': 'Strength & ROM',
  'balance-neuro': 'Balance & Neuro',
  'pain': 'Pain',
  'treatment-goals': 'Treatment & Goals',
};

const FIELD_LABELS = {
  patientMobilityLevel: 'Patient Mobility Level',
  gaitPattern: 'Gait Pattern',
  assistiveDeviceUsed: 'Assistive Device Used',
  transferAbility: 'Transfer Ability',
  functionalIndependenceMeasure: 'Functional Independence Measure',
  sixMinuteWalkTest: 'Six-Minute Walk Test',
  timedUpAndGoTest: 'Timed Up and Go Test',
  rangeOfMotionMeasurements: 'Range of Motion Measurements',
  muscleStrengthGrading: 'Muscle Strength Grading',
  coordinationTesting: 'Coordination Testing',
  edemaGrading: 'Edema Grading',
  postureAnalysis: 'Posture Analysis',
  balanceAssessmentScore: 'Balance Assessment Score',
  neurologicalDeficits: 'Neurological Deficits',
  fallRiskAssessment: 'Fall Risk Assessment',
  cardiovascularResponse: 'Cardiovascular Response',
  painLevelNumericRating: 'Pain Level (Numeric Rating)',
  treatmentInterventions: 'Treatment Interventions',
  rehabilitationGoals: 'Rehabilitation Goals',
  patientCompliance: 'Patient Compliance',
  dischargeReadiness: 'Discharge Readiness',
};

const SECTION_FIELDS = {
  'mobility-function': ['patientMobilityLevel', 'gaitPattern', 'assistiveDeviceUsed', 'transferAbility', 'functionalIndependenceMeasure', 'sixMinuteWalkTest', 'timedUpAndGoTest'],
  'strength-rom': ['rangeOfMotionMeasurements', 'muscleStrengthGrading', 'coordinationTesting', 'edemaGrading', 'postureAnalysis'],
  'balance-neuro': ['balanceAssessmentScore', 'neurologicalDeficits', 'fallRiskAssessment', 'cardiovascularResponse'],
  'pain': ['painLevelNumericRating'],
  'treatment-goals': ['treatmentInterventions', 'rehabilitationGoals', 'patientCompliance', 'dischargeReadiness'],
};

// Simple strings → click-to-edit textarea (renderEditableField)
const SIMPLE_STRING_FIELDS = ['patientMobilityLevel', 'balanceAssessmentScore', 'gaitPattern', 'edemaGrading', 'transferAbility', 'postureAnalysis', 'cardiovascularResponse', 'patientCompliance', 'fallRiskAssessment', 'coordinationTesting'];
// Narrative strings → per-sentence editing (renderSentenceEditableField)
const NARRATIVE_STRING_FIELDS = ['dischargeReadiness'];
// Number → hide at 0 via numeric presence check
const NUMBER_FIELDS = ['painLevelNumericRating', 'functionalIndependenceMeasure', 'sixMinuteWalkTest', 'timedUpAndGoTest'];
// MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a valid clinical finding and must always show.
// painLevelNumericRating uses a 0-10 NRS where 0 = "no pain" — a real, recorded result, not "not measured".
// (FIM 18-126, 6-min walk distance, and TUG time have no meaningful 0, so they stay hide-zero.)
const MEANINGFUL_ZERO_FIELDS = ['painLevelNumericRating'];
// Arrays of strings → per-item editing with arrayIndex
const ARRAY_FIELDS = ['rangeOfMotionMeasurements', 'muscleStrengthGrading', 'assistiveDeviceUsed', 'neurologicalDeficits', 'treatmentInterventions', 'rehabilitationGoals'];

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

/* numeric presence check — 0 and absent are hidden, never truthiness */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'physical_therapy_notesPendingEdits';
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
const PhysicalTherapyNotesDocument = ({ document: docProp }) => {
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
    const pick = (r) => r?.physical_therapy_notes;
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      const p = pick(r);
      if (p) return Array.isArray(p) ? p : [p];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; const pp = pick(dd); if (pp) return Array.isArray(pp) ? pp : [pp]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const recordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayItem = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        if (isArrayItem) {
          // "field.N" → splice element N into the whole-array localEdit, mark editedFields "field-idx-iN"
          const baseField = fieldPart.slice(0, lastDot);
          const arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
          const editKey = `${baseField}-${idx}`;
          const base = nLocal[editKey] !== undefined
            ? nLocal[editKey]
            : (Array.isArray(record[baseField]) ? [...record[baseField]] : []);
          const arr = Array.isArray(base) ? [...base] : [];
          arr[arrayIndex] = value;
          nLocal[editKey] = arr;
          nPending[editKey] = true;
          nFields[`${baseField}-${idx}-i${arrayIndex}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, recordId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

  // Per-field presence
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn)) {
      // meaningful-zero numeric (pain NRS): 0 is a real recorded value, not "not measured"
      if (MEANINGFUL_ZERO_FIELDS.includes(fn)) {
        if (v === null || v === undefined || v === '') return false;
        const n = Number(v);
        return Number.isFinite(n);
      }
      return hasNumber(v);
    }
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    return hasVal(v);
  }, [hasVal]);

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

  /* display string for a field (arrays/numbers normalized) */
  const fieldDisplay = useCallback((fn, val) => {
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : fmtVal(val);
    return fmtVal(val);
  }, [fmtVal]);

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
      const rt = `Physical Therapy Note ${idx + 1}`.toLowerCase();
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
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
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

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, sentenceIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][field] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* array item edit — uses arrayIndex */
  // Array item Save = stage a DRAFT (whole array in localEdits for the PDF merge; per-element draft
  // in localStorage as "field.arrayIndex" so Approve can PUT the element with arrayIndex). NO DB write.
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    currentArr[arrayIndex] = saveVal;
    const editKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${field}.${arrayIndex}`] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, getFieldValue]);

  // Save one sentence = stage a DRAFT (full reconstructed text) locally + localStorage. NO DB write;
  // Approve commits. Survives refresh via the pending-drafts store.
  function saveSentence(record, field, idx, sectionId, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${field}-${idx}`;
    const stageDraft = (fullText) => {
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][field] = fullText;
      writeDrafts(store);
    };
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...allCurrent]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const updated = [...allCurrent]; updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const editedMap = {};
    editedMap[`${field}-${idx}-s${sentenceIdx}`] = 'edited';
    if (extraCount > 0) {
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${field}-${idx}-s${si}`] = 'added';
      }
    }
    setEditedSentences(prev => {
      const cleaned = {};
      for (const key of Object.keys(prev)) {
        if (!key.startsWith(`${field}-${idx}-s`)) cleaned[key] = prev[key];
      }
      return { ...cleaned, ...editedMap };
    });
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    stageDraft(fullText);
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
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Pull this record's staged drafts and commit those whose base field is in this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedFieldParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        const hasArrayIndex = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const field = hasArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart;
        if (!fields.includes(field)) continue;
        const payload = { field, value };
        if (hasArrayIndex) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/physical_therapy_notes/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/physical_therapy_notes/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      // Drop this section's committed drafts from localStorage
      if (committedFieldParts.length > 0) {
        committedFieldParts.forEach(fp => { delete recDrafts[fp]; });
        if (Object.keys(recDrafts).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[PhysicalTherapyNotes] Approve error:', err);
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
    const title = (SECTION_TITLES[sid] || '').toUpperCase();
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (NUMBER_FIELDS.includes(f)) {
        text += `${label}\n${fieldDisplay(f, val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        text += `${label}\n`;
        items.forEach((item) => { const p = parseLabel(String(item)); text += `  ${p.value || item}\n`; });
        text += '\n';
      } else {
        const strVal = fieldDisplay(f, val);
        const sentences = splitBySentence(strVal);
        if (NARRATIVE_STRING_FIELDS.includes(f) && sentences.length > 1) {
          text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fieldDisplay, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PHYSICAL THERAPY NOTES ===\n\n';
    pdfData.forEach((r, idx) => {
      const rt = `Physical Therapy Note ${idx + 1}`;
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

  /* ═══════ RENDER: NUMBER FIELD (hidden when 0/absent) ═══════ */
  // Hide-zero number fields stay visible at 0 ONLY when a doctor explicitly set them
  // (DB doctorEdits.editedFields or a this-session local edit) — so an intentional 0 shows
  // instead of vanishing, while extraction-0 noise stays hidden.
  const numberVisible = (record, fn, idx) => {
    const v = getFieldValue(record, fn, idx);
    // meaningful-zero numeric (pain NRS): a recorded 0 = "no pain" must always show
    if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return fieldHasVal(fn, v);
    if (hasNumber(v)) return true;
    if (localEdits[`${fn}-${idx}`] !== undefined && String(localEdits[`${fn}-${idx}`]).trim() !== '') return true;
    const de = record && record.doctorEdits && record.doctorEdits.editedFields;
    return Array.isArray(de) && de.includes(fn);
  };

  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!numberVisible(record, fn, idx)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, displayVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" step="any" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (String(editValue).trim() === '') { setSaveError('This field cannot be empty.'); return; } const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, 0, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
    if (NARRATIVE_STRING_FIELDS.includes(fn)) return renderSentenceEditableField(record, fn, idx, sid);
    return renderEditableField(record, fn, idx, sid);
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => NUMBER_FIELDS.includes(f) ? numberVisible(record, f, idx) : fieldHasVal(f, getFieldValue(record, f, idx)));
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
      <div className="physical-therapy-notes-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Physical Therapy Notes</h2></div>
        <div className="empty-state">No physical therapy note records available</div>
      </div>
    );
  }

  return (
    <div className="physical-therapy-notes-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Physical Therapy Notes</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PhysicalTherapyNotesDocumentPDFTemplate document={pdfData} />} fileName={`physical-therapy-notes-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search physical therapy notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `Physical Therapy Note ${idx + 1}`;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {renderSection(record, idx, 'mobility-function')}
              {renderSection(record, idx, 'strength-rom')}
              {renderSection(record, idx, 'balance-neuro')}
              {renderSection(record, idx, 'pain')}
              {renderSection(record, idx, 'treatment-goals')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhysicalTherapyNotesDocument;
