/**
 * TransplantEvaluationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — transplant evaluations
 * Collection: transplant_evaluations
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

/* ======= FIELD CONFIG ======= */
const SECTION_TITLES = {
  'transplant-info': 'Transplant Information',
  'cardiac-pulmonary': 'Cardiac & Pulmonary',
  'immunology-labs': 'Immunology & Labs',
  'functional-psychosocial': 'Functional & Psychosocial',
  'risk-factors': 'Risk Factors & Screening',
};

const FIELD_LABELS = {
  organType: 'Organ Type',
  transplantEligibilityStatus: 'Transplant Eligibility Status',
  dialysisHistory: 'Dialysis History',
  bodyMassIndex: 'Body Mass Index (BMI)',
  leftVentricularEjectionFraction: 'Left Ventricular Ejection Fraction',
  nyhaClassification: 'NYHA Classification',
  coronaryAngiographyResults: 'Coronary Angiography Results',
  pulmonaryFunctionTests: 'Pulmonary Function Tests',
  aboBloodType: 'ABO Blood Type',
  hlaTyping: 'HLA Typing',
  crossmatchResults: 'Crossmatch Results',
  panelReactiveAntibodies: 'Panel Reactive Antibodies',
  viralSerologyPanel: 'Viral Serology Panel',
  cancerScreeningResults: 'Cancer Screening Results',
  functionalStatusAssessment: 'Functional Status Assessment',
  psychosocialEvaluation: 'Psychosocial Evaluation',
  liverBiopsy: 'Liver Biopsy',
  contraindications: 'Contraindications',
  vaccineStatus: 'Vaccine Status',
  calculatedMeldScore: 'Calculated MELD Score',
  estimatedGlomerularFiltrationRate: 'Estimated GFR (eGFR)',
};

const SECTION_FIELDS = {
  'transplant-info': ['organType', 'transplantEligibilityStatus', 'dialysisHistory', 'bodyMassIndex'],
  'cardiac-pulmonary': ['leftVentricularEjectionFraction', 'nyhaClassification', 'coronaryAngiographyResults', 'pulmonaryFunctionTests'],
  'immunology-labs': ['aboBloodType', 'hlaTyping', 'crossmatchResults', 'panelReactiveAntibodies', 'viralSerologyPanel', 'cancerScreeningResults'],
  'functional-psychosocial': ['functionalStatusAssessment', 'psychosocialEvaluation', 'liverBiopsy'],
  'risk-factors': ['contraindications', 'vaccineStatus', 'calculatedMeldScore', 'estimatedGlomerularFiltrationRate'],
};

const ARRAY_FIELDS = ['contraindications', 'vaccineStatus'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

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

  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);

  if (sentences.length > 1) {
    let n = 1;
    return (
      <View key={fn} style={styles.fieldBox}>
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
                    <Text key={ciIdx} style={styles.listItem}>{n++}. {ci}</Text>
                  ))}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
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
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const hasAny = fields.some(f => hasVal(record[f]));
  if (!hasAny) return null;

  return (
    <View key={sid} style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(f => renderField(record, f))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const TransplantEvaluationsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else if (Array.isArray(docProp)) {
    records = docProp.flatMap(r => {
      if (r?.transplant_evaluations) return Array.isArray(r.transplant_evaluations) ? r.transplant_evaluations : [r.transplant_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; return [dd]; }
      return [r];
    });
  } else {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Transplant Evaluations</Text>
          </View>
          <Text style={styles.noDataText}>No transplant evaluation data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Transplant Evaluations</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.createdAt) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>
                {record.organType ? `${record.organType.charAt(0).toUpperCase() + record.organType.slice(1)} Transplant Evaluation` : `Transplant Evaluation ${idx + 1}`}
              </Text>
            </View>
            {renderSection(record, 'transplant-info')}
            {renderSection(record, 'cardiac-pulmonary')}
            {renderSection(record, 'immunology-labs')}
            {renderSection(record, 'functional-psychosocial')}
            {renderSection(record, 'risk-factors')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TransplantEvaluationsDocumentPDFTemplate;
