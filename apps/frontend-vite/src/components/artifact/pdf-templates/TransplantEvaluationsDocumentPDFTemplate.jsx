/** Transplant Evaluations — canonical box-free PDF, collection transplant_evaluations. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'transplant-info': 'Transplant Information',
  'cardiac-pulmonary': 'Cardiac & Pulmonary',
  'immunology-labs': 'Immunology & Labs',
  'functional-psychosocial': 'Functional & Psychosocial',
  'risk-factors': 'Risk Factors & Screening',
};
const FIELD_LABELS = {
  organType: 'Organ Type', transplantEligibilityStatus: 'Transplant Eligibility Status', dialysisHistory: 'Dialysis History',
  bodyMassIndex: 'Body Mass Index (BMI)', leftVentricularEjectionFraction: 'Left Ventricular Ejection Fraction',
  nyhaClassification: 'NYHA Classification', coronaryAngiographyResults: 'Coronary Angiography Results',
  pulmonaryFunctionTests: 'Pulmonary Function Tests', aboBloodType: 'ABO Blood Type', hlaTyping: 'HLA Typing',
  crossmatchResults: 'Crossmatch Results', panelReactiveAntibodies: 'Panel Reactive Antibodies',
  viralSerologyPanel: 'Viral Serology Panel', cancerScreeningResults: 'Cancer Screening Results',
  functionalStatusAssessment: 'Functional Status Assessment', psychosocialEvaluation: 'Psychosocial Evaluation',
  liverBiopsy: 'Liver Biopsy', contraindications: 'Contraindications', vaccineStatus: 'Vaccine Status',
  calculatedMeldScore: 'Calculated MELD Score', estimatedGlomerularFiltrationRate: 'Estimated GFR (eGFR)',
};
const SECTION_FIELDS = {
  'transplant-info': ['organType', 'transplantEligibilityStatus', 'dialysisHistory', 'bodyMassIndex'],
  'cardiac-pulmonary': ['leftVentricularEjectionFraction', 'nyhaClassification', 'coronaryAngiographyResults', 'pulmonaryFunctionTests'],
  'immunology-labs': ['aboBloodType', 'hlaTyping', 'crossmatchResults', 'panelReactiveAntibodies', 'viralSerologyPanel', 'cancerScreeningResults'],
  'functional-psychosocial': ['functionalStatusAssessment', 'psychosocialEvaluation', 'liverBiopsy'],
  'risk-factors': ['contraindications', 'vaccineStatus', 'calculatedMeldScore', 'estimatedGlomerularFiltrationRate'],
};
const NUMBER_FIELDS = new Set(['bodyMassIndex', 'leftVentricularEjectionFraction', 'panelReactiveAntibodies', 'calculatedMeldScore', 'estimatedGlomerularFiltrationRate']);
const ARRAY_FIELDS = new Set(['contraindications', 'vaccineStatus']);
const PERIOD_SPLIT_FIELDS = new Set(['hlaTyping', 'psychosocialEvaluation', 'cancerScreeningResults', 'functionalStatusAssessment']);
const COMMA_ARRAY_FIELDS = new Set(['pulmonaryFunctionTests', 'hlaTyping', 'viralSerologyPanel']);
const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0);
const parseLabel = text => { const match = safeString(text).match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]+)/); return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: safeString(text) }; };
const splitByComma = text => {
  const source = safeString(text); const out = []; let current = ''; let depth = 0;
  for (const character of source) {
    if (character === '(') { depth += 1; current += character; }
    else if (character === ')') { depth = Math.max(0, depth - 1); current += character; }
    else if (character === ',' && depth === 0) { if (current.trim()) out.push(current.trim()); current = ''; }
    else current += character;
  }
  if (current.trim()) out.push(current.trim());
  return out.length ? out : [source];
};
const splitEditableClauses = (value, fieldPath) => {
  const source = safeString(value); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]; if (character === '(') depth += 1; if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || ''; const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; } else current += character;
  }
  push(); return out.length ? out : [source];
};
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => {
  if (record?.transplant_evaluations) return Array.isArray(record.transplant_evaluations) ? record.transplant_evaluations : [record.transplant_evaluations];
  if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.transplant_evaluations) return Array.isArray(inner.transplant_evaluations) ? inner.transplant_evaluations : [inner.transplant_evaluations]; return [inner]; }
  return [record];
}).filter(record => record && typeof record === 'object');

const TransplantEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn) => {
    const value = record[fn]; if (!hasVal(value)) return [];
    const label = FIELD_LABELS[fn] || fn; let rows = []; let rowNumber = 1;
    if (NUMBER_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {safeString(value)}</Text>);
    else if (ARRAY_FIELDS.has(fn)) (Array.isArray(value) ? value : [value]).filter(hasVal).forEach((item, index) => rows.push(<Text key={index} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>));
    else splitEditableClauses(value, fn).forEach((clause, clauseIndex) => {
      const parsed = parseLabel(clause); const source = parsed.isLabeled ? parsed.value : clause;
      const items = COMMA_ARRAY_FIELDS.has(fn) ? splitByComma(source) : [source];
      const itemRows = items.map((item, itemIndex) => <Text key={`${clauseIndex}-${itemIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>);
      if (parsed.isLabeled) rows.push(<View key={`${clauseIndex}-group`} wrap={false}><Text style={styles.subLabel}>{safeString(parsed.label)}</Text>{itemRows[0]}</View>, ...itemRows.slice(1));
      else rows.push(...itemRows);
    });
    if (rows.length <= 5) return [<View key={`${fn}-field`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{rows}</View>];
    if (rows.length) { const [first, ...rest] = rows; rows = [<View key={`${fn}-field`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>, ...rest]; }
    return rows;
  };
  const renderSection = (record, sid) => {
    let body = []; SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn)); }); if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` })); const [first, ...rest] = body;
    return <View key={sid} wrap={body.length > 10 ? true : false}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>;
  };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Transplant Evaluations</Text>{records.length === 0 && <Text style={styles.noDataText}>No transplant evaluation records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Transplant Evaluation ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}</Page></Document>;
};
export default TransplantEvaluationsDocumentPDFTemplate;
