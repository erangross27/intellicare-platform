/**
 * BiopsyReportsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search with phrase matching, startsWith for titles.
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BiopsyReportsDocumentPDFTemplate from '../pdf-templates/BiopsyReportsDocumentPDFTemplate';
import './BiopsyReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field") */
const DRAFT_KEY = 'biopsy_reportsPendingEdits';
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
  diagnosis: ['diagnosis'],
  specimen: ['biopsySite', 'biopsyMethod'],
  clinical: ['clinicalHistory'],
  gross: ['grossDescription'],
  micro: ['microscopicDescription'],
  adequacy: ['adequacy'],
  pathologist: ['pathologist'],
};
const FIELD_LABELS = { biopsySite: 'Biopsy Site', biopsyMethod: 'Biopsy Method', clinicalHistory: 'Clinical History', grossDescription: 'Gross Description', microscopicDescription: 'Microscopic Description', diagnosis: 'Diagnosis', adequacy: 'Specimen Adequacy', pathologist: 'Pathologist' };

// Narrative fields that render as per-clause rows (split on BOTH commas and sentence terminators).
// All other fields stay atomic so JSX / Copy Section / Copy All / PDF agree (4-area parity).
const CLAUSE_FIELDS = ['clinicalHistory', 'grossDescription', 'microscopicDescription'];

// Abbreviations whose trailing period must NOT end a clause (so "Dr. Kim" stays one piece).
const ABBR_SET = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'sr', 'jr', 'st', 'gen', 'col', 'sgt', 'lt', 'capt', 'vs', 'etc', 'no', 'approx', 'fig', 'dx', 'hx']);
const endsWithAbbrev = (buf) => { const m = String(buf).trim().match(/(\w+)$/); return m ? ABBR_SET.has(m[1].toLowerCase()) : false; };

// Split a narrative string into clauses on BOTH commas AND sentence terminators (. ! ? ;).
// Paren/bracket-aware (inner commas/periods stay), decimal-safe (3.5 cm), thousands-safe (1,500),
// abbreviation-safe (Dr.). Returns [{ text, sep }] where sep is the ORIGINAL delimiter that
// followed the clause ('' for the last) so an edited field reconstructs losslessly — a comma is
// never turned into a period on round-trip.
const splitClauses = (text) => {
  if (!text || typeof text !== 'string') return [];
  const s = text.trim();
  const out = [];
  let buf = '', depth = 0;
  const flush = (sep) => { const t = buf.replace(/^[\s.;,!?]+/, '').replace(/[\s.;,!?]+$/, '').trim(); if (t) out.push({ text: t, sep }); buf = ''; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; buf += ch; continue; }
    const prev = s[i - 1] || '', next = s[i + 1] || '';
    let boundary = false;
    if (depth === 0) {
      if (ch === ',') boundary = !(/\d/.test(prev) && /\d/.test(next)); // keep 1,500 / 12,000
      else if (ch === '.' || ch === '!' || ch === '?' || ch === ';') boundary = (next === '' || /\s/.test(next)) && !(ch === '.' && /\d/.test(prev) && /\d/.test(next)) && !(ch === '.' && endsWithAbbrev(buf));
    }
    if (boundary) { flush(ch); while (i + 1 < s.length && /\s/.test(s[i + 1])) i++; continue; }
    buf += ch;
  }
  flush('');
  return out;
};
const splitClauseTexts = (text) => splitClauses(text).map(c => c.text);
const reconstructClauses = (clauses) => clauses.map(c => c.text + (c.sep || '')).join(' ').trim();

const BiopsyReportsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.biopsy_reports) return Array.isArray(r.biopsy_reports) ? r.biopsy_reports : [r.biopsy_reports]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biopsy_reports) return Array.isArray(dd.biopsy_reports) ? dd.biopsy_reports : [dd.biopsy_reports]; return [dd]; } return r; });
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
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BiopsyReports] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    if (sid) setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // Persist the field-level value as a DRAFT (no DB write). localStorage keeps it across refresh.
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = nv;
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
      // Pending editKeys for this record whose base field belongs to this section
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') && /^\d+$/.test(fieldPart.split('.').pop()) ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
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
        await sc.put(`/api/edit/biopsy_reports/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/biopsy_reports/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed fields from the localStorage drafts
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BiopsyReports] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  // Save one edited clause back into the field, PRESERVING every other clause's original separator
  // (comma stays comma, period stays period) so the stored value never gets corrupted on round-trip.
  function saveSentence(record, fn, idx, sid, sIdx, newText) {
    const cur = String(getFieldValue(record, fn, idx) || '');
    const clauses = splitClauses(cur);
    const cn = String(newText).replace(/^[\s.;,!?]+/, '').replace(/[\s.;,!?]+$/, '').trim();
    const co = ((clauses[sIdx] && clauses[sIdx].text) || '').trim();
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn) { // emptied → delete this clause and rebase the trailing edited-badge indices down by 1
      clauses.splice(sIdx, 1);
      setEditedSentences(prev => { const next = {}; Object.keys(prev).forEach(k => { const m = k.match(new RegExp(`^${fn}-${idx}-s(\\d+)$`)); if (!m) { next[k] = prev[k]; return; } const n = parseInt(m[1], 10); if (n === sIdx) return; if (n > sIdx) next[`${fn}-${idx}-s${n - 1}`] = prev[k]; else next[k] = prev[k]; }); return next; });
      handleSaveField(record, fn, idx, sid, null, reconstructClauses(clauses), `${fn}-${idx}`);
      return;
    }
    const before = clauses.length;
    if (clauses[sIdx]) clauses[sIdx] = { text: cn, sep: clauses[sIdx].sep }; else clauses.push({ text: cn, sep: '' });
    // If the edit introduced new delimiters, re-splitting yields extra rows → flag them 'added'.
    const added = Math.max(0, splitClauses(reconstructClauses(clauses)).length - before);
    setEditedSentences(prev => { const n = { ...prev, [`${fn}-${idx}-s${sIdx}`]: 'edited' }; for (let e = 1; e <= added; e++) n[`${fn}-${idx}-s${sIdx + e}`] = 'added'; return n; });
    handleSaveField(record, fn, idx, sid, null, reconstructClauses(clauses), `${fn}-${idx}`);
  }

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Biopsy Report ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.biopsySite, record.biopsyMethod, record.clinicalHistory, record.grossDescription, record.microscopicDescription, record.diagnosis, record.adequacy, record.pathologist, ...Object.values(FIELD_LABELS), 'Diagnosis', 'Specimen Information', 'Clinical History', 'Gross Description', 'Microscopic Description', 'Specimen Adequacy', 'Pathologist'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || ''); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fn] || fn}: ${dv}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const clauses = splitClauses(String(value));
    if (clauses.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const stm = sectionTitleMatches(FIELD_LABELS[fn] || fn);
    return (<>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}{clauses.map((clause, sIdx) => {
      const displayText = clause.text;
      if (searchTerm.trim() && !record._showAllSections && !stm && !phraseMatch(displayText, searchTerm)) return null;
      const sKey = `${fn}-${idx}-s${sIdx}`; const se = editingField === sKey; const sed = editedSentences[sKey]; const cid = `sent-${fn}-${idx}-${sIdx}`;
      if (se) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={sIdx} className="rec-mini-card"><div className={`numbered-row editable-row${sed ? ' modified' : ''}`} onClick={() => { setEditingField(sKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!sed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{sed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    })}</>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    const fs = SECTION_FIELDS[sid] || [];
    fs.forEach(f => { const v = pr[f]; if (v == null || String(v).trim() === '') return; if (CLAUSE_FIELDS.includes(f)) { const parts = splitClauseTexts(String(v)); if (parts.length > 1) { parts.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } else { text += `${v}\n`; } } else { text += `${v}\n`; } });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BIOPSY REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Biopsy Report ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      text += '\n';
      if (r.diagnosis) { text += 'DIAGNOSIS\n'; text += `${r.diagnosis}\n\n`; }
      if (r.biopsySite || r.biopsyMethod) { text += 'SPECIMEN INFORMATION\n'; if (r.biopsySite) text += `${r.biopsySite}\n`; if (r.biopsyMethod) text += `${r.biopsyMethod}\n`; text += '\n'; }
      CLAUSE_FIELDS.forEach(f => { if (r[f]) { text += `${FIELD_LABELS[f].toUpperCase()}\n`; const parts = splitClauseTexts(String(r[f])); parts.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; } });
      if (r.adequacy) { text += 'SPECIMEN ADEQUACY\n'; text += `${r.adequacy}\n\n`; }
      if (r.pathologist) { text += 'PATHOLOGIST\n'; text += `${r.pathologist}\n\n`; }
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="biopsy-reports-document"><header className="document-header"><h1 className="document-title">Biopsy Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="biopsy-reports-document">
      <header className="document-header">
        <h1 className="document-title">Biopsy Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BiopsyReportsDocumentPDFTemplate document={pdfData} />} fileName="Biopsy_Reports.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Biopsy Report ${idx + 1}`)}</h3></div>
            </div>

            {/* Diagnosis — editable, prominent */}
            {record.diagnosis && shouldShowSection(record, 'Diagnosis', [record.diagnosis], ['diagnosis']) && renderSection(record, idx, 'diagnosis', 'Diagnosis', renderEditableField(record, 'diagnosis', idx, 'diagnosis', true))}

            {/* Specimen Information — editable fields */}
            {(record.biopsySite || record.biopsyMethod) && shouldShowSection(record, 'Specimen Information', [record.biopsySite, record.biopsyMethod].filter(Boolean), ['biopsySite', 'biopsyMethod']) && renderSection(record, idx, 'specimen', 'Specimen Information', (() => { const stm = sectionTitleMatches('Specimen Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{(sa || fieldMatches(record, 'biopsySite', idx)) && renderEditableField(record, 'biopsySite', idx, 'specimen')}{(sa || fieldMatches(record, 'biopsyMethod', idx)) && renderEditableField(record, 'biopsyMethod', idx, 'specimen')}</>; })())}

            {/* Clinical History — sentence editable */}
            {record.clinicalHistory && shouldShowSection(record, 'Clinical History', [record.clinicalHistory], ['clinicalHistory']) && renderSection(record, idx, 'clinical', 'Clinical History', renderSentenceEditableField(record, 'clinicalHistory', idx, 'clinical', true))}

            {/* Gross Description — sentence editable */}
            {getFieldValue(record, 'grossDescription', idx) && shouldShowSection(record, 'Gross Description', [getFieldValue(record, 'grossDescription', idx)], ['grossDescription']) && renderSection(record, idx, 'gross', 'Gross Description', renderSentenceEditableField(record, 'grossDescription', idx, 'gross', true))}

            {/* Microscopic Description — sentence editable */}
            {getFieldValue(record, 'microscopicDescription', idx) && shouldShowSection(record, 'Microscopic Description', [getFieldValue(record, 'microscopicDescription', idx)], ['microscopicDescription']) && renderSection(record, idx, 'micro', 'Microscopic Description', renderSentenceEditableField(record, 'microscopicDescription', idx, 'micro', true))}

            {/* Specimen Adequacy — editable */}
            {record.adequacy && shouldShowSection(record, 'Specimen Adequacy', [record.adequacy], ['adequacy']) && renderSection(record, idx, 'adequacy', 'Specimen Adequacy', renderEditableField(record, 'adequacy', idx, 'adequacy', true))}

            {/* Pathologist — editable */}
            {record.pathologist && shouldShowSection(record, 'Pathologist', [record.pathologist], ['pathologist']) && renderSection(record, idx, 'pathologist', 'Pathologist', renderEditableField(record, 'pathologist', idx, 'pathologist', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BiopsyReportsDocument;
