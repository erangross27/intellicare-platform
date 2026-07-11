/**
 * FollowUpPlanDocument.jsx
 * Canonical rebuild (July 2026) — was a bespoke Dec-2025 template (side-by-side copy, non-canonical rows →
 * 0 harness-probed fields, native date, non-standard approve). Now the standard one-pass shape: rec-mini-card
 * rows with .numbered-row.editable-row, BlueDatePicker, single-name gate, canonical EQ/DASH numbered copy,
 * standard Pending-Approve wiring, box-free PDF. Single record, generic-document schema (date + string arrays).
 * Collection: follow_up_plan
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import FollowUpPlanDocumentPDFTemplate from '../pdf-templates/FollowUpPlanDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import secureApiClient from '../../../services/secureApiClient';
import './FollowUpPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Survives refresh; NOT written to MongoDB / PDF until Approve. */
const DRAFT_KEY = 'follow_up_planPendingEdits';
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } };
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'follow-up-details': 'Follow-Up Details',
  'monitoring': 'Monitoring & Tests',
  'goals': 'Clinical Goals',
  'medications-treatments': 'Medications & Treatments',
  'activity-diet': 'Activity & Diet',
  'referrals-coordination': 'Referrals & Care Coordination',
  'vaccines': 'Vaccines & Screenings',
  'red-flags-education': 'Red Flags & Education',
  'barriers': 'Compliance Barriers',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  followUpReason: 'Follow-Up Reason', followUpInterval: 'Follow-Up Interval', followUpModality: 'Follow-Up Modality', nextAppointmentScheduled: 'Next Appointment Scheduled',
  monitoringParameters: 'Monitoring Parameters', requiredLabTests: 'Required Lab Tests', requiredImagingStudies: 'Required Imaging Studies', screeningsDue: 'Screenings Due',
  goalBloodPressure: 'Goal Blood Pressure', goalBloodGlucose: 'Goal Blood Glucose', goalWeight: 'Goal Weight',
  medicationChanges: 'Medication Changes', physicalTherapyOrdered: 'Physical Therapy Ordered', anticoagulationManagement: 'Anticoagulation Management', woundCareInstructions: 'Wound Care Instructions',
  activityRestrictions: 'Activity Restrictions', dietaryModifications: 'Dietary Modifications',
  specialtyReferrals: 'Specialty Referrals', careCoordinationNeeds: 'Care Coordination Needs', homeHealthServices: 'Home Health Services', durableMedicalEquipment: 'Durable Medical Equipment',
  vaccinesRecommended: 'Vaccines Recommended',
  symptomRedFlags: 'Symptom Red Flags', patientEducationTopics: 'Patient Education Topics',
  complianceBarriers: 'Compliance Barriers',
};
const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility'],
  'follow-up-details': ['followUpReason', 'followUpInterval', 'followUpModality', 'nextAppointmentScheduled'],
  'monitoring': ['monitoringParameters', 'requiredLabTests', 'requiredImagingStudies', 'screeningsDue'],
  'goals': ['goalBloodPressure', 'goalBloodGlucose', 'goalWeight'],
  'medications-treatments': ['medicationChanges', 'physicalTherapyOrdered', 'anticoagulationManagement', 'woundCareInstructions'],
  'activity-diet': ['activityRestrictions', 'dietaryModifications'],
  'referrals-coordination': ['specialtyReferrals', 'careCoordinationNeeds', 'homeHealthServices', 'durableMedicalEquipment'],
  'vaccines': ['vaccinesRecommended'],
  'red-flags-education': ['symptomRedFlags', 'patientEducationTopics'],
  'barriers': ['complianceBarriers'],
};
const SECTION_ORDER = ['record-info', 'follow-up-details', 'monitoring', 'goals', 'medications-treatments', 'activity-diet', 'referrals-coordination', 'vaccines', 'red-flags-education', 'barriers'];

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['monitoringParameters', 'requiredLabTests', 'requiredImagingStudies', 'screeningsDue', 'medicationChanges', 'activityRestrictions', 'dietaryModifications', 'specialtyReferrals', 'careCoordinationNeeds', 'homeHealthServices', 'durableMedicalEquipment', 'vaccinesRecommended', 'symptomRedFlags', 'patientEducationTopics', 'complianceBarriers'];
const STRING_FIELDS = ['provider', 'facility', 'followUpReason', 'followUpInterval', 'followUpModality', 'nextAppointmentScheduled', 'goalBloodPressure', 'goalBloodGlucose', 'goalWeight', 'physicalTherapyOrdered', 'anticoagulationManagement', 'woundCareInstructions'];
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; } catch { return ''; }
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

const FollowUpPlanDocument = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const records = useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.follow_up_plan) return Array.isArray(r.follow_up_plan) ? r.follow_up_plan : [r.follow_up_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.follow_up_plan) return Array.isArray(dd.follow_up_plan) ? dd.follow_up_plan : [dd.follow_up_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  /* Rehydrate pending drafts. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const rid = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = rid(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fn, value]) => { const lk = `${fn}-${idx}`; nLocal[lk] = value; nPending[lk] = true; nFields[lk] = 'edited'; });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => !isEmptyDeep(v), []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    /* [.;]+space; abbrev guard + (?<!\b[A-Z]) single-initial guard ("Dr. R. Kim" stays whole) */
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

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

  const fieldRawText = useCallback((record, fn, idx) => {
    const val = getFieldValue(record, fn, idx);
    if (val === null || val === undefined) return '';
    if (DATE_FIELDS.includes(fn)) return formatDate(val);
    if (Array.isArray(val)) return val.map(x => String(x)).join(' ');
    return fmtVal(val);
  }, [getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const p = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(p) || p.includes(label)) return true;
    return fieldRawText(record, fn, idx).toLowerCase().includes(p);
  }, [searchTerm, fieldRawText]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (sectionTitleMatches(sid)) return true;
    return (SECTION_FIELDS[sid] || []).some(f => hasVal(getFieldValue(record, f, 0)) && fieldMatches(record, f, 0));
  }, [searchTerm, sectionTitleMatches, hasVal, getFieldValue, fieldMatches]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const p = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Follow Up Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(p)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) if (t.toLowerCase().includes(p)) return true;
      for (const l of Object.values(FIELD_LABELS)) if (l.toLowerCase().includes(p)) return true;
      for (const fields of Object.values(SECTION_FIELDS)) for (const f of fields) if (fieldRawText(record, f, idx).toLowerCase().includes(p)) return true;
      return false;
    });
  }, [records, searchTerm, fieldRawText]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return;
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) merged[m[1]] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT / APPROVE ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || editKey]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = saveVal; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const edited = editValue.trim();
    const strip = (s) => s.replace(/[;.]+$/, '').trim();
    let updated;
    if (!edited || /^[;.,!?]+$/.test(edited)) { updated = [...sentences]; updated.splice(sentenceIdx, 1); }
    else { const ns = splitBySentence(edited); updated = [...sentences]; updated.splice(sentenceIdx, 1, ...ns); }
    const fullText = updated.map(strip).join('. ') + (updated.length ? '.' : '');
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, splitBySentence]);

  const saveArrayItem = useCallback((record, fn, idx, sid, arrIdx) => {
    const id = safeId(record); if (!id) return;
    const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : [];
    cur[arrIdx] = editValue.trim();
    setSaveError(null);
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: cur }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}.${arrIdx}-${idx}`]: 'edited' }));
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = cur; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue]);

  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))));
  }, [editedFields]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    setSaving(true);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      for (const [fn, value] of Object.entries(recDrafts)) {
        if (!fields.includes(fn)) continue;
        const resp = await secureApiClient.put(`/api/edit/follow_up_plan/${id}/edit`, { field: fn, value });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/follow_up_plan/${id}/approve`, { sectionId: sid, approved: true });
      setPendingEdits(prev => { const n = { ...prev }; fields.forEach(f => { delete n[`${f}-${idx}`]; }); return n; });
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[FollowUpPlan] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const fields = SECTION_FIELDS[sid] || [];
    let body = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (DATE_FIELDS.includes(f)) {
        body += `${head}1. ${formatDate(val)}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
        if (arr.length === 0) return;
        body += head;
        arr.forEach((item, i) => { body += `${i + 1}. ${String(item)}\n`; });
        body += '\n';
      } else {
        body += head;
        const strVal = fmtVal(val);
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1) sentences.forEach((s, i) => { body += `${i + 1}. ${s.replace(/[;.]+$/, '').trim()}\n`; });
        else body += `1. ${strVal}\n`;
        body += '\n';
      }
    });
    if (!body.trim()) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${body}`;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence]);

  const copyAllText = useCallback(async () => {
    let text = `Follow Up Plan\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Follow Up Plan ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      SECTION_ORDER.forEach(sid => { const sec = buildSectionCopyText(r, idx, sid); if (sec) text += sec; });
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
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
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
    if (!Array.isArray(arr) || arr.filter(x => !isEmptyDeep(x)).length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {arr.map((item, arrIdx) => {
          if (isEmptyDeep(item)) return null;
          const itemKey = `${fn}.${arrIdx}-${idx}`;
          const isEditing = editingField === itemKey;
          const badge = editedFields[itemKey];
          const itemStr = String(item);
          if (searchTerm.trim() && !phraseMatch && !label.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
          return (
            <div key={arrIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItem(record, fn, idx, sid, arrIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD (splitBySentence) ═══════ */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    if (sentences.length > 1) {
      return (
        <div key={fn} className="rec-mini-card">
          {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {sentences.map((sentence, sIdx) => {
            const sentenceKey = `${fn}-${idx}-s${sIdx}`;
            const isEditing = editingField === sentenceKey;
            const badge = editedFields[sentenceKey];
            return (
              <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          })}
        </div>
      );
    }

    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx)));
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
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="follow-up-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Follow Up Plan</h2></div>
        <div className="empty-state">No follow up plan records available</div>
      </div>
    );
  }

  return (
    <div className="follow-up-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Follow Up Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<FollowUpPlanDocumentPDFTemplate document={pdfData} />} fileName="Follow_Up_Plan.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search follow up plan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <h3 className="record-name">Follow Up Plan {idx + 1}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FollowUpPlanDocument;
