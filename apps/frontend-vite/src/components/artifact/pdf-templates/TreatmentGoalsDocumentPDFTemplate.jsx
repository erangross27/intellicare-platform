/**
 * TreatmentGoalsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — treatment goals
 * Collection: treatment_goals
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  goalBox: { marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#606060', paddingTop: 4, paddingBottom: 4 },
  goalText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  goalMeta: { fontSize: 10, color: '#333333', paddingLeft: 8, marginBottom: 2 },
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

/* renderFieldRow: label + value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
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
  const safeItems = items.filter(Boolean).map(item => typeof item === 'string' ? item : (item.recommendation || String(item)));
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

/* humanizeKey: dynamic DB key -> readable label */
const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
};

/* flattenObject: dynamic-key object (incl. nested) -> [{label, value}] with typed leaves */
const flattenObject = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (!hasVal(value)) return;
    const label = prefix ? `${prefix} - ${humanizeKey(key)}` : humanizeKey(key);
    if (typeof value === 'boolean') {
      items.push({ label, value: value ? 'Yes' : 'No' });
    } else if (typeof value === 'number') {
      items.push({ label, value: String(value) });
    } else if (Array.isArray(value)) {
      const flat = value.filter(hasVal).map(v => (typeof v === 'object' ? flattenObject(v, label).map(x => `${x.label}: ${x.value}`).join('; ') : fmtVal(v)));
      if (flat.length) items.push({ label, value: flat.join(', ') });
    } else if (typeof value === 'object') {
      if (value.$date) { items.push({ label, value: formatDate(value.$date) }); return; }
      items.push(...flattenObject(value, label));
    } else {
      items.push({ label, value: fmtVal(value) });
    }
  });
  return items;
};

/* renderObjectField: dynamic-key object -> humanized label + typed leaf rows */
const renderObjectField = (label, obj) => {
  if (!hasVal(obj) || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const items = flattenObject(obj);
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item.label)}: {safeString(item.value)}</Text>
      ))}
    </View>
  );
};

/* renderGoalArray: structured goals with goal/timeframe/measurable */
const renderGoalArray = (label, goals) => {
  if (!Array.isArray(goals) || goals.length === 0) return null;
  const safeGoals = goals.filter(Boolean);
  if (safeGoals.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeGoals.map((goal, i) => {
        const goalText = typeof goal === 'string' ? goal : (goal.goal || '');
        const timeframe = typeof goal === 'object' ? goal.timeframe : null;
        const measurable = typeof goal === 'object' ? goal.measurable : null;
        return (
          <View key={i} style={styles.goalBox}>
            <Text style={styles.goalText}>Goal {i + 1}: {safeString(goalText)}</Text>
            {timeframe && <Text style={styles.goalMeta}>Timeframe: {safeString(timeframe)}</Text>}
            {measurable && <Text style={styles.goalMeta}>Measurable: {safeString(measurable)}</Text>}
          </View>
        );
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'General Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Immediate Goals',
    fields: [
      { key: 'immediateGoals', label: 'Immediate Goals', isGoalArray: true },
    ],
  },
  {
    title: 'Short Term Goals',
    fields: [
      { key: 'shortTermGoals', label: 'Short Term Goals', isGoalArray: true },
    ],
  },
  {
    title: 'Long Term Goals',
    fields: [
      { key: 'longTermGoals', label: 'Long Term Goals', isGoalArray: true },
    ],
  },
  {
    title: 'Patient Goals',
    fields: [
      { key: 'patientGoals', label: 'Patient Goals', isArray: true },
    ],
  },
  {
    title: 'Family Goals',
    fields: [
      { key: 'familyGoals', label: 'Family Goals', isArray: true },
    ],
  },
  {
    title: 'Clinical Notes',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
  {
    title: 'Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isArray: true },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isObject: true },
    ],
  },
];

/* renderSection */
const renderRecordSection = (record, config) => {
  const hasAny = config.fields.some(f => hasVal(record[f.key]));
  if (!hasAny) return null;

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{config.title}</Text>
      {config.fields.map((f, i) => {
        if (f.isDate) return <React.Fragment key={i}>{renderDateFieldPDF(f.label, record[f.key])}</React.Fragment>;
        if (f.isGoalArray) return <React.Fragment key={i}>{renderGoalArray(f.label, record[f.key])}</React.Fragment>;
        if (f.isArray) return <React.Fragment key={i}>{renderArrayFieldPDF(f.label, record[f.key])}</React.Fragment>;
        if (f.isObject) return <React.Fragment key={i}>{renderObjectField(f.label, record[f.key])}</React.Fragment>;
        if (f.isSentence) return <React.Fragment key={i}>{renderSentenceSection(f.label, record[f.key])}</React.Fragment>;
        return <React.Fragment key={i}>{renderFieldRow(f.label, record[f.key])}</React.Fragment>;
      })}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const TreatmentGoalsDocumentPDFTemplate = ({ document: data }) => {
  const records = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.treatment_goals) return Array.isArray(data.treatment_goals) ? data.treatment_goals : [data.treatment_goals];
    return [data];
  })().filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Treatment Goals</Text>
          </View>
          <Text style={styles.noDataText}>No treatment goals records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Treatment Goals</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{safeString(record.type || `Treatment Goals ${idx + 1}`)}</Text>
              {hasVal(record.provider) && <Text style={styles.recordDate}>{safeString(record.provider)}</Text>}
            </View>
            {SECTION_CONFIGS.map((config, sIdx) => (
              <React.Fragment key={sIdx}>{renderRecordSection(record, config)}</React.Fragment>
            ))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TreatmentGoalsDocumentPDFTemplate;
