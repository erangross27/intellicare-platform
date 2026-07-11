/**
 * ContinuousGlucoseMonitorDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — continuous glucose monitor
 * Collection: continuous_glucose_monitor
 * B&W (#000000) only — Rule #74 wrap-gating. Booleans rendered Yes/No.
 *
 * Sections:
 *   CGM Discussion: offered (boolean), accepted (boolean), deviceInfo (string), instructions (string)
 *   Clinical: date (Date), provider (string), facility (string), findings (string), assessment (string), plan (string), recommendations (array), results (object)
 *   Notes & Status: notes (string), status (string)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
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

/* renderBooleanRow: boolean field rendered as Yes/No */
const renderBooleanRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>
    </View>
  );
};

/* renderSentenceField: split string fields into numbered sentences for PDF */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);

  if (sentences.length <= 1) {
    return renderFieldRow(label, value);
  }

  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            const items = [];
            items.push(<Text key={`lbl-${sIdx}`} style={styles.nestedSubtitle}>{parsed.label}:</Text>);
            commaItems.forEach((ci, ciIdx) => {
              items.push(<Text key={`${sIdx}-${ciIdx}`} style={styles.listItem}>{n++}. {ci}</Text>);
            });
            return <View key={sIdx}>{items}</View>;
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
      })}
    </View>
  );
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* renderArrayBox: array field as numbered list */
const renderArrayBox = (label, value) => {
  if (!hasVal(value)) return null;
  const items = (Array.isArray(value) ? value : [value]).filter(hasVal);
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {typeof it === 'object' ? (safeString(it.recommendation || it.text) || JSON.stringify(it)) : safeString(it)}</Text>
      ))}
    </View>
  );
};

/* renderObjectBox: object field — flat key/value leaves */
const renderObjectLeaves = (value, depth = 0) => {
  const out = [];
  Object.entries(value || {}).forEach(([k, v], i) => {
    if (!hasVal(v)) return;
    if (typeof v === 'object' && !Array.isArray(v) && !(v && v.$date)) {
      out.push(<Text key={`${depth}-${i}-k`} style={styles.nestedSubtitle}>{humanizeKey(k)}:</Text>);
      renderObjectLeaves(v, depth + 1).forEach(node => out.push(node));
    } else {
      const val = Array.isArray(v) ? v.map(safeString).join(', ') : safeString(v);
      out.push(<Text key={`${depth}-${i}`} style={[styles.listItem, depth > 0 ? { paddingLeft: 16 } : null]}>{humanizeKey(k)}: {val}</Text>);
    }
  });
  return out;
};

const renderObjectBox = (label, value) => {
  if (!hasVal(value) || typeof value !== 'object') return null;
  const leaves = renderObjectLeaves(value);
  if (leaves.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {leaves}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const ContinuousGlucoseMonitorDocumentPDFTemplate = ({ document: docProp, documents }) => {
  const records = (() => {
    if (documents && Array.isArray(documents) && documents.length > 0) return documents;
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.continuous_glucose_monitor) return Array.isArray(r.continuous_glucose_monitor) ? r.continuous_glucose_monitor : [r.continuous_glucose_monitor];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.continuous_glucose_monitor) return Array.isArray(dd.continuous_glucose_monitor) ? dd.continuous_glucose_monitor : [dd.continuous_glucose_monitor]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No continuous glucose monitor records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Continuous Glucose Monitor</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date || record.createdAt) && (
                  <Text style={styles.recordDate}>{formatDate(record.date || record.createdAt)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>Continuous Glucose Monitor {idx + 1}</Text>
            </View>

            {/* CGM Discussion Section */}
            {(hasVal(record.offered) || hasVal(record.accepted) || hasVal(record.deviceInfo) || hasVal(record.instructions)) && (
              <View style={styles.section} wrap={[record.offered, record.accepted, record.deviceInfo, record.instructions].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>CGM Discussion</Text>
                {renderBooleanRow('CGM Offered', record.offered)}
                {renderBooleanRow('CGM Accepted', record.accepted)}
                {renderFieldRow('Device Info', record.deviceInfo)}
                {renderSentenceField('Instructions', record.instructions)}
              </View>
            )}

            {/* Clinical Section */}
            {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.recommendations) || hasVal(record.results)) && (
              <View style={styles.section} wrap={[record.date, record.provider, record.facility, record.findings, record.assessment, record.plan, record.recommendations, record.results].filter(hasVal).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Clinical</Text>
                {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
                {renderSentenceField('Findings', record.findings)}
                {renderSentenceField('Assessment', record.assessment)}
                {renderSentenceField('Plan', record.plan)}
                {renderArrayBox('Recommendations', record.recommendations)}
                {renderObjectBox('Results', record.results)}
              </View>
            )}

            {/* Notes & Status Section */}
            {(hasVal(record.notes) || hasVal(record.status)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes & Status</Text>
                {renderSentenceField('Notes', record.notes)}
                {renderFieldRow('Status', record.status)}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ContinuousGlucoseMonitorDocumentPDFTemplate;
