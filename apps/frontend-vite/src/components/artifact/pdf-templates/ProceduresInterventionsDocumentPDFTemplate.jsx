/**
 * ProceduresInterventionsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — procedures interventions
 * Collection: procedures_interventions
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
  recDateText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6b7280', marginBottom: 1 },
  recText: { fontSize: 11, color: '#000000', paddingLeft: 8, marginBottom: 3 },
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* ======= COMPONENT ======= */
const ProceduresInterventionsDocumentPDFTemplate = ({ document: docProp }) => {
  let records;
  if (!docProp) { records = []; }
  else {
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.procedures_interventions) return Array.isArray(r.procedures_interventions) ? r.procedures_interventions : [r.procedures_interventions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.procedures_interventions) return Array.isArray(dd.procedures_interventions) ? dd.procedures_interventions : [dd.procedures_interventions]; return [dd]; }
      return [r];
    });
    records = arr.filter(r => r && typeof r === 'object');
  }

  const renderStringField = (label, val) => {
    if (!hasVal(val)) return null;
    const str = safeString(val);
    const sentences = splitBySentence(str);
    if (sentences.length > 1) {
      return (
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {sentences.map((s, i) => {
            const parsed = parseLabel(s);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 2) {
                return (
                  <View key={i}>
                    <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                    {commaItems.map((ci, j) => <Text key={j} style={styles.listItem}>{'\u2022'} {ci}</Text>)}
                  </View>
                );
              }
              return (
                <View key={i}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  <Text style={styles.listItem}>{'\u2022'} {parsed.value}</Text>
                </View>
              );
            }
            return <Text key={i} style={styles.listItem}>{'\u2022'} {s}</Text>;
          })}
        </View>
      );
    }
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{str}</Text>
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Procedures & Interventions Report</Text>
          </View>
          <Text style={styles.noDataText}>No procedures/interventions data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Procedures & Interventions Report</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.assessmentDate) && <Text style={styles.recordDate}>{formatDate(record.assessmentDate)}</Text>}
                {hasVal(record.assessmentTime) && <Text style={styles.recordDate}>{safeString(record.assessmentTime)}</Text>}
              </View>
              <Text style={styles.recordTitle}>Procedure/Intervention {idx + 1}</Text>
            </View>

            {/* Timing */}
            {(hasVal(record.assessmentDate) || hasVal(record.assessmentTime)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timing</Text>
                {hasVal(record.assessmentDate) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Assessment Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.assessmentDate)}</Text>
                  </View>
                )}
                {hasVal(record.assessmentTime) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Assessment Time</Text>
                    <Text style={styles.fieldValue}>{safeString(record.assessmentTime)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Status */}
            {hasVal(record.clinicalStatus) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Status</Text>
                {renderStringField('Clinical Status', record.clinicalStatus)}
              </View>
            )}

            {/* Vital Signs */}
            {hasVal(record.vitalSigns) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vital Signs</Text>
                {renderStringField('Vital Signs', record.vitalSigns)}
              </View>
            )}

            {/* Interventions */}
            {hasVal(record.interventions) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interventions</Text>
                {renderStringField('Interventions', record.interventions)}
              </View>
            )}

            {/* Response */}
            {hasVal(record.response) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Response</Text>
                {renderStringField('Response', record.response)}
              </View>
            )}

            {/* Plan & Recommendations */}
            {(hasVal(record.plan) || (Array.isArray(record.recommendations) && record.recommendations.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan & Recommendations</Text>
                {renderStringField('Plan', record.plan)}
                {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Recommendations</Text>
                    {record.recommendations.filter(Boolean).map((rec, recIdx) => {
                      const isObj = typeof rec === 'object' && rec !== null;
                      const recText = isObj ? (rec.recommendation || '') : String(rec);
                      const recDate = isObj ? rec.date : null;
                      return (
                        <View key={recIdx} style={{ marginBottom: 4 }}>
                          {recDate && <Text style={styles.recDateText}>[{formatDate(recDate)}]</Text>}
                          <Text style={styles.recText}>{'\u2022'} {recText}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProceduresInterventionsDocumentPDFTemplate;
