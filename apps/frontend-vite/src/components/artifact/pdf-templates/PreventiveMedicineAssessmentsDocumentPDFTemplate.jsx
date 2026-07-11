/**
 * PreventiveMedicineAssessmentsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — BLACK & WHITE only (#000000 / grayscale, NO saturated colors).
 * Collection: preventive_medicine_assessments
 *
 * BOX-FREE; Rule #74 per-field wrap-gating: each field is ONE wrap-gated <View>
 * (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined), with sectionTitle embedded INSIDE the
 * first present field's View (anti-orphan — never a sibling).
 * OBJECT fields rendered recursively as humanized key/value lines. STRING narratives sentence-split.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
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

/* ═══════ UTILS ═══════ */
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 per-field gating — returns ARRAY of Views, EACH one wrap unit; title INSIDE first View */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (NUMBER_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{fmtVal(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (<Text key={i} style={styles.value}>{i + 1}. {fmtScalar(item)}</Text>))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
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
          <View style={styles.documentHeader}><Text style={styles.title}>Preventive Medicine Assessment</Text></View>
          <Text style={styles.emptyState}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Preventive Medicine Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{record.assessmentType || `Preventive Medicine Assessment ${idx + 1}`}</Text>
              {hasVal(record.assessmentDate) && <Text style={styles.recordMeta}>{formatDate(record.assessmentDate)}</Text>}
              {hasVal(record.provider) && <Text style={styles.recordMeta}>{fmtVal(record.provider)}</Text>}
            </View>

            {/* Rule #74: section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit, sectionTitle embedded INSIDE first field (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default PreventiveMedicineAssessmentsDocumentPDFTemplate;
