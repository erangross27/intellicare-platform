import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Box-free B&W LETTER (canonical, memory 6a2d6af6): underline rules — documentTitle 2pt / recordTitle+sectionTitle 1pt black / fieldLabel 0.5pt #999.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  numberedItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const TRIAGE_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'triageLevel', label: 'Triage Level' },
  { key: 'triageCategory', label: 'Triage Category' },
  { key: 'triageNurse', label: 'Triage Nurse' },
  { key: 'triageTimeMinutes', label: 'Triage Time (minutes)' },
];
const ARRIVAL_FIELDS = [
  { key: 'chiefComplaint', label: 'Chief Complaint' },
  { key: 'arrivalMode', label: 'Arrival Mode' },
  { key: 'ambulatoryStatus', label: 'Ambulatory Status' },
];
const PAIN_FIELDS = [
  { key: 'painScore', label: 'Pain Score' },
  { key: 'painLocation', label: 'Pain Location' },
  { key: 'painCharacter', label: 'Pain Character' },
];
const TIMELINE_FIELDS = [
  { key: 'symptomOnsetTime', label: 'Symptom Onset Time' },
  { key: 'symptomDuration', label: 'Symptom Duration' },
];
const NEURO_FIELDS = [
  { key: 'consciousnessLevel', label: 'Consciousness Level' },
  { key: 'glasgowComaScore', label: 'Glasgow Coma Score' },
];
const RESPIRATORY_FIELDS = [
  { key: 'respiratoryDistress', label: 'Respiratory Distress' },
  { key: 'oxygenTherapy', label: 'Oxygen Therapy' },
];
const SAFETY_FIELDS = [
  { key: 'fallRiskScore', label: 'Fall Risk Score' },
  { key: 'traumaMechanism', label: 'Trauma Mechanism' },
];
const ADDITIONAL_FIELDS = [
  { key: 'lastOralIntake', label: 'Last Oral Intake' },
  { key: 'emergencyContactNotified', label: 'Emergency Contact Notified' },
  { key: 'immunizationHistory', label: 'Immunization History' },
];

// Mirror the JSX enum canonicalization + sentence/comma split so the PDF matches the on-screen document.
const ENUM_OPTIONS = {
  triageCategory: ['Resuscitation', 'Emergent', 'Urgent', 'Less Urgent', 'Non-Urgent'],
  arrivalMode: ['Ambulance', 'Ambulatory', 'Wheelchair', 'Private Vehicle', 'Helicopter', 'Police', 'Public Transport'],
  ambulatoryStatus: ['Ambulatory', 'Stretcher', 'Wheelchair', 'Assisted', 'Bed-bound'],
  consciousnessLevel: ['Alert', 'Verbal', 'Pain', 'Unresponsive'],
};
const ENUM_KEYS = Object.keys(ENUM_OPTIONS);
const enumCanonical = (key, cur) => { const base = ENUM_OPTIONS[key] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };
const SENTENCE_KEYS = ['painLocation', 'painCharacter', 'symptomDuration', 'traumaMechanism', 'immunizationHistory'];
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (cur.trim()) parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const expandLeafPieces = (text) => {
  const out = [];
  splitBySentence(String(text || '')).forEach((s) => {
    const items = splitByComma(s);
    if (items.length >= 3) items.forEach((it) => out.push(it));
    else out.push(s);
  });
  return out;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

const DATE_KEYS = ['date'];
// symptomOnsetTime & lastOralIntake are schema-typed Date fields carrying a time component.
const DATETIME_KEYS = ['symptomOnsetTime', 'lastOralIntake'];
const formatDateTime = (value) => {
  if (!value) return null;
  try {
    const date = new Date(value.$date || value);
    if (isNaN(date.getTime())) return typeof value === 'string' ? value.trim() : null;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return typeof value === 'string' ? value.trim() : null; }
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return String(value);
};

const getDisplayValue = (record, field) => {
  if (DATE_KEYS.includes(field.key)) {
    const raw = record[field.key];
    if (raw === null || raw === undefined || raw === '') return null;
    return formatDate(raw) || null;
  }
  if (DATETIME_KEYS.includes(field.key)) {
    const raw = record[field.key];
    if (raw === null || raw === undefined || raw === '') return null;
    return formatDateTime(raw);
  }
  const val = formatValue(record[field.key]);
  if (val === null) return null;
  if (ENUM_KEYS.includes(field.key)) return enumCanonical(field.key, val);
  return val;
};

const MultiFieldSection = ({ title, record, fields }) => {
  const vis = fields.filter(f => getDisplayValue(record, f) !== null);
  if (vis.length === 0) return null;
  return (
    <View style={styles.section}>
      {vis.map((field, i) => {
        const dv = getDisplayValue(record, field);
        const isSentence = SENTENCE_KEYS.includes(field.key);
        const pieces = isSentence ? expandLeafPieces(dv) : null;
        return (
          <View key={field.key} style={styles.fieldBox} wrap={pieces && pieces.length > 8 ? true : false}>
            {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
            <Text style={styles.fieldLabel}>{field.label}</Text>
            {isSentence
              ? pieces.map((pc, j) => <Text key={j} style={styles.numberedItem}>{`${j + 1}. ${pc}`}</Text>)
              : <Text style={styles.fieldValue}>{dv}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const ArraySection = ({ title, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.section} wrap={items.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.numberedItem}>{`${i + 1}. ${item}`}</Text>
      ))}
    </View>
  );
};

const EdTriageAssessmentDocumentPDFTemplate = ({ document: docProp }) => {
  const records = Array.isArray(docProp) ? docProp : [docProp];
  if (!records.length) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>ED Triage Assessment</Text></View>
        <Text style={styles.emptyState}>No ED triage assessment records available</Text>
      </Page></Document>
    );
  }
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>ED Triage Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`ED Triage Assessment ${idx + 1}`}</Text>
            <MultiFieldSection title="Triage Classification" record={record} fields={TRIAGE_FIELDS} />
            <MultiFieldSection title="Chief Complaint & Arrival" record={record} fields={ARRIVAL_FIELDS} />
            <ArraySection title="Initial Vital Signs" items={Array.isArray(record.initialVitalSigns) ? record.initialVitalSigns : []} />
            <MultiFieldSection title="Pain Assessment" record={record} fields={PAIN_FIELDS} />
            <MultiFieldSection title="Symptom Timeline" record={record} fields={TIMELINE_FIELDS} />
            <MultiFieldSection title="Neurological Status" record={record} fields={NEURO_FIELDS} />
            <MultiFieldSection title="Respiratory Status" record={record} fields={RESPIRATORY_FIELDS} />
            <MultiFieldSection title="Safety & Risk" record={record} fields={SAFETY_FIELDS} />
            <ArraySection title="Isolation Precautions" items={Array.isArray(record.isolationPrecautions) ? record.isolationPrecautions : []} />
            <ArraySection title="Allergy Screening" items={Array.isArray(record.allergyScreening) ? record.allergyScreening : []} />
            <ArraySection title="Current Medications" items={Array.isArray(record.medicationList) ? record.medicationList : []} />
            <MultiFieldSection title="Additional Information" record={record} fields={ADDITIONAL_FIELDS} />
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EdTriageAssessmentDocumentPDFTemplate;
