import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AsthmaAssessmentsDocumentPDFTemplate from '../pdf-templates/AsthmaAssessmentsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './AsthmaAssessmentsDocument.css';

const COLLECTION = 'asthma_assessments';
const DRAFT_KEY = `${COLLECTION}PendingEdits`;
const COMMA_ARRAY_FIELDS = [];
const COMMA_SPLIT_FIELDS = ['symptomFrequency', 'spirometry', 'actionPlan'];
const KEEP_WHOLE_ARRAY_FIELDS = new Set(['symptoms', 'triggers', 'medications']);

const SECTIONS = [
  { id: 'assessmentInfo', title: 'Assessment Information', fields: ['date', 'provider', 'facility', 'asthmaType', 'severity'] },
  { id: 'controlLevel', title: 'Control Level', fields: ['controlLevel'] },
  { id: 'symptoms', title: 'Symptoms', fields: ['symptoms', 'symptomFrequency', 'nighttimeAwakenings'] },
  { id: 'exacerbations', title: 'Exacerbations', fields: ['exacerbations'] },
  { id: 'triggers', title: 'Triggers', fields: ['triggers'] },
  { id: 'spirometry', title: 'Spirometry', fields: ['spirometry'] },
  { id: 'rescueInhalerUse', title: 'Rescue Inhaler Use', fields: ['rescueInhalerUse'] },
  { id: 'peakFlow', title: 'Peak Flow', fields: ['peakFlow'] },
  { id: 'medications', title: 'Medications', fields: ['medications'] },
  { id: 'actionPlan', title: 'Action Plan', fields: ['actionPlan'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map(section => [section.id, section]));
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', asthmaType: 'Asthma Type', severity: 'Severity',
  controlLevel: 'Control Level', symptoms: 'Symptoms', symptomFrequency: 'Symptom Frequency',
  nighttimeAwakenings: 'Nighttime Awakenings', exacerbations: 'Exacerbations', triggers: 'Triggers',
  spirometry: 'Spirometry', rescueInhalerUse: 'Rescue Inhaler Use', peakFlow: 'Peak Flow',
  medications: 'Medications', actionPlan: 'Action Plan', notes: 'Notes',
};
const DISPLAY_FIELDS = Object.keys(FIELD_LABELS);
const NARRATIVE_FIELDS = new Set(['symptomFrequency', 'exacerbations', 'spirometry', 'actionPlan', 'notes']);

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
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,80}?):\s+([\s\S]+)$/);
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
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or|then)\b/i.test(next) || after.length === next.length;
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

const chartDataFor = record => {
  const charts = [];
  const act = String(record.controlLevel || '').match(/ACT\s*(?:Score\s*)?(\d+)\/(\d+)/i);
  if (act) charts.push({ group: 'Asthma Control & Lung Function', label: 'ACT Score', value: `${act[1]}/${act[2]}`, percentage: Math.round((Number(act[1]) / Number(act[2])) * 100), interpretation: Number(act[1]) >= 20 ? 'Well Controlled' : Number(act[1]) >= 16 ? 'Not Well Controlled' : 'Very Poorly Controlled' });
  const fev1 = String(record.spirometry || '').match(/FEV1[\s\S]{0,40}?(\d+(?:\.\d+)?)%\s*predicted/i);
  if (fev1) charts.push({ group: 'Asthma Control & Lung Function', label: 'FEV1', value: `${fev1[1]}% predicted`, percentage: Math.min(Number(fev1[1]), 100), interpretation: Number(fev1[1]) >= 80 ? 'Normal' : Number(fev1[1]) >= 60 ? 'Mild Obstruction' : Number(fev1[1]) >= 40 ? 'Moderate Obstruction' : 'Severe Obstruction' });
  const biomarkers = [
    ['FeNO', /FeNO\s*(\d+(?:\.\d+)?)\s*ppb/i, value => `${value} ppb`, value => value < 25 ? 'Normal' : value <= 50 ? 'Elevated' : 'High'],
    ['Eosinophils', /Eosinophils\s*(\d+(?:\.\d+)?)\s*(?:cells\/uL|cells\/μL)?/i, value => `${value} cells/uL`, value => value < 300 ? 'Normal' : value <= 500 ? 'Elevated' : 'High'],
    ['IgE', /(?:Total\s+)?IgE\s*(\d+(?:\.\d+)?)\s*IU\/mL/i, value => `${value} IU/mL`, value => value < 100 ? 'Normal' : value <= 400 ? 'Elevated' : 'High'],
  ];
  biomarkers.forEach(([label, pattern, display, interpret]) => {
    const match = String(record.notes || '').match(pattern);
    if (!match) return;
    const value = Number(match[1]);
    charts.push({ group: 'Type 2 Inflammation Biomarkers', label, value: display(value), percentage: Math.min(value, 100), interpretation: interpret(value) });
  });
  return charts;
};

const AsthmaAssessmentsDocument = ({ document: documentProp, data, templateData }) => {
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
    setEditingField(null);
    setEditValue('');
    setSaveError('');
  }, []);
  const mergedRecord = useCallback((record, index, includePending) => {
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
  const startEdit = (key, value) => { setEditingField(key); setEditValue(value ?? ''); setSaveError(''); };
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
  const renderLeaf = ({ record, index, path, displayValue, initialValue, saveValue, widget = 'text', leafKey }) => {
    const editKey = leafKey || `${path}-${index}`;
    const editing = editingField === editKey;
    const modified = !!pendingEdits[`${path}-${index}`];
    const shown = String(displayValue ?? '');
    const save = event => {
      event?.stopPropagation();
      if (widget === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue) || Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please choose a valid date'); return; }
      } else if (!String(editValue).trim()) { setSaveError('Please enter a value'); return; }
      const next = saveValue ? saveValue(editValue) : widget === 'date' ? `${editValue}T00:00:00.000Z` : String(editValue).trim();
      stageDraft(record, path, index, next);
    };
    return <div data-edit-field={path} key={editKey}><div className={`numbered-row editable-row${modified ? ' modified' : ''}`} onClick={() => !editing && startEdit(editKey, initialValue ?? shown)}>{editing ? <div className="edit-field-container" onClick={event => event.stopPropagation()}>{widget === 'date' ? <BlueDatePicker value={editValue} onSelect={setEditValue} /> : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={save}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); cancelEdit(); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(shown)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copied === editKey ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(shown, editKey); }}>{copied === editKey ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>;
  };
  const renderSimple = (record, index, section, field, showLabel = true) => {
    const value = valueAt(record, field, index);
    if (!hasValue(value)) return null;
    const widget = field === 'date' ? 'date' : 'text';
    const display = field === 'date' ? formatDate(value) : String(value);
    return <div className={`rec-mini-card nested-mini-card${showLabel ? '' : ' regular-row-group'}`} key={field}>{showLabel && <div className="nested-subtitle field-label">{FIELD_LABELS[field]}</div>}{renderLeaf({ record, index, path: field, displayValue: display, initialValue: field === 'date' ? toInputDate(value) : String(value), widget })}</div>;
  };
  const renderArray = (record, index, field, showLabel) => {
    const values = valueAt(record, field, index);
    if (!Array.isArray(values) || !values.some(hasValue) || !KEEP_WHOLE_ARRAY_FIELDS.has(field)) return null;
    return <div className={`rec-mini-card nested-mini-card${showLabel ? '' : ' regular-row-group'}`} key={field}>{showLabel && <div className="nested-subtitle field-label">{FIELD_LABELS[field]}</div>}{values.map((value, itemIndex) => hasValue(value) ? renderLeaf({ record, index, path: `${field}.${itemIndex}`, displayValue: value }) : null)}</div>;
  };
  const renderNarrative = (record, index, field, showFieldLabel) => {
    const source = String(valueAt(record, field, index) || '');
    if (!source.trim()) return null;
    const groups = groupClauses(splitClauses(field, source));
    return groups.map((group, groupIndex) => {
      const subtitle = group.subtitle || (showFieldLabel ? FIELD_LABELS[field] : null);
      return <div className={`rec-mini-card nested-mini-card${subtitle ? '' : ' regular-row-group'}`} key={`${field}-${groupIndex}`}>{subtitle && <div className="nested-subtitle">{highlight(subtitle)}</div>}{group.items.map(item => renderLeaf({ record, index, path: field, leafKey: `${field}-${index}-clause-${item.index}`, displayValue: item.value, initialValue: item.value, saveValue: next => source.slice(0, item.start) + (item.labeled ? `${item.label}: ${String(next).trim()}` : String(next).trim()) + source.slice(item.end) }))}</div>;
    });
  };

  const sectionLines = (record, section) => {
    const lines = [section.title.toUpperCase(), '-'.repeat(40)];
    section.fields.forEach(field => {
      const value = record[field];
      if (!hasValue(value)) return;
      if (field === 'date') { lines.push('Date', `1. ${formatDate(value)}`); return; }
      if (Array.isArray(value)) { value.filter(hasValue).forEach((item, itemIndex) => lines.push(`${itemIndex + 1}. ${item}`)); return; }
      if (NARRATIVE_FIELDS.has(field)) {
        const clauses = splitClauses(field, value);
        if (FIELD_LABELS[field] !== section.title) lines.push(FIELD_LABELS[field]);
        clauses.forEach((clause, clauseIndex) => {
          const parsed = parseLabel(clause.text);
          if (parsed.labeled) lines.push(parsed.label);
          lines.push(`${clauseIndex + 1}. ${parsed.value}`);
        });
        return;
      }
      if (FIELD_LABELS[field] !== section.title) lines.push(FIELD_LABELS[field]);
      lines.push(`1. ${value}`);
    });
    return lines;
  };
  const allText = (record, index) => {
    const merged = mergedRecord(record, index, true);
    const lines = [`ASTHMA ASSESSMENT ${index + 1}`, '='.repeat(40)];
    SECTIONS.forEach(section => {
      const output = sectionLines(merged, section);
      if (output.length > 2) lines.push('', ...output);
    });
    return lines.join('\n');
  };
  const renderScoreOverview = record => {
    const charts = chartDataFor(record);
    if (!charts.length) return null;
    const groups = [...new Set(charts.map(chart => chart.group))];
    return <div className="section"><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">Score Overview</h3></div>{groups.map(group => <div className="chart-category" key={group}><div className="category-header"><span className="category-name">{group}</span></div>{charts.filter(chart => chart.group === group).map(chart => <div className="bar-chart-row" key={chart.label}><div className="bar-label">{chart.label}</div><div className="bar-container"><div className="bar-background"><div className="bar-fill" style={{ width: `${chart.percentage}%` }} /></div><span className="bar-value">{chart.value}</span></div><span className="bar-interpretation">{chart.interpretation}</span></div>)}</div>)}</div></div>;
  };
  const renderSection = (record, index, section) => {
    const merged = mergedRecord(record, index, true);
    if (!section.fields.some(field => hasValue(merged[field]))) return null;
    const body = section.fields.flatMap(field => {
      if (!hasValue(merged[field])) return [];
      const showLabel = FIELD_LABELS[field] !== section.title;
      if (Array.isArray(merged[field])) return [renderArray(record, index, field, showLabel)];
      if (NARRATIVE_FIELDS.has(field)) return [renderNarrative(record, index, field, showLabel)];
      return [renderSimple(record, index, section, field, showLabel)];
    }).filter(Boolean);
    if (!body.length) return null;
    const copyId = `${recordIdOf(record) || index}-${section.id}`;
    return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h3 className="section-title">{section.title}</h3><div className="header-right-actions"><button className={`copy-btn ${copied === copyId ? 'copied' : ''}`} onClick={() => copyText(sectionLines(merged, section).join('\n'), copyId)}>{copied === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, index, section)}</div></div>{body}</div></div>;
  };

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const values = records.map((record, index) => ({ record, index }));
    if (!query) return values;
    return values.filter(({ record, index }) => JSON.stringify(mergedRecord(record, index, true)).toLowerCase().includes(query) || 'asthma assessments'.includes(query));
  }, [records, searchTerm, mergedRecord]);

  if (!records.length) return <article className="asthma-assessments-document"><div className="empty-state">No asthma assessment data available.</div></article>;
  return <article className="asthma-assessments-document"><header className="document-header"><h1 className="document-title">Asthma Assessments</h1><div className="header-actions"><button className={`copy-btn ${copied === 'all' ? 'copied' : ''}`} onClick={() => copyText(records.map(allText).join('\n\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AsthmaAssessmentsDocumentPDFTemplate document={pdfData} />} fileName="Asthma_Assessments.pdf" className="pdf-btn">{({ loading }) => loading ? 'Preparing...' : 'Export PDF'}</PDFDownloadLink></div></header><div className="search-container"><input className="search-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search asthma assessments..." />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}</div><div className="records-container">{!filtered.length ? <div className="empty-state">No records match your search.</div> : filtered.map(({ record, index }) => { const merged = mergedRecord(record, index, true); return <div className="record-card" key={recordIdOf(record) || index}><div className="record-header"><h2 className="record-name">Asthma Assessment {index + 1}</h2></div>{renderSection(record, index, SECTION_BY_ID.assessmentInfo)}{renderScoreOverview(merged)}{SECTIONS.filter(section => section.id !== 'assessmentInfo').map(section => renderSection(record, index, section))}</div>; })}</div></article>;
};

export { COMMA_ARRAY_FIELDS, COMMA_SPLIT_FIELDS, KEEP_WHOLE_ARRAY_FIELDS, splitClauses };
export default AsthmaAssessmentsDocument;
