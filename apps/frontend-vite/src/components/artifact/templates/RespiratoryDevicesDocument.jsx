/**
 * RespiratoryDevicesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: respiratory_devices
 *
 * 5 Sections:
 *   1. device-info: type, provider, facility, date
 *   2. devices: homeNebulizer, peakFlowMeter, spacerDevice, oxygenConcentrator, hepaFilter, airPurifier
 *   3. cpap-bipap: cpapBipap.type, cpapBipap.settings, cpapBipap.compliance
 *   4. clinical: findings, assessment, plan
 *   5. recommendations-notes: recommendations, notes, status
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import RespiratoryDevicesDocumentPDFTemplate from '../pdf-templates/RespiratoryDevicesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RespiratoryDevicesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field key, e.g.
   "findings", "cpapBipap.type", "results.fvc", or an array field whose value is the whole array) */
const DRAFT_KEY = 'respiratoryDevicesPendingEdits';
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
  'device-info': 'Device Information',
  'devices': 'Devices',
  'cpap-bipap': 'CPAP / BiPAP',
  'clinical': 'Clinical',
  'recommendations-notes': 'Recommendations & Notes',
};

const FIELD_LABELS = {
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  homeNebulizer: 'Home Nebulizer',
  peakFlowMeter: 'Peak Flow Meter',
  spacerDevice: 'Spacer Device',
  oxygenConcentrator: 'Oxygen Concentrator',
  hepaFilter: 'HEPA Filter',
  airPurifier: 'Air Purifier',
  'cpapBipap.type': 'CPAP/BiPAP Type',
  'cpapBipap.settings': 'CPAP/BiPAP Settings',
  'cpapBipap.compliance': 'CPAP/BiPAP Compliance',
  'cpapBipap.dataDownload': 'CPAP/BiPAP Data Download',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'device-info': ['type', 'provider', 'facility', 'date'],
  'devices': ['homeNebulizer', 'peakFlowMeter', 'spacerDevice', 'oxygenConcentrator', 'hepaFilter', 'airPurifier'],
  'cpap-bipap': ['cpapBipap.type', 'cpapBipap.settings', 'cpapBipap.compliance', 'cpapBipap.dataDownload'],
  'clinical': ['findings', 'assessment', 'plan'],
  'recommendations-notes': ['recommendations', 'results', 'notes', 'status'],
};

