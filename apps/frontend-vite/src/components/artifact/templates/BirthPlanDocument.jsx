/**
 * BirthPlanDocument.jsx
 * FULL TEMPLATE STANDARD.
 * - 18 non-system fields covered (JSX + PDF + route).
 * - Per-sentence narratives: deliveryPreference, feedingPlan, findings, assessment, plan, notes
 *   (splitBySentence + SENTENCE_FIELDS + renderSentenceEditableField + reconstructFullText + saveSentence).
 * - 2 objects (immediatePostpartum, results) -> recursive renderObjectNode/renderObjectLeaf.
 * - 4 arrays (painManagement, laborSupport, religiousCulturalPreferences, recommendations) -> renderArrayField.
 * - 1 date (date header) -> renderDateField date-picker.
 * - Short strings (circumcisionPreference, visitorsPolicy, provider, facility, status) stay simple.
 * - 4-level search, Copy / Copy Section / Copy All, Pending -> Approved badges.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BirthPlanDocumentPDFTemplate from '../pdf-templates/BirthPlanDocumentPDFTemplate';
import './BirthPlanDocument.css';

/* ═══════ MODULE HELPERS ═══════ */
const KEY_OVERRIDES = {
  skinToSkin: 'Skin to Skin', delayedCordClamping: 'Delayed Cord Clamping',
  cordBloodBanking: 'Cord Blood Banking', placentaPreference: 'Placenta Preference',
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
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

const SECTION_FIELDS = {
  planInfo: ['date', 'provider', 'facility', 'status'],
  delivery: ['deliveryPreference'],
  painMgmt: ['painManagement'],
  laborSupport: ['laborSupport'],
  postpartum: ['immediatePostpartum'],
  feeding: ['feedingPlan', 'circumcisionPreference'],
  visitors: ['visitorsPolicy', 'religiousCulturalPreferences'],
  clinical: ['findings', 'assessment', 'plan', 'results'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  deliveryPreference: 'Delivery Preference', feedingPlan: 'Feeding Plan',
  circumcisionPreference: 'Circumcision Preference', visitorsPolicy: 'Visitors Policy',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes',
  painManagement: 'Pain Management', laborSupport: 'Labor Support',
  religiousCulturalPreferences: 'Religious/Cultural Preferences',
  immediatePostpartum: 'Immediate Postpartum',
};
const SECTION_TITLES = {
  planInfo: 'Plan Information', delivery: 'Delivery Preferences', painMgmt: 'Pain Management',
  laborSupport: 'Labor Support', postpartum: 'Immediate Postpartum', feeding: 'Feeding & Newborn Care',
  visitors: 'Visitors & Cultural', clinical: 'Clinical Summary', recommendations: 'Recommendations', notes: 'Notes',
};
const ARRAY_FIELDS = ['painManagement', 'laborSupport', 'religiousCulturalPreferences'];
const OBJECT_FIELDS = ['immediatePostpartum', 'results'];
const SENTENCE_FIELDS = ['deliveryPreference', 'feedingPlan', 'findings', 'assessment', 'plan', 'notes'];

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  where fieldPart is the editKey with the record
   index removed: "fn" (simple), "fn/arrayIndex" (array item), or "root/path" (object/leaf). */
const DRAFT_KEY = 'birth_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
/* Reversible editKey <-> {recordIdx, fieldPart} mapping.
   editKey forms: "fn-idx" | "fn-idx-arrayIndex" | "root-idx-dot.path"
   fieldPart drops the index: "fn" | "fn/arrayIndex" | "root/dot.path" (field names contain no '/'). */
const splitEditKey = (editKey) => {
  const m = String(editKey).match(/^(.+?)-(\d+)(?:-(.+))?$/);
  if (!m) return null;
  const field = m[1];
  const recordIdx = parseInt(m[2], 10);
  const rest = m[3];
  const fieldPart = rest === undefined ? field : `${field}/${rest}`;
  return { recordIdx, fieldPart };
};
const buildEditKey = (fieldPart, idx) => {
  const slash = fieldPart.indexOf('/');
  if (slash === -1) return `${fieldPart}-${idx}`;
  return `${fieldPart.slice(0, slash)}-${idx}-${fieldPart.slice(slash + 1)}`;
};

const BirthPlanDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.birth_plan) return Array.isArray(r.birth_plan) ? r.birth_plan : [r.birth_plan]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.birth_plan) return Array.isArray(dd.birth_plan) ? dd.birth_plan : [dd.birth_plan]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const hasVal = (v) => !isEmptyDeep(v);
  const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) { current += ch; continue; }
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      } else { current += ch; }
    }
    const trimmed = current.replace(/[.;]+$/, '').trim();
    if (trimmed) result.push(trimmed);
    return result;
  }, []);

  // Effective array used by PDF / Copy — applies only COMMITTED (non-pending) element edits so staged
  // drafts do not leak into the PDF or Copy output (JSX rows read localEdits directly to show drafts).
  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

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
        const editKey = buildEditKey(fieldPart, idx);
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        // mark first sentence as edited for sentence-split narrative fields (best-effort)
        const baseField = fieldPart.indexOf('/') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('/'));
        if (SENTENCE_FIELDS.includes(baseField)) nSentences[`${baseField}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ SAVE HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(SECTION_FIELDS).forEach(s => { if ((SECTION_FIELDS[s] || []).includes(fn)) delete n[`${s}-${idx}`]; }); return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = saveValue;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(SECTION_FIELDS).forEach(s => { if ((SECTION_FIELDS[s] || []).includes(fn)) delete n[`${s}-${idx}`]; }); return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}/${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue]);

  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKey, newVal) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    setLocalEdits(prev => ({ ...prev, [leafKey]: newVal }));
    setPendingEdits(prev => ({ ...prev, [leafKey]: true }));
    setEditedFields(prev => ({ ...prev, [leafKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; Object.keys(SECTION_FIELDS).forEach(s => { if ((SECTION_FIELDS[s] || []).includes(rootField)) delete n[`${s}-${idx}`]; }); return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${rootField}/${path.join('.')}`] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);

  const getLeafValue = useCallback((record, rootField, path, idx) => {
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    if (localEdits[leafKey] !== undefined) return localEdits[leafKey];
    let cur = record[rootField];
    for (const p of path) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }, [localEdits]);

  /* ═══════ PER-SENTENCE ═══════ */
  const reconstructFullText = (allSentences, sIdx, editedSentence) => {
    const updated = allSentences.map((s, i) => {
      const t = i === sIdx ? editedSentence : s;
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  const saveSentence = (record, fn, idx, sid, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const fullEditKey = `${fn}-${idx}`;
    const sourceText = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fn] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    const editedMap = { [`${fn}-${idx}-s${sIdx}`]: 'edited' };
    for (let si = sIdx + 1; si <= sIdx + extraCount; si++) editedMap[`${fn}-${idx}-s${si}`] = 'added';
    setEditedSentences(prev => {
      const cleaned = {};
      for (const key of Object.keys(prev)) { if (!key.startsWith(`${fn}-${idx}-s`)) cleaned[key] = prev[key]; }
      return { ...cleaned, ...editedMap };
    });
    handleSaveField(record, fn, idx, sid, fullText);
  };

  /* ═══════ APPROVE ═══════ */
  // Approve = COMMIT all staged drafts for this section/record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Pending editKeys for THIS record whose field belongs to THIS section.
      const toCommit = Object.keys(localEdits).filter(ek => {
        if (!pendingEdits[ek]) return false;
        const parsed = splitEditKey(ek);
        if (!parsed || parsed.recordIdx !== idx) return false;
        const baseField = parsed.fieldPart.indexOf('/') === -1 ? parsed.fieldPart : parsed.fieldPart.slice(0, parsed.fieldPart.indexOf('/'));
        return sf.includes(baseField);
      });
      // Persist each staged edit to the DB now, reversing the original save-handler payloads.
      for (const ek of toCommit) {
        const { fieldPart } = splitEditKey(ek);
        const slash = fieldPart.indexOf('/');
        const payload = { value: localEdits[ek] };
        if (slash === -1) {
          payload.field = fieldPart;                                  // simple field
        } else {
          const field = fieldPart.slice(0, slash);
          const rest = fieldPart.slice(slash + 1);
          if (/^\d+$/.test(rest)) { payload.field = field; payload.arrayIndex = parseInt(rest, 10); } // array item
          else payload.field = `${field}.${rest}`;                    // object/leaf dotted path
        }
        const resp = await sc.put(`/api/edit/birth_plan/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/birth_plan/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      if (toCommit.length > 0) {
        const store = readDrafts();
        if (store[rid]) { toCommit.forEach(ek => { const { fieldPart } = splitEditKey(ek); delete store[rid][fieldPart]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}-s`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BirthPlan] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  /* ═══════ SEARCH ═══════ */
  const highlightText = (text) => { if (text === null || text === undefined) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const val = getFieldValue(record, fn, idx); const txt = OBJECT_FIELDS.includes(fn) ? flattenSearchable(val) : (fn === 'recommendations' ? (Array.isArray(val) ? val.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ') : '') : fmtVal(val)); return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(txt, searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Birth Plan ${idx + 1}`;
      const pp = record.immediatePostpartum;
      const recsText = Array.isArray(record.recommendations) ? record.recommendations.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ') : '';
      const allText = [title, formatDate(record.date || record.createdAt), record.deliveryPreference, ...(Array.isArray(record.painManagement) ? record.painManagement : []), ...(Array.isArray(record.laborSupport) ? record.laborSupport : []), flattenSearchable(pp), record.feedingPlan, record.circumcisionPreference, record.visitorsPolicy, ...(Array.isArray(record.religiousCulturalPreferences) ? record.religiousCulturalPreferences : []), record.provider, record.facility, record.status, record.findings, record.assessment, record.plan, flattenSearchable(record.results), recsText, record.notes, ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES)].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  /* ═══════ RENDER: SIMPLE STRING (no sentence split) ═══════ */
  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!hasVal(value) && value !== false && localEdits[`${fn}-${idx}`] === undefined) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const dv = fmtVal(value);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: PER-SENTENCE STRING ═══════ */
  const renderSentenceEditableField = (record, fn, idx, sid, hideLabel) => {
    const fullEditKey = `${fn}-${idx}`;
    const sourceText = localEdits[fullEditKey] !== undefined ? localEdits[fullEditKey] : (record[fn] || '');
    if (!sourceText || !String(sourceText).trim()) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const sentences = splitBySentence(sourceText);
    if (sentences.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const label = FIELD_LABELS[fn] || fn;
    const rows = sentences.map((sentence, sIdx) => {
      if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid) && !phraseMatch(label, searchTerm) && !phraseMatch(sentence, searchTerm)) return null;
      const sentenceKey = `${fn}-${idx}-s${sIdx}`;
      const ie = editingField === sentenceKey;
      const badge = editedSentences[sentenceKey];
      const cid = `sent-${fn}-${idx}-${sIdx}`;
      if (ie) return (<div key={sIdx}><div className="numbered-row edit-row"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(record, fn, idx, sid, sIdx); } }} rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div></div>);
      const cleanSentence = sentence.replace(/[.;]+$/, '').trim();
      return (<div key={sIdx}><div className={`numbered-row editable-row${badge ? ' modified' : ''}${badge === 'added' ? ' added' : ''}`} onClick={() => { setEditingField(sentenceKey); setEditValue(cleanSentence); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!badge && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{badge && <div className={`modified-badge${badge === 'added' ? ' added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
    }).filter(Boolean);
    return (
      <div className="rec-mini-card" key={fn}>
        {!hideLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {rows}
      </div>
    );
  };

  /* ═══════ RENDER: DATE (date-picker) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `date-${fn}-${idx}`;
    const displayVal = formatDate(val);
    return (
      <div className="rec-mini-card" key={fn}>
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(ek); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {ie ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(displayVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></>
          )}
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY ITEM ═══════ */
  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* ═══════ RENDER: STRING ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const items = getEffectiveArray(record, fn, idx); if (items.length === 0) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const sa = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid);
    return record[fn].map((item, ai) => { const val = localEdits[`${fn}-${idx}-${ai}`] !== undefined ? localEdits[`${fn}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm) && !phraseMatch(FIELD_LABELS[fn], searchTerm)) return null; return renderEditableArrayItem(record, fn, idx, sid, item, ai); }).filter(Boolean);
  };

  /* ═══════ RENDER: RECOMMENDATIONS (array of {recommendation, date} or strings) ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const sa = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid);
    const rows = recs.map((rec, ai) => {
      const isObj = rec && typeof rec === 'object';
      const recText = isObj ? (rec.recommendation || '') : String(rec || '');
      const recDate = isObj ? rec.date : null;
      const display = recDate ? `${recText} (${formatDate(recDate)})` : recText;
      if (!sa && !phraseMatch(display, searchTerm) && !phraseMatch(label, searchTerm)) return null;
      const ek = isObj ? `${fn}-${idx}-${ai}-recommendation` : `${fn}-${idx}-${ai}`;
      const lk = `${fn}-${idx}-${ai}.recommendation`;
      const curVal = isObj ? (localEdits[lk] !== undefined ? localEdits[lk] : recText) : (localEdits[`${fn}-${idx}-${ai}`] !== undefined ? localEdits[`${fn}-${idx}-${ai}`] : recText);
      const ie = editingField === ek; const ed = isObj ? editedFields[lk] : editedFields[`${fn}-${idx}-${ai}`];
      const cid = `rec-${fn}-${idx}-${ai}`;
      const onSave = () => { if (isObj) saveLeaf(record, fn, [String(ai), 'recommendation'], idx, sid, lk, editValue); else handleSaveArrayItem(record, fn, idx, sid, ai); };
      if (ie) return (<div key={ai} className="nested-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} disabled={saving} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) onSave(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      const dispVal = recDate ? `${curVal} (${formatDate(recDate)})` : curVal;
      return (<div key={ai} className="nested-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(curVal || '')); }}><div className="row-content"><span className="content-value">{highlightText(`${ai + 1}. ${dispVal}`)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dispVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    }).filter(Boolean);
    return (
      <div className="rec-mini-card" key={fn}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {rows}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (recursive) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const editStartValue = isBool ? (value ? 'yes' : 'no') : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}><option value="yes">Yes</option><option value="no">No</option></select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveLeaf(record, rootField, path, idx, sid, leafKey, editValue.trim()); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? (editValue === 'yes') : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
            </div>
          ) : (
            <><div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}: ${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button></>
          )}
        </div>
        {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const liveValue = isScalar(value) ? getLeafValue(record, rootField, path, idx) : value;
    if (isScalar(liveValue)) return renderObjectLeaf(record, rootField, path, idx, sid, liveValue);
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    const entries = Object.entries(liveValue).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, getLeafValue(record, rootField, [...path, k], idx))
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !record._showAllSections && !sectionTitleMatches(sid)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, getLeafValue(record, fn, [k], idx))
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ PDF DATA (merge edits) ═══════ */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = JSON.parse(JSON.stringify(record));
      // simple field edits  fn-idx
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const parts = key.split('-');
        const last = parts[parts.length - 1];
        // leaf edits look like  root-idx-a.b.c  -> handle below; here only fn-idx
        if (/^\d+$/.test(last)) {
          const fn = parts.slice(0, -1).join('-');
          const ri = parseInt(last, 10);
          if (ri === idx && fn in record && !ARRAY_FIELDS.includes(fn)) m[fn] = localEdits[key];
        }
      });
      // arrays — apply only COMMITTED (non-pending) element edits
      ARRAY_FIELDS.forEach(field => {
        if (!Array.isArray(record[field])) return;
        const arr = [...record[field]];
        arr.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) arr[ai] = localEdits[ek]; });
        m[field] = arr;
      });
      // object/recommendation leaf edits:  root-idx-path
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m2 = key.match(/^(.+?)-(\d+)-(.+)$/);
        if (!m2) return;
        const root = m2[1]; const ri = parseInt(m2[2], 10); const pathStr = m2[3];
        if (ri !== idx) return;
        if (ARRAY_FIELDS.includes(root)) return; // handled above
        if (!(root in m)) return;
        const path = pathStr.split('.');
        let cur = m[root];
        if (cur == null || typeof cur !== 'object') return;
        for (let p = 0; p < path.length - 1; p++) { if (cur[path[p]] == null || typeof cur[path[p]] !== 'object') return; cur = cur[path[p]]; }
        cur[path[path.length - 1]] = localEdits[key];
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  /* ═══════ COPY SECTION ═══════ */
  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const lines = [];
    if (isScalar(value)) { lines.push(`${pad}${label}: ${fmtScalar(value)}`); return lines; }
    lines.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { objectCopyLines(humanizeKey(k), v, indent + 1).forEach(l => lines.push(l)); });
    return lines;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    const sentLines = (label, v) => { const ss = splitBySentence(fmtVal(v)); if (ss.length > 1) { text += `${label}:\n`; ss.forEach(s => { text += `  ${s}\n`; }); } else if (v) text += `${label}: ${v}\n`; };
    if (sid === 'planInfo') { if (pr.date) text += `Date: ${formatDate(pr.date)}\n`; if (pr.provider) text += `Provider: ${pr.provider}\n`; if (pr.facility) text += `Facility: ${pr.facility}\n`; if (pr.status) text += `Status: ${pr.status}\n`; }
    else if (sid === 'delivery') { if (pr.deliveryPreference) sentLines('Delivery Preference', pr.deliveryPreference); }
    else if (sid === 'painMgmt') { getEffectiveArray(pr, 'painManagement', idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'laborSupport') { getEffectiveArray(pr, 'laborSupport', idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'postpartum') { const pp = pr.immediatePostpartum; if (pp) Object.entries(pp).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
    else if (sid === 'feeding') { if (pr.feedingPlan) sentLines('Feeding Plan', pr.feedingPlan); if (pr.circumcisionPreference) text += `Circumcision Preference: ${pr.circumcisionPreference}\n`; }
    else if (sid === 'visitors') { if (pr.visitorsPolicy) text += `Visitors Policy: ${pr.visitorsPolicy}\n`; const items = getEffectiveArray(pr, 'religiousCulturalPreferences', idx); if (items.length > 0) { text += 'Religious/Cultural Preferences:\n'; items.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); } }
    else if (sid === 'clinical') { if (pr.findings) sentLines('Findings', pr.findings); if (pr.assessment) sentLines('Assessment', pr.assessment); if (pr.plan) sentLines('Plan', pr.plan); const rs = pr.results; if (rs && !isEmptyDeep(rs)) Object.entries(rs).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
    else if (sid === 'recommendations') { const rc = Array.isArray(pr.recommendations) ? pr.recommendations.filter(r => !isEmptyDeep(r)) : []; rc.forEach((r, i) => { const isObj = r && typeof r === 'object'; const t = isObj ? r.recommendation : r; const d = isObj && r.date ? ` (${formatDate(r.date)})` : ''; text += `${i + 1}. ${t}${d}\n`; }); }
    else if (sid === 'notes') { if (pr.notes) { const ss = splitBySentence(fmtVal(pr.notes)); if (ss.length > 1) ss.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); else text += `${pr.notes}\n`; } }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BIRTH PLAN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Birth Plan ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const sentBlock = (heading, label, v) => { const ss = splitBySentence(fmtVal(v)); text += `\n${heading}\n`; if (ss.length > 1) { text += `${label}:\n`; ss.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } else text += `${label}: ${v}\n`; };
      if (r.provider || r.facility || r.status) { text += '\nPLAN INFORMATION\n'; if (r.provider) text += `Provider: ${r.provider}\n`; if (r.facility) text += `Facility: ${r.facility}\n`; if (r.status) text += `Status: ${r.status}\n`; }
      if (r.deliveryPreference) sentBlock('DELIVERY PREFERENCES', 'Delivery Preference', r.deliveryPreference);
      const pm = getEffectiveArray(r, 'painManagement', idx); if (pm.length > 0) { text += '\nPAIN MANAGEMENT\n'; pm.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      const ls = getEffectiveArray(r, 'laborSupport', idx); if (ls.length > 0) { text += '\nLABOR SUPPORT\n'; ls.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      const pp = r.immediatePostpartum; if (pp && !isEmptyDeep(pp)) { text += '\nIMMEDIATE POSTPARTUM\n'; Object.entries(pp).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
      if (r.feedingPlan || r.circumcisionPreference) { text += '\nFEEDING & NEWBORN CARE\n'; if (r.feedingPlan) { const ss = splitBySentence(fmtVal(r.feedingPlan)); if (ss.length > 1) { text += 'Feeding Plan:\n'; ss.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } else text += `Feeding Plan: ${r.feedingPlan}\n`; } if (r.circumcisionPreference) text += `Circumcision Preference: ${r.circumcisionPreference}\n`; }
      if (r.visitorsPolicy || (Array.isArray(r.religiousCulturalPreferences) && r.religiousCulturalPreferences.length > 0)) { text += '\nVISITORS & CULTURAL\n'; if (r.visitorsPolicy) text += `Visitors Policy: ${r.visitorsPolicy}\n`; const rcp = getEffectiveArray(r, 'religiousCulturalPreferences', idx); rcp.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      if (r.findings || r.assessment || r.plan || (r.results && !isEmptyDeep(r.results))) {
        text += '\nCLINICAL SUMMARY\n';
        ['findings', 'assessment', 'plan'].forEach(f => { if (r[f]) { const ss = splitBySentence(fmtVal(r[f])); if (ss.length > 1) { text += `${FIELD_LABELS[f]}:\n`; ss.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } else text += `${FIELD_LABELS[f]}: ${r[f]}\n`; } });
        if (r.results && !isEmptyDeep(r.results)) { text += 'Results:\n'; Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 1).forEach(l => { text += `${l}\n`; })); }
      }
      const rc = Array.isArray(r.recommendations) ? r.recommendations.filter(x => !isEmptyDeep(x)) : []; if (rc.length > 0) { text += '\nRECOMMENDATIONS\n'; rc.forEach((x, i) => { const isObj = x && typeof x === 'object'; const t = isObj ? x.recommendation : x; const d = isObj && x.date ? ` (${formatDate(x.date)})` : ''; text += `${i + 1}. ${t}${d}\n`; }); }
      if (r.notes) { text += '\nNOTES\n'; const ss = splitBySentence(fmtVal(r.notes)); if (ss.length > 1) ss.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); else text += `${r.notes}\n`; }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="birth-plan-document"><header className="document-header"><h1 className="document-title">Birth Plan</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="birth-plan-document">
      <header className="document-header">
        <h1 className="document-title">Birth Plan</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BirthPlanDocumentPDFTemplate document={pdfData} />} fileName="Birth_Plan.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const pp = record.immediatePostpartum;
          const rs = record.results;
          return (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Birth Plan ${idx + 1}`)}</h3></div>
            </div>

            {/* Plan Information */}
            {(record.date || record.provider || record.facility || record.status) && shouldShowSection(record, 'Plan Information', [formatDate(record.date), record.provider, record.facility, record.status].filter(Boolean), ['date', 'provider', 'facility', 'status']) && renderSection(record, idx, 'planInfo', 'Plan Information', [
              record.date && renderDateField(record, 'date', idx, 'planInfo'),
              record.provider && renderEditableField(record, 'provider', idx, 'planInfo'),
              record.facility && renderEditableField(record, 'facility', idx, 'planInfo'),
              record.status && renderEditableField(record, 'status', idx, 'planInfo'),
            ].filter(Boolean))}

            {/* Delivery Preferences */}
            {record.deliveryPreference && shouldShowSection(record, 'Delivery Preferences', [record.deliveryPreference], ['deliveryPreference']) && renderSection(record, idx, 'delivery', 'Delivery Preferences', renderSentenceEditableField(record, 'deliveryPreference', idx, 'delivery'))}

            {/* Pain Management */}
            {record.painManagement?.length > 0 && shouldShowSection(record, 'Pain Management', record.painManagement, ['painManagement']) && renderSection(record, idx, 'painMgmt', 'Pain Management', renderArrayField(record, 'painManagement', idx, 'painMgmt'))}

            {/* Labor Support */}
            {record.laborSupport?.length > 0 && shouldShowSection(record, 'Labor Support', record.laborSupport, ['laborSupport']) && renderSection(record, idx, 'laborSupport', 'Labor Support', renderArrayField(record, 'laborSupport', idx, 'laborSupport'))}

            {/* Immediate Postpartum (recursive object) */}
            {pp && !isEmptyDeep(pp) && shouldShowSection(record, 'Immediate Postpartum', [flattenSearchable(pp)], ['immediatePostpartum']) && renderSection(record, idx, 'postpartum', 'Immediate Postpartum', renderObjectField(record, 'immediatePostpartum', idx, 'postpartum'))}

            {/* Feeding & Newborn Care */}
            {(record.feedingPlan || record.circumcisionPreference) && shouldShowSection(record, 'Feeding & Newborn Care', [record.feedingPlan, record.circumcisionPreference].filter(Boolean), ['feedingPlan', 'circumcisionPreference']) && renderSection(record, idx, 'feeding', 'Feeding & Newborn Care', [
              record.feedingPlan && renderSentenceEditableField(record, 'feedingPlan', idx, 'feeding'),
              record.circumcisionPreference && renderEditableField(record, 'circumcisionPreference', idx, 'feeding'),
            ].filter(Boolean))}

            {/* Visitors & Cultural */}
            {(record.visitorsPolicy || record.religiousCulturalPreferences?.length > 0) && shouldShowSection(record, 'Visitors & Cultural', [record.visitorsPolicy, ...(Array.isArray(record.religiousCulturalPreferences) ? record.religiousCulturalPreferences : [])].filter(Boolean), ['visitorsPolicy', 'religiousCulturalPreferences']) && renderSection(record, idx, 'visitors', 'Visitors & Cultural', [
              record.visitorsPolicy && renderEditableField(record, 'visitorsPolicy', idx, 'visitors'),
              record.religiousCulturalPreferences?.length > 0 && renderArrayField(record, 'religiousCulturalPreferences', idx, 'visitors'),
            ].filter(Boolean))}

            {/* Clinical Summary: findings / assessment / plan (per-sentence) + results (recursive object) */}
            {(record.findings || record.assessment || record.plan || (rs && !isEmptyDeep(rs))) && shouldShowSection(record, 'Clinical Summary', [record.findings, record.assessment, record.plan, flattenSearchable(rs)].filter(Boolean), ['findings', 'assessment', 'plan', 'results']) && renderSection(record, idx, 'clinical', 'Clinical Summary', [
              record.findings && renderSentenceEditableField(record, 'findings', idx, 'clinical'),
              record.assessment && renderSentenceEditableField(record, 'assessment', idx, 'clinical'),
              record.plan && renderSentenceEditableField(record, 'plan', idx, 'clinical'),
              rs && !isEmptyDeep(rs) && renderObjectField(record, 'results', idx, 'clinical'),
            ].filter(Boolean))}

            {/* Recommendations (array) */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && shouldShowSection(record, 'Recommendations', [record.recommendations.map(r => (r && typeof r === 'object') ? r.recommendation : r)], ['recommendations']) && renderSection(record, idx, 'recommendations', 'Recommendations', renderRecommendationsField(record, 'recommendations', idx, 'recommendations'))}

            {/* Notes (per-sentence) */}
            {record.notes && shouldShowSection(record, 'Notes', [record.notes], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))}
          </div>
          );
        })}
      </div>
    </article>
  );
};

export default BirthPlanDocument;
