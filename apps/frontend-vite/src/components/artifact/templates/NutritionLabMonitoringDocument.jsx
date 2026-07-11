/**
 * NutritionLabMonitoringDocument.jsx
 * July 2026 — Nutrition Lab Monitoring (unified flat schema) — canonical one-pass polish
 * Data collection: nutrition_lab_monitoring
 * Edit route: nutrition_lab_monitoring
 *
 * 6 Sections (covering all 25 extractable fields, none added):
 *   1. visceral-proteins:    prealbumin, serumAlbumin, transferrinLevel, retinolBindingProtein
 *   2. immune-inflammation:  totalLymphocyteCount, cReactiveProtein
 *   3. trace-elements:       serumZinc, serumCopper, serumSelenium
 *   4. vitamins:             vitaminD25Hydroxy, vitaminB12Level, redBloodCellFolate,
 *                            methylmalonicAcid, homocysteineLevel
 *   5. iron-studies:         serumIron, totalIronBindingCapacity, ferritinLevel
 *   6. metabolic-indices:    nitrogenBalance, indirectCalorimetryREE, respiratoryQuotient,
 *                            prognosticNutritionalIndex, nutritionRiskScreeningScore,
 *                            subjectiveGlobalAssessment, refeedingSyndromeRisk,
 *                            micronutrientDeficiencies
 *
 * Field handling:
 *   - NUMBER  → num-stepper (type="text" inputMode="decimal") — hide-zero (0/absent hidden, NEVER
 *               truthiness) EXCEPT a doctor-edited 0 stays visible (numberVisible)
 *   - STRINGS → click-to-edit textarea with splitBySentence decomposition
 *   - ARRAYS OF STRINGS → per-item editing with arrayIndex
 *
 * No top-level `date` field → TITLE-ONLY record header (no date badge).
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import NutritionLabMonitoringDocumentPDFTemplate from '../pdf-templates/NutritionLabMonitoringDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './NutritionLabMonitoringDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'nutrition_lab_monitoringPendingEdits';
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
const SECTION_ORDER = ['visceral-proteins', 'immune-inflammation', 'trace-elements', 'vitamins', 'iron-studies', 'metabolic-indices'];

const SECTION_TITLES = {
  'visceral-proteins': 'Visceral Proteins',
  'immune-inflammation': 'Immune & Inflammation',
  'trace-elements': 'Trace Elements',
  'vitamins': 'Vitamins',
  'iron-studies': 'Iron Studies',
  'metabolic-indices': 'Metabolic & Indices',
};

const FIELD_LABELS = {
  prealbumin: 'Prealbumin',
  serumAlbumin: 'Serum Albumin',
  transferrinLevel: 'Transferrin Level',
  retinolBindingProtein: 'Retinol Binding Protein',
  totalLymphocyteCount: 'Total Lymphocyte Count',
  cReactiveProtein: 'C-Reactive Protein',
  serumZinc: 'Serum Zinc',
  serumCopper: 'Serum Copper',
  serumSelenium: 'Serum Selenium',
  vitaminD25Hydroxy: 'Vitamin D 25-Hydroxy',
  vitaminB12Level: 'Vitamin B12 Level',
  redBloodCellFolate: 'Red Blood Cell Folate',
  methylmalonicAcid: 'Methylmalonic Acid',
  homocysteineLevel: 'Homocysteine Level',
  serumIron: 'Serum Iron',
  totalIronBindingCapacity: 'Total Iron Binding Capacity',
  ferritinLevel: 'Ferritin Level',
  nitrogenBalance: 'Nitrogen Balance',
  indirectCalorimetryREE: 'Indirect Calorimetry REE',
  respiratoryQuotient: 'Respiratory Quotient',
  prognosticNutritionalIndex: 'Prognostic Nutritional Index',
  nutritionRiskScreeningScore: 'Nutrition Risk Screening Score',
  subjectiveGlobalAssessment: 'Subjective Global Assessment',
  refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  micronutrientDeficiencies: 'Micronutrient Deficiencies',
};

const SECTION_FIELDS = {
  'visceral-proteins': ['prealbumin', 'serumAlbumin', 'transferrinLevel', 'retinolBindingProtein'],
  'immune-inflammation': ['totalLymphocyteCount', 'cReactiveProtein'],
  'trace-elements': ['serumZinc', 'serumCopper', 'serumSelenium'],
  'vitamins': ['vitaminD25Hydroxy', 'vitaminB12Level', 'redBloodCellFolate', 'methylmalonicAcid', 'homocysteineLevel'],
  'iron-studies': ['serumIron', 'totalIronBindingCapacity', 'ferritinLevel'],
  'metabolic-indices': ['nitrogenBalance', 'indirectCalorimetryREE', 'respiratoryQuotient', 'prognosticNutritionalIndex', 'nutritionRiskScreeningScore', 'subjectiveGlobalAssessment', 'refeedingSyndromeRisk', 'micronutrientDeficiencies'],
};

// STRINGS → click-to-edit textarea with splitBySentence decomposition
const STRING_FIELDS = ['subjectiveGlobalAssessment', 'refeedingSyndromeRisk'];
// NUMBER → hide at 0 (numeric top-level 0/absent = "not measured" sentinel → hidden)
const NUMBER_FIELDS = ['prealbumin', 'serumAlbumin', 'transferrinLevel', 'totalLymphocyteCount', 'retinolBindingProtein', 'serumZinc', 'serumCopper', 'serumSelenium', 'vitaminD25Hydroxy', 'vitaminB12Level', 'redBloodCellFolate', 'serumIron', 'totalIronBindingCapacity', 'ferritinLevel', 'methylmalonicAcid', 'homocysteineLevel', 'cReactiveProtein', 'nitrogenBalance', 'indirectCalorimetryREE', 'respiratoryQuotient', 'prognosticNutritionalIndex', 'nutritionRiskScreeningScore'];
// Arrays of strings → per-item editing with arrayIndex
const ARRAY_FIELDS = ['micronutrientDeficiencies'];
const DATE_FIELDS = [];

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (thousands/whitespace guard) */
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

/* numeric presence check — 0 and absent are hidden, never truthiness */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

/* ═══════ COMPONENT ═══════ */
const NutritionLabMonitoringDocument = ({ document: docProp }) => {
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
    const pick = (r) => r?.nutrition_lab_monitoring;
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      const p = pick(r);
      if (p) return Array.isArray(p) ? p : [p];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; const pp = pick(dd); if (pp) return Array.isArray(pp) ? pp : [pp]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = safeId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      // Group array-item drafts so the whole array can be reconstructed under one localEdits key.
      const arrayBuckets = {};
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        if (dotIdx !== -1 && /^\d+$/.test(tail)) {
          const field = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(tail, 10);
          if (!arrayBuckets[field]) arrayBuckets[field] = {};
          arrayBuckets[field][arrIdx] = value;
          nFields[`${field}-${idx}-i${arrIdx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        }
      });
      Object.entries(arrayBuckets).forEach(([field, byIndex]) => {
        const base = Array.isArray(record[field]) ? [...record[field]] : [];
        Object.entries(byIndex).forEach(([aIdx, val]) => { base[parseInt(aIdx, 10)] = val; });
        const editKey = `${field}-${idx}`;
        nLocal[editKey] = base;
        nPending[editKey] = true;
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nFields).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, safeId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (Array.isArray(v)) return v.join(', '); return String(v || ''); }, []);

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

  // Per-field presence
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
    return hasVal(v);
  }, [hasVal]);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

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

  /* display string for a field (arrays/numbers normalized) */
  const fieldDisplay = useCallback((fn, val) => {
    if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) ? val.join(', ') : fmtVal(val);
    return fmtVal(val);
  }, [fmtVal]);

  // Hide-zero number fields stay visible at 0 ONLY when a doctor explicitly set them
  // (DB doctorEdits.editedFields or a this-session local edit) — so an intentional 0 shows
  // instead of vanishing, while extraction-0 noise stays hidden.
  const numberVisible = useCallback((record, fn, idx) => {
    const v = getFieldValue(record, fn, idx);
    if (hasNumber(v)) return true;
    if (localEdits[`${fn}-${idx}`] !== undefined && String(localEdits[`${fn}-${idx}`]).trim() !== '') return true;
    const de = record && record.doctorEdits && record.doctorEdits.editedFields;
    return Array.isArray(de) && de.includes(fn);
  }, [getFieldValue, localEdits]);

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
      if (fieldHasVal(f, val)) {
        if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (fieldHasVal(fn, val)) {
      return fieldDisplay(fn, val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Nutrition Lab Monitoring ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (fieldHasVal(f, val)) {
            if (fieldDisplay(f, val).toLowerCase().includes(phrase)) return true;
          }
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fieldDisplay, fieldHasVal]);

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
  const handleStartEdit = (field, idx, val) => {
    setEditingField(`${field}-${idx}`);
    setEditValue(val);
    setSaveError(null);
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, field, idx, sectionId, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${field}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][field] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Stage a single edited/removed sentence as a DRAFT (no DB write). localStorage keeps it across
  // refresh; Approve commits it. Mirrors the old splice logic but persistence is deferred.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const stageDraft = (fullText, markFn) => {
      const editKey = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      markFn();
      setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      stageDraft(fullText, () => setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })));
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    stageDraft(fullText, () => {
      const orig = sentences[sentenceIdx] || '';
      const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
      setEditedSentences(prev => {
        const n = { ...prev };
        if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
        const extra = newSentences.length - 1;
        for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
        return n;
      });
    });
  }

  /* array item edit — uses arrayIndex */
  const handleSaveArrayItem = useCallback((record, field, idx, sectionId, arrayIndex, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const cur = getFieldValue(record, field, idx);
    const currentArr = Array.isArray(cur) ? [...cur] : [];
    setSaveError(null);
    currentArr[arrayIndex] = saveVal;
    const editKey = `${field}-${idx}`;
    // localEdits holds the whole array; pendingEdits keys on the array editKey so pdfData skips it until approved.
    setLocalEdits(prev => ({ ...prev, [editKey]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${field}-${idx}-i${arrayIndex}`]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sectionId}-${idx}`]; return n; });

    // Draft store keyed per array element (field.arrayIndex) so Approve can PUT each with its arrayIndex.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${field}.${arrayIndex}`] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  /* ═══════ APPROVE ═══════ */
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
      // Persist each staged field for this section from the localStorage draft store.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedFieldParts = [];
      for (const fieldPart of Object.keys(recDrafts)) {
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        // arrayIndex ONLY when the trailing dot-segment is purely numeric
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(tail);
        const baseField = isArrayElem ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue; // only this section's fields
        const payload = { field: baseField, value: recDrafts[fieldPart] };
        if (isArrayElem) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/nutrition_lab_monitoring/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/nutrition_lab_monitoring/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => delete n[`${f}-${idx}`]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) {
        committedFieldParts.forEach(fp => delete store2[id][fp]);
        if (Object.keys(store2[id]).length === 0) delete store2[id];
        writeDrafts(store2);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[NutritionLabMonitoring] Approve error:', err); } finally { setSaving(false); }
  }, [safeId]);

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
    const lines = []; let n = 1;
    splitBySentence(text).forEach(s => {
      const p = parseLabel(s);
      if (p.isLabeled) {
        const parts = splitByComma(p.value);
        lines.push(`${p.label}:`);
        let m = 1; (parts.length >= 2 ? parts : [p.value]).forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) lines.push(`  ${ip.label}:`);
          lines.push(`  ${m++}. ${String(ip.isLabeled ? ip.value : it).replace(/[;.]+$/, '').trim()}`);
        });
      } else lines.push(`${n++}. ${String(s).replace(/[;.]+$/, '').trim()}`);
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n`;
      const val = getFieldValue(record, f, idx);
      if (NUMBER_FIELDS.includes(f)) {
        if (!numberVisible(record, f, idx)) return;
        body += `${head}1. ${fieldDisplay(f, val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        if (!fieldHasVal(f, val)) return;
        const items = Array.isArray(val) ? val.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
        body += head;
        items.forEach((item, i) => { const p = parseLabel(String(item)); body += `${i + 1}. ${p.value || item}\n`; });
        body += '\n';
      } else {
        if (!hasVal(val)) return;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
          body += head;
          formatSentenceFieldLines(strVal).forEach(l => { body += `${l}\n`; });
          body += '\n';
        } else {
          body += `${head}1. ${strVal}\n\n`;
        }
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${'='.repeat(40)}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, fieldDisplay, fieldHasVal, numberVisible, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = '=== NUTRITION LAB MONITORING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Nutrition Lab Monitoring ${idx + 1}\n${'='.repeat(40)}\n\n`;
      SECTION_ORDER.forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD — num-stepper (hidden when 0/absent unless doctor-edited) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!numberVisible(record, fn, idx)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) handleStartEdit(fn, idx, displayVal); }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence OR a single labeled "Label: v1, v2…" sentence: decompose (never side-by-side) */
    if (sentences.length > 1 || (sentences.length === 1 && parseLabel(sentences[0]).isLabeled)) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
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
                        const ciParsed = parseLabel(ci);
                        return (
                          <div key={ciIdx}>
                            {ciParsed.isLabeled && <div className="nested-subtitle">{highlightText(ciParsed.label)}</div>}
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setSaveError(null); const editKey2 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey2]: fullText2 })); setPendingEdits(prev => ({ ...prev, [editKey2]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); { const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][fn] = fullText2; writeDrafts(store); } setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ciParsed.isLabeled ? ciParsed.value : ci)}</span><span className="edit-indicator">&#9998;</span></div>
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
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); const rid3 = safeId(record); const editKey3 = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey3]: fullText })); setPendingEdits(prev => ({ ...prev, [editKey3]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); if (rid3) { const store = readDrafts(); if (!store[rid3]) store[rid3] = {}; store[rid3][fn] = fullText; writeDrafts(store); } setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
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
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: ARRAY FIELD — per-item editing with arrayIndex ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const rawArr = Array.isArray(val) ? val : splitByComma(String(val));
    const items = rawArr.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {items.map((item, aIdx) => {
          const parsed = parseLabel(String(item));
          const itemVal = parsed.value || String(item);
          const itemKey = `${fn}-${idx}-i${aIdx}`;
          const isEditing = editingField === itemKey;
          const isModified = editedFields[itemKey];
          const itemMatches = phraseMatch || labelMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;

          return (
            <div key={aIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(String(item)); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, sid, aIdx, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content">
                      {parsed.isLabeled && <span className="content-subtitle-label">{highlightText(parsed.label)}</span>}
                      <span className="content-value">{highlightText(itemVal)}</span>
                      <span className="edit-indicator">&#9998;</span>
                    </div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => NUMBER_FIELDS.includes(f) ? numberVisible(record, f, idx) : fieldHasVal(f, getFieldValue(record, f, idx)));
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
            if (DATE_FIELDS.includes(f)) return null;
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
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
      <div className="nutrition-lab-monitoring-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Nutrition Lab Monitoring</h2></div>
        <div className="empty-state">No nutrition lab monitoring records available</div>
      </div>
    );
  }

  return (
    <div className="nutrition-lab-monitoring-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Nutrition Lab Monitoring</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<NutritionLabMonitoringDocumentPDFTemplate document={pdfData} />} fileName="Nutrition_Lab_Monitoring.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search nutrition lab monitoring..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const title = `Nutrition Lab Monitoring ${idx + 1}`;
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <h3 className="record-name">{highlightText(title)}</h3>
              </div>
              {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NutritionLabMonitoringDocument;
