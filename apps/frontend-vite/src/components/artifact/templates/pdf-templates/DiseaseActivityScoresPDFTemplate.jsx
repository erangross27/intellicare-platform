import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #cccccc',
  },
  recordHeader: {
    marginBottom: 12,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  recordMeta: {
    fontSize: 10,
    color: '#444444',
    marginBottom: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    backgroundColor: '#f0f0f0',
    padding: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 150,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    flex: 1,
    fontSize: 11,
  },
  arrayItem: {
    fontSize: 11,
    marginBottom: 3,
    paddingLeft: 12,
  },
  textBlock: {
    fontSize: 11,
    lineHeight: 1.4,
    paddingLeft: 8,
  },
});

// Helper functions
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return typeof val === 'string' ? val : String(val);
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const DiseaseActivityScoresPDFTemplate = ({ data }) => {
  // Unwrap data
  const records = Array.isArray(data) ? data : data ? [data] : [];
  
  if (records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Disease Activity Scores</Text>
          <Text>No disease activity scores available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Disease Activity Scores</Text>
        
        {records.map((record, recordIdx) => (
          <View key={recordIdx} style={styles.recordContainer} wrap={false}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Record {recordIdx + 1}</Text>
              {record.date && (
                <Text style={styles.recordMeta}>
                  Date: {new Date(record.date).toLocaleDateString()}
                </Text>
              )}
              {record.provider && (
                <Text style={styles.recordMeta}>Provider: {safeString(record.provider)}</Text>
              )}
              {record.facility && (
                <Text style={styles.recordMeta}>Facility: {safeString(record.facility)}</Text>
              )}
            </View>
            
            {/* Mayo Score */}
            {hasValue(record.mayoScore) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Mayo Score</Text>
                {record.mayoScore.stoolFrequency && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Stool Frequency:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.mayoScore.stoolFrequency)}</Text>
                  </View>
                )}
                {record.mayoScore.rectalBleeding && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Rectal Bleeding:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.mayoScore.rectalBleeding)}</Text>
                  </View>
                )}
                {record.mayoScore.endoscopicFindings && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Endoscopic Findings:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.mayoScore.endoscopicFindings)}</Text>
                  </View>
                )}
                {record.mayoScore.physicianAssessment && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Physician Assessment:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.mayoScore.physicianAssessment)}</Text>
                  </View>
                )}
                {record.mayoScore.totalScore && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Total Score:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.mayoScore.totalScore)}</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Harvey-Bradshaw Index */}
            {hasValue(record.harveyBradshaw) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Harvey-Bradshaw Index</Text>
                <Text style={styles.textBlock}>{safeString(record.harveyBradshaw)}</Text>
              </View>
            )}
            
            {/* CDAI */}
            {hasValue(record.cdai) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>CDAI</Text>
                <Text style={styles.textBlock}>{safeString(record.cdai)}</Text>
              </View>
            )}
            
            {/* Partial Mayo Score */}
            {hasValue(record.partialMayo) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Partial Mayo Score</Text>
                <Text style={styles.textBlock}>{safeString(record.partialMayo)}</Text>
              </View>
            )}
            
            {/* SCCAI */}
            {hasValue(record.simpleClinicalColitisActivity) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Simple Clinical Colitis Activity Index (SCCAI)</Text>
                <Text style={styles.textBlock}>{safeString(record.simpleClinicalColitisActivity)}</Text>
              </View>
            )}
            
            {/* PUCAI */}
            {hasValue(record.pucai) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>PUCAI</Text>
                <Text style={styles.textBlock}>{safeString(record.pucai)}</Text>
              </View>
            )}
            
            {/* Assessment */}
            {hasValue(record.assessment) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.textBlock}>{safeString(record.assessment)}</Text>
              </View>
            )}
            
            {/* Findings */}
            {hasValue(record.findings) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.textBlock}>{safeString(record.findings)}</Text>
              </View>
            )}
            
            {/* Plan */}
            {hasValue(record.plan) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.textBlock}>{safeString(record.plan)}</Text>
              </View>
            )}
            
            {/* Notes */}
            {hasValue(record.notes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.textBlock}>{safeString(record.notes)}</Text>
              </View>
            )}
            
            {/* Recommendations */}
            {hasValue(record.recommendations) && record.recommendations.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, i) => (
                  <Text key={i} style={styles.arrayItem}>
                    {i + 1}. {safeString(rec)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DiseaseActivityScoresPDFTemplate;
