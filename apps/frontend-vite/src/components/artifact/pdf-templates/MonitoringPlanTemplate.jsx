import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  sectionTitle: {
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
});

const MonitoringPlanTemplate = ({ document }) => {
  const doc = document;

  // Parse the laboratory field which contains the full plan text
  const planText = doc.laboratory || doc.plan || '';

  // Extract timeline sections
  const shortTermMatch = planText.match(/Short-term \([^)]+\):\s*([^.]+(?:\.[^.]+)*?)(?=\s*Medium-term|$)/i);
  const mediumTermMatch = planText.match(/Medium-term \([^)]+\):\s*([^.]+(?:\.[^.]+)*?)(?=\s*Long-term|$)/i);
  const longTermMatch = planText.match(/Long-term:\s*(.+?)$/i);

  const shortTerm = doc.shortTerm || (shortTermMatch ? shortTermMatch[1].trim().split(/,\s*/) : []);
  const mediumTerm = doc.mediumTerm || (mediumTermMatch ? mediumTermMatch[1].trim().split(/,\s*/) : []);
  const longTerm = doc.longTerm || (longTermMatch ? longTermMatch[1].trim().split(/,\s*/) : []);

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
    <View>
      {/* Short-term */}
      {shortTerm.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Short-term (Monthly × 3)</Text>
          {shortTerm.map((item, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {item.trim()}
            </Text>
          ))}
        </View>
      )}

      {/* Medium-term */}
      {mediumTerm.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Medium-term (3-6 months)</Text>
          {mediumTerm.map((item, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {item.trim()}
            </Text>
          ))}
        </View>
      )}

      {/* Long-term */}
      {longTerm.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Long-term</Text>
          {longTerm.map((item, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {item.trim()}
            </Text>
          ))}
        </View>
      )}

      {/* Fallback if no timeline sections found */}
      {shortTerm.length === 0 && mediumTerm.length === 0 && longTerm.length === 0 && planText && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Monitoring Plan</Text>
          <Text style={styles.line}>{planText}</Text>
        </View>
      )}

      {/* Monitoring Parameters */}
      {doc.parameters && doc.parameters.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Monitoring Parameters</Text>
          {doc.parameters.map((param, index) => (
            <Text key={index} style={[styles.line, styles.indent]}>
              • {param}
            </Text>
          ))}
        </View>
      )}

      {/* Date */}
      {doc.date && (
        <Text style={[styles.line, { marginTop: 8 }]}>
          <Text style={styles.textBold}>Date: </Text>
          {formatDate(doc.date)}
        </Text>
      )}
    </View>
  );
};

export default MonitoringPlanTemplate;
