/**
 * AmniocentesisReportsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: amniocentesis_reports
 *
 * 4 Sections:
 *   1. assessment-info: assessmentDate, programType
 *   2. findings: findings
 *   3. goals-progress: goals, progress
 *   4. recommendations: recommendations, followUp
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AmniocentesisReportsDocumentPDFTemplate from '../pdf-templates/AmniocentesisReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './AmniocentesisReportsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'findings': 'Findings',
  'goals-progress': 'Goals & Progress',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  programType: 'Program Type',
  findings: 'Findings',
  goals: 'Goals',
  progress: 'Progress',
  recommendations: 'Recommendations',
  followUp: 'Follow-Up',
};

const SECTION_FIELDS = {
  'assessment-info': ['assessmentDate', 'programType'],
  'findings': ['findings'],
  'goals-progress': ['goals', 'progress'],
  'recommendations': ['recommendations', 'followUp'],
};

const DATE_FIELDS = ['assessmentDate'];
const STRING_FIELDS = ['programType', 'findings', 'goals', 'progress', 'recommendations', 'followUp'];
const COMMA_SPLIT_FIELDS = new Set(['findings', 'progress']);
const SEMICOLON_SEPARATOR = /;\s+/;

/* parseLabel: detect "Label: value" patterns (cap 80 chars to capture long medical sub-labels
   e.g. "Most recent amniotic fluid index assessment (January 15, 2026 - 28w3d)") */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* Strip trailing list/sentence punctuation from a display clause */
const STRIP = (s) => String(s == null ? '' : s).replace(/[;.\s]+$/, '').trim();

/* Paren-aware split on a single separator char. For comma, skip a comma sitting between two
   digits with no following space (thousands sep / "46,XX" karyotype / numeric ranges). */
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && !/\s/.test(text[i + 1] || '')) { cur += ch; continue; }
      const before = cur.trim();
      const after = text.slice(i + 1).trimStart();
      if (sep === ',' && /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}$/i.test(before) && /^\d{4}\b/.test(after)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};

/* Semicolons are explicit separators. Safe top-level commas are split only in fields inventoried
   as genuine clinical lists; credentials, color descriptors, dates, karyotypes, and parentheses stay intact. */
const splitClauses = (text, fieldName) => {
  if (!text || typeof text !== 'string') return { sep: null, items: [text || ''] };
  const semi = SEMICOLON_SEPARATOR.test(text) ? splitOnChar(text, ';') : [text];
  if (semi.length >= 2) return { sep: '; ', items: semi };
  const comma = splitOnChar(text, ',');
  if (COMMA_SPLIT_FIELDS.has(fieldName) && comma.length >= 2) return { sep: ', ', items: comma };
  return { sep: null, items: [text.trim()] };
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
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name, e.g. "findings") */
const DRAFT_KEY = 'amniocentesis_reportsPendingEdits';
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
const AmniocentesisReportsDocument = ({ document: docProp }) => {
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
      if (r?.amniocentesis_reports) return Array.isArray(r.amniocentesis_reports) ? r.amniocentesis_reports : [r.amniocentesis_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.amniocentesis_reports) return Array.isArray(dd.amniocentesis_reports) ? dd.amniocentesis_reports : [dd.amniocentesis_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
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
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    const timer = setTimeout(() => {
      setLocalEdits(prev => ({ ...nLocal, ...prev }));
      setPendingEdits(prev => ({ ...nPending, ...prev }));
      setEditedFields(prev => ({ ...nFields, ...prev }));
      setEditedSentences(prev => ({ ...nSentences, ...prev }));
    }, 0);
    return () => clearTimeout(timer);
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+|$)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    const arr = (sentences || []).map(s => String(s || '').replace(/[;.]+$/, '').trim()).filter(Boolean);
    return arr.map((s, i) => (i < arr.length - 1 ? s + '.' : s)).join(' ');
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

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid, idx = 0) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); })) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); });
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
      const rt = `Amniocentesis Report ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => { const s = typeof item === 'object' ? `${item.name || ''} ${item.value || ''}` : String(item); return s.toLowerCase().includes(phrase); }) : (typeof val === 'object' ? Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase)))) return true;
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
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
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    if (sid) setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a DRAFT for a string/sentence field (no DB write). localStorage keeps it across refresh.
  // sid lets us reset the section's approve button to yellow on re-edit. Returns nothing.
  const stageDraft = useCallback((record, fn, idx, sid, fullText, sentenceMarks, rebase) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => {
      let next;
      // Re-base existing clause badges after an index-shifting edit so a yellow/green badge never
      // drifts onto an untouched clause (delete shifts indices down; separator-add shifts them up).
      if (rebase && rebase.delta) {
        next = {};
        const { prefix, at, delta } = rebase;
        for (const [k, v] of Object.entries(prev)) {
          if (k.startsWith(prefix)) {
            const n = parseInt(k.slice(prefix.length), 10);
            if (!isNaN(n)) {
              if (n === at) continue;                         // edited/removed clause — reset below or dropped
              if (n > at) { next[`${prefix}${n + delta}`] = v; continue; }  // shift trailing clauses
            }
          }
          next[k] = v;
        }
      } else {
        next = { ...prev };
      }
      return { ...next, ...sentenceMarks };
    });
    if (sid) setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  // Build display "units" for a field: split into sentences (period), then each labeled value (or
  // unlabeled sentence) into clauses via splitClauses (semicolon-first, else comma >=3). Consecutive
  // UNLABELED sentences merge into ONE card. Each row carries its sentence+clause index for stable
  // per-clause editing.
  const buildUnits = useCallback((value, fieldName) => {
    const sentences = splitBySentence(String(value || ''));
    const units = [];
    sentences.forEach((sentence, sIdx) => {
      const p = parseLabel(sentence);
      const base = p.isLabeled ? p.value : sentence;
      const { sep, items } = splitClauses(base, fieldName);
      const rows = items.map((text, cIdx) => ({ text: STRIP(text), sIdx, cIdx, sep }));
      const last = units[units.length - 1];
      if (!p.isLabeled && last && !last.label) last.rows.push(...rows);
      else units.push({ label: p.isLabeled ? p.label : null, rows });
    });
    return units;
  }, [splitBySentence]);

  // Stage one clause edit as a DRAFT (no DB write). Reconstructs the sentence with its detected
  // separator (';' or ','), then the full field with '. ', preserving every other clause. A blank
  // edit deletes the clause; typing the separator splits into added clauses. Approve commits it.
  function saveClause(record, fn, idx, sid, sIdx, cIdx) {
    const id = safeId(record); if (!id) return;
    const cur = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(cur);
    const sentence = sentences[sIdx] || '';
    const p = parseLabel(sentence);
    const base = p.isLabeled ? p.value : sentence;
    const { sep, items } = splitClauses(base, fn);
    const origLen = items.length;
    const edited = editValue.trim();
    const sKeyBase = `${fn}-${idx}-s${sIdx}`;
    const marks = {};
    let isDelete = false;
    if (!edited || /^[;.,!?]+$/.test(edited)) {
      if (cIdx < items.length) items.splice(cIdx, 1);
      isDelete = true;
    } else {
      const sepChar = sep ? sep.trim()[0] : null;
      const subParts = (sepChar ? splitOnChar(edited, sepChar) : [edited]).map(s => s.replace(/[;.]+$/, '').trim()).filter(Boolean);
      if (subParts.length === 0) { if (cIdx < items.length) items.splice(cIdx, 1); isDelete = true; }
      else {
        items.splice(cIdx, 1, ...subParts);
        marks[`${sKeyBase}-c${cIdx}`] = 'edited';
        for (let e = 1; e < subParts.length; e++) marks[`${sKeyBase}-c${cIdx + e}`] = 'added';
      }
    }
    // A clause delete has no specific clause to badge → flag the field so the section's approve
    // button still appears (sectionHasEdits matches startsWith `${f}-${idx}`); no false row badge.
    if (isDelete) setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    const delta = items.length - origLen; // -1 on delete, +N-1 on a separator-add; 0 on a plain edit
    const newBase = items.join(sep || ' ');
    const rebuilt = p.isLabeled ? (newBase ? `${p.label}: ${newBase}` : '') : newBase;
    sentences[sIdx] = rebuilt;
    const fullText = reconstructFullText(sentences);
    stageDraft(record, fn, idx, sid, fullText, marks, { prefix: `${sKeyBase}-c`, at: cIdx, delta });
  }

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
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Staged edits for THIS record whose field belongs to THIS section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now (field, plus arrayIndex only when trailing segment is numeric)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/amniocentesis_reports/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/amniocentesis_reports/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts (for the committed fields) from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
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
  // Copy formatting mirrors the JSX units: labeled unit → "Label:" + indented numbered rows;
  // unlabeled unit → numbered rows. Per-unit numbering (matches the PDF).
  const formatFieldForCopy = useCallback((text, fieldName) => {
    const units = buildUnits(text, fieldName);
    const lines = [];
    units.forEach(u => {
      if (u.label) { lines.push(`${u.label}:`); u.rows.forEach((r, i) => lines.push(`  ${i + 1}. ${r.text}`)); }
      else u.rows.forEach((r, i) => lines.push(`${i + 1}. ${r.text}`));
    });
    return lines;
  }, [buildUnits]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      // Suppress label when it matches section title
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += showLabel ? `${label}\n${formatDate(val)}\n\n` : `${formatDate(val)}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        if (showLabel) text += `${label}\n`;
        formatFieldForCopy(fmtVal(val), f).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += showLabel ? `${label}\n${fmtVal(val)}\n\n` : `${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, formatFieldForCopy]);

  const copyAllText = useCallback(async () => {
    let text = '=== AMNIOCENTESIS REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Amniocentesis Report ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
        <div className="nested-mini-card regular-row-group">
        <div className="editable-leaf" data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={next => setEditValue(next || '')} />
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
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD — triple-nested (splitClauses: ; or ,) ═══════
     Field = rec-mini-card (label = nested-subtitle). Each sentence/labeled value becomes a
     nested-mini-card: a labeled value shows its label as a `nested-subtitle sub-label`; its clauses
     (split by ; or ,) are the rows. Consecutive unlabeled sentences merge into one card. */
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sectionTitle = SECTION_TITLES[sid] || '';
    const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const units = buildUnits(fmtVal(val), fn);
    const phrase = searchTerm.trim().toLowerCase();
    const fieldOrTitleMatch = !phrase || sectionTitleMatches(sid) || record._showAllSections || label.toLowerCase().includes(phrase);

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {units.map((unit, uIdx) => {
          const unitMatch = fieldOrTitleMatch || (unit.label && unit.label.toLowerCase().includes(phrase));
          const visibleRows = unit.rows.filter(r => !phrase || unitMatch || r.text.toLowerCase().includes(phrase));
          if (visibleRows.length === 0) return null;
          return (
            <div key={uIdx} className="nested-mini-card">
              {unit.label && <div className="nested-subtitle sub-label">{highlightText(unit.label)}</div>}
              {visibleRows.map(row => {
                const editKey = `${fn}-${idx}-s${row.sIdx}-c${row.cIdx}`;
                const isEditing = editingField === editKey;
                const badge = editedSentences[editKey];
                return (
                  <div key={editKey} className="editable-leaf" data-edit-field={fn}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(row.text); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveClause(record, fn, idx, sid, row.sIdx, row.cIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(row.text)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(row.text, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
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
            return renderSentenceEditableField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="amniocentesis-reports-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Amniocentesis Reports</h2></div>
        <div className="empty-state">No amniocentesis reports records available</div>
      </div>
    );
  }

  return (
    <div className="amniocentesis-reports-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Amniocentesis Reports</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AmniocentesisReportsDocumentPDFTemplate document={pdfData} />} fileName="Amniocentesis_Reports.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search amniocentesis reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Amniocentesis Report ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'assessment-info')}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'goals-progress')}
            {renderSection(record, idx, 'recommendations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AmniocentesisReportsDocument;
