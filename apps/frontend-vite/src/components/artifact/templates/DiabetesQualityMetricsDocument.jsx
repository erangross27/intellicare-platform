/**
 * DiabetesQualityMetricsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: diabetes_quality_metrics
 *
 * 9 Sections:
 *   1. provider-info: provider, facility
 *   2. glycemic-control: hemoglobinA1cValue (number), hemoglobinA1cDate (date), hemoglobinA1cControlled (boolean)
 *   3. cardiovascular-risk: bloodPressureValue, bloodPressureControlled (boolean), ldlCholesterolValue (number), ldlCholesterolControlled (boolean), bmiValue (number)
 *   4. kidney-screening: albuminuriaScreeningDate (date), albuminuriaScreeningResult
 *   5. eye-examination: dilatedEyeExamDate (date), diabeticRetinopathyPresent (boolean)
 *   6. foot-examination: footExaminationDate (date), peripheralNeuropathyPresent (boolean)
 *   7. medications: statinTherapyPrescribed (boolean), aceInhibitorOrArbPrescribed (boolean), aspirinTherapyIndicated (boolean)
 *   8. lifestyle-education: diabetesEducationCompleted (boolean), smokingStatus, tobaccoCessationCounseling (boolean)
 *   9. vaccinations: influenzaVaccinationDate (date), pneumococcalVaccinationDate (date)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiabetesQualityMetricsDocumentPDFTemplate from '../pdf-templates/DiabetesQualityMetricsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './DiabetesQualityMetricsDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'glycemic-control': 'Glycemic Control',
  'cardiovascular-risk': 'Cardiovascular Risk',
  'kidney-screening': 'Kidney Screening',
  'eye-examination': 'Eye Examination',
  'foot-examination': 'Foot Examination',
  'medications': 'Medications',
  'lifestyle-education': 'Lifestyle & Education',
  'vaccinations': 'Vaccinations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  hemoglobinA1cValue: 'HbA1c Value',
  hemoglobinA1cDate: 'HbA1c Date',
  hemoglobinA1cControlled: 'HbA1c Controlled',
  bloodPressureValue: 'Blood Pressure',
  bloodPressureControlled: 'BP Controlled',
  ldlCholesterolValue: 'LDL Cholesterol',
  ldlCholesterolControlled: 'LDL Controlled',
  bmiValue: 'BMI',
  albuminuriaScreeningDate: 'Screening Date',
  albuminuriaScreeningResult: 'Result',
  dilatedEyeExamDate: 'Dilated Eye Exam Date',
  diabeticRetinopathyPresent: 'Diabetic Retinopathy',
  footExaminationDate: 'Foot Exam Date',
  peripheralNeuropathyPresent: 'Peripheral Neuropathy',
  statinTherapyPrescribed: 'Statin Therapy',
  aceInhibitorOrArbPrescribed: 'ACE Inhibitor/ARB',
  aspirinTherapyIndicated: 'Aspirin Therapy',
  diabetesEducationCompleted: 'Diabetes Education',
  smokingStatus: 'Smoking Status',
  tobaccoCessationCounseling: 'Tobacco Cessation Counseling',
  influenzaVaccinationDate: 'Influenza Vaccination',
  pneumococcalVaccinationDate: 'Pneumococcal Vaccination',
};

const SECTION_FIELDS = {
  'provider-info': ['date', 'provider', 'facility'],
  'glycemic-control': ['hemoglobinA1cValue', 'hemoglobinA1cDate', 'hemoglobinA1cControlled'],
  'cardiovascular-risk': ['bloodPressureValue', 'bloodPressureControlled', 'ldlCholesterolValue', 'ldlCholesterolControlled', 'bmiValue'],
  'kidney-screening': ['albuminuriaScreeningDate', 'albuminuriaScreeningResult'],
  'eye-examination': ['dilatedEyeExamDate', 'diabeticRetinopathyPresent'],
  'foot-examination': ['footExaminationDate', 'peripheralNeuropathyPresent'],
  'medications': ['statinTherapyPrescribed', 'aceInhibitorOrArbPrescribed', 'aspirinTherapyIndicated'],
  'lifestyle-education': ['diabetesEducationCompleted', 'smokingStatus', 'tobaccoCessationCounseling'],
  'vaccinations': ['influenzaVaccinationDate', 'pneumococcalVaccinationDate'],
};

const DATE_FIELDS = ['date', 'hemoglobinA1cDate', 'albuminuriaScreeningDate', 'dilatedEyeExamDate', 'footExaminationDate', 'influenzaVaccinationDate', 'pneumococcalVaccinationDate'];
const NUMBER_FIELDS = ['hemoglobinA1cValue', 'ldlCholesterolValue', 'bmiValue'];
/* These are boolean-shaped ONLY when a real boolean is stored. Real records hold DESCRIPTIVE
   strings ("Not at target (<7.0%)", "mild NPDR", "Not prescribed - lifestyle modification
   first") — a Yes/No select would silently overwrite them with a boolean, so the renderer
   falls back to text editing whenever the value is not a true boolean. */
const BOOLEAN_FIELDS = ['hemoglobinA1cControlled', 'bloodPressureControlled', 'ldlCholesterolControlled', 'diabeticRetinopathyPresent', 'peripheralNeuropathyPresent', 'statinTherapyPrescribed', 'aceInhibitorOrArbPrescribed', 'aspirinTherapyIndicated', 'diabetesEducationCompleted', 'tobaccoCessationCounseling'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* HbA1c/LDL/BMI of 0 are physiologically impossible → extractor sentinels, hidden */
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;

const ENUM_FIELDS = { smokingStatus: ['Never', 'Former', 'Current'] };
const enumCanonical = (options, current) => {
  const cur = String(current ?? '').trim();
  const hit = options.find(o => o.toLowerCase() === cur.toLowerCase());
  return hit || cur;
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

/* stepper steps: HbA1c/BMI 0.1, LDL 1; all clamped >= 0 */
const stepForField = (fn) => (fn === 'ldlCholesterolValue' ? 1 : 0.1);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; no array fields here) */
const DRAFT_KEY = 'diabetes_quality_metricsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
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
const DiabetesQualityMetricsDocument = ({ document: docProp }) => {
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
      if (r?.diabetes_quality_metrics) return Array.isArray(r.diabetes_quality_metrics) ? r.diabetes_quality_metrics : [r.diabetes_quality_metrics];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_quality_metrics) return Array.isArray(dd.diabetes_quality_metrics) ? dd.diabetes_quality_metrics : [dd.diabetes_quality_metrics]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE PENDING DRAFTS (localStorage) ═══════ */
  // A Save survives refresh (shown in JSX, NOT in DB/PDF) until the user clicks Approve.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
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

  /* sentinel-aware visibility: 0 in a measured numeric = "not measured" → hidden */
  const fieldShows = useCallback((fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && HIDE_ZERO_FIELDS.includes(fn)), [hasVal]);

  /* stepper helper: adjust editValue by the field's step, clamped >= 0 */
  const stepEditValue = (fn, dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      let next = (isNaN(n) ? 0 : n) + dir * stepForField(fn);
      next = Math.round(next * 10) / 10;
      if (next < 0) next = 0;
      return String(next);
    });
  };

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

  /* ═══════ DISPLAY HELPERS ═══════ */
  const displayFieldValue = useCallback((fn, val) => {
    if (DATE_FIELDS.includes(fn)) return formatDate(val);
    if (fn === 'hemoglobinA1cValue' && hasVal(val)) return `${fmtVal(val)}%`;
    if (fn === 'ldlCholesterolValue' && hasVal(val)) return `${fmtVal(val)} mg/dL`;
    return fmtVal(val);
  }, [hasVal, fmtVal]);

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
        const display = displayFieldValue(f, val).toLowerCase();
        if (display.includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, displayFieldValue]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      const display = displayFieldValue(fn, val).toLowerCase();
      if (display.includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, displayFieldValue]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Diabetes Quality Metrics ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined) {
            const display = displayFieldValue(f, val).toLowerCase();
            if (display.includes(phrase)) return true;
          }
        }
      }
      // Also check top-level date
      if (record.date) {
        const dateStr = formatDate(record.date).toLowerCase();
        if (dateStr.includes(phrase)) return true;
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, displayFieldValue]);

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
  const handleSaveField = useCallback((record, fn, idx, _sid, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => {
      const sectionKey = `${_sid}-${idx}`;
      if (!prev[sectionKey]) return prev;
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k === `${f}-${idx}`));
  }, [editedFields]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Staged edits for this section's fields (key = "field-idx"; no array fields in this template)
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        return fields.includes(fieldPart);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" (no array fields here)
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = (lastDot !== -1 && /^\d+$/.test(trailing))
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(trailing, 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        await secureApiClient.put(`/api/edit/diabetes_quality_metrics/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/diabetes_quality_metrics/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
    } catch (err) {
      console.error('[DiabetesQualityMetrics] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ COPY TEXT BUILDERS ═══════ */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldShows(f, val)) return;
      const dv = displayFieldValue(f, val);
      if (!dv) return;
      text += `${label}\n${COPY_LINE_DASH}\n1. ${dv}\n\n`;
    });
    return text;
  }, [getFieldValue, fieldShows, displayFieldValue]);

  const copyAllText = useCallback(async () => {
    let text = `Diabetes Quality Metrics\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diabetes Quality Metrics ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const sectionText = buildSectionCopyText(r, idx, sid);
        // skip empty sections: title + divider alone is 2 non-empty lines
        if (sectionText.split('\n').filter(l => l.trim()).length > 2) text += sectionText;
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
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldShows(fn, val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = displayFieldValue(fn, val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(fn, -1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(typeof val === 'boolean' ? (val ? 'yes' : 'no') : String(val).toLowerCase()); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveField(record, fn, idx, sid, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
  const renderEditableField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
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
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: ENUM FIELD (fixed-choice dropdown) ═══════ */
  const renderEnumField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const strVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const options = enumOptionsWith(ENUM_FIELDS[fn], strVal);

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(ENUM_FIELDS[fn], strVal)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: FIELD DISPATCHER ═══════ */
  const renderField = (record, fn, idx, sid) => {
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    if (ENUM_FIELDS[fn]) return renderEnumField(record, fn, idx, sid);
    // Yes/No select ONLY for a real boolean; descriptive strings ("mild NPDR",
    // "Not at target (<7.0%)") must stay free-text or a save would corrupt them
    if (BOOLEAN_FIELDS.includes(fn) && typeof getFieldValue(record, fn, idx) === 'boolean') return renderBooleanField(record, fn, idx, sid);
    return renderEditableField(record, fn, idx, sid);
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => fieldShows(f, getFieldValue(record, f, idx)));
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
          {fields.map(f => renderField(record, f, idx, sid))}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diabetes-quality-metrics-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diabetes Quality Metrics</h2></div>
        <div className="empty-state">No diabetes quality metrics records available</div>
      </div>
    );
  }

  return (
    <div className="diabetes-quality-metrics-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diabetes Quality Metrics</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiabetesQualityMetricsDocumentPDFTemplate document={pdfData} />} fileName="Diabetes_Quality_Metrics.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diabetes quality metrics..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Diabetes Quality Metrics ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'provider-info')}
            {renderSection(record, idx, 'glycemic-control')}
            {renderSection(record, idx, 'cardiovascular-risk')}
            {renderSection(record, idx, 'kidney-screening')}
            {renderSection(record, idx, 'eye-examination')}
            {renderSection(record, idx, 'foot-examination')}
            {renderSection(record, idx, 'medications')}
            {renderSection(record, idx, 'lifestyle-education')}
            {renderSection(record, idx, 'vaccinations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiabetesQualityMetricsDocument;
