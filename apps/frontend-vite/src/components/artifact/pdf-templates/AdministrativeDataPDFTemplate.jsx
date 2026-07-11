import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AdministrativeDataPDFTemplate - Custom PDF template for administrative data
 *
 * Generates a professional PDF report with organized sections:
 * - Patient Identification
 * - Admission & Discharge
 * - Clinical Information
 * - Care Team & Contacts
 * - Legal & Advance Directives
 * - Electronic Signature
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#000000'
  },
  subtitle: {
    fontSize: 9,
    color: '#000000',
    marginBottom: 2
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    width: '30%'
  },
  fieldValue: {
    fontSize: 9,
    color: '#000000',
    width: '70%',
    flexWrap: 'wrap'
  },
  fieldValueBlock: {
    fontSize: 9,
    color: '#000000',
    marginTop: 2,
    marginLeft: 20,
    lineHeight: 1.3
  },
  signatureText: {
    fontSize: 9,
    color: '#000000',
    marginTop: 2,
    marginLeft: 20,
    lineHeight: 1.3
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#000000',
    textAlign: 'center',
    paddingTop: 10
  },
  footerText: {
    marginBottom: 2
  },
  emptyValue: {
    fontSize: 9,
    color: '#666666',
    fontStyle: 'italic',
    marginLeft: 20
  }
});

const AdministrativeDataPDFTemplate = ({ documents, patientName }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const renderField = (label, value) => {
    if (!value) return null;
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}:</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    );
  };

  const renderFieldBlock = (label, value) => {
    if (!value) return null;
    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.fieldLabel}>{label}:</Text>
        <Text style={styles.fieldValueBlock}>{value}</Text>
      </View>
    );
  };

  return (
    <Document>
      {documents.map((record, docIndex) => (
        <Page key={docIndex} size="A4" style={styles.page} wrap>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Administrative Data</Text>
            {patientName && (
              <Text style={styles.subtitle}>Patient: {patientName}</Text>
            )}
            <Text style={styles.subtitle}>
              Generated: {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>

          {/* Patient Identification Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PATIENT IDENTIFICATION</Text>
            {renderField('MRN', record.mrn)}
            {renderField('Account Number', record.accountNumber)}
            {renderField('Insurance', record.insurance)}
            {!record.mrn && !record.accountNumber && !record.insurance && (
              <Text style={styles.emptyValue}>No patient identification data available</Text>
            )}
          </View>

          {/* Admission & Discharge Section */}
          {(record.admissionDate || record.dischargeDate || record.lengthOfStay || record.disposition) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ADMISSION & DISCHARGE</Text>
              {record.admissionDate && renderField('Admission Date', formatDate(record.admissionDate))}
              {record.dischargeDate && renderField('Discharge Date', formatDate(record.dischargeDate))}
              {record.lengthOfStay && renderField('Length of Stay', `${record.lengthOfStay} ${record.lengthOfStay === 1 ? 'day' : 'days'}`)}
              {record.disposition && renderField('Disposition', record.disposition)}
            </View>
          )}

          {/* Clinical Information Section */}
          {(record.admittingDiagnosis || record.conditionAtDischarge || record.dietaryInstructions) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CLINICAL INFORMATION</Text>
              {record.admittingDiagnosis && renderFieldBlock('Admitting Diagnosis', record.admittingDiagnosis)}
              {record.conditionAtDischarge && renderField('Condition at Discharge', record.conditionAtDischarge)}
              {record.dietaryInstructions && renderFieldBlock('Dietary Instructions', record.dietaryInstructions)}
            </View>
          )}

          {/* Care Team & Contacts Section */}
          {(record.primaryCareProvider || record.emergencyContact || record.facility) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CARE TEAM & CONTACTS</Text>
              {record.primaryCareProvider && renderField('Primary Care Provider', record.primaryCareProvider)}
              {record.emergencyContact && renderField('Emergency Contact', record.emergencyContact)}
              {record.facility && renderField('Facility', record.facility)}
            </View>
          )}

          {/* Legal & Advance Directives Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LEGAL & ADVANCE DIRECTIVES</Text>
            {record.codeStatus && renderField('Code Status', record.codeStatus)}
            {renderField('Advanced Directives', record.advancedDirectives ? 'Yes' : 'No')}
            {record.powerOfAttorney && renderField('Power of Attorney', record.powerOfAttorney)}
          </View>

          {/* Electronic Signature Section */}
          {record.electronicSignature && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ELECTRONIC SIGNATURE</Text>
              <Text style={styles.signatureText}>{record.electronicSignature}</Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>IntelliCare Administrative Report - Confidential Patient Information</Text>
            <Text style={styles.footerText}>This document contains protected health information (PHI)</Text>
            <Text style={styles.footerText}>Page {docIndex + 1} of {documents.length}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default AdministrativeDataPDFTemplate;
