import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const safeString = (val) => (val != null && val !== '') ? String(val) : '';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))\.\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(Boolean);
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    padding: 40,
    backgroundColor: '#ffffff',
  },
  fieldBox: {
    marginBottom: 10,
    padding: 8,
    border: '1 solid #cccccc',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitleLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  arrayItem: {
    fontSize: 11,
    marginLeft: 10,
    marginBottom: 3,
    lineHeight: 1.5,
  },
  signature: {
    marginTop: 24,
    fontSize: 9,
    color: '#000000',
    fontStyle: 'italic',
    textAlign: 'right',
  },
});

const DischargeSummariesTemplate = ({ document: doc }) => {
  if (!doc) return null;

  return (
    <View>
      {/* Administrative Information */}
      {(doc.mrn || doc.admissionDate || doc.dischargeDate || doc.lengthOfStay || doc.attendingPhysician || doc.facility || doc.dischargeDisposition || doc.dischargeCondition) && (
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.sectionTitle}>Administrative Information</Text>
          {doc.mrn && (
            <View>
              <Text style={styles.subtitleLabel}>MRN</Text>
              <Text style={styles.fieldValue}>{safeString(doc.mrn)}</Text>
            </View>
          )}
          {doc.admissionDate && (
            <View>
              <Text style={styles.subtitleLabel}>Admission Date</Text>
              <Text style={styles.fieldValue}>{formatDate(doc.admissionDate)}</Text>
            </View>
          )}
          {doc.dischargeDate && (
            <View>
              <Text style={styles.subtitleLabel}>Discharge Date</Text>
              <Text style={styles.fieldValue}>{formatDate(doc.dischargeDate)}</Text>
            </View>
          )}
          {doc.lengthOfStay && (
            <View>
              <Text style={styles.subtitleLabel}>Length of Stay</Text>
              <Text style={styles.fieldValue}>{safeString(doc.lengthOfStay)}</Text>
            </View>
          )}
          {doc.attendingPhysician && (
            <View>
              <Text style={styles.subtitleLabel}>Attending Physician</Text>
              <Text style={styles.fieldValue}>{safeString(doc.attendingPhysician)}</Text>
            </View>
          )}
          {doc.facility && (
            <View>
              <Text style={styles.subtitleLabel}>Facility</Text>
              <Text style={styles.fieldValue}>{safeString(doc.facility)}</Text>
            </View>
          )}
          {doc.dischargeDisposition && (
            <View>
              <Text style={styles.subtitleLabel}>Disposition</Text>
              <Text style={styles.fieldValue}>{safeString(doc.dischargeDisposition)}</Text>
            </View>
          )}
          {doc.dischargeCondition && (
            <View>
              <Text style={styles.subtitleLabel}>Condition</Text>
              <Text style={styles.fieldValue}>{safeString(doc.dischargeCondition)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Diagnoses */}
      {(doc.admittingDiagnosis || doc.principalDiagnosis || (doc.secondaryDiagnoses && doc.secondaryDiagnoses.length > 0)) && (() => {
        const hasManySecondary = doc.secondaryDiagnoses && doc.secondaryDiagnoses.length > 8;
        return (
          <View style={styles.fieldBox} wrap={hasManySecondary ? undefined : false}>
            <Text style={styles.sectionTitle}>Diagnoses</Text>
            {doc.admittingDiagnosis && (
              <View>
                <Text style={styles.subtitleLabel}>Admitting Diagnosis</Text>
                <Text style={styles.fieldValue}>{safeString(doc.admittingDiagnosis)}</Text>
              </View>
            )}
            {doc.principalDiagnosis && (
              <View>
                <Text style={styles.subtitleLabel}>Principal Diagnosis</Text>
                <Text style={styles.fieldValue}>{safeString(doc.principalDiagnosis)}</Text>
              </View>
            )}
            {doc.secondaryDiagnoses && doc.secondaryDiagnoses.length > 0 && (
              <View>
                <Text style={styles.subtitleLabel}>Secondary Diagnoses</Text>
                {doc.secondaryDiagnoses.map((dx, i) => (
                  <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(dx)}</Text>
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Hospital Course */}
      {(doc.hospitalCourse || (doc._hospitalCourseSentences && doc._hospitalCourseSentences.length > 0)) && (() => {
        const sentences = doc._hospitalCourseSentences || splitBySentence(doc.hospitalCourse);
        return (
          <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
            <Text style={styles.sectionTitle}>Hospital Course</Text>
            {sentences.map((s, i) => (
              <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(s)}</Text>
            ))}
          </View>
        );
      })()}

      {/* Procedures Performed */}
      {doc.proceduresPerformed && doc.proceduresPerformed.length > 0 && (() => {
        return (
          <View style={styles.fieldBox} wrap={doc.proceduresPerformed.length > 8 ? undefined : false}>
            <Text style={styles.sectionTitle}>Procedures Performed</Text>
            {doc.proceduresPerformed.map((proc, i) => {
              const isStr = typeof proc === 'string';
              const procName = isStr ? proc : proc.name;
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.arrayItem}>
                    {i + 1}. {safeString(procName)}{!isStr && proc.status ? ` (${proc.status})` : ''}
                  </Text>
                  {!isStr && proc.findings && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Findings: {safeString(proc.findings)}
                    </Text>
                  )}
                  {!isStr && proc.notes && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Notes: {safeString(proc.notes)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Discharge Medications */}
      {doc.dischargeMedications && doc.dischargeMedications.length > 0 && (() => {
        return (
          <View style={styles.fieldBox} wrap={doc.dischargeMedications.length > 8 ? undefined : false}>
            <Text style={styles.sectionTitle}>Discharge Medications</Text>
            {doc.dischargeMedications.map((med, i) => {
              const isStr = typeof med === 'string';
              return (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={styles.arrayItem}>
                    {i + 1}. {safeString(isStr ? med : med.name)}
                    {!isStr && med.dosage ? ` ${med.dosage}` : ''}
                    {!isStr && med.frequency ? ` ${med.frequency}` : ''}
                    {!isStr && med.route ? ` (${med.route})` : ''}
                  </Text>
                  {!isStr && med.instructions && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Instructions: {safeString(med.instructions)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Discharge Instructions */}
      {doc.dischargeInstructions && (
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.sectionTitle}>Discharge Instructions</Text>
          <Text style={styles.fieldValue}>{safeString(doc.dischargeInstructions)}</Text>
        </View>
      )}

      {/* Activity & Diet */}
      {(doc.activityRestrictions || doc.dietRestrictions) && (
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.sectionTitle}>Activity & Diet</Text>
          {doc.activityRestrictions && (
            <View>
              <Text style={styles.subtitleLabel}>Activity Restrictions</Text>
              <Text style={styles.fieldValue}>{safeString(doc.activityRestrictions)}</Text>
            </View>
          )}
          {doc.dietRestrictions && (
            <View>
              <Text style={styles.subtitleLabel}>Diet</Text>
              <Text style={styles.fieldValue}>{safeString(doc.dietRestrictions)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Follow-Up Appointments */}
      {doc.followUpAppointments && doc.followUpAppointments.length > 0 && (() => {
        return (
          <View style={styles.fieldBox} wrap={doc.followUpAppointments.length > 8 ? undefined : false}>
            <Text style={styles.sectionTitle}>Follow-Up Appointments</Text>
            {doc.followUpAppointments.map((appt, i) => {
              const isStr = typeof appt === 'string';
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.arrayItem}>
                    {i + 1}. {safeString(isStr ? appt : appt.specialty)}
                    {!isStr && appt.status ? ` [${appt.status}]` : ''}
                  </Text>
                  {!isStr && appt.reason && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Reason: {safeString(appt.reason)}
                    </Text>
                  )}
                  {!isStr && appt.appointmentDate && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Date: {formatDate(appt.appointmentDate)}
                    </Text>
                  )}
                  {!isStr && appt.notes && (
                    <Text style={[styles.arrayItem, { marginLeft: 20, fontSize: 10 }]}>
                      Notes: {safeString(appt.notes)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Electronic Signature */}
      {doc.electronicSignature && (
        <Text style={styles.signature}>{safeString(doc.electronicSignature)}</Text>
      )}
    </View>
  );
};

export default DischargeSummariesTemplate;
