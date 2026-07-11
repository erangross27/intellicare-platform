import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #7a7a7a',
    borderRadius: 2
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000'
  },
  value: {
    fontSize: 10,
    color: '#333333',
    marginLeft: 4
  },
  section: {
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline'
  },
  paragraph: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.6,
    marginBottom: 6
  },
  listItem: {
    fontSize: 9,
    color: '#333333',
    marginLeft: 12,
    marginBottom: 3,
    lineHeight: 1.4
  }
});

const AdmissionAssessmentsTemplate = ({ document }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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
    <View style={styles.card}>
      {/* Admission Date */}
      {document.admissionDate && (
        <View style={styles.row}>
          <Text style={styles.label}>Admission Date:</Text>
          <Text style={styles.value}>{formatDate(document.admissionDate)}</Text>
        </View>
      )}

      {/* Admitting Physician */}
      {document.admittingPhysician && (
        <View style={styles.row}>
          <Text style={styles.label}>Admitting Physician:</Text>
          <Text style={styles.value}>{document.admittingPhysician}</Text>
        </View>
      )}

      {/* Service */}
      {document.service && (
        <View style={styles.row}>
          <Text style={styles.label}>Service:</Text>
          <Text style={styles.value}>{document.service}</Text>
        </View>
      )}

      {/* Admitting Diagnosis */}
      {document.admittingDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admitting Diagnosis:</Text>
          {Array.isArray(document.admittingDiagnosis) ? (
            document.admittingDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.admittingDiagnosis}</Text>
          )}
        </View>
      )}

      {/* Chief Complaint */}
      {document.chiefComplaint && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chief Complaint:</Text>
          <Text style={styles.paragraph}>{document.chiefComplaint}</Text>
        </View>
      )}

      {/* History of Present Illness */}
      {document.historyPresentIllness && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History of Present Illness:</Text>
          <Text style={styles.paragraph}>{document.historyPresentIllness}</Text>
        </View>
      )}

      {/* Past Medical History */}
      {document.pastMedicalHistory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Medical History:</Text>
          {Array.isArray(document.pastMedicalHistory) ? (
            document.pastMedicalHistory.map((history, i) => (
              <Text key={i} style={styles.listItem}>• {history}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.pastMedicalHistory}</Text>
          )}
        </View>
      )}

      {/* Medications */}
      {document.medications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Home Medications:</Text>
          {Array.isArray(document.medications) ? (
            document.medications.map((med, i) => (
              <Text key={i} style={styles.listItem}>• {med}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.medications}</Text>
          )}
        </View>
      )}

      {/* Allergies */}
      {document.allergies && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies:</Text>
          {Array.isArray(document.allergies) ? (
            document.allergies.map((allergy, i) => (
              <Text key={i} style={styles.listItem}>• {allergy}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.allergies}</Text>
          )}
        </View>
      )}

      {/* Physical Examination */}
      {document.physicalExamination && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Physical Examination:</Text>
          <Text style={styles.paragraph}>{document.physicalExamination}</Text>
        </View>
      )}

      {/* Vital Signs */}
      {document.vitalSigns && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs:</Text>
          <Text style={styles.paragraph}>
            {typeof document.vitalSigns === 'object' ?
              Object.entries(document.vitalSigns).map(([key, value]) => `${key}: ${value}`).join(', ') :
              document.vitalSigns}
          </Text>
        </View>
      )}

      {/* Assessment */}
      {document.assessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment:</Text>
          <Text style={styles.paragraph}>{document.assessment}</Text>
        </View>
      )}

      {/* Plan */}
      {document.plan && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan:</Text>
          <Text style={styles.paragraph}>{document.plan}</Text>
        </View>
      )}
    </View>
  );
};

export default AdmissionAssessmentsTemplate;
