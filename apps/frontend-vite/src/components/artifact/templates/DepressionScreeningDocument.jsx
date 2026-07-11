import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import DepressionScreeningDocumentPDFTemplate from '../pdf-templates/DepressionScreeningDocumentPDFTemplate';
import './DepressionScreeningDocument.css';

// Depression Screening Document Template - December 2025 REBUILD
// New schema with 9 depression/anxiety scores + clinical assessment fields
// 4-level search | Bar chart visualization | Blue theme | Inline editing

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'depression_screeningPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ========================= EDIT-WIDGET CONFIG =========================
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* Fixed-choice clinical scales → themed <select> (read the value as a clinician).
   depression severity = PHQ-9 severity bands; anxiety/functional = standard severity;
   energy/fatigue = fatigue severity. Off-scale stored values stay selectable. */
const ENUM_FIELDS = {
  depressionSeverityLevel: ['Minimal', 'Mild', 'Moderate', 'Moderately Severe', 'Severe'],
  anxietySymptomSeverity: ['None', 'Mild', 'Moderate', 'Severe'],
  functionalImpairmentLevel: ['None', 'Mild', 'Moderate', 'Severe'],
  energyFatigueLevel: ['None', 'Mild Fatigue', 'Moderate Fatigue', 'Severe Fatigue'],
};
const BOOLEAN_FIELDS = ['majorDepressiveEpisodeCriteria', 'psychoticFeaturesPresent', 'suicidalIdeationPresent', 'concentrationDifficulties', 'worthlessnessGuilt', 'substanceUseComorbidity'];
const NUMBER_FIELDS = ['priorDepressionEpisodes'];

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
const boolText = (v) => (v ? 'Yes' : 'No');

// ========================= BAR CHART HELPER FUNCTIONS =========================

// PHQ-9 Score Color (0-27 scale)
const getPHQ9Color = (score) => {
  if (score <= 4) return '#22c55e';   // Green - Minimal (0-4)
  if (score <= 9) return '#3b82f6';   // Blue - Mild (5-9)
  if (score <= 14) return '#f59e0b';  // Orange - Moderate (10-14)
  if (score <= 19) return '#fb923c';  // Dark Orange - Moderately Severe (15-19)
  return '#ef4444';                    // Red - Severe (20-27)
};

const getPHQ9Interpretation = (score) => {
  if (score <= 4) return 'Minimal depression';
  if (score <= 9) return 'Mild depression';
  if (score <= 14) return 'Moderate depression';
  if (score <= 19) return 'Moderately severe depression';
  return 'Severe depression';
};

// PHQ-2 Score Color (0-6 scale)
const getPHQ2Color = (score) => {
  if (score <= 2) return '#22c55e';   // Green - Low risk
  return '#ef4444';                    // Red - High risk (3-6)
};

const getPHQ2Interpretation = (score) => {
  if (score <= 2) return 'Low risk - screening negative';
  return 'High risk - further evaluation recommended';
};

// GAD-7 Score Color (0-21 scale)
const getGAD7Color = (score) => {
  if (score <= 4) return '#22c55e';   // Green - Minimal
  if (score <= 9) return '#3b82f6';   // Blue - Mild
  if (score <= 14) return '#f59e0b';  // Orange - Moderate
  return '#ef4444';                    // Red - Severe (15-21)
};

const getGAD7Interpretation = (score) => {
  if (score <= 4) return 'Minimal anxiety';
  if (score <= 9) return 'Mild anxiety';
  if (score <= 14) return 'Moderate anxiety';
  return 'Severe anxiety';
};

// Beck Depression Inventory (0-63 scale)
const getBeckColor = (score) => {
  if (score <= 13) return '#22c55e';  // Green - Minimal
  if (score <= 19) return '#3b82f6';  // Blue - Mild
  if (score <= 28) return '#f59e0b';  // Orange - Moderate
  return '#ef4444';                    // Red - Severe (29-63)
};

const getBeckInterpretation = (score) => {
  if (score <= 13) return 'Minimal depression';
  if (score <= 19) return 'Mild depression';
  if (score <= 28) return 'Moderate depression';
  return 'Severe depression';
};

// Hamilton Depression Rating Scale (0-52 scale)
const getHamiltonColor = (score) => {
  if (score <= 7) return '#22c55e';   // Green - Normal
  if (score <= 16) return '#3b82f6';  // Blue - Mild
  if (score <= 23) return '#f59e0b';  // Orange - Moderate
  return '#ef4444';                    // Red - Severe (24+)
};

const getHamiltonInterpretation = (score) => {
  if (score <= 7) return 'Normal';
  if (score <= 16) return 'Mild depression';
  if (score <= 23) return 'Moderate depression';
  return 'Severe depression';
};

// Montgomery-Asberg Scale (0-60 scale)
const getMADRSColor = (score) => {
  if (score <= 6) return '#22c55e';   // Green - Normal
  if (score <= 19) return '#3b82f6';  // Blue - Mild
  if (score <= 34) return '#f59e0b';  // Orange - Moderate
  return '#ef4444';                    // Red - Severe (35+)
};

const getMADRSInterpretation = (score) => {
  if (score <= 6) return 'Normal';
  if (score <= 19) return 'Mild depression';
  if (score <= 34) return 'Moderate depression';
  return 'Severe depression';
};

// Edinburgh Postnatal Scale (0-30 scale)
const getEdinburghColor = (score) => {
  if (score <= 9) return '#22c55e';   // Green - Low
  if (score <= 12) return '#f59e0b';  // Orange - Possible depression
  return '#ef4444';                    // Red - Likely depression (13+)
};

const getEdinburghInterpretation = (score) => {
  if (score <= 9) return 'Depression unlikely';
  if (score <= 12) return 'Possible depression';
  return 'Probable depression - further assessment needed';
};

// Geriatric Depression Scale (0-15 scale)
const getGeriatricColor = (score) => {
  if (score <= 4) return '#22c55e';   // Green - Normal
  if (score <= 8) return '#3b82f6';   // Blue - Mild
  if (score <= 11) return '#f59e0b';  // Orange - Moderate
  return '#ef4444';                    // Red - Severe (12-15)
};

const getGeriatricInterpretation = (score) => {
  if (score <= 4) return 'Normal';
  if (score <= 8) return 'Mild depression';
  if (score <= 11) return 'Moderate depression';
  return 'Severe depression';
};

// Columbia Suicide Severity Rating Scale (variable - 0-5 for risk level)
const getColumbiaColor = (score) => {
  if (score === 0) return '#22c55e';  // Green - No risk
  if (score <= 2) return '#f59e0b';   // Orange - Low/Moderate
  return '#ef4444';                    // Red - High risk (3+)
};

const getColumbiaInterpretation = (score) => {
  if (score === 0) return 'No suicidal ideation';
  if (score === 1) return 'Wish to be dead';
  if (score === 2) return 'Non-specific active suicidal thoughts';
  if (score === 3) return 'Active suicidal ideation with method';
  if (score === 4) return 'Active suicidal ideation with intent';
  return 'Active suicidal ideation with plan and intent';
};

// Prepare chart data for a record
const prepareChartData = (record) => {
  const charts = [];

  // PHQ-9 Score (0-27)
  if (record.phq9Score !== undefined && record.phq9Score !== null && record.phq9Score > 0) {
    const score = Number(record.phq9Score);
    charts.push({
      label: 'PHQ-9 Score',
      score,
      max: 27,
      percentage: Math.min(100, (score / 27) * 100),
      color: getPHQ9Color(score),
      interpretation: getPHQ9Interpretation(score),
      keywords: 'phq9 phq-9 depression screening score'
    });
  }

  // PHQ-2 Score (0-6)
  if (record.phq2Score !== undefined && record.phq2Score !== null && record.phq2Score > 0) {
    const score = Number(record.phq2Score);
    charts.push({
      label: 'PHQ-2 Score',
      score,
      max: 6,
      percentage: Math.min(100, (score / 6) * 100),
      color: getPHQ2Color(score),
      interpretation: getPHQ2Interpretation(score),
      keywords: 'phq2 phq-2 depression screening score'
    });
  }

  // GAD-7 Score (0-21)
  if (record.gadSevenScore !== undefined && record.gadSevenScore !== null && record.gadSevenScore > 0) {
    const score = Number(record.gadSevenScore);
    charts.push({
      label: 'GAD-7 Score',
      score,
      max: 21,
      percentage: Math.min(100, (score / 21) * 100),
      color: getGAD7Color(score),
      interpretation: getGAD7Interpretation(score),
      keywords: 'gad7 gad-7 anxiety screening score generalized anxiety'
    });
  }

  // Beck Depression Inventory (0-63)
  if (record.beckDepressionInventoryScore !== undefined && record.beckDepressionInventoryScore !== null && record.beckDepressionInventoryScore > 0) {
    const score = Number(record.beckDepressionInventoryScore);
    charts.push({
      label: 'Beck Depression Inventory',
      score,
      max: 63,
      percentage: Math.min(100, (score / 63) * 100),
      color: getBeckColor(score),
      interpretation: getBeckInterpretation(score),
      keywords: 'beck depression inventory bdi score'
    });
  }

  // Hamilton Depression Rating Scale (0-52)
  if (record.hamiltonDepressionRatingScale !== undefined && record.hamiltonDepressionRatingScale !== null && record.hamiltonDepressionRatingScale > 0) {
    const score = Number(record.hamiltonDepressionRatingScale);
    charts.push({
      label: 'Hamilton Depression Rating Scale',
      score,
      max: 52,
      percentage: Math.min(100, (score / 52) * 100),
      color: getHamiltonColor(score),
      interpretation: getHamiltonInterpretation(score),
      keywords: 'hamilton depression rating scale hdrs ham-d score'
    });
  }

  // Montgomery-Asberg Depression Rating Scale (0-60)
  if (record.montgomeryAsbergDepressionRatingScale !== undefined && record.montgomeryAsbergDepressionRatingScale !== null && record.montgomeryAsbergDepressionRatingScale > 0) {
    const score = Number(record.montgomeryAsbergDepressionRatingScale);
    charts.push({
      label: 'Montgomery-Asberg Scale',
      score,
      max: 60,
      percentage: Math.min(100, (score / 60) * 100),
      color: getMADRSColor(score),
      interpretation: getMADRSInterpretation(score),
      keywords: 'montgomery asberg madrs depression rating scale score'
    });
  }

  // Edinburgh Postnatal Depression Scale (0-30)
  if (record.edinburghPostnatalDepressionScale !== undefined && record.edinburghPostnatalDepressionScale !== null && record.edinburghPostnatalDepressionScale > 0) {
    const score = Number(record.edinburghPostnatalDepressionScale);
    charts.push({
      label: 'Edinburgh Postnatal Scale',
      score,
      max: 30,
      percentage: Math.min(100, (score / 30) * 100),
      color: getEdinburghColor(score),
      interpretation: getEdinburghInterpretation(score),
      keywords: 'edinburgh postnatal depression scale epds postpartum score'
    });
  }

  // Geriatric Depression Scale (0-15)
  if (record.geriatricDepressionScale !== undefined && record.geriatricDepressionScale !== null && record.geriatricDepressionScale > 0) {
    const score = Number(record.geriatricDepressionScale);
    charts.push({
      label: 'Geriatric Depression Scale',
      score,
      max: 15,
      percentage: Math.min(100, (score / 15) * 100),
      color: getGeriatricColor(score),
      interpretation: getGeriatricInterpretation(score),
      keywords: 'geriatric depression scale gds elderly score'
    });
  }

  // Columbia Suicide Severity Rating Scale (0-5)
  if (record.columbiaScale !== undefined && record.columbiaScale !== null && record.columbiaScale > 0) {
    const score = Number(record.columbiaScale);
    charts.push({
      label: 'Columbia Suicide Severity Scale',
      score,
      max: 5,
      percentage: Math.min(100, (score / 5) * 100),
      color: getColumbiaColor(score),
      interpretation: getColumbiaInterpretation(score),
      keywords: 'columbia suicide severity rating scale cssrs risk score'
    });
  }

  return charts;
};

// ========================= BAR CHART COMPONENTS =========================

const BarChart = ({ label, score, max, percentage, color, interpretation, highlightFn }) => (
  <div className="bar-chart-row">
    <div className="bar-label">{highlightFn ? highlightFn(label) : label}</div>
    <div className="bar-category-row">
      <div className="bar-category-value" style={{ color }}>
        {highlightFn ? highlightFn(`${score}/${max}`) : `${score}/${max}`}
      </div>
      <div className="bar-interpretation" style={{ color }}>
        {highlightFn ? highlightFn(interpretation) : interpretation}
      </div>
    </div>
    <div className="bar-container">
      <div className="bar-background">
        <div className="bar-fill" style={{ width: `${Math.max(15, percentage)}%`, backgroundColor: color }} />
      </div>
    </div>
  </div>
);

const Legend = () => (
  <div className="chart-legend">
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: '#22c55e' }} />
      <span className="legend-text">Minimal/Normal</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: '#3b82f6' }} />
      <span className="legend-text">Mild</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
      <span className="legend-text">Moderate</span>
    </div>
    <div className="legend-item">
      <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
      <span className="legend-text">Severe</span>
    </div>
  </div>
);

// ========================= MAIN COMPONENT =========================

const DepressionScreeningDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ============== EDITING STATE ==============
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Data unwrapping - handle various formats
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.depression_screening) {
          return Array.isArray(item.depression_screening) ? item.depression_screening : [item.depression_screening];
        }
        return [item];
      });
    }
    if (templateData.depression_screening) {
      return Array.isArray(templateData.depression_screening) ? templateData.depression_screening : [templateData.depression_screening];
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const rid = record && record._id
        ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
        : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      // sectionId for marker keys — derive from SECTION_FIELDS by base field
      const baseToSection = {};
      Object.entries(SECTION_FIELDS).forEach(([sid, fields]) => fields.forEach(f => { baseToSection[f] = sid; }));
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const sid = baseToSection[baseField];
        if (sid) nFields[`${sid}-${idx}`] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [unwrappedData]);

  // Format date helper
  const formatDate = useCallback((date) => {
    if (!date) return '';
    try {
      const d = date.$date ? new Date(date.$date) : new Date(date);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(date);
    }
  }, []);

  // Highlight text helper
  const highlightText = useCallback((text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;
    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // shouldShowRow helper for 4-level search
  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      window.document.body.appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      window.document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = record[fieldName];
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits]);

  // ============== EDITING HANDLERS ==============

  const handleStartEdit = useCallback((fieldName, idx, currentValue) => {
    const editKey = `${fieldName}-${idx}-s0`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex) => {
    const recordId = record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recordId) {
      console.error('[DepressionScreening] Cannot save — no record _id');
      return;
    }
    // Coerce by field type so the stored value keeps its DB type (boolean / number), not a string.
    let saveValue = editValue.trim();
    if (BOOLEAN_FIELDS.includes(fieldName)) {
      saveValue = (saveValue === 'Yes' || saveValue.toLowerCase() === 'true');
    } else if (NUMBER_FIELDS.includes(fieldName)) {
      const n = Number(saveValue);
      if (Number.isNaN(n)) { console.error('[DepressionScreening] invalid number'); return; }
      saveValue = n;
    }
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recordId) {
      console.error('[DepressionScreening] Cannot approve — no record _id');
      return;
    }
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // Dot-suffix is treated as arrayIndex ONLY when the trailing segment is purely numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const response = await secureApiClient.put(`/api/edit/depression_screening/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/depression_screening/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}-s0`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[DepressionScreening] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'clinical': ['depressionSeverityLevel', 'majorDepressiveEpisodeCriteria', 'psychoticFeaturesPresent', 'suicidalIdeationPresent', 'anxietySymptomSeverity', 'functionalImpairmentLevel'],
    'symptoms': ['sleepDisturbanceType', 'appetiteChanges', 'energyFatigueLevel', 'concentrationDifficulties', 'worthlessnessGuilt', 'psychomotorChanges'],
    'history': ['priorDepressionEpisodes', 'substanceUseComorbidity', 'medicalComorbidities', 'currentAntidepressantMedications'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent])) {
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            }
          }
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== RENDER EDITABLE FIELD (string fields) ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // ============== RENDER WIDGET FIELD (enum select / Yes-No / number stepper) ==============
  // kind: 'enum' | 'boolean' | 'number'. Value stays its DB type (handleSaveField coerces).
  const renderWidgetField = (record, fieldName, label, idx, sectionId, copyId, kind) => {
    const raw = getFieldValue(record, fieldName, idx);
    if (raw === undefined || raw === null || raw === '') return null; // allow false / 0
    const displayValue = kind === 'boolean' ? boolText(raw) : String(raw);
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const seed = kind === 'boolean' ? boolText(raw) : kind === 'enum' ? enumCanonical(ENUM_FIELDS[fieldName], displayValue) : String(raw);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              {kind === 'number' ? (
                <div className="num-stepper-row">
                  <button type="button" className="num-step" onClick={() => { const st = parseFloat(stepFor(editValue)) || 1; const n = parseFloat(editValue) || 0; const dec = (String(editValue).split('.')[1] || '').length; setEditValue(Math.max(0, n - st).toFixed(dec)); }}>&minus;</button>
                  <input type="number" min="0" step={stepFor(editValue)} className="edit-number" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter') handleSaveField(record, fieldName, idx, sectionId); }} />
                  <button type="button" className="num-step" onClick={() => { const st = parseFloat(stepFor(editValue)) || 1; const n = parseFloat(editValue) || 0; const dec = (String(editValue).split('.')[1] || '').length; setEditValue((n + st).toFixed(dec)); }}>+</button>
                </div>
              ) : (
                <select className="edit-select" value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}>
                  {(kind === 'boolean' ? ['Yes', 'No'] : enumOptionsWith(ENUM_FIELDS[fieldName], displayValue)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div className={`row-content${canEdit ? ' editable' : ''}`} onClick={() => canEdit && handleStartEdit(fieldName, idx, seed)} title={canEdit ? 'Click to edit' : undefined}>
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={() => copyToClipboard(displayValue, copyId)}>{copiedId === copyId ? 'Copied!' : 'Copy'}</button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };
  const renderEnumField = (record, fn, label, idx, sid, copyId) => renderWidgetField(record, fn, label, idx, sid, copyId, 'enum');
  const renderBooleanField = (record, fn, label, idx, sid, copyId) => renderWidgetField(record, fn, label, idx, sid, copyId, 'boolean');
  const renderNumberField = (record, fn, label, idx, sid, copyId) => renderWidgetField(record, fn, label, idx, sid, copyId, 'number');

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx) || item;
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const editKey = `${fieldName}.${itemIdx}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div key={itemIdx} className="numbered-row edit-row">
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, itemIdx);
              }}
              rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(unwrappedData[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Get all record text for Copy All (uses pdfData for edit persistence)
  /* ═══════ CANONICAL COPY BUILDERS (shared by Copy Section + Copy All → 4-area mirror) ═══════ */
  // label + DASH divider + numbered value ("1." even for single values); never inline "Label: value".
  const fieldLines = (label, value) => `${label}\n${COPY_LINE_DASH}\n1. ${value}\n`;
  const arrayLines = (label, items) => {
    let t = `${label}\n${COPY_LINE_DASH}\n`;
    items.forEach((it, i) => { t += `${i + 1}. ${it}\n`; });
    return t;
  };
  const hasContent = (t) => t.split('\n').filter(l => l.trim()).length > 2; // > title + '=' divider

  const buildScoresCopy = useCallback((record) => {
    const charts = prepareChartData(record);
    if (charts.length === 0) return '';
    let t = `Assessment Scores\n${COPY_LINE_EQ}\n\n`;
    charts.forEach(c => { t += fieldLines(c.label, `${c.score}/${c.max} (${c.interpretation})`) + '\n'; });
    return t;
  }, []);

  const buildClinicalCopy = useCallback((record) => {
    let t = `Clinical Assessment\n${COPY_LINE_EQ}\n\n`;
    if (record.depressionSeverityLevel) t += fieldLines('Depression Severity Level', record.depressionSeverityLevel) + '\n';
    if (record.majorDepressiveEpisodeCriteria !== undefined) t += fieldLines('Major Depressive Episode Criteria', boolText(record.majorDepressiveEpisodeCriteria)) + '\n';
    if (record.psychoticFeaturesPresent !== undefined) t += fieldLines('Psychotic Features Present', boolText(record.psychoticFeaturesPresent)) + '\n';
    if (record.suicidalIdeationPresent !== undefined) t += fieldLines('Suicidal Ideation Present', boolText(record.suicidalIdeationPresent)) + '\n';
    if (record.anxietySymptomSeverity) t += fieldLines('Anxiety Symptom Severity', record.anxietySymptomSeverity) + '\n';
    if (record.functionalImpairmentLevel) t += fieldLines('Functional Impairment Level', record.functionalImpairmentLevel) + '\n';
    return t;
  }, []);

  const buildSymptomsCopy = useCallback((record) => {
    let t = `Current Symptoms\n${COPY_LINE_EQ}\n\n`;
    if (record.sleepDisturbanceType?.length > 0) t += arrayLines('Sleep Disturbance Type', record.sleepDisturbanceType) + '\n';
    if (record.appetiteChanges) t += fieldLines('Appetite Changes', record.appetiteChanges) + '\n';
    if (record.energyFatigueLevel) t += fieldLines('Energy / Fatigue Level', record.energyFatigueLevel) + '\n';
    if (record.concentrationDifficulties !== undefined) t += fieldLines('Concentration Difficulties', boolText(record.concentrationDifficulties)) + '\n';
    if (record.worthlessnessGuilt !== undefined) t += fieldLines('Worthlessness / Guilt', boolText(record.worthlessnessGuilt)) + '\n';
    if (record.psychomotorChanges) t += fieldLines('Psychomotor Changes', record.psychomotorChanges) + '\n';
    return t;
  }, []);

  const buildHistoryCopy = useCallback((record) => {
    let t = `History & Comorbidities\n${COPY_LINE_EQ}\n\n`;
    if (record.priorDepressionEpisodes !== undefined) t += fieldLines('Prior Depression Episodes', String(record.priorDepressionEpisodes)) + '\n';
    if (record.substanceUseComorbidity !== undefined) t += fieldLines('Substance Use Comorbidity', boolText(record.substanceUseComorbidity)) + '\n';
    if (record.medicalComorbidities?.length > 0) t += arrayLines('Medical Comorbidities', record.medicalComorbidities) + '\n';
    if (record.currentAntidepressantMedications?.length > 0) t += arrayLines('Current Antidepressant Medications', record.currentAntidepressantMedications) + '\n';
    return t;
  }, []);

  const getAllRecordText = useCallback((record, idx) => {
    let t = `Depression Screening ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
    [buildScoresCopy(record), buildClinicalCopy(record), buildSymptomsCopy(record), buildHistoryCopy(record)].forEach(s => {
      if (hasContent(s)) t += s;
    });
    return t.trimEnd();
  }, [buildScoresCopy, buildClinicalCopy, buildSymptomsCopy, buildHistoryCopy]);

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    const recordsWithMeta = unwrappedData.map((record, idx) => ({
      ...record,
      _recordNumber: idx + 1,
      _documentTitle: `Depression Screening ${idx + 1}`,
      _showAllSections: false
    }));

    if (!searchTerm.trim()) return recordsWithMeta;

    const searchLower = searchTerm.toLowerCase().trim();

    return recordsWithMeta.filter(record => {
      // Check for document title search
      const titleLower = record._documentTitle.toLowerCase();
      if (titleLower.includes(searchLower) || searchLower.includes(titleLower)) {
        record._showAllSections = true;
        return true;
      }

      // Build searchable text with all section titles and field labels (3 case variations)
      const chartData = prepareChartData(record);
      const searchableText = [
        // Document title
        record._documentTitle,
        // Section titles
        'Assessment Scores', 'assessment scores', 'ASSESSMENT SCORES',
        'Clinical Assessment', 'clinical assessment', 'CLINICAL ASSESSMENT',
        'Current Symptoms', 'current symptoms', 'CURRENT SYMPTOMS',
        // History & Comorbidities - include full title with & AND separate words
        'History & Comorbidities', 'history & comorbidities', 'HISTORY & COMORBIDITIES',
        'History and Comorbidities', 'history and comorbidities', 'HISTORY AND COMORBIDITIES',
        'History', 'history', 'HISTORY',
        'Comorbidities', 'comorbidities', 'COMORBIDITIES',
        '&', 'and',
        // Field labels
        'PHQ-9 Score', 'phq-9 score', 'PHQ9', 'phq9',
        'PHQ-2 Score', 'phq-2 score', 'PHQ2', 'phq2',
        'GAD-7 Score', 'gad-7 score', 'GAD7', 'gad7',
        'Beck Depression', 'beck depression', 'BDI',
        'Hamilton', 'hamilton', 'HDRS',
        'Montgomery-Asberg', 'montgomery-asberg', 'MADRS',
        'Edinburgh', 'edinburgh', 'EPDS', 'postnatal',
        'Geriatric', 'geriatric', 'GDS',
        'Columbia', 'columbia', 'CSSRS', 'suicide',
        'Depression Severity', 'Depression Severity Level', 'depression severity', 'depression severity level',
        'Major Depressive', 'Major Depressive Episode', 'Major Depressive Episode Criteria', 'major depressive', 'major depressive episode', 'major depressive episode criteria',
        'Psychotic Features', 'Psychotic Features Present', 'psychotic features', 'psychotic features present',
        'Suicidal Ideation', 'Suicidal Ideation Present', 'suicidal ideation', 'suicidal ideation present',
        'Anxiety Severity', 'Anxiety Symptom Severity', 'anxiety severity', 'anxiety symptom severity',
        'Functional Impairment', 'Functional Impairment Level', 'functional impairment', 'functional impairment level',
        'Sleep Disturbance', 'Sleep Disturbance Type', 'sleep disturbance', 'sleep disturbance type',
        'Appetite Changes', 'appetite changes',
        'Energy', 'energy', 'Fatigue', 'fatigue', 'Energy / Fatigue', 'Energy / Fatigue Level', 'energy / fatigue', 'energy / fatigue level', 'Energy/Fatigue', 'Energy/Fatigue Level',
        'Concentration', 'concentration', 'Concentration Difficulties', 'concentration difficulties',
        'Worthlessness', 'worthlessness', 'Guilt', 'guilt', 'Worthlessness / Guilt', 'Worthlessness/Guilt', 'worthlessness / guilt',
        'Psychomotor', 'psychomotor', 'Psychomotor Changes', 'psychomotor changes',
        'Prior Episodes', 'Prior Depression Episodes', 'prior episodes', 'prior depression episodes', 'Prior Depression', 'prior depression',
        'Substance Use', 'Substance Use Comorbidity', 'substance use', 'substance use comorbidity',
        'Medical Comorbidities', 'medical comorbidities',
        'Antidepressant', 'antidepressant', 'Medications', 'medications',
        // Field values
        record.depressionSeverityLevel,
        record.anxietySymptomSeverity,
        record.functionalImpairmentLevel,
        record.appetiteChanges,
        record.energyFatigueLevel,
        record.psychomotorChanges,
        ...(record.sleepDisturbanceType || []),
        ...(record.medicalComorbidities || []),
        ...(record.currentAntidepressantMedications || []),
        // Chart interpretations
        ...chartData.map(c => c.interpretation),
        ...chartData.map(c => c.keywords)
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchLower);
    });
  }, [unwrappedData, searchTerm]);

  // Early return for no data
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="depression-screening-document">
        <div className="empty-state">No depression screening records available.</div>
      </div>
    );
  }

  return (
    <div className="depression-screening-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Depression Screening</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((record, idx) => getAllRecordText(record, idx)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<DepressionScreeningDocumentPDFTemplate document={pdfData} />}
            fileName="Depression_Screening.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search depression screenings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="no-results">No records match your search.</div>
        ) : (
          filteredRecords.map((record, idx) => {
            const recordId = `record-${idx}`;
            const showAll = !searchTerm.trim() || record._showAllSections;
            const chartData = prepareChartData(record);

            // scoresMatches: ONLY matches section title - individual chart filtering via filteredChartData
            const scoresMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              const searchLower = searchTerm.toLowerCase().trim();
              // Only return true if searching for section title specifically
              return ['assessment scores', 'scores'].includes(searchLower);
            })();

            // Check if ANY score field matches (for section visibility)
            const anyScoreFieldMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              return shouldShowRow(record,
                'Assessment Scores', 'assessment scores', 'ASSESSMENT SCORES',
                'PHQ-9', 'PHQ-2', 'GAD-7', 'Beck', 'Hamilton', 'Montgomery', 'Edinburgh', 'Geriatric', 'Columbia',
                ...chartData.map(c => c.label),
                ...chartData.map(c => c.interpretation)
              );
            })();

            // clinicalMatches: ONLY matches section title - individual field filtering at row level
            const clinicalMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              const searchLower = searchTerm.toLowerCase().trim();
              // Only return true if searching for section title specifically
              return ['clinical assessment', 'clinical'].includes(searchLower);
            })();

            // Check if ANY clinical field matches (for section visibility)
            const anyClinicalFieldMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              return shouldShowRow(record,
                'Clinical Assessment', 'clinical assessment', 'CLINICAL ASSESSMENT',
                'Depression Severity', 'Depression Severity Level', 'depression severity level',
                'Major Depressive', 'Major Depressive Episode', 'Major Depressive Episode Criteria', 'major depressive episode criteria',
                'Psychotic Features', 'Psychotic Features Present', 'psychotic features present',
                'Suicidal Ideation', 'Suicidal Ideation Present', 'suicidal ideation present',
                'Anxiety Severity', 'Anxiety Symptom Severity', 'anxiety symptom severity',
                'Functional Impairment', 'Functional Impairment Level', 'functional impairment level',
                record.depressionSeverityLevel, record.anxietySymptomSeverity, record.functionalImpairmentLevel
              );
            })();

            // symptomsMatches: ONLY matches section title - individual field filtering at row level
            const symptomsMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              const searchLower = searchTerm.toLowerCase().trim();
              // Only return true if searching for section title specifically
              return ['current symptoms', 'symptoms'].includes(searchLower);
            })();

            // Check if ANY symptom field matches (for section visibility)
            const anySymptomFieldMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              return shouldShowRow(record,
                'Current Symptoms', 'current symptoms', 'CURRENT SYMPTOMS',
                'Sleep Disturbance', 'Sleep Disturbance Type', 'sleep disturbance type',
                'Appetite', 'Appetite Changes', 'appetite changes',
                'Energy', 'Energy/Fatigue', 'Energy / Fatigue', 'Energy / Fatigue Level', 'Energy Fatigue', 'Fatigue',
                'Concentration', 'Concentration Difficulties', 'concentration difficulties',
                'Worthlessness', 'Worthlessness/Guilt', 'Worthlessness / Guilt', 'Worthlessness Guilt', 'Guilt',
                'Psychomotor', 'Psychomotor Changes', 'psychomotor changes',
                record.appetiteChanges, record.energyFatigueLevel, record.psychomotorChanges,
                ...(record.sleepDisturbanceType || [])
              );
            })();

            // historyMatches: ONLY matches section title - individual field filtering at row level
            const historyMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              const searchLower = searchTerm.toLowerCase().trim();
              // Only return true if searching for section title specifically
              return ['history & comorbidities', 'history and comorbidities', 'history', 'comorbidities'].includes(searchLower);
            })();

            // Check if ANY history field matches (for section visibility)
            const anyHistoryFieldMatches = (() => {
              if (!searchTerm.trim() || record._showAllSections) return true;
              return shouldShowRow(record,
                // Full section title with ampersand variations
                'History & Comorbidities', 'history & comorbidities', 'HISTORY & COMORBIDITIES',
                'History and Comorbidities', 'history and comorbidities',
                'History', 'history', 'HISTORY', 'Comorbidities', 'comorbidities', 'COMORBIDITIES',
                'Prior Episodes', 'Prior Depression Episodes', 'prior depression episodes', 'Prior Depression', 'prior depression',
                'Substance Use', 'Substance Use Comorbidity', 'substance use comorbidity',
                'Medical Comorbidities', 'medical comorbidities',
                'Antidepressant', 'Current Antidepressant Medications', 'Medications', 'medications',
                ...(record.medicalComorbidities || []),
                ...(record.currentAntidepressantMedications || [])
              );
            })();

            // Filter chart data - only return all when searching section title specifically
            const filteredChartData = (() => {
              if (!searchTerm.trim() || showAll) return chartData;
              const searchLower = searchTerm.toLowerCase().trim();
              // If searching for section title "Assessment Scores", show all charts
              if (searchLower === 'assessment scores' || searchLower === 'scores') return chartData;
              // Otherwise filter to matching individual charts
              return chartData.filter(chart => {
                const combined = `${chart.label} ${chart.interpretation} ${chart.keywords}`.toLowerCase();
                return combined.includes(searchLower);
              });
            })();

            return (
              <div key={idx} className="record-card">
                {/* Record Header */}
                <div className="record-header">
                  <div className="header-top-row">
                    <span className="date-badge">{formatDate(record.createdAt || record.createdAtUTC)}</span>
                  </div>
                  <h2 className="record-title">{highlightText(`Depression Screening ${record._recordNumber}`)}</h2>
                </div>

                {/* Assessment Scores Section - Bar Charts (read-only, no editing) */}
                {filteredChartData.length > 0 && (anyScoreFieldMatches || showAll) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Assessment Scores')}</h3>
                        <button
                          className={`copy-btn ${copiedId === `${recordId}-scores` ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(buildScoresCopy(pdfData[idx] || record).trimEnd(), `${recordId}-scores`)}
                        >
                          {copiedId === `${recordId}-scores` ? 'Copied!' : 'Copy Section'}
                        </button>
                      </div>
                      <div className="chart-container">
                        <Legend />
                        {filteredChartData.map((chart, cIdx) => (
                          <BarChart
                            key={cIdx}
                            label={chart.label}
                            score={chart.score}
                            max={chart.max}
                            percentage={chart.percentage}
                            color={chart.color}
                            interpretation={chart.interpretation}
                            highlightFn={highlightText}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clinical Assessment Section */}
                {(anyClinicalFieldMatches || showAll) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Clinical Assessment', `${recordId}-clinical`, () => {
                        copyToClipboard(buildClinicalCopy(pdfData[idx] || record).trimEnd(), `${recordId}-clinical`);
                      }, idx, 'clinical')}

                      {/* depressionSeverityLevel — clinical-scale dropdown */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Depression Severity', 'Depression Severity Level', 'depression severity level', record.depressionSeverityLevel)) &&
                        renderEnumField(record, 'depressionSeverityLevel', 'Depression Severity Level', idx, 'clinical', `${recordId}-severity`)
                      }

                      {/* majorDepressiveEpisodeCriteria — editable Yes/No */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Major Depressive Episode Criteria', 'major depressive episode criteria', 'Major Depressive', 'major depressive', 'Episode Criteria', 'episode criteria')) &&
                        renderBooleanField(record, 'majorDepressiveEpisodeCriteria', 'Major Depressive Episode Criteria', idx, 'clinical', `${recordId}-mde`)
                      }

                      {/* psychoticFeaturesPresent — editable Yes/No */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Psychotic Features Present', 'psychotic features present', 'Psychotic Features', 'psychotic features')) &&
                        renderBooleanField(record, 'psychoticFeaturesPresent', 'Psychotic Features Present', idx, 'clinical', `${recordId}-psychotic`)
                      }

                      {/* suicidalIdeationPresent — editable Yes/No */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Suicidal Ideation Present', 'suicidal ideation present', 'Suicidal Ideation', 'suicidal ideation')) &&
                        renderBooleanField(record, 'suicidalIdeationPresent', 'Suicidal Ideation Present', idx, 'clinical', `${recordId}-suicidal`)
                      }

                      {/* anxietySymptomSeverity — clinical-scale dropdown */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Anxiety Symptom Severity', 'anxiety symptom severity', 'Anxiety Severity', 'anxiety severity', record.anxietySymptomSeverity)) &&
                        renderEnumField(record, 'anxietySymptomSeverity', 'Anxiety Symptom Severity', idx, 'clinical', `${recordId}-anxiety`)
                      }

                      {/* functionalImpairmentLevel — clinical-scale dropdown */}
                      {(showAll || clinicalMatches || shouldShowRow(record, 'Functional Impairment Level', 'functional impairment level', 'Functional Impairment', 'functional impairment', record.functionalImpairmentLevel)) &&
                        renderEnumField(record, 'functionalImpairmentLevel', 'Functional Impairment Level', idx, 'clinical', `${recordId}-functional`)
                      }
                    </div>
                  </div>
                )}

                {/* Current Symptoms Section */}
                {(anySymptomFieldMatches || showAll) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Current Symptoms', `${recordId}-symptoms`, () => {
                        copyToClipboard(buildSymptomsCopy(pdfData[idx] || record).trimEnd(), `${recordId}-symptoms`);
                      }, idx, 'symptoms')}

                      {/* sleepDisturbanceType — editable array */}
                      {record.sleepDisturbanceType?.length > 0 && (showAll || symptomsMatches || shouldShowRow(record, 'Sleep Disturbance', 'Sleep Disturbance Type', 'sleep disturbance', 'sleep disturbance type', ...record.sleepDisturbanceType)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Sleep Disturbance Type')}</div>
                          {record.sleepDisturbanceType.map((item, i) =>
                            renderEditableArrayItem(record, 'sleepDisturbanceType', item, idx, i, 'symptoms', `${recordId}-sleep-${i}`)
                          )}
                        </div>
                      )}

                      {/* appetiteChanges — editable */}
                      {(showAll || symptomsMatches || shouldShowRow(record, 'Appetite Changes', 'appetite changes', record.appetiteChanges)) &&
                        renderEditableField(record, 'appetiteChanges', 'Appetite Changes', idx, 'symptoms', `${recordId}-appetite`)
                      }

                      {/* energyFatigueLevel — clinical-scale dropdown */}
                      {(showAll || symptomsMatches || shouldShowRow(record, 'Energy', 'energy', 'Fatigue', 'fatigue', 'Energy / Fatigue', 'Energy / Fatigue Level', 'energy / fatigue', 'energy / fatigue level', 'Energy/Fatigue', record.energyFatigueLevel)) &&
                        renderEnumField(record, 'energyFatigueLevel', 'Energy / Fatigue Level', idx, 'symptoms', `${recordId}-energy`)
                      }

                      {/* concentrationDifficulties — editable Yes/No */}
                      {(showAll || symptomsMatches || shouldShowRow(record, 'Concentration', 'concentration', 'Concentration Difficulties', 'concentration difficulties', 'difficulties')) &&
                        renderBooleanField(record, 'concentrationDifficulties', 'Concentration Difficulties', idx, 'symptoms', `${recordId}-concentration`)
                      }

                      {/* worthlessnessGuilt — editable Yes/No */}
                      {(showAll || symptomsMatches || shouldShowRow(record, 'Worthlessness', 'worthlessness', 'Guilt', 'guilt', 'Worthlessness / Guilt', 'Worthlessness/Guilt', 'worthlessness / guilt', 'worthlessness/guilt')) &&
                        renderBooleanField(record, 'worthlessnessGuilt', 'Worthlessness / Guilt', idx, 'symptoms', `${recordId}-worthlessness`)
                      }

                      {/* psychomotorChanges — editable */}
                      {(showAll || symptomsMatches || shouldShowRow(record, 'Psychomotor', 'psychomotor', record.psychomotorChanges)) &&
                        renderEditableField(record, 'psychomotorChanges', 'Psychomotor Changes', idx, 'symptoms', `${recordId}-psychomotor`)
                      }
                    </div>
                  </div>
                )}

                {/* History & Comorbidities Section */}
                {(anyHistoryFieldMatches || showAll) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('History & Comorbidities', `${recordId}-history`, () => {
                        copyToClipboard(buildHistoryCopy(pdfData[idx] || record).trimEnd(), `${recordId}-history`);
                      }, idx, 'history')}

                      {/* priorDepressionEpisodes — editable number stepper */}
                      {(showAll || historyMatches || shouldShowRow(record, 'Prior Depression Episodes', 'prior depression episodes', 'Prior Episodes', 'prior episodes', 'Prior Depression', 'prior depression')) &&
                        renderNumberField(record, 'priorDepressionEpisodes', 'Prior Depression Episodes', idx, 'history', `${recordId}-prior`)
                      }

                      {/* substanceUseComorbidity — editable Yes/No */}
                      {(showAll || historyMatches || shouldShowRow(record, 'Substance Use Comorbidity', 'substance use comorbidity', 'Substance Use', 'substance use', 'Comorbidity', 'comorbidity')) &&
                        renderBooleanField(record, 'substanceUseComorbidity', 'Substance Use Comorbidity', idx, 'history', `${recordId}-substance`)
                      }

                      {/* medicalComorbidities — editable array */}
                      {record.medicalComorbidities?.length > 0 && (showAll || historyMatches || shouldShowRow(record, 'Medical Comorbidities', 'medical comorbidities', ...record.medicalComorbidities)) && (
                        <div className="rec-mini-card">
                          <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <div className="nested-subtitle" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                              {highlightText('Medical Comorbidities')}
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `${recordId}-comorbidities` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(arrayLines('Medical Comorbidities', r.medicalComorbidities || []).trimEnd(), `${recordId}-comorbidities`);
                              }}
                            >
                              {copiedId === `${recordId}-comorbidities` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>
                          {record.medicalComorbidities.map((item, i) =>
                            renderEditableArrayItem(record, 'medicalComorbidities', item, idx, i, 'history', `${recordId}-comorbidity-${i}`)
                          )}
                        </div>
                      )}

                      {/* currentAntidepressantMedications — editable array */}
                      {record.currentAntidepressantMedications?.length > 0 && (showAll || historyMatches || shouldShowRow(record, 'Antidepressant', 'antidepressant', 'Medications', 'medications', ...record.currentAntidepressantMedications)) && (
                        <div className="rec-mini-card">
                          <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <div className="nested-subtitle" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                              {highlightText('Current Antidepressant Medications')}
                            </div>
                            <button
                              className={`copy-btn ${copiedId === `${recordId}-medications` ? 'copied' : ''}`}
                              onClick={() => {
                                const r = pdfData[idx] || record;
                                copyToClipboard(arrayLines('Current Antidepressant Medications', r.currentAntidepressantMedications || []).trimEnd(), `${recordId}-medications`);
                              }}
                            >
                              {copiedId === `${recordId}-medications` ? 'Copied!' : 'Copy Section'}
                            </button>
                          </div>
                          {record.currentAntidepressantMedications.map((item, i) =>
                            renderEditableArrayItem(record, 'currentAntidepressantMedications', item, idx, i, 'history', `${recordId}-medication-${i}`)
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DepressionScreeningDocument;
