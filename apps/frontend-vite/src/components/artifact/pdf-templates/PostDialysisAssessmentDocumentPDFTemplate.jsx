/**
 * PostDialysisAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — post dialysis assessment
 * Collection: post_dialysis_assessment
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
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  pageNumber: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#a1a1a1' },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const formatValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string' && val.trim() !== '') return val.trim();
  return null;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

/* ======= PDF COMPONENT ======= */
const PostDialysisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.post_dialysis_assessment) return Array.isArray(r.post_dialysis_assessment) ? r.post_dialysis_assessment : [r.post_dialysis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.post_dialysis_assessment) return Array.isArray(dd.post_dialysis_assessment) ? dd.post_dialysis_assessment : [dd.post_dialysis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Post Dialysis Assessment</Text></View>
          <Text style={styles.noDataText}>No post dialysis assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Post Dialysis Assessment</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              {record.createdAt && (
                <View style={styles.recordDateRow}><Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text></View>
              )}
              <Text style={styles.recordTitle}>Post Dialysis Assessment {idx + 1}</Text>
            </View>

            {/* 1. Provider Details */}
            {(() => {
              const fields = [
                record.createdAt ? ['Date', formatDate(record.createdAt)] : null,
              ].filter(Boolean);
              if (fields.length === 0) return null;
              return (
                <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Provider Details</Text>
                  {fields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 2. Session Parameters */}
            {(() => {
              const fields = [
                formatValue(record.dialysisSessionDuration) !== null ? ['Session Duration', `${record.dialysisSessionDuration} min`] : null,
                formatValue(record.dialyzerType) !== null ? ['Dialyzer Type', safeString(record.dialyzerType)] : null,
                formatValue(record.bloodFlowRate) !== null ? ['Blood Flow Rate', `${record.bloodFlowRate} mL/min`] : null,
                formatValue(record.dialysateFlowRate) !== null ? ['Dialysate Flow Rate', `${record.dialysateFlowRate} mL/min`] : null,
                formatValue(record.anticoagulationProtocol) !== null ? ['Anticoagulation Protocol', safeString(record.anticoagulationProtocol)] : null,
              ].filter(Boolean);
              if (fields.length === 0) return null;
              return (
                <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Session Parameters</Text>
                  {fields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 3. Vital Signs */}
            {(() => {
              const fields = [
                formatValue(record.preDialysisSystolicBP) !== null ? ['Pre-Dialysis Systolic BP', `${record.preDialysisSystolicBP} mmHg`] : null,
                formatValue(record.postDialysisSystolicBP) !== null ? ['Post-Dialysis Systolic BP', `${record.postDialysisSystolicBP} mmHg`] : null,
                formatValue(record.preDialysisDiastolicBP) !== null ? ['Pre-Dialysis Diastolic BP', `${record.preDialysisDiastolicBP} mmHg`] : null,
                formatValue(record.postDialysisDiastolicBP) !== null ? ['Post-Dialysis Diastolic BP', `${record.postDialysisDiastolicBP} mmHg`] : null,
                formatValue(record.preDialysisWeight) !== null ? ['Pre-Dialysis Weight', `${record.preDialysisWeight} kg`] : null,
                formatValue(record.postDialysisWeight) !== null ? ['Post-Dialysis Weight', `${record.postDialysisWeight} kg`] : null,
              ].filter(Boolean);
              if (fields.length === 0) return null;
              return (
                <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Vital Signs</Text>
                  {fields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 4. Fluid Management */}
            {(() => {
              const singleFields = [
                formatValue(record.fluidRemovalVolume) !== null ? ['Fluid Removal Volume', `${record.fluidRemovalVolume} mL`] : null,
                formatValue(record.ultrafiltrationRate) !== null ? ['Ultrafiltration Rate', `${record.ultrafiltrationRate} mL/hr`] : null,
              ].filter(Boolean);
              const dwItems = record.dryWeightAssessment ? splitBySentence(record.dryWeightAssessment) : [];
              if (singleFields.length === 0 && dwItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={(singleFields.length + dwItems.length) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Fluid Management</Text>
                  {singleFields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                  {dwItems.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Dry Weight Assessment</Text>
                      {dwItems.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 5. Dialysis Adequacy */}
            {(() => {
              const fields = [
                formatValue(record.ktVRatio) !== null ? ['Kt/V Ratio', String(record.ktVRatio)] : null,
                formatValue(record.ureaReductionRatio) !== null ? ['Urea Reduction Ratio', `${record.ureaReductionRatio}%`] : null,
              ].filter(Boolean);
              if (fields.length === 0) return null;
              return (
                <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Dialysis Adequacy</Text>
                  {fields.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 6. Vascular Access */}
            {(() => {
              const accessType = formatValue(record.accessType);
              const afItems = record.accessFunctionStatus ? splitBySentence(record.accessFunctionStatus) : [];
              if (accessType === null && afItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={((accessType !== null ? 1 : 0) + afItems.length) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Vascular Access</Text>
                  {accessType !== null && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Access Type</Text>
                      <Text style={styles.fieldValue}>{accessType}</Text>
                    </View>
                  )}
                  {afItems.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Access Function Status</Text>
                      {afItems.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 7. Complications & Symptoms */}
            {(() => {
              const hypotension = formatValue(record.intradialyticHypotensionOccurred);
              const cramps = formatValue(record.muscleCrampsReported);
              const deqSymptoms = Array.isArray(record.disequilibriumSyndromeSymptoms) ? record.disequilibriumSyndromeSymptoms.filter(Boolean) : [];
              const sessionComps = Array.isArray(record.sessionComplications) ? record.sessionComplications.filter(Boolean) : [];
              if (hypotension === null && cramps === null && deqSymptoms.length === 0 && sessionComps.length === 0) return null;
              const compRows = (hypotension !== null ? 1 : 0) + (cramps !== null ? 1 : 0) + deqSymptoms.length + sessionComps.length;
              return (
                <View style={styles.section} wrap={compRows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Complications & Symptoms</Text>
                  {hypotension !== null && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Intradialytic Hypotension</Text>
                      <Text style={styles.fieldValue}>{hypotension}</Text>
                    </View>
                  )}
                  {cramps !== null && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Muscle Cramps</Text>
                      <Text style={styles.fieldValue}>{cramps}</Text>
                    </View>
                  )}
                  {deqSymptoms.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Disequilibrium Syndrome Symptoms</Text>
                      {deqSymptoms.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                      ))}
                    </View>
                  )}
                  {sessionComps.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Session Complications</Text>
                      {sessionComps.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 8. Recovery & Follow-up */}
            {(() => {
              const electrolyteItems = record.electrolyteLevelsPostDialysis ? splitByComma(record.electrolyteLevelsPostDialysis) : [];
              const residual = formatValue(record.residualRenalFunction);
              const recoveryTime = formatValue(record.postDialysisRecoveryTime);
              if (electrolyteItems.length === 0 && residual === null && recoveryTime === null) return null;
              const recoveryRows = electrolyteItems.length + (residual !== null ? 1 : 0) + (recoveryTime !== null ? 1 : 0);
              return (
                <View style={styles.section} wrap={recoveryRows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recovery & Follow-up</Text>
                  {electrolyteItems.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Electrolyte Levels</Text>
                      {electrolyteItems.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
                      ))}
                    </View>
                  )}
                  {residual !== null && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Residual Renal Function</Text>
                      <Text style={styles.fieldValue}>{residual}</Text>
                    </View>
                  )}
                  {recoveryTime !== null && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Recovery Time</Text>
                      <Text style={styles.fieldValue}>{record.postDialysisRecoveryTime} min</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default PostDialysisAssessmentDocumentPDFTemplate;
