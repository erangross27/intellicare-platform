/**
 * DialysisRunSheetsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialysis_run_sheets.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one run sheet per page. Mirrors the JSX exactly — units live in
 * the FIELD_LABELS ("Patient Weight (kg)"), so values are bare; vascularAccessType shows canonical
 * title-case; sentinel-zero numerics hidden except accessRecirculation (0% ideal) + heparinDose
 * (0 = heparin-free); arterialPressure is a legitimate NEGATIVE and always shows; dialysateBath
 * comma-split to numbered rows; Complications single-name numbered rows.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 6 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* Enum canonical title-case (mirror the JSX ENUM_FIELDS). */
const ENUM_FIELDS = {
  vascularAccessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
};
const enumDisplay = (fn, val) => {
  const opts = ENUM_FIELDS[fn];
  const c = String(val ?? '').trim();
  if (!opts) return safeString(c);
  const hit = opts.find(o => o.toLowerCase() === c.toLowerCase());
  return safeString(hit || c);
};

/* hide-zero: 0 is a real value only for accessRecirculation (0% ideal) + heparinDose (heparin-free);
   every other numeric 0 is a "not recorded" sentinel and hidden. Returns the number when it should
   show, else null. (arterial pressure is negative, never 0-hidden.) */
const MEANINGFUL_ZERO_FIELDS = new Set(['accessRecirculation', 'heparinDose']);
const numberValuePDF = (fn, v) => {
  if (v === null || v === undefined || v === '') return null;
  const num = Number(v);
  if (Number.isNaN(num)) return null;
  if (num === 0 && !MEANINGFUL_ZERO_FIELDS.has(fn)) return null;
  return num;
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result;
};

const DialysisRunSheetsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dialysis_run_sheets) return Array.isArray(r.dialysis_run_sheets) ? r.dialysis_run_sheets : [r.dialysis_run_sheets];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_run_sheets) return Array.isArray(dd.dialysis_run_sheets) ? dd.dialysis_run_sheets : [dd.dialysis_run_sheets]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dialysis Run Sheets">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Run Sheets</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const sectionTitle = (t) => <Text style={styles.sectionTitle}>{t}</Text>;

  /* One field group: (title) + sub-label + 0.5pt rule + numbered value rows. wrap is boolean. */
  const fieldGroup = (label, values, key, withTitle) => {
    if (!values || values.length === 0) return null;
    return (
      <View key={key} style={styles.fieldGroup} wrap={values.length > 8}>
        {withTitle}
        {label ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {values.map((v, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(v)}`}</Text>)}
      </View>
    );
  };

  /* Render a section from a list of {label, values[]} groups; sectionTitle rides inside the first. */
  const renderGroups = (title, groups, keyPrefix) => groups.length === 0 ? null : (
    <View style={styles.section}>
      {groups.map((g, i) => fieldGroup(g.label, g.values, `${keyPrefix}-${i}`, i === 0 ? sectionTitle(title) : null))}
    </View>
  );

  const renderRecord = (record, idx) => {
    // units are carried in the labels (e.g. "Patient Weight (kg)"), so values are bare numbers
    const numG = (label, fn) => numberValuePDF(fn, record[fn]) !== null ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const enumG = (label, fn) => hasVal(record[fn]) ? { label, values: [enumDisplay(fn, record[fn])] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const boolG = (label, fn) => (record[fn] !== null && record[fn] !== undefined) ? { label, values: [fmtVal(record[fn])] } : null;

    const weightFluid = [numG('Patient Weight (kg)', 'patientWeight'), numG('Dry Weight (kg)', 'dryWeight'), numG('Fluid Removal Goal (mL)', 'fluidRemovalGoal'), numG('Actual Fluid Removal (mL)', 'actualFluidRemoval')].filter(Boolean);
    const treatment = [numG('Treatment Time (min)', 'treatmentTime'), numG('Blood Flow Rate (mL/min)', 'bloodFlowRate'), numG('Dialysate Flow Rate (mL/min)', 'dialysateFlowRate'), numG('Heparin Dose (units)', 'heparinDose')].filter(Boolean);
    const bloodPressure = [strG('Pre-Dialysis BP', 'preDialysisBP'), strG('Post-Dialysis BP', 'postDialysisBP')].filter(Boolean);
    const adequacy = [numG('Kt/V Ratio', 'ktVRatio'), numG('Urea Reduction Ratio (%)', 'ureaReductionRatio'), numG('Clearance Goal', 'clearanceGoal')].filter(Boolean);
    const access = [enumG('Vascular Access Type', 'vascularAccessType'), boolG('Access Thrill', 'accessThrill'), boolG('Access Bruit', 'accessBruit'), numG('Access Recirculation (%)', 'accessRecirculation')].filter(Boolean);

    const bathItems = splitByComma(record.dialysateBath).map(safeString);
    const dialysate = [
      strG('Dialyzer Type', 'dialyzerType'),
      bathItems.length > 0 ? { label: 'Dialysate Bath', values: bathItems } : null,
      numG('Conductivity', 'conductivity'),
    ].filter(Boolean);

    const pressures = [numG('Transmembrane Pressure (mmHg)', 'transmembranePressure'), numG('Venous Pressure (mmHg)', 'venousPressure'), numG('Arterial Pressure (mmHg)', 'arterialPressure')].filter(Boolean);
    const machine = [strG('Machine Number', 'machineNumber')].filter(Boolean);
    const complications = (Array.isArray(record.complications) ? record.complications : []).filter(hasVal).map(c => safeString(fmtVal(c)));

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialysis Run Sheet ${idx + 1}`}</Text>
        </View>

        {renderGroups('Weight & Fluid', weightFluid, 'wf')}
        {renderGroups('Treatment Parameters', treatment, 'tp')}
        {renderGroups('Blood Pressure', bloodPressure, 'bp')}
        {renderGroups('Adequacy', adequacy, 'ad')}
        {renderGroups('Access', access, 'ac')}
        {renderGroups('Dialysate', dialysate, 'di')}
        {renderGroups('Pressures', pressures, 'pr')}
        {renderGroups('Machine Info', machine, 'mi')}

        {/* Complications — single-name (label == section title): numbered rows, no sub-label */}
        {complications.length > 0 && (
          <View style={styles.section}>
            {fieldGroup('', complications, 'cx', sectionTitle('Complications'))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document title="Dialysis Run Sheets">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Run Sheets</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialysisRunSheetsDocumentPDFTemplate;
