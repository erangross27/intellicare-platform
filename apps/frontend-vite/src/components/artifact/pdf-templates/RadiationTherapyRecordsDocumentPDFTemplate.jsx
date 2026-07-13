/**
 * RadiationTherapyRecordsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — radiation therapy records
 * Collection: radiation_therapy_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 22 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 22 },
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 9 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.45, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.45, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#4b5563', marginTop: 24 },
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* getNestedValue: supports dot-notation */
const getNestedValue = (record, key) => {
  if (!key.includes('.')) return record[key];
  const parts = key.split('.');
  let value = record;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined || value === null) return '';
  }
  return value;
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Text style={styles.fieldValue}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Text style={styles.fieldValue}>1. {formatDate(value)}</Text>
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
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
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
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Treatment Information',
    fields: [
      { key: 'startDate', label: 'Start Date', isDate: true },
      { key: 'endDate', label: 'End Date', isDate: true },
      { key: 'site', label: 'Treatment Site', isSentence: true },
    ],
  },
  {
    title: 'Dose Information',
    fields: [
      { key: 'totalDose', label: 'Total Dose', isSentence: true },
      { key: 'fractions', label: 'Fractions' },
      { key: 'technique', label: 'Technique', isSentence: true },
    ],
  },
  {
    title: 'Treatment Planning',
    fields: [
      { key: 'planning.fractionDose', label: 'Fraction Dose', isSentence: true, nested: true },
      { key: 'planning.schedule', label: 'Schedule', isSentence: true, nested: true },
      { key: 'planning.target', label: 'Target', isSentence: true, nested: true },
    ],
  },
  {
    title: 'Side Effects',
    fields: [
      { key: 'sideEffects', label: 'Side Effects', isArray: true },
    ],
  },
  {
    title: 'Treatment Response',
    fields: [
      { key: 'response', label: 'Treatment Response', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const RadiationTherapyRecordsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.radiation_therapy_records) return Array.isArray(r.radiation_therapy_records) ? r.radiation_therapy_records : [r.radiation_therapy_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiation_therapy_records) return Array.isArray(dd.radiation_therapy_records) ? dd.radiation_therapy_records : [dd.radiation_therapy_records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Radiation Therapy Records</Text>
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
          <Text style={styles.documentTitle}>Radiation Therapy Records</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Radiation Therapy Record {index + 1}</Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const populatedFields = sectionConfig.fields.filter(f => {
                const val = f.nested ? getNestedValue(record, f.key) : record[f.key];
                return hasVal(val);
              });
              if (populatedFields.length === 0) return null;

              const renderConfiguredField = (field, fIdx) => {
                const val = field.nested ? getNestedValue(record, field.key) : record[field.key];
                const visibleLabel = field.label.toLowerCase() === sectionConfig.title.toLowerCase() ? '' : field.label;
                if (field.isDate) return <React.Fragment key={field.key}>{renderDateFieldPDF(visibleLabel, val)}</React.Fragment>;
                if (field.isArray) return <React.Fragment key={field.key}>{renderArrayFieldPDF(visibleLabel, val)}</React.Fragment>;
                if (field.isSentence) return <React.Fragment key={field.key}>{renderSentenceSection(visibleLabel, val)}</React.Fragment>;
                return <React.Fragment key={field.key}>{renderFieldRow(visibleLabel, val)}</React.Fragment>;
              };

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderConfiguredField(populatedFields[0], 0)}
                  </View>
                  {populatedFields.slice(1).map((field, fIdx) => renderConfiguredField(field, fIdx + 1))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RadiationTherapyRecordsDocumentPDFTemplate;
