import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Assistive Devices Document PDF Template
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordMeta: {
    fontSize: 11,
    marginBottom: 16,
    color: '#333333',
    paddingLeft: 4,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 160,
  },
  fieldValue: {
    fontSize: 12,
    color: '#404040',
    flex: 1,
  },
  fieldContent: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    color: '#000000',
  },
  listItem: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
    color: '#666666',
  },
  separator: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateString; }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=\.)\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
};

const AssistiveDevicesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.assistive_devices) return templateData.assistive_devices;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.assistive_devices) return docData.assistive_devices;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // single-field section whose label IS the section title → title header + value below (no duplicate "Label:")
  const renderTitledTextSection = (title, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    return (
      <View style={styles.fieldContainer} wrap={sentences.length > 8}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sentences.length <= 1
          ? <Text style={styles.fieldContent}>{String(value)}</Text>
          : sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
      </View>
    );
  };

  const renderObjectSection = (title, fields) => {
    const hasData = fields.some(([, v]) => v && String(v).trim());
    if (!hasData) return null;
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fields.map(([label, value], i) => {
          if (!value || String(value).trim() === '') return null;
          return (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{label}:</Text>
              <Text style={styles.fieldValue}>{String(value)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Assistive Devices Report</Text>
          <Text style={styles.emptyState}>No assistive devices records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Assistive Devices Report</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {`Assistive Device ${idx + 1}`}
              </Text>
              {record.date && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>
              )}
            </View>

            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {/* Device Information */}
            {renderObjectSection('Device Information', [
              ['Device Type', record.deviceType],
              ['Device Name', record.deviceName],
              ['Indication', record.indication],
            ])}

            {/* Prescription Details */}
            {renderObjectSection('Prescription Details', [
              ['Prescribed By', record.prescribedBy],
              ['Date Ordered', formatDate(record.dateOrdered)],
              ['Date Received', formatDate(record.dateReceived)],
            ])}

            {/* Supplier & Insurance */}
            {renderObjectSection('Supplier & Insurance', [
              ['Supplier', record.supplier],
              ['Insurance', record.insurance],
            ])}

            {/* Training & Compliance */}
            {renderObjectSection('Training & Compliance', [
              ['Training Provided', record.trainingProvided],
              ['Effectiveness', record.effectiveness],
              ['Compliance', record.compliance],
            ])}

            {/* Maintenance */}
            {renderObjectSection('Maintenance', [
              ['Maintenance Schedule', record.maintenanceSchedule],
              ['Replacement Needs', record.replacementNeeds],
            ])}

            {/* Facility */}
            {renderTitledTextSection('Facility', record.facility)}

            {/* Notes */}
            {renderTitledTextSection('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AssistiveDevicesDocumentPDFTemplate;
