/**
 * EmsRunReportsDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: ems_run_reports. Mirrors EmsRunReportsDocument.jsx (4-area rule):
 * numbered value rows, single-name gate, numeric fields carry unit + score interpretation inline,
 * paren-aware [.;] sentence split, section title rides INSIDE the first field's glue View,
 * per-field wrap={false} anti-orphan, break={idx>0}. (The JSX bar-chart visualization is screen-only;
 * the PDF renders the same data as text rows.)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'incident-times': 'Incident & Response Times',
  'chief-complaint': 'Chief Complaint',
  'mechanism-injury': 'Mechanism of Injury',
  'vital-signs': 'Vital Signs',
  'assessment-scores': 'Assessment Scores',
  'ecg-rhythm': 'ECG Rhythm',
  'airway-interventions': 'Airway & Interventions',
  'medications-administered': 'Medications Administered',
  'disposition-transport': 'Disposition & Transport',
};
const FIELD_LABELS = {
  incidentNumber: 'Incident Number', dispatchTime: 'Dispatch Time', arrivalTime: 'Arrival Time',
  transportTime: 'Transport Time', hospitalArrivalTime: 'Hospital Arrival Time',
  chiefComplaint: 'Chief Complaint', mechanismOfInjury: 'Mechanism of Injury',
  glasgowComaScale: 'Glasgow Coma Scale', initialBloodPressure: 'Blood Pressure', initialHeartRate: 'Heart Rate',
  initialRespiratoryRate: 'Respiratory Rate', oxygenSaturation: 'Oxygen Saturation', bloodGlucose: 'Blood Glucose',
  bodyTemperature: 'Body Temperature', ecgRhythm: 'ECG Rhythm', traumaScore: 'Trauma Score', painScore: 'Pain Score',
  strokeScale: 'Stroke Scale (NIHSS)', airwayManagement: 'Airway Management', ivAccessEstablished: 'IV Access Established',
  cprPerformed: 'CPR Performed', defibrillationAttempts: 'Defibrillation Attempts',
  medicationsAdministered: 'Medications Administered', patientDisposition: 'Patient Disposition', receivingFacility: 'Receiving Facility',
};
const SECTION_FIELDS = {
  'incident-times': ['incidentNumber', 'dispatchTime', 'arrivalTime', 'transportTime', 'hospitalArrivalTime'],
  'chief-complaint': ['chiefComplaint'],
  'mechanism-injury': ['mechanismOfInjury'],
  'vital-signs': ['glasgowComaScale', 'initialBloodPressure', 'initialHeartRate', 'initialRespiratoryRate', 'oxygenSaturation', 'bloodGlucose', 'bodyTemperature'],
  'assessment-scores': ['traumaScore', 'painScore', 'strokeScale'],
  'ecg-rhythm': ['ecgRhythm'],
  'airway-interventions': ['airwayManagement', 'ivAccessEstablished', 'cprPerformed', 'defibrillationAttempts'],
  'medications-administered': ['medicationsAdministered'],
  'disposition-transport': ['patientDisposition', 'receivingFacility'],
};
const NUMBER_FIELDS = ['glasgowComaScale', 'initialHeartRate', 'initialRespiratoryRate', 'oxygenSaturation', 'bloodGlucose', 'bodyTemperature', 'traumaScore', 'painScore', 'strokeScale', 'defibrillationAttempts'];
const ZERO_SENTINEL_FIELDS = ['bloodGlucose', 'bodyTemperature', 'traumaScore', 'painScore', 'strokeScale'];
const BOOLEAN_FIELDS = ['ivAccessEstablished', 'cprPerformed'];
const SENTENCE_FIELDS = ['chiefComplaint', 'mechanismOfInjury', 'airwayManagement'];
const ARRAY_FIELDS = ['medicationsAdministered'];
const VITAL_CHART_CONFIG = {
  glasgowComaScale: { unit: '/15', testType: 'gcs' }, initialHeartRate: { unit: ' bpm', testType: 'heartRate' },
  initialRespiratoryRate: { unit: ' breaths/min', testType: 'respiratoryRate' }, oxygenSaturation: { unit: '%', testType: 'oxygenSaturation' },
  bloodGlucose: { unit: ' mg/dL', testType: 'bloodGlucose' }, bodyTemperature: { unit: '°F', testType: 'bodyTemperature' },
};
const ASSESSMENT_CHART_CONFIG = {
  traumaScore: { unit: '/12', testType: 'traumaScore' }, painScore: { unit: '/10', testType: 'painScore' }, strokeScale: { unit: '/42', testType: 'strokeScale' },
};

/* ═══════ SCORE INTERPRETATION ═══════ */
const SCORE_RANGES = {
  gcs: { normalMin: 15, concernMin: 13, higherIsBetter: true },
  heartRate: { normalMin: 60, normalMax: 100, mildMin: 50, mildMax: 120, bidirectional: true },
  respiratoryRate: { normalMin: 12, normalMax: 20, mildMin: 10, mildMax: 24, bidirectional: true },
  oxygenSaturation: { normalMin: 95, concernMin: 90, higherIsBetter: true },
  bloodGlucose: { normalMin: 70, normalMax: 140, mildMin: 60, mildMax: 180, bidirectional: true },
  bodyTemperature: { normalMin: 97, normalMax: 99.5, mildMin: 96, mildMax: 100.4, bidirectional: true },
  traumaScore: { normalMin: 12, concernMin: 10, higherIsBetter: true },
  painScore: { normalMax: 3, concernMax: 6, higherIsBetter: false },
  strokeScale: { normalMax: 0, concernMax: 4, higherIsBetter: false },
};
const SCORE_INTERPRETATIONS = {
  gcs: { normal: 'Normal', concern: 'Mild TBI', abnormal: 'Severe TBI' },
  heartRate: { normal: 'Normal', mildLow: 'Mild Bradycardia', low: 'Bradycardia', mildHigh: 'Mild Tachycardia', high: 'Tachycardia' },
  respiratoryRate: { normal: 'Normal', mildLow: 'Mild Bradypnea', low: 'Bradypnea', mildHigh: 'Mild Tachypnea', high: 'Tachypnea' },
  oxygenSaturation: { normal: 'Normal', concern: 'Mild Hypoxemia', abnormal: 'Hypoxemia' },
  bloodGlucose: { normal: 'Normal', mildLow: 'Mild Hypoglycemia', low: 'Hypoglycemia', mildHigh: 'Mild Hyperglycemia', high: 'Hyperglycemia' },
  bodyTemperature: { normal: 'Normal', mildLow: 'Mild Hypothermia', low: 'Hypothermia', mildHigh: 'Low-Grade Fever', high: 'Fever' },
  traumaScore: { normal: 'Normal', concern: 'Mild', abnormal: 'Severe' },
  painScore: { normal: 'Mild/None', concern: 'Moderate', abnormal: 'Severe' },
  strokeScale: { normal: 'Normal', concern: 'Minor Stroke', abnormal: 'Moderate-Severe Stroke' },
};
const getScoreInterpretation = (value, testType) => {
  if (value === null || value === undefined) return '';
  const range = SCORE_RANGES[testType]; const interp = SCORE_INTERPRETATIONS[testType];
  if (!range || !interp) return '';
  if (range.bidirectional) {
    if (value >= range.normalMin && value <= range.normalMax) return interp.normal;
    if (value < range.normalMin) { if (value >= range.mildMin) return interp.mildLow; return interp.low; }
    if (value <= range.mildMax) return interp.mildHigh;
    return interp.high;
  }
  if (range.higherIsBetter) {
    if (value >= range.normalMin) return interp.normal;
    if (value >= range.concernMin) return interp.concern;
    return interp.abnormal;
  }
  if (value <= range.normalMax) return interp.normal;
  if (value <= range.concernMax) return interp.concern;
  return interp.abnormal;
};

/* ═══════ UTILS ═══════ */
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return true;
};
const safeString = (v) => (v === null || v === undefined) ? '' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
/* paren-aware sentence split: top-level (depth 0) [.;] + whitespace; abbrev-guarded '.'; keeps /[.;]/ */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const ABBR = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i;
  const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    if (depth === 0 && /[.;]/.test(ch)) {
      const next = text[i + 1];
      const boundary = next === undefined || /\s/.test(next);
      const abbrev = ch === '.' && ABBR.test(current);
      if (boundary && !abbrev) { const t = current.trim(); if (t) parts.push(t); current = ''; continue; }
    }
    current += ch;
  }
  const t = current.trim(); if (t) parts.push(t);
  return parts.map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
/* paren-aware comma split with Oxford (and/or) + numeric guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      const between = /\d$/.test(cur) && /^\d/.test(rest);
      if (/^(and|or)\b/i.test(rest) || between) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    }
    else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length > 0 ? out : [text];
};

const fieldPresent = (record, fn) => {
  const v = record[fn];
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => String(x).trim() !== '').length > 0;
  if (!hasVal(v)) return false;
  if (ZERO_SENTINEL_FIELDS.includes(fn) && v === 0) return false;
  return true;
};

/* rows for a field → array of {sub?} | {value} (mirror the JSX Copy numbering) */
const fieldRows = (record, fn) => {
  const val = record[fn];
  const rows = [];
  if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    items.forEach((item, i) => rows.push({ value: `${i + 1}. ${safeString(item)}` }));
  } else if (SENTENCE_FIELDS.includes(fn)) {
    let n = 1;
    splitBySentence(safeString(val)).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        rows.push({ sub: parsed.label });
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) parts.forEach(p => rows.push({ value: `${n++}. ${p}` }));
        else rows.push({ value: `${n++}. ${parsed.value}` });
      } else { rows.push({ value: `${n++}. ${s}` }); }
    });
  } else if (NUMBER_FIELDS.includes(fn)) {
    const cfg = VITAL_CHART_CONFIG[fn] || ASSESSMENT_CHART_CONFIG[fn];
    const interp = cfg ? getScoreInterpretation(val, cfg.testType) : '';
    rows.push({ value: `1. ${val}${cfg ? cfg.unit : ''}${interp ? ` (${interp})` : ''}` });
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    rows.push({ value: `1. ${val ? 'Yes' : 'No'}` });
  } else {
    rows.push({ value: `1. ${safeString(val)}` });
  }
  return rows;
};

/* one field = one glue View (anti-orphan). sectionTitle rides on the first present field. single-name gate. */
const renderField = (record, fn, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label !== sectionTitle;
  const rows = fieldRows(record, fn);
  return (
    <View key={fn} style={styles.fieldGroup} wrap={rows.length > 22 ? true : false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.sub
        ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
        : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null));
};

/* ═══════ MAIN ═══════ */
const EmsRunReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.ems_run_reports) return Array.isArray(r.ems_run_reports) ? r.ems_run_reports : [r.ems_run_reports];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.ems_run_reports) return Array.isArray(dd.ems_run_reports) ? dd.ems_run_reports : [dd.ems_run_reports];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  const DOC_TITLE = 'EMS Run Reports';

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No EMS run report records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`EMS Run Report ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EmsRunReportsDocumentPDFTemplate;
