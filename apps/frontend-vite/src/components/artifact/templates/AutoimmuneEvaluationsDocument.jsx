/**
 * AutoimmuneEvaluationsDocument.jsx
 * Inline editing with per-section approve, per-row copy,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AutoimmuneEvaluationsDocumentPDFTemplate from '../pdf-templates/AutoimmuneEvaluationsDocumentPDFTemplate';
import './AutoimmuneEvaluationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: value } }  (editKey is the file's own per-row key) */
const DRAFT_KEY = 'autoimmune_evaluationsPendingEdits';
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
  recordInfo: ['rheumatologist', 'facility'],
  clinicalInfo: ['suspectedCondition', 'diagnosis', 'diseaseActivity'],
  symptoms: ['symptoms'],
  physicalExam: ['physicalExam'],
  serology: ['serology'],
  inflammatoryMarkers: ['inflammatoryMarkers'],
  organInvolvement: ['organInvolvement'],
  imaging: ['imaging'],
  biopsy: ['biopsy'],
  treatment: ['treatment'],
  monitoring: ['monitoring'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  rheumatologist: 'Rheumatologist', facility: 'Facility',
  suspectedCondition: 'Suspected Condition', diagnosis: 'Diagnosis', diseaseActivity: 'Disease Activity',
  symptoms: 'Symptoms', physicalExam: 'Physical Exam',
  serology: 'Serology', inflammatoryMarkers: 'Inflammatory Markers',
  organInvolvement: 'Organ Involvement', imaging: 'Imaging', biopsy: 'Biopsy',
  treatment: 'Treatment', monitoring: 'Monitoring', notes: 'Notes',
};

const ARRAY_FIELDS = ['symptoms', 'organInvolvement', 'treatment'];
// String fields that are really a comma-separated list of findings → split into per-item rows.
const COMMA_SPLIT_FIELDS = ['physicalExam'];

/* splitByComma: parenthesis-aware comma split. A depth-0 comma is a separator UNLESS it is inside
   parentheses, sits between two digits (thousands/ranges like "85,000"), or is followed by a year or
   an "and"/"or" conjunction. Joining the result with ', ' round-trips losslessly. Used ONLY for
   COMMA_SPLIT_FIELDS (a genuine list), never on narrative prose where commas are grammar. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const prev = text[i - 1] || '', next = text[i + 1] || '';
      const rest = text.slice(i + 1).trimStart();
      if ((/\d/.test(prev) && /\d/.test(next)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const SECTION_TITLES = {
  recordInfo: 'Record Information', clinicalInfo: 'Clinical Information', symptoms: 'Symptoms',
  physicalExam: 'Physical Exam', serology: 'Serology', inflammatoryMarkers: 'Inflammatory Markers',
  organInvolvement: 'Organ Involvement', imaging: 'Imaging', biopsy: 'Biopsy',
  treatment: 'Treatment', monitoring: 'Monitoring', notes: 'Notes',
};

/* Plain-text copy formatting — NO "Label:" colons (user preference). Section title = UPPERCASE heading
   underlined with '='; field label = heading underlined with '_'; value / numbered list goes below. */
const secHeading = (title) => { const u = String(title).toUpperCase(); return `${u}\n${'='.repeat(u.length)}\n`; };
const subLabel = (label) => { const l = String(label); return `${l}\n${'_'.repeat(l.length)}\n`; };
const fldBlock = (label, value) => `${subLabel(label)}${value}\n\n`;

const AutoimmuneEvaluationsDocument = ({ document: rawDoc }) => {
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
      if (r?.autoimmune_evaluations) return Array.isArray(r.autoimmune_evaluations) ? r.autoimmune_evaluations : [r.autoimmune_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoimmune_evaluations) return Array.isArray(dd.autoimmune_evaluations) ? dd.autoimmune_evaluations : [dd.autoimmune_evaluations]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft store is keyed by record _id -> { [editKey]: value }; editKey already encodes field/idx/arrayIndex.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid || String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, value]) => {
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // editKey is "<field>-<idx>" or "<field>-<idx>-<arrayIndex>"; mark the matching edited tracker.
        nFields[editKey] = 'edited';
        nSentences[`${editKey}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  // Abbreviation-safe: a period after Mr/Mrs/Ms/Dr/St/Jr/Sr/Prof/Rev/Gen/Col/Sgt/vs/etc is NOT a
  // sentence boundary, so "Dr. Katherine Chen, MD" stays one unit (no split at "Dr.").
  const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\.)(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; }); };

  const getFieldValue = useCallback((record, fieldName, idx) => { const key = `${fieldName}-${idx}`; if (localEdits[key] !== undefined) return localEdits[key]; return record[fieldName]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const orig = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; return orig.map((item, ii) => { const ek = `${fieldName}-${idx}-${ii}`; return localEdits[ek] !== undefined ? localEdits[ek] : item; }); }, [localEdits]);
  const getRecordId = (record) => { const id = record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[AutoimmuneEvaluations] Cannot save — no record ID'); return; }
    const newValue = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { const sk = `${sectionId}-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][ek] = newValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a DRAFT locally only (no DB write). Approve commits it.
  const handleSaveArrayItem = useCallback((record, fieldName, idx, itemIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[AutoimmuneEvaluations] Cannot save — no record ID'); return; }
    const ek = `${fieldName}-${idx}-${itemIdx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → array fields live in same-named section; drop its approved flag.
    setApprovedSections(prev => { const sk = `${fieldName}-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][ek] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // editKey formats committed here (reversed to PUT payloads):
  //   "<field>-<idx>"            → { field, value }                     (plain / sentence-joined fields)
  //   "<field>-<idx>-<i>"        → { field, value, arrayIndex: i }      (array items: symptoms/organInvolvement/treatment)
  //   "serology.<key>-<idx>"     → { field: "serology.<key>", value }   (serology scalar — dotted path, NO arrayIndex)
  //   "serology.<key>-<idx>-<i>" → { field: "serology.<key>", value, arrayIndex: i }  (serology array item)
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    const rid = getRecordId(record); if (!rid) return;
    setSaving(true);
    try {
      const sf = SECTION_FIELDS[sectionId] || [];
      const belongsToSection = (fieldBase) => sf.includes(fieldBase) || (sectionId === 'serology' && fieldBase.startsWith('serology.'));
      // Collect this section+record's pending editKeys and reverse them into PUT payloads.
      const toCommit = [];
      for (const editKey of Object.keys(localEdits)) {
        if (!pendingEdits[editKey]) continue;
        // Parse trailing "-<idx>" or "-<idx>-<arrayIndex>" — only purely-numeric trailing segment(s).
        const m2 = editKey.match(/^(.+)-(\d+)-(\d+)$/);
        const m1 = editKey.match(/^(.+)-(\d+)$/);
        let fieldBase, recIdx, arrayIndex;
        if (m2) { fieldBase = m2[1]; recIdx = parseInt(m2[2], 10); arrayIndex = parseInt(m2[3], 10); }
        else if (m1) { fieldBase = m1[1]; recIdx = parseInt(m1[2], 10); }
        else continue;
        if (recIdx !== idx) continue;
        if (!belongsToSection(fieldBase)) continue;
        const payload = { field: fieldBase, value: localEdits[editKey] };
        if (arrayIndex !== undefined) payload.arrayIndex = arrayIndex;
        toCommit.push({ editKey, payload });
      }
      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now.
      for (const { payload } of toCommit) {
        await secureApiClient.put(`/api/edit/autoimmune_evaluations/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/autoimmune_evaluations/${rid}/approve`, { sectionId, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(({ editKey }) => delete n[editKey]); return n; });
      // Drop this record's committed drafts from localStorage
      if (toCommit.length > 0) {
        const store = readDrafts();
        if (store[rid]) { toCommit.forEach(({ editKey }) => delete store[rid][editKey]); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      }
      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AutoimmuneEvaluations] Approve failed:', err); } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim(); if (i < sentences.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }
  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx, newText) {
    const cur = String(getFieldValue(record, fieldName, idx) || ''); const cs = splitBySentence(cur);
    const cn = newText.trim(); const co = (cs[sentenceIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn || cn.replace(/[.!?;,]+/g, '').trim() === '') { cs.splice(sentenceIdx, 1); setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' })); handleSaveField(record, fieldName, idx, sectionId, null, reconstructFullText(cs), `${fieldName}-${idx}`); return; }
    let nt = cn; if (nt && !nt.match(/[.!?;]$/)) nt += '.'; cs[sentenceIdx] = nt;
    const ec = nt.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    setEditedSentences(prev => { const n = { ...prev, [`${fieldName}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let e = 1; e <= ec; e++) n[`${fieldName}-${idx}-s${sentenceIdx + e}`] = 'added'; return n; });
    handleSaveField(record, fieldName, idx, sectionId, null, reconstructFullText(cs), `${fieldName}-${idx}`);
  }

  // Search
  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [title, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Autoimmune Evaluation ${idx + 1}`;
      const serologyText = (record.serology && typeof record.serology === 'object') ? Object.entries(record.serology).map(([k, v]) => `${humanizeKey(k)} ${Array.isArray(v) ? v.join(' ') : (v ?? '')}`).join(' ') : '';
      const allText = [title, formatDate(record.date), record.suspectedCondition, record.diagnosis, record.diseaseActivity, record.rheumatologist, record.facility, record.physicalExam, record.inflammatoryMarkers, record.monitoring, record.imaging, record.biopsy, record.notes, ...(record.symptoms || []), ...(record.organInvolvement || []), ...(record.treatment || []), serologyText, ...Object.values(FIELD_LABELS), 'Record Information', 'Clinical Information', 'Serology'].filter(Boolean).join(' ');
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
    const ss = splitBySentence(String(value)); if (ss.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const vis = ss.map((s, oi) => ({ text: s, _origIdx: oi })).filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text, _origIdx: sIdx }) => { const sk = `${fn}-${idx}-s${sIdx}`; const ie = editingField === sk; const es = editedSentences[sk]; const scid = `row-${fn}-${idx}-s${sIdx}`;
      if (ie) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={sIdx} className="rec-mini-card"><div className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(text.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!es && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === scid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, scid); }}>{copiedId === scid ? 'Copied' : 'Copy'}</button></div>{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
  };

  // Save one comma-item edit for a COMMA_SPLIT field: replace/splice item ci, rejoin with ', '
  // (round-trip safe — every split point was a ', ' separator; guarded commas stay in their item).
  const saveCommaItem = (record, fn, idx, sid, ci, commaKey, newText) => {
    const cur = String(getFieldValue(record, fn, idx) || '');
    const items = splitByComma(cur);
    if (ci < 0 || ci >= items.length) { setEditingField(null); setEditValue(''); return; }
    const clean = newText.trim();
    if (clean) items[ci] = clean; else items.splice(ci, 1);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    handleSaveField(record, fn, idx, sid, null, items.join(', '), `${fn}-${idx}`);
  };

  // Render a COMMA_SPLIT field (physicalExam) as one editable rec-mini-card row per comma item.
  const renderCommaField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const items = splitByComma(String(value));
    if (items.length <= 1) return renderEditableField(record, fn, idx, sid, true);
    const vis = items.map((t, oi) => ({ text: t, _origIdx: oi })).filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text, _origIdx: ci }) => { const ck = `${fn}-${idx}-c${ci}`; const ie = editingField === ck; const badge = editedSentences[ck]; const cid = `row-${fn}-${idx}-c${ci}`;
      if (ie) return (<div key={ci} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, ci, ck, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveCommaItem(record, fn, idx, sid, ci, ck, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={ci} className="rec-mini-card"><div className={`numbered-row editable-row${badge ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(text); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!badge && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{badge && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    })}</>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ii) => {
    const ek = `${fn}-${idx}-${ii}`; const dv = localEdits[ek] !== undefined ? localEdits[ek] : item; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}-${ii}`;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(FIELD_LABELS[fn] || fn) && !phraseMatch(dv, searchTerm)) return null;
    if (ie) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, ii); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, ii)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
    return (<React.Fragment key={ii}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(dv)); }}><div className="row-content"><span className="content-value">{highlightText(String(dv))}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(dv), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  // Serology — dynamic-key object: scalar values editable, array values as editable rows
  const renderSerologyScalar = (record, idx, key, rawValue) => {
    const fieldPath = `serology.${key}`; const ek = `${fieldPath}-${idx}`;
    const dv = localEdits[ek] !== undefined ? localEdits[ek] : rawValue;
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-serology-${key}-${idx}`;
    const label = humanizeKey(key);
    const saveScalar = () => { const rid = getRecordId(record); if (!rid) return; setLocalEdits(prev => ({ ...prev, [ek]: editValue })); setPendingEdits(prev => ({ ...prev, [ek]: true })); setEditedFields(prev => ({ ...prev, [ek]: 'edited' })); setApprovedSections(prev => { const sk = `serology-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; }); const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][ek] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); };
    if (ie) return (<div className="rec-mini-card" key={key}><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveScalar(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveScalar} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card" key={key}><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(dv)); }}><div className="row-content"><span className="content-value">{highlightText(String(dv))}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${dv}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };
  const renderSerologyArray = (record, idx, key, items) => {
    const fieldPath = `serology.${key}`; const label = humanizeKey(key);
    return (<div className="rec-mini-card" key={key}><div className="nested-subtitle">{highlightText(label)}</div>{items.map((t, i) => {
      const ek = `${fieldPath}-${idx}-${i}`; const dv = localEdits[ek] !== undefined ? localEdits[ek] : t;
      const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-serology-${key}-${idx}-${i}`;
      const saveItem = () => { const rid = getRecordId(record); if (!rid) return; setLocalEdits(prev => ({ ...prev, [ek]: editValue })); setPendingEdits(prev => ({ ...prev, [ek]: true })); setEditedFields(prev => ({ ...prev, [ek]: 'edited' })); setApprovedSections(prev => { const sk = `serology-${idx}`; if (!prev[sk]) return prev; const n = { ...prev }; delete n[sk]; return n; }); const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][ek] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); };
      if (ie) return (<div key={i} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<React.Fragment key={i}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(dv)); }}><div className="row-content"><span className="content-value">{highlightText(String(dv))}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(dv), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
    })}</div>);
  };

  // pdfData
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && !ARRAY_FIELDS.includes(fn) && !fn.startsWith('serology.') && fn in record) m[fn] = localEdits[key]; });
      // Array fields: merge committed edits only — pending drafts stay OUT of the PDF until approved.
      ARRAY_FIELDS.forEach(f => { const orig = Array.isArray(record[f]) ? [...record[f]] : []; m[f] = orig.map((item, ii) => { const ek = `${f}-${idx}-${ii}`; return (localEdits[ek] !== undefined && !pendingEdits[ek]) ? localEdits[ek] : item; }); });
      // Serology dynamic-key edits: keys are `serology.<key>-<idx>` (scalar) or `serology.<key>-<idx>-<i>` (array item)
      if (record.serology && typeof record.serology === 'object') {
        const ser = {}; Object.entries(record.serology).forEach(([k, v]) => { ser[k] = Array.isArray(v) ? [...v] : v; });
        Object.keys(localEdits).forEach(key => {
          if (!key.startsWith('serology.')) return;
          if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
          const rest = key.slice('serology.'.length);
          const arrM = rest.match(/^(.+)-(\d+)-(\d+)$/);
          if (arrM && parseInt(arrM[2], 10) === idx) { const sk = arrM[1]; const ai = parseInt(arrM[3], 10); if (Array.isArray(ser[sk])) ser[sk][ai] = localEdits[key]; return; }
          const scalarM = rest.match(/^(.+)-(\d+)$/);
          if (scalarM && parseInt(scalarM[2], 10) === idx) { const sk = scalarM[1]; if (sk in ser && !Array.isArray(ser[sk])) ser[sk] = localEdits[key]; }
        });
        m.serology = ser;
      }
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  // Build one section's colon-free text: section heading ('=' underline) then, per field, either the
  // value directly (single-name section) or a '_'-underlined sub-label + value/numbered list. Multi-item
  // (array / comma-split / multi-sentence) → numbered list. scalarRec supplies scalars; getArr(f) the arrays.
  const buildSectionLines = (scalarRec, getArr, sid) => {
    let text = secHeading(SECTION_TITLES[sid] || sid); let any = false;
    if (sid === 'serology') {
      const ser = scalarRec.serology; if (!ser || typeof ser !== 'object') return '';
      Object.entries(ser).forEach(([k, v]) => {
        if (v === null || v === undefined || (Array.isArray(v) && v.length === 0) || String(v).trim() === '') return;
        any = true; const lbl = humanizeKey(k);
        if (Array.isArray(v)) { text += subLabel(lbl); v.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; }
        else text += fldBlock(lbl, v);
      });
      return any ? text : '';
    }
    const fs = SECTION_FIELDS[sid] || []; const single = fs.length === 1;
    fs.forEach(f => {
      const l = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = getArr(f);
        if (arr.length > 0) { any = true; if (!single) text += subLabel(l); arr.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; }
      } else {
        const v = scalarRec[f]; if (!v) return; any = true;
        let items = null;
        if (COMMA_SPLIT_FIELDS.includes(f)) { const ci = splitByComma(String(v)); if (ci.length > 1) items = ci; }
        else { const ss = splitBySentence(String(v)); if (ss.length > 1) items = ss; }
        if (items) { if (!single) text += subLabel(l); items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; }
        else { if (single) text += `${v}\n\n`; else text += fldBlock(l, v); }
      }
    });
    return any ? text : '';
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    copyToClipboard(buildSectionLines(pr, (f) => getEffectiveArray(record, f, idx), sid).trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = secHeading('Autoimmune Evaluations') + '\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      const rt = `Autoimmune Evaluation ${idx + 1}`;
      text += `${rt}\n${'='.repeat(rt.length)}\n\n`;
      if (r.date) text += secHeading('Date') + `${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const s = buildSectionLines(r, (f) => (Array.isArray(r[f]) ? r[f] : []), sid); if (s) text += s; });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return (<article className="autoimmune-evaluations-document"><header className="document-header"><h1 className="document-title">Autoimmune Evaluations</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No autoimmune evaluation data available.</div></article>);
  }

  return (
    <article className="autoimmune-evaluations-document">
      <header className="document-header">
        <h1 className="document-title">Autoimmune Evaluations</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<AutoimmuneEvaluationsDocumentPDFTemplate document={pdfData} />} fileName="Autoimmune_Evaluations.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Autoimmune Evaluation ${idx + 1}`)}</h3></div>
            </div>

            {/* Record Information */}
            {(() => { const hd = [record.rheumatologist, record.facility].some(v => v && String(v).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Record Information', [record.rheumatologist, record.facility].filter(Boolean), ['rheumatologist', 'facility'])) return null; const stm = sectionTitleMatches('Record Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'recordInfo', 'Record Information', <>{(sa || fieldMatches(record, 'rheumatologist', idx)) && renderEditableField(record, 'rheumatologist', idx, 'recordInfo')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}</>); })()}

            {/* Clinical Information */}
            {(() => { if (!shouldShowSection(record, 'Clinical Information', [record.suspectedCondition, record.diagnosis, record.diseaseActivity].filter(Boolean), ['suspectedCondition', 'diagnosis', 'diseaseActivity'])) return null; const stm = sectionTitleMatches('Clinical Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'clinicalInfo', 'Clinical Information', <>{(sa || fieldMatches(record, 'suspectedCondition', idx)) && renderEditableField(record, 'suspectedCondition', idx, 'clinicalInfo')}{(sa || fieldMatches(record, 'diagnosis', idx)) && renderEditableField(record, 'diagnosis', idx, 'clinicalInfo')}{(sa || fieldMatches(record, 'diseaseActivity', idx)) && renderEditableField(record, 'diseaseActivity', idx, 'clinicalInfo')}</>); })()}

            {/* Symptoms */}
            {(() => { const arr = getEffectiveArray(record, 'symptoms', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Symptoms', arr, ['symptoms'])) return null; return renderSection(record, idx, 'symptoms', 'Symptoms', arr.map((it, ii) => renderEditableArrayItem(record, 'symptoms', idx, 'symptoms', it, ii))); })()}

            {/* Physical Exam */}
            {getFieldValue(record, 'physicalExam', idx) && shouldShowSection(record, 'Physical Exam', [getFieldValue(record, 'physicalExam', idx)], ['physicalExam']) && renderSection(record, idx, 'physicalExam', 'Physical Exam', renderCommaField(record, 'physicalExam', idx, 'physicalExam'))}

            {/* Serology — dynamic-key object (antibody panel): every key rendered + editable */}
            {(() => {
              if (!record.serology || typeof record.serology !== 'object') return null;
              const entries = Object.entries(record.serology).filter(([, v]) => {
                if (v === null || v === undefined) return false;
                if (Array.isArray(v)) return v.length > 0;
                return String(v).trim() !== '';
              });
              if (entries.length === 0) return null;
              const serologyText = entries.map(([k, v]) => `${humanizeKey(k)} ${Array.isArray(v) ? v.join(' ') : v}`).join(' ');
              if (!shouldShowSection(record, 'Serology', [serologyText], ['serology'])) return null;
              const stm = sectionTitleMatches('Serology');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              const visible = entries.filter(([k, v]) => showAll || phraseMatch(humanizeKey(k), searchTerm) || phraseMatch(Array.isArray(v) ? v.join(' ') : v, searchTerm));
              if (visible.length === 0) return null;
              return renderSection(record, idx, 'serology', 'Serology', <>
                {visible.map(([k, v]) => Array.isArray(v)
                  ? renderSerologyArray(record, idx, k, v)
                  : renderSerologyScalar(record, idx, k, v))}
              </>);
            })()}

            {/* Inflammatory Markers */}
            {getFieldValue(record, 'inflammatoryMarkers', idx) && shouldShowSection(record, 'Inflammatory Markers', [getFieldValue(record, 'inflammatoryMarkers', idx)], ['inflammatoryMarkers']) && renderSection(record, idx, 'inflammatoryMarkers', 'Inflammatory Markers', renderEditableField(record, 'inflammatoryMarkers', idx, 'inflammatoryMarkers', true))}

            {/* Organ Involvement */}
            {(() => { const arr = getEffectiveArray(record, 'organInvolvement', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Organ Involvement', arr, ['organInvolvement'])) return null; return renderSection(record, idx, 'organInvolvement', 'Organ Involvement', arr.map((it, ii) => renderEditableArrayItem(record, 'organInvolvement', idx, 'organInvolvement', it, ii))); })()}

            {/* Imaging */}
            {getFieldValue(record, 'imaging', idx) && shouldShowSection(record, 'Imaging', [getFieldValue(record, 'imaging', idx)], ['imaging']) && renderSection(record, idx, 'imaging', 'Imaging', renderSentenceEditableField(record, 'imaging', idx, 'imaging', true))}

            {/* Biopsy */}
            {getFieldValue(record, 'biopsy', idx) && shouldShowSection(record, 'Biopsy', [getFieldValue(record, 'biopsy', idx)], ['biopsy']) && renderSection(record, idx, 'biopsy', 'Biopsy', renderSentenceEditableField(record, 'biopsy', idx, 'biopsy', true))}

            {/* Treatment */}
            {(() => { const arr = getEffectiveArray(record, 'treatment', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Treatment', arr, ['treatment'])) return null; return renderSection(record, idx, 'treatment', 'Treatment', arr.map((it, ii) => renderEditableArrayItem(record, 'treatment', idx, 'treatment', it, ii))); })()}

            {/* Monitoring */}
            {getFieldValue(record, 'monitoring', idx) && shouldShowSection(record, 'Monitoring', [getFieldValue(record, 'monitoring', idx)], ['monitoring']) && renderSection(record, idx, 'monitoring', 'Monitoring', renderSentenceEditableField(record, 'monitoring', idx, 'monitoring', true))}

            {/* Notes */}
            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default AutoimmuneEvaluationsDocument;
