/**
 * WorkRestrictionsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — work restrictions
 * Collection: work_restrictions
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
  return safeString(v);
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

/* ======= SECTION DEFINITIONS ======= */
const SECTION_FIELDS = {
  'clinical-findings': ['findings', 'assessment'],
  'restrictions-details': ['restrictions', 'liftingLimit', 'returnToWork', 'duration', 'clearanceRequired', 'modifiedDuty'],
  'plan-recommendations': ['plan', 'recommendations', 'results'],
  'provider-info': ['provider', 'facility'],
  'additional-notes': ['notes'],
};

const SECTION_TITLES = {
  'clinical-findings': 'Clinical Findings',
  'restrictions-details': 'Restrictions Details',
  'plan-recommendations': 'Plan & Recommendations',
  'provider-info': 'Provider Information',
  'additional-notes': 'Additional Notes',
};

const FIELD_LABELS = {
  findings: 'Findings',
  assessment: 'Assessment',
  restrictions: 'Restrictions',
  liftingLimit: 'Lifting Limit',
  returnToWork: 'Return to Work',
  duration: 'Duration',
  clearanceRequired: 'Clearance Required',
  modifiedDuty: 'Modified Duty',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  provider: 'Provider',
  facility: 'Facility',
  notes: 'Notes',
};

const BOOLEAN_FIELDS = ['clearanceRequired'];
const ARRAY_FIELDS = ['restrictions', 'recommendations'];
const OBJECT_FIELDS = ['modifiedDuty', 'results'];

/* humanizeKey: accommodations -> Accommodations, gradualReturn -> Gradual Return */
const humanizeKey = (key) => {
  if (!key || typeof key !== 'string') return String(key || '');
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (BOOLEAN_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }

  if (OBJECT_FIELDS.includes(fn)) {
    if (typeof val !== 'object' || Array.isArray(val)) return null;
    /* Flatten one level so nested dynamic-key objects don't render "[object Object]" */
    const rows = [];
    Object.entries(val).forEach(([subKey, subVal]) => {
      if (!hasVal(subVal)) return;
      if (subVal && typeof subVal === 'object' && !Array.isArray(subVal) && !subVal.$date) {
        Object.entries(subVal).forEach(([k2, v2]) => {
          if (hasVal(v2)) rows.push({ label: `${humanizeKey(subKey)} - ${humanizeKey(k2)}`, value: fmtVal(v2) });
        });
      } else {
        rows.push({ label: humanizeKey(subKey), value: fmtVal(subVal) });
      }
    });
    if (rows.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox} wrap={rows.length > 8 ? undefined : false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {rows.map((row, i) => (
          <Text key={i} style={styles.listItem}>{row.label}: {row.value}</Text>
        ))}
      </View>
    );
  }

  /* String field with sentence splitting */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);

  if (sentences.length > 1) {
    let counter = 1;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            if (commaItems.length >= 2) {
              const items = commaItems.map((ci, ciIdx) => (
                <Text key={`${sIdx}-c-${ciIdx}`} style={styles.listItem}>{counter++}. {ci}</Text>
              ));
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  {items}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                <Text style={styles.listItem}>{counter++}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{counter++}. {sentence}</Text>;
        })}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const WorkRestrictionsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.work_restrictions && Array.isArray(data.work_restrictions)) {
    records = data.work_restrictions;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.work_restrictions) {
      records = Array.isArray(docData.work_restrictions) ? docData.work_restrictions : [docData.work_restrictions];
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Work Restrictions</Text>
          </View>
          <Text style={styles.noDataText}>No work restrictions data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Work Restrictions</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
                {hasVal(record.status) && <Text style={styles.recordDate}>Status: {record.status}</Text>}
              </View>
              <Text style={styles.recordTitle}>{record.type ? `Work Restrictions ${idx + 1} - ${record.type}` : `Work Restrictions ${idx + 1}`}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => {
              const fields = SECTION_FIELDS[sid];
              const hasAny = fields.some(f => hasVal(record[f]));
              if (!hasAny) return null;
              return (
                <View key={sid} style={styles.section}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {fields.map(f => renderField(record, f))}
                </View>
              );
            })}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default WorkRestrictionsDocumentPDFTemplate;
