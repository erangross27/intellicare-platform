/** TPN Management — canonical box-free PDF, collection tpn_management. */
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
  'tpn-overview': 'TPN Overview', macronutrients: 'Macronutrients', electrolytes: 'Electrolytes', additives: 'Additives',
  access: 'Venous Access', monitoring: 'Monitoring', complications: 'Complications & Tolerance',
};
const FIELD_LABELS = {
  tpnIndicationType: 'TPN Indication Type', estimatedTpnDuration: 'Estimated TPN Duration', totalDailyCalories: 'Total Daily Calories',
  proteinProvision: 'Protein Provision', infusionRate: 'Infusion Rate', cyclicTpnSchedule: 'Cyclic TPN Schedule', dextroseConcentration: 'Dextrose Concentration',
  lipidEmulsionType: 'Lipid Emulsion Type', lipidDose: 'Lipid Dose', sodiumProvision: 'Sodium Provision', potassiumProvision: 'Potassium Provision',
  phosphorusProvision: 'Phosphorus Provision', calciumGluconateProvision: 'Calcium Gluconate Provision', magnesiumProvision: 'Magnesium Provision',
  traceElementsFormulation: 'Trace Elements Formulation', multiVitaminAdditive: 'Multivitamin Additive', centralVenousAccessType: 'Central Venous Access Type',
  catheterTipPosition: 'Catheter Tip Position', baselinePrealbuminLevel: 'Baseline Prealbumin Level', triglycerideMonitoring: 'Triglyceride Monitoring',
  bloodGlucoseManagement: 'Blood Glucose Management', hepaticFunctionPanel: 'Hepatic Function Panel', refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  tpnAssociatedCholestasis: 'TPN-Associated Cholestasis', catheterRelatedBloodstreamInfection: 'Catheter-Related Bloodstream Infection', enteralFeedingTolerance: 'Enteral Feeding Tolerance',
};
const SECTION_FIELDS = {
  'tpn-overview': ['tpnIndicationType', 'estimatedTpnDuration', 'totalDailyCalories', 'proteinProvision', 'infusionRate', 'cyclicTpnSchedule'],
  macronutrients: ['dextroseConcentration', 'lipidEmulsionType', 'lipidDose'], electrolytes: ['sodiumProvision', 'potassiumProvision', 'phosphorusProvision', 'calciumGluconateProvision', 'magnesiumProvision'],
  additives: ['traceElementsFormulation', 'multiVitaminAdditive'], access: ['centralVenousAccessType', 'catheterTipPosition'],
  monitoring: ['baselinePrealbuminLevel', 'triglycerideMonitoring', 'bloodGlucoseManagement', 'hepaticFunctionPanel'],
  complications: ['refeedingSyndromeRisk', 'tpnAssociatedCholestasis', 'catheterRelatedBloodstreamInfection', 'enteralFeedingTolerance'],
};
const NUMBER_UNITS = {
  totalDailyCalories: 'kcal/day', proteinProvision: 'g/day', dextroseConcentration: '%', lipidDose: 'g/kg/day', infusionRate: 'mL/hour',
  sodiumProvision: 'mEq/day', potassiumProvision: 'mEq/day', phosphorusProvision: 'mmol/day', calciumGluconateProvision: 'mEq/day',
  magnesiumProvision: 'mEq/day', baselinePrealbuminLevel: 'mg/dL', triglycerideMonitoring: 'mg/dL',
};
const NUMBER_FIELDS = new Set(Object.keys(NUMBER_UNITS));
const BOOLEAN_FIELDS = new Set(['tpnAssociatedCholestasis', 'catheterRelatedBloodstreamInfection']);
const ARRAY_FIELDS = new Set(['hepaticFunctionPanel']);
const PERIOD_SPLIT_FIELDS = new Set(['cyclicTpnSchedule', 'refeedingSyndromeRisk', 'bloodGlucoseManagement']);
const COMMA_SPLIT_FIELDS = new Set(['refeedingSyndromeRisk']);
const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(Boolean));
const sameAsTitle = (label, sid) => label.trim().toLowerCase() === SECTION_TITLES[sid].trim().toLowerCase();
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]+)/); return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') }; };
const splitByComma = text => {
  const source = String(text || ''); const out = []; let current = ''; let depth = 0;
  for (let i = 0; i < source.length; i += 1) { const ch = source[i]; if (ch === '(') depth += 1; if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0) { const before = current.trim(); const after = source.slice(i + 1).trimStart(); if (/\d$/.test(before) && /^\d{3}\b/.test(after)) current += ch; else { if (before) out.push(before); current = ''; } } else current += ch; }
  if (current.trim()) out.push(current.trim()); return out.length ? out : [source];
};
const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? ''); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; };
  for (let i = 0; i < source.length; i += 1) { const ch = source[i]; if (ch === '(') depth += 1; if (ch === ')') depth = Math.max(0, depth - 1); const next = source[i + 1] || ''; const safePeriod = ch === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next) && !/\d$/.test(current); const safeSemicolon = ch === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0; if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[i + 1] || '')) i += 1; } else current += ch; }
  push(); return out.length ? out : [source];
};
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => {
  if (record?.tpn_management) return Array.isArray(record.tpn_management) ? record.tpn_management : [record.tpn_management];
  if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.tpn_management) return Array.isArray(inner.tpn_management) ? inner.tpn_management : [inner.tpn_management]; return [inner]; }
  return [record];
}).filter(record => record && typeof record === 'object');

const TpnManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn, sid) => {
    const value = record[fn]; if (!hasVal(value)) return [];
    const label = FIELD_LABELS[fn] || fn; const elements = [];
    if (NUMBER_FIELDS.has(fn)) elements.push(<Text key={`${fn}-number`} style={styles.listItem}>1. {safeString(value)} {NUMBER_UNITS[fn]}</Text>);
    else if (BOOLEAN_FIELDS.has(fn)) elements.push(<Text key={`${fn}-bool`} style={styles.listItem}>1. {value ? 'Yes' : 'No'}</Text>);
    else if (ARRAY_FIELDS.has(fn)) value.filter(Boolean).forEach((item, index) => elements.push(<Text key={`${fn}-${index}`} style={styles.listItem}>{index + 1}. {safeString(item)}</Text>));
    else { let rowNumber = 1; splitEditableClauses(value, fn).forEach((clause, clauseIndex) => { const parsed = parseLabel(clause); if (parsed.isLabeled) elements.push(<Text key={`${fn}-${clauseIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>); const items = COMMA_SPLIT_FIELDS.has(fn) ? splitByComma(parsed.isLabeled ? parsed.value : clause) : [parsed.isLabeled ? parsed.value : clause]; items.forEach((item, itemIndex) => elements.push(<Text key={`${fn}-${clauseIndex}-${itemIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>)); }); }
    if (!sameAsTitle(label, sid) && elements.length) { const [first, ...rest] = elements; return [<View key={`${fn}-head`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>, ...rest]; }
    return elements;
  };
  const renderSection = (record, sid) => { let body = []; SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); }); if (!body.length) return null; body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` })); const [first, ...rest] = body; return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>; };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>TPN Management</Text>{records.length === 0 && <Text style={styles.noDataText}>No TPN management records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`TPN Management ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}</Page></Document>;
};

export default TpnManagementDocumentPDFTemplate;
