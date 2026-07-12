/**
 * PreventiveBiomarkersDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER — Collection: preventive_biomarkers
 * Mirrors PreventiveBiomarkersDocument.jsx (config maps + sameAsTitle + anti-orphan glue).
 * date is a display-only record-header line (not a section field); NO sentinel-zero (a biomarker 0 is meaningful).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE B&W STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordCard: { marginBottom: 20 },
  recordDate: { fontSize: 13, color: '#333333', marginBottom: 2 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: '#333333', marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, marginBottom: 3, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
});

/* ═══════ CONFIG MAPS (mirror the JSX) ═══════ */
const SECTION_TITLES = {
  'biomarker-identification': 'Biomarker Identification',
  'results-assessment': 'Results & Assessment',
  'testing-details': 'Testing Details',
  'clinical-context': 'Clinical Context',
  'risk-interventions': 'Risk Factors & Interventions',
  'followup-provider': 'Follow-Up & Provider',
};

const FIELD_LABELS = {
  biomarkerType: 'Biomarker Type',
  biomarkerName: 'Biomarker Name',
  panelName: 'Panel Name',
  resultValue: 'Result Value',
  resultUnit: 'Result Unit',
  referenceRange: 'Reference Range',
  riskCategory: 'Risk Category',
  abnormalFlag: 'Abnormal Flag',
  calculatedRiskScore: 'Calculated Risk Score',
  testMethodology: 'Test Methodology',
  specimenType: 'Specimen Type',
  fastingStatus: 'Fasting Status',
  qualityControlStatus: 'Quality Control Status',
  indicationForTesting: 'Indication for Testing',
  diseaseRiskAssessment: 'Disease Risk Assessment',
  trendComparison: 'Trend Comparison',
  clinicalSignificance: 'Clinical Significance',
  riskFactorsPresent: 'Risk Factors Present',
  interventionsRecommended: 'Interventions Recommended',
  recommendedFollowUp: 'Recommended Follow-Up',
  retestInterval: 'Retest Interval',
  provider: 'Provider',
  facility: 'Facility',
  interpretingPhysician: 'Interpreting Physician',
  aiProcessed: 'AI Processed',
};

const SECTION_FIELDS = {
  'biomarker-identification': ['biomarkerType', 'biomarkerName', 'panelName'],
  'results-assessment': ['resultValue', 'resultUnit', 'referenceRange', 'riskCategory', 'abnormalFlag', 'calculatedRiskScore'],
  'testing-details': ['testMethodology', 'specimenType', 'fastingStatus', 'qualityControlStatus'],
  'clinical-context': ['indicationForTesting', 'diseaseRiskAssessment', 'trendComparison', 'clinicalSignificance'],
  'risk-interventions': ['riskFactorsPresent', 'interventionsRecommended'],
  'followup-provider': ['recommendedFollowUp', 'retestInterval', 'provider', 'facility', 'interpretingPhysician', 'aiProcessed'],
};
const SECTION_ORDER = ['biomarker-identification', 'results-assessment', 'testing-details', 'clinical-context', 'risk-interventions', 'followup-provider'];

const BOOLEAN_FIELDS = ['aiProcessed'];
const NUMBER_FIELDS = ['resultValue', 'calculatedRiskScore'];
const ARRAY_FIELDS = ['riskFactorsPresent', 'interventionsRecommended'];

/* sameAsTitle: hide a field label that duplicates its section title */
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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
const fieldBody = (record, f, sid) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const els = [];
  const pushLabel = () => { if (!sameAsTitle(label, sid)) els.push(<Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>); };

  if (NUMBER_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    pushLabel();
    els.push(<Text key="v" style={styles.fieldValue}>{fmtVal(val)}</Text>);
  } else if (BOOLEAN_FIELDS.includes(f)) {
    if (typeof val !== 'boolean') return null;
    pushLabel();
    els.push(<Text key="v" style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>);
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
    if (items.length === 0) return null;
    pushLabel();
    items.forEach((it, i) => els.push(<Text key={`i${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(it)}`}</Text>));
  } else {
    if (!hasVal(val)) return null;
    const strVal = safeString(fmtVal(val));
    const sentences = splitBySentence(strVal);
    pushLabel();
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach((line, i) => els.push(<Text key={`s${i}`} style={styles.listItem}>{line}</Text>));
    } else {
      els.push(<Text key="v" style={styles.fieldValue}>{strVal}</Text>);
    }
  }
  return els.length > 0 ? els : null;
};

const fieldView = (record, f, sid) => {
  const body = fieldBody(record, f, sid);
  if (!body) return null;
  return <View key={f} style={styles.fieldBox} wrap={false}>{body}</View>;
};

/* anti-orphan: sectionTitle + first field glued in a wrap={false} View, rest flow */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const views = fields.map(f => fieldView(record, f, sid)).filter(Boolean);
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

const PreventiveBiomarkersDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.preventive_biomarkers) records = document[0].preventive_biomarkers;
    else if (document.length > 0 && document[0]?.records) records = document[0].records;
    else records = document;
  } else if (document?.preventive_biomarkers) records = Array.isArray(document.preventive_biomarkers) ? document.preventive_biomarkers : [document.preventive_biomarkers];
  else if (document?.records) records = document.records;
  else if (document) records = [document];

  const validRecords = Array.isArray(records) ? records.filter(r => r && typeof r === 'object') : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preventive Biomarkers</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No preventive biomarkers data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preventive Biomarkers</Text>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
            <Text style={styles.recordTitle}>{`Preventive Biomarkers ${idx + 1}`}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreventiveBiomarkersDocumentPDFTemplate;
