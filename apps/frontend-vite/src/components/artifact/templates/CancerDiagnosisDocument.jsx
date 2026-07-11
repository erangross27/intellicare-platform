/**
 * CancerDiagnosisDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 * Collection: cancer_diagnosis
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CancerDiagnosisDocumentPDFTemplate from '../pdf-templates/CancerDiagnosisDocumentPDFTemplate';
import './CancerDiagnosisDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: value } }  (editKey = the file's own localEdits key, minus its
   "-<idx>" portion is NOT stripped — we store the full localEdits key so rehydrate is lossless). */
const DRAFT_KEY = 'cancer_diagnosisPendingEdits';
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
  tumorInfo: ['primarySite', 'histology', 'grade', 'tumorSize', 'lymphNodeStatus'],
  diagnosisDetails: ['methodOfDiagnosis'],
  mutations: ['geneticMutations'],
  treatment: ['surgicalClipsPlaced', 'chemotherapyDecision'],
  findings: ['findings'],
  clinical: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  results: ['results'],
  providerInfo: ['provider', 'facility', 'status'],
  notes: ['notes'],
};
const FIELD_LABELS = {
  primarySite: 'Primary Site', histology: 'Histology', grade: 'Grade',
  tumorSize: 'Tumor Size', lymphNodeStatus: 'Lymph Node Status',
  dateOfDiagnosis: 'Date of Diagnosis', methodOfDiagnosis: 'Method of Diagnosis',
  surgicalClipsPlaced: 'Surgical Clips Placed', chemotherapyDecision: 'Chemotherapy Decision',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results',
  provider: 'Provider', facility: 'Facility', status: 'Status', notes: 'Notes',
};
const ARRAY_FIELDS = ['geneticMutations'];
const OBJECT_FIELDS = ['results'];                 // recursive key-value editor
const OBJECT_ARRAY_FIELDS = ['recommendations'];   // array of {recommendation, date}
const BOOLEAN_FIELDS = ['surgicalClipsPlaced'];   // edit via full-row-width Yes/No dropdown, save real boolean
// Fixed-choice fields → a dropdown. The current value is kept as an option when it's not in the list, so a
// non-standard value like "NED (no evidence of disease)" is never lost when the user opens the dropdown.
const ENUM_FIELDS = { status: ['active', 'not active'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.includes(cur) ? [cur, ...opts] : opts; };
// Numeric fields (incl. unit-bearing ones like tumorSize "3.5 cm") and positive/negative fields are auto-detected
// from the VALUE (isMeasurement / isPosNeg below) — no hard-coded lists needed.

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const flattenSearchable = (v) => {
  if (isEmptyDeep(v)) return '';
  if (isScalar(v)) return fmtScalar(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return !isEmptyDeep(v); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Number editing: spinner step matches the value's decimal precision (3.5 -> 0.1, 3.55 -> 0.01, integers -> 1).
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// A value edits as a MEASUREMENT (→ one number picker per number, units/separators preserved) only when it
// STARTS with a number and every non-number part is just whitespace / a separator (x × /) / a unit / a short
// trailing descriptor. This turns "2.8 cm", "3.5 x 3.2 cm", "15% expression", "18", "4.2 g/dL" into pickers,
// but leaves descriptive text like "Gleason score 9 (4+5)", "2 (moderately differentiated)", "Positive 90%",
// and thousands-comma values like "1,250 mg/L" as plain text.
const MEAS_RE = /^\s*-?\d+(?:\.\d+)?(?:\s*[x×/]\s*-?\d+(?:\.\d+)?)*\s*(?:%|[A-Za-z]{1,4}(?:\/[A-Za-z]{1,4})?)?(?:\s+[A-Za-z]+){0,2}\s*$/;
const isMeasurement = (v) => typeof v === 'number' || (typeof v === 'string' && /\d/.test(v) && MEAS_RE.test(v.trim()));
// Split a measurement into number tokens + the literal text around them (for the segmented number editor).
// "3.5 x 3.2 cm" -> {nums:['3.5','3.2'], literals:['',' x ',' cm']}; "15% expression" -> {nums:['15'], literals:['','% expression']}.
const parseNumeric = (v) => {
  if (typeof v === 'number') return { literals: ['', ''], nums: [String(v)] };
  const s = String(v ?? ''); const nums = [], literals = []; const re = /-?\d+(?:\.\d+)?/g; let last = 0, m;
  while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; }
  if (nums.length === 0) return null;
  literals.push(s.slice(last));
  return { literals, nums };
};
// A value edits as POSITIVE/NEGATIVE (→ a two-option dropdown) when the WHOLE value is exactly "positive" or
// "negative" (any case). Options preserve the source's casing so "negative" stays lowercase, "Negative" stays Titlecase.
const POSNEG_RE = /^(positive|negative)$/i;
const isPosNeg = (v) => typeof v === 'string' && POSNEG_RE.test(v.trim());
const posNegOptions = (v) => (String(v).trim() === String(v).trim().toLowerCase() ? ['positive', 'negative'] : ['Positive', 'Negative']);
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + '.' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };

const CancerDiagnosisDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editNums, setEditNums] = useState([]);   // per-number values while editing a measurement field (e.g. "3.5 x 3.2 cm")
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
      if (r?.cancer_diagnosis) return Array.isArray(r.cancer_diagnosis) ? r.cancer_diagnosis : [r.cancer_diagnosis];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.cancer_diagnosis) return Array.isArray(dd.cancer_diagnosis) ? dd.cancer_diagnosis : [dd.cancer_diagnosis];
        return [dd];
      }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits]);

  /* All localEdits keys in this template embed the record render index `idx`:
       "<field>-<idx>"            (scalar / sentence / whole-object / whole-array edits)
       "<field>-<idx>-<arrayIdx>" (single array element, e.g. geneticMutations)
     The DRAFT store is keyed by stable record _id, and within it by a "fieldPart" that is the
     editKey with the volatile `idx` segment replaced by the placeholder "@" — so a draft can be
     re-attached to whatever render index a record gets after refresh. */
  const draftFieldPart = useCallback((editKey, idx) => {
    const dl = editKey.lastIndexOf('-');
    if (dl === -1) return editKey;
    const tail = editKey.slice(dl + 1);
    if (/^\d+$/.test(tail)) {
      // could be "<field>-<idx>" OR "<field>-<idx>-<arrayIdx>"
      const head = editKey.slice(0, dl);
      const dl2 = head.lastIndexOf('-');
      const mid = dl2 === -1 ? '' : head.slice(dl2 + 1);
      if (/^\d+$/.test(mid) && parseInt(mid, 10) === idx) {
        // "<field>-<idx>-<arrayIdx>": replace the middle idx
        return `${head.slice(0, dl2)}-@-${tail}`;
      }
      if (parseInt(tail, 10) === idx) return `${head}-@`;
    }
    return editKey; // no idx match — store verbatim
  }, []);
  const editKeyFromFieldPart = useCallback((fieldPart, idx) => fieldPart.split('@').join(String(idx)), []);

  // Stage a DRAFT locally + persist to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
  const stageDraft = useCallback((record, idx, editKey, value, sid) => {
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow.
    if (sid) setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const rid = getRecordId(record);
    if (!rid) return;
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][draftFieldPart(editKey, idx)] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [draftFieldPart]);

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
        const editKey = editKeyFromFieldPart(fieldPart, idx);
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    let value;
    if (valueOverride !== undefined) value = valueOverride;                               // number picker passes a rebuilt value (e.g. "3.6 cm")
    else if (BOOLEAN_FIELDS.includes(fn)) value = (editValue === 'true' || editValue === true);
    else value = editValue;
    stageDraft(record, idx, `${fn}-${idx}`, value, sid);
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    stageDraft(record, idx, `${fn}-${idx}-${arrayIndex}`, editValue, sid);
  }, [editValue, stageDraft]);

  /* Save a whole structured field (object/array-of-objects) with one entry updated */
  const handleSaveStructured = useCallback((record, fn, idx, updatedValue, entryKey, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    stageDraft(record, idx, `${fn}-${idx}`, updatedValue, sid);
    // also mark the per-entry UI key so the row shows its "edited" badge
    setEditedFields(prev => ({ ...prev, [entryKey]: 'edited' }));
  }, [stageDraft]);

  /* Save a nested OBJECT leaf by dot-path (e.g. results.foo.bar) — value stays raw text/boolean */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    const ek = `${rootField}-${idx}`;
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    // Stage the WHOLE object under "<rootField>-<idx>"; Approve commits field=<rootField> value=object.
    stageDraft(record, idx, ek, clone, sid);
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
  }, [localEdits, stageDraft]);

  /* Save one entry of an object-array field (e.g. recommendations[i].recommendation) */
  const saveObjectArrayItem = useCallback((record, fn, idx, sid, arrayIndex, key, newVal, itemKeyTrack) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    const cur = localEdits[`${fn}-${idx}`] !== undefined ? localEdits[`${fn}-${idx}`] : record[fn];
    const currentArr = Array.isArray(cur) ? cur : [];
    const newArr = currentArr.map((r, i) => i === arrayIndex ? { ...r, [key]: newVal } : { ...r });
    stageDraft(record, idx, `${fn}-${idx}`, newArr, sid);
    setEditedFields(prev => ({ ...prev, [itemKeyTrack]: 'edited' }));
  }, [localEdits, stageDraft]);

  // Approve = COMMIT this record's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  // Any section's Pending Approve flushes the whole record's drafts (mirrors the gold reference).
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setSaving(true);
    try {
      const rid = getRecordId(record);
      if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const suffix = `-${idx}`;
      // Every localEdits key for this record ends with "-<idx>" (whole-object/scalar/sentence) or
      // "-<idx>-<arrayIdx>" (single array element). Commit each staged draft to the DB.
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k]).filter(k => {
        const dl = k.lastIndexOf('-');
        if (dl === -1) return false;
        const tail = k.slice(dl + 1);
        if (/^\d+$/.test(tail)) {
          const head = k.slice(0, dl);
          const dl2 = head.lastIndexOf('-');
          const mid = dl2 === -1 ? '' : head.slice(dl2 + 1);
          if (/^\d+$/.test(mid)) return parseInt(mid, 10) === idx;   // "<field>-<idx>-<arrayIdx>"
          return parseInt(tail, 10) === idx;                          // "<field>-<idx>"
        }
        return false;
      });
      for (const editKey of toCommit) {
        const dl = editKey.lastIndexOf('-');
        const tail = editKey.slice(dl + 1);
        const head = editKey.slice(0, dl);
        const dl2 = head.lastIndexOf('-');
        const mid = dl2 === -1 ? '' : head.slice(dl2 + 1);
        const payload = { value: localEdits[editKey] };
        if (/^\d+$/.test(mid) && parseInt(mid, 10) === idx) {
          // "<field>-<idx>-<arrayIdx>" → single array element
          payload.field = head.slice(0, dl2);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          // "<field>-<idx>" → scalar / whole object / whole array
          payload.field = head;
        }
        await sc.put(`/api/edit/cancer_diagnosis/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/cancer_diagnosis/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) { delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const sf = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); });
        return n;
      });
    } catch (err) { console.error('[CancerDiagnosis] Approve failed:', err); }
    finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CancerDiagnosis] Cannot save — no record ID'); return; }
    const currentVal = fmtVal(getFieldValue(record, fn, idx));
    const currentSentences = splitBySentence(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') {
      currentSentences.splice(sentenceIdx, 1);
    } else {
      const cleanOld = (currentSentences[sentenceIdx] || '').trim();
      if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; }
      currentSentences[sentenceIdx] = cleanNew;
    }
    const fullText = reconstructFullText(currentSentences);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, idx, `${fn}-${idx}`, fullText, sid);
    const newSentences = splitBySentence(fullText);
    const originalCount = splitBySentence(fmtVal(record[fn])).length;
    const sentKey = `${fn}-${idx}-s${sentenceIdx}`;
    setEditedFields(prev => {
      const n = { ...prev, [sentKey]: 'edited' };
      for (let ei = originalCount; ei < newSentences.length; ei++) { n[`${fn}-${idx}-s${ei}`] = 'added'; }
      return n;
    });
  }, [editValue, localEdits, getFieldValue, stageDraft]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cancer Diagnosis ${idx + 1}`;
      const allText = [
        title, formatDate(record.date), formatDate(record.dateOfDiagnosis),
        record.primarySite, record.histology, record.grade, record.tumorSize,
        record.lymphNodeStatus, record.methodOfDiagnosis, record.chemotherapyDecision,
        record.findings, record.assessment, record.plan, record.notes,
        record.provider, record.facility, record.status,
        ...(Array.isArray(record.geneticMutations) ? record.geneticMutations : []),
        ...(Array.isArray(record.biomarkers) ? record.biomarkers.map(b => `${b.name}: ${b.value || b.status || ''}`) : []),
        ...(record.immunohistochemistry && typeof record.immunohistochemistry === 'object' && !Array.isArray(record.immunohistochemistry) ? Object.entries(record.immunohistochemistry).map(([k, v]) => `${k}: ${v}`) : []),
        ...(Array.isArray(record.recommendations) ? record.recommendations.map(r => typeof r === 'string' ? r : `${r?.recommendation || r?.text || ''} ${r?.date || ''}`) : []),
        record.results && typeof record.results === 'object' && !Array.isArray(record.results) ? flattenSearchable(record.results) : '',
        ...Object.values(FIELD_LABELS),
        'Tumor Information', 'Diagnosis Details', 'Biomarkers', 'Immunohistochemistry', 'Genetic Mutations',
        'Treatment Decision', 'Findings', 'Clinical Assessment', 'Plan', 'Recommendations', 'Results', 'Provider Information', 'Notes',
      ].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  // ── Shared numeric / positive-negative editor helpers (one editor open at a time → one editNums array) ──
  const startNumEdit = (ek, parsed) => { setEditingField(ek); setEditNums(parsed.nums.slice()); setEditValue(''); };
  // Rebuild the full string from the edited number parts, keeping units/separators; return a real number when
  // the source was a bare number so numeric-typed fields stay numeric.
  const rebuildNumeric = (parsed, sourceVal) => {
    let out = parsed.literals[0] || '';
    editNums.forEach((n, i) => { out += String(n ?? '').trim(); out += parsed.literals[i + 1] || ''; });
    out = out.trim();
    if (typeof sourceVal === 'number' && /^-?\d+(?:\.\d+)?$/.test(out)) return parseFloat(out);
    return out;
  };
  const renderNumberEditor = (parsed, onSave) => (
    <div className="number-edit-row">
      {parsed.literals[0] && parsed.literals[0].trim() ? <span className="number-edit-unit">{parsed.literals[0].trim()}</span> : null}
      {editNums.map((n, i) => (
        <React.Fragment key={i}>
          <input type="number" step={stepFor(n)} className="edit-number" value={n ?? ''}
            onChange={e => setEditNums(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setEditNums([]); } }}
            autoFocus={i === 0} disabled={saving} />
          {i < editNums.length - 1 && parsed.literals[i + 1] && parsed.literals[i + 1].trim() ? <span className="number-edit-unit">{parsed.literals[i + 1].trim()}</span> : null}
        </React.Fragment>
      ))}
      {parsed.literals[editNums.length] && parsed.literals[editNums.length].trim() ? <span className="number-edit-unit">{parsed.literals[editNums.length].trim()}</span> : null}
    </div>
  );
  const startPosNegEdit = (ek, v) => { setEditingField(ek); setEditValue(String(v).trim()); };
  const renderPosNegEditor = (v) => (
    <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
      {posNegOptions(v).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return null;
    const isBool = BOOLEAN_FIELDS.includes(fn);
    const enumOpts = !isBool ? ENUM_FIELDS[fn] : null;        // fixed-choice field (e.g. status) -> dropdown
    const isEnum = !!enumOpts;
    const posneg = !isBool && !isEnum && isPosNeg(raw);       // "positive"/"negative" -> dropdown
    const isNum = !isBool && !isEnum && !posneg && isMeasurement(raw);   // measurement (e.g. "3.5 x 3.2 cm", "15% expression") -> number picker(s)
    const parsed = isNum ? parseNumeric(raw) : null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const startEdit = () => {
      if (isNum) { startNumEdit(ek, parsed); return; }
      setEditingField(ek);
      setEditValue(isBool ? ((raw === true || raw === 'true') ? 'true' : 'false') : posneg ? String(raw).trim() : dv);
    };
    const save = () => (isNum ? handleSaveField(record, fn, idx, sid, rebuildNumeric(parsed, raw)) : handleSaveField(record, fn, idx, sid));
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className="edit-field-container">
          {isBool ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : isEnum ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              {enumOptionsWith(enumOpts, raw).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : posneg ? (
            renderPosNegEditor(raw)
          ) : isNum ? (
            renderNumberEditor(parsed, save)
          ) : (
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={fn === 'chemotherapyDecision' || fn === 'methodOfDiagnosis' ? 3 : 1} disabled={saving} />
          )}
          <div className="edit-actions">
            <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={startEdit}>
          <div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`;
    const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (
      <div key={ai} className="rec-mini-card">
        <div className="edit-field-container">
          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            autoFocus rows={1} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div key={ai} className="rec-mini-card">
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}>
          <div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const ld = key.lastIndexOf('-');
        if (ld === -1) return;
        const fn = key.substring(0, ld);
        const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: apply only COMMITTED element edits (skip pending element drafts).
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => {
          const ek = `${field}-${idx}-${ai}`;
          if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek];
        });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = {
    tumorInfo: 'TUMOR INFORMATION', diagnosisDetails: 'DIAGNOSIS DETAILS',
    biomarkers: 'BIOMARKERS', mutations: 'GENETIC MUTATIONS',
    treatment: 'TREATMENT DECISION', findings: 'FINDINGS',
    clinical: 'CLINICAL ASSESSMENT', plan: 'PLAN',
    recommendations: 'RECOMMENDATIONS', results: 'RESULTS',
    providerInfo: 'PROVIDER INFORMATION', notes: 'NOTES',
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(pr[fn])}\n`; };
    if (sid === 'tumorInfo') { ['primarySite', 'histology', 'grade', 'tumorSize', 'lymphNodeStatus'].forEach(addF); }
    else if (sid === 'diagnosisDetails') { if (pr.dateOfDiagnosis) text += `Date of Diagnosis: ${formatDate(pr.dateOfDiagnosis)}\n`; addF('methodOfDiagnosis'); }
    else if (sid === 'biomarkers') { if (Array.isArray(pr.biomarkers)) pr.biomarkers.forEach((b, i) => { text += `${i + 1}. ${b.name || 'Marker'}: ${b.value || b.status || ''}${b.variant ? ` - ${b.variant}` : ''}${b.classification ? ` (${b.classification})` : ''}${b.type ? ` [${b.type}]` : ''}\n`; }); }
    else if (sid === 'mutations') { (Array.isArray(pr.geneticMutations) ? pr.geneticMutations : []).forEach((m, i) => { text += `${i + 1}. ${m}\n`; }); }
    else if (sid === 'treatment') { addF('surgicalClipsPlaced'); const sents = splitBySentence(fmtVal(pr.chemotherapyDecision || '')); if (sents.length) { text += 'Chemotherapy Decision:\n'; sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } }
    else if (sid === 'findings') { const sents = splitBySentence(fmtVal(pr.findings || '')); sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
    else if (sid === 'clinical') { const sents = splitBySentence(fmtVal(pr.assessment || '')); sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
    else if (sid === 'plan') { const sents = splitBySentence(fmtVal(pr.plan || '')); sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
    else if (sid === 'providerInfo') { ['provider', 'facility', 'status'].forEach(addF); }
    else if (sid === 'notes') { const sents = splitBySentence(fmtVal(pr.notes || '')); sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CANCER DIAGNOSIS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cancer Diagnosis ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(r[fn])}\n`; };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); } };
      const sentFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; splitBySentence(fmtVal(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } };
      simpleFs('TUMOR INFORMATION', ['primarySite', 'histology', 'grade', 'tumorSize', 'lymphNodeStatus']);
      if (r.dateOfDiagnosis || hasVal(r.methodOfDiagnosis)) { text += '\nDIAGNOSIS DETAILS\n'; if (r.dateOfDiagnosis) text += `Date of Diagnosis: ${formatDate(r.dateOfDiagnosis)}\n`; addF('methodOfDiagnosis'); }
      if (Array.isArray(r.biomarkers) && r.biomarkers.length > 0) { text += '\nBIOMARKERS\n'; r.biomarkers.forEach((b, i) => { text += `${i + 1}. ${b.name || 'Marker'}: ${b.value || b.status || ''}${b.variant ? ` - ${b.variant}` : ''}${b.classification ? ` (${b.classification})` : ''}\n`; }); }
      if (r.immunohistochemistry && typeof r.immunohistochemistry === 'object' && !Array.isArray(r.immunohistochemistry)) { const ie = Object.entries(r.immunohistochemistry).filter(([k, v]) => k && hasVal(v)); if (ie.length) { text += '\nIMMUNOHISTOCHEMISTRY\n'; ie.forEach(([k, v], i) => { text += `${i + 1}. ${k}: ${fmtVal(v)}\n`; }); } }
      const gm = Array.isArray(r.geneticMutations) ? r.geneticMutations : []; if (gm.length) { text += '\nGENETIC MUTATIONS\n'; gm.forEach((m, i) => { text += `${i + 1}. ${m}\n`; }); }
      if (hasVal(r.surgicalClipsPlaced) || hasVal(r.chemotherapyDecision)) { text += '\nTREATMENT DECISION\n'; addF('surgicalClipsPlaced'); if (hasVal(r.chemotherapyDecision)) { text += 'Chemotherapy Decision:\n'; splitBySentence(fmtVal(r.chemotherapyDecision)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } }
      sentFs('FINDINGS', 'findings');
      sentFs('CLINICAL ASSESSMENT', 'assessment');
      sentFs('PLAN', 'plan');
      if (Array.isArray(r.recommendations) && r.recommendations.filter(Boolean).length > 0) { text += '\nRECOMMENDATIONS\n'; r.recommendations.filter(Boolean).forEach((rec, i) => { const t = typeof rec === 'string' ? rec : (rec.recommendation || rec.text || ''); const d = typeof rec === 'string' ? '' : (rec.date || ''); text += `${i + 1}. ${d ? `[${d}] ` : ''}${t}\n`; }); }
      if (r.results && typeof r.results === 'object' && !Array.isArray(r.results) && !isEmptyDeep(r.results)) {
        const lines = [];
        const walk = (label, v, indent) => {
          if (isEmptyDeep(v)) return;
          const pad = '  '.repeat(indent);
          if (isScalar(v)) { lines.push(`${pad}${label ? humanizeKey(label) + ': ' : ''}${fmtScalar(v)}`); return; }
          if (label) lines.push(`${pad}${humanizeKey(label)}:`);
          Object.entries(v).filter(([, sv]) => !isEmptyDeep(sv)).forEach(([k, sv]) => walk(k, sv, indent + (label ? 1 : 0)));
        };
        Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => walk(k, v, 0));
        if (lines.length) { text += '\nRESULTS\n'; lines.forEach(l => { text += `${l}\n`; }); }
      }
      simpleFs('PROVIDER INFORMATION', ['provider', 'facility', 'status']);
      sentFs('NOTES', 'notes');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`}
                onClick={() => copySectionText(record, idx, sid)}>
                {copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(idx, sid)}
            </div>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return <>{visibleFields.map(f => {
        if (!sa && !fieldMatches(record, f, idx)) return null;
        return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>;
      })}</>;
    })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return items.map((item, ai) => {
        const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item;
        if (!sa && !phraseMatch(val, searchTerm)) return null;
        return renderEditableArrayItem(record, fieldName, idx, sid, item, ai);
      }).filter(Boolean);
    })());
  };

  /* Sentence-split section with per-row editing + parseLabel */
  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx);
    if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw));
    if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`;
        const ie = editingField === sentKey;
        const ed = editedFields[sentKey];
        const cid = `sent-${fieldName}-${idx}-${si}`;
        const parsed = parseLabel(sent);
        const saveLabeledSentence = (label) => {
          const fullVal = label ? `${label}: ${editValue}` : editValue;
          saveSentence(record, fieldName, idx, sid, si, fullVal);
        };
        if (ie) return (
          <div key={si} className="rec-mini-card">
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLabeledSentence(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                autoFocus rows={2} disabled={saving} />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveLabeledSentence(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        );
        const displayText = parsed ? parsed.content : sent;
        return (
          <div key={si} className="rec-mini-card">
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}>
              <div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
            </div>
            {ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}
            {ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}
          </div>
        );
      }).filter(Boolean);
    })());
  };

  /* Biomarkers — display-only (array of complex objects) */
  const renderBiomarkers = (record, idx) => {
    const src = localEdits[`biomarkers-${idx}`] !== undefined ? localEdits[`biomarkers-${idx}`] : record.biomarkers;
    const markers = Array.isArray(src) ? src.filter(b => b && (b.name || b.marker)) : [];
    if (markers.length === 0) return null;
    const nameOf = (b) => b.name || b.marker;
    const valOf = (b) => [b.value || b.status, b.variant, b.classification, b.type].filter(Boolean).join(' — ');
    if (!shouldShowSection(record, 'Biomarkers', markers.map(b => `${nameOf(b)}: ${valOf(b)}`), [])) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Biomarkers')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-biomarkers-${idx}` ? ' copied' : ''}`}
                onClick={() => copyToClipboard(markers.map((b, i) => `${i + 1}. ${nameOf(b)}: ${valOf(b)}`).join('\n'), `section-biomarkers-${idx}`)}>
                {copiedId === `section-biomarkers-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
            </div>
          </div>
          {markers.map((b, bi) => {
            const ek = `biomarkers-${idx}-${bi}`;
            const ie = editingField === ek;
            const ed = editedFields[ek];
            const cid = `bio-${idx}-${bi}`;
            const valueKey = b.value !== undefined ? 'value' : (b.status !== undefined ? 'status' : 'value');
            const editableVal = b[valueKey] !== undefined ? String(b[valueKey]) : '';
            const posneg = isPosNeg(b[valueKey]);                   // ALK/ROS1/HER2 "negative" -> dropdown
            const isNum = !posneg && isMeasurement(b[valueKey]);    // "15%", "18", "4.2 g/dL" -> number picker(s)
            const parsed = isNum ? parseNumeric(b[valueKey]) : null;
            const saveBio = () => handleSaveStructured(record, 'biomarkers', idx, markers.map((m, mi) => mi === bi ? { ...m, [valueKey]: isNum ? rebuildNumeric(parsed, b[valueKey]) : editValue } : m), ek);
            if (ie) return (
              <div key={bi} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(nameOf(b))}</div>
                <div className="edit-field-container">
                  {posneg ? renderPosNegEditor(b[valueKey]) : isNum ? renderNumberEditor(parsed, saveBio) : (
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveBio(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                      autoFocus rows={1} disabled={saving} />
                  )}
                  <div className="edit-actions">
                    <button className="save-btn" onClick={saveBio} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
            return (
              <div key={bi} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(nameOf(b))}</div>
                <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (isNum) { startNumEdit(ek, parsed); } else { setEditingField(ek); setEditValue(posneg ? String(b[valueKey]).trim() : editableVal); } }}>
                  <div className="row-content">
                    <span className="content-value">{highlightText(valOf(b))}</span>{!ed && <span className="edit-indicator">✎</span>}
                  </div>
                  <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`}
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(`${nameOf(b)}: ${valOf(b)}`, cid); }}>
                    {copiedId === cid ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {ed && <div className="modified-badge">edited</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImmunohistochemistry = (record, idx) => {
    const src = localEdits[`immunohistochemistry-${idx}`] !== undefined ? localEdits[`immunohistochemistry-${idx}`] : record.immunohistochemistry;
    const ihc = src && typeof src === 'object' && !Array.isArray(src) ? src : null;
    const entries = ihc ? Object.entries(ihc).filter(([k, v]) => k && hasVal(v)) : [];
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, 'Immunohistochemistry', entries.map(([k, v]) => `${k}: ${v}`), [])) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Immunohistochemistry')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-ihc-${idx}` ? ' copied' : ''}`}
                onClick={() => copyToClipboard(entries.map(([k, v], i) => `${i + 1}. ${k}: ${fmtVal(v)}`).join('\n'), `section-ihc-${idx}`)}>
                {copiedId === `section-ihc-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
            </div>
          </div>
          {entries.map(([k, v], ei) => {
            const ek = `immunohistochemistry-${idx}-${k}`;
            const ie = editingField === ek;
            const ed = editedFields[ek];
            const cid = `ihc-${idx}-${ei}`;
            const posneg = isPosNeg(v);                     // ALK/ROS1/HER2 "negative" -> dropdown
            const isNum = !posneg && isMeasurement(v);      // PD-L1 "15% expression", Ki-67 "15%" -> number picker(s)
            const parsed = isNum ? parseNumeric(v) : null;
            const saveIhc = () => handleSaveStructured(record, 'immunohistochemistry', idx, { ...ihc, [k]: isNum ? rebuildNumeric(parsed, v) : editValue }, ek);
            if (ie) return (
              <div key={ei} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(k)}</div>
                <div className="edit-field-container">
                  {posneg ? renderPosNegEditor(v) : isNum ? renderNumberEditor(parsed, saveIhc) : (
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveIhc(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                      autoFocus rows={1} disabled={saving} />
                  )}
                  <div className="edit-actions">
                    <button className="save-btn" onClick={saveIhc} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
            return (
              <div key={ei} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(k)}</div>
                <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (isNum) { startNumEdit(ek, parsed); } else { setEditingField(ek); setEditValue(posneg ? String(v).trim() : fmtVal(v)); } }}>
                  <div className="row-content"><span className="content-value">{highlightText(fmtVal(v))}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                  <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`}
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(`${k}: ${fmtVal(v)}`, cid); }}>
                    {copiedId === cid ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {ed && <div className="modified-badge">edited</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ OBJECT LEAF (editable; boolean -> Yes/No select, else textarea; value stays raw) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const posneg = !isBool && isPosNeg(value);                  // "positive"/"negative" -> dropdown
    const isNum = !isBool && !posneg && isMeasurement(value);   // measurement leaf -> number picker(s)
    const parsed = isNum ? parseNumeric(value) : null;
    const cid = `leaf-${leafKey}`;
    const startEdit = () => {
      if (isNum) { startNumEdit(leafKey, parsed); return; }
      setEditingField(leafKey);
      setEditValue(isBool ? (value ? 'true' : 'false') : posneg ? String(value).trim() : leafValueString);
    };
    const saveLeafVal = () => saveLeaf(record, rootField, path, idx, sid, leafKey, isBool ? (editValue === 'true') : isNum ? rebuildNumeric(parsed, value) : editValue.trim());
    if (isEditing) return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className="edit-field-container">
          {isBool ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : posneg ? (
            renderPosNegEditor(value)
          ) : isNum ? (
            renderNumberEditor(parsed, saveLeafVal)
          ) : (
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLeaf(record, rootField, path, idx, sid, leafKey, editValue.trim()); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={1} disabled={saving} />
          )}
          <div className="edit-actions">
            <button className="save-btn" onClick={saveLeafVal} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={startEdit}>
          <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}: ${leafValueString}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ═══════ OBJECT NODE (recursive; humanizeKey + nested-mini-card; hide-empty at every level) ═══════ */
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

  /* ═══════ RESULTS — OBJECT field (recursive key-value editor) ═══════ */
  const renderResults = (record, idx, sid) => {
    const src = localEdits[`results-${idx}`] !== undefined ? localEdits[`results-${idx}`] : record.results;
    const val = src && typeof src === 'object' && !Array.isArray(src) ? src : null;
    if (!val || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, 'Results', [flattenSearchable(val)], ['results'])) return null;
    return renderSection(record, idx, sid, 'Results', (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, 'results', [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, 'results', idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    ));
  };

  /* ═══════ RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendations = (record, idx, sid) => {
    const src = localEdits[`recommendations-${idx}`] !== undefined ? localEdits[`recommendations-${idx}`] : record.recommendations;
    const recs = Array.isArray(src) ? src.filter(r => r && (typeof r === 'string' || hasVal(r.recommendation) || hasVal(r.text) || hasVal(r.date))) : [];
    if (recs.length === 0) return null;
    const textOf = (r) => typeof r === 'string' ? r : (r.recommendation || r.text || '');
    if (!shouldShowSection(record, 'Recommendations', recs.map(textOf), ['recommendations'])) return null;
    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (typeof rec === 'string' ? '' : (rec?.date || '')).trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });
    return renderSection(record, idx, sid, 'Recommendations', (() => {
      const stm = sectionTitleMatches('Recommendations');
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return groups.map((group, gIdx) => {
        const visibleItems = group.items.filter(({ rec }) => sa || phraseMatch(textOf(rec), searchTerm) || phraseMatch(group.date, searchTerm));
        if (visibleItems.length === 0) return null;
        return (
          <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
            {visibleItems.map(({ rec, rIdx }) => {
              const recText = textOf(rec).trim();
              const itemKey = `recommendations-${idx}-r${rIdx}`;
              const ie = editingField === itemKey;
              const ed = editedFields[itemKey];
              const cid = `rec-${idx}-${rIdx}`;
              const isStr = typeof rec === 'string';
              if (ie) return (
                <div key={rIdx} className="rec-mini-card">
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                      autoFocus rows={2} disabled={saving} />
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={() => {
                        const trimmed = editValue.trim();
                        if (isStr) {
                          const cur = localEdits[`recommendations-${idx}`] !== undefined ? localEdits[`recommendations-${idx}`] : record.recommendations;
                          const arr = Array.isArray(cur) ? cur.map((r, i) => i === rIdx ? trimmed : r) : [];
                          handleSaveStructured(record, 'recommendations', idx, arr, itemKey);
                        } else {
                          const key = rec.recommendation !== undefined ? 'recommendation' : (rec.text !== undefined ? 'text' : 'recommendation');
                          saveObjectArrayItem(record, 'recommendations', idx, sid, rIdx, key, trimmed, itemKey);
                        }
                      }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              );
              return (
                <div key={rIdx} className="rec-mini-card">
                  <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(itemKey); setEditValue(recText); }}>
                    <div className="row-content"><span className="content-value">{highlightText(recText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                    <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(recText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
                  </div>
                  {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </div>
              );
            })}
          </div>
        );
      }).filter(Boolean);
    })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (
    <article className="cancer-diagnosis-document">
      <header className="document-header"><h1 className="document-title">Cancer Diagnosis</h1></header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="empty-state">No data available.</div>
    </article>
  );

  return (
    <article className="cancer-diagnosis-document">
      <header className="document-header">
        <h1 className="document-title">Cancer Diagnosis</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CancerDiagnosisDocumentPDFTemplate document={pdfData} />} fileName="Cancer_Diagnosis.pdf">
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
                {record.status && <span className="status-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}>{highlightText(record.status)}</span>}
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cancer Diagnosis ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'tumorInfo', 'Tumor Information', ['primarySite', 'histology', 'grade', 'tumorSize', 'lymphNodeStatus'])}

            {/* Diagnosis Details — date is display-only, method is editable */}
            {(record.dateOfDiagnosis || hasVal(getFieldValue(record, 'methodOfDiagnosis', idx))) &&
              shouldShowSection(record, 'Diagnosis Details', [formatDate(record.dateOfDiagnosis), fmtVal(getFieldValue(record, 'methodOfDiagnosis', idx))], ['methodOfDiagnosis']) &&
              renderSection(record, idx, 'diagnosisDetails', 'Diagnosis Details', <>
                {record.dateOfDiagnosis && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Date of Diagnosis')}</div>
                    <div className="numbered-row">
                      <div className="row-content"><span className="content-value">{highlightText(formatDate(record.dateOfDiagnosis))}</span></div>
                      <button className={`copy-btn${copiedId === `diag-date-${idx}` ? ' copied' : ''}`}
                        onClick={() => copyToClipboard(formatDate(record.dateOfDiagnosis), `diag-date-${idx}`)}>
                        {copiedId === `diag-date-${idx}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {renderEditableField(record, 'methodOfDiagnosis', idx, 'diagnosisDetails')}
              </>)}

            {renderBiomarkers(record, idx)}
            {renderImmunohistochemistry(record, idx)}
            {renderArraySection(record, idx, 'mutations', 'Genetic Mutations', 'geneticMutations')}

            {/* Treatment — surgicalClipsPlaced + chemotherapyDecision as sentence-split */}
            {(hasVal(getFieldValue(record, 'surgicalClipsPlaced', idx)) || hasVal(getFieldValue(record, 'chemotherapyDecision', idx))) &&
              shouldShowSection(record, 'Treatment Decision', [fmtVal(getFieldValue(record, 'surgicalClipsPlaced', idx)), fmtVal(getFieldValue(record, 'chemotherapyDecision', idx))], ['surgicalClipsPlaced', 'chemotherapyDecision']) &&
              renderSection(record, idx, 'treatment', 'Treatment Decision', <>
                {renderEditableField(record, 'surgicalClipsPlaced', idx, 'treatment')}
                {(() => {
                  const raw = getFieldValue(record, 'chemotherapyDecision', idx);
                  if (!hasVal(raw)) return null;
                  const sentences = splitBySentence(fmtVal(raw));
                  if (sentences.length <= 1) return renderEditableField(record, 'chemotherapyDecision', idx, 'treatment');
                  const stm = sectionTitleMatches('Treatment Decision');
                  const sa = !searchTerm.trim() || record._showAllSections || stm;
                  return <>
                    <div className="nested-subtitle" style={{ marginTop: 8 }}>{highlightText('Chemotherapy Decision')}</div>
                    {sentences.map((sent, si) => {
                      if (!sa && !phraseMatch(sent, searchTerm)) return null;
                      const sentKey = `chemotherapyDecision-${idx}-s${si}`;
                      const ie = editingField === sentKey;
                      const ed = editedFields[sentKey];
                      const cid = `sent-chemo-${idx}-${si}`;
                      const parsed = parseLabel(sent);
                      const saveLabeledSentence = (label) => {
                        const fullVal = label ? `${label}: ${editValue}` : editValue;
                        saveSentence(record, 'chemotherapyDecision', idx, 'treatment', si, fullVal);
                      };
                      if (ie) return (
                        <div key={si} className="rec-mini-card">
                          {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLabeledSentence(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                              autoFocus rows={2} disabled={saving} />
                            <div className="edit-actions">
                              <button className="save-btn" onClick={() => saveLabeledSentence(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      );
                      const displayText = parsed ? parsed.content : sent;
                      return (
                        <div key={si} className="rec-mini-card">
                          {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                          <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}>
                            <div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                            <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
                          </div>
                          {ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}
                          {ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}
                        </div>
                      );
                    }).filter(Boolean)}
                  </>;
                })()}
              </>)}

            {renderSentenceSplitSection(record, idx, 'findings', 'Findings', 'findings')}
            {renderSentenceSplitSection(record, idx, 'clinical', 'Clinical Assessment', 'assessment')}
            {renderSentenceSplitSection(record, idx, 'plan', 'Plan', 'plan')}
            {renderRecommendations(record, idx, 'recommendations')}
            {renderResults(record, idx, 'results')}
            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['provider', 'facility', 'status'])}
            {renderSentenceSplitSection(record, idx, 'notes', 'Notes', 'notes')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CancerDiagnosisDocument;
