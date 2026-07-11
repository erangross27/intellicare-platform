/**
 * LungTransplantFollowUpDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — lung transplant follow-up
 * Collection: lung_transplant_follow_up
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
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

/* MEANINGFUL_ZERO_FIELDS: numerics where 0 is a real GOOD-NEWS clinical result (undetectable CMV/EBV viral load,
   cPRA 0% unsensitized, negative Aspergillus galactomannan, off-MMF / steroid-free dose, 0 L supplemental O2 =
   room air) — stay visible at 0. Mirrors JSX. */
const MEANINGFUL_ZERO_FIELDS = ['calculatedPanelReactiveAntibody', 'mycophenolateDose', 'prednisoneMaintenanceDose', 'cmvViralLoadCopies', 'ebvViralLoadCopies', 'aspirgillusGalactomannanIndex', 'supplementalOxygenRequirement'];

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

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
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
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
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
    title: 'Transplant Information',
    fields: [
      { key: 'postTransplantDay', label: 'Post-Transplant Day', isNumber: true },
      { key: 'transplantType', label: 'Transplant Type', isSentence: true },
    ],
  },
  {
    title: 'Graft Function',
    fields: [
      { key: 'spirometryFev1Liters', label: 'Spirometry FEV1 (Liters)', isNumber: true },
      { key: 'fev1PercentPredicted', label: 'FEV1 Percent Predicted', isNumber: true },
      { key: 'baselineFev1PostTransplant', label: 'Baseline FEV1 Post-Transplant', isNumber: true },
      { key: 'primaryGraftDysfunctionGrade', label: 'Primary Graft Dysfunction Grade', isSentence: true },
      { key: 'sixMinuteWalkDistance', label: 'Six-Minute Walk Distance', isNumber: true },
      { key: 'supplementalOxygenRequirement', label: 'Supplemental Oxygen Requirement', isNumber: true },
    ],
  },
  {
    title: 'Rejection',
    fields: [
      { key: 'cladStage', label: 'CLAD Stage', isSentence: true },
      { key: 'cladPhenotype', label: 'CLAD Phenotype', isSentence: true },
      { key: 'acuteRejectionGrade', label: 'Acute Rejection Grade', isSentence: true },
      { key: 'antibodyMediatedRejectionStatus', label: 'Antibody-Mediated Rejection Status', isSentence: true },
    ],
  },
  {
    title: 'Immunology',
    fields: [
      { key: 'donorSpecificAntibodies', label: 'Donor-Specific Antibodies', isArray: true },
      { key: 'calculatedPanelReactiveAntibody', label: 'Calculated Panel Reactive Antibody', isNumber: true },
    ],
  },
  {
    title: 'Immunosuppression',
    fields: [
      { key: 'tacrolimusTroughLevel', label: 'Tacrolimus Trough Level', isNumber: true },
      { key: 'cyclosporineTroughLevel', label: 'Cyclosporine Trough Level', isNumber: true },
      { key: 'mycophenolateDose', label: 'Mycophenolate Dose', isNumber: true },
      { key: 'prednisoneMaintenanceDose', label: 'Prednisone Maintenance Dose', isNumber: true },
    ],
  },
  {
    title: 'Infections',
    fields: [
      { key: 'cmvViralLoadCopies', label: 'CMV Viral Load (Copies)', isNumber: true },
      { key: 'ebvViralLoadCopies', label: 'EBV Viral Load (Copies)', isNumber: true },
      { key: 'aspirgillusGalactomannanIndex', label: 'Aspergillus Galactomannan Index', isNumber: true },
    ],
  },
  {
    title: 'Bronchoscopy',
    fields: [
      { key: 'bronchoscopyDate', label: 'Bronchoscopy Date', isDate: true },
      { key: 'balCellularAnalysis', label: 'BAL Cellular Analysis', isSentence: true },
    ],
  },
  {
    title: 'Complications',
    fields: [
      { key: 'anastomoticComplication', label: 'Anastomotic Complication', isSentence: true },
      { key: 'gastroesophagealRefluxStatus', label: 'Gastroesophageal Reflux Status', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const LungTransplantFollowUpDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.lung_transplant_follow_up) return Array.isArray(r.lung_transplant_follow_up) ? r.lung_transplant_follow_up : [r.lung_transplant_follow_up];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.lung_transplant_follow_up) return Array.isArray(dd.lung_transplant_follow_up) ? dd.lung_transplant_follow_up : [dd.lung_transplant_follow_up]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Lung Transplant Follow-Up</Text>
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
          <Text style={styles.documentTitle}>Lung Transplant Follow-Up</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {record.transplantType || `Lung Transplant Follow-Up ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => f.isNumber ? numberShowsPDF(record, f.key) : hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (field.isNumber ? !numberShowsPDF(record, field.key) : !hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default LungTransplantFollowUpDocumentPDFTemplate;
