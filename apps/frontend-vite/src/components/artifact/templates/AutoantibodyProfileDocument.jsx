/**
 * AutoantibodyProfileDocument.jsx
 * Inline editing with per-section approve, dot-path nested object editing,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AutoantibodyProfileDocumentPDFTemplate from '../pdf-templates/AutoantibodyProfileDocumentPDFTemplate';
import './AutoantibodyProfileDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the editKey with its "-<idx>" suffix removed) */
const DRAFT_KEY = 'autoantibody_profilePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CORE_ANTIBODY_FIELDS = [
  ['antiDsDna', 'Anti-dsDNA'],
  ['antiSmith', 'Anti-Smith'],
  ['antiSsaRo', 'Anti-SSA/Ro'],
  ['antiSsbLa', 'Anti-SSB/La'],
  ['antiRnp', 'Anti-RNP'],
  ['antiScl70', 'Anti-Scl-70'],
  ['antiCentromere', 'Anti-Centromere'],
  ['antiJo1', 'Anti-Jo-1'],
  ['antiCcp', 'Anti-CCP'],
  ['rheumatoidFactor', 'Rheumatoid Factor'],
];

const ANA_SUB_FIELDS = [['titer', 'Titer'], ['pattern', 'Pattern'], ['positive', 'Positive']];
const ANCA_SUB_FIELDS = [['cAnca', 'c-ANCA'], ['pAnca', 'p-ANCA'], ['antiPr3', 'Anti-PR3'], ['antiMpo', 'Anti-MPO']];
const APL_SUB_FIELDS = [
  ['anticardiolipin.IgG', 'Anticardiolipin IgG'], ['anticardiolipin.IgM', 'Anticardiolipin IgM'],
  ['beta2Glycoprotein.IgG', 'Beta-2 Glycoprotein IgG'], ['beta2Glycoprotein.IgM', 'Beta-2 Glycoprotein IgM'],
  ['lupusAnticoagulant', 'Lupus Anticoagulant'],
];

const SECTION_FIELDS = {
  date: ['date'],
  recordInfo: ['provider', 'facility', 'status'],
  anaPanel: ['ana'],
  coreAntibodies: CORE_ANTIBODY_FIELDS.map(([f]) => f),
  antiphospholipid: ['antiphospholipidAntibodies'],
  ancaPanel: ['anca'],
  results: ['results'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider', facility: 'Facility', status: 'Status',
  ana: 'ANA Panel', antiphospholipidAntibodies: 'Antiphospholipid Antibodies', anca: 'ANCA Panel',
  results: 'Results', recommendations: 'Recommendations',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  ...Object.fromEntries(CORE_ANTIBODY_FIELDS),
};

const SECTION_TITLES = {
  date: 'Date', recordInfo: 'Record Information', anaPanel: 'ANA Panel',
  coreAntibodies: 'Core Antibodies', antiphospholipid: 'Antiphospholipid Antibodies',
  ancaPanel: 'ANCA Panel', results: 'Results', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes',
};

/* Plain-text copy formatting — NO "Label:" colons (user preference). A section title is an UPPERCASE
   heading underlined with '='; a field label is a heading underlined with '_'; the value(s) go on the
   line(s) below. */
const secHeading = (title) => { const u = String(title).toUpperCase(); return `${u}\n${'='.repeat(u.length)}\n`; };
const fldBlock = (label, value) => { const l = String(label); return `${l}\n${'_'.repeat(l.length)}\n${value}\n\n`; };

// ===== Value / Object helpers (recursive object + array rendering) =====
const KEY_OVERRIDES = { ana: 'ANA', anca: 'ANCA', dsDna: 'dsDNA', ccp: 'CCP', rf: 'RF', igG: 'IgG', igM: 'IgM', igA: 'IgA' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const toInputDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; } };

