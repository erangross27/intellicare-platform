/**
 * SpecificIgeTestingPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — specific IgE testing
 * Collection: specific_ige_testing
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
  allergenRow: { flexDirection: 'row', marginBottom: 2, marginLeft: 10 },
  allergenName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'capitalize' },
  allergenValue: { fontSize: 11, color: '#000000', marginLeft: 4 },
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

/* renderAllergenSection: object of allergen:value pairs */
const renderAllergenSection = (title, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {entries.map(([allergen, value], idx) => (
        <View key={idx} style={styles.allergenRow}>
          <Text style={styles.allergenName}>{allergen}:</Text>
          <Text style={styles.allergenValue}>{safeString(value)}</Text>
        </View>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Test Information',
    fields: [
      { key: 'testDate', label: 'Test Date', isDate: true },
      { key: 'totalIgE', label: 'Total IgE', isSentence: true },
      { key: 'orderedBy', label: 'Ordered By', isSentence: true },
    ],
  },
];

const ALLERGEN_SECTIONS = [
  { key: 'foods', title: 'Food Allergens' },
  { key: 'inhalants', title: 'Inhalant Allergens' },
  { key: 'venoms', title: 'Venom Allergens' },
  { key: 'drugs', title: 'Drug Allergens' },
  { key: 'occupational', title: 'Occupational Allergens' },
];

/* ======= COMPONENT ======= */
const SpecificIgeTestingPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.specific_ige_testing) return Array.isArray(r.specific_ige_testing) ? r.specific_ige_testing : [r.specific_ige_testing];
      if (r?.specific_ige_tests) return Array.isArray(r.specific_ige_tests) ? r.specific_ige_tests : [r.specific_ige_tests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.specific_ige_testing) return Array.isArray(dd.specific_ige_testing) ? dd.specific_ige_testing : [dd.specific_ige_testing]; if (dd?.specific_ige_tests) return Array.isArray(dd.specific_ige_tests) ? dd.specific_ige_tests : [dd.specific_ige_tests]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Specific IgE Testing Results</Text>
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
          <Text style={styles.documentTitle}>Specific IgE Testing Results</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.testDate && (
                  <Text style={styles.recordDate}>{formatDate(record.testDate)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {record.orderedBy ? `IgE Panel - ${record.orderedBy}` : `IgE Test ${index + 1}`}
              </Text>
            </View>

            {/* Test Information Section */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal2 = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal2) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return (
                      <View key={fIdx} style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                      </View>
                    );
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return (
                      <View key={fIdx} style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Allergen Sections */}
            {ALLERGEN_SECTIONS.map(({ key, title }) => renderAllergenSection(title, record[key]))}

            {/* Interpretation */}
            {hasVal(record.interpretation) && (
              <View style={styles.section}>
                {renderSentenceSection('Interpretation', record.interpretation)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SpecificIgeTestingPDFTemplate;
