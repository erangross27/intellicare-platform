/**
 * StiScreeningPanelDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — STI screening panel
 * Collection: sti_screening_panel
 * Rule #74: sectionTitle is inside the first present field View.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 3 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const FIELD_LABELS = {
  screeningDate: 'Screening Date',
  hivAntigenAntibodyResult: 'HIV Antigen/Antibody Result',
  hivViralLoadCopies: 'HIV Viral Load (copies/mL)',
  hivConfirmatoryMethod: 'HIV Confirmatory Method',
  cd4CountCellsPerMicroliter: 'CD4 Count (cells/µL)',
  cd4Cd8Ratio: 'CD4/CD8 Ratio',
  prepEligibilityStatus: 'PrEP Eligibility Status',
  rprTiter: 'RPR Titer',
  treponemaPallidumAntibody: 'Treponema Pallidum Antibody',
  syphilisStage: 'Syphilis Stage',
  chlamydiaNaatResult: 'Chlamydia NAAT Result',
  gonorrheaNaatResult: 'Gonorrhea NAAT Result',
  specimenSourceSite: 'Specimen Source Site',
  mycoplasmaGenitaliumNaat: 'Mycoplasma Genitalium NAAT',
  antimicrobialResistanceMarkers: 'Antimicrobial Resistance Markers',
  hepatitisBSurfaceAntigen: 'Hepatitis B Surface Antigen',
  hepatitisBSurfaceAntibody: 'Hepatitis B Surface Antibody',
  hepatitisBCoreAntibody: 'Hepatitis B Core Antibody',
  hepatitisCantibodyResult: 'Hepatitis C Antibody Result',
  hcvRnaQuantitative: 'HCV RNA Quantitative',
  hsvTypeSpecificIgG: 'HSV Type-Specific IgG',
  trichomonasVaginalisResult: 'Trichomonas Vaginalis Result',
  humanPapillomavirusHighRisk: 'HPV High-Risk',
  hpvGenotyping: 'HPV Genotyping',
  expeditedPartnerTherapyProvided: 'Expedited Partner Therapy Provided',
};

const SECTION_CONFIGS = [
  { title: 'Screening Information', fields: [{ key: 'screeningDate', isDate: true }] },
  { title: 'HIV Status', fields: [
    { key: 'hivAntigenAntibodyResult', isSentence: true },
    { key: 'hivViralLoadCopies', isNumber: true },
    { key: 'hivConfirmatoryMethod', isSentence: true },
    { key: 'cd4CountCellsPerMicroliter', isNumber: true },
    { key: 'cd4Cd8Ratio', isNumber: true },
    { key: 'prepEligibilityStatus', isBoolean: true },
  ] },
  { title: 'Syphilis Results', fields: [
    { key: 'rprTiter', isSentence: true },
    { key: 'treponemaPallidumAntibody', isSentence: true },
    { key: 'syphilisStage', isSentence: true },
  ] },
  { title: 'Bacterial STIs', fields: [
    { key: 'chlamydiaNaatResult', isSentence: true },
    { key: 'gonorrheaNaatResult', isSentence: true },
    { key: 'specimenSourceSite', isArray: true },
    { key: 'mycoplasmaGenitaliumNaat', isSentence: true },
    { key: 'antimicrobialResistanceMarkers', isArray: true },
  ] },
  { title: 'Viral Hepatitis', fields: [
    { key: 'hepatitisBSurfaceAntigen', isSentence: true },
    { key: 'hepatitisBSurfaceAntibody', isSentence: true },
    { key: 'hepatitisBCoreAntibody', isSentence: true },
    { key: 'hepatitisCantibodyResult', isSentence: true },
    { key: 'hcvRnaQuantitative', isNumber: true },
  ] },
  { title: 'Additional Tests', fields: [
    { key: 'hsvTypeSpecificIgG', isCommaString: true },
    { key: 'trichomonasVaginalisResult', isSentence: true },
    { key: 'humanPapillomavirusHighRisk', isSentence: true },
    { key: 'hpvGenotyping', isArray: true },
    { key: 'expeditedPartnerTherapyProvided', isBoolean: true },
  ] },
];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(item => item.trim()).filter(Boolean);
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (const ch of text) {
    if (ch === '(') { depth += 1; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const numberShowsPDF = (record, key) => {
  const value = record[key];
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return false;
  const zeroSentinels = ['cd4CountCellsPerMicroliter', 'cd4Cd8Ratio', 'hcvRnaQuantitative'];
  if (Number(value) === 0 && zeroSentinels.includes(key)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle) => {
  const value = record[field.key];
  let rows = [];
  if (field.isDate) rows = [formatDate(value)];
  else if (field.isBoolean) rows = [value ? 'Yes' : 'No'];
  else if (field.isArray) rows = value.filter(item => item && String(item).trim()).map(String);
  else if (field.isCommaString) rows = splitByComma(String(value));
  else if (field.isSentence) rows = splitBySentence(String(value));
  else rows = [String(value)];

  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{FIELD_LABELS[field.key] || field.key}</Text>
      {rows.map((row, index) => <Text key={index} style={rows.length > 1 ? styles.listItem : styles.fieldValue}>{index + 1}. {row}</Text>)}
    </View>
  );
};

const StiScreeningPanelDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(record => {
      if (record?.sti_screening_panel) return Array.isArray(record.sti_screening_panel) ? record.sti_screening_panel : [record.sti_screening_panel];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.sti_screening_panel) return Array.isArray(nested.sti_screening_panel) ? nested.sti_screening_panel : [nested.sti_screening_panel];
        return [nested];
      }
      return [record];
    });
    return arr.filter(record => record && typeof record === 'object');
  }, [data]);

  if (records.length === 0) {
    return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>STI Screening Panel</Text></View><Text style={styles.noDataText}>No data available</Text></Page></Document>;
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>STI Screening Panel</Text></View>
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{`STI Screening Panel ${recordIndex + 1}`}</Text></View>
            {SECTION_CONFIGS.map((section, sectionIndex) => {
              const present = section.fields.filter(field => fieldPresent(record, field));
              if (present.length === 0) return null;
              return <View key={sectionIndex} style={styles.section} wrap={false}>{present.map((field, fieldIndex) => <View key={field.key}>{renderField(record, field, fieldIndex === 0 ? section.title : null)}</View>)}</View>;
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StiScreeningPanelDocumentPDFTemplate;
