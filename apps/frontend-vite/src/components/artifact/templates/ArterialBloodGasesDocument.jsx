/**
 * ArterialBloodGasesDocument.jsx
 * Complete inline-editing template for arterial_blood_gases.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ArterialBloodGasesDocumentPDFTemplate from '../pdf-templates/ArterialBloodGasesDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import BlueTimePicker from '../components/BlueTimePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ArterialBloodGasesDocument.css';

const DRAFT_KEY = 'arterial_blood_gasesPendingEdits';
const SECTION_FIELDS = {
  assessmentInfo: ['assessmentDate', 'assessmentTime', 'clinicalStatus'],
  vitalSigns: ['vitalSigns'],
  interventions: ['interventions'],
  response: ['response'],
  plan: ['plan'],
  recommendations: ['recommendations'],
};
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];
const COMMA_SPLIT_FIELDS = ['vitalSigns', 'interventions', 'response'];

const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* localStorage may be unavailable */ }
};

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(value);
  }
};

const toInputDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const parseTimeValue = (raw) => {
  const value = String(raw ?? '').trim();
  const match = value.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*(.*)$/);
  if (!match) return { time: '', annotation: value };
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return { time: '', annotation: value };
  return { time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, annotation: String(match[4] || '').trim() };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<dot>');
  return protectedText
    .split(/[.;]\s+/)
    .map(part => part.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim())
    .filter(Boolean);
};

const splitGuardedComma = (text, protectThen = true) => {
  const source = String(text || '');
  const parts = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '[') { depth += 1; current += character; continue; }
    if (character === ')' || character === ']') { depth = Math.max(0, depth - 1); current += character; continue; }
    if (character !== ',' || depth > 0) { current += character; continue; }
    const before = current.trim();
    const remaining = source.slice(index + 1);
    const after = remaining.trimStart();
    const nextWord = (after.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const protectedComma = (/[\d]$/.test(before) && /^\d{3}\b/.test(after))
      || remaining.length === after.length
      || ['and', 'or'].includes(nextWord)
      || (protectThen && nextWord === 'then');
    if (protectedComma) current += character;
    else { if (before) parts.push(before); current = ''; }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [source];
};

const fieldRows = (field, value) => {
  const rows = [];
  splitBySentence(String(value || '')).forEach(sentence => {
    const parts = COMMA_SPLIT_FIELDS.includes(field) ? splitGuardedComma(sentence, field !== 'interventions') : [sentence];
    parts.map(part => part.replace(/[;.]+$/, '').trim()).filter(Boolean).forEach(part => rows.push(part));
  });
  return rows;
};

const enumOptionsWith = (current, base) => {
  const value = String(current || '').trim();
  if (!value || base.some(o => o.toLowerCase() === value.toLowerCase())) return base;
  return [...base, value];
};

