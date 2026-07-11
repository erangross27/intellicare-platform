/**
 * DentalImplantSurgeryPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — no-boxes PDF
 * Collection: dental_implant_surgery
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 2, paddingLeft: 12 },
  /* Bar chart styles (B&W greyscale chart) */
  chartContainer: { marginBottom: 10 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 10, height: 10 },
  legendText: { fontSize: 10, color: '#000000' },
  barRow: { marginBottom: 6 },
  barLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', marginBottom: 2 },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barBackground: { flex: 1, height: 16, backgroundColor: '#eeeeee' },
  barFill: { height: '100%', minWidth: 4 },
  barValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', width: 55, textAlign: 'right' },
  barInterpretation: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 60, textAlign: 'right' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#999999' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const NUMBER_UNITS = {
  implantDiameter: 'mm',
  implantLength: 'mm',
  residualBoneHeight: 'mm',
  alveolarRidgeWidth: 'mm',
  cbctHounsfieldUnits: 'HU',
  keratinizedMucosaWidth: 'mm',
  pinkEstheticScore: '/14',
};

const NUMBER_FIELDS = ['implantDiameter', 'implantLength', 'residualBoneHeight', 'alveolarRidgeWidth', 'cbctHounsfieldUnits', 'keratinizedMucosaWidth', 'pinkEstheticScore'];

const FIELD_LABELS = {
  implantSystem: 'Implant System',
  implantDiameter: 'Implant Diameter',
  implantLength: 'Implant Length',
  implantPositionFDI: 'Implant Position (FDI)',
  boneQualityLekholmZarb: 'Bone Quality (Lekholm-Zarb)',
  boneQuantityLekholmZarb: 'Bone Quantity (Lekholm-Zarb)',
  residualBoneHeight: 'Residual Bone Height',
  alveolarRidgeWidth: 'Alveolar Ridge Width',
  cbctHounsfieldUnits: 'CBCT Hounsfield Units',
  boneGraftMaterial: 'Bone Graft Material',
  membraneType: 'Membrane Type',
  sinusLiftApproach: 'Sinus Lift Approach',
  guidedSurgeryUsed: 'Guided Surgery Used',
  immediateLoadingProtocol: 'Immediate Loading Protocol',
  piezoelectricSurgeryUsed: 'Piezoelectric Surgery Used',
  prfMembraneApplication: 'PRF Membrane Application',
  platformSwitchingDesign: 'Platform Switching Design',
  abutmentType: 'Abutment Type',
  softTissueAugmentation: 'Soft Tissue Augmentation',
  keratinizedMucosaWidth: 'Keratinized Mucosa Width',
  pinkEstheticScore: 'Pink Esthetic Score',
  papillaIndexScore: 'Papilla Index Score',
  schwartzImplantSurgeryIndex: 'Schwartz Implant Surgery Index',
};

const getDisplayValue = (fn, val) => {
  if (!hasVal(val)) return '';
  const unit = NUMBER_UNITS[fn];
  if (NUMBER_FIELDS.includes(fn) && unit) return `${fmtVal(val)} ${unit}`;
  return fmtVal(val);
};

/* ── Stability Bar Chart Config (print-friendly colors) ── */
const STABILITY_MEASURES = [
  { key: 'insertionTorqueValue', label: 'Insertion Torque', max: 80, greenMin: 35, yellowMin: 15, unit: 'Ncm' },
  { key: 'implantStabilityQuotient', label: 'Implant Stability Quotient', max: 100, greenMin: 70, yellowMin: 60, unit: 'ISQ' },
];

const getStabilityColor = (value, measure) => {
  if (value >= measure.greenMin) return '#000000';
  if (value >= measure.yellowMin) return '#555555';
  return '#999999';
};

const getStabilityInterpretation = (value, measure) => {
  if (value >= measure.greenMin) return 'Good';
  if (value >= measure.yellowMin) return 'Moderate';
  return 'Low';
};

const stabilityToPercentage = (value, max) => Math.min(100, Math.max(2, (value / max) * 100));

/* ── Render Helpers (numbered value "1." even for single values) ── */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

const renderFieldWithUnit = (fn, value) => {
  if (!hasVal(value) || parseFloat(value) === 0) return null;
  const label = FIELD_LABELS[fn] || fn;
  const display = getDisplayValue(fn, value);
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(display)}</Text>
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DentalImplantSurgeryPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dental_implant_surgery) return Array.isArray(r.dental_implant_surgery) ? r.dental_implant_surgery : [r.dental_implant_surgery];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dental_implant_surgery) return Array.isArray(dd.dental_implant_surgery) ? dd.dental_implant_surgery : [dd.dental_implant_surgery]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dental Implant Surgery</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dental Implant Surgery</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Implant Specifications */
          const specFields = [
            { key: 'implantSystem', val: record.implantSystem },
            { key: 'implantDiameter', val: record.implantDiameter },
            { key: 'implantLength', val: record.implantLength },
            { key: 'implantPositionFDI', val: record.implantPositionFDI },
          ].filter(f => hasVal(f.val));

          /* Section 2: Bone Assessment */
          const boneFields = [
            { key: 'boneQualityLekholmZarb', val: record.boneQualityLekholmZarb },
            { key: 'boneQuantityLekholmZarb', val: record.boneQuantityLekholmZarb },
            { key: 'residualBoneHeight', val: record.residualBoneHeight },
            { key: 'alveolarRidgeWidth', val: record.alveolarRidgeWidth },
            { key: 'cbctHounsfieldUnits', val: record.cbctHounsfieldUnits },
          ].filter(f => hasVal(f.val));

          /* Section 3: Stability & Torque */
          const hasStab = STABILITY_MEASURES.some(m => hasVal(record[m.key]) && parseFloat(record[m.key]) !== 0);
          const hasSchwartz = hasVal(record.schwartzImplantSurgeryIndex);

          /* Section 4: Grafting & Membrane */
          const graftFields = [
            { key: 'boneGraftMaterial', val: record.boneGraftMaterial },
            { key: 'membraneType', val: record.membraneType },
            { key: 'sinusLiftApproach', val: record.sinusLiftApproach },
          ].filter(f => hasVal(f.val));

          /* Section 5: Surgical Techniques */
          const techFields = [
            { key: 'guidedSurgeryUsed', val: record.guidedSurgeryUsed },
            { key: 'immediateLoadingProtocol', val: record.immediateLoadingProtocol },
            { key: 'piezoelectricSurgeryUsed', val: record.piezoelectricSurgeryUsed },
            { key: 'prfMembraneApplication', val: record.prfMembraneApplication },
            { key: 'platformSwitchingDesign', val: record.platformSwitchingDesign },
          ].filter(f => hasVal(f.val));

          /* Section 6: Prosthetic Planning */
          const prosFields = [
            { key: 'abutmentType', val: record.abutmentType },
          ].filter(f => hasVal(f.val));

          /* Section 7: Soft Tissue Assessment */
          const softFields = [
            { key: 'softTissueAugmentation', val: record.softTissueAugmentation },
            { key: 'keratinizedMucosaWidth', val: record.keratinizedMucosaWidth },
            { key: 'pinkEstheticScore', val: record.pinkEstheticScore },
            { key: 'papillaIndexScore', val: record.papillaIndexScore },
          ].filter(f => hasVal(f.val));

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Dental Implant Surgery ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Implant Specifications */}
              {specFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={specFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Implant Specifications</Text>
                    {specFields.map((f, i) => (
                      <React.Fragment key={i}>
                        {NUMBER_FIELDS.includes(f.key) ? renderFieldWithUnit(f.key, f.val) : renderFieldRow(FIELD_LABELS[f.key], f.val)}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 2: Bone Assessment */}
              {boneFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={boneFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Bone Assessment</Text>
                    {boneFields.map((f, i) => (
                      <React.Fragment key={i}>
                        {NUMBER_FIELDS.includes(f.key) ? renderFieldWithUnit(f.key, f.val) : renderFieldRow(FIELD_LABELS[f.key], f.val)}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 3: Stability & Torque Bar Chart */}
              {(hasStab || hasSchwartz) && (
                <View style={styles.section}>
                  <View style={styles.chartContainer}>
                    <Text style={styles.sectionTitle}>Stability & Torque</Text>
                    {hasStab && (
                      <View style={styles.chartLegend} wrap={false}>
                        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#000000' }]} /><Text style={styles.legendText}>Good</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#555555' }]} /><Text style={styles.legendText}>Moderate</Text></View>
                        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#999999' }]} /><Text style={styles.legendText}>Low</Text></View>
                      </View>
                    )}
                    {STABILITY_MEASURES.map((m) => {
                      const val = record[m.key];
                      if (!hasVal(val) || parseFloat(val) === 0) return null;
                      const numVal = typeof val === 'number' ? val : Number(val);
                      const color = getStabilityColor(numVal, m);
                      const interp = getStabilityInterpretation(numVal, m);
                      const pct = stabilityToPercentage(numVal, m.max);
                      return (
                        <View key={m.key} style={styles.barRow}>
                          <Text style={styles.barLabel}>{m.label}</Text>
                          <View style={styles.barContainer}>
                            <View style={styles.barBackground}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
                            <Text style={[styles.barValue, { color }]}>{numVal} {m.unit}</Text>
                            <Text style={[styles.barInterpretation, { color }]}>{interp}</Text>
                          </View>
                        </View>
                      );
                    })}
                    {hasSchwartz && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.fieldLabel}>Schwartz Implant Surgery Index</Text>
                        <Text style={styles.listItem}>1. {safeString(fmtVal(record.schwartzImplantSurgeryIndex))}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Section 4: Grafting & Membrane */}
              {graftFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={graftFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Grafting & Membrane</Text>
                    {graftFields.map((f, i) => <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>)}
                  </View>
                </View>
              )}

              {/* Section 5: Surgical Techniques */}
              {techFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={techFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Surgical Techniques</Text>
                    {techFields.map((f, i) => <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>)}
                  </View>
                </View>
              )}

              {/* Section 6: Prosthetic Planning */}
              {prosFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={prosFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Prosthetic Planning</Text>
                    {prosFields.map((f, i) => <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>)}
                  </View>
                </View>
              )}

              {/* Section 7: Soft Tissue Assessment */}
              {softFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={softFields.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Soft Tissue Assessment</Text>
                    {softFields.map((f, i) => (
                      <React.Fragment key={i}>
                        {NUMBER_FIELDS.includes(f.key) ? renderFieldWithUnit(f.key, f.val) : renderFieldRow(FIELD_LABELS[f.key], f.val)}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DentalImplantSurgeryPDFTemplate;
