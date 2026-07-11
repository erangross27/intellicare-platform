import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 20,
  },
  recordHeader: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  metaItem: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBox: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 11,
    lineHeight: 1.4,
    color: '#000000',
  },
  listItem: {
    fontSize: 11,
    paddingLeft: 8,
    marginBottom: 3,
    lineHeight: 1.4,
    color: '#000000',
  },
});

/* ═══════ HELPERS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
};

const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ═══════ PDF COMPONENTS ═══════ */
const renderField = (sectionTitle, label, value) => {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      <Text style={styles.fieldValue}>{safeString(String(value))}</Text>
    </View>
  );
};

const renderSentenceField = (sectionTitle, label, text) => {
  const sentences = splitIntoSentences(safeString(text));
  if (sentences.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      {sentences.map((s, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
      ))}
    </View>
  );
};

/* ═══════ MAIN TEMPLATE ═══════ */
const VisionTherapyAssessmentDocumentPDFTemplate = ({ document: docProp, records: recordsProp }) => {
  let data = docProp || recordsProp || [];
  if (!Array.isArray(data)) {
    if (data?.vision_therapy_assessment) data = Array.isArray(data.vision_therapy_assessment) ? data.vision_therapy_assessment : [data.vision_therapy_assessment];
    else if (data?.records && Array.isArray(data.records)) data = data.records;
    else if (data?.data && Array.isArray(data.data)) data = data.data;
    else if (data?._id || data?.patientVisualAcuityOD) data = [data];
    else data = [];
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Vision Therapy Assessment</Text>

        {data.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Vision Therapy Assessment {idx + 1}</Text>
              {hasValue(record.createdAt) && <Text style={styles.metaItem}>Date: {formatDate(record.createdAt)}</Text>}
            </View>

            {/* Visual Acuity */}
            <View style={styles.section}>
              {(hasValue(record.patientVisualAcuityOD) || hasValue(record.patientVisualAcuityOS)) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Visual Acuity</Text>
                  {hasValue(record.patientVisualAcuityOD) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Visual Acuity OD (Right Eye)</Text><Text style={styles.fieldValue}>{safeString(record.patientVisualAcuityOD)}</Text></View>)}
                  {hasValue(record.patientVisualAcuityOS) && (<View><Text style={styles.fieldLabel}>Visual Acuity OS (Left Eye)</Text><Text style={styles.fieldValue}>{safeString(record.patientVisualAcuityOS)}</Text></View>)}
                </View>
              )}
            </View>

            {/* Convergence */}
            <View style={styles.section}>
              {(hasValue(record.nearPointConvergenceBreak) || hasValue(record.nearPointConvergenceRecovery) || hasValue(record.convergenceInsufficiencySymptomScore)) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Convergence</Text>
                  {hasValue(record.nearPointConvergenceBreak) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Near Point of Convergence Break (cm)</Text><Text style={styles.fieldValue}>{safeString(String(record.nearPointConvergenceBreak))}</Text></View>)}
                  {hasValue(record.nearPointConvergenceRecovery) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Near Point of Convergence Recovery (cm)</Text><Text style={styles.fieldValue}>{safeString(String(record.nearPointConvergenceRecovery))}</Text></View>)}
                  {hasValue(record.convergenceInsufficiencySymptomScore) && (<View><Text style={styles.fieldLabel}>Convergence Insufficiency Symptom Score</Text><Text style={styles.fieldValue}>{safeString(String(record.convergenceInsufficiencySymptomScore))}</Text></View>)}
                </View>
              )}
            </View>

            {/* Accommodation */}
            <View style={styles.section}>
              {(hasValue(record.accommodativeAmplitudeOD) || hasValue(record.accommodativeAmplitudeOS) || hasValue(record.accommodativeFacilityOD) || hasValue(record.accommodativeFacilityOS) || hasValue(record.binocularAccommodativeFacility) || hasValue(record.positiveRelativeAccommodation) || hasValue(record.negativeRelativeAccommodation)) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Accommodation</Text>
                  {hasValue(record.accommodativeAmplitudeOD) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Accommodative Amplitude OD (D)</Text><Text style={styles.fieldValue}>{safeString(String(record.accommodativeAmplitudeOD))}</Text></View>)}
                  {hasValue(record.accommodativeAmplitudeOS) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Accommodative Amplitude OS (D)</Text><Text style={styles.fieldValue}>{safeString(String(record.accommodativeAmplitudeOS))}</Text></View>)}
                  {hasValue(record.accommodativeFacilityOD) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Accommodative Facility OD (cpm)</Text><Text style={styles.fieldValue}>{safeString(String(record.accommodativeFacilityOD))}</Text></View>)}
                  {hasValue(record.accommodativeFacilityOS) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Accommodative Facility OS (cpm)</Text><Text style={styles.fieldValue}>{safeString(String(record.accommodativeFacilityOS))}</Text></View>)}
                  {hasValue(record.binocularAccommodativeFacility) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Binocular Accommodative Facility (cpm)</Text><Text style={styles.fieldValue}>{safeString(String(record.binocularAccommodativeFacility))}</Text></View>)}
                  {hasValue(record.positiveRelativeAccommodation) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Positive Relative Accommodation (D)</Text><Text style={styles.fieldValue}>{safeString(String(record.positiveRelativeAccommodation))}</Text></View>)}
                  {hasValue(record.negativeRelativeAccommodation) && (<View><Text style={styles.fieldLabel}>Negative Relative Accommodation (D)</Text><Text style={styles.fieldValue}>{safeString(String(record.negativeRelativeAccommodation))}</Text></View>)}
                </View>
              )}
            </View>

            {/* Vergence & Phoria */}
            <View style={styles.section}>
              {(hasValue(record.vergenceFacilityScore) || hasValue(record.horizontalPhoriaDistance) || hasValue(record.horizontalPhoriaNear) || hasValue(record.verticalPhoriaDistance) || hasValue(record.positiveVergenceAtNear) || hasValue(record.negativeVergenceAtNear)) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Vergence & Phoria</Text>
                  {hasValue(record.vergenceFacilityScore) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Vergence Facility Score (cpm)</Text><Text style={styles.fieldValue}>{safeString(String(record.vergenceFacilityScore))}</Text></View>)}
                  {hasValue(record.horizontalPhoriaDistance) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Horizontal Phoria at Distance</Text><Text style={styles.fieldValue}>{safeString(record.horizontalPhoriaDistance)}</Text></View>)}
                  {hasValue(record.horizontalPhoriaNear) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Horizontal Phoria at Near</Text><Text style={styles.fieldValue}>{safeString(record.horizontalPhoriaNear)}</Text></View>)}
                  {hasValue(record.verticalPhoriaDistance) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Vertical Phoria at Distance</Text><Text style={styles.fieldValue}>{safeString(record.verticalPhoriaDistance)}</Text></View>)}
                  {hasValue(record.positiveVergenceAtNear) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Positive Vergence at Near</Text><Text style={styles.fieldValue}>{safeString(record.positiveVergenceAtNear)}</Text></View>)}
                  {hasValue(record.negativeVergenceAtNear) && (<View><Text style={styles.fieldLabel}>Negative Vergence at Near</Text><Text style={styles.fieldValue}>{safeString(record.negativeVergenceAtNear)}</Text></View>)}
                </View>
              )}
            </View>

            {/* Binocular Vision */}
            {hasValue(record.stereopsisScore) && renderField('Binocular Vision', 'Stereopsis Score (arc sec)', record.stereopsisScore)}

            {/* Eye Movements */}
            <View style={styles.section}>
              {(hasValue(record.saccadicFixationAbility) || hasValue(record.pursuitMovementQuality) || hasValue(record.developmentalEyeMovementScore) || hasValue(record.kingDevickTestTime)) && (
                <>
                  {hasValue(record.saccadicFixationAbility) && renderSentenceField('Eye Movements', 'Saccadic Fixation Ability', record.saccadicFixationAbility)}
                  {hasValue(record.pursuitMovementQuality) && renderSentenceField(hasValue(record.saccadicFixationAbility) ? null : 'Eye Movements', 'Pursuit Movement Quality', record.pursuitMovementQuality)}
                  {hasValue(record.developmentalEyeMovementScore) && renderField((!hasValue(record.saccadicFixationAbility) && !hasValue(record.pursuitMovementQuality)) ? 'Eye Movements' : null, 'Developmental Eye Movement Score', record.developmentalEyeMovementScore)}
                  {hasValue(record.kingDevickTestTime) && renderField(null, 'King-Devick Test Time (sec)', record.kingDevickTestTime)}
                </>
              )}
            </View>

            {/* Visual Processing */}
            <View style={styles.section}>
              {(hasValue(record.visualMotorIntegrationPercentile) || hasValue(record.visualPerceptionPercentile)) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Visual Processing</Text>
                  {hasValue(record.visualMotorIntegrationPercentile) && (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Visual Motor Integration Percentile</Text><Text style={styles.fieldValue}>{safeString(String(record.visualMotorIntegrationPercentile))}</Text></View>)}
                  {hasValue(record.visualPerceptionPercentile) && (<View><Text style={styles.fieldLabel}>Visual Perception Percentile</Text><Text style={styles.fieldValue}>{safeString(String(record.visualPerceptionPercentile))}</Text></View>)}
                </View>
              )}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default VisionTherapyAssessmentDocumentPDFTemplate;
