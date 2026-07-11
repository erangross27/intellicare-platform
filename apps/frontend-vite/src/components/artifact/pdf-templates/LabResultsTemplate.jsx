import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  resultName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
    textAlign: 'left',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
  section: {
    marginTop: 8,
  }
});

const LabResultsTemplate = ({ document }) => {
  const doc = document;

  const formatDate = (dateString) => {
    if (!dateString) return null;
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

  return (
    <View wrap={false}>
      {/* Test Parameter Name */}
      <Text style={styles.resultName}>
        {doc.parameter || 'Laboratory Test'}
      </Text>

      {/* Value */}
      <Text style={styles.line}>
        <Text style={styles.textBold}>Value: </Text>
        {doc.value} {doc.unit || ''}
      </Text>

      {/* Reference Range */}
      {doc.referenceRange && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Reference Range: </Text>
          {doc.referenceRange}
        </Text>
      )}

      {/* Status/Flag */}
      {doc.flag && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Status: </Text>
          {doc.flag}
        </Text>
      )}

      {/* Test Date */}
      {(doc.testDate || doc.date) && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Test Date: </Text>
          {formatDate(doc.testDate || doc.date)}
        </Text>
      )}

      {/* Ordered By */}
      {doc.orderedBy && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Ordered By: </Text>
          {doc.orderedBy}
        </Text>
      )}

      {/* Test Type */}
      {doc.testType && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Test Type: </Text>
          {doc.testType}
        </Text>
      )}

      {/* Clinical Interpretation */}
      {doc.interpretation && doc.interpretation.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Clinical Interpretation:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.interpretation}
          </Text>
        </>
      )}

      {/* Notes */}
      {doc.notes && doc.notes.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Notes:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.notes}
          </Text>
        </>
      )}

      {/* Additional Comments */}
      {doc.comments && doc.comments.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Comments:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.comments}
          </Text>
        </>
      )}
    </View>
  );
};

export default LabResultsTemplate;
