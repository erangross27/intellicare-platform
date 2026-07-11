/**
 * CaseSummariesDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + sentence-split. Collection: case_summaries
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CaseSummariesPDFTemplate from '../pdf-templates/CaseSummariesPDFTemplate';
import './CaseSummariesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'case_summariesPendingEdits';
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
  demographics: ['patientAge', 'patientGender', 'bodyMassIndex'],
  complaint: ['chiefComplaint', 'symptomDuration'],
  primary: ['primaryDiagnosis'],
  secondary: ['secondaryDiagnoses'],
  scores: ['glasgowComaScale', 'apacheIIScore', 'sofaScore', 'nyhaClass', 'painScale'],
  vitals: ['vitalSigns'],
  labs: ['laboratoryValues', 'creatinineClearance'],
  imaging: ['imagingStudies', 'ecgFindings', 'echocardiogramResults', 'leftVentricularEjectionFraction'],
  medications: ['medicationList'],
  allergies: ['allergies'],
  procedures: ['proceduresPerformed'],
  disposition: ['hospitalLengthOfStay', 'dischargeDisposition', 'followUpInstructions'],
};
const FIELD_LABELS = {
  patientAge: 'Age', patientGender: 'Gender', bodyMassIndex: 'BMI',
  chiefComplaint: 'Chief Complaint', symptomDuration: 'Symptom Duration',
  primaryDiagnosis: 'Primary Diagnosis',
  secondaryDiagnoses: 'Secondary Diagnoses',
  glasgowComaScale: 'Glasgow Coma Scale', apacheIIScore: 'APACHE II Score', sofaScore: 'SOFA Score', nyhaClass: 'NYHA Class', painScale: 'Pain Scale',
  vitalSigns: 'Vital Signs', laboratoryValues: 'Laboratory Values', creatinineClearance: 'Creatinine Clearance',
  imagingStudies: 'Imaging Studies', ecgFindings: 'ECG Findings', echocardiogramResults: 'Echocardiogram Results', leftVentricularEjectionFraction: 'LVEF (%)',
  medicationList: 'Medications', allergies: 'Allergies', proceduresPerformed: 'Procedures Performed',
  hospitalLengthOfStay: 'Length of Stay (days)', dischargeDisposition: 'Discharge Disposition', followUpInstructions: 'Follow-Up Instructions',
};
const ARRAY_FIELDS = ['secondaryDiagnoses', 'imagingStudies', 'medicationList', 'allergies', 'proceduresPerformed'];
const NUMERIC_FIELDS = new Set(['patientAge', 'bodyMassIndex', 'glasgowComaScale', 'apacheIIScore', 'sofaScore', 'painScale', 'creatinineClearance', 'leftVentricularEjectionFraction', 'hospitalLengthOfStay']);
const SENTENCE_SPLIT_FIELDS = new Set([]);
const LABEL_COMMA_FIELDS = new Set(['laboratoryValues', 'vitalSigns', 'echocardiogramResults', 'followUpInstructions']);
const ENUM_FIELDS = { patientGender: ['Male', 'Female'], nyhaClass: ['I', 'II', 'III', 'IV'] };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
// Comma split: never inside parentheses; keep "and"/"or" connected on either side of the
// comma (", and consideration..." stays attached); skip no-space commas ("50,000").
const splitLabParts = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      if (!/[A-Za-z>(]/.test(rest[0] || '')) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};
// Sentences -> groups: a labeled sentence ("At EMS arrival: ...") becomes its own group whose
// value is comma-split into items; consecutive UNLABELED sentences collect into one group and
// are ALSO comma-split (same guards). Each item carries (si, ci) so per-item editing can
// splice back into the right sentence/part.
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach((sentence, si) => {
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    if (label) {
      const parts = splitLabParts(sentence.substring(colonIdx + 1).trim());
      groups.push({ label, items: parts.map((p, pi) => ({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi })) });
      nullGroup = null;
    } else {
      if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); }
      splitLabParts(sentence).forEach((p, pi) => nullGroup.items.push({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi }));
    }
  });
  return groups;
};

const CaseSummariesDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.case_summaries) return Array.isArray(r.case_summaries) ? r.case_summaries : [r.case_summaries];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.case_summaries) return Array.isArray(dd.case_summaries) ? dd.case_summaries : [dd.case_summaries]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record && record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" (whole-field draft) or "field.arrayIndex" (array element draft)
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayPart = lastDot !== -1 && /^\d+$/.test(trailing);
        const editKey = isArrayPart
          ? `${fieldPart.slice(0, lastDot)}-${idx}-${trailing}`
          : `${fieldPart}-${idx}`;
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
  // Pending drafts (saved locally, not yet approved) are EXCLUDED here so they never reach the PDF/Copy.
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  const getEffectiveSentences = useCallback((record, fn, idx) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return [];
    return splitBySentence(String(raw)).map((s, si) => {
      const sk = `${fn}-${idx}-s${si}`;
      return localEdits[sk] !== undefined ? localEdits[sk] : s;
    });
  }, [localEdits, getFieldValue]);

  // Stage a DRAFT for an editKey: update localEdits + pendingEdits + editedFields, write to the
  // localStorage draft store, and drop the section's 'approved' flag so the button returns to yellow.
  // fieldPart is what gets persisted to the draft store ("field" or "field.arrayIndex").
  const stageDraft = useCallback((record, editKey, fieldPart, value, sid, idx, fieldMarks) => {
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (fieldMarks) setEditedFields(prev => ({ ...prev, ...fieldMarks }));
    else setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow.
    setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const rid = getRecordId(record);
    if (rid) {
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][fieldPart] = value;
      writeDrafts(store);
    }
    setEditingField(null); setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    stageDraft(record, `${fn}-${idx}`, fn, editValue, sid, idx);
  }, [editValue, stageDraft]);

  const handleSaveNumber = useCallback((record, fn, idx, sid) => {
    const num = parseFloat(editValue);
    if (editValue.trim() !== '' && isNaN(num)) { console.warn('[CaseSummaries] Invalid number, not saving:', editValue); return; }
    const valueToSave = editValue.trim() === '' ? '' : num;
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    stageDraft(record, `${fn}-${idx}`, fn, valueToSave, sid, idx);
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    stageDraft(record, `${fn}-${idx}-${arrayIndex}`, `${fn}.${arrayIndex}`, editValue, sid, idx);
  }, [editValue, stageDraft]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const editedVal = editValue.trim();
    const fieldMarks = {};
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      sentences.splice(sentenceIdx, 1);
      fieldMarks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    } else {
      const newSentences = splitBySentence(editedVal);
      sentences.splice(sentenceIdx, 1, ...newSentences);
      fieldMarks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      if (newSentences.length > 1) {
        const extraCount = newSentences.length - 1;
        for (let ei = 0; ei < extraCount; ei++) fieldMarks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      }
    }
    const newValue = reconstructFullText(sentences);
    // Stage as a DRAFT (no DB write); localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, `${fn}-${idx}`, fn, newValue, sid, idx, fieldMarks);
  }, [editValue, getFieldValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this record/section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    setApproving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record+section's pending edits from localEdits.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        // editKey = "field-idx" or "field-idx-arrayIndex". Recover the field name + record index.
        const parts = k.split('-');
        let recIdx, fieldName;
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        if (/^\d+$/.test(last) && /^\d+$/.test(secondLast)) {
          // array element: field-idx-arrayIndex
          recIdx = parseInt(secondLast, 10);
          fieldName = parts.slice(0, parts.length - 2).join('-');
        } else if (/^\d+$/.test(last)) {
          // whole field: field-idx
          recIdx = parseInt(last, 10);
          fieldName = parts.slice(0, parts.length - 1).join('-');
        } else {
          return false;
        }
        return recIdx === idx && sf.includes(fieldName);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const parts = editKey.split('-');
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        let payload;
        if (/^\d+$/.test(last) && /^\d+$/.test(secondLast)) {
          const fieldName = parts.slice(0, parts.length - 2).join('-');
          payload = { field: fieldName, value: localEdits[editKey], arrayIndex: parseInt(last, 10) };
        } else {
          const fieldName = parts.slice(0, parts.length - 1).join('-');
          payload = { field: fieldName, value: localEdits[editKey] };
        }
        await sc.put(`/api/edit/case_summaries/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail).
      await sc.put(`/api/edit/case_summaries/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage.
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          const parts = editKey.split('-');
          const last = parts[parts.length - 1];
          const secondLast = parts[parts.length - 2];
          if (/^\d+$/.test(last) && /^\d+$/.test(secondLast)) {
            const fieldName = parts.slice(0, parts.length - 2).join('-');
            delete store[rid][`${fieldName}.${last}`];
          } else {
            const fieldName = parts.slice(0, parts.length - 1).join('-');
            delete store[rid][fieldName];
          }
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CaseSummaries] Approve failed:', err); }
    finally { setApproving(false); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Case Summary ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.primaryDiagnosis, record.chiefComplaint, ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS)].filter(Boolean).join(' ');
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
    const isNum = NUMERIC_FIELDS.has(fn);
    const enumOpts = ENUM_FIELDS[fn];
    if (ie) {
      const stepVal = parseFloat(stepFor(raw)) || 1;
      const stepDecs = (String(stepVal).split('.')[1] || '').length;
      const stepNum = (dir) => { const cur = parseFloat(editValue); setEditValue(((isNaN(cur) ? 0 : cur) + dir * stepVal).toFixed(stepDecs)); };
      return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">
        {enumOpts ? (
          <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}>
            {!enumOpts.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
            {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : isNum ? (
          <div className="num-stepper-row">
            <button type="button" className="num-step" onClick={() => stepNum(-1)} disabled={saving}>−</button>
            <input type="number" step={stepFor(raw)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveNumber(record, fn, idx, sid); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />
            <button type="button" className="num-step" onClick={() => stepNum(1)} disabled={saving}>+</button>
          </div>
        ) : (
          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
        )}
        <div className="edit-actions"><button className="save-btn" onClick={() => isNum ? handleSaveNumber(record, fn, idx, sid) : handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
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
          return (<React.Fragment key={si}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentence); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className={`modified-badge${ed === 'added' ? ' added' : ''}`}>{ed === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const saveLabCommaItem = useCallback((record, fn, idx, sid, si, ci) => {
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const sentence = sentences[si] || '';
    const colonIdx = sentence.indexOf(':');
    // same label + split rules as parseLabeledSentences so (si, ci) indexes line up
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    const content = label ? sentence.substring(colonIdx + 1).trim() : sentence;
    const parts = splitLabParts(content);
    parts[ci] = editValue.replace(/\.\s+/g, ', ');
    const filtered = parts.filter(p => p.trim());
    sentences[si] = label ? `${label}: ${filtered.join(', ')}` : filtered.join(', ');
    const newValue = reconstructFullText(sentences);
    // Stage as a DRAFT (no DB write); localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, `${fn}-${idx}`, fn, newValue, sid, idx, { [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' });
  }, [editValue, getFieldValue, stageDraft]);

  const renderLabelCommaField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return null;
    const groups = parseLabeledSentences(String(raw));
    return (
      <div className="rec-mini-card">
      {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
      {groups.map((group, gi) => {
        const label = group.label;
        return (
          <React.Fragment key={gi}>
            {label && <div className="nested-subtitle">{highlightText(label)}</div>}
            {group.items.map(({ text: part, si, ci: pi }) => {
              const ck = `${fn}-${idx}-s${si}-c${pi}`;
              const ie = editingField === ck;
              const ed = editedFields[ck];
              const cid = `lc-${fn}-${idx}-${si}-${pi}`;
              if (ie) return (
                <div key={`${si}-${pi}`} className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLabCommaItem(record, fn, idx, sid, si, pi); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
                  <div className="edit-actions"><button className="save-btn" onClick={() => saveLabCommaItem(record, fn, idx, sid, si, pi)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div>
                </div>
              );
              return (
                <React.Fragment key={`${si}-${pi}`}>
                  <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(part); }}>
                    <div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                    <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
                  </div>
                  {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
      </div>);
  };

  const handleSaveArrayItemWithPrefix = useCallback((record, fn, idx, sid, arrayIndex, prefix) => {
    if (!getRecordId(record)) { console.error('[CaseSummaries] Cannot save — no record ID'); return; }
    const fullValue = prefix ? `${prefix}: ${editValue}` : editValue;
    stageDraft(record, `${fn}-${idx}-${arrayIndex}`, `${fn}.${arrayIndex}`, fullValue, sid, idx);
  }, [editValue, stageDraft]);

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai, displayContent, prefix) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const display = displayContent || val;
    const editContent = displayContent || val;
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { prefix ? handleSaveArrayItemWithPrefix(record, fn, idx, sid, ai, prefix) : handleSaveArrayItem(record, fn, idx, sid, ai); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => prefix ? handleSaveArrayItemWithPrefix(record, fn, idx, sid, ai, prefix) : handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(editContent); }}><div className="row-content"><span className="content-value">{highlightText(display)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(display, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); }); return m; });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { demographics: 'PATIENT DEMOGRAPHICS', complaint: 'CHIEF COMPLAINT', primary: 'PRIMARY DIAGNOSIS', secondary: 'SECONDARY DIAGNOSES', scores: 'CLINICAL SCORES', vitals: 'VITAL SIGNS', labs: 'LABORATORY VALUES', imaging: 'IMAGING & DIAGNOSTICS', medications: 'MEDICATIONS', allergies: 'ALLERGIES', procedures: 'PROCEDURES PERFORMED', disposition: 'DISPOSITION & FOLLOW-UP' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    // single-name rule: label == section title → hide the label (title already shown)
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (hasVal(pr[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(pr[fn])}\n\n`; } };
    const addSentenceSplit = (fn) => { if (!hasVal(pr[fn])) return; const sentences = splitBySentence(String(pr[fn])); sentences.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
    const addGroupedArr = (fn) => {
      const items = getEffectiveArray(pr, fn, idx);
      const groups = []; let cg = { label: null, items: [] };
      items.forEach(it => { const ci = String(it).indexOf(':'); const pfx = ci > 0 && ci < 30 ? String(it).substring(0, ci).trim() : null;
        if (pfx && pfx !== cg.label) { if (cg.items.length) groups.push(cg); cg = { label: pfx, items: [] }; }
        else if (!pfx && cg.label) { if (cg.items.length) groups.push(cg); cg = { label: null, items: [] }; }
        cg.items.push(pfx ? String(it).substring(ci + 1).trim() : String(it));
      });
      if (cg.items.length) groups.push(cg);
      groups.forEach(g => { if (g.label) text += `\n${g.label}\n${COPY_LINE_DASH}\n`; g.items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); });
    };
    // labeled sentences → sub-label + numbered comma parts; unlabeled sentences stay whole
    const emitLabelComma = (fn, withFieldLabel) => {
      if (!hasVal(pr[fn])) return;
      if (withFieldLabel) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`;
      let num = 0; // restarts per labeled group; unlabeled groups continue the count
      parseLabeledSentences(String(pr[fn])).forEach(group => {
        if (group.label) { num = 0; text += `${group.label}\n${COPY_LINE_DASH}\n`; }
        group.items.forEach(it => { num += 1; text += `${num}. ${it.text}\n`; });
        text += '\n';
      });
    };
    const arrSids = { secondary: 'secondaryDiagnoses', medications: 'medicationList', allergies: 'allergies', procedures: 'proceduresPerformed' };
    if (arrSids[sid]) { addGroupedArr(arrSids[sid]); }
    else if (sid === 'imaging') { getEffectiveArray(pr, 'imagingStudies', idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; ['ecgFindings', 'echocardiogramResults', 'leftVentricularEjectionFraction'].forEach(fn => { if (LABEL_COMMA_FIELDS.has(fn)) { emitLabelComma(fn, true); } else if (hasVal(pr[fn])) { text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n1. ${fmtVal(pr[fn])}\n\n`; } }); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (LABEL_COMMA_FIELDS.has(fn)) { emitLabelComma(fn, hasVal(pr[fn]) && showLbl(fn)); } else if (SENTENCE_SPLIT_FIELDS.has(fn)) { if (hasVal(pr[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`; addSentenceSplit(fn); text += '\n'; } } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CASE SUMMARIES\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Case Summary ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      // single-name rule: label == section title → hide the label (title already shown)
      let curTitle = '';
      const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== curTitle.toLowerCase();
      const addF = (fn) => { if (hasVal(r[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } };
      const addSentenceSplit = (fn) => { if (!hasVal(r[fn])) return; const sentences = splitBySentence(String(r[fn])); if (showLbl(fn)) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`; sentences.forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); text += '\n'; };
      const addArr = (title, fn) => {
        const items = getEffectiveArray(r, fn, idx); if (!items.length) return;
        text += `\n${title}\n${COPY_LINE_EQ}\n`;
        const groups = []; let cg = { label: null, items: [] };
        items.forEach(it => { const ci = String(it).indexOf(':'); const pfx = ci > 0 && ci < 30 ? String(it).substring(0, ci).trim() : null;
          if (pfx && pfx !== cg.label) { if (cg.items.length) groups.push(cg); cg = { label: pfx, items: [] }; }
          else if (!pfx && cg.label) { if (cg.items.length) groups.push(cg); cg = { label: null, items: [] }; }
          cg.items.push(pfx ? String(it).substring(ci + 1).trim() : String(it));
        });
        if (cg.items.length) groups.push(cg);
        groups.forEach(g => { if (g.label) text += `\n${g.label}\n${COPY_LINE_DASH}\n`; g.items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); });
      };
      const addLabelComma = (fn) => {
        if (!hasVal(r[fn])) return;
        if (showLbl(fn)) text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n`;
        let num = 0; // restarts per labeled group; unlabeled groups continue the count
        parseLabeledSentences(String(r[fn])).forEach(group => {
          if (group.label) { num = 0; text += `${group.label}\n${COPY_LINE_DASH}\n`; }
          group.items.forEach(it => { num += 1; text += `${num}. ${it.text}\n`; });
          text += '\n';
        });
      };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { curTitle = title; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (LABEL_COMMA_FIELDS.has(fn)) addLabelComma(fn); else if (SENTENCE_SPLIT_FIELDS.has(fn)) addSentenceSplit(fn); else addF(fn); }); } };
      simpleFs('PATIENT DEMOGRAPHICS', SECTION_FIELDS.demographics);
      simpleFs('CHIEF COMPLAINT', SECTION_FIELDS.complaint);
      simpleFs('PRIMARY DIAGNOSIS', SECTION_FIELDS.primary);
      addArr('SECONDARY DIAGNOSES', 'secondaryDiagnoses');
      simpleFs('CLINICAL SCORES', SECTION_FIELDS.scores);
      simpleFs('VITAL SIGNS', ['vitalSigns']);
      simpleFs('LABORATORY VALUES', ['laboratoryValues', 'creatinineClearance']);
      if (hasVal(r.imagingStudies) || hasVal(r.ecgFindings) || hasVal(r.echocardiogramResults) || hasVal(r.leftVentricularEjectionFraction)) {
        curTitle = 'IMAGING & DIAGNOSTICS';
        text += `\nIMAGING & DIAGNOSTICS\n${COPY_LINE_EQ}\n`;
        getEffectiveArray(r, 'imagingStudies', idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; });
        text += '\n';
        ['ecgFindings', 'echocardiogramResults', 'leftVentricularEjectionFraction'].forEach(fn => { if (LABEL_COMMA_FIELDS.has(fn)) addLabelComma(fn); else if (hasVal(r[fn])) { text += `${FIELD_LABELS[fn]}\n${COPY_LINE_DASH}\n1. ${fmtVal(r[fn])}\n\n`; } });
      }
      addArr('MEDICATIONS', 'medicationList');
      addArr('ALLERGIES', 'allergies');
      addArr('PROCEDURES PERFORMED', 'proceduresPerformed');
      simpleFs('DISPOSITION & FOLLOW-UP', SECTION_FIELDS.disposition);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (LABEL_COMMA_FIELDS.has(f)) return <React.Fragment key={f}>{renderLabelCommaField(record, f, idx, sid, sl)}</React.Fragment>; if (SENTENCE_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderSentenceSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      const groups = []; let currentGroup = { label: null, items: [] };
      items.forEach((item, ai) => {
        const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : String(item || '');
        const colonIdx = val.indexOf(':');
        const prefix = colonIdx > 0 && colonIdx < 30 ? val.substring(0, colonIdx).trim() : null;
        if (prefix && prefix !== currentGroup.label) {
          if (currentGroup.items.length > 0) groups.push(currentGroup);
          currentGroup = { label: prefix, items: [] };
        } else if (!prefix && currentGroup.label) {
          if (currentGroup.items.length > 0) groups.push(currentGroup);
          currentGroup = { label: null, items: [] };
        }
        currentGroup.items.push({ item, ai, val, content: prefix ? val.substring(colonIdx + 1).trim() : val });
      });
      if (currentGroup.items.length > 0) groups.push(currentGroup);
      return (<>{groups.map((group, gi) => {
        const groupItems = group.items.filter(({ val }) => sa || phraseMatch(val, searchTerm));
        if (groupItems.length === 0) return null;
        return (<div key={gi} className="rec-mini-card">
          {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
          {groupItems.map(({ item, ai, content }) => renderEditableArrayItem(record, fieldName, idx, sid, item, ai, content, group.label))}
        </div>);
      })}</>);
    })());
  };

  const renderImagingSection = (record, idx) => {
    const hasImaging = Array.isArray(record.imagingStudies) && record.imagingStudies.filter(Boolean).length > 0;
    const hasEcg = hasVal(getFieldValue(record, 'ecgFindings', idx));
    const hasEcho = hasVal(getFieldValue(record, 'echocardiogramResults', idx));
    const hasLvef = hasVal(getFieldValue(record, 'leftVentricularEjectionFraction', idx));
    if (!hasImaging && !hasEcg && !hasEcho && !hasLvef) return null;
    if (!shouldShowSection(record, 'Imaging & Diagnostics', [...(record.imagingStudies || []), record.ecgFindings, record.echocardiogramResults].filter(Boolean), ['imagingStudies', 'ecgFindings', 'echocardiogramResults', 'leftVentricularEjectionFraction'])) return null;
    const stm = sectionTitleMatches('Imaging & Diagnostics');
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return renderSection(record, idx, 'imaging', 'Imaging & Diagnostics', (<>
      {hasImaging && (record.imagingStudies || []).filter(Boolean).map((item, ai) => { const val = localEdits[`imagingStudies-${idx}-${ai}`] !== undefined ? localEdits[`imagingStudies-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'imagingStudies', idx, 'imaging', item, ai); }).filter(Boolean)}
      {hasEcg && (sa || fieldMatches(record, 'ecgFindings', idx)) && renderEditableField(record, 'ecgFindings', idx, 'imaging')}
      {hasEcho && (sa || fieldMatches(record, 'echocardiogramResults', idx)) && renderLabelCommaField(record, 'echocardiogramResults', idx, 'imaging')}
      {hasLvef && (sa || fieldMatches(record, 'leftVentricularEjectionFraction', idx)) && renderEditableField(record, 'leftVentricularEjectionFraction', idx, 'imaging')}
    </>));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="case-summaries-document"><header className="document-header"><h1 className="document-title">Case Summaries</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="case-summaries-document">
      <header className="document-header">
        <h1 className="document-title">Case Summaries</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CaseSummariesPDFTemplate document={pdfData} />} fileName="Case_Summaries.pdf">
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
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Case Summary ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'demographics', 'Patient Demographics', SECTION_FIELDS.demographics)}
            {renderMultiFieldSection(record, idx, 'complaint', 'Chief Complaint', SECTION_FIELDS.complaint)}
            {renderMultiFieldSection(record, idx, 'primary', 'Primary Diagnosis', SECTION_FIELDS.primary)}
            {renderArraySection(record, idx, 'secondary', 'Secondary Diagnoses', 'secondaryDiagnoses')}
            {renderMultiFieldSection(record, idx, 'scores', 'Clinical Scores', SECTION_FIELDS.scores)}
            {renderMultiFieldSection(record, idx, 'vitals', 'Vital Signs', ['vitalSigns'])}
            {renderMultiFieldSection(record, idx, 'labs', 'Laboratory Values', SECTION_FIELDS.labs)}
            {renderImagingSection(record, idx)}
            {renderArraySection(record, idx, 'medications', 'Medications', 'medicationList')}
            {renderArraySection(record, idx, 'allergies', 'Allergies', 'allergies')}
            {renderArraySection(record, idx, 'procedures', 'Procedures Performed', 'proceduresPerformed')}
            {renderMultiFieldSection(record, idx, 'disposition', 'Disposition & Follow-Up', SECTION_FIELDS.disposition)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CaseSummariesDocument;
