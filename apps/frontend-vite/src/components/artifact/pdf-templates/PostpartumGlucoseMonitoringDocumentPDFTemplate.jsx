/**
 * PostpartumGlucoseMonitoringDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- US medical platform
 * Collection: postpartum_glucose_monitoring
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
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

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
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

/* ======= COMPONENT ======= */
const PostpartumGlucoseMonitoringDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postpartum_glucose_monitoring) return Array.isArray(r.postpartum_glucose_monitoring) ? r.postpartum_glucose_monitoring : [r.postpartum_glucose_monitoring];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.postpartum_glucose_monitoring) return Array.isArray(dd.postpartum_glucose_monitoring) ? dd.postpartum_glucose_monitoring : [dd.postpartum_glucose_monitoring];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Postpartum Glucose Monitoring</Text>
          </View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Postpartum Glucose Monitoring</Text>
        </View>

        {records.map((record, idx) => {
          const ctr = { n: 1 };

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Postpartum Glucose Monitoring ${idx + 1}`}</Text>
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Monitoring Timeline */}
              {(hasVal(record.immediatePostpartum) || hasVal(record.sixWeekTest) || hasVal(record.longTermScreening)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Monitoring Timeline</Text>
                  {renderSentenceField('Immediate Postpartum', record.immediatePostpartum, ctr)}
                  {renderSentenceField('Six-Week Test', record.sixWeekTest, ctr)}
                  {renderSentenceField('Long-Term Screening', record.longTermScreening, ctr)}
                </View>
              )}

              {/* 2. Visit Information */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                  {renderSentenceField('Provider', record.provider, ctr)}
                  {renderSentenceField('Facility', record.facility, ctr)}
                  {renderFieldRow('Status', record.status)}
                </View>
              )}

              {/* 3. Clinical Findings */}
              {(hasVal(record.findings) || hasVal(record.assessment)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Clinical Findings</Text>
                  {renderSentenceField('Findings', record.findings, ctr)}
                  {renderSentenceField('Assessment', record.assessment, ctr)}
                </View>
              )}

              {/* 4. Management */}
              {(hasVal(record.plan) || (Array.isArray(record.recommendations) && record.recommendations.length > 0) || hasVal(record.notes)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Management</Text>
                  {renderSentenceField('Plan', record.plan, ctr)}
                  {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                    <View style={styles.fieldBox} wrap={record.recommendations.length > 8 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Recommendations</Text>
                      {record.recommendations.filter(Boolean).map((item, i) => {
                        const rec = (typeof item === 'object' && item !== null) ? safeString(item.recommendation || '') : safeString(item);
                        const dt = (typeof item === 'object' && item !== null) ? item.date || '' : '';
                        return <Text key={i} style={styles.listItem}>{ctr.n++}. {rec}{dt ? ` (${dt})` : ''}</Text>;
                      })}
                    </View>
                  )}
                  {renderSentenceField('Notes', record.notes, ctr)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PostpartumGlucoseMonitoringDocumentPDFTemplate;
