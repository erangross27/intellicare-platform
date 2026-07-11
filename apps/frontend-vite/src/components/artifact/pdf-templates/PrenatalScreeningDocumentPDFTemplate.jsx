/**
 * PrenatalScreeningDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — prenatal screening
 * Collection: prenatal_screening
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#333333', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  objectLeaf: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  objectLeafLabel: { fontFamily: 'Helvetica-Bold', color: '#000000' },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= OBJECT HELPERS (B&W recursive renderer) ======= */
const KEY_OVERRIDES = { dna: 'DNA', nt: 'NT', cvs: 'CVS', hcg: 'hCG', afp: 'AFP', papp: 'PAPP', mom: 'MoM' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[String(key).toLowerCase()]) return KEY_OVERRIDES[String(key).toLowerCase()];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const renderObjectNode = (value, label, depth, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={{ marginLeft: depth * 10, marginBottom: 2 }}>
        <Text style={styles.objectLeaf}><Text style={styles.objectLeafLabel}>{label}: </Text>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={{ marginLeft: depth * 10 }}>
      {label ? <Text style={[styles.nestedSubtitle, { marginLeft: 0 }]}>{label}:</Text> : null}
      {entries.map(([k, v], i) => renderObjectNode(v, humanizeKey(k), label ? depth + 1 : depth, `${keyPrefix}-${k}-${i}`))}
    </View>
  );
};

const renderObjectField = (val, label) => {
  if (isEmptyDeep(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v], i) => renderObjectNode(v, humanizeKey(k), 0, `${label}-${k}-${i}`))}
    </View>
  );
};

/* ======= FIELD RENDERING ======= */
const renderFieldValue = (val, label) => {
  const str = safeString(val);
  if (!str) return null;
  const sentences = splitBySentence(str);
  if (sentences.length <= 1) {
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{str}</Text>
      </View>
    );
  }
  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
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

/* ======= SECTIONS CONFIG ======= */
const SECTION_FIELDS = {
  'clinical-info': { title: 'Clinical Information', fields: [
    { key: 'date', label: 'Date', isDate: true },
    { key: 'type', label: 'Type' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
  ]},
  'screening-studies': { title: 'Screening Studies', fields: [
    { key: 'firstTrimesterScreen', label: 'First Trimester Screen', isObject: true },
    { key: 'cellFreeDna', label: 'Cell Free DNA', isObject: true },
    { key: 'quadScreen', label: 'Quad Screen', isObject: true },
    { key: 'amniocentesis', label: 'Amniocentesis', isObject: true },
    { key: 'cvs', label: 'CVS', isObject: true },
    { key: 'results', label: 'Results', isObject: true },
  ]},
  'screening-results': { title: 'Screening Results', fields: [
    { key: 'ntScanResult', label: 'NT Scan Result' },
    { key: 'cellFreeDNAResult', label: 'Cell Free DNA Result' },
    { key: 'firstTrimesterScreenResult', label: 'First Trimester Screen Result' },
    { key: 'anatomyScanResult', label: 'Anatomy Scan Result' },
    { key: 'cervicalLengthMeasurement', label: 'Cervical Length Measurement' },
    { key: 'fetalEchoResult', label: 'Fetal Echo Result' },
    { key: 'perinatalMentalHealthReferral', label: 'Perinatal Mental Health Referral' },
  ]},
  'findings': { title: 'Findings', fields: [
    { key: 'findings', label: 'Findings' },
  ]},
  'assessment': { title: 'Assessment', fields: [
    { key: 'assessment', label: 'Assessment' },
  ]},
  'plan': { title: 'Plan', fields: [
    { key: 'plan', label: 'Plan' },
  ]},
  'recommendations': { title: 'Recommendations', fields: [
    { key: 'recommendations', label: 'Recommendations', isArray: true },
  ]},
  'notes': { title: 'Notes', fields: [
    { key: 'notes', label: 'Notes' },
    { key: 'status', label: 'Status' },
  ]},
};

/* count display rows in a section for wrap-gating (Rule #74) */
const countSectionRows = (record, config) => {
  let rows = 0;
  config.fields.forEach(f => {
    const val = record[f.key];
    if (!hasVal(val)) return;
    if (f.isObject) { rows += Object.values(val).filter(v => !isEmptyDeep(v)).length * 2; }
    else if (f.isArray) { rows += (Array.isArray(val) ? val.filter(Boolean).length : 0) + 1; }
    else { rows += splitBySentence(safeString(val)).length || 1; }
  });
  return rows;
};

const renderSection = (record, sectionKey) => {
  const config = SECTION_FIELDS[sectionKey];
  if (!config) return null;
  const hasAny = config.fields.some(f => hasVal(record[f.key]));
  if (!hasAny) return null;

  const rowCount = countSectionRows(record, config);
  return (
    <View style={styles.section} wrap={rowCount > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{config.title}</Text>
      {config.fields.map(f => {
        const val = record[f.key];
        if (!hasVal(val)) return null;
        if (f.isObject) {
          return <View key={f.key}>{renderObjectField(val, f.label)}</View>;
        }
        if (f.isDate) {
          return (
            <View key={f.key} style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{formatDate(val)}</Text>
            </View>
          );
        }
        if (f.isArray) {
          const items = Array.isArray(val) ? val.filter(Boolean) : [];
          if (items.length === 0) return null;
          return (
            <View key={f.key} style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              {items.map((item, i) => {
                const itemStr = typeof item === 'string' ? item : safeString(item?.recommendation || item);
                return <Text key={i} style={styles.listItem}>{i + 1}. {itemStr}</Text>;
              })}
            </View>
          );
        }
        return <View key={f.key}>{renderFieldValue(val, f.label)}</View>;
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PrenatalScreeningDocumentPDFTemplate = ({ document: data }) => {
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.records) rawRecords = data[0].records;
    else if (data.length > 0 && data[0]?._records) rawRecords = data[0]._records;
    else rawRecords = data;
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data?._records) {
    rawRecords = data._records;
  } else if (data) {
    rawRecords = [data];
  }

  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const clean = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) clean[key] = record[key];
    }
    return clean;
  }).filter(Boolean);

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Prenatal Screening</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Prenatal Screening</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Prenatal Screening {idx + 1}</Text>
            </View>
            {renderSection(record, 'clinical-info')}
            {renderSection(record, 'screening-studies')}
            {renderSection(record, 'screening-results')}
            {renderSection(record, 'findings')}
            {renderSection(record, 'assessment')}
            {renderSection(record, 'plan')}
            {renderSection(record, 'recommendations')}
            {renderSection(record, 'notes')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrenatalScreeningDocumentPDFTemplate;
