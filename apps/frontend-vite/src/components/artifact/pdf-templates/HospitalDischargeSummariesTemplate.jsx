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

const HospitalDischargeSummariesTemplate = ({ document }) => {
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

      {/* Discharge Date */}
      {document.dischargeDate && (
        <View style={styles.row}>
          <Text style={styles.label}>Discharge Date:</Text>
          <Text style={styles.value}>{formatDate(document.dischargeDate)}</Text>
        </View>
      )}

      {/* Length of Stay */}
      {document.lengthOfStay && (
        <View style={styles.row}>
          <Text style={styles.label}>Length of Stay:</Text>
          <Text style={styles.value}>{document.lengthOfStay}</Text>
        </View>
      )}

      {/* Attending Physician */}
      {document.attendingPhysician && (
        <View style={styles.row}>
          <Text style={styles.label}>Attending Physician:</Text>
          <Text style={styles.value}>{document.attendingPhysician}</Text>
        </View>
      )}

      {/* Service */}
      {document.service && (
        <View style={styles.row}>
          <Text style={styles.label}>Service:</Text>
          <Text style={styles.value}>{document.service}</Text>
        </View>
      )}

      {/* Admission Diagnosis */}
      {document.admissionDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admission Diagnosis:</Text>
          {Array.isArray(document.admissionDiagnosis) ? (
            document.admissionDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.admissionDiagnosis}</Text>
          )}
        </View>
      )}

      {/* Discharge Diagnosis */}
      {document.dischargeDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discharge Diagnosis:</Text>
          {Array.isArray(document.dischargeDiagnosis) ? (
            document.dischargeDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.dischargeDiagnosis}</Text>
          )}
        </View>
      )}

      {/* Hospital Course */}
      {document.hospitalCourse && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hospital Course:</Text>
          <Text style={styles.paragraph}>{document.hospitalCourse}</Text>
        </View>
      )}

      {/* Procedures */}
      {document.procedures && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procedures:</Text>
          {Array.isArray(document.procedures) ? (
            document.procedures.map((procedure, i) => (
              <Text key={i} style={styles.listItem}>• {procedure}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.procedures}</Text>
          )}
        </View>
      )}

      {/* Consultations */}
      {document.consultations && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultations:</Text>
          {Array.isArray(document.consultations) ? (
            document.consultations.map((consultation, i) => (
              <Text key={i} style={styles.listItem}>• {consultation}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.consultations}</Text>
          )}
        </View>
      )}

      {/* Discharge Medications */}
      {document.dischargeMedications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discharge Medications:</Text>
          {Array.isArray(document.dischargeMedications) ? (
            document.dischargeMedications.map((med, i) => (
              <Text key={i} style={styles.listItem}>• {med}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.dischargeMedications}</Text>
          )}
        </View>
      )}

      {/* Discharge Instructions */}
      {document.dischargeInstructions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discharge Instructions:</Text>
          <Text style={styles.paragraph}>{document.dischargeInstructions}</Text>
        </View>
      )}

      {/* Follow-up */}
      {document.followUp && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up:</Text>
          <Text style={styles.paragraph}>{document.followUp}</Text>
        </View>
      )}

      {/* Discharge Condition */}
      {document.dischargeCondition && (
        <View style={styles.row}>
          <Text style={styles.label}>Discharge Condition:</Text>
          <Text style={styles.value}>{document.dischargeCondition}</Text>
        </View>
      )}

      {/* Discharge Disposition */}
      {document.dischargeDisposition && (
        <View style={styles.row}>
          <Text style={styles.label}>Discharge Disposition:</Text>
          <Text style={styles.value}>{document.dischargeDisposition}</Text>
        </View>
      )}
    </View>
  );
};

export default HospitalDischargeSummariesTemplate;
