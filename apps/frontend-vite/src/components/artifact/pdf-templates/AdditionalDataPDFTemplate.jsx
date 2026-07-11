import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Additional Data PDF Template
 * Professional Black & White Format for Printing (US Letter)
 * Anti-orphaning: wrap={false} on small sections
 */

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, 'deg')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00f7/g, '/')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordDate: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.4,
  },
  subFieldRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  subFieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginRight: 4,
  },
  listItem: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.5,
    marginBottom: 2,
    paddingLeft: 8,
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#000000',
  },
});

const capitalize = (str) =>
  str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const isSystemField = (key) =>
  key.startsWith('_') || ['createdAt', 'updatedAt', 'patientId', 'practiceId', 'approvedSections', 'approvalTimestamp', 'approvedBy', 'updatedBy'].includes(key);

const renderPDFValue = (value, depth = 0) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'boolean' || typeof value === 'number') {
    return <Text style={styles.fieldValue}>{safeString(String(value))}</Text>;
  }

  if (typeof value === 'string') {
    return <Text style={styles.fieldValue}>{safeString(value)}</Text>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <View>
        {value.filter(v => v !== null && v !== undefined).map((item, i) => {
          if (typeof item === 'object' && item !== null) {
            return (
              <View key={i} style={{ marginLeft: 8, marginBottom: 4 }}>
                {Object.entries(item).filter(([k]) => !k.startsWith('_')).map(([k, v], j) => (
                  <View key={j} style={styles.subFieldRow}>
                    <Text style={styles.subFieldLabel}>{safeString(capitalize(k))}:</Text>
                    <Text style={styles.fieldValue}> {safeString(String(v ?? ''))}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return <Text key={i} style={styles.listItem}>- {safeString(String(item))}</Text>;
        })}
      </View>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([k]) => !k.startsWith('_'));
    if (entries.length === 0) return null;
    return (
      <View>
        {entries.map(([k, v], i) => (
          <View key={i} style={styles.subFieldRow}>
            <Text style={styles.subFieldLabel}>{safeString(capitalize(k))}:</Text>
            {typeof v === 'object' && v !== null ? (
              <View style={{ marginLeft: 8 }}>{renderPDFValue(v, depth + 1)}</View>
            ) : (
              <Text style={styles.fieldValue}> {safeString(String(v ?? ''))}</Text>
            )}
          </View>
        ))}
      </View>
    );
  }

  return <Text style={styles.fieldValue}>{safeString(String(value))}</Text>;
};

const AdditionalDataPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  let records = [];
  if (templateData) {
    if (templateData.additional_data) {
      const raw = templateData.additional_data;
      records = Array.isArray(raw) ? raw : [raw];
    } else if (Array.isArray(templateData)) {
      records = templateData;
    } else if (templateData.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) records = docData;
      else if (docData.additional_data) {
        const raw = docData.additional_data;
        records = Array.isArray(raw) ? raw : [raw];
      } else records = [docData];
    } else {
      records = [templateData];
    }
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Additional Data Report</Text>
          </View>
          <Text style={styles.emptyState}>No additional data records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Additional Data Report</Text>
        </View>

        {records.map((record, idx) => {
          const category = record.category || 'Uncategorized';
          const displayFields = Object.entries(record).filter(
            ([key]) => !isSystemField(key) && key !== 'category'
          );

          return (
            <View key={record._id || idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(category)}</Text>
                {record.createdAt && (
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                )}
              </View>

              {displayFields.map(([key, value], fIdx) => (
                <View key={fIdx} style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>{safeString(capitalize(key))}</Text>
                  {renderPDFValue(value)}
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AdditionalDataPDFTemplate;
