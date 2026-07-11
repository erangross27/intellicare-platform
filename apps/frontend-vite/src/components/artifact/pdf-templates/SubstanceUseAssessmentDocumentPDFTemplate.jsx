/**
 * SubstanceUseAssessmentDocumentPDFTemplate.jsx
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

// Helper: split by sentence
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// Helper: check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

// Helper: humanize a dynamic object key (e.g. "auditScore" -> "Audit Score")
const humanizeKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

// Helper: flatten a dynamic-key object (results) one level deep -> { label, value } leaves. No [object Object].
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = humanizeKey(key);
    if (typeof value === 'boolean') {
      items.push({ key, label, value: value ? 'Yes' : 'No' });
    } else if (Array.isArray(value)) {
      items.push({ key, label, value: value.map(v => (v && typeof v === 'object') ? Object.values(v).join(' ') : String(v)).join(', ') });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== null && subValue !== undefined && subValue !== '') {
          items.push({ key: `${key}.${subKey}`, label: `${label} - ${humanizeKey(subKey)}`, value: (subValue && typeof subValue === 'object') ? Object.values(subValue).join(' ') : String(subValue) });
        }
      });
    } else {
      items.push({ key, label, value: String(value) });
    }
  });
  return items;
};

// recommendations subfield order ({recommendation, date} objects or plain strings)
const RECOMMENDATION_SUBFIELDS = [
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'date', label: 'Date', isDate: true },
];

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
  groupBlock: {
    marginBottom: 12,
    marginLeft: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  groupDetail: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
    marginBottom: 2,
  },
});

const SubstanceUseAssessmentDocumentPDFTemplate = ({ document, data }) => {
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
          <Text style={styles.documentTitle}>Substance Use Assessment</Text>
          <Text style={{ textAlign: 'center', color: '#666666' }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Substance Use Assessment</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <Text style={styles.recordTitle}>
              {safeString(`Substance Use Assessment ${idx + 1}`)}
            </Text>
            <Text style={styles.recordMeta}>
              {hasValue(record.date) && `Date: ${formatDate(record.date)}`}
              {record.provider && ` | Provider: ${safeString(record.provider)}`}
              {record.facility && ` | Facility: ${safeString(record.facility)}`}
            </Text>

            {/* Current Use - Pattern 2: Title + First Item Together */}
            {hasValue(record.currentUse) && (() => {
              const items = record.currentUse;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Current Substance Use</Text>
                    <View style={styles.groupBlock}>
                      <Text style={styles.groupTitle}>
                        1. {safeString(firstItem.substance || 'Unknown Substance')}
                      </Text>
                      {hasValue(firstItem.frequency) && (
                        <Text style={styles.groupDetail}>Frequency: {safeString(firstItem.frequency)}</Text>
                      )}
                      {hasValue(firstItem.amount) && (
                        <Text style={styles.groupDetail}>Amount: {safeString(firstItem.amount)}</Text>
                      )}
                      {hasValue(firstItem.lastUse) && (
                        <Text style={styles.groupDetail}>Last Use: {safeString(firstItem.lastUse)}</Text>
                      )}
                      {hasValue(firstItem.route) && (
                        <Text style={styles.groupDetail}>Route: {safeString(firstItem.route)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((item, i) => (
                    <View key={i + 1} style={styles.groupBlock} wrap={false}>
                      <Text style={styles.groupTitle}>
                        {i + 2}. {safeString(item.substance || 'Unknown Substance')}
                      </Text>
                      {hasValue(item.frequency) && (
                        <Text style={styles.groupDetail}>Frequency: {safeString(item.frequency)}</Text>
                      )}
                      {hasValue(item.amount) && (
                        <Text style={styles.groupDetail}>Amount: {safeString(item.amount)}</Text>
                      )}
                      {hasValue(item.lastUse) && (
                        <Text style={styles.groupDetail}>Last Use: {safeString(item.lastUse)}</Text>
                      )}
                      {hasValue(item.route) && (
                        <Text style={styles.groupDetail}>Route: {safeString(item.route)}</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Past Use - Pattern 2: Title + First Item Together */}
            {hasValue(record.pastUse) && (() => {
              const items = record.pastUse;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Past Substance Use</Text>
                    <View style={styles.groupBlock}>
                      <Text style={styles.groupTitle}>
                        1. {safeString(firstItem.substance || 'Unknown Substance')}
                      </Text>
                      {hasValue(firstItem.ageStarted) && (
                        <Text style={styles.groupDetail}>Age Started: {safeString(firstItem.ageStarted)}</Text>
                      )}
                      {hasValue(firstItem.duration) && (
                        <Text style={styles.groupDetail}>Duration: {safeString(firstItem.duration)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((item, i) => (
                    <View key={i + 1} style={styles.groupBlock} wrap={false}>
                      <Text style={styles.groupTitle}>
                        {i + 2}. {safeString(item.substance || 'Unknown Substance')}
                      </Text>
                      {hasValue(item.ageStarted) && (
                        <Text style={styles.groupDetail}>Age Started: {safeString(item.ageStarted)}</Text>
                      )}
                      {hasValue(item.duration) && (
                        <Text style={styles.groupDetail}>Duration: {safeString(item.duration)}</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Withdrawal Symptoms - Pattern 2: Title + First Item Together */}
            {hasValue(record.withdrawalSymptoms) && (() => {
              const items = record.withdrawalSymptoms;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Withdrawal Symptoms</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((symptom, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(symptom)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Treatment History - Pattern 2: Title + First Item Together */}
            {hasValue(record.treatmentHistory) && (() => {
              const items = record.treatmentHistory;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Treatment History</Text>
                    <View style={styles.groupBlock}>
                      <Text style={styles.groupTitle}>
                        1. {safeString(firstItem.type || 'Treatment')}
                      </Text>
                      {hasValue(firstItem.facility) && (
                        <Text style={styles.groupDetail}>Facility: {safeString(firstItem.facility)}</Text>
                      )}
                      {hasValue(firstItem.dates) && (
                        <Text style={styles.groupDetail}>Dates: {safeString(firstItem.dates)}</Text>
                      )}
                      {hasValue(firstItem.outcome) && (
                        <Text style={styles.groupDetail}>Outcome: {safeString(firstItem.outcome)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((item, i) => (
                    <View key={i + 1} style={styles.groupBlock} wrap={false}>
                      <Text style={styles.groupTitle}>
                        {i + 2}. {safeString(item.type || 'Treatment')}
                      </Text>
                      {hasValue(item.facility) && (
                        <Text style={styles.groupDetail}>Facility: {safeString(item.facility)}</Text>
                      )}
                      {hasValue(item.dates) && (
                        <Text style={styles.groupDetail}>Dates: {safeString(item.dates)}</Text>
                      )}
                      {hasValue(item.outcome) && (
                        <Text style={styles.groupDetail}>Outcome: {safeString(item.outcome)}</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Screening */}
            {(record.duidHistory !== undefined || record.cageScore !== undefined) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Screening</Text>
                {record.duidHistory !== undefined && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>DUID History:</Text>
                    <Text style={styles.fieldValue}>{record.duidHistory ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {record.cageScore !== undefined && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>CAGE Score:</Text>
                    <Text style={styles.fieldValue}>{String(record.cageScore)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Findings - Pattern 2: Title + First Item Together */}
            {hasValue(record.findings) && (() => {
              const items = splitBySentence(record.findings);
              if (items.length === 0) return null;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((sentence, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(sentence)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Assessment - Pattern 2: Title + First Item Together */}
            {hasValue(record.assessment) && (() => {
              const items = splitBySentence(record.assessment);
              if (items.length === 0) return null;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((sentence, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(sentence)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Plan - Pattern 2: Title + First Item Together */}
            {hasValue(record.plan) && (() => {
              const items = splitBySentence(record.plan);
              if (items.length === 0) return null;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  {/* Title + first item wrapped together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Plan</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {/* Rest flows naturally */}
                  {restItems.map((sentence, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>
                      {i + 2}. {safeString(sentence)}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations - object-array {recommendation, date} or plain strings; flatten readable */}
            {hasValue(record.recommendations) && (() => {
              const items = (record.recommendations || []).filter(it => it !== null && it !== undefined && it !== '');
              if (items.length === 0) return null;
              const knownKeys = RECOMMENDATION_SUBFIELDS.map(sf => sf.key);
              return (
                <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {items.map((item, i) => {
                    if (typeof item !== 'object' || item === null) {
                      return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
                    }
                    const allDefs = [...RECOMMENDATION_SUBFIELDS, ...Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }))];
                    const parts = allDefs
                      .filter(sf => hasValue(item[sf.key]))
                      .map(sf => `${sf.label}: ${sf.isDate ? formatDate(item[sf.key]) : safeString(item[sf.key])}`);
                    return <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' | ')}</Text>;
                  })}
                </View>
              );
            })()}

            {/* Results - dynamic-key object -> humanized label + value per leaf; no [object Object] */}
            {hasValue(record.results) && (() => {
              const items = flattenObject(record.results);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {items.map((item, i) => (
                    <View key={i} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{safeString(item.label)}:</Text>
                      <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Status */}
            {hasValue(record.status) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
              </View>
            )}

            {/* Notes */}
            {hasValue(record.notes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SubstanceUseAssessmentDocumentPDFTemplate;
