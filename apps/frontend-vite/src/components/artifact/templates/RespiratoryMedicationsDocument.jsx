import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import RespiratoryMedicationsDocumentPDFTemplate from '../pdf-templates/RespiratoryMedicationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './RespiratoryMedicationsDocument.css';

const DRAFT_KEY = 'respiratory_medicationsPendingEdits';
const SECTION_CONFIGS = [
  { id: 'medinfo', title: 'Medication Information', fields: ['name', 'genericName', 'dosage', 'frequency', 'route'] },
  { id: 'controller', title: 'Controller Medications', fields: ['controllers'] },
  { id: 'reliever', title: 'Reliever Medications', fields: ['relievers'] },
  { id: 'biologics', title: 'Biologic Therapy', fields: ['biologics'] },
  { id: 'nebulizers', title: 'Nebulizer Medications', fields: ['nebulizers'] },
  { id: 'ocs', title: 'Oral Corticosteroids', fields: ['oralCorticosteroids'] },
  { id: 'addinfo', title: 'Additional Information', fields: ['startDate', 'endDate', 'duration', 'durationDays', 'durationUnit', 'prescriber', 'indication', 'instructions', 'refills', 'active', 'sideEffects', 'drugInteractions', 'safetyWarning'] },
];
const FIELD_LABELS = {
  name: 'Name', genericName: 'Generic Name', dosage: 'Dosage', frequency: 'Frequency', route: 'Route',
  controllers: 'Controller Medications', relievers: 'Reliever Medications', biologics: 'Biologic Therapy',
  nebulizers: 'Nebulizer Medications', oralCorticosteroids: 'Oral Corticosteroids', startDate: 'Start Date',
  endDate: 'End Date', duration: 'Duration', durationDays: 'Duration (Days)', durationUnit: 'Duration Unit',
  prescriber: 'Prescriber', indication: 'Indication', instructions: 'Instructions', refills: 'Refills',
  active: 'Status', sideEffects: 'Side Effects', drugInteractions: 'Drug Interactions', safetyWarning: 'Safety Warning',
};
const FIELD_SECTION_MAP = Object.fromEntries(SECTION_CONFIGS.flatMap(section => section.fields.map(field => [field, section.id])));
const COMMA_FIELDS = ['oralCorticosteroids.duration'];
const ZERO_HIDDEN_FIELDS = ['durationDays', 'refills'];

const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* unavailable storage */ } };
const humanizeKey = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase()).trim();
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const isDateValue = value => Boolean(value?.$date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)));
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const displayScalar = (fieldPath, value) => fieldPath === 'active' && typeof value === 'boolean'
  ? (value ? 'Active' : 'Discontinued')
  : isDateValue(value) ? formatDate(value) : fmt(value);
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? fmt(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return fmt(value); } };
const toInputDate = value => { try { return new Date(value?.$date || value).toISOString().slice(0, 10); } catch { return ''; } };
const splitNumberUnit = value => {
  if (typeof value === 'number') return { num: String(value), sep: '', unit: '', typedNumber: true };
  const source = String(value ?? '').trim();
  if (!source || /^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(source)) return null;
  const match = source.match(/^(-?[\d,]*\.?\d+)(\s*)(%|[A-Za-z]{1,8}(?:\/[A-Za-z]{1,8})?)?$/);
  if (!match || !/\d/.test(match[1])) return null;
  return { num: match[1].replace(/,/g, ''), sep: match[2] || '', unit: (match[3] || '').trim(), typedNumber: false };
};
const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
// Split narrative delimiters /[.;]\s+/: semicolons always split; periods retain abbreviation/number guards.
const splitSentencesWithSeparators = text => {
  const source = String(text || '');
  const regex = /(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/g;
  const tokens = []; let start = 0; let match;
  while ((match = regex.exec(source))) {
    const value = source.slice(start, match.index).trim();
    if (value) tokens.push({ text: value, separator: match[0] });
    start = match.index + match[0].length;
  }
  let tail = source.slice(start).trim(); let separator = '';
  const terminal = tail.match(/[.;]\s*$/);
  if (terminal) { separator = terminal[0]; tail = tail.slice(0, -terminal[0].length).trim(); }
  if (tail) tokens.push({ text: tail, separator });
  return tokens.length ? tokens : [{ text: source.trim(), separator: '' }];
};
const splitTextRows = (fieldPath, value) => splitSentencesWithSeparators(value).flatMap((token, tokenIndex) => {
  const parts = COMMA_FIELDS.includes(fieldPath) ? splitByComma(token.text) : [token.text];
  return parts.map((text, partIndex) => ({ text, tokenIndex, partIndex: parts.length > 1 ? partIndex : null }));
});
const stepFor = value => String(value).includes('.') ? 0.1 : 1;
const getAtPath = (source, path) => String(path).split('.').reduce((value, key) => value?.[key], source);
const setAtPath = (source, path, value) => {
  if (!path.length) return value;
  const [head, ...tail] = path; const key = /^\d+$/.test(head) ? Number(head) : head;
  const clone = Array.isArray(source) ? [...source] : { ...(source && typeof source === 'object' ? source : {}) };
  clone[key] = setAtPath(clone[key], tail, value); return clone;
};
const flatten = value => value == null ? '' : typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : fmt(value);
const hasVisibleValue = (path, value) => !isEmptyDeep(value) && !(ZERO_HIDDEN_FIELDS.includes(path) && Number(value) === 0);
const recordIdentity = record => typeof record?._id === 'object' ? record._id.$oid : record?._id;
const restoreDraftState = records => {
  const store = readDrafts(); const local = {}, pending = {}, rows = {}, sections = {};
  records.forEach((record, idx) => {
    const drafts = store[recordIdentity(record)]; if (!drafts) return;
    Object.entries(drafts).forEach(([path, value]) => {
      local[`${path}-${idx}`] = value; pending[`${path}-${idx}`] = true; rows[`${path}-${idx}-r0`] = true;
      const section = FIELD_SECTION_MAP[path.split('.')[0]]; if (section) sections[`${section}-${idx}`] = true;
    });
  });
  return { local, pending, rows, sections };
};

const RespiratoryMedicationsDocument = ({ document: docProp, data, templateData }) => {
  const records = useMemo(() => {
    const source = templateData ?? docProp ?? data;
    if (!source) return [];
    return (Array.isArray(source) ? source : [source]).flatMap(record => {
      if (record?.respiratory_medications) return Array.isArray(record.respiratory_medications) ? record.respiratory_medications : [record.respiratory_medications];
      if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.respiratory_medications ? (Array.isArray(record.documentData.respiratory_medications) ? record.documentData.respiratory_medications : [record.documentData.respiratory_medications]) : [record.documentData];
      return [record];
    }).filter(record => record && typeof record === 'object');
  }, [templateData, docProp, data]);
  const restoredDrafts = useMemo(() => restoreDraftState(records), [records]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState(restoredDrafts.local);
  const [pendingEdits, setPendingEdits] = useState(restoredDrafts.pending);
  const [editedRows, setEditedRows] = useState(restoredDrafts.rows);
  const [editedSections, setEditedSections] = useState(restoredDrafts.sections);
  const [approvedSections, setApprovedSections] = useState({});
  const [copiedItems, setCopiedItems] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  const recordId = useCallback(record => recordIdentity(record), []);
  const getFieldValue = useCallback((record, fieldPath, idx) => {
    const exact = `${fieldPath}-${idx}`;
    if (localEdits[exact] !== undefined) return localEdits[exact];
    let value = getAtPath(record, fieldPath); const suffix = `-${idx}`;
    Object.entries(localEdits).forEach(([key, edit]) => {
      if (!key.endsWith(suffix)) return;
      const editPath = key.slice(0, -suffix.length);
      if (editPath.startsWith(`${fieldPath}.`)) value = setAtPath(value, editPath.slice(fieldPath.length + 1).split('.'), edit);
    });
    return value;
  }, [localEdits]);

  const filteredRecords = useMemo(() => records.map((record, idx) => ({ record, idx })).filter(({ record }) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return `respiratory medications ${flatten(SECTION_CONFIGS.flatMap(section => section.fields.map(field => record[field])))}`.toLowerCase().includes(query);
  }), [records, searchTerm]);

  const pdfData = useMemo(() => filteredRecords.map(({ record, idx }) => {
    let merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => {
      if (pendingEdits[key] || !key.endsWith(`-${idx}`)) return;
      const path = key.slice(0, -(`-${idx}`).length).split('.'); merged = setAtPath(merged, path, value);
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  const highlight = useCallback(value => {
    const query = searchTerm.trim(); if (!query || value == null) return value;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(value).split(regex).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);

  const copy = useCallback(async (text, key) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const area = window.document.createElement('textarea'); area.value = text; (containerRef.current || window.document.body).appendChild(area); area.select(); window.document.execCommand('copy'); area.remove(); }
    setCopiedItems(previous => ({ ...previous, [key]: true })); setTimeout(() => setCopiedItems(previous => ({ ...previous, [key]: false })), 1500);
  }, []);

  const stageDraft = useCallback((record, fieldPath, idx, sectionId, value, rowKey) => {
    const id = recordId(record); if (!id) return;
    const editKey = `${fieldPath}-${idx}`;
    setLocalEdits(previous => ({ ...previous, [editKey]: value })); setPendingEdits(previous => ({ ...previous, [editKey]: true }));
    setEditedRows(previous => ({ ...previous, [rowKey || `${fieldPath}-${idx}-r0`]: true })); setEditedSections(previous => ({ ...previous, [`${sectionId}-${idx}`]: true }));
    setApprovedSections(previous => { const next = { ...previous }; delete next[`${sectionId}-${idx}`]; return next; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fieldPath] = value; writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [recordId]);

  const saveTextRow = (record, fieldPath, idx, sectionId, row, rowKey) => {
    const tokens = splitSentencesWithSeparators(String(getFieldValue(record, fieldPath, idx) || ''));
    const token = tokens[row.tokenIndex] || { text: '', separator: '' };
    const parts = row.partIndex == null ? [token.text] : splitByComma(token.text);
    const clean = editValue.replace(/[;.]+$/, '').trim();
    if (row.partIndex == null) parts[0] = clean; else parts[row.partIndex] = clean;
    tokens[row.tokenIndex] = { ...token, text: parts.join(', ') };
    stageDraft(record, fieldPath, idx, sectionId, tokens.map(item => `${item.text}${item.separator}`).join('').trim(), rowKey);
  };

  const approveSection = useCallback(async (record, idx, sectionId) => {
    const id = recordId(record); if (!id) return;
    const fields = SECTION_CONFIGS.find(section => section.id === sectionId)?.fields || [];
    const suffix = `-${idx}`;
    const commits = Object.keys(localEdits).filter(key => pendingEdits[key] && key.endsWith(suffix) && fields.some(field => { const path = key.slice(0, -suffix.length); return path === field || path.startsWith(`${field}.`); }));
    setSaving(true);
    try {
      for (const key of commits) {
        const path = key.slice(0, -suffix.length);
        const response = await secureApiClient.put(`/api/edit/respiratory_medications/${id}/edit`, { field: path, value: localEdits[key] });
        if (response?.success === false) throw new Error(response.error || 'Save failed');
      }
      await secureApiClient.put(`/api/edit/respiratory_medications/${id}/approve`, { sectionId, approved: true });
      setPendingEdits(previous => { const next = { ...previous }; commits.forEach(key => delete next[key]); return next; });
      setEditedRows(previous => { const next = { ...previous }; Object.keys(next).forEach(key => { const rowPath = key.replace(/-r\d+$/, ''); if (rowPath.endsWith(suffix) && fields.some(field => { const path = rowPath.slice(0, -suffix.length); return path === field || path.startsWith(`${field}.`); })) delete next[key]; }); return next; });
      setEditedSections(previous => { const next = { ...previous }; delete next[`${sectionId}-${idx}`]; return next; });
      setApprovedSections(previous => ({ ...previous, [`${sectionId}-${idx}`]: true }));
      const store = readDrafts(); if (store[id]) { commits.forEach(key => delete store[id][key.slice(0, -suffix.length)]); if (!Object.keys(store[id]).length) delete store[id]; writeDrafts(store); }
    } catch (error) { console.error('[RespiratoryMedications] Approve error:', error); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, [recordId, localEdits, pendingEdits]);

  const renderEditableLeaf = (record, fieldPath, idx, sectionId, rawFallback, label = '', framed = true) => {
    const current = getFieldValue(record, fieldPath, idx); const rawValue = current === undefined ? rawFallback : current;
    if (!hasVisibleValue(fieldPath, rawValue)) return null;
    const bool = typeof rawValue === 'boolean'; const date = !bool && isDateValue(rawValue); const numeric = !bool && !date ? splitNumberUnit(rawValue) : null;
    const display = displayScalar(fieldPath, rawValue);
    const rows = !bool && !date && !numeric ? splitTextRows(fieldPath, display) : [{ text: display, tokenIndex: 0, partIndex: null }];
    const body = <>
      {label && <div className="nested-subtitle sub-label">{highlight(label)}</div>}
      {rows.map((row, rowIndex) => {
        const rowKey = `${fieldPath}-${idx}-r${rowIndex}`; const editKey = `${rowKey}-edit`; const editing = editingField === editKey;
        const step = numeric ? stepFor(numeric.num) : 1; const parsed = Number.parseFloat(editValue); const base = Number.isFinite(parsed) ? parsed : 0;
        const changeNumber = direction => setEditValue(String(Number((base + direction * step).toFixed(String(step).includes('.') ? 1 : 0))));
        const trueLabel = fieldPath === 'active' ? 'Active' : 'Yes'; const falseLabel = fieldPath === 'active' ? 'Discontinued' : 'No';
        return <div key={rowKey} data-edit-field={fieldPath}>
          <div className={`numbered-row editable-row${editedRows[rowKey] ? ' modified' : ''}`} onClick={() => { if (!editing) { setEditingField(editKey); setEditValue(bool ? (rawValue ? trueLabel : falseLabel) : date ? toInputDate(rawValue) : numeric ? numeric.num : row.text); setSaveError(null); } }}>
            {editing ? <div className="edit-field-container">
              {bool ? <BlueSelect value={editValue} options={[trueLabel, falseLabel]} onChange={setEditValue} />
                : date ? <BlueDatePicker value={editValue} onSelect={setEditValue} />
                  : numeric ? <div className="number-edit-row"><div className="num-stepper-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); changeNumber(-1); }}>−</button><input className="edit-number" inputMode="decimal" value={editValue} onClick={event => event.stopPropagation()} onChange={event => setEditValue(event.target.value)} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); changeNumber(1); }}>+</button></div>{numeric.unit && <span className="number-edit-unit">{numeric.unit}</span>}</div>
                    : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation();
                if (bool) { stageDraft(record, fieldPath, idx, sectionId, editValue === trueLabel, rowKey); return; }
                if (date) { if (Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } stageDraft(record, fieldPath, idx, sectionId, editValue, rowKey); return; }
                if (numeric) { const number = Number.parseFloat(editValue); if (!Number.isFinite(number)) { setSaveError('Please enter a valid number'); return; } stageDraft(record, fieldPath, idx, sectionId, numeric.typedNumber ? number : `${number}${numeric.sep}${numeric.unit}`, rowKey); return; }
                saveTextRow(record, fieldPath, idx, sectionId, row, rowKey);
              }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
            </div> : <><div className="row-content"><span className="content-value">{highlight(row.text)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn${copiedItems[rowKey] ? ' copied' : ''}`} onClick={event => { event.stopPropagation(); copy(row.text, rowKey); }}>{copiedItems[rowKey] ? 'Copied!' : 'Copy'}</button></>}
          </div>{editedRows[rowKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>;
      })}
    </>;
    return framed ? <div key={fieldPath} className="nested-mini-card">{body}</div> : <React.Fragment key={fieldPath}>{body}</React.Fragment>;
  };

  const renderNode = (record, fieldPath, idx, sectionId, value, label = '') => {
    if (!hasVisibleValue(fieldPath, value)) return null;
    if (isDateValue(value) || typeof value !== 'object') return renderEditableLeaf(record, fieldPath, idx, sectionId, value, label, true);
    if (Array.isArray(value)) {
      const items = value.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => !isEmptyDeep(item)); if (!items.length) return null;
      if (items.every(({ item }) => typeof item !== 'object' || isDateValue(item))) return <React.Fragment key={fieldPath}>{label && <div className="nested-subtitle sub-label">{highlight(label)}</div>}<div className="nested-mini-card regular-row-group">{items.map(({ item, itemIndex }) => renderEditableLeaf(record, `${fieldPath}.${itemIndex}`, idx, sectionId, item, '', false))}</div></React.Fragment>;
      return <div className="nested-group" key={fieldPath}>{label && <div className="nested-subtitle">{highlight(label)}</div>}{items.map(({ item, itemIndex }) => <div className="nested-mini-card object-item-card" key={itemIndex}><div className="nested-subtitle sub-label">{`Item ${itemIndex + 1}`}</div>{Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).map(([key, child]) => renderNode(record, `${fieldPath}.${itemIndex}.${key}`, idx, sectionId, child, humanizeKey(key)))}</div>)}</div>;
    }
    const entries = Object.entries(value).filter(([, child]) => !isEmptyDeep(child)); if (!entries.length) return null;
    return <div className="nested-group" key={fieldPath}>{label && <div className="nested-subtitle">{highlight(label)}</div>}{entries.map(([key, child]) => renderNode(record, `${fieldPath}.${key}`, idx, sectionId, child, humanizeKey(key)))}</div>;
  };

  const buildCopyLines = (label, value, fieldPath, indent = 0) => {
    if (!hasVisibleValue(fieldPath, value)) return [];
    const pad = '  '.repeat(indent); const lines = [];
    if (isDateValue(value) || typeof value !== 'object') {
      if (label) lines.push(`${pad}${label}`, `${pad}${'-'.repeat(40)}`);
      const display = displayScalar(fieldPath, value); splitTextRows(fieldPath, display).forEach((row, index) => lines.push(`${pad}${index + 1}. ${row.text}`)); return lines;
    }
    if (label) lines.push(`${pad}${label}`, `${pad}${'-'.repeat(40)}`);
    if (Array.isArray(value)) {
      let number = 1;
      value.forEach((item, itemIndex) => {
        if (isEmptyDeep(item)) return;
        if (typeof item !== 'object' || isDateValue(item)) splitTextRows(`${fieldPath}.${itemIndex}`, isDateValue(item) ? formatDate(item) : fmt(item)).forEach(row => lines.push(`${pad}${number++}. ${row.text}`));
        else { lines.push(`${pad}Item ${itemIndex + 1}`); Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => lines.push(...buildCopyLines(humanizeKey(key), child, `${fieldPath}.${itemIndex}.${key}`, indent + 1))); }
      });
      return lines;
    }
    Object.entries(value).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => lines.push(...buildCopyLines(humanizeKey(key), child, `${fieldPath}.${key}`, indent + (label ? 1 : 0))));
    return lines;
  };

  const sectionCopyText = (record, idx, section) => {
    let text = `${section.title}\n${'='.repeat(40)}\n\n`;
    section.fields.forEach(field => {
      const value = getFieldValue(record, field, idx); if (!hasVisibleValue(field, value)) return;
      const label = FIELD_LABELS[field] || humanizeKey(field); const showLabel = label.toLowerCase() !== section.title.toLowerCase();
      buildCopyLines(showLabel ? label : '', value, field).forEach(line => { text += `${line}\n`; }); text += '\n';
    });
    return text;
  };

  const copyAll = async () => {
    let text = '=== RESPIRATORY MEDICATIONS ===\n\n';
    filteredRecords.forEach(({ record, idx }, displayIndex) => { text += `Respiratory Medications ${displayIndex + 1}\n${'='.repeat(40)}\n\n`; SECTION_CONFIGS.forEach(section => { if (section.fields.some(field => hasVisibleValue(field, getFieldValue(record, field, idx)))) text += sectionCopyText(record, idx, section); }); text += '\n'; });
    try { await navigator.clipboard.writeText(text); } catch { /* copy button remains usable in browsers with clipboard access */ }
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1500);
  };

  if (!records.length) return <div className="respiratory-medications-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Respiratory Medications</h2></div><div className="empty-state">No respiratory medications records available</div></div>;

  return <div className="respiratory-medications-document" ref={containerRef}>
    <div className="document-header"><h2 className="document-title">Respiratory Medications</h2><div className="header-actions"><button className={`copy-btn${copiedAll ? ' copied' : ''}`} onClick={copyAll}>{copiedAll ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<RespiratoryMedicationsDocumentPDFTemplate document={pdfData} />} fileName="Respiratory_Medications.pdf" className="copy-btn">{({ loading }) => loading ? 'Generating...' : 'Export PDF'}</PDFDownloadLink></div></div>
    <div className="search-container"><input className="search-input" placeholder="Search respiratory medications..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
    <div className="records-container">{filteredRecords.map(({ record, idx }, displayIndex) => <div className="record-card" key={recordId(record) || idx}><div className="record-header"><h3 className="record-name">{highlight(`Respiratory Medications ${displayIndex + 1}`)}</h3></div>
      {SECTION_CONFIGS.map(section => {
        const present = section.fields.filter(field => hasVisibleValue(field, getFieldValue(record, field, idx))); if (!present.length) return null;
        const copyKey = `${section.id}-${idx}`;
        return <div className="section" key={section.id}><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlight(section.title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedSection === copyKey ? ' copied' : ''}`} onClick={async () => { await copy(sectionCopyText(record, idx, section), copyKey); setCopiedSection(copyKey); setTimeout(() => setCopiedSection(null), 1500); }}>{copiedSection === copyKey ? 'Copied!' : 'Copy Section'}</button>{editedSections[copyKey] ? <button className="approve-btn pending" disabled={saving} onClick={() => approveSection(record, idx, section.id)}>{saving ? 'Approving...' : 'Pending Approve'}</button> : approvedSections[copyKey] ? <span className="approve-btn approved">Approved</span> : null}</div></div>
          {present.map(field => { const value = getFieldValue(record, field, idx); const label = FIELD_LABELS[field] || humanizeKey(field); const showLabel = label.toLowerCase() !== section.title.toLowerCase(); return <div className="rec-mini-card" key={field}>{renderNode(record, field, idx, section.id, value, showLabel ? label : '')}</div>; })}
        </div></div>;
      })}
    </div>)}</div>
  </div>;
};

export default RespiratoryMedicationsDocument;
