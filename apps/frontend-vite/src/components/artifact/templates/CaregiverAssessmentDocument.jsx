/**
 * CaregiverAssessmentDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * FULL TEMPLATE STANDARD — 100% coverage of all 17 non-system fields.
 *   - PER-SENTENCE narratives: caregiverBurden, caregiverHealth, financialStrain, findings, assessment, plan, notes
 *   - ARRAYS (renderArrayField): supportServices, educationProvided
 *   - OBJECT-ARRAY (renderRecommendationsField): recommendations (array of {recommendation, date})
 *   - OBJECT (recursive renderObjectNode/renderObjectLeaf): results
 *   - DATE picker (renderDateField): date (record-header)
 *   - BOOLEAN Yes/No select: respiteNeeds
 *   - SIMPLE single-line: primaryCaregiver, provider, facility, status
 * Collection: caregiver_assessment
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CaregiverAssessmentDocumentPDFTemplate from '../pdf-templates/CaregiverAssessmentDocumentPDFTemplate';
import './CaregiverAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve. Kept in a
   SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, payload } } }
     - editKey mirrors the in-memory localEdits key (e.g. "findings-0", "supportServices-0-2", "results-0")
     - value      = what localEdits[editKey] should hold (string | boolean | array | cloned object)
     - payload    = the EXACT body the save handler would have PUT to /api/edit (field, value, [arrayIndex]) */
const DRAFT_KEY = 'caregiver_assessmentPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  caregiver: ['primaryCaregiver', 'caregiverHealth', 'respiteNeeds'],
  burden: ['caregiverBurden', 'financialStrain'],
  support: ['supportServices'],
  education: ['educationProvided'],
  clinical: ['findings', 'assessment', 'plan'],
  recommendationsSection: ['recommendations'],
  resultsSection: ['results'],
  notesSection: ['notes'],
  providerInfo: ['provider', 'facility', 'status'],
  // DATE header section — must be here so sectionHasEdits/handleApproveSection can see date edits
  // (memory 6a449110: an editable field outside SECTION_FIELDS can never be approved).
  // Intentionally NOT in SECTION_ORDER/SECTION_TITLES: it renders via its own shell in the record loop.
  dateHeader: ['date'],
};
const SECTION_TITLES = {
  caregiver: 'CAREGIVER INFORMATION', burden: 'BURDEN & STRAIN', support: 'SUPPORT SERVICES',
  education: 'EDUCATION PROVIDED', clinical: 'CLINICAL', recommendationsSection: 'RECOMMENDATIONS',
  resultsSection: 'RESULTS', notesSection: 'NOTES', providerInfo: 'PROVIDER INFORMATION',
};
const FIELD_LABELS = {
  primaryCaregiver: 'Primary Caregiver', caregiverHealth: 'Caregiver Health', respiteNeeds: 'Respite Needs',
  caregiverBurden: 'Caregiver Burden', financialStrain: 'Financial Strain',
  supportServices: 'Support Services', educationProvided: 'Education Provided',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', notes: 'Notes',
  provider: 'Provider', facility: 'Facility', status: 'Status', date: 'Date',
};
const ARRAY_FIELDS = ['supportServices', 'educationProvided'];
const SENTENCE_FIELDS = ['caregiverBurden', 'caregiverHealth', 'financialStrain', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['respiteNeeds'];
const SIMPLE_FIELDS = ['primaryCaregiver', 'provider', 'facility', 'status'];
// Fixed-choice fields → dropdown editor instead of textarea (stored value stays a plain string).
const ENUM_FIELDS = { status: ['active', 'not active'] };

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const hasVal = (v) => !isEmptyDeep(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;,.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[,;]+$/, ''); return i < sentences.length - 1 ? t + ',' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };
const toInputDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; } };
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };
/* Copy-text divider lines: '=' under section titles, '-' under nested subtitles (field labels / object keys). */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const CaregiverAssessmentDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.caregiver_assessment) return Array.isArray(r.caregiver_assessment) ? r.caregiver_assessment : [r.caregiver_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.caregiver_assessment) return Array.isArray(dd.caregiver_assessment) ? dd.caregiver_assessment : [dd.caregiver_assessment]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

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
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        // editKeys are stored verbatim; only adopt the ones whose index segment equals this idx
        const ld = editKey.lastIndexOf('-');
        const tail = editKey.substring(ld + 1);
        const idxSegMatches = /^\d+$/.test(tail)
          ? parseInt(tail, 10) === idx                       // "field-idx"  (whole-field / sentence-source / object / recommendations)
          : (() => { const rest = editKey.substring(0, ld); const ld2 = rest.lastIndexOf('-'); return parseInt(rest.substring(ld2 + 1), 10) === idx; })(); // "field-idx-arrayIndex"
        if (!idxSegMatches) return;
        nLocal[editKey] = draft.value;
        nPending[editKey] = true;
        // Mark edited so the field shows the modified badge + the section shows Pending Approve.
        nFields[editKey] = 'edited';
        // Sentence fields stage under "${fn}-${idx}" but the badge is keyed per-sentence; also flag s0.
        const fnPart = /^\d+$/.test(tail) ? editKey.substring(0, ld) : editKey;
        if (SENTENCE_FIELDS.includes(fnPart)) nFields[`${editKey}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  // Effective array INCLUDING pending drafts — for the editable JSX rows.
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);
  // Committed-only array (pending drafts reverted) — for Copy Section / Copy All so drafts stay out.
  const getCommittedArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  // Stage a DRAFT to localStorage + memory. No DB write — handleApproveSection commits on Approve.
  const stageDraft = useCallback((rid, editKey, value, payload) => {
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][editKey] = { value, payload };
    writeDrafts(store);
  }, []);

  // Save = stage a DRAFT locally (localStorage survives refresh). NOT written to MongoDB and NOT
  // shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const valToSave = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: valToSave }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(rid, ek, valToSave, { field: fn, value: valToSave });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(rid, ek, editValue, { field: fn, value: editValue, arrayIndex });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, stageDraft]);

  /* stage a nested OBJECT leaf by dot-path (e.g. results.score) — value stays a STRING */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const ek = `${rootField}-${idx}`;
    // Build the updated clone from the current effective value (localEdits override or original).
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    setLocalEdits(prev => ({ ...prev, [ek]: clone }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // payload commits ONLY the leaf via dot-path; localEdits value is the full cloned object for rendering.
    stageDraft(rid, ek, clone, { field: dottedField, value: newVal });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [localEdits, stageDraft]);

  /* stage a recommendations[] object item's .recommendation text */
  const saveRecommendation = useCallback((record, fn, idx, sid, rIdx, itemKey, newText) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
    const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: newText.trim() } : { ...r });
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newArr }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [itemKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(rid, ek, newArr, { field: fn, value: newArr });
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [getFieldValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      // Persist each staged field that belongs to THIS section.
      const sf = SECTION_FIELDS[sid] || [];
      const toCommit = Object.keys(recDrafts).filter(ek => {
        if (!pendingEdits[ek]) return false;
        // ek = "field-idx" (whole-field/sentence/object/recommendations) or "field-idx-arrayIndex".
        const ld = ek.lastIndexOf('-'); const tail = ek.substring(ld + 1);
        let fnPart, ekIdx;
        if (/^\d+$/.test(tail)) {            // "field-idx"
          fnPart = ek.substring(0, ld); ekIdx = parseInt(tail, 10);
        } else {                              // "field-idx-arrayIndex"
          const rest = ek.substring(0, ld); const ld2 = rest.lastIndexOf('-');
          fnPart = rest.substring(0, ld2); ekIdx = parseInt(rest.substring(ld2 + 1), 10);
        }
        return ekIdx === idx && sf.includes(fnPart);
      });
      for (const ek of toCommit) {
        await sc.put(`/api/edit/caregiver_assessment/${rid}/edit`, recDrafts[ek].payload);
      }
      await sc.put(`/api/edit/caregiver_assessment/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      if (store[rid]) { toCommit.forEach(k => delete store[rid][k]); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CaregiverAssessment] Approve failed:', err); }
    finally { setApproving(false); }
  }, [pendingEdits]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
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
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    stageDraft(rid, ek, fullText, { field: fn, value: fullText });
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue, stageDraft]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(flattenSearchable(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Caregiver Assessment ${idx + 1}`;
      const allText = [title, formatDate(record.date), ...Object.keys(FIELD_LABELS).map(f => flattenSearchable(record[f])), ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES)].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  /* ═══════ SIMPLE single-line string (primaryCaregiver, provider, facility, status) ═══════ */
  /* ENUM_FIELDS entries edit via a fixed-choice <select> instead of a textarea. */
  const renderSimpleField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const enumOpts = ENUM_FIELDS[fn];
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container">{enumOpts ? (
      <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>
    ) : (
      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
    )}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(enumOpts ? (enumOpts.includes(dv.toLowerCase()) ? dv.toLowerCase() : enumOpts[0]) : dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ BOOLEAN Yes/No select (respiteNeeds) ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid, editValue === 'yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(raw === true || raw === 'Yes' || raw === 'yes' ? 'yes' : 'no'); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ DATE picker (date — record header) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`; const dv = formatDate(val);
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(val)); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ ARRAY item (supportServices, educationProvided) ═══════ */
  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ OBJECT LEAF (recursive editable scalar) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey; const ed = editedFields[leafKey]; const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'yes' : 'no') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {ie ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={(e) => { e.stopPropagation(); const newVal = isBool ? editValue === 'yes' : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {ed && <span className="modified-badge">edited - click Pending Approve to save</span>}
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

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(SECTION_TITLES[sid])) return null;
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

  /* ═══════ RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : []; if (recs.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(SECTION_TITLES[sid])) return null;
    const phrase = searchTerm.toLowerCase().trim();
    const phraseAll = !searchTerm.trim() || sectionTitleMatches(SECTION_TITLES[sid]) || record._showAllSections;
    const groups = [];
    recs.forEach((rec, rIdx) => { const d = (rec?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push({ rec, rIdx }); else groups.push({ date: d, items: [{ rec, rIdx }] }); });
    return (
      <div key={fn} className="rec-mini-card">
        {groups.map((group, gIdx) => {
          const anyVisible = phraseAll || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim(); const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`; const ie = editingField === itemKey; const ed = editedFields[itemKey];
                const itemMatches = phraseAll || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {ie ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={(e) => { e.stopPropagation(); saveRecommendation(record, fn, idx, sid, rIdx, itemKey, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">✎</span></div>
                          <button className={`copy-btn${copiedId === itemKey ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedId === itemKey ? 'Copied' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {ed && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ PER-SENTENCE narrative section ═══════ */
  const renderSentenceField = (record, idx, sid, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx); if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fieldName, idx) && !sectionTitleMatches(SECTION_TITLES[sid])) return null;
    const title = SECTION_TITLES[sid]; const label = FIELD_LABELS[fieldName] || fieldName;
    const showSubLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
    const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (
      <div key={fieldName} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {sentences.map((sent, si) => {
          if (!sa && !phraseMatch(sent, searchTerm)) return null;
          const sentKey = `${fieldName}-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
          const parsed = parseLabel(sent); const showLabel = parsed && parsed.label.toLowerCase() !== title.toLowerCase();
          const saveLbl = (lbl) => { saveSentence(record, fieldName, idx, sid, si, lbl ? `${lbl}: ${editValue}` : editValue); };
          if (ie) return (<div key={si}>{showLabel && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={2} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
          const displayText = parsed ? parsed.content : sent;
          return (<div key={si}>{showLabel && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
        }).filter(Boolean)}
      </div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        // whole-field edits: key === `${fn}-${idx}` where value is the field value (could be object/array)
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const tail = key.substring(ld + 1);
        if (/^\d+$/.test(tail) && parseInt(tail, 10) === idx) { const fn = key.substring(0, ld); if (fn in record || OBJECT_FIELDS.includes(fn) || OBJECT_ARRAY_FIELDS.includes(fn)) m[fn] = localEdits[key]; }
      });
      // Array fields: apply committed item edits only; pending item drafts revert to the original value.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  /* ═══════ COPY HELPERS — label on its own line, value numbered below (mirrors the mini-cards) ═══════ */
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const sub = '  '.repeat(indent + 1); const out = [];
    if (isEmptyDeep(value)) return out;
    const pushLabel = (l) => { out.push(`${pad}${l}:`); out.push(`${pad}${COPY_LINE_DASH}`); };
    if (Array.isArray(value)) {
      if (label) pushLabel(label);
      const allScalar = value.every(isScalar);
      if (allScalar) { value.filter(hasVal).forEach((v, i) => out.push(`${sub}${i + 1}. ${fmtScalar(v)}`)); }
      else { value.forEach((item, i) => { if (item && typeof item === 'object') out.push(...objectCopyLines(`${label || 'Item'} ${i + 1}`, item, indent + 1)); else if (hasVal(item)) out.push(`${sub}${i + 1}. ${fmtScalar(item)}`); }); }
      return out;
    }
    if (isScalar(value)) { if (label) pushLabel(label); out.push(`${sub}1. ${fmtScalar(value)}`); return out; }
    if (label) pushLabel(label);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n${COPY_LINE_EQ}\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(fn => {
      const val = (fn in pr) ? pr[fn] : record[fn]; if (!hasVal(val)) return;
      const label = FIELD_LABELS[fn] || fn;
      const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
      if (ARRAY_FIELDS.includes(fn)) { getCommittedArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      else if (OBJECT_ARRAY_FIELDS.includes(fn)) { (Array.isArray(val) ? val : []).forEach((r, i) => { const d = (r?.date || '').trim(); text += `${i + 1}. ${(r?.recommendation || '').trim()}${d ? ` (${d})` : ''}\n`; }); }
      else if (OBJECT_FIELDS.includes(fn)) { objectCopyLines(null, val, 0).forEach(l => { text += `${l}\n`; }); }
      else if (SENTENCE_FIELDS.includes(fn)) { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
      else if (DATE_FIELDS.includes(fn)) { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; text += `1. ${formatDate(val)}\n`; }
      else { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(val)}\n`; }
    });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CAREGIVER ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Caregiver Assessment ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (hasVal(r.date)) text += `${formatDate(r.date)}\n`;
      Object.keys(SECTION_TITLES).forEach(sid => {
        const fields = SECTION_FIELDS[sid] || []; if (!fields.some(f => hasVal((f in r) ? r[f] : null))) return;
        text += `\n${SECTION_TITLES[sid]}\n${COPY_LINE_EQ}\n`;
        fields.forEach(fn => {
          const val = r[fn]; if (!hasVal(val)) return; const label = FIELD_LABELS[fn] || fn;
          const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
          if (ARRAY_FIELDS.includes(fn)) { getCommittedArray(r, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
          else if (OBJECT_ARRAY_FIELDS.includes(fn)) { (Array.isArray(val) ? val : []).forEach((rec, i) => { const d = (rec?.date || '').trim(); text += `${i + 1}. ${(rec?.recommendation || '').trim()}${d ? ` (${d})` : ''}\n`; }); }
          else if (OBJECT_FIELDS.includes(fn)) { objectCopyLines(null, val, 0).forEach(l => { text += `${l}\n`; }); }
          else if (SENTENCE_FIELDS.includes(fn)) { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; splitBySentence(fmtVal(val)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
          else if (DATE_FIELDS.includes(fn)) { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; text += `1. ${formatDate(val)}\n`; }
          else { if (showLabel) text += `${label}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(val)}\n`; }
        });
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSectionShell = (record, idx, sid, children) => { if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null; const title = SECTION_TITLES[sid]; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderField = (record, fn, idx, sid) => {
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    if (BOOLEAN_FIELDS.includes(fn)) return renderBooleanField(record, fn, idx, sid);
    if (ARRAY_FIELDS.includes(fn)) { const items = Array.isArray(record[fn]) ? record[fn].filter(Boolean) : []; return items.map((item, ai) => { const val = localEdits[`${fn}-${idx}-${ai}`] !== undefined ? localEdits[`${fn}-${idx}-${ai}`] : item; if (searchTerm.trim() && !sectionTitleMatches(SECTION_TITLES[sid]) && !record._showAllSections && !phraseMatch(val, searchTerm)) return null; return <React.Fragment key={ai}>{renderEditableArrayItem(record, fn, idx, sid, item, ai)}</React.Fragment>; }).filter(Boolean); }
    if (OBJECT_ARRAY_FIELDS.includes(fn)) return renderRecommendationsField(record, fn, idx, sid);
    if (OBJECT_FIELDS.includes(fn)) return renderObjectField(record, fn, idx, sid);
    if (SENTENCE_FIELDS.includes(fn)) return renderSentenceField(record, idx, sid, fn);
    return renderSimpleField(record, fn, idx, sid);
  };

  const renderSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, title, visibleFields.map(f => flattenSearchable(getFieldValue(record, f, idx))), visibleFields)) return null;
    const children = visibleFields.map(f => <React.Fragment key={f}>{renderField(record, f, idx, sid)}</React.Fragment>);
    return renderSectionShell(record, idx, sid, children);
  };

  const SECTION_ORDER = ['caregiver', 'burden', 'support', 'education', 'clinical', 'recommendationsSection', 'resultsSection', 'notesSection', 'providerInfo'];

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="caregiver-assessment-document"><header className="document-header"><h1 className="document-title">Caregiver Assessment</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="caregiver-assessment-document">
      <header className="document-header">
        <h1 className="document-title">Caregiver Assessment</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CaregiverAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Caregiver_Assessment.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Caregiver Assessment ${idx + 1}`)}</h3></div>
            </div>
            {DATE_FIELDS.map(f => hasVal(getFieldValue(record, f, idx)) ? (
              <div key={`hdr-${f}`} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText('DATE')}</h4><div className="header-right-actions">{renderApproveButton(record, idx, 'dateHeader')}</div></div>{renderDateField(record, f, idx, 'dateHeader')}</div></div>
            ) : null)}
            {SECTION_ORDER.map(sid => <React.Fragment key={sid}>{renderSection(record, idx, sid)}</React.Fragment>)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CaregiverAssessmentDocument;
