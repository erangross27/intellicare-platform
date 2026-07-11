/**
 * CancerStagingDocument.jsx
 * March 2026 blue glow theme with inline editing + dot-path for tnmStaging.
 * Sentence-split for findings, assessment, plan, notes.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Collection: cancer_staging
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CancerStagingDocumentPDFTemplate from '../pdf-templates/CancerStagingDocumentPDFTemplate';
import './CancerStagingDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = dot-path "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cancer_stagingPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  tnm: ['tnmStaging.overallStage', 'tnmStaging.t', 'tnmStaging.n', 'tnmStaging.m'],
  otherStaging: ['issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo', 'otherStaging'],
  findings: ['findings'],
  clinical: ['assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  providerInfo: ['date', 'provider', 'facility', 'status'],
  notes: ['notes'],
};
const DATE_FIELDS = ['date'];
// Fixed-choice fields → dropdown. Current value is kept as an option when non-standard (no data loss).
const ENUM_FIELDS = { status: ['active', 'not active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.includes(cur) ? [cur, ...opts] : opts; };
const FIELD_LABELS = {
  'tnmStaging.overallStage': 'Overall Stage', 'tnmStaging.t': 'T (Tumor)', 'tnmStaging.n': 'N (Nodes)', 'tnmStaging.m': 'M (Metastasis)',
  issStaging: 'ISS Staging', rissStaging: 'R-ISS Staging', durieSalmon: 'Durie-Salmon', annArbor: 'Ann Arbor', figo: 'FIGO',
  otherStaging: 'Other Staging', results: 'Results', recommendations: 'Recommendations',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status', notes: 'Notes',
};
const KEY_OVERRIDES = { ipiScore: 'IPI Score', IPIScore: 'IPI Score', ldh: 'LDH', cns: 'CNS', cnsRiskAssessment: 'CNS Risk Assessment', ecog: 'ECOG' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const getNestedVal = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };

const CancerStagingDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.cancer_staging) return Array.isArray(r.cancer_staging) ? r.cancer_staging : [r.cancer_staging];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cancer_staging) return Array.isArray(dd.cancer_staging) ? dd.cancer_staging : [dd.cancer_staging]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const resolveId = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = resolveId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } };
  const getFieldValue = useCallback((record, dotPath, idx) => { const ek = `${dotPath}-${idx}`; if (localEdits[ek] !== undefined) return localEdits[ek]; return dotPath.includes('.') ? getNestedVal(record, dotPath) : record[dotPath]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, dotPath, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerStaging] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][dotPath] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record);
      if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending edits for this record whose base field belongs to this section
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // dot-path "field" or "field.arrayIndex"
        return sf.includes(fieldPart);
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now. arrayIndex ONLY when the trailing dot-segment is numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          payload.field = fieldPart;
        }
        await sc.put(`/api/edit/cancer_staging/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail) — existing endpoint
      await sc.put(`/api/edit/cancer_staging/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[rid][fp]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CancerStaging] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const saveSentence = useCallback(async (record, fn, idx, sid, sentenceIdx, valueOverride) => {
    setSaving(true);
    try {
      const rid = getRecordId(record);
      if (!rid) throw new Error('No record ID');
      const currentVal = fmtVal(getFieldValue(record, fn, idx));
      const currentSentences = splitBySentence(currentVal);
      const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
      if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') { currentSentences.splice(sentenceIdx, 1); }
      else { const cleanOld = (currentSentences[sentenceIdx] || '').trim(); if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); setSaving(false); return; } currentSentences[sentenceIdx] = cleanNew; }
      const fullText = reconstructFullText(currentSentences);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      const ek = `${fn}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [ek]: fullText }));
      setPendingEdits(prev => ({ ...prev, [ek]: true }));
      const newSentences = splitBySentence(fullText);
      const originalCount = splitBySentence(fmtVal(record[fn])).length;
      setEditedFields(prev => { const n = { ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let ei = originalCount; ei < newSentences.length; ei++) { n[`${fn}-${idx}-s${ei}`] = 'added'; } return n; });
      setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    } catch (err) { console.error('[CancerStaging] Sentence save failed:', err); }
    finally { setSaving(false); }
  }, [editValue, localEdits, getFieldValue]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cancer Staging ${idx + 1}`;
      const tnm = record.tnmStaging || {};
      const allText = [title, formatDate(record.date), tnm.overallStage, tnm.t, tnm.n, tnm.m,
        record.issStaging, record.rissStaging, record.durieSalmon, record.annArbor, record.figo,
        flattenSearchable(record.otherStaging), flattenSearchable(record.results), flattenSearchable(record.recommendations),
        record.findings, record.assessment, record.plan, record.notes, record.provider, record.facility,
        ...Object.values(FIELD_LABELS), 'TNM Staging', 'Other Staging Systems', 'Findings', 'Clinical Assessment', 'Plan', 'Results', 'Recommendations', 'Provider Information', 'Notes',
      ].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, dotPath, label, idx, sid) => {
    const raw = getFieldValue(record, dotPath, idx);
    if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const enumOpts = ENUM_FIELDS[dotPath];   // fixed-choice field (e.g. status) → dropdown
    const ek = `${dotPath}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${dotPath}-${idx}`;
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="edit-field-container">
          {enumOpts ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              {enumOptionsWith(enumOpts, dv).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, dotPath, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={1} disabled={saving} />
          )}
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveField(record, dotPath, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}>
          <div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const saveDateField = useCallback((record, dotPath, idx, isoValue, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerStaging] Cannot save date — no record ID'); return; }
    const ek = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: isoValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][dotPath] = isoValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const renderDateField = (record, dotPath, label, idx, sid) => {
    const raw = getFieldValue(record, dotPath, idx);
    if (!hasVal(raw)) return null;
    const dv = formatDate(raw);
    const ek = `${dotPath}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${dotPath}-${idx}`;
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="edit-field-container">
          <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)}
            ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }}
            onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; saveDateField(record, dotPath, idx, editValue + 'T00:00:00.000Z', sid); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}>
          <div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* Sentence-split section */
  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx);
    if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw));
    if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`;
        const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
        const parsed = parseLabel(sent);
        const saveLabeledSentence = (label) => { saveSentence(record, fieldName, idx, sid, si, label ? `${label}: ${editValue}` : editValue); };
        if (ie) return (
          <div key={si} className="rec-mini-card">
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLabeledSentence(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                autoFocus rows={2} disabled={saving} />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveLabeledSentence(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
        const displayText = parsed ? parsed.content : sent;
        return (
          <div key={si} className="rec-mini-card">
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}>
              <div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
            </div>
            {ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}
            {ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}
          </div>
        );
      }).filter(Boolean);
    })());
  };

  /* Save an object leaf at rootField + nested path (dot-path persisted so pdfData/route handle it). */
  const saveObjectLeaf = useCallback((record, rootField, path, idx, sid, newVal) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerStaging] Cannot save leaf — no record ID'); return; }
    const dotPath = [rootField, ...path].join('.');
    const ek = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newVal }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][dotPath] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  /* OBJECT LEAF (editable scalar within a nested object) */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const dotPath = [rootField, ...path].join('.');
    const leafKey = `${dotPath}-${idx}`;
    const ie = editingField === leafKey; const ed = editedFields[leafKey];
    const cid = `leaf-${dotPath}-${idx}`;
    if (ie) return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className="edit-field-container">
          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveObjectLeaf(record, rootField, path, idx, sid, editValue.trim()); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            autoFocus rows={1} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => saveObjectLeaf(record, rootField, path, idx, sid, editValue.trim())} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(leafValueString); }}>
          <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(leafValueString, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* OBJECT NODE (recursive) */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  /* OBJECT FIELD (top-level object: results, otherStaging) */
  const renderObjectField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, title, flattenSearchable(val), [fn])) return null;
    return renderSection(record, idx, sid, title, (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    ));
  };

  /* RECOMMENDATIONS (array of {recommendation, date}) — date-grouped */
  const saveRecommendation = useCallback((record, fn, idx, rIdx, newText) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerStaging] Cannot save recommendation — no record ID'); return; }
    const cur = getFieldValue(record, fn, idx);
    const arr = Array.isArray(cur) ? cur : [];
    const newArr = arr.map((r, i) => i === rIdx ? { ...r, recommendation: newText } : { ...r });
    // Stage the full updated array as a DRAFT (no DB write). Approve commits field=fn, value=array.
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newArr }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-r${rIdx}`]: 'edited' }));
    setApprovedSections(prev => { const key = `recommendations-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = newArr;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [getFieldValue]);

  const renderRecommendationsField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    if (recs.length === 0) return null;
    if (!shouldShowSection(record, title, flattenSearchable(recs), [fn])) return null;
    const groups = [];
    recs.forEach((rec, rIdx) => { const d = (rec?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push({ rec, rIdx }); else groups.push({ date: d, items: [{ rec, rIdx }] }); });
    return renderSection(record, idx, sid, title, (
      <div className="rec-mini-card">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="nested-mini-card">
            {group.date && <div className="nested-subtitle sub-label">{highlightText(group.date)}</div>}
            {group.items.map(({ rec, rIdx }) => {
              const recText = (rec?.recommendation || '').trim();
              const itemKey = `${fn}-${idx}-r${rIdx}`;
              const ie = editingField === itemKey; const ed = editedFields[itemKey]; const cid = `rec-${fn}-${idx}-${rIdx}`;
              if (ie) return (
                <div key={rIdx} className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveRecommendation(record, fn, idx, rIdx, editValue.trim()); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                    autoFocus rows={2} disabled={saving} />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveRecommendation(record, fn, idx, rIdx, editValue.trim())} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              );
              return (
                <div key={rIdx}>
                  <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(itemKey); setEditValue(recText); }}>
                    <div className="row-content"><span className="content-value">{highlightText(recText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                    <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(recText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
                  </div>
                  {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    ));
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const parts = key.split('-');
        const ri = parseInt(parts[parts.length - 1], 10);
        if (ri !== idx) return;
        const dotPath = parts.slice(0, -1).join('-');
        if (dotPath.includes('.')) {
          const dp = dotPath.split('.');
          let obj = m;
          for (let i = 0; i < dp.length - 1; i++) { if (!obj[dp[i]]) obj[dp[i]] = {}; obj = obj[dp[i]]; }
          obj[dp[dp.length - 1]] = localEdits[key];
        } else if (dotPath in record) { m[dotPath] = localEdits[key]; }
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = {
    tnm: 'TNM STAGING', otherStaging: 'OTHER STAGING SYSTEMS',
    findings: 'FINDINGS', clinical: 'CLINICAL ASSESSMENT', plan: 'PLAN',
    results: 'RESULTS', recommendations: 'RECOMMENDATIONS',
    providerInfo: 'PROVIDER INFORMATION', notes: 'NOTES',
  };
  const objectCopyLines = (val, indent = '') => {
    let out = '';
    Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
      if (isScalar(v)) out += `${indent}${humanizeKey(k)}: ${fmtScalar(v)}\n`;
      else { out += `${indent}${humanizeKey(k)}\n`; out += objectCopyLines(v, indent + '  '); }
    });
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (dp, label) => { const v = dp.includes('.') ? getNestedVal(pr, dp) : pr[dp]; if (hasVal(v)) text += `${label}: ${fmtVal(v)}\n`; };
    const sentFs = (fn) => { const sents = splitBySentence(fmtVal(pr[fn] || '')); sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
    if (sid === 'tnm') { addF('tnmStaging.overallStage', 'Overall Stage'); addF('tnmStaging.t', 'T (Tumor)'); addF('tnmStaging.n', 'N (Nodes)'); addF('tnmStaging.m', 'M (Metastasis)'); }
    else if (sid === 'otherStaging') { ['issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo'].forEach(f => addF(f, FIELD_LABELS[f])); if (hasVal(pr.otherStaging) && !isScalar(pr.otherStaging)) text += objectCopyLines(pr.otherStaging); }
    else if (sid === 'findings') { sentFs('findings'); }
    else if (sid === 'clinical') { sentFs('assessment'); }
    else if (sid === 'plan') { sentFs('plan'); }
    else if (sid === 'results') { if (hasVal(pr.results) && !isScalar(pr.results)) text += objectCopyLines(pr.results); }
    else if (sid === 'recommendations') { (Array.isArray(pr.recommendations) ? pr.recommendations : []).filter(r => !isEmptyDeep(r)).forEach((r, i) => { const rt = (r?.recommendation || '').trim(); const rd = (r?.date || '').trim(); if (rt) text += `${i + 1}. ${rt}${rd ? ` (${rd})` : ''}\n`; }); }
    else if (sid === 'providerInfo') { if (hasVal(pr.date)) text += `Date: ${formatDate(pr.date)}\n`; ['provider', 'facility', 'status'].forEach(f => addF(f, FIELD_LABELS[f])); }
    else if (sid === 'notes') { sentFs('notes'); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CANCER STAGING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cancer Staging ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const addF = (dp, label) => { const v = dp.includes('.') ? getNestedVal(r, dp) : r[dp]; if (hasVal(v)) text += `${label}: ${fmtVal(v)}\n`; };
      const sentFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; splitBySentence(fmtVal(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } };
      const tnm = r.tnmStaging || {};
      if (hasVal(tnm.overallStage) || hasVal(tnm.t) || hasVal(tnm.n) || hasVal(tnm.m)) {
        text += '\nTNM STAGING\n'; addF('tnmStaging.overallStage', 'Overall Stage'); addF('tnmStaging.t', 'T'); addF('tnmStaging.n', 'N'); addF('tnmStaging.m', 'M');
      }
      const otherFs = ['issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo'].filter(f => hasVal(r[f]));
      const hasOtherObj = hasVal(r.otherStaging) && !isScalar(r.otherStaging);
      if (otherFs.length || hasOtherObj) { text += '\nOTHER STAGING SYSTEMS\n'; otherFs.forEach(f => addF(f, FIELD_LABELS[f])); if (hasOtherObj) text += objectCopyLines(r.otherStaging); }
      sentFs('FINDINGS', 'findings'); sentFs('CLINICAL ASSESSMENT', 'assessment'); sentFs('PLAN', 'plan');
      if (hasVal(r.results) && !isScalar(r.results)) { text += '\nRESULTS\n'; text += objectCopyLines(r.results); }
      const recs = (Array.isArray(r.recommendations) ? r.recommendations : []).filter(rec => !isEmptyDeep(rec));
      if (recs.length) { text += '\nRECOMMENDATIONS\n'; recs.forEach((rec, i) => { const rt = (rec?.recommendation || '').trim(); const rd = (rec?.date || '').trim(); if (rt) text += `${i + 1}. ${rt}${rd ? ` (${rd})` : ''}\n`; }); }
      if (hasVal(r.provider) || hasVal(r.facility)) { text += '\nPROVIDER INFORMATION\n'; addF('provider', 'Provider'); addF('facility', 'Facility'); addF('status', 'Status'); }
      sentFs('NOTES', 'notes');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, <>{visibleFields.map(f => <React.Fragment key={f}>{DATE_FIELDS.includes(f) ? renderDateField(record, f, FIELD_LABELS[f] || f, idx, sid) : renderEditableField(record, f, FIELD_LABELS[f] || f, idx, sid)}</React.Fragment>)}</>);
  };

  if (!filteredRecords || filteredRecords.length === 0) return (
    <article className="cancer-staging-document">
      <header className="document-header"><h1 className="document-title">Cancer Staging</h1></header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="empty-state">No data available.</div>
    </article>
  );

  return (
    <article className="cancer-staging-document">
      <header className="document-header">
        <h1 className="document-title">Cancer Staging</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CancerStagingDocumentPDFTemplate document={pdfData} />} fileName="Cancer_Staging.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.tnmStaging?.overallStage && <span className="stage-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}>{highlightText(record.tnmStaging.overallStage)}</span>}
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cancer Staging ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'tnm', 'TNM Staging', SECTION_FIELDS.tnm)}
            {renderMultiFieldSection(record, idx, 'otherStaging', 'Other Staging Systems', ['issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo'])}
            {renderObjectField(record, 'otherStaging', idx, 'otherStaging', 'Other Staging')}
            {renderSentenceSplitSection(record, idx, 'findings', 'Findings', 'findings')}
            {renderSentenceSplitSection(record, idx, 'clinical', 'Clinical Assessment', 'assessment')}
            {renderSentenceSplitSection(record, idx, 'plan', 'Plan', 'plan')}
            {renderObjectField(record, 'results', idx, 'results', 'Results')}
            {renderRecommendationsField(record, 'recommendations', idx, 'recommendations', 'Recommendations')}
            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['date', 'provider', 'facility', 'status'])}
            {renderSentenceSplitSection(record, idx, 'notes', 'Notes', 'notes')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CancerStagingDocument;
