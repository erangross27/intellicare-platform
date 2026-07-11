import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
    textAlign: 'left',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
});

const CurrentMedicationsTemplate = ({ document }) => {
  const doc = document;
  const medName = doc.medicationName || doc.name;
  const prescriber = doc.prescribedBy || doc.prescriber;
  const indication = doc.reason || doc.indication;
  const isActive = doc.active !== undefined ? doc.active : (doc.status?.toLowerCase() === 'active');

  const formatDate = (dateString) => {
    if (!dateString) return null;
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
    <View wrap={false}>
      {/* Medication Name */}
      <Text style={styles.medicationName}>{medName || 'Medication'}</Text>

      {/* Status */}
      <Text style={[styles.line, { marginTop: 4 }]}>
        <Text style={styles.textBold}>Status: </Text>
        {isActive ? 'Active' : 'Inactive'}
      </Text>

      {/* Dosage */}
      {doc.dosage && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Dosage: </Text>
          {doc.dosage}
        </Text>
      )}

      {/* Frequency */}
      {doc.frequency && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Frequency: </Text>
          {doc.frequency}
        </Text>
      )}

      {/* Route */}
      {doc.route && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Route: </Text>
          {doc.route}
        </Text>
      )}

      {/* Prescriber */}
      {prescriber && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Prescriber: </Text>
          {prescriber}
        </Text>
      )}

      {/* Start Date */}
      {doc.startDate && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Started: </Text>
          {formatDate(doc.startDate)}
        </Text>
      )}

      {/* Indication/Reason */}
      {indication && indication.trim() && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Indication: </Text>
          {indication}
        </Text>
      )}

      {/* Instructions */}
      {doc.instructions && doc.instructions.trim() && (
        <>
          <Text style={[styles.line, { marginTop: 4 }]}>
            <Text style={styles.textBold}>Instructions:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.instructions}
          </Text>
        </>
      )}

      {/* Notes */}
      {doc.notes && doc.notes.trim() && (
        <>
          <Text style={[styles.line, { marginTop: 4 }]}>
            <Text style={styles.textBold}>Notes:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.notes}
          </Text>
        </>
      )}
    </View>
  );
};

export default CurrentMedicationsTemplate;
