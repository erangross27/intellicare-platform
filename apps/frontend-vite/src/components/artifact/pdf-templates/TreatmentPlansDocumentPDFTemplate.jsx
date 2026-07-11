/**
 * TreatmentPlansDocumentPDFTemplate.jsx
 * December 2025 Standard - Black and White Only
 * Helvetica font, 14pt minimum body text
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Helper: sanitize Unicode for Helvetica
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  return str;
};

// Helper: format date
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
};

// Helper: check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

// Helper: humanize a dynamic object key into a readable label
const humanizeKey = (key) => {
  if (!key) return '';
  let s = String(key).replace(/[_-]+/g, ' ');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  s = s.replace(/\s+/g, ' ').trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
};

// Helper: flatten an intervention value (string or string[]) to display lines
const interventionLines = (val) => {
  if (Array.isArray(val)) return val.filter((v) => hasValue(v)).map((v) => String(v));
  if (hasValue(val)) return [String(val)];
  return [];
};

// Helper: parse Day labels
const parseDayLabels = (text) => {
  if (!text || typeof text !== 'string') return [{ label: null, content: text }];

  const dayPattern = /Day\s+\d+:/gi;
  const matches = [...text.matchAll(dayPattern)];

  if (matches.length === 0) {
    return [{ label: null, content: text.trim() }];
  }

  const results = [];
  matches.forEach((match, idx) => {
    const label = match[0].replace(':', '').trim();
    const startIdx = match.index + match[0].length;
    const endIdx = idx + 1 < matches.length ? matches[idx + 1].index : text.length;
    const content = text.substring(startIdx, endIdx).trim().replace(/\.$/, '');

    if (content) {
      results.push({ label, content });
    }
  });

  return results.length > 0 ? results : [{ label: null, content: text.trim() }];
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 8,
    color: '#000000',
  },
  fieldBlock: {
    marginBottom: 8,
    marginLeft: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 12,
  },
  dayBlock: {
    marginBottom: 8,
    marginLeft: 12,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
});

const TreatmentPlansDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data
  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Treatment Plans</Text>
          <Text style={{ textAlign: 'center', color: '#666666' }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Treatment Plans</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <Text style={styles.recordTitle}>
              {safeString(`Treatment Plan ${idx + 1}`)}
            </Text>
            <Text style={styles.recordMeta}>
              {hasValue(record.date) && `Date: ${formatDate(record.date)}`}
              {record.provider && ` | Provider: ${safeString(record.provider)}`}
              {record.specialty && ` | Specialty: ${safeString(record.specialty)}`}
            </Text>

            {/* Short-Term Goals - Pattern 2 */}
            {hasValue(record.shortTermGoals) && (() => {
              const items = record.shortTermGoals;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Short-Term Goals</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((goal, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(goal)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Long-Term Goals - Pattern 2 */}
            {hasValue(record.longTermGoals) && (() => {
              const items = record.longTermGoals;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Long-Term Goals</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((goal, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(goal)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Immediate Interventions (dynamic-key object) */}
            {hasValue(record.immediateInterventions) && (() => {
              const interventions = record.immediateInterventions;
              const keys = Object.keys(interventions).filter((k) => hasValue(interventions[k]));
              if (keys.length === 0) return null;
              return (
                <View style={styles.section}>
                  {keys.map((k, kIdx) => {
                    const label = humanizeKey(k);
                    const vals = interventionLines(interventions[k]);
                    return (
                      <View key={k} wrap={vals.length > 8 ? undefined : false}>
                        {kIdx === 0 && <Text style={styles.sectionTitle}>Immediate Interventions</Text>}
                        <Text style={styles.subsectionTitle}>{safeString(label)}</Text>
                        {vals.length === 1 ? (
                          <Text style={styles.fieldValue}>{safeString(vals[0])}</Text>
                        ) : (
                          vals.map((v, i) => (
                            <Text key={i} style={styles.listItem}>
                              {i + 1}. {safeString(v)}
                            </Text>
                          ))
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Pending Procedures - Pattern 2 */}
            {hasValue(record.pendingProcedures) && (() => {
              const items = record.pendingProcedures;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Pending Procedures</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((proc, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(proc)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Rehabilitation Referrals - Pattern 2 */}
            {hasValue(record.rehabilitationReferrals) && (() => {
              const items = record.rehabilitationReferrals;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Rehabilitation Referrals</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((ref, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(ref)}
                    </Text>
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

export default TreatmentPlansDocumentPDFTemplate;
