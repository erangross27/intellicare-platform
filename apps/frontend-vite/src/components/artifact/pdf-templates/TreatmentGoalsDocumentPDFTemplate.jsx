/** Treatment Goals - canonical box-free PDF. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = { general: 'General Information', immediate: 'Immediate Goals', short: 'Short Term Goals', long: 'Long Term Goals', patient: 'Patient Goals', family: 'Family Goals', clinical: 'Clinical Notes', recommendations: 'Recommendations', results: 'Results' };
const FIELD_LABELS = { date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status', assessment: 'Assessment', plan: 'Plan', findings: 'Findings', notes: 'Notes' };
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const safeString = value => String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...');
const humanize = key => safeString(key).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => record?.treatment_goals ? (Array.isArray(record.treatment_goals) ? record.treatment_goals : [record.treatment_goals]) : record?.documentData ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.treatment_goals ? (Array.isArray(record.documentData.treatment_goals) ? record.documentData.treatment_goals : [record.documentData.treatment_goals]) : [record.documentData]) : [record]).filter(record => record && typeof record === 'object');

const splitNarrative = (text, splitCommas = false) => {
  const source = safeString(text); const clauses = []; let current = ''; let depth = 0;
  const push = () => { if (current.trim()) clauses.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if ('([{'.includes(char)) { depth += 1; current += char; continue; }
    if (')]}'.includes(char)) { depth = Math.max(0, depth - 1); current += char; continue; }
    if (depth === 0 && char === ';') { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; }
    if (depth === 0 && splitCommas && char === ',') { const right = source.slice(index + 1).trimStart(); const protectedComma = (/\d$/.test(current.trim()) && /^\d{3}\b/.test(right)) || /^(?:MD|DO|RN|BSN|NP|PA|PhD|PharmD|FACC|FACP|FACS|MPH|MSN)\b/i.test(right); if (!protectedComma) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; } }
    if (depth === 0 && char === '.') { const previous = current.trim().match(/([A-Za-z]+)$/)?.[1] || ''; const decimal = /\d$/.test(current) && /^\d/.test(source[index + 1] || ''); const abbreviation = ['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previous); if (!decimal && !abbreviation && (/\s/.test(source[index + 1] || '') || index === source.length - 1)) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; } }
    current += char;
  }
  push(); return clauses;
};

const flattenResults = (value, label = '', path = '') => {
  if (!value || typeof value !== 'object') return [];
  const rows = [];
  Object.entries(value).forEach(([key, entry]) => {
    if (!hasVal(entry)) return;
    const nextLabel = label ? `${label} - ${humanize(key)}` : humanize(key); const nextPath = path ? `${path}.${key}` : key;
    if (Array.isArray(entry)) entry.forEach((item, index) => { if (item && typeof item === 'object') rows.push(...flattenResults(item, `${nextLabel} ${index + 1}`, `${nextPath}.${index}`)); else if (hasVal(item)) rows.push({ label: `${nextLabel} ${index + 1}`, value: safeString(item), path: `${nextPath}.${index}` }); });
    else if (entry && typeof entry === 'object' && !entry.$date) rows.push(...flattenResults(entry, nextLabel, nextPath));
    else rows.push({ label: nextLabel, value: entry?.$date || /date$/i.test(nextPath) ? formatDate(entry?.$date || entry) : typeof entry === 'boolean' ? (entry ? 'Yes' : 'No') : safeString(entry), path: nextPath });
  });
  return rows;
};

const row = (value, key, number = 1) => <Text key={key} style={styles.listItem}>{number}. {safeString(value)}</Text>;
const fieldUnit = (label, values, key, showLabel = true) => {
  const valid = values.filter(hasVal); if (!valid.length) return [];
  const rows = valid.map((value, index) => row(value, `${key}-${index}`, index + 1));
  const [first, ...rest] = rows;
  return [<View key={`${key}-first`} wrap={false}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{first}</View>, ...rest];
};
const scalarField = (record, field, sectionId) => !hasVal(record[field]) ? [] : fieldUnit(FIELD_LABELS[field], [field === 'date' ? formatDate(record[field]) : record[field]], field, FIELD_LABELS[field].toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase());
const narrativeField = (record, field, sectionId) => !hasVal(record[field]) ? [] : fieldUnit(FIELD_LABELS[field], splitNarrative(record[field], field === 'notes'), field, FIELD_LABELS[field].toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase());
const plainArrayField = (record, field, sectionId) => fieldUnit(SECTION_TITLES[sectionId], Array.isArray(record[field]) ? record[field] : [], field, false);
const goalField = (record, field) => {
  const goals = Array.isArray(record[field]) ? record[field].filter(hasVal) : []; const units = [];
  goals.forEach((goal, index) => {
    if (typeof goal === 'string') units.push(...fieldUnit(`Goal ${index + 1}`, [goal], `${field}-${index}`));
    else {
      if (hasVal(goal.goal)) units.push(...fieldUnit(`Goal ${index + 1}`, [goal.goal], `${field}-${index}-goal`));
      if (hasVal(goal.timeframe)) units.push(...fieldUnit('Timeframe', [goal.timeframe], `${field}-${index}-timeframe`));
      if (hasVal(goal.measurable)) units.push(...fieldUnit('Measurable', [goal.measurable], `${field}-${index}-measurable`));
    }
  }); return units;
};
const recommendationField = record => {
  const items = Array.isArray(record.recommendations) ? record.recommendations.filter(hasVal) : []; const units = [];
  const groups = [];
  items.forEach((item, index) => { const dateKey = typeof item === 'string' ? 'no-date' : item?.date ? formatDate(item.date) : 'no-date'; const group = groups.find(candidate => candidate.key === dateKey); if (group) group.entries.push({ item, index }); else groups.push({ key: dateKey, date: dateKey === 'no-date' ? '' : dateKey, entries: [{ item, index }] }); });
  groups.forEach((group, groupIndex) => { if (group.date) units.push(...fieldUnit('Date', [group.date], `recommendations-${groupIndex}-date`)); units.push(...fieldUnit('Recommendation', group.entries.map(({ item }) => typeof item === 'string' ? item : item.recommendation), `recommendations-${groupIndex}`, false)); });
  return units;
};
const resultsField = record => flattenResults(record.results).flatMap((item, index) => fieldUnit(item.label, [item.value], `results-${index}`));

const sectionBody = (record, sectionId) => {
  if (sectionId === 'general') return ['date', 'type', 'provider', 'facility', 'status'].flatMap(field => scalarField(record, field, sectionId));
  if (sectionId === 'immediate') return goalField(record, 'immediateGoals');
  if (sectionId === 'short') return goalField(record, 'shortTermGoals');
  if (sectionId === 'long') return goalField(record, 'longTermGoals');
  if (sectionId === 'patient') return plainArrayField(record, 'patientGoals', sectionId);
  if (sectionId === 'family') return plainArrayField(record, 'familyGoals', sectionId);
  if (sectionId === 'clinical') return ['assessment', 'plan', 'findings', 'notes'].flatMap(field => narrativeField(record, field, sectionId));
  if (sectionId === 'recommendations') return recommendationField(record);
  if (sectionId === 'results') return resultsField(record);
  return [];
};

const TreatmentGoalsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const renderSection = (record, sectionId) => { const body = sectionBody(record, sectionId); if (!body.length) return null; const cohesive = (sectionId === 'results' && body.length <= 8) || (['immediate', 'short', 'long'].includes(sectionId) && body.length <= 9); if (cohesive) return <View key={sectionId} wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{body}</View>; const [first, ...rest] = body; return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>; };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Treatment Goals</Text>{!records.length && <Text style={styles.noDataText}>No treatment goals records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Treatment Goals ${index + 1}`}</Text>{Object.keys(SECTION_TITLES).map(sectionId => renderSection(record, sectionId))}</View>)}</Page></Document>;
};

export default TreatmentGoalsDocumentPDFTemplate;
