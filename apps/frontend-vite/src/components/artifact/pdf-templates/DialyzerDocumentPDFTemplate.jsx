/**
 * DialyzerDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialyzer.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one dialyzer per page. Mirrors the JSX exactly — units live in
 * the FIELD_LABELS ("Surface Area (m2)"), so values are bare; sentinel-zero numerics hidden except
 * maximumReuseNumber (0 = single-use) + backfiltrationRate (0 = none). Record title = "Dialyzer N"
 * (the model shows in its Dialyzer Information section, not as the title).
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

/* hide-zero: 0 is real only for maximumReuseNumber (single-use) + backfiltrationRate (none); every
   other numeric 0 is a "not recorded" sentinel and hidden. Returns the number when it should show. */
const MEANINGFUL_ZERO_FIELDS = new Set(['maximumReuseNumber', 'backfiltrationRate']);
const numberValuePDF = (record, fn) => {
  const v = record?.[fn];
  if (v === null || v === undefined || v === '') return null;
  const num = Number(v);
  if (Number.isNaN(num)) return null;
  if (num === 0 && !MEANINGFUL_ZERO_FIELDS.has(fn)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn) ? num : null;
  }
  return num;
};

const DialyzerDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dialyzer) return Array.isArray(r.dialyzer) ? r.dialyzer : [r.dialyzer];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialyzer) return Array.isArray(dd.dialyzer) ? dd.dialyzer : [dd.dialyzer]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dialyzer">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialyzer</Text></View>
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
    // units are carried in the labels, so values are bare
    const numG = (label, fn) => numberValuePDF(record, fn) !== null ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const boolG = (label, fn) => (record[fn] !== null && record[fn] !== undefined) ? { label, values: [fmtVal(record[fn])] } : null;

    const info = [strG('Dialyzer Model', 'dialyzerModel'), strG('Membrane Type', 'membraneType')].filter(Boolean);
    const clearance = [numG('Clearance - Urea (mL/min)', 'clearanceUrea'), numG('Clearance - Creatinine (mL/min)', 'clearanceCreatinine'), numG('Clearance - Phosphate (mL/min)', 'clearancePhosphate'), numG('Clearance - Beta-2 Microglobulin (mL/min)', 'clearanceBeta2Microglobulin')].filter(Boolean);
    const physical = [numG('Surface Area (m2)', 'surfaceArea'), numG('Ultrafiltration Coefficient (mL/h/mmHg)', 'ultrafiltrationCoefficient'), numG('Prime Volume (mL)', 'primeVolume'), numG('Blood Compartment Volume (mL)', 'bloodCompartmentVolume'), numG('Max Transmembrane Pressure (mmHg)', 'maxTransmembranePressure')].filter(Boolean);
    const steril = [strG('Sterilization Method', 'sterilizationMethod'), strG('Biocompatibility Grade', 'biocompatibilityGrade')].filter(Boolean);
    const performance = [numG('Sieve Coefficient', 'sieveCoefficient'), numG('Endotoxin Retention', 'endotoxinRetention'), numG('Protein Leakage (g/treatment)', 'proteinLeakage'), boolG('Convective Transport', 'convectiveTransport'), numG('Backfiltration Rate (mL/min)', 'backfiltrationRate')].filter(Boolean);
    const reuse = [boolG('Reuse Capability', 'reuseCapability'), numG('Maximum Reuse Number', 'maximumReuseNumber')].filter(Boolean);

    const gauges = (Array.isArray(record.needleGaugeCompatibility) ? record.needleGaugeCompatibility : []).filter(hasVal).map(g => safeString(fmtVal(g)));
    const compatibility = [
      gauges.length > 0 ? { label: 'Needle Gauge Compatibility', values: gauges } : null,
      numG('KDOQI Adequacy Target', 'kdoqiAdequacyTarget'),
    ].filter(Boolean);

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialyzer ${idx + 1}`}</Text>
        </View>

        {renderGroups('Dialyzer Information', info, 'di')}
        {renderGroups('Clearance Rates', clearance, 'cl')}
        {renderGroups('Physical Properties', physical, 'ph')}
        {renderGroups('Sterilization & Biocompatibility', steril, 'sb')}
        {renderGroups('Performance', performance, 'pf')}
        {renderGroups('Reuse', reuse, 'ru')}
        {renderGroups('Compatibility', compatibility, 'co')}
      </View>
    );
  };

  return (
    <Document title="Dialyzer">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialyzer</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialyzerDocumentPDFTemplate;
