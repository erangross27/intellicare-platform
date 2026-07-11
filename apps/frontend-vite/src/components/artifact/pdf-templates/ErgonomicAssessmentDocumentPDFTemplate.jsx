/**
 * ErgonomicAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors ErgonomicAssessmentDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: ergonomic_assessment.
 * react-pdf 4.5.1: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ENUM canonicalization (mirror the JSX) */
const ENUM_FIELDS = {
  ergonomicRiskLevel: ['Low', 'Moderate', 'High', 'Very High'],
  interventionPriority: ['Routine', 'Urgent', 'Immediate'],
};
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
/* RULA (1-7) / REBA (1-15) cannot be 0 — a stored 0 = "not assessed" → hidden (mirror JSX ZERO_SENTINEL_FIELDS). */
const ZERO_SENTINEL = ['rapidUpperLimbScore', 'rapidEntireBodyScore'];

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Session Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'workstationType', label: 'Workstation Type' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'dailyWorkHours', label: 'Daily Work Hours', type: 'number' },
  ] },
  { title: 'Risk Assessment', fields: [
    { key: 'repetitiveTaskFrequency', label: 'Repetitive Task Frequency' },
    { key: 'primaryBodyRegionsAtRisk', label: 'Primary Body Regions at Risk', type: 'array' },
    { key: 'currentMusculoskeletalComplaints', label: 'Current Musculoskeletal Complaints', type: 'array' },
  ] },
  { title: 'Scoring', fields: [
    { key: 'rapidUpperLimbScore', label: 'Rapid Upper Limb Score', type: 'number', zeroSentinel: true },
    { key: 'rapidEntireBodyScore', label: 'Rapid Entire Body Score', type: 'number', zeroSentinel: true },
    { key: 'functionalMovementScore', label: 'Functional Movement Score', type: 'number' },
  ] },
  { title: 'Compliance', fields: [
    { key: 'monitorHeightCompliance', label: 'Monitor Height Compliance', type: 'bool' },
    { key: 'chairAdjustabilityCompliance', label: 'Chair Adjustability Compliance', type: 'bool' },
    { key: 'keyboardMousePosition', label: 'Keyboard/Mouse Position' },
    { key: 'workSurfaceHeight', label: 'Work Surface Height' },
    { key: 'footSupportProvided', label: 'Foot Support Provided', type: 'bool' },
    { key: 'reachDistanceCompliance', label: 'Reach Distance Compliance', type: 'bool' },
    { key: 'microbreakCompliance', label: 'Microbreak Compliance', type: 'bool' },
  ] },
  { title: 'Force & Exposure', fields: [
    { key: 'forceExertionLevel', label: 'Force Exertion Level' },
    { key: 'liftingFrequency', label: 'Lifting Frequency' },
    { key: 'maxWeightLifted', label: 'Max Weight Lifted', type: 'number' },
    { key: 'awkwardPosturesDuration', label: 'Awkward Postures Duration', type: 'number' },
    { key: 'vibrationExposure', label: 'Vibration Exposure', type: 'bool' },
    { key: 'lightingAdequacy', label: 'Lighting Adequacy' },
  ] },
  { title: 'Risk & Intervention', fields: [
    { key: 'ergonomicRiskLevel', label: 'Ergonomic Risk Level', type: 'enum' },
    { key: 'interventionPriority', label: 'Intervention Priority', type: 'enum' },
    { key: 'equipmentModificationsRequired', label: 'Equipment Modifications Required', type: 'array' },
    { key: 'followUpAssessmentDate', label: 'Follow-Up Assessment Date', type: 'date' },
  ] },
  { title: 'Clearance & Education', fields: [
    { key: 'returnToPlayCriteria', label: 'Return to Play Criteria', type: 'array' },
    { key: 'homeExerciseProgramIncluded', label: 'Home Exercise Program Included', type: 'bool' },
    { key: 'cardiacClearanceObtained', label: 'Cardiac Clearance Obtained', type: 'bool' },
    { key: 'educationalMaterialsProvided', label: 'Educational Materials Provided', type: 'array' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  if (f.type === 'bool') return v !== null && v !== undefined;
  if (f.type === 'number') return hasVal(v) && !((f.zeroSentinel || ZERO_SENTINEL.includes(f.key)) && Number(v) === 0);
  return hasVal(v);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = field.label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (field.type === 'array') {
    const items = (Array.isArray(val) ? val : []).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={items.length > 10}>
        {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(it))}</Text>)}
      </View>
    );
  }

  let display;
  if (field.type === 'date') display = formatDate(val);
  else if (field.type === 'bool') display = (val ? 'Yes' : 'No');
  else if (field.type === 'enum') display = enumCanonical(ENUM_FIELDS[field.key], val) || fmtVal(val);
  else display = safeString(fmtVal(val));

  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const ErgonomicAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.ergonomic_assessment) return Array.isArray(r.ergonomic_assessment) ? r.ergonomic_assessment : [r.ergonomic_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ergonomic_assessment) return Array.isArray(dd.ergonomic_assessment) ? dd.ergonomic_assessment : [dd.ergonomic_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Ergonomic Assessment</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Ergonomic Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Ergonomic Assessment {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], cfg.title, 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, cfg.title, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default ErgonomicAssessmentDocumentPDFTemplate;
