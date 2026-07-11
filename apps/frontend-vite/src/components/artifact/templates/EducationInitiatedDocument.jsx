/**
 * EducationInitiatedDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: education_initiated
 *
 * 6 Sections:
 *   1. education-details: educationTopic (comma-split), educationMethod, educatorRole, patientLiteracyLevel, languageOfInstruction, educationDurationMinutes (number)
 *   2. methods-flags: interpreterUsed (bool), medicationEducationProvided (bool), dietaryInstructionsGiven (bool), exerciseEducationProvided (bool)
 *   3. content-delivery: diseasePathophysiologyExplained (bool), warningSignsEducation (bool), selfMonitoringInstructed (bool), procedureEducationProvided (bool)
 *   4. comprehension: patientComprehensionAssessed (bool), comprehensionLevel, familyMembersPresent (bool), patientMotivationLevel
 *   5. follow-up: followUpEducationScheduled (bool), dischargeInstructionsReviewed (bool), emergencyContactInformation (bool)
 *   6. materials: writtenMaterialsProvided[], resourceReferralsProvided[], educationBarriersIdentified[]
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EducationInitiatedDocumentPDFTemplate from '../pdf-templates/EducationInitiatedDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import BlueSelect from '../components/BlueSelect';
import './EducationInitiatedDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'education_initiatedPendingEdits';
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
  'education-details': 'Education Details',
  'methods-flags': 'Education Methods & Flags',
  'content-delivery': 'Content Delivery',
  'comprehension': 'Comprehension & Support',
  'follow-up': 'Follow-Up & Discharge',
  'materials': 'Materials & Barriers',
};

const FIELD_LABELS = {
  educationTopic: 'Education Topic',
  educationMethod: 'Education Method',
  educatorRole: 'Educator Role',
  patientLiteracyLevel: 'Patient Literacy Level',
  languageOfInstruction: 'Language of Instruction',
  educationDurationMinutes: 'Education Duration (Minutes)',
  interpreterUsed: 'Interpreter Used',
  medicationEducationProvided: 'Medication Education Provided',
  dietaryInstructionsGiven: 'Dietary Instructions Given',
  exerciseEducationProvided: 'Exercise Education Provided',
  diseasePathophysiologyExplained: 'Disease Pathophysiology Explained',
  warningSignsEducation: 'Warning Signs Education',
  selfMonitoringInstructed: 'Self-Monitoring Instructed',
  procedureEducationProvided: 'Procedure Education Provided',
  patientComprehensionAssessed: 'Patient Comprehension Assessed',
  comprehensionLevel: 'Comprehension Level',
  familyMembersPresent: 'Family Members Present',
  patientMotivationLevel: 'Patient Motivation Level',
  followUpEducationScheduled: 'Follow-Up Education Scheduled',
  dischargeInstructionsReviewed: 'Discharge Instructions Reviewed',
  emergencyContactInformation: 'Emergency Contact Information',
  writtenMaterialsProvided: 'Written Materials Provided',
  resourceReferralsProvided: 'Resource Referrals Provided',
  educationBarriersIdentified: 'Education Barriers Identified',
};

const SECTION_FIELDS = {
  'education-details': ['educationTopic', 'educationMethod', 'educatorRole', 'patientLiteracyLevel', 'languageOfInstruction', 'educationDurationMinutes'],
  'methods-flags': ['interpreterUsed', 'medicationEducationProvided', 'dietaryInstructionsGiven', 'exerciseEducationProvided'],
  'content-delivery': ['diseasePathophysiologyExplained', 'warningSignsEducation', 'selfMonitoringInstructed', 'procedureEducationProvided'],
  'comprehension': ['patientComprehensionAssessed', 'comprehensionLevel', 'familyMembersPresent', 'patientMotivationLevel'],
  'follow-up': ['followUpEducationScheduled', 'dischargeInstructionsReviewed', 'emergencyContactInformation'],
  'materials': ['writtenMaterialsProvided', 'resourceReferralsProvided', 'educationBarriersIdentified'],
};

const BOOLEAN_FIELDS = [
  'interpreterUsed', 'medicationEducationProvided', 'dietaryInstructionsGiven', 'exerciseEducationProvided',
  'diseasePathophysiologyExplained', 'warningSignsEducation', 'selfMonitoringInstructed', 'procedureEducationProvided',
  'patientComprehensionAssessed', 'familyMembersPresent', 'followUpEducationScheduled',
  'dischargeInstructionsReviewed', 'emergencyContactInformation',
];
const NUMBER_FIELDS = ['educationDurationMinutes'];
/* No meaningful-zero numbers here: educationDurationMinutes=0 means "duration not recorded",
   never a real 0-minute session → hidden unless doctor-edited to a non-zero value. */
const MEANINGFUL_ZERO_FIELDS = [];
const ARRAY_FIELDS = ['writtenMaterialsProvided', 'resourceReferralsProvided', 'educationBarriersIdentified'];
const COMMA_SPLIT_FIELDS = ['educationTopic'];

/* Fixed-choice clinical fields → BlueSelect (case-insensitive per memory 6a4b38d2: no duplicate option;
   an off-scale stored value is kept via enumOptionsWith). Stored values are lowercase ('physician','good','high')
   → enumCanonical normalizes the display to the Title-Case option. */
const ENUM_OPTIONS = {
  educationMethod: ['Verbal Instruction', 'Written Materials', 'Demonstration', 'Return Demonstration', 'Video', 'Group Class', 'Teach-Back'],
  educatorRole: ['Physician', 'Registered Nurse', 'Nurse Practitioner', 'Physician Assistant', 'Pharmacist', 'Dietitian', 'Social Worker', 'Health Educator', 'Respiratory Therapist', 'Physical Therapist'],
  patientLiteracyLevel: ['Low', 'Marginal', 'Adequate', 'High'],
  comprehensionLevel: ['Poor', 'Fair', 'Good', 'Excellent'],
  patientMotivationLevel: ['Low', 'Moderate', 'High'],
  languageOfInstruction: ['English', 'Spanish', 'Mandarin', 'Cantonese', 'Vietnamese', 'Arabic', 'Russian', 'French', 'Haitian Creole', 'Portuguese', 'Korean', 'Other'],
};
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };
const enumOptionsWith = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; return base.some(o => o.toLowerCase() === String(cur ?? '').toLowerCase()) ? base : (cur ? [cur, ...base] : base); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ═══════ COMPONENT ═══════ */
const EducationInitiatedDocument = ({ document: docProp }) => {
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
      if (r?.education_initiated) return Array.isArray(r.education_initiated) ? r.education_initiated : [r.education_initiated];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.education_initiated) return Array.isArray(dd.education_initiated) ? dd.education_initiated : [dd.education_initiated]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idForRec = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idForRec(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
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

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  /* numeric "not recorded" (0) is hidden unless meaningful-zero or doctor-edited */
  const numericShows = useCallback((fn, v, idx) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn) || !!editedFields[`${fn}-${idx}`]; return true; }, [editedFields]);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const getArrayItemValue = useCallback((record, fn, idx, arrIdx) => {
    const k = `${fn}.${arrIdx}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const arr = record[fn];
    if (!Array.isArray(arr)) return undefined;
    return arr[arrIdx];
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
  const shouldShowSection = useCallback((record, sid, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, idx);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
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
      const rt = `Education Initiated ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && Array.isArray(val)) {
            for (const item of val) { if (String(item).toLowerCase().includes(phrase)) return true; }
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const dotParts = fieldPath.split('.');
          if (dotParts.length === 2) {
            const [arrField, arrIdx] = dotParts;
            if (!merged[arrField]) merged[arrField] = [...(record[arrField] || [])];
            else merged[arrField] = [...merged[arrField]];
            merged[arrField][parseInt(arrIdx)] = localEdits[key];
          } else {
            merged[fieldPath] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  /* Find the sectionId that owns a given field (for clearing its approved flag on re-edit). */
  const sidForField = (fn) => Object.keys(SECTION_FIELDS).find(s => (SECTION_FIELDS[s] || []).includes(fn));

  /* Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
     NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits). */
  const handleSaveField = useCallback((record, fn, idx, _sid, _sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    let saveVal = valueOverride !== undefined ? valueOverride : editValue;

    /* Field type validation */
    if (NUMBER_FIELDS.includes(fn)) {
      if (isNaN(Number(saveVal))) { setSaveError('Please enter a valid number'); return; }
      saveVal = Number(saveVal);
    }
    if (BOOLEAN_FIELDS.includes(fn)) {
      const lower = String(saveVal).toLowerCase().trim();
      if (!['yes', 'no', 'true', 'false'].includes(lower)) { setSaveError('Please enter Yes or No'); return; }
      saveVal = (lower === 'yes' || lower === 'true');
    }

    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const trackKey = editTrackingKey || editKey;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    const sid = _sid || sidForField(fn);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const handleSaveArrayItem = useCallback((record, fn, idx, arrayIndex) => {
    const id = safeId(record); if (!id) return;
    setSaveError(null);
    const editKey = `${fn}.${arrayIndex}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const sid = sidForField(fn);
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });

    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);

    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

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
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // localEdits keys for this section: "field-idx" (scalar/comma) or "field.arrayIndex-idx" (array item)
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const dotIdx = fieldPart.lastIndexOf('.');
      const baseField = (dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))) ? fieldPart.slice(0, dotIdx) : fieldPart;
      return fields.includes(baseField);
    });
    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const payload = { field: isArrayElem ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        await secureApiClient.put(`/api/edit/education_initiated/${id}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/education_initiated/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[id]) { delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[EducationInitiated] Approve error:', err); }
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
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (NUMBER_FIELDS.includes(f) && !numericShows(f, val, idx)) return;
      text += `${label}\n${'-'.repeat(40)}\n`;
      if (ARRAY_FIELDS.includes(f)) {
        (Array.isArray(val) ? val : [val]).forEach((item, i) => { text += `${i + 1}. ${String(item)}\n`; });
      } else if (COMMA_SPLIT_FIELDS.includes(f)) {
        String(val).split(',').map(s => s.trim()).filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
      } else if (ENUM_FIELDS.includes(f)) {
        text += `1. ${enumCanonical(f, fmtVal(val))}\n`;
      } else {
        text += `1. ${fmtVal(val)}\n`;
      }
      text += '\n';
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== EDUCATION INITIATED ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Education Initiated ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        text += buildSectionCopyText(r, idx, sid);
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: BOOLEAN SELECT FIELD ═══════ */
  const renderBooleanField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    const normalizeYesNo = (v) => {
      const lower = String(v).toLowerCase().trim();
      if (lower === 'yes' || lower === 'true') return 'Yes';
      if (lower === 'no' || lower === 'false') return 'No';
      return v;
    };

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(normalizeYesNo(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue} options={['Yes', 'No']} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
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
    const val = getFieldValue(record, fn, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    /* hide-zero: numeric "not recorded" (0) hidden unless meaningful-zero or doctor-edited */
    if (!numericShows(fn, val, idx)) return null;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = fmtVal(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); let n = (parseFloat(editValue) || 0) - (dec ? 0.1 : 1); if (n < 0) n = 0; setEditValue(String(Math.round(n * 100) / 100)); }}>−</button>
                <input type="text" inputMode="decimal" className="num-stepper-input" value={editValue} autoFocus onChange={e => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={() => { const dec = String(editValue).includes('.'); const n = (parseFloat(editValue) || 0) + (dec ? 0.1 : 1); setEditValue(String(Math.round(n * 100) / 100)); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SIMPLE EDITABLE FIELD ═══════ */
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
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ENUM FIELD (BlueSelect) ═══════ */
  const renderEnumField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const displayVal = enumCanonical(fn, fmtVal(val));
    const opts = enumOptionsWith(fn, displayVal);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className={sl ? 'rec-mini-card' : ''}>
        {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueSelect value={editValue || displayVal} options={opts} onChange={v => setEditValue(v)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid, null, editValue || displayVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: COMMA-SPLIT FIELD (educationTopic) ═══════ */
  const renderCommaSplitField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const items = String(val).split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {items.map((item, arrIdx) => {
            const editKey = `${fn}-comma-${arrIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const itemMatches = phraseMatch || !searchTerm.trim() || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(item); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => {
                          e.stopPropagation();
                          const id = safeId(record); if (!id) return;
                          const currentVal = String(getFieldValue(record, fn, idx) || '');
                          const currentItems = currentVal.split(',').map(s => s.trim()).filter(Boolean);
                          currentItems[arrIdx] = editValue.trim();
                          const newVal = currentItems.join(', ');
                          setSaveError(null);
                          // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
                          const localKey = `${fn}-${idx}`;
                          setLocalEdits(prev => ({ ...prev, [localKey]: newVal }));
                          setPendingEdits(prev => ({ ...prev, [localKey]: true }));
                          setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                          const csid = sidForField(fn);
                          if (csid) setApprovedSections(prev => { const k = `${csid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
                          const store = readDrafts();
                          if (!store[id]) store[id] = {};
                          store[id][fn] = newVal;
                          writeDrafts(store);
                          setEditingField(null); setEditValue('');
                        }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid, title) => {
    const arr = record[fn];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;

    return (
      <div key={fn}>
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {arr.map((item, arrIdx) => {
            const itemVal = getArrayItemValue(record, fn, idx, arrIdx) ?? item;
            const editKey = `${fn}.${arrIdx}-${idx}`;
            const isEditing = editingField === editKey;
            const isModified = editedFields[editKey];
            const itemMatches = phraseMatch || !searchTerm.trim() || String(itemVal).toLowerCase().includes(searchTerm.toLowerCase().trim());
            if (!itemMatches && searchTerm.trim()) return null;

            return (
              <div key={arrIdx}>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(itemVal)); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, fn, idx, arrIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(String(itemVal))}</span><span className="edit-indicator">✎</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(itemVal), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid, idx)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (ARRAY_FIELDS.includes(f)) return Array.isArray(record[f]) && record[f].length > 0;
      if (NUMBER_FIELDS.includes(f)) return numericShows(f, val, idx);
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid, title);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid, title);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid, title);
            if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaSplitField(record, f, idx, sid, title);
            if (ENUM_FIELDS.includes(f)) return renderEnumField(record, f, idx, sid, title);
            return renderEditableField(record, f, idx, sid, title);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="education-initiated-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Education Initiated</h2></div>
        <div className="empty-state">No education initiated records available</div>
      </div>
    );
  }

  return (
    <div className="education-initiated-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Education Initiated</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<EducationInitiatedDocumentPDFTemplate document={pdfData} />} fileName="Education_Initiated.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search education initiated..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">{highlightText(`Education Initiated ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'education-details')}
            {renderSection(record, idx, 'methods-flags')}
            {renderSection(record, idx, 'content-delivery')}
            {renderSection(record, idx, 'comprehension')}
            {renderSection(record, idx, 'follow-up')}
            {renderSection(record, idx, 'materials')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EducationInitiatedDocument;
