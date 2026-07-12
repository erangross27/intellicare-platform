import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE B&W STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordCard: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: '#333333', marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, marginBottom: 3, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
});

/* ═══════ CONFIG MAPS (mirror the JSX) ═══════ */
const SECTION_TITLES = {
  'risk-assessment': 'Risk Assessment',
  'evaluation-info': 'Evaluation Information',
  'procedure-details': 'Procedure Details',
  'airway-assessment': 'Airway Assessment',
  'medical-history': 'Medical History',
  'medications': 'Medications',
};

const FIELD_LABELS = {
  date: 'Date',
  anesthesiologistName: 'Anesthesiologist',
  informedConsentObtained: 'Informed Consent Obtained',
  asaClassification: 'ASA Classification',
  mallampatiScore: 'Mallampati Score',
  cardiovascularRiskIndex: 'Cardiovascular Risk Index',
  proposedProcedure: 'Proposed Procedure',
  scheduledSurgeryDate: 'Scheduled Surgery Date',
  anesthesiaType: 'Anesthesia Type',
  neckMobility: 'Neck Mobility',
  thyromenthalDistance: 'Thyromental Distance',
  mouthOpening: 'Mouth Opening',
  dentalCondition: 'Dental Condition',
  difficultAirwayPredictors: 'Difficult Airway Predictors',
  fastingStatus: 'Fasting Status',
  lastOralIntake: 'Last Oral Intake',
  aspirationRisk: 'Aspiration Risk',
  coagulationStatus: 'Coagulation Status',
  functionalCapacity: 'Functional Capacity',
  activeCardiacConditions: 'Active Cardiac Conditions',
  respiratoryRiskFactors: 'Respiratory Risk Factors',
  priorAnesthesiaComplications: 'Prior Anesthesia Complications',
  familialAnesthesiaHistory: 'Familial Anesthesia History',
  currentMedications: 'Current Medications',
  medicationAllergies: 'Medication Allergies',
  preoperativeLabValues: 'Preoperative Lab Values',
};

const SECTION_FIELDS = {
  'risk-assessment': ['asaClassification', 'mallampatiScore', 'cardiovascularRiskIndex'],
  'evaluation-info': ['date', 'anesthesiologistName', 'informedConsentObtained'],
  'procedure-details': ['proposedProcedure', 'scheduledSurgeryDate', 'anesthesiaType'],
  'airway-assessment': ['neckMobility', 'thyromenthalDistance', 'mouthOpening', 'dentalCondition', 'difficultAirwayPredictors'],
  'medical-history': ['fastingStatus', 'lastOralIntake', 'aspirationRisk', 'coagulationStatus', 'functionalCapacity', 'activeCardiacConditions', 'respiratoryRiskFactors', 'priorAnesthesiaComplications', 'familialAnesthesiaHistory'],
  'medications': ['currentMedications', 'medicationAllergies', 'preoperativeLabValues'],
};
const SECTION_ORDER = ['risk-assessment', 'evaluation-info', 'procedure-details', 'airway-assessment', 'medical-history', 'medications'];

const DATE_FIELDS = ['date', 'scheduledSurgeryDate'];
const BOOLEAN_FIELDS = ['informedConsentObtained'];
const ARRAY_FIELDS = ['difficultAirwayPredictors', 'activeCardiacConditions', 'respiratoryRiskFactors', 'priorAnesthesiaComplications', 'currentMedications', 'medicationAllergies', 'preoperativeLabValues'];

/* ═══════ HELPERS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    if (val.value !== undefined) s = String(val.value);
    else if (val.text !== undefined) s = String(val.text);
    else s = JSON.stringify(val);
  } else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue || ''); }
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* mirror of JSX formatSentenceFieldLines */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        lines.push(parsed.label + ':');
        parts.forEach(item => lines.push(`${n++}. ${item}`));
      } else {
        lines.push(parsed.label + ':');
        lines.push(`${n++}. ${parsed.value}`);
      }
    } else {
      lines.push(`${n++}. ${s}`);
    }
  });
  return lines;
};

/* ═══════ FIELD RENDER (flat elements, one glue View per field) ═══════ */
const fieldBody = (record, f) => {
  const val = record[f];
  if (!hasVal(val)) return null;
  const els = [<Text key="l" style={styles.fieldLabel}>{safeString(FIELD_LABELS[f] || f)}</Text>];
  if (DATE_FIELDS.includes(f)) {
    els.push(<Text key="v" style={styles.fieldValue}>{formatDate(val)}</Text>);
  } else if (BOOLEAN_FIELDS.includes(f)) {
    els.push(<Text key="v" style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>);
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [val];
    items.forEach((it, i) => els.push(<Text key={`i${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(it)}`}</Text>));
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach((line, i) => els.push(<Text key={`s${i}`} style={styles.listItem}>{line}</Text>));
    } else {
      els.push(<Text key="v" style={styles.fieldValue}>{strVal}</Text>);
    }
  }
  return els;
};

const fieldView = (record, f) => {
  const body = fieldBody(record, f);
  if (!body) return null;
  return <View key={f} style={styles.fieldBox} wrap={false}>{body}</View>;
};

/* anti-orphan: sectionTitle + first field glued in a wrap={false} View, rest flow */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const views = fields.map(f => fieldView(record, f)).filter(Boolean);
  if (views.length === 0) return null;
  const [first, ...rest] = views;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PreoperativeEvaluationDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) records = document[0].records;
    else if (document.length > 0 && document[0]?._records) records = document[0]._records;
    else records = document;
  } else if (document?.records) records = document.records;
  else if (document?._records) records = document._records;
  else if (document) records = [document];

  const validRecords = Array.isArray(records) ? records : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preoperative Evaluation</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No preoperative evaluation data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preoperative Evaluation</Text>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Preoperative Evaluation ${idx + 1}`}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreoperativeEvaluationDocumentPDFTemplate;
