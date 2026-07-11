/**
 * PreDialysisAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — pre-dialysis assessment
 * Collection: pre_dialysis_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
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

const FIELD_UNITS = {
  estimatedGFR: ' mL/min',
  serumCreatinine: ' mg/dL',
  bloodUreaNitrogen: ' mg/dL',
  creatinineClearance: ' mL/min',
  proteinuria: ' mg/dL',
  albuminuria: ' mg/dL',
  hemoglobin: ' g/dL',
  hematocrit: '%',
  serumPhosphorus: ' mg/dL',
  serumCalcium: ' mg/dL',
  parathyroidHormone: ' pg/mL',
  vitaminD25OH: ' ng/mL',
  serum25OHD3: ' ng/mL',
  alkalinePhosphatase: ' U/L',
  serumBicarbonate: ' mEq/L',
  echocardiogramEF: '%',
};

const formatDisplayValuePDF = (fn, val) => {
  if (fn === 'ckdStage') return `Stage ${val}`;
  const unit = FIELD_UNITS[fn];
  if (unit) return `${fmtVal(val)}${unit}`;
  return fmtVal(val);
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, fieldKey) => {
  if (!hasVal(value)) return null;
  const displayVal = fieldKey ? formatDisplayValuePDF(fieldKey, value) : safeString(fmtVal(value));
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{displayVal}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
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
    title: 'Provider Details',
    fields: [
      { key: 'createdAt', label: 'Date', isDate: true },
    ],
  },
  {
    title: 'Kidney Function',
    fields: [
      { key: 'estimatedGFR', label: 'Estimated GFR' },
      { key: 'ckdStage', label: 'CKD Stage' },
      { key: 'serumCreatinine', label: 'Serum Creatinine' },
      { key: 'bloodUreaNitrogen', label: 'Blood Urea Nitrogen' },
      { key: 'creatinineClearance', label: 'Creatinine Clearance' },
      { key: 'proteinuria', label: 'Proteinuria' },
      { key: 'albuminuria', label: 'Albuminuria' },
    ],
  },
  {
    title: 'Hematology',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin' },
      { key: 'hematocrit', label: 'Hematocrit' },
    ],
  },
  {
    title: 'Bone & Mineral Metabolism',
    fields: [
      { key: 'serumPhosphorus', label: 'Serum Phosphorus' },
      { key: 'serumCalcium', label: 'Serum Calcium' },
      { key: 'parathyroidHormone', label: 'Parathyroid Hormone' },
      { key: 'vitaminD25OH', label: 'Vitamin D 25-OH' },
      { key: 'serum25OHD3', label: 'Serum 25-OH-D3' },
      { key: 'alkalinePhosphatase', label: 'Alkaline Phosphatase' },
    ],
  },
  {
    title: 'Acid-Base Status',
    fields: [
      { key: 'acidosis', label: 'Acidosis' },
      { key: 'serumBicarbonate', label: 'Serum Bicarbonate' },
    ],
  },
  {
    title: 'Vascular Access',
    fields: [
      { key: 'vascularAccessType', label: 'Vascular Access Type' },
      { key: 'vascularAccessMaturation', label: 'Vascular Access Maturation' },
    ],
  },
  {
    title: 'Cardiovascular',
    fields: [
      { key: 'fluidOverload', label: 'Fluid Overload' },
      { key: 'nyhaClass', label: 'NYHA Class' },
      { key: 'echocardiogramEF', label: 'Echocardiogram EF' },
    ],
  },
  {
    title: 'Infectious Disease Screening',
    fields: [
      { key: 'hepatitisBsAg', label: 'Hepatitis B sAg' },
      { key: 'hepatitisCantibody', label: 'Hepatitis C Antibody' },
      { key: 'hivStatus', label: 'HIV Status' },
    ],
  },
];

/* ======= COMPONENT ======= */
const PreDialysisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pre_dialysis_assessment) return Array.isArray(r.pre_dialysis_assessment) ? r.pre_dialysis_assessment : [r.pre_dialysis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pre_dialysis_assessment) return Array.isArray(dd.pre_dialysis_assessment) ? dd.pre_dialysis_assessment : [dd.pre_dialysis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pre-Dialysis Assessment</Text>
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
          <Text style={styles.documentTitle}>Pre-Dialysis Assessment</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.createdAt && (
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                Pre-Dialysis Assessment Record {index + 1}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val, field.key)}</View>;
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

export default PreDialysisAssessmentDocumentPDFTemplate;
