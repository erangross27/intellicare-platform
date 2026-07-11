/**
 * ClinicalTrialDocumentsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: clinical_trial_documents
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ClinicalTrialDocumentsPDFTemplate from '../pdf-templates/ClinicalTrialDocumentsPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ClinicalTrialDocumentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value may be a scalar string or an array) */
const DRAFT_KEY = 'clinical_trial_documentsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  protocol: 'Protocol Overview',
  primaryEndpoint: 'Primary Endpoint',
  secondaryEndpoints: 'Secondary Endpoints',
  inclusion: 'Inclusion Criteria',
  exclusion: 'Exclusion Criteria',
  product: 'Investigational Product',
  concomitant: 'Concomitant Medications',
  randomization: 'Randomization',
  adverseEvents: 'Adverse Events',
  seriousAdverse: 'Serious Adverse Events',
  deviations: 'Protocol Deviations',
  biomarkers: 'Biomarker Levels',
  efficacy: 'Efficacy Measures',
  qualityOfLife: 'Quality of Life',
  monitoring: 'Data Monitoring',
  statistics: 'Statistical Analysis Plan',
  regulatory: 'Regulatory Submissions',
  status: 'Study Status',
};

const FIELD_LABELS = {
  protocolNumber: 'Protocol Number', studyPhase: 'Study Phase', studyCompletionStatus: 'Completion Status', performanceStatus: 'Performance Status',
  primaryEndpoint: 'Primary Endpoint', investigationalProduct: 'Investigational Product', dosageRegimen: 'Dosage Regimen',
  randomizationMethod: 'Randomization Method', dataMonitoringCommittee: 'Data Monitoring Committee',
  withdrawalReason: 'Withdrawal Reason', statisticalAnalysisPlan: 'Statistical Analysis Plan',
  secondaryEndpoints: 'Secondary Endpoints', inclusionCriteria: 'Inclusion Criteria', exclusionCriteria: 'Exclusion Criteria',
  adverseEvents: 'Adverse Events', seriousAdverseEvents: 'Serious Adverse Events', concomitantMedications: 'Concomitant Medications',
  biomarkerLevels: 'Biomarker Levels', efficacyMeasures: 'Efficacy Measures', qualityOfLifeScores: 'Quality of Life Scores',
  protocolDeviations: 'Protocol Deviations', regulatorySubmissions: 'Regulatory Submissions',
};

const SECTION_FIELDS = {
  protocol: ['protocolNumber', 'studyPhase', 'studyCompletionStatus', 'performanceStatus'],
  primaryEndpoint: ['primaryEndpoint'],
  secondaryEndpoints: ['secondaryEndpoints'],
  inclusion: ['inclusionCriteria'],
  exclusion: ['exclusionCriteria'],
  product: ['investigationalProduct', 'dosageRegimen'],
  concomitant: ['concomitantMedications'],
  randomization: ['randomizationMethod'],
  adverseEvents: ['adverseEvents'],
  seriousAdverse: ['seriousAdverseEvents'],
  deviations: ['protocolDeviations'],
  biomarkers: ['biomarkerLevels'],
  efficacy: ['efficacyMeasures'],
  qualityOfLife: ['qualityOfLifeScores'],
  monitoring: ['dataMonitoringCommittee'],
  statistics: ['statisticalAnalysisPlan'],
  regulatory: ['regulatorySubmissions'],
  status: ['withdrawalReason'],
};

const ARRAY_FIELDS = ['secondaryEndpoints', 'inclusionCriteria', 'exclusionCriteria', 'adverseEvents', 'seriousAdverseEvents', 'concomitantMedications', 'biomarkerLevels', 'efficacyMeasures', 'qualityOfLifeScores', 'protocolDeviations', 'regulatorySubmissions'];
const LABEL_ARRAY_FIELDS = ['efficacyMeasures', 'qualityOfLifeScores', 'regulatorySubmissions', 'seriousAdverseEvents'];
// dosageRegimen included: semicolon-separated multi-part regimens (expansion; infusion schedule; delivery route)
const SENTENCE_FIELDS = ['primaryEndpoint', 'investigationalProduct', 'dosageRegimen', 'randomizationMethod', 'dataMonitoringCommittee', 'statisticalAnalysisPlan', 'withdrawalReason'];
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Fixed-choice fields → dropdown (unmatched current value kept as an extra option).
const ENUM_FIELDS = {
  studyPhase: ['Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', 'Phase III', 'Phase IV'],
  studyCompletionStatus: ['Enrolled', 'Ongoing', 'Completed', 'Withdrawn'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const ClinicalTrialDocumentsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.clinical_trial_documents) return Array.isArray(r.clinical_trial_documents) ? r.clinical_trial_documents : [r.clinical_trial_documents];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_trial_documents) return Array.isArray(dd.clinical_trial_documents) ? dd.clinical_trial_documents : [dd.clinical_trial_documents]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = safeId(record);
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
  }, [records, safeId]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
      else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sectionId) => { if (!searchTerm.trim()) return false; const phrase = searchTerm.toLowerCase().trim(); const title = (SECTION_TITLES[sectionId] || '').toLowerCase(); return title.includes(phrase) || phrase.includes(title); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Clinical Trial Documents ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const mt = key.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[key]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    const isArray = ARRAY_FIELDS.includes(fn);
    let stagedValue;
    if (isArray) {
      const arrMatch = editingField?.match(/-ai(\d+)$/); const ai = arrMatch ? parseInt(arrMatch[1]) : null;
      if (ai === null) return;
      const arr = [...(getEffectiveArray(record, fn, idx))]; arr[ai] = editValue;
      stagedValue = arr;
      setLocalEdits(prev => ({ ...prev, [editKey]: arr }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited', [`${fn}-${idx}-ai${ai}`]: 'edited' }));
    } else {
      stagedValue = editValue;
      setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = stagedValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editingField, editValue, safeId, getEffectiveArray]);

  // Save = stage a DRAFT locally (full reconstructed text) + localStorage. NO DB write until Approve.
  const stageDraft = (record, fn, idx, sid, fullText) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
  };

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageDraft(record, fn, idx, sid, fullText); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageDraft(record, fn, idx, sid, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldName = k.slice(0, -suffix.length);
        return fields.includes(fieldName);
      });
      for (const editKey of toCommit) {
        const fieldName = editKey.slice(0, -suffix.length);
        const value = localEdits[editKey];
        if (Array.isArray(value)) {
          // Whole-array drafts: persist each element with arrayIndex.
          for (let ai = 0; ai < value.length; ai++) {
            const resp = await secureApiClient.put(`/api/edit/clinical_trial_documents/${id}/edit`, { field: fieldName, value: value[ai], arrayIndex: ai });
            if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
          }
        } else {
          const resp = await secureApiClient.put(`/api/edit/clinical_trial_documents/${id}/edit`, { field: fieldName, value });
          if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        }
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/clinical_trial_documents/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { fields.forEach(f => { delete store[id][f]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[ClinicalTrialDocs] Approve error:', err); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const splitByComma = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const parts = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0 && i + 1 < text.length && text[i + 1] === ' ') {
        parts.push(current.trim()); current = ''; i++; continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
  }, []);

  // Label arrays → parsed item: label + DASH + numbered comma rows; plain items continue a running count
  // (numbering restarts only at labeled groups). Dash-label items: header row + labeled sub-groups.
  const formatArrayForCopy = useCallback((val, isLabelArray) => {
    let text = ''; let running = 0;
    if (!Array.isArray(val)) return text;
    val.forEach((item) => {
      const itemStr = String(item);
      if (isLabelArray) {
        const dashParts = itemStr.includes(' - ') ? itemStr.split(' - ') : null;
        const hasDashLabels = dashParts && dashParts.length > 1 && dashParts.slice(1).some(p => parseLabel(p));
        if (hasDashLabels) {
          text += `${dashParts[0]}\n${COPY_LINE_DASH}\n`;
          dashParts.slice(1).forEach(dp => { const p = parseLabel(dp); if (p) { text += `${p.label}\n${COPY_LINE_DASH}\n`; splitByComma(p.content).forEach((ci, i) => { text += `${i + 1}. ${ci}\n`; }); } else { text += `${++running}. ${dp}\n`; } });
          text += '\n'; running = 0;
          return;
        }
        const parsed = parseLabel(itemStr);
        if (parsed) { text += `${parsed.label}\n${COPY_LINE_DASH}\n`; splitByComma(parsed.content).forEach((ci, i) => { text += `${i + 1}. ${ci}\n`; }); text += '\n'; running = 0; return; }
        text += `${++running}. ${itemStr}\n`;
      } else { text += `${++running}. ${itemStr}\n`; }
    });
    return text;
  }, [splitByComma]);

  // Sentence field → labeled sentences become label + DASH + numbered comma rows (restart);
  // plain sentences continue the running count. Mirrors the JSX groups exactly.
  const formatSentencesForCopy = useCallback((val) => {
    let text = ''; let running = 0;
    splitBySentence(fmtVal(val)).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed) {
        text += `${parsed.label}\n${COPY_LINE_DASH}\n`;
        const items = splitByComma(parsed.content);
        (items.length ? items : [parsed.content]).forEach((ci, i) => { text += `${i + 1}. ${ci}\n`; });
        running = 0;
        return;
      }
      text += `${++running}. ${s}\n`;
    });
    return text;
  }, [splitBySentence, fmtVal, splitByComma]);

  // One field → sub-label + DASH (hidden when label == section title) + numbered/mirrored rows.
  const emitCopyField = useCallback((f, val, title) => {
    const label = FIELD_LABELS[f] || f;
    let t = '';
    const showLabel = label.toLowerCase() !== (title || '').toLowerCase();
    if (Array.isArray(val)) {
      if (LABEL_ARRAY_FIELDS.includes(f)) { return formatArrayForCopy(val, true); }
      if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
      val.forEach((item, i) => { t += `${i + 1}. ${item}\n`; });
      return t + '\n';
    }
    if (SENTENCE_FIELDS.includes(f)) {
      if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
      return t + formatSentencesForCopy(val) + '\n';
    }
    if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
    return t + `1. ${fmtVal(val)}\n\n`;
  }, [fmtVal, formatArrayForCopy, formatSentencesForCopy]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { const val = getFieldValue(record, f, idx); if (!hasVal(val)) return; text += emitCopyField(f, val, title); });
    return text;
  }, [getFieldValue, hasVal, emitCopyField]);

  const copyAllText = useCallback(async () => {
    let text = `CLINICAL TRIAL DOCUMENTS\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => { text += `Clinical Trial Documents ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => hasVal(r[f])); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${COPY_LINE_EQ}\n\n`;
        fields.forEach(f => { const val = r[f]; if (!hasVal(val)) return; text += emitCopyField(f, val, SECTION_TITLES[sid]); });
      }); text += '\n';
    });
    const ok = await copyToClipboard(text.trim()); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, emitCopyField]);

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    // Fixed-choice fields (studyPhase, studyCompletionStatus) edit as an enum dropdown.
    const enumOpts = ENUM_FIELDS[fn] ? enumOptionsWith(ENUM_FIELDS[fn], displayVal) : null;
    const startVal = enumOpts ? (enumOpts.find(o => o.toLowerCase() === displayVal.toLowerCase()) || displayVal) : displayVal;
    return (<div key={fn}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(startVal); } }}>{isEditing ? (<div className="edit-field-container">{enumOpts ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>{enumOpts.map(o => <option key={o} value={o}>{o}</option>)}</select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (<div key={fn}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="rec-mini-card">{sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
      const sentenceMatches = phraseMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!sentenceMatches && searchTerm.trim()) return null;
      const parsed = parseLabel(sentence);
      if (parsed) {
        // Labeled sentence → ALWAYS a nested-subtitle group, even with a single content row
        // ("Dual delivery: IV infusion (70%) + ..." must never render as a flat "Label: value" row).
        const commaItems = splitByComma(parsed.content);
        if (commaItems.length >= 1) {
          return (<div key={sIdx} className="rec-mini-card">
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {commaItems.map((ci, ciIdx) => {
              const commaKey = `${sentenceKey}-c${ciIdx}`;
              return (<div key={ciIdx}>
                <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== sentenceKey) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>);
            })}
            {isEditing && (<div className="edit-field-container" style={{ marginTop: 8 }}><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>)}
            {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
          </div>);
        }
      }
      const noLabelCommaItems = splitByComma(sentence);
      if (noLabelCommaItems.length > 1) {
        return (<div key={sIdx}>
          {noLabelCommaItems.map((ci, ciIdx) => {
            const commaKey = `${sentenceKey}-c${ciIdx}`;
            return (<div key={ciIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (editingField !== sentenceKey) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
                <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div>
                <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>);
          })}
          {isEditing && (<div className="edit-field-container" style={{ marginTop: 8 }}><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>)}
          {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
        </div>);
      }
      return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  const renderArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (<div key={fn}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="rec-mini-card">{arr.map((item, ai) => { const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey]; const itemMatches = phraseMatch || (searchTerm.trim() && String(item).toLowerCase().includes(searchTerm.toLowerCase().trim())); if (!itemMatches && searchTerm.trim()) return null; return (<div key={ai}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(String(item)); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(String(item))}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(String(item), editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>); })}</div></div>);
  };

  const renderLabelArraySection = (record, fn, idx, sid, title) => {
    const arr = getEffectiveArray(record, fn, idx); if (arr.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== title.toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    return (<div key={fn}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="rec-mini-card">{arr.map((item, ai) => {
      const editKey = `${fn}-${idx}-ai${ai}`; const isEditing = editingField === editKey; const badge = editedFields[editKey];
      const itemStr = String(item);
      const itemMatches = phraseMatch || (searchTerm.trim() && itemStr.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!itemMatches && searchTerm.trim()) return null;

      const dashParts = itemStr.includes(' - ') ? itemStr.split(' - ') : null;
      const hasDashLabels = dashParts && dashParts.length > 1 && dashParts.slice(1).some(p => parseLabel(p));

      if (hasDashLabels) {
        const showMainRow = !searchTerm.trim() || record._showAllSections || phraseMatch || dashParts[0].toLowerCase().includes(searchTerm.toLowerCase().trim());
        return (<div key={ai}>
          {showMainRow && <div className="numbered-row editable-row" onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); } }}>
            <div className="row-content"><span className="content-value">{highlightText(dashParts[0])}</span><span className="edit-indicator">✎</span></div>
            <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
          </div>}
          {dashParts.slice(1).map((dp, dpi) => {
            const dpParsed = parseLabel(dp);
            if (dpParsed) {
              if (searchTerm.trim() && !record._showAllSections && !phraseMatch) {
                const phrase = searchTerm.toLowerCase().trim();
                if (!dpParsed.label.toLowerCase().includes(phrase) && !dpParsed.content.toLowerCase().includes(phrase)) return null;
              }
              const commaItems = splitByComma(dpParsed.content);
              return (<div key={dpi} className="rec-mini-card" style={{ marginTop: 10 }}>
                <div className="nested-subtitle">{highlightText(dpParsed.label)}</div>
                {commaItems.map((ci, ciIdx) => (
                  <div key={ciIdx} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(ci)}</span></div></div>
                ))}
              </div>);
            }
            if (searchTerm.trim() && !record._showAllSections && !phraseMatch && !dp.toLowerCase().includes(searchTerm.toLowerCase().trim())) return null;
            return (<div key={dpi} className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(dp)}</span></div></div>);
          })}
          {isEditing && (<div className="edit-field-container" style={{ marginTop: 8 }}><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>)}
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>);
      }

      const parsed = parseLabel(itemStr);
      const displayVal = parsed ? parsed.content : itemStr;
      const editVal = parsed ? parsed.content : itemStr;
      return (<div key={ai} className={parsed ? 'rec-mini-card' : ''}>
        {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(editVal); } }}>
          {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const saveVal = parsed ? `${parsed.label}: ${editValue}` : editValue; const id = safeId(record); if (!id) return; const ai2 = ai; const a = [...getEffectiveArray(record, fn, idx)]; a[ai2] = saveVal; const editKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [editKey]: a })); setPendingEdits(prev => ({ ...prev, [editKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited', [`${fn}-${idx}-ai${ai2}`]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = a; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
          ) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}
        </div>
        {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
      </div>);
    })}</div></div>);
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || []; const hasAnyVal = fields.some(f => { if (ARRAY_FIELDS.includes(f)) return getEffectiveArray(record, f, idx).length > 0; return hasVal(getFieldValue(record, f, idx)); }); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (LABEL_ARRAY_FIELDS.includes(f)) return renderLabelArraySection(record, f, idx, sid, title); if (ARRAY_FIELDS.includes(f)) return renderArraySection(record, f, idx, sid, title); if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="clinical-trial-documents-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Clinical Trial Documents</h2></div><div className="empty-state">No clinical trial documents available</div></div>);

  return (
    <div className="clinical-trial-documents-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Clinical Trial Documents</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ClinicalTrialDocumentsPDFTemplate document={pdfData} />} fileName="Clinical_Trial_Documents.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search clinical trial documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div><h3 className="record-name">{highlightText(`Clinical Trial Documents ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'protocol')}
            {renderMixedSection(record, idx, 'primaryEndpoint')}
            {renderMixedSection(record, idx, 'secondaryEndpoints')}
            {renderMixedSection(record, idx, 'inclusion')}
            {renderMixedSection(record, idx, 'exclusion')}
            {renderMixedSection(record, idx, 'product')}
            {renderMixedSection(record, idx, 'concomitant')}
            {renderMixedSection(record, idx, 'randomization')}
            {renderMixedSection(record, idx, 'adverseEvents')}
            {renderMixedSection(record, idx, 'seriousAdverse')}
            {renderMixedSection(record, idx, 'deviations')}
            {renderMixedSection(record, idx, 'biomarkers')}
            {renderMixedSection(record, idx, 'efficacy')}
            {renderMixedSection(record, idx, 'qualityOfLife')}
            {renderMixedSection(record, idx, 'monitoring')}
            {renderMixedSection(record, idx, 'statistics')}
            {renderMixedSection(record, idx, 'regulatory')}
            {renderMixedSection(record, idx, 'status')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClinicalTrialDocumentsDocument;
