import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ArthritisAssessmentsDocumentPDFTemplate from '../pdf-templates/ArthritisAssessmentsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ArthritisAssessmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = localEdits key minus the "-<idx>" suffix) */
const DRAFT_KEY = 'arthritis_assessmentsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/**
 * Arthritis Assessments Document Template
 * Inline editing with per-section approve (one-way: Pending -> Approved)
 * 4-level search hierarchy: Document -> Section -> Label -> Row
 * Bar chart visualization for CRP and ESR inflammatory markers (display-only)
 * PDFDownloadLink + pdfData memo pattern
 * Uses secureApiClient (no response.success check - returns raw data)
 */

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  date: 'Assessment Date',
  arthritisType: 'Arthritis Type',
  affectedJoints: 'Affected Joints',
  painLevel: 'Pain Level',
  stiffness: 'Stiffness',
  swelling: 'Swelling',
  functionalLimitations: 'Functional Limitations',
  diseaseActivity: 'Disease Activity',
  inflammatoryMarkers: 'Inflammatory Markers',
  serology: 'Serology',
  imaging: 'Imaging',
  currentMedications: 'Current Medications',
  medicationResponse: 'Medication Response',
  sideEffects: 'Side Effects',
  treatmentPlan: 'Treatment Plan',
  physicalTherapy: 'Physical Therapy',
  followUp: 'Follow Up',
  rheumatologist: 'Rheumatologist',
  facility: 'Facility',
  notes: 'Notes',
};

const FIELD_LABELS = {
  date: 'Assessment Date',
  arthritisType: 'Arthritis Type',
  affectedJoints: 'Affected Joints',
  painLevel: 'Pain Level',
  stiffness: 'Stiffness',
  swelling: 'Swelling',
  functionalLimitations: 'Functional Limitations',
  diseaseActivity: 'Disease Activity',
  inflammatoryMarkers: 'Inflammatory Markers',
  serology: 'Serology',
  imaging: 'Imaging',
  currentMedications: 'Current Medications',
  medicationResponse: 'Medication Response',
  sideEffects: 'Side Effects',
  treatmentPlan: 'Treatment Plan',
  physicalTherapy: 'Physical Therapy',
  followUp: 'Follow Up',
  rheumatologist: 'Rheumatologist',
  facility: 'Facility',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  date: ['date'],
  arthritisType: ['arthritisType'],
  affectedJoints: ['affectedJoints'],
  painLevel: ['painLevel'],
  stiffness: ['stiffness'],
  swelling: ['swelling'],
  functionalLimitations: ['functionalLimitations'],
  diseaseActivity: ['diseaseActivity'],
  inflammatoryMarkers: ['inflammatoryMarkers'],
  serology: ['serology'],
  imaging: ['imaging'],
  currentMedications: ['currentMedications'],
  medicationResponse: ['medicationResponse'],
  sideEffects: ['sideEffects'],
  treatmentPlan: ['treatmentPlan'],
  physicalTherapy: ['physicalTherapy'],
  followUp: ['followUp'],
  rheumatologist: ['rheumatologist'],
  facility: ['facility'],
  notes: ['notes'],
};

/* Sentence fields: multi-sentence text gets sentence-level editing */
const SENTENCE_FIELDS = [
  'functionalLimitations',
  'medicationResponse',
  'treatmentPlan',
  'diseaseActivity',
  'swelling',
  'serology',
  'imaging',
  'sideEffects',
  'physicalTherapy',
  'notes',
];

/* Array fields stored as arrays in MongoDB */
const ARRAY_FIELDS = ['affectedJoints', 'currentMedications'];
const DATE_FIELDS = ['date'];

/* Comma-list fields: a single STRING holding a genuine comma-separated list → one row per item
   (paren-aware so "(labs - CBC, CMP, MTX monitoring, DAS28 score)" stays one row). Scoped WHITELIST —
   NOT arthritisType ("…Moderate-severe, seropositive") or rheumatologist ("Dr. Rachel Kim, MD"). */
const COMMA_SPLIT_FIELDS = ['followUp', 'inflammatoryMarkers'];

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
    else if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

/* ======= COMPONENT ======= */
const ArthritisAssessmentsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    const source = docProp || data || templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (r?.arthritis_assessments) return Array.isArray(r.arthritis_assessments) ? r.arthritis_assessments : [r.arthritis_assessments];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.arthritis_assessments) return Array.isArray(dd.arthritis_assessments) ? dd.arthritis_assessments : [dd.arthritis_assessments];
        return [dd];
      }
      if (r?.data) {
        const dd = r.data;
        if (Array.isArray(dd)) return dd;
        if (dd?.arthritis_assessments) return Array.isArray(dd.arthritis_assessments) ? dd.arthritis_assessments : [dd.arthritis_assessments];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => {
      if (!r?._id) return null;
      if (typeof r._id === 'string') return r._id;
      if (r._id.$oid) return r._id.$oid;
      return String(r._id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark the field/sentence as edited so the yellow "Pending Approve" button shows.
        if (SENTENCE_FIELDS.includes(fieldPart) && !Array.isArray(value) && splitBySentence(String(value || '')).length > 1) {
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<dot>');
    return protectedText.split(/[.;]\s+/)
      .map(s => s.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
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

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const arr = record[fn] || [];
    if (!Array.isArray(arr)) return [];
    return arr.map((item, itemIdx) => {
      const editKey = `${fn}-${idx}-${itemIdx}`;
      return localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    });
  }, [localEdits]);

  const safeId = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  /* ======= BAR CHART DATA ======= */
  const extractChartData = useCallback((record) => {
    const chartData = [];
    const raw = getFieldValue(record, 'inflammatoryMarkers', records.indexOf(record));
    if (!raw) return chartData;
    const text = String(raw);

    const crpMatch = text.match(/CRP[:\s]*([0-9.]+)\s*(mg\/L)?/i);
    if (crpMatch) {
      const value = parseFloat(crpMatch[1]);
      const percentage = Math.min((value / 20) * 100, 100);
      let interpretation = 'Normal'; let color = '#22c55e';
      if (value > 10) { interpretation = 'High'; color = '#ef4444'; }
      else if (value > 3) { interpretation = 'Elevated'; color = '#f59e0b'; }
      chartData.push({ label: 'C-Reactive Protein (CRP)', value, unit: 'mg/L', percentage, interpretation, color, reference: '<3.0 mg/L' });
    }

    const esrMatch = text.match(/ESR[:\s]*([0-9.]+)\s*(mm\/hr)?/i);
    if (esrMatch) {
      const value = parseFloat(esrMatch[1]);
      const percentage = Math.min((value / 80) * 100, 100);
      let interpretation = 'Normal'; let color = '#22c55e';
      if (value > 40) { interpretation = 'High'; color = '#ef4444'; }
      else if (value > 25) { interpretation = 'Elevated'; color = '#f59e0b'; }
      chartData.push({ label: 'Erythrocyte Sedimentation Rate (ESR)', value, unit: 'mm/hr', percentage, interpretation, color, reference: '<20-30 mm/hr' });
    }

    return chartData;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFieldValue]);

  /* ======= HIGHLIGHT ======= */
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

  /* ======= SEARCH - 4-LEVEL ======= */
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
          if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
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

  /* ======= FILTERED RECORDS ======= */
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Arthritis Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) {
        if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true;
      }
      for (const l of Object.values(FIELD_LABELS)) {
        if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true;
      }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val) {
            if (Array.isArray(val)) {
              if (val.some(item => String(item).toLowerCase().includes(phrase))) return true;
            } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
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
      ARRAY_FIELDS.forEach(field => {
        // Only merge the edited array when it is NOT a pending draft; else keep the original.
        if (pendingEdits[`${field}-${idx}`]) merged[field] = record[field];
        else merged[field] = getEffectiveArray(record, field, idx);
      });
      return merged;
    });
  }, [filteredRecords, localEdits, getEffectiveArray, pendingEdits]);

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
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow.
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Save = stage the updated array as a DRAFT locally + localStorage. Committed to DB only on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, itemIdx) => {
    const id = safeId(record); if (!id) return;
    const arrKey = `${fn}-${idx}`;
    const editKey = `${arrKey}-${itemIdx}`;
    const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [];
    currentArr[itemIdx] = editValue;
    setLocalEdits(prev => ({ ...prev, [arrKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [arrKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = currentArr;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, getFieldValue]);

  function saveSentence(record, fn, idx, sid, sIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();

    let updated;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      updated = [...sentences];
      updated.splice(sIdx, 1);
    } else {
      const newSentences = splitBySentence(editedVal);
      updated = [...sentences];
      updated.splice(sIdx, 1, ...newSentences);
    }
    const fullText = reconstructFullText(updated);
    const editKey = `${fn}-${idx}`;
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sentenceKey]: 'edited' }));
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* saveCommaItem: edit ONE comma item of a COMMA_SPLIT field; rebuild value = items.join(', ').
     Empty edit deletes that item; typing commas adds items. Staged as a draft (defer-save-until-approve). */
  function saveCommaItem(record, fn, idx, sid, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    const originalParsed = parseLabel(items[ciIdx] || '');
    const editedRaw = editValue.trim().replace(/[;.]+$/, '');
    const edited = originalParsed.isLabeled && editedRaw ? `${originalParsed.label}: ${editedRaw}` : editedRaw;
    if (!edited) {
      items.splice(ciIdx, 1);
    } else {
      const newItems = splitByComma(edited);
      items.splice(ciIdx, 1, ...newItems);
    }
    const fullText = items.join(', ');
    const editKey = `${fn}-${idx}`;
    const commaKey = `${fn}-${idx}-c${ciIdx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' }));
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ======= APPROVE ======= */
  /* sectionHasEdits: checks BOTH dash-path (fn-idx) AND dot-path (fn.sub-idx) keys */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k =>
        k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))
      ) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Collect staged drafts for THIS section's fields (localEdits keyed "<fieldPart>-<idx>").
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        return fields.includes(baseField) || fields.includes(fieldPart);
      });
      // Persist each staged field to the DB now (field, + arrayIndex only for a numeric dot-suffix).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        await secureApiClient.put(`/api/edit/arthritis_assessments/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/arthritis_assessments/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts for these fields from localStorage (now committed).
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      /* Clear edit markers including dot-path keys */
      setEditedFields(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => {
          fields.forEach(f => {
            if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k];
          });
        });
        return n;
      });
      setEditedSentences(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => {
          fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; });
        });
        return n;
      });
    } catch (err) { console.error('[ArthritisAssessments] Approve error:', err); }
  }, [safeId, localEdits, pendingEdits]);

  /* renderApproveButton: check hasEdits BEFORE isApproved */
  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (
      <button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>
        Pending Approve
      </button>
    );
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = window.document.createElement('textarea');
      ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta);
      ta.select(); window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(ta); return true;
    }
  }, []);

  const copySection = useCallback(async (text, id) => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); }
  }, [copyToClipboard]);

  const copyItem = useCallback(async (text, id) => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); }
  }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid] || sid;
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => hasVal(getFieldValue(record, f, idx)))) return '';
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      // Single-name section: the field label duplicates the section title → omit it (title is the header).
      const prefix = SECTION_TITLES[sid] !== label ? `${label}\n` : '';
      if (DATE_FIELDS.includes(f)) {
        text += `${prefix}1. ${formatDate(val)}\n\n`;
      } else if (Array.isArray(val)) {
        text += prefix;
        val.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
        text += '\n';
      } else if (COMMA_SPLIT_FIELDS.includes(f)) {
        const items = splitByComma(fmtVal(val));
        if (items.length > 1) {
          text += prefix;
          items.forEach((item, i) => { const parsedItem = parseLabel(item); if (parsedItem.isLabeled) text += `${parsedItem.label}\n`; text += `${i + 1}. ${parsedItem.isLabeled ? parsedItem.value : item}\n`; });
          text += '\n';
        } else {
          text += `${prefix}${fmtVal(val)}\n\n`;
        }
      } else {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          text += prefix;
          sentences.forEach((s, i) => { const parsedSentence = parseLabel(s); if (parsedSentence.isLabeled) text += `${parsedSentence.label}\n`; text += `${i + 1}. ${parsedSentence.isLabeled ? parsedSentence.value : s}\n`; });
          text += '\n';
        } else {
          // "Label: value" → label on its own line, value below (mirrors the JSX nested-subtitle).
          const parsed = parseLabel(strVal);
          if (parsed.isLabeled) text += `${prefix}${parsed.label}\n${parsed.value}\n\n`;
          else text += `${prefix}${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== ARTHRITIS ASSESSMENTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Arthritis Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: SIMPLE STRING FIELD (single value; "Label: value" → nested-subtitle + value) ======= */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const saving = savingField === `save-${editKey}`;

    /* "Label: value" (e.g. "DAS28-CRP: 4.2 → 5.8 ...") → show the parsed label as the nested-subtitle and
       edit ONLY the value (reconstruct "label: value" on save). Otherwise show the field label (unless it
       duplicates the section title). */
    const parsed = parseLabel(strVal);
    const subtitle = parsed.isLabeled ? parsed.label : label;
    const showSubtitle = parsed.isLabeled || SECTION_TITLES[sid] !== label;
    const rowValue = parsed.isLabeled ? parsed.value : strVal;
    const ratio = fn === 'painLevel' ? rowValue.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/) : null;
    const numberUnit = fn === 'stiffness' ? rowValue.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/) : null;
    const editStartValue = ratio ? ratio[1] : numberUnit ? numberUnit[1] : rowValue;
    const commitEdit = () => {
      const editedValue = ratio ? `${editValue.trim()}/${ratio[2]}` : numberUnit ? `${editValue.trim()} ${numberUnit[2]}` : editValue.trim();
      const newVal = parsed.isLabeled ? `${parsed.label}: ${editedValue}` : editedValue;
      handleSaveField(record, fn, idx, sid, null, newVal, editKey);
    };

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showSubtitle && <div className="nested-subtitle">{highlightText(subtitle)}</div>}
        <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`}
          onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {(ratio || numberUnit) ? <div className="number-edit-row num-step"><button type="button" className="stepper-btn" onClick={e => { e.stopPropagation(); setEditValue(current => String((parseFloat(current) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-number stepper-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus /><button type="button" className="stepper-btn" onClick={e => { e.stopPropagation(); setEditValue(current => String((parseFloat(current) || 0) + 1)); }}>+</button><span className="number-edit-unit">{ratio ? `/ ${ratio[2]}` : numberUnit[2]}</span></div> : <textarea
                className="edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}
              />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving}
                  onClick={e => { e.stopPropagation(); commitEdit(); }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content">
                <span className="content-value">{highlightText(rowValue)}</span>
                <span className="edit-indicator">&#9998;</span>
              </div>
              <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`}
                onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${subtitle}\n${rowValue}` : `${label}\n${strVal}`, editKey); }}>
                {copiedItems[editKey] ? 'Copied!' : 'Copy'}
              </button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayValue = formatDate(val);
    let inputValue = '';
    try { inputValue = new Date(val.$date || val).toISOString().slice(0, 10); } catch { inputValue = ''; }
    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        <div className="numbered-row editable-row" onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(inputValue); setSaveError(null); } }}>
          {isEditing ? <div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={setEditValue} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={e => { e.stopPropagation(); if (!editValue) { setSaveError('Please choose a valid date'); return; } handleSaveField(record, fn, idx, sid, null, `${editValue}T00:00:00.000Z`, editKey); }}>Save</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayValue, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: SENTENCE FIELD (multi-sentence text) ======= */
  const renderSentenceField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length <= 1) {
      return renderSimpleField(record, fn, idx, sid);
    }

    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className={`rec-mini-card nested-mini-card${sentences.some(sentence => parseLabel(sentence).isLabeled) ? '' : ' regular-row-group'}`}>
          {SECTION_TITLES[sid] !== label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch ||
              (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;

            const parsed = parseLabel(sentence);
            const saving = savingField === `save-${sentenceKey}`;

            /* Labeled sentence with comma items */
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 2) {
                return (
                  <div key={sIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`;
                      const ciEditing = editingField === commaKey;
                      const ciBadge = editedSentences[commaKey];
                      const ciSaving = savingField === `save-${commaKey}`;
                      const ciMatches = phraseMatch || labelMatch ||
                        !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                      if (!ciMatches && searchTerm.trim()) return null;
                      return (
                        <div key={ciIdx} data-edit-field={fn}>
                          <div className={`numbered-row${ciBadge ? ' modified' : ''} editable-row`}
                            onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue}
                                  onChange={e => setEditValue(e.target.value)} autoFocus
                                  onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                {saveError && <div className="save-error">{saveError}</div>}
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={ciSaving} onClick={e => {
                                    e.stopPropagation();
                                    const id2 = safeId(record); if (!id2) return;
                                    const currentVal2 = String(getFieldValue(record, fn, idx) || '');
                                    const sentences2 = splitBySentence(currentVal2);
                                    const s2 = sentences2[sIdx] || '';
                                    const p2 = parseLabel(s2);
                                    if (!p2.isLabeled) return;
                                    const items2 = splitByComma(p2.value);
                                    items2[ciIdx] = editValue.trim().replace(/[;.]+$/, '');
                                    const rebuilt = `${p2.label}: ${items2.join(', ')}.`;
                                    const allS = [...sentences2]; allS[sIdx] = rebuilt;
                                    const fullText2 = reconstructFullText(allS);
                                    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
                                    const editKey2 = `${fn}-${idx}`;
                                    setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 }));
                                    setPendingEdits(prev => ({ ...prev, [editKey2]: true }));
                                    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
                                    setApprovedSections(prev => {
                                      const k = `${sid}-${idx}`;
                                      if (!prev[k]) return prev;
                                      const next = { ...prev }; delete next[k]; return next;
                                    });
                                    const dstore = readDrafts();
                                    if (!dstore[id2]) dstore[id2] = {};
                                    dstore[id2][fn] = fullText2;
                                    writeDrafts(dstore);
                                    setEditingField(null); setEditValue(''); setSaveError(null);
                                  }}>{ciSaving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="row-content">
                                  <span className="content-value">{highlightText(ci)}</span>
                                  <span className="edit-indicator">&#9998;</span>
                                </div>
                                <button className={`copy-btn${copiedItems[commaKey] ? ' copied' : ''}`}
                                  onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>
                                  {copiedItems[commaKey] ? 'Copied!' : 'Copy'}
                                </button>
                              </>
                            )}
                          </div>
                          {ciBadge && <span className={`modified-badge${ciBadge === 'added' ? ' added' : ''}`}>
                            {ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}
                          </span>}
                        </div>
                      );
                    })}
                  </div>
                );
              }
            }

            /* Regular sentence row */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card nested-mini-card' : ''} data-edit-field={fn} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row${badge ? ' modified' : ''} editable-row`}
                  onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue}
                        onChange={e => setEditValue(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving}
                          onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span>
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                      <button className={`copy-btn${copiedItems[sentenceKey] ? ' copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>
                        {copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}
                      </button>
                    </>
                  )}
                </div>
                {badge && <span className={`modified-badge${badge === 'added' ? ' added' : ''}`}>
                  {badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}
                </span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: ARRAY FIELD ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card regular-row-group">
        {SECTION_TITLES[sid] !== label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, itemIdx) => {
          const editKey = `${fn}-${idx}-${itemIdx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const strItem = String(item || '');
          const saving = savingField === `save-${editKey}`;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !strItem.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={fn}>
              <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`}
                onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strItem); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue}
                      onChange={e => setEditValue(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving}
                        onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, itemIdx); }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      <span className="content-value">{highlightText(strItem)}</span>
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`}
                      onClick={e => { e.stopPropagation(); copyItem(strItem, editKey); }}>
                      {copiedItems[editKey] ? 'Copied!' : 'Copy'}
                    </button>
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

  /* ======= RENDER: COMMA-LIST FIELD (one row per comma item, paren-aware) ======= */
  const renderCommaField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const items = splitByComma(strVal);
    if (items.length <= 1) return renderSimpleField(record, fn, idx, sid);
    const label = FIELD_LABELS[fn] || fn;
    const phrase = searchTerm.toLowerCase().trim();

    return (
      <div key={fn} className={`rec-mini-card nested-mini-card${items.some(item => parseLabel(item).isLabeled) ? '' : ' regular-row-group'}`}>
        {SECTION_TITLES[sid] !== label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, ciIdx) => {
          const parsedItem = parseLabel(item);
          const displayItem = parsedItem.isLabeled ? parsedItem.value : item;
          const commaKey = `${fn}-${idx}-c${ciIdx}`;
          const isEditing = editingField === commaKey;
          const isModified = editedFields[commaKey];
          const saving = savingField === `save-${commaKey}`;
          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !String(item).toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={ciIdx} className={parsedItem.isLabeled ? 'rec-mini-card nested-mini-card' : ''} data-edit-field={fn}>
              {parsedItem.isLabeled && <div className="nested-subtitle">{highlightText(parsedItem.label)}</div>}
              <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`}
                onClick={() => { if (!isEditing) { setEditingField(commaKey); setEditValue(displayItem); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue}
                      onChange={e => setEditValue(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving}
                        onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, ciIdx); }}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      <span className="content-value">{highlightText(displayItem)}</span>
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn${copiedItems[commaKey] ? ' copied' : ''}`}
                      onClick={e => { e.stopPropagation(); copyItem(String(displayItem), commaKey); }}>
                      {copiedItems[commaKey] ? 'Copied!' : 'Copy'}
                    </button>
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

  /* ======= RENDER: SECTION WRAPPER ======= */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid] || sid;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;

    const fieldNodes = fields.map(f => {
      if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
      if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
      if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaField(record, f, idx, sid);
      if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid);
      return renderSimpleField(record, f, idx, sid);
    }).filter(Boolean);

    if (fieldNodes.length === 0) return null;

    return (
      <div key={sid} className="field-container">
        <div className="field-header">
          <span className="field-title">{highlightText(title)}</span>
          <div className="header-right-actions">
            <button
              className={`section-copy-btn${copiedSection === copyId ? ' copied' : ''}`}
              onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>
              {copiedSection === copyId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveButton(record, sid, idx)}
          </div>
        </div>
        <div className="numbered-rows-wrapper">
          {fieldNodes}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="arthritis-assessments-document" ref={containerRef}>
        <div className="empty-state">
          <div className="empty-icon">X</div>
          <div className="empty-text">No arthritis assessment records available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="arthritis-assessments-document" ref={containerRef}>
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Arthritis Assessments</h1>
        <div className="header-actions">
          <button className={`copy-btn${showCopied ? ' copied' : ''}`} onClick={copyAllText}>
            {showCopied ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ArthritisAssessmentsDocumentPDFTemplate document={pdfData} />}
            fileName="Arthritis_Assessments.pdf"
            className="copy-btn"
          >
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search arthritis assessments..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>x</button>
        )}
      </div>

      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No records match your search for "{searchTerm}"</div>
      )}

      {/* Records List */}
      <div className="records-list">
        {filteredRecords.map((record, idx) => {
          const chartData = extractChartData(record);
          const searchLower = searchTerm.toLowerCase().trim();
          const chartSectionTitle = 'inflammatory markers overview';
          const showChart = !searchTerm.trim() || record._showAllSections ||
            chartSectionTitle.includes(searchLower) || searchLower.includes(chartSectionTitle) ||
            chartData.some(item => `${item.label} ${item.value} ${item.unit} ${item.interpretation}`.toLowerCase().includes(searchLower));

          return (
            <div key={idx} className="record-section">
              {/* Record Header */}
              <div className="record-header">
                <h2 className="record-name">{highlightText(`Arthritis Assessment ${idx + 1}`)}</h2>
              </div>

              {/* Bar Chart (display-only) */}
              {chartData.length > 0 && showChart && (
                <div className="chart-section">
                  <div className="field-header">
                    <span className="field-title">{highlightText('Inflammatory Markers Overview')}</span>
                  </div>
                  <div className="chart-container">
                    {chartData.map((item, cIdx) => (
                      <div key={cIdx} className="bar-chart-row">
                        <div className="bar-label">{highlightText(item.label)}</div>
                        <div className="bar-container">
                          <div className="bar-background">
                            <div className="bar-fill" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
                          </div>
                          <div className="bar-value">{highlightText(`${item.value} ${item.unit}`)}</div>
                        </div>
                        <div className="bar-interpretation" style={{ color: item.color }}>
                          {highlightText(`${item.interpretation} (Ref: ${item.reference})`)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Sections */}
              {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArthritisAssessmentsDocument;
