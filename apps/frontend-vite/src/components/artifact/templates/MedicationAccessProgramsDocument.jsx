/**
 * MedicationAccessProgramsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: medication_access_programs
 *
 * SCHEMA:
 *   programsEnrolled: ARRAY of OBJECTS [{ programName, medications[], applicationStatus, coverageAmount, annualSavings }]
 *   applicationsPending: ARRAY of OBJECTS [{ medication, program, applicationDate, statusCheck }]
 *   alternativeAccessStrategies: ARRAY strings
 *   programsEligible: ARRAY strings/any
 *   totalMonthlySavings: STRING
 *   barriers: ARRAY strings
 *   socialWorkReferral: BOOL (true)
 *   notes: STRING (long)
 *
 * Sections:
 *   1. summary-info: totalMonthlySavings, socialWorkReferral
 *   2. programs-enrolled: programsEnrolled[] — mini-cards with sub-fields
 *   3. applications-pending: applicationsPending[] — mini-cards with sub-fields
 *   4. access-strategies: alternativeAccessStrategies[]
 *   5. programs-eligible: programsEligible[]
 *   6. barriers: barriers[]
 *   7. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import MedicationAccessProgramsDocumentPDFTemplate from '../pdf-templates/MedicationAccessProgramsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './MedicationAccessProgramsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'summary-info': 'Summary',
  'programs-enrolled': 'Programs Enrolled',
  'applications-pending': 'Applications Pending',
  'access-strategies': 'Alternative Access Strategies',
  'programs-eligible': 'Programs Eligible',
  'barriers': 'Barriers',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  totalMonthlySavings: 'Total Monthly Savings',
  socialWorkReferral: 'Social Work Referral',
  programsEnrolled: 'Programs Enrolled',
  applicationsPending: 'Applications Pending',
  alternativeAccessStrategies: 'Alternative Access Strategies',
  programsEligible: 'Programs Eligible',
  barriers: 'Barriers',
  notes: 'Notes',
  /* sub-field labels */
  programName: 'Program Name',
  medications: 'Medications',
  applicationStatus: 'Application Status',
  coverageAmount: 'Coverage Amount',
  annualSavings: 'Annual Savings',
  medication: 'Medication',
  program: 'Program',
  applicationDate: 'Application Date',
  statusCheck: 'Status Check',
};

const SECTION_FIELDS = {
  'summary-info': ['totalMonthlySavings', 'socialWorkReferral'],
  'programs-enrolled': ['programsEnrolled'],
  'applications-pending': ['applicationsPending'],
  'access-strategies': ['alternativeAccessStrategies'],
  'programs-eligible': ['programsEligible'],
  'barriers': ['barriers'],
  'notes': ['notes'],
};

const BOOLEAN_FIELDS = ['socialWorkReferral'];
const STRING_FIELDS = ['totalMonthlySavings', 'notes'];
const SENTENCE_FIELDS = ['notes'];
const ARRAY_STRING_FIELDS = ['alternativeAccessStrategies', 'programsEligible', 'barriers'];
const OBJECT_ARRAY_FIELDS = ['programsEnrolled', 'applicationsPending'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: { value, lk, lv, marks } } }
     fieldPart  — the DB field path to PUT on Approve:
                  "notes" (simple/sentence), "barriers" (array-string, value = single item per existing quirk),
                  or "programsEnrolled.0.coverageAmount" (object-array sub-field dot-path).
     value      — value to PUT to /edit (mirrors what the old save sent).
     lk / lv    — localEdits key + value to repaint optimistic UI (object-array lv = rebuilt parent array).
     marks      — { editedFields: {k:badge}, editedSentences: {k:badge} } to repaint badges after refresh. */
const DRAFT_KEY = 'medication_access_programsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
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

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const MedicationAccessProgramsDocument = ({ document: docProp }) => {
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
      if (r?.medication_access_programs) return Array.isArray(r.medication_access_programs) ? r.medication_access_programs : [r.medication_access_programs];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.medication_access_programs) return Array.isArray(dd.medication_access_programs) ? dd.medication_access_programs : [dd.medication_access_programs]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const recordIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recordIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((d) => {
        if (!d || typeof d !== 'object') return;
        const lk = String(d.lk || '').replace(/-\d+$/, `-${idx}`);
        if (lk) { nLocal[lk] = d.lv; nPending[lk] = true; }
        const marks = d.marks || {};
        Object.entries(marks.editedFields || {}).forEach(([k, v]) => { nFields[k.replace(/-\d+$/, `-${idx}`)] = v; });
        Object.entries(marks.editedSentences || {}).forEach(([k, v]) => { nSentences[k.replace(/(-\d+)(?=(-s\d+)?(-c\d+)?$)/, `-${idx}`)] = v; });
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nFields).length === 0 && Object.keys(nSentences).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, recordIdOf]);

  /* Stage a draft locally (no DB write). localStorage keeps it across refresh; Approve commits it. */
  const stageDraft = useCallback((record, fieldPart, putValue, localKey, localValue, marks) => {
    const id = recordIdOf(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [localKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = { value: putValue, lk: localKey, lv: localValue, marks: marks || {} };
    writeDrafts(store);
  }, [recordIdOf]);

  /* ═══════ UTILS ═══════ */
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

  const safeId = recordIdOf;

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
        const strVal = fmtVal(val).toLowerCase();
        if (strVal.includes(phrase)) return true;
        /* deep search in array-of-objects */
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            if (typeof item === 'object' && item) {
              for (const sv of Object.values(item)) {
                if (sv && String(sv).toLowerCase().includes(phrase)) return true;
                if (Array.isArray(sv)) { for (const si of sv) { if (si && String(si).toLowerCase().includes(phrase)) return true; } }
              }
            }
          }
        }
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
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Medication Access Programs ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
          if (Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
              if (typeof item === 'object' && item) {
                for (const sv of Object.values(item)) {
                  if (sv && String(sv).toLowerCase().includes(phrase)) return true;
                  if (Array.isArray(sv)) { for (const si of sv) { if (si && String(si).toLowerCase().includes(phrase)) return true; } }
                }
              }
            }
          }
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Save = stage a DRAFT locally + localStorage (survives refresh). NOT written to MongoDB and NOT
     shown in the PDF until the user clicks Pending Approve (handleApproveSection commits). */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const localKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, fn, saveVal, localKey, saveVal, { editedFields: { [trackKey]: 'edited' } });
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId, stageDraft]);

  /* Save a sub-field of an object-array item. Stages the dot-path draft (object shape preserved on
     Approve) AND rebuilds the parent array locally so the optimistic UI + pdfData/Copy reflect the
     edit (parent localEdits key `${fn}-${idx}`). */
  const handleSaveObjectArrayField = useCallback((record, parentField, itemIdx, subField, idx, sid, saveVal, trackKey) => {
    const id = safeId(record); if (!id) return;
    const dotPath = `${parentField}.${itemIdx}.${subField}`;
    const currentArr = getFieldValue(record, parentField, idx);
    const newArr = Array.isArray(currentArr) ? currentArr.map((it, i) => i === itemIdx ? { ...it, [subField]: saveVal } : it) : currentArr;
    const localKey = `${parentField}-${idx}`;
    stageDraft(record, dotPath, saveVal, localKey, newArr, { editedFields: { [trackKey]: 'edited' } });
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [safeId, getFieldValue, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      const localKey = `${fn}-${idx}`;
      stageDraft(record, fn, fullText, localKey, fullText, { editedSentences: { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' } });
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const sMarks = {};
    if (changed) sMarks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) sMarks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    const localKey = `${fn}-${idx}`;
    stageDraft(record, fn, fullText, localKey, fullText, { editedSentences: sMarks });
    setEditedSentences(prev => ({ ...prev, ...sMarks }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
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

  /* Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
     committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database. */
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // Determine which staged drafts belong to this section (by their fieldPart's base field).
      const committedFieldParts = [];
      const committedLocalKeys = new Set();
      for (const [fieldPart, d] of Object.entries(recDrafts)) {
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        if (!fields.includes(baseField)) continue;
        // GOTCHA: arrayIndex ONLY when the segment after the LAST dot is purely numeric.
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: d.value };
        if (lastDot !== -1) {
          const tail = fieldPart.slice(lastDot + 1);
          if (/^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        }
        const resp = await secureApiClient.put(`/api/edit/medication_access_programs/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
        if (d.lk) committedLocalKeys.add(d.lk);
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/medication_access_programs/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) { committedFieldParts.forEach(fp => delete store2[id][fp]); if (Object.keys(store2[id]).length === 0) delete store2[id]; writeDrafts(store2); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[MedicationAccessPrograms] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => hasVal(getFieldValue(record, f, idx)))) return '';
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;

      if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${val ? 'Yes' : 'No'}\n\n`;
      } else if (f === 'programsEnrolled' && Array.isArray(val)) {
        val.forEach((prog, pIdx) => {
          text += `  ${pIdx + 1}. ${prog.programName || 'Unknown Program'}\n`;
          if (prog.applicationStatus) text += `     Application Status: ${prog.applicationStatus}\n`;
          if (prog.medications && prog.medications.length > 0) text += `     Medications: ${prog.medications.join(', ')}\n`;
          if (prog.coverageAmount) text += `     Coverage Amount: ${prog.coverageAmount}\n`;
          if (prog.annualSavings) text += `     Annual Savings: ${prog.annualSavings}\n`;
        });
        text += '\n';
      } else if (f === 'applicationsPending' && Array.isArray(val)) {
        val.forEach((app, aIdx) => {
          text += `  ${aIdx + 1}. ${app.medication || 'Unknown Medication'}\n`;
          if (app.program) text += `     Program: ${app.program}\n`;
          if (app.applicationDate) text += `     Application Date: ${formatDate(app.applicationDate)}\n`;
          if (app.statusCheck) text += `     Status Check: ${app.statusCheck}\n`;
        });
        text += '\n';
      } else if (ARRAY_STRING_FIELDS.includes(f) && Array.isArray(val)) {
        val.forEach((item, aIdx) => {
          text += `${aIdx + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}\n`;
        });
        text += '\n';
      } else if (SENTENCE_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
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
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== MEDICATION ACCESS PROGRAMS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Medication Access Programs ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (val === null || val === undefined) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue === 'Yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className={`content-value ${val ? 'bool-yes' : 'bool-no'}`}>{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (simple) ═══════ */
  const renderSimpleStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="text" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveField(record, fn, idx, sid); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE STRING FIELD (notes) ═══════ */
  const renderSentenceField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageDraft(record, fn, fullText2, `${fn}-${idx}`, fullText2, { editedSentences: marks }); setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageDraft(record, fn, fullText, `${fn}-${idx}`, fullText, { editedSentences: marks }); setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* single-value string */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: ARRAY STRING FIELD ═══════ */
  const renderArrayStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || !Array.isArray(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !sectionTitleMatches(sid)) {
      const phrase = searchTerm.toLowerCase().trim();
      const anyMatch = label.toLowerCase().includes(phrase) || val.some(item => String(item).toLowerCase().includes(phrase));
      if (!anyMatch) return null;
    }

    return (
      <div key={fn}>
        {val.map((item, aIdx) => {
          const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
          const editKey = `${fn}.${aIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!label.toLowerCase().includes(phrase) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          const parsed = parseLabel(itemStr);

          return (
            <div key={aIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginBottom: 8 } : undefined}>
              {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: programsEnrolled mini-cards ═══════ */
  const renderProgramsEnrolled = (record, idx, sid) => {
    const val = getFieldValue(record, 'programsEnrolled', idx);
    if (!hasVal(val) || !Array.isArray(val) || val.length === 0) return null;

    return val.map((prog, pIdx) => {
      const cardKey = `programsEnrolled.${pIdx}-${idx}`;

      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const progText = [prog.programName, prog.applicationStatus, prog.coverageAmount, prog.annualSavings, ...(prog.medications || [])].filter(Boolean).join(' ').toLowerCase();
        if (!progText.includes(phrase) && !'programs enrolled'.includes(phrase)) return null;
      }

      const subFields = [
        { key: 'applicationStatus', label: 'Application Status', val: prog.applicationStatus },
        { key: 'medications', label: 'Medications', val: prog.medications },
        { key: 'coverageAmount', label: 'Coverage Amount', val: prog.coverageAmount },
        { key: 'annualSavings', label: 'Annual Savings', val: prog.annualSavings },
      ];

      const copyText = [
        prog.programName || 'Unknown Program',
        ...subFields.filter(sf => hasVal(sf.val)).map(sf => {
          if (sf.key === 'medications' && Array.isArray(sf.val)) return `${sf.label}: ${sf.val.join(', ')}`;
          return `${sf.label}: ${sf.val}`;
        })
      ].join('\n');

      return (
        <div key={pIdx} className="rec-mini-card obj-card">
          <div className="obj-card-header">
            <div className="nested-subtitle">{highlightText(prog.programName || `Program ${pIdx + 1}`)}</div>
            <button className={`copy-btn ${copiedItems[cardKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(copyText, cardKey); }}>{copiedItems[cardKey] ? 'Copied!' : 'Copy'}</button>
          </div>
          {subFields.map(sf => {
            if (!hasVal(sf.val)) return null;
            const sfEditKey = `programsEnrolled.${pIdx}.${sf.key}-${idx}`;
            const sfEditing = editingField === sfEditKey;
            const sfModified = editedFields[sfEditKey];
            const displayVal = sf.key === 'medications' && Array.isArray(sf.val) ? sf.val.join(', ') : fmtVal(sf.val);

            return (
              <div key={sf.key} className="sub-field-row">
                <div className="sub-field-label">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${sfModified ? 'modified' : ''} editable-row`} onClick={() => { if (!sfEditing) { setEditingField(sfEditKey); setEditValue(displayVal); setSaveError(null); } }}>
                  {sfEditing ? (
                    <div className="edit-field-container">
                      <input type="text" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveObjectArrayField(record, 'programsEnrolled', pIdx, sf.key, idx, sid, sf.key === 'medications' ? editValue.split(',').map(s => s.trim()).filter(Boolean) : editValue, sfEditKey); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveObjectArrayField(record, 'programsEnrolled', pIdx, sf.key, idx, sid, sf.key === 'medications' ? editValue.split(',').map(s => s.trim()).filter(Boolean) : editValue, sfEditKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content">
                        <span className={`content-value ${sf.key === 'annualSavings' || sf.key === 'coverageAmount' ? 'savings-highlight' : ''}`}>{highlightText(displayVal)}</span>
                        <span className="edit-indicator">&#9998;</span>
                      </div>
                    </>
                  )}
                </div>
                {sfModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ═══════ RENDER: applicationsPending mini-cards ═══════ */
  const renderApplicationsPending = (record, idx, sid) => {
    const val = getFieldValue(record, 'applicationsPending', idx);
    if (!hasVal(val) || !Array.isArray(val) || val.length === 0) return null;

    return val.map((app, aIdx) => {
      const cardKey = `applicationsPending.${aIdx}-${idx}`;

      if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
        const phrase = searchTerm.toLowerCase().trim();
        const appText = [app.medication, app.program, app.statusCheck, app.applicationDate].filter(Boolean).join(' ').toLowerCase();
        if (!appText.includes(phrase) && !'applications pending'.includes(phrase)) return null;
      }

      const subFields = [
        { key: 'program', label: 'Program', val: app.program },
        { key: 'applicationDate', label: 'Application Date', val: app.applicationDate, isDate: true },
        { key: 'statusCheck', label: 'Status Check', val: app.statusCheck },
      ];

      const copyText = [
        app.medication || 'Unknown Medication',
        ...subFields.filter(sf => hasVal(sf.val)).map(sf => {
          if (sf.isDate) return `${sf.label}: ${formatDate(sf.val)}`;
          return `${sf.label}: ${sf.val}`;
        })
      ].join('\n');

      return (
        <div key={aIdx} className="rec-mini-card obj-card">
          <div className="obj-card-header">
            <div className="nested-subtitle">{highlightText(app.medication || `Application ${aIdx + 1}`)}</div>
            <button className={`copy-btn ${copiedItems[cardKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(copyText, cardKey); }}>{copiedItems[cardKey] ? 'Copied!' : 'Copy'}</button>
          </div>
          {subFields.map(sf => {
            if (!hasVal(sf.val)) return null;
            const sfEditKey = `applicationsPending.${aIdx}.${sf.key}-${idx}`;
            const sfEditing = editingField === sfEditKey;
            const sfModified = editedFields[sfEditKey];
            const displayVal = sf.isDate ? formatDate(sf.val) : fmtVal(sf.val);

            return (
              <div key={sf.key} className="sub-field-row">
                <div className="sub-field-label">{highlightText(sf.label)}</div>
                <div className={`numbered-row ${sfModified ? 'modified' : ''} editable-row`} onClick={() => { if (!sfEditing) { setEditingField(sfEditKey); setEditValue(sf.isDate ? toInputDate(sf.val) : displayVal); setSaveError(null); } }}>
                  {sfEditing ? (
                    <div className="edit-field-container">
                      {sf.isDate ? (
                        <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
                      ) : (
                        <input type="text" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); handleSaveObjectArrayField(record, 'applicationsPending', aIdx, sf.key, idx, sid, editValue, sfEditKey); } }} />
                      )}
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (sf.isDate && isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } const saveVal = sf.isDate ? editValue + 'T00:00:00.000Z' : editValue; handleSaveObjectArrayField(record, 'applicationsPending', aIdx, sf.key, idx, sid, saveVal, sfEditKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
                    </>
                  )}
                </div>
                {sfModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
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
          {sid === 'programs-enrolled' && renderProgramsEnrolled(record, idx, sid)}
          {sid === 'applications-pending' && renderApplicationsPending(record, idx, sid)}
          {sid !== 'programs-enrolled' && sid !== 'applications-pending' && fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid);
            if (ARRAY_STRING_FIELDS.includes(f)) return renderArrayStringField(record, f, idx, sid);
            if (STRING_FIELDS.includes(f)) return renderSimpleStringField(record, f, idx, sid);
            return renderSimpleStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="medication-access-programs-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Medication Access Programs</h2></div>
        <div className="empty-state">No medication access programs records available</div>
      </div>
    );
  }

  return (
    <div className="medication-access-programs-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Medication Access Programs</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<MedicationAccessProgramsDocumentPDFTemplate document={pdfData} />} fileName="Medication_Access_Programs.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search medication access programs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Medication Access Programs ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'summary-info')}
            {renderSection(record, idx, 'programs-enrolled')}
            {renderSection(record, idx, 'applications-pending')}
            {renderSection(record, idx, 'access-strategies')}
            {renderSection(record, idx, 'programs-eligible')}
            {renderSection(record, idx, 'barriers')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicationAccessProgramsDocument;
