/**
 * BiologicTherapyRecordsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * Top-level fields editable. Deeply nested objects display-only with nested subtitles.
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BiologicTherapyRecordsDocumentPDFTemplate from '../pdf-templates/BiologicTherapyRecordsDocumentPDFTemplate';
import './BiologicTherapyRecordsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits tracking-key minus its "-<idx>" suffix) */
const DRAFT_KEY = 'biologic_therapy_recordsPendingEdits';
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
  overview: ['biologicAgent', 'indication', 'mechanismOfAction'],
  priorTherapies: ['priorTherapies'],
  baseline: ['baselineDiseaseAssessment'],
  adminPlan: ['biologicAdministrationPlan'],
  firstDose: ['firstDoseAdministration'],
  responseAssessment: ['responseAssessment'],
  adverseEvents: ['adverseEvents'],
  safety: ['safetyMonitoring'],
  insurance: ['insuranceAuthorization'],
  treatment: ['treatmentPlan'],
  switching: ['switchingBiologics'],
  recordDate: ['date'],
  additional: ['medicationName', 'startDate', 'baselineAssessment', 'monitoringLabs', 'sideEffects', 'infusionReactions', 'continuationPlan', 'provider', 'facility', 'notes'],
};
const FIELD_LABELS = { biologicAgent: 'Biologic Agent', indication: 'Indication', mechanismOfAction: 'Mechanism of Action', priorTherapies: 'Prior Therapies', baselineDiseaseAssessment: 'Baseline Disease Assessment', biologicAdministrationPlan: 'Administration Plan', firstDoseAdministration: 'First Dose Administration', responseAssessment: 'Response Assessment', adverseEvents: 'Adverse Events', safetyMonitoring: 'Safety Monitoring', insuranceAuthorization: 'Insurance Authorization', treatmentPlan: 'Treatment Plan', switchingBiologics: 'Switching Biologics', date: 'Record Date',
  // Flat unified-medical-schema fields (Additional Details section, typed editing)
  medicationName: 'Medication Name', startDate: 'Start Date', baselineAssessment: 'Baseline Assessment', monitoringLabs: 'Monitoring Labs', sideEffects: 'Side Effects', infusionReactions: 'Infusion Reactions', continuationPlan: 'Continuation Plan', provider: 'Provider', facility: 'Facility', notes: 'Notes' };

// ── Recursive-object editor helpers (switchingBiologics, responseAssessment object items) ──
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
// Plain-text flattener for copy buttons on recursive objects/arrays.
const objectToCopyText = (value, indent = '') => {
  if (isEmptyDeep(value)) return '';
  if (isScalar(value)) return `${indent}${fmtScalar(value)}\n`;
  let out = '';
  if (Array.isArray(value)) { value.filter(v => !isEmptyDeep(v)).forEach((item, i) => { if (isScalar(item)) out += `${indent}${i + 1}. ${fmtScalar(item)}\n`; else { out += `${indent}Item ${i + 1}\n`; out += objectToCopyText(item, indent + '  '); } }); return out; }
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { const label = humanizeKey(k); if (isScalar(v)) out += `${indent}${label}: ${fmtScalar(v)}\n`; else { out += `${indent}${label}\n`; out += objectToCopyText(v, indent + '  '); } }); return out;
};

// Typed field arrays for the flat schema fields rendered in the Additional Details section.
const ADDITIONAL_DATE_FIELDS = ['startDate'];
const ADDITIONAL_ARRAY_FIELDS = ['monitoringLabs'];
const ADDITIONAL_STRING_FIELDS = ['medicationName', 'baselineAssessment', 'sideEffects', 'infusionReactions', 'continuationPlan', 'provider', 'facility', 'notes'];
const ADDITIONAL_FIELDS = ['medicationName', 'startDate', 'baselineAssessment', 'monitoringLabs', 'sideEffects', 'infusionReactions', 'continuationPlan', 'provider', 'facility', 'notes'];

const BiologicTherapyRecordsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.biologic_therapy_records) return Array.isArray(r.biologic_therapy_records) ? r.biologic_therapy_records : [r.biologic_therapy_records]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biologic_therapy_records) return Array.isArray(dd.biologic_therapy_records) ? dd.biologic_therapy_records : [dd.biologic_therapy_records]; return [dd]; } return r; });
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
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Mark a sentence-style marker so per-sentence narrative fields show the edited badge after refresh,
        // and a field marker so simple/array/nested fields show modified + the section Approve button.
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  // Sentence splitter with parenthesis + title protection (Rule #68 — cloned from PastMedicalHistoryDocument)
  const splitBySentence = (text) => {
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
  };
  // Narrative text fields rendered with per-sentence editing (Rule #68). Short fields stay single-value.
  const SENTENCE_FIELDS = ['baselineAssessment', 'sideEffects', 'infusionReactions', 'continuationPlan', 'notes'];
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Stage a DRAFT locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  // editKey = `${fieldPart}-${idx}`; fieldPart is the localEdits tracking-key minus the trailing "-<idx>".
  const stageDraft = useCallback((record, idx, editKey, value) => {
    const rid = getRecordId(record);
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (rid) {
      const suffix = `-${idx}`;
      const fieldPart = editKey.endsWith(suffix) ? editKey.slice(0, -suffix.length) : editKey;
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][fieldPart] = value;
      writeDrafts(store);
    }
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, idx, ek, nv);
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Staged edits belonging to this section: editKey ends with "-<idx>" and its baseField is in this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.split('.')[0];
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now. Dotted paths post whole; a PURELY-NUMERIC trailing
      // dot-segment becomes arrayIndex. Flat unified-schema fields route to the biologic_therapy collection.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = {};
        if (lastDot !== -1 && /^\d+$/.test(tail)) { payload.field = fieldPart.slice(0, lastDot); payload.value = localEdits[editKey]; payload.arrayIndex = parseInt(tail, 10); }
        else { payload.field = fieldPart; payload.value = localEdits[editKey]; }
        const collection = (lastDot === -1 && ADDITIONAL_FIELDS.includes(fieldPart)) ? 'biologic_therapy' : 'biologic_therapy_records';
        await sc.put(`/api/edit/${collection}/${rid}/edit`, payload);
      }
      // Flag the record/section approved (audit trail)
      await sc.put(`/api/edit/biologic_therapy_records/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[rid][fp]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BiologicTherapy] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const parseSmValue = (val) => { const str = String(val || ''); return str.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0).map(item => { const ci = item.indexOf(':'); if (ci > 0) return { label: item.substring(0, ci).trim(), value: item.substring(ci + 1).trim(), full: item }; return { label: null, value: item, full: item }; }); };

  // Stage a comma-list sub-field draft (no DB write). ek tracks the whole field; the -c marker is the edited badge.
  const saveSmCommaItem = useCallback((record, idx, parentPath, subField, parsedItems, commaIdx, testLabel) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    const newItems = parsedItems.map((p, i) => i === commaIdx ? (testLabel ? `${testLabel}: ${editValue}` : editValue) : p.full);
    const newFull = newItems.join(', ');
    const ek = `${parentPath}.${subField}-${idx}`;
    stageDraft(record, idx, ek, newFull);
    setEditedFields(prev => ({ ...prev, [parsedItems.length > 1 ? `${ek}-c${commaIdx}` : ek]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // Stage a nested dotted-path draft (priorTherapies / adverseEvents sub-fields) — no DB write.
  const handleSaveNestedField = useCallback((record, idx, parentField, dotPath, sectionId) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    const ek = `${parentField}.${dotPath}-${idx}`;
    stageDraft(record, idx, ek, editValue);
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // Per-sentence helpers (Rule #68 — cloned from PastMedicalHistoryDocument). Build full text restoring a period on ALL sentences.
  function reconstructFullText(allSentences, sIdx, editedSentence) {
    const updated = allSentences.map((s, i) => {
      const t = i === sIdx ? editedSentence : s;
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  }
  // Save a single sentence within a flat narrative field — full-text reconstruction, routes through saveFlatField (biologic_therapy route).
  function saveSentence(record, fn, idx, sIdx) {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const sourceText = String(getFieldValue(record, fn, idx) || '');
    const allCurrent = splitBySentence(sourceText);
    if (!editedSentence || editedSentence.replace(/[.!?;,]+/g, '').trim() === '') {
      // Empty edit removes the sentence
      allCurrent.splice(sIdx, 1);
      setEditedSentences(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { const m = k.match(new RegExp(`^${fn}-${idx}-s(\\d+)`)); if (m && parseInt(m[1], 10) >= sIdx) delete next[k]; }); return next; });
      saveFlatField(record, fn, idx, allCurrent.map((s, i) => (s && !/[.!?]$/.test(s)) ? s + '.' : s).join(' '));
      return;
    }
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence);
    // Detect added sentences
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    setEditedSentences(prev => {
      const cleaned = {}; for (const key of Object.keys(prev)) { if (!key.startsWith(`${fn}-${idx}-s`)) cleaned[key] = prev[key]; }
      const editedMap = { [`${fn}-${idx}-s${sIdx}`]: 'edited' };
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) editedMap[`${fn}-${idx}-s${si}`] = 'added';
      return { ...cleaned, ...editedMap };
    });
    saveFlatField(record, fn, idx, fullText);
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
      const title = `Biologic Therapy Record ${idx + 1}`;
      const flatText = JSON.stringify(record).replace(/[{}\[\]"]/g, ' ');
      const allText = [title, formatDate(record.date), record.biologicAgent, record.indication, record.mechanismOfAction, flatText, ...Object.values(FIELD_LABELS), 'Overview', 'Prior Therapies', 'Baseline Assessment', 'Administration Plan', 'First Dose', 'Response Assessment', 'Adverse Events', 'Safety Monitoring', 'Baseline Screening', 'Ongoing Monitoring', 'Insurance Authorization', 'Treatment Plan', 'Switching Biologics', 'Record Date'].filter(Boolean).join(' ');
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

  // Display-only nested object as rec-mini-cards with nested-subtitles
  const renderNestedObject = (obj, prefix, idx) => {
    if (!obj || typeof obj !== 'object') return null;
    return Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)).map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      const cid = `${prefix}-${key}-${idx}`;
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{value.map((item, i) => {
            const itemText = Object.entries(item).filter(([, v]) => v).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}`).join(' | ');
            return <div key={i} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(itemText)}</span></div><button className={`copy-btn${copiedId === `${cid}-${i}` ? ' copied' : ''}`} onClick={() => copyToClipboard(itemText, `${cid}-${i}`)}>{copiedId === `${cid}-${i}` ? 'Copied' : 'Copy'}</button></div>;
          })}</div>);
        }
        return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{value.map((item, i) => <div key={i} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(String(item))}</span></div><button className={`copy-btn${copiedId === `${cid}-${i}` ? ' copied' : ''}`} onClick={() => copyToClipboard(String(item), `${cid}-${i}`)}>{copiedId === `${cid}-${i}` ? 'Copied' : 'Copy'}</button></div>)}</div>);
      }
      if (typeof value === 'object') {
        return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{renderNestedObject(value, `${prefix}-${key}`, idx)}</div>);
      }
      const displayVal = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
      return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span></div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={() => copyToClipboard(`${label}: ${displayVal}`, cid)}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div></div>);
    });
  };

  // ── Recursive editable object editor (switchingBiologics, responseAssessment object items) ──
  // Saves via dotted-path PUT to /api/edit/biologic_therapy_records (sda.update). Booleans -> Yes/No select.
  const saveDottedValue = useCallback((record, idx, dotField, trackKey, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    stageDraft(record, idx, trackKey, newVal);
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [stageDraft]);

  // One editable scalar leaf inside a recursive object. dotField is full path (e.g. "switchingBiologics.washoutPeriod").
  const renderObjectLeaf = (record, idx, rootField, path, value) => {
    const dotField = `${rootField}.${path.join('.')}`;
    const leafKey = `${dotField}-${idx}`;
    const liveVal = localEdits[leafKey] !== undefined ? localEdits[leafKey] : value;
    const isBool = typeof liveVal === 'boolean';
    const displayVal = fmtScalar(liveVal);
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const cid = `obj-${leafKey}`;
    const label = humanizeKey(path[path.length - 1]);
    if (isEditing) return (<div key={leafKey} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(label)}</div><div className="edit-field-container">{isBool ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="yes">Yes</option><option value="no">No</option></select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveDottedValue(record, idx, dotField, leafKey, editValue.trim()); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => saveDottedValue(record, idx, dotField, leafKey, isBool ? editValue === 'yes' : editValue.trim())} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={leafKey} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(label)}</div><div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(isBool ? (liveVal ? 'yes' : 'no') : displayVal); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${displayVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Recursive object node — arrays-of-objects, nested objects, and scalar leaves.
  const renderObjectNode = (record, idx, rootField, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, idx, rootField, path, value);
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (Array.isArray(value)) {
      const items = value.filter(v => !isEmptyDeep(v));
      if (items.length === 0) return null;
      return (<React.Fragment key={path.join('-') || rootField}>{label && <div className={labelClass}>{highlightText(label)}</div>}<div className="nested-group">{value.map((item, i) => (isScalar(item)
        ? renderObjectLeaf(record, idx, rootField, [...path, i], item)
        : <div className="nested-mini-card" key={i}>{renderObjectNode(record, idx, rootField, humanizeKey(`Item ${i + 1}`), item, [...path, i], depth + 1)}</div>))}</div></React.Fragment>);
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (<React.Fragment key={path.join('-') || rootField}>{label && <div className={labelClass}>{highlightText(label)}</div>}<div className="nested-group">{entries.map(([k, v]) => (isScalar(v)
      ? renderObjectLeaf(record, idx, rootField, [...path, k], v)
      : <div className="nested-mini-card" key={k}>{renderObjectNode(record, idx, rootField, humanizeKey(k), v, [...path, k], depth + 1)}</div>))}</div></React.Fragment>);
  };

  // Top-level recursive object field (switchingBiologics). label hidden when equal to section title.
  const renderObjectField = (record, idx, fn, sectionTitle) => {
    const val = record[fn]; if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (<>{entries.map(([k, v]) => (isScalar(v)
      ? renderObjectLeaf(record, idx, fn, [k], v)
      : <div className="rec-mini-card" key={k}>{renderObjectNode(record, idx, fn, humanizeKey(k), v, [k], 1)}</div>))}</>);
  };

  // responseAssessment — ARRAY of objects. Each item is a parent card; scalar leaves editable via dotted path.
  const renderResponseAssessment = (record, idx) => {
    const arr = Array.isArray(record.responseAssessment) ? record.responseAssessment : [];
    const items = arr.filter(a => !isEmptyDeep(a));
    if (items.length === 0) return null;
    return arr.map((item, ai) => {
      if (isEmptyDeep(item)) return null;
      const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return null;
      const titleVal = item.assessmentDate ? `${formatDate(item.assessmentDate)}` : (item.weeksOnTherapy !== undefined && item.weeksOnTherapy !== null ? `Week ${item.weeksOnTherapy}` : `Assessment ${ai + 1}`);
      return (<div key={ai} className="rec-mini-card"><div className="nested-subtitle">{highlightText(`Assessment ${ai + 1} — ${titleVal}`)}</div>{entries.map(([k, v]) => (isScalar(v)
        ? renderObjectLeaf(record, idx, 'responseAssessment', [ai, k], v)
        : <div className="nested-mini-card" key={k}>{renderObjectNode(record, idx, 'responseAssessment', humanizeKey(k), v, [ai, k], 1)}</div>))}</div>);
    });
  };

  // Top-level record date — date-picker, posts to biologic_therapy_records route.
  const renderRecordDate = (record, idx) => {
    const ek = `date-${idx}`;
    const liveVal = localEdits[ek] !== undefined ? localEdits[ek] : record.date;
    if (!liveVal) return null;
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `rec-date-${idx}`; const displayVal = formatDate(liveVal);
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Record Date')}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; saveDottedValue(record, idx, 'date', ek, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Record Date')}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(liveVal)); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`Record Date: ${displayVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // ── Typed editing for flat schema fields (Additional Details) ──
  // These post to the collection-correct /api/edit/biologic_therapy route.
  const toInputDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toISOString().split('T')[0]; } catch { return ''; } };
  const saveFlatField = useCallback((record, fn, idx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    stageDraft(record, idx, ek, nv);
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // STRING (short/simple) — single-value editable field (medicationName, provider, facility).
  const renderAdditionalSimpleString = (record, fn, idx) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const strVal = String(value); const label = FIELD_LABELS[fn] || fn;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `add-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveFlatField(record, fn, idx); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveFlatField(record, fn, idx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(strVal); }}><div className="row-content"><span className="content-value">{highlightText(strVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${strVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // NARRATIVE STRING — per-sentence editing (Rule #68, cloned from PastMedicalHistoryDocument).
  // Each sentence is its own editable row (no numbering), label only on first row (sIdx===0). Falls back to single-value for <=1 sentence.
  const renderSentenceEditableField = (record, fn, idx) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const strVal = String(value); if (!strVal.trim()) return null;
    const label = FIELD_LABELS[fn] || fn;
    const sentences = splitBySentence(strVal);
    if (sentences.length <= 1) return renderAdditionalSimpleString(record, fn, idx);
    return sentences.map((sentence, sIdx) => {
      const sKey = `${fn}-${idx}-s${sIdx}`; const sEditing = editingField === sKey;
      const sState = editedSentences[sKey]; const isEdited = sState === 'edited'; const isAdded = sState === 'added';
      const cid = `add-${fn}-${idx}-s${sIdx}`;
      if (sEditing) return (<div className="rec-mini-card" key={sKey}>{sIdx === 0 && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sIdx); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card" key={sKey}>{sIdx === 0 && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row editable-row${isEdited ? ' modified' : ''}${isAdded ? ' added' : ''}`} onClick={() => { setEditingField(sKey); setEditValue(sentence.replace(/[.!?;]+$/, '').trim()); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!isEdited && !isAdded && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}{isAdded && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
    });
  };

  // DATE — <input type=date> YYYY-MM-DD
  const renderAdditionalDate = (record, fn, idx) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const label = FIELD_LABELS[fn] || fn; const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `add-${fn}-${idx}`; const displayVal = formatDate(value);
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; saveFlatField(record, fn, idx, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(value)); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${displayVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // ARRAY — per-item editing
  const renderAdditionalArray = (record, fn, idx) => {
    const value = getFieldValue(record, fn, idx); const arr = Array.isArray(value) ? value : []; if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const saveItem = (ii, newText) => { const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; cur[ii] = newText.trim(); const filtered = cur.filter(x => String(x).trim().length > 0); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-a${ii}`]: 'edited' })); saveFlatField(record, fn, idx, filtered); };
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{arr.map((item, ii) => {
      const iKey = `${fn}-${idx}-a${ii}`; const iEditing = editingField === iKey; const iEdited = editedFields[iKey]; const cid = `add-${fn}-${idx}-${ii}`; const itemStr = String(item);
      if (iEditing) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(ii, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveItem(ii, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<React.Fragment key={ii}><div className={`numbered-row editable-row${iEdited ? ' modified' : ''}`} onClick={() => { setEditingField(iKey); setEditValue(itemStr); }}><div className="row-content"><span className="content-value">{highlightText(itemStr)}</span>{!iEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(itemStr, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{iEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
    })}</div>);
  };

  const renderAdditionalField = (record, fn, idx) => {
    if (ADDITIONAL_DATE_FIELDS.includes(fn)) return renderAdditionalDate(record, fn, idx);
    if (ADDITIONAL_ARRAY_FIELDS.includes(fn)) return renderAdditionalArray(record, fn, idx);
    if (SENTENCE_FIELDS.includes(fn)) return renderSentenceEditableField(record, fn, idx);
    return renderAdditionalSimpleString(record, fn, idx);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    if (sid === 'overview') {
      const items = []; if (pr.biologicAgent) items.push(pr.biologicAgent); if (pr.indication) String(pr.indication).split(/;\s*/).filter(s => s.trim()).forEach(item => items.push(item)); if (pr.mechanismOfAction) items.push(pr.mechanismOfAction);
      text = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    } else if (sid === 'priorTherapies') {
      (pr.priorTherapies || []).forEach((t, ti) => { text += `${ti + 1}. ${t.therapy || `Therapy ${ti + 1}`}\n`; if (t.duration) text += `   ${t.duration}\n`; if (t.response) text += `   ${t.response}\n`; if (t.maxDose) text += `   ${t.maxDose}\n`; if (t.reasonForDiscontinuation) text += `   ${t.reasonForDiscontinuation}\n`; });
    } else if (sid === 'baseline') {
      const ba = pr.baselineDiseaseAssessment; if (!ba) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      if (ba.assessmentDate) text += `${formatDate(ba.assessmentDate)}\n\n`;
      if (ba.biomarkers?.length > 0) { text += 'Biomarkers\n'; ba.biomarkers.forEach((b, bi) => { text += `${bi + 1}. ${b.biomarker} - ${b.value}\n`; }); }
    } else if (sid === 'adminPlan') {
      const ap = pr.biologicAdministrationPlan; if (!ap) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      const items = [ap.loadingDose, ap.maintenanceDose, ap.route, ap.frequency, ap.administrationSetting, ap.durationOfTherapy].filter(Boolean);
      text = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    } else if (sid === 'firstDose') {
      const fd = pr.firstDoseAdministration; if (!fd) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      const items = [fd.date ? formatDate(fd.date) : null, fd.location, fd.dose, fd.patientEducation !== undefined ? (fd.patientEducation ? 'Yes' : 'No') : null].filter(Boolean);
      text = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    } else if (sid === 'recordDate') {
      text = pr.date ? formatDate(pr.date) : '';
    } else if (sid === 'responseAssessment') {
      (Array.isArray(pr.responseAssessment) ? pr.responseAssessment : []).filter(a => !isEmptyDeep(a)).forEach((ra, ri) => { const titleVal = ra.assessmentDate ? formatDate(ra.assessmentDate) : (ra.weeksOnTherapy !== undefined && ra.weeksOnTherapy !== null ? `Week ${ra.weeksOnTherapy}` : `Assessment ${ri + 1}`); text += `Assessment ${ri + 1} — ${titleVal}\n`; text += objectToCopyText(ra, '  '); text += '\n'; });
    } else if (sid === 'adverseEvents') {
      (pr.adverseEvents || []).forEach((ae, ai) => { text += `${ai + 1}. ${ae.event}${ae.severity ? ` [${ae.severity}]` : ''}\n`; if (ae.management) text += `   ${ae.management}\n`; });
    } else if (sid === 'safety') {
      const sm = pr.safetyMonitoring; if (!sm) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      const copySmFields = (group, fields) => { fields.forEach(([sf, label]) => { const val = group[sf]; if (!val) return; text += `${label}\n`; String(val).split(/,\s*/).filter(s => s.trim()).forEach((item, i) => { const ci = item.indexOf(':'); if (ci > 0) { text += `${item.substring(0, ci).trim()}\n${i + 1}. ${item.substring(ci + 1).trim()}\n`; } else { text += `${i + 1}. ${item}\n`; } }); }); };
      if (sm.baselineScreening) { text += 'Baseline Screening\n'; copySmFields(sm.baselineScreening, [['tbTesting', 'TB Testing'], ['hepatitisPanel', 'Hepatitis Panel'], ['cbcBaseline', 'CBC'], ['lftsBaseline', 'LFTs']]); text += '\n'; }
      if (sm.ongoingMonitoring) { text += 'Ongoing Monitoring\n'; copySmFields(sm.ongoingMonitoring, [['labFrequency', 'Lab Frequency'], ['infectionScreening', 'Infection Screening'], ['immunizationStatus', 'Immunization Status']]); }
    } else if (sid === 'insurance') {
      const ia = pr.insuranceAuthorization; if (!ia) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      [ia.priorAuthorizationStatus, ia.approvalDate ? formatDate(ia.approvalDate) : null, ia.authorizationPeriod, ia.reauthorizationDue, ia.outOfPocketCost].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
      if (ia.copayAssistance) { text += '\nCopay Assistance\n'; [ia.copayAssistance.program, ia.copayAssistance.enrolled !== undefined ? (ia.copayAssistance.enrolled ? 'Yes' : 'No') : null, ia.copayAssistance.coverageAmount].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    } else if (sid === 'treatment') {
      const tp = pr.treatmentPlan; if (!tp) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      if (tp.shortTermGoals?.length > 0) { text += 'Short-Term Goals\n'; tp.shortTermGoals.forEach((g, gi) => { text += `${gi + 1}. ${g}\n`; }); text += '\n'; }
      if (tp.longTermGoals?.length > 0) { text += 'Long-Term Goals\n'; tp.longTermGoals.forEach((g, gi) => { text += `${gi + 1}. ${g}\n`; }); text += '\n'; }
      const extra = [tp.responseThreshold, tp.durationOfTrial].filter(Boolean); if (extra.length > 0) extra.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
      if (tp.concomitantTherapies?.length > 0) { text += '\nConcomitant Therapies\n'; tp.concomitantTherapies.forEach((t, ti) => { text += `${ti + 1}. ${t}\n`; }); }
    } else if (sid === 'switching') {
      const sb = pr.switchingBiologics; if (!sb) { copyToClipboard('', `section-${sid}-${idx}`); return; }
      text = objectToCopyText(sb);
    } else if (sid === 'additional') {
      ADDITIONAL_FIELDS.forEach(f => { const v = pr[f]; const label = FIELD_LABELS[f] || f; if (ADDITIONAL_ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(v) ? v.filter(x => String(x).trim()) : []; if (arr.length === 0) return; text += `${label}\n`; arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); } else if (ADDITIONAL_DATE_FIELDS.includes(f)) { if (!v) return; text += `${label}\n${formatDate(v)}\n`; } else { if (!v || String(v).trim() === '') return; const sents = SENTENCE_FIELDS.includes(f) ? splitBySentence(String(v)) : []; text += `${label}\n`; if (sents.length > 1) sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); else text += `${v}\n`; } });
    }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BIOLOGIC THERAPY RECORDS ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Biologic Therapy Record ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      text += '\n';
      if (r.biologicAgent || r.indication || r.mechanismOfAction) { text += 'OVERVIEW\n'; const items = []; if (r.biologicAgent) items.push(r.biologicAgent); if (r.indication) String(r.indication).split(/;\s*/).filter(s => s.trim()).forEach(item => items.push(item)); if (r.mechanismOfAction) items.push(r.mechanismOfAction); items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      if (r.priorTherapies?.length > 0) { text += 'PRIOR THERAPIES\n'; r.priorTherapies.forEach((t, ti) => { text += `${ti + 1}. ${t.therapy || `Therapy ${ti + 1}`}\n`; if (t.duration) text += `   ${t.duration}\n`; if (t.response) text += `   ${t.response}\n`; if (t.maxDose) text += `   ${t.maxDose}\n`; if (t.reasonForDiscontinuation) text += `   ${t.reasonForDiscontinuation}\n`; }); text += '\n'; }
      if (r.baselineDiseaseAssessment) { text += 'BASELINE DISEASE ASSESSMENT\n'; const ba = r.baselineDiseaseAssessment; if (ba.assessmentDate) text += `${formatDate(ba.assessmentDate)}\n`; if (ba.biomarkers?.length > 0) { text += '\nBiomarkers\n'; ba.biomarkers.forEach((b, bi) => { text += `${bi + 1}. ${b.biomarker} - ${b.value}\n`; }); } text += '\n'; }
      if (r.biologicAdministrationPlan) { text += 'ADMINISTRATION PLAN\n'; const ap = r.biologicAdministrationPlan; [ap.loadingDose, ap.maintenanceDose, ap.route, ap.frequency, ap.administrationSetting, ap.durationOfTherapy].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      if (r.firstDoseAdministration) { text += 'FIRST DOSE ADMINISTRATION\n'; const fd = r.firstDoseAdministration; [fd.date ? formatDate(fd.date) : null, fd.location, fd.dose, fd.patientEducation !== undefined ? (fd.patientEducation ? 'Yes' : 'No') : null].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; }
      if (Array.isArray(r.responseAssessment) && r.responseAssessment.filter(a => !isEmptyDeep(a)).length > 0) { text += 'RESPONSE ASSESSMENT\n'; r.responseAssessment.filter(a => !isEmptyDeep(a)).forEach((ra, ri) => { const titleVal = ra.assessmentDate ? formatDate(ra.assessmentDate) : (ra.weeksOnTherapy !== undefined && ra.weeksOnTherapy !== null ? `Week ${ra.weeksOnTherapy}` : `Assessment ${ri + 1}`); text += `Assessment ${ri + 1} — ${titleVal}\n`; text += objectToCopyText(ra, '  '); }); text += '\n'; }
      if (r.adverseEvents?.length > 0) { text += 'ADVERSE EVENTS\n'; r.adverseEvents.forEach((ae, ai) => { text += `${ai + 1}. ${ae.event}${ae.severity ? ` [${ae.severity}]` : ''}\n`; if (ae.management) text += `   ${ae.management}\n`; }); text += '\n'; }
      if (r.safetyMonitoring) { text += 'SAFETY MONITORING\n'; const sm = r.safetyMonitoring; const copySmAll = (group, fields) => { fields.forEach(([sf, label]) => { const val = group[sf]; if (!val) return; text += `${label}\n`; String(val).split(/,\s*/).filter(s => s.trim()).forEach((item, i) => { const ci = item.indexOf(':'); if (ci > 0) { text += `${item.substring(0, ci).trim()}\n${i + 1}. ${item.substring(ci + 1).trim()}\n`; } else { text += `${i + 1}. ${item}\n`; } }); }); }; if (sm.baselineScreening) { text += 'Baseline Screening\n'; copySmAll(sm.baselineScreening, [['tbTesting', 'TB Testing'], ['hepatitisPanel', 'Hepatitis Panel'], ['cbcBaseline', 'CBC'], ['lftsBaseline', 'LFTs']]); text += '\n'; } if (sm.ongoingMonitoring) { text += 'Ongoing Monitoring\n'; copySmAll(sm.ongoingMonitoring, [['labFrequency', 'Lab Frequency'], ['infectionScreening', 'Infection Screening'], ['immunizationStatus', 'Immunization Status']]); text += '\n'; } }
      if (r.insuranceAuthorization) { text += 'INSURANCE AUTHORIZATION\n'; const ia = r.insuranceAuthorization; [ia.priorAuthorizationStatus, ia.approvalDate ? formatDate(ia.approvalDate) : null, ia.authorizationPeriod, ia.reauthorizationDue, ia.outOfPocketCost].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); if (ia.copayAssistance) { text += '\nCopay Assistance\n'; [ia.copayAssistance.program, ia.copayAssistance.enrolled !== undefined ? (ia.copayAssistance.enrolled ? 'Yes' : 'No') : null, ia.copayAssistance.coverageAmount].filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); } text += '\n'; }
      if (ADDITIONAL_FIELDS.some(f => { const v = r[f]; return Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && String(v).trim() !== ''); })) { text += 'ADDITIONAL DETAILS\n'; ADDITIONAL_FIELDS.forEach(f => { const v = r[f]; const label = FIELD_LABELS[f] || f; if (ADDITIONAL_ARRAY_FIELDS.includes(f)) { const arr = Array.isArray(v) ? v.filter(x => String(x).trim()) : []; if (arr.length === 0) return; text += `${label}\n`; arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); } else if (ADDITIONAL_DATE_FIELDS.includes(f)) { if (!v) return; text += `${label}\n${formatDate(v)}\n`; } else { if (!v || String(v).trim() === '') return; const sents = SENTENCE_FIELDS.includes(f) ? splitBySentence(String(v)) : []; text += `${label}\n`; if (sents.length > 1) sents.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); else text += `${v}\n`; } }); text += '\n'; }
      if (r.treatmentPlan) { text += 'TREATMENT PLAN\n'; const tp = r.treatmentPlan; if (tp.shortTermGoals?.length > 0) { text += 'Short-Term Goals\n'; tp.shortTermGoals.forEach((g, gi) => { text += `${gi + 1}. ${g}\n`; }); text += '\n'; } if (tp.longTermGoals?.length > 0) { text += 'Long-Term Goals\n'; tp.longTermGoals.forEach((g, gi) => { text += `${gi + 1}. ${g}\n`; }); text += '\n'; } const extra = [tp.responseThreshold, tp.durationOfTrial].filter(Boolean); if (extra.length > 0) extra.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); if (tp.concomitantTherapies?.length > 0) { text += '\nConcomitant Therapies\n'; tp.concomitantTherapies.forEach((t, ti) => { text += `${ti + 1}. ${t}\n`; }); } }
      if (r.switchingBiologics && !isEmptyDeep(r.switchingBiologics)) { text += '\nSWITCHING BIOLOGICS\n'; text += objectToCopyText(r.switchingBiologics); }
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="biologic-therapy-records-document"><header className="document-header"><h1 className="document-title">Biologic Therapy Records</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="biologic-therapy-records-document">
      <header className="document-header">
        <h1 className="document-title">Biologic Therapy Records</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BiologicTherapyRecordsDocumentPDFTemplate document={pdfData} />} fileName="Biologic_Therapy_Records.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Biologic Therapy Record ${idx + 1}`)}</h3></div>
            </div>

            {/* Record Date — editable date-picker */}
            {record.date && shouldShowSection(record, 'Record Date', [formatDate(record.date)], ['date']) && renderSection(record, idx, 'recordDate', 'Record Date', renderRecordDate(record, idx))}

            {/* Overview — editable, indication split by semicolon */}
            {(() => { if (!shouldShowSection(record, 'Overview', [record.biologicAgent, record.indication, record.mechanismOfAction].filter(Boolean), ['biologicAgent', 'indication', 'mechanismOfAction'])) return null; const stm = sectionTitleMatches('Overview'); const sa = !searchTerm.trim() || record._showAllSections || stm;
              const indicationValue = getFieldValue(record, 'indication', idx);
              const indicationItems = indicationValue ? String(indicationValue).split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0) : [];
              const indicationEk = `indication-${idx}`;
              const indicationEditing = editingField === indicationEk;
              const indicationEdited = editedFields[indicationEk];
              return renderSection(record, idx, 'overview', 'Overview', <>
                {(sa || fieldMatches(record, 'biologicAgent', idx)) && renderEditableField(record, 'biologicAgent', idx, 'overview')}
                {(sa || fieldMatches(record, 'indication', idx)) && indicationValue && (() => {
                  const saveIndItem = (ii, newItemText) => {
                    const items = [...indicationItems];
                    items[ii] = newItemText.trim();
                    const filtered = items.filter(p => p.length > 0);
                    const newFull = filtered.join('; ');
                    setEditedFields(prev => ({ ...prev, [`indication-${idx}-si${ii}`]: 'edited' }));
                    handleSaveField(record, 'indication', idx, 'overview', null, newFull, `indication-${idx}`);
                  };
                  return (
                    <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Indication')}</div>{indicationItems.map((item, ii) => {
                      const siKey = `indication-${idx}-si${ii}`;
                      const siEditing = editingField === siKey;
                      const siEdited = editedFields[siKey];
                      if (siEditing) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveIndItem(ii, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveIndItem(ii, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
                      return (<React.Fragment key={ii}><div className={`numbered-row editable-row${siEdited ? ' modified' : ''}`} onClick={() => { setEditingField(siKey); setEditValue(item); }}><div className="row-content"><span className="content-value">{highlightText(item)}</span>{!siEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `row-ind-${idx}-${ii}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(item, `row-ind-${idx}-${ii}`); }}>{copiedId === `row-ind-${idx}-${ii}` ? 'Copied' : 'Copy'}</button></div>{siEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
                    })}</div>
                  );
                })()}
                {(sa || fieldMatches(record, 'mechanismOfAction', idx)) && renderEditableField(record, 'mechanismOfAction', idx, 'overview')}
              </>); })()}

            {/* Prior Therapies — each therapy wrapped in parent card with nested-subtitle sub-fields inside */}
            {record.priorTherapies?.length > 0 && shouldShowSection(record, 'Prior Therapies', [(record.priorTherapies || []).map(t => [t.therapy, t.duration, t.response, t.maxDose, t.reasonForDiscontinuation].filter(Boolean).join(' ')).join(' ')], ['priorTherapies']) && renderSection(record, idx, 'priorTherapies', 'Prior Therapies', (() => { const ptStm = sectionTitleMatches('Prior Therapies'); const ptSa = !searchTerm.trim() || record._showAllSections || ptStm; return record.priorTherapies.map((therapy, ti) => {
              const subFields = [['duration', 'Duration'], ['response', 'Response'], ['maxDose', 'Max Dose'], ['reasonForDiscontinuation', 'Reason']];
              const therapyText = [therapy.therapy, ...subFields.map(([sf]) => therapy[sf])].filter(Boolean).join(' ');
              if (!ptSa && !phraseMatch(therapyText, searchTerm)) return null;
              return (
                <div key={ti} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(therapy.therapy || `Therapy ${ti + 1}`)}</div>
                  {subFields.map(([sf, label]) => {
                    const ptKey = `priorTherapies.${ti}.${sf}-${idx}`;
                    const ptVal = localEdits[ptKey] !== undefined ? localEdits[ptKey] : (therapy[sf] || '');
                    if (!ptVal) return null;
                    const ptEditing = editingField === ptKey;
                    const ptEdited = editedFields[ptKey];
                    const cid = `pt-${idx}-${ti}-${sf}`;
                    if (ptEditing) return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, 'priorTherapies', `${ti}.${sf}`, 'priorTherapies'); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, 'priorTherapies', `${ti}.${sf}`, 'priorTherapies')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                    return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ptEdited ? ' modified' : ''}`} onClick={() => { setEditingField(ptKey); setEditValue(String(ptVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(ptVal))}</span>{!ptEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${ptVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ptEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
                  })}
                </div>
              );
            }); })())}

            {/* Baseline Assessment — display-only nested */}
            {record.baselineDiseaseAssessment && shouldShowSection(record, 'Baseline Assessment', [record.baselineDiseaseAssessment.assessmentDate ? formatDate(record.baselineDiseaseAssessment.assessmentDate) : null, ...(record.baselineDiseaseAssessment.biomarkers || []).flatMap(b => [b.biomarker, b.value])].filter(Boolean), ['baselineDiseaseAssessment']) && renderSection(record, idx, 'baseline', 'Baseline Assessment', <>
              {record.baselineDiseaseAssessment.assessmentDate && (() => {
                const adKey = `baselineDiseaseAssessment.assessmentDate-${idx}`;
                const adVal = localEdits[adKey] !== undefined ? localEdits[adKey] : record.baselineDiseaseAssessment.assessmentDate;
                const adEditing = editingField === adKey;
                const adEdited = editedFields[adKey];
                if (adEditing) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Assessment Date')}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { stageDraft(record, idx, adKey, editValue); setEditedFields(prev => ({ ...prev, [adKey]: 'edited' })); setEditingField(null); setEditValue(''); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { stageDraft(record, idx, adKey, editValue); setEditedFields(prev => ({ ...prev, [adKey]: 'edited' })); setEditingField(null); setEditValue(''); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Assessment Date')}</div><div className={`numbered-row editable-row${adEdited ? ' modified' : ''}`} onClick={() => { setEditingField(adKey); setEditValue(String(adVal)); }}><div className="row-content"><span className="content-value">{highlightText(formatDate(adVal))}</span>{!adEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `base-date-${idx}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(formatDate(adVal), `base-date-${idx}`); }}>{copiedId === `base-date-${idx}` ? 'Copied' : 'Copy'}</button></div>{adEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
              })()}
              {record.baselineDiseaseAssessment.biomarkers?.length > 0 && record.baselineDiseaseAssessment.biomarkers.map((b, bi) => {
                const bKey = `baselineDiseaseAssessment.biomarkers.${bi}.value-${idx}`;
                const bVal = localEdits[bKey] !== undefined ? localEdits[bKey] : b.value;
                const bEditing = editingField === bKey;
                const bEdited = editedFields[bKey];
                if (bEditing) return (<div key={bi} className="rec-mini-card"><div className="nested-subtitle">{highlightText(b.biomarker)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { stageDraft(record, idx, bKey, editValue); setEditedFields(prev => ({ ...prev, [bKey]: 'edited' })); setEditingField(null); setEditValue(''); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { stageDraft(record, idx, bKey, editValue); setEditedFields(prev => ({ ...prev, [bKey]: 'edited' })); setEditingField(null); setEditValue(''); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                return (<div key={bi} className="rec-mini-card"><div className="nested-subtitle">{highlightText(b.biomarker)}</div><div className={`numbered-row editable-row${bEdited ? ' modified' : ''}`} onClick={() => { setEditingField(bKey); setEditValue(String(bVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(bVal))}</span>{!bEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `bio-${idx}-${bi}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${b.biomarker}: ${bVal}`, `bio-${idx}-${bi}`); }}>{copiedId === `bio-${idx}-${bi}` ? 'Copied' : 'Copy'}</button></div>{bEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
              })}
            </>)}

            {/* Administration Plan — display-only nested */}
            {record.biologicAdministrationPlan && shouldShowSection(record, 'Administration Plan', [record.biologicAdministrationPlan.loadingDose, record.biologicAdministrationPlan.maintenanceDose, record.biologicAdministrationPlan.route, record.biologicAdministrationPlan.frequency, record.biologicAdministrationPlan.administrationSetting, record.biologicAdministrationPlan.durationOfTherapy].filter(Boolean), ['biologicAdministrationPlan']) && renderSection(record, idx, 'adminPlan', 'Administration Plan', renderNestedObject(record.biologicAdministrationPlan, 'adminPlan', idx))}

            {/* First Dose — display-only nested */}
            {record.firstDoseAdministration && shouldShowSection(record, 'First Dose Administration', [record.firstDoseAdministration.date ? formatDate(record.firstDoseAdministration.date) : null, record.firstDoseAdministration.location, record.firstDoseAdministration.dose].filter(Boolean), ['firstDoseAdministration']) && renderSection(record, idx, 'firstDose', 'First Dose Administration', renderNestedObject(record.firstDoseAdministration, 'firstDose', idx))}

            {/* Response Assessment — ARRAY of objects, recursive editable leaves */}
            {Array.isArray(record.responseAssessment) && record.responseAssessment.filter(a => !isEmptyDeep(a)).length > 0 && shouldShowSection(record, 'Response Assessment', record.responseAssessment.flatMap(a => Object.values(a || {})).filter(v => typeof v === 'string' || typeof v === 'number').map(String), ['responseAssessment']) && renderSection(record, idx, 'responseAssessment', 'Response Assessment', renderResponseAssessment(record, idx))}

            {/* Adverse Events — each event wrapped in parent card, sub-fields editable */}
            {record.adverseEvents?.length > 0 && shouldShowSection(record, 'Adverse Events', [record.adverseEvents.map(e => [e.event, e.severity, e.management].filter(Boolean).join(' ')).join(' ')], ['adverseEvents']) && renderSection(record, idx, 'adverseEvents', 'Adverse Events', (() => { const aeStm = sectionTitleMatches('Adverse Events'); const aeSa = !searchTerm.trim() || record._showAllSections || aeStm; return record.adverseEvents.map((ae, ai) => {
              const aeSubFields = [['event', 'Event'], ['severity', 'Severity'], ['management', 'Management']];
              const aeText = [ae.event, ae.severity, ae.management].filter(Boolean).join(' ');
              if (!aeSa && !phraseMatch(aeText, searchTerm)) return null;
              return (
                <div key={ai} className="rec-mini-card">
                  <div className="nested-subtitle">{highlightText(ae.event || `Event ${ai + 1}`)}</div>
                  {aeSubFields.filter(([sf]) => sf !== 'event').map(([sf, label]) => {
                    const aeKey = `adverseEvents.${ai}.${sf}-${idx}`;
                    const aeVal = localEdits[aeKey] !== undefined ? localEdits[aeKey] : (ae[sf] || '');
                    if (!aeVal) return null;
                    const aeEditing = editingField === aeKey;
                    const aeEdited = editedFields[aeKey];
                    const cid = `ae-${idx}-${ai}-${sf}`;
                    if (aeEditing) return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, 'adverseEvents', `${ai}.${sf}`, 'adverseEvents'); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, 'adverseEvents', `${ai}.${sf}`, 'adverseEvents')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                    return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${aeEdited ? ' modified' : ''}`} onClick={() => { setEditingField(aeKey); setEditValue(String(aeVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(aeVal))}</span>{!aeEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${aeVal}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{aeEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
                  })}
                </div>
              );
            }); })())}

            {/* Safety Monitoring — triple-nested subtitles with colon-parsed values */}
            {record.safetyMonitoring && shouldShowSection(record, 'Safety Monitoring', [...Object.values(record.safetyMonitoring.baselineScreening || {}), ...Object.values(record.safetyMonitoring.ongoingMonitoring || {})].filter(v => typeof v === 'string'), ['safetyMonitoring']) && renderSection(record, idx, 'safety', 'Safety Monitoring', (() => { const smStm = sectionTitleMatches('Safety Monitoring'); const smSa = !searchTerm.trim() || record._showAllSections || smStm; return <>
              {record.safetyMonitoring.baselineScreening && (() => {
                const bsFields = [['tbTesting', 'TB Testing'], ['hepatitisPanel', 'Hepatitis Panel'], ['cbcBaseline', 'CBC'], ['lftsBaseline', 'LFTs'], ['pregnancyTest', 'Pregnancy Test']];
                const bsStm = sectionTitleMatches('Baseline Screening');
                if (!smSa && !bsStm && !bsFields.some(([sf, label]) => { const v = record.safetyMonitoring.baselineScreening[sf]; return v && (phraseMatch(label, searchTerm) || phraseMatch(v, searchTerm)); })) return null;
                return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Baseline Screening')}</div>
                  {bsFields.map(([sf, label]) => {
                    const smKey = `safetyMonitoring.baselineScreening.${sf}-${idx}`;
                    const smVal = localEdits[smKey] !== undefined ? localEdits[smKey] : (record.safetyMonitoring.baselineScreening[sf] || '');
                    if (!smVal) return null;
                    if (!smSa && !bsStm && !phraseMatch(label, searchTerm) && !phraseMatch(smVal, searchTerm)) return null;
                    const parsed = parseSmValue(smVal);
                    return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>
                      {parsed.map((pi, ci) => {
                        const itemKey = parsed.length > 1 ? `${smKey}-c${ci}` : smKey;
                        const itemEditing = editingField === itemKey;
                        const itemEdited = editedFields[itemKey] || (parsed.length === 1 && editedFields[smKey]);
                        const cid = `sm-bs-${idx}-${sf}-${ci}`;
                        if (itemEditing) return (<div key={ci} className="rec-mini-card">{pi.label && <div className="nested-subtitle">{highlightText(pi.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSmCommaItem(record, idx, 'safetyMonitoring.baselineScreening', sf, parsed, ci, pi.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSmCommaItem(record, idx, 'safetyMonitoring.baselineScreening', sf, parsed, ci, pi.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                        return (<div key={ci} className="rec-mini-card">{pi.label && <div className="nested-subtitle">{highlightText(pi.label)}</div>}<div className={`numbered-row editable-row${itemEdited ? ' modified' : ''}`} onClick={() => { setEditingField(itemKey); setEditValue(pi.value); }}><div className="row-content"><span className="content-value">{highlightText(pi.value)}</span>{!itemEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(pi.full, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{itemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
                      })}
                    </div>);
                  })}
                </div>);
              })()}
              {record.safetyMonitoring.ongoingMonitoring && (() => {
                const omFields = [['labFrequency', 'Lab Frequency'], ['infectionScreening', 'Infection Screening'], ['immunizationStatus', 'Immunization Status']];
                const omStm = sectionTitleMatches('Ongoing Monitoring');
                if (!smSa && !omStm && !omFields.some(([sf, label]) => { const v = record.safetyMonitoring.ongoingMonitoring[sf]; return v && (phraseMatch(label, searchTerm) || phraseMatch(v, searchTerm)); })) return null;
                return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Ongoing Monitoring')}</div>
                  {omFields.map(([sf, label]) => {
                    const smKey = `safetyMonitoring.ongoingMonitoring.${sf}-${idx}`;
                    const smVal = localEdits[smKey] !== undefined ? localEdits[smKey] : (record.safetyMonitoring.ongoingMonitoring[sf] || '');
                    if (!smVal) return null;
                    if (!smSa && !omStm && !phraseMatch(label, searchTerm) && !phraseMatch(smVal, searchTerm)) return null;
                    const parsed = parseSmValue(smVal);
                    return (<div key={sf} className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>
                      {parsed.map((pi, ci) => {
                        const itemKey = parsed.length > 1 ? `${smKey}-c${ci}` : smKey;
                        const itemEditing = editingField === itemKey;
                        const itemEdited = editedFields[itemKey] || (parsed.length === 1 && editedFields[smKey]);
                        const cid = `sm-om-${idx}-${sf}-${ci}`;
                        if (itemEditing) return (<div key={ci} className="rec-mini-card">{pi.label && <div className="nested-subtitle">{highlightText(pi.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSmCommaItem(record, idx, 'safetyMonitoring.ongoingMonitoring', sf, parsed, ci, pi.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSmCommaItem(record, idx, 'safetyMonitoring.ongoingMonitoring', sf, parsed, ci, pi.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                        return (<div key={ci} className="rec-mini-card">{pi.label && <div className="nested-subtitle">{highlightText(pi.label)}</div>}<div className={`numbered-row editable-row${itemEdited ? ' modified' : ''}`} onClick={() => { setEditingField(itemKey); setEditValue(pi.value); }}><div className="row-content"><span className="content-value">{highlightText(pi.value)}</span>{!itemEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(pi.full, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{itemEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
                      })}
                    </div>);
                  })}
                </div>);
              })()}
            </>; })())}

            {/* Insurance Authorization — display-only nested */}
            {record.insuranceAuthorization && shouldShowSection(record, 'Insurance Authorization', [record.insuranceAuthorization.priorAuthorizationStatus, record.insuranceAuthorization.authorizationPeriod, record.insuranceAuthorization.outOfPocketCost, record.insuranceAuthorization.copayAssistance?.program].filter(Boolean), ['insuranceAuthorization']) && renderSection(record, idx, 'insurance', 'Insurance Authorization', renderNestedObject(record.insuranceAuthorization, 'insurance', idx))}

            {/* Treatment Plan — display-only nested */}
            {record.treatmentPlan && shouldShowSection(record, 'Treatment Plan', [...(record.treatmentPlan.shortTermGoals || []), ...(record.treatmentPlan.longTermGoals || []), record.treatmentPlan.responseThreshold, record.treatmentPlan.durationOfTrial, ...(record.treatmentPlan.concomitantTherapies || [])].filter(Boolean), ['treatmentPlan']) && renderSection(record, idx, 'treatment', 'Treatment Plan', renderNestedObject(record.treatmentPlan, 'treatment', idx))}

            {/* Switching Biologics — OBJECT, recursive editable leaves (booleans -> Yes/No select, dotted-path saves) */}
            {record.switchingBiologics && !isEmptyDeep(record.switchingBiologics) && shouldShowSection(record, 'Switching Biologics', [record.switchingBiologics.washoutPeriod, record.switchingBiologics.rationaleForCurrentChoice, ...((record.switchingBiologics.priorBiologics || []).flatMap(b => [b.biologic, b.duration, b.reasonForSwitch]))].filter(Boolean), ['switchingBiologics']) && renderSection(record, idx, 'switching', 'Switching Biologics', renderObjectField(record, idx, 'switchingBiologics', 'Switching Biologics'))}

            {/* Additional Details — flat schema fields, typed editing (string / date / array) */}
            {(() => {
              const present = ADDITIONAL_FIELDS.filter(f => { const v = getFieldValue(record, f, idx); return Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && String(v).trim() !== ''); });
              if (present.length === 0) return null;
              if (!shouldShowSection(record, 'Additional Details', present.map(f => { const v = getFieldValue(record, f, idx); return Array.isArray(v) ? v.join(' ') : String(v); }), ADDITIONAL_FIELDS)) return null;
              const adStm = sectionTitleMatches('Additional Details'); const adSa = !searchTerm.trim() || record._showAllSections || adStm;
              const children = present.filter(f => adSa || fieldMatches(record, f, idx)).map(f => <React.Fragment key={f}>{renderAdditionalField(record, f, idx)}</React.Fragment>);
              if (children.length === 0) return null;
              return renderSection(record, idx, 'additional', 'Additional Details', <>{children}</>);
            })()}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BiologicTherapyRecordsDocument;
