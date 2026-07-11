/**
 * PhysicalTherapyEvaluationsDocumentPDFTemplate.jsx
 * Box-free black & white — Helvetica — LETTER size — physical therapy evaluations
 * Collection: physical_therapy_evaluations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
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

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const DYNAMIC_KEY_LABELS = {
  kps: 'KPS Score',
  ecog: 'ECOG Score',
  adlScore: 'ADL Score',
  iadlScore: 'IADL Score',
  fimScore: 'FIM Score',
  barthelIndex: 'Barthel Index',
};
const dynLabel = (key) => DYNAMIC_KEY_LABELS[key] || keyToLabel(key);

/* A dynamic-key object → stacked fieldBox rows (label above value); array leaves numbered */
const objectRows = (obj, labelFn) => Object.entries(obj)
  .filter(([k, v]) => k !== '_id' && hasVal(v))
  .map(([key, value], itemIdx) => (
    Array.isArray(value) ? (
      <View key={itemIdx} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{labelFn(key)}</Text>
        {value.filter(v => hasVal(v)).map((v, vIdx) => (
          <Text key={vIdx} style={styles.listItem}>{vIdx + 1}. {safeString(v)}</Text>
        ))}
      </View>
    ) : (
      <View key={itemIdx} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{labelFn(key)}</Text>
        <Text style={styles.fieldValue}>{safeString(value)}</Text>
      </View>
    )
  ));

const objectHasData = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
  Object.entries(obj).filter(([k, v]) => k !== '_id' && hasVal(v)).length > 0;

/* ======= COMPONENT ======= */
const PhysicalTherapyEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.physical_therapy_evaluations) {
        return inputData[0].physical_therapy_evaluations;
      }
      return inputData;
    }
    if (inputData.physical_therapy_evaluations) {
      return inputData.physical_therapy_evaluations;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Physical Therapy Evaluations</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Physical Therapy Evaluations</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>
                {safeString(record.referralDiagnosis) || `Physical Therapy Evaluation ${index + 1}`}
              </Text>
            </View>

            {/* Evaluation Information */}
            {(hasVal(record.evaluationDate) || hasVal(record.referralDiagnosis) || hasVal(record.therapist)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Evaluation Information</Text>
                {hasVal(record.evaluationDate) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Evaluation Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.evaluationDate)}</Text>
                  </View>
                )}
                {hasVal(record.referralDiagnosis) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Referral Diagnosis</Text>
                    <Text style={styles.fieldValue}>{safeString(record.referralDiagnosis)}</Text>
                  </View>
                )}
                {hasVal(record.therapist) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Therapist</Text>
                    <Text style={styles.fieldValue}>{safeString(record.therapist)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Functional Status (dynamic-key object) */}
            {objectHasData(record.functionalStatus) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Status</Text>
                {objectRows(record.functionalStatus, dynLabel)}
              </View>
            )}

            {/* Range of Motion */}
            {record.rangeOfMotion?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Range of Motion</Text>
                {record.rangeOfMotion.map((item, itemIdx) => (
                  <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {safeString(item)}</Text>
                ))}
              </View>
            )}

            {/* Strength */}
            {record.strength?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Strength</Text>
                {record.strength.map((item, itemIdx) => (
                  <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {safeString(item)}</Text>
                ))}
              </View>
            )}

            {/* Balance */}
            {objectHasData(record.balance) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Balance</Text>
                {objectRows(record.balance, keyToLabel)}
              </View>
            )}

            {/* Gait */}
            {objectHasData(record.gait) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Gait</Text>
                {objectRows(record.gait, keyToLabel)}
              </View>
            )}

            {/* Pain Assessment */}
            {objectHasData(record.painAssessment) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Pain Assessment</Text>
                {objectRows(record.painAssessment, keyToLabel)}
              </View>
            )}

            {/* Functional Goals */}
            {record.functionalGoals?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Goals</Text>
                {record.functionalGoals.map((goal, goalIdx) => (
                  <Text key={goalIdx} style={styles.listItem}>{goalIdx + 1}. {safeString(goal)}</Text>
                ))}
              </View>
            )}

            {/* Treatment Plan (dynamic-key object; interventions may be an array) */}
            {objectHasData(record.treatmentPlan) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Treatment Plan</Text>
                {objectRows(record.treatmentPlan, dynLabel)}
              </View>
            )}

            {/* Precautions */}
            {record.precautions?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Precautions</Text>
                {record.precautions.map((precaution, precIdx) => (
                  <Text key={precIdx} style={styles.listItem}>{precIdx + 1}. {safeString(precaution)}</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PhysicalTherapyEvaluationsDocumentPDFTemplate;
