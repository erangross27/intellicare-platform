/**
 * AutoimmunePanelsDocument.jsx
 * Inline editing with per-section approve, per-row copy,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AutoimmunePanelsDocumentPDFTemplate from '../pdf-templates/AutoimmunePanelsDocumentPDFTemplate';
import './AutoimmunePanelsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex" or "rootField.dotted.path") */
const DRAFT_KEY = 'autoimmune_panelsPendingEdits';
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
  recordInfo: ['orderingProvider', 'lab'],
  panelInfo: ['panelType', 'indication'],
  results: ['ana', 'dsDna', 'rheumatoidFactor', 'antiCcp', 'complement', 'anca'],
  enaPanel: ['enaPanel'],
  antiphospholipid: ['antiphospholipid'],
  interpretation: ['interpretation'],
  clinicalCorrelation: ['clinicalCorrelation'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  orderingProvider: 'Ordering Provider', lab: 'Lab',
  panelType: 'Panel Type', indication: 'Indication',
  ana: 'ANA', dsDna: 'Anti-dsDNA', rheumatoidFactor: 'Rheumatoid Factor',
  antiCcp: 'Anti-CCP', complement: 'Complement', anca: 'ANCA',
  enaPanel: 'ENA Panel', antiphospholipid: 'Antiphospholipid Antibodies',
  interpretation: 'Interpretation', clinicalCorrelation: 'Clinical Correlation', notes: 'Notes',
};

/* OBJECT fields rendered with recursive object renderer (dotted-path saves) */
const OBJECT_FIELDS = ['enaPanel', 'antiphospholipid'];

const KEY_OVERRIDES = {
  ro: 'Anti-Ro', la: 'Anti-La', sm: 'Anti-Sm', rnp: 'Anti-RNP', scl70: 'Scl-70', jo1: 'Jo-1',
  antiRo: 'Anti-Ro', antiLa: 'Anti-La', antiSm: 'Anti-Sm', antiRnp: 'Anti-RNP',
  anticardiolipin: 'Anticardiolipin', beta2Glycoprotein: 'Beta-2-Glycoprotein',
  lupusAnticoagulant: 'Lupus Anticoagulant', igg: 'IgG', igm: 'IgM', iga: 'IgA',
  ssa: 'SSA', ssb: 'SSB', ena: 'ENA',
};
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};

/* Scoped clause-split fields:
   - complement  → split on semicolon only ("C3 ...; C4 ...").
   - interpretation → split on semicolon AND comma, but NOT a comma inside (), between digits,
     before a year, or before the words "and"/"or".
   Commas elsewhere (e.g. ana "1:160, Speckled (Positive; reference <1:40)") are NOT touched. */
const SEMI_SPLIT_FIELDS = ['complement'];
const MIXED_SPLIT_FIELDS = ['interpretation'];
const CLAUSE_ABBREV = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|Lt|Capt|vs|etc|No|Fig|approx|Inc|Ltd)$/i;
/* Separator-preserving, paren-aware clause splitter. Returns [{text, sep}] where sep = the delimiter
   (+ trailing whitespace) that FOLLOWED text in the source ('' for the last clause), so
   parts.map(p => p.text + p.sep).join('') reproduces the original EXACTLY (lossless round-trip).
   Always splits on ';' and sentence-enders ('.', '!', '?' when followed by space/end and not an
   abbreviation). When includeComma, ALSO splits on a depth-0 ',' EXCEPT inside parens, between two
   digits ("1,500"), before a 4-digit year, or before the word "and"/"or". */
const splitClauses = (text, includeComma) => {
  if (!text || typeof text !== 'string') return [{ text: text || '', sep: '' }];
  const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    let isSep = false;
    if (depth === 0) {
      if (ch === ';') isSep = true;
      else if (ch === '.' || ch === '!' || ch === '?') { const next = text[i + 1]; if ((next === undefined || /\s/.test(next)) && !CLAUSE_ABBREV.test(current)) isSep = true; }
      else if (includeComma && ch === ',') {
        const prev = text[i - 1] || '', nx = text[i + 1] || '';
        const rest = text.slice(i + 1).trimStart();
        if (!((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest))) isSep = true;
      }
    }
    if (isSep) {
      let j = i + 1, ws = '';
      while (j < text.length && /\s/.test(text[j])) { ws += text[j]; j++; }
      const t = current.trim();
      if (t) parts.push({ text: t, sep: ch + ws });
      else if (parts.length) parts[parts.length - 1].sep += ch + ws;
      current = ''; i = j - 1;
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) parts.push({ text: tail, sep: '' });
  return parts.length ? parts : [{ text: String(text), sep: '' }];
};

