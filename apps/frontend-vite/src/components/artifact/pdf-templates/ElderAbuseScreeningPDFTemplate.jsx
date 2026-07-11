import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ================================================================
   Elder Abuse Screening PDF Template
   Helvetica font, A4 page, fieldBox layout
   ================================================================ */

const OVERVIEW_FIELDS = [
  { key: 'screeningToolUsed', label: 'Screening Tool Used' },
  { key: 'screeningIndicator', label: 'Screening Indicator' },
  { key: 'screeningScore', label: 'Screening Score' },
  { key: 'cognitiveStatusAtScreening', label: 'Cognitive Status at Screening' },
  { key: 'functionalDependencyLevel', label: 'Functional Dependency Level' },
  { key: 'allegedPerpetratorRelationship', label: 'Alleged Perpetrator Relationship' },
];

const OBSERVATION_FIELDS = [
  { key: 'selfNeglectPresent', label: 'Self-Neglect Present' },
  { key: 'unexplainedInjuryDescription', label: 'Unexplained Injury Description' },
  { key: 'injuryPatternSuspicious', label: 'Injury Pattern Suspicious' },
  { key: 'patientFearfulOfCaregiver', label: 'Patient Fearful of Caregiver' },
  { key: 'socialIsolationPresent', label: 'Social Isolation Present' },
  { key: 'medicationHoardingOrWithholding', label: 'Medication Hoarding or Withholding' },
];

const REPORTING_FIELDS = [
  { key: 'mandatoryReportFiled', label: 'Mandatory Report Filed' },
  { key: 'reportingAgencyName', label: 'Reporting Agency Name' },
  { key: 'safetyPlanInitiated', label: 'Safety Plan Initiated' },
];

const ARRAY_SECTIONS = [
  { key: 'physicalAbuseIndicators', title: 'Physical Abuse Indicators' },
  { key: 'emotionalAbuseIndicators', title: 'Emotional Abuse Indicators' },
  { key: 'sexualAbuseIndicators', title: 'Sexual Abuse Indicators' },
  { key: 'financialExploitationIndicators', title: 'Financial Exploitation Indicators' },
  { key: 'neglectIndicators', title: 'Neglect Indicators' },
  { key: 'environmentalHazardsNoted', title: 'Environmental Hazards' },
  { key: 'caregiverBehaviorConcerns', title: 'Caregiver Behavior Concerns' },
  { key: 'perpetratorRiskFactors', title: 'Perpetrator Risk Factors' },
  { key: 'referralsMade', title: 'Referrals Made' },
];

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  dateText: { fontSize: 10, color: '#666666', marginBottom: 12 },
  section: { marginBottom: 10 },
  fieldBox: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6', padding: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#555555', marginBottom: 2, textTransform: 'uppercase' },
  fieldValue: { fontSize: 12, marginBottom: 6 },
  listItem: { fontSize: 12, marginBottom: 3, paddingLeft: 8 },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return false;
};

const ElderAbuseScreeningPDFTemplate = ({ records = [] }) => {
  if (!records.length) return null;

  return (
    <Document>
      {records.map((record, idx) => {
        const visibleOverview = OVERVIEW_FIELDS.filter(f => hasValue(record[f.key]));
        const visibleObservations = OBSERVATION_FIELDS.filter(f => hasValue(record[f.key]));
        const visibleReporting = REPORTING_FIELDS.filter(f => hasValue(record[f.key]));

        return (
          <Page key={idx} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Elder Abuse Screening {idx + 1}</Text>
              {record.date && <Text style={styles.dateText}>{formatDate(record.date)}</Text>}
            </View>

            {/* Screening Overview — title INSIDE fieldBox (Rule #45) */}
            {visibleOverview.length > 0 && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={visibleOverview.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Screening Overview</Text>
                  {visibleOverview.map(f => (
                    <View key={f.key}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <Text style={styles.fieldValue}>{safeString(record[f.key])}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Clinical Observations */}
            {visibleObservations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={visibleObservations.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Clinical Observations</Text>
                  {visibleObservations.map(f => (
                    <View key={f.key}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <Text style={styles.fieldValue}>{safeString(record[f.key])}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Array Sections */}
            {ARRAY_SECTIONS.map(({ key, title }) => {
              const items = safeArray(record[key]);
              if (items.length === 0) return null;
              return (
                <View key={key} style={styles.section}>
                  <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {items.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                </View>
              );
            })}

            {/* Patient Disclosure */}
            {record.patientDisclosureStatement && record.patientDisclosureStatement.trim() && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Patient Disclosure</Text>
                  <Text style={styles.fieldValue}>{safeString(record.patientDisclosureStatement)}</Text>
                </View>
              </View>
            )}

            {/* Reporting & Safety */}
            {visibleReporting.length > 0 && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={visibleReporting.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Reporting & Safety</Text>
                  {visibleReporting.map(f => (
                    <View key={f.key}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <Text style={styles.fieldValue}>{safeString(record[f.key])}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
};

export default ElderAbuseScreeningPDFTemplate;
