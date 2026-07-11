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
    borderBottom: '2px solid #7a7a7a',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  summaryBlock: {
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #7a7a7a',
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 10,
    color: '#1f2937',
    lineHeight: 1.6,
  },
  highlightBlock: {
    backgroundColor: '#f1f1f1',
    borderLeft: '4px solid #a7a7a7',
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: 4,
    backgroundColor: '#7a7a7a',
    color: '#ffffff',
    marginBottom: 8,
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
});

const CaseSummariesTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Case Overview */}
      {doc.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Case Summary</Text>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryText}>{doc.summary}</Text>
          </View>
        </View>
      )}

      {/* Chief Complaint */}
      {doc.chiefComplaint && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🩺 Chief Complaint</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.chiefComplaint}</Text>
          </View>
        </View>
      )}

      {/* Clinical Presentation */}
      {doc.clinicalPresentation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Clinical Presentation</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.clinicalPresentation}</Text>
          </View>
        </View>
      )}

      {/* Key Findings */}
      {doc.keyFindings && doc.keyFindings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 Key Findings</Text>
          <View style={styles.highlightBlock}>
            {doc.keyFindings.map((finding, index) => (
              <Text key={index} style={styles.listItem}>• {finding}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Diagnosis */}
      {doc.diagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚕️ Diagnosis</Text>
          <View style={styles.card}>
            <Text style={[styles.text, styles.textBold]}>{doc.diagnosis}</Text>
          </View>
        </View>
      )}

      {/* Treatment Course */}
      {doc.treatmentCourse && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Treatment Course</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.treatmentCourse}</Text>
          </View>
        </View>
      )}

      {/* Outcome */}
      {doc.outcome && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Outcome</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.outcome}</Text>
          </View>
        </View>
      )}

      {/* Complications */}
      {doc.complications && doc.complications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Complications</Text>
          <View style={styles.card}>
            {doc.complications.map((complication, index) => (
              <Text key={index} style={styles.listItem}>• {complication}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Follow-up Plan */}
      {doc.followUpPlan && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Follow-up Plan</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.followUpPlan}</Text>
          </View>
        </View>
      )}

      {/* Provider */}
      {doc.provider && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍⚕️ Provider</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.provider}</Text>
          </View>
        </View>
      )}

      {/* Date */}
      {doc.date && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.badge}>
            📅 {new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
      )}
    </View>
  );
};

export default CaseSummariesTemplate;
