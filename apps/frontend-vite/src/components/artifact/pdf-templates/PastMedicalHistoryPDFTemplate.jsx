import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  recordHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#656565',
    borderBottomStyle: 'solid',
  },
  conditionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#6c757d',
  },
  // Section styling
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#e9ecef',
    padding: 6,
    marginBottom: 6,
    color: '#000000',
  },
  // Row layout for short fields
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 140,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#495057',
  },
  fieldValue: {
    flex: 1,
    fontSize: 10,
    color: '#000000',
  },
  // Stacked layout for long text fields
  stackedField: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  stackedLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#495057',
  },
  // For single paragraph text
  paragraphValue: {
    fontSize: 10,
    lineHeight: 1.5,
    paddingLeft: 12,
    color: '#000000',
    textAlign: 'justify',
  },
  // For numbered sentences
  sentenceRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 12,
  },
  sentenceNumber: {
    width: 20,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#656565',
  },
  sentenceText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: '#000000',
    textAlign: 'justify',
  },
  // Empty state
  emptyText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 20,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 10,
    color: '#6c757d',
  },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  return true;
};

// Split long text into sentences for better readability
const splitIntoSentences = (text) => {
  const str = safeString(text);
  if (!str) return [];
  return str.split(/(?<=[.!?;])\s+/)
    .filter(s => s.trim())
    .map(s => s.trim().replace(/;$/, ''));
};

// Split comma-separated items (for Treatment, Complications, etc.)
const splitByComma = (text) => {
  const str = safeString(text);
  if (!str) return [];
  return str.split(/,\s*/)
    .filter(s => s.trim())
    .map(s => s.trim());
};

// Format date
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
};

// Row field for short single-line values
const RowField = ({ label, value }) => {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.fieldRow} wrap={false}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

// Stacked field for long text - displays as numbered items
// Uses comma-splitting for list-like fields (Treatment, Complications, etc.)
// Uses sentence-splitting for narrative fields (Notes, Current Management)
const StackedField = ({ label, value, splitByComma: useComma = false }) => {
  // Choose splitting method based on field type
  const items = useComma ? splitByComma(value) : splitIntoSentences(value);
  if (items.length === 0) return null;

  // Single item - display as paragraph
  if (items.length === 1) {
    return (
      <View style={styles.stackedField} wrap={false}>
        <Text style={styles.stackedLabel}>{label}:</Text>
        <Text style={styles.paragraphValue}>{items[0]}</Text>
      </View>
    );
  }

  // Multiple items - display with numbering
  return (
    <View style={styles.stackedField} wrap={false}>
      <Text style={styles.stackedLabel}>{label}:</Text>
      {items.map((item, idx) => (
        <View key={idx} style={styles.sentenceRow}>
          <Text style={styles.sentenceNumber}>{idx + 1}.</Text>
          <Text style={styles.sentenceText}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

const PastMedicalHistoryRecord = ({ record, index }) => {
  return (
    <View style={styles.recordContainer}>
      {/* Record Header */}
      <View style={styles.recordHeader} wrap={false}>
        <Text style={styles.conditionTitle}>
          {index + 1}. {safeString(record.condition || 'Unknown Condition')}
        </Text>
        {record.diagnosisDate && (
          <Text style={styles.dateText}>
            Diagnosed: {formatDate(record.diagnosisDate)}
          </Text>
        )}
      </View>

      {/* Basic Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <RowField label="Status" value={record.status} />
        <RowField label="Provider" value={record.provider} />
      </View>

      {/* Treatment Section - split by comma for medication list */}
      {hasValue(record.treatment) && (
        <View style={styles.section}>
          <StackedField label="Treatment" value={record.treatment} splitByComma={true} />
        </View>
      )}

      {/* Current Management Section */}
      {hasValue(record.currentManagement) && (
        <View style={styles.section}>
          <StackedField label="Current Management" value={record.currentManagement} />
        </View>
      )}

      {/* Complications Section - split by comma for list of complications */}
      {hasValue(record.complications) && (
        <View style={styles.section}>
          <StackedField label="Complications" value={record.complications} splitByComma={true} />
        </View>
      )}

      {/* Hospitalizations Section */}
      {hasValue(record.hospitalizations) && (
        <View style={styles.section}>
          <StackedField label="Hospitalizations" value={record.hospitalizations} />
        </View>
      )}

      {/* Notes Section */}
      {hasValue(record.notes) && (
        <View style={styles.section}>
          <StackedField label="Notes" value={record.notes} />
        </View>
      )}
    </View>
  );
};

const PastMedicalHistoryPDFTemplate = ({ data }) => {
  // Handle data formats
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.past_medical_history) {
    records = data.past_medical_history;
  } else if (data?.data) {
    records = Array.isArray(data.data) ? data.data : [data.data];
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Past Medical History</Text>
          <Text style={styles.emptyText}>No past medical history records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Past Medical History</Text>
        
        {records.map((record, idx) => (
          <PastMedicalHistoryRecord 
            key={record._id || idx} 
            record={record} 
            index={idx} 
          />
        ))}
        
        <Text style={styles.pageNumber}>
          Page 1 of 1
        </Text>
      </Page>
    </Document>
  );
};

export default PastMedicalHistoryPDFTemplate;
