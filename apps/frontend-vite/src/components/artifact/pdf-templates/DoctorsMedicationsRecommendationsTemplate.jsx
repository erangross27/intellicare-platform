import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #000000',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #cccccc',
    padding: 10,
    marginBottom: 10,
  },
  dosageHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  text: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  subsectionTitle: {
    fontWeight: 'bold',
    color: '#000000',
    fontSize: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  subsectionText: {
    fontSize: 10,
    color: '#000000',
    lineHeight: 1.5,
  },
});

const DoctorsMedicationsRecommendationsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>
          {doc.medicationName || doc.name || 'New Medication Recommendation'}
        </Text>

        <View style={styles.card}>
          {/* Dosage & Frequency */}
          <Text style={styles.dosageHeader}>
            {doc.dosage} - {doc.frequency}
          </Text>

          {doc.route && (
            <Text style={styles.text}>
              <Text style={styles.textBold}>Route: </Text>
              {doc.route}
            </Text>
          )}

          {/* Prescriber */}
          {doc.prescriber && (
            <Text style={styles.text}>
              <Text style={styles.textBold}>Recommended by: </Text>
              {doc.prescriber}
            </Text>
          )}

          {/* Date */}
          {doc.date && (
            <Text style={styles.text}>
              <Text style={styles.textBold}>Date: </Text>
              {new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          )}

          {/* Indication */}
          {doc.indication && (
            <Text style={styles.text}>
              <Text style={styles.textBold}>Indication: </Text>
              {doc.indication}
            </Text>
          )}

          {/* Priority */}
          {doc.priority && (
            <Text style={styles.text}>
              <Text style={styles.textBold}>Priority: </Text>
              {doc.priority}
            </Text>
          )}

          {/* Rationale */}
          {doc.rationale && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.subsectionTitle}>Rationale:</Text>
              <Text style={styles.subsectionText}>{doc.rationale}</Text>
            </View>
          )}

          {/* Instructions */}
          {doc.instructions && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.subsectionTitle}>Instructions:</Text>
              <Text style={styles.subsectionText}>{doc.instructions}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default DoctorsMedicationsRecommendationsTemplate;
