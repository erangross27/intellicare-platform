/**
 * PostoperativeConditionDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — postoperative condition
 * Collection: postoperative_condition
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

/* renderSentenceField: split by sentence, parseLabel, comma-split */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldRow(label, value);

  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((s, sIdx) => {
        const parsed = parseLabel(s);
        if (parsed.isLabeled) {
          const items = splitByComma(parsed.value);
          if (items.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {items.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{n++}. {item}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {s}</Text>;
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PostoperativeConditionDocumentPDFTemplate = ({ document: docProp }) => {
  let data = docProp;
  if (!Array.isArray(data)) {
    if (data?.records && Array.isArray(data.records)) data = data.records;
    else if (data?.data && Array.isArray(data.data)) data = data.data;
    else if (data?._id || data?.date || data?.status) data = [data];
    else data = [];
  }

  if (!data || data.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Postoperative Condition</Text>
          </View>
          <Text style={styles.noDataText}>No postoperative condition records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Postoperative Condition</Text>
        </View>

        {data.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Postoperative Condition {idx + 1}</Text>
            </View>

            {/* Postoperative Status */}
            {(hasVal(record.status) || hasVal(record.extubationLocation) || hasVal(record.transferDestination) || hasVal(record.type)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Postoperative Status</Text>
                {renderSentenceField('Status', record.status)}
                {renderSentenceField('Extubation Location', record.extubationLocation)}
                {renderSentenceField('Transfer Destination', record.transferDestination)}
                {renderSentenceField('Type', record.type)}
              </View>
            )}

            {/* Clinical Findings */}
            {(hasVal(record.findings) || hasVal(record.assessment)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Findings</Text>
                {renderSentenceField('Findings', record.findings)}
                {renderSentenceField('Assessment', record.assessment)}
              </View>
            )}

            {/* Plan */}
            {hasVal(record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {renderSentenceField('Plan', record.plan)}
              </View>
            )}

            {/* Vital Signs */}
            {hasVal(record.vitalSigns) && typeof record.vitalSigns === 'object' && Object.keys(record.vitalSigns).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vital Signs</Text>
                {Object.entries(record.vitalSigns).filter(([, v]) => v != null && v !== '').map(([key, value], vIdx) => (
                  <View key={vIdx} style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>{key}</Text>
                    <Text style={styles.fieldValue}>{safeString(value)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Results */}
            {hasVal(record.results) && typeof record.results === 'object' && Object.keys(record.results).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Results</Text>
                {Object.entries(record.results).filter(([, v]) => v != null && v !== '').map(([key, value], rIdx) => (
                  <View key={rIdx} style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>{key}</Text>
                    <Text style={styles.fieldValue}>{safeString(value)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations & Notes */}
            {(hasVal(record.recommendations) || hasVal(record.notes)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations & Notes</Text>
                {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Recommendations</Text>
                    {record.recommendations.filter(Boolean).map((rec, recIdx) => (
                      <Text key={recIdx} style={styles.listItem}>{recIdx + 1}. {safeString(rec)}</Text>
                    ))}
                  </View>
                )}
                {renderSentenceField('Notes', record.notes)}
              </View>
            )}

            {/* Provider Information */}
            {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
              </View>
            )}

            {idx < data.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostoperativeConditionDocumentPDFTemplate;
