import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const filterNulls = (arr) => Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : [];

// Safe string helper for Unicode sanitization
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/²/g, '2');
  str = str.replace(/³/g, '3');
  return str;
};

// Split text into sentences
const splitIntoSentences = (text) => {
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)/g).filter(s => s.trim());
  return sentences;
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
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1pt solid #cccccc',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  doubleSeparator: {
    fontSize: 10,
    marginBottom: 16,
    color: '#666666',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  singleSeparator: {
    fontSize: 10,
    marginBottom: 8,
    color: '#999999',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    minWidth: 120,
    color: '#000000',
  },
  fieldValue: {
    fontSize: 14,
    flex: 1,
    color: '#000000',
  },
  textBlock: {
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 8,
    color: '#000000',
  },
  listItem: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8,
    color: '#000000',
  },
});

const TreatmentCoursesPDFTemplate = ({ documents }) => {
  const courses = Array.isArray(documents) ? documents : [documents];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (!courses || courses.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Treatment Courses</Text>
          <Text style={styles.textBlock}>No treatment course records found.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Treatment Courses</Text>

        {filterNulls(courses).map((course, index) => (
          <View key={index} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>TREATMENT COURSE {index + 1}</Text>
            <Text style={styles.doubleSeparator}>========================================</Text>

            {/* Provider Details */}
            {(course.reportDate || course.date || course.reportType || course.type || course.urgency || course.provider || course.facility) && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>PROVIDER DETAILS</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                {(course.reportDate || course.date) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Date:</Text>
                    <Text style={styles.fieldValue}>{safeString(formatDate(course.reportDate || course.date))}</Text>
                  </View>
                )}
                {(course.reportType || course.type) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Report Type:</Text>
                    <Text style={styles.fieldValue}>{safeString(course.reportType || course.type)}</Text>
                  </View>
                )}
                {course.urgency && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Urgency:</Text>
                    <Text style={styles.fieldValue}>{safeString(course.urgency)}</Text>
                  </View>
                )}
                {course.provider && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldValue}>{safeString(course.provider)}</Text>
                  </View>
                )}
                {course.facility && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldValue}>{safeString(course.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Indication */}
            {course.clinicalIndication && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>CLINICAL INDICATION</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.clinicalIndication)}</Text>
              </View>
            )}

            {/* Findings */}
            {course.findings && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>FINDINGS</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.findings)}</Text>
              </View>
            )}

            {/* Assessment */}
            {course.assessment && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>ASSESSMENT</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.assessment)}</Text>
              </View>
            )}

            {/* Plan */}
            {course.plan && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>PLAN</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.plan)}</Text>
              </View>
            )}

            {/* Recommendations */}
            {course.recommendations && (Array.isArray(course.recommendations) ? course.recommendations.length > 0 : !!course.recommendations) && (
              <View style={styles.sectionContainer} wrap={course.recommendations.length > 4 ? true : false}>
                <Text style={styles.sectionTitle} wrap={false}>RECOMMENDATIONS</Text>
                <Text style={styles.singleSeparator} wrap={false}>----------------------------------------</Text>
                {Array.isArray(course.recommendations) ? (
                  filterNulls(course.recommendations).map((rec, recIdx) => (
                    <Text key={recIdx} style={styles.listItem}>{recIdx + 1}. {safeString(rec)}</Text>
                  ))
                ) : (
                  <Text style={styles.textBlock}>{safeString(course.recommendations)}</Text>
                )}
              </View>
            )}

            {/* Results */}
            {course.results && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>RESULTS</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.results)}</Text>
              </View>
            )}

            {/* Notes - Use pre-computed _notesSentences for editing support */}
            {course.notes && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle} wrap={false}>NOTES</Text>
                <Text style={styles.singleSeparator} wrap={false}>----------------------------------------</Text>
                {(course._notesSentences || splitIntoSentences(course.notes)).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Status */}
            {course.status && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>STATUS</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.status)}</Text>
              </View>
            )}

            {/* Follow Up */}
            {course.followUp && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>FOLLOW UP</Text>
                <Text style={styles.singleSeparator}>----------------------------------------</Text>
                <Text style={styles.textBlock}>{safeString(course.followUp)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TreatmentCoursesPDFTemplate;
