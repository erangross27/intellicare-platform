/**
 * CervicalLengthMeasurementDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoved the whole record to page 2 —
 * the empty-first-page bug this rewrite fixes); each field is its own glue unit with the
 * section title riding inside the first field's View (anti-orphan, memory 6a2d6af6).
 * Collection: cervical_length_measurement
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'measurement': 'Measurement',
  'morphology': 'Cervical Morphology',
  'cerclage-context': 'Cerclage & Context',
  'risk-recs': 'Risk & Recommendations',
};

const FIELD_LABELS = {
  gestationalAge: 'Gestational Age',
  cervicalLengthCentimeters: 'Cervical Length (cm)',
  cervicalLengthPercentile: 'Cervical Length Percentile',
  measurementTechnique: 'Measurement Technique',
  shortestMeasurement: 'Shortest Measurement (cm)',
  multipleMeasurementsObtained: 'Multiple Measurements Obtained',
  measurementConfidence: 'Measurement Confidence',
  internalOsAppearance: 'Internal Os Appearance',
  externalOsAppearance: 'External Os Appearance',
  cervicalFunneling: 'Cervical Funneling',
  funnelingLength: 'Funneling Length (mm)',
  funnelingWidth: 'Funneling Width (mm)',
  cervicalEchogenicity: 'Cervical Echogenicity',
  cervicalChange: 'Cervical Change',
  cervicalCerclagePresent: 'Cervical Cerclage Present',
  cerclageType: 'Cerclage Type',
  placentalLocation: 'Placental Location',
  amniotiFluidVolume: 'Amniotic Fluid Volume',
  bladderEmptyingStatus: 'Bladder Emptying Status',
  cervicalLengthRisk: 'Cervical Length Risk',
  repeatMeasurementRecommended: 'Repeat Measurement Recommended',
};

const SECTION_FIELDS = {
  'measurement': ['gestationalAge', 'cervicalLengthCentimeters', 'cervicalLengthPercentile', 'measurementTechnique', 'shortestMeasurement', 'multipleMeasurementsObtained', 'measurementConfidence'],
  'morphology': ['internalOsAppearance', 'externalOsAppearance', 'cervicalFunneling', 'funnelingLength', 'funnelingWidth', 'cervicalEchogenicity', 'cervicalChange'],
  'cerclage-context': ['cervicalCerclagePresent', 'cerclageType', 'placentalLocation', 'amniotiFluidVolume', 'bladderEmptyingStatus'],
  'risk-recs': ['cervicalLengthRisk', 'repeatMeasurementRecommended'],
};

const BOOLEAN_FIELDS = ['cervicalFunneling', 'cervicalCerclagePresent', 'repeatMeasurementRecommended', 'multipleMeasurementsObtained'];
const NUMBER_FIELDS = ['cervicalLengthCentimeters', 'cervicalLengthPercentile', 'funnelingLength', 'funnelingWidth', 'shortestMeasurement'];

/* ======= UTILS ======= */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return !isNaN(n) && n !== 0;
};

const isBoolPresent = (v) => (typeof v === 'boolean' || v === 'true' || v === 'false');

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (BOOLEAN_FIELDS.includes(fn)) return isBoolPresent(v);
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
  return hasString(v);
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const boolDisplay = (v) => ((v === true || v === 'true') ? 'Yes' : 'No');

/* ======= SENTENCE SPLIT ======= */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= RENDER FIELD (inner content; the wrap gate lives in renderSection) ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (BOOLEAN_FIELDS.includes(fn) || NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.listItem}>1. {BOOLEAN_FIELDS.includes(fn) ? boolDisplay(val) : safeString(val)}</Text>
      </View>
    );
  }

  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>
        ))}
      </View>
    );
  }

  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {strVal}</Text>
    </View>
  );
};

const fieldRowsOf = (record, fn) => {
  const v = record[fn];
  if (!fieldHasVal(fn, v)) return 0;
  if (BOOLEAN_FIELDS.includes(fn) || NUMBER_FIELDS.includes(fn)) return 2;
  const sentences = splitBySentence(safeString(v));
  return sentences.length > 1 ? sentences.length + 1 : 2;
};

/* ======= RENDER SECTION — per-FIELD boolean gates, title inside the first field ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {presentFields.map((f, i) => {
        const rows = fieldRowsOf(record, f) + (i === 0 ? 1 : 0);
        return (
          <View key={f} wrap={rows > 8 ? true : false}>
            {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
            {renderField(record, f)}
          </View>
        );
      })}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const CervicalLengthMeasurementDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].cervical_length_measurement && Array.isArray(docProp[0].cervical_length_measurement)) {
      records = docProp[0].cervical_length_measurement;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.cervical_length_measurement) {
    records = Array.isArray(docProp.cervical_length_measurement) ? docProp.cervical_length_measurement : [docProp.cervical_length_measurement];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Cervical Length Measurement</Text>
          </View>
          <Text style={styles.noDataText}>No cervical length measurement data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Cervical Length Measurement</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cervical Length Measurement ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'measurement')}
            {renderSection(record, 'morphology')}
            {renderSection(record, 'cerclage-context')}
            {renderSection(record, 'risk-recs')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CervicalLengthMeasurementDocumentPDFTemplate;
