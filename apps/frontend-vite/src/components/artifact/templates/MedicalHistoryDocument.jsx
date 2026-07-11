/**
 * MedicalHistoryDocument.jsx
 * July 2026 — Canonical one-pass polish (config-driven, blue-glow inline editing).
 * Collection: medical_history
 *
 * Config-driven like the HematologyConsultations gold standard. Every populated field renders with the
 * canonical widget (BlueDatePicker for dates, −/+ stepper for numbers, textarea for text) and hides when
 * empty (0 / '' / [] / {} skipped). Sections (this record's shape):
 *   provider-details : date (record date → BlueDatePicker) · provider · facility
 *   chief-complaint  : chiefComplaint (string)
 *   chronic-conditions / past-surgeries / allergies / current-medications /
 *   immunization-history / travel-history : ARRAY of strings → list rows
 *   social-history   : socialHistory OBJECT → recursive label-above-value rows (occupation, travelCompanion, …)
 * Every other schema field (familyHistory, hospitalizations, reviewOfSystems, pastMedicalHistory,
 * menstrualHistory, obstetricalHistory, developmentalHistory, mentalHealthHistory, bloodType,
 * advanceDirectives, screeningTests, occupationalExposures, functionalStatus) is gated on hasVal() and
 * stays hidden when missing/empty.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import MedicalHistoryDocumentPDFTemplate from '../pdf-templates/MedicalHistoryDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './MedicalHistoryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPath]: value } }  (fieldPath = the field dot/bracket path) */
const DRAFT_KEY = 'medical_historyPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONFIG ═══════ */
const SECTION_ORDER = [
  'provider-details', 'chief-complaint', 'chronic-conditions', 'past-surgeries',
  'allergies', 'current-medications', 'immunization-history', 'social-history', 'travel-history',
];

const SECTION_TITLES = {
  'provider-details': 'Provider Details',
  'chief-complaint': 'Chief Complaint',
  'chronic-conditions': 'Chronic Conditions',
  'past-surgeries': 'Past Surgeries',
  'allergies': 'Allergies',
  'current-medications': 'Current Medications',
  'immunization-history': 'Immunization History',
  'social-history': 'Social History',
  'travel-history': 'Travel History',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  chiefComplaint: 'Chief Complaint',
  chronicConditions: 'Chronic Conditions',
  pastSurgeries: 'Past Surgeries',
  allergies: 'Allergies',
  currentMedications: 'Current Medications',
  immunizationHistory: 'Immunization History',
  socialHistory: 'Social History',
  travelHistory: 'Travel History',
  /* socialHistory sub-keys */
  occupation: 'Occupation',
  travelCompanion: 'Travel Companion',
  livingSituation: 'Living Situation',
  maritalStatus: 'Marital Status',
  tobacco: 'Tobacco',
  alcohol: 'Alcohol',
  drugs: 'Drugs',
  children: 'Children',
  supportSystem: 'Support System',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility'],
  'chief-complaint': ['chiefComplaint'],
  'chronic-conditions': ['chronicConditions'],
  'past-surgeries': ['pastSurgeries'],
  'allergies': ['allergies'],
  'current-medications': ['currentMedications'],
  'immunization-history': ['immunizationHistory'],
  'social-history': ['socialHistory'],
  'travel-history': ['travelHistory'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['chronicConditions', 'pastSurgeries', 'allergies', 'currentMedications', 'immunizationHistory', 'travelHistory'];
const OBJECT_FIELDS = ['socialHistory'];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers so a grammatical colon
   inside a sentence is NOT mistaken for a Label:Value pair). */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split; thousands guard (only split when a space follows the comma
   so "$18,000" / "1,200 mg" stay whole). */
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

/* ═══════ HELPERS ═══════ */
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; }
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.join(', ');
  return String(v || '');
};

/* prettifyKey: camelCase key → Title Case label (FIELD_LABELS wins when known) */
const prettifyKey = (k) => {
  const s = String(k || '');
  if (FIELD_LABELS[s]) return FIELD_LABELS[s];
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
};

/* stringifyItem: a list/object item may be a string OR object — join an object's non-empty values with ' — ' */
const stringifyItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return fmtVal(item);
  if (Array.isArray(item)) return item.filter(v => hasVal(v)).map(v => stringifyItem(v)).join(', ');
  return Object.values(item).filter(v => hasVal(v)).map(v => (typeof v === 'object' ? stringifyItem(v) : fmtVal(v))).join(' — ');
};

const safeId = (r) => {
  if (!r?._id) return null;
  if (typeof r._id === 'string') return r._id;
  if (r._id.$oid) return r._id.$oid;
  return String(r._id);
};

/* fieldPresent: is a field populated (respecting hasVal + hide-zero on nested items)? */
const fieldPresent = (record, f) => {
  const v = record[f];
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(it => hasVal(stringifyItem(it)));
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(sv => hasVal(sv));
  return hasVal(v);
};

/* ═══════ COMPONENT ═══════ */
const MedicalHistoryDocument = ({ document: docProp }) => {
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
      if (r?.medical_history) return Array.isArray(r.medical_history) ? r.medical_history : [r.medical_history];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.medical_history) return Array.isArray(dd.medical_history) ? dd.medical_history : [dd.medical_history]; return [dd]; }
      if (r?.document) { const doc = r.document; if (Array.isArray(doc)) return doc; return [doc]; }
      if (r?.data) { const d = r.data; if (Array.isArray(d)) return d; return [d]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
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

  /* ═══════ SENTENCE HELPERS ═══════ */
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

  /* ═══════ HIGHLIGHT ═══════ */
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = textStr.split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  const textMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    if (!hasVal(text)) return false;
    return String(text).toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const labelMatches = useCallback((fieldName) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fieldName] || fieldName).toLowerCase();
    return label.includes(p) || p.includes(label);
  }, [searchTerm]);

  /* searchable text for a field's value (arrays joined, objects flattened) */
  const fieldSearchText = useCallback((record, f) => {
    const v = record[f];
    if (DATE_FIELDS.includes(f)) return formatDate(v);
    if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) ? v.map(stringifyItem).join(' ') : '';
    if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' ? Object.entries(v).map(([k, sv]) => `${prettifyKey(k)} ${stringifyItem(sv)}`).join(' ') : '';
    return fmtVal(v);
  }, []);

  const fieldMatches = useCallback((record, f) => {
    if (!searchTerm.trim()) return true;
    return labelMatches(f) || textMatches(fieldSearchText(record, f));
  }, [searchTerm, labelMatches, textMatches, fieldSearchText]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (sectionTitleMatches(sid)) return true;
    return (SECTION_FIELDS[sid] || []).some(f => fieldPresent(record, f) && fieldMatches(record, f));
  }, [searchTerm, sectionTitleMatches, fieldMatches]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Medical History ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      return SECTION_ORDER.some(sid => (SECTION_FIELDS[sid] || []).some(f => fieldPresent(record, f) && textMatches(fieldSearchText(record, f))));
    });
  }, [records, searchTerm, textMatches, fieldSearchText]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text); return true;
    } catch {
      const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(ta); return true;
    }
  }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* getFieldValue: staged draft (localEdits) wins over the raw record value */
  const getFieldValue = useCallback((record, path, idx, fallback) => {
    const k = `${path}-${idx}`;
    return localEdits[k] !== undefined ? localEdits[k] : fallback;
  }, [localEdits]);

  /* sentence → numbered copy lines (decomposes "Label: v1, v2" like the on-screen render; never side-by-side) */
  const formatSentenceLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        lines.push(parsed.label);
        if (parts.length >= 2) parts.forEach(item => lines.push(`  ${n++}. ${item}`));
        else lines.push(`  ${n++}. ${parsed.value}`);
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  /* object → copy lines: sub-label on its own line, value below (recurses for nested objects/arrays) */
  const objectCopyLines = useCallback((obj) => {
    const lines = [];
    Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
      const label = prettifyKey(k);
      if (Array.isArray(v)) {
        lines.push(label);
        let n = 1;
        v.filter(it => hasVal(stringifyItem(it))).forEach(it => lines.push(`  ${n++}. ${stringifyItem(it)}`));
      } else if (v !== null && typeof v === 'object') {
        lines.push(label);
        objectCopyLines(v).forEach(l => lines.push(`  ${l}`));
      } else {
        lines.push(label);
        lines.push(fmtVal(v));
      }
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
    if (fields.length === 0) return '';
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.trim().toLowerCase() !== title.trim().toLowerCase();
      if (DATE_FIELDS.includes(f)) {
        const v = getFieldValue(record, f, idx, record[f]);
        if (showLabel) text += `${label}\n`;
        text += `${formatDate(v)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        let n = 1;
        (record[f] || []).forEach(item => {
          const display = getFieldValue(record, `${f}[${n - 1}]`, idx, stringifyItem(item));
          if (!hasVal(display)) return;
          text += `${n++}. ${display}\n`;
        });
        text += '\n';
      } else if (OBJECT_FIELDS.includes(f)) {
        objectCopyLines(record[f]).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        const v = getFieldValue(record, f, idx, record[f]);
        const strVal = fmtVal(v);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
          if (showLabel) text += `${label}\n`;
          formatSentenceLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          if (showLabel) text += `${label}\n`;
          text += `${strVal}\n\n`;
        }
      }
    });
    return text;
  }, [getFieldValue, splitBySentence, formatSentenceLines, objectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== MEDICAL HISTORY ===\n\n';
    filteredRecords.forEach((r, idx) => {
      text += `Medical History ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [filteredRecords, copyToClipboard, buildSectionCopyText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (!m || parseInt(m[2]) !== idx) return;
        const path = m[1];
        // walk dot/bracket path (a.b, a[0], a.b[2]) and assign at the leaf
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let obj = merged;
        let ok = true;
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] === undefined || obj[parts[i]] === null) { ok = false; break; }
          obj = obj[parts[i]];
        }
        if (ok && obj && typeof obj === 'object') obj[parts[parts.length - 1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
     Re-editing an already-approved section drops its approvedSections key so the button returns to yellow. */
  const stageDraft = useCallback((record, fieldPath, idx, value, sentenceMarks) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    if (sentenceMarks && Object.keys(sentenceMarks).length > 0) {
      setEditedSentences(prev => ({ ...prev, ...sentenceMarks }));
    }
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => (SECTION_FIELDS[s] || []).some(prefix => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`) || fieldPath.startsWith(`${prefix}[`)));
      if (!sid || !prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sid}-${idx}`];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPath] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fieldPath, idx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fieldPath, idx, saveVal);
  }, [editValue, stageDraft]);

  function saveSentence(record, fieldPath, idx, sentenceIdx, displayValue) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPath}-${idx}`;
    const currentVal = String(localEdits[editKey] !== undefined ? localEdits[editKey] : (displayValue || ''));
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    setSaveError(null);
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fieldPath, idx, fullText, { [`${editKey}-s${sentenceIdx}`]: 'edited' });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const marks = {};
    if (changed) marks[`${editKey}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) marks[`${editKey}-s${sentenceIdx + 1 + ei}`] = 'added';
    stageDraft(record, fieldPath, idx, fullText, marks);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const prefixes = SECTION_FIELDS[sid] || [];
    return prefixes.some(prefix =>
      Object.keys(editedFields).some(k => (k.startsWith(`${prefix}-`) || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}[`)) && k.endsWith(`-${idx}`)) ||
      Object.keys(editedSentences).some(k => (k.startsWith(`${prefix}-`) || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}[`)) && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-s`)))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const prefixes = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    const belongsToSection = (fieldPath) => prefixes.some(prefix => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`) || fieldPath.startsWith(`${prefix}[`));
    const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && belongsToSection(k.slice(0, -suffix.length)));
    setSaving(true);
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        const resp = await secureApiClient.put(`/api/edit/medical_history/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/medical_history/${id}/approve`, { sectionId: sid, approved: true });
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { prefixes.forEach(prefix => { if ((k.startsWith(`${prefix}-`) || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}[`)) && k.endsWith(`-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { prefixes.forEach(prefix => { if ((k.startsWith(`${prefix}-`) || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}[`)) && (k.endsWith(`-${idx}`) || k.includes(`-${idx}-s`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ RENDER: EDITABLE STRING CELL (single value) ═══════ */
  const renderEditableCell = (record, idx, fieldPath, label, displayValue) => {
    const editKey = `${fieldPath}-${idx}`;
    const currentVal = localEdits[editKey] !== undefined ? localEdits[editKey] : displayValue;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(currentVal || '')); setSaveError(null); } }}>
        {isEditing ? (
          <div className="edit-field-container">
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fieldPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="row-content"><span className="content-value">{highlightText(String(currentVal || ''))}</span><span className="edit-indicator">&#9998;</span></div>
            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(currentVal || ''), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
          </>
        )}
      </div>
    );
  };

  /* ═══════ RENDER: MULTI-SENTENCE STRING CELL ═══════ */
  const renderMultiSentenceCell = (record, idx, fieldPath, label, displayValue, sid) => {
    const editKey = `${fieldPath}-${idx}`;
    const currentVal = localEdits[editKey] !== undefined ? localEdits[editKey] : displayValue;
    const strVal = String(currentVal || '');
    const sentences = splitBySentence(strVal);

    if (sentences.length <= 1 && !(sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
      return renderEditableCell(record, idx, fieldPath, label, displayValue);
    }

    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || false;
    const isLabelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div>
        {sentences.map((sentence, sIdx) => {
          const sentenceKey = `${editKey}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const badge = editedSentences[sentenceKey];
          const sentenceMatches = phraseMatch || isLabelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
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
                    const ciMatches = phraseMatch || isLabelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                    if (!ciMatches && searchTerm.trim()) return null;
                    return (
                      <div key={ciIdx}>
                        <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                          {ciEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(localEdits[editKey] !== undefined ? localEdits[editKey] : displayValue || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added'; stageDraft(record, fieldPath, idx, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(localEdits[editKey] !== undefined ? localEdits[editKey] : displayValue || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ei}`] = 'added'; stageDraft(record, fieldPath, idx, fullText, marks); } else { saveSentence(record, fieldPath, idx, sIdx, displayValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
    );
  };

  /* ═══════ RENDER: DATE FIELD (BlueDatePicker) ═══════ */
  const renderDateField = (record, idx, fieldPath, label, showLabel) => {
    const rawVal = getFieldValue(record, fieldPath, idx, record[fieldPath]);
    const editKey = `${fieldPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = formatDate(rawVal);
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(rawVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fieldPath, idx, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    );
  };

  /* ═══════ RENDER: NUMBER FIELD (−/+ stepper) ═══════ */
  const renderNumberField = (record, idx, fieldPath, label, showLabel) => {
    const rawVal = getFieldValue(record, fieldPath, idx, record[fieldPath]);
    const editKey = `${fieldPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const displayVal = fmtVal(rawVal);
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(rawVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fieldPath, idx, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fieldPath, idx, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    );
  };

  /* ═══════ RENDER: LIST FIELD (array of strings/objects) ═══════ */
  const renderListField = (record, idx, fieldPath, label, sid, showLabel) => {
    const items = record[fieldPath];
    if (!Array.isArray(items)) return null;
    const showAll = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid);
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, iIdx) => {
          const display = stringifyItem(item);
          if (!hasVal(display)) return null;
          if (!showAll && !textMatches(display) && !labelMatches(fieldPath)) return null;
          const itemPath = `${fieldPath}[${iIdx}]`;
          const itemKey = `${itemPath}-${idx}`;
          if (item !== null && typeof item === 'object') {
            /* object item: display-only stringified row (editing would corrupt its structure) */
            return (
              <div key={iIdx} className="numbered-row">
                <div className="row-content"><span className="content-value">{highlightText(display)}</span></div>
                <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            );
          }
          return (
            <div key={iIdx}>
              {renderEditableCell(record, idx, itemPath, `${label} ${iIdx + 1}`, display)}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT ENTRIES (recursive; label-above-value, never side-by-side) ═══════ */
  const renderObjectEntries = (record, idx, basePath, obj, sid) => {
    const showAll = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid);
    return Object.entries(obj).filter(([, v]) => hasVal(v)).map(([k, v]) => {
      const path = `${basePath}.${k}`;
      const label = prettifyKey(k);
      if (Array.isArray(v)) {
        if (!showAll && !labelMatches(k) && !v.some(it => textMatches(stringifyItem(it)))) return null;
        return (
          <div key={k} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {v.map((it, i) => {
              const display = stringifyItem(it);
              if (!hasVal(display)) return null;
              const itPath = `${path}[${i}]`;
              const itKey = `${itPath}-${idx}`;
              if (it !== null && typeof it === 'object') {
                return (
                  <div key={i} className="numbered-row">
                    <div className="row-content"><span className="content-value">{highlightText(display)}</span></div>
                    <button className={`copy-btn ${copiedItems[itKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, itKey); }}>{copiedItems[itKey] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              }
              return <div key={i}>{renderEditableCell(record, idx, itPath, `${label} ${i + 1}`, display)}</div>;
            })}
          </div>
        );
      }
      if (v !== null && typeof v === 'object') {
        if (!showAll && !labelMatches(k) && !Object.values(v).some(sv => textMatches(stringifyItem(sv)))) return null;
        return (
          <div key={k} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {renderObjectEntries(record, idx, path, v, sid)}
          </div>
        );
      }
      if (!showAll && !labelMatches(k) && !textMatches(fmtVal(v))) return null;
      return (
        <div key={k} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {renderMultiSentenceCell(record, idx, path, label, fmtVal(v), sid)}
        </div>
      );
    });
  };

  /* ═══════ RENDER: ONE FIELD (dispatch by type) ═══════ */
  const renderField = (record, idx, f, sid, title) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== title.trim().toLowerCase();
    if (DATE_FIELDS.includes(f)) return <React.Fragment key={f}>{renderDateField(record, idx, f, label, showLabel)}</React.Fragment>;
    if (NUMBER_FIELDS.includes(f)) return <React.Fragment key={f}>{renderNumberField(record, idx, f, label, showLabel)}</React.Fragment>;
    if (ARRAY_FIELDS.includes(f)) return <React.Fragment key={f}>{renderListField(record, idx, f, label, sid, showLabel)}</React.Fragment>;
    if (OBJECT_FIELDS.includes(f)) {
      const obj = record[f];
      if (showLabel) {
        return (
          <div key={f} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {renderObjectEntries(record, idx, f, obj, sid)}
          </div>
        );
      }
      return <React.Fragment key={f}>{renderObjectEntries(record, idx, f, obj, sid)}</React.Fragment>;
    }
    return (
      <div key={f} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {renderMultiSentenceCell(record, idx, f, label, fmtVal(getFieldValue(record, f, idx, record[f])), sid)}
      </div>
    );
  };

  /* ═══════ RENDER: SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const fields = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
    if (fields.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];
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
          {fields.map(f => renderField(record, idx, f, sid, title))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="medical-history-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Medical History</h2></div>
        <div className="empty-state">No medical history records available</div>
      </div>
    );
  }

  return (
    <div className="medical-history-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Medical History</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<MedicalHistoryDocumentPDFTemplate document={pdfData} />} fileName="Medical_History.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search medical history..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Medical History ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicalHistoryDocument;
