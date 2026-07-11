/**
 * DoctorsMedicationRecommendationsDocument.jsx
 * June 2026 — Doctor's Medication Recommendations (unified flat schema)
 * Data collection: doctors_medications_recommendations (PLURAL)
 * Edit route + sda.update collection arg: doctors_medications_recommendations (PLURAL)
 *
 * 28 extractable schema fields (unified-medical-schemas.json), 100% covered:
 *   date(Date,header), provider, facility, prescribedMedication, medicationClass,
 *   dosageAmount, dosageFrequency, routeOfAdministration, durationOfTreatment,
 *   indicationForUse, prescriptionStartDate(Date), prescriptionEndDate(Date),
 *   refillsAuthorized(number), specialInstructions, contraindicationsNoted(array),
 *   knownAllergies(array), potentialInteractions(array), therapeuticGoal,
 *   monitoringParameters(array), adverseEffectsDiscussed(array),
 *   alternativeMedicationsConsidered(array), priorMedicationTrials(array),
 *   requiresPriorAuthorization, prescriptionMethod, pharmacyDetails,
 *   followUpRecommendation, patientCounselingCompleted, reasonForChange
 *
 * 5 Sections:
 *   1. medication-details:   prescribedMedication, medicationClass, dosageAmount,
 *                            dosageFrequency, routeOfAdministration, durationOfTreatment,
 *                            specialInstructions
 *   2. prescription:         prescriptionStartDate, prescriptionEndDate, refillsAuthorized,
 *                            requiresPriorAuthorization, prescriptionMethod, pharmacyDetails
 *   3. clinical-rationale:   indicationForUse, therapeuticGoal, priorMedicationTrials,
 *                            alternativeMedicationsConsidered, reasonForChange
 *   4. safety:               knownAllergies, contraindicationsNoted, potentialInteractions,
 *                            adverseEffectsDiscussed, monitoringParameters
 *   5. context:              provider, facility, followUpRecommendation,
 *                            patientCounselingCompleted, date
 *
 * Field handling:
 *   - SIMPLE STRINGS → click-to-edit textarea (renderEditableField)
 *   - NARRATIVE STRINGS (indicationForUse, specialInstructions, therapeuticGoal,
 *       followUpRecommendation, reasonForChange) → per-sentence editing (renderSentenceEditableField)
 *   - NUMBER (refillsAuthorized) → renderNumberField (parseFloat + isNaN guard + hide-zero)
 *   - DATES (date, prescriptionStartDate, prescriptionEndDate) → renderDateField date-picker;
 *       formatted; 1970-epoch / null hidden
 *   - ARRAYS → renderArrayField (per-item editing with arrayIndex)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DoctorsMedicationRecommendationsDocumentPDFTemplate from '../pdf-templates/DoctorsMedicationRecommendationsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './DoctorsMedicationRecommendationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   The key is chosen per active schema (see DRAFT_KEY in the component).
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const readDrafts = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (key, store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(key, JSON.stringify(store));
    else localStorage.removeItem(key);
  } catch { /* ignore quota/availability errors */ }
};

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* ═══════ CONSTANTS — UNIFIED (plural) schema: doctors_medications_recommendations (28 fields) ═══════ */
const UNIFIED_SECTION_TITLES = {
  'medication-details': 'Medication Details',
  'prescription': 'Prescription',
  'clinical-rationale': 'Clinical Rationale',
  'safety': 'Safety',
  'context': 'Context',
};

const UNIFIED_FIELD_LABELS = {
  prescribedMedication: 'Prescribed Medication',
  medicationClass: 'Medication Class',
  dosageAmount: 'Dosage Amount',
  dosageFrequency: 'Dosage Frequency',
  routeOfAdministration: 'Route of Administration',
  durationOfTreatment: 'Duration of Treatment',
  specialInstructions: 'Special Instructions',
  prescriptionStartDate: 'Prescription Start Date',
  prescriptionEndDate: 'Prescription End Date',
  refillsAuthorized: 'Refills Authorized',
  requiresPriorAuthorization: 'Requires Prior Authorization',
  prescriptionMethod: 'Prescription Method',
  pharmacyDetails: 'Pharmacy Details',
  indicationForUse: 'Indication for Use',
  therapeuticGoal: 'Therapeutic Goal',
  priorMedicationTrials: 'Prior Medication Trials',
  alternativeMedicationsConsidered: 'Alternative Medications Considered',
  reasonForChange: 'Reason for Change',
  knownAllergies: 'Known Allergies',
  contraindicationsNoted: 'Contraindications Noted',
  potentialInteractions: 'Potential Interactions',
  adverseEffectsDiscussed: 'Adverse Effects Discussed',
  monitoringParameters: 'Monitoring Parameters',
  provider: 'Provider',
  facility: 'Facility',
  followUpRecommendation: 'Follow-Up Recommendation',
  patientCounselingCompleted: 'Patient Counseling Completed',
  date: 'Date',
};

const UNIFIED_SECTION_FIELDS = {
  'medication-details': ['prescribedMedication', 'medicationClass', 'dosageAmount', 'dosageFrequency', 'routeOfAdministration', 'durationOfTreatment', 'specialInstructions'],
  'prescription': ['prescriptionStartDate', 'prescriptionEndDate', 'refillsAuthorized', 'requiresPriorAuthorization', 'prescriptionMethod', 'pharmacyDetails'],
  'clinical-rationale': ['indicationForUse', 'therapeuticGoal', 'priorMedicationTrials', 'alternativeMedicationsConsidered', 'reasonForChange'],
  'safety': ['knownAllergies', 'contraindicationsNoted', 'potentialInteractions', 'adverseEffectsDiscussed', 'monitoringParameters'],
  'context': ['provider', 'facility', 'followUpRecommendation', 'patientCounselingCompleted', 'date'],
};

const UNIFIED_NARRATIVE_FIELDS = ['indicationForUse', 'specialInstructions', 'therapeuticGoal', 'followUpRecommendation', 'reasonForChange'];
const UNIFIED_NUMBER_FIELDS = ['refillsAuthorized'];
const UNIFIED_DATE_FIELDS = ['date', 'prescriptionStartDate', 'prescriptionEndDate'];
const UNIFIED_ARRAY_FIELDS = ['contraindicationsNoted', 'knownAllergies', 'potentialInteractions', 'monitoringParameters', 'adverseEffectsDiscussed', 'alternativeMedicationsConsidered', 'priorMedicationTrials'];
const UNIFIED_ENUM_FIELDS = {};
const UNIFIED_MEASURE_FIELDS = ['dosageAmount']; // number+unit stepper; ranges fall back to text

/* ═══════ CONSTANTS — FLAT (singular legacy) schema: doctors_medication_recommendations (9 fields)
   date, medication, dosage, frequency, duration, indication, route, priority, provider ═══════ */
const FLAT_SECTION_TITLES = {
  'medication': 'Medication',
  'clinical-rationale': 'Clinical Rationale',
  'context': 'Context',
};

const FLAT_FIELD_LABELS = {
  medication: 'Medication',
  dosage: 'Dosage',
  frequency: 'Frequency',
  route: 'Route',
  duration: 'Duration',
  indication: 'Indication',
  priority: 'Priority',
  provider: 'Provider',
  date: 'Date',
};

const FLAT_SECTION_FIELDS = {
  'medication': ['medication', 'dosage', 'frequency', 'route', 'duration'],
  'clinical-rationale': ['indication', 'priority'],
  'context': ['provider', 'date'],
};

const FLAT_NARRATIVE_FIELDS = ['indication'];
const FLAT_NUMBER_FIELDS = [];
const FLAT_DATE_FIELDS = ['date'];
const FLAT_ARRAY_FIELDS = [];
// Known clinical scales → full-scale dropdown (memory 6a4908b2); stored value kept via enumOptionsWith
const FLAT_ENUM_FIELDS = {
  route: ['Oral', 'Sublingual', 'Buccal', 'Intravenous (IV)', 'Intramuscular (IM)', 'Subcutaneous', 'Topical', 'Transdermal', 'Inhaled', 'Nasal', 'Rectal', 'Ophthalmic', 'Otic'],
  priority: ['Low', 'Medium', 'High'],
};
const FLAT_MEASURE_FIELDS = ['dosage']; // "100 mg" → number+unit stepper (unit preserved)

/* Detect the FLAT (singular legacy) schema — its records carry `medication`/`indication`/`priority`,
   never the unified `prescribedMedication`. */
const isFlatRecord = (r) => !!r && typeof r === 'object' && (
  Object.prototype.hasOwnProperty.call(r, 'medication') ||
  Object.prototype.hasOwnProperty.call(r, 'indication') ||
  Object.prototype.hasOwnProperty.call(r, 'priority')
) && !Object.prototype.hasOwnProperty.call(r, 'prescribedMedication');

/* ENUM display/select helpers (edit-widget-only; stored value unchanged unless edited) */
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const enumOptionsWith = (options, current) => {
  const canon = enumCanonical(options, current);
  if (canon && !(options || []).some(o => o.toLowerCase() === canon.toLowerCase())) return [canon, ...(options || [])];
  return options || [];
};

/* splitGuardedComma: comma split with the 4 guards (memory 6a4771843) — paren-aware; skip no-space
   commas ("$18,000"); keep Oxford ", and/or X" attached on EITHER side; skip date commas
   ("January 8, 2026"); next non-space char must be a letter / '(' / '>'. */
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

/* Number stepper (decimal-aware step = the value's own precision, memory 6a4a3fae — NOT a fixed jump) */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* splitNumberUnit: "100 mg" → {num:'100', sep:' ', unit:'mg'}; ranges/ratios/descriptive → null (text) */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*[-–]\s*\d/.test(s)) return null; // ranges like "100-150 mg" stay text
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;         // ratios like "142/88" stay text
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1]) || /\d/.test(m[3])) return null;    // unit must be number-free
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
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

/* numeric presence check — 0 and absent are hidden, never truthiness */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

