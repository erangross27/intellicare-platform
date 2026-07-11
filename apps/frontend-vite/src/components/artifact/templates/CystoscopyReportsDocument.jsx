/**
 * CystoscopyReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: cystoscopy_reports
 *
 * 5 Sections:
 *   1. procedure-info: procedureIndication, cystoscopeType, anesthesiaType, procedureDuration (number)
 *   2. urethral-findings: urethralAppearance, urethralStrictures (array)
 *   3. bladder-findings: bladderCapacity (number), bladderMucosaAppearance (text — comma-split), bladderLesions (array), hunnerLesions (boolean), glomerulations (boolean), trabeculation, diverticula (array)
 *   4. ureteric-prostate: uretericOrifices (text — comma-split), ureteralJets, prostateAppearance, prostateSize
 *   5. biopsy-procedure: biopsyPerformed (boolean), biopsyLocations (array), resectionPerformed (boolean), irrigationFluid, complications (array), catheterPlaced (boolean), catheterSize
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CystoscopyReportsDocumentPDFTemplate from '../pdf-templates/CystoscopyReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CystoscopyReportsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'procedure-info': 'Procedure Info',
  'urethral-findings': 'Urethral Findings',
  'bladder-findings': 'Bladder Findings',
  'ureteric-prostate': 'Ureteric & Prostate',
  'biopsy-procedure': 'Biopsy & Procedure',
};

const FIELD_LABELS = {
  procedureIndication: 'Procedure Indication',
  cystoscopeType: 'Cystoscope Type',
  anesthesiaType: 'Anesthesia Type',
  procedureDuration: 'Procedure Duration',
  urethralAppearance: 'Urethral Appearance',
  urethralStrictures: 'Urethral Strictures',
  bladderCapacity: 'Bladder Capacity',
  bladderMucosaAppearance: 'Bladder Mucosa Appearance',
  bladderLesions: 'Bladder Lesions',
  hunnerLesions: 'Hunner Lesions',
  glomerulations: 'Glomerulations',
  trabeculation: 'Trabeculation',
  diverticula: 'Diverticula',
  uretericOrifices: 'Ureteric Orifices',
  ureteralJets: 'Ureteral Jets',
  prostateAppearance: 'Prostate Appearance',
  prostateSize: 'Prostate Size',
  biopsyPerformed: 'Biopsy Performed',
  biopsyLocations: 'Biopsy Locations',
  resectionPerformed: 'Resection Performed',
  irrigationFluid: 'Irrigation Fluid',
  complications: 'Complications',
  catheterPlaced: 'Catheter Placed',
  catheterSize: 'Catheter Size',
};

const SECTION_FIELDS = {
  'procedure-info': ['procedureIndication', 'cystoscopeType', 'anesthesiaType', 'procedureDuration'],
  'urethral-findings': ['urethralAppearance', 'urethralStrictures'],
  'bladder-findings': ['bladderCapacity', 'bladderMucosaAppearance', 'bladderLesions', 'hunnerLesions', 'glomerulations', 'trabeculation', 'diverticula'],
  'ureteric-prostate': ['uretericOrifices', 'ureteralJets', 'prostateAppearance', 'prostateSize'],
  'biopsy-procedure': ['biopsyPerformed', 'biopsyLocations', 'resectionPerformed', 'irrigationFluid', 'complications', 'catheterPlaced', 'catheterSize'],
};

/* sectionIdForField: reverse-lookup the sectionId that owns a field name. */
const sectionIdForField = (fn) => {
  for (const [sid, fields] of Object.entries(SECTION_FIELDS)) { if (fields.includes(fn)) return sid; }
  return null;
};

const BOOLEAN_FIELDS = ['hunnerLesions', 'glomerulations', 'biopsyPerformed', 'resectionPerformed', 'catheterPlaced'];
const NUMBER_FIELDS = ['bladderCapacity', 'procedureDuration'];
/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a real clinical value, not a "not recorded" sentinel.
   bladderCapacity (mL) and procedureDuration (min) are never legitimately 0, so 0 is hidden unless doctor-edited. */
const MEANINGFUL_ZERO_FIELDS = [];
const ARRAY_FIELDS = ['urethralStrictures', 'bladderLesions', 'diverticula', 'biopsyLocations', 'complications'];
const COMMA_SPLIT_FIELDS = ['bladderMucosaAppearance', 'uretericOrifices'];

/* Fixed-choice fields → <select>. Standard urology options; enumOptionsWith keeps any unlisted stored value. */
const ENUM_OPTIONS = {
  cystoscopeType: ['Flexible', 'Rigid'],
  anesthesiaType: ['Local', 'General', 'Spinal', 'Sedation', 'Topical'],
};
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
const enumOptionsWith = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; return base.includes(cur) ? base : (cur ? [cur, ...base] : base); };

/* −/+ stepper precision from the value's decimals (0/240 → 1 step). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cystoscopy_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* parseLabel: detect "Label: value" patterns — medical regex */
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

/* ═══════ COMPONENT ═══════ */
const CystoscopyReportsDocument = ({ document: docProp }) => {
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
      if (r?.cystoscopy_reports) return Array.isArray(r.cystoscopy_reports) ? r.cystoscopy_reports : [r.cystoscopy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cystoscopy_reports) return Array.isArray(dd.cystoscopy_reports) ? dd.cystoscopy_reports : [dd.cystoscopy_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Draft fieldPart is "field" or "field.arrayIndex"; array drafts are folded back into the full array
     stored under localEdits[`${fn}-${idx}`] (mirrors how saveArrayItem stages the whole array). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = !record?._id ? null : (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayPart = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrayPart) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const baseKey = `${fn}-${idx}`;
          const baseArr = Array.isArray(nLocal[baseKey]) ? nLocal[baseKey] : [...(Array.isArray(record[fn]) ? record[fn] : [])];
          baseArr[arrIdx] = value;
          nLocal[baseKey] = baseArr;
          nPending[baseKey] = true;
          nFields[`${fn}-${idx}-${arrIdx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          if (COMMA_SPLIT_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-c0`] = 'edited';
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
  /* fieldHasVal: like hasVal, but for NUMBER_FIELDS not in MEANINGFUL_ZERO_FIELDS a value of 0 is a "not recorded" sentinel and is hidden (unless doctor-edited). */
  const fieldHasVal = useCallback((fn, v, edited) => {
    if (NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.includes(fn) && typeof v === 'number' && v === 0 && !edited) return false;
    return hasVal(v);
  }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const val = record[fn];
    return Array.isArray(val) ? val : [];
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

  /* ═══════ SEARCH ═══════ */
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
      const rt = `Cystoscopy Reports ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = record[f];
          if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
          else if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      ARRAY_FIELDS.forEach(field => { if (pendingEdits[`${field}-${idx}`]) return; merged[field] = getEffectiveArray(record, field, idx); });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;

    /* Number validation */
    if (NUMBER_FIELDS.includes(fn)) {
      const origVal = record[fn];
      if (typeof origVal === 'number') {
        if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      }
    }

    /* Boolean conversion */
    let finalVal = saveVal;
    if (BOOLEAN_FIELDS.includes(fn)) {
      const lower = String(saveVal).toLowerCase().trim();
      finalVal = lower === 'yes' || lower === 'true';
    } else if (NUMBER_FIELDS.includes(fn) && typeof record[fn] === 'number') {
      finalVal = Number(saveVal);
    }

    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: finalVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    if (sid) setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = finalVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one comma-item → splice back into the full text + stage as a DRAFT (no DB write).
  function saveCommaItem(record, fn, idx, commaIdx, newItemText) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(currentVal);
    items[commaIdx] = newItemText.trim();
    const fullText = items.join(', ');
    const commaKey = `${fn}-${idx}-c${commaIdx}`;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    const sid = sectionIdForField(fn);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const next = { ...prev }; delete next[k]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  // Save one array element → stage the updated full array as a DRAFT (no DB write). The draft store
  // keeps the per-element value under a dotted "field.arrayIndex" key so Approve can replay it with arrayIndex.
  const saveArrayItem = useCallback((record, fn, idx, arrIdx) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const value = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const currentArr = [...getEffectiveArray(record, fn, idx)];
    currentArr[arrIdx] = value;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${arrIdx}`]: 'edited' }));
    const sid = sectionIdForField(fn);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const next = { ...prev }; delete next[k]; return next; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrIdx}`] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedKeys = []; // localEdits keys to clear from pendingEdits

      for (const fn of fields) {
        if (!ARRAY_FIELDS.includes(fn)) {
          // Scalar / boolean / number / comma-split: full-value PUT, staged under localEdits[`${fn}-${idx}`]
          const editKey = `${fn}-${idx}`;
          if (!pendingEdits[editKey]) continue;
          const resp = await secureApiClient.put(`/api/edit/cystoscopy_reports/${id}/edit`, { field: fn, value: localEdits[editKey] });
          if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
          committedKeys.push(editKey);
        } else {
          // Array: replay each staged element from the draft store's dotted "field.arrayIndex" keys
          const editKey = `${fn}-${idx}`;
          if (!pendingEdits[editKey]) continue;
          const dotted = Object.keys(recDrafts).filter(k => {
            const d = k.lastIndexOf('.');
            return d !== -1 && k.slice(0, d) === fn && /^\d+$/.test(k.slice(d + 1));
          });
          for (const k of dotted) {
            const arrIdx = parseInt(k.slice(k.lastIndexOf('.') + 1), 10);
            const resp = await secureApiClient.put(`/api/edit/cystoscopy_reports/${id}/edit`, { field: fn, value: recDrafts[k], arrayIndex: arrIdx });
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
          }
          committedKeys.push(editKey);
        }
      }

      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/cystoscopy_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; committedKeys.forEach(k => delete next[k]); return next; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) {
        fields.forEach(fn => {
          delete store[id][fn];
          Object.keys(store[id]).forEach(k => { const d = k.lastIndexOf('.'); if (d !== -1 && k.slice(0, d) === fn) delete store[id][k]; });
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[CystoscopyReports] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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

  /* ═══════ COPY BUILDERS (EQ/DASH numbered — Copy Section + Copy All share one builder) ═══════ */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const src = pdfData[idx] || record;
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(src[f]) ? src[f].filter(v => v !== null && v !== undefined && v !== '') : [];
        if (arr.length === 0) return;
        text += `${label}\n${COPY_LINE_DASH}\n${arr.map((item, i) => `${i + 1}. ${String(item)}`).join('\n')}\n\n`;
      } else if (COMMA_SPLIT_FIELDS.includes(f)) {
        const val = src[f]; if (!fieldHasVal(f, val)) return;
        const items = splitByComma(fmtVal(val));
        text += `${label}\n${COPY_LINE_DASH}\n`;
        if (items.length >= 3) text += items.map((it, i) => `${i + 1}. ${it}`).join('\n') + '\n';
        else text += `1. ${fmtVal(val)}\n`;
        text += '\n';
      } else {
        const val = src[f]; if (!fieldHasVal(f, val)) return;
        text += `${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [pdfData, fieldHasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== CYSTOSCOPY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cystoscopy Reports ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sec = buildSectionCopyText(r, idx, sid);
        // empty-section guard: title + EQ divider = 2 non-empty lines; only append when a field row exists
        if (sec.split('\n').filter(l => l.trim()).length > 2) text += sec;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: YES/NO SELECT FIELD (boolean) ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const normalizeYesNo = (v) => {
      const lower = String(v).toLowerCase().trim();
      if (lower === 'yes' || lower === 'true') return 'yes';
      if (lower === 'no' || lower === 'false') return 'no';
      return v;
    };

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(normalizeYesNo(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`;
    const isModified = editedFields[editKey];
    if (!fieldHasVal(fn, val, isModified)) return null;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const step = stepFor(val); const dec = (step.split('.')[1] || '').length;
    const bump = (d) => setEditValue(v => ((parseFloat(v || '0') || 0) + d * parseFloat(step)).toFixed(dec));

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>&#8722;</button>
                <input type="number" step={step} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, undefined, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (fixed-choice <select>) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const opts = enumOptionsWith(fn, displayVal);

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: COMMA-SPLIT FIELD ═══════ */
  const renderCommaSplitField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = splitByComma(val);
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (searchTerm.trim() && !phraseMatch && !labelMatch && !fieldMatches(record, fn, idx)) return null;

    if (items.length >= 3) {
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((ci, ciIdx) => {
            const commaKey = `${fn}-${idx}-c${ciIdx}`;
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
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single value — fall back to simple editable */
    return renderEditableField(record, fn, idx, sid, title);
  };

  /* ═══════ RENDER: ARRAY EDITABLE FIELD ═══════ */
  const renderArrayEditableField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx);
    if (!arr || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {arr.map((item, arrIdx) => {
            const arrKey = `${fn}-${idx}-${arrIdx}`;
            const isEditing = editingField === arrKey;
            const isModified = editedFields[arrKey];
            const itemStr = String(item);
            const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches) return null;
            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && editingField === arrKey && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, arrIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return fieldHasVal(f, getFieldValue(record, f, idx), editedFields[`${f}-${idx}`]);
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayEditableField(record, f, idx, sid, title);
            if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaSplitField(record, f, idx, sid, title);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="cystoscopy-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Cystoscopy Reports</h2></div>
        <div className="empty-state">No cystoscopy report records available</div>
      </div>
    );
  }

  return (
    <div className="cystoscopy-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cystoscopy Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<CystoscopyReportsDocumentPDFTemplate document={pdfData} />} fileName="Cystoscopy_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search cystoscopy reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Cystoscopy Reports ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'procedure-info')}
            {renderSection(record, idx, 'urethral-findings')}
            {renderSection(record, idx, 'bladder-findings')}
            {renderSection(record, idx, 'ureteric-prostate')}
            {renderSection(record, idx, 'biopsy-procedure')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CystoscopyReportsDocument;
