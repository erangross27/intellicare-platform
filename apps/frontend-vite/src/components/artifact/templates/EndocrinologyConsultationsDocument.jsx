/**
 * EndocrinologyConsultationsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: endocrinology_consultations
 *
 * 5 Sections (NO date/provider/facility):
 *   1. glycemic-panel: hemoglobinA1c, fastingPlasmaGlucose, oralGlucoseToleranceTest
 *   2. thyroid-panel: thyroidStimulatingHormone, freeThyroxineT4, freeTriiodothyronineT3,
 *                     thyroglobulinAntibody, thyroidPeroxidaseAntibody
 *   3. adrenal-bone-panel: serumCortisol, dexamethasoneSuppressionTest, acthStimulationTest,
 *                          parathyroidHormone, vitamin25Hydroxy, ionizedCalcium
 *   4. metabolic-hormone-panel: insulinLevel, cPeptide, homaIrIndex, growthHormoneLevelBaseline,
 *                               igf1Level, prolactinLevel, totalTestosterone, freeTestosterone, dheasLevel
 *   5. complications: microalbuminuria, diabeticRetinopathyGrade
 *
 * 24 number fields: input[type=number step=any] + parseFloat + isNaN → block
 * 1 string field: diabeticRetinopathyGrade (textarea)
 * hasVal: true for 0 (number type)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EndocrinologyConsultationsDocumentPDFTemplate from '../pdf-templates/EndocrinologyConsultationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueSelect from '../components/BlueSelect';
import './EndocrinologyConsultationsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'glycemic-panel': 'Glycemic Panel',
  'thyroid-panel': 'Thyroid Panel',
  'adrenal-bone-panel': 'Adrenal & Bone Panel',
  'metabolic-hormone-panel': 'Metabolic & Hormone Panel',
  'complications': 'Complications',
};

const FIELD_LABELS = {
  hemoglobinA1c: 'Hemoglobin A1c (%)',
  fastingPlasmaGlucose: 'Fasting Plasma Glucose (mg/dL)',
  oralGlucoseToleranceTest: 'Oral Glucose Tolerance Test (mg/dL)',
  thyroidStimulatingHormone: 'TSH (mIU/L)',
  freeThyroxineT4: 'Free Thyroxine T4 (ng/dL)',
  freeTriiodothyronineT3: 'Free Triiodothyronine T3 (pg/mL)',
  thyroglobulinAntibody: 'Thyroglobulin Antibody (IU/mL)',
  thyroidPeroxidaseAntibody: 'Thyroid Peroxidase Antibody (IU/mL)',
  serumCortisol: 'Serum Cortisol (mcg/dL)',
  dexamethasoneSuppressionTest: 'Dexamethasone Suppression Test (mcg/dL)',
  acthStimulationTest: 'ACTH Stimulation Test (mcg/dL)',
  parathyroidHormone: 'Parathyroid Hormone (pg/mL)',
  vitamin25Hydroxy: 'Vitamin D 25-Hydroxy (ng/mL)',
  ionizedCalcium: 'Ionized Calcium (mg/dL)',
  insulinLevel: 'Insulin Level (mcIU/mL)',
  cPeptide: 'C-Peptide (ng/mL)',
  homaIrIndex: 'HOMA-IR Index',
  growthHormoneLevelBaseline: 'Growth Hormone Baseline (ng/mL)',
  igf1Level: 'IGF-1 Level (ng/mL)',
  prolactinLevel: 'Prolactin Level (ng/mL)',
  totalTestosterone: 'Total Testosterone (ng/dL)',
  freeTestosterone: 'Free Testosterone (pg/mL)',
  dheasLevel: 'DHEA-S Level (mcg/dL)',
  microalbuminuria: 'Microalbuminuria (mg/L)',
  diabeticRetinopathyGrade: 'Diabetic Retinopathy Grade',
};

const SECTION_FIELDS = {
  'glycemic-panel': ['hemoglobinA1c', 'fastingPlasmaGlucose', 'oralGlucoseToleranceTest'],
  'thyroid-panel': ['thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3', 'thyroglobulinAntibody', 'thyroidPeroxidaseAntibody'],
  'adrenal-bone-panel': ['serumCortisol', 'dexamethasoneSuppressionTest', 'acthStimulationTest', 'parathyroidHormone', 'vitamin25Hydroxy', 'ionizedCalcium'],
  'metabolic-hormone-panel': ['insulinLevel', 'cPeptide', 'homaIrIndex', 'growthHormoneLevelBaseline', 'igf1Level', 'prolactinLevel', 'totalTestosterone', 'freeTestosterone', 'dheasLevel'],
  'complications': ['microalbuminuria', 'diabeticRetinopathyGrade'],
};

const NUMBER_FIELDS = [
  'hemoglobinA1c', 'fastingPlasmaGlucose', 'oralGlucoseToleranceTest',
  'thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3',
  'thyroglobulinAntibody', 'thyroidPeroxidaseAntibody',
  'serumCortisol', 'dexamethasoneSuppressionTest', 'acthStimulationTest',
  'parathyroidHormone', 'vitamin25Hydroxy', 'ionizedCalcium',
  'insulinLevel', 'cPeptide', 'homaIrIndex', 'growthHormoneLevelBaseline',
  'igf1Level', 'prolactinLevel', 'totalTestosterone', 'freeTestosterone',
  'dheasLevel', 'microalbuminuria',
];

const STRING_FIELDS = ['diabeticRetinopathyGrade'];

/* diabeticRetinopathyGrade = KNOWN clinical scale → BlueSelect (ICDR/ETDRS grades). Edit-widget-only. */
const ENUM_FIELDS = ['diabeticRetinopathyGrade'];
const ENUM_OPTIONS = { diabeticRetinopathyGrade: ['None', 'Mild', 'Moderate', 'Severe', 'Proliferative'] };
const enumCanonical = (options, current) => { const cur = String(current ?? '').trim(); return options.find(o => o.toLowerCase() === cur.toLowerCase()) || cur; };
const enumOptionsWith = (options, current) => { const cur = String(current ?? '').trim(); return cur && !options.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...options] : options; };

/* Copy dividers (canonical 4-area mirror). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* WHOLE-PANEL ZERO-SENTINEL: every off-panel analyte defaults to 0 (no endocrine analyte reads exactly 0 — a true
   negative is reported as '<X', not 0). Hide 0 on ALL number fields in every area. */
const isZeroSentinel = (fn, v) => NUMBER_FIELDS.includes(fn) && Number(v) === 0;

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'endocrinology_consultationsPendingEdits';
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
const EndocrinologyConsultationsDocument = ({ document: docProp }) => {
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
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.endocrinology_consultations) return Array.isArray(r.endocrinology_consultations) ? r.endocrinology_consultations : [r.endocrinology_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.endocrinology_consultations) return Array.isArray(dd.endocrinology_consultations) ? dd.endocrinology_consultations : [dd.endocrinology_consultations]; return [dd]; }
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
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
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
      const rt = `Endocrinology Consultation ${idx + 1}`.toLowerCase();
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
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    const trackKey = editTrackingKey || editKey;
    // fieldPart for the draft store: reverse of the editKey's "-idx" suffix (mirrors approve parse)
    const fieldPart = trackKey.slice(0, trackKey.lastIndexOf(`-${idx}`)) || fn;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      if (sid === undefined || sid === null || !prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sid}-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)))
    );
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Staged edits for THIS record that belong to THIS section
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
      const lastDot = fieldPart.lastIndexOf('.');
      const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
        ? fieldPart.slice(0, lastDot) : fieldPart;
      return fields.includes(baseField);
    });
    setSaving(true); setSaveError(null);
    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/endocrinology_consultations/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/endocrinology_consultations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[EndocrinologyConsultations] Approve error:', err);
      setSaveError('Save failed. Please try again.');
    } finally { setSaving(false); }
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
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => { const v = getFieldValue(record, f, idx); return hasVal(v) && !isZeroSentinel(f, v); });
    if (present.length === 0) return '';
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    present.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const v = getFieldValue(record, f, idx);
      const dispVal = ENUM_FIELDS.includes(f) ? enumCanonical(ENUM_OPTIONS[f] || [], v) : fmtVal(v);
      text += `${label}\n${COPY_LINE_DASH}\n1. ${dispVal}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = `Endocrinology Consultations\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      let recordText = `Endocrinology Consultation ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      let hasContent = false;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sec = buildSectionCopyText(r, idx, sid);
        if (sec) { recordText += sec; hasContent = true; }
      });
      if (hasContent) text += recordText + '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER EDITABLE FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isZeroSentinel(fn, val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>&minus;</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING EDITABLE FIELD ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM EDITABLE FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const options = ENUM_OPTIONS[fn] || [];
    const displayVal = enumCanonical(options, val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={enumOptionsWith(options, val)} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val) && !isZeroSentinel(f, val);
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
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid);
            if (STRING_FIELDS.includes(f)) return renderStringField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="endocrinology-consultations-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Endocrinology Consultations</h2></div>
        <div className="empty-state">No endocrinology consultation records available</div>
      </div>
    );
  }

  return (
    <div className="endocrinology-consultations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Endocrinology Consultations</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EndocrinologyConsultationsDocumentPDFTemplate document={pdfData} />} fileName="Endocrinology_Consultations.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search endocrinology consultations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Endocrinology Consultation ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'glycemic-panel')}
            {renderSection(record, idx, 'thyroid-panel')}
            {renderSection(record, idx, 'adrenal-bone-panel')}
            {renderSection(record, idx, 'metabolic-hormone-panel')}
            {renderSection(record, idx, 'complications')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EndocrinologyConsultationsDocument;
