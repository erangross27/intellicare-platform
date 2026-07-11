/**
 * ExcessiveGlucoseMonitoringDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors ExcessiveGlucoseMonitoringDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: excessive_glucose_monitoring.
 * react-pdf: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 * Sentence fields (psychologicalEvaluation/interventionRecommended) sentence-split + aggressive comma-split
 * + numbered; anxietyScreeningScore/testStripUtilization/costImpact hide a stored 0 (= not assessed).
 * Title/section/label each get a borderBottom underline (no boxes).
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

/* Fields whose stored 0 = "not assessed" → hidden (mirror JSX ZERO_SENTINEL_FIELDS). */
const ZERO_SENTINEL = ['anxietyScreeningScore', 'testStripUtilization', 'costImpact'];

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Session Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
  ] },
  { title: 'Monitoring Details', fields: [
    { key: 'monitoringFrequency', label: 'Monitoring Frequency', type: 'number' },
    { key: 'prescribedFrequency', label: 'Prescribed Frequency', type: 'number' },
    { key: 'excessCheckCount', label: 'Excess Check Count', type: 'number' },
    { key: 'diabetesType', label: 'Diabetes Type' },
    { key: 'insulinRegimen', label: 'Insulin Regimen' },
  ] },
  { title: 'Clinical Indicators', fields: [
    { key: 'hemoglobinA1c', label: 'Hemoglobin A1c', type: 'number' },
    { key: 'glucoseVariability', label: 'Glucose Variability' },
    { key: 'hypoglycemiaEpisodes', label: 'Hypoglycemia Episodes', type: 'number' },
    { key: 'anxietyScreeningScore', label: 'Anxiety Screening Score', type: 'number', zeroSentinel: true },
  ] },
  { title: 'Monitoring Resources', fields: [
    { key: 'testStripUtilization', label: 'Test Strip Utilization', type: 'number', zeroSentinel: true },
    { key: 'continuousGlucoseMonitor', label: 'Continuous Glucose Monitor' },
    { key: 'monitoringTriggers', label: 'Monitoring Triggers', type: 'array' },
    { key: 'costImpact', label: 'Cost Impact', type: 'number', zeroSentinel: true },
  ] },
  { title: 'Education & Evaluation', fields: [
    { key: 'diabetesEducationDate', label: 'Diabetes Education Date', type: 'date' },
    { key: 'psychologicalEvaluation', label: 'Psychological Evaluation', type: 'sentence' },
  ] },
  { title: 'Intervention Plan', fields: [
    { key: 'interventionRecommended', label: 'Intervention Recommended', type: 'sentence' },
    { key: 'alternativeMonitoringOffered', label: 'Alternative Monitoring Offered' },
    { key: 'fingerInjuryPresent', label: 'Finger Injury Present' },
  ] },
  { title: 'Support & Coverage', fields: [
    { key: 'caregiverInfluence', label: 'Caregiver Influence' },
    { key: 'insuranceCoverage', label: 'Insurance Coverage' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  if (f.type === 'number') return hasVal(v) && !((f.zeroSentinel || ZERO_SENTINEL.includes(f.key)) && Number(v) === 0);
  return hasVal(v);
};

/* renderSentenceSection: narrative field → numbered lines (mirrors JSX formatSentenceFieldLines). */
const renderSentenceSection = (label, text, key) => {
  const sentences = splitBySentence(fmtVal(text));
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
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

/* renderArraySection: string[] → numbered list (parseLabel sub-heading + comma-split when labeled). */
const renderArraySection = (label, arr, key) => {
  const items = (Array.isArray(arr) ? arr : []).filter(Boolean);
  if (items.length === 0) return null;
  const rows = []; let n = 1;
  items.forEach(item => {
    const iv = safeString(item);
    const p = parseLabel(iv);
    if (p.isLabeled) {
      const parts = splitByComma(p.value);
      rows.push({ type: 'sub', text: safeString(p.label) });
      parts.forEach(part => rows.push({ type: 'item', text: safeString(part), num: n++ }));
    } else { rows.push({ type: 'item', text: iv, num: n++ }); }
  });
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = (field.label || '').toLowerCase() !== (sectionTitle || '').toLowerCase();
  if (field.type === 'sentence') return renderSentenceSection(field.label, val, key);
  if (field.type === 'array') return renderArraySection(field.label, val, key);

  const display = field.type === 'date' ? formatDate(val) : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const ExcessiveGlucoseMonitoringDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.excessive_glucose_monitoring) return Array.isArray(r.excessive_glucose_monitoring) ? r.excessive_glucose_monitoring : [r.excessive_glucose_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.excessive_glucose_monitoring) return Array.isArray(dd.excessive_glucose_monitoring) ? dd.excessive_glucose_monitoring : [dd.excessive_glucose_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Excessive Glucose Monitoring</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Excessive Glucose Monitoring</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Excessive Glucose Monitoring {idx + 1}</Text>
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

export default ExcessiveGlucoseMonitoringDocumentPDFTemplate;
