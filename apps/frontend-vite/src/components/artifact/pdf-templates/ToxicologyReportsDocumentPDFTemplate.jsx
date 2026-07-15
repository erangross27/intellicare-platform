/**
 * ToxicologyReportsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free toxicology report
 * Collection: toxicology_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'patient-info': 'Patient Information', 'specimen-info': 'Specimen Information', 'chain-of-custody': 'Chain of Custody',
  'substances-detected': 'Substances Detected', 'concentration-levels': 'Concentration Levels', 'analysis-details': 'Analysis Details',
  'detection-parameters': 'Detection Parameters', pharmacokinetics: 'Pharmacokinetics', 'additional-markers': 'Additional Markers',
  'forensic-implications': 'Forensic Implications', 'quality-control': 'Quality Control',
};

const FIELD_LABELS = {
  patientAge: 'Patient Age', specimenType: 'Specimen Type', collectionDateTime: 'Collection Date', chainOfCustody: 'Chain of Custody',
  substancesDetected: 'Substances Detected', concentrationLevels: 'Concentration Levels', therapeuticRange: 'Therapeutic Range',
  analyticalMethod: 'Analytical Method', poisoningClassification: 'Poisoning Classification', clinicalSeverity: 'Clinical Severity',
  postmortemFindings: 'Postmortem Findings', limitOfDetection: 'Limit of Detection', limitOfQuantification: 'Limit of Quantification',
  metabolites: 'Metabolites', drugInteractions: 'Drug Interactions', halfLife: 'Half Life', timeToDetection: 'Time to Detection',
  antidoteRecommended: 'Antidote Recommended', interferingSubstances: 'Interfering Substances', carboxyhemoglobinLevel: 'Carboxyhemoglobin Level',
  cholinesteraseActivity: 'Cholinesterase Activity', ethylGlucuronide: 'Ethyl Glucuronide', forensicImplications: 'Forensic Implications',
  qualityControlResults: 'Quality Control',
};

const SECTION_FIELDS = {
  'patient-info': ['patientAge'], 'specimen-info': ['specimenType', 'collectionDateTime'], 'chain-of-custody': ['chainOfCustody'],
  'substances-detected': ['substancesDetected'], 'concentration-levels': ['concentrationLevels'],
  'analysis-details': ['therapeuticRange', 'analyticalMethod', 'poisoningClassification', 'clinicalSeverity', 'postmortemFindings'],
  'detection-parameters': ['limitOfDetection', 'limitOfQuantification'],
  pharmacokinetics: ['metabolites', 'drugInteractions', 'halfLife', 'timeToDetection', 'antidoteRecommended', 'interferingSubstances'],
  'additional-markers': ['carboxyhemoglobinLevel', 'cholinesteraseActivity', 'ethylGlucuronide'],
  'forensic-implications': ['forensicImplications'], 'quality-control': ['qualityControlResults'],
};

const DATE_FIELDS = new Set(['collectionDateTime']);
const ARRAY_FIELDS = new Set(['substancesDetected', 'concentrationLevels', 'metabolites', 'drugInteractions', 'interferingSubstances']);
const PERIOD_SPLIT_FIELDS = new Set(['chainOfCustody', 'antidoteRecommended', 'forensicImplications', 'qualityControlResults']);
const COMMA_SPLIT_FIELDS = new Set(['analyticalMethod', 'antidoteRecommended', 'qualityControlResults']);

const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(Boolean);
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};
const formatDate = value => {
  try { const date = new Date(value?.$date || value); return isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return safeString(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') };
};
const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      const before = current.trim(); const after = source.slice(index + 1).trimStart();
      if (/\d$/.test(before) && /^\d{3}\b/.test(after)) current += character;
      else { if (before) result.push(before); current = ''; }
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? ''); const parts = []; let current = ''; let depth = 0;
  const push = () => { if (current.trim()) parts.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; }
    else current += character;
  }
  push(); return parts.length ? parts : [source];
};
const sameAsTitle = (label, sid) => label.trim().toLowerCase() === SECTION_TITLES[sid].trim().toLowerCase();
const unwrapRecords = data => {
  const initial = Array.isArray(data) ? data : data ? [data] : [];
  return initial.flatMap(record => {
    if (record?.toxicology_reports) return Array.isArray(record.toxicology_reports) ? record.toxicology_reports : [record.toxicology_reports];
    if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.toxicology_reports) return Array.isArray(inner.toxicology_reports) ? inner.toxicology_reports : [inner.toxicology_reports]; return [inner]; }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ToxicologyReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn, sid) => {
    const value = record[fn]; if (!hasVal(value)) return [];
    const label = FIELD_LABELS[fn] || fn; const elements = [];
    if (DATE_FIELDS.has(fn)) elements.push(<Text key={`${fn}-date`} style={styles.listItem}>1. {formatDate(value)}</Text>);
    else if (ARRAY_FIELDS.has(fn)) {
      (Array.isArray(value) ? value : [value]).filter(Boolean).forEach((item, itemIndex) => {
        const parsed = parseLabel(item);
        if (parsed.isLabeled) elements.push(<Text key={`${fn}-${itemIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        elements.push(<Text key={`${fn}-${itemIndex}`} style={styles.listItem}>{itemIndex + 1}. {safeString(parsed.isLabeled ? parsed.value : item)}</Text>);
      });
    } else {
      let rowNumber = 1;
      splitEditableClauses(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value, fn).forEach((clause, clauseIndex) => {
        const parsed = parseLabel(clause);
        const items = COMMA_SPLIT_FIELDS.has(fn) ? splitByComma(parsed.isLabeled ? parsed.value : clause) : [parsed.isLabeled ? parsed.value : clause];
        if (parsed.isLabeled) elements.push(<Text key={`${fn}-${clauseIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        items.forEach((item, itemIndex) => elements.push(<Text key={`${fn}-${clauseIndex}-${itemIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>));
      });
    }
    if (!sameAsTitle(label, sid) && elements.length) {
      const [first, ...rest] = elements;
      return [<View key={`${fn}-head`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>, ...rest];
    }
    return elements;
  };
  const renderSection = (record, sid) => {
    let body = [];
    SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>;
  };
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Toxicology Reports</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No toxicology report records available</Text>}
        {records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Toxicology Report ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}
      </Page>
    </Document>
  );
};

export default ToxicologyReportsDocumentPDFTemplate;
