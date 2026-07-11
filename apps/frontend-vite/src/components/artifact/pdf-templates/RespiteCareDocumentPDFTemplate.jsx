/**
 * RespiteCareDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — respite care
 * Collection: respite_care
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
  if (Array.isArray(v)) return v.filter(Boolean).length > 0;
  return true;
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  const items = text.split(/;\s*/).map(s => s.trim()).filter(s => s);
  return items.length > 0 ? items : [text];
};

/* ======= COMPONENT ======= */
const RespiteCareDocumentPDFTemplate = ({ document: docProp, records: recordsProp }) => {
  const records = (() => {
    const src = recordsProp || docProp;
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (src.respite_care) return Array.isArray(src.respite_care) ? src.respite_care : [src.respite_care];
    if (src.documentData) {
      const dd = src.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.respite_care) return Array.isArray(dd.respite_care) ? dd.respite_care : [dd.respite_care];
      return [dd];
    }
    return [src];
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No respite care data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>RESPITE CARE</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.createdAt) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Respite Care Record {idx + 1}</Text>
            </View>

            {/* Provider Details */}
            {hasVal(record.createdAt) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Details</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <Text style={styles.fieldValue}>{formatDate(record.createdAt)}</Text>
                </View>
              </View>
            )}

            {/* Primary Diagnosis */}
            {hasVal(record.primaryDiagnosis) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Primary Diagnosis</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{safeString(record.primaryDiagnosis)}</Text>
                </View>
              </View>
            )}

            {/* Assessment Scores */}
            {(() => {
              const scoreFields = [
                ['Functional Status Score', record.functionalStatusScore],
                ['Activities of Daily Living Score', record.activitiesOfDailyLivingScore],
                ['Cognitive Assessment Score', record.cognitiveAssessmentScore],
                ['Caregiver Burden Score', record.caregiverBurdenScore],
                ['Pain Assessment Score', record.painAssessmentScore],
                ['Depression Screening Score', record.depressionScreeningScore],
              ].filter(([, v]) => hasVal(v));
              if (scoreFields.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Scores</Text>
                  {scoreFields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{safeString(val)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Physical Status */}
            {(() => {
              const physFields = [
                ['Fall Risk Assessment', record.fallRiskAssessment],
                ['Nutritional Status', record.nutritionalStatus],
                ['Body Mass Index', record.bodyMassIndex],
                ['Skin Integrity Assessment', record.skinIntegrityAssessment],
                ['Respiratory Status', record.respiratoryStatus],
                ['Continence Status', record.continenceStatus],
                ['Swallowing Assessment', record.swallowingAssessment],
              ].filter(([, v]) => hasVal(v));
              if (physFields.length === 0) return null;
              return (
                <View style={styles.section} wrap={physFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Physical Status</Text>
                  {physFields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{safeString(val)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Medication List */}
            {(() => {
              const meds = Array.isArray(record.medicationList) ? record.medicationList.filter(Boolean) : [];
              if (meds.length === 0) return null;
              return (
                <View style={styles.section} wrap={meds.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Medication List</Text>
                  {meds.map((med, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(med)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Mobility Aids */}
            {(() => {
              const aids = Array.isArray(record.mobilityAids) ? record.mobilityAids.filter(Boolean) : [];
              if (aids.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Mobility Aids</Text>
                  {aids.map((aid, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(aid)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Behavioral Symptoms */}
            {(() => {
              const symptoms = Array.isArray(record.behavioralSymptoms) ? record.behavioralSymptoms.filter(Boolean) : [];
              if (symptoms.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Behavioral Symptoms</Text>
                  {symptoms.map((sym, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(sym)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Social Support */}
            {(() => {
              const supportItems = splitBySemicolon(record.socialSupportNetwork);
              const emergency = hasVal(record.emergencyContactInformation) ? safeString(record.emergencyContactInformation) : null;
              if (supportItems.length === 0 && !emergency) return null;
              return (
                <View style={styles.section} wrap={supportItems.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Social Support</Text>
                  {supportItems.length > 0 && (
                    <>
                      <Text style={styles.nestedSubtitle}>Social Support Network</Text>
                      {supportItems.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
                      ))}
                    </>
                  )}
                  {emergency && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Emergency Contact</Text>
                      <Text style={styles.fieldValue}>{emergency}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Dietary Requirements */}
            {(() => {
              const reqs = Array.isArray(record.specialDietaryRequirements) ? record.specialDietaryRequirements.filter(Boolean) : [];
              if (reqs.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Dietary Requirements</Text>
                  {reqs.map((req, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(req)}</Text>
                  ))}
                </View>
              );
            })()}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}

        <Text style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#a1a1a1' }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default RespiteCareDocumentPDFTemplate;
