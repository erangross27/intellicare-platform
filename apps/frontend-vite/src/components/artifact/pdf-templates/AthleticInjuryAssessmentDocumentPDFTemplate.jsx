import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';


const COLLECTION = 'athletic_injury_assessment';
const COMMA_SPLIT_FIELDS = ['sportActivity', 'rangeOfMotionLimitations', 'strengthDeficit', 'weightBearingStatus'];
const DISPLAY_FIELDS = ['date', 'sportActivity', 'competitionLevel', 'injuryMechanism', 'anatomicLocation', 'injuryClassification', 'severityGrade', 'timeOfInjury', 'immediateSymptoms', 'abilityToContinuePlay', 'sidelineInterventions', 'concussionScreenPerformed', 'swellingPresent', 'ecchymosisPresent', 'rangeOfMotionLimitations', 'strengthDeficit', 'neurovascularStatus', 'weightBearingStatus', 'specialTestsPerformed', 'specialTestsPositive', 'imagingOrdered', 'rehabilitationPhase', 'functionalLimitations', 'priorInjurySameSite', 'returnToPlayCriteria', 'estimatedRecoveryTime'];

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldRow: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.32 },
  listItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  groupedListItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 20 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#555555' },
});

const hasValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};
const safeString = value => String(value ?? '').replace(/≥/g, '>=').replace(/≤/g, '<=');
const displayScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return safeString(raw);
  try {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? safeString(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch { return safeString(raw); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitNarrative = (field, text) => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const output = [];
  let current = '';
  let depth = 0;
  const push = () => { const value = current.trim(); if (value) output.push(value); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    const sentenceBreak = depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (depth === 0 && char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = current.trim();
      const after = source.slice(index + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (sentenceBreak || commaBreak) { push(); continue; }
    current += char;
  }
  push();
  return output;
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const records = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_FIELDS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => DISPLAY_FIELDS.some(field => hasValue(record[field])));
};

const fieldRow = (label, value, key) => <View style={styles.fieldRow} key={key || label} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text><Text style={styles.fieldValue}>{safeString(displayScalar(value))}</Text></View>;
const valueRow = (value, key, grouped = false) => <Text style={grouped ? styles.groupedListItem : styles.listItem} key={key}>{safeString(value)}</Text>;
const arrayRows = (label, values, key) => {
  const items = (Array.isArray(values) ? values : []).filter(hasValue);
  if (!items.length) return [];
  if (items.length <= 8) return [<View style={styles.fieldRow} key={`${key}-group`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{items.map((item, index) => valueRow(`${index + 1}. ${item}`, `${key}-${index}`))}</View>];
  return [<View style={styles.fieldRow} key={`${key}-first`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{valueRow(`1. ${items[0]}`, `${key}-0`)}</View>, ...items.slice(1).map((item, index) => valueRow(`${index + 2}. ${item}`, `${key}-${index + 1}`))];
};
const narrativeRows = (field, value, fallbackLabel) => {
  const groups = [];
  let current = null;
  splitNarrative(field, value).forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.labeled) { current = { subtitle: parsed.label, items: [parsed.value] }; groups.push(current); }
    else if (current?.subtitle) current.items.push(parsed.value);
    else { if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); } current.items.push(parsed.value); }
  });
  return groups.map((group, groupIndex) => <View style={styles.fieldRow} key={`${field}-${groupIndex}`} wrap={false}>{fallbackLabel && groupIndex === 0 && <Text style={styles.fieldLabel}>{safeString(fallbackLabel)}</Text>}{group.subtitle && <Text style={styles.fieldLabel}>{safeString(group.subtitle)}</Text>}{group.items.map((item, itemIndex) => valueRow(`${itemIndex + 1}. ${item}`, itemIndex, !!(group.subtitle || fallbackLabel)))}</View>);
};
const renderSection = (title, rows, key) => {
  const visible = rows.flat().filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};

const AthleticInjuryAssessmentDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Athletic Injury Assessment</Text><Text style={styles.noData}>No athletic injury assessment data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Athletic Injury Assessment</Text>{records.map((record, index) => {
    const recordRows = [];
    if (hasValue(record.date)) recordRows.push(fieldRow('Date', formatDate(record.date), 'date'));
    if (hasValue(record.sportActivity)) recordRows.push(...narrativeRows('sportActivity', record.sportActivity, 'Sport / Activity'));
    if (hasValue(record.competitionLevel)) recordRows.push(fieldRow('Competition Level', record.competitionLevel, 'competitionLevel'));
    const injuryRows = [];
    if (hasValue(record.injuryMechanism)) injuryRows.push(...narrativeRows('injuryMechanism', record.injuryMechanism, 'Injury Mechanism'));
    if (hasValue(record.anatomicLocation)) injuryRows.push(fieldRow('Anatomic Location', record.anatomicLocation, 'anatomicLocation'));
    if (hasValue(record.injuryClassification)) injuryRows.push(fieldRow('Injury Classification', record.injuryClassification, 'injuryClassification'));
    if (hasValue(record.severityGrade)) injuryRows.push(fieldRow('Severity Grade', record.severityGrade, 'severityGrade'));
    if (hasValue(record.timeOfInjury)) injuryRows.push(fieldRow('Time of Injury', formatDate(record.timeOfInjury), 'timeOfInjury'));
    const immediateRows = [
      ...arrayRows('Immediate Symptoms', record.immediateSymptoms, 'immediateSymptoms'),
      hasValue(record.abilityToContinuePlay) ? fieldRow('Ability to Continue Play', record.abilityToContinuePlay, 'abilityToContinuePlay') : null,
      ...arrayRows('Sideline Interventions', record.sidelineInterventions, 'sidelineInterventions'),
      hasValue(record.concussionScreenPerformed) ? fieldRow('Concussion Screen Performed', record.concussionScreenPerformed, 'concussionScreenPerformed') : null,
    ];
    const physicalRows = [];
    if (hasValue(record.swellingPresent)) physicalRows.push(fieldRow('Swelling Present', record.swellingPresent, 'swellingPresent'));
    if (hasValue(record.ecchymosisPresent)) physicalRows.push(fieldRow('Ecchymosis Present', record.ecchymosisPresent, 'ecchymosisPresent'));
    ['rangeOfMotionLimitations', 'strengthDeficit', 'neurovascularStatus', 'weightBearingStatus'].forEach(field => {
      if (hasValue(record[field])) physicalRows.push(...narrativeRows(field, record[field], { rangeOfMotionLimitations: 'Range of Motion Limitations', strengthDeficit: 'Strength Deficit', neurovascularStatus: 'Neurovascular Status', weightBearingStatus: 'Weight Bearing Status' }[field]));
    });
    const testRows = [...arrayRows('Special Tests Performed', record.specialTestsPerformed, 'specialTestsPerformed'), ...arrayRows('Special Tests Positive', record.specialTestsPositive, 'specialTestsPositive')];
    const rehabRows = [...arrayRows('Imaging Ordered', record.imagingOrdered, 'imagingOrdered')];
    if (hasValue(record.rehabilitationPhase)) rehabRows.push(...narrativeRows('rehabilitationPhase', record.rehabilitationPhase, 'Rehabilitation Phase'));
    rehabRows.push(...arrayRows('Functional Limitations', record.functionalLimitations, 'functionalLimitations'));
    if (hasValue(record.priorInjurySameSite)) rehabRows.push(fieldRow('Prior Injury Same Site', record.priorInjurySameSite, 'priorInjurySameSite'));
    const returnRows = [...arrayRows('Return to Play Criteria', record.returnToPlayCriteria, 'returnToPlayCriteria')];
    if (hasValue(record.estimatedRecoveryTime)) returnRows.push(fieldRow('Estimated Recovery Time', record.estimatedRecoveryTime, 'estimatedRecoveryTime'));
    return <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Athletic Injury Assessment {index + 1}</Text></View>{renderSection('Record Information', recordRows, 'recordInfo')}{renderSection('Injury Details', injuryRows, 'injuryDetails')}{renderSection('Immediate Response', immediateRows, 'immediateResponse')}{renderSection('Physical Examination', physicalRows, 'physicalExam')}{renderSection('Special Tests', testRows, 'specialTests')}{renderSection('Imaging & Rehabilitation', rehabRows, 'imagingRehab')}{renderSection('Return to Play', returnRows, 'returnToPlay')}</React.Fragment>;
  })}</Page></Document>;
};

export default AthleticInjuryAssessmentDocumentPDFTemplate;
