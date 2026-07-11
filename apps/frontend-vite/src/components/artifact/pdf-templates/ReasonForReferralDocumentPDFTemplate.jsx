import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    borderBottom: '1px solid #cccccc',
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    borderBottom: '1px solid #eeeeee',
    paddingBottom: 4,
  },
  row: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 4,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue || '');
  }
};

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const SECTION_FIELDS = {
  'diagnosis-urgency': ['primaryDiagnosis', 'secondaryDiagnoses', 'urgencyLevel', 'specialtyRequested', 'specificConsultationRequest'],
  'symptom-info': ['symptomOnset', 'symptomDurationDays', 'symptomSeverity', 'painScore'],
  'medications-allergies': ['currentMedications', 'allergiesContraindications', 'anticoagulationStatus'],
  'clinical-findings': ['functionalStatus', 'vitalSigns', 'laboratoryConcerns', 'imagingAbnormalities'],
  'risk-history': ['riskFactors', 'familyHistory', 'psychosocialFactors', 'priorTreatmentFailures'],
  'hospitalizations': ['priorHospitalizations', 'emergencyDepartmentVisits'],
  'status-flags': ['pregnancyStatus', 'immunocompromisedStatus', 'progressiveDeterioriation'],
};

const SECTION_TITLES = {
  'diagnosis-urgency': 'Diagnosis & Urgency',
  'symptom-info': 'Symptom Information',
  'medications-allergies': 'Medications & Allergies',
  'clinical-findings': 'Clinical Findings',
  'risk-history': 'Risk & History',
  'hospitalizations': 'Hospitalizations',
  'status-flags': 'Status Flags',
};

const FIELD_LABELS = {
  primaryDiagnosis: 'Primary Diagnosis',
  secondaryDiagnoses: 'Secondary Diagnoses',
  urgencyLevel: 'Urgency Level',
  specialtyRequested: 'Specialty Requested',
  specificConsultationRequest: 'Specific Consultation Request',
  symptomOnset: 'Symptom Onset',
  symptomDurationDays: 'Symptom Duration (Days)',
  symptomSeverity: 'Symptom Severity',
  painScore: 'Pain Score',
  currentMedications: 'Current Medications',
  allergiesContraindications: 'Allergies / Contraindications',
  anticoagulationStatus: 'Anticoagulation Status',
  functionalStatus: 'Functional Status',
  vitalSigns: 'Vital Signs',
  laboratoryConcerns: 'Laboratory Concerns',
  imagingAbnormalities: 'Imaging Abnormalities',
  riskFactors: 'Risk Factors',
  familyHistory: 'Family History',
  psychosocialFactors: 'Psychosocial Factors',
  priorTreatmentFailures: 'Prior Treatment Failures',
  priorHospitalizations: 'Prior Hospitalizations',
  emergencyDepartmentVisits: 'Emergency Department Visits',
  pregnancyStatus: 'Pregnancy Status',
  immunocompromisedStatus: 'Immunocompromised Status',
  progressiveDeterioriation: 'Progressive Deterioration',
};

const ARRAY_FIELDS = ['secondaryDiagnoses', 'currentMedications', 'allergiesContraindications', 'laboratoryConcerns', 'imagingAbnormalities', 'riskFactors', 'psychosocialFactors', 'priorTreatmentFailures', 'priorHospitalizations'];
const BOOLEAN_FIELDS = ['pregnancyStatus', 'immunocompromisedStatus', 'progressiveDeterioriation'];

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const ReasonForReferralDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    records = document;
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Reason for Referral</Text>
          <Text style={styles.noData}>No reason for referral data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Reason for Referral</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false} minPresenceAhead={80}>
            <Text style={styles.recordTitle}>
              {record.primaryDiagnosis || `Reason for Referral ${idx + 1}`}
            </Text>

            {Object.keys(SECTION_FIELDS).map(sid => {
              const fields = SECTION_FIELDS[sid];
              const sectionHasData = fields.some(f => hasVal(record[f]));
              if (!sectionHasData) return null;

              return (
                <View key={sid} style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {fields.map(f => {
                    const val = record[f];
                    if (!hasVal(val)) return null;
                    const label = FIELD_LABELS[f];

                    if (ARRAY_FIELDS.includes(f)) {
                      const items = Array.isArray(val) ? val.filter(Boolean) : [];
                      if (items.length === 0) return null;
                      return (
                        <View key={f} style={styles.row}>
                          <Text style={styles.label}>{label}</Text>
                          {items.map((item, i) => (
                            <Text key={i} style={styles.listItem}>
                              {i + 1}. {toSafeString(item)}
                            </Text>
                          ))}
                        </View>
                      );
                    }

                    if (BOOLEAN_FIELDS.includes(f)) {
                      return (
                        <View key={f} style={styles.row}>
                          <Text style={styles.label}>{label}</Text>
                          <Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>
                        </View>
                      );
                    }

                    return (
                      <View key={f} style={styles.row}>
                        <Text style={styles.label}>{label}</Text>
                        <Text style={styles.value}>{toSafeString(val)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ReasonForReferralDocumentPDFTemplate;