/* splitByComma: parenthesis-aware comma split. A depth-0 comma is a separator UNLESS the comma is
   inside parentheses OR the tail starts with a year (date) OR a coordinating conjunction "and"/"or"
   (so "MCTD (anti-U1 RNP), and scleroderma-myositis overlap (anti-PM/Scl)" stays one clause and
   "(anti-SSA/Ro, anti-SSB/La)" is never broken). Used as the fallback split for narrative fields
   that have no sentence/semicolon boundaries. Joining the result with ', ' round-trips losslessly. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const AutoantibodyProfileDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.autoantibody_profile) return Array.isArray(r.autoantibody_profile) ? r.autoantibody_profile : [r.autoantibody_profile];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoantibody_profile) return Array.isArray(dd.autoantibody_profile) ? dd.autoantibody_profile : [dd.autoantibody_profile]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (record) => { const id = record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const recId = getRecordId(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Restore the "edited" marker so the section's Pending Approve button reappears.
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; });
  };

  const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  };

  // ===== Edit Helpers =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  // Stage a DRAFT for an editKey: write to localStorage (survives refresh) + clear the section's
  // approved flag so re-edits return to yellow Pending Approve. NO DB write (Approve commits).
  const stageDraft = useCallback((record, editKey, value, idx, sectionId) => {
    const recordId = getRecordId(record);
    if (recordId) {
      const fieldPart = editKey.endsWith(`-${idx}`) ? editKey.slice(0, -`-${idx}`.length) : editKey;
      const store = readDrafts();
      if (!store[recordId]) store[recordId] = {};
      store[recordId][fieldPart] = value;
      writeDrafts(store);
    }
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sectionId !== undefined && sectionId !== null) {
      setApprovedSections(prev => {
        const key = `${sectionId}-${idx}`;
        if (!prev[key]) return prev;
        const n = { ...prev };
        delete n[key];
        return n;
      });
    }
  }, []);

  // Save = stage a DRAFT locally (localStorage) only. NOT written to MongoDB and NOT shown in the
  // PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AutoantibodyProfile] Cannot save — no record ID'); return; }
    const newValue = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = editTrackingKey || `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) {
      setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    stageDraft(record, editKey, newValue, idx, sectionId);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  const handleSaveNestedField = useCallback((record, idx, parentField, dotPath, sectionId) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AutoantibodyProfile] Cannot save — no record ID'); return; }
    const editKey = `${parentField}.${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    stageDraft(record, editKey, editValue, idx, sectionId);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    try {
      const recordId = getRecordId(record);
      if (!recordId) return;
      const sectionFields = SECTION_FIELDS[sectionId] || [];
      // Collect this record's pending editKeys that belong to this section.
      const suffix = `-${idx}`;
      const belongsToSection = (editKey) => {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "field.dotPath", or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
        return sectionFields.includes(baseField);
      };
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && belongsToSection(k));
      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(trailing)) {
          // dotted field whose LAST segment is purely numeric → arrayIndex
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(trailing, 10);
        } else {
          // plain field OR dotted object-path (e.g. "ana.titer") → send whole dotted path as field
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/autoantibody_profile/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/autoantibody_profile/${recordId}/approve`, { sectionId, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage.
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[recordId][fp]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AutoantibodyProfile] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim(); if (i < sentences.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }

  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx, newSentenceText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const cleanNew = newSentenceText.trim();
    const cleanOld = (currentSentences[sentenceIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; }
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') {
      currentSentences.splice(sentenceIdx, 1);
      setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, null, reconstructFullText(currentSentences), `${fieldName}-${idx}`);
      return;
    }
    let newText = cleanNew;
    if (newText && !newText.match(/[.!?;]$/)) newText += '.';
    currentSentences[sentenceIdx] = newText;
    const extraCount = newText.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    setEditedSentences(prev => { const next = { ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let e = 1; e <= extraCount; e++) next[`${fieldName}-${idx}-s${sentenceIdx + e}`] = 'added'; return next; });
    handleSaveField(record, fieldName, idx, sectionId, null, reconstructFullText(currentSentences), `${fieldName}-${idx}`);
  }

  // ===== Search =====
  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(`(${escaped})`, 'gi'); const parts = str.split(regex); if (parts.length === 1) return str; return <>{parts.map((p, i) => regex.test(p) ? <mark key={i}>{p}</mark> : p)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, sectionTitle, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [sectionTitle, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;
  const fieldMatches = (record, fieldName, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const label = FIELD_LABELS[fieldName] || fieldName; return phraseMatch(label, searchTerm) || phraseMatch(getFieldValue(record, fieldName, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Autoantibody Profile ${idx + 1}`;
      const anaText = record.ana ? `${record.ana.titer} ${record.ana.pattern} ${record.ana.positive}` : '';
      const ancaText = record.anca ? Object.values(record.anca).join(' ') : '';
      const aplText = record.antiphospholipidAntibodies ? JSON.stringify(record.antiphospholipidAntibodies) : '';
      const allText = [
        title, formatDate(record.date), record.provider, record.facility, record.status,
        ...CORE_ANTIBODY_FIELDS.map(([f]) => record[f]),
        anaText, ancaText, aplText,
        flattenSearchable(record.results), flattenSearchable(record.recommendations),
        record.findings, record.assessment, record.plan, record.notes,
        ...Object.values(FIELD_LABELS),
        'Record Information', 'ANA Panel', 'Core Antibodies', 'Antiphospholipid Antibodies', 'ANCA Panel',
        'Results', 'Recommendations', 'Date',
        'Findings', 'Assessment', 'Plan', 'Notes',
      ].filter(Boolean).join(' ');
      const match = phraseMatch(allText, searchTerm);
      if (match && phraseMatch(title, searchTerm)) record._showAllSections = true;
      return match;
    });
  }, [records, searchTerm]);

  // ===== Section Edits =====
  const sectionHasEdits = (idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`)));
  };
  const renderApproveButton = (idx, sectionId) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    if (hasEdits) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sectionId); }}>Pending Approve</button>;
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  // ===== Render Helpers =====
  const renderEditableField = (record, fieldName, idx, sectionId, hideLabel) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !localEdits[`${fieldName}-${idx}`]) return null;
    const displayValue = String(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value || ''));
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const copyId = `row-${fieldName}-${idx}`;
    if (isEditing) {
      return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>}<div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}><div className="row-content"><span className="content-value">{highlightText(displayValue)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === copyId ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fieldName] || fieldName}: ${displayValue}`, copyId); }}>{copiedId === copyId ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceEditableField = (record, fieldName, idx, sectionId, hideLabel) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value) return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) {
      // No sentence/semicolon boundary → fall back to a paren-aware comma split (and/or-guarded).
      const commaItems = splitByComma(String(value));
      if (commaItems.length >= 2) return renderCommaSplitField(record, fieldName, idx, sectionId, hideLabel, commaItems);
      return renderEditableField(record, fieldName, idx, sectionId, hideLabel);
    }
    const visibleSentences = sentences.map((s, origIdx) => ({ text: s, _origIdx: origIdx })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName)) return true;
      return phraseMatch(item.text, searchTerm);
    });
    if (visibleSentences.length === 0) return null;
    return (<>{visibleSentences.map(({ text, _origIdx: sIdx }) => {
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const editStatus = editedSentences[sentenceKey];
      if (isEditing) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      const sCopyId = `row-${fieldName}-${idx}-s${sIdx}`;
      return (<div key={sIdx} className="rec-mini-card"><div className={`numbered-row editable-row${editStatus ? ' modified' : ''}`} onClick={() => { setEditingField(sentenceKey); setEditValue(text.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!editStatus && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === sCopyId ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, sCopyId); }}>{copiedId === sCopyId ? 'Copied' : 'Copy'}</button></div>{editStatus && <div className={`modified-badge${editStatus === 'added' ? ' added' : ''}`}>{editStatus === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
  };

  // Save one comma-clause edit: replace clause cIdx and rejoin with ', ' (round-trip safe, since
  // every split point was a ', ' separator and guarded commas stay inside their clause). Empty → delete.
  const saveCommaItem = (record, fieldName, idx, sectionId, cIdx, commaKey, newText) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AutoantibodyProfile] Cannot save — no record ID'); return; }
    const current = String(getFieldValue(record, fieldName, idx) || '');
    const items = splitByComma(current);
    if (cIdx < 0 || cIdx >= items.length) { setEditingField(null); setEditValue(''); return; }
    const clean = newText.trim();
    if (clean) items[cIdx] = clean; else items.splice(cIdx, 1);
    const fullText = items.join(', ');
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); // keep section's Pending Approve lit even on delete
    stageDraft(record, editKey, fullText, idx, sectionId);
    setEditingField(null); setEditValue('');
  };

  // Render a single-sentence narrative field that was comma-split into clauses — each clause its own
  // editable rec-mini-card row (no per-field label; the section header already names the field).
  const renderCommaSplitField = (record, fieldName, idx, sectionId, hideLabel, commaItems) => {
    const visibleItems = commaItems.map((t, origIdx) => ({ text: t, _origIdx: origIdx })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName)) return true;
      return phraseMatch(item.text, searchTerm);
    });
    if (visibleItems.length === 0) return null;
    return (<>{visibleItems.map(({ text, _origIdx: cIdx }) => {
      const commaKey = `${fieldName}-${idx}-c${cIdx}`;
      const isEditing = editingField === commaKey;
      const badge = editedSentences[commaKey];
      if (isEditing) return (<div key={cIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fieldName, idx, sectionId, cIdx, commaKey, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveCommaItem(record, fieldName, idx, sectionId, cIdx, commaKey, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      const cCopyId = `row-${fieldName}-${idx}-c${cIdx}`;
      return (<div key={cIdx} className="rec-mini-card"><div className={`numbered-row editable-row${badge ? ' modified' : ''}`} onClick={() => { setEditingField(commaKey); setEditValue(text); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!badge && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cCopyId ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, cCopyId); }}>{copiedId === cCopyId ? 'Copied' : 'Copy'}</button></div>{badge && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    })}</>);
  };

  // Render nested object sub-fields — each as its own rec-mini-card with nested-subtitle
  const renderNestedSubField = (record, idx, parentField, dotPath, label, sectionId) => {
    const editKey = `${parentField}.${dotPath}-${idx}`;
    const rawValue = localEdits[editKey] !== undefined ? localEdits[editKey] : getNestedValue(record[parentField], dotPath);
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return null;
    const displayValue = String(typeof rawValue === 'boolean' ? (rawValue ? 'Positive' : 'Negative') : rawValue);
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div key={dotPath} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="edit-field-container">
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, parentField, dotPath, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveNestedField(record, idx, parentField, dotPath, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    const nCopyId = `row-${parentField}.${dotPath}-${idx}`;
    return (
      <div key={dotPath} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
          <button className={`copy-btn${copiedId === nCopyId ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${displayValue}`, nCopyId); }}>{copiedId === nCopyId ? 'Copied' : 'Copy'}</button>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Date Field (date-picker) =====
  const handleSaveDateField = useCallback(async (record, fieldName, idx, sectionId, isoValue) => {
    return handleSaveField(record, fieldName, idx, sectionId, undefined, isoValue, `${fieldName}-${idx}`);
  }, [handleSaveField]);

  const renderDateField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (isEmptyDeep(value)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayValue = formatDate(value);
    const dCopyId = `row-${fieldName}-${idx}`;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(value)); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch { /* noop */ } } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) return; handleSaveDateField(record, fieldName, idx, sectionId, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayValue)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === dCopyId ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fieldName] || fieldName}: ${displayValue}`, dCopyId); }}>{copiedId === dCopyId ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Recursive OBJECT field (results) — editable leaves by dot-path =====
  const saveObjectLeaf = useCallback((record, rootField, path, idx, sectionId, leafKey, newVal) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AutoantibodyProfile] Cannot save — no record ID'); return; }
    const editKey = `${rootField}-${idx}`;
    let mergedClone;
    setLocalEdits(prev => {
      const cur = prev[editKey] !== undefined ? prev[editKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) { if (!node[path[i]]) node[path[i]] = {}; node = node[path[i]]; }
      node[path[path.length - 1]] = newVal;
      mergedClone = clone;
      return { ...prev, [editKey]: clone };
    });
    setEditedFields(prev => ({ ...prev, [leafKey]: 'edited' }));
    // Stage the WHOLE merged object under "<rootField>-<idx>" (Approve PUTs field=<rootField>, value=object).
    stageDraft(record, editKey, mergedClone, idx, sectionId);
    setEditingField(null); setEditValue('');
  }, [stageDraft]);

  const renderObjectLeaf = (record, rootField, path, idx, sectionId, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    return (
      <div key={path.join('.')} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(leafValueString); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={2} disabled={saving} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } if (e.key === 'Enter' && e.ctrlKey) saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim()); }} />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveObjectLeaf(record, rootField, path, idx, sectionId, leafKey, editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}: ${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderObjectNode = (record, rootField, idx, sectionId, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sectionId, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sectionId, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sectionId, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fieldName, [k], idx, sectionId, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, sectionId, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  // ===== Recommendations (array of {recommendation, date}) — date-grouped =====
  const saveRecommendation = useCallback((record, fieldName, idx, sectionId, rIdx, itemKey, newText) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AutoantibodyProfile] Cannot save — no record ID'); return; }
    const currentArr = Array.isArray(getFieldValue(record, fieldName, idx)) ? getFieldValue(record, fieldName, idx) : [];
    const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: newText.trim() } : { ...r });
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newArr }));
    setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
    // Stage the WHOLE array under "<fieldName>-<idx>" (Approve PUTs field=<fieldName>, value=array).
    stageDraft(record, editKey, newArr, idx, sectionId);
    setEditingField(null); setEditValue('');
  }, [getFieldValue, stageDraft]);

  const renderRecommendationsField = (record, fieldName, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });
    return (
      <div className="rec-mini-card">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
            {group.items.map(({ rec, rIdx }) => {
              const recText = (rec?.recommendation || '').trim();
              const recDate = (rec?.date || '').trim();
              const itemKey = `${fieldName}-${idx}-r${rIdx}`;
              const isEditing = editingField === itemKey;
              const badge = editedSentences[itemKey];
              return (
                <div key={rIdx}>
                  <div className={`numbered-row editable-row${badge ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={2} disabled={saving} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } if (e.key === 'Enter' && e.ctrlKey) saveRecommendation(record, fieldName, idx, sectionId, rIdx, itemKey, editValue); }} />
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveRecommendation(record, fieldName, idx, sectionId, rIdx, itemKey, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(recText)}</span>{!badge && <span className="edit-indicator">✎</span>}</div>
                        <button className={`copy-btn${copiedId === itemKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedId === itemKey ? 'Copied' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ===== pdfData Memo =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldPath = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1), 10);
        if (recordIdx !== idx) return;
        if (fieldPath.includes('.')) {
          const parts = fieldPath.split('.');
          const parent = parts[0];
          if (!merged[parent]) merged[parent] = {};
          let obj = merged[parent];
          for (let i = 1; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
          obj[parts[parts.length - 1]] = localEdits[key];
        } else if (fieldPath in record) {
          merged[fieldPath] = localEdits[key];
        }
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ===== Copy =====
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch (err) { console.error('Copy failed:', err); } };

  // Numbered clauses for a narrative value (sentence/semicolon split, else paren-aware comma fallback);
  // no field sub-label (the section heading already names it). Single value → printed as-is.
  const narrativeLines = (value) => {
    const s = String(value);
    const sentences = splitBySentence(s);
    const ci = splitByComma(s);
    const items = sentences.length > 1 ? sentences : (ci.length >= 2 ? ci : null);
    if (items) return items.map((it, i) => `${i + 1}. ${it}`).join('\n') + '\n\n';
    return `${value}\n\n`;
  };
  // Recursively emit an object's leaves as underlined-label blocks (Results); no colons.
  const objectCopyLines = (value) => {
    let out = '';
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      if (isScalar(v)) out += fldBlock(humanizeKey(k), fmtScalar(v));
      else { const lbl = humanizeKey(k); out += `${lbl}\n${'_'.repeat(lbl.length)}\n` + objectCopyLines(v); }
    });
    return out;
  };

  const copySectionText = (record, idx, sectionId) => {
    const pdfRecord = pdfData[idx] || record;
    let text = secHeading(SECTION_TITLES[sectionId] || sectionId);
    if (sectionId === 'date') {
      text += `${formatDate(pdfRecord.date)}\n`;
    } else if (sectionId === 'recordInfo') {
      [['Provider', pdfRecord.provider], ['Facility', pdfRecord.facility], ['Status', pdfRecord.status]]
        .forEach(([l, v]) => { if (v && String(v).trim()) text += fldBlock(l, v); });
    } else if (sectionId === 'anaPanel' && pdfRecord.ana) {
      [['Titer', pdfRecord.ana.titer], ['Pattern', pdfRecord.ana.pattern], ['Positive', pdfRecord.ana.positive ? 'Yes' : 'No']]
        .forEach(([l, v]) => { if (v && String(v).trim()) text += fldBlock(l, v); });
    } else if (sectionId === 'coreAntibodies') {
      CORE_ANTIBODY_FIELDS.forEach(([f, label]) => { if (pdfRecord[f]) text += fldBlock(label, pdfRecord[f]); });
    } else if (sectionId === 'antiphospholipid' && pdfRecord.antiphospholipidAntibodies) {
      APL_SUB_FIELDS.forEach(([p, l]) => { const v = getNestedValue(pdfRecord.antiphospholipidAntibodies, p); if (v) text += fldBlock(l, v); });
    } else if (sectionId === 'ancaPanel' && pdfRecord.anca) {
      ANCA_SUB_FIELDS.forEach(([p, l]) => { if (pdfRecord.anca[p]) text += fldBlock(l, pdfRecord.anca[p]); });
    } else if (sectionId === 'results' && pdfRecord.results) {
      text += objectCopyLines(pdfRecord.results);
    } else if (sectionId === 'recommendations' && Array.isArray(pdfRecord.recommendations)) {
      let lastDate = null, n = 1;
      pdfRecord.recommendations.forEach(r => { const d = (r?.date || '').trim(); if (d !== lastDate) { if (d) text += `${d}\n${'_'.repeat(d.length)}\n`; lastDate = d; n = 1; } text += `${n++}. ${(r?.recommendation || '').trim()}\n`; });
    } else {
      // single-name narrative sections (findings / assessment / plan / notes)
      const fields = SECTION_FIELDS[sectionId] || [];
      fields.forEach(f => { const val = pdfRecord[f]; if (val) text += narrativeLines(val); });
    }
    copyToClipboard(text.trim(), `section-${sectionId}-${idx}`);
  };

  const copyAllContent = () => {
    let text = secHeading('Autoantibody Profile') + '\n';
    pdfData.forEach((record, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      const rtitle = `Autoantibody Profile ${idx + 1}`;
      text += `${rtitle}\n${'='.repeat(rtitle.length)}\n\n`;
      if (record.date) text += secHeading('Date') + `${formatDate(record.date)}\n\n`;
      if (record.provider || record.facility || record.status) {
        text += secHeading('Record Information');
        [['Provider', record.provider], ['Facility', record.facility], ['Status', record.status]]
          .forEach(([l, v]) => { if (v && String(v).trim()) text += fldBlock(l, v); });
      }
      if (record.ana) {
        text += secHeading('ANA Panel');
        [['Titer', record.ana.titer], ['Pattern', record.ana.pattern], ['Positive', record.ana.positive ? 'Yes' : 'No']]
          .forEach(([l, v]) => { if (v && String(v).trim()) text += fldBlock(l, v); });
      }
      if (CORE_ANTIBODY_FIELDS.some(([f]) => record[f])) {
        text += secHeading('Core Antibodies');
        CORE_ANTIBODY_FIELDS.forEach(([f, l]) => { if (record[f]) text += fldBlock(l, record[f]); });
      }
      if (record.antiphospholipidAntibodies) {
        const aplLines = APL_SUB_FIELDS.map(([p, l]) => { const v = getNestedValue(record.antiphospholipidAntibodies, p); return v ? fldBlock(l, v) : ''; }).join('');
        if (aplLines) text += secHeading('Antiphospholipid Antibodies') + aplLines;
      }
      if (record.anca) {
        const ancaLines = ANCA_SUB_FIELDS.map(([p, l]) => record.anca[p] ? fldBlock(l, record.anca[p]) : '').join('');
        if (ancaLines) text += secHeading('ANCA Panel') + ancaLines;
      }
      if (!isEmptyDeep(record.results)) text += secHeading('Results') + objectCopyLines(record.results);
      if (record.findings) text += secHeading('Findings') + narrativeLines(record.findings);
      if (record.assessment) text += secHeading('Assessment') + narrativeLines(record.assessment);
      if (record.plan) text += secHeading('Plan') + narrativeLines(record.plan);
      if (Array.isArray(record.recommendations) && record.recommendations.length) {
        text += secHeading('Recommendations');
        let lastDate = null, n = 1;
        record.recommendations.forEach(r => { const d = (r?.date || '').trim(); if (d !== lastDate) { if (d) text += `${d}\n${'_'.repeat(d.length)}\n`; lastDate = d; n = 1; } text += `${n++}. ${(r?.recommendation || '').trim()}\n`; });
        text += '\n';
      }
      if (record.notes) text += secHeading('Notes') + narrativeLines(record.notes);
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sectionId, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sectionId}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sectionId)}>{copiedId === `section-${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sectionId)}</div></div>{children}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return (<article className="autoantibody-profile-document"><header className="document-header"><h1 className="document-title">Autoantibody Profile</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No autoantibody profile data available.</div></article>);
  }

  return (
    <article className="autoantibody-profile-document">
      <header className="document-header">
        <h1 className="document-title">Autoantibody Profile</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<AutoantibodyProfileDocumentPDFTemplate document={pdfData} />} fileName="Autoantibody_Profile.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Autoantibody Profile ${idx + 1}`)}</h3></div>
            </div>

            {/* Date */}
            {!isEmptyDeep(getFieldValue(record, 'date', idx)) && shouldShowSection(record, 'Date', [formatDate(getFieldValue(record, 'date', idx))], ['date']) &&
              renderSection(record, idx, 'date', 'Date', renderDateField(record, 'date', idx, 'date'))
            }

            {/* Record Information */}
            {(() => {
              const hasData = [record.provider, record.facility, record.status].some(v => v && String(v).trim());
              if (!hasData) return null;
              if (!shouldShowSection(record, 'Record Information', [record.provider, record.facility, record.status].filter(Boolean), ['provider', 'facility', 'status'])) return null;
              const stm = sectionTitleMatches('Record Information');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'recordInfo', 'Record Information', <>
                {(showAll || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'recordInfo')}
                {(showAll || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}
                {(showAll || fieldMatches(record, 'status', idx)) && renderEditableField(record, 'status', idx, 'recordInfo')}
              </>);
            })()}

            {/* ANA Panel */}
            {record.ana && shouldShowSection(record, 'ANA Panel', [`${record.ana.titer} ${record.ana.pattern}`], ['ana']) &&
              renderSection(record, idx, 'anaPanel', 'ANA Panel',
                ANA_SUB_FIELDS.map(([sf, label]) => renderNestedSubField(record, idx, 'ana', sf, label, 'anaPanel'))
              )
            }

            {/* Core Antibodies */}
            {(() => {
              const hasData = CORE_ANTIBODY_FIELDS.some(([f]) => record[f] && String(record[f]).trim());
              if (!hasData) return null;
              const contentParts = CORE_ANTIBODY_FIELDS.map(([f]) => record[f]).filter(Boolean);
              if (!shouldShowSection(record, 'Core Antibodies', contentParts, CORE_ANTIBODY_FIELDS.map(([f]) => f))) return null;
              const stm = sectionTitleMatches('Core Antibodies');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'coreAntibodies', 'Core Antibodies', <>
                {CORE_ANTIBODY_FIELDS.map(([f]) => (showAll || fieldMatches(record, f, idx)) ? renderEditableField(record, f, idx, 'coreAntibodies') : null)}
              </>);
            })()}

            {/* Antiphospholipid Antibodies */}
            {record.antiphospholipidAntibodies && shouldShowSection(record, 'Antiphospholipid Antibodies', [JSON.stringify(record.antiphospholipidAntibodies)], ['antiphospholipidAntibodies']) &&
              renderSection(record, idx, 'antiphospholipid', 'Antiphospholipid Antibodies',
                APL_SUB_FIELDS.map(([path, label]) => renderNestedSubField(record, idx, 'antiphospholipidAntibodies', path, label, 'antiphospholipid'))
              )
            }

            {/* ANCA Panel */}
            {record.anca && shouldShowSection(record, 'ANCA Panel', [Object.values(record.anca).join(' ')], ['anca']) &&
              renderSection(record, idx, 'ancaPanel', 'ANCA Panel',
                ANCA_SUB_FIELDS.map(([sf, label]) => renderNestedSubField(record, idx, 'anca', sf, label, 'ancaPanel'))
              )
            }

            {/* Results */}
            {!isEmptyDeep(getFieldValue(record, 'results', idx)) && shouldShowSection(record, 'Results', [flattenSearchable(getFieldValue(record, 'results', idx))], ['results']) &&
              renderSection(record, idx, 'results', 'Results', renderObjectField(record, 'results', idx, 'results'))
            }

            {/* Findings */}
            {getFieldValue(record, 'findings', idx) && shouldShowSection(record, 'Findings', [getFieldValue(record, 'findings', idx)], ['findings']) &&
              renderSection(record, idx, 'findings', 'Findings', renderSentenceEditableField(record, 'findings', idx, 'findings', true))
            }

            {/* Assessment */}
            {getFieldValue(record, 'assessment', idx) && shouldShowSection(record, 'Assessment', [getFieldValue(record, 'assessment', idx)], ['assessment']) &&
              renderSection(record, idx, 'assessment', 'Assessment', renderSentenceEditableField(record, 'assessment', idx, 'assessment', true))
            }

            {/* Plan */}
            {getFieldValue(record, 'plan', idx) && shouldShowSection(record, 'Plan', [getFieldValue(record, 'plan', idx)], ['plan']) &&
              renderSection(record, idx, 'plan', 'Plan', renderSentenceEditableField(record, 'plan', idx, 'plan', true))
            }

            {/* Recommendations */}
            {Array.isArray(getFieldValue(record, 'recommendations', idx)) && getFieldValue(record, 'recommendations', idx).length > 0 && shouldShowSection(record, 'Recommendations', [flattenSearchable(getFieldValue(record, 'recommendations', idx))], ['recommendations']) &&
              renderSection(record, idx, 'recommendations', 'Recommendations', renderRecommendationsField(record, 'recommendations', idx, 'recommendations'))
            }

            {/* Notes */}
            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) &&
              renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))
            }
          </div>
        ))}
      </div>
    </article>
  );
};

export default AutoantibodyProfileDocument;
