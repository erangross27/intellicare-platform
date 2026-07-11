import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

/* March 2026 PDF Standards — Helvetica, LETTER, 20pt header / 12pt body */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
    size: 'LETTER',
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
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    width: 120,
  },
  fieldValue: {
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#9ca3af',
  },
});

/* Format date helper */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

/* Split text into sentences */
const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const RadiologyReportsDocumentPDFTemplate = ({ document }) => {
  /* Data unwrapping */
  let reportsArray;
  if (Array.isArray(document)) {
    reportsArray = document[0]?.radiology_reports || document;
  } else {
    reportsArray = document?.radiology_reports || (document?.documentData || document?.data || [document]);
  }

  if (!Array.isArray(reportsArray)) {
    reportsArray = [reportsArray];
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Radiology Reports</Text>

        {reportsArray.map((report, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>{report.studyType || `Radiology Report ${idx + 1}`}</Text>
              {report.date && (
                <Text style={styles.recordDate}>{formatDate(report.date)}</Text>
              )}
            </View>

            {/* Study Information */}
            {(report.studyType || report.anatomicalRegion) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Study Information</Text>
                <View style={styles.sectionContent}>
                  {report.studyType && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Study Type</Text>
                      <Text style={styles.miniCardValue}>{String(report.studyType)}</Text>
                    </View>
                  )}
                  {report.anatomicalRegion && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Anatomical Region</Text>
                      <Text style={styles.miniCardValue}>{String(report.anatomicalRegion)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Clinical Details */}
            {report.indication && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Details</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.indication)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Imaging Details */}
            {(report.technique || report.contrast) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Imaging Details</Text>
                <View style={styles.sectionContent}>
                  {report.technique && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Technique</Text>
                      {splitIntoSentences(String(report.technique)).map((sentence, sentIdx) => (
                        <Text key={sentIdx} style={styles.listItem}>
                          {sentIdx + 1}. {sentence}
                        </Text>
                      ))}
                    </View>
                  )}
                  {report.contrast && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Contrast</Text>
                      <Text style={styles.miniCardValue}>{String(report.contrast)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Findings */}
            {report.findings && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.findings)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Impression */}
            {report.impression && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Impression</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.impression)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Comparison */}
            {report.comparison && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Comparison</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.comparison)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            {report.recommendations && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.recommendations)).map((sentence, sentIdx) => (
                    <Text key={sentIdx} style={styles.listItem}>
                      {sentIdx + 1}. {sentence}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* General Information */}
            {(report.radiologist || report.facility) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>General Information</Text>
                <View style={styles.sectionContent}>
                  {report.radiologist && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Radiologist</Text>
                      <Text style={styles.miniCardValue}>{String(report.radiologist)}</Text>
                    </View>
                  )}
                  {report.facility && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Facility</Text>
                      <Text style={styles.miniCardValue}>{String(report.facility)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Notes */}
            {report.notes && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.sectionContent}>
                  {splitIntoSentences(String(report.notes)).map((sentence, sentIdx) => (
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

export default RadiologyReportsDocumentPDFTemplate;
