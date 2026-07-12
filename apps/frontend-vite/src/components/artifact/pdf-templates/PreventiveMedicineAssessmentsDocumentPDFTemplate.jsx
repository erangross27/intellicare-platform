/**
 * PreventiveMedicineAssessmentsDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER — Collection: preventive_medicine_assessments
 * Mirrors PreventiveMedicineAssessmentsDocument.jsx (full recursive-object family:
 * date/number/array/object/string; object leaves + labeled array items STACKED;
 * sameAsTitle bare labels; canonical [.;] split; anti-orphan flatten glue).
 * Dates render in-section (assessmentDate in assessment-info, nextAssessmentDate in counseling) — no header date.
 */
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
  fieldLabel: { fontSize: 13, color: '#333333', marginTop: 6, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, marginBottom: 3, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  emptyState: { textAlign: 'center', color: '#666666', marginTop: 20 },
});

/* ═══════ CONFIG MAPS (mirror the JSX) ═══════ */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'vital-signs': 'Vital Signs',
  'screening-immunizations': 'Screening Tests & Immunizations',
  'risk-assessment': 'Risk & Family History',
  'screening-status': 'Cancer & Depression Screening',
  'functional-cognitive': 'Functional & Cognitive Assessment',
  'chronic-medications': 'Chronic Disease & Medications',
  'counseling-followup': 'Counseling & Follow-Up',
};
const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  provider: 'Provider',
  facility: 'Facility',
  assessmentType: 'Assessment Type',
  patientAge: 'Patient Age',
  vitalSigns: 'Vital Signs',
  screeningTests: 'Screening Tests',
  immunizationsAdministered: 'Immunizations Administered',
  immunizationStatus: 'Immunization Status',
  cardiovascularRiskScore: 'Cardiovascular Risk Score',
  riskFactorAssessment: 'Risk Factor Assessment',
  familyHistoryReview: 'Family History Review',
  cancerScreeningStatus: 'Cancer Screening Status',
  depressionScreening: 'Depression Screening',
  functionalStatusAssessment: 'Functional Status Assessment',
  fallRiskAssessment: 'Fall Risk Assessment',
  cognitiveScreening: 'Cognitive Screening',
  chronicDiseaseManagement: 'Chronic Disease Management',
  medications: 'Medications',
  preventiveMedicationsPrescribed: 'Preventive Medications Prescribed',
  preventiveCounseling: 'Preventive Counseling',
  referralsOrdered: 'Referrals Ordered',
  healthMaintenanceReminders: 'Health Maintenance Reminders',
  advanceDirectivesDiscussion: 'Advance Directives Discussion',
  nextAssessmentDate: 'Next Assessment Date',
};
const SECTION_FIELDS = {
  'assessment-info': ['assessmentDate', 'provider', 'facility', 'assessmentType', 'patientAge'],
  'vital-signs': ['vitalSigns'],
  'screening-immunizations': ['screeningTests', 'immunizationsAdministered', 'immunizationStatus'],
  'risk-assessment': ['cardiovascularRiskScore', 'riskFactorAssessment', 'familyHistoryReview'],
  'screening-status': ['cancerScreeningStatus', 'depressionScreening'],
  'functional-cognitive': ['functionalStatusAssessment', 'fallRiskAssessment', 'cognitiveScreening'],
  'chronic-medications': ['chronicDiseaseManagement', 'medications', 'preventiveMedicationsPrescribed'],
  'counseling-followup': ['preventiveCounseling', 'referralsOrdered', 'healthMaintenanceReminders', 'advanceDirectivesDiscussion', 'nextAssessmentDate'],
};
const SECTION_ORDER = ['assessment-info', 'vital-signs', 'screening-immunizations', 'risk-assessment', 'screening-status', 'functional-cognitive', 'chronic-medications', 'counseling-followup'];

const DATE_FIELDS = ['assessmentDate', 'nextAssessmentDate'];
const NUMBER_FIELDS = ['patientAge', 'cardiovascularRiskScore'];
const ARRAY_FIELDS = ['screeningTests', 'immunizationsAdministered', 'chronicDiseaseManagement', 'medications', 'preventiveMedicationsPrescribed', 'preventiveCounseling', 'referralsOrdered', 'healthMaintenanceReminders'];
const OBJECT_FIELDS = ['vitalSigns', 'immunizationStatus', 'riskFactorAssessment', 'familyHistoryReview', 'cancerScreeningStatus', 'depressionScreening', 'fallRiskAssessment', 'cognitiveScreening'];

const KEY_OVERRIDES = {
  bmi: 'BMI', bp: 'BP', hr: 'HR', phq: 'PHQ', gad: 'GAD', mmse: 'MMSE', moca: 'MoCA',
  hpv: 'HPV', covid: 'COVID-19', tdap: 'Tdap', ldl: 'LDL', hdl: 'HDL', a1c: 'A1c',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const lk = String(key).toLowerCase(); if (KEY_OVERRIDES[lk]) return KEY_OVERRIDES[lk]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

/* hide a field label that duplicates its section title */
const sameAsTitle = (label, title) => (label || '').trim().toLowerCase() === (title || '').trim().toLowerCase();

/* ═══════ HELPERS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...');
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* recursive object → flat elements: sub-label (bold) above numbered value; nested objects recurse */
const objectElements = (value, keyPrefix) => {
  const els = [];
  Object.entries(value).filter(([, v]) => hasVal(v)).forEach(([k, v], i) => {
    els.push(<Text key={`${keyPrefix}-${i}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
    if (isScalar(v)) {
      els.push(<Text key={`${keyPrefix}-${i}-v`} style={styles.listItem}>{`1. ${safeString(fmtScalar(v))}`}</Text>);
    } else {
      objectElements(v, `${keyPrefix}-${i}`).forEach(e => els.push(e));
    }
  });
  return els;
};

/* ═══════ FIELD RENDER (flat elements) ═══════ */
const fieldBody = (record, f, title) => {
  const val = record[f];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[f] || f;
  const els = [];
  const pushLabel = () => { if (!sameAsTitle(label, title)) els.push(<Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>); };

  if (DATE_FIELDS.includes(f)) {
    pushLabel();
    els.push(<Text key="v" style={styles.fieldValue}>{formatDate(val)}</Text>);
  } else if (NUMBER_FIELDS.includes(f)) {
    pushLabel();
    els.push(<Text key="v" style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>);
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(hasVal);
    if (items.length === 0) return null;
    pushLabel();
    items.forEach((item, i) => els.push(<Text key={`a${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(fmtScalar(item))}`}</Text>));
  } else if (OBJECT_FIELDS.includes(f)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    pushLabel();
    objectElements(val, f).forEach(e => els.push(e));
  } else {
    const strVal = safeString(fmtVal(val));
    const sentences = splitBySentence(strVal);
    pushLabel();
    if (sentences.length > 1) {
      sentences.forEach((s, i) => els.push(<Text key={`s${i}`} style={styles.listItem}>{`${i + 1}. ${s}`}</Text>));
    } else {
      els.push(<Text key="v" style={styles.fieldValue}>{strVal}</Text>);
    }
  }
  return els.length > 0 ? els : null;
};

/* anti-orphan by FLATTENING: every field's body flows individually (small Text nodes,
   never a page-tall wrap={false} View); only sectionTitle + first element are glued. */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const title = SECTION_TITLES[sid];
  const allEls = [];
  fields.forEach((f) => {
    const body = fieldBody(record, f, title);
    if (!body) return;
    body.forEach((el, i) => { allEls.push(React.cloneElement(el, { key: `${f}-${i}` })); });
  });
  if (allEls.length === 0) return null;
  const [first, ...rest] = allEls;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

/* ═══════ COMPONENT ═══════ */
const PreventiveMedicineAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.preventive_medicine_assessments) records = Array.isArray(data[0].preventive_medicine_assessments) ? data[0].preventive_medicine_assessments : [data[0].preventive_medicine_assessments];
    else records = data;
  } else if (data?.preventive_medicine_assessments) records = Array.isArray(data.preventive_medicine_assessments) ? data.preventive_medicine_assessments : [data.preventive_medicine_assessments];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.preventive_medicine_assessments) records = Array.isArray(dd.preventive_medicine_assessments) ? dd.preventive_medicine_assessments : [dd.preventive_medicine_assessments]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preventive Medicine Assessment</Text>
          <Text style={styles.emptyState}>No preventive medicine assessment data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preventive Medicine Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Preventive Medicine Assessment ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreventiveMedicineAssessmentsDocumentPDFTemplate;
