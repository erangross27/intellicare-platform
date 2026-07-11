/**
 * SleepDisturbancesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sleep disturbances
 * Collection: sleep_disturbances
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
  return true;
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

/* humanizeKey: object-key -> readable label */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* Flatten a dynamic-key object into indented {label, value} lines for the PDF */
const flattenObjectLines = (obj) => {
  const lines = [];
  const walk = (o, depth) => {
    Object.entries(o).forEach(([k, v]) => {
      if (isEmptyDeep(v)) return;
      const indent = '   '.repeat(depth);
      if (isScalar(v)) lines.push(`${indent}${humanizeKey(k)}: ${fmtScalar(v)}`);
      else if (Array.isArray(v)) {
        const scalars = v.filter(x => !isEmptyDeep(x));
        if (scalars.every(isScalar)) lines.push(`${indent}${humanizeKey(k)}: ${scalars.map(fmtScalar).join(', ')}`);
        else { lines.push(`${indent}${humanizeKey(k)}:`); scalars.forEach((it, i) => { if (isScalar(it)) lines.push(`${indent}   ${i + 1}. ${fmtScalar(it)}`); else walk(it, depth + 1); }); }
      } else { lines.push(`${indent}${humanizeKey(k)}:`); walk(v, depth + 1); }
    });
  };
  if (obj && typeof obj === 'object') walk(obj, 0);
  return lines;
};

/* ======= FIELD RENDERING ======= */
const renderFieldBox = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = safeString(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldBox(label, value);

  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

const renderArrayField = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.filter(Boolean).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const SleepDisturbancesDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0]?.records) records = docProp[0].records;
    else if (docProp.length > 0 && docProp[0]?._records) records = docProp[0]._records;
    else records = docProp;
  } else if (docProp?.records) {
    records = docProp.records;
  } else if (docProp?._records) {
    records = docProp._records;
  } else if (docProp) {
    records = [docProp];
  }

  const validRecords = Array.isArray(records) ? records.filter(r => r && typeof r === 'object') : [];

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sleep Disturbances</Text>
          </View>
          <Text style={styles.noDataText}>No sleep disturbances data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sleep Disturbances</Text>
        </View>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{record.description || `Sleep Disturbances ${idx + 1}`}</Text>
            </View>

            {/* Assessment Information */}
            {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment Information</Text>
                {renderFieldBox('Date', hasVal(record.date) ? formatDate(record.date) : null)}
                {renderFieldBox('Provider', record.provider)}
                {renderFieldBox('Facility', record.facility)}
              </View>
            )}

            {/* Sleep Disturbance Overview */}
            {(hasVal(record.present) || hasVal(record.status) || hasVal(record.type)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sleep Disturbance Overview</Text>
                {hasVal(record.present) && renderFieldBox('Present', record.present ? 'Yes' : 'No')}
                {renderFieldBox('Status', record.status)}
                {renderFieldBox('Type', record.type)}
              </View>
            )}

            {/* Description */}
            {hasVal(record.description) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                {renderSentenceField('Description', record.description)}
              </View>
            )}

            {/* Causes */}
            {hasVal(record.causes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Causes</Text>
                {renderArrayField('Causes', record.causes)}
              </View>
            )}

            {/* Interventions */}
            {hasVal(record.interventions) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interventions</Text>
                {renderArrayField('Interventions', record.interventions)}
              </View>
            )}

            {/* Clinical Findings & Assessment */}
            {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Findings & Assessment</Text>
                {renderSentenceField('Clinical Findings', record.findings)}
                {renderSentenceField('Assessment', record.assessment)}
                {renderSentenceField('Plan', record.plan)}
              </View>
            )}

            {/* Results (dynamic-key object) */}
            {hasVal(record.results) && (() => {
              const resultLines = flattenObjectLines(record.results);
              if (resultLines.length === 0) return null;
              return (
                <View style={styles.section} wrap={resultLines.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultLines.map((line, lIdx) => (
                    <Text key={lIdx} style={styles.listItem}>{line}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Follow-Up & Recommendations */}
            {(hasVal(record.recommendations) || hasVal(record.notes)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Follow-Up & Recommendations</Text>
                {renderArrayField('Recommendations', record.recommendations)}
                {renderSentenceField('Notes', record.notes)}
              </View>
            )}

            {idx < validRecords.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SleepDisturbancesDocumentPDFTemplate;
