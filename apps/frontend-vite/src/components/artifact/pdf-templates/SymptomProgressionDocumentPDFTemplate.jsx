/**
 * SymptomProgressionDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — symptom progression
 * Collection: symptom_progression
 * B&W GRAYSCALE ONLY.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  nestedGroup: { marginTop: 3, marginBottom: 3, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#d1d5db', borderLeftStyle: 'solid' },
  nestedLeafLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 1 },
  nestedLeafValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
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

/* ======= OBJECT / VALUE HELPERS ======= */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField: label + formatted date */
const renderDateField = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceField: split by sentence, 4-level */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldRow(label, value);

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
              <View key={sIdx} style={{ marginTop: 4 }} wrap={false}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{n++}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx} style={{ marginTop: 4 }} wrap={false}>
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

/* renderRecommendationsField: array of {recommendation, date}, date-grouped */
const renderRecommendationsField = (label, value) => {
  const recs = Array.isArray(value) ? value.filter(r => hasVal(r?.recommendation)) : [];
  if (recs.length === 0) return null;
  /* Group consecutive recommendations that share the same date. */
  const groups = [];
  recs.forEach((rec) => {
    const d = (rec?.date || '').trim();
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.items.push(rec);
    else groups.push({ date: d, items: [rec] });
  });
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {groups.map((group, gIdx) => (
        <View key={gIdx} style={{ marginTop: 4 }} wrap={false}>
          {group.date ? <Text style={styles.nestedSubtitle}>{group.date}</Text> : null}
          {group.items.map((rec, rIdx) => (
            <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {(rec?.recommendation || '').trim()}</Text>
          ))}
        </View>
      ))}
    </View>
  );
};

/* renderObjectNode: recursive object renderer */
const renderObjectNode = (label, value, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={label} wrap={false}>
        <Text style={styles.nestedLeafLabel}>{label}</Text>
        <Text style={styles.nestedLeafValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={label}>
      {label ? <Text style={styles.nestedSubtitle}>{label}</Text> : null}
      <View style={depth > 0 ? styles.nestedGroup : undefined}>
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, depth + 1))}
      </View>
    </View>
  );
};

const renderObjectField = (label, value) => {
  if (!hasVal(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, 1))}
    </View>
  );
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'symptom-info': 'Symptom Information',
  'timeline-section': 'Timeline',
  'weekly-status': 'Weekly Status',
  'current-status': 'Current Status',
  'findings-section': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'notes-status': 'Notes & Status',
};

const SECTION_FIELDS = {
  'symptom-info': ['date', 'type', 'provider', 'facility'],
  'timeline-section': ['timeline'],
  'weekly-status': ['week1', 'week2', 'week3'],
  'current-status': ['current'],
  'findings-section': ['findings', 'results'],
  'assessment-plan': ['assessment', 'plan', 'recommendations'],
  'notes-status': ['notes', 'status'],
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  timeline: 'Timeline',
  week1: 'Week 1',
  week2: 'Week 2',
  week3: 'Week 3',
  current: 'Current Status',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
};

const DATE_FIELDS = ['date'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];

const renderFieldByType = (f, record) => {
  const label = FIELD_LABELS[f] || f;
  if (DATE_FIELDS.includes(f)) return renderDateField(label, record[f]);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return renderRecommendationsField(label, record[f]);
  if (OBJECT_FIELDS.includes(f)) return renderObjectField(label, record[f]);
  return renderSentenceField(label, record[f]);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const anyVal = fields.some(f => hasVal(record[f]));
  if (!anyVal) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
      {fields.map(f => renderFieldByType(f, record))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const SymptomProgressionDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (rawData) => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) return [];
      if (rawData[0]?.symptom_progression) return Array.isArray(rawData[0].symptom_progression) ? rawData[0].symptom_progression : [rawData[0].symptom_progression];
      if (rawData[0]?._records && Array.isArray(rawData[0]._records)) return rawData[0]._records;
      if (rawData[0]?.records && Array.isArray(rawData[0].records)) return rawData[0].records;
      return rawData;
    }
    if (rawData.symptom_progression) return Array.isArray(rawData.symptom_progression) ? rawData.symptom_progression : [rawData.symptom_progression];
    if (rawData._records && Array.isArray(rawData._records)) return rawData._records;
    if (rawData.records && Array.isArray(rawData.records)) return rawData.records;
    if (rawData.date || rawData.timeline || rawData.current || rawData.findings) return [rawData];
    return [];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No symptom progression data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Symptom Progression</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Symptom Progression {idx + 1}</Text>
            </View>
            {renderSection(record, 'symptom-info')}
            {renderSection(record, 'timeline-section')}
            {renderSection(record, 'weekly-status')}
            {renderSection(record, 'current-status')}
            {renderSection(record, 'findings-section')}
            {renderSection(record, 'assessment-plan')}
            {renderSection(record, 'notes-status')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SymptomProgressionDocumentPDFTemplate;
