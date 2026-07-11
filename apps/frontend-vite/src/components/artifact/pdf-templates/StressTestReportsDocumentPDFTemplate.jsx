import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* March 2026 PDF Standards — Helvetica, LETTER, 20pt header / 12pt body */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#363636',
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    backgroundColor: '#f0f4f8',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#606060',
    borderLeftStyle: 'solid',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#666666',
  },
  recordCardiologist: {
    fontSize: 11,
    color: '#606060',
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  miniCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderStyle: 'solid',
  },
  miniCardLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  miniCardValue: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 12,
    marginBottom: 6,
    color: '#333333',
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#9ca3af',
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val.value !== undefined) return String(val.value);
    return JSON.stringify(val);
  }
  return String(val);
};

const StressTestReportsDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.stress_test_reports) {
        return inputData[0].stress_test_reports;
      }
      return inputData;
    }
    if (inputData.stress_test_reports) {
      return inputData.stress_test_reports;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Stress Test Reports</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {safeString(idx + 1)}. {safeString(record.testType) || 'Stress Test'}
              </Text>
              {record.date && (
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
              )}
              {record.cardiologist && (
                <Text style={styles.recordCardiologist}>{safeString(record.cardiologist)}</Text>
              )}
            </View>

            {/* Test Information */}
            {(record.testType || record.protocol || record.duration) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Test Information</Text>
                <View style={styles.sectionContent}>
                  {record.testType && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Test Type</Text>
                      <Text style={styles.miniCardValue}>{safeString(record.testType)}</Text>
                    </View>
                  )}
                  {record.protocol && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Protocol</Text>
                      <Text style={styles.miniCardValue}>{safeString(record.protocol)}</Text>
                    </View>
                  )}
                  {record.duration && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Duration</Text>
                      <Text style={styles.miniCardValue}>{safeString(record.duration)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Heart Rate */}
            {(record.maxHeartRate || record.targetHeartRate) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Heart Rate</Text>
                <View style={styles.sectionContent}>
                  {record.maxHeartRate && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Max Heart Rate</Text>
                      <Text style={styles.miniCardValue}>{safeString(record.maxHeartRate)} bpm</Text>
                    </View>
                  )}
                  {record.targetHeartRate && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Target Heart Rate</Text>
                      <Text style={styles.miniCardValue}>{safeString(record.targetHeartRate)} bpm</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Blood Pressure Response */}
            {record.bloodPressureResponse && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Blood Pressure Response</Text>
                <View style={styles.sectionContent}>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardLabel}>Response</Text>
                    <Text style={styles.miniCardValue}>{safeString(record.bloodPressureResponse)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Symptoms */}
            {record.symptoms && record.symptoms.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Symptoms</Text>
                <View style={styles.sectionContent}>
                  {record.symptoms.map((symptom, sIdx) => (
                    <Text key={sIdx} style={styles.listItem}>
                      {sIdx + 1}. {safeString(symptom)}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* ECG Changes */}
            {record.ecgChanges && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>ECG Changes</Text>
                <View style={styles.sectionContent}>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardLabel}>ECG Findings</Text>
                    <Text style={styles.miniCardValue}>{safeString(record.ecgChanges)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Result */}
            {record.result && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Result</Text>
                <View style={styles.sectionContent}>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardLabel}>Test Result</Text>
                    <Text style={styles.miniCardValue}>{safeString(record.result)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Interpretation */}
            {record.interpretation && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Interpretation</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(safeString(record.interpretation)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default StressTestReportsDocumentPDFTemplate;
