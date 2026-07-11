/**
 * QualityMetricsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — quality metrics
 * Collection: quality_metrics
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
  recordStatus: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000' },
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

/* ======= renderStringField for PDF ======= */
const renderStringFieldPDF = (label, val) => {
  if (!hasVal(val)) return null;
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return (
      <View style={styles.fieldBox}>
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
  }
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= COMPONENT ======= */
const QualityMetricsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.quality_metrics) {
    records = Array.isArray(data.quality_metrics) ? data.quality_metrics : [data.quality_metrics];
  } else if (data?.documentData) {
    records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Quality Metrics</Text>
          </View>
          <Text style={styles.noDataText}>No quality metrics records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Quality Metrics</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {hasVal(record.metricDate) && <Text style={styles.recordDate}>{formatDate(record.metricDate)}</Text>}
                <Text style={styles.recordStatus}>{record.metricMet ? 'MET' : 'NOT MET'}</Text>
              </View>
              <Text style={styles.recordTitle}>{record.metricName || `Quality Metric ${idx + 1}`}</Text>
            </View>

            {/* Metric Overview */}
            {(hasVal(record.metricName) || hasVal(record.metricCategory) || hasVal(record.metricDate) || typeof record.metricMet === 'boolean') && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Metric Overview</Text>
                {hasVal(record.metricName) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>METRIC NAME</Text>
                    <Text style={styles.fieldValue}>{safeString(record.metricName)}</Text>
                  </View>
                )}
                {hasVal(record.metricCategory) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>CATEGORY</Text>
                    <Text style={styles.fieldValue}>{safeString(record.metricCategory)}</Text>
                  </View>
                )}
                {hasVal(record.metricDate) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>METRIC DATE</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.metricDate)}</Text>
                  </View>
                )}
                {typeof record.metricMet === 'boolean' && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>METRIC MET</Text>
                    <Text style={styles.fieldValue}>{record.metricMet ? 'Yes' : 'No'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Target vs Actual */}
            {(hasVal(record.targetValue) || hasVal(record.actualValue) || hasVal(record.variance) || hasVal(record.unit)) && (
              <View style={styles.section} wrap={(safeString(record.targetValue) + safeString(record.actualValue) + safeString(record.variance)).length > 400 ? undefined : false}>
                <Text style={styles.sectionTitle}>Target vs Actual</Text>
                {hasVal(record.targetValue) && renderStringFieldPDF('TARGET VALUE', record.targetValue)}
                {hasVal(record.actualValue) && renderStringFieldPDF('ACTUAL VALUE', record.actualValue)}
                {hasVal(record.variance) && renderStringFieldPDF('VARIANCE', record.variance)}
                {hasVal(record.unit) && renderStringFieldPDF('UNIT', record.unit)}
              </View>
            )}

            {/* Barriers */}
            {hasVal(record.barriers) && (
              <View style={styles.section} wrap={(Array.isArray(record.barriers) ? record.barriers : [record.barriers]).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Barriers</Text>
                {(Array.isArray(record.barriers) ? record.barriers : [record.barriers]).map((barrier, bIdx) => (
                  <Text key={bIdx} style={styles.listItem}>{bIdx + 1}. {safeString(barrier)}</Text>
                ))}
              </View>
            )}

            {/* Improvement Plan */}
            {hasVal(record.improvementPlan) && (
              <View style={styles.section} wrap={splitBySentence(safeString(record.improvementPlan)).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Improvement Plan</Text>
                {renderStringFieldPDF('', record.improvementPlan)}
              </View>
            )}

            {/* Action Items */}
            {hasVal(record.actionItems) && (
              <View style={styles.section} wrap={(Array.isArray(record.actionItems) ? record.actionItems : [record.actionItems]).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Action Items</Text>
                {(Array.isArray(record.actionItems) ? record.actionItems : [record.actionItems]).map((item, aIdx) => (
                  <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(item)}</Text>
                ))}
              </View>
            )}

            {/* Responsible Party */}
            {hasVal(record.responsibleParty) && (
              <View style={styles.section} wrap={splitBySentence(safeString(record.responsibleParty)).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Responsible Party</Text>
                {renderStringFieldPDF('', record.responsibleParty)}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default QualityMetricsDocumentPDFTemplate;
