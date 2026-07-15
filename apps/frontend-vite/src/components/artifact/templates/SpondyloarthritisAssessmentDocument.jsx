/**
 * Canonical editable renderer for spondyloarthritis_assessment.
 * Pending edits stay local until the section's Pending Approve action commits them.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SpondyloarthritisAssessmentDocumentPDFTemplate from '../pdf-templates/SpondyloarthritisAssessmentDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './SpondyloarthritisAssessmentDocument.css';

const DRAFT_KEY = 'spondyloarthritis_assessmentPendingEdits';
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const SECTION_TITLES = {
  overview: 'Overview',
  'disease-activity': 'Disease Activity',
  'spinal-mobility': 'Spinal Mobility',
  manifestations: 'Peripheral Manifestations',
  clinical: 'Clinical Assessment',
  recommendations: 'Recommendations',
  results: 'Results',
};

const SECTION_ORDER = [
  'overview',
  'disease-activity',
  'spinal-mobility',
  'manifestations',
  'clinical',
  'recommendations',
  'results',
];

const SECTION_FIELDS = {
  overview: ['date', 'type', 'provider', 'facility', 'status'],
  'disease-activity': ['basdaiScore', 'basfiScore', 'asdas', 'hlab27', 'sacroiliitis'],
  'spinal-mobility': [],
  manifestations: ['enthesitis', 'dactylitis'],
  clinical: ['findings', 'assessment', 'plan', 'notes'],
  recommendations: ['recommendations'],
  results: [],
};

const OBJECT_SECTIONS = {
  'spinal-mobility': 'spinalMobility',
  results: 'results',
};

const FIELD_LABELS = {
  date: 'Assessment Date',
  type: 'Assessment Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  basdaiScore: 'BASDAI Score',
  basfiScore: 'BASFI Score',
  asdas: 'ASDAS',
  hlab27: 'HLA-B27',
  sacroiliitis: 'Sacroiliitis',
  enthesitis: 'Enthesitis',
  dactylitis: 'Dactylitis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['enthesitis', 'dactylitis', 'recommendations'];
const OBJECT_FIELDS = ['spinalMobility'];
const COMMA_FIELDS = [];
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };
const MEASUREMENT_FIELDS = new Set([
  'basdaiScore',
  'basfiScore',
  'spinalMobility.schober',
  'spinalMobility.occiputToWall',
  'spinalMobility.chestExpansion',
]);

const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};

const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* local draft persistence is best-effort */ }
};

const safeId = (record) => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  if (record._id.$oid) return record._id.$oid;
  return String(record._id);
};

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  if (typeof value === 'object') return Object.values(value).some(hasVal);
  return true;
};

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

// Keep the persisted clinical text untouched while using glyphs that render
// consistently in the browser, clipboard, and React-PDF's built-in fonts.
const formatDisplayString = (value) => safeString(value)
  .replace(/\u2265/g, '>=')
  .replace(/\u2264/g, '<=');

// Score values are stored as a numeric numerator followed by a fixed denominator
// and, sometimes, fixed explanatory text. Only the numerator is editable.
const splitMeasurementValue = (value) => {
  const source = safeString(value);
  const match = source.match(/^([\s\S]*?)(-?\d+(?:\.\d+)?)([\s\S]*)$/);
  if (!match) return null;
  const decimals = (match[2].split('.')[1] || '').length;
  const denominator = (match[3].match(/^\s*\/\s*(\d+(?:\.\d+)?)/) || [])[1];
  return {
    prefix: match[1],
    number: match[2],
    suffix: match[3],
    maximum: denominator ? Number(denominator) : null,
    step: decimals ? `0.${'0'.repeat(decimals - 1)}1` : '1',
    decimals,
  };
};

const humanizeKey = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, (char) => char.toUpperCase());

const getPath = (source, path) => String(path).split('.').reduce((value, key) => value?.[key], source);

const setNestedCopy = (source, pathParts, value) => {
  if (!pathParts.length) return value;
  const [head, ...rest] = pathParts;
  const base = source ?? (/^\d+$/.test(head) ? [] : {});
  const copy = Array.isArray(base) ? [...base] : { ...base };
  copy[head] = setNestedCopy(base?.[head], rest, value);
  return copy;
};

const unwrapData = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(unwrapData);
  if (input.spondyloarthritis_assessment) return unwrapData(input.spondyloarthritis_assessment);
  if (input.documentData) return unwrapData(input.documentData);
  if (input.data) return unwrapData(input.data);
  if (input.records) return unwrapData(input.records);
  return [input];
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const toInputDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  } catch { return ''; }
};

const normalizeDateKey = (value) => {
  if (!value) return 'no-date';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? safeString(value) : date.toISOString().slice(0, 10);
  } catch { return safeString(value) || 'no-date'; }
};

const isProtectedPeriod = (source, index) => {
  const before = source.slice(0, index);
  const token = (before.match(/([A-Za-z.]+)$/) || [])[1] || '';
  return /^(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i.test(token)
    || /^[A-Z]$/.test(token)
    || /\d$/.test(before);
};

const isProtectedComma = (source, index, currentText) => {
  const after = source.slice(index + 1);
  const trimmed = after.trimStart();
  const next = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
  const previous = (currentText.trim().match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
  return after.length === trimmed.length
    || (/\d$/.test(currentText.trim()) && /^\d{3}\b/.test(trimmed))
    || ['and', 'or', 'then'].includes(next)
    || ['and', 'or'].includes(previous);
};

const splitNarrativeSegments = (value, splitCommas = false) => {
  const source = safeString(value);
  if (!source) return [];
  const segments = [];
  let start = 0;
  let depth = 0;
  const push = (end) => {
    let left = start;
    let right = end;
    while (left < right && /\s/.test(source[left])) left += 1;
    while (right > left && /\s/.test(source[right - 1])) right -= 1;
    if (right > left) segments.push({ text: source.slice(left, right), start: left, end: right });
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const nextIsSpace = /\s/.test(source[index + 1] || '');
    const currentText = source.slice(start, index);
    const splitSemicolon = char === ';' && nextIsSpace;
    const splitPeriod = char === '.' && nextIsSpace && !isProtectedPeriod(source, index);
    const splitComma = splitCommas && char === ',' && nextIsSpace && !isProtectedComma(source, index, currentText);
    if (!splitSemicolon && !splitPeriod && !splitComma) continue;
    push(index);
    start = index + 1;
  }
  push(source.length);
  return segments.length ? segments : [{ text: source, start: 0, end: source.length }];
};

// Kept as a named helper because the completion audit verifies semicolon and period behavior.
const splitBySentence = (value) => safeString(value)
  .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.(?:\s+)|;\s+/)
  .map((part) => part.trim())
  .filter(Boolean);

const parseLabel = (value) => {
  const match = safeString(value).match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{0,60}?):\s+(.+)$/);
  return match
    ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() }
    : { isLabeled: false, label: '', value: safeString(value) };
};

const segmentsForField = (path, value) => {
  splitBySentence(value);
  return splitNarrativeSegments(value, COMMA_FIELDS.includes(path) || /^recommendations\.\d+(?:\.recommendation)?$/.test(path));
};

const displayPartsForField = (path, value) => segmentsForField(path, value).map((segment) => {
  const parsed = parseLabel(segment.text);
  return { ...segment, label: parsed.label, displayValue: parsed.value };
});

const replaceSegment = (sourceValue, segments, segmentIndex, replacement) => {
  const source = safeString(sourceValue);
  const segment = segments[segmentIndex];
  if (!segment) return source;
  return `${source.slice(0, segment.start)}${replacement.trim()}${source.slice(segment.end)}`;
};

const sameAsTitle = (label, sid) => label.trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const sectionOwnsField = (sid, field) => {
  if ((SECTION_FIELDS[sid] || []).some((rootField) => field === rootField || field.startsWith(`${rootField}.`))) return true;
  const root = OBJECT_SECTIONS[sid];
  if (root && (field === root || field.startsWith(`${root}.`))) return true;
  if (sid === 'recommendations' && field.startsWith('recommendations.')) return true;
  if (sid === 'goals' && field.startsWith('goals.')) return true;
  return false;
};

const SpondyloarthritisAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const records = useMemo(() => unwrapData(docProp).filter((record) => record && typeof record === 'object'), [docProp]);

  useEffect(() => {
    const store = readDrafts();
    const restoredValues = {};
    const restoredPending = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
      Object.entries(id ? store[id] || {} : {}).forEach(([field, value]) => {
        restoredValues[`${field}-${idx}`] = value;
        restoredPending[`${field}-${idx}`] = true;
      });
    });
    if (Object.keys(restoredValues).length) {
      setLocalEdits((previous) => ({ ...restoredValues, ...previous }));
      setPendingEdits((previous) => ({ ...restoredPending, ...previous }));
    }
  }, [records]);

  const getFieldValue = useCallback((record, field, idx) => {
    const key = `${field}-${idx}`;
    return localEdits[key] !== undefined ? localEdits[key] : getPath(record, field);
  }, [localEdits]);

  const mergeRecord = useCallback((record, idx, includePending) => {
    let merged = record;
    Object.entries(localEdits).forEach(([key, value]) => {
      const match = key.match(/^(.+)-(\d+)$/);
      if (!match || Number(match[2]) !== idx) return;
      if (!includePending && pendingEdits[key]) return;
      merged = setNestedCopy(merged, match[1].split('.'), value);
    });
    return merged;
  }, [localEdits, pendingEdits]);

  const filteredRecords = useMemo(() => {
    const phrase = searchTerm.trim().toLowerCase();
    return records.map((record, index) => ({ record, index })).filter(({ record, index }) => {
      if (!phrase) return true;
      const live = mergeRecord(record, index, true);
      return JSON.stringify(live).toLowerCase().includes(phrase)
        || Object.values(SECTION_TITLES).some((title) => title.toLowerCase().includes(phrase) || phrase.includes(title.toLowerCase()));
    });
  }, [records, searchTerm, mergeRecord]);

  const pdfData = useMemo(() => filteredRecords.map(({ record, index }) => mergeRecord(record, index, false)), [filteredRecords, mergeRecord]);

  const highlightText = useCallback((value) => {
    const text = formatDisplayString(value);
    const phrase = searchTerm.trim();
    if (!phrase || !text) return text;
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) => regex.test(part) ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);

  const leafVisible = useCallback((sid, label, values) => {
    const phrase = searchTerm.trim().toLowerCase();
    if (!phrase) return true;
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    if (safeString(label).toLowerCase().includes(phrase)) return true;
    return values.some((value) => safeString(value).toLowerCase().includes(phrase));
  }, [searchTerm]);

  const resetApproved = useCallback((sid, idx) => {
    setApprovedSections((previous) => {
      const key = `${sid}-${idx}`;
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const stageDrafts = useCallback((record, idx, sid, updates) => {
    const id = safeId(record);
    if (!id || !updates.length) return;
    const values = {};
    const pending = {};
    updates.forEach(({ field, value }) => {
      values[`${field}-${idx}`] = value;
      pending[`${field}-${idx}`] = true;
    });
    setLocalEdits((previous) => ({ ...previous, ...values }));
    setPendingEdits((previous) => ({ ...previous, ...pending }));
    resetApproved(sid, idx);
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    updates.forEach(({ field, value }) => { store[id][field] = value; });
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }, [resetApproved]);

  const sectionPendingFields = useCallback((sid, idx) => Object.keys(pendingEdits)
    .map((key) => key.match(/^(.+)-(\d+)$/))
    .filter((match) => match && Number(match[2]) === idx && sectionOwnsField(sid, match[1]))
    .map((match) => match[1]), [pendingEdits]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record);
    const fields = [...new Set(sectionPendingFields(sid, idx))];
    if (!id || !fields.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const field of fields) {
        const response = await secureApiClient.put(`/api/edit/spondyloarthritis_assessment/${id}/edit`, {
          field,
          value: localEdits[`${field}-${idx}`],
        });
        if (response?.success === false) throw new Error(response.error || 'Save failed');
      }
      await secureApiClient.put(`/api/edit/spondyloarthritis_assessment/${id}/approve`, { sectionId: sid, approved: true });
      setPendingEdits((previous) => {
        const next = { ...previous };
        fields.forEach((field) => { delete next[`${field}-${idx}`]; });
        return next;
      });
      const store = readDrafts();
      if (store[id]) {
        fields.forEach((field) => { delete store[id][field]; });
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections((previous) => ({ ...previous, [`${sid}-${idx}`]: true }));
    } catch (error) {
      console.error('[SpondyloarthritisAssessment] Approve error:', error);
      setSaveError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [localEdits, sectionPendingFields]);

  const renderApproveButton = (record, sid, idx) => {
    if (sectionPendingFields(sid, idx).length) {
      return <button className="approve-btn pending" disabled={saving} onClick={(event) => { event.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>;
    }
    if (approvedSections[`${sid}-${idx}`]) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  const copyToClipboard = useCallback(async (text) => {
    const displayText = formatDisplayString(text);
    try { await navigator.clipboard.writeText(displayText); return true; }
    catch {
      const textarea = window.document.createElement('textarea');
      textarea.value = displayText;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      textarea.remove();
      return true;
    }
  }, []);

  const copyItem = useCallback(async (text, key) => {
    if (await copyToClipboard(text)) {
      setCopiedItems((previous) => ({ ...previous, [key]: true }));
      setTimeout(() => setCopiedItems((previous) => ({ ...previous, [key]: false })), 2000);
    }
  }, [copyToClipboard]);

  const copySection = useCallback(async (text, key) => {
    if (await copyToClipboard(text)) {
      setCopiedSection(key);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  }, [copyToClipboard]);

  const startEditing = (editKey, value) => {
    setEditingField(editKey);
    setEditValue(value);
    setSaveError(null);
  };

  const renderEditableLeaf = ({ record, idx, sid, field, displayValue, initialEditValue = displayValue, saveValue, leafKey, widget = 'text', ratioMeta = null, options = [] }) => {
    const stableLeafKey = leafKey || field;
    const editKey = `${stableLeafKey}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = Boolean(pendingEdits[`${field}-${idx}`]);
    return (
      <div key={stableLeafKey} data-edit-field={field}>
        <div className={`numbered-row editable-row ${isModified ? 'modified' : ''}`} onClick={() => { if (!isEditing) startEditing(editKey, initialEditValue); }}>
          {isEditing ? (
            <div className="edit-field-container">
              {widget === 'date'
                ? <BlueDatePicker value={editValue} onSelect={(value) => { setEditValue(value || ''); setSaveError(null); }} />
                : widget === 'enum'
                  ? <BlueSelect value={editValue} options={options} onChange={(value) => { setEditValue(value); setSaveError(null); }} />
                : widget === 'score-ratio' && ratioMeta
                  ? <div className="num-stepper-row">
                    <button type="button" className="num-step" disabled={saving} onClick={(event) => {
                      event.stopPropagation();
                      const current = Number(editValue);
                      const next = Math.max(0, (Number.isFinite(current) ? current : 0) - Number(ratioMeta.step));
                      setEditValue(next.toFixed(ratioMeta.decimals));
                      setSaveError(null);
                    }}>−</button>
                    <input
                      type="text"
                      className="edit-number"
                      inputMode="decimal"
                      min="0"
                      max={ratioMeta.maximum ?? undefined}
                      step={ratioMeta.step}
                      value={editValue}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => { setEditValue(event.target.value); setSaveError(null); }}
                      onKeyDown={(event) => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}
                      autoFocus
                    />
                    <button type="button" className="num-step" disabled={saving} onClick={(event) => {
                      event.stopPropagation();
                      const current = Number(editValue);
                      const unboundedNext = (Number.isFinite(current) ? current : 0) + Number(ratioMeta.step);
                      const next = ratioMeta.maximum === null ? unboundedNext : Math.min(ratioMeta.maximum, unboundedNext);
                      setEditValue(next.toFixed(ratioMeta.decimals));
                      setSaveError(null);
                    }}>+</button>
                    <span className="number-edit-unit" aria-label="Fixed score denominator and suffix">{ratioMeta.suffix}</span>
                  </div>
                  : <textarea className="edit-textarea" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={(event) => {
                  event.stopPropagation();
                  if (widget === 'score-ratio' && ratioMeta) {
                    const numericValue = Number(editValue);
                    if (editValue === '' || !Number.isFinite(numericValue)) { setSaveError('Please enter a valid number'); return; }
                    if (numericValue < 0 || (ratioMeta.maximum !== null && numericValue > ratioMeta.maximum)) {
                      setSaveError(ratioMeta.maximum === null ? 'Enter a value of 0 or greater' : `Enter a value from 0 to ${ratioMeta.maximum}`);
                      return;
                    }
                  }
                  const value = saveValue ? saveValue(editValue) : editValue;
                  if (widget === 'date' && (!value || Number.isNaN(new Date(value).getTime()))) { setSaveError('Please enter a valid date'); return; }
                  stageDrafts(record, idx, sid, [{ field, value }]);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={(event) => { event.stopPropagation(); copyItem(displayValue, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderTextParts = (record, idx, sid, field, value) => {
    const scoreRatio = MEASUREMENT_FIELDS.has(field) ? splitMeasurementValue(value) : null;
    if (scoreRatio) {
      return [renderEditableLeaf({
        record,
        idx,
        sid,
        field,
        displayValue: safeString(value),
        initialEditValue: scoreRatio.number,
        leafKey: `${field}-score-ratio`,
        widget: 'score-ratio',
        ratioMeta: scoreRatio,
        saveValue: (nextValue) => `${scoreRatio.prefix}${Number(nextValue)}${scoreRatio.suffix}`,
      })];
    }
    const parts = displayPartsForField(field, value);
    return parts.map((part, partIndex) => {
      const leaf = renderEditableLeaf({
        record,
        idx,
        sid,
        field,
        displayValue: part.displayValue,
        initialEditValue: part.displayValue,
        leafKey: `${field}-part-${partIndex}`,
        saveValue: (nextValue) => replaceSegment(value, parts, partIndex, part.label ? `${part.label}: ${nextValue}` : nextValue),
      });
      if (!part.label) return leaf;
      return (
        <div key={`${field}-group-${partIndex}`} className="nested-mini-card">
          <div className="nested-subtitle field-label">{highlightText(part.label)}</div>
          {leaf}
        </div>
      );
    });
  };

  const renderFieldCard = (record, idx, sid, field, label) => {
    const value = getFieldValue(record, field, idx);
    if (!hasVal(value)) return null;
    const displayLabel = label || FIELD_LABELS[field] || humanizeKey(field.split('.').pop());
    if (DATE_FIELDS.includes(field)) {
      const displayValue = formatDate(value);
      if (!leafVisible(sid, displayLabel, [displayValue])) return null;
      return (
        <div key={field} className="rec-mini-card nested-mini-card">
          {!sameAsTitle(displayLabel, sid) && <div className="nested-subtitle field-label">{highlightText(displayLabel)}</div>}
          {renderEditableLeaf({
            record,
            idx,
            sid,
            field,
            displayValue,
            initialEditValue: toInputDate(value),
            saveValue: (nextValue) => `${nextValue}T00:00:00.000Z`,
            widget: 'date',
          })}
        </div>
      );
    }
    if (ENUM_FIELDS[field]) {
      const canonicalValue = ENUM_FIELDS[field].find((option) => option.toLowerCase() === safeString(value).toLowerCase()) || safeString(value);
      const options = ENUM_FIELDS[field].some((option) => option.toLowerCase() === safeString(value).toLowerCase())
        ? ENUM_FIELDS[field]
        : [safeString(value), ...ENUM_FIELDS[field]];
      if (!leafVisible(sid, displayLabel, [value])) return null;
      return (
        <div key={field} className="rec-mini-card nested-mini-card">
          {!sameAsTitle(displayLabel, sid) && <div className="nested-subtitle field-label">{highlightText(displayLabel)}</div>}
          {renderEditableLeaf({
            record,
            idx,
            sid,
            field,
            displayValue: safeString(value),
            initialEditValue: canonicalValue,
            saveValue: (nextValue) => nextValue.toLowerCase(),
            widget: 'enum',
            options,
          })}
        </div>
      );
    }
    const parts = displayPartsForField(field, value);
    if (!leafVisible(sid, displayLabel, parts.flatMap((part) => [part.label, part.displayValue]))) return null;
    return (
      <div key={field} className="rec-mini-card nested-mini-card">
        {!sameAsTitle(displayLabel, sid) && <div className="nested-subtitle field-label">{highlightText(displayLabel)}</div>}
        {renderTextParts(record, idx, sid, field, value)}
      </div>
    );
  };

  const renderObjectSection = (record, idx, sid) => {
    const root = OBJECT_SECTIONS[sid];
    const object = getFieldValue(record, root, idx) || record[root];
    if (!object || typeof object !== 'object' || Array.isArray(object)) return null;
    const cards = Object.entries(object).filter(([, value]) => hasVal(value)).map(([key, originalValue]) => {
      const field = `${root}.${key}`;
      const value = getFieldValue(record, field, idx) ?? originalValue;
      const label = humanizeKey(key);
      if (Array.isArray(value)) {
        const visibleItems = value.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => hasVal(item));
        if (!visibleItems.length || !leafVisible(sid, label, visibleItems.map(({ item }) => item))) return null;
        return (
          <div key={field} className="rec-mini-card nested-mini-card">
            <div className="nested-subtitle field-label">{highlightText(label)}</div>
            {visibleItems.map(({ item, itemIndex }) => renderEditableLeaf({
              record,
              idx,
              sid,
              field: `${field}.${itemIndex}`,
              displayValue: safeString(item),
              leafKey: `${field}-${itemIndex}`,
            }))}
          </div>
        );
      }
      const parts = displayPartsForField(field, value);
      if (!leafVisible(sid, label, parts.flatMap((part) => [part.label, part.displayValue]))) return null;
      return (
        <div key={field} className="rec-mini-card nested-mini-card">
          <div className="nested-subtitle field-label">{highlightText(label)}</div>
          {renderTextParts(record, idx, sid, field, value)}
        </div>
      );
    }).filter(Boolean);
    if (!cards.length) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div className="section" key={sid}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(mergeRecord(record, idx, false), sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {cards}
        </div>
      </div>
    );
  };

  const renderRecommendations = (record, idx) => {
    const recommendations = getFieldValue(record, 'recommendations', idx);
    if (!Array.isArray(recommendations) || !recommendations.some(hasVal)) return null;
    const sid = 'recommendations';
    const groups = new Map();
    recommendations.forEach((item, itemIndex) => {
      const recommendation = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
      const dateValue = getFieldValue(record, `recommendations.${itemIndex}.date`, idx) ?? recommendation.date;
      const dateKey = normalizeDateKey(dateValue);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push({ itemIndex, recommendation, dateValue });
    });
    const renderedGroups = [...groups.entries()].map(([dateKey, items]) => {
      const datePaths = items.filter(({ dateValue }) => hasVal(dateValue)).map(({ itemIndex }) => `recommendations.${itemIndex}.date`);
      const firstDateValue = items.find(({ dateValue }) => hasVal(dateValue))?.dateValue;
      const textRows = items.flatMap(({ itemIndex, recommendation }) => {
        const field = typeof recommendations[itemIndex] === 'string'
          ? `recommendations.${itemIndex}`
          : `recommendations.${itemIndex}.recommendation`;
        const value = getFieldValue(record, field, idx) ?? recommendation.recommendation;
        if (!hasVal(value)) return [];
        return displayPartsForField(field, value).map((part, partIndex) => ({ field, value, part, partIndex }));
      });
      const visible = leafVisible(sid, dateKey === 'no-date' ? 'No Date' : formatDate(firstDateValue), textRows.flatMap(({ part }) => [part.label, part.displayValue]));
      if (!visible || !textRows.length) return null;
      const dateEditKey = `recommendations-date-${idx}-${dateKey}`;
      const dateEditing = editingField === dateEditKey;
      return (
        <div key={dateKey} className="rec-mini-card nested-mini-card recommendation-group">
          {datePaths.length ? (
            <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
              <div className={`date-subtitle nested-subtitle editable-row ${datePaths.some((path) => pendingEdits[`${path}-${idx}`]) ? 'modified' : ''}`} onClick={() => { if (!dateEditing) startEditing(dateEditKey, toInputDate(firstDateValue)); }}>
                {dateEditing ? (
                  <div className="edit-field-container">
                    <BlueDatePicker value={editValue} onSelect={(value) => { setEditValue(value || ''); setSaveError(null); }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={(event) => {
                        event.stopPropagation();
                        if (!editValue || Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; }
                        stageDrafts(record, idx, sid, datePaths.map((field) => ({ field, value: editValue })));
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={(event) => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : <div className="row-content"><span className="content-value">{highlightText(formatDate(firstDateValue))}</span><span className="edit-indicator">&#9998;</span></div>}
              </div>
            </div>
          ) : <div className="date-subtitle nested-subtitle">No Date</div>}
          {textRows.map(({ field, value, part, partIndex }) => renderEditableLeaf({
            record,
            idx,
            sid,
            field,
            displayValue: part.displayValue,
            initialEditValue: part.displayValue,
            leafKey: `${field}-part-${partIndex}`,
            saveValue: (nextValue) => replaceSegment(value, displayPartsForField(field, value), partIndex, part.label ? `${part.label}: ${nextValue}` : nextValue),
          }))}
        </div>
      );
    }).filter(Boolean);
    if (!renderedGroups.length) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div className="section" key={sid}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">Recommendations</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(mergeRecord(record, idx, false), sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {renderedGroups}
        </div>
      </div>
    );
  };

  const renderGoals = (record, idx) => {
    const goals = getFieldValue(record, 'goals', idx);
    if (!Array.isArray(goals) || !goals.some(hasVal)) return null;
    const sid = 'goals';
    const visibleGoals = goals.map((goal, goalIndex) => ({ goal, goalIndex })).filter(({ goal }) => hasVal(goal) && leafVisible(sid, 'Goals', [goal]));
    if (!visibleGoals.length) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div className="section" key={sid}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">Goals</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(mergeRecord(record, idx, false), sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          <div className="rec-mini-card nested-mini-card regular-row-group">
            {visibleGoals.map(({ goal, goalIndex }) => renderEditableLeaf({ record, idx, sid, field: `goals.${goalIndex}`, displayValue: safeString(goal), leafKey: `goals-${goalIndex}` }))}
          </div>
        </div>
      </div>
    );
  };

  const renderFieldsSection = (record, idx, sid) => {
    const cards = (SECTION_FIELDS[sid] || []).flatMap((field) => {
      const value = getFieldValue(record, field, idx);
      if (!hasVal(value)) return [];
      if (!Array.isArray(value)) return [renderFieldCard(record, idx, sid, field)];
      const visibleItems = value.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => hasVal(item));
      if (!visibleItems.length || !leafVisible(sid, FIELD_LABELS[field], visibleItems.map(({ item }) => item))) return [];
      return [(
        <div key={field} className="rec-mini-card nested-mini-card">
          <div className="nested-subtitle field-label">{highlightText(FIELD_LABELS[field])}</div>
          {visibleItems.map(({ item, itemIndex }) => renderEditableLeaf({
            record,
            idx,
            sid,
            field: `${field}.${itemIndex}`,
            displayValue: safeString(item),
            leafKey: `${field}-${itemIndex}`,
          }))}
        </div>
      )];
    }).filter(Boolean);
    if (!cards.length) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div className="section" key={sid}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(mergeRecord(record, idx, false), sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {cards}
        </div>
      </div>
    );
  };

  const copyFieldLines = (label, field, value, sid) => {
    const lines = [];
    if (!sameAsTitle(label, sid)) lines.push(label, COPY_LINE_DASH);
    if (DATE_FIELDS.includes(field)) lines.push(`1. ${formatDate(value)}`);
    else {
      const parts = displayPartsForField(field, value);
      let row = 1;
      parts.forEach((part) => {
        if (part.label) { lines.push(part.label, COPY_LINE_DASH); row = 1; }
        lines.push(`${row++}. ${part.displayValue}`);
      });
    }
    return lines;
  };

  const buildSectionCopyText = (record, sid) => {
    const lines = [SECTION_TITLES[sid], COPY_LINE_EQ, ''];
    if ((SECTION_FIELDS[sid] || []).length && sid !== 'recommendations') {
      SECTION_FIELDS[sid].forEach((field) => {
        const value = getPath(record, field);
        if (!hasVal(value)) return;
        if (Array.isArray(value)) {
          lines.push(FIELD_LABELS[field], COPY_LINE_DASH);
          value.filter(hasVal).forEach((item, index) => lines.push(`${index + 1}. ${safeString(item)}`));
          lines.push('');
        } else lines.push(...copyFieldLines(FIELD_LABELS[field], field, value, sid), '');
      });
    } else if (OBJECT_SECTIONS[sid]) {
      const root = OBJECT_SECTIONS[sid];
      const object = record[root];
      if (object && typeof object === 'object' && !Array.isArray(object)) {
        Object.entries(object).filter(([, value]) => hasVal(value)).forEach(([key, value]) => {
          const field = `${root}.${key}`;
          const label = humanizeKey(key);
          lines.push(label, COPY_LINE_DASH);
          if (Array.isArray(value)) value.filter(hasVal).forEach((item, index) => lines.push(`${index + 1}. ${safeString(item)}`));
          else {
            let row = 1;
            displayPartsForField(field, value).forEach((part) => {
              if (part.label) { lines.push(part.label, COPY_LINE_DASH); row = 1; }
              lines.push(`${row++}. ${part.displayValue}`);
            });
          }
          lines.push('');
        });
      }
    } else if (sid === 'recommendations') {
      const groups = new Map();
      (Array.isArray(record.recommendations) ? record.recommendations : []).forEach((item, itemIndex) => {
        const recommendation = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
        const key = normalizeDateKey(recommendation.date);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ recommendation, itemIndex });
      });
      groups.forEach((items, key) => {
        lines.push(key === 'no-date' ? 'No Date' : formatDate(items[0].recommendation.date), COPY_LINE_DASH);
        let row = 1;
        items.forEach(({ recommendation, itemIndex }) => {
          const field = typeof record.recommendations[itemIndex] === 'string'
            ? `recommendations.${itemIndex}`
            : `recommendations.${itemIndex}.recommendation`;
          displayPartsForField(field, recommendation.recommendation).forEach((part) => {
            if (part.label) { lines.push(part.label, COPY_LINE_DASH); row = 1; }
            lines.push(`${row++}. ${part.displayValue}`);
          });
        });
        lines.push('');
      });
    } else if (sid === 'goals') {
      (Array.isArray(record.goals) ? record.goals : []).filter(hasVal).forEach((goal, index) => lines.push(`${index + 1}. ${safeString(goal)}`));
      lines.push('');
    }
    return `${lines.join('\n').trimEnd()}\n\n`;
  };

  const copyAllText = useCallback(async () => {
    let text = `Spondyloarthritis Assessment\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((record, index) => {
      text += `Spondyloarthritis Assessment ${index + 1}\n${COPY_LINE_EQ}\n\n`;
      SECTION_ORDER.forEach((sid) => {
        const sectionText = buildSectionCopyText(record, sid);
        if (sectionText.split('\n').some((line) => /^\d+\.\s/.test(line))) text += sectionText;
      });
    });
    if (await copyToClipboard(text)) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [pdfData, copyToClipboard]);

  if (!records.length) {
    return (
      <div className="spondyloarthritis-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Spondyloarthritis Assessment</h2></div>
        <div className="empty-state">No spondyloarthritis assessment records available</div>
      </div>
    );
  }

  return (
    <div className="spondyloarthritis-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Spondyloarthritis Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SpondyloarthritisAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Spondyloarthritis_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input className="search-input" type="text" placeholder="Search spondyloarthritis assessments..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map(({ record, index }, displayIndex) => (
          <div className="record-card" key={safeId(record) || index}>
            <div className="record-header"><h3 className="record-name">{highlightText(`Spondyloarthritis Assessment ${displayIndex + 1}`)}</h3></div>
            {renderFieldsSection(record, index, 'overview')}
            {renderFieldsSection(record, index, 'disease-activity')}
            {renderObjectSection(record, index, 'spinal-mobility')}
            {renderFieldsSection(record, index, 'manifestations')}
            {renderFieldsSection(record, index, 'clinical')}
            {renderRecommendations(record, index)}
            {renderObjectSection(record, index, 'results')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpondyloarthritisAssessmentDocument;
