/**
 * ReturnToWorkPlanDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — return to work plan
 * Collection: return_to_work_plan
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
  booleanRow: { flexDirection: 'row', marginBottom: 4 },
  booleanLabel: { fontSize: 11, width: 200, color: '#333333' },
  booleanValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000' },
});

/* ======= UTILS ======= */
/* formatDate — null / invalid / 1970-epoch sentinel hidden */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.$date || dateStr);
    if (isNaN(d.getTime()) || d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

/* numeric 0 = "not specified" sentinel for hour/day counts */
const isMeaningfulCount = (v) => typeof v === 'number' && Number.isFinite(v) && v !== 0;

const safeStr = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(safeStr).join(', ');
  return JSON.stringify(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= RENDER HELPERS ======= */
const renderStringField = (val, label) => {
  if (!hasVal(val)) return null;
  const strVal = safeStr(val);
  const sentences = splitBySentence(strVal);

  if (sentences.length > 1) {
    let counter = 1;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            if (commaItems.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  {commaItems.map((ci, ciIdx) => (
                    <Text key={ciIdx} style={styles.listItem}>{counter++}. {ci}</Text>
                  ))}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                <Text style={styles.listItem}>{counter++}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{counter++}. {sentence}</Text>;
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

const renderDateField = (val, label) => {
  if (!hasVal(val)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(val)}</Text>
    </View>
  );
};

const renderBooleanField = (val, label) => {
  if (!hasVal(val)) return null;
  return (
    <View style={styles.booleanRow}>
      <Text style={styles.booleanLabel}>{label}:</Text>
      <Text style={styles.booleanValue}>{val ? 'Yes' : 'No'}</Text>
    </View>
  );
};

const renderNumberField = (val, label) => {
  if (!isMeaningfulCount(val)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(val)}</Text>
    </View>
  );
};

const renderArrayField = (val, label) => {
  const items = Array.isArray(val) ? val.filter(Boolean) : [];
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item, idx) => (
        <Text key={idx} style={styles.listItem}>{idx + 1}. {safeStr(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const ReturnToWorkPlanDocumentPDFTemplate = ({ records = [] }) => {
  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Return to Work Plan</Text>
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
          <Text style={styles.documentTitle}>Return to Work Plan</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
                {hasVal(record.workAbilityStatus) && <Text style={styles.recordDate}>Status: {safeStr(record.workAbilityStatus)}</Text>}
              </View>
              <Text style={styles.recordTitle}>Return to Work Plan {idx + 1}</Text>
            </View>

            {/* Plan Information */}
            {(!!formatDate(record.date) || hasVal(record.diagnosisCode) || hasVal(record.treatingPhysician) || hasVal(record.workersCompClaim)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Plan Information</Text>
                {renderDateField(record.date, 'Plan Date')}
                {renderStringField(record.diagnosisCode, 'Diagnosis Code')}
                {renderStringField(record.treatingPhysician, 'Treating Physician')}
                {renderStringField(record.workersCompClaim, 'Workers Comp Claim')}
              </View>
            )}

            {/* Employment Details */}
            {(hasVal(record.jobTitle) || hasVal(record.employerName)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Employment Details</Text>
                {renderStringField(record.jobTitle, 'Job Title')}
                {renderStringField(record.employerName, 'Employer')}
              </View>
            )}

            {/* Injury Summary */}
            {(!!formatDate(record.injuryDate) || hasVal(record.injuryDescription)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Injury Summary</Text>
                {renderDateField(record.injuryDate, 'Injury Date')}
                {renderStringField(record.injuryDescription, 'Injury Description')}
              </View>
            )}

            {/* Work Status */}
            {(hasVal(record.workAbilityStatus) || hasVal(record.maxWorkCategory) || !!formatDate(record.estimatedReturnDate)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Work Status</Text>
                {renderStringField(record.workAbilityStatus, 'Work Ability Status')}
                {renderStringField(record.maxWorkCategory, 'Max Work Category')}
                {renderDateField(record.estimatedReturnDate, 'Estimated Return Date')}
              </View>
            )}

            {/* Work Schedule */}
            {(isMeaningfulCount(record.hoursPerDayAllowed) || isMeaningfulCount(record.daysPerWeekAllowed) || !!formatDate(record.modifiedDutyStartDate) || !!formatDate(record.modifiedDutyEndDate)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Work Schedule</Text>
                {renderNumberField(record.hoursPerDayAllowed, 'Hours Per Day Allowed')}
                {renderNumberField(record.daysPerWeekAllowed, 'Days Per Week Allowed')}
                {renderDateField(record.modifiedDutyStartDate, 'Modified Duty Start')}
                {renderDateField(record.modifiedDutyEndDate, 'Modified Duty End')}
              </View>
            )}

            {/* Restrictions */}
            {(hasVal(record.liftingRestriction) || (Array.isArray(record.postureRestrictions) && record.postureRestrictions.length > 0) || hasVal(record.durationRestrictions) || hasVal(record.repetitiveMotionLimits) || (Array.isArray(record.environmentalRestrictions) && record.environmentalRestrictions.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restrictions</Text>
                {renderStringField(record.liftingRestriction, 'Lifting Restriction')}
                {renderArrayField(record.postureRestrictions, 'Posture Restrictions')}
                {renderStringField(record.durationRestrictions, 'Duration Restrictions')}
                {renderStringField(record.repetitiveMotionLimits, 'Repetitive Motion Limits')}
                {renderArrayField(record.environmentalRestrictions, 'Environmental Restrictions')}
              </View>
            )}

            {/* Accommodations */}
            {(Array.isArray(record.accommodationsRequired) && record.accommodationsRequired.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Accommodations Required</Text>
                {renderArrayField(record.accommodationsRequired, 'Accommodations')}
              </View>
            )}

            {/* Treatment Progress */}
            {(hasVal(record.physicalTherapyRequired) || hasVal(record.functionalCapacityEvaluation) || hasVal(record.maximumMedicalImprovement) || hasVal(record.permanentRestrictions) || hasVal(record.restrictionReviewDate)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Treatment Progress</Text>
                {renderBooleanField(record.physicalTherapyRequired, 'Physical Therapy Required')}
                {renderBooleanField(record.functionalCapacityEvaluation, 'Functional Capacity Evaluation')}
                {renderBooleanField(record.maximumMedicalImprovement, 'Maximum Medical Improvement')}
                {renderBooleanField(record.permanentRestrictions, 'Permanent Restrictions')}
                {renderDateField(record.restrictionReviewDate, 'Restriction Review Date')}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ReturnToWorkPlanDocumentPDFTemplate;
