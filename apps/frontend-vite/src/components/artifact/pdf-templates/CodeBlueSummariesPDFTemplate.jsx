import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

/**
 * Code Blue Summaries PDF Template - February 2026
 * Professional Black & White Format for Printing
 *
 * Title-inside-fieldBox pattern (rule #45): sectionTitle rendered INSIDE fieldBox
 * wrap={false} strategy: fieldBox <=8 items -> wrap={false}, >8 -> undefined
 * NO borderBottom on sectionTitle (causes react-pdf orphaning)
 */

const safeString = (str) => {
  if (!str) return '';
  if (typeof str === 'boolean') return str ? 'Yes' : 'No';
  return String(str)
    .replace(/\u00b0/g, 'deg')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00f7/g, '/')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 11,
    color: '#444444',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
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
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 11,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  noRecords: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
});

const CodeBlueSummariesPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'boolean') return true;
    if (typeof val === 'number') return true;
    return true;
  };

  const safeArray = (val) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    return [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatWithUnit = (val, unit) => {
    if (val === null || val === undefined) return '';
    return `${val} ${unit}`;
  };

  const getRecords = () => {
    if (!templateData) return [];
    let recordsArray = Array.isArray(templateData) ? templateData : [templateData];
    recordsArray = recordsArray.flatMap(record => {
      if (record?._records && Array.isArray(record._records)) return record._records;
      if (record?.records && Array.isArray(record.records)) return record.records;
      if (record?.code_blue_summaries && Array.isArray(record.code_blue_summaries)) return record.code_blue_summaries;
      if (record?.documentData) {
        const docData = record.documentData;
        if (Array.isArray(docData)) return docData;
        if (docData?.code_blue_summaries) return Array.isArray(docData.code_blue_summaries) ? docData.code_blue_summaries : [docData.code_blue_summaries];
        return [docData];
      }
      return record;
    });
    return recordsArray.filter(record => record && typeof record === 'object');
  };

  const records = getRecords();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Code Blue Summaries</Text>
          <Text style={styles.documentSubtitle}>Cardiac Arrest Response Documentation</Text>
        </View>

        {records.length === 0 ? (
          <Text style={styles.noRecords}>No code blue summary records available.</Text>
        ) : (
          records.map((record, index) => {
            const vasopressorsArr = safeArray(record.vasopressorsAdministered);

            return (
              <View key={record._id || index} style={styles.recordContainer}>
                {/* Record Header */}
                <View style={styles.recordHeader} wrap={false}>
                  <Text style={styles.recordTitle}>
                    {safeString(`Code Blue Summary ${index + 1}`)}
                  </Text>
                  {(record.codeBlueActivationTime || record.createdAt) && (
                    <Text style={styles.recordDate}>Date: {formatDate(record.codeBlueActivationTime || record.createdAt)}</Text>
                  )}
                </View>

                {/* Section 1: Code Blue Activation (multi-field) */}
                {(hasValue(record.codeBlueActivationTime) || hasValue(record.locationOfCodeBlue) ||
                  hasValue(record.initialRhythm) || hasValue(record.witnessedArrest) || hasValue(record.teamLeaderRole)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Code Blue Activation</Text>
                      {hasValue(record.codeBlueActivationTime) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Activation Time</Text>
                          <Text style={styles.fieldValue}>{safeString(formatDateTime(record.codeBlueActivationTime))}</Text>
                        </View>
                      )}
                      {hasValue(record.locationOfCodeBlue) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Location</Text>
                          <Text style={styles.fieldValue}>{safeString(record.locationOfCodeBlue)}</Text>
                        </View>
                      )}
                      {hasValue(record.initialRhythm) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Initial Rhythm</Text>
                          <Text style={styles.fieldValue}>{safeString(record.initialRhythm)}</Text>
                        </View>
                      )}
                      {hasValue(record.witnessedArrest) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Witnessed Arrest</Text>
                          <Text style={styles.fieldValue}>{safeString(record.witnessedArrest)}</Text>
                        </View>
                      )}
                      {hasValue(record.teamLeaderRole) && (
                        <View>
                          <Text style={styles.fieldLabel}>Team Leader</Text>
                          <Text style={styles.fieldValue}>{safeString(record.teamLeaderRole)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 2: Precipitating Factor (single-name, Rule #47) */}
                {hasValue(record.precipitatingFactor) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Precipitating Factor</Text>
                      <Text style={styles.fieldValue}>{safeString(record.precipitatingFactor)}</Text>
                    </View>
                  </View>
                )}

                {/* Section 3: CPR Details (multi-field) */}
                {(hasValue(record.cprStartTime) || hasValue(record.cprEndTime) ||
                  hasValue(record.totalCprDuration) || hasValue(record.acslsProtocolFollowed)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>CPR Details</Text>
                      {hasValue(record.cprStartTime) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>CPR Start Time</Text>
                          <Text style={styles.fieldValue}>{safeString(formatDateTime(record.cprStartTime))}</Text>
                        </View>
                      )}
                      {hasValue(record.cprEndTime) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>CPR End Time</Text>
                          <Text style={styles.fieldValue}>{safeString(formatDateTime(record.cprEndTime))}</Text>
                        </View>
                      )}
                      {hasValue(record.totalCprDuration) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Total CPR Duration</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.totalCprDuration, 'minutes'))}</Text>
                        </View>
                      )}
                      {hasValue(record.acslsProtocolFollowed) && (
                        <View>
                          <Text style={styles.fieldLabel}>ACLS Protocol Followed</Text>
                          <Text style={styles.fieldValue}>{safeString(record.acslsProtocolFollowed)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 4: Defibrillation & Medications (multi-field + array) */}
                {(hasValue(record.numberOfDefibrillations) || hasValue(record.epinephrineAdministered) ||
                  hasValue(record.epinephrineDoses) || hasValue(record.amiodaroneAdministered) ||
                  hasValue(record.sodiumBicarbonateGiven) || vasopressorsArr.length > 0) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Defibrillation & Medications</Text>
                      {hasValue(record.numberOfDefibrillations) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Number of Defibrillations</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.numberOfDefibrillations))}</Text>
                        </View>
                      )}
                      {hasValue(record.epinephrineAdministered) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Epinephrine Administered</Text>
                          <Text style={styles.fieldValue}>{safeString(record.epinephrineAdministered)}</Text>
                        </View>
                      )}
                      {hasValue(record.epinephrineDoses) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Epinephrine Doses</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.epinephrineDoses))}</Text>
                        </View>
                      )}
                      {hasValue(record.amiodaroneAdministered) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Amiodarone Administered</Text>
                          <Text style={styles.fieldValue}>{safeString(record.amiodaroneAdministered)}</Text>
                        </View>
                      )}
                      {hasValue(record.sodiumBicarbonateGiven) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Sodium Bicarbonate Given</Text>
                          <Text style={styles.fieldValue}>{safeString(record.sodiumBicarbonateGiven)}</Text>
                        </View>
                      )}
                      {vasopressorsArr.length > 0 && (
                        <View>
                          <Text style={styles.fieldLabel}>Vasopressors Administered</Text>
                          {vasopressorsArr.map((item, i) => (
                            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 5: Airway Management (multi-field) */}
                {(hasValue(record.intubationPerformed) || hasValue(record.intubationAttempts) || hasValue(record.endTidalCo2)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Airway Management</Text>
                      {hasValue(record.intubationPerformed) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Intubation Performed</Text>
                          <Text style={styles.fieldValue}>{safeString(record.intubationPerformed)}</Text>
                        </View>
                      )}
                      {hasValue(record.intubationAttempts) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Intubation Attempts</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.intubationAttempts))}</Text>
                        </View>
                      )}
                      {hasValue(record.endTidalCo2) && (
                        <View>
                          <Text style={styles.fieldLabel}>End-Tidal CO2</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.endTidalCo2, 'mmHg'))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 6: ROSC & Outcome (multi-field) */}
                {(hasValue(record.returnOfSpontaneousCirculation) || hasValue(record.roscTime) ||
                  hasValue(record.timeToRosc) || hasValue(record.codeBlueOutcome)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>ROSC & Outcome</Text>
                      {hasValue(record.returnOfSpontaneousCirculation) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Return of Spontaneous Circulation</Text>
                          <Text style={styles.fieldValue}>{safeString(record.returnOfSpontaneousCirculation)}</Text>
                        </View>
                      )}
                      {hasValue(record.roscTime) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>ROSC Time</Text>
                          <Text style={styles.fieldValue}>{safeString(formatDateTime(record.roscTime))}</Text>
                        </View>
                      )}
                      {hasValue(record.timeToRosc) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Time to ROSC</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.timeToRosc, 'minutes'))}</Text>
                        </View>
                      )}
                      {hasValue(record.codeBlueOutcome) && (
                        <View>
                          <Text style={styles.fieldLabel}>Code Blue Outcome</Text>
                          <Text style={styles.fieldValue}>{safeString(record.codeBlueOutcome)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 7: Post-Resuscitation Care (multi-field) */}
                {(hasValue(record.targetedTemperatureManagement) || hasValue(record.utsteincriteriaMet)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Post-Resuscitation Care</Text>
                      {hasValue(record.targetedTemperatureManagement) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Targeted Temperature Management</Text>
                          <Text style={styles.fieldValue}>{safeString(record.targetedTemperatureManagement)}</Text>
                        </View>
                      )}
                      {hasValue(record.utsteincriteriaMet) && (
                        <View>
                          <Text style={styles.fieldLabel}>Utstein Criteria Met</Text>
                          <Text style={styles.fieldValue}>{safeString(record.utsteincriteriaMet)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default CodeBlueSummariesPDFTemplate;
