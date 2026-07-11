/**
 * ChiropracticTreatmentPlanDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + sentence-split + label-sentence. Collection: chiropractic_treatment_plan
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChiropracticTreatmentPlanDocumentPDFTemplate from '../pdf-templates/ChiropracticTreatmentPlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import './ChiropracticTreatmentPlanDocument.css';

const SECTION_FIELDS = {
  complaint: ['chiefComplaint'],
  scores: ['painVisualAnalogScale', 'oswestryDisabilityIndex', 'neckDisabilityIndex', 'cobbAngleMeasurement'],
  subluxation: ['subluxationLevels'],
  regions: ['spinalRegionsInvolved'],
  techniques: ['adjustmentTechniques'],
  rom: ['rangeOfMotionCervical', 'rangeOfMotionLumbar'],
  neuro: ['muscleStrengthGrading', 'deepTendonReflexFindings', 'dermatomeDistribution'],
  ortho: ['orthopedicTestResults'],
  schedule: ['highVelocityLowAmplitudeIndicated', 'treatmentFrequencyPerWeek', 'totalVisitsAuthorized', 'treatmentPhase', 'reassessmentIntervalWeeks', 'maximumMedicalImprovementDate'],
  adjunctive: ['adjunctiveTherapiesOrdered'],
  exercise: ['homeExerciseProgramPrescribed', 'ergonomicRecommendations'],
  goals: ['functionalOutcomeGoals'],
  contraindications: ['contraindications'],
};
const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint', painVisualAnalogScale: 'Pain (VAS)', oswestryDisabilityIndex: 'Oswestry Disability Index', neckDisabilityIndex: 'Neck Disability Index', cobbAngleMeasurement: 'Cobb Angle',
  rangeOfMotionCervical: 'Cervical ROM', rangeOfMotionLumbar: 'Lumbar ROM',
  muscleStrengthGrading: 'Muscle Strength', deepTendonReflexFindings: 'Deep Tendon Reflexes', dermatomeDistribution: 'Dermatome Distribution',
  highVelocityLowAmplitudeIndicated: 'HVLA Indicated', treatmentFrequencyPerWeek: 'Frequency/Week', totalVisitsAuthorized: 'Total Visits Authorized', treatmentPhase: 'Treatment Phase', reassessmentIntervalWeeks: 'Reassessment Interval (weeks)', maximumMedicalImprovementDate: 'Maximum Medical Improvement Date',
  homeExerciseProgramPrescribed: 'Home Exercise Program', ergonomicRecommendations: 'Ergonomic Recommendations',
};
const ARRAY_FIELDS = ['subluxationLevels', 'spinalRegionsInvolved', 'adjustmentTechniques', 'orthopedicTestResults', 'adjunctiveTherapiesOrdered', 'contraindications', 'functionalOutcomeGoals'];
const DATE_FIELDS = new Set(['maximumMedicalImprovementDate']);
const NUMBER_FIELDS = new Set(['painVisualAnalogScale', 'oswestryDisabilityIndex', 'neckDisabilityIndex', 'cobbAngleMeasurement', 'treatmentFrequencyPerWeek', 'totalVisitsAuthorized', 'reassessmentIntervalWeeks']);
const BOOLEAN_FIELDS = new Set(['highVelocityLowAmplitudeIndicated', 'homeExerciseProgramPrescribed']);
const toInputDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; } };

// All long narrative fields split by sentence THEN by comma (labeled groups get a nested subtitle).
const TEXT_BLOCK_FIELDS = new Set(['chiefComplaint', 'rangeOfMotionCervical', 'rangeOfMotionLumbar', 'muscleStrengthGrading', 'deepTendonReflexFindings', 'dermatomeDistribution', 'ergonomicRecommendations']);
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Sentence split with abbreviation+decimal guard (never breaks "vs."/"L4-L5."/"3.5"/"Dr.").
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
// Guarded comma split: never inside parentheses; ", and …"/", or …" stays connected; no-space commas kept.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
// Sentences → groups: labeled sentence = own group (label + comma rows); consecutive unlabeled
// sentences collect into one group, also comma-split. Items carry (si, ci).
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach((sentence, si) => {
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    if (label) {
      const parts = splitByComma(sentence.substring(colonIdx + 1).trim());
      groups.push({ label, items: parts.map((p, pi) => ({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi })) });
      nullGroup = null;
    } else {
      if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); }
      splitByComma(sentence).forEach((p, pi) => nullGroup.items.push({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi }));
    }
  });
  return groups;
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'chiropractic_treatment_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ChiropracticTreatmentPlanDocument = ({ document: rawDoc }) => {
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
      if (r?.chiropractic_treatment_plan) return Array.isArray(r.chiropractic_treatment_plan) ? r.chiropractic_treatment_plan : [r.chiropractic_treatment_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chiropractic_treatment_plan) return Array.isArray(dd.chiropractic_treatment_plan) ? dd.chiropractic_treatment_plan : [dd.chiropractic_treatment_plan]; return [dd]; }
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
      const id = record && record._id;
      const rid = id ? (typeof id === 'string' ? id : (id.$oid || String(id))) : null;
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArr = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArr
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`
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
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, overrideValue) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[ChiropracticTreatmentPlan] Cannot save — no record ID'); return; }
    const valueToSave = overrideValue !== undefined ? overrideValue : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: valueToSave }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = valueToSave;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveNumberField = useCallback((record, fn, idx, sid) => {
    const num = parseFloat(editValue);
    if (isNaN(num)) return;
    return handleSaveField(record, fn, idx, sid, num);
  }, [editValue, handleSaveField]);

  // Array-item Save = stage a DRAFT locally only (fieldPart = "field.arrayIndex"). Approve commits.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[ChiropracticTreatmentPlan] Cannot save array item — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Sentence Save = splice the edited sentence back into the full field and stage it as a DRAFT locally.
  // No DB write here; localStorage keeps it across refresh; Approve commits the whole field value.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticTreatmentPlan] Cannot save sentence — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx); const sentences = splitBySentence(String(raw || '')); const originalSentence = sentences[sentenceIdx]; const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); }
    else { const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== (originalSentence || '').replace(/[;.]+$/, '').trim(); setEditedFields(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); } else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); } }
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = newValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record+section's staged edits. editKey = "field-idx" or "field-idx-arrayIndex".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        // arrayIndex form: ...-<idx>-<arrayIndex>
        let m = k.match(/^(.+)-(\d+)-(\d+)$/);
        if (m) return parseInt(m[2], 10) === idx && sf.includes(m[1]);
        // field form: ...-<idx>
        m = k.match(/^(.+)-(\d+)$/);
        if (m) return parseInt(m[2], 10) === idx && sf.includes(m[1]);
        return false;
      });
      for (const editKey of toCommit) {
        let m = editKey.match(/^(.+)-(\d+)-(\d+)$/);
        let payload;
        if (m) payload = { field: m[1], value: localEdits[editKey], arrayIndex: parseInt(m[3], 10) };
        else { m = editKey.match(/^(.+)-(\d+)$/); payload = { field: m[1], value: localEdits[editKey] }; }
        const resp = await sc.put(`/api/edit/chiropractic_treatment_plan/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/chiropractic_treatment_plan/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          let m = editKey.match(/^(.+)-(\d+)-(\d+)$/);
          const fieldPart = m ? `${m[1]}.${m[3]}` : editKey.replace(/-(\d+)$/, '');
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChiropracticTreatmentPlan] Approve failed:', err); }
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
      const title = `Chiropractic Treatment Plan ${idx + 1}`;
      const allText = [title, formatDate(record.createdAt), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Chief Complaint', 'Clinical Scores', 'Subluxation', 'Spinal Regions', 'Techniques', 'Range of Motion', 'Neurological', 'Orthopedic Tests', 'Treatment Schedule', 'Adjunctive Therapies', 'Exercise & Ergonomics', 'Functional Goals', 'Contraindications'].filter(Boolean).join(' ');
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
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNumberField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const num = typeof raw === 'number' ? raw : parseFloat(raw); if (isNaN(num) || num === 0) return null;
    const dv = String(num); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) { const st = parseFloat(stepFor(num)) || 1; const dec = (String(st).split('.')[1] || '').length; const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); }; return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={() => bump(-st)}>−</button><input type="number" step={stepFor(num)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveNumberField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><button type="button" className="num-step" disabled={saving} onClick={() => bump(st)}>+</button></div><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNumberField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); }
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderBooleanField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const boolVal = typeof raw === 'boolean' ? raw : (String(raw).toLowerCase() === 'true' || String(raw).toLowerCase() === 'yes');
    const dv = boolVal ? 'Yes' : 'No'; const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid, editValue === 'Yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderDateField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const displayVal = formatDate(raw);
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save one comma-part of one sentence: splice the edited part back (label preserved for labeled
  // sentences), rejoin ', ', rebuild the field. Stage as a DRAFT (no DB write until Approve).
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticTreatmentPlan] Cannot save part — no record ID'); return; }
    const sentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = sentences[si] || '';
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    const content = label ? sentence.substring(colonIdx + 1).trim() : sentence;
    const parts = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    if (parts.length) sentences[si] = label ? `${label}: ${parts.join(', ')}` : parts.join(', '); else sentences.splice(si, 1);
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = newValue; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue]);

  // Long narrative field → sentence split, then guarded comma split. Labeled sentences render as a
  // nested-subtitle GROUP with comma rows; unlabeled sentences collect into comma rows. Each row edits
  // individually (savePart splices it back, preserving the label).
  const renderSplitField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const groups = parseLabeledSentences(String(raw));
    if (groups.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
            {group.items.map(({ text: part, si, ci }) => {
              const sk = `${fn}-${idx}-s${si}-c${ci}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}-${ci}`;
              if (ie) return (<div key={sk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(record, fn, idx, sid, si, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => savePart(record, fn, idx, sid, si, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
              return (<React.Fragment key={sk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Save one comma-part of one array item: re-split the item (guarded), splice the edited part, rejoin
  // ', ', save the whole rebuilt item as the array element (PDF/Copy re-split consistently).
  const saveArrayPart = useCallback((record, fn, idx, sid, ai, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticTreatmentPlan] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${ai}`;
    const curItem = localEdits[ek] !== undefined ? localEdits[ek] : (Array.isArray(record[fn]) ? record[fn][ai] : '');
    const parts = splitByComma(String(curItem || ''));
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    const rebuilt = parts.map(p => String(p).trim()).filter(Boolean).join(', ');
    setLocalEdits(prev => ({ ...prev, [ek]: rebuilt }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${ai}-c${ci}`]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][`${fn}.${ai}`] = rebuilt; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits]);

  // Array item → guarded comma split ONLY when it yields >=3 parts (a genuine list); below 3 the comma
  // is grammatical dosing so keep the item whole (Rule #73). >=3: each part its own editable row.
  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const rawVal = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const parts = splitByComma(String(rawVal));
    if (parts.length < 3) {
      const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`; const val = String(rawVal);
      if (ie) return (<React.Fragment key={ek}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
      return (<React.Fragment key={ek}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
    }
    return parts.map((part, ci) => {
      const cleanPart = part.replace(/[.;]+$/, '').trim();
      const pk = `${fn}-${idx}-${ai}-c${ci}`; const ie = editingField === pk; const ed = editedFields[pk]; const cid = `arr-${fn}-${idx}-${ai}-${ci}`;
      if (ie) return (<div key={pk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveArrayPart(record, fn, idx, sid, ai, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveArrayPart(record, fn, idx, sid, ai, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<React.Fragment key={pk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(pk); setEditValue(cleanPart); }}><div className="row-content"><span className="content-value">{highlightText(cleanPart)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(cleanPart, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
    });
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      // Flat-field edits (skip array-item keys "field-idx-arrayIndex" and pending drafts)
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      // Array-item edits — merge committed (non-pending) edits only
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { complaint: 'CHIEF COMPLAINT', scores: 'CLINICAL SCORES', subluxation: 'SUBLUXATION LEVELS', regions: 'SPINAL REGIONS', techniques: 'ADJUSTMENT TECHNIQUES', rom: 'RANGE OF MOTION', neuro: 'NEUROLOGICAL EXAM', ortho: 'ORTHOPEDIC TESTS', schedule: 'TREATMENT SCHEDULE', adjunctive: 'ADJUNCTIVE THERAPIES', exercise: 'EXERCISE & ERGONOMICS', goals: 'FUNCTIONAL OUTCOME GOALS', contraindications: 'CONTRAINDICATIONS' };

  // A text-block field → grouped lines: labeled group = label + DASH (numbering restarts); unlabeled
  // group continues the running count. Field sub-label emitted first (unless == section title).
  const emitBlock = (fn, rawValue, sectionTitle) => {
    const groups = parseLabeledSentences(String(rawValue ?? ''));
    if (groups.length === 0) return '';
    let out = '';
    if ((FIELD_LABELS[fn] || fn).toLowerCase() !== String(sectionTitle).toLowerCase()) out += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`;
    let n = 0;
    groups.forEach(g => { if (g.label) { n = 0; out += `${g.label}\n${COPY_LINE_DASH}\n`; } g.items.forEach(it => { if (it.text) out += `${++n}. ${it.text}\n`; }); });
    return out + '\n';
  };
  // Array → numbered rows; each item comma-splits ONLY when >=3 parts (else whole).
  const emitArr = (items) => { let out = ''; let n = 0; items.forEach(it => { const parts = splitByComma(String(it)); (parts.length >= 3 ? parts : [String(it)]).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) out += `${++n}. ${t}\n`; }); }); return out; };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (!hasVal(pr[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${DATE_FIELDS.has(fn) ? formatDate(pr[fn]) : fmtVal(pr[fn])}\n\n`; };
    const arrSids = { subluxation: 'subluxationLevels', regions: 'spinalRegionsInvolved', techniques: 'adjustmentTechniques', ortho: 'orthopedicTestResults', adjunctive: 'adjunctiveTherapiesOrdered', goals: 'functionalOutcomeGoals', contraindications: 'contraindications' };
    if (arrSids[sid]) { text += emitArr(getEffectiveArray(pr, arrSids[sid], idx)); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) { if (hasVal(pr[fn])) text += emitBlock(fn, pr[fn], title); } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CHIROPRACTIC TREATMENT PLAN\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Chiropractic Treatment Plan ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.createdAt) text += `${formatDate(r.createdAt)}\n`;
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; text += emitArr(items); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (!vis.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) text += emitBlock(fn, r[fn], title); else { const showLbl = (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase(); if (showLbl) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${DATE_FIELDS.has(fn) ? formatDate(r[fn]) : fmtVal(r[fn])}\n\n`; } }); };
      simpleFs('CHIEF COMPLAINT', ['chiefComplaint']);
      simpleFs('CLINICAL SCORES', SECTION_FIELDS.scores);
      addArr('SUBLUXATION LEVELS', 'subluxationLevels');
      addArr('SPINAL REGIONS', 'spinalRegionsInvolved');
      addArr('ADJUSTMENT TECHNIQUES', 'adjustmentTechniques');
      simpleFs('RANGE OF MOTION', SECTION_FIELDS.rom);
      simpleFs('NEUROLOGICAL EXAM', SECTION_FIELDS.neuro);
      addArr('ORTHOPEDIC TESTS', 'orthopedicTestResults');
      simpleFs('TREATMENT SCHEDULE', SECTION_FIELDS.schedule);
      addArr('ADJUNCTIVE THERAPIES', 'adjunctiveTherapiesOrdered');
      simpleFs('EXERCISE & ERGONOMICS', SECTION_FIELDS.exercise);
      addArr('FUNCTIONAL OUTCOME GOALS', 'functionalOutcomeGoals');
      addArr('CONTRAINDICATIONS', 'contraindications');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (DATE_FIELDS.has(f)) return <React.Fragment key={f}>{renderDateField(record, f, idx, sid, sl)}</React.Fragment>; if (NUMBER_FIELDS.has(f)) return <React.Fragment key={f}>{renderNumberField(record, f, idx, sid, sl)}</React.Fragment>; if (BOOLEAN_FIELDS.has(f)) return <React.Fragment key={f}>{renderBooleanField(record, f, idx, sid, sl)}</React.Fragment>; if (TEXT_BLOCK_FIELDS.has(f)) return <React.Fragment key={f}>{renderSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="chiropractic-treatment-plan-document"><header className="document-header"><h1 className="document-title">Chiropractic Treatment Plan</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="chiropractic-treatment-plan-document">
      <header className="document-header">
        <h1 className="document-title">Chiropractic Treatment Plan</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChiropracticTreatmentPlanDocumentPDFTemplate document={pdfData} />} fileName="Chiropractic_Treatment_Plan.pdf">
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
                {record.createdAt && <span className="record-date">{highlightText(formatDate(record.createdAt))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Chiropractic Treatment Plan ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'complaint', 'Chief Complaint', ['chiefComplaint'])}
            {renderMultiFieldSection(record, idx, 'scores', 'Clinical Scores', SECTION_FIELDS.scores)}
            {renderArraySection(record, idx, 'subluxation', 'Subluxation Levels', 'subluxationLevels')}
            {renderArraySection(record, idx, 'regions', 'Spinal Regions', 'spinalRegionsInvolved')}
            {renderArraySection(record, idx, 'techniques', 'Adjustment Techniques', 'adjustmentTechniques')}
            {renderMultiFieldSection(record, idx, 'rom', 'Range of Motion', SECTION_FIELDS.rom)}
            {renderMultiFieldSection(record, idx, 'neuro', 'Neurological Exam', SECTION_FIELDS.neuro)}
            {renderArraySection(record, idx, 'ortho', 'Orthopedic Tests', 'orthopedicTestResults')}
            {renderMultiFieldSection(record, idx, 'schedule', 'Treatment Schedule', SECTION_FIELDS.schedule)}
            {renderArraySection(record, idx, 'adjunctive', 'Adjunctive Therapies', 'adjunctiveTherapiesOrdered')}
            {renderMultiFieldSection(record, idx, 'exercise', 'Exercise & Ergonomics', SECTION_FIELDS.exercise)}
            {renderArraySection(record, idx, 'goals', 'Functional Outcome Goals', 'functionalOutcomeGoals')}
            {renderArraySection(record, idx, 'contraindications', 'Contraindications', 'contraindications')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChiropracticTreatmentPlanDocument;
