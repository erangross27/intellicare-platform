import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * TourniquetDataDocumentPDFTemplate
 *
 * PDF export template for tourniquet data records.
 * Uses Helvetica font, LETTER size, 20pt/12pt
 * Black & white only - no decorative elements
 *
 * March 2026 - Following PDF template standard
 */

// PDF Styles - Helvetica font, LETTER, 20pt/12pt
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottom: '1px solid #999999',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 12,
    lineHeight: 1.4,
    paddingLeft: 16,
    marginBottom: 4,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
    marginBottom: 1,
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
});

// Humanize object keys for the results object
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Deep-empty check
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return safeString(v ?? ''); };

// Recursive object node: label = bold heading; value = plain line below
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

// Count rows for the Rule #74 wrap heuristic
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

// Safe string conversion with Unicode sanitization
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str;
  if (typeof val === 'string') str = val;
  else if (typeof val === 'object') str = JSON.stringify(val);
  else str = String(val);

  // Replace problematic Unicode characters with ASCII equivalents
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/μ/g, 'u');
  str = str.replace(/µ/g, 'u');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/←/g, '<-');

  return str;
};

// Format date
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return safeString(dateValue);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return safeString(dateValue);
  }
};

// Check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

// Split by sentence
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const prepared = text
    .replace(/Dr\./g, 'Dr_DOT_')
    .replace(/Mr\./g, 'Mr_DOT_')
    .replace(/Mrs\./g, 'Mrs_DOT_')
    .replace(/Ms\./g, 'Ms_DOT_')
    .replace(/Prof\./g, 'Prof_DOT_')
    .replace(/vs\./g, 'vs_DOT_')
    .replace(/etc\./g, 'etc_DOT_');

  const sentences = prepared.split(/(?<=[.!?])\s+/).map(s =>
    s.replace(/Dr_DOT_/g, 'Dr.')
     .replace(/Mr_DOT_/g, 'Mr.')
     .replace(/Mrs_DOT_/g, 'Mrs.')
     .replace(/Ms_DOT_/g, 'Ms.')
     .replace(/Prof_DOT_/g, 'Prof.')
     .replace(/vs_DOT_/g, 'vs.')
     .replace(/etc_DOT_/g, 'etc.')
     .trim()
  ).filter(s => s.length > 0);

  return sentences;
};

const TourniquetDataDocumentPDFTemplate = ({ document, data }) => {
  // CRITICAL: Accept BOTH document AND data props (same as JSX!)
  const templateData = document || data;

  // Handle empty/null data
  if (!templateData) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Tourniquet Data</Text>
          <Text style={styles.noData}>No tourniquet data available.</Text>
        </Page>
      </Document>
    );
  }

  // Unwrap data (same pattern as JSX)
  let records = Array.isArray(templateData) ? templateData : [templateData];

  records = records.flatMap(record => {
    if (record?._records && Array.isArray(record._records)) return record._records;
    if (record?.records && Array.isArray(record.records) && !record.date && !record.pressure) return record.records;
    if (record?.tourniquet_data && Array.isArray(record.tourniquet_data)) return record.tourniquet_data;
    return record;
  });

  records = records.filter(record =>
    record && (record.date || record.pressure || record.duration || record.location || record.provider || typeof record.used === 'boolean' || (record.results && typeof record.results === 'object'))
  );

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Tourniquet Data</Text>
          <Text style={styles.noData}>No tourniquet data records found.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Tourniquet Data</Text>

        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>Tourniquet Data {recordIndex + 1}</Text>

            {/* Study Information */}
            {(hasValue(record.date) || hasValue(record.provider) || hasValue(record.facility) || hasValue(record.status)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Study Information</Text>

                {hasValue(record.date) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Date:</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                  </View>
                )}

                {hasValue(record.provider) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}

                {hasValue(record.facility) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}

                {hasValue(record.status) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Status:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Tourniquet Parameters */}
            {(typeof record.used === 'boolean' || hasValue(record.pressure) || hasValue(record.duration) || hasValue(record.location)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Tourniquet Parameters</Text>

                {typeof record.used === 'boolean' && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Used:</Text>
                    <Text style={styles.fieldValue}>{record.used ? 'Yes' : 'No'}</Text>
                  </View>
                )}

                {hasValue(record.pressure) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Pressure:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.pressure)}</Text>
                  </View>
                )}

                {hasValue(record.duration) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Duration:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.duration)}</Text>
                  </View>
                )}

                {hasValue(record.location) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Location:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.location)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Notes */}
            {hasValue(record.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {splitBySentence(record.notes).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Findings */}
            {hasValue(record.findings) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Findings</Text>
                {splitBySentence(record.findings).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Results (OBJECT, recursive) */}
            {hasValue(record.results) && typeof record.results === 'object' && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              if (entries.length === 0) return null;
              return entries.map(([k, v], i) => {
                const rows = countRows(v);
                return (
                  <View key={`results-${k}`} style={styles.section} wrap={rows > 8 ? undefined : false}>
                    {i === 0 ? <Text style={styles.sectionTitle}>Results</Text> : null}
                    {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
                  </View>
                );
              });
            })()}

            {/* Assessment */}
            {hasValue(record.assessment) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                {splitBySentence(record.assessment).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Plan */}
            {hasValue(record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {splitBySentence(record.plan).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {hasValue(record.recommendations) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {(record.recommendations || []).map((rec, idx) => {
                  const recText = typeof rec === 'string' ? rec : safeString(rec.recommendation);
                  return (
                    <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(recText)}</Text>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TourniquetDataDocumentPDFTemplate;
