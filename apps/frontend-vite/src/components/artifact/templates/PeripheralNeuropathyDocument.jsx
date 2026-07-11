/**
 * PeripheralNeuropathyDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: peripheral_neuropathy
 *
 * 9 Sections:
 *   1. clinical-info: date, provider, facility, status
 *   2. characteristics: pattern, distribution, etiology, neuropathicPainScale
 *   3. sensory-symptoms: sensorySymptoms
 *   4. motor-symptoms: motorSymptoms
 *   5. autonomic-symptoms: autonomicSymptoms
 *   6. treatment: treatment (array of objects: medication, dose)
 *   7. findings-assessment: findings, assessment
 *   8. results: results (dynamic-key object, recursively rendered, typed leaves)
 *   9. plan-recommendations: plan, recommendations
 *  10. notes: notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PeripheralNeuropathyDocumentPDFTemplate from '../pdf-templates/PeripheralNeuropathyDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './PeripheralNeuropathyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [localEditsKey]: { value, payloads: [{ field, value, arrayIndex? }] } } }
   - value     = the merged field value stored into localEdits (used to re-render the row)
   - payloads  = the exact DB writes to replay on Approve (mirrors each save site's old PUT body) */
const DRAFT_KEY = 'peripheral_neuropathyPendingEdits';
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
  'clinical-info': 'Clinical Information',
  'characteristics': 'Neuropathy Characteristics',
  'sensory-symptoms': 'Sensory Symptoms',
  'motor-symptoms': 'Motor Symptoms',
  'autonomic-symptoms': 'Autonomic Symptoms',
  'treatment': 'Treatment',
  'findings-assessment': 'Findings & Assessment',
  'results': 'Results',
  'plan-recommendations': 'Plan & Recommendations',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  pattern: 'Pattern',
  distribution: 'Distribution',
  etiology: 'Etiology',
  neuropathicPainScale: 'Neuropathic Pain Scale',
  ncvEmgFindings: 'NCV/EMG Findings',
  sensorySymptoms: 'Sensory Symptoms',
  motorSymptoms: 'Motor Symptoms',
  autonomicSymptoms: 'Autonomic Symptoms',
  treatment: 'Treatment',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'clinical-info': ['date', 'provider', 'facility', 'status'],
  'characteristics': ['pattern', 'distribution', 'etiology', 'neuropathicPainScale', 'ncvEmgFindings'],
  'sensory-symptoms': ['sensorySymptoms'],
  'motor-symptoms': ['motorSymptoms'],
  'autonomic-symptoms': ['autonomicSymptoms'],
  'treatment': ['treatment'],
  'findings-assessment': ['findings', 'assessment'],
  'results': ['results'],
  'plan-recommendations': ['plan', 'recommendations'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['sensorySymptoms', 'motorSymptoms', 'autonomicSymptoms', 'recommendations'];
const STRING_FIELDS = ['provider', 'facility', 'status', 'pattern', 'distribution', 'etiology', 'neuropathicPainScale', 'findings', 'assessment', 'plan', 'notes'];

/* humanizeKey: camelCase / snake_case object key -> Title Case (keeps acronym runs, e.g. motorNCS -> Motor NCS) */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* parseLabel: detect "Label: value" patterns (CLAUSE_OPENER guard: a conditional/subordinate clause
   colon is grammatical, NOT a data Label:Value). */
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

/* Epoch 1970-01-01 is a "not set" sentinel -> treat as empty (skip the date row). */
const isEpochSentinel = (v) => { try { const d = new Date(v?.$date || v); return !isNaN(d.getTime()) && d.getFullYear() === 1970; } catch { return false; } };

/* ======= COMPONENT ======= */
const PeripheralNeuropathyDocument = ({ document: docProp }) => {
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
  // editKeys (localEdits keys, "${field}-${idx}") that are staged drafts (saved locally, NOT yet
  // committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  // Per-record DB writes to replay on Approve. Shape: { [recordId]: [{ field, value, arrayIndex? }] }.
  // Held in a ref (not render state) + mirrored into the localStorage draft store so it survives refresh.
  const pendingPayloadsRef = useRef({});
  const containerRef = useRef(null);

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.peripheral_neuropathy) return Array.isArray(r.peripheral_neuropathy) ? r.peripheral_neuropathy : [r.peripheral_neuropathy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.peripheral_neuropathy) return Array.isArray(dd.peripheral_neuropathy) ? dd.peripheral_neuropathy : [dd.peripheral_neuropathy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ======= UTILS ======= */
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

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Stage a draft: store the merged render value in localEdits + remember the DB payload to replay on
  // Approve, and persist both to localStorage. NO backend call here. (Used by every save site.)
  const stageDraft = useCallback((record, localKey, mergedValue, payload) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [localKey]: mergedValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    // accumulate payloads for this record (replace any prior payload for the same field+arrayIndex)
    const list = pendingPayloadsRef.current[id] ? [...pendingPayloadsRef.current[id]] : [];
    const matchIdx = list.findIndex(p => p.field === payload.field && p.arrayIndex === payload.arrayIndex);
    if (matchIdx === -1) list.push(payload); else list[matchIdx] = payload;
    pendingPayloadsRef.current[id] = list;
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][localKey] = { value: mergedValue, payloads: list };
    writeDrafts(store);
  }, [safeId]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      pendingPayloadsRef.current[id] = [];
      Object.entries(recDrafts).forEach(([localKey, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        // localKey is "${field}-${oldIdx}" — remap the trailing index to THIS render index
        const dashIdx = localKey.lastIndexOf('-');
        const fieldPart = dashIdx === -1 ? localKey : localKey.slice(0, dashIdx);
        const remapKey = `${fieldPart}-${idx}`;
        nLocal[remapKey] = entry.value;
        nPending[remapKey] = true;
        nFields[remapKey] = 'edited';
        if (Array.isArray(entry.payloads)) {
          entry.payloads.forEach(p => pendingPayloadsRef.current[id].push(p));
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, safeId]);

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
        if (Array.isArray(val)) { if (val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Peripheral Neuropathy ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(typeof item === 'object' ? JSON.stringify(item) : item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    // Stage a DRAFT only — committed to the DB on Approve (handleApproveSection).
    stageDraft(record, `${fn}-${idx}`, saveVal, { field: fn, value: saveVal });
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
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
      // Stage a DRAFT only — committed to the DB on Approve.
      stageDraft(record, `${fn}-${idx}`, fullText, { field: fn, value: fullText });
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    // Stage a DRAFT only — committed to the DB on Approve.
    stageDraft(record, `${fn}-${idx}`, fullText, { field: fn, value: fullText });
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // localEdits keys staged-pending for THIS section's fields (key = "${field}-${idx}")
    const sectionKeys = fields.map(f => `${f}-${idx}`).filter(k => pendingEdits[k]);
    setSaving(true); setSaveError(null);
    try {
      // Replay each staged DB write recorded at save time (field, value, optional arrayIndex).
      const allPayloads = pendingPayloadsRef.current[id] || [];
      // a payload belongs to this section when its base field is in the section's field list
      const toCommit = allPayloads.filter(p => fields.includes(String(p.field).split('.')[0]));
      for (const p of toCommit) {
        const body = { field: p.field, value: p.value };
        if (typeof p.arrayIndex === 'number') body.arrayIndex = p.arrayIndex;
        const resp = await secureApiClient.put(`/api/edit/peripheral_neuropathy/${id}/edit`, body);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/peripheral_neuropathy/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; sectionKeys.forEach(k => delete n[k]); return n; });
      // Drop the committed payloads + any now-empty draft entry from this record's store
      pendingPayloadsRef.current[id] = allPayloads.filter(p => !fields.includes(String(p.field).split('.')[0]));
      const store = readDrafts();
      if (store[id]) {
        sectionKeys.forEach(k => { delete store[id][k]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, pendingEdits]);

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
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      // Single-name gate: when a field label equals its section title, suppress the label head.
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${'='.repeat(40)}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        body += `${head}${items.map((item, i) => `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n')}\n\n`;
      } else if (f === 'treatment') {
        const items = Array.isArray(val) ? val : [val];
        body += head;
        items.forEach((t, i) => {
          body += `Treatment ${i + 1}\n`;
          Object.entries(t || {}).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
            body += `${humanizeKey(k)}\n1. ${typeof v === 'object' ? JSON.stringify(v) : v}\n`;
          });
        });
        body += '\n';
      } else if (f === 'ncvEmgFindings' && typeof val === 'object' && !Array.isArray(val)) {
        const entries = Object.entries(val).filter(([, v]) => hasVal(v));
        if (entries.length) {
          body += head;
          entries.forEach(([k, v]) => { body += `${humanizeKey(k)}\n1. ${v}\n`; });
          body += '\n';
        }
      } else if (f === 'results' && typeof val === 'object' && !Array.isArray(val)) {
        const lines = [];
        const walk = (obj, indent) => {
          Object.entries(obj).forEach(([k, v]) => {
            if (!hasVal(v)) return;
            const pad = '  '.repeat(indent);
            if (v && typeof v === 'object' && !Array.isArray(v)) { lines.push(`${pad}${humanizeKey(k)}`); walk(v, indent + 1); }
            else if (Array.isArray(v)) { lines.push(`${pad}${humanizeKey(k)}`); v.forEach((item, i) => { if (hasVal(item)) lines.push(`${pad}  ${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`); }); }
            else { lines.push(`${pad}${humanizeKey(k)}`); lines.push(`${pad}  1. ${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}`); }
          });
        };
        walk(val, 0);
        if (lines.length) body += `${head}${lines.join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) {
          body += head;
          formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${head}1. ${strVal}\n\n`;
        }
      } else {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${'='.repeat(40)}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PERIPHERAL NEUROPATHY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Peripheral Neuropathy ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: DATE FIELD ======= */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isEpochSentinel(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
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

  /* ======= RENDER: ARRAY FIELD (per-item editing with dot-path keys) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
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
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, `${fn}-${idx}`, currentArr, { field: fn, value: editValue, arrayIndex: itemIdx }); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: TREATMENT ARRAY (array of objects — generic over each item's own keys,
     e.g. {type, details} OR {medication, dose}; every key rendered stacked as sub-label + value,
     never side-by-side, so no data is dropped when the shape drifts) ======= */
  const renderTreatmentField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((t, tIdx) => {
          const keys = (t && typeof t === 'object' && !Array.isArray(t)) ? Object.keys(t).filter(k => hasVal(t[k])) : [];
          if (keys.length === 0) return null;

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const anyMatch = label.toLowerCase().includes(phrase) || phrase.includes(label.toLowerCase()) || keys.some(k => String(t[k]).toLowerCase().includes(phrase) || humanizeKey(k).toLowerCase().includes(phrase));
            if (!anyMatch) return null;
          }

          return (
            <div key={tIdx} className="treatment-group-wrapper">
              <div className="treatment-group-header">{highlightText(`Treatment ${tIdx + 1}`)}</div>
              {keys.map(k => {
                const kKey = `${fn}.${tIdx}.${k}-${idx}`;
                const kEditing = editingField === kKey;
                const kModified = editedFields[kKey];
                const kVal = String(t[k]);
                return (
                  <div key={k}>
                    <div className="nested-subtitle" style={{ marginTop: 6 }}>{highlightText(humanizeKey(k))}</div>
                    <div className={`numbered-row ${kModified ? 'modified' : ''} editable-row`} onClick={() => { if (!kEditing) { setEditingField(kKey); setEditValue(kVal); setSaveError(null); } }}>
                      {kEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[tIdx] = { ...currentArr[tIdx], [k]: editValue }; stageDraft(record, `${fn}-${idx}`, currentArr, { field: `treatment.${tIdx}.${k}`, value: editValue }); setEditedFields(prev => ({ ...prev, [kKey]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(kVal)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[kKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(k)}\n${kVal}`, kKey); }}>{copiedItems[kKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {kModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: OBJECT FIELD (e.g. ncvEmgFindings — labeled sub-fields) ======= */
  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object') {
      if (hasVal(val)) return renderStringField(record, fn, idx, sid);
      return null;
    }
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v], i) => {
          const subKey = `${fn}.${k}-${idx}`;
          const subVal = String(v);
          return (
            <div key={i}>
              <div className="nested-subtitle" style={{ marginTop: 6 }}>{highlightText(humanizeKey(k))}</div>
              <div className="numbered-row">
                <div className="row-content"><span className="content-value">{highlightText(subVal)}</span></div>
                <button className={`copy-btn ${copiedItems[subKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(k)}\n${subVal}`, subKey); }}>{copiedItems[subKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: RESULTS (dynamic-key object, recursive, typed leaves) ======= */
  const subLabelize = (k) => String(k).replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase()).trim();

  const renderResultsLeaf = (record, idx, sid, path, key, value, depth) => {
    const editKey = `${path}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const label = subLabelize(key);
    const isNumber = typeof value === 'number';
    const isBoolean = typeof value === 'boolean';
    const displayVal = isBoolean ? (value ? 'Yes' : 'No') : String(value);

    /* search filter at leaf level */
    if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
      const phrase = searchTerm.toLowerCase().trim();
      if (!label.toLowerCase().includes(phrase) && !phrase.includes(label.toLowerCase()) && !displayVal.toLowerCase().includes(phrase)) return null;
    }

    const persistLeaf = (saveVal) => {
      const id = safeId(record); if (!id) return;
      setSaveError(null);
      const base = (typeof getFieldValue(record, 'results', idx) === 'object' && getFieldValue(record, 'results', idx)) ? JSON.parse(JSON.stringify(getFieldValue(record, 'results', idx))) : {};
      // set nested path (path = "results.a.b") into base clone
      const parts = path.split('.').slice(1);
      let cur = base;
      for (let i = 0; i < parts.length - 1; i++) { if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = saveVal;
      // Stage a DRAFT only — committed to the DB on Approve (payload mirrors the old per-leaf PUT).
      stageDraft(record, `results-${idx}`, base, { field: path, value: saveVal });
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
    };

    return (
      <div key={path}>
        <div className="nested-subtitle" style={{ marginTop: 6, marginLeft: depth * 8 }}>{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} style={{ marginLeft: depth * 8 }} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(isBoolean ? (value ? 'true' : 'false') : String(value)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBoolean ? (
                <BlueSelect value={editValue === 'true' || editValue === 'Yes' ? 'Yes' : 'No'} options={['Yes', 'No']} onChange={v => setEditValue(v === 'Yes' ? 'true' : 'false')} />
              ) : isNumber ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) - 1))} disabled={saving}>&#8722;</button>
                  <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } persistLeaf(n); } }} />
                  <button type="button" className="num-step" onClick={() => setEditValue(String((parseFloat(editValue) || 0) + 1))} disabled={saving}>+</button>
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let saveVal;
                  if (isBoolean) { saveVal = editValue === 'true'; }
                  else if (isNumber) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } saveVal = n; }
                  else { saveVal = editValue; }
                  persistLeaf(saveVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
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

  const renderResultsObject = (record, idx, sid, obj, path, depth) => {
    const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
    return entries.map(([k, v]) => {
      const childPath = `${path}.${k}`;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const inner = renderResultsObject(record, idx, sid, v, childPath, depth + 1);
        if (!inner || inner.filter(Boolean).length === 0) return null;
        return (
          <div key={childPath} className="rec-mini-card" style={depth > 0 ? { marginLeft: depth * 8 } : undefined}>
            <div className="nested-subtitle">{highlightText(subLabelize(k))}</div>
            {inner}
          </div>
        );
      }
      if (Array.isArray(v)) {
        if (v.filter(item => hasVal(item)).length === 0) return null;
        return (
          <div key={childPath} className="rec-mini-card" style={depth > 0 ? { marginLeft: depth * 8 } : undefined}>
            <div className="nested-subtitle">{highlightText(subLabelize(k))}</div>
            {v.map((item, i) => renderResultsLeaf(record, idx, sid, `${childPath}.${i}`, `${subLabelize(k)} ${i + 1}`, typeof item === 'object' ? JSON.stringify(item) : item, depth + 1))}
          </div>
        );
      }
      return renderResultsLeaf(record, idx, sid, childPath, k, v, depth);
    });
  };

  const renderResultsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      if (hasVal(val)) return renderStringField(record, fn, idx, sid);
      return null;
    }
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rendered = renderResultsObject(record, idx, sid, val, fn, 0);
    if (!rendered || rendered.filter(Boolean).length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {rendered}
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageDraft(record, `${fn}-${idx}`, fullText2, { field: fn, value: fullText2 }); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, `${fn}-${idx}`, fullText, { field: fn, value: fullText }); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
            if (f === 'treatment') return renderTreatmentField(record, f, idx, sid);
            if (f === 'ncvEmgFindings') return renderObjectField(record, f, idx, sid);
            if (f === 'results') return renderResultsField(record, f, idx, sid);
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
      <div className="peripheral-neuropathy-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Peripheral Neuropathy</h2></div>
        <div className="empty-state">No peripheral neuropathy records available</div>
      </div>
    );
  }

  return (
    <div className="peripheral-neuropathy-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Peripheral Neuropathy</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PeripheralNeuropathyDocumentPDFTemplate document={pdfData} />} fileName="Peripheral_Neuropathy.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search peripheral neuropathy records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Peripheral Neuropathy ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'clinical-info')}
            {renderSection(record, idx, 'characteristics')}
            {renderSection(record, idx, 'sensory-symptoms')}
            {renderSection(record, idx, 'motor-symptoms')}
            {renderSection(record, idx, 'autonomic-symptoms')}
            {renderSection(record, idx, 'treatment')}
            {renderSection(record, idx, 'findings-assessment')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'plan-recommendations')}
            {renderSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeripheralNeuropathyDocument;
