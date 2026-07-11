/**
 * DrugGeneInteractionReportDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free B&W — Drug-Gene Interaction Report
 * Collection: drug_gene_interaction_report
 * PDF: NO BLUE — all borders/titles use #000000. Config-driven, mirrors the JSX 4-area layout
 * (section title rides the first field, numbered values, DASH-style field labels, sentence-split).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* enum canonical-casing (mirror of the JSX): 'poor metabolizer (PM)' → 'Poor Metabolizer (PM)'. */
const ENUM_OPTIONS = {
  metabolizerPhenotype: ['Poor Metabolizer (PM)', 'Intermediate Metabolizer (IM)', 'Normal Metabolizer (NM)', 'Rapid Metabolizer (RM)', 'Ultrarapid Metabolizer (UM)'],
  cpicRecommendationLevel: ['A (strong)', 'B (moderate)', 'C (optional)', 'D (no recommendation)'],
  clinicalActionability: ['Significant', 'Moderate', 'Minimal', 'None'],
  fdaPgxLabel: ['Testing Required', 'Testing Recommended', 'Actionable PGx', 'Informative PGx'],
  pharmgkbEvidenceLevel: ['1A', '1B', '2A', '2B', '3', '4'],
};
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

/* [.;] sentence split (mirror of the JSX splitBySentence) */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* hide-zero (mirror of the JSX numberShows):
   - populationAlleleFrequency / warfarinSensitivityScore: 0 is an unmeasured sentinel → hide.
   - activityScore: 0 is a REAL "no-function" result (e.g. CYP2C19 *2/*2 poor metabolizer) whenever
     genotyping context exists (phenotype/diplotype); otherwise an unmeasured sentinel → hide. */
const HIDE_ZERO = ['populationAlleleFrequency', 'warfarinSensitivityScore'];
const showField = (record, key, value) => {
  if (!hasVal(value)) return false;
  if (typeof value === 'number' && value === 0) {
    if (HIDE_ZERO.includes(key)) return false;
    if (key === 'activityScore') return hasVal(record.metabolizerPhenotype) || hasVal(record.diplotype);
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

/* renderFieldRow: label + a single numbered value (mirrors Copy's "1. value") */
const renderFieldRow = (label, value) => (
  <View style={styles.fieldBox} wrap={false}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
  </View>
);

/* renderSentenceSection: parseLabel + comma-split, numbered */
const renderSentenceSection = (label, text) => {
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => (row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>))}
    </View>
  );
};

/* renderArrayFieldPDF: numbered list */
const renderArrayFieldPDF = (label, items) => {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS — labels MUST mirror the JSX FIELD_LABELS exactly (4-area rule). */
const SECTION_CONFIGS = [
  { title: 'Drug Information', fields: [
    { key: 'drugName', label: 'Drug Name' },
    { key: 'drugClassification', label: 'Drug Classification' },
    { key: 'therapeuticIndex', label: 'Therapeutic Index' },
  ] },
  { title: 'Genetic Information', fields: [
    { key: 'geneSymbol', label: 'Gene Symbol' },
    { key: 'rsNumber', label: 'RS Number' },
    { key: 'cytochromeP450Enzyme', label: 'Cytochrome P450 Enzyme' },
    { key: 'metabolizerPhenotype', label: 'Metabolizer Phenotype' },
    { key: 'diplotype', label: 'Diplotype' },
    { key: 'activityScore', label: 'Activity Score' },
  ] },
  { title: 'Clinical Guidelines', fields: [
    { key: 'cpicRecommendationLevel', label: 'CPIC Recommendation Level' },
    { key: 'fdaPgxLabel', label: 'FDA PGx Label' },
    { key: 'pharmgkbEvidenceLevel', label: 'PharmGKB Evidence Level' },
    { key: 'clinicalActionability', label: 'Clinical Actionability' },
  ] },
  { title: 'Dosing & Safety', fields: [
    { key: 'dosingRecommendation', label: 'Dosing Recommendation', isSentence: true },
    { key: 'plasmaConcentrationImpact', label: 'Plasma Concentration Impact' },
    { key: 'adverseEventRisk', label: 'Adverse Event Risk', isSentence: true },
  ] },
  { title: 'Gene Details', fields: [
    { key: 'hlaAssociation', label: 'HLA Association' },
    { key: 'drugTransporterGene', label: 'Drug Transporter Gene' },
    { key: 'pharmacodynamicGene', label: 'Pharmacodynamic Gene' },
    { key: 'genotypingMethodology', label: 'Genotyping Methodology' },
  ] },
  { title: 'Concomitant Drug Interactions', fields: [
    { key: 'concomitantDrugInteractions', label: 'Concomitant Drug Interactions', isArray: true },
  ] },
  { title: 'Population & Sensitivity Data', fields: [
    { key: 'populationAlleleFrequency', label: 'Population Allele Frequency' },
    { key: 'warfarinSensitivityScore', label: 'Warfarin Sensitivity Score' },
    { key: 'opioidResponsePrediction', label: 'Opioid Response Prediction' },
  ] },
];

/* ======= COMPONENT ======= */
const DrugGeneInteractionReportDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.drug_gene_interaction_report) return Array.isArray(r.drug_gene_interaction_report) ? r.drug_gene_interaction_report : [r.drug_gene_interaction_report];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.drug_gene_interaction_report) return Array.isArray(dd.drug_gene_interaction_report) ? dd.drug_gene_interaction_report : [dd.drug_gene_interaction_report]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Drug-Gene Interaction Report</Text>
          </View>
          <Text style={styles.noDataText}>No drug-gene interaction data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Drug-Gene Interaction Report</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Drug-Gene Interaction Report ${index + 1}`}</Text>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => showField(record, f.key, record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!showField(record, field.key, val)) return null;
                    const _first = !_t; _t = true;
                    const _dispVal = ENUM_OPTIONS[field.key] ? enumCanonical(field.key, fmtVal(val)) : val; // canonical enum casing
                    const _el = field.isArray ? renderArrayFieldPDF(field.label, val) : field.isSentence ? renderSentenceSection(field.label, val) : renderFieldRow(field.label, _dispVal);
                    if (_first) return <View key={fIdx} wrap={false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text>{_el}</View>;
                    return <View key={fIdx}>{_el}</View>;
                  }); })()}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DrugGeneInteractionReportDocumentPDFTemplate;
