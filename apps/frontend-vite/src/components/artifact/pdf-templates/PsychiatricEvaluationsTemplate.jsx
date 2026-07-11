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
    borderBottom: '2px solid #7c7c7c',
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#7c7c7c',
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
    borderLeft: '4px solid #7c7c7c',
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
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
});

const PsychiatricEvaluationsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Chief Complaint */}
      {doc.chiefComplaint && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗣️ Chief Complaint</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.chiefComplaint}</Text>
          </View>
        </View>
      )}

      {/* History of Present Illness */}
      {doc.historyPresentIllness && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 History of Present Illness</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.historyPresentIllness}</Text>
          </View>
        </View>
      )}

      {/* Psychiatric History */}
      {doc.psychiatricHistory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Psychiatric History</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {doc.psychiatricHistory.previousDiagnoses && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.textBold}>Previous Diagnoses:</Text>
                <Text style={styles.text}>{doc.psychiatricHistory.previousDiagnoses}</Text>
              </View>
            )}
            {doc.psychiatricHistory.previousHospitalizations && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.textBold}>Previous Hospitalizations:</Text>
                <Text style={styles.text}>{doc.psychiatricHistory.previousHospitalizations}</Text>
              </View>
            )}
            {doc.psychiatricHistory.suicidalIdeation && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.textBold}>Suicidal Ideation:</Text>
                <Text style={styles.text}>{doc.psychiatricHistory.suicidalIdeation}</Text>
              </View>
            )}
            {doc.psychiatricHistory.selfHarmHistory && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.textBold}>Self-Harm History:</Text>
                <Text style={styles.text}>{doc.psychiatricHistory.selfHarmHistory}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Mental Status Exam */}
      {doc.mentalStatusExam && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Mental Status Exam</Text>
          <View style={styles.card}>
            {Object.entries(doc.mentalStatusExam).map(([key, value], idx) => {
              if (!value) return null;
              return (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <Text style={styles.textBold}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                  </Text>
                  <Text style={styles.text}>{value}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Current Medications */}
      {doc.currentMedications && doc.currentMedications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Current Medications</Text>
          <View style={styles.card}>
            {doc.currentMedications.map((med, idx) => (
              <Text key={idx} style={styles.listItem}>
                • {typeof med === 'string' ? med : med.name || med.medication}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Assessment */}
      {doc.assessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Assessment</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.assessment}</Text>
          </View>
        </View>
      )}

      {/* Treatment Plan */}
      {doc.treatmentPlan && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Treatment Plan</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {typeof doc.treatmentPlan === 'string' ? (
              <Text style={styles.text}>{doc.treatmentPlan}</Text>
            ) : (
              <>
                {doc.treatmentPlan.medications && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.textBold}>Medications:</Text>
                    <Text style={styles.text}>{doc.treatmentPlan.medications}</Text>
                  </View>
                )}
                {doc.treatmentPlan.therapy && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.textBold}>Therapy:</Text>
                    <Text style={styles.text}>{doc.treatmentPlan.therapy}</Text>
                  </View>
                )}
                {doc.treatmentPlan.followUp && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.textBold}>Follow-Up:</Text>
                    <Text style={styles.text}>{doc.treatmentPlan.followUp}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Risk Assessment */}
      {doc.riskAssessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Risk Assessment</Text>
          <View style={[styles.card, { borderLeft: '4px solid #777777' }]}>
            <Text style={styles.text}>{doc.riskAssessment}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default PsychiatricEvaluationsTemplate;
