/**
 * PreEmploymentPhysicalDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — pre-employment physical
 * Collection: pre_employment_physical
 * Date rendered in-section (Employment Information) off the real clinical record.date, never createdAt.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArray = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ═══ FIELD-TYPE MAPS (mirror the JSX) ═══ */
const DATE_KEYS = ['date', 'certificationExpirationDate'];
const BOOLEAN_KEYS = ['drugScreenRequired', 'respiratorClearance', 'dotPhysicalCompliant'];
const NUMBER_KEYS = ['bodyMassIndex'];
const ARRAY_KEYS = ['jobPhysicalDemands', 'workRestrictions', 'immunizationStatus', 'hazardousExposureHistory', 'chronicConditionsDisclosed'];

/* renderStringField: mirror JSX — single value renders plain; multi-sentence renders numbered
   (labeled sentence with a comma-list → sub-label + numbered comma items), single running counter. */
const renderStringField = (label, text) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    const rows = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const items = splitByComma(parsed.value);
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        if (items.length >= 2) {
          items.forEach(ci => rows.push({ type: 'item', text: safeString(ci), num: n++ }));
        } else {
          rows.push({ type: 'item', text: safeString(parsed.value), num: n++ });
        }
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    });
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {rows.map((row, i) => row.type === 'subtitle'
          ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
          : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
      </View>
    );
  }
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
    </View>
  );
};

/* renderField: dispatch by field type; returns a bare-label fieldBox element (or null). */
const renderField = (record, field) => {
  const { key, label } = field;
  const val = record[key];
  if (DATE_KEYS.includes(key)) {
    if (!hasVal(val)) return null;
    return (<View style={styles.fieldBox}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{formatDate(val)}</Text></View>);
  }
  if (BOOLEAN_KEYS.includes(key)) {
    if (!hasVal(val)) return null;
    return (<View style={styles.fieldBox}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text></View>);
  }
  if (NUMBER_KEYS.includes(key)) {
    if (!hasVal(val)) return null;
    return (<View style={styles.fieldBox}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text></View>);
  }
  if (ARRAY_KEYS.includes(key)) {
    const items = safeArray(val);
    if (!items.length) return null;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
      </View>
    );
  }
  return renderStringField(label, val);
};

/* SECTION CONFIGS — 7 sections mirroring the JSX SECTION_FIELDS */
const SECTION_CONFIGS = [
  { title: 'Employment Information', fields: [
    { key: 'date', label: 'Date' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'employerName', label: 'Employer Name' },
    { key: 'examiningPhysician', label: 'Examining Physician' },
    { key: 'certificationExpirationDate', label: 'Certification Expiration Date' },
  ] },
  { title: 'Clearance Status', fields: [
    { key: 'medicalClearanceStatus', label: 'Medical Clearance Status' },
    { key: 'workRestrictions', label: 'Work Restrictions' },
    { key: 'accommodationsRequired', label: 'Accommodations Required' },
    { key: 'dotPhysicalCompliant', label: 'DOT Physical Compliant' },
  ] },
  { title: 'Screenings', fields: [
    { key: 'drugScreenRequired', label: 'Drug Screen Required' },
    { key: 'drugScreenResult', label: 'Drug Screen Result' },
    { key: 'tuberculosisScreening', label: 'Tuberculosis Screening' },
  ] },
  { title: 'Physical Assessment', fields: [
    { key: 'bloodPressureReading', label: 'Blood Pressure Reading' },
    { key: 'bodyMassIndex', label: 'Body Mass Index' },
    { key: 'musculoskeletalExam', label: 'Musculoskeletal Exam' },
    { key: 'liftingCapacity', label: 'Lifting Capacity' },
    { key: 'cardiovascularFitness', label: 'Cardiovascular Fitness' },
  ] },
  { title: 'Sensory Evaluation', fields: [
    { key: 'hearingAcuityTest', label: 'Hearing Acuity Test' },
    { key: 'visionAcuityTest', label: 'Vision Acuity Test' },
  ] },
  { title: 'Respiratory Evaluation', fields: [
    { key: 'respiratoryFitTest', label: 'Respiratory Fit Test' },
    { key: 'respiratorClearance', label: 'Respirator Clearance' },
  ] },
  { title: 'Medical History', fields: [
    { key: 'jobPhysicalDemands', label: 'Job Physical Demands' },
    { key: 'chronicConditionsDisclosed', label: 'Chronic Conditions Disclosed' },
    { key: 'hazardousExposureHistory', label: 'Hazardous Exposure History' },
    { key: 'immunizationStatus', label: 'Immunization Status' },
  ] },
];

/* renderSection: anti-orphan glue — section title + first visible field ride together in a
   wrap={false} View so a title never orphans at a page break; remaining fields flow after. */
const renderSection = (sectionConfig, record, sIdx) => {
  const elements = sectionConfig.fields.map(f => renderField(record, f)).filter(Boolean);
  if (!elements.length) return null;
  const [first, ...rest] = elements;
  return (
    <View key={sIdx} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

const PreEmploymentPhysicalDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pre_employment_physical && Array.isArray(data.pre_employment_physical)) {
    records = data.pre_employment_physical;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pre_employment_physical) {
      records = docData.pre_employment_physical;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Pre-Employment Physical</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pre-Employment Physical</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>{`Pre-Employment Physical ${idx + 1}`}</Text>
            </View>
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => renderSection(sectionConfig, record, sIdx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreEmploymentPhysicalDocumentPDFTemplate;
