/**
 * VascularBypassSurgeryDocument.jsx
 * June 2026 — Inline editing, blue glow theme
 * Collection: vascular_bypass_surgery
 *
 * 6 Sections:
 *   1. provider-details: date, provider, facility (read-only metadata — rendered only when present)
 *   2. graft-details: bypassGraftType, proximalAnastomosisLocation, distalAnastomosisLocation, graftDiameterMillimeters, graftLengthCentimeters, saphenousVeinDiameter
 *   3. classification-scores: rutherfordClassification, wifiScore, tasciilClassification, runoffScore, glasgowAneurysmScore
 *   4. hemodynamics: preoperativeAnkleBrachialIndex, postoperativeAnkleBrachialIndex, toeBrachialIndex, transcutaneousOxygenPressure, intraoperativeGraftFlowRate, peakSystolicVelocityGraft, velocityRatioVr
 *   5. operative-details: clampTimeMinutes, estimatedBloodLossMilliliters, completionAngiogramResult, graftPatencyStatus, limbSalvageStatus
 *   6. anticoagulation-protocol: anticoagulationProtocol
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import VascularBypassSurgeryDocumentPDFTemplate from '../pdf-templates/VascularBypassSurgeryDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './VascularBypassSurgeryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field"; this template has no array/dotted fields) */
const DRAFT_KEY = 'vascular_bypass_surgeryPendingEdits';
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
  'provider-details': 'Provider Details',
  'graft-details': 'Graft Details',
  'classification-scores': 'Classification & Scores',
  'hemodynamics': 'Hemodynamics',
  'operative-details': 'Operative Details',
  'anticoagulation-protocol': 'Anticoagulation Protocol',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  bypassGraftType: 'Bypass Graft Type',
  proximalAnastomosisLocation: 'Proximal Anastomosis Location',
  distalAnastomosisLocation: 'Distal Anastomosis Location',
  graftDiameterMillimeters: 'Graft Diameter (mm)',
  graftLengthCentimeters: 'Graft Length (cm)',
  saphenousVeinDiameter: 'Saphenous Vein Diameter (mm)',
  rutherfordClassification: 'Rutherford Classification',
  wifiScore: 'WIfI Score',
  tasciilClassification: 'TASC II Classification',
  runoffScore: 'Runoff Score',
  glasgowAneurysmScore: 'Glasgow Aneurysm Score',
  preoperativeAnkleBrachialIndex: 'Preoperative ABI',
  postoperativeAnkleBrachialIndex: 'Postoperative ABI',
  toeBrachialIndex: 'Toe-Brachial Index',
  transcutaneousOxygenPressure: 'TcPO2 (mmHg)',
  intraoperativeGraftFlowRate: 'Intraoperative Graft Flow Rate (mL/min)',
  peakSystolicVelocityGraft: 'Peak Systolic Velocity - Graft (cm/s)',
  velocityRatioVr: 'Velocity Ratio (Vr)',
  clampTimeMinutes: 'Clamp Time (minutes)',
  estimatedBloodLossMilliliters: 'Estimated Blood Loss (mL)',
  completionAngiogramResult: 'Completion Angiogram Result',
  graftPatencyStatus: 'Graft Patency Status',
  limbSalvageStatus: 'Limb Salvage Status',
  anticoagulationProtocol: 'Anticoagulation Protocol',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility'],
  'graft-details': ['bypassGraftType', 'proximalAnastomosisLocation', 'distalAnastomosisLocation', 'graftDiameterMillimeters', 'graftLengthCentimeters', 'saphenousVeinDiameter'],
  'classification-scores': ['rutherfordClassification', 'wifiScore', 'tasciilClassification', 'runoffScore', 'glasgowAneurysmScore'],
  'hemodynamics': ['preoperativeAnkleBrachialIndex', 'postoperativeAnkleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'intraoperativeGraftFlowRate', 'peakSystolicVelocityGraft', 'velocityRatioVr'],
  'operative-details': ['clampTimeMinutes', 'estimatedBloodLossMilliliters', 'completionAngiogramResult', 'graftPatencyStatus', 'limbSalvageStatus'],
  'anticoagulation-protocol': ['anticoagulationProtocol'],
};

const SENTENCE_FIELDS = ['anticoagulationProtocol', 'completionAngiogramResult', 'graftPatencyStatus', 'bypassGraftType'];
const BOOLEAN_FIELDS = ['limbSalvageStatus'];
const NUMBER_FIELDS = [
  'graftDiameterMillimeters', 'graftLengthCentimeters', 'saphenousVeinDiameter',
  'runoffScore', 'glasgowAneurysmScore', 'preoperativeAnkleBrachialIndex',
  'postoperativeAnkleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure',
  'intraoperativeGraftFlowRate', 'peakSystolicVelocityGraft', 'velocityRatioVr',
  'clampTimeMinutes', 'estimatedBloodLossMilliliters',
];
/* Delimiter inventory: only this real-record field contains a safe top-level comma list. */
const COMMA_ARRAY_FIELDS = new Set(['anticoagulationProtocol']);
/* Provider metadata — NOT in the edit route's ALLOWED_FIELDS (24 schema fields only), so rendered without inline editing */
const READONLY_FIELDS = ['date', 'provider', 'facility'];
/* Date-typed fields rendered with formatDate */
const DATE_FIELDS = ['date'];
/* In this extractor-backed collection, numeric 0 is the documented missing-measurement sentinel.
   Hide it consistently in JSX, Copy Section, Copy All, and PDF. */
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split with date-aware guard
   — values like "(1.5-3x baseline), ACT 200-250 seconds" never lose their parentheticals */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const VascularBypassSurgeryDocument = ({ document: docProp, data, templateData }) => {
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
  const textareaRef = useRef(null);

  /* ═══════ DATA UNWRAP — all formats (document / data / templateData) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r?.records || r?._records)) return r.records || r._records;
      if (r?.vascular_bypass_surgery) return Array.isArray(r.vascular_bypass_surgery) ? r.vascular_bypass_surgery : [r.vascular_bypass_surgery];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vascular_bypass_surgery) return Array.isArray(dd.vascular_bypass_surgery) ? dd.vascular_bypass_surgery : [dd.vascular_bypass_surgery]; return [dd]; }
      return [r];
    });
    const filtered = arr.filter(r => r && typeof r === 'object');
    filtered.forEach((r, i) => { r._originalIdx = i; });
    return filtered;
  }, [docProp, data, templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nSentences = {};
    records.forEach((record) => {
      const idx = record._originalIdx ?? 0;
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  /* formatValue: returns null ONLY for null/undefined/'' — numeric 0 and boolean false are real values (never truthiness) */
  const formatValue = useCallback((v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    const s = String(v);
    return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2');
  }, []);
  /* hasFieldVal: presence check with EXPLICIT per-field zero hiding (4-AREA RULE: used by JSX, Copy Section, Copy All and mirrored in PDF) */
  const hasFieldVal = useCallback((fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return formatValue(v) !== null; }, [formatValue]);
  const fmtVal = useCallback((v) => formatValue(v) ?? '', [formatValue]);
  /* fmtFieldVal: field-aware formatting — date fields render as long dates (4-AREA RULE) */
  const fmtFieldVal = useCallback((fn, v) => { if (DATE_FIELDS.includes(fn)) return formatDate(v); return fmtVal(v); }, [fmtVal]);
  const arrItemText = useCallback((item) => { if (item === null || item === undefined) return ''; if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — '); return String(item); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/;\s+|(?<!\d)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const valueMatchesPhrase = useCallback((fn, val, phrase) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) {
      return val.some(item => arrItemText(item).toLowerCase().includes(phrase));
    }
    return fmtFieldVal(fn, val).toLowerCase().includes(phrase);
  }, [fmtFieldVal, arrItemText]);

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

  /* ═══════ SEARCH — 3-LEVEL (searchableText + shouldShowSection + shouldShowRow) ═══════ */
  /* Level 1 searchableText: document title, record title, ALL section titles, ALL field labels
     + 'Label: Value' entries for content matching */
  const buildSearchableText = useCallback((record, oi) => {
    const parts = ['vascular bypass surgery', `vascular bypass surgery ${oi + 1}`];
    Object.values(SECTION_TITLES).forEach(t => parts.push(t.toLowerCase()));
    Object.values(SECTION_FIELDS).forEach(fields => {
      fields.forEach(f => {
        const label = FIELD_LABELS[f] || f;
        parts.push(label.toLowerCase());
        const val = getFieldValue(record, f, oi);
        if (hasFieldVal(f, val)) parts.push(`${label}: ${fmtFieldVal(f, val)}`.toLowerCase());
      });
    });
    return parts.join('\n');
  }, [getFieldValue, hasFieldVal, fmtFieldVal]);

  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.startsWith(phrase) || phrase.startsWith(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.startsWith(phrase) || phrase.startsWith(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) continue;
      if (valueMatchesPhrase(f, val, phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const shouldShowRow = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (!hasFieldVal(fn, val)) return false;
    return valueMatchesPhrase(fn, val, phrase);
  }, [searchTerm, getFieldValue, valueMatchesPhrase, hasFieldVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record) => {
      const oi = record._originalIdx ?? 0;
      record._showAllSections = false;
      /* Document title + record title — matching either shows ALL sections */
      const docTitle = 'vascular bypass surgery';
      const rt = `vascular bypass surgery ${oi + 1}`;
      if (docTitle.includes(phrase) || phrase.includes(docTitle) || rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      /* Level 1: searchableText — section titles, field labels, 'Label: Value' content */
      const searchableText = buildSearchableText(record, oi);
      if (searchableText.includes(phrase)) return true;
      /* Reverse matching: long phrases that contain a section title or field label */
      for (const t of Object.values(SECTION_TITLES)) { if (phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (phrase.includes(l.toLowerCase())) return true; }
      return false;
    });
  }, [records, searchTerm, buildSearchableText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record) => {
      const oi = record._originalIdx ?? 0;
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === oi) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
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
    // Staged drafts for this section: localEdits key is `${field}-${idx}` (this template has no array/dotted keys).
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      return fields.includes(fieldPart);
    });
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" — no dotted array keys in this template
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // Treat a trailing dot-segment as arrayIndex ONLY when it is purely numeric
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/vascular_bypass_surgery/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/vascular_bypass_surgery/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's section drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
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

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const fieldRows = useCallback((fn, value) => {
    const text = fmtFieldVal(fn, value);
    if (!SENTENCE_FIELDS.includes(fn)) return [text];
    return splitBySentence(text).flatMap((clause) => {
      const parsed = parseLabel(clause);
      const values = COMMA_ARRAY_FIELDS.has(fn) ? splitByComma(parsed.value) : [parsed.value];
      return values.map(item => parsed.isLabeled ? `${parsed.label}: ${item}` : item);
    }).filter(Boolean);
  }, [fmtFieldVal, splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title.toUpperCase()}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasFieldVal(f, val)) return;
      text += `${label}\n${'-'.repeat(40)}\n`;
      fieldRows(f, val).forEach((row, rowIndex) => { text += `${rowIndex + 1}. ${row}\n`; });
      text += '\n';
    });
    return text;
  }, [getFieldValue, hasFieldVal, fieldRows]);

  const copyAllText = useCallback(async () => {
    let text = '=== VASCULAR BYPASS SURGERY ===\n\n';
    pdfData.forEach((r) => {
      const oi = r._originalIdx ?? 0;
      text += `Vascular Bypass Surgery ${oi + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, oi, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: READ-ONLY FIELD (provider metadata — not editable via the edit route) ═══════ */
  const renderReadOnlyField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const copyKey = `${fn}-${idx}`;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = fmtFieldVal(fn, val);
    if (searchTerm.trim() && !shouldShowRow(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="numbered-row">
          <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span></div>
          <button className={`copy-btn ${copiedItems[copyKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, copyKey); }}>{copiedItems[copyKey] ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE FIELD (no splitting — locations, classifications, measurements) ═══════ */
  const renderSimpleField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = fmtFieldVal(fn, val);
    const isModified = editedFields[editKey];
    const isNumber = NUMBER_FIELDS.includes(fn);
    const saveSimple = () => {
      if (!isNumber) { handleSaveField(record, fn, idx, sid, null, editValue); return; }
      const number = Number(editValue);
      if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; }
      handleSaveField(record, fn, idx, sid, null, number);
    };
    if (searchTerm.trim() && !shouldShowRow(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isNumber ? <div className="number-edit-row"><button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveSimple(); } }} /><button type="button" className="num-step" onClick={e => { e.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div> : <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveSimple(); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSimple(); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No select — saves a REAL boolean) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !shouldShowRow(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div data-edit-field={fn}>
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE FIELD — semicolon/period clauses and explicit comma fields ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !shouldShowRow(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rows = fieldRows(fn, val).map((raw, rowIndex) => ({ ...parseLabel(raw), raw, rowIndex }));
    const groups = [];
    rows.forEach(row => {
      const groupLabel = row.isLabeled ? row.label : '';
      const last = groups[groups.length - 1];
      if (last && last.label === groupLabel) last.rows.push(row);
      else groups.push({ label: groupLabel, rows: [row] });
    });
    const saveRow = (row) => {
      const nextRows = rows.map(item => item.raw);
      nextRows[row.rowIndex] = row.isLabeled ? `${row.label}: ${editValue.trim()}` : editValue.trim();
      handleSaveField(record, fn, idx, sid, null, nextRows.join('; '), `${fn}-${idx}-r${row.rowIndex}`);
    };
    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className="nested-mini-card">
            {group.label && <div className="nested-subtitle sub-label">{highlightText(group.label)}</div>}
            {group.rows.map(row => {
              const editKey = `${fn}-${idx}-r${row.rowIndex}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              const displayValue = row.isLabeled ? row.value : row.raw;
              return (
                <div key={editKey} data-edit-field={fn}>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
                    {isEditing ? <div className="edit-field-container"><textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveRow(row); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); saveRow(row); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${group.label ? `${group.label}\n` : ''}${displayValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => hasFieldVal(f, getFieldValue(record, f, idx)));
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (READONLY_FIELDS.includes(f)) return renderReadOnlyField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid);
            return renderSimpleField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="vascular-bypass-surgery-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Vascular Bypass Surgery</h2></div>
        <div className="empty-state">No vascular bypass surgery records available</div>
      </div>
    );
  }

  return (
    <div className="vascular-bypass-surgery-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Vascular Bypass Surgery</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<VascularBypassSurgeryDocumentPDFTemplate document={pdfData} />} fileName="Vascular_Bypass_Surgery.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search vascular bypass surgery..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const origIdx = record._originalIdx ?? idx;
          return (
            <div key={safeId(record) || idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(`Vascular Bypass Surgery ${origIdx + 1}`)}</h3>
              </div>
              {renderSection(record, origIdx, 'provider-details')}
              {renderSection(record, origIdx, 'graft-details')}
              {renderSection(record, origIdx, 'classification-scores')}
              {renderSection(record, origIdx, 'hemodynamics')}
              {renderSection(record, origIdx, 'operative-details')}
              {renderSection(record, origIdx, 'anticoagulation-protocol')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VascularBypassSurgeryDocument;
