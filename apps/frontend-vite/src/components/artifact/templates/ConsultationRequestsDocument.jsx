/**
 * ConsultationRequestsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: consultation_requests
 *
 * 4 Sections:
 *   1. request-info: date, requestingProviderName, requestingDepartment, consultingSpecialty, consultingProviderName, urgencyLevel
 *   2. clinical-details: reasonForConsultation (sentence), clinicalQuestion
 *   3. diagnoses-studies: relevantDiagnoses (array), pertinentImagingStudies (array), pertinentLabResults (array), currentMedications (array)
 *   4. logistics: consultationMode, encounterType, authorizationRequired (boolean)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ConsultationRequestsDocumentPDFTemplate from '../pdf-templates/ConsultationRequestsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueTimePicker from '../components/BlueTimePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ConsultationRequestsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name, e.g. "reasonForConsultation") */
const DRAFT_KEY = 'consultation_requestsPendingEdits';
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
  'request-info': 'Request Information',
  scheduling: 'Scheduling',
  'clinical-details': 'Clinical Details',
  'diagnoses-studies': 'Diagnoses & Studies',
  logistics: 'Logistics',
};

const FIELD_LABELS = {
  date: 'Date',
  requestingProviderId: 'Requesting Provider ID',
  requestingProviderName: 'Requesting Provider',
  requestingDepartment: 'Requesting Department',
  consultingSpecialty: 'Consulting Specialty',
  consultingProviderId: 'Consulting Provider ID',
  consultingProviderName: 'Consulting Provider',
  urgencyLevel: 'Urgency Level',
  requestedDateTime: 'Requested Date/Time',
  desiredCompletionDateTime: 'Desired Completion Date/Time',
  appointmentScheduledDateTime: 'Appointment Scheduled Date/Time',
  reasonForConsultation: 'Reason for Consultation',
  clinicalQuestion: 'Clinical Question',
  priorityReason: 'Priority Reason',
  relevantDiagnoses: 'Relevant Diagnoses',
  pertinentImagingStudies: 'Pertinent Imaging Studies',
  pertinentLabResults: 'Pertinent Lab Results',
  currentMedications: 'Current Medications',
  supportingDocuments: 'Supporting Documents',
  consultationMode: 'Consultation Mode',
  encounterType: 'Encounter Type',
  locationOfService: 'Location of Service',
  requestIntent: 'Request Intent',
  authorizationRequired: 'Authorization Required',
  authorizationNumber: 'Authorization Number',
  performerInstructions: 'Performer Instructions',
};

const SECTION_FIELDS = {
  'request-info': ['requestingProviderId', 'requestingProviderName', 'requestingDepartment', 'consultingSpecialty', 'consultingProviderId', 'consultingProviderName', 'urgencyLevel'],
  scheduling: ['requestedDateTime', 'desiredCompletionDateTime', 'appointmentScheduledDateTime'],
  'clinical-details': ['reasonForConsultation', 'clinicalQuestion', 'priorityReason'],
  'diagnoses-studies': ['relevantDiagnoses', 'pertinentImagingStudies', 'pertinentLabResults', 'currentMedications', 'supportingDocuments'],
  logistics: ['consultationMode', 'encounterType', 'locationOfService', 'requestIntent', 'authorizationRequired', 'authorizationNumber', 'performerInstructions'],
};

const SENTENCE_FIELDS = ['reasonForConsultation', 'clinicalQuestion', 'priorityReason', 'performerInstructions'];
const ARRAY_FIELDS = ['relevantDiagnoses', 'pertinentImagingStudies', 'pertinentLabResults', 'currentMedications', 'supportingDocuments'];
const DATE_FIELDS = ['date'];
const DATETIME_FIELDS = ['requestedDateTime', 'desiredCompletionDateTime', 'appointmentScheduledDateTime'];
const isDateLike = (f) => DATE_FIELDS.includes(f) || DATETIME_FIELDS.includes(f);
const BOOLEAN_FIELDS = ['authorizationRequired'];

/* Fixed-choice fields → <select>. enumOptionsWith keeps an unmatched stored value as an extra option. */
const ENUM_FIELDS = {
  urgencyLevel: ['Routine', 'Urgent', 'STAT', 'Emergent'],
  consultationMode: ['In-person', 'Telehealth', 'Telephone', 'Video'],
  encounterType: ['Outpatient', 'Inpatient', 'Emergency', 'Observation'],
  requestIntent: ['Order', 'Proposal', 'Plan', 'Reflex order', 'Filler order'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* parseLabel: detect "Label: value" patterns in sentences — medical regex */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware; keep Oxford "and/or", skip no-space commas ("$18,000") and date commas ("January 8, 2026"). */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) result.push(t); cur = '';
    } else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ COMPONENT ═══════ */
const ConsultationRequestsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys staged as drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.consultation_requests) return Array.isArray(r.consultation_requests) ? r.consultation_requests : [r.consultation_requests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.consultation_requests) return Array.isArray(dd.consultation_requests) ? dd.consultation_requests : [dd.consultation_requests]; return [dd]; }
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
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  // Datetime fields (requestedDateTime etc.) carry a real time (e.g. 20:42) — show it; a midnight time is date-only.
  const formatDateTime = useCallback((d) => {
    if (!d) return '';
    try {
      const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d);
      const datePart = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (dt.getHours() === 0 && dt.getMinutes() === 0) return datePart;
      return `${datePart}, ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } catch { return String(d); }
  }, []);
  const fmtDateAny = useCallback((f, v) => DATETIME_FIELDS.includes(f) ? formatDateTime(v) : formatDate(v), [formatDate, formatDateTime]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  // Abbreviation+decimal guard: never break "Dr. Smith", "vs. standard", "3.5 mg"; splits on BOTH '.' and ';'.
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);
  // datetime <-> 'YYYY-MM-DDTHH:mm' for the combined BlueDatePicker+BlueTimePicker row.
  const toDateTimeLocal = useCallback((v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return ''; } }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getFieldValue: supports localEdits overlay */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  /* getEffectiveArray: for array fields with localEdits */
  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return Array.isArray(localEdits[k]) ? localEdits[k] : [localEdits[k]];
    const raw = record[fn];
    return Array.isArray(raw) ? raw : [];
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
    /* Also check date for request-info */
    const allFields = sid === 'request-info' ? ['date', ...fields] : fields;
    for (const f of allFields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) { if (String(item || '').toLowerCase().includes(phrase)) return true; }
        } else {
          const sv = isDateLike(f) ? fmtDateAny(f, val) : fmtVal(val);
          if (sv.toLowerCase().includes(phrase)) return true;
        }
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, formatDate]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) {
        for (const item of val) { if (String(item || '').toLowerCase().includes(phrase)) return true; }
      } else {
        const sv = isDateLike(fn) ? fmtDateAny(fn, val) : fmtVal(val);
        return sv.toLowerCase().includes(phrase);
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, formatDate]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Consultation Request ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Search all field content */
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item || '').toLowerCase().includes(phrase)) return true; }
          } else if (val && (isDateLike(f) ? fmtDateAny(f, val) : fmtVal(val)).toLowerCase().includes(phrase)) return true;
        }
      }
      /* Search date */
      if (record.date && formatDate(record.date).toLowerCase().includes(phrase)) return true;
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, formatDate]);

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
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { if (!(_sid && prev[`${_sid}-${idx}`])) return prev; const n = { ...prev }; delete n[`${_sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const arr = [...getEffectiveArray(record, fn, idx)];
    arr[arrayIndex] = editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = arr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  // Save one sentence = stage a DRAFT locally (+ localStorage). No DB write until Pending Approve.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const stage = (fullText, markers) => {
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, ...markers }));
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stage(fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
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
    stage(fullText, markers);
  }

  function saveCommaItem(record, fn, idx, sIdx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sentence = sentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return;
    const items = splitByComma(parsed.value);
    items[commaIdx] = newItemText.trim();
    const rebuilt = `${parsed.label}: ${items.join(', ')}.`;
    const allSentences = [...sentences];
    allSentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(allSentences);
    const commaKey = `${fn}-${idx}-s${sIdx}-c${commaIdx}`;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const allFields = sid === 'request-info' ? ['date', ...fields] : fields;
    return allFields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const allFields = sid === 'request-info' ? ['date', ...fields] : fields;
    setSaving(true); setSaveError(null);
    try {
      // localEdits keys are "field-idx"; commit only this section's pending fields.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const m = k.match(/^(.+)-(\d+)$/);
        if (!m || parseInt(m[2], 10) !== idx) return false;
        return allFields.includes(m[1]);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, editKey.lastIndexOf('-')); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/consultation_requests/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/consultation_requests/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed fields from the localStorage drafts
      const store = readDrafts();
      if (store[id]) {
        allFields.forEach(f => { if (store[id]) delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { allFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { allFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

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
        if (parts.length >= 3) {
          lines.push(parsed.label, COPY_LINE_DASH);
          parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        } else { lines.push(`${n++}. ${s}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  // EQ under the section title; DASH under every field label; every value row numbered "1.".
  // Returns '' when the section has no content so Copy All self-omits it.
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const emitScalar = (f, display) => { lines.push(FIELD_LABELS[f] || f, COPY_LINE_DASH, `1. ${display}`, ''); };
    const emitArray = (f, arr) => { lines.push(FIELD_LABELS[f] || f, COPY_LINE_DASH); arr.forEach((item, i) => lines.push(`${i + 1}. ${String(item || '')}`)); lines.push(''); };
    const emitSentence = (f, val) => { lines.push(FIELD_LABELS[f] || f, COPY_LINE_DASH); formatSentenceFieldLines(fmtVal(val)).forEach(l => lines.push(l)); lines.push(''); };

    if (sid === 'request-info') {
      if (record.date) emitScalar('date', formatDate(record.date));
      SECTION_FIELDS['request-info'].forEach(f => { const val = getFieldValue(record, f, idx); if (hasVal(val)) emitScalar(f, fmtVal(val)); });
    } else if (sid === 'scheduling') {
      SECTION_FIELDS.scheduling.forEach(f => { const val = getFieldValue(record, f, idx); if (hasVal(val)) emitScalar(f, fmtDateAny(f, val)); });
    } else if (sid === 'clinical-details') {
      SECTION_FIELDS['clinical-details'].forEach(f => { const val = getFieldValue(record, f, idx); if (!hasVal(val)) return; if (SENTENCE_FIELDS.includes(f)) emitSentence(f, val); else emitScalar(f, fmtVal(val)); });
    } else if (sid === 'diagnoses-studies') {
      SECTION_FIELDS['diagnoses-studies'].forEach(f => { const arr = getEffectiveArray(record, f, idx); if (arr.length > 0) emitArray(f, arr); });
    } else if (sid === 'logistics') {
      SECTION_FIELDS.logistics.forEach(f => { const val = getFieldValue(record, f, idx); if (!hasVal(val)) return; if (SENTENCE_FIELDS.includes(f)) emitSentence(f, val); else emitScalar(f, fmtVal(val)); });
    }
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatDate, fmtDateAny, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== CONSULTATION REQUESTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Consultation Request ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const block = buildSectionCopyText(r, idx, sid); if (block) text += `${block}\n`; });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDateField = DATE_FIELDS.includes(fn);
    const isDateTimeField = DATETIME_FIELDS.includes(fn);
    const isBool = BOOLEAN_FIELDS.includes(fn) || typeof val === 'boolean';
    const enumOpts = !isBool && ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const displayVal = isDateField ? formatDate(val) : isDateTimeField ? formatDateTime(val) : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const toDateInputVal = (v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };
    const startEdit = () => {
      setSaveError(null); setEditingField(editKey);
      if (isDateField) setEditValue(toDateInputVal(val));
      else if (isDateTimeField) setEditValue(toDateTimeLocal(val));
      else if (isBool) setEditValue(fmtVal(val));
      else if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); }
      else setEditValue(displayVal);
    };
    const datePart = editValue.slice(0, 10); const timePart = editValue.slice(11, 16);

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDateField ? (
                <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              ) : isDateTimeField ? (
                <div className="datetime-pickers-row">
                  <BlueDatePicker value={datePart} onSelect={iso => setEditValue(`${iso}T${timePart || '00:00'}`)} />
                  <BlueTimePicker value={timePart} onChange={hm => setEditValue(`${datePart || toDateInputVal(new Date())}T${hm}`)} />
                </div>
              ) : isBool ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation();
                  if (isDateField) { const testDate = new Date(editValue); if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, undefined, editValue + 'T00:00:00.000Z'); }
                  else if (isDateTimeField) { const d = new Date(editValue); if (isNaN(d.getTime())) { setSaveError('Please enter a valid date/time'); return; } handleSaveField(record, fn, idx, sid, undefined, d.toISOString()); }
                  else if (isBool) { handleSaveField(record, fn, idx, sid, undefined, editValue === 'Yes'); }
                  else { handleSaveField(record, fn, idx, sid); }
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
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

            /* parseLabel for Label: value patterns */
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 3) {
                /* Nested-subtitle + per-comma-item editing */
                return (
                  <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
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
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => {
                                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); }
                                }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sIdx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
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
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
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
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div>
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

  /* ═══════ RENDER: ARRAY SECTION (diagnoses, imaging, labs, medications) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, aIdx) => {
          const itemStr = String(item || '');
          const editKey = `${fn}-${idx}-a${aIdx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemMatches = phraseMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;
          return (
            <div key={aIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, aIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    /* Check if section has any content */
    const allFields = sid === 'request-info' ? ['date', ...fields] : fields;
    const hasAnyVal = allFields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
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
          {/* Date inside request-info — editable with date picker */}
          {sid === 'request-info' && record.date && (() => {
            const dateKey = `date-${idx}`; const isDateEditing = editingField === dateKey; const dateModified = editedFields[dateKey];
            const dateVal = localEdits[dateKey] !== undefined ? localEdits[dateKey] : record.date;
            const toDateInputVal = (v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };
            return (
              <div className="rec-mini-card">
                <div className="nested-subtitle">{highlightText('Date')}</div>
                <div className={`numbered-row ${dateModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isDateEditing) { setEditingField(dateKey); setEditValue(toDateInputVal(dateVal)); setSaveError(null); } }}>
                  {isDateEditing ? (
                    <div className="edit-field-container">
                      <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const testDate = new Date(editValue); if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, 'date', idx, 'request-info', undefined, editValue + 'T00:00:00.000Z', dateKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(formatDate(dateVal))}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[dateKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(formatDate(dateVal), dateKey); }}>{copiedItems[dateKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {dateModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })()}
          {fields.map(f => {
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="consultation-requests-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Consultation Requests</h2></div>
        <div className="empty-state">No consultation requests records available</div>
      </div>
    );
  }

  return (
    <div className="consultation-requests-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Consultation Requests</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ConsultationRequestsDocumentPDFTemplate document={pdfData} />} fileName="Consultation_Requests.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search consultation requests..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Consultation Request ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'request-info')}
            {renderSection(record, idx, 'scheduling')}
            {renderSection(record, idx, 'clinical-details')}
            {renderSection(record, idx, 'diagnoses-studies')}
            {renderSection(record, idx, 'logistics')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsultationRequestsDocument;
