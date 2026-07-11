/**
 * BoneMarrowTransplantEvaluationDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — bone marrow transplant evaluation
 * Collection: bone_marrow_transplant_evaluation
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: each section is ONE wrap-gated View with sectionTitle as its FIRST child.
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

/* renderFieldRow: plain field (no section title — section owns it per Rule #74) */
const renderFieldRow = (label, value, key) => {
  if (!hasVal(value)) return null;
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, key) => {
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

  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
const renderArrayFieldPDF = (label, items, key) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'HLA & Donor Matching',
    fields: [
      { key: 'donorHlaTyping', label: 'Donor HLA Typing', isSentence: true },
      { key: 'recipientHlaTyping', label: 'Recipient HLA Typing', isSentence: true },
      { key: 'hlaMatchGrade', label: 'HLA Match Grade', isSentence: true },
      { key: 'dsaMeanFluorescenceIntensity', label: 'DSA MFI', isNumber: true },
      { key: 'donorSpecificAntibodies', label: 'Donor-Specific Antibodies', isBoolean: true },
    ],
  },
  {
    title: 'Risk Scores (HCT-CI/KPS/DRI)',
    fields: [
      { key: 'hctCiComorbidityScore', label: 'HCT-CI Score', isNumber: true },
      { key: 'karnofskyPerformanceStatus', label: 'Karnofsky Performance Status', isNumber: true },
      { key: 'diseaseRiskIndex', label: 'Disease Risk Index', isSentence: true },
    ],
  },
  {
    title: 'Disease Status (Blast%/MRD)',
    fields: [
      { key: 'bonemarrowBlastPercentage', label: 'Blast %', isNumber: true },
      { key: 'pretransplantChimerismBaseline', label: 'Pre-Transplant Chimerism Baseline', isSentence: true },
      { key: 'minimalResidualDisease', label: 'Minimal Residual Disease', isSentence: true },
      { key: 'mrdSensitivityLevel', label: 'MRD Sensitivity Level', isSentence: true },
    ],
  },
  {
    title: 'Organ Function',
    fields: [
      { key: 'cardiacEjectionFraction', label: 'Cardiac EF (%)', isNumber: true },
      { key: 'pulmonaryDlcoPercentPredicted', label: 'DLCO (% predicted)', isNumber: true },
      { key: 'fev1PercentPredicted', label: 'FEV1 (% predicted)', isNumber: true },
      { key: 'hepaticFunctionAssessment', label: 'Hepatic Function Assessment', isSentence: true },
      { key: 'renalGfrPreTransplant', label: 'Pre-Transplant GFR (mL/min/1.73m²)', isNumber: true },
      { key: 'serumFerritinLevel', label: 'Serum Ferritin (ng/mL)', isNumber: true },
    ],
  },
  {
    title: 'Conditioning & Graft',
    fields: [
      { key: 'conditioningRegimenIntensity', label: 'Conditioning Regimen Intensity', isSentence: true },
      { key: 'stemCellSource', label: 'Stem Cell Source', isSentence: true },
      { key: 'targetCd34DosePerKg', label: 'Target CD34 Dose (×10⁶/kg)', isNumber: true },
      { key: 'donorKirHaplotype', label: 'Donor KIR Haplotype', isSentence: true },
      { key: 'gvhdProphylaxisRegimen', label: 'GVHD Prophylaxis Regimen', isSentence: true },
    ],
  },
  {
    title: 'Serostatus (CMV/EBV)',
    fields: [
      { key: 'cmvSerostatus', label: 'CMV Serostatus', isSentence: true },
      { key: 'ebvSerostatus', label: 'EBV Serostatus', isSentence: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.isArray) return renderArrayFieldPDF(field.label, val, key);
  if (field.isSentence) return renderSentenceSection(field.label, val, key);
  return renderFieldRow(field.label, val, key);
};

/* ======= COMPONENT ======= */
const BoneMarrowTransplantEvaluationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.bone_marrow_transplant_evaluation) return Array.isArray(r.bone_marrow_transplant_evaluation) ? r.bone_marrow_transplant_evaluation : [r.bone_marrow_transplant_evaluation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_marrow_transplant_evaluation) return Array.isArray(dd.bone_marrow_transplant_evaluation) ? dd.bone_marrow_transplant_evaluation : [dd.bone_marrow_transplant_evaluation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Bone Marrow Transplant Evaluation</Text>
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
          <Text style={styles.documentTitle}>Bone Marrow Transplant Evaluation</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Bone Marrow Transplant Evaluation ${index + 1}`}
              </Text>
            </View>

            {/* Sections — each section is ONE wrap-gated View with sectionTitle as FIRST child (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, fIdx)
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

export default BoneMarrowTransplantEvaluationDocumentPDFTemplate;
