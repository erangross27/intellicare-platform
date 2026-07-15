/**
 * StressManagementReferralsDocument.jsx
 * July 2026 — complete inline-editing template
 * Collection: stress_management_referrals
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StressManagementReferralsDocumentPDFTemplate from '../pdf-templates/StressManagementReferralsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import secureApiClient from '../../../services/secureApiClient';
import './StressManagementReferralsDocument.css';

const DRAFT_KEY = 'stress_management_referralsPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = (store) => { try { if (store && Object.keys(store).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); else localStorage.removeItem(DRAFT_KEY); } catch { /* unavailable */ } };

const SECTION_CONFIGS = [
  { id: 'referral-info', title: 'Referral Information', fields: ['date', 'status', 'urgency', 'specialty', 'referringProvider'] },
  { id: 'reason', title: 'Reason for Referral', fields: ['reason'] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];
const FIELD_LABELS = {
  date: 'Date', status: 'Status', urgency: 'Urgency', specialty: 'Specialty',
  referringProvider: 'Referring Provider', reason: 'Reason for Referral', notes: 'Notes',
};
const DATE_FIELDS = ['date'];
const ENUM_FIELDS = {
  status: ['Pending', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'Declined'],
  urgency: ['Routine', 'Urgent', 'Emergent'],
};
const NARRATIVE_FIELDS = ['reason', 'notes'];
const COMMA_ARRAY_FIELDS = ['reason'];
const MULTIROW_LABELS = ['Additional referrals'];

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).flatMap(item => item.split(/(?<=\d)\.\s+(?=[A-Z])/)).map(item => item.replace(/[;.]+$/, '').trim()).filter(Boolean);
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (const ch of text) {
    if (ch === '(') { depth += 1; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '').trim() };
};
const rowsForField = (field, value) => {
  const sentences = splitBySentence(String(value || ''));
  if (COMMA_ARRAY_FIELDS.includes(field)) return sentences.flatMap(sentence => splitByComma(sentence));
  return sentences;
};
const narrativeGroups = (rows) => {
  const groups = []; let unlabeled = null; let activeMulti = null;
  rows.forEach((raw, rowIndex) => {
    const parsed = parseLabel(raw);
    const row = { ...parsed, raw, rowIndex };
    if (parsed.isLabeled) {
      unlabeled = null;
      const group = { label: parsed.label, rows: [row] };
      groups.push(group);
      activeMulti = MULTIROW_LABELS.some(label => label.toLowerCase() === parsed.label.toLowerCase()) ? group : null;
    } else if (activeMulti) {
      activeMulti.rows.push(row);
    } else {
      if (!unlabeled) { unlabeled = { label: '', rows: [] }; groups.push(unlabeled); }
      unlabeled.rows.push(row);
    }
  });
  return groups;
};
const formatDate = (value) => {
  if (!value) return '';
  try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); }
};
const toInputDate = (value) => { try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return ''; } };
const enumOptionsWith = (field, current) => {
  const base = ENUM_FIELDS[field] || []; const cur = String(current || '').trim();
  if (!cur || base.some(o => o.toLowerCase() === cur.toLowerCase())) return base;
  return [...base, cur];
};

const StressManagementReferralsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const containerRef = useRef(null);

  const records = useMemo(() => {
    const raw = templateData || docProp || data;
    if (!raw) return [];
    let items = Array.isArray(raw) ? raw : [raw];
    items = items.flatMap(item => {
      if (item?.stress_management_referrals) return Array.isArray(item.stress_management_referrals) ? item.stress_management_referrals : [item.stress_management_referrals];
      if (item?.documentData) { const nested = item.documentData; if (Array.isArray(nested)) return nested; if (nested?.stress_management_referrals) return Array.isArray(nested.stress_management_referrals) ? nested.stress_management_referrals : [nested.stress_management_referrals]; return [nested]; }
      if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
      if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
      return [item];
    });
    return items.filter(item => item && typeof item === 'object');
  }, [templateData, docProp, data]);

  const safeId = useCallback(record => { if (!record?._id) return null; return record._id.$oid || String(record._id); }, []);
  const getValue = useCallback((record, field, index) => localEdits[`${field}-${index}`] !== undefined ? localEdits[`${field}-${index}`] : record[field], [localEdits]);
  const hasVal = useCallback(value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''), []);

  useEffect(() => {
    const store = readDrafts(); const edits = {}; const pending = {};
    records.forEach((record, index) => { const id = safeId(record); if (!id || !store[id]) return; Object.entries(store[id]).forEach(([field, value]) => { edits[`${field}-${index}`] = value; pending[`${field}-${index}`] = true; }); });
    if (Object.keys(edits).length) { setLocalEdits(previous => ({ ...edits, ...previous })); setPendingEdits(previous => ({ ...pending, ...previous })); }
  }, [records, safeId]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const query = searchTerm.toLowerCase().trim();
    return records.filter((record, index) => Object.values(FIELD_LABELS).some(label => label.toLowerCase().includes(query)) || Object.keys(FIELD_LABELS).some(field => String(getValue(record, field, index) || '').toLowerCase().includes(query)));
  }, [records, searchTerm, getValue]);

  const pdfData = useMemo(() => filteredRecords.map((record, index) => {
    const merged = { ...record };
    Object.keys(FIELD_LABELS).forEach(field => { const key = `${field}-${index}`; if (localEdits[key] !== undefined && !pendingEdits[key]) merged[field] = localEdits[key]; });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  const copyText = useCallback(async (text, id) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const area = window.document.createElement('textarea'); area.value = text; area.style.position = 'absolute'; area.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(area); area.select(); window.document.execCommand('copy'); area.remove(); }
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1600);
  }, []);

  const stageField = useCallback((record, field, index, sectionId, value) => {
    const id = safeId(record); if (!id) return;
    const key = `${field}-${index}`;
    setLocalEdits(previous => ({ ...previous, [key]: value }));
    setPendingEdits(previous => ({ ...previous, [key]: true }));
    setApprovedSections(previous => { const next = { ...previous }; delete next[`${sectionId}-${index}`]; return next; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][field] = value; writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError('');
  }, [safeId]);

  const saveNarrativeRow = useCallback((record, field, index, sectionId, rowIndex, label) => {
    const rows = rowsForField(field, getValue(record, field, index));
    rows[rowIndex] = label ? `${label}: ${editValue.trim()}` : editValue.trim();
    stageField(record, field, index, sectionId, `${rows.filter(Boolean).join('. ')}.`);
  }, [editValue, getValue, stageField]);

  const approveSection = useCallback(async (record, index, section) => {
    const id = safeId(record); if (!id) return;
    const keys = section.fields.map(field => `${field}-${index}`).filter(key => pendingEdits[key]);
    setSaving(true);
    try {
      for (const key of keys) {
        const field = key.slice(0, key.lastIndexOf('-'));
        await secureApiClient.put(`/api/edit/stress_management_referrals/${id}/edit`, { field, value: localEdits[key] });
      }
      await secureApiClient.put(`/api/edit/stress_management_referrals/${id}/approve`, { sectionId: section.id, approved: true });
      setPendingEdits(previous => { const next = { ...previous }; keys.forEach(key => delete next[key]); return next; });
      const store = readDrafts(); if (store[id]) { section.fields.forEach(field => delete store[id][field]); if (!Object.keys(store[id]).length) delete store[id]; writeDrafts(store); }
      setApprovedSections(previous => ({ ...previous, [`${section.id}-${index}`]: true }));
    } catch (error) { setSaveError(error.message || 'Unable to approve'); }
    finally { setSaving(false); }
  }, [localEdits, pendingEdits, safeId]);

  const sectionHasEdits = useCallback((section, index) => section.fields.some(field => pendingEdits[`${field}-${index}`]), [pendingEdits]);
  const highlight = useCallback(text => {
    if (!searchTerm.trim()) return text;
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text).split(new RegExp(`(${escaped})`, 'gi')).map((part, index) => part.toLowerCase() === searchTerm.trim().toLowerCase() ? <mark key={index}>{part}</mark> : part);
  }, [searchTerm]);

  const renderEditActions = (onSave) => <><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={event => { event.stopPropagation(); onSave(); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={event => { event.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(''); }}>Cancel</button></div>{saveError && <div className="save-error">{saveError}</div>}</>;

  const renderScalar = (record, index, section, field) => {
    const value = getValue(record, field, index); if (!hasVal(value)) return null;
    const key = `${field}-${index}`; const editing = editingField === key; const label = FIELD_LABELS[field];
    const display = DATE_FIELDS.includes(field) ? formatDate(value) : String(value);
    const options = ENUM_FIELDS[field] ? enumOptionsWith(field, value) : null;
    return <div key={field} className="rec-mini-card nested-mini-card" data-edit-field={field}>
      <div className="nested-subtitle">{highlight(label)}</div>
      <div className={`numbered-row editable-row ${pendingEdits[key] ? 'modified' : ''}`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(DATE_FIELDS.includes(field) ? toInputDate(value) : options ? (options.find(option => option.toLowerCase() === String(value).toLowerCase()) || String(value)) : String(value)); } }}>
        {editing ? <div className="edit-field-container">
          {DATE_FIELDS.includes(field) ? <BlueDatePicker value={editValue} onSelect={setEditValue} /> : options ? <BlueSelect value={editValue} options={options} onChange={setEditValue} /> : <textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />}
          {renderEditActions(() => { if (DATE_FIELDS.includes(field) && Number.isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } stageField(record, field, index, section.id, DATE_FIELDS.includes(field) ? `${editValue}T00:00:00.000Z` : editValue.trim()); })}
        </div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedId === key ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(display, key); }}>{copiedId === key ? 'Copied!' : 'Copy'}</button></>}
      </div>
      {pendingEdits[key] && <span className="modified-badge">edited - click Pending Approve to save</span>}
    </div>;
  };

  const renderNarrative = (record, index, section, field) => {
    const value = getValue(record, field, index); if (!hasVal(value)) return null;
    const rows = rowsForField(field, value); const groups = narrativeGroups(rows); const fieldKey = `${field}-${index}`;
    return <React.Fragment key={field}>{groups.map((group, groupIndex) => <div key={groupIndex} className="rec-mini-card nested-mini-card">
      {group.label && <div className="nested-subtitle">{highlight(group.label)}</div>}
      {group.rows.map(row => {
        const key = `${field}-${index}-r${row.rowIndex}`; const editing = editingField === key; const display = row.isLabeled ? row.value : row.raw;
        return <div key={row.rowIndex} data-edit-field={field}>
          <div className={`numbered-row editable-row ${pendingEdits[fieldKey] ? 'modified' : ''}`} onClick={() => { if (!editing) { setEditingField(key); setEditValue(display); } }}>
            {editing ? <div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={event => setEditValue(event.target.value)} autoFocus />{renderEditActions(() => saveNarrativeRow(record, field, index, section.id, row.rowIndex, row.label))}</div> : <><div className="row-content"><span className="content-value">{highlight(display)}</span><span className="edit-indicator">&#9998;</span></div><button className={`copy-btn ${copiedId === key ? 'copied' : ''}`} onClick={event => { event.stopPropagation(); copyText(display, key); }}>{copiedId === key ? 'Copied!' : 'Copy'}</button></>}
          </div>
        </div>;
      })}
      {pendingEdits[fieldKey] && <span className="modified-badge">edited - click Pending Approve to save</span>}
    </div>)}</React.Fragment>;
  };

  const buildSectionCopy = useCallback((record, index, section) => {
    let text = `${section.title}\n${'='.repeat(40)}\n\n`;
    section.fields.forEach(field => {
      const value = getValue(record, field, index); if (!hasVal(value)) return;
      const rows = NARRATIVE_FIELDS.includes(field) ? rowsForField(field, value) : [DATE_FIELDS.includes(field) ? formatDate(value) : String(value)];
      text += `${FIELD_LABELS[field]}\n${'-'.repeat(40)}\n`;
      rows.forEach((raw, rowIndex) => { const parsed = parseLabel(raw); if (parsed.isLabeled) text += `${parsed.label}:\n`; text += `${rowIndex + 1}. ${parsed.isLabeled ? parsed.value : raw}\n`; });
      text += '\n';
    });
    return text;
  }, [getValue, hasVal]);

  const copyAll = useCallback(async () => {
    let text = '=== STRESS MANAGEMENT REFERRALS ===\n\n';
    pdfData.forEach((record, index) => { text += `Stress Management Referral ${index + 1}\n${'='.repeat(40)}\n\n`; SECTION_CONFIGS.forEach(section => { text += buildSectionCopy(record, index, section); }); });
    await copyText(text, 'all'); setShowCopied(true); setTimeout(() => setShowCopied(false), 1600);
  }, [pdfData, buildSectionCopy, copyText]);

  if (!records.length) return <div className="stress-management-referrals-document"><div className="document-header"><h2 className="document-title">Stress Management Referrals</h2></div><div className="empty-state">No stress management referral records available</div></div>;

  return <div className="stress-management-referrals-document" ref={containerRef}>
    <div className="document-header"><h2 className="document-title">Stress Management Referrals</h2><div className="header-actions"><button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAll}>{showCopied ? 'Copied!' : 'Copy All'}</button><PDFDownloadLink className="copy-btn" document={<StressManagementReferralsDocumentPDFTemplate document={pdfData} />} fileName="Stress_Management_Referrals.pdf">{({ loading }) => loading ? 'Generating...' : 'Export PDF'}</PDFDownloadLink></div></div>
    <div className="search-container"><input className="search-input" type="text" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search stress management referrals..." />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
    <div className="records-container">{filteredRecords.map((record, index) => <div key={safeId(record) || index} className="record-card"><div className="record-header"><h3 className="record-name">{highlight(`Stress Management Referral ${index + 1}`)}</h3></div>{SECTION_CONFIGS.map(section => {
      const present = section.fields.some(field => hasVal(getValue(record, field, index))); if (!present) return null; const copyId = `${section.id}-${index}`;
      return <div key={section.id} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlight(section.title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={() => copyText(buildSectionCopy(record, index, section), copyId)}>{copiedId === copyId ? 'Copied!' : 'Copy Section'}</button>{sectionHasEdits(section, index) ? <button className="approve-btn pending" onClick={() => approveSection(record, index, section)}>Pending Approve</button> : approvedSections[copyId] ? <span className="approve-btn approved">Approved</span> : null}</div></div>{section.fields.map(field => NARRATIVE_FIELDS.includes(field) ? renderNarrative(record, index, section, field) : renderScalar(record, index, section, field))}</div></div>;
    })}</div>)}</div>
  </div>;
};

export default StressManagementReferralsDocument;
