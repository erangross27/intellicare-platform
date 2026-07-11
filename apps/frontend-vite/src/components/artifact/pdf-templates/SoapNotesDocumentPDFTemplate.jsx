/**
 * SoapNotesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — SOAP notes
 * Collection: soap_notes
 * NO BLUE in field content — black/white only
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* NUMBER_FIELDS / MEANINGFUL_ZERO_FIELDS: mirror the UI. painScale 0 = "no pain" (valid 0-10 scale)
   is shown; glasgowComaScale 0 (GCS minimum is 3) and bodyMassIndex 0 (impossible) are sentinels,
   hidden as "not recorded" unless the doctor explicitly edited the field. */
const NUMBER_FIELDS = ['painScale', 'glasgowComaScale', 'bodyMassIndex'];
const MEANINGFUL_ZERO_FIELDS = ['painScale'];
const numberShowsPDF = (record, key) => {
  const val = record?.[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(key)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  /* PERIOD-FIRST splitting with semicolon fallback */
  const periodItems = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  if (periodItems.length > 1) return periodItems;
  const semiItems = text.split(/;\s*/).map(s => s.trim()).filter(s => s);
  if (semiItems.length > 1) return semiItems;
  return periodItems;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const hasOxfordComma = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /,\s+and\s+/i.test(text) || /,\s+or\s+/i.test(text);
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  if (hasOxfordComma(text)) return [text];
  const dateProtected = text.replace(/(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}),\s*(\d{4})/gi, '$1\x00$2');
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < dateProtected.length; i++) {
    const ch = dateProtected[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t.replace(/\x00/g, ', ')); current = ''; }
    else { current += ch; }
  }
  const last = current.trim(); if (last) result.push(last.replace(/\x00/g, ', '));
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  const showLabel = label;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{showLabel}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const showLabel = label;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

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

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{showLabel}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  const showLabel = label;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{showLabel}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS — presentFields pattern */
const SECTION_CONFIGS = [
  {
    title: 'Subjective — Chief Complaint',
    fields: [
      { key: 'chiefComplaint', label: 'Chief Complaint', isSentence: true },
    ],
  },
  {
    title: 'Subjective — History of Present Illness',
    fields: [
      { key: 'historyOfPresentIllness', label: 'History of Present Illness', isSentence: true },
    ],
  },
  {
    title: 'Subjective — History',
    fields: [
      { key: 'pastMedicalHistory', label: 'Past Medical History', isArray: true },
      { key: 'currentMedications', label: 'Current Medications', isArray: true },
      { key: 'allergies', label: 'Allergies', isArray: true },
      { key: 'socialHistory', label: 'Social History', isSentence: true },
      { key: 'familyHistory', label: 'Family History', isArray: true },
    ],
  },
  {
    title: 'Objective — Vital Signs',
    fields: [
      { key: 'vitalSigns', label: 'Vital Signs', isSentence: true },
      { key: 'painScale', label: 'Pain Scale' },
      { key: 'bodyMassIndex', label: 'Body Mass Index' },
      { key: 'glasgowComaScale', label: 'Glasgow Coma Scale' },
    ],
  },
  {
    title: 'Objective — Examination',
    fields: [
      { key: 'physicalExamination', label: 'Physical Examination', isSentence: true },
      { key: 'reviewOfSystems', label: 'Review of Systems', isSentence: true },
    ],
  },
  {
    title: 'Objective — Results',
    fields: [
      { key: 'laboratoryResults', label: 'Laboratory Results', isArray: true },
      { key: 'imagingStudies', label: 'Imaging Studies', isArray: true },
      { key: 'diagnosticTests', label: 'Diagnostic Tests', isArray: true },
    ],
  },
  {
    title: 'Assessment',
    fields: [
      { key: 'clinicalImpression', label: 'Clinical Impression', isSentence: true },
      { key: 'functionalStatus', label: 'Functional Status', isSentence: true },
      { key: 'riskFactors', label: 'Risk Factors', isArray: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'followUpInstructions', label: 'Follow-Up Instructions', isSentence: true },
      { key: 'patientEducation', label: 'Patient Education', isSentence: true },
    ],
  },
  {
    title: 'Coding',
    fields: [
      { key: 'icdTenCodes', label: 'ICD-10 Codes', isArray: true },
      { key: 'cptCodes', label: 'CPT Codes', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const SoapNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.soap_notes) return Array.isArray(r.soap_notes) ? r.soap_notes : [r.soap_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.soap_notes) return Array.isArray(dd.soap_notes) ? dd.soap_notes : [dd.soap_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>SOAP Notes</Text>
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
          <Text style={styles.documentTitle}>SOAP Notes</Text>
        </View>

        {records.map((record, index) => {
          /* presentFields pattern: check which fields have data */
          const presentFields = {};
          SECTION_CONFIGS.forEach(sc => {
            sc.fields.forEach(f => {
              presentFields[f.key] = NUMBER_FIELDS.includes(f.key) ? numberShowsPDF(record, f.key) : hasVal(record[f.key]);
            });
          });

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.date && (
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {`SOAP Note ${index + 1}`}
                </Text>
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const hasAnyVal = sectionConfig.fields.some(f => NUMBER_FIELDS.includes(f.key) ? numberShowsPDF(record, f.key) : hasVal(record[f.key]));
                if (!hasAnyVal) return null;

                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = record[field.key];
                      const label = field.label;
                      const showLabel = label;
                      if (NUMBER_FIELDS.includes(field.key)) {
                        if (!numberShowsPDF(record, field.key)) return null;
                        return <View key={fIdx}>{renderFieldRow(showLabel, val)}</View>;
                      }
                      if (!hasVal(val)) return null;

                      if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(showLabel, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(showLabel, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(showLabel, val)}</View>;
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SoapNotesDocumentPDFTemplate;
