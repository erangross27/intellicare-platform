/**
 * DialysisPrescriptionDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialysis_prescription.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — numeric fields
 * carry their unit, enum fields (modality/vascular access) show the canonical title-case, sentinel-zero
 * numerics hidden except K-free/Ca-free bath + heparin-free (MEANINGFUL_ZERO_FIELDS).
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

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const FIELD_UNITS = {
  treatmentFrequency: ' sessions/week',
  sessionDurationMinutes: ' minutes',
  ultrafiltrationGoalMl: ' mL',
  bloodFlowRateMlMin: ' mL/min',
  dialysateFlowRateMlMin: ' mL/min',
  dryWeightKg: ' kg',
  dialysateSodiumMeqL: ' mEq/L',
  dialysatePotassiumMeqL: ' mEq/L',
  dialysateCalciumMeqL: ' mEq/L',
  dialysateBicarbonateLevel: ' mEq/L',
  heparinDoseUnits: ' units',
  temperatureControlCelsius: ' deg C',
  erythropoietinDoseUnits: ' units',
  ironSupplementationMg: ' mg',
  vitaminDAnalogDose: ' mcg',
};
const fmtWithUnit = (fn, val) => { const unit = FIELD_UNITS[fn] || ''; return safeString(fmtVal(val)) + unit; };

/* Enum canonical title-case (mirror the JSX ENUM_FIELDS). */
const ENUM_FIELDS = {
  dialysisModalityType: ['Hemodialysis', 'Peritoneal Dialysis', 'Hemodiafiltration', 'Hemofiltration'],
  vascularAccessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
};
const enumDisplay = (fn, val) => {
  const opts = ENUM_FIELDS[fn];
  const c = String(val ?? '').trim();
  if (!opts) return safeString(c);
  const hit = opts.find(o => o.toLowerCase() === c.toLowerCase());
  return safeString(hit || c);
};

/* Sentinel-zero: potassium/calcium 0 = K-free/Ca-free bath, heparin 0 = heparin-free protocol are
   real prescriptions; every other numeric 0 is a "not recorded" sentinel and hidden. */
const NUMBER_FIELDS = new Set(['treatmentFrequency', 'sessionDurationMinutes', 'ultrafiltrationGoalMl', 'bloodFlowRateMlMin', 'dialysateFlowRateMlMin', 'dryWeightKg', 'dialysateSodiumMeqL', 'dialysatePotassiumMeqL', 'dialysateCalciumMeqL', 'dialysateBicarbonateLevel', 'heparinDoseUnits', 'targetKtVRatio', 'temperatureControlCelsius', 'erythropoietinDoseUnits', 'ironSupplementationMg', 'vitaminDAnalogDose']);
const MEANINGFUL_ZERO_FIELDS = new Set(['dialysatePotassiumMeqL', 'dialysateCalciumMeqL', 'heparinDoseUnits']);
const numHasVal = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (Number.isNaN(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO_FIELDS.has(fn);
  return true;
};

const DialysisPrescriptionDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dialysis_prescription) return Array.isArray(r.dialysis_prescription) ? r.dialysis_prescription : [r.dialysis_prescription];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_prescription) return Array.isArray(dd.dialysis_prescription) ? dd.dialysis_prescription : [dd.dialysis_prescription]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dialysis Prescription">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Prescription</Text></View>
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
    const numG = (label, fn) => numHasVal(fn, record[fn]) ? { label, values: [fmtWithUnit(fn, record[fn])] } : null;
    const enumG = (label, fn) => hasVal(record[fn]) ? { label, values: [enumDisplay(fn, record[fn])] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const boolG = (label, fn) => hasVal(record[fn]) ? { label, values: [fmtVal(record[fn])] } : null;

    const treatment = [enumG('Dialysis Modality', 'dialysisModalityType'), numG('Treatment Frequency', 'treatmentFrequency'), numG('Session Duration', 'sessionDurationMinutes')].filter(Boolean);
    const flow = [numG('Ultrafiltration Goal', 'ultrafiltrationGoalMl'), numG('Blood Flow Rate', 'bloodFlowRateMlMin'), numG('Dialysate Flow Rate', 'dialysateFlowRateMlMin')].filter(Boolean);
    const dialyzer = [strG('Dialyzer Type', 'dialyzerType'), enumG('Vascular Access Type', 'vascularAccessType'), numG('Dry Weight', 'dryWeightKg')].filter(Boolean);
    const composition = [numG('Sodium', 'dialysateSodiumMeqL'), numG('Potassium', 'dialysatePotassiumMeqL'), numG('Calcium', 'dialysateCalciumMeqL'), numG('Bicarbonate', 'dialysateBicarbonateLevel')].filter(Boolean);
    const anticoag = [numG('Heparin Dose', 'heparinDoseUnits')].filter(Boolean);
    const targets = [numG('Target Kt/V Ratio', 'targetKtVRatio'), numG('Temperature Control', 'temperatureControlCelsius')].filter(Boolean);
    const profiling = [boolG('Sodium Profiling', 'sodiumProfiling'), boolG('Ultrafiltration Profiling', 'ultrafiltrationProfiling')].filter(Boolean);

    const binders = (Array.isArray(record.phosphorusBinders) ? record.phosphorusBinders : []).filter(hasVal).map(b => safeString(fmtVal(b)));
    const medications = [
      binders.length > 0 ? { label: 'Phosphorus Binders', values: binders } : null,
      numG('Erythropoietin Dose', 'erythropoietinDoseUnits'),
      numG('Iron Supplementation', 'ironSupplementationMg'),
      numG('Vitamin D Analog Dose', 'vitaminDAnalogDose'),
    ].filter(Boolean);

    const residual = [boolG('Residual Renal Function', 'residualRenalFunction')].filter(Boolean);

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialysis Prescription ${idx + 1}`}</Text>
        </View>

        {renderGroups('Treatment Parameters', treatment, 'tp')}
        {renderGroups('Flow Rates', flow, 'fr')}
        {renderGroups('Dialyzer & Access', dialyzer, 'da')}
        {renderGroups('Dialysate Composition', composition, 'dc')}
        {renderGroups('Anticoagulation', anticoag, 'ac')}
        {renderGroups('Targets', targets, 'tg')}
        {renderGroups('Profiling', profiling, 'pf')}
        {renderGroups('Medications', medications, 'md')}
        {renderGroups('Residual Function', residual, 'rf')}
      </View>
    );
  };

  return (
    <Document title="Dialysis Prescription">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Prescription</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialysisPrescriptionDocumentPDFTemplate;
