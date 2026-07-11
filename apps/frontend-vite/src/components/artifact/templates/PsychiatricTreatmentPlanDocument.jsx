/**
 * PsychiatricTreatmentPlanDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: psychiatric_treatment_plan
 *
 * 10 Sections:
 *   1. plan-info: date, type, provider, facility, status
 *   2. diagnoses: diagnoses[] (diagnosis, icdCode, specifiers[])
 *   3. assessment: assessment
 *   4. pharmacological: pharmacological[] (intervention, rationale, monitoring)
 *   5. psychotherapy: psychotherapy.type, psychotherapy.frequency, psychotherapy.provider, psychotherapy.goals[]
 *   6. support-groups: supportGroups[]
 *   7. lifestyle: lifestyleModifications[]
 *   8. safety-plan: safetyPlan.warningSignsidentified[], safetyPlan.copingStrategies[], safetyPlan.supportsContacts[], safetyPlan.crisisNumbers[], safetyPlan.meansRestriction[], safetyPlan.childcarePlan
 *   9. follow-up: followUpPlan.nextAppointment, followUpPlan.frequency, followUpPlan.monitoring[]
 *  10. plan-notes: plan, notes
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PsychiatricTreatmentPlanDocumentPDFTemplate from '../pdf-templates/PsychiatricTreatmentPlanDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PsychiatricTreatmentPlanDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'plan-info': 'Plan Information',
  'diagnoses': 'Diagnoses',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'pharmacological': 'Pharmacological Interventions',
  'psychotherapy': 'Psychotherapy',
  'support-groups': 'Support Groups',
  'lifestyle': 'Lifestyle Modifications',
  'safety-plan': 'Safety Plan',
  'follow-up': 'Follow-Up Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'plan-notes': 'Plan & Notes',
};

/* humanizeKey for recursive object rendering */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const splitRatio = (text) => { if (text === null || text === undefined) return null; const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (!m) return null; return { num: m[1], denom: m[2] }; };
const splitNumberUnit = (text) => { if (text === null || text === undefined) return null; const s = String(text).trim(); if (s === '') return null; if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/); if (!m || !/\d/.test(m[1])) return null; return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() }; };

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
  'diagnoses.diagnosis': 'Diagnosis',
  'diagnoses.icdCode': 'ICD Code',
  'diagnoses.specifiers': 'Specifiers',
  'pharmacological.intervention': 'Intervention',
  'pharmacological.rationale': 'Rationale',
  'pharmacological.monitoring': 'Monitoring',
  'psychotherapy.type': 'Type',
  'psychotherapy.frequency': 'Frequency',
  'psychotherapy.provider': 'Provider',
  'psychotherapy.goals': 'Goals',
  'supportGroups': 'Support Groups',
  'lifestyleModifications': 'Lifestyle Modifications',
  'safetyPlan.warningSignsidentified': 'Warning Signs',
  'safetyPlan.copingStrategies': 'Coping Strategies',
  'safetyPlan.supportsContacts': 'Support Contacts',
  'safetyPlan.crisisNumbers': 'Crisis Numbers',
  'safetyPlan.meansRestriction': 'Means Restriction',
  'safetyPlan.childcarePlan': 'Childcare Plan',
  'followUpPlan.nextAppointment': 'Next Appointment',
  'followUpPlan.frequency': 'Frequency',
  'followUpPlan.monitoring': 'Monitoring',
};

const SECTION_FIELDS = {
  'plan-info': ['date', 'type', 'provider', 'facility', 'status'],
  'diagnoses': ['diagnoses'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'pharmacological': ['pharmacological'],
  'psychotherapy': ['psychotherapy.type', 'psychotherapy.frequency', 'psychotherapy.provider', 'psychotherapy.goals'],
  'support-groups': ['supportGroups'],
  'lifestyle': ['lifestyleModifications'],
  'safety-plan': ['safetyPlan.warningSignsidentified', 'safetyPlan.copingStrategies', 'safetyPlan.supportsContacts', 'safetyPlan.crisisNumbers', 'safetyPlan.meansRestriction', 'safetyPlan.childcarePlan'],
  'follow-up': ['followUpPlan.nextAppointment', 'followUpPlan.frequency', 'followUpPlan.monitoring'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'plan-notes': ['plan', 'notes'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = [];
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'findings', 'assessment', 'plan', 'notes', 'psychotherapy.type', 'psychotherapy.frequency', 'psychotherapy.provider', 'safetyPlan.childcarePlan', 'followUpPlan.nextAppointment', 'followUpPlan.frequency'];
const ARRAY_FIELDS = ['supportGroups', 'lifestyleModifications', 'psychotherapy.goals', 'safetyPlan.warningSignsidentified', 'safetyPlan.copingStrategies', 'safetyPlan.supportsContacts', 'safetyPlan.crisisNumbers', 'safetyPlan.meansRestriction', 'followUpPlan.monitoring'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

// ─── Defer-save draft store (localStorage) ────────────────────────────────────
// Save stages a local DRAFT only; Approve is the ONLY path that writes to MongoDB.
// Shape: { [recordId]: { [editKey]: {field, value, arrayIndex?} } } — stores each save
// site's EXACT PUT payload (dotted diagnoses.N.x / pharmacological.N.x + arrayIndex).
const DRAFT_KEY = 'psychiatric_treatment_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};
const writeDrafts = (store) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(store)); } catch { /* ignore */ }
};
const stageDraft = (recId, key, payload) => {
  if (!recId) return;
  const store = readDrafts();
  store[recId] = { ...(store[recId] || {}), [key]: payload };
  writeDrafts(store);
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ COMPONENT ═══════ */
const PsychiatricTreatmentPlanDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
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
      if (r?.psychiatric_treatment_plan) return Array.isArray(r.psychiatric_treatment_plan) ? r.psychiatric_treatment_plan : [r.psychiatric_treatment_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_treatment_plan) return Array.isArray(dd.psychiatric_treatment_plan) ? dd.psychiatric_treatment_plan : [dd.psychiatric_treatment_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  /* getFieldValue: supports dot-path like psychotherapy.type */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    const parts = fn.split('.');
    let val = record;
    for (const p of parts) { val = val?.[p]; }
    return val;
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

  /* ═══════ SEARCH — 4-LEVEL ═══════ */
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
        if (Array.isArray(val)) { if (val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (JSON.stringify(val).toLowerCase().includes(phrase)) return true; }
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
      if (Array.isArray(val)) return val.some(item => typeof item === 'object' ? JSON.stringify(item).toLowerCase().includes(phrase) : String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(phrase);
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Psychiatric Treatment Plan ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      // Search values
      const allText = JSON.stringify(record).toLowerCase();
      if (allText.includes(phrase)) return true;
      return false;
    });
  }, [records, searchTerm]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // un-approved draft stays OUT of PDF/Copy All
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fieldPath = m[1];
          const parts = fieldPath.split('.');
          if (parts.length === 1) {
            merged[parts[0]] = localEdits[key];
          } else if (parts.length === 2) {
            merged[parts[0]] = { ...(merged[parts[0]] || {}), [parts[1]]: localEdits[key] };
          }
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // DEFER-SAVE: rehydrate staged drafts on mount so a Save survives refresh (kept OUT of
  // DB/PDF until Approve). Restores pendingEdits + edited markers (so each section's Pending
  // Approve button reappears) and, for simple field drafts, localEdits so the value shows.
  // Approve reads the localStorage draft store directly, so it commits after refresh too.
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const le = {}, pe = {}, ef = {};
    filteredRecords.forEach((rec, idx) => {
      const id = safeId(rec);
      const drafts = id && store[id];
      if (!drafts) return;
      Object.entries(drafts).forEach(([key, p]) => {
        const reKey = `${key.replace(/-\d+$/, '')}-${idx}`;
        pe[reKey] = true;
        ef[reKey] = 'edited';
        if (p && typeof p === 'object' && p.arrayIndex === undefined && 'value' in p) {
          le[reKey] = p.value;
        }
      });
    });
    if (Object.keys(pe).length) {
      setLocalEdits(prev => ({ ...le, ...prev }));
      setPendingEdits(prev => ({ ...pe, ...prev }));
      setEditedFields(prev => ({ ...ef, ...prev }));
    }
  }, [filteredRecords]);

  /* ═══════ EDIT HANDLERS ═══════ */
  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; if (sid) delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${fn}-${idx}`, { field: fn, value: saveVal });
  }, [editValue, safeId]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setApprovedSections(prev => { const n = { ...prev }; if (sid) delete n[`${sid}-${idx}`]; return n; });
      setEditingField(null); setEditValue('');
      stageDraft(id, `${fn}-${idx}`, { field: fn, value: fullText });
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setApprovedSections(prev => { const n = { ...prev }; if (sid) delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${fn}-${idx}`, { field: fn, value: fullText });
  }

  /* ═══════ SAVE OBJECT LEAF (dotted path) ═══════ */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const id = safeId(record); if (!id) return;
    const dottedField = `${rootField}.${path.join('.')}`;
    // DEFER-SAVE: stage a local draft only; Approve commits the dotted leaf to the DB.
    setLocalEdits(prev => {
      const cur = prev[`${rootField}-${idx}`] !== undefined ? prev[`${rootField}-${idx}`] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      return { ...prev, [`${rootField}-${idx}`]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [`${rootField}-${idx}`]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    setEditingField(null); setEditValue('');
    stageDraft(id, `${dottedField}-${idx}`, { field: dottedField, value: newVal });
  }, [safeId]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`) && k.endsWith(`-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const inSection = (k) => fields.some(f => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.includes(`-${idx}`)));
    try {
      // DEFER-SAVE: Approve is the ONLY DB writer — replay this section's staged draft
      // payloads to /edit (dotted diagnoses/pharmacological leaves + arrayIndex), then /approve.
      const store = readDrafts();
      const recordDrafts = store[id] || {};
      const toCommit = Object.entries(recordDrafts).filter(([k]) => inSection(k));
      for (const [, p] of toCommit) {
        const body = { field: p.field, value: p.value };
        if (p.arrayIndex !== undefined) body.arrayIndex = p.arrayIndex;
        await secureApiClient.put(`/api/edit/psychiatric_treatment_plan/${id}/edit`, body);
      }
      await secureApiClient.put(`/api/edit/psychiatric_treatment_plan/${id}/approve`, { sectionId: sid, approved: true });
      if (toCommit.length) {
        const remaining = { ...recordDrafts };
        toCommit.forEach(([k]) => delete remaining[k]);
        if (Object.keys(remaining).length) store[id] = remaining; else delete store[id];
        writeDrafts(store);
      }
      setPendingEdits(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (inSection(k)) delete n[k]; }); return n; });
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); }
  }, [safeId]);

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
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) {
          lines.push(parsed.label + ':');
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else { lines.push(parsed.label + ':'); lines.push(`  ${n++}. ${parsed.value}`); }
      } else { lines.push(`${n++}. ${s}`); }
    });
    return lines;
  }, [splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    if (sid === 'plan-info') {
      if (hasVal(record.date)) text += `Date: ${formatDate(record.date)}\n`;
      if (hasVal(record.type)) text += `Type: ${record.type}\n`;
      if (hasVal(record.provider)) text += `Provider: ${record.provider}\n`;
      if (hasVal(record.facility)) text += `Facility: ${record.facility}\n`;
      if (hasVal(record.status)) text += `Status: ${record.status}\n`;
      text += '\n';
    } else if (sid === 'diagnoses') {
      (record.diagnoses || []).forEach((d, i) => {
        text += `${i + 1}. ${d.diagnosis}\n`;
        if (hasVal(d.icdCode)) text += `   ICD Code: ${d.icdCode}\n`;
        if (d.specifiers?.length > 0) text += `   Specifiers: ${d.specifiers.join(', ')}\n`;
      });
      text += '\n';
    } else if (sid === 'pharmacological') {
      (record.pharmacological || []).forEach((p, i) => {
        text += `${i + 1}. ${p.intervention}\n`;
        if (hasVal(p.rationale)) text += `   Rationale: ${p.rationale}\n`;
        if (hasVal(p.monitoring)) text += `   Monitoring: ${p.monitoring}\n`;
      });
      text += '\n';
    } else if (sid === 'psychotherapy') {
      const ps = record.psychotherapy || {};
      if (hasVal(ps.type)) text += `Type: ${ps.type}\n`;
      if (hasVal(ps.frequency)) text += `Frequency: ${ps.frequency}\n`;
      if (hasVal(ps.provider)) text += `Provider: ${ps.provider}\n`;
      if (ps.goals?.length > 0) { text += 'Goals:\n'; ps.goals.forEach((g, i) => { text += `  ${i + 1}. ${g}\n`; }); }
      text += '\n';
    } else if (sid === 'safety-plan') {
      const sp = record.safetyPlan || {};
      if (sp.warningSignsidentified?.length > 0) { text += 'Warning Signs:\n'; sp.warningSignsidentified.forEach((w, i) => { text += `  ${i + 1}. ${w}\n`; }); }
      if (sp.copingStrategies?.length > 0) { text += 'Coping Strategies:\n'; sp.copingStrategies.forEach((c, i) => { text += `  ${i + 1}. ${c}\n`; }); }
      if (sp.supportsContacts?.length > 0) { text += 'Support Contacts:\n'; sp.supportsContacts.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; }); }
      if (sp.crisisNumbers?.length > 0) { text += 'Crisis Numbers:\n'; sp.crisisNumbers.forEach((n, i) => { text += `  ${i + 1}. ${n}\n`; }); }
      if (sp.meansRestriction?.length > 0) { text += 'Means Restriction:\n'; sp.meansRestriction.forEach((m, i) => { text += `  ${i + 1}. ${m}\n`; }); }
      if (hasVal(sp.childcarePlan)) text += `Childcare Plan: ${sp.childcarePlan}\n`;
      text += '\n';
    } else if (sid === 'follow-up') {
      const fu = record.followUpPlan || {};
      if (hasVal(fu.nextAppointment)) text += `Next Appointment: ${fu.nextAppointment}\n`;
      if (hasVal(fu.frequency)) text += `Frequency: ${fu.frequency}\n`;
      if (fu.monitoring?.length > 0) { text += 'Monitoring:\n'; fu.monitoring.forEach((m, i) => { text += `  ${i + 1}. ${m}\n`; }); }
      text += '\n';
    } else if (sid === 'recommendations') {
      const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
      recs.forEach((rec, i) => { const t = (rec?.recommendation || '').trim(); const d = (rec?.date || '').trim(); if (t) text += `${i + 1}. ${t}${d ? ` (${d})` : ''}\n`; });
      text += '\n';
    } else if (sid === 'results') {
      const walk = (val, indent) => {
        if (isEmptyDeep(val)) return;
        Object.entries(val).forEach(([k, v]) => {
          if (isEmptyDeep(v)) return;
          if (isScalar(v)) { text += `${indent}${humanizeKey(k)}: ${fmtScalar(v)}\n`; }
          else { text += `${indent}${humanizeKey(k)}:\n`; walk(v, indent + '  '); }
        });
      };
      if (record.results && !isScalar(record.results)) walk(record.results, '');
      text += '\n';
    } else {
      const fields = SECTION_FIELDS[sid] || [];
      fields.forEach(f => {
        const label = FIELD_LABELS[f] || f;
        const val = getFieldValue(record, f, idx);
        if (!hasVal(val)) return;
        if (DATE_FIELDS.includes(f)) { text += `${label}: ${formatDate(val)}\n`; }
        else if (ARRAY_FIELDS.includes(f)) { const items = Array.isArray(val) ? val : [val]; text += `${label}:\n${items.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}\n`; }
        else { text += `${label}: ${fmtVal(val)}\n`; }
      });
      text += '\n';
    }
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== PSYCHIATRIC TREATMENT PLAN ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Psychiatric Treatment Plan ${idx + 1}\n${'='.repeat(40)}\n\n`;
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
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: currentArr })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: fn, value: editValue, arrayIndex: itemIdx }); }}>{saving ? 'Saving...' : 'Save'}</button>
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
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(label)}</div>
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentVal2 = String(getFieldValue(record, fn, idx) || ''); const sentences2 = splitBySentence(currentVal2); const s2 = sentences2[sIdx] || ''; const p2 = parseLabel(s2); if (!p2.isLabeled) return; const items2 = splitByComma(p2.value); const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s); if (subParts.length > 1) { items2.splice(ciIdx, 1, ...subParts); } else { items2[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); } const rebuilt = `${p2.label}: ${items2.join(', ')}.`; const allS = [...sentences2]; allS[sIdx] = rebuilt; const fullText2 = reconstructFullText(allS); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText2 })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [commaKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ciIdx + ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); stageDraft(id2, `${fn}-${idx}`, { field: fn, value: fullText2 }); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); stageDraft(safeId(record), `${fn}-${idx}`, { field: fn, value: fullText }); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
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

  /* ═══════ RENDER: DIAGNOSES SECTION (3-level nested with editing) ═══════ */
  const renderDiagnosesSection = (record, idx) => {
    const sid = 'diagnoses';
    const diagnoses = record.diagnoses || [];
    if (diagnoses.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Diagnoses')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {diagnoses.map((d, dIdx) => {
            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const phrase = searchTerm.toLowerCase().trim();
              const diagText = [d.diagnosis, d.icdCode, ...(d.specifiers || [])].filter(Boolean).join(' ').toLowerCase();
              if (!diagText.includes(phrase) && !phrase.includes('diagnos')) return null;
            }

            return (
              <div key={dIdx} className="rec-mini-card">
                {/* Diagnosis name - editable */}
                <div className="nested-subtitle">{highlightText(d.diagnosis)}</div>

                {/* Diagnosis text editing */}
                {(() => {
                  const editKey = `diagnoses.${dIdx}.diagnosis-${idx}`;
                  const isEditing = editingField === editKey;
                  const isModified = editedFields[editKey];
                  return (
                    <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(d.diagnosis || ''); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: `diagnoses.${dIdx}.diagnosis`, value: editValue }); }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText('Diagnosis: ' + (d.diagnosis || ''))}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(d.diagnosis, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                  );
                })()}
                {/* ICD Code */}
                {hasVal(d.icdCode) && (() => {
                  const editKey = `diagnoses.${dIdx}.icdCode-${idx}`;
                  const isEditing = editingField === editKey;
                  const isMod = editedFields[editKey];
                  return (
                    <div className="nested-field-card">
                      <div className="field-label">{highlightText('ICD Code')}</div>
                      <div className={`numbered-row ${isMod ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(d.icdCode); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: `diagnoses.${dIdx}.icdCode`, value: editValue }); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText(d.icdCode)}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(d.icdCode, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {isMod && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </div>
                  );
                })()}

                {/* Specifiers */}
                {d.specifiers?.length > 0 && (() => {
                  return (
                    <div className="nested-field-card">
                      <div className="field-label">{highlightText('Specifiers')}</div>
                      {d.specifiers.map((spec, sIdx) => {
                        const editKey = `diagnoses.${dIdx}.specifiers.${sIdx}-${idx}`;
                        const isEditing = editingField === editKey;
                        const isMod = editedFields[editKey];
                        return (
                          <div key={sIdx}>
                            <div className={`numbered-row ${isMod ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(spec); setSaveError(null); } }}>
                              {isEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: `diagnoses.${dIdx}.specifiers`, value: editValue, arrayIndex: sIdx }); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(spec)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(spec, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {isMod && <span className="modified-badge">edited - click Pending Approve to save</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: PHARMACOLOGICAL SECTION (3-level nested with editing) ═══════ */
  const renderPharmacologicalSection = (record, idx) => {
    const sid = 'pharmacological';
    const pharmacological = record.pharmacological || [];
    if (pharmacological.length === 0) return null;
    if (!shouldShowSection(record, sid)) return null;
    const copyId = `${sid}-${idx}`;

    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Pharmacological Interventions')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {pharmacological.map((p, pIdx) => {
            if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(sid)) {
              const phrase = searchTerm.toLowerCase().trim();
              const pharmaText = [p.intervention, p.rationale, p.monitoring].filter(Boolean).join(' ').toLowerCase();
              if (!pharmaText.includes(phrase) && !phrase.includes('pharma') && !phrase.includes('intervention')) return null;
            }

            const renderNestedEditableField = (fieldName, displayLabel, value) => {
              if (!hasVal(value)) return null;
              const editKey = `pharmacological.${pIdx}.${fieldName}-${idx}`;
              const isEditing = editingField === editKey;
              const isMod = editedFields[editKey];
              return (
                <div className="nested-field-card">
                  <div className="field-label">{highlightText(displayLabel)}</div>
                  <div className={`numbered-row ${isMod ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(value); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: `pharmacological.${pIdx}.${fieldName}`, value: editValue }); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(value)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(value, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {isMod && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            };

            return (
              <div key={pIdx} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(p.intervention)}</div>
                {/* Intervention - editable */}
                {(() => {
                  const editKey = `pharmacological.${pIdx}.intervention-${idx}`;
                  const isEditing = editingField === editKey;
                  const isMod = editedFields[editKey];
                  return (
                    <>
                      <div className={`numbered-row ${isMod ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(p.intervention || ''); setSaveError(null); } }}>
                        {isEditing ? (
                          <div className="edit-field-container">
                            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                            {saveError && <div className="save-error">{saveError}</div>}
                            <div className="edit-actions">
                              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); stageDraft(id, editKey, { field: `pharmacological.${pIdx}.intervention`, value: editValue }); }}>{saving ? 'Saving...' : 'Save'}</button>
                              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="row-content"><span className="content-value">{highlightText('Intervention: ' + (p.intervention || ''))}</span><span className="edit-indicator">&#9998;</span></div>
                            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(p.intervention, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                          </>
                        )}
                      </div>
                      {isMod && <span className="modified-badge">edited - click Pending Approve to save</span>}
                    </>
                  );
                })()}
                {renderNestedEditableField('rationale', 'Rationale', p.rationale)}
                {renderNestedEditableField('monitoring', 'Monitoring', p.monitoring)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT LEAF (editable; number+unit -> number input, text -> textarea, "4/5" stays text) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(editStartValue); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (ratio || nu) ? (
                <div className="number-edit-row">
                  <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                  {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                </div>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => {
                  e.stopPropagation();
                  let newVal;
                  if (isBool) { newVal = editValue === 'yes'; }
                  else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = `${n}/${ratio.denom}`; }
                  else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                  else { newVal = editValue.trim(); }
                  saveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
                }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[leafKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedItems[leafKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: OBJECT (recursive; humanizeKey + nested-mini-card; editable leaves) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  /* ═══════ RENDER: RECOMMENDATIONS — array of {recommendation, date}, date-grouped ═══════ */
  const renderRecommendationsField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showSubLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const phrase = searchTerm.toLowerCase().trim();

    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });

    return (
      <div key={fn} className="rec-mini-card">
        {showSubLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {groups.map((group, gIdx) => {
          const anyVisible = !searchTerm.trim() || phraseMatch || labelMatch || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedSentences[itemKey];
                const itemMatches = phraseMatch || labelMatch || !searchTerm.trim() || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const id2 = safeId(record); if (!id2) return;
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              // DEFER-SAVE: stage a local draft only; Approve commits to the DB.
                              setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: newArr }));
                              setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
                              setEditedSentences(prev => ({ ...prev, [itemKey]: 'edited' }));
                              setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
                              setEditingField(null); setEditValue('');
                              stageDraft(id2, `${fn}-${idx}`, { field: fn, value: newArr });
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">&#9998;</span></div>
                          <button className={`copy-btn ${copiedItems[itemKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedItems[itemKey] ? 'Copied!' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                  </div>
                );
              })}
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
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderStringField(record, f, idx, sid);
            if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(record, f, idx, sid);
            if (OBJECT_FIELDS.includes(f)) return renderObjectField(record, f, idx, sid);
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
      <div className="psychiatric-treatment-plan-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Psychiatric Treatment Plan</h2></div>
        <div className="empty-state">No psychiatric treatment plan records available</div>
      </div>
    );
  }

  return (
    <div className="psychiatric-treatment-plan-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Psychiatric Treatment Plan</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PsychiatricTreatmentPlanDocumentPDFTemplate document={pdfData} />} fileName={`psychiatric-treatment-plan-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search treatment plan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{formatDate(record.date)}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Psychiatric Treatment Plan ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'plan-info')}
            {renderDiagnosesSection(record, idx)}
            {renderSection(record, idx, 'findings')}
            {renderSection(record, idx, 'assessment')}
            {renderPharmacologicalSection(record, idx)}
            {renderSection(record, idx, 'psychotherapy')}
            {renderSection(record, idx, 'support-groups')}
            {renderSection(record, idx, 'lifestyle')}
            {renderSection(record, idx, 'safety-plan')}
            {renderSection(record, idx, 'follow-up')}
            {renderSection(record, idx, 'results')}
            {renderSection(record, idx, 'recommendations')}
            {renderSection(record, idx, 'plan-notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PsychiatricTreatmentPlanDocument;
