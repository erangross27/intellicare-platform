/**
 * TotalWeightGainDocument.jsx
 * March 2026 — Complete template with inline editing, blue glow theme
 * Collection: total_weight_gain
 *
 * 3 Sections:
 *   1. weight-summary: amount, unit, timeframe, date, provider, facility
 *   2. clinical-assessment: findings, assessment
 *   3. management: plan, notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TotalWeightGainDocumentPDFTemplate from '../pdf-templates/TotalWeightGainDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './TotalWeightGainDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy All until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value = the FULL field value, as stored in localEdits) */
const DRAFT_KEY = 'totalWeightGainPendingEdits';
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
  'weight-summary': 'Weight Summary',
  'clinical-assessment': 'Clinical Assessment',
  'management': 'Management',
};

const FIELD_LABELS = {
  amount: 'Amount',
  unit: 'Unit',
  timeframe: 'Timeframe',
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  type: 'Type',
  status: 'Status',
};

const SECTION_FIELDS = {
  'weight-summary': ['amount', 'unit', 'timeframe', 'date', 'provider', 'facility'],
  'clinical-assessment': ['findings', 'assessment'],
  'management': ['plan', 'recommendations', 'notes'],
};

const NUMBER_FIELDS = [];
const BOOLEAN_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];
const STRING_FIELDS = ['amount', 'unit', 'timeframe', 'assessment', 'findings', 'plan', 'notes', 'provider', 'facility', 'type', 'status'];
const PERIOD_SPLIT_FIELDS = new Set(STRING_FIELDS);

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

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

const stepFor = value => {
  const match = String(value).trim().match(/\.(\d+)/);
  return match ? Math.pow(10, -match[1].length) : 1;
};

const CLINICAL_UNITS = new Set(['lb', 'lbs', 'kg', 'week', 'weeks', 'bmi']);
const editableNumberTokens = value => {
  const source = String(value ?? '');
  const tokens = [];
  const matcher = /\d+(?:\.\d+)?/g;
  let cursor = 0;
  let match;
  let editableIndex = 0;
  while ((match = matcher.exec(source))) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index), editable: false });
    const start = match.index;
    const end = start + match[0].length;
    const previousCharacter = source[start - 1] || '';
    const nextCharacter = source[end] || '';
    const adjacentUnit = source.slice(end).match(/^([A-Za-z]+)/)?.[1]?.toLowerCase() || '';
    const editable = previousCharacter !== '#'
      && previousCharacter !== '/'
      && !/[A-Za-z0-9]/.test(previousCharacter)
      && (!/[A-Za-z]/.test(nextCharacter) || CLINICAL_UNITS.has(adjacentUnit));
    tokens.push({ text: match[0], editable, editableIndex: editable ? editableIndex++ : null });
    cursor = end;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor), editable: false });
  return tokens;
};

const replaceEditableNumber = (value, targetIndex, replacement) => editableNumberTokens(value)
  .map(token => token.editable && token.editableIndex === targetIndex ? String(replacement) : token.text)
  .join('');

const NumberTextEditor = ({ value, onChange }) => (
  <div className="multi-number-edit-row">
    {editableNumberTokens(value).map((token, tokenIndex) => {
      if (!token.editable) return <span className="number-edit-unit fixed-number-text" key={`${tokenIndex}-${token.text}`}>{token.text}</span>;
      const change = direction => {
        const step = stepFor(token.text);
        const next = Number((Number(token.text || 0) + direction * step).toFixed(10));
        onChange(replaceEditableNumber(value, token.editableIndex, next));
      };
      return (
        <div className="multi-number-control" key={`${tokenIndex}-${token.editableIndex}`}>
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(-1); }}>&minus;</button>
          <input type="text" inputMode="decimal" className="edit-number" value={token.text} onChange={event => onChange(replaceEditableNumber(value, token.editableIndex, event.target.value))} onClick={event => event.stopPropagation()} />
          <button type="button" className="num-step" onClick={event => { event.stopPropagation(); change(1); }}>+</button>
        </div>
      );
    })}
  </div>
);

const hasEditableNumber = value => editableNumberTokens(value).some(token => token.editable);

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const parts = [];
  let current = '';
  let depth = 0;
  const push = delimiter => { if (current.trim()) parts.push({ text: current.trim(), delimiter }); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\d$/.test(current);
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeSemicolon) {
      let delimiter = character;
      while (/\s/.test(source[index + 1] || '')) { delimiter += source[index + 1]; index += 1; }
      push(delimiter);
    } else current += character;
  }
  push('');
  return parts.length ? parts : [{ text: source, delimiter: '' }];
};

const reconstructClauses = parts => parts.map(part => `${part.text}${part.delimiter}`).join('');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const TotalWeightGainDocument = ({ document: docProp }) => {
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
  // editKeys (`${field}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.total_weight_gain) return Array.isArray(r.total_weight_gain) ? r.total_weight_gain : [r.total_weight_gain];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.total_weight_gain) return Array.isArray(dd.total_weight_gain) ? dd.total_weight_gain : [dd.total_weight_gain]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
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

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?:(?<!\b[A-Z])(?<!\d)\.\s+|;\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
        if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      const rt = `Total Weight Gain ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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

  /* ═══════ EDIT HANDLERS ═══════ */
  // stageDraft = stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  // `fullValue` is the FULL field value (string / array) — the same value the DB will receive on approve.
  const stageDraft = useCallback((record, fn, idx, fullValue) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullValue;
    writeDrafts(store);
  }, [safeId]);

  // Save = stage a DRAFT (no DB write). Markers set exactly as before; approve commits to MongoDB.
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, fn, idx, saveVal);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

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
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
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

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // Pending edits for this record+section are keyed `${field}-${idx}`; value is the FULL field value.
    const toCommit = fields.map(f => `${f}-${idx}`).filter(k => pendingEdits[k] && localEdits[k] !== undefined);
    try {
      for (const editKey of toCommit) {
        const f = editKey.slice(0, -`-${idx}`.length);
        const resp = await secureApiClient.put(`/api/edit/total_weight_gain/${id}/edit`, { field: f, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/total_weight_gain/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, pendingEdits, localEdits]);

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

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n1. ${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(Boolean) : [];
        if (items.length > 0) {
          text += `${label}\n`;
          let number = 1;
          items.forEach(item => {
            const parsed = parseLabel(String(item));
            if (parsed.isLabeled) text += `${parsed.label}\n`;
            text += `${number++}. ${parsed.isLabeled ? parsed.value : item}\n`;
          });
          text += '\n';
        }
      } else {
        const strVal = fmtVal(val);
        const clauses = splitEditableClauses(strVal, f);
        text += `${label}\n`;
        let number = 1;
        clauses.forEach(({ text: clause }) => {
          const parsed = parseLabel(clause);
          const items = parsed.isLabeled ? splitByComma(parsed.value) : [clause];
          if (parsed.isLabeled) text += `${parsed.label}\n`;
          items.forEach(item => { text += `${number++}. ${item}\n`; });
        });
        text += '\n';
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== TOTAL WEIGHT GAIN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Total Weight Gain ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card nested-mini-card" data-edit-field={fn}>
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onChange={setEditValue} />
              <div className="edit-actions">
                <button className="save-btn" onClick={event => { event.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>Save</button>
                <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(formatDate(val))}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(`${label}\n${formatDate(val)}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing, whole-array persistence) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);
          const parsed = parseLabel(itemStr);
          const displayValue = parsed.isLabeled ? parsed.value : itemStr;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          const row = (
            <div data-edit-field={fn}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayValue); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    {hasEditableNumber(displayValue)
                      ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                      : <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const currentArr = [...items]; currentArr[itemIdx] = parsed.isLabeled ? `${parsed.label}: ${editValue}` : editValue; stageDraft(record, fn, idx, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(parsed.isLabeled ? `${parsed.label}\n${parsed.value}` : itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
          if (!parsed.isLabeled) return <React.Fragment key={itemIdx}>{row}</React.Fragment>;
          return (
            <div key={itemIdx} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(parsed.label)}</div>
              {row}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with explicit delimiter decisions ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const clauses = splitEditableClauses(strVal, fn);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {!sameAsTitle(label, sid) && <div className="nested-subtitle">{highlightText(label)}</div>}
        {clauses.map((clause, clauseIndex) => {
          const parsed = parseLabel(clause.text);
          const commaItems = parsed.isLabeled ? splitByComma(parsed.value) : [clause.text];
          const rows = commaItems.map((item, itemIndex) => {
            const editKey = `${fn}-${idx}-s${clauseIndex}${parsed.isLabeled ? `-c${itemIndex}` : ''}`;
            const isEditing = editingField === editKey;
            const isModified = editedSentences[editKey];
            const saveValue = () => {
              const nextClauses = splitEditableClauses(String(getFieldValue(record, fn, idx) || ''), fn);
              const currentParsed = parseLabel(nextClauses[clauseIndex]?.text || '');
              if (currentParsed.isLabeled) {
                const nextItems = splitByComma(currentParsed.value);
                nextItems[itemIndex] = editValue;
                nextClauses[clauseIndex].text = `${currentParsed.label}: ${nextItems.join(', ')}`;
              } else nextClauses[clauseIndex].text = editValue;
              stageDraft(record, fn, idx, reconstructClauses(nextClauses));
              setEditedSentences(prev => ({ ...prev, [editKey]: 'edited' }));
              setApprovedSections(prev => { const next = { ...prev }; delete next[`${sid}-${idx}`]; return next; });
              setEditingField(null); setEditValue('');
            };
            return (
              <div key={itemIndex} data-edit-field={fn}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      {hasEditableNumber(item)
                        ? <NumberTextEditor value={editValue} onChange={setEditValue} />
                        : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus onKeyDown={event => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />}
                      <div className="edit-actions">
                        <button className="save-btn" onClick={event => { event.stopPropagation(); saveValue(); }}>Save</button>
                        <button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyItem(item, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          });
          if (!parsed.isLabeled) return <React.Fragment key={clauseIndex}>{rows}</React.Fragment>;
          return (
            <div key={clauseIndex} className="rec-mini-card nested-mini-card" style={{ marginTop: 8 }}>
              <div className="nested-subtitle">{highlightText(parsed.label)}</div>
              {rows}
            </div>
          );
        })}
      </div>
    );
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
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
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
      <div className="total-weight-gain-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Total Weight Gain</h2></div>
        <div className="empty-state">No total weight gain records available</div>
      </div>
    );
  }

  return (
    <div className="total-weight-gain-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Total Weight Gain</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<TotalWeightGainDocumentPDFTemplate document={pdfData} />} fileName="Total_Weight_Gain.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search total weight gain records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Total Weight Gain ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'weight-summary')}
            {renderSection(record, idx, 'clinical-assessment')}
            {renderSection(record, idx, 'management')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TotalWeightGainDocument;
