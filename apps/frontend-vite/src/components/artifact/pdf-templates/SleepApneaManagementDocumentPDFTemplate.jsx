/**
 * SleepApneaManagementDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sleep apnea management
 * Collection: sleep_apnea_management
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  /* Bar chart styles */
  chartSection: { marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4 },
  chartTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  legendColor: { width: 12, height: 12, marginRight: 4, borderRadius: 2 },
  legendText: { fontSize: 9, color: '#333333' },
  barChartRow: { marginBottom: 10 },
  barLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
  barContainer: { flexDirection: 'row', alignItems: 'center', height: 20 },
  barBackground: { flex: 1, height: 16, backgroundColor: '#e5e5e5', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginLeft: 8, width: 70, textAlign: 'right' },
  barInterpretation: { fontSize: 9, marginTop: 2, paddingLeft: 4 },
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
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
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
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* Clinical interpretation helpers */
const getAHIInterpretation = (score) => { if (score < 5) return { color: '#898989', text: 'Normal' }; if (score < 15) return { color: '#7a7a7a', text: 'Mild OSA' }; if (score < 30) return { color: '#a7a7a7', text: 'Moderate OSA' }; return { color: '#777777', text: 'Severe OSA' }; };
const getODIInterpretation = (score) => { if (score < 5) return { color: '#898989', text: 'Normal' }; if (score < 15) return { color: '#7a7a7a', text: 'Mild' }; if (score < 30) return { color: '#a7a7a7', text: 'Moderate' }; return { color: '#777777', text: 'Severe' }; };
const getLowestO2Interpretation = (score) => { if (score >= 90) return { color: '#898989', text: 'Normal' }; if (score >= 85) return { color: '#7a7a7a', text: 'Mild Desaturation' }; if (score >= 80) return { color: '#a7a7a7', text: 'Moderate Desaturation' }; return { color: '#777777', text: 'Severe Desaturation' }; };
const getEpworthInterpretation = (score) => { if (score <= 5) return { color: '#898989', text: 'Normal' }; if (score <= 10) return { color: '#7a7a7a', text: 'Mild Sleepiness' }; if (score <= 12) return { color: '#a7a7a7', text: 'Moderate Sleepiness' }; return { color: '#777777', text: 'Severe Sleepiness' }; };
const getCPAPComplianceInterpretation = (score) => { if (score >= 70) return { color: '#898989', text: 'Good Compliance' }; if (score >= 50) return { color: '#7a7a7a', text: 'Moderate Compliance' }; if (score >= 30) return { color: '#a7a7a7', text: 'Poor Compliance' }; return { color: '#777777', text: 'Very Poor Compliance' }; };
const getCPAPUsageInterpretation = (hours) => { if (hours >= 6) return { color: '#898989', text: 'Excellent Usage' }; if (hours >= 4) return { color: '#7a7a7a', text: 'Good Usage' }; if (hours >= 2) return { color: '#a7a7a7', text: 'Inadequate Usage' }; return { color: '#777777', text: 'Poor Usage' }; };
const getResidualAHIInterpretation = (score) => { if (score < 5) return { color: '#898989', text: 'Well Controlled' }; if (score < 10) return { color: '#7a7a7a', text: 'Acceptable' }; if (score < 15) return { color: '#a7a7a7', text: 'Suboptimal' }; return { color: '#777777', text: 'Poor Control' }; };

const prepareChartData = (record) => {
  const charts = [];
  if (record.apneaHypopneaIndex != null) { const v = parseFloat(record.apneaHypopneaIndex); if (!isNaN(v) && v >= 0) { const interp = getAHIInterpretation(v); charts.push({ label: 'Apnea-Hypopnea Index (AHI)', percentage: Math.min(100, (v / 60) * 100), rawValue: `${v} events/hr`, color: interp.color, interpretation: interp.text }); } }
  if (record.oxygenDesaturationIndex != null) { const v = parseFloat(record.oxygenDesaturationIndex); if (!isNaN(v) && v >= 0) { const interp = getODIInterpretation(v); charts.push({ label: 'Oxygen Desaturation Index (ODI)', percentage: Math.min(100, (v / 60) * 100), rawValue: `${v} events/hr`, color: interp.color, interpretation: interp.text }); } }
  if (record.lowestOxygenSaturation != null) { const v = parseFloat(record.lowestOxygenSaturation); if (!isNaN(v) && v >= 0) { const interp = getLowestO2Interpretation(v); charts.push({ label: 'Lowest Oxygen Saturation', percentage: v, rawValue: `${v}%`, color: interp.color, interpretation: interp.text }); } }
  if (record.epworthSleepinessScore != null) { const v = parseFloat(record.epworthSleepinessScore); if (!isNaN(v) && v >= 0) { const interp = getEpworthInterpretation(v); charts.push({ label: 'Epworth Sleepiness Score (ESS)', percentage: (v / 24) * 100, rawValue: `${v}/24`, color: interp.color, interpretation: interp.text }); } }
  if (record.cpapComplianceRate != null) { const v = parseFloat(record.cpapComplianceRate); if (!isNaN(v) && v >= 0) { const interp = getCPAPComplianceInterpretation(v); charts.push({ label: 'CPAP Compliance Rate', percentage: v, rawValue: `${v}%`, color: interp.color, interpretation: interp.text }); } }
  if (record.averageCpapUsageHours != null) { const v = parseFloat(record.averageCpapUsageHours); if (!isNaN(v) && v >= 0) { const interp = getCPAPUsageInterpretation(v); charts.push({ label: 'Average CPAP Usage', percentage: Math.min(100, (v / 8) * 100), rawValue: `${v} hrs/night`, color: interp.color, interpretation: interp.text }); } }
  if (record.residualAhiOnTherapy != null) { const v = parseFloat(record.residualAhiOnTherapy); if (!isNaN(v) && v >= 0) { const interp = getResidualAHIInterpretation(v); charts.push({ label: 'Residual AHI on Therapy', percentage: Math.min(100, (v / 30) * 100), rawValue: `${v} events/hr`, color: interp.color, interpretation: interp.text }); } }
  return charts;
};

const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#898989' }]} /><Text style={styles.legendText}>Normal/Good</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={styles.legendText}>Mild</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={styles.legendText}>Moderate</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#777777' }]} /><Text style={styles.legendText}>Severe/Poor</Text></View>
  </View>
);

const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barLabel}>{String(label)}</Text>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}><View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }]} /></View>
      <Text style={styles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[styles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Diagnostic Metrics',
    fields: [
      { key: 'apneaHypopneaIndex', label: 'Apnea-Hypopnea Index (AHI)' },
      { key: 'oxygenDesaturationIndex', label: 'Oxygen Desaturation Index (ODI)' },
      { key: 'lowestOxygenSaturation', label: 'Lowest Oxygen Saturation' },
      { key: 'sleepApneaSeverity', label: 'Sleep Apnea Severity', isSentence: true },
      { key: 'epworthSleepinessScore', label: 'Epworth Sleepiness Score' },
    ],
  },
  {
    title: 'CPAP Therapy',
    fields: [
      { key: 'cpapPrescribed', label: 'CPAP Prescribed' },
      { key: 'cpapPressureSetting', label: 'CPAP Pressure Setting', isSentence: true },
      { key: 'cpapComplianceRate', label: 'CPAP Compliance Rate' },
      { key: 'averageCpapUsageHours', label: 'Average CPAP Usage' },
      { key: 'residualAhiOnTherapy', label: 'Residual AHI on Therapy' },
    ],
  },
  {
    title: 'Mask / Equipment',
    fields: [
      { key: 'maskType', label: 'Mask Type', isSentence: true },
      { key: 'maskLeakRate', label: 'Mask Leak Rate' },
    ],
  },
  {
    title: 'Sleep Study Results',
    fields: [
      { key: 'remSleepPercentage', label: 'REM Sleep Percentage' },
      { key: 'arousalIndex', label: 'Arousal Index' },
      { key: 'centralApneaIndex', label: 'Central Apnea Index' },
      { key: 'obstructiveApneaIndex', label: 'Obstructive Apnea Index' },
    ],
  },
  {
    title: 'Physical Exam',
    fields: [
      { key: 'neckCircumference', label: 'Neck Circumference' },
      { key: 'mallampatiScore', label: 'Mallampati Score', isSentence: true },
      { key: 'tonsilSize', label: 'Tonsil Size', isSentence: true },
      { key: 'positionalApnea', label: 'Positional Apnea' },
    ],
  },
  {
    title: 'Symptoms',
    fields: [
      { key: 'witnessedApneas', label: 'Witnessed Apneas' },
      { key: 'comorbidHypertension', label: 'Comorbid Hypertension' },
    ],
  },
  {
    title: 'Treatment',
    fields: [
      { key: 'surgicalInterventions', label: 'Surgical Interventions', isArray: true },
      { key: 'alternativeTherapyType', label: 'Alternative Therapy Type', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const SleepApneaManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.sleep_apnea_management) return Array.isArray(r.sleep_apnea_management) ? r.sleep_apnea_management : [r.sleep_apnea_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.sleep_apnea_management) return Array.isArray(dd.sleep_apnea_management) ? dd.sleep_apnea_management : [dd.sleep_apnea_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sleep Apnea Management</Text>
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
          <Text style={styles.documentTitle}>Sleep Apnea Management</Text>
        </View>

        {records.map((record, index) => {
          const chartData = prepareChartData(record);
          const hasChartData = chartData.length > 0;

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.date && (
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {record.sleepApneaSeverity || `Sleep Apnea Management ${index + 1}`}
                </Text>
              </View>

              {/* Score Overview Bar Chart */}
              {hasChartData && (
                <View style={styles.chartSection}>
                  <Text style={styles.chartTitle}>Score Overview</Text>
                  <PDFLegend />
                  {chartData.map((chart, cIdx) => (
                    <PDFBarChart key={cIdx} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />
                  ))}
                </View>
              )}

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
                if (!hasAnyVal) return null;

                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = record[field.key];
                      if (!hasVal(val)) return null;

                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                      if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SleepApneaManagementDocumentPDFTemplate;
