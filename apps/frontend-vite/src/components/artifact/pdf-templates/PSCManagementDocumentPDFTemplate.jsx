import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PSC Management PDF Template - March 2026
 * Primary Sclerosing Cholangitis Management
 * Professional Black & White Format for Printing
 * Aligned with JSX: same fields, same sentence splitting
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#000000',
  },
  header: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#333333',
  },
  generatedDate: {
    fontSize: 9,
    color: '#333333',
    marginTop: 4,
  },
  recordContainer: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#000000',
  },
  recordHeaderLeft: {
    flexDirection: 'column',
  },
  recordHeaderRight: {
    flexDirection: 'row',
    gap: 10,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  dateBadge: {
    fontSize: 9,
    color: '#000000',
    backgroundColor: '#e0e0e0',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  statusBadge: {
    fontSize: 9,
    color: '#000000',
    backgroundColor: '#e0e0e0',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniCard: {
    backgroundColor: '#fafafa',
    padding: 12,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  nestedSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: '#ffffff',
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  rowNumber: {
    fontSize: 9,
    color: '#333333',
    width: 20,
    fontWeight: 'bold',
  },
  rowContent: {
    flex: 1,
    fontSize: 10,
    color: '#000000',
    lineHeight: 1.4,
  },
  simpleField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 10,
    color: '#000000',
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  providerSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  providerGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  providerItem: {
    flex: 1,
  },
  providerLabel: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  providerValue: {
    fontSize: 10,
    fontWeight: 'medium',
    color: '#000000',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#333333',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 10,
  },
  noRecords: {
    textAlign: 'center',
    padding: 40,
    color: '#333333',
    fontSize: 12,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

/* splitBySentence with title protection (Mr./Dr./Mrs./Ms.) */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const SimpleField = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.simpleField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{fmtVal(value)}</Text>
    </View>
  );
};

const TextSection = ({ title, text }) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.miniCard}>
        <Text style={styles.nestedSubtitle}>{title}</Text>
        {sentences.map((sentence, idx) => (
          <View key={idx} style={styles.row}>
            <Text style={styles.rowNumber}>{idx + 1}.</Text>
            <Text style={styles.rowContent}>{sentence}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const ArraySection = ({ title, items }) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.miniCard}>
        <Text style={styles.nestedSubtitle}>{title}</Text>
        {safeItems.map((item, idx) => {
          const text = typeof item === 'string' ? item : item.recommendation || item.text || JSON.stringify(item);
          return (
            <View key={idx} style={styles.row}>
              <Text style={styles.rowNumber}>{idx + 1}.</Text>
              <Text style={styles.rowContent}>{text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const PSCManagementDocumentPDFTemplate = ({ document }) => {
  const records = Array.isArray(document) ? document : [document];
  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>PSC Management Report</Text>
            <Text style={styles.subtitle}>Primary Sclerosing Cholangitis Management</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.generatedDate}>Generated: {formatDateShort(new Date().toISOString())}</Text>
          </View>
        </View>

        {/* Records */}
        {!hasRecords ? (
          <Text style={styles.noRecords}>No PSC management records available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordHeaderLeft}>
                  <Text style={styles.recordTitle}>Record #{idx + 1}</Text>
                </View>
                <View style={styles.recordHeaderRight}>
                  {hasVal(record.date) && (
                    <Text style={styles.dateBadge}>{formatDate(record.date)}</Text>
                  )}
                  {hasVal(record.status) && (
                    <Text style={styles.statusBadge}>{record.status}</Text>
                  )}
                </View>
              </View>

              {/* Overview */}
              {hasVal(record.type) && <SimpleField label="Type" value={record.type} />}
              {hasVal(record.provider) && <SimpleField label="Provider" value={record.provider} />}
              {hasVal(record.facility) && <SimpleField label="Facility" value={record.facility} />}

              {/* Medication & Imaging */}
              <SimpleField label="Ursodeoxycholic Acid" value={record.ursodeoxycholicAcid} />
              <TextSection title="MRCP" text={record.mrcp} />
              <SimpleField label="Dominant Strictures" value={record.dominantStrictures} />

              {/* Management & Assessment */}
              <TextSection title="Hepatology Management" text={record.hepatologyManagement} />
              <TextSection title="Findings" text={record.findings} />
              <TextSection title="Assessment" text={record.assessment} />

              {/* Plan & Recommendations */}
              <TextSection title="Plan" text={record.plan} />
              <ArraySection title="Recommendations" items={record.recommendations} />

              {/* Notes */}
              <TextSection title="Notes" text={record.notes} />
            </View>
          ))
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Confidential Medical Document - PSC Management Report
        </Text>
      </Page>
    </Document>
  );
};

export default PSCManagementDocumentPDFTemplate;
