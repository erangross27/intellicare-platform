/**
 * CardiologyAdmissionDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: cardiology_admission_notes
 *
 * 13 Sections:
 *   1. admission-info: admissionDate, acuteCoronarySyndromeType
 *   2. chief-complaint: chiefCardiacComplaint
 *   3. chest-pain: chestPainCharacteristics (quality, severity, location, radiation, duration, onset)
 *   4. classifications: nyhaClassification, killipClassification
 *   5. ekg: ekgFindings
 *   6. echo: echocardiogramResults (ejectionFraction, wallMotion, valves, complications)
 *   7. hemodynamics: hemodynamicParameters (bloodPressure, heartRate, oxygenSaturation)
 *   8. risk-factors: cardiacRiskFactors (array)
 *   9. medications: currentCardiacMedications (array)
 *  10. biomarker-trend: cardiacBiomarkerTrend (array)
 *  11. anticoagulation: anticoagulationStatus (therapy, indication, duration)
 *  12. treatment: coronaryArteryDiseaseHistory, cardiacCatheterizationPlanned, thrombolyticEligibility
 *  13. monitoring: pulmonaryEdemaPresence, telemetryMonitoring, functionalCapacity, arrhythmiaType
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CardiologyAdmissionDocumentPDFTemplate from '../pdf-templates/CardiologyAdmissionDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './CardiologyAdmissionDocument.css';

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'admission-info':   'Admission Information',
  'chief-complaint':  'Chief Complaint',
  'chest-pain':       'Chest Pain Characteristics',
  'classifications':  'Clinical Classifications',
  'ekg':              'EKG Findings',
  'echo':             'Echocardiogram Results',
  'hemodynamics':     'Hemodynamic Parameters',
  'risk-factors':     'Cardiac Risk Factors',
  'medications':      'Current Cardiac Medications',
  'biomarker-trend':  'Cardiac Biomarker Trend',
  'anticoagulation':  'Anticoagulation Status',
  'treatment':        'Treatment & Procedures',
  'monitoring':       'Monitoring Plan',
};

const FIELD_LABELS = {
  admissionDate:                    'Admission Date',
  acuteCoronarySyndromeType:        'ACS Type',
  chiefCardiacComplaint:            'Chief Cardiac Complaint',
  'chestPainCharacteristics.quality':   'Quality',
  'chestPainCharacteristics.severity':  'Severity',
  'chestPainCharacteristics.location':  'Location',
  'chestPainCharacteristics.radiation': 'Radiation',
  'chestPainCharacteristics.duration':  'Duration',
  'chestPainCharacteristics.onset':     'Onset',
  nyhaClassification:               'NYHA Classification',
  killipClassification:             'Killip Classification',
  ekgFindings:                      'EKG Findings',
  'echocardiogramResults.ejectionFraction': 'Ejection Fraction',
  'echocardiogramResults.wallMotion':       'Wall Motion',
  'echocardiogramResults.valves':           'Valves',
  'echocardiogramResults.complications':    'Complications',
  'hemodynamicParameters.bloodPressure':    'Blood Pressure',
  'hemodynamicParameters.heartRate':        'Heart Rate',
  'hemodynamicParameters.oxygenSaturation': 'O\u2082 Saturation',
  cardiacRiskFactors:               'Cardiac Risk Factors',
  currentCardiacMedications:        'Current Cardiac Medications',
  cardiacBiomarkerTrend:            'Cardiac Biomarker Trend',
  'anticoagulationStatus.therapy':   'Therapy',
  'anticoagulationStatus.indication':'Indication',
  'anticoagulationStatus.duration':  'Duration',
  coronaryArteryDiseaseHistory:     'CAD History',
  cardiacCatheterizationPlanned:    'Catheterization Planned',
  thrombolyticEligibility:          'Thrombolytic Eligibility',
  pulmonaryEdemaPresence:           'Pulmonary Edema',
  telemetryMonitoring:              'Telemetry Monitoring',
  functionalCapacity:               'Functional Capacity',
  arrhythmiaType:                   'Arrhythmia Type',
};

const SECTION_FIELDS = {
  'admission-info':  ['admissionDate', 'acuteCoronarySyndromeType'],
  'chief-complaint': ['chiefCardiacComplaint'],
  'chest-pain':      [
    'chestPainCharacteristics.quality', 'chestPainCharacteristics.severity',
    'chestPainCharacteristics.location', 'chestPainCharacteristics.radiation',
    'chestPainCharacteristics.duration', 'chestPainCharacteristics.onset',
  ],
  'classifications': ['nyhaClassification', 'killipClassification'],
  'ekg':             ['ekgFindings'],
  'echo':            [
    'echocardiogramResults.ejectionFraction', 'echocardiogramResults.wallMotion',
    'echocardiogramResults.valves', 'echocardiogramResults.complications',
  ],
  'hemodynamics':    [
    'hemodynamicParameters.bloodPressure', 'hemodynamicParameters.heartRate',
    'hemodynamicParameters.oxygenSaturation',
  ],
  'risk-factors':    ['cardiacRiskFactors'],
  'medications':     ['currentCardiacMedications'],
  'biomarker-trend': ['cardiacBiomarkerTrend'],
  'anticoagulation': [
    'anticoagulationStatus.therapy', 'anticoagulationStatus.indication',
    'anticoagulationStatus.duration',
  ],
  'treatment':       ['coronaryArteryDiseaseHistory', 'cardiacCatheterizationPlanned', 'thrombolyticEligibility'],
  'monitoring':      ['pulmonaryEdemaPresence', 'telemetryMonitoring', 'functionalCapacity', 'arrhythmiaType'],
};

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiology_admission_notesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const DATE_FIELDS    = ['admissionDate'];
const NUMBER_FIELDS  = ['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'];
const BOOLEAN_FIELDS = [];
const ARRAY_FIELDS   = ['cardiacRiskFactors', 'currentCardiacMedications', 'cardiacBiomarkerTrend'];

/* Dot-path field reader */
const getNestedVal = (record, fn) => {
  const parts = fn.split('.');
  let cur = record;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitBySentence */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

function reconstructFullText(sentences) {
  if (!sentences || sentences.length === 0) return '';
  return sentences.map((s, i) => {
    let c = s.replace(/[;.]+$/, '').trim();
    if (i < sentences.length - 1) c += '.';
    return c;
  }).join(' ');
}

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

/* ═══════ BAR CHART HELPERS ═══════ */
const extractNumeric = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return null;
  const match = String(value).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

const classToNumeric = (value) => {
  if (!value) return null;
  const classMatch = String(value).match(/(?:class\s*)?([IViv]+|\d)/i);
  if (!classMatch) return null;
  const romanMap = { I: 1, II: 2, III: 3, IV: 4, i: 1, ii: 2, iii: 3, iv: 4 };
  return romanMap[classMatch[1].toUpperCase()] || parseInt(classMatch[1]) || null;
};

const extractChartData = (record) => {
  const categories = [];
  const biomarkers = [];
  if (record.troponinLevel != null) {
    const val = extractNumeric(record.troponinLevel);
    if (val !== null) {
      let interpretation = 'Normal'; let color = '#22c55e';
      if (val >= 2.0) { interpretation = 'STEMI'; color = '#ef4444'; }
      else if (val >= 0.4) { interpretation = 'Elevated'; color = '#f59e0b'; }
      else if (val >= 0.04) { interpretation = 'Borderline'; color = '#eab308'; }
      biomarkers.push({ label: 'Troponin I', value: val, unit: 'ng/mL', max: Math.max(val * 1.5, 10), reference: '<0.04 ng/mL', interpretation, color });
    }
  }
  if (record.bnpLevel != null) {
    const val = extractNumeric(record.bnpLevel);
    if (val !== null) {
      let interpretation = 'Normal'; let color = '#22c55e';
      if (val >= 400) { interpretation = 'Heart Failure'; color = '#ef4444'; }
      else if (val >= 100) { interpretation = 'Elevated'; color = '#f59e0b'; }
      biomarkers.push({ label: 'BNP', value: val, unit: 'pg/mL', max: Math.max(val * 1.5, 500), reference: '<100 pg/mL', interpretation, color });
    }
  }
  if (biomarkers.length > 0) categories.push({ name: 'Cardiac Biomarkers', charts: biomarkers });

  const cardiacFunction = [];
  const lvef = record.leftVentricularEjectionFraction || (record.echocardiogramResults?.ejectionFraction ? extractNumeric(record.echocardiogramResults.ejectionFraction) : null);
  if (lvef != null) {
    const val = extractNumeric(lvef);
    if (val !== null) {
      let interpretation = 'Normal'; let color = '#22c55e';
      if (val < 30) { interpretation = 'Severely Reduced'; color = '#ef4444'; }
      else if (val < 40) { interpretation = 'Reduced'; color = '#f59e0b'; }
      else if (val < 55) { interpretation = 'Mildly Reduced'; color = '#eab308'; }
      cardiacFunction.push({ label: 'Ejection Fraction', value: val, unit: '%', max: 100, reference: '55-70%', interpretation, color });
    }
  }
  if (cardiacFunction.length > 0) categories.push({ name: 'Cardiac Function', charts: cardiacFunction });

  const classifications = [];
  if (record.nyhaClassification) {
    const val = classToNumeric(record.nyhaClassification);
    if (val !== null) {
      let interpretation = 'Class ' + ['I', 'II', 'III', 'IV'][val - 1]; let color = '#22c55e';
      if (val >= 4) { interpretation += ' (Severe)'; color = '#ef4444'; }
      else if (val >= 3) { interpretation += ' (Moderate)'; color = '#f59e0b'; }
      else if (val >= 2) { interpretation += ' (Mild)'; color = '#eab308'; }
      else { interpretation += ' (No Limitation)'; }
      classifications.push({ label: 'NYHA Class', value: val, unit: '', max: 4, reference: 'Class I-IV', interpretation, color });
    }
  }
  if (record.killipClassification) {
    const val = classToNumeric(record.killipClassification);
    if (val !== null) {
      let interpretation = 'Killip ' + ['I', 'II', 'III', 'IV'][val - 1]; let color = '#22c55e';
      if (val >= 4) { interpretation += ' (Cardiogenic Shock)'; color = '#ef4444'; }
      else if (val >= 3) { interpretation += ' (Pulmonary Edema)'; color = '#f59e0b'; }
      else if (val >= 2) { interpretation += ' (Rales/Crackles)'; color = '#eab308'; }
      else { interpretation += ' (No CHF Signs)'; }
      classifications.push({ label: 'Killip Class', value: val, unit: '', max: 4, reference: 'Class I-IV', interpretation, color });
    }
  }
  if (classifications.length > 0) categories.push({ name: 'Clinical Classifications', charts: classifications });

  const hemodynamics = [];
  if (record.hemodynamicParameters?.heartRate) {
    const val = extractNumeric(record.hemodynamicParameters.heartRate);
    if (val !== null) {
      let interpretation = 'Normal'; let color = '#22c55e';
      if (val < 50 || val > 120) { interpretation = val < 50 ? 'Bradycardia' : 'Tachycardia'; color = '#ef4444'; }
      else if (val < 60 || val > 100) { interpretation = val < 60 ? 'Low Normal' : 'High Normal'; color = '#eab308'; }
      hemodynamics.push({ label: 'Heart Rate', value: val, unit: 'bpm', max: 150, reference: '60-100 bpm', interpretation, color });
    }
  }
  if (record.hemodynamicParameters?.oxygenSaturation) {
    const val = extractNumeric(record.hemodynamicParameters.oxygenSaturation);
    if (val !== null) {
      let interpretation = 'Normal'; let color = '#22c55e';
      if (val < 90) { interpretation = 'Hypoxemia'; color = '#ef4444'; }
      else if (val < 95) { interpretation = 'Low Normal'; color = '#eab308'; }
      hemodynamics.push({ label: 'O\u2082 Saturation', value: val, unit: '%', max: 100, reference: '\u226595%', interpretation, color });
    }
  }
  if (hemodynamics.length > 0) categories.push({ name: 'Hemodynamics', charts: hemodynamics });

  return categories;
};

/* ═══════ COMPONENT ═══════ */
const CardiologyAdmissionDocument = ({ document: docProp }) => {
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
      if (r?.cardiology_admission_notes) { const d = r.cardiology_admission_notes; return Array.isArray(d) ? d : [d]; }
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => {
      if (!r?._id) return null;
      if (typeof r._id === 'string') return r._id;
      if (r._id.$oid) return r._id.$oid;
      return String(r._id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = recId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(trailing);
        if (isArrayIdx) {
          // Array element: localEdits stores the FULL array under `${field}-${idx}`; editedFields keyed `${field}.${i}-${idx}`
          const field = fieldPart.slice(0, dotIdx);
          const arrIndex = parseInt(trailing, 10);
          const localKey = `${field}-${idx}`;
          const base = Array.isArray(nLocal[localKey]) ? nLocal[localKey]
            : (Array.isArray(getNestedVal(record, field)) ? [...getNestedVal(record, field)] : []);
          base[arrIndex] = value;
          nLocal[localKey] = base;
          nPending[localKey] = true;
          nFields[`${field}.${arrIndex}-${idx}`] = 'edited';
        } else {
          // Dot-path string (e.g. "chestPainCharacteristics.quality") or plain field — stored whole under `${fieldPart}-${idx}`
          const localKey = `${fieldPart}-${idx}`;
          nLocal[localKey] = value;
          nPending[localKey] = true;
          nFields[localKey] = 'edited';
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const safeId = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  /* getFieldValue: supports dot-path keys */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return getNestedVal(record, fn);
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
      if (val != null) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase))) return true; }
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
    if (val != null) {
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return records.map((record, idx) => ({ ...record, _docTitle: `Cardiology Admission ${idx + 1}`, _showAllSections: false, _chartData: extractChartData(record) }));
    }
    const phrase = searchTerm.toLowerCase().trim();
    return records.map((record, idx) => {
      const docTitle = `Cardiology Admission ${idx + 1}`;
      let showAll = false;
      if (docTitle.toLowerCase().includes(phrase) || phrase.includes(docTitle.toLowerCase())) showAll = true;
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase)) { showAll = false; break; } }

      const searchable = [
        docTitle,
        formatDate(record.admissionDate),
        record.acuteCoronarySyndromeType,
        record.chiefCardiacComplaint,
        record.chestPainCharacteristics?.quality,
        record.chestPainCharacteristics?.severity,
        record.chestPainCharacteristics?.location,
        record.chestPainCharacteristics?.radiation,
        record.chestPainCharacteristics?.duration,
        record.chestPainCharacteristics?.onset,
        record.nyhaClassification, record.killipClassification,
        record.ekgFindings,
        record.echocardiogramResults?.ejectionFraction,
        record.echocardiogramResults?.wallMotion,
        record.echocardiogramResults?.valves,
        record.echocardiogramResults?.complications,
        record.hemodynamicParameters?.bloodPressure,
        record.hemodynamicParameters?.heartRate,
        record.hemodynamicParameters?.oxygenSaturation,
        ...(record.cardiacRiskFactors || []),
        ...(record.currentCardiacMedications || []),
        ...(record.cardiacBiomarkerTrend || []),
        record.anticoagulationStatus?.therapy,
        record.anticoagulationStatus?.indication,
        record.anticoagulationStatus?.duration,
        record.coronaryArteryDiseaseHistory,
        record.cardiacCatheterizationPlanned,
        record.thrombolyticEligibility,
        record.pulmonaryEdemaPresence,
        record.telemetryMonitoring,
        record.functionalCapacity,
        record.arrhythmiaType,
        ...Object.values(SECTION_TITLES),
        ...Object.values(FIELD_LABELS),
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = showAll || searchable.includes(phrase);
      if (!matches) return null;
      return { ...record, _docTitle: docTitle, _showAllSections: showAll, _chartData: extractChartData(record) };
    }).filter(Boolean);
  }, [records, searchTerm]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    return records.map((record, idx) => {
      const merged = { ...record, _chartData: extractChartData(record) };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          const fn = m[1];
          const parts = fn.split('.');
          if (parts.length === 2) {
            merged[parts[0]] = { ...(merged[parts[0]] || {}), [parts[1]]: localEdits[key] };
          } else {
            merged[fn] = localEdits[key];
          }
        }
      });
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _sentIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the approved flag so the button returns to yellow Pending Approve
    if (sid) setApprovedSections(prev => {
      const k = `${sid}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal; // fieldPart = full (possibly dotted, non-numeric) field name → no arrayIndex
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally + persist to the pending-drafts localStorage store.
  // NOT written to MongoDB / NOT shown in the PDF until Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    const editKey = `${fn}-${idx}`;
    const dropApproved = () => { if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); };
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      dropApproved();
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue(''); setSaveError(null);
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    const orig = sentences[sentenceIdx] || '';
    const changed = (newSentences[0] || '').replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      for (let ei = 1; ei < newSentences.length; ei++) n[`${fn}-${idx}-s${sentenceIdx + ei}`] = 'added';
      return n;
    });
    dropApproved();
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    try {
      // Persist each staged field for THIS section from the draft store (per-field / per-array-element).
      const store = readDrafts();
      const recDrafts = store[id] || {};
      const committedFieldParts = [];
      for (const [fieldPart, value] of Object.entries(recDrafts)) {
        // Only commit fieldParts belonging to this section's fields.
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(trailing); // numeric trailing dot-segment → arrayIndex
        const baseField = isArrayIdx ? fieldPart.slice(0, dotIdx) : fieldPart;
        if (!fields.includes(baseField)) continue;
        const payload = { field: isArrayIdx ? baseField : fieldPart, value };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/cardiology_admission_notes/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
        committedFieldParts.push(fieldPart);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/cardiology_admission_notes/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF. localEdits keys for this section:
      // `${field}-${idx}` (dot-path string OR whole array).
      const committedLocalKeys = new Set(committedFieldParts.map(fp => {
        const dotIdx = fp.lastIndexOf('.');
        const isArrayIdx = dotIdx !== -1 && /^\d+$/.test(fp.slice(dotIdx + 1));
        return `${isArrayIdx ? fp.slice(0, dotIdx) : fp}-${idx}`;
      }));
      setPendingEdits(prev => { const n = { ...prev }; committedLocalKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      if (store[id]) {
        committedFieldParts.forEach(fp => delete store[id][fp]);
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }

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
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(ta); return true;
    }
  }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ═══════ SECTION COPY TEXT ═══════ */
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f.split('.')[0])) { text += `${label}: ${formatDate(val)}\n\n`; }
      else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val : [val];
        if (items.length > 0) { text += `${label}\n`; items.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); text += '\n'; }
      } else { text += `${label}: ${fmtVal(val)}\n\n`; }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== CARDIOLOGY ADMISSION NOTES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiology Admission ${idx + 1}\n${'='.repeat(40)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(r, idx, sid); });
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
        <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
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
              <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

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
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="number" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} style={{ minHeight: 'auto', padding: '10px' }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = Number(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: ARRAY FIELD ═══════ */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(item => item && String(item).trim()) : [];
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
            if (!label.toLowerCase().includes(phrase) && !itemStr.toLowerCase().includes(phrase)) return null;
          }
          return (
            <div key={itemIdx}>
              <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; const localKey = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [localKey]: currentArr })); setPendingEdits(prev => ({ ...prev, [localKey]: true })); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; }); const store = readDrafts(); if (!store[id2]) store[id2] = {}; store[id2][`${fn}.${itemIdx}`] = editValue; writeDrafts(store); setEditingField(null); setEditValue(''); setSaveError(null); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
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
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row${badge ? ' modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
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
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn${copiedItems[sentenceKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge${badge === 'added' ? ' added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];
    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isModified ? ' modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
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
              <button className={`copy-btn${copiedItems[editKey] ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const title = SECTION_TITLES[sid];
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
              <button className={`copy-btn${copiedSection === copyId ? ' copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
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
      <div className="cardiology-admission-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Cardiology Admission Notes</h2></div>
        <div className="empty-state">No cardiology admission records available.</div>
      </div>
    );
  }

  return (
    <div className="cardiology-admission-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Cardiology Admission Notes</h2>
        <div className="header-actions">
          <button className={`copy-btn${showCopied ? ' copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink
            document={<CardiologyAdmissionDocumentPDFTemplate document={pdfData} />}
            fileName={`cardiology-admission-${new Date().toISOString().split('T')[0]}.pdf`}
            className="copy-btn"
          >
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search cardiology admission notes..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>

      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const chartData = record._chartData || [];
          const hasChartData = chartData.length > 0;

          /* 4-level bar chart filtering */
          const filteredChartData = (() => {
            if (!searchTerm.trim()) return chartData;
            const phrase = searchTerm.toLowerCase().trim();
            const sectionMatch = 'cardiac parameters overview'.includes(phrase) || phrase.includes('cardiac parameters overview');
            if (sectionMatch) return chartData;
            return chartData.map(category => {
              if (category.name.toLowerCase().includes(phrase)) return category;
              const filteredBars = category.charts.filter(chart => {
                const combined = `${chart.label} ${chart.value} ${chart.unit} ${chart.interpretation} ${chart.reference}`.toLowerCase();
                return combined.includes(phrase);
              });
              return filteredBars.length > 0 ? { ...category, charts: filteredBars } : null;
            }).filter(Boolean);
          })();

          const hasFilteredChartData = filteredChartData.length > 0;

          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                {record.admissionDate && (
                  <div className="record-meta-row">
                    <span className="record-date">{formatDate(record.admissionDate)}</span>
                    {record.acuteCoronarySyndromeType && (
                      <span className="record-type-badge">{highlightText(record.acuteCoronarySyndromeType)}</span>
                    )}
                  </div>
                )}
                <h3 className="record-name">{highlightText(record._docTitle || `Cardiology Admission ${idx + 1}`)}</h3>
              </div>

              {/* Bar Chart Section */}
              {hasFilteredChartData && (
                <div className="chart-section">
                  <div className="section-header" style={{ borderBottom: '1px solid rgba(96,165,250,0.4)', paddingBottom: 10, marginBottom: 12 }}>
                    <h4 className="section-title">{highlightText('Cardiac Parameters Overview')}</h4>
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }}></span> Normal</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }}></span> Borderline</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }}></span> Elevated</span>
                    <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span> Critical</span>
                  </div>
                  {filteredChartData.map((category, catIdx) => (
                    <div key={catIdx} className="chart-category">
                      <div className="chart-category-header">{highlightText(category.name)}</div>
                      <div className="chart-bars">
                        {category.charts.map((chart, chartIdx) => (
                          <div key={chartIdx} className="bar-chart-item">
                            <div className="bar-label-row">
                              <span className="bar-label">{highlightText(chart.label)}</span>
                              <span className="bar-value">{highlightText(`${chart.value} ${chart.unit}`)}</span>
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min((chart.value / chart.max) * 100, 100)}%`, backgroundColor: chart.color }}></div>
                            </div>
                            <div className="bar-info-row">
                              <span className="bar-interpretation" style={{ color: chart.color }}>{highlightText(`${chart.interpretation} (Ref: ${chart.reference})`)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {renderSection(record, idx, 'admission-info')}
              {renderSection(record, idx, 'chief-complaint')}
              {renderSection(record, idx, 'chest-pain')}
              {!hasChartData && renderSection(record, idx, 'classifications')}
              {renderSection(record, idx, 'ekg')}
              {renderSection(record, idx, 'echo')}
              {renderSection(record, idx, 'hemodynamics')}
              {renderSection(record, idx, 'risk-factors')}
              {renderSection(record, idx, 'medications')}
              {renderSection(record, idx, 'biomarker-trend')}
              {renderSection(record, idx, 'anticoagulation')}
              {renderSection(record, idx, 'treatment')}
              {renderSection(record, idx, 'monitoring')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CardiologyAdmissionDocument;
