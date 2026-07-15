/**
 * SpinalManipulationRecordDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: spinal_manipulation_record
 *
 * 13 Sections:
 *   1. segments-treated: spinalSegmentsTreated
 *   2. manipulation-technique: manipulationTechnique
 *   3. thrust-direction: thrustDirection
 *   4. patient-positioning: patientPositioning
 *   5. force-amplitude: forceAmplitude
 *   6. subluxation-complex: vertebralSubluxationComplex
 *   7. range-of-motion: preManipulationRomCervical, postManipulationRomCervical, preManipulationRomLumbar, postManipulationRomLumbar
 *   8. pain-scores: painVasPreTreatment, painVasPostTreatment, oswestryDisabilityIndex, neckDisabilityIndex
 *   9. palpation: palpationFindings
 *   10. si-dysfunction: sacroiliacJointDysfunction
 *   11. ortho-neuro-tests: straightLegRaiseTest, neurologicalClearance, dermatomeInvolvement, vertebrobasilarScreening
 *   12. contraindications: contraindicationsScreened
 *   13. treatment-outcome: cavitationAchieved, muscleEnergyTechniqueApplied, adverseReactionDocumented, informedConsentObtained
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import BlueSelect from '../components/BlueSelect';
import SpinalManipulationRecordDocumentPDFTemplate from '../pdf-templates/SpinalManipulationRecordDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './SpinalManipulationRecordDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value is the FULL field value; arrays stored whole) */
const DRAFT_KEY = 'spinal_manipulation_recordPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'segments-treated': 'Spinal Segments Treated',
  'manipulation-technique': 'Manipulation Technique',
  'thrust-direction': 'Thrust Direction',
  'patient-positioning': 'Patient Positioning',
  'force-amplitude': 'Force and Amplitude',
  'subluxation-complex': 'Vertebral Subluxation Complex',
  'range-of-motion': 'Range of Motion',
  'pain-scores': 'Pain & Disability Scores',
  'palpation': 'Palpation Findings',
  'si-dysfunction': 'Sacroiliac Joint Dysfunction',
  'ortho-neuro-tests': 'Orthopedic & Neurological Tests',
  'contraindications': 'Contraindications Screened',
  'treatment-outcome': 'Treatment Outcome',
};

const FIELD_LABELS = {
  spinalSegmentsTreated: 'Spinal Segments Treated',
  manipulationTechnique: 'Manipulation Technique',
  thrustDirection: 'Thrust Direction',
  patientPositioning: 'Patient Positioning',
  forceAmplitude: 'Force and Amplitude',
  vertebralSubluxationComplex: 'Vertebral Subluxation Complex',
  preManipulationRomCervical: 'Pre-Manipulation ROM (Cervical)',
  postManipulationRomCervical: 'Post-Manipulation ROM (Cervical)',
  preManipulationRomLumbar: 'Pre-Manipulation ROM (Lumbar)',
  postManipulationRomLumbar: 'Post-Manipulation ROM (Lumbar)',
  painVasPreTreatment: 'Pain VAS Pre-Treatment',
  painVasPostTreatment: 'Pain VAS Post-Treatment',
  oswestryDisabilityIndex: 'Oswestry Disability Index',
  neckDisabilityIndex: 'Neck Disability Index',
  palpationFindings: 'Palpation Findings',
  sacroiliacJointDysfunction: 'Sacroiliac Joint Dysfunction',
  straightLegRaiseTest: 'Straight Leg Raise Test',
  neurologicalClearance: 'Neurological Clearance',
  dermatomeInvolvement: 'Dermatome Involvement',
  vertebrobasilarScreening: 'Vertebrobasilar Screening',
  contraindicationsScreened: 'Contraindications Screened',
  cavitationAchieved: 'Cavitation Achieved',
  muscleEnergyTechniqueApplied: 'Muscle Energy Technique Applied',
  adverseReactionDocumented: 'Adverse Reaction',
  informedConsentObtained: 'Informed Consent Obtained',
};

const SECTION_FIELDS = {
  'segments-treated': ['spinalSegmentsTreated'],
  'manipulation-technique': ['manipulationTechnique'],
  'thrust-direction': ['thrustDirection'],
  'patient-positioning': ['patientPositioning'],
  'force-amplitude': ['forceAmplitude'],
  'subluxation-complex': ['vertebralSubluxationComplex'],
  'range-of-motion': ['preManipulationRomCervical', 'postManipulationRomCervical', 'preManipulationRomLumbar', 'postManipulationRomLumbar'],
  'pain-scores': ['painVasPreTreatment', 'painVasPostTreatment', 'oswestryDisabilityIndex', 'neckDisabilityIndex'],
  'palpation': ['palpationFindings'],
  'si-dysfunction': ['sacroiliacJointDysfunction'],
  'ortho-neuro-tests': ['straightLegRaiseTest', 'neurologicalClearance', 'dermatomeInvolvement', 'vertebrobasilarScreening'],
  'contraindications': ['contraindicationsScreened'],
  'treatment-outcome': ['cavitationAchieved', 'muscleEnergyTechniqueApplied', 'adverseReactionDocumented', 'informedConsentObtained'],
};

const BOOLEAN_FIELDS = ['cavitationAchieved', 'muscleEnergyTechniqueApplied', 'informedConsentObtained', 'neurologicalClearance'];
const NUMBER_FIELDS = ['painVasPreTreatment', 'painVasPostTreatment', 'oswestryDisabilityIndex', 'neckDisabilityIndex'];
const ARRAY_FIELDS = ['spinalSegmentsTreated', 'contraindicationsScreened'];
const STRING_FIELDS = ['manipulationTechnique', 'thrustDirection', 'patientPositioning', 'forceAmplitude', 'vertebralSubluxationComplex', 'preManipulationRomCervical', 'postManipulationRomCervical', 'preManipulationRomLumbar', 'postManipulationRomLumbar', 'palpationFindings', 'sacroiliacJointDysfunction', 'straightLegRaiseTest', 'dermatomeInvolvement', 'vertebrobasilarScreening', 'adverseReactionDocumented'];
const COMMA_FIELDS = ['manipulationTechnique', 'thrustDirection', 'patientPositioning', 'preManipulationRomCervical', 'postManipulationRomCervical', 'preManipulationRomLumbar', 'postManipulationRomLumbar', 'straightLegRaiseTest'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware and protective of conjunctions/numeric thousands */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const before = current.trim();
      const after = text.slice(i + 1);
      const trimmed = after.trimStart();
      const next = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
      const previous = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
        || after.length === trimmed.length
        || ['and', 'or', 'then'].includes(next)
        || ['and', 'or'].includes(previous);
      if (protectedComma) current += ch;
      else { if (before) result.push(before); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const SpinalManipulationRecordDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.spinal_manipulation_record) return Array.isArray(r.spinal_manipulation_record) ? r.spinal_manipulation_record : [r.spinal_manipulation_record];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.spinal_manipulation_record) return Array.isArray(dd.spinal_manipulation_record) ? dd.spinal_manipulation_record : [dd.spinal_manipulation_record]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* recordId helper used by drafts (string | _id.$oid | stringified) */
  const draftRecordId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = draftRecordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records, draftRecordId]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(s => s.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences, originalText = '') {
    if (!sentences || sentences.length === 0) return '';
    const separators = [...String(originalText).matchAll(/;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+/g)].map(match => match[0].trim());
    const trailing = (String(originalText).trim().match(/[.;]$/) || [])[0] || '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += separators[i] || '.';
      else if (trailing) c += trailing;
      return c;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH -- 4-LEVEL ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Spinal Manipulation Record ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  // `fullFieldValue` is the COMPLETE new value for field `fn` (arrays stored whole) — keyed in localEdits by
  // `${fn}-${idx}` exactly as the DB path used to set it. `markers` carries the same edited/sentence markers
  // the old success-gated block set (e.g. { fields: { key: 'edited' }, sentences: { key: 'edited' } }).
  const stageDraft = useCallback((record, fn, idx, fullFieldValue, markers = {}) => {
    const id = draftRecordId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullFieldValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (markers.fields) setEditedFields(prev => ({ ...prev, ...markers.fields }));
    if (markers.sentences) setEditedSentences(prev => ({ ...prev, ...markers.sentences }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    if (markers.approvedKey) setApprovedSections(prev => {
      if (!prev[markers.approvedKey]) return prev;
      const n = { ...prev }; delete n[markers.approvedKey]; return n;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullFieldValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [draftRecordId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = draftRecordId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    stageDraft(record, fn, idx, saveVal, { fields: { [trackKey]: 'edited' }, approvedKey: `${sid}-${idx}` });
  }, [editValue, draftRecordId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = draftRecordId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated, currentVal);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      stageDraft(record, fn, idx, fullText, { sentences: { [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }, approvedKey: `${sid}-${idx}` });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated, currentVal);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    const sentenceMarks = {};
    if (changed) sentenceMarks[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
    const extra = newSentences.length - 1;
    for (let ei = 0; ei < extra; ei++) sentenceMarks[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    stageDraft(record, fn, idx, fullText, { sentences: sentenceMarks, approvedKey: `${sid}-${idx}` });
  }

  function saveStructuredItem(record, fn, idx, sid, sentenceIndex, itemIndex) {
    if (!draftRecordId(record)) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const sourceSentence = sentences[sentenceIndex] || '';
    const parsed = parseLabel(sourceSentence);
    const sourceValue = parsed.isLabeled ? parsed.value : sourceSentence;
    const items = COMMA_FIELDS.includes(fn) ? splitByComma(sourceValue) : [sourceValue];
    items[itemIndex] = editValue.trim().replace(/[;.]+$/, '');
    sentences[sentenceIndex] = parsed.isLabeled ? `${parsed.label}: ${items.join(', ')}` : items.join(', ');
    const fullText = reconstructFullText(sentences, currentVal);
    const marker = `${fn}-${idx}-s${sentenceIndex}-c${itemIndex}`;
    stageDraft(record, fn, idx, fullText, { sentences: { [marker]: 'edited' }, approvedKey: `${sid}-${idx}` });
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Staged edits for this record live in localEdits keyed `${fieldName}-${idx}` (full field value).
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length)));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" (no dot-keys in this template)
        const dotIdx = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing dot-segment is purely numeric (defensive; not produced here)
        if (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) {
          payload.field = fieldPart.slice(0, dotIdx);
          payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/spinal_manipulation_record/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/spinal_manipulation_record/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { if (store[id]) delete store[id][f]; }); if (store[id] && Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ FORMAT HELPERS FOR COPY ═══════ */
  const formatSentenceFieldLines = useCallback((text, field) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = COMMA_FIELDS.includes(field) ? splitByComma(parsed.value) : [parsed.value];
        lines.push(parsed.label + ':');
        parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
      } else {
        const parts = COMMA_FIELDS.includes(field) ? splitByComma(s) : [s];
        parts.forEach(item => { lines.push(`${n++}. ${item}`); });
      }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.trim().toLowerCase() !== title.trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (BOOLEAN_FIELDS.includes(f)) {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `1. ${val}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`;
      } else if (STRING_FIELDS.includes(f)) {
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        const structured = sentences.length > 1 || COMMA_FIELDS.includes(f) || sentences.some(sentence => parseLabel(sentence).isLabeled);
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        if (structured) formatSentenceFieldLines(strVal, f).forEach(l => { text += `${l}\n`; });
        else text += `1. ${strVal}\n`;
        text += '\n';
      } else {
        if (showLabel) text += `${label}\n${'-'.repeat(40)}\n`;
        text += `1. ${fmtVal(val)}\n\n`;
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = 'Spinal Manipulation Record\n\n';
    pdfData.forEach((r, idx) => {
      text += `Spinal Manipulation Record ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const value = Number.parseFloat(editValue); setEditValue(String((Number.isFinite(value) ? value : 0) - 1)); }}>−</button>
                <input className="edit-number" inputMode="decimal" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); const value = Number.parseFloat(editValue); setEditValue(String((Number.isFinite(value) ? value : 0) + 1)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const num = parseFloat(editValue); if (isNaN(num)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, num); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div data-edit-field={fn}>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={setEditValue} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD (per-item editing with dot-path keys) ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card nested-mini-card">
        {label.trim().toLowerCase() !== SECTION_TITLES[sid].trim().toLowerCase() && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          return (
            <div key={itemIdx} data-edit-field={fn}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = draftRecordId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, fn, idx, currentArr, { fields: { [editKey]: 'edited' }, approvedKey: `${sid}-${idx}` }); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD with splitBySentence ═══════ */
  const renderStringField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const groups = [];
    sentences.forEach((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const items = COMMA_FIELDS.includes(fn)
        ? splitByComma(parsed.isLabeled ? parsed.value : sentence)
        : [parsed.isLabeled ? parsed.value : sentence];
      if (parsed.isLabeled) groups.push({ label: parsed.label, entries: items.map((value, itemIndex) => ({ value, sentenceIndex, itemIndex })) });
      else if (groups[groups.length - 1]?.label === '') groups[groups.length - 1].entries.push(...items.map((value, itemIndex) => ({ value, sentenceIndex, itemIndex })));
      else groups.push({ label: '', entries: items.map((value, itemIndex) => ({ value, sentenceIndex, itemIndex })) });
    });
    const showFieldLabel = label.trim().toLowerCase() !== title.trim().toLowerCase();

    return <div key={fn} className="rec-mini-card">
      {showFieldLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
      {groups.map((group, groupIndex) => <div key={groupIndex} className="nested-mini-card field-group">
        {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
        {group.entries.map(entry => {
          const editKey = `${fn}-${idx}-s${entry.sentenceIndex}-c${entry.itemIndex}`;
          const isEditing = editingField === editKey;
          const badge = editedSentences[editKey];
          return <div key={editKey} data-edit-field={fn}>
            <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(entry.value); setSaveError(null); } }}>
              {isEditing ? <div className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                {saveError && <div className="save-error">{saveError}</div>}
                <div className="edit-actions">
                  <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveStructuredItem(record, fn, idx, sid, entry.sentenceIndex, entry.itemIndex); }}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                </div>
              </div> : <>
                <div className="row-content"><span className="content-value">{highlightText(entry.value)}</span><span className="edit-indicator">&#9998;</span></div>
                <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(entry.value, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
              </>}
            </div>
            {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
          </div>;
        })}
      </div>)}
    </div>;
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="spinal-manipulation-record-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Spinal Manipulation Record</h2></div>
        <div className="empty-state">No spinal manipulation record data available</div>
      </div>
    );
  }

  return (
    <div className="spinal-manipulation-record-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Spinal Manipulation Record</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<SpinalManipulationRecordDocumentPDFTemplate document={pdfData} />} fileName="Spinal_Manipulation_Record.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search spinal manipulation records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Spinal Manipulation Record ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'segments-treated')}
            {renderSection(record, idx, 'manipulation-technique')}
            {renderSection(record, idx, 'thrust-direction')}
            {renderSection(record, idx, 'patient-positioning')}
            {renderSection(record, idx, 'force-amplitude')}
            {renderSection(record, idx, 'subluxation-complex')}
            {renderSection(record, idx, 'range-of-motion')}
            {renderSection(record, idx, 'pain-scores')}
            {renderSection(record, idx, 'palpation')}
            {renderSection(record, idx, 'si-dysfunction')}
            {renderSection(record, idx, 'ortho-neuro-tests')}
            {renderSection(record, idx, 'contraindications')}
            {renderSection(record, idx, 'treatment-outcome')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpinalManipulationRecordDocument;
