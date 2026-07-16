/**
 * TumorMarkerPanelsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — tumor marker panels
 * Collection: tumor_marker_panels
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
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

const COMMA_SPLIT_FIELDS = new Set(['clinicalContext']);
const NUMBER_FIELDS = new Set(['afpLevel', 'ceaLevel', 'ca125Level', 'ca199Level', 'ca153Level', 'psaTotal', 'psaFree', 'betaHcgLevel', 'ldhLevel', 'calcitoninLevel', 'thyroglobulinLevel', 'chromograninALevel', 'neuronSpecificEnolase', 'squamousCellCarcinomaAntigen', 'cyfra211Level', 'ca242Level', 'her2NeuLevel']);

const splitBySentence = (text, field = '') => {
  if (!text || typeof text !== 'string') return [];
  const clauses = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  return COMMA_SPLIT_FIELDS.has(field) ? clauses.flatMap(splitByComma) : clauses;
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
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, field) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text), field);
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
    <View style={styles.fieldBox} wrap={rows.length > 8}>
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
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
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
    title: 'Panel Information',
    fields: [
      { key: 'panelIndication', label: 'Panel Indication', isSentence: true },
      { key: 'specimenType', label: 'Specimen Type', isSentence: true },
      { key: 'collectionDateTime', label: 'Collection Date/Time', isDate: true },
      { key: 'clinicalContext', label: 'Clinical Context', isSentence: true },
    ],
  },
  {
    title: 'Primary Tumor Markers',
    fields: [
      { key: 'afpLevel', label: 'AFP Level' },
      { key: 'ceaLevel', label: 'CEA Level' },
      { key: 'ca125Level', label: 'CA-125 Level' },
      { key: 'ca199Level', label: 'CA 19-9 Level' },
      { key: 'ca153Level', label: 'CA 15-3 Level' },
      { key: 'psaTotal', label: 'PSA Total' },
      { key: 'psaFree', label: 'PSA Free' },
      { key: 'betaHcgLevel', label: 'Beta-HCG Level' },
    ],
  },
  {
    title: 'Secondary Tumor Markers',
    fields: [
      { key: 'ldhLevel', label: 'LDH Level' },
      { key: 'calcitoninLevel', label: 'Calcitonin Level' },
      { key: 'thyroglobulinLevel', label: 'Thyroglobulin Level' },
      { key: 'chromograninALevel', label: 'Chromogranin A Level' },
      { key: 'neuronSpecificEnolase', label: 'Neuron-Specific Enolase' },
      { key: 'squamousCellCarcinomaAntigen', label: 'Squamous Cell Carcinoma Antigen' },
      { key: 'cyfra211Level', label: 'CYFRA 21-1 Level' },
      { key: 'ca242Level', label: 'CA 242 Level' },
      { key: 'her2NeuLevel', label: 'HER2/neu Level' },
    ],
  },
  {
    title: 'Clinical Summary',
    fields: [
      { key: 'abnormalMarkers', label: 'Abnormal Markers', isArray: true },
      { key: 'previousMarkerComparison', label: 'Previous Marker Comparison', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const TumorMarkerPanelsDocumentPDFTemplate = ({ document: docProp, data, templateData }) => {
  const source = docProp ?? data ?? templateData;
  const records = React.useMemo(() => {
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (Array.isArray(r?.wrapRecordsIntoSingleDocument)) return r.wrapRecordsIntoSingleDocument;
      if (Array.isArray(r?.records || r?._records)) return r.records || r._records;
      if (r?.tumor_marker_panels) return Array.isArray(r.tumor_marker_panels) ? r.tumor_marker_panels : [r.tumor_marker_panels];
      if (r?.data?.tumor_marker_panels) return Array.isArray(r.data.tumor_marker_panels) ? r.data.tumor_marker_panels : [r.data.tumor_marker_panels];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.tumor_marker_panels) return Array.isArray(dd.tumor_marker_panels) ? dd.tumor_marker_panels : [dd.tumor_marker_panels]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [source]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Tumor Marker Panels</Text>
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
          <Text style={styles.documentTitle}>Tumor Marker Panels</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Tumor Marker Panel {index + 1}</Text></View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const fieldShows = field => hasVal(record[field.key]) && (!NUMBER_FIELDS.has(field.key) || Number(record[field.key]) !== 0 || record?._showZeroFields?.includes(field.key) || record?.doctorEdits?.editedFields?.includes(field.key));
              const visibleFields = sectionConfig.fields.filter(fieldShows);
              const hasAnyVal = visibleFields.length > 0;
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text></View>
                  {visibleFields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val, field.key)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
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

export default TumorMarkerPanelsDocumentPDFTemplate;
