/**
 * RadiologyFindingsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — radiology findings
 * Collection: radiology_findings
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
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  findingGroup: { marginLeft: 10, marginBottom: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#858585', borderLeftStyle: 'solid' },
  findingHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#858585', marginBottom: 6 },
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

/* humanizeKey: dynamic-key -> readable label */
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/* leafToString: typed leaf -> display string (no [object Object]) */
const leafToString = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && v.$date) return formatDate(v.$date);
  return String(v);
};

/* flattenObject: recursively flatten a dynamic-key object into [{ label, value }] leaves (content-gated) */
const flattenObject = (obj, parentLabel = '') => {
  const rows = [];
  if (!obj || typeof obj !== 'object') return rows;
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const label = parentLabel ? `${parentLabel} — ${humanizeKey(key)}` : humanizeKey(key);
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'object' && !val.$date) {
      if (Array.isArray(val)) {
        const flat = val.filter(item => item !== null && item !== undefined && item !== '');
        if (flat.length === 0) return;
        const allPrimitive = flat.every(item => typeof item !== 'object' || item === null);
        if (allPrimitive) {
          rows.push({ label, value: flat.map(leafToString).join(', ') });
        } else {
          flat.forEach((item, i) => {
            if (item && typeof item === 'object') rows.push(...flattenObject(item, `${label} ${i + 1}`));
            else rows.push({ label: `${label} ${i + 1}`, value: leafToString(item) });
          });
        }
      } else {
        if (Object.keys(val).length === 0) return;
        rows.push(...flattenObject(val, label));
      }
    } else {
      const sv = leafToString(val);
      if (sv.trim() === '') return;
      rows.push({ label, value: sv });
    }
  });
  return rows;
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

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Study Information',
    fields: [
      { key: 'modalityUsed', label: 'Modality', isSentence: true },
      { key: 'date', label: 'Date', isDate: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
    ],
  },
  {
    title: 'Technique',
    fields: [
      { key: 'technique', label: 'Technique', isSentence: true },
    ],
  },
  {
    title: 'Contrast Information',
    isNested: true,
    nestedKey: 'contrast',
    fields: [
      { key: 'type', label: 'Contrast Type', isSentence: true },
      { key: 'amount', label: 'Amount', isSentence: true },
      { key: 'reaction', label: 'Reaction', isSentence: true },
    ],
  },
  {
    title: 'Comparison',
    fields: [
      { key: 'comparison', label: 'Comparison', isSentence: true },
    ],
  },
  {
    title: 'Impression',
    fields: [
      { key: 'impression', label: 'Impression', isSentence: true },
    ],
  },
  {
    title: 'RADS Scores',
    fields: [
      { key: 'biRads', label: 'BI-RADS' },
      { key: 'tirads', label: 'TI-RADS' },
      { key: 'pirads', label: 'PI-RADS' },
    ],
  },
  {
    title: 'Clinical Summary',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'notes', label: 'Notes', isSentence: true },
      { key: 'status', label: 'Status' },
    ],
  },
];

/* ======= COMPONENT ======= */
const RadiologyFindingsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.radiology_findings) return Array.isArray(r.radiology_findings) ? r.radiology_findings : [r.radiology_findings];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiology_findings) return Array.isArray(dd.radiology_findings) ? dd.radiology_findings : [dd.radiology_findings]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Radiology Findings</Text>
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
          <Text style={styles.documentTitle}>Radiology Findings</Text>
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
                {record.modalityUsed || `Radiology Finding ${index + 1}`}
              </Text>
            </View>

            {/* Standard Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              if (sectionConfig.isNested) {
                const nestedObj = record[sectionConfig.nestedKey];
                if (!nestedObj || typeof nestedObj !== 'object') return null;
                const hasAnyVal = sectionConfig.fields.some(f => hasVal(nestedObj[f.key]));
                if (!hasAnyVal) return null;

                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = nestedObj[field.key];
                      if (!hasVal(val)) return null;
                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                    })}
                  </View>
                );
              }

              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;
                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                  })}
                </View>
              );
            })}

            {/* Results (dynamic-key object, flattened with humanized keys + typed leaves) */}
            {(() => {
              const resultRows = flattenObject(record.results);
              if (resultRows.length === 0) return null;
              return (
                <View style={styles.section} wrap={resultRows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultRows.map((row, i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{row.label}</Text>
                      <Text style={styles.fieldValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Imaging Findings */}
            {record.findings && Array.isArray(record.findings) && record.findings.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Imaging Findings</Text>
                </View>
                {record.findings.filter(Boolean).map((finding, fIdx) => (
                  <View key={fIdx} style={styles.findingGroup}>
                    <Text style={styles.findingHeader}>{finding.finding || `Finding ${fIdx + 1}`}</Text>
                    {finding.anatomicLocation && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>ANATOMIC LOCATION</Text>
                        <Text style={styles.fieldValue}>{finding.anatomicLocation}</Text>
                      </View>
                    )}
                    {finding.size && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>SIZE</Text>
                        <Text style={styles.fieldValue}>{finding.size}</Text>
                      </View>
                    )}
                    {finding.characteristics && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>CHARACTERISTICS</Text>
                        <Text style={styles.fieldValue}>{finding.characteristics}</Text>
                      </View>
                    )}
                    {finding.significance && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>SIGNIFICANCE</Text>
                        <Text style={styles.fieldValue}>{finding.significance}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (() => {
              const validRecs = record.recommendations.filter(Boolean);
              if (validRecs.length === 0) return null;
              const firstRec = validRecs[0];
              const remainingRecs = validRecs.slice(1);

              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    <View style={{ marginBottom: 4 }}>
                      {typeof firstRec === 'object' ? (
                        <>
                          {firstRec.date && (
                            <Text style={{ fontSize: 10, color: '#666666', marginBottom: 2, marginLeft: 10 }}>
                              {formatDate(firstRec.date)}
                            </Text>
                          )}
                          <Text style={styles.listItem}>1. {firstRec.recommendation || 'N/A'}</Text>
                        </>
                      ) : (
                        <Text style={styles.listItem}>1. {firstRec}</Text>
                      )}
                    </View>
                  </View>
                  {remainingRecs.map((rec, rIdx) => (
                    <View key={rIdx} style={{ marginBottom: 4 }}>
                      {typeof rec === 'object' ? (
                        <>
                          {rec.date && (
                            <Text style={{ fontSize: 10, color: '#666666', marginBottom: 2, marginLeft: 10 }}>
                              {formatDate(rec.date)}
                            </Text>
                          )}
                          <Text style={styles.listItem}>{rIdx + 2}. {rec.recommendation || 'N/A'}</Text>
                        </>
                      ) : (
                        <Text style={styles.listItem}>{rIdx + 2}. {rec}</Text>
                      )}
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

export default RadiologyFindingsDocumentPDFTemplate;
