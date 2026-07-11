/**
 * WoundHealingHyperbaricDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: wound_healing_hyperbaric
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
/* Epoch-zero sentinel: Date (1970-01-01T00:00:00Z) stored where free-text expected -> treat as no-value. */
const isEpochSentinel = (v) => { if (v == null) return false; const s = typeof v === 'string' ? v : (v.$date ? String(v.$date) : (v instanceof Date ? v.toISOString() : '')); return /^1970-01-01T00:00:00(\.000)?Z$/.test(s); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (isEpochSentinel(v)) return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\bvs)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/,\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      const cItems = rawVal.split(/,\s+/).filter(x => x.trim());
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {item.trim()}</Text>) : <Text style={styles.listItem}>1. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'wound-assessment': 'Wound Assessment',
  'vascular-status': 'Vascular Status',
  'hbot-treatment': 'HBOT Treatment',
  'wound-status': 'Wound Status & Infection',
  'patient-metrics': 'Patient Metrics',
  'management-plan': 'Management Plan & Safety',
};

const FIELD_LABELS = {
  woundEtiology: 'Wound Etiology',
  woundLocationAnatomical: 'Wound Location (Anatomical)',
  woundDimensionsCm: 'Wound Dimensions (cm)',
  wagnerClassification: 'Wagner Classification',
  ankleBrachialIndex: 'Ankle-Brachial Index',
  toeBrachialIndex: 'Toe-Brachial Index',
  transcutaneousOxygenPressure: 'Transcutaneous Oxygen Pressure',
  hbotTreatmentPressureATA: 'HBOT Treatment Pressure (ATA)',
  hbotTreatmentDurationMinutes: 'HBOT Treatment Duration (min)',
  hbotTotalSessionsCompleted: 'HBOT Total Sessions Completed',
  woundBedTissuePercentage: 'Wound Bed Tissue Percentage',
  periWoundSkinCondition: 'Peri-Wound Skin Condition',
  woundExudateCharacteristics: 'Wound Exudate Characteristics',
  infectionSignsPresent: 'Infection Signs Present',
  osteomyelitisStatus: 'Osteomyelitis Status',
  diabeticFootRiskCategory: 'Diabetic Foot Risk Category',
  hemoglobinA1cPercent: 'Hemoglobin A1c (%)',
  serumAlbuminGdL: 'Serum Albumin (g/dL)',
  prealbumin: 'Prealbumin',
  offloadingDeviceType: 'Offloading Device Type',
  compressionTherapyRegimen: 'Compression Therapy Regimen',
  woundHealingTrajectory: 'Wound Healing Trajectory',
  hbotContraindicationsScreened: 'HBOT Contraindications Screened',
  middleEarBarotraumaRisk: 'Middle Ear Barotrauma Risk',
  postHbotTcpo2Response: 'Post-HBOT TcpO2 Response',
};

const SECTION_FIELDS = {
  'wound-assessment': ['woundEtiology', 'woundLocationAnatomical', 'woundDimensionsCm', 'wagnerClassification'],
  'vascular-status': ['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure'],
  'hbot-treatment': ['hbotTreatmentPressureATA', 'hbotTreatmentDurationMinutes', 'hbotTotalSessionsCompleted'],
  'wound-status': ['woundBedTissuePercentage', 'periWoundSkinCondition', 'woundExudateCharacteristics', 'infectionSignsPresent', 'osteomyelitisStatus'],
  'patient-metrics': ['diabeticFootRiskCategory', 'hemoglobinA1cPercent', 'serumAlbuminGdL', 'prealbumin'],
  'management-plan': ['offloadingDeviceType', 'compressionTherapyRegimen', 'woundHealingTrajectory', 'hbotContraindicationsScreened', 'middleEarBarotraumaRisk', 'postHbotTcpo2Response'],
};

const NUMBER_FIELDS = ['wagnerClassification', 'ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'hbotTreatmentPressureATA', 'hbotTreatmentDurationMinutes', 'hbotTotalSessionsCompleted', 'hemoglobinA1cPercent', 'serumAlbuminGdL', 'prealbumin', 'postHbotTcpo2Response'];
const ARRAY_FIELDS = ['infectionSignsPresent', 'hbotContraindicationsScreened'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  /* Array of strings */
  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }

  /* Number fields */
  if (NUMBER_FIELDS.includes(fn)) {
    return renderFieldRow(label, safeString(val));
  }

  /* Default: string fields -- use renderSentenceField for multi-sentence, renderFieldRow for single */
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return renderSentenceField(label, strVal);
  }
  return renderFieldRow(label, strVal);
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;

  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(f => renderField(record, f, title))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const WoundHealingHyperbaricDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].wound_healing_hyperbaric && Array.isArray(docProp[0].wound_healing_hyperbaric)) {
      records = docProp[0].wound_healing_hyperbaric;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.wound_healing_hyperbaric) {
    records = Array.isArray(docProp.wound_healing_hyperbaric) ? docProp.wound_healing_hyperbaric : [docProp.wound_healing_hyperbaric];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Wound Healing Hyperbaric</Text>
          </View>
          <Text style={styles.emptyState}>No wound healing hyperbaric data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Wound Healing Hyperbaric</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Wound Healing Hyperbaric ${idx + 1}`}</Text>
              {hasVal(record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>
            {renderSection(record, 'wound-assessment')}
            {renderSection(record, 'vascular-status')}
            {renderSection(record, 'hbot-treatment')}
            {renderSection(record, 'wound-status')}
            {renderSection(record, 'patient-metrics')}
            {renderSection(record, 'management-plan')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default WoundHealingHyperbaricDocumentPDFTemplate;
