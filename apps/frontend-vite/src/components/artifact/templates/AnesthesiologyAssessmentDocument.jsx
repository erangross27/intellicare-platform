import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';
import AnesthesiologyAssessmentDocumentPDFTemplate from '../pdf-templates/AnesthesiologyAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AnesthesiologyAssessmentDocument.css';

/**
 * AnesthesiologyAssessmentDocument - Inline Editing Edition
 *
 * Bar Chart Scores (6 metrics): display-only, no editing
 * Sections with editing:
 * 1. Assessment Information (type editable; date/provider/facility/status non-editable)
 * 2. Score Overview (bar charts - display-only)
 * 3. Airway Assessment (dot-path nested object editing)
 * 4. Anesthesia Plan (dot-path nested object editing)
 * 5. Pain Management (dot-path nested object + array editing)
 * 6. Findings, Assessment, Plan (per-sentence editing)
 * 7. Recommendations (array editing)
 * 8. Notes (per-sentence editing)
 */

// ==================== SECTION_FIELDS for per-section approve ====================
const SECTION_FIELDS = {
  headerInfo: ['type', 'asaClassification'],
  airwayAssessment: ['airwayAssessment'],
  anesthesiaPlan: ['anesthesiaPlan'],
  painManagement: ['painManagement'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const NON_EDITABLE_FIELDS = ['date', 'provider', 'facility', 'status', 'createdAt', 'updatedAt', '_id', 'patientId'];

const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

const OBJECT_FIELDS = ['airwayAssessment', 'anesthesiaPlan', 'painManagement'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "fieldName" — may be a dot-path) */
const DRAFT_KEY = 'anesthesiology_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ==================== PLAIN FUNCTIONS ====================

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/[.;]\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// ==================== BAR CHART SCORE FUNCTIONS ====================

const getASAInterpretation = (score) => {
  if (score === 1) return { color: '#22c55e', text: 'Healthy Patient' };
  if (score === 2) return { color: '#3b82f6', text: 'Mild Systemic Disease' };
  if (score === 3) return { color: '#f59e0b', text: 'Severe Systemic Disease' };
  if (score === 4) return { color: '#ef4444', text: 'Life-Threatening Disease' };
  return { color: '#dc2626', text: 'Moribund Patient' };
};

const getMallampatiInterpretation = (score) => {
  if (score === 1) return { color: '#22c55e', text: 'Class I - Easy Intubation' };
  if (score === 2) return { color: '#3b82f6', text: 'Class II - Moderate' };
  if (score === 3) return { color: '#f59e0b', text: 'Class III - Difficult' };
  return { color: '#ef4444', text: 'Class IV - Very Difficult' };
};

const getPainInterpretation = (score) => {
  if (score === 0) return { color: '#22c55e', text: 'No Pain' };
  if (score <= 3) return { color: '#3b82f6', text: 'Mild Pain' };
  if (score <= 6) return { color: '#f59e0b', text: 'Moderate Pain' };
  return { color: '#ef4444', text: 'Severe Pain' };
};

const getSTOPBANGInterpretation = (score) => {
  if (score <= 2) return { color: '#22c55e', text: 'Low OSA Risk' };
  if (score <= 4) return { color: '#f59e0b', text: 'Intermediate OSA Risk' };
  return { color: '#ef4444', text: 'High OSA Risk' };
};

const getRCRIInterpretation = (score) => {
  if (score === 0) return { color: '#22c55e', text: 'Very Low Cardiac Risk' };
  if (score === 1) return { color: '#3b82f6', text: 'Low Cardiac Risk' };
  if (score === 2) return { color: '#f59e0b', text: 'Moderate Cardiac Risk' };
  return { color: '#ef4444', text: 'High Cardiac Risk' };
};

const getApfelInterpretation = (score) => {
  if (score === 0) return { color: '#22c55e', text: 'Low PONV Risk (~10%)' };
  if (score === 1) return { color: '#3b82f6', text: 'Low-Moderate PONV Risk (~20%)' };
  if (score === 2) return { color: '#f59e0b', text: 'Moderate PONV Risk (~40%)' };
  if (score === 3) return { color: '#f97316', text: 'Moderate-High PONV Risk (~60%)' };
  return { color: '#ef4444', text: 'High PONV Risk (~80%)' };
};

const extractASAScore = (asaText) => {
  if (!asaText) return null;
  const str = String(asaText).toUpperCase();
  const match = str.match(/ASA\s*(I{1,3}V?|IV|V|[1-5])/);
  if (match) {
    const roman = match[1];
    if (roman === 'I' || roman === '1') return 1;
    if (roman === 'II' || roman === '2') return 2;
    if (roman === 'III' || roman === '3') return 3;
    if (roman === 'IV' || roman === '4') return 4;
    if (roman === 'V' || roman === '5') return 5;
  }
  return null;
};

const extractMallampatiScore = (mallampatiText) => {
  if (!mallampatiText) return null;
  const str = String(mallampatiText).toUpperCase();
  const match = str.match(/CLASS\s*(I{1,3}V?|IV|[1-4])|^(I{1,3}V?|IV|[1-4])$/);
  if (match) {
    const value = match[1] || match[2];
    if (value === 'I' || value === '1') return 1;
    if (value === 'II' || value === '2') return 2;
    if (value === 'III' || value === '3') return 3;
    if (value === 'IV' || value === '4') return 4;
  }
  return null;
};

const extractScoreFromText = (text, pattern) => {
  if (!text) return null;
  const str = String(text);
  const match = str.match(pattern);
  if (match) return parseFloat(match[1]);
  return null;
};

const prepareChartData = (record) => {
  const charts = [];
  const asaScore = extractASAScore(record.asaClassification);
  if (asaScore !== null) {
    const interp = getASAInterpretation(asaScore);
    charts.push({ key: 'asa', label: 'ASA Physical Status', percentage: (asaScore / 5) * 100, rawValue: `ASA ${['I', 'II', 'III', 'IV', 'V'][asaScore - 1]}`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const mallampatiScore = extractMallampatiScore(record.airwayAssessment?.mallampati);
  if (mallampatiScore !== null) {
    const interp = getMallampatiInterpretation(mallampatiScore);
    charts.push({ key: 'mallampati', label: 'Mallampati Score', percentage: (mallampatiScore / 4) * 100, rawValue: `Class ${['I', 'II', 'III', 'IV'][mallampatiScore - 1]}`, color: interp.color, interpretation: interp.text, category: 'Airway Assessment' });
  }
  if (record.painManagement?.currentPainScore != null) {
    const painScore = parseFloat(record.painManagement.currentPainScore);
    if (!isNaN(painScore) && painScore >= 0) {
      const interp = getPainInterpretation(painScore);
      charts.push({ key: 'pain', label: 'Current Pain Score', percentage: (painScore / 10) * 100, rawValue: `${painScore}/10`, color: interp.color, interpretation: interp.text, category: 'Pain Management' });
    }
  }
  const stopBangScore = extractScoreFromText(record.findings, /STOP-BANG\s*Score[:\s]*(\d+)/i);
  if (stopBangScore !== null) {
    const interp = getSTOPBANGInterpretation(stopBangScore);
    charts.push({ key: 'stopbang', label: 'STOP-BANG Score', percentage: (stopBangScore / 8) * 100, rawValue: `${stopBangScore}/8`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const rcriScore = extractScoreFromText(record.findings, /RCRI\s*Score[:\s]*(\d+)/i);
  if (rcriScore !== null) {
    const interp = getRCRIInterpretation(rcriScore);
    charts.push({ key: 'rcri', label: 'RCRI (Cardiac Risk)', percentage: (rcriScore / 6) * 100, rawValue: `${rcriScore}/6`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  const apfelScore = extractScoreFromText(record.findings, /Apfel\s*Score[:\s]*(\d+)/i);
  if (apfelScore !== null) {
    const interp = getApfelInterpretation(apfelScore);
    charts.push({ key: 'apfel', label: 'Apfel Score (PONV Risk)', percentage: (apfelScore / 4) * 100, rawValue: `${apfelScore}/4`, color: interp.color, interpretation: interp.text, category: 'Risk Assessment' });
  }
  return charts;
};

// ==================== BAR CHART COMPONENTS ====================

const Legend = () => (
  <div className="chart-legend">
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Low/Normal</span></div>
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>Mild</span></div>
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }} /><span>Moderate</span></div>
    <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>High/Severe</span></div>
  </div>
);

const BarChart = ({ label, percentage, rawValue, color, interpretation, highlightFn }) => (
  <div className="bar-chart-row">
    <div className="bar-label">{highlightFn ? highlightFn(label) : label}</div>
    <div className="bar-container">
      <div className="bar-background">
        <div className="bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <div className="bar-value">{highlightFn ? highlightFn(rawValue) : rawValue}</div>
    </div>
    <div className="bar-interpretation" style={{ color }}>{highlightFn ? highlightFn(interpretation) : interpretation}</div>
  </div>
);

// ==================== MAIN COMPONENT ====================

const AnesthesiologyAssessmentDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [approving, setApproving] = useState(false);
  const textareaRef = useRef(null);
  const contentRef = useRef(null);

  const canEdit = true;

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '';
      if (val.value !== undefined) return String(val.value);
      if (val.$date) return val.$date;
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Unwrap the supported API/container shapes before deciding whether this is a record list.
  // The audit harness intentionally wraps fixtures in a one-item array, so peel that synthetic
  // layer only when the item is itself a recognized document wrapper (never unwrap a real record).
  const normalizedDoc = Array.isArray(rawDoc) && rawDoc.length === 1 && (
    rawDoc[0]?.anesthesiology_assessment || rawDoc[0]?.data || rawDoc[0]?.documentData?.records
  ) ? rawDoc[0] : rawDoc;

  // Unwrap data
  let recordsArray = [];
  if (normalizedDoc?.anesthesiology_assessment) {
    recordsArray = Array.isArray(normalizedDoc.anesthesiology_assessment)
      ? normalizedDoc.anesthesiology_assessment
      : [normalizedDoc.anesthesiology_assessment];
  } else if (normalizedDoc?.documentData?.records) {
    recordsArray = Array.isArray(normalizedDoc.documentData.records)
      ? normalizedDoc.documentData.records
      : [normalizedDoc.documentData.records];
  } else if (Array.isArray(normalizedDoc)) {
    recordsArray = normalizedDoc;
  } else if (normalizedDoc?.data) {
    recordsArray = Array.isArray(normalizedDoc.data) ? normalizedDoc.data : [normalizedDoc.data];
  } else if (normalizedDoc) {
    recordsArray = [normalizedDoc];
  }

  // Stable signature of record ids → used as the rehydrate effect dependency so we don't loop on the
  // freshly-built recordsArray each render.
  const recordIdSignature = recordsArray.map(r => (r && (r._id?.$oid || r._id)) || '').join('|');

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    recordsArray.forEach((rec, idx) => {
      const recId = rec && (rec._id?.$oid || rec._id);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordIdSignature]);

  // Format date
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = dateVal.$date ? new Date(dateVal.$date) : new Date(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return safeString(dateVal);
    }
  };

  const toInputDate = (dateVal) => {
    if (!dateVal) return '';
    const parsed = new Date(dateVal?.$date || dateVal);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  };

  // Format object key to readable label
  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  };

  // Highlight text function — phrase matching
  const highlightText = (text) => {
    if (!text) return '';
    const textStr = safeString(text);
    const phrase = searchTerm.trim();
    if (!phrase) return textStr;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;
    const phraseLower = phrase.toLowerCase();
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
        )}
      </>
    );
  };

  // shouldShowRow — phrase matching
  const shouldShowRow = (record, ...searchableValues) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const combinedText = searchableValues
      .filter(Boolean)
      .map(v => safeString(v).toLowerCase())
      .join(' ');
    return combinedText.includes(searchLower);
  };

  // shouldShowSection — phrase matching
  const shouldShowSection = (record, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).map(s => String(s).toLowerCase()).join(' ')
      : (sectionContent || '').toString().toLowerCase();
    const combinedText = `${titleLower} ${contentText}`;
    return combinedText.includes(searchLower);
  };

  // sectionTitleMatches — bidirectional startsWith phrase matching
  const stm = (...titles) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    return titles.some(title => {
      const t = (title || '').toLowerCase();
      return t.startsWith(p) || p.startsWith(t);
    });
  };

  // Filter chart data based on search — phrase matching
  const getFilteredChartData = (chartData) => {
    if (!searchTerm.trim()) return chartData;
    const searchLower = searchTerm.toLowerCase().trim();
    if (stm('Score Overview')) return chartData;
    const categories = ['risk assessment', 'airway assessment', 'pain management'];
    for (const cat of categories) {
      if (cat === searchLower || cat.includes(searchLower)) {
        return chartData.filter(c => c.category.toLowerCase() === cat);
      }
    }
    return chartData.filter(chart => {
      const combinedText = `${chart.label} ${chart.rawValue} ${chart.interpretation || ''} ${chart.category || ''}`.toLowerCase();
      return combinedText.includes(searchLower);
    });
  };

  // ─── Editing helpers ──────────────────────────────────────────────────

  const getEffectiveDot = (rec, dotPath, recIdx) => {
    const editKey = `${dotPath}-${recIdx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const parts = dotPath.split('.');
    let current = rec;
    for (const p of parts) { current = current?.[p]; }
    return current;
  };

  const getEffective = (rec, fieldName, recIdx) => {
    const editKey = `${fieldName}-${recIdx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : rec[fieldName];
  };

  const getEffectiveArray = (rec, fieldName, recIdx) => {
    const editKey = `${fieldName}-${recIdx}`;
    return localEdits[editKey] !== undefined ? localEdits[editKey] : (rec[fieldName] || []);
  };

  const handleStartEdit = useCallback((fieldName, recIdx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${recIdx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleStartEditArray = useCallback((fieldName, recIdx, itemIdx, currentValue) => {
    const editKey = `${fieldName}-${recIdx}-item${itemIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((rec, fieldName, recIdx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = rec._id?.$oid || rec._id || '';
    if (!recordId) { console.error('Cannot save - no _id'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const sKey = editTrackingKey || `${fieldName}-${recIdx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    const fullEditKey = `${fieldName}-${recIdx}`;
    setLocalEdits(prev => ({ ...prev, [fullEditKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedFields(prev => ({ ...prev, [fullEditKey]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${recIdx}`]; return u; });
    // Stage the draft in localStorage (keyed by record id → fieldName) so it survives a refresh.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // reconstructFullText
  const reconstructFullText = (allSentences, sIdx, editedSentence, fieldName, recIdx, hasFullEdit) => {
    const updated = allSentences.map((s, i) => {
      let t;
      if (i === sIdx) {
        t = editedSentence;
      } else if (!hasFullEdit) {
        const pKey = `${fieldName}.s${i}-${recIdx}`;
        t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      } else {
        t = s;
      }
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  // saveSentence
  const saveSentence = (rec, fieldName, recIdx, sectionId, sIdx, valueOverride) => {
    let editedSentenceVal = valueOverride !== undefined ? String(valueOverride).trim() : editValue.trim();
    if (editedSentenceVal && !/[.!?]$/.test(editedSentenceVal)) editedSentenceVal += '.';
    const fullEditKey = `${fieldName}-${recIdx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    // Read the source via dot-path traversal so object sub-fields (e.g. "anesthesiaPlan.technique")
    // resolve correctly, not just top-level rec[fieldName].
    const rawDotVal = fieldName.split('.').reduce((cur, p) => (cur == null ? cur : cur[p]), rec);
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (rawDotVal || '');
    const allCurrent = splitBySentence(String(sourceText));
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentenceVal, fieldName, recIdx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const editedMap = {};
      // Only mark original sentence as edited if its content actually changed
      if (allCurrent[sIdx] !== newSentences[sIdx]) {
        editedMap[`${fieldName}-${recIdx}-s${sIdx}`] = 'edited';
      }
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${recIdx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${recIdx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    }
    handleSaveField(rec, fieldName, recIdx, sectionId, sIdx, fullText);
  };

  // Only these labeled clinical-score clauses are numerator-editable ratios. Narrative values
  // containing a slash (for example an intubation grade) stay on the ordinary text path.
  const CLINICAL_RATIO_LABELS = new Set(['STOP-BANG Score', 'RCRI Score', 'Apfel Score']);
  const RATIO_VALUE_RE = /^(\d+(?:\.\d+)?)(\s*\/\s*\d+(?:\.\d+)?)[.!?]?$/;

  // saveArrayItem
  const saveArrayItem = (rec, fieldName, recIdx, sectionId, itemIdx) => {
    const newValue = editValue.trim();
    const currentArray = [...getEffectiveArray(rec, fieldName, recIdx)];
    currentArray[itemIdx] = newValue;
    handleSaveField(rec, fieldName, recIdx, sectionId, 0, currentArray, `${fieldName}-${recIdx}-item${itemIdx}`);
  };

  // sectionHasEdits
  const sectionHasEdits = useCallback((sectionId, recIdx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    if (approvedSections[`${sectionId}-${recIdx}`]) return false;
    return fields.some(f => {
      // Match BOTH top-level keys (`field-idx-...`) and dot-path object keys (`field.sub-idx-...`),
      // otherwise edits to object sub-fields (e.g. anesthesiaPlan.technique) never flag the section.
      const hasSentenceEdits = Object.keys(editedSentences).some(key => {
        const matches = key.startsWith(`${f}-${recIdx}-s`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-s`));
        if (!matches) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
      const hasObjectEdits = Object.keys(editedFields).some(key =>
        key.startsWith(`${f}-${recIdx}`) || (key.startsWith(`${f}.`) && key.endsWith(`-${recIdx}`))
      );
      const hasArrayEdits = Object.keys(editedSentences).some(key => {
        const matches = key.startsWith(`${f}-${recIdx}-item`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-item`));
        if (!matches) return false;
        return editedSentences[key] === 'edited';
      });
      return hasSentenceEdits || hasObjectEdits || hasArrayEdits;
    });
  }, [editedSentences, editedFields, approvedSections]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (rec, recIdx, sectionId) => {
    const approveKey = `${sectionId}-${recIdx}`;
    if (approvedSections[approveKey]) return;

    const fields = SECTION_FIELDS[sectionId] || [];
    const recordId = rec._id?.$oid || rec._id || '';

    // Collect this section+record's staged pending edits. editKey = `${fieldName}-${recIdx}`,
    // where fieldName may be a dot-path (e.g. "airwayAssessment.mallampati"). A field belongs to this
    // section if its base (segment before the first dot, or the whole name) is in SECTION_FIELDS.
    const suffix = `-${recIdx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });

    setApproving(true);
    try {
      // Persist each staged field to the DB now. arrayIndex ONLY when the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "fieldName" or "a.b" (dot-path)
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/anesthesiology_assessment/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      if (recordId) {
        await secureApiClient.put(`/api/edit/anesthesiology_assessment/${recordId}/approve`, {
          sectionId,
          approved: true,
        });
      }

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's committed drafts from localStorage (other sections stay staged)
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(k => { delete store[recordId][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [approveKey]: true }));
      setEditedSentences(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            if (key.startsWith(`${f}-${recIdx}-`) || (key.startsWith(`${f}.`) && key.includes(`-${recIdx}-`))) delete cleaned[key];
          });
        });
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        fields.forEach(f => {
          Object.keys(cleaned).forEach(key => {
            if (key.startsWith(`${f}-${recIdx}`) || (key.startsWith(`${f}.`) && key.endsWith(`-${recIdx}`))) delete cleaned[key];
          });
        });
        return cleaned;
      });
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setApproving(false);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  // renderApproveBtn
  const renderApproveBtn = (rec, sectionId, recIdx) => {
    const key = `${sectionId}-${recIdx}`;
    const isApproved = approvedSections[key];
    const hasEdits = sectionHasEdits(sectionId, recIdx);
    if (!hasEdits && !isApproved) return null;
    if (hasEdits) return <button className="approve-btn pending" onClick={() => handleApproveSection(rec, recIdx, sectionId)} disabled={approving}>{approving ? 'Approving...' : 'Pending Approve'}</button>;
    return <span className="approve-btn approved">Approved</span>;
  };

  // Copy function
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Format object for copy text
  const formatObjectCopyText = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    const lines = [];
    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      const label = formatKey(key);
      if (Array.isArray(value)) {
        if (value.length === 0) return;
        lines.push(label);
        value.forEach((item, index) => { lines.push(`  ${index + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`); });
      } else if (typeof value === 'object') {
        lines.push(label);
        Object.entries(value).forEach(([nk, nv]) => {
          if (nv !== null && nv !== undefined && nv !== '') {
            lines.push(formatKey(nk));
            lines.push(`  1. ${safeString(nv)}`);
          }
        });
      } else {
        lines.push(label);
        const sentences = splitBySentence(safeString(value));
        const values = sentences.length > 0 ? sentences : [safeString(value)];
        values.forEach((sentence, index) => lines.push(`  ${index + 1}. ${sentence}`));
      }
    });
    return lines.join('\n');
  };

  // Format sentence fields as label-above-numbered-value rows.
  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push('  1. ' + parsed.value);
      } else {
        lines.push(`  ${lines.filter(line => /^\s+\d+\./.test(line)).length + 1}. ${s}`);
      }
    });
    return lines;
  };

  // Copy all text
  const copyAllText = async () => {
    let text = '=== ANESTHESIOLOGY ASSESSMENT ===\n\n';
    recordsArray.forEach((record, idx) => {
      text += `Assessment ${idx + 1}\n`;
      text += '-'.repeat(60) + '\n\n';
      if (record.date) text += `Date\n  1. ${formatDate(record.date)}\n\n`;
      if (record.type) text += `Type\n  1. ${safeString(getEffective(record, 'type', idx) || record.type)}\n\n`;
      if (record.provider) text += `Provider\n  1. ${safeString(record.provider)}\n\n`;
      if (record.facility) text += `Facility\n  1. ${safeString(record.facility)}\n\n`;
      if (record.status) text += `Status\n  1. ${safeString(record.status)}\n\n`;
      if (record.asaClassification) text += `ASA Classification\n  1. ${safeString(getEffective(record, 'asaClassification', idx) || record.asaClassification)}\n\n`;

      const airway = getEffectiveDot(record, 'airwayAssessment', idx) || record.airwayAssessment;
      if (airway && typeof airway === 'object') {
        text += `Airway Assessment\n${formatObjectCopyText(airway)}\n\n`;
      }

      const anesPlan = getEffectiveDot(record, 'anesthesiaPlan', idx) || record.anesthesiaPlan;
      if (anesPlan && typeof anesPlan === 'object') {
        text += `Anesthesia Plan\n${formatObjectCopyText(anesPlan)}\n\n`;
      }

      const pain = getEffectiveDot(record, 'painManagement', idx) || record.painManagement;
      if (pain && typeof pain === 'object') {
        text += `Pain Management\n${formatObjectCopyText(pain)}\n\n`;
      }

      const findingsVal = getEffective(record, 'findings', idx) || record.findings;
      if (findingsVal) text += `Findings\n${formatSentenceFieldLines(safeString(findingsVal)).join('\n')}\n\n`;

      const assessmentVal = getEffective(record, 'assessment', idx) || record.assessment;
      if (assessmentVal) text += `Assessment\n${formatSentenceFieldLines(safeString(assessmentVal)).join('\n')}\n\n`;

      const planVal = getEffective(record, 'plan', idx) || record.plan;
      if (planVal) text += `Plan\n${formatSentenceFieldLines(safeString(planVal)).join('\n')}\n\n`;

      const resultsVal = getEffectiveDot(record, 'results', idx) || record.results;
      if (resultsVal && typeof resultsVal === 'object' && Object.keys(resultsVal).length > 0) {
        text += `Results\n${formatObjectCopyText(resultsVal)}\n\n`;
      }

      const recs = getEffectiveArray(record, 'recommendations', idx);
      if (recs?.length > 0) {
        text += `Recommendations\n`;
        const groups = [];
        recs.forEach((rec2, recIndex) => {
          const dateValue = getEffectiveDot(record, `recommendations.${recIndex}.date`, idx) ?? rec2?.date ?? '';
          const dateKey = toInputDate(dateValue) || 'no-date';
          let group = groups.find(candidate => candidate.dateKey === dateKey);
          if (!group) { group = { dateKey, dateValue, items: [] }; groups.push(group); }
          group.items.push({ rec2, recIndex });
        });
        groups.forEach(group => {
          if (group.dateKey !== 'no-date') text += `Recommendation Date\n  1. ${formatDate(group.dateValue)}\n`;
          group.items.forEach(({ rec2, recIndex }, itemIndex) => {
            const recValue = getEffectiveDot(record, `recommendations.${recIndex}.recommendation`, idx) ?? rec2?.recommendation ?? rec2;
            text += `${itemIndex + 1}. ${safeString(recValue)}\n`;
          });
          text += '\n';
        });
      }

      const notesVal = getEffective(record, 'notes', idx) || record.notes;
      if (notesVal) text += `Notes\n${formatSentenceFieldLines(safeString(notesVal)).join('\n')}\n\n`;

      text += '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };

  // PDF data merges localEdits
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return recordsArray;
    return recordsArray.map((rec, recIdx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const eIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (eIdx === recIdx) {
          if (fieldName.includes('.')) {
            const dotParts = fieldName.split('.');
            let target = merged;
            for (let i = 0; i < dotParts.length - 1; i++) {
              if (!target[dotParts[i]]) target[dotParts[i]] = {};
              target = target[dotParts[i]];
            }
            target[dotParts[dotParts.length - 1]] = editVal;
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return merged;
    });
  }, [recordsArray, localEdits, pendingEdits]);

  // Document-level filtering — phrase matching
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return recordsArray;
    const searchLower = searchTerm.toLowerCase().trim();
    return recordsArray.map(rec => {
      // Flatten nested objects into "Formatted Key: value" strings for phrase search
      const flattenObj = (obj) => {
        if (!obj || typeof obj !== 'object') return '';
        return Object.entries(obj).map(([k, v]) => {
          const label = formatKey(k);
          if (Array.isArray(v)) return `${label} ${v.map(item => typeof item === 'object' ? Object.values(item || {}).join(' ') : String(item)).join(' ')}`;
          if (v && typeof v === 'object') return `${label} ${flattenObj(v)}`;
          return `${label} ${safeString(v)}`;
        }).join(' ');
      };
      const searchableText = [
        rec.type, rec.provider, rec.facility, rec.status, rec.asaClassification,
        rec.findings, rec.assessment, rec.plan, rec.notes,
        flattenObj(rec.airwayAssessment),
        flattenObj(rec.anesthesiaPlan),
        flattenObj(rec.painManagement),
        flattenObj(rec.results),
        ...(rec.recommendations?.map(r => r.recommendation || r) || []),
        'score overview', 'airway assessment details', 'anesthesia plan', 'pain management details',
        'findings', 'assessment', 'plan', 'recommendations', 'notes',
        'asa', 'mallampati', 'stop-bang', 'rcri', 'apfel', 'ponv', 'pain score',
        'risk assessment', 'airway assessment', 'pain management',
      ].filter(Boolean).map(v => safeString(v).toLowerCase()).join(' ');
      const docTitle = 'anesthesiology assessment';
      const matchesTitle = docTitle.startsWith(searchLower) || searchLower.startsWith(docTitle);
      const matchesContent = searchableText.includes(searchLower);
      if (matchesTitle || matchesContent) {
        return matchesTitle ? { ...rec, _showAllSections: true } : rec;
      }
      return null;
    }).filter(Boolean);
  }, [recordsArray, searchTerm]);

  // ─── Render Functions ──────────────────────────────────────────────────

  // renderEditableField - simple single-value fields
  const renderEditableField = (rec, fieldName, recIdx, sectionId, label, showLabel = true) => {
    const editKey = `${fieldName}-${recIdx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const val = getEffectiveDot(rec, fieldName, recIdx);
    const displayVal = val != null ? String(val) : null;
    if (displayVal === null && !isEditing) return null;

    const copyId = `${fieldName}-${recIdx}`;

    return (
      <React.Fragment key={copyId}>
        <div className="rec-mini-card nested-mini-card" data-edit-field={fieldName}>
          {showLabel && label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={!isEditing && canEdit ? () => handleStartEdit(fieldName, recIdx, displayVal, 0) : undefined}
          >
            {isEditing ? (
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSaveField(rec, fieldName, recIdx, sectionId, 0);
                    } else if (e.key === 'Escape') {
                      setEditingField(null);
                      setEditValue('');
                    }
                  }}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => handleSaveField(rec, fieldName, recIdx, sectionId, 0)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`row-content${canEdit ? ' editable' : ''}`}
                >
                  <span className="content-value">{highlightText(displayVal)}</span>
                  {canEdit && !isEdited && <span className="edit-indicator">{'\u270E'}</span>}
                </div>
                <button
                  className={`copy-btn${copiedSectionId === copyId ? ' copied' : ''}`}
                  onClick={() => copySection(label ? `${label}: ${displayVal}` : displayVal, copyId)}
                >
                  {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // The schema's numeric pain score stays numeric through draft, approval, Copy, and PDF. Use the
  // custom −/+ control rather than a native spinner or textarea.
  const renderNumericField = (rec, fieldName, recIdx, sectionId, label, showLabel = true) => {
    const editKey = `${fieldName}-${recIdx}-s0`;
    const isEditing = editingField === editKey;
    const isEdited = editedSentences[editKey] === 'edited';
    const val = getEffectiveDot(rec, fieldName, recIdx);
    if ((val === null || val === undefined) && !isEditing) return null;
    const displayVal = String(val ?? '');
    const copyId = `${fieldName}-${recIdx}`;
    const bump = (delta) => {
      const current = Number.parseFloat(editValue);
      setEditValue(String(Math.max(0, (Number.isNaN(current) ? 0 : current) + delta)));
    };
    const saveNumber = () => {
      const numberValue = Number.parseFloat(editValue);
      if (!Number.isNaN(numberValue)) {
        handleSaveField(rec, fieldName, recIdx, sectionId, 0, numberValue);
      }
    };

    return (
      <React.Fragment key={copyId}>
        <div className="rec-mini-card nested-mini-card" data-edit-field={fieldName}>
          {showLabel && label && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={!isEditing && canEdit ? () => handleStartEdit(fieldName, recIdx, displayVal, 0) : undefined}
          >
            {isEditing ? (
              <div className="edit-field-container">
                <div className="num-stepper-row">
                  <button type="button" className="num-step" disabled={saving} onClick={(e) => { e.stopPropagation(); bump(-1); }}>−</button>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="edit-number"
                    value={editValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveNumber(); }
                      if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                    }}
                    autoFocus
                    disabled={saving}
                  />
                  <button type="button" className="num-step" disabled={saving} onClick={(e) => { e.stopPropagation(); bump(1); }}>+</button>
                </div>
                <div className="edit-actions">
                  <button className="save-btn" onClick={(e) => { e.stopPropagation(); saveNumber(); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className={`row-content${canEdit ? ' editable' : ''}`}>
                  <span className="content-value">{highlightText(displayVal)}</span>
                  {canEdit && !isEdited && <span className="edit-indicator">{'✎'}</span>}
                </div>
                <button className={`copy-btn${copiedSectionId === copyId ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copySection(label ? `${label}: ${displayVal}` : displayVal, copyId); }}>
                  {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // renderSentenceEditableField - long text fields with per-sentence editing
  const renderSentenceEditableField = (rec, fieldName, recIdx, sectionId, label, showLabel = true) => {
    if (fieldName === 'painManagement.currentPainScore') {
      return renderNumericField(rec, fieldName, recIdx, sectionId, label, showLabel);
    }
    // getEffectiveDot (not getEffective) so this also works for object sub-fields passed as a dot-path
    // (e.g. "anesthesiaPlan.technique"); for a plain top-level field it behaves identically.
    const val = getEffectiveDot(rec, fieldName, recIdx);
    const strVal = val != null ? String(val) : '';
    if (!strVal) return renderEditableField(rec, fieldName, recIdx, sectionId, label, showLabel);
    const sentences = splitBySentence(strVal);
    // Route ALL sentences (incl. a lone "Label: value" like notes "NPO Status: ...") through the
    // labeled-aware map below so the label becomes a nested-subtitle heading + its own value card.
    if (sentences.length === 0) return renderEditableField(rec, fieldName, recIdx, sectionId, label, showLabel);

    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const isLabeled = parsed.isLabeled;
      const itemValue = isLabeled ? parsed.value : sentence;
      const ratioMatch = isLabeled && CLINICAL_RATIO_LABELS.has(parsed.label)
        ? String(itemValue).match(RATIO_VALUE_RE)
        : null;

      // Per-sentence search filtering
      if (searchTerm && !rec._showAllSections && !stm(label)) {
        const sentenceText = isLabeled ? `${parsed.label} ${parsed.value}` : sentence;
        if (!shouldShowRow(rec, sentenceText)) return null;
      }

      const partEditKey = `${fieldName}-${recIdx}-s${sIdx}`;
      const isPartEditing = editingField === partEditKey;
      const isPartEdited = editedSentences[partEditKey] === 'edited' || editedSentences[partEditKey] === 'added';
      const partCopyId = `${fieldName}-${recIdx}-s${sIdx}`;

      return (
        <React.Fragment key={partCopyId}>
          <div className="rec-mini-card nested-mini-card" data-edit-field={fieldName}>
            {showLabel && sIdx === 0 && label && <div className="nested-subtitle">{highlightText(label)}</div>}
            {isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div
              className={`numbered-row editable-row${isPartEdited ? ' modified' : ''}`}
            onClick={!isPartEditing && canEdit ? () => {
              if (ratioMatch) {
                setEditingField(partEditKey);
                setEditValue(ratioMatch[1]);
              } else {
                handleStartEdit(fieldName, recIdx, sentence, sIdx);
              }
            } : undefined}
          >
            {isPartEditing ? (
              <div className="edit-field-container">
                  {ratioMatch ? (
                    <div className="num-stepper-row">
                      <button type="button" className="num-step" disabled={saving} onClick={(e) => {
                        e.stopPropagation();
                        const current = Number.parseFloat(editValue);
                        setEditValue(String(Math.max(0, (Number.isNaN(current) ? 0 : current) - 1)));
                      }}>−</button>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="edit-number"
                        value={editValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const numerator = Number.parseFloat(editValue);
                            if (!Number.isNaN(numerator)) saveSentence(rec, fieldName, recIdx, sectionId, sIdx, `${parsed.label}: ${numerator}${ratioMatch[2]}`);
                          } else if (e.key === 'Escape') {
                            setEditingField(null);
                            setEditValue('');
                          }
                        }}
                        autoFocus
                        disabled={saving}
                      />
                      <span className="unit-literal">{ratioMatch[2].trim()}</span>
                      <button type="button" className="num-step" disabled={saving} onClick={(e) => {
                        e.stopPropagation();
                        const current = Number.parseFloat(editValue);
                        setEditValue(String(Math.max(0, (Number.isNaN(current) ? 0 : current) + 1)));
                      }}>+</button>
                    </div>
                  ) : (
                    <textarea
                      ref={textareaRef}
                      className="edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          saveSentence(rec, fieldName, recIdx, sectionId, sIdx);
                        } else if (e.key === 'Escape') {
                          setEditingField(null);
                          setEditValue('');
                        }
                      }}
                      disabled={saving}
                    />
                  )}
                  <div className="edit-actions">
                    <button className="save-btn" onClick={(e) => {
                      e.stopPropagation();
                      if (ratioMatch) {
                        const numerator = Number.parseFloat(editValue);
                        if (!Number.isNaN(numerator)) saveSentence(rec, fieldName, recIdx, sectionId, sIdx, `${parsed.label}: ${numerator}${ratioMatch[2]}`);
                      } else {
                        saveSentence(rec, fieldName, recIdx, sectionId, sIdx);
                      }
                    }} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`row-content${canEdit ? ' editable' : ''}`}
                  >
                    <span className="content-value">{highlightText(isLabeled ? itemValue : sentence)}</span>
                    {canEdit && !isPartEdited && <span className="edit-indicator">{'\u270E'}</span>}
                  </div>
                  <button
                    className={`copy-btn${copiedSectionId === partCopyId ? ' copied' : ''}`}
                    onClick={() => copySection(sentence, partCopyId)}
                  >
                    {copiedSectionId === partCopyId ? 'Copied!' : 'Copy'}
                  </button>
                </>
              )}
            </div>
          </div>
          {isPartEdited && <div className={`modified-badge${editedSentences[partEditKey] === 'added' ? ' added' : ''}`}>{editedSentences[partEditKey] === 'added' ? 'added' : 'edited'} - click Pending Approve to save</div>}
        </React.Fragment>
      );
    });
  };

  // renderDynamicObjectField - nested objects with dot-path editing
  const renderDynamicObjectField = (rec, parentPath, recIdx, sectionId) => {
    const parentVal = getEffectiveDot(rec, parentPath, recIdx);
    if (!parentVal || typeof parentVal !== 'object') return null;

    return Object.entries(parentVal).map(([key, value]) => {
      if (value === null || value === undefined) return null;
      const dotPath = `${parentPath}.${key}`;
      const label = formatKey(key);

      // Handle arrays within objects
      if (Array.isArray(value)) {
        if (value.length === 0) return null;

        if (searchTerm && !rec._showAllSections && !stm(label)) {
          const hasMatch = value.some(item => shouldShowRow(rec, label, String(item)));
          if (!hasMatch) return null;
        }

        return (
          <div key={dotPath} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {value.map((item, itemIdx) => {
              const arrayEditKey = `${dotPath}-${recIdx}-item${itemIdx}`;
              const isArrayEditing = editingField === arrayEditKey;
              const isArrayEdited = editedSentences[arrayEditKey] === 'edited';
              const itemStr = typeof item === 'string' ? item : JSON.stringify(item);

              if (searchTerm && !rec._showAllSections && !stm(label) && !shouldShowRow(rec, label, itemStr)) return null;

              return (
                <div className="nested-mini-card editable-leaf" data-edit-field={dotPath} key={arrayEditKey}>
                  <div
                    className={`numbered-row editable-row${isArrayEdited ? ' modified' : ''}`}
                    onClick={!isArrayEditing && canEdit ? () => handleStartEditArray(dotPath, recIdx, itemIdx, itemStr) : undefined}
                  >
                    {isArrayEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          ref={textareaRef}
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              saveArrayItem(rec, dotPath, recIdx, sectionId, itemIdx);
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditValue('');
                            }
                          }}
                          disabled={saving}
                        />
                        <div className="edit-actions">
                          <button className="save-btn" onClick={() => saveArrayItem(rec, dotPath, recIdx, sectionId, itemIdx)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`row-content${canEdit ? ' editable' : ''}`}
                        >
                          <span className="content-value">{highlightText(itemStr)}</span>
                          {canEdit && !isArrayEdited && <span className="edit-indicator">{'\u270E'}</span>}
                        </div>
                        <button
                          className={`copy-btn${copiedSectionId === arrayEditKey ? ' copied' : ''}`}
                          onClick={() => copySection(itemStr, arrayEditKey)}
                        >
                          {copiedSectionId === arrayEditKey ? 'Copied!' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                  {isArrayEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </div>
              );
            })}
          </div>
        );
      }

      // Handle nested objects within objects
      if (typeof value === 'object' && value !== null) {
        return (
          <div key={dotPath} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {Object.entries(value).map(([nestedKey, nestedValue]) => {
              const nestedDotPath = `${dotPath}.${nestedKey}`;
              const nestedLabel = formatKey(nestedKey);
              return renderEditableField(rec, nestedDotPath, recIdx, sectionId, nestedLabel, true);
            })}
          </div>
        );
      }

      // Simple string/number values — split multi-sentence strings by the dot into separate rows
      // (renderSentenceEditableField falls back to a single value card when there is only one sentence).
      if (searchTerm && !rec._showAllSections && !stm(formatKey(parentPath)) && !shouldShowRow(rec, label, String(value))) return null;
      return renderSentenceEditableField(rec, dotPath, recIdx, sectionId, label, true);
    }).filter(Boolean);
  };

  // renderNestedObjectSection
  const renderNestedObjectSection = (rec, obj, sectionTitle, sectionId, recIdx) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

    const sectionTitleMatch = searchTerm && stm(sectionTitle);
    const showAll = rec._showAllSections || sectionTitleMatch;

    const sectionContent = Object.entries(obj).map(([key, value]) =>
      [formatKey(key).toLowerCase(), formatKey(key), String(value || '')].join(' ')
    ).join(' ');

    if (!shouldShowSection(rec, sectionTitle, sectionContent)) return null;

    const hasVisibleRows = showAll || Object.entries(obj).some(([key, value]) =>
      value && shouldShowRow(rec, formatKey(key).toLowerCase(), formatKey(key), String(value))
    );
    if (!hasVisibleRows) return null;

    const copyText = formatObjectCopyText(obj);
    const copySectionId = `${sectionId}-${recIdx}`;

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header">
          <h3 className="section-title">{highlightText(sectionTitle)}</h3>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === copySectionId ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${copyText}`, copySectionId)}
            >
              {copiedSectionId === copySectionId ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, sectionId, recIdx)}
          </div>
        </div>
        <div className="domain-groups-wrapper">
          {renderDynamicObjectField(rec, sectionId, recIdx, sectionId)}
        </div>
      </div>
    );
  };

  // renderSentenceSection
  const renderSentenceSection = (rec, fieldName, sectionTitle, sectionId, recIdx) => {
    const val = getEffective(rec, fieldName, recIdx);
    const strVal = val != null ? safeString(val) : '';
    if (!strVal) return null;

    if (!shouldShowSection(rec, sectionTitle, strVal)) return null;

    const copySectionKey = `${sectionId}-section-${recIdx}`;
    const copyText = formatSentenceFieldLines(strVal).join('\n');

    return (
      <div className="section-container" key={sectionId}>
        <div className="section-header">
          <h3 className="section-title">{highlightText(sectionTitle)}</h3>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === copySectionKey ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${copyText}`, copySectionKey)}
            >
              {copiedSectionId === copySectionKey ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, sectionId, recIdx)}
          </div>
        </div>
        <div className="domain-groups-wrapper">
          {renderSentenceEditableField(rec, fieldName, recIdx, sectionId, sectionTitle, false)}
        </div>
      </div>
    );
  };

  // renderRecommendationsSection
  const renderRecommendationsSection = (rec, recIdx) => {
    const recs = getEffectiveArray(rec, 'recommendations', recIdx);
    if (!recs || !Array.isArray(recs) || recs.length === 0) return null;

    const sectionTitle = 'Recommendations';
    const sectionId = 'recommendations';
    const groups = [];
    recs.forEach((recItem, recItemIdx) => {
      const datePath = `recommendations.${recItemIdx}.date`;
      const dateValue = getEffectiveDot(rec, datePath, recIdx) ?? recItem?.date ?? '';
      const dateKey = toInputDate(dateValue) || 'no-date';
      let group = groups.find(candidate => candidate.dateKey === dateKey);
      if (!group) { group = { dateKey, dateValue, items: [] }; groups.push(group); }
      group.items.push({ recItem, recItemIdx, datePath });
    });
    const sectionContent = groups.flatMap(group => [
      group.dateKey === 'no-date' ? '' : formatDate(group.dateValue),
      ...group.items.map(({ recItem, recItemIdx }) => safeString(
        getEffectiveDot(rec, `recommendations.${recItemIdx}.recommendation`, recIdx) ?? recItem?.recommendation ?? recItem
      )),
    ]).join(' ');

    if (!shouldShowSection(rec, sectionTitle, sectionContent)) return null;

    const copySectionKey = `recommendations-section-${recIdx}`;
    const copyText = groups.map(group => {
      const lines = [];
      if (group.dateKey !== 'no-date') lines.push('Recommendation Date', `1. ${formatDate(group.dateValue)}`);
      group.items.forEach(({ recItem, recItemIdx }, itemIndex) => {
        const value = getEffectiveDot(rec, `recommendations.${recItemIdx}.recommendation`, recIdx) ?? recItem?.recommendation ?? recItem;
        lines.push(`${itemIndex + 1}. ${safeString(value)}`);
      });
      return lines.join('\n');
    }).join('\n\n');

    const saveGroupDate = (datePaths, value) => {
      const storedDate = value ? `${value}T00:00:00.000Z` : '';
      datePaths.forEach(path => handleSaveField(rec, path, recIdx, sectionId, 0, storedDate, `${path}-${recIdx}-s0`));
      setEditingField(null);
      setEditValue('');
    };

    return (
      <div className="section-container" key="recommendations">
        <div className="section-header">
          <h3 className="section-title">{highlightText(sectionTitle)}</h3>
          <div className="header-right-actions">
            <button
              className={`copy-btn${copiedSectionId === copySectionKey ? ' copied' : ''}`}
              onClick={() => copySection(`${sectionTitle}\n${copyText}`, copySectionKey)}
            >
              {copiedSectionId === copySectionKey ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveBtn(rec, sectionId, recIdx)}
          </div>
        </div>
        <div className="domain-groups-wrapper">
          {groups.map((group, groupIndex) => {
            const datePaths = group.dateKey === 'no-date' ? [] : group.items.map(item => item.datePath);
            const dateEditKey = `recommendations-date-group-${groupIndex}-${recIdx}`;
            const isDateEditing = editingField === dateEditKey;
            const visibleItems = group.items.filter(({ recItem, recItemIdx }) => {
              const value = getEffectiveDot(rec, `recommendations.${recItemIdx}.recommendation`, recIdx) ?? recItem?.recommendation ?? recItem;
              return !searchTerm || rec._showAllSections || stm(sectionTitle) || shouldShowRow(rec, sectionTitle, formatDate(group.dateValue), safeString(value));
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={`${group.dateKey}-${groupIndex}`} className="rec-mini-card nested-mini-card recommendation-group">
                {group.dateKey !== 'no-date' && (
                  <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
                    <div className="nested-subtitle date-subtitle editable-row" onClick={() => {
                      if (!isDateEditing) { setEditingField(dateEditKey); setEditValue(group.dateKey); }
                    }}>
                      {isDateEditing ? (
                        <div className="edit-field-container">
                          <BlueDatePicker value={editValue} onSelect={setEditValue} />
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={(event) => { event.stopPropagation(); saveGroupDate(datePaths, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : <><span className="content-value">{highlightText(formatDate(group.dateValue))}</span><span className="edit-indicator">{'\u270E'}</span></>}
                    </div>
                  </div>
                )}
                {visibleItems.map(({ recItem, recItemIdx }) => {
                  const recommendationPath = `recommendations.${recItemIdx}.recommendation`;
                  const recommendationValue = getEffectiveDot(rec, recommendationPath, recIdx) ?? recItem?.recommendation ?? recItem;
                  return recommendationValue ? renderEditableField(rec, recommendationPath, recIdx, sectionId, '', false) : null;
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Empty state
  if (!rawDoc || recordsArray.length === 0) {
    return (
      <div className="anesthesiology-assessment-document">
        <div className="empty-state">
          <p>No anesthesiology assessments available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="anesthesiology-assessment-document" ref={contentRef}>
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Anesthesiology Assessment</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedSectionId === 'all' ? ' copied' : ''}`}
            onClick={copyAllText}
          >
            {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AnesthesiologyAssessmentDocumentPDFTemplate document={pdfData} />}
            fileName="Anesthesiology_Assessment.pdf"
            className="copy-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search (ASA, Mallampati, STOP-BANG, pain, airway, plan...)"
        totalCount={recordsArray.length}
        filteredCount={filteredRecords.length}
      />

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">
          No results found for "{searchTerm}"
        </div>
      )}

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const chartData = prepareChartData(record);
          const filteredChartData = getFilteredChartData(chartData);
          const hasChartData = filteredChartData.length > 0;

          const riskCharts = filteredChartData.filter(c => c.category === 'Risk Assessment');
          const airwayCharts = filteredChartData.filter(c => c.category === 'Airway Assessment');
          const painCharts = filteredChartData.filter(c => c.category === 'Pain Management');

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="header-top-row">
                  {record.status && (
                    <span className={`status-badge status-${record.status.toLowerCase()}`}>
                      {highlightText(record.status)}
                    </span>
                  )}
                </div>
                <h2 className="record-title">
                  {highlightText(`Anesthesiology Assessment ${idx + 1}`)}
                </h2>
                {record.type && (
                  <div className="record-subtitle">{highlightText(getEffective(record, 'type', idx) || record.type)}</div>
                )}
                {(record.provider || record.facility) && (
                  <div className="record-meta">
                    {record.provider && <span>{highlightText(record.provider)}</span>}
                    {record.facility && <span>{highlightText(record.facility)}</span>}
                  </div>
                )}
              </div>

              {/* Score Overview - Bar Charts (display-only) */}
              {hasChartData && (
                <div className="section-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Score Overview')}</h3>
                  </div>
                  <div className="chart-section">
                    <div className="chart-container">
                      <Legend />
                      {riskCharts.length > 0 && (
                        <div className="chart-category">
                          <div className="chart-category-header">{highlightText('Risk Assessment')}</div>
                          {riskCharts.map((chart) => (
                            <BarChart key={chart.key} {...chart} highlightFn={highlightText} />
                          ))}
                        </div>
                      )}
                      {airwayCharts.length > 0 && (
                        <div className="chart-category">
                          <div className="chart-category-header">{highlightText('Airway Assessment')}</div>
                          {airwayCharts.map((chart) => (
                            <BarChart key={chart.key} {...chart} highlightFn={highlightText} />
                          ))}
                        </div>
                      )}
                      {painCharts.length > 0 && (
                        <div className="chart-category">
                          <div className="chart-category-header">{highlightText('Pain Management')}</div>
                          {painCharts.map((chart) => (
                            <BarChart key={chart.key} {...chart} highlightFn={highlightText} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Airway Assessment Section */}
              {renderNestedObjectSection(record, record.airwayAssessment, 'Airway Assessment Details', 'airwayAssessment', idx)}

              {/* Anesthesia Plan Section */}
              {renderNestedObjectSection(record, record.anesthesiaPlan, 'Anesthesia Plan', 'anesthesiaPlan', idx)}

              {/* Pain Management Section */}
              {renderNestedObjectSection(record, record.painManagement, 'Pain Management Details', 'painManagement', idx)}

              {/* Findings Section */}
              {renderSentenceSection(record, 'findings', 'Findings', 'findings', idx)}

              {/* Assessment Section */}
              {renderSentenceSection(record, 'assessment', 'Assessment', 'assessment', idx)}

              {/* Plan Section */}
              {renderSentenceSection(record, 'plan', 'Plan', 'plan', idx)}

              {/* Results Section (dynamic-key object of test results) */}
              {renderNestedObjectSection(record, record.results, 'Results', 'results', idx)}

              {/* Recommendations Section */}
              {renderRecommendationsSection(record, idx)}

              {/* Notes Section */}
              {renderSentenceSection(record, 'notes', 'Notes', 'notes', idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnesthesiologyAssessmentDocument;
