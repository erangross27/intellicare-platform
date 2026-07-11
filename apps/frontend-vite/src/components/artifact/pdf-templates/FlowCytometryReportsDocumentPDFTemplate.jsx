/**
 * FlowCytometryReportsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: config-driven fields, values numbered
 * ('1.' even singles), enum canonical (specimenType/clonality/lightChainRestriction), boolean Yes/No, string
 * arrays numbered, narratives split on [.;] (labeled → sub-label + numbered comma items). Sentinel-0 number
 * fields hidden unless MEANINGFUL_ZERO (blastPercentage/minimumResidualDisease). Rule #74: each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View. Single-name label
 * gate. PHI footer is STATIC only. No date field in this schema. Collection: flow_cytometry_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_ORDER = ['specimen-info', 'lymphocyte-counts', 'blast-analysis', 'chain-restriction', 'mrd-section', 'panel-info', 'functional-assays'];
const SECTION_TITLES = {
  'specimen-info': 'Specimen Information',
  'lymphocyte-counts': 'Lymphocyte Counts',
  'blast-analysis': 'Blast Analysis & Immunophenotype',
  'chain-restriction': 'Chain Restriction & Abnormal Populations',
  'mrd-section': 'Minimal Residual Disease',
  'panel-info': 'Panel & Gating',
  'functional-assays': 'Functional Assays',
};
const FIELD_LABELS = {
  specimenType: 'Specimen Type', cellCount: 'Cell Count', cellViability: 'Cell Viability',
  lymphocyteCount: 'Lymphocyte Count', cd4Count: 'CD4 Count', cd8Count: 'CD8 Count', cd4Cd8Ratio: 'CD4/CD8 Ratio', bCellCount: 'B-Cell Count', nkCellCount: 'NK Cell Count',
  blastPercentage: 'Blast Percentage', immunophenotype: 'Immunophenotype', clonality: 'Clonality',
  lightChainRestriction: 'Light Chain Restriction', kappaLambdaRatio: 'Kappa/Lambda Ratio', abnormalPopulation: 'Abnormal Population', aberrantMarkers: 'Aberrant Markers',
  minimumResidualDisease: 'Minimal Residual Disease',
  antibodyPanel: 'Antibody Panel', fluorochromes: 'Fluorochromes', gatingStrategy: 'Gating Strategy',
  cytokineProduction: 'Cytokine Production', cellCycleAnalysis: 'Cell Cycle Analysis', apoptosisAssay: 'Apoptosis Assay',
};
const SECTION_FIELDS = {
  'specimen-info': ['specimenType', 'cellCount', 'cellViability'],
  'lymphocyte-counts': ['lymphocyteCount', 'cd4Count', 'cd8Count', 'cd4Cd8Ratio', 'bCellCount', 'nkCellCount'],
  'blast-analysis': ['blastPercentage', 'immunophenotype', 'clonality'],
  'chain-restriction': ['lightChainRestriction', 'kappaLambdaRatio', 'abnormalPopulation', 'aberrantMarkers'],
  'mrd-section': ['minimumResidualDisease'],
  'panel-info': ['antibodyPanel', 'fluorochromes', 'gatingStrategy'],
  'functional-assays': ['cytokineProduction', 'cellCycleAnalysis', 'apoptosisAssay'],
};
const NUMBER_FIELDS = ['cellCount', 'cellViability', 'lymphocyteCount', 'cd4Count', 'cd8Count', 'cd4Cd8Ratio', 'bCellCount', 'nkCellCount', 'blastPercentage', 'kappaLambdaRatio', 'minimumResidualDisease'];
const MEANINGFUL_ZERO_FIELDS = ['blastPercentage', 'minimumResidualDisease'];
const BOOLEAN_FIELDS = ['abnormalPopulation'];
const ARRAY_FIELDS = ['immunophenotype', 'aberrantMarkers', 'antibodyPanel', 'fluorochromes', 'cytokineProduction'];
const ENUM_FIELDS = ['specimenType', 'clonality', 'lightChainRestriction'];
const ENUM_OPTIONS = {
  specimenType: ['Peripheral Blood', 'Bone Marrow Aspirate', 'Lymph Node', 'CSF', 'Body Fluid', 'Tissue', 'Fine Needle Aspirate'],
  clonality: ['Polyclonal', 'Monoclonal', 'No Clonal Population', 'Indeterminate'],
  lightChainRestriction: ['Kappa', 'Lambda', 'None'],
};
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
/* sentinel-0 gate: mirror the on-screen component — 0 in a non-meaningful number field = "not recorded" → hide */
const hasFieldValue = (fieldName, v) => {
  if (typeof v === 'number' && v === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fieldName)) return false;
  return !isEmptyDeep(v);
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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

/* mirror the JSX/copy: multi-sentence → labeled sub-group (subLabel + numbered comma items) or numbered unlabeled row */
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* Rule #74: render a field as ONE wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasFieldValue(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  let body;
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    body = items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  } else if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (ENUM_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(enumCanonical(ENUM_OPTIONS[f], fmtScalar(val)))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const FlowCytometryReportsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].flow_cytometry_reports && Array.isArray(templateData[0].flow_cytometry_reports)) records = templateData[0].flow_cytometry_reports;
    else records = templateData;
  } else if (templateData && templateData.flow_cytometry_reports) {
    records = Array.isArray(templateData.flow_cytometry_reports) ? templateData.flow_cytometry_reports : [templateData.flow_cytometry_reports];
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Flow Cytometry Reports</Text></View>
        <Text style={styles.emptyState}>No flow cytometry reports data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Flow Cytometry Reports</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Flow Cytometry Report ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldValue(f, record[f]));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default FlowCytometryReportsDocumentPDFTemplate;
