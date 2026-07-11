import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #cccccc',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    width: '40%',
  },
  value: {
    fontSize: 10,
    color: '#333333',
    width: '60%',
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline',
  },
});

const AdministrativeDataTemplate = ({ document }) => {
  const doc = document;

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

  const formatBoolean = (value) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A';
  };

  return (
    <View style={styles.container}>
      {/* Patient Identifiers */}
      {(doc.mrn || doc.accountNumber) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Identifiers</Text>
          {doc.mrn && (
            <View style={styles.row}>
              <Text style={styles.label}>MRN:</Text>
              <Text style={styles.value}>{doc.mrn}</Text>
            </View>
          )}
          {doc.accountNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Account Number:</Text>
              <Text style={styles.value}>{doc.accountNumber}</Text>
            </View>
          )}
        </View>
      )}

      {/* Insurance & Provider */}
      {(doc.insurance || doc.primaryCareProvider) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance & Provider</Text>
          {doc.insurance && (
            <View style={styles.row}>
              <Text style={styles.label}>Insurance:</Text>
              <Text style={styles.value}>{doc.insurance}</Text>
            </View>
          )}
          {doc.primaryCareProvider && (
            <View style={styles.row}>
              <Text style={styles.label}>Primary Care Provider:</Text>
              <Text style={styles.value}>{doc.primaryCareProvider}</Text>
            </View>
          )}
        </View>
      )}

      {/* Emergency Contact */}
      {doc.emergencyContact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Contact:</Text>
            <Text style={styles.value}>{doc.emergencyContact}</Text>
          </View>
        </View>
      )}

      {/* Code Status & Advanced Directives */}
      {(doc.codeStatus || doc.advancedDirectives !== undefined || doc.powerOfAttorney) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Code Status & Directives</Text>
          {doc.codeStatus && (
            <View style={styles.row}>
              <Text style={styles.label}>Code Status:</Text>
              <Text style={styles.value}>{doc.codeStatus}</Text>
            </View>
          )}
          {doc.advancedDirectives !== undefined && (
            <View style={styles.row}>
              <Text style={styles.label}>Advanced Directives:</Text>
              <Text style={styles.value}>{formatBoolean(doc.advancedDirectives)}</Text>
            </View>
          )}
          {doc.powerOfAttorney && (
            <View style={styles.row}>
              <Text style={styles.label}>Power of Attorney:</Text>
              <Text style={styles.value}>{doc.powerOfAttorney}</Text>
            </View>
          )}
        </View>
      )}

      {/* Admission Information */}
      {(doc.admissionDate || doc.dischargeDate || doc.lengthOfStay || doc.disposition) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admission Information</Text>
          {doc.admissionDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Admission Date:</Text>
              <Text style={styles.value}>{formatDate(doc.admissionDate)}</Text>
            </View>
          )}
          {doc.dischargeDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Discharge Date:</Text>
              <Text style={styles.value}>{formatDate(doc.dischargeDate)}</Text>
            </View>
          )}
          {doc.lengthOfStay && (
            <View style={styles.row}>
              <Text style={styles.label}>Length of Stay:</Text>
              <Text style={styles.value}>{doc.lengthOfStay}</Text>
            </View>
          )}
          {doc.disposition && (
            <View style={styles.row}>
              <Text style={styles.label}>Disposition:</Text>
              <Text style={styles.value}>{doc.disposition}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default AdministrativeDataTemplate;
