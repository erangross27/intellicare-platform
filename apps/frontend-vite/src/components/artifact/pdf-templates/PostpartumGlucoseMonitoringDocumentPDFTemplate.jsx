/**
 * PostpartumGlucoseMonitoringDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — postpartum glucose monitoring
 * Collection: postpartum_glucose_monitoring
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

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

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

/* ======= FIELD RENDERERS (bare Views — the section glue owns the only wrap=false) ======= */
const renderScalarField = (label, text, showLabel) => (
  <View style={styles.fieldBox}>
    {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <Text style={styles.fieldValue}>{safeString(text)}</Text>
  </View>
);

/* sentence field: split by sentence, parseLabel, comma-list (mirror of the JSX renderStringField) */
const renderSentenceField = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;

  if (sentences.length <= 1 && !singleLabeledList) {
    return (
      <View style={styles.fieldBox}>
        {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  }

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      if (items.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        items.forEach(it => { rows.push({ type: 'item', text: safeString(it), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox}>
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
        : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>)}
    </View>
  );
};

/* recommendations: array of {recommendation, date} objects OR plain strings → numbered list */
const renderArrayField = (label, value) => {
  const items = Array.isArray(value) ? value.filter(Boolean) : [];
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item, i) => {
        const rec = (typeof item === 'object' && item !== null) ? safeString(item.recommendation || '') : safeString(item);
        const dt = (typeof item === 'object' && item !== null) ? item.date || '' : '';
        return <Text key={i} style={styles.listItem}>{i + 1}. {rec}{dt ? ` (${dt})` : ''}</Text>;
      })}
    </View>
  );
};

/* ======= SECTION CONFIGS (mirror JSX SECTION_FIELDS) ======= */
const SECTION_CONFIGS = [
  { title: 'Monitoring Timeline', fields: [
    { key: 'immediatePostpartum', label: 'Immediate Postpartum', isSentence: true },
    { key: 'sixWeekTest', label: 'Six-Week Test', isSentence: true },
    { key: 'longTermScreening', label: 'Long-Term Screening', isSentence: true },
  ] },
  { title: 'Visit Information', fields: [
    { key: 'date', label: 'Date', isDate: true },
    { key: 'provider', label: 'Provider', isSentence: true },
    { key: 'facility', label: 'Facility', isSentence: true },
  ] },
  { title: 'Clinical Findings', fields: [
    { key: 'findings', label: 'Findings', isSentence: true },
    { key: 'assessment', label: 'Assessment', isSentence: true },
  ] },
  { title: 'Management', fields: [
    { key: 'plan', label: 'Plan', isSentence: true },
    { key: 'recommendations', label: 'Recommendations', isArray: true },
    { key: 'notes', label: 'Notes', isSentence: true },
  ] },
];

const fieldVisible = (f, val) => {
  if (f.isArray) return Array.isArray(val) && val.filter(Boolean).length > 0;
  return hasVal(val);
};

/* ======= COMPONENT ======= */
const PostpartumGlucoseMonitoringDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postpartum_glucose_monitoring) return Array.isArray(r.postpartum_glucose_monitoring) ? r.postpartum_glucose_monitoring : [r.postpartum_glucose_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.postpartum_glucose_monitoring) return Array.isArray(dd.postpartum_glucose_monitoring) ? dd.postpartum_glucose_monitoring : [dd.postpartum_glucose_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Postpartum Glucose Monitoring</Text>
          <Text style={styles.noDataText}>No postpartum glucose monitoring records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postpartum Glucose Monitoring</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postpartum Glucose Monitoring {idx + 1}</Text>
            </View>

            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const visible = cfg.fields.filter(f => fieldVisible(f, record[f.key]));
              if (!visible.length) return null;
              const elements = visible.map((f) => {
                const showLabel = !sameAsTitle(f.label, cfg.title);
                const val = record[f.key];
                let el = null;
                if (f.isDate) el = renderScalarField(f.label, formatDate(val), showLabel);
                else if (f.isArray) el = renderArrayField(f.label, val);
                else el = renderSentenceField(f.label, val, showLabel);
                return el ? <React.Fragment key={f.key}>{el}</React.Fragment> : null;
              }).filter(Boolean);
              if (!elements.length) return null;
              const [first, ...rest] = elements;

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostpartumGlucoseMonitoringDocumentPDFTemplate;
