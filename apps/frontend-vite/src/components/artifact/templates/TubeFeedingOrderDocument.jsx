/**
 * TubeFeedingOrderDocument.jsx
 * July 2026 - canonical editable template for tube_feeding_order.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TubeFeedingOrderDocumentPDFTemplate from '../pdf-templates/TubeFeedingOrderDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueTimePicker from '../components/BlueTimePicker';
import BlueSelect from '../components/BlueSelect';
import './TubeFeedingOrderDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name, e.g. "purposeOfTravel") */
const DRAFT_KEY = 'tube_feeding_orderPendingEdits';
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
  'formula-info': 'Formula Information',
  'feeding-route-method': 'Feeding Route and Method',
  'rate-advancement': 'Rate and Advancement',
  'caloric-protein-goals': 'Caloric and Protein Goals',
  'water-flush-protocol': 'Water Flush Protocol',
  'gastric-monitoring': 'Gastric Monitoring',
  'safety-positioning': 'Safety and Positioning',
  'cyclic-bolus-feeding': 'Cyclic and Bolus Feeding',
  'supplements-patency': 'Supplements and Patency',
  'risk-glycemic': 'Risk and Glycemic Control',
};

const FIELD_LABELS = {
  formulaName: 'Formula Name',
  formulaCaloriesDensity: 'Formula Calorie Density (kcal/mL)',
  proteinContentPerLiter: 'Protein Content (g/L)',
  feedingRouteType: 'Feeding Route Type',
  feedingTubeSize: 'Feeding Tube Size (Fr)',
  feedingMethodType: 'Feeding Method Type',
  initialInfusionRate: 'Initial Infusion Rate (mL/hr)',
  goalInfusionRate: 'Goal Infusion Rate (mL/hr)',
  rateAdvancementSchedule: 'Rate Advancement Schedule',
  dailyCaloricGoal: 'Daily Caloric Goal (kcal/day)',
  dailyProteinGoal: 'Daily Protein Goal (g/day)',
  freeWaterFlushVolume: 'Free Water Flush Volume (mL)',
  freeWaterFlushFrequency: 'Free Water Flush Frequency',
  gastricResidualVolumeThreshold: 'Gastric Residual Threshold (mL)',
  gastricResidualCheckFrequency: 'Gastric Residual Check Frequency',
  headOfBedElevation: 'Head of Bed Elevation (degrees)',
  prokineticsOrdered: 'Prokinetics Ordered',
  cyclicFeedingStartTime: 'Cyclic Feeding Start Time',
  cyclicFeedingDurationHours: 'Cyclic Feeding Duration (hours)',
  bolusVolume: 'Bolus Volume (mL)',
  bolusFrequency: 'Bolus Frequency',
  modularsSupplements: 'Modulars and Supplements',
  tubePatencyFlushSolution: 'Tube Patency Flush Solution',
  refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  glycemicControlProtocol: 'Glycemic Control Protocol',
};

const SECTION_FIELDS = {
  'formula-info': ['formulaName', 'formulaCaloriesDensity', 'proteinContentPerLiter'],
  'feeding-route-method': ['feedingRouteType', 'feedingTubeSize', 'feedingMethodType'],
  'rate-advancement': ['initialInfusionRate', 'goalInfusionRate', 'rateAdvancementSchedule'],
  'caloric-protein-goals': ['dailyCaloricGoal', 'dailyProteinGoal'],
  'water-flush-protocol': ['freeWaterFlushVolume', 'freeWaterFlushFrequency'],
  'gastric-monitoring': ['gastricResidualVolumeThreshold', 'gastricResidualCheckFrequency'],
  'safety-positioning': ['headOfBedElevation', 'prokineticsOrdered'],
  'cyclic-bolus-feeding': ['cyclicFeedingStartTime', 'cyclicFeedingDurationHours', 'bolusVolume', 'bolusFrequency'],
  'supplements-patency': ['modularsSupplements', 'tubePatencyFlushSolution'],
  'risk-glycemic': ['refeedingSyndromeRisk', 'glycemicControlProtocol'],
};

const SECTION_ORDER = ['formula-info', 'feeding-route-method', 'rate-advancement', 'caloric-protein-goals', 'water-flush-protocol', 'gastric-monitoring', 'safety-positioning', 'cyclic-bolus-feeding', 'supplements-patency', 'risk-glycemic'];

const TIME_FIELDS = ['cyclicFeedingStartTime'];
const NUMBER_FIELDS = ['formulaCaloriesDensity', 'proteinContentPerLiter', 'feedingTubeSize', 'initialInfusionRate', 'goalInfusionRate', 'dailyCaloricGoal', 'dailyProteinGoal', 'freeWaterFlushVolume', 'gastricResidualVolumeThreshold', 'headOfBedElevation', 'cyclicFeedingDurationHours', 'bolusVolume'];
const BOOLEAN_FIELDS = ['prokineticsOrdered', 'refeedingSyndromeRisk'];
const STRING_ARRAY_FIELDS = ['modularsSupplements'];
const COMMA_SPLIT_FIELDS = new Set(['glycemicControlProtocol']);
const SEMICOLON_SPLIT_FIELDS = new Set(['rateAdvancementSchedule']);
const MEANINGFUL_ZERO_FIELDS = [];
const ENUM_OPTIONS = {
  feedingRouteType: ['nasogastric', 'nasojejunal', 'gastrostomy', 'jejunostomy'],
  feedingMethodType: ['continuous', 'cyclic', 'intermittent bolus', 'gravity drip'],
};
const enumCanonical = (field, current) => {
  const value = String(current ?? '').replace(/\s*[—–]\s*/g, ' - ');
  return (ENUM_OPTIONS[field] || []).find(o => o.toLowerCase() === value.toLowerCase()) || value;
};
const enumOptionsWith = (field, current) => { const base = ENUM_OPTIONS[field] || []; const value = enumCanonical(field, current).trim(); return base.some(o => o.toLowerCase() === value.toLowerCase()) ? base : value ? [value, ...base] : base; };
/* everything else is a per-sentence narrative string */

/* ═══════ VALUE HELPERS ═══════ */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const toInputTime = (value) => {
  const source = String(value || '').trim();
  const compact = source.match(/^(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}:${compact[2]}`;
  const clock = source.match(/^(\d{1,2}):(\d{2})$/);
  return clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : source;
};

/* ═══════ COMPONENT ═══════ */
const TubeFeedingOrderDocument = ({ document: docProp, data, templateData }) => {
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

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (Array.isArray(r.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      const wrappedRecords = r.records || r._records;
      if (Array.isArray(wrappedRecords)) return wrappedRecords;
      if (r.tube_feeding_order) return Array.isArray(r.tube_feeding_order) ? r.tube_feeding_order : [r.tube_feeding_order];
      if (r.data?.tube_feeding_order) return Array.isArray(r.data.tube_feeding_order) ? r.data.tube_feeding_order : [r.data.tube_feeding_order];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.tube_feeding_order) return Array.isArray(dd.tube_feeding_order) ? dd.tube_feeding_order : [dd.tube_feeding_order]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = idFor(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const arrayLeaf = fieldPart.match(/^(.+)\.(\d+)$/);
        if (arrayLeaf) nFields[`${arrayLeaf[1]}-${idx}-a${arrayLeaf[2]}`] = 'edited';
        else {
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
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
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text, field = '') => {
    if (!text || typeof text !== 'string') return [];
    const clauses = text.split(/(?<!\b[A-Z])(?<!\d)\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
    if (!COMMA_SPLIT_FIELDS.has(field)) return clauses;
    return clauses.flatMap((clause) => {
      const parts = []; let current = ''; let depth = 0;
      for (const char of clause) {
        if (char === '(' || char === '[' || char === '{') depth += 1;
        else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
        else current += char;
      }
      if (current.trim()) parts.push(current.trim());
      return parts;
    });
  }, []);

  function reconstructFullText(sentences, field, originalText = '') {
    if (!sentences || sentences.length === 0) return '';
    const clean = sentences.map(s => s.replace(/[;.,]+$/, '').trim()).filter(Boolean);
    if ((field === 'exposureHistory' || field === 'suspectedPathogen') && String(originalText).includes(';') && clean.length > 1) return `${clean.slice(0, -1).join(', ')}; ${clean[clean.length - 1]}`;
    const delimiter = COMMA_SPLIT_FIELDS.has(field) ? ', ' : SEMICOLON_SPLIT_FIELDS.has(field) ? '; ' : '. ';
    return clean.join(delimiter);
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (Array.isArray(record[fn])) {
      const merged = [...record[fn]];
      let changed = false;
      Object.entries(localEdits).forEach(([key, value]) => {
        const match = key.match(new RegExp(`^${fn}\\.(\d+)-${idx}$`));
        if (match) { merged[Number(match[1])] = value; changed = true; }
      });
      if (changed) return merged;
    }
    return record[fn];
  }, [localEdits]);

  /* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn)) {
      const editKey = `${fn}-${idx}`;
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
      return Boolean(editedFields[editKey]) || doctorEdited;
    }
    return true;
  }, [getFieldValue, editedFields]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* searchable text for any field type */
  const fieldSearchText = useCallback((f, val) => {
    if (STRING_ARRAY_FIELDS.includes(f)) return (Array.isArray(val) ? val : []).map(x => fmtVal(x)).join(' ');
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
      if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) return fieldSearchText(fn, val).toLowerCase().includes(phrase);
    return false;
  }, [searchTerm, getFieldValue, fieldSearchText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `tube feeding order ${idx + 1}`;
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined && fieldSearchText(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => {
      if (pendingEdits[key]) return;
      const m = key.match(/^(.+)-(\d+)$/);
      if (!m || parseInt(m[2], 10) !== idx) return;
      const fieldPart = m[1];
      const arrayMatch = fieldPart.match(/^(.+)\.(\d+)$/);
      if (arrayMatch) {
        const base = arrayMatch[1];
        const arrayIndex = Number(arrayMatch[2]);
        const values = Array.isArray(merged[base]) ? [...merged[base]] : [];
        values[arrayIndex] = localEdits[key];
        merged[base] = values;
      } else merged[fieldPart] = localEdits[key];
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally + persist to the pending-drafts localStorage store.
  // NOT written to MongoDB / NOT shown in the PDF until the user clicks Approve.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal, fn);
    const editedVal = editValue.trim();
    const stageDraft = (fullText) => { const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); };
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, fn, currentVal);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      stageDraft(fullText);
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal, fn);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, fn, currentVal);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedSentences(prev => {
      const n = { ...prev };
      n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(fullText);
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

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Only this section's pending field-level drafts (key = "<field>-<idx>", field names have no dots here)
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/tube_feeding_order/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      const approveResp = await secureApiClient.put(`/api/edit/tube_feeding_order/${id}/approve`, { sectionId: sid, approved: true });
      if (approveResp && approveResp.success === false) throw new Error(approveResp.error || 'approve failed');
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { Object.keys(store[id]).forEach(key => { if (key === f || key.startsWith(`${f}.`)) delete store[id][key]; }); });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[TubeFeedingOrder] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (NUMBER_FIELDS.includes(f)) {
        if (!numberShows(record, f, idx)) return;
        text += sameAsTitle ? `${val}\n\n` : `${label}\n${val}\n\n`;
        return;
      }
      if (BOOLEAN_FIELDS.includes(f)) {
        if (typeof val !== 'boolean') return;
        text += sameAsTitle ? `${fmtVal(val)}\n\n` : `${label}\n${fmtVal(val)}\n\n`;
        return;
      }
      if (!hasVal(val)) return;
      if (STRING_ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        if (!sameAsTitle) text += `${label}\n`;
        items.forEach((it, i) => { text += `${i + 1}. ${fmtVal(it)}\n`; });
        text += '\n';
      } else if (TIME_FIELDS.includes(f)) {
        text += sameAsTitle ? `${toInputTime(val)}\n\n` : `${label}\n${toInputTime(val)}\n\n`;
      } else {
        const strVal = ENUM_OPTIONS[f] ? enumCanonical(f, fmtVal(val)) : fmtVal(val);
        const sentences = splitBySentence(strVal, f);
        if (sentences.length > 1) {
          if (!sameAsTitle) text += `${label}\n`;
          sentences.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
          text += '\n';
        } else {
          text += sameAsTitle ? `${strVal}\n\n` : `${label}\n${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, numberShows, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== TUBE FEEDING ORDER ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Tube Feeding Order ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: TIME FIELD ═══════ */
  const renderTimeField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = toInputTime(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputTime(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueTimePicker value={editValue} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (!/^\d{2}:\d{2}$/.test(editValue)) { setSaveError('Please enter a valid time'); return; } handleSaveField(record, fn, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD (hide-zero) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    if (!numberShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const step = Number.isInteger(Number(val)) ? 1 : 0.1;
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); setEditValue(String(Math.max(0, (parseFloat(editValue) || 0) - step))); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') { const numVal = parseFloat(editValue); if (!Number.isNaN(numVal) && numVal >= 0) handleSaveField(record, fn, idx, sid, numVal); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); setEditValue(String(Math.max(0, (parseFloat(editValue) || 0) + step))); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (Number.isNaN(numVal) || numVal < 0) { setSaveError('Please enter a nonnegative number'); return; } handleSaveField(record, fn, idx, sid, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD (custom Yes/No dropdown, saves boolean; renders false as "No") ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (typeof val !== 'boolean') return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING ARRAY — numbered editable rows ═══════ */
  const renderStringArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val : [];
    if (items.filter(x => !isEmptyDeep(x)).length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    /* keep original indices stable for save after hide-empty */
    const indexed = []; items.forEach((it, oi) => { if (!isEmptyDeep(it)) indexed.push([oi, it]); });

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {indexed.map(([oi, item]) => {
          const itemKey = `${fn}-${idx}-a${oi}`;
          const isEditing = editingField === itemKey;
          const badge = editedFields[itemKey];
          const itemStr = fmtVal(item);
          const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches && searchTerm.trim()) return null;
          return (
            <div key={oi} data-edit-field={`${fn}.${oi}`}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => {
                        e.stopPropagation();
                        const id2 = safeId(record); if (!id2) return;
                        const trimmed = editValue.trim();
                        setSaveError(null);
                        const leafKey = `${fn}.${oi}-${idx}`;
                        // Stage the exact indexed leaf so Pending Approve persists field + arrayIndex.
                        setLocalEdits(prev => ({ ...prev, [leafKey]: trimmed }));
                        setPendingEdits(prev => ({ ...prev, [leafKey]: true }));
                        setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' }));
                        setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                        const store = readDrafts();
                        if (!store[id2]) store[id2] = {};
                        store[id2][`${fn}.${oi}`] = trimmed;
                        writeDrafts(store);
                        setEditingField(null); setEditValue('');
                      }}>{saving ? 'Saving...' : 'Save'}</button>
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
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (per-sentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal, fn);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return (
        <div key={fn} className="rec-mini-card nested-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx} data-edit-field={fn}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(record, fn, idx, sid, sIdx); } }} />
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

    /* Single-value string */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {ENUM_OPTIONS[fn] ? (
                <BlueSelect value={editValue} options={enumOptionsWith(fn, strVal)} onChange={setEditValue} />
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(record, fn, idx, sid); } }} />
              )}
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx);
      if (BOOLEAN_FIELDS.includes(f)) return typeof getFieldValue(record, f, idx) === 'boolean';
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
            if (TIME_FIELDS.includes(f)) return renderTimeField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (STRING_ARRAY_FIELDS.includes(f)) return renderStringArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="tube-feeding-order-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Tube Feeding Order</h2></div>
        <div className="empty-state">No tube feeding order records available</div>
      </div>
    );
  }

  return (
    <div className="tube-feeding-order-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Tube Feeding Order</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TubeFeedingOrderDocumentPDFTemplate document={pdfData} />} fileName="Tube_Feeding_Order.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search tube feeding order records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Tube Feeding Order ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TubeFeedingOrderDocument;
