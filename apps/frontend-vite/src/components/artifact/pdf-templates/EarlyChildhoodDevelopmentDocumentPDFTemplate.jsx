/**
 * EarlyChildhoodDevelopmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free B&W — Early Childhood Development
 * Collection: early_childhood_development
 * PDF: NO BLUE — all borders/titles use #000000. Config-driven, mirrors the JSX 4-area layout
 * (section title rides the first field, numbered values, DASH-style field labels, sentence/object split).
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

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* renderFieldRow: label + a single numbered value */
const renderFieldRow = (label, value, showLabel) => (
  <View style={styles.fieldBox} wrap={false}>
    {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
    <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
  </View>
);

const renderDateFieldPDF = (label, value, showLabel) => (
  <View style={styles.fieldBox} wrap={false}>
    {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
    <Text style={styles.listItem}>1. {formatDate(value)}</Text>
  </View>
);

/* renderSentenceSection: labeled sub-label + rows (restart) / unlabeled comma-list (>=3) numbered */
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
      // unlabeled sentence → one numbered row (mirror the JSX; a comma is usually credentials/prose, not a list)
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

/* renderArrayFieldPDF: numbered list */
const renderArrayFieldPDF = (label, items, showLabel) => {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* renderObjectNodePDF — recursive: each key = sub-label + numbered value (NEVER "Key: value" side-by-side) */
const renderObjectNodePDF = (obj, keyPrefix) => {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  return entries.map(([key, value], i) => {
    const formattedKey = humanizeKey(key);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return (
        <View key={`${keyPrefix}-${i}`} wrap={false}>
          <Text style={styles.nestedSubtitle}>{formattedKey}</Text>
          {renderObjectNodePDF(value, `${keyPrefix}-${i}`)}
        </View>
      );
    }
    if (Array.isArray(value)) {
      const safeItems = value.filter(v => !isEmptyDeep(v));
      return (
        <View key={`${keyPrefix}-${i}`} wrap={false}>
          <Text style={styles.nestedSubtitle}>{formattedKey}</Text>
          {safeItems.map((item, j) => <Text key={j} style={styles.listItem}>{j + 1}. {safeString(item)}</Text>)}
        </View>
      );
    }
    return (
      <View key={`${keyPrefix}-${i}`} wrap={false}>
        <Text style={styles.nestedSubtitle}>{formattedKey}</Text>
        <Text style={styles.listItem}>1. {safeString(value)}</Text>
      </View>
    );
  });
};

const renderObjectFieldPDF = (label, obj, showLabel) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={entries.length > 6}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {renderObjectNodePDF(obj, label)}
    </View>
  );
};

/* renderRecommendationsField: array of objects with recommendation + date */
const renderRecommendationsFieldPDF = (label, items, showLabel) => {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (safeItems.length === 0) return null;
  const recDates = safeItems.filter(it => typeof it === 'object' && it !== null && it.date).map(it => formatDate(it.date));
  const allSameDate = recDates.length > 0 && recDates.every(d => d === recDates[0]);
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {allSameDate && <Text style={styles.nestedSubtitle}>{recDates[0]}</Text>}
      {safeItems.map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          const rec = item.recommendation || '';
          const dt = item.date ? formatDate(item.date) : '';
          return (
            <View key={i} wrap={false}>
              {dt && !allSameDate ? <Text style={styles.nestedSubtitle}>{dt}</Text> : null}
              <Text style={styles.listItem}>{i + 1}. {safeString(rec)}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
      })}
    </View>
  );
};

/* per-field element by type (mirrors the JSX renderSection dispatch) */
const renderFieldEl = (record, field, showLabel) => {
  const val = record[field.key];
  if (field.isDate) return renderDateFieldPDF(field.label, val, showLabel);
  if (field.isEnum) return renderFieldRow(field.label, enumCanonical(field.key, fmtVal(val)), showLabel);
  if (field.isRecommendations) return renderRecommendationsFieldPDF(field.label, val, showLabel);
  if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
  if (field.isObject) return renderObjectFieldPDF(field.label, val, showLabel);
  if (field.isSentence) return renderSentenceSection(field.label, val, showLabel);
  return renderFieldRow(field.label, val, showLabel);
};

const showField = (record, field) => {
  const v = record[field.key];
  if (field.isObject) return v && typeof v === 'object' && !Array.isArray(v) && !isEmptyDeep(v);
  if (field.isArray || field.isRecommendations) return Array.isArray(v) && v.filter(x => !isEmptyDeep(x)).length > 0;
  return hasVal(v);
};

/* SECTION CONFIGS — labels MUST mirror the JSX FIELD_LABELS exactly (4-area rule). */
const SECTION_CONFIGS = [
  { title: 'Provider Information', fields: [
    { key: 'provider', label: 'Provider', isSentence: true },
    { key: 'facility', label: 'Facility', isSentence: true },
  ] },
  { title: 'Assessment Overview', fields: [
    { key: 'date', label: 'Date', isDate: true },
    { key: 'status', label: 'Status', isEnum: true },
  ] },
  { title: 'Findings', fields: [{ key: 'findings', label: 'Findings', isSentence: true }] },
  { title: 'Assessment', fields: [{ key: 'assessment', label: 'Assessment', isSentence: true }] },
  { title: 'Plan', fields: [{ key: 'plan', label: 'Plan', isSentence: true }] },
  { title: 'Speech Development', fields: [{ key: 'speechDevelopment', label: 'Speech Development', isObject: true }] },
  { title: 'Social & Behavioral', fields: [
    { key: 'playSkills', label: 'Play Skills', isSentence: true },
    { key: 'separationAnxiety', label: 'Separation Anxiety', isSentence: true },
  ] },
  { title: 'Self-Care Skills', fields: [{ key: 'selfCareSkills', label: 'Self-Care Skills', isArray: true }] },
  { title: 'Toilet Training', fields: [{ key: 'toiletTraining', label: 'Toilet Training', isObject: true }] },
  { title: 'Results', fields: [{ key: 'results', label: 'Results', isObject: true }] },
  { title: 'Recommendations', fields: [{ key: 'recommendations', label: 'Recommendations', isRecommendations: true }] },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', isSentence: true }] },
];

/* ======= COMPONENT ======= */
const EarlyChildhoodDevelopmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.early_childhood_development) return Array.isArray(r.early_childhood_development) ? r.early_childhood_development : [r.early_childhood_development];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.early_childhood_development) return Array.isArray(dd.early_childhood_development) ? dd.early_childhood_development : [dd.early_childhood_development]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Early Childhood Development</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Early Childhood Development</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Early Childhood Development ${index + 1}`}</Text>
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

export default EarlyChildhoodDevelopmentDocumentPDFTemplate;
