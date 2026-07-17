/**
 * AntibiogramReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: antibiogram_reports
 *
 * 5 Sections:
 *   1. provider-information: reportedBy, facility
 *   2. specimen-information: organism, specimenSource, date
 *   3. susceptibility-data: antibioticsTested, susceptibilities, micValue
 *   4. resistance-analysis: resistancePattern, method
 *   5. clinical-interpretation: interpretation, notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import AntibiogramReportsDocumentPDFTemplate from '../pdf-templates/AntibiogramReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AntibiogramReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'antibiogram_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'provider-information': 'Provider Information',
  'specimen-information': 'Specimen Information',
  'susceptibility-data': 'Susceptibility Data',
  'resistance-analysis': 'Resistance Analysis',
  'clinical-interpretation': 'Clinical Interpretation',
};

const FIELD_LABELS = {
  reportedBy: 'Reported By',
  facility: 'Facility',
  organism: 'Organism',
  specimenSource: 'Specimen Source',
  date: 'Date',
  antibioticsTested: 'Antibiotics Tested',
  susceptibilities: 'Susceptibilities',
  micValue: 'MIC Values',
  resistancePattern: 'Resistance Pattern',
  method: 'Method',
  interpretation: 'Interpretation',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'provider-information': ['reportedBy', 'facility'],
  'specimen-information': ['organism', 'specimenSource', 'date'],
  'susceptibility-data': ['antibioticsTested', 'susceptibilities', 'micValue'],
  'resistance-analysis': ['resistancePattern', 'method'],
  'clinical-interpretation': ['interpretation', 'notes'],
};

const STRING_FIELDS = ['organism', 'specimenSource', 'resistancePattern', 'method', 'interpretation', 'reportedBy', 'facility', 'notes'];
const ARRAY_FIELDS = ['antibioticsTested'];
const OBJECT_FIELDS = ['susceptibilities', 'micValue'];
const DATE_FIELDS = ['date'];

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

/* splitNumberUnit: parse a value like "≤0.5 mcg/mL" / "0.06 mcg/mL" / "42%" into an editable
   number + a fixed prefix/unit. Returns null for non-numeric ("Susceptible") and for ranges
   ("0.5-2 mcg/mL") so those keep the free-text editor (number stepper would corrupt them). */
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S.*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/^[-–—]\s*\d/.test(unit)) return null; // range -> keep text editing
  const decimals = (m[2].split('.')[1] || '').length;
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: decimals > 0 ? Math.pow(10, -decimals) : 1 };
};

const formatMicDisplay = (value) => String(value ?? '').replace(/≤/g, '<=').replace(/≥/g, '>=');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* toInputDate: ISO/Date -> "YYYY-MM-DD" for BlueDatePicker */
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ======= COMPONENT ======= */
const AntibiogramReportsDocument = ({ document: docProp }) => {
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

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.antibiogram_reports) return Array.isArray(r.antibiogram_reports) ? r.antibiogram_reports : [r.antibiogram_reports];
      if (r?.data) return Array.isArray(r.data) ? r.data : [r.data];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.antibiogram_reports) return Array.isArray(dd.antibiogram_reports) ? dd.antibiogram_reports : [dd.antibiogram_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     localEdits stores the FULL field value keyed by `${field}-${idx}`, so the draft fieldPart is the
     field name (handling "field.arrayIndex" defensively per the shared draft shape). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const safeIdOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeIdOf(record);
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

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

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

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ======= SEARCH -- 4-LEVEL ======= */
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
        if (typeof val === 'object' && !Array.isArray(val)) {
          if (JSON.stringify(val).toLowerCase().includes(phrase)) return true;
        } else {
          if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (typeof val === 'object' && !Array.isArray(val)) {
        return JSON.stringify(val).toLowerCase().includes(phrase);
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
      const rt = `Antibiogram Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val) {
            if (typeof val === 'object' && !Array.isArray(val)) {
              if (JSON.stringify(val).toLowerCase().includes(phrase)) return true;
            } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
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

  /* ======= EDIT HANDLERS ======= */
  /* Stage the FULL field value as a DRAFT (no DB write) + persist to the pending-drafts localStorage
     store so it survives refresh. Approve (handleApproveSection) is the only path that writes to DB.
     localEdits is keyed by `${fn}-${idx}`; the draft is keyed by record id -> field name. */
  const stageDraft = useCallback((record, fn, idx, value) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: value }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
    const trimmed = value.trim();
    const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s);
    if (subParts.length > 1) { currentArr.splice(arrIdx, 1, ...subParts); } else { currentArr[arrIdx] = trimmed; }
    const editKey = `${fn}.${arrIdx}-${idx}`;
    stageDraft(record, fn, idx, currentArr);
    const marks = { [editKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}.${arrIdx + ei}-${idx}`] = 'added';
    setEditedFields(prev => ({ ...prev, ...marks }));
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, fn, idx, fullText);
      setEditedSentences(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}-s`)) delete n[k]; });
        n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
        return n;
      });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, fn, idx, fullText);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}-s`)) delete n[k]; });
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)) ||
      pendingEdits[`${f}-${idx}`]
    );
  }, [editedFields, editedSentences, pendingEdits]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF/Copy All. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Staged drafts for THIS section: localEdits keys of form `${field}-${idx}` (field in this section)
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the trailing dot-segment is purely numeric
        const baseField = (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) ? fieldPart.slice(0, dotIdx) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArr = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const payload = { field: isArr ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        await secureApiClient.put(`/api/edit/antibiogram_reports/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/antibiogram_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for committed fields from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const dotIdx = fieldPart.lastIndexOf('.');
          const baseField = (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) ? fieldPart.slice(0, dotIdx) : fieldPart;
          delete store[id][fieldPart];
          delete store[id][baseField];
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AntibiogramReports] Approve error:', err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY ======= */
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
    let text = `${title}\n${'-'.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n  1. ${formatDate(val)}\n\n`;
      } else if (OBJECT_FIELDS.includes(f)) {
        text += `${label}\n`;
        const obj = val;
        let rowNumber = 1;
        Object.entries(obj).forEach(([key, sub]) => {
          if (typeof sub === 'object' && sub !== null) {
            text += `${key}\n`;
            Object.entries(sub).forEach(([k2, v2]) => {
              const shown = f === 'micValue' ? formatMicDisplay(v2) : String(v2);
              text += `  ${k2}\n  ${rowNumber++}. ${shown}\n`;
            });
          } else {
            const shown = f === 'micValue' ? formatMicDisplay(sub) : String(sub);
            text += `${key}\n  ${rowNumber++}. ${shown}\n`;
          }
        });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
        if (items.length > 0) {
          text += `${label}\n`;
          items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
          text += '\n';
        }
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          const showLabelCopy = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
          if (showLabelCopy) text += `${label}\n`;
          formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
          text += '\n';
        } else {
          text += `${label}\n  1. ${strVal}\n\n`;
        }
      } else {
        text += `${label}\n  1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== ANTIBIOGRAM REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Antibiogram Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD (formatted display + date picker) ======= */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={setEditValue} />
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

  /* ======= RENDER: OBJECT FIELD (susceptibilities, micValue) ======= */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || typeof val !== 'object' || Array.isArray(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const entries = Object.entries(val);
    // Check if it is a nested object (susceptibilities style: { "Organism": { "ABX": "%" } })
    const isNested = entries.some(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v));

    if (isNested) {
      return (
        <div key={fn} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {entries.map(([orgName, orgData]) => (
            <div key={orgName} className="nested-mini-card">
              <div className="nested-subtitle">{highlightText(orgName)}</div>
              {Object.entries(orgData || {}).map(([key, value]) => {
                const editKey = `${fn}.${orgName}.${key}-${idx}`;
                const isEditing = editingField === editKey;
                const isModified = editedFields[editKey];
                const valStr = String(value);
                const shownValue = fn === 'micValue' ? formatMicDisplay(valStr) : valStr;
                const nu = splitNumberUnit(valStr);
                const bump = (delta) => {
                  const current = Number.parseFloat(editValue);
                  const decimals = (String(nu?.step || 1).split('.')[1] || '').length;
                  setEditValue(((Number.isNaN(current) ? 0 : current) + delta).toFixed(decimals));
                };
                const saveNestedValue = (newValue) => {
                  const id = safeId(record); if (!id) return;
                  const currentObj = { ...(getFieldValue(record, fn, idx) || {}) };
                  currentObj[orgName] = { ...(currentObj[orgName] || {}), [key]: newValue };
                  setSaveError(null);
                  stageDraft(record, fn, idx, currentObj);
                  setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                  setEditingField(null); setEditValue('');
                };
                return (
                  <div key={key} className="nested-mini-card" data-edit-field={fn}>
                    <div className="nested-subtitle sub-label">{highlightText(key)}</div>
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu ? nu.number : valStr); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          {nu ? (
                            <div className="num-unit-edit">
                              {nu.prefix && <span className="nu-affix">{nu.prefix}</span>}
                              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-nu.step); }}>−</button>
                              <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(nu.step); }}>+</button>
                              {nu.unit && <span className="nu-affix nu-unit">{nu.unit}</span>}
                            </div>
                          ) : (
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          )}
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (nu) { if (editValue === '' || isNaN(parseFloat(editValue))) { setSaveError('Please enter a valid number'); return; } saveNestedValue(`${nu.prefix}${editValue}${nu.sep}${nu.unit}`); } else { saveNestedValue(editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(shownValue)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${key}\n${shownValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    // Flat object (susceptibilities/micValue: { "AMP": "42%" }) — drug key = nested-subtitle sub-label,
    // value in its OWN nested-mini-card (triple-nested mini-card standard, memory 697ba540).
    // Level-4 per-entry search filtering (memory 69917b95): when searching, show ONLY the drug rows
    // whose key or value matches — unless the field label / section title matches (then show all).
    const phraseLc = searchTerm.toLowerCase().trim();
    const showAllEntries = !phraseLc || record._showAllSections || sectionTitleMatches(sid) ||
      label.toLowerCase().includes(phraseLc) || phraseLc.includes(label.toLowerCase());
    const visibleEntries = showAllEntries
      ? entries
      : entries.filter(([k, v]) => String(k).toLowerCase().includes(phraseLc) || String(v).toLowerCase().includes(phraseLc));
    if (visibleEntries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {visibleEntries.map(([key, value]) => {
          const editKey = `${fn}.${key}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const valStr = String(value);
          // Numeric value+unit (e.g. "≤0.5 mcg/mL", "42%") edits the NUMBER with a stepper and keeps
          // the prefix/unit fixed; non-numeric ("Susceptible") keeps the free-text editor.
          const nu = splitNumberUnit(valStr);
          const shownValue = fn === 'micValue' ? formatMicDisplay(valStr) : valStr;
          const bump = (delta) => {
            const current = Number.parseFloat(editValue);
            const decimals = (String(nu?.step || 1).split('.')[1] || '').length;
            setEditValue(((Number.isNaN(current) ? 0 : current) + delta).toFixed(decimals));
          };
          const saveObjVal = (newVal) => { const id = safeId(record); if (!id) return; const currentObj = { ...(getFieldValue(record, fn, idx) || {}) }; currentObj[key] = newVal; setSaveError(null); stageDraft(record, fn, idx, currentObj); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); };
          return (
            <div key={key} className="nested-mini-card" data-edit-field={fn}>
              <div className="nested-subtitle sub-label">{highlightText(key)}</div>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(nu ? nu.number : valStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {nu ? (
                      <div className="num-unit-edit">
                        {nu.prefix && <span className="nu-affix">{nu.prefix}</span>}
                        <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-nu.step); }}>−</button>
                        <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(nu.step); }}>+</button>
                        {nu.unit && <span className="nu-affix nu-unit">{nu.unit}</span>}
                      </div>
                    ) : (
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    )}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (nu) { if (editValue === '' || isNaN(parseFloat(editValue))) { setSaveError('Please enter a valid number'); return; } saveObjVal(`${nu.prefix}${editValue}${nu.sep}${nu.unit}`); } else { saveObjVal(editValue); } }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(shownValue)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${key}\n${shownValue}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ======= RENDER: ARRAY FIELD ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="nested-mini-card regular-row-group">
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} className="editable-leaf" data-edit-field={fn}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, itemIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className={`modified-badge ${isModified === 'added' ? 'added' : ''}`}>{isModified === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
            </div>
          );
        })}
        </div>
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
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

      const visibleRows = sentences.map((sentence, sIdx) => ({ sentence, sIdx, parsed: parseLabel(sentence) }))
        .filter(({ sentence }) => phraseMatch || labelMatch || !searchTerm.trim() || sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      const groups = visibleRows.reduce((all, row) => {
        if (row.parsed.isLabeled) all.push({ type: 'labeled', rows: [row] });
        else if (all[all.length - 1]?.type === 'unlabeled') all[all.length - 1].rows.push(row);
        else all.push({ type: 'unlabeled', rows: [row] });
        return all;
      }, []);

      const saveRegularSentence = (parsed, sIdx, sentenceKey) => {
        if (!parsed.isLabeled) { saveSentence(record, fn, idx, sid, sIdx); return; }
        const trimmed = editValue.trim();
        const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(Boolean);
        const reconstructed = `${parsed.label}: ${subParts.join(', ')}`;
        const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
        sentences2[sIdx] = reconstructed;
        const fullText = reconstructFullText(sentences2);
        setSaveError(null);
        stageDraft(record, fn, idx, fullText);
        const marks = { [sentenceKey]: 'edited' };
        for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added';
        setEditedSentences(prev => ({ ...prev, ...marks }));
        setEditingField(null); setEditValue('');
      };

      const renderRegularSentenceRow = ({ sentence, sIdx, parsed }) => {
        const sentenceKey = `${fn}-${idx}-s${sIdx}`;
        const isEditing = editingField === sentenceKey;
        const badge = editedSentences[sentenceKey];
        return (
          <div key={sIdx} className="editable-leaf" data-edit-field={fn}>
            <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
              {isEditing ? (
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRegularSentence(parsed, sIdx, sentenceKey); }}>{saving ? 'Saving...' : 'Save'}</button>
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
      };

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {groups.map((group, groupIdx) => {
              if (group.type === 'labeled') {
                const [{ sentence, sIdx, parsed }] = group.rows;
                const sentenceKey = `${fn}-${idx}-s${sIdx}`;
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={`labeled-${groupIdx}`} className="nested-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx} className="editable-leaf" data-edit-field={fn}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                return (
                  <div key={`labeled-${groupIdx}`} className="nested-mini-card" style={{ marginTop: 8 }}>
                    <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                    {renderRegularSentenceRow(group.rows[0])}
                  </div>
                );
              }
              return (
                <div key={`unlabeled-${groupIdx}`} className="nested-mini-card regular-row-group">
                  {group.rows.map(renderRegularSentenceRow)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string: use saveSentence(record, fn, idx, sid, 0) */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey] || editedSentences[`${fn}-${idx}-s0`];
    const showLabelSingle = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();

    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {showLabelSingle && <div className="nested-subtitle">{highlightText(label)}</div>}
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

  /* ======= RENDER: GENERIC SECTION ======= */
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
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="antibiogram-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Antibiogram Reports</h2></div>
        <div className="empty-state">No antibiogram report records available</div>
      </div>
    );
  }

  return (
    <div className="antibiogram-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Antibiogram Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AntibiogramReportsDocumentPDFTemplate document={pdfData} />} fileName="Antibiogram_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search antibiogram reports (organisms, antibiotics, susceptibilities...)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Antibiogram Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'provider-information')}
            {renderSection(record, idx, 'specimen-information')}
            {renderSection(record, idx, 'susceptibility-data')}
            {renderSection(record, idx, 'resistance-analysis')}
            {renderSection(record, idx, 'clinical-interpretation')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AntibiogramReportsDocument;
