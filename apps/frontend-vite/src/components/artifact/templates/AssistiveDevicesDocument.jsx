import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AssistiveDevicesDocumentPDFTemplate from '../pdf-templates/AssistiveDevicesDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './AssistiveDevicesDocument.css';

const COLLECTION = 'assistive_devices';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = [];

const SECTIONS = [
  { id: 'record', title: 'Record Information', fields: ['date', 'facility'] },
  { id: 'device', title: 'Device Information', fields: ['deviceType', 'deviceName', 'indication'] },
  { id: 'prescription', title: 'Prescription Details', fields: ['prescribedBy', 'dateOrdered', 'dateReceived'] },
  { id: 'supplier', title: 'Supplier & Insurance', fields: ['supplier', 'insurance'] },
  { id: 'training', title: 'Training & Compliance', fields: ['trainingProvided', 'effectiveness', 'compliance'] },
  { id: 'maintenance', title: 'Maintenance', fields: ['maintenanceSchedule', 'replacementNeeds'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];
const FIELD_LABELS = {
  date: 'Date', facility: 'Facility', deviceType: 'Device Type', deviceName: 'Device Name', indication: 'Indication',
  prescribedBy: 'Prescribed By', dateOrdered: 'Date Ordered', dateReceived: 'Date Received', supplier: 'Supplier',
  insurance: 'Insurance', trainingProvided: 'Training Provided', effectiveness: 'Effectiveness', compliance: 'Compliance',
  maintenanceSchedule: 'Maintenance Schedule', replacementNeeds: 'Replacement Needs', notes: 'Notes',
};
const DATE_FIELDS = new Set(['date', 'dateOrdered', 'dateReceived']);
const NARRATIVE_FIELDS = new Set(['indication', 'trainingProvided', 'effectiveness', 'compliance', 'maintenanceSchedule', 'replacementNeeds', 'notes']);
const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);

const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* best effort */ } };
const recordIdOf = record => { if (!record?._id) return null; if (typeof record._id === 'string') return record._id; if (record._id.$oid) return record._id.$oid; return String(record._id); };
const hasValue = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
const formatDate = value => {
  if (!value) return '';
  try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(value); }
};
const toInputDate = value => {
  if (!value) return '';
  try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); }
  catch { return ''; }
};

// Periods and semicolons split narrative fields. Commas stay whole for every Assistive Devices field.
const splitClauses = text => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const clauses = [];
  let start = 0;
  let depth = 0;
  const push = end => {
    let left = start; let right = end;
    while (left < right && /\s/.test(source[left])) left += 1;
    while (right > left && /\s/.test(source[right - 1])) right -= 1;
    if (right > left) clauses.push({ text: source.slice(left, right), start: left, end: right });
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]))) { push(index); start = index + 1; }
  }
  push(source.length);
  return clauses;
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const records = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_FIELDS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => DISPLAY_FIELDS.some(field => hasValue(record[field])));
};

const AssistiveDevicesDocument = ({ document: documentProp, data, templateData }) => {
  const records = useMemo(() => unwrapRecords(documentProp || data || templateData), [documentProp, data, templateData]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [approving, setApproving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const store = readDrafts(); const nextLocal = {}; const nextPending = {};
    records.forEach((record, index) => Object.entries(store[recordIdOf(record)] || {}).forEach(([field, value]) => { const key = `${field}-${index}`; nextLocal[key] = value; nextPending[key] = true; }));
    if (Object.keys(nextLocal).length) { setLocalEdits(previous => ({ ...nextLocal, ...previous })); setPendingEdits(previous => ({ ...nextPending, ...previous })); }
  }, [records]);

  const valueAt = useCallback((record, field, index) => localEdits[`${field}-${index}`] !== undefined ? localEdits[`${field}-${index}`] : record[field], [localEdits]);
  const stageDraft = useCallback((record, field, index, value) => {
    const id = recordIdOf(record); if (!id) return;
    const key = `${field}-${index}`;
    setLocalEdits(previous => ({ ...previous, [key]: value }));
    setPendingEdits(previous => ({ ...previous, [key]: true }));
    const store = readDrafts(); store[id] = { ...(store[id] || {}), [field]: value }; writeDrafts(store);
  }, []);
  const startEdit = (key, value) => { setEditingField(key); setEditValue(value ?? ''); setSaveError(''); };
  const cancelEdit = () => { setEditingField(null); setEditValue(''); setSaveError(''); };
  const copyText = async (text, key) => { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1600); };
  const recordWithEdits = useCallback((record, index, includePending = true) => {
    const merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => { if (!key.endsWith(`-${index}`) || (!includePending && pendingEdits[key])) return; merged[key.slice(0, -String(index).length - 1)] = value; });
    return merged;
  }, [localEdits, pendingEdits]);
  const pdfData = useMemo(() => records.map((record, index) => recordWithEdits(record, index, false)), [records, recordWithEdits]);
  const sectionPending = (section, index) => section.fields.some(field => pendingEdits[`${field}-${index}`]);
  const approveSection = async (record, index, section) => {
    const id = recordIdOf(record); if (!id) return;
    setApproving(true);
    try {
      const fields = section.fields.filter(field => pendingEdits[`${field}-${index}`]);
      for (const field of fields) {
        const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, { field, value: localEdits[`${field}-${index}`] });
        if (!response?.success) throw new Error(response?.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`, { sectionId: section.id, approved: true });
      setPendingEdits(previous => { const next = { ...previous }; fields.forEach(field => delete next[`${field}-${index}`]); return next; });
      const store = readDrafts(); if (store[id]) { fields.forEach(field => delete store[id][field]); if (!Object.keys(store[id]).length) delete store[id]; writeDrafts(store); }
      setApprovedSections(previous => ({ ...previous, [`${section.id}-${index}`]: true }));
    } finally { setApproving(false); }
  };
  const highlight = value => {
    const text = String(value ?? ''); const query = searchTerm.trim(); if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase()); if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
  };

  const saveSimple = (record, field, index) => {
    const value = DATE_FIELDS.has(field) ? `${editValue}T00:00:00.000Z` : editValue.trim();
    if (!value || (DATE_FIELDS.has(field) && !/^\d{4}-\d{2}-\d{2}$/.test(editValue))) { setSaveError(DATE_FIELDS.has(field) ? 'Please choose a valid date' : 'Please enter a value'); return; }
    stageDraft(record, field, index, value); cancelEdit();
  };
  const renderSimpleField = (record, field, index, section) => {
    const raw = valueAt(record, field, index); if (!hasValue(raw)) return null;
    const display = DATE_FIELDS.has(field) ? formatDate(raw) : String(raw);
    const editKey = `${field}-${index}`; const editing = editingField === editKey; const modified = !!pendingEdits[editKey];
    return <div className="rec-mini-card nested-mini-card" key={field}>{FIELD_LABELS[field] !== section.title && <div className="nested-subtitle">{FIELD_LABELS[field]}</div>}<div data-edit-field={field}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, DATE_FIELDS.has(field) ? toInputDate(raw) : raw)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{DATE_FIELDS.has(field) ? <BlueDatePicker value={editValue} onSelect={setEditValue} /> : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => saveSimple(record, field, index)}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn${copied === editKey ? ' copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(display, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div></div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };
  const renderNarrativeField = (record, field, index, section) => {
    const source = String(valueAt(record, field, index) || ''); const clauses = splitClauses(source); if (!clauses.length) return null;
    const modified = !!pendingEdits[`${field}-${index}`];
    return <div className={`rec-mini-card nested-mini-card${FIELD_LABELS[field] === section.title ? ' regular-row-group' : ''}`} key={field}>{FIELD_LABELS[field] !== section.title && <div className="nested-subtitle">{FIELD_LABELS[field]}</div>}{clauses.map((clause, clauseIndex) => {
      const editKey = `${field}-${index}-clause-${clauseIndex}`; const editing = editingField === editKey;
      return <div key={editKey} data-edit-field={field}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, clause.text)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => { if (!editValue.trim()) { setSaveError('Please enter a value'); return; } stageDraft(record, field, index, source.slice(0, clause.start) + editValue.trim() + source.slice(clause.end)); cancelEdit(); }}>Save</button><button className="cancel-btn" onClick={cancelEdit}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(clause.text)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn${copied === editKey ? ' copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(clause.text, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div></div>;
    })}{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };

  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '='.repeat(40)];
    section.fields.forEach(field => {
      const value = record[field]; if (!hasValue(value)) return;
      const label = FIELD_LABELS[field]; if (label !== section.title) lines.push(label, '-'.repeat(40));
      if (DATE_FIELDS.has(field)) lines.push(`1. ${formatDate(value)}`);
      else if (NARRATIVE_FIELDS.has(field)) splitClauses(value).forEach((clause, index) => lines.push(`${index + 1}. ${clause.text}`));
      else lines.push(`1. ${value}`);
    });
    return lines;
  };
  const allText = useCallback((record, index) => {
    const merged = recordWithEdits(record, index, true); const lines = [`ASSISTIVE DEVICE ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => { if (section.fields.some(field => hasValue(merged[field]))) lines.push('', ...sectionLines(merged, section)); });
    return lines.join('\n');
  }, [recordWithEdits]);
  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase(); if (!query) return records.map((record, index) => ({ record, index }));
    return records.map((record, index) => ({ record, index })).filter(({ record }) => JSON.stringify(record).toLowerCase().includes(query) || 'assistive devices'.includes(query));
  }, [records, searchTerm]);

  if (!records.length) return <div className="assistive-devices-document"><div className="empty-state">No assistive devices data available.</div></div>;
  return <div className="assistive-devices-document"><div className="document-header"><h1 className="document-title">Assistive Devices</h1><div className="header-actions"><button className={`copy-btn${copied === 'all' ? ' copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AssistiveDevicesDocumentPDFTemplate document={pdfData} />} fileName="Assistive_Devices.pdf" className="copy-btn pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div></div><div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search assistive devices..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div><div className="records-list">{!filtered.length ? <div className="no-results">No records match your search.</div> : filtered.map(({ record, index }) => {
    const id = recordIdOf(record) || `record-${index}`; const merged = recordWithEdits(record, index, true);
    return <div className="record-card" key={id}><div className="record-header"><h3 className="record-name">Assistive Device {index + 1}</h3></div>{SECTIONS.map(section => {
      if (!section.fields.some(field => hasValue(merged[field]))) return null;
      const pending = sectionPending(section, index); const approved = approvedSections[`${section.id}-${index}`];
      return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{section.title}</h4><div className="header-right-actions"><button className={`copy-btn${copied === `${id}-${section.id}` ? ' copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), `${id}-${section.id}`)}>{copied === `${id}-${section.id}` ? 'Copied!' : 'Copy Section'}</button>{(pending || approved) && <button className={`approve-btn${approved && !pending ? ' approved' : ' pending'}`} disabled={approving || !pending} onClick={() => approveSection(record, index, section)}>{approving ? 'Approving...' : approved && !pending ? 'Approved' : 'Pending Approve'}</button>}</div></div>{section.fields.map(field => hasValue(merged[field]) ? (NARRATIVE_FIELDS.has(field) ? renderNarrativeField(merged, field, index, section) : renderSimpleField(merged, field, index, section)) : null)}</div></div>;
    })}</div>;
  })}</div></div>;
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, splitClauses };
export default AssistiveDevicesDocument;
