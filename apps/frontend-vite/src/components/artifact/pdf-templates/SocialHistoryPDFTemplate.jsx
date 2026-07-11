import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Template for Social History - November 2025 Standards
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

const SocialHistoryPDFTemplate = ({ document }) => {
  // Data unwrapping - handle wrapped collections
  let records = [];

  if (Array.isArray(document)) {
    records = document;
  } else if (document?.social_history) {
    records = Array.isArray(document.social_history)
      ? document.social_history
      : [document.social_history];
  } else if (document && typeof document === 'object') {
    records = [document];
  }

  // Filter valid records
  const validRecords = records.filter(record =>
    record.date || record.type || record.smokingStatus || record.financialConcerns || record.findings
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Social History</Text>

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

            {/* Social Determinants */}
            {(record.smokingStatus || record.smokingHistory || record.alcoholUse || record.substanceUse ||
              record.maritalStatus || record.exercise || record.diet || record.supportSystem) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Social Determinants</Text>

                {record.smokingStatus && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Smoking Status</Text>
                    <Text style={styles.fieldValue}>{record.smokingStatus}</Text>
                  </View>
                )}

                {record.smokingHistory && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Smoking History</Text>
                    <Text style={styles.fieldValue}>{record.smokingHistory}</Text>
                  </View>
                )}

                {record.alcoholUse && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Alcohol Use</Text>
                    <Text style={styles.fieldValue}>{record.alcoholUse}</Text>
                  </View>
                )}

                {record.substanceUse && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Substance Use</Text>
                    <Text style={styles.fieldValue}>{record.substanceUse}</Text>
                  </View>
                )}

                {record.maritalStatus && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Marital Status</Text>
                    <Text style={styles.fieldValue}>{record.maritalStatus}</Text>
                  </View>
                )}

                {record.exercise && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Exercise</Text>
                    <Text style={styles.fieldValue}>{record.exercise}</Text>
                  </View>
                )}

                {record.diet && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Diet</Text>
                    <Text style={styles.fieldValue}>{record.diet}</Text>
                  </View>
                )}

                {record.supportSystem && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Support System</Text>
                    <Text style={styles.fieldValue}>{record.supportSystem}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Financial & Living */}
            {(record.financialConcerns || record.insurance || record.livingSituation ||
              record.occupation || record.transportation) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Financial &amp; Living</Text>

                {record.financialConcerns && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Financial Concerns</Text>
                    <Text style={styles.fieldValue}>{record.financialConcerns}</Text>
                  </View>
                )}

                {record.insurance && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Insurance</Text>
                    <Text style={styles.fieldValue}>{record.insurance}</Text>
                  </View>
                )}

                {record.livingSituation && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Living Situation</Text>
                    <Text style={styles.fieldValue}>{record.livingSituation}</Text>
                  </View>
                )}

                {record.occupation && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Occupation</Text>
                    <Text style={styles.fieldValue}>{record.occupation}</Text>
                  </View>
                )}

                {record.transportation && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Transportation</Text>
                    <Text style={styles.fieldValue}>{record.transportation}</Text>
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

export default SocialHistoryPDFTemplate;
