/**
 * VisualAcuityReportsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — visual acuity reports
 * Collection: visual_acuity_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#333333', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
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

const numberShowsPDF = (record, key) => {
  const value = record[key];
  if (value === null || value === undefined || value === '') return false;
  const number = Number(value); if (!Number.isFinite(number)) return false;
  if (number !== 0) return true;
  return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
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
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
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

  let rowNumber = 1;
  const groups = safeItems.map(item => {
    const parsed = parseLabel(safeString(item));
    return { label: parsed.isLabeled ? parsed.label : '', rows: splitByComma(parsed.value).map(value => ({ value, number: rowNumber++ })) };
  });
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {groups.map((group, groupIndex) => (
        <View key={groupIndex}>{group.label && <Text style={styles.nestedSubtitle}>{group.label}</Text>}{group.rows.map(row => <Text key={row.number} style={styles.listItem}>{row.number}. {safeString(row.value)}</Text>)}</View>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Snellen Chart',
    fields: [
      { key: 'snellenChartRightEye', label: 'Snellen Chart - Right Eye (OD)', isSentence: true },
      { key: 'snellenChartLeftEye', label: 'Snellen Chart - Left Eye (OS)', isSentence: true },
    ],
  },
  {
    title: 'Corrected & Uncorrected Vision',
    fields: [
      { key: 'correctedVisionRightEye', label: 'Corrected Vision - Right Eye (OD)', isSentence: true },
      { key: 'correctedVisionLeftEye', label: 'Corrected Vision - Left Eye (OS)', isSentence: true },
      { key: 'uncorrectedVisionRightEye', label: 'Uncorrected Vision - Right Eye (OD)', isSentence: true },
      { key: 'uncorrectedVisionLeftEye', label: 'Uncorrected Vision - Left Eye (OS)', isSentence: true },
    ],
  },
  {
    title: 'Near Vision & Pinhole Acuity',
    fields: [
      { key: 'nearVisionRightEye', label: 'Near Vision - Right Eye (OD)', isSentence: true },
      { key: 'nearVisionLeftEye', label: 'Near Vision - Left Eye (OS)', isSentence: true },
      { key: 'pinholeAcuityRightEye', label: 'Pinhole Acuity - Right Eye (OD)', isSentence: true },
      { key: 'pinholeAcuityLeftEye', label: 'Pinhole Acuity - Left Eye (OS)', isSentence: true },
    ],
  },
  {
    title: 'LogMAR & ETDRS Scores',
    fields: [
      { key: 'logmarRightEye', label: 'LogMAR - Right Eye (OD)', isNumber: true },
      { key: 'logmarLeftEye', label: 'LogMAR - Left Eye (OS)', isNumber: true },
      { key: 'etdrsLetterScoreRightEye', label: 'ETDRS Letter Score - Right Eye (OD)', isNumber: true },
      { key: 'etdrsLetterScoreLeftEye', label: 'ETDRS Letter Score - Left Eye (OS)', isNumber: true },
    ],
  },
  {
    title: 'Refractive Error & Pupillary',
    fields: [
      { key: 'refractiveErrorRightEye', label: 'Refractive Error - Right Eye (OD)', isSentence: true },
      { key: 'refractiveErrorLeftEye', label: 'Refractive Error - Left Eye (OS)', isSentence: true },
      { key: 'pupillaryDefectRightEye', label: 'Pupillary Defect - Right Eye (OD)' },
      { key: 'pupillaryDefectLeftEye', label: 'Pupillary Defect - Left Eye (OS)' },
    ],
  },
  {
    title: 'Contrast Sensitivity & Binocular Vision',
    fields: [
      { key: 'contrastSensitivityRightEye', label: 'Contrast Sensitivity - Right Eye (OD)', isSentence: true },
      { key: 'contrastSensitivityLeftEye', label: 'Contrast Sensitivity - Left Eye (OS)', isSentence: true },
      { key: 'binocularVisionStatus', label: 'Binocular Vision Status', isSentence: true },
    ],
  },
  {
    title: 'Testing Conditions & Visual Field Defects',
    fields: [
      { key: 'testingDistance', label: 'Testing Distance', isSentence: true },
      { key: 'testingConditions', label: 'Testing Conditions', isSentence: true },
      { key: 'visualFieldDefects', label: 'Visual Field Defects', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const fieldPresent = (record, field) => field.isNumber ? numberShowsPDF(record, field.key) : hasVal(record[field.key]);

const VisualAcuityReportsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const source = documentProp ?? data ?? templateData;
  const records = React.useMemo(() => {
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r?.records || r?._records)) return r.records || r._records;
      if (r?.visual_acuity_reports) return Array.isArray(r.visual_acuity_reports) ? r.visual_acuity_reports : [r.visual_acuity_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.visual_acuity_reports) return Array.isArray(dd.visual_acuity_reports) ? dd.visual_acuity_reports : [dd.visual_acuity_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [source]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Visual Acuity Reports</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
          <Text fixed style={styles.footer}>Visual Acuity Reports</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Visual Acuity Reports</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Visual Acuity Report ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(field => fieldPresent(record, field));
              if (!presentFields.length) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (field.isDate) return <View key={fIdx}>{renderFieldRow(field.label, formatDate(val))}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
        <Text fixed style={styles.footer}>Visual Acuity Reports</Text>
      </Page>
    </Document>
  );
};

export default VisualAcuityReportsDocumentPDFTemplate;
