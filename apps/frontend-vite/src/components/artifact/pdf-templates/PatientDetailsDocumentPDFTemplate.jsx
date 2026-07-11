import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 40
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center'
  },
  section: {
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    textDecoration: 'underline'
  },
  fieldRow: {
    marginBottom: 2
  },
  fieldLabel: {
    marginRight: 0
  },
  fieldValue: {
    marginLeft: 2
  },
  emptyLine: {
    marginBottom: 6
  }
});

const PatientDetailsDocumentPDFTemplate = ({ document: data }) => {
  /* Unwrap array if needed */
  const rec = Array.isArray(data) ? (data[0] || null) : data;

  if (!rec) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>PATIENT INFORMATION</Text>
          <Text style={styles.fieldRow}>No data available</Text>
        </Page>
      </Document>
    );
  }

  // Calculate age from date of birth — supports MongoDB $date objects
  const calculateAge = (dob) => {
    if (!dob) return '?';
    const birthDate = new Date(dob.$date || dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date — supports MongoDB $date objects
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Not specified';
    try {
      const date = new Date(dateValue.$date || dateValue);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return 'Not specified'; }
  };

  const patientName = rec.patientName || `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || 'Unknown Patient';
  const age = calculateAge(rec.dateOfBirth);
  /* alias rec as data for the JSX below */
  const d = rec;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>PATIENT INFORMATION</Text>

        {/* Patient Name */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.fieldRow}>
            Name: {patientName}
          </Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          <Text style={styles.fieldRow}>
            Full Name: {patientName}
          </Text>
          <Text style={styles.fieldRow}>
            Date of Birth: {formatDate(d.dateOfBirth)}
          </Text>
          <Text style={styles.fieldRow}>
            Age: {age} years old
          </Text>
          <Text style={styles.fieldRow}>
            Gender: {d.gender || 'Not specified'}
          </Text>
          {d.socialSecurityNumber && (
            <Text style={styles.fieldRow}>
              SSN: {d.socialSecurityNumber}
            </Text>
          )}
          {d.nationalId && (
            <Text style={styles.fieldRow}>
              National ID: {d.nationalId}
            </Text>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
          <Text style={styles.fieldRow}>
            Email: {d.email || 'Not provided'}
          </Text>
          <Text style={styles.fieldRow}>
            Phone: {d.phone || d.phoneNumber || 'Not provided'}
          </Text>
          {d.street && d.city && d.state && d.zipCode && (
            <Text style={styles.fieldRow}>
              Address: {d.street}, {d.city}, {d.state} {d.zipCode}{d.country ? ', ' + d.country : ''}
            </Text>
          )}
          <Text style={styles.fieldRow}>
            Preferred Language: {d.preferredLanguage || 'Not specified'}
          </Text>
        </View>

        {/* Medical Information */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>MEDICAL INFORMATION</Text>
          <Text style={styles.fieldRow}>
            Blood Type: {d.bloodType || 'Unknown'}
          </Text>
          <Text style={styles.fieldRow}>
            Allergies: {d.allergies || 'None documented'}
          </Text>
        </View>

        {/* Insurance Information */}
        {(d.insuranceProvider || d.insuranceNumber) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>INSURANCE INFORMATION</Text>
            <Text style={styles.fieldRow}>
              Insurance Provider: {d.insuranceProvider || 'Not specified'}
            </Text>
            <Text style={styles.fieldRow}>
              Insurance Number: {d.insuranceNumber || 'Not specified'}
            </Text>
          </View>
        )}

        {/* Emergency Contact */}
        {(d.emergencyContact || d.emergencyContactPhone) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
            <Text style={styles.fieldRow}>
              Contact Name: {d.emergencyContact || 'Not specified'}
            </Text>
            <Text style={styles.fieldRow}>
              Contact Phone: {d.emergencyContactPhone || 'Not specified'}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default PatientDetailsDocumentPDFTemplate;
