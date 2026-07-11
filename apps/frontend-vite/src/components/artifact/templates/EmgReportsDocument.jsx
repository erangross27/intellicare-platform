/**
 * EmgReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: emg_reports
 *
 * 7 Sections:
 *   1. session-info: date (date picker), neurologist
 *   2. indication-section: indication (long string)
 *   3. muscles-tested: musclesTested[] (array of strings)
 *   4. nerve-conduction: nerveConduction.findings (dot-notation nested)
 *   5. needle-examination: needleExamination.findings (dot-notation nested)
 *   6. findings-section: findings (sentence)
 *   7. interpretation-section: interpretation (long multi-sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EmgReportsDocumentPDFTemplate from '../pdf-templates/EmgReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './EmgReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex" or dotted path) */
const DRAFT_KEY = 'emg_reportsPendingEdits';
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
  'session-info': 'Session Information',
  'indication-section': 'Indication',
  'muscles-tested': 'Muscles Tested',
  'nerve-conduction': 'Nerve Conduction',
  'needle-examination': 'Needle Examination',
  'findings-section': 'Findings',
  'interpretation-section': 'Interpretation',
};

const FIELD_LABELS = {
  date: 'Date',
  neurologist: 'Neurologist',
  indication: 'Indication',
  musclesTested: 'Muscles Tested',
  nerveConduction: 'Nerve Conduction',
  needleExamination: 'Needle Examination',
  findings: 'Findings',
  interpretation: 'Interpretation',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'neurologist'],
  'indication-section': ['indication'],
  'muscles-tested': ['musclesTested'],
  'nerve-conduction': ['nerveConduction'],
  'needle-examination': ['needleExamination'],
  'findings-section': ['findings'],
  'interpretation-section': ['interpretation'],
};

const SENTENCE_FIELDS = ['indication', 'findings', 'interpretation'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['musclesTested'];
/* Dynamic-key object roots: keys/shapes vary per record (strings, nested objects, arrays-of-objects). */
const DYNAMIC_OBJECT_FIELDS = ['nerveConduction', 'needleExamination'];

/* Canonical Copy dividers (4-area mirror) */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* humanizeKey: turn camelCase / snake_case / abbrev keys into readable labels */
const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
};

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; } // Oxford guard — keep the final conjoined item whole
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

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const EmgReportsDocument = ({ document: docProp }) => {
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
      if (r?.emg_reports) return Array.isArray(r.emg_reports) ? r.emg_reports : [r.emg_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emg_reports) return Array.isArray(dd.emg_reports) ? dd.emg_reports : [dd.emg_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark the field/array edited so the section shows Pending Approve. Sentence fields also flag s0.
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'number') return String(v); if (v && typeof v === 'object') return ''; return String(v || ''); }, []);

  /* collectLeafText: recursively gather all leaf strings + keys from any value for search */
  const collectLeafText = useCallback((v) => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(collectLeafText).join(' ');
    if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${collectLeafText(val)}`).join(' ');
    return String(v);
  }, []);

  // Paren-aware sentence split on a TOP-LEVEL [.;] followed by whitespace — so an in-paren clause like
  // "(R: 38 m/s, L: 34 m/s; normal >50 m/s)" or a decimal "3.4 ms" never shatters. Abbreviation-guarded for '.'.
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const ABBR = /(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i;
    const out = []; let cur = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      const boundary = depth === 0 && /[.;]/.test(ch) && (i + 1 >= text.length || /\s/.test(text[i + 1]))
        && !(ch === '.' && ABBR.test((cur.match(/(\S+)$/) || [''])[0]));
      if (boundary) { const t = cur.trim(); if (t && !/^[;.,!?]+$/.test(t)) out.push(t); cur = ''; }
      else cur += ch;
    }
    const t = cur.trim(); if (t && !/^[;.,!?]+$/.test(t)) out.push(t);
    return out;
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /** Get field value supporting dot-notation for nested objects */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    if (fn.includes('.')) {
      const parts = fn.split('.');
      let val = record;
      for (const p of parts) { val = val?.[p]; if (val === undefined) return undefined; }
      return val;
    }
    const base = record[fn];
    // For dynamic-key object roots, overlay any leaf edits (keys like "fn.a.b-idx") onto a clone
    if (DYNAMIC_OBJECT_FIELDS.includes(fn) && base && typeof base === 'object') {
      const leafEdits = Object.keys(localEdits).filter(ek => ek.startsWith(`${fn}.`) && ek.endsWith(`-${idx}`));
      if (leafEdits.length === 0) return base;
      const clone = JSON.parse(JSON.stringify(base));
      leafEdits.forEach(ek => {
        const path = ek.slice(0, ek.length - `-${idx}`.length).split('.');
        let cursor = clone;
        for (let pi = 1; pi < path.length - 1; pi++) {
          const seg = path[pi];
          if (cursor[seg] === undefined || cursor[seg] === null || typeof cursor[seg] !== 'object') cursor[seg] = {};
          cursor = cursor[seg];
        }
        cursor[path[path.length - 1]] = localEdits[ek];
      });
      return clone;
    }
    return base;
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
        if (val && typeof val === 'object') {
          if (collectLeafText(val).toLowerCase().includes(phrase)) return true;
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, collectLeafText]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (val && typeof val === 'object') {
        return collectLeafText(val).toLowerCase().includes(phrase);
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal, collectLeafText]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `EMG Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && typeof val === 'object') {
            if (collectLeafText(val).toLowerCase().includes(phrase)) return true;
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal, collectLeafText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          if (fieldPath.includes('.')) {
            // Deep-merge arbitrary-depth dotted path (arrays addressed by numeric segments)
            const parts = fieldPath.split('.');
            let cursor = merged;
            for (let pi = 0; pi < parts.length - 1; pi++) {
              const seg = parts[pi];
              const existing = cursor[seg];
              const clone = Array.isArray(existing) ? [...existing] : { ...(existing || {}) };
              cursor[seg] = clone;
              cursor = clone;
            }
            cursor[parts[parts.length - 1]] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // Persist the draft (fieldPart = the dotted/plain field path) so a Save survives refresh
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save array item = stage a DRAFT locally (fieldPart "fn.arrIdx" → arrayIndex on Approve). No DB write.
  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    const fieldPart = `${fn}.${arrIdx}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  // saveSentence = stage a DRAFT of the rebuilt full text locally (no DB write). Approve commits it.
  function stageSentenceDraft(record, fn, idx, sid, fullText, sentenceMarks) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, ...sentenceMarks }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageSentenceDraft(record, fn, idx, sid, fullText, { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' });
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
    stageSentenceDraft(record, fn, idx, sid, fullText, marks);
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
    const suffix = `-${idx}`;
    // A pending editKey "<fieldPart>-<idx>" belongs to this section when its base field is in `fields`.
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.split('.')[0];
      return fields.includes(baseField);
    });
    try {
      // Persist each staged field to the DB now. Trailing purely-numeric dot-segment → arrayIndex;
      // any other dotted path (e.g. nerveConduction.findings) is sent as the full dotted field.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(lastSeg, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/emg_reports/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/emg_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

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
        lines.push(parsed.label + ':');
        lines.push(COPY_LINE_DASH); // DASH line under the sub-label so it reads as a subtitle
        if (parts.length >= 2) parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        else lines.push(`  ${n++}. ${parsed.value}`);
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  /* flattenObjectCopyLines: recursively render a dynamic-key object/array into indented Copy lines */
  const flattenObjectCopyLines = useCallback((value, depth) => {
    const pad = '  '.repeat(depth);
    const lines = [];
    if (value === null || value === undefined || value === '') return lines;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          lines.push(`${pad}${i + 1}.`);
          lines.push(...flattenObjectCopyLines(item, depth + 1));
        } else if (hasVal(item)) {
          lines.push(`${pad}${i + 1}. ${String(item)}`);
        }
      });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        if (!hasVal(v)) return;
        lines.push(`${pad}${humanizeKey(k)}`);
        lines.push(`${pad}${COPY_LINE_DASH}`); // DASH line under the subtitle so it reads as a subtitle
        if (v && typeof v === 'object') {
          lines.push(...flattenObjectCopyLines(v, depth + 1));
        } else {
          // stack the key + value on separate lines — NEVER side-by-side "Key: value" (4-area rule)
          lines.push(`${pad}  ${fmtVal(v)}`);
        }
      });
    } else {
      lines.push(`${pad}${fmtVal(value)}`);
    }
    return lines;
  }, [hasVal, fmtVal]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (present.length === 0) return ''; // empty-section drop → Copy All omits the section
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    present.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      // single-name gate: when the field label == the section title, drop the repeated DASH head
      const head = label.toLowerCase() !== title.toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : '';
      if (DATE_FIELDS.includes(f)) {
        text += `${head}1. ${formatDate(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += head;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else if (ARRAY_FIELDS.includes(f)) {
        text += head;
        (Array.isArray(val) ? val : []).forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else if (DYNAMIC_OBJECT_FIELDS.includes(f)) {
        text += head;
        flattenObjectCopyLines(val, 0).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines, flattenObjectCopyLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== EMG REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `EMG Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
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

  /* ═══════ RENDER: ARRAY FIELD (musclesTested) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!Array.isArray(val) || val.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return val.map((item, arrIdx) => {
      const itemStr = String(item || '');
      if (!itemStr.trim()) return null;

      // Search filtering
      if (searchTerm.trim() && !phraseMatch) {
        const phrase = searchTerm.toLowerCase().trim();
        if (!itemStr.toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
      }

      const editKey = `${fn}.${arrIdx}-${idx}`;
      const localVal = localEdits[editKey] !== undefined ? localEdits[editKey] : itemStr;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];

      return (
        <div key={arrIdx}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(localVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(localVal)}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(localVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    });
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText2, marks); }}>{saving ? 'Saving...' : 'Save'}</button>
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

            /* Regular sentence row — with nested subtitle if labeled */
            return (
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; stageSentenceDraft(record, fn, idx, sid, fullText, marks); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">✎</span></div>
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

  /* ═══════ RENDER: DYNAMIC-KEY OBJECT (nerveConduction / needleExamination) ═══════
     Recursively renders an object whose keys/shapes vary per record:
       - string leaf  → editable row, saved via full dotted path
       - object       → nested subtitle + recurse
       - array        → indexed rows (string items editable; object items recurse)
     pathPrefix is the dotted field path from the record root (e.g. "nerveConduction.motorNCS.rightMedian"). */
  const renderDynamicValue = (record, idx, sid, pathPrefix, value, depth) => {
    // string / number leaf
    if (value === null || value === undefined || (typeof value !== 'object')) {
      const displayVal = fmtVal(value);
      if (!displayVal.trim()) return null;
      const editKey = `${pathPrefix}-${idx}`;
      const isEditing = editingField === editKey;
      const isModified = editedFields[editKey];
      const localVal = localEdits[editKey] !== undefined ? fmtVal(localEdits[editKey]) : displayVal;
      // Search filter at the leaf
      if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
        const phrase = searchTerm.toLowerCase().trim();
        const leafLabel = humanizeKey(pathPrefix.split('.').pop());
        if (!localVal.toLowerCase().includes(phrase) && !leafLabel.toLowerCase().includes(phrase)) return null;
      }
      return (
        <div key={pathPrefix}>
          <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(localVal); setSaveError(null); } }}>
            {isEditing ? (
              <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, pathPrefix, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="row-content"><span className="content-value">{highlightText(localVal)}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(localVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>
            )}
          </div>
          {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>
      );
    }

    // array
    if (Array.isArray(value)) {
      const rows = value.map((item, i) => {
        const itemPath = `${pathPrefix}.${i}`;
        if (item && typeof item === 'object') {
          // array-of-objects → labeled card with per-subfield rows
          const inner = Object.entries(item).map(([k, v]) => renderDynamicValue(record, idx, sid, `${itemPath}.${k}`, v, depth + 2)).filter(Boolean);
          if (inner.length === 0) return null;
          return (
            <div key={itemPath} className="rec-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(`${i + 1}.`)}</div>
              {inner}
            </div>
          );
        }
        return renderDynamicValue(record, idx, sid, itemPath, item, depth + 1);
      }).filter(Boolean);
      return rows.length > 0 ? rows : null;
    }

    // nested object → subtitle + recurse per key
    const inner = Object.entries(value).map(([k, v]) => {
      const childPath = `${pathPrefix}.${k}`;
      if (v && typeof v === 'object') {
        const sub = renderDynamicValue(record, idx, sid, childPath, v, depth + 1);
        if (!sub || (Array.isArray(sub) && sub.length === 0)) return null;
        return (
          <div key={childPath} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(humanizeKey(k))}</div>
            {sub}
          </div>
        );
      }
      const leaf = renderDynamicValue(record, idx, sid, childPath, v, depth + 1);
      if (!leaf) return null;
      return (
        <div key={childPath}>
          <div className="nested-subtitle">{highlightText(humanizeKey(k))}</div>
          {leaf}
        </div>
      );
    }).filter(Boolean);
    return inner.length > 0 ? inner : null;
  };

  const renderDynamicObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Object.keys(val).length === 0) return null;
    const rendered = renderDynamicValue(record, idx, sid, fn, val, 0);
    if (!rendered || (Array.isArray(rendered) && rendered.length === 0)) return null;
    return <div key={fn} className="rec-mini-card">{rendered}</div>;
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (DYNAMIC_OBJECT_FIELDS.includes(f)) return renderDynamicObjectField(record, f, idx, sid);
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
      <div className="emg-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">EMG Reports</h2></div>
        <div className="empty-state">No EMG reports available</div>
      </div>
    );
  }

  return (
    <div className="emg-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">EMG Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EmgReportsDocumentPDFTemplate document={pdfData} />} fileName="Emg_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search EMG reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`EMG Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'indication-section')}
            {renderSection(record, idx, 'muscles-tested')}
            {renderSection(record, idx, 'nerve-conduction')}
            {renderSection(record, idx, 'needle-examination')}
            {renderSection(record, idx, 'findings-section')}
            {renderSection(record, idx, 'interpretation-section')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmgReportsDocument;
