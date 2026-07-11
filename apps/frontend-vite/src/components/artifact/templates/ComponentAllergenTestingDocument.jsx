/**
 * ComponentAllergenTestingDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: component_allergen_testing
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ComponentAllergenTestingPDFTemplate from '../pdf-templates/ComponentAllergenTestingPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ComponentAllergenTestingDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value may be a string/number/boolean or full array) */
const DRAFT_KEY = 'component_allergen_testingPendingEdits';
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
  'test-info': 'Test Information',
  'risk-profile': 'Risk Profile',
  reactivity: 'Reactivity',
  'clinical-guidance': 'Clinical Guidance',
  additional: 'Additional',
};

const FIELD_LABELS = {
  allergenComponent: 'Allergen Component', componentClass: 'Component Class', componentPanelName: 'Component Panel Name',
  specificIgELevel: 'Specific IgE Level', clinicalRelevanceScore: 'Clinical Relevance Score', componentSensitivityIndex: 'Component Sensitivity Index',
  riskStratification: 'Risk Stratification', genuineVsCrossReactive: 'Genuine vs Cross-Reactive',
  majorVsMinorAllergen: 'Major vs Minor Allergen', immunotherapyEligibility: 'Immunotherapy Eligibility',
  crossReactivityPattern: 'Cross-Reactivity Pattern', heatStabilityProfile: 'Heat Stability Profile',
  componentStabilityProfile: 'Component Stability Profile', homologyMapping: 'Homology Mapping',
  avoidanceRecommendations: 'Avoidance Recommendations', foodPreparationGuidance: 'Food Preparation Guidance',
  toleranceInduction: 'Tolerance Induction',
  pollenSeasonRelevance: 'Pollen Season Relevance', epidemiologyData: 'Epidemiology Data', occupationalRelevance: 'Occupational Relevance',
};

const SECTION_FIELDS = {
  'test-info': ['allergenComponent', 'componentClass', 'componentPanelName', 'specificIgELevel', 'clinicalRelevanceScore', 'componentSensitivityIndex'],
  'risk-profile': ['riskStratification', 'genuineVsCrossReactive', 'majorVsMinorAllergen', 'immunotherapyEligibility'],
  reactivity: ['crossReactivityPattern', 'heatStabilityProfile', 'componentStabilityProfile', 'homologyMapping'],
  'clinical-guidance': ['avoidanceRecommendations', 'foodPreparationGuidance', 'toleranceInduction'],
  additional: ['pollenSeasonRelevance', 'epidemiologyData', 'occupationalRelevance'],
};

const SENTENCE_FIELDS = ['crossReactivityPattern', 'heatStabilityProfile', 'foodPreparationGuidance', 'toleranceInduction', 'componentStabilityProfile'];
const ARRAY_FIELDS = ['avoidanceRecommendations', 'homologyMapping'];
const BOOLEAN_FIELDS = ['immunotherapyEligibility'];
const NUMBER_FIELDS = ['specificIgELevel', 'clinicalRelevanceScore', 'componentSensitivityIndex'];
// Fixed-choice clinical fields → dropdown (keep an unmatched current value as an extra option, casing matched).
const ENUM_FIELDS = {
  riskStratification: ['low risk', 'moderate risk', 'high risk'],
  genuineVsCrossReactive: ['genuine allergy', 'cross-reactive'],
  majorVsMinorAllergen: ['major allergen', 'minor allergen'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Copy dividers (4-area mirror): EQ under record + section titles, DASH under every field / group label.
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// −/+ stepper increment: 1 for integers, else a step matching the value's decimal precision.
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Comma splitter for narrative lists (per sentence, >=3 gate). Paren-aware; keeps Oxford ", and/or X"
// attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#><=+-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const ComponentAllergenTestingDocument = ({ document: docProp }) => {
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
  const [saveError, setSaveError] = useState('');
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.component_allergen_testing) return Array.isArray(r.component_allergen_testing) ? r.component_allergen_testing : [r.component_allergen_testing];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.component_allergen_testing) return Array.isArray(dd.component_allergen_testing) ? dd.component_allergen_testing : [dd.component_allergen_testing]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
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

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; const arr = record[fn]; return Array.isArray(arr) ? arr : []; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

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
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
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
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Component Allergen Testing ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (val !== null && val !== undefined) {
          if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
          else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((r, idx) => {
      const m = { ...r };
      Object.keys(localEdits).forEach(k => {
        if (pendingEdits[k]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k];
      });
      // Merge array fields only when their edit is NOT a pending draft (committed edits flow into the PDF)
      ARRAY_FIELDS.forEach(field => { if (!pendingEdits[`${field}-${idx}`]) m[field] = getEffectiveArray(r, field, idx); });
      return m;
    });
  }, [filteredRecords, localEdits, pendingEdits, getEffectiveArray]);

  /* ── Save handlers ──
     Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits). */
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue.trim();
    const originalVal = record[fn];

    // Field type validation
    if (NUMBER_FIELDS.includes(fn) || typeof originalVal === 'number') {
      if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(saveVal);
    }
    if (BOOLEAN_FIELDS.includes(fn) || typeof originalVal === 'boolean') {
      const lower = String(saveVal).toLowerCase();
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      saveVal = ['true', 'yes', '1'].includes(lower);
    }
    setSaveError('');
    const displayVal = typeof saveVal === 'boolean' ? (saveVal ? 'Yes' : 'No') : String(saveVal);
    const storedVal = typeof saveVal === 'boolean' ? saveVal : (typeof saveVal === 'number' ? saveVal : displayVal);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: storedVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const sKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // Persist as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = storedVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const clearApprove = () => setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const stageDraft = (fullText) => { const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); };
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      clearApprove(); stageDraft(fullText);
      setEditingField(null); setEditValue(''); return;
    }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    clearApprove(); stageDraft(fullText);
    setEditingField(null); setEditValue('');
  }

  // Save one comma-part of a sentence group (labeled OR unlabeled) = stage a DRAFT. Rebuilds that sentence
  // (preserving a "Label:" head), then the full field text; an empty edit removes the part.
  function saveCommaItem(record, fn, idx, sid, sIdx, commaIdx) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = curSentences[sIdx] || '';
    const parsed = parseLabel(sentence);
    const content = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
    const items = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) items.splice(commaIdx, 1); else items[commaIdx] = trimmed;
    const kept = items.map(s => s.trim()).filter(Boolean);
    if (kept.length > 0) curSentences[sIdx] = parsed ? `${parsed.label}: ${kept.join(', ')}` : kept.join(', ');
    else curSentences.splice(sIdx, 1);
    const fullText = reconstructFullText(curSentences);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}-c${commaIdx}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  // Save one array item = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const saveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    const trimmed = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const currentArr = [...getEffectiveArray(record, fn, idx)];
    currentArr[arrayIndex] = trimmed;
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${arrayIndex}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = currentArr; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getEffectiveArray]);

  /* ── Section approve ── */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      // Commit each staged field in this section. editKey = `${fn}-${idx}`; the trailing dot-segment is
      // never numeric (field names have no ".N" here), so NO arrayIndex — full value/array is sent.
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(editKey => pendingEdits[editKey] && localEdits[editKey] !== undefined);
      for (const editKey of toCommit) {
        const fn = editKey.slice(0, -(`-${idx}`).length);
        const resp = await secureApiClient.put(`/api/edit/component_allergen_testing/${id}/edit`, { field: fn, value: localEdits[editKey] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/component_allergen_testing/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ── Clipboard ── */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ── Copy helpers ──
     Shared EQ/DASH numbered section-copy builder — 4-area mirror. Copy Section passes live getFieldValue;
     Copy All passes pdfData's committed values. Sentence fields split by sentence then comma (>=3), labeled
     groups restart numbering; NUMBER_FIELDS with a stored 0 are hidden. Returns '' when the section is empty. */
  const buildSectionCopy = useCallback((record, idx, sid, valueOf) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    const emitSentence = (text) => {
      let n = 0;
      splitBySentence(text).forEach(s => {
        const p = parseLabel(s);
        const content = p ? p.content : s.replace(/[;.]+$/, '').trim();
        const c = splitByComma(content);
        const parts = c.length >= 3 ? c : [content];
        if (p) { lines.push(p.label, COPY_LINE_DASH); n = 0; }
        parts.forEach(part => lines.push(`${++n}. ${part.replace(/[;.]+$/, '').trim()}`));
      });
    };
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const val = valueOf(f);
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        arr.forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`));
        lines.push('');
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!hasVal(val)) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        emitSentence(fmtVal(val));
        lines.push('');
      } else {
        if (!hasVal(val)) return;
        if (NUMBER_FIELDS.includes(f) && Number(val) === 0) return;
        if (showLabel) lines.push(label, COPY_LINE_DASH);
        lines.push(`1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = '=== COMPONENT ALLERGEN TESTING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Component Allergen Testing ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const block = buildSectionCopy(r, idx, sid, f => r[f]);
        if (block) text += `${block}\n`;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, buildSectionCopy, copyToClipboard]);

  // −/+ number stepper (native spinner arrows banned). min 0; Enter saves; stopPropagation so the row click
  // doesn't re-open/close the editor. onSave commits the field.
  const numberStepper = (onSave) => {
    const bump = (dir) => { setSaveError(''); const s = parseFloat(stepFor(editValue)) || 1; const nv = (parseFloat(editValue) || 0) + dir * s; setEditValue(String(Math.max(0, Math.round(nv * 1e6) / 1e6))); };
    return (
      <div className="num-stepper-row">
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(-1); }}>−</button>
        <input type="number" step={stepFor(editValue)} min="0" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => { setSaveError(''); setEditValue(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } else if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
        <button type="button" className="num-step" onClick={e => { e.stopPropagation(); bump(1); }}>+</button>
      </div>
    );
  };

  /* ── Render: simple editable field ── */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    // Numeric 0 is a sentinel ("not measured") for these magnitude fields — hide it.
    if (NUMBER_FIELDS.includes(fn) && Number(val) === 0) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    const isNumberField = NUMBER_FIELDS.includes(fn); const isBooleanField = BOOLEAN_FIELDS.includes(fn);
    const enumOpts = !isBooleanField && ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], val) : null;
    const startEdit = () => { setSaveError(''); setEditingField(editKey); if (enumOpts) { const cur = String(val ?? '').trim(); const m = enumOpts.find(o => o.toLowerCase() === cur.toLowerCase()); setEditValue(m || cur); } else setEditValue(displayVal); };
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) startEdit(); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBooleanField ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : enumOpts ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }}>{enumOpts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}</select>
              ) : isNumberField ? (
                numberStepper(() => handleSaveField(record, fn, idx, sid))
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
              </div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
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

  /* ── Render: sentence editable field ── */
  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn}>
        <div className="rec-mini-card">
          {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
            const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
            if (!sentenceMatches && searchTerm.trim()) return null;
            const parsed = parseLabel(sentence);
            // Guarded comma-split (paren/Oxford aware); comma rows only for a genuine list (>=3, Rule #73).
            // Labeled → sub-label + rows; unlabeled >=3 → rows (no sub-label). saveCommaItem handles both.
            const rawContent = parsed ? parsed.content : sentence.replace(/[;.]+$/, '').trim();
            const commaItems = splitByComma(rawContent);
            if (commaItems.length >= 3) {
                return (
                  <div key={sIdx} className={parsed ? 'rec-mini-card' : ''} style={parsed ? { marginTop: 8 } : undefined}>
                    {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                    {commaItems.map((ci, ciIdx) => {
                      const commaKey = `${sentenceKey}-c${ciIdx}`; const ciEditing = editingField === commaKey; const ciBadge = editedFields[commaKey];
                      return (
                        <div key={ciIdx}>
                          <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(''); } }}>
                            {ciEditing ? (
                              <div className="edit-field-container">
                                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
                                <div className="edit-actions">
                                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
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
            return (
              <div key={sIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(''); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div>
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

  /* ── Render: array editable field ── */
  const renderEditableArrayField = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (
      <div key={fn} className="rec-mini-card">
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, ai) => {
          const arrKey = `${fn}-${idx}-${ai}`; const isEditing = editingField === arrKey; const badge = editedFields[arrKey];
          const itemStr = String(item || '');
          const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim());
          if (!itemMatches) return null;
          return (
            <div key={ai}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrKey); setEditValue(itemStr); setSaveError(''); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(''); } }} />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, sid, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">✎</span></div>
                    <button className={`copy-btn ${copiedItems[arrKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrKey); }}>{copiedItems[arrKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Render: mixed section ── */
  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    });
    if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, sid, f => getFieldValue(record, f, idx)), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (ARRAY_FIELDS.includes(f)) return renderEditableArrayField(record, f, idx, sid, title);
            if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ── Main render ── */
  if (!records || records.length === 0) return (<div className="component-allergen-testing" ref={containerRef}><div className="document-header"><h2 className="document-title">Component Allergen Testing</h2></div><div className="empty-state">No component allergen testing records available</div></div>);

  return (
    <div className="component-allergen-testing" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Component Allergen Testing</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ComponentAllergenTestingPDFTemplate document={pdfData} />} fileName="Component_Allergen_Testing.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search component allergen testing..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <h3 className="record-name">{highlightText(`Component Allergen Testing ${idx + 1}`)}</h3>
            </div>
            {renderMixedSection(record, idx, 'test-info')}
            {renderMixedSection(record, idx, 'risk-profile')}
            {renderMixedSection(record, idx, 'reactivity')}
            {renderMixedSection(record, idx, 'clinical-guidance')}
            {renderMixedSection(record, idx, 'additional')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentAllergenTestingDocument;
