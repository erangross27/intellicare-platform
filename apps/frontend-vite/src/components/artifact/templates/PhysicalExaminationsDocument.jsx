/* PhysicalExaminationsDocument.jsx - February 2026 REBUILD */
/* Blue theme | Comfortaa font | Mini-card pattern | 4-level search | Per-sentence editing */
/* Per-section approve: yellow Pending Approve -> green Approved */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import PhysicalExaminationsDocumentPDFTemplate from '../pdf-templates/PhysicalExaminationsDocumentPDFTemplate';
import './PhysicalExaminationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" here; no array fields) */
const DRAFT_KEY = 'physical_examinationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* Copy dividers — canonical '='×40 under titles, '-'×40 under sub-labels/sections */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const PhysicalExaminationsDocument = ({ document: docProp, data, templateData: tplData }) => {
  const templateData = docProp || data || tplData;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state — per-template isolation (NO shared hooks)
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ========================= DATA UNWRAPPING =========================

  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (templateData?.physical_examinations) {
      const pe = templateData.physical_examinations;
      return Array.isArray(pe) ? pe : [pe];
    }
    return [templateData];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [unwrappedData]);

  // ========================= HELPERS =========================

  const formatDate = useCallback((dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  }, []);

  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // ========================= PARSERS =========================

  // splitBySentence — canonical: split on [.;]+whitespace, guard abbreviations + single-letter initials
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])[.;](?:\s+)/)
      .map(s => s.replace(/[.;]+$/, '').trim())
      .filter(s => s && !/^[;.,!?]+$/.test(s));
  };

  // parseLabel — detect "Label: Value" in a single sentence
  const parseLabel = (sentence) => {
    if (!sentence || typeof sentence !== 'string') return { label: '', value: sentence || '', isLabeled: false };
    const match = sentence.match(/^([^:]+?):\s*(.+)$/s);
    if (match && match[1].trim().length < 60) {
      return { label: match[1].trim(), value: match[2].trim(), isLabeled: true };
    }
    return { label: '', value: sentence, isLabeled: false };
  };

  // parseVitalSigns — extract structured data for bar chart visualization
  const parseVitalSigns = (text) => {
    if (!text || typeof text !== 'string') return [];
    const vitals = [];

    const bpMatch = text.match(/BP[:\s]*(\d+)\/(\d+)\s*mmHg/i);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1], 10);
      const diastolic = parseInt(bpMatch[2], 10);
      vitals.push({
        key: 'systolic', label: 'Systolic Blood Pressure', value: systolic,
        displayValue: `${systolic} mmHg`,
        percentage: Math.min(100, (systolic / 200) * 100),
        color: systolic >= 180 ? '#ef4444' : systolic >= 140 ? '#f59e0b' : systolic >= 120 ? '#3b82f6' : '#22c55e',
        interpretation: systolic >= 180 ? 'Critical' : systolic >= 140 ? 'Stage 2 HTN' : systolic >= 120 ? 'Elevated' : 'Normal',
        reference: '<120 mmHg (Normal)'
      });
      vitals.push({
        key: 'diastolic', label: 'Diastolic Blood Pressure', value: diastolic,
        displayValue: `${diastolic} mmHg`,
        percentage: Math.min(100, (diastolic / 120) * 100),
        color: diastolic >= 120 ? '#ef4444' : diastolic >= 90 ? '#f59e0b' : diastolic >= 80 ? '#3b82f6' : '#22c55e',
        interpretation: diastolic >= 120 ? 'Critical' : diastolic >= 90 ? 'Stage 2 HTN' : diastolic >= 80 ? 'Elevated' : 'Normal',
        reference: '<80 mmHg (Normal)'
      });
    }

    const hrMatch = text.match(/HR[:\s]*(\d+)\s*bpm/i);
    if (hrMatch) {
      const hr = parseInt(hrMatch[1], 10);
      vitals.push({
        key: 'hr', label: 'Heart Rate', value: hr,
        displayValue: `${hr} bpm`,
        percentage: Math.min(100, (hr / 150) * 100),
        color: hr > 100 ? '#f59e0b' : hr < 60 ? '#3b82f6' : '#22c55e',
        interpretation: hr > 100 ? 'Tachycardia' : hr < 60 ? 'Bradycardia' : 'Normal',
        reference: '60-100 bpm (Normal)'
      });
    }

    const rrMatch = text.match(/RR[:\s]*(\d+)/i);
    if (rrMatch) {
      const rr = parseInt(rrMatch[1], 10);
      vitals.push({
        key: 'rr', label: 'Respiratory Rate', value: rr,
        displayValue: `${rr} /min`,
        percentage: Math.min(100, (rr / 30) * 100),
        color: rr > 20 ? '#f59e0b' : rr < 12 ? '#3b82f6' : '#22c55e',
        interpretation: rr > 20 ? 'Tachypnea' : rr < 12 ? 'Bradypnea' : 'Normal',
        reference: '12-20 /min (Normal)'
      });
    }

    const spo2Match = text.match(/(?:SpO2|O2\s*Sat)[:\s]*(\d+)\s*%/i);
    if (spo2Match) {
      const spo2 = parseInt(spo2Match[1], 10);
      vitals.push({
        key: 'spo2', label: 'Oxygen Saturation (SpO2)', value: spo2,
        displayValue: `${spo2}%`,
        percentage: Math.min(100, ((spo2 - 80) / 20) * 100),
        color: spo2 < 90 ? '#ef4444' : spo2 < 94 ? '#f59e0b' : '#22c55e',
        interpretation: spo2 < 90 ? 'Hypoxemia' : spo2 < 94 ? 'Mild Hypoxemia' : 'Normal',
        reference: '95-100% (Normal)'
      });
    }

    const tempMatch = text.match(/Temp(?:erature)?[:\s]*([\d.]+)\s*°?F/i);
    if (tempMatch) {
      const temp = parseFloat(tempMatch[1]);
      vitals.push({
        key: 'temp', label: 'Temperature', value: temp,
        displayValue: `${temp}°F`,
        percentage: Math.min(100, ((temp - 95) / 10) * 100),
        color: temp >= 100.4 ? '#ef4444' : temp < 97 ? '#3b82f6' : '#22c55e',
        interpretation: temp >= 100.4 ? 'Fever' : temp < 97 ? 'Hypothermia' : 'Normal',
        reference: '97.8-99.1°F (Normal)'
      });
    }

    const bmiMatch = text.match(/BMI[:\s]*([\d.]+)/i);
    if (bmiMatch) {
      const bmi = parseFloat(bmiMatch[1]);
      vitals.push({
        key: 'bmi', label: 'Body Mass Index (BMI)', value: bmi,
        displayValue: `${bmi} kg/m²`,
        percentage: Math.min(100, (bmi / 50) * 100),
        color: bmi >= 30 ? '#ef4444' : bmi >= 25 ? '#f59e0b' : bmi < 18.5 ? '#3b82f6' : '#22c55e',
        interpretation: bmi >= 30 ? 'Obese' : bmi >= 25 ? 'Overweight' : bmi < 18.5 ? 'Underweight' : 'Normal',
        reference: '18.5-24.9 kg/m² (Normal)'
      });
    }

    return vitals;
  };

  // Vitals already visualized in the bar chart — hidden from the text rows to avoid duplication
  // (the parser charts BP, HR, RR, SpO2, Temp, BMI; Weight/Height/Glucose etc. stay as rows).
  const CHARTED_VITAL_PATTERNS = [
    /BP[:\s]*\d+\/\d+\s*mmHg/i,
    /HR[:\s]*\d+\s*bpm/i,
    /RR[:\s]*\d+/i,
    /(?:SpO2|O2\s*Sat)[:\s]*\d+\s*%/i,
    /Temp(?:erature)?[:\s]*[\d.]+\s*°?F/i,
    /BMI[:\s]*[\d.]+/i,
  ];
  const isChartedVital = (text) => CHARTED_VITAL_PATTERNS.some((re) => re.test(String(text || '')));

  // buildMeasurements — discrete numeric scores/measurements (NYHA, GCS, BMI, pain, ABI)
  // Guards: BMI/NYHA/ABI hidden when 0 or absent; GCS hidden when 0 or outside 3-15;
  // painScale shown when a present number 0..10 (0 = legitimate "no pain").
  const NYHA_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

  const buildMeasurements = (record) => {
    const rows = [];
    const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);

    const bmi = record.bodyMassIndex;
    if (isNum(bmi) && bmi > 0) {
      rows.push({ key: 'bodyMassIndex', label: 'BMI', value: `${bmi} kg/m²` });
    }

    const nyha = record.nyhaClassification;
    if (isNum(nyha) && nyha >= 1 && nyha <= 4) {
      rows.push({ key: 'nyhaClassification', label: 'NYHA Class', value: NYHA_ROMAN[nyha] });
    }

    const pain = record.painScale;
    if (isNum(pain) && pain >= 0 && pain <= 10) {
      rows.push({ key: 'painScale', label: 'Pain Scale', value: `${pain}/10` });
    }

    const gcs = record.glasgowComaScale;
    if (isNum(gcs) && gcs >= 3 && gcs <= 15) {
      rows.push({ key: 'glasgowComaScale', label: 'GCS', value: `${gcs}/15` });
    }

    const abi = record.ankleBrachialIndex;
    if (isNum(abi) && abi > 0) {
      rows.push({ key: 'ankleBrachialIndex', label: 'ABI', value: `${abi}` });
    }

    return rows;
  };

  // ========================= CLIPBOARD & SEARCH =========================

  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = String(text).split(regex);
    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  const shouldShowRow = useCallback((record, ...valuesToCheck) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  // ========================= SECTION FIELDS & HELPERS =========================

  const SECTION_FIELDS = {
    vitalSigns: ['vitalSigns'],
    eentExamination: ['eentExamination'],
    cardiovascularExamination: ['cardiovascularExamination'],
    pulmonaryExamination: ['pulmonaryExamination'],
    abdominalExamination: ['abdominalExamination'],
    neurologicalExamination: ['neurologicalExamination'],
    mentalStatusExamination: ['mentalStatusExamination'],
    skinExamination: ['skinExamination'],
    musculoskeletalExamination: ['musculoskeletalExamination'],
    lymphNodeExamination: ['lymphNodeExamination'],
    additional: ['edemaAssessment', 'functionalStatus', 'nutritionalStatus', 'pressureUlcerRisk', 'fallRiskAssessment', 'peripheralPulses', 'respiratoryEffort', 'genitourinaryExamination'],
  };

  const getFieldSection = (fieldName) => {
    for (const [section, fields] of Object.entries(SECTION_FIELDS)) {
      if (fields.includes(fieldName)) return section;
    }
    return null;
  };

  // ========================= EDITING HANDLERS =========================

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[PhysicalExaminations] Cannot save — no record _id');
      return;
    }

    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const editKey = `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedSentences(prev => ({ ...prev, [`${editKey}-s${sentenceIdx || 0}`]: 'edited' }));

    // Re-edit after approval → drop this field's section 'approved' flag so the button goes back to yellow
    const section = getFieldSection(fieldName);
    if (section) {
      const sectionKey = `${section}-${idx}`;
      setApprovedSections(prev => {
        if (!prev[sectionKey]) return prev;
        const next = { ...prev };
        delete next[sectionKey];
        return next;
      });
    }

    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[PhysicalExaminations] Cannot approve — no record _id');
      return;
    }

    const section = sectionKey.replace(/-\d+$/, '');
    const sectionFields = SECTION_FIELDS[section] || [];

    setApproving(true);
    try {
      // Only this section's pending edits for this record
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" (no array fields here)
        const dotIdx = fieldPart.lastIndexOf('.');
        const baseField = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1))
          ? fieldPart.slice(0, dotIdx) : fieldPart;
        return sectionFields.includes(baseField);
      });

      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayElem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const payload = { field: isArrayElem ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(fieldPart.slice(dotIdx + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/physical_examinations/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/physical_examinations/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[recordId]) {
        sectionFields.forEach(f => { delete store[recordId][f]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [sectionKey]: true }));
      // Clear editedSentences for this section's fields only
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          const belongsToSection = sectionFields.some(f => key.startsWith(`${f}-${idx}-s`));
          if (!belongsToSection) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[PhysicalExaminations] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // splitByComma — parenthesis-aware comma split (for comma-list fields like Vital Signs)
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
      else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    const t = current.trim(); if (t) result.push(t);
    return result;
  };

  // splitSmart — split a narrative field into per-finding rows. Always break on . ; (paren-aware).
  // Break on a comma ONLY when inside a labeled value (a colon has appeared in the current
  // sentence) AND the comma is NOT followed by a conjunction (and/or/but/nor). So a plain
  // sentence ("Regular rate and rhythm without murmur, gallop, or rub") and a conjunction clause
  // ("Skin temperature: ... left foot, but both feet warm") each stay one row, while a labeled
  // parallel list ("Capillary refill time: right foot 3 seconds, left foot 2 seconds") splits.
  const splitSmart = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0; let labeled = false;
    const CONJ = /^\s*(?:and|or|but|nor)\b/i;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
      if (depth === 0 && ch === ':') { labeled = true; current += ch; continue; }
      const isSentenceEnd = (ch === '.' || ch === ';') && i + 1 < text.length && /\s/.test(text[i + 1]);
      const isSplitComma = ch === ',' && depth === 0 && labeled && !CONJ.test(text.slice(i + 1));
      if (depth === 0 && (isSentenceEnd || isSplitComma)) {
        if (isSentenceEnd && ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) { current += ch; continue; }
        const t = current.trim(); if (t) result.push(t); current = '';
        if (isSentenceEnd) labeled = false;
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
        continue;
      }
      current += ch;
    }
    const t = current.replace(/[.;,]+$/, '').trim(); if (t) result.push(t);
    return result;
  };

  // Comma-handled fields. vitalSigns is a pure comma list (no labels). The narrative exam fields
  // use splitSmart (labeled-value commas only, conjunction-safe). COMMA_FIELDS = both (for
  // natural-order display + splice-based per-row save).
  const PURE_COMMA_FIELDS = ['vitalSigns'];
  const COMMA_FIELDS = ['vitalSigns', 'cardiovascularExamination', 'neurologicalExamination', 'mentalStatusExamination', 'skinExamination', 'nutritionalStatus', 'peripheralPulses'];
  const splitField = (fieldName, text) =>
    PURE_COMMA_FIELDS.includes(fieldName) ? splitByComma(text)
      : COMMA_FIELDS.includes(fieldName) ? splitSmart(text)
        : splitBySentence(text);

  // ========================= PER-SENTENCE EDITING =========================

  const saveSentence = useCallback((record, fieldName, idx, sectionId, sIdx) => {
    const isComma = COMMA_FIELDS.includes(fieldName);
    let editedSentence = editValue.trim();
    if (!isComma && editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';

    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitField(fieldName, sourceText);

    // Reconstruct: comma fields splice the edited item back into the ORIGINAL text (walking
    // item-by-item) so every original delimiter (. ; ,) + spacing is preserved exactly; sentence
    // fields rejoin with spaces + period restoration.
    let fullText;
    if (isComma) {
      let cursor = 0; let rebuilt = ''; let ok = true;
      for (let i = 0; i < allCurrent.length; i++) {
        const item = allCurrent[i];
        const pos = sourceText.indexOf(item, cursor);
        if (pos === -1) { ok = false; break; }
        rebuilt += sourceText.slice(cursor, pos) + (i === sIdx ? editedSentence : item);
        cursor = pos + item.length;
      }
      fullText = ok
        ? rebuilt + sourceText.slice(cursor)
        : allCurrent.map((s, i) => (i === sIdx ? editedSentence : s)).join(', ');
    } else {
      const updated = allCurrent.map((s, i) => {
        const t = i === sIdx ? editedSentence : s;
        return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
      });
      fullText = updated.join(' ');
    }

    // Detect added items
    const newSentences = splitField(fieldName, fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const addedKeys = {};
      for (let i = allCurrent.length; i < newSentences.length; i++) {
        addedKeys[`${fieldName}-${idx}-s${i}`] = 'added';
      }
      setEditedSentences(prev => ({ ...prev, ...addedKeys }));
    }

    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  }, [editValue, localEdits, handleSaveField]);

  // sectionHasEdits — checks ALL per-sentence keys for a section
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      return Object.keys(editedSentences).some(key => {
        if (!key.startsWith(`${f}-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
    });
  }, [editedSentences, statusOverrides]);

  // ========================= PDF DATA =========================

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) merged[fieldName] = editVal;
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // ========================= RENDER: PARSED FIELD =========================

  const renderParsedField = (record, fieldName, idx, sectionId, parentLabel = null, sectionTitleMatches = false) => {
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    if (!sourceText || !String(sourceText).trim()) return null;

    const sentences = splitField(fieldName, String(sourceText));
    if (sentences.length === 0) return null;

    const items = sentences
      .map((sentence, origIdx) => {
        const parsed = parseLabel(sentence);
        return { ...parsed, origIdx, fullSentence: sentence };
      })
      .filter(item => {
        // Vital Signs: drop rows already shown in the bar chart (no duplication)
        if (fieldName === 'vitalSigns' && isChartedVital(item.fullSentence)) return false;
        if (!searchTerm.trim() || record._showAllSections || sectionTitleMatches) return true;
        return shouldShowRow(record, item.label, item.value, item.fullSentence);
      });

    // Comma-list fields keep natural finding order; only sentence fields float labeled rows first.
    if (!COMMA_FIELDS.includes(fieldName)) {
      items.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
    }

    if (items.length === 0) return null;

    const canEdit = !!record._id;
    const recordStatus = statusOverrides[idx] || 'active';

    return items.map((item, displayIdx) => {
      const { origIdx, isLabeled, label: itemLabel, value: itemValue, fullSentence } = item;
      const editKey = `${fieldName}-${idx}-s${origIdx}`;
      const isEditing = editingField === editKey;
      const sentenceState = editedSentences[editKey];
      const isEdited = sentenceState === 'edited' && recordStatus !== 'approved';
      const isAdded = sentenceState === 'added' && recordStatus !== 'approved';
      const showParentLabel = parentLabel && displayIdx === 0;

      if (isEditing) {
        return (
          <div key={editKey} className="rec-mini-card">
            {showParentLabel && <div className="nested-subtitle">{highlightText(parentLabel)}</div>}
            {isLabeled && !showParentLabel && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
            {isLabeled && showParentLabel && <div className="sub-label">{highlightText(itemLabel)}</div>}
            <div className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit();
                    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      saveSentence(record, fieldName, idx, sectionId, origIdx);
                    }
                  }}
                  rows={Math.max(2, editValue.split('\n').length)}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button
                    className="edit-save-btn"
                    onClick={() => saveSentence(record, fieldName, idx, sectionId, origIdx)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={editKey} className="rec-mini-card">
          {showParentLabel && <div className="nested-subtitle">{highlightText(parentLabel)}</div>}
          {isLabeled && !showParentLabel && <div className="nested-subtitle">{highlightText(itemLabel)}</div>}
          {isLabeled && showParentLabel && <div className="sub-label">{highlightText(itemLabel)}</div>}
          <div
            className={`numbered-row${canEdit ? ' editable-row' : ''}${isEdited || isAdded ? ' modified' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, fullSentence, origIdx)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <div className="row-content">
              <span className="content-value">{highlightText(isLabeled ? itemValue : fullSentence)}</span>
              {canEdit && !isEdited && !isAdded && (
                <span className="edit-indicator">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  <span className="edit-tag">edit</span>
                </span>
              )}
            </div>
            <button
              className={`copy-btn${copiedId === editKey ? ' copied' : ''}`}
              onClick={(e) => { e.stopPropagation(); copyToClipboard(fullSentence, editKey); }}
            >
              {copiedId === editKey ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {isEdited && <div className="modified-badge">edited — click Pending Approve to save</div>}
          {isAdded && <div className="modified-badge added">added — click Pending Approve to save</div>}
        </div>
      );
    });
  };

  // ========================= COPY HELPERS =========================

  const copySectionText = useCallback((fieldKey, value, title) => {
    if (!value) return '';
    const lines = [title.toUpperCase(), COPY_LINE_EQ];
    const sentences = splitField(fieldKey, String(value));
    const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
    if (!COMMA_FIELDS.includes(fieldKey)) {
      parsed.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
    }
    parsed.forEach((item, i) => {
      if (item.isLabeled) lines.push(item.label);
      lines.push(`${i + 1}. ${item.value}`);
    });
    return lines.join('\n');
  }, []);

  const getAllRecordText = useCallback((record, idx) => {
    const lines = [`PHYSICAL EXAMINATION ${idx + 1}`, COPY_LINE_EQ];

    const examSections = [
      { key: 'vitalSigns', label: 'VITAL SIGNS' },
      { key: 'eentExamination', label: 'HEENT EXAMINATION' },
      { key: 'cardiovascularExamination', label: 'CARDIOVASCULAR' },
      { key: 'pulmonaryExamination', label: 'PULMONARY' },
      { key: 'abdominalExamination', label: 'ABDOMINAL' },
      { key: 'neurologicalExamination', label: 'NEUROLOGICAL' },
      { key: 'mentalStatusExamination', label: 'MENTAL STATUS' },
      { key: 'skinExamination', label: 'SKIN' },
      { key: 'musculoskeletalExamination', label: 'MUSCULOSKELETAL' },
      { key: 'lymphNodeExamination', label: 'LYMPH NODES' },
    ];

    examSections.forEach(({ key, label }) => {
      const val = record[key];
      if (val && String(val).trim()) {
        lines.push('', label, COPY_LINE_DASH);
        const sentences = splitField(key, String(val));
        const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
        if (!COMMA_FIELDS.includes(key)) {
          parsed.sort((a, b) => {
            if (a.isLabeled && !b.isLabeled) return -1;
            if (!a.isLabeled && b.isLabeled) return 1;
            return 0;
          });
        }
        parsed.forEach((item, i) => {
          if (item.isLabeled) lines.push(item.label);
          lines.push(`${i + 1}. ${item.value}`);
        });
      }
    });

    const additionalFields = [
      { key: 'edemaAssessment', label: 'Edema' },
      { key: 'functionalStatus', label: 'Functional Status' },
      { key: 'nutritionalStatus', label: 'Nutritional Status' },
      { key: 'pressureUlcerRisk', label: 'Pressure Ulcer Risk' },
      { key: 'fallRiskAssessment', label: 'Fall Risk Assessment' },
      { key: 'peripheralPulses', label: 'Peripheral Pulses' },
      { key: 'respiratoryEffort', label: 'Respiratory Effort' },
      { key: 'genitourinaryExamination', label: 'Genitourinary' },
    ];

    const hasAdditional = additionalFields.some(f => record[f.key] && String(record[f.key]).trim());
    if (hasAdditional) {
      lines.push('', 'ADDITIONAL FINDINGS', COPY_LINE_DASH);
      additionalFields.forEach(f => {
        const val = record[f.key];
        if (val && String(val).trim()) {
          const sentences = splitField(f.key, String(val));
          if (sentences.length > 1) {
            const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
            if (!COMMA_FIELDS.includes(f.key)) {
              parsed.sort((a, b) => {
                if (a.isLabeled && !b.isLabeled) return -1;
                if (!a.isLabeled && b.isLabeled) return 1;
                return 0;
              });
            }
            lines.push(`${f.label}:`);
            parsed.forEach((item, i) => {
              if (item.isLabeled) lines.push(`  ${item.label}`);
              lines.push(`  ${i + 1}. ${item.value}`);
            });
          } else {
            lines.push(`${f.label}:`);
            lines.push(`  1. ${val}`);
          }
        }
      });
    }

    const measurements = buildMeasurements(record);
    if (measurements.length > 0) {
      lines.push('', 'MEASUREMENTS / SCORES', COPY_LINE_DASH);
      measurements.forEach((m, i) => { lines.push(m.label); lines.push(`${i + 1}. ${m.value}`); });
    }

    return lines.join('\n');
  }, []);

  // ========================= SEARCH FILTERING =========================

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map((record, idx) => ({ ...record, _documentIndex: idx + 1 }));
    }

    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData
      .map((record, idx) => {
        const recordTitle = `Physical Examination ${idx + 1}`;

        const allFieldValues = [];
        const allFieldKeys = [
          'vitalSigns', 'eentExamination', 'cardiovascularExamination', 'pulmonaryExamination',
          'abdominalExamination', 'neurologicalExamination', 'mentalStatusExamination',
          'skinExamination', 'musculoskeletalExamination', 'lymphNodeExamination',
          'edemaAssessment', 'functionalStatus', 'nutritionalStatus', 'pressureUlcerRisk',
          'fallRiskAssessment', 'peripheralPulses', 'respiratoryEffort', 'genitourinaryExamination'
        ];

        allFieldKeys.forEach(key => {
          const val = record[key];
          if (val && typeof val === 'string') {
            allFieldValues.push(val);
            splitBySentence(val).forEach(s => {
              const parsed = parseLabel(s);
              if (parsed.isLabeled) allFieldValues.push(parsed.label);
            });
          }
        });

        const parsedVitals = parseVitalSigns(record.vitalSigns || '');
        const vitalSearchTerms = parsedVitals.flatMap(v => [v.label, v.displayValue, v.interpretation, v.reference]);

        const measurementTerms = buildMeasurements(record).flatMap(m => [m.label, m.value, `${m.label}: ${m.value}`]);

        const searchableText = [
          'Physical Examinations',
          recordTitle,
          formatDate(record.createdAt),
          'Vital Signs', 'HEENT Examination', 'Cardiovascular', 'Pulmonary', 'Abdominal',
          'Neurological', 'Mental Status', 'Skin', 'Musculoskeletal', 'Lymph Nodes',
          'Additional Findings', 'Measurements / Scores',
          'Edema', 'Functional Status', 'Nutritional Status', 'Pressure Ulcer Risk',
          'Fall Risk Assessment', 'Peripheral Pulses', 'Respiratory Effort', 'Genitourinary',
          ...vitalSearchTerms,
          ...measurementTerms,
          ...allFieldValues,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchableText.includes(phrase)) return null;

        const titleLower = recordTitle.toLowerCase();
        const _showAllSections = titleLower.startsWith(phrase) || phrase.startsWith(titleLower) ||
          'physical examinations'.startsWith(phrase) || phrase.startsWith('physical examinations');

        return { ...record, _documentIndex: idx + 1, _showAllSections };
      })
      .filter(Boolean);
  }, [unwrappedData, searchTerm, formatDate]);

  // ========================= BAR CHART COMPONENTS =========================

  const BarChartRow = ({ chart }) => (
    <div className="bar-chart-row">
      <div className="bar-label">{highlightText(chart.label)}</div>
      <div className="bar-container">
        <div className="bar-background">
          <div className="bar-fill" style={{ width: `${chart.percentage}%`, backgroundColor: chart.color }} />
        </div>
        <div className="bar-value">{highlightText(chart.displayValue)}</div>
      </div>
      <div className="bar-interpretation" style={{ color: chart.color }}>
        {highlightText(chart.interpretation)}
      </div>
      {chart.reference && <div className="bar-reference">Ref: {highlightText(chart.reference)}</div>}
    </div>
  );

  const ChartLegend = () => (
    <div className="chart-legend">
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>Low/Elevated</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }} /><span>Abnormal</span></div>
      <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>Critical</span></div>
    </div>
  );

  // ========================= RENDER: APPROVE BUTTON =========================

  const renderApproveBtn = (record, idx, sectionId) => {
    const sectionKey = `${sectionId}-${idx}`;
    if (!sectionHasEdits(sectionId, idx) && !approvedSections[sectionKey]) return null;

    return (
      <button
        className={`approve-btn${approvedSections[sectionKey] ? ' approved' : ' pending'}`}
        onClick={() => handleApprove(record, idx, sectionKey)}
        disabled={approving}
      >
        {approving ? 'Approving...' : approvedSections[sectionKey] ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // ========================= RENDER: EXAM SECTION =========================

  const renderExamSection = (record, idx, title, fieldKey) => {
    const value = getFieldValue(record, fieldKey, idx);
    if (!value || !String(value).trim()) return null;

    const sectionId = fieldKey;

    // Search: hide section if nothing matches
    const sectionTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return title.toLowerCase().includes(searchTerm.toLowerCase().trim());
    })();

    if (searchTerm.trim() && !sectionTitleMatches && !shouldShowRow(record, value)) return null;

    const items = renderParsedField(record, fieldKey, idx, sectionId, null, sectionTitleMatches);
    if (!items) return null;

    return (
      <div className="section" key={fieldKey}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h3 className="section-title">{highlightText(title)}</h3>
            <div className="header-right-actions">
              <button
                className={`copy-btn${copiedId === `${fieldKey}-${idx}` ? ' copied' : ''}`}
                onClick={() => copyToClipboard(copySectionText(fieldKey, getFieldValue(record, fieldKey, idx), title), `${fieldKey}-${idx}`)}
              >
                {copiedId === `${fieldKey}-${idx}` ? 'Copied!' : 'Copy Section'}
              </button>
              {renderApproveBtn(record, idx, sectionId)}
            </div>
          </div>
          {items}
        </div>
      </div>
    );
  };

  // ========================= RENDER: RECORD =========================

  const renderRecord = (record, idx) => {
    const vitalSignsVal = getFieldValue(record, 'vitalSigns', idx);
    const vitalsData = parseVitalSigns(String(vitalSignsVal || ''));

    // Filter vitals based on search
    const filteredVitals = (() => {
      if (!searchTerm.trim() || record._showAllSections) return vitalsData;
      const titleMatches = shouldShowRow(record, 'Vital Signs', 'vital signs');
      if (titleMatches) return vitalsData;
      return vitalsData.filter(v =>
        shouldShowRow(record, v.label, v.displayValue, v.interpretation, v.reference)
      );
    })();

    const hasVitals = filteredVitals.length > 0;
    const hasVitalText = vitalSignsVal && String(vitalSignsVal).trim();

    // Vital signs: show if bar chart data OR text exists
    const vitalTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return 'vital signs'.includes(searchTerm.toLowerCase().trim());
    })();

    const showVitalSection = (() => {
      if (!hasVitals && !hasVitalText) return false;
      if (vitalTitleMatches) return true;
      return hasVitals || shouldShowRow(record, vitalSignsVal);
    })();

    // Additional findings
    const additionalFields = [
      { key: 'edemaAssessment', label: 'Edema' },
      { key: 'functionalStatus', label: 'Functional Status' },
      { key: 'nutritionalStatus', label: 'Nutritional Status' },
      { key: 'pressureUlcerRisk', label: 'Pressure Ulcer Risk' },
      { key: 'fallRiskAssessment', label: 'Fall Risk Assessment' },
      { key: 'peripheralPulses', label: 'Peripheral Pulses' },
      { key: 'respiratoryEffort', label: 'Respiratory Effort' },
      { key: 'genitourinaryExamination', label: 'Genitourinary' },
    ];

    const additionalTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return 'additional findings'.includes(searchTerm.toLowerCase().trim());
    })();

    const visibleAdditional = additionalFields.filter(f => {
      const val = getFieldValue(record, f.key, idx);
      if (!val || !String(val).trim()) return false;
      if (additionalTitleMatches) return true;
      return shouldShowRow(record, f.label, val);
    });

    // Measurements / Scores — discrete numeric fields (BMI, NYHA, pain, GCS, ABI)
    const allMeasurements = buildMeasurements(record);
    const measurementsTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      return 'measurements / scores'.includes(searchTerm.toLowerCase().trim());
    })();
    const visibleMeasurements = allMeasurements.filter(m => {
      if (measurementsTitleMatches) return true;
      return shouldShowRow(record, m.label, m.value, `${m.label}: ${m.value}`);
    });

    return (
      <div key={record._id || idx} className="record-card">
        {/* Record Header */}
        <div className="record-header">
          <h2 className="record-title">
            {highlightText(`Physical Examination ${record._documentIndex}`)}
          </h2>
        </div>

        {/* Vital Signs — per-sentence editing + bar chart */}
        {showVitalSection && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Vital Signs')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn${copiedId === `vitalSigns-${idx}` ? ' copied' : ''}`}
                    onClick={() => copyToClipboard(copySectionText('vitalSigns', getFieldValue(record, 'vitalSigns', idx), 'Vital Signs'), `vitalSigns-${idx}`)}
                  >
                    {copiedId === `vitalSigns-${idx}` ? 'Copied!' : 'Copy Section'}
                  </button>
                  {renderApproveBtn(record, idx, 'vitalSigns')}
                </div>
              </div>
              {renderParsedField(record, 'vitalSigns', idx, 'vitalSigns', null, vitalTitleMatches)}
              {hasVitals && (
                <>
                  <ChartLegend />
                  <div className="chart-container">
                    {filteredVitals.map((chart, cIdx) => (
                      <BarChartRow key={cIdx} chart={chart} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Examination Sections */}
        {renderExamSection(record, idx, 'HEENT Examination', 'eentExamination')}
        {renderExamSection(record, idx, 'Cardiovascular', 'cardiovascularExamination')}
        {renderExamSection(record, idx, 'Pulmonary', 'pulmonaryExamination')}
        {renderExamSection(record, idx, 'Abdominal', 'abdominalExamination')}
        {renderExamSection(record, idx, 'Neurological', 'neurologicalExamination')}
        {renderExamSection(record, idx, 'Mental Status', 'mentalStatusExamination')}
        {renderExamSection(record, idx, 'Skin', 'skinExamination')}
        {renderExamSection(record, idx, 'Musculoskeletal', 'musculoskeletalExamination')}
        {renderExamSection(record, idx, 'Lymph Nodes', 'lymphNodeExamination')}

        {/* Additional Findings — per-section approve, each sub-field parsed */}
        {visibleAdditional.length > 0 && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Additional Findings')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn${copiedId === `additional-${idx}` ? ' copied' : ''}`}
                    onClick={() => {
                      const lines = ['ADDITIONAL FINDINGS', COPY_LINE_EQ];
                      visibleAdditional.forEach(f => {
                        const val = getFieldValue(record, f.key, idx);
                        const sentences = splitField(f.key, String(val || ''));
                        if (sentences.length > 1) {
                          const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
                          if (!COMMA_FIELDS.includes(f.key)) {
                            parsed.sort((a, b) => {
                              if (a.isLabeled && !b.isLabeled) return -1;
                              if (!a.isLabeled && b.isLabeled) return 1;
                              return 0;
                            });
                          }
                          lines.push(`${f.label}:`);
                          parsed.forEach((item, i) => {
                            if (item.isLabeled) lines.push(`  ${item.label}`);
                            lines.push(`  ${i + 1}. ${item.value}`);
                          });
                        } else {
                          lines.push(`${f.label}:`);
                          lines.push(`  1. ${val}`);
                        }
                      });
                      copyToClipboard(lines.join('\n'), `additional-${idx}`);
                    }}
                  >
                    {copiedId === `additional-${idx}` ? 'Copied!' : 'Copy Section'}
                  </button>
                  {renderApproveBtn(record, idx, 'additional')}
                </div>
              </div>
              {visibleAdditional.map((field) => {
                const fieldLabelMatches = (() => {
                  if (additionalTitleMatches) return true;
                  if (!searchTerm.trim()) return true;
                  return field.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                })();
                return renderParsedField(record, field.key, idx, 'additional', field.label, fieldLabelMatches);
              })}
            </div>
          </div>
        )}

        {/* Measurements / Scores — discrete numeric measurements (read-only) */}
        {visibleMeasurements.length > 0 && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Measurements / Scores')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn${copiedId === `measurements-${idx}` ? ' copied' : ''}`}
                    onClick={() => {
                      const lines = ['MEASUREMENTS / SCORES', COPY_LINE_EQ];
                      visibleMeasurements.forEach((m, i) => { lines.push(m.label); lines.push(`${i + 1}. ${m.value}`); });
                      copyToClipboard(lines.join('\n'), `measurements-${idx}`);
                    }}
                  >
                    {copiedId === `measurements-${idx}` ? 'Copied!' : 'Copy Section'}
                  </button>
                </div>
              </div>
              {visibleMeasurements.map((m) => {
                const rowKey = `measurements-${idx}-${m.key}`;
                const copyText = `${m.label}: ${m.value}`;
                return (
                  <div key={rowKey} className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText(m.label)}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(m.value)}</span>
                      </div>
                      <button
                        className={`copy-btn${copiedId === rowKey ? ' copied' : ''}`}
                        onClick={() => copyToClipboard(copyText, rowKey)}
                      >
                        {copiedId === rowKey ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================= MAIN RENDER =========================

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="physical-examinations-document">
        <div className="empty-state">No physical examination records available.</div>
      </div>
    );
  }

  return (
    <div className="physical-examinations-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Physical Examinations</h1>

        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'all-documents' ? ' copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<PhysicalExaminationsDocumentPDFTemplate document={pdfData} />}
            fileName="Physical_Examinations.pdf"
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search physical examinations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
      </div>

      {/* Records */}
      <div className="records-container">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record, idx) => renderRecord(record, idx))
        ) : (
          <div className="no-results">No records match your search.</div>
        )}
      </div>
    </div>
  );
};

export default PhysicalExaminationsDocument;
