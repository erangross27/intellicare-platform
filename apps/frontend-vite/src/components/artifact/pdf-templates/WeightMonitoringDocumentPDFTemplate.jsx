/**
 * WeightMonitoringDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — weight monitoring
 * Collection: weight_monitoring
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  sectionLead: { marginBottom: 0 },
  sectionSpacer: { height: 8 },
  fieldBox: { marginBottom: 10, padding: 8, borderWidth: 0.5, borderColor: '#cccccc', borderStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
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

/* Numeric fields where 0 is a "not recorded" sentinel and must be hidden; weightChangeKg 0 (weight stable) is meaningful and always shown. Negatives (weight loss) always show. */
const NUMBER_KEYS = ['currentWeight', 'previousWeight', 'weightChangeKg', 'bodyMassIndex', 'idealBodyWeight', 'dailyFluidIntake', 'urineOutput24hr', 'sodiumRestriction', 'fluidRestriction', 'abdominalGirth', 'weightLossGoal', 'serumSodium', 'serumCreatinine', 'bntProBnp'];
const MEANINGFUL_ZERO_KEYS = ['weightChangeKg'];
const fieldShows = (key, val) => {
  if (NUMBER_KEYS.includes(key)) {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (Number.isNaN(num)) return false;
    if (num === 0) return MEANINGFUL_ZERO_KEYS.includes(key);
    return true;
  }
  return hasVal(val);
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s+|(?<!\d)\.(?:\s+|$)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const COMMA_ARRAY_FIELDS = new Set(['nutritionalStatus', 'weightVariabilityPattern']);

const splitFieldValue = (field, text) => {
  const clauses = splitBySentence(String(text || ''));
  if (!COMMA_ARRAY_FIELDS.has(field)) return clauses;
  return clauses.flatMap(clause => splitByComma(clause)).map(item => item.trim()).filter(Boolean);
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
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split */
const renderSentenceField = (field, label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitFieldValue(field, fmtVal(text));
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

  return (
    <View style={styles.fieldBox} wrap={false}>
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

/* renderArrayField */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'createdAt', label: 'Date', isDate: true },
    ],
  },
  {
    title: 'Weight Metrics',
    fields: [
      { key: 'currentWeight', label: 'Current Weight (kg)' },
      { key: 'previousWeight', label: 'Previous Weight (kg)' },
      { key: 'weightChangeKg', label: 'Weight Change (kg)' },
      { key: 'bodyMassIndex', label: 'Body Mass Index' },
      { key: 'idealBodyWeight', label: 'Ideal Body Weight (kg)' },
      { key: 'weightLossGoal', label: 'Weight Loss Goal (kg)' },
    ],
  },
  {
    title: 'Fluid Status',
    fields: [
      { key: 'fluidRetention', label: 'Fluid Retention' },
      { key: 'dailyFluidIntake', label: 'Daily Fluid Intake (mL)' },
      { key: 'urineOutput24hr', label: 'Urine Output 24hr (mL)' },
      { key: 'peripheralEdema', label: 'Peripheral Edema', isSentence: true },
      { key: 'abdominalGirth', label: 'Abdominal Girth (cm)' },
      { key: 'jugularVenousDistention', label: 'Jugular Venous Distention' },
    ],
  },
  {
    title: 'Dietary Restrictions',
    fields: [
      { key: 'sodiumRestriction', label: 'Sodium Restriction (mg)' },
      { key: 'fluidRestriction', label: 'Fluid Restriction (mL)' },
      { key: 'nutritionalStatus', label: 'Nutritional Status', isSentence: true },
    ],
  },
  {
    title: 'Medications & Compliance',
    fields: [
      { key: 'diureticMedications', label: 'Diuretic Medications', isArray: true },
      { key: 'medicationCompliance', label: 'Medication Compliance', isSentence: true },
    ],
  },
  {
    title: 'Cardiac Markers',
    fields: [
      { key: 'nyhaClassification', label: 'NYHA Classification', isSentence: true },
      { key: 'serumSodium', label: 'Serum Sodium (mEq/L)' },
      { key: 'serumCreatinine', label: 'Serum Creatinine (mg/dL)' },
      { key: 'bntProBnp', label: 'BNT Pro-BNP (pg/mL)' },
    ],
  },
  {
    title: 'Monitoring',
    fields: [
      { key: 'weightMonitoringFrequency', label: 'Weight Monitoring Frequency', isSentence: true },
      { key: 'weightVariabilityPattern', label: 'Weight Variability Pattern', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const WeightMonitoringDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => {
    const data = documentProp ?? dataProp ?? templateData;
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.records)) return r.records;
      if (Array.isArray(r?._records)) return r._records;
      if (r?.weight_monitoring) return Array.isArray(r.weight_monitoring) ? r.weight_monitoring : [r.weight_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.weight_monitoring) return Array.isArray(dd.weight_monitoring) ? dd.weight_monitoring : [dd.weight_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [documentProp, dataProp, templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Weight Monitoring</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {records.map((record, index) => (
        <Page key={index} size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Weight Monitoring</Text>
          </View>
          <View style={styles.recordHeader} wrap={false}>
            <Text style={styles.recordTitle}>{`Weight Monitoring ${index + 1}`}</Text>
          </View>
          {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
            const presentFields = sectionConfig.fields.filter(field => fieldShows(field.key, record[field.key]));
            if (!presentFields.length) return null;
            const renderField = (field, fieldIndex) => {
              const value = record[field.key];
              if (field.isDate) return <View key={`${field.key}-${fieldIndex}`} style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{field.label}</Text><Text style={styles.fieldValue}>1. {formatDate(value)}</Text></View>;
              if (field.isArray) return <View key={`${field.key}-${fieldIndex}`}>{renderArrayFieldPDF(field.label, value)}</View>;
              if (field.isSentence) return <View key={`${field.key}-${fieldIndex}`}>{renderSentenceField(field.key, field.label, value)}</View>;
              return <View key={`${field.key}-${fieldIndex}`}>{renderFieldRow(field.label, value)}</View>;
            };
            return (
              <React.Fragment key={sIdx}>
                <View style={styles.sectionLead} wrap={false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {renderField(presentFields[0], 0)}
                </View>
                {presentFields.slice(1).map((field, fieldIndex) => renderField(field, fieldIndex + 1))}
                <View style={styles.sectionSpacer} />
              </React.Fragment>
            );
          })}
        </Page>
      ))}
    </Document>
  );
};

export default WeightMonitoringDocumentPDFTemplate;
