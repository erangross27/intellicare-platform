/**
 * PrnMedicationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — PRN medications
 * Collection: prn_medications
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordStatus: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* ======= COMPONENT ======= */
const PrnMedicationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) records = data[0].records;
    else records = data;
  } else if (data?.records) {
    records = data.records;
  } else if (data) {
    records = [data];
  }

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>PRN Medications</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderField = (label, value) => {
    if (!hasVal(value)) return null;
    return (
      <View style={styles.fieldBox} key={label}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{fmtVal(value)}</Text>
      </View>
    );
  };

  const renderDateField = (label, value) => {
    if (!hasVal(value)) return null;
    return (
      <View style={styles.fieldBox} key={label}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(value)}</Text>
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
      <View style={styles.fieldBox} key={label}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => {
          const itemStr = String(item || '').trim();
          if (!itemStr) return null;
          return <Text key={i} style={styles.listItem}>{i + 1}. {itemStr}</Text>;
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>PRN Medications</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.startDate) && <Text style={styles.recordDate}>{formatDate(record.startDate)}</Text>}
                {record.active !== undefined && <Text style={styles.recordStatus}>{record.active ? 'Active' : 'Inactive'}</Text>}
              </View>
              <Text style={styles.recordTitle}>{String(record.name || `PRN Medication ${idx + 1}`)}</Text>
            </View>

            {/* Section 1: Medication Information */}
            {(hasVal(record.name) || hasVal(record.genericName) || hasVal(record.dosage) || hasVal(record.frequency) || hasVal(record.route)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Medication Information</Text>
                {renderField('Name', record.name)}
                {renderField('Generic Name', record.genericName)}
                {renderField('Dosage', record.dosage)}
                {renderField('Frequency', record.frequency)}
                {renderField('Route', record.route)}
              </View>
            )}

            {/* Section 2: Prescriber Details */}
            {(hasVal(record.prescriber) || hasVal(record.indication) || hasVal(record.instructions)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prescriber Details</Text>
                {renderField('Prescriber', record.prescriber)}
                {renderField('Indication', record.indication)}
                {renderField('Instructions', record.instructions)}
              </View>
            )}

            {/* Section 3: Duration */}
            {(hasVal(record.startDate) || hasVal(record.endDate) || hasVal(record.duration) || hasVal(record.durationDays) || hasVal(record.durationUnit) || hasVal(record.active) || hasVal(record.refills)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Duration</Text>
                {renderDateField('Start Date', record.startDate)}
                {renderDateField('End Date', record.endDate)}
                {renderField('Duration', record.duration)}
                {renderField('Duration (Days)', record.durationDays)}
                {renderField('Duration Unit', record.durationUnit)}
                {renderField('Active', record.active)}
                {renderField('Refills', record.refills)}
              </View>
            )}

            {/* Section 4: Safety */}
            {(hasVal(record.safetyWarning) || (record.sideEffects && record.sideEffects.length > 0) || (record.drugInteractions && record.drugInteractions.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Safety</Text>
                {renderField('Safety Warning', record.safetyWarning)}
                {renderArrayField('Side Effects', record.sideEffects)}
                {renderArrayField('Drug Interactions', record.drugInteractions)}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrnMedicationsDocumentPDFTemplate;
