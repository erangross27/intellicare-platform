/**
 * DialysisRecordsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialysis_records.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one session per page. Mirrors the JSX exactly — numeric fields
 * carry their unit, accessType shows canonical title-case, sentinel-zero numerics hidden (arterial
 * pressure is a legitimate NEGATIVE value and always shows), dialysateBath comma-split to numbered
 * rows, Complications single-name numbered rows. The JSX BP bar chart renders here as numbered text.
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

const FIELD_UNITS = {
  patientWeight: ' kg', dryWeight: ' kg', fluidRemovalGoal: ' mL', actualFluidRemoved: ' mL',
  bloodFlowRate: ' mL/min', dialysateFlowRate: ' mL/min', treatmentTime: ' min',
  ureReductionRatio: '%', heparinDose: ' units',
  systolicBloodPressurePre: ' mmHg', diastolicBloodPressurePre: ' mmHg',
  systolicBloodPressurePost: ' mmHg', diastolicBloodPressurePost: ' mmHg',
  venousPressure: ' mmHg', arterialPressure: ' mmHg', transmembranePressure: ' mmHg',
};
const fmtWithUnit = (fn, val) => { const unit = FIELD_UNITS[fn] || ''; return safeString(fmtVal(val)) + unit; };

/* Enum canonical title-case (mirror the JSX ENUM_FIELDS). */
const ENUM_FIELDS = {
  accessType: ['Arteriovenous Fistula', 'Arteriovenous Graft', 'Central Venous Catheter', 'Tunneled Dialysis Catheter', 'Peritoneal Catheter'],
};
const enumDisplay = (fn, val) => {
  const opts = ENUM_FIELDS[fn];
  const c = String(val ?? '').trim();
  if (!opts) return safeString(c);
  const hit = opts.find(o => o.toLowerCase() === c.toLowerCase());
  return safeString(hit || c);
};

/* hide-zero: no dialysis physiologic measurement has a clinically meaningful zero, so a 0 is a
   "not recorded" sentinel — hidden unless the doctor explicitly edited the field. Returns the
   numeric value when it should show, else null. (arterial pressure is negative, never 0-hidden.) */
const numberValuePDF = (record, fn) => {
  const val = record?.[fn];
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  if (num === 0) {
    const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
    if (!doctorEdited) return null;
  }
  return num;
};

const splitByCommaPDF = (text) => {
  if (!text || typeof text !== 'string') return [];
  const items = []; let depth = 0; let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
    else if (text[i] === ',' && depth === 0) { const item = text.substring(start, i).trim(); if (item) items.push(item); start = i + 1; }
  }
  const last = text.substring(start).trim(); if (last) items.push(last);
  return items;
};

const DialysisRecordsDocumentPDFTemplate = ({ records = [] }) => {
  const list = React.useMemo(() => {
    let arr = Array.isArray(records) ? records : [records];
    return arr.filter(r => r && typeof r === 'object');
  }, [records]);

  if (!list || list.length === 0) {
    return (
      <Document title="Dialysis Records">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Records</Text></View>
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
    const numG = (label, fn) => numberValuePDF(record, fn) !== null ? { label, values: [fmtWithUnit(fn, record[fn])] } : null;
    const enumG = (label, fn) => hasVal(record[fn]) ? { label, values: [enumDisplay(fn, record[fn])] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const boolG = (label, fn) => (record[fn] !== null && record[fn] !== undefined) ? { label, values: [fmtVal(record[fn])] } : null;

    const weightFluid = [numG('Patient Weight', 'patientWeight'), numG('Dry Weight', 'dryWeight'), numG('Fluid Removal Goal', 'fluidRemovalGoal'), numG('Actual Fluid Removed', 'actualFluidRemoved')].filter(Boolean);
    const treatment = [numG('Blood Flow Rate', 'bloodFlowRate'), numG('Dialysate Flow Rate', 'dialysateFlowRate'), numG('Treatment Time', 'treatmentTime')].filter(Boolean);
    const adequacy = [numG('Kt/V Ratio', 'ktVRatio'), numG('URR', 'ureReductionRatio')].filter(Boolean);
    const access = [enumG('Access Type', 'accessType'), strG('Access Site', 'accessSite'), boolG('Thrill Present', 'accessThrill'), boolG('Bruit Present', 'accessBruit')].filter(Boolean);
    const bloodPressure = [numG('Systolic Pre', 'systolicBloodPressurePre'), numG('Diastolic Pre', 'diastolicBloodPressurePre'), numG('Systolic Post', 'systolicBloodPressurePost'), numG('Diastolic Post', 'diastolicBloodPressurePost')].filter(Boolean);

    const bathItems = splitByCommaPDF(record.dialysateBath).map(safeString);
    const dialysate = [
      strG('Dialyzer Type', 'dialyzerType'),
      bathItems.length > 0 ? { label: 'Dialysate Bath', values: bathItems } : null,
      numG('Heparin Dose', 'heparinDose'),
    ].filter(Boolean);

    const pressures = [numG('Venous Pressure', 'venousPressure'), numG('Arterial Pressure', 'arterialPressure'), numG('Transmembrane Pressure', 'transmembranePressure')].filter(Boolean);

    const complications = (Array.isArray(record.complications) ? record.complications : []).filter(hasVal).map(c => safeString(fmtVal(c)));

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialysis Record ${idx + 1}`}</Text>
        </View>

        {renderGroups('Weight & Fluid', weightFluid, 'wf')}
        {renderGroups('Treatment', treatment, 'tr')}
        {renderGroups('Adequacy', adequacy, 'ad')}
        {renderGroups('Access', access, 'ac')}
        {renderGroups('Blood Pressure', bloodPressure, 'bp')}
        {renderGroups('Dialysate', dialysate, 'di')}
        {renderGroups('Pressures', pressures, 'pr')}

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
    <Document title="Dialysis Records">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Records</Text></View>
        {list.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialysisRecordsDocumentPDFTemplate;
