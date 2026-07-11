/**
 * PreventiveCareDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — preventive care
 * Collection: preventive_care
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
  recordProvider: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica', marginTop: 2 },
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

const IMMUNIZATION_LABELS = {
  influenza: 'Influenza', pneumococcal: 'Pneumococcal', covid19: 'COVID-19', zoster: 'Zoster', other: 'Other',
};
const humanizeKey = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/* renderObjectSection: dynamic-key object → label + per-key rows (arrays flatten to numbered items) */
const renderObjectSection = (label, obj, keyLabeler) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  const rows = [];
  entries.forEach(([k, v]) => {
    const subLabel = keyLabeler ? keyLabeler(k) : k;
    if (Array.isArray(v)) {
      const items = v.filter(hasVal);
      if (items.length === 0) return;
      rows.push({ type: 'subtitle', text: safeString(subLabel) });
      items.forEach((item, i) => rows.push({ type: 'item', text: safeString(fmtVal(item)), num: i + 1 }));
    } else {
      rows.push({ type: 'pair', text: `${subLabel}: ${safeString(fmtVal(v))}` });
    }
  });
  if (rows.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        if (row.type === 'item') return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
        return <Text key={i} style={styles.fieldValue}>{row.text}</Text>;
      })}
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

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Cancer Screenings',
    fields: [
      { key: 'colonoscopyDueAge', label: 'Colonoscopy', isSentence: true },
      { key: 'mammographyStatus', label: 'Mammography', isSentence: true },
      { key: 'cervicalScreeningStatus', label: 'Cervical Screening', isSentence: true },
      { key: 'lungCancerScreening', label: 'Lung Cancer Screening', isSentence: true },
      { key: 'prostateCancerScreening', label: 'Prostate Cancer Screening', isSentence: true },
      { key: 'aaaScreening', label: 'AAA Screening', isSentence: true },
    ],
  },
  {
    title: 'Mental Health & Substance Use Screenings',
    fields: [
      { key: 'depressionScreening', label: 'Depression Screening', isSentence: true },
      { key: 'alcoholScreening', label: 'Alcohol Screening', isSentence: true },
    ],
  },
  {
    title: 'Immunizations',
    fields: [
      { key: 'immunizations', label: 'Immunizations', isImmunizations: true },
    ],
  },
  {
    title: 'General Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
    ],
  },
  {
    title: 'Clinical Details',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    title: 'Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isRecommendations: true },
    ],
  },
  {
    title: 'Results & Notes',
    fields: [
      { key: 'results', label: 'Results', isResults: true },
      { key: 'notes', label: 'Notes', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
];

/* get nested field value */
const getNestedVal = (record, key) => {
  if (key.includes('.')) {
    const parts = key.split('.');
    let val = record;
    for (const p of parts) { val = val?.[p]; }
    return val;
  }
  return record[key];
};

/* ======= COMPONENT ======= */
const PreventiveCareDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.preventive_care) return Array.isArray(r.preventive_care) ? r.preventive_care : [r.preventive_care];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.preventive_care) return Array.isArray(dd.preventive_care) ? dd.preventive_care : [dd.preventive_care]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Preventive Care</Text>
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
          <Text style={styles.documentTitle}>Preventive Care</Text>
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
                {`Preventive Care Record ${index + 1}`}
              </Text>
              {record.provider && (
                <Text style={styles.recordProvider}>{record.provider}</Text>
              )}
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyFieldVal = sectionConfig.fields.some(f => hasVal(getNestedVal(record, f.key)));
              if (!hasAnyFieldVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = getNestedVal(record, field.key);
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isRecommendations) {
                      const recs = Array.isArray(val) ? val.filter(Boolean) : [];
                      if (recs.length === 0) return null;
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
                          <Text style={styles.fieldLabel}>{field.label}</Text>
                          {recs.map((rec, rIdx) => {
                            const recText = typeof rec === 'object' && rec.recommendation
                              ? `${rec.recommendation}${rec.date ? ` (${formatDate(rec.date)})` : ''}`
                              : safeString(rec);
                            return <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {recText}</Text>;
                          })}
                        </View>
                      );
                    }
                    if (field.isImmunizations) {
                      return <View key={fIdx}>{renderObjectSection(field.label, val, (k) => IMMUNIZATION_LABELS[k] || humanizeKey(k))}</View>;
                    }
                    if (field.isResults) {
                      if (val && typeof val === 'object' && !Array.isArray(val)) {
                        return <View key={fIdx}>{renderObjectSection(field.label, val, (k) => k)}</View>;
                      }
                      return <View key={fIdx}>{renderFieldRow(field.label, fmtVal(val))}</View>;
                    }
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

export default PreventiveCareDocumentPDFTemplate;
