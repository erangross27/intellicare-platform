import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 14 },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  recordHeader: { marginBottom: 16 }, recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 11 }, sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginTop: 4, marginBottom: 8 }, fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 2, color: '#1d4ed8' },
  rowBlock: { marginBottom: 2 }, fieldValue: { fontSize: 14, lineHeight: 1.35 }, noData: { fontSize: 14, color: '#6b7280', marginTop: 16 },
});

const SECTIONS = [
  { title: 'Visit Information', fields: [['date', 'Visit Date', 'date'], ['provider', 'Provider'], ['facility', 'Facility'], ['childAge', 'Child Age'], ['dateOfBirth', 'Date of Birth', 'date'], ['gestationalAgeAtBirth', 'Gestational Age at Birth']] },
  { title: 'Growth Percentile Overview', fields: [['weightMeasurement', 'Weight (kg)', 'number'], ['weightPercentile', 'Weight Percentile', 'number'], ['heightMeasurement', 'Height (cm)', 'number'], ['heightPercentile', 'Height Percentile', 'number'], ['headCircumference', 'Head Circumference (cm)', 'number'], ['headCircumferencePercentile', 'Head Circumference Percentile', 'number'], ['bodyMassIndex', 'BMI', 'number'], ['bmiPercentile', 'BMI Percentile', 'number']] },
  { title: 'Vaccines Administered', fields: [['vaccinesAdministered', 'Vaccines Administered', 'array']] },
  { title: 'Vaccines Due', fields: [['vaccinesDue', 'Vaccines Due', 'array']] },
  { title: 'Developmental Milestones', fields: [['developmentalMilestones', 'Developmental Milestones', 'array']] },
  { title: 'Screenings', fields: [['visionScreeningResult', 'Vision Screening'], ['hearingScreeningResult', 'Hearing Screening'], ['hemoglobinLevel', 'Hemoglobin Level', 'number'], ['leadScreeningResult', 'Lead Screening']] },
  { title: 'Nutrition Counseling', fields: [['nutritionCounseling', 'Nutrition Counseling', 'nutrition']] },
  { title: 'Safety Guidance', fields: [['safetyGuidanceProvided', 'Safety Guidance', 'safety']] },
  { title: 'Parental Concerns', fields: [['parentalConcerns', 'Parental Concerns', 'array']] },
  { title: 'Next Visit', fields: [['nextVisitScheduled', 'Next Visit Scheduled']] },
];
const PAGE_GROUPS = [[0, 1], [2, 3], [4], [5, 6], [7, 8, 9]];
const ZERO_SENTINELS = new Set(['weightMeasurement', 'heightMeasurement', 'headCircumference', 'headCircumferencePercentile', 'bodyMassIndex', 'hemoglobinLevel']);
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal));
const shows = (field, value, type) => hasVal(value) && !(type === 'number' && ZERO_SENTINELS.has(field) && Number(value) === 0);
const formatDate = value => { if (!value) return ''; try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|(?<!\d)\.(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }];
  if (type === 'number') return [{ value: String(value) }];
  if (type === 'nutrition') return splitSentence(value).flatMap(splitComma).filter(Boolean).map(row => ({ value: row }));
  if (type === 'array' || type === 'safety') return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = parseLabel(item), clauses = type === 'safety' ? splitComma(parsed.content) : [parsed.content]; return clauses.map(row => ({ subtitle: parsed.subtitle, value: row })); });
  return [{ value: String(value) }];
};
const renderField = (fieldConfig, value, key, sectionTitle) => { const [, label] = fieldConfig, rows = rowsFor(fieldConfig, value); let previous = ''; return <View key={key} style={styles.fieldBox}>{label !== sectionTitle && <Text style={styles.fieldLabel}>{label}</Text>}{rows.map((row, index) => { const newSubtitle = row.subtitle && row.subtitle !== previous; previous = row.subtitle || ''; return <View key={`${key}-${index}`} style={styles.rowBlock}>{newSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>; })}</View>; };

const WellChildSummaryDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => { const source = documentProp ?? dataProp ?? templateData; if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.well_child_summary) return Array.isArray(row.well_child_summary) ? row.well_child_summary : [row.well_child_summary]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.well_child_summary) return Array.isArray(nested.well_child_summary) ? nested.well_child_summary : [nested.well_child_summary]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); }, [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Summary</Text></View><Text style={styles.noData}>No summary data available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => { const visibleSections = indexes.map(index => ({ section: SECTIONS[index], index })).map(item => ({ ...item, fields: item.section.fields.filter(([field, , type]) => shows(field, record[field], type)) })).filter(item => item.fields.length); if (!visibleSections.length) return null; return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>{pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Well Child Summary</Text></View>}{pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Well Child Summary {recordIndex + 1}</Text></View>}{visibleSections.map(({ section, index, fields }) => <View key={`${index}-${section.title}`} style={styles.section} wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{fields.map((fieldConfig, fieldIndex) => renderField(fieldConfig, record[fieldConfig[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>; }))}</Document>;
};

export default WellChildSummaryDocumentPDFTemplate;
