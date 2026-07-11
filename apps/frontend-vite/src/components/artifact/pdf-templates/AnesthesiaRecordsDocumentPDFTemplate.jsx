import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AnesthesiaRecordsDocumentPDFTemplate - December 2025 Standards
 *
 * Features:
 * - Helvetica font (NOT Courier!)
 * - Large fonts (20pt title, 14pt section, 12pt content)
 * - Bar chart visualization for 6 categories, 15+ clinical metrics:
 *   - Physical Status: ASA Class
 *   - Perioperative Risk: STOP-BANG, Apfel, RCRI
 *   - Airway Assessment: Mallampati, Cormack-Lehane Grade
 *   - Pulmonary Function: FEV1, FVC, FEV1/FVC Ratio (protective - higher = better)
 *   - Sleep Study: AHI, Lowest O2 Saturation
 *   - NSQIP Risk: Serious Complication, Any Complication, Pneumonia, Cardiac, VTE
 * - Subtitle with numbered content pattern (no inline Label: Value)
 * - wrap={false} on each section (not container)
 * - No footer
 */

// ==================== BAR CHART CONFIGURATION ====================

// Anesthesia Score Categories - Medical groupings for bar chart display
// December 2025: Group scores by clinical assessment domain - Extended with 6 categories
const ANESTHESIA_SCORE_CATEGORIES = [
  {
    id: 'physical_status',
    name: 'Physical Status & Capacity',
    description: 'Overall health classification',
    scores: ['asaClass']
  },
  {
    id: 'perioperative_risk',
    name: 'Perioperative Risk Scores',
    description: 'Specific surgical risk factors',
    scores: ['stopBang', 'apfel', 'rcri']
  },
  {
    id: 'airway_assessment',
    name: 'Airway Assessment',
    description: 'Intubation difficulty indicators',
    scores: ['mallampati', 'intubationGrade']
  },
  {
    id: 'pulmonary_function',
    name: 'Pulmonary Function',
    description: 'Respiratory capacity measures',
    scores: ['fev1', 'fvc', 'fev1FvcRatio']
  },
  {
    id: 'sleep_study',
    name: 'Sleep Study Results',
    description: 'OSA severity indicators',
    scores: ['ahi', 'lowestO2']
  },
  {
    id: 'nsqip_risk',
    name: 'NSQIP Risk Calculator',
    description: 'Predicted surgical complications',
    scores: ['seriousComplication', 'anyComplication', 'pneumonia', 'cardiac', 'vte']
  }
];

