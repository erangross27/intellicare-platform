/**
 * ChiropracticXRayReviewDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + label-sentence. Collection: chiropractic_x_ray_review
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChiropracticXRayReviewDocumentPDFTemplate from '../pdf-templates/ChiropracticXRayReviewDocumentPDFTemplate';
import './ChiropracticXRayReviewDocument.css';

const SECTION_FIELDS = {
  complaint: ['patientChiefComplaint'],
  imaging: ['spinalRegionImaged', 'viewsObtained'],
  curvature: ['cervicalLordosisAngle', 'lumbarLordosisAngle', 'thoracicKyphosisAngle', 'cobbAngleScoliosis', 'scoliosisCurvePattern', 'sacralBaseAngle', 'legLengthDiscrepancy'],
  subluxation: ['vertebralSubluxationListings'],
  upperCervical: ['atlasLateralityMeasurement', 'adiFinding'],
  disc: ['discSpaceNarrowingLevels', 'osteophyteFormationLocations', 'facetArthrosis'],
  ddd: ['degenerativeDiscDiseaseGrade'],
  spondy: ['spondylolisthesisGrade', 'spondylolisthesisLevel', 'parsDefectPresent'],
  stability: ['georgesLineIntegrity', 'spinalCanalDiameter'],
  fractures: ['vertebralBodyCompressionFractures'],
  stenosis: ['intervertebralForaminaStenosis'],
  contra: ['contraIndicationsForManipulation'],
};
const FIELD_LABELS = {
  patientChiefComplaint: 'Chief Complaint',
  cervicalLordosisAngle: 'Cervical Lordosis (°)', lumbarLordosisAngle: 'Lumbar Lordosis (°)', thoracicKyphosisAngle: 'Thoracic Kyphosis (°)', cobbAngleScoliosis: 'Cobb Angle (°)', scoliosisCurvePattern: 'Scoliosis Pattern', sacralBaseAngle: 'Sacral Base Angle (°)', legLengthDiscrepancy: 'Leg Length Discrepancy (mm)',
  atlasLateralityMeasurement: 'Atlas Laterality (mm)', adiFinding: 'ADI Finding (mm)',
  degenerativeDiscDiseaseGrade: 'DDD Grade',
  spondylolisthesisGrade: 'Spondylolisthesis Grade', spondylolisthesisLevel: 'Spondylolisthesis Level', parsDefectPresent: 'Pars Defect',
  georgesLineIntegrity: "George's Line Integrity", spinalCanalDiameter: 'Spinal Canal Diameter (mm)',
};
const ARRAY_FIELDS = ['spinalRegionImaged', 'viewsObtained', 'vertebralSubluxationListings', 'discSpaceNarrowingLevels', 'osteophyteFormationLocations', 'facetArthrosis', 'vertebralBodyCompressionFractures', 'intervertebralForaminaStenosis', 'contraIndicationsForManipulation'];
// Long narrative fields split by sentence THEN by comma (labeled groups get a nested subtitle).
const TEXT_BLOCK_FIELDS = new Set(['patientChiefComplaint', 'degenerativeDiscDiseaseGrade']);
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Numeric angle/measurement fields: 0 is an "unmeasured" sentinel, not a meaningful finding -> hide when 0.
const NUMBER_FIELDS = new Set(['cervicalLordosisAngle', 'lumbarLordosisAngle', 'thoracicKyphosisAngle', 'cobbAngleScoliosis', 'sacralBaseAngle', 'legLengthDiscrepancy', 'atlasLateralityMeasurement', 'adiFinding', 'spinalCanalDiameter']);
const BOOLEAN_FIELDS = new Set(['parsDefectPresent', 'georgesLineIntegrity']);

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
// Field-aware presence: numeric sentinel 0 (unmeasured) is treated as absent for number fields.
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.has(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };
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
const DRAFT_KEY = 'chiropractic_x_ray_reviewPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ChiropracticXRayReviewDocument = ({ document: rawDoc }) => {
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
      if (r?.chiropractic_x_ray_review) return Array.isArray(r.chiropractic_x_ray_review) ? r.chiropractic_x_ray_review : [r.chiropractic_x_ray_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chiropractic_x_ray_review) return Array.isArray(dd.chiropractic_x_ray_review) ? dd.chiropractic_x_ray_review : [dd.chiropractic_x_ray_review]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft fieldPart: "field" (plain/sentence field, editKey `${field}-${idx}`) or
  // "field.arrayIndex" (array item, editKey `${field}-${idx}-${arrayIndex}`).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
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
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  // Output helper (Copy Section / Copy All): apply COMMITTED element edits only; pending drafts stay out.
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const stageDraft = useCallback((rid, fieldPart, value) => {
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
  }, []);
  // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending Approve.
  const clearApprovedSection = useCallback((sid, idx) => {
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;
    if (NUMBER_FIELDS.has(fn)) { const num = parseFloat(saveVal); if (isNaN(num)) { setSaveError('Please enter a valid number'); return; } saveVal = num; }
    else if (BOOLEAN_FIELDS.has(fn)) { saveVal = (saveVal === 'yes' || saveVal === true); }
    setSaveError(null);
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticXRayReview] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApprovedSection(sid, idx);
    stageDraft(rid, fn, saveVal);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApprovedSection]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticXRayReview] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApprovedSection(sid, idx);
    stageDraft(rid, `${fn}.${arrayIndex}`, editValue);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApprovedSection]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticXRayReview] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx); const sentences = splitBySentence(String(raw || '')); const originalSentence = sentences[sentenceIdx]; const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); }
    else { const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== (originalSentence || '').replace(/[;.]+$/, '').trim(); setEditedFields(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); } else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); } }
    const newValue = reconstructFullText(sentences);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    clearApprovedSection(sid, idx);
    stageDraft(rid, fn, newValue);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue, stageDraft, clearApprovedSection]);

  // Approve = COMMIT all staged drafts for this section/record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setApproving(true);
    const sf = SECTION_FIELDS[sid] || [];
    // Collect this section's pending edits: plain-field editKey `${fn}-${idx}`, array editKey `${fn}-${idx}-${ai}`.
    const suffixField = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      // Parse editKey -> base field name (strip "-idx" and any trailing "-arrayIndex").
      let base = k, arrSeg = null;
      const lastDash = k.lastIndexOf('-');
      const lastSeg = k.slice(lastDash + 1);
      if (/^\d+$/.test(lastSeg)) {
        const head = k.slice(0, lastDash); // `${fn}-${idx}`
        if (!head.endsWith(suffixField)) return false;
        base = head.slice(0, -suffixField.length); arrSeg = lastSeg;
      } else {
        if (!k.endsWith(suffixField)) return false;
        base = k.slice(0, -suffixField.length);
      }
      return sf.includes(base);
    });
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const ek of toCommit) {
        const lastDash = ek.lastIndexOf('-');
        const lastSeg = ek.slice(lastDash + 1);
        let payload;
        if (/^\d+$/.test(lastSeg)) {
          const head = ek.slice(0, lastDash); // `${fn}-${idx}`
          const fn = head.slice(0, -suffixField.length);
          payload = { field: fn, value: localEdits[ek], arrayIndex: parseInt(lastSeg, 10) };
        } else {
          const fn = ek.slice(0, -suffixField.length);
          payload = { field: fn, value: localEdits[ek] };
        }
        await sc.put(`/api/edit/chiropractic_x_ray_review/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/chiropractic_x_ray_review/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => {
          delete store[rid][f];
          Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; });
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ChiropracticXRayReview] Approve failed:', err); }
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
      const title = `X-Ray Review ${idx + 1}`;
      const allText = [title, formatDate(record.createdAt), ...Object.keys(FIELD_LABELS).map(f => hasFieldVal(f, record[f]) ? fmtVal(record[f]) : ''), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), record.degenerativeDiscDiseaseGrade, ...Object.values(FIELD_LABELS), 'Imaging', 'Curvature', 'Subluxation', 'Disc', 'Degeneration', 'Spondylolisthesis', 'Stability', 'Fractures', 'Stenosis', 'Contraindications'].filter(Boolean).join(' ');
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
    const raw = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) { const st = parseFloat(stepFor(raw)) || 1; const dec = (String(st).split('.')[1] || '').length; const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); }; return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={() => bump(-st)}>−</button><input type="number" step={stepFor(raw)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus disabled={saving} /><button type="button" className="num-step" disabled={saving} onClick={() => bump(st)}>+</button></div>{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>); }
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(raw)); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderBooleanField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : String(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus disabled={saving}><option value="yes">Yes</option><option value="no">No</option></select>{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(typeof raw === 'boolean' ? (raw ? 'yes' : 'no') : String(raw).toLowerCase()); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save one comma-part of one sentence: splice the edited part back (label preserved for labeled
  // sentences), rejoin ', ', rebuild the field. Stage as a DRAFT (no DB write until Approve).
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticXRayReview] Cannot save part — no record ID'); return; }
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
    clearApprovedSection(sid, idx);
    stageDraft(rid, fn, newValue);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue, stageDraft, clearApprovedSection]);

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
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticXRayReview] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${ai}`;
    const curItem = localEdits[ek] !== undefined ? localEdits[ek] : (Array.isArray(record[fn]) ? record[fn][ai] : '');
    const parts = splitByComma(String(curItem || ''));
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    const rebuilt = parts.map(p => String(p).trim()).filter(Boolean).join(', ');
    setLocalEdits(prev => ({ ...prev, [ek]: rebuilt }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${ai}-c${ci}`]: 'edited' }));
    clearApprovedSection(sid, idx);
    stageDraft(rid, `${fn}.${ai}`, rebuilt);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, stageDraft, clearApprovedSection]);

  // Array item → guarded comma split ONLY when it yields >=3 parts (a genuine list); below 3 the comma
  // is grammatical so keep the item whole (Rule #73). >=3: each part its own editable row.
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
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: apply committed element edits only; skip pending array drafts.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { complaint: 'CHIEF COMPLAINT', imaging: 'IMAGING', curvature: 'CURVATURE & ALIGNMENT', subluxation: 'SUBLUXATION LISTINGS', upperCervical: 'UPPER CERVICAL', disc: 'DISC & JOINT FINDINGS', ddd: 'DEGENERATIVE DISC DISEASE', spondy: 'SPONDYLOLISTHESIS', stability: 'SPINAL STABILITY', fractures: 'COMPRESSION FRACTURES', stenosis: 'FORAMINAL STENOSIS', contra: 'CONTRAINDICATIONS' };

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
  // Sub-labeled array (Imaging / Disc composites): sub-label + DASH, numbering restarts per sub-label.
  const emitArrLabeled = (subLabel, items) => items.length ? `${subLabel}\n${COPY_LINE_DASH}\n${emitArr(items)}\n` : '';

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (!hasFieldVal(fn, pr[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(pr[fn])}\n\n`; };
    const arrSids = { subluxation: 'vertebralSubluxationListings', fractures: 'vertebralBodyCompressionFractures', stenosis: 'intervertebralForaminaStenosis', contra: 'contraIndicationsForManipulation' };
    if (arrSids[sid]) { text += emitArr(getEffectiveArray(pr, arrSids[sid], idx)); }
    else if (sid === 'imaging') { text += emitArrLabeled('Spinal Regions Imaged', getEffectiveArray(pr, 'spinalRegionImaged', idx)); text += emitArrLabeled('Views Obtained', getEffectiveArray(pr, 'viewsObtained', idx)); }
    else if (sid === 'disc') { text += emitArrLabeled('Disc Space Narrowing', getEffectiveArray(pr, 'discSpaceNarrowingLevels', idx)); text += emitArrLabeled('Osteophyte Formation', getEffectiveArray(pr, 'osteophyteFormationLocations', idx)); text += emitArrLabeled('Facet Arthrosis', getEffectiveArray(pr, 'facetArthrosis', idx)); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) { if (hasVal(pr[fn])) text += emitBlock(fn, pr[fn], title); } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `X-RAY REVIEW\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `X-Ray Review ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.createdAt) text += `${formatDate(r.createdAt)}\n`;
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; text += emitArr(items); } };
      const addArrGroup = (title, groups) => { const present = groups.filter(g => getEffectiveArray(r, g.fn, idx).length); if (!present.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; present.forEach(g => { text += emitArrLabeled(g.label, getEffectiveArray(r, g.fn, idx)); }); };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasFieldVal(f, r[f])); if (!vis.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) text += emitBlock(fn, r[fn], title); else { const showLbl = (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase(); if (showLbl) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } }); };
      simpleFs('CHIEF COMPLAINT', ['patientChiefComplaint']);
      addArrGroup('IMAGING', [{ label: 'Spinal Regions Imaged', fn: 'spinalRegionImaged' }, { label: 'Views Obtained', fn: 'viewsObtained' }]);
      simpleFs('CURVATURE & ALIGNMENT', SECTION_FIELDS.curvature);
      addArr('SUBLUXATION LISTINGS', 'vertebralSubluxationListings');
      simpleFs('UPPER CERVICAL', SECTION_FIELDS.upperCervical);
      addArrGroup('DISC & JOINT FINDINGS', [{ label: 'Disc Space Narrowing', fn: 'discSpaceNarrowingLevels' }, { label: 'Osteophyte Formation', fn: 'osteophyteFormationLocations' }, { label: 'Facet Arthrosis', fn: 'facetArthrosis' }]);
      simpleFs('DEGENERATIVE DISC DISEASE', ['degenerativeDiscDiseaseGrade']);
      simpleFs('SPONDYLOLISTHESIS', SECTION_FIELDS.spondy);
      simpleFs('SPINAL STABILITY', SECTION_FIELDS.stability);
      addArr('COMPRESSION FRACTURES', 'vertebralBodyCompressionFractures');
      addArr('FORAMINAL STENOSIS', 'intervertebralForaminaStenosis');
      addArr('CONTRAINDICATIONS', 'contraIndicationsForManipulation');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasFieldVal(f, getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (TEXT_BLOCK_FIELDS.has(f)) return <React.Fragment key={f}>{renderSplitField(record, f, idx, sid, sl)}</React.Fragment>; if (NUMBER_FIELDS.has(f)) return <React.Fragment key={f}>{renderNumberField(record, f, idx, sid, sl)}</React.Fragment>; if (BOOLEAN_FIELDS.has(f)) return <React.Fragment key={f}>{renderBooleanField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  const renderDiscSection = (record, idx) => {
    const hasDisc = Array.isArray(record.discSpaceNarrowingLevels) && record.discSpaceNarrowingLevels.filter(Boolean).length > 0;
    const hasOsteo = Array.isArray(record.osteophyteFormationLocations) && record.osteophyteFormationLocations.filter(Boolean).length > 0;
    const hasFacet = Array.isArray(record.facetArthrosis) && record.facetArthrosis.filter(Boolean).length > 0;
    if (!hasDisc && !hasOsteo && !hasFacet) return null;
    const stm = sectionTitleMatches('Disc & Joint Findings'); const sa = !searchTerm.trim() || record._showAllSections || stm;
    return renderSection(record, idx, 'disc', 'Disc & Joint Findings', (<>
      {hasDisc && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Disc Space Narrowing')}</div>{record.discSpaceNarrowingLevels.filter(Boolean).map((item, ai) => { const val = localEdits[`discSpaceNarrowingLevels-${idx}-${ai}`] !== undefined ? localEdits[`discSpaceNarrowingLevels-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'discSpaceNarrowingLevels', idx, 'disc', item, ai); }).filter(Boolean)}</div>}
      {hasOsteo && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Osteophyte Formation')}</div>{record.osteophyteFormationLocations.filter(Boolean).map((item, ai) => { const val = localEdits[`osteophyteFormationLocations-${idx}-${ai}`] !== undefined ? localEdits[`osteophyteFormationLocations-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'osteophyteFormationLocations', idx, 'disc', item, ai); }).filter(Boolean)}</div>}
      {hasFacet && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Facet Arthrosis')}</div>{record.facetArthrosis.filter(Boolean).map((item, ai) => { const val = localEdits[`facetArthrosis-${idx}-${ai}`] !== undefined ? localEdits[`facetArthrosis-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'facetArthrosis', idx, 'disc', item, ai); }).filter(Boolean)}</div>}
    </>));
  };

  const renderImagingSection = (record, idx) => {
    const hasRegions = Array.isArray(record.spinalRegionImaged) && record.spinalRegionImaged.filter(Boolean).length > 0;
    const hasViews = Array.isArray(record.viewsObtained) && record.viewsObtained.filter(Boolean).length > 0;
    if (!hasRegions && !hasViews) return null;
    const stm = sectionTitleMatches('Imaging'); const sa = !searchTerm.trim() || record._showAllSections || stm;
    return renderSection(record, idx, 'imaging', 'Imaging', (<>
      {hasRegions && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Spinal Regions Imaged')}</div>{record.spinalRegionImaged.filter(Boolean).map((item, ai) => { const val = localEdits[`spinalRegionImaged-${idx}-${ai}`] !== undefined ? localEdits[`spinalRegionImaged-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'spinalRegionImaged', idx, 'imaging', item, ai); }).filter(Boolean)}</div>}
      {hasViews && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Views Obtained')}</div>{record.viewsObtained.filter(Boolean).map((item, ai) => { const val = localEdits[`viewsObtained-${idx}-${ai}`] !== undefined ? localEdits[`viewsObtained-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'viewsObtained', idx, 'imaging', item, ai); }).filter(Boolean)}</div>}
    </>));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="chiropractic-x-ray-review-document"><header className="document-header"><h1 className="document-title">Chiropractic X-Ray Review</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="chiropractic-x-ray-review-document">
      <header className="document-header">
        <h1 className="document-title">Chiropractic X-Ray Review</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChiropracticXRayReviewDocumentPDFTemplate document={pdfData} />} fileName="Chiropractic_XRay_Review.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`X-Ray Review ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'complaint', 'Chief Complaint', ['patientChiefComplaint'])}
            {renderImagingSection(record, idx)}
            {renderMultiFieldSection(record, idx, 'curvature', 'Curvature & Alignment', SECTION_FIELDS.curvature)}
            {renderArraySection(record, idx, 'subluxation', 'Subluxation Listings', 'vertebralSubluxationListings')}
            {renderMultiFieldSection(record, idx, 'upperCervical', 'Upper Cervical', SECTION_FIELDS.upperCervical)}
            {renderDiscSection(record, idx)}
            {renderMultiFieldSection(record, idx, 'ddd', 'Degenerative Disc Disease', ['degenerativeDiscDiseaseGrade'])}
            {renderMultiFieldSection(record, idx, 'spondy', 'Spondylolisthesis', SECTION_FIELDS.spondy)}
            {renderMultiFieldSection(record, idx, 'stability', 'Spinal Stability', SECTION_FIELDS.stability)}
            {renderArraySection(record, idx, 'fractures', 'Compression Fractures', 'vertebralBodyCompressionFractures')}
            {renderArraySection(record, idx, 'stenosis', 'Foraminal Stenosis', 'intervertebralForaminaStenosis')}
            {renderArraySection(record, idx, 'contra', 'Contraindications', 'contraIndicationsForManipulation')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChiropracticXRayReviewDocument;
