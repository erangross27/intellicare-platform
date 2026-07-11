/**
 * EarlyMaternityLeaveDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free B&W — Early Maternity Leave
 * Collection: early_maternity_leave
 * PDF: NO BLUE — all borders/titles use #000000. Config-driven, mirrors the JSX 4-area layout
 * (section title rides the first field, numbered values, DASH-style field labels, sentence split).
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
const formatDate = (d) => {
  if (!d) return '';
  try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
};

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

/* renderFieldRow: label + a single numbered value (mirrors Copy's "1. value") */
const renderFieldRow = (label, value, showLabel) => (
  <View style={styles.fieldBox} wrap={false}>
    {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
    <Text style={styles.listItem}>1. {safeString(value)}</Text>
  </View>
);

/* renderSentenceSection: labeled sub-label + comma rows (restart) / unlabeled sentence = one numbered row */
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
      // unlabeled sentence → one numbered row (mirror the JSX; a comma here is usually prose, not a list)
      rows.push({ type: 'item', text: safeString(s), num: n++ });
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

/* per-field element by type (mirrors the JSX renderSection dispatch) */
const renderFieldEl = (record, field, showLabel) => {
  const value = record[field.key];
  if (field.type === 'date') return renderFieldRow(field.label, formatDate(value), showLabel);
  if (field.type === 'boolean') return renderFieldRow(field.label, value ? 'Yes' : 'No', showLabel);
  if (field.type === 'enum') return renderFieldRow(field.label, enumCanonical(field.key, fmtVal(value)), showLabel);
  if (field.type === 'sentence') return renderSentenceSection(field.label, value, showLabel);
  return renderFieldRow(field.label, fmtVal(value), showLabel);
};

const showField = (record, field) => {
  const v = record[field.key];
  if (field.type === 'boolean') return typeof v === 'boolean';
  return hasVal(v);
};

/* SECTION CONFIGS — labels MUST mirror the JSX FIELD_LABELS exactly (4-area rule). */
const SECTION_CONFIGS = [
  { title: 'Leave Status', fields: [
    { key: 'considering', label: 'Considering Leave', type: 'boolean' },
    { key: 'reason', label: 'Reason', type: 'sentence' },
    { key: 'timing', label: 'Timing', type: 'sentence' },
    { key: 'status', label: 'Status', type: 'enum' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
  ] },
  { title: 'Employment Details', fields: [{ key: 'findings', label: 'Employment & FMLA Details', type: 'sentence' }] },
  { title: 'Medical Clearance', fields: [{ key: 'assessment', label: 'Medical Clearance Assessment', type: 'sentence' }] },
  { title: 'Return Plan', fields: [
    { key: 'plan', label: 'Return Plan', type: 'sentence' },
    { key: 'notes', label: 'Notes', type: 'sentence' },
  ] },
];

/* ======= COMPONENT ======= */
const EarlyMaternityLeaveDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.early_maternity_leave) return Array.isArray(r.early_maternity_leave) ? r.early_maternity_leave : [r.early_maternity_leave];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.early_maternity_leave) return Array.isArray(dd.early_maternity_leave) ? dd.early_maternity_leave : [dd.early_maternity_leave]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Early Maternity Leave</Text>
          </View>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Early Maternity Leave</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Early Maternity Leave ${index + 1}`}</Text>
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

export default EarlyMaternityLeaveDocumentPDFTemplate;
