/**
 * HeartTransplantFollowUpDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — heart transplant follow-up
 * Collection: heart_transplant_follow_up
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
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
  recordMeta: { fontSize: 10, color: '#333333', marginTop: 3 },
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

/* MEANINGFUL_ZERO_FIELDS: numerics where 0 is a real clinical result (steroid-free / off-MMF, undetectable
   CMV/EBV viral load, cPRA 0% unsensitized, dd-cfDNA 0% no rejection) — stay visible at 0. Mirrors JSX. */
const MEANINGFUL_ZERO_FIELDS = ['mycophenolateDose', 'prednisoneMaintenanceDose', 'calculatedPanelReactiveAntibody', 'cmvViralLoad', 'ebvViralLoad', 'donorDerivedCellFreeDna'];

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

/* renderFieldRow: optional sectionTitle inside the View (Rule #74) */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
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
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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
    title: 'Transplant & Donor',
    fields: [
      { key: 'transplantDate', label: 'Transplant Date', isDate: true },
      { key: 'daysPostTransplant', label: 'Days Post-Transplant', isNumber: true },
      { key: 'donorAge', label: 'Donor Age (years)', isNumber: true },
      { key: 'donorCauseOfDeath', label: 'Donor Cause of Death', isSentence: true },
      { key: 'coldIschemiaTime', label: 'Cold Ischemia Time (min)', isNumber: true },
    ],
  },
  {
    title: 'Rejection Surveillance',
    fields: [
      { key: 'endomyocardialBiopsyDate', label: 'Endomyocardial Biopsy Date', isDate: true },
      { key: 'ishltRejectionGrade', label: 'ISHLT Rejection Grade', isSentence: true },
      { key: 'antibodyMediatedRejectionGrade', label: 'Antibody-Mediated Rejection Grade', isSentence: true },
      { key: 'allograftDysfunctionScore', label: 'Allograft Dysfunction Score', isNumber: true },
    ],
  },
  {
    title: 'Graft Function',
    fields: [
      { key: 'leftVentricularEjectionFraction', label: 'LVEF (%)', isNumber: true },
      { key: 'rightVentricularFunction', label: 'Right Ventricular Function', isSentence: true },
      { key: 'tricuspidRegurgitationVelocity', label: 'Tricuspid Regurgitation Velocity (m/s)', isNumber: true },
    ],
  },
  {
    title: 'Immunosuppression',
    fields: [
      { key: 'tacrolimusTroughLevel', label: 'Tacrolimus Trough (ng/mL)', isNumber: true },
      { key: 'cyclosporineC2Level', label: 'Cyclosporine C2 Level (ng/mL)', isNumber: true },
      { key: 'mycophenolateDose', label: 'Mycophenolate Dose (mg/day)', isNumber: true },
      { key: 'prednisoneMaintenanceDose', label: 'Prednisone Maintenance Dose (mg/day)', isNumber: true },
    ],
  },
  {
    title: 'Infection Surveillance',
    fields: [
      { key: 'cmvViralLoad', label: 'CMV Viral Load (copies/mL)', isNumber: true },
      { key: 'ebvViralLoad', label: 'EBV Viral Load (copies/mL)', isNumber: true },
      { key: 'bkVirusScreening', label: 'BK Virus Screening', isSentence: true },
      { key: 'calculatedPanelReactiveAntibody', label: 'Calculated PRA (%)', isNumber: true },
      { key: 'donorSpecificAntibodies', label: 'Donor-Specific Antibodies', isArray: true },
    ],
  },
  {
    title: 'Allograft Vasculopathy',
    fields: [
      { key: 'coronaryAngiographyDate', label: 'Coronary Angiography Date', isDate: true },
      { key: 'cardiacAllograftVasculopathyGrade', label: 'Cardiac Allograft Vasculopathy Grade', isSentence: true },
      { key: 'maximalIntimalThickness', label: 'Maximal Intimal Thickness (mm)', isNumber: true },
    ],
  },
  {
    title: 'Functional & Biomarkers',
    fields: [
      { key: 'nyhaFunctionalClass', label: 'NYHA Functional Class', isSentence: true },
      { key: 'sixMinuteWalkDistance', label: 'Six-Minute Walk Distance (m)', isNumber: true },
      { key: 'estimatedGfrCkdEpi', label: 'eGFR CKD-EPI (mL/min/1.73m²)', isNumber: true },
      { key: 'bnpLevel', label: 'BNP Level (pg/mL)', isNumber: true },
      { key: 'ntProBnpLevel', label: 'NT-proBNP Level (pg/mL)', isNumber: true },
      { key: 'donorDerivedCellFreeDna', label: 'dd-cfDNA (%)', isNumber: true },
    ],
  },
];

/* field presence respecting hide-zero */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isDate) return <View key={key}>{renderDateFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const HeartTransplantFollowUpDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.heart_transplant_follow_up) return Array.isArray(r.heart_transplant_follow_up) ? r.heart_transplant_follow_up : [r.heart_transplant_follow_up];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.heart_transplant_follow_up) return Array.isArray(dd.heart_transplant_follow_up) ? dd.heart_transplant_follow_up : [dd.heart_transplant_follow_up]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Heart Transplant Follow-Up</Text>
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
          <Text style={styles.documentTitle}>Heart Transplant Follow-Up</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Heart Transplant Follow-Up ${index + 1}`}
              </Text>
              {hasVal(record.patientId) && (
                <Text style={styles.recordMeta}>Patient ID: {safeString(record.patientId)}</Text>
              )}
            </View>

            {/* Sections — sectionTitle rendered inside the first present field (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
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

export default HeartTransplantFollowUpDocumentPDFTemplate;
