/**
 * ColorectalColonoscopiesDocument.jsx
 * June 2026 — Schema-aligned rebuild (24/24 fields) with inline editing, blue glow theme
 * Collection: colorectal_colonoscopies (alias: colonoscopy_reports)
 *
 * Header: procedureDate (date) + provider + facility
 * 4 Sections:
 *   1. procedure:            indication, bowelPrepQuality, cecumReached, cecumIntubationTime (num), withdrawalTime (num), sedationType, procedureCompleteness
 *   2. findings:             polypsFound, polypDetails (array), polypectomyPerformed, resectionMethod (array), adenomaDetectionRate
 *   3. biopsy-pathology:     biopsiesTaken, biopsyLocations (array), pathologyFindings, significantFindings (array)
 *   4. complications-followup: complications (array), hemostasisRequired, recommendedSurveillance, photographicDocumentation, previousColonoscopyDate (date)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ColorectalColonoscopiesDocumentPDFTemplate from '../pdf-templates/ColorectalColonoscopiesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ColorectalColonoscopiesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart = "field"  |  "field.arrayIndex.subField"  (object-subfield edits) — value may be a
   plain string OR a whole array (array/object-array string edits stage the merged array). */
const DRAFT_KEY = 'colorectal_colonoscopiesPendingEdits';
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
  'procedure': 'Procedure',
  'findings': 'Findings',
  'biopsy-pathology': 'Biopsy & Pathology',
  'complications-followup': 'Complications & Follow-Up',
};

const FIELD_LABELS = {
  procedureDate: 'Procedure Date',
  provider: 'Provider',
  facility: 'Facility',
  indication: 'Indication',
  bowelPrepQuality: 'Bowel Prep Quality',
  cecumReached: 'Cecum Reached',
  cecumIntubationTime: 'Cecum Intubation Time (min)',
  withdrawalTime: 'Withdrawal Time (min)',
  sedationType: 'Sedation Type',
  procedureCompleteness: 'Procedure Completeness',
  polypsFound: 'Polyps Found',
  polypDetails: 'Polyp Details',
  polypectomyPerformed: 'Polypectomy Performed',
  resectionMethod: 'Resection Method',
  adenomaDetectionRate: 'Adenoma Detection Rate',
  biopsiesTaken: 'Biopsies Taken',
  biopsyLocations: 'Biopsy Locations',
  pathologyFindings: 'Pathology Findings',
  significantFindings: 'Significant Findings',
  complications: 'Complications',
  hemostasisRequired: 'Hemostasis Required',
  recommendedSurveillance: 'Recommended Surveillance',
  photographicDocumentation: 'Photographic Documentation',
  previousColonoscopyDate: 'Previous Colonoscopy Date',
};

const SECTION_FIELDS = {
  'procedure': ['indication', 'bowelPrepQuality', 'cecumReached', 'cecumIntubationTime', 'withdrawalTime', 'sedationType', 'procedureCompleteness'],
  'findings': ['polypsFound', 'polypDetails', 'polypectomyPerformed', 'resectionMethod', 'adenomaDetectionRate'],
  'biopsy-pathology': ['biopsiesTaken', 'biopsyLocations', 'pathologyFindings', 'significantFindings'],
  'complications-followup': ['complications', 'hemostasisRequired', 'recommendedSurveillance', 'photographicDocumentation', 'previousColonoscopyDate'],
};

const DATE_FIELDS = ['procedureDate', 'previousColonoscopyDate'];
const NUMBER_FIELDS = ['cecumIntubationTime', 'withdrawalTime'];
/* polypDetails is an array-of-objects {location,size,morphology,pathology} per unified schema;
   the rest are plain string arrays. Object items get per-subfield editable rows that PRESERVE
   object shape (save via arrayIndex+subField dot-path) — never flattened-string overwrite. */
const OBJECT_ARRAY_FIELDS = ['polypDetails'];
const OBJECT_SUBFIELDS = {
  polypDetails: [
    { key: 'location', label: 'Location' },
    { key: 'size', label: 'Size' },
    { key: 'morphology', label: 'Morphology' },
    { key: 'parisClassification', label: 'Paris Classification' },
    { key: 'pathology', label: 'Pathology' },
  ],
};
const ARRAY_FIELDS = ['resectionMethod', 'biopsyLocations', 'significantFindings', 'complications'];
const STRING_FIELDS = ['provider', 'facility', 'indication', 'bowelPrepQuality', 'cecumReached', 'sedationType', 'polypsFound', 'polypectomyPerformed', 'biopsiesTaken', 'pathologyFindings', 'adenomaDetectionRate', 'hemostasisRequired', 'recommendedSurveillance', 'procedureCompleteness', 'photographicDocumentation'];

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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const ColorectalColonoscopiesDocument = ({ document: docProp }) => {
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

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.colorectal_colonoscopies) return Array.isArray(r.colorectal_colonoscopies) ? r.colorectal_colonoscopies : [r.colorectal_colonoscopies];
      if (r?.colonoscopy_reports) return Array.isArray(r.colonoscopy_reports) ? r.colonoscopy_reports : [r.colonoscopy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colorectal_colonoscopies) return Array.isArray(dd.colorectal_colonoscopies) ? dd.colorectal_colonoscopies : [dd.colorectal_colonoscopies]; return [dd]; }
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
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

  /* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
  const numberShows = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0) {
      const editKey = `${fn}-${idx}`;
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
      return Boolean(editedFields[editKey]) || doctorEdited;
    }
    return true;
  }, [getFieldValue, editedFields]);

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
      const rt = `Colonoscopy Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of [...DATE_FIELDS, ...NUMBER_FIELDS, ...ARRAY_FIELDS, ...STRING_FIELDS]) {
        const val = getFieldValue(record, f, idx);
        if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (!m || parseInt(m[2]) !== idx) return;
        const path = m[1];
        const objSub = path.match(/^(.+)\.(\d+)\.([^.]+)$/);
        if (objSub) {
          /* object-array subfield edit: clone & patch the object, preserving shape */
          const [, field, arrIdxStr, subField] = objSub;
          const arrIdx = parseInt(arrIdxStr);
          const src = Array.isArray(merged[field]) ? merged[field] : [];
          const cloned = src.map(it => (it && typeof it === 'object' ? { ...it } : it));
          if (cloned[arrIdx] && typeof cloned[arrIdx] === 'object') {
            cloned[arrIdx][subField] = localEdits[key];
            merged[field] = cloned;
          } else if (cloned[arrIdx] !== undefined) {
            cloned[arrIdx] = localEdits[key];
            merged[field] = cloned;
          }
        } else {
          merged[path] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  /* Per-subfield save that PRESERVES object shape (staged via arrayIndex+subField dot-path fieldPart). */
  const handleSaveObjectSubField = useCallback((record, fn, idx, arrayIndex, subField) => {
    const id = safeId(record); if (!id) return;
    const saveVal = editValue.trim();
    const fieldPart = `${fn}.${arrayIndex}.${subField}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Stage a whole-field DRAFT (string OR array) under fieldPart=fn (no DB write). Survives refresh; Approve commits.
  function stageFieldDraft(record, fn, idx, value) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
    if (sid) setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }
  // Array fields stage the merged array under fieldPart=fn; Approve PUTs { field: fn, value: array }.
  const stageArrayDraft = stageFieldDraft;

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageFieldDraft(record, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageFieldDraft(record, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const items = splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const rebuilt = `${p.label}: ${items.join(', ')}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS);
    stageFieldDraft(record, fn, idx, fullText);
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
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

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // editKeys for THIS record (-idx suffix) whose fieldPart root belongs to THIS section, that are still pending
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const root = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(root);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" | "field.arrayIndex.subField" | "field.arrayIndex"
        const value = localEdits[editKey];
        // Reverse handleSaveObjectSubField: "field.<idx>.<sub>" → { field, arrayIndex, subField }
        const objSub = fieldPart.match(/^(.+)\.(\d+)\.([^.]+)$/);
        // Else arrayIndex only when the segment AFTER THE LAST DOT is purely numeric
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        let payload;
        if (objSub) {
          payload = { field: objSub[1], value, arrayIndex: parseInt(objSub[2], 10), subField: objSub[3] };
        } else if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload = { field: fieldPart.slice(0, lastDot), value, arrayIndex: parseInt(lastSeg, 10) };
        } else {
          payload = { field: fieldPart, value };
        }
        const resp = await secureApiClient.put(`/api/edit/colorectal_colonoscopies/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/colorectal_colonoscopies/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's now-committed drafts (only the fields we just committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Save failed. Please try again.'); } finally { setSaving(false); }
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
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  /* Resolve an object-array field with any per-subfield localEdits applied (preserves shape). */
  const resolveObjectArray = useCallback((record, fn, idx) => {
    const base = getFieldValue(record, fn, idx);
    const arr = Array.isArray(base) ? base.map(it => (it && typeof it === 'object' ? { ...it } : it)) : [];
    Object.keys(localEdits).forEach(key => {
      const m = key.match(new RegExp(`^${fn}\\.(\\d+)\\.([^.]+)-${idx}$`));
      if (m) { const ai = parseInt(m[1]); if (arr[ai] && typeof arr[ai] === 'object') arr[ai][m[2]] = localEdits[key]; }
    });
    return arr;
  }, [getFieldValue, localEdits]);

  const flattenObjItem = useCallback((item) => {
    if (item && typeof item === 'object') {
      return Object.entries(item).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '').map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return String(item);
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (DATE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        text += `${label}\n${formatDate(val)}\n\n`;
        return;
      }
      if (OBJECT_ARRAY_FIELDS.includes(f)) {
        const items = resolveObjectArray(record, f, idx).filter(it => (it && typeof it === 'object') ? Object.values(it).some(v => v !== null && v !== undefined && String(v).trim() !== '') : String(it).trim() !== '');
        if (items.length === 0) return;
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${flattenObjItem(item)}`).join('\n')}\n\n`;
        return;
      }
      if (NUMBER_FIELDS.includes(f)) {
        if (!numberShows(record, f, idx)) return;
        text += `${label}: ${val}\n\n`;
        return;
      }
      if (!hasVal(val)) return;
      if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        text += `${label}\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
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
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, numberShows, splitBySentence, formatSentenceFieldLines, resolveObjectArray, flattenObjItem]);

  const copyAllText = useCallback(async () => {
    let text = '=== COLONOSCOPY REPORT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Colonoscopy Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (hasVal(getFieldValue(r, 'procedureDate', idx))) text += `Procedure Date: ${formatDate(getFieldValue(r, 'procedureDate', idx))}\n`;
      if (hasVal(getFieldValue(r, 'provider', idx))) text += `Provider: ${fmtVal(getFieldValue(r, 'provider', idx))}\n`;
      if (hasVal(getFieldValue(r, 'facility', idx))) text += `Facility: ${fmtVal(getFieldValue(r, 'facility', idx))}\n`;
      text += '\n';
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, getFieldValue, hasVal, fmtVal]);

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
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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

  /* ═══════ RENDER: NUMBER FIELD (hide-zero) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    if (!numberShows(record, fn, idx)) return null;
    const val = getFieldValue(record, fn, idx);
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" step="any" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
  };

  /* ═══════ RENDER: OBJECT-ARRAY FIELD (per-subfield rows, preserves object shape) ═══════ */
  const renderObjectArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();
    const subDefs = OBJECT_SUBFIELDS[fn] || [];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, oi) => {
          /* Plain-string item (mixed-shape data): single editable string row preserving array slot. */
          if (!item || typeof item !== 'object') {
            const itemStr = String(item);
            if (itemStr.trim() === '') return null;
            const objKey = `${fn}-${idx}-o${oi}`;
            const isEditing = editingField === objKey;
            const badge = editedFields[objKey];
            const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(phrase);
            if (!itemMatches) return null;
            return (
              <div key={oi}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(objKey); setEditValue(itemStr); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(null); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(null); setEditingField(null); setEditValue(''); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentArr = (Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : []).map(it => (it && typeof it === 'object' ? { ...it } : it)); currentArr[oi] = editValue; stageArrayDraft(record, fn, idx, currentArr); setEditedFields(prev => ({ ...prev, [objKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(null); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[objKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, objKey); }}>{copiedItems[objKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }

          /* Object item: per-subfield editable rows preserving {location,size,...} shape.
             Render known subfields first, then any extra (dynamic) keys not in OBJECT_SUBFIELDS. */
          const knownKeys = subDefs.map(s => s.key);
          const extraDefs = Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim() }));
          const allDefs = [...subDefs, ...extraDefs];
          const visibleSubs = allDefs.filter(sf => {
            const sfVal = localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key];
            return sfVal !== undefined && sfVal !== null && String(sfVal).trim() !== '';
          });
          if (visibleSubs.length === 0) return null;
          if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !labelMatch) {
            const anyMatch = visibleSubs.some(sf => String(localEdits[`${fn}.${oi}.${sf.key}-${idx}`] ?? item[sf.key]).toLowerCase().includes(phrase));
            if (!anyMatch) return null;
          }
          const subTitle = (localEdits[`${fn}.${oi}.location-${idx}`] ?? item.location) || (localEdits[`${fn}.${oi}.size-${idx}`] ?? item.size) || `Item ${oi + 1}`;

          return (
            <div key={oi} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(`${label.replace(/s$/, '')} ${oi + 1}: ${subTitle}`)}</div>
              {visibleSubs.map(sf => {
                const sfEditKey = `${fn}.${oi}.${sf.key}-${idx}`;
                const sfVal = localEdits[sfEditKey] ?? item[sf.key];
                const isEditing = editingField === sfEditKey;
                const badge = editedFields[sfEditKey];
                return (
                  <div key={sf.key}>
                    <div className="nested-subtitle" style={{ fontSize: 14, marginTop: 4, borderBottom: 'none', paddingBottom: 0 }}>{highlightText(sf.label)}</div>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(sfEditKey); setEditValue(String(sfVal)); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => { setSaveError(null); setEditValue(e.target.value); }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setSaveError(null); setEditingField(null); setEditValue(''); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectSubField(record, fn, idx, oi, sf.key); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setSaveError(null); setEditingField(null); setEditValue(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(String(sfVal))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[sfEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${sf.label}: ${sfVal}`, sfEditKey); }}>{copiedItems[sfEditKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => {
      if (typeof item === 'object' && item !== null) return Object.values(item).some(v => v !== null && v !== undefined && String(v).trim() !== '');
      return item !== null && item !== undefined && String(item).trim() !== '';
    }) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = typeof item === 'object' && item !== null
            ? Object.entries(item).filter(([, v]) => v !== null && v !== undefined && String(v).trim()).map(([k, v]) => `${k}: ${v}`).join(', ')
            : String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          const parsed = parseLabel(itemStr);
          return (
            <div key={itemIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 4 } : undefined}>
              {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsed.isLabeled ? parsed.value : itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const saveVal = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = saveVal; stageArrayDraft(record, fn, idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageFieldDraft(record, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); setSaveError(null); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single-value string: use saveSentence */
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      if (NUMBER_FIELDS.includes(f)) return numberShows(record, f, idx);
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderObjectArrayField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="colorectal-colonoscopies-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Colonoscopy Report</h2></div>
        <div className="empty-state">No colonoscopy records available</div>
      </div>
    );
  }

  return (
    <div className="colorectal-colonoscopies-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Colonoscopy Report</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ColorectalColonoscopiesDocumentPDFTemplate document={pdfData} />} fileName={`colonoscopy-report-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search colonoscopy records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.procedureDate) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.procedureDate)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Colonoscopy Report ${idx + 1}`)}</h3>
              {(hasVal(record.provider) || hasVal(record.facility)) && (
                <div className="record-subtitle">
                  {[record.provider, record.facility].filter(v => hasVal(v)).map(v => highlightText(String(v))).reduce((acc, cur, i) => i === 0 ? [cur] : [...acc, ' • ', cur], [])}
                </div>
              )}
            </div>
            {renderSection(record, idx, 'procedure')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'biopsy-pathology')}
            {renderSection(record, idx, 'complications-followup')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorectalColonoscopiesDocument;
