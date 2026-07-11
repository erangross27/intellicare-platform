/**
 * ChildrenSpecificRiskPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1);
 * per-FIELD gates with the section title inside the first field's unit + leaf glue (anti-orphan, 6a2d6af6).
 * Collection: children_specific_risk
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const FL = {
  ageAtAssessment: 'Age at Assessment', gestationalAgeAtBirth: 'Gestational Age at Birth', birthWeightGrams: 'Birth Weight (g)',
  currentWeightPercentile: 'Weight Percentile', currentHeightPercentile: 'Height Percentile', bmiPercentile: 'BMI Percentile', headCircumferencePercentile: 'Head Circumference Percentile',
  developmentalDelayRisk: 'Developmental Delay Risk', autismScreeningScore: 'Autism Screening Score', vaccineDelayedStatus: 'Vaccine Delayed',
  leadLevelMcgDl: 'Lead Level (mcg/dL)', ironDeficiencyAnemia: 'Iron Deficiency Anemia', asthmaControlTest: 'Asthma Control Test', epipenRequired: 'EpiPen Required', seizureDisorderType: 'Seizure Disorder Type', congenitalHeartDefect: 'Congenital Heart Defect',
  schoolAbsenteeismRate: 'School Absenteeism Rate', socialDeterminantsRisk: 'Social Determinants Risk', mentalHealthScreening: 'Mental Health Screening', substanceUseRisk: 'Substance Use Risk',
};

/* per-FIELD boolean gates; the section title rides inside the FIRST field's View (anti-orphan);
   every label + "1. value" leaf is its own wrap={false} glue unit. */
const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section}>
      {visible.map((f, i) => (
        <View key={f} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.fieldLabel}>{FL[f] || f}</Text>
            <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

const ChildrenSpecificRiskPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.children_specific_risk) return Array.isArray(r.children_specific_risk) ? r.children_specific_risk : [r.children_specific_risk];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.children_specific_risk) return Array.isArray(dd.children_specific_risk) ? dd.children_specific_risk : [dd.children_specific_risk]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Children Specific Risk</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Children Specific Risk</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Children Specific Risk ${idx + 1}`}</Text>
            </View>
            {renderFieldSection('Growth Parameters', ['ageAtAssessment', 'gestationalAgeAtBirth', 'birthWeightGrams', 'currentWeightPercentile', 'currentHeightPercentile', 'bmiPercentile', 'headCircumferencePercentile'], record)}
            {renderFieldSection('Developmental Screening', ['developmentalDelayRisk', 'autismScreeningScore', 'vaccineDelayedStatus'], record)}
            {renderFieldSection('Medical Conditions', ['leadLevelMcgDl', 'ironDeficiencyAnemia', 'asthmaControlTest', 'epipenRequired', 'seizureDisorderType', 'congenitalHeartDefect'], record)}
            {renderArraySection('Allergy Triggers', record.allergyTriggers)}
            {renderArraySection('Chronic Medications', record.chronicMedicationList)}
            {renderFieldSection('Social & Behavioral', ['schoolAbsenteeismRate', 'socialDeterminantsRisk', 'mentalHealthScreening', 'substanceUseRisk'], record)}
            {renderArraySection('Family History (Genetic)', record.familyHistoryGenetic)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChildrenSpecificRiskPDFTemplate;
