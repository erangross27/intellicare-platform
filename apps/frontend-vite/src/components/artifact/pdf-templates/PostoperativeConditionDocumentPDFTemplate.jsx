/**
 * PostoperativeConditionDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — postoperative condition
 * Collection: postoperative_condition
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
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

/* Helvetica has no glyph for U+00D7 (multiplication sign) — scrub to 'x' */
const safeString = (val) => {
  let s;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x');
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

const humanizeKey = (k) => String(k || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) {
      const nextIsSpace = /\s/.test(text[i + 1] || '');
      const nextIsYear = /^\s*\d{4}\b/.test(text.slice(i + 1));
      if (nextIsSpace && !nextIsYear) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: bare label + value (no self-wrap — the section glue owns wrap) */
const renderFieldRow = (key, label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: split by sentence, parseLabel, comma-split (bare, no self-wrap) */
const renderSentenceField = (key, label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;
  if (sentences.length <= 1 && !singleLabeledList) return renderFieldRow(key, label, value);

  let n = 1;
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((s, sIdx) => {
        const parsed = parseLabel(s);
        if (parsed.isLabeled) {
          const items = splitByComma(parsed.value);
          if (items.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
                {items.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{n++}. {safeString(item)}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
              <Text style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {safeString(s)}</Text>;
      })}
    </View>
  );
};

/* renderObjectFields: humanized-key label + value for each populated object entry */
const renderObjectFields = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => renderFieldRow(`obj-${k}`, humanizeKey(k), v));
};

/* renderRecommendations: array → single field with numbered list items */
const renderRecommendations = (recs) => {
  const items = Array.isArray(recs) ? recs.filter(Boolean) : [];
  if (items.length === 0) return null;
  return (
    <View key="recommendations" style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>Recommendations</Text>
      {items.map((rec, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(rec)}</Text>
      ))}
    </View>
  );
};

/* Anti-orphan section glue: sectionTitle + first field in one wrap={false} unit, rest flow */
const renderSection = (sectionTitle, elements) => {
  const present = elements.filter(Boolean);
  if (!present.length) return null;
  const [first, ...rest] = present;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {first}
      </View>
      {rest}
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
          <Text style={styles.documentTitle}>Postoperative Condition</Text>
          <Text style={styles.noDataText}>No postoperative condition records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postoperative Condition</Text>

        {data.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postoperative Condition {idx + 1}</Text>
            </View>

            {renderSection('Postoperative Status', [
              renderSentenceField('status', 'Status', record.status),
              renderSentenceField('extubationLocation', 'Extubation Location', record.extubationLocation),
              renderSentenceField('transferDestination', 'Transfer Destination', record.transferDestination),
              renderSentenceField('type', 'Type', record.type),
            ])}

            {renderSection('Clinical Findings', [
              renderSentenceField('findings', 'Findings', record.findings),
              renderSentenceField('assessment', 'Assessment', record.assessment),
            ])}

            {renderSection('Plan', [
              renderSentenceField('plan', 'Plan', record.plan),
            ])}

            {renderSection('Vital Signs', renderObjectFields(record.vitalSigns))}

            {renderSection('Results', renderObjectFields(record.results))}

            {renderSection('Recommendations & Notes', [
              renderRecommendations(record.recommendations),
              renderSentenceField('notes', 'Notes', record.notes),
            ])}

            {renderSection('Provider Information', [
              hasVal(record.date) ? renderFieldRow('date', 'Date', formatDate(record.date)) : null,
              renderSentenceField('provider', 'Provider', record.provider),
              renderSentenceField('facility', 'Facility', record.facility),
            ])}

            {idx < data.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostoperativeConditionDocumentPDFTemplate;
