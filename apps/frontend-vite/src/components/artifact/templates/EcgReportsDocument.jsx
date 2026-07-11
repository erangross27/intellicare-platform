import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import EcgReportsDocumentPDFTemplate from '../pdf-templates/EcgReportsDocumentPDFTemplate';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './EcgReportsDocument.css';

/**
 * EcgReportsDocument - February 2026 Rebuild
 *
 * Mini-card blue glow pattern with inline editing.
 * Editable: rhythm, prInterval, qrsComplex, qtInterval, qtcInterval,
 *           axis, stSegment, tWave, interpretation, cardiologist
 * Read-only: date, rate (numeric)
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [reportId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'ecg_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* Copy dividers (one-pass item 2) */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* rate === 0 is an extractor SENTINEL (a living ECG can't be 0 bpm; lowest real across the collection is 44) → hide. */
const rateShows = (v) => v !== null && v !== undefined && v !== '' && Number(v) !== 0;

/* number+unit stepper support — ECG interval strings ('165ms', '160 ms', '412 ms (normal)', '96 ms (normal, not wide)').
   splitNumberUnit returns {num, sep, unit} for a LEADING number + a DIGIT-FREE unit; null otherwise ('Normal QRS' → text). */
const MEASURE_FIELDS = ['prInterval', 'qrsComplex', 'qtInterval', 'qtcInterval'];
const splitNumberUnit = (v) => {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)(\s*)(\D.*)$/);
  if (!m) return null;
  if (/\d/.test(m[3])) return null; // unit itself contains a digit → not a clean number+unit, edit as text
  return { num: m[1], sep: m[2], unit: m[3].trim() };
};

/* stepFor: decimal-aware step (intervals + rate are integers here → 1). */
const stepFor = (numStr) => (String(numStr).includes('.') ? 0.1 : 1);

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* Enum dropdowns (BlueSelect). interpretation = ECG read category; off-scale narratives kept via enumOptionsWith. */
const ENUM_OPTIONS = { interpretation: ['Normal', 'Borderline', 'Abnormal'] };
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
// Case-INSENSITIVE (memory 6a4b38d2): normalize display casing, and never re-add a differently-cased value as a duplicate option.
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };
const enumOptionsWith = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; return base.some(o => o.toLowerCase() === String(cur ?? '').toLowerCase()) ? base : (cur ? [cur, ...base] : base); };

/* Canonical copy field block: sub-label + DASH divider + numbered value rows (one-pass items 2/3). */
const pushCopyField = (lines, label, values) => {
  const vals = (Array.isArray(values) ? values : [values]).filter(v => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return;
  lines.push('', label, COPY_LINE_DASH);
  vals.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
};

const EcgReportsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state -- per-template isolation (NO shared hooks)
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

  // 3-prop data unwrapping (standard pattern)
  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.ecg_reports) return Array.isArray(raw.ecg_reports) ? raw.ecg_reports : [raw.ecg_reports];
    if (raw?.documentData) {
      const docData = raw.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.ecg_reports) return Array.isArray(docData.ecg_reports) ? docData.ecg_reports : [docData.ecg_reports];
      return [docData];
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }, [templateData, docProp, data]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((report, idx) => {
      const rid = report && report._id ? (report._id.$oid || report._id) : null;
      const reportDrafts = rid ? store[rid] : null;
      if (!reportDrafts) return;
      Object.entries(reportDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark every section that owns this base field as edited so the row + badge render.
        Object.entries(SECTION_FIELDS).forEach(([sectionId, fields]) => {
          if (fields.includes(baseField)) nFields[`${sectionId}-${idx}`] = true;
        });
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

  // Split by sentence with title protection
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))[.;]\s+/)
      .map(s => s.replace(/[.;]$/, '').trim())
      .filter(Boolean);
  }, []);

  // Format date helper
  const formatDate = useCallback((date) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(date);
    }
  }, []);

  // Highlight search terms in text
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

  // --- Edit handlers ---

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
  const handleSaveField = useCallback((report, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const reportId = report._id ? (report._id.$oid || report._id) : null;
    if (!reportId) {
      console.error('[EcgReports] Cannot save -- no report _id');
      return;
    }
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval -> drop the section 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[reportId]) store[reportId] = {};
    store[reportId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this report to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (report, idx, sectionId) => {
    const reportId = report._id ? (report._id.$oid || report._id) : null;
    if (!reportId) {
      console.error('[EcgReports] Cannot approve -- no report _id');
      return;
    }
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(tail, 10);
        const resp = await secureApiClient.put(`/api/edit/ecg_reports/${reportId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail).
      await secureApiClient.put(`/api/edit/ecg_reports/${reportId}/approve`);

      // Clear pending -> committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this report's drafts from localStorage (now committed).
      const store = readDrafts();
      if (store[reportId]) { delete store[reportId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
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
      console.error('[EcgReports] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // Get effective field value (local edit overrides original)
  const getFieldValue = useCallback((report, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return report[fieldName];
  }, [localEdits]);

  // SECTION_FIELDS: maps sectionId -> field names for approve detection
  const SECTION_FIELDS = {
    basicInfo: ['date', 'rhythm', 'rate', 'cardiologist'],
    intervals: ['prInterval', 'qrsComplex', 'qtInterval', 'qtcInterval'],
    morphology: ['axis', 'stSegment', 'tWave'],
    interpretation: ['interpretation'],
  };

  const sectionHasEdits = useCallback((sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  }, [localEdits]);

  // pdfData -- merges localEdits into records for PDF + Copy All
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((report, idx) => {
      const merged = { ...report };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const reportIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (reportIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // Edit indicator component
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // Render a single editable field wrapped in rec-mini-card
  const renderEditableField = (report, idx, fieldName, label, displayValue, sectionId, copyId) => {
    if (!displayValue) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!report._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isFieldEdited = sectionWasEdited && editedSentences[`${fieldName}-${idx}-s0`] === 'edited' && statusOverrides[idx] !== 'approved';

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
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(report, fieldName, idx, sectionId);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(report, fieldName, idx, sectionId)} disabled={saving}>
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
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); copySection(`${label}\n${displayValue}`, copyId); }}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render an editable DATE field (BlueDatePicker) wrapped in rec-mini-card
  const renderDateField = (report, idx, fieldName, label, value, sectionId, copyId) => {
    if (!value) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!report._id;
    const isFieldEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const display = formatDate(value);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <BlueDatePicker
                value={editValue}
                onSelect={(iso) => setEditValue(iso || '')}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(report, fieldName, idx, sectionId, undefined, editValue ? `${editValue}T00:00:00.000Z` : '')}
                  disabled={saving}
                >
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
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, toInputDate(value))}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(display)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copySection(`${label}\n${display}`, copyId); }}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render an editable NUMBER field (−/+ stepper) wrapped in rec-mini-card
  const renderNumberField = (report, idx, fieldName, label, value, unit, sectionId, copyId) => {
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!report._id;
    const isFieldEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const display = unit ? `${value} ${unit}` : `${value}`;

    if (isEditing) {
      const cur = editValue;
      const base = cur === '' ? value : cur;
      const bump = (dir) => {
        let next = (parseFloat(base) || 0) + dir * stepFor(base);
        if (next < 0) next = 0;
        setEditValue(String(Math.round(next * 100) / 100));
      };
      const commit = () => handleSaveField(report, fieldName, idx, sectionId, undefined, cur === '' ? value : (parseFloat(cur) || 0));
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => bump(-1)} disabled={saving}>−</button>
                <input
                  type="text" inputMode="decimal" className="num-stepper-input" value={cur}
                  onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter') commit(); }}
                  disabled={saving}
                />
                {unit && <span className="num-stepper-unit">{unit}</span>}
                <button type="button" className="num-step" onClick={() => bump(1)} disabled={saving}>+</button>
              </div>
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={commit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, String(value))}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(display)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copySection(`${label}\n${display}`, copyId); }}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render an editable NUMBER+UNIT measurement (stepper on the number, unit chip). Text fallback for non-measure values.
  const renderMeasureField = (report, idx, fieldName, label, value, sectionId, copyId) => {
    if (!value) return null;
    const nu = splitNumberUnit(value);
    if (!nu) return renderEditableField(report, idx, fieldName, label, value, sectionId, copyId);
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!report._id;
    const isFieldEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      const cur = editValue;
      const base = cur === '' ? nu.num : cur;
      const rebuild = (numStr) => `${numStr}${nu.sep}${nu.unit}`;
      const bump = (dir) => {
        let next = (parseFloat(base) || 0) + dir * stepFor(base);
        if (next < 0) next = 0;
        setEditValue(String(Math.round(next * 100) / 100));
      };
      const commit = () => handleSaveField(report, fieldName, idx, sectionId, undefined, rebuild(cur === '' ? nu.num : cur));
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => bump(-1)} disabled={saving}>−</button>
                <input
                  type="text" inputMode="decimal" className="num-stepper-input" value={cur}
                  onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter') commit(); }}
                  disabled={saving}
                />
                <span className="num-stepper-unit">{nu.unit}</span>
                <button type="button" className="num-step" onClick={() => bump(1)} disabled={saving}>+</button>
              </div>
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={commit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, nu.num)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(value)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copySection(`${label}\n${value}`, copyId); }}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Render a SENTENCE-SPLIT field (per-sentence editable rows). showLabel=false for single-name sections.
  const renderSentenceField = (report, idx, fieldName, label, value, sectionId, copyId, showLabel = true) => {
    if (!value) return null;
    const canEdit = !!report._id;
    const fullEditKey = `${fieldName}-${idx}`;
    const sourceText = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : value;
    const sentences = splitBySentence(sourceText);
    if (sentences.length === 0) return null;

    return (
      <div className="rec-mini-card" key={fieldName}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const editKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === editKey;
          const isEdited = editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
          const reconstruct = () => {
            let edited = editValue.trim();
            if (edited && !/[.!?]$/.test(edited)) edited += '.';
            const updated = sentences.map((s, i) => {
              const t = i === sIdx ? edited : s;
              return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
            });
            return updated.join(' ');
          };

          if (isEditing) {
            return (
              <div key={sIdx} className="numbered-row edit-row">
                <div className="edit-field-container">
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelEdit();
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(report, fieldName, idx, sectionId, undefined, reconstruct(), sIdx);
                    }}
                    rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="edit-save-btn" onClick={() => handleSaveField(report, fieldName, idx, sectionId, undefined, reconstruct(), sIdx)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={sIdx}>
              <div
                className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited ? ' modified' : ''}`}
                style={{ marginBottom: sIdx < sentences.length - 1 ? '8px' : '0' }}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence.replace(/[.!?]+$/, '').trim(), sIdx)}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <div className="row-content">
                  <span className="content-value">{highlightText(sentence)}</span>
                  {canEdit && !isEdited && editIndicator}
                </div>
                <button
                  className={`copy-btn ${copiedId === `${copyId}-s${sIdx}` ? 'copied' : ''}`}
                  onClick={(e) => { e.stopPropagation(); copySection(sentence, `${copyId}-s${sIdx}`); }}
                >
                  {copiedId === `${copyId}-s${sIdx}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render an ENUM field (BlueSelect dropdown) wrapped in rec-mini-card. showLabel=false for single-name sections.
  const renderEnumField = (report, idx, fieldName, label, value, sectionId, copyId, showLabel = true) => {
    if (!value) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const canEdit = !!report._id;
    const isFieldEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const displayVal = enumCanonical(fieldName, value);
    const opts = enumOptionsWith(fieldName, displayVal);

    if (isEditing) {
      const cur = editValue || displayVal;
      return (
        <div className="rec-mini-card" key={fieldName}>
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <BlueSelect value={cur} options={opts} onChange={(v) => setEditValue(v)} />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(report, fieldName, idx, sectionId, undefined, cur)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div
          className={`numbered-row${canEdit ? ' editable-row' : ''}${isFieldEdited ? ' modified' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayVal)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(displayVal)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copySection(`${label}\n${displayVal}`, copyId); }}>
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // Section header with Copy Section + Approve
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
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
            onClick={() => handleApprove(records[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // shouldShowRow - checks if row should be visible based on search
  const shouldShowRow = useCallback((report, ...rowContent) => {
    if (!searchTerm.trim() || report._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of rowContent) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // Filter records based on search with 4-level filtering
  const filteredRecords = useMemo(() => {
    const recordsWithMeta = records.map((report, idx) => ({
      ...report,
      _originalIdx: idx,
      _recordNumber: idx + 1,
      _documentTitle: `ECG Report ${idx + 1}`,
      _showAllSections: false,
    }));

    if (!searchTerm.trim()) return recordsWithMeta;

    const searchLower = searchTerm.toLowerCase().trim();

    return recordsWithMeta.filter(record => {
      // Check document title match
      const titleLower = record._documentTitle.toLowerCase();
      if (titleLower.includes(searchLower) || searchLower.includes(titleLower) ||
          'ecg reports'.includes(searchLower) || searchLower.includes('ecg reports')) {
        record._showAllSections = true;
        return true;
      }

      // Build searchable text
      const searchableText = [
        record._documentTitle,
        'ECG Reports', 'ecg reports',
        'Basic Information', 'basic information',
        'Intervals', 'intervals',
        'Morphology', 'morphology',
        'Interpretation', 'interpretation',
        'ecg report', 'ekg', 'electrocardiogram',
        'rhythm', 'heart rate', 'rate',
        'pr interval', 'qrs complex', 'qt interval', 'qtc interval',
        'axis', 'st segment', 't wave',
        'interpreted by', 'cardiologist',
        formatDate(record.date), record.date,
        record.rhythm, record.cardiologist,
        record.rate, record.prInterval, record.qrsComplex,
        record.qtInterval, record.qtcInterval,
        record.axis, record.stSegment, record.tWave,
        record.interpretation,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchLower);
    });
  }, [records, searchTerm, formatDate]);

  // Copy function
  const copySection = useCallback(async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(sectionId);
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
      setCopiedId(sectionId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // Copy All - canonical (EQ/DASH dividers, numbered rows, single-name Interpretation, empty-section guard). Uses pdfData.
  const copyAll = useCallback(() => {
    const out = ['ECG Reports', COPY_LINE_EQ, ''];
    pdfData.forEach((report, idx) => {
      out.push(`ECG Report ${idx + 1}`, COPY_LINE_EQ);

      const basic = ['Basic Information', COPY_LINE_EQ];
      if (report.date) pushCopyField(basic, 'Date', formatDate(report.date));
      if (report.rhythm) pushCopyField(basic, 'Rhythm', report.rhythm);
      if (rateShows(report.rate)) pushCopyField(basic, 'Heart Rate', `${report.rate} bpm`);
      if (report.cardiologist) pushCopyField(basic, 'Interpreted By', report.cardiologist);
      if (basic.length > 2) out.push('', ...basic);

      const intervals = ['Intervals', COPY_LINE_EQ];
      if (report.prInterval) pushCopyField(intervals, 'PR Interval', report.prInterval);
      if (report.qrsComplex) pushCopyField(intervals, 'QRS Complex', report.qrsComplex);
      if (report.qtInterval) pushCopyField(intervals, 'QT Interval', report.qtInterval);
      if (report.qtcInterval) pushCopyField(intervals, 'QTc Interval', report.qtcInterval);
      if (intervals.length > 2) out.push('', ...intervals);

      const morph = ['Morphology', COPY_LINE_EQ];
      if (report.axis) pushCopyField(morph, 'Axis', report.axis);
      if (report.stSegment) pushCopyField(morph, 'ST Segment', splitBySentence(report.stSegment));
      if (report.tWave) pushCopyField(morph, 'T Wave', splitBySentence(report.tWave));
      if (morph.length > 2) out.push('', ...morph);

      const interp = ['Interpretation', COPY_LINE_EQ];
      if (report.interpretation) interp.push(`1. ${enumCanonical('interpretation', report.interpretation)}`);
      if (interp.length > 2) out.push('', ...interp);

      out.push('');
    });
    copySection(out.join('\n'), 'all');
  }, [pdfData, formatDate, splitBySentence, copySection]);

  // Early return for no data
  if (!records || records.length === 0) {
    return (
      <div className="ecg-reports-document">
        <div className="no-results">No ECG reports available.</div>
      </div>
    );
  }

  return (
    <div className="ecg-reports-document">
      {/* Document Header - two-row layout */}
      <div className="document-header">
        <h2 className="document-title">ECG Reports</h2>
        <div className="header-actions">
          <button
            className={`action-btn ${copiedId === 'all' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copiedId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<EcgReportsDocumentPDFTemplate document={pdfData} />}
            fileName="Ecg_Reports.pdf"
            className="action-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search ECG reports..."
      />

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <div className="no-results">No ECG reports match your search.</div>
      ) : (
        filteredRecords.map((report) => {
          const idx = report._originalIdx;
          const recordId = report._id || `report-${idx}`;
          const showAll = !searchTerm.trim() || report._showAllSections;

          // Section title matches for Level 2
          const basicInfoTitleMatches = searchTerm && shouldShowRow(report, 'Basic Information', 'basic information');
          const intervalsTitleMatches = searchTerm && shouldShowRow(report, 'Intervals', 'intervals');
          const morphologyTitleMatches = searchTerm && shouldShowRow(report, 'Morphology', 'morphology');
          const interpretationTitleMatches = searchTerm && shouldShowRow(report, 'Interpretation', 'interpretation');

          // Get effective field values
          const dateVal = getFieldValue(report, 'date', idx);
          const rateVal = getFieldValue(report, 'rate', idx);
          const rhythmVal = getFieldValue(report, 'rhythm', idx);
          const prIntervalVal = getFieldValue(report, 'prInterval', idx);
          const qrsComplexVal = getFieldValue(report, 'qrsComplex', idx);
          const qtIntervalVal = getFieldValue(report, 'qtInterval', idx);
          const qtcIntervalVal = getFieldValue(report, 'qtcInterval', idx);
          const axisVal = getFieldValue(report, 'axis', idx);
          const stSegmentVal = getFieldValue(report, 'stSegment', idx);
          const tWaveVal = getFieldValue(report, 'tWave', idx);
          const interpretationVal = getFieldValue(report, 'interpretation', idx);
          const cardiologistVal = getFieldValue(report, 'cardiologist', idx);

          // Data existence guards + section visibility
          const hasBasicInfo = dateVal || rhythmVal || rateShows(rateVal) || cardiologistVal;
          const showBasicInfo = hasBasicInfo && (showAll || basicInfoTitleMatches || shouldShowRow(report, 'Basic Information', 'Date', formatDate(dateVal), 'Rhythm', rhythmVal, 'Heart Rate', rateVal, 'Cardiologist', cardiologistVal));

          const hasIntervals = prIntervalVal || qrsComplexVal || qtIntervalVal || qtcIntervalVal;
          const showIntervals = hasIntervals && (showAll || intervalsTitleMatches || shouldShowRow(report, 'Intervals', 'PR Interval', prIntervalVal, 'QRS Complex', qrsComplexVal, 'QT Interval', qtIntervalVal, 'QTc Interval', qtcIntervalVal));

          const hasMorphology = axisVal || stSegmentVal || tWaveVal;
          const showMorphology = hasMorphology && (showAll || morphologyTitleMatches || shouldShowRow(report, 'Morphology', 'Axis', axisVal, 'ST Segment', stSegmentVal, 'T Wave', tWaveVal));

          const hasInterpretation = !!interpretationVal;
          const showInterpretation = hasInterpretation && (showAll || interpretationTitleMatches || shouldShowRow(report, 'Interpretation', interpretationVal));

          return (
            <div key={recordId} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <h3 className="record-title">{highlightText(`ECG Report ${report._recordNumber}`)}</h3>
              </div>

              {/* Basic Information */}
              {showBasicInfo && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Basic Information', `${recordId}-basicInfo`, () => {
                      const lines = ['Basic Information', COPY_LINE_EQ];
                      const r = pdfData[idx] || report;
                      if (r.date) pushCopyField(lines, 'Date', formatDate(r.date));
                      if (r.rhythm) pushCopyField(lines, 'Rhythm', r.rhythm);
                      if (rateShows(r.rate)) pushCopyField(lines, 'Heart Rate', `${r.rate} bpm`);
                      if (r.cardiologist) pushCopyField(lines, 'Interpreted By', r.cardiologist);
                      copySection(lines.join('\n'), `${recordId}-basicInfo`);
                    }, idx, 'basicInfo')}

                    {dateVal && (showAll || basicInfoTitleMatches || shouldShowRow(report, 'Date', formatDate(dateVal))) &&
                      renderDateField(report, idx, 'date', 'Date', dateVal, 'basicInfo', `${recordId}-date`)
                    }

                    {rhythmVal && (showAll || basicInfoTitleMatches || shouldShowRow(report, 'Rhythm', rhythmVal)) &&
                      renderEditableField(report, idx, 'rhythm', 'Rhythm', rhythmVal, 'basicInfo', `${recordId}-rhythm`)
                    }

                    {rateShows(rateVal) && (showAll || basicInfoTitleMatches || shouldShowRow(report, 'Heart Rate', 'Rate', rateVal)) &&
                      renderNumberField(report, idx, 'rate', 'Heart Rate', rateVal, 'bpm', 'basicInfo', `${recordId}-rate`)
                    }

                    {cardiologistVal && (showAll || basicInfoTitleMatches || shouldShowRow(report, 'Cardiologist', 'Interpreted By', cardiologistVal)) &&
                      renderEditableField(report, idx, 'cardiologist', 'Interpreted By', cardiologistVal, 'basicInfo', `${recordId}-cardiologist`)
                    }
                  </div>
                </div>
              )}

              {/* Intervals */}
              {showIntervals && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Intervals', `${recordId}-intervals`, () => {
                      const lines = ['Intervals', COPY_LINE_EQ];
                      const r = pdfData[idx] || report;
                      if (r.prInterval) pushCopyField(lines, 'PR Interval', r.prInterval);
                      if (r.qrsComplex) pushCopyField(lines, 'QRS Complex', r.qrsComplex);
                      if (r.qtInterval) pushCopyField(lines, 'QT Interval', r.qtInterval);
                      if (r.qtcInterval) pushCopyField(lines, 'QTc Interval', r.qtcInterval);
                      copySection(lines.join('\n'), `${recordId}-intervals`);
                    }, idx, 'intervals')}

                    {prIntervalVal && (showAll || intervalsTitleMatches || shouldShowRow(report, 'PR Interval', prIntervalVal)) &&
                      renderMeasureField(report, idx, 'prInterval', 'PR Interval', prIntervalVal, 'intervals', `${recordId}-pr`)
                    }

                    {qrsComplexVal && (showAll || intervalsTitleMatches || shouldShowRow(report, 'QRS Complex', 'QRS', qrsComplexVal)) &&
                      renderMeasureField(report, idx, 'qrsComplex', 'QRS Complex', qrsComplexVal, 'intervals', `${recordId}-qrs`)
                    }

                    {qtIntervalVal && (showAll || intervalsTitleMatches || shouldShowRow(report, 'QT Interval', qtIntervalVal)) &&
                      renderMeasureField(report, idx, 'qtInterval', 'QT Interval', qtIntervalVal, 'intervals', `${recordId}-qt`)
                    }

                    {qtcIntervalVal && (showAll || intervalsTitleMatches || shouldShowRow(report, 'QTc Interval', 'Corrected QT', qtcIntervalVal)) &&
                      renderMeasureField(report, idx, 'qtcInterval', 'QTc Interval', qtcIntervalVal, 'intervals', `${recordId}-qtc`)
                    }
                  </div>
                </div>
              )}

              {/* Morphology */}
              {showMorphology && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Morphology', `${recordId}-morphology`, () => {
                      const lines = ['Morphology', COPY_LINE_EQ];
                      const r = pdfData[idx] || report;
                      if (r.axis) pushCopyField(lines, 'Axis', r.axis);
                      if (r.stSegment) pushCopyField(lines, 'ST Segment', splitBySentence(r.stSegment));
                      if (r.tWave) pushCopyField(lines, 'T Wave', splitBySentence(r.tWave));
                      copySection(lines.join('\n'), `${recordId}-morphology`);
                    }, idx, 'morphology')}

                    {axisVal && (showAll || morphologyTitleMatches || shouldShowRow(report, 'Axis', 'Axis Deviation', axisVal)) &&
                      renderEditableField(report, idx, 'axis', 'Axis', axisVal, 'morphology', `${recordId}-axis`)
                    }

                    {stSegmentVal && (showAll || morphologyTitleMatches || shouldShowRow(report, 'ST Segment', 'ST', stSegmentVal)) &&
                      renderSentenceField(report, idx, 'stSegment', 'ST Segment', stSegmentVal, 'morphology', `${recordId}-st`, true)
                    }

                    {tWaveVal && (showAll || morphologyTitleMatches || shouldShowRow(report, 'T Wave', tWaveVal)) &&
                      renderSentenceField(report, idx, 'tWave', 'T Wave', tWaveVal, 'morphology', `${recordId}-twave`, true)
                    }
                  </div>
                </div>
              )}

              {/* Interpretation - per-sentence editing, Single-Name Section (no duplicate label) */}
              {showInterpretation && (
                <div className="section">
                  <div className="mini-cards-container">
                    {renderSectionHeader('Interpretation', `${recordId}-interpretation`, () => {
                      const r = pdfData[idx] || report;
                      const lines = ['Interpretation', COPY_LINE_EQ];
                      if (r.interpretation) lines.push(`1. ${enumCanonical('interpretation', r.interpretation)}`);
                      copySection(lines.join('\n'), `${recordId}-interpretation`);
                    }, idx, 'interpretation')}

                    {interpretationVal && (showAll || interpretationTitleMatches || shouldShowRow(report, interpretationVal)) &&
                      renderEnumField(report, idx, 'interpretation', 'Interpretation', interpretationVal, 'interpretation', `${recordId}-interp`, false)
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default EcgReportsDocument;
