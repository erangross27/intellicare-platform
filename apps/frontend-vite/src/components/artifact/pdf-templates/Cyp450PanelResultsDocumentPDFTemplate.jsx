/**
 * Cyp450PanelResultsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — CYP450 panel results
 * Collection: cyp450_panel_results
 * PDF: NO BLUE — all borders/titles use #000000
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
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

/* Extraction-default zeros hidden in the PDF too (mirror of the JSX HIDE_ZERO_FIELDS). */
const HIDE_ZERO = ['calculatedWarfarinDose'];
const showField = (key, value) => hasVal(value) && !(value === 0 && HIDE_ZERO.includes(key));

/* renderFieldRow: label + a single numbered value (mirrors Copy's "1. value") */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
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

  const wrapProp = rows.length > 8;

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
    title: 'CYP2D6 Results',
    fields: [
      { key: 'cyp2d6Genotype', label: 'CYP2D6 Genotype', isSentence: true },
      { key: 'cyp2d6PhenotypeClassification', label: 'CYP2D6 Phenotype Classification', isSentence: true },
      { key: 'cyp2d6ActivityScore', label: 'CYP2D6 Activity Score' },
    ],
  },
  {
    title: 'CYP2C Results',
    fields: [
      { key: 'cyp2c19Genotype', label: 'CYP2C19 Genotype', isSentence: true },
      { key: 'cyp2c19PhenotypeClassification', label: 'CYP2C19 Phenotype Classification', isSentence: true },
      { key: 'cyp2c9Genotype', label: 'CYP2C9 Genotype', isSentence: true },
      { key: 'cyp2c9PhenotypeClassification', label: 'CYP2C9 Phenotype Classification', isSentence: true },
      { key: 'cyp2c8Genotype', label: 'CYP2C8 Genotype', isSentence: true },
    ],
  },
  {
    title: 'CYP3A / CYP2B6 / CYP1A2',
    fields: [
      { key: 'cyp3a4Genotype', label: 'CYP3A4 Genotype', isSentence: true },
      { key: 'cyp3a5Genotype', label: 'CYP3A5 Genotype', isSentence: true },
      { key: 'cyp3a5ExpresserStatus', label: 'CYP3A5 Expresser Status', isSentence: true },
      { key: 'cyp2b6Genotype', label: 'CYP2B6 Genotype', isSentence: true },
      { key: 'cyp1a2InducerStatus', label: 'CYP1A2 Inducer Status', isSentence: true },
    ],
  },
  {
    title: 'Warfarin & Clopidogrel',
    fields: [
      { key: 'vkorc1Genotype', label: 'VKORC1 Genotype', isSentence: true },
      { key: 'warfarinSensitivityCategory', label: 'Warfarin Sensitivity Category', isSentence: true },
      { key: 'calculatedWarfarinDose', label: 'Calculated Warfarin Dose' },
      { key: 'clopidogrelResponsePrediction', label: 'Clopidogrel Response Prediction', isSentence: true },
    ],
  },
  {
    title: 'DPYD / TPMT / NUDT15 / SLCO1B1',
    fields: [
      { key: 'dpydGenotype', label: 'DPYD Genotype', isSentence: true },
      { key: 'dpydActivityScore', label: 'DPYD Activity Score' },
      { key: 'tpmtGenotype', label: 'TPMT Genotype', isSentence: true },
      { key: 'tpmtPhenotypeClassification', label: 'TPMT Phenotype Classification', isSentence: true },
      { key: 'nudt15Genotype', label: 'NUDT15 Genotype', isSentence: true },
      { key: 'slco1b1Genotype', label: 'SLCO1B1 Genotype', isSentence: true },
    ],
  },
  {
    title: 'Gene-Drug Interactions & CNVs',
    fields: [
      { key: 'genesDrugInteractionsSummary', label: 'Gene-Drug Interactions Summary', isArray: true },
      { key: 'copyNumberVariantsDetected', label: 'Copy Number Variants Detected', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const Cyp450PanelResultsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.cyp450_panel_results) return Array.isArray(r.cyp450_panel_results) ? r.cyp450_panel_results : [r.cyp450_panel_results];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cyp450_panel_results) return Array.isArray(dd.cyp450_panel_results) ? dd.cyp450_panel_results : [dd.cyp450_panel_results]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>CYP450 Panel Results</Text>
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
          <Text style={styles.documentTitle}>CYP450 Panel Results</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CYP450 Panel ${index + 1}`}</Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => showField(f.key, record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!showField(field.key, val)) return null;
                    const _first = !_t; _t = true;
                    const _el = field.isArray ? renderArrayFieldPDF(field.label, val) : field.isSentence ? renderSentenceSection(field.label, val) : renderFieldRow(field.label, val);
                    if (_first) return <View key={fIdx} wrap={false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text>{_el}</View>;
                    return <View key={fIdx}>{_el}</View>;
                  }); })()}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default Cyp450PanelResultsDocumentPDFTemplate;
