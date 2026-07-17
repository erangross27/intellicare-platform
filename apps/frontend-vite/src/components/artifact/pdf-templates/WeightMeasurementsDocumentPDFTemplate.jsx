/**
 * WeightMeasurementsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — weight measurements
 * Collection: weight_measurements
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  sectionLead: { marginBottom: 0 },
  sectionSpacer: { height: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10, padding: 8, borderWidth: 0.5, borderColor: '#cccccc', borderStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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
  return text.split(/;\s+|(?<!\d)\.(?:\s+|$)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const COMMA_ARRAY_FIELDS = new Set(['bodyCompositionMethod', 'nutritionalStatus']);

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

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>1. {formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (field, label, text) => {
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
    <View style={styles.fieldBox}>
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

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Weight Basics',
    fields: [
      { key: 'bodyWeightKg', label: 'Body Weight (kg)' },
      { key: 'bodyWeightLbs', label: 'Body Weight (lbs)' },
      { key: 'heightCm', label: 'Height (cm)' },
      { key: 'bodyMassIndex', label: 'Body Mass Index' },
      { key: 'bmiClassification', label: 'BMI Classification', isSentence: true },
    ],
  },
  {
    title: 'Body Composition',
    fields: [
      { key: 'waistCircumferenceCm', label: 'Waist Circumference (cm)' },
      { key: 'hipCircumferenceCm', label: 'Hip Circumference (cm)' },
      { key: 'waistHipRatio', label: 'Waist-Hip Ratio' },
      { key: 'bodyFatPercentage', label: 'Body Fat Percentage' },
      { key: 'leanBodyMassKg', label: 'Lean Body Mass (kg)' },
      { key: 'skeletalMuscleMassKg', label: 'Skeletal Muscle Mass (kg)' },
      { key: 'visceralFatLevel', label: 'Visceral Fat Level' },
      { key: 'bodyCompositionMethod', label: 'Body Composition Method', isSentence: true },
    ],
  },
  {
    title: 'Weight Targets & Changes',
    fields: [
      { key: 'idealBodyWeightKg', label: 'Ideal Body Weight (kg)' },
      { key: 'adjustedBodyWeightKg', label: 'Adjusted Body Weight (kg)' },
      { key: 'weightChangeKg', label: 'Weight Change (kg)' },
      { key: 'percentWeightChange', label: 'Percent Weight Change' },
    ],
  },
  {
    title: 'Nutrition & Status',
    fields: [
      { key: 'nutritionalStatus', label: 'Nutritional Status', isSentence: true },
      { key: 'fluidRetentionStatus', label: 'Fluid Retention Status', isSentence: true },
      { key: 'fastingStatus', label: 'Fasting Status', isSentence: true },
      { key: 'clothingWeight', label: 'Clothing Weight' },
    ],
  },
  {
    title: 'Malnutrition Screening',
    fields: [
      { key: 'malnutritionScreeningTool', label: 'Malnutrition Screening Tool', isSentence: true },
      { key: 'malnutritionScore', label: 'Malnutrition Score' },
      { key: 'sarcopeniaRisk', label: 'Sarcopenia Risk', isSentence: true },
    ],
  },
  {
    title: 'Record Info',
    fields: [
      { key: 'createdAt', label: 'Created At', isDate: true },
      { key: 'updatedAt', label: 'Updated At', isDate: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const WeightMeasurementsDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => {
    const data = documentProp ?? dataProp ?? templateData;
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.records)) return r.records;
      if (Array.isArray(r?._records)) return r._records;
      if (r?.weight_measurements) return Array.isArray(r.weight_measurements) ? r.weight_measurements : [r.weight_measurements];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.weight_measurements) return Array.isArray(dd.weight_measurements) ? dd.weight_measurements : [dd.weight_measurements]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [documentProp, dataProp, templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Weight Measurements</Text>
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
            <Text style={styles.documentTitle}>Weight Measurements</Text>
          </View>
          <View style={styles.recordHeader} wrap={false}>
            <Text style={styles.recordTitle}>{`Weight Measurement ${index + 1}`}</Text>
          </View>
          {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
            const visibleFields = sectionConfig.fields.filter(field => hasVal(record[field.key]));
            if (!visibleFields.length) return null;
            const renderField = (field, fieldIndex) => {
              const value = record[field.key];
              if (field.isDate) return <View key={`${field.key}-${fieldIndex}`}>{renderDateFieldPDF(field.label, value)}</View>;
              if (field.isSentence) return <View key={`${field.key}-${fieldIndex}`}>{renderSentenceSection(field.key, field.label, value)}</View>;
              return <View key={`${field.key}-${fieldIndex}`}>{renderFieldRow(field.label, value)}</View>;
            };
            return (
              <React.Fragment key={sIdx}>
                <View style={styles.sectionLead} wrap={false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {renderField(visibleFields[0], 0)}
                </View>
                {visibleFields.slice(1).map((field, fieldIndex) => renderField(field, fieldIndex + 1))}
                <View style={styles.sectionSpacer} />
              </React.Fragment>
            );
          })}
        </Page>
      ))}
    </Document>
  );
};

export default WeightMeasurementsDocumentPDFTemplate;
