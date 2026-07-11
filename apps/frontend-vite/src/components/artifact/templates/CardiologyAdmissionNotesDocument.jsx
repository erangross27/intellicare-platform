/**
 * CardiologyAdmissionNotesDocument.jsx
 * March 2026 blue glow theme with inline editing + dot-path for nested objects.
 * Sentence-split for ekgFindings, cardiacCatheterizationPlanned.
 * Collection: cardiology_admission_notes
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiologyAdmissionNotesPDFTemplate from '../pdf-templates/CardiologyAdmissionNotesPDFTemplate';
import './CardiologyAdmissionNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { value, put } } }
     - editKey: the exact localEdits key for this draft (re-applied on mount).
     - value:   the localEdits value to restore (string/number for scalar/array/sentence,
                or the whole cloned object for an object-leaf edit).
     - put:     the exact PUT body to replay on Approve: { field, value, arrayIndex? }. */
const DRAFT_KEY = 'cardiologyAdmissionNotesPendingEdits';
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
  admission: ['admissionDate', 'acuteCoronarySyndromeType', 'chiefCardiacComplaint', 'nyhaClassification', 'killipClassification'],
  chestPain: ['chestPainCharacteristics.quality', 'chestPainCharacteristics.severity', 'chestPainCharacteristics.location', 'chestPainCharacteristics.radiation', 'chestPainCharacteristics.duration', 'chestPainCharacteristics.onset'],
  labs: ['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'],
  ekg: ['ekgFindings'],
  echo: ['echocardiogramResults.ejectionFraction', 'echocardiogramResults.wallMotion', 'echocardiogramResults.valves', 'echocardiogramResults.complications'],
  riskFactors: ['cardiacRiskFactors'],
  medications: ['currentCardiacMedications'],
  cath: ['cardiacCatheterizationPlanned'],
  valvular: ['valvularAbnormalities'],
  hemodynamics: ['hemodynamicParameters'],
  inotropes: ['inotropicSupport'],
  anticoagulation: ['anticoagulationStatus'],
  additional: ['coronaryArteryDiseaseHistory', 'arrhythmiaType', 'pulmonaryEdemaPresence', 'thrombolyticEligibility', 'telemetryMonitoring', 'functionalCapacity'],
};
const FIELD_LABELS = {
  admissionDate: 'Admission Date',
  acuteCoronarySyndromeType: 'ACS Type', chiefCardiacComplaint: 'Chief Complaint',
  nyhaClassification: 'NYHA Classification', killipClassification: 'Killip Classification',
  'chestPainCharacteristics.quality': 'Quality', 'chestPainCharacteristics.severity': 'Severity',
  'chestPainCharacteristics.location': 'Location', 'chestPainCharacteristics.radiation': 'Radiation',
  'chestPainCharacteristics.duration': 'Duration', 'chestPainCharacteristics.onset': 'Onset',
  troponinLevel: 'Troponin Level', bnpLevel: 'BNP Level', leftVentricularEjectionFraction: 'LVEF',
  ekgFindings: 'EKG Findings',
  'echocardiogramResults.ejectionFraction': 'Ejection Fraction', 'echocardiogramResults.wallMotion': 'Wall Motion',
  'echocardiogramResults.valves': 'Valves', 'echocardiogramResults.complications': 'Complications',
  cardiacCatheterizationPlanned: 'Cardiac Catheterization',
  coronaryArteryDiseaseHistory: 'CAD History', arrhythmiaType: 'Arrhythmia Type',
  pulmonaryEdemaPresence: 'Pulmonary Edema', thrombolyticEligibility: 'Thrombolytic Eligibility',
  telemetryMonitoring: 'Telemetry Monitoring', functionalCapacity: 'Functional Capacity',
  hemodynamicParameters: 'Hemodynamic Parameters', inotropicSupport: 'Inotropic Support',
  anticoagulationStatus: 'Anticoagulation Status',
};
const ARRAY_FIELDS = ['cardiacRiskFactors', 'currentCardiacMedications', 'valvularAbnormalities', 'inotropicSupport'];
const NUMBER_FIELDS = ['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'];
const OBJECT_FIELDS = ['hemodynamicParameters', 'anticoagulationStatus'];

const KEY_OVERRIDES = { bp: 'BP', hr: 'HR', map: 'MAP', svr: 'SVR', co: 'CO', ci: 'CI', cvp: 'CVP', pcwp: 'PCWP', pap: 'PAP', spo2: 'SpO2', inr: 'INR', ptt: 'PTT', aptt: 'aPTT', doac: 'DOAC' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const splitNumberUnit = (text) => { if (text === null || text === undefined) return null; const s = String(text).trim(); if (s === '') return null; if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/); if (!m || !/\d/.test(m[1])) return null; return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() }; };
const splitRatio = (text) => { if (text === null || text === undefined) return null; const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (!m) return null; return { num: m[1], denom: m[2] }; };
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const getNestedVal = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;,]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[,;]+$/, ''); return i < sentences.length - 1 ? t + ',' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const CardiologyAdmissionNotesDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
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
      if (r?.cardiology_admission_notes) return Array.isArray(r.cardiology_admission_notes) ? r.cardiology_admission_notes : [r.cardiology_admission_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiology_admission_notes) return Array.isArray(dd.cardiology_admission_notes) ? dd.cardiology_admission_notes : [dd.cardiology_admission_notes]; return [dd]; }
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
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid ? id.$oid : String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      // editKey/trackKey were saved with this record's render index; records order is stable
      // (derived from rawDoc), so the stored keys map back to the same render index here.
      Object.values(recDrafts).forEach(({ editKey, value, trackKey }) => {
        if (!editKey) return;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[trackKey || editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, dotPath, idx) => { const ek = `${dotPath}-${idx}`; if (localEdits[ek] !== undefined) return localEdits[ek]; return dotPath.includes('.') ? getNestedVal(record, dotPath) : record[dotPath]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = safeArr(record[fieldName]); const result = [...original]; result.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) result[ai] = localEdits[ek]; }); return result; }, [localEdits]);

  // Stage a DRAFT (localStorage) so a Save survives refresh. NO DB write here — Approve commits.
  // Also drops this section's 'approved' flag so re-editing returns the button to yellow Pending Approve.
  const stageDraft = useCallback((rid, sid, idx, editKey, value, put, trackKey) => {
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][editKey] = { editKey, value, put, trackKey: trackKey || editKey };
    writeDrafts(store);
    setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  // Save = stage a DRAFT locally only (NOT MongoDB, NOT PDF). Approve (handleApproveSection) commits.
  const handleSaveField = useCallback((record, dotPath, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyAdmission] No record ID'); return; }
    const ek = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(rid, sid, idx, ek, editValue, { field: dotPath, value: editValue });
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  /* number field save — value staged as a NUMBER */
  const handleSaveNumberField = useCallback((record, dotPath, idx, sid, numVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyAdmission] No record ID'); return; }
    const ek = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: numVal }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(rid, sid, idx, ek, numVal, { field: dotPath, value: numVal });
    setEditingField(null); setEditValue('');
  }, [stageDraft]);

  /* object leaf save by dot-path (e.g. hemodynamicParameters.bloodPressure) — staged only */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyAdmission] No record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const ek = `${rootField}-${idx}`;
    // Build the merged clone from the latest local edit (if any) or the original record value.
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) { if (!node[path[i]] || typeof node[path[i]] !== 'object') node[path[i]] = {}; node = node[path[i]]; }
    node[path[path.length - 1]] = newVal;
    setLocalEdits(prev => ({ ...prev, [ek]: clone }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    // Stage the whole merged object as the draft value; replay the leaf-only PUT on Approve.
    stageDraft(rid, sid, idx, ek, clone, { field: dottedField, value: newVal }, leafKeyTrack);
    setEditingField(null); setEditValue('');
  }, [localEdits, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyAdmission] No record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(rid, sid, idx, ek, editValue, { field: fn, value: editValue, arrayIndex });
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setSaving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      const sf = SECTION_FIELDS[sid] || [];
      const fieldMatches = (editKey) => sf.some(f => editKey.startsWith(`${f}-${idx}`));
      const toCommit = Object.keys(recDrafts).filter(k => pendingEdits[k] && fieldMatches(k));
      // Persist each staged field to the DB now using the exact PUT body captured at save time.
      for (const editKey of toCommit) {
        const { put } = recDrafts[editKey];
        if (put) await sc.put(`/api/edit/cardiology_admission_notes/${rid}/edit`, put);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/cardiology_admission_notes/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's committed drafts from localStorage
      toCommit.forEach(k => { delete recDrafts[k]; });
      if (Object.keys(recDrafts).length === 0) delete store[rid]; else store[rid] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CardiologyAdmission] Approve failed:', err); } finally { setSaving(false); }
  }, [pendingEdits]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiologyAdmission] No record ID'); return; }
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
    const trackKey = `${fn}-${idx}-s${sentenceIdx}`;
    setEditedFields(prev => { const n = { ...prev, [trackKey]: 'edited' }; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; });
    // Stage as a DRAFT (no DB write). Approve commits the full reconstructed text.
    stageDraft(rid, sid, idx, ek, fullText, { field: fn, value: fullText }, trackKey);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue, stageDraft]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cardiology Admission ${idx + 1}`;
      const cp = record.chestPainCharacteristics || {}; const echo = record.echocardiogramResults || {};
      const allText = [title, formatDate(record.admissionDate), record.acuteCoronarySyndromeType, record.chiefCardiacComplaint, record.ekgFindings, record.cardiacCatheterizationPlanned, cp.quality, cp.severity, cp.location, echo.ejectionFraction, echo.wallMotion, ...safeArr(record.cardiacRiskFactors), ...safeArr(record.currentCardiacMedications), ...safeArr(record.cardiacBiomarkerTrend), ...Object.values(FIELD_LABELS), 'Admission Information', 'Chest Pain', 'Labs & Vitals', 'EKG Findings', 'Echocardiogram', 'Risk Factors', 'Medications', 'Catheterization', 'Biomarker Trend'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, dotPath, label, idx, sid) => {
    const raw = getFieldValue(record, dotPath, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${dotPath}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${dotPath}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, dotPath, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={dotPath === 'chiefCardiacComplaint' || dotPath === 'cardiacCatheterizationPlanned' ? 3 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, dotPath, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* NUMBER field — number input, parseFloat + isNaN block, hide-zero */
  const renderNumberField = (record, dotPath, label, idx, sid) => {
    const raw = getFieldValue(record, dotPath, idx);
    const num = typeof raw === 'number' ? raw : (raw === '' || raw === null || raw === undefined ? NaN : parseFloat(raw));
    if (!Number.isFinite(num) || num === 0) return null;
    const dv = String(num); const ek = `${dotPath}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${dotPath}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveNumberField(record, dotPath, idx, sid, n); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* DATE field — date picker editor */
  const renderDateField = (record, dotPath, label, idx, sid) => {
    const raw = getFieldValue(record, dotPath, idx); if (!hasVal(raw)) return null;
    const dv = formatDate(raw); const ek = `${dotPath}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${dotPath}-${idx}`;
    const toInputDate = (v) => { try { const d = new Date(v.$date || v); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; } catch { return ''; } };
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, dotPath, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* OBJECT leaf — bool→Yes/No select, number+unit→number input, ratio→number, else textarea */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey; const ed = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { if (!ie) { setEditingField(leafKey); setEditValue(editStartValue); } }}>
          {ie ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="yes">Yes</option><option value="no">No</option></select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row"><input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />{ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}</div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); let newVal; if (isBool) { newVal = editValue === 'yes'; } else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; } else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); } else { newVal = editValue.trim(); } saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
              <button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v) : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (<React.Fragment>{entries.map(([k, v]) => (isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v) : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>))}</React.Fragment>);
  };

  const renderObjectSection = (record, idx, sid, title, fieldName) => {
    const val = getFieldValue(record, fieldName, idx); if (!hasVal(val) || isScalar(val)) return null;
    if (!shouldShowSection(record, title, [flattenSearchable(val)], [fieldName])) return null;
    return renderSection(record, idx, sid, title, renderObjectField(record, fieldName, idx, sid));
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx); if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
        const parsed = parseLabel(sent);
        const showLabel = parsed && parsed.label.toLowerCase() !== title.toLowerCase();
        const saveLbl = (label) => { saveSentence(record, fieldName, idx, sid, si, label ? `${label}: ${editValue}` : editValue); };
        if (ie) return (<div key={si} className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        const displayText = parsed ? parsed.content : sent;
        return (<div key={si} className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; /* pending drafts stay OUT of the PDF until approved */ const parts = key.split('-'); const ri = parseInt(parts[parts.length - 1], 10); if (ri !== idx) return; const dotPath = parts.slice(0, -1).join('-'); if (dotPath.includes('.')) { const dp = dotPath.split('.'); let obj = m; for (let i = 0; i < dp.length - 1; i++) { if (!obj[dp[i]]) obj[dp[i]] = {}; obj = obj[dp[i]]; } obj[dp[dp.length - 1]] = localEdits[key]; } else if (dotPath in record) { m[dotPath] = localEdits[key]; } });
      ARRAY_FIELDS.forEach(field => { const whole = localEdits[`${field}-${idx}`]; if (Array.isArray(whole) && !pendingEdits[`${field}-${idx}`]) { m[field] = whole; } else { m[field] = getEffectiveArray(record, field, idx); } });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { admission: 'ADMISSION INFORMATION', chestPain: 'CHEST PAIN CHARACTERISTICS', labs: 'LABS & VITALS', ekg: 'EKG FINDINGS', echo: 'ECHOCARDIOGRAM', riskFactors: 'CARDIAC RISK FACTORS', medications: 'CURRENT CARDIAC MEDICATIONS', cath: 'CARDIAC CATHETERIZATION', valvular: 'VALVULAR ABNORMALITIES', hemodynamics: 'HEMODYNAMIC PARAMETERS', inotropes: 'INOTROPIC SUPPORT', anticoagulation: 'ANTICOAGULATION STATUS', biomarkerTrend: 'BIOMARKER TREND', additional: 'ADDITIONAL INFORMATION' };

  const objectCopyLines = (label, value, indent) => { const pad = '  '.repeat(indent); const out = []; if (isEmptyDeep(value)) return out; if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; } if (label) out.push(`${pad}${label}:`); Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0)))); return out; };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (dp, label) => { const v = dp.includes('.') ? getNestedVal(pr, dp) : pr[dp]; if (hasVal(v)) text += `${label}: ${fmtVal(v)}\n`; };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    const sentFs = (fn) => { splitBySentence(fmtVal(pr[fn] || '')).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
    if (sid === 'admission') { ['acuteCoronarySyndromeType', 'chiefCardiacComplaint', 'nyhaClassification', 'killipClassification'].forEach(f => addF(f, FIELD_LABELS[f] || f)); if (pr.admissionDate) text += `Admission Date: ${formatDate(pr.admissionDate)}\n`; }
    else if (sid === 'chestPain') { SECTION_FIELDS.chestPain.forEach(f => addF(f, FIELD_LABELS[f])); }
    else if (sid === 'labs') { ['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'].forEach(f => addF(f, FIELD_LABELS[f])); }
    else if (sid === 'ekg') { sentFs('ekgFindings'); }
    else if (sid === 'echo') { SECTION_FIELDS.echo.forEach(f => addF(f, FIELD_LABELS[f])); }
    else if (sid === 'riskFactors') { addArr('cardiacRiskFactors'); }
    else if (sid === 'medications') { addArr('currentCardiacMedications'); }
    else if (sid === 'cath') { sentFs('cardiacCatheterizationPlanned'); }
    else if (sid === 'valvular') { addArr('valvularAbnormalities'); }
    else if (sid === 'inotropes') { addArr('inotropicSupport'); }
    else if (sid === 'hemodynamics') { const v = getFieldValue(pr, 'hemodynamicParameters', idx); if (hasVal(v) && !isScalar(v)) Object.entries(v).filter(([, vv]) => !isEmptyDeep(vv)).forEach(([k, vv]) => objectCopyLines(humanizeKey(k), vv, 0).forEach(l => { text += `${l}\n`; })); }
    else if (sid === 'anticoagulation') { const v = getFieldValue(pr, 'anticoagulationStatus', idx); if (hasVal(v) && !isScalar(v)) Object.entries(v).filter(([, vv]) => !isEmptyDeep(vv)).forEach(([k, vv]) => objectCopyLines(humanizeKey(k), vv, 0).forEach(l => { text += `${l}\n`; })); }
    else if (sid === 'biomarkerTrend') { safeArr(pr.cardiacBiomarkerTrend).forEach((t, i) => { text += `${i + 1}. ${t}\n`; }); }
    else if (sid === 'additional') { SECTION_FIELDS.additional.forEach(f => addF(f, FIELD_LABELS[f])); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIOLOGY ADMISSION NOTES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiology Admission ${idx + 1}\n`;
      if (r.admissionDate) text += `${formatDate(r.admissionDate)}\n`;
      const addF = (dp, label) => { const v = dp.includes('.') ? getNestedVal(r, dp) : r[dp]; if (hasVal(v)) text += `${label}: ${fmtVal(v)}\n`; };
      const sentFs = (title, fn) => { if (hasVal(r[fn])) { text += `\n${title}\n`; splitBySentence(fmtVal(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } };
      if (hasVal(r.acuteCoronarySyndromeType) || hasVal(r.chiefCardiacComplaint)) { text += '\nADMISSION INFORMATION\n'; ['acuteCoronarySyndromeType', 'chiefCardiacComplaint', 'nyhaClassification', 'killipClassification'].forEach(f => addF(f, FIELD_LABELS[f])); }
      const cp = r.chestPainCharacteristics || {};
      if (hasVal(cp)) { text += '\nCHEST PAIN CHARACTERISTICS\n'; Object.entries(cp).forEach(([k, v]) => { if (hasVal(v)) text += `${FIELD_LABELS[`chestPainCharacteristics.${k}`] || k}: ${fmtVal(v)}\n`; }); }
      const labFs = ['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'].filter(f => hasVal(r[f]));
      if (labFs.length) { text += '\nLABS & VITALS\n'; labFs.forEach(f => addF(f, FIELD_LABELS[f])); }
      sentFs('EKG FINDINGS', 'ekgFindings');
      const echo = r.echocardiogramResults || {};
      if (hasVal(echo)) { text += '\nECHOCARDIOGRAM\n'; Object.entries(echo).forEach(([k, v]) => { if (hasVal(v)) text += `${FIELD_LABELS[`echocardiogramResults.${k}`] || k}: ${fmtVal(v)}\n`; }); }
      const rf = getEffectiveArray(r, 'cardiacRiskFactors', idx); if (rf.length) { text += '\nCARDIAC RISK FACTORS\n'; rf.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      const meds = getEffectiveArray(r, 'currentCardiacMedications', idx); if (meds.length) { text += '\nCURRENT CARDIAC MEDICATIONS\n'; meds.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      sentFs('CARDIAC CATHETERIZATION', 'cardiacCatheterizationPlanned');
      const va = getEffectiveArray(r, 'valvularAbnormalities', idx); if (va.length) { text += '\nVALVULAR ABNORMALITIES\n'; va.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
      const hp = r.hemodynamicParameters; if (hasVal(hp) && !isScalar(hp)) { text += '\nHEMODYNAMIC PARAMETERS\n'; Object.entries(hp).filter(([, vv]) => !isEmptyDeep(vv)).forEach(([k, vv]) => objectCopyLines(humanizeKey(k), vv, 0).forEach(l => { text += `${l}\n`; })); }
      const ino = getEffectiveArray(r, 'inotropicSupport', idx); if (ino.length) { text += '\nINOTROPIC SUPPORT\n'; ino.forEach((it, i) => { text += `${i + 1}. ${fmtVal(it)}\n`; }); }
      const ac = r.anticoagulationStatus; if (hasVal(ac) && !isScalar(ac)) { text += '\nANTICOAGULATION STATUS\n'; Object.entries(ac).filter(([, vv]) => !isEmptyDeep(vv)).forEach(([k, vv]) => objectCopyLines(humanizeKey(k), vv, 0).forEach(l => { text += `${l}\n`; })); }
      const bt = safeArr(r.cardiacBiomarkerTrend); if (bt.length) { text += '\nBIOMARKER TREND\n'; bt.forEach((t, i) => { text += `${i + 1}. ${t}\n`; }); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  /* field-type dispatcher: NUMBER → number input, DATE → date picker, else text */
  const renderTypedField = (record, f, idx, sid) => {
    const label = FIELD_LABELS[f] || f;
    if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, label, idx, sid);
    if (f === 'admissionDate') return renderDateField(record, f, label, idx, sid);
    return renderEditableField(record, f, label, idx, sid);
  };
  const fieldIsVisible = (record, f, idx) => {
    const v = getFieldValue(record, f, idx);
    if (NUMBER_FIELDS.includes(f)) { const num = typeof v === 'number' ? v : (v === '' || v === null || v === undefined ? NaN : parseFloat(v)); return Number.isFinite(num) && num !== 0; }
    return hasVal(v);
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => fieldIsVisible(record, f, idx));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, <>{visibleFields.map(f => <React.Fragment key={f}>{renderTypedField(record, f, idx, sid)}</React.Fragment>)}</>);
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = safeArr(record[fieldName]); if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  /* Inotropic Support — ARRAY (string items editable; object items flattened, recursive leaves editable) */
  const renderInotropicSection = (record, idx) => {
    const items = safeArr(getFieldValue(record, 'inotropicSupport', idx)); if (items.length === 0) return null;
    const title = 'Inotropic Support'; const sid = 'inotropes';
    if (!shouldShowSection(record, title, items.map(it => isScalar(it) ? fmtVal(it) : flattenSearchable(it)), ['inotropicSupport'])) return null;
    const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
    const children = items.map((item, ai) => {
      if (isScalar(item)) {
        const val = localEdits[`inotropicSupport-${idx}-${ai}`] !== undefined ? localEdits[`inotropicSupport-${idx}-${ai}`] : item;
        if (!sa && !phraseMatch(fmtVal(val), searchTerm)) return null;
        return renderEditableArrayItem(record, 'inotropicSupport', idx, sid, item, ai);
      }
      if (!sa && !phraseMatch(flattenSearchable(item), searchTerm)) return null;
      const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return null;
      return (<div key={`io-${ai}`} className="rec-mini-card">{entries.map(([k, v]) => (isScalar(v) ? renderObjectLeaf(record, 'inotropicSupport', [String(ai), k], idx, sid, v) : <div className="nested-mini-card" key={k}>{renderObjectNode(record, 'inotropicSupport', idx, sid, humanizeKey(k), v, [String(ai), k], 1)}</div>))}</div>);
    }).filter(Boolean);
    if (children.length === 0) return null;
    return renderSection(record, idx, sid, title, children);
  };

  /* Biomarker Trend — display-only */
  const renderBiomarkerTrend = (record, idx) => {
    const trend = safeArr(record.cardiacBiomarkerTrend); if (trend.length === 0) return null;
    if (!shouldShowSection(record, 'Biomarker Trend', trend, [])) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText('Biomarker Trend')}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-biomarkerTrend-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'biomarkerTrend')}>{copiedId === `section-biomarkerTrend-${idx}` ? 'Copied' : 'Copy Section'}</button></div></div>{trend.map((t, ti) => (<div key={ti} className="rec-mini-card"><div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(t)}</span></div><button className={`copy-btn${copiedId === `trend-${idx}-${ti}` ? ' copied' : ''}`} onClick={() => copyToClipboard(t, `trend-${idx}-${ti}`)}>{copiedId === `trend-${idx}-${ti}` ? 'Copied' : 'Copy'}</button></div></div>))}</div></div>);
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cardiology-admission-document"><header className="document-header"><h1 className="document-title">Cardiology Admission Notes</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cardiology-admission-document">
      <header className="document-header">
        <h1 className="document-title">Cardiology Admission Notes</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiologyAdmissionNotesPDFTemplate document={pdfData} />} fileName="Cardiology_Admission_Notes.pdf">
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
                {record.admissionDate && <span className="record-date">{highlightText(formatDate(record.admissionDate))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiology Admission ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'admission', 'Admission Information', SECTION_FIELDS.admission)}
            {renderMultiFieldSection(record, idx, 'chestPain', 'Chest Pain Characteristics', SECTION_FIELDS.chestPain)}
            {renderMultiFieldSection(record, idx, 'labs', 'Labs & Vitals', SECTION_FIELDS.labs)}
            {renderSentenceSplitSection(record, idx, 'ekg', 'EKG Findings', 'ekgFindings')}
            {renderMultiFieldSection(record, idx, 'echo', 'Echocardiogram', SECTION_FIELDS.echo)}
            {renderArraySection(record, idx, 'riskFactors', 'Cardiac Risk Factors', 'cardiacRiskFactors')}
            {renderArraySection(record, idx, 'medications', 'Current Cardiac Medications', 'currentCardiacMedications')}
            {renderSentenceSplitSection(record, idx, 'cath', 'Cardiac Catheterization', 'cardiacCatheterizationPlanned')}
            {renderArraySection(record, idx, 'valvular', 'Valvular Abnormalities', 'valvularAbnormalities')}
            {renderObjectSection(record, idx, 'hemodynamics', 'Hemodynamic Parameters', 'hemodynamicParameters')}
            {renderInotropicSection(record, idx)}
            {renderObjectSection(record, idx, 'anticoagulation', 'Anticoagulation Status', 'anticoagulationStatus')}
            {renderBiomarkerTrend(record, idx)}
            {renderMultiFieldSection(record, idx, 'additional', 'Additional Information', SECTION_FIELDS.additional)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiologyAdmissionNotesDocument;
