import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #cccccc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  specialty: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  date: {
    fontSize: 9,
    color: '#666666',
    marginLeft: 8,
  },
  type: {
    fontSize: 9,
    color: '#666666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  reason: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.6,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 4,
  },
  fieldValue: {
    fontSize: 9,
    color: '#333333',
  },
});

const RecommendationsTemplate = ({ document }) => {
  const doc = document;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Specialty & Date */}
      <View style={styles.header}>
        <Text style={styles.specialty}>
          {doc.specialty || 'Follow-up'}
        </Text>
        {doc.date && (
          <Text style={styles.date}>
            {formatDate(doc.date)}
          </Text>
        )}
      </View>

      {/* Type */}
      {doc.type && (
        <Text style={styles.type}>
          {doc.type}
        </Text>
      )}

      {/* Reason */}
      {doc.reason && (
        <Text style={styles.reason}>
          {doc.reason}
        </Text>
      )}

      {/* Timing */}
      {doc.timing && doc.timing.trim() && (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Timing:</Text>
          <Text style={styles.fieldValue}>{doc.timing}</Text>
        </View>
      )}

      {/* Provider */}
      {doc.provider && doc.provider.trim() && (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Provider:</Text>
          <Text style={styles.fieldValue}>{doc.provider}</Text>
        </View>
      )}
    </View>
  );
};

export default RecommendationsTemplate;
