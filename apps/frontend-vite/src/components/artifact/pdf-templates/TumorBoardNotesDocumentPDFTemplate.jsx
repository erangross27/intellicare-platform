import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * TumorBoardNotesDocumentPDFTemplate
 * July 2026 — canonical box-free LETTER rendering.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 20, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8 },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 19, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 12, color: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 5 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBlock: { marginBottom: 8, paddingLeft: 8 },
  fieldLabel: { fontSize: 13, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 5, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  subLabel: { fontSize: 13, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3 },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8, marginBottom: 4 },
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
const COMMA_SPLIT_FIELDS = new Set(['histopathology', 'organFunctionStatus']);

const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};

const splitByComma = (text) => {
  const result = []; let current = ''; let depth = 0;
  for (const char of String(text || '')) {
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
};

const splitBySentence = (text, field = '') => {
  const clauses = String(text || '').split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(value => value.trim()).filter(Boolean);
  return COMMA_SPLIT_FIELDS.has(field) ? clauses.flatMap(splitByComma) : clauses;
};

const TumorBoardNotesDocumentPDFTemplate = ({ document: docProp, data, templateData }) => {
  const source = docProp ?? data ?? templateData;

  let records = source;
  if (!Array.isArray(records)) records = [records];
  records = records.flatMap(record => {
    if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
    if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
    if (record?.tumor_board_notes && Array.isArray(record.tumor_board_notes)) return record.tumor_board_notes;
    if (record?.data?.tumor_board_notes) return Array.isArray(record.data.tumor_board_notes) ? record.data.tumor_board_notes : [record.data.tumor_board_notes];
    if (record?.documentData) { const dd = record.documentData; if (Array.isArray(dd)) return dd; if (dd?.tumor_board_notes) return Array.isArray(dd.tumor_board_notes) ? dd.tumor_board_notes : [dd.tumor_board_notes]; return [dd]; }
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
          <Text style={styles.listItem}>1. {val ? 'Yes' : 'No'}</Text>
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

    const rows = typeof val === 'string' ? splitBySentence(val, fieldName) : [String(val)];
    return (
      <View key={fieldName} style={styles.fieldBlock}>
        <View wrap={false}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {(() => { const parsed = parseLabel(rows[0]); return parsed ? <><Text style={styles.subLabel}>{safeString(parsed.label)}</Text><Text style={styles.listItem}>1. {safeString(parsed.value)}</Text></> : <Text style={styles.listItem}>1. {safeString(rows[0])}</Text>; })()}
        </View>
        {rows.slice(1).map((row, index) => { const parsed = parseLabel(row); return parsed ? <View key={index}><Text style={styles.subLabel}>{safeString(parsed.label)}</Text><Text style={styles.listItem}>{index + 2}. {safeString(parsed.value)}</Text></View> : <Text key={index} style={styles.listItem}>{index + 2}. {safeString(row)}</Text>; })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Tumor Board Notes</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false}><Text style={styles.recordTitle}>Tumor Board Note {idx + 1}</Text></View>

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
