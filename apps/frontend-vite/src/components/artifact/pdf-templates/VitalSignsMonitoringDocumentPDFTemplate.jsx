/**
 * VitalSignsMonitoringDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — black & white only (#000000)
 * Collection: vital_signs_monitoring
 *
 * Field handling mirrors the JSX (28 non-system fields, 100% coverage):
 *   - Date    (1)  → date-picker value formatted (header)
 *   - Numbers (14) → numeric presence check (0/absent hidden, NEVER truthiness)
 *   - Strings (13) → short coded values inline (provider/facility in header)
 *
 * Rule #74: each section is ONE wrap-gated View, sectionTitle is the FIRST child,
 * wrap={items > 8 ? undefined : false}; only recordHeader is unconditionally wrap={false}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordMeta: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'blood-pressure-perfusion': 'Blood Pressure & Perfusion',
  'cardiopulmonary': 'Cardiopulmonary',
  'temperature-glucose': 'Temperature & Glucose',
  'neuro-pain': 'Neuro & Pain',
  'scoring': 'Scoring',
};

const FIELD_LABELS = {
  systolicBloodPressure: 'Systolic BP (mmHg)',
  diastolicBloodPressure: 'Diastolic BP (mmHg)',
  meanArterialPressure: 'Mean Arterial Pressure (mmHg)',
  bloodPressurePosition: 'Blood Pressure Position',
  bloodPressureSite: 'Blood Pressure Site',
  capillaryRefillTime: 'Capillary Refill Time (sec)',
  heartRate: 'Heart Rate (bpm)',
  pulseRhythm: 'Pulse Rhythm',
  pulseQuality: 'Pulse Quality',
  respiratoryRate: 'Respiratory Rate (breaths/min)',
  oxygenSaturation: 'SpO2 (%)',
  supplementalOxygen: 'Supplemental Oxygen',
  oxygenDeliveryMethod: 'Oxygen Delivery Method',
  bodyTemperature: 'Temp',
  temperatureUnit: 'Temperature Unit',
  bloodGlucoseLevel: 'Blood Glucose Level (mg/dL)',
  consciousnessLevel: 'Consciousness Level',
  glasgowComaScore: 'GCS',
  painScore: 'Pain Score (0-10)',
  pupilResponseLeft: 'Pupil Response (Left)',
  pupilResponseRight: 'Pupil Response (Right)',
  pupilSizeLeft: 'Pupil Size Left (mm)',
  pupilSizeRight: 'Pupil Size Right (mm)',
  earlyWarningScore: 'Early Warning Score',
  monitoringFrequency: 'Monitoring Frequency',
};

const SECTION_FIELDS = {
  'blood-pressure-perfusion': ['systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure', 'bloodPressurePosition', 'bloodPressureSite', 'capillaryRefillTime'],
  'cardiopulmonary': ['heartRate', 'pulseRhythm', 'pulseQuality', 'respiratoryRate', 'oxygenSaturation', 'supplementalOxygen', 'oxygenDeliveryMethod'],
  'temperature-glucose': ['bodyTemperature', 'temperatureUnit', 'bloodGlucoseLevel'],
  'neuro-pain': ['consciousnessLevel', 'glasgowComaScore', 'painScore', 'pupilResponseLeft', 'pupilResponseRight', 'pupilSizeLeft', 'pupilSizeRight'],
  'scoring': ['earlyWarningScore', 'monitoringFrequency'],
};

const SECTION_ORDER = ['blood-pressure-perfusion', 'cardiopulmonary', 'temperature-glucose', 'neuro-pain', 'scoring'];

const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = ['systolicBloodPressure', 'diastolicBloodPressure', 'heartRate', 'respiratoryRate', 'bodyTemperature', 'oxygenSaturation', 'meanArterialPressure', 'painScore', 'glasgowComaScore', 'bloodGlucoseLevel', 'pupilSizeLeft', 'pupilSizeRight', 'earlyWarningScore', 'capillaryRefillTime'];
const ARRAY_FIELDS = [];
const SENTENCE_FIELDS = [];

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

const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return !isNaN(n) && n !== 0;
};

const isBoolPresent = (v) => (typeof v === 'boolean' || v === 'true' || v === 'false');
const boolDisplay = (v) => ((v === true || v === 'true') ? 'Yes' : 'No');

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(Boolean).length > 0;
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (BOOLEAN_FIELDS.includes(fn)) return isBoolPresent(v);
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasString(v);
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

/* ======= RENDER FIELD (returns array of <Text>/<View> children, no own wrap View) ======= */
const renderFieldChildren = (record, fn, keyBase) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return [];
  const label = FIELD_LABELS[fn] || fn;
  const out = [];

  if (BOOLEAN_FIELDS.includes(fn)) {
    out.push(<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>);
    out.push(<Text key={`${keyBase}-v`} style={styles.fieldValue}>{boolDisplay(val)}</Text>);
    return out;
  }

  if (NUMBER_FIELDS.includes(fn)) {
    out.push(<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>);
    out.push(<Text key={`${keyBase}-v`} style={styles.fieldValue}>{String(Number(val))}</Text>);
    return out;
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(Boolean);
    out.push(<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>);
    items.forEach((item, i) => out.push(<Text key={`${keyBase}-i${i}`} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>));
    return out;
  }

  /* String field */
  const strVal = safeString(val);
  if (SENTENCE_FIELDS.includes(fn)) {
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      out.push(<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>);
      let n = 1;
      sentences.forEach((s, si) => {
        const parsed = parseLabel(s);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            out.push(<Text key={`${keyBase}-st${si}`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
            commaItems.forEach((ci, ci2) => out.push(<Text key={`${keyBase}-st${si}-c${ci2}`} style={styles.listItem}>{n++}. {safeString(ci)}</Text>));
            return;
          }
        }
        out.push(<Text key={`${keyBase}-s${si}`} style={styles.listItem}>{n++}. {safeString(s).replace(/[;.]+$/, '').trim()}</Text>);
      });
      return out;
    }
  }

  out.push(<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>);
  out.push(<Text key={`${keyBase}-v`} style={styles.fieldValue}>{strVal}</Text>);
  return out;
};

/* ======= RENDER SECTION — Rule #74: ONE wrap-gated View, sectionTitle FIRST child ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
  if (presentFields.length === 0) return null;

  const children = [];
  presentFields.forEach((f, fi) => {
    renderFieldChildren(record, f, `${sid}-${f}-${fi}`).forEach(c => children.push(c));
  });

  /* Wrap-gating: count rendered rows; small sections do not wrap */
  const rowCount = children.length;

  return (
    <View key={sid} style={styles.section} wrap={rowCount > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const VitalSignsMonitoringDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.vital_signs_monitoring) return Array.isArray(r.vital_signs_monitoring) ? r.vital_signs_monitoring : [r.vital_signs_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vital_signs_monitoring) return Array.isArray(dd.vital_signs_monitoring) ? dd.vital_signs_monitoring : [dd.vital_signs_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Vital Signs Monitoring</Text>
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
          <Text style={styles.documentTitle}>Vital Signs Monitoring</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
                {(record.provider || record.facility) && (
                  <Text style={styles.recordMeta}>
                    {[record.provider, record.facility].filter(Boolean).map(v => safeString(v)).join(' • ')}
                  </Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Vital Signs ${index + 1}`}
              </Text>
            </View>

            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default VitalSignsMonitoringDocumentPDFTemplate;
