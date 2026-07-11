/**
 * PneumoperitoneumDocumentPDFTemplate.jsx
 * PDF export template for pneumoperitoneum collection.
 * Box-free black & white: hierarchy shown via underlines only (documentTitle / sectionTitle / bare fieldLabel).
 * Field labels are BARE (no colon) so they render as exact `>Label<` text nodes for JSX/PDF field parity.
 * Anti-orphan: every sectionTitle is glued to its first body element inside a <View wrap={false}>.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 20,
    textTransform: 'none',
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 8,
    textTransform: 'none',
  },
  fieldBox: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
    marginBottom: 3,
    textTransform: 'none',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  noData: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const FIELD_LABELS = {
  procedureName: 'Procedure Name',
  date: 'Date',
  facility: 'Facility',
  accessMethod: 'Access Method',
  accessLocation: 'Access Location',
  initialPressure: 'Initial Pressure',
  targetPressure: 'Target Pressure',
  maximumPressure: 'Maximum Pressure',
  gasType: 'Gas Type',
  totalGasVolume: 'Total Gas Volume',
  flowRate: 'Flow Rate',
  insufflationTime: 'Insufflation Time',
  insufflationEquipment: 'Insufflation Equipment',
  desufflationMethod: 'Desufflation Method',
  visualInspection: 'Visual Inspection',
  adhesions: 'Adhesions',
  complications: 'Complications',
  verificationTests: 'Verification Tests',
  specialConsiderations: 'Special Considerations',
  notes: 'Notes',
};

const SECTIONS = [
  { title: 'Procedure Information', fields: ['procedureName', 'date', 'facility'] },
  { title: 'Access Details', fields: ['accessMethod', 'accessLocation'] },
  { title: 'Pressure Settings', fields: ['initialPressure', 'targetPressure', 'maximumPressure'] },
  { title: 'Gas Settings', fields: ['gasType', 'totalGasVolume', 'flowRate', 'insufflationTime'] },
  { title: 'Equipment', fields: ['insufflationEquipment', 'desufflationMethod'] },
  { title: 'Findings', fields: ['visualInspection', 'adhesions', 'complications'] },
  { title: 'Verification Tests', fields: ['verificationTests'] },
  { title: 'Additional Information', fields: ['specialConsiderations', 'notes'] },
];

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['complications', 'verificationTests'];

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const fieldBody = (fn, value, keyPrefix) => {
  const label = FIELD_LABELS[fn] || fn;
  if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(value) ? value : [value]).filter((x) => x !== null && x !== undefined && String(x).trim() !== '');
    return (
      <View key={keyPrefix} style={styles.fieldBox} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {String(item)}</Text>
        ))}
      </View>
    );
  }
  const display = DATE_FIELDS.includes(fn) ? formatDate(value) : String(value);
  return (
    <View key={keyPrefix} style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

/* Section — glues the title to its first body element so a title never orphans at a page break. */
const Section = ({ title, children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PneumoperitoneumDocumentPDFTemplate = ({ document: records }) => {
  let recordsArray = [];
  if (Array.isArray(records)) {
    recordsArray = records;
  } else if (records?.pneumoperitoneum && Array.isArray(records.pneumoperitoneum)) {
    recordsArray = records.pneumoperitoneum;
  } else if (records?.documentData) {
    const docData = records.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.pneumoperitoneum && Array.isArray(docData.pneumoperitoneum)) {
      recordsArray = docData.pneumoperitoneum;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (records && typeof records === 'object' && !Array.isArray(records)) {
    recordsArray = [records];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pneumoperitoneum</Text>
          <Text style={styles.noData}>No pneumoperitoneum data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pneumoperitoneum</Text>
        {recordsArray.map((record, idx) => {
          const p = `r${idx}`;
          return (
            <View key={idx} style={styles.recordContainer}>
              {idx > 0 && <View style={styles.separator} />}
              <Text style={styles.recordTitle}>{record.procedureName || `Pneumoperitoneum ${idx + 1}`}</Text>
              {SECTIONS.map((sec) => (
                <Section key={sec.title} title={sec.title}>
                  {sec.fields
                    .filter((fn) => hasVal(record[fn]))
                    .map((fn) => fieldBody(fn, record[fn], `${p}-${fn}`))}
                </Section>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PneumoperitoneumDocumentPDFTemplate;
