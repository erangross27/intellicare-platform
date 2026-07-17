import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  header: { marginBottom: 24, paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 8 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginBottom: 12 },
  section: { marginBottom: 14 },
  pageStartSection: { paddingTop: 40 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1pt solid #000000', paddingBottom: 4 },
  fieldBlock: { marginBottom: 8, paddingLeft: 8 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginBottom: 2, color: '#333333', borderBottom: '0.5pt solid #999999', paddingBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, marginBottom: 4 },
  listItem: { fontSize: 13, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  nestedLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 2 },
  emptyState: { fontSize: 14, textAlign: 'center', paddingTop: 24 },
});

const SECTION_FIELDS = {
  'Birth Information': ['birthDate', 'birthTime', 'assessor'],
  'APGAR Scores': ['apgar1Minute', 'apgar5Minutes', 'apgar10Minutes'],
  'Component Details': ['appearance', 'pulse', 'grimace', 'activity', 'respiration'],
  Interventions: ['interventions'],
  Recommendations: ['recommendations'],
};
const LABELS = { birthDate: 'Birth Date', birthTime: 'Birth Time', assessor: 'Assessor', apgar1Minute: '1 Minute Score', apgar5Minutes: '5 Minutes Score', apgar10Minutes: '10 Minutes Score', appearance: 'Appearance (Skin Color)', pulse: 'Pulse (Heart Rate)', grimace: 'Grimace (Reflex Irritability)', activity: 'Activity (Muscle Tone)', respiration: 'Respiration (Breathing)', interventions: 'Interventions', recommendations: 'Recommendations' };
const COMPONENT_FIELDS = new Set(['appearance', 'pulse', 'grimace', 'activity', 'respiration']);

const hasValue = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0);
const formatDate = value => { if (!value) return ''; try { const date = new Date(value.$date || value); return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const dateKey = value => { if (!value) return 'no-date'; try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return String(value); } };
const splitBySentence = text => String(text || '').replace(/\b(Dr|Mr|Mrs|Ms|Prof|Rev|Gen|Col|Sgt|Jr|Sr|vs|etc)\./gi, '$1<dot>').split(/[.;]\s+/).map(value => value.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim()).filter(Boolean);
const splitBySemicolon = text => { const source = String(text || ''); const values = []; let current = ''; let depth = 0; for (const char of source) { if (char === '(') depth++; if (char === ')') depth = Math.max(0, depth - 1); if (char === ';' && depth === 0) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char; } if (current.trim()) values.push(current.trim()); return values; };
const splitFirstColon = value => { const match = String(value || '').match(/^([^:]+):\s*([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(value || '').trim() }; };

const unwrap = data => {
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]).flatMap(item => {
    if (item?.apgar_scores) return Array.isArray(item.apgar_scores) ? item.apgar_scores : [item.apgar_scores];
    if (item?.data?.apgar_scores) return Array.isArray(item.data.apgar_scores) ? item.data.apgar_scores : [item.data.apgar_scores];
    if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
    if (item?.documentData?.apgar_scores) return Array.isArray(item.documentData.apgar_scores) ? item.documentData.apgar_scores : [item.documentData.apgar_scores];
    if (item?.documentData) return Array.isArray(item.documentData) ? item.documentData : [item.documentData];
    return [item];
  }).filter(item => item && typeof item === 'object');
};

const renderRecommendations = recommendations => {
  const groups = new Map();
  recommendations.forEach(item => { const key = dateKey(item?.date); if (!groups.has(key)) groups.set(key, { date: item?.date, items: [] }); groups.get(key).items.push(item?.recommendation || String(item || '')); });
  let number = 1;
  return [...groups.entries()].map(([key, group]) => <React.Fragment key={key}>{group.date && <Text style={styles.nestedLabel}>{formatDate(group.date)}</Text>}{group.items.flatMap(item => splitBySentence(item)).map(clause => <Text key={`${key}-${number}`} style={styles.listItem}>{number++}. {clause}</Text>)}</React.Fragment>);
};

const renderField = (field, value) => {
  if (!hasValue(value)) return null;
  const label = LABELS[field] || field;
  if (field === 'birthDate') return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{formatDate(value)}</Text></View>;
  if (field === 'recommendations') return <View key={field} style={styles.fieldBlock}><Text style={styles.fieldLabel}>{label}</Text>{renderRecommendations(value)}</View>;
  if (COMPONENT_FIELDS.has(field)) return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{splitBySemicolon(value).map((timepoint, index) => { const parsed = splitFirstColon(timepoint); return <React.Fragment key={`${field}-${index}`}>{parsed.label && <Text style={styles.nestedLabel}>{parsed.label}</Text>}<Text style={styles.listItem}>{index + 1}. {parsed.value}</Text></React.Fragment>; })}</View>;
  if (field === 'interventions' || field === 'assessor') { const clauses = splitBySentence(value); return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{clauses.map((clause, index) => <Text key={index} style={styles.listItem}>{index + 1}. {clause}</Text>)}</View>; }
  return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>;
};

const ApgarScoresDocumentPDFTemplate = ({ document: documentProp, data }) => {
  const records = unwrap(documentProp || data);
  return <Document><Page size="LETTER" style={styles.page}><View style={styles.header}><Text style={styles.documentTitle}>APGAR Scores</Text></View>{records.length === 0 ? <Text style={styles.emptyState}>No APGAR score records available</Text> : records.map((record, recordIndex) => <React.Fragment key={recordIndex}><View wrap={false}><Text style={styles.recordTitle}>{`APGAR Score ${recordIndex + 1}`}</Text></View>{Object.entries(SECTION_FIELDS).map(([title, fields]) => { const present = fields.filter(field => hasValue(record[field])); if (present.length === 0) return null; const startsPage = ['Component Details', 'Recommendations'].includes(title); return <View key={title} style={startsPage ? [styles.section, styles.pageStartSection] : styles.section} break={startsPage}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{renderField(present[0], record[present[0]])}</View>{present.slice(1).map(field => field === 'activity' ? <View key={field} break style={styles.pageStartSection}>{renderField(field, record[field])}</View> : renderField(field, record[field]))}</View>; })}</React.Fragment>)}</Page></Document>;
};

export default ApgarScoresDocumentPDFTemplate;
