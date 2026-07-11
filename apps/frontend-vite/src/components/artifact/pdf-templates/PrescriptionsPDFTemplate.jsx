import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Prescriptions PDF Template — March 2026
 * Helvetica font, LETTER size, 20pt titles / 12pt body
 * Black & white, clean layout
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  documentSubtitle: {
    fontSize: 9,
    textAlign: 'center',
  },
  recordHeader: {
    marginBottom: 16,
  },
  recordDate: {
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 4,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  medicationName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#424242',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 90,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 1.4,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  itemNumber: {
    width: 20,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  itemContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 6,
    textAlign: 'center',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 40,
    fontSize: 8,
  },
});

// ============== HELPER FUNCTIONS ==============

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u03BCm/g, 'um');
  str = str.replace(/\u00B5m/g, 'um');
  str = str.replace(/\u00B0/g, ' deg');
  str = str.replace(/\u00B1/g, '+/-');
  str = str.replace(/\u2265/g, '>=');
  str = str.replace(/\u2264/g, '<=');
  str = str.replace(/\u2192/g, '->');
  str = str.replace(/\u2190/g, '<-');
  str = str.replace(/\u00D7/g, 'x');
  str = str.replace(/\u00F7/g, '/');
  str = str.replace(/\u2022/g, '-');
  str = str.replace(/\u2013/g, '-');
  str = str.replace(/\u2014/g, '-');
  str = str.replace(/\u201C/g, '"');
  str = str.replace(/\u201D/g, '"');
  str = str.replace(/\u2018/g, "'");
  str = str.replace(/\u2019/g, "'");
  return str;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString.$date || dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// ============== COMPONENTS ==============

const FieldRow = ({ label, value }) => {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{safeString(label)}:</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const NumberedSection = ({ title, text }) => {
  const sentences = splitBySentence(text);
  if (sentences.length === 0) return null;
  const isSmall = sentences.length <= 4;

  if (isSmall) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {sentences.map((sentence, idx) => (
          <View key={idx} style={styles.numberedItem}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemContent}>{safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {sentences.slice(0, 1).map((sentence, idx) => (
          <View key={idx} style={styles.numberedItem}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemContent}>{safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}</Text>
          </View>
        ))}
      </View>
      {sentences.slice(1).map((sentence, idx) => (
        <View key={idx + 1} style={styles.numberedItem}>
          <Text style={styles.itemNumber}>{idx + 2}.</Text>
          <Text style={styles.itemContent}>{safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}</Text>
        </View>
      ))}
    </View>
  );
};

// ============== MAIN COMPONENT ==============

const PrescriptionsPDFTemplate = ({ document: docProp, data, documents }) => {
  let prescriptions = [];

  // Handle documents array (legacy)
  if (documents && Array.isArray(documents)) {
    documents.forEach(doc => {
      if (doc.prescriptions && Array.isArray(doc.prescriptions)) {
        prescriptions = prescriptions.concat(doc.prescriptions);
      } else if (Array.isArray(doc)) {
        prescriptions = prescriptions.concat(doc);
      }
    });
  }

  // Then check document or data props
  const templateData = docProp || data;

  if (prescriptions.length === 0 && templateData) {
    if (Array.isArray(templateData)) {
      prescriptions = templateData.flatMap(item => {
        if (item.prescriptions) return item.prescriptions;
        if (item._records) return item._records;
        return item;
      });
    } else if (templateData.documentData?._records) {
      prescriptions = templateData.documentData._records;
    } else if (templateData._records) {
      prescriptions = templateData._records;
    } else if (templateData.prescriptions) {
      prescriptions = Array.isArray(templateData.prescriptions) ? templateData.prescriptions : [templateData.prescriptions];
    } else if (templateData.medication || templateData.prescriber) {
      prescriptions = [templateData];
    }
  }

  prescriptions = prescriptions.filter(r => r !== null && r !== undefined);

  const useMultiplePages = prescriptions.length > 2;

  const renderRecord = (record, recordIdx) => (
    <View key={recordIdx} style={{ marginBottom: 20 }}>
      <View style={styles.recordHeader} wrap={false}>
        {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
        <Text style={styles.recordTitle}>Prescription {recordIdx + 1}</Text>
        {record.medication && <Text style={styles.medicationName}>{safeString(record.medication)}</Text>}
      </View>

      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>Prescription Details</Text>
        <FieldRow label="Medication" value={record.medication} />
        <FieldRow label="Dosage" value={record.dosage} />
        <FieldRow label="Frequency" value={record.frequency} />
        <FieldRow label="Quantity" value={record.quantity} />
        <FieldRow label="Refills" value={record.refills} />
      </View>

      {(hasValue(record.prescriber) || hasValue(record.pharmacy) || hasValue(record.date)) && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Provider Information</Text>
          <FieldRow label="Prescriber" value={record.prescriber} />
          <FieldRow label="Pharmacy" value={record.pharmacy} />
          <FieldRow label="Date" value={formatDate(record.date)} />
        </View>
      )}

      {hasValue(record.indication) && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Indication</Text>
          <Text style={[styles.fieldValue, { paddingLeft: 8 }]}>{safeString(record.indication)}</Text>
        </View>
      )}

      {hasValue(record.instructions) && (
        <NumberedSection title="Instructions" text={record.instructions} />
      )}
    </View>
  );

  if (!useMultiplePages) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader} fixed>
            <Text style={styles.documentTitle}>Prescriptions</Text>
            <Text style={styles.documentSubtitle}>
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          {prescriptions.map((record, recordIdx) => renderRecord(record, recordIdx))}
          <Text style={styles.footer} fixed>PROTECTED HEALTH INFORMATION (PHI) - Handle according to HIPAA regulations</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {prescriptions.map((record, recordIdx) => (
        <Page key={recordIdx} size="LETTER" style={styles.page}>
          <View style={styles.documentHeader} fixed>
            <Text style={styles.documentTitle}>Prescription</Text>
            <Text style={styles.documentSubtitle}>
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          {renderRecord(record, recordIdx)}
          <Text style={styles.footer} fixed>PROTECTED HEALTH INFORMATION (PHI) - Handle according to HIPAA regulations</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </Page>
      ))}
    </Document>
  );
};

export default PrescriptionsPDFTemplate;
