/**
 * EmergencyDischargeSummariesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: emergency_discharge_summaries
 *
 * 10 Sections:
 *   1. arrival-info: chiefComplaint, arrivalDateTime (date), dischargeDateTime (date), triageCategory, modeOfArrival
 *   2. vitals-arrival: vitalSignsOnArrival.{temperature,bloodPressure,heartRate,respiratoryRate,oxygenSaturation,painScore}
 *   3. vitals-discharge: vitalSignsAtDischarge (dynamic object)
 *   4. diagnoses-section: emergencyDiagnoses[] (string array)
 *   5. procedures-imaging: proceduresPerformed[], imagingStudies[]
 *   6. lab-tests: laboratoryTests[]
 *   7. medications-section: medicationsAdministered[], dischargeMedications[]
 *   8. discharge-details: dischargeDisposition, dischargeCondition, ivAccessRemoved, workRestrictions
 *   9. followup-precautions: followUpInstructions (sentence), returnPrecautions (sentence), patientEducationProvided (sentence)
 *  10. care-team: attendingPhysician, consultingServices[], allergiesDocumented[]
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EmergencyDischargeSummariesDocumentPDFTemplate from '../pdf-templates/EmergencyDischargeSummariesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueTimePicker from '../components/BlueTimePicker';
import './EmergencyDischargeSummariesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'emergency_discharge_summariesPendingEdits';
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
  'arrival-info': 'Arrival Information',
  'vitals-arrival': 'Vital Signs on Arrival',
  'vitals-discharge': 'Vital Signs at Discharge',
  'diagnoses-section': 'Emergency Diagnoses',
  'procedures-imaging': 'Procedures & Imaging',
  'lab-tests': 'Laboratory Tests',
  'medications-section': 'Medications',
  'discharge-details': 'Discharge Details',
  'followup-precautions': 'Follow-Up & Precautions',
  'care-team': 'Care Team & Allergies',
};

const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint',
  arrivalDateTime: 'Arrival Date/Time',
  dischargeDateTime: 'Discharge Date/Time',
  triageCategory: 'Triage Category',
  modeOfArrival: 'Mode of Arrival',
  'vitalSignsOnArrival.temperature': 'Temperature',
  'vitalSignsOnArrival.bloodPressure': 'Blood Pressure',
  'vitalSignsOnArrival.heartRate': 'Heart Rate',
  'vitalSignsOnArrival.respiratoryRate': 'Respiratory Rate',
  'vitalSignsOnArrival.oxygenSaturation': 'Oxygen Saturation',
  'vitalSignsOnArrival.painScore': 'Pain Score',
  emergencyDiagnoses: 'Emergency Diagnoses',
  proceduresPerformed: 'Procedures Performed',
  imagingStudies: 'Imaging Studies',
  laboratoryTests: 'Laboratory Tests',
  medicationsAdministered: 'Medications Administered',
  dischargeMedications: 'Discharge Medications',
  dischargeDisposition: 'Discharge Disposition',
  dischargeCondition: 'Discharge Condition',
  ivAccessRemoved: 'IV Access Removed',
  workRestrictions: 'Work Restrictions',
  followUpInstructions: 'Follow-Up Instructions',
  returnPrecautions: 'Return Precautions',
  patientEducationProvided: 'Patient Education Provided',
  attendingPhysician: 'Attending Physician',
  consultingServices: 'Consulting Services',
  allergiesDocumented: 'Allergies Documented',
};

const SECTION_FIELDS = {
  'arrival-info': ['chiefComplaint', 'arrivalDateTime', 'dischargeDateTime', 'triageCategory', 'modeOfArrival'],
  'vitals-arrival': ['vitalSignsOnArrival.temperature', 'vitalSignsOnArrival.bloodPressure', 'vitalSignsOnArrival.heartRate', 'vitalSignsOnArrival.respiratoryRate', 'vitalSignsOnArrival.oxygenSaturation', 'vitalSignsOnArrival.painScore'],
  'vitals-discharge': ['vitalSignsAtDischarge'],
  'diagnoses-section': ['emergencyDiagnoses'],
  'procedures-imaging': ['proceduresPerformed', 'imagingStudies'],
  'lab-tests': ['laboratoryTests'],
  'medications-section': ['medicationsAdministered', 'dischargeMedications'],
  'discharge-details': ['dischargeDisposition', 'dischargeCondition', 'ivAccessRemoved', 'workRestrictions'],
  'followup-precautions': ['followUpInstructions', 'returnPrecautions', 'patientEducationProvided'],
  'care-team': ['attendingPhysician', 'consultingServices', 'allergiesDocumented'],
};

const ARRAY_FIELDS = ['emergencyDiagnoses', 'proceduresPerformed', 'imagingStudies', 'laboratoryTests', 'medicationsAdministered', 'dischargeMedications', 'consultingServices', 'allergiesDocumented'];
const SENTENCE_FIELDS = ['followUpInstructions', 'returnPrecautions', 'patientEducationProvided'];
const DATE_FIELDS = ['arrivalDateTime', 'dischargeDateTime'];
const VITAL_SIGNS_ON_ARRIVAL_SUBFIELDS = ['temperature', 'bloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'painScore'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: guarded — split on comma UNLESS inside (), around and/or, no-space, or in a date */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (text[i + 1] && text[i + 1] !== ' ') { current += ch; continue; }                 // no-space comma (2,024)
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }                           // ", and/or …"
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }                      // "… and/or ,"
      if (/\d\s*$/.test(current) && /^\d{4}\b/.test(rest)) { current += ch; continue; }       // date "Month D, YYYY"
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* splitNumberUnit: "18.5 ng/mL" → {num:'18.5', sep:' ', unit:'ng/mL'} so the stepper edits the number
   and LEAVES THE UNIT untouched. Returns null when the value is not a leading number+unit (ratios excluded). */
const splitNumberUnit = (text) => {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null;          // ratios (118/72) are not a stepper
  const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/);
  if (!m || !/\d/.test(m[1])) return null;
  return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() };
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    // timeZone UTC: the stored ISO carries the clinical wall-clock with a trailing Z — render it
    // as authored (TZ-independent) so display, edit picker, and stored value all agree.
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* toInputDateTime: string-parse the stored ISO into "YYYY-MM-DDTHH:mm" (wall-clock, no TZ math)
   for the BlueDatePicker + BlueTimePicker edit pair. */
const toInputDateTime = (dateValue) => {
  if (!dateValue) return '';
  const s = String(dateValue.$date || dateValue);
  const [datePart, rest] = s.split('T');
  if (!datePart) return '';
  return `${datePart}T${rest ? rest.slice(0, 5) : '00:00'}`;
};

/* ═══════ COMPONENT ═══════ */
const EmergencyDischargeSummariesDocument = ({ document: docProp }) => {
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
      if (r?.emergency_discharge_summaries) return Array.isArray(r.emergency_discharge_summaries) ? r.emergency_discharge_summaries : [r.emergency_discharge_summaries];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_discharge_summaries) return Array.isArray(dd.emergency_discharge_summaries) ? dd.emergency_discharge_summaries : [dd.emergency_discharge_summaries]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark the right "edited" marker so the section's Pending Approve button lights up.
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = lastDot === -1 ? fieldPart : (/^\d+$/.test(fieldPart.slice(lastDot + 1)) ? fieldPart.slice(0, lastDot) : fieldPart);
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          // array element: editedFields key is `${fn}.${arrIdx}-${idx}`
          nFields[editKey] = 'edited';
        } else if (SENTENCE_FIELDS.includes(baseField)) {
          nSentences[`${baseField}-${idx}-s0`] = 'edited';
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
  }, [records, safeId]);

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
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
      return val;
    }
    return record[fn];
  }, [localEdits]);

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
      if (f === 'vitalSignsAtDischarge') {
        const obj = record.vitalSignsAtDischarge;
        if (obj && typeof obj === 'object') {
          for (const v of Object.values(obj)) {
            if (v && String(v).toLowerCase().includes(phrase)) return true;
          }
        }
        continue;
      }
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
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
      const rt = `Emergency Discharge Summary ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (f === 'vitalSignsAtDischarge') {
            const obj = record.vitalSignsAtDischarge;
            if (obj && typeof obj === 'object') {
              for (const v of Object.values(obj)) { if (v && String(v).toLowerCase().includes(phrase)) return true; }
            }
            continue;
          }
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true; }
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
      if (record.vitalSignsOnArrival) merged.vitalSignsOnArrival = { ...record.vitalSignsOnArrival };
      if (record.vitalSignsAtDischarge) merged.vitalSignsAtDischarge = { ...record.vitalSignsAtDischarge };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m2 = key.match(/^(.+)-(\d+)$/);
        if (m2 && parseInt(m2[2]) === idx) {
          const fieldPath = m2[1];
          if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            if (parts.length === 2) {
              if (!merged[parts[0]]) merged[parts[0]] = {};
              merged[parts[0]][parts[1]] = localEdits[key];
            }
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT in the pending-drafts localStorage store (keyed by fieldPart = "field" or "field.arrayIndex").
  // Shared by all save handlers. NO DB write here — Approve (handleApproveSection) is the only DB writer.
  const stageDraft = useCallback((record, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT locally only (survives refresh). NOT written to MongoDB and NOT shown in the PDF
  // until the user clicks Approve. Whole-string fields incl. dotted subfields (e.g. vitalSignsOnArrival.x).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    stageDraft(record, fn, saveVal); // fieldPart = fn (no numeric trailing segment → whole field on approve)
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, val2) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setLocalEdits(prev => {
      const currentArr = [...(prev[`${fn}-${idx}`] || record[fn] || [])];
      currentArr[arrIdx] = val2;
      return { ...prev, [`${fn}-${idx}`]: currentArr };
    });
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // fieldPart = "fn.arrIdx" → committed as field=fn, arrayIndex=arrIdx on approve.
    stageDraft(record, `${fn}.${arrIdx}`, val2);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, stageDraft]);

  // Save one narrative sentence = stage a DRAFT only (no DB write). Approve commits it.
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
      stageDraft(record, fn, fullText);
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
    stageDraft(record, fn, fullText);
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values
  // now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Commit only this section's staged drafts. Draft store holds exact fieldParts
      // ("field" or "field.arrayIndex"); match a draft to this section by its base field name.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        const lastDot = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const baseField = isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart;
        if (!fields.includes(baseField)) continue; // belongs to another section
        const payload = { field: isArrayIdx ? baseField : fieldPart, value };
        if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/emergency_discharge_summaries/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedParts.push(fieldPart);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/emergency_discharge_summaries/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending for this section → committed edits now flow into pdfData/PDF.
      // pendingEdits keys use the localEdits convention `${baseField}-${idx}`.
      const pendingKeysToClear = committedParts.map(fp => {
        const lastDot = fp.lastIndexOf('.');
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fp.slice(lastDot + 1));
        const baseField = isArrayIdx ? fp.slice(0, lastDot) : fp;
        return `${baseField}-${idx}`;
      });
      setPendingEdits(prev => { const n = { ...prev }; pendingKeysToClear.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) { committedParts.forEach(fp => delete store[id][fp]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EmergencyDischargeSummaries] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
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
      } else {
        const parts = splitByComma(String(s).replace(/[;.]+$/, '').trim());
        if (parts.length >= 2) parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        else lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const DASH = '-'.repeat(40);
    const fields = SECTION_FIELDS[sid] || [];
    const sameAsTitle = (lbl) => String(lbl).toLowerCase() === String(title).toLowerCase();
    let body = '';
    fields.forEach(f => {
      if (f === 'vitalSignsAtDischarge') {
        const obj = record.vitalSignsAtDischarge;
        if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([k, v]) => {
            if (!hasVal(v)) return;
            const kl = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            body += `${kl}\n${DASH}\n1. ${fmtVal(v)}\n\n`;
          });
        }
        return;
      }
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const head = sameAsTitle(label) ? '' : `${label}\n${DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDateTime(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        body += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { body += `${l}\n`; });
        body += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        body += head;
        let an = 1;
        val.forEach(item => {
          if (item === null || item === undefined || String(item).trim() === '') return;
          const p = parseLabel(String(item));                 // labeled item → sub-label + DASH + value
          if (p.isLabeled) body += `${p.label}\n${DASH}\n1. ${p.value}\n\n`;
          else body += `${an++}. ${String(item)}\n`;
        });
        if (!body.endsWith('\n\n')) body += '\n';
      } else {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    if (!body) return '';                                    // empty-section guard → Copy All drops it
    return `${title}\n${'='.repeat(40)}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EMERGENCY DISCHARGE SUMMARIES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Emergency Discharge Summary ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE/TIME FIELD (BlueDatePicker + BlueTimePicker) ═══════ */
  /* arrivalDateTime / dischargeDateTime carry a clinically-meaningful TIME (ED arrival/discharge),
     so this edits BOTH date and time and recombines into the ISO — never zeroes the time. */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDateTime(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const datePart = (editValue.split('T')[0]) || '';
    const timePart = (editValue.split('T')[1]) || '';

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDateTime(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="datetime-edit-row">
                <BlueDatePicker value={datePart} onSelect={iso => setEditValue(`${iso || ''}T${timePart || '00:00'}`)} />
                <BlueTimePicker value={timePart} onChange={hm => setEditValue(`${datePart}T${hm}`)} />
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const d = editValue.split('T')[0]; const t = editValue.split('T')[1] || '00:00'; if (!d) { setSaveError('Please choose a date'); return; } handleSaveField(record, fn, idx, sid, null, `${d}T${t}:00.000Z`); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (string arrays with arrayIndex editing) ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!Array.isArray(val) || val.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();  // single-name: hide dup sub-label
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {val.map((item, arrIdx) => {
          if (item === null || item === undefined || String(item).trim() === '') return null;
          const itemText = String(item);
          // "Label: value" array item → nested-subtitle (label) + value row; number+unit value → stepper.
          const parsed = parseLabel(itemText);
          const editableVal = parsed.isLabeled ? parsed.value : itemText;
          const nu = splitNumberUnit(editableVal);
          const editKey = `${fn}.${arrIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          if (searchTerm.trim() && !contentMatches(itemText) && !sectionTitleMatches(sid)) return null;

          const row = (
            <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu ? nu.num : editableVal); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  {nu ? (
                    <div className="num-stepper-row">
                      <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); let n = (parseFloat(editValue) || 0) - (dec ? 0.1 : 1); if (n < 0) n = 0; setEditValue(String(Math.round(n * 100) / 100)); }}>−</button>
                      <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} autoFocus onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); const n = (parseFloat(editValue) || 0) + (dec ? 0.1 : 1); setEditValue(String(Math.round(n * 100) / 100)); }}>+</button>
                      {nu.unit && <span className="number-edit-unit">{nu.unit}</span>}
                    </div>
                  ) : (
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  )}
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const nv = nu ? `${String(editValue).trim()}${nu.unit ? `${nu.sep || ' '}${nu.unit}` : ''}` : editValue; const newItem = parsed.isLabeled ? `${parsed.label}: ${nv}` : nv; handleSaveArrayItem(record, fn, idx, arrIdx, newItem); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(editableVal)}</span><span className="edit-indicator">&#9998;</span></div>
                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
          );

          if (parsed.isLabeled) {
            return (
              <div key={arrIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                {row}
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }
          return (
            <div key={arrIdx}>
              {row}
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: VITAL SIGNS ON ARRIVAL (known subfields) ═══════ */
  const renderVitalSignsOnArrival = (record, idx, sid) => {
    const obj = record.vitalSignsOnArrival;
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

    return VITAL_SIGNS_ON_ARRIVAL_SUBFIELDS.map(subField => {
      const fn = `vitalSignsOnArrival.${subField}`;
      const val = getFieldValue(record, fn, idx);
      if (!hasVal(val)) return null;
      const editKey = `${fn}-${idx}`;
      const isEditing = editingField === editKey;
      const label = FIELD_LABELS[fn] || subField;
      const displayVal = fmtVal(val);
      const isModified = editedFields[editKey];
      if (searchTerm.trim() && !contentMatches(displayVal) && !sectionTitleMatches(sid)) return null;

      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
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
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: VITAL SIGNS AT DISCHARGE (dynamic object) ═══════ */
  const renderVitalSignsAtDischarge = (record, idx, sid) => {
    const obj = record.vitalSignsAtDischarge;
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

    return Object.entries(obj).map(([subField, val]) => {
      if (!hasVal(val)) return null;
      const fn = `vitalSignsAtDischarge.${subField}`;
      const editKey = `${fn}-${idx}`;
      const isEditing = editingField === editKey;
      const label = subField.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      const displayVal = fmtVal(localEdits[editKey] !== undefined ? localEdits[editKey] : val);
      const isModified = editedFields[editKey];
      if (searchTerm.trim() && !contentMatches(displayVal) && !sectionTitleMatches(sid)) return null;

      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
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
                <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, fn, fullText2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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

            /* UNLABELED sentence that is a comma list → per-comma editable rows (guarded split:
               never inside (), never around and/or, keeps no-space + date commas). */
            if (!parsed.isLabeled) {
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const items2 = splitByComma(String(sentences2[sIdx] || '').replace(/[;.]+$/, '').trim()); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (!trimmed) { items2.splice(ciIdx, 1); } else if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const allS = [...sentences2]; allS[sIdx] = items2.join(', '); const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, fn, fullText2); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); stageDraft(record, fn, fullText); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
      if (f === 'vitalSignsAtDischarge') {
        const obj = record.vitalSignsAtDischarge;
        return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
      }
      if (f.startsWith('vitalSignsOnArrival.')) {
        const parts = f.split('.');
        return hasVal(record.vitalSignsOnArrival?.[parts[1]]);
      }
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
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
          {sid === 'vitals-arrival' ? renderVitalSignsOnArrival(record, idx, sid) : sid === 'vitals-discharge' ? renderVitalSignsAtDischarge(record, idx, sid) : fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
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
      <div className="emergency-discharge-summaries-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Emergency Discharge Summaries</h2></div>
        <div className="empty-state">No emergency discharge summary records available</div>
      </div>
    );
  }

  return (
    <div className="emergency-discharge-summaries-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Emergency Discharge Summaries</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EmergencyDischargeSummariesDocumentPDFTemplate document={pdfData} />} fileName="Emergency_Discharge_Summaries.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search emergency discharge summaries..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Emergency Discharge Summary ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'arrival-info')}
            {renderSection(record, idx, 'vitals-arrival')}
            {renderSection(record, idx, 'vitals-discharge')}
            {renderSection(record, idx, 'diagnoses-section')}
            {renderSection(record, idx, 'procedures-imaging')}
            {renderSection(record, idx, 'lab-tests')}
            {renderSection(record, idx, 'medications-section')}
            {renderSection(record, idx, 'discharge-details')}
            {renderSection(record, idx, 'followup-precautions')}
            {renderSection(record, idx, 'care-team')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyDischargeSummariesDocument;
