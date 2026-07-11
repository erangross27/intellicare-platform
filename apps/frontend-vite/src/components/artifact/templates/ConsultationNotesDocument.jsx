/**
 * ConsultationNotesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: consultation_notes
 *
 * 6 Sections:
 *   1. consultation-info: date, consultingSpecialty, consultingProvider, reasonForConsultation, chiefComplaint
 *   2. history: historyOfPresentIllness
 *   3. review-of-systems: dot-path reviewOfSystems.* (8 sub-fields)
 *   4. physical-exam: physicalExamination (heavy parseLabel + comma-split)
 *   5. assessment-plan: assessment, plan
 *   6. recommendations: recommendations (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ConsultationNotesDocumentPDFTemplate from '../pdf-templates/ConsultationNotesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ConsultationNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the field name / dot-path, e.g.
   "assessment", "reviewOfSystems.cardiovascular", or "recommendations" holding the full array) */
const DRAFT_KEY = 'consultation_notesPendingEdits';
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
  'consultation-info': 'Consultation Information',
  history: 'History of Present Illness',
  'review-of-systems': 'Review of Systems',
  'physical-exam': 'Physical Examination',
  'assessment-plan': 'Assessment & Plan',
  recommendations: 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  consultingSpecialty: 'Consulting Specialty',
  consultingProvider: 'Consulting Provider',
  reasonForConsultation: 'Reason for Consultation',
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  physicalExamination: 'Physical Examination',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  'reviewOfSystems.constitutional': 'Constitutional',
  'reviewOfSystems.heent': 'HEENT',
  'reviewOfSystems.cardiovascular': 'Cardiovascular',
  'reviewOfSystems.respiratory': 'Respiratory',
  'reviewOfSystems.gastrointestinal': 'Gastrointestinal',
  'reviewOfSystems.musculoskeletal': 'Musculoskeletal',
  'reviewOfSystems.neurological': 'Neurological',
  'reviewOfSystems.psychiatric': 'Psychiatric',
};

const SECTION_FIELDS = {
  'consultation-info': ['consultingSpecialty', 'consultingProvider', 'reasonForConsultation', 'chiefComplaint'],
  history: ['historyOfPresentIllness'],
  'review-of-systems': [
    'reviewOfSystems.constitutional', 'reviewOfSystems.heent', 'reviewOfSystems.cardiovascular',
    'reviewOfSystems.respiratory', 'reviewOfSystems.gastrointestinal', 'reviewOfSystems.musculoskeletal',
    'reviewOfSystems.neurological', 'reviewOfSystems.psychiatric',
  ],
  'physical-exam': ['physicalExamination'],
  'assessment-plan': ['assessment', 'plan'],
  recommendations: ['recommendations'],
};

const SENTENCE_FIELDS = ['reasonForConsultation', 'chiefComplaint', 'historyOfPresentIllness', 'physicalExamination', 'assessment', 'plan'];
const ARRAY_FIELDS = ['recommendations'];

/* reviewOfSystems is a DYNAMIC-KEY object — real data has 22+ distinct sub-keys
 * (skin, eyes, endocrine, genitourinary, etc.) beyond the 8 common ones. Keys are
 * derived per-record at render time; this map only supplies nicer labels for known keys. */
const ROS_LABELS = {
  constitutional: 'Constitutional', heent: 'HEENT', cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory', gastrointestinal: 'Gastrointestinal', musculoskeletal: 'Musculoskeletal',
  neurological: 'Neurological', psychiatric: 'Psychiatric', neurologic: 'Neurologic', endocrine: 'Endocrine',
  skin: 'Skin', joint: 'Joint', eyes: 'Eyes', lymphatic: 'Lymphatic', sleep: 'Sleep', cognitive: 'Cognitive',
  genitourinary: 'Genitourinary', hematologic: 'Hematologic', cardiac: 'Cardiac', gi: 'GI', ent: 'ENT', other: 'Other',
};

