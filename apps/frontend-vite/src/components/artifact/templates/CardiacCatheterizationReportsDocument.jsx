/**
 * CardiacCatheterizationReportsDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Sentence-split for indication and recommendations.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Collection: cardiac_catheterization_reports
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiacCatheterizationReportsDocumentPDFTemplate from '../pdf-templates/CardiacCatheterizationReportsDocumentPDFTemplate';
import './CardiacCatheterizationReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiac_catheterization_reportsPendingEdits';
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
  procedure: ['indication', 'accessSite'],
  interventions: ['interventions'],
  complications: ['complications'],
  recommendations: ['recommendations'],
  cardiologist: ['cardiologist'],
};
const FIELD_LABELS = {
  indication: 'Indication', accessSite: 'Access Site',
  recommendations: 'Recommendations', cardiologist: 'Cardiologist',
};
const ARRAY_FIELDS = ['interventions', 'complications'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const objToText = (v, prefix = '') => { if (!hasVal(v)) return ''; if (Array.isArray(v)) return v.filter(hasVal).map(item => objToText(item, prefix)).filter(Boolean).join('\n'); if (typeof v === 'object') return Object.entries(v).filter(([, sv]) => hasVal(sv)).map(([sk, sv]) => objToText(sv, prefix ? `${prefix} / ${sk}` : sk)).filter(Boolean).join('\n'); return `${prefix ? prefix + ': ' : ''}${fmtVal(v)}`; };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };

const CardiacCatheterizationReportsDocument = ({ document: rawDoc }) => {
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
      if (r?.cardiac_catheterization_reports) return Array.isArray(r.cardiac_catheterization_reports) ? r.cardiac_catheterization_reports : [r.cardiac_catheterization_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_catheterization_reports) return Array.isArray(dd.cardiac_catheterization_reports) ? dd.cardiac_catheterization_reports : [dd.cardiac_catheterization_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid ? id.$oid : String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrayItem) {
          const fn = fieldPart.slice(0, dotIdx);
          const ai = fieldPart.slice(dotIdx + 1);
          const editKey = `${fn}-${idx}-${ai}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacCath] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a DRAFT locally (array element). No DB write until Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacCath] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record+section's staged edits from localEdits using the editKey conventions:
      //   field/sentence: "field-idx"   |   array element: "field-idx-arrayIndex"
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const parts = k.split('-');
        // parts: [field, idx] or [field, idx, arrayIndex]
        if (parts.length < 2) return false;
        const fn = parts[0];
        const keyIdx = parseInt(parts[1], 10);
        if (keyIdx !== idx) return false;
        return sf.includes(fn);
      });
      for (const editKey of toCommit) {
        const parts = editKey.split('-');
        const fn = parts[0];
        const payload = { field: fn, value: localEdits[editKey] };
        // arrayIndex only when the trailing segment is purely numeric (array element edit)
        if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
          payload.arrayIndex = parseInt(parts[parts.length - 1], 10);
        }
        await sc.put(`/api/edit/cardiac_catheterization_reports/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/cardiac_catheterization_reports/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage (only the section's fields)
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => {
          delete store[rid][f];
          Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; });
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CardiacCath] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  // Save one sentence = stage a DRAFT locally (splice it back into the full text). No DB write until Approve.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacCath] Cannot save — no record ID'); return; }
    const currentVal = fmtVal(getFieldValue(record, fn, idx));
    const currentSentences = splitBySentence(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') { currentSentences.splice(sentenceIdx, 1); }
    else { const cleanOld = (currentSentences[sentenceIdx] || '').trim(); if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; } currentSentences[sentenceIdx] = cleanNew; }
    const fullText = reconstructFullText(currentSentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: fullText }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    const newSentences = splitBySentence(fullText);
    const originalCount = splitBySentence(fmtVal(record[fn])).length;
    setEditedFields(prev => { const n = { ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let ei = originalCount; ei < newSentences.length; ei++) { n[`${fn}-${idx}-s${ei}`] = 'added'; } return n; });
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cardiac Catheterization Report ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.indication, record.accessSite, record.recommendations, record.cardiologist, ...(Array.isArray(record.interventions) ? record.interventions : []), ...(Array.isArray(record.complications) ? record.complications : []), objToText(record.findings), objToText(record.coronaryAnatomy), objToText(record.hemodynamics), ...Object.values(FIELD_LABELS), 'Procedure Information', 'Findings', 'Coronary Anatomy', 'Hemodynamics', 'Interventions', 'Complications', 'Recommendations', 'Cardiologist'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {   // hideLabel: skip the nested-subtitle when the field label duplicates the section title
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'indication' ? 3 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx);
    if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw));
    if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
        const parsed = parseLabel(sent);
        const saveLbl = (label) => { saveSentence(record, fieldName, idx, sid, si, label ? `${label}: ${editValue}` : editValue); };
        if (ie) return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        const displayText = parsed ? parsed.content : sent;
        return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  /* Recursively render a single object value (handles nested dynamic-key objects like findings.LAD). */
  const renderObjectValue = (v, keyPrefix, depth = 0) => {
    if (Array.isArray(v)) {
      return v.filter(hasVal).map((item, i) => <div key={i}>{renderObjectValue(item, `${keyPrefix}-${i}`, depth)}</div>);
    }
    if (v && typeof v === 'object') {
      return Object.entries(v).filter(([, sv]) => hasVal(sv)).map(([sk, sv], i) => (
        <div key={i} className={depth > 0 ? 'nested-subtitle-sub' : ''}>
          <div className={depth > 0 ? 'nested-subtitle nested-subtitle-deep' : 'nested-subtitle'}>{highlightText(sk)}</div>
          {renderObjectValue(sv, `${keyPrefix}-${sk}`, depth + 1)}
        </div>
      ));
    }
    return <div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(fmtVal(v))}</span></div></div>;
  };

  /* Display-only object section (for findings, coronaryAnatomy, hemodynamics) */
  const renderObjectSection = (record, idx, sid, title, fieldName) => {
    const obj = record[fieldName];
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const entries = Object.entries(obj).filter(([_, v]) => hasVal(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, title, entries.map(([k, v]) => objToText(v, k)), [])) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { let t = `${title.toUpperCase()}\n`; entries.forEach(([k, v]) => { t += `${objToText(v, k)}\n`; }); copyToClipboard(t.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button></div></div>{entries.map(([k, v], i) => (<div key={i} className="rec-mini-card"><div className="nested-subtitle">{highlightText(k)}</div>{renderObjectValue(v, `${fieldName}-${idx}-${k}`)}</div>))}</div></div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-');
        if (ld === -1) return;
        const fn = key.substring(0, ld);
        const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: merge only NON-pending element edits
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => {
          const ek = `${field}-${idx}-${ai}`;
          if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek];
        });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { procedure: 'PROCEDURE INFORMATION', findings: 'FINDINGS', coronary: 'CORONARY ANATOMY', hemodynamics: 'HEMODYNAMICS', interventions: 'INTERVENTIONS', complications: 'COMPLICATIONS', recommendations: 'RECOMMENDATIONS', cardiologist: 'CARDIOLOGIST' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    if (sid === 'procedure') { if (hasVal(pr.indication)) text += `Indication: ${pr.indication}\n`; if (hasVal(pr.accessSite)) text += `Access Site: ${pr.accessSite}\n`; }
    else if (sid === 'interventions') { getEffectiveArray(pr, 'interventions', idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
    else if (sid === 'complications') { getEffectiveArray(pr, 'complications', idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
    else if (sid === 'recommendations') { splitBySentence(fmtVal(pr.recommendations || '')).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
    else if (sid === 'cardiologist') { if (hasVal(pr.cardiologist)) text += `${pr.cardiologist}\n`; }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIAC CATHETERIZATION REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiac Catheterization Report ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      if (hasVal(r.indication)) text += `\nINDICATION\n${r.indication}\n`;
      if (hasVal(r.accessSite)) text += `Access Site: ${r.accessSite}\n`;
      const ints = getEffectiveArray(r, 'interventions', idx); if (ints.length) { text += '\nINTERVENTIONS\n'; ints.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      const comps = getEffectiveArray(r, 'complications', idx); if (comps.length) { text += '\nCOMPLICATIONS\n'; comps.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      if (hasVal(r.recommendations)) { text += '\nRECOMMENDATIONS\n'; splitBySentence(fmtVal(r.recommendations)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
      if (hasVal(r.cardiologist)) text += `\nCardiologist: ${r.cardiologist}\n`;
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cardiac-cath-document"><header className="document-header"><h1 className="document-title">Cardiac Catheterization Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cardiac-cath-document">
      <header className="document-header">
        <h1 className="document-title">Cardiac Catheterization Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiacCatheterizationReportsDocumentPDFTemplate document={pdfData} />} fileName="Cardiac_Catheterization_Reports.pdf">
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
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiac Catheterization Report ${idx + 1}`)}</h3></div>
            </div>
            {renderSentenceSplitSection(record, idx, 'procedure', 'Indication', 'indication')}
            {hasVal(getFieldValue(record, 'accessSite', idx)) && shouldShowSection(record, 'Access Site', [fmtVal(getFieldValue(record, 'accessSite', idx))], ['accessSite']) &&
              renderSection(record, idx, 'procedure', 'Access Site', renderEditableField(record, 'accessSite', idx, 'procedure', true))}
            {renderObjectSection(record, idx, 'findings', 'Findings', 'findings')}
            {renderObjectSection(record, idx, 'coronary', 'Coronary Anatomy', 'coronaryAnatomy')}
            {renderObjectSection(record, idx, 'hemodynamics', 'Hemodynamics', 'hemodynamics')}
            {renderArraySection(record, idx, 'interventions', 'Interventions', 'interventions')}
            {renderArraySection(record, idx, 'complications', 'Complications', 'complications')}
            {renderSentenceSplitSection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
            {hasVal(getFieldValue(record, 'cardiologist', idx)) && shouldShowSection(record, 'Cardiologist', [fmtVal(getFieldValue(record, 'cardiologist', idx))], ['cardiologist']) &&
              renderSection(record, idx, 'cardiologist', 'Cardiologist', renderEditableField(record, 'cardiologist', idx, 'cardiologist', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiacCatheterizationReportsDocument;
