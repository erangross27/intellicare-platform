/** Trauma Assessment — canonical box-free PDF, collection trauma_assessment. */
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
  'triage-mechanism': 'Triage & Mechanism',
  'trauma-scores': 'Trauma Scores',
  'primary-survey': 'Primary Survey (ABCDE)',
  injuries: 'Injuries',
  'interventions-protocols': 'Interventions & Protocols',
  'timing-disposition': 'Timing & Disposition',
};
const FIELD_LABELS = {
  date: 'Date', traumaMechanism: 'Trauma Mechanism', triageCategory: 'Triage Category', traumaTeamActivationLevel: 'Trauma Team Activation Level',
  glasgowComaScore: 'Glasgow Coma Score', revisedTraumaScore: 'Revised Trauma Score (RTS)', injurySeverityScore: 'Injury Severity Score (ISS)',
  primarySurveyAirway: 'Airway', primarySurveyBreathing: 'Breathing', primarySurveyCirculation: 'Circulation', primarySurveyDisability: 'Disability', primarySurveyExposure: 'Exposure',
  injuredBodyRegions: 'Injured Body Regions', hemorrhageClass: 'Hemorrhage Class', fastExamResult: 'FAST Exam Result', penetratingInjuryLocation: 'Penetrating Injury Location', burnTotalBodySurfaceArea: 'Burn TBSA (%)', compartmentSyndromeRisk: 'Compartment Syndrome Risk',
  cervicalSpineImmobilization: 'Cervical Spine Immobilization', pelvicBinderApplied: 'Pelvic Binder Applied', massiveTransfusionProtocol: 'Massive Transfusion Protocol', emergentInterventionsPerformed: 'Emergent Interventions Performed', consultingServicesActivated: 'Consulting Services Activated',
  traumaBayArrivalTime: 'Trauma Bay Arrival Time', timeToCtScan: 'Time to CT Scan (minutes)', traumaDisposition: 'Trauma Disposition',
};
const SECTION_FIELDS = {
  'triage-mechanism': ['date', 'traumaMechanism', 'triageCategory', 'traumaTeamActivationLevel'],
  'trauma-scores': ['glasgowComaScore', 'revisedTraumaScore', 'injurySeverityScore'],
  'primary-survey': ['primarySurveyAirway', 'primarySurveyBreathing', 'primarySurveyCirculation', 'primarySurveyDisability', 'primarySurveyExposure'],
  injuries: ['injuredBodyRegions', 'hemorrhageClass', 'fastExamResult', 'penetratingInjuryLocation', 'burnTotalBodySurfaceArea', 'compartmentSyndromeRisk'],
  'interventions-protocols': ['cervicalSpineImmobilization', 'pelvicBinderApplied', 'massiveTransfusionProtocol', 'emergentInterventionsPerformed', 'consultingServicesActivated'],
  'timing-disposition': ['traumaBayArrivalTime', 'timeToCtScan', 'traumaDisposition'],
};
const SENTENCE_FIELDS = new Set(['traumaMechanism', 'primarySurveyAirway', 'primarySurveyBreathing', 'primarySurveyCirculation', 'primarySurveyDisability', 'primarySurveyExposure', 'fastExamResult', 'compartmentSyndromeRisk']);
const NUMBER_FIELDS = new Set(['glasgowComaScore', 'revisedTraumaScore', 'injurySeverityScore', 'burnTotalBodySurfaceArea', 'timeToCtScan']);
const BOOLEAN_FIELDS = new Set(['cervicalSpineImmobilization', 'pelvicBinderApplied', 'massiveTransfusionProtocol']);
const ARRAY_FIELDS = new Set(['injuredBodyRegions', 'penetratingInjuryLocation', 'emergentInterventionsPerformed', 'consultingServicesActivated']);
const DATE_FIELDS = new Set(['date']);
const DATETIME_FIELDS = new Set(['traumaBayArrivalTime']);
const HIDE_ZERO_FIELDS = new Set(['glasgowComaScore', 'revisedTraumaScore', 'burnTotalBodySurfaceArea', 'timeToCtScan']);
const COMMA_ARRAY_FIELDS = new Set(['traumaMechanism', 'primarySurveyAirway', 'primarySurveyBreathing', 'fastExamResult']);

const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0);
const formatDate = value => { try { const date = new Date(value?.$date || value); return isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(value); } };
const formatDateTime = value => { try { const date = new Date(value?.$date || value); return isNaN(date.getTime()) ? safeString(value) : `${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`; } catch { return safeString(value); } };
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
const splitBySentence = text => {
  const source = safeString(text); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]; if (character === '(') depth += 1; if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || ''; const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && depth === 0 && /\s/.test(next) && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; } else current += character;
  }
  push(); return out.length ? out : [source];
};
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => {
  if (record?.trauma_assessment) return Array.isArray(record.trauma_assessment) ? record.trauma_assessment : [record.trauma_assessment];
  if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.trauma_assessment) return Array.isArray(inner.trauma_assessment) ? inner.trauma_assessment : [inner.trauma_assessment]; return [inner]; }
  return [record];
}).filter(record => record && typeof record === 'object');

const TraumaAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn) => {
    const value = record[fn]; if (!hasVal(value) || (HIDE_ZERO_FIELDS.has(fn) && value === 0)) return [];
    const label = FIELD_LABELS[fn] || fn; let rows = []; let rowNumber = 1;
    if (DATE_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {formatDate(value)}</Text>);
    else if (DATETIME_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {formatDateTime(value)}</Text>);
    else if (NUMBER_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {safeString(value)}</Text>);
    else if (BOOLEAN_FIELDS.has(fn)) rows.push(<Text key={fn} style={styles.listItem}>1. {value ? 'Yes' : 'No'}</Text>);
    else if (ARRAY_FIELDS.has(fn)) (Array.isArray(value) ? value : [value]).filter(hasVal).forEach((item, index) => rows.push(<Text key={index} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>));
    else if (SENTENCE_FIELDS.has(fn)) splitBySentence(value).forEach((clause, clauseIndex) => {
      const parsed = parseLabel(clause); const source = parsed.isLabeled ? parsed.value : clause;
      const items = COMMA_ARRAY_FIELDS.has(fn) ? splitByComma(source) : [source];
      const itemRows = items.map((item, itemIndex) => <Text key={`${clauseIndex}-${itemIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>);
      if (parsed.isLabeled) rows.push(<View key={`${clauseIndex}-group`} wrap={false}><Text style={styles.subLabel}>{safeString(parsed.label)}</Text>{itemRows[0]}</View>, ...itemRows.slice(1));
      else rows.push(...itemRows);
    });
    else rows.push(<Text key={fn} style={styles.listItem}>1. {safeString(value)}</Text>);
    if (rows.length <= 6) return [<View key={`${fn}-field`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{rows}</View>];
    if (rows.length) { const [first, ...rest] = rows; rows = [<View key={`${fn}-field`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>, ...rest]; }
    return rows;
  };
  const renderSection = (record, sid) => {
    let body = []; SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn)); }); if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` })); const [first, ...rest] = body;
    return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>;
  };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Trauma Assessment</Text>{records.length === 0 && <Text style={styles.noDataText}>No trauma assessment records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Trauma Assessment ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}</Page></Document>;
};

export default TraumaAssessmentDocumentPDFTemplate;
