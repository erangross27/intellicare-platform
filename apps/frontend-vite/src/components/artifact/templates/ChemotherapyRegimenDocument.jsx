/**
 * ChemotherapyRegimenDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + sentence-split + drugs (display-only objects). Collection: chemotherapy_regimen
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChemotherapyRegimenDocumentPDFTemplate from '../pdf-templates/ChemotherapyRegimenDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import './ChemotherapyRegimenDocument.css';

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
// Fixed-choice string fields → dropdown (casing matches stored values).
const ENUM_FIELDS = { status: ['active', 'not active'], intent: ['curative', 'palliative', 'neoadjuvant', 'adjuvant'] };
// Real booleans → Yes/No dropdown (stored as true/false).
const BOOLEAN_FIELDS = new Set(['growthFactorSupport']);

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value, arrayIndex? } } }
   The stored payload is exactly the DB /edit body so Approve can replay it verbatim. */
const DRAFT_KEY = 'chemotherapy_regimenPendingEdits';
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
  regimen: ['regimenName', 'intent', 'cycleLength', 'totalCycles', 'growthFactorSupport', 'status'],
  header: ['date'],
  provider: ['provider', 'facility'],
  drugs: ['drugs'],
  premedications: ['premedications'],
  results: ['results'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  notes: ['notes'],
  recommendations: ['recommendations'],
};
const FIELD_LABELS = {
  regimenName: 'Regimen Name', intent: 'Intent', cycleLength: 'Cycle Length', totalCycles: 'Total Cycles', growthFactorSupport: 'Growth Factor Support', status: 'Status',
  date: 'Date',
  provider: 'Provider', facility: 'Facility',
  results: 'Results', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
};
const ARRAY_FIELDS = ['premedications', 'recommendations'];
const SENTENCE_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan']);
const LABEL_SENTENCE_FIELDS = new Set(['notes']);
const OBJECT_FIELDS = new Set(['results']);
const DATE_FIELDS = new Set(['date']);

const KEY_OVERRIDES = { ef: 'EF', lvef: 'LVEF', bsa: 'BSA', auc: 'AUC', bun: 'BUN', wbc: 'WBC', anc: 'ANC', hgb: 'HGB', plt: 'PLT', gfr: 'GFR', ecog: 'ECOG' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return !isEmptyDeep(v); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Split on sentence end, but NOT after an abbreviation ("vs.", "Dr.", etc.) or a decimal ("3.5").
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
const formatDrug = (d) => { if (!d || typeof d !== 'object') return ''; return [d.name, d.dose, d.route, d.schedule].filter(Boolean).join(' - '); };
const formatDateDisplay = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } };

const ChemotherapyRegimenDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.chemotherapy_regimen) return Array.isArray(r.chemotherapy_regimen) ? r.chemotherapy_regimen : [r.chemotherapy_regimen];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chemotherapy_regimen) return Array.isArray(dd.chemotherapy_regimen) ? dd.chemotherapy_regimen : [dd.chemotherapy_regimen]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT DB/PDF).
  // Each stored entry carries { editKey, localValue, edited } for exact render-state restore plus the
  // DB payload (field/value/arrayIndex) that Approve replays.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nEdited = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((entry) => {
        if (!entry || entry.idx !== idx) return;
        if (entry.editKey) {
          const dbField = String(entry.field || '');
          const dotIdx = dbField.indexOf('.');
          // Dotted DB field with a NON-numeric leaf = object-clone field (e.g. results.ef): rebuild the
          // clone from the record + each leaf's field/value so multiple edited leaves all survive,
          // independent of stored-snapshot freshness or iteration order. (arrayIndex keys aren't dotted.)
          const isObjectLeaf = dotIdx !== -1 && typeof entry.arrayIndex !== 'number';
          if (isObjectLeaf) {
            const rootField = dbField.slice(0, dotIdx);
            const path = dbField.slice(dotIdx + 1).split('.');
            const base = nLocal[entry.editKey] !== undefined ? nLocal[entry.editKey] : record[rootField];
            const clone = JSON.parse(JSON.stringify(base ?? {}));
            let node = clone;
            for (let i = 0; i < path.length - 1; i++) { if (node[path[i]] == null || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
            node[path[path.length - 1]] = entry.value;
            nLocal[entry.editKey] = clone;
          } else {
            nLocal[entry.editKey] = entry.localValue;
          }
          nPending[entry.editKey] = true;
        }
        if (entry.editedKey) nEdited[entry.editedKey] = entry.editedState || 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nEdited, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx, excludePending = false) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (excludePending && pendingEdits[ek]) return; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF/Copy until the user clicks Pending Approve.
  // `entry` is the DB /edit body Approve will replay: { field, value, arrayIndex? }.
  // `editKey`/`localValue` restore the render state; `editedKey`/`editedState` restore the badge;
  // `sid`/`idx` re-open the approve button. Re-edit after approval clears the approved flag.
  const stageDraft = useCallback((record, idx, sid, editKey, localValue, editedKey, dbEntry, editedState = 'edited') => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChemotherapyRegimen] Cannot stage — no record ID'); return; }
    setLocalEdits(prev => ({ ...prev, [editKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editedKey]: editedState }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][editKey] = { idx, editKey, localValue, editedKey, editedState, ...dbEntry };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid, overrideValue) => {
    const val = overrideValue !== undefined ? overrideValue : editValue;
    const ek = `${fn}-${idx}`;
    stageDraft(record, idx, sid, ek, val, ek, { field: fn, value: val });
  }, [editValue, stageDraft]);

  // Stage a nested OBJECT leaf draft by dot-path (e.g. results.ef) — value stays a STRING/bool.
  // localEdits holds the accumulated object clone under `${rootField}-${idx}` (so multiple edited
  // leaves co-exist for rendering); the draft store keeps ONE entry PER LEAF so Approve replays the
  // exact dotted DB write (field = `${rootField}.${path}`, NOT an arrayIndex — dotted leaf name).
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChemotherapyRegimen] Cannot stage leaf — no record ID'); return; }
    const rootKey = `${rootField}-${idx}`;
    const dottedField = `${rootField}.${path.join('.')}`;
    let cloneForStore;
    setLocalEdits(prev => {
      const cur = prev[rootKey] !== undefined ? prev[rootKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      cloneForStore = clone;
      return { ...prev, [rootKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [rootKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    // Per-leaf draft entry. rootKey/clone restore the rendered object; field/value replay the DB write.
    store[rid][leafKeyTrack] = { idx, editKey: rootKey, localValue: cloneForStore, editedKey: leafKeyTrack, editedState: 'edited', field: dottedField, value: newVal };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const ek = `${fn}-${idx}-${arrayIndex}`;
    stageDraft(record, idx, sid, ek, editValue, ek, { field: fn, value: editValue, arrayIndex });
  }, [editValue, stageDraft]);

  // Edit one sentence → reconstruct full field text, then STAGE a draft (no DB write). The s-level
  // editedFields markers (edited/added) are kept exactly as before; Approve replays { field: fn, value }.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChemotherapyRegimen] Cannot stage sentence — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const originalSentence = sentences[sentenceIdx];
    const editedVal = editValue.trim();
    const editedKey = `${fn}-${idx}`;
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); }
    else { const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== (originalSentence || '').replace(/[;.]+$/, '').trim(); setEditedFields(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); } else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); } }
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][ek] = { idx, editKey: ek, localValue: newValue, editedKey, editedState: 'edited', field: fn, value: newValue };
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so committed values
  // flow into pdfData/PDF/Copy. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      const sc = (await import('../../../services/secureApiClient')).default;
      // Only this section's fields: a draft entry belongs to the section if its DB field's root
      // (before any dot) is one of the section's field names AND it targets this record index.
      const toCommit = Object.entries(recDrafts).filter(([, e]) => {
        if (!e || e.idx !== idx) return false;
        const rootField = String(e.field || '').split('.')[0];
        return sf.includes(rootField);
      });
      for (const [, e] of toCommit) {
        const payload = { field: e.field, value: e.value };
        if (typeof e.arrayIndex === 'number') payload.arrayIndex = e.arrayIndex;
        const resp = await sc.put(`/api/edit/chemotherapy_regimen/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/chemotherapy_regimen/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      const committedKeys = toCommit.map(([, e]) => e.editKey);
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      toCommit.forEach(([dk]) => delete recDrafts[dk]);
      if (Object.keys(recDrafts).length === 0) delete store[rid]; else store[rid] = recDrafts;
      writeDrafts(store);
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChemotherapyRegimen] Approve failed:', err); }
    finally { setApproving(false); }
  }, []);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Chemotherapy Regimen ${idx + 1}`;
      const drugsText = Array.isArray(record.drugs) ? record.drugs.map(formatDrug).join(' ') : '';
      const allText = [title, formatDate(record.date), record.regimenName, record.intent, record.cycleLength, record.totalCycles, fmtVal(record.growthFactorSupport), record.status, record.findings, record.assessment, record.plan, record.notes, record.provider, record.facility, drugsText, flattenSearchable(record.results), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Regimen Details', 'Drugs', 'Premedications', 'Results', 'Findings', 'Assessment', 'Plan', 'Notes', 'Recommendations'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const isBool = BOOLEAN_FIELDS.has(fn);
    const enumOpts = ENUM_FIELDS[fn];
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">
      {isBool ? (
        <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select>
      ) : enumOpts ? (
        <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
          {!enumOpts.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
          {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
      )}
      <div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid, isBool ? (editValue === 'Yes') : undefined)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitField = (record, fn, idx, sid, showLabel = true) => {
    const sentences = getEffectiveSentences(record, fn, idx);
    if (sentences.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {sentences.map((sentence, si) => {
          const sk = `${fn}-${idx}-s${si}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}`;
          if (ie) return (<div key={si} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, si); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, si)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={si}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentence); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className={`modified-badge${ed === 'added' ? ' added' : ''}`}>{ed === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const renderLabelSentenceField = (record, fn, idx, sid) => {
    const sentences = getEffectiveSentences(record, fn, idx);
    if (sentences.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {sentences.map((sentence, si) => {
          const colonIdx = sentence.indexOf(':');
          const label = colonIdx > 0 && colonIdx < 40 ? sentence.substring(0, colonIdx).trim() : null;
          const content = label ? sentence.substring(colonIdx + 1).trim() : sentence;
          const sk = `${fn}-${idx}-s${si}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}`;
          if (ie) return (<div key={si}>{label && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, si); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, si)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
          return (<React.Fragment key={si}>{label && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentence); }}><div className="row-content"><span className="content-value">{highlightText(content)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(content, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className={`modified-badge${ed === 'added' ? ' added' : ''}`}>{ed === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const renderDateField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const displayVal = formatDateDisplay(raw);
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`; const ie = editingField === leafKey; const ed = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'yes' : 'no') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {ie ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="yes">Yes</option><option value="no">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
              )}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? (editValue === 'yes') : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div>
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button></>
          )}
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

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

  const renderObjectField = (record, fn, idx, sid, showLabel = true) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx, true); }); return m; });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { header: 'DATE', regimen: 'REGIMEN DETAILS', provider: 'PROVIDER INFORMATION', drugs: 'DRUGS', premedications: 'PREMEDICATIONS', results: 'RESULTS', findings: 'FINDINGS', assessment: 'ASSESSMENT', plan: 'PLAN', notes: 'NOTES', recommendations: 'RECOMMENDATIONS' };

  // object → copy lines: scalar leaf = label + DASH + "1. value"; nested key = heading + DASH
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { if (label) { out.push(`${pad}${label}`); out.push(`${pad}${COPY_LINE_DASH}`); } out.push(`${pad}1. ${fmtScalar(value)}`); return out; }
    if (label) { out.push(`${pad}${label}`); out.push(`${pad}${COPY_LINE_DASH}`); }
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    // single-name rule: label == section title → hide the label (title already shown)
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const emitLabel = (fn) => { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; };
    const addF = (fn) => { if (hasVal(pr[fn])) { emitLabel(fn); text += `1. ${fmtVal(pr[fn])}\n\n`; } };
    const addDate = (fn) => { if (hasVal(pr[fn])) { emitLabel(fn); text += `1. ${formatDateDisplay(pr[fn])}\n\n`; } };
    const addObj = (fn) => { if (!hasVal(pr[fn]) || isScalar(pr[fn])) return; Object.entries(pr[fn]).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); text += '\n'; };
    const addSentenceSplit = (fn) => { if (!hasVal(pr[fn])) return; emitLabel(fn); splitBySentence(String(pr[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; };
    if (sid === 'drugs') { (pr.drugs || []).forEach((d) => { text += `${d.name || 'Drug'}\n${COPY_LINE_DASH}\n1. ${[d.dose, d.route, d.schedule].filter(Boolean).join(' — ')}\n\n`; }); }
    else if (sid === 'premedications' || sid === 'recommendations') { getEffectiveArray(pr, sid, idx, true).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (DATE_FIELDS.has(fn)) addDate(fn); else if (OBJECT_FIELDS.has(fn)) addObj(fn); else if (LABEL_SENTENCE_FIELDS.has(fn)) { if (hasVal(pr[fn])) { splitBySentence(String(pr[fn])).forEach(s => { const ci = s.indexOf(':'); const lbl = ci > 0 && ci < 40 ? s.substring(0, ci).trim() : (showLbl(fn) ? FIELD_LABELS[fn] : null); const cnt = ci > 0 && ci < 40 ? s.substring(ci + 1).trim() : s; if (lbl) text += `${lbl}\n${COPY_LINE_DASH}\n`; text += `1. ${cnt.replace(/[.;]+$/, '').trim()}\n\n`; }); } } else if (SENTENCE_SPLIT_FIELDS.has(fn)) { addSentenceSplit(fn); } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CHEMOTHERAPY REGIMEN\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Chemotherapy Regimen ${idx + 1}\n${COPY_LINE_EQ}\n`;
      let curTitle = '';
      const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== curTitle.toLowerCase();
      const addF = (fn) => { if (hasVal(r[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } };
      const addSentenceSplit = (fn) => { if (!hasVal(r[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`; splitBySentence(String(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; };
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx, true); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const addLabelSentence = (fn) => { if (!hasVal(r[fn])) return; splitBySentence(String(r[fn])).forEach(s => { const ci = s.indexOf(':'); const lbl = ci > 0 && ci < 40 ? s.substring(0, ci).trim() : (showLbl(fn) ? FIELD_LABELS[fn] : null); const cnt = ci > 0 && ci < 40 ? s.substring(ci + 1).trim() : s; if (lbl) text += `${lbl}\n${COPY_LINE_DASH}\n`; text += `1. ${cnt.replace(/[.;]+$/, '').trim()}\n\n`; }); };
      if (hasVal(r.date)) { text += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}\n\n`; }
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { curTitle = title; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (LABEL_SENTENCE_FIELDS.has(fn)) addLabelSentence(fn); else if (SENTENCE_SPLIT_FIELDS.has(fn)) addSentenceSplit(fn); else addF(fn); }); } };
      simpleFs('REGIMEN DETAILS', SECTION_FIELDS.regimen);
      simpleFs('PROVIDER INFORMATION', SECTION_FIELDS.provider);
      if (Array.isArray(r.drugs) && r.drugs.length) { text += `\nDRUGS\n${COPY_LINE_EQ}\n`; r.drugs.forEach((d) => { text += `${d.name || 'Drug'}\n${COPY_LINE_DASH}\n1. ${[d.dose, d.route, d.schedule].filter(Boolean).join(' — ')}\n\n`; }); }
      addArr('PREMEDICATIONS', 'premedications');
      if (hasVal(r.results) && !isScalar(r.results)) { text += `\nRESULTS\n${COPY_LINE_EQ}\n`; Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
      simpleFs('FINDINGS', ['findings']);
      simpleFs('ASSESSMENT', ['assessment']);
      simpleFs('PLAN', ['plan']);
      simpleFs('NOTES', ['notes']);
      addArr('RECOMMENDATIONS', 'recommendations');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (DATE_FIELDS.has(f)) return <React.Fragment key={f}>{renderDateField(record, f, idx, sid, sl)}</React.Fragment>; if (OBJECT_FIELDS.has(f)) return <React.Fragment key={f}>{renderObjectField(record, f, idx, sid, sl)}</React.Fragment>; if (LABEL_SENTENCE_FIELDS.has(f)) return <React.Fragment key={f}>{renderLabelSentenceField(record, f, idx, sid)}</React.Fragment>; if (SENTENCE_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderSentenceSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  const renderDrugsSection = (record, idx) => {
    const drugs = Array.isArray(record.drugs) ? record.drugs.filter(Boolean) : [];
    if (drugs.length === 0) return null;
    const drugsText = drugs.map(formatDrug);
    if (!shouldShowSection(record, 'Drugs', drugsText, ['drugs'])) return null;
    return renderSection(record, idx, 'drugs', 'Drugs', (
      <div className="rec-mini-card">
        {drugs.map((drug, di) => {
          const cid = `drug-${idx}-${di}`;
          return (
            <React.Fragment key={di}>
              {drug.name && <div className="nested-subtitle">{highlightText(drug.name)}</div>}
              <div className="numbered-row">
                <div className="row-content"><span className="content-value">{highlightText([drug.dose, drug.route, drug.schedule].filter(Boolean).join(' — '))}</span></div>
                <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={() => copyToClipboard(formatDrug(drug), cid)}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    ));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="chemotherapy-regimen-document"><header className="document-header"><h1 className="document-title">Chemotherapy Regimen</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="chemotherapy-regimen-document">
      <header className="document-header">
        <h1 className="document-title">Chemotherapy Regimen</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChemotherapyRegimenDocumentPDFTemplate document={pdfData} />} fileName="Chemotherapy_Regimen.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {/* date renders in its own Date section — no duplicate pill here */}
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Chemotherapy Regimen ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'header', 'Date', SECTION_FIELDS.header)}
            {renderMultiFieldSection(record, idx, 'regimen', 'Regimen Details', SECTION_FIELDS.regimen)}
            {renderMultiFieldSection(record, idx, 'provider', 'Provider Information', SECTION_FIELDS.provider)}
            {renderDrugsSection(record, idx)}
            {renderArraySection(record, idx, 'premedications', 'Premedications', 'premedications')}
            {renderMultiFieldSection(record, idx, 'results', 'Results', SECTION_FIELDS.results)}
            {renderMultiFieldSection(record, idx, 'findings', 'Findings', SECTION_FIELDS.findings)}
            {renderMultiFieldSection(record, idx, 'assessment', 'Assessment', ['assessment'])}
            {renderMultiFieldSection(record, idx, 'plan', 'Plan', ['plan'])}
            {renderMultiFieldSection(record, idx, 'notes', 'Notes', ['notes'])}
            {renderArraySection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChemotherapyRegimenDocument;
