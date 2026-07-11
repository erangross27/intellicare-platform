/**
 * EnvironmentalExposuresDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors EnvironmentalExposuresDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: environmental_exposures.
 * react-pdf 4.5.1: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS (mirror the JSX helpers so Copy All === PDF) ======= */
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const getVal = (record, key) => {
  if (!key.includes('.')) return record[key];
  let v = record;
  for (const p of key.split('.')) { if (v == null) return undefined; v = v[p]; }
  return v;
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
/* buildSentenceRows: mirrors the JSX copy's formatSentenceFieldLines — labeled sentence → subtitle + numbered
   comma items; unlabeled sentence → one numbered row. Numbering is continuous across the field. */
const buildSentenceRows = (text) => {
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      rows.push({ type: 'subtitle', text: parsed.label });
      if (parts.length >= 2) parts.forEach(p => rows.push({ type: 'item', num: n++, text: p }));
      else rows.push({ type: 'item', num: n++, text: parsed.value });
    } else {
      rows.push({ type: 'item', num: n++, text: s });
    }
  });
  return rows;
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Session Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
    { key: 'status', label: 'Status' },
  ] },
  { title: 'Housing', fields: [
    { key: 'housing.type', label: 'Housing Type' },
    { key: 'housing.age', label: 'Building Age' },
    { key: 'housing.mold', label: 'Mold Present', type: 'bool' },
    { key: 'housing.pets', label: 'Pets', type: 'array' },
    { key: 'housing.carpeting', label: 'Carpeting', type: 'bool' },
    { key: 'housing.ventilation', label: 'Ventilation' },
    { key: 'housing.heating', label: 'Heating' },
  ] },
  { title: 'Air Quality', fields: [
    { key: 'airQuality.location', label: 'Location' },
    { key: 'airQuality.aqiAverage', label: 'AQI Average' },
    { key: 'airQuality.pollutants', label: 'Pollutants', type: 'array' },
  ] },
  { title: 'Occupational Exposures', fields: [
    { key: 'occupational', label: 'Occupational Exposures', type: 'array' },
  ] },
  { title: 'Smoking History', fields: [
    { key: 'smoking.status', label: 'Status' },
    { key: 'smoking.packYears', label: 'Pack Years' },
    { key: 'smoking.secondhandExposure', label: 'Secondhand Exposure', type: 'bool' },
    { key: 'smoking.quitDate', label: 'Quit Date' },
  ] },
  { title: 'Findings', fields: [
    { key: 'findings', label: 'Findings', type: 'sentence' },
  ] },
  { title: 'Assessment & Plan', fields: [
    { key: 'assessment', label: 'Assessment', type: 'sentence' },
    { key: 'plan', label: 'Plan', type: 'sentence' },
  ] },
  { title: 'Recommendations', fields: [
    { key: 'recommendations', label: 'Recommendations', type: 'recommendations' },
  ] },
  { title: 'Notes', fields: [
    { key: 'notes', label: 'Notes', type: 'sentence' },
  ] },
];

const isPresent = (record, f) => {
  const val = getVal(record, f.key);
  if (f.type === 'array' || f.type === 'recommendations') return Array.isArray(val) && val.filter(Boolean).length > 0;
  if (f.type === 'bool') return val !== null && val !== undefined;
  return hasVal(val);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, sectionTitle, key) => {
  const val = getVal(record, field.key);
  const showLabel = field.label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (field.type === 'array') {
    const items = (Array.isArray(val) ? val : []).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={items.length > 10}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(it)}</Text>)}
      </View>
    );
  }

  if (field.type === 'recommendations') {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length === 0) return null;
    const groups = [];
    arr.forEach(item => {
      const rd = typeof item === 'object' ? (item.date || '') : '';
      const dk = formatDate(rd) || 'No Date';
      let g = groups.find(x => x.dk === dk);
      if (!g) { g = { dk, hasDate: !!rd, items: [] }; groups.push(g); }
      g.items.push(item);
    });
    let n = 1;
    return (
      <View key={key} style={styles.fieldBox} wrap={arr.length > 8}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {groups.map((g, gi) => (
          <View key={gi} wrap={false}>
            {g.hasDate && <Text style={styles.nestedSubtitle}>{g.dk}</Text>}
            {g.items.map((item, ii) => {
              const rt = typeof item === 'object' ? (item.recommendation || '') : String(item);
              return <Text key={ii} style={styles.listItem}>{n++}. {rt}</Text>;
            })}
          </View>
        ))}
      </View>
    );
  }

  if (field.type === 'sentence') {
    if (!hasVal(val)) return null;
    const rows = buildSentenceRows(fmtVal(val));
    if (rows.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {rows.map((r, i) => r.type === 'subtitle'
          ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
          : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>)}
      </View>
    );
  }

  if (field.type === 'date') {
    if (!hasVal(val)) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={false}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (field.type === 'bool') {
    if (val === null || val === undefined) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={false}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (!hasVal(val)) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{fmtVal(val)}</Text>
    </View>
  );
};

const EnvironmentalExposuresDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.environmental_exposures && Array.isArray(data.environmental_exposures)) records = data.environmental_exposures;
  else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.environmental_exposures) records = dd.environmental_exposures;
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Environmental Exposures</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Environmental Exposures</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Environmental Exposures {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View style={styles.fieldBox} wrap={present.length > 6}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {present.map((field, fIdx) => renderField(record, field, cfg.title, fIdx))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EnvironmentalExposuresDocumentPDFTemplate;
