import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AssessmentPlansDocumentPDFTemplate from '../pdf-templates/AssessmentPlansDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './AssessmentPlansDocument.css';

const COLLECTION = 'assessment_plans';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = ['assessment'];

const SECTIONS = [
  { id: 'general', title: 'General Information', fields: ['date', 'provider', 'facility', 'status'] },
  { id: 'chief', title: 'Chief Complaint', fields: ['chiefComplaint'] },
  { id: 'assessment', title: 'Assessment', fields: ['assessment'] },
  { id: 'diagnoses', title: 'Diagnoses', fields: ['diagnoses'] },
  { id: 'plan', title: 'Plan', fields: ['plan'] },
  { id: 'medications', title: 'Medications', fields: ['medications'] },
  { id: 'procedures', title: 'Procedures', fields: ['procedures'] },
  { id: 'referrals', title: 'Referrals', fields: ['referrals'] },
  { id: 'testing', title: 'Testing', fields: ['testing'] },
  { id: 'education', title: 'Patient Education', fields: ['patientEducation'] },
  { id: 'followup', title: 'Follow-Up', fields: ['followUp'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  chiefComplaint: 'Chief Complaint', assessment: 'Assessment', diagnoses: 'Diagnoses',
  plan: 'Plan', medications: 'Medications', procedures: 'Procedures', referrals: 'Referrals',
  testing: 'Testing', patientEducation: 'Patient Education', followUp: 'Follow-Up', notes: 'Notes',
};
const ARRAY_FIELDS = new Set(['diagnoses', 'medications', 'procedures', 'referrals', 'testing']);
const NARRATIVE_FIELDS = new Set(['chiefComplaint', 'assessment', 'plan', 'patientEducation', 'followUp', 'notes']);
const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);

const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = store => {
  try {
    if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* local drafts are best effort */ }
};
const recordIdOf = record => {
  if (!record?._id) return null;
  if (typeof record._id === 'string') return record._id;
  if (record._id.$oid) return record._id.$oid;
  return String(record._id);
};
const hasValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  return true;
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
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,60}?):\s+([\s\S]+)$/);
  return match
    ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};

// Lossless, parenthesis-aware clause inventory. Periods and semicolons split all narrative fields.
// Only explicitly designated fields split safe top-level commas; array items remain whole.
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
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') { depth += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const sentenceBreak = (char === '.' || char === ';') && (i + 1 === source.length || /\s/.test(source[i + 1]));
    let commaBreak = false;
    if (char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = source.slice(start, i).trim();
      const after = source.slice(i + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next))
        || /^(?:and|or|then)\b/i.test(next)
        || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (!sentenceBreak && !commaBreak) continue;
    push(i);
    start = i + 1;
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
    } else if (current?.subtitle) {
      current.items.push(item);
    } else {
      if (!current || current.subtitle) {
        current = { subtitle: null, items: [] };
        groups.push(current);
      }
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

const AssessmentPlansDocument = ({ document: documentProp, data, templateData }) => {
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
    const store = readDrafts();
    const nextLocal = {};
    const nextPending = {};
    records.forEach((record, index) => {
      const drafts = store[recordIdOf(record)] || {};
      Object.entries(drafts).forEach(([path, value]) => {
        const key = `${path}-${index}`;
        nextLocal[key] = value;
        nextPending[key] = true;
      });
    });
    if (Object.keys(nextLocal).length) {
      setLocalEdits(previous => ({ ...nextLocal, ...previous }));
      setPendingEdits(previous => ({ ...nextPending, ...previous }));
    }
  }, [records]);

  const valueAt = useCallback((record, path, index) => {
    const key = `${path}-${index}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    const [field, itemIndex] = path.split('.');
    return itemIndex === undefined ? record[field] : record[field]?.[Number(itemIndex)];
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
  }, []);

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
  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const recordWithEdits = useCallback((record, index, includePending = true) => {
    const merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => {
      if (!key.endsWith(`-${index}`) || (!includePending && pendingEdits[key])) return;
      const path = key.slice(0, -String(index).length - 1);
      const [field, itemIndex] = path.split('.');
      if (itemIndex === undefined) merged[field] = value;
      else {
        const next = Array.isArray(merged[field]) ? [...merged[field]] : [];
        next[Number(itemIndex)] = value;
        merged[field] = next;
      }
    });
    return merged;
  }, [localEdits, pendingEdits]);

  const pdfData = useMemo(() => records.map((record, index) => recordWithEdits(record, index, false)), [records, recordWithEdits]);
  const sectionPending = (section, index) => Object.keys(pendingEdits).some(key => {
    if (!pendingEdits[key] || !key.endsWith(`-${index}`)) return false;
    const path = key.slice(0, -String(index).length - 1);
    return section.fields.includes(path.split('.')[0]);
  });

  const approveSection = async (record, index, section) => {
    const id = recordIdOf(record);
    if (!id) return;
    setApproving(true);
    try {
      const keys = Object.keys(pendingEdits).filter(key => pendingEdits[key] && key.endsWith(`-${index}`) && section.fields.includes(key.slice(0, -String(index).length - 1).split('.')[0]));
      for (const key of keys) {
        const path = key.slice(0, -String(index).length - 1);
        const payload = { field: path, value: localEdits[key] };
        const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/edit`, payload);
        if (!response?.success) throw new Error(response?.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/${COLLECTION}/${id}/approve`);
      setPendingEdits(previous => {
        const next = { ...previous };
        keys.forEach(key => delete next[key]);
        return next;
      });
      const store = readDrafts();
      if (store[id]) {
        keys.forEach(key => delete store[id][key.slice(0, -String(index).length - 1)]);
        if (!Object.keys(store[id]).length) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(previous => ({ ...previous, [`${section.id}-${index}`]: true }));
    } finally { setApproving(false); }
  };

  const highlight = value => {
    const text = String(value ?? '');
    const query = searchTerm.trim();
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
  };

  const saveSimple = (record, field, index) => {
    const value = field === 'date' ? `${editValue}T00:00:00.000Z` : field === 'status' ? canonicalStatus(editValue) : editValue.trim();
    if (!value || (field === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(editValue))) {
      setSaveError(field === 'date' ? 'Please choose a valid date' : 'Please enter a value');
      return;
    }
    stageDraft(record, field, index, value);
    cancelEdit();
  };

  const renderSimpleField = (record, field, index) => {
    const raw = valueAt(record, field, index);
    if (!hasValue(raw)) return null;
    const display = field === 'date' ? formatDate(raw) : field === 'status' ? canonicalStatus(raw) : String(raw);
    const editKey = `${field}-${index}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[editKey];
    return (
      <div className="rec-mini-card nested-mini-card" key={field}>
        <div className="nested-subtitle">{FIELD_LABELS[field]}</div>
        <div data-edit-field={field}>
          <div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, field === 'date' ? toInputDate(raw) : field === 'status' ? canonicalStatus(raw) : raw)}>
            {editing ? (
              <div className="edit-field-container" onClick={event => event.stopPropagation()}>
                {field === 'date' ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                  : field === 'status' ? <BlueSelect value={canonicalStatus(editValue)} options={STATUS_OPTIONS} onChange={setEditValue} />
                    : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions"><button className="edit-save-btn" onClick={() => saveSimple(record, field, index)}>Save</button><button className="edit-cancel-btn" onClick={cancelEdit}>Cancel</button></div>
              </div>
            ) : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(display, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}
          </div>
        </div>
        {modified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderArrayField = (record, field, index) => {
    const items = record[field];
    if (!Array.isArray(items) || !items.some(hasValue)) return null;
    return (
      <div className="rec-mini-card nested-mini-card regular-row-group">
        {items.map((original, itemIndex) => {
          if (!hasValue(original)) return null;
          const path = `${field}.${itemIndex}`;
          const value = String(valueAt(record, path, index));
          const editKey = `${path}-${index}`;
          const editing = editingField === editKey;
          const modified = !!pendingEdits[editKey];
          return <div key={path} data-edit-field={path}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, value)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="edit-save-btn" onClick={() => { if (!editValue.trim()) { setSaveError('Please enter a value'); return; } stageDraft(record, path, index, editValue.trim()); cancelEdit(); }}>Save</button><button className="edit-cancel-btn" onClick={cancelEdit}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(value, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
        })}
      </div>
    );
  };

  const renderNarrativeField = (record, field, index) => {
    const source = String(valueAt(record, field, index) || '');
    const clauses = splitClauses(field, source);
    return groupClauses(clauses).map((group, groupIndex) => (
      <div className="rec-mini-card nested-mini-card" key={`${field}-${groupIndex}`}>
        {group.subtitle && <div className="nested-subtitle">{highlight(group.subtitle)}</div>}
        {group.items.map(item => {
          const editKey = `${field}-${index}-clause-${item.index}`;
          const fieldEditKey = `${field}-${index}`;
          const editing = editingField === editKey;
          const modified = !!pendingEdits[fieldEditKey];
          return <div key={editKey} data-edit-field={field}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, item.value)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="edit-save-btn" onClick={() => { if (!editValue.trim()) { setSaveError('Please enter a value'); return; } const replacement = item.labeled ? `${item.label}: ${editValue.trim()}` : editValue.trim(); const next = source.slice(0, item.start) + replacement + source.slice(item.end); stageDraft(record, field, index, next); cancelEdit(); }}>Save</button><button className="edit-cancel-btn" onClick={cancelEdit}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(item.value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(item.value, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
        })}
      </div>
    ));
  };

  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '='.repeat(40)];
    section.fields.forEach(field => {
      const value = record[field];
      if (!hasValue(value)) return;
      if (field === 'date') { lines.push('Date', '-'.repeat(40), `1. ${formatDate(value)}`); return; }
      if (field === 'status') { lines.push('Status', '-'.repeat(40), `1. ${canonicalStatus(value)}`); return; }
      if (ARRAY_FIELDS.has(field)) { value.forEach((item, itemIndex) => lines.push(`${itemIndex + 1}. ${item}`)); return; }
      if (NARRATIVE_FIELDS.has(field)) { splitClauses(field, value).forEach((item, itemIndex) => lines.push(`${itemIndex + 1}. ${parseLabel(item.text).value}`)); return; }
      lines.push(FIELD_LABELS[field], '-'.repeat(40), `1. ${value}`);
    });
    return lines;
  };
  const allText = useCallback((record, index) => {
    const merged = recordWithEdits(record, index, true);
    const lines = [`ASSESSMENT PLAN ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => {
      if (section.fields.some(field => hasValue(merged[field]))) lines.push('', ...sectionLines(merged, section));
    });
    return lines.join('\n');
  }, [recordWithEdits]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records.map((record, index) => ({ record, index }));
    return records.map((record, index) => ({ record, index })).filter(({ record }) => JSON.stringify(record).toLowerCase().includes(query) || 'assessment plans'.includes(query));
  }, [records, searchTerm]);

  if (!records.length) return <div className="assessment-plans-document"><div className="no-data">No assessment plans data available</div></div>;

  return (
    <div className="assessment-plans-document">
      <div className="document-header">
        <h1 className="document-title">Assessment Plans</h1>
        <div className="header-actions">
          <button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<AssessmentPlansDocumentPDFTemplate document={pdfData} />} fileName="Assessment_Plans.pdf" className="pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink>
        </div>
        <div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search assessment plans..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div>
      </div>
      <div className="records-container">
        {!filtered.length ? <div className="no-results">No records match your search.</div> : filtered.map(({ record, index }) => {
          const id = recordIdOf(record) || `record-${index}`;
          const merged = recordWithEdits(record, index, true);
          return <div className="assessment-plans-record" key={id}><div className="record-header"><h2 className="record-title">Assessment Plan {index + 1}</h2></div>{SECTIONS.map(section => {
            if (!section.fields.some(field => hasValue(merged[field]))) return null;
            const pending = sectionPending(section, index);
            const approved = approvedSections[`${section.id}-${index}`];
            return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">{section.title}</h3><div className="header-right-actions"><button className={`copy-btn ${copied === `${id}-${section.id}` ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), `${id}-${section.id}`)}>{copied === `${id}-${section.id}` ? 'Copied!' : 'Copy Section'}</button>{(pending || approved) && <button className={`approve-btn${approved && !pending ? ' approved' : ' pending'}`} disabled={approving || !pending} onClick={() => approveSection(record, index, section)}>{approving ? 'Approving...' : approved && !pending ? 'Approved' : 'Pending Approve'}</button>}</div></div>{section.fields.map(field => {
              if (!hasValue(merged[field])) return null;
              if (ARRAY_FIELDS.has(field)) return <React.Fragment key={field}>{renderArrayField(merged, field, index)}</React.Fragment>;
              if (NARRATIVE_FIELDS.has(field)) return <React.Fragment key={field}>{renderNarrativeField(merged, field, index)}</React.Fragment>;
              return renderSimpleField(merged, field, index);
            })}</div></div>;
          })}</div>;
        })}
      </div>
    </div>
  );
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, splitClauses };
export default AssessmentPlansDocument;
