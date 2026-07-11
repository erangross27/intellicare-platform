/**
 * SchoolHealthFormsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — school health forms
 * Collection: school_health_forms
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
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
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

const safeArray = (arr) => {
  if (!arr) return [];
  return Array.isArray(arr) ? arr : [arr];
};

const SimpleField = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const SchoolHealthFormsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.school_health_forms) {
    records = Array.isArray(data.school_health_forms) ? data.school_health_forms : [data.school_health_forms];
  } else if (data?.documentData) {
    records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>School Health Forms</Text>
          </View>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>School Health Forms</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                <Text style={styles.recordTitle}>School Health Form {idx + 1}</Text>
                {record.createdAt && (
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                )}
              </View>
            </View>

            {/* Section 1: Student Information */}
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Student Information</Text>
              <SimpleField label="Medical Record Number" value={record.studentMedicalRecordNumber} />
              <SimpleField label="Primary Care Physician" value={record.primaryCarePhysician} />
            </View>

            {/* Section 2: Health Screenings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Health Screenings</Text>
              <SimpleField label="BMI Percentile" value={record.bodyMassIndexPercentile} />
              <SimpleField label="Vision Screening" value={record.visionScreeningResults} />
              {safeArray(record.hearingScreeningDecibels).length > 0 && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>Hearing Screening</Text>
                  {safeArray(record.hearingScreeningDecibels).map((h, hIdx) => (
                    <Text key={hIdx} style={styles.listItem}>{hIdx + 1}. {h.result || JSON.stringify(h)}</Text>
                  ))}
                </View>
              )}
              <SimpleField label="Scoliosis Screening" value={record.scoliosisScreeningFindings} />
              <SimpleField label="TB Screening" value={record.tuberculosisScreeningStatus} />
            </View>

            {/* Section 3: Immunization Records */}
            {safeArray(record.immunizationRecords).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Immunization Records</Text>
                {safeArray(record.immunizationRecords).map((imm, immIdx) => (
                  <View key={immIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{imm.vaccine || `Vaccine ${immIdx + 1}`}</Text>
                    {imm.dose && <Text style={styles.fieldValue}>Dose: {imm.dose}</Text>}
                    {imm.date && <Text style={styles.fieldValue}>Date: {imm.date}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Section 4: Allergic Reactions History */}
            {safeArray(record.allergicReactionsHistory).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Allergic Reactions History</Text>
                {safeArray(record.allergicReactionsHistory).map((a, aIdx) => (
                  <View key={aIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{a.allergen || `Allergen ${aIdx + 1}`}</Text>
                    {a.severity && <Text style={styles.fieldValue}>Severity: {a.severity}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Section 5: Current Medications */}
            {safeArray(record.currentMedications).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Medications</Text>
                {safeArray(record.currentMedications).map((m, mIdx) => (
                  <View key={mIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{m.medication || `Medication ${mIdx + 1}`}</Text>
                    {m.frequency && <Text style={styles.fieldValue}>Frequency: {m.frequency}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Section 6: Emergency Medication Orders */}
            {safeArray(record.emergencyMedicationOrders).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Emergency Medication Orders</Text>
                {safeArray(record.emergencyMedicationOrders).map((em, emIdx) => (
                  <View key={emIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{em.medication || `Emergency Med ${emIdx + 1}`}</Text>
                    {em.indication && <Text style={styles.fieldValue}>Indication: {em.indication}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Section 7: Chronic Medical Conditions */}
            {safeArray(record.chronicMedicalConditions).length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Chronic Medical Conditions</Text>
                {safeArray(record.chronicMedicalConditions).map((c, cIdx) => (
                  <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {c}</Text>
                ))}
              </View>
            )}

            {/* Section 8: School Accommodations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>School Accommodations</Text>
              {safeArray(record.physicalEducationRestrictions).length > 0 && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>PE Restrictions</Text>
                  {safeArray(record.physicalEducationRestrictions).map((r, rIdx) => (
                    <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {r}</Text>
                  ))}
                </View>
              )}
              <SimpleField label="504 Plan" value={hasVal(record.individualized504Plan) ? (record.individualized504Plan ? 'Yes' : 'No') : null} />
              <SimpleField label="Emergency Action Plan" value={record.emergencyActionPlan} />
              <SimpleField label="Parental Medical Consent" value={hasVal(record.parentalMedicalConsent) ? (record.parentalMedicalConsent ? 'Yes' : 'No') : null} />
            </View>

            {/* Section 9: Additional Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              {safeArray(record.specialistReferrals).length > 0 && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>Specialist Referrals</Text>
                  {safeArray(record.specialistReferrals).map((r, rIdx) => (
                    <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {r}</Text>
                  ))}
                </View>
              )}
              <SimpleField label="Mental Health Services" value={record.mentalHealthServices} />
              {safeArray(record.communicableDiseaseHistory).length > 0 && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>Communicable Disease History</Text>
                  {safeArray(record.communicableDiseaseHistory).map((c, cIdx) => (
                    <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {c}</Text>
                  ))}
                </View>
              )}
              {safeArray(record.medicalEquipmentNeeds).length > 0 && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.fieldLabel}>Medical Equipment Needs</Text>
                  {safeArray(record.medicalEquipmentNeeds).map((e, eIdx) => (
                    <Text key={eIdx} style={styles.listItem}>{eIdx + 1}. {e}</Text>
                  ))}
                </View>
              )}
            </View>

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SchoolHealthFormsDocumentPDFTemplate;
