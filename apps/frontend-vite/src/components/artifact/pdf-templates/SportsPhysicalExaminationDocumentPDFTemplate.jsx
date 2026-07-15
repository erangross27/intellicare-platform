/**
 * SportsPhysicalExaminationDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sports physical examination
 * Collection: sports_physical_examination
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordStatus: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#666666' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.\s+|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= SECTION FIELDS ======= */
const SECTION_FIELDS = {
  'sport-info': ['date', 'sportType', 'competitionLevel'],
  'vital-signs': ['vitalSignsRestingHeartRate', 'vitalSignsBloodPressure', 'bmiPercentile'],
  'cardiac-auscultation': ['cardiacAuscultationFindings'],
  'cardiac-screening': ['marfanScreeningResult'],
  'cardiac-risk-factors': ['cardiacRiskFactors'],
  'neurological': ['previousConcussionHistory', 'concussionCount'],
  'musculoskeletal': ['musculoskeletalLimitations'],
  'functional-movement': ['functionalMovementScreen'],
  'vision-screening': ['visionScreeningResult'],
  'medical-conditions': ['asthmaExerciseInduced', 'seizureDisorderControlled', 'heatIllnessHistory', 'immunizationCompliance'],
  'additional-info': ['singleOrganStatus', 'orthodonticAppliances', 'menstrualHistoryFemaleAthlete'],
  'restrictions': ['restrictionsImposed'],
  'clearance': ['clearanceStatus', 'followUpRequired'],
  'provider-info': ['examinerPhysicianName'],
};

const SECTION_TITLES = {
  'sport-info': 'Sport Information',
  'vital-signs': 'Vital Signs',
  'cardiac-auscultation': 'Cardiac Auscultation Findings',
  'cardiac-screening': 'Cardiac Screening',
  'cardiac-risk-factors': 'Cardiac Risk Factors',
  'neurological': 'Neurological',
  'musculoskeletal': 'Musculoskeletal Limitations',
  'functional-movement': 'Functional Movement Screen',
  'vision-screening': 'Vision Screening',
  'medical-conditions': 'Medical Conditions',
  'additional-info': 'Additional Information',
  'restrictions': 'Restrictions Imposed',
  'clearance': 'Clearance',
  'provider-info': 'Provider Information',
};

const FIELD_LABELS = {
  date: 'Date',
  sportType: 'Sport Type',
  competitionLevel: 'Competition Level',
  vitalSignsRestingHeartRate: 'Resting Heart Rate',
  vitalSignsBloodPressure: 'Blood Pressure',
  bmiPercentile: 'BMI Percentile',
  cardiacAuscultationFindings: 'Cardiac Auscultation Findings',
  marfanScreeningResult: 'Marfan Screening Result',
  cardiacRiskFactors: 'Cardiac Risk Factors',
  previousConcussionHistory: 'Previous Concussion History',
  concussionCount: 'Concussion Count',
  musculoskeletalLimitations: 'Musculoskeletal Limitations',
  functionalMovementScreen: 'Functional Movement Screen',
  visionScreeningResult: 'Vision Screening Result',
  asthmaExerciseInduced: 'Asthma Exercise Induced',
  seizureDisorderControlled: 'Seizure Disorder Controlled',
  heatIllnessHistory: 'Heat Illness History',
  immunizationCompliance: 'Immunization Compliance',
  singleOrganStatus: 'Single Organ Status',
  orthodonticAppliances: 'Orthodontic Appliances',
  menstrualHistoryFemaleAthlete: 'Menstrual History (Female Athlete)',
  restrictionsImposed: 'Restrictions Imposed',
  clearanceStatus: 'Clearance Status',
  followUpRequired: 'Follow-Up Required',
  examinerPhysicianName: 'Examiner / Physician',
};

