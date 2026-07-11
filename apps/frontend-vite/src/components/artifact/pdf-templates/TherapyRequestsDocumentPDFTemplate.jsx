import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF styles - December 2025 standard (12pt, Helvetica, wrap={false})
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
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 8,
  },
  recordCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#3a3f47',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
    color: '#4b5563',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#1f2937',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  statusYes: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  statusNo: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
});

const TherapyRequestsDocumentPDFTemplate = ({ document }) => {
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

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '';
      if (val.value !== undefined) return String(val.value);
      if (val.text !== undefined) return String(val.text);
      return JSON.stringify(val);
    }
    return String(val);
  };

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

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Therapy Requests</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No therapy request data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Therapy Requests</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>{`Therapy Request ${idx + 1}`}</Text>

            {/* Request Information Section */}
            {(record.date || record.requestIntent || record.requestPriority || record.authoredOn) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Request Information</Text>
                {record.date && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Date</Text>
                    <Text style={styles.fieldValue}>{String(formatDate(record.date))}</Text>
                  </View>
                )}
                {record.requestIntent && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Intent</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.requestIntent))}</Text>
                  </View>
                )}
                {record.requestPriority && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Priority</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.requestPriority))}</Text>
                  </View>
                )}
                {record.authoredOn && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Authored On</Text>
                    <Text style={styles.fieldValue}>{String(formatDate(record.authoredOn))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Therapy Details Section */}
            {(record.therapyType || record.bodyStructure || record.laterality || record.therapyCode || record.therapyCodeSystem) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Therapy Details</Text>
                {record.therapyType && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Therapy Type</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.therapyType))}</Text>
                  </View>
                )}
                {record.bodyStructure && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Body Structure</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.bodyStructure))}</Text>
                  </View>
                )}
                {record.laterality && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Laterality</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.laterality))}</Text>
                  </View>
                )}
                {record.therapyCode && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Therapy Code</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.therapyCode))}</Text>
                  </View>
                )}
                {record.therapyCodeSystem && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Code System</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.therapyCodeSystem))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Justification Section */}
            {(record.reasonCode || record.reasonReference) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Justification</Text>
                {record.reasonCode && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Reason</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.reasonCode))}</Text>
                  </View>
                )}
                {record.reasonReference && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Reference</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.reasonReference))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Requester Information Section */}
            {(record.requesterName || record.requesterSpecialty || record.requesterId) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Requester Information</Text>
                {record.requesterName && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Requester</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.requesterName))}</Text>
                  </View>
                )}
                {record.requesterSpecialty && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Specialty</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.requesterSpecialty))}</Text>
                  </View>
                )}
                {record.requesterId && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Requester ID</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.requesterId))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Performer Information Section */}
            {(record.performerType || record.performerId) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Performer Information</Text>
                {record.performerType && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Performer Type</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.performerType))}</Text>
                  </View>
                )}
                {record.performerId && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Performer ID</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.performerId))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Schedule Section */}
            {(record.numberOfSessions || record.sessionDuration || record.occurrenceTiming || record.occurrenceStartDate || record.occurrenceEndDate) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Schedule</Text>
                {record.numberOfSessions !== undefined && record.numberOfSessions !== null && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Number of Sessions</Text>
                    <Text style={styles.fieldValue}>{String(record.numberOfSessions)}</Text>
                  </View>
                )}
                {record.sessionDuration !== undefined && record.sessionDuration !== null && record.sessionDuration > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Session Duration</Text>
                    <Text style={styles.fieldValue}>{`${record.sessionDuration} minutes`}</Text>
                  </View>
                )}
                {record.occurrenceTiming && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Occurrence Timing</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.occurrenceTiming))}</Text>
                  </View>
                )}
                {record.occurrenceStartDate && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Start Date</Text>
                    <Text style={styles.fieldValue}>{String(formatDate(record.occurrenceStartDate))}</Text>
                  </View>
                )}
                {record.occurrenceEndDate && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>End Date</Text>
                    <Text style={styles.fieldValue}>{String(formatDate(record.occurrenceEndDate))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Functional Goals Section */}
            {record.functionalGoals && record.functionalGoals.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Goals</Text>
                {record.functionalGoals.map((goal, gIdx) => (
                  <Text key={gIdx} style={styles.listItem}>{`${gIdx + 1}. ${String(goal)}`}</Text>
                ))}
              </View>
            )}

            {/* Authorization Section */}
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Authorization</Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldSubtitle}>Prior Authorization Required</Text>
                <Text style={record.priorAuthorizationRequired ? styles.statusYes : styles.statusNo}>
                  {record.priorAuthorizationRequired ? 'Yes' : 'No'}
                </Text>
              </View>
              {record.priorAuthorizationNumber && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldSubtitle}>Authorization Number</Text>
                  <Text style={styles.fieldValue}>{String(safeString(record.priorAuthorizationNumber))}</Text>
                </View>
              )}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldSubtitle}>Insurance Verified</Text>
                <Text style={record.insuranceVerified ? styles.statusYes : styles.statusNo}>
                  {record.insuranceVerified ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            {/* Setting Section */}
            {(record.settingType || record.locationId) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Setting</Text>
                {record.settingType && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Setting Type</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.settingType))}</Text>
                  </View>
                )}
                {record.locationId && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Location</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.locationId))}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TherapyRequestsDocumentPDFTemplate;
