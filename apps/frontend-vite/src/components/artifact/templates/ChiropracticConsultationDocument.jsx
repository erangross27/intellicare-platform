/**
 * ChiropracticConsultationDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + sentence-split. Collection: chiropractic_consultations
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChiropracticConsultationDocumentPDFTemplate from '../pdf-templates/ChiropracticConsultationDocumentPDFTemplate';
import './ChiropracticConsultationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'chiropractic_consultationPendingEdits';
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
  complaint: ['chiefComplaint'],
  scores: ['painIntensityNRS', 'oswestryDisabilityIndex', 'neckDisabilityIndex'],
  subluxation: ['vertebralSubluxationLevels'],
  spinal: ['spinalRangeOfMotion', 'straightLegRaiseTest', 'kempsTestFindings'],
  neuro: ['dermatomeAssessment', 'deepTendonReflexes', 'myotomeGrading'],
  palpation: ['palpationFindings', 'posturalAnalysis'],
  imaging: ['cobbAngleMeasurement', 'cervicalLordosisDegrees', 'lumbarLordosisDegrees', 'discHeightAssessment'],
  treatment: ['adjustmentTechniqueUsed', 'segmentsAdjusted', 'cavitationAchieved', 'softTissueTherapy'],
  modalities: ['therapeuticModalitiesApplied', 'rehabilitativeExercisesPrescribed'],
  contraindications: ['contraindications'],
  plan: ['treatmentFrequencyRecommendation'],
};
const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint', painIntensityNRS: 'Pain Intensity (NRS)', oswestryDisabilityIndex: 'Oswestry Disability Index', neckDisabilityIndex: 'Neck Disability Index',
  spinalRangeOfMotion: 'Spinal Range of Motion', straightLegRaiseTest: 'Straight Leg Raise Test', kempsTestFindings: "Kemp's Test Findings",
  dermatomeAssessment: 'Dermatome Assessment', deepTendonReflexes: 'Deep Tendon Reflexes', myotomeGrading: 'Myotome Grading',
  palpationFindings: 'Palpation Findings', posturalAnalysis: 'Postural Analysis',
  cobbAngleMeasurement: 'Cobb Angle', cervicalLordosisDegrees: 'Cervical Lordosis', lumbarLordosisDegrees: 'Lumbar Lordosis', discHeightAssessment: 'Disc Height Assessment',
  cavitationAchieved: 'Cavitation Achieved', softTissueTherapy: 'Soft Tissue Therapy',
  treatmentFrequencyRecommendation: 'Treatment Plan',
};
const ARRAY_FIELDS = ['vertebralSubluxationLevels', 'adjustmentTechniqueUsed', 'segmentsAdjusted', 'therapeuticModalitiesApplied', 'rehabilitativeExercisesPrescribed', 'contraindications'];
// All long narrative fields split by sentence THEN by comma (labeled groups get a nested subtitle).
const TEXT_BLOCK_FIELDS = new Set(['chiefComplaint', 'discHeightAssessment', 'softTissueTherapy', 'spinalRangeOfMotion', 'myotomeGrading', 'palpationFindings', 'posturalAnalysis', 'treatmentFrequencyRecommendation', 'straightLegRaiseTest', 'kempsTestFindings', 'dermatomeAssessment', 'deepTendonReflexes']);
const NUMERIC_FIELDS = new Set(['painIntensityNRS', 'oswestryDisabilityIndex', 'neckDisabilityIndex', 'cobbAngleMeasurement', 'cervicalLordosisDegrees', 'lumbarLordosisDegrees']);
const BOOLEAN_FIELDS = new Set(['cavitationAchieved']);
// Imaging-degree measurements use 0 as a "not measured" sentinel; pain/disability indices treat 0 as clinically meaningful.
const HIDE_ZERO_FIELDS = new Set(['cobbAngleMeasurement', 'cervicalLordosisDegrees', 'lumbarLordosisDegrees']);
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (HIDE_ZERO_FIELDS.has(fn) && typeof v === 'number' && v === 0) return false; return true; };
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
// Sentences → groups: a labeled sentence ("Lumbar: Flexion …") is its own group (label + comma rows);
// consecutive unlabeled sentences collect into one group, also comma-split. Items carry (si, ci).
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

const ChiropracticConsultationDocument = ({ document: rawDoc }) => {
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
      if (r?.chiropractic_consultations) return Array.isArray(r.chiropractic_consultations) ? r.chiropractic_consultations : [r.chiropractic_consultations];
      if (r?.chiropractic_consultation) return Array.isArray(r.chiropractic_consultation) ? r.chiropractic_consultation : [r.chiropractic_consultation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chiropractic_consultations) return Array.isArray(dd.chiropractic_consultations) ? dd.chiropractic_consultations : [dd.chiropractic_consultations]; return [dd]; }
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
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid || String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex"; localEdits keys use "field-idx" / "field-idx-ai"
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
  // Committed-only array (pending element edits excluded) for PDF / Copy.
  const getCommittedArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fieldPart, editKey, value, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending
    if (sid !== undefined) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    stageDraft(record, fn, `${fn}-${idx}`, editValue, idx, sid);
  }, [editValue, stageDraft]);

  const handleSaveNumber = useCallback((record, fn, idx, sid) => {
    const num = parseFloat(editValue);
    if (editValue.trim() !== '' && isNaN(num)) { console.warn('[ChiropracticConsultation] Invalid number, not saving:', editValue); return; }
    const valueToSave = editValue.trim() === '' ? '' : num;
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    stageDraft(record, fn, `${fn}-${idx}`, valueToSave, idx, sid);
  }, [editValue, stageDraft]);

  const handleSaveBoolean = useCallback((record, fn, idx, sid) => {
    const valueToSave = editValue === 'Yes';
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    stageDraft(record, fn, `${fn}-${idx}`, valueToSave, idx, sid);
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    // fieldPart encodes the array index as "field.arrayIndex" in the draft store
    stageDraft(record, `${fn}.${arrayIndex}`, `${fn}-${idx}-${arrayIndex}`, editValue, idx, sid);
  }, [editValue, stageDraft]);

  // Save one comma-part of one array item: re-split the item (guarded), splice the edited part,
  // rejoin ', ', save the whole rebuilt item as the array element (so PDF/Copy re-split consistently).
  const saveArrayPart = useCallback((record, fn, idx, sid, ai, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${ai}`;
    const curItem = localEdits[ek] !== undefined ? localEdits[ek] : (Array.isArray(record[fn]) ? record[fn][ai] : '');
    const parts = splitByComma(String(curItem || ''));
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    const rebuilt = parts.map(p => String(p).trim()).filter(Boolean).join(', ');
    stageDraft(record, `${fn}.${ai}`, ek, rebuilt, idx, sid);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${ai}-c${ci}`]: 'edited' }));
  }, [editValue, localEdits, stageDraft]);

  // Save one sentence → splice it back into the full text, then STAGE the whole field as a DRAFT (no DB write).
  // The per-sentence edited/added markers are kept; localStorage keeps it across refresh; Approve commits it.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const originalSentence = sentences[sentenceIdx];
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); }
    else { const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== (originalSentence || '').replace(/[;.]+$/, '').trim(); setEditedFields(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); } else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); } }
    const newValue = reconstructFullText(sentences);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (sid !== undefined) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = newValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this record+section's pending edits. Keys: "field-idx" or "field-idx-arrayIndex".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const segs = k.split('-');
        let field, atIdx;
        // trailing numeric segment = arrayIndex; the one before it = idx
        if (segs.length >= 3 && /^\d+$/.test(segs[segs.length - 1]) && /^\d+$/.test(segs[segs.length - 2])) {
          atIdx = parseInt(segs[segs.length - 2], 10);
          field = segs.slice(0, segs.length - 2).join('-');
        } else if (segs.length >= 2 && /^\d+$/.test(segs[segs.length - 1])) {
          atIdx = parseInt(segs[segs.length - 1], 10);
          field = segs.slice(0, segs.length - 1).join('-');
        } else {
          return false;
        }
        return atIdx === idx && sf.includes(field);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const segs = editKey.split('-');
        const payload = { field: null, value: localEdits[editKey] };
        if (segs.length >= 3 && /^\d+$/.test(segs[segs.length - 1]) && /^\d+$/.test(segs[segs.length - 2])) {
          payload.field = segs.slice(0, segs.length - 2).join('-');
          payload.arrayIndex = parseInt(segs[segs.length - 1], 10);
        } else {
          payload.field = segs.slice(0, segs.length - 1).join('-');
        }
        await sc.put(`/api/edit/chiropractic_consultation/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/chiropractic_consultation/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          const segs = editKey.split('-');
          let fieldPart;
          if (segs.length >= 3 && /^\d+$/.test(segs[segs.length - 1]) && /^\d+$/.test(segs[segs.length - 2])) {
            fieldPart = `${segs.slice(0, segs.length - 2).join('-')}.${segs[segs.length - 1]}`;
          } else {
            fieldPart = segs.slice(0, segs.length - 1).join('-');
          }
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChiropracticConsultation] Approve failed:', err); }
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
      const title = `Chiropractic Consultation ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Chief Complaint', 'Pain Scores', 'Subluxation', 'Spinal Assessment', 'Neurological', 'Palpation', 'Imaging', 'Treatment', 'Modalities', 'Contraindications', 'Treatment Plan'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const isNum = NUMERIC_FIELDS.has(fn); const isBool = BOOLEAN_FIELDS.has(fn);
    if (ie) {
      let editor;
      if (isNum) { const st = parseFloat(stepFor(raw)) || 1; const dec = (String(st).split('.')[1] || '').length; const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); }; editor = (<div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={() => bump(-st)}>−</button><input type="number" step={stepFor(raw)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveNumber(record, fn, idx); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><button type="button" className="num-step" disabled={saving} onClick={() => bump(st)}>+</button></div>); }
      else if (isBool) editor = <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select>;
      else editor = <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />;
      const onSave = isNum ? () => handleSaveNumber(record, fn, idx) : isBool ? () => handleSaveBoolean(record, fn, idx) : () => handleSaveField(record, fn, idx, sid);
      return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">{editor}<div className="edit-actions"><button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save one comma-part of one sentence: splice the edited part back (label preserved for labeled
  // sentences), rejoin ', ', rebuild the full field text. Stage as a DRAFT (no DB write until Approve).
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChiropracticConsultation] Cannot save part — no record ID'); return; }
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
    if (sid !== undefined) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
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

  // Array item → guarded comma split ONLY when it yields >=3 parts (a genuine list like the
  // contraindications findings); below 3, the comma is grammatical dosing ("exercise, twice daily")
  // so keep the item whole (memory 6982205e Rule #73). >=3 parts: each part its own editable row
  // (saveArrayPart splices it back). Whole item edits via handleSaveArrayItem.
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-');
        if (ld === -1) return;
        const fn = key.substring(0, ld);
        const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: merge only NON-pending element edits into the PDF
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { complaint: 'CHIEF COMPLAINT', scores: 'PAIN & DISABILITY SCORES', subluxation: 'VERTEBRAL SUBLUXATION', spinal: 'SPINAL ASSESSMENT', neuro: 'NEUROLOGICAL EXAM', palpation: 'PALPATION & POSTURE', imaging: 'IMAGING MEASUREMENTS', treatment: 'TREATMENT', modalities: 'MODALITIES & EXERCISES', contraindications: 'CONTRAINDICATIONS', plan: 'TREATMENT PLAN' };

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

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (!hasFieldVal(fn, pr[fn])) return; if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(pr[fn])}\n\n`; };
    const addArr = (labelFn, fn) => { const items = getCommittedArray(pr, fn, idx); if (!items.length) return; if (labelFn) text += `${labelFn}\n${COPY_LINE_DASH}\n`; let n = 0; items.forEach(it => { const parts = splitByComma(String(it)); (parts.length >= 3 ? parts : [String(it)]).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) text += `${++n}. ${t}\n`; }); }); text += '\n'; };
    if (sid === 'subluxation') { addArr(null, 'vertebralSubluxationLevels'); }
    else if (sid === 'contraindications') { addArr(null, 'contraindications'); }
    else if (sid === 'modalities') { addArr('Therapeutic Modalities', 'therapeuticModalitiesApplied'); addArr('Rehabilitative Exercises', 'rehabilitativeExercisesPrescribed'); }
    else if (sid === 'treatment') { addArr('Adjustment Techniques', 'adjustmentTechniqueUsed'); addArr('Segments Adjusted', 'segmentsAdjusted'); if (hasVal(pr.cavitationAchieved)) addF('cavitationAchieved'); if (hasVal(pr.softTissueTherapy)) text += emitBlock('softTissueTherapy', pr.softTissueTherapy, title); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) { if (hasVal(pr[fn])) text += emitBlock(fn, pr[fn], title); } else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CHIROPRACTIC CONSULTATION\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Chiropractic Consultation ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const addArr = (title, fn) => { const items = getCommittedArray(r, fn, idx); if (!items.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; let n = 0; items.forEach(it => { const parts = splitByComma(String(it)); (parts.length >= 3 ? parts : [String(it)]).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) text += `${++n}. ${t}\n`; }); }); };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasFieldVal(f, r[f])); if (!vis.length) return; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(fn => { if (TEXT_BLOCK_FIELDS.has(fn)) text += emitBlock(fn, r[fn], title); else { const showLbl = (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase(); if (showLbl) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } }); };
      simpleFs('CHIEF COMPLAINT', ['chiefComplaint']);
      simpleFs('PAIN & DISABILITY SCORES', SECTION_FIELDS.scores);
      addArr('VERTEBRAL SUBLUXATION', 'vertebralSubluxationLevels');
      simpleFs('SPINAL ASSESSMENT', SECTION_FIELDS.spinal);
      simpleFs('NEUROLOGICAL EXAM', SECTION_FIELDS.neuro);
      simpleFs('PALPATION & POSTURE', SECTION_FIELDS.palpation);
      simpleFs('IMAGING MEASUREMENTS', SECTION_FIELDS.imaging);
      addArr('ADJUSTMENT TECHNIQUES', 'adjustmentTechniqueUsed');
      addArr('SEGMENTS ADJUSTED', 'segmentsAdjusted');
      if (hasVal(r.cavitationAchieved)) { text += `\nCavitation Achieved\n${COPY_LINE_DASH}\n1. ${fmtVal(r.cavitationAchieved)}\n\n`; }
      if (hasVal(r.softTissueTherapy)) { text += `\nSOFT TISSUE THERAPY\n${COPY_LINE_EQ}\n`; text += emitBlock('softTissueTherapy', r.softTissueTherapy, 'SOFT TISSUE THERAPY'); }
      addArr('THERAPEUTIC MODALITIES', 'therapeuticModalitiesApplied');
      addArr('REHABILITATIVE EXERCISES', 'rehabilitativeExercisesPrescribed');
      addArr('CONTRAINDICATIONS', 'contraindications');
      simpleFs('TREATMENT PLAN', ['treatmentFrequencyRecommendation']);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasFieldVal(f, getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (TEXT_BLOCK_FIELDS.has(f)) return <React.Fragment key={f}>{renderSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  const renderTreatmentSection = (record, idx) => {
    const hasTech = Array.isArray(record.adjustmentTechniqueUsed) && record.adjustmentTechniqueUsed.filter(Boolean).length > 0;
    const hasSeg = Array.isArray(record.segmentsAdjusted) && record.segmentsAdjusted.filter(Boolean).length > 0;
    const hasCav = hasVal(getFieldValue(record, 'cavitationAchieved', idx));
    const hasSoft = hasVal(getFieldValue(record, 'softTissueTherapy', idx));
    if (!hasTech && !hasSeg && !hasCav && !hasSoft) return null;
    const stm = sectionTitleMatches('Treatment'); const sa = !searchTerm.trim() || record._showAllSections || stm;
    return renderSection(record, idx, 'treatment', 'Treatment', (<>
      {hasTech && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Adjustment Techniques')}</div>{record.adjustmentTechniqueUsed.filter(Boolean).map((item, ai) => { const val = localEdits[`adjustmentTechniqueUsed-${idx}-${ai}`] !== undefined ? localEdits[`adjustmentTechniqueUsed-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'adjustmentTechniqueUsed', idx, 'treatment', item, ai); }).filter(Boolean)}</div>}
      {hasSeg && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Segments Adjusted')}</div>{record.segmentsAdjusted.filter(Boolean).map((item, ai) => { const val = localEdits[`segmentsAdjusted-${idx}-${ai}`] !== undefined ? localEdits[`segmentsAdjusted-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'segmentsAdjusted', idx, 'treatment', item, ai); }).filter(Boolean)}</div>}
      {hasCav && renderEditableField(record, 'cavitationAchieved', idx, 'treatment')}
      {hasSoft && renderSplitField(record, 'softTissueTherapy', idx, 'treatment')}
    </>));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="chiropractic-consultation-document"><header className="document-header"><h1 className="document-title">Chiropractic Consultation</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="chiropractic-consultation-document">
      <header className="document-header">
        <h1 className="document-title">Chiropractic Consultation</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChiropracticConsultationDocumentPDFTemplate document={pdfData} />} fileName="Chiropractic_Consultation.pdf">
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
                {(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Chiropractic Consultation ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'complaint', 'Chief Complaint', ['chiefComplaint'])}
            {renderMultiFieldSection(record, idx, 'scores', 'Pain & Disability Scores', SECTION_FIELDS.scores)}
            {renderArraySection(record, idx, 'subluxation', 'Vertebral Subluxation', 'vertebralSubluxationLevels')}
            {renderMultiFieldSection(record, idx, 'spinal', 'Spinal Assessment', SECTION_FIELDS.spinal)}
            {renderMultiFieldSection(record, idx, 'neuro', 'Neurological Exam', SECTION_FIELDS.neuro)}
            {renderMultiFieldSection(record, idx, 'palpation', 'Palpation & Posture', SECTION_FIELDS.palpation)}
            {renderMultiFieldSection(record, idx, 'imaging', 'Imaging Measurements', SECTION_FIELDS.imaging)}
            {renderTreatmentSection(record, idx)}
            {(() => {
              const hasMod = Array.isArray(record.therapeuticModalitiesApplied) && record.therapeuticModalitiesApplied.filter(Boolean).length > 0;
              const hasEx = Array.isArray(record.rehabilitativeExercisesPrescribed) && record.rehabilitativeExercisesPrescribed.filter(Boolean).length > 0;
              if (!hasMod && !hasEx) return null;
              const stm = sectionTitleMatches('Modalities & Exercises'); const sa = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'modalities', 'Modalities & Exercises', (<>
                {hasMod && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Therapeutic Modalities')}</div>{record.therapeuticModalitiesApplied.filter(Boolean).map((item, ai) => { const val = localEdits[`therapeuticModalitiesApplied-${idx}-${ai}`] !== undefined ? localEdits[`therapeuticModalitiesApplied-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'therapeuticModalitiesApplied', idx, 'modalities', item, ai); }).filter(Boolean)}</div>}
                {hasEx && <div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Rehabilitative Exercises')}</div>{record.rehabilitativeExercisesPrescribed.filter(Boolean).map((item, ai) => { const val = localEdits[`rehabilitativeExercisesPrescribed-${idx}-${ai}`] !== undefined ? localEdits[`rehabilitativeExercisesPrescribed-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'rehabilitativeExercisesPrescribed', idx, 'modalities', item, ai); }).filter(Boolean)}</div>}
              </>));
            })()}
            {renderArraySection(record, idx, 'contraindications', 'Contraindications', 'contraindications')}
            {renderMultiFieldSection(record, idx, 'plan', 'Treatment Plan', ['treatmentFrequencyRecommendation'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChiropracticConsultationDocument;
