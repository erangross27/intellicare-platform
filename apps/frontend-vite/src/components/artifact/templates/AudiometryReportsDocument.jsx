/**
 * AudiometryReportsDocument.jsx
 * Inline editing with per-section approve, audiogram bar chart display-only,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AudiometryReportsDocumentPDFTemplate from '../pdf-templates/AudiometryReportsDocumentPDFTemplate';
import './AudiometryReportsDocument.css';

// ===== Chart Helpers (display-only) =====
const extractDbValue = (text) => {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') return text;
  const str = String(text);
  const match = str.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

const extractPercentage = (text, ear) => {
  if (!text) return null;
  const str = String(text);
  const earPattern = new RegExp(`${ear}[:\\s]*(\\d+(?:\\.\\d+)?)\\s*%`, 'i');
  const earMatch = str.match(earPattern);
  if (earMatch) return parseFloat(earMatch[1]);
  const simpleMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  return simpleMatch ? parseFloat(simpleMatch[1]) : null;
};

// Derive frequency keys from the actual thresholds object (dynamic keys:
// real data uses both "250Hz" and bare "250", and includes 3000/6000).
// Sorted numerically by the leading number so the audiogram reads low→high.
const getFrequencyKeys = (thresholds) => {
  if (!thresholds || typeof thresholds !== 'object') return [];
  return Object.keys(thresholds).sort((a, b) => {
    const na = parseFloat(a); const nb = parseFloat(b);
    if (isNaN(na) || isNaN(nb)) return String(a).localeCompare(String(b));
    return na - nb;
  });
};
const formatFreqLabel = (key) => /hz$/i.test(String(key)) ? String(key) : `${key}Hz`;

const getThresholdColor = (db) => {
  if (db === null) return '#6b7280';
  if (db <= 25) return '#22c55e';
  if (db <= 40) return '#3b82f6';
  if (db <= 55) return '#f59e0b';
  if (db <= 70) return '#ef4444';
  return '#dc2626';
};
const getThresholdInterp = (db) => {
  if (db === null) return 'Unknown';
  if (db <= 25) return 'Normal';
  if (db <= 40) return 'Mild Loss';
  if (db <= 55) return 'Moderate';
  if (db <= 70) return 'Mod-Severe';
  if (db <= 90) return 'Severe';
  return 'Profound';
};
const getRecogColor = (pct) => {
  if (pct === null) return '#6b7280';
  if (pct >= 90) return '#22c55e';
  if (pct >= 80) return '#3b82f6';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
};
const getRecogInterp = (pct) => {
  if (pct === null) return 'Unknown';
  if (pct >= 90) return 'Excellent';
  if (pct >= 80) return 'Good';
  if (pct >= 60) return 'Fair';
  return 'Poor';
};

const SECTION_FIELDS = {
  recordInfo: ['audiologist', 'facility'],
  audiogramOverview: ['rightEarThresholds', 'leftEarThresholds'],
  testInfo: ['testType', 'hearingLossType', 'hearingLossSeverity'],
  speechResults: ['speechReception', 'wordRecognition'],
  middleEarFunction: ['tympanometry', 'acousticReflex'],
  interpretation: ['interpretation'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.<freq>") */
const DRAFT_KEY = 'audiometry_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const FIELD_LABELS = {
  audiologist: 'Audiologist',
  facility: 'Facility',
  testType: 'Test Type',
  hearingLossType: 'Hearing Loss Type',
  hearingLossSeverity: 'Hearing Loss Severity',
  speechReception: 'Speech Reception Threshold',
  wordRecognition: 'Word Recognition',
  tympanometry: 'Tympanometry',
  acousticReflex: 'Acoustic Reflexes',
  interpretation: 'Interpretation',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const AudiometryReportsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.audiometry_reports) return Array.isArray(r.audiometry_reports) ? r.audiometry_reports : [r.audiometry_reports];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.audiometry_reports) return Array.isArray(dd.audiometry_reports) ? dd.audiometry_reports : [dd.audiometry_reports];
        return [dd];
      }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = (() => {
        const id = record && record._id;
        if (!id) return null;
        if (typeof id === 'string') return id;
        if (id.$oid) return id.$oid;
        return String(id);
      })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      // Group threshold sub-keys ("field.<freq>") so the merged object can be rebuilt for rendering.
      const thresholdObjs = {};
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        if (dotIdx !== -1) {
          // Nested dot-path (e.g. threshold object frequency) → keep merged object in localEdits
          const baseField = fieldPart.slice(0, dotIdx);
          const sub = fieldPart.slice(dotIdx + 1);
          const objKey = `${baseField}-${idx}`;
          const base = thresholdObjs[objKey] || { ...(record[baseField] || {}) };
          base[sub] = value;
          thresholdObjs[objKey] = base;
          nPending[`${fieldPart}-${idx}`] = true;
          nFields[`${baseField}-${idx}-f${sub}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
      Object.entries(thresholdObjs).forEach(([objKey, obj]) => { nLocal[objKey] = obj; });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try { return new Date(dateVal.$date || dateVal).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return String(dateVal); }
  };

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => {
      const t = s.trim();
      return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0;
    });
  };

  // ===== Build Chart Data =====
  const buildChartData = (record, idx) => {
    const categories = [];

    const buildEarBars = (thresholds, earKey, earLabel, catId, catName) => {
      if (!thresholds || typeof thresholds !== 'object') return;
      const bars = [];
      getFrequencyKeys(thresholds).forEach(freq => {
        const val = thresholds[freq];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const db = extractDbValue(val);
          const flabel = formatFreqLabel(freq);
          bars.push({
            key: `${earKey}-${freq}`, label: `${earLabel} ${flabel}`,
            value: db !== null ? `${db} dB` : String(val),
            percentage: db !== null ? Math.max(0, 100 - (db / 120) * 100) : 0,
            color: getThresholdColor(db), interpretation: getThresholdInterp(db),
          });
        }
      });
      if (bars.length > 0) categories.push({ id: catId, name: catName, description: 'dB HL (lower bar = worse)', bars });
    };

    buildEarBars(getFieldValue(record, 'rightEarThresholds', idx), 'right', 'Right', 'rightEar', 'Right Ear Thresholds');
    buildEarBars(getFieldValue(record, 'leftEarThresholds', idx), 'left', 'Left', 'leftEar', 'Left Ear Thresholds');

    const effectiveWordRecog = getFieldValue(record, 'wordRecognition', idx);
    if (effectiveWordRecog) {
      const bars = [];
      const rightPct = extractPercentage(effectiveWordRecog, 'right');
      const leftPct = extractPercentage(effectiveWordRecog, 'left');
      if (rightPct !== null) bars.push({ key: 'wr-right', label: 'Right Ear', value: `${rightPct}%`, percentage: rightPct, color: getRecogColor(rightPct), interpretation: getRecogInterp(rightPct) });
      if (leftPct !== null) bars.push({ key: 'wr-left', label: 'Left Ear', value: `${leftPct}%`, percentage: leftPct, color: getRecogColor(leftPct), interpretation: getRecogInterp(leftPct) });
      if (bars.length > 0) categories.push({ id: 'wordRecognition', name: 'Word Recognition', description: 'Higher = better', bars });
    }

    return categories;
  };

  // ===== Edit Helpers =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AudiometryReports] Cannot save — no record ID'); return; }
    const newValue = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = editTrackingKey || `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) {
      setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });
    // Stage the DRAFT in localStorage (fieldPart = bare field name, committed on Approve).
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = newValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Save one frequency of a dynamic-key threshold object to its nested dot-path,
  // preserving numeric typing (0 is valid) while keeping the object shape locally.
  // Save one frequency of a dynamic-key threshold object → stage a DRAFT locally (no DB write).
  // localStorage keeps the per-frequency sub-key across refresh; Approve commits each to its dot-path.
  const saveThreshold = useCallback((record, fieldName, freq, idx, sectionId) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AudiometryReports] Cannot save threshold — no record ID'); return; }
    const raw = editValue;
    const num = parseFloat(raw);
    const newValue = (raw !== '' && !isNaN(num) && String(num) === String(raw).trim()) ? num : raw;
    const objKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => {
      const baseObj = (prev[objKey] !== undefined ? prev[objKey] : record[fieldName]) || {};
      return { ...prev, [objKey]: { ...baseObj, [freq]: newValue } };
    });
    setPendingEdits(prev => ({ ...prev, [`${fieldName}.${freq}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}-f${freq}`]: 'edited' }));
    setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });
    // Stage the DRAFT: fieldPart = "field.<freq>" (committed to its nested dot-path on Approve).
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][`${fieldName}.${freq}`] = newValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    try {
      const recordId = getRecordId(record);
      if (!recordId) return;
      const sectionFields = SECTION_FIELDS[sectionId] || [];
      const suffix = `-${idx}`;
      // Pending keys for THIS record + section. fieldPart = "field" or nested "field.<sub>".
      const toCommit = Object.keys(pendingEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return sectionFields.includes(baseField);
      });
      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.<sub>"
        const dotIdx = fieldPart.indexOf('.');
        let payload;
        if (dotIdx === -1) {
          // Plain scalar/text field (value lives in localEdits under the same key)
          payload = { field: fieldPart, value: localEdits[editKey] };
        } else {
          // Nested dot-path (threshold frequency). The trailing segment is NOT a pure-numeric array
          // index (freq keys are e.g. "250Hz"/"250" addressing object keys), so we send the full
          // dot-path as `field` with NO arrayIndex — exactly mirroring the original saveThreshold PUT.
          const baseField = fieldPart.slice(0, dotIdx);
          const sub = fieldPart.slice(dotIdx + 1);
          const objKey = `${baseField}-${idx}`;
          const obj = localEdits[objKey] || {};
          payload = { field: fieldPart, value: obj[sub] };
        }
        const resp = await secureApiClient.put(`/api/edit/audiometry_reports/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the record/section approved (audit trail)
      await secureApiClient.put(`/api/edit/audiometry_reports/${recordId}/approve`, { sectionId, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[recordId]) {
        sectionFields.forEach(f => {
          Object.keys(store[recordId]).forEach(fp => {
            const base = fp.includes('.') ? fp.slice(0, fp.indexOf('.')) : fp;
            if (base === f) delete store[recordId][fp];
          });
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AudiometryReports] Approve failed:', err); }
  }, [pendingEdits, localEdits]);

  function reconstructFullText(sentences) {
    return sentences.map((s, i) => { const t = s.trim(); if (i < sentences.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' ');
  }

  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx, newSentenceText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const cleanNew = newSentenceText.trim();
    const cleanOld = (currentSentences[sentenceIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; }
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') {
      currentSentences.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(currentSentences);
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
      return;
    }
    let newText = cleanNew;
    if (newText && !newText.match(/[.!?;]$/)) newText += '.';
    currentSentences[sentenceIdx] = newText;
    const extraCount = newText.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    const fullText = reconstructFullText(currentSentences);
    setEditedSentences(prev => {
      const next = { ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' };
      for (let e = 1; e <= extraCount; e++) next[`${fieldName}-${idx}-s${sentenceIdx + e}`] = 'added';
      return next;
    });
    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ===== Search =====
  const highlightText = (text) => {
    if (!text) return '';
    const str = String(text);
    if (!searchTerm.trim()) return str;
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = str.split(regex);
    if (parts.length === 1) return str;
    return <>{parts.map((p, i) => regex.test(p) ? <mark key={i}>{p}</mark> : p)}</>;
  };

  const phraseMatch = (text, term) => {
    if (!term.trim()) return true;
    return String(text || '').toLowerCase().includes(term.toLowerCase().trim());
  };

  const shouldShowSection = (record, sectionTitle, contentParts, fieldNames) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f);
    const combined = [sectionTitle, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' ');
    return phraseMatch(combined, searchTerm);
  };

  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;

  const fieldMatches = (record, fieldName, idx) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const label = FIELD_LABELS[fieldName] || fieldName;
    return phraseMatch(label, searchTerm) || phraseMatch(getFieldValue(record, fieldName, idx), searchTerm);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Audiometry Report ${idx + 1}`;
      const chartData = buildChartData(record, idx);
      const chartText = chartData.flatMap(c => [c.name, ...c.bars.flatMap(b => [b.label, b.value, b.interpretation])]).join(' ');
      const allText = [
        title, formatDate(record.date), record.testType, record.hearingLossType,
        record.hearingLossSeverity, record.speechReception, record.wordRecognition,
        record.tympanometry, record.acousticReflex, record.interpretation,
        record.recommendations, record.notes, record.audiologist, record.facility,
        chartText,
        // Section titles
        'Record Information', 'Test Information', 'Audiogram Overview', 'Speech Results',
        'Middle Ear Function', 'Interpretation', 'Recommendations', 'Notes',
        // Field labels (so searching by label name works)
        ...Object.values(FIELD_LABELS),
      ].filter(Boolean).join(' ');
      const match = phraseMatch(allText, searchTerm);
      if (match && phraseMatch(title, searchTerm)) record._showAllSections = true;
      return match;
    });
  }, [records, searchTerm]);

  // ===== Section Edits & Approve =====
  const sectionHasEdits = (idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  };

  const renderApproveButton = (idx, sectionId) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    if (hasEdits) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sectionId); }}>Pending Approve</button>;
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  // ===== Render Helpers =====
  const renderEditableField = (record, fieldName, idx, sectionId, hideLabel) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !localEdits[`${fieldName}-${idx}`]) return null;
    const displayValue = String(value || '');
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div className={hideLabel ? undefined : 'rec-mini-card'}>
          {!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>}
          <div className="edit-field-container">
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={2} disabled={saving} />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={hideLabel ? undefined : 'rec-mini-card'}>
        {!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>}
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Dynamic-key threshold object: editable per-frequency dB value (number input).
  // 0 dB HL is a clinically meaningful value (normal hearing) and is NOT hidden.
  const renderEditableThresholds = (record, fieldName, idx, sectionId, earLabel) => {
    const thresholds = getFieldValue(record, fieldName, idx);
    if (!thresholds || typeof thresholds !== 'object') return null;
    const freqKeys = getFrequencyKeys(thresholds);
    if (freqKeys.length === 0) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(`${earLabel} Thresholds (dB HL)`)}</div>
        {freqKeys.map(freq => {
          const rawVal = thresholds[freq];
          const editKey = `${fieldName}.${freq}-${idx}`;
          const trackKey = `${fieldName}-${idx}-f${freq}`;
          const isEditing = editingField === editKey;
          const isEdited = editedFields[trackKey];
          const flabel = formatFreqLabel(freq);
          if (isEditing) {
            return (
              <div key={freq} className="edit-field-container">
                <input type="number" className="edit-textarea" value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveThreshold(record, fieldName, freq, idx, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                  autoFocus disabled={saving} />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => saveThreshold(record, fieldName, freq, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }
          const db = extractDbValue(rawVal);
          return (
            <div key={freq}>
              <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(String(rawVal ?? '')); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(`${flabel}: ${db !== null ? `${db} dB` : String(rawVal)}`)}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSentenceEditableField = (record, fieldName, idx, sectionId, hideLabel) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value) return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId, hideLabel);

    const visibleSentences = sentences.map((s, origIdx) => ({ text: s, _origIdx: origIdx })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName)) return true;
      return phraseMatch(item.text, searchTerm);
    });
    if (visibleSentences.length === 0) return null;

    return (
      <>
        {visibleSentences.map(({ text, _origIdx: sIdx }) => {
          const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const editStatus = editedSentences[sentenceKey];
          if (isEditing) {
            return (
              <div key={sIdx} className="rec-mini-card"><div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                  autoFocus rows={2} disabled={saving} />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div></div>
            );
          }
          return (
            <div key={sIdx} className="rec-mini-card">
              <div className={`numbered-row editable-row${editStatus ? ' modified' : ''}`} onClick={() => { setEditingField(sentenceKey); setEditValue(text.replace(/[.!?;]+$/, '')); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(text)}</span>
                  {!editStatus && <span className="edit-indicator">✎</span>}
                </div>
              </div>
              {editStatus && <div className={`modified-badge${editStatus === 'added' ? ' added' : ''}`}>{editStatus === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}
            </div>
          );
        })}
      </>
    );
  };

  // ===== pdfData Memo =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending plain-field draft stays OUT of the PDF until approved
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldName = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1), 10);
        if (recordIdx !== idx || !(fieldName in record)) return;
        // Threshold objects are stored under "field-idx" but staged pending as "field.<freq>-idx";
        // if any such sub-key is still pending, keep the whole object out of the PDF until approved.
        const hasPendingSub = Object.keys(pendingEdits).some(pk => pendingEdits[pk] && pk.startsWith(`${fieldName}.`) && pk.endsWith(`-${idx}`));
        if (hasPendingSub) return;
        merged[fieldName] = localEdits[key];
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ===== Copy =====
  const copyToClipboard = async (text, id) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
    catch (err) { console.error('Copy failed:', err); }
  };

  const copySectionText = (record, idx, sectionId) => {
    const pdfRecord = pdfData[idx] || record;
    if (sectionId === 'audiogramOverview') {
      let text = 'Audiogram Overview:\n';
      const chartData = buildChartData(pdfRecord, idx);
      chartData.forEach(cat => { text += `\n${cat.name}:\n`; cat.bars.forEach(b => { text += `  ${b.label}: ${b.value} - ${b.interpretation}\n`; }); });
      copyToClipboard(text.trim(), `section-audiogramOverview-${idx}`);
      return;
    }
    const fields = SECTION_FIELDS[sectionId] || [];
    let text = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = pdfRecord[f];
      if (!val) return;
      const sentences = splitBySentence(String(val));
      if (sentences.length > 1) { text += `${label}:\n`; sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; }); }
      else { text += `${label}: ${val}\n`; }
    });
    copyToClipboard(text.trim(), `section-${sectionId}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== AUDIOMETRY REPORTS ===\n\n';
    pdfData.forEach((record, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Audiometry Report ${idx + 1}\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n\n`;
      Object.entries(SECTION_FIELDS).forEach(([, fields]) => {
        fields.forEach(f => {
          const label = FIELD_LABELS[f] || f;
          const val = record[f];
          if (!val) return;
          text += `${label}: ${val}\n`;
        });
      });
      const chartData = buildChartData(record, idx);
      if (chartData.length > 0) {
        text += '\nAudiogram Overview:\n';
        chartData.forEach(cat => { text += `  ${cat.name}:\n`; cat.bars.forEach(b => { text += `    ${b.label}: ${b.value} - ${b.interpretation}\n`; }); });
      }
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sectionId, title, children) => {
    if (!children) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-${sectionId}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sectionId)}>
                {copiedId === `section-${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(idx, sectionId)}
            </div>
          </div>
          {children}
        </div>
      </div>
    );
  };

  // ===== Render =====
  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <article className="audiometry-reports-document">
        <header className="document-header"><h1 className="document-title">Audiometry Reports</h1></header>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="empty-state">No audiometry reports available.</div>
      </article>
    );
  }

  return (
    <article className="audiometry-reports-document">
      <header className="document-header">
        <h1 className="document-title">Audiometry Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<AudiometryReportsDocumentPDFTemplate document={pdfData} />} fileName="Audiometry_Reports.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const chartData = buildChartData(record, idx);

          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
                <div className="record-title-row"><h3 className="record-name">{highlightText(`Audiometry Report ${idx + 1}`)}</h3></div>
              </div>

              {/* Record Information — only show if at least one field has data */}
              {(() => {
                const hasData = [record.audiologist, record.facility].some(v => v && String(v).trim());
                if (!hasData) return null;
                if (!shouldShowSection(record, 'Record Information', [record.audiologist, record.facility].filter(Boolean), ['audiologist', 'facility'])) return null;
                const stm = sectionTitleMatches('Record Information');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return renderSection(record, idx, 'recordInfo', 'Record Information', <>
                  {(showAll || fieldMatches(record, 'audiologist', idx)) && renderEditableField(record, 'audiologist', idx, 'recordInfo')}
                  {(showAll || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}
                </>);
              })()}

              {/* Test Information */}
              {(() => {
                if (!shouldShowSection(record, 'Test Information', [record.testType, record.hearingLossType, record.hearingLossSeverity].filter(Boolean), ['testType', 'hearingLossType', 'hearingLossSeverity'])) return null;
                const stm = sectionTitleMatches('Test Information');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return renderSection(record, idx, 'testInfo', 'Test Information', <>
                  {(showAll || fieldMatches(record, 'testType', idx)) && renderEditableField(record, 'testType', idx, 'testInfo')}
                  {(showAll || fieldMatches(record, 'hearingLossType', idx)) && renderEditableField(record, 'hearingLossType', idx, 'testInfo')}
                  {(showAll || fieldMatches(record, 'hearingLossSeverity', idx)) && renderEditableField(record, 'hearingLossSeverity', idx, 'testInfo')}
                </>);
              })()}

              {/* Audiogram Overview — display-only bar charts */}
              {chartData.length > 0 && shouldShowSection(record, 'Audiogram Overview', chartData.flatMap(c => c.bars.map(b => `${b.label} ${b.value}`))) &&
                renderSection(record, idx, 'audiogramOverview', 'Audiogram Overview', <>
                  {renderEditableThresholds(record, 'rightEarThresholds', idx, 'audiogramOverview', 'Right Ear')}
                  {renderEditableThresholds(record, 'leftEarThresholds', idx, 'audiogramOverview', 'Left Ear')}
                  {chartData.map(category => (
                    <div key={category.id} className="chart-category">
                      <div className="category-header">
                        <span className="category-name">{highlightText(category.name)}</span>
                        <span className="category-description">{highlightText(category.description)}</span>
                      </div>
                      {category.bars.map(bar => (
                        <div key={bar.key} className="bar-chart-row">
                          <div className="bar-label">{highlightText(bar.label)}</div>
                          <div className="bar-container">
                            <div className="bar-background">
                              <div className="bar-fill" style={{ width: `${bar.percentage}%`, backgroundColor: bar.color }} />
                            </div>
                            <span className="bar-value" style={{ color: bar.color }}>{highlightText(bar.value)}</span>
                          </div>
                          <span className="bar-interpretation" style={{ color: bar.color }}>{highlightText(bar.interpretation)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </>)
              }

              {/* Speech Results */}
              {(() => {
                if (!shouldShowSection(record, 'Speech Results', [record.speechReception, record.wordRecognition].filter(Boolean), ['speechReception', 'wordRecognition'])) return null;
                const stm = sectionTitleMatches('Speech Results');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return renderSection(record, idx, 'speechResults', 'Speech Results', <>
                  {(showAll || fieldMatches(record, 'speechReception', idx)) && renderEditableField(record, 'speechReception', idx, 'speechResults')}
                  {(showAll || fieldMatches(record, 'wordRecognition', idx)) && renderEditableField(record, 'wordRecognition', idx, 'speechResults')}
                </>);
              })()}

              {/* Middle Ear Function */}
              {(() => {
                if (!shouldShowSection(record, 'Middle Ear Function', [record.tympanometry, record.acousticReflex].filter(Boolean), ['tympanometry', 'acousticReflex'])) return null;
                const stm = sectionTitleMatches('Middle Ear Function');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return renderSection(record, idx, 'middleEarFunction', 'Middle Ear Function', <>
                  {(showAll || fieldMatches(record, 'tympanometry', idx)) && renderEditableField(record, 'tympanometry', idx, 'middleEarFunction')}
                  {(showAll || fieldMatches(record, 'acousticReflex', idx)) && renderEditableField(record, 'acousticReflex', idx, 'middleEarFunction')}
                </>);
              })()}

              {/* Interpretation */}
              {getFieldValue(record, 'interpretation', idx) && shouldShowSection(record, 'Interpretation', [getFieldValue(record, 'interpretation', idx)]) &&
                renderSection(record, idx, 'interpretation', 'Interpretation', renderSentenceEditableField(record, 'interpretation', idx, 'interpretation', true))
              }

              {/* Recommendations */}
              {getFieldValue(record, 'recommendations', idx) && shouldShowSection(record, 'Recommendations', [getFieldValue(record, 'recommendations', idx)]) &&
                renderSection(record, idx, 'recommendations', 'Recommendations', renderSentenceEditableField(record, 'recommendations', idx, 'recommendations', true))
              }

              {/* Notes */}
              {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)]) &&
                renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))
              }
            </div>
          );
        })}
      </div>
    </article>
  );
};

export default AudiometryReportsDocument;
