import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#000000',
  },
  title: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textDecoration: 'underline',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  col1: { width: '30%' },
  col2: { width: '70%' },
  fieldBlock: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#444444',
    textTransform: 'uppercase',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  fieldValue: {
    fontSize: 11,
    lineHeight: 1.4,
  },
  medItem: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
  },
  warningBox: {
    padding: 5,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 10,
  },
  headerInfo: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
});

const Field = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.fieldBlock} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
};

const MedRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.col1}>{label}:</Text>
    <Text style={styles.col2}>{value}</Text>
  </View>
);

const PsychotropicMedicationsPDFTemplate = ({ data }) => {
  if (!data) return null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.title}>
          <Text>Psychotropic Medications Record</Text>
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.row}>
            <Text>Date: {data.date || data.startDate || 'N/A'}</Text>
            <Text>   Status: {data.active !== false ? 'Active' : 'Inactive'}</Text>
          </View>
          <View style={styles.row}>
            <Text>Provider: {data.provider || data.prescriber || 'N/A'}</Text>
          </View>
        </View>

        {/* Current Medications */}
        {data.current && data.current.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CURRENT MEDICATIONS</Text>
            {data.current.map((med, index) => (
              <View key={index} style={styles.medItem} wrap={false}>
                <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{med.medication}</Text>
                <MedRow label="Dose" value={`${med.dose} ${med.frequency}`} />
                {med.startDate && <MedRow label="Started" value={med.startDate} />}
                {med.response && <MedRow label="Response" value={med.response} />}
                {med.sideEffects && med.sideEffects.length > 0 && (
                  <MedRow label="Side Effects" value={med.sideEffects.join(', ')} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Allergies / Adverse */}
        {data.allergiesAdverse && data.allergiesAdverse.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADVERSE REACTIONS / ALLERGIES</Text>
            <View style={styles.warningBox}>
              {data.allergiesAdverse.map((alg, index) => (
                <View key={index} style={{ marginBottom: 4 }}>
                  <Text style={{ fontWeight: 'bold' }}>{alg.medication}</Text>
                  <Text>  {alg.reaction}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Past Medications */}
        {data.past && data.past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAST MEDICATIONS</Text>
            {data.past.map((med, index) => (
              <View key={index} style={styles.medItem} wrap={false}>
                <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{med.medication}</Text>
                <MedRow label="Max Dose" value={med.maxDose} />
                <MedRow label="Stopped" value={med.reasonStopped} />
                <MedRow label="Efficacy" value={med.efficacy} />
                <MedRow label="Duration" value={med.duration} />
              </View>
            ))}
          </View>
        )}

        {/* Changes */}
        {data.medicationChanges && data.medicationChanges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MEDICATION CHANGES HISTORY</Text>
            {data.medicationChanges.map((change, index) => (
              <View key={index} style={styles.medItem} wrap={false}>
                <View style={styles.row}>
                  <Text style={{ fontWeight: 'bold', width: '20%' }}>{change.action?.toUpperCase()}</Text>
                  <Text style={{ width: '80%' }}>{change.medication} {change.dose}</Text>
                </View>
                {change.reason && <Text style={{ fontSize: 10, fontStyle: 'italic' }}>  Reason: {change.reason}</Text>}
              </View>
            ))}
          </View>
        )}

      </Page>
    </Document>
  );
};

export default PsychotropicMedicationsPDFTemplate;
