import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TreatmentCoursesDocumentPDFTemplate from '../pdf-templates/TreatmentCoursesDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './TreatmentCoursesDocument.css';

const DRAFT_KEY = 'treatment_coursesPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = store => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* localStorage unavailable */ } };

const SECTION_TITLES = {
  details: 'Course Details',
  indication: 'Clinical Indication',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
  followup: 'Follow Up',
};

const FIELD_LABELS = {
  date: 'Date', reportDate: 'Report Date', type: 'Type', reportType: 'Report Type', urgency: 'Urgency',
  provider: 'Provider', facility: 'Facility', status: 'Status', clinicalIndication: 'Clinical Indication',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations',
  results: 'Results', notes: 'Notes', followUp: 'Follow Up',
};

const SECTION_FIELDS = {
  details: ['date', 'reportDate', 'type', 'reportType', 'urgency', 'provider', 'facility', 'status'],
  indication: ['clinicalIndication'], findings: ['findings'], assessment: ['assessment'], plan: ['plan'],
  recommendations: ['recommendations'], results: ['results'], notes: ['notes'], followup: ['followUp'],
};
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const DATE_FIELDS = new Set(['date', 'reportDate']);

const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const safeId = record => !record?._id ? null : typeof record._id === 'string' ? record._id : record._id.$oid || String(record._id);
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return String(value || ''); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return String(value || ''); } };
const toInputDate = value => { try { const date = new Date(value?.$date || value); return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); } catch { return ''; } };

const shouldSplitComma = (before, after) => {
  const left = before.trim(); const right = after.trimStart();
  if (/\d$/.test(left) && /^\d{3}\b/.test(right)) return false;
  if (/^(?:MD|DO|RN|BSN|NP|PA|PhD|PharmD|FACC|FACP|FACS|MPH|MSN)\b/i.test(right)) return false;
  if (/^[A-Z]{2}(?:\b|$)/.test(right) && /[A-Za-z ]+$/.test(left)) return false;
  if (/^(?:and|or)\b/i.test(right)) return false;
  return true;
};

const splitNotes = text => {
  const source = String(text || ''); if (!source.trim()) return [];
  const clauses = []; let current = ''; let depth = 0;
  const push = delimiter => { const value = current.trim(); if (value) clauses.push({ text: value, delimiter }); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(' || char === '[' || char === '{') { depth += 1; current += char; continue; }
    if (char === ')' || char === ']' || char === '}') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (depth === 0 && char === ';') { push('; '); while (/\s/.test(source[index + 1] || '')) index += 1; continue; }
    if (depth === 0 && char === ',') {
      const rest = source.slice(index + 1);
      if (shouldSplitComma(current, rest)) { push(', '); while (/\s/.test(source[index + 1] || '')) index += 1; continue; }
    }
    if (depth === 0 && char === '.') {
      const previous = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
      const decimal = /\d$/.test(current) && /^\d/.test(source[index + 1] || '');
      const abbreviation = ['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previous);
      if (!decimal && !abbreviation && (/\s/.test(source[index + 1] || '') || index === source.length - 1)) {
        const delimiter = index === source.length - 1 ? '.' : '. ';
        push(delimiter); while (/\s/.test(source[index + 1] || '')) index += 1; continue;
      }
    }
    current += char;
  }
  push('');
  return clauses;
};
const reconstructNotes = clauses => clauses.map(clause => `${clause.text}${clause.delimiter || ''}`).join('').trim();

const TreatmentCoursesDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editedLeaves, setEditedLeaves] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [approvedSections, setApprovedSections] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData; if (!source) return [];
    const initial = Array.isArray(source) ? source : [source];
    return initial.flatMap(record => {
      if (record?.treatment_courses) return Array.isArray(record.treatment_courses) ? record.treatment_courses : [record.treatment_courses];
      if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.treatment_courses) return Array.isArray(inner.treatment_courses) ? inner.treatment_courses : [inner.treatment_courses]; return [inner]; }
      return [record];
    }).filter(record => record && typeof record === 'object').map((record, index) => ({ ...record, _originalIdx: index }));
  }, [docProp, data, templateData]);

  useEffect(() => {
    const store = readDrafts(); const nextLocal = {}; const nextPending = {}; const nextLeaves = {};
    records.forEach((record, index) => {
      const id = safeId(record); const drafts = id ? store[id] : null; if (!drafts) return;
      Object.entries(drafts).forEach(([fieldPart, value]) => {
        const key = `${fieldPart}-${index}`; nextLocal[key] = value; nextPending[key] = true; nextLeaves[key] = 'edited';
        if (fieldPart === 'notes') splitNotes(value).forEach((_, clauseIndex) => { nextLeaves[`notes-${index}-clause${clauseIndex}`] = 'edited'; });
      });
    });
    if (Object.keys(nextLocal).length) { setLocalEdits(prev => ({ ...nextLocal, ...prev })); setPendingEdits(prev => ({ ...nextPending, ...prev })); setEditedLeaves(prev => ({ ...nextLeaves, ...prev })); }
  }, [records]);

  const getFieldValue = useCallback((record, field, index) => {
    const direct = `${field}-${index}`; if (localEdits[direct] !== undefined) return localEdits[direct];
    const original = record[field]; if (!Array.isArray(original)) return original;
    const merged = [...original]; Object.entries(localEdits).forEach(([key, value]) => { const match = key.match(new RegExp(`^${field}\\.(\\d+)-${index}$`)); if (match) merged[Number(match[1])] = value; }); return merged;
  }, [localEdits]);

  const pdfData = useMemo(() => records.map((record, index) => {
    const merged = { ...record };
    Object.entries(localEdits).forEach(([key, value]) => {
      if (pendingEdits[key]) return; const match = key.match(/^(.+)-(\d+)$/); if (!match || Number(match[2]) !== index) return;
      const fieldPart = match[1]; const arrayMatch = fieldPart.match(/^(.+)\.(\d+)$/);
      if (arrayMatch) { const values = Array.isArray(merged[arrayMatch[1]]) ? [...merged[arrayMatch[1]]] : []; values[Number(arrayMatch[2])] = value; merged[arrayMatch[1]] = values; }
      else merged[fieldPart] = value;
    });
    return merged;
  }), [records, localEdits, pendingEdits]);

  const stageDraft = useCallback((record, fieldPart, index, sectionId, value, leafKey = `${fieldPart}-${index}`) => {
    const id = safeId(record); if (!id) return; const key = `${fieldPart}-${index}`;
    setLocalEdits(prev => ({ ...prev, [key]: value })); setPendingEdits(prev => ({ ...prev, [key]: true })); setEditedLeaves(prev => ({ ...prev, [leafKey]: 'edited' }));
    setApprovedSections(prev => { const next = { ...prev }; delete next[`${sectionId}-${index}`]; return next; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fieldPart] = value; writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);

  const sectionHasPending = useCallback((index, sectionId) => {
    const fields = SECTION_FIELDS[sectionId]; const suffix = `-${index}`;
    return Object.keys(pendingEdits).some(key => { if (!pendingEdits[key] || !key.endsWith(suffix)) return false; const part = key.slice(0, -suffix.length); const base = part.replace(/\.\d+$/, ''); return fields.includes(base); });
  }, [pendingEdits]);

  const approveSection = useCallback(async (record, index, sectionId) => {
    const id = safeId(record); if (!id) return; const fields = SECTION_FIELDS[sectionId]; const suffix = `-${index}`;
    const keys = Object.keys(localEdits).filter(key => { if (!pendingEdits[key] || !key.endsWith(suffix)) return false; return fields.includes(key.slice(0, -suffix.length).replace(/\.\d+$/, '')); });
    setSaving(true); setSaveError(null);
    try {
      for (const key of keys) { const field = key.slice(0, -suffix.length); const response = await secureApiClient.put(`/api/edit/treatment_courses/${id}/edit`, { field, value: localEdits[key] }); if (!response || response.success === false) throw new Error(response?.error || 'save failed'); }
      const response = await secureApiClient.put(`/api/edit/treatment_courses/${id}/approve`, { sectionId, approved: true }); if (!response || response.success === false) throw new Error(response?.error || 'approve failed');
      setPendingEdits(prev => { const next = { ...prev }; keys.forEach(key => delete next[key]); return next; });
      const store = readDrafts(); if (store[id]) { keys.forEach(key => delete store[id][key.slice(0, -suffix.length)]); if (!Object.keys(store[id]).length) delete store[id]; writeDrafts(store); }
      setEditedLeaves(prev => { const next = { ...prev }; Object.keys(next).forEach(key => { if (key.includes(`-${index}`) && fields.some(field => key.startsWith(field))) delete next[key]; }); return next; });
      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${index}`]: true }));
    } catch (error) { console.error('[TreatmentCourses] Approve error:', error); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const copyText = useCallback(async (text, key) => { try { await navigator.clipboard.writeText(text); } catch { const area = window.document.createElement('textarea'); area.value = text; area.style.position = 'absolute'; area.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(area); area.select(); window.document.execCommand('copy'); area.remove(); } setCopiedItems(prev => ({ ...prev, [key]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [key]: false })), 1800); }, []);
  const highlight = useCallback(text => { if (!searchTerm.trim()) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); return String(text).split(regex).map((part, index) => regex.test(part) ? <mark key={index}>{part}</mark> : part); }, [searchTerm]);

  const visibleValue = useCallback((record, field, index) => { const value = getFieldValue(record, field, index); if (DATE_FIELDS.has(field)) return formatDate(value); return String(value ?? ''); }, [getFieldValue]);
  const filteredRecords = useMemo(() => { const phrase = searchTerm.trim().toLowerCase(); if (!phrase) return records; return records.filter((record, index) => `treatment courses treatment course ${index + 1} ${Object.values(FIELD_LABELS).join(' ')} ${Object.keys(FIELD_LABELS).map(field => Array.isArray(getFieldValue(record, field, index)) ? getFieldValue(record, field, index).join(' ') : visibleValue(record, field, index)).join(' ')}`.toLowerCase().includes(phrase)); }, [records, searchTerm, getFieldValue, visibleValue]);
  const fieldMatches = useCallback((record, field, index, sectionId) => { const phrase = searchTerm.trim().toLowerCase(); if (!phrase) return true; return SECTION_TITLES[sectionId].toLowerCase().includes(phrase) || FIELD_LABELS[field].toLowerCase().includes(phrase) || (Array.isArray(getFieldValue(record, field, index)) ? getFieldValue(record, field, index).join(' ') : visibleValue(record, field, index)).toLowerCase().includes(phrase); }, [searchTerm, getFieldValue, visibleValue]);

  const buildSectionCopy = useCallback((record, index, sectionId) => {
    const lines = [SECTION_TITLES[sectionId], '='.repeat(40), ''];
    let hasContent = false;
    SECTION_FIELDS[sectionId].forEach(field => {
      const value = getFieldValue(record, field, index); if (!hasVal(value)) return; hasContent = true; const label = FIELD_LABELS[field]; const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
      let rows; if (field === 'notes') rows = splitNotes(value).map(clause => clause.text); else if (Array.isArray(value)) rows = value.filter(hasVal).map(String); else rows = [DATE_FIELDS.has(field) ? formatDate(value) : String(value)];
      if (showLabel) lines.push(label, '-'.repeat(40)); rows.forEach((row, rowIndex) => lines.push(`${rowIndex + 1}. ${row}`)); lines.push('');
    });
    return hasContent ? `${lines.join('\n')}\n` : '';
  }, [getFieldValue]);

  const copyAll = useCallback(async () => { let text = '=== TREATMENT COURSES ===\n\n'; records.forEach((record, index) => { text += `Treatment Course ${index + 1}\n${'='.repeat(40)}\n\n`; SECTION_ORDER.forEach(sectionId => { text += buildSectionCopy(record, index, sectionId); }); text += '\n'; }); try { await navigator.clipboard.writeText(text); } catch { return; } setShowCopied(true); setTimeout(() => setShowCopied(false), 1800); }, [records, buildSectionCopy]);

  const renderScalar = (record, field, index, sectionId) => {
    const value = getFieldValue(record, field, index); if (!hasVal(value) || !fieldMatches(record, field, index, sectionId)) return null;
    const key = `${field}-${index}`; const isEditing = editingField === key; const label = FIELD_LABELS[field]; const display = DATE_FIELDS.has(field) ? formatDate(value) : String(value); const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase(); const badge = editedLeaves[key];
    return <div key={field} className="rec-mini-card nested-mini-card">{showLabel && <div className="nested-subtitle">{highlight(label)}</div>}<div data-edit-field={field}><div className={`numbered-row editable-row ${badge ? 'modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(key); setEditValue(DATE_FIELDS.has(field) ? toInputDate(value) : String(value)); setSaveError(null); } }}>{isEditing ? <div className="edit-field-container">{DATE_FIELDS.has(field) ? <BlueDatePicker value={editValue} onSelect={setEditValue} /> : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); if (DATE_FIELDS.has(field)) { if (!editValue || isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } stageDraft(record, field, index, sectionId, `${editValue}T00:00:00.000Z`); } else stageDraft(record, field, index, sectionId, editValue); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(`${label}\n${display}`, key); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{badge && <span className="modified-badge">edited - click Pending Approve to save</span>}</div></div>;
  };

  const renderRecommendations = (record, index, sectionId) => {
    const value = getFieldValue(record, 'recommendations', index); if (!hasVal(value) || !fieldMatches(record, 'recommendations', index, sectionId)) return null;
    const indexed = Array.isArray(value) ? value.map((item, itemIndex) => [itemIndex, item]).filter(([, item]) => hasVal(item)) : [[null, value]];
    return <div key="recommendations" className={`rec-mini-card nested-mini-card${Array.isArray(value) ? ' recommendation-group' : ''}`}>{indexed.map(([itemIndex, item]) => { const fieldPart = itemIndex === null ? 'recommendations' : `recommendations.${itemIndex}`; const key = `${fieldPart}-${index}`; const editing = editingField === key; const badge = editedLeaves[key]; return <div key={fieldPart} data-edit-field={fieldPart}><div className={`numbered-row editable-row ${badge ? 'modified' : ''}`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(String(item)); } }}>{editing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); stageDraft(record, fieldPart, index, sectionId, editValue); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(String(item))}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(String(item), key); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{badge && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>; })}</div>;
  };

  const renderNotes = (record, index, sectionId) => {
    const value = getFieldValue(record, 'notes', index); if (!hasVal(value) || !fieldMatches(record, 'notes', index, sectionId)) return null; const clauses = splitNotes(value);
    return <div key="notes" className="rec-mini-card nested-mini-card">{clauses.map((clause, clauseIndex) => { const key = `notes-${index}-clause${clauseIndex}`; const editing = editingField === key; const badge = editedLeaves[key]; return <div key={clauseIndex} data-edit-field="notes"><div className={`numbered-row editable-row ${badge ? 'modified' : ''}`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(clause.text); } }}>{editing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); const replacement = splitNotes(editValue); const items = replacement.length ? replacement : [{ text: editValue.trim(), delimiter: '' }]; if (items.length && !items[items.length - 1].delimiter) items[items.length - 1].delimiter = clause.delimiter; const updated = [...clauses]; updated.splice(clauseIndex, 1, ...items); stageDraft(record, 'notes', index, sectionId, reconstructNotes(updated), key); }}>Save</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); }}>Cancel</button></div></div> : <><div className="row-content"><span className="content-value">{highlight(clause.text)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(clause.text, key); }}>{copiedItems[key] ? 'Copied!' : 'Copy'}</button></>}</div>{badge && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>; })}</div>;
  };

  const renderSection = (record, index, sectionId) => {
    const fields = SECTION_FIELDS[sectionId]; const hasAny = fields.some(field => hasVal(getFieldValue(record, field, index))); if (!hasAny) return null;
    const phrase = searchTerm.trim().toLowerCase(); if (phrase && !SECTION_TITLES[sectionId].toLowerCase().includes(phrase) && !fields.some(field => fieldMatches(record, field, index, sectionId))) return null;
    const copyKey = `${sectionId}-${index}`; const pending = sectionHasPending(index, sectionId); const approved = approvedSections[copyKey];
    return <div key={sectionId} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlight(SECTION_TITLES[sectionId])}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyKey ? 'copied' : ''}`} onClick={async () => { await copyText(buildSectionCopy(record, index, sectionId), copyKey); setCopiedSection(copyKey); setTimeout(() => setCopiedSection(null), 1800); }}>{copiedSection === copyKey ? 'Copied!' : 'Copy Section'}</button>{pending ? <button className="approve-btn pending" disabled={saving} onClick={() => approveSection(record, index, sectionId)}>{saving ? 'Approving...' : 'Pending Approve'}</button> : approved ? <span className="approve-btn approved">Approved</span> : null}</div></div>{fields.map(field => field === 'notes' ? renderNotes(record, index, sectionId) : field === 'recommendations' ? renderRecommendations(record, index, sectionId) : renderScalar(record, field, index, sectionId))}</div></div>;
  };

  if (!records.length) return <div className="treatment-courses-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Treatment Courses</h2></div><div className="empty-state">No treatment course records available</div></div>;
  return <div className="treatment-courses-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Treatment Courses</h2><div className="header-actions"><button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink document={<TreatmentCoursesDocumentPDFTemplate document={pdfData} />} fileName="Treatment_Courses.pdf" className="copy-btn">{({ loading }) => loading ? 'Generating...' : 'Export PDF'}</PDFDownloadLink></div></div><div className="search-container"><input className="search-input" type="text" placeholder="Search treatment courses..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div><div className="records-container">{filteredRecords.map(record => { const index = record._originalIdx; return <div key={safeId(record) || index} className="record-card"><div className="record-header"><h3 className="record-name">{highlight(`Treatment Course ${index + 1}`)}</h3></div>{SECTION_ORDER.map(sectionId => renderSection(record, index, sectionId))}</div>; })}</div></div>;
};

export default TreatmentCoursesDocument;
