/**
 * ThyroidEvaluationsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- thyroid evaluations
 * Collection: thyroid_evaluations
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

// Numeric fields where a stored 0 is a "not measured / not assessed" sentinel, not a real
// result. Mirrors ZERO_SENTINEL_FIELDS in ThyroidEvaluationsDocument.jsx so the PDF does not
// print "TSH Level: 0" for blank records.
const ZERO_SENTINEL_FIELDS = ['tshLevel', 'freeT4Level', 'freeT3Level', 'totalT4Level', 'totalT3Level', 'thyroglobulinLevel', 'antiTPOAntibodies', 'antiThyroglobulinAntibodies', 'tsiLevel', 'traAntibodies', 'thyroidSymptomScore', 'wayneThyrotoxicosisIndex', 'tiRadsScore', 'radioiodineUptakeTest', 'bethesdaCategory'];

const hasVal = (v, fn) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return !(fn && ZERO_SENTINEL_FIELDS.includes(fn) && v === 0);
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
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

/* ======= FIELD DEFINITIONS ======= */
const SECTION_FIELDS = {
  'thyroid-labs': ['tshLevel', 'freeT4Level', 'freeT3Level', 'totalT4Level', 'totalT3Level', 'thyroglobulinLevel'],
  'antibodies': ['antiTPOAntibodies', 'antiThyroglobulinAntibodies', 'tsiLevel', 'traAntibodies'],
  'clinical-status': ['clinicalThyroidFunction', 'thyroidSymptomScore', 'wayneThyrotoxicosisIndex', 'goiterClassification'],
  'palpation-exam': ['thyroidGlandSize', 'thyroidPalpationFindings'],
  'imaging': ['ultrasoundFindings', 'tiRadsScore', 'noduleCharacteristics', 'thyroidScintigraphyPattern', 'radioiodineUptakeTest'],
  'biopsy': ['fnaBiopsyResults', 'bethesdaCategory'],
  'medications': ['thyroidMedications'],
};

const SECTION_TITLES = {
  'thyroid-labs': 'Thyroid Labs',
  'antibodies': 'Antibodies',
  'clinical-status': 'Clinical Status',
  'palpation-exam': 'Palpation & Exam',
  'imaging': 'Imaging',
  'biopsy': 'Biopsy',
  'medications': 'Medications',
};

const FIELD_LABELS = {
  tshLevel: 'TSH Level',
  freeT4Level: 'Free T4 Level',
  freeT3Level: 'Free T3 Level',
  totalT4Level: 'Total T4 Level',
  totalT3Level: 'Total T3 Level',
  thyroglobulinLevel: 'Thyroglobulin Level',
  antiTPOAntibodies: 'Anti-TPO Antibodies',
  antiThyroglobulinAntibodies: 'Anti-Thyroglobulin Antibodies',
  tsiLevel: 'TSI Level',
  traAntibodies: 'TRAb Antibodies',
  clinicalThyroidFunction: 'Clinical Thyroid Function',
  thyroidSymptomScore: 'Thyroid Symptom Score',
  wayneThyrotoxicosisIndex: 'Wayne Thyrotoxicosis Index',
  goiterClassification: 'Goiter Classification',
  thyroidGlandSize: 'Thyroid Gland Size',
  thyroidPalpationFindings: 'Palpation Findings',
  ultrasoundFindings: 'Ultrasound Findings',
  tiRadsScore: 'TI-RADS Score',
  noduleCharacteristics: 'Nodule Characteristics',
  thyroidScintigraphyPattern: 'Scintigraphy Pattern',
  radioiodineUptakeTest: 'Radioiodine Uptake Test',
  fnaBiopsyResults: 'FNA Biopsy Results',
  bethesdaCategory: 'Bethesda Category',
  thyroidMedications: 'Thyroid Medications',
};

const ARRAY_FIELDS = ['noduleCharacteristics', 'thyroidMedications'];
const STRING_FIELDS = ['clinicalThyroidFunction', 'goiterClassification', 'thyroidGlandSize', 'thyroidPalpationFindings', 'ultrasoundFindings', 'thyroidScintigraphyPattern', 'fnaBiopsyResults'];

/* ======= RENDER HELPERS ======= */
const renderFieldValue = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val, fn)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [val];
    if (items.length === 0) return null;
    return (
      <View style={styles.fieldBox} key={fn}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }

  if (STRING_FIELDS.includes(fn)) {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      let itemNum = 1;
      return (
        <View style={styles.fieldBox} key={fn}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {sentences.map((sentence, sIdx) => {
            const parsed = parseLabel(sentence);
            if (parsed.isLabeled) {
              const commaItems = splitByComma(parsed.value);
              if (commaItems.length >= 2) {
                return (
                  <View key={sIdx}>
                    <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                    {commaItems.map((ci, ciIdx) => (
                      <Text key={ciIdx} style={styles.listItem}>{itemNum++}. {ci}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  <Text style={styles.listItem}>{itemNum++}. {parsed.value}</Text>
                </View>
              );
            }
            return <Text key={sIdx} style={styles.listItem}>{itemNum++}. {sentence}</Text>;
          })}
        </View>
      );
    }
    return (
      <View style={styles.fieldBox} key={fn}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{strVal}</Text>
      </View>
    );
  }

  /* Number or other scalar */
  return (
    <View style={styles.fieldBox} key={fn}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const hasAny = fields.some(f => hasVal(record[f], f));
  if (!hasAny) return null;
  const title = SECTION_TITLES[sid];

  return (
    <View style={styles.section} key={sid}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(fn => renderFieldValue(record, fn))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const ThyroidEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.thyroid_evaluations && Array.isArray(data.thyroid_evaluations)) {
    records = data.thyroid_evaluations;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.thyroid_evaluations) {
      records = Array.isArray(docData.thyroid_evaluations) ? docData.thyroid_evaluations : [docData.thyroid_evaluations];
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Thyroid Evaluations</Text>
        </View>

        {records.length === 0 && (
          <Text style={styles.noDataText}>No thyroid evaluation records available</Text>
        )}

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.createdAt) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>
                {record.clinicalThyroidFunction ? `Thyroid Evaluation - ${safeString(record.clinicalThyroidFunction)}` : `Thyroid Evaluation ${idx + 1}`}
              </Text>
            </View>

            {renderSection(record, 'thyroid-labs')}
            {renderSection(record, 'antibodies')}
            {renderSection(record, 'clinical-status')}
            {renderSection(record, 'palpation-exam')}
            {renderSection(record, 'imaging')}
            {renderSection(record, 'biopsy')}
            {renderSection(record, 'medications')}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ThyroidEvaluationsDocumentPDFTemplate;
