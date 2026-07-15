/**
 * StagingSummaryDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — staging summary
 * Collection: staging_summary
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
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
  return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      <Text style={styles.fieldValue}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: split by sentence, parseLabel, splitByComma */
const renderSentenceField = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldRow(label, value, showLabel);

  let n = 1;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{n++}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
      })}
    </View>
  );
};

/* ======= SECTIONS ======= */
const SECTION_FIELDS = {
  'record-info': { title: 'Record Information', fields: ['date', 'type', 'provider', 'facility', 'status'] },
  'staging-details': { title: 'Staging Details', fields: ['overallStage', 'ipiScoreValue'] },
  'prognostic-implications': { title: 'Prognostic Implications', fields: ['prognosticImplications'] },
  'treatment-approach': { title: 'Treatment Approach', fields: ['treatmentApproach'] },
  'findings-section': { title: 'Findings', fields: ['findings'] },
  'clinical-assessment': { title: 'Clinical Assessment', fields: ['assessment'] },
  'plan-section': { title: 'Plan', fields: ['plan'] },
  'notes-section': { title: 'Notes', fields: ['notes'] },
};

const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility',
  status: 'Status',
  overallStage: 'Overall Stage', ipiScoreValue: 'IPI Score',
  prognosticImplications: 'Prognostic Implications', treatmentApproach: 'Treatment Approach',
  findings: 'Findings', assessment: 'Clinical Assessment', plan: 'Plan', notes: 'Notes',
};

const DATE_FIELDS = ['date'];

const StagingSummaryDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  const records = (() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.staging_summary) return Array.isArray(r.staging_summary) ? r.staging_summary : [r.staging_summary];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Staging Summary</Text></View>
          <Text style={styles.noDataText}>No staging summary data available</Text>
        </Page>
      </Document>
    );
  }

  const renderSection = (record, sid) => {
    const config = SECTION_FIELDS[sid];
    if (!config) return null;
    const { title, fields } = config;
    const hasAny = fields.some(f => hasVal(record[f]));
    if (!hasAny) return null;

    const renderedFields = fields.filter(f => hasVal(record[f])).map(f => {
      const label = FIELD_LABELS[f] || f;
      const showLabel = label.toLowerCase() !== title.toLowerCase();
      return (
        <React.Fragment key={f}>
          {DATE_FIELDS.includes(f)
            ? renderFieldRow(label, formatDate(record[f]), showLabel)
            : renderSentenceField(label, record[f], showLabel)}
        </React.Fragment>
      );
    });
    const [firstField, ...remainingFields] = renderedFields;

    return (
      <View style={styles.section}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {firstField}
        </View>
        {remainingFields}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Staging Summary</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Staging Summary {idx + 1}</Text>
            </View>

            {renderSection(record, 'record-info')}
            {renderSection(record, 'staging-details')}
            {renderSection(record, 'prognostic-implications')}
            {renderSection(record, 'treatment-approach')}
            {renderSection(record, 'findings-section')}
            {renderSection(record, 'clinical-assessment')}
            {renderSection(record, 'plan-section')}
            {renderSection(record, 'notes-section')}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StagingSummaryDocumentPDFTemplate;
