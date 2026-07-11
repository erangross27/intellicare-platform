/**
 * EegReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: eeg_reports
 *
 * 8 Sections:
 *   1. session-info: date (date picker), neurologist (string)
 *   2. indication-section: indication (sentence)
 *   3. technique-section: technique (VERY long multi-sentence with "Label: value" patterns)
 *   4. background-section: background (VERY long with "Label: value" patterns)
 *   5. abnormalities-section: abnormalities[] (array of long strings)
 *   6. epileptiform-section: epileptiformActivity (VERY long multi-sentence)
 *   7. seizures-section: seizures[] (array, often empty)
 *   8. interpretation-section: interpretation (VERY long multi-sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EegReportsDocumentPDFTemplate from '../pdf-templates/EegReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './EegReportsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'indication-section': 'Indication',
  'technique-section': 'Technique',
  'background-section': 'Background Activity',
  'abnormalities-section': 'Abnormalities',
  'epileptiform-section': 'Epileptiform Activity',
  'seizures-section': 'Seizures',
  'interpretation-section': 'Interpretation',
};

const FIELD_LABELS = {
  date: 'Date',
  neurologist: 'Neurologist',
  indication: 'Indication',
  technique: 'Technique',
  background: 'Background Activity',
  abnormalities: 'Abnormalities',
  epileptiformActivity: 'Epileptiform Activity',
  seizures: 'Seizures',
  interpretation: 'Interpretation',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'neurologist'],
  'indication-section': ['indication'],
  'technique-section': ['technique'],
  'background-section': ['background'],
  'abnormalities-section': ['abnormalities'],
  'epileptiform-section': ['epileptiformActivity'],
  'seizures-section': ['seizures'],
  'interpretation-section': ['interpretation'],
};

const SENTENCE_FIELDS = ['indication', 'technique', 'background', 'epileptiformActivity', 'interpretation'];
const ARRAY_FIELDS = ['abnormalities', 'seizures'];
const DATE_FIELDS = ['date'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  // char class includes ':' so a label carrying a clock time parses ("Seizure 1 - Jan 21, 2026, 5:38 PM: ...")
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'":-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split, with the canonical guards (memory 6a46180d) so lowering
   the split threshold to every comma never shatters natural constructs:
     • never inside parentheses           "(mesial temporal sclerosis)" stays intact
     • no-space comma kept together        "2,024" / "50,000" / "4,444 mg" — comma not followed by space
     • ", and …" / ", or …" stays joined   the Oxford-comma tail rides with its list
     • "… and," / "… or," stays joined     a trailing conjunction before the comma doesn't split      */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const next = text[i + 1];
      if (next && next !== ' ') { current += ch; continue; }                 // no-space comma → keep
      if (/^(and|or)\b/i.test(text.slice(i + 1).replace(/^\s+/, ''))) { current += ch; continue; } // ", and/or …"
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }       // "… and/or ,"
      const t = current.trim(); if (t) result.push(t); current = '';
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

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'eeg_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ COMPONENT ═══════ */
const EegReportsDocument = ({ document: docProp }) => {
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
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.eeg_reports) return Array.isArray(r.eeg_reports) ? r.eeg_reports : [r.eeg_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.eeg_reports) return Array.isArray(dd.eeg_reports) ? dd.eeg_reports : [dd.eeg_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE PENDING DRAFTS (survives refresh; shown in JSX, NOT in DB/PDF) ═══════ */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = idFor(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrayItem) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const baseArr = nLocal[`${fn}-${idx}`] !== undefined ? nLocal[`${fn}-${idx}`] : [...(record[fn] || [])];
          const arrCopy = Array.isArray(baseArr) ? [...baseArr] : [];
          arrCopy[arrIdx] = value;
          nLocal[`${fn}-${idx}`] = arrCopy;
          nPending[`${fn}-${idx}`] = true;
          nFields[`${fn}.${arrIdx}-${idx}`] = 'edited';
        } else {
          const fn = fieldPart;
          nLocal[`${fn}-${idx}`] = value;
          nPending[`${fn}-${idx}`] = true;
          if (SENTENCE_FIELDS.includes(fn)) nSentences[`${fn}-${idx}-s0`] = 'edited';
          else nFields[`${fn}-${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
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
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `EEG Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* Find the sectionId whose SECTION_FIELDS contains a field — used to drop a stale 'approved' flag on re-edit. */
  const sectionIdForField = useCallback((fn) => {
    for (const [sid, fields] of Object.entries(SECTION_FIELDS)) { if (fields.includes(fn)) return sid; }
    return null;
  }, []);

  // Drop a section's 'approved' flag when it is re-edited, so the button returns to yellow Pending Approve.
  const clearApprovedForField = useCallback((fn, idx) => {
    const sid = sectionIdForField(fn);
    if (!sid) return;
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
  }, [sectionIdForField]);

  // Stage a single field/value DRAFT into the localStorage draft store under this record.
  const stageDraft = useCallback((record, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    clearApprovedForField(fn, idx);
    stageDraft(record, fn, saveVal);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, clearApprovedForField, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrIdx}-${idx}`;
    setLocalEdits(prev => {
      const currentArr = [...(prev[`${fn}-${idx}`] || record[fn] || [])];
      currentArr[arrIdx] = value;
      return { ...prev, [`${fn}-${idx}`]: currentArr };
    });
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    clearApprovedForField(fn, idx);
    stageDraft(record, `${fn}.${arrIdx}`, value);
    setEditingField(null); setEditValue('');
  }, [safeId, clearApprovedForField, stageDraft]);

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
      // Pull this record's staged drafts and commit only the fieldParts belonging to this section.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverses stageDraft).
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(trailing);
        const baseField = isArrayItem ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue;
        const payload = { field: baseField, value };
        if (isArrayItem) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/eeg_reports/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedParts.push({ fieldPart, baseField });
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/eeg_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending for this section's fields → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) {
        committedParts.forEach(({ fieldPart }) => { delete store2[id][fieldPart]; });
        if (Object.keys(store2[id]).length === 0) delete store2[id];
        writeDrafts(store2);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.includes(`-${idx}-s`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EegReports] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId]);

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
  // Mirror the JSX leaf structure: split by sentence, then LABELED sentences (≥2 comma items) → sub-label
  // (DASH divider, restart numbering) + rows; UNLABELED sentences → comma-split ONLY at ≥3 (natural-grammar
  // guard) with a continuing counter. Sub-labels drop the trailing colon (the DASH divider replaces it).
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const strip = (x) => x.replace(/[;.]+$/, '').trim();
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
        lines.push('');
        lines.push(parsed.label);
        lines.push('-'.repeat(40));
        let m = 1; items.forEach(item => { lines.push(`${m++}. ${item}`); });
      } else {
        const parts = splitByComma(s);
        const items = (parts.length >= 2 ? parts : [s]).map(strip);
        items.forEach(item => { lines.push(`${n++}. ${item}`); });
      }
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
      text += `${label}\n${'-'.repeat(40)}\n`;
      if (DATE_FIELDS.includes(f)) {
        text += `1. ${formatDate(val)}\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
      } else if (Array.isArray(val)) {
        // Each array item: parseLabel → its label owns a sub-block (DASH divider); the value is then
        // sentence/comma-split like a narrative (mirrors renderArrayEditableSection + PDF renderArraySection).
        val.forEach((item) => {
          const p = parseLabel(String(item || ''));
          if (p.isLabeled) {
            text += `\n${p.label}\n${'-'.repeat(40)}\n`;
            formatSentenceFieldLines(p.value).forEach(l => { text += `${l}\n`; });
          } else {
            formatSentenceFieldLines(String(item || '')).forEach(l => { text += `${l}\n`; });
          }
        });
      } else {
        text += `1. ${fmtVal(val)}\n`;
      }
      text += '\n';
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EEG REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `EEG Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso || '')} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ SHARED: render a narrative VALUE as sentence→(labeled ≥2 | unlabeled ≥3) comma LEAVES ═══════
     Each leaf is an editable row. Used by BOTH the sentence fields and each array item's value so a
     "Seizure 1 - …: <multi-sentence narrative>" item decomposes into nested-subtitle + split rows.
       keyPrefix       – unique edit/React key base (`${fn}-${idx}` sentence | `${fn}.${arrIdx}-${idx}` array item)
       getCurrentValue – () => authoritative current full text (re-split on every save)
       commit          – (fullText, { editedKey, addedKeys }) => persist rebuilt full text + set badges
       modified        – value already has pending edits (adds the row 'modified' class)
       phraseMatch     – search: whole section already matches
       labelMatch      – search: the field/item label matches                                            */
  const renderValueLeaves = (keyPrefix, getCurrentValue, commit, modified, phraseMatch, labelMatch) => {
    const text = String(getCurrentValue() || '');
    const sentences = splitBySentence(text);
    const term = searchTerm.toLowerCase().trim();

    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const isLabeled = parsed.isLabeled;
      const commaItems = isLabeled ? splitByComma(parsed.value) : splitByComma(sentence);
      const doSplit = commaItems.length >= 2; // split EVERY (guarded) comma — user directive "dot then comma"
      const strip = (s) => s.replace(/[;.]+$/, '').trim();
      const leaves = (doSplit ? commaItems : [isLabeled ? parsed.value : sentence]).map(strip);
      const wholeSentence = !isLabeled && !doSplit; // single unlabeled leaf = the whole sentence
      const groupLabelMatch = isLabeled && term && parsed.label.toLowerCase().includes(term);

      // Rebuild sentence[sIdx] replacing comma-leaf ciIdx with newVal, then commit the whole value.
      const saveLeaf = (ciIdx, newVal) => {
        const cur = String(getCurrentValue() || '');
        const ss = splitBySentence(cur);
        const s2 = ss[sIdx] || '';
        const p2 = parseLabel(s2);
        const trimmed = newVal.trim();

        if (!p2.isLabeled && wholeSentence) {
          // whole unlabeled sentence → empty removes it; "A. B" expands into new sentences
          if (!trimmed || /^[;.,!?]+$/.test(trimmed)) { ss.splice(sIdx, 1); }
          else { ss.splice(sIdx, 1, ...splitBySentence(trimmed)); }
          commit(reconstructFullText(ss), { editedKey: `${keyPrefix}-s${sIdx}-c0`, addedKeys: [] });
          return;
        }

        const subParts = trimmed.split(/\.\s+/).map(x => x.replace(/[;.]+$/, '').trim()).filter(Boolean);
        let items2;
        if (p2.isLabeled) { items2 = splitByComma(p2.value); if (items2.length < 2) items2 = [p2.value]; }
        else { items2 = splitByComma(s2); if (items2.length < 3) items2 = [s2.replace(/[;.]+$/, '').trim()]; }
        if (subParts.length > 1) items2.splice(ciIdx, 1, ...subParts);
        else items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim();
        ss[sIdx] = p2.isLabeled ? `${p2.label}: ${items2.join(', ')}` : items2.join(', ');
        const addedKeys = [];
        for (let ei = 1; ei < subParts.length; ei++) addedKeys.push(`${keyPrefix}-s${sIdx}-c${ciIdx + ei}`);
        commit(reconstructFullText(ss), { editedKey: `${keyPrefix}-s${sIdx}-c${ciIdx}`, addedKeys });
      };

      const rows = leaves.map((leafText, ciIdx) => {
        const leafKey = `${keyPrefix}-s${sIdx}-c${ciIdx}`;
        const ciEditing = editingField === leafKey;
        const ciBadge = editedSentences[leafKey];
        const rowMod = ciBadge || modified;
        const ciMatches = !term || phraseMatch || labelMatch || groupLabelMatch || leafText.toLowerCase().includes(term);
        if (!ciMatches) return null;
        return (
          <div key={ciIdx}>
            <div className={`numbered-row ${rowMod ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(leafKey); setEditValue(leafText); setSaveError(null); } }}>
              {ciEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(ciIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row-content"><span className="content-value">{highlightText(leafText)}</span><span className="edit-indicator">✎</span></div>
                  <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(leafText, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
                </>
              )}
            </div>
            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
          </div>
        );
      });

      const visible = rows.filter(Boolean);
      if (term && visible.length === 0) return null;

      if (isLabeled) {
        return (
          <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {visible}
          </div>
        );
      }
      return <div key={sIdx}>{visible}</div>;
    });
  };

  /* ═══════ RENDER: ARRAY EDITABLE SECTION ═══════ */
  const renderArrayEditableSection = (record, idx, fn, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const term = searchTerm.toLowerCase().trim();

    return arr.map((item, arrIdx) => {
      const itemVal = String(item || '');
      if (!itemVal.trim()) return null;
      if (searchTerm.trim() && !phraseMatch && !itemVal.toLowerCase().includes(term)) return null;

      const parsed = parseLabel(itemVal);           // item label (e.g. "Seizure 1 - …") → top nested-subtitle
      const itemLabel = parsed.isLabeled ? parsed.label : null;
      const keyPrefix = `${fn}.${arrIdx}-${idx}`;
      const itemModified = editedFields[keyPrefix];  // handleSaveArrayItem tracks edits at the item level
      const itemLabelMatch = !!(itemLabel && term && itemLabel.toLowerCase().includes(term));

      // The value re-split on save is the item's narrative (after stripping its own label).
      const getCurrentValue = () => {
        const a = getFieldValue(record, fn, idx) || [];
        const p = parseLabel(String(a[arrIdx] || ''));
        return p.isLabeled ? p.value : String(a[arrIdx] || '');
      };
      const commit = (fullText, { editedKey, addedKeys }) => {
        const a = getFieldValue(record, fn, idx) || [];
        const p = parseLabel(String(a[arrIdx] || ''));
        const newItem = p.isLabeled ? `${p.label}: ${fullText}` : fullText;
        handleSaveArrayItem(record, fn, idx, arrIdx, newItem);
        setEditedSentences(prev => { const n = { ...prev, [editedKey]: 'edited' }; addedKeys.forEach(k => { n[k] = 'added'; }); return n; });
      };

      return (
        <div key={arrIdx} className="rec-mini-card">
          {itemLabel && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
          {renderValueLeaves(keyPrefix, getCurrentValue, commit, itemModified, phraseMatch, itemLabelMatch)}
          {itemModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: SENTENCE EDITABLE (sentence→labeled/comma leaves via shared renderer) ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const term = searchTerm.toLowerCase().trim();
    const labelMatch = !!(term && label.toLowerCase().includes(term));

    const keyPrefix = `${fn}-${idx}`;
    const getCurrentValue = () => String(getFieldValue(record, fn, idx) || '');
    const commit = (fullText, { editedKey, addedKeys }) => {
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [keyPrefix]: fullText }));
      setPendingEdits(prev => ({ ...prev, [keyPrefix]: true }));
      setEditedSentences(prev => { const n = { ...prev, [editedKey]: 'edited' }; addedKeys.forEach(k => { n[k] = 'added'; }); return n; });
      clearApprovedForField(fn, idx);
      stageDraft(record, fn, fullText);
      setEditingField(null); setEditValue('');
    };

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {renderValueLeaves(keyPrefix, getCurrentValue, commit, false, phraseMatch, labelMatch)}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values
    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayEditableSection(record, idx, f, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="eeg-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">EEG Reports</h2></div>
        <div className="empty-state">No EEG report records available</div>
      </div>
    );
  }

  return (
    <div className="eeg-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">EEG Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EegReportsDocumentPDFTemplate document={pdfData} />} fileName="Eeg_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search EEG reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`EEG Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'indication-section')}
            {renderSection(record, idx, 'technique-section')}
            {renderSection(record, idx, 'background-section')}
            {renderSection(record, idx, 'abnormalities-section')}
            {renderSection(record, idx, 'epileptiform-section')}
            {renderSection(record, idx, 'seizures-section')}
            {renderSection(record, idx, 'interpretation-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EegReportsDocument;
