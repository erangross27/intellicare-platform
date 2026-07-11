import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Vital Signs Table Document PDF Template - March 2026
 * Professional black & white layout with bar chart visualization
 * Helvetica font, LETTER size, 20pt title / 12pt body
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Helvetica',
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordMeta: {
    fontSize: 10,
    marginTop: 6,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 10,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  numberedItem: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 3,
  },
  itemNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 22,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.5,
  },
  chartContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 10,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendColor: {
    width: 10,
    height: 10,
  },
  legendText: {
    fontSize: 8,
    color: '#333333',
  },
  barChartRow: {
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#e9ecef',
  },
  barFill: {
    height: '100%',
  },
  barValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    minWidth: 80,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 8,
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
});

/* ======= Vital Signs Reference Ranges ======= */
const VITAL_RANGES = {
  systolicBloodPressure:  { low: 90,   high: 140,  scale: [40, 220] },
  diastolicBloodPressure: { low: 60,   high: 90,   scale: [30, 130] },
  meanArterialPressure:   { low: 70,   high: 100,  scale: [30, 150] },
  heartRate:              { low: 60,   high: 100,  scale: [20, 200] },
  respiratoryRate:        { low: 12,   high: 20,   scale: [4, 40] },
  oxygenSaturation:       { low: 95,   high: 101,  scale: [70, 100] },
  bodyTemperatureF:       { low: 97.8, high: 99.1, scale: [95, 107] },
  bodyTemperatureC:       { low: 36.5, high: 37.3, scale: [35, 42] },
  painScore:              { low: 0,    high: 3,    scale: [0, 10] },
  bloodGlucose:           { low: 70,   high: 200,  scale: [20, 500] },
  bodyMassIndex:          { low: 18.5, high: 24.9, scale: [10, 50] },
};

const VITAL_INTERPRETATIONS = {
  systolicBloodPressure:  { low: 'Hypotension',  normal: 'Normal', high: 'Hypertension' },
  diastolicBloodPressure: { low: 'Hypotension',  normal: 'Normal', high: 'Hypertension' },
  meanArterialPressure:   { low: 'Low MAP',       normal: 'Normal', high: 'Elevated MAP' },
  heartRate:              { low: 'Bradycardia',   normal: 'Normal', high: 'Tachycardia' },
  respiratoryRate:        { low: 'Bradypnea',     normal: 'Normal', high: 'Tachypnea' },
  oxygenSaturation:       { low: 'Hypoxemia',     normal: 'Normal', high: 'Normal' },
  bodyTemperatureF:       { low: 'Hypothermia',   normal: 'Normal', high: 'Fever' },
  bodyTemperatureC:       { low: 'Hypothermia',   normal: 'Normal', high: 'Fever' },
  painScore:              { low: 'No Pain',       normal: 'Mild',   high: 'Moderate-Severe' },
  bloodGlucose:           { low: 'Hypoglycemia',  normal: 'Normal', high: 'Hyperglycemia' },
  bodyMassIndex:          { low: 'Underweight',   normal: 'Normal', high: 'Overweight' },
};

const getVitalBarColor = (value, testType) => {
  if (value === null || value === undefined) return '#666666';
  const range = VITAL_RANGES[testType];
  if (!range) return '#666666';
  if (value < range.low) return '#606060';
  if (value > range.high) return '#5c5c5c';
  return '#6f6f6f';
};

const getVitalInterpretation = (value, testType) => {
  if (value === null || value === undefined) return '';
  const interp = VITAL_INTERPRETATIONS[testType];
  const range = VITAL_RANGES[testType];
  if (!interp || !range) return '';
  if (value < range.low) return interp.low;
  if (value > range.high) return interp.high;
  return interp.normal;
};

const vitalToPercentage = (value, testType) => {
  if (value === null || value === undefined) return 0;
  const range = VITAL_RANGES[testType];
  if (!range) return 50;
  const [min, max] = range.scale;
  return Math.min(95, Math.max(8, ((value - min) / (max - min)) * 100));
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val);
};

const CHART_FIELDS = ['systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'bodyTemperature', 'painScore', 'bloodGlucose', 'bodyMassIndex'];
const CHART_UNITS = {
  systolicBloodPressure: 'mmHg', diastolicBloodPressure: 'mmHg', meanArterialPressure: 'mmHg',
  heartRate: 'bpm', respiratoryRate: 'breaths/min', oxygenSaturation: '%',
  painScore: '/10', bloodGlucose: 'mg/dL', bodyMassIndex: '',
};

const getChartTestType = (fn, record) => {
  if (fn === 'bodyTemperature') {
    return (record.temperatureUnit || '').toLowerCase().startsWith('c') ? 'bodyTemperatureC' : 'bodyTemperatureF';
  }
  return fn;
};

const getChartUnit = (fn, record) => {
  if (fn === 'bodyTemperature') {
    return (record.temperatureUnit || '').toLowerCase().startsWith('c') ? '\u00B0C' : '\u00B0F';
  }
  return CHART_UNITS[fn] || '';
};

/* ======= PDF Bar Chart Components ======= */
const VitalBarChartPDF = ({ label, value, unit, testType }) => {
  const color = getVitalBarColor(value, testType);
  const interpretation = getVitalInterpretation(value, testType);
  const barWidth = vitalToPercentage(value, testType);
  const displayValue = unit ? `${value} ${unit}` : String(value);

  return (
    <View style={styles.barChartRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.barValue}>{displayValue}</Text>
      </View>
      {interpretation ? (
        <Text style={[styles.barInterpretation, { color }]}>{interpretation}</Text>
      ) : null}
    </View>
  );
};

const ChartLegendPDF = () => (
  <View style={styles.chartLegend}>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#6f6f6f' }]} />
      <Text style={styles.legendText}>Normal</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#606060' }]} />
      <Text style={styles.legendText}>Low</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#5c5c5c' }]} />
      <Text style={styles.legendText}>High</Text>
    </View>
  </View>
);

/* ======= Section definitions ======= */
const SECTION_DEFS = [
  {
    key: 'provider-info',
    title: 'Provider Information',
    getFields: (record) => [
      hasValue(record.provider) && { label: 'Provider', value: record.provider },
      hasValue(record.facility) && { label: 'Facility', value: record.facility },
    ].filter(Boolean),
    getCharts: () => [],
  },
  {
    key: 'blood-pressure',
    title: 'Blood Pressure',
    getCharts: (record) => [
      hasValue(record.systolicBloodPressure) && { label: 'Systolic BP', value: record.systolicBloodPressure, unit: 'mmHg', testType: 'systolicBloodPressure' },
      hasValue(record.diastolicBloodPressure) && { label: 'Diastolic BP', value: record.diastolicBloodPressure, unit: 'mmHg', testType: 'diastolicBloodPressure' },
      hasValue(record.meanArterialPressure) && { label: 'Mean Arterial Pressure', value: record.meanArterialPressure, unit: 'mmHg', testType: 'meanArterialPressure' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.bloodPressureSite) && { label: 'Blood Pressure Site', value: record.bloodPressureSite },
      hasValue(record.patientPosition) && { label: 'Patient Position', value: record.patientPosition },
    ].filter(Boolean),
  },
  {
    key: 'heart-rate',
    title: 'Heart Rate & Pulse',
    getCharts: (record) => [
      hasValue(record.heartRate) && { label: 'Heart Rate', value: record.heartRate, unit: 'bpm', testType: 'heartRate' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.pulseRhythm) && { label: 'Pulse Rhythm', value: record.pulseRhythm },
      hasValue(record.pulseStrength) && { label: 'Pulse Strength', value: record.pulseStrength },
    ].filter(Boolean),
  },
  {
    key: 'respiratory',
    title: 'Respiratory',
    getCharts: (record) => [
      hasValue(record.respiratoryRate) && { label: 'Respiratory Rate', value: record.respiratoryRate, unit: 'breaths/min', testType: 'respiratoryRate' },
      hasValue(record.oxygenSaturation) && { label: 'Oxygen Saturation', value: record.oxygenSaturation, unit: '%', testType: 'oxygenSaturation' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.supplementalOxygen) && { label: 'Supplemental Oxygen', value: record.supplementalOxygen },
      (hasValue(record.oxygenFlowRate) && record.oxygenFlowRate !== 0) && { label: 'Oxygen Flow Rate', value: `${record.oxygenFlowRate} L/min` },
    ].filter(Boolean),
  },
  {
    key: 'temperature',
    title: 'Temperature',
    getCharts: (record) => {
      const testType = getChartTestType('bodyTemperature', record);
      const unit = getChartUnit('bodyTemperature', record);
      return [
        hasValue(record.bodyTemperature) && { label: 'Body Temperature', value: record.bodyTemperature, unit, testType },
      ].filter(Boolean);
    },
    getFields: (record) => [
      hasValue(record.temperatureRoute) && { label: 'Temperature Route', value: record.temperatureRoute },
    ].filter(Boolean),
  },
  {
    key: 'pain-assessment',
    title: 'Pain Assessment',
    getCharts: (record) => [
      hasValue(record.painScore) && { label: 'Pain Score', value: record.painScore, unit: '/10', testType: 'painScore' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.painLocation) && { label: 'Pain Location', value: record.painLocation },
    ].filter(Boolean),
  },
  {
    key: 'body-measurements',
    title: 'Body Measurements',
    getCharts: (record) => [
      (hasValue(record.bodyMassIndex) && record.bodyMassIndex !== 0) && { label: 'Body Mass Index', value: record.bodyMassIndex, unit: '', testType: 'bodyMassIndex' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.weight) && { label: 'Weight', value: `${record.weight} ${record.weightUnit || ''}`.trim() },
      hasValue(record.height) && { label: 'Height', value: `${record.height} ${record.heightUnit || ''}`.trim() },
      (hasValue(record.headCircumference) && record.headCircumference !== 0) && { label: 'Head Circumference', value: `${record.headCircumference} cm` },
    ].filter(Boolean),
  },
  {
    key: 'blood-glucose',
    title: 'Blood Glucose',
    getCharts: (record) => [
      hasValue(record.bloodGlucose) && { label: 'Blood Glucose', value: record.bloodGlucose, unit: 'mg/dL', testType: 'bloodGlucose' },
    ].filter(Boolean),
    getFields: (record) => [
      hasValue(record.glucoseMeasurementTiming) && { label: 'Measurement Timing', value: record.glucoseMeasurementTiming },
    ].filter(Boolean),
  },
];

/* ======= Category Section ======= */
const CategorySection = ({ sectionDef, record }) => {
  const charts = sectionDef.getCharts(record);
  const fields = sectionDef.getFields(record);
  if (charts.length === 0 && fields.length === 0) return null;
  const totalItems = charts.length + fields.length;

  return (
    <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{sectionDef.title}</Text>
      {charts.length > 0 && (
        <View style={styles.chartContainer}>
          <ChartLegendPDF />
          {charts.map((c, i) => (
            <VitalBarChartPDF key={i} label={c.label} value={c.value} unit={c.unit} testType={c.testType} />
          ))}
        </View>
      )}
      {fields.map((f, i) => (
        <View key={i} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <View style={styles.numberedItem}>
            <Text style={styles.itemNumber}>1.</Text>
            <Text style={styles.itemContent}>{safeString(f.value)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

/* ======= Main PDF Component ======= */
const VitalSignsTableDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.vital_signs_table) return templateData.vital_signs_table;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.vital_signs_table) return docData.vital_signs_table;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Vital Signs Table</Text>
          </View>
          <Text style={styles.noData}>No vital signs table data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Vital Signs Table</Text>
          <Text style={styles.documentSubtitle}>Clinical Monitoring Report</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Record {idx + 1}</Text>
              {(record.date || record.createdAt) && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date || record.createdAt)}</Text>
              )}
            </View>
            {SECTION_DEFS.map((sectionDef) => (
              <CategorySection key={sectionDef.key} sectionDef={sectionDef} record={record} />
            ))}
          </View>
        ))}

        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default VitalSignsTableDocumentPDFTemplate;