// Anesthesia Clinical Score Configurations
const ANESTHESIA_SCORE_CONFIG = {
  asaClass: {
    max: 5,
    label: 'ASA Physical Status',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val).toUpperCase();
      if (str.includes('VI') || str === '6') return 6;
      if (str.includes('V') || str === '5') return 5;
      if (str.includes('IV') || str === '4') return 4;
      if (str.includes('III') || str === '3') return 3;
      if (str.includes('II') || str === '2') return 2;
      if (str.includes('I') || str === '1') return 1;
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Healthy patient';
      if (value === 2) return 'Mild systemic disease';
      if (value === 3) return 'Severe systemic disease';
      if (value === 4) return 'Life-threatening disease';
      if (value === 5) return 'Moribund patient';
      if (value === 6) return 'Brain-dead organ donor';
      return '';
    }
  },
  stopBang: {
    max: 8,
    label: 'STOP-BANG (OSA Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const fractionMatch = str.match(/^(\d+)\s*\/\s*8/);
      if (fractionMatch) return parseInt(fractionMatch[1]);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value <= 2) return 'Low Risk OSA';
      if (value <= 4) return 'Intermediate Risk OSA';
      return 'High Risk OSA';
    }
  },
  apfel: {
    max: 4,
    label: 'Apfel Score (PONV Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const fractionMatch = str.match(/^(\d+)\s*\/\s*4/);
      if (fractionMatch) return parseInt(fractionMatch[1]);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 0) return '10% PONV risk';
      if (value === 1) return '21% PONV risk';
      if (value === 2) return '39% PONV risk';
      if (value === 3) return '61% PONV risk';
      if (value === 4) return '79% PONV risk';
      return '';
    }
  },
  rcri: {
    max: 6,
    label: 'RCRI (Cardiac Risk)',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/^(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 0) return 'Low risk (0.4%)';
      if (value === 1) return 'Low risk (0.9%)';
      if (value === 2) return 'Intermediate risk (6.6%)';
      return 'High risk (>11%)';
    }
  },
  // Airway Assessment scores
  mallampati: {
    max: 4,
    label: 'Mallampati Class',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val).toUpperCase();
      if (str.includes('IV') || str === '4') return 4;
      if (str.includes('III') || str === '3') return 3;
      if (str.includes('II') || str === '2') return 2;
      if (str.includes('I') || str === '1') return 1;
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Easy intubation expected';
      if (value === 2) return 'Moderate difficulty';
      if (value === 3) return 'Difficult intubation likely';
      if (value === 4) return 'Very difficult intubation';
      return '';
    }
  },
  intubationGrade: {
    max: 4,
    label: 'Cormack-Lehane Grade',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value === 1) return 'Full glottic view';
      if (value === 2) return 'Partial glottic view';
      if (value === 3) return 'Epiglottis only';
      if (value === 4) return 'Neither glottis nor epiglottis';
      return '';
    }
  },
  // Pulmonary Function scores (PROTECTIVE - higher is better)
  fev1: {
    max: 100,
    label: 'FEV1 (% Predicted)',
    type: 'protective',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 80) return 'Normal';
      if (value >= 60) return 'Mild impairment';
      if (value >= 40) return 'Moderate impairment';
      return 'Severe impairment';
    }
  },
  fvc: {
    max: 100,
    label: 'FVC (% Predicted)',
    type: 'protective',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 80) return 'Normal';
      if (value >= 60) return 'Mild impairment';
      if (value >= 40) return 'Moderate impairment';
      return 'Severe impairment';
    }
  },
  fev1FvcRatio: {
    max: 100,
    label: 'FEV1/FVC Ratio',
    type: 'protective',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 70) return 'Normal ratio';
      if (value >= 60) return 'Mild obstruction';
      if (value >= 50) return 'Moderate obstruction';
      return 'Severe obstruction';
    }
  },
  // Sleep Study scores
  ahi: {
    max: 60,
    label: 'AHI (events/hour)',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 5) return 'Normal';
      if (value < 15) return 'Mild OSA';
      if (value < 30) return 'Moderate OSA';
      return 'Severe OSA';
    }
  },
  lowestO2: {
    max: 100,
    label: 'Lowest O2 Saturation',
    type: 'protective',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value >= 90) return 'Normal';
      if (value >= 80) return 'Mild desaturation';
      if (value >= 70) return 'Moderate desaturation';
      return 'Severe desaturation';
    }
  },
  // NSQIP Risk Calculator scores
  seriousComplication: {
    max: 100,
    label: 'Serious Complication Risk',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 5) return 'Low risk';
      if (value < 10) return 'Moderate risk';
      if (value < 20) return 'High risk';
      return 'Very high risk';
    }
  },
  anyComplication: {
    max: 100,
    label: 'Any Complication Risk',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 10) return 'Low risk';
      if (value < 20) return 'Moderate risk';
      if (value < 30) return 'High risk';
      return 'Very high risk';
    }
  },
  pneumonia: {
    max: 100,
    label: 'Pneumonia Risk',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 2) return 'Low risk';
      if (value < 5) return 'Moderate risk';
      if (value < 10) return 'High risk';
      return 'Very high risk';
    }
  },
  cardiac: {
    max: 100,
    label: 'Cardiac Complication Risk',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 1) return 'Low risk';
      if (value < 3) return 'Moderate risk';
      if (value < 5) return 'High risk';
      return 'Very high risk';
    }
  },
  vte: {
    max: 100,
    label: 'VTE Risk',
    type: 'risk',
    parseValue: (val) => {
      if (!val) return null;
      const str = String(val);
      const numMatch = str.match(/(\d+\.?\d*)/);
      if (numMatch) return parseFloat(numMatch[1]);
      return null;
    },
    getInterpretation: (value) => {
      if (value < 2) return 'Low risk';
      if (value < 5) return 'Moderate risk';
      if (value < 10) return 'High risk';
      return 'Very high risk';
    }
  }
};