/* humanizeKey: camelCase / snake_case -> Title Case fallback for unknown ROS keys */
const humanizeKey = (k) => {
  if (ROS_LABELS[k]) return ROS_LABELS[k];
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || k;
};

/* rosDotKeys: ordered list of reviewOfSystems.* dot-paths actually present on a record */
const rosDotKeys = (record) => {
  const ros = record?.reviewOfSystems;
  if (!ros || typeof ros !== 'object' || Array.isArray(ros)) return [];
  return Object.keys(ros).map(k => `reviewOfSystems.${k}`);
};

/* parseLabel: detect "Label: value" patterns in sentences — medical regex */
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
const ConsultationNotesDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.consultation_notes) return Array.isArray(r.consultation_notes) ? r.consultation_notes : [r.consultation_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.consultation_notes) return Array.isArray(dd.consultation_notes) ? dd.consultation_notes : [dd.consultation_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Drafts are keyed by record _id; we map them back to the current render index. */
  const safeIdOf = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeIdOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Representative edited marker so the section's Pending Approve button appears (sentence
        // fields key off editedSentences, others off editedFields — set both styles to be safe).
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeIdOf]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getFieldValue: supports dot-path for reviewOfSystems.* */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
      return val;
    }
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
    const fields = sid === 'review-of-systems' ? rosDotKeys(record) : (SECTION_FIELDS[sid] || []);
    for (const f of fields) {
      if (sid === 'review-of-systems' && humanizeKey(f.split('.').pop()).toLowerCase().includes(phrase)) return true;
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          for (const v of Object.values(val)) { if (String(v || '').toLowerCase().includes(phrase)) return true; }
        } else if (Array.isArray(val)) {
          for (const item of val) { if (String(item || '').toLowerCase().includes(phrase)) return true; }
        } else { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
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
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Consultation Notes ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      /* Search all field content */
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      /* Search reviewOfSystems sub-fields */
      if (record.reviewOfSystems && typeof record.reviewOfSystems === 'object') {
        for (const v of Object.values(record.reviewOfSystems)) { if (String(v || '').toLowerCase().includes(phrase)) return true; }
      }
      /* Search recommendations array */
      const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
      for (const item of recs) { if (String(item || '').toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      /* Apply flat localEdits */
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldName = m[1];
          if (fieldName.startsWith('reviewOfSystems.')) {
            const sub = fieldName.split('.')[1];
            if (!merged.reviewOfSystems) merged.reviewOfSystems = {};
            merged.reviewOfSystems = { ...merged.reviewOfSystems, [sub]: localEdits[key] };
          } else {
            merged[fieldName] = localEdits[key];
          }
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
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save = stage a DRAFT locally (full array) + persist to localStorage. Committed to DB on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const arr = [...getEffectiveArray(record, fn, idx)];
    arr[arrayIndex] = editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${arrayIndex}`]: 'edited' }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = arr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  // Save one sentence = stage a DRAFT locally (full reconstructed text) + persist to localStorage.
  // No DB write — committed on Approve.
  function stageDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setSaveError(null);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(id, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(id, fn, idx, fullText);
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
    stageDraft(id, fn, idx, fullText);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    // review-of-systems has dynamic keys — match any edit key under reviewOfSystems.*
    if (sid === 'review-of-systems') {
      return Object.keys(editedFields).some(k => k.startsWith('reviewOfSystems.') && k.includes(`-${idx}`)) ||
        Object.keys(editedSentences).some(k => k.startsWith('reviewOfSystems.') && k.includes(`-${idx}`));
    }
    const fields = SECTION_FIELDS[sid] || [];
    // Also check 'date' field for consultation-info section
    const allFields = sid === 'consultation-info' ? ['date', ...fields] : fields;
    return allFields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      // Which field names belong to this section (review-of-systems uses dynamic dot-keys).
      const sectionFields = sid === 'review-of-systems'
        ? rosDotKeys(record).map(dp => dp) // reviewOfSystems.* present on the record
        : (sid === 'consultation-info' ? ['date', ...(SECTION_FIELDS[sid] || [])] : (SECTION_FIELDS[sid] || []));
      const isSectionField = (fieldPart) => sid === 'review-of-systems'
        ? fieldPart.startsWith('reviewOfSystems.')
        : sectionFields.includes(fieldPart);

      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        return isSectionField(k.slice(0, -suffix.length));
      });
      // Persist each staged field to the DB now. arrayIndex ONLY when the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // field name / dot-path
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        }
        await secureApiClient.put(`/api/edit/consultation_notes/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/consultation_notes/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      // review-of-systems has dynamic keys — clear any edit key under reviewOfSystems.*
      const matches = (k) => sid === 'review-of-systems'
        ? (k.startsWith('reviewOfSystems.') && k.includes(`-${idx}`))
        : (sid === 'consultation-info' ? ['date', ...(SECTION_FIELDS[sid] || [])] : (SECTION_FIELDS[sid] || [])).some(f => k.startsWith(`${f}-${idx}`));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (matches(k)) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (matches(k)) delete n[k]; }); return n; });
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
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(`${n++}. ${s}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;

    if (sid === 'consultation-info') {
      if (record.date) text += `Date\n${formatDate(record.date)}\n\n`;
      ['consultingSpecialty', 'consultingProvider'].forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (hasVal(val)) text += `${FIELD_LABELS[f]}\n${fmtVal(val)}\n\n`;
      });
      ['reasonForConsultation', 'chiefComplaint'].forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (hasVal(val)) { text += `${FIELD_LABELS[f]}\n`; formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; }); text += '\n'; }
      });
    } else if (sid === 'review-of-systems') {
      rosDotKeys(record).forEach(dp => {
        const val = getFieldValue(record, dp, idx);
        if (hasVal(val)) { text += `${FIELD_LABELS[dp] || humanizeKey(dp.split('.').pop())}\n`; splitByComma(fmtVal(val)).forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); text += '\n'; }
      });
    } else if (sid === 'recommendations') {
      const arr = getEffectiveArray(record, 'recommendations', idx);
      arr.forEach((item, i) => { text += `${i + 1}. ${String(item || '')}\n`; });
    } else {
      (SECTION_FIELDS[sid] || []).forEach(f => {
        const label = FIELD_LABELS[f] || f;
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        if (SENTENCE_FIELDS.includes(f)) {
          text += `${label}\n`;
          formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else { text += `${label}\n${fmtVal(val)}\n\n`; }
      });
    }
    return text;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, formatDate, formatSentenceFieldLines, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== CONSULTATION NOTES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Consultation Notes ${idx + 1}\n${'='.repeat(40)}\n\n`;
      if (r.date) text += `Date\n${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, formatDate, buildSectionCopyText]);

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const isDateField = fn === 'date';
    const isBool = typeof val === 'boolean' || typeof record[fn] === 'boolean';
    const displayVal = isDateField ? formatDate(val) : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    // For date fields: convert to YYYY-MM-DD for input[type=date]
    const toDateInputVal = (v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isDateField ? toDateInputVal(val) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isDateField ? (
                <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              ) : isBool ? (
                <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isDateField) { const testDate = new Date(editValue); if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, undefined, undefined, editValue + 'T00:00:00.000Z'); } else { handleSaveField(record, fn, idx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
              if (commaItems.length >= 2) {
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

  /* ═══════ RENDER: DOT-PATH EDITABLE FIELD (reviewOfSystems.*) ═══════ */
  const renderDotPathField = (record, dotPath, idx, sid) => {
    const val = getFieldValue(record, dotPath, idx);
    if (!hasVal(val)) return null;
    const editKey = `${dotPath}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[dotPath] || humanizeKey(dotPath.split('.').pop());
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !sectionTitleMatches(sid) && !contentMatches(displayVal) && !contentMatches(label)) return null;

    /* Comma-split per dot-path value */
    const commaItems = splitByComma(displayVal);
    if (commaItems.length >= 2) {
      return (
        <div key={dotPath} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {commaItems.map((ci, ciIdx) => {
            const commaKey = `${dotPath}-${idx}-c${ciIdx}`;
            const ciEditing = editingField === commaKey;
            const ciBadge = editedFields[commaKey];
            const ciMatches = !searchTerm.trim() || sectionTitleMatches(sid) || ci.toLowerCase().includes(searchTerm.toLowerCase().trim()) || contentMatches(label);
            if (!ciMatches) return null;
            return (
              <div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                  {ciEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => {
                          e.stopPropagation(); const id = safeId(record); if (!id) return;
                          // Stage a DRAFT only (full joined dot-path value) — committed to DB on Approve.
                          const currentVal = String(getFieldValue(record, dotPath, idx) || '');
                          const items = splitByComma(currentVal); items[ciIdx] = editValue.trim();
                          const newVal = items.join(', ');
                          stageDraft(id, dotPath, idx, newVal);
                          setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' }));
                          setEditingField(null); setEditValue('');
                        }}>{saving ? 'Saving...' : 'Save'}</button>
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

    /* Single value dot-path field */
    return (
      <div key={dotPath} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, dotPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY EDITABLE (recommendations) ═══════ */
  const renderArraySection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const arr = getEffectiveArray(record, 'recommendations', idx);
    if (arr.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                const text = `${title}\n${'='.repeat(40)}\n\n${arr.map((item, i) => `${i + 1}. ${String(item || '')}`).join('\n')}`;
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          <div className="rec-mini-card">
            {arr.map((item, aIdx) => {
              const itemStr = String(item || '');
              const editKey = `recommendations-${idx}-a${aIdx}`;
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'recommendations', idx, aIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
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
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (sid === 'recommendations') return renderArraySection(record, idx, sid);
    if (sid === 'review-of-systems') return renderROSSection(record, idx);
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
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
          {/* Date inside consultation-info — editable with date picker */}
          {sid === 'consultation-info' && record.date && (() => {
            const dateKey = `date-${idx}`; const isDateEditing = editingField === dateKey; const dateModified = editedFields[dateKey];
            const dateVal = localEdits[dateKey] !== undefined ? localEdits[dateKey] : record.date;
            const toDateInputVal = (v) => { try { const d = new Date(v?.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };
            return (
              <div className="rec-mini-card">
                <div className="nested-subtitle">{highlightText('Date')}</div>
                <div className={`numbered-row ${dateModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isDateEditing) { setEditingField(dateKey); setEditValue(toDateInputVal(dateVal)); setSaveError(null); } }}>
                  {isDateEditing ? (
                    <div className="edit-field-container">
                      <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const testDate = new Date(editValue); if (isNaN(testDate.getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, 'date', idx, 'consultation-info', undefined, editValue + 'T00:00:00.000Z', dateKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: REVIEW OF SYSTEMS (dot-path) ═══════ */
  const renderROSSection = (record, idx) => {
    const sid = 'review-of-systems';
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const dotKeys = rosDotKeys(record);
    const hasAny = dotKeys.some(dp => hasVal(getFieldValue(record, dp, idx)));
    if (!hasAny) return null;
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
          {dotKeys.map(dp => renderDotPathField(record, dp, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="consultation-notes-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Consultation Notes</h2></div>
        <div className="empty-state">No consultation notes records available</div>
      </div>
    );
  }

  return (
    <div className="consultation-notes-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Consultation Notes</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ConsultationNotesDocumentPDFTemplate document={pdfData} />} fileName={`consultation-notes-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search consultation notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Consultation Notes ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'consultation-info')}
            {renderSection(record, idx, 'history')}
            {renderSection(record, idx, 'review-of-systems')}
            {renderSection(record, idx, 'physical-exam')}
            {renderSection(record, idx, 'assessment-plan')}
            {renderSection(record, idx, 'recommendations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsultationNotesDocument;
