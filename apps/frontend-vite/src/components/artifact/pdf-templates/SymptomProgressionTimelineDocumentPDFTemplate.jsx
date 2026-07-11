/**
 * SymptomProgressionTimelineDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — symptom progression timeline
 * Collection: symptom_progression_timeline
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= SECTION DEFINITIONS ======= */
const SECTION_FIELDS = {
  'symptom-overview': ['symptomOnsetDate', 'symptomCharacteristics', 'anatomicalLocation', 'symptomFrequency', 'symptomDurationMinutes', 'symptomProgressionPattern', 'timeToMaximumSymptom', 'symptomResolutionDate'],
  'severity-scores': ['symptomSeverityScore', 'painIntensityNrs', 'functionalCapacityMets', 'functionalImpactScore', 'qualityOfLifeScore', 'nyhaClassification', 'glasgowComaScale', 'edssScore'],
  'factors-symptoms': ['triggeringFactors', 'alleviatingFactors', 'associatedSymptoms'],
  'functional-measures': ['walkingDistanceMeters', 'sixMinuteWalkDistance'],
  'intervention-biomarkers': ['interventionResponse', 'biomarkerLevels'],
};

const SECTION_TITLES = {
  'symptom-overview': 'Symptom Overview',
  'severity-scores': 'Severity Scores',
  'factors-symptoms': 'Factors & Symptoms',
  'functional-measures': 'Functional Measures',
  'intervention-biomarkers': 'Intervention & Biomarkers',
};

const FIELD_LABELS = {
  symptomOnsetDate: 'Symptom Onset Date',
  symptomCharacteristics: 'Symptom Characteristics',
  anatomicalLocation: 'Anatomical Location',
  symptomFrequency: 'Symptom Frequency',
  symptomDurationMinutes: 'Symptom Duration (Minutes)',
  symptomProgressionPattern: 'Symptom Progression Pattern',
  timeToMaximumSymptom: 'Time to Maximum Symptom (Days)',
  symptomResolutionDate: 'Symptom Resolution Date',
  symptomSeverityScore: 'Symptom Severity Score',
  painIntensityNrs: 'Pain Intensity (NRS)',
  functionalCapacityMets: 'Functional Capacity (METs)',
  functionalImpactScore: 'Functional Impact Score',
  qualityOfLifeScore: 'Quality of Life Score',
  nyhaClassification: 'NYHA Classification',
  glasgowComaScale: 'Glasgow Coma Scale',
  edssScore: 'EDSS Score',
  triggeringFactors: 'Triggering Factors',
  alleviatingFactors: 'Alleviating Factors',
  associatedSymptoms: 'Associated Symptoms',
  walkingDistanceMeters: 'Walking Distance (Meters)',
  sixMinuteWalkDistance: 'Six Minute Walk Distance',
  interventionResponse: 'Intervention Response',
  biomarkerLevels: 'Biomarker Levels',
};

const DATE_FIELDS = ['symptomOnsetDate', 'symptomResolutionDate'];
const NUMBER_FIELDS = ['symptomSeverityScore', 'painIntensityNrs', 'functionalCapacityMets', 'functionalImpactScore', 'qualityOfLifeScore', 'glasgowComaScale', 'edssScore', 'symptomDurationMinutes', 'walkingDistanceMeters', 'sixMinuteWalkDistance', 'timeToMaximumSymptom'];
const ARRAY_FIELDS = ['triggeringFactors', 'alleviatingFactors', 'associatedSymptoms', 'biomarkerLevels'];
const STRING_FIELDS = ['symptomCharacteristics', 'anatomicalLocation', 'symptomFrequency', 'symptomProgressionPattern', 'nyhaClassification', 'interventionResponse'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{String(val)}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [val];
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

  /* STRING_FIELDS — splitBySentence + parseLabel + splitByComma */
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, sIdx) => {
          const parsed = parseLabel(s);
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            if (commaItems.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                  {commaItems.map((ci, ciIdx) => (
                    <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                  ))}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                <Text style={styles.fieldValue}>{parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>;
        })}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const hasAny = fields.some(f => hasVal(record[f]));
  if (!hasAny) return null;
  const title = SECTION_TITLES[sid];

  return (
    <View key={sid} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(f => renderField(record, f))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const SymptomProgressionTimelineDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (rawData) => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) return [];
      if (rawData[0]?.symptom_progression_timeline && Array.isArray(rawData[0].symptom_progression_timeline)) return rawData[0].symptom_progression_timeline;
      if (rawData[0]?.documentData) { const dd = rawData[0].documentData; if (Array.isArray(dd)) return dd; if (dd?.symptom_progression_timeline) return Array.isArray(dd.symptom_progression_timeline) ? dd.symptom_progression_timeline : [dd.symptom_progression_timeline]; return [dd]; }
      if (rawData[0]?._records && Array.isArray(rawData[0]._records)) return rawData[0]._records;
      if (rawData[0]?.records && Array.isArray(rawData[0].records)) return rawData[0].records;
      return rawData;
    }
    if (rawData.symptom_progression_timeline && Array.isArray(rawData.symptom_progression_timeline)) return rawData.symptom_progression_timeline;
    if (rawData._records && Array.isArray(rawData._records)) return rawData._records;
    if (rawData.records && Array.isArray(rawData.records)) return rawData.records;
    if (rawData.symptomOnsetDate || rawData.symptomCharacteristics || rawData.interventionResponse) return [rawData];
    return [];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No Symptom Progression Timeline data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Symptom Progression Timeline</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.symptomOnsetDate) && <Text style={styles.recordDate}>{formatDate(record.symptomOnsetDate)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{record.symptomCharacteristics || `Symptom Progression Timeline ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'symptom-overview')}
            {renderSection(record, 'severity-scores')}
            {renderSection(record, 'factors-symptoms')}
            {renderSection(record, 'functional-measures')}
            {renderSection(record, 'intervention-biomarkers')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SymptomProgressionTimelineDocumentPDFTemplate;
