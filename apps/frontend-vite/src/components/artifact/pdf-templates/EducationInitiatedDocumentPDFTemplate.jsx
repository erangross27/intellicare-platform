import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Box-free B&W LETTER (canonical, memory 6a2d6af6): underline rules — documentTitle 2pt / recordTitle+sectionTitle 1pt black / fieldLabel 0.5pt #999.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Mirror the JSX enum canonicalization so the PDF shows 'Physician'/'Good', not 'physician'/'good'.
const ENUM_OPTIONS = {
  educationMethod: ['Verbal Instruction', 'Written Materials', 'Demonstration', 'Return Demonstration', 'Video', 'Group Class', 'Teach-Back'],
  educatorRole: ['Physician', 'Registered Nurse', 'Nurse Practitioner', 'Physician Assistant', 'Pharmacist', 'Dietitian', 'Social Worker', 'Health Educator', 'Respiratory Therapist', 'Physical Therapist'],
  patientLiteracyLevel: ['Low', 'Marginal', 'Adequate', 'High'],
  comprehensionLevel: ['Poor', 'Fair', 'Good', 'Excellent'],
  patientMotivationLevel: ['Low', 'Moderate', 'High'],
  languageOfInstruction: ['English', 'Spanish', 'Mandarin', 'Cantonese', 'Vietnamese', 'Arabic', 'Russian', 'French', 'Haitian Creole', 'Portuguese', 'Korean', 'Other'],
};
const enumCanonical = (key, cur) => { const base = ENUM_OPTIONS[key] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const SECTION_CONFIG = [
  {
    title: 'Education Details',
    fields: [
      { key: 'educationTopic', label: 'Education Topic', commaSplit: true },
      { key: 'educationMethod', label: 'Education Method' },
      { key: 'educatorRole', label: 'Educator Role' },
      { key: 'patientLiteracyLevel', label: 'Patient Literacy Level' },
      { key: 'languageOfInstruction', label: 'Language of Instruction' },
      { key: 'educationDurationMinutes', label: 'Education Duration (Minutes)', isNumber: true },
    ],
  },
  {
    title: 'Education Methods & Flags',
    fields: [
      { key: 'interpreterUsed', label: 'Interpreter Used' },
      { key: 'medicationEducationProvided', label: 'Medication Education Provided' },
      { key: 'dietaryInstructionsGiven', label: 'Dietary Instructions Given' },
      { key: 'exerciseEducationProvided', label: 'Exercise Education Provided' },
    ],
  },
  {
    title: 'Content Delivery',
    fields: [
      { key: 'diseasePathophysiologyExplained', label: 'Disease Pathophysiology Explained' },
      { key: 'warningSignsEducation', label: 'Warning Signs Education' },
      { key: 'selfMonitoringInstructed', label: 'Self-Monitoring Instructed' },
      { key: 'procedureEducationProvided', label: 'Procedure Education Provided' },
    ],
  },
  {
    title: 'Comprehension & Support',
    fields: [
      { key: 'patientComprehensionAssessed', label: 'Patient Comprehension Assessed' },
      { key: 'comprehensionLevel', label: 'Comprehension Level' },
      { key: 'familyMembersPresent', label: 'Family Members Present' },
      { key: 'patientMotivationLevel', label: 'Patient Motivation Level' },
    ],
  },
  {
    title: 'Follow-Up & Discharge',
    fields: [
      { key: 'followUpEducationScheduled', label: 'Follow-Up Education Scheduled' },
      { key: 'dischargeInstructionsReviewed', label: 'Discharge Instructions Reviewed' },
      { key: 'emergencyContactInformation', label: 'Emergency Contact Information' },
    ],
  },
  {
    title: 'Materials & Barriers',
    fields: [
      { key: 'writtenMaterialsProvided', label: 'Written Materials Provided', isArray: true },
      { key: 'resourceReferralsProvided', label: 'Resource Referrals Provided', isArray: true },
      { key: 'educationBarriersIdentified', label: 'Education Barriers Identified', isArray: true },
    ],
  },
];

const fieldVisible = (record, field) => {
  const val = record[field.key];
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (field.isNumber && Number(val) === 0) return false; // hide-zero: "not recorded"
  return true;
};

const EducationInitiatedDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) records = document[0].records;
    else if (document.length > 0 && document[0]?._records) records = document[0]._records;
    else records = document;
  } else if (document?.records) records = document.records;
  else if (document?._records) records = document._records;
  else if (document) records = [document];
  const validRecords = Array.isArray(records) ? records : [];

  if (!validRecords.length) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Education Initiated</Text></View>
        <Text style={styles.emptyState}>No education initiated data available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Education Initiated</Text></View>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Education Initiated ${idx + 1}`}</Text>
            {SECTION_CONFIG.map((section, sIdx) => {
              const vis = section.fields.filter(f => fieldVisible(record, f));
              if (vis.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {vis.map((field, fi) => {
                    const val = record[field.key];
                    const isEnum = !!ENUM_OPTIONS[field.key];
                    return (
                      <View key={field.key} style={styles.fieldBox} wrap={false}>
                        {fi === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        {field.isArray && Array.isArray(val)
                          ? val.map((item, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${toSafeString(item)}`}</Text>)
                          : field.commaSplit && typeof val === 'string'
                            ? val.split(',').map(s => s.trim()).filter(Boolean).map((item, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${item}`}</Text>)
                            : <Text style={styles.fieldValue}>{`1. ${isEnum ? enumCanonical(field.key, toSafeString(val)) : toSafeString(val)}`}</Text>}
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

export default EducationInitiatedDocumentPDFTemplate;
