/**
 * EstimatedTimeToDialysisDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: estimated_time_to_dialysis
 *
 * 6 Sections:
 *   1. kidney-function: currentCreatinineLevel (number), estimatedGlomerularFiltrationRate (number), bloodUreaNitrogen (number), chronickidneyDiseaseStage (string), proteinuriaLevel (number), albuminToCreatinineRatio (number), creatinineClearance (number)
 *   2. underlying-causes: underlyingNephropathy (string), diabeticNephropathy (bool), hypertensiveNephrosclerosis (bool), polycysticKidneyDisease (bool), glomerulonephritis (string)
 *   3. current-therapy: aceInhibitorTherapy (bool), angiotensinReceptorBlocker (bool)
 *   4. lab-values: hemoglobinLevel (number), serumPhosphorus (number), serumCalcium (number), parathyroidHormone (number), vitaminDLevel (number), metabolicAcidosis (bool)
 *   5. access-planning: vascularAccessPlacement (string), arteriovenousFistula (bool), peritonealDialysisEligibility (bool), transplantEvaluation (string)
 *   6. timeline: estimatedTimeToDialysis (number)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EstimatedTimeToDialysisDocumentPDFTemplate from '../pdf-templates/EstimatedTimeToDialysisDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueSelect from '../components/BlueSelect';
import './EstimatedTimeToDialysisDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'kidney-function': 'Kidney Function',
  'underlying-causes': 'Underlying Causes',
  'current-therapy': 'Current Therapy',
  'lab-values': 'Lab Values',
  'access-planning': 'Access & Planning',
  'timeline': 'Timeline',
};

const FIELD_LABELS = {
  currentCreatinineLevel: 'Current Creatinine Level',
  estimatedGlomerularFiltrationRate: 'Estimated GFR',
  bloodUreaNitrogen: 'Blood Urea Nitrogen',
  chronickidneyDiseaseStage: 'CKD Stage',
  proteinuriaLevel: 'Proteinuria Level',
  albuminToCreatinineRatio: 'Albumin-to-Creatinine Ratio',
  creatinineClearance: 'Creatinine Clearance',
  underlyingNephropathy: 'Underlying Nephropathy',
  diabeticNephropathy: 'Diabetic Nephropathy',
  hypertensiveNephrosclerosis: 'Hypertensive Nephrosclerosis',
  polycysticKidneyDisease: 'Polycystic Kidney Disease',
  glomerulonephritis: 'Glomerulonephritis',
  aceInhibitorTherapy: 'ACE Inhibitor Therapy',
  angiotensinReceptorBlocker: 'Angiotensin Receptor Blocker',
  hemoglobinLevel: 'Hemoglobin Level',
  serumPhosphorus: 'Serum Phosphorus',
  serumCalcium: 'Serum Calcium',
  parathyroidHormone: 'Parathyroid Hormone',
  vitaminDLevel: 'Vitamin D Level',
  metabolicAcidosis: 'Metabolic Acidosis',
  vascularAccessPlacement: 'Vascular Access Placement',
  arteriovenousFistula: 'Arteriovenous Fistula',
  peritonealDialysisEligibility: 'Peritoneal Dialysis Eligibility',
  transplantEvaluation: 'Transplant Evaluation',
  estimatedTimeToDialysis: 'Estimated Time to Dialysis (months)',
};

const SECTION_FIELDS = {
  'kidney-function': ['currentCreatinineLevel', 'estimatedGlomerularFiltrationRate', 'bloodUreaNitrogen', 'chronickidneyDiseaseStage', 'proteinuriaLevel', 'albuminToCreatinineRatio', 'creatinineClearance'],
  'underlying-causes': ['underlyingNephropathy', 'diabeticNephropathy', 'hypertensiveNephrosclerosis', 'polycysticKidneyDisease', 'glomerulonephritis'],
  'current-therapy': ['aceInhibitorTherapy', 'angiotensinReceptorBlocker'],
  'lab-values': ['hemoglobinLevel', 'serumPhosphorus', 'serumCalcium', 'parathyroidHormone', 'vitaminDLevel', 'metabolicAcidosis'],
  'access-planning': ['vascularAccessPlacement', 'arteriovenousFistula', 'peritonealDialysisEligibility', 'transplantEvaluation'],
  'timeline': ['estimatedTimeToDialysis'],
};

const NUMBER_FIELDS = ['currentCreatinineLevel', 'estimatedGlomerularFiltrationRate', 'bloodUreaNitrogen', 'proteinuriaLevel', 'albuminToCreatinineRatio', 'creatinineClearance', 'hemoglobinLevel', 'serumPhosphorus', 'serumCalcium', 'parathyroidHormone', 'vitaminDLevel', 'estimatedTimeToDialysis'];
const BOOLEAN_FIELDS = ['diabeticNephropathy', 'hypertensiveNephrosclerosis', 'polycysticKidneyDisease', 'aceInhibitorTherapy', 'angiotensinReceptorBlocker', 'metabolicAcidosis', 'arteriovenousFistula', 'peritonealDialysisEligibility'];
/* Narrative field → Copy/PDF sentence-split ([.;]) + aggressive comma-split + numbered (per-sentence rows in JSX). */
const SENTENCE_FIELDS = ['transplantEvaluation'];
/* Creatinine clearance cannot be 0 in a patient with a measurable eGFR — a stored 0 = "not assessed" → hidden. */
const ZERO_SENTINEL_FIELDS = ['creatinineClearance'];

