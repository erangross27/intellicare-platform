/**
 * DialysateCompositionDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialysate_composition.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — numeric fields
 * carry their unit, sentinel-zero physical props (pH/osmolarity/conductivity/flowRate 0) hidden while
 * meaningful-zero electrolytes/water 0 shown, Additives single-name numbered rows.
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
const fmtWithUnit = (val, unit) => { const base = fmtVal(val); return unit ? `${base}${unit}` : base; };

/* Sentinel-zero: electrolytes + water counts where 0 is a real value; physical props hide 0. */
const MEANINGFUL_ZERO_FIELDS = new Set(['sodiumConcentration', 'potassiumConcentration', 'calciumConcentration', 'magnesiumConcentration', 'chlorideConcentration', 'bicarbonateConcentration', 'acetateConcentration', 'glucoseConcentration', 'phosphateConcentration', 'endotoxinLevel', 'bacterialCount']);
const numHasVal = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (Number.isNaN(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO_FIELDS.has(fn);
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const DialysateCompositionDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dialysate_composition) return Array.isArray(r.dialysate_composition) ? r.dialysate_composition : [r.dialysate_composition];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysate_composition) return Array.isArray(dd.dialysate_composition) ? dd.dialysate_composition : [dd.dialysate_composition]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dialysate Composition">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialysate Composition</Text></View>
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

  const renderRecord = (record, idx) => {
    // ── Electrolyte Concentrations ──
    const electrolytes = [
      ['Sodium', record.sodiumConcentration, ' mEq/L', 'sodiumConcentration'],
      ['Potassium', record.potassiumConcentration, ' mEq/L', 'potassiumConcentration'],
      ['Calcium', record.calciumConcentration, ' mEq/L', 'calciumConcentration'],
      ['Magnesium', record.magnesiumConcentration, ' mEq/L', 'magnesiumConcentration'],
      ['Chloride', record.chlorideConcentration, ' mEq/L', 'chlorideConcentration'],
      ['Bicarbonate', record.bicarbonateConcentration, ' mEq/L', 'bicarbonateConcentration'],
      ['Acetate', record.acetateConcentration, ' mEq/L', 'acetateConcentration'],
      ['Glucose', record.glucoseConcentration, ' mg/dL', 'glucoseConcentration'],
      ['Phosphate', record.phosphateConcentration, ' mEq/L', 'phosphateConcentration'],
    ].filter(([, v, , fn]) => numHasVal(fn, v)).map(([l, v, u]) => [l, fmtWithUnit(v, u)]);

    // ── Physical Properties ──
    const physical = [
      ['Temperature', record.dialysateTemperature, ' °C', 'dialysateTemperature'],
      ['pH', record.dialysatePH, null, 'dialysatePH'],
      ['Osmolarity', record.osmolarity, ' mOsm/L', 'osmolarity'],
      ['Conductivity', record.conductivity, ' mS/cm', 'conductivity'],
      ['Flow Rate', record.dialysateFlowRate, ' mL/min', 'dialysateFlowRate'],
    ].filter(([, v, , fn]) => numHasVal(fn, v)).map(([l, v, u]) => [l, fmtWithUnit(v, u)]);

    // ── Buffer & Dialyzer (display stored value verbatim — enum is edit-widget-only) ──
    const buffer = [
      ['Buffer Type', record.bufferType], ['Dialyzer Type', record.dialyzerType], ['Modality Type', record.dialysisModalityType],
    ].filter(([, v]) => hasVal(v)).map(([l, v]) => [l, fmtVal(v)]);

    // ── Manufacturing ──
    const mfg = [
      hasVal(record.dialysateBatchNumber) ? ['Batch Number', fmtVal(record.dialysateBatchNumber)] : null,
      hasVal(record.manufacturerName) ? ['Manufacturer', fmtVal(record.manufacturerName)] : null,
      record.expirationDate ? ['Expiration Date', formatDate(record.expirationDate)] : null,
    ].filter(Boolean);

    // ── Water Quality ──
    const water = [
      hasVal(record.waterTreatmentType) ? ['Water Treatment', fmtVal(record.waterTreatmentType)] : null,
      hasVal(record.endotoxinLevel) ? ['Endotoxin Level', fmtWithUnit(record.endotoxinLevel, ' EU/mL')] : null,
      hasVal(record.bacterialCount) ? ['Bacterial Count', fmtWithUnit(record.bacterialCount, ' CFU/mL')] : null,
      hasVal(record.qualityControlVerified) ? ['QC Verified', fmtVal(record.qualityControlVerified)] : null,
    ].filter(Boolean);

    const additives = (Array.isArray(record.additives) ? record.additives : []).filter(hasVal).map(fmtVal);

    const renderFieldSection = (title, pairs, keyPrefix) => pairs.length === 0 ? null : (
      <View style={styles.section}>
        {pairs.map(([label, value], i) => fieldGroup(label, [value], `${keyPrefix}-${i}`, i === 0 ? sectionTitle(title) : null))}
      </View>
    );

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialysate Composition ${idx + 1}`}</Text>
        </View>

        {renderFieldSection('Electrolyte Concentrations', electrolytes, 'el')}
        {renderFieldSection('Physical Properties', physical, 'ph')}
        {renderFieldSection('Buffer & Dialyzer', buffer, 'bd')}
        {renderFieldSection('Manufacturing', mfg, 'mf')}
        {renderFieldSection('Water Quality', water, 'wq')}

        {/* Additives — single-name numbered rows */}
        {additives.length > 0 && (
          <View style={styles.section}>
            {fieldGroup('', additives, 'add', sectionTitle('Additives'))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document title="Dialysate Composition">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialysate Composition</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialysateCompositionDocumentPDFTemplate;
