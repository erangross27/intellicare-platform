/**
 * EcgReportsDocumentPDFTemplate.jsx
 * Box-free black-&-white LETTER PDF (one-pass canonical): 26/19/16/12/14 pt, numbered rows,
 * section title rides the first field, break={idx>0}, no boxes/greys/uppercase.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Sanitize Unicode characters for Helvetica
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μ/g, 'u');
  str = str.replace(/µ/g, 'u');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/‘/g, "'");
  str = str.replace(/’/g, "'");
  str = str.replace(/“/g, '"');
  str = str.replace(/”/g, '"');
  return str;
};

// Split by sentence ([.;] with title protection) — mirrors the JSX/copy splitter.
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))[.;]\s+/)
    .map(s => s.replace(/[.;]$/, '').trim())
    .filter(Boolean);
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(date);
  }
};

// rate === 0 is an extractor sentinel (a living ECG can't be 0 bpm) → hide.
const rateShows = (v) => v !== null && v !== undefined && v !== '' && Number(v) !== 0;

// interpretation enum (mirror JSX): normalize casing; off-scale narratives pass through unchanged.
const ENUM_OPTIONS = { interpretation: ['Normal', 'Borderline', 'Abnormal'] };
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const filterNulls = (arr) => (Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : []);

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  // Document title — 2pt black rule below (box-free donor spec, memory 6a2d6af6).
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', textAlign: 'center', color: '#000000' },
  recordContainer: { marginBottom: 24 },
  // Record title — 1pt black rule below.
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', color: '#000000' },
  // Section title — 1pt black rule below.
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', color: '#000000' },
  fieldBlock: { marginBottom: 10 },
  // Field sub-label — 0.5pt #999 rule below.
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', color: '#000000' },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, lineHeight: 1.4, paddingLeft: 8 },
});

// One field: (optional) bold label + numbered value rows. The section title rides the FIRST field's View.
const renderFieldBlock = (title, showTitle, label, showLabel, values, key) => {
  const vals = values.filter(v => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return null;
  return (
    <View key={key} wrap={false} style={styles.fieldBlock}>
      {showTitle && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {vals.map((v, j) => (
        <Text key={j} style={styles.listItem}>{j + 1}. {safeString(v)}</Text>
      ))}
    </View>
  );
};

// Build a section's field-blocks (title rides the first non-empty block). Returns array of elements (may be empty).
const renderSection = (title, fields, keyPrefix) => {
  const out = [];
  let first = true;
  fields.forEach((f, i) => {
    const vals = (f.values || []).filter(v => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) return;
    out.push(renderFieldBlock(title, first, f.label, f.showLabel !== false, vals, `${keyPrefix}-${i}`));
    first = false;
  });
  return out;
};

const EcgReportsDocumentPDFTemplate = ({ document: doc }) => {
  const unwrappedData = doc?.documentData || doc;
  let reportsArray = [];
  if (unwrappedData?.ecg_reports && Array.isArray(unwrappedData.ecg_reports)) {
    reportsArray = unwrappedData.ecg_reports;
  } else if (Array.isArray(unwrappedData)) {
    reportsArray = unwrappedData;
  } else if (unwrappedData && typeof unwrappedData === 'object') {
    reportsArray = [unwrappedData];
  }
  const validReports = filterNulls(reportsArray);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>ECG Reports</Text>

        {validReports.map((report, idx) => {
          const basic = renderSection('Basic Information', [
            { label: 'Date', values: report.date ? [formatDate(report.date)] : [] },
            { label: 'Rhythm', values: report.rhythm ? [report.rhythm] : [] },
            { label: 'Heart Rate', values: rateShows(report.rate) ? [`${report.rate} bpm`] : [] },
            { label: 'Interpreted By', values: report.cardiologist ? [report.cardiologist] : [] },
          ], `b-${idx}`);

          const intervals = renderSection('Intervals', [
            { label: 'PR Interval', values: report.prInterval ? [report.prInterval] : [] },
            { label: 'QRS Complex', values: report.qrsComplex ? [report.qrsComplex] : [] },
            { label: 'QT Interval', values: report.qtInterval ? [report.qtInterval] : [] },
            { label: 'QTc Interval', values: report.qtcInterval ? [report.qtcInterval] : [] },
          ], `i-${idx}`);

          const morphology = renderSection('Morphology', [
            { label: 'Axis', values: report.axis ? [report.axis] : [] },
            { label: 'ST Segment', values: splitBySentence(report.stSegment) },
            { label: 'T Wave', values: splitBySentence(report.tWave) },
          ], `m-${idx}`);

          // Interpretation is an ENUM (single-name section → no field label).
          const interpretation = renderSection('Interpretation', [
            { label: 'Interpretation', showLabel: false, values: report.interpretation ? [enumCanonical('interpretation', report.interpretation)] : [] },
          ], `n-${idx}`);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{safeString(`ECG Report ${idx + 1}`)}</Text>
              {basic}
              {intervals}
              {morphology}
              {interpretation}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default EcgReportsDocumentPDFTemplate;
