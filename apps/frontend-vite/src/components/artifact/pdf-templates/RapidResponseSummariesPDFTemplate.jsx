import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

/**
 * Rapid Response Summaries PDF Template - March 2026
 * Professional Black & White Format for Printing
 * Helvetica, LETTER size, 20pt title / 12pt body
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
    fontSize: 12,
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
    fontSize: 20,
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
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 12,
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

const RapidResponseSummariesPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  /* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a valid clinical reading (MEWS/NEWS/qSOFA
   * 0 = stable patient; fluid 0 mL = none given). All other numerics (vitals/labs/GCS/responseTime)
   * treat 0 as an unextracted sentinel and hide it — mirrors the on-screen document. */
  const MEANINGFUL_ZERO_FIELDS = ['mewsScore', 'newsScore', 'qsofaScore', 'fluidResuscitationVolume'];
  const hasValue = (val, fieldName) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'boolean') return true;
    if (typeof val === 'number') {
      if (val === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fieldName)) return false;
      return true;
    }
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

  const formatWithUnit = (val, unit) => {
    if (val === null || val === undefined) return '';
    return `${val} ${unit}`;
  };

  const splitTriggerCriteria = (text) => {
    if (!text) return [];
    return text.split(',').map(s => s.trim()).filter(Boolean);
  };

  const getRecords = () => {
    if (!templateData) return [];
    let recordsArray = Array.isArray(templateData) ? templateData : [templateData];
    recordsArray = recordsArray.flatMap(record => {
      if (record?._records && Array.isArray(record._records)) return record._records;
      if (record?.records && Array.isArray(record.records)) return record.records;
      if (record?.rapid_response_summaries && Array.isArray(record.rapid_response_summaries)) return record.rapid_response_summaries;
      if (record?.documentData) {
        const docData = record.documentData;
        if (Array.isArray(docData)) return docData;
        if (docData?.rapid_response_summaries) return Array.isArray(docData.rapid_response_summaries) ? docData.rapid_response_summaries : [docData.rapid_response_summaries];
        return [docData];
      }
      return record;
    });
    return recordsArray.filter(record => record && typeof record === 'object');
  };

  const records = getRecords();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Rapid Response Summaries</Text>
          <Text style={styles.documentSubtitle}>Rapid Response Team Activation Documentation</Text>
        </View>

        {records.length === 0 ? (
          <Text style={styles.noRecords}>No rapid response summary records available.</Text>
        ) : (
          records.map((record, index) => {
            const interventionsArr = safeArray(record.primaryInterventions);
            const vasoArr = safeArray(record.vasoactiveAgents);
            const triggerItems = splitTriggerCriteria(record.triggerCriteria);

            return (
              <View key={record._id || index} style={styles.recordContainer}>
                {/* Record Header */}
                <View style={styles.recordHeader} wrap={false}>
                  <Text style={styles.recordTitle}>
                    {safeString(`Rapid Response Summary ${index + 1}`)}
                  </Text>
                  {record.createdAt && (
                    <Text style={styles.recordDate}>Date: {formatDate(record.createdAt)}</Text>
                  )}
                </View>

                {/* Section 1: Response Details */}
                {(hasValue(record.responseTimeMinutes, 'responseTimeMinutes') || hasValue(record.triggerCriteria) || hasValue(record.glasgowComaScore, 'glasgowComaScore')) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Response Details</Text>
                      {hasValue(record.responseTimeMinutes, 'responseTimeMinutes') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Response Time</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.responseTimeMinutes, 'minutes'))}</Text>
                        </View>
                      )}
                      {triggerItems.length > 0 && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Trigger Criteria</Text>
                          {triggerItems.map((item, i) => (
                            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                          ))}
                        </View>
                      )}
                      {hasValue(record.glasgowComaScore, 'glasgowComaScore') && (
                        <View>
                          <Text style={styles.fieldLabel}>Glasgow Coma Score</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.glasgowComaScore))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 2: Vital Signs (8 fields) */}
                {(hasValue(record.systolicBloodPressure, 'systolicBloodPressure') || hasValue(record.diastolicBloodPressure, 'diastolicBloodPressure') ||
                  hasValue(record.meanArterialPressure, 'meanArterialPressure') || hasValue(record.heartRate, 'heartRate') || hasValue(record.respiratoryRate, 'respiratoryRate') ||
                  hasValue(record.oxygenSaturation, 'oxygenSaturation') || hasValue(record.coreTemperature, 'coreTemperature') || hasValue(record.fractionalInspiredOxygen, 'fractionalInspiredOxygen')) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Vital Signs</Text>
                      {hasValue(record.systolicBloodPressure, 'systolicBloodPressure') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Systolic Blood Pressure</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.systolicBloodPressure, 'mmHg'))}</Text>
                        </View>
                      )}
                      {hasValue(record.diastolicBloodPressure, 'diastolicBloodPressure') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Diastolic Blood Pressure</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.diastolicBloodPressure, 'mmHg'))}</Text>
                        </View>
                      )}
                      {hasValue(record.meanArterialPressure, 'meanArterialPressure') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Mean Arterial Pressure</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.meanArterialPressure, 'mmHg'))}</Text>
                        </View>
                      )}
                      {hasValue(record.heartRate, 'heartRate') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Heart Rate</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.heartRate, 'bpm'))}</Text>
                        </View>
                      )}
                      {hasValue(record.respiratoryRate, 'respiratoryRate') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Respiratory Rate</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.respiratoryRate, 'breaths/min'))}</Text>
                        </View>
                      )}
                      {hasValue(record.oxygenSaturation, 'oxygenSaturation') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Oxygen Saturation</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.oxygenSaturation, '%'))}</Text>
                        </View>
                      )}
                      {hasValue(record.coreTemperature, 'coreTemperature') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Core Temperature</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.coreTemperature, 'C'))}</Text>
                        </View>
                      )}
                      {hasValue(record.fractionalInspiredOxygen, 'fractionalInspiredOxygen') && (
                        <View>
                          <Text style={styles.fieldLabel}>FiO2</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.fractionalInspiredOxygen, '%'))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 3: Cardiac & Respiratory */}
                {(hasValue(record.cardiacRhythm) || hasValue(record.ventilationSupport)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Cardiac & Respiratory</Text>
                      {hasValue(record.cardiacRhythm) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Cardiac Rhythm</Text>
                          <Text style={styles.fieldValue}>{safeString(record.cardiacRhythm)}</Text>
                        </View>
                      )}
                      {hasValue(record.ventilationSupport) && (
                        <View>
                          <Text style={styles.fieldLabel}>Ventilation Support</Text>
                          <Text style={styles.fieldValue}>{safeString(record.ventilationSupport)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 4: Lab Values */}
                {(hasValue(record.lactateLevel, 'lactateLevel') || hasValue(record.bloodGlucose, 'bloodGlucose')) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Lab Values</Text>
                      {hasValue(record.lactateLevel, 'lactateLevel') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Lactate Level</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.lactateLevel, 'mmol/L'))}</Text>
                        </View>
                      )}
                      {hasValue(record.bloodGlucose, 'bloodGlucose') && (
                        <View>
                          <Text style={styles.fieldLabel}>Blood Glucose</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.bloodGlucose, 'mg/dL'))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 5: Clinical Scoring */}
                {(hasValue(record.mewsScore, 'mewsScore') || hasValue(record.newsScore, 'newsScore') || hasValue(record.qsofaScore, 'qsofaScore')) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Clinical Scoring</Text>
                      {hasValue(record.mewsScore, 'mewsScore') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>MEWS Score</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.mewsScore))}</Text>
                        </View>
                      )}
                      {hasValue(record.newsScore, 'newsScore') && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>NEWS Score</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.newsScore))}</Text>
                        </View>
                      )}
                      {hasValue(record.qsofaScore, 'qsofaScore') && (
                        <View>
                          <Text style={styles.fieldLabel}>qSOFA Score</Text>
                          <Text style={styles.fieldValue}>{safeString(String(record.qsofaScore))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 6: Interventions */}
                {(interventionsArr.length > 0 || vasoArr.length > 0 || hasValue(record.fluidResuscitationVolume, 'fluidResuscitationVolume')) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Interventions</Text>
                      {interventionsArr.length > 0 && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Primary Interventions</Text>
                          {interventionsArr.map((item, i) => (
                            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                          ))}
                        </View>
                      )}
                      {vasoArr.length > 0 && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Vasoactive Agents</Text>
                          {vasoArr.map((item, i) => (
                            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                          ))}
                        </View>
                      )}
                      {hasValue(record.fluidResuscitationVolume, 'fluidResuscitationVolume') && (
                        <View>
                          <Text style={styles.fieldLabel}>Fluid Resuscitation Volume</Text>
                          <Text style={styles.fieldValue}>{safeString(formatWithUnit(record.fluidResuscitationVolume, 'mL'))}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Section 7: Disposition & Outcome */}
                {(hasValue(record.dispositionDecision) || hasValue(record.icuTransferRequired) || hasValue(record.codeBlueProgression)) && (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={false}>
                      <Text style={styles.sectionTitle}>Disposition & Outcome</Text>
                      {hasValue(record.dispositionDecision) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>Disposition Decision</Text>
                          <Text style={styles.fieldValue}>{safeString(record.dispositionDecision)}</Text>
                        </View>
                      )}
                      {hasValue(record.icuTransferRequired) && (
                        <View style={{ marginBottom: 6 }}>
                          <Text style={styles.fieldLabel}>ICU Transfer Required</Text>
                          <Text style={styles.fieldValue}>{safeString(record.icuTransferRequired)}</Text>
                        </View>
                      )}
                      {hasValue(record.codeBlueProgression) && (
                        <View>
                          <Text style={styles.fieldLabel}>Code Blue Progression</Text>
                          <Text style={styles.fieldValue}>{safeString(record.codeBlueProgression)}</Text>
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

export default RapidResponseSummariesPDFTemplate;
