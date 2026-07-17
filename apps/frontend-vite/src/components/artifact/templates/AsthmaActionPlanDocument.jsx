import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AsthmaActionPlanDocumentPDFTemplate from '../pdf-templates/AsthmaActionPlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './AsthmaActionPlanDocument.css';

const COLLECTION = 'asthma_action_plan';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];
const COMMA_ARRAY_FIELDS = [];
const KEEP_WHOLE_ARRAY_FIELDS = new Set([
  'greenZone.symptoms', 'greenZone.medications', 'greenZone.actions',
  'yellowZone.symptoms', 'yellowZone.medications', 'yellowZone.actions',
  'redZone.symptoms', 'redZone.emergencyMedications', 'redZone.when911',
]);

const SECTION_CONFIG = [
  { id: 'planInfo', title: 'Plan Information', fields: ['date', 'type', 'provider', 'facility', 'status'] },
  { id: 'findings', title: 'Findings', fields: ['findings'] },
  { id: 'greenZone', title: 'Green Zone', fields: ['greenZone'] },
  { id: 'yellowZone', title: 'Yellow Zone', fields: ['yellowZone'] },
  { id: 'redZone', title: 'Red Zone', fields: ['redZone'] },
  { id: 'results', title: 'Results', fields: ['results'] },
  { id: 'assessment', title: 'Assessment', fields: ['assessment'] },
  { id: 'plan', title: 'Plan', fields: ['plan'] },
  { id: 'recommendations', title: 'Recommendations', fields: ['recommendations'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];
const SECTION_BY_ID = Object.fromEntries(SECTION_CONFIG.map(section => [section.id, section]));

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const ZONES = {
  greenZone: {
    badge: 'Doing Well',
    badgeClass: 'zone-green',
    fields: [
      ['peakFlowRange', 'Peak Flow Range'],
      ['symptoms', 'Symptoms'],
      ['medications', 'Medications'],
      ['actions', 'Actions'],
    ],
  },
  yellowZone: {
    badge: 'Caution',
    badgeClass: 'zone-yellow',
    fields: [
      ['peakFlowRange', 'Peak Flow Range'],
      ['symptoms', 'Symptoms'],
      ['medications', 'Medications'],
      ['actions', 'Actions'],
      ['contactInstructions', 'Contact Instructions'],
    ],
  },
  redZone: {
    badge: 'Medical Alert',
    badgeClass: 'zone-red',
    fields: [
      ['peakFlowRange', 'Peak Flow Range'],
      ['symptoms', 'Symptoms'],
      ['emergencyMedications', 'Emergency Medications'],
      ['emergencyContact', 'Emergency Contact'],
      ['when911', 'When to Call 911'],
    ],
  },
};

const DISPLAY_ROOTS = new Set([
  'date', 'type', 'provider', 'facility', 'status', 'findings', 'greenZone', 'yellowZone',
  'redZone', 'results', 'assessment', 'plan', 'recommendations', 'notes',
]);

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
const canonicalStatus = value => {
  const raw = String(value ?? '').trim();
  return STATUS_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase()) || raw;
};
const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value); }
};
const toInputDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  } catch { return ''; }
};
const displayScalar = value => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
};
const humanizeKey = key => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, first => first.toUpperCase());
const getDeep = (source, path) => String(path).split('.').reduce((value, part) => value?.[part], source);
const setDeep = (source, path, value) => {
  const parts = String(path).split('.');
  const root = Array.isArray(source) ? [...source] : { ...(source || {}) };
  let cursor = root;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) { cursor[part] = value; return; }
    const nextPart = parts[index + 1];
    const existing = cursor[part];
    cursor[part] = Array.isArray(existing) ? [...existing]
      : existing && typeof existing === 'object' ? { ...existing }
        : /^\d+$/.test(nextPart) ? [] : {};
    cursor = cursor[part];
  });
  return root;
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};

// Lossless clause boundaries: narrative fields split on periods and semicolons only.
// Credentials, locations, numbers, parenthetical commas, and all zone array items remain whole.
const splitClauses = text => {
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
    if (depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]))) {
      push(index);
      start = index + 1;
    }
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
const normalizeDateKey = value => {
  if (!hasValue(value)) return 'no-date';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  } catch { return String(value); }
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const output = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && ![...DISPLAY_ROOTS].some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') output.push(value);
  }
  return output.filter(record => [...DISPLAY_ROOTS].some(field => hasValue(record[field])));
};

const AsthmaActionPlanDocument = ({ document: documentProp, data, templateData }) => {
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
    records.forEach((record, recordIndex) => {
      const drafts = store[recordIdOf(record)] || {};
      Object.entries(drafts).forEach(([path, value]) => {
        const key = `${path}-${recordIndex}`;
        nextLocal[key] = value;
        nextPending[key] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits(previous => ({ ...nextLocal, ...previous }));
      setPendingEdits(previous => ({ ...nextPending, ...previous }));
    }
  }, [records]);

  const valueAt = useCallback((record, path, recordIndex) => {
    const key = `${path}-${recordIndex}`;
    return localEdits[key] !== undefined ? localEdits[key] : getDeep(record, path);
  }, [localEdits]);

  const stageDrafts = useCallback((record, recordIndex, entries) => {
    const id = recordIdOf(record);
    if (!id) return;
    const local = {};
    const pending = {};
    const store = readDrafts();
    store[id] = { ...(store[id] || {}) };
    entries.forEach(({ path, value }) => {
      const key = `${path}-${recordIndex}`;
      local[key] = value;
      pending[key] = true;
      store[id][path] = value;
    });
    setLocalEdits(previous => ({ ...previous, ...local }));
    setPendingEdits(previous => ({ ...previous, ...pending }));
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
    setSaveError('');
  }, []);

  const mergedRecord = useCallback((record, recordIndex, includePending) => {
    let merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => {
      if (!key.endsWith(`-${recordIndex}`) || (!includePending && pendingEdits[key])) return;
      const path = key.slice(0, -String(recordIndex).length - 1);
      merged = setDeep(merged, path, value);
    });
    return merged;
  }, [localEdits, pendingEdits]);

  const pdfData = useMemo(() => records.map((record, index) => mergedRecord(record, index, false)), [records, mergedRecord]);

  const copyText = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };
  const highlight = value => {
    const text = String(value ?? '');
    const query = searchTerm.trim();
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
  };
  const startEdit = (key, value) => {
    setEditingField(key);
    setEditValue(value ?? '');
    setSaveError('');
  };
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setSaveError('');
  };
  const sectionPending = (sectionId, recordIndex) => {
    const roots = SECTION_BY_ID[sectionId].fields;
    return Object.keys(pendingEdits).some(key => {
      if (!pendingEdits[key] || !key.endsWith(`-${recordIndex}`)) return false;
      const path = key.slice(0, -String(recordIndex).length - 1);
      return roots.includes(path.split('.')[0]);
    });
  };
  const approveSection = async (record, recordIndex, sectionId) => {
    const id = recordIdOf(record);
    if (!id) return;
    const roots = SECTION_BY_ID[sectionId].fields;
    const keys = Object.keys(pendingEdits).filter(key => {
      if (!pendingEdits[key] || !key.endsWith(`-${recordIndex}`)) return false;
      const path = key.slice(0, -String(recordIndex).length - 1);
      return roots.includes(path.split('.')[0]);
    });
    if (!keys.length) return;
    setApproving(true);
    try {
      for (const key of keys) {
        const path = key.slice(0, -String(recordIndex).length - 1);
        const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, { field: path, value: localEdits[key] });
        if (!response?.success) throw new Error(response?.error || 'save failed');
      }
      const approval = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`, { sectionId, approved: true });
      if (!approval?.success) throw new Error(approval?.error || 'approval failed');
      setPendingEdits(previous => {
        const next = { ...previous };
        keys.forEach(key => delete next[key]);
        return next;
      });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach(key => delete store[id][key.slice(0, -String(recordIndex).length - 1)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(previous => ({ ...previous, [`${sectionId}-${recordIndex}`]: true }));
    } catch (error) {
      setSaveError(error.message || 'Unable to approve changes');
    } finally {
      setApproving(false);
    }
  };

  const renderApproveButton = (record, recordIndex, sectionId) => {
    const pending = sectionPending(sectionId, recordIndex);
    const approved = approvedSections[`${sectionId}-${recordIndex}`];
    if (!pending && !approved) return null;
    return <button className={`approve-btn${approved && !pending ? ' approved' : ' pending'}`} disabled={approving || !pending} onClick={() => approveSection(record, recordIndex, sectionId)}>{approving ? 'Approving...' : approved && !pending ? 'Approved' : 'Pending Approve'}</button>;
  };

  const renderEditableLeaf = ({ record, recordIndex, sectionId, path, displayValue, initialValue, saveValue, widget = 'text', leafKey }) => {
    const editKey = leafKey || `${path}-${recordIndex}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[`${path}-${recordIndex}`];
    const shown = displayScalar(displayValue);
    const initial = initialValue ?? shown;
    const save = event => {
      event?.stopPropagation();
      if (widget === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue) || Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please choose a valid date'); return; }
      } else if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      const next = saveValue ? saveValue(editValue) : widget === 'date' ? `${editValue}T00:00:00.000Z`
        : widget === 'boolean' ? editValue === 'Yes'
          : widget === 'status' ? canonicalStatus(editValue)
            : String(editValue).trim();
      stageDrafts(record, recordIndex, [{ path, value: next }]);
    };
    return (
      <div data-edit-field={path} key={editKey}>
        <div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, initial)}>
          {editing ? (
            <div className="edit-field-container" onClick={event => event.stopPropagation()}>
              {widget === 'date' ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                : widget === 'status' ? <BlueSelect value={canonicalStatus(editValue)} options={STATUS_OPTIONS} onChange={setEditValue} />
                  : widget === 'boolean' ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
                    : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div>
            </div>
          ) : <><div className="row-content"><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(shown, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}
        </div>
        {modified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderSimpleField = (record, recordIndex, sectionId, path, label, widget = 'text') => {
    const value = valueAt(record, path, recordIndex);
    if (!hasValue(value)) return null;
    const display = widget === 'date' ? formatDate(value) : widget === 'status' ? canonicalStatus(value) : displayScalar(value);
    const initial = widget === 'date' ? toInputDate(value) : widget === 'status' ? canonicalStatus(value) : displayScalar(value);
    return <div className="rec-mini-card nested-mini-card" key={path}><div className="nested-subtitle field-label">{highlight(label)}</div>{renderEditableLeaf({ record, recordIndex, sectionId, path, displayValue: display, initialValue: initial, widget })}</div>;
  };

  const renderNarrative = (record, recordIndex, sectionId, field) => {
    const source = String(valueAt(record, field, recordIndex) || '');
    if (!source.trim()) return null;
    return groupClauses(splitClauses(source)).map((group, groupIndex) => (
      <div className={`rec-mini-card nested-mini-card${group.subtitle ? '' : ' regular-row-group'}`} key={`${field}-${groupIndex}`}>
        {group.subtitle && <div className="nested-subtitle">{highlight(group.subtitle)}</div>}
        {group.items.map(item => renderEditableLeaf({
          record,
          recordIndex,
          sectionId,
          path: field,
          leafKey: `${field}-${recordIndex}-clause-${item.index}`,
          displayValue: item.value,
          initialValue: item.value,
          saveValue: next => source.slice(0, item.start) + (item.labeled ? `${item.label}: ${String(next).trim()}` : String(next).trim()) + source.slice(item.end),
        }))}
      </div>
    ));
  };

  const renderZone = (record, recordIndex, sectionId) => {
    const config = ZONES[sectionId];
    const zone = valueAt(record, sectionId, recordIndex);
    if (!hasValue(zone)) return null;
    const cards = config.fields.map(([field, label]) => {
      const path = `${sectionId}.${field}`;
      const value = valueAt(record, path, recordIndex);
      if (!hasValue(value)) return null;
      if (Array.isArray(value) && KEEP_WHOLE_ARRAY_FIELDS.has(path)) {
        return <div className="rec-mini-card nested-mini-card" key={path}><div className="nested-subtitle field-label">{highlight(label)}</div>{value.map((item, itemIndex) => renderEditableLeaf({ record, recordIndex, sectionId, path: `${path}.${itemIndex}`, displayValue: item }))}</div>;
      }
      return renderSimpleField(record, recordIndex, sectionId, path, label);
    }).filter(Boolean);
    if (!cards.length) return null;
    return renderSectionShell(record, recordIndex, sectionId, cards, <div className="section-title-with-badge"><h3 className="section-title">{SECTION_BY_ID[sectionId].title}</h3><span className={`zone-badge ${config.badgeClass}`}>{config.badge}</span></div>);
  };

  const renderResultsNode = (record, recordIndex, value, path, label) => {
    if (!hasValue(value)) return null;
    if (Array.isArray(value)) {
      return <div className="rec-mini-card nested-mini-card" key={path}>{label && <div className="nested-subtitle field-label">{highlight(label)}</div>}{value.map((item, itemIndex) => {
        const childPath = `${path}.${itemIndex}`;
        return typeof item === 'object' && item !== null
          ? renderResultsNode(record, recordIndex, item, childPath, `${label || 'Item'} ${itemIndex + 1}`)
          : renderEditableLeaf({ record, recordIndex, sectionId: 'results', path: childPath, displayValue: displayScalar(item), initialValue: displayScalar(item), widget: typeof item === 'boolean' ? 'boolean' : 'text' });
      })}</div>;
    }
    if (typeof value === 'object' && value !== null) {
      return <div className="nested-group" key={path}>{label && <div className="nested-subtitle field-group-title">{highlight(label)}</div>}{Object.entries(value).filter(([, child]) => hasValue(child)).map(([key, child]) => renderResultsNode(record, recordIndex, child, `${path}.${key}`, humanizeKey(key)))}</div>;
    }
    return renderSimpleField(record, recordIndex, 'results', path, label || humanizeKey(path.split('.').pop()), typeof value === 'boolean' ? 'boolean' : 'text');
  };

  const renderRecommendations = (record, recordIndex) => {
    const recommendations = valueAt(record, 'recommendations', recordIndex);
    if (!Array.isArray(recommendations) || !recommendations.some(hasValue)) return null;
    const groups = new Map();
    recommendations.forEach((item, itemIndex) => {
      const normalized = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
      const dateValue = valueAt(record, `recommendations.${itemIndex}.date`, recordIndex) ?? normalized.date;
      const dateKey = normalizeDateKey(dateValue);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push({ itemIndex, item: normalized, dateValue });
    });
    const cards = [...groups.entries()].map(([dateKey, items]) => {
      const datePaths = items.filter(entry => hasValue(entry.dateValue)).map(entry => `recommendations.${entry.itemIndex}.date`);
      const firstDate = items.find(entry => hasValue(entry.dateValue))?.dateValue;
      const dateEditKey = `recommendations-date-${recordIndex}-${dateKey}`;
      const dateEditing = editingField === dateEditKey;
      return (
        <div className="rec-mini-card nested-mini-card recommendation-group" key={dateKey}>
          {datePaths.length ? (
            <div className="editable-date-subtitle" data-edit-field={datePaths[0]} data-edit-fields={datePaths.join(',')}>
              <div className={`nested-subtitle date-subtitle editable-row${datePaths.some(path => pendingEdits[`${path}-${recordIndex}`]) ? ' modified' : ''}`} onClick={() => !dateEditing && startEdit(dateEditKey, toInputDate(firstDate))}>
                {dateEditing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}><BlueDatePicker value={editValue} onSelect={setEditValue} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={event => {
                  event.stopPropagation();
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue) || Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please choose a valid date'); return; }
                  stageDrafts(record, recordIndex, datePaths.map(path => ({ path, value: `${editValue}T00:00:00.000Z` })));
                }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div></div>
                  : <div className="row-content"><span className="content-value">{highlight(formatDate(firstDate))}</span><span className="edit-indicator">&#9998;</span></div>}
              </div>
            </div>
          ) : null}
          {items.map(({ itemIndex, item }) => {
            const path = typeof recommendations[itemIndex] === 'string' ? `recommendations.${itemIndex}` : `recommendations.${itemIndex}.recommendation`;
            const value = valueAt(record, path, recordIndex) ?? item.recommendation;
            return hasValue(value) ? renderEditableLeaf({ record, recordIndex, sectionId: 'recommendations', path, displayValue: value }) : null;
          })}
        </div>
      );
    }).filter(Boolean);
    return cards.length ? renderSectionShell(record, recordIndex, 'recommendations', cards) : null;
  };

  const sectionLines = (record, sectionId) => {
    const title = SECTION_BY_ID[sectionId].title;
    const lines = [title.toUpperCase(), '-'.repeat(40)];
    if (sectionId === 'planInfo') {
      ['date', 'type', 'provider', 'facility', 'status'].forEach(field => {
        if (!hasValue(record[field])) return;
        const shown = field === 'date' ? formatDate(record[field]) : field === 'status' ? canonicalStatus(record[field]) : displayScalar(record[field]);
        lines.push(FIELD_LABELS[field], `1. ${shown}`);
      });
    } else if (['findings', 'assessment', 'plan', 'notes'].includes(sectionId)) {
      splitClauses(record[sectionId]).forEach((clause, index) => lines.push(`${index + 1}. ${parseLabel(clause.text).value}`));
    } else if (ZONES[sectionId]) {
      ZONES[sectionId].fields.forEach(([field, label]) => {
        const value = record[sectionId]?.[field];
        if (!hasValue(value)) return;
        lines.push(label);
        (Array.isArray(value) ? value : [value]).forEach((item, index) => lines.push(`${index + 1}. ${displayScalar(item)}`));
      });
    } else if (sectionId === 'results') {
      const visit = (value, label) => {
        if (!hasValue(value)) return;
        if (Array.isArray(value)) { if (label) lines.push(label); value.forEach((item, index) => typeof item === 'object' && item !== null ? visit(item, `${label || 'Item'} ${index + 1}`) : lines.push(`${index + 1}. ${displayScalar(item)}`)); return; }
        if (typeof value === 'object' && value !== null) { Object.entries(value).forEach(([key, child]) => visit(child, humanizeKey(key))); return; }
        lines.push(label, `1. ${displayScalar(value)}`);
      };
      visit(record.results, '');
    } else if (sectionId === 'recommendations') {
      const groups = new Map();
      (record.recommendations || []).forEach(item => {
        const normalized = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
        const key = normalizeDateKey(normalized.date);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(normalized);
      });
      groups.forEach(items => {
        if (hasValue(items[0]?.date)) lines.push('Date', `1. ${formatDate(items[0].date)}`);
        items.forEach((item, index) => { if (hasValue(item.recommendation)) lines.push(`${index + 1}. ${item.recommendation}`); });
      });
    }
    return lines;
  };

  function renderSectionShell(record, recordIndex, sectionId, body, titleNode = null) {
    const id = `${recordIdOf(record) || recordIndex}-${sectionId}`;
    const merged = mergedRecord(record, recordIndex, true);
    return <div className="section" key={sectionId}><div className="mini-cards-container"><div className="section-header">{titleNode || <h3 className="section-title">{SECTION_BY_ID[sectionId].title}</h3>}<div className="header-right-actions"><button className={`copy-btn ${copied === id ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, sectionId).join('\n'), id)}>{copied === id ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, recordIndex, sectionId)}</div></div>{body}</div></div>;
  }

  const renderSection = (record, recordIndex, sectionId) => {
    if (sectionId === 'planInfo') {
      const cards = [
        renderSimpleField(record, recordIndex, sectionId, 'date', 'Date', 'date'),
        renderSimpleField(record, recordIndex, sectionId, 'type', 'Type'),
        renderSimpleField(record, recordIndex, sectionId, 'provider', 'Provider'),
        renderSimpleField(record, recordIndex, sectionId, 'facility', 'Facility'),
        renderSimpleField(record, recordIndex, sectionId, 'status', 'Status', 'status'),
      ].filter(Boolean);
      return cards.length ? renderSectionShell(record, recordIndex, sectionId, cards) : null;
    }
    if (['findings', 'assessment', 'plan', 'notes'].includes(sectionId)) {
      const rows = renderNarrative(record, recordIndex, sectionId, sectionId);
      return rows?.length ? renderSectionShell(record, recordIndex, sectionId, rows) : null;
    }
    if (ZONES[sectionId]) return renderZone(record, recordIndex, sectionId);
    if (sectionId === 'results') {
      const value = valueAt(record, 'results', recordIndex);
      const body = renderResultsNode(record, recordIndex, value, 'results', '');
      return body ? renderSectionShell(record, recordIndex, sectionId, body) : null;
    }
    if (sectionId === 'recommendations') return renderRecommendations(record, recordIndex);
    return null;
  };

  const allText = (record, recordIndex) => {
    const merged = mergedRecord(record, recordIndex, true);
    const lines = [`ASTHMA ACTION PLAN ${recordIndex + 1}`, '='.repeat(40)];
    SECTION_CONFIG.forEach(section => {
      const sectionOutput = sectionLines(merged, section.id);
      if (sectionOutput.length > 2) lines.push('', ...sectionOutput);
    });
    return lines.join('\n');
  };

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const entries = records.map((record, index) => ({ record, index }));
    if (!query) return entries;
    return entries.filter(({ record, index }) => JSON.stringify(mergedRecord(record, index, true)).toLowerCase().includes(query) || 'asthma action plans'.includes(query));
  }, [records, searchTerm, mergedRecord]);

  if (!records.length) return <div className="asthma-action-plan-document"><div className="no-data">No asthma action plan data available.</div></div>;
  return (
    <article className="asthma-action-plan-document">
      <header className="document-header">
        <h1 className="document-title">Asthma Action Plans</h1>
        <div className="header-actions"><button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AsthmaActionPlanDocumentPDFTemplate document={pdfData} />} fileName="Asthma_Action_Plans.pdf" className="pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div>
      </header>
      <div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search asthma action plans..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div>
      <div className="records-container">
        {!filtered.length ? <div className="no-data">No records match your search.</div> : filtered.map(({ record, index }) => <div className="asthma-action-plan-record" key={recordIdOf(record) || index}><div className="record-header"><h2 className="record-name">Asthma Action Plan {index + 1}</h2></div>{SECTION_CONFIG.map(section => renderSection(record, index, section.id))}</div>)}
      </div>
    </article>
  );
};

export { COMMA_ARRAY_FIELDS, KEEP_WHOLE_ARRAY_FIELDS, splitClauses };
export default AsthmaActionPlanDocument;
