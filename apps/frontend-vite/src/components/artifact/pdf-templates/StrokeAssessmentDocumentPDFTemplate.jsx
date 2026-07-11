/**
 * StrokeAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — stroke assessment
 * Collection: stroke_assessment
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
  recordStatus: { fontSize: 11, color: '#606060', fontFamily: 'Helvetica-Bold' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
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

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
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

/* isEmptyDeep — for dynamic-key object gating */
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

/* renderObjectNodePDF: recursive dynamic-key object → humanized keys + typed leaves (no [object Object]) */
const renderObjectNodePDF = (key, value, path, depth) => {
  if (isEmptyDeep(value)) return null;
  const padLeft = 8 + depth * 10;
  if (isScalar(value)) {
    return (
      <View key={path} style={[styles.fieldBox, { marginBottom: 4, paddingLeft: depth > 0 ? padLeft : 0 }]}>
        <Text style={styles.nestedSubtitle}>{keyToLabel(key)}</Text>
        <Text style={[styles.fieldValue, { paddingLeft: 8 }]}>{safeString(value)}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={path} style={{ paddingLeft: depth > 0 ? padLeft : 0 }}>
        <Text style={styles.nestedSubtitle}>{keyToLabel(key)}</Text>
        {items.map((v, i) => (
          isScalar(v)
            ? <Text key={i} style={styles.listItem}>{i + 1}. {safeString(v)}</Text>
            : <View key={i}>{renderObjectNodePDF(`${keyToLabel(key)} ${i + 1}`, v, `${path}.${i}`, depth + 1)}</View>
        ))}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={path} style={{ paddingLeft: depth > 0 ? padLeft : 0 }}>
      <Text style={styles.nestedSubtitle}>{keyToLabel(key)}</Text>
      {entries.map(([k, v]) => (
        <View key={k}>{renderObjectNodePDF(k, v, `${path}.${k}`, depth + 1)}</View>
      ))}
    </View>
  );
};

/* renderArrayField */
const renderArrayFieldPDF = (label, items) => {
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
    title: 'Stroke Classification',
    fields: [
      { key: 'strokeType', label: 'Stroke Type', isSentence: true },
      { key: 'territory', label: 'Territory', isSentence: true },
      { key: 'mechanism', label: 'Mechanism', isSentence: true },
      { key: 'nihssScore', label: 'NIHSS Score' },
      { key: 'mrsScore', label: 'MRS Score' },
    ],
  },
  {
    title: 'Thrombolysis',
    isNested: true,
    parentKey: 'thrombolysis',
    fields: [
      { key: 'received', label: 'Received' },
      { key: 'agent', label: 'Agent', isSentence: true },
      { key: 'timing', label: 'Timing', isSentence: true },
      { key: 'response', label: 'Response', isSentence: true },
    ],
  },
  {
    title: 'Thrombectomy',
    isDynamic: true,
    parentKey: 'thrombectomy',
  },
  {
    title: 'Deficits',
    fields: [
      { key: 'deficits', label: 'Deficits', isArray: true },
    ],
  },
  {
    title: 'Secondary Prevention',
    isNested: true,
    parentKey: 'secondaryPrevention',
    fields: [
      { key: 'anticoagulation', label: 'Anticoagulation', isSentence: true },
      { key: 'statins', label: 'Statins', isSentence: true },
      { key: 'bloodPressureControl', label: 'Blood Pressure Control', isSentence: true },
    ],
  },
  {
    title: 'Clinical Details',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    title: 'Results',
    isObject: true,
    parentKey: 'results',
  },
  {
    title: 'Recommendations & Notes',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isArray: true },
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const StrokeAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.stroke_assessment) return Array.isArray(r.stroke_assessment) ? r.stroke_assessment : [r.stroke_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.stroke_assessment) return Array.isArray(dd.stroke_assessment) ? dd.stroke_assessment : [dd.stroke_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Stroke Assessment</Text>
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
          <Text style={styles.documentTitle}>Stroke Assessment</Text>
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
                {record.status && (
                  <Text style={styles.recordStatus}>{record.status}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                Stroke Assessment {index + 1}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              // Dynamic thrombectomy section
              if (sectionConfig.isDynamic) {
                const obj = record[sectionConfig.parentKey];
                if (!obj || typeof obj !== 'object') return null;
                const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && hasVal(v));
                if (entries.length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {entries.map(([k, v], eIdx) => (
                      <View key={eIdx}>{renderFieldRow(keyToLabel(k), v)}</View>
                    ))}
                  </View>
                );
              }

              // Dynamic-key OBJECT section (results) — recursive, humanized keys, typed leaves
              if (sectionConfig.isObject) {
                const obj = record[sectionConfig.parentKey];
                if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
                const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
                if (entries.length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {entries.map(([k, v]) => (
                      <View key={k} wrap={false}>{renderObjectNodePDF(k, v, k, 0)}</View>
                    ))}
                  </View>
                );
              }

              // Nested object sections (thrombolysis, secondaryPrevention)
              if (sectionConfig.isNested) {
                const parentObj = record[sectionConfig.parentKey];
                if (!parentObj || typeof parentObj !== 'object') return null;
                const hasAnyVal = sectionConfig.fields.some(f => hasVal(parentObj[f.key]));
                if (!hasAnyVal) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = parentObj[field.key];
                      if (!hasVal(val)) return null;
                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                      if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                    })}
                  </View>
                );
              }

              // Regular top-level sections
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
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

export default StrokeAssessmentDocumentPDFTemplate;
