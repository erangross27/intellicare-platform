/**
 * RiskFactorsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — risk factors
 * Collection: risk_factors
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
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ';' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* splitItems: semicolon-first (Findings), comma fallback (Plan/Notes) — both paren-aware */
const splitItems = (text) => {
  const semi = splitBySemicolon(text);
  if (semi.length >= 2) return semi;
  return splitByComma(text);
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
const renderSentenceSection = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const showLabel = String(label || '').trim().toLowerCase() !== String(sectionTitle || '').trim().toLowerCase();
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitItems(parsed.value);
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
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
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
    title: 'Risk Factor Details',
    fields: [
      { key: 'factor', label: 'Factor', isSentence: true },
      { key: 'category', label: 'Category', isSentence: true },
      { key: 'severity', label: 'Severity', isSentence: true },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date', isDate: true },
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
    ],
  },
  {
    title: 'Findings',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
    ],
  },
  {
    title: 'Assessment',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const RiskFactorsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.risk_factors) return Array.isArray(r.risk_factors) ? r.risk_factors : [r.risk_factors];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.risk_factors) return Array.isArray(dd.risk_factors) ? dd.risk_factors : [dd.risk_factors]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Risk Factors Assessment</Text>
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
          <Text style={styles.documentTitle}>Risk Factors Assessment</Text>
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
                {`Risk Factors Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Standard Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val, sectionConfig.title)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                  })}
                </View>
              );
            })}

            {/* Recommendations Section */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (() => {
              const groupedByDate = {};
              record.recommendations.forEach((rec) => {
                const recDate = typeof rec === 'object' && rec.date ? formatDate(rec.date) : 'No Date';
                if (!groupedByDate[recDate]) groupedByDate[recDate] = [];
                const recText = typeof rec === 'object' ? (rec.recommendation || '') : rec;
                groupedByDate[recDate].push(recText);
              });
              const dateEntries = Object.entries(groupedByDate);
              const totalItems = record.recommendations.length;
              const wrapProp = totalItems > 8 ? undefined : false;

              return (
                <View style={styles.section} wrap={wrapProp}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {dateEntries.map(([date, items], dateIdx) => (
                    <View key={dateIdx} style={styles.fieldBox}>
                      <Text style={styles.nestedSubtitle}>{safeString(date)}</Text>
                      {items.map((recText, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(recText)}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Results Section */}
            {record.results && typeof record.results === 'object' && Object.keys(record.results).length > 0 && (() => {
              const resultEntries = Object.entries(record.results);
              const wrapProp = resultEntries.length > 8 ? undefined : false;

              return (
                <View style={styles.section} wrap={wrapProp}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultEntries.map(([key, value], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{safeString(key.replace(/_/g, ' ').toUpperCase())}</Text>
                      <Text style={styles.fieldValue}>{safeString(value)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RiskFactorsDocumentPDFTemplate;
