import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import UrologyConsultationsDocumentPDFTemplate from '../pdf-templates/UrologyConsultationsDocumentPDFTemplate';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './UrologyConsultationsDocument.css';

const DRAFT_KEY = 'urology_consultationsPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* local draft storage is best effort */ } };

const SECTION_TITLES = {
  cc: 'Chief Complaint & Symptoms', prostate: 'Prostate Assessment', renal: 'Renal Function', stones: 'Stone Disease & Hematuria',
  urodynamics: 'Urodynamics Results', incontinence: 'Incontinence Assessment', cystoscopy: 'Cystoscopy Findings',
  bladder: 'Bladder & Renal Assessment', sexual: 'Sexual Function & Fertility',
};
const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint', voiding: 'Voiding Symptoms', ipssScore: 'IPSS Score', psaLevel: 'PSA Level', prostateSize: 'Prostate Size',
  digitalRectalExam: 'Digital Rectal Exam', creativeLevel: 'Creatinine Level', estimatedGFR: 'Estimated GFR', postVoidResidual: 'Post-Void Residual',
  kidneyStones: 'Kidney Stones', stoneComposition: 'Stone Composition', hematuria: 'Hematuria', urodynamicsResults: 'Urodynamics Results',
  incontinenceType: 'Incontinence Type', padTest24Hour: '24-Hour Pad Test', cystoscopyFindings: 'Cystoscopy Findings', bladderTumor: 'Bladder Tumor',
  renalMass: 'Renal Mass', bosniakClassification: 'Bosniak Classification', erectileDysfunction: 'Erectile Dysfunction', iief5Score: 'IIEF-5 Score',
  testosteroneLevel: 'Testosterone Level', varicocele: 'Varicocele', spermAnalysis: 'Sperm Analysis',
};
const SECTION_FIELDS = {
  cc: ['chiefComplaint', 'voiding'], prostate: ['ipssScore', 'psaLevel', 'prostateSize', 'digitalRectalExam'],
  renal: ['creativeLevel', 'estimatedGFR', 'postVoidResidual'], stones: ['kidneyStones', 'stoneComposition', 'hematuria'],
  urodynamics: ['urodynamicsResults'], incontinence: ['incontinenceType', 'padTest24Hour'], cystoscopy: ['cystoscopyFindings'],
  bladder: ['bladderTumor', 'renalMass', 'bosniakClassification'], sexual: ['erectileDysfunction', 'iief5Score', 'testosteroneLevel', 'varicocele', 'spermAnalysis'],
};
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const BOOLEAN_FIELDS = new Set(['kidneyStones', 'hematuria', 'bladderTumor', 'renalMass', 'erectileDysfunction']);
const NUMBER_FIELDS = new Set(['ipssScore', 'psaLevel', 'prostateSize', 'creativeLevel', 'estimatedGFR', 'postVoidResidual', 'padTest24Hour', 'iief5Score', 'testosteroneLevel']);
const COMMA_ARRAY_FIELDS = new Set(['voiding', 'cystoscopyFindings']);
const UNIT_MAP = { psaLevel: 'ng/mL', prostateSize: 'g', creativeLevel: 'mg/dL', estimatedGFR: 'mL/min/1.73m\u00B2', postVoidResidual: 'mL', padTest24Hour: 'g', testosteroneLevel: 'ng/dL' };

const hasField = (field, value) => {
  if (value === null || value === undefined || value === '') return false;
  if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean';
  if (NUMBER_FIELDS.has(field)) return Number.isFinite(Number(value)) && Number(value) !== 0;
  return typeof value === 'string' ? Boolean(value.trim()) : true;
};
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '').trim() }; };
const splitByComma = text => { const values = []; let current = ''; let depth = 0; for (const char of String(text || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char; } if (current.trim()) values.push(current.trim()); return values.length ? values : [String(text || '').trim()]; };
const splitEditableClauses = text => { const source = String(text || ''); const clauses = []; let start = 0; for (let i = 0; i < source.length; i += 1) { const char = source[i]; const boundary = i === source.length - 1 || /\s/.test(source[i + 1]); const split = (char === ';' && boundary) || (char === '.' && !/\d/.test(source[i - 1] || '') && boundary); if (!split) continue; const value = source.slice(start, i).trim(); if (value) clauses.push({ text: value, separator: char }); start = i + 1; while (/\s/.test(source[start] || '')) start += 1; } const tail = source.slice(start).trim(); if (tail) clauses.push({ text: tail, separator: '' }); return clauses; };
const reconstructClauses = clauses => clauses.map((clause, index) => `${clause.text.trim()}${clause.separator || (index < clauses.length - 1 ? '.' : '')}`).join(' ');
const displayCommaItem = (source, item, index) => {
  if (!/^No\s+/i.test(source) || index === 0) return item;
  return `No ${item.replace(/^(?:and|or)\s+/i, '').replace(/^No\s+/i, '')}`;
};
const stringRows = (field, value) => splitEditableClauses(value).flatMap((clause, clauseIndex) => {
  const parsed = parseLabel(clause.text);
  const items = COMMA_ARRAY_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value];
  return items.filter(Boolean).map((item, itemIndex) => ({ clauseIndex, itemIndex, label: parsed.label, value: displayCommaItem(parsed.value, item, itemIndex) }));
});
const formatField = (field, value) => BOOLEAN_FIELDS.has(field) ? (value ? 'Yes' : 'No') : UNIT_MAP[field] ? `${value} ${UNIT_MAP[field]}` : String(value ?? '');

const UrologyConsultationsDocument = ({ document: documentProp, data, templateData }) => {
  const source = documentProp ?? data ?? templateData;
  const records = useMemo(() => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
    if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
    if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
    if (record?.urology_consultations) return Array.isArray(record.urology_consultations) ? record.urology_consultations : [record.urology_consultations];
    if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.urology_consultations ? (Array.isArray(record.documentData.urology_consultations) ? record.documentData.urology_consultations : [record.documentData.urology_consultations]) : [record.documentData];
    return [record];
  }).filter(record => record && typeof record === 'object'), [source]);
  const [searchTerm, setSearchTerm] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [copiedItems, setCopiedItems] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);
  const safeId = record => typeof record?._id === 'string' ? record._id : record?._id?.$oid || (record?._id ? String(record._id) : null);

  useEffect(() => {
    const store = readDrafts(); const nextLocal = {}; const nextPending = {}; const nextEdited = {};
    records.forEach((record, index) => { const draft = store[safeId(record)]; if (!draft) return; Object.entries(draft).forEach(([field, value]) => { const key = `${field}-${index}`; nextLocal[key] = value; nextPending[key] = true; nextEdited[key] = 'edited'; }); });
    if (Object.keys(nextLocal).length) { setLocalEdits(previous => ({ ...nextLocal, ...previous })); setPendingEdits(previous => ({ ...nextPending, ...previous })); setEditedFields(previous => ({ ...nextEdited, ...previous })); }
  }, [records]);

  const getValue = useCallback((record, field, index) => localEdits[`${field}-${index}`] !== undefined ? localEdits[`${field}-${index}`] : record[field], [localEdits]);
  const stageField = (record, field, index, sectionId, value, trackingKey) => {
    const id = safeId(record); if (!id) return; const key = `${field}-${index}`;
    setLocalEdits(previous => ({ ...previous, [key]: value })); setPendingEdits(previous => ({ ...previous, [key]: true })); setEditedFields(previous => ({ ...previous, [trackingKey || key]: 'edited' }));
    setApprovedSections(previous => { const copy = { ...previous }; delete copy[`${sectionId}-${index}`]; return copy; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][field] = value; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null);
  };
  const sectionHasEdits = (sectionId, index) => SECTION_FIELDS[sectionId].some(field => Object.keys(editedFields).some(key => key.startsWith(`${field}-${index}`)));
  const approveSection = async (record, sectionId, index) => {
    const id = safeId(record); if (!id) return; setSaving(true); setSaveError(null);
    try {
      const keys = SECTION_FIELDS[sectionId].map(field => `${field}-${index}`).filter(key => pendingEdits[key] && localEdits[key] !== undefined);
      for (const key of keys) { const field = key.slice(0, -`-${index}`.length); await secureApiClient.put(`/api/edit/urology_consultations/${id}/edit`, { field, value: localEdits[key] }); }
      await secureApiClient.put(`/api/edit/urology_consultations/${id}/approve`, { sectionId, approved: true });
      setPendingEdits(previous => { const copy = { ...previous }; keys.forEach(key => delete copy[key]); return copy; });
      setEditedFields(previous => { const copy = { ...previous }; SECTION_FIELDS[sectionId].forEach(field => Object.keys(copy).filter(key => key.startsWith(`${field}-${index}`)).forEach(key => delete copy[key])); return copy; });
      const store = readDrafts(); if (store[id]) { SECTION_FIELDS[sectionId].forEach(field => delete store[id][field]); if (!Object.keys(store[id]).length) delete store[id]; writeDrafts(store); }
      setApprovedSections(previous => ({ ...previous, [`${sectionId}-${index}`]: true }));
    } catch { setSaveError('Approve failed. Please try again.'); } finally { setSaving(false); }
  };

  const pdfData = useMemo(() => records.map((record, index) => { const merged = { ...record }; Object.entries(localEdits).forEach(([key, value]) => { if (pendingEdits[key]) return; const match = key.match(/^(.+)-(\d+)$/); if (match && Number(match[2]) === index) merged[match[1]] = value; }); return merged; }), [records, localEdits, pendingEdits]);
  const filteredRecords = useMemo(() => { const phrase = searchTerm.trim().toLowerCase(); if (!phrase) return records.map((record, index) => ({ record, index })); return records.map((record, index) => ({ record, index })).filter(({ record, index }) => `urology consultation ${index + 1} ${Object.entries(FIELD_LABELS).map(([field, label]) => `${label} ${formatField(field, getValue(record, field, index))}`).join(' ')}`.toLowerCase().includes(phrase)); }, [records, searchTerm, getValue]);
  const highlight = text => { if (!searchTerm.trim()) return text; const expression = new RegExp(`(${searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); return String(text).split(expression).map((part, index) => expression.test(part) ? <mark key={index}>{part}</mark> : part); };
  const copyText = async (text, key, setter) => { try { await navigator.clipboard.writeText(text); } catch { const area = window.document.createElement('textarea'); area.value = text; (containerRef.current || window.document.body).appendChild(area); area.select(); window.document.execCommand('copy'); area.remove(); } setter(previous => typeof previous === 'object' ? ({ ...previous, [key]: true }) : key); setTimeout(() => setter(previous => typeof previous === 'object' ? ({ ...previous, [key]: false }) : null), 1800); };

  const sectionCopy = useCallback((record, index, sectionId) => {
    let text = `${SECTION_TITLES[sectionId]}\n${'='.repeat(40)}\n\n`;
    SECTION_FIELDS[sectionId].forEach(field => {
      const value = getValue(record, field, index); if (!hasField(field, value)) return; const label = FIELD_LABELS[field]; const sameTitle = label.toLowerCase() === SECTION_TITLES[sectionId].toLowerCase();
      if (NUMBER_FIELDS.has(field) || BOOLEAN_FIELDS.has(field)) { if (!sameTitle) text += `${label}\n`; text += `${'-'.repeat(40)}\n1. ${formatField(field, value)}\n\n`; return; }
      if (!sameTitle) text += `${label}\n`; let activeLabel = null; let number = 0;
      stringRows(field, value).forEach(row => { if (row.label !== activeLabel) { activeLabel = row.label; number = 0; if (activeLabel) text += `${activeLabel}\n`; text += `${'-'.repeat(40)}\n`; } text += `${++number}. ${row.value}\n`; }); text += '\n';
    }); return text;
  }, [getValue]);
  const copyAll = async () => { let text = '=== UROLOGY CONSULTATIONS ===\n\n'; pdfData.forEach((record, index) => { text += `Urology Consultation ${index + 1}\n${'='.repeat(40)}\n\n`; SECTION_ORDER.forEach(sectionId => { text += sectionCopy(record, index, sectionId); }); }); await copyText(text, 'all', value => setShowCopied(Boolean(value))); };

  const renderScalar = (record, field, index, sectionId) => {
    const value = getValue(record, field, index); if (!hasField(field, value)) return null; const key = `${field}-${index}`; const editing = editingField === key; const modified = editedFields[key]; const label = FIELD_LABELS[field]; const sameTitle = label.toLowerCase() === SECTION_TITLES[sectionId].toLowerCase(); const isNumber = NUMBER_FIELDS.has(field); const display = formatField(field, value);
    const save = () => { const next = isNumber ? Number(editValue) : editValue === 'Yes'; if (isNumber && !Number.isFinite(next)) { setSaveError('Please enter a valid number'); return; } stageField(record, field, index, sectionId, next, key); };
    return <div key={field} className="rec-mini-card nested-mini-card">{!sameTitle && <div className="nested-subtitle">{highlight(label)}</div>}<div data-edit-field={field}><div className={`numbered-row ${modified ? 'modified' : ''} editable-row`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(BOOLEAN_FIELDS.has(field) ? (value ? 'Yes' : 'No') : String(value)); setSaveError(null); } }}>{editing ? <div className="edit-field-container">{BOOLEAN_FIELDS.has(field) ? <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} /> : <div className="number-edit-row"><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) - 1)); }}>−</button><input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onChange={event => setEditValue(event.target.value)} /><button type="button" className="num-step" onClick={event => { event.stopPropagation(); setEditValue(String((Number(editValue) || 0) + 1)); }}>+</button>{UNIT_MAP[field] && <span className="number-edit-unit">{UNIT_MAP[field]}</span>}</div>}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); save(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(`${label}\n${display}`, key, setCopiedItems); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div></div>;
  };

  const renderString = (record, field, index, sectionId) => {
    const value = getValue(record, field, index); if (!hasField(field, value)) return null; const label = FIELD_LABELS[field]; const sameTitle = label.toLowerCase() === SECTION_TITLES[sectionId].toLowerCase(); const rows = stringRows(field, value); const groups = [];
    rows.forEach(row => { const last = groups[groups.length - 1]; if (last && last.label === row.label) last.rows.push(row); else groups.push({ label: row.label, rows: [row] }); });
    const saveRow = (row, key) => { const clauses = splitEditableClauses(String(getValue(record, field, index))); const clause = clauses[row.clauseIndex]; if (!clause) return; const parsed = parseLabel(clause.text); const items = COMMA_ARRAY_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value]; items[row.itemIndex] = editValue.trim(); clause.text = parsed.label ? `${parsed.label}: ${items.join(', ')}` : items.join(', '); stageField(record, field, index, sectionId, reconstructClauses(clauses), key); };
    return <div key={field} className="rec-mini-card">{!sameTitle && <div className="nested-subtitle">{highlight(label)}</div>}{groups.map((group, groupIndex) => <div key={`${group.label}-${groupIndex}`} className="nested-mini-card">{group.label && <div className="nested-subtitle sub-label">{highlight(group.label)}</div>}{group.rows.map(row => { const key = `${field}-${index}-c${row.clauseIndex}-i${row.itemIndex}`; const editing = editingField === key; const modified = editedFields[key]; return <div key={key} data-edit-field={field}><div className={`numbered-row ${modified ? 'modified' : ''} editable-row`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(row.value); setSaveError(null); } }}>{editing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={event => { event.stopPropagation(); saveRow(row, key); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(row.value)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(`${group.label ? `${group.label}\n` : ''}${row.value}`, key, setCopiedItems); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{modified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>; })}</div>)}</div>;
  };

  const renderSection = (record, index, sectionId) => {
    if (!SECTION_FIELDS[sectionId].some(field => hasField(field, getValue(record, field, index)))) return null; const copyKey = `${sectionId}-${index}`; const hasEdits = sectionHasEdits(sectionId, index); const approved = approvedSections[copyKey];
    return <div key={sectionId} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlight(SECTION_TITLES[sectionId])}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyKey ? 'copied' : ''}`} onClick={() => copyText(sectionCopy(record, index, sectionId), copyKey, setCopiedSection)}>{copiedSection === copyKey ? 'Copied!' : 'Copy Section'}</button>{hasEdits ? <button className="approve-btn pending" onClick={() => approveSection(record, sectionId, index)}>Pending Approve</button> : approved ? <span className="approve-btn approved">Approved</span> : null}</div></div>{SECTION_FIELDS[sectionId].map(field => NUMBER_FIELDS.has(field) || BOOLEAN_FIELDS.has(field) ? renderScalar(record, field, index, sectionId) : renderString(record, field, index, sectionId))}</div></div>;
  };

  if (!records.length) return <div className="urology-consultations-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Urology Consultations</h2></div><div className="empty-state">No urology consultation data available</div></div>;
  return <div className="urology-consultations-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Urology Consultations</h2><div className="header-actions"><button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<UrologyConsultationsDocumentPDFTemplate document={pdfData} />} fileName="Urology_Consultations.pdf" className="copy-btn">{({ loading }) => loading ? 'Generating...' : 'Export PDF'}</PDFDownloadLink></div></div><div className="search-container"><input type="text" className="search-input" placeholder="Search urology consultations..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div><div className="records-container">{filteredRecords.map(({ record, index }) => <div key={index} className="record-card"><div className="record-header"><h3 className="record-name">{highlight(`Urology Consultation ${index + 1}`)}</h3></div>{SECTION_ORDER.map(sectionId => renderSection(record, index, sectionId))}</div>)}</div></div>;
};

export default UrologyConsultationsDocument;
