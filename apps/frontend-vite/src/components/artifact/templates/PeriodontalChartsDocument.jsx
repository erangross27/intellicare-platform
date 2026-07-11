/**
 * PeriodontalChartsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: periodontal_charts
 *
 * Sections:
 *   1. diagnosis: periodontalDiagnosis
 *   2. stage: periodontalStage
 *   3. grade: periodontalGrade
 *   4. charting: pocketDepths, clinicalAttachmentLevel, bleedingOnProbing, recession, mobility, furcationInvolvement
 *   5. bone-loss: boneLoss
 *   6. calculus: calculus
 *   7. gingivitis: gingivitis
 *   8. plaque: plaqueBiofilm
 *   9. suppuration: suppuration
 *  10. mucogingival: mucogingivalProblems
 *  11. keratinized: keratinizedTissueWidth
 *  12. implant: implantPeriodontitis
 *  13. probe: probeType, probingForce
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PeriodontalChartsDocumentPDFTemplate from '../pdf-templates/PeriodontalChartsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PeriodontalChartsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } } — localEdits here is always keyed `${field}-${idx}`. */
const DRAFT_KEY = 'periodontal_chartsPendingEdits';
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
  'diagnosis': 'Periodontal Diagnosis',
  'stage': 'Periodontal Stage',
  'grade': 'Periodontal Grade',
  'charting': 'Periodontal Charting',
  'bone-loss': 'Bone Loss',
  'calculus': 'Calculus',
  'gingivitis': 'Gingivitis',
  'plaque': 'Plaque/Biofilm',
  'suppuration': 'Suppuration',
  'mucogingival': 'Mucogingival Problems',
  'keratinized': 'Keratinized Tissue Width',
  'implant': 'Implant Issues',
  'probe': 'Probe Information',
};

/* Single-name gate: a field label that equals its section title (case-insensitive) is a redundant
   double — suppress the nested-subtitle in JSX (and the head in copy / label in PDF). */
const labelSameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();

const FIELD_LABELS = {
  periodontalDiagnosis: 'Periodontal Diagnosis',
  periodontalStage: 'Periodontal Stage',
  periodontalGrade: 'Periodontal Grade',
  pocketDepths: 'Pocket Depths',
  clinicalAttachmentLevel: 'Clinical Attachment Level',
  bleedingOnProbing: 'Bleeding on Probing',
  recession: 'Recession',
  mobility: 'Mobility',
  furcationInvolvement: 'Furcation Involvement',
  boneLoss: 'Bone Loss',
  calculus: 'Calculus',
  gingivitis: 'Gingivitis',
  plaqueBiofilm: 'Plaque/Biofilm',
  suppuration: 'Suppuration',
  mucogingivalProblems: 'Mucogingival Problems',
  keratinizedTissueWidth: 'Keratinized Tissue Width',
  implantPeriodontitis: 'Implant Issues',
  probeType: 'Probe Type',
  probingForce: 'Probing Force',
};

const SECTION_FIELDS = {
  'diagnosis': ['periodontalDiagnosis'],
  'stage': ['periodontalStage'],
  'grade': ['periodontalGrade'],
  'charting': ['pocketDepths', 'clinicalAttachmentLevel', 'bleedingOnProbing', 'recession', 'mobility', 'furcationInvolvement'],
  'bone-loss': ['boneLoss'],
  'calculus': ['calculus'],
  'gingivitis': ['gingivitis'],
  'plaque': ['plaqueBiofilm'],
  'suppuration': ['suppuration'],
  'mucogingival': ['mucogingivalProblems'],
  'keratinized': ['keratinizedTissueWidth'],
  'implant': ['implantPeriodontitis'],
  'probe': ['probeType', 'probingForce'],
};

const NUMBER_FIELDS = ['probingForce'];
const STRING_FIELDS = ['periodontalDiagnosis', 'periodontalStage', 'periodontalGrade', 'gingivitis', 'plaqueBiofilm', 'probeType'];
const ARRAY_FIELDS = ['pocketDepths', 'clinicalAttachmentLevel', 'bleedingOnProbing', 'recession', 'mobility', 'furcationInvolvement', 'boneLoss', 'calculus', 'suppuration', 'mucogingivalProblems', 'keratinizedTissueWidth', 'implantPeriodontitis'];

/* parseLabel: detect "Label: value" patterns (CLAUSE_OPENER guard, strip inline N. markers) */
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

/* Bar chart helpers */
const DEPTH_SITES = ['DB', 'B', 'MB', 'DL', 'L', 'ML'];

const getDepthColor = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '#9ca3af';
  if (num <= 3) return '#22c55e';
  if (num === 4) return '#fbbf24';
  return '#ef4444';
};

const getDepthInterpretation = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '';
  if (num <= 3) return 'Normal';
  if (num === 4) return 'Mild';
  return 'Severe';
};

const depthToPercentage = (val) => {
  const num = Number(val);
  if (isNaN(num)) return 0;
  return Math.min(100, Math.max(5, (num / 10) * 100));
};

const formatPairEntry = (entry) => {
  if (!Array.isArray(entry) || entry.length < 2) return '';
  return `${entry[0]}: ${entry[1]}`;
};

const formatPocketDepthEntry = (entry) => {
  if (!Array.isArray(entry) || entry.length < 2) return '';
  if (entry.length >= 7) return `${entry[0]}: DB=${entry[1]}, B=${entry[2]}, MB=${entry[3]}, DL=${entry[4]}, L=${entry[5]}, ML=${entry[6]}`;
  return `${entry[0]}: ${entry.slice(1).join(', ')}`;
};

/* ═══════ COMPONENT ═══════ */
const PeriodontalChartsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${field}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
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
      if (r?.periodontal_charts) return Array.isArray(r.periodontal_charts) ? r.periodontal_charts : [r.periodontal_charts];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.periodontal_charts) return Array.isArray(dd.periodontal_charts) ? dd.periodontal_charts : [dd.periodontal_charts]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  // Field-aware presence: probingForce === 0 is a "not recorded" sentinel (normal probing force is ~0.2-0.25 N), hide it.
  const hasFieldVal = useCallback((fn, v) => { if (NUMBER_FIELDS.includes(fn) && typeof v === 'number' && v === 0) return false; return hasVal(v); }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const safeArray = useCallback((val) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    return [];
  }, []);

  const buildToothMap = useCallback((arr) => {
    const map = {};
    safeArray(arr).forEach(entry => {
      if (Array.isArray(entry) && entry.length >= 2) map[String(entry[0])] = entry[1];
    });
    return map;
  }, [safeArray]);

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

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
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
            if (Array.isArray(item)) return item.some(sub => String(sub).toLowerCase().includes(phrase));
            return String(item).toLowerCase().includes(phrase);
          })) return true;
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
        if (Array.isArray(item)) return item.some(sub => String(sub).toLowerCase().includes(phrase));
        return String(item).toLowerCase().includes(phrase);
      });
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Periodontal Chart ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => {
            if (Array.isArray(item)) return item.some(sub => String(sub).toLowerCase().includes(phrase));
            return String(item).toLowerCase().includes(phrase);
          }) : fmtVal(val).toLowerCase().includes(phrase))) return true;
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
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the approved flag so the button returns to yellow Pending Approve
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a sentence edit as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageDraft = (record, fn, idx, sid, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
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
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    // localEdits is always keyed `${field}-${idx}` (whole field value), so no arrayIndex is needed.
    const toCommit = fields
      .map(f => `${f}-${idx}`)
      .filter(k => pendingEdits[k] && localEdits[k] !== undefined);
    try {
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, editKey.length - `-${idx}`.length);
        const resp = await secureApiClient.put(`/api/edit/periodontal_charts/${id}/edit`, { field: fn, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/periodontal_charts/${id}/approve`, { sectionId: sid, approved: true });
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
      if (!hasFieldVal(f, val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${'-'.repeat(40)}\n`;
      if (NUMBER_FIELDS.includes(f)) {
        body += `${head}1. ${fmtVal(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = (Array.isArray(val) ? val : [val]).filter(e => (Array.isArray(e) ? e.length >= 2 : hasVal(e)));
        if (items.length === 0) return;
        const fmt = f === 'pocketDepths' ? formatPocketDepthEntry : formatPairEntry;
        body += head + items.map((item, i) => `${i + 1}. ${fmt(item)}`).join('\n') + '\n\n';
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
  }, [getFieldValue, hasFieldVal, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== PERIODONTAL CHARTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Periodontal Chart ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD (−/+ num-stepper) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    const showSubLabel = !labelSameAsTitle(label, sid);
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const stepFor = (s) => { const n = parseFloat(s); return Number.isFinite(n) && Math.abs(n) < 10 ? 0.5 : 1; };
    const adjust = (delta) => { const cur = parseFloat(editValue); const base = Number.isFinite(cur) ? cur : 0; const next = Math.max(0, base + delta); setEditValue(String(Number.isInteger(next) ? next : next.toFixed(1))); };
    const commitNumber = () => { const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); };

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button className="num-step" onClick={e => { e.stopPropagation(); adjust(-stepFor(editValue)); }}>&#8722;</button>
                <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitNumber(); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button className="num-step" onClick={e => { e.stopPropagation(); adjust(stepFor(editValue)); }}>&#43;</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commitNumber(); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderPairArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = Array.isArray(item) ? formatPairEntry(item) : String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(Array.isArray(item) ? item.join(', ') : String(item)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const newItemVal = Array.isArray(item) ? editValue.split(',').map(s => s.trim()).filter(Boolean) : editValue; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = newItemVal; stageDraft(record, fn, idx, sid, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = !labelSameAsTitle(label, sid);
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
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); stageDraft(record, fn, idx, sid, fullText2); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); stageDraft(record, fn, idx, sid, fullText); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: PERIODONTAL CHARTING (Consolidated tooth visualization) ═══════ */
  const renderChartingSection = (record, idx) => {
    const sid = 'charting';
    const pocketArr = safeArray(getFieldValue(record, 'pocketDepths', idx));
    const calArr = safeArray(getFieldValue(record, 'clinicalAttachmentLevel', idx));
    const bopArr = safeArray(getFieldValue(record, 'bleedingOnProbing', idx));
    const recArr = safeArray(getFieldValue(record, 'recession', idx));
    const mobArr = safeArray(getFieldValue(record, 'mobility', idx));
    const furcArr = safeArray(getFieldValue(record, 'furcationInvolvement', idx));
    const boneArr = safeArray(getFieldValue(record, 'boneLoss', idx));
    const toothBoneLoss = boneArr.filter(e => Array.isArray(e) && e.length >= 2 && String(e[0]).startsWith('#'));
    const hasToothData = pocketArr.length > 0 || calArr.length > 0 || bopArr.length > 0 || recArr.length > 0 || mobArr.length > 0 || furcArr.length > 0 || toothBoneLoss.length > 0;
    if (!hasToothData) return null;
    if (!shouldShowSection(record, sid)) return null;

    const calMap = buildToothMap(calArr);
    const bopMap = buildToothMap(bopArr);
    const recMap = buildToothMap(recArr);
    const mobMap = buildToothMap(mobArr);
    const furcMap = buildToothMap(furcArr);
    const boneLossMap = buildToothMap(toothBoneLoss);

    const pocketTeeth = new Set(pocketArr.map(e => String(e[0])));
    const otherOnlyTeeth = [];
    [calArr, bopArr, recArr, mobArr, furcArr, toothBoneLoss].forEach(arr => {
      safeArray(arr).forEach(entry => {
        if (Array.isArray(entry) && entry.length >= 2 && !pocketTeeth.has(String(entry[0]))) {
          if (!otherOnlyTeeth.includes(String(entry[0]))) otherOnlyTeeth.push(String(entry[0]));
        }
      });
    });

    // Filter visible pocket depth rows
    const visiblePocketRows = pocketArr.filter(entry => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      const phrase = searchTerm.toLowerCase().trim();
      const toothNum = String(entry[0]);
      const entryStr = formatPocketDepthEntry(entry);
      if (entryStr.toLowerCase().includes(phrase)) return true;
      if (calMap[toothNum] && String(calMap[toothNum]).toLowerCase().includes(phrase)) return true;
      if (bopMap[toothNum] && String(bopMap[toothNum]).toLowerCase().includes(phrase)) return true;
      if (recMap[toothNum] && String(recMap[toothNum]).toLowerCase().includes(phrase)) return true;
      if (mobMap[toothNum] && String(mobMap[toothNum]).toLowerCase().includes(phrase)) return true;
      if (furcMap[toothNum] && String(furcMap[toothNum]).toLowerCase().includes(phrase)) return true;
      return false;
    });

    if (visiblePocketRows.length === 0 && otherOnlyTeeth.length === 0) return null;

    // Copy text
    const copyLines = ['PERIODONTAL CHARTING', '='.repeat(40)];
    if (pocketArr.length > 0) {
      copyLines.push('', 'Pocket Depths:');
      pocketArr.forEach((entry, i) => {
        const toothNum = String(entry[0]);
        copyLines.push(`  ${i + 1}. ${formatPocketDepthEntry(entry)}`);
        const findings = [];
        if (calMap[toothNum]) findings.push(`CAL: ${calMap[toothNum]}`);
        if (bopMap[toothNum]) findings.push(`BOP: ${bopMap[toothNum]}`);
        if (recMap[toothNum]) findings.push(`Recession: ${recMap[toothNum]}`);
        if (mobMap[toothNum]) findings.push(`Mobility: ${mobMap[toothNum]}`);
        if (furcMap[toothNum]) findings.push(`Furcation: ${furcMap[toothNum]}`);
        if (findings.length > 0) copyLines.push(`     Findings: ${findings.join(' | ')}`);
      });
    }
    const copyText = copyLines.join('\n');
    const copyId = `charting-${idx}`;

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Periodontal Charting')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {/* Legend */}
          {pocketArr.length > 0 && (
            <div className="perio-chart-legend">
              <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal (&le;3mm)</span></div>
              <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#fbbf24' }} /><span>Mild (4mm)</span></div>
              <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>Severe (&ge;5mm)</span></div>
            </div>
          )}
          {/* Bar charts grouped by tooth with finding tags */}
          {visiblePocketRows.map((entry, i) => {
            if (!Array.isArray(entry) || entry.length < 7) return null;
            const toothNum = String(entry[0]);
            const toothEditKey = `pocketDepths.${pocketArr.indexOf(entry)}-${idx}`;
            const toothModified = editedFields[toothEditKey];
            const findings = [];
            if (calMap[toothNum]) findings.push({ label: 'CAL', value: calMap[toothNum], type: 'cal' });
            if (bopMap[toothNum]) findings.push({ label: 'BOP', value: bopMap[toothNum], type: 'bop' });
            if (recMap[toothNum]) findings.push({ label: 'Recession', value: recMap[toothNum], type: 'recession' });
            if (mobMap[toothNum]) findings.push({ label: 'Mobility', value: mobMap[toothNum], type: 'mobility' });
            if (furcMap[toothNum]) findings.push({ label: 'Furcation', value: furcMap[toothNum], type: 'furcation' });
            return (
              <div key={i} className={`perio-tooth-group ${toothModified ? 'modified' : ''}`}>
                <div className="perio-tooth-header">{highlightText(`Tooth ${entry[0]}`)}</div>
                {DEPTH_SITES.map((site, si) => {
                  const val = entry[si + 1];
                  const color = getDepthColor(val);
                  const pct = depthToPercentage(val);
                  const interp = getDepthInterpretation(val);
                  return (
                    <div key={si} className="perio-bar-chart-row">
                      <div className="perio-bar-label">{highlightText(site)}</div>
                      <div className="perio-bar-container">
                        <div className="perio-bar-background">
                          <div className="perio-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <div className="perio-bar-value" style={{ color }}>{highlightText(`${val}mm`)}</div>
                        <div className="perio-bar-interpretation" style={{ color }}>{highlightText(interp)}</div>
                      </div>
                    </div>
                  );
                })}
                {findings.length > 0 && (
                  <div className="perio-tooth-findings">
                    {findings.map((f, fi) => (
                      <div key={fi} className={`perio-finding-tag perio-finding-${f.type}`}>
                        <span className="perio-finding-label">{highlightText(f.label)}</span>
                        <span className="perio-finding-value">{highlightText(String(f.value))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Teeth only in other arrays (no pocket depth data) */}
          {otherOnlyTeeth.map(toothNum => {
            const findings = [];
            if (calMap[toothNum]) findings.push({ label: 'CAL', value: calMap[toothNum], type: 'cal' });
            if (bopMap[toothNum]) findings.push({ label: 'BOP', value: bopMap[toothNum], type: 'bop' });
            if (recMap[toothNum]) findings.push({ label: 'Recession', value: recMap[toothNum], type: 'recession' });
            if (mobMap[toothNum]) findings.push({ label: 'Mobility', value: mobMap[toothNum], type: 'mobility' });
            if (furcMap[toothNum]) findings.push({ label: 'Furcation', value: furcMap[toothNum], type: 'furcation' });
            if (findings.length === 0) return null;
            return (
              <div key={`other-${toothNum}`} className="perio-tooth-group">
                <div className="perio-tooth-header">{highlightText(`Tooth ${toothNum}`)}</div>
                <div className="perio-tooth-findings">
                  {findings.map((f, fi) => (
                    <div key={fi} className={`perio-finding-tag perio-finding-${f.type}`}>
                      <span className="perio-finding-label">{highlightText(f.label)}</span>
                      <span className="perio-finding-value">{highlightText(String(f.value))}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: PAIR SUBTITLE SECTION (bone loss, calculus, etc.) ═══════ */
  const renderPairSubtitleSection = (record, idx, sid, fn) => {
    const val = getFieldValue(record, fn, idx);
    const entries = Array.isArray(val) ? val.filter(e => Array.isArray(e) && e.length >= 2) : [];
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];

    // Show ALL entries (tooth-specific #NN + regional) so nothing is dropped from the section / Copy / PDF.
    const displayEntries = entries;
    if (displayEntries.length === 0) return null;

    const visibleEntries = displayEntries.filter(entry => {
      if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid)) return true;
      const phrase = searchTerm.toLowerCase().trim();
      return String(entry[0]).toLowerCase().includes(phrase) || String(entry[1]).toLowerCase().includes(phrase);
    });
    if (visibleEntries.length === 0) return null;

    const copyText = `${title.toUpperCase()}\n${'='.repeat(40)}\n${displayEntries.map(e => `${String(e[0])}\n1. ${String(e[1])}`).join('\n\n')}`;
    const copyId = `${sid}-${idx}`;

    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(copyText, copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {visibleEntries.map((entry, i) => {
            const editKey = `${fn}.${entries.indexOf(entry)}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            return (
              <div key={i} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(String(entry[0]))}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(entry[1])); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const entryIdx = entries.indexOf(entry); const newEntry = [entry[0], editValue]; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[entryIdx] = newEntry; stageDraft(record, fn, idx, sid, currentArr); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(String(entry[1]))}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${String(entry[0])}: ${String(entry[1])}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (STRING_FIELDS.includes(f)) return renderStringField(record, f, idx, sid);
            return null;
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="periodontal-charts-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Periodontal Charts</h2></div>
        <div className="empty-state">No periodontal chart records available</div>
      </div>
    );
  }

  return (
    <div className="periodontal-charts-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Periodontal Charts</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PeriodontalChartsDocumentPDFTemplate document={pdfData} />} fileName="Periodontal_Charts.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search periodontal charts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Periodontal Chart ${idx + 1}`)}</h3>
            </div>
            {/* Section 1: Periodontal Diagnosis */}
            {renderSection(record, idx, 'diagnosis')}
            {/* Section 2: Periodontal Stage */}
            {renderSection(record, idx, 'stage')}
            {/* Section 3: Periodontal Grade */}
            {renderSection(record, idx, 'grade')}
            {/* Section 4: Periodontal Charting */}
            {renderChartingSection(record, idx)}
            {/* Section 5: Bone Loss */}
            {renderPairSubtitleSection(record, idx, 'bone-loss', 'boneLoss')}
            {/* Section 6: Calculus */}
            {renderPairSubtitleSection(record, idx, 'calculus', 'calculus')}
            {/* Section 7: Gingivitis */}
            {renderSection(record, idx, 'gingivitis')}
            {/* Section 8: Plaque/Biofilm */}
            {renderSection(record, idx, 'plaque')}
            {/* Section 9: Suppuration */}
            {renderPairSubtitleSection(record, idx, 'suppuration', 'suppuration')}
            {/* Section 10: Mucogingival Problems */}
            {renderPairSubtitleSection(record, idx, 'mucogingival', 'mucogingivalProblems')}
            {/* Section 11: Keratinized Tissue Width */}
            {renderPairSubtitleSection(record, idx, 'keratinized', 'keratinizedTissueWidth')}
            {/* Section 12: Implant Issues */}
            {renderPairSubtitleSection(record, idx, 'implant', 'implantPeriodontitis')}
            {/* Section 13: Probe Information */}
            {renderSection(record, idx, 'probe')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeriodontalChartsDocument;
