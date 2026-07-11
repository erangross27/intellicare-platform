import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1pt solid #cccccc',
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  doubleSeparator: {
    fontSize: 10,
    marginBottom: 16,
    color: '#666666',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  singleSeparator: {
    fontSize: 10,
    marginBottom: 8,
    color: '#999999',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    minWidth: 120,
    color: '#000000',
  },
  fieldValue: {
    fontSize: 12,
    flex: 1,
    color: '#000000',
  },
  textBlock: {
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 8,
    color: '#000000',
  },
  numberedItem: {
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 4,
    marginLeft: 16,
    color: '#000000',
  },
  // Bar Chart PDF styles
  chartContainer: {
    backgroundColor: '#f8f9fa',
    border: '1pt solid #dee2e6',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1pt solid #dee2e6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    color: '#666666',
  },
  barRow: {
    marginBottom: 6,
    padding: 6,
    backgroundColor: '#ffffff',
    border: '1pt solid #e5e7eb',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
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
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    minWidth: 55,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    minWidth: 70,
    textAlign: 'right',
  },
});

// Safe string helper for Unicode sanitization
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/²/g, '2');
  str = str.replace(/³/g, '3');
  return str;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// ==================== ABG BAR CHART (PDF) ====================

const ABG_RANGES = {
  ph:           { low: 7.35, high: 7.45, scale: [7.0, 7.8] },
  paco2:        { low: 35,   high: 45,   scale: [0, 100] },
  pao2:         { low: 80,   high: 100,  scale: [0, 150] },
  hco3:         { low: 22,   high: 26,   scale: [0, 50] },
  sao2:         { low: 95,   high: 100,  scale: [0, 100] },
  spo2:         { low: 95,   high: 100,  scale: [0, 100] },
  hr:           { low: 60,   high: 100,  scale: [0, 200] },
  rr:           { low: 12,   high: 20,   scale: [0, 40] },
  bpSystolic:   { low: 90,   high: 140,  scale: [0, 250] },
  bpDiastolic:  { low: 60,   high: 90,   scale: [0, 150] },
};

const ABG_INTERPRETATIONS = {
  ph:          { low: 'Acidosis',    high: 'Alkalosis' },
  paco2:       { low: 'Hypocapnia',  high: 'Hypercapnia' },
  pao2:        { low: 'Hypoxemia',   high: 'Hyperoxia' },
  hco3:        { low: 'Low',         high: 'Elevated' },
  sao2:        { low: 'Desaturation', high: 'Normal' },
  spo2:        { low: 'Hypoxemia',   high: 'Normal' },
  hr:          { low: 'Bradycardia', high: 'Tachycardia' },
  rr:          { low: 'Bradypnea',   high: 'Tachypnea' },
  bpSystolic:  { low: 'Hypotension', high: 'Hypertension' },
  bpDiastolic: { low: 'Hypotension', high: 'Hypertension' },
};

const ABG_PARSE_PATTERNS = [
  { regex: /BP\s+(\d+)\/(\d+)\s*(mmHg)?/i, isBP: true, unit: 'mmHg' },
  { regex: /pH\s+(\d+\.?\d*)/i, label: 'pH', testType: 'ph', unit: '' },
  { regex: /PaCO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaCO2', testType: 'paco2', unit: 'mmHg' },
  { regex: /PaO2\s+(\d+\.?\d*)\s*(mmHg)?/i, label: 'PaO2', testType: 'pao2', unit: 'mmHg' },
  { regex: /HCO3\s+(\d+\.?\d*)\s*(mEq\/L)?/i, label: 'HCO3', testType: 'hco3', unit: 'mEq/L' },
  { regex: /SaO2\s+(\d+\.?\d*)\s*%?/i, label: 'SaO2', testType: 'sao2', unit: '%' },
  { regex: /SpO2\s+(\d+\.?\d*)\s*%?/i, label: 'SpO2', testType: 'spo2', unit: '%' },
  { regex: /HR\s+(\d+\.?\d*)\s*(bpm)?/i, label: 'HR', testType: 'hr', unit: 'bpm' },
  { regex: /RR\s+(\d+\.?\d*)\s*(\/min)?/i, label: 'RR', testType: 'rr', unit: '/min' },
];

const parseVitalSigns = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const results = [];
  parts.forEach(part => {
    for (const pattern of ABG_PARSE_PATTERNS) {
      const match = part.match(pattern.regex);
      if (match) {
        if (pattern.isBP) {
          results.push({ label: 'BP (Systolic)', value: parseFloat(match[1]), unit: pattern.unit, testType: 'bpSystolic' });
          results.push({ label: 'BP (Diastolic)', value: parseFloat(match[2]), unit: pattern.unit, testType: 'bpDiastolic' });
        } else {
          results.push({ label: pattern.label, value: parseFloat(match[1]), unit: pattern.unit, testType: pattern.testType });
        }
        break;
      }
    }
  });
  return results;
};

const getAbgBarColor = (value, testType) => {
  const range = ABG_RANGES[testType];
  if (!range) return '#9ca3af';
  if (value < range.low) return '#606060';
  if (value > range.high) return '#5c5c5c';
  return '#6f6f6f';
};

const getAbgInterpretation = (value, testType) => {
  const range = ABG_RANGES[testType];
  const interp = ABG_INTERPRETATIONS[testType];
  if (!range || !interp) return '';
  if (value < range.low) return interp.low;
  if (value > range.high) return interp.high;
  return 'Normal';
};

const abgToPercentage = (value, testType) => {
  const range = ABG_RANGES[testType];
  if (!range) return 50;
  const [min, max] = range.scale;
  return Math.max(5, Math.min(100, ((value - min) / (max - min)) * 100));
};

// PDF Bar Chart Component
const AbgBarChartPDF = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={styles.barRow} wrap={false}>
    <Text style={styles.barLabel}>{label}</Text>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{rawValue}</Text>
      <Text style={[styles.barInterpretation, { color }]}>{interpretation}</Text>
    </View>
  </View>
);

// PDF Chart Legend
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

// ==================== MAIN COMPONENT ====================

const ArterialBloodGasesDocumentPDFTemplate = ({ document: docProp }) => {
  const templateData = docProp;

  const unwrapData = () => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) return templateData;
    const docData = templateData?.documentData || templateData?.data || templateData;
    const records = docData?.arterial_blood_gases || (Array.isArray(docData) ? docData : [docData]);
    return records.filter(r => r && (r.assessmentDate || r.clinicalStatus || r.interventions || r.response || r.plan));
  };

  const records = unwrapData();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  const renderSentenceField = (title, text) => {
    if (!text || String(text).trim() === '') return null;
    const sentences = splitBySentence(String(text));
    return (
      <View style={styles.sectionContainer} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.singleSeparator}>{'-'.repeat(40)}</Text>
        {sentences.length > 1 ? (
          sentences.map((s, i) => (
            <Text key={i} style={styles.numberedItem}>{i + 1}. {safeString(s)}</Text>
          ))
        ) : (
          <Text style={styles.textBlock}>{safeString(text)}</Text>
        )}
      </View>
    );
  };

  // Render vital signs as bar chart
  const renderVitalSignsChart = (vitalSigns) => {
    if (!vitalSigns || String(vitalSigns).trim() === '') return null;
    const chartData = parseVitalSigns(String(vitalSigns));
    if (chartData.length === 0) {
      // Fallback to text if parsing fails
      return renderSentenceField('VITAL SIGNS', vitalSigns);
    }

    return (
      <View style={styles.sectionContainer} wrap={false}>
        <Text style={styles.sectionTitle}>VITAL SIGNS</Text>
        <Text style={styles.singleSeparator}>{'-'.repeat(40)}</Text>
        <View style={styles.chartContainer}>
          <ChartLegendPDF />
          {chartData.map((item, ci) => {
            const color = getAbgBarColor(item.value, item.testType);
            const interpretation = getAbgInterpretation(item.value, item.testType);
            const percentage = abgToPercentage(item.value, item.testType);
            const display = item.unit ? `${item.value} ${item.unit}` : `${item.value}`;
            return (
              <AbgBarChartPDF
                key={ci}
                label={item.label}
                percentage={percentage}
                rawValue={safeString(display)}
                color={color}
                interpretation={interpretation}
              />
            );
          })}
        </View>
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Arterial Blood Gases</Text>
          <Text style={styles.textBlock}>No arterial blood gases records found.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Arterial Blood Gases</Text>

        {records.filter(r => r !== null && r !== undefined).map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>ARTERIAL BLOOD GASES {idx + 1}</Text>
            <Text style={styles.doubleSeparator}>{'='.repeat(40)}</Text>

            {/* Assessment Info */}
            {(record.assessmentDate || record.assessmentTime || record.clinicalStatus) && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>ASSESSMENT INFO</Text>
                <Text style={styles.singleSeparator}>{'-'.repeat(40)}</Text>
                {record.assessmentDate && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Assessment Date:</Text>
                    <Text style={styles.fieldValue}>{safeString(formatDate(record.assessmentDate))}</Text>
                  </View>
                )}
                {record.assessmentTime && String(record.assessmentTime).trim() && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Assessment Time:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.assessmentTime)}</Text>
                  </View>
                )}
                {record.clinicalStatus && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Clinical Status:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.clinicalStatus)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Vital Signs — Bar Chart */}
            {renderVitalSignsChart(record.vitalSigns)}

            {/* Interventions */}
            {renderSentenceField('INTERVENTIONS', record.interventions)}

            {/* Response */}
            {renderSentenceField('RESPONSE', record.response)}

            {/* Plan */}
            {renderSentenceField('PLAN', record.plan)}

            {/* Recommendations */}
            {(() => {
              const recs = record.recommendations;
              if (!recs || !Array.isArray(recs) || recs.length === 0) return null;
              return (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
                  <Text style={styles.singleSeparator}>{'-'.repeat(40)}</Text>
                  {recs.map((r, i) => (
                    <Text key={i} style={styles.numberedItem}>
                      {i + 1}. {safeString(r.recommendation || '')}{r.date ? ` (${formatDate(r.date)})` : ''}
                    </Text>
                  ))}
                </View>
              );
            })()}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ArterialBloodGasesDocumentPDFTemplate;
