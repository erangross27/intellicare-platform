import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Template for Harm Reduction Counseling - November 2025 Standards
// Courier font, fontSize 11, Natural page breaks, Block layout

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Helvetica',
    textTransform: 'uppercase'
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'Helvetica',
    textTransform: 'uppercase'
  },
  fieldBlock: {
    marginBottom: 8
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'Helvetica',
    textTransform: 'uppercase'
  },
  fieldValue: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'Helvetica',
    lineHeight: 1.5
  },
  paragraph: {
    fontSize: 10,
    color: '#000000',
    lineHeight: 1.6,
    marginBottom: 6,
    fontFamily: 'Helvetica'
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Helvetica'
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottom: '1 solid #000000'
  }
});

// Helper to format date
const formatDate = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(date);
  }
};

// Helper to render object as formatted text (NOT raw JSON)
const renderObjectAsText = (obj) => {
  if (!obj) return '';
  if (typeof obj !== 'object') return String(obj);

  // If it's an array, render as bulleted list
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => `• ${item}`).join('\n');
  }

  // If it's an object, render as key-value pairs
  return Object.entries(obj)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
};

const HarmReductionCounselingDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping - handle wrapped collections
  let records = [];

  if (Array.isArray(document)) {
    records = document;
  } else if (document?.harm_reduction_counseling) {
    records = Array.isArray(document.harm_reduction_counseling)
      ? document.harm_reduction_counseling
      : [document.harm_reduction_counseling];
  } else if (document && typeof document === 'object') {
    records = [document];
  }

  // Filter valid records
  const validRecords = records.filter(record =>
    record.date || record.type || record.findings || record.assessment || record.plan
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Harm Reduction Counseling</Text>

        {validRecords.map((record, idx) => (
          <View key={idx}>
            {idx > 0 && <View style={styles.separator} />}

            {/* Session Information */}
            {(record.date || record.type || record.provider || record.facility) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Session Information</Text>

                {record.date && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                  </View>
                )}

                {record.type && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Type</Text>
                    <Text style={styles.fieldValue}>{record.type}</Text>
                  </View>
                )}

                {record.provider && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Provider</Text>
                    <Text style={styles.fieldValue}>{record.provider}</Text>
                  </View>
                )}

                {record.facility && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{record.facility}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Details */}
            {(record.findings || record.assessment || record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Details</Text>

                {record.findings && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Findings</Text>
                    <Text style={styles.fieldValue}>{record.findings}</Text>
                  </View>
                )}

                {record.assessment && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Assessment</Text>
                    <Text style={styles.fieldValue}>{record.assessment}</Text>
                  </View>
                )}

                {record.plan && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Plan</Text>
                    <Text style={styles.fieldValue}>{record.plan}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Recommendations */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, recIdx) => {
                  const recText = typeof rec === 'object' ? rec.recommendation : rec;
                  return (
                    <Text key={recIdx} style={styles.listItem}>
                      {recIdx + 1}. {recText}
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Results */}
            {record.results && typeof record.results === 'object' && Object.keys(record.results).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Results</Text>
                <Text style={styles.paragraph}>{renderObjectAsText(record.results)}</Text>
              </View>
            )}

            {/* Additional Information */}
            {(record.notes || record.status) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Information</Text>

                {record.notes && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    <Text style={styles.fieldValue}>{record.notes}</Text>
                  </View>
                )}

                {record.status && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Status</Text>
                    <Text style={styles.fieldValue}>{record.status}</Text>
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

export default HarmReductionCounselingDocumentPDFTemplate;
