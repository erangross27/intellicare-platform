import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2px solid #757575',
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#757575',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardWithBorder: {
    borderLeft: '4px solid #757575',
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  scoreItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: '1px solid #e5e7eb',
  },
  scoreName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 10,
    color: '#757575',
    marginBottom: 4,
  },
  interpretation: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});

const NeuropsychologicalAssessmentsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Reason for Referral */}
      {doc.reasonForReferral && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Reason for Referral</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.reasonForReferral}</Text>
          </View>
        </View>
      )}

      {/* Background */}
      {doc.background && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Background</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.background}</Text>
          </View>
        </View>
      )}

      {/* Test Results */}
      {doc.testResults && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Test Results</Text>
          <View style={styles.card}>
            {Array.isArray(doc.testResults) ? (
              doc.testResults.map((test, idx) => (
                <View key={idx} style={styles.scoreItem}>
                  <Text style={styles.scoreName}>{test.testName || test.name}</Text>
                  {test.score && (
                    <Text style={styles.scoreValue}>Score: {test.score}</Text>
                  )}
                  {test.interpretation && (
                    <Text style={styles.interpretation}>{test.interpretation}</Text>
                  )}
                </View>
              ))
            ) : typeof doc.testResults === 'object' ? (
              Object.entries(doc.testResults).map(([key, value], idx) => (
                <View key={idx} style={styles.scoreItem}>
                  <Text style={styles.scoreName}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Text>
                  <Text style={styles.text}>{value}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.text}>{doc.testResults}</Text>
            )}
          </View>
        </View>
      )}

      {/* Cognitive Domains */}
      {doc.cognitiveDomains && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Cognitive Domains</Text>
          <View style={styles.card}>
            {Object.entries(doc.cognitiveDomains).map(([domain, assessment], idx) => (
              <View key={idx} style={styles.scoreItem}>
                <Text style={styles.scoreName}>
                  {domain.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Text>
                <Text style={styles.text}>{assessment}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Attention & Concentration */}
      {doc.attention && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Attention & Concentration</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.attention}</Text>
          </View>
        </View>
      )}

      {/* Memory */}
      {doc.memory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💭 Memory</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.memory}</Text>
          </View>
        </View>
      )}

      {/* Executive Function */}
      {doc.executiveFunction && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧩 Executive Function</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.executiveFunction}</Text>
          </View>
        </View>
      )}

      {/* Language */}
      {doc.language && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗣️ Language</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.language}</Text>
          </View>
        </View>
      )}

      {/* Visuospatial Skills */}
      {doc.visuospatial && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👁️ Visuospatial Skills</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.visuospatial}</Text>
          </View>
        </View>
      )}

      {/* Summary/Impression */}
      {doc.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📌 Summary</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.summary}</Text>
          </View>
        </View>
      )}

      {/* Recommendations */}
      {doc.recommendations && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Recommendations</Text>
          <View style={[styles.card, { borderLeft: '4px solid #6f6f6f' }]}>
            {Array.isArray(doc.recommendations) ? (
              doc.recommendations.map((rec, idx) => (
                <Text key={idx} style={[styles.text, { marginLeft: 10 }]}>
                  • {rec}
                </Text>
              ))
            ) : (
              <Text style={styles.text}>{doc.recommendations}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default NeuropsychologicalAssessmentsTemplate;
