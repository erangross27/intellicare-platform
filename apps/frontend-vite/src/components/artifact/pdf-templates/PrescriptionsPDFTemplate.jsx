import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE B&W STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordCard: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: '#333333', marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, marginBottom: 3, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
});

/* ═══════ CONFIG MAPS (mirror the JSX) ═══════ */
const SECTION_TITLES = {
  'prescription-details': 'Prescription Details',
  'provider-info': 'Provider Information',
  'indication': 'Indication',
  'instructions': 'Instructions',
};

const FIELD_LABELS = {
  medication: 'Medication',
  dosage: 'Dosage',
  frequency: 'Frequency',
  quantity: 'Quantity',
  refills: 'Refills',
  prescriber: 'Prescriber',
  pharmacy: 'Pharmacy',
  date: 'Date',
  indication: 'Indication',
  instructions: 'Instructions',
};

const SECTION_FIELDS = {
  'prescription-details': ['medication', 'dosage', 'frequency', 'quantity', 'refills'],
  'provider-info': ['prescriber', 'pharmacy', 'date'],
  'indication': ['indication'],
  'instructions': ['instructions'],
};
const SECTION_ORDER = ['prescription-details', 'provider-info', 'indication', 'instructions'];

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['refills'];

/* sameAsTitle: hide a field label that duplicates its section title */
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ═══════ HELPERS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...');
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue || ''); }
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* mirror of JSX formatSentenceFieldLines */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        lines.push(parsed.label + ':');
        parts.forEach(item => lines.push(`${n++}. ${item}`));
      } else {
        lines.push(parsed.label + ':');
        lines.push(`${n++}. ${parsed.value}`);
      }
    } else {
      lines.push(`${n++}. ${s}`);
    }
  });
  return lines;
};

/* ═══════ FIELD RENDER (flat elements, one glue View per field) ═══════ */
const fieldBody = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[f] || f;
  const els = [];
  if (!sameAsTitle(label, sid)) els.push(<Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>);
  if (DATE_FIELDS.includes(f)) {
    els.push(<Text key="v" style={styles.fieldValue}>{formatDate(val)}</Text>);
  } else if (NUMBER_FIELDS.includes(f)) {
    els.push(<Text key="v" style={styles.fieldValue}>{safeString(val)}</Text>);
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach((line, i) => els.push(<Text key={`s${i}`} style={styles.listItem}>{line}</Text>));
    } else {
      els.push(<Text key="v" style={styles.fieldValue}>{strVal}</Text>);
    }
  }
  return els.length > 0 ? els : null;
};

const fieldView = (record, f, sid) => {
  const body = fieldBody(record, f, sid);
  if (!body) return null;
  return <View key={f} style={styles.fieldBox} wrap={false}>{body}</View>;
};

/* anti-orphan: sectionTitle + first field glued in a wrap={false} View, rest flow */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const views = fields.map(f => fieldView(record, f, sid)).filter(Boolean);
  if (views.length === 0) return null;
  const [first, ...rest] = views;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PrescriptionsPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.prescriptions) records = document[0].prescriptions;
    else if (document.length > 0 && document[0]?.records) records = document[0].records;
    else if (document.length > 0 && document[0]?._records) records = document[0]._records;
    else records = document;
  } else if (document?.prescriptions) records = Array.isArray(document.prescriptions) ? document.prescriptions : [document.prescriptions];
  else if (document?.records) records = document.records;
  else if (document?._records) records = document._records;
  else if (document) records = [document];

  const validRecords = Array.isArray(records) ? records.filter(r => r && typeof r === 'object') : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prescriptions</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No prescription data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prescriptions</Text>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Prescription ${idx + 1}`}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrescriptionsPDFTemplate;
