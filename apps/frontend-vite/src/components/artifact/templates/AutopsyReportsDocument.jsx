/**
 * AutopsyReportsDocument.jsx
 * Inline editing with per-section approve, per-row copy,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AutopsyReportsPDFTemplate from '../pdf-templates/AutopsyReportsPDFTemplate';
import './AutopsyReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'autopsy_reportsPendingEdits';
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
  recordInfo: ['pathologist', 'facility', 'decedentName', 'autopsyType', 'mannerOfDeath', 'dateOfDeath', 'autopsyDate'],
  indication: ['indication'],
  externalExam: ['externalExamination'],
  internalExam: ['internalExamination'],
  cardiovascular: ['cardiovascular'],
  respiratory: ['respiratory'],
  gastrointestinal: ['gastrointestinal'],
  neurologicalBrain: ['neurologicalBrain'],
  toxicology: ['toxicology'],
  microscopic: ['microscopic'],
  causeOfDeath: ['causeOfDeath'],
  contributingFactors: ['contributingFactors'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  pathologist: 'Pathologist', facility: 'Facility', decedentName: 'Decedent Name',
  autopsyType: 'Autopsy Type', mannerOfDeath: 'Manner of Death',
  indication: 'Indication', externalExamination: 'External Examination',
  internalExamination: 'Internal Examination', cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory', gastrointestinal: 'Gastrointestinal',
  neurologicalBrain: 'Neurological/Brain', toxicology: 'Toxicology',
  microscopic: 'Microscopic', causeOfDeath: 'Cause of Death',
  contributingFactors: 'Contributing Factors', notes: 'Notes',
  dateOfDeath: 'Date of Death', autopsyDate: 'Autopsy Date',
};

const ARRAY_FIELDS = ['contributingFactors'];
const DATE_FIELDS = ['dateOfDeath', 'autopsyDate'];
// Narrative fields rendered with the per-sentence labeled/clause renderer (parseLabel → nested-subtitle).
const CLINICAL_FIELDS = ['indication', 'externalExamination', 'internalExamination', 'cardiovascular', 'respiratory', 'gastrointestinal', 'neurologicalBrain', 'toxicology', 'microscopic', 'causeOfDeath', 'notes'];

// UTC-safe date display (no midnight day-shift); non-date strings pass through unchanged.
const stripTime = (val) => {
  if (!val) return '';
  const s = String(val.$date || val);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (m) { try { return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return s; } }
  return s;
};
const toInputDate = (val) => { if (!val) return ''; try { const d = new Date(val.$date || val); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; } catch { return ''; } };
// UNLABELED prose: split rows ONLY on depth-0 ';' (paren-aware); commas stay intact (prose commas like
// "Well-developed, well-nourished…" must never split). Labeled values use splitClauseValue (comma-aware).
const splitSemicolons = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && ch === ';') { const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t); cur = ''; continue; }
    cur += ch;
  }
  const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t);
  return out;
};

// Credential/suffix tokens that must NOT trigger a comma split (e.g. "Dr. Voss, MD", "…, FCAP").
const VALUE_CRED = /^(?:MD|DO|PhD|PharmD|PA|JD|RN|NP|DDS|DMD|DVM|Esq|FACP|FCAP|FACS|MPH|MBA|MSN|BSN|CSFA|CRNA|II|III|IV|Jr|Sr)\b/;
// A bare measurement: digits then a unit and nothing else ("180 g", "1,820 g", "12KG", "42 ng/mL").
const VALUE_MEASURE = /^[\d][\d.,]*\s*[A-Za-z/%µ]+\.?$/;
// LABELED value → rows: paren-aware; ';' always splits; a depth-0 ',' splits UNLESS inside parens, between
// digits ("1,820"), before a year, before "and"/"or", before a credential, OR when the clause before the
// comma is a bare measurement (the rest describes it — "180 g, unremarkable" / "1,820 g, chronic passive
// congestion" stay one row), otherwise comma lists ("Na 148, K 9.2, …") split normally.
const splitClauseValue = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && (ch === ';' || ch === ',')) {
      if (ch === ',') {
        const prev = text[i - 1] || '', nx = text[i + 1] || '';
        const rest = text.slice(i + 1).trimStart();
        if ((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest) || VALUE_CRED.test(rest) || VALUE_MEASURE.test(cur.trim())) { cur += ch; continue; }
      }
      const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t);
  return out;
};

const AutopsyReportsDocument = ({ document: rawDoc }) => {
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
      if (r?.autopsy_reports) return Array.isArray(r.autopsy_reports) ? r.autopsy_reports : [r.autopsy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autopsy_reports) return Array.isArray(dd.autopsy_reports) ? dd.autopsy_reports : [dd.autopsy_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid ? id.$oid : String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArrayElem
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`
          : `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        if (isArrayElem) nFields[editKey] = 'edited';
        else { nFields[`${fieldPart}-${idx}`] = 'edited'; nSentences[`${fieldPart}-${idx}-s0`] = 'edited'; }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    // Protect abbreviations from splitting
    let prepared = text
      .replace(/\bDr\.\s/g, 'Dr_DOT_ ')
      .replace(/\bMr\.\s/g, 'Mr_DOT_ ')
      .replace(/\bMrs\.\s/g, 'Mrs_DOT_ ')
      .replace(/\bMs\.\s/g, 'Ms_DOT_ ')
      .replace(/\bProf\.\s/g, 'Prof_DOT_ ')
      .replace(/\bJr\.\s/g, 'Jr_DOT_ ')
      .replace(/\bSr\.\s/g, 'Sr_DOT_ ')
      .replace(/\bvs\.\s/g, 'vs_DOT_ ')
      .replace(/\betc\.\s/g, 'etc_DOT_ ')
      .replace(/\bSt\.\s/g, 'St_DOT_ ')
      .replace(/(^|[\s(])([A-Z])\.\s/g, '$1$2_DOT_ ');
    const restore = (s) => s
      .replace(/Dr_DOT_/g, 'Dr.')
      .replace(/Mr_DOT_/g, 'Mr.')
      .replace(/Mrs_DOT_/g, 'Mrs.')
      .replace(/Ms_DOT_/g, 'Ms.')
      .replace(/Prof_DOT_/g, 'Prof.')
      .replace(/Jr_DOT_/g, 'Jr.')
      .replace(/Sr_DOT_/g, 'Sr.')
      .replace(/vs_DOT_/g, 'vs.')
      .replace(/etc_DOT_/g, 'etc.')
      .replace(/St_DOT_/g, 'St.')
      .replace(/([A-Z])_DOT_/g, '$1.');
    return prepared.split(/(?<=[.!?])\s+/).map(s => restore(s.trim())).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0);
  };

  const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const orig = Array.isArray(record[fn]) ? [...record[fn]] : []; return orig.map((item, ii) => { const ek = `${fn}-${idx}-${ii}`; return localEdits[ek] !== undefined ? localEdits[ek] : item; }); }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[AutopsyReports] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = nv; // fieldPart = plain field name
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, itemIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[AutopsyReports] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${itemIdx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${fn}-${idx}`]) return prev; const n = { ...prev }; delete n[`${fn}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${itemIdx}`] = editValue; // fieldPart = "field.arrayIndex"
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this record's pending editKeys belonging to this section's fields.
      // editKey is "field-idx" (plain/sentence) or "field-idx-itemIdx" (array element).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      for (const ek of toCommit) {
        // Reverse the editKey: find which field it belongs to, and whether a numeric arrayIndex trails.
        const f = sf.find(ff => ek === `${ff}-${idx}` || ek.startsWith(`${ff}-${idx}-`));
        const payload = { field: f, value: localEdits[ek] };
        const tail = ek.slice(`${f}-${idx}`.length); // "" or "-<itemIdx>"
        if (tail.startsWith('-') && /^\d+$/.test(tail.slice(1))) payload.arrayIndex = parseInt(tail.slice(1), 10);
        await sc.put(`/api/edit/autopsy_reports/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/autopsy_reports/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for this section from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(ek => {
          const f = sf.find(ff => ek === `${ff}-${idx}` || ek.startsWith(`${ff}-${idx}-`));
          const tail = ek.slice(`${f}-${idx}`.length);
          const fieldPart = (tail.startsWith('-') && /^\d+$/.test(tail.slice(1))) ? `${f}.${tail.slice(1)}` : f;
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AutopsyReports] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  function reconstructFullText(ss) { return ss.map((s, i) => { const t = s.trim(); if (i < ss.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }
  function saveSentence(record, fn, idx, sid, sIdx, newText) {
    const cur = String(getFieldValue(record, fn, idx) || ''); const cs = splitBySentence(cur);
    const cn = newText.trim(); const co = (cs[sIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn || cn.replace(/[.!?;,]+/g, '').trim() === '') {
      cs.splice(sIdx, 1);
      // Clear all sentence markers at and above deleted index (indices shifted down)
      setEditedSentences(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          const match = k.match(new RegExp(`^${fn}-${idx}-s(\\d+)`));
          if (match && parseInt(match[1], 10) >= sIdx) delete next[k];
        });
        return next;
      });
      handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`);
      return;
    }
    let nt = cn; if (nt && !nt.match(/[.!?;]$/)) nt += '.'; cs[sIdx] = nt;
    const ec = nt.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    setEditedSentences(prev => { const n = { ...prev, [`${fn}-${idx}-s${sIdx}`]: 'edited' }; for (let e = 1; e <= ec; e++) n[`${fn}-${idx}-s${sIdx + e}`] = 'added'; return n; });
    handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`);
  }

  // Search
  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [title, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Autopsy Report ${idx + 1}`;
      const allText = [title, formatDate(record.dateOfDeath), formatDate(record.autopsyDate), record.decedentName, record.autopsyType, record.mannerOfDeath, record.pathologist, record.facility, record.indication, record.externalExamination, record.internalExamination, record.cardiovascular, record.respiratory, record.gastrointestinal, record.neurologicalBrain, record.toxicology, record.microscopic, record.causeOfDeath, record.notes, ...(record.contributingFactors || []), ...Object.values(FIELD_LABELS), 'Record Information', 'External Examination', 'Internal Examination', 'Contributing Factors'].filter(Boolean).join(' ');
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

  // Date picker (UTC-safe; saves midnight-UTC ISO so there is no day-shift). Display via stripTime.
  const saveDate = (record, fn, idx, sid) => { const v = editValue ? `${editValue}T00:00:00.000Z` : ''; handleSaveField(record, fn, idx, sid, null, v, `${fn}-${idx}`); };
  const renderDateField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx);
    if (!value && localEdits[`${fn}-${idx}`] === undefined) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`; const display = stripTime(value);
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveDate(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveDate(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(value)); }}><div className="row-content"><span className="content-value">{highlightText(display)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fn] || fn}: ${display}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Unified clinical narrative renderer: split into sentences; a "Label: value" sentence becomes a
  // nested-subtitle (label) + paren-aware clause rows; an unlabeled sentence stays a plain row. Editing
  // always opens the FULL sentence (round-trip safe via saveSentence). NEVER renders inline "Label: value".
  const renderSentenceEditableField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const sentences = splitBySentence(String(value)); if (sentences.length === 0) return null;
    const vis = sentences.map((s, oi) => ({ text: s, _sIdx: oi })).filter(({ text }) => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; const p = parseLabel(text); return phraseMatch(text, searchTerm) || phraseMatch(p.label, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text: sentenceText, _sIdx: sIdx }) => {
      const parsed = parseLabel(sentenceText); const sk = `${fn}-${idx}-s${sIdx}`; const ie = editingField === sk; const es = editedSentences[sk]; const scid = `row-${fn}-${idx}-s${sIdx}`;
      if (ie) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={3} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      if (parsed.isLabeled) {
        const clauses = splitClauseValue(parsed.value); const rows = clauses.length ? clauses : [parsed.value.replace(/[.;,]+$/, '')];
        return (<div key={sIdx} className="rec-mini-card"><div className="nested-subtitle">{highlightText(parsed.label)}</div>{rows.map((c, ci) => (<div key={ci} className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentenceText.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(c)}</span>{!es && ci === 0 && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `${scid}-c${ci}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `${scid}-c${ci}`); }}>{copiedId === `${scid}-c${ci}` ? 'Copied' : 'Copy'}</button></div>))}{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
      }
      const sRows = splitSemicolons(sentenceText);
      if (sRows.length <= 1) return (<div key={sIdx} className="rec-mini-card"><div className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentenceText.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(sentenceText)}</span>{!es && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === scid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentenceText, scid); }}>{copiedId === scid ? 'Copied' : 'Copy'}</button></div>{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
      return (<div key={sIdx} className="rec-mini-card">{sRows.map((c, ci) => (<div key={ci} className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentenceText.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(c)}</span>{!es && ci === 0 && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `${scid}-c${ci}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `${scid}-c${ci}`); }}>{copiedId === `${scid}-c${ci}` ? 'Copied' : 'Copy'}</button></div>))}{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ii) => {
    const ek = `${fn}-${idx}-${ii}`; const dv = localEdits[ek] !== undefined ? localEdits[ek] : item; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}-${ii}`;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(FIELD_LABELS[fn] || fn) && !phraseMatch(dv, searchTerm)) return null;
    if (ie) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, ii); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, ii)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
    return (<React.Fragment key={ii}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(dv)); }}><div className="row-content"><span className="content-value">{highlightText(String(dv))}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(dv), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && !ARRAY_FIELDS.includes(fn) && fn in record) m[fn] = localEdits[key]; });
      // Array fields: merge committed (non-pending) element edits only; pending stay out of PDF.
      ARRAY_FIELDS.forEach(f => {
        const orig = Array.isArray(record[f]) ? [...record[f]] : [];
        m[f] = orig.map((item, ii) => { const ek = `${f}-${idx}-${ii}`; return (localEdits[ek] !== undefined && !pendingEdits[ek]) ? localEdits[ek] : item; });
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  // Nested copy for a clinical field: "Label:\n  SubLabel:\n    1. clause\n  <unlabeled sentence>".
  const formatClinicalField = (label, value) => {
    const sentences = splitBySentence(String(value));
    if (sentences.length === 0) return '';
    let text = `${label}:\n`;
    sentences.forEach((s) => {
      const p = parseLabel(s);
      if (p.isLabeled) {
        const clauses = splitClauseValue(p.value); const rows = clauses.length ? clauses : [p.value.replace(/[.;,]+$/, '')];
        text += `  ${p.label}:\n`;
        rows.forEach((c, i) => { text += `    ${i + 1}. ${c}\n`; });
      } else { const semis = splitSemicolons(s); if (semis.length > 1) semis.forEach((c, i) => { text += `  ${i + 1}. ${c}\n`; }); else text += `  ${s}\n`; }
    });
    return text;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; const fs = SECTION_FIELDS[sid] || []; let text = '';
    fs.forEach(f => {
      const l = FIELD_LABELS[f] || f;
      if (DATE_FIELDS.includes(f)) { const v = pr[f]; if (v) text += `${l}: ${stripTime(v)}\n`; }
      else if (ARRAY_FIELDS.includes(f)) { const arr = getEffectiveArray(record, f, idx); if (arr.length > 0) { text += `${l}:\n`; arr.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } }
      else if (CLINICAL_FIELDS.includes(f)) { const v = pr[f]; if (v) text += formatClinicalField(l, v); }
      else { const v = pr[f]; if (v) text += `${l}: ${v}\n`; }
    });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== AUTOPSY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Autopsy Report ${idx + 1}\n\n`;
      Object.entries(SECTION_FIELDS).forEach(([, fs]) => { fs.forEach(f => {
        const l = FIELD_LABELS[f] || f;
        if (DATE_FIELDS.includes(f)) { const v = r[f]; if (v) text += `${l}: ${stripTime(v)}\n`; }
        else if (ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(r[f]) ? r[f] : []; if (arr.length > 0) { text += `${l}:\n`; arr.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); } }
        else if (CLINICAL_FIELDS.includes(f)) { const v = r[f]; if (v) text += formatClinicalField(l, v); }
        else { const v = r[f]; if (v) text += `${l}: ${v}\n`; }
      }); });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return (<article className="autopsy-reports-document"><header className="document-header"><h1 className="document-title">Autopsy Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No autopsy report data available.</div></article>);
  }

  return (
    <article className="autopsy-reports-document">
      <header className="document-header">
        <h1 className="document-title">Autopsy Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<AutopsyReportsPDFTemplate document={pdfData} />} fileName="Autopsy_Reports.pdf">
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
                {record.autopsyDate && <span className="record-date">{highlightText(stripTime(record.autopsyDate))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Autopsy Report ${idx + 1}`)}</h3></div>
            </div>

            {/* Record Information */}
            {(() => { if (!shouldShowSection(record, 'Record Information', [record.pathologist, record.facility, record.decedentName, record.autopsyType, record.mannerOfDeath, stripTime(record.dateOfDeath), stripTime(record.autopsyDate)].filter(Boolean), ['pathologist', 'facility', 'decedentName', 'autopsyType', 'mannerOfDeath', 'dateOfDeath', 'autopsyDate'])) return null; const stm = sectionTitleMatches('Record Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'recordInfo', 'Record Information', <>{(sa || fieldMatches(record, 'pathologist', idx)) && renderEditableField(record, 'pathologist', idx, 'recordInfo')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}{(sa || fieldMatches(record, 'decedentName', idx)) && renderEditableField(record, 'decedentName', idx, 'recordInfo')}{(sa || fieldMatches(record, 'autopsyType', idx)) && renderEditableField(record, 'autopsyType', idx, 'recordInfo')}{(sa || fieldMatches(record, 'mannerOfDeath', idx)) && renderEditableField(record, 'mannerOfDeath', idx, 'recordInfo')}{(sa || fieldMatches(record, 'dateOfDeath', idx)) && renderDateField(record, 'dateOfDeath', idx, 'recordInfo')}{(sa || fieldMatches(record, 'autopsyDate', idx)) && renderDateField(record, 'autopsyDate', idx, 'recordInfo')}</>); })()}

            {/* Indication */}
            {getFieldValue(record, 'indication', idx) && shouldShowSection(record, 'Indication', [getFieldValue(record, 'indication', idx)], ['indication']) && renderSection(record, idx, 'indication', 'Indication', renderSentenceEditableField(record, 'indication', idx, 'indication', true))}

            {/* External Examination */}
            {getFieldValue(record, 'externalExamination', idx) && shouldShowSection(record, 'External Examination', [getFieldValue(record, 'externalExamination', idx)], ['externalExamination']) && renderSection(record, idx, 'externalExam', 'External Examination', renderSentenceEditableField(record, 'externalExamination', idx, 'externalExam', true))}

            {/* Internal Examination */}
            {getFieldValue(record, 'internalExamination', idx) && shouldShowSection(record, 'Internal Examination', [getFieldValue(record, 'internalExamination', idx)], ['internalExamination']) && renderSection(record, idx, 'internalExam', 'Internal Examination', renderSentenceEditableField(record, 'internalExamination', idx, 'internalExam', true))}

            {/* Cardiovascular */}
            {getFieldValue(record, 'cardiovascular', idx) && shouldShowSection(record, 'Cardiovascular', [getFieldValue(record, 'cardiovascular', idx)], ['cardiovascular']) && renderSection(record, idx, 'cardiovascular', 'Cardiovascular', renderSentenceEditableField(record, 'cardiovascular', idx, 'cardiovascular', true))}

            {/* Respiratory */}
            {getFieldValue(record, 'respiratory', idx) && shouldShowSection(record, 'Respiratory', [getFieldValue(record, 'respiratory', idx)], ['respiratory']) && renderSection(record, idx, 'respiratory', 'Respiratory', renderSentenceEditableField(record, 'respiratory', idx, 'respiratory', true))}

            {/* Gastrointestinal */}
            {getFieldValue(record, 'gastrointestinal', idx) && shouldShowSection(record, 'Gastrointestinal', [getFieldValue(record, 'gastrointestinal', idx)], ['gastrointestinal']) && renderSection(record, idx, 'gastrointestinal', 'Gastrointestinal', renderSentenceEditableField(record, 'gastrointestinal', idx, 'gastrointestinal', true))}

            {/* Neurological/Brain */}
            {getFieldValue(record, 'neurologicalBrain', idx) && shouldShowSection(record, 'Neurological/Brain', [getFieldValue(record, 'neurologicalBrain', idx)], ['neurologicalBrain']) && renderSection(record, idx, 'neurologicalBrain', 'Neurological/Brain', renderSentenceEditableField(record, 'neurologicalBrain', idx, 'neurologicalBrain', true))}

            {/* Toxicology */}
            {getFieldValue(record, 'toxicology', idx) && shouldShowSection(record, 'Toxicology', [getFieldValue(record, 'toxicology', idx)], ['toxicology']) && renderSection(record, idx, 'toxicology', 'Toxicology', renderSentenceEditableField(record, 'toxicology', idx, 'toxicology'))}

            {/* Microscopic */}
            {getFieldValue(record, 'microscopic', idx) && shouldShowSection(record, 'Microscopic', [getFieldValue(record, 'microscopic', idx)], ['microscopic']) && renderSection(record, idx, 'microscopic', 'Microscopic', renderSentenceEditableField(record, 'microscopic', idx, 'microscopic', true))}

            {/* Cause of Death */}
            {getFieldValue(record, 'causeOfDeath', idx) && shouldShowSection(record, 'Cause of Death', [getFieldValue(record, 'causeOfDeath', idx)], ['causeOfDeath']) && renderSection(record, idx, 'causeOfDeath', 'Cause of Death', renderSentenceEditableField(record, 'causeOfDeath', idx, 'causeOfDeath', true))}

            {/* Contributing Factors */}
            {(() => { const arr = getEffectiveArray(record, 'contributingFactors', idx); if (!arr.length) return null; if (!shouldShowSection(record, 'Contributing Factors', arr, ['contributingFactors'])) return null; return renderSection(record, idx, 'contributingFactors', 'Contributing Factors', arr.map((it, ii) => renderEditableArrayItem(record, 'contributingFactors', idx, 'contributingFactors', it, ii))); })()}

            {/* Notes */}
            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes'))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default AutopsyReportsDocument;
