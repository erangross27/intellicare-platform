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
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  specimenLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7a7a7a',
    marginBottom: 8,
  },
  findingsBlock: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 6,
  },
  diagnosisBlock: {
    backgroundColor: '#eaeaea',
    borderLeft: '4px solid #777777',
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  diagnosisText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  impressionBlock: {
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
  },
});

const BiopsyReportsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Specimen Information */}
      {doc.specimen && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔬 Specimen Information</Text>
          <View style={styles.card}>
            {doc.specimen.type && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Type: </Text>
                {doc.specimen.type}
              </Text>
            )}
            {doc.specimen.site && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Site: </Text>
                {doc.specimen.site}
              </Text>
            )}
            {doc.specimen.collectionDate && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Collection Date: </Text>
                {new Date(doc.specimen.collectionDate).toLocaleDateString()}
              </Text>
            )}
            {doc.specimen.collectionMethod && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Collection Method: </Text>
                {doc.specimen.collectionMethod}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Microscopic Findings */}
      {doc.microscopicFindings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Microscopic Findings</Text>
          <View style={styles.findingsBlock}>
            <Text style={styles.text}>{doc.microscopicFindings}</Text>
          </View>
        </View>
      )}

      {/* Gross Description */}
      {doc.grossDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Gross Description</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.grossDescription}</Text>
          </View>
        </View>
      )}

      {/* Diagnosis */}
      {doc.diagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚕️ Diagnosis</Text>
          <View style={styles.diagnosisBlock}>
            <Text style={styles.diagnosisText}>{doc.diagnosis}</Text>
          </View>
        </View>
      )}

      {/* Impression */}
      {doc.impression && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Clinical Impression</Text>
          <View style={styles.impressionBlock}>
            <Text style={styles.text}>{doc.impression}</Text>
          </View>
        </View>
      )}

      {/* Pathologist */}
      {doc.pathologist && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍⚕️ Pathologist</Text>
          <View style={styles.card}>
            <Text style={styles.text}>
              <Text style={styles.textBold}>Report by: </Text>
              {doc.pathologist}
            </Text>
          </View>
        </View>
      )}

      {/* Special Stains */}
      {doc.specialStains && doc.specialStains.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Special Stains & Studies</Text>
          <View style={styles.card}>
            {doc.specialStains.map((stain, index) => (
              <Text key={index} style={styles.text}>• {stain}</Text>
            ))}
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

export default BiopsyReportsTemplate;
