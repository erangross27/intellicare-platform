/**
 * CareTeamDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: care_team
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const DATE_FIELDS = ['teamFormationDate', 'lastTeamConference'];
const fmtField = (f, v) => DATE_FIELDS.includes(f) ? formatDate(v) : fmtVal(v);

const FL = {
  teamLeadPhysician: 'Team Lead', provider: 'Provider', facility: 'Facility',
  primaryNurse: 'Primary Nurse', caseManager: 'Case Manager', socialWorker: 'Social Worker',
  pharmacistClinical: 'Clinical Pharmacist', physicalTherapist: 'PT', occupationalTherapist: 'OT',
  respiratoryTherapist: 'RT', dietitian: 'Dietitian',
  teamFormationDate: 'Team Formation Date', teamMeetingFrequency: 'Meeting Frequency', teamCommunicationMethod: 'Communication', lastTeamConference: 'Last Conference',
  dischargeCoordinator: 'Discharge Coordinator', palliativeCareConsult: 'Palliative Care',
  patientAdvocate: 'Patient Advocate', careTransitionPlan: 'Transition Plan', teamDuration: 'Duration',
};

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer} wrap={visible.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtField(f, record[f])}</Text></View>)}</View>);
};

const CareTeamDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.care_team) return Array.isArray(r.care_team) ? r.care_team : [r.care_team];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.care_team) return Array.isArray(dd.care_team) ? dd.care_team : [dd.care_team]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Care Team</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Care Team</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Care Team ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>
            {renderFieldGroup('Leadership', ['teamLeadPhysician', 'provider', 'facility'], record)}
            {safeArr(record.teamMembers).length > 0 && (<View style={styles.fieldContainer}><View wrap={false}><Text style={styles.sectionTitle}>Team Members</Text><Text style={styles.listItem}>{1}. {safeArr(record.teamMembers)[0]}</Text></View>{safeArr(record.teamMembers).slice(1).map((it, i) => <Text key={i} style={styles.listItem}>{i + 2}. {it}</Text>)}</View>)}
            {safeArr(record.consultingPhysicians).length > 0 && (<View style={styles.fieldContainer} wrap={safeArr(record.consultingPhysicians).length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Consulting Physicians</Text>{safeArr(record.consultingPhysicians).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}
            {safeArr(record.medicalSpecialties).length > 0 && (<View style={styles.fieldContainer}><View wrap={false}><Text style={styles.sectionTitle}>Medical Specialties</Text><Text style={styles.listItem}>{1}. {safeArr(record.medicalSpecialties)[0]}</Text></View>{safeArr(record.medicalSpecialties).slice(1).map((it, i) => <Text key={i} style={styles.listItem}>{i + 2}. {it}</Text>)}</View>)}
            {hasVal(record.primaryDiagnosis) && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Primary Diagnosis</Text><Text style={styles.listItem}>{record.primaryDiagnosis}</Text></View>)}
            {safeArr(record.careCoordinationGoals).length > 0 && (<View style={styles.fieldContainer}><View wrap={false}><Text style={styles.sectionTitle}>Care Coordination Goals</Text><Text style={styles.listItem}>{1}. {safeArr(record.careCoordinationGoals)[0]}</Text></View>{safeArr(record.careCoordinationGoals).slice(1).map((it, i) => <Text key={i} style={styles.listItem}>{i + 2}. {it}</Text>)}</View>)}
            {renderFieldGroup('Clinical Roles', ['primaryNurse', 'caseManager', 'socialWorker', 'pharmacistClinical', 'physicalTherapist', 'occupationalTherapist', 'respiratoryTherapist', 'dietitian'], record)}
            {renderFieldGroup('Communication', ['teamFormationDate', 'teamMeetingFrequency', 'teamCommunicationMethod', 'lastTeamConference'], record)}
            {renderFieldGroup('Coordination', ['dischargeCoordinator', 'palliativeCareConsult', 'patientAdvocate', 'careTransitionPlan', 'teamDuration'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CareTeamDocumentPDFTemplate;