// Get color for RISK scores (higher = worse = red)
const getRiskColor = (percentage) => {
  if (percentage <= 25) return '#898989';  // Green
  if (percentage <= 50) return '#7a7a7a';  // Blue
  if (percentage <= 75) return '#a7a7a7';  // Orange
  return '#777777';                         // Red
};

// Get color for PROTECTIVE scores (higher = better = green)
const getProtectiveColor = (percentage) => {
  if (percentage >= 80) return '#898989';  // Green - Normal
  if (percentage >= 60) return '#7a7a7a';  // Blue - Mild impairment
  if (percentage >= 40) return '#a7a7a7';  // Orange - Moderate impairment
  return '#777777';                         // Red - Severe impairment
};

// Prepare chart data grouped by medical category
// December 2025: Accepts full record object to extract data from multiple sources
const prepareChartDataByCategory = (record) => {
  if (!record || typeof record !== 'object') return [];

  // Map score keys to their data sources in the record
  const dataSources = {
    asaClass: record.clinicalScores?.asaClass,
    stopBang: record.clinicalScores?.stopBang,
    apfel: record.clinicalScores?.apfel,
    rcri: record.clinicalScores?.rcri,
    mallampati: record.airwayAssessment?.mallampati,
    intubationGrade: record.airwayAssessment?.previousIntubationGrade,
    fev1: record.pulmonaryFunctionTests?.fev1,
    fvc: record.pulmonaryFunctionTests?.fvc,
    fev1FvcRatio: record.pulmonaryFunctionTests?.fev1FvcRatio,
    ahi: record.sleepStudy?.ahi,
    lowestO2: record.sleepStudy?.lowestO2,
    seriousComplication: record.prognosis?.nsqipRiskCalculator?.seriousComplication,
    anyComplication: record.prognosis?.nsqipRiskCalculator?.anyComplication,
    pneumonia: record.prognosis?.nsqipRiskCalculator?.pneumonia,
    cardiac: record.prognosis?.nsqipRiskCalculator?.cardiac,
    vte: record.prognosis?.nsqipRiskCalculator?.vte
  };

  const categories = [];

  ANESTHESIA_SCORE_CATEGORIES.forEach(category => {
    const categoryCharts = [];

    category.scores.forEach(key => {
      const config = ANESTHESIA_SCORE_CONFIG[key];
      if (!config) return;

      const rawValue = dataSources[key];
      if (!rawValue) return;

      const numericValue = config.parseValue(rawValue);
      if (numericValue === null) return;

      const percentage = Math.min(100, Math.round((numericValue / config.max) * 100));
      // Use getProtectiveColor for protective scores (higher = better)
      const color = config.type === 'protective' ? getProtectiveColor(percentage) : getRiskColor(percentage);

      categoryCharts.push({
        key,
        label: config.label,
        percentage,
        rawValue: String(rawValue),
        color,
        interpretation: config.getInterpretation(numericValue)
      });
    });

    if (categoryCharts.length > 0) {
      categories.push({
        ...category,
        charts: categoryCharts
      });
    }
  });

  return categories;
};

// ==================== END BAR CHART CONFIGURATION ====================

// filterNulls helper - prevents React PDF crashes on null/undefined array items
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

// Split text by sentences for numbered rendering
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// Paren/bracket-aware comma split with a digit-guard (mirrors the JSX splitter so the PDF
// segments narrative object sub-fields identically). A comma between two digits is NOT a separator.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; current += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) {
      const t = current.trim();
      if (t) result.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) result.push(t);
  return result;
};

// Strip trailing ';'/'.' + whitespace from a split segment (mirrors the JSX so PDF rows read clean).
const stripTrailingSep = (s) => (typeof s === 'string' ? s.replace(/[\s;.]+$/, '') : s);

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
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
    paddingBottom: 8,
    borderBottom: '2px solid #000000'
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #666666'
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    textDecoration: 'underline'
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 2,
    marginLeft: 10,
    color: '#333333'
  },
  numberedItem: {
    fontSize: 12,
    marginLeft: 20,
    marginBottom: 2,
    lineHeight: 1.5
  },
  divider: {
    marginTop: 8,
    marginBottom: 8,
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

// Chart-specific styles
const chartStyles = StyleSheet.create({
  chartSection: {
    marginTop: 12,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    textDecoration: 'underline'
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 4
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2
  },
  legendText: {
    fontSize: 9,
    color: '#727272'
  },
  barChartRow: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4
  },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#7a7a7a',
    marginBottom: 6
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 6
  },
  barBackground: {
    flex: 1,
    height: 18,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 4
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginLeft: 10,
    minWidth: 70,
    textAlign: 'right'
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 4
  },
  // Category groupings - December 2025
  chartCategory: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#7a7a7a',
    borderRadius: 4
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  categoryName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#7a7a7a',
    flex: 1,
    textTransform: 'uppercase'
  },
  categoryDescription: {
    fontSize: 8,
    color: '#727272',
    textAlign: 'right'
  },
  // Bar chart inside category - no border, proper spacing
  categoryBarRow: {
    marginBottom: 2,
    padding: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
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

// Format object key to readable label
const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
};

// Render nested object with subtitle + numbered content pattern
const renderNestedObject = (obj, sectionTitle) => {
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

  const entries = Object.entries(obj).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) return null;

  // Build all content items: each key becomes a subtitle with numbered values below
  const renderEntry = ([key, value]) => {
    if (Array.isArray(value)) {
      const validItems = filterNulls(value);
      if (validItems.length === 0) return null;
      return (
        <View key={key}>
          <Text style={styles.subtitle}>{formatKey(key)}</Text>
          {validItems.map((item, i) => (
            <Text key={i} style={styles.numberedItem}>
              {i + 1}. {typeof item === 'string' ? item : JSON.stringify(item)}
            </Text>
          ))}
        </View>
      );
    }

    if (typeof value === 'object') {
      const subEntries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined);
      if (subEntries.length === 0) return null;
      return (
        <View key={key}>
          <Text style={styles.subtitle}>{formatKey(key)}</Text>
          {subEntries.map(([k, v], i) => (
            <Text key={i} style={styles.numberedItem}>
              {i + 1}. {formatKey(k)}: {String(v)}
            </Text>
          ))}
        </View>
      );
    }

    const clauses = splitByComma(String(value));
    return (
      <View key={key}>
        <Text style={styles.subtitle}>{formatKey(key)}</Text>
        {clauses.length > 1
          ? clauses.map((c, i) => (
              <Text key={i} style={styles.numberedItem}>{i + 1}. {c}</Text>
            ))
          : <Text style={styles.numberedItem}>1. {String(value)}</Text>}
      </View>
    );
  };

  // Content rows an entry renders — so a long comma-split field can flow/break across pages
  // (Rule #74: <=8 rows -> wrap={false} keeps the block intact; >8 -> wrap to avoid overprint).
  const entryRows = ([, value]) => {
    if (Array.isArray(value)) return filterNulls(value).length;
    if (value && typeof value === 'object') return Object.entries(value).filter(([, v]) => v != null).length;
    return splitByComma(String(value)).length;
  };

  const firstEntry = entries[0];
  const remainingEntries = entries.slice(1);

  return (
    <View>
      <View wrap={entryRows(firstEntry) > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {renderEntry(firstEntry)}
      </View>
      {remainingEntries.map((entry) => (
        <View key={entry[0]} wrap={entryRows(entry) > 8 ? undefined : false}>
          {renderEntry(entry)}
        </View>
      ))}
    </View>
  );
};

// Render array with numbered content pattern
const renderArray = (arr, sectionTitle) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;

  const validItems = filterNulls(arr);
  if (validItems.length === 0) return null;

  return (
    <View>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {validItems.slice(0, 1).map((item, idx) => (
          <Text key={idx} style={styles.numberedItem}>
            1. {typeof item === 'string' ? item : JSON.stringify(item)}
          </Text>
        ))}
      </View>
      {validItems.slice(1).map((item, idx) => (
        <Text key={idx} style={styles.numberedItem}>
          {idx + 2}. {typeof item === 'string' ? item : JSON.stringify(item)}
        </Text>
      ))}
    </View>
  );
};

// PDF Bar Chart Component
// PDF Bar Chart - December 2025: Fixed spacing to prevent text overlap
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.categoryBarRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={[chartStyles.barValue, { color }]}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

// PDF Legend Component
const PDFLegend = () => (
  <View style={chartStyles.legend}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={chartStyles.legendText}>Low Risk</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={chartStyles.legendText}>Moderate</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={chartStyles.legendText}>High Risk</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={chartStyles.legendText}>Very High</Text>
    </View>
  </View>
);

// PDF Category Header Component - December 2025
const PDFCategoryHeader = ({ name, description }) => (
  <View style={chartStyles.categoryHeader}>
    <Text style={chartStyles.categoryName}>{String(name)}</Text>
    <Text style={chartStyles.categoryDescription}>{String(description)}</Text>
  </View>
);

// Render Risk Assessment Chart Section with Category Groupings
// December 2025: Accepts full record to extract data from multiple sources
// FIXED: Removed wrap={false} from entire section - now only on title+legend and each category
const renderRiskAssessmentChart = (record) => {
  const categoryData = prepareChartDataByCategory(record);
  if (categoryData.length === 0) return null;

  return (
    <View style={chartStyles.chartSection}>
      {/* Title + Legend stay together */}
      <View wrap={false}>
        <Text style={chartStyles.chartTitle}>Risk Assessment Overview</Text>
        <PDFLegend />
      </View>
      {/* Each category can wrap independently - category header stays with its bars */}
      {categoryData.map((category, catIdx) => (
        <View key={category.id} style={chartStyles.chartCategory} wrap={false}>
          <PDFCategoryHeader name={category.name} description={category.description} />
          {category.charts.map((chart, cIdx) => (
            <PDFBarChart
              key={chart.key}
              label={chart.label}
              percentage={chart.percentage}
              rawValue={chart.rawValue}
              color={chart.color}
              interpretation={chart.interpretation}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

// Render a narrative text field with sentence-level numbering
const renderNarrativeField = (text, sectionTitle) => {
  if (!text || String(text).trim() === '') return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;

  return (
    <View>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <Text style={styles.numberedItem}>1. {stripTrailingSep(sentences[0])}</Text>
      </View>
      {sentences.slice(1).map((sentence, idx) => (
        <Text key={idx} style={styles.numberedItem}>
          {idx + 2}. {stripTrailingSep(sentence)}
        </Text>
      ))}
    </View>
  );
};

// Render a simple single-value field with subtitle + numbered content
const renderSimpleField = (value, sectionTitle) => {
  if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;

  return (
    <View>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <Text style={styles.numberedItem}>1. {String(value)}</Text>
      </View>
    </View>
  );
};

// Render a header field with subtitle + numbered content pattern
const renderHeaderField = (value, label) => {
  if (!value || String(value).trim() === '') return null;

  return (
    <View>
      <Text style={styles.subtitle}>{label}</Text>
      <Text style={styles.numberedItem}>1. {String(value)}</Text>
    </View>
  );
};

const AnesthesiaRecordsDocumentPDFTemplate = ({ document: doc }) => {
  // Data unwrapping - handle wrapped collection structure
  const unwrappedData = doc?.documentData || doc;
  let recordsArray = [];
  if (unwrappedData?.anesthesia_records && Array.isArray(unwrappedData.anesthesia_records)) {
    recordsArray = unwrappedData.anesthesia_records;
  } else if (Array.isArray(unwrappedData)) {
    recordsArray = unwrappedData;
  } else if (unwrappedData && typeof unwrappedData === 'object') {
    recordsArray = [unwrappedData];
  }

  const validRecords = filterNulls(recordsArray);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Anesthesia Records</Text>

        {validRecords.map((record, idx) => (
          <View key={idx}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                Anesthesia Record {idx + 1}
                {record.surgeryDate ? ` - ${formatDate(record.surgeryDate)}` : ''}
              </Text>

              {/* Header Information - first field stays with title */}
              {renderHeaderField(record.anesthesiaType, 'Anesthesia Type')}
            </View>

            {/* Remaining Header Fields */}
            {renderHeaderField(record.procedureDate ? formatDate(record.procedureDate) : '', 'Procedure Date')}
            {renderHeaderField(record.intubationType, 'Intubation Type')}
            {renderHeaderField(record.asaClassification, 'ASA Classification')}
            {renderHeaderField(record.functionalCapacity, 'Functional Capacity')}
            {renderHeaderField(record.surgicalProcedure, 'Surgical Procedure')}
            {renderHeaderField(record.surgeon, 'Surgeon')}

            {/* Risk Assessment Overview - Bar Chart */}
            {renderRiskAssessmentChart(record)}

            {/* Nested Object Sections */}
            {renderNestedObject(record.anesthesiologyAssessment, 'Anesthesiology Assessment')}
            {renderNestedObject(record.airwayAssessment, 'Airway Assessment')}
            {renderNestedObject(record.anesthesiaPlan, 'Anesthesia Plan')}
            {renderNestedObject(record.painManagement, 'Pain Management')}
            {renderNestedObject(record.induction, 'Induction')}
            {renderNestedObject(record.maintenance, 'Maintenance')}
            {renderNestedObject(record.operativeDetails, 'Operative Details')}
            {/* Clinical Scores Section REMOVED - Data now shown in Risk Assessment Overview bar chart above */}
            {renderNestedObject(record.pulmonaryFunctionTests, 'Pulmonary Function Tests')}
            {renderNestedObject(record.sleepStudy, 'Sleep Study')}
            {renderNestedObject(record.chiefComplaint, 'Chief Complaint')}
            {renderNestedObject(record.medicalHistory, 'Medical History')}
            {renderNestedObject(record.reviewOfSystems, 'Review of Systems')}
            {renderNestedObject(record.physicalExamination, 'Physical Examination')}
            {renderNestedObject(record.preOperativePreparation, 'Preoperative Preparation')}
            {renderNestedObject(record.postoperativeOrders, 'Postoperative Orders')}
            {renderNestedObject(record.dvtProphylaxis, 'DVT Prophylaxis')}
            {renderNestedObject(record.prognosis, 'Prognosis')}
            {renderNestedObject(record.consultationDetails, 'Consultation Details')}
            {renderNestedObject(record.patientEducation, 'Patient Education')}
            {renderNestedObject(record.administrativeData, 'Administrative Data')}

            {/* Array Sections */}
            {renderArray(record.monitoring, 'Monitoring')}
            {renderArray(record.referrals, 'Referrals')}
            {renderArray(record.followUpAppointments, 'Follow-Up Appointments')}

            {/* Narrative Text - split by sentences and numbered */}
            {renderNarrativeField(record.historyOfPresentIllness, 'History of Present Illness')}
            {renderNarrativeField(record.assessmentAndPlan, 'Assessment and Plan')}

            {/* Simple Fields - subtitle + numbered content */}
            {renderNarrativeField(record.emergence, 'Emergence')}
            {renderSimpleField(record.complications, 'Complications')}
            {renderNarrativeField(record.bloodProductsOrdered, 'Blood Products Ordered')}
            {renderNarrativeField(record.findings, 'Findings')}
            {renderNarrativeField(record.outcome, 'Outcome')}
            {renderNarrativeField(record.followUp, 'Follow Up')}
            {renderNarrativeField(record.additionalNotes, 'Additional Notes')}

            {/* Providers - non-editable, dynamic-key object */}
            {renderNestedObject(record.providers, 'Providers')}

            <View style={styles.divider} />
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

export default AnesthesiaRecordsDocumentPDFTemplate;
