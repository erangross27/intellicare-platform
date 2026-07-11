/**
 * PolypharmacyReviewsDocumentPDFTemplate.jsx
 * Box-free B&W canonical PDF — Helvetica — LETTER — polypharmacy reviews
 * Collection: polypharmacy_reviews
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordSubtitle: { fontSize: 12, color: '#555555', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#555555', marginTop: 40 },
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* number fields where a stored 0 means "not assessed" (sentinel), not a real zero — hide when 0.
   Mirrors the JSX SENTINEL_ZERO_FIELDS so Copy/JSX/PDF parity holds. */
const SENTINEL_ZERO_FIELDS = ['medicationAdherenceScore', 'pillBurdenAssessment'];
const isMeaninglessZero = (fn, v) => SENTINEL_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0');

const cleanArray = (items) => (Array.isArray(items) ? items.filter(it => it !== null && it !== undefined && it !== '') : []);

const formatObjectItem = (obj) => {
  if (!obj || typeof obj !== 'object') return String(obj || '');
  const parts = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (k === '_id' || k === '__v') return;
    if (v !== null && v !== undefined && v !== '') parts.push(`${k}: ${v}`);
  });
  return parts.join(' | ');
};

/* ======= FIELD RENDERERS (box-free fieldBox; no self-wrap — anti-orphan glue handles wrapping) ======= */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

const renderArrayFieldPDF = (label, items) => {
  const safeItems = cleanArray(items);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

const renderObjectArrayFieldPDF = (label, items) => {
  // Non-array values (e.g. a stray epoch-1970 date sentinel on deprescribingCandidates) are skipped.
  const safeItems = cleanArray(items);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {typeof item === 'object' ? formatObjectItem(item) : safeString(item)}</Text>
      ))}
    </View>
  );
};

const renderField = (field, val) => {
  if (field.isDate) return renderDateFieldPDF(field.label, val);
  if (field.isObjectArray) return renderObjectArrayFieldPDF(field.label, val);
  if (field.isArray) return renderArrayFieldPDF(field.label, val);
  return renderFieldRow(field.label, val);
};

/* a field renders iff it produces visible content */
const fieldVisible = (field, val) => {
  if (field.isObjectArray || field.isArray) return cleanArray(val).length > 0;
  if (!hasVal(val)) return false;
  if (isMeaninglessZero(field.key, val)) return false;
  return true;
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Medication Overview',
    fields: [
      { key: 'patientMedications', label: 'Patient Medications', isArray: true },
      { key: 'medicationCount', label: 'Medication Count' },
      { key: 'pillBurdenAssessment', label: 'Pill Burden Assessment' },
      { key: 'medicationAdherenceScore', label: 'Medication Adherence Score' },
    ],
  },
  {
    title: 'Drug Interactions & Inappropriate Medications',
    fields: [
      { key: 'potentialDrugInteractions', label: 'Potential Drug Interactions', isObjectArray: true },
      { key: 'inappropriateMedications', label: 'Inappropriate Medications', isObjectArray: true },
      { key: 'duplicateTherapies', label: 'Duplicate Therapies', isArray: true },
      { key: 'therapeuticDuplicates', label: 'Therapeutic Duplicates' },
    ],
  },
  {
    title: 'Safety Risks',
    fields: [
      { key: 'fallRiskMedications', label: 'Fall Risk Medications', isArray: true },
      { key: 'qtProlongingAgents', label: 'QT Prolonging Agents', isArray: true },
      { key: 'anticholinergicBurdenScore', label: 'Anticholinergic Burden Score' },
      { key: 'adverseDrugReactions', label: 'Adverse Drug Reactions', isArray: true },
    ],
  },
  {
    title: 'Organ Function Adjustments',
    fields: [
      { key: 'renalFunctionAdjustments', label: 'Renal Function Adjustments', isObjectArray: true },
      { key: 'hepaticAdjustments', label: 'Hepatic Adjustments', isObjectArray: true },
    ],
  },
  {
    title: 'Reconciliation & Costs',
    fields: [
      { key: 'drugAllergyContraindications', label: 'Drug Allergy Contraindications', isArray: true },
      { key: 'medicationReconciliationDiscrepancies', label: 'Medication Reconciliation Discrepancies', isArray: true },
      { key: 'prescribingCascadeIdentified', label: 'Prescribing Cascade Identified' },
      { key: 'costOptimizationOpportunities', label: 'Cost Optimization Opportunities', isArray: true },
    ],
  },
  {
    title: 'Deprescribing & Monitoring',
    fields: [
      { key: 'deprescribingCandidates', label: 'Deprescribing Candidates', isObjectArray: true },
      { key: 'monitoringParameters', label: 'Monitoring Parameters', isObjectArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const PolypharmacyReviewsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.polypharmacy_reviews) return Array.isArray(r.polypharmacy_reviews) ? r.polypharmacy_reviews : [r.polypharmacy_reviews];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.polypharmacy_reviews) return Array.isArray(dd.polypharmacy_reviews) ? dd.polypharmacy_reviews : [dd.polypharmacy_reviews]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Polypharmacy Reviews</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Polypharmacy Reviews</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Polypharmacy Review {index + 1}</Text>
              {hasVal(record.medicationCount) && (
                <Text style={styles.recordSubtitle}>{record.medicationCount} medications</Text>
              )}
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const visibleFields = sectionConfig.fields.filter(f => fieldVisible(f, record[f.key]));
              if (visibleFields.length === 0) return null;
              const [firstField, ...restFields] = visibleFields;

              return (
                <View key={sIdx} style={styles.section}>
                  {/* anti-orphan: section title glued to first present field so a title never orphans at a page bottom */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(firstField, record[firstField.key])}
                  </View>
                  {restFields.map((field, fIdx) => (
                    <View key={fIdx}>{renderField(field, record[field.key])}</View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PolypharmacyReviewsDocumentPDFTemplate;
