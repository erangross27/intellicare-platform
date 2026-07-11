/**
 * PatientInstructionsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: patient_instructions
 *
 * Record date (record.date) renders in the record header via BlueDatePicker.
 * Sections:
 *   1. instruction:     instruction
 *   2. directive:       priority, timeframe
 *   3. provider-info:   provider, type, facility, status
 *   4. clinical:        findings, assessment
 *   5. plan-notes:      plan, notes
 *   6. recommendations: recommendations (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PatientInstructionsDocumentPDFTemplate from '../pdf-templates/PatientInstructionsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './PatientInstructionsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'patient_instructionsPendingEdits';
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
  'instruction':     'Instruction',
  'directive':       'Priority and Timeframe',
  'provider-info':   'Provider Information',
  'clinical':        'Clinical Assessment',
  'plan-notes':      'Plan and Notes',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  date:            'Date',
  instruction:     'Instruction',
  priority:        'Priority',
  timeframe:       'Timeframe',
  provider:        'Provider',
  type:            'Type',
  facility:        'Facility',
  status:          'Status',
  findings:        'Findings',
  assessment:      'Assessment',
  plan:            'Plan',
  notes:           'Notes',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'instruction':     ['instruction'],
  'directive':       ['priority', 'timeframe'],
  'provider-info':   ['provider', 'type', 'facility', 'status'],
  'clinical':        ['findings', 'assessment'],
  'plan-notes':      ['plan', 'notes'],
  'recommendations': ['recommendations'],
};

const DATE_FIELDS    = ['date'];
const NUMBER_FIELDS  = [];
const ARRAY_FIELDS   = ['recommendations'];
const STRING_FIELDS  = ['instruction', 'priority', 'timeframe', 'provider', 'type', 'facility', 'status', 'findings', 'assessment', 'plan', 'notes'];
/* Narrative fields → always rendered as a numbered directive list in Copy Section / Copy All (even a single item). */
const NARRATIVE_FIELDS = ['instruction', 'findings', 'assessment', 'plan', 'notes'];

