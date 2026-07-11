/**
 * InsulinPumpSettingsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: insulin_pump_settings
 *
 * 8 Sections:
 *   1. session-info: date (date picker), provider (string), facility (string), status (string)
 *   2. pump-config: pumpModel (string), totalBasal (string), correctionFactor (string),
 *                   targetGlucose (string), activeInsulinTime (string), maxBolus (string), maxBasalRate (string)
 *   3. basal-rates: basalRates ARRAY of OBJECTS [{timeRange, rate}]
 *   4. carb-ratios: carbRatios ARRAY of OBJECTS [{time, ratio}]
 *   5. results: results OBJECT (recursive leaf rendering)
 *   6. clinical-notes: findings (long), assessment (long), plan (long)
 *   7. recommendations: recommendations ARRAY (strings or {recommendation, date} objects)
 *   8. additional-notes: notes (long)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import InsulinPumpSettingsDocumentPDFTemplate from '../pdf-templates/InsulinPumpSettingsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './InsulinPumpSettingsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the "-<idx>" suffix) */
const DRAFT_KEY = 'insulin_pump_settingsPendingEdits';
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
  'pump-config': 'Pump Configuration',
  'basal-rates': 'Basal Rates',
  'carb-ratios': 'Carb Ratios',
  'results': 'Results',
  'clinical-notes': 'Clinical Notes',
  'recommendations': 'Recommendations',
  'additional-notes': 'Additional Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  pumpModel: 'Pump Model',
  totalBasal: 'Total Basal',
  correctionFactor: 'Correction Factor',
  targetGlucose: 'Target Glucose',
  activeInsulinTime: 'Active Insulin Time',
  maxBolus: 'Max Bolus',
  maxBasalRate: 'Max Basal Rate',
  basalRates: 'Basal Rates',
  carbRatios: 'Carb Ratios',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'pump-config': ['pumpModel', 'totalBasal', 'correctionFactor', 'targetGlucose', 'activeInsulinTime', 'maxBolus', 'maxBasalRate'],
  'basal-rates': ['basalRates'],
  'carb-ratios': ['carbRatios'],
  'results': ['results'],
  'clinical-notes': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'additional-notes': ['notes'],
};

const STRING_FIELDS = ['provider', 'facility', 'status', 'pumpModel', 'totalBasal', 'correctionFactor', 'targetGlucose', 'activeInsulinTime', 'maxBolus', 'maxBasalRate'];
const LONG_TEXT_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['basalRates', 'carbRatios', 'recommendations'];
const OBJECT_FIELDS = ['results'];

const BASAL_RATE_SUB_FIELDS = [
  { key: 'timeRange', label: 'Time Range' },
  { key: 'rate', label: 'Rate' },
];
const CARB_RATIO_SUB_FIELDS = [
  { key: 'time', label: 'Time' },
  { key: 'ratio', label: 'Ratio' },
];
const RECOMMENDATION_SUB_FIELDS = [
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'date', label: 'Date' },
];

/* sub-field config resolver for object-arrays */
const getArraySubFields = (fn) => {
  if (fn === 'basalRates') return BASAL_RATE_SUB_FIELDS;
  if (fn === 'carbRatios') return CARB_RATIO_SUB_FIELDS;
  if (fn === 'recommendations') return RECOMMENDATION_SUB_FIELDS;
  return [];
};
const arrayItemTitle = (fn) => {
  if (fn === 'basalRates') return 'Basal Rate';
  if (fn === 'carbRatios') return 'Carb Ratio';
  if (fn === 'recommendations') return 'Recommendation';
  return 'Item';
};

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* objectLeafText: flatten an object's leaf values into a searchable "key value key value" string */
const objectLeafText = (obj) => {
  if (obj === null || obj === undefined || typeof obj !== 'object') return String(obj ?? '');
  const parts = [];
  const walk = (o) => {
    if (o === null || o === undefined) return;
    if (Array.isArray(o)) { o.forEach(walk); }
    else if (typeof o === 'object') { Object.entries(o).forEach(([k, v]) => { parts.push(k); walk(v); }); }
    else { parts.push(String(o)); }
  };
  walk(obj);
  return parts.join(' ');
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ======= COMPONENT ======= */
const InsulinPumpSettingsDocument = ({ document: docProp }) => {
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

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.insulin_pump_settings) return Array.isArray(r.insulin_pump_settings) ? r.insulin_pump_settings : [r.insulin_pump_settings];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.insulin_pump_settings) return Array.isArray(dd.insulin_pump_settings) ? dd.insulin_pump_settings : [dd.insulin_pump_settings]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* idResolver (module-free copy of safeId for the rehydrate effect, which runs before safeId is declared) */
  const resolveId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = resolveId(record);
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
  }, [records]);

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

  const getEffectiveArray = useCallback((record, fn, idx, skipPending = false) => {
    const orig = record[fn];
    if (!Array.isArray(orig)) return orig || [];
    return orig.map((item, itemIdx) => {
      /* string-array items (e.g. recommendations as plain strings) → normalize to {recommendation} */
      const merged = (item && typeof item === 'object') ? { ...item } : (fn === 'recommendations' ? { recommendation: item } : { value: item });
      const subFields = getArraySubFields(fn);
      subFields.forEach(sf => {
        const editKey = `${fn}.${itemIdx}.${sf.key}-${idx}`;
        if (skipPending && pendingEdits[editKey]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[editKey] !== undefined) merged[sf.key] = localEdits[editKey];
      });
      return merged;
    });
  }, [localEdits, pendingEdits]);

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
    return t.startsWith(p) || p.startsWith(t);
  }, [searchTerm]);

  /* ======= SEARCH -- 4-LEVEL ======= */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.startsWith(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, 0);
        if (Array.isArray(arr)) {
          const subFields = getArraySubFields(f);
          for (const item of arr) {
            for (const sf of subFields) {
              if (item[sf.key] && fmtVal(item[sf.key]).toLowerCase().includes(phrase)) return true;
            }
          }
        }
      } else if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, 0);
        if (val && typeof val === 'object' && objectLeafText(val).toLowerCase().includes(phrase)) return true;
      } else {
        const val = getFieldValue(record, f, 0);
        if (val !== null && val !== undefined) {
          if (fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
    }
    return false;
  }, [searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Insulin Pump Settings ${idx + 1}`.toLowerCase();
      if (rt.startsWith(phrase) || phrase.startsWith(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          if (ARRAY_FIELDS.includes(f)) {
            const arr = getEffectiveArray(record, f, idx);
            if (Array.isArray(arr)) {
              const subFields = getArraySubFields(f);
              for (const item of arr) {
                for (const sf of subFields) {
                  if (item[sf.key] && fmtVal(item[sf.key]).toLowerCase().includes(phrase)) return true;
                }
              }
            }
          } else if (OBJECT_FIELDS.includes(f)) {
            const val = getFieldValue(record, f, idx);
            if (val && typeof val === 'object' && objectLeafText(val).toLowerCase().includes(phrase)) return true;
          } else {
            const val = getFieldValue(record, f, idx);
            if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, getEffectiveArray, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (!fieldPath.includes('.')) {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      ARRAY_FIELDS.forEach(field => {
        merged[field] = getEffectiveArray(record, field, idx, true);
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

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
    // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally only (no DB write). localStorage keeps it across refresh; Approve commits it.
  const handleSaveArraySubField = useCallback((record, arrayField, itemIdx, subFieldKey, idx, sid) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue;
    const fieldPath = `${arrayField}.${itemIdx}.${subFieldKey}`;
    const editKey = `${fieldPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPath] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageSentenceDraft = (record, fn, idx, sid, fullText, markers) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
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

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, sid, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
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
    stageSentenceDraft(record, fn, idx, sid, fullText, markers);
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // staged pending editKeys belonging to this section's fields + this record index
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" or "field.itemIdx.subKey"
      const baseField = fieldPart.split('.')[0];
      return fields.includes(baseField);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastSeg = fieldPart.slice(fieldPart.lastIndexOf('.') + 1);
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric; otherwise send the full dotted path as `field`
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (fieldPart.includes('.') && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, fieldPart.lastIndexOf('.'));
          payload.arrayIndex = parseInt(lastSeg, 10);
        }
        await secureApiClient.put(`/api/edit/insulin_pump_settings/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/insulin_pump_settings/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => { const fieldPart = editKey.slice(0, -suffix.length); delete store[id][fieldPart]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
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
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        if (!Array.isArray(arr) || arr.length === 0) return;
        text += `${label}\n`;
        const subFields = getArraySubFields(f);
        arr.forEach((item, i) => {
          const parts = subFields.map(sf => item[sf.key] ? `${sf.label}: ${sf.key === 'date' ? formatDate(item[sf.key]) : item[sf.key]}` : '').filter(Boolean).join(', ');
          text += `${i + 1}. ${parts}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val) || typeof val !== 'object') return;
        const leaves = renderObjectLeaves(val, '').filter(l => l.value !== '');
        if (leaves.length === 0) return;
        text += `${label}\n`;
        leaves.forEach(l => { text += `${l.label}: ${l.value}\n`; });
        text += '\n';
      } else {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        if (DATE_FIELDS.includes(f)) {
          text += `${label}\n${formatDate(val)}\n\n`;
        } else if (LONG_TEXT_FIELDS.includes(f)) {
          const strVal = fmtVal(val);
          const sentences = splitBySentence(strVal);
          if (sentences.length > 1) {
            text += `${label}\n`;
            formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
            text += '\n';
          } else {
            text += `${label}\n${strVal}\n\n`;
          }
        } else {
          text += `${label}\n${fmtVal(val)}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== INSULIN PUMP SETTINGS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Insulin Pump Settings ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
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

  /* ======= RENDER: STRING FIELD (simple short) ======= */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

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

  /* ======= RENDER: LONG TEXT FIELD with splitBySentence ======= */
  const renderLongTextField = (record, fn, idx, sid) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText, marks); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: ARRAY OF OBJECTS (basalRates / carbRatios) as mini-cards ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const subFields = getArraySubFields(fn);
    const phrase = searchTerm.trim() ? searchTerm.toLowerCase().trim() : '';
    const titleMatch = sectionTitleMatches(sid);

    return arr.map((item, itemIdx) => {
      /* Level 3: build item content for search matching */
      const itemContent = subFields.map(sf => item[sf.key] ? `${sf.label}: ${item[sf.key]}` : '').filter(Boolean).join(' ');
      if (phrase && !titleMatch && !record._showAllSections) {
        if (!itemContent.toLowerCase().includes(phrase)) return null;
      }
      /* Level 4: determine sub-field visibility */
      const itemNameContent = subFields.map(sf => item[sf.key] || '').join(' ');
      const itemNameMatches = titleMatch || record._showAllSections || !phrase || itemNameContent.toLowerCase().includes(phrase);

      const visibleSubFields = subFields.filter(sf => {
        const sfVal = item[sf.key];
        if (!sfVal) return false;
        if (itemNameMatches) return true;
        return (sf.label.toLowerCase().includes(phrase) || String(sfVal).toLowerCase().includes(phrase));
      });
      if (visibleSubFields.length === 0) return null;

      return (
        <div key={itemIdx} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(`${arrayItemTitle(fn)} ${itemIdx + 1}`)}</div>
          {visibleSubFields.map(sf => {
            const rawVal = item[sf.key] || '';
            const isDateSub = sf.key === 'date';
            const sfVal = isDateSub ? formatDate(rawVal) : rawVal;
            const editKey = `${fn}.${itemIdx}.${sf.key}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            return (
              <div key={sf.key} className="nested-mini-card">
                <div className="nested-subtitle sub-label">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isDateSub ? toInputDate(rawVal) : String(sfVal)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {isDateSub ? (
                        <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
                      ) : (
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      )}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isDateSub && isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveArraySubField(record, fn, itemIdx, sf.key, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sfVal)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${sfVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ======= RENDER: OBJECT FIELD (results) — recursive leaf rendering, read-only ======= */
  const renderObjectLeaves = (obj, prefix) => {
    const leaves = [];
    const walk = (o, path) => {
      if (o === null || o === undefined) return;
      if (Array.isArray(o)) {
        o.forEach((v, i) => walk(v, `${path}[${i + 1}]`));
      } else if (typeof o === 'object') {
        Object.entries(o).forEach(([k, v]) => walk(v, path ? `${path} - ${k}` : k));
      } else {
        leaves.push({ label: path, value: fmtVal(o) });
      }
    };
    walk(obj, prefix);
    return leaves;
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object') return null;
    const leaves = renderObjectLeaves(val, '').filter(l => l.value !== '');
    if (leaves.length === 0) return null;
    const phrase = searchTerm.trim() ? searchTerm.toLowerCase().trim() : '';
    const titleMatch = sectionTitleMatches(sid);
    const labelMatch = (FIELD_LABELS[fn] || fn).toLowerCase().includes(phrase);
    const visible = leaves.filter(l => {
      if (!phrase || titleMatch || labelMatch || record._showAllSections) return true;
      return l.label.toLowerCase().includes(phrase) || l.value.toLowerCase().includes(phrase);
    });
    if (visible.length === 0) return null;

    return visible.map((leaf, leafIdx) => {
      const copyKey = `${fn}.${leaf.label}-${idx}`;
      return (
        <div key={leafIdx} className="rec-mini-card">
          <div className="nested-subtitle sub-label">{highlightText(leaf.label)}</div>
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(leaf.value)}</span></div>
            <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${leaf.label}: ${leaf.value}`, copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      );
    });
  };

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getEffectiveArray(record, f, idx);
        return Array.isArray(arr) && arr.length > 0;
      }
      if (OBJECT_FIELDS.includes(f)) {
        const val = getFieldValue(record, f, idx);
        return hasVal(val) && typeof val === 'object';
      }
      const val = getFieldValue(record, f, idx);
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (LONG_TEXT_FIELDS.includes(f)) return renderLongTextField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="insulin-pump-settings-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Insulin Pump Settings</h2></div>
        <div className="empty-state">No insulin pump settings records available</div>
      </div>
    );
  }

  return (
    <div className="insulin-pump-settings-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Insulin Pump Settings</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<InsulinPumpSettingsDocumentPDFTemplate document={pdfData} />} fileName="Insulin_Pump_Settings.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search insulin pump settings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Insulin Pump Settings ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'pump-config')}
            {renderSection(record, idx, 'basal-rates')}
            {renderSection(record, idx, 'carb-ratios')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'clinical-notes')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'additional-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsulinPumpSettingsDocument;
