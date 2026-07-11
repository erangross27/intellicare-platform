/**
 * RehabilitationGoalsPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — rehabilitation goals
 * Collection: rehabilitation_goals
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

/* ======= FIELD RENDER ======= */
const FieldBox = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const DateFieldBox = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

const ArrayFieldBox = ({ label, items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.filter(Boolean).map((item, i) => (
        <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>
      ))}
    </View>
  );
};

/* ======= SECTIONS ======= */
const SECTIONS = [
  {
    id: 'goal-overview', title: 'Goal Overview',
    fields: [
      { key: 'goalDescription', label: 'Goal Description' },
      { key: 'functionalCategory', label: 'Functional Category' },
      { key: 'priorityLevel', label: 'Priority Level' },
      { key: 'achievementStatus', label: 'Achievement Status' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
  },
  {
    id: 'timeline', title: 'Timeline & Schedule',
    fields: [
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'targetDate', label: 'Target Date', type: 'date' },
      { key: 'duration', label: 'Duration' },
      { key: 'frequency', label: 'Frequency' },
    ],
  },
  {
    id: 'performance', title: 'Performance & Outcomes',
    fields: [
      { key: 'baselinePerformance', label: 'Baseline Performance' },
      { key: 'currentPerformance', label: 'Current Performance' },
      { key: 'targetPerformance', label: 'Target Performance' },
      { key: 'measurableOutcome', label: 'Measurable Outcome' },
      { key: 'percentComplete', label: 'Percent Complete' },
    ],
  },
  {
    id: 'therapy', title: 'Therapy & Interventions',
    fields: [
      { key: 'therapyDiscipline', label: 'Therapy Discipline' },
      { key: 'responsibleTherapist', label: 'Responsible Therapist' },
      { key: 'interventionApproach', label: 'Intervention Approach', type: 'array' },
    ],
  },
  {
    id: 'barriers-facilitators', title: 'Barriers & Facilitators',
    fields: [
      { key: 'barriers', label: 'Barriers', type: 'array' },
      { key: 'facilitators', label: 'Facilitators', type: 'array' },
      { key: 'equipmentRequired', label: 'Equipment Required', type: 'array' },
    ],
  },
  {
    id: 'patient-involvement', title: 'Patient Involvement',
    fields: [
      { key: 'patientAgreement', label: 'Patient Agreement' },
      { key: 'caregiverInvolvement', label: 'Caregiver Involvement' },
    ],
  },
  {
    id: 'discharge', title: 'Discharge Planning',
    fields: [
      { key: 'dischargeCriteria', label: 'Discharge Criteria' },
      { key: 'anticipatedDischargeDisposition', label: 'Anticipated Discharge Disposition' },
      { key: 'outcomeScale', label: 'Outcome Scale' },
      { key: 'modificationReason', label: 'Modification Reason' },
    ],
  },
];

/* ======= MAIN COMPONENT ======= */
const RehabilitationGoalsPDFTemplate = ({ document: docProp, data }) => {
  const raw = docProp || data;
  if (!raw) return (<Document><Page size="LETTER" style={styles.page}><Text style={styles.noDataText}>No rehabilitation goals data available</Text></Page></Document>);

  const records = Array.isArray(raw) ? raw : [raw];
  if (records.length === 0) return (<Document><Page size="LETTER" style={styles.page}><Text style={styles.noDataText}>No rehabilitation goals data available</Text></Page></Document>);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Rehabilitation Goals</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{safeString(record.goalDescription) || `Rehabilitation Goal ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(section => {
              const hasAny = section.fields.some(f => hasVal(record[f.key]));
              if (!hasAny) return null;
              return (
                <View key={section.id} style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.fields.map(f => {
                    if (f.type === 'date') return <DateFieldBox key={f.key} label={f.label} value={record[f.key]} />;
                    if (f.type === 'array') return <ArrayFieldBox key={f.key} label={f.label} items={record[f.key]} />;
                    return <FieldBox key={f.key} label={f.label} value={record[f.key]} />;
                  })}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RehabilitationGoalsPDFTemplate;
