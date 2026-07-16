/**
 * VitalSignsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — vital signs
 * Collection: vital_signs
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10 },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
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
  return text.split(/;\s+|(?<!\d)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const humanizeKey = (key) =>
  String(key).replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim();

/* flattenObject: dynamic-key object → flat [{label,value}] rows (recursive, array-aware) */
const flattenObject = (obj, prefix = '') => {
  const result = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result;
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = humanizeKey(key);
    if (Array.isArray(val)) {
      val.forEach((item) => {
        if (item === null || item === undefined || item === '') return;
        if (typeof item === 'object') {
          const inner = flattenObject(item).map(e => `${e.label}: ${e.value}`).join('; ');
          if (inner) result.push({ path, label, value: inner });
        } else {
          result.push({ path, label, value: String(item) });
        }
      });
    } else if (val && typeof val === 'object') {
      result.push(...flattenObject(val, path));
    } else if (val !== null && val !== undefined && val !== '') {
      result.push({ path, label, value: String(val) });
    }
  }
  return result;
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
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, sectionTitle) => {
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
      splitByComma(s).forEach(item => rows.push({ type: 'item', text: safeString(item), num: n++ }));
    }
  });

  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderObjectSection: dynamic-key object → label + nested subtitle/value rows */
const renderObjectSection = (label, value, sectionTitle) => {
  if (!hasVal(value) || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = flattenObject(value);
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map((entry, i) => (
        <View key={i}>
          <Text style={styles.nestedSubtitle}>{safeString(entry.label)}</Text>
          <Text style={styles.fieldValue}>{safeString(entry.value)}</Text>
        </View>
      ))}
    </View>
  );
};

/* renderSection: thread the section title INTO the first present field (no standalone
   sibling -> can't orphan from its content) */
const renderSection = (title, renderers) => {
  const out = [];
  let titleUsed = false;
  for (let i = 0; i < renderers.length; i++) {
    const node = renderers[i](titleUsed ? undefined : title);
    if (node) { out.push(React.cloneElement(node, { key: i })); titleUsed = true; }
  }
  return titleUsed ? out : null;
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Core Vitals',
    fields: [
      { key: 'bloodPressure', label: 'Blood Pressure', isSentence: true },
      { key: 'heartRate', label: 'Heart Rate', isSentence: true },
      { key: 'temperature', label: 'Temperature', isSentence: true },
      { key: 'respiratoryRate', label: 'Respiratory Rate' },
      { key: 'oxygenSaturation', label: 'Oxygen Saturation' },
      { key: 'position', label: 'Position' },
    ],
  },
  {
    title: 'Measurements',
    fields: [
      { key: 'weight', label: 'Weight' },
      { key: 'height', label: 'Height' },
      { key: 'bmi', label: 'BMI' },
      { key: 'headCircumference', label: 'Head Circumference' },
    ],
  },
  {
    title: 'Assessments',
    fields: [
      { key: 'painScore', label: 'Pain Score' },
      { key: 'bloodGlucose', label: 'Blood Glucose' },
      { key: 'peakFlow', label: 'Peak Flow' },
    ],
  },
  {
    title: 'Reference Data',
    fields: [
      { key: 'normalRanges', label: 'Normal Ranges', isObject: true },
      { key: 'previousVisit', label: 'Previous Visit', isObject: true },
      { key: 'date', label: 'Date', isDate: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const VitalSignsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const source = documentProp ?? data ?? templateData;
  const records = React.useMemo(() => {
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (r?.vital_signs) return Array.isArray(r.vital_signs) ? r.vital_signs : [r.vital_signs];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vital_signs) return Array.isArray(dd.vital_signs) ? dd.vital_signs : [dd.vital_signs]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [source]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Vital Signs</Text>
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
          <Text style={styles.documentTitle}>Vital Signs</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false} minPresenceAhead={150}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Vital Signs ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {renderSection(sectionConfig.title, sectionConfig.fields.map(field => (t) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;
                    if (field.isDate) return renderDateFieldPDF(field.label, val, t);
                    if (field.isObject) return renderObjectSection(field.label, val, t);
                    if (field.isSentence) return renderSentenceSection(field.label, val, t);
                    return renderFieldRow(field.label, val, t);
                  }))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default VitalSignsDocumentPDFTemplate;
