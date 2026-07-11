/**
 * EntAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: ent_assessment
 *
 * 9 Sections:
 *   1. provider-details: date (date picker), provider, facility, status
 *   2. audiometry: audiometry.rightEar{250Hz..PTA}, audiometry.leftEar{250Hz..PTA},
 *      audiometry.speechDiscrimination, audiometry.tympanometry{type,findings},
 *      audiometry.acousticReflexes{findings}, audiometry.otoacousticEmissions{type,findings}
 *   3. nasopharyngolaryngoscopy: nasalCavity, nasopharynx, oropharynx, hypopharynx, larynx, vocalCords
 *   4. sinus-assessment: sinusAssessment.ctFindings, sinusAssessment.endoscopy
 *   5. vestibular-testing: vestibularTesting (flattened object)
 *   6. findings: findings (sentence)
 *   7. assessment: assessment (sentence — numbered "1. ...")
 *   8. plan: plan (sentence with parseLabel)
 *   9. recommendations-notes: recommendations[], notes (sentence)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EntAssessmentDocumentPDFTemplate from '../pdf-templates/EntAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './EntAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the "-<idx>" suffix) */
const DRAFT_KEY = 'ent_assessmentPendingEdits';
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
  'provider-details': 'Provider Details',
  audiometry: 'Audiometry',
  nasopharyngolaryngoscopy: 'Nasopharyngolaryngoscopy',
  'sinus-assessment': 'Sinus Assessment',
  'vestibular-testing': 'Vestibular Testing',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  'recommendations-notes': 'Recommendations & Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility', 'status'],
  audiometry: ['audiometry'],
  nasopharyngolaryngoscopy: ['nasopharyngolaryngoscopy'],
  'sinus-assessment': ['sinusAssessment'],
  'vestibular-testing': ['vestibularTesting'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  'recommendations-notes': ['recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

/* audiometry sub-groups */
const AUDIOMETRY_GROUPS = [
  // measure: freq→dB grids → ONE row per pair "250 Hz - 30 dB"
  { key: 'rightEar', label: 'Right Ear', measure: true, subKeys: ['250Hz', '500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz', 'PTA'] },
  { key: 'leftEar', label: 'Left Ear', measure: true, subKeys: ['250Hz', '500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz', 'PTA'] },
  { key: 'speechDiscrimination', label: 'Speech Discrimination', isString: true },
  // labeled text sub-fields → nested-subtitle + value leaves (like NPL/sinus)
  { key: 'tympanometry', label: 'Tympanometry', subKeys: ['type', 'findings'] },
  { key: 'acousticReflexes', label: 'Acoustic Reflexes', subKeys: ['findings'] },
  { key: 'otoacousticEmissions', label: 'Otoacoustic Emissions', subKeys: ['type', 'findings'] },
];

const NPL_FIELDS = [
  { key: 'nasalCavity', label: 'Nasal Cavity' },
  { key: 'nasopharynx', label: 'Nasopharynx' },
  { key: 'oropharynx', label: 'Oropharynx' },
  { key: 'hypopharynx', label: 'Hypopharynx' },
  { key: 'larynx', label: 'Larynx' },
  { key: 'vocalCords', label: 'Vocal Cords' },
];

const SINUS_FIELDS = [
  { key: 'ctFindings', label: 'CT Findings' },
  { key: 'endoscopy', label: 'Endoscopy' },
];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split + Oxford(and/or) & numeric(50,000) guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const nextCh = text[i + 1] || '';
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/\d/.test(nextCh) || /^(and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══════ CANONICAL COPY / ENUM HELPERS ═══════ */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const ENUM_FIELDS = ['status'];
const STATUS_OPTIONS = ['Active', 'Completed', 'Not Active'];
const OPTIONS_FOR = { status: STATUS_OPTIONS };
const enumCanonical = (fn, val) => {
  const opts = OPTIONS_FOR[fn] || [];
  const s = String(val ?? '').trim();
  if (!s) return s;
  const hit = opts.find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};
const enumOptionsWith = (fn, val) => {
  const opts = OPTIONS_FOR[fn] || [];
  const canon = enumCanonical(fn, val);
  return canon && !opts.some(o => o.toLowerCase() === canon.toLowerCase()) ? [canon, ...opts] : opts;
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const EntAssessmentDocument = ({ document: docProp }) => {
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
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.ent_assessment) return Array.isArray(r.ent_assessment) ? r.ent_assessment : [r.ent_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ent_assessment) return Array.isArray(dd.ent_assessment) ? dd.ent_assessment : [dd.ent_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeIdOf = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
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
        // Restore the edited markers used by sectionHasEdits/badges.
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
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    // Handle numbered items: "1. ... 2. ... 3. ..."
    const numberedMatch = text.match(/^\d+\.\s/);
    if (numberedMatch) {
      const items = text.split(/\s+(?=\d+\.\s)/).map(s => s.replace(/^\d+\.\s*/, '').replace(/\.$/, '').trim()).filter(Boolean);
      if (items.length > 1) return items;
    }
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
    if (fn.includes('.')) return fn.split('.').reduce((o, p) => (o == null ? undefined : o[p]), record);
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

  /* ═══════ SEARCH ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const val = record[f];
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          if (JSON.stringify(val).toLowerCase().includes(phrase)) return true;
        } else if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'object') { if (JSON.stringify(item).toLowerCase().includes(phrase)) return true; }
            else if (String(item).toLowerCase().includes(phrase)) return true;
          }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, fmtVal]);

  const fieldMatches = useCallback((label, value) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if (label && label.toLowerCase().includes(phrase)) return true;
    if (value && String(value).toLowerCase().includes(phrase)) return true;
    return false;
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `ENT Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = record[f];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            if (JSON.stringify(val).toLowerCase().includes(phrase)) return true;
          } else if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'object' && JSON.stringify(item).toLowerCase().includes(phrase)) return true;
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length >= 2) {
            let cur = merged;
            for (let i = 0; i < dotParts.length - 1; i++) {
              if (!cur[dotParts[i]] || typeof cur[dotParts[i]] !== 'object') cur[dotParts[i]] = {};
              cur[dotParts[i]] = { ...cur[dotParts[i]] };
              cur = cur[dotParts[i]];
            }
            cur[dotParts[dotParts.length - 1]] = localEdits[key];
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
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // fieldPart = editKey without the "-<idx>" suffix (here just `fn`).
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
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

  // Save one sentence = stage a DRAFT locally + localStorage (survives refresh). NOT a DB write.
  function stageSentenceDraft(id, fn, idx, fullText) {
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
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
      setSaveError(null);
      stageSentenceDraft(id, fn, idx, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageSentenceDraft(id, fn, idx, fullText);
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

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Collect this record's pending editKeys that belong to this section (same prefix convention as the marker-clear below).
    const toCommit = Object.keys(localEdits).filter(k =>
      pendingEdits[k] && k.endsWith(suffix) &&
      fields.some(f => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(suffix)))
    );
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" | "a.b.c" | "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const lastSeg = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric (e.g. "recommendations.2").
        if (dotIdx !== -1 && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, dotIdx);
          payload.arrayIndex = parseInt(lastSeg, 10);
        }
        const resp = await secureApiClient.put(`/api/edit/ent_assessment/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/ent_assessment/${id}/approve`, { sectionId: sid, approved: true });

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
  const formatSentenceFieldLines = useCallback((text, splitUnlabeled = false) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        // labeled group → sub-label + DASH, restart numbering within the group (canonical)
        const parts = splitByComma(parsed.value);
        lines.push(parsed.label); lines.push(COPY_LINE_DASH);
        let m = 1;
        (parts.length >= 2 ? parts : [parsed.value]).forEach(item => { lines.push(`${m++}. ${item}`); });
      } else {
        const parts = splitUnlabeled ? splitByComma(s) : [s];
        if (parts.length >= 2) parts.forEach(item => { lines.push(`${n++}. ${item}`); });
        else lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  /* Recursive canonical object → copy lines (stacked: humanized key + DASH + numbered value; never "Key: value") */
  function objectCopyLines(obj) {
    const lines = [];
    if (!obj || typeof obj !== 'object') return lines;
    Object.entries(obj).forEach(([k, v]) => {
      if (!hasVal(v)) return;
      if (v === null || typeof v !== 'object') {
        // scalar leaf → sentence/comma split (dot-then-comma) so comma-list findings become numbered rows
        lines.push(humanizeKey(k), COPY_LINE_DASH);
        formatSentenceFieldLines(fmtVal(v), true).forEach(l => lines.push(l));
        lines.push('');
      } else if (Array.isArray(v)) {
        const items = v.filter(hasVal);
        if (!items.length) return;
        lines.push(humanizeKey(k), COPY_LINE_DASH);
        items.forEach((it, i) => { if (it && typeof it === 'object') objectCopyLines(it).forEach(l => lines.push(l)); else lines.push(`${i + 1}. ${fmtVal(it)}`); });
        lines.push('');
      } else {
        lines.push(humanizeKey(k), COPY_LINE_DASH);
        objectCopyLines(v).forEach(l => lines.push(l));
      }
    });
    return lines;
  }

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let body = '';
    if (sid === 'provider-details') {
      [['date', 'Date'], ['provider', 'Provider'], ['facility', 'Facility'], ['status', 'Status']].forEach(([f, label]) => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const disp = f === 'date' ? formatDate(val) : (f === 'status' ? enumCanonical('status', val) : fmtVal(val));
        body += `${label}\n${COPY_LINE_DASH}\n1. ${disp}\n\n`;
      });
    } else if (sid === 'audiometry') {
      // rightEar/leftEar → "1. 250 Hz - 30 dB"; speechDiscrimination → sentence split; tympanometry/reflexes/OAE → stacked labeled leaves
      const aud = record.audiometry || {};
      AUDIOMETRY_GROUPS.forEach(group => {
        const data = aud[group.key];
        if (!hasVal(data)) return;
        if (group.isString) {
          body += `${group.label}\n${COPY_LINE_DASH}\n`;
          formatSentenceFieldLines(fmtVal(data), true).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else if (group.measure && typeof data === 'object') {
          const entries = (group.subKeys || Object.keys(data)).filter(k => hasVal(data[k]));
          if (!entries.length) return;
          body += `${group.label}\n${COPY_LINE_DASH}\n`;
          entries.forEach((k, i) => { body += `${i + 1}. ${humanizeKey(k)} - ${fmtVal(data[k])}\n`; });
          body += '\n';
        } else if (typeof data === 'object') {
          const entries = (group.subKeys || Object.keys(data)).filter(k => hasVal(data[k]));
          if (!entries.length) return;
          body += `${group.label}\n${COPY_LINE_DASH}\n\n`;
          entries.forEach(k => {
            body += `${humanizeKey(k)}\n${COPY_LINE_DASH}\n`;
            formatSentenceFieldLines(fmtVal(data[k])).forEach(l => { body += `${l}\n`; });
            body += '\n';
          });
        }
      });
    } else if (sid === 'nasopharyngolaryngoscopy') {
      objectCopyLines(record.nasopharyngolaryngoscopy).forEach(l => { body += `${l}\n`; });
    } else if (sid === 'sinus-assessment') {
      objectCopyLines(record.sinusAssessment).forEach(l => { body += `${l}\n`; });
    } else if (sid === 'vestibular-testing') {
      objectCopyLines(record.vestibularTesting).forEach(l => { body += `${l}\n`; });
    } else if (sid === 'results') {
      objectCopyLines(record.results).forEach(l => { body += `${l}\n`; });
    } else if (sid === 'recommendations-notes') {
      const recs = record.recommendations;
      if (Array.isArray(recs) && recs.length > 0) {
        let recBody = '';
        recs.forEach((r, i) => {
          const recText = typeof r === 'string' ? r : (r?.recommendation || '');
          if (!recText) return;
          const recDate = typeof r === 'object' && r?.date ? formatDate(r.date) : '';
          recBody += `${i + 1}. ${recText}${recDate ? ` (${recDate})` : ''}\n`;
        });
        if (recBody) body += `Recommendations\n${COPY_LINE_DASH}\n${recBody}\n`;
      }
      const notes = getFieldValue(record, 'notes', idx);
      if (hasVal(notes)) {
        body += `Notes\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(notes)).forEach(l => { body += `${l}\n`; });
        body += '\n';
      }
    } else {
      // sentence sections (findings / assessment / plan) — single-name gate (field label == section title)
      const fields = SECTION_FIELDS[sid] || [];
      fields.forEach(f => {
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        const label = FIELD_LABELS[f] || f;
        const head = label.toLowerCase() !== (title || '').toLowerCase() ? `${label}\n${COPY_LINE_DASH}\n` : '';
        if (SENTENCE_FIELDS.includes(f)) {
          body += head;
          formatSentenceFieldLines(fmtVal(val)).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${label}\n${COPY_LINE_DASH}\n1. ${fmtVal(val)}\n\n`;
        }
      });
    }
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [hasVal, fmtVal, getFieldValue, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `ENT Assessment\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `ENT Assessment ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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
    if (searchTerm.trim() && !fieldMatches(label, displayVal) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onChange={v => setEditValue(v)} />
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
  const renderEditableField = (record, fn, idx, sid, label) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const displayLabel = label || FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(displayLabel, displayVal) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(displayLabel)}</div>
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
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${displayLabel}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid, label) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const displayLabel = label || FIELD_LABELS[fn] || fn;
    const canonVal = enumCanonical(fn, val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(displayLabel, canonVal) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(displayLabel)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(canonVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={enumCanonical(fn, editValue)} options={enumOptionsWith(fn, val)} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(canonVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${displayLabel}\n${canonVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NESTED OBJECT EDITABLE ROW ═══════ */
  const renderNestedEditableRow = (record, dotPath, idx, label, value, sid, showSubtitle = true, inline = false) => {
    if (!hasVal(value)) return null;
    const editKey = `${dotPath}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(label, value)) return null;

    return (
      <div key={dotPath}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(value)); setSaveError(null); } }}>
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
              <div className={`row-content${inline ? ' inline-kv' : ''}`}>
                {showSubtitle && <span className="content-subtitle">{highlightText(label)}</span>}
                <span className="content-value">{highlightText(String(value))}</span>
              </div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(showSubtitle ? `${label}\n${value}` : String(value), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE EDITABLE with parseLabel + comma-split ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, title, labelOverride, splitUnlabeled = false) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = labelOverride || FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(label, val)) return null;
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
            {
              // comma-split BOTH labeled (nested-subtitle + rows) and unlabeled (bare rows) sentences
              const commaItems = splitByComma(parsed.isLabeled ? parsed.value : sentence);
              const parsedLabelMatch = searchTerm.trim() && parsed.isLabeled && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
              if (commaItems.length >= 2 && (parsed.isLabeled || splitUnlabeled)) {
                return (
                  <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                    {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
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
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); const items2 = splitByComma(p2.isLabeled ? p2.value : s2); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = p2.isLabeled ? `${p2.label}: ${items2.join(', ')}.` : `${items2.join(', ')}`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); stageSentenceDraft(id2, fn, idx, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
              <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); const idL = safeId(record); if (!idL) return; setSaveError(null); stageSentenceDraft(idL, fn, idx, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: AUDIOMETRY SECTION ═══════ */
  const renderAudiometrySection = (record, idx) => {
    const sid = 'audiometry';
    const aud = record.audiometry;
    if (!aud || typeof aud !== 'object' || Object.keys(aud).length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Audiometry')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {AUDIOMETRY_GROUPS.map(group => {
            const data = aud[group.key];
            if (!data || (typeof data === 'object' && !group.isString && Object.keys(data).length === 0)) return null;
            if (group.isString) {
              if (!hasVal(data)) return null;
              return renderSentenceEditableField(record, `audiometry.${group.key}`, idx, sid, SECTION_TITLES[sid], group.label, true);
            }
            const subKeys = group.subKeys || Object.keys(data);
            const visibleEntries = subKeys.filter(k => hasVal(data[k]));
            if (visibleEntries.length === 0) return null;
            if (group.measure) {
              // freq→dB grid: one inline row per pair "250 Hz - 30 dB"
              return (
                <div key={group.key} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(group.label)}</div>
                  {visibleEntries.map(subKey => renderNestedEditableRow(record, `audiometry.${group.key}.${subKey}`, idx, humanizeKey(subKey), data[subKey], sid, true, true))}
                </div>
              );
            }
            // labeled text sub-fields (type/findings): group header + nested-subtitle value leaves
            return (
              <div key={group.key}>
                <div className="nested-subtitle">{highlightText(group.label)}</div>
                {visibleEntries.map(subKey => renderSentenceEditableField(record, `audiometry.${group.key}.${subKey}`, idx, sid, SECTION_TITLES[sid], humanizeKey(subKey), false))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: NASOPHARYNGOLARYNGOSCOPY SECTION ═══════ */
  const renderNplSection = (record, idx) => {
    const sid = 'nasopharyngolaryngoscopy';
    const npl = record.nasopharyngolaryngoscopy;
    if (!npl || typeof npl !== 'object' || Object.keys(npl).length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Nasopharyngolaryngoscopy')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {NPL_FIELDS.map(f => {
            if (!hasVal(npl[f.key])) return null;
            return renderSentenceEditableField(record, `nasopharyngolaryngoscopy.${f.key}`, idx, sid, SECTION_TITLES[sid], f.label, true);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: SINUS ASSESSMENT SECTION ═══════ */
  const renderSinusSection = (record, idx) => {
    const sid = 'sinus-assessment';
    const sa = record.sinusAssessment;
    if (!sa || typeof sa !== 'object' || Object.keys(sa).length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Sinus Assessment')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {SINUS_FIELDS.map(f => {
            if (!hasVal(sa[f.key])) return null;
            return renderSentenceEditableField(record, `sinusAssessment.${f.key}`, idx, sid, SECTION_TITLES[sid], f.label, true);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: VESTIBULAR TESTING SECTION ═══════ */
  const renderVestibularSection = (record, idx) => {
    const sid = 'vestibular-testing';
    const vt = record.vestibularTesting;
    if (!vt || typeof vt !== 'object' || Object.keys(vt).length === 0) return null;
    const entries = Object.entries(vt).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Vestibular Testing')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {entries.map(([key, val]) => (
            <div key={key} className="rec-mini-card">
              <div className="nested-subtitle">{highlightText(key)}</div>
              {renderNestedEditableRow(record, `vestibularTesting.${key}`, idx, key, val, sid, false)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS ARRAY ═══════ */
  const renderRecommendationsArray = (record, idx, sid) => {
    const recs = record.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    const groupedByDate = {};
    recs.forEach((r, i) => {
      const recDate = (typeof r === 'object' && r?.date) ? formatDate(r.date) : 'No Date';
      if (!groupedByDate[recDate]) groupedByDate[recDate] = [];
      groupedByDate[recDate].push({ ...r, _origIdx: i });
    });

    return Object.entries(groupedByDate).map(([dateLabel, items]) => {
      const groupMatches = phraseMatch || items.some(item => {
        const recText = typeof item === 'string' ? item : (item?.recommendation || '');
        return fieldMatches('Recommendations', recText) || fieldMatches(dateLabel, recText);
      });
      if (!groupMatches && searchTerm.trim()) return null;

      return (
        <div key={dateLabel} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(dateLabel)}</div>
          {items.map(item => {
            const recText = typeof item === 'string' ? item : (item?.recommendation || '');
            const arrIdx = item._origIdx;
            const editKey = `recommendations.${arrIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            if (searchTerm.trim() && !phraseMatch && !fieldMatches('Recommendations', recText) && !fieldMatches(dateLabel, '')) return null;
            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(recText); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const recObj = typeof item === 'string' ? editValue : { ...item, recommendation: editValue }; delete recObj._origIdx; handleSaveArrayItem(record, 'recommendations', idx, arrIdx, recObj); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    });
  };

  /* ═══════ RENDER: RESULTS (recursive dynamic-key object) ═══════ */
  const renderResultsNode = (record, dotPath, idx, label, value, sid, depth) => {
    if (!hasVal(value)) return null;
    /* scalar leaf -> editable row (dot-path saved; route allow-lists `results` root) */
    if (value === null || typeof value !== 'object') {
      return (
        <div key={dotPath} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {renderNestedEditableRow(record, dotPath, idx, label, fmtVal(value), sid, false)}
        </div>
      );
    }
    if (Array.isArray(value)) {
      const items = value.filter(v => hasVal(v));
      if (items.length === 0) return null;
      return (
        <div key={dotPath} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {value.map((v, i) => (hasVal(v) ? renderResultsNode(record, `${dotPath}.${i}`, idx, `${i + 1}`, v, sid, depth + 1) : null))}
        </div>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    return (
      <div key={dotPath} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {entries.map(([k, v]) => renderResultsNode(record, `${dotPath}.${k}`, idx, k, v, sid, depth + 1))}
      </div>
    );
  };

  const renderResultsSection = (record, idx) => {
    const sid = 'results';
    const res = record.results;
    if (!res || typeof res !== 'object' || Object.keys(res).length === 0) return null;
    const entries = Object.entries(res).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Results')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {entries.map(([k, v]) => renderResultsNode(record, `results.${k}`, idx, k, v, sid, 0))}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: PROVIDER DETAILS SECTION ═══════ */
  const renderProviderDetailsSection = (record, idx) => {
    const sid = 'provider-details';
    const fields = [
      { fn: 'date', isDate: true },
      { fn: 'provider' },
      { fn: 'facility' },
      { fn: 'status' },
    ];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f.fn, idx)));
    if (!hasAnyVal) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Provider Details')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (f.isDate) return renderDateField(record, f.fn, idx, sid);
            if (ENUM_FIELDS.includes(f.fn)) return renderEnumField(record, f.fn, idx, sid);
            return renderEditableField(record, f.fn, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SENTENCE SECTION ═══════ */
  const renderSentenceSection = (record, idx, sid, fn) => {
    const title = SECTION_TITLES[sid];
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (!shouldShowSection(record, sid)) return null;
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
          {renderSentenceEditableField(record, fn, idx, sid, title)}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS & NOTES SECTION ═══════ */
  const renderRecsNotesSection = (record, idx) => {
    const sid = 'recommendations-notes';
    const hasRecs = Array.isArray(record.recommendations) && record.recommendations.length > 0;
    const hasNotes = hasVal(getFieldValue(record, 'notes', idx));
    if (!hasRecs && !hasNotes) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Recommendations & Notes')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {hasRecs && renderRecommendationsArray(record, idx, sid)}
          {hasNotes && renderSentenceEditableField(record, 'notes', idx, sid, 'Recommendations & Notes')}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="ent-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">ENT Assessment</h2></div>
        <div className="empty-state">No ENT assessment records available</div>
      </div>
    );
  }

  return (
    <div className="ent-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">ENT Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EntAssessmentDocumentPDFTemplate document={pdfData} />} fileName="ENT_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search ENT assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`ENT Assessment ${idx + 1}`)}</h3>
            </div>
            {renderProviderDetailsSection(record, idx)}
            {renderAudiometrySection(record, idx)}
            {renderNplSection(record, idx)}
            {renderSinusSection(record, idx)}
            {renderVestibularSection(record, idx)}
            {renderSentenceSection(record, idx, 'findings', 'findings')}
            {renderSentenceSection(record, idx, 'assessment', 'assessment')}
            {renderSentenceSection(record, idx, 'plan', 'plan')}
            {renderResultsSection(record, idx)}
            {renderRecsNotesSection(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntAssessmentDocument;
