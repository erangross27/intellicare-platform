/**
 * DietaryInterventionsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dietary_interventions
 *
 * 9 Sections:
 *   1. nutritional-assessment: nutritionalAssessmentScore, baselineBodyMassIndex, targetCaloricIntake, proteinRequirement
 *   2. diet-type-restrictions: therapeuticDietType, dietaryRestrictions[], sodiumRestrictionLevel, fluidRestrictionVolume
 *   3. glycemic-management: glycemicTargetRange, carbohydrateCountingPrescribed (boolean)
 *   4. supplementation: nutritionalSupplementation[], enteralNutritionFormula, parenteralNutritionComposition
 *   5. deficiencies-allergies: micronutrientDeficiencies[], foodAllergenAvoidance[]
 *   6. dysphagia: dysphagiaTextureLevel
 *   7. goals: weightChangeGoal, interventionDurationWeeks, adherenceMonitoringMethod
 *   8. labs: baselineAlbuminLevel, baselinePrealbuminLevel, estimatedGlomerularFiltrationRate, leftVentricularEjectionFraction
 *   9. malnutrition-risk: malnutritionRiskScore
 *
 * NO date/provider/facility fields.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DietaryInterventionsDocumentPDFTemplate from '../pdf-templates/DietaryInterventionsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DietaryInterventionsDocument.css';

/* Canonical copy dividers (one-pass item 2): '=' under record/section titles,
   '-' under every field sub-label. Every value row is numbered (item 3). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* −/+ stepper step = the value's own smallest digit (decimal-aware): integers step by 1, one-decimal
   values by 0.1, two-decimal by 0.01. The customer TYPES the exact value; we NEVER impose a fixed
   measurement increment (STANDING user directive, July 5 2026, memory 6a4a3fae). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
/* NEGATIVE_OK_FIELDS: weightChangeGoal is legitimately negative (a weight-LOSS goal), so the stepper
   must not clamp it at 0. Every other dietary numeric clamps >= 0. */
const NEGATIVE_OK_FIELDS = new Set(['weightChangeGoal']);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'dietaryInterventionsPendingEdits';
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
  'nutritional-assessment': 'Nutritional Assessment',
  'diet-type-restrictions': 'Diet Type & Restrictions',
  'glycemic-management': 'Glycemic Management',
  'supplementation': 'Supplementation',
  'deficiencies-allergies': 'Deficiencies & Allergies',
  'dysphagia': 'Dysphagia',
  'goals': 'Goals',
  'labs': 'Labs',
  'malnutrition-risk': 'Malnutrition Risk',
};

const FIELD_LABELS = {
  nutritionalAssessmentScore: 'Nutritional Assessment Score',
  baselineBodyMassIndex: 'Baseline BMI',
  targetCaloricIntake: 'Target Caloric Intake',
  proteinRequirement: 'Protein Requirement',
  therapeuticDietType: 'Therapeutic Diet Type',
  dietaryRestrictions: 'Dietary Restrictions',
  sodiumRestrictionLevel: 'Sodium Restriction Level',
  fluidRestrictionVolume: 'Fluid Restriction Volume',
  glycemicTargetRange: 'Glycemic Target Range',
  carbohydrateCountingPrescribed: 'Carbohydrate Counting Prescribed',
  nutritionalSupplementation: 'Nutritional Supplementation',
  enteralNutritionFormula: 'Enteral Nutrition Formula',
  parenteralNutritionComposition: 'Parenteral Nutrition Composition',
  micronutrientDeficiencies: 'Micronutrient Deficiencies',
  foodAllergenAvoidance: 'Food Allergen Avoidance',
  dysphagiaTextureLevel: 'Dysphagia Texture Level',
  weightChangeGoal: 'Weight Change Goal',
  interventionDurationWeeks: 'Intervention Duration (Weeks)',
  adherenceMonitoringMethod: 'Adherence Monitoring Method',
  baselineAlbuminLevel: 'Baseline Albumin Level',
  baselinePrealbuminLevel: 'Baseline Prealbumin Level',
  estimatedGlomerularFiltrationRate: 'eGFR',
  leftVentricularEjectionFraction: 'LVEF',
  malnutritionRiskScore: 'Malnutrition Risk Score',
};

const SECTION_FIELDS = {
  'nutritional-assessment': ['nutritionalAssessmentScore', 'baselineBodyMassIndex', 'targetCaloricIntake', 'proteinRequirement'],
  'diet-type-restrictions': ['therapeuticDietType', 'dietaryRestrictions', 'sodiumRestrictionLevel', 'fluidRestrictionVolume'],
  'glycemic-management': ['glycemicTargetRange', 'carbohydrateCountingPrescribed'],
  'supplementation': ['nutritionalSupplementation', 'enteralNutritionFormula', 'parenteralNutritionComposition'],
  'deficiencies-allergies': ['micronutrientDeficiencies', 'foodAllergenAvoidance'],
  'dysphagia': ['dysphagiaTextureLevel'],
  'goals': ['weightChangeGoal', 'interventionDurationWeeks', 'adherenceMonitoringMethod'],
  'labs': ['baselineAlbuminLevel', 'baselinePrealbuminLevel', 'estimatedGlomerularFiltrationRate', 'leftVentricularEjectionFraction'],
  'malnutrition-risk': ['malnutritionRiskScore'],
};

const ARRAY_FIELDS = ['dietaryRestrictions', 'nutritionalSupplementation', 'micronutrientDeficiencies', 'foodAllergenAvoidance'];
const BOOLEAN_FIELDS = ['carbohydrateCountingPrescribed'];
const NUMBER_FIELDS = ['nutritionalAssessmentScore', 'baselineBodyMassIndex', 'targetCaloricIntake', 'proteinRequirement', 'sodiumRestrictionLevel', 'fluidRestrictionVolume', 'weightChangeGoal', 'interventionDurationWeeks', 'baselineAlbuminLevel', 'baselinePrealbuminLevel', 'estimatedGlomerularFiltrationRate', 'leftVentricularEjectionFraction', 'malnutritionRiskScore'];
/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a real clinical value, not a "not set" sentinel.
   For dietary_interventions every numeric field uses 0 as an unfilled sentinel (eGFR/BMI/albumin/calories/
   scores/durations cannot legitimately be 0), so this set is intentionally empty and 0 is always hidden. */
const MEANINGFUL_ZERO_FIELDS = new Set([]);

/* ═══════ COMPONENT ═══════ */
const DietaryInterventionsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
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
      if (r?.dietary_interventions) return Array.isArray(r.dietary_interventions) ? r.dietary_interventions : [r.dietary_interventions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dietary_interventions) return Array.isArray(dd.dietary_interventions) ? dd.dietary_interventions : [dd.dietary_interventions]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
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
  /* fieldHasVal: for NUMBER_FIELDS not in MEANINGFUL_ZERO_FIELDS, a value of 0 is a "not set" sentinel and is hidden. */
  const fieldHasVal = useCallback((fn, v) => {
    if (NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.has(fn)) {
      if (v === null || v === undefined || v === '') return false;
      const n = parseFloat(v); if (isNaN(n)) return false; return n !== 0;
    }
    return hasVal(v);
  }, [hasVal]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  /* −/+ stepper: nudge editValue by the value's own precision (stepFor), rounded to that precision.
     Clamped >= 0 except for NEGATIVE_OK_FIELDS (weightChangeGoal = a weight-loss goal). */
  const stepEditValue = (fn, dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const base = isNaN(n) ? 0 : n;
      const stepStr = stepFor(prev);
      const step = parseFloat(stepStr) || 1;
      const decimals = (stepStr.split('.')[1] || '').length;
      let next = parseFloat((base + dir * step).toFixed(decimals));
      if (next < 0 && !NEGATIVE_OK_FIELDS.has(fn)) next = 0;
      return String(next);
    });
  };

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr) || arrIdx >= arr.length) return undefined;
    return arr[arrIdx];
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (String(item).toLowerCase().includes(phrase)) return true;
          }
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
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dietary Interventions ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2) {
            const [arrField, arrIdx] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            merged[arrField][parseInt(arrIdx)] = localEdits[key];
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
  const handleSaveField = useCallback((record, fn, idx, _sid, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    if (NUMBER_FIELDS.includes(fn)) { saveVal = parseFloat(saveVal); if (isNaN(saveVal)) { setSaveError('Please enter a valid number'); return; } }
    if (BOOLEAN_FIELDS.includes(fn)) { saveVal = saveVal === 'yes' || saveVal === true; }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    if (_sid) {
      setApprovedSections(prev => {
        const sk = `${_sid}-${idx}`;
        if (!prev[sk]) return prev;
        const next = { ...prev }; delete next[sk]; return next;
      });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value, _sid) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const fieldPart = `${fn}.${arrIdx}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    if (_sid) {
      setApprovedSections(prev => {
        const sk = `${_sid}-${idx}`;
        if (!prev[sk]) return prev;
        const next = { ...prev }; delete next[sk]; return next;
      });
    }
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)))
    );
  }, [editedFields]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // This section's staged (pending) edits — key "field-idx" (scalar/bool) or "field.arrayIndex-idx".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return fields.includes(baseField);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayElement = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayElement ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElement) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/dietary_interventions/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/dietary_interventions/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[DietaryInterventions] Approve error:', err); setSaveError('Save failed. Please try again.'); } finally { setSaving(false); }
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
  /* Canonical section copy: title + '=', every field = sub-label + '-' + numbered value row(s).
     NEVER side-by-side "Label: value" (one-pass items 1-3). Booleans Yes/No; array fields → sub-label
     + numbered items. single-name rule (item 4): field label == section title → hide the sub-label.
     Sentinel-zero/empty fields are skipped (fieldHasVal). */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sl = label.toLowerCase() !== title.toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!fieldHasVal(f, val)) return;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(x => x || x === 0) : [];
        if (arr.length === 0) return;
        if (sl) text += `${label}\n${COPY_LINE_DASH}\n`;
        arr.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else {
        const value = BOOLEAN_FIELDS.includes(f) ? (val ? 'Yes' : 'No') : fmtVal(val);
        text += `${label}\n${COPY_LINE_DASH}\n1. ${value}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, fmtVal, fieldHasVal]);

  const copyAllText = useCallback(async () => {
    let text = `Dietary Interventions\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Dietary Interventions ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const section = buildSectionCopyText(r, idx, sid);
        // Empty-section guard: a section with only its title + '=' divider (<=2 non-empty lines) has
        // no real content — skip it so the many all-sentinel sections don't leak their headings.
        if (section.split('\n').filter(l => l.trim()).length > 2) text += section;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!fieldHasVal(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container" onClick={e => e.stopPropagation()}>
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, 1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'yes' : 'no'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, editValue === 'yes'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (string[]) ═══════ */
  const renderArrayField = (record, idx, fn, sid) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          const itemVal = getArrayItemValue(record, fn, idx, arrIdx) ?? item;
          if (!itemVal && itemVal !== 0) return null;

          if (searchTerm.trim() && !phraseMatch) {
            const phrase = searchTerm.toLowerCase().trim();
            if (!String(itemVal).toLowerCase().includes(phrase) && !label.toLowerCase().includes(phrase)) return null;
          }

          const itemEditKey = `${fn}.${arrIdx}-${idx}`;
          const itemEditing = editingField === itemEditKey;
          const itemBadge = editedFields[itemEditKey];

          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${itemBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!itemEditing) { setEditingField(itemEditKey); setEditValue(String(itemVal)); setSaveError(null); } }}>
                {itemEditing ? (
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
                    <div className="row-content"><span className="content-value">{highlightText(String(itemVal))}</span><span className="edit-indicator">{'\u270E'}</span></div>
                    <button className={`copy-btn ${copiedItems[itemEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(itemVal), itemEditKey); }}>{copiedItems[itemEditKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {itemBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
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
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].length > 0;
      return fieldHasVal(f, val);
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, idx, f, sid);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dietary-interventions-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dietary Interventions</h2></div>
        <div className="empty-state">No dietary interventions records available</div>
      </div>
    );
  }

  return (
    <div className="dietary-interventions-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dietary Interventions</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DietaryInterventionsDocumentPDFTemplate document={pdfData} />} fileName="Dietary_Interventions.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dietary interventions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dietary Interventions ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'nutritional-assessment')}
            {renderSection(record, idx, 'diet-type-restrictions')}
            {renderSection(record, idx, 'glycemic-management')}
            {renderSection(record, idx, 'supplementation')}
            {renderSection(record, idx, 'deficiencies-allergies')}
            {renderSection(record, idx, 'dysphagia')}
            {renderSection(record, idx, 'goals')}
            {renderSection(record, idx, 'labs')}
            {renderSection(record, idx, 'malnutrition-risk')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DietaryInterventionsDocument;