const BOOLEAN_FIELDS = ['previousConcussionHistory', 'asthmaExerciseInduced', 'seizureDisorderControlled', 'heatIllnessHistory', 'immunizationCompliance', 'followUpRequired'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['vitalSignsRestingHeartRate', 'concussionCount', 'bmiPercentile'];
const ARRAY_FIELDS = ['sportType', 'cardiacRiskFactors', 'musculoskeletalLimitations', 'restrictionsImposed'];
/* Numeric fields where 0 is a sentinel (missing/not-measured), NOT meaningful.
   concussionCount is excluded: 0 concussions is a meaningful clinical statement. */
const ZERO_SENTINEL_FIELDS = ['vitalSignsRestingHeartRate', 'bmiPercentile'];
const STRING_FIELDS = ['competitionLevel', 'vitalSignsBloodPressure', 'cardiacAuscultationFindings', 'marfanScreeningResult', 'functionalMovementScreen', 'visionScreeningResult', 'singleOrganStatus', 'orthodonticAppliances', 'menstrualHistoryFemaleAthlete', 'clearanceStatus', 'examinerPhysicianName'];
const COMMA_FIELDS = new Set(['visionScreeningResult']);

/* ======= PDF COMPONENT ======= */
const SportsPhysicalExaminationDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.sports_physical_examination) {
        return inputData[0].sports_physical_examination;
      }
      return inputData;
    }
    if (inputData.sports_physical_examination) {
      return inputData.sports_physical_examination;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sports Physical Examination</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderStringFieldPdf = (record, fn, showLabel = true) => {
    const val = record[fn]; if (!hasVal(val)) return null;
    const strVal = safeString(val);
    const label = FIELD_LABELS[fn] || fn;
    const sentences = COMMA_FIELDS.has(fn) ? splitByComma(strVal) : splitBySentence(strVal);

    if (sentences.length > 1) {
      return (
        <View style={styles.fieldBox} key={fn}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {sentences.map((sentence, sIdx) => {
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 2) {
                return (
                  <View key={sIdx}>
                    <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                    {commaItems.map((ci, ciIdx) => (
                      <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  <Text style={styles.listItem}>{parsed.value}</Text>
                </View>
              );
            }
            return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
          })}
        </View>
      );
    }

    return (
      <View style={styles.fieldBox} key={fn}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{strVal}</Text>
      </View>
    );
  };

  const renderFieldPdf = (record, fn, showLabel = true) => {
    const val = record[fn]; if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;

    if (DATE_FIELDS.includes(fn)) {
      return <View style={styles.fieldBox} key={fn} wrap={false}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}<Text style={styles.fieldValue}>{formatDate(val)}</Text></View>;
    }
    if (BOOLEAN_FIELDS.includes(fn)) {
      return (
        <View style={styles.fieldBox} key={fn}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
        </View>
      );
    }
    if (NUMBER_FIELDS.includes(fn)) {
      if (ZERO_SENTINEL_FIELDS.includes(fn) && Number(val) === 0) return null;
      return (
        <View style={styles.fieldBox} key={fn}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          <Text style={styles.fieldValue}>{String(val)}</Text>
        </View>
      );
    }
    if (ARRAY_FIELDS.includes(fn)) {
      const items = Array.isArray(val) ? val.filter(Boolean) : [val];
      if (items.length === 0) return null;
      return (
        <View style={styles.fieldBox} key={fn}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </View>
      );
    }
    if (STRING_FIELDS.includes(fn)) {
      return renderStringFieldPdf(record, fn, showLabel);
    }
    return (
      <View style={styles.fieldBox} key={fn}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    );
  };

  const renderSectionPdf = (record, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const title = SECTION_TITLES[sid];
    const presentFields = fields.filter(f => {
      if (ZERO_SENTINEL_FIELDS.includes(f) && Number(record[f]) === 0) return false;
      return hasVal(record[f]);
    });
    if (!presentFields.length) return null;

    return (
      <View style={styles.section} key={sid}>
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {renderFieldPdf(record, presentFields[0], (FIELD_LABELS[presentFields[0]] || '').toLowerCase() !== title.toLowerCase())}
        </View>
        {presentFields.slice(1).map(f => renderFieldPdf(record, f, (FIELD_LABELS[f] || '').toLowerCase() !== title.toLowerCase()))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sports Physical Examination</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Sports Physical Examination {index + 1}</Text>
            </View>

            {Object.keys(SECTION_FIELDS).map(sid => renderSectionPdf(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SportsPhysicalExaminationDocumentPDFTemplate;
