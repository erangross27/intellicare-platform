/**
 * SexualHealthCounselingDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sexual health counseling
 * Collection: sexual_health_counseling
 * Colors: #333333 for labels, conditional wrap, title inside fieldBox
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  stiRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 8 },
  stiLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginRight: 4 },
  stiValue: { fontSize: 11, color: '#000000', flex: 1 },
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
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'patient-identity': 'Patient Identity',
  'sexual-history': 'Sexual History',
  'sti-prep': 'STI Screening & PrEP',
  'assessments': 'Assessment Scores',
  'treatment': 'Treatment & Contraception',
  'goals-referrals': 'Goals & Referrals',
};

const FIELD_LABELS = {
  counselingSessionType: 'Counseling Session Type',
  chiefSexualHealthConcern: 'Chief Sexual Health Concern',
  motivationalInterviewingStage: 'Motivational Interviewing Stage',
  nextCounselingSessionInterval: 'Next Counseling Session Interval (weeks)',
  sexualOrientationIdentity: 'Sexual Orientation / Identity',
  genderIdentity: 'Gender Identity',
  sexualPartnerCount12Months: 'Sexual Partner Count (12 months)',
  condomUseConsistency: 'Condom Use Consistency',
  substanceUseWithSexualActivity: 'Substance Use With Sexual Activity',
  sexualTraumaHistory: 'Sexual Trauma History',
  intimatePartnerViolenceScreenResult: 'IPV Screen Result',
  stiScreeningHistory: 'STI Screening History',
  prepCandidacyStatus: 'PrEP Candidacy Status',
  prepAdherencePercentage: 'PrEP Adherence (%)',
  fsfiTotalScore: 'FSFI Total Score',
  iiefErectileFunctionDomain: 'IIEF Erectile Function Domain',
  sexualDistressScaleSdsScore: 'Sexual Distress Scale (SDS) Score',
  sexualDysfunctionDiagnosis: 'Sexual Dysfunction Diagnosis',
  currentContraceptiveMethod: 'Current Contraceptive Method',
  contraceptiveAdherenceScore: 'Contraceptive Adherence Score',
  hormoneTherapyRegimen: 'Hormone Therapy Regimen',
  fertilityPreservationStatus: 'Fertility Preservation Status',
  sexualHealthGoals: 'Sexual Health Goals',
  referralToSpecialist: 'Referral to Specialist',
};

const SECTION_FIELDS = {
  'session-info': ['counselingSessionType', 'chiefSexualHealthConcern', 'motivationalInterviewingStage', 'nextCounselingSessionInterval'],
  'patient-identity': ['sexualOrientationIdentity', 'genderIdentity'],
  'sexual-history': ['sexualPartnerCount12Months', 'condomUseConsistency', 'substanceUseWithSexualActivity', 'sexualTraumaHistory', 'intimatePartnerViolenceScreenResult'],
  'sti-prep': ['stiScreeningHistory', 'prepCandidacyStatus', 'prepAdherencePercentage'],
  'assessments': ['fsfiTotalScore', 'iiefErectileFunctionDomain', 'sexualDistressScaleSdsScore', 'sexualDysfunctionDiagnosis'],
  'treatment': ['currentContraceptiveMethod', 'contraceptiveAdherenceScore', 'hormoneTherapyRegimen', 'fertilityPreservationStatus'],
  'goals-referrals': ['sexualHealthGoals', 'referralToSpecialist'],
};

const BOOLEAN_FIELDS = ['sexualTraumaHistory'];
const NUMBER_FIELDS = ['sexualPartnerCount12Months', 'contraceptiveAdherenceScore', 'prepAdherencePercentage', 'fsfiTotalScore', 'iiefErectileFunctionDomain', 'sexualDistressScaleSdsScore', 'nextCounselingSessionInterval'];
const OBJECT_ARRAY_FIELDS = ['stiScreeningHistory'];
const STRING_ARRAY_FIELDS = ['substanceUseWithSexualActivity', 'sexualDysfunctionDiagnosis', 'sexualHealthGoals', 'referralToSpecialist'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (BOOLEAN_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{String(val)}</Text>
      </View>
    );
  }

  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(item => item !== null && item !== undefined && String(item).trim() !== '') : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => {
          if (item && typeof item === 'object') {
            return (
              <View key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#d1d5db', borderLeftStyle: 'solid' }}>
                {item.test && <View style={styles.stiRow}><Text style={styles.stiLabel}>Test:</Text><Text style={styles.stiValue}>{safeString(item.test)}</Text></View>}
                {item.date && <View style={styles.stiRow}><Text style={styles.stiLabel}>Date:</Text><Text style={styles.stiValue}>{formatDate(item.date)}</Text></View>}
                {item.result && <View style={styles.stiRow}><Text style={styles.stiLabel}>Result:</Text><Text style={styles.stiValue}>{safeString(item.result)}</Text></View>}
              </View>
            );
          }
          return <Text key={i} style={styles.listItem}>{`• ${safeString(item)}`}</Text>;
        })}
      </View>
    );
  }

  if (STRING_ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(item => item && String(item).trim()) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{`\u2022 ${safeString(item)}`}</Text>
        ))}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {presentFields.map(f => renderField(record, f, title))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const SexualHealthCounselingDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0]?.sexual_health_counseling && Array.isArray(docProp[0].sexual_health_counseling)) {
      records = docProp[0].sexual_health_counseling;
    } else {
      records = docProp;
    }
  } else if (docProp?.sexual_health_counseling) {
    records = Array.isArray(docProp.sexual_health_counseling) ? docProp.sexual_health_counseling : [docProp.sexual_health_counseling];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sexual Health Counseling</Text>
          </View>
          <Text style={styles.noDataText}>No sexual health counseling data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sexual Health Counseling</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false} style={styles.recordHeader}>
              <Text style={styles.recordTitle}>{record.counselingSessionType || `Sexual Health Counseling ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'session-info')}
            {renderSection(record, 'patient-identity')}
            {renderSection(record, 'sexual-history')}
            {renderSection(record, 'sti-prep')}
            {renderSection(record, 'assessments')}
            {renderSection(record, 'treatment')}
            {renderSection(record, 'goals-referrals')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SexualHealthCounselingDocumentPDFTemplate;
