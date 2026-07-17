import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AllergyAssessmentsDocumentPDFTemplate from '../pdf-templates/AllergyAssessmentsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './AllergyAssessmentsDocument.css';

const DRAFT_KEY = 'allergy_assessmentsPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* best effort */ } };

const SECTION_TITLES = { metadata: 'Assessment Details', exposure: 'Environmental Allergens', testing: 'Skin Test Results', laboratory: 'Laboratory Results', specific: 'Specific IgE' };
const FIELD_LABELS = { date: 'Date', provider: 'Provider', environmentalAllergens: 'Environmental Allergens', skinTestResults: 'Skin Test Results', totalIge: 'Total IgE', eosinophilCount: 'Eosinophil Count', specificIgE: 'Specific IgE' };
const SECTION_FIELDS = { metadata: ['date', 'provider'], exposure: ['environmentalAllergens'], testing: ['skinTestResults'], laboratory: ['totalIge', 'eosinophilCount'], specific: ['specificIgE'] };
const DATE_FIELDS = new Set(['date']);
const BOOLEAN_FIELDS = new Set();
const NUMBER_FIELDS = new Set();
const HIDE_ZERO_FIELDS = new Set();
const ARRAY_FIELDS = new Set(['environmentalAllergens', 'skinTestResults']);
const COMMA_ARRAY_FIELDS = [];
const COMMA_LABELED_ARRAY_FIELDS = new Set(['skinTestResults']);
const COMMA_STRING_FIELDS = new Set();
const SENTENCE_STRING_FIELDS = new Set();
const OBJECT_FIELDS = new Set(['specificIgE']);
const ENUM_OPTIONS = {};
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());

const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal));
const fieldHasVal = (field, value) => hasVal(value) && !(HIDE_ZERO_FIELDS.has(field) && Number(value) === 0);
const safeId = record => record?._id?.$oid || record?._id || '';
const unwrap = source => {
  if (!source) return [];
  let rows = Array.isArray(source) ? source : [source];
  rows = rows.flatMap(row => {
    if (Array.isArray(row?.records)) return row.records;
    if (Array.isArray(row?._records)) return row._records;
    if (row?.allergy_assessments) return Array.isArray(row.allergy_assessments) ? row.allergy_assessments : [row.allergy_assessments];
    if (row?.documentData) {
      const nested = row.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.allergy_assessments) return Array.isArray(nested.allergy_assessments) ? nested.allergy_assessments : [nested.allergy_assessments];
      return [nested];
    }
    return [row];
  });
  return rows.filter(row => row && typeof row === 'object');
};
const formatDate = value => { if (!value) return ''; try { const raw = value?.$date?.$numberLong ?? value?.$date ?? value?.$numberLong ?? value; const normalized = typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw; const date = new Date(normalized); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const toInputDate = value => { if (!value) return ''; const raw = value?.$date?.$numberLong ?? value?.$date ?? value; const date = new Date(typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match && !/[([\]]/.test(match[1]) ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|(?<!\b[A-Z])\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false } = {}) => (sentences ? splitSentence(value) : [String(value || '').trim()]).flatMap(part => { const parsed = parseLabel(part); const clauses = commas ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); });
const getPath = (record, path) => String(path).split('.').reduce((value, part) => value?.[part], record);
const setPath = (record, path, value) => { const parts = String(path).split('.'); let cursor = record; parts.slice(0, -1).forEach(part => { const nextPart = parts[parts.indexOf(part) + 1]; if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = /^\d+$/.test(nextPart) ? [] : {}; cursor = cursor[part]; }); cursor[parts.at(-1)] = value; };

const AllergyAssessmentsDocument = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = useMemo(() => unwrap(documentProp ?? dataProp ?? templateData), [documentProp, dataProp, templateData]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [copiedItems, setCopiedItems] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const store = readDrafts(), restored = {}, pending = {}, edited = {};
    records.forEach((record, index) => Object.entries(store[safeId(record)] || {}).forEach(([path, value]) => { const key = `${path}-${index}`; restored[key] = value; pending[key] = true; edited[key] = true; }));
    setLocalEdits(previous => ({ ...restored, ...previous }));
    setPendingEdits(previous => ({ ...pending, ...previous }));
    setEditedFields(previous => ({ ...edited, ...previous }));
  }, [records]);

  const getValue = useCallback((record, path, index) => { const key = `${path}-${index}`; return Object.hasOwn(localEdits, key) ? localEdits[key] : getPath(record, path); }, [localEdits]);
  const stagePath = useCallback((record, path, index, section, value) => {
    const id = safeId(record); if (!id) { setSaveError('This record cannot be edited because it has no ID.'); return; }
    const key = `${path}-${index}`, store = readDrafts(); if (!store[id]) store[id] = {}; store[id][path] = value; writeDrafts(store);
    setLocalEdits(previous => ({ ...previous, [key]: value })); setPendingEdits(previous => ({ ...previous, [key]: true })); setEditedFields(previous => ({ ...previous, [key]: true }));
    setApprovedSections(previous => { const next = { ...previous }; delete next[`${section}-${index}`]; return next; }); setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);
  const sectionHasEdits = useCallback((section, index) => SECTION_FIELDS[section].some(field => Object.keys(pendingEdits).some(key => key.endsWith(`-${index}`) && key.slice(0, key.lastIndexOf(`-${index}`)).split('.')[0] === field)), [pendingEdits]);
  const approve = useCallback(async (record, section, index) => {
    const id = safeId(record); if (!id) return; setSaving(true); setSaveError(null);
    try {
      const store = readDrafts(), drafts = store[id] || {}, committed = [];
      for (const [path, value] of Object.entries(drafts)) { if (!SECTION_FIELDS[section].includes(path.split('.')[0])) continue; const response = await secureApiClient.put(`/api/edit/allergy_assessments/${id}/edit`, { field: path, value }); if (response?.success === false) throw new Error(response.error || 'Save failed'); committed.push(path); }
      await secureApiClient.put(`/api/edit/allergy_assessments/${id}/approve`, { sectionId: section, approved: true });
      setPendingEdits(previous => { const next = { ...previous }; committed.forEach(path => delete next[`${path}-${index}`]); return next; }); committed.forEach(path => delete drafts[path]); if (Object.keys(drafts).length) store[id] = drafts; else delete store[id]; writeDrafts(store); setApprovedSections(previous => ({ ...previous, [`${section}-${index}`]: true }));
    } catch (error) { console.error(error); setSaveError('Approve failed. Please try again.'); } finally { setSaving(false); }
  }, []);
  const copyText = useCallback(async text => { try { await navigator.clipboard.writeText(text); return true; } catch { const area = window.document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; (containerRef.current || window.document.body).appendChild(area); area.select(); const copied = window.document.execCommand('copy'); area.remove(); return copied; } }, []);
  const rowsFor = useCallback((field, value) => {
    if (DATE_FIELDS.has(field)) return [{ value: formatDate(value), raw: value, path: field, type: 'date' }];
    if (ENUM_OPTIONS[field] && splitSentence(value).length === 1) return [{ value: String(value), raw: value, path: field, type: 'enum', options: [...ENUM_OPTIONS[field], ...(!ENUM_OPTIONS[field].some(option => option.toLowerCase() === String(value).toLowerCase()) ? [String(value)] : [])] }];
    if (BOOLEAN_FIELDS.has(field)) return [{ value: value ? 'Yes' : 'No', raw: value, path: field, type: 'boolean' }];
    if (NUMBER_FIELDS.has(field)) return [{ value: String(value), raw: value, path: field, type: 'number' }];
    if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : []).flatMap((item, itemIndex) => textRows(item, { sentences: true, commas: COMMA_ARRAY_FIELDS.includes(field) || COMMA_LABELED_ARRAY_FIELDS.has(field) }).map(entry => ({ ...entry, path: `${field}.${itemIndex}`, raw: item, type: 'text', textStructured: true })));
    if (OBJECT_FIELDS.has(field)) return Object.entries(value || {}).filter(([, item]) => hasVal(item)).map(([key, item]) => ({ subtitle: humanize(key), value: String(item), raw: item, path: `${field}.${key}`, type: 'text' }));
    return textRows(value, { sentences: SENTENCE_STRING_FIELDS.has(field), commas: COMMA_STRING_FIELDS.has(field) }).map(entry => ({ ...entry, path: field, raw: value, type: 'text', textStructured: SENTENCE_STRING_FIELDS.has(field) || COMMA_STRING_FIELDS.has(field) }));
  }, []);
  const rebuildTextRows = (siblings, target, nextValue) => { const values = siblings.map(entry => entry === target ? nextValue : entry.value); const subtitle = siblings.find(entry => entry.subtitle)?.subtitle || ''; return `${subtitle ? `${subtitle}: ` : ''}${values.join('; ')}`; };
  const sectionCopy = useCallback((record, index, section) => {
    const present = SECTION_FIELDS[section].filter(field => fieldHasVal(field, getValue(record, field, index))); if (!present.length) return '';
    let text = `${SECTION_TITLES[section]}\n${'='.repeat(40)}\n\n`; present.forEach(field => { const value = getValue(record, field, index); text += `${FIELD_LABELS[field]}\n${'-'.repeat(40)}\n`; let prior = ''; rowsFor(field, value).forEach((entry, rowIndex) => { if (entry.subtitle && entry.subtitle !== prior) text += `${entry.subtitle}\n`; text += `${rowIndex + 1}. ${entry.value}\n`; prior = entry.subtitle || ''; }); text += '\n'; }); return text;
  }, [getValue, rowsFor]);
  const copyAll = useCallback(async () => { let text = `ALLERGY ASSESSMENTS\n${'='.repeat(40)}\n\n`; records.forEach((record, index) => { text += `Allergy Assessment ${index + 1}\n${'='.repeat(40)}\n\n`; Object.keys(SECTION_FIELDS).forEach(section => { text += sectionCopy(record, index, section); }); }); if (await copyText(text)) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); } }, [copyText, records, sectionCopy]);
  const highlight = useCallback(value => { if (!searchTerm.trim()) return value; const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matcher = new RegExp(`(${escaped})`, 'gi'); return String(value).split(matcher).map((part, index) => matcher.test(part) ? <mark key={index}>{part}</mark> : part); }, [searchTerm]);
  const row = ({ record, field, section, recordIndex, entry, key, save }) => {
    const editing = editingField === key, type = entry.type, dataField = entry.path, modified = editedFields[`${dataField}-${recordIndex}`], display = type === 'date' ? formatDate(entry.raw) : type === 'boolean' ? (entry.raw === true || entry.value === 'Yes' ? 'Yes' : 'No') : String(entry.value);
    const beginEditing = () => { if (editing) return; setEditingField(key); setEditValue(type === 'date' ? toInputDate(entry.raw) : display); setSaveError(null); };
    const saveValue = event => { event.stopPropagation(); if (type === 'number' && !Number.isFinite(Number(editValue))) { setSaveError('Enter a valid number.'); return; } save(type === 'boolean' ? editValue === 'Yes' : type === 'number' ? Number(editValue) : editValue); };
    return <div key={key} className="editable-leaf" data-edit-field={dataField}><div className={`numbered-row editable-row ${modified ? 'modified' : ''}`} onClick={beginEditing}>{editing ? <div className="edit-field-container">{type === 'date' ? <BlueDatePicker value={editValue} onSelect={next => setEditValue(next || '')} /> : type === 'boolean' ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} /> : type === 'enum' ? <BlueSelect value={editValue} options={entry.options} onChange={setEditValue} /> : type === 'number' ? <div className="number-edit-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-input edit-number" value={editValue} onChange={event => setEditValue(event.target.value)} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button></div> : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={saveValue}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={async event => { event.stopPropagation(); if (await copyText(display)) { setCopiedItems(previous => ({ ...previous, [key]: true })); setTimeout(() => setCopiedItems(previous => ({ ...previous, [key]: false })), 2000); } }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>;
  };
  const renderField = (record, field, recordIndex, section) => {
    const value = getValue(record, field, recordIndex); if (!fieldHasVal(field, value)) return null; const entries = rowsFor(field, value), showFieldLabel = FIELD_LABELS[field].toLowerCase() !== SECTION_TITLES[section].toLowerCase(), groups = [];
    entries.forEach((entry, entryIndex) => { const label = entry.subtitle || '', last = groups.at(-1); if (last && last.label === label) last.entries.push({ entry, entryIndex }); else groups.push({ label, entries: [{ entry, entryIndex }] }); });
    return groups.map((group, groupIndex) => <div key={`${field}-${groupIndex}`} className="rec-mini-card nested-mini-card">{(showFieldLabel || group.label) && <div className="nested-subtitle">{showFieldLabel ? FIELD_LABELS[field] : ''}{showFieldLabel && group.label ? ' — ' : ''}{group.label}</div>}{group.entries.map(({ entry, entryIndex }) => row({ record, field, section, recordIndex, entry, key: `${field}-${recordIndex}-${entryIndex}`, save: next => { if (entry.textStructured) { const siblings = entries.filter(candidate => candidate.path === entry.path); stagePath(record, entry.path, recordIndex, section, rebuildTextRows(siblings, entry, next)); } else stagePath(record, entry.path, recordIndex, section, next); } }))}</div>);
  };
  const matches = useCallback(record => !searchTerm.trim() || JSON.stringify(record).toLowerCase().includes(searchTerm.trim().toLowerCase()), [searchTerm]);
  const pdfData = useMemo(() => records.filter(matches).map((record, index) => { const merged = structuredClone(record); Object.entries(localEdits).forEach(([key, value]) => { const suffix = `-${index}`; if (key.endsWith(suffix) && !pendingEdits[key]) setPath(merged, key.slice(0, -suffix.length), value); }); return merged; }), [localEdits, matches, pendingEdits, records]);

  return <div ref={containerRef} className="allergy-assessments-document"><div className="document-header"><h2 className="document-title">Allergy Assessments</h2><div className="header-actions"><button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<AllergyAssessmentsDocumentPDFTemplate document={pdfData} />} fileName="Allergy_Assessments.pdf" className="copy-btn">Export PDF</PDFDownloadLink></div></div><div className="search-container"><input className="search-input" type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search allergy assessments..." /></div><div className="records-container">{records.filter(matches).map((record, recordIndex) => <div className="record-card" key={safeId(record) || recordIndex}><div className="record-header"><h3 className="record-title">Allergy Assessment {recordIndex + 1}</h3></div>{Object.keys(SECTION_FIELDS).map(section => { const fields = SECTION_FIELDS[section]; if (!fields.some(field => fieldHasVal(field, getValue(record, field, recordIndex)))) return null; const copyId = `${section}-${recordIndex}`, hasEdits = sectionHasEdits(section, recordIndex); return <section className="section" key={section}><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{SECTION_TITLES[section]}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={async () => { if (await copyText(sectionCopy(record, recordIndex, section))) { setCopiedSection(copyId); setTimeout(() => setCopiedSection(null), 2000); } }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{hasEdits && <button className="approve-btn pending" disabled={saving} onClick={() => approve(record, section, recordIndex)}>Pending Approve</button>}{approvedSections[copyId] && !hasEdits && <span className="approve-btn approved">Approved</span>}</div></div>{fields.map(field => renderField(record, field, recordIndex, section))}</div></section>; })}</div>)}</div>{!records.length && <div className="empty-state">No allergy assessment records available</div>}</div>;
};

export default AllergyAssessmentsDocument;
