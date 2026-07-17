import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 14 },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  recordHeader: { marginBottom: 16 }, recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  sectionHeader: { marginTop: 11 }, sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginTop: 4, marginBottom: 5 }, fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 2, color: '#1d4ed8' },
  rowBlock: { marginBottom: 3 }, fieldValue: { fontSize: 14, lineHeight: 1.35 }, noData: { fontSize: 14, color: '#6b7280', marginTop: 16 },
});

const SECTIONS = [
  { title: 'Visit & Vitals', fields: [['date', 'Visit Date', 'date'], ['visitType', 'Visit Type'], ['ageAtVisit', 'Age at Visit', 'number'], ['heightInCm', 'Height (cm)', 'number'], ['weightInKg', 'Weight (kg)', 'number'], ['bodyMassIndex', 'BMI', 'number'], ['bloodPressureSystolic', 'BP Systolic', 'number'], ['bloodPressureDiastolic', 'BP Diastolic', 'number'], ['vitalSignsDateTime', 'Vital Signs Date/Time', 'date']] },
  { title: 'Immunizations & Screenings', fields: [['immunizationsAdministered', 'Immunizations Administered', 'array'], ['immunizationsDeclined', 'Immunizations Declined', 'array'], ['screeningsPerformed', 'Screenings Performed', 'array'], ['developmentalMilestones', 'Developmental Milestones', 'array']] },
  { title: 'Health Maintenance', fields: [['healthMaintenanceItemsDue', 'Health Maintenance Items Due', 'array'], ['healthMaintenanceItemsCompleted', 'Health Maintenance Items Completed', 'array'], ['chronicConditionsReviewed', 'Chronic Conditions Reviewed', 'array'], ['currentMedicationsList', 'Current Medications List', 'array'], ['medicationReconciliationCompleted', 'Medication Reconciliation Completed', 'boolean']] },
  { title: 'History & Directives', fields: [['familyHistoryUpdated', 'Family History Updated', 'boolean'], ['socialHistoryUpdated', 'Social History Updated', 'boolean'], ['advanceDirectivesDiscussed', 'Advance Directives Discussed', 'boolean'], ['functionalStatusAssessment', 'Functional Status Assessment', 'functional']] },
  { title: 'Screening Scores & Plan', fields: [['fallRiskScore', 'Fall Risk Score', 'number'], ['depressionScreeningScore', 'Depression Screening Score', 'number'], ['laboratoriesOrdered', 'Laboratories Ordered', 'array'], ['counselingProvided', 'Counseling Provided', 'counseling']] },
];
const MEANINGFUL_ZERO_FIELDS = new Set(['fallRiskScore', 'depressionScreeningScore']);
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal));
const shows = (field, value, type) => hasVal(value) && !(type === 'number' && Number(value) === 0 && !MEANINGFUL_ZERO_FIELDS.has(field));
const coerceBool = value => { if (typeof value === 'boolean') return value; if (value === null || value === undefined || value === '') return null; if (typeof value === 'string') return !['false', 'no', '0'].includes(value.trim().toLowerCase()); return Boolean(value); };
const formatDate = value => { if (!value) return ''; try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|(?<!\d)\.(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }];
  if (type === 'boolean') return [{ value: coerceBool(value) ? 'Yes' : 'No' }];
  if (type === 'number') return [{ value: String(value) }];
  if (type === 'functional') return splitSentence(value).flatMap(sentence => { const parsed = parseLabel(sentence); return splitComma(parsed.content).map(row => ({ subtitle: parsed.subtitle, value: row })); });
  if (type === 'array' || type === 'counseling') return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = parseLabel(item), clauses = type === 'counseling' ? splitComma(parsed.content) : [parsed.content]; return clauses.map(row => ({ subtitle: parsed.subtitle, value: row })); });
  return [{ value: String(value) }];
};
const renderField = (fieldConfig, value, key) => {
  const [, label] = fieldConfig, rows = rowsFor(fieldConfig, value); if (!rows.length) return null;
  const first = rows[0]; const rest = rows.slice(1); let priorSubtitle = first.subtitle || '';
  return <React.Fragment key={key}><View style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first.subtitle && <Text style={styles.nestedSubtitle}>{first.subtitle}</Text>}<Text style={styles.fieldValue}>1. {first.value}</Text></View>{rest.map((row, index) => { const showSubtitle = row.subtitle && row.subtitle !== priorSubtitle; priorSubtitle = row.subtitle || ''; return <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{showSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 2}. {row.value}</Text></View>; })}</React.Fragment>;
};

const WellnessVisitDocumentationDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => { const source = documentProp ?? dataProp ?? templateData; if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.wellness_visit_documentation) return Array.isArray(row.wellness_visit_documentation) ? row.wellness_visit_documentation : [row.wellness_visit_documentation]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.wellness_visit_documentation) return Array.isArray(nested.wellness_visit_documentation) ? nested.wellness_visit_documentation : [nested.wellness_visit_documentation]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); }, [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Wellness Visit Documentation</Text></View><Text style={styles.noData}>No wellness visit documentation available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => SECTIONS.map((section, sectionIndex) => { const fields = section.fields.filter(([field, , type]) => shows(field, record[field], type)); if (!fields.length) return null; return <Page key={`${recordIndex}-${sectionIndex}`} size="LETTER" style={styles.page}>{sectionIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Wellness Visit Documentation</Text></View>}{sectionIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Wellness Visit Documentation {recordIndex + 1}</Text></View>}<View style={styles.sectionHeader} wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>{fields.map((fieldConfig, fieldIndex) => renderField(fieldConfig, record[fieldConfig[0]], `${sectionIndex}-${fieldIndex}`))}</Page>; }))}</Document>;
};

export default WellnessVisitDocumentationDocumentPDFTemplate;
