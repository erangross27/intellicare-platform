/**
 * AsthmaAssessmentsDocument.jsx
 * Inline editing with per-section approve, bar chart display-only,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AsthmaAssessmentsPDFTemplate from '../pdf-templates/AsthmaAssessmentsPDFTemplate';
import './AsthmaAssessmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'asthma_assessmentsPendingEdits';
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
  assessmentInfo: ['date', 'provider', 'facility', 'asthmaType', 'severity'],
  controlLevel: ['controlLevel'],
  symptoms: ['symptoms', 'symptomFrequency', 'nighttimeAwakenings'],
  exacerbations: ['exacerbations'],
  triggers: ['triggers'],
  spirometry: ['spirometry'],
  rescueInhalerUse: ['rescueInhalerUse'],
  peakFlow: ['peakFlow'],
  medications: ['medications'],
  actionPlan: ['actionPlan'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  asthmaType: 'Asthma Type',
  severity: 'Severity',
  controlLevel: 'Control Level',
  symptoms: 'Symptoms',
  symptomFrequency: 'Symptom Frequency',
  nighttimeAwakenings: 'Nighttime Awakenings',
  exacerbations: 'Exacerbations',
  triggers: 'Triggers',
  spirometry: 'Spirometry',
  rescueInhalerUse: 'Rescue Inhaler Use',
  peakFlow: 'Peak Flow',
  medications: 'Medications',
  actionPlan: 'Action Plan',
  notes: 'Notes',
};

/* Section titles (mirror the hardcoded <h4 className="section-title"> text in the render).
   A section whose title === its single field's FIELD_LABELS entry is a "single-name" section —
   the field's nested-subtitle would just duplicate the section header, so it is suppressed. */
const SECTION_TITLES = {
  assessmentInfo: 'Assessment Information',
  controlLevel: 'Control Level',
  symptoms: 'Symptoms',
  exacerbations: 'Exacerbations',
  triggers: 'Triggers',
  spirometry: 'Spirometry',
  rescueInhalerUse: 'Rescue Inhaler Use',
  peakFlow: 'Peak Flow',
  medications: 'Medications',
  actionPlan: 'Action Plan',
  notes: 'Notes',
};

/* Detect an embedded "Label: value" (e.g. actionPlan "Three-zone action plan based on peak flow: Green Zone >380, ...").
   Requires a space after the colon (so "280 L/min", "0.65:1" never match) and a sane label length. */
const parseLabel = (text) => {
  const s = String(text == null ? '' : text);
  const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s);
  return m ? { label: m[1].trim(), value: m[2].trim() } : null;
};

const ARRAY_FIELDS = ['symptoms', 'triggers', 'medications'];
const DATE_FIELDS = ['date'];

const AsthmaAssessmentsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  // Unwrap data
  const records = useMemo(() => {
    if (!rawDoc) return [];
    if (Array.isArray(rawDoc)) {
      if (rawDoc.length > 0 && rawDoc[0]?.asthma_assessments) {
        return Array.isArray(rawDoc[0].asthma_assessments) ? rawDoc[0].asthma_assessments : [rawDoc[0].asthma_assessments];
      }
      return rawDoc;
    }
    if (rawDoc.asthma_assessments) return Array.isArray(rawDoc.asthma_assessments) ? rawDoc.asthma_assessments : [rawDoc.asthma_assessments];
    if (rawDoc.documentData) {
      const dd = rawDoc.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.asthma_assessments) return Array.isArray(dd.asthma_assessments) ? dd.asthma_assessments : [dd.asthma_assessments];
      return [dd];
    }
    return [rawDoc];
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (record) => {
      const id = record && record._id;
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (id.$oid) return id.$oid;
      return String(id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex"
        const dotIdx = fieldPart.indexOf('.');
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
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateVal); }
  };

  const toInputDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 0 && trimmed.replace(/[.!?;,]+/g, '').trim().length > 0;
    });
  };

  // ===== Score Extraction & Interpretation (display-only) =====
  const extractACTScore = (controlLevel) => {
    if (!controlLevel) return null;
    const match = String(controlLevel).match(/ACT\s*(?:Score\s*)?(\d+)\/(\d+)/i);
    return match ? { value: parseInt(match[1], 10), max: parseInt(match[2], 10) } : null;
  };

  const extractFEV1 = (spirometry) => {
    if (!spirometry) return null;
    const match = String(spirometry).match(/FEV1[:\s]*(\d+(?:\.\d+)?)\s*%/i);
    return match ? { value: parseFloat(match[1]), max: 100 } : null;
  };

  const extractFeNO = (notes) => {
    if (!notes) return null;
    const match = String(notes).match(/FeNO[:\s]*(\d+(?:\.\d+)?)\s*ppb/i);
    return match ? { value: parseFloat(match[1]), unit: 'ppb' } : null;
  };

  const extractEosinophils = (notes) => {
    if (!notes) return null;
    const match = String(notes).match(/Eosinophils[:\s]*(\d+(?:\.\d+)?)\s*(?:cells\/[μu]L)?/i);
    return match ? { value: parseFloat(match[1]), unit: 'cells/μL' } : null;
  };

  const extractIgE = (notes) => {
    if (!notes) return null;
    const match = String(notes).match(/IgE[:\s]*(\d+(?:\.\d+)?)\s*(?:IU\/[mM]L)?/i);
    return match ? { value: parseFloat(match[1]), unit: 'IU/mL' } : null;
  };

  const getACTInterpretation = (score) => {
    if (score >= 20) return { color: '#22c55e', text: 'Well Controlled' };
    if (score >= 16) return { color: '#f59e0b', text: 'Not Well Controlled' };
    return { color: '#ef4444', text: 'Very Poorly Controlled' };
  };

  const getFEV1Interpretation = (percent) => {
    if (percent >= 80) return { color: '#22c55e', text: 'Normal' };
    if (percent >= 60) return { color: '#3b82f6', text: 'Mild Obstruction' };
    if (percent >= 40) return { color: '#f59e0b', text: 'Moderate Obstruction' };
    return { color: '#ef4444', text: 'Severe Obstruction' };
  };

  const getFeNOInterpretation = (value) => {
    if (value < 25) return { color: '#22c55e', text: 'Normal' };
    if (value <= 50) return { color: '#f59e0b', text: 'Elevated' };
    return { color: '#ef4444', text: 'High - Type 2 Inflammation' };
  };

  const getEosinophilsInterpretation = (value) => {
    if (value < 300) return { color: '#22c55e', text: 'Normal' };
    if (value <= 500) return { color: '#f59e0b', text: 'Elevated' };
    return { color: '#ef4444', text: 'High - Eosinophilic Inflammation' };
  };

  const getIgEInterpretation = (value) => {
    if (value < 100) return { color: '#22c55e', text: 'Normal' };
    if (value <= 400) return { color: '#f59e0b', text: 'Elevated' };
    return { color: '#ef4444', text: 'High - Allergic Component' };
  };

  const buildChartData = (record, idx) => {
    const categories = [];
    const controlCharts = [];
    const effectiveControlLevel = getFieldValue(record, 'controlLevel', idx);
    const effectiveSpirometry = getFieldValue(record, 'spirometry', idx);
    const effectiveNotes = getFieldValue(record, 'notes', idx);

    const actScore = extractACTScore(effectiveControlLevel);
    if (actScore) {
      const interp = getACTInterpretation(actScore.value);
      controlCharts.push({
        key: 'act', label: 'ACT Score (Asthma Control)',
        value: `${actScore.value}/${actScore.max}`,
        percentage: Math.round((actScore.value / actScore.max) * 100),
        color: interp.color, interpretation: interp.text,
      });
    }

    const fev1 = extractFEV1(effectiveSpirometry);
    if (fev1) {
      const interp = getFEV1Interpretation(fev1.value);
      controlCharts.push({
        key: 'fev1', label: 'FEV1 (Lung Function)',
        value: `${fev1.value}% predicted`,
        percentage: Math.round(fev1.value),
        color: interp.color, interpretation: interp.text,
      });
    }

    if (controlCharts.length > 0) {
      categories.push({ id: 'control', name: 'Asthma Control & Lung Function', description: 'Pulmonology', charts: controlCharts });
    }

    const biomarkerCharts = [];

    const feno = extractFeNO(effectiveNotes);
    if (feno) {
      const interp = getFeNOInterpretation(feno.value);
      biomarkerCharts.push({
        key: 'feno', label: 'FeNO (Exhaled Nitric Oxide)',
        value: `${feno.value} ppb`,
        percentage: Math.min(Math.round(feno.value), 100),
        color: interp.color, interpretation: interp.text,
      });
    }

    const eos = extractEosinophils(effectiveNotes);
    if (eos) {
      const interp = getEosinophilsInterpretation(eos.value);
      biomarkerCharts.push({
        key: 'eos', label: 'Eosinophils',
        value: `${eos.value} cells/μL`,
        percentage: Math.min(Math.round((eos.value / 1000) * 100), 100),
        color: interp.color, interpretation: interp.text,
      });
    }

    const ige = extractIgE(effectiveNotes);
    if (ige) {
      const interp = getIgEInterpretation(ige.value);
      biomarkerCharts.push({
        key: 'ige', label: 'IgE (Allergy Marker)',
        value: `${ige.value} IU/mL`,
        percentage: Math.min(Math.round((ige.value / 500) * 100), 100),
        color: interp.color, interpretation: interp.text,
      });
    }

    if (biomarkerCharts.length > 0) {
      categories.push({ id: 'biomarkers', name: 'Type 2 Inflammation Biomarkers', description: 'Allergology/Immunology', charts: biomarkerCharts });
    }

    return categories;
  };

  // ===== Edit Helpers =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    const result = original.map((item, itemIdx) => {
      const editKey = `${fieldName}-${idx}-${itemIdx}`;
      return localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    });
    return result;
  }, [localEdits]);

  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // ===== Save Handlers =====
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AsthmaAssessments] Cannot save — no record ID'); return; }

    const newValue = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = editTrackingKey || `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));

    if (sentenceIdx !== undefined && sentenceIdx !== null) {
      const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`;
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      const k = `${sectionId}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });

    // Stage the DRAFT (no DB write). fieldPart = bare field name (non-array path).
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = newValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  const handleSaveDateField = useCallback((record, fieldName, idx, sectionId) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AsthmaAssessments] Cannot save date — no record ID'); return; }

    const isoValue = editValue ? new Date(editValue + 'T00:00:00.000Z').toISOString() : editValue;
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: isoValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => {
      const k = `${sectionId}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = isoValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fieldName, idx, itemIdx) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AsthmaAssessments] Cannot save array item — no record ID'); return; }

    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Array fields map to a section via SECTION_FIELDS; drop that section's approved flag on re-edit.
    setApprovedSections(prev => {
      const sectionId = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fieldName));
      const k = sectionId ? `${sectionId}-${idx}` : null;
      if (!k || !prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });

    // Stage the DRAFT (no DB write). fieldPart = "field.arrayIndex" for array elements.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][`${fieldName}.${itemIdx}`] = editValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    try {
      const recordId = getRecordId(record);
      if (!recordId) return;

      const sectionFields = SECTION_FIELDS[sectionId] || [];
      // Collect this record+section's pending edits. editKey = "field-idx" or "field-idx-itemIdx".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sectionFields.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });

      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        // Determine field + optional arrayIndex by matching against this section's fields.
        const field = sectionFields.find(f => editKey === `${f}-${idx}` || editKey.startsWith(`${f}-${idx}-`));
        if (!field) continue;
        const payload = { field, value: localEdits[editKey] };
        const tail = editKey.slice(`${field}-${idx}`.length); // "" or "-<itemIdx>"
        if (tail.startsWith('-')) {
          const seg = tail.slice(1);
          if (/^\d+$/.test(seg)) payload.arrayIndex = parseInt(seg, 10);
        }
        await secureApiClient.put(`/api/edit/asthma_assessments/${recordId}/edit`, payload);
      }
      // Flag the section approved (audit trail).
      await secureApiClient.put(`/api/edit/asthma_assessments/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage (only this section's fieldParts).
      const store = readDrafts();
      if (store[recordId]) {
        sectionFields.forEach(f => {
          delete store[recordId][f];
          Object.keys(store[recordId]).forEach(fp => {
            if (fp.startsWith(`${f}.`)) delete store[recordId][fp];
          });
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));

      // Clear edit markers for this section
      setEditedFields(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          sectionFields.forEach(f => {
            if (k.startsWith(`${f}-${idx}`)) delete next[k];
          });
        });
        return next;
      });
      setEditedSentences(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          sectionFields.forEach(f => {
            if (k.startsWith(`${f}-${idx}`)) delete next[k];
          });
        });
        return next;
      });
    } catch (err) {
      console.error('[AsthmaAssessments] Approve failed:', err);
    }
  }, [localEdits, pendingEdits]);

  // ===== Sentence Editing Helpers =====
  function reconstructFullText(sentences) {
    return sentences.map((s, i) => {
      const trimmed = s.trim();
      if (i < sentences.length - 1 && !trimmed.match(/[.!?;]$/)) return trimmed + '.';
      return trimmed;
    }).join(' ');
  }

  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx, newSentenceText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);

    const cleanNew = newSentenceText.trim();
    const cleanOld = (currentSentences[sentenceIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cleanNew === cleanOld) {
      setEditingField(null);
      setEditValue('');
      return;
    }

    // If user cleared the sentence (empty or punctuation-only), remove it
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') {
      currentSentences.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(currentSentences);
      const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
      setEditedSentences(prev => ({ ...prev, [editKey]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
      return;
    }

    let newText = cleanNew;
    if (newText && !newText.match(/[.!?;]$/)) newText += '.';
    currentSentences[sentenceIdx] = newText;

    const extraCount = newText.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    const fullText = reconstructFullText(currentSentences);
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditedSentences(prev => {
      const next = { ...prev, [editKey]: 'edited' };
      for (let e = 1; e <= extraCount; e++) {
        next[`${fieldName}-${idx}-s${sentenceIdx + e}`] = 'added';
      }
      return next;
    });

    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ===== Search =====
  const highlightText = (text) => {
    if (!text) return '';
    const str = String(text);
    if (!searchTerm.trim()) return str;
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = str.split(regex);
    if (parts.length === 1) return str;
    return <>{parts.map((p, i) => regex.test(p) ? <mark key={i}>{p}</mark> : p)}</>;
  };

  const phraseMatch = (text, term) => {
    if (!term.trim()) return true;
    return String(text || '').toLowerCase().includes(term.toLowerCase().trim());
  };

  const shouldShowSection = (record, sectionTitle, contentParts) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const combined = [sectionTitle, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' ');
    return phraseMatch(combined, searchTerm);
  };

  const sectionTitleMatches = (sectionTitle) => {
    if (!searchTerm.trim()) return false;
    return phraseMatch(sectionTitle, searchTerm);
  };

  const fieldMatches = (record, fieldName, idx) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const value = getFieldValue(record, fieldName, idx);
    return phraseMatch(label, searchTerm) || phraseMatch(value, searchTerm);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Asthma Assessment ${idx + 1}`;
      const chartData = buildChartData(record, idx);
      const chartText = chartData.flatMap(c => [c.name, c.description, ...c.charts.flatMap(b => [b.label, b.value, b.interpretation])]).join(' ');
      const allText = [
        title, formatDate(record.date),
        record.provider, record.facility, record.asthmaType,
        record.severity, record.controlLevel, record.spirometry,
        record.rescueInhalerUse, record.peakFlow, record.exacerbations,
        record.actionPlan, record.notes,
        record.symptomFrequency, record.nighttimeAwakenings,
        ...(record.symptoms || []), ...(record.triggers || []),
        ...(record.medications || []),
        chartText,
        'Assessment Information', 'Score Overview', 'Control Level',
        'Symptoms', 'Exacerbations', 'Triggers', 'Spirometry',
        'Rescue Inhaler Use', 'Peak Flow', 'Medications', 'Action Plan', 'Notes',
      ].filter(Boolean).join(' ');
      const match = phraseMatch(allText, searchTerm);
      if (match && phraseMatch(title, searchTerm)) {
        record._showAllSections = true;
      }
      return match;
    });
  }, [records, searchTerm]);

  // ===== Section Has Edits & Approve Button =====
  const sectionHasEdits = (idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      return Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
             Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`));
    });
  };

  const renderApproveButton = (idx, sectionId) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];

    // hasEdits MUST be checked BEFORE isApproved
    if (hasEdits) {
      return (
        <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sectionId); }}>
          Pending Approve
        </button>
      );
    }
    if (isApproved) {
      return <span className="approve-btn approved">Approved</span>;
    }
    return null;
  };

  // ===== Render Editable Field (simple) =====
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !localEdits[`${fieldName}-${idx}`]) return null;
    const displayValue = String(value || '');
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    // Single-name section (field label === section title): its nested-subtitle would just duplicate the
    // section header, so suppress it — UNLESS the value embeds a "Label: value", in which case surface
    // that label as the (meaningful) nested-subtitle and show the value below in the mini-card.
    const fieldLabel = FIELD_LABELS[fieldName] || fieldName;
    const isSingleName = (SECTION_TITLES[sectionId] || '') === fieldLabel;
    const parsed = isSingleName ? parseLabel(displayValue) : null;
    const subtitleLabel = parsed ? parsed.label : (isSingleName ? null : fieldLabel);
    const rowText = parsed ? parsed.value : displayValue;
    const editSeed = parsed ? parsed.value : displayValue;
    const buildSaveValue = (v) => (parsed ? `${parsed.label}: ${v}` : v);

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          {subtitleLabel && <div className="nested-subtitle">{highlightText(subtitleLabel)}</div>}
          <div className="edit-field-container">
            <textarea
              className="edit-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId, undefined, buildSaveValue(editValue));
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, undefined, buildSaveValue(editValue))} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        {subtitleLabel && <div className="nested-subtitle">{highlightText(subtitleLabel)}</div>}
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(editSeed); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(rowText)}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Render Date Field (date-picker) =====
  const renderDateField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !localEdits[`${fieldName}-${idx}`]) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>
          <div className="edit-field-container">
            <input
              type="date"
              className="edit-date"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch { /* noop */ } } }}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveDateField(record, fieldName, idx, sectionId)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(toInputDate(value)); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(formatDate(value))}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Render Sentence Editable Field =====
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value) return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId);

    const visibleSentences = sentences.map((s, origIdx) => ({ text: s, _origIdx: origIdx })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName)) return true;
      return phraseMatch(item.text, searchTerm);
    });

    if (visibleSentences.length === 0) return null;

    return (
      <>
        {visibleSentences.map(({ text, _origIdx: sIdx }) => {
          const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const editStatus = editedSentences[sentenceKey];

          if (isEditing) {
            return (
              <div key={sIdx} className="rec-mini-card">
                <div className="edit-field-container">
                  <textarea
                    className="edit-textarea"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx, editValue);
                      if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                    }}
                    autoFocus
                    rows={2}
                    disabled={saving}
                  />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={sIdx} className="rec-mini-card">
              <div
                className={`numbered-row editable-row${editStatus ? ' modified' : ''}`}
                onClick={() => { setEditingField(sentenceKey); setEditValue(text.replace(/[.!?;]+$/, '')); }}
              >
                <div className="row-content">
                  <span className="content-value">{highlightText(text)}</span>
                  {!editStatus && <span className="edit-indicator">✎</span>}
                </div>
              </div>
              {editStatus && (
                <div className={`modified-badge${editStatus === 'added' ? ' added' : ''}`}>
                  {editStatus === 'added' ? 'added' : 'edited - click Pending Approve to save'}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  // ===== Render Editable Array Item =====
  const renderEditableArrayItem = (record, fieldName, idx, sectionId, item, itemIdx) => {
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    const displayValue = localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName) || phraseMatch(displayValue, searchTerm)) {
      // visible
    } else {
      return null;
    }

    if (isEditing) {
      return (
        <div key={itemIdx} className="edit-field-container">
          <textarea
            className="edit-textarea"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fieldName, idx, itemIdx);
              if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
            }}
            autoFocus
            rows={2}
            disabled={saving}
          />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveArrayItem(record, fieldName, idx, itemIdx)} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div
          className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(String(displayValue)); }}
        >
          <div className="row-content">
            <span className="content-value">{highlightText(String(displayValue))}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ===== pdfData Memo =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      // Merge simple/sentence field edits
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldName = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1), 10);
        if (recordIdx === idx && !ARRAY_FIELDS.includes(fieldName) && fieldName in record) {
          merged[fieldName] = localEdits[key];
        }
      });
      // Merge array field edits (committed only — pending array drafts stay OUT until approved)
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        merged[field] = original.map((item, itemIdx) => {
          const editKey = `${field}-${idx}-${itemIdx}`;
          if (localEdits[editKey] !== undefined && !pendingEdits[editKey]) return localEdits[editKey];
          return item;
        });
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ===== Copy =====
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Copy failed:', err); }
  };

  const copySectionText = (record, idx, sectionId) => {
    const pdfRecord = pdfData[idx] || record;
    const fields = SECTION_FIELDS[sectionId] || [];
    let text = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        const arr = Array.isArray(pdfRecord[f]) ? pdfRecord[f] : [];
        if (arr.length > 0) {
          text += `${label}:\n`;
          arr.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
        }
      } else if (DATE_FIELDS.includes(f)) {
        const val = pdfRecord[f];
        if (val) text += `${label}: ${formatDate(val)}\n`;
      } else {
        const val = pdfRecord[f];
        if (val) {
          const sentences = splitBySentence(String(val));
          if (sentences.length > 1) {
            text += `${label}:\n`;
            sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
          } else {
            // single-name section with an embedded "Label: value" → surface the embedded label (no dup)
            const isSingleName = (SECTION_TITLES[sectionId] || '') === label;
            const parsed = isSingleName ? parseLabel(String(val)) : null;
            if (parsed) text += `${parsed.label}:\n  ${parsed.value}\n`;
            else text += `${label}: ${val}\n`;
          }
        }
      }
    });
    copyToClipboard(text.trim(), `section-${sectionId}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== ASTHMA ASSESSMENTS ===\n\n';
    pdfData.forEach((record, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Asthma Assessment ${idx + 1}\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n`;
      text += '\n';

      Object.entries(SECTION_FIELDS).forEach(([sectionId, fields]) => {
        fields.forEach(f => {
          if (DATE_FIELDS.includes(f)) return; // date already printed in header
          const label = FIELD_LABELS[f] || f;
          if (ARRAY_FIELDS.includes(f)) {
            const arr = Array.isArray(record[f]) ? record[f] : [];
            if (arr.length > 0) {
              text += `${label}:\n`;
              arr.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
            }
          } else {
            const val = record[f];
            if (val) {
              const sentences = splitBySentence(String(val));
              if (sentences.length > 1) {
                text += `${label}:\n`;
                sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
              } else {
                // single-name section with an embedded "Label: value" → surface the embedded label (no dup)
                const isSingleName = (SECTION_TITLES[sectionId] || '') === label;
                const parsed = isSingleName ? parseLabel(String(val)) : null;
                if (parsed) text += `${parsed.label}:\n  ${parsed.value}\n`;
                else text += `${label}: ${val}\n`;
              }
            }
          }
        });
      });

      // Chart data
      const chartData = buildChartData(record, idx);
      if (chartData.length > 0) {
        text += '\nScore Overview:\n';
        chartData.forEach(cat => {
          text += `  ${cat.name}:\n`;
          cat.charts.forEach(c => { text += `    ${c.label}: ${c.value} - ${c.interpretation}\n`; });
        });
      }
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // ===== Render =====
  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <article className="asthma-assessments-document">
        <header className="document-header">
          <h1 className="document-title">Asthma Assessments</h1>
        </header>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="empty-state">No asthma assessment data available.</div>
      </article>
    );
  }

  return (
    <article className="asthma-assessments-document">
      <header className="document-header">
        <h1 className="document-title">Asthma Assessments</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink document={<AsthmaAssessmentsPDFTemplate document={pdfData} />} fileName="Asthma_Assessments.pdf">
            {({ loading }) => (
              <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </header>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const chartData = buildChartData(record, idx);
          const isSearching = searchTerm.trim().length > 0;

          return (
            <div key={idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="record-meta-row">
                  {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
                </div>
                <div className="record-title-row">
                  <h3 className="record-name">{highlightText(`Asthma Assessment ${idx + 1}`)}</h3>
                </div>
              </div>

              {/* Assessment Information */}
              {(() => {
                if (!shouldShowSection(record, 'Assessment Information', [formatDate(getFieldValue(record, 'date', idx)), record.provider, record.facility, record.asthmaType, record.severity].filter(Boolean))) return null;
                const stm = sectionTitleMatches('Assessment Information');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Assessment Information')}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn${copiedId === `section-assessmentInfo-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'assessmentInfo')}>
                            {copiedId === `section-assessmentInfo-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveButton(idx, 'assessmentInfo')}
                        </div>
                      </div>
                      {(showAll || fieldMatches(record, 'date', idx)) && renderDateField(record, 'date', idx, 'assessmentInfo')}
                      {(showAll || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'assessmentInfo')}
                      {(showAll || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'assessmentInfo')}
                      {(showAll || fieldMatches(record, 'asthmaType', idx)) && renderEditableField(record, 'asthmaType', idx, 'assessmentInfo')}
                      {(showAll || fieldMatches(record, 'severity', idx)) && renderEditableField(record, 'severity', idx, 'assessmentInfo')}
                    </div>
                  </div>
                );
              })()}

              {/* Score Overview — display-only bar charts */}
              {chartData.length > 0 && shouldShowSection(record, 'Score Overview', chartData.flatMap(c => c.charts.map(b => `${b.label} ${b.value}`))) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Score Overview')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-scoreOverview-${idx}` ? ' copied' : ''}`} onClick={() => {
                          let text = 'Score Overview:\n';
                          chartData.forEach(cat => {
                            text += `\n${cat.name}:\n`;
                            cat.charts.forEach(c => { text += `  ${c.label}: ${c.value} - ${c.interpretation}\n`; });
                          });
                          copyToClipboard(text.trim(), `section-scoreOverview-${idx}`);
                        }}>
                          {copiedId === `section-scoreOverview-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                      </div>
                    </div>
                    {chartData.map(category => (
                      <div key={category.id} className="chart-category">
                        <div className="category-header">
                          <span className="category-name">{highlightText(category.name)}</span>
                          <span className="category-description">{highlightText(category.description)}</span>
                        </div>
                        {category.charts.map(chart => (
                          <div key={chart.key} className="bar-chart-row">
                            <div className="bar-label">{highlightText(chart.label)}</div>
                            <div className="bar-container">
                              <div className="bar-background">
                                <div className="bar-fill" style={{ width: `${chart.percentage}%`, backgroundColor: chart.color }} />
                              </div>
                              <span className="bar-value" style={{ color: chart.color }}>{highlightText(chart.value)}</span>
                            </div>
                            <span className="bar-interpretation" style={{ color: chart.color }}>{highlightText(chart.interpretation)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Control Level */}
              {getFieldValue(record, 'controlLevel', idx) && shouldShowSection(record, 'Control Level', [getFieldValue(record, 'controlLevel', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Control Level')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-controlLevel-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'controlLevel')}>
                          {copiedId === `section-controlLevel-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'controlLevel')}
                      </div>
                    </div>
                    {renderEditableField(record, 'controlLevel', idx, 'controlLevel')}
                  </div>
                </div>
              )}

              {/* Symptoms (array) */}
              {(() => {
                const effectiveArr = getEffectiveArray(record, 'symptoms', idx);
                const symptomFrequency = getFieldValue(record, 'symptomFrequency', idx);
                const nighttimeAwakenings = getFieldValue(record, 'nighttimeAwakenings', idx);
                const hasArr = effectiveArr && effectiveArr.length > 0;
                if (!hasArr && !symptomFrequency && !nighttimeAwakenings) return null;
                if (!shouldShowSection(record, 'Symptoms', [...(effectiveArr || []), symptomFrequency, nighttimeAwakenings].filter(Boolean))) return null;
                const stm = sectionTitleMatches('Symptoms');
                const showAll = !searchTerm.trim() || record._showAllSections || stm;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Symptoms')}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn${copiedId === `section-symptoms-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'symptoms')}>
                            {copiedId === `section-symptoms-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveButton(idx, 'symptoms')}
                        </div>
                      </div>
                      {hasArr && effectiveArr.map((item, itemIdx) => renderEditableArrayItem(record, 'symptoms', idx, 'symptoms', item, itemIdx))}
                      {(showAll || fieldMatches(record, 'symptomFrequency', idx)) && renderEditableField(record, 'symptomFrequency', idx, 'symptoms')}
                      {(showAll || fieldMatches(record, 'nighttimeAwakenings', idx)) && renderEditableField(record, 'nighttimeAwakenings', idx, 'symptoms')}
                    </div>
                  </div>
                );
              })()}

              {/* Exacerbations (sentence) */}
              {getFieldValue(record, 'exacerbations', idx) && shouldShowSection(record, 'Exacerbations', [getFieldValue(record, 'exacerbations', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Exacerbations')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-exacerbations-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'exacerbations')}>
                          {copiedId === `section-exacerbations-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'exacerbations')}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'exacerbations', idx, 'exacerbations')}
                  </div>
                </div>
              )}

              {/* Triggers (array) */}
              {(() => {
                const effectiveArr = getEffectiveArray(record, 'triggers', idx);
                if (!effectiveArr || effectiveArr.length === 0) return null;
                if (!shouldShowSection(record, 'Triggers', effectiveArr)) return null;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Triggers')}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn${copiedId === `section-triggers-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'triggers')}>
                            {copiedId === `section-triggers-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveButton(idx, 'triggers')}
                        </div>
                      </div>
                      {effectiveArr.map((item, itemIdx) => renderEditableArrayItem(record, 'triggers', idx, 'triggers', item, itemIdx))}
                    </div>
                  </div>
                );
              })()}

              {/* Spirometry (sentence) */}
              {getFieldValue(record, 'spirometry', idx) && shouldShowSection(record, 'Spirometry', [getFieldValue(record, 'spirometry', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Spirometry')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-spirometry-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'spirometry')}>
                          {copiedId === `section-spirometry-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'spirometry')}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'spirometry', idx, 'spirometry')}
                  </div>
                </div>
              )}

              {/* Rescue Inhaler Use */}
              {getFieldValue(record, 'rescueInhalerUse', idx) && shouldShowSection(record, 'Rescue Inhaler Use', [getFieldValue(record, 'rescueInhalerUse', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Rescue Inhaler Use')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-rescueInhalerUse-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'rescueInhalerUse')}>
                          {copiedId === `section-rescueInhalerUse-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'rescueInhalerUse')}
                      </div>
                    </div>
                    {renderEditableField(record, 'rescueInhalerUse', idx, 'rescueInhalerUse')}
                  </div>
                </div>
              )}

              {/* Peak Flow */}
              {getFieldValue(record, 'peakFlow', idx) && shouldShowSection(record, 'Peak Flow', [getFieldValue(record, 'peakFlow', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Peak Flow')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-peakFlow-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'peakFlow')}>
                          {copiedId === `section-peakFlow-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'peakFlow')}
                      </div>
                    </div>
                    {renderEditableField(record, 'peakFlow', idx, 'peakFlow')}
                  </div>
                </div>
              )}

              {/* Medications (array) */}
              {(() => {
                const effectiveArr = getEffectiveArray(record, 'medications', idx);
                if (!effectiveArr || effectiveArr.length === 0) return null;
                if (!shouldShowSection(record, 'Medications', effectiveArr)) return null;
                return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <h4 className="section-title">{highlightText('Medications')}</h4>
                        <div className="header-right-actions">
                          <button className={`copy-btn${copiedId === `section-medications-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'medications')}>
                            {copiedId === `section-medications-${idx}` ? 'Copied' : 'Copy Section'}
                          </button>
                          {renderApproveButton(idx, 'medications')}
                        </div>
                      </div>
                      {effectiveArr.map((item, itemIdx) => renderEditableArrayItem(record, 'medications', idx, 'medications', item, itemIdx))}
                    </div>
                  </div>
                );
              })()}

              {/* Action Plan (sentence) */}
              {getFieldValue(record, 'actionPlan', idx) && shouldShowSection(record, 'Action Plan', [getFieldValue(record, 'actionPlan', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Action Plan')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-actionPlan-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'actionPlan')}>
                          {copiedId === `section-actionPlan-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'actionPlan')}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'actionPlan', idx, 'actionPlan')}
                  </div>
                </div>
              )}

              {/* Notes (sentence) */}
              {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)]) && (
                <div className="section">
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Notes')}</h4>
                      <div className="header-right-actions">
                        <button className={`copy-btn${copiedId === `section-notes-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, 'notes')}>
                          {copiedId === `section-notes-${idx}` ? 'Copied' : 'Copy Section'}
                        </button>
                        {renderApproveButton(idx, 'notes')}
                      </div>
                    </div>
                    {renderSentenceEditableField(record, 'notes', idx, 'notes')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
};

export default AsthmaAssessmentsDocument;
