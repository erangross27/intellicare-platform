/**
 * PhysicalTherapyNotesDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 size — BLACK & WHITE ONLY (#000000, no blue)
 * Data collection: physical_therapy_notes
 *
 * Rule #74 — each field/section = ONE <View> with conditional wrap;
 * sectionTitle rendered INSIDE the field box (passed to first present field),
 * never a standalone sibling; only recordHeader has unconditional wrap={false};
 * no borderBottom on sectionTitle; box-free.
 *
 * Field handling mirrors the JSX:
 *   - SIMPLE STRINGS → plain value
 *   - NARRATIVE STRINGS → numbered sentences when multi-sentence
 *   - NUMBER  → numeric presence check (0/absent hidden, NEVER truthiness), doctor-edit-0 exception
 *   - ARRAYS OF STRINGS → numbered list items
 *
 * No top-level `date` field → TITLE-ONLY record header (no date badge).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'mobility-function': 'Mobility & Function',
  'strength-rom': 'Strength & ROM',
  'balance-neuro': 'Balance & Neuro',
  'pain': 'Pain',
  'treatment-goals': 'Treatment & Goals',
};

const FIELD_LABELS = {
  patientMobilityLevel: 'Patient Mobility Level',
  gaitPattern: 'Gait Pattern',
  assistiveDeviceUsed: 'Assistive Device Used',
  transferAbility: 'Transfer Ability',
  functionalIndependenceMeasure: 'Functional Independence Measure',
  sixMinuteWalkTest: 'Six-Minute Walk Test',
  timedUpAndGoTest: 'Timed Up and Go Test',
  rangeOfMotionMeasurements: 'Range of Motion Measurements',
  muscleStrengthGrading: 'Muscle Strength Grading',
  coordinationTesting: 'Coordination Testing',
  edemaGrading: 'Edema Grading',
  postureAnalysis: 'Posture Analysis',
  balanceAssessmentScore: 'Balance Assessment Score',
  neurologicalDeficits: 'Neurological Deficits',
  fallRiskAssessment: 'Fall Risk Assessment',
  cardiovascularResponse: 'Cardiovascular Response',
  painLevelNumericRating: 'Pain Level (Numeric Rating)',
  treatmentInterventions: 'Treatment Interventions',
  rehabilitationGoals: 'Rehabilitation Goals',
  patientCompliance: 'Patient Compliance',
  dischargeReadiness: 'Discharge Readiness',
};

const SECTION_FIELDS = {
  'mobility-function': ['patientMobilityLevel', 'gaitPattern', 'assistiveDeviceUsed', 'transferAbility', 'functionalIndependenceMeasure', 'sixMinuteWalkTest', 'timedUpAndGoTest'],
  'strength-rom': ['rangeOfMotionMeasurements', 'muscleStrengthGrading', 'coordinationTesting', 'edemaGrading', 'postureAnalysis'],
  'balance-neuro': ['balanceAssessmentScore', 'neurologicalDeficits', 'fallRiskAssessment', 'cardiovascularResponse'],
  'pain': ['painLevelNumericRating'],
  'treatment-goals': ['treatmentInterventions', 'rehabilitationGoals', 'patientCompliance', 'dischargeReadiness'],
};

const NARRATIVE_STRING_FIELDS = ['dischargeReadiness'];
const NUMBER_FIELDS = ['painLevelNumericRating', 'functionalIndependenceMeasure', 'sixMinuteWalkTest', 'timedUpAndGoTest'];
// painLevelNumericRating uses a 0-10 NRS where 0 = "no pain" — a real recorded value that must always print
const MEANINGFUL_ZERO_FIELDS = ['painLevelNumericRating'];
const ARRAY_FIELDS = ['rangeOfMotionMeasurements', 'muscleStrengthGrading', 'assistiveDeviceUsed', 'neurologicalDeficits', 'treatmentInterventions', 'rehabilitationGoals'];

/* ======= UTILS ======= */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn)) {
    if (MEANINGFUL_ZERO_FIELDS.includes(fn)) {
      if (v === null || v === undefined || v === '') return false;
      return Number.isFinite(Number(v));
    }
    return hasNumber(v);
  }
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};

// A hide-zero number field stays visible at 0 when a doctor explicitly set it (doctorEdits.editedFields)
const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]) || (NUMBER_FIELDS.includes(fn) && Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn));

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* ======= SENTENCE SPLIT ======= */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!fieldVisible(record, fn)) return null;
  const label = FIELD_LABELS[fn] || fn;

  let body;
  if (NUMBER_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{safeString(val)}</Text>;
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    body = items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.listItem}>{i + 1}. {p.value || String(item)}</Text>;
    });
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (NARRATIVE_STRING_FIELDS.includes(fn) && sentences.length > 1) {
      body = sentences.map((s, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>
      ));
    } else {
      body = <Text style={styles.fieldValue}>{strVal}</Text>;
    }
  }

  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {body}
    </View>
  );
};

/* ======= RENDER SECTION — title INSIDE first present field + conditional wrap ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldVisible(record, f));
  if (presentFields.length === 0) return null;

  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8 ? undefined : false}>
      {presentFields.map((f, i) => renderField(record, f, i === 0 ? title : null))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PhysicalTherapyNotesDocumentPDFTemplate = ({ document: docProp }) => {
  const pick = (r) => r && r.physical_therapy_notes;
  let records = [];
  if (Array.isArray(docProp)) {
    const p0 = docProp.length > 0 ? pick(docProp[0]) : null;
    if (p0 && Array.isArray(p0)) {
      records = p0;
    } else {
      records = docProp;
    }
  } else if (docProp && pick(docProp)) {
    const p = pick(docProp);
    records = Array.isArray(p) ? p : [p];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Physical Therapy Notes</Text>
          </View>
          <Text style={styles.noDataText}>No physical therapy note data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Physical Therapy Notes</Text>
        </View>
        {records.map((record, idx) => {
          const title = `Physical Therapy Note ${idx + 1}`;
          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{title}</Text>
              </View>
              {renderSection(record, 'mobility-function')}
              {renderSection(record, 'strength-rom')}
              {renderSection(record, 'balance-neuro')}
              {renderSection(record, 'pain')}
              {renderSection(record, 'treatment-goals')}
              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PhysicalTherapyNotesDocumentPDFTemplate;
