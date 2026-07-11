/**
 * WellnessVisitDocumentationDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — wellness visit documentation
 * Collection: wellness_visit_documentation
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the section's single wrap-gated View as the FIRST child.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordDate: { fontSize: 11, color: '#333333', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* MEANINGFUL_ZERO_FIELDS: screening scores where 0 is a valid clinical finding (negative screen / no risk) → always show when present */
const MEANINGFUL_ZERO_FIELDS = ['fallRiskScore', 'depressionScreeningScore'];

/* hide-zero: numeric "not recorded" (0) hidden unless meaningful-zero or doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(key)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

/* coerceBool: schema-boolean fields stored as Date/string in DB → map truthy value back to boolean so the field renders */
const coerceBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (s === '') return null; if (s === 'false' || s === 'no' || s === '0') return false; return true; }
  if (typeof v === 'number') return v !== 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= SUB-RENDERERS (return arrays of <Text> children, no wrapping View — Rule #74) ======= */
const fieldRowChildren = (label, value, keyBase) => {
  if (!hasVal(value)) return [];
  return [
    <Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>,
    <Text key={`${keyBase}-v`} style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>,
  ];
};

const dateRowChildren = (label, value, keyBase) => {
  if (!hasVal(value)) return [];
  return [
    <Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>,
    <Text key={`${keyBase}-v`} style={styles.fieldValue}>{formatDate(value)}</Text>,
  ];
};

const sentenceChildren = (label, text, keyBase) => {
  if (!hasVal(text)) return [];
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return [];
  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });
  const children = [<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>];
  rows.forEach((row, i) => {
    if (row.type === 'subtitle') children.push(<Text key={`${keyBase}-${i}`} style={styles.nestedSubtitle}>{row.text}</Text>);
    else children.push(<Text key={`${keyBase}-${i}`} style={styles.listItem}>{row.num}. {row.text}</Text>);
  });
  return children;
};

const arrayChildren = (label, items, keyBase) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return [];
  const children = [<Text key={`${keyBase}-l`} style={styles.fieldLabel}>{label}</Text>];
  safeItems.forEach((item, i) => {
    children.push(<Text key={`${keyBase}-${i}`} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>);
  });
  return children;
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Visit & Vitals',
    fields: [
      { key: 'visitType', label: 'Visit Type', isSentence: true },
      { key: 'ageAtVisit', label: 'Age at Visit', isNumber: true },
      { key: 'heightInCm', label: 'Height (cm)', isNumber: true },
      { key: 'weightInKg', label: 'Weight (kg)', isNumber: true },
      { key: 'bodyMassIndex', label: 'BMI', isNumber: true },
      { key: 'bloodPressureSystolic', label: 'BP Systolic', isNumber: true },
      { key: 'bloodPressureDiastolic', label: 'BP Diastolic', isNumber: true },
      { key: 'vitalSignsDateTime', label: 'Vital Signs Date/Time', isDate: true },
    ],
  },
  {
    title: 'Immunizations & Screenings',
    fields: [
      { key: 'immunizationsAdministered', label: 'Immunizations Administered', isArray: true },
      { key: 'immunizationsDeclined', label: 'Immunizations Declined', isArray: true },
      { key: 'screeningsPerformed', label: 'Screenings Performed', isArray: true },
      { key: 'developmentalMilestones', label: 'Developmental Milestones', isArray: true },
    ],
  },
  {
    title: 'Health Maintenance',
    fields: [
      { key: 'healthMaintenanceItemsDue', label: 'Health Maintenance Items Due', isArray: true },
      { key: 'healthMaintenanceItemsCompleted', label: 'Health Maintenance Items Completed', isArray: true },
      { key: 'chronicConditionsReviewed', label: 'Chronic Conditions Reviewed', isArray: true },
      { key: 'currentMedicationsList', label: 'Current Medications List', isArray: true },
      { key: 'medicationReconciliationCompleted', label: 'Medication Reconciliation Completed', isBoolean: true },
    ],
  },
  {
    title: 'History & Directives',
    fields: [
      { key: 'familyHistoryUpdated', label: 'Family History Updated', isBoolean: true },
      { key: 'socialHistoryUpdated', label: 'Social History Updated', isBoolean: true },
      { key: 'advanceDirectivesDiscussed', label: 'Advance Directives Discussed', isBoolean: true },
      { key: 'functionalStatusAssessment', label: 'Functional Status Assessment', isSentence: true },
    ],
  },
  {
    title: 'Screening Scores & Plan',
    fields: [
      { key: 'fallRiskScore', label: 'Fall Risk Score', isNumber: true },
      { key: 'depressionScreeningScore', label: 'Depression Screening Score', isNumber: true },
      { key: 'laboratoriesOrdered', label: 'Laboratories Ordered', isArray: true },
      { key: 'counselingProvided', label: 'Counseling Provided', isArray: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof coerceBool(record[field.key]) === 'boolean';
  return hasVal(record[field.key]);
};

/* approxRows: rough count of Text lines a field contributes — for wrap gating */
const approxRows = (record, field) => {
  if (field.isArray) { const items = Array.isArray(record[field.key]) ? record[field.key].filter(Boolean) : []; return 1 + items.length; }
  if (field.isSentence) { return 1 + splitBySentence(fmtVal(record[field.key])).length; }
  return 2;
};

const fieldChildren = (record, field, keyBase) => {
  const val = record[field.key];
  if (field.isArray) return arrayChildren(field.label, val, keyBase);
  if (field.isSentence) return sentenceChildren(field.label, val, keyBase);
  if (field.isDate) return dateRowChildren(field.label, val, keyBase);
  if (field.isBoolean) return fieldRowChildren(field.label, coerceBool(val), keyBase);
  return fieldRowChildren(field.label, val, keyBase);
};

/* ======= COMPONENT ======= */
const WellnessVisitDocumentationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.wellness_visit_documentation) return Array.isArray(r.wellness_visit_documentation) ? r.wellness_visit_documentation : [r.wellness_visit_documentation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.wellness_visit_documentation) return Array.isArray(dd.wellness_visit_documentation) ? dd.wellness_visit_documentation : [dd.wellness_visit_documentation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Wellness Visit Documentation</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Wellness Visit Documentation</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Wellness Visit Documentation ${index + 1}`}
              </Text>
              {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
            </View>

            {/* Sections — each section is ONE wrap-gated View, sectionTitle FIRST child (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              const totalRows = presentFields.reduce((sum, f) => sum + approxRows(record, f), 0);

              return (
                <View key={sIdx} style={styles.section} wrap={totalRows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) => (
                    <View key={fIdx} style={styles.fieldBox} wrap={false}>
                      {fieldChildren(record, field, `${sIdx}-${fIdx}`)}
                    </View>
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

export default WellnessVisitDocumentationDocumentPDFTemplate;
