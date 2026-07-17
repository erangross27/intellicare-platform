import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AutoimmuneEvaluationsDocumentPDFTemplate from '../pdf-templates/AutoimmuneEvaluationsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './AutoimmuneEvaluationsDocument.css';

const COLLECTION = 'autoimmune_evaluations';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = ['physicalExam', 'inflammatoryMarkers'];
const ARRAY_FIELDS = new Set(['symptoms', 'organInvolvement', 'treatment']);
const NARRATIVE_FIELDS = new Set(['imaging', 'biopsy', 'monitoring', 'notes']);
const DATE_FIELDS = new Set(['date']);
const FIELD_LABELS = {
  date: 'Date',
  rheumatologist: 'Rheumatologist',
  facility: 'Facility',
  suspectedCondition: 'Suspected Condition',
  diagnosis: 'Diagnosis',
  diseaseActivity: 'Disease Activity',
  symptoms: 'Symptoms',
  physicalExam: 'Physical Exam',
  serology: 'Serology',
  inflammatoryMarkers: 'Inflammatory Markers',
  organInvolvement: 'Organ Involvement',
  imaging: 'Imaging',
  biopsy: 'Biopsy',
  treatment: 'Treatment',
  monitoring: 'Monitoring',
  notes: 'Notes',
};
const SECTIONS = [
  { id: 'date', title: 'Date', fields: ['date'] },
  { id: 'recordInfo', title: 'Record Information', fields: ['rheumatologist', 'facility'] },
  { id: 'clinicalInfo', title: 'Clinical Information', fields: ['suspectedCondition', 'diagnosis', 'diseaseActivity'] },
  { id: 'symptoms', title: 'Symptoms', fields: ['symptoms'] },
  { id: 'physicalExam', title: 'Physical Exam', fields: ['physicalExam'] },
  { id: 'serology', title: 'Serology', fields: ['serology'] },
  { id: 'inflammatoryMarkers', title: 'Inflammatory Markers', fields: ['inflammatoryMarkers'] },
  { id: 'organInvolvement', title: 'Organ Involvement', fields: ['organInvolvement'] },
  { id: 'imaging', title: 'Imaging', fields: ['imaging'] },
  { id: 'biopsy', title: 'Biopsy', fields: ['biopsy'] },
  { id: 'treatment', title: 'Treatment', fields: ['treatment'] },
  { id: 'monitoring', title: 'Monitoring', fields: ['monitoring'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];
const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);

const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* best effort */ } };
const hasValue = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasValue)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasValue));
const recordIdOf = record => !record?._id ? null : typeof record._id === 'string' ? record._id : record._id.$oid || String(record._id);
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
const getAtPath = (source, path) => path.split('.').reduce((value, part) => value?.[/^\d+$/.test(part) ? Number(part) : part], source);
const setAtPath = (source, path, value) => {
  const parts = path.split('.');
  let node = source;
  parts.forEach((part, index) => {
    const key = /^\d+$/.test(part) ? Number(part) : part;
    if (index === parts.length - 1) node[key] = value;
    else {
      const nextIsArray = /^\d+$/.test(parts[index + 1]);
      if (node[key] === undefined || node[key] === null) node[key] = nextIsArray ? [] : {};
      node = node[key];
    }
  });
};
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(raw);
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
const toInputDate = value => {
  const raw = value?.$date || value;
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};
const displayValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true } : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitClauses = (field, text, splitCommas = COMMA_SPLIT_FIELDS.includes(field)) => {
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
    if (depth) continue;
    const sentenceBreak = (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    const commaBreak = splitCommas && character === ',';
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
    if (parsed.labeled) {
      current = { subtitle: parsed.label, items: [item] };
      groups.push(current);
    } else if (current?.subtitle) current.items.push(item);
    else {
      if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); }
      current.items.push(item);
    }
  });
  return groups;
};
const nestedLeaves = (value, prefix, labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const path = `${prefix}.${index}`;
    if (child && typeof child === 'object' && !child.$date) return nestedLeaves(child, path, `${labelPrefix || 'Item'} ${index + 1}`);
    return hasValue(child) ? [{ path, rowLabel: labelPrefix ? `${labelPrefix} ${index + 1}` : '', value: child }] : [];
  });
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    const label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key);
    if (child && typeof child === 'object' && !child.$date) return nestedLeaves(child, path, label);
    return hasValue(child) ? [{ path, rowLabel: label, value: child }] : [];
  });
};
const serologyGroups = value => Object.entries(value || {}).flatMap(([key, child]) => {
  if (!hasValue(child)) return [];
  const path = `serology.${key}`;
  const subtitle = humanize(key);
  if (Array.isArray(child)) return [{ subtitle, leaves: child.flatMap((item, index) => item && typeof item === 'object' && !item.$date ? nestedLeaves(item, `${path}.${index}`, `Item ${index + 1}`) : hasValue(item) ? [{ path: `${path}.${index}`, rowLabel: '', value: item }] : []) }];
  if (child && typeof child === 'object' && !child.$date) return [{ subtitle, leaves: nestedLeaves(child, path) }];
  return [{ subtitle, leaves: [{ path, rowLabel: '', value: child }] }];
});
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

const AutoimmuneEvaluationsDocument = ({ document: documentProp, data, templateData }) => {
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
      Object.entries(store[recordIdOf(record)] || {}).forEach(([path, value]) => {
        nextLocal[`${path}-${index}`] = value;
        nextPending[`${path}-${index}`] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits(previous => ({ ...nextLocal, ...previous }));
      setPendingEdits(previous => ({ ...nextPending, ...previous }));
    }
  }, [records]);

  const valueAt = useCallback((record, path, index) => localEdits[`${path}-${index}`] !== undefined ? localEdits[`${path}-${index}`] : getAtPath(record, path), [localEdits]);
  const stagePath = useCallback((record, path, index, value) => {
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
  const copyText = async (text, id) => { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2500); };
  const highlight = value => {
    const text = String(value ?? '');
    const query = searchTerm.trim();
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    return index < 0 ? text : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
  };
  const sectionPending = (section, index) => Object.keys(pendingEdits).some(key => pendingEdits[key] && key.endsWith(`-${index}`) && section.fields.includes(key.slice(0, -String(index).length - 1).split('.')[0]));
  const approveSection = async (record, index, section) => {
    const id = recordIdOf(record);
    if (!id) return;
    const keys = Object.keys(pendingEdits).filter(key => pendingEdits[key] && key.endsWith(`-${index}`) && section.fields.includes(key.slice(0, -String(index).length - 1).split('.')[0]));
    if (!keys.length) return;
    setApproving(true);
    try {
      for (const key of keys) {
        const path = key.slice(0, -String(index).length - 1);
        const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, { field: path, value: localEdits[key] });
        if (response?.success === false) throw new Error(response.error || 'save failed');
      }
      const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`, { sectionId: section.id, approved: true });
      if (response?.success === false) throw new Error(response.error || 'approval failed');
      setPendingEdits(previous => { const next = { ...previous }; keys.forEach(key => delete next[key]); return next; });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach(key => delete store[id][key.slice(0, -String(index).length - 1)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(previous => ({ ...previous, [`${section.id}-${index}`]: true }));
    } catch (error) {
      setSaveError(error.message || 'Unable to approve changes');
    } finally {
      setApproving(false);
    }
  };
  const editControl = (widget, options) => {
    if (widget === 'date') return <BlueDatePicker value={editValue} onSelect={setEditValue} />;
    if (widget === 'boolean') return <BlueSelect value={editValue} options={options} onChange={setEditValue} />;
    if (widget === 'number') return <div className="num-stepper-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>&minus;</button><input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={event => setEditValue(event.target.value.replace(/[^0-9.-]/g, ''))} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div>;
    return <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />;
  };
  const renderLeaf = ({ record, index, path, shown, raw, label, widget = 'text', options = [], leafKey, saveValue }) => {
    const editKey = leafKey || `${path}-${index}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[`${path}-${index}`];
    const save = event => {
      event?.stopPropagation();
      if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      let next;
      if (saveValue) next = saveValue(editValue);
      else if (widget === 'date') next = `${editValue}T00:00:00.000Z`;
      else if (widget === 'number') next = Number(editValue);
      else if (widget === 'boolean') next = editValue === 'Yes';
      else next = String(editValue).trim();
      stagePath(record, path, index, next);
    };
    return <div data-edit-field={path} key={editKey}><span className="field-label sr-only">{label || path}</span><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => { if (!editing) { setEditingField(editKey); setEditValue(widget === 'date' ? toInputDate(raw) : widget === 'boolean' ? displayValue(raw) : String(raw ?? '')); setSaveError(''); } }}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{editControl(widget, options)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(String(shown), editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };
  const widgetFor = (path, value) => DATE_FIELDS.has(path) || /(?:^|\.)(?:date|reviewDate)$/i.test(path) ? 'date' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text';
  const renderScalar = (record, index, path, label, sectionTitle) => {
    const value = valueAt(record, path, index);
    if (!hasValue(value)) return null;
    const widget = widgetFor(path, value);
    const shown = widget === 'date' ? formatDate(value) : displayValue(value);
    return <div className={`rec-mini-card nested-mini-card${label === sectionTitle ? ' regular-row-group' : ''}`} key={path}>{label !== sectionTitle && <div className="nested-subtitle field-label">{label}</div>}{renderLeaf({ record, index, path, shown, raw: value, label, widget, options: widget === 'boolean' ? ['Yes', 'No'] : [] })}</div>;
  };
  const renderArray = (record, index, field) => {
    const values = valueAt(record, field, index);
    if (!Array.isArray(values) || !values.some(hasValue)) return null;
    return <div className="rec-mini-card nested-mini-card regular-row-group" key={field}>{values.map((value, itemIndex) => hasValue(value) ? renderLeaf({ record, index, path: `${field}.${itemIndex}`, shown: displayValue(value), raw: value, label: FIELD_LABELS[field] }) : null)}</div>;
  };
  const renderSerology = (record, index) => {
    const value = valueAt(record, 'serology', index);
    if (!value || typeof value !== 'object') return null;
    return serologyGroups(value).map(group => <div className="rec-mini-card nested-mini-card" key={group.subtitle}><div className="nested-subtitle field-label">{group.subtitle}</div>{group.leaves.map(leaf => { const current = valueAt(record, leaf.path, index); const widget = widgetFor(leaf.path, current); const rendered = widget === 'date' ? formatDate(current) : displayValue(current); const shown = leaf.rowLabel ? `${leaf.rowLabel} — ${rendered}` : rendered; return renderLeaf({ record, index, path: leaf.path, shown, raw: current, label: leaf.rowLabel || group.subtitle, widget, options: widget === 'boolean' ? ['Yes', 'No'] : [] }); })}</div>);
  };
  const renderDelimited = (record, index, field, sectionTitle) => {
    const source = String(valueAt(record, field, index) || '');
    if (!source.trim()) return null;
    return groupClauses(splitClauses(field, source)).map((group, groupIndex) => <div className={`rec-mini-card nested-mini-card${group.subtitle ? '' : ' regular-row-group'}`} key={`${field}-${groupIndex}`}>{group.subtitle && <div className="nested-subtitle">{group.subtitle}</div>}{group.items.map(item => renderLeaf({ record, index, path: field, leafKey: `${field}-${index}-clause-${item.index}`, shown: item.value, raw: item.value, label: group.subtitle || sectionTitle, saveValue: next => source.slice(0, item.start) + (item.labeled ? `${item.label}: ${String(next).trim()}` : String(next).trim()) + source.slice(item.end) }))}</div>);
  };
  const rowsFor = (record, field) => {
    const value = record[field];
    if (!hasValue(value)) return [];
    if (field === 'date') return [{ subtitle: '', value: formatDate(value) }];
    if (ARRAY_FIELDS.has(field)) return value.filter(hasValue).map(item => ({ subtitle: '', value: displayValue(item) }));
    if (field === 'serology') return serologyGroups(value).flatMap(group => group.leaves.map(leaf => {
      const widget = widgetFor(leaf.path, leaf.value);
      const rendered = widget === 'date' ? formatDate(leaf.value) : displayValue(leaf.value);
      return { subtitle: group.subtitle, value: leaf.rowLabel ? `${leaf.rowLabel} — ${rendered}` : rendered };
    }));
    if (COMMA_SPLIT_FIELDS.includes(field) || NARRATIVE_FIELDS.has(field)) return splitClauses(field, value).map(clause => { const parsed = parseLabel(clause.text); return { subtitle: parsed.label, value: parsed.value }; });
    return [{ subtitle: '', value: displayValue(value) }];
  };
  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '-'.repeat(40)];
    section.fields.forEach(field => {
      const rows = rowsFor(record, field);
      if (!rows.length) return;
      if (FIELD_LABELS[field] !== section.title) lines.push(FIELD_LABELS[field]);
      let priorSubtitle = null;
      rows.forEach((row, rowIndex) => {
        if (row.subtitle && row.subtitle !== priorSubtitle) lines.push(row.subtitle);
        lines.push(`${rowIndex + 1}. ${row.value}`);
        priorSubtitle = row.subtitle;
      });
    });
    return lines;
  };
  const renderSection = (record, index, section) => {
    const merged = mergedRecord(record, index, true);
    if (!section.fields.some(field => hasValue(merged[field]))) return null;
    const body = section.fields.flatMap(field => {
      if (!hasValue(merged[field])) return [];
      if (ARRAY_FIELDS.has(field)) return [renderArray(record, index, field)];
      if (field === 'serology') return renderSerology(record, index);
      if (COMMA_SPLIT_FIELDS.includes(field) || NARRATIVE_FIELDS.has(field)) return renderDelimited(record, index, field, section.title);
      return [renderScalar(record, index, field, FIELD_LABELS[field], section.title)];
    }).filter(Boolean);
    const copyId = `${section.id}-${index}`;
    const pending = sectionPending(section, index);
    const approved = approvedSections[copyId];
    return <section className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">{section.title}</h3><div className="header-right-actions"><button className={`copy-btn ${copied === copyId ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), copyId)}>{copied === copyId ? 'Copied!' : 'Copy Section'}</button>{pending && <button className="approve-btn pending" disabled={approving} onClick={() => approveSection(record, index, section)}>Pending Approve</button>}{approved && !pending && <span className="approve-btn approved">Approved</span>}</div></div>{body}</div></section>;
  };
  const allText = (record, index) => {
    const merged = mergedRecord(record, index, true);
    const lines = [`AUTOIMMUNE EVALUATION ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => { const output = sectionLines(merged, section); if (output.length > 2) lines.push('', ...output); });
    return lines.join('\n');
  };
  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const values = records.map((record, index) => ({ record, index }));
    return query ? values.filter(({ record, index }) => JSON.stringify(mergedRecord(record, index, true)).toLowerCase().includes(query) || 'autoimmune evaluations'.includes(query)) : values;
  }, [records, searchTerm, mergedRecord]);

  if (!records.length) return <article className="autoimmune-evaluations-document"><div className="empty-state">No autoimmune evaluation data available.</div></article>;
  return <article className="autoimmune-evaluations-document"><header className="document-header"><h1 className="document-title">Autoimmune Evaluations</h1><div className="header-actions"><button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AutoimmuneEvaluationsDocumentPDFTemplate document={pdfData} />} fileName="Autoimmune_Evaluations.pdf" className="copy-btn pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div></header><div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search autoimmune evaluations..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div><div className="records-container">{!filtered.length ? <div className="empty-state">No records match your search.</div> : filtered.map(({ record, index }) => <div className="record-card" key={recordIdOf(record) || index}><div className="record-header"><h2 className="record-name">Autoimmune Evaluation {index + 1}</h2></div>{SECTIONS.map(section => renderSection(record, index, section))}</div>)}</div></article>;
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, splitClauses };
export default AutoimmuneEvaluationsDocument;