/* Copy dividers: EQ (====) under section/record titles, DASH (----) under EVERY field label + sub-category. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* stepFor: decimal-aware step for the −/+ number stepper (1.78 → 0.01, 10.2 → 0.1, 38 → 1). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* stripLeadingNum: drop a leading "1. " so a stored numbered list doesn't double-number in Copy/PDF. */
const stripLeadingNum = (s) => String(s ?? '').replace(/^\s*\d+[.)]\s+/, '');

/* parseLabel: detect "Label: value" patterns inside a narrative sentence. */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split. Keeps a comma JOINED when it is a decimal grouping
   ("3,200"), a continuation conjunction ("…, and/or/then …"), or follows a trailing and/or. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
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

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; this template has no array fields) */
const DRAFT_KEY = 'estimated_time_to_dialysisPendingEdits';
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
const EstimatedTimeToDialysisDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
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
      if (r?.estimated_time_to_dialysis) return Array.isArray(r.estimated_time_to_dialysis) ? r.estimated_time_to_dialysis : [r.estimated_time_to_dialysis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.estimated_time_to_dialysis) return Array.isArray(dd.estimated_time_to_dialysis) ? dd.estimated_time_to_dialysis : [dd.estimated_time_to_dialysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE DRAFTS ═══════ */
  // Repopulate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
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

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  /* reconstructFullText: re-join edited sentences back into a single stored string (drops empties). */
  function reconstructFullText(sentences) {
    const clean = sentences.map(s => String(s || '').replace(/[;.]+$/, '').trim()).filter(Boolean);
    return clean.map((c, i) => i < clean.length - 1 ? c + '.' : c).join(' ');
  }

  /* formatSentenceFieldLines: narrative field → numbered Copy lines. parseLabel sub-headings + aggressive
     comma-split (guarded). Mirrors the PDF renderSentenceSection. */
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
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 2) { parts.forEach(item => { lines.push(`${n++}. ${item}`); }); }
        else { lines.push(`${n++}. ${s}`); }
      }
    });
    return lines;
  }, [splitBySentence]);

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
  const shouldShowSection = useCallback((record, sid, idx) => {
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
      const rt = `Estimated Time to Dialysis ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sid}-${idx}`];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveBooleanField = useCallback((record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const boolVal = editValue === 'Yes' || editValue === 'true' || editValue === true;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: boolVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sid}-${idx}`];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = boolVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k === `${f}-${idx}`));
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Commit only this section's pending edits (editKey = `${field}-${idx}`)
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        return fields.includes(fieldPart);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // flat field name (no array fields in this template)
        await secureApiClient.put(`/api/edit/estimated_time_to_dialysis/${id}/edit`, { field: fieldPart, value: localEdits[editKey] });
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/estimated_time_to_dialysis/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k === `${f}-${idx}`) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EstimatedTimeToDialysis] Approve error:', err); setSaveError('Save failed. Please try again.'); }
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
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = '';
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (ZERO_SENTINEL_FIELDS.includes(f) && Number(val) === 0) return; // stored 0 = not assessed → hidden
      if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}\n\n`;
      } else if (SENTENCE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n`;
        formatSentenceFieldLines(fmtVal(val)).forEach(l => { text += `${l}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${COPY_LINE_DASH}\n${fmtVal(val)}\n\n`;
      }
    });
    // Empty-section drop: a section with no populated fields emits NOTHING (never a bare title+divider,
    // which would also break JSX/PDF parity).
    return text.trim() ? `${title}\n${COPY_LINE_EQ}\n\n${text}` : '';
  }, [getFieldValue, hasVal, fmtVal, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== ESTIMATED TIME TO DIALYSIS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Estimated Time to Dialysis ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) && val !== 0) return null;
    if (ZERO_SENTINEL_FIELDS.includes(fn) && Number(val) === 0) return null; // stored 0 = not assessed → hidden
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const p = parseFloat(editValue); if (isNaN(p)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, p); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const parsed = parseFloat(editValue); if (isNaN(parsed)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, parsed); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveBooleanField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD (string) ═══════ */
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#x270E;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SENTENCE FIELD (narrative → per-sentence rows; numbering ONLY in Copy/PDF) ═══════ */
  const renderSentenceField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length <= 1) return renderEditableField(record, fn, idx, sid, title);
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const editKeyField = `${fn}-${idx}`;
    const isModified = editedFields[editKeyField];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const sKey = `${fn}-${idx}-s${sIdx}`;
          const isEditing = editingField === sKey;
          return (
            <div key={sIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const updated = [...sentences]; updated[sIdx] = editValue; const fullText = reconstructFullText(updated); handleSaveField(record, fn, idx, sid, null, fullText); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#x270E;</span></div>
                    <button className={`copy-btn ${copiedItems[sKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sKey); }}>{copiedItems[sKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
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
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="estimated-time-to-dialysis-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Estimated Time to Dialysis</h2></div>
        <div className="empty-state">No estimated time to dialysis records available</div>
      </div>
    );
  }

  return (
    <div className="estimated-time-to-dialysis-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Estimated Time to Dialysis</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EstimatedTimeToDialysisDocumentPDFTemplate document={pdfData} />} fileName="Estimated_Time_To_Dialysis.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search estimated time to dialysis..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Estimated Time to Dialysis ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'kidney-function')}
            {renderSection(record, idx, 'underlying-causes')}
            {renderSection(record, idx, 'current-therapy')}
            {renderSection(record, idx, 'lab-values')}
            {renderSection(record, idx, 'access-planning')}
            {renderSection(record, idx, 'timeline')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EstimatedTimeToDialysisDocument;
