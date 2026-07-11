import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W PDF (canonical): title/section rules are underlines, field labels are
   bare underlined labels above their value (never "Label: value" side-by-side). */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', marginBottom: 16 },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 6 },
  fieldBox: { marginBottom: 6, paddingLeft: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3 },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 14, color: '#000000', paddingLeft: 12, marginBottom: 2, lineHeight: 1.4 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
});

/* Helvetica lacks a few glyphs (× U+00D7) — scrub with \u escapes only. */
const safeString = (v) => String(v ?? '').replace(/×/g, 'x');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const sameAsTitle = (label, title) => String(title || '').trim().toLowerCase() === String(label || '').trim().toLowerCase();

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* parenthesis-aware comma split; skip thousands (comma+digit) and year (comma+YYYY) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Split on '.'/';' + whitespace, but not after an abbreviation, single capital initial, or a digit. */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* mirror the JSX formatSentenceFieldLines: labeled sentence -> sub-label + numbered comma rows */
const sentenceLines = (text) => {
  const out = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      out.push({ sub: parsed.label });
      if (parts.length >= 2) parts.forEach(it => out.push({ item: `${n++}. ${it}` }));
      else out.push({ item: `${n++}. ${parsed.value}` });
    } else {
      out.push({ item: `${n++}. ${s}` });
    }
  });
  return out;
};

/* recursive object -> bare stacked Text rows (B&W) */
const objectRows = (value, depth, keyPrefix) => {
  const rows = [];
  if (isEmptyDeep(value)) return rows;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const label = humanizeKey(k);
    const pad = 12 + depth * 12;
    if (isScalar(v)) {
      rows.push(<Text key={`${keyPrefix}-${k}-l${i}`} style={[styles.subLabel, { paddingLeft: pad }]}>{safeString(label)}</Text>);
      rows.push(<Text key={`${keyPrefix}-${k}-v${i}`} style={[styles.listItem, { paddingLeft: pad }]}>{safeString(fmtScalar(v))}</Text>);
    } else {
      rows.push(<Text key={`${keyPrefix}-${k}-h${i}`} style={[styles.subLabel, { paddingLeft: pad }]}>{safeString(label)}</Text>);
      rows.push(...objectRows(v, depth + 1, `${keyPrefix}-${k}`));
    }
  });
  return rows;
};

/* Section/field config mirrors the JSX SECTION_FIELDS + FIELD_LABELS exactly (source of truth). */
const SECTION_CONFIGS = [
  { title: 'Clinical Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider', type: 'string' },
    { key: 'facility', label: 'Facility', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
  ] },
  { title: 'Immediate Postpartum', fields: [
    { key: 'insulinDiscontinuation', label: 'Insulin Discontinuation', type: 'string' },
    { key: 'pediatricianSelected', label: 'Pediatrician Selected', type: 'string' },
    { key: 'contraceptionPlan', label: 'Contraception Plan', type: 'string' },
    { key: 'maternityLeave', label: 'Maternity Leave', type: 'object' },
  ] },
  { title: 'Glucose Testing', fields: [
    { key: 'glucoseTestingSchedule', label: 'Glucose Testing Schedule', type: 'string' },
  ] },
  { title: 'Breastfeeding Recommendations', fields: [
    { key: 'breastfeedingRecommendations', label: 'Breastfeeding Recommendations', type: 'array' },
    { key: 'lactationSupport', label: 'Lactation Support', type: 'boolean' },
  ] },
  { title: 'Support & Preparations', fields: [
    { key: 'postpartumSupport', label: 'Postpartum Support', type: 'array' },
    { key: 'homePreparations', label: 'Home Preparations', type: 'array' },
    { key: 'mentalHealthScreening', label: 'Mental Health Screening', type: 'boolean' },
  ] },
  { title: 'Risk Reduction', fields: [
    { key: 'weightManagementPlan', label: 'Weight Management Plan', type: 'string' },
    { key: 'exerciseProgram', label: 'Exercise Program', type: 'string' },
    { key: 'metforminConsideration', label: 'Metformin Consideration', type: 'string' },
  ] },
  { title: 'Future Pregnancy', fields: [
    { key: 'futurePregnancyCounseling', label: 'Future Pregnancy Counseling', type: 'string' },
  ] },
  { title: 'Clinical Notes', fields: [
    { key: 'findings', label: 'Findings', type: 'string' },
    { key: 'assessment', label: 'Assessment', type: 'string' },
    { key: 'plan', label: 'Plan', type: 'string' },
    { key: 'recommendations', label: 'Recommendations', type: 'objectArray' },
    { key: 'results', label: 'Results', type: 'object' },
    { key: 'notes', label: 'Notes', type: 'string' },
  ] },
];

const fieldVisible = (f, val) => {
  if (f.type === 'array' || f.type === 'objectArray') return Array.isArray(val) && val.filter(x => !isEmptyDeep(x)).length > 0;
  if (f.type === 'object') return hasVal(val) && !isScalar(val);
  return hasVal(val);
};

const renderField = (f, val, sectionTitle) => {
  if (!fieldVisible(f, val)) return null;
  const showLabel = !sameAsTitle(f.label, sectionTitle);
  const labelEl = showLabel ? <Text style={styles.fieldLabel}>{safeString(f.label)}</Text> : null;

  if (f.type === 'array') {
    const items = val.filter(x => !isEmptyDeep(x));
    return (
      <View key={f.key} style={styles.fieldBox}>
        {labelEl}
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(fmtScalar(it))}</Text>)}
      </View>
    );
  }

  if (f.type === 'object') {
    const rows = objectRows(val, 0, f.key);
    if (!rows.length) return null;
    return (<View key={f.key} style={styles.fieldBox}>{labelEl}{rows}</View>);
  }

  if (f.type === 'objectArray') {
    const recs = val.filter(r => !isEmptyDeep(r));
    const rows = []; let lastDate = null; let n = 1;
    recs.forEach((r, i) => {
      const recText = (r?.recommendation || '').trim();
      const date = (r?.date || '').trim();
      if (date !== lastDate) { if (date) rows.push(<Text key={`d-${i}`} style={styles.subLabel}>{safeString(date)}</Text>); lastDate = date; n = 1; }
      if (recText) rows.push(<Text key={`r-${i}`} style={styles.listItem}>{n++}. {safeString(recText)}</Text>);
    });
    if (!rows.length) return null;
    return (<View key={f.key} style={styles.fieldBox}>{labelEl}{rows}</View>);
  }

  if (f.type === 'date') {
    return (<View key={f.key} style={styles.fieldBox}>{labelEl}<Text style={styles.fieldValue}>{safeString(formatDate(val))}</Text></View>);
  }

  if (f.type === 'boolean') {
    return (<View key={f.key} style={styles.fieldBox}>{labelEl}<Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text></View>);
  }

  /* string: multi-sentence OR "Label: a, b" -> sub-labels + numbered rows; else whole value */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const parsed = parseLabel(strVal);
  const structured = sentences.length > 1 || (parsed.isLabeled && splitByComma(parsed.value).length >= 2);
  if (structured) {
    return (
      <View key={f.key} style={styles.fieldBox}>
        {labelEl}
        {sentenceLines(strVal).map((ln, i) => ln.sub !== undefined
          ? <Text key={i} style={styles.subLabel}>{safeString(ln.sub)}</Text>
          : <Text key={i} style={styles.listItem}>{safeString(ln.item)}</Text>)}
      </View>
    );
  }
  return (<View key={f.key} style={styles.fieldBox}>{labelEl}<Text style={styles.fieldValue}>{safeString(strVal)}</Text></View>);
};

/* anti-orphan: glue the section title to its first field in a wrap={false} block; rest flow */
const renderSection = (title, elements) => {
  const present = elements.filter(Boolean);
  if (!present.length) return null;
  const [first, ...rest] = present;
  return (
    <View key={title} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PostpartumPlanningDocumentPDFTemplate = ({ document: data }) => {
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.records) rawRecords = data[0].records;
    else rawRecords = data;
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) { if (!key.startsWith('_')) cleanRecord[key] = record[key]; }
    return cleanRecord;
  });

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Postpartum Planning</Text>
          <Text style={styles.fieldValue}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Postpartum Planning</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>Postpartum Planning {idx + 1}</Text>
            {SECTION_CONFIGS.map(sec => renderSection(sec.title, sec.fields.map(f => renderField(f, record[f.key], sec.title))))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostpartumPlanningDocumentPDFTemplate;
