/**
 * BleedingRiskAssessmentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — bleeding risk assessment
 * Collection: bleeding_risk_assessment
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74 + section-overprint fix (6a2f7b67): the WHOLE section is ONE wrap-gated View
 * with the sectionTitle as its FIRST child; renderField receives null sectionTitle.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
// Built-in Helvetica lacks µ μ × ÷ ≥ ≤ → ° and superscript digits; a missing glyph renders as
// garbage AND eats the next space (memory 6a40999) — ASCII-map every PDF string. Superscripts →
// ^N so "Platelet Count (x10⁹/L)" → "Platelet Count (x10^9/L)" and "≥50,000/µL" → ">=50,000/uL".
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const pdfSafe = (s) => String(s == null ? '' : s)
  .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + m.replace(/./g, c => SUP[c] || ''))
  .replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/µ/g, 'u').replace(/μ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x')
  .replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return pdfSafe(val);
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

/* formatDate: locale date for date string fields, fallback to raw */
const formatDate = (v) => {
  if (v === null || v === undefined || v === '') return '';
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { /* fall through */ }
  return String(v);
};

/* MEANINGFUL_ZERO_FIELDS: total risk score where 0 is a valid clinical finding (e.g. HAS-BLED 0 = low risk) → always show when present */
const MEANINGFUL_ZERO_FIELDS = ['bleedingRiskScore'];

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited; meaningful-zero scores always show */
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

/* renderFieldRow: optional sectionTitle inside the View (Rule #74) */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{pdfSafe(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{pdfSafe(label)}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateRow: date string field formatted as locale date */
const renderDateRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{pdfSafe(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{pdfSafe(label)}</Text>
      <Text style={styles.fieldValue}>{pdfSafe(formatDate(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, sectionTitle) => {
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
      {sectionTitle && <Text style={styles.sectionTitle}>{pdfSafe(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{pdfSafe(label)}</Text>
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
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{pdfSafe(sectionTitle)}</Text>}
      <Text style={styles.fieldLabel}>{pdfSafe(label)}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Assessment Overview',
    fields: [
      { key: 'date', label: 'Assessment Date', isDate: true },
      { key: 'bleedingRiskScore', label: 'Bleeding Risk Score', isNumber: true },
      { key: 'riskCategory', label: 'Risk Category', isSentence: true },
      { key: 'assessmentTool', label: 'Assessment Tool', isSentence: true },
      { key: 'reassessmentDate', label: 'Reassessment Date', isDate: true },
    ],
  },
  {
    title: 'Anticoagulation',
    fields: [
      { key: 'anticoagulantTherapy', label: 'Anticoagulant Therapy', isArray: true },
      { key: 'indicationForAnticoagulation', label: 'Indication for Anticoagulation', isSentence: true },
      { key: 'concomitantMedications', label: 'Concomitant Medications', isArray: true },
    ],
  },
  {
    title: 'Bleeding Risk Factors',
    fields: [
      { key: 'hypertensionUncontrolled', label: 'Uncontrolled Hypertension', isBoolean: true },
      { key: 'renalDysfunction', label: 'Renal Dysfunction', isBoolean: true },
      { key: 'liverDysfunction', label: 'Liver Dysfunction', isBoolean: true },
      { key: 'priorMajorBleeding', label: 'Prior Major Bleeding', isBoolean: true },
      { key: 'priorBleedingDetails', label: 'Prior Bleeding Details', isSentence: true },
      { key: 'strokeHistory', label: 'Stroke History', isBoolean: true },
      { key: 'labileInr', label: 'Labile INR', isBoolean: true },
      { key: 'ageRiskFactor', label: 'Age Risk Factor (>65)', isBoolean: true },
      { key: 'alcoholAbuse', label: 'Alcohol Abuse', isBoolean: true },
      { key: 'fallRisk', label: 'Fall Risk', isBoolean: true },
    ],
  },
  {
    title: 'Laboratory Values',
    fields: [
      { key: 'creatinineClearance', label: 'Creatinine Clearance (mL/min)', isNumber: true },
      { key: 'currentInr', label: 'Current INR', isNumber: true },
      { key: 'plateletCount', label: 'Platelet Count (x10⁹/L)', isNumber: true },
      { key: 'thrombocytopenia', label: 'Thrombocytopenia', isBoolean: true },
      { key: 'anemiaPresent', label: 'Anemia Present', isBoolean: true },
      { key: 'hemoglobinLevel', label: 'Hemoglobin (g/dL)', isNumber: true },
    ],
  },
  {
    title: 'Mitigation & Notes',
    fields: [
      { key: 'mitigationStrategies', label: 'Mitigation Strategies', isArray: true },
      { key: 'geneticFactors', label: 'Genetic Factors', isSentence: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isDate) return <View key={key}>{renderDateRow(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const BleedingRiskAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.bleeding_risk_assessment) return Array.isArray(r.bleeding_risk_assessment) ? r.bleeding_risk_assessment : [r.bleeding_risk_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bleeding_risk_assessment) return Array.isArray(dd.bleeding_risk_assessment) ? dd.bleeding_risk_assessment : [dd.bleeding_risk_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Bleeding Risk Assessment</Text>
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
          <Text style={styles.documentTitle}>Bleeding Risk Assessment</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Bleeding Risk Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections — whole section is one wrap-gated View, title as first child (Rule #74 + overprint fix) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{pdfSafe(sectionConfig.title)}</Text>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, null, fIdx)
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BleedingRiskAssessmentDocumentPDFTemplate;
