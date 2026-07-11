import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ArterialBloodGasesDocumentPDFTemplate from '../pdf-templates/ArterialBloodGasesDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ArterialBloodGasesDocument.css';

/**
 * ArterialBloodGasesDocument - Inline Editing Edition
 *
 * Sections with editing:
 * 1. Assessment Info (assessmentDate — non-editable, assessmentTime — editable, clinicalStatus — editable)
 * 2. Vital Signs (vitalSigns — per-sentence)
 * 3. Interventions (interventions — per-sentence)
 * 4. Response (response — per-sentence)
 * 5. Plan (plan — per-sentence)
 * 6. Recommendations (recommendations[] — array editing)
 */

// ==================== SECTION_FIELDS for per-section approve ====================
const SECTION_FIELDS = {
  assessmentInfo: ['assessmentDate', 'assessmentTime', 'clinicalStatus'],
  vitalSigns: ['vitalSigns'],
  interventions: ['interventions'],
  response: ['response'],
  plan: ['plan'],
  recommendations: ['recommendations'],
};

const NON_EDITABLE_FIELDS = ['createdAt', 'updatedAt', '_id', 'patientId', 'documentId', 'source', 'createdBy', 'updatedBy', 'aiProcessed'];

const SENTENCE_FIELDS = ['vitalSigns', 'interventions', 'response', 'plan'];

const ARRAY_FIELDS = ['recommendations'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits key minus the trailing "-<idx>") */
const DRAFT_KEY = 'arterial_blood_gasesPendingEdits';
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
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim().replace(/[.;]\s*$/, '');
  if (trimmed) parts.push(trimmed);
  return parts.length > 1 ? parts : [text];
};

const reconstructFullText = (sentences) => {
  return sentences.map((s, i) => {
    let trimmed = s.trim();
    if (i < sentences.length - 1 && trimmed && !/[.;!?]$/.test(trimmed)) {
      trimmed += '.';
    }
    return trimmed;
  }).filter(Boolean).join(' ');
};

// Convert a stored date (ISO / {$date}) to a YYYY-MM-DD value for <input type="date">.
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; }
};

// Parse a messy assessmentTime ("03:45 AM", "14:00 - First Postoperative ABG", "15:12") into a 24h
// HH:MM (for <input type="time">) + any trailing annotation. time:'' when there is no leading clock time.
const parseTimeValue = (raw) => {
  const s = String(raw == null ? '' : raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*(.*)$/);
  if (!m) return { time: '', annotation: s };
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && hh < 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  if (hh > 23 || parseInt(mm, 10) > 59) return { time: '', annotation: s };
  return { time: `${String(hh).padStart(2, '0')}:${mm}`, annotation: (m[4] || '').trim() };
};

// ==================== ABG BAR CHART CONSTANTS ====================

const ABG_RANGES = {
  ph:           { low: 7.35, high: 7.45, scale: [7.0, 7.8] },
  paco2:        { low: 35,   high: 45,   scale: [0, 100] },
  pao2:         { low: 80,   high: 100,  scale: [0, 150] },
  hco3:         { low: 22,   high: 26,   scale: [0, 50] },
  sao2:         { low: 95,   high: 100,  scale: [0, 100] },
  spo2:         { low: 95,   high: 100,  scale: [0, 100] },
  hr:           { low: 60,   high: 100,  scale: [0, 200] },
  rr:           { low: 12,   high: 20,   scale: [0, 40] },
  bpSystolic:   { low: 90,   high: 140,  scale: [0, 250] },
  bpDiastolic:  { low: 60,   high: 90,   scale: [0, 150] },
};

const ABG_INTERPRETATIONS = {
  ph:          { low: 'Acidosis',    high: 'Alkalosis' },
  paco2:       { low: 'Hypocapnia',  high: 'Hypercapnia' },
  pao2:        { low: 'Hypoxemia',   high: 'Hyperoxia' },
  hco3:        { low: 'Low',         high: 'Elevated' },
  sao2:        { low: 'Desaturation', high: 'Normal' },
  spo2:        { low: 'Hypoxemia',   high: 'Normal' },
  hr:          { low: 'Bradycardia', high: 'Tachycardia' },
  rr:          { low: 'Bradypnea',   high: 'Tachypnea' },
  bpSystolic:  { low: 'Hypotension', high: 'Hypertension' },
  bpDiastolic: { low: 'Hypotension', high: 'Hypertension' },
};

const ABG_PARSE_PATTERNS = [
  { regex: /BP\s+(\d+)\/(\d+)\s*(mmHg)?/i, isBP: true, unit: 'mmHg' },
  { regex: /pH\s+(\d+\.?\d*)/i, label: 'pH', testType: 'ph', unit: '' },
  { regex: /PaCO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaCO2', testType: 'paco2', unit: 'mmHg' },
  { regex: /PaO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaO2', testType: 'pao2', unit: 'mmHg' },
  { regex: /HCO3\s+(\d+\.?\d*)\s*(mEq\/L)?/i, label: 'HCO3', testType: 'hco3', unit: 'mEq/L' },
  { regex: /SaO2\s+(\d+\.?\d*)\s*%?/i, label: 'SaO2', testType: 'sao2', unit: '%' },
  { regex: /SpO2\s+(\d+\.?\d*)\s*%?/i, label: 'SpO2', testType: 'spo2', unit: '%' },
  { regex: /HR\s+(\d+\.?\d*)\s*(bpm)?/i, label: 'HR', testType: 'hr', unit: 'bpm' },
  { regex: /RR\s+(\d+\.?\d*)\s*(\/min)?/i, label: 'RR', testType: 'rr', unit: '/min' },
];

const parseVitalSigns = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const results = [];

  parts.forEach(part => {
    for (const pattern of ABG_PARSE_PATTERNS) {
      const match = part.match(pattern.regex);
      if (match) {
        if (pattern.isBP) {
          results.push({ label: 'BP (Systolic)', value: parseFloat(match[1]), unit: pattern.unit, testType: 'bpSystolic', raw: part });
          results.push({ label: 'BP (Diastolic)', value: parseFloat(match[2]), unit: pattern.unit, testType: 'bpDiastolic', raw: part });
        } else {
          results.push({ label: pattern.label, value: parseFloat(match[1]), unit: pattern.unit, testType: pattern.testType, raw: part });
        }
        break;
      }
    }
  });

  return results;
};

const getAbgBarColor = (value, testType) => {
  const range = ABG_RANGES[testType];
  if (!range) return '#9ca3af';
  if (value < range.low) return '#3b82f6';
  if (value > range.high) return '#ef4444';
  return '#22c55e';
};

const getAbgInterpretation = (value, testType) => {
  const range = ABG_RANGES[testType];
  const interp = ABG_INTERPRETATIONS[testType];
  if (!range || !interp) return '';
  if (value < range.low) return interp.low;
  if (value > range.high) return interp.high;
  return 'Normal';
};

const abgToPercentage = (value, testType) => {
  const range = ABG_RANGES[testType];
  if (!range) return 50;
  const [min, max] = range.scale;
  return Math.max(5, Math.min(100, ((value - min) / (max - min)) * 100));
};

// BarChart Component (display-only)
const AbgBarChart = ({ label, percentage, rawValue, color, interpretation, highlightFn }) => (
  <div className="bar-chart-row">
    <div className="bar-label">{highlightFn ? highlightFn(label) : label}</div>
    <div className="bar-container">
      <div className="bar-background">
        <div className="bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <div className="bar-value" style={{ color }}>{highlightFn ? highlightFn(rawValue) : rawValue}</div>
    </div>
    {interpretation && (
      <div className="bar-interpretation" style={{ color }}>
        {highlightFn ? highlightFn(interpretation) : interpretation}
      </div>
    )}
  </div>
);

// Legend Component
const AbgChartLegend = () => (
  <div className="chart-legend">
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
      <span className="legend-text">Normal</span>
    </div>
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
      <span className="legend-text">Low</span>
    </div>
    <div className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
      <span className="legend-text">High</span>
    </div>
  </div>
);

// ==================== COMPONENT ====================

const ArterialBloodGasesDocument = ({ document: docProp }) => {
  const templateData = docProp;

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Format date helper
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(dateStr);
    }
  }, []);

  // Highlight search term
  const highlightText = useCallback((text) => {
    if (!text) return '';
    const textStr = String(text);
    if (!searchTerm.trim()) return textStr;
    const escapedPhrase = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    if (parts.length === 1) return textStr;
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === searchTerm.trim().toLowerCase();
          return isMatch ? <mark key={i}>{part}</mark> : part;
        })}
      </>
    );
  }, [searchTerm]);

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) return val.filter(Boolean).join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // Check if value exists
  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim() !== '';
    return true;
  };

  // Data unwrapping
  const records = useMemo(() => {
    if (!templateData) return [];
    const docData = templateData?.documentData || templateData?.data || templateData;
    const recs = docData?.arterial_blood_gases || (Array.isArray(docData) ? docData : [docData]);
    return recs.filter(r => r && (r.assessmentDate || r.clinicalStatus || r.interventions || r.response || r.plan));
  }, [templateData]);

  // ==================== SAFE _id EXTRACTION ====================
  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft store shape: { [recordId]: { [fieldPart]: value } } where fieldPart is "field" (simple/sentence/comma
  // fields → localEdits key "field-idx") or "recommendations.<itemIdx>" (→ localEdits key "recommendations-idx-itemIdx").
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = getRecordId(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArr = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArr) {
          const fieldName = fieldPart.slice(0, dotIdx);
          const itemIdx = fieldPart.slice(dotIdx + 1);
          const editKey = `${fieldName}-${idx}-${itemIdx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[`${fieldName}-${idx}-${itemIdx}-p0`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          if (SENTENCE_FIELDS.includes(fieldPart)) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
          else nFields[`${fieldPart}-${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  // ==================== GET FIELD VALUE (with local edits) ====================
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // Get effective recommendations array with per-item edits.
  // forPdf=true skips PENDING (staged-but-not-approved) drafts so they stay OUT of the PDF/Copy All.
  const getEffectiveRecommendations = useCallback((record, idx, forPdf = false) => {
    const arr = record.recommendations || [];
    return arr.map((item, i) => {
      const editKey = `recommendations-${idx}-${i}`;
      if (localEdits[editKey] !== undefined && !(forPdf && pendingEdits[editKey])) {
        return { ...item, recommendation: localEdits[editKey] };
      }
      return item;
    });
  }, [localEdits, pendingEdits]);

  // ==================== pdfData MEMO — merges localEdits into records ====================
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      // Merge simple/sentence field edits
      ['assessmentDate', 'assessmentTime', 'clinicalStatus', 'vitalSigns', 'interventions', 'response', 'plan'].forEach(field => {
        const key = `${field}-${idx}`;
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        if (localEdits[key] !== undefined) {
          merged[field] = localEdits[key];
        }
      });
      // Merge array item edits (pending recommendation drafts skipped)
      merged.recommendations = getEffectiveRecommendations(record, idx, true);
      return merged;
    });
  }, [records, localEdits, pendingEdits, getEffectiveRecommendations]);

  // ==================== SEARCH ====================
  const stm = (sectionTitle) => {
    if (!searchTerm.trim()) return false;
    const sl = searchTerm.toLowerCase().trim();
    const tl = (sectionTitle || '').toLowerCase().trim();
    return tl.startsWith(sl) || sl.startsWith(tl);
  };

  const shouldShowRow = useCallback((record, ...values) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const combinedText = values.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase();
    return combinedText.includes(searchLower);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = sectionContent.map(v => safeString(v)).filter(Boolean).join(' ').toLowerCase();
    return `${titleLower} ${contentText}`.includes(searchLower);
  }, [searchTerm]);

  // ==================== FILTERED RECORDS ====================
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return records.map(r => ({ ...r, _showAllSections: true }));
    }
    const searchLower = searchTerm.toLowerCase().trim();

    return records.map((record, idx) => {
      const docTitle = `Arterial Blood Gases ${idx + 1}`;
      if (docTitle.toLowerCase().includes(searchLower)) {
        return { ...record, _showAllSections: true };
      }

      const recsText = (record.recommendations || []).map(r => `${r.recommendation || ''} ${r.date || ''}`).join(' ');
      // Parse vital signs for bar chart labels + interpretations in search
      const vsCharts = parseVitalSigns(record.vitalSigns || '');
      const vsSearchTerms = vsCharts.map(item =>
        `${item.label} ${item.value} ${item.unit} ${getAbgInterpretation(item.value, item.testType)}`
      ).join(' ');
      const searchableText = [
        docTitle, 'arterial blood gases', 'ABG',
        'Assessment Info', 'Assessment Date', 'Assessment Time', 'Clinical Status',
        'Vital Signs', 'Interventions', 'Response', 'Plan', 'Recommendations',
        formatDate(record.assessmentDate),
        record.assessmentTime,
        record.clinicalStatus,
        record.vitalSigns,
        vsSearchTerms,
        record.interventions,
        record.response,
        record.plan,
        recsText,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchLower) ? { ...record, _showAllSections: false } : null;
    }).filter(Boolean);
  }, [records, searchTerm, formatDate]);

  // ==================== CLIPBOARD HELPERS ====================
  const copyToClipboard = useCallback((text, id) => {
    const textarea = window.document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    window.document.body.appendChild(textarea);
    textarea.select();
    try {
      window.document.execCommand('copy');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    window.document.body.removeChild(textarea);
  }, []);

  // Format sentence field for copy text
  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      lines.push(`${n++}. ${s}`);
    });
    return lines;
  };

  // Copy All — uses pdfData (includes localEdits)
  const copyAll = useCallback(() => {
    let text = '=== ARTERIAL BLOOD GASES ===\n\n';

    pdfData.forEach((record, idx) => {
      text += `Arterial Blood Gases ${idx + 1}\n`;
      text += `${'='.repeat(50)}\n\n`;

      if (record.assessmentDate) {
        text += `ASSESSMENT DATE: ${formatDate(record.assessmentDate)}\n`;
      }
      if (record.assessmentTime) {
        text += `ASSESSMENT TIME: ${record.assessmentTime}\n`;
      }
      if (record.clinicalStatus) {
        text += `CLINICAL STATUS: ${record.clinicalStatus}\n`;
      }
      text += '\n';

      if (record.vitalSigns) {
        text += 'VITAL SIGNS:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.vitalSigns).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      if (record.interventions) {
        text += 'INTERVENTIONS:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.interventions).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      if (record.response) {
        text += 'RESPONSE:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.response).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      if (record.plan) {
        text += 'PLAN:\n';
        text += `${'─'.repeat(40)}\n`;
        formatSentenceFieldLines(record.plan).forEach(l => { text += `  ${l}\n`; });
        text += '\n';
      }

      const recs = record.recommendations || [];
      if (recs.length > 0) {
        text += 'RECOMMENDATIONS:\n';
        text += `${'─'.repeat(40)}\n`;
        recs.forEach((r, i) => {
          text += `  ${i + 1}. ${r.recommendation || ''}`;
          if (r.date) text += ` (${formatDate(r.date)})`;
          text += '\n';
        });
        text += '\n';
      }

      text += '\n' + '='.repeat(80) + '\n\n';
    });

    copyToClipboard(text, 'all-documents');
  }, [pdfData, formatDate, copyToClipboard]);

  // ==================== EDITING HELPERS ====================
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const k of Object.keys(editedSentences)) {
      if (fields.some(fld => k.startsWith(`${fld}-${idx}-s`))) return true;
    }
    for (const k of Object.keys(editedFields)) {
      if (fields.some(fld => k.startsWith(`${fld}-${idx}`))) return true;
    }
    return false;
  }, [editedSentences, editedFields]);

  // ==================== SAVE FIELD ====================
  // Save = stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, fullValue, editKey) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    const key = editKey || `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [key]: fullValue }));
    setPendingEdits(prev => ({ ...prev, [key]: true }));
    setEditedFields(prev => ({ ...prev, [key]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => {
      const u = { ...prev };
      delete u[`${sectionId}-${idx}`];
      return u;
    });

    // fieldPart = "field" (simple/sentence) or "field.arrayIndex" (numeric array element)
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = fullValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, []);

  // ==================== SAVE SENTENCE ====================
  function saveSentence(record, fieldName, idx, sectionId, sIdx, newText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const newSentences = splitBySentence(newText.trim());
    const allCurrent = [...currentSentences];
    allCurrent.splice(sIdx, 1, ...newSentences);
    const fullText = reconstructFullText(allCurrent);
    const extraCount = newSentences.length - 1;
    const recIdx = idx;

    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${recIdx}-s${sIdx}`] = 'edited';
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${recIdx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => ({ ...prev, ...editedMap }));
    } else {
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${recIdx}-s${sIdx}`]: 'edited' }));
    }

    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ==================== SAVE RECOMMENDATION (whole item — text is NOT comma-split) ====================
  // Each recommendation is ONE editable row; commas inside it are grammar ("…first 24 hours, then daily")
  // and must NOT be shattered. Stage as a DRAFT (no DB write); Approve commits via arrayIndex.
  function saveRecommendation(record, idx, sectionId, itemIdx, newText) {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const newFullText = newText.trim();
    const localKey = `recommendations-${idx}-${itemIdx}`;
    const partEditKey = `${localKey}-p0`;

    setLocalEdits(prev => ({ ...prev, [localKey]: newFullText }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    setEditedFields(prev => ({ ...prev, [partEditKey]: 'edited' }));
    setApprovedSections(prev => {
      const u = { ...prev };
      delete u[`${sectionId}-${idx}`];
      return u;
    });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][`recommendations.${itemIdx}`] = newFullText;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }

  // ==================== APPROVE SECTION ====================
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return;

    const recordId = getRecordId(record);
    if (!recordId) return;

    const fields = SECTION_FIELDS[sectionId] || [];

    try {
      // Collect this section's pending (staged) localEdits and commit each to the DB now.
      const committedKeys = [];
      for (const editKey of Object.keys(localEdits)) {
        if (!pendingEdits[editKey]) continue;
        // Recommendations array element: localEdits key "recommendations-<idx>-<itemIdx>"
        const recMatch = editKey.match(/^recommendations-(\d+)-(\d+)$/);
        if (recMatch && fields.includes('recommendations') && parseInt(recMatch[1], 10) === idx) {
          await secureApiClient.put(`/api/edit/arterial_blood_gases/${recordId}/edit`, {
            field: 'recommendations',
            value: localEdits[editKey],
            arrayIndex: `${recMatch[2]}.recommendation`,
          });
          committedKeys.push(editKey);
          continue;
        }
        // Simple/sentence/comma fields: localEdits key "<field>-<idx>"
        if (editKey.endsWith(`-${idx}`)) {
          const fieldName = editKey.slice(0, -(`-${idx}`).length);
          if (fields.includes(fieldName)) {
            await secureApiClient.put(`/api/edit/arterial_blood_gases/${recordId}/edit`, {
              field: fieldName,
              value: localEdits[editKey],
            });
            committedKeys.push(editKey);
          }
        }
      }

      await secureApiClient.put(`/api/edit/arterial_blood_gases/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        committedKeys.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) {
        committedKeys.forEach(editKey => {
          const recMatch = editKey.match(/^recommendations-(\d+)-(\d+)$/);
          const fieldPart = recMatch ? `recommendations.${recMatch[2]}` : editKey.slice(0, -(`-${idx}`).length);
          delete store[recordId][fieldPart];
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setEditedSentences(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}-s`))) delete cleaned[k];
        }
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}`))) delete cleaned[k];
        }
        return cleaned;
      });
      setApprovedSections(prev => ({ ...prev, [key]: true }));
    } catch (err) {
      console.error('[ArterialBloodGases] Approve error:', err.message);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  // ==================== RENDER APPROVE BUTTON ====================
  const renderApproveBtn = (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    const hasEdits = sectionHasEdits(sectionId, idx);
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        onClick={() => handleApproveSection(record, sectionId, idx)}
      >
        {isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ==================== RENDER EDITABLE FIELD (simple) ====================
  const renderEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const value = safeString(getFieldValue(record, fieldName, idx));
    if (!value) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    return (
      <div className={showLabel ? 'rec-mini-card' : undefined}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSaveField(record, fieldName, idx, sectionId, null, editValue.trim(), editKey);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, null, editValue.trim(), editKey)}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(value); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(value)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(value, editKey); }}
            >
              {copiedId === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className={`modified-badge${isEdited === 'added' ? ' added' : ''}`}>
            {isEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER DATE FIELD (date picker) ====================
  const renderDateField = (record, fieldName, idx, sectionId, label) => {
    const rawVal = getFieldValue(record, fieldName, idx);
    if (!hasValue(rawVal)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = formatDate(rawVal);

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-date"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch { /* showPicker unsupported */ } } }}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={() => { if (!editValue || isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fieldName, idx, sectionId, null, `${editValue}T00:00:00.000Z`, editKey); }}
              >Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(toInputDate(rawVal)); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayVal)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(displayVal, editKey); }}
            >
              {copiedId === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className="modified-badge">edited - click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ==================== RENDER TIME FIELD (time picker; text fallback for annotated times) ====================
  const renderTimeField = (record, fieldName, idx, sectionId, label) => {
    const rawVal = safeString(getFieldValue(record, fieldName, idx));
    if (!rawVal.trim()) return null;
    const { time, annotation } = parseTimeValue(rawVal);
    // Not a clean pure clock time (carries an annotation like "- First Postoperative ABG", or unparseable)
    // → keep the text editor so the annotation stays visible + editable and nothing is lost.
    if (!time || annotation) return renderEditableField(record, fieldName, idx, sectionId, label);
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            <input
              type="time"
              className="edit-time"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch { /* showPicker unsupported */ } } }}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={() => { if (!editValue) return; handleSaveField(record, fieldName, idx, sectionId, null, editValue, editKey); }}
              >Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(editKey); setEditValue(time); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(rawVal)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedId === editKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(rawVal, editKey); }}
            >
              {copiedId === editKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className="modified-badge">edited - click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ==================== RENDER EDITABLE RECOMMENDATION (single row — text NOT comma-split) ====================
  const renderEditableRecommendation = (record, idx, sectionId, itemIdx, item) => {
    const displayValue = localEdits[`recommendations-${idx}-${itemIdx}`] !== undefined
      ? localEdits[`recommendations-${idx}-${itemIdx}`]
      : (item.recommendation || '');
    if (!String(displayValue).trim()) return null;

    const partKey = `recommendations-${idx}-${itemIdx}-p0`;
    const isEditing = editingField === partKey;
    const isEdited = editedFields[partKey];

    return (
      <div key={itemIdx} className="rec-mini-card">
        {item.date && <div className="nested-subtitle">{highlightText(formatDate(item.date))}</div>}
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) saveRecommendation(record, idx, sectionId, itemIdx, editValue);
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => saveRecommendation(record, idx, sectionId, itemIdx, editValue)}>Save</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(partKey); setEditValue(displayValue); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayValue)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedId === partKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(displayValue, partKey); }}
            >
              {copiedId === partKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {isEdited && !isEditing && (
          <div className="modified-badge">edited - click Pending Approve to save</div>
        )}
      </div>
    );
  };

  // ==================== RENDER SENTENCE EDITABLE FIELD ====================
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const value = String(getFieldValue(record, fieldName, idx) || '');
    if (!value.trim()) return null;
    const sentences = splitBySentence(value);
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId, label, showLabel);

    const sentenceRows = sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const isSentenceEdited = editedSentences[sentenceKey];

      // Per-sentence search filtering
      if (searchTerm && !record._showAllSections && !stm(label)) {
        if (!shouldShowRow(record, sentence)) return null;
      }

      const displayText = showLabel ? sentence : (parsed.isLabeled ? parsed.value : sentence);
      const editText = sentence.replace(/[.;]\s*$/, '');
      const showParsedLabel = !showLabel && parsed.isLabeled;

      if (isEditing) {
        return (
          <div key={sIdx} className="rec-mini-card">
            {showParsedLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    saveSentence(record, fieldName, idx, sectionId, sIdx, editValue);
                  }
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                autoFocus
                rows={2}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)}>Save</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={sIdx} className="rec-mini-card">
          {showParsedLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
          <div
            className={`numbered-row editable-row${isSentenceEdited ? ' modified' : ''}`}
            onClick={() => { setEditingField(sentenceKey); setEditValue(editText); }}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(displayText)}</span>
              <span className="edit-indicator">&#9998;</span>
            </div>
            <button
              className={`copy-btn ${copiedId === sentenceKey ? 'copied' : ''}`}
              onClick={e => { e.stopPropagation(); copyToClipboard(displayText, sentenceKey); }}
            >
              {copiedId === sentenceKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isSentenceEdited && (
            <div className={`modified-badge${isSentenceEdited === 'added' ? ' added' : ''}`}>
              {isSentenceEdited === 'added' ? 'added' : 'edited'} - click Pending Approve to save
            </div>
          )}
        </div>
      );
    }).filter(Boolean);

    if (sentenceRows.length === 0) return null;

    if (showLabel) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {sentenceRows}
        </div>
      );
    }

    return sentenceRows;
  };

  // ==================== COPY SECTION HELPERS ====================
  const copySectionText = (title, text) => {
    const lines = [`${title}:`];
    formatSentenceFieldLines(text).forEach(l => lines.push(`  ${l}`));
    return lines.join('\n');
  };

  // ==================== RENDER ====================

  // Empty state
  if (!records || records.length === 0) {
    return (
      <div className="arterial-blood-gases-document">
        <div className="document-header">
          <h1 className="document-title">Arterial Blood Gases</h1>
        </div>
        <div className="empty-state">No arterial blood gases records found.</div>
      </div>
    );
  }

  return (
    <div className="arterial-blood-gases-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Arterial Blood Gases</h1>
        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copiedId === 'all-documents' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ArterialBloodGasesDocumentPDFTemplate document={pdfData} />}
            fileName={`Arterial_Blood_Gases_${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <button className="copy-btn">
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search arterial blood gases records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No records match "{searchTerm}"</div>
      )}

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const pdfRecord = pdfData[idx] || record;

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="record-meta-row">
                  {record.assessmentDate && (
                    <span className="record-date">{highlightText(formatDate(record.assessmentDate))}</span>
                  )}
                </div>
                <div className="record-title-row">
                  <h2 className="record-title">{highlightText(`Arterial Blood Gases ${idx + 1}`)}</h2>
                </div>
              </div>

              {/* Assessment Info Section */}
              {(hasValue(record.assessmentDate) || hasValue(record.assessmentTime) || hasValue(record.clinicalStatus)) &&
                shouldShowSection(record, 'Assessment Info', formatDate(record.assessmentDate), record.assessmentTime, record.clinicalStatus) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Assessment Info')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedId === `assessmentInfo-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            let text = 'ASSESSMENT INFO\n' + '═'.repeat(40) + '\n';
                            const dateVal = getFieldValue(record, 'assessmentDate', idx);
                            if (dateVal) text += `Assessment Date: ${formatDate(dateVal)}\n`;
                            const time = safeString(getFieldValue(record, 'assessmentTime', idx));
                            if (time) text += `Assessment Time: ${time}\n`;
                            const status = safeString(getFieldValue(record, 'clinicalStatus', idx));
                            if (status) text += `Clinical Status: ${status}\n`;
                            copyToClipboard(text, `assessmentInfo-${idx}`);
                          }}
                        >
                          {copiedId === `assessmentInfo-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(record, 'assessmentInfo', idx)}
                      </div>
                    </div>

                    {/* Assessment Date — EDITABLE (date picker) */}
                    {hasValue(getFieldValue(record, 'assessmentDate', idx)) &&
                      renderDateField(record, 'assessmentDate', idx, 'assessmentInfo', 'Assessment Date')}

                    {/* Assessment Time — EDITABLE (time picker; text fallback for annotated times) */}
                    {hasValue(getFieldValue(record, 'assessmentTime', idx)) &&
                      renderTimeField(record, 'assessmentTime', idx, 'assessmentInfo', 'Assessment Time')}

                    {/* Clinical Status — EDITABLE */}
                    {hasValue(getFieldValue(record, 'clinicalStatus', idx)) &&
                      renderEditableField(record, 'clinicalStatus', idx, 'assessmentInfo', 'Clinical Status')}
                  </div>
                </div>
              )}

              {/* Vital Signs Section — Bar Chart + Editable Text */}
              {hasValue(getFieldValue(record, 'vitalSigns', idx)) &&
                shouldShowSection(record, 'Vital Signs', getFieldValue(record, 'vitalSigns', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Vital Signs')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedId === `vitalSigns-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = safeString(getFieldValue(record, 'vitalSigns', idx));
                            copyToClipboard(copySectionText('VITAL SIGNS', val), `vitalSigns-${idx}`);
                          }}
                        >
                          {copiedId === `vitalSigns-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(record, 'vitalSigns', idx)}
                      </div>
                    </div>

                    {/* Bar Chart Visualization (display-only, with row-level search filtering) */}
                    {(() => {
                      const vsText = safeString(getFieldValue(record, 'vitalSigns', idx));
                      const chartData = parseVitalSigns(vsText);
                      if (chartData.length === 0) return null;

                      const titleMatches = !searchTerm.trim() || record._showAllSections || stm('Vital Signs');

                      const filteredCharts = chartData.map(item => {
                        const color = getAbgBarColor(item.value, item.testType);
                        const interpretation = getAbgInterpretation(item.value, item.testType);
                        const percentage = abgToPercentage(item.value, item.testType);
                        const display = item.unit ? `${item.value} ${item.unit}` : `${item.value}`;
                        return { ...item, color, interpretation, percentage, display };
                      }).filter(item => {
                        if (titleMatches) return true;
                        return shouldShowRow(record, item.label, item.display, item.interpretation, item.raw);
                      });

                      if (filteredCharts.length === 0) return null;

                      return (
                        <div className="chart-container">
                          <AbgChartLegend />
                          {filteredCharts.map((item, ci) => (
                            <AbgBarChart
                              key={ci}
                              label={item.label}
                              percentage={item.percentage}
                              rawValue={item.display}
                              color={item.color}
                              interpretation={item.interpretation}
                              highlightFn={highlightText}
                            />
                          ))}
                        </div>
                      );
                    })()}

                    {/* Text row removed — bar chart replaces it */}
                  </div>
                </div>
              )}

              {/* Interventions Section */}
              {hasValue(getFieldValue(record, 'interventions', idx)) &&
                shouldShowSection(record, 'Interventions', getFieldValue(record, 'interventions', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Interventions')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedId === `interventions-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = safeString(getFieldValue(record, 'interventions', idx));
                            copyToClipboard(copySectionText('INTERVENTIONS', val), `interventions-${idx}`);
                          }}
                        >
                          {copiedId === `interventions-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(record, 'interventions', idx)}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'interventions', idx, 'interventions', 'Interventions', false)}
                  </div>
                </div>
              )}

              {/* Response Section */}
              {hasValue(getFieldValue(record, 'response', idx)) &&
                shouldShowSection(record, 'Response', getFieldValue(record, 'response', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Response')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedId === `response-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = safeString(getFieldValue(record, 'response', idx));
                            copyToClipboard(copySectionText('RESPONSE', val), `response-${idx}`);
                          }}
                        >
                          {copiedId === `response-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(record, 'response', idx)}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'response', idx, 'response', 'Response', false)}
                  </div>
                </div>
              )}

              {/* Plan Section */}
              {hasValue(getFieldValue(record, 'plan', idx)) &&
                shouldShowSection(record, 'Plan', getFieldValue(record, 'plan', idx)) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h3 className="section-title">{highlightText('Plan')}</h3>
                      <div className="header-right-actions">
                        <button
                          className={`copy-btn ${copiedId === `plan-${idx}` ? 'copied' : ''}`}
                          onClick={() => {
                            const val = safeString(getFieldValue(record, 'plan', idx));
                            copyToClipboard(copySectionText('PLAN', val), `plan-${idx}`);
                          }}
                        >
                          {copiedId === `plan-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveBtn(record, 'plan', idx)}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'plan', idx, 'plan', 'Plan', false)}
                  </div>
                </div>
              )}

              {/* Recommendations Section */}
              {(() => {
                const recs = getEffectiveRecommendations(record, idx);
                if (!recs || recs.length === 0) return null;
                const recsText = recs.map(r => `${r.recommendation || ''} ${r.date || ''}`).join(' ');
                if (!shouldShowSection(record, 'Recommendations', recsText)) return null;

                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h3 className="section-title">{highlightText('Recommendations')}</h3>
                        <div className="header-right-actions">
                          <button
                            className={`copy-btn ${copiedId === `recommendations-${idx}` ? 'copied' : ''}`}
                            onClick={() => {
                              let text = 'RECOMMENDATIONS\n' + '═'.repeat(40) + '\n';
                              recs.forEach((r, i) => {
                                text += `${i + 1}. ${r.recommendation || ''}`;
                                if (r.date) text += ` (${formatDate(r.date)})`;
                                text += '\n';
                              });
                              copyToClipboard(text, `recommendations-${idx}`);
                            }}
                          >
                            {copiedId === `recommendations-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveBtn(record, 'recommendations', idx)}
                        </div>
                      </div>
                      {recs.map((item, itemIdx) =>
                        renderEditableRecommendation(record, idx, 'recommendations', itemIdx, item)
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArterialBloodGasesDocument;
