/**
 * BarriersPsychosocialIssuesDocument.jsx
 * Inline editing with per-section approve, per-row copy,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BarriersPsychosocialIssuesDocumentPDFTemplate from '../pdf-templates/BarriersPsychosocialIssuesDocumentPDFTemplate';
import './BarriersPsychosocialIssuesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the trailing "-<idx>") */
const DRAFT_KEY = 'barriers_psychosocial_issuesPendingEdits';
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
  recordInfo: ['provider', 'facility'],
  barrierInfo: ['barrierType', 'description'],
  impact: ['impactOnCare', 'financialConcerns', 'transportationIssues', 'housingStability', 'foodInsecurity'],
  socialMental: ['socialSupport', 'mentalHealth', 'substanceUse', 'literacyLanguage'],
  interventions: ['interventions'],
  resourcesProvided: ['resourcesProvided'],
  support: ['socialWorker'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility', barrierType: 'Barrier Type',
  description: 'Description', impactOnCare: 'Impact on Care',
  financialConcerns: 'Financial Concerns', transportationIssues: 'Transportation Issues',
  housingStability: 'Housing Stability', foodInsecurity: 'Food Insecurity',
  socialSupport: 'Social Support', mentalHealth: 'Mental Health',
  substanceUse: 'Substance Use', literacyLanguage: 'Literacy/Language',
  interventions: 'Interventions', resourcesProvided: 'Resources Provided',
  socialWorker: 'Social Worker', notes: 'Notes',
};

const ARRAY_FIELDS = ['interventions', 'resourcesProvided'];
// Fields the user wants comma-split into one row per item (genuine lists). NOT barrierType / provider
// "Dr. Jennifer Chang, MD, PhD" / socialWorker / notes — those commas are grammar/credentials (Rule #70).
const COMMA_SPLIT_FIELDS = ['description', 'impactOnCare', 'financialConcerns', 'socialSupport', 'mentalHealth'];
// Paren-aware comma splitter: a depth-0 ',' separates items UNLESS inside parens, between two digits
// ("1,500"), before a 4-digit year, or before whole-word "and"/"or" (Oxford tail). items.join(', ') round-trips.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const prev = text[i - 1] || '', nx = text[i + 1] || '';
      const rest = text.slice(i + 1).trimStart();
      if ((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};
// A single sentence "Label: value" → {isLabeled,label,value}. ':\s+' (space after colon) avoids matching
// times/ratios ("5:30"); the {1,80} cap stops a long sentence with a deep colon from false-matching.
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };

const BarriersPsychosocialIssuesDocument = ({ document: rawDoc }) => {
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
      if (r?.barriers_psychosocial_issues) return Array.isArray(r.barriers_psychosocial_issues) ? r.barriers_psychosocial_issues : [r.barriers_psychosocial_issues];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.barriers_psychosocial_issues) return Array.isArray(dd.barriers_psychosocial_issues) ? dd.barriers_psychosocial_issues : [dd.barriers_psychosocial_issues]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const getRid = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = getRid(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart "field" → editKey "field-idx"; "field.arrayIndex" → editKey "field-idx-arrayIndex"
        const dotIdx = fieldPart.indexOf('.');
        const editKey = dotIdx === -1
          ? `${fieldPart}-${idx}`
          : `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  // Abbreviation-safe: do NOT split after Dr./Mr./St./etc. (so "Dr. Jennifer Chang, MD, PhD" stays one unit).
  const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; }); };

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const orig = Array.isArray(record[fn]) ? [...record[fn]] : []; return orig.map((item, ii) => { const ek = `${fn}-${idx}-${ii}`; return localEdits[ek] !== undefined ? localEdits[ek] : item; }); }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BarriersPsychosocial] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // fieldPart = editKey without the trailing "-<idx>" (reversed in handleApproveSection)
    const fieldPart = ek.slice(0, -`-${idx}`.length);
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = nv;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a DRAFT locally (no DB write). Committed only on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, itemIdx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BarriersPsychosocial] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${itemIdx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // fieldPart = "field.arrayIndex" so rehydrate/approve can reverse it
    const fieldPart = `${fn}.${itemIdx}`;
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record's pending edits for this section's fields.
      // editKey "field-idx" → field only; editKey "field-idx-arrayIndex" → field + arrayIndex (numeric trailing segment).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      for (const editKey of toCommit) {
        // Find which section field this key belongs to, then parse any trailing numeric arrayIndex.
        const f = sf.find(ff => editKey === `${ff}-${idx}` || editKey.startsWith(`${ff}-${idx}-`));
        const payload = { field: f, value: localEdits[editKey] };
        const rest = editKey.slice(`${f}-${idx}`.length); // '' or '-<arrayIndex>'
        if (rest.startsWith('-') && /^\d+$/.test(rest.slice(1))) payload.arrayIndex = parseInt(rest.slice(1), 10);
        const resp = await sc.put(`/api/edit/barriers_psychosocial_issues/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/barriers_psychosocial_issues/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          const f = sf.find(ff => editKey === `${ff}-${idx}` || editKey.startsWith(`${ff}-${idx}-`));
          const rest = editKey.slice(`${f}-${idx}`.length);
          const fieldPart = rest.startsWith('-') && /^\d+$/.test(rest.slice(1)) ? `${f}.${rest.slice(1)}` : f;
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BarriersPsychosocial] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  function reconstructFullText(ss) { return ss.map((s, i) => { const t = s.trim(); if (i < ss.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }
  function saveSentence(record, fn, idx, sid, sIdx, newText) {
    const cur = String(getFieldValue(record, fn, idx) || ''); const cs = splitBySentence(cur);
    const cn = newText.trim(); const co = (cs[sIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn || cn.replace(/[.!?;,]+/g, '').trim() === '') {
      cs.splice(sIdx, 1);
      setEditedSentences(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { const m = k.match(new RegExp(`^${fn}-${idx}-s(\\d+)`)); if (m && parseInt(m[1], 10) >= sIdx) delete next[k]; }); return next; });
      handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`); return;
    }
    let nt = cn; if (nt && !nt.match(/[.!?;]$/)) nt += '.'; cs[sIdx] = nt;
    const ec = nt.split(/(?<=[.!?])\s+/).length - 1;
    setEditedSentences(prev => { const n = { ...prev, [`${fn}-${idx}-s${sIdx}`]: 'edited' }; for (let e = 1; e <= ec; e++) n[`${fn}-${idx}-s${sIdx + e}`] = 'added'; return n; });
    handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`);
  }

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [title, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Barriers & Psychosocial Issues ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.barrierType, record.description, record.impactOnCare, record.financialConcerns, record.socialSupport, record.mentalHealth, record.socialWorker, record.provider, record.facility, record.notes, ...(record.interventions || []), ...(record.resourcesProvided || []), ...Object.values(FIELD_LABELS), 'Record Information', 'Barrier Information', 'Impact & Concerns', 'Social & Mental Health', 'Interventions', 'Resources Provided', 'Support', 'Notes'].filter(Boolean).join(' ');
      const match = phraseMatch(allText, searchTerm);
      if (match && phraseMatch(title, searchTerm)) record._showAllSections = true;
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || ''); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fn] || fn}: ${dv}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const ss = splitBySentence(String(value)); if (ss.length === 0) return null; if (ss.length === 1 && !parseLabel(ss[0]).isLabeled) return renderEditableField(record, fn, idx, sid, hideLabel);
    const vis = ss.map((s, oi) => ({ text: s, _origIdx: oi })).filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text, _origIdx: sIdx }) => { const sk = `${fn}-${idx}-s${sIdx}`; const ie = editingField === sk; const es = editedSentences[sk]; const scid = `row-${fn}-${idx}-s${sIdx}`; const p = parseLabel(text);
      if (ie) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={sIdx} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(text.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(p.isLabeled ? p.value : text)}</span>{!es && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === scid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, scid); }}>{copiedId === scid ? 'Copied' : 'Copy'}</button></div>{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
  };

  // Comma-split a genuine-list field into one editable row per item. Editing an item (type commas to add
  // more, clear to delete) re-splits the CURRENT value, replaces that item, rejoins ', ' → lossless.
  const saveCommaItem = (record, fn, idx, sid, ciIdx, newText) => {
    const items = splitByComma(String(getFieldValue(record, fn, idx) || ''));
    const edited = splitByComma(newText);
    if (edited.length === 0) items.splice(ciIdx, 1); else items.splice(ciIdx, 1, ...edited);
    handleSaveField(record, fn, idx, sid, null, items.join(', '), `${fn}-${idx}`);
  };
  const renderCommaField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const items = splitByComma(String(value || '')); if (items.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const ed = editedFields[`${fn}-${idx}`];
    const vis = items.map((t, ci) => ({ t, ci })).filter(({ t }) => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; return phraseMatch(t, searchTerm); });
    if (vis.length === 0) return null;
    return (<div className="rec-mini-card">{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}{vis.map(({ t, ci }) => { const ck = `${fn}-${idx}-c${ci}`; const ie = editingField === ck; const cid = `row-${fn}-${idx}-c${ci}`;
      if (ie) return (<div key={ci} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, ci, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveCommaItem(record, fn, idx, sid, ci, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<div key={ci} className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(t); }}><div className="row-content"><span className="content-value">{highlightText(t)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(t, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>);
    })}{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ii) => {
    const ek = `${fn}-${idx}-${ii}`; const dv = localEdits[ek] !== undefined ? localEdits[ek] : item; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}-${ii}`;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(FIELD_LABELS[fn] || fn) && !phraseMatch(dv, searchTerm)) return null;
    if (ie) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, ii, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, ii, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
    return (<React.Fragment key={ii}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(dv)); }}><div className="row-content"><span className="content-value">{highlightText(String(dv))}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(dv), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && !ARRAY_FIELDS.includes(fn) && fn in record) m[fn] = localEdits[key]; });
      // Array fields: apply committed (non-pending) element edits only; pending drafts stay OUT of the PDF until approved.
      ARRAY_FIELDS.forEach(f => {
        const orig = Array.isArray(record[f]) ? [...record[f]] : [];
        m[f] = orig.map((item, ii) => { const ek = `${f}-${idx}-${ii}`; return (localEdits[ek] !== undefined && !pendingEdits[ek]) ? localEdits[ek] : item; });
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  // Copy a sentence field nested (mirrors the JSX nested-subtitle): labeled sentence → "  Label:\n    value",
  // plain sentence → "  sentence"; a single unlabeled value stays "Label: value".
  const formatSentenceField = (label, value) => {
    const ss = splitBySentence(String(value));
    if (ss.length > 1 || (ss.length === 1 && parseLabel(ss[0]).isLabeled)) {
      let t = `${label}:\n`;
      ss.forEach((s) => { const p = parseLabel(s); t += p.isLabeled ? `  ${p.label}:\n    ${p.value}\n` : `  ${s}\n`; });
      return t;
    }
    return `${label}:\n  ${value}\n`;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; const fs = SECTION_FIELDS[sid] || []; let text = '';
    fs.forEach(f => { const l = FIELD_LABELS[f] || f; if (ARRAY_FIELDS.includes(f)) { const arr = getEffectiveArray(record, f, idx); if (arr.length > 0) { text += `${l}:\n`; arr.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } } else if (COMMA_SPLIT_FIELDS.includes(f)) { const v = pr[f]; if (!v) return; const items = splitByComma(String(v)); if (items.length > 1) { text += `${l}:\n`; items.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } else text += `${l}:\n  ${v}\n`; } else { const v = pr[f]; if (v) text += formatSentenceField(l, v); } });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BARRIERS & PSYCHOSOCIAL ISSUES ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Barriers & Psychosocial Issues ${idx + 1}\n`; if (r.date) text += `Date: ${formatDate(r.date)}\n\n`;
      Object.entries(SECTION_FIELDS).forEach(([, fs]) => { fs.forEach(f => { const l = FIELD_LABELS[f] || f; if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(r[f]) ? r[f] : []; if (arr.length > 0) { text += `${l}:\n`; arr.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } } else if (COMMA_SPLIT_FIELDS.includes(f)) { const v = r[f]; if (!v) return; const items = splitByComma(String(v)); if (items.length > 1) { text += `${l}:\n`; items.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } else text += `${l}:\n  ${v}\n`; } else { const v = r[f]; if (v) text += formatSentenceField(l, v); } }); });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return (<article className="barriers-psychosocial-issues-document"><header className="document-header"><h1 className="document-title">Barriers & Psychosocial Issues</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);
  }

  return (
    <article className="barriers-psychosocial-issues-document">
      <header className="document-header">
        <h1 className="document-title">Barriers & Psychosocial Issues</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BarriersPsychosocialIssuesDocumentPDFTemplate document={pdfData} />} fileName="Barriers_Psychosocial_Issues.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Barriers & Psychosocial Issues ${idx + 1}`)}</h3></div>
            </div>

            {(() => { const hd = [record.provider, record.facility].some(v => v && String(v).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Record Information', [record.provider, record.facility].filter(Boolean), ['provider', 'facility'])) return null; const stm = sectionTitleMatches('Record Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'recordInfo', 'Record Information', <>{(sa || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'recordInfo')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}</>); })()}

            {(() => { if (!shouldShowSection(record, 'Barrier Information', [record.barrierType, record.description].filter(Boolean), ['barrierType', 'description'])) return null; const stm = sectionTitleMatches('Barrier Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'barrierInfo', 'Barrier Information', <>{(sa || fieldMatches(record, 'barrierType', idx)) && renderEditableField(record, 'barrierType', idx, 'barrierInfo')}{(sa || fieldMatches(record, 'description', idx)) && renderCommaField(record, 'description', idx, 'barrierInfo')}</>); })()}

            {(() => { const fields = ['impactOnCare', 'financialConcerns', 'transportationIssues', 'housingStability', 'foodInsecurity']; const hd = fields.some(f => record[f] && String(record[f]).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Impact & Concerns', fields.map(f => record[f]).filter(Boolean), fields)) return null; const stm = sectionTitleMatches('Impact & Concerns'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'impact', 'Impact & Concerns', <>{fields.map(f => (sa || fieldMatches(record, f, idx)) ? (COMMA_SPLIT_FIELDS.includes(f) ? renderCommaField(record, f, idx, 'impact') : renderSentenceEditableField(record, f, idx, 'impact')) : null)}</>); })()}

            {(() => { const fields = ['socialSupport', 'mentalHealth', 'substanceUse', 'literacyLanguage']; const hd = fields.some(f => record[f] && String(record[f]).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Social & Mental Health', fields.map(f => record[f]).filter(Boolean), fields)) return null; const stm = sectionTitleMatches('Social & Mental Health'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'socialMental', 'Social & Mental Health', <>{fields.map(f => (sa || fieldMatches(record, f, idx)) ? (COMMA_SPLIT_FIELDS.includes(f) ? renderCommaField(record, f, idx, 'socialMental') : renderSentenceEditableField(record, f, idx, 'socialMental')) : null)}</>); })()}

            {(() => { const arr = getEffectiveArray(record, 'interventions', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Interventions', arr, ['interventions'])) return null; return renderSection(record, idx, 'interventions', 'Interventions', arr.map((it, ii) => renderEditableArrayItem(record, 'interventions', idx, 'interventions', it, ii))); })()}

            {(() => { const arr = getEffectiveArray(record, 'resourcesProvided', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Resources Provided', arr, ['resourcesProvided'])) return null; return renderSection(record, idx, 'resourcesProvided', 'Resources Provided', arr.map((it, ii) => renderEditableArrayItem(record, 'resourcesProvided', idx, 'resourcesProvided', it, ii))); })()}

            {getFieldValue(record, 'socialWorker', idx) && shouldShowSection(record, 'Support', [getFieldValue(record, 'socialWorker', idx)], ['socialWorker']) && renderSection(record, idx, 'support', 'Support', renderEditableField(record, 'socialWorker', idx, 'support', true))}

            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BarriersPsychosocialIssuesDocument;
