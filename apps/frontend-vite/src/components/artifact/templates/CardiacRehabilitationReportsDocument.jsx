/**
 * CardiacRehabilitationReportsDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Sentence-split for findings, goals, recommendations.
 * Collection: cardiac_rehabilitation_reports
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiacRehabilitationReportsDocumentPDFTemplate from '../pdf-templates/CardiacRehabilitationReportsDocumentPDFTemplate';
import './CardiacRehabilitationReportsDocument.css';

const SECTION_FIELDS = {
  program: ['programType'],
  findings: ['findings'],
  goals: ['goals'],
  recommendations: ['recommendations'],
  progress: ['progress'],
  followUp: ['followUp'],
};
const FIELD_LABELS = { programType: 'Program Type', findings: 'Findings', goals: 'Goals', recommendations: 'Recommendations', progress: 'Progress', followUp: 'Follow-Up' };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()%,-]{0,49}?):\s*(.+)$/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Split a list on ", " (comma+space) only — parenthesis-aware, so "1,500" (no space) and "(a, b)" stay intact.
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] || '')) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiac_rehabilitation_reportsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CardiacRehabilitationReportsDocument = ({ document: rawDoc }) => {
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
      if (r?.cardiac_rehabilitation_reports) return Array.isArray(r.cardiac_rehabilitation_reports) ? r.cardiac_rehabilitation_reports : [r.cardiac_rehabilitation_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_rehabilitation_reports) return Array.isArray(dd.cardiac_rehabilitation_reports) ? dd.cardiac_rehabilitation_reports : [dd.cardiac_rehabilitation_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordIdStatic = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordIdStatic(record);
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
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacRehab] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Collect this record's pending edits for the section's fields (editKey = "field-idx")
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return sf.includes(baseField);
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await sc.put(`/api/edit/cardiac_rehabilitation_reports/${rid}/edit`, payload);
      }
      // Flag the record/section approved (audit trail)
      await sc.put(`/api/edit/cardiac_rehabilitation_reports/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => { const fieldPart = editKey.slice(0, -suffix.length); const lastDot = fieldPart.lastIndexOf('.'); const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart; delete store[rid][baseField]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CardiacRehab] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  // Save one sentence = stage a DRAFT locally (splice it back into the full text) + write to the
  // pending-drafts localStorage store (survives refresh). NOT written to MongoDB and NOT shown in
  // the PDF until the user clicks Approve (handleApproveSection commits).
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacRehab] Cannot save — no record ID'); return; }
    const currentVal = fmtVal(getFieldValue(record, fn, idx)); const currentSentences = splitBySentence(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') { currentSentences.splice(sentenceIdx, 1); }
    else { const cleanOld = (currentSentences[sentenceIdx] || '').trim(); if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; } currentSentences[sentenceIdx] = cleanNew; }
    const fullText = reconstructFullText(currentSentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: fullText }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    const newSentences = splitBySentence(fullText); const originalCount = splitBySentence(fmtVal(record[fn])).length;
    const extraCount = newSentences.length - originalCount;
    setEditedFields(prev => { const n = { ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; });
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
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
      const title = `Cardiac Rehabilitation Report ${idx + 1}`;
      const allText = [title, formatDate(record.assessmentDate), record.programType, record.findings, record.goals, record.recommendations, record.progress, record.followUp, ...Object.values(FIELD_LABELS), 'Program', 'Findings', 'Goals', 'Recommendations', 'Progress', 'Follow-Up'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx); if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
        const parts = splitByComma(sent); const multi = parts.length >= 2;   // comma-list → one editable row per item

        // MULTI: each comma part is its OWN editable row; saving splices the edited part back into the sentence.
        if (multi) return (<div key={si} className="rec-mini-card">{parts.map((part, pi) => {
          const pp = parseLabel(part); const pd = pp ? pp.content : part;
          const partKey = `${sentKey}-p${pi}`; const pie = editingField === partKey;
          const savePart = () => { const v = editValue.trim(); const np = v ? (pp ? `${pp.label}: ${v}` : v) : ''; const arr = parts.map((x, xi) => xi === pi ? np : x).filter(x => x && x.trim()); saveSentence(record, fieldName, idx, sid, si, arr.join(', ')); };
          if (pie) return (<div key={pi} className="rec-mini-card">{pp && <div className="nested-subtitle sub-label">{highlightText(pp.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={savePart} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
          return (<div key={pi} style={{ marginBottom: pi < parts.length - 1 ? 8 : 0 }}>{pp && <div className="nested-subtitle sub-label">{highlightText(pp.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(pd); }}><div className="row-content"><span className="content-value">{highlightText(pd)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `${cid}-${pi}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, `${cid}-${pi}`); }}>{copiedId === `${cid}-${pi}` ? 'Copied' : 'Copy'}</button></div></div>);
        })}{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);

        // SINGLE sentence: label content edited, label reconstructed on save.
        const ie = editingField === sentKey; const parsed = parseLabel(sent);
        const saveLbl = (label) => { saveSentence(record, fieldName, idx, sid, si, label ? `${label}: ${editValue}` : editValue); };
        if (ie) return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        const displayText = parsed ? parsed.content : sent;
        return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { program: 'PROGRAM', findings: 'FINDINGS', goals: 'GOALS', recommendations: 'RECOMMENDATIONS', progress: 'PROGRESS', followUp: 'FOLLOW-UP' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const sentFs = (fn) => { let n = 1; splitBySentence(fmtVal(pr[fn] || '')).forEach((sent) => { const parts = splitByComma(sent); const items = parts.length >= 2 ? parts : [sent]; items.forEach((part) => { const pp = parseLabel(part); if (pp) text += `\n${pp.label}\n------------------------------\n${n++}. ${pp.content}\n`; else text += `${n++}. ${part}\n`; }); }); };
    if (sid === 'program') { if (hasVal(pr.programType)) text += `Program Type: ${pr.programType}\n`; if (pr.assessmentDate) text += `Assessment Date: ${formatDate(pr.assessmentDate)}\n`; }
    else if (sid === 'findings') { sentFs('findings'); }
    else if (sid === 'goals') { sentFs('goals'); }
    else if (sid === 'recommendations') { sentFs('recommendations'); }
    else if (sid === 'progress') { if (hasVal(pr.progress)) text += `${pr.progress}\n`; }
    else if (sid === 'followUp') { if (hasVal(pr.followUp)) text += `${pr.followUp}\n`; }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIAC REHABILITATION REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiac Rehabilitation Report ${idx + 1}\n`;
      if (r.assessmentDate) text += `${formatDate(r.assessmentDate)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn]}: ${fmtVal(r[fn])}\n`; };
      const sentFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; let n = 1; splitBySentence(fmtVal(r[fn])).forEach((sent) => { const parts = splitByComma(sent); const items = parts.length >= 2 ? parts : [sent]; items.forEach((part) => { const pp = parseLabel(part); if (pp) text += `\n${pp.label}\n------------------------------\n${n++}. ${pp.content}\n`; else text += `${n++}. ${part}\n`; }); }); } };
      if (hasVal(r.programType)) { text += '\nPROGRAM\n'; addF('programType'); }
      sentFs('FINDINGS', 'findings');
      sentFs('GOALS', 'goals');
      sentFs('RECOMMENDATIONS', 'recommendations');
      if (hasVal(r.progress)) { text += '\nPROGRESS\n'; addF('progress'); }
      if (hasVal(r.followUp)) { text += '\nFOLLOW-UP\n'; addF('followUp'); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cardiac-rehab-document"><header className="document-header"><h1 className="document-title">Cardiac Rehabilitation Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cardiac-rehab-document">
      <header className="document-header">
        <h1 className="document-title">Cardiac Rehabilitation Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiacRehabilitationReportsDocumentPDFTemplate document={pdfData} />} fileName="Cardiac_Rehabilitation_Reports.pdf">
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
                {record.assessmentDate && <span className="record-date">{highlightText(formatDate(record.assessmentDate))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiac Rehabilitation Report ${idx + 1}`)}</h3></div>
            </div>
            {hasVal(getFieldValue(record, 'programType', idx)) && shouldShowSection(record, 'Program', [fmtVal(getFieldValue(record, 'programType', idx))], ['programType']) &&
              renderSection(record, idx, 'program', 'Program', renderEditableField(record, 'programType', idx, 'program'))}
            {renderSentenceSplitSection(record, idx, 'findings', 'Findings', 'findings')}
            {renderSentenceSplitSection(record, idx, 'goals', 'Goals', 'goals')}
            {renderSentenceSplitSection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
            {renderSentenceSplitSection(record, idx, 'progress', 'Progress', 'progress')}
            {renderSentenceSplitSection(record, idx, 'followUp', 'Follow-Up', 'followUp')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiacRehabilitationReportsDocument;
