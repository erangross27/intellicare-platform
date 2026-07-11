import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PreOperativeAssessmentsDocumentPDFTemplate - December 2025 Standards
 *
 * Features:
 * - Helvetica font, fontSize 12 (December 2025 standard)
 * - Bar chart visualization for clinical scores
 * - wrap={false} on each section (allows natural page breaks)
 * - Splits comma-separated fields into individual items
 * - Parses cardiovascular risk into groups (RCRI, Echocardiogram, ECG)
 * - Parses special considerations into labeled groups
 */

// filterNulls helper - prevents React PDF crashes on null/undefined array items
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

// Split comma-separated text into array
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(',').map(item => item.trim()).filter(item => item.length > 0);
};

// Split text into sentences by period
const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// Parse special considerations into labeled groups
const parseSpecialConsiderations = (text) => {
  if (!text || typeof text !== 'string') return [];

  const groups = [];
  const labels = ['Difficult Airway Protocol', 'Malignant Hyperthermia', 'Latex Allergy', 'OSA Management'];

  let remaining = text;

  labels.forEach((label, idx) => {
    const labelIndex = remaining.toLowerCase().indexOf(label.toLowerCase());
    if (labelIndex !== -1) {
      let endIndex = remaining.length;
      for (let i = idx + 1; i < labels.length; i++) {
        const nextLabelIndex = remaining.toLowerCase().indexOf(labels[i].toLowerCase());
        if (nextLabelIndex !== -1 && nextLabelIndex > labelIndex) {
          endIndex = nextLabelIndex;
          break;
        }
      }

      const content = remaining.substring(labelIndex, endIndex).trim();
      if (content) {
        const colonIndex = content.indexOf(':');
        if (colonIndex !== -1) {
          const groupLabel = content.substring(0, colonIndex).trim();
          const itemsText = content.substring(colonIndex + 1).trim();
          const items = splitByComma(itemsText);
          if (items.length > 0) {
            groups.push({ label: groupLabel, items });
          }
        } else {
          groups.push({ label, items: [content] });
        }
      }
    }
  });

  if (groups.length === 0 && text.trim()) {
    return [{ label: '', items: splitByComma(text) }];
  }

  return groups;
};

// Parse risk stratification to detect NSQIP calculator
const parseRiskStratification = (text) => {
  if (!text || typeof text !== 'string') return { nsqip: null, other: [] };

  const result = { nsqip: null, other: [] };

  // Check for NSQIP
  const nsqipMatch = text.toLowerCase().includes('nsqip');
  if (nsqipMatch) {
    // Find NSQIP section
    const nsqipIndex = text.toLowerCase().indexOf('nsqip');
    let endIndex = text.length;

    // NSQIP content typically has percentages
    const nsqipContent = text.substring(nsqipIndex);
    const colonIndex = nsqipContent.indexOf(':');
    if (colonIndex !== -1) {
      const label = nsqipContent.substring(0, colonIndex).trim();
      const itemsText = nsqipContent.substring(colonIndex + 1).trim();
      const items = splitByComma(itemsText);
      result.nsqip = { label, items };
    } else {
      result.nsqip = { label: 'NSQIP Risk Calculator', items: [nsqipContent.trim()] };
    }

    // Get content before NSQIP
    const beforeNsqip = text.substring(0, nsqipIndex).trim();
    if (beforeNsqip) {
      result.other = splitByComma(beforeNsqip);
    }
  } else {
    result.other = splitByComma(text);
  }

  return result;
};

// ============== BAR CHART SCORE EXTRACTION ==============

// Extract ASA Class (I-V) from asaClass field
const extractASA = (text) => {
  if (!text) return null;
  const str = String(text).toUpperCase();
  const match = str.match(/ASA\s*(I{1,3}V?|IV|V)/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };
    return { value: romanMap[roman] || null, max: 5, raw: `ASA ${roman}` };
  }
  return null;
};

// Extract RCRI Score (0-6) from cardiovascularRisk field
const extractRCRI = (text) => {
  if (!text) return null;
  const match = String(text).match(/RCRI\s*(?:Score)?[:\s]*(\d+)/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 6, raw: `${match[1]}/6` };
  }
  return null;
};

// Extract LVEF % from cardiovascularRisk field
const extractLVEF = (text) => {
  if (!text) return null;
  const match = String(text).match(/(?:LVEF|EF)\s*[:\s]*(\d+)\s*%/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 100, raw: `${match[1]}%` };
  }
  return null;
};

// Extract Mallampati Class (I-IV) from airwayAssessment field
const extractMallampati = (text) => {
  if (!text) return null;
  const str = String(text).toUpperCase();
  const match = str.match(/MALLAMPATI\s*(?:CLASS)?\s*(I{1,3}V?|IV)/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
    return { value: romanMap[roman] || null, max: 4, raw: `Class ${roman}` };
  }
  return null;
};

// Extract STOP-BANG Score (0-8) from pulmonaryRisk field
const extractSTOPBANG = (text) => {
  if (!text) return null;
  const match = String(text).match(/STOP[- ]?BANG\s*(?:Score)?[:\s]*(\d+)\s*(?:\/\s*8)?/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 8, raw: `${match[1]}/8` };
  }
  return null;
};

// Extract FEV1 % from pulmonaryRisk field
const extractFEV1 = (text) => {
  if (!text) return null;
  const match = String(text).match(/FEV1[:\s]*(\d+)\s*%/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 100, raw: `${match[1]}%` };
  }
  return null;
};

// Extract AHI from pulmonaryRisk field
const extractAHI = (text) => {
  if (!text) return null;
  const match = String(text).match(/AHI\s*[:\s]*(\d+(?:\.\d+)?)/i);
  if (match) {
    return { value: parseFloat(match[1]), max: 60, raw: `${match[1]} events/hr` };
  }
  return null;
};

// Extract METs from functionalStatus field
const extractMETs = (text) => {
  if (!text) return null;
  const str = String(text);
  if (str.match(/<\s*4\s*METs/i)) {
    return { value: 3, max: 10, raw: '<4 METs' };
  }
  if (str.match(/[≥>]\s*4\s*METs/i)) {
    return { value: 6, max: 10, raw: '≥4 METs' };
  }
  const match = str.match(/(\d+(?:\.\d+)?)\s*METs/i);
  if (match) {
    return { value: parseFloat(match[1]), max: 10, raw: `${match[1]} METs` };
  }
  return null;
};

// Extract BMI from medicalHistory field
const extractBMI = (text) => {
  if (!text) return null;
  const match = String(text).match(/BMI\s*[:\s]*(\d+(?:\.\d+)?)/i);
  if (match) {
    return { value: parseFloat(match[1]), max: 60, raw: String(match[1]) };
  }
  return null;
};

// Color coding functions
const getRiskColor = (percentage) => {
  if (percentage <= 25) return '#898989';
  if (percentage <= 50) return '#7a7a7a';
  if (percentage <= 75) return '#a7a7a7';
  return '#777777';
};

const getProtectiveColor = (percentage) => {
  if (percentage >= 80) return '#898989';
  if (percentage >= 60) return '#7a7a7a';
  if (percentage >= 40) return '#a7a7a7';
  return '#777777';
};

const getScoreColor = (scoreType, value, max) => {
  const percentage = (value / max) * 100;
  if (['LVEF', 'FEV1', 'METs'].includes(scoreType)) {
    return getProtectiveColor(percentage);
  }
  return getRiskColor(percentage);
};

const getInterpretation = (scoreType, value) => {
  switch (scoreType) {
    case 'ASA':
      if (value === 1) return 'Healthy patient';
      if (value === 2) return 'Mild systemic disease';
      if (value === 3) return 'Severe systemic disease';
      if (value === 4) return 'Life-threatening disease';
      return 'Moribund patient';
    case 'RCRI':
      if (value === 0) return 'Very low cardiac risk';
      if (value <= 1) return 'Low cardiac risk';
      if (value <= 2) return 'Intermediate cardiac risk';
      return 'High cardiac risk';
    case 'LVEF':
      if (value >= 55) return 'Normal LV function';
      if (value >= 45) return 'Mildly reduced';
      if (value >= 35) return 'Moderately reduced';
      return 'Severely reduced';
    case 'Mallampati':
      if (value === 1) return 'Easy intubation expected';
      if (value === 2) return 'Likely easy intubation';
      if (value === 3) return 'Potentially difficult';
      return 'Difficult intubation likely';
    case 'STOPBANG':
      if (value <= 2) return 'Low OSA risk';
      if (value <= 4) return 'Intermediate OSA risk';
      return 'High OSA risk';
    case 'FEV1':
      if (value >= 80) return 'Normal lung function';
      if (value >= 60) return 'Mild obstruction';
      if (value >= 40) return 'Moderate obstruction';
      return 'Severe obstruction';
    case 'AHI':
      if (value < 5) return 'Normal (no OSA)';
      if (value < 15) return 'Mild OSA';
      if (value < 30) return 'Moderate OSA';
      return 'Severe OSA';
    case 'METs':
      if (value >= 10) return 'Excellent functional capacity';
      if (value >= 7) return 'Good functional capacity';
      if (value >= 4) return 'Moderate functional capacity';
      return 'Poor functional capacity';
    case 'BMI':
      if (value < 18.5) return 'Underweight';
      if (value < 25) return 'Normal weight';
      if (value < 30) return 'Overweight';
      if (value < 35) return 'Class I Obesity';
      if (value < 40) return 'Class II Obesity';
      return 'Class III Obesity (Severe)';
    default:
      return '';
  }
};

// Prepare chart data for PDF
const prepareChartData = (record) => {
  const charts = [];

  const asa = extractASA(record.asaClass);
  if (asa && asa.value) {
    charts.push({
      key: 'ASA', label: 'ASA Physical Status', value: asa.value, max: asa.max,
      percentage: (asa.value / asa.max) * 100, rawValue: asa.raw,
      color: getScoreColor('ASA', asa.value, asa.max),
      interpretation: getInterpretation('ASA', asa.value), category: 'Cardiac Risk'
    });
  }

  const rcri = extractRCRI(record.cardiovascularRisk);
  if (rcri && rcri.value !== null) {
    charts.push({
      key: 'RCRI', label: 'RCRI Score', value: rcri.value, max: rcri.max,
      percentage: (rcri.value / rcri.max) * 100, rawValue: rcri.raw,
      color: getScoreColor('RCRI', rcri.value, rcri.max),
      interpretation: getInterpretation('RCRI', rcri.value), category: 'Cardiac Risk'
    });
  }

  const lvef = extractLVEF(record.cardiovascularRisk);
  if (lvef && lvef.value) {
    charts.push({
      key: 'LVEF', label: 'LVEF (Ejection Fraction)', value: lvef.value, max: lvef.max,
      percentage: lvef.value, rawValue: lvef.raw,
      color: getScoreColor('LVEF', lvef.value, lvef.max),
      interpretation: getInterpretation('LVEF', lvef.value), category: 'Cardiac Risk'
    });
  }

  const mallampati = extractMallampati(record.airwayAssessment);
  if (mallampati && mallampati.value) {
    charts.push({
      key: 'Mallampati', label: 'Mallampati Class', value: mallampati.value, max: mallampati.max,
      percentage: (mallampati.value / mallampati.max) * 100, rawValue: mallampati.raw,
      color: getScoreColor('Mallampati', mallampati.value, mallampati.max),
      interpretation: getInterpretation('Mallampati', mallampati.value), category: 'Airway Assessment'
    });
  }

  const stopbang = extractSTOPBANG(record.pulmonaryRisk);
  if (stopbang && stopbang.value !== null) {
    charts.push({
      key: 'STOPBANG', label: 'STOP-BANG Score', value: stopbang.value, max: stopbang.max,
      percentage: (stopbang.value / stopbang.max) * 100, rawValue: stopbang.raw,
      color: getScoreColor('STOPBANG', stopbang.value, stopbang.max),
      interpretation: getInterpretation('STOPBANG', stopbang.value), category: 'Airway Assessment'
    });
  }

  const fev1 = extractFEV1(record.pulmonaryRisk);
  if (fev1 && fev1.value) {
    charts.push({
      key: 'FEV1', label: 'FEV1 % Predicted', value: fev1.value, max: fev1.max,
      percentage: fev1.value, rawValue: fev1.raw,
      color: getScoreColor('FEV1', fev1.value, fev1.max),
      interpretation: getInterpretation('FEV1', fev1.value), category: 'Pulmonary Function'
    });
  }

  const ahi = extractAHI(record.pulmonaryRisk);
  if (ahi && ahi.value !== null) {
    charts.push({
      key: 'AHI', label: 'AHI (Sleep Apnea)', value: ahi.value, max: ahi.max,
      percentage: Math.min((ahi.value / ahi.max) * 100, 100), rawValue: ahi.raw,
      color: getScoreColor('AHI', ahi.value, ahi.max),
      interpretation: getInterpretation('AHI', ahi.value), category: 'Pulmonary Function'
    });
  }

  const mets = extractMETs(record.functionalStatus);
  if (mets && mets.value) {
    charts.push({
      key: 'METs', label: 'Functional Capacity (METs)', value: mets.value, max: mets.max,
      percentage: (mets.value / mets.max) * 100, rawValue: mets.raw,
      color: getScoreColor('METs', mets.value, mets.max),
      interpretation: getInterpretation('METs', mets.value), category: 'Functional Status'
    });
  }

  const bmi = extractBMI(record.medicalHistory);
  if (bmi && bmi.value) {
    charts.push({
      key: 'BMI', label: 'BMI', value: bmi.value, max: bmi.max,
      percentage: Math.min((bmi.value / bmi.max) * 100, 100), rawValue: bmi.raw,
      color: getScoreColor('BMI', bmi.value, bmi.max),
      interpretation: getInterpretation('BMI', bmi.value), category: 'Body Composition'
    });
  }

  return charts;
};

// Chart styles - December 2025 standard
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
    marginBottom: 12,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#606060',
    paddingBottom: 6
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap',
    gap: 12
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4
  },
  legendText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#6b7280'
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    borderBottomWidth: 1,
    borderBottomColor: '#757575',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 8
  },
  categoryName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#4c4c4c',
    flex: 1
  },
  categoryDescription: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#757575',
    textAlign: 'right'
  },
  barRow: {
    marginBottom: 10
  },
  labeledRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
    width: 140
  },
  barBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginRight: 8
  },
  barFill: {
    height: 14,
    borderRadius: 3
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 70,
    textAlign: 'right'
  },
  interpretation: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    marginLeft: 140
  }
});

// PDF Bar Chart Component
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barRow}>
    <View style={chartStyles.labeledRow}>
      <Text style={chartStyles.barLabel}>{String(label)}</Text>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.interpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

// PDF Legend Component
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={chartStyles.legendText}>Normal/Low</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={chartStyles.legendText}>Mild/Moderate</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={chartStyles.legendText}>Moderate/High</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={chartStyles.legendText}>Severe/Very High</Text>
    </View>
  </View>
);

// PDF Category Header Component
const PDFCategoryHeader = ({ name, description }) => (
  <View style={chartStyles.categoryHeader}>
    <Text style={chartStyles.categoryName}>{String(name)}</Text>
    <Text style={chartStyles.categoryDescription}>{String(description)}</Text>
  </View>
);

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    paddingBottom: 8,
    borderBottom: '1px solid #000000',
    textTransform: 'uppercase'
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #666666',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    textDecoration: 'underline'
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'uppercase'
  },
  text: {
    marginBottom: 4,
    marginLeft: 10
  },
  listItem: {
    marginBottom: 2,
    marginLeft: 20
  },
  groupContainer: {
    marginBottom: 8,
    marginLeft: 10
  },
  divider: {
    marginTop: 12,
    marginBottom: 12,
    borderBottom: '0.5px solid #cccccc'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#666666'
  }
});

// Format date helper
const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(date);
  }
};

const PreOperativeAssessmentsDocumentPDFTemplate = ({ data }) => {
  // Data unwrapping
  const recordsArray = Array.isArray(data) ? data : [data];
  const validRecords = filterNulls(recordsArray);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Pre-Operative Assessments</Text>

        {validRecords.map((record, idx) => (
          <View key={idx}>
            {/* Record Header - Keep-With-Next: Title + first field */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                Assessment {idx + 1}
                {record.assessmentDate ? ` - ${formatDate(record.assessmentDate)}` : ''}
              </Text>

              {/* First field stays with title */}
              {record.scheduledSurgeryDate && (
                <View>
                  <Text style={styles.fieldLabel}>Scheduled Surgery Date</Text>
                  <Text style={styles.text}>{formatDate(record.scheduledSurgeryDate)}</Text>
                </View>
              )}
              {!record.scheduledSurgeryDate && record.plannedProcedure && (
                <View>
                  <Text style={styles.fieldLabel}>Planned Procedure</Text>
                  <Text style={styles.text}>{record.plannedProcedure}</Text>
                </View>
              )}
            </View>

            {/* Remaining header fields flow naturally */}
            {record.scheduledSurgeryDate && record.plannedProcedure && (
              <View>
                <Text style={styles.fieldLabel}>Planned Procedure</Text>
                <Text style={styles.text}>{record.plannedProcedure}</Text>
              </View>
            )}

            {record.preOpDiagnosis && (
              <View>
                <Text style={styles.fieldLabel}>Pre-Op Diagnosis</Text>
                <Text style={styles.text}>{record.preOpDiagnosis}</Text>
              </View>
            )}

            {/* Score Overview - Bar Chart Section */}
            {(() => {
              const chartData = prepareChartData(record);
              if (chartData.length === 0) return null;

              // Group charts by category
              const categoryOrder = ['Cardiac Risk', 'Airway Assessment', 'Pulmonary Function', 'Functional Status', 'Body Composition'];
              const categoryDescriptions = {
                'Cardiac Risk': 'Perioperative cardiac assessment',
                'Airway Assessment': 'Intubation difficulty prediction',
                'Pulmonary Function': 'Respiratory status evaluation',
                'Functional Status': 'Exercise tolerance capacity',
                'Body Composition': 'Obesity-related risk factors'
              };

              const groupedCharts = {};
              chartData.forEach(chart => {
                if (!groupedCharts[chart.category]) {
                  groupedCharts[chart.category] = [];
                }
                groupedCharts[chart.category].push(chart);
              });

              return (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Score Overview</Text>
                  <PDFLegend />

                  {categoryOrder.map(category => {
                    const charts = groupedCharts[category];
                    if (!charts || charts.length === 0) return null;

                    return (
                      <View key={category}>
                        <PDFCategoryHeader
                          name={category}
                          description={categoryDescriptions[category] || ''}
                        />
                        {charts.map((chart, cIdx) => (
                          <PDFBarChart
                            key={cIdx}
                            label={chart.label}
                            percentage={chart.percentage}
                            rawValue={chart.rawValue}
                            color={chart.color}
                            interpretation={chart.interpretation}
                          />
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Medical History - Split by comma */}
            {record.medicalHistory && (() => {
              const items = splitByComma(record.medicalHistory);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Medical History</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Surgical History - Split by comma */}
            {record.surgicalHistory && (() => {
              const items = splitByComma(record.surgicalHistory);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Surgical History</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Current Medications - Split by comma */}
            {record.currentMedications && (() => {
              const items = splitByComma(record.currentMedications);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Current Medications</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Allergies - Split by comma with colon handling */}
            {record.allergies && (() => {
              const items = splitByComma(record.allergies);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Allergies</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Additional Clinical Data Section - Non-duplicated fields only */}
            {/* NOTE: ASA, Cardiovascular Risk, Pulmonary Risk, Airway Assessment, Functional Status
                are now displayed in the Score Overview bar chart above (removes duplicate data) */}
            {(record.renalFunction || record.hepaticFunction || record.coagulationStatus ||
              record.anesthesiaType || record.npoStatus) && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Additional Clinical Data</Text>

                  {record.renalFunction && (
                    <View>
                      <Text style={styles.fieldLabel}>Renal Function</Text>
                      <Text style={styles.text}>{record.renalFunction}</Text>
                    </View>
                  )}
                  {!record.renalFunction && record.hepaticFunction && (
                    <View>
                      <Text style={styles.fieldLabel}>Hepatic Function</Text>
                      <Text style={styles.text}>{record.hepaticFunction}</Text>
                    </View>
                  )}
                </View>

                {/* Remaining fields */}
                {record.renalFunction && record.hepaticFunction && (
                  <View>
                    <Text style={styles.fieldLabel}>Hepatic Function</Text>
                    <Text style={styles.text}>{record.hepaticFunction}</Text>
                  </View>
                )}

                {record.coagulationStatus && (
                  <View>
                    <Text style={styles.fieldLabel}>Coagulation Status</Text>
                    <Text style={styles.text}>{record.coagulationStatus}</Text>
                  </View>
                )}

                {record.anesthesiaType && (
                  <View>
                    <Text style={styles.fieldLabel}>Anesthesia Type</Text>
                    <Text style={styles.text}>{record.anesthesiaType}</Text>
                  </View>
                )}

                {record.npoStatus && (
                  <View>
                    <Text style={styles.fieldLabel}>NPO Status</Text>
                    <Text style={styles.text}>{record.npoStatus}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Pre-Op Testing - Split by comma */}
            {record.preOpTesting && (() => {
              const items = splitByComma(record.preOpTesting);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Pre-Op Testing</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Risk Stratification with NSQIP */}
            {record.riskStratification && (() => {
              const parsed = parseRiskStratification(record.riskStratification);
              const hasContent = parsed.nsqip || parsed.other.length > 0;
              if (!hasContent) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Risk Stratification</Text>
                    {/* First content */}
                    {parsed.other.length > 0 && (
                      <Text style={styles.listItem}>• {parsed.other[0]}</Text>
                    )}
                    {parsed.other.length === 0 && parsed.nsqip && (
                      <View style={styles.groupContainer}>
                        <Text style={styles.subsectionTitle}>{parsed.nsqip.label}</Text>
                        {filterNulls(parsed.nsqip.items).slice(0, 1).map((item, i) => (
                          <Text key={i} style={styles.listItem}>• {item}</Text>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Remaining other items */}
                  {parsed.other.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}

                  {/* NSQIP group (if other items were first) */}
                  {parsed.other.length > 0 && parsed.nsqip && (
                    <View style={styles.groupContainer}>
                      <Text style={styles.subsectionTitle}>{parsed.nsqip.label}</Text>
                      {filterNulls(parsed.nsqip.items).map((item, i) => (
                        <Text key={i} style={styles.listItem}>• {item}</Text>
                      ))}
                    </View>
                  )}

                  {/* Remaining NSQIP items (if NSQIP was first) */}
                  {parsed.other.length === 0 && parsed.nsqip && filterNulls(parsed.nsqip.items).slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Clearance - Split by sentences */}
            {record.clearance && (() => {
              const items = splitIntoSentences(record.clearance);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Clearance</Text>
                    <Text style={styles.listItem}>• {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>• {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Special Considerations - Split by period with numbering */}
            {record.specialConsiderations && (() => {
              const items = splitIntoSentences(record.specialConsiderations);
              if (items.length === 0) return null;

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Special Considerations</Text>
                    <Text style={styles.listItem}>1. {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i} style={styles.listItem}>{i + 2}. {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (() => {
              const validRecs = filterNulls(record.recommendations);
              if (validRecs.length === 0) return null;

              const getRecText = (rec) => {
                if (typeof rec === 'string') return rec;
                if (rec && typeof rec === 'object' && rec.recommendation) return rec.recommendation;
                return '';
              };

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {validRecs[0] && getRecText(validRecs[0]) && (
                      <Text style={styles.listItem}>• {getRecText(validRecs[0])}</Text>
                    )}
                  </View>
                  {validRecs.slice(1).map((rec, recIdx) => {
                    const recText = getRecText(rec);
                    if (!recText) return null;
                    return (
                      <Text key={recIdx} style={styles.listItem}>• {recText}</Text>
                    );
                  })}
                </View>
              );
            })()}

            {idx < validRecords.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default PreOperativeAssessmentsDocumentPDFTemplate;
