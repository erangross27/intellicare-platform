/**
 * ClinicalScoresDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: clinical_scores
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ClinicalScoresDocumentPDFTemplate from '../pdf-templates/ClinicalScoresDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ClinicalScoresDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the trailing "-<idx>") */
const DRAFT_KEY = 'clinical_scoresPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  scoreType: 'Score Type',
  providerInfo: 'Provider Information',
  standardScores: 'Standard Clinical Scores',
  objectScores: 'Risk & Severity Scores',
  otherScores: 'Clinical Scores & Biomarkers',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', findings: 'Findings', status: 'Status', type: 'Score Type',
  recommendations: 'Recommendations', results: 'Results',
  TIMI: 'TIMI', GRACE: 'GRACE', HEART: 'HEART', CURB65: 'CURB-65', PESI: 'PESI', MELD: 'MELD',
  ChildPugh: 'Child-Pugh', eGFR: 'eGFR', CKDStage: 'CKD Stage', PHQ9: 'PHQ-9', GAD7: 'GAD-7',
  MMSE: 'MMSE', painScale: 'Pain Scale', ECOG: 'ECOG', Karnofsky: 'Karnofsky', MOCA: 'MoCA',
  CHA2DS2VASc: 'CHA2DS2-VASc', HASBLED: 'HAS-BLED', ASA: 'ASA', STOPBANG: 'STOP-BANG',
  Apfel: 'Apfel', RCRI: 'RCRI', NSQIP: 'NSQIP',
};

const SECTION_FIELDS = {
  scoreType: ['type'],
  providerInfo: ['provider', 'facility'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  notes: ['notes', 'status'],
};

const STANDARD_SCORE_FIELDS = ['TIMI', 'GRACE', 'HEART', 'CURB65', 'PESI', 'MELD', 'ChildPugh', 'eGFR', 'CKDStage', 'PHQ9', 'GAD7', 'MMSE', 'painScale', 'ECOG', 'Karnofsky', 'MOCA'];
const NUMERIC_SCORE_FIELDS = ['TIMI', 'GRACE', 'HEART', 'CURB65', 'PESI', 'MELD', 'eGFR', 'PHQ9', 'GAD7', 'MMSE', 'painScale', 'ECOG', 'Karnofsky', 'MOCA'];
const OBJECT_SCORE_FIELDS = ['CHA2DS2VASc', 'HASBLED', 'ASA', 'STOPBANG', 'Apfel', 'RCRI', 'NSQIP'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
// status is a fixed-choice enum; unmatched current value kept as an extra option.
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const KEY_OVERRIDES = { chf: 'CHF', cad: 'CAD', tia: 'TIA', bmi: 'BMI', osa: 'OSA', inr: 'INR', gfr: 'GFR', ecog: 'ECOG', asa: 'ASA', rcri: 'RCRI', nsqip: 'NSQIP', meld: 'MELD', timi: 'TIMI' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const lk = String(key).toLowerCase(); if (KEY_OVERRIDES[lk]) return KEY_OVERRIDES[lk]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
// Guarded comma split (paren-aware; "and"/"or" stays connected; no-space commas like "18,000" kept).
// Used only when it yields >= 3 parts — a genuine list (Rule #73).
const splitByComma = (text) => {
  const s = String(text || ''); const parts = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0 && s[i + 1] === ' ') { parts.push(cur.trim()); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  const merged = [];
  parts.forEach(p => { if (/^(and|or)\b/i.test(p) && merged.length) merged[merged.length - 1] += ', ' + p; else merged.push(p); });
  return merged;
};

const ClinicalScoresDocument = ({ document: docProp }) => {
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
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.clinical_scores) return Array.isArray(r.clinical_scores) ? r.clinical_scores : [r.clinical_scores];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_scores) return Array.isArray(dd.clinical_scores) ? dd.clinical_scores : [dd.clinical_scores]; return [dd]; }
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
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
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
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
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

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Clinical Scores ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const [k, v] of Object.entries(FIELD_LABELS)) { if (v.toLowerCase().includes(phrase) || phrase.includes(v.toLowerCase())) return true; }
      if (contentMatches(record.provider) || contentMatches(record.facility) || contentMatches(record.assessment) || contentMatches(record.plan) || contentMatches(record.notes) || contentMatches(record.findings)) return true;
      for (const f of STANDARD_SCORE_FIELDS) { if (hasVal(record[f]) && contentMatches(fmtVal(record[f]))) return true; }
      if (record.other && typeof record.other === 'object') {
        for (const [key, obj] of Object.entries(record.other)) {
          if (contentMatches(key)) return true;
          if (typeof obj === 'object') { for (const v of Object.values(obj)) { if (contentMatches(fmtVal(v))) return true; } }
        }
      }
      return false;
    });
  }, [records, searchTerm, contentMatches, hasVal, fmtVal]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Save = stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fieldPart, idx, value, sentenceMarkerIdx) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    if (typeof sentenceMarkerIdx === 'number') {
      setEditedSentences(prev => ({ ...prev, [`${fieldPart}-${idx}-s${sentenceMarkerIdx}`]: 'edited' }));
    }
    // Re-edit after approval → drop the approved flag for any section this field belongs to (button → yellow).
    setApprovedSections(prev => {
      const next = { ...prev }; let changed = false;
      Object.keys(next).forEach(k => { if (k.endsWith(`-${idx}`)) { delete next[k]; changed = true; } });
      return changed ? next : prev;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  const handleSaveDotPath = useCallback((record, dotPath, idx) => {
    if (!safeId(record)) return;
    stageDraft(record, dotPath, idx, editValue);
  }, [editValue, safeId, stageDraft]);

  const handleSaveNumber = useCallback((record, dotPath, idx) => {
    if (!safeId(record)) return;
    const num = parseFloat(editValue);
    if (editValue.trim() !== '' && isNaN(num)) { console.warn('[ClinicalScores] Invalid number, not saving:', editValue); return; }
    const valueToSave = editValue.trim() === '' ? '' : num;
    stageDraft(record, dotPath, idx, valueToSave);
  }, [editValue, safeId, stageDraft]);

  const handleSaveField = useCallback((record, fn, idx) => {
    if (!safeId(record)) return;
    stageDraft(record, fn, idx, editValue);
  }, [editValue, safeId, stageDraft]);

  // Save one sentence: splice it back into the full text, then stage as a DRAFT (no DB write).
  // localStorage keeps it across refresh; Pending Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageFullText = (fullText) => {
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      setApprovedSections(prev => {
        const next = { ...prev }; let changed = false;
        Object.keys(next).forEach(k => { if (k.endsWith(`-${idx}`)) { delete next[k]; changed = true; } });
        return changed ? next : prev;
      });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageFullText(fullText);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageFullText(fullText);
    const originalSentence = sentences[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
  }

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const hasFieldEdits = fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
    if (hasFieldEdits) return true;
    if (sid === 'otherScores') return Object.keys(editedFields).some(k => k.startsWith('other.') && k.endsWith(`-${idx}`));
    if (sid === 'standardScores') return STANDARD_SCORE_FIELDS.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)));
    return false;
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section/record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const fieldPartInSection = useCallback((fieldPart, sid) => {
    if (sid === 'otherScores') return fieldPart.startsWith('other.');
    if (sid === 'standardScores') return STANDARD_SCORE_FIELDS.includes(fieldPart);
    const fields = SECTION_FIELDS[sid] || [];
    return fields.includes(fieldPart);
  }, []);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fieldPartInSection(k.slice(0, -suffix.length), sid));
      // Persist each staged field to the DB now (field, or field+arrayIndex when the last dot-segment is numeric)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.arrayIndex = parseInt(tail, 10); }
        await secureApiClient.put(`/api/edit/clinical_scores/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/clinical_scores/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[id]) delete store[id][fp]; }); if (store[id] && Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => {
        const n = { ...prev };
        if (sid === 'otherScores') { Object.keys(n).forEach(k => { if (k.startsWith('other.') && k.endsWith(`-${idx}`)) delete n[k]; }); }
        else if (sid === 'standardScores') { STANDARD_SCORE_FIELDS.forEach(f => { Object.keys(n).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); }
        else { (SECTION_FIELDS[sid] || []).forEach(f => { Object.keys(n).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); }
        return n;
      });
      setEditedSentences(prev => {
        const n = { ...prev };
        (SECTION_FIELDS[sid] || []).forEach(f => { Object.keys(n).forEach(k => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
    } catch (err) { console.error('[ClinicalScores] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits, fieldPartInSection]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Object → per-leaf "HumanKey\n----\nnumbered rows" (never side-by-side "key: value"); arrays numbered.
  const emitObjectCopy = useCallback(function emit(obj) {
    let t = '';
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (!hasVal(v)) return;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) { t += `${humanizeKey(k)}\n${COPY_LINE_DASH}\n${emit(v)}`; return; }
      t += `${humanizeKey(k)}\n${COPY_LINE_DASH}\n`;
      if (Array.isArray(v)) v.filter(Boolean).forEach((item, i) => { t += `${i + 1}. ${fmtVal(item)}\n`; });
      else t += `1. ${fmtVal(v)}\n`;
      t += '\n';
    });
    return t;
  }, [hasVal, fmtVal]);

  // `other` mirror of the JSX mini-cards: humanized key + DASH; number/plain → "1. value";
  // string with >=3 comma parts (genuine list) → numbered part rows; nested object → per-prop groups.
  const emitOtherCopy = useCallback((r) => {
    let t = '';
    Object.entries(r.other || {}).forEach(([key, val]) => {
      if (!hasVal(val)) return;
      if (val !== null && typeof val === 'object') { t += `${humanizeKey(key)}\n${COPY_LINE_DASH}\n${emitObjectCopy(val)}`; return; }
      t += `${humanizeKey(key)}\n${COPY_LINE_DASH}\n`;
      const parts = typeof val === 'string' ? splitByComma(val) : [];
      if (parts.length >= 3) parts.forEach((p, i) => { t += `${i + 1}. ${p}\n`; });
      else t += `1. ${fmtVal(val)}\n`;
      t += '\n';
    });
    return t;
  }, [hasVal, fmtVal, emitObjectCopy]);

  const copyAllText = useCallback(async () => {
    let text = `CLINICAL SCORES\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Clinical Scores ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      if (r.date) text += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}\n\n`;
      if (hasVal(r.type)) text += `Score Type\n${COPY_LINE_EQ}\n\n1. ${fmtVal(r.type)}\n\n`;
      if (hasVal(r.provider) || hasVal(r.facility)) { text += `Provider Information\n${COPY_LINE_EQ}\n\n`; if (hasVal(r.provider)) text += `Provider\n${COPY_LINE_DASH}\n1. ${r.provider}\n\n`; if (hasVal(r.facility)) text += `Facility\n${COPY_LINE_DASH}\n1. ${r.facility}\n\n`; }
      const stdScores = STANDARD_SCORE_FIELDS.filter(f => hasVal(r[f]));
      if (stdScores.length > 0) { text += `Standard Clinical Scores\n${COPY_LINE_EQ}\n\n`; stdScores.forEach(f => { text += `${FIELD_LABELS[f] || f}\n${COPY_LINE_DASH}\n1. ${fmtVal(r[f])}\n\n`; }); }
      const objScores = OBJECT_SCORE_FIELDS.filter(f => hasVal(r[f]));
      if (objScores.length > 0) { text += `Risk & Severity Scores\n${COPY_LINE_EQ}\n\n`; objScores.forEach(f => { text += `${FIELD_LABELS[f] || f}\n${COPY_LINE_DASH}\n${emitObjectCopy(r[f])}\n`; }); }
      if (r.other && typeof r.other === 'object' && Object.values(r.other).some(v => hasVal(v))) {
        text += `Clinical Scores & Biomarkers\n${COPY_LINE_EQ}\n\n${emitOtherCopy(r)}`;
      }
      if (hasVal(r.results)) { text += `Results\n${COPY_LINE_EQ}\n\n${emitObjectCopy(r.results)}`; }
      ['findings', 'assessment', 'plan'].forEach(f => {
        if (!hasVal(r[f])) return;
        text += `${FIELD_LABELS[f]}\n${COPY_LINE_EQ}\n\n`;
        splitBySentence(fmtVal(r[f])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
        text += '\n';
      });
      if (Array.isArray(r.recommendations) && r.recommendations.length > 0) {
        const items = r.recommendations.map(x => (x !== null && typeof x === 'object') ? (x.recommendation ?? x.text ?? x.value ?? '') : fmtVal(x)).filter(x => hasVal(x));
        if (items.length) { text += `Recommendations\n${COPY_LINE_EQ}\n\n`; items.forEach((x, i) => { text += `${i + 1}. ${x}\n`; }); text += '\n'; }
      }
      if (hasVal(r.notes) || hasVal(r.status)) {
        text += `Notes\n${COPY_LINE_EQ}\n\n`;
        if (hasVal(r.notes)) splitBySentence(fmtVal(r.notes)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
        if (hasVal(r.status)) text += `\nStatus\n${COPY_LINE_DASH}\n1. ${fmtVal(r.status)}\n`;
        text += '\n';
      }
      text += '\n';
    });
    const ok = await copyToClipboard(text.trim()); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, fmtVal, formatDate, splitBySentence, emitObjectCopy, emitOtherCopy]);

  // ========== RENDER HELPERS ==========
  const renderEditableProperty = (record, dotPath, idx, sectionId, label, value, title) => {
    const editKey = `${dotPath}-${idx}`;
    const localVal = localEdits[editKey];
    const displayVal = localVal !== undefined ? localVal : fmtVal(value);
    const isEditing = editingField === editKey;
    const badge = editedFields[editKey];
    if (!hasVal(value) && !localVal) return null;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sectionId) && !contentMatches(displayVal) && !contentMatches(label)) return null;
    // Single-name rule: field label == section title → the section header already names it, no sub-label.
    const sl = !title || label.toLowerCase() !== title.toLowerCase();
    // Fixed-choice fields (status) edit as an enum dropdown; unmatched current value kept as an extra option.
    const enumOpts = ENUM_FIELDS[dotPath] ? enumOptionsWith(ENUM_FIELDS[dotPath], displayVal) : null;
    const startVal = enumOpts ? (enumOpts.find(o => o.toLowerCase() === String(displayVal).toLowerCase()) || displayVal) : displayVal;
    return (
      <div key={dotPath}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(startVal); } }}>
          {isEditing ? (<div className="edit-field-container">{enumOpts ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveDotPath(record, dotPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderEditableNumber = (record, dotPath, idx, sectionId, label, value) => {
    const editKey = `${dotPath}-${idx}`;
    const localVal = localEdits[editKey];
    const rawVal = localVal !== undefined ? localVal : value;
    if (!hasVal(rawVal) && (localVal === undefined || localVal === '')) return null;
    const displayVal = fmtVal(rawVal);
    const isEditing = editingField === editKey;
    const badge = editedFields[editKey];
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sectionId) && !contentMatches(displayVal) && !contentMatches(label)) return null;
    return (
      <div key={dotPath}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
          {isEditing ? (<div className="edit-field-container"><div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(rawVal)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button><input type="number" step={stepFor(rawVal)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } if (e.key === 'Enter') { e.preventDefault(); handleSaveNumber(record, dotPath, idx); } }} onClick={e => e.stopPropagation()} /><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(rawVal)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button></div><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveNumber(record, dotPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !contentMatches(val) && !contentMatches(label)) return null;
    return (
      <div key={fn}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className="rec-mini-card">
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                  {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMixedSection = (record, idx, sid) => {
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
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let t = `${title}\n${COPY_LINE_EQ}\n\n`;
                fields.forEach(f => { const v = getFieldValue(record, f, idx); if (!hasVal(v)) return; const l = FIELD_LABELS[f] || f;
                  if (l.toLowerCase() !== title.toLowerCase()) t += `${l}\n${COPY_LINE_DASH}\n`;
                  if (SENTENCE_FIELDS.includes(f)) { splitBySentence(fmtVal(v)).forEach((s, i) => { t += `${i + 1}. ${s}\n`; }); t += '\n'; }
                  else { t += `1. ${fmtVal(v)}\n\n`; }
                });
                copySection(t, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableProperty(record, f, idx, sid, FIELD_LABELS[f] || f, getFieldValue(record, f, idx), title);
          })}
        </div>
      </div>
    );
  };

  const renderStandardScores = (record, idx) => {
    const visibleScores = STANDARD_SCORE_FIELDS.filter(f => hasVal(record[f]));
    if (visibleScores.length === 0) return null;
    const title = 'Standard Clinical Scores';
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches('standardScores');
    if (isSearching && !record._showAllSections && !stm && !visibleScores.some(f => contentMatches(FIELD_LABELS[f]) || contentMatches(fmtVal(record[f])))) return null;
    const copyId = `standardScores-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let t = `${title}\n${COPY_LINE_EQ}\n\n`;
                visibleScores.forEach(f => { t += `${FIELD_LABELS[f] || f}\n${COPY_LINE_DASH}\n1. ${fmtVal(record[f])}\n\n`; });
                copySection(t, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'standardScores', idx)}
            </div>
          </div>
          {visibleScores.map(f => {
            if (isSearching && !record._showAllSections && !stm && !contentMatches(FIELD_LABELS[f]) && !contentMatches(fmtVal(record[f]))) return null;
            if (NUMERIC_SCORE_FIELDS.includes(f)) return renderEditableNumber(record, f, idx, 'standardScores', FIELD_LABELS[f] || f, record[f]);
            return renderEditableProperty(record, f, idx, 'standardScores', FIELD_LABELS[f] || f, record[f]);
          })}
        </div>
      </div>
    );
  };

  // Ratio-shaped scalar ("48.4/100"): −/+ stepper edits ONLY the leading number; the "/100" part is
  // preserved verbatim. Gated on the exact number/number shape (dynamic keys — no explicit field list
  // possible; this shape can't match dates or comma lists). Stored value stays ONE string → Copy/PDF/
  // backend untouched.
  const RATIO_RE = /^(\d+(?:\.\d+)?)(\s*\/\s*\d+(?:\.\d+)?)$/;
  const renderOtherRatioField = (record, key, idx, num, suffix) => {
    const draftPath = `other.${key}`;
    const editKey = `${draftPath}-${idx}`;
    const isEditing = editingField === editKey;
    const badge = editedFields[editKey];
    const displayVal = `${num}${suffix}`;
    const label = humanizeKey(key);
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches('otherScores') && !contentMatches(displayVal) && !contentMatches(label)) return null;
    const st = parseFloat(stepFor(num)) || 1;
    const dec = (String(st).split('.')[1] || '').length;
    const bump = (d) => { const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + d).toFixed(dec)); };
    const save = () => { const n = parseFloat(editValue); if (isNaN(n)) return; stageDraft(record, draftPath, idx, `${n}${suffix}`); };
    return (
      <div key={key}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(num)); } }}>
          {isEditing ? (<div className="edit-field-container"><div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-st); }}>−</button><input type="number" step={stepFor(num)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} onClick={e => e.stopPropagation()} /><span className="unit-literal">{suffix.trim()}</span><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(st); }}>+</button></div><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); save(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  // One comma-part row of a scalar `other` value (>=3 parts = genuine list): editing a part splices it
  // back and rejoins with ', ' — the stored value stays ONE string at other.<key>.
  const renderOtherPartRow = (record, key, idx, parts, pi) => {
    const draftPath = `other.${key}`;
    const partKey = `${draftPath}.p${pi}-${idx}`;
    const isEditing = editingField === partKey;
    const badge = editedFields[`${draftPath}-${idx}`];
    const part = parts[pi];
    return (
      <div key={pi}>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(partKey); setEditValue(part); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const next = [...parts]; const v = editValue.trim(); if (v) next[pi] = v; else next.splice(pi, 1); stageDraft(record, draftPath, idx, next.join(', ')); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(part)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[partKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(part, partKey); }}>{copiedItems[partKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderOtherScores = (record, idx) => {
    const other = record.other;
    if (!other || typeof other !== 'object' || Object.keys(other).length === 0) return null;
    // Empty-titles guard: the section renders ONLY when at least one entry has a real value
    // (Evelyn's `other` holds SCALARS — the old code only supported nested objects, so the
    // title rendered with every child null).
    if (!Object.values(other).some(v => hasVal(v))) return null;
    const title = 'Clinical Scores & Biomarkers';
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches('otherScores');
    if (isSearching && !record._showAllSections && !stm) {
      const phrase = searchTerm.toLowerCase().trim();
      const hasMatch = Object.entries(other).some(([key, obj]) => {
        if (key.toLowerCase().includes(phrase)) return true;
        if (typeof obj === 'object') return Object.values(obj).some(v => contentMatches(fmtVal(v)));
        return false;
      });
      if (!hasMatch) return null;
    }
    const copyId = `otherScores-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(`${title}\n${COPY_LINE_EQ}\n\n` + emitOtherCopy(pdfData[idx] || record), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'otherScores', idx)}
            </div>
          </div>
          {Object.entries(other).map(([key, obj]) => {
            if (!hasVal(obj)) return null;
            if (isSearching && !record._showAllSections && !stm) {
              const phrase = searchTerm.toLowerCase().trim();
              const keyMatch = key.toLowerCase().includes(phrase);
              const valMatch = (obj !== null && typeof obj === 'object') ? Object.values(obj).some(v => contentMatches(fmtVal(v))) : contentMatches(fmtVal(obj));
              if (!keyMatch && !valMatch) return null;
            }
            // Scalar entries (Evelyn: NIHSS_initial 14, components "...", classification "Broca's Aphasia"):
            // number → stepper row; string with >=3 comma parts → numbered part rows; else plain row.
            if (obj === null || typeof obj !== 'object') {
              const draftKey = `other.${key}-${idx}`;
              const effVal = localEdits[draftKey] !== undefined ? localEdits[draftKey] : obj;
              if (typeof effVal === 'number') {
                return <div key={key} className="rec-mini-card">{renderEditableNumber(record, `other.${key}`, idx, 'otherScores', humanizeKey(key), effVal)}</div>;
              }
              const ratio = String(effVal).match(RATIO_RE);
              if (ratio) {
                return <div key={key} className="rec-mini-card">{renderOtherRatioField(record, key, idx, ratio[1], ratio[2])}</div>;
              }
              const parts = splitByComma(String(effVal));
              if (parts.length >= 3) {
                return (
                  <div key={key} className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText(humanizeKey(key))}</div>
                    {parts.map((p, pi) => renderOtherPartRow(record, key, idx, parts, pi))}
                  </div>
                );
              }
              return <div key={key} className="rec-mini-card">{renderEditableProperty(record, `other.${key}`, idx, 'otherScores', humanizeKey(key), effVal)}</div>;
            }
            return (
              <div key={key} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(humanizeKey(key))}</div>
                {Object.entries(obj).map(([prop, val]) => {
                  if (!hasVal(val)) return null;
                  return renderEditableProperty(record, `other.${key}.${prop}`, idx, 'otherScores', humanizeKey(prop), val);
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Recursive editable object node: scalar leaves -> editable property; nested objects -> subtitle + recurse
  const renderObjectNode = (record, value, dotPath, idx, sectionId, label) => {
    if (!hasVal(value)) return null;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return renderEditableProperty(record, dotPath, idx, sectionId, label, Array.isArray(value) ? value.join(', ') : value);
    }
    const entries = Object.entries(value).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    return (
      <div key={dotPath} className="rec-mini-card">
        {label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => renderObjectNode(record, v, `${dotPath}.${k}`, idx, sectionId, humanizeKey(k)))}
      </div>
    );
  };

  const renderObjectScores = (record, idx) => {
    const visible = OBJECT_SCORE_FIELDS.filter(f => hasVal(record[f]));
    if (visible.length === 0) return null;
    const title = SECTION_TITLES.objectScores;
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches('objectScores');
    if (isSearching && !record._showAllSections && !stm) {
      const phrase = searchTerm.toLowerCase().trim();
      const hasMatch = visible.some(f => (FIELD_LABELS[f] || f).toLowerCase().includes(phrase) || JSON.stringify(record[f]).toLowerCase().includes(phrase));
      if (!hasMatch) return null;
    }
    const copyId = `objectScores-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let t = `${title}\n${COPY_LINE_EQ}\n\n`;
                visible.forEach(f => { t += `${FIELD_LABELS[f] || f}\n${COPY_LINE_DASH}\n${emitObjectCopy(record[f])}\n`; });
                copySection(t, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'objectScores', idx)}
            </div>
          </div>
          {visible.map(f => renderObjectNode(record, record[f], f, idx, 'objectScores', FIELD_LABELS[f] || f))}
        </div>
      </div>
    );
  };

  // Results object section (was rendered ONLY in the PDF — JSX dropped the field entirely)
  const renderResults = (record, idx) => {
    const results = record.results;
    if (!hasVal(results) || typeof results !== 'object') return null;
    const title = SECTION_TITLES.results;
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches('results');
    if (isSearching && !record._showAllSections && !stm && !JSON.stringify(results).toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
    const copyId = `results-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(`${title}\n${COPY_LINE_EQ}\n\n${emitObjectCopy(results)}`, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {renderObjectNode(record, results, 'results', idx, 'results', null)}
        </div>
      </div>
    );
  };

  const renderRecommendations = (record, idx) => {
    const recsRaw = getFieldValue(record, 'recommendations', idx);
    if (!Array.isArray(recsRaw) || recsRaw.length === 0) return null;
    const items = recsRaw.map(r => (r !== null && typeof r === 'object') ? { recommendation: r.recommendation ?? r.text ?? r.value ?? '', date: r.date || '' } : { recommendation: fmtVal(r), date: '' }).filter(r => hasVal(r.recommendation));
    if (items.length === 0) return null;
    const title = SECTION_TITLES.recommendations;
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches('recommendations');
    if (isSearching && !record._showAllSections && !stm && !items.some(r => contentMatches(r.recommendation))) return null;
    const groups = [];
    items.forEach(r => { const d = String(r.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    const copyId = `recommendations-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let t = `${title}\n${'='.repeat(40)}\n\n`;
                groups.forEach(g => { if (g.date) t += `${formatDate(g.date)}\n`; g.items.forEach((r, i) => { t += `${i + 1}. ${r.recommendation}\n`; }); t += '\n'; });
                copySection(t, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
            </div>
          </div>
          {groups.map((g, gi) => (
            <div key={gi} className="rec-mini-card">
              {g.date && <div className="nested-subtitle">{highlightText(formatDate(g.date))}</div>}
              {g.items.map((r, i) => {
                const key = `recommendations-${idx}-${gi}-${i}`;
                if (isSearching && !record._showAllSections && !stm && !contentMatches(r.recommendation)) return null;
                return (
                  <div key={i} className="numbered-row">
                    <div className="row-content"><span className="content-value">{i + 1}. {highlightText(r.recommendation)}</span></div>
                    <button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(r.recommendation, key); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!records || records.length === 0) {
    return (<div className="clinical-scores-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Clinical Scores</h2></div><div className="empty-state">No clinical scores records available</div></div>);
  }

  return (
    <div className="clinical-scores-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Clinical Scores</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ClinicalScoresDocumentPDFTemplate document={pdfData} />} fileName="Clinical_Scores.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search clinical scores..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Clinical Scores ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'scoreType')}
            {renderMixedSection(record, idx, 'providerInfo')}
            {renderStandardScores(record, idx)}
            {renderObjectScores(record, idx)}
            {renderOtherScores(record, idx)}
            {renderResults(record, idx)}
            {renderMixedSection(record, idx, 'findings')}
            {renderMixedSection(record, idx, 'assessment')}
            {renderMixedSection(record, idx, 'plan')}
            {renderRecommendations(record, idx)}
            {renderMixedSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClinicalScoresDocument;