const BOOLEAN_FIELDS = ['homeNebulizer', 'peakFlowMeter', 'oxygenConcentrator', 'hepaFilter', 'airPurifier'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results', 'cpapBipap.dataDownload'];
const STRING_FIELDS = ['type', 'provider', 'facility', 'spacerDevice', 'cpapBipap.type', 'cpapBipap.settings', 'cpapBipap.compliance', 'findings', 'assessment', 'plan', 'notes', 'status'];
const COMMA_FIELDS = ['cpapBipap.settings', 'assessment'];
const LABELED_NARRATIVE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

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

/* keyToLabel: humanize dynamic object keys (results.*) */
const keyToLabel = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

/* flattenObjectRows: recursively flatten a dynamic-key object into {dotKey, label, value} leaf rows.
   Humanized keys + typed leaves (boolean→Yes/No, number→String), content-gated.
   dotKey is the full sub-path under the object root (for dot-path saving). */
const flattenObjectRows = (obj, prefixKey = '', prefixLabel = '') => {
  if (!obj || typeof obj !== 'object') return [];
  const rows = [];
  Object.entries(obj).forEach(([key, val]) => {
    if (key === '_id') return;
    if (val === null || val === undefined || val === '') return;
    const dotKey = prefixKey ? `${prefixKey}.${key}` : key;
    const label = prefixLabel ? `${prefixLabel} — ${keyToLabel(key)}` : keyToLabel(key);
    if (Array.isArray(val)) {
      const items = val.filter(v => v !== null && v !== undefined && v !== '');
      if (items.length === 0) return;
      items.forEach((v, i) => {
        if (v && typeof v === 'object') rows.push(...flattenObjectRows(v, `${dotKey}.${i}`, `${label} ${i + 1}`));
        else rows.push({ dotKey: `${dotKey}.${i}`, label: `${label} ${i + 1}`, value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v), rawValue: v, editable: true });
      });
    } else if (typeof val === 'object') {
      if (val.$date) { rows.push({ dotKey, label, value: formatDate(val.$date), editable: false }); return; }
      if (Object.keys(val).length === 0) return;
      rows.push(...flattenObjectRows(val, dotKey, label));
    } else {
      rows.push({ dotKey, label, value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val), rawValue: val, editable: true });
    }
  });
  return rows;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const RespiratoryDevicesDocument = ({ document: docProp }) => {
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
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.respiratory_devices) return Array.isArray(r.respiratory_devices) ? r.respiratory_devices : [r.respiratory_devices];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.respiratory_devices) return Array.isArray(dd.respiratory_devices) ? dd.respiratory_devices : [dd.respiratory_devices]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE PENDING DRAFTS ═══════ */
  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
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

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (v && typeof v === 'object' && !Array.isArray(v)) { return flattenObjectRows(v).map(r => `${r.label}: ${r.value}`).join('; '); } return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;]\s+/)
      .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
      .filter(value => value && !/^[;.,!?]+$/.test(value));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const setNestedValue = useCallback(function setNestedValueRecursive(source, path, value) {
    if (!path.length) return value;
    const [head, ...tail] = path;
    const clone = Array.isArray(source) ? [...source] : { ...(source && typeof source === 'object' ? source : {}) };
    const key = /^\d+$/.test(String(head)) ? Number(head) : head;
    clone[key] = setNestedValueRecursive(clone[key], tail, value);
    return clone;
  }, []);

  const getNestedValue = useCallback((source, path) => String(path).split('.').reduce((value, key) => value?.[key], source), []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    let value = getNestedValue(record, fn);
    const suffix = `-${idx}`;
    Object.entries(localEdits).forEach(([editKey, editValue]) => {
      if (!editKey.endsWith(suffix)) return;
      const fieldPath = editKey.slice(0, -suffix.length);
      if (!fieldPath.startsWith(`${fn}.`)) return;
      value = setNestedValue(value, fieldPath.slice(fn.length + 1).split('.'), editValue);
    });
    return value;
  }, [localEdits, getNestedValue, setNestedValue]);

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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      const rt = `Respiratory Devices ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const [rootField, ...path] = fieldPath.split('.');
          if (path.length) merged[rootField] = setNestedValue(merged[rootField], path, localEdits[key]);
          else merged[rootField] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, setNestedValue]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
  // localEditsValue is what gets merged into the record (string / array / cloned object);
  // draftValue is the same thing persisted to localStorage under the record id keyed by base field `fn`.
  const stageDraft = useCallback((record, fn, idx, localEditsValue) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: localEditsValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    const sid = Object.keys(SECTION_FIELDS).find(s => (SECTION_FIELDS[s] || []).some(sf => fn === sf || fn.startsWith(`${sf}.`)));
    if (sid) {
      setApprovedSections(prev => {
        const sk = `${sid}-${idx}`;
        if (!prev[sk]) return prev;
        const next = { ...prev }; delete next[sk]; return next;
      });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = localEditsValue;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      // Stage as a DRAFT (no DB write). Approve commits it.
      stageDraft(record, fn, idx, fullText);
      setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage as a DRAFT (no DB write). Approve commits it.
    stageDraft(record, fn, idx, fullText);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending drafts for this record whose base field belongs to this section.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // base field, e.g. "findings", "cpapBipap.type", "results.fvc", "recommendations"
      return fields.some(f => fieldPart === f || fieldPart.startsWith(`${f}.`));
    });
    setSaving(true); setSaveError(null);
    try {
      // Persist each staged field to the DB now. Treat a trailing dot-segment as arrayIndex ONLY
      // when it is purely numeric (e.g. "foo.2"); dotted names like "cpapBipap.type" stay whole.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        let payload;
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload = { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(fieldPart.slice(lastDot + 1), 10) };
        } else {
          payload = { field: fieldPart, value: localEdits[editKey] };
        }
        const resp = await secureApiClient.put(`/api/edit/respiratory_devices/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/respiratory_devices/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[RespiratoryDevices] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
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
  const formatSentenceFieldLines = useCallback((text, fn) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(s) : { isLabeled: false, label: '', value: s };
      const source = parsed.isLabeled ? parsed.value : s;
      const parts = COMMA_FIELDS.includes(fn) ? splitByComma(source) : [source];
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push('-'.repeat(40));
        n = 1;
      }
      parts.forEach(item => { lines.push(`${n++}. ${item}`); });
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
        text += `${label}\n${'-'.repeat(40)}\n1. ${formatDate(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${'-'.repeat(40)}\n1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${'-'.repeat(40)}\n`;
        items.forEach((item, itemIndex) => {
          if (item && typeof item === 'object') {
            if (item.date) text += `${formatDate(item.date)}\n`;
            if (item.recommendation) text += `${itemIndex + 1}. ${item.recommendation}\n`;
          } else text += `${itemIndex + 1}. ${item}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        const rows = flattenObjectRows(val);
        if (rows.length > 0) {
          text += `${label}\n${'-'.repeat(40)}\n`;
          rows.forEach((row, rowIndex) => { text += `${row.label}\n${rowIndex + 1}. ${row.value}\n`; });
          text += '\n';
        }
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        text += `${label}\n${'-'.repeat(40)}\n`;
        formatSentenceFieldLines(strVal, f).forEach(line => { text += `${line}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${'-'.repeat(40)}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== RESPIRATORY DEVICES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Respiratory Devices ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        <div className="nested-mini-card" data-edit-field={fn}>
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD — select Yes/No, convert to boolean on save ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card" data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS grouped by normalized date ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = (Array.isArray(val) ? val : []).map((item, itemIndex) => ({
      item: item && typeof item === 'object' ? item : { recommendation: String(item || ''), date: '' },
      itemIndex,
    })).filter(({ item }) => hasVal(item.recommendation) || hasVal(item.date));
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const groups = [];
    items.forEach(entry => {
      const dateKey = toInputDate(entry.item.date) || 'no-date';
      const previous = groups[groups.length - 1];
      if (previous && previous.dateKey === dateKey) previous.entries.push(entry);
      else groups.push({ dateKey, entries: [entry] });
    });

    const saveGroupDate = (datePaths, value) => {
      const isoValue = value ? `${value}T00:00:00.000Z` : '';
      datePaths.forEach(path => stageDraft(record, path, idx, isoValue));
      setEditedFields(prev => ({ ...prev, ...Object.fromEntries(datePaths.map(path => [`${path}-${idx}`, 'edited'])) }));
      setEditingField(null); setEditValue(''); setSaveError(null);
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((group, groupIndex) => {
          const datePaths = group.entries.filter(({ item }) => hasVal(item.date)).map(({ itemIndex }) => `${fn}.${itemIndex}.date`);
          const dateEditKey = `${fn}-date-group-${groupIndex}-${idx}`;
          const isDateEditing = editingField === dateEditKey;
          return (
            <div key={`${group.dateKey}-${groupIndex}`} className="nested-mini-card recommendation-group">
              {group.dateKey !== 'no-date' && (
                <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                  <div className="nested-subtitle date-subtitle editable-row" onClick={() => { if (!isDateEditing) { setEditingField(dateEditKey); setEditValue(group.dateKey); setSaveError(null); } }}>
                    {isDateEditing ? (
                      <div className="edit-field-container">
                        <BlueDatePicker value={editValue} onSelect={setEditValue} />
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveGroupDate(datePaths, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : <><span className="content-value">{highlightText(formatDate(group.entries[0].item.date))}</span><span className="edit-indicator">&#9998;</span></>}
                  </div>
                </div>
              )}
              {group.entries.map(({ item, itemIndex }) => {
                if (!hasVal(item.recommendation)) return null;
                const fieldPath = `${fn}.${itemIndex}.recommendation`;
                const editKey = `${fieldPath}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                const itemStr = String(getFieldValue(record, fieldPath, idx) ?? item.recommendation);
                return (
                  <div key={fieldPath} data-edit-field={fieldPath}>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); handleSaveField(record, fieldPath, idx, sid, null, editValue.trim(), editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const groups = [];
    sentences.forEach((sentence, sentenceIndex) => {
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(sentence) : { isLabeled: false, label: '', value: sentence };
      const sourceValue = parsed.isLabeled ? parsed.value : sentence;
      const parts = COMMA_FIELDS.includes(fn) ? splitByComma(sourceValue) : [sourceValue];
      const rows = parts.map((text, partIndex) => ({ text, sentenceIndex, partIndex: parts.length > 1 ? partIndex : null, parsedLabel: parsed.isLabeled ? parsed.label : '' }));
      if (parsed.isLabeled) groups.push({ label: parsed.label, rows });
      else {
        const previous = groups[groups.length - 1];
        if (previous && !previous.label) previous.rows.push(...rows);
        else groups.push({ label: '', rows });
      }
    });

    const saveClause = (row, rowKey) => {
      if (row.partIndex === null && !row.parsedLabel) { saveSentence(record, fn, idx, sid, row.sentenceIndex); return; }
      const currentSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const currentSentence = currentSentences[row.sentenceIndex] || '';
      const parsed = LABELED_NARRATIVE_FIELDS.includes(fn) ? parseLabel(currentSentence) : { isLabeled: false, label: '', value: currentSentence };
      const sourceValue = parsed.isLabeled ? parsed.value : currentSentence;
      const parts = row.partIndex === null ? [sourceValue] : splitByComma(sourceValue);
      const cleanValue = editValue.replace(/[;.]+$/, '').trim();
      if (row.partIndex === null) parts[0] = cleanValue;
      else parts[row.partIndex] = cleanValue;
      currentSentences[row.sentenceIndex] = `${parsed.isLabeled ? `${parsed.label}: ` : ''}${parts.join(', ')}`;
      stageDraft(record, fn, idx, reconstructFullText(currentSentences));
      setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
      setSaveError(null); setEditingField(null); setEditValue('');
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {groups.map((group, groupIndex) => (
          <div key={`${fn}-group-${groupIndex}`} className={`nested-mini-card ${group.label ? '' : 'regular-row-group'}`}>
            {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
            {group.rows.map((row, rowIndex) => {
              const rowKey = `${fn}-${idx}-s${row.sentenceIndex}${row.partIndex === null ? '' : `-c${row.partIndex}`}`;
              const isEditing = editingField === rowKey;
              const badge = editedSentences[rowKey];
              const phrase = searchTerm.toLowerCase().trim();
              const matches = !phrase || sectionTitleMatches(sid) || record._showAllSections || label.toLowerCase().includes(phrase) || group.label.toLowerCase().includes(phrase) || row.text.toLowerCase().includes(phrase);
              if (!matches) return null;
              return (
                <div key={`${row.sentenceIndex}-${rowIndex}`} data-edit-field={fn}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowKey); setEditValue(row.text); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveClause(row, rowKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[rowKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: DYNAMIC-KEY OBJECT FIELD (results) — humanized keys + typed leaves + dot-path save ═══════ */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object' || Array.isArray(val)) return null;
    const rows = flattenObjectRows(val);
    if (rows.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {rows.map((row) => {
          const fieldPath = `${fn}.${row.dotKey}`;
          const editKey = `${fieldPath}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const currentRaw = getFieldValue(record, fieldPath, idx);
          const rawValue = currentRaw === undefined ? row.rawValue : currentRaw;
          const isNumber = typeof rawValue === 'number';
          const isBool = typeof rawValue === 'boolean';
          const displayValue = isBool ? (rawValue ? 'Yes' : 'No') : String(rawValue ?? row.value);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = row.label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !displayValue.toLowerCase().includes(phrase)) return null;
          }

          const startEdit = () => {
            if (isEditing) return;
            setEditingField(editKey);
            setEditValue(displayValue);
            setSaveError(null);
          };
          const commitSave = saveValue => handleSaveField(record, fieldPath, idx, sid, null, saveValue, editKey);
          const stepNumber = direction => {
            const current = Number.parseFloat(editValue);
            const baseline = Number.isFinite(current) ? current : 0;
            const step = String(editValue).includes('.') ? 0.1 : 1;
            setEditValue(String(Number((baseline + direction * step).toFixed(step === 1 ? 0 : 1))));
          };

          return (
            <div key={row.dotKey} className="nested-mini-card">
              <div className="nested-subtitle">{highlightText(row.label)}</div>
              <div data-edit-field={fieldPath}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={startEdit}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {isBool ? (
                        <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                      ) : isNumber ? (
                        <div className="num-stepper-row">
                          <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); stepNumber(-1); }}>−</button>
                          <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={event => event.stopPropagation()} onChange={event => setEditValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          <button type="button" className="num-step" disabled={saving} onClick={event => { event.stopPropagation(); stepNumber(1); }}>+</button>
                        </div>
                      ) : (
                        <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      )}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={event => {
                          event.stopPropagation();
                          if (isBool) { commitSave(editValue === 'Yes'); return; }
                          if (isNumber) {
                            const numberValue = Number.parseFloat(editValue);
                            if (!Number.isFinite(numberValue)) { setSaveError('Please enter a valid number'); return; }
                            commitSave(numberValue); return;
                          }
                          commitSave(editValue.trim());
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(displayValue, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="respiratory-devices-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Respiratory Devices</h2></div>
        <div className="empty-state">No respiratory devices records available</div>
      </div>
    );
  }

  return (
    <div className="respiratory-devices-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Respiratory Devices</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<RespiratoryDevicesDocumentPDFTemplate document={pdfData} />} fileName="Respiratory_Devices.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search respiratory devices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`Respiratory Devices ${idx + 1}`)}</h3></div>
            {renderSection(record, idx, 'device-info')}
            {renderSection(record, idx, 'devices')}
            {renderSection(record, idx, 'cpap-bipap')}
            {renderSection(record, idx, 'clinical')}
            {renderSection(record, idx, 'recommendations-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RespiratoryDevicesDocument;
