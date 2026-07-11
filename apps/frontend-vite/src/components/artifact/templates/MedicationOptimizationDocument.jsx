/**
 * MedicationOptimizationDocument.jsx
 * June 2026 — mini-card checklist (697ba540) + full INLINE EDITING (editing checklist 69994f28).
 * Collection: medication_optimization   (component name MedicationOptimizationDocument — routing depends on it)
 *
 * Display: section -> mini-cards-container (header INSIDE) -> rec-mini-card per top-level field ->
 *   recursive renderNode. A LABEL is a nested-subtitle on its own line; a VALUE is a numbered-row.
 *   NO "Label: value" inline, NO numbering. hide-empty everywhere (numbers hide at 0).
 * Editing: every scalar LEAF (string/number/boolean) anywhere in the nested tree is click-to-edit
 *   with a type-aware editor (textarea / number input / Yes-No select). On save it deep-clones the
 *   top-level field, sets the leaf, and persists the leaf via a dot-path (e.g.
 *   "currentMedications.0.dose" or "deprescribingOpportunities.0.rationale")
 *   to /api/edit/medication_optimization/:id/edit (the route allows any path whose ROOT is in ALLOWED_FIELDS).
 *   Narrative strings use per-sentence editing. Per-section Pending Approve -> Approved.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import MedicationOptimizationDocumentPDFTemplate from '../pdf-templates/MedicationOptimizationDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './MedicationOptimizationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, paths: { [dotField]: leafValue } } } }
   editKey = `${fn}-${idx}` (the localEdits key); value = the merged top-level field value;
   paths = the exact { field: dotField, value } PUTs to replay on Approve. */
const DRAFT_KEY = 'medication_optimizationPendingEdits';
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
  currentMeds: 'Current Medications',
  renalHepatic: 'Renal & Hepatic Function',
  interactions: 'Interactions & Duplicates',
  therapeuticLevels: 'Therapeutic Levels',
  optimization: 'Optimization & Deprescribing',
  adherenceCost: 'Adherence & Cost',
  pharmacogenomics: 'Pharmacogenomics & Monitoring',
};
/* fields that belong to each section (in display order) */
const SECTION_FIELDS = {
  currentMeds: ['currentMedications', 'medicationAllergies'],
  renalHepatic: ['creatinineClearance', 'estimatedGFR', 'hepaticFunction'],
  interactions: ['drugInteractions', 'therapeuticDuplicates', 'cyp450Interactions', 'contraindications', 'beersListMedications'],
  therapeuticLevels: ['targetTherapeuticLevels', 'currentTherapeuticLevels'],
  optimization: ['dosageOptimization', 'deprescribingOpportunities', 'indicationAppropriatenessReview', 'medicationErrors'],
  adherenceCost: ['adherenceAssessment', 'medicationCostAnalysis', 'pillBurdenAssessment', 'formularyStatus'],
  pharmacogenomics: ['pharmacogeneticTesting', 'adverseEventMonitoring', 'medicationTimingOptimization'],
};
const SECTION_ORDER = ['currentMeds', 'renalHepatic', 'interactions', 'therapeuticLevels', 'optimization', 'adherenceCost', 'pharmacogenomics'];
/* fields rendered as per-sentence editable narrative */
const NARRATIVE_FIELDS = new Set(['hepaticFunction', 'adherenceAssessment', 'medicationCostAnalysis', 'pharmacogeneticTesting', 'medicationTimingOptimization']);

const FIELD_LABELS = {
  currentMedications: 'Current Medications', medicationAllergies: 'Medication Allergies',
  creatinineClearance: 'Creatinine Clearance', estimatedGFR: 'Estimated GFR', hepaticFunction: 'Hepatic Function',
  drugInteractions: 'Drug Interactions', therapeuticDuplicates: 'Therapeutic Duplicates', cyp450Interactions: 'CYP450 Interactions', contraindications: 'Contraindications', beersListMedications: 'Beers List Medications',
  targetTherapeuticLevels: 'Target Therapeutic Levels', currentTherapeuticLevels: 'Current Therapeutic Levels',
  dosageOptimization: 'Dosage Optimization', deprescribingOpportunities: 'Deprescribing Opportunities', indicationAppropriatenessReview: 'Indication Appropriateness Review', medicationErrors: 'Medication Errors',
  adherenceAssessment: 'Adherence Assessment', medicationCostAnalysis: 'Medication Cost Analysis', pillBurdenAssessment: 'Pill Burden Assessment', formularyStatus: 'Formulary Status',
  pharmacogeneticTesting: 'Pharmacogenetic Testing', adverseEventMonitoring: 'Adverse Event Monitoring', medicationTimingOptimization: 'Medication Timing Optimization',
};

