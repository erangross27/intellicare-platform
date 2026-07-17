import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AthleteSpecificDataDocumentPDFTemplate from '../pdf-templates/AthleteSpecificDataDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './AthleteSpecificDataDocument.css';

const COLLECTION = 'athlete_specific_data';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = ['assessment'];

const SECTIONS = [
  { id: 'recordInfo', title: 'Record Information', fields: ['date', 'type', 'provider', 'facility', 'status'] },
  { id: 'sportProfile', title: 'Sport Profile', fields: ['sport', 'position', 'professionalLevel', 'teamSupport'] },
  { id: 'previousInjuries', title: 'Previous Injuries', fields: ['previousInjuries'] },
  { id: 'supportCompliance', title: 'Support & Compliance', fields: ['psychologicalSupport', 'antiDopingNotification'] },
  { id: 'findings', title: 'Findings', fields: ['findings'] },
  { id: 'assessment', title: 'Assessment', fields: ['assessment'] },
  { id: 'plan', title: 'Plan', fields: ['plan'] },
  { id: 'recommendations', title: 'Recommendations', fields: ['recommendations'] },
  { id: 'results', title: 'Results', fields: ['results'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];

const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status', sport: 'Sport',
  position: 'Position', professionalLevel: 'Professional Level', teamSupport: 'Team Support',
  previousInjuries: 'Previous Injuries', psychologicalSupport: 'Psychological Support',
  antiDopingNotification: 'Anti-Doping Notification', findings: 'Findings', assessment: 'Assessment',
  plan: 'Plan', recommendations: 'Recommendations', results: 'Results', notes: 'Notes',
};
const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);
const BOOLEAN_FIELDS = new Set(['professionalLevel', 'teamSupport', 'psychologicalSupport', 'antiDopingNotification']);
const NARRATIVE_FIELDS = new Set(['findings', 'assessment', 'plan', 'notes']);
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];

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
const humanize = value => {
  const text = String(value ?? '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  if (/^\d{4}$/.test(String(raw))) return String(raw);
  try {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(raw); }
};
const toInputDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return '';
  try {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  } catch { return ''; }
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
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"<>-]{1,80}?):\s+([\s\S]+)$/);
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
    const char = source[index];
    if (char === '(') { depth += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const sentenceBreak = (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
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
const enumOptionsWith = (current, base) => {
  const cur = String(current || '').trim();
  if (!cur || base.some(o => o.toLowerCase() === cur.toLowerCase())) return base;
  return [...base, cur];
};

const AthleteSpecificDataDocument = ({ document: documentProp, data, templateData }) => {
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
  const editControl = (widget, options = []) => {
    if (widget === 'date') return <BlueDatePicker value={editValue} onSelect={setEditValue} />;
    if (widget === 'boolean' || widget === 'enum') return <BlueSelect value={editValue} options={options} onChange={setEditValue} />;
    if (widget === 'number') return <div className="num-stepper-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>&minus;</button><input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} onChange={event => setEditValue(event.target.value.replace(/[^0-9.-]/g, ''))} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div>;
    return <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />;
  };
  const renderLeaf = ({ record, index, path, displayValue, initialValue, saveValue, widget = 'text', options = [], leafKey }) => {
    const editKey = leafKey || `${path}-${index}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[`${path}-${index}`];
    const shown = String(displayValue ?? '');
    const save = event => {
      event?.stopPropagation();
      if (widget === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(editValue) || Number.isNaN(new Date(editValue).getTime()))) { setSaveError('Please choose a valid date'); return; }
      if (widget !== 'boolean' && !String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      let next;
      if (saveValue) next = saveValue(editValue);
      else if (widget === 'date') next = `${editValue}T00:00:00.000Z`;
      else if (widget === 'boolean') next = String(editValue).toLowerCase() === 'yes';
      else if (widget === 'number') next = Number(editValue);
      else next = String(editValue).trim();
      stageDraft(record, path, index, next);
    };
    return <div data-edit-field={path} key={editKey}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, initialValue ?? shown)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{editControl(widget, options)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(shown, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };
  const renderSimplePath = (record, index, path, label, widget = 'text', options = [], saveValue) => {
    const value = valueAt(record, path, index);
    if (!hasValue(value)) return null;
    const shown = widget === 'date' ? formatDate(value) : widget === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    const initial = widget === 'date' ? toInputDate(value) : shown;
    return <div className="rec-mini-card nested-mini-card" key={path}><div className="nested-subtitle field-label">{label}</div>{renderLeaf({ record, index, path, displayValue: shown, initialValue: initial, widget, options, saveValue })}</div>;
  };
  const renderNarrativePath = (record, index, path, label, showLabel = false) => {
    const source = String(valueAt(record, path, index) || '');
    if (!source.trim()) return null;
    const groups = groupClauses(splitClauses(path.split('.')[0], source));
    return groups.map((group, groupIndex) => {
      const subtitle = group.subtitle || (showLabel ? label : null);
      return <div className={`rec-mini-card nested-mini-card${subtitle ? '' : ' regular-row-group'}`} key={`${path}-${groupIndex}`}>{subtitle && <div className="nested-subtitle">{highlight(subtitle)}</div>}{group.items.map(item => renderLeaf({ record, index, path, leafKey: `${path}-${index}-clause-${item.index}`, displayValue: item.value, initialValue: item.value, saveValue: next => source.slice(0, item.start) + (item.labeled ? `${item.label}: ${String(next).trim()}` : String(next).trim()) + source.slice(item.end) }))}</div>;
    });
  };
  const renderDateSubtitle = (record, index, paths, value, key) => {
    if (!paths.length || !hasValue(value)) return null;
    const fullDate = !!toInputDate(value);
    const widget = fullDate ? 'date' : /^\d{4}$/.test(String(value)) ? 'number' : 'text';
    const editing = editingField === key;
    const modified = paths.some(path => pendingEdits[`${path}-${index}`]);
    const shown = formatDate(value);
    const save = event => {
      event.stopPropagation();
      if (widget === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(editValue)) { setSaveError('Please choose a valid date'); return; }
      if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      const next = widget === 'date' ? `${editValue}T00:00:00.000Z` : String(editValue).trim();
      paths.forEach(path => stageDraft(record, path, index, next));
    };
    return <div className="editable-date-subtitle" data-edit-field={paths[0]} data-edit-fields={paths.join(',')}><div className={`nested-subtitle date-subtitle editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(key, fullDate ? toInputDate(value) : String(value))}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{editControl(widget)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div></div> : <><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></>}</div></div>;
  };
  const groupByDate = (items, datePath) => {
    const groups = new Map();
    items.forEach(item => {
      const value = getAtPath(item.value, datePath);
      const key = toInputDate(value) || String(value || 'no-date');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()];
  };
  const renderPreviousInjuries = (record, index) => {
    const injuries = valueAt(record, 'previousInjuries', index);
    if (!Array.isArray(injuries) || !injuries.some(hasValue)) return null;
    const indexed = injuries.map((value, itemIndex) => ({ value, itemIndex })).filter(item => hasValue(item.value));
    return groupByDate(indexed, 'date').map(([dateKey, entries], groupIndex) => <div className="rec-mini-card nested-mini-card" key={`${dateKey}-${groupIndex}`}>{dateKey !== 'no-date' && renderDateSubtitle(record, index, entries.map(({ itemIndex }) => `previousInjuries.${itemIndex}.date`), entries[0].value.date, `previousInjuries-date-${groupIndex}-${index}`)}{entries.map(({ value, itemIndex }) => <div className="nested-mini-card injury-card" key={itemIndex}><div className="nested-subtitle">Injury {itemIndex + 1}</div>{hasValue(value.injury) && renderSimplePath(record, index, `previousInjuries.${itemIndex}.injury`, 'Injury')}{hasValue(value.recovery) && renderSimplePath(record, index, `previousInjuries.${itemIndex}.recovery`, 'Recovery')}</div>)}</div>);
  };
  const renderRecommendations = (record, index) => {
    const recommendations = valueAt(record, 'recommendations', index);
    if (!Array.isArray(recommendations) || !recommendations.some(hasValue)) return null;
    const indexed = recommendations.map((value, itemIndex) => ({ value, itemIndex })).filter(item => hasValue(item.value));
    return groupByDate(indexed, 'date').map(([dateKey, entries], groupIndex) => <div className="rec-mini-card nested-mini-card recommendation-group" key={`${dateKey}-${groupIndex}`}>{dateKey !== 'no-date' && renderDateSubtitle(record, index, entries.map(({ itemIndex }) => `recommendations.${itemIndex}.date`), entries[0].value.date, `recommendations-date-${groupIndex}-${index}`)}<div className="nested-mini-card regular-row-group">{entries.flatMap(({ value, itemIndex }) => {
      if (!hasValue(value.recommendation)) return [];
      const path = `recommendations.${itemIndex}.recommendation`;
      const source = String(valueAt(record, path, index) || '');
      return splitClauses('recommendations', source).map((clause, clauseIndex) => renderLeaf({ record, index, path, leafKey: `${path}-${index}-clause-${clauseIndex}`, displayValue: clause.text, initialValue: clause.text, saveValue: next => source.slice(0, clause.start) + String(next).trim() + source.slice(clause.end) }));
    })}</div></div>);
  };
  const renderObjectNode = (record, index, rootPath, value, label) => {
    if (!hasValue(value)) return null;
    if (value === null || typeof value !== 'object') {
      const widget = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : toInputDate(value) ? 'date' : 'text';
      return renderSimplePath(record, index, rootPath, label, widget, widget === 'boolean' ? ['Yes', 'No'] : [], widget === 'number' ? next => Number(next) : undefined);
    }
    const entries = Object.entries(value).filter(([, child]) => hasValue(child));
    if (!entries.length) return null;
    return <div className="rec-mini-card nested-mini-card" key={rootPath}>{label && <div className="nested-subtitle">{label}</div>}{entries.map(([key, child]) => renderObjectNode(record, index, `${rootPath}.${key}`, child, humanize(key)))}</div>;
  };

  const flatObjectLines = (value, path = '') => {
    if (!hasValue(value)) return [];
    if (value === null || typeof value !== 'object') return [path ? humanize(path.split('.').pop()) : '', toInputDate(value) ? formatDate(value) : String(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value)];
    return Object.entries(value).filter(([, child]) => hasValue(child)).flatMap(([key, child]) => flatObjectLines(child, path ? `${path}.${key}` : key));
  };
  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '-'.repeat(40)];
    section.fields.forEach(field => {
      const value = record[field];
      if (!hasValue(value)) return;
      if (field === 'previousInjuries') {
        groupByDate(value.map((item, itemIndex) => ({ value: item, itemIndex })), 'date').forEach(([, entries]) => {
          if (hasValue(entries[0].value.date)) lines.push(formatDate(entries[0].value.date));
          entries.forEach(({ value: injury, itemIndex }) => { if (hasValue(injury.injury)) lines.push(`Injury ${itemIndex + 1}`, injury.injury); if (hasValue(injury.recovery)) lines.push('Recovery', injury.recovery); });
        });
        return;
      }
      if (field === 'recommendations') {
        groupByDate(value.map((item, itemIndex) => ({ value: item, itemIndex })), 'date').forEach(([, entries]) => {
          if (hasValue(entries[0].value.date)) lines.push(formatDate(entries[0].value.date));
          entries.forEach(({ value: recommendation }) => splitClauses('recommendations', recommendation.recommendation).forEach((clause, clauseIndex) => lines.push(`${clauseIndex + 1}. ${clause.text}`)));
        });
        return;
      }
      if (field === 'results') { lines.push(...flatObjectLines(value)); return; }
      if (NARRATIVE_FIELDS.has(field)) {
        splitClauses(field, value).forEach((clause, clauseIndex) => { const parsed = parseLabel(clause.text); if (parsed.labeled) lines.push(parsed.label); lines.push(`${clauseIndex + 1}. ${parsed.value}`); });
        return;
      }
      lines.push(FIELD_LABELS[field]);
      lines.push(field === 'date' ? formatDate(value) : BOOLEAN_FIELDS.has(field) ? (value ? 'Yes' : 'No') : String(value));
    });
    return lines;
  };
  const allText = (record, index) => {
    const merged = mergedRecord(record, index, true);
    const lines = [`ATHLETE SPECIFIC DATA ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => { const output = sectionLines(merged, section); if (output.length > 2) lines.push('', ...output); });
    return lines.join('\n');
  };
  const renderSection = (record, index, section) => {
    const merged = mergedRecord(record, index, true);
    if (!section.fields.some(field => hasValue(merged[field]))) return null;
    const body = section.fields.flatMap(field => {
      const value = merged[field];
      if (!hasValue(value)) return [];
      if (field === 'previousInjuries') return renderPreviousInjuries(record, index);
      if (field === 'recommendations') return renderRecommendations(record, index);
      if (field === 'results') return [renderObjectNode(record, index, 'results', value, null)];
      if (NARRATIVE_FIELDS.has(field)) return renderNarrativePath(record, index, field, FIELD_LABELS[field], FIELD_LABELS[field] !== section.title);
      if (field === 'date') return [renderSimplePath(record, index, field, FIELD_LABELS[field], 'date')];
      if (BOOLEAN_FIELDS.has(field)) return [renderSimplePath(record, index, field, FIELD_LABELS[field], 'boolean', ['Yes', 'No'])];
      if (field === 'status') return [renderSimplePath(record, index, field, FIELD_LABELS[field], 'enum', enumOptionsWith(value, STATUS_OPTIONS))];
      return [renderSimplePath(record, index, field, FIELD_LABELS[field])];
    }).filter(Boolean);
    if (!body.length) return null;
    const copyId = `${recordIdOf(record) || index}-${section.id}`;
    return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">{section.title}</h3><div className="header-right-actions"><button className={`copy-btn ${copied === copyId ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), copyId)}>{copied === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, index, section)}</div></div>{body}</div></div>;
  };

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const values = records.map((record, index) => ({ record, index }));
    if (!query) return values;
    return values.filter(({ record, index }) => JSON.stringify(mergedRecord(record, index, true)).toLowerCase().includes(query) || 'athlete specific data'.includes(query));
  }, [records, searchTerm, mergedRecord]);

  if (!records.length) return <article className="athlete-specific-data-document"><div className="empty-state">No athlete specific data available.</div></article>;
  return <article className="athlete-specific-data-document"><header className="document-header"><h1 className="document-title">Athlete Specific Data</h1><div className="header-actions"><button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AthleteSpecificDataDocumentPDFTemplate document={pdfData} />} fileName="Athlete_Specific_Data.pdf" className="pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div></header><div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search athlete specific data..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div><div className="records-container">{!filtered.length ? <div className="empty-state">No records match your search.</div> : filtered.map(({ record, index }) => <div className="record-card" key={recordIdOf(record) || index}><div className="record-header"><h2 className="record-name">Athlete Specific Data {index + 1}</h2></div>{SECTIONS.map(section => renderSection(record, index, section))}</div>)}</div></article>;
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, splitClauses };
export default AthleteSpecificDataDocument;
