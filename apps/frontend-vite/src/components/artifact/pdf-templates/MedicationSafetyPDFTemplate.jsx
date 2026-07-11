import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationSafetyPDFTemplate - PDF Export for Medication Safety
 * November 2025 Standards - Courier font, 11pt
 * Matches MedicationSafetyDocument.jsx structure
 */

// Helper to filter null/undefined from arrays
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

// Format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return String(date);
  }
};

// Styles - Courier font, 11pt, professional medical document
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 40,
    lineHeight: 1.4
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  recordCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1 solid #cccccc'
  },
  recordHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    textDecoration: 'underline'
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3
  },
  fieldLabel: {
    fontWeight: 'bold',
    minWidth: 140
  },
  fieldValue: {
    flex: 1
  },
  textBlock: {
    marginTop: 2,
    marginBottom: 6,
    lineHeight: 1.4
  },
  listItem: {
    marginLeft: 12,
    marginBottom: 3
  },
  medicationItem: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '0.5 solid #eeeeee'
  },
  medicationName: {
    fontWeight: 'bold',
    marginBottom: 2
  },
  medicationReason: {
    marginLeft: 8,
    marginTop: 2,
    color: '#444444'
  },
  warningSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff5f5',
    borderLeft: '3 solid #5c5c5c'
  },
  cyanSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdfa',
    borderLeft: '3 solid #858585'
  },
  recommendationItem: {
    marginBottom: 4,
    marginLeft: 12
  }
});

const MedicationSafetyPDFTemplate = ({ documents }) => {
  // Handle both array and single document
  const records = Array.isArray(documents) ? documents : [documents];
  const validRecords = filterNulls(records);

  if (!validRecords || validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>Medication Safety</Text>
          <Text>No medication safety records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Medication Safety</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            {/* Record Header */}
            <Text style={styles.recordHeader}>
              {idx + 1}. {record.type || 'Medication Safety Review'}
            </Text>

            {/* General Information - wrap={false} keeps title with content */}
            <View wrap={false}>
              <Text style={styles.sectionTitle}>General Information</Text>

            {record.type && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Type:</Text>
                <Text style={styles.fieldValue}>{record.type}</Text>
              </View>
            )}

            {record.date && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date:</Text>
                <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
              </View>
            )}

            {record.provider && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Provider:</Text>
                <Text style={styles.fieldValue}>{record.provider}</Text>
              </View>
            )}

            {record.facility && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Facility:</Text>
                <Text style={styles.fieldValue}>{record.facility}</Text>
              </View>
            )}

            {record.status && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Status:</Text>
                <Text style={styles.fieldValue}>{record.status}</Text>
              </View>
            )}
            </View>

            {/* Avoid Medications - wrap={false} keeps title with content */}
            {record.avoidMedications && record.avoidMedications.length > 0 && (
              <View style={styles.warningSection} wrap={false}>
                <Text style={styles.sectionTitle}>⚠ Avoid Medications</Text>
                {filterNulls(record.avoidMedications).map((med, medIdx) => (
                  <View key={medIdx} style={styles.medicationItem}>
                    <Text style={styles.medicationName}>
                      {medIdx + 1}. {med.medication} [{med.severity}]
                    </Text>
                    {med.reason && (
                      <Text style={styles.medicationReason}>
                        Reason: {med.reason}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Contrast Restrictions - wrap={false} keeps title with content */}
            {record.contrastRestrictions && (record.contrastRestrictions.restricted || record.contrastRestrictions.reason) && (
              <View style={styles.cyanSection} wrap={false}>
                <Text style={styles.sectionTitle}>Contrast Restrictions</Text>

                {record.contrastRestrictions.restricted && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Restricted:</Text>
                    <Text style={styles.fieldValue}>Yes</Text>
                  </View>
                )}

                {record.contrastRestrictions.requiresApproval && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Requires Approval:</Text>
                    <Text style={styles.fieldValue}>Yes</Text>
                  </View>
                )}

                {record.contrastRestrictions.approvalRequired && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Approval From:</Text>
                    <Text style={styles.fieldValue}>{record.contrastRestrictions.approvalRequired}</Text>
                  </View>
                )}

                {record.contrastRestrictions.reason && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Reason:</Text>
                    <Text style={styles.fieldValue}>{record.contrastRestrictions.reason}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Renal Dosing Review - wrap={false} keeps title with content */}
            {record.renalDosingReview && record.renalDosingReview.required && (
              <View style={styles.cyanSection} wrap={false}>
                <Text style={styles.sectionTitle}>Renal Dosing Review</Text>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Required:</Text>
                  <Text style={styles.fieldValue}>Yes</Text>
                </View>

                {record.renalDosingReview.frequency && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Frequency:</Text>
                    <Text style={styles.fieldValue}>{record.renalDosingReview.frequency}</Text>
                  </View>
                )}

                {record.renalDosingReview.monitoring && (
                  <Text style={styles.textBlock}>
                    Monitoring: {record.renalDosingReview.monitoring}
                  </Text>
                )}
              </View>
            )}

            {/* Drug Interaction Monitoring - wrap={false} keeps title with content */}
            {record.drugInteractionMonitoring && record.drugInteractionMonitoring.required && (
              <View style={styles.cyanSection} wrap={false}>
                <Text style={styles.sectionTitle}>Drug Interaction Monitoring</Text>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Required:</Text>
                  <Text style={styles.fieldValue}>Yes</Text>
                </View>

                {record.drugInteractionMonitoring.rationale && (
                  <Text style={styles.textBlock}>
                    Rationale: {record.drugInteractionMonitoring.rationale}
                  </Text>
                )}

                {record.drugInteractionMonitoring.monitoringPlan && (
                  <Text style={styles.textBlock}>
                    Monitoring Plan: {record.drugInteractionMonitoring.monitoringPlan}
                  </Text>
                )}
              </View>
            )}

            {/* Findings - wrap={false} keeps title with content */}
            {record.findings && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.textBlock}>{record.findings}</Text>
              </View>
            )}

            {/* Assessment - wrap={false} keeps title with content */}
            {record.assessment && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.textBlock}>{record.assessment}</Text>
              </View>
            )}

            {/* Plan - wrap={false} keeps title with content */}
            {record.plan && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.textBlock}>{record.plan}</Text>
              </View>
            )}

            {/* Recommendations - wrap={false} keeps title with content */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {filterNulls(record.recommendations).map((r, recIdx) => {
                  const recText = typeof r === 'object' ? r.recommendation : r;
                  const recDate = r?.date ? formatDate(r.date) : null;
                  return (
                    <Text key={recIdx} style={styles.recommendationItem}>
                      {recIdx + 1}. {recText}{recDate ? ` (Due: ${recDate})` : ''}
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Results - check for empty object, wrap={false} keeps title with content */}
            {record.results && (typeof record.results !== 'object' || Object.keys(record.results).length > 0) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Results</Text>
                <Text style={styles.textBlock}>{record.results}</Text>
              </View>
            )}

            {/* Notes - check for empty object, wrap={false} keeps title with content */}
            {record.notes && (typeof record.notes !== 'object' || Object.keys(record.notes).length > 0) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.textBlock}>{record.notes}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default MedicationSafetyPDFTemplate;
