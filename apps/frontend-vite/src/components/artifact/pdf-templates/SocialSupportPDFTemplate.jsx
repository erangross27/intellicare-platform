/**
 * SocialSupportPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — social support
 * Collection: social_support
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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* ======= FIELD RENDERERS ======= */
const FieldBox = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{fmtVal(value)}</Text>
    </View>
  );
};

const ArrayFieldBox = ({ label, items }) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
      ))}
    </View>
  );
};

/* ======= SECTION RENDERER ======= */
const Section = ({ title, children }) => {
  const validChildren = React.Children.toArray(children).filter(c => c !== null && c !== false);
  if (validChildren.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {validChildren}
    </View>
  );
};

/* ======= MAIN TEMPLATE ======= */
const SocialSupportPDFTemplate = ({ document: docProp }) => {
  const records = Array.isArray(docProp) ? docProp : [docProp];
  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Social Support Assessment</Text>
        </View>

        {!hasRecords ? (
          <Text style={styles.noDataText}>No social support records available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordTitle}>Assessment #{idx + 1}</Text>
                  {hasVal(record.createdAt) && <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>}
                </View>
              </View>

              {/* Caregiver Information */}
              <Section title="Caregiver Information">
                <FieldBox label="Primary Caregiver Type" value={record.primaryCaregiverType} />
                <FieldBox label="Caregiver Availability (hours/day)" value={record.caregiverAvailabilityHours} />
                <FieldBox label="Caregiver Burden Scale" value={record.caregiverBurdenScale} />
              </Section>

              {/* Living Situation */}
              <Section title="Living Situation">
                <FieldBox label="Living Arrangement" value={record.livingArrangementStatus} />
                <FieldBox label="Social Isolation Risk Score (0-10)" value={record.socialIsolationRiskScore} />
                <FieldBox label="Family Support System Strength" value={record.familySupportSystemStrength} />
              </Section>

              {/* Support Services */}
              <Section title="Support Services">
                <FieldBox label="Medication Management Support" value={record.medicationManagementSupport} />
                <FieldBox label="Emergency Contact Available" value={record.emergencyContactAvailability} />
                <FieldBox label="Social Worker Assigned" value={record.socialWorkerAssignment} />
                <FieldBox label="Home Health Aide Hours (per week)" value={record.homeHealthAideHours} />
                <FieldBox label="Support Group Participation" value={record.supportGroupParticipation} />
                <FieldBox label="Advance Directive Discussion" value={record.advanceDirectiveDiscussion} />
              </Section>

              {/* Transportation & Financial */}
              <Section title="Transportation & Financial">
                <FieldBox label="Transportation Accessibility" value={record.transportationAccessibility} />
                <FieldBox label="Financial Support Adequacy" value={record.financialSupportAdequacy} />
                <FieldBox label="Discharge Readiness Score" value={record.dischargeReadinessScore} />
              </Section>

              {/* Care Coordination */}
              <Section title="Care Coordination">
                <FieldBox label="Care Coordination Complexity" value={record.careCoordinationComplexity} />
                <FieldBox label="Palliative Care Referral Status" value={record.palliativeCareReferralStatus} />
                <ArrayFieldBox label="Community Resource Utilization" items={record.communityResourceUtilization} />
                <ArrayFieldBox label="Psychosocial Risk Factors" items={record.psychosocialRiskFactors} />
              </Section>

              {/* Provider Information */}
              <Section title="Provider Information">
                <FieldBox label="Provider" value={record.provider} />
                <FieldBox label="Facility" value={record.facility} />
              </Section>

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default SocialSupportPDFTemplate;
