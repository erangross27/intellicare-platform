import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#000000',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#333333',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 10,
    paddingLeft: 12,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  dateBadge: {
    fontSize: 10,
    color: '#333333',
    backgroundColor: '#e8e8e8',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    backgroundColor: '#f0f0f0',
    padding: 6,
    paddingLeft: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 10,
    paddingTop: 3,
    paddingBottom: 3,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    color: '#000000',
  },
  arraySection: {
    marginBottom: 8,
    paddingLeft: 10,
  },
  arrayLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 3,
  },
  arrayItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 12,
  },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return String(val);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const hasValue = (val) => {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (val === '') return false;
  return true;
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [];
};

const FieldRow = ({ label, value }) => {
  if (!hasValue(value)) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldValue}>
        <Text style={styles.fieldLabel}>{label}:</Text> {safeString(value)}
      </Text>
    </View>
  );
};

const splitIntoSentences = (text) => {
  if (!text) return [];
  return String(text).split(/(?<=[.!?])\s+/).filter(s => s.trim()).map(s => s.trim());
};

const TextField = ({ label, value }) => {
  if (!hasValue(value)) return null;
  const sentences = splitIntoSentences(safeString(value));
  if (sentences.length <= 1) return <FieldRow label={label} value={value} />;
  return (
    <View style={styles.arraySection}>
      <Text style={styles.arrayLabel}>{label}:</Text>
      {sentences.map((sentence, i) => (
        <Text key={i} style={styles.arrayItem}>{i + 1}. {sentence}</Text>
      ))}
    </View>
  );
};

const ArrayField = ({ label, items }) => {
  const safeItems = safeArray(items);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.arraySection}>
      <Text style={styles.arrayLabel}>{label}:</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

const Section = ({ title, fields }) => {
  const validFields = fields.filter(f => {
    if (f.type === 'array') return safeArray(f.value).length > 0;
    return hasValue(f.value);
  });
  if (validFields.length === 0) return null;

  const renderFieldByType = (field, i) => {
    if (field.type === 'array') return <ArrayField key={i} label={field.label} items={field.value} />;
    if (field.type === 'text') return <TextField key={i} label={field.label} value={field.value} />;
    return <FieldRow key={i} label={field.label} value={field.value} />;
  };

  const grouped = validFields.slice(0, 2);
  const rest = validFields.slice(2);

  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {grouped.map((field, i) => renderFieldByType(field, i))}
      </View>
      {rest.map((field, i) => renderFieldByType(field, i))}
    </View>
  );
};

const MedicationTherapyManagementPDFTemplate = ({ records }) => {
  const unwrappedRecords = Array.isArray(records) ? records : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Medication Therapy Management</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {unwrappedRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Medication Therapy Management {idx + 1}</Text>
              {(record.comprehensiveMedicationReviewDate || record.createdAt) && (
                <Text style={styles.dateBadge}>{formatDate(record.comprehensiveMedicationReviewDate || record.createdAt)}</Text>
              )}
            </View>

            <Section
              title="Session Overview"
              fields={[
                { label: 'Session Type', value: record.medicationTherapyManagementSessionType },
                { label: 'CMR Date', value: formatDate(record.comprehensiveMedicationReviewDate) },
                { label: 'Total Medication Count', value: record.totalMedicationCount },
                { label: 'Medication Adherence Rate', value: record.medicationAdherenceRate },
                { label: 'Polypharmacy Risk Category', value: record.polypharmacyRiskCategory },
              ]}
            />

            <Section
              title="Drug Therapy Problems"
              fields={[
                { label: 'Drug Therapy Problems Identified', value: record.drugTherapyProblemsIdentified, type: 'array' },
              ]}
            />

            <Section
              title="Drug Safety Assessment"
              fields={[
                { label: 'Potential Drug Interactions', value: record.potentialDrugInteractions, type: 'array' },
                { label: 'Beers Criteria Violations', value: record.beersCriteriaViolations, type: 'array' },
                { label: 'STOMP Criteria Assessment', value: record.stompCriteriaAssessment, type: 'array' },
                { label: 'Anticholinergic Burden Score', value: record.anticholinergicBurdenScore },
                { label: 'Therapeutic Duplication', value: record.therapeuticDuplicationIdentified, type: 'array' },
                { label: 'High Risk Medications', value: record.highRiskMedicationsPresent, type: 'array' },
              ]}
            />

            <Section
              title="Action Plan"
              fields={[
                { label: 'Medication-Related Action Plan', value: record.medicationRelatedActionPlan, type: 'array' },
              ]}
            />

            <Section
              title="Dose Adjustments"
              fields={[
                { label: 'Renal Dose Adjustment Required', value: record.renalDoseAdjustmentRequired },
                { label: 'Hepatic Dose Adjustment Required', value: record.hepaticDoseAdjustmentRequired },
              ]}
            />

            <Section
              title="Interventions & Quality"
              fields={[
                { label: 'Targeted Intervention Categories', value: record.targetedInterventionCategories, type: 'array' },
                { label: 'Star Rating Measures Addressed', value: record.starRatingMeasuresAddressed, type: 'array' },
                { label: 'Immunization Gaps Identified', value: record.immunizationGapsIdentified, type: 'array' },
                { label: 'Prescriber Notifications Sent', value: record.prescriberNotificationsSent },
              ]}
            />

            <Section
              title="Cost Savings"
              fields={[
                { label: 'Cost Savings Opportunities', value: record.costSavingsOpportunities, type: 'array' },
                { label: 'Estimated Annual Medication Cost', value: hasValue(record.estimatedAnnualMedicationCost) ? `$${safeString(record.estimatedAnnualMedicationCost)}` : null },
              ]}
            />

            <Section
              title="Outcome & Follow-Up"
              fields={[
                { label: 'MTM Outcome Documentation', value: record.mtmOutcomeDocumentation, type: 'text' },
                { label: 'Next MTM Review Due Date', value: formatDate(record.nextMtmReviewDueDate) },
              ]}
            />
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default MedicationTherapyManagementPDFTemplate;
