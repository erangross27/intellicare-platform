import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #777777',
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

const EmergencyDischargeSummariesTemplate = ({ document }) => {
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
      {/* Arrival Time */}
      {document.arrivalTime && (
        <View style={styles.row}>
          <Text style={styles.label}>Arrival Time:</Text>
          <Text style={styles.value}>{document.arrivalTime}</Text>
        </View>
      )}

      {/* Discharge Time */}
      {document.dischargeTime && (
        <View style={styles.row}>
          <Text style={styles.label}>Discharge Time:</Text>
          <Text style={styles.value}>{document.dischargeTime}</Text>
        </View>
      )}

      {/* ED Physician */}
      {document.edPhysician && (
        <View style={styles.row}>
          <Text style={styles.label}>ED Physician:</Text>
          <Text style={styles.value}>{document.edPhysician}</Text>
        </View>
      )}

      {/* Triage Acuity */}
      {document.triageAcuity && (
        <View style={styles.row}>
          <Text style={styles.label}>Triage Acuity:</Text>
          <Text style={styles.value}>{document.triageAcuity}</Text>
        </View>
      )}

      {/* Chief Complaint */}
      {document.chiefComplaint && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chief Complaint:</Text>
          <Text style={styles.paragraph}>{document.chiefComplaint}</Text>
        </View>
      )}

      {/* ED Course */}
      {document.edCourse && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ED Course:</Text>
          <Text style={styles.paragraph}>{document.edCourse}</Text>
        </View>
      )}

      {/* ED Diagnosis */}
      {document.edDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ED Diagnosis:</Text>
          {Array.isArray(document.edDiagnosis) ? (
            document.edDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.edDiagnosis}</Text>
          )}
        </View>
      )}

      {/* ED Procedures */}
      {document.edProcedures && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ED Procedures:</Text>
          {Array.isArray(document.edProcedures) ? (
            document.edProcedures.map((procedure, i) => (
              <Text key={i} style={styles.listItem}>• {procedure}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.edProcedures}</Text>
          )}
        </View>
      )}

      {/* ED Medications */}
      {document.edMedications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ED Medications:</Text>
          {Array.isArray(document.edMedications) ? (
            document.edMedications.map((med, i) => (
              <Text key={i} style={styles.listItem}>• {med}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.edMedications}</Text>
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

      {/* Return Precautions */}
      {document.returnPrecautions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Return Precautions:</Text>
          <Text style={styles.paragraph}>{document.returnPrecautions}</Text>
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

export default EmergencyDischargeSummariesTemplate;
