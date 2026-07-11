/**
 * BehavioralHealthGoalsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — behavioral health goals
 * Collection: behavioral_health_goals
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
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

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
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
    if (ch === '(' || ch === '"') { depth++; current += ch; }
    else if (ch === ')' || (ch === '"' && depth > 0)) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(s => s);
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

/* renderDateField */
const renderDateField = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + quote-aware comma-split + sequential counter */
const renderSentenceField = (label, text) => {
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

/* renderSemicolonField */
const renderSemicolonField = (label, text) => {
  if (!hasVal(text)) return null;
  const items = splitBySemicolon(fmtVal(text));
  if (items.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* renderArrayField */
const renderArrayField = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
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

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Goal Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'goalCategory', label: 'Goal Category' },
      { key: 'goalDescription', label: 'Goal Description', isSentence: true },
      { key: 'priority', label: 'Priority' },
      { key: 'lifecycleStatus', label: 'Lifecycle Status' },
      { key: 'achievementStatus', label: 'Achievement Status' },
    ],
  },
  {
    title: 'Targets & Measures',
    fields: [
      { key: 'measurableTarget', label: 'Measurable Target', isSemicolon: true },
      { key: 'targetMeasure', label: 'Target Measure', isSentence: true },
      { key: 'targetValue', label: 'Target Value', isNumber: true },
      { key: 'baselineValue', label: 'Baseline Value', isNumber: true },
      { key: 'currentValue', label: 'Current Value', isNumber: true },
      { key: 'targetDate', label: 'Target Date', isDate: true },
      { key: 'startDate', label: 'Start Date', isDate: true },
    ],
  },
  {
    title: 'Addresses',
    fields: [
      { key: 'addresses', label: 'Conditions Addressed', isArray: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'interventions', label: 'Interventions', isArray: true },
      { key: 'barriers', label: 'Barriers', isArray: true },
      { key: 'supportSystem', label: 'Support System', isArray: true },
    ],
  },
  {
    title: 'Engagement & Review',
    fields: [
      { key: 'expressedBy', label: 'Expressed By' },
      { key: 'acceptedBy', label: 'Accepted By' },
      { key: 'patientEngagement', label: 'Patient Engagement', isSentence: true },
      { key: 'safetyConsiderations', label: 'Safety Considerations', isSentence: true },
      { key: 'reviewFrequency', label: 'Review Frequency' },
      { key: 'lastReviewedDate', label: 'Last Reviewed Date', isDate: true },
    ],
  },
  {
    title: 'Tracking & History',
    fields: [
      { key: 'outcomeReferences', label: 'Outcome References', isArray: true },
      { key: 'relatedGoals', label: 'Related Goals', isArray: true },
      { key: 'modificationHistory', label: 'Modification History', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const BehavioralHealthGoalsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.behavioral_health_goals) return Array.isArray(r.behavioral_health_goals) ? r.behavioral_health_goals : [r.behavioral_health_goals];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.behavioral_health_goals) return Array.isArray(dd.behavioral_health_goals) ? dd.behavioral_health_goals : [dd.behavioral_health_goals]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Behavioral Health Goals</Text>
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
          <Text style={styles.documentTitle}>Behavioral Health Goals</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {record.goalCategory || `Behavioral Health Goal ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const fieldPresent = (f) => f.isNumber ? numberShowsPDF(record, f.key) : hasVal(record[f.key]);
              const hasAnyVal = sectionConfig.fields.some(fieldPresent);
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!fieldPresent(field)) return null;
                    const _first = !_t; _t = true;
                    const _el = field.isDate ? renderDateField(field.label, val)
                      : field.isArray ? renderArrayField(field.label, val)
                      : field.isSemicolon ? renderSemicolonField(field.label, val)
                      : field.isSentence ? renderSentenceField(field.label, val)
                      : renderFieldRow(field.label, val);
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

export default BehavioralHealthGoalsDocumentPDFTemplate;
