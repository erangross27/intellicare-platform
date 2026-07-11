/**
 * PhysicalTherapyEvaluationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — physical therapy evaluations
 * Collection: physical_therapy_evaluations
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
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  fieldRow: { flexDirection: 'row', marginBottom: 6 },
  fieldRowLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#404040', width: 120 },
  fieldRowValue: { fontSize: 12, color: '#404040', flex: 1 },
  sectionContent: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid' },
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
              {record.evaluationDate && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.evaluationDate)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>
                {safeString(record.referralDiagnosis) || `Physical Therapy Evaluation ${index + 1}`}
              </Text>
            </View>

            {/* Evaluation Information */}
            {(hasVal(record.evaluationDate) || hasVal(record.referralDiagnosis) || hasVal(record.therapist)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Evaluation Information</Text>
                <View style={styles.sectionContent}>
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
              </View>
            )}

            {/* Functional Status (dynamic-key object) */}
            {record.functionalStatus && typeof record.functionalStatus === 'object' && !Array.isArray(record.functionalStatus) && Object.entries(record.functionalStatus).filter(([k, v]) => k !== '_id' && hasVal(v)).length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Status</Text>
                <View style={styles.sectionContent}>
                  {Object.entries(record.functionalStatus).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([key, value], itemIdx) => (
                    <View key={itemIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldRowLabel}>{dynLabel(key)}:</Text>
                      <Text style={styles.fieldRowValue}>{Array.isArray(value) ? value.map(v => safeString(v)).join('; ') : safeString(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Range of Motion */}
            {record.rangeOfMotion?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Range of Motion</Text>
                <View style={styles.sectionContent}>
                  {record.rangeOfMotion.map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {safeString(item)}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Strength */}
            {record.strength?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Strength</Text>
                <View style={styles.sectionContent}>
                  {record.strength.map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {safeString(item)}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Balance */}
            {record.balance && Object.keys(record.balance).filter(k => k !== '_id').length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Balance</Text>
                <View style={styles.sectionContent}>
                  {Object.entries(record.balance).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([key, value], itemIdx) => (
                    <View key={itemIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldRowLabel}>{keyToLabel(key)}:</Text>
                      <Text style={styles.fieldRowValue}>{safeString(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Gait */}
            {record.gait && Object.keys(record.gait).filter(k => k !== '_id').length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Gait</Text>
                <View style={styles.sectionContent}>
                  {Object.entries(record.gait).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([key, value], itemIdx) => (
                    <View key={itemIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldRowLabel}>{keyToLabel(key)}:</Text>
                      <Text style={styles.fieldRowValue}>{safeString(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pain Assessment */}
            {record.painAssessment && Object.keys(record.painAssessment).filter(k => k !== '_id').length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Pain Assessment</Text>
                <View style={styles.sectionContent}>
                  {Object.entries(record.painAssessment).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([key, value], itemIdx) => (
                    <View key={itemIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldRowLabel}>{keyToLabel(key)}:</Text>
                      <Text style={styles.fieldRowValue}>{safeString(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Functional Goals */}
            {record.functionalGoals?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Goals</Text>
                <View style={styles.sectionContent}>
                  {record.functionalGoals.map((goal, goalIdx) => (
                    <Text key={goalIdx} style={styles.listItem}>{goalIdx + 1}. {safeString(goal)}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Treatment Plan (dynamic-key object; interventions may be an array) */}
            {record.treatmentPlan && typeof record.treatmentPlan === 'object' && !Array.isArray(record.treatmentPlan) && Object.entries(record.treatmentPlan).filter(([k, v]) => k !== '_id' && hasVal(v)).length > 0 && (
              <View style={styles.section} wrap={Object.entries(record.treatmentPlan).filter(([k, v]) => k !== '_id' && hasVal(v)).reduce((n, [, v]) => n + (Array.isArray(v) ? v.filter(x => hasVal(x)).length : 1), 0) > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Treatment Plan</Text>
                <View style={styles.sectionContent}>
                  {Object.entries(record.treatmentPlan).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([key, value], itemIdx) => (
                    Array.isArray(value) ? (
                      <View key={itemIdx} style={styles.fieldBox}>
                        <Text style={styles.nestedSubtitle}>{dynLabel(key)}</Text>
                        {value.filter(v => hasVal(v)).map((v, vIdx) => (
                          <Text key={vIdx} style={styles.listItem}>{vIdx + 1}. {safeString(v)}</Text>
                        ))}
                      </View>
                    ) : (
                      <View key={itemIdx} style={styles.fieldRow}>
                        <Text style={styles.fieldRowLabel}>{dynLabel(key)}:</Text>
                        <Text style={styles.fieldRowValue}>{safeString(value)}</Text>
                      </View>
                    )
                  ))}
                </View>
              </View>
            )}

            {/* Precautions */}
            {record.precautions?.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Precautions</Text>
                <View style={styles.sectionContent}>
                  {record.precautions.map((precaution, precIdx) => (
                    <Text key={precIdx} style={styles.listItem}>{precIdx + 1}. {safeString(precaution)}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PhysicalTherapyEvaluationsDocumentPDFTemplate;
