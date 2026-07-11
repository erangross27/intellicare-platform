/**
 * DiabetesSuppliesDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: diabetes_supplies
 *
 * 7 Sections:
 *   1. glucometer-strips: glucometerModel, testStripBrand, testStripQuantity
 *   2. lancets: lancetType, lancetQuantity
 *   3. insulin-delivery: insulinSyringeSize, syringeNeedleGauge, syringeQuantity, penNeedleGauge, penNeedleQuantity
 *   4. cgm-section: continuousGlucoseMonitor, cgmSensorQuantity, cgmTransmitterIncluded
 *   5. insulin-pump: insulinPumpReservoir, reservoirQuantity, infusionSetType, tubingLength, infusionSetQuantity
 *   6. other-supplies: ketoneTestStrips, sharpsContainerSize, alcoholPrepPads
 *   7. insurance-supplier: dmeSupplier, insurancePreauthorization, prescriptionNumber, refillsRemaining
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DiabetesSuppliesDocumentPDFTemplate from '../pdf-templates/DiabetesSuppliesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DiabetesSuppliesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field") */
const DRAFT_KEY = 'diabetes_suppliesPendingEdits';
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
  'glucometer-strips': 'Glucometer & Test Strips',
  'lancets': 'Lancets',
  'insulin-delivery': 'Insulin Delivery',
  'cgm-section': 'Continuous Glucose Monitor (CGM)',
  'insulin-pump': 'Insulin Pump',
  'other-supplies': 'Other Supplies',
  'insurance-supplier': 'Insurance & Supplier Info',
};

const FIELD_LABELS = {
  glucometerModel: 'Glucometer Model',
  testStripBrand: 'Test Strip Brand',
  testStripQuantity: 'Test Strip Quantity',
  lancetType: 'Lancet Type',
  lancetQuantity: 'Lancet Quantity',
  insulinSyringeSize: 'Insulin Syringe Size',
  syringeNeedleGauge: 'Syringe Needle Gauge',
  syringeQuantity: 'Syringe Quantity',
  penNeedleGauge: 'Pen Needle Gauge',
  penNeedleQuantity: 'Pen Needle Quantity',
  continuousGlucoseMonitor: 'Continuous Glucose Monitor',
  cgmSensorQuantity: 'Sensor Quantity',
  cgmTransmitterIncluded: 'Transmitter Included',
  insulinPumpReservoir: 'Reservoir',
  reservoirQuantity: 'Reservoir Quantity',
  infusionSetType: 'Infusion Set Type',
  tubingLength: 'Tubing Length',
  infusionSetQuantity: 'Infusion Set Quantity',
  ketoneTestStrips: 'Ketone Test Strips',
  sharpsContainerSize: 'Sharps Container Size',
  alcoholPrepPads: 'Alcohol Prep Pads',
  dmeSupplier: 'DME Supplier',
  insurancePreauthorization: 'Insurance Preauthorization',
  prescriptionNumber: 'Prescription Number',
  refillsRemaining: 'Refills Remaining',
};

const SECTION_FIELDS = {
  'glucometer-strips': ['glucometerModel', 'testStripBrand', 'testStripQuantity'],
  'lancets': ['lancetType', 'lancetQuantity'],
  'insulin-delivery': ['insulinSyringeSize', 'syringeNeedleGauge', 'syringeQuantity', 'penNeedleGauge', 'penNeedleQuantity'],
  'cgm-section': ['continuousGlucoseMonitor', 'cgmSensorQuantity', 'cgmTransmitterIncluded'],
  'insulin-pump': ['insulinPumpReservoir', 'reservoirQuantity', 'infusionSetType', 'tubingLength', 'infusionSetQuantity'],
  'other-supplies': ['ketoneTestStrips', 'sharpsContainerSize', 'alcoholPrepPads'],
  'insurance-supplier': ['dmeSupplier', 'insurancePreauthorization', 'prescriptionNumber', 'refillsRemaining'],
};

const BOOLEAN_FIELDS = ['cgmTransmitterIncluded'];
const NUMBER_FIELDS = ['testStripQuantity', 'lancetQuantity', 'syringeQuantity', 'penNeedleQuantity', 'cgmSensorQuantity', 'reservoirQuantity', 'infusionSetQuantity', 'ketoneTestStrips', 'alcoholPrepPads', 'refillsRemaining'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Single-name rule with parenthetical-acronym normalization: a field label equal to the
   section title MINUS its "(CGM)"-style suffix is redundant and hidden (a stacked
   "Continuous Glucose Monitor (CGM)" / "Continuous Glucose Monitor" reads as a triple header). */
const labelIsRedundant = (label, title) => {
  const l = String(label || '').trim().toLowerCase();
  const t = String(title || '').trim().toLowerCase();
  const base = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return l === t || l === base;
};

/* Colon-labeled value ("Tandem t:slim X2") → third-level subtitle "Tandem t" + row "slim X2".
   The separator (colon + any spacing) is captured EXACTLY so a save round-trips the stored shape. */
const parseColonValue = (text) => {
  const m = typeof text === 'string' ? text.match(/^([A-Za-z][^:\n]{0,40}?):(\s*)(\S[\s\S]*)$/) : null;
  if (!m) return null;
  return { label: m[1].trim(), sep: `:${m[2]}`, value: m[3].trim() };
};

/* Quantity 0 = extractor sentinel ("not documented"), not a real count: in the real data every
   zero quantity sits next to an empty companion string (testStripBrand "" + testStripQuantity 0). */
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;

/* ═══════ COMPONENT ═══════ */
const DiabetesSuppliesDocument = ({ document: docProp }) => {
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
      if (r?.diabetes_supplies) return Array.isArray(r.diabetes_supplies) ? r.diabetes_supplies : [r.diabetes_supplies];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_supplies) return Array.isArray(dd.diabetes_supplies) ? dd.diabetes_supplies : [dd.diabetes_supplies]; return [dd]; }
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

  /* sentinel-aware visibility: 0 in a supply quantity = "not documented" → hidden */
  const fieldShows = useCallback((fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && HIDE_ZERO_FIELDS.includes(fn)), [hasVal]);

  /* stepper helper: quantities are integer counts, clamped >= 0 */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      let next = (isNaN(n) ? 0 : n) + dir;
      next = Math.round(next);
      if (next < 0) next = 0;
      return String(next);
    });
  };

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
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
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
      const rt = `Diabetes Supplies ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
    if (sid) {
      setApprovedSections(prev => {
        const sectionKey = `${sid}-${idx}`;
        if (!prev[sectionKey]) return prev;
        const next = { ...prev };
        delete next[sectionKey];
        return next;
      });
    }
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
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
    setSaving(true); setSaveError(null);
    // Staged edits for THIS section's fields: editKey is `${fn}-${idx}`
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      // Treat a trailing dot-segment as arrayIndex ONLY when purely numeric
      const lastDot = fieldPart.lastIndexOf('.');
      const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
        ? fieldPart.slice(0, lastDot) : fieldPart;
      return fields.includes(baseField);
    });
    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for numeric array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/diabetes_supplies/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/diabetes_supplies/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
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

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!fieldShows(f, val)) return;
      // single-name rule: a field label equal to the section title is not repeated
      const head = labelIsRedundant(label, title) ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      const cp = typeof val === 'string' ? parseColonValue(val) : null;
      if (cp) text += `${head}${cp.label}\n${COPY_LINE_DASH}\n1. ${cp.value}\n\n`;
      else text += `${head}1. ${fmtVal(val)}\n\n`;
    });
    return text;
  }, [getFieldValue, fieldShows, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = `Diabetes Supplies\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Diabetes Supplies ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
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

  /* ═══════ RENDER: BOOLEAN FIELD (Yes/No select) ═══════ */
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
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!fieldShows(fn, val)) return null;
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
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>{'−'}</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
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
    const sl = !labelIsRedundant(label, title);
    const displayVal = fmtVal(val);
    /* colon-labeled value \u2192 third-level subtitle + remainder-only row */
    const cp = typeof val === 'string' ? parseColonValue(val) : null;
    const rowVal = cp ? cp.value : displayVal;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const rowBlock = (
      <>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(rowVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && editingField === editKey && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const rebuilt = cp ? `${cp.label}${cp.sep}${editValue.trim()}` : editValue; handleSaveField(record, fn, idx, sid, null, rebuilt); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(rowVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(rowVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </>
    );

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        {cp ? (
          <div className="nested-mini-card">
            <div className="nested-subtitle sub-label">{highlightText(cp.label)}</div>
            {rowBlock}
          </div>
        ) : rowBlock}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    // Check if section has any values (sentinel zeros don't count)
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
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="diabetes-supplies-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Diabetes Supplies</h2></div>
        <div className="empty-state">No diabetes supplies records available</div>
      </div>
    );
  }

  return (
    <div className="diabetes-supplies-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Diabetes Supplies</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DiabetesSuppliesDocumentPDFTemplate document={pdfData} />} fileName="Diabetes_Supplies.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search diabetes supplies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Diabetes Supplies ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'glucometer-strips')}
            {renderSection(record, idx, 'lancets')}
            {renderSection(record, idx, 'insulin-delivery')}
            {renderSection(record, idx, 'cgm-section')}
            {renderSection(record, idx, 'insulin-pump')}
            {renderSection(record, idx, 'other-supplies')}
            {renderSection(record, idx, 'insurance-supplier')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiabetesSuppliesDocument;