const AutoimmunePanelsDocument = ({ document: rawDoc }) => {
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
      if (r?.autoimmune_panels) return Array.isArray(r.autoimmune_panels) ? r.autoimmune_panels : [r.autoimmune_panels];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoimmune_panels) return Array.isArray(dd.autoimmune_panels) ? dd.autoimmune_panels : [dd.autoimmune_panels]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const lastSeg = dotIdx === -1 ? '' : fieldPart.slice(fieldPart.lastIndexOf('.') + 1);
        if (dotIdx !== -1 && OBJECT_FIELDS.includes(fieldPart.slice(0, dotIdx)) && !/^\d+$/.test(lastSeg)) {
          // OBJECT leaf draft (e.g. "enaPanel.antiRo"): merge into the root field's cloned object.
          const rootField = fieldPart.slice(0, dotIdx);
          const path = fieldPart.slice(dotIdx + 1).split('.');
          const rootKey = `${rootField}-${idx}`;
          const base = nLocal[rootKey] !== undefined ? nLocal[rootKey] : record[rootField];
          const clone = JSON.parse(JSON.stringify(base ?? {}));
          let node = clone;
          for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] === undefined || node[path[i]] === null || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
          node[path[path.length - 1]] = value;
          nLocal[rootKey] = clone;
          nPending[rootKey] = true;
          nFields[`${rootField}-${idx}-${path.join('.')}`] = 'edited';
        } else {
          // Plain field or array-element draft: localEdits keyed by editKey (fieldPart-idx).
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          const baseField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
          nFields[`${baseField}-${idx}`] = 'edited';
          nSentences[`${baseField}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; }); };

  const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
  const splitByComma = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0); };

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[AutoimmunePanels] Cannot save — no record _id'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const akey = `${sid}-${idx}`; if (!prev[akey]) return prev; const n = { ...prev }; delete n[akey]; return n; });
    // Stage the field's full text as a DRAFT (fieldPart = the field name). No DB write.
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = nv;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setSaving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      // Collect this section's staged drafts (fieldPart belongs to one of this section's fields)
      const toCommit = Object.keys(recDrafts).filter(fieldPart => {
        const dotIdx = fieldPart.indexOf('.');
        const baseField = dotIdx === -1 ? fieldPart : fieldPart.slice(0, dotIdx);
        return sf.includes(baseField);
      });
      for (const fieldPart of toCommit) {
        const lastSeg = fieldPart.slice(fieldPart.lastIndexOf('.') + 1);
        const dotIdx = fieldPart.indexOf('.');
        // arrayIndex ONLY when the segment after the LAST dot is purely numeric; dotted object paths stay whole.
        const payload = { field: fieldPart, value: recDrafts[fieldPart] };
        if (dotIdx !== -1 && /^\d+$/.test(lastSeg)) { payload.field = fieldPart.slice(0, dotIdx); payload.arrayIndex = parseInt(lastSeg, 10); }
        const resp = await sc.put(`/api/edit/autoimmune_panels/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/autoimmune_panels/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending for this section's editKeys → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); });
        return n;
      });
      // Drop this section's drafts from localStorage (now committed)
      if (store[rid]) { toCommit.forEach(fp => { delete store[rid][fp]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[AutoimmunePanels] Approve failed:', err); } finally { setSaving(false); }
  }, []);

  function reconstructFullText(ss) { return ss.map((s, i) => { const t = s.trim(); if (i < ss.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }
  function saveSentence(record, fn, idx, sid, sIdx, newText) {
    const cur = String(getFieldValue(record, fn, idx) || ''); const cs = splitBySentence(cur);
    const cn = newText.trim(); const co = (cs[sIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn || cn.replace(/[.!?;,]+/g, '').trim() === '') { cs.splice(sIdx, 1); setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sIdx}`]: 'edited' })); handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`); return; }
    let nt = cn; if (nt && !nt.match(/[.!?;]$/)) nt += '.'; cs[sIdx] = nt;
    const ec = nt.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
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
      const title = `Autoimmune Panel ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.panelType, record.indication, record.ana, record.dsDna, record.rheumatoidFactor, record.antiCcp, record.complement, record.anca, flattenSearchable(record.enaPanel), flattenSearchable(record.antiphospholipid), record.interpretation, record.clinicalCorrelation, record.orderingProvider, record.lab, record.notes, ...Object.values(FIELD_LABELS), 'Record Information', 'Panel Information', 'Results', 'ENA Panel', 'Antiphospholipid Antibodies', 'Interpretation', 'Clinical Correlation', 'Notes'].filter(Boolean).join(' ');
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

  /* Save a nested OBJECT leaf by dot-path (e.g. enaPanel.antiRo). Booleans saved as boolean; lab values stay string. */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    const rootKey = `${rootField}-${idx}`;
    // Stage as a DRAFT (no DB write). localEdits holds the merged clone for rendering; the draft store
    // keeps the individual dotted leaf so Approve can PUT each leaf. Approve commits to MongoDB.
    setLocalEdits(prev => {
      const cur = prev[rootKey] !== undefined ? prev[rootKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [rootKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [rootKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const akey = `${sid}-${idx}`; if (!prev[akey]) return prev; const n = { ...prev }; delete n[akey]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][dottedField] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  /* OBJECT leaf: boolean -> Yes/No select; lab value -> string textarea (dotted-path save) */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'yes' : 'no') : leafValueString;
    const cid = `row-${leafKey}`;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(FIELD_LABELS[rootField] || rootField) && !phraseMatch(humanizeKey(path[path.length - 1]), searchTerm) && !phraseMatch(leafValueString, searchTerm)) return null;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={2} disabled={saving} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveLeaf(record, rootField, path, idx, sid, leafKey, editValue.trim()); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveLeaf(record, rootField, path, idx, sid, leafKey, isBool ? (editValue === 'yes') : editValue.trim()); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}: ${leafValueString}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* OBJECT node: recursive (humanizeKey + nested-mini-card; hide-empty at every level) */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
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

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const formatFieldForCopy = (fieldName, value) => {
    if (OBJECT_FIELDS.includes(fieldName)) {
      if (isEmptyDeep(value)) return '';
      const label = FIELD_LABELS[fieldName] || fieldName;
      let text = `${label}:\n`;
      Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 1).forEach(l => { text += `${l}\n`; }));
      return text;
    }
    if (!value) return '';
    const label = FIELD_LABELS[fieldName] || fieldName;
    if (SEMI_SPLIT_FIELDS.includes(fieldName) || MIXED_SPLIT_FIELDS.includes(fieldName)) {
      const items = splitClauses(String(value), MIXED_SPLIT_FIELDS.includes(fieldName)).map(p => p.text);
      if (items.length > 1) { let text = `${label}:\n`; items.forEach((it, i) => { text += `  ${i + 1}. ${it}\n`; }); return text; }
      return `${label}: ${value}\n`;
    }
    const parsed = parseLabel(String(value));
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      if (items.length > 1) {
        let text = `${label}:\n  ${parsed.label}:\n`;
        items.forEach((item, i) => { text += `    ${i + 1}. ${item}\n`; });
        return text;
      }
    }
    const ss = splitBySentence(String(value));
    if (ss.length > 1) {
      let text = `${label}:\n`;
      ss.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
      return text;
    }
    return `${label}: ${value}\n`;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; const fs = SECTION_FIELDS[sid] || []; let text = '';
    fs.forEach(f => { text += formatFieldForCopy(f, pr[f]); });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== AUTOIMMUNE PANELS ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Autoimmune Panel ${idx + 1}\n`; if (r.date) text += `Date: ${formatDate(r.date)}\n\n`;
      Object.entries(SECTION_FIELDS).forEach(([, fs]) => { fs.forEach(f => { text += formatFieldForCopy(f, r[f]); }); });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // Render labeled comma-split field (e.g., "Label: item1, item2, item3")
  const renderLabeledCommaField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx);
    if (!value) return null;
    const parsed = parseLabel(String(value));
    if (!parsed.isLabeled) return renderSentenceEditableField(record, fn, idx, sid, true);
    const items = splitByComma(parsed.value);
    if (items.length <= 1) return renderEditableField(record, fn, idx, sid, true);

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(parsed.label)}</div>
        {items.map((item, ci) => {
          const commaKey = `${fn}-${idx}-c${ci}`;
          const editedItem = localEdits[commaKey] !== undefined ? localEdits[commaKey] : item;
          const isEditing = editingField === commaKey;
          const isEdited = editedFields[commaKey];
          const cid = `row-${fn}-${idx}-c${ci}`;

          if (isEditing) {
            return (
              <div key={ci} className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      // Save comma item: reconstruct full text
                      const curValue = String(getFieldValue(record, fn, idx) || '');
                      const curParsed = parseLabel(curValue);
                      const curItems = splitByComma(curParsed.value);
                      curItems[ci] = editValue.trim();
                      const filtered = curItems.filter(p => p.length > 0);
                      const newFull = `${curParsed.label}: ${filtered.join(', ')}`;
                      setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' }));
                      handleSaveField(record, fn, idx, sid, null, newFull, `${fn}-${idx}`);
                    }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }}
                  autoFocus rows={1} disabled={saving} />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => {
                    const curValue = String(getFieldValue(record, fn, idx) || '');
                    const curParsed = parseLabel(curValue);
                    const curItems = splitByComma(curParsed.value);
                    curItems[ci] = editValue.trim();
                    const filtered = curItems.filter(p => p.length > 0);
                    const newFull = `${curParsed.label}: ${filtered.join(', ')}`;
                    setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' }));
                    handleSaveField(record, fn, idx, sid, null, newFull, `${fn}-${idx}`);
                  }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(parsed.label) && !sectionTitleMatches('Notes') && !phraseMatch(editedItem, searchTerm)) return null;

          return (
            <React.Fragment key={ci}>
              <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(commaKey); setEditValue(String(editedItem)); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(String(editedItem))}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(editedItem), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Save one clause (round-trip safe): re-split CURRENT value, replace/splice clause ci (preserving its
  // separator), rejoin. Empty edit deletes the clause. Lossless because every split point kept its sep.
  const saveClauseItem = (record, fn, idx, sid, ci, ck, includeComma, newText) => {
    const cur = String(getFieldValue(record, fn, idx) || '');
    const parts = splitClauses(cur, includeComma);
    if (ci < 0 || ci >= parts.length) { setEditingField(null); setEditValue(''); return; }
    const clean = newText.trim();
    if (clean) parts[ci] = { text: clean, sep: parts[ci].sep };
    else { parts.splice(ci, 1); if (parts.length) parts[parts.length - 1] = { text: parts[parts.length - 1].text, sep: '' }; }
    setEditedSentences(prev => ({ ...prev, [ck]: 'edited' }));
    handleSaveField(record, fn, idx, sid, null, parts.map(p => p.text + p.sep).join(''), `${fn}-${idx}`);
  };

  // Render a clause-split field. includeComma: semicolon-only (complement) vs semicolon+guarded-comma
  // (interpretation). hideLabel=false → one rec-mini-card with the field label as a nested-subtitle
  // (Results sibling style); hideLabel=true → each clause its own rec-mini-card (section already titled).
  const renderClauseField = (record, fn, idx, sid, includeComma, hideLabel) => {
    const value = getFieldValue(record, fn, idx);
    if (!value && localEdits[`${fn}-${idx}`] === undefined) return null;
    const parts = splitClauses(String(value || ''), includeComma);
    if (parts.length <= 1) return hideLabel ? renderSentenceEditableField(record, fn, idx, sid, true) : renderEditableField(record, fn, idx, sid, false);
    const label = FIELD_LABELS[fn] || fn;
    const vis = parts.map((p, oi) => ({ text: p.text, _ci: oi })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(label)) return true;
      return phraseMatch(item.text, searchTerm);
    });
    if (vis.length === 0) return null;
    const renderRow = (text, ci) => {
      const ck = `${fn}-${idx}-c${ci}`; const ie = editingField === ck; const ed = editedSentences[ck]; const cid = `row-${fn}-${idx}-c${ci}`;
      if (ie) return (<div className="edit-field-container" key={`e${ci}`}><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveClauseItem(record, fn, idx, sid, ci, ck, includeComma, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveClauseItem(record, fn, idx, sid, ci, ck, includeComma, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<React.Fragment key={ci}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(text); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
    };
    if (hideLabel) return (<>{vis.map(({ text, _ci }) => <div key={_ci} className="rec-mini-card">{renderRow(text, _ci)}</div>)}</>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{vis.map(({ text, _ci }) => renderRow(text, _ci))}</div>);
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return (<article className="autoimmune-panels-document"><header className="document-header"><h1 className="document-title">Autoimmune Panels</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No autoimmune panel data available.</div></article>);
  }

  return (
    <article className="autoimmune-panels-document">
      <header className="document-header">
        <h1 className="document-title">Autoimmune Panels</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<AutoimmunePanelsDocumentPDFTemplate document={pdfData} />} fileName="Autoimmune_Panels.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Autoimmune Panel ${idx + 1}`)}</h3></div>
            </div>

            {(() => { const hd = [record.orderingProvider, record.lab].some(v => v && String(v).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Record Information', [record.orderingProvider, record.lab].filter(Boolean), ['orderingProvider', 'lab'])) return null; const stm = sectionTitleMatches('Record Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'recordInfo', 'Record Information', <>{(sa || fieldMatches(record, 'orderingProvider', idx)) && renderEditableField(record, 'orderingProvider', idx, 'recordInfo')}{(sa || fieldMatches(record, 'lab', idx)) && renderEditableField(record, 'lab', idx, 'recordInfo')}</>); })()}

            {(() => { if (!shouldShowSection(record, 'Panel Information', [record.panelType, record.indication].filter(Boolean), ['panelType', 'indication'])) return null; const stm = sectionTitleMatches('Panel Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'panelInfo', 'Panel Information', <>{(sa || fieldMatches(record, 'panelType', idx)) && renderEditableField(record, 'panelType', idx, 'panelInfo')}{(sa || fieldMatches(record, 'indication', idx)) && renderEditableField(record, 'indication', idx, 'panelInfo')}</>); })()}

            {(() => { const resultFields = ['ana', 'dsDna', 'rheumatoidFactor', 'antiCcp', 'complement', 'anca']; const hd = resultFields.some(f => record[f] && String(record[f]).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Results', resultFields.map(f => record[f]).filter(Boolean), resultFields)) return null; const stm = sectionTitleMatches('Results'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'results', 'Results', <>{resultFields.map(f => (sa || fieldMatches(record, f, idx)) ? <React.Fragment key={f}>{f === 'complement' ? renderClauseField(record, f, idx, 'results', false, false) : renderEditableField(record, f, idx, 'results')}</React.Fragment> : null)}</>); })()}

            {(() => { const v = getFieldValue(record, 'enaPanel', idx); if (isEmptyDeep(v)) return null; if (!shouldShowSection(record, 'ENA Panel', [flattenSearchable(v)], ['enaPanel'])) return null; return renderSection(record, idx, 'enaPanel', 'ENA Panel', renderObjectField(record, 'enaPanel', idx, 'enaPanel')); })()}

            {(() => { const v = getFieldValue(record, 'antiphospholipid', idx); if (isEmptyDeep(v)) return null; if (!shouldShowSection(record, 'Antiphospholipid Antibodies', [flattenSearchable(v)], ['antiphospholipid'])) return null; return renderSection(record, idx, 'antiphospholipid', 'Antiphospholipid Antibodies', renderObjectField(record, 'antiphospholipid', idx, 'antiphospholipid')); })()}

            {getFieldValue(record, 'interpretation', idx) && shouldShowSection(record, 'Interpretation', [getFieldValue(record, 'interpretation', idx)], ['interpretation']) && renderSection(record, idx, 'interpretation', 'Interpretation', renderClauseField(record, 'interpretation', idx, 'interpretation', true, true))}

            {getFieldValue(record, 'clinicalCorrelation', idx) && shouldShowSection(record, 'Clinical Correlation', [getFieldValue(record, 'clinicalCorrelation', idx)], ['clinicalCorrelation']) && renderSection(record, idx, 'clinicalCorrelation', 'Clinical Correlation', renderSentenceEditableField(record, 'clinicalCorrelation', idx, 'clinicalCorrelation', true))}

            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderLabeledCommaField(record, 'notes', idx, 'notes'))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default AutoimmunePanelsDocument;
