import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MentalStatusExamsDocumentPDFTemplate - Professional PDF for mental status exams
 *
 * Generates formatted PDF with:
 * - Exam date and metadata
 * - Findings, Assessment, Plan
 * - Recommendations, Results, Notes
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000'
  },
  section: {
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 2,
    alignItems: 'flex-start'
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 4
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    flex: 1,
    flexWrap: 'wrap'
  },
  textBlock: {
    marginLeft: 12,
    marginTop: 4,
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.4
  }
});

// Helper to filter nulls
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const MentalStatusExamsDocumentPDFTemplate = ({ data }) => {
  if (!data) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Mental Status Examination</Text>
          <Text style={styles.subtitle}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>Mental Status Examination</Text>
        <View style={{marginBottom: 12}} />

        {/* Metadata - Unified Schema Fields */}
        {data.date && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Date:</Text>
            <Text style={styles.fieldValue}>{formatDate(data.date)}</Text>
          </View>
        )}

        {data.type && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Type:</Text>
            <Text style={styles.fieldValue}>{data.type}</Text>
          </View>
        )}

        {data.provider && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Provider:</Text>
            <Text style={styles.fieldValue}>{data.provider}</Text>
          </View>
        )}

        {data.facility && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Facility:</Text>
            <Text style={styles.fieldValue}>{data.facility}</Text>
          </View>
        )}

        {data.status && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Status:</Text>
            <Text style={styles.fieldValue}>{data.status}</Text>
          </View>
        )}

        <View style={{marginBottom: 12}} />

        {/* Findings */}
        {data.findings && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>FINDINGS</Text>
            <Text style={styles.textBlock}>{data.findings}</Text>
          </View>
        )}

        {/* Assessment */}
        {data.assessment && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>ASSESSMENT</Text>
            <Text style={styles.textBlock}>{data.assessment}</Text>
          </View>
        )}

        {/* Plan */}
        {data.plan && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>PLAN</Text>
            <Text style={styles.textBlock}>{data.plan}</Text>
          </View>
        )}

        {/* Recommendations */}
        {data.recommendations && Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
            {filterNulls(data.recommendations).map((rec, idx) => {
              const recText = typeof rec === 'object' ? (rec.recommendation || JSON.stringify(rec)) : rec;
              return (
                <Text key={idx} style={styles.textBlock}>
                  {idx + 1}. {recText}
                  {rec.date && ` (Date: ${rec.date})`}
                </Text>
              );
            })}
          </View>
        )}

        {/* Results */}
        {data.results && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>RESULTS</Text>
            <Text style={styles.textBlock}>
              {typeof data.results === 'object' ? JSON.stringify(data.results, null, 2) : data.results}
            </Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <Text style={styles.textBlock}>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default MentalStatusExamsDocumentPDFTemplate;
