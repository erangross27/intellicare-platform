/**
 * FollowUpPlanDocumentPDFTemplate.jsx
 * Canonical box-free B&W LETTER PDF (July 2026 rebuild). Underline rules only, no boxes.
 * documentTitle 26 / borderBottom 2pt #000; recordTitle 19 / 1pt; sectionTitle 16 / 1pt (rides first field);
 * fieldLabel 12 / 0.5pt #999; value 14. Each field a wrap={false} atomic View. Static PHI footer.
 * Renders the SAME record.date the JSX edits (never createdAt). Single-record + string arrays.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ CONFIG (mirrors JSX SECTION_FIELDS / FIELD_LABELS) ═══════ */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'follow-up-details': 'Follow-Up Details',
  'monitoring': 'Monitoring & Tests',
  'goals': 'Clinical Goals',
  'medications-treatments': 'Medications & Treatments',
  'activity-diet': 'Activity & Diet',
  'referrals-coordination': 'Referrals & Care Coordination',
  'vaccines': 'Vaccines & Screenings',
  'red-flags-education': 'Red Flags & Education',
  'barriers': 'Compliance Barriers',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  followUpReason: 'Follow-Up Reason', followUpInterval: 'Follow-Up Interval', followUpModality: 'Follow-Up Modality', nextAppointmentScheduled: 'Next Appointment Scheduled',
  monitoringParameters: 'Monitoring Parameters', requiredLabTests: 'Required Lab Tests', requiredImagingStudies: 'Required Imaging Studies', screeningsDue: 'Screenings Due',
  goalBloodPressure: 'Goal Blood Pressure', goalBloodGlucose: 'Goal Blood Glucose', goalWeight: 'Goal Weight',
  medicationChanges: 'Medication Changes', physicalTherapyOrdered: 'Physical Therapy Ordered', anticoagulationManagement: 'Anticoagulation Management', woundCareInstructions: 'Wound Care Instructions',
  activityRestrictions: 'Activity Restrictions', dietaryModifications: 'Dietary Modifications',
  specialtyReferrals: 'Specialty Referrals', careCoordinationNeeds: 'Care Coordination Needs', homeHealthServices: 'Home Health Services', durableMedicalEquipment: 'Durable Medical Equipment',
  vaccinesRecommended: 'Vaccines Recommended',
  symptomRedFlags: 'Symptom Red Flags', patientEducationTopics: 'Patient Education Topics',
  complianceBarriers: 'Compliance Barriers',
};
const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility'],
  'follow-up-details': ['followUpReason', 'followUpInterval', 'followUpModality', 'nextAppointmentScheduled'],
  'monitoring': ['monitoringParameters', 'requiredLabTests', 'requiredImagingStudies', 'screeningsDue'],
  'goals': ['goalBloodPressure', 'goalBloodGlucose', 'goalWeight'],
  'medications-treatments': ['medicationChanges', 'physicalTherapyOrdered', 'anticoagulationManagement', 'woundCareInstructions'],
  'activity-diet': ['activityRestrictions', 'dietaryModifications'],
  'referrals-coordination': ['specialtyReferrals', 'careCoordinationNeeds', 'homeHealthServices', 'durableMedicalEquipment'],
  'vaccines': ['vaccinesRecommended'],
  'red-flags-education': ['symptomRedFlags', 'patientEducationTopics'],
  'barriers': ['complianceBarriers'],
};
const SECTION_ORDER = ['record-info', 'follow-up-details', 'monitoring', 'goals', 'medications-treatments', 'activity-diet', 'referrals-coordination', 'vaccines', 'red-flags-education', 'barriers'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['monitoringParameters', 'requiredLabTests', 'requiredImagingStudies', 'screeningsDue', 'medicationChanges', 'activityRestrictions', 'dietaryModifications', 'specialtyReferrals', 'careCoordinationNeeds', 'homeHealthServices', 'durableMedicalEquipment', 'vaccinesRecommended', 'symptomRedFlags', 'patientEducationTopics', 'complianceBarriers'];

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 12, color: '#000', lineHeight: 1.5 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000', marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 12, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 8, marginTop: 10 },
  field: { marginBottom: 9 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#999', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999', marginBottom: 4 },
  value: { fontSize: 14, color: '#000', marginBottom: 2 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#999', paddingTop: 6 },
});

const safeString = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/…/g, '...').replace(/[°]/g, ' deg').replace(/[±]/g, '+/-')
    .replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[→]/g, '->')
    .replace(/[×✕✖]/g, 'x').replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u')
    .replace(/[^\x00-\x7F]/g, '');
  return s;
};
const formatDate = (v) => { if (!v) return ''; try { const d = new Date(v.$date || v); if (isNaN(d.getTime())) return String(v); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(v); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const FollowUpPlanDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) records = templateData;
  else if (templateData?.follow_up_plan) records = Array.isArray(templateData.follow_up_plan) ? templateData.follow_up_plan : [templateData.follow_up_plan];
  else if (templateData) records = [templateData];
  records = records.filter(r => r && typeof r === 'object');

  const renderField = (record, fn, sid, keyPrefix) => {
    const val = record[fn];
    if (isEmptyDeep(val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.trim().toLowerCase() !== (SECTION_TITLES[sid] || '').trim().toLowerCase();
    let valueEls;
    if (DATE_FIELDS.includes(fn)) {
      valueEls = [<Text key="v" style={styles.value}>{safeString(formatDate(val))}</Text>];
    } else if (ARRAY_FIELDS.includes(fn)) {
      const arr = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
      if (arr.length === 0) return null;
      valueEls = arr.map((item, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(item)}`}</Text>);
    } else {
      const sentences = splitBySentence(safeString(val));
      if (sentences.length > 1) valueEls = sentences.map((s, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${s.replace(/[;.]+$/, '').trim()}`}</Text>);
      else valueEls = [<Text key="v" style={styles.value}>{safeString(val)}</Text>];
    }
    return (
      <View key={keyPrefix} style={styles.field} wrap={false}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {valueEls}
      </View>
    );
  };

  const renderSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const els = [];
    fields.forEach(fn => { const el = renderField(record, fn, sid, `${sid}-${fn}-${idx}`); if (el) els.push(el); });
    if (els.length === 0) return null;
    /* section title rides inside the first field's View (anti-orphan) */
    const first = els[0];
    const firstWrapped = (
      <View key={`s-${sid}-${idx}`} wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
    );
    return [firstWrapped, ...els.slice(1)];
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Follow Up Plan</Text>
          <Text style={styles.value}>No follow up plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {records.map((record, idx) => (
        <Page key={idx} size="LETTER" style={styles.page} break={idx > 0}>
          {idx === 0 && <Text style={styles.documentTitle}>Follow Up Plan</Text>}
          <Text style={styles.recordTitle}>{`Follow Up Plan ${idx + 1}`}</Text>
          {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          <Text style={styles.footer} fixed>Confidential - Protected Health Information (PHI) - Handle per HIPAA</Text>
        </Page>
      ))}
    </Document>
  );
};

export default FollowUpPlanDocumentPDFTemplate;
