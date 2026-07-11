import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Register Helvetica (built-in, no registration needed)

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  row: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 4,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#444444',
    marginTop: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue || '');
  }
};

// Safe string conversion
const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const AccessPlanningDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) {
      records = document[0].records;
    } else if (document.length > 0 && document[0]?._records) {
      records = document[0]._records;
    } else {
      records = document;
    }
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Access Planning</Text>
          <Text style={styles.noData}>No access planning data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Access Planning</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            <Text style={styles.recordTitle}>Access Planning {idx + 1}</Text>

            {/* Planning Information */}
            {(record.date || record.provider || record.facility) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Planning Information</Text>
                {record.date && (
                  <View style={styles.row}>
                    <Text style={styles.label}>1. Date</Text>
                    <Text style={styles.value}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.row}>
                    <Text style={styles.label}>2. Provider</Text>
                    <Text style={styles.value}>{toSafeString(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.row}>
                    <Text style={styles.label}>3. Facility</Text>
                    <Text style={styles.value}>{toSafeString(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Access Details */}
            {(record.accessType || record.indication || record.plannedSite || record.vascularMapping) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Access Details</Text>
                {record.accessType && (
                  <View style={styles.row}>
                    <Text style={styles.label}>1. Access Type</Text>
                    <Text style={styles.value}>{toSafeString(record.accessType)}</Text>
                  </View>
                )}
                {record.indication && (
                  <View style={styles.row}>
                    <Text style={styles.label}>2. Indication</Text>
                    <Text style={styles.value}>{toSafeString(record.indication)}</Text>
                  </View>
                )}
                {record.plannedSite && (
                  <View style={styles.row}>
                    <Text style={styles.label}>3. Planned Site</Text>
                    <Text style={styles.value}>{toSafeString(record.plannedSite)}</Text>
                  </View>
                )}
                {record.vascularMapping && (
                  <View style={styles.row}>
                    <Text style={styles.label}>4. Vascular Mapping</Text>
                    <Text style={styles.value}>{toSafeString(record.vascularMapping)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Procedure Details */}
            {(record.plannedDate || record.surgeon) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Procedure Details</Text>
                {record.plannedDate && (
                  <View style={styles.row}>
                    <Text style={styles.label}>1. Planned Date</Text>
                    <Text style={styles.value}>{formatDate(record.plannedDate)}</Text>
                  </View>
                )}
                {record.surgeon && (
                  <View style={styles.row}>
                    <Text style={styles.label}>2. Surgeon</Text>
                    <Text style={styles.value}>{toSafeString(record.surgeon)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Considerations */}
            {(record.preoperativeConsiderations?.length > 0 || record.anticoagulation || record.temporaryAccess) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Clinical Considerations</Text>
                {record.preoperativeConsiderations?.length > 0 && (
                  <View>
                    <Text style={styles.subsectionTitle}>Preoperative Considerations</Text>
                    {record.preoperativeConsiderations.map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 1}. {toSafeString(item)}
                      </Text>
                    ))}
                  </View>
                )}
                {record.anticoagulation && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Anticoagulation</Text>
                    <Text style={styles.value}>{toSafeString(record.anticoagulation)}</Text>
                  </View>
                )}
                {record.temporaryAccess && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Temporary Access</Text>
                    <Text style={styles.value}>{toSafeString(record.temporaryAccess)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Follow-Up */}
            {(record.maturationTime || record.followUp) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Follow-Up</Text>
                {record.maturationTime && (
                  <View style={styles.row}>
                    <Text style={styles.label}>1. Maturation Time</Text>
                    <Text style={styles.value}>{toSafeString(record.maturationTime)}</Text>
                  </View>
                )}
                {record.followUp && (
                  <View style={styles.row}>
                    <Text style={styles.label}>2. Follow-Up Plan</Text>
                    <Text style={styles.value}>{toSafeString(record.followUp)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Notes */}
            {record.notes && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.row}>
                  <Text style={styles.value}>{toSafeString(record.notes)}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AccessPlanningDocumentPDFTemplate;
