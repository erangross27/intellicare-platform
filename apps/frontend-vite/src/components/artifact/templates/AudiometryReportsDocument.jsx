import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AudiometryReportsDocumentPDFTemplate from '../pdf-templates/AudiometryReportsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './AudiometryReportsDocument.css';

const COLLECTION = 'audiometry_reports';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = ['testType', 'speechReception', 'wordRecognition', 'hearingLossSeverity', 'interpretation', 'recommendations'];

const SECTIONS = [
  { id: 'recordInfo', title: 'Record Information', fields: ['date', 'audiologist', 'facility'] },
  { id: 'testInfo', title: 'Test Information', fields: ['testType', 'hearingLossType', 'hearingLossSeverity'] },
  { id: 'audiogramOverview', title: 'Audiogram Overview', fields: ['rightEarThresholds', 'leftEarThresholds'] },
  { id: 'speechResults', title: 'Speech Results', fields: ['speechReception', 'wordRecognition'] },
  { id: 'middleEarFunction', title: 'Middle Ear Function', fields: ['tympanometry', 'acousticReflex'] },
  { id: 'interpretation', title: 'Interpretation', fields: ['interpretation'] },
  { id: 'recommendations', title: 'Recommendations', fields: ['recommendations'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];

const FIELD_LABELS = {
  date: 'Date',
  audiologist: 'Audiologist',
  facility: 'Facility',
  testType: 'Test Type',
  hearingLossType: 'Hearing Loss Type',
  hearingLossSeverity: 'Hearing Loss Severity',
  rightEarThresholds: 'Right Ear Thresholds',
  leftEarThresholds: 'Left Ear Thresholds',
  speechReception: 'Speech Reception Threshold',
  wordRecognition: 'Word Recognition',
  tympanometry: 'Tympanometry',
  acousticReflex: 'Acoustic Reflexes',
  interpretation: 'Interpretation',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);
const DATE_FIELDS = new Set(['date']);
const THRESHOLD_FIELDS = new Set(['rightEarThresholds', 'leftEarThresholds']);
const NARRATIVE_FIELDS = new Set(COMMA_SPLIT_FIELDS);

const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = store => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* local drafts are best effort */ }
};
const hasValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};
const recordIdOf = record => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  if (record._id.$oid) return record._id.$oid;
  return String(record._id);
};
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(raw);
  try {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch { return String(raw); }
};
const toInputDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};
const getAtPath = (source, path) => path.split('.').reduce((value, part) => value?.[/^\d+$/.test(part) ? Number(part) : part], source);
const setAtPath = (source, path, value) => {
  const parts = path.split('.');
  let node = source;
  parts.forEach((part, index) => {
    const key = /^\d+$/.test(part) ? Number(part) : part;
    if (index === parts.length - 1) node[key] = value;
    else {
      const nextIsIndex = /^\d+$/.test(parts[index + 1]);
      if (node[key] === undefined || node[key] === null) node[key] = nextIsIndex ? [] : {};
      node = node[key];
    }
  });
};
const getFrequencyKeys = thresholds => Object.keys(thresholds || {}).sort((left, right) => {
  const leftNumber = Number.parseFloat(left);
  const rightNumber = Number.parseFloat(right);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return String(left).localeCompare(String(right));
  return leftNumber - rightNumber;
});
const formatFrequency = value => /hz$/i.test(String(value)) ? String(value) : `${value}Hz`;
const thresholdText = value => typeof value === 'number' ? `${value} dB` : String(value ?? '');
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitClauses = (field, text) => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const clauses = [];
  let start = 0;
  let depth = 0;
  const push = end => {
    let left = start;
    let right = end;
    while (left < right && /\s/.test(source[left])) left += 1;
    while (right > left && /\s/.test(source[right - 1])) right -= 1;
    if (right > left) clauses.push({ text: source.slice(left, right), start: left, end: right });
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') { depth += 1; continue; }
    if (character === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const sentenceBreak = (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (character === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = source.slice(start, index).trim();
      const after = source.slice(index + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (!sentenceBreak && !commaBreak) continue;
    push(index);
    start = index + 1;
  }
  push(source.length);
  return clauses;
};
const groupClauses = clauses => {
  const groups = [];
  let current = null;
  clauses.forEach((clause, index) => {
    const parsed = parseLabel(clause.text);
    const item = { ...clause, ...parsed, index };
    if (parsed.labeled) { current = { subtitle: parsed.label, items: [item] }; groups.push(current); }
    else if (current?.subtitle) current.items.push(item);
    else {
      if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); }
      current.items.push(item);
    }
  });
  return groups;
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

const AudiometryReportsDocument = ({ document: documentProp, data, templateData }) => {
  const records = useMemo(() => unwrapRecords(documentProp || data || templateData), [documentProp, data, templateData]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const store = readDrafts();
    const nextLocal = {};
    const nextPending = {};
    records.forEach((record, index) => {
      const drafts = store[recordIdOf(record)] || {};
      Object.entries(drafts).forEach(([path, value]) => {
        nextLocal[`${path}-${index}`] = value;
        nextPending[`${path}-${index}`] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits(previous => ({ ...nextLocal, ...previous }));
      setPendingEdits(previous => ({ ...nextPending, ...previous }));
    }
  }, [records]);

  const valueAt = useCallback((record, path, index) => {
    const key = `${path}-${index}`;
    return localEdits[key] !== undefined ? localEdits[key] : getAtPath(record, path);
  }, [localEdits]);
  const stageDraft = useCallback((record, path, index, value) => {
    const id = recordIdOf(record);
    if (!id) return;
    const key = `${path}-${index}`;
    setLocalEdits(previous => ({ ...previous, [key]: value }));
    setPendingEdits(previous => ({ ...previous, [key]: true }));
    const store = readDrafts();
    store[id] = { ...(store[id] || {}), [path]: value };
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError('');
  }, []);
  const mergedRecord = useCallback((record, index, includePending) => {
    const merged = JSON.parse(JSON.stringify(record));
    Object.entries(localEdits).forEach(([key, value]) => {
      if (!key.endsWith(`-${index}`) || (!includePending && pendingEdits[key])) return;
      setAtPath(merged, key.slice(0, -String(index).length - 1), value);
    });
    return merged;
  }, [localEdits, pendingEdits]);
  const pdfData = useMemo(() => records.map((record, index) => mergedRecord(record, index, false)), [records, mergedRecord]);

  const copyText = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };
  const highlight = value => {
    const text = String(value ?? '');
    const query = searchTerm.trim();
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
  };
  const startEdit = (key, value) => { setEditingField(key); setEditValue(String(value ?? '')); setSaveError(''); };
  const cancelEdit = () => { setEditingField(null); setEditValue(''); setSaveError(''); };
  const sectionPending = (section, index) => Object.keys(pendingEdits).some(key => {
    if (!pendingEdits[key] || !key.endsWith(`-${index}`)) return false;
    const path = key.slice(0, -String(index).length - 1);
    return section.fields.includes(path.split('.')[0]);
  });
  const approveSection = async (record, index, section) => {
    const id = recordIdOf(record);
    if (!id) return;
    const keys = Object.keys(pendingEdits).filter(key => {
      if (!pendingEdits[key] || !key.endsWith(`-${index}`)) return false;
      const path = key.slice(0, -String(index).length - 1);
      return section.fields.includes(path.split('.')[0]);
    });
    if (!keys.length) return;
    setApproving(true);
    try {
      for (const key of keys) {
        const path = key.slice(0, -String(index).length - 1);
        const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, { field: path, value: localEdits[key] });
        if (!response?.success) throw new Error(response?.error || 'save failed');
      }
      const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`, { sectionId: section.id, approved: true });
      if (!response?.success) throw new Error(response?.error || 'approval failed');
      setPendingEdits(previous => { const next = { ...previous }; keys.forEach(key => delete next[key]); return next; });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach(key => delete store[id][key.slice(0, -String(index).length - 1)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(previous => ({ ...previous, [`${section.id}-${index}`]: true }));
    } catch (error) { setSaveError(error.message || 'Unable to approve changes'); }
    finally { setApproving(false); }
  };
  const renderApproveButton = (record, index, section) => {
    const pending = sectionPending(section, index);
    const approved = approvedSections[`${section.id}-${index}`];
    if (!pending && !approved) return null;
    return <button className={`approve-btn${approved && !pending ? ' approved' : ' pending'}`} disabled={approving || !pending} onClick={() => approveSection(record, index, section)}>{approving ? 'Approving...' : approved && !pending ? 'Approved' : 'Pending Approve'}</button>;
  };
  const editControl = widget => {
    if (widget === 'date') return <BlueDatePicker value={editValue} onSelect={setEditValue} />;
    if (widget === 'number') return <div className="num-stepper-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>&minus;</button><input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={event => setEditValue(event.target.value.replace(/[^0-9.-]/g, ''))} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div>;
    return <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />;
  };
  const renderLeaf = ({ record, index, path, displayValue, initialValue, saveValue, widget = 'text', leafKey, fieldLabel }) => {
    const editKey = leafKey || `${path}-${index}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[`${path}-${index}`];
    const shown = String(displayValue ?? '');
    const save = event => {
      event?.stopPropagation();
      if (widget === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(editValue) || Number.isNaN(new Date(editValue).getTime()))) { setSaveError('Please choose a valid date'); return; }
      if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      let next;
      if (saveValue) next = saveValue(editValue);
      else if (widget === 'date') next = `${editValue}T00:00:00.000Z`;
      else if (widget === 'number') next = Number(editValue);
      else next = String(editValue).trim();
      stageDraft(record, path, index, next);
    };
    return <div data-edit-field={path} key={editKey}>{fieldLabel && <span className="field-label sr-only">{fieldLabel}</span>}<div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, initialValue ?? shown)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{editControl(widget)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(shown, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };
  const renderSimplePath = (record, index, path, label, widget = 'text', hideLabel = false) => {
    const value = valueAt(record, path, index);
    if (!hasValue(value)) return null;
    const shown = widget === 'date' ? formatDate(value) : String(value);
    const initial = widget === 'date' ? toInputDate(value) : shown;
    return <div className={`rec-mini-card nested-mini-card${hideLabel ? ' regular-row-group' : ''}`} key={path}>{!hideLabel && <div className="nested-subtitle field-label">{label}</div>}{renderLeaf({ record, index, path, displayValue: shown, initialValue: initial, widget, fieldLabel: label })}</div>;
  };
  const renderThresholds = (record, index, path, label) => {
    const thresholds = valueAt(record, path, index);
    if (!thresholds || typeof thresholds !== 'object') return null;
    const keys = getFrequencyKeys(thresholds).filter(frequency => hasValue(thresholds[frequency]));
    if (!keys.length) return null;
    return <div className="threshold-field-group" key={path}><div className="field-heading">{label}</div>{keys.map(frequency => {
      const itemPath = `${path}.${frequency}`;
      const value = valueAt(record, itemPath, index);
      const numeric = typeof value === 'number';
      return <div className="rec-mini-card nested-mini-card" key={itemPath}><div className="nested-subtitle field-label">{formatFrequency(frequency)}</div>{renderLeaf({ record, index, path: itemPath, displayValue: thresholdText(value), initialValue: value, widget: numeric ? 'number' : 'text', fieldLabel: formatFrequency(frequency) })}</div>;
    })}</div>;
  };
  const renderNarrativePath = (record, index, path, label) => {
    const source = String(valueAt(record, path, index) || '');
    if (!source.trim()) return null;
    const groups = groupClauses(splitClauses(path, source));
    return <div className="narrative-field-group" key={path}><div className="field-heading">{highlight(label)}</div>{groups.map((group, groupIndex) => <div className={`rec-mini-card nested-mini-card${group.subtitle ? '' : ' regular-row-group'}`} key={`${path}-${groupIndex}`}>{group.subtitle && <div className="nested-subtitle">{highlight(group.subtitle)}</div>}{group.items.map(item => renderLeaf({ record, index, path, leafKey: `${path}-${index}-clause-${item.index}`, displayValue: item.value, initialValue: item.value, saveValue: next => source.slice(0, item.start) + (item.labeled ? `${item.label}: ${String(next).trim()}` : String(next).trim()) + source.slice(item.end), fieldLabel: group.subtitle || label }))}</div>)}</div>;
  };

  const fieldLines = (record, field) => {
    const value = record[field];
    if (!hasValue(value)) return [];
    const lines = [FIELD_LABELS[field]];
    if (DATE_FIELDS.has(field)) return [...lines, `1. ${formatDate(value)}`];
    if (THRESHOLD_FIELDS.has(field)) {
      getFrequencyKeys(value).filter(frequency => hasValue(value[frequency])).forEach(frequency => lines.push(formatFrequency(frequency), `1. ${thresholdText(value[frequency])}`));
      return lines;
    }
    if (NARRATIVE_FIELDS.has(field)) splitClauses(field, value).forEach((clause, clauseIndex) => { const parsed = parseLabel(clause.text); if (parsed.labeled) lines.push(parsed.label); lines.push(`${clauseIndex + 1}. ${parsed.value}`); });
    else lines.push(`1. ${String(value)}`);
    return lines;
  };
  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '-'.repeat(40)];
    section.fields.forEach(field => lines.push(...fieldLines(record, field)));
    return lines;
  };
  const allText = (record, index) => {
    const merged = mergedRecord(record, index, true);
    const lines = [`AUDIOMETRY REPORT ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => { const output = sectionLines(merged, section); if (output.length > 2) lines.push('', ...output); });
    return lines.join('\n');
  };
  const renderSection = (record, index, section) => {
    const merged = mergedRecord(record, index, true);
    if (!section.fields.some(field => hasValue(merged[field]))) return null;
    const body = section.fields.map(field => {
      if (!hasValue(merged[field])) return null;
      if (DATE_FIELDS.has(field)) return renderSimplePath(record, index, field, FIELD_LABELS[field], 'date');
      if (THRESHOLD_FIELDS.has(field)) return renderThresholds(record, index, field, FIELD_LABELS[field]);
      if (NARRATIVE_FIELDS.has(field)) return renderNarrativePath(record, index, field, FIELD_LABELS[field]);
      return renderSimplePath(record, index, field, FIELD_LABELS[field], 'text', section.title === FIELD_LABELS[field]);
    }).filter(Boolean);
    if (!body.length) return null;
    const copyId = `${recordIdOf(record) || index}-${section.id}`;
    return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">{section.title}</h3><div className="header-right-actions"><button className={`copy-btn ${copied === copyId ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), copyId)}>{copied === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, index, section)}</div></div>{body}</div></div>;
  };
  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const values = records.map((record, index) => ({ record, index }));
    if (!query) return values;
    return values.filter(({ record, index }) => JSON.stringify(mergedRecord(record, index, true)).toLowerCase().includes(query) || 'audiometry reports'.includes(query));
  }, [records, searchTerm, mergedRecord]);

  if (!records.length) return <article className="audiometry-reports-document"><div className="empty-state">No audiometry reports available.</div></article>;
  return <article className="audiometry-reports-document"><header className="document-header"><h1 className="document-title">Audiometry Reports</h1><div className="header-actions"><button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AudiometryReportsDocumentPDFTemplate document={pdfData} />} fileName="Audiometry_Reports.pdf" className="copy-btn pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div></header><div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search audiometry reports..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div><div className="records-container">{!filtered.length ? <div className="empty-state">No records match your search.</div> : filtered.map(({ record, index }) => <div className="record-card" key={recordIdOf(record) || index}><div className="record-header"><h2 className="record-name">Audiometry Report {index + 1}</h2></div>{SECTIONS.map(section => renderSection(record, index, section))}</div>)}</div></article>;
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, splitClauses };
export default AudiometryReportsDocument;