const KEY_OVERRIDES = {
  cyp450Interactions: 'CYP450 Interactions', estimatedGFR: 'Estimated GFR', gfr: 'GFR', abi: 'ABI', cyp2c19: 'CYP2C19', cyp2d6: 'CYP2D6', cyp2c9: 'CYP2C9',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ═══════ VALUE HELPERS ═══════ */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const deepClone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const setByPath = (obj, pathArr, val) => { let cur = obj; for (let i = 0; i < pathArr.length - 1; i++) cur = cur[pathArr[i]]; cur[pathArr[pathArr.length - 1]] = val; };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const buildCopyLines = (label, value, indent) => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (Array.isArray(value)) {
    if (label) out.push(`${pad}${label}:`);
    let n = 1;
    value.filter(x => !isEmptyDeep(x)).forEach(item => {
      if (isScalar(item)) { out.push(`${pad}${n++}. ${fmtScalar(item)}`); return; }
      const e = Object.entries(item).filter(([, v]) => !isEmptyDeep(v)); if (!e.length) return;
      const head = isScalar(e[0][1]) ? fmtScalar(e[0][1]) : '';
      if (head && e.length === 2 && isScalar(e[1][1])) out.push(`${pad}${n++}. ${head}: ${fmtScalar(e[1][1])}`);
      else if (head) { out.push(`${pad}${n++}. ${head}`); e.slice(1).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 2))); }
      else { out.push(`${pad}${n++}.`); e.forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1))); }
    });
    return out;
  }
  if (label) out.push(`${pad}${label}:`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

/* ═══════ COMPONENT ═══════ */
const MedicationOptimizationDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});   // nested leaf edits: `${dotPath}@@${idx}` -> 'edited'
  const [editedSentences, setEditedSentences] = useState({}); // narrative: `${fn}-${idx}-s${i}`
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.medication_optimization) return Array.isArray(r.medication_optimization) ? r.medication_optimization : [r.medication_optimization];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.medication_optimization) return Array.isArray(dd.medication_optimization) ? dd.medication_optimization : [dd.medication_optimization]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        // editKey is `${fn}-${idx0}` from the ORIGINAL save; re-key to THIS render index.
        const m = editKey.match(/^(.+)-(\d+)$/);
        const fn = m ? m[1] : editKey;
        const renderKey = `${fn}-${idx}`;
        nLocal[renderKey] = draft && Object.prototype.hasOwnProperty.call(draft, 'value') ? draft.value : draft;
        nPending[renderKey] = true;
        const paths = (draft && draft.paths) || {};
        Object.keys(paths).forEach(dotField => { nFields[`${dotField}@@${idx}`] = 'edited'; });
        if (draft && draft.sentences) Object.keys(draft.sentences).forEach(sKey => { nSentences[`${fn}-${idx}-s${sKey}`] = 'edited'; });
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);
  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  /* ═══════ SEARCH ═══════ */
  const sectionSearchText = useCallback((record, sid, idx) => SECTION_FIELDS[sid].map(fn => flattenSearchable(getFieldValue(record, fn, idx))).join(' '), [getFieldValue]);
  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if ((SECTION_TITLES[sid] || '').toLowerCase().includes(phrase)) return true;
    return sectionSearchText(record, sid, idx).toLowerCase().includes(phrase);
  }, [searchTerm, sectionSearchText]);
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      if (`medication optimization ${idx + 1}`.includes(phrase)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase)) return true; }
      for (const sid of SECTION_ORDER) { if (sectionSearchText(record, sid, idx).toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, sectionSearchText]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const m = key.match(/^(.+)-(\d+)$/); if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key]; });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT: nested scalar LEAF (dot-path save) ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const saveLeaf = useCallback((record, path, idx, sid, newVal) => {
    const recordId = safeId(record); if (!recordId) return;
    const fn = path[0]; const subPath = path.slice(1);
    const clone = deepClone(getFieldValue(record, fn, idx));
    if (subPath.length === 0) return; // top-level scalar handled by saveTopScalar
    try { setByPath(clone, subPath, newVal); } catch (e) { console.error('[MedicationOptimization] setByPath failed', e); setSaveError('Save failed.'); return; }
    const dotField = path.join('.');
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${dotField}@@${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // Stage the DRAFT (merged field value + the exact dot-path PUT to replay on Approve).
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    const entry = store[recordId][editKey] || { value: clone, paths: {} };
    entry.value = clone;
    if (!entry.paths) entry.paths = {};
    entry.paths[dotField] = newVal;
    store[recordId][editKey] = entry;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  /* save a top-level scalar number (creatinineClearance / estimatedGFR / pillBurdenAssessment) */
  const saveTopScalar = useCallback((record, fn, idx, sid, newVal) => {
    const recordId = safeId(record); if (!recordId) return;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: newVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}@@${idx}`]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    const entry = store[recordId][editKey] || { value: newVal, paths: {} };
    entry.value = newVal;
    if (!entry.paths) entry.paths = {};
    entry.paths[fn] = newVal;
    store[recordId][editKey] = entry;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId]);

  /* one editable scalar cell — type-aware (boolean -> Yes/No select, number -> number, string -> textarea) */
  const editCell = (record, value, path, idx, sid, variant) => {
    const editKey = `${path.join('.')}@@${idx}`;
    const isEditing = editingField === editKey;
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const display = fmtScalar(value);
    const modified = editedFields[editKey] === 'edited';
    const wrapCls = variant === 'head' ? `editable-head ${modified ? 'modified' : ''}` : `numbered-row editable-row ${modified ? 'modified' : ''}`;
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (value ? 'Yes' : 'No') : display); setSaveError(null); } };
    const commit = () => {
      let v;
      if (isBool) v = editValue === 'Yes';
      else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } v = n; }
      else v = editValue;
      if (path.length === 1) saveTopScalar(record, path[0], idx, sid, v);
      else saveLeaf(record, path, idx, sid, v);
    };
    if (isEditing) {
      return (
        <div className={variant === 'head' ? 'editable-head editing' : 'numbered-row'} key={editKey}>
          <div className="edit-field-container">
            {isBool ? (
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
            ) : isNum ? (
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) - 1)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseFloat(editValue); setEditValue(String((isNaN(cur) ? 0 : cur) + 1)); }}>+</button>
              </div>
            ) : (
              <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commit(); } }} />
            )}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commit(); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    if (variant === 'head') {
      return (
        <div key={editKey} className={`nested-subtitle ${wrapCls}`} onClick={startEdit} title="Click to edit">
          {highlightText(display)}<span className="edit-indicator">&#9998;</span>
        </div>
      );
    }
    return (
      <div className={wrapCls} key={editKey} onClick={startEdit}>
        <div className="row-content"><span className="content-value">{highlightText(display)}</span><span className="edit-indicator">&#9998;</span></div>
        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
      </div>
    );
  };

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fns = SECTION_FIELDS[sid];
    if (Object.keys(editedSentences).some(k => fns.some(fn => k.startsWith(`${fn}-${idx}-s`)))) return true;
    return Object.keys(editedFields).some(k => { const [dot, kIdx] = k.split('@@'); if (kIdx !== String(idx)) return false; return fns.some(fn => dot === fn || dot.startsWith(`${fn}.`)); });
  }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fns = SECTION_FIELDS[sid];
    try {
      // Replay each staged dot-path PUT for this record's section fields.
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedEditKeys = [];
      for (const fn of fns) {
        const editKey = `${fn}-${idx}`;
        if (!pendingEdits[editKey]) continue;
        const draft = recDrafts[editKey];
        const paths = (draft && draft.paths) || {};
        for (const dotField of Object.keys(paths)) {
          const resp = await secureApiClient.put(`/api/edit/medication_optimization/${id}/edit`, { field: dotField, value: paths[dotField] });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
        committedEditKeys.push(editKey);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/medication_optimization/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedEditKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store2 = readDrafts();
      if (store2[id]) { committedEditKeys.forEach(k => delete store2[id][k]); if (Object.keys(store2[id]).length === 0) delete store2[id]; writeDrafts(store2); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const [dot, kIdx] = k.split('@@'); if (kIdx === String(idx) && fns.some(fn => dot === fn || dot.startsWith(`${fn}.`))) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (fns.some(fn => k.startsWith(`${fn}-${idx}-s`))) delete n[k]; }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId, pendingEdits]);
  const renderApproveButton = (record, sid, idx) => {
    if (sectionHasEdits(idx, sid)) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (approvedSections[`${sid}-${idx}`]) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    let body = '';
    SECTION_FIELDS[sid].forEach(fn => {
      const val = getFieldValue(record, fn, idx);
      if (isEmptyDeep(val)) return;
      const label = FIELD_LABELS[fn] || humanizeKey(fn);
      if (NARRATIVE_FIELDS.has(fn) && typeof val === 'string') { body += `${label}:\n`; (splitBySentence(val).length > 1 ? splitBySentence(val) : [val]).forEach(s => { body += `  ${s}\n`; }); }
      else if (isScalar(val)) { body += `${label}:\n  ${fmtScalar(val)}\n`; } // label above value — never a side-by-side "Label: value"
      else buildCopyLines(label, val, 0).forEach(l => { body += `${l}\n`; });
    });
    if (!body) return '';
    return `${SECTION_TITLES[sid].toUpperCase()}\n${'='.repeat(40)}\n${body}\n`;
  }, [getFieldValue, splitBySentence]);
  const copyAllText = useCallback(async () => {
    let text = '=== MEDICATION OPTIMIZATION ===\n\n';
    pdfData.forEach((r, idx) => { text += `Medication Optimization ${idx + 1}\n${'='.repeat(40)}\n\n`; SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); }); });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: recursive node — labels = nested-subtitle; scalar leaves = editable cells ═══════ */
  const renderNode = (record, label, value, path, idx, sid, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';

    if (isScalar(value)) {
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {editCell(record, value, path, idx, sid, 'row')}
        </React.Fragment>
      );
    }

    if (Array.isArray(value)) {
      const items = value.filter(x => !isEmptyDeep(x));
      if (items.length === 0) return null;
      // map kept indices to ORIGINAL indices so dot-paths stay correct after hide-empty
      const indexed = []; value.forEach((it, oi) => { if (!isEmptyDeep(it)) indexed.push([oi, it]); });
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {indexed.map(([oi, item]) => {
            const ipath = [...path, oi];
            if (isScalar(item)) return editCell(record, item, ipath, idx, sid, 'row');
            const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
            if (entries.length === 0) return null;
            const headScalar = isScalar(entries[0][1]);
            const rest = headScalar ? entries.slice(1) : entries;
            // Orphan prevention: a head with no sub-fields renders as a plain row, not a lone subtitle
            if (headScalar && rest.length === 0) {
              return <div className="rec-mini-card" key={ipath.join('.')}>{editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'row')}</div>;
            }
            return (
              <div className="rec-mini-card" key={ipath.join('.')}>
                {headScalar ? editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'head') : null}
                {rest.map(([k, v]) => (
                  isScalar(v) ? (
                    <div className="nested-mini-card" key={k}>
                      <div className="nested-subtitle sub-label">{highlightText(humanizeKey(k))}</div>
                      {editCell(record, v, [...ipath, k], idx, sid, 'row')}
                    </div>
                  ) : (
                    <div className="nested-mini-card" key={k}>
                      {renderNode(record, humanizeKey(k), v, [...ipath, k], idx, sid, depth + 2)}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </React.Fragment>
      );
    }

    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('.')}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">{entries.map(([k, v]) => renderNode(record, humanizeKey(k), v, [...path, k], idx, sid, depth + 1))}</div>
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: narrative field (per-sentence editable) ═══════ */
  const renderNarrative = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    const sentences = splitBySentence(String(val));
    const rows = sentences.length > 1 ? sentences : [String(val)];
    // Save = stage a DRAFT locally + localStorage (survives refresh). Committed to DB only on Approve.
    const saveSentence = (sIdx) => {
      const id = safeId(record); if (!id) return;
      const current = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const editedVal = editValue.trim();
      const updated = current.length > 1 ? [...current] : [String(getFieldValue(record, fn, idx) || '')];
      if (!editedVal || /^[;.,!?]+$/.test(editedVal)) updated.splice(sIdx, 1); else updated.splice(sIdx, 1, ...splitBySentence(editedVal));
      const fullText = reconstructFullText(updated);
      const editKey = `${fn}-${idx}`;
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}-s`)) delete n[k]; }); n[`${fn}-${idx}-s${sIdx}`] = 'edited'; return n; });
      setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      const entry = store[id][editKey] || { value: fullText, paths: {}, sentences: {} };
      entry.value = fullText;
      if (!entry.paths) entry.paths = {};
      entry.paths[fn] = fullText; // narrative commits the full field string on Approve
      entry.sentences = { [String(sIdx)]: 'edited' };
      store[id][editKey] = entry;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    return (
      <>
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || humanizeKey(fn))}</div>
        {rows.map((sentence, sIdx) => {
          const key = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === key; const badge = editedSentences[key];
          return (
            <div key={sIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(key); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(sIdx); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, key); }}>{copiedItems[key] ? 'Copied' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </>
    );
  };

  /* render one top-level field into its own rec-mini-card */
  const renderField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    if (NARRATIVE_FIELDS.has(fn)) return <div className="rec-mini-card" key={fn}>{renderNarrative(record, fn, idx, sid)}</div>;
    const label = FIELD_LABELS[fn] || humanizeKey(fn);
    // suppress the field label when it duplicates its section title (single-name gate)
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    return <div className="rec-mini-card" key={fn}>{renderNode(record, showLabel ? label : '', val, [fn], idx, sid, 0)}</div>;
  };

  /* ═══════ RENDER: SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid, idx)) return null;
    const cards = SECTION_FIELDS[sid].map(fn => renderField(record, fn, idx, sid)).filter(Boolean);
    if (cards.length === 0) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {cards}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="medication-optimization-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Medication Optimization</h2></div>
        <div className="empty-state">No medication optimization records available</div>
      </div>
    );
  }
  return (
    <div className="medication-optimization-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Medication Optimization</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<MedicationOptimizationDocumentPDFTemplate document={pdfData} />} fileName="Medication_Optimization.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search medication optimization records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Medication Optimization ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicationOptimizationDocument;
