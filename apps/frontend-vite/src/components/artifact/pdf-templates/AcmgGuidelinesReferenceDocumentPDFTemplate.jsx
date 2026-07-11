/**
 * AcmgGuidelinesReferenceDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — NO BLUE
 * Collection: acmg_guidelines_reference
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?:\.|;)(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* renderFieldRow: label + value inside fieldBox (isDate => format as date) */
const renderFieldRow = (label, value, isDate) => {
  if (!hasVal(value)) return null;
  const display = isDate ? formatDate(value) : safeString(fmtVal(value));
  return (
    <View style={styles.fieldBox}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Text style={styles.fieldValue}>{display}</Text>
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
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
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
    title: 'Provider Information',
    fields: [
      { key: 'provider', label: 'Provider' },
    ],
  },
  {
    title: 'Date',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
    ],
  },
  {
    title: 'Guideline Topic',
    fields: [
      { key: 'guidelineTopic', label: 'Guideline Topic' },
    ],
  },
  {
    title: 'Guideline Version',
    fields: [
      { key: 'guidelineVersion', label: 'Guideline Version' },
    ],
  },
  {
    title: 'Variant Classification',
    fields: [
      { key: 'variantClassification', label: 'Variant Classification' },
    ],
  },
  {
    title: 'Evidence Level',
    fields: [
      { key: 'evidenceLevel', label: 'Evidence Level' },
    ],
  },
  {
    title: 'Clinical Recommendations',
    fields: [
      { key: 'clinicalRecommendations', label: 'Clinical Recommendations', isSentence: true },
    ],
  },
  {
    title: 'Screening Guidelines',
    fields: [
      { key: 'screeningGuidelines', label: 'Screening Guidelines', isSentence: true },
    ],
  },
  {
    title: 'Applicability',
    fields: [
      { key: 'applicability', label: 'Applicability', isSentence: true },
    ],
  },
  {
    title: 'Reference URL',
    fields: [
      { key: 'referenceUrl', label: 'Reference URL' },
    ],
  },
  {
    title: 'Additional Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const AcmgGuidelinesReferenceDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.acmg_guidelines_reference) return Array.isArray(r.acmg_guidelines_reference) ? r.acmg_guidelines_reference : [r.acmg_guidelines_reference];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.acmg_guidelines_reference) return Array.isArray(dd.acmg_guidelines_reference) ? dd.acmg_guidelines_reference : [dd.acmg_guidelines_reference]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>ACMG Guidelines Reference</Text>
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
          <Text style={styles.documentTitle}>ACMG Guidelines Reference</Text>
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
                {`ACMG Guideline ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;
                    const _first = !_t; _t = true;
                    // Mirror JSX: hide the field label when it duplicates the section title (case-insensitive)
                    const _showLabel = String(field.label).trim().toLowerCase() !== String(sectionConfig.title).trim().toLowerCase();
                    const _label = _showLabel ? field.label : null;
                    const _el = field.isSentence ? renderSentenceSection(_label, val) : renderFieldRow(_label, val, field.isDate);
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

export default AcmgGuidelinesReferenceDocumentPDFTemplate;