/* date presence + format — null / 1970-epoch hidden */
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === 'object' && v.$date) d = new Date(v.$date);
  else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return null;
  return d;
};
const hasDate = (v) => parseDate(v) !== null;
const fmtDate = (v) => {
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* ═══════ COMPONENT ═══════ */
const DoctorsMedicationRecommendationsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  // Value = the PUT payload to replay on approve: { field, value, arrayIndex? }
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
    const pick = (r) => r?.doctors_medications_recommendations || r?.doctors_medication_recommendations;
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      const p = pick(r);
      if (p) return Array.isArray(p) ? p : [p];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; const pp = pick(dd); if (pp) return Array.isArray(pp) ? pp : [pp]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ ACTIVE SCHEMA CONFIG ═══════
     Both the singular legacy collection (doctors_medication_recommendations — flat 9-field) and the
     plural unified collection (doctors_medications_recommendations — 28-field) route to this ONE
     component. A single artifact view is always one collection, so pick the config from records[0]. */
  const isFlat = useMemo(() => records.length > 0 && isFlatRecord(records[0]), [records]);
  const SECTION_TITLES = isFlat ? FLAT_SECTION_TITLES : UNIFIED_SECTION_TITLES;
  const FIELD_LABELS = isFlat ? FLAT_FIELD_LABELS : UNIFIED_FIELD_LABELS;
  const SECTION_FIELDS = isFlat ? FLAT_SECTION_FIELDS : UNIFIED_SECTION_FIELDS;
  const NARRATIVE_STRING_FIELDS = isFlat ? FLAT_NARRATIVE_FIELDS : UNIFIED_NARRATIVE_FIELDS;
  const NUMBER_FIELDS = isFlat ? FLAT_NUMBER_FIELDS : UNIFIED_NUMBER_FIELDS;
  const DATE_FIELDS = isFlat ? FLAT_DATE_FIELDS : UNIFIED_DATE_FIELDS;
  const ARRAY_FIELDS = isFlat ? FLAT_ARRAY_FIELDS : UNIFIED_ARRAY_FIELDS;
  const ENUM_FIELDS = isFlat ? FLAT_ENUM_FIELDS : UNIFIED_ENUM_FIELDS;
  const MEASURE_FIELDS = isFlat ? FLAT_MEASURE_FIELDS : UNIFIED_MEASURE_FIELDS;
  // Edit/approve route + draft key must match the record's actual collection (singular vs plural).
  const EDIT_COLLECTION = isFlat ? 'doctors_medication_recommendations' : 'doctors_medications_recommendations';
  const DRAFT_KEY = isFlat ? 'doctors_medication_recommendationsPendingEdits' : 'doctors_medications_recommendationsPendingEdits';
  const RECORD_TITLE = "Doctor's Medication Recommendations";

  /* Stable record-id resolver (handles string _id and { $oid }). */
  const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft fieldPart: "field" (scalar/narrative) or "field.arrayIndex" (array item). */
  useEffect(() => {
    const store = readDrafts(DRAFT_KEY);
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      // group array-item drafts by base field so we rebuild the full array under `${field}-${idx}`
      const arrayBuf = {};
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(trailing);
        if (isArrayItem) {
          const baseField = fieldPart.slice(0, dotIdx);
          const aIdx = parseInt(trailing, 10);
          if (!arrayBuf[baseField]) {
            const cur = record[baseField];
            arrayBuf[baseField] = Array.isArray(cur) ? [...cur] : [];
          }
          arrayBuf[baseField][aIdx] = value;
          nPending[`${baseField}-${idx}-i${aIdx}`] = { field: baseField, value, arrayIndex: aIdx };
          nFields[`${baseField}-${idx}-i${aIdx}`] = 'edited';
        } else {
          nLocal[`${fieldPart}-${idx}`] = value;
          nPending[`${fieldPart}-${idx}`] = { field: fieldPart, value };
          if (NARRATIVE_STRING_FIELDS.includes(fieldPart)) {
            nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
          }
          nFields[`${fieldPart}-${idx}`] = 'edited';
        }
      });
      Object.entries(arrayBuf).forEach(([baseField, arr]) => {
        nLocal[`${baseField}-${idx}`] = arr;
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

  // Per-field presence
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
    if (DATE_FIELDS.includes(fn)) return hasDate(v);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    return hasVal(v);
  }, [hasVal]);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const splitBySemicolon = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s*/).map(s => s.trim()).filter(s => s);
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* Narrative-field LEAVES: sentence → semicolon part → guarded-comma item (≥2 → one leaf per item,
     else the whole part). Address = (sIdx, pi, ci). Mirrors the copy + PDF split. */
  const buildSentenceLeaves = useCallback((text) => {
    const leaves = [];
    splitBySentence(text).forEach((s, sIdx) => {
      splitBySemicolon(s).forEach((part, pi) => {
        const items = splitGuardedComma(part);
        if (items.length >= 2) {
          items.forEach((it, ci) => leaves.push({ sIdx, pi, ci, comma: true, text: it.replace(/[;.]+$/, '').trim() }));
        } else {
          leaves.push({ sIdx, pi, ci: 0, comma: false, text: part.replace(/[;.]+$/, '').trim() });
        }
      });
    });
    return leaves;
  }, [splitBySentence, splitBySemicolon]);

  /* −/+ number stepper edit (decimal-aware step; clamp ≥0 — no negative dosages) */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const stepStr = stepFor(prev); const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat(((isNaN(n) ? 0 : n) + dir * step).toFixed(decimals));
      if (next < 0) next = 0;
      return String(next);
    });
  };

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

  /* display string for a field (dates formatted, enums canonicalized, arrays joined) */
  const fieldDisplay = useCallback((fn, val) => {
    if (DATE_FIELDS.includes(fn)) return fmtDate(val);
    if (ENUM_FIELDS[fn]) return enumCanonical(ENUM_FIELDS[fn], val) || fmtVal(val);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : fmtVal(val);
    return fmtVal(val);
  }, [fmtVal, DATE_FIELDS, ENUM_FIELDS, ARRAY_FIELDS]);

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
      const rt = `Doctor's Medication Recommendations ${idx + 1}`.toLowerCase();
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
        // pending drafts stay OUT of the PDF/Copy All until approved.
        // pendingEdits keys: `${field}-${idx}` (scalar/narrative) or `${field}-${idx}-i${aIdx}` (array item).
        if (pendingEdits[key] || Object.keys(pendingEdits).some(pk => pk.startsWith(`${key}-i`))) return;
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
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, sentenceIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: { field, value: saveVal } }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts(DRAFT_KEY);
    if (!store[id]) store[id] = {};
    store[id][field] = saveVal;
    writeDrafts(DRAFT_KEY, store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* array item edit — uses arrayIndex */
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    setSaveError(null);
    currentArr[arrayIndex] = saveVal;
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: { field, value: saveVal, arrayIndex } }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts(DRAFT_KEY);
    if (!store[id]) store[id] = {};
    store[id][`${field}.${arrayIndex}`] = saveVal;
    writeDrafts(DRAFT_KEY, store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  // Save one sentence = stage a DRAFT locally (full reconstructed text) + persist to localStorage.
  // NOT written to MongoDB and NOT shown in the PDF until Approve (handleApproveSection commits).
  function saveSentence(record, field, idx, sectionId, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const allCurrent = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stage = (fullText, editedMap) => {
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: { field, value: fullText } }));
      if (editedMap) {
        setEditedSentences(prev => {
          const cleaned = {};
          for (const key of Object.keys(prev)) {
            if (!key.startsWith(`${field}-${idx}-s`)) cleaned[key] = prev[key];
          }
          return { ...cleaned, ...editedMap };
        });
      }
      setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
      const store = readDrafts(DRAFT_KEY);
      if (!store[id]) store[id] = {};
      store[id][field] = fullText;
      writeDrafts(DRAFT_KEY, store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...allCurrent]; updated.splice(sentenceIdx, 1);
      stage(reconstructFullText(updated), null);
      return;
    }
    const updated = [...allCurrent]; updated[sentenceIdx] = editedVal;
    const fullText = reconstructFullText(updated);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    const editedMap = {};
    editedMap[`${field}-${idx}-s${sentenceIdx}`] = 'edited';
    if (extraCount > 0) {
      for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
        editedMap[`${field}-${idx}-s${si}`] = 'added';
      }
    }
    stage(fullText, editedMap);
  }

  /* Save ONE leaf of a narrative field addressed by (sIdx, pi=semicolon part, ci=guarded-comma item).
     Rebuilds part = items.join(', '), sentence = parts.join('; '), full = sentences.join('. ').
     Empty edit removes the leaf; pasting multiple comma parts splices them in. */
  function saveSentenceLeaf(record, field, idx, sectionId, sIdx, pi, ci, isComma) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, field, idx) || '');
    const sentences = splitBySentence(currentVal);
    const semParts = splitBySemicolon(sentences[sIdx] || '');
    const edited = editValue.trim();
    if (isComma) {
      const items = splitGuardedComma(semParts[pi] || '');
      if (!edited || /^[;.,!?]+$/.test(edited)) { items.splice(ci, 1); }
      else { const subParts = splitGuardedComma(edited); if (subParts.length > 1) items.splice(ci, 1, ...subParts); else items[ci] = edited; }
      semParts[pi] = items.join(', ');
    } else {
      if (!edited || /^[;.,!?]+$/.test(edited)) { semParts.splice(pi, 1); }
      else { semParts[pi] = edited; }
    }
    sentences[sIdx] = semParts.filter(p => p && p.trim()).join('; ');
    const fullText = reconstructFullText(sentences.filter(s => s && s.trim()));
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${field}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${field}-${idx}`]: { field, value: fullText } }));
    setEditedSentences(prev => ({ ...prev, [`${field}-${idx}-s${sIdx}-p${pi}-c${ci}`]: 'edited' }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });
    const store = readDrafts(DRAFT_KEY);
    if (!store[id]) store[id] = {};
    store[id][field] = fullText;
    writeDrafts(DRAFT_KEY, store);
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Collect this section+record's staged drafts: keys are `${field}-${idx}` or `${field}-${idx}-i${aIdx}`.
      const toCommit = Object.keys(pendingEdits).filter(k => {
        const payload = pendingEdits[k];
        if (!payload || !fields.includes(payload.field)) return false;
        return k === `${payload.field}-${idx}` || k.startsWith(`${payload.field}-${idx}-i`);
      });
      for (const key of toCommit) {
        const { field, value, arrayIndex } = pendingEdits[key];
        const payload = { field, value };
        if (typeof arrayIndex === 'number') payload.arrayIndex = arrayIndex;
        await secureApiClient.put(`/api/edit/${EDIT_COLLECTION}/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/${EDIT_COLLECTION}/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record+section's drafts from localStorage (now committed)
      const store = readDrafts(DRAFT_KEY);
      if (store[id]) {
        Object.keys(store[id]).forEach(fieldPart => {
          const base = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
          if (fields.includes(base)) delete store[id][fieldPart];
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(DRAFT_KEY, store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[DoctorsMedicationRecommendations] Approve error:', err);
      setSaveError('Save failed. Please try again.');
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

  /* ═══════ FORMAT HELPERS FOR COPY ═══════
     Sentence field → number every row; a labeled sentence becomes a sub-label + DASH divider with its
     comma parts numbered under it (restart); unlabeled sentences share one running count. */
  const formatSentenceFieldLines = useCallback((text) => {
    const leaves = buildSentenceLeaves(text);
    return leaves.map((leaf, i) => `${i + 1}. ${leaf.text}`);
  }, [buildSentenceLeaves]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = (SECTION_TITLES[sid] || '');
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => fieldHasVal(f, getFieldValue(record, f, idx)));
    if (present.length === 0) return '';
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    present.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      const sl = label.toLowerCase() !== title.toLowerCase(); // single-name rule
      if (ARRAY_FIELDS.includes(f)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        items.forEach((item, i) => { const p = parseLabel(String(item)); text += `${i + 1}. ${p.value || item}\n`; });
        text += '\n';
      } else if (NARRATIVE_STRING_FIELDS.includes(f)) {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fieldDisplay(f, val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        text += `1. ${fieldDisplay(f, val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, fieldHasVal, fieldDisplay, formatSentenceFieldLines, SECTION_TITLES, SECTION_FIELDS, FIELD_LABELS, ARRAY_FIELDS, NARRATIVE_STRING_FIELDS]);

  const copyAllText = useCallback(async () => {
    let text = `${RECORD_TITLE}\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      const rt = `${RECORD_TITLE} ${idx + 1}`;
      text += `${rt}\n${COPY_LINE_EQ}\n\n`;
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
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, displayVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" step="any" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, 0, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: DATE FIELD (formatted; epoch/null hidden) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    const displayVal = fmtDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isoVal = (() => { const d = parseDate(val); return d ? d.toISOString().split('T')[0] : ''; })();

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, isoVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, 0, editValue ? `${editValue}T00:00:00.000Z` : ''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rawArr = Array.isArray(val) ? val : splitByComma(String(val));
    const items = rawArr.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: NARRATIVE FIELD — sentence→semicolon→comma LEAVES, per-leaf editing ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const strVal = fmtVal(val);
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const leaves = buildSentenceLeaves(strVal);
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {leaves.map((leaf) => {
          const leafKey = `${fn}-${idx}-s${leaf.sIdx}-p${leaf.pi}-c${leaf.ci}`;
          const isEditing = editingField === leafKey;
          const badge = editedSentences[leafKey];
          const leafMatches = phraseMatch || labelMatch || (searchTerm.trim() && leaf.text.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!leafMatches && searchTerm.trim()) return null;

          return (
            <div key={leafKey}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(leaf.text); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentenceLeaf(record, fn, idx, sid, leaf.sIdx, leaf.pi, leaf.ci, leaf.comma); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(leaf.text)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leaf.text, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: MEASURE FIELD — number+unit −/+ stepper (unit preserved) ═══════ */
  const renderMeasureField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const nu = splitNumberUnit(fmtVal(val));
    if (!nu) return renderEditableField(record, fn, idx, sid); // ranges / descriptive → plain text edit
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const strVal = `${nu.num}${nu.sep}${nu.unit}`;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu.num); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="number-edit-row">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                  <input type="number" step={stepFor(editValue)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
                </div>
                {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, 0, nu.unit ? `${n}${nu.sep}${nu.unit}` : String(n)); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ENUM FIELD — known clinical scale <select> ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase(); // single-name rule
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(ENUM_FIELDS[fn], val);
    const displayVal = enumCanonical(ENUM_FIELDS[fn], val) || fmtVal(val);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, displayVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, 0, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ FIELD DISPATCH ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (ENUM_FIELDS[fn]) return renderEnumField(record, fn, idx, sid);
    if (MEASURE_FIELDS.includes(fn)) return renderMeasureField(record, fn, idx, sid);
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
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
      <div className="doctors-medication-recommendations-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Doctor's Medication Recommendations</h2></div>
        <div className="empty-state">No medication recommendation records available</div>
      </div>
    );
  }

  return (
    <div className="doctors-medication-recommendations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Doctor's Medication Recommendations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DoctorsMedicationRecommendationsDocumentPDFTemplate document={pdfData} />} fileName="Doctors_Medication_Recommendations.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search medication recommendations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `${RECORD_TITLE} ${idx + 1}`;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DoctorsMedicationRecommendationsDocument;
