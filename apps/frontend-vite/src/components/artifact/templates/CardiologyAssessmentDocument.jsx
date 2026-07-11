import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import secureApiClient from '../../../services/secureApiClient';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CardiologyAssessmentDocumentPDFTemplate from '../pdf-templates/CardiologyAssessmentDocumentPDFTemplate';
import './CardiologyAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiology_assessmentPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CardiologyAssessmentDocument = ({ document: templateData, data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ========== Data Unwrapping ==========
  const records = useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.cardiology_assessment && Array.isArray(templateData.cardiology_assessment)) {
      return templateData.cardiology_assessment;
    }
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.cardiology_assessment && Array.isArray(docData.cardiology_assessment)) {
        return docData.cardiology_assessment;
      }
      if (docData && typeof docData === 'object') return [docData];
    }
    if (data) {
      if (Array.isArray(data)) return data;
      if (data?.cardiology_assessment && Array.isArray(data.cardiology_assessment)) {
        return data.cardiology_assessment;
      }
      if (typeof data === 'object') return [data];
    }
    if (templateData && typeof templateData === 'object') {
      return [templateData];
    }
    return [];
  }, [templateData, data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (record._id.$oid || record._id) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // sectionId is unknown on rehydrate; mark the field's own section key so the badge/approve show.
        const baseField = fieldPart.includes('.') && !/^\d+$/.test(fieldPart.slice(fieldPart.lastIndexOf('.') + 1))
          ? fieldPart.split('.')[0]
          : (fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart);
        nFields[`${baseField}-${idx}`] = true;
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
  }, [records]);

  // ========== Helper Functions ==========
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return '';
    return String(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateISO = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  // ========== Score Extraction Functions ==========

  // Extract EF from echocardiogram.ejectionFraction (e.g., "45%", "52%")
  const extractEF = (record) => {
    const efStr = record?.echocardiogram?.ejectionFraction;
    if (!efStr) return null;
    const match = String(efStr).match(/(\d+)/);
    if (match) {
      return { value: parseInt(match[1], 10), max: 100 };
    }
    return null;
  };

  // Extract Heart Rate from electrocardiogram.rate (numeric)
  const extractHeartRate = (record) => {
    const rate = record?.electrocardiogram?.rate;
    if (rate && typeof rate === 'number') {
      return { value: rate, max: 150 };
    }
    return null;
  };

  // Extract GRACE Score from assessment text (e.g., "GRACE Score 142")
  const extractGRACE = (record) => {
    const text = safeString(record?.assessment);
    const match = text.match(/GRACE\s*Score\s*[:=]?\s*(\d+)/i);
    if (match) {
      return { value: parseInt(match[1], 10), max: 372 };
    }
    return null;
  };

  // Extract TIMI Score from assessment text (e.g., "TIMI Risk Score 5")
  const extractTIMI = (record) => {
    const text = safeString(record?.assessment);
    const match = text.match(/TIMI\s*(?:Risk\s*)?Score\s*[:=]?\s*(\d+)/i);
    if (match) {
      return { value: parseInt(match[1], 10), max: 7 };
    }
    return null;
  };

  // Extract Door-to-Balloon time from stemiMetrics
  const extractD2B = (record) => {
    const d2b = record?.cardiacCatheterization?.stemiMetrics?.doorToBalloonTime?.minutes;
    if (d2b && typeof d2b === 'number') {
      return { value: d2b, max: 120 }; // Target <90 min
    }
    return null;
  };

  // ========== Color Functions ==========

  // PROTECTIVE color coding (higher = better = green)
  const getProtectiveColor = (value, max) => {
    const pct = (value / max) * 100;
    if (pct >= 55) return '#22c55e'; // Normal EF (green)
    if (pct >= 40) return '#3b82f6'; // Mildly reduced (blue)
    if (pct >= 30) return '#f59e0b'; // Moderately reduced (orange)
    return '#ef4444'; // Severely reduced (red)
  };

  // RISK color coding (higher = worse = red)
  const getRiskColor = (value, max) => {
    const pct = (value / max) * 100;
    if (pct >= 75) return '#ef4444'; // High risk (red)
    if (pct >= 50) return '#f59e0b'; // Moderate risk (orange)
    if (pct >= 25) return '#3b82f6'; // Low-moderate (blue)
    return '#22c55e'; // Low risk (green)
  };

  // Heart Rate color coding (60-100 is normal)
  const getHeartRateColor = (value) => {
    if (value >= 60 && value <= 100) return '#22c55e'; // Normal (green)
    if (value < 60) return '#3b82f6'; // Bradycardia (blue - not always bad)
    if (value <= 110) return '#f59e0b'; // Mild tachycardia (orange)
    return '#ef4444'; // Tachycardia (red)
  };

  // Door-to-Balloon color coding (lower = better)
  const getD2BColor = (value) => {
    if (value <= 60) return '#22c55e'; // Excellent (green)
    if (value <= 90) return '#3b82f6'; // Good - meets target (blue)
    if (value <= 120) return '#f59e0b'; // Delayed (orange)
    return '#ef4444'; // Significantly delayed (red)
  };

  // ========== Clinical Interpretations ==========
  const getEFInterpretation = (value) => {
    if (value >= 55) return 'Normal LV Function';
    if (value >= 40) return 'Mildly Reduced';
    if (value >= 30) return 'Moderately Reduced';
    return 'Severely Reduced';
  };

  const getHeartRateInterpretation = (value) => {
    if (value < 60) return 'Bradycardia';
    if (value <= 100) return 'Normal';
    return 'Tachycardia';
  };

  const getGRACEInterpretation = (value) => {
    if (value <= 108) return 'Low Risk (<1% mortality)';
    if (value <= 140) return 'Intermediate Risk';
    return 'High Risk (>3% mortality)';
  };

  const getTIMIInterpretation = (value) => {
    if (value <= 2) return 'Low Risk';
    if (value <= 4) return 'Intermediate Risk';
    return 'High Risk';
  };

  const getD2BInterpretation = (value) => {
    if (value <= 60) return 'Excellent - Well Under Target';
    if (value <= 90) return 'Good - Target Met (<90 min)';
    if (value <= 120) return 'Delayed - Target Missed';
    return 'Significantly Delayed';
  };

  // ========== Chart Data Preparation ==========
  const prepareChartData = (record) => {
    const chartData = [];

    // Cardiac Function
    const ef = extractEF(record);
    if (ef) {
      chartData.push({
        label: 'Ejection Fraction',
        value: ef.value,
        max: ef.max,
        unit: '%',
        category: 'Cardiac Function',
        color: getProtectiveColor(ef.value, ef.max),
        interpretation: getEFInterpretation(ef.value),
        colorType: 'PROTECTIVE'
      });
    }

    // Vital Signs
    const hr = extractHeartRate(record);
    if (hr) {
      chartData.push({
        label: 'Heart Rate',
        value: hr.value,
        max: hr.max,
        unit: 'bpm',
        category: 'Vital Signs',
        color: getHeartRateColor(hr.value),
        interpretation: getHeartRateInterpretation(hr.value),
        colorType: 'RANGE'
      });
    }

    // Cardiac Risk Scores
    const grace = extractGRACE(record);
    if (grace) {
      chartData.push({
        label: 'GRACE Score',
        value: grace.value,
        max: grace.max,
        unit: '',
        category: 'Cardiac Risk Scores',
        color: getRiskColor(grace.value, grace.max),
        interpretation: getGRACEInterpretation(grace.value),
        colorType: 'RISK'
      });
    }

    const timi = extractTIMI(record);
    if (timi) {
      chartData.push({
        label: 'TIMI Score',
        value: timi.value,
        max: timi.max,
        unit: '',
        category: 'Cardiac Risk Scores',
        color: getRiskColor(timi.value, timi.max),
        interpretation: getTIMIInterpretation(timi.value),
        colorType: 'RISK'
      });
    }

    // STEMI Metrics
    const d2b = extractD2B(record);
    if (d2b) {
      chartData.push({
        label: 'Door-to-Balloon Time',
        value: d2b.value,
        max: d2b.max,
        unit: 'min',
        category: 'STEMI Metrics',
        color: getD2BColor(d2b.value),
        interpretation: getD2BInterpretation(d2b.value),
        colorType: 'INVERTED'
      });
    }

    return chartData;
  };

  // ========== Search Filtering ==========
  const getFilteredChartData = (chartData, searchLower) => {
    if (!searchLower) return chartData;

    const searchWords = searchLower.split(/\s+/)
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter(w => w.length > 0);

    if (searchWords.length === 0) return chartData;

    // Category-level matching
    const cardiacFunctionMatches = searchWords.every(w => 'cardiac function'.includes(w));
    const vitalSignsMatches = searchWords.every(w => 'vital signs'.includes(w));
    const riskScoresMatches = searchWords.every(w => 'cardiac risk scores'.includes(w) || 'risk scores'.includes(w));
    const stemiMetricsMatches = searchWords.every(w => 'stemi metrics'.includes(w));

    if (cardiacFunctionMatches) return chartData.filter(c => c.category === 'Cardiac Function');
    if (vitalSignsMatches) return chartData.filter(c => c.category === 'Vital Signs');
    if (riskScoresMatches) return chartData.filter(c => c.category === 'Cardiac Risk Scores');
    if (stemiMetricsMatches) return chartData.filter(c => c.category === 'STEMI Metrics');

    // Individual bar filtering
    return chartData.filter(item => {
      const combinedText = [
        item.label,
        item.category,
        item.interpretation,
        String(item.value),
        item.unit
      ].join(' ').toLowerCase().replace(/-/g, ' ');

      return searchWords.every(word => {
        const wordNoHyphen = word.replace(/-/g, ' ');
        return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
      });
    });
  };

  // ========== Text Parsing ==========
  const splitIntoSentences = (text) => {
    if (!text) return [];
    return text.split(/\.\s+/).filter(s => s.trim().length > 0).map(s => s.trim() + (s.endsWith('.') ? '' : '.'));
  };

  const parseFindingsWithLabels = (text) => {
    if (!text) return [];
    const groups = [];
    const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);

    sentences.forEach(sentence => {
      sentence = sentence.trim().replace(/\.$/, '').trim();
      if (!sentence) return;

      const colonIdx = sentence.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        const beforeColon = sentence.substring(0, colonIdx);
        const hasParenBefore = beforeColon.includes('(');
        if (!hasParenBefore) {
          const label = beforeColon.trim();
          const content = sentence.substring(colonIdx + 1).trim();
          const items = splitByComma(content);
          if (items.length > 0) {
            groups.push({ label: label, items: items });
            return;
          }
        }
      }
      groups.push({ label: null, items: [sentence + '.'] });
    });

    return groups;
  };

  const splitByComma = (text) => {
    if (!text) return [];
    const items = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        if (current.trim()) items.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) items.push(current.trim());
    return items;
  };

  const splitByPeriodThenComma = (text) => {
    if (!text) return [];
    const items = [];
    const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);

    for (let sentence of sentences) {
      sentence = sentence.trim().replace(/\.$/, '').trim();
      if (!sentence) continue;

      let commaCount = 0;
      let parenDepth = 0;
      for (let i = 0; i < sentence.length; i++) {
        const char = sentence[i];
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === ',' && parenDepth === 0) {
          commaCount++;
        }
      }

      if (commaCount >= 2) {
        const commaItems = splitByComma(sentence);
        items.push(...commaItems);
      } else {
        items.push(sentence + '.');
      }
    }

    return items;
  };

  const keyToLabel = (key) => {
    if (!key) return '';
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // ── Recursive object helpers (booleans -> Yes/No select, number+unit -> number input) ──
  const isScalarVal = (v) => v === null || typeof v !== 'object';
  const isEmptyDeepVal = (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'boolean') return false;
    if (typeof v === 'number') return !Number.isFinite(v);
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.filter(x => !isEmptyDeepVal(x)).length === 0;
    if (typeof v === 'object') return Object.values(v).every(isEmptyDeepVal);
    return false;
  };
  const fmtScalarVal = (v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v ?? '');
  };
  // Split "146/88" -> {num, denom}
  const splitRatioVal = (text) => {
    if (text === null || text === undefined) return null;
    const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return { num: m[1], denom: m[2] };
  };
  // Split "118 bpm" -> {num:'118', sep:' ', unit:'bpm'}
  const splitNumberUnitVal = (text) => {
    if (text === null || text === undefined) return null;
    const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)(\s*)([a-zA-Z%/][a-zA-Z%/0-9\s().-]*)?$/);
    if (!m) return null;
    return { num: m[1], sep: m[2] || ' ', unit: (m[3] || '').trim() };
  };

  const renderObjectFields = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj)
      .filter(([key, val]) => val !== null && val !== undefined && val !== '' && key !== '_id')
      .map(([key, val]) => {
        if (typeof val === 'object' && !Array.isArray(val)) {
          const nestedFields = Object.entries(val)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${keyToLabel(k)}: ${v}`);
          return { label: keyToLabel(key), value: nestedFields.join(', ') };
        }
        return { label: keyToLabel(key), value: String(val) };
      });
  };

  // ========== Copy Functions ==========
  const copyToClipboard = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
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
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    // fieldPart = "field" or "field.arrayIndex" (arrayIndex suffix ONLY when arrayIndex is a number)
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx) => {
    const recId = record._id ? (record._id.$oid || record._id) : null;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // arrayIndex ONLY when the segment after the LAST dot is purely numeric (reverses handleSaveField).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/cardiology_assessment/${recId}/edit`, payload);
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/cardiology_assessment/${recId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recId]) { delete store[recId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      const newEditedFields = { ...editedFields };
      Object.keys(newEditedFields).forEach(key => {
        if (key.endsWith(`-${idx}`)) delete newEditedFields[key];
      });
      setEditedFields(newEditedFields);
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [editedFields, localEdits, pendingEdits]);

  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };

  // ── Recursive object editor leaf (text/number/boolean, dotted-path save) ──
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const dotField = [rootField, ...path].join('.');
    const leafValueString = fmtScalarVal(value);
    const leafEditKey = `${dotField}-${idx}-s0`;
    const isEditing = editingField === leafEditKey;
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatioVal(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnitVal(leafValueString);
    const editStart = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    const canEdit = !!record._id;
    const leafLabel = keyToLabel(path[path.length - 1]);

    const saveLeaf = () => {
      let newVal;
      if (isBool) {
        newVal = editValue === 'yes';
      } else if (ratio) {
        newVal = `${editValue}/${ratio.denom}`;
      } else if (nu && nu.unit) {
        newVal = `${editValue}${nu.sep}${nu.unit}`;
      } else {
        newVal = editValue.trim();
      }
      handleSaveField(record, dotField, idx, sid, undefined, newVal, 0);
    };

    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(leafLabel)}</div>
        {isEditing ? (
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : (ratio || (nu && nu.unit)) ? (
              <div className="number-edit-row">
                <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)} />
                {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : <span className="number-edit-unit">{nu.unit}</span>}
              </div>
            ) : (
              <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} />
            )}
            <div className="edit-actions">
              <button className="save-btn" onClick={saveLeaf} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="numbered-row">
            <div className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(dotField, idx, editStart)}>
              <span className="content-value">{highlightText(leafValueString)}</span>
              {canEdit && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedSectionId === leafEditKey ? 'copied' : ''}`}
              onClick={() => copyToClipboard(`${leafLabel}: ${leafValueString}`, leafEditKey)}
            >
              {copiedSectionId === leafEditKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Recursive object node (nested objects -> nested-group) ──
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeepVal(value)) return null;
    if (isScalarVal(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeepVal(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalarVal(v)
              ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, keyToLabel(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  // ── Top-level OBJECT field renderer (recursive editable leaves) ──
  const renderObjectField = (record, fieldName, idx, sid, sectionTitle, showAll) => {
    const val = record[fieldName];
    if (isEmptyDeepVal(val) || isScalarVal(val)) return null;
    const entries = Object.entries(val).filter(([k, v]) => k !== '_id' && !isEmptyDeepVal(v));
    if (entries.length === 0) return null;

    const searchActive = searchTerm.length > 0;
    const showEverything = !searchTerm;
    const sectionTitleMatches = searchActive && shouldShowRow(record, sectionTitle, sectionTitle.toLowerCase());
    const flat = flattenForSearch(val);
    if (!showEverything && !showAll && !sectionTitleMatches && !shouldShowRow(record, flat)) return null;

    const isModified = editedFields[`${fieldName}-${idx}`];
    const canApprove = isModified && statusOverrides[idx] !== 'approved';

    return (
      <section className="section-container">
        <div className="numbered-rows-wrapper">
          <div className="section-header">
            <h4 className="section-title">{highlightText(sectionTitle)}</h4>
            <div className="header-right-actions">
              <button
                className={`copy-btn ${copiedSectionId === `${fieldName}-section-${idx}` ? 'copied' : ''}`}
                onClick={() => copyToClipboard(`${sectionTitle.toUpperCase()}\n${flat}`, `${fieldName}-section-${idx}`)}
              >
                {copiedSectionId === `${fieldName}-section-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {canApprove && (
                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              )}
            </div>
          </div>
          <div className="domain-groups-wrapper">
            {entries.map(([k, v]) => (
              isScalarVal(v)
                ? renderObjectLeaf(record, fieldName, [k], idx, sid, v)
                : <div className="rec-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sid, keyToLabel(k), v, [k], 1)}</div>
            ))}
            {isModified && <div className="modified-badge">Modified</div>}
          </div>
        </div>
      </section>
    );
  };

  // Flatten object to searchable string
  const flattenForSearch = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v === 'number' || typeof v === 'string') return String(v);
    if (Array.isArray(v)) return v.map(flattenForSearch).join(' ');
    if (typeof v === 'object') return Object.entries(v).filter(([k]) => k !== '_id').map(([k, val]) => `${keyToLabel(k)} ${flattenForSearch(val)}`).join(' ');
    return '';
  };

  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.5 1.5L10.5 3.5M1 11L1.5 8.5L9.5 0.5L11.5 2.5L3.5 10.5L1 11Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );

  const copyAllRecords = () => {
    let allText = 'CARDIOLOGY ASSESSMENT\n\n';
    pdfData.forEach((record, idx) => {
      allText += `=== Assessment ${idx + 1} ===\n`;
      if (record.date) allText += `Date: ${formatDate(record.date)}\n`;
      if (record.type) allText += `Type: ${record.type}\n`;
      if (record.provider) allText += `Provider: ${record.provider}\n`;
      if (record.facility) allText += `Facility: ${record.facility}\n`;
      if (record.status) allText += `Status: ${record.status}\n\n`;

      // Chart data
      const chartData = prepareChartData(record);
      if (chartData.length > 0) {
        allText += 'CARDIAC METRICS:\n';
        chartData.forEach(item => {
          allText += `  ${item.label}: ${item.value}${item.unit} - ${item.interpretation}\n`;
        });
        allText += '\n';
      }

      if (record.findings) {
        allText += `FINDINGS:\n`;
        parseFindingsWithLabels(record.findings).forEach(group => {
          if (group.label) {
            allText += `  ${group.label}:\n`;
            group.items.forEach((item, i) => allText += `    ${i + 1}. ${item}\n`);
          } else {
            group.items.forEach((item, i) => allText += `  ${i + 1}. ${item}\n`);
          }
        });
        allText += '\n';
      }
      if (record.assessment) {
        allText += `ASSESSMENT:\n`;
        splitIntoSentences(record.assessment).forEach((s, i) => allText += `  ${i + 1}. ${s}\n`);
        allText += '\n';
      }
      if (record.plan) {
        allText += `PLAN:\n`;
        splitByPeriodThenComma(record.plan).forEach((s, i) => allText += `  ${i + 1}. ${s}\n`);
        allText += '\n';
      }

      if (record.echocardiogram && Object.keys(record.echocardiogram).length > 0) {
        allText += `ECHOCARDIOGRAM:\n`;
        renderObjectFields(record.echocardiogram).forEach(f => allText += `  ${f.label}: ${f.value}\n`);
        allText += '\n';
      }

      if (record.electrocardiogram && Object.keys(record.electrocardiogram).length > 0) {
        allText += `ELECTROCARDIOGRAM:\n`;
        renderObjectFields(record.electrocardiogram).forEach(f => allText += `  ${f.label}: ${f.value}\n`);
        allText += '\n';
      }

      if (record.scheduledProcedures?.length > 0) {
        allText += `SCHEDULED PROCEDURES:\n`;
        record.scheduledProcedures.forEach((proc, i) => {
          allText += `  ${i + 1}. ${proc.procedureName || 'Procedure'}\n`;
          if (proc.timeframe) allText += `     Timeframe: ${proc.timeframe}\n`;
          if (proc.urgency) allText += `     Urgency: ${proc.urgency}\n`;
          if (proc.indication) allText += `     Indication: ${proc.indication}\n`;
        });
        allText += '\n';
      }

      if (record.recommendations?.length > 0) {
        allText += `RECOMMENDATIONS:\n`;
        record.recommendations.forEach((rec, i) => {
          const recText = typeof rec === 'string' ? rec : rec.recommendation;
          const recDate = typeof rec === 'object' && rec.date ? ` (${rec.date})` : '';
          allText += `  ${i + 1}. ${recText}${recDate}\n`;
        });
        allText += '\n';
      }

      if (record.coronaryArteryDiseaseRiskFactors && Object.keys(record.coronaryArteryDiseaseRiskFactors).length > 0) {
        allText += `CAD RISK FACTORS:\n`;
        const rf = record.coronaryArteryDiseaseRiskFactors;
        if (rf.smoking && rf.smoking !== 'Not specified') allText += `  Smoking: ${rf.smoking}\n`;
        if (rf.hypertension && rf.hypertension !== 'Not specified') allText += `  Hypertension: ${rf.hypertension}\n`;
        if (rf.diabetes && rf.diabetes !== 'Not specified') allText += `  Diabetes: ${rf.diabetes}\n`;
        if (rf.hyperlipidemia && rf.hyperlipidemia !== 'Not specified') allText += `  Hyperlipidemia: ${rf.hyperlipidemia}\n`;
        if (rf.familyHistory && rf.familyHistory !== 'Not specified') allText += `  Family History: ${rf.familyHistory}\n`;
        if (rf.obesity && rf.obesity !== 'Not specified') allText += `  Obesity: ${rf.obesity}\n`;
        if (rf.otherRiskFactors?.length > 0) {
          allText += `  Other Risk Factors:\n`;
          rf.otherRiskFactors.forEach((f, i) => allText += `    ${i + 1}. ${f}\n`);
        }
        allText += '\n';
      }

      if (record.stressTest && Object.keys(record.stressTest).length > 0) {
        allText += `STRESS TEST:\n  ${flattenForSearch(record.stressTest)}\n\n`;
      }

      if (record.results && Object.keys(record.results).length > 0) {
        allText += `TEST RESULTS:\n  ${flattenForSearch(record.results)}\n\n`;
      }

      if (record.additionalTestingOrdered?.length > 0) {
        allText += `ADDITIONAL TESTING ORDERED:\n`;
        record.additionalTestingOrdered.forEach((test, i) => {
          if (typeof test === 'string') { allText += `  ${i + 1}. ${test}\n`; return; }
          allText += `  ${i + 1}. ${test?.testName || 'Test'}\n`;
          if (test?.indication) allText += `     Indication: ${test.indication}\n`;
          if (test?.urgency) allText += `     Urgency: ${test.urgency}\n`;
        });
        allText += '\n';
      }

      if (record.notes) {
        allText += `NOTES:\n  ${record.notes}\n\n`;
      }

      allText += '\n';
    });
    copyToClipboard(allText, 'all');
  };

  // ========== PDF Export ==========
  const toSafeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return '';
    return String(val);
  };

  const pdfData = useMemo(() => {
    return records.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            const topField = parts[0];
            const subField = parts.slice(1).join('.');
            if (typeof merged[topField] === 'object' && merged[topField] !== null) {
              merged[topField] = { ...merged[topField] };
              let obj = merged[topField];
              const subParts = subField.split('.');
              for (let i = 0; i < subParts.length - 1; i++) {
                if (typeof obj[subParts[i]] === 'object') {
                  obj[subParts[i]] = { ...obj[subParts[i]] };
                  obj = obj[subParts[i]];
                }
              }
              obj[subParts[subParts.length - 1]] = editVal;
            } else {
              merged[fieldName] = editVal;
            }
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return {
        ...merged,
        date: toSafeString(merged.date),
        type: toSafeString(merged.type),
        provider: toSafeString(merged.provider),
        facility: toSafeString(merged.facility),
        status: toSafeString(merged.status),
        findings: toSafeString(merged.findings),
        assessment: toSafeString(merged.assessment),
        plan: toSafeString(merged.plan),
        notes: toSafeString(merged.notes),
        chartData: prepareChartData(merged),
      };
    });
  }, [records, localEdits, pendingEdits]);

  // ========== Search Highlighting ==========
  const highlightText = (text) => {
    if (!text || !searchTerm) return text;
    const textStr = String(text);
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return textStr;

    const searchWords = searchLower.split(/\s+/)
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter(w => w.length > 0);

    if (searchWords.length === 0) return textStr;

    const escapedWords = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    const parts = textStr.split(regex);

    return parts.map((part, i) =>
      searchWords.some(w => part.toLowerCase() === w.toLowerCase())
        ? <mark key={i}>{part}</mark>
        : part
    );
  };

  // ========== 4-Level Search ==========
  const shouldShowRow = (record, ...values) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/)
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter(w => w.length > 0);

    const combinedText = values.filter(Boolean)
      .map(arg => String(arg).toLowerCase()
        .replace(/[()[\],.<>&:%]/g, '')
        .replace(/-/g, ' '))
      .join(' ');

    return searchWords.every(word => {
      const wordNoHyphen = word.replace(/-/g, ' ');
      return combinedText.includes(word) || combinedText.includes(wordNoHyphen);
    });
  };

  // ========== Filtered Records ==========
  const filteredRecords = useMemo(() => {
    const recordsWithTitle = records.map((record, idx) => ({
      ...record,
      _documentTitle: `Cardiology Assessment ${idx + 1}${record.type ? ` - ${record.type}` : ''}`,
      _recordNumber: idx + 1
    }));

    if (!searchTerm) return recordsWithTitle;

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/)
      .map(w => w.replace(/[()[\],.<>&:%]+/g, ''))
      .filter(w => w.length > 0);

    return recordsWithTitle.map(record => {
      record._showAllSections = false;

      const echoLabels = record.echocardiogram ? renderObjectFields(record.echocardiogram).map(f => `${f.label} ${f.value}`) : [];
      const ecgLabels = record.electrocardiogram ? renderObjectFields(record.electrocardiogram).map(f => `${f.label} ${f.value}`) : [];
      const procLabels = record.scheduledProcedures?.map(p => `${p.procedureName} ${p.timeframe} ${p.urgency} ${p.indication}`) || [];
      const recLabels = record.recommendations?.map(r => typeof r === 'string' ? r : `${r.recommendation} ${r.date || ''}`) || [];

      const searchableText = [
        record._documentTitle,
        `cardiology assessment ${record._recordNumber}`,
        `assessment ${record._recordNumber}`,
        String(record._recordNumber),
        'cardiology assessment', 'Cardiology Assessment', 'CARDIOLOGY ASSESSMENT',
        record.type, record.provider, record.facility, record.status,
        record.findings, record.assessment, record.plan, record.notes,
        formatDate(record.date), formatDateISO(record.date), record.date,
        // Section titles
        'assessment information', 'Assessment Information', 'ASSESSMENT INFORMATION',
        'cardiac metrics overview', 'Cardiac Metrics Overview', 'CARDIAC METRICS OVERVIEW',
        'score overview', 'Score Overview', 'SCORE OVERVIEW',
        'cardiac function', 'Cardiac Function', 'CARDIAC FUNCTION',
        'vital signs', 'Vital Signs', 'VITAL SIGNS',
        'cardiac risk scores', 'Cardiac Risk Scores', 'CARDIAC RISK SCORES',
        'stemi metrics', 'STEMI Metrics', 'STEMI METRICS',
        'findings', 'Findings', 'FINDINGS',
        'assessment', 'Assessment', 'ASSESSMENT',
        'plan', 'Plan', 'PLAN',
        'echocardiogram', 'Echocardiogram', 'ECHOCARDIOGRAM',
        'electrocardiogram', 'Electrocardiogram', 'ELECTROCARDIOGRAM', 'ECG', 'ecg',
        'scheduled procedures', 'Scheduled Procedures', 'SCHEDULED PROCEDURES',
        'recommendations', 'Recommendations', 'RECOMMENDATIONS',
        'cad risk factors', 'CAD Risk Factors', 'CAD RISK FACTORS',
        'stress test', 'Stress Test', 'STRESS TEST',
        'test results', 'Test Results', 'TEST RESULTS', 'results',
        'additional testing ordered', 'Additional Testing Ordered', 'ADDITIONAL TESTING ORDERED',
        flattenForSearch(record.stressTest),
        flattenForSearch(record.results),
        (record.additionalTestingOrdered || []).map(t => typeof t === 'string' ? t : `${t?.testName || ''} ${t?.indication || ''} ${t?.urgency || ''}`).join(' '),
        'notes', 'Notes', 'NOTES',
        // Chart labels
        'ejection fraction', 'Ejection Fraction', 'EJECTION FRACTION', 'EF', 'ef',
        'heart rate', 'Heart Rate', 'HEART RATE', 'HR', 'hr',
        'grace score', 'GRACE Score', 'GRACE SCORE', 'grace',
        'timi score', 'TIMI Score', 'TIMI SCORE', 'timi',
        'door to balloon', 'Door to Balloon', 'DOOR TO BALLOON', 'd2b',
        // Chart interpretations (searchable)
        'normal lv function', 'mildly reduced', 'moderately reduced', 'severely reduced',
        'bradycardia', 'tachycardia', 'normal',
        'low risk', 'intermediate risk', 'high risk', '>3% mortality', '<1% mortality',
        'excellent', 'well under target', 'good', 'target met', '<90 min', 'delayed', 'target missed', 'significantly delayed',
        ...echoLabels, ...ecgLabels, ...procLabels, ...recLabels
      ].filter(Boolean).join(' ').toLowerCase()
        .replace(/[()[\],.<>&:%]/g, '')
        .replace(/-/g, ' ');

      const documentMatches = searchWords.every(word => {
        const wordNoHyphen = word.replace(/-/g, ' ');
        return searchableText.includes(word) || searchableText.includes(wordNoHyphen);
      });

      if (documentMatches) {
        const titleText = record._documentTitle.toLowerCase();
        const searchNumber = searchLower.match(/\d+/)?.[0];
        const titleNumber = String(record._recordNumber);

        if (searchWords.every(term => titleText.includes(term))) {
          record._showAllSections = true;
        } else if (searchNumber === titleNumber) {
          if (searchLower.includes('cardiology') || searchLower.includes('assessment') || searchLower === searchNumber) {
            record._showAllSections = true;
          }
        }

        return record;
      }

      return null;
    }).filter(Boolean);
  }, [records, searchTerm]);

  // ========== Render ==========
  if (!records || records.length === 0) {
    return (
      <div className="cardiology-assessment-document">
        <div className="empty-state">No cardiology assessment records found.</div>
      </div>
    );
  }

  const showAllContent = !searchTerm;
  const searchLower = searchTerm.toLowerCase().trim();
  const isSearching = searchTerm.length > 0;

  return (
    <div className="cardiology-assessment-document">
      {/* Collection Title */}
      <h1 className="collection-title">Cardiology Assessment</h1>

      {/* Header Actions */}
      <div className="header-actions">
        <button
          className={`action-btn ${copiedSectionId === 'all' ? 'copied' : ''}`}
          onClick={copyAllRecords}
        >
          {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
        </button>
        <PDFDownloadLink
          document={<CardiologyAssessmentDocumentPDFTemplate document={pdfData} />}
          fileName={`cardiology-assessment-${new Date().toISOString().split('T')[0]}.pdf`}
          className="action-btn"
        >
          {({ loading }) => (loading ? 'Preparing PDF...' : 'Export to PDF')}
        </PDFDownloadLink>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search assessments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length === 0 ? (
          <div className="no-results">No results found for "{searchTerm}"</div>
        ) : (
          filteredRecords.map((record, idx) => {
            const showAll = record._showAllSections;
            const chartData = prepareChartData(record);
            const filteredChartData = getFilteredChartData(chartData, searchLower);
            const hasChartData = filteredChartData.length > 0;

            // Group chart data by category
            const chartByCategory = filteredChartData.reduce((acc, item) => {
              if (!acc[item.category]) acc[item.category] = [];
              acc[item.category].push(item);
              return acc;
            }, {});

            return (
              <article key={idx} className="document-card">
                {/* Document Card Header */}
                <header className="document-card-header">
                  <div className="header-top-row">
                    {record.date && (
                      <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                    )}
                    {record.status && (
                      <span className={`status-badge status-${(record.status || '').toLowerCase()}`}>
                        {highlightText(record.status)}
                      </span>
                    )}
                  </div>
                  <h2 className="document-card-title">
                    {highlightText(record._documentTitle || `Cardiology Assessment ${idx + 1}`)}
                  </h2>
                </header>

                <div className="document-card-body">
                  {/* Assessment Information */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Assessment Information', 'assessment information');
                    const showProvider = record.provider && (showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, 'provider', record.provider));
                    const showFacility = record.facility && (showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, 'facility', record.facility));
                    const showType = record.type && (showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, 'type', record.type));

                    if (!showProvider && !showFacility && !showType) return null;

                    const canEdit = !!record._id;
                    const isModified = editedFields[`assessmentInfo-${idx}`];
                    const canApprove = isModified && statusOverrides[idx] !== 'approved';

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Assessment Information')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `assessmentInfo-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const parts = [];
                                  if (showProvider) parts.push(`Provider: ${getFieldValue(record, 'provider', idx) || record.provider}`);
                                  if (showFacility) parts.push(`Facility: ${getFieldValue(record, 'facility', idx) || record.facility}`);
                                  if (showType) parts.push(`Type: ${getFieldValue(record, 'type', idx) || record.type}`);
                                  copyToClipboard(`ASSESSMENT INFORMATION\n${parts.join('\n')}`, `assessmentInfo-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `assessmentInfo-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {showProvider && (
                              <div className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText('Provider')}</div>
                                {editingField === `provider-${idx}-s0` ? (
                                  <div className="edit-field-container">
                                    <textarea
                                      ref={textareaRef}
                                      className="edit-textarea"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      rows={2}
                                    />
                                    <div className="edit-actions">
                                      <button className="save-btn" onClick={() => handleSaveField(record, 'provider', idx, 'assessmentInfo')} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="numbered-row">
                                    <div className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('provider', idx, getFieldValue(record, 'provider', idx) || record.provider)}>
                                      <span className="content-value">{highlightText(getFieldValue(record, 'provider', idx) || record.provider)}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `provider-${idx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(getFieldValue(record, 'provider', idx) || record.provider, `provider-${idx}`)}
                                    >
                                      {copiedSectionId === `provider-${idx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {showFacility && (
                              <div className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText('Facility')}</div>
                                {editingField === `facility-${idx}-s0` ? (
                                  <div className="edit-field-container">
                                    <textarea
                                      ref={textareaRef}
                                      className="edit-textarea"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      rows={2}
                                    />
                                    <div className="edit-actions">
                                      <button className="save-btn" onClick={() => handleSaveField(record, 'facility', idx, 'assessmentInfo')} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="numbered-row">
                                    <div className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('facility', idx, getFieldValue(record, 'facility', idx) || record.facility)}>
                                      <span className="content-value">{highlightText(getFieldValue(record, 'facility', idx) || record.facility)}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `facility-${idx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(getFieldValue(record, 'facility', idx) || record.facility, `facility-${idx}`)}
                                    >
                                      {copiedSectionId === `facility-${idx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {showType && (
                              <div className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText('Type')}</div>
                                {editingField === `type-${idx}-s0` ? (
                                  <div className="edit-field-container">
                                    <textarea
                                      ref={textareaRef}
                                      className="edit-textarea"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      rows={2}
                                    />
                                    <div className="edit-actions">
                                      <button className="save-btn" onClick={() => handleSaveField(record, 'type', idx, 'assessmentInfo')} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="numbered-row">
                                    <div className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('type', idx, getFieldValue(record, 'type', idx) || record.type)}>
                                      <span className="content-value">{highlightText(getFieldValue(record, 'type', idx) || record.type)}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `type-${idx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(getFieldValue(record, 'type', idx) || record.type, `type-${idx}`)}
                                    >
                                      {copiedSectionId === `type-${idx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {isModified && <div className="modified-badge">Modified</div>}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Cardiac Metrics Overview - Bar Chart */}
                  {(() => {
                    const sectionTitleMatches = isSearching && (
                      shouldShowRow(record, 'Cardiac Metrics Overview', 'cardiac metrics') ||
                      shouldShowRow(record, 'Score Overview', 'score overview')
                    );

                    if (!hasChartData && !showAllContent && !showAll && !sectionTitleMatches) return null;
                    if (!hasChartData) return null;

                    return (
                      <section className="chart-section">
                        <h4 className="section-title">{highlightText('Cardiac Metrics Overview')}</h4>
                        <div className="chart-container">
                          {/* Legend */}
                          <div className="chart-legend">
                            <div className="legend-item">
                              <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
                              <span>Normal/Low Risk</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
                              <span>Mild/Low-Moderate</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
                              <span>Moderate</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
                              <span>High Risk/Abnormal</span>
                            </div>
                          </div>

                          {/* Bars by Category */}
                          {Object.entries(chartByCategory).map(([category, items]) => (
                            <div key={category} className="chart-category">
                              <div className="category-header">{highlightText(category)}</div>
                              {items.map((item, itemIdx) => (
                                <div key={itemIdx} className="bar-chart-row">
                                  <div className="bar-label">{highlightText(item.label)}</div>
                                  <div className="bar-container">
                                    <div className="bar-background">
                                      <div
                                        className="bar-fill"
                                        style={{
                                          width: `${Math.min((item.value / item.max) * 100, 100)}%`,
                                          backgroundColor: item.color
                                        }}
                                      ></div>
                                    </div>
                                    <span className="bar-value">{item.value}{item.unit}</span>
                                  </div>
                                  <div className="bar-interpretation" style={{ color: item.color }}>
                                    {highlightText(item.interpretation)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}

                  {/* Findings */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Findings', 'findings');
                    const fieldVal = getFieldValue(record, 'findings', idx) || record.findings;
                    if (!fieldVal) return null;
                    if (!showAllContent && !showAll && !sectionTitleMatches && !shouldShowRow(record, fieldVal)) return null;

                    const groups = parseFindingsWithLabels(fieldVal);
                    const visibleGroups = groups.filter(group => {
                      const groupLabelMatches = isSearching && group.label && shouldShowRow(record, group.label);
                      return showAllContent || showAll || sectionTitleMatches || groupLabelMatches ||
                        group.items.some(item => shouldShowRow(record, item));
                    });

                    if (visibleGroups.length === 0) return null;

                    const canEdit = !!record._id;
                    const editKey = `findings-${idx}-s0`;
                    const isEditing = editingField === editKey;
                    const isModified = editedFields[`findings-${idx}`];
                    const canApprove = editedFields[`findings-${idx}`] && statusOverrides[idx] !== 'approved';

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Findings')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `findings-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `FINDINGS\n${visibleGroups.map(g => g.label ? `${g.label}:\n${g.items.map((item, i) => `  ${i+1}. ${item}`).join('\n')}` : g.items.map((item, i) => `${i+1}. ${item}`).join('\n')).join('\n')}`;
                                  copyToClipboard(text, `findings-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `findings-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {isEditing ? (
                              <div className="rec-mini-card edit-row">
                                <div className="edit-field-container">
                                  <textarea
                                    ref={textareaRef}
                                    className="edit-textarea"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    rows={4}
                                  />
                                  <div className="edit-actions">
                                    <button className="save-btn" onClick={() => handleSaveField(record, 'findings', idx, 'findings')} disabled={saving}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {visibleGroups.map((group, gIdx) => {
                                  const groupLabelMatches = isSearching && group.label && shouldShowRow(record, group.label);
                                  const filteredItems = group.items.filter(item =>
                                    showAllContent || showAll || sectionTitleMatches || groupLabelMatches || shouldShowRow(record, item)
                                  );

                                  if (group.label) {
                                    return (
                                      <div key={gIdx} className="rec-mini-card">
                                        <div className="nested-subtitle">{highlightText(group.label)}</div>
                                        {filteredItems.map((item, iIdx) => (
                                          <div key={iIdx} className="numbered-row">
                                            <div className={`row-content${canEdit ? ' editable' : ''}`}
                                              onClick={() => canEdit && handleStartEdit('findings', idx, fieldVal)}>
                                              <span className="content-value">{highlightText(item)}</span>
                                              {canEdit && editIndicator}
                                            </div>
                                            <button
                                              className={`copy-btn ${copiedSectionId === `findings-${idx}-${gIdx}-${iIdx}` ? 'copied' : ''}`}
                                              onClick={() => copyToClipboard(item, `findings-${idx}-${gIdx}-${iIdx}`)}
                                            >
                                              {copiedSectionId === `findings-${idx}-${gIdx}-${iIdx}` ? 'Copied' : 'Copy'}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }

                                  return filteredItems.map((item, iIdx) => (
                                    <div key={`${gIdx}-${iIdx}`} className="numbered-row">
                                      <div className={`row-content${canEdit ? ' editable' : ''}`}
                                        onClick={() => canEdit && handleStartEdit('findings', idx, fieldVal)}>
                                        <span className="content-value">{highlightText(item)}</span>
                                        {canEdit && editIndicator}
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `findings-${idx}-${gIdx}-${iIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(item, `findings-${idx}-${gIdx}-${iIdx}`)}
                                      >
                                        {copiedSectionId === `findings-${idx}-${gIdx}-${iIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  ));
                                })}
                                {isModified && <div className="modified-badge">Modified</div>}
                              </>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Assessment - HIDDEN when scores are extracted (shown in chart instead) */}
                  {(() => {
                    // Hide section if GRACE or TIMI scores are extracted and shown in chart
                    const graceExtracted = extractGRACE(record);
                    const timiExtracted = extractTIMI(record);
                    if (graceExtracted || timiExtracted) return null; // Data shown in bar chart

                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Assessment', 'assessment');
                    const fieldVal = getFieldValue(record, 'assessment', idx) || record.assessment;
                    if (!fieldVal) return null;
                    if (!showAllContent && !showAll && !sectionTitleMatches && !shouldShowRow(record, fieldVal)) return null;

                    const items = splitIntoSentences(fieldVal);
                    const filteredItems = items.filter(item =>
                      showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, item)
                    );

                    if (filteredItems.length === 0) return null;

                    const canEdit = !!record._id;
                    const editKeyStr = `assessment-${idx}-s0`;
                    const isEditing = editingField === editKeyStr;
                    const isModified = editedFields[`assessment-${idx}`];
                    const canApprove = editedFields[`assessment-${idx}`] && statusOverrides[idx] !== 'approved';

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Assessment')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `assessment-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `ASSESSMENT\n${filteredItems.map((item, i) => `${i+1}. ${item}`).join('\n')}`;
                                  copyToClipboard(text, `assessment-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `assessment-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {isEditing ? (
                              <div className="rec-mini-card edit-row">
                                <div className="edit-field-container">
                                  <textarea
                                    ref={textareaRef}
                                    className="edit-textarea"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    rows={4}
                                  />
                                  <div className="edit-actions">
                                    <button className="save-btn" onClick={() => handleSaveField(record, 'assessment', idx, 'assessment')} disabled={saving}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {filteredItems.map((item, sIdx) => (
                                  <div key={sIdx} className="numbered-row">
                                    <div className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('assessment', idx, fieldVal)}>
                                      <span className="content-value">{highlightText(item)}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `assessment-${idx}-${sIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(item, `assessment-${idx}-${sIdx}`)}
                                    >
                                      {copiedSectionId === `assessment-${idx}-${sIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                ))}
                                {isModified && <div className="modified-badge">Modified</div>}
                              </>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Plan */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Plan', 'plan');
                    const fieldVal = getFieldValue(record, 'plan', idx) || record.plan;
                    if (!fieldVal) return null;
                    if (!showAllContent && !showAll && !sectionTitleMatches && !shouldShowRow(record, fieldVal)) return null;

                    const items = splitByPeriodThenComma(fieldVal);
                    const filteredItems = items.filter(item =>
                      showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, item)
                    );

                    if (filteredItems.length === 0) return null;

                    const canEdit = !!record._id;
                    const editKeyStr = `plan-${idx}-s0`;
                    const isEditing = editingField === editKeyStr;
                    const isModified = editedFields[`plan-${idx}`];
                    const canApprove = editedFields[`plan-${idx}`] && statusOverrides[idx] !== 'approved';

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Plan')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `plan-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `PLAN\n${filteredItems.map((item, i) => `${i+1}. ${item}`).join('\n')}`;
                                  copyToClipboard(text, `plan-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `plan-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {isEditing ? (
                              <div className="rec-mini-card edit-row">
                                <div className="edit-field-container">
                                  <textarea
                                    ref={textareaRef}
                                    className="edit-textarea"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    rows={4}
                                  />
                                  <div className="edit-actions">
                                    <button className="save-btn" onClick={() => handleSaveField(record, 'plan', idx, 'plan')} disabled={saving}>
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {filteredItems.map((item, sIdx) => (
                                  <div key={sIdx} className="numbered-row">
                                    <div className={`row-content${canEdit ? ' editable' : ''}`}
                                      onClick={() => canEdit && handleStartEdit('plan', idx, fieldVal)}>
                                      <span className="content-value">{highlightText(item)}</span>
                                      {canEdit && editIndicator}
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `plan-${idx}-${sIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(item, `plan-${idx}-${sIdx}`)}
                                    >
                                      {copiedSectionId === `plan-${idx}-${sIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                ))}
                                {isModified && <div className="modified-badge">Modified</div>}
                              </>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Echocardiogram - HIDDEN when EF is extracted (shown in chart instead) */}
                  {(() => {
                    // Hide section if EF is extracted and shown in chart
                    const efExtracted = extractEF(record);
                    if (efExtracted) return null; // Data shown in bar chart

                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Echocardiogram', 'echocardiogram', 'echo');
                    if (!record.echocardiogram || Object.keys(record.echocardiogram).length === 0) return null;

                    const fields = renderObjectFields(record.echocardiogram);
                    const filteredFields = fields.filter(f =>
                      showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, f.label, f.value)
                    );

                    if (filteredFields.length === 0) return null;

                    const canEdit = !!record._id;
                    const isModified = editedFields[`echocardiogram-${idx}`];
                    const canApprove = editedFields[`echocardiogram-${idx}`] && statusOverrides[idx] !== 'approved';

                    // Build a map from label to original key for dot-notation editing
                    const echoKeys = Object.keys(record.echocardiogram).filter(k => k !== '_id' && record.echocardiogram[k] !== null && record.echocardiogram[k] !== undefined && record.echocardiogram[k] !== '');

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Echocardiogram')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `echo-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `ECHOCARDIOGRAM\n${filteredFields.map(f => `${f.label}: ${f.value}`).join('\n')}`;
                                  copyToClipboard(text, `echo-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `echo-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {filteredFields.map((field, fIdx) => {
                              const originalKey = echoKeys[fIdx] || '';
                              const dotField = `echocardiogram.${originalKey}`;
                              const echoEditKey = `${dotField}-${idx}-s0`;
                              const isEditingEcho = editingField === echoEditKey;

                              return (
                                <div key={fIdx} className="rec-mini-card">
                                  <div className="nested-subtitle">{highlightText(field.label)}</div>
                                  {isEditingEcho ? (
                                    <div className="edit-field-container">
                                      <textarea
                                        ref={textareaRef}
                                        className="edit-textarea"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={2}
                                      />
                                      <div className="edit-actions">
                                        <button className="save-btn" onClick={() => handleSaveField(record, dotField, idx, 'echocardiogram')} disabled={saving}>
                                          {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="numbered-row">
                                      <div className={`row-content${canEdit ? ' editable' : ''}`}
                                        onClick={() => canEdit && handleStartEdit(dotField, idx, String(field.value))}>
                                        <span className="content-value">{highlightText(field.value)}</span>
                                        {canEdit && editIndicator}
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `echo-${idx}-${fIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(`${field.label}: ${field.value}`, `echo-${idx}-${fIdx}`)}
                                      >
                                        {copiedSectionId === `echo-${idx}-${fIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {isModified && <div className="modified-badge">Modified</div>}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Electrocardiogram - HIDDEN when HR is extracted (shown in chart instead) */}
                  {(() => {
                    // Hide section if HR is extracted and shown in chart
                    const hrExtracted = extractHeartRate(record);
                    if (hrExtracted) return null; // Data shown in bar chart

                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Electrocardiogram', 'electrocardiogram', 'ECG', 'ecg');
                    if (!record.electrocardiogram || Object.keys(record.electrocardiogram).length === 0) return null;

                    const fields = renderObjectFields(record.electrocardiogram);
                    const filteredFields = fields.filter(f =>
                      showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, f.label, f.value)
                    );

                    if (filteredFields.length === 0) return null;

                    const canEdit = !!record._id;
                    const isModified = editedFields[`electrocardiogram-${idx}`];
                    const canApprove = editedFields[`electrocardiogram-${idx}`] && statusOverrides[idx] !== 'approved';

                    const ecgKeys = Object.keys(record.electrocardiogram).filter(k => k !== '_id' && record.electrocardiogram[k] !== null && record.electrocardiogram[k] !== undefined && record.electrocardiogram[k] !== '');

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Electrocardiogram (ECG)')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `ecg-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `ELECTROCARDIOGRAM (ECG)\n${filteredFields.map(f => `${f.label}: ${f.value}`).join('\n')}`;
                                  copyToClipboard(text, `ecg-section-${idx}`);
                                }}
                              >
                                {copiedSectionId === `ecg-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="domain-groups-wrapper">
                            {filteredFields.map((field, fIdx) => {
                              const originalKey = ecgKeys[fIdx] || '';
                              const dotField = `electrocardiogram.${originalKey}`;
                              const ecgEditKey = `${dotField}-${idx}-s0`;
                              const isEditingEcg = editingField === ecgEditKey;

                              return (
                                <div key={fIdx} className="rec-mini-card">
                                  <div className="nested-subtitle">{highlightText(field.label)}</div>
                                  {isEditingEcg ? (
                                    <div className="edit-field-container">
                                      <textarea
                                        ref={textareaRef}
                                        className="edit-textarea"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={2}
                                      />
                                      <div className="edit-actions">
                                        <button className="save-btn" onClick={() => handleSaveField(record, dotField, idx, 'electrocardiogram')} disabled={saving}>
                                          {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="numbered-row">
                                      <div className={`row-content${canEdit ? ' editable' : ''}`}
                                        onClick={() => canEdit && handleStartEdit(dotField, idx, String(field.value))}>
                                        <span className="content-value">{highlightText(field.value)}</span>
                                        {canEdit && editIndicator}
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `ecg-${idx}-${fIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(`${field.label}: ${field.value}`, `ecg-${idx}-${fIdx}`)}
                                      >
                                        {copiedSectionId === `ecg-${idx}-${fIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {isModified && <div className="modified-badge">Modified</div>}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Scheduled Procedures */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Scheduled Procedures', 'scheduled procedures');
                    if (!record.scheduledProcedures || record.scheduledProcedures.length === 0) return null;

                    const filteredProcs = record.scheduledProcedures.filter(proc =>
                      showAllContent || showAll || sectionTitleMatches ||
                      shouldShowRow(record, proc.procedureName, proc.timeframe, proc.urgency, proc.indication)
                    );

                    if (filteredProcs.length === 0) return null;

                    return (
                      <section className="section-container">
                        <h4 className="section-title">{highlightText('Scheduled Procedures')}</h4>
                        <div className="numbered-rows-wrapper">
                          <div className="domain-groups-wrapper">
                            {filteredProcs.map((proc, pIdx) => (
                              <div key={pIdx} className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText(proc.procedureName || 'Procedure')}</div>
                                {proc.timeframe && (
                                  <div className="numbered-row">
                                    <div className="row-content">
                                      <span className="mini-card-label">Timeframe:</span>
                                      <span className="content-value">{highlightText(proc.timeframe)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `proc-tf-${idx}-${pIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(proc.timeframe, `proc-tf-${idx}-${pIdx}`)}
                                    >
                                      {copiedSectionId === `proc-tf-${idx}-${pIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                                {proc.urgency && (
                                  <div className="numbered-row">
                                    <div className="row-content">
                                      <span className="mini-card-label">Urgency:</span>
                                      <span className="content-value">{highlightText(proc.urgency)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `proc-urg-${idx}-${pIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(proc.urgency, `proc-urg-${idx}-${pIdx}`)}
                                    >
                                      {copiedSectionId === `proc-urg-${idx}-${pIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                                {proc.indication && (
                                  <div className="numbered-row">
                                    <div className="row-content">
                                      <span className="mini-card-label">Indication:</span>
                                      <span className="content-value">{highlightText(proc.indication)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `proc-ind-${idx}-${pIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(proc.indication, `proc-ind-${idx}-${pIdx}`)}
                                    >
                                      {copiedSectionId === `proc-ind-${idx}-${pIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Recommendations */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Recommendations', 'recommendations');
                    if (!record.recommendations || record.recommendations.length === 0) return null;

                    const filteredRecs = record.recommendations.filter(rec => {
                      const recText = typeof rec === 'string' ? rec : rec.recommendation;
                      const recDate = typeof rec === 'object' ? rec.date : '';
                      return showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, recText, recDate);
                    });

                    if (filteredRecs.length === 0) return null;

                    return (
                      <section className="section-container">
                        <h4 className="section-title">{highlightText('Recommendations')}</h4>
                        <div className="numbered-rows-wrapper">
                          <div className="domain-groups-wrapper">
                            {filteredRecs.map((rec, rIdx) => {
                              const recText = typeof rec === 'string' ? rec : rec.recommendation;
                              const recDate = typeof rec === 'object' && rec.date ? rec.date : '';
                              return (
                                <div key={rIdx} className="rec-mini-card">
                                  {recDate && <div className="rec-date-badge">{highlightText(recDate)}</div>}
                                  <div className="numbered-row">
                                    <div className="row-content">
                                      <span className="content-value">{highlightText(recText)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `rec-${idx}-${rIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(recText, `rec-${idx}-${rIdx}`)}
                                    >
                                      {copiedSectionId === `rec-${idx}-${rIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* CAD Risk Factors */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'CAD Risk Factors', 'cad risk factors', 'coronary artery disease');
                    if (!record.coronaryArteryDiseaseRiskFactors || Object.keys(record.coronaryArteryDiseaseRiskFactors).length === 0) return null;

                    const rf = record.coronaryArteryDiseaseRiskFactors;
                    const factors = [];
                    if (rf.smoking && rf.smoking !== 'Not specified') factors.push({ label: 'Smoking', value: rf.smoking });
                    if (rf.hypertension && rf.hypertension !== 'Not specified') factors.push({ label: 'Hypertension', value: rf.hypertension });
                    if (rf.diabetes && rf.diabetes !== 'Not specified') factors.push({ label: 'Diabetes', value: rf.diabetes });
                    if (rf.hyperlipidemia && rf.hyperlipidemia !== 'Not specified') factors.push({ label: 'Hyperlipidemia', value: rf.hyperlipidemia });
                    if (rf.familyHistory && rf.familyHistory !== 'Not specified') factors.push({ label: 'Family History', value: rf.familyHistory });
                    if (rf.obesity && rf.obesity !== 'Not specified') factors.push({ label: 'Obesity', value: rf.obesity });
                    if (rf.sedentaryLifestyle && rf.sedentaryLifestyle !== 'Not specified') factors.push({ label: 'Sedentary Lifestyle', value: rf.sedentaryLifestyle });

                    const filteredFactors = factors.filter(f =>
                      showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, f.label, f.value)
                    );

                    const showOther = rf.otherRiskFactors?.length > 0 && (
                      showAllContent || showAll || sectionTitleMatches ||
                      rf.otherRiskFactors.some(f => shouldShowRow(record, f))
                    );

                    if (filteredFactors.length === 0 && !showOther) return null;

                    return (
                      <section className="section-container">
                        <h4 className="section-title">{highlightText('CAD Risk Factors')}</h4>
                        <div className="numbered-rows-wrapper">
                          <div className="domain-groups-wrapper">
                            {filteredFactors.map((f, fIdx) => (
                              <div key={fIdx} className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText(f.label)}</div>
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(f.value)}</span>
                                  </div>
                                  <button
                                    className={`copy-btn ${copiedSectionId === `rf-${idx}-${fIdx}` ? 'copied' : ''}`}
                                    onClick={() => copyToClipboard(`${f.label}: ${f.value}`, `rf-${idx}-${fIdx}`)}
                                  >
                                    {copiedSectionId === `rf-${idx}-${fIdx}` ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))}
                            {showOther && (
                              <div className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText('Other Risk Factors')}</div>
                                {rf.otherRiskFactors
                                  .filter(f => showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, f))
                                  .map((factor, ofIdx) => (
                                    <div key={ofIdx} className="numbered-row">
                                      <div className="row-content">
                                        <span className="content-value">{highlightText(factor)}</span>
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `orf-${idx}-${ofIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(factor, `orf-${idx}-${ofIdx}`)}
                                      >
                                        {copiedSectionId === `orf-${idx}-${ofIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Stress Test (recursive object) */}
                  {renderObjectField(record, 'stressTest', idx, 'stressTest', 'Stress Test', showAll)}

                  {/* Test Results (recursive object) */}
                  {renderObjectField(record, 'results', idx, 'results', 'Test Results', showAll)}

                  {/* Additional Testing Ordered (object-array) */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Additional Testing Ordered', 'additional testing ordered');
                    if (!record.additionalTestingOrdered || record.additionalTestingOrdered.length === 0) return null;

                    const filteredTests = record.additionalTestingOrdered.filter(test => {
                      if (typeof test === 'string') return showAllContent || showAll || sectionTitleMatches || shouldShowRow(record, test);
                      return showAllContent || showAll || sectionTitleMatches ||
                        shouldShowRow(record, test?.testName, test?.indication, test?.urgency);
                    });

                    if (filteredTests.length === 0) return null;

                    return (
                      <section className="section-container">
                        <h4 className="section-title">{highlightText('Additional Testing Ordered')}</h4>
                        <div className="numbered-rows-wrapper">
                          <div className="domain-groups-wrapper">
                            {filteredTests.map((test, tIdx) => {
                              if (typeof test === 'string') {
                                return (
                                  <div key={tIdx} className="numbered-row">
                                    <div className="row-content">
                                      <span className="content-value">{highlightText(test)}</span>
                                    </div>
                                    <button
                                      className={`copy-btn ${copiedSectionId === `addtest-${idx}-${tIdx}` ? 'copied' : ''}`}
                                      onClick={() => copyToClipboard(test, `addtest-${idx}-${tIdx}`)}
                                    >
                                      {copiedSectionId === `addtest-${idx}-${tIdx}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <div key={tIdx} className="rec-mini-card">
                                  <div className="nested-subtitle">{highlightText(test?.testName || 'Test')}</div>
                                  {test?.indication && (
                                    <div className="numbered-row">
                                      <div className="row-content">
                                        <span className="mini-card-label">Indication:</span>
                                        <span className="content-value">{highlightText(test.indication)}</span>
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `addtest-ind-${idx}-${tIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(test.indication, `addtest-ind-${idx}-${tIdx}`)}
                                      >
                                        {copiedSectionId === `addtest-ind-${idx}-${tIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  )}
                                  {test?.urgency && (
                                    <div className="numbered-row">
                                      <div className="row-content">
                                        <span className="mini-card-label">Urgency:</span>
                                        <span className="content-value">{highlightText(test.urgency)}</span>
                                      </div>
                                      <button
                                        className={`copy-btn ${copiedSectionId === `addtest-urg-${idx}-${tIdx}` ? 'copied' : ''}`}
                                        onClick={() => copyToClipboard(test.urgency, `addtest-urg-${idx}-${tIdx}`)}
                                      >
                                        {copiedSectionId === `addtest-urg-${idx}-${tIdx}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  })()}

                  {/* Notes */}
                  {(() => {
                    const sectionTitleMatches = isSearching && shouldShowRow(record, 'Notes', 'notes');
                    const fieldVal = getFieldValue(record, 'notes', idx) || record.notes;
                    if (!fieldVal) return null;
                    if (!showAllContent && !showAll && !sectionTitleMatches && !shouldShowRow(record, fieldVal)) return null;

                    const canEdit = !!record._id;
                    const editKeyStr = `notes-${idx}-s0`;
                    const isEditing = editingField === editKeyStr;
                    const isModified = editedFields[`notes-${idx}`];
                    const canApprove = editedFields[`notes-${idx}`] && statusOverrides[idx] !== 'approved';

                    return (
                      <section className="section-container">
                        <div className="numbered-rows-wrapper">
                          <div className="section-header">
                            <h4 className="section-title">{highlightText('Notes')}</h4>
                            <div className="header-right-actions">
                              <button
                                className={`copy-btn ${copiedSectionId === `notes-section-${idx}` ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(`NOTES\n${fieldVal}`, `notes-section-${idx}`)}
                              >
                                {copiedSectionId === `notes-section-${idx}` ? 'Copied' : 'Copy Section'}
                              </button>
                              {canApprove && (
                                <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
                                  {approving ? 'Approving...' : 'Approve'}
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="rec-mini-card edit-row">
                              <div className="edit-field-container">
                                <textarea
                                  ref={textareaRef}
                                  className="edit-textarea"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  rows={4}
                                />
                                <div className="edit-actions">
                                  <button className="save-btn" onClick={() => handleSaveField(record, 'notes', idx, 'notes')} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="numbered-row">
                                <div className={`row-content${canEdit ? ' editable' : ''}`}
                                  onClick={() => canEdit && handleStartEdit('notes', idx, fieldVal)}>
                                  <span className="content-value">{highlightText(fieldVal)}</span>
                                  {canEdit && editIndicator}
                                </div>
                                <button
                                  className={`copy-btn ${copiedSectionId === `notes-${idx}` ? 'copied' : ''}`}
                                  onClick={() => copyToClipboard(fieldVal, `notes-${idx}`)}
                                >
                                  {copiedSectionId === `notes-${idx}` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              {isModified && <div className="modified-badge">Modified</div>}
                            </>
                          )}
                        </div>
                      </section>
                    );
                  })()}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CardiologyAssessmentDocument;
