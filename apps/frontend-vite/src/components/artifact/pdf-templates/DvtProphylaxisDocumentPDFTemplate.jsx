/**
 * DvtProphylaxisDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free B&W — DVT Prophylaxis
 * Collection: dvt_prophylaxis
 * PDF: NO BLUE — all borders/titles use #000000. Config-driven, mirrors the JSX 4-area layout
 * (section title rides the first field, numbered values, DASH-style field labels, sentence/comma split).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
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

/* enum canonical-casing (mirror of the JSX): 'active' → 'Active'. */
const ENUM_OPTIONS = { status: ['Active', 'Completed', 'Not Active'] };
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* [.;] sentence split (mirror of the JSX splitBySentence) */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const formatKey = (key) => String(key || '')
  .replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).trim();

/* flatten a dynamic-key object (results) into [{label, value}] */
const flattenDynamicObject = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') return [];
  const lines = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = prefix ? `${prefix} - ${formatKey(key)}` : formatKey(key);
    if (Array.isArray(value)) {
      const items = value.filter((v) => v !== null && v !== undefined && v !== '');
      if (items.length === 0) return;
      lines.push({ label, value: items.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') });
    } else if (typeof value === 'object') {
      lines.push(...flattenDynamicObject(value, label));
    } else {
      lines.push({ label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) });
    }
  });
  return lines;
};

/* renderFieldRow: label + a single numbered value (mirrors Copy's "1. value") */
const renderFieldRow = (label, value, showLabel) => (
  <View style={styles.fieldBox} wrap={false}>
    {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
    <Text style={styles.listItem}>1. {safeString(value)}</Text>
  </View>
);

/* renderSentenceSection: splitBySentence → labeled sub-label + rows (restart) / unlabeled comma-list (>=3) numbered */
const renderSentenceSection = (label, text, showLabel) => {
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      n = 1;
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ }));
      else rows.push({ type: 'item', text: safeString(parsed.value), num: n++ });
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 3) parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ }));
      else rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => (row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>))}
    </View>
  );
};

/* renderArrayFieldPDF: numbered list (recommendations may be {recommendation} objects) */
const renderArrayFieldPDF = (label, items, showLabel) => {
  const safeItems = (Array.isArray(items) ? items : [])
    .map(it => (typeof it === 'object' && it) ? (it.recommendation || '') : String(it)).filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* renderResultsPDF: dynamic-key object → one labeled+numbered unit per key */
const renderResultsPDF = (obj) => {
  const lines = flattenDynamicObject(obj);
  if (lines.length === 0) return null;
  return (
    <React.Fragment>
      {lines.map((line, i) => (
        <View key={i} style={styles.fieldBox} wrap={false}>
          <Text style={styles.fieldLabel}>{safeString(line.label)}</Text>
          <Text style={styles.listItem}>1. {safeString(line.value)}</Text>
        </View>
      ))}
    </React.Fragment>
  );
};

/* per-field element by type (mirrors the JSX renderSection dispatch). showLabel=false for single-name fields. */
const renderFieldEl = (record, field, showLabel) => {
  const value = record[field.key];
  if (field.type === 'date') return renderFieldRow(field.label, formatDate(value), showLabel);
  if (field.type === 'enum') return renderFieldRow(field.label, enumCanonical(field.key, fmtVal(value)), showLabel);
  if (field.type === 'sentence') return renderSentenceSection(field.label, value, showLabel);
  if (field.type === 'array') return renderArrayFieldPDF(field.label, value, showLabel);
  if (field.type === 'results') return renderResultsPDF(value);
  return renderFieldRow(field.label, fmtVal(value), showLabel);
};

const showField = (record, field) => {
  const v = record[field.key];
  if (field.type === 'results') return v && typeof v === 'object' && !Array.isArray(v) && flattenDynamicObject(v).length > 0;
  if (field.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasVal(v);
};

/* SECTION CONFIGS — labels MUST mirror the JSX FIELD_LABELS exactly (4-area rule). */
const SECTION_CONFIGS = [
  { title: 'Session Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
    { key: 'status', label: 'Status', type: 'enum' },
  ] },
  { title: 'Medication Details', fields: [
    { key: 'medication', label: 'Medication' },
    { key: 'dose', label: 'Dose' },
    { key: 'duration', label: 'Duration' },
  ] },
  { title: 'Mechanical Prophylaxis', fields: [
    { key: 'mechanicalProphylaxis', label: 'Mechanical Prophylaxis', type: 'array' },
  ] },
  { title: 'Clinical Findings', fields: [
    { key: 'findings', label: 'Findings', type: 'sentence' },
    { key: 'assessment', label: 'Assessment', type: 'sentence' },
  ] },
  { title: 'Plan', fields: [
    { key: 'plan', label: 'Plan', type: 'sentence' },
  ] },
  { title: 'Recommendations', fields: [
    { key: 'recommendations', label: 'Recommendations', type: 'array' },
  ] },
  { title: 'Results', fields: [
    { key: 'results', label: 'Results', type: 'results' },
  ] },
  { title: 'Notes', fields: [
    { key: 'notes', label: 'Notes', type: 'sentence' },
  ] },
];

/* ======= COMPONENT ======= */
const DvtProphylaxisDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.dvt_prophylaxis) return Array.isArray(r.dvt_prophylaxis) ? r.dvt_prophylaxis : [r.dvt_prophylaxis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dvt_prophylaxis) return Array.isArray(dd.dvt_prophylaxis) ? dd.dvt_prophylaxis : [dd.dvt_prophylaxis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>DVT Prophylaxis</Text>
          </View>
          <Text style={styles.noDataText}>No DVT prophylaxis data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>DVT Prophylaxis</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`DVT Prophylaxis ${index + 1}`}</Text>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => showField(record, f));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    if (!showField(record, field)) return null;
                    const _first = !_t; _t = true;
                    // single-name rule: field label == section title → don't print the field label
                    const _sl = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                    const _el = renderFieldEl(record, field, _sl);
                    if (_first) return <View key={fIdx} wrap={false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text>{_el}</View>;
                    return <View key={fIdx}>{_el}</View>;
                  }); })()}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DvtProphylaxisDocumentPDFTemplate;
