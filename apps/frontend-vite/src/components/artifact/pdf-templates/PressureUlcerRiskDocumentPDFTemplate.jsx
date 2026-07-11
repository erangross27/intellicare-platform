/**
 * PressureUlcerRiskDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — pressure ulcer risk
 * Collection: pressure_ulcer_risk
 * BLACK & WHITE ONLY — #000000/#333333/#cccccc ONLY (NO blue colors)
 * BOX-FREE — NO backgroundColor/border on field/section boxes (recordHeader = black underline only)
 * Rule #74: sectionTitle rendered INSIDE each section's single wrap-gated View as first child.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
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

/* renderFieldRow: simple value (number / date) */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
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

  /* single-name-skip: lone item with no label → render plain value, no numbered list */
  if (rows.length === 1 && rows[0].type === 'item') {
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{rows[0].text}</Text>
      </View>
    );
  }

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

/* renderArrayField */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
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
    title: 'Assessment Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'riskCategory', label: 'Risk Category', isSentence: true },
      { key: 'repositioningFrequency', label: 'Repositioning Frequency', isSentence: true },
      { key: 'pressureRedistributionSurface', label: 'Pressure Redistribution Surface', isSentence: true },
      { key: 'nextAssessmentDue', label: 'Next Assessment Due', isSentence: true },
    ],
  },
  {
    title: 'Braden Scale',
    fields: [
      { key: 'bradenScore', label: 'Braden Score', isNumber: true },
      { key: 'sensoryPerception', label: 'Sensory Perception', isNumber: true },
      { key: 'skinMoisture', label: 'Skin Moisture', isNumber: true },
      { key: 'activity', label: 'Activity', isNumber: true },
      { key: 'mobilityLevel', label: 'Mobility', isNumber: true },
      { key: 'nutrition', label: 'Nutrition', isNumber: true },
      { key: 'frictionAndShear', label: 'Friction & Shear', isNumber: true },
    ],
  },
  {
    title: 'Ulcer Status',
    fields: [
      { key: 'existingPressureUlcers', label: 'Existing Pressure Ulcers', isBoolean: true },
      { key: 'ulcerLocations', label: 'Ulcer Locations', isArray: true },
      { key: 'ulcerStages', label: 'Ulcer Stages', isArray: true },
    ],
  },
  {
    title: 'Risk Factors',
    fields: [
      { key: 'bodyMassIndex', label: 'Body Mass Index', isNumber: true },
      { key: 'albuminLevel', label: 'Albumin Level', isNumber: true },
      { key: 'hemoglobinLevel', label: 'Hemoglobin Level', isNumber: true },
      { key: 'incontinenceBladder', label: 'Incontinence (Bladder)', isSentence: true },
      { key: 'incontinenceBowel', label: 'Incontinence (Bowel)', isSentence: true },
      { key: 'skinTemperature', label: 'Skin Temperature', isSentence: true },
      { key: 'diabetesMellitus', label: 'Diabetes Mellitus', isBoolean: true },
      { key: 'vascularDisease', label: 'Vascular Disease', isBoolean: true },
      { key: 'mechanicalVentilation', label: 'Mechanical Ventilation', isBoolean: true },
      { key: 'vasopressorUse', label: 'Vasopressor Use', isBoolean: true },
      { key: 'edemaPresent', label: 'Edema Present', isBoolean: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean + date */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.isDate) return <View key={key}>{renderFieldRow(field.label, formatDate(val))}</View>;
  if (field.isNumber) return <View key={key}>{renderFieldRow(field.label, fmtVal(val))}</View>;
  if (field.isBoolean) return <View key={key}>{renderFieldRow(field.label, val ? 'Yes' : 'No')}</View>;
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val)}</View>;
  return <View key={key}>{renderFieldRow(field.label, fmtVal(val))}</View>;
};

/* ======= COMPONENT ======= */
const PressureUlcerRiskDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pressure_ulcer_risk) return Array.isArray(r.pressure_ulcer_risk) ? r.pressure_ulcer_risk : [r.pressure_ulcer_risk];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pressure_ulcer_risk) return Array.isArray(dd.pressure_ulcer_risk) ? dd.pressure_ulcer_risk : [dd.pressure_ulcer_risk]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pressure Ulcer Risk</Text>
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
          <Text style={styles.documentTitle}>Pressure Ulcer Risk</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Pressure Ulcer Risk Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections — Rule #74: each section ONE wrap-gated View, sectionTitle first child */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, fIdx)
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PressureUlcerRiskDocumentPDFTemplate;
