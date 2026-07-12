/**
 * PreeclampsiaMonitoringDocumentPDFTemplate.jsx
 * Box-free — Helvetica — LETTER size — preeclampsia monitoring
 * Collection: preeclampsia_monitoring
 *
 * Bare underlined labels (no boxes): documentTitle / sectionTitle / fieldLabel each carry their own
 * borderBottom rule; anti-orphan glue keeps each section title with its first field.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 18 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 14 },
  recordMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  recordMeta: { fontSize: 12, color: '#555555', marginRight: 16 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  fieldBox: { marginBottom: 10 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#555555', textAlign: 'center', marginTop: 40 },
});

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_TITLES = {
  'vitals': 'Vitals & Gestational Age',
  'lab-results': 'Laboratory Results',
  'fetal-assessment': 'Fetal Assessment',
  'symptoms': 'Symptoms',
  'clinical-status': 'Clinical Status & Management',
};

const FIELD_LABELS = {
  systolicBloodPressure: 'Systolic Blood Pressure (mmHg)',
  diastolicBloodPressure: 'Diastolic Blood Pressure (mmHg)',
  gestationalAge: 'Gestational Age (weeks)',
  proteinuria24Hour: '24-Hour Proteinuria (mg)',
  proteinCreatinineRatio: 'Protein:Creatinine Ratio',
  dipstickProteinuria: 'Dipstick Proteinuria',
  serumCreatinine: 'Serum Creatinine (mg/dL)',
  plateletCount: 'Platelet Count (x10³/µL)',
  altLevel: 'ALT Level (U/L)',
  astLevel: 'AST Level (U/L)',
  ldhLevel: 'LDH Level (U/L)',
  serumAlbumin: 'Serum Albumin (g/dL)',
  uricAcidLevel: 'Uric Acid Level (mg/dL)',
  fetalWeightPercentile: 'Fetal Weight Percentile',
  umbilicalArteryDoppler: 'Umbilical Artery Doppler',
  middleCerebralArteryDoppler: 'Middle Cerebral Artery Doppler',
  amnioticFluidVolume: 'Amniotic Fluid Volume',
  visualDisturbances: 'Visual Disturbances',
  severeHeadache: 'Severe Headache',
  epigastricPain: 'Epigastric Pain',
  preeclampsiaWithSevereFeatures: 'Preeclampsia With Severe Features',
  hellpSyndrome: 'HELLP Syndrome',
  magnesiumSulfateAdministration: 'Magnesium Sulfate Administration',
  antihypertensiveMedication: 'Antihypertensive Medication',
};

const SECTION_FIELDS = {
  'vitals': ['systolicBloodPressure', 'diastolicBloodPressure', 'gestationalAge'],
  'lab-results': ['proteinuria24Hour', 'proteinCreatinineRatio', 'dipstickProteinuria', 'serumCreatinine', 'plateletCount', 'altLevel', 'astLevel', 'ldhLevel', 'serumAlbumin', 'uricAcidLevel'],
  'fetal-assessment': ['fetalWeightPercentile', 'umbilicalArteryDoppler', 'middleCerebralArteryDoppler', 'amnioticFluidVolume'],
  'symptoms': ['visualDisturbances', 'severeHeadache', 'epigastricPain'],
  'clinical-status': ['preeclampsiaWithSevereFeatures', 'hellpSyndrome', 'magnesiumSulfateAdministration', 'antihypertensiveMedication'],
};

const SECTION_ORDER = ['vitals', 'lab-results', 'fetal-assessment', 'symptoms', 'clinical-status'];
const BOOLEAN_FIELDS = ['visualDisturbances', 'severeHeadache', 'epigastricPain', 'preeclampsiaWithSevereFeatures', 'hellpSyndrome', 'magnesiumSulfateAdministration'];
const NUMBER_FIELDS = ['systolicBloodPressure', 'diastolicBloodPressure', 'proteinuria24Hour', 'proteinCreatinineRatio', 'serumCreatinine', 'plateletCount', 'altLevel', 'astLevel', 'ldhLevel', 'serumAlbumin', 'gestationalAge', 'uricAcidLevel', 'fetalWeightPercentile'];
const COMMA_SPLIT_FIELDS = ['umbilicalArteryDoppler', 'middleCerebralArteryDoppler'];

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) return new Date(val.$date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  else s = String(val);
  /* printable-only scrub (Helvetica has no × glyph; normalize smart punctuation) */
  return s.replace(/×/g, 'x').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...');
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const shouldCommaSplit = (fn, strVal) => COMMA_SPLIT_FIELDS.includes(fn) && !parseLabel(strVal).isLabeled && splitBySentence(strVal).length <= 1 && splitByComma(strVal).length >= 2;

/* stringValueElements: mirrors the JSX renderStringField / formatSentenceFieldLines.
   Multi-sentence (or a single "Label: a, b, c") → numbered listItems (+ sub-label); single → one value. */
const stringValueElements = (strVal) => {
  const s = safeString(strVal);
  const sentences = splitBySentence(s);
  const pw = parseLabel(s);
  const singleLabeled = sentences.length === 1 && pw.isLabeled && splitByComma(pw.value).length >= 2;
  if (sentences.length <= 1 && !singleLabeled) {
    return [<Text style={styles.fieldValue}>{s}</Text>];
  }
  const els = [];
  let n = 1;
  const src = singleLabeled ? [s] : sentences;
  src.forEach((sent) => {
    const parsed = parseLabel(sent);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) {
        parts.forEach((p) => els.push(<Text style={styles.listItem}>{n++}. {safeString(p)}</Text>));
      } else {
        els.push(<Text style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      els.push(<Text style={styles.listItem}>{n++}. {safeString(sent)}</Text>);
    }
  });
  return els;
};

/* one field = its bare underlined label + value/list body */
const renderFieldBox = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  let body;
  if (BOOLEAN_FIELDS.includes(fn)) {
    body = [<Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>];
  } else if (NUMBER_FIELDS.includes(fn)) {
    body = [<Text style={styles.fieldValue}>{safeString(val)}</Text>];
  } else if (COMMA_SPLIT_FIELDS.includes(fn) && shouldCommaSplit(fn, safeString(val))) {
    body = splitByComma(safeString(val)).map((p, i) => <Text style={styles.listItem}>{i + 1}. {safeString(p)}</Text>);
  } else {
    body = stringValueElements(val);
  }
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {body.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

/* Anti-orphan: glue the section title to its first field (wrap={false}), rest flow. */
const renderSection = (record, sid) => {
  const fields = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
  if (fields.length === 0) return null;
  const boxes = fields.map(f => renderFieldBox(record, f)).filter(Boolean);
  if (boxes.length === 0) return null;
  const [first, ...rest] = boxes;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

const PreeclampsiaMonitoringDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].preeclampsia_monitoring && Array.isArray(docProp[0].preeclampsia_monitoring)) {
      records = docProp[0].preeclampsia_monitoring;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.preeclampsia_monitoring) {
    records = Array.isArray(docProp.preeclampsia_monitoring) ? docProp.preeclampsia_monitoring : [docProp.preeclampsia_monitoring];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preeclampsia Monitoring</Text>
          <Text style={styles.noDataText}>No preeclampsia monitoring data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preeclampsia Monitoring</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.gestationalAge) && (
                <View style={styles.recordMetaRow}>
                  <Text style={styles.recordMeta}>GA: {safeString(record.gestationalAge)} weeks</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Preeclampsia Monitoring {idx + 1}</Text>
            </View>
            {SECTION_ORDER.map(sid => <React.Fragment key={sid}>{renderSection(record, sid)}</React.Fragment>)}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreeclampsiaMonitoringDocumentPDFTemplate;
