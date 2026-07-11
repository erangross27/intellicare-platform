import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

const safeString = (val) => (val != null && val !== '') ? String(val) : '';

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date.$date || date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(date);
  }
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    padding: 40,
    backgroundColor: '#ffffff',
  },
  documentHeader: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '2 solid #000000',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  recordContainer: {
    marginBottom: 20,
  },
  recordHeader: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    paddingBottom: 4,
    borderBottom: '1 solid #000000',
  },
  fieldBox: {
    marginBottom: 10,
    paddingVertical: 2,
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
    color: '#000000',
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
  noData: {
    fontSize: 14,
    color: '#000000',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
});

const RespiratoryMedicationsDocumentPDFTemplate = ({ document: doc }) => {
  // Unwrap data structure
  let data = null;
  if (Array.isArray(doc)) {
    data = { respiratory_medications: doc };
  } else if (doc?.respiratory_medications) {
    data = { respiratory_medications: Array.isArray(doc.respiratory_medications) ? doc.respiratory_medications : [doc.respiratory_medications] };
  } else if (doc?.data?.respiratory_medications) {
    data = { respiratory_medications: Array.isArray(doc.data.respiratory_medications) ? doc.data.respiratory_medications : [doc.data.respiratory_medications] };
  } else {
    data = { respiratory_medications: [] };
  }

  const medsArray = filterNulls(data.respiratory_medications || []);

  if (!medsArray || medsArray.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Respiratory Medications</Text>
          </View>
          <Text style={styles.noData}>No respiratory medication records found</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Respiratory Medications</Text>
        </View>

        {medsArray.map((med, idx) => (
          // Rule #75: each record after the first starts on a NEW page (multi-record docs).
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            {/* Record Header + First Section together to prevent orphaning */}
            {(med.genericName || med.dosage || med.frequency || med.route) ? (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.recordHeader}>
                  {safeString(med.name) || `Respiratory Medication ${idx + 1}`}
                </Text>
                <Text style={styles.sectionTitle}>Medication Information</Text>
                {med.genericName && (
                  <View>
                    <Text style={styles.subtitleLabel}>Generic Name</Text>
                    <Text style={styles.fieldValue}>{safeString(med.genericName)}</Text>
                  </View>
                )}
                {med.dosage && (
                  <View>
                    <Text style={styles.subtitleLabel}>Dosage</Text>
                    <Text style={styles.fieldValue}>{safeString(med.dosage)}</Text>
                  </View>
                )}
                {med.frequency && (
                  <View>
                    <Text style={styles.subtitleLabel}>Frequency</Text>
                    <Text style={styles.fieldValue}>{safeString(med.frequency)}</Text>
                  </View>
                )}
                {med.route && (
                  <View>
                    <Text style={styles.subtitleLabel}>Route</Text>
                    <Text style={styles.fieldValue}>{safeString(med.route)}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View wrap={false}>
                <Text style={styles.recordHeader}>
                  {safeString(med.name) || `Respiratory Medication ${idx + 1}`}
                </Text>
              </View>
            )}

            {/* Controller Medications */}
            {med.controllers && filterNulls(med.controllers).length > 0 && (() => {
              const controllers = filterNulls(med.controllers);
              return (
                <View style={styles.fieldBox} wrap={controllers.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Controller Medications</Text>
                  {controllers.map((controller, cIdx) => (
                    <View key={cIdx} style={{ marginBottom: cIdx < controllers.length - 1 ? 6 : 0 }}>
                      <Text style={styles.arrayItem}>{cIdx + 1}. {safeString(controller.medication) || 'N/A'}</Text>
                      {controller.class && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Class</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.class)}</Text>
                        </View>
                      )}
                      {controller.dose && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Dose</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.dose)}</Text>
                        </View>
                      )}
                      {controller.frequency && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Frequency</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.frequency)}</Text>
                        </View>
                      )}
                      {controller.device && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Device</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.device)}</Text>
                        </View>
                      )}
                      {controller.technique && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Technique</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.technique)}</Text>
                        </View>
                      )}
                      {controller.adherence && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Adherence</Text>
                          <Text style={styles.fieldValue}>{safeString(controller.adherence)}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Reliever Medications */}
            {med.relievers && filterNulls(med.relievers).length > 0 && (() => {
              const relievers = filterNulls(med.relievers);
              return (
                <View style={styles.fieldBox} wrap={relievers.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Reliever Medications</Text>
                  {relievers.map((reliever, rIdx) => (
                    <View key={rIdx} style={{ marginBottom: rIdx < relievers.length - 1 ? 6 : 0 }}>
                      <Text style={styles.arrayItem}>{rIdx + 1}. {safeString(reliever.medication) || 'N/A'}</Text>
                      {reliever.dose && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Dose</Text>
                          <Text style={styles.fieldValue}>{safeString(reliever.dose)}</Text>
                        </View>
                      )}
                      {reliever.frequency && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Frequency</Text>
                          <Text style={styles.fieldValue}>{safeString(reliever.frequency)}</Text>
                        </View>
                      )}
                      {reliever.maxDailyUse && (
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.subtitleLabel}>Max Daily Use</Text>
                          <Text style={styles.fieldValue}>{safeString(reliever.maxDailyUse)}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Biologic Therapy */}
            {med.biologics && (med.biologics.medication || med.biologics.dose) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Biologic Therapy</Text>
                {med.biologics.medication && (
                  <View>
                    <Text style={styles.subtitleLabel}>Medication</Text>
                    <Text style={styles.fieldValue}>{safeString(med.biologics.medication)}</Text>
                  </View>
                )}
                {med.biologics.dose && (
                  <View>
                    <Text style={styles.subtitleLabel}>Dose</Text>
                    <Text style={styles.fieldValue}>{safeString(med.biologics.dose)}</Text>
                  </View>
                )}
                {med.biologics.frequency && (
                  <View>
                    <Text style={styles.subtitleLabel}>Frequency</Text>
                    <Text style={styles.fieldValue}>{safeString(med.biologics.frequency)}</Text>
                  </View>
                )}
                {med.biologics.route && (
                  <View>
                    <Text style={styles.subtitleLabel}>Route</Text>
                    <Text style={styles.fieldValue}>{safeString(med.biologics.route)}</Text>
                  </View>
                )}
                {med.biologics.startDate && (
                  <View>
                    <Text style={styles.subtitleLabel}>Start Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(med.biologics.startDate)}</Text>
                  </View>
                )}
                {med.biologics.response && (
                  <View>
                    <Text style={styles.subtitleLabel}>Response</Text>
                    <Text style={styles.fieldValue}>{safeString(med.biologics.response)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Nebulizer Medications */}
            {med.nebulizers && filterNulls(med.nebulizers).length > 0 && (() => {
              const nebulizers = filterNulls(med.nebulizers);
              return (
                <View style={styles.fieldBox} wrap={nebulizers.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Nebulizer Medications</Text>
                  {nebulizers.map((neb, nIdx) => (
                    <Text key={nIdx} style={styles.arrayItem}>{nIdx + 1}. {safeString(neb)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Oral Corticosteroids */}
            {med.oralCorticosteroids && (med.oralCorticosteroids.current !== undefined || med.oralCorticosteroids.dose) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Oral Corticosteroids</Text>
                {med.oralCorticosteroids.current !== undefined && (
                  <View>
                    <Text style={styles.subtitleLabel}>Current</Text>
                    <Text style={styles.fieldValue}>{med.oralCorticosteroids.current ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {med.oralCorticosteroids.dose && (
                  <View>
                    <Text style={styles.subtitleLabel}>Dose</Text>
                    <Text style={styles.fieldValue}>{safeString(med.oralCorticosteroids.dose)}</Text>
                  </View>
                )}
                {med.oralCorticosteroids.duration && (
                  <View>
                    <Text style={styles.subtitleLabel}>Duration</Text>
                    <Text style={styles.fieldValue}>{safeString(med.oralCorticosteroids.duration)}</Text>
                  </View>
                )}
                {med.oralCorticosteroids.taperSchedule && (
                  <View>
                    <Text style={styles.subtitleLabel}>Taper Schedule</Text>
                    <Text style={styles.fieldValue}>{safeString(med.oralCorticosteroids.taperSchedule)}</Text>
                  </View>
                )}
                {med.oralCorticosteroids.yearlyBursts !== undefined && (
                  <View>
                    <Text style={styles.subtitleLabel}>Yearly Bursts</Text>
                    <Text style={styles.fieldValue}>{safeString(med.oralCorticosteroids.yearlyBursts)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Additional Information */}
            {(med.startDate || med.endDate || med.duration || (med.durationDays !== undefined && med.durationDays !== null && parseFloat(med.durationDays) !== 0) || med.durationUnit || med.prescriber || med.indication || med.instructions || (med.refills !== undefined && med.refills !== null && parseFloat(med.refills) !== 0) || med.active !== undefined || (med.sideEffects && filterNulls(med.sideEffects).length > 0) || med.safetyWarning) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Additional Information</Text>
                {med.startDate && (
                  <View>
                    <Text style={styles.subtitleLabel}>Start Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(med.startDate)}</Text>
                  </View>
                )}
                {med.endDate && (
                  <View>
                    <Text style={styles.subtitleLabel}>End Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(med.endDate)}</Text>
                  </View>
                )}
                {med.duration && (
                  <View>
                    <Text style={styles.subtitleLabel}>Duration</Text>
                    <Text style={styles.fieldValue}>{safeString(med.duration)}</Text>
                  </View>
                )}
                {med.durationDays !== undefined && med.durationDays !== null && !isNaN(parseFloat(med.durationDays)) && parseFloat(med.durationDays) !== 0 && (
                  <View>
                    <Text style={styles.subtitleLabel}>Duration (Days)</Text>
                    <Text style={styles.fieldValue}>{String(parseFloat(med.durationDays))}</Text>
                  </View>
                )}
                {med.durationUnit && (
                  <View>
                    <Text style={styles.subtitleLabel}>Duration Unit</Text>
                    <Text style={styles.fieldValue}>{safeString(med.durationUnit)}</Text>
                  </View>
                )}
                {med.prescriber && (
                  <View>
                    <Text style={styles.subtitleLabel}>Prescriber</Text>
                    <Text style={styles.fieldValue}>{safeString(med.prescriber)}</Text>
                  </View>
                )}
                {med.indication && (
                  <View>
                    <Text style={styles.subtitleLabel}>Indication</Text>
                    <Text style={styles.fieldValue}>{safeString(med.indication)}</Text>
                  </View>
                )}
                {med.instructions && (
                  <View>
                    <Text style={styles.subtitleLabel}>Instructions</Text>
                    <Text style={styles.fieldValue}>{safeString(med.instructions)}</Text>
                  </View>
                )}
                {med.refills !== undefined && med.refills !== null && !isNaN(parseFloat(med.refills)) && parseFloat(med.refills) !== 0 && (
                  <View>
                    <Text style={styles.subtitleLabel}>Refills</Text>
                    <Text style={styles.fieldValue}>{String(parseFloat(med.refills))}</Text>
                  </View>
                )}
                {med.active !== undefined && (
                  <View>
                    <Text style={styles.subtitleLabel}>Status</Text>
                    <Text style={styles.fieldValue}>{med.active ? 'Active' : 'Discontinued'}</Text>
                  </View>
                )}
                {med.sideEffects && filterNulls(med.sideEffects).length > 0 && (
                  <View>
                    <Text style={styles.subtitleLabel}>Side Effects</Text>
                    {filterNulls(med.sideEffects).map((se, seIdx) => (
                      <Text key={seIdx} style={styles.arrayItem}>{seIdx + 1}. {safeString(se)}</Text>
                    ))}
                  </View>
                )}
                {med.safetyWarning && (
                  <View>
                    <Text style={styles.subtitleLabel}>Safety Warning</Text>
                    <Text style={styles.fieldValue}>{safeString(med.safetyWarning)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RespiratoryMedicationsDocumentPDFTemplate;
