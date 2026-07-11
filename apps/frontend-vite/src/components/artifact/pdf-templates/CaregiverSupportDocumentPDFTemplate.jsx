/**
 * CaregiverSupportDocumentPDFTemplate.jsx
 * Helvetica 22/13/11pt — LETTER size — US medical platform
 * Collection: caregiver_support
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free line-based layout (mirrors user-approved ConsultationNotesDocumentPDFTemplate):
   no backgroundColor/border boxes; underline under section titles (1pt black) and under
   field sub-labels (0.5pt gray); bigger fonts (page 15 / title 26 / section 16 / value 14). */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 13, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
// Numeric fields where 0 is a "not recorded" sentinel — hide zero (mirrors the on-screen template).
const NUMBER_FIELDS = new Set(['caregiverBurdenScore', 'hoursOfCarePerWeek']);
const hasNumVal = (v) => { if (v === null || v === undefined || v === '') return false; const n = parseFloat(v); return !isNaN(n) && n !== 0; };
const fieldHasVal = (fn, v) => NUMBER_FIELDS.has(fn) ? hasNumVal(v) : hasVal(v);

const FL = {
  caregiverName: 'Caregiver Name', relationshipToPatient: 'Relationship', provider: 'Provider', facility: 'Facility',
  caregiverBurdenScore: 'Burden Score', hoursOfCarePerWeek: 'Hours/Week', caregivingDuration: 'Duration', caregiverStressLevel: 'Stress Level',
  sleepDisruptionFrequency: 'Sleep Disruption', socialIsolationLevel: 'Social Isolation',
  supportGroupParticipation: 'Support Group', respiteCareUtilization: 'Respite Care', caregiverCounselingReferral: 'Counseling Referral',
  medicalDecisionMakingRole: 'Decision-Making Role', emergencyBackupPlan: 'Emergency Plan',
  careTransitionConcerns: 'Transition Concerns', financialStrainLevel: 'Financial Strain', employmentImpact: 'Employment Impact',
  assistanceWithAdls: 'ADL Assistance', assistanceWithIadls: 'IADL Assistance', caregiverHealthConcerns: 'Health Concerns',
  caregiverTrainingProvided: 'Training', caregiverCopingStrategies: 'Coping Strategies',
  homeModificationsNeeded: 'Home Modifications', assistiveDevicesUsed: 'Assistive Devices',
};
const COMMA_SPLIT_FIELDS = new Set(['medicalDecisionMakingRole', 'emergencyBackupPlan', 'careTransitionConcerns', 'financialStrainLevel', 'employmentImpact', 'supportGroupParticipation']);

/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or" sits
   right before or right after the comma, NOT without a following space ("$18,000") */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};

/* single-name rule: hide the field label when it duplicates the section title */
const showFieldLabel = (f, sTitle) => (FL[f] || f).trim().toLowerCase() !== String(sTitle || '').trim().toLowerCase();

/* Title INSIDE fieldBox + conditional wrap on fieldBox per MCP anti-orphan pattern */
const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => fieldHasVal(f, record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={visible.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {visible.map((f, i) => (
          <View key={i} style={{ marginBottom: 4 }}>
            {showFieldLabel(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
            <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

/* Title INSIDE fieldBox + conditional wrap — comma fields get numbered items */
const renderCommaSplitSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  const totalItems = visible.reduce((sum, f) => { if (COMMA_SPLIT_FIELDS.has(f)) { return sum + splitByComma(record[f]).length; } return sum + 1; }, 0);
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {visible.map((f, fi) => {
          const val = fmtVal(record[f]);
          const parts = COMMA_SPLIT_FIELDS.has(f) ? splitByComma(val) : [val];
          return (
            <View key={fi} style={{ marginBottom: 4 }}>
              {showFieldLabel(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
              {parts.map((p, pi) => (
                <Text key={pi} style={styles.listItem}>{pi + 1}. {p}</Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
};

/* Title INSIDE fieldBox + conditional wrap — numbered list */
const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {arr.map((it, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>
        ))}
      </View>
    </View>
  );
};

const CaregiverSupportDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.caregiver_support) return Array.isArray(r.caregiver_support) ? r.caregiver_support : [r.caregiver_support];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.caregiver_support) return Array.isArray(dd.caregiver_support) ? dd.caregiver_support : [dd.caregiver_support]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Caregiver Support</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Caregiver Support</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Caregiver Support ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderFieldSection('Caregiver', ['caregiverName', 'relationshipToPatient', 'provider', 'facility'], record)}
            {renderFieldSection('Care Metrics', ['caregiverBurdenScore', 'hoursOfCarePerWeek', 'caregivingDuration', 'caregiverStressLevel'], record)}
            {renderArraySection('ADL Assistance', record.assistanceWithAdls)}
            {renderArraySection('IADL Assistance', record.assistanceWithIadls)}
            {renderFieldSection('Health & Wellbeing', ['sleepDisruptionFrequency', 'socialIsolationLevel'], record)}
            {renderArraySection('Health Concerns', record.caregiverHealthConcerns)}
            {renderCommaSplitSection('Support Services', ['supportGroupParticipation', 'respiteCareUtilization', 'caregiverCounselingReferral'], record)}
            {renderArraySection('Training', record.caregiverTrainingProvided)}
            {renderArraySection('Coping Strategies', record.caregiverCopingStrategies)}
            {renderArraySection('Home Modifications', record.homeModificationsNeeded)}
            {renderArraySection('Assistive Devices', record.assistiveDevicesUsed)}
            {renderCommaSplitSection('Roles & Planning', ['medicalDecisionMakingRole', 'emergencyBackupPlan', 'careTransitionConcerns', 'financialStrainLevel', 'employmentImpact'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CaregiverSupportDocumentPDFTemplate;
