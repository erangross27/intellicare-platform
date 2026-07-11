import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// November 2025 PDF Standards - Courier font, fontSize 11, filterNulls() on arrays
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 40,
    lineHeight: 1.6,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
    borderBottom: '2pt solid #606060',
    paddingBottom: 10,
  },
  recordHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    color: '#606060',
    borderBottom: '1pt solid #606060',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    color: '#9a9a9a',
  },
  text: {
    fontSize: 11,
    marginBottom: 4,
    color: '#000',
  },
  label: {
    fontWeight: 'bold',
    color: '#000',
  },
  listItem: {
    fontSize: 11,
    marginBottom: 3,
    marginLeft: 12,
    color: '#000',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  separator: {
    borderBottom: '1pt solid #ddd',
    marginTop: 16,
    marginBottom: 16,
  },
});

// Filter null/undefined values from arrays
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item != null && item !== '');
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const CareCoordinationTemplate = ({ document }) => {
  // Handle both single object and array of objects
  const coordinationArray = Array.isArray(document) ? document : [document];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Main Title */}
        <Text style={styles.header}>Care Coordination</Text>

        {/* Render each care coordination record */}
        {coordinationArray.map((coord, idx) => (
          <View key={idx}>
            {/* Record Header */}
            <Text style={styles.recordHeader}>
              Care Coordination {idx + 1}
              {coord.date && ` - ${formatDate(coord.date)}`}
            </Text>

            {/* General Information */}
            {(coord.date || coord.type) && (
              <View>
                <Text style={styles.sectionTitle}>General Information</Text>
                {coord.date && (
                  <Text style={styles.text}>
                    <Text style={styles.label}>Date: </Text>
                    {formatDate(coord.date)}
                  </Text>
                )}
                {coord.type && (
                  <Text style={styles.text}>
                    <Text style={styles.label}>Type: </Text>
                    {coord.type}
                  </Text>
                )}
              </View>
            )}

            {/* Care Team */}
            {(coord.provider || coord.facility) && (
              <View>
                <Text style={styles.sectionTitle}>Care Team</Text>
                {coord.provider && (
                  <Text style={styles.text}>
                    <Text style={styles.label}>Provider: </Text>
                    {coord.provider}
                  </Text>
                )}
                {coord.facility && (
                  <Text style={styles.text}>
                    <Text style={styles.label}>Facility: </Text>
                    {coord.facility}
                  </Text>
                )}
              </View>
            )}

            {/* Findings */}
            {coord.findings && (
              <View>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.text}>{coord.findings}</Text>
              </View>
            )}

            {/* Assessment */}
            {coord.assessment && (
              <View>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.text}>{coord.assessment}</Text>
              </View>
            )}

            {/* Plan */}
            {coord.plan && (
              <View>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.text}>{coord.plan}</Text>
              </View>
            )}

            {/* Recommendations (array of strings) */}
            {coord.recommendations && filterNulls(coord.recommendations).length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {filterNulls(coord.recommendations).map((rec, recIdx) => (
                  <Text key={recIdx} style={styles.listItem}>
                    {recIdx + 1}. {rec}
                  </Text>
                ))}
              </View>
            )}

            {/* Results */}
            {coord.results && (
              <View>
                <Text style={styles.sectionTitle}>Results</Text>
                <Text style={styles.text}>{coord.results}</Text>
              </View>
            )}

            {/* Status */}
            {coord.status && (
              <View>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.text}>{coord.status}</Text>
              </View>
            )}

            {/* Notes */}
            {coord.notes && (
              <View>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.text}>{coord.notes}</Text>
              </View>
            )}

            {/* Separator between records (except last) */}
            {idx < coordinationArray.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CareCoordinationTemplate;
