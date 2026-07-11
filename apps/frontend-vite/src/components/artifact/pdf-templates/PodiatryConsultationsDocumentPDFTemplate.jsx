/**
 * PodiatryConsultationsDocumentPDFTemplate.jsx
 * PDF export template for podiatry_consultations collection.
 * Box-free black & white: hierarchy shown via underlines only (documentTitle / sectionTitle / bare fieldLabel).
 * Field labels are BARE (no colon) so they render as exact `>Label<` text nodes for JSX/PDF field parity.
 * Anti-orphan: every sectionTitle is glued to its first body element inside a <View wrap={false}>.
 * Sentinel-zero numeric fields (extractor defaults) are hidden, mirroring the JSX isMeaninglessZero gate.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 20,
    textTransform: 'none',
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 8,
    textTransform: 'none',
  },
  fieldBox: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
    marginBottom: 3,
    textTransform: 'none',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  noData: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const FIELD_LABELS = {
  chiefPodiatricComplaint: 'Chief Podiatric Complaint',
  ankleBrachialIndex: 'Ankle-Brachial Index',
  toeBrachialIndex: 'Toe-Brachial Index',
  pedalPulsesAssessment: 'Pedal Pulses Assessment',
  transcutaneousOxygenPressure: 'TcPO2 (mmHg)',
  wagnerUlcerClassification: 'Wagner Ulcer Classification',
  universityOfTexasWoundClassification: 'UT Wound Classification',
  diabeticFootInfectionSeverity: 'Diabetic Foot Infection Severity',
  charcotArthropathyStage: 'Charcot Arthropathy Stage',
  footPostureIndex: 'Foot Posture Index',
  manchesterOxfordFootQuestionnaire: 'Manchester-Oxford Foot Questionnaire',
  semmeswWeinsteinMonofilamentScore: 'Semmes-Weinstein Monofilament Score',
  vibrationPerceptionThreshold: 'Vibration Perception Threshold',
  halluxValgusAngle: 'Hallux Valgus Angle',
  intermetatarsalAngle: 'Intermetatarsal Angle',
  calcanealPitchAngle: 'Calcaneal Pitch Angle',
  talusFirstMetatarsalAngle: 'Talus-First Metatarsal Angle',
  firstMtpjRangeOfMotion: 'First MTPJ Range of Motion',
  achillesTendonThompsonTest: 'Achilles Tendon Thompson Test',
  anteriorDrawerTestAnkle: 'Anterior Drawer Test (Ankle)',
  nailDystrophyClassification: 'Nail Dystrophy Classification',
  lesserToeDeformities: 'Lesser Toe Deformities',
  plantarFasciitisChronicity: 'Plantar Fasciitis Chronicity',
  customOrthoticPrescription: 'Custom Orthotic Prescription',
  offloadingDevicePrescribed: 'Offloading Device Prescribed',
};

const SECTIONS = [
  { title: 'Chief Podiatric Complaint', fields: ['chiefPodiatricComplaint'] },
  { title: 'Vascular Assessment', fields: ['ankleBrachialIndex', 'toeBrachialIndex', 'pedalPulsesAssessment', 'transcutaneousOxygenPressure'] },
  { title: 'Classification & Scores', fields: ['wagnerUlcerClassification', 'universityOfTexasWoundClassification', 'diabeticFootInfectionSeverity', 'charcotArthropathyStage', 'footPostureIndex', 'manchesterOxfordFootQuestionnaire'] },
  { title: 'Neuropathy Assessment', fields: ['semmeswWeinsteinMonofilamentScore', 'vibrationPerceptionThreshold'] },
  { title: 'Biomechanical Assessment', fields: ['halluxValgusAngle', 'intermetatarsalAngle', 'calcanealPitchAngle', 'talusFirstMetatarsalAngle', 'firstMtpjRangeOfMotion', 'achillesTendonThompsonTest', 'anteriorDrawerTestAnkle'] },
  { title: 'Nail & Toe Deformities', fields: ['nailDystrophyClassification', 'lesserToeDeformities'] },
  { title: 'Treatment Plan', fields: ['plantarFasciitisChronicity', 'customOrthoticPrescription', 'offloadingDevicePrescribed'] },
];

const DATE_FIELDS = [];
const ARRAY_FIELDS = ['lesserToeDeformities'];

/* Sentinel-zero numeric fields — a stored 0 is an extractor default, not a real reading (mirror of JSX). */
const SENTINEL_ZERO_FIELDS = [
  'ankleBrachialIndex', 'toeBrachialIndex', 'vibrationPerceptionThreshold',
  'halluxValgusAngle', 'intermetatarsalAngle', 'calcanealPitchAngle',
  'talusFirstMetatarsalAngle', 'footPostureIndex', 'manchesterOxfordFootQuestionnaire',
  'transcutaneousOxygenPressure', 'wagnerUlcerClassification',
];
const isMeaninglessZero = (fn, v) => SENTINEL_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0');

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const visibleFor = (fn, v) => hasVal(v) && !isMeaninglessZero(fn, v);

/* splitByComma: parenthesis-aware, splits only on comma+whitespace (keeps thousands & parens whole). */
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
/* looksLabeled: a leading "Label: value" — mirror of the JSX parseLabel anchor (kept whole, not comma-split). */
const looksLabeled = (s) => /^[A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?:\s/.test(s);

const fieldBody = (fn, value, keyPrefix, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const suppressLabel = String(label).trim().toLowerCase() === String(sectionTitle || '').trim().toLowerCase();
  if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(value) ? value : [value]).filter((x) => x !== null && x !== undefined && String(x).trim() !== '');
    return (
      <View key={keyPrefix} style={styles.fieldBox} wrap={false}>
        {!suppressLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (
          <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {String(item)}</Text>
        ))}
      </View>
    );
  }
  /* Unlabeled clinical list (>=3 comma items) → numbered rows, mirroring the JSX aggressive split. */
  const cleaned = String(value).replace(/[;.]+$/, '').trim();
  if (!looksLabeled(cleaned)) {
    const parts = splitByComma(cleaned);
    if (parts.length >= 3) {
      return (
        <View key={keyPrefix} style={styles.fieldBox} wrap={false}>
          {!suppressLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {parts.map((item, i) => (
            <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {item}</Text>
          ))}
        </View>
      );
    }
  }
  const display = String(value);
  return (
    <View key={keyPrefix} style={styles.fieldBox} wrap={false}>
      {!suppressLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

/* Section — glues the title to its first body element so a title never orphans at a page break. */
const Section = ({ title, children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PodiatryConsultationsDocumentPDFTemplate = ({ document: data }) => {
  let recordsArray = [];
  if (Array.isArray(data)) {
    recordsArray = data;
  } else if (data?.podiatry_consultations && Array.isArray(data.podiatry_consultations)) {
    recordsArray = data.podiatry_consultations;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.podiatry_consultations && Array.isArray(docData.podiatry_consultations)) {
      recordsArray = docData.podiatry_consultations;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    recordsArray = [data];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Podiatry Consultations</Text>
          <Text style={styles.noData}>No podiatry consultation data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Podiatry Consultations</Text>
        {recordsArray.map((record, idx) => {
          const p = `r${idx}`;
          return (
            <View key={idx} style={styles.recordContainer}>
              {idx > 0 && <View style={styles.separator} />}
              <Text style={styles.recordTitle}>{`Podiatry Consultation ${idx + 1}`}</Text>
              {SECTIONS.map((sec) => (
                <Section key={sec.title} title={sec.title}>
                  {sec.fields
                    .filter((fn) => visibleFor(fn, record[fn]))
                    .map((fn) => fieldBody(fn, record[fn], `${p}-${fn}`, sec.title))}
                </Section>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PodiatryConsultationsDocumentPDFTemplate;
