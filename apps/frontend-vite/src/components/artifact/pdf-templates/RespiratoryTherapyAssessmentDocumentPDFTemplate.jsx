/**
 * RespiratoryTherapyAssessmentDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- respiratory therapy assessment
 * Collection: respiratory_therapy_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  abgContainer: { marginBottom: 10, paddingLeft: 4 },
  abgEntry: { marginBottom: 8 },
  abgTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2 },
  abgRow: { fontSize: 11, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  /* ABG Bar Chart Styles */
  abgChartContainer: { backgroundColor: '#f8f9fa', padding: 10, borderWidth: 1, borderColor: '#dee2e6', marginBottom: 10 },
  abgChartSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  abgChartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  abgLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  abgLegendColor: { width: 10, height: 10 },
  abgLegendText: { fontSize: 8, color: '#333333' },
  abgBarRow: { marginBottom: 8 },
  abgBarLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3 },
  abgBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  abgBarBackground: { flex: 1, height: 14, backgroundColor: '#e9ecef' },
  abgBarFill: { height: '100%' },
  abgBarValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#000000', minWidth: 60, textAlign: 'right' },
  abgBarInterpretation: { fontSize: 8, marginTop: 2, fontFamily: 'Helvetica-Bold' },
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

// 0 is a "not measured / not assessed" sentinel for these respiratory/ventilator/ABG metrics
// (mirrors HIDE_ZERO_FIELDS in RespiratoryTherapyAssessmentDocument.jsx).
const HIDE_ZERO_FIELDS = new Set([
  'apacheIIScore', 'murrayLungInjuryScore', 'respiratoryRate', 'tidalVolume', 'minuteVentilation',
  'peakInspiratoryPressure', 'plateauPressure', 'positiveEndExpiratoryPressure', 'staticCompliance',
  'dynamicCompliance', 'airwayResistance', 'paoToFio2Ratio', 'oxygenationIndex', 'spO2', 'endTidalCO2',
  'fractionOfInspiredOxygen', 'drivingPressure', 'rapidShallowBreathingIndex', 'maximalInspiratoryPressure',
  'borgDyspneaScale',
]);

const hasFieldVal = (fn, v) => {
  if (HIDE_ZERO_FIELDS.has(fn) && v === 0) return false;
  return hasVal(v);
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text, sectionTitle);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
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

/* ======= ABG BAR CHART HELPERS (PDF) ======= */
const ABG_RANGES = {
  pH: { low: 7.35, high: 7.45, scale: [7.0, 7.8] },
  PaO2: { low: 80, high: 100, scale: [0, 150] },
  PaCO2: { low: 35, high: 45, scale: [0, 80] },
  HCO3: { low: 22, high: 26, scale: [0, 40] },
  baseExcess: { low: -2, high: 2, scale: [-10, 10] },
};

const ABG_INTERPRETATIONS = {
  pH: { low: 'Acidosis', normal: 'Normal', high: 'Alkalosis' },
  PaO2: { low: 'Hypoxemia', normal: 'Normal', high: 'Hyperoxia' },
  PaCO2: { low: 'Resp Alkalosis', normal: 'Normal', high: 'Resp Acidosis' },
  HCO3: { low: 'Met Acidosis', normal: 'Normal', high: 'Met Alkalosis' },
  baseExcess: { low: 'Met Acidosis', normal: 'Normal', high: 'Met Alkalosis' },
};

const ABG_LABELS = { pH: 'pH', PaO2: 'PaO2', PaCO2: 'PaCO2', HCO3: 'HCO3', baseExcess: 'Base Excess' };

const getAbgBarColorPDF = (value, key) => {
  const range = ABG_RANGES[key];
  if (!range || value === null || value === undefined) return '#9ca3af';
  if (value < range.low) return '#606060';
  if (value > range.high) return '#5c5c5c';
  return '#6f6f6f';
};

const getAbgInterpretationPDF = (value, key) => {
  const range = ABG_RANGES[key];
  const interp = ABG_INTERPRETATIONS[key];
  if (!range || !interp || value === null || value === undefined) return '';
  if (value < range.low) return interp.low;
  if (value > range.high) return interp.high;
  return interp.normal;
};

const abgToPercentagePDF = (value, key) => {
  const range = ABG_RANGES[key];
  if (!range || value === null || value === undefined) return 0;
  const [min, max] = range.scale;
  return Math.min(95, Math.max(8, ((value - min) / (max - min)) * 100));
};

const AbgBarChartPDF = ({ label, value, abgKey }) => {
  const numValue = typeof value === 'number' ? value : null;
  if (numValue === null) {
    return (
      <View style={styles.abgBarRow}>
        <Text style={styles.abgBarLabel}>{label}</Text>
        <Text style={styles.abgBarValue}>{safeString(value)}</Text>
      </View>
    );
  }
  const color = getAbgBarColorPDF(numValue, abgKey);
  const interpretation = getAbgInterpretationPDF(numValue, abgKey);
  const barWidth = abgToPercentagePDF(numValue, abgKey);
  return (
    <View style={styles.abgBarRow}>
      <Text style={styles.abgBarLabel}>{label}</Text>
      <View style={styles.abgBarContainer}>
        <View style={styles.abgBarBackground}>
          <View style={[styles.abgBarFill, { width: `${barWidth}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.abgBarValue}>{safeString(value)}</Text>
      </View>
      {interpretation ? (
        <Text style={[styles.abgBarInterpretation, { color }]}>{interpretation}</Text>
      ) : null}
    </View>
  );
};

const AbgChartLegendPDF = () => (
  <View style={styles.abgChartLegend}>
    <View style={styles.abgLegendItem}>
      <View style={[styles.abgLegendColor, { backgroundColor: '#6f6f6f' }]} />
      <Text style={styles.abgLegendText}>Normal</Text>
    </View>
    <View style={styles.abgLegendItem}>
      <View style={[styles.abgLegendColor, { backgroundColor: '#606060' }]} />
      <Text style={styles.abgLegendText}>Low</Text>
    </View>
    <View style={styles.abgLegendItem}>
      <View style={[styles.abgLegendColor, { backgroundColor: '#5c5c5c' }]} />
      <Text style={styles.abgLegendText}>High</Text>
    </View>
  </View>
);

/* renderAbgSection: arterial blood gas array of objects with bar charts */
const renderAbgSection = (abgArray, counterRef) => {
  if (!Array.isArray(abgArray) || abgArray.length === 0) return null;
  const abgKeys = ['pH', 'PaO2', 'PaCO2', 'HCO3', 'baseExcess'];
  const hasChartData = abgArray.some(entry =>
    abgKeys.some(k => typeof entry[k] === 'number')
  );
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.sectionTitle}>Arterial Blood Gas Values</Text>
      </View>
      {hasChartData ? (
        abgArray.map((entry, i) => {
          const chartKeys = abgKeys.filter(k => typeof entry[k] === 'number');
          if (chartKeys.length === 0) return null;
          return (
            <View key={i} style={styles.abgChartContainer} wrap={false}>
              <Text style={styles.abgChartSubtitle}>
                {entry.condition ? safeString(entry.condition) : `ABG ${i + 1}`}
              </Text>
              <AbgChartLegendPDF />
              {chartKeys.map(k => (
                <AbgBarChartPDF key={k} label={ABG_LABELS[k]} value={entry[k]} abgKey={k} />
              ))}
            </View>
          );
        })
      ) : (
        abgArray.map((entry, i) => (
          <View key={i} style={styles.abgEntry}>
            <Text style={styles.abgTitle}>
              {counterRef.n++}. ABG {i + 1}{entry.condition ? ` (${safeString(entry.condition)})` : ''}
            </Text>
            {entry.pH !== undefined && <Text style={styles.abgRow}>pH: {safeString(entry.pH)}</Text>}
            {entry.PaO2 !== undefined && <Text style={styles.abgRow}>PaO2: {safeString(entry.PaO2)}</Text>}
            {entry.PaCO2 !== undefined && <Text style={styles.abgRow}>PaCO2: {safeString(entry.PaCO2)}</Text>}
            {entry.HCO3 !== undefined && <Text style={styles.abgRow}>HCO3: {safeString(entry.HCO3)}</Text>}
            {entry.baseExcess !== undefined && <Text style={styles.abgRow}>Base Excess: {safeString(entry.baseExcess)}</Text>}
          </View>
        ))
      )}
    </View>
  );
};

/* ======= COMPONENT ======= */
const RespiratoryTherapyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.respiratory_therapy_assessment) return Array.isArray(r.respiratory_therapy_assessment) ? r.respiratory_therapy_assessment : [r.respiratory_therapy_assessment];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.respiratory_therapy_assessment) return Array.isArray(dd.respiratory_therapy_assessment) ? dd.respiratory_therapy_assessment : [dd.respiratory_therapy_assessment];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Respiratory Therapy Assessment</Text>
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
          <Text style={styles.documentTitle}>Respiratory Therapy Assessment</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Respiratory Therapy Assessment ${index + 1}`}</Text>
                {record.assessmentDateTime && <Text style={styles.recordMeta}>{formatDate(record.assessmentDateTime)}</Text>}
              </View>

              {/* 1. Diagnosis & Scoring */}
              {(hasFieldVal('primaryDiagnosis', record.primaryDiagnosis) || hasFieldVal('apacheIIScore', record.apacheIIScore) || hasFieldVal('murrayLungInjuryScore', record.murrayLungInjuryScore)) && (() => {
                let st = 'Diagnosis & Scoring';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('primaryDiagnosis', record.primaryDiagnosis) && renderSentenceField('Primary Diagnosis', record.primaryDiagnosis, ctr, g())}
                    {hasFieldVal('apacheIIScore', record.apacheIIScore) && renderFieldRow('APACHE II Score', record.apacheIIScore, g())}
                    {hasFieldVal('murrayLungInjuryScore', record.murrayLungInjuryScore) && renderFieldRow('Murray Lung Injury Score', record.murrayLungInjuryScore, g())}
                  </View>
                );
              })()}

              {/* 2. Respiratory Vitals */}
              {(hasFieldVal('respiratoryRate', record.respiratoryRate) || hasFieldVal('tidalVolume', record.tidalVolume) || hasFieldVal('minuteVentilation', record.minuteVentilation)) && (() => {
                let st = 'Respiratory Vitals';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('respiratoryRate', record.respiratoryRate) && renderFieldRow('Respiratory Rate', record.respiratoryRate, g())}
                    {hasFieldVal('tidalVolume', record.tidalVolume) && renderFieldRow('Tidal Volume', record.tidalVolume, g())}
                    {hasFieldVal('minuteVentilation', record.minuteVentilation) && renderFieldRow('Minute Ventilation', record.minuteVentilation, g())}
                  </View>
                );
              })()}

              {/* 3. Ventilator Mechanics */}
              {(hasFieldVal('peakInspiratoryPressure', record.peakInspiratoryPressure) || hasFieldVal('plateauPressure', record.plateauPressure) || hasFieldVal('positiveEndExpiratoryPressure', record.positiveEndExpiratoryPressure) || hasFieldVal('staticCompliance', record.staticCompliance) || hasFieldVal('dynamicCompliance', record.dynamicCompliance) || hasFieldVal('airwayResistance', record.airwayResistance) || hasFieldVal('drivingPressure', record.drivingPressure)) && (() => {
                let st = 'Ventilator Mechanics';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('peakInspiratoryPressure', record.peakInspiratoryPressure) && renderFieldRow('Peak Inspiratory Pressure', record.peakInspiratoryPressure, g())}
                    {hasFieldVal('plateauPressure', record.plateauPressure) && renderFieldRow('Plateau Pressure', record.plateauPressure, g())}
                    {hasFieldVal('positiveEndExpiratoryPressure', record.positiveEndExpiratoryPressure) && renderFieldRow('PEEP', record.positiveEndExpiratoryPressure, g())}
                    {hasFieldVal('staticCompliance', record.staticCompliance) && renderFieldRow('Static Compliance', record.staticCompliance, g())}
                    {hasFieldVal('dynamicCompliance', record.dynamicCompliance) && renderFieldRow('Dynamic Compliance', record.dynamicCompliance, g())}
                    {hasFieldVal('airwayResistance', record.airwayResistance) && renderFieldRow('Airway Resistance', record.airwayResistance, g())}
                    {hasFieldVal('drivingPressure', record.drivingPressure) && renderFieldRow('Driving Pressure', record.drivingPressure, g())}
                  </View>
                );
              })()}

              {/* 4. Gas Exchange & Oxygenation */}
              {(hasFieldVal('paoToFio2Ratio', record.paoToFio2Ratio) || hasFieldVal('oxygenationIndex', record.oxygenationIndex) || hasFieldVal('spO2', record.spO2) || hasFieldVal('endTidalCO2', record.endTidalCO2)) && (() => {
                let st = 'Gas Exchange & Oxygenation';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('paoToFio2Ratio', record.paoToFio2Ratio) && renderFieldRow('PaO2/FiO2 Ratio', record.paoToFio2Ratio, g())}
                    {hasFieldVal('oxygenationIndex', record.oxygenationIndex) && renderFieldRow('Oxygenation Index', record.oxygenationIndex, g())}
                    {hasFieldVal('spO2', record.spO2) && renderFieldRow('SpO2', record.spO2, g())}
                    {hasFieldVal('endTidalCO2', record.endTidalCO2) && renderFieldRow('End-Tidal CO2', record.endTidalCO2, g())}
                  </View>
                );
              })()}

              {/* 5. Arterial Blood Gas Values */}
              {renderAbgSection(record.arterialBloodGasValues, ctr)}

              {/* 6. Ventilator Settings */}
              {(hasFieldVal('ventilatorMode', record.ventilatorMode) || hasFieldVal('fractionOfInspiredOxygen', record.fractionOfInspiredOxygen)) && (() => {
                let st = 'Ventilator Settings';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('ventilatorMode', record.ventilatorMode) && renderSentenceField('Ventilator Mode', record.ventilatorMode, ctr, g())}
                    {hasFieldVal('fractionOfInspiredOxygen', record.fractionOfInspiredOxygen) && renderFieldRow('FiO2', record.fractionOfInspiredOxygen, g())}
                  </View>
                );
              })()}

              {/* 7. Airway & Secretions */}
              {(hasFieldVal('coughStrengthAssessment', record.coughStrengthAssessment) || hasFieldVal('secretionCharacteristics', record.secretionCharacteristics) || hasFieldVal('breathSoundsAuscultation', record.breathSoundsAuscultation) || hasFieldVal('borgDyspneaScale', record.borgDyspneaScale) || hasFieldVal('bronchodilatorResponse', record.bronchodilatorResponse)) && (() => {
                let st = 'Airway & Secretions';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('coughStrengthAssessment', record.coughStrengthAssessment) && renderSentenceField('Cough Strength Assessment', record.coughStrengthAssessment, ctr, g())}
                    {hasFieldVal('secretionCharacteristics', record.secretionCharacteristics) && renderSentenceField('Secretion Characteristics', record.secretionCharacteristics, ctr, g())}
                    {hasFieldVal('breathSoundsAuscultation', record.breathSoundsAuscultation) && renderSentenceField('Breath Sounds Auscultation', record.breathSoundsAuscultation, ctr, g())}
                    {hasFieldVal('borgDyspneaScale', record.borgDyspneaScale) && renderFieldRow('Borg Dyspnea Scale', record.borgDyspneaScale, g())}
                    {hasFieldVal('bronchodilatorResponse', record.bronchodilatorResponse) && renderFieldRow('Bronchodilator Response', record.bronchodilatorResponse, g())}
                  </View>
                );
              })()}

              {/* 8. Weaning Readiness */}
              {(hasFieldVal('rapidShallowBreathingIndex', record.rapidShallowBreathingIndex) || hasFieldVal('maximalInspiratoryPressure', record.maximalInspiratoryPressure) || hasFieldVal('spontaneousBreathingTrialResult', record.spontaneousBreathingTrialResult)) && (() => {
                let st = 'Weaning Readiness';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasFieldVal('rapidShallowBreathingIndex', record.rapidShallowBreathingIndex) && renderFieldRow('Rapid Shallow Breathing Index', record.rapidShallowBreathingIndex, g())}
                    {hasFieldVal('maximalInspiratoryPressure', record.maximalInspiratoryPressure) && renderFieldRow('Maximal Inspiratory Pressure', record.maximalInspiratoryPressure, g())}
                    {hasFieldVal('spontaneousBreathingTrialResult', record.spontaneousBreathingTrialResult) && renderSentenceField('Spontaneous Breathing Trial Result', record.spontaneousBreathingTrialResult, ctr, g())}
                  </View>
                );
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default RespiratoryTherapyAssessmentDocumentPDFTemplate;
