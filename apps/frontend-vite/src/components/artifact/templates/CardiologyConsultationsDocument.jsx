/**
 * CardiologyConsultationsDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Sentence-split for narrative fields. Display-only recommendations array.
 * Collection: cardiology_consultations
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiologyConsultationsDocumentPDFTemplate from '../pdf-templates/CardiologyConsultationsDocumentPDFTemplate';
import './CardiologyConsultationsDocument.css';

const SECTION_FIELDS = {
  consultation: ['referralReason', 'referringProvider', 'chiefComplaint', 'urgency'],
  history: ['cardiologyHistory', 'cardiacRiskFactors'],
  diagnostics: ['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings'],
  assessment: ['cardiologyDiagnosis', 'riskStratification', 'nyhaClass'],
  medications: ['currentCardiacMedications', 'medicationsRecommended'],
  lifestyle: ['lifestyleModifications'],
  procedures: ['proceduresRecommended'],
  followUp: ['followUpPlan'],
};
const FIELD_LABELS = {
  referralReason: 'Referral Reason', referringProvider: 'Referring Provider', chiefComplaint: 'Chief Complaint', urgency: 'Urgency',
  cardiologyHistory: 'Cardiology History', cardiacRiskFactors: 'Cardiac Risk Factors',
  ecgFindings: 'ECG Findings', echoFindings: 'Echo Findings', stressTestResults: 'Stress Test',
  cathResults: 'Cath Results', holterFindings: 'Holter Findings', cardiacExamFindings: 'Cardiac Exam',
  cardiologyDiagnosis: 'Diagnosis', riskStratification: 'Risk Stratification', nyhaClass: 'NYHA Class',
  currentCardiacMedications: 'Current Medications', medicationsRecommended: 'Medications Recommended',
  lifestyleModifications: 'Lifestyle Modifications', proceduresRecommended: 'Procedures Recommended',
  followUpPlan: 'Follow-Up Plan',
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()₂%,-]{0,49}?):\s*(.+)$/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Split a list on ", " only — parenthesis-aware, so "V3-V6 (anterolateral leads)" and "0.5 mm" stay intact.
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] || '')) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };
// Diagnostics finding fields are comma-lists → split each into rows.
const COMMA_SPLIT_FIELDS = new Set(['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings']);
// Sentence-split sections that are actually comma-lists → also comma-split each sentence (parenthesis-aware).
const SECTION_COMMA_SPLIT = new Set(['medicationsRecommended', 'lifestyleModifications', 'followUpPlan']);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiology_consultationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CardiologyConsultationsDocument = ({ document: rawDoc }) => {
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
      if (r?.cardiology_consultations) return Array.isArray(r.cardiology_consultations) ? r.cardiology_consultations : [r.cardiology_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiology_consultations) return Array.isArray(dd.cardiology_consultations) ? dd.cardiology_consultations : [dd.cardiology_consultations]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nFields[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CardiologyConsult] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const suffix = `-${idx}`;
      const sf = SECTION_FIELDS[sid] || [];
      // Staged edits belonging to THIS record + THIS section
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        const lastSeg = fieldPart.includes('.') ? fieldPart.slice(fieldPart.lastIndexOf('.') + 1) : '';
        const field = /^\d+$/.test(lastSeg) ? baseField : fieldPart;
        return sf.includes(field);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const lastSeg = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const payload = { field: /^\d+$/.test(lastSeg) ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (/^\d+$/.test(lastSeg)) payload.arrayIndex = parseInt(lastSeg, 10);
        await sc.put(`/api/edit/cardiology_consultations/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/cardiology_consultations/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CardiologyConsult] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  // Save one sentence = stage a DRAFT locally + write it to the pending-drafts localStorage store.
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyConsult] Cannot save — no record ID'); return; }
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
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });
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
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cardiology Consultation ${idx + 1}`;
      const allText = [title, formatDate(record.consultDate), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...(Array.isArray(record.recommendations) ? record.recommendations.flatMap(r => [r.recommendation, formatDate(r.date)]) : []), ...Object.values(FIELD_LABELS), 'Consultation', 'History', 'Diagnostics', 'Assessment', 'Medications', 'Lifestyle', 'Recommendations', 'Follow-Up'].filter(Boolean).join(' ');
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
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'riskStratification' || fn === 'lifestyleModifications' || fn === 'followUpPlan' ? 4 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save a whole field value directly (comma-list part edits reconstruct the full comma-list). Stages a draft.
  const saveWholeField = (record, fn, idx, sid, value) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyConsult] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = value; writeDrafts(store);
    setEditingField(null); setEditValue('');
  };

  // Comma-list field → each comma part (parenthesis-aware) is its own editable row inside ONE mini-card.
  // commaOnly: split the WHOLE value by comma (no sentence split, so a typed period stays inside its part) and save
  // the reconstructed comma-list via saveWholeField. Otherwise split by sentence then comma (keeps multi-sentence
  // fields like ECG/Cardiac Exam) and save per-sentence via saveSentence. showFieldLabel=false when the section
  // title already shows the field name.
  const renderCommaSplitField = (record, fn, idx, sid, opts = {}) => {
    const { showFieldLabel = true, commaOnly = false } = opts;
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const rowFor = (part, pk, cid, onSave) => {
      const pp = parseLabel(part); const pd = pp ? pp.content : part; const pie = editingField === pk;
      if (pie) return (<div key={pk}>{pp && <div className="nested-subtitle sub-label">{highlightText(pp.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) onSave(pp); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => onSave(pp)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={pk}>{pp && <div className="nested-subtitle sub-label">{highlightText(pp.label)}</div>}<div className="numbered-row editable-row" onClick={() => { setEditingField(pk); setEditValue(pd); }}><div className="row-content"><span className="content-value">{highlightText(pd)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div></div>);
    };
    let rows, edited;
    if (commaOnly) {
      const parts = splitByComma(fmtVal(raw)); if (parts.length === 0) return null;
      edited = editedFields[`${fn}-${idx}`] === 'edited';
      rows = parts.map((part, pi) => rowFor(part, `${fn}-${idx}-p${pi}`, `cs-${fn}-${idx}-${pi}`, (pp) => { const v = editValue.trim(); const np = v ? (pp ? `${pp.label}: ${v}` : v) : ''; const arr = parts.map((x, xi) => xi === pi ? np : x).filter(x => x && x.trim()); saveWholeField(record, fn, idx, sid, arr.join(', ')); }));
    } else {
      const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
      edited = Object.keys(editedFields).some(k => k.startsWith(`${fn}-${idx}-s`) && (editedFields[k] === 'edited' || editedFields[k] === 'added'));
      rows = sentences.map((sent, si) => { const parts = splitByComma(sent); return parts.map((part, pi) => rowFor(part, `${fn}-${idx}-s${si}-p${pi}`, `cs-${fn}-${idx}-${si}-${pi}`, (pp) => { const v = editValue.trim(); const np = v ? (pp ? `${pp.label}: ${v}` : v) : ''; const arr = parts.map((x, xi) => xi === pi ? np : x).filter(x => x && x.trim()); saveSentence(record, fn, idx, sid, si, arr.join(', ')); })); });
    }
    return (<div className="rec-mini-card" key={fn}>{showFieldLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}{rows}{edited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx); if (!hasVal(raw)) return null;
    if (SECTION_COMMA_SPLIT.has(fieldName)) { if (!shouldShowSection(record, title, [fmtVal(raw)], [fieldName])) return null; return renderSection(record, idx, sid, title, renderCommaSplitField(record, fieldName, idx, sid, { showFieldLabel: false, commaOnly: true })); }
    const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
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

  const renderRecommendations = (record, idx) => {
    const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r?.recommendation) : [];
    if (recs.length === 0) return null;
    const allText = [...recs.map(r => r.recommendation), ...recs.map(r => formatDate(r.date))].filter(Boolean);
    if (!shouldShowSection(record, 'Recommendations', allText, [])) return null;
    // Group by date
    const groups = {};
    recs.forEach(r => { const d = r.date ? formatDate(r.date) : 'No Date'; if (!groups[d]) groups[d] = []; groups[d].push(r); });
    const stm = sectionTitleMatches('Recommendations');
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText('Recommendations')}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-recommendations-${idx}` ? ' copied' : ''}`} onClick={() => { let t = 'RECOMMENDATIONS\n'; Object.entries(groups).forEach(([date, items]) => { t += `${date}\n`; items.forEach((r, i) => { t += `${i + 1}. ${r.recommendation}\n`; }); }); copyToClipboard(t.trim(), `section-recommendations-${idx}`); }}>{copiedId === `section-recommendations-${idx}` ? 'Copied' : 'Copy Section'}</button></div></div>
      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(date)}</div>
          {items.map((rec, ri) => {
            if (!sa && !phraseMatch(rec.recommendation, searchTerm) && !phraseMatch(date, searchTerm)) return null;
            const cid = `rec-${idx}-${date}-${ri}`;
            return (
              <div key={ri} className="numbered-row" style={{ marginBottom: 6 }}>
                <div className="row-content"><span className="content-value">{highlightText(rec.recommendation)}</span></div>
                <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={() => copyToClipboard(rec.recommendation, cid)}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
              </div>
            );
          }).filter(Boolean)}
        </div>
      ))}
    </div></div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { consultation: 'CONSULTATION', history: 'HISTORY & RISK FACTORS', diagnostics: 'DIAGNOSTICS', assessment: 'ASSESSMENT', medications: 'MEDICATIONS', lifestyle: 'LIFESTYLE MODIFICATIONS', procedures: 'PROCEDURES', recommendations: 'RECOMMENDATIONS', followUp: 'FOLLOW-UP PLAN' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(pr[fn])}\n`; };
    const sentFs = (fn) => { splitBySentence(fmtVal(pr[fn] || '')).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
    const commaFs = (fn) => { let n = 1; splitBySentence(fmtVal(pr[fn] || '')).forEach((sent) => { splitByComma(sent).forEach((part) => { const pp = parseLabel(part); if (pp) text += `\n${pp.label}\n------------------------------\n${n++}. ${pp.content}\n`; else text += `${n++}. ${part}\n`; }); }); };
    if (sid === 'consultation') { ['referralReason', 'referringProvider', 'chiefComplaint', 'urgency'].forEach(addF); if (pr.consultDate) text += `Consult Date: ${formatDate(pr.consultDate)}\n`; }
    else if (sid === 'history') { sentFs('cardiologyHistory'); sentFs('cardiacRiskFactors'); }
    else if (sid === 'diagnostics') { ['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings'].forEach(f => { if (hasVal(pr[f])) { text += `${FIELD_LABELS[f]}:\n`; commaFs(f); } }); }
    else if (sid === 'assessment') { addF('cardiologyDiagnosis'); if (hasVal(pr.riskStratification)) { text += 'Risk Stratification:\n'; sentFs('riskStratification'); } addF('nyhaClass'); }
    else if (sid === 'medications') { ['currentCardiacMedications', 'medicationsRecommended'].forEach(f => { if (hasVal(pr[f])) { text += `${FIELD_LABELS[f]}:\n`; (SECTION_COMMA_SPLIT.has(f) ? commaFs : sentFs)(f); } }); }
    else if (sid === 'lifestyle') { commaFs('lifestyleModifications'); }
    else if (sid === 'procedures') { addF('proceduresRecommended'); }
    else if (sid === 'followUp') { commaFs('followUpPlan'); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIOLOGY CONSULTATIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiology Consultation ${idx + 1}\n`;
      if (r.consultDate) text += `${formatDate(r.consultDate)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn]}: ${fmtVal(r[fn])}\n`; };
      const sentFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; splitBySentence(fmtVal(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } };
      const commaFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; let n = 1; splitBySentence(fmtVal(r[fn])).forEach((sent) => { splitByComma(sent).forEach((part) => { const pp = parseLabel(part); if (pp) text += `\n${pp.label}\n------------------------------\n${n++}. ${pp.content}\n`; else text += `${n++}. ${part}\n`; }); }); } };
      if (hasVal(r.referralReason) || hasVal(r.referringProvider) || hasVal(r.chiefComplaint)) { text += '\nCONSULTATION\n'; addF('referralReason'); addF('referringProvider'); addF('chiefComplaint'); addF('urgency'); }
      sentFs('CARDIOLOGY HISTORY', 'cardiologyHistory'); sentFs('CARDIAC RISK FACTORS', 'cardiacRiskFactors');
      ['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings'].forEach(f => commaFs(FIELD_LABELS[f].toUpperCase(), f));
      if (hasVal(r.cardiologyDiagnosis)) { text += '\nASSESSMENT\n'; addF('cardiologyDiagnosis'); } sentFs('RISK STRATIFICATION', 'riskStratification');
      sentFs('CURRENT MEDICATIONS', 'currentCardiacMedications'); commaFs('MEDICATIONS RECOMMENDED', 'medicationsRecommended');
      commaFs('LIFESTYLE MODIFICATIONS', 'lifestyleModifications');
      if (Array.isArray(r.recommendations) && r.recommendations.length) { text += '\nRECOMMENDATIONS\n'; r.recommendations.forEach((rec, i) => { text += `${i + 1}. ${rec.recommendation}${rec.date ? ` (${formatDate(rec.date)})` : ''}\n`; }); }
      commaFs('FOLLOW-UP PLAN', 'followUpPlan');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{COMMA_SPLIT_FIELDS.has(f) ? renderCommaSplitField(record, f, idx, sid) : renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cardiology-consult-document"><header className="document-header"><h1 className="document-title">Cardiology Consultations</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cardiology-consult-document">
      <header className="document-header">
        <h1 className="document-title">Cardiology Consultations</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiologyConsultationsDocumentPDFTemplate document={pdfData} />} fileName="Cardiology_Consultations.pdf">
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
                {record.consultDate && <span className="record-date">{highlightText(formatDate(record.consultDate))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiology Consultation ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'consultation', 'Consultation', SECTION_FIELDS.consultation)}
            {renderSentenceSplitSection(record, idx, 'history', 'Cardiology History', 'cardiologyHistory')}
            {renderSentenceSplitSection(record, idx, 'history', 'Cardiac Risk Factors', 'cardiacRiskFactors')}
            {renderMultiFieldSection(record, idx, 'diagnostics', 'Diagnostics', SECTION_FIELDS.diagnostics)}
            {renderSentenceSplitSection(record, idx, 'assessment', 'Diagnosis', 'cardiologyDiagnosis')}
            {renderSentenceSplitSection(record, idx, 'assessment', 'Risk Stratification', 'riskStratification')}
            {renderSentenceSplitSection(record, idx, 'medications', 'Current Medications', 'currentCardiacMedications')}
            {renderSentenceSplitSection(record, idx, 'medications', 'Medications Recommended', 'medicationsRecommended')}
            {renderSentenceSplitSection(record, idx, 'lifestyle', 'Lifestyle Modifications', 'lifestyleModifications')}
            {hasVal(getFieldValue(record, 'proceduresRecommended', idx)) && shouldShowSection(record, 'Procedures', [fmtVal(getFieldValue(record, 'proceduresRecommended', idx))], ['proceduresRecommended']) && renderSection(record, idx, 'procedures', 'Procedures Recommended', renderEditableField(record, 'proceduresRecommended', idx, 'procedures'))}
            {renderRecommendations(record, idx)}
            {renderSentenceSplitSection(record, idx, 'followUp', 'Follow-Up Plan', 'followUpPlan')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiologyConsultationsDocument;
