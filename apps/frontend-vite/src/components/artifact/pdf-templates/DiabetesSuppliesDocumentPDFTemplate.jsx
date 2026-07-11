/**
 * DiabetesSuppliesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetes_supplies.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; each field is its own glue unit; the section title rides
 * inside the first. Every value row numbered ("1." even singles). Mirrors the JSX exactly:
 * quantity 0 = extractor sentinel → hidden; boolean cgmTransmitterIncluded prints Yes/No.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* mirrors the JSX: quantity 0 = extractor sentinel → hidden */
const NUMBER_FIELDS = ['testStripQuantity', 'lancetQuantity', 'syringeQuantity', 'penNeedleQuantity', 'cgmSensorQuantity', 'reservoirQuantity', 'infusionSetQuantity', 'ketoneTestStrips', 'alcoholPrepPads', 'refillsRemaining'];
const fieldShows = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && NUMBER_FIELDS.includes(fn));

/* single-name rule with parenthetical-acronym normalization — mirrors the JSX:
   a label equal to the title minus its "(CGM)"-style suffix is hidden */
const labelIsRedundant = (label, title) => {
  const l = String(label || '').trim().toLowerCase();
  const t = String(title || '').trim().toLowerCase();
  const base = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return l === t || l === base;
};

/* colon-labeled value ("Tandem t:slim X2") → third-level sub-label "Tandem t" + row "slim X2" — mirrors the JSX */
const parseColonValue = (text) => {
  const m = typeof text === 'string' ? text.match(/^([A-Za-z][^:\n]{0,40}?):(\s*)(\S[\s\S]*)$/) : null;
  if (!m) return null;
  return { label: m[1].trim(), value: m[3].trim() };
};

const SECTIONS = [
  ['Glucometer & Test Strips', [['glucometerModel', 'Glucometer Model'], ['testStripBrand', 'Test Strip Brand'], ['testStripQuantity', 'Test Strip Quantity']]],
  ['Lancets', [['lancetType', 'Lancet Type'], ['lancetQuantity', 'Lancet Quantity']]],
  ['Insulin Delivery', [['insulinSyringeSize', 'Insulin Syringe Size'], ['syringeNeedleGauge', 'Syringe Needle Gauge'], ['syringeQuantity', 'Syringe Quantity'], ['penNeedleGauge', 'Pen Needle Gauge'], ['penNeedleQuantity', 'Pen Needle Quantity']]],
  ['Continuous Glucose Monitor (CGM)', [['continuousGlucoseMonitor', 'Continuous Glucose Monitor'], ['cgmSensorQuantity', 'Sensor Quantity'], ['cgmTransmitterIncluded', 'Transmitter Included']]],
  ['Insulin Pump', [['insulinPumpReservoir', 'Reservoir'], ['reservoirQuantity', 'Reservoir Quantity'], ['infusionSetType', 'Infusion Set Type'], ['tubingLength', 'Tubing Length'], ['infusionSetQuantity', 'Infusion Set Quantity']]],
  ['Other Supplies', [['ketoneTestStrips', 'Ketone Test Strips'], ['sharpsContainerSize', 'Sharps Container Size'], ['alcoholPrepPads', 'Alcohol Prep Pads']]],
  ['Insurance & Supplier Info', [['dmeSupplier', 'DME Supplier'], ['insurancePreauthorization', 'Insurance Preauthorization'], ['prescriptionNumber', 'Prescription Number'], ['refillsRemaining', 'Refills Remaining']]],
];

/* ═══ COMPONENT ═══ */
const DiabetesSuppliesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetes_supplies) return Array.isArray(r.diabetes_supplies) ? r.diabetes_supplies : [r.diabetes_supplies];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_supplies) return Array.isArray(dd.diabetes_supplies) ? dd.diabetes_supplies : [dd.diabetes_supplies]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetes Supplies">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Supplies</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title="Diabetes Supplies">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Supplies</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Diabetes Supplies ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(([title, spec]) => {
              const shown = spec.filter(([f]) => fieldShows(f, record[f]));
              if (shown.length === 0) return null;
              return (
                <View key={title} style={styles.section}>
                  {shown.map(([f, label], fi) => {
                    const cp = parseColonValue(record[f]);
                    return (
                      <View key={f} style={styles.fieldGroup} wrap={false}>
                        {fi === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
                        {!labelIsRedundant(label, title) && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
                        {cp && <Text style={styles.fieldLabel}>{safeString(cp.label)}</Text>}
                        <Text style={styles.value}>{`1. ${safeString(cp ? cp.value : fmtVal(record[f]))}`}</Text>
                      </View>
                    );
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

export default DiabetesSuppliesDocumentPDFTemplate;
