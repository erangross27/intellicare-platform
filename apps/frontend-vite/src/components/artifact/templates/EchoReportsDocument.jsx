import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EchoReportsDocumentPDFTemplate from '../pdf-templates/EchoReportsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import './EchoReportsDocument.css';

/**
 * EchoReportsDocument — canonical one-pass (July 2026).
 * Widgets: date→BlueDatePicker; ejectionFraction→number+unit stepper (edit the number, unit "%" stays);
 * chambers (leftVentricle/rightVentricle/leftAtrium/rightAtrium)→dynamic-object sub-label+value; valves→array
 * rows; wallMotion/diastolicFunction/pericardium/conclusion→sentence-split; cardiologist→text. Box-free B&W PDF
 * with underline rules. Draft→Approve arch (localStorage; drafts stay out of DB/PDF until Approve).
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT written to
   MongoDB and NOT shown in the PDF until Approve. Shape: { [recordId]: { [fieldPart]: value } }. */
const DRAFT_KEY = 'echoReportsPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    if (val.value !== undefined) return String(val.value);
    return JSON.stringify(val);
  }
  return String(val);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; }
};
const toInputDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; } };

// camelCase / lower key → "Title Case" sub-label
const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// Sentence split ([.;] with abbrev guard) for narrative fields.
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|No)\.)(?<!\b[A-Z])[.;]\s+/)
    .map((s) => s.replace(/[.;]\s*$/, '').trim())
    .filter(Boolean);
};

/* number+unit stepper — ejectionFraction "55%", "45% (mild dysfunction)". Leading number + DIGIT-FREE unit;
   ranges ("35-40%") and digit-annotated ("32% ... 6 months ago") → null → text fallback. */
const MEASURE_FIELDS = ['ejectionFraction'];
const splitNumberUnit = (v) => {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)(\s*)(\D.*)$/);
  if (!m) return null;
  if (/\d/.test(m[3])) return null;
  return { num: m[1], sep: m[2], unit: m[3].trim() };
};
const stepFor = (numStr) => (String(numStr).includes('.') ? 0.1 : 1);

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const pushCopyField = (lines, label, values) => {
  const vals = (Array.isArray(values) ? values : [values]).filter((v) => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return;
  lines.push('', label, COPY_LINE_DASH);
  vals.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
};
// Object → canonical copy lines (sub-label per key + DASH + numbered value); kills side-by-side "key: value".
const objectCopyLines = (lines, obj, editedGet) => {
  Object.entries(obj || {}).forEach(([k, v]) => {
    const val = editedGet ? (editedGet(k) ?? v) : v;
    const s = safeString(val);
    if (!s.trim()) return;
    lines.push('', humanizeKey(k), COPY_LINE_DASH, `1. ${s}`);
  });
};

const EchoReportsDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    setEditingField(`${fieldName}-${idx}-s${sentenceIdx}`);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);
  const handleCancelEdit = useCallback(() => { setEditingField(null); setEditValue(''); }, []);

  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    if (!record._id) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    setLocalEdits((p) => ({ ...p, [editKey]: saveValue }));
    setPendingEdits((p) => ({ ...p, [editKey]: true }));
    setEditedFields((p) => ({ ...p, [`${sectionId}-${idx}`]: true }));
    setEditedSentences((p) => ({ ...p, [sKey]: 'edited' }));
    setStatusOverrides((p) => ({ ...p, [idx]: 'amended' }));
    setApprovedSections((prev) => { const k = `${sectionId}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[record._id]) store[record._id] = {};
    store[record._id][fieldPart] = saveValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleApprove = useCallback(async (record, idx, sectionId) => {
    if (!record._id) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter((k) => pendingEdits[k] && k.endsWith(suffix));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = isArrayIdx
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(tail, 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        const resp = await secureApiClient.put(`/api/edit/echo_reports/${record._id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/echo_reports/${record._id}/approve`);
      setPendingEdits((p) => { const n = { ...p }; toCommit.forEach((k) => delete n[k]); return n; });
      const store = readDrafts();
      if (store[record._id]) { delete store[record._id]; writeDrafts(store); }
      setStatusOverrides((p) => ({ ...p, [idx]: 'approved' }));
      setApprovedSections((p) => ({ ...p, [`${sectionId}-${idx}`]: true }));
      setEditedFields((p) => { const u = {}; for (const k of Object.keys(p)) if (!k.endsWith(`-${idx}`)) u[k] = p[k]; return u; });
      setEditedSentences((p) => { const u = {}; for (const k of Object.keys(p)) if (!k.includes(`-${idx}-s`)) u[k] = p[k]; return u; });
    } catch (err) { console.error('[EchoReports] Approve error:', err); } finally { setApproving(false); }
  }, [localEdits, pendingEdits]);

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    if (fieldName.includes('.')) { const [p, s] = fieldName.split('.'); return record[p]?.[s]; }
    return record[fieldName];
  }, [localEdits]);

  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (templateData._records && Array.isArray(templateData._records)) return templateData._records;
    if (templateData.records && Array.isArray(templateData.records)) return templateData.records;
    if (templateData.echo_reports && Array.isArray(templateData.echo_reports)) return templateData.echo_reports;
    if (templateData.documentData) {
      const d = templateData.documentData;
      if (d.echo_reports && Array.isArray(d.echo_reports)) return d.echo_reports;
      if (Array.isArray(d)) return d;
      return [d];
    }
    if (Array.isArray(templateData)) return templateData;
    return [templateData];
  }, [templateData]);

  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((rec, idx) => {
      const rid = rec && rec._id && typeof rec._id === 'object' ? rec._id.$oid : rec && rec._id;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value; nPending[editKey] = true;
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const baseField = isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart;
        const sectionId = baseField.includes('.') ? baseField.split('.')[0] : baseField;
        nFields[`${sectionId}-${idx}`] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits((p) => ({ ...nLocal, ...p }));
    setPendingEdits((p) => ({ ...nPending, ...p }));
    setEditedFields((p) => ({ ...nFields, ...p }));
    setEditedSentences((p) => ({ ...nSentences, ...p }));
    setStatusOverrides((p) => ({ ...nStatus, ...p }));
  }, [unwrappedData]);

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue;
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx !== idx) continue;
        if (fieldName.includes('.')) {
          const [parent, subKey] = fieldName.split('.');
          const arrIdx = parseInt(subKey, 10);
          if (!isNaN(arrIdx) && Array.isArray(merged[parent])) { merged[parent] = [...merged[parent]]; merged[parent][arrIdx] = editVal; }
          else if (typeof merged[parent] === 'object' && merged[parent] !== null) { merged[parent] = { ...merged[parent], [subKey]: editVal }; }
        } else { merged[fieldName] = editVal; }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  const highlightText = useCallback((text) => {
    const s = safeString(text);
    if (!searchTerm.trim() || !s) return s;
    const words = searchTerm.toLowerCase().trim().split(/\s+/).map((w) => w.replace(/[()[\],.<>&:%]+/g, '')).filter(Boolean);
    if (words.length === 0) return s;
    const escaped = words.map((w) => w.replace(/[.*+?^${}|[\]\\]/g, '\\$&'));
    const parts = s.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
    if (parts.length === 1) return s;
    return <>{parts.map((p, i) => (words.some((w) => p.toLowerCase() === w) ? <mark key={i} className="search-highlight">{p}</mark> : p))}</>;
  }, [searchTerm]);

  const copyToClipboard = useCallback(async (text, id) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
    catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; window.document.body.appendChild(ta); ta.select(); window.document.execCommand('copy'); window.document.body.removeChild(ta); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
  }, []);

  const filteredRecords = useMemo(() => {
    const withMeta = unwrappedData.map((record, idx) => ({ ...record, _index: idx, _documentTitle: `Echo Report ${idx + 1}` }));
    if (!searchTerm.trim()) return withMeta;
    const words = searchTerm.toLowerCase().trim().split(/\s+/).map((w) => w.replace(/[()[\],.<>&:%]+/g, '')).filter(Boolean);
    if (words.length === 0) return withMeta;
    return withMeta.filter((record) => {
      const blob = [
        record._documentTitle, 'echo report echocardiogram', formatDate(record.date),
        safeString(record.ejectionFraction), safeString(record.cardiologist), safeString(record.wallMotion),
        safeString(record.diastolicFunction), safeString(record.pericardium), safeString(record.conclusion),
        ['leftVentricle', 'rightVentricle', 'leftAtrium', 'rightAtrium'].map((f) => record[f] && typeof record[f] === 'object' ? Object.entries(record[f]).map(([k, v]) => `${k} ${safeString(v)}`).join(' ') : '').join(' '),
        Array.isArray(record.valves) ? record.valves.map(safeString).join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase().replace(/[()[\],.<>&:%]/g, '');
      return words.every((w) => blob.includes(w) || blob.includes(w.replace(/-/g, ' ')));
    });
  }, [unwrappedData, searchTerm]);

  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  const sectionHasEdits = useCallback((sectionId, idx) => Object.keys(localEdits).some((k) => {
    if (!k.endsWith(`-${idx}`)) return false;
    const fieldPart = k.slice(0, -`-${idx}`.length);
    const base = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
    return base === sectionId;
  }), [localEdits]);

  // Section header with Copy Section + Pending-Approve button (below Copy Section)
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => {
    const sk = `${sectionId}-${idx}`;
    const show = sectionHasEdits(sectionId, idx) || approvedSections[sk];
    return (
      <div className="section-header">
        <h3 className="section-title">{highlightText(title)}</h3>
        <div className="header-right-actions">
          <button className={`copy-section-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={copyFn}>{copiedId === copyId ? 'Copied!' : 'Copy Section'}</button>
          {show && (
            <button className={`approve-btn${approvedSections[sk] ? ' approved' : ' pending'}`} onClick={() => handleApprove(filteredRecords.find((r) => r._index === idx) || unwrappedData[idx], idx, sectionId)} disabled={approving}>
              {approving ? 'Approving...' : approvedSections[sk] ? 'Approved' : 'Pending Approve'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Canonical editable display row (whole .numbered-row.editable-row is clickable; Copy stops propagation)
  const displayRow = (record, idx, editKey, canEdit, isEdited, onOpen, displayVal, copyId, copyText) => (
    <>
      <div className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited ? ' modified' : ''}`} onClick={() => canEdit && onOpen()} title={canEdit ? 'Click to edit' : undefined}>
        <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{canEdit && !isEdited && editIndicator}</div>
        <button className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(copyText, copyId); }}>{copiedId === copyId ? 'Copied!' : 'Copy'}</button>
      </div>
      {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
    </>
  );

  const renderDateField = (record, idx, sectionId, copyId) => {
    const val = getFieldValue(record, 'date', idx);
    if (!val) return null;
    const editKey = `date-${idx}-s0`;
    const canEdit = !!record._id;
    const isEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const display = formatDate(val);
    return (
      <div className="rec-mini-card" key="date">
        <div className="nested-subtitle">{highlightText('Date')}</div>
        {editingField === editKey ? (
          <div className="numbered-row edit-row"><div className="edit-field-container">
            <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso || '')} />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, 'date', idx, sectionId, undefined, editValue ? `${editValue}T00:00:00.000Z` : '')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div></div>
        ) : displayRow(record, idx, editKey, canEdit, isEdited, () => handleStartEdit('date', idx, toInputDate(val)), display, copyId, `Date\n${display}`)}
      </div>
    );
  };

  // number+unit stepper (edit the number, unit chip unchanged); text fallback for ranges/annotated values.
  const renderMeasureField = (record, idx, fieldName, label, sectionId, copyId) => {
    const val = safeString(getFieldValue(record, fieldName, idx));
    if (!val.trim()) return null;
    const nu = splitNumberUnit(val);
    const editKey = `${fieldName}-${idx}-s0`;
    const canEdit = !!record._id;
    const isEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    if (!nu) return renderTextField(record, idx, fieldName, label, sectionId, copyId); // range/annotated → text
    if (editingField === editKey) {
      const cur = editValue; const base = cur === '' ? nu.num : cur;
      const bump = (dir) => { let n = (parseFloat(base) || 0) + dir * stepFor(base); if (n < 0) n = 0; setEditValue(String(Math.round(n * 100) / 100)); };
      const commit = () => handleSaveField(record, fieldName, idx, sectionId, undefined, `${cur === '' ? nu.num : cur}${nu.sep}${nu.unit}`);
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row"><div className="edit-field-container">
            <div className="num-stepper-row">
              <button type="button" className="num-step" onClick={() => bump(-1)} disabled={saving}>−</button>
              <input type="text" inputMode="decimal" className="num-stepper-input" value={cur} onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter') commit(); }} disabled={saving} />
              <span className="num-stepper-unit">{nu.unit}</span>
              <button type="button" className="num-step" onClick={() => bump(1)} disabled={saving}>+</button>
            </div>
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={commit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div></div>
        </div>
      );
    }
    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {displayRow(record, idx, editKey, canEdit, isEdited, () => handleStartEdit(fieldName, idx, nu.num), val, copyId, `${label}\n${val}`)}
      </div>
    );
  };

  // plain text field (textarea)
  const renderTextField = (record, idx, fieldName, label, sectionId, copyId, showLabel = true) => {
    const val = safeString(getFieldValue(record, fieldName, idx));
    if (!val.trim()) return null;
    const editKey = `${fieldName}-${idx}-s0`;
    const canEdit = !!record._id;
    const isEdited = editedFields[`${sectionId}-${idx}`] && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    return (
      <div className="rec-mini-card" key={fieldName}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {editingField === editKey ? (
          <div className="numbered-row edit-row"><div className="edit-field-container">
            <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId); }} rows={2} disabled={saving} />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div></div>
        ) : displayRow(record, idx, editKey, canEdit, isEdited, () => handleStartEdit(fieldName, idx, val), val, copyId, `${label}\n${val}`)}
      </div>
    );
  };

  // sentence-split field (per-sentence editable rows); showLabel=false for single-name sections.
  const renderSentenceField = (record, idx, fieldName, label, sectionId, copyId, showLabel = false) => {
    const raw = safeString(getFieldValue(record, fieldName, idx));
    if (!raw.trim()) return null;
    const sentences = splitBySentence(raw);
    if (sentences.length === 0) return null;
    const canEdit = !!record._id;
    return (
      <div className="rec-mini-card" key={fieldName}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sentence, sIdx) => {
          const editKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEdited = editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
          const reconstruct = () => {
            let edited = editValue.trim(); if (edited && !/[.!?]$/.test(edited)) edited += '.';
            return sentences.map((s, i) => { const t = i === sIdx ? edited : s; return (t && !/[.!?]$/.test(t)) ? t + '.' : t; }).join(' ');
          };
          if (editingField === editKey) {
            return (
              <div key={sIdx} className="numbered-row edit-row"><div className="edit-field-container">
                <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, undefined, reconstruct(), sIdx); }} rows={2} disabled={saving} />
                <div className="edit-actions">
                  <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, undefined, reconstruct(), sIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div></div>
            );
          }
          return (
            <React.Fragment key={sIdx}>
              <div className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited ? ' modified' : ''}`} style={{ marginBottom: sIdx < sentences.length - 1 ? '8px' : '0' }} onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence.replace(/[.!?]+$/, '').trim(), sIdx)} title={canEdit ? 'Click to edit' : undefined}>
                <div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{canEdit && !isEdited && editIndicator}</div>
                <button className={`copy-btn ${copiedId === `${copyId}-s${sIdx}` ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, `${copyId}-s${sIdx}`); }}>{copiedId === `${copyId}-s${sIdx}` ? 'Copied!' : 'Copy'}</button>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // dynamic-object field (chambers): one mini-card per key (humanized sub-label + editable value row)
  const renderObjectField = (record, idx, fieldName) => {
    const obj = getFieldValue(record, fieldName, idx);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).length === 0) return null;
    const canEdit = !!record._id;
    return Object.entries(obj).map(([key, value]) => {
      const fieldPath = `${fieldName}.${key}`;
      const editKey = `${fieldPath}-${idx}-s0`;
      const cur = safeString(getFieldValue(record, fieldPath, idx) ?? value);
      if (!cur.trim()) return null;
      const isEdited = editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
      return (
        <div key={key} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(humanizeKey(key))}</div>
          {editingField === editKey ? (
            <div className="numbered-row edit-row"><div className="edit-field-container">
              <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} disabled={saving} />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldPath, idx, fieldName)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div></div>
          ) : displayRow(record, idx, editKey, canEdit, isEdited, () => handleStartEdit(fieldPath, idx, cur), cur, `${fieldName}-${key}`, `${humanizeKey(key)}\n${cur}`)}
        </div>
      );
    });
  };

  // array field (valves): per-item editable rows (single-name section → no per-item sub-label)
  const renderArrayField = (record, idx, fieldName) => {
    const arr = getFieldValue(record, fieldName, idx);
    const list = Array.isArray(record[fieldName]) ? record[fieldName] : [];
    if (list.length === 0) return null;
    const canEdit = !!record._id;
    return (
      <div className="rec-mini-card" key={fieldName}>
        {list.map((item, aIdx) => {
          const fieldPath = `${fieldName}.${aIdx}`;
          const editKey = `${fieldPath}-${idx}-s0`;
          const cur = safeString(getFieldValue(record, fieldPath, idx) ?? item);
          if (!cur.trim()) return null;
          const isEdited = editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
          if (editingField === editKey) {
            return (
              <div key={aIdx} className="numbered-row edit-row"><div className="edit-field-container">
                <textarea ref={textareaRef} className="edit-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} disabled={saving} />
                <div className="edit-actions">
                  <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, fieldName, aIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div></div>
            );
          }
          return (
            <React.Fragment key={aIdx}>
              <div className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited ? ' modified' : ''}`} style={{ marginBottom: aIdx < list.length - 1 ? '8px' : '0' }} onClick={() => canEdit && handleStartEdit(fieldPath, idx, cur)} title={canEdit ? 'Click to edit' : undefined}>
                <div className="row-content"><span className="content-value">{highlightText(cur)}</span>{canEdit && !isEdited && editIndicator}</div>
                <button className={`copy-btn ${copiedId === `${fieldName}-${idx}-${aIdx}` ? 'copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(cur, `${fieldName}-${idx}-${aIdx}`); }}>{copiedId === `${fieldName}-${idx}-${aIdx}` ? 'Copied!' : 'Copy'}</button>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ── Copy builders (canonical: EQ under section title, DASH under sub-labels, numbered, no side-by-side) ──
  const objSection = (r, idx, fieldName, title) => {
    const obj = pdfData[idx]?.[fieldName] ?? r[fieldName];
    const lines = [title, COPY_LINE_EQ];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) objectCopyLines(lines, obj);
    return lines.length > 2 ? lines : null;
  };
  const sentenceSection = (r, idx, fieldName, title) => {
    const raw = safeString(pdfData[idx]?.[fieldName] ?? r[fieldName]);
    const lines = [title, COPY_LINE_EQ];
    splitBySentence(raw).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    return lines.length > 2 ? lines : null;
  };
  const buildRecordLines = (record, idx) => {
    const r = pdfData[idx] || record;
    const out = [`Echo Report ${idx + 1}`, COPY_LINE_EQ];
    const overview = ['Overview', COPY_LINE_EQ];
    if (r.date) pushCopyField(overview, 'Date', formatDate(r.date));
    if (r.ejectionFraction) pushCopyField(overview, 'Ejection Fraction', safeString(r.ejectionFraction));
    if (r.cardiologist) pushCopyField(overview, 'Cardiologist', safeString(r.cardiologist));
    if (overview.length > 2) out.push('', ...overview);
    [['leftVentricle', 'Left Ventricle'], ['rightVentricle', 'Right Ventricle'], ['leftAtrium', 'Left Atrium'], ['rightAtrium', 'Right Atrium']].forEach(([f, t]) => { const s = objSection(r, idx, f, t); if (s) out.push('', ...s); });
    if (Array.isArray(r.valves) && r.valves.length > 0) { const v = ['Valves', COPY_LINE_EQ]; r.valves.forEach((it, i) => { const s = safeString(it); if (s.trim()) v.push(`${i + 1}. ${s}`); }); if (v.length > 2) out.push('', ...v); }
    [['wallMotion', 'Wall Motion'], ['diastolicFunction', 'Diastolic Function'], ['pericardium', 'Pericardium'], ['conclusion', 'Conclusion']].forEach(([f, t]) => { const s = sentenceSection(r, idx, f, t); if (s) out.push('', ...s); });
    return out;
  };
  const copyAll = () => {
    const out = ['Echocardiogram Reports', COPY_LINE_EQ, ''];
    pdfData.forEach((record, idx) => { out.push(...buildRecordLines(record, idx), ''); });
    copyToClipboard(out.join('\n'), 'all-documents');
  };

  if (unwrappedData.length === 0) {
    return (
      <div className="echo-reports-document">
        <div className="document-header"><div className="header-content"><h1 className="document-title">Echocardiogram Reports</h1></div></div>
        <div className="empty-state">No echo reports found.</div>
      </div>
    );
  }

  return (
    <div className="echo-reports-document">
      <div className="document-header">
        <div className="header-content"><h1 className="document-title">Echocardiogram Reports</h1></div>
        <div className="header-actions">
          <button className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`} onClick={copyAll}>{copiedId === 'all-documents' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<EchoReportsDocumentPDFTemplate document={pdfData} />} fileName="Echo_Reports.pdf" className="pdf-btn">
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
        <div className="search-container">
          <input type="text" className="search-input" placeholder="Search echo reports..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}
        </div>
      </div>

      <div className="records-container">
        {filteredRecords.map((record) => {
          const idx = record._index;
          const recordId = `record-${idx}`;
          const hasOverview = record.date || safeString(record.ejectionFraction).trim() || safeString(record.cardiologist).trim();
          const hasObj = (f) => record[f] && typeof record[f] === 'object' && !Array.isArray(record[f]) && Object.keys(record[f]).length > 0;
          const objSections = [['leftVentricle', 'Left Ventricle'], ['rightVentricle', 'Right Ventricle'], ['leftAtrium', 'Left Atrium'], ['rightAtrium', 'Right Atrium']];
          const sentSections = [['wallMotion', 'Wall Motion'], ['diastolicFunction', 'Diastolic Function'], ['pericardium', 'Pericardium'], ['conclusion', 'Conclusion']];
          return (
            <article key={recordId} className="record-card">
              <div className="record-header"><h2 className="record-title">{highlightText(record._documentTitle)}</h2></div>

              {hasOverview && (
                <div className="section"><div className="mini-cards-container">
                  {renderSectionHeader('Overview', `${recordId}-overview`, () => {
                    const r = pdfData[idx] || record; const lines = ['Overview', COPY_LINE_EQ];
                    if (r.date) pushCopyField(lines, 'Date', formatDate(r.date));
                    if (r.ejectionFraction) pushCopyField(lines, 'Ejection Fraction', safeString(r.ejectionFraction));
                    if (r.cardiologist) pushCopyField(lines, 'Cardiologist', safeString(r.cardiologist));
                    copyToClipboard(lines.join('\n'), `${recordId}-overview`);
                  }, idx, 'date')}
                  {renderDateField(record, idx, 'date', `${recordId}-date`)}
                  {renderMeasureField(record, idx, 'ejectionFraction', 'Ejection Fraction', 'ejectionFraction', `${recordId}-ef`)}
                  {renderTextField(record, idx, 'cardiologist', 'Cardiologist', 'cardiologist', `${recordId}-cardiologist`)}
                </div></div>
              )}

              {objSections.map(([f, t]) => hasObj(f) && (
                <div className="section" key={f}><div className="mini-cards-container">
                  {renderSectionHeader(t, `${recordId}-${f}`, () => { const s = objSection(pdfData[idx] || record, idx, f, t); if (s) copyToClipboard(s.join('\n'), `${recordId}-${f}`); }, idx, f)}
                  {renderObjectField(record, idx, f)}
                </div></div>
              ))}

              {Array.isArray(record.valves) && record.valves.length > 0 && (
                <div className="section"><div className="mini-cards-container">
                  {renderSectionHeader('Valves', `${recordId}-valves`, () => {
                    const r = pdfData[idx] || record; const lines = ['Valves', COPY_LINE_EQ];
                    (r.valves || []).forEach((it, i) => { const s = safeString(it); if (s.trim()) lines.push(`${i + 1}. ${s}`); });
                    copyToClipboard(lines.join('\n'), `${recordId}-valves`);
                  }, idx, 'valves')}
                  {renderArrayField(record, idx, 'valves')}
                </div></div>
              )}

              {sentSections.map(([f, t]) => safeString(record[f]).trim() && (
                <div className="section" key={f}><div className={`mini-cards-container${f === 'conclusion' ? ' diagnosis-highlight' : ''}`}>
                  {renderSectionHeader(t, `${recordId}-${f}`, () => { const s = sentenceSection(pdfData[idx] || record, idx, f, t); if (s) copyToClipboard(s.join('\n'), `${recordId}-${f}`); }, idx, f)}
                  {renderSentenceField(record, idx, f, t, f, `${recordId}-${f}`, false)}
                </div></div>
              ))}
            </article>
          );
        })}
      </div>

      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No echo reports match your search "{searchTerm}"</div>
      )}
    </div>
  );
};

export default EchoReportsDocument;
