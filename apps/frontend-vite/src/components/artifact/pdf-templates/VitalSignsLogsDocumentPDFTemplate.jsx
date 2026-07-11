/**
 * VitalSignsLogsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — vital signs logs
 * Collection: vital_signs_logs
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#333333', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2, textTransform: 'uppercase' },
  fieldValue: { fontSize: 11, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 11, color: '#000000', lineHeight: 1.4, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, showLabel = true) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Provider Information',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'date', label: 'Date', isDate: true },
    ],
  },
  {
    title: 'Blood Pressure',
    fields: [
      { key: 'systolicBloodPressure', label: 'Systolic Blood Pressure' },
      { key: 'diastolicBloodPressure', label: 'Diastolic Blood Pressure' },
      { key: 'meanArterialPressure', label: 'Mean Arterial Pressure' },
      { key: 'bloodPressureCuffSize', label: 'Blood Pressure Cuff Size', isSentence: true },
      { key: 'patientPosition', label: 'Patient Position', isSentence: true },
    ],
  },
  {
    title: 'Cardiac',
    fields: [
      { key: 'heartRate', label: 'Heart Rate' },
      { key: 'pulseCharacter', label: 'Pulse Character', isSentence: true },
    ],
  },
  {
    title: 'Respiratory',
    fields: [
      { key: 'respiratoryRate', label: 'Respiratory Rate' },
      { key: 'respiratoryEffort', label: 'Respiratory Effort', isSentence: true },
      { key: 'oxygenSaturation', label: 'Oxygen Saturation' },
      { key: 'supplementalOxygenFlow', label: 'Supplemental Oxygen Flow' },
      { key: 'oxygenDeliveryMethod', label: 'Oxygen Delivery Method', isSentence: true },
    ],
  },
  {
    title: 'Temperature',
    fields: [
      { key: 'temperatureCelsius', label: 'Temperature (Celsius)' },
      { key: 'temperatureFahrenheit', label: 'Temperature (Fahrenheit)' },
      { key: 'temperatureSite', label: 'Temperature Site', isSentence: true },
    ],
  },
  {
    title: 'Pain & Glucose',
    fields: [
      { key: 'painScore', label: 'Pain Score' },
      { key: 'bloodGlucose', label: 'Blood Glucose' },
    ],
  },
  {
    title: 'Anthropometrics',
    fields: [
      { key: 'weightKilograms', label: 'Weight (kg)' },
      { key: 'heightCentimeters', label: 'Height (cm)' },
      { key: 'bodyMassIndex', label: 'Body Mass Index' },
      { key: 'measurementMethod', label: 'Measurement Method', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const VitalSignsLogsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.vital_signs_logs) return Array.isArray(r.vital_signs_logs) ? r.vital_signs_logs : [r.vital_signs_logs];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vital_signs_logs) return Array.isArray(dd.vital_signs_logs) ? dd.vital_signs_logs : [dd.vital_signs_logs]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Vital Signs Logs</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Vital Signs Logs</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Vital Signs Log ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const activeFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (activeFields.length === 0) return null;

              /* Count total items for wrap/break decisions */
              let totalItems = activeFields.length;
              activeFields.forEach(f => {
                const v = record[f.key];
                if (Array.isArray(v)) totalItems += v.length;
                else if (typeof v === 'string') {
                  const s = splitBySentence(v);
                  if (s.length > 1) totalItems += s.length;
                }
              });

              const wrapProp = totalItems > 8 ? undefined : false;
              const breakProp = totalItems >= 15 ? true : undefined;

              return (
                <View key={sIdx} style={styles.section} wrap={wrapProp} break={breakProp}>
                  <View style={styles.fieldBox}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  </View>
                  {activeFields.map((field, fIdx) => {
                    const val = record[field.key];
                    const showFieldLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val, showFieldLabel)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val, showFieldLabel)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default VitalSignsLogsDocumentPDFTemplate;
