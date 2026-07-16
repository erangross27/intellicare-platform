/** Trauma Flow Sheet — canonical box-free PDF, collection trauma_flow_sheets. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});
const SECTION_TITLES = { 'trauma-scores': 'Trauma Scores', 'vital-signs': 'Vital Signs', 'injury-primary-survey': 'Injury & Primary Survey', 'imaging-protocols': 'Imaging & Protocols', resuscitation: 'Resuscitation', 'labs-timing': 'Labs & Timing' };
const FIELD_LABELS = {
  glasgowComaScale: 'Glasgow Coma Scale', injurySeverityScore: 'Injury Severity Score (ISS)', revisedTraumaScore: 'Revised Trauma Score (RTS)', traumaAndInjurySeverityScore: 'TRISS Probability of Survival', systolicBloodPressure: 'Systolic BP (mmHg)', diastolicBloodPressure: 'Diastolic BP (mmHg)', heartRate: 'Heart Rate (bpm)', respiratoryRate: 'Respiratory Rate', oxygenSaturation: 'Oxygen Saturation (%)', mechanismOfInjury: 'Mechanism of Injury', primarySurveyFindings: 'Primary Survey Findings', pupillaryResponse: 'Pupillary Response', fractureSites: 'Fracture Sites', pneumothoraxPresent: 'Pneumothorax Present', focusedAbdominalSonographyScore: 'FAST Exam Findings', cervicalSpineProtocol: 'Cervical Spine Protocol', abdominopelvicCTFindings: 'Abdominopelvic CT Findings', organInjuryScale: 'Organ Injury Scale', fluidResuscitationVolume: 'Fluid Resuscitation Volume (mL)', bloodProductsAdministered: 'Blood Products Administered', massiveTransfusionProtocol: 'Massive Transfusion Protocol', intracranialPressure: 'Intracranial Pressure (mmHg)', hemoglobinLevel: 'Hemoglobin (g/dL)', lactateLevel: 'Lactate (mmol/L)', traumaBayArrivalTime: 'Trauma Bay Arrival Time',
};
const SECTION_FIELDS = {
  'trauma-scores': ['glasgowComaScale', 'injurySeverityScore', 'revisedTraumaScore', 'traumaAndInjurySeverityScore'],
  'vital-signs': ['systolicBloodPressure', 'diastolicBloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation'],
  'injury-primary-survey': ['mechanismOfInjury', 'primarySurveyFindings', 'pupillaryResponse', 'fractureSites', 'pneumothoraxPresent'],
  'imaging-protocols': ['focusedAbdominalSonographyScore', 'cervicalSpineProtocol', 'abdominopelvicCTFindings', 'organInjuryScale'],
  resuscitation: ['fluidResuscitationVolume', 'bloodProductsAdministered', 'massiveTransfusionProtocol', 'intracranialPressure'],
  'labs-timing': ['hemoglobinLevel', 'lactateLevel', 'traumaBayArrivalTime'],
};
const SENTENCE_FIELDS = new Set(['mechanismOfInjury', 'primarySurveyFindings', 'pupillaryResponse', 'focusedAbdominalSonographyScore', 'cervicalSpineProtocol', 'abdominopelvicCTFindings', 'organInjuryScale']);
const NUMBER_FIELDS = new Set(['glasgowComaScale', 'injurySeverityScore', 'revisedTraumaScore', 'traumaAndInjurySeverityScore', 'systolicBloodPressure', 'diastolicBloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'fluidResuscitationVolume', 'intracranialPressure', 'hemoglobinLevel', 'lactateLevel']);
const HIDE_ZERO_FIELDS = new Set([...NUMBER_FIELDS]);
const BOOLEAN_FIELDS = new Set(['pneumothoraxPresent', 'massiveTransfusionProtocol']);
const ARRAY_FIELDS = new Set(['fractureSites', 'bloodProductsAdministered']);
const COMMA_ARRAY_FIELDS = new Set(['mechanismOfInjury', 'primarySurveyFindings', 'pupillaryResponse', 'focusedAbdominalSonographyScore', 'abdominopelvicCTFindings']);
const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0);
const formatDateTime = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); const d = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); const t = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }); return `${d}, ${t}`; } catch { return safeString(value); } };
const parseLabel = text => { const match = safeString(text).match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{0,60}?):\s+([\s\S]+)/); return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: safeString(text) }; };
const splitByComma = text => { const source = safeString(text); const out = []; let current = ''; let depth = 0; for (const ch of source) { if (ch === '(') { depth += 1; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { if (current.trim()) out.push(current.trim()); current = ''; } else current += ch; } if (current.trim()) out.push(current.trim()); return out.length ? out : [source]; };
const splitBySentence = text => { const source = safeString(text); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; }; for (let index = 0; index < source.length; index += 1) { const ch = source[index]; if (ch === '(') depth += 1; if (ch === ')') depth = Math.max(0, depth - 1); const next = source[index + 1] || ''; const word = current.trim().match(/([A-Za-z]+)$/)?.[1] || ''; const period = ch === '.' && depth === 0 && /\s/.test(next) && !['Mr','Mrs','Ms','Dr','St','Jr','Sr','Prof','Rev','Gen','Col','Sgt','vs','etc'].includes(word) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current); const semicolon = ch === ';' && depth === 0; if (period || semicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; } else current += ch; } push(); return out.length ? out : [source]; };
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(r => r?.trauma_flow_sheets ? (Array.isArray(r.trauma_flow_sheets) ? r.trauma_flow_sheets : [r.trauma_flow_sheets]) : r?.documentData ? (Array.isArray(r.documentData) ? r.documentData : r.documentData?.trauma_flow_sheets ? (Array.isArray(r.documentData.trauma_flow_sheets) ? r.documentData.trauma_flow_sheets : [r.documentData.trauma_flow_sheets]) : [r.documentData]) : [r]).filter(r => r && typeof r === 'object');

const TraumaFlowSheetsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn) => {
    const value = record[fn]; if (!hasVal(value) || (HIDE_ZERO_FIELDS.has(fn) && value === 0)) return [];
    const label = FIELD_LABELS[fn] || fn; let rows = []; let n = 1;
    if (fn === 'traumaBayArrivalTime') rows.push(<Text key={fn} style={styles.listItem}>1. {formatDateTime(value)}</Text>);
    else if (NUMBER_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {safeString(value)}</Text>);
    else if (BOOLEAN_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {value ? 'Yes' : 'No'}</Text>);
    else if (ARRAY_FIELDS.has(fn)) (Array.isArray(value) ? value : [value]).filter(hasVal).forEach((item, i) => rows.push(<Text key={i} style={styles.listItem}>{n++}. {safeString(item)}</Text>));
    else if (SENTENCE_FIELDS.has(fn)) splitBySentence(value).forEach((clause, ci) => { const parsed = parseLabel(clause); const source = parsed.isLabeled ? parsed.value : clause; const items = COMMA_ARRAY_FIELDS.has(fn) ? splitByComma(source) : [source]; const itemRows = items.map((item, ii) => <Text key={`${ci}-${ii}`} style={styles.listItem}>{n++}. {safeString(item)}</Text>); if (parsed.isLabeled) rows.push(<View key={`${ci}-g`} wrap={false}><Text style={styles.subLabel}>{parsed.label}</Text>{itemRows[0]}</View>, ...itemRows.slice(1)); else rows.push(...itemRows); });
    else rows.push(<Text key={fn} style={styles.listItem}>1. {safeString(value)}</Text>);
    if (rows.length <= 6) return [<View key={`${fn}-f`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{rows}</View>];
    const [first, ...rest] = rows; return [<View key={`${fn}-f`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first}</View>, ...rest];
  };
  const renderSection = (record, sid) => { let body = []; SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn)); }); if (!body.length) return null; body = body.map((el, i) => React.cloneElement(el, { key: `${sid}-${i}` })); const [first, ...rest] = body; return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>; };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Trauma Flow Sheet</Text>{records.length === 0 && <Text style={styles.noDataText}>No trauma flow sheet records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Trauma Flow Sheet ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}</Page></Document>;
};
export default TraumaFlowSheetsDocumentPDFTemplate;