/* ═══════ HELPERS ═══════ */
/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands guard: comma must precede whitespace) */
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
const PatientInstructionsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm]           = useState('');
  const [copiedSection, setCopiedSection]     = useState(null);
  const [copiedItems, setCopiedItems]         = useState({});
  const [showCopied, setShowCopied]           = useState(false);
  const [localEdits, setLocalEdits]           = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits]       = useState({});
  const [editingField, setEditingField]       = useState(null);
  const [editValue, setEditValue]             = useState('');
  const [editedFields, setEditedFields]       = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.patient_instructions) return Array.isArray(r.patient_instructions) ? r.patient_instructions : [r.patient_instructions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.patient_instructions) return Array.isArray(dd.patient_instructions) ? dd.patient_instructions : [dd.patient_instructions]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  /* ═══════ REHYDRATE PENDING DRAFTS ═══════
     Restore staged-but-unapproved edits from localStorage so a Save survives refresh.
     Shown in the JSX (yellow Pending Approve), but NOT in DB/PDF until Approve commits. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const baseField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
        const editKey = `${baseField}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${baseField}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records, safeId]);

  /* ═══════ UTILS ═══════ */
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

  /* ═══════ HIGHLIGHT ═══════ */
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
        if (Array.isArray(val)) {
          if (val.some(item => {
            const s = typeof item === 'object'
              ? `${item.recommendation || ''} ${item.date || ''}`
              : String(item);
            return s.toLowerCase().includes(phrase);
          })) return true;
        } else if (typeof val === 'object') {
          if (Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase))) return true;
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
      if (Array.isArray(val)) return val.some(item => {
        const s = typeof item === 'object'
          ? `${item.recommendation || ''} ${item.date || ''}`
          : String(item);
        return s.toLowerCase().includes(phrase);
      });
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Patient Instruction ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt) || /^patient\s+instruction(\s+\d+)?$/i.test(phrase)) {
        record._showAllSections = true; return true;
      }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val) {
            if (Array.isArray(val)) {
              if (val.some(item => {
                const s = typeof item === 'object'
                  ? `${item.recommendation || ''} ${item.date || ''}`
                  : String(item);
                return s.toLowerCase().includes(phrase);
              })) return true;
            } else if (typeof val === 'object') {
              if (Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase))) return true;
            } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ DRAFT STAGING HELPER ═══════
     Stage a field edit locally + persist it to the pending-drafts localStorage store (survives
     refresh). NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve.
     localEdits is keyed `${fieldName}-${idx}` (full field value); the localStorage draft is keyed
     by record _id → fieldName so handleApproveSection can replay each PUT. */
  const stageDraft = useCallback((record, fn, idx, sid, fullValue, marks) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (marks && marks.fields) setEditedFields(prev => ({ ...prev, ...marks.fields }));
    if (marks && marks.sentences) setEditedSentences(prev => ({ ...prev, ...marks.sentences }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow.
    if (sid !== undefined && sid !== null) {
      setApprovedSections(prev => {
        const k = `${sid}-${idx}`;
        if (!prev[k]) return prev;
        const next = { ...prev }; delete next[k]; return next;
      });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally (no DB write). Approve (handleApproveSection) commits it.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setSaveError(null);
    stageDraft(record, fn, idx, sid, saveVal, { fields: { [trackKey]: 'edited' } });
  }, [editValue, safeId, stageDraft]);

  // Save one sentence → stage a DRAFT (no DB write). Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText, { sentences: { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' } });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const marks = {};
    if (changed) marks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) marks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    stageDraft(record, fn, idx, sid, fullText, { sentences: marks });
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
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true); setSaveError(null);
    try {
      // Commit each staged field for THIS section + record. localEdits is keyed `${field}-${idx}`
      // (full field value), so the trailing dot-segment is never numeric here → no arrayIndex.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/patient_instructions/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/patient_instructions/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage (only the committed fields)
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
          const baseField = (lastDot !== -1 && /^\d+$/.test(tail)) ? fieldPart.slice(0, lastDot) : fieldPart;
          if (store[id]) delete store[id][baseField];
        });
        if (store[id] && Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error(err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy');
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

  /* ═══════ BUILD SECTION COPY TEXT ═══════ */
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
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => hasVal(getFieldValue(record, f, idx)))) return '';
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        const kept = items.filter(item => typeof item === 'object' ? (item.recommendation && String(item.recommendation).trim()) : (item && String(item).trim()));
        if (kept.length > 0) {
          text += `${label}\n`;
          kept.forEach((item, i) => {
            if (typeof item === 'object' && item.recommendation) {
              if (item.date) text += `  ${formatDate(item.date)}:\n`;
              text += `  ${i + 1}. ${item.recommendation}\n`;
            } else {
              text += `  ${i + 1}. ${item}\n`;
            }
          });
          text += '\n';
        }
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || NARRATIVE_FIELDS.includes(f)) {
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
    let text = '=== PATIENT INSTRUCTIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Patient Instruction ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText, hasVal]);

  /* ═══════ RENDER: DATE FIELD (record-header date-picker) ═══════ */
  const renderDateField = (record, fn, idx) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    return (
      <span className={`record-date ${isModified ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }} style={{ cursor: 'pointer' }}>
        {isEditing ? (
          <span className="edit-field-container" onClick={e => e.stopPropagation()}>
            <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
            {saveError && <span className="save-error">{saveError}</span>}
            <span className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, null, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </span>
          </span>
        ) : (
          <>{highlightText(displayVal)} <span className="edit-indicator">&#9998;</span></>
        )}
      </span>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS FIELD (array) ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => {
      if (typeof item === 'object') return item.recommendation && String(item.recommendation).trim();
      return item && String(item).trim();
    }) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label !== title;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    // Group by date
    const groups = {};
    items.forEach((item, i) => {
      const recDate = typeof item === 'object' && item.date ? formatDate(item.date) : 'No Date';
      const recText = typeof item === 'object' && item.recommendation ? item.recommendation : String(item);
      if (!groups[recDate]) groups[recDate] = [];
      groups[recDate].push({ text: recText, originalIdx: i });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {Object.entries(groups).map(([dateKey, groupItems], gIdx) => {
          const showDate = dateKey !== 'No Date';
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {showDate && <div className="nested-subtitle">{highlightText(dateKey)}</div>}
              {groupItems.map((item) => {
                const rowEditKey = `${fn}.${item.originalIdx}-${idx}`;
                const isEditing = editingField === rowEditKey;
                const isModified = editedFields[rowEditKey];

                if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
                  const phrase = searchTerm.toLowerCase().trim();
                  const labelLower = label.toLowerCase();
                  if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !item.text.toLowerCase().includes(phrase) && !(showDate && dateKey.toLowerCase().includes(phrase))) return null;
                }

                return (
                  <div key={item.originalIdx}>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(rowEditKey); setEditValue(item.text); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [];
                              const existing = currentArr[item.originalIdx];
                              if (typeof existing === 'object') {
                                currentArr[item.originalIdx] = { ...existing, recommendation: editValue };
                              } else {
                                currentArr[item.originalIdx] = editValue;
                              }
                              // Stage the whole updated array as a DRAFT (no DB write). Approve commits it.
                              stageDraft(record, fn, idx, sid, currentArr, { fields: { [rowEditKey]: 'edited' } });
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(item.text)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[rowEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${showDate ? `${dateKey}: ` : ''}${item.text}`, rowEditKey); }}>{copiedItems[rowEditKey] ? 'Copied!' : 'Copy'}</button>
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
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label !== title;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence OR a single labeled "Label: v1, v2…" sentence: decompose (never side-by-side) */
    if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
                        const ciParsed = parseLabel(ci);
                        return (
                          <div key={ciIdx}>
                            {ciParsed.isLabeled && <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>}
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => {
                                      e.stopPropagation();
                                      const id2 = safeId(record); if (!id2) return;
                                      const currentVal2 = String(getFieldValue(record, fn, idx) || '');
                                      const sentences2 = splitBySentence(currentVal2);
                                      const s2 = sentences2[sIdx] || '';
                                      const p2 = parseLabel(s2);
                                      if (!p2.isLabeled) return;
                                      const items2 = splitByComma(p2.value);
                                      const trimmed = editValue.trim();
                                      const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
                                      if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
                                      const rebuilt = `${p2.label}: ${items2.join(', ')}.`;
                                      const allS = [...sentences2]; allS[sIdx] = rebuilt;
                                      const fullText2 = reconstructFullText(allS);
                                      const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added';
                                      stageDraft(record, fn, idx, sid, fullText2, { sentences: marks });
                                    }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ciParsed.isLabeled ? ciParsed.value : ci)}</span><span className="edit-indicator">&#9998;</span></div>
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
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => {
                            e.stopPropagation();
                            if (parsed.isLabeled) {
                              const trimmed = editValue.trim();
                              const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
                              const newValue = subParts.join(', ');
                              const reconstructed = `${parsed.label}: ${newValue}`;
                              const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
                              sentences2[sIdx] = reconstructed;
                              const fullText = reconstructFullText(sentences2);
                              const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added';
                              stageDraft(record, fn, idx, sid, fullText, { sentences: marks });
                            } else {
                              saveSentence(record, fn, idx, sid, sIdx);
                            }
                          }}>{saving ? 'Saving...' : 'Save'}</button>
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
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];
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
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid, title);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="patient-instructions-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Patient Instructions</h2></div>
        <div className="empty-state">No patient instructions records available.</div>
      </div>
    );
  }

  return (
    <div className="patient-instructions-document" ref={containerRef}>
      {/* ═══ HEADER ═══ */}
      <div className="document-header">
        <h2 className="document-title">Patient Instructions</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink
            document={<PatientInstructionsDocumentPDFTemplate document={pdfData} />}
            fileName="Patient_Instructions.pdf"
            className="copy-btn"
          >
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search patient instructions..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>
        )}
      </div>

      {/* ═══ RECORDS ═══ */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">No instructions match your search.</div>
        ) : (
          filteredRecords.map((record, idx) => (
            <div key={idx} className="record-card">
              <div className="record-header">
                {hasVal(record.date) && (
                  <div className="record-meta-row">
                    {renderDateField(record, 'date', idx)}
                  </div>
                )}
                <h3 className="record-name">{highlightText(`Patient Instruction ${idx + 1}`)}</h3>
              </div>
              {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PatientInstructionsDocument;
