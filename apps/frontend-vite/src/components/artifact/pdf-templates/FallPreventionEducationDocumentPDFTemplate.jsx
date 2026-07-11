/**
 * FallPreventionEducationDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors FallPreventionEducationDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: fall_prevention_education.
 * react-pdf: wrap is BOOLEAN only; each section glues its title to the first field so it never orphans.
 * Numbers carry their display suffix ("48/56", "11 seconds"); sentinel-0 numerics hidden (FES-I min is
 * 7 → 0 impossible) EXCEPT fallHistoryPreviousYear (0 falls = REAL count). Enums (impairment severity,
 * assistive device) render canonical casing. Sentence fields split on [.;] + guarded comma-split
 * (labeled ≥2 / unlabeled ≥3 — adjective pairs stay whole) + numbered. NO date in this schema
 * (createdAt = ingestion timestamp, never rendered). Title/section/label get borderBottom underlines.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Number display suffixes + hide-zero (mirror JSX): sentinel-0 hidden unless doctor-edited;
   fallHistoryPreviousYear 0 = REAL count → always shows. */
const NUMBER_SUFFIX = {
  bergBalanceScale: '/56',
  timedUpAndGoTest: ' seconds',
  functionalReachTest: ' inches',
  fallHistoryPreviousYear: ' falls',
  vitaminDLevelNgMl: ' ng/mL',
};
const ZERO_SENTINEL_FIELDS = ['fallRiskAssessmentScore', 'bergBalanceScale', 'timedUpAndGoTest', 'functionalReachTest', 'fearOfFallingScale', 'vitaminDLevelNgMl'];
const numberShows = (record, fn) => {
  const val = record?.[fn];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0 && ZERO_SENTINEL_FIELDS.includes(fn)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
  }
  return true;
};

/* Enum canonical casing (mirror JSX ENUM_OPTIONS/enumCanonical). */
const ENUM_OPTIONS = {
  cognitiveImpairmentSeverity: ['None', 'Mild', 'Moderate', 'Severe'],
  visualAcuityImpairment: ['None', 'Mild', 'Moderate', 'Severe'],
  assistiveDeviceType: ['None', 'Cane', 'Quad Cane', 'Walker', 'Rollator', 'Wheelchair', 'Crutches'],
};
const enumCanonical = (fn, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = (ENUM_OPTIONS[fn] || []).find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* buildRows: sentence → numbered rows. Labeled → sub-heading + comma parts (≥2); unlabeled → comma
   parts only for REAL lists (≥3 — "supportive, non-slip shoes" adjective pairs stay whole). */
const buildRows = (items) => {
  const rows = []; let n = 1;
  items.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 3) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  return rows;
};

const renderRowsBlock = (label, rows, key) => {
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Assessment Scores', fields: [
    { key: 'fallRiskAssessmentScore', label: 'Fall Risk Assessment Score', type: 'number' },
    { key: 'bergBalanceScale', label: 'Berg Balance Scale', type: 'number' },
    { key: 'timedUpAndGoTest', label: 'Timed Up and Go Test', type: 'number' },
    { key: 'functionalReachTest', label: 'Functional Reach Test', type: 'number' },
    { key: 'fearOfFallingScale', label: 'Fear of Falling Scale', type: 'number' },
    { key: 'fallHistoryPreviousYear', label: 'Fall History Previous Year', type: 'number' },
    { key: 'vitaminDLevelNgMl', label: 'Vitamin D Level', type: 'number' },
  ] },
  { title: 'Clinical Findings', fields: [
    { key: 'orthostasisPresent', label: 'Orthostasis Present', type: 'bool' },
    { key: 'cognitiveImpairmentSeverity', label: 'Cognitive Impairment Severity', type: 'enum' },
    { key: 'visualAcuityImpairment', label: 'Visual Acuity Impairment', type: 'enum' },
    { key: 'peripheralNeuropathyPresent', label: 'Peripheral Neuropathy Present', type: 'bool' },
    { key: 'polypharmacyPresent', label: 'Polypharmacy Present', type: 'bool' },
  ] },
  { title: 'Medications & Fall Risk', fields: [
    { key: 'medicationsFallRisk', label: 'Medications Fall Risk', type: 'array' },
    { key: 'medicationReviewCompleted', label: 'Medication Review Completed', type: 'bool' },
  ] },
  { title: 'Gait & Mobility', fields: [
    { key: 'gaitAbnormalities', label: 'Gait Abnormalities', type: 'array' },
    { key: 'assistiveDeviceType', label: 'Assistive Device Type', type: 'enum' },
  ] },
  { title: 'Home Hazards Identified', fields: [
    { key: 'homeHazardsIdentified', label: 'Home Hazards Identified', type: 'array' },
  ] },
  { title: 'Exercise & Balance Training', fields: [
    { key: 'strengthTrainingRecommended', label: 'Strength Training Recommended', type: 'bool' },
    { key: 'balanceTrainingType', label: 'Balance Training Type', type: 'sentence' },
  ] },
  { title: 'Footwear Assessment', fields: [
    { key: 'footwearAssessment', label: 'Footwear Assessment', type: 'sentence' },
  ] },
  { title: 'Education Topics Covered', fields: [
    { key: 'educationTopicsCovered', label: 'Education Topics Covered', type: 'array' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'number') return numberShows(record, f.key);
  if (f.type === 'bool') return typeof v === 'boolean';
  if (f.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasVal(v);
};

/* renderField: one wrap-glued View per field. Single-name gate: label == section title → hidden. */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = (field.label || '').toLowerCase() !== (sectionTitle || '').toLowerCase();
  if (field.type === 'sentence') {
    const rows = buildRows(splitBySentence(fmtVal(val)));
    if (rows.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {rows.map((row, i) => row.type === 'sub'
          ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
          : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
      </View>
    );
  }
  if (field.type === 'array') {
    const rows = (Array.isArray(val) ? val : []).filter(Boolean).map((t, i) => ({ type: 'item', text: safeString(String(t)), num: i + 1 }));
    if (rows.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {rows.map((row, i) => <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
      </View>
    );
  }

  const display = field.type === 'enum' ? enumCanonical(field.key, val)
    : field.type === 'bool' ? (val ? 'Yes' : 'No')
    : field.type === 'number' ? safeString(`${val}${NUMBER_SUFFIX[field.key] || ''}`)
    : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const FallPreventionEducationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fall_prevention_education) return Array.isArray(r.fall_prevention_education) ? r.fall_prevention_education : [r.fall_prevention_education];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fall_prevention_education) return Array.isArray(dd.fall_prevention_education) ? dd.fall_prevention_education : [dd.fall_prevention_education]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Fall Prevention Education</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Fall Prevention Education</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            {/* NO date in this schema (createdAt = ingestion timestamp, never rendered) */}
            <Text style={styles.recordTitle}>Fall Prevention Education {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], cfg.title, 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, cfg.title, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FallPreventionEducationDocumentPDFTemplate;
