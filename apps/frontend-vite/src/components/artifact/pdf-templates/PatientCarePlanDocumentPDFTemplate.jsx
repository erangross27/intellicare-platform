/**
 * PatientCarePlanDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — patient_care_plan
 * Collection: patient_care_plan
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subFieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#444444', marginBottom: 1, paddingLeft: 12 },
  subFieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000', paddingLeft: 12, marginBottom: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
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

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'patient-info': 'Patient Information',
  'interventions': 'Tailored Interventions',
  'lifestyle': 'Lifestyle Modifications',
  'comorbidity': 'Comorbidity Management',
  'metrics': 'Outcome Metrics',
  'meta': 'Document Details',
};

const FIELD_LABELS = {
  patientName: 'Patient Name',
  dateOfBirth: 'Date of Birth',
  age: 'Age',
  gender: 'Gender',
  tailoredInterventions: 'Tailored Interventions',
  lifestyleModifications: 'Lifestyle Modifications',
  comorbidityManagement: 'Comorbidity Management',
  outcomeMetrics: 'Outcome Metrics',
  source: 'Source',
  aiProcessed: 'AI Processed',
  documentDate: 'Document Date',
};

const SECTION_FIELDS = {
  'patient-info': ['patientName', 'dateOfBirth', 'age', 'gender'],
  'interventions': ['tailoredInterventions'],
  'lifestyle': ['lifestyleModifications'],
  'comorbidity': ['comorbidityManagement'],
  'metrics': ['outcomeMetrics'],
  'meta': ['documentDate', 'source', 'aiProcessed'],
};

const DATE_FIELDS = ['dateOfBirth', 'documentDate'];
const BOOLEAN_FIELDS = ['aiProcessed'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (BOOLEAN_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (fn === 'tailoredInterventions') {
    const items = Array.isArray(val) ? val.filter(i => i && typeof i === 'object') : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <View key={i} style={{ marginBottom: 8, paddingLeft: 8 }}>
            <Text style={styles.nestedSubtitle}>{`${i + 1}. ${item.intervention || ''}`}</Text>
            {item.rationale && <><Text style={styles.subFieldLabel}>Rationale</Text><Text style={styles.subFieldValue}>{safeString(item.rationale)}</Text></>}
            {item.expectedOutcome && <><Text style={styles.subFieldLabel}>Expected Outcome</Text><Text style={styles.subFieldValue}>{safeString(item.expectedOutcome)}</Text></>}
            {item.timeframe && <><Text style={styles.subFieldLabel}>Timeframe</Text><Text style={styles.subFieldValue}>{safeString(item.timeframe)}</Text></>}
          </View>
        ))}
      </View>
    );
  }

  if (fn === 'lifestyleModifications') {
    const items = Array.isArray(val) ? val.filter(i => i && typeof i === 'object') : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <View key={i} style={{ marginBottom: 8, paddingLeft: 8 }}>
            <Text style={styles.nestedSubtitle}>{`${i + 1}. ${item.category || ''}`}</Text>
            {item.recommendation && <><Text style={styles.subFieldLabel}>Recommendation</Text><Text style={styles.subFieldValue}>{safeString(item.recommendation)}</Text></>}
            {item.benefits && <><Text style={styles.subFieldLabel}>Benefits</Text><Text style={styles.subFieldValue}>{safeString(item.benefits)}</Text></>}
            {item.barriers && <><Text style={styles.subFieldLabel}>Potential Barriers</Text><Text style={styles.subFieldValue}>{safeString(item.barriers)}</Text></>}
            {item.support && <><Text style={styles.subFieldLabel}>Support</Text><Text style={styles.subFieldValue}>{safeString(item.support)}</Text></>}
          </View>
        ))}
      </View>
    );
  }

  if (fn === 'comorbidityManagement') {
    if (typeof val !== 'object' || Array.isArray(val)) return null;
    const conditions = Array.isArray(val.conditions) ? val.conditions : [];
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {conditions.map((cond, i) => (
          <View key={i} style={{ marginBottom: 8, paddingLeft: 8 }}>
            <Text style={styles.nestedSubtitle}>{`${i + 1}. ${cond.condition || ''}`}</Text>
            {cond.management && <><Text style={styles.subFieldLabel}>Management</Text><Text style={styles.subFieldValue}>{safeString(cond.management)}</Text></>}
            {cond.goals && <><Text style={styles.subFieldLabel}>Goals</Text><Text style={styles.subFieldValue}>{safeString(cond.goals)}</Text></>}
          </View>
        ))}
        {val.interactions && (
          <View style={{ marginTop: 4, paddingLeft: 8 }}>
            <Text style={styles.subFieldLabel}>Condition Interactions</Text>
            <Text style={styles.subFieldValue}>{safeString(val.interactions)}</Text>
          </View>
        )}
        {val.prioritization && (
          <View style={{ marginTop: 4, paddingLeft: 8 }}>
            <Text style={styles.subFieldLabel}>Treatment Prioritization</Text>
            <Text style={styles.subFieldValue}>{safeString(val.prioritization)}</Text>
          </View>
        )}
      </View>
    );
  }

  if (fn === 'outcomeMetrics') {
    const items = Array.isArray(val) ? val.filter(i => i && typeof i === 'object') : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <View key={i} style={{ marginBottom: 8, paddingLeft: 8 }}>
            <Text style={styles.nestedSubtitle}>{`${i + 1}. ${item.metric || ''}`}</Text>
            {item.target && <><Text style={styles.subFieldLabel}>Target</Text><Text style={styles.subFieldValue}>{safeString(item.target)}</Text></>}
            {item.frequency && <><Text style={styles.subFieldLabel}>Measurement Frequency</Text><Text style={styles.subFieldValue}>{safeString(item.frequency)}</Text></>}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const anyVal = fields.some(f => hasVal(record[f]));
  if (!anyVal) return null;

  return (
    <View key={sid} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(f => renderField(record, f))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PatientCarePlanDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].patient_care_plan && Array.isArray(docProp[0].patient_care_plan)) {
      records = docProp[0].patient_care_plan;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.patient_care_plan) {
    records = Array.isArray(docProp.patient_care_plan) ? docProp.patient_care_plan : [docProp.patient_care_plan];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Patient Care Plan</Text>
          </View>
          <Text style={styles.noDataText}>No patient care plan data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Patient Care Plan</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              {hasVal(record.documentDate) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.documentDate)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{record.patientName || `Care Plan ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'patient-info')}
            {renderSection(record, 'interventions')}
            {renderSection(record, 'lifestyle')}
            {renderSection(record, 'comorbidity')}
            {renderSection(record, 'metrics')}
            {renderSection(record, 'meta')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PatientCarePlanDocumentPDFTemplate;
