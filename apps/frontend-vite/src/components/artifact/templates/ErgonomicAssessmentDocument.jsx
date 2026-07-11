/**
 * ErgonomicAssessmentDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: ergonomic_assessment
 *
 * 7 Sections:
 *   1. session-info: date (date), workstationType (string), jobTitle (string), dailyWorkHours (number)
 *   2. risk-assessment: repetitiveTaskFrequency (string), primaryBodyRegionsAtRisk (array), currentMusculoskeletalComplaints (array)
 *   3. scoring: rapidUpperLimbScore (number), rapidEntireBodyScore (number), functionalMovementScore (number)
 *   4. compliance: monitorHeightCompliance (boolean), chairAdjustabilityCompliance (boolean), keyboardMousePosition (string), workSurfaceHeight (string), footSupportProvided (boolean), reachDistanceCompliance (boolean), microbreakCompliance (boolean)
 *   5. force-exposure: forceExertionLevel (string), liftingFrequency (string), maxWeightLifted (number), awkwardPosturesDuration (number), vibrationExposure (boolean), lightingAdequacy (string)
 *   6. risk-intervention: ergonomicRiskLevel (string), interventionPriority (string), equipmentModificationsRequired (array), followUpAssessmentDate (date)
 *   7. clearance-education: returnToPlayCriteria (array), homeExerciseProgramIncluded (boolean), cardiacClearanceObtained (boolean), educationalMaterialsProvided (array)
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ErgonomicAssessmentDocumentPDFTemplate from '../pdf-templates/ErgonomicAssessmentDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueSelect from '../components/BlueSelect';
import './ErgonomicAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'ergonomic_assessmentPendingEdits';
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
  'session-info': 'Session Information',
  'risk-assessment': 'Risk Assessment',
  scoring: 'Scoring',
  compliance: 'Compliance',
  'force-exposure': 'Force & Exposure',
  'risk-intervention': 'Risk & Intervention',
  'clearance-education': 'Clearance & Education',
};

const FIELD_LABELS = {
  date: 'Date',
  workstationType: 'Workstation Type',
  jobTitle: 'Job Title',
  dailyWorkHours: 'Daily Work Hours',
  repetitiveTaskFrequency: 'Repetitive Task Frequency',
  primaryBodyRegionsAtRisk: 'Primary Body Regions at Risk',
  currentMusculoskeletalComplaints: 'Current Musculoskeletal Complaints',
  rapidUpperLimbScore: 'Rapid Upper Limb Score',
  rapidEntireBodyScore: 'Rapid Entire Body Score',
  functionalMovementScore: 'Functional Movement Score',
  monitorHeightCompliance: 'Monitor Height Compliance',
  chairAdjustabilityCompliance: 'Chair Adjustability Compliance',
  keyboardMousePosition: 'Keyboard/Mouse Position',
  workSurfaceHeight: 'Work Surface Height',
  footSupportProvided: 'Foot Support Provided',
  reachDistanceCompliance: 'Reach Distance Compliance',
  microbreakCompliance: 'Microbreak Compliance',
  forceExertionLevel: 'Force Exertion Level',
  liftingFrequency: 'Lifting Frequency',
  maxWeightLifted: 'Max Weight Lifted',
  awkwardPosturesDuration: 'Awkward Postures Duration',
  vibrationExposure: 'Vibration Exposure',
  lightingAdequacy: 'Lighting Adequacy',
  ergonomicRiskLevel: 'Ergonomic Risk Level',
  interventionPriority: 'Intervention Priority',
  equipmentModificationsRequired: 'Equipment Modifications Required',
  followUpAssessmentDate: 'Follow-Up Assessment Date',
  returnToPlayCriteria: 'Return to Play Criteria',
  homeExerciseProgramIncluded: 'Home Exercise Program Included',
  cardiacClearanceObtained: 'Cardiac Clearance Obtained',
  educationalMaterialsProvided: 'Educational Materials Provided',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'workstationType', 'jobTitle', 'dailyWorkHours'],
  'risk-assessment': ['repetitiveTaskFrequency', 'primaryBodyRegionsAtRisk', 'currentMusculoskeletalComplaints'],
  scoring: ['rapidUpperLimbScore', 'rapidEntireBodyScore', 'functionalMovementScore'],
  compliance: ['monitorHeightCompliance', 'chairAdjustabilityCompliance', 'keyboardMousePosition', 'workSurfaceHeight', 'footSupportProvided', 'reachDistanceCompliance', 'microbreakCompliance'],
  'force-exposure': ['forceExertionLevel', 'liftingFrequency', 'maxWeightLifted', 'awkwardPosturesDuration', 'vibrationExposure', 'lightingAdequacy'],
  'risk-intervention': ['ergonomicRiskLevel', 'interventionPriority', 'equipmentModificationsRequired', 'followUpAssessmentDate'],
  'clearance-education': ['returnToPlayCriteria', 'homeExerciseProgramIncluded', 'cardiacClearanceObtained', 'educationalMaterialsProvided'],
};

const NUMBER_FIELDS = ['dailyWorkHours', 'rapidUpperLimbScore', 'rapidEntireBodyScore', 'maxWeightLifted', 'awkwardPosturesDuration', 'functionalMovementScore'];
// RULA (valid 1-7) and REBA (valid 1-15) cannot be 0; a stored 0 means "not assessed" (sentinel) -> hide it.
// Other numbers (maxWeightLifted=0 -> no lifting, awkwardPosturesDuration=0 -> none) are genuinely meaningful and shown.
const ZERO_SENTINEL_FIELDS = ['rapidUpperLimbScore', 'rapidEntireBodyScore'];
const BOOLEAN_FIELDS = ['monitorHeightCompliance', 'chairAdjustabilityCompliance', 'vibrationExposure', 'microbreakCompliance', 'footSupportProvided', 'reachDistanceCompliance', 'homeExerciseProgramIncluded', 'cardiacClearanceObtained'];
const DATE_FIELDS = ['date', 'followUpAssessmentDate'];
const ARRAY_FIELDS = ['primaryBodyRegionsAtRisk', 'currentMusculoskeletalComplaints', 'equipmentModificationsRequired', 'returnToPlayCriteria', 'educationalMaterialsProvided'];

/* Known clinical scales → themed BlueSelect dropdown (edit-widget-only; unmatched stored value preserved). */
const ENUM_FIELDS = {
  ergonomicRiskLevel: ['Low', 'Moderate', 'High', 'Very High'],
  interventionPriority: ['Routine', 'Urgent', 'Immediate'],
};
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const enumOptionsWith = (options, current) => {
  const canon = enumCanonical(options, current);
  if (canon && !(options || []).some(o => o.toLowerCase() === canon.toLowerCase())) return [canon, ...(options || [])];
  return options || [];
};
/* −/+ stepper step = the value's OWN precision (decimal-aware). */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
/* Copy dividers (one-pass item 2): '='×40 under titles, '-'×40 under every field label. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const ErgonomicAssessmentDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.ergonomic_assessment) return Array.isArray(r.ergonomic_assessment) ? r.ergonomic_assessment : [r.ergonomic_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ergonomic_assessment) return Array.isArray(dd.ergonomic_assessment) ? dd.ergonomic_assessment : [dd.ergonomic_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ REHYDRATE PENDING DRAFTS ═══════ */
  // Rehydrate staged drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Scalar drafts are keyed by field name; array-item drafts by "field.arrayIndex". localEdits stores
  // the whole array under "field-idx", so array items are merged element-by-element.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrItem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrItem) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrIdx = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const baseKey = `${fn}-${idx}`;
          const arr = [...(nLocal[baseKey] !== undefined ? nLocal[baseKey] : (record[fn] || []))];
          arr[arrIdx] = value;
          nLocal[baseKey] = arr;
          nPending[`${fn}.${arrIdx}-${idx}`] = true;
          nFields[`${fn}.${arrIdx}-${idx}`] = 'edited';
        } else {
          const editKey = `${fieldPart}-${idx}`;
          nLocal[editKey] = value;
          nPending[editKey] = true;
          nFields[editKey] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0 && Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

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

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
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
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
          }
        } else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
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
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(phrase));
      }
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Ergonomic Assessment ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === 'string' && item.toLowerCase().includes(phrase)) return true;
            }
          } else if (val && fmtVal(val).toLowerCase().includes(phrase)) return true;
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
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          // pending drafts stay OUT of the PDF until approved. Scalars are keyed `fn-idx`;
          // array-item drafts are keyed `fn.arrIdx-idx` — skip the merge if either is pending.
          if (pendingEdits[key]) return;
          const arrPending = Object.keys(pendingEdits).some(pk => pendingEdits[pk] && pk.startsWith(`${fn}.`) && pk.endsWith(`-${idx}`));
          if (arrPending) return;
          merged[fn] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending.
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // Persist the draft (scalar value keyed by field name). Approve commits it to the DB.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one array element = stage a DRAFT locally (whole array in localEdits, per-element draft in store).
  const handleSaveArrayItem = useCallback((record, fn, idx, arrIdx, value, sid) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrIdx}-${idx}`;
    const currentArr = [...(getFieldValue(record, fn, idx) || [])];
    currentArr[arrIdx] = value;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    // Persist the draft (per-element keyed by "field.arrayIndex"). Approve commits it to the DB.
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrIdx}`] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)))
    );
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // Pending editKeys belonging to this section + record: scalar `fn-idx` or array `fn.arrIdx-idx`.
      const toCommit = Object.keys(pendingEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return fields.some(f => k === `${f}-${idx}` || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)));
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -`-${idx}`.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        // arrayIndex ONLY when the segment after the last dot is purely numeric.
        const isArrItem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        if (isArrItem) {
          const fn = fieldPart.slice(0, dotIdx);
          const arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
          const arr = localEdits[`${fn}-${idx}`] || [];
          await secureApiClient.put(`/api/edit/ergonomic_assessment/${id}/edit`, { field: fn, value: arr[arrayIndex], arrayIndex });
        } else {
          await secureApiClient.put(`/api/edit/ergonomic_assessment/${id}/edit`, { field: fieldPart, value: localEdits[editKey] });
        }
      }
      await secureApiClient.put(`/api/edit/ergonomic_assessment/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -`-${idx}`.length);
          delete store[id][fieldPart];
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) {
      console.error('[ErgonomicAssessment] Approve error:', err);
      setSaveError('Approve failed. Please try again.');
    } finally { setSaving(false); }
  }, [safeId, pendingEdits, localEdits]);

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
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let text = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (ZERO_SENTINEL_FIELDS.includes(f) && Number(val) === 0) return;
      if (DATE_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n${formatDate(val)}\n\n`;
      } else if (ENUM_FIELDS[f]) {
        text += `${label}\n${COPY_LINE_DASH}\n${enumCanonical(ENUM_FIELDS[f], val) || fmtVal(val)}\n\n`;
      } else if (BOOLEAN_FIELDS.includes(f)) {
        text += `${label}\n${COPY_LINE_DASH}\n${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}\n\n`;
      } else if (Array.isArray(val)) {
        text += `${label}\n${COPY_LINE_DASH}\n`;
        val.forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
        text += '\n';
      } else {
        text += `${label}\n${COPY_LINE_DASH}\n${fmtVal(val)}\n\n`;
      }
    });
    // Empty-section drop (one-pass item 3 GOTCHA): a section with no populated fields emits NOTHING.
    return text.trim() ? `${title}\n${COPY_LINE_EQ}\n\n${text}` : '';
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== ERGONOMIC ASSESSMENT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Ergonomic Assessment ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: NUMBER FIELD ═══════ */
  const renderNumberField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    if (ZERO_SENTINEL_FIELDS.includes(fn) && Number(val) === 0) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="text" inputMode="decimal" className="edit-number" value={editValue} autoFocus onClick={e => e.stopPropagation()} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); } }} />
                <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const st = parseFloat(stepFor(editValue)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal) || editValue.trim() === '') { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: BOOLEAN FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD (string) ═══════ */
  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'\u270E'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (known clinical scale → themed BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const options = enumOptionsWith(ENUM_FIELDS[fn], val);
    const displayVal = enumCanonical(ENUM_FIELDS[fn], val) || fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={options} onChange={(v) => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">{'✎'}</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const arr = getFieldValue(record, fn, idx);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {arr.map((item, arrIdx) => {
          const itemStr = String(item || '');
          if (!itemStr.trim()) return null;
          if (searchTerm.trim() && !phraseMatch && !contentMatches(itemStr) && !(FIELD_LABELS[fn] || '').toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;

          const arrEditKey = `${fn}.${arrIdx}-${idx}`;
          const isEditing = editingField === arrEditKey;
          const isModified = editedFields[arrEditKey];

          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(arrEditKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx, editValue, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">{'\u270E'}</span></div>
                    <button className={`copy-btn ${copiedItems[arrEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, arrEditKey); }}>{copiedItems[arrEditKey] ? 'Copied!' : 'Copy'}</button>
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

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(val) && val.length > 0;
      if (ZERO_SENTINEL_FIELDS.includes(f) && Number(val) === 0) return false;
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
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (ENUM_FIELDS[f]) return renderEnumField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="ergonomic-assessment-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Ergonomic Assessment</h2></div>
        <div className="empty-state">No ergonomic assessment records available</div>
      </div>
    );
  }

  return (
    <div className="ergonomic-assessment-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Ergonomic Assessment</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ErgonomicAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Ergonomic_Assessment.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search ergonomic assessment..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Ergonomic Assessment ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'session-info')}
            {renderSection(record, idx, 'risk-assessment')}
            {renderSection(record, idx, 'scoring')}
            {renderSection(record, idx, 'compliance')}
            {renderSection(record, idx, 'force-exposure')}
            {renderSection(record, idx, 'risk-intervention')}
            {renderSection(record, idx, 'clearance-education')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ErgonomicAssessmentDocument;
