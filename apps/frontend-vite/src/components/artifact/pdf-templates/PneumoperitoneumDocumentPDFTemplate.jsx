/**
 * PneumoperitoneumDocumentPDFTemplate.jsx
 * PDF export template for pneumoperitoneum collection
 * March 2026 - Helvetica font, LETTER size, 20pt header, 12pt content, wrap={false}
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    paddingBottom: 10,
  },
  recordCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  recordHeader: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaItem: {
    fontSize: 11,
    color: '#727272',
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#606060',
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    color: '#1f2937',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#404040',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    if (dateVal.$date) return new Date(dateVal.$date).toLocaleDateString();
    if (dateVal instanceof Date) return dateVal.toLocaleDateString();
    return new Date(dateVal).toLocaleDateString();
  } catch {
    return String(dateVal);
  }
};

const PneumoperitoneumDocumentPDFTemplate = ({ document: records }) => {
  // Handle data unwrapping
  let recordsArray = [];
  if (Array.isArray(records)) {
    recordsArray = records;
  } else if (records?.pneumoperitoneum && Array.isArray(records.pneumoperitoneum)) {
    recordsArray = records.pneumoperitoneum;
  } else if (records?.documentData) {
    const docData = records.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.pneumoperitoneum && Array.isArray(docData.pneumoperitoneum)) {
      recordsArray = docData.pneumoperitoneum;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (records && typeof records === 'object' && !Array.isArray(records)) {
    recordsArray = [records];
  }

  // Empty check
  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.header}>Pneumoperitoneum</Text>
          <Text style={styles.noData}>No pneumoperitoneum data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Pneumoperitoneum</Text>

        {recordsArray.map((record, idx) => {
          const hasAccessDetails = record.accessMethod || record.accessLocation;
          const hasPressureSettings = record.initialPressure || record.targetPressure || record.maximumPressure;
          const hasGasSettings = record.gasType || record.totalGasVolume || record.flowRate || record.insufflationTime;
          const hasEquipment = record.insufflationEquipment || record.desufflationMethod;
          const hasFindings = record.visualInspection || record.adhesions || (Array.isArray(record.complications) && record.complications.length > 0);
          const hasVerificationTests = Array.isArray(record.verificationTests) && record.verificationTests.length > 0;

          return (
            <View key={idx} style={styles.recordCard}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Pneumoperitoneum {idx + 1}</Text>
                <View style={styles.recordMeta}>
                  {record.date && <Text style={styles.metaItem}>Date: {formatDate(record.date)}</Text>}
                  {record.facility && <Text style={styles.metaItem}>Facility: {String(record.facility)}</Text>}
                </View>
                {record.procedureName && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.fieldSubtitle}>Procedure</Text>
                    <Text style={styles.fieldValue}>{String(record.procedureName)}</Text>
                  </View>
                )}
              </View>

              {/* Access Details */}
              {hasAccessDetails && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Access Details</Text>
                  {record.accessMethod && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Access Method</Text>
                      <Text style={styles.fieldValue}>{String(record.accessMethod)}</Text>
                    </View>
                  )}
                  {record.accessLocation && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Access Location</Text>
                      <Text style={styles.fieldValue}>{String(record.accessLocation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Pressure Settings */}
              {hasPressureSettings && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Pressure Settings</Text>
                  {record.initialPressure && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Initial Pressure</Text>
                      <Text style={styles.fieldValue}>{String(record.initialPressure)}</Text>
                    </View>
                  )}
                  {record.targetPressure && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Target Pressure</Text>
                      <Text style={styles.fieldValue}>{String(record.targetPressure)}</Text>
                    </View>
                  )}
                  {record.maximumPressure && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Maximum Pressure</Text>
                      <Text style={styles.fieldValue}>{String(record.maximumPressure)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Gas Settings */}
              {hasGasSettings && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Gas Settings</Text>
                  {record.gasType && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Gas Type</Text>
                      <Text style={styles.fieldValue}>{String(record.gasType)}</Text>
                    </View>
                  )}
                  {record.totalGasVolume && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Total Gas Volume</Text>
                      <Text style={styles.fieldValue}>{String(record.totalGasVolume)}</Text>
                    </View>
                  )}
                  {record.flowRate && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Flow Rate</Text>
                      <Text style={styles.fieldValue}>{String(record.flowRate)}</Text>
                    </View>
                  )}
                  {record.insufflationTime && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Insufflation Time</Text>
                      <Text style={styles.fieldValue}>{String(record.insufflationTime)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Equipment */}
              {hasEquipment && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Equipment</Text>
                  {record.insufflationEquipment && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Insufflation Equipment</Text>
                      <Text style={styles.fieldValue}>{String(record.insufflationEquipment)}</Text>
                    </View>
                  )}
                  {record.desufflationMethod && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Desufflation Method</Text>
                      <Text style={styles.fieldValue}>{String(record.desufflationMethod)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Findings */}
              {hasFindings && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {record.visualInspection && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>Visual Inspection</Text>
                        <Text style={styles.fieldValue}>{String(record.visualInspection)}</Text>
                      </View>
                    )}
                  </View>
                  {record.adhesions && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Adhesions</Text>
                      <Text style={styles.fieldValue}>{String(record.adhesions)}</Text>
                    </View>
                  )}
                  {Array.isArray(record.complications) && record.complications.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Complications</Text>
                      {record.complications.map((comp, cIdx) => (
                        <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {String(comp)}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Verification Tests */}
              {hasVerificationTests && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Verification Tests</Text>
                    {record.verificationTests[0] && (
                      <Text style={styles.listItem}>1. {String(record.verificationTests[0])}</Text>
                    )}
                  </View>
                  {record.verificationTests.slice(1).map((test, tIdx) => (
                    <Text key={tIdx + 1} style={styles.listItem}>{tIdx + 2}. {String(test)}</Text>
                  ))}
                </View>
              )}

              {/* Special Considerations */}
              {record.specialConsiderations && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Special Considerations</Text>
                  <Text style={styles.fieldValue}>{String(record.specialConsiderations)}</Text>
                </View>
              )}

              {/* Notes */}
              {record.notes && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.fieldValue}>{String(record.notes)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PneumoperitoneumDocumentPDFTemplate;
