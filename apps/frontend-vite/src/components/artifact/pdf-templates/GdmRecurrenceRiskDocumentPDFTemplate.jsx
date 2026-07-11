/**
 * GdmRecurrenceRiskDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: NO clinical date in schema (never
 * createdAt), values numbered ('1.' even singles), single-name label gate, per-field SENTINEL-ZERO
 * (ZERO_SENTINEL_FIELDS 0 = not measured → hidden), booleans Yes/No, positional OGTT numeric array (nulls
 * suppressed, timepoint labels), narratives split on [.;]. safeString scrubs non-Latin-1 glyphs. Rule #74:
 * each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View.
 * Static PHI footer. Collection: gdm_recurrence_risk.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['recurrence-score', 'glucose-status', 'risk-factors', 'weight-metrics'];
const SECTION_TITLES = {
  'recurrence-score': 'Recurrence Score', 'glucose-status': 'Glucose Status', 'risk-factors': 'Risk Factors', 'weight-metrics': 'Weight Metrics',
};
const FIELD_LABELS = {
  gdmRecurrenceScore: 'GDM Recurrence Score', previousGdmGestationalAge: 'Previous GDM Gestational Age', previousGdmTreatment: 'Previous GDM Treatment', previousMacrosomia: 'Previous Macrosomia',
  hba1cLevel: 'HbA1c Level', fastingGlucoseLevel: 'Fasting Glucose Level', postpartumGlucoseTolerance: 'Postpartum Glucose Tolerance', oralGlucoseToleranceResults: 'Oral Glucose Tolerance Results', insulinResistanceMarkers: 'Insulin Resistance Markers',
  familyHistoryDiabetes: 'Family History of Diabetes', polycysticOvarySyndrome: 'Polycystic Ovary Syndrome', ethnicRiskFactor: 'Ethnic Risk Factor', maternalAge: 'Maternal Age', previousStillbirth: 'Previous Stillbirth', chronicHypertension: 'Chronic Hypertension', thyroidDysfunction: 'Thyroid Dysfunction',
  pregestationalBmi: 'Pregestational BMI', interpregnancyWeightGain: 'Interpregnancy Weight Gain', interpregnancyInterval: 'Interpregnancy Interval', metabolicSyndromeComponents: 'Metabolic Syndrome Components',
};
const SECTION_FIELDS = {
  'recurrence-score': ['gdmRecurrenceScore', 'previousGdmGestationalAge', 'previousGdmTreatment', 'previousMacrosomia'],
  'glucose-status': ['hba1cLevel', 'fastingGlucoseLevel', 'postpartumGlucoseTolerance', 'oralGlucoseToleranceResults', 'insulinResistanceMarkers'],
  'risk-factors': ['familyHistoryDiabetes', 'polycysticOvarySyndrome', 'ethnicRiskFactor', 'maternalAge', 'previousStillbirth', 'chronicHypertension', 'thyroidDysfunction'],
  'weight-metrics': ['pregestationalBmi', 'interpregnancyWeightGain', 'interpregnancyInterval', 'metabolicSyndromeComponents'],
};
const NUMBER_FIELDS = ['pregestationalBmi', 'previousGdmGestationalAge', 'interpregnancyWeightGain', 'hba1cLevel', 'fastingGlucoseLevel', 'maternalAge', 'gdmRecurrenceScore', 'interpregnancyInterval', 'metabolicSyndromeComponents'];
const ZERO_SENTINEL_FIELDS = ['pregestationalBmi', 'previousGdmGestationalAge', 'hba1cLevel', 'fastingGlucoseLevel', 'maternalAge', 'gdmRecurrenceScore', 'interpregnancyInterval'];
const BOOLEAN_FIELDS = ['familyHistoryDiabetes', 'previousMacrosomia', 'polycysticOvarySyndrome', 'previousStillbirth', 'chronicHypertension'];
const ARRAY_FIELDS = ['oralGlucoseToleranceResults'];
const OGTT_TIMEPOINTS = ['Fasting', '1-Hour', '2-Hour', '3-Hour'];
const ogttLabel = (i) => OGTT_TIMEPOINTS[i] || `Timepoint ${i + 1}`;

const numericPresent = (fn, v) => { if (typeof v === 'number' && v === 0 && ZERO_SENTINEL_FIELDS.includes(fn)) return false; return v !== null && v !== undefined && v !== ''; };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.includes(fn)) return numericPresent(fn, v); return !isEmptyDeep(v); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  let body;
  if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (ARRAY_FIELDS.includes(f)) {
    const arr = Array.isArray(val) ? val : [];
    const present = arr.map((item, i) => ({ item, i })).filter(({ item }) => item !== null && item !== undefined && item !== '');
    if (present.length === 0) return [];
    let n = 1;
    body = present.map(({ item, i }) => <Text key={i} style={styles.value}>{n++}. {ogttLabel(i)} - {safeString(item)}</Text>);
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const GdmRecurrenceRiskDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].gdm_recurrence_risk && Array.isArray(templateData[0].gdm_recurrence_risk)) records = templateData[0].gdm_recurrence_risk;
    else records = templateData;
  } else if (templateData && templateData.gdm_recurrence_risk) {
    records = Array.isArray(templateData.gdm_recurrence_risk) ? templateData.gdm_recurrence_risk : [templateData.gdm_recurrence_risk];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.gdm_recurrence_risk ? (Array.isArray(dd.gdm_recurrence_risk) ? dd.gdm_recurrence_risk : [dd.gdm_recurrence_risk]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>GDM Recurrence Risk</Text></View>
        <Text style={styles.emptyState}>No GDM recurrence risk records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>GDM Recurrence Risk</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`GDM Recurrence Risk ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, record[f]));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default GdmRecurrenceRiskDocumentPDFTemplate;
