/**
 * PotentialTestingOutcomesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — potential testing outcomes
 * Collection: potential_testing_outcomes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
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
  try { const d = new Date(dateStr.$date || dateStr); return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* parseLabel */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitBySentence */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* splitByComma — parenthesis-aware */
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

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'diagnostic-imaging': 'Diagnostic Imaging',
  'cardiac-testing': 'Cardiac Testing',
  'laboratory-panels': 'Laboratory Panels',
  'specialized-testing': 'Specialized Testing',
  'additional-studies': 'Additional Studies',
};

const FIELD_LABELS = {
  laboratoryValues: 'Laboratory Values',
  imagingFindings: 'Imaging Findings',
  boneDensitometry: 'Bone Densitometry',
  mammmographyResults: 'Mammography Results',
  electrocardiogramResults: 'Electrocardiogram Results',
  echocardiogramResults: 'Echocardiogram Results',
  stressTestResults: 'Stress Test Results',
  holterMonitorResults: 'Holter Monitor Results',
  cardiacEnzymes: 'Cardiac Enzymes',
  ankleBrachialIndex: 'Ankle Brachial Index',
  thyroidFunctionTests: 'Thyroid Function Tests',
  hemoglobinA1c: 'Hemoglobin A1c',
  liverFunctionPanel: 'Liver Function Panel',
  glomerularFiltrationRate: 'Glomerular Filtration Rate',
  urinalysisResults: 'Urinalysis Results',
  arterialBloodGas: 'Arterial Blood Gas',
  coagulationStudies: 'Coagulation Studies',
  pulmonaryFunctionTests: 'Pulmonary Function Tests',
  colonoscopyFindings: 'Colonoscopy Findings',
  pathologyReport: 'Pathology Report',
  microbiolgyResults: 'Microbiology Results',
  sleepStudyResults: 'Sleep Study Results',
  cerebrospinalFluidAnalysis: 'Cerebrospinal Fluid Analysis',
};

const SECTION_FIELDS = {
  'diagnostic-imaging': ['imagingFindings', 'boneDensitometry', 'mammmographyResults'],
  'cardiac-testing': ['electrocardiogramResults', 'echocardiogramResults', 'stressTestResults', 'holterMonitorResults', 'cardiacEnzymes', 'ankleBrachialIndex'],
  'laboratory-panels': ['laboratoryValues', 'thyroidFunctionTests', 'hemoglobinA1c', 'liverFunctionPanel', 'glomerularFiltrationRate', 'urinalysisResults', 'arterialBloodGas', 'coagulationStudies'],
  'specialized-testing': ['pulmonaryFunctionTests', 'colonoscopyFindings', 'pathologyReport', 'microbiolgyResults'],
  'additional-studies': ['sleepStudyResults', 'cerebrospinalFluidAnalysis'],
};

const NUMBER_FIELDS = ['ankleBrachialIndex', 'glomerularFiltrationRate', 'hemoglobinA1c'];

/* ======= PDF COMPONENT ======= */
const PotentialTestingOutcomesDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else {
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.potential_testing_outcomes) return Array.isArray(r.potential_testing_outcomes) ? r.potential_testing_outcomes : [r.potential_testing_outcomes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.potential_testing_outcomes) return Array.isArray(dd.potential_testing_outcomes) ? dd.potential_testing_outcomes : [dd.potential_testing_outcomes]; return [dd]; }
      return [r];
    });
    records = arr.filter(r => r && typeof r === 'object');
  }

  // Clean underscore-prefixed fields
  records = records.map(record => {
    if (!record || typeof record !== 'object') return record;
    const clean = {};
    for (const key of Object.keys(record)) { if (!key.startsWith('_')) clean[key] = record[key]; }
    return clean;
  });

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Potential Testing Outcomes</Text></View>
          <Text style={styles.noDataText}>No potential testing outcomes data available</Text>
        </Page>
      </Document>
    );
  }

  const renderField = (record, fn) => {
    const val = record[fn];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;

    if (NUMBER_FIELDS.includes(fn)) {
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{fmtVal(val)}</Text>
        </View>
      );
    }

    if (Array.isArray(val)) {
      const items = val.filter(Boolean);
      if (items.length === 0) return null;
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
        </View>
      );
    }

    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length <= 1) {
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{strVal}</Text>
        </View>
      );
    }

    /* Multi-sentence with parseLabel / splitByComma */
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, sIdx) => {
          const parsed = parseLabel(s);
          if (parsed.isLabeled) {
            const parts = splitByComma(parsed.value);
            if (parts.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  {parts.map((p, pIdx) => <Text key={pIdx} style={styles.listItem}>{pIdx + 1}. {p}</Text>)}
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
          return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>;
        })}
      </View>
    );
  };

  const renderSection = (record, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const anyVal = fields.some(f => hasVal(record[f]));
    if (!anyVal) return null;
    return (
      <View key={sid} style={styles.section} wrap={false} minPresenceAhead={80}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {fields.map(f => renderField(record, f))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Potential Testing Outcomes</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Potential Testing Outcomes {idx + 1}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PotentialTestingOutcomesDocumentPDFTemplate;