const ABG_RANGES = {
  ph: { low: 7.35, high: 7.45, scale: [7, 7.8] },
  paco2: { low: 35, high: 45, scale: [0, 100] },
  pao2: { low: 80, high: 100, scale: [0, 150] },
  hco3: { low: 22, high: 26, scale: [0, 50] },
  sao2: { low: 95, high: 100, scale: [0, 100] },
  spo2: { low: 95, high: 100, scale: [0, 100] },
  hr: { low: 60, high: 100, scale: [0, 200] },
  rr: { low: 12, high: 20, scale: [0, 40] },
  bpSystolic: { low: 90, high: 140, scale: [0, 250] },
  bpDiastolic: { low: 60, high: 90, scale: [0, 150] },
};
const ABG_INTERPRETATIONS = {
  ph: { low: 'Acidosis', high: 'Alkalosis' },
  paco2: { low: 'Hypocapnia', high: 'Hypercapnia' },
  pao2: { low: 'Hypoxemia', high: 'Hyperoxia' },
  hco3: { low: 'Low', high: 'Elevated' },
  sao2: { low: 'Desaturation', high: 'Normal' },
  spo2: { low: 'Hypoxemia', high: 'Normal' },
  hr: { low: 'Bradycardia', high: 'Tachycardia' },
  rr: { low: 'Bradypnea', high: 'Tachypnea' },
  bpSystolic: { low: 'Hypotension', high: 'Hypertension' },
  bpDiastolic: { low: 'Hypotension', high: 'Hypertension' },
};
const ABG_PATTERNS = [
  { regex: /BP\s+(\d+)\/(\d+)\s*(mmHg)?/i, isBloodPressure: true, unit: 'mmHg' },
  { regex: /pH\s+(\d+\.?\d*)/i, label: 'pH', type: 'ph', unit: '' },
  { regex: /PaCO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaCO2', type: 'paco2', unit: 'mmHg' },
  { regex: /PaO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaO2', type: 'pao2', unit: 'mmHg' },
  { regex: /HCO3\s+(\d+\.?\d*)\s*(mEq\/L)?/i, label: 'HCO3', type: 'hco3', unit: 'mEq/L' },
  { regex: /SaO2\s+(\d+\.?\d*)\s*%?/i, label: 'SaO2', type: 'sao2', unit: '%' },
  { regex: /SpO2\s+(\d+\.?\d*)\s*%?/i, label: 'SpO2', type: 'spo2', unit: '%' },
  { regex: /HR\s+(\d+\.?\d*)\s*(bpm)?/i, label: 'HR', type: 'hr', unit: 'bpm' },
  { regex: /RR\s+(\d+\.?\d*)\s*(\/min)?/i, label: 'RR', type: 'rr', unit: '/min' },
];

const parseVitalSigns = (text) => {
  const results = [];
  splitGuardedComma(String(text || '')).forEach(part => {
    for (const pattern of ABG_PATTERNS) {
      const match = part.match(pattern.regex);
      if (!match) continue;
      if (pattern.isBloodPressure) {
        results.push({ label: 'BP (Systolic)', value: Number(match[1]), unit: pattern.unit, type: 'bpSystolic' });
        results.push({ label: 'BP (Diastolic)', value: Number(match[2]), unit: pattern.unit, type: 'bpDiastolic' });
      } else results.push({ label: pattern.label, value: Number(match[1]), unit: pattern.unit, type: pattern.type });
      break;
    }
  });
  return results;
};
const chartColor = (value, type) => value < ABG_RANGES[type].low ? '#3b82f6' : value > ABG_RANGES[type].high ? '#ef4444' : '#22c55e';
const chartInterpretation = (value, type) => value < ABG_RANGES[type].low ? ABG_INTERPRETATIONS[type].low : value > ABG_RANGES[type].high ? ABG_INTERPRETATIONS[type].high : 'Normal';
const chartPercent = (value, type) => {
  const [minimum, maximum] = ABG_RANGES[type].scale;
  return Math.max(5, Math.min(100, ((value - minimum) / (maximum - minimum)) * 100));
};

const getRecordId = (record) => {
  const id = record?._id;
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (id.$oid) return id.$oid;
  return String(id);
};
const stateKey = (recordIndex, path) => `${recordIndex}:${path}`;
const pathValue = (record, path) => String(path).split('.').reduce((value, part) => value?.[part], record);
const setPathValue = (record, path, value) => {
  const parts = String(path).split('.');
  let cursor = record;
  parts.slice(0, -1).forEach((part, index) => {
    if (cursor[part] === undefined) cursor[part] = /^\d+$/.test(parts[index + 1] || '') ? [] : {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
};

const ArterialBloodGasesDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saveError, setSaveError] = useState(null);
  const textareaRef = useRef(null);

  const records = useMemo(() => {
    const source = docProp || data || templateData;
    if (!source) return [];
    let values = Array.isArray(source) ? source : [source];
    values = values.flatMap(value => {
      if (value?.arterial_blood_gases) return Array.isArray(value.arterial_blood_gases) ? value.arterial_blood_gases : [value.arterial_blood_gases];
      if (value?.data) {
        if (Array.isArray(value.data)) return value.data;
        if (value.data?.arterial_blood_gases) return Array.isArray(value.data.arterial_blood_gases) ? value.data.arterial_blood_gases : [value.data.arterial_blood_gases];
        return [value.data];
      }
      if (value?.documentData) {
        if (Array.isArray(value.documentData)) return value.documentData;
        if (value.documentData?.arterial_blood_gases) return Array.isArray(value.documentData.arterial_blood_gases) ? value.documentData.arterial_blood_gases : [value.documentData.arterial_blood_gases];
        return [value.documentData];
      }
      return [value];
    });
    return values.filter(value => value && typeof value === 'object' && Object.values(SECTION_FIELDS).flat().some(field => hasValue(value[field])));
  }, [docProp, data, templateData]);

  useEffect(() => {
    const store = readDrafts();
    const nextLocal = {};
    const nextPending = {};
    const nextEdited = {};
    records.forEach((record, recordIndex) => {
      const recordDrafts = store[getRecordId(record)];
      if (!recordDrafts) return;
      Object.entries(recordDrafts).forEach(([storedPath, value]) => {
        const path = /^recommendations\.\d+$/.test(storedPath) ? `${storedPath}.recommendation` : storedPath;
        const key = stateKey(recordIndex, path);
        nextLocal[key] = value;
        nextPending[key] = true;
        nextEdited[key] = 'edited';
      });
    });
    if (!Object.keys(nextLocal).length) return;
    setLocalEdits(previous => ({ ...nextLocal, ...previous }));
    setPendingEdits(previous => ({ ...nextPending, ...previous }));
    setEditedFields(previous => ({ ...nextEdited, ...previous }));
  }, [records]);

  const getValue = useCallback((record, recordIndex, path) => {
    const key = stateKey(recordIndex, path);
    return localEdits[key] !== undefined ? localEdits[key] : pathValue(record, path);
  }, [localEdits]);

  const committedRecords = useMemo(() => records.map((record, recordIndex) => {
    const merged = { ...record, recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(item => ({ ...item })) : record.recommendations };
    Object.entries(localEdits).forEach(([key, value]) => {
      if (!key.startsWith(`${recordIndex}:`) || pendingEdits[key]) return;
      setPathValue(merged, key.slice(String(recordIndex).length + 1), value);
    });
    return merged;
  }), [records, localEdits, pendingEdits]);

  const highlightText = useCallback((value) => {
    const text = String(value ?? '');
    const query = searchTerm.trim();
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, index) => part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);

  const copyToClipboard = useCallback((text, id) => {
    const markCopied = () => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
    const legacyCopy = () => {
      const element = window.document.createElement('textarea');
      element.value = text;
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      window.document.body.appendChild(element);
      element.select();
      try { window.document.execCommand('copy'); markCopied(); } catch { /* clipboard unavailable */ }
      window.document.body.removeChild(element);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(markCopied).catch(legacyCopy);
    else legacyCopy();
  }, []);

  const stagePaths = useCallback((record, recordIndex, sectionId, changes, markers = []) => {
    const recordId = getRecordId(record);
    if (!recordId) return;
    const localPatch = {};
    const pendingPatch = {};
    const editedPatch = {};
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    changes.forEach(({ path, value }) => {
      const key = stateKey(recordIndex, path);
      localPatch[key] = value;
      pendingPatch[key] = true;
      editedPatch[key] = 'edited';
      store[recordId][path] = value;
    });
    markers.forEach(marker => { editedPatch[marker] = 'edited'; });
    writeDrafts(store);
    setLocalEdits(previous => ({ ...previous, ...localPatch }));
    setPendingEdits(previous => ({ ...previous, ...pendingPatch }));
    setEditedFields(previous => ({ ...previous, ...editedPatch }));
    setApprovedSections(previous => { const next = { ...previous }; delete next[`${sectionId}-${recordIndex}`]; return next; });
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }, []);

  const stagePath = useCallback((record, recordIndex, sectionId, path, value, marker) => {
    stagePaths(record, recordIndex, sectionId, [{ path, value }], marker ? [marker] : []);
  }, [stagePaths]);

  const sectionHasEdits = useCallback((sectionId, recordIndex) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return Object.keys(editedFields).some(key => {
      if (!key.startsWith(`${recordIndex}:`)) return false;
      const path = key.slice(String(recordIndex).length + 1);
      return fields.includes(path.split('.')[0]);
    });
  }, [editedFields]);

  const approveSection = useCallback(async (record, sectionId, recordIndex) => {
    const recordId = getRecordId(record);
    if (!recordId || approvedSections[`${sectionId}-${recordIndex}`]) return;
    const fields = SECTION_FIELDS[sectionId] || [];
    const committed = [];
    try {
      for (const [key, value] of Object.entries(localEdits)) {
        if (!key.startsWith(`${recordIndex}:`) || !pendingEdits[key]) continue;
        const path = key.slice(String(recordIndex).length + 1);
        if (!fields.includes(path.split('.')[0])) continue;
        await secureApiClient.put(`/api/edit/arterial_blood_gases/${recordId}/edit`, { field: path, value });
        committed.push({ key, path });
      }
      await secureApiClient.put(`/api/edit/arterial_blood_gases/${recordId}/approve`, { sectionId, approved: true });
      setPendingEdits(previous => { const next = { ...previous }; committed.forEach(({ key }) => delete next[key]); return next; });
      setEditedFields(previous => {
        const next = { ...previous };
        Object.keys(next).forEach(key => {
          if (!key.startsWith(`${recordIndex}:`)) return;
          const path = key.slice(String(recordIndex).length + 1);
          if (fields.includes(path.split('.')[0])) delete next[key];
        });
        return next;
      });
      const store = readDrafts();
      if (store[recordId]) {
        committed.forEach(({ path }) => delete store[recordId][path]);
        if (!Object.keys(store[recordId]).length) delete store[recordId];
        writeDrafts(store);
      }
      setApprovedSections(previous => ({ ...previous, [`${sectionId}-${recordIndex}`]: true }));
    } catch (error) {
      setSaveError(error?.message || 'Unable to approve this section');
    }
  }, [approvedSections, localEdits, pendingEdits]);

  const renderApprove = (record, sectionId, recordIndex) => {
    const approved = approvedSections[`${sectionId}-${recordIndex}`];
    if (!approved && !sectionHasEdits(sectionId, recordIndex)) return null;
    return <button className={approved ? 'approve-btn approved' : 'approve-btn pending'} onClick={() => approveSection(record, sectionId, recordIndex)}>{approved ? 'Approved' : 'Pending Approve'}</button>;
  };

  const cancelEdit = (event) => {
    event?.stopPropagation();
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  };

  const renderScalarField = (record, field, recordIndex, sectionId, label, kind = 'text') => {
    const value = getValue(record, recordIndex, field);
    if (!hasValue(value)) return null;
    const key = stateKey(recordIndex, field);
    const editing = editingField === key;
    const edited = editedFields[key];
    const timeParts = kind === 'time' ? parseTimeValue(value) : null;
    const useTimePicker = kind === 'time' && timeParts.time && !timeParts.annotation;
    const options = kind === 'status' ? enumOptionsWith(value, STATUS_OPTIONS) : [];
    const displayValue = kind === 'date' ? formatDate(value) : kind === 'status' ? (options.find(option => option.toLowerCase() === String(value).toLowerCase()) || String(value)) : String(value);
    const beginEdit = () => {
      setEditingField(key);
      setSaveError(null);
      if (kind === 'date') setEditValue(toInputDate(value));
      else if (useTimePicker) setEditValue(timeParts.time);
      else setEditValue(displayValue);
    };
    const save = (event) => {
      event.stopPropagation();
      if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(editValue)) { setSaveError('Please choose a valid date'); return; }
      if (useTimePicker && !/^\d{2}:\d{2}$/.test(editValue)) { setSaveError('Please choose a valid time'); return; }
      const nextValue = kind === 'date' ? `${editValue}T00:00:00.000Z` : editValue.trim();
      stagePath(record, recordIndex, sectionId, field, nextValue, key);
    };
    return (
      <div key={field} className="rec-mini-card nested-mini-card" data-edit-field={field}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${edited ? ' modified' : ''}`} onClick={() => { if (!editing) beginEdit(); }}>
          {editing ? (
            <div className="edit-field-container">
              {kind === 'date' ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                : useTimePicker ? <BlueTimePicker value={editValue} onChange={setEditValue} />
                  : kind === 'status' ? <BlueSelect value={editValue} options={options} onChange={setEditValue} />
                    : <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div>
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedId === key ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyToClipboard(displayValue, key); }}>{copiedId === key ? 'Copied' : 'Copy'}</button></>
          )}
        </div>
        {edited && !editing && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderNarrativeField = (record, field, recordIndex, sectionId) => {
    const value = getValue(record, recordIndex, field);
    if (!hasValue(value)) return null;
    const rows = fieldRows(field, value);
    return (
      <div className="rec-mini-card nested-mini-card regular-row-group">
        {rows.map((row, rowIndex) => {
          const marker = `${recordIndex}:${field}:row:${rowIndex}`;
          const editing = editingField === marker;
          const edited = editedFields[marker] || editedFields[stateKey(recordIndex, field)];
          return (
            <div key={marker} data-edit-field={field}>
              <div className={`numbered-row editable-row${edited ? ' modified' : ''}`} onClick={() => { if (!editing) { setEditingField(marker); setEditValue(row); setSaveError(null); } }}>
                {editing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); if (!editValue.trim()) { setSaveError('Please enter a value'); return; } const nextRows = [...rows]; nextRows[rowIndex] = editValue.trim(); stagePath(record, recordIndex, sectionId, field, nextRows.join('. '), marker); }}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div>
                  </div>
                ) : (
                  <><div className="row-content"><span className="content-value">{highlightText(row)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedId === marker ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyToClipboard(row, marker); }}>{copiedId === marker ? 'Copied' : 'Copy'}</button></>
                )}
              </div>
              {edited && !editing && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const recommendationGroups = (record, recordIndex) => {
    const recommendations = Array.isArray(record.recommendations) ? record.recommendations : [];
    const groups = new Map();
    recommendations.forEach((item, itemIndex) => {
      const date = getValue(record, recordIndex, `recommendations.${itemIndex}.date`);
      const recommendation = getValue(record, recordIndex, `recommendations.${itemIndex}.recommendation`);
      if (!hasValue(date) && !hasValue(recommendation)) return;
      const key = toInputDate(date) || `no-date-${itemIndex}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ itemIndex, date, recommendation: String(recommendation || '') });
    });
    return [...groups.entries()];
  };

  const renderRecommendations = (record, recordIndex) => recommendationGroups(record, recordIndex).map(([dateKey, entries]) => {
    const dated = !dateKey.startsWith('no-date-');
    const dateEditKey = `${recordIndex}:recommendations:date:${dateKey}`;
    const editingDate = editingField === dateEditKey;
    const datePaths = entries.map(entry => `recommendations.${entry.itemIndex}.date`);
    return (
      <div key={dateKey} className="recommendation-group nested-mini-card">
        {dated && (
          <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
            <div className="nested-subtitle date-subtitle editable-row" onClick={() => { if (!editingDate) { setEditingField(dateEditKey); setEditValue(dateKey); setSaveError(null); } }}>
              {editingDate ? (
                <div className="edit-field-container">
                  <BlueDatePicker value={editValue} onSelect={setEditValue} />
                  {saveError && <div className="save-error">{saveError}</div>}
                  <div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue)) { setSaveError('Please choose a valid date'); return; } stagePaths(record, recordIndex, 'recommendations', entries.map(entry => ({ path: `recommendations.${entry.itemIndex}.date`, value: editValue })), [dateEditKey]); }}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div>
                </div>
              ) : <><span className="content-value">{highlightText(formatDate(entries[0].date))}</span><span className="edit-indicator">&#9998;</span></>}
            </div>
          </div>
        )}
        {entries.flatMap(entry => fieldRows('recommendations', entry.recommendation).map((clause, clauseIndex) => {
          const path = `recommendations.${entry.itemIndex}.recommendation`;
          const marker = `${recordIndex}:${path}:row:${clauseIndex}`;
          const editing = editingField === marker;
          const edited = editedFields[marker] || editedFields[stateKey(recordIndex, path)];
          return (
            <div key={marker} data-edit-field={path}>
              <div className={`numbered-row editable-row${edited ? ' modified' : ''}`} onClick={() => { if (!editing) { setEditingField(marker); setEditValue(clause); setSaveError(null); } }}>
                {editing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); if (!editValue.trim()) { setSaveError('Please enter a value'); return; } const clauses = fieldRows('recommendations', getValue(record, recordIndex, path)); clauses[clauseIndex] = editValue.trim(); stagePath(record, recordIndex, 'recommendations', path, clauses.join('. '), marker); }}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div>
                  </div>
                ) : (
                  <><div className="row-content"><span className="content-value">{highlightText(clause)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedId === marker ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyToClipboard(clause, marker); }}>{copiedId === marker ? 'Copied' : 'Copy'}</button></>
                )}
              </div>
              {edited && !editing && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        }))}
      </div>
    );
  });

  const sectionText = (title, rows) => `${title.toUpperCase()}\n${'-'.repeat(40)}\n${rows.map((row, index) => `${index + 1}. ${row}`).join('\n')}`;
  const copyAll = useCallback(() => {
    let text = `ARTERIAL BLOOD GASES\n${'='.repeat(50)}\n\n`;
    committedRecords.forEach((record, recordIndex) => {
      text += `Arterial Blood Gases ${recordIndex + 1}\n${'='.repeat(50)}\n\n`;
      const assessment = [
        record.assessmentDate ? ['Assessment Date', formatDate(record.assessmentDate)] : null,
        record.assessmentTime ? ['Assessment Time', String(record.assessmentTime)] : null,
        record.clinicalStatus ? ['Clinical Status', String(record.clinicalStatus)] : null,
      ].filter(Boolean);
      if (assessment.length) {
        text += `ASSESSMENT INFO\n${'-'.repeat(40)}\n`;
        assessment.forEach(([label, value]) => { text += `${label}\n1. ${value}\n`; });
        text += '\n';
      }
      [['VITAL SIGNS', 'vitalSigns'], ['INTERVENTIONS', 'interventions'], ['RESPONSE', 'response'], ['PLAN', 'plan']].forEach(([title, field]) => {
        const rows = fieldRows(field, record[field]);
        if (rows.length) text += `${sectionText(title, rows)}\n\n`;
      });
      const groups = recommendationGroups(record, recordIndex);
      if (groups.length) {
        text += `RECOMMENDATIONS\n${'-'.repeat(40)}\n`;
        let number = 1;
        groups.forEach(([dateKey, entries]) => {
          if (!dateKey.startsWith('no-date-')) text += `${formatDate(entries[0].date)}\n`;
          entries.forEach(entry => fieldRows('recommendations', entry.recommendation).forEach(row => { text += `${number++}. ${row}\n`; }));
        });
        text += '\n';
      }
      text += `${'='.repeat(80)}\n\n`;
    });
    copyToClipboard(text, 'all-documents');
  }, [committedRecords, copyToClipboard]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records.map((record, originalIndex) => ({ record, originalIndex }));
    return records.map((record, originalIndex) => ({ record, originalIndex })).filter(({ record }) => JSON.stringify(record).toLowerCase().includes(query) || 'arterial blood gases abg'.includes(query));
  }, [records, searchTerm]);

  if (!records.length) return <div className="arterial-blood-gases-document"><div className="document-header"><h1 className="document-title">Arterial Blood Gases</h1></div><div className="empty-state">No arterial blood gases records found.</div></div>;

  const renderSection = (record, recordIndex, sectionId, title, content, copyRows) => {
    if (!content) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header"><h3 className="section-title">{highlightText(title)}</h3><div className="header-right-actions"><button className={`copy-btn ${copiedId === `${sectionId}-${recordIndex}` ? 'copied' : ''}`} onClick={() => copyToClipboard(sectionText(title, copyRows), `${sectionId}-${recordIndex}`)}>{copiedId === `${sectionId}-${recordIndex}` ? 'Copied' : 'Copy Section'}</button>{renderApprove(record, sectionId, recordIndex)}</div></div>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="arterial-blood-gases-document">
      <div className="document-header"><h1 className="document-title">Arterial Blood Gases</h1><div className="header-actions"><button className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`} onClick={copyAll}>{copiedId === 'all-documents' ? 'Copied' : 'Copy All'}</button><PDFDownloadLink document={<ArterialBloodGasesDocumentPDFTemplate document={committedRecords} />} fileName="Arterial_Blood_Gases.pdf">{({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}</PDFDownloadLink></div></div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search arterial blood gases records..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div>
      {!filteredRecords.length && <div className="no-results">No records match "{searchTerm}"</div>}
      <div className="records-container">
        {filteredRecords.map(({ record, originalIndex }) => {
          const assessmentRows = [
            hasValue(getValue(record, originalIndex, 'assessmentDate')) ? formatDate(getValue(record, originalIndex, 'assessmentDate')) : null,
            hasValue(getValue(record, originalIndex, 'assessmentTime')) ? String(getValue(record, originalIndex, 'assessmentTime')) : null,
            hasValue(getValue(record, originalIndex, 'clinicalStatus')) ? String(getValue(record, originalIndex, 'clinicalStatus')) : null,
          ].filter(Boolean);
          const vitalRows = fieldRows('vitalSigns', getValue(record, originalIndex, 'vitalSigns'));
          const interventionRows = fieldRows('interventions', getValue(record, originalIndex, 'interventions'));
          const responseRows = fieldRows('response', getValue(record, originalIndex, 'response'));
          const planRows = fieldRows('plan', getValue(record, originalIndex, 'plan'));
          const chartRows = parseVitalSigns(getValue(record, originalIndex, 'vitalSigns'));
          const recommendationRows = recommendationGroups(record, originalIndex).flatMap(([dateKey, entries]) => [
            ...(dateKey.startsWith('no-date-') ? [] : [formatDate(entries[0].date)]),
            ...entries.flatMap(entry => fieldRows('recommendations', entry.recommendation)),
          ]);
          return (
            <div key={getRecordId(record) || originalIndex} className="record-card">
              <div className="record-header"><div className="record-title-row"><h2 className="record-title">{highlightText(`Arterial Blood Gases ${originalIndex + 1}`)}</h2></div></div>
              {renderSection(record, originalIndex, 'assessmentInfo', 'Assessment Info', assessmentRows.length ? <>{renderScalarField(record, 'assessmentDate', originalIndex, 'assessmentInfo', 'Assessment Date', 'date')}{renderScalarField(record, 'assessmentTime', originalIndex, 'assessmentInfo', 'Assessment Time', 'time')}{renderScalarField(record, 'clinicalStatus', originalIndex, 'assessmentInfo', 'Clinical Status', 'status')}</> : null, assessmentRows)}
              {renderSection(record, originalIndex, 'vitalSigns', 'Vital Signs', vitalRows.length ? <>{chartRows.length > 0 && <div className="chart-container"><div className="chart-legend"><div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span className="legend-text">Normal</span></div><div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span className="legend-text">Low</span></div><div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span className="legend-text">High</span></div></div>{chartRows.map((item, chartIndex) => { const color = chartColor(item.value, item.type); const display = `${item.value}${item.unit ? ` ${item.unit}` : ''}`; return <div className="bar-chart-row" key={chartIndex}><div className="bar-label">{item.label}</div><div className="bar-container"><div className="bar-background"><div className="bar-fill" style={{ width: `${chartPercent(item.value, item.type)}%`, backgroundColor: color }} /></div><div className="bar-value" style={{ color }}>{display}</div></div><div className="bar-interpretation" style={{ color }}>{chartInterpretation(item.value, item.type)}</div></div>; })}</div>}{renderNarrativeField(record, 'vitalSigns', originalIndex, 'vitalSigns')}</> : null, vitalRows)}
              {renderSection(record, originalIndex, 'interventions', 'Interventions', interventionRows.length ? renderNarrativeField(record, 'interventions', originalIndex, 'interventions') : null, interventionRows)}
              {renderSection(record, originalIndex, 'response', 'Response', responseRows.length ? renderNarrativeField(record, 'response', originalIndex, 'response') : null, responseRows)}
              {renderSection(record, originalIndex, 'plan', 'Plan', planRows.length ? renderNarrativeField(record, 'plan', originalIndex, 'plan') : null, planRows)}
              {renderSection(record, originalIndex, 'recommendations', 'Recommendations', recommendationRows.length ? renderRecommendations(record, originalIndex) : null, recommendationRows)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArterialBloodGasesDocument;
