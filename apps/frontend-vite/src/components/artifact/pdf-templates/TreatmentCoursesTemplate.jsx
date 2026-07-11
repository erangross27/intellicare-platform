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
  treatmentCard: {
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #7a7a7a',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  phaseCard: {
    backgroundColor: '#f1f1f1',
    borderLeft: '4px solid #a7a7a7',
    padding: 10,
    borderRadius: 4,
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
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: 4,
    backgroundColor: '#7a7a7a',
    color: '#ffffff',
    marginBottom: 6,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: 4,
    color: '#ffffff',
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
  phaseTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
});

const TreatmentCoursesTemplate = ({ document }) => {
  const doc = document;

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return '#808080';
    if (s === 'ongoing' || s === 'in progress') return '#7a7a7a';
    if (s === 'planned') return '#a7a7a7';
    return '#6b7280';
  };

  return (
    <View>
      {/* Treatment Overview */}
      {doc.overview && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Treatment Overview</Text>
          <View style={styles.treatmentCard}>
            <Text style={styles.text}>{doc.overview}</Text>
          </View>
        </View>
      )}

      {/* Diagnosis */}
      {doc.diagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏥 Diagnosis</Text>
          <View style={styles.card}>
            <Text style={[styles.text, styles.textBold]}>{doc.diagnosis}</Text>
          </View>
        </View>
      )}

      {/* Treatment Phases */}
      {doc.phases && doc.phases.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Treatment Phases</Text>
          {doc.phases.map((phase, index) => (
            <View key={index} style={styles.phaseCard}>
              <Text style={styles.phaseTitle}>
                Phase {index + 1}: {phase.name || phase.phase}
              </Text>
              {phase.duration && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Duration: </Text>
                  {phase.duration}
                </Text>
              )}
              {phase.description && (
                <Text style={[styles.text, { marginTop: 4 }]}>{phase.description}</Text>
              )}
              {phase.medications && phase.medications.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.textBold, { fontSize: 9 }]}>Medications:</Text>
                  {phase.medications.map((med, idx) => (
                    <Text key={idx} style={styles.listItem}>• {med}</Text>
                  ))}
                </View>
              )}
              {phase.status && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(phase.status) }]}>
                    {phase.status}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Medications */}
      {doc.medications && doc.medications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Medications</Text>
          <View style={styles.card}>
            {doc.medications.map((med, index) => (
              <Text key={index} style={styles.listItem}>
                • {typeof med === 'string' ? med : `${med.name} - ${med.dosage}`}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Response to Treatment */}
      {doc.response && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Response to Treatment</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.response}</Text>
          </View>
        </View>
      )}

      {/* Side Effects */}
      {doc.sideEffects && doc.sideEffects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Side Effects</Text>
          <View style={styles.card}>
            {doc.sideEffects.map((effect, index) => (
              <Text key={index} style={styles.listItem}>• {effect}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Modifications */}
      {doc.modifications && doc.modifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Treatment Modifications</Text>
          <View style={styles.card}>
            {doc.modifications.map((mod, index) => (
              <Text key={index} style={styles.listItem}>• {mod}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Outcome */}
      {doc.outcome && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✓ Outcome</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.outcome}</Text>
          </View>
        </View>
      )}

      {/* Next Steps */}
      {doc.nextSteps && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>➡️ Next Steps</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.nextSteps}</Text>
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

      {/* Status */}
      {doc.status && (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.textBold}>Status: </Text>
          <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(doc.status) }]}>
            {doc.status}
          </Text>
        </View>
      )}

      {/* Date Range */}
      {(doc.startDate || doc.endDate) && (
        <View style={{ marginTop: 12 }}>
          {doc.startDate && (
            <Text style={styles.badge}>
              Start: {new Date(doc.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          )}
          {doc.endDate && (
            <Text style={styles.badge}>
              End: {new Date(doc.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default TreatmentCoursesTemplate;
