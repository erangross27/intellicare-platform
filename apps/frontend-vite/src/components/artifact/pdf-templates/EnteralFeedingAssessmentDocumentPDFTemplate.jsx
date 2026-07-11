/**
 * EnteralFeedingAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — enteral feeding assessment
 * Collection: enteral_feeding_assessment
 * NO BLUE COLORS — uses #000000, #333333, #cccccc, #f5f5f5 only
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
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

/* Mirror of the JSX HIDE_ZERO_FIELDS (4-AREA RULE): 0 = "not assessed / not applicable" for these fields, so a
   stored 0 is hidden in the PDF exactly as in the JSX/Copy. Real non-zero values always render. */
const HIDE_ZERO_FIELDS = ['tubeExternalLength', 'gastricResidualVolume', 'aspirationRiskScore', 'nutricScore', 'nrsScore', 'stoolFrequency'];
const hasFieldVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return hasVal(v); };

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
      const commaItems = splitByComma(s);
      if (commaItems.length >= 3) {
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    }
  });

  const wrapProp = rows.length > 8;

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

/* renderArrayField */
const renderArrayFieldPDF = (label, items, showLabel = true) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Assessment Information',
    fields: [
      { key: 'assessmentDate', label: 'Assessment Date', isDate: true },
    ],
  },
  {
    title: 'Tube Details',
    fields: [
      { key: 'feedingRouteType', label: 'Feeding Route Type', isSentence: true },
      { key: 'tubeSize', label: 'Tube Size', isSentence: true },
      { key: 'tubePlacementDate', label: 'Tube Placement Date', isDate: true },
      { key: 'tubeExternalLength', label: 'Tube External Length' },
      { key: 'stomaSiteCondition', label: 'Stoma Site Condition', isSentence: true },
    ],
  },
  {
    title: 'Formula & Delivery',
    fields: [
      { key: 'formulaType', label: 'Formula Type', isSentence: true },
      { key: 'formulaCaloriesDensity', label: 'Formula Calories Density' },
      { key: 'feedingRate', label: 'Feeding Rate' },
      { key: 'feedingSchedule', label: 'Feeding Schedule', isSentence: true },
    ],
  },
  {
    title: 'Nutritional Goals',
    fields: [
      { key: 'targetCaloricGoal', label: 'Target Caloric Goal' },
      { key: 'currentCaloricIntake', label: 'Current Caloric Intake' },
      { key: 'targetProteinGoal', label: 'Target Protein Goal' },
    ],
  },
  {
    title: 'Safety Parameters',
    fields: [
      { key: 'headOfBedElevation', label: 'Head of Bed Elevation' },
      { key: 'gastricResidualVolume', label: 'Gastric Residual Volume' },
      { key: 'aspirationRiskScore', label: 'Aspiration Risk Score' },
    ],
  },
  {
    title: 'Nutritional Screening Scores',
    fields: [
      { key: 'nutricScore', label: 'NUTRIC Score' },
      { key: 'nrsScore', label: 'NRS Score' },
      { key: 'prealbumin', label: 'Prealbumin' },
    ],
  },
  {
    title: 'Feeding Tolerance',
    fields: [
      { key: 'feedingIntolerance', label: 'Feeding Intolerance', isBoolean: true },
      { key: 'feedingIntoleranceSymptoms', label: 'Feeding Intolerance Symptoms', isArray: true },
      { key: 'abdomenAssessment', label: 'Abdomen Assessment', isSentence: true },
      { key: 'stoolFrequency', label: 'Stool Frequency' },
      { key: 'stoolConsistency', label: 'Stool Consistency', isSentence: true },
      { key: 'refeedingSyndromeRisk', label: 'Refeeding Syndrome Risk', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const EnteralFeedingAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.enteral_feeding_assessment) return Array.isArray(r.enteral_feeding_assessment) ? r.enteral_feeding_assessment : [r.enteral_feeding_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.enteral_feeding_assessment) return Array.isArray(dd.enteral_feeding_assessment) ? dd.enteral_feeding_assessment : [dd.enteral_feeding_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Enteral Feeding Assessment</Text>
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
          <Text style={styles.documentTitle}>Enteral Feeding Assessment</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Enteral Feeding Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasFieldVal(f.key, record[f.key]));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <View style={styles.fieldBox} wrap={presentFields.length > 8}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {presentFields.map((field, fIdx) => {
                      const val = record[field.key];
                      const showFieldLabel = field.label.toLowerCase() !== (sectionConfig.title || '').toLowerCase();

                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val, showFieldLabel)}</View>;
                      if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val, showFieldLabel)}</View>;
                      if (field.isBoolean) return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val, showFieldLabel)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EnteralFeedingAssessmentDocumentPDFTemplate;
