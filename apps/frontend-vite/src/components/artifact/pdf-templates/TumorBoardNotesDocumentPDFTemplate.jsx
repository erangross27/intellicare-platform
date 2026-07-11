import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * TumorBoardNotesDocumentPDFTemplate
 * March 2026 — Helvetica, LETTER, 20pt title / 12pt body
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000', size: 'LETTER' },
  documentTitle: { fontSize: 20, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 20, textAlign: 'center' },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 16, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#424242' },
  recordSubtitle: { fontSize: 12, fontStyle: 'italic', marginBottom: 12, color: '#404040' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 6, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 3 },
  fieldBlock: { marginBottom: 8, paddingLeft: 8 },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#555555', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.3 },
  fieldValue: { fontSize: 12, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 8, marginBottom: 4 },
  textContent: { fontSize: 12, lineHeight: 1.5, paddingLeft: 8, color: '#000000' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 8 },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u03BC/g, 'u').replace(/\u00B0/g, ' deg').replace(/\u00B1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->').replace(/\u2190/g, '<-').replace(/\u00D7/g, 'x').replace(/\u00F7/g, '/').replace(/\u2022/g, '-').replace(/\u2013/g, '-').replace(/\u2014/g, '-').replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  return str;
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const SECTION_FIELDS = {
  'tumor-overview': ['primaryTumorSite', 'tumorSize', 'tumorGrade', 'histopathology', 'ajccStage', 'tnmStaging'],
  'biomarkers-genomics': ['biomarkerStatus', 'genomicTesting'],
  'staging-spread': ['metastaticSites', 'lymphNodeInvolvement', 'imagingFindings'],
  'patient-status': ['patientAge', 'performanceStatus', 'comorbidityIndex', 'organFunctionStatus', 'radiationEligibility', 'clinicalTrialEligibility'],
  'treatment-plan': ['treatmentGoals', 'priorTreatments', 'surgicalResectability', 'treatmentToxicityRisk'],
  'consensus-followup': ['multidisciplinaryConsensus', 'prognosticFactors', 'followUpPlan'],
};

const SECTION_TITLES = {
  'tumor-overview': 'Tumor Overview',
  'biomarkers-genomics': 'Biomarkers & Genomics',
  'staging-spread': 'Staging & Spread',
  'patient-status': 'Patient Status',
  'treatment-plan': 'Treatment Plan',
  'consensus-followup': 'Consensus & Follow-Up',
};

const FIELD_LABELS = {
  primaryTumorSite: 'Primary Tumor Site',
  tumorSize: 'Tumor Size',
  tumorGrade: 'Tumor Grade',
  histopathology: 'Histopathology',
  ajccStage: 'AJCC Stage',
  tnmStaging: 'TNM Staging',
  biomarkerStatus: 'Biomarker Status',
  genomicTesting: 'Genomic Testing',
  metastaticSites: 'Metastatic Sites',
  lymphNodeInvolvement: 'Lymph Node Involvement',
  imagingFindings: 'Imaging Findings',
  patientAge: 'Patient Age',
  performanceStatus: 'Performance Status',
  comorbidityIndex: 'Comorbidity Index',
  organFunctionStatus: 'Organ Function Status',
  radiationEligibility: 'Radiation Eligibility',
  clinicalTrialEligibility: 'Clinical Trial Eligibility',
  treatmentGoals: 'Treatment Goals',
  priorTreatments: 'Prior Treatments',
  surgicalResectability: 'Surgical Resectability',
  treatmentToxicityRisk: 'Treatment Toxicity Risk',
  multidisciplinaryConsensus: 'Multidisciplinary Consensus',
  prognosticFactors: 'Prognostic Factors',
  followUpPlan: 'Follow-Up Plan',
};

const BOOLEAN_FIELDS = ['radiationEligibility', 'clinicalTrialEligibility'];
const ARRAY_FIELDS = ['biomarkerStatus', 'metastaticSites', 'priorTreatments', 'prognosticFactors'];

const TumorBoardNotesDocumentPDFTemplate = ({ document: docProp }) => {
  const templateData = docProp;

  let records = templateData;
  if (!Array.isArray(records)) records = [records];
  records = records.flatMap(record => {
    if (record?.tumor_board_notes && Array.isArray(record.tumor_board_notes)) return record.tumor_board_notes;
    if (record?.documentData) { const dd = record.documentData; if (Array.isArray(dd)) return dd; return [dd]; }
    return [record];
  });
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Tumor Board Notes</Text>
          <Text style={{ textAlign: 'center', color: '#666666' }}>No tumor board notes available.</Text>
        </Page>
      </Document>
    );
  }

  const renderField = (record, fieldName) => {
    const val = record[fieldName];
    if (!hasValue(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;

    if (BOOLEAN_FIELDS.includes(fieldName)) {
      return (
        <View key={fieldName} style={styles.fieldBlock} wrap={false}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
        </View>
      );
    }

    if (ARRAY_FIELDS.includes(fieldName)) {
      const items = Array.isArray(val) ? val.filter(Boolean) : [val];
      if (items.length === 0) return null;
      return (
        <View key={fieldName} style={styles.fieldBlock}>
          <View wrap={false}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.listItem}>1. {safeString(items[0])}</Text>
          </View>
          {items.slice(1).map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>
          ))}
        </View>
      );
    }

    return (
      <View key={fieldName} style={styles.fieldBlock} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{typeof val === 'number' ? String(val) : safeString(val)}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Tumor Board Notes</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>Tumor Board Note {idx + 1}</Text>
              {hasValue(record.primaryTumorSite) && (
                <Text style={styles.recordSubtitle}>{safeString(record.primaryTumorSite)}{hasValue(record.ajccStage) ? ` - Stage ${record.ajccStage}` : ''}</Text>
              )}
            </View>

            {Object.entries(SECTION_FIELDS).map(([sid, fields]) => {
              const hasAny = fields.some(f => hasValue(record[f]));
              if (!hasAny) return null;
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  </View>
                  {fields.map(f => renderField(record, f))}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TumorBoardNotesDocumentPDFTemplate;
