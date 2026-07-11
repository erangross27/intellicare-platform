/**
 * AnnualPhysicalExaminationDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — annual physical examination
 * Collection: annual_physical_examination
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordDate: { fontSize: 13, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#333333', textAlign: 'center', marginTop: 40 },
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
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

/* Schema declares familyHistoryUpdated/socialHistoryUpdated as boolean, but stored
 * data is a Date sentinel (epoch ~1970 = "not updated"). Normalize to tristate. */
const updatedFlagState = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  const d = new Date(val.$date || val);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() >= 2000;
};

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
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

/* ---- Field UNIT builders: each field → { label, rows: [<Text>...] } ----
 * Rows are FLAT <Text> elements (no per-field wrapping View) so a tall section can break
 * BETWEEN rows instead of compressing into one non-wrapping block (overprint). */

const valueUnit = (label, value) => {
  if (!hasVal(value)) return null;
  return { label, rows: [<Text key="v" style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>] };
};

const dateUnit = (label, value) => {
  if (!hasVal(value)) return null;
  return { label, rows: [<Text key="v" style={styles.fieldValue}>{formatDate(value)}</Text>] };
};

const arrayUnit = (label, items) => {
  if (!Array.isArray(items)) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  return { label, rows: safeItems.map((item, i) => (
    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
  )) };
};

/* sentenceUnit: parseLabel + comma-split — duplicate label suppression */
const sentenceUnit = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push(<Text key={`r${rows.length}`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
        commaItems.forEach(ci => { rows.push(<Text key={`r${rows.length}`} style={styles.listItem}>{n++}. {safeString(ci)}</Text>); });
      } else {
        rows.push(<Text key={`r${rows.length}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
      }
    } else {
      rows.push(<Text key={`r${rows.length}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return rows.length ? { label, rows } : null;
};

/* renderSectionFlow — anti-orphan + anti-overprint (memory 6a3cda8c / Rule #74).
 * Small section (<=8 total rows) → ONE atomic wrap={false} block: title + fields move together and
 * the whole block relocates to the next page when it doesn't fit (never compresses).
 * Large section → a FLOWING container. Each field glues only its [label + first row] inside a small
 * wrap={false} View (the section title rides in the FIRST field's glue), and the remaining rows flow
 * as siblings. So a title that won't fit is forced WHOLE to the next page with its first rows, and the
 * rest of the section continues flowing across pages — never overprinting. */
const renderSectionFlow = (sectionTitle, units) => {
  const fields = units.filter(u => u && u.rows && u.rows.length);
  if (fields.length === 0) return null;
  const totalRows = fields.reduce((acc, u) => acc + u.rows.length, 0);

  if (totalRows <= 8) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {fields.map((u, fi) => (
          <View key={fi} style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{u.label}</Text>
            {u.rows}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section} wrap>
      {fields.map((u, fi) => (
        <React.Fragment key={fi}>
          <View wrap={false}>
            {fi === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
            <Text style={[styles.fieldLabel, fi > 0 ? { marginTop: 8 } : null]}>{u.label}</Text>
            {u.rows.slice(0, 1)}
          </View>
          {u.rows.slice(1)}
        </React.Fragment>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Vital Signs',
    fields: [
      { key: 'vitalSignsBloodPressureSystolic', label: 'BP Systolic (mmHg)', isNumber: true },
      { key: 'vitalSignsBloodPressureDiastolic', label: 'BP Diastolic (mmHg)', isNumber: true },
      { key: 'vitalSignsHeartRate', label: 'Heart Rate (bpm)', isNumber: true },
      { key: 'vitalSignsRespiratoryRate', label: 'Respiratory Rate (breaths/min)', isNumber: true },
      { key: 'vitalSignsTemperature', label: 'Temperature (°C)', isNumber: true },
      { key: 'vitalSignsOxygenSaturation', label: 'SpO2 (%)', isNumber: true },
    ],
  },
  {
    title: 'Anthropometrics',
    fields: [
      { key: 'heightInCentimeters', label: 'Height (cm)', isNumber: true },
      { key: 'weightInKilograms', label: 'Weight (kg)', isNumber: true },
      { key: 'bodyMassIndex', label: 'BMI (kg/m²)', isNumber: true },
      { key: 'waistCircumference', label: 'Waist Circumference (cm)', isNumber: true },
    ],
  },
  {
    title: 'Sensory',
    fields: [
      { key: 'visualAcuityRight', label: 'Visual Acuity (Right)', isSentence: true },
      { key: 'visualAcuityLeft', label: 'Visual Acuity (Left)', isSentence: true },
      { key: 'hearingScreeningRight', label: 'Hearing Screening (Right)', isSentence: true },
      { key: 'hearingScreeningLeft', label: 'Hearing Screening (Left)', isSentence: true },
    ],
  },
  {
    title: 'Systems Exam',
    fields: [
      { key: 'cardiovascularExamination', label: 'Cardiovascular Examination', isSentence: true },
      { key: 'respiratoryExamination', label: 'Respiratory Examination', isSentence: true },
      { key: 'abdominalExamination', label: 'Abdominal Examination', isSentence: true },
      { key: 'neurologicalExamination', label: 'Neurological Examination', isSentence: true },
      { key: 'musculoskeletalExamination', label: 'Musculoskeletal Examination', isSentence: true },
      { key: 'skinExamination', label: 'Skin Examination', isSentence: true },
    ],
  },
  {
    title: 'Functional',
    fields: [
      { key: 'functionalStatusAssessment', label: 'Functional Status Assessment', isSentence: true },
      { key: 'fallRiskScreening', label: 'Fall Risk Screening', isSentence: true },
    ],
  },
  {
    title: 'Preventive & Orders',
    fields: [
      { key: 'immunizationsAdministered', label: 'Immunizations Administered', isArray: true },
      { key: 'preventiveScreeningsOrdered', label: 'Preventive Screenings Ordered', isArray: true },
      { key: 'laboratoryTestsOrdered', label: 'Laboratory Tests Ordered', isArray: true },
      { key: 'healthMaintenanceInterventions', label: 'Health Maintenance Interventions', isArray: true },
    ],
  },
  {
    title: 'History Review',
    fields: [
      { key: 'chronicConditionsReviewed', label: 'Chronic Conditions Reviewed', isArray: true },
      { key: 'medicationReconciliation', label: 'Medication Reconciliation', isArray: true },
      { key: 'familyHistoryUpdated', label: 'Family History Updated', isBoolean: true },
      { key: 'socialHistoryUpdated', label: 'Social History Updated', isBoolean: true },
    ],
  },
];

/* booleanUnit: schema=boolean, data may be Date sentinel -> Yes/No or date */
const booleanUnit = (label, value) => {
  const state = updatedFlagState(value);
  if (state === null) return null;
  const isMeaningfulDate = typeof value !== 'boolean' && typeof value !== 'number' && state === true;
  const display = isMeaningfulDate ? formatDate(value) : (state ? 'Yes' : 'No');
  return { label, rows: [<Text key="v" style={styles.fieldValue}>{display}</Text>] };
};

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return updatedFlagState(record[field.key]) !== null;
  return hasVal(record[field.key]);
};

/* fieldUnit: dispatch a field to its { label, rows } unit builder */
const fieldUnit = (record, field) => {
  const val = record[field.key];
  if (field.isDate) return dateUnit(field.label, val);
  if (field.isBoolean) return booleanUnit(field.label, val);
  if (field.isArray) return arrayUnit(field.label, val);
  if (field.isSentence) return sentenceUnit(field.label, val);
  return valueUnit(field.label, val);
};

/* ======= COMPONENT ======= */
const AnnualPhysicalExaminationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.annual_physical_examination) return Array.isArray(r.annual_physical_examination) ? r.annual_physical_examination : [r.annual_physical_examination];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.annual_physical_examination) return Array.isArray(dd.annual_physical_examination) ? dd.annual_physical_examination : [dd.annual_physical_examination]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Annual Physical Examination</Text>
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
          <Text style={styles.documentTitle}>Annual Physical Examination</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Annual Physical Examination ${index + 1}`}
              </Text>
              {hasVal(record.date) && (
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
              )}
            </View>

            {/* Sections — title-glue + flow so tall sections don't overprint (memory 6a3cda8c) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;
              const units = presentFields.map(f => fieldUnit(record, f)).filter(Boolean);
              if (units.length === 0) return null;
              return (
                <React.Fragment key={sIdx}>
                  {renderSectionFlow(sectionConfig.title, units)}
                </React.Fragment>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AnnualPhysicalExaminationDocumentPDFTemplate;
