/**
 * DentalImplantSurgeryDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: dental_implant_surgery
 *
 * 7 Sections:
 *   1. implant-specs: implantSystem (text), implantDiameter (number), implantLength (number), implantPositionFDI (text)
 *   2. bone-assessment: boneQualityLekholmZarb (text), residualBoneHeight (number), alveolarRidgeWidth (number), cbctHounsfieldUnits (number)
 *   3. stability-torque: insertionTorqueValue (number), implantStabilityQuotient (number), schwartzImplantSurgeryIndex (text) — bar chart display-only
 *   4. grafting-membrane: boneGraftMaterial (text), membraneType (text)
 *   5. surgical-techniques: guidedSurgeryUsed (bool), immediateLoadingProtocol (bool), piezoelectricSurgeryUsed (bool), prfMembraneApplication (bool), platformSwitchingDesign (bool)
 *   6. prosthetic-planning: abutmentType (text)
 *   7. soft-tissue: keratinizedMucosaWidth (number), pinkEstheticScore (number)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DentalImplantSurgeryPDFTemplate from '../pdf-templates/DentalImplantSurgeryPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DentalImplantSurgeryDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; no array fields here) */
const DRAFT_KEY = 'dental_implant_surgeryPendingEdits';
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
  'implant-specs': 'Implant Specifications',
  'bone-assessment': 'Bone Assessment',
  'stability-torque': 'Stability & Torque',
  'grafting-membrane': 'Grafting & Membrane',
  'surgical-techniques': 'Surgical Techniques',
  'prosthetic-planning': 'Prosthetic Planning',
  'soft-tissue': 'Soft Tissue Assessment',
};

const FIELD_LABELS = {
  implantSystem: 'Implant System',
  implantDiameter: 'Implant Diameter',
  implantLength: 'Implant Length',
  implantPositionFDI: 'Implant Position (FDI)',
  boneQualityLekholmZarb: 'Bone Quality (Lekholm-Zarb)',
  boneQuantityLekholmZarb: 'Bone Quantity (Lekholm-Zarb)',
  residualBoneHeight: 'Residual Bone Height',
  alveolarRidgeWidth: 'Alveolar Ridge Width',
  cbctHounsfieldUnits: 'CBCT Hounsfield Units',
  insertionTorqueValue: 'Insertion Torque',
  implantStabilityQuotient: 'Implant Stability Quotient',
  schwartzImplantSurgeryIndex: 'Schwartz Implant Surgery Index',
  boneGraftMaterial: 'Bone Graft Material',
  membraneType: 'Membrane Type',
  sinusLiftApproach: 'Sinus Lift Approach',
  guidedSurgeryUsed: 'Guided Surgery Used',
  immediateLoadingProtocol: 'Immediate Loading Protocol',
  piezoelectricSurgeryUsed: 'Piezoelectric Surgery Used',
  prfMembraneApplication: 'PRF Membrane Application',
  platformSwitchingDesign: 'Platform Switching Design',
  abutmentType: 'Abutment Type',
  softTissueAugmentation: 'Soft Tissue Augmentation',
  keratinizedMucosaWidth: 'Keratinized Mucosa Width',
  pinkEstheticScore: 'Pink Esthetic Score',
  papillaIndexScore: 'Papilla Index Score',
};

const SECTION_FIELDS = {
  'implant-specs': ['implantSystem', 'implantDiameter', 'implantLength', 'implantPositionFDI'],
  'bone-assessment': ['boneQualityLekholmZarb', 'boneQuantityLekholmZarb', 'residualBoneHeight', 'alveolarRidgeWidth', 'cbctHounsfieldUnits'],
  'stability-torque': ['insertionTorqueValue', 'implantStabilityQuotient', 'schwartzImplantSurgeryIndex'],
  'grafting-membrane': ['boneGraftMaterial', 'membraneType', 'sinusLiftApproach'],
  'surgical-techniques': ['guidedSurgeryUsed', 'immediateLoadingProtocol', 'piezoelectricSurgeryUsed', 'prfMembraneApplication', 'platformSwitchingDesign'],
  'prosthetic-planning': ['abutmentType'],
  'soft-tissue': ['softTissueAugmentation', 'keratinizedMucosaWidth', 'pinkEstheticScore', 'papillaIndexScore'],
};

const YES_NO_FIELDS = ['guidedSurgeryUsed', 'immediateLoadingProtocol', 'piezoelectricSurgeryUsed', 'prfMembraneApplication', 'platformSwitchingDesign'];
/* implantPositionFDI is a numeric tooth identifier (stored as the string "8") → stepper, no unit */
const NUMBER_FIELDS = ['implantPositionFDI', 'implantDiameter', 'implantLength', 'residualBoneHeight', 'alveolarRidgeWidth', 'cbctHounsfieldUnits', 'insertionTorqueValue', 'implantStabilityQuotient', 'keratinizedMucosaWidth', 'pinkEstheticScore'];

/* Fixed-choice clinical scales → themed <select> (one-pass item 8; read the value as an implant surgeon).
   bone quality/quantity = Lekholm & Zarb; SAC = ITI Straightforward/Advanced/Complex ("schwartz…Index" value "Advanced");
   sinus lift approach; papilla index = Jemt. Off-scale/descriptive stored values stay selectable. */
const ENUM_FIELDS = {
  boneQualityLekholmZarb: ['Type 1', 'Type 2', 'Type 3', 'Type 4'],
  boneQuantityLekholmZarb: ['A', 'B', 'C', 'D', 'E'],
  schwartzImplantSurgeryIndex: ['Straightforward', 'Advanced', 'Complex'],
  sinusLiftApproach: ['None', 'Lateral Window', 'Crestal (Osteotome)', 'Transcrestal'],
  papillaIndexScore: ['0', '1', '2', '3', '4'],
};
const enumCanonical = (options, current) => {
  const cur = String(current ?? '').trim();
  return options.find(o => o.toLowerCase() === cur.toLowerCase()) || cur;
};
const enumOptionsWith = (options, current) => {
  const cur = String(current ?? '').trim();
  if (!cur || options.some(o => o.toLowerCase() === cur.toLowerCase())) return options;
  return [cur, ...options];
};

const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const NUMBER_UNITS = {
  implantDiameter: 'mm',
  implantLength: 'mm',
  residualBoneHeight: 'mm',
  alveolarRidgeWidth: 'mm',
  cbctHounsfieldUnits: 'HU',
  insertionTorqueValue: 'Ncm',
  implantStabilityQuotient: 'ISQ',
  keratinizedMucosaWidth: 'mm',
  pinkEstheticScore: '/14',
};

/* ── Stability Bar Chart Config ── */
const STABILITY_MEASURES = [
  { key: 'insertionTorqueValue', label: 'Insertion Torque', max: 80, greenMin: 35, yellowMin: 15, unit: 'Ncm' },
  { key: 'implantStabilityQuotient', label: 'Implant Stability Quotient', max: 100, greenMin: 70, yellowMin: 60, unit: 'ISQ' },
];

const getStabilityColor = (value, measure) => {
  if (value >= measure.greenMin) return '#22c55e';
  if (value >= measure.yellowMin) return '#fbbf24';
  return '#ef4444';
};

const getStabilityInterpretation = (value, measure) => {
  if (value >= measure.greenMin) return 'Good';
  if (value >= measure.yellowMin) return 'Moderate';
  return 'Low';
};

const stabilityToPercentage = (value, max) => Math.min(100, Math.max(2, (value / max) * 100));

/* ═══════ COMPONENT ═══════ */
const DentalImplantSurgeryDocument = ({ document: docProp }) => {
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
      if (r?.dental_implant_surgery) return Array.isArray(r.dental_implant_surgery) ? r.dental_implant_surgery : [r.dental_implant_surgery];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dental_implant_surgery) return Array.isArray(dd.dental_implant_surgery) ? dd.dental_implant_surgery : [dd.dental_implant_surgery]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => {
        if (!record?._id) return null;
        if (typeof record._id === 'string') return record._id;
        if (record._id.$oid) return record._id.$oid;
        return String(record._id);
      })();
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

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const getDisplayValue = useCallback((fn, val) => {
    if (!hasVal(val)) return '';
    const unit = NUMBER_UNITS[fn];
    if (NUMBER_FIELDS.includes(fn) && unit) {
      return `${fmtVal(val)} ${unit}`;
    }
    return fmtVal(val);
  }, [hasVal, fmtVal]);

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
      if (val !== null && val !== undefined && getDisplayValue(f, val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, getDisplayValue]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    return val !== null && val !== undefined && getDisplayValue(fn, val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, getDisplayValue]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Dental Implant Surgery ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val !== null && val !== undefined && getDisplayValue(f, val).toLowerCase().includes(phrase)) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, getDisplayValue]);

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
  const handleSaveField = useCallback((record, fn, idx) => {
    const id = safeId(record); if (!id) return;
    let saveVal = editValue;
    /* Number validation */
    if (NUMBER_FIELDS.includes(fn)) {
      if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(saveVal);
    }
    /* Boolean validation */
    if (YES_NO_FIELDS.includes(fn)) {
      const lower = String(saveVal).toLowerCase().trim();
      if (lower === 'yes' || lower === 'true') saveVal = true;
      else if (lower === 'no' || lower === 'false') saveVal = false;
      else { setSaveError('Please enter Yes or No'); return; }
    }
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this field's section 'approved' flag so the button returns to yellow Pending
    const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
    if (sid) {
      setApprovedSections(prev => {
        if (!prev[`${sid}-${idx}`]) return prev;
        const next = { ...prev };
        delete next[`${sid}-${idx}`];
        return next;
      });
    }
    // Persist DRAFT to localStorage (NO DB write here). Approve commits it.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)));
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Collect this section's pending edits, keyed "<field>-<idx>"
      const toCommit = fields
        .map(f => `${f}-${idx}`)
        .filter(k => pendingEdits[k] && localEdits[k] !== undefined);
      // Persist each staged field to the DB now
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -`-${idx}`.length); // plain field name (no array fields here)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(fieldPart.slice(lastDot + 1), 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        await secureApiClient.put(`/api/edit/dental_implant_surgery/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/dental_implant_surgery/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for these fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) {
        fields.forEach(f => { delete store[id][f]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[DentalImplantSurgery] Approve error:', err);
      setSaveError('Save failed. Please try again.');
    } finally { setSaving(false); }
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

  /* ═══════ COPY TEXT BUILDERS ═══════ */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];

    if (sid === 'stability-torque') {
      /* hide-zero mirrors the JSX bar chart; label / DASH / numbered value (never inline "Label: value") */
      STABILITY_MEASURES.forEach(m => {
        const val = getFieldValue(record, m.key, idx);
        if (hasVal(val) && parseFloat(val) !== 0) {
          const numVal = typeof val === 'number' ? val : Number(val);
          text += `${m.label}\n${COPY_LINE_DASH}\n1. ${numVal} ${m.unit} (${getStabilityInterpretation(numVal, m)})\n\n`;
        }
      });
      const schwartz = getFieldValue(record, 'schwartzImplantSurgeryIndex', idx);
      if (hasVal(schwartz)) text += `Schwartz Implant Surgery Index\n${COPY_LINE_DASH}\n1. ${fmtVal(schwartz)}\n\n`;
      return text;
    }

    fields.forEach(f => {
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      /* mirror the JSX hide-zero for numeric metrics */
      if (NUMBER_FIELDS.includes(f) && parseFloat(val) === 0) return;
      const label = FIELD_LABELS[f] || f;
      const displayVal = getDisplayValue(f, val);
      text += `${label}\n${COPY_LINE_DASH}\n1. ${displayVal}\n\n`;
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, getDisplayValue]);

  const copyAllText = useCallback(async () => {
    let text = '=== DENTAL IMPLANT SURGERY ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Dental Implant Surgery ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const st = buildSectionCopyText(r, idx, sid);
        /* empty-section guard: title + '=' divider = 2 non-empty lines; require real content */
        if (st.split('\n').filter(l => l.trim()).length > 2) text += st;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: YES/NO SELECT FIELD ═══════ */
  const renderYesNoField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const normalizeYesNo = (v) => {
      const lower = String(v).toLowerCase().trim();
      if (lower === 'yes' || lower === 'true' || v === true) return 'yes';
      if (lower === 'no' || lower === 'false' || v === false) return 'no';
      return v;
    };

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(normalizeYesNo(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: NUMBER EDITABLE FIELD (parseFloat + hide-zero) ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    if (parseFloat(val) === 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = getDisplayValue(fn, val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(typeof val === 'number' ? val : fmtVal(val))); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {/* −/+ stepper, clamped ≥0 (implant dimensions/scores are non-negative); unit shown after the input */}
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const n = parseFloat(editValue) || 0; const dec = (String(editValue).split('.')[1] || '').length; setEditValue(Math.max(0, n - st).toFixed(dec)); }}>&minus;</button>
                <input type="number" min="0" step={stepFor(editValue)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); handleSaveField(record, fn, idx); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const n = parseFloat(editValue) || 0; const dec = (String(editValue).split('.')[1] || '').length; setEditValue((n + st).toFixed(dec)); }}>+</button>
                {NUMBER_UNITS[fn] && <span className="number-edit-unit">{NUMBER_UNITS[fn]}</span>}
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: SIMPLE TEXT EDITABLE FIELD ═══════ */
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
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(ENUM_FIELDS[fn] ? enumCanonical(ENUM_FIELDS[fn], displayVal) : displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {ENUM_FIELDS[fn] ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  {enumOptionsWith(ENUM_FIELDS[fn], displayVal).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ═══════ RENDER: STABILITY BAR CHART SECTION (display-only, no editing) ═══════ */
  const renderStabilitySection = (record, idx) => {
    const sid = 'stability-torque';
    const hasStab = STABILITY_MEASURES.some(m => hasVal(getFieldValue(record, m.key, idx)));
    const schwartz = getFieldValue(record, 'schwartzImplantSurgeryIndex', idx);
    const hasSchwartz = hasVal(schwartz);
    if (!hasStab && !hasSchwartz) return null;
    if (!shouldShowSection(record, sid)) return null;

    const copyId = `${sid}-${idx}`;
    const searchLower = searchTerm ? searchTerm.toLowerCase().trim() : '';
    const stMatches = sectionTitleMatches(sid);

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Stability & Torque')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>

          {/* Legend */}
          {hasStab && (
            <div className="stability-chart-legend">
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Good</span></div>
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#fbbf24' }} /><span>Moderate</span></div>
              <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>Low</span></div>
            </div>
          )}

          {/* Bar Charts */}
          {STABILITY_MEASURES.map((measure) => {
            const val = getFieldValue(record, measure.key, idx);
            if (!hasVal(val) || parseFloat(val) === 0) return null;
            const numVal = typeof val === 'number' ? val : Number(val);
            if (!(!searchLower || record._showAllSections || stMatches || fieldMatches(record, measure.key, idx))) return null;

            const editKey = `${measure.key}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const color = getStabilityColor(numVal, measure);
            const interp = getStabilityInterpretation(numVal, measure);
            const pct = stabilityToPercentage(numVal, measure.max);

            return (
              <div key={measure.key}>
                <div className={`stability-bar-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(numVal)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <div className="stability-bar-label">{highlightText(measure.label)}</div>
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, measure.key, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="stability-bar-label">{highlightText(measure.label)}<span className="edit-indicator" style={{ marginLeft: 6 }}>✎</span></div>
                      <div className="stability-bar-container">
                        <div className="stability-bar-background">
                          <div className="stability-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="stability-bar-value" style={{ color }}>{highlightText(`${numVal} ${measure.unit}`)}</span>
                        <span className="stability-bar-interpretation" style={{ color }}>{interp}</span>
                      </div>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}

          {/* Schwartz Index */}
          {hasSchwartz && (!searchLower || record._showAllSections || stMatches || fieldMatches(record, 'schwartzImplantSurgeryIndex', idx)) && (
            (() => {
              const editKey = `schwartzImplantSurgeryIndex-${idx}`;
              const isEditing = editingField === editKey;
              const isModified = editedFields[editKey];
              return (
                <div className="rec-mini-card" style={{ marginTop: 8 }}>
                  <div className="nested-subtitle">{highlightText('Schwartz Implant Surgery Index')}</div>
                  <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(enumCanonical(ENUM_FIELDS.schwartzImplantSurgeryIndex, fmtVal(schwartz))); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                          {enumOptionsWith(ENUM_FIELDS.schwartzImplantSurgeryIndex, fmtVal(schwartz)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, 'schwartzImplantSurgeryIndex', idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(fmtVal(schwartz))}</span><span className="edit-indicator">✎</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`Schwartz Implant Surgery Index: ${fmtVal(schwartz)}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })()
          )}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (sid === 'stability-torque') return renderStabilitySection(record, idx);
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
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
            if (YES_NO_FIELDS.includes(f)) return renderYesNoField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="dental-implant-surgery-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Dental Implant Surgery</h2></div>
        <div className="empty-state">No dental implant surgery records available</div>
      </div>
    );
  }

  return (
    <div className="dental-implant-surgery-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Dental Implant Surgery</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DentalImplantSurgeryPDFTemplate document={pdfData} />} fileName="Dental_Implant_Surgery.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search dental implant surgery..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Dental Implant Surgery ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'implant-specs')}
            {renderSection(record, idx, 'bone-assessment')}
            {renderSection(record, idx, 'stability-torque')}
            {renderSection(record, idx, 'grafting-membrane')}
            {renderSection(record, idx, 'surgical-techniques')}
            {renderSection(record, idx, 'prosthetic-planning')}
            {renderSection(record, idx, 'soft-tissue')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DentalImplantSurgeryDocument;
