import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * EndocrineLabResultsPDFTemplate - February 2026
 * PDF export template for Endocrine Lab Results with bar chart visualization
 * 
 * Uses Helvetica font (NOT Courier)
 * A4 page size
 * Black and white/grey bar charts (no clinical colors)
 * Charts start on second page to avoid being cut off
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #cccccc',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    width: 160,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  infoValue: {
    flex: 1,
    fontSize: 11,
  },
  // Bar Chart Styles
  chartSection: {
    marginTop: 8,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
  barChartRow: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
    marginBottom: 2,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginLeft: 8,
    width: 100,
    textAlign: 'right',
  },
  barReference: {
    fontSize: 8,
    color: '#666666',
    marginTop: 1,
    marginLeft: 4,
  },
  // Field row for non-numeric fields
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 200,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.4,
  },
  pageBreak: {
    marginBottom: 20,
  },
});

// Reference ranges with display ranges for bar calculation
const REFERENCE_RANGES = {
  thyroidStimulatingHormone: { min: 0.4, max: 4.0, unit: 'mIU/L', displayMin: 0, displayMax: 10 },
  freeThyroxineT4: { min: 0.8, max: 1.8, unit: 'ng/dL', displayMin: 0, displayMax: 3 },
  freeTriiodothyronineT3: { min: 2.3, max: 4.2, unit: 'pg/mL', displayMin: 0, displayMax: 6 },
  hemoglobinA1c: { min: 4.0, max: 5.7, unit: '%', displayMin: 3, displayMax: 10 },
  fastingGlucose: { min: 70, max: 100, unit: 'mg/dL', displayMin: 40, displayMax: 200 },
  cortisol: { min: 6, max: 23, unit: 'mcg/dL', displayMin: 0, displayMax: 30 },
  adrenocorticotropicHormone: { min: 10, max: 60, unit: 'pg/mL', displayMin: 0, displayMax: 100 },
  parathyroidHormone: { min: 10, max: 65, unit: 'pg/mL', displayMin: 0, displayMax: 100 },
  serumCalcium: { min: 8.5, max: 10.5, unit: 'mg/dL', displayMin: 7, displayMax: 12 },
  ionizedCalcium: { min: 1.16, max: 1.32, unit: 'mmol/L', displayMin: 0.8, displayMax: 1.6 },
  vitamin25OHD: { min: 30, max: 100, unit: 'ng/mL', displayMin: 0, displayMax: 120 },
  prolactin: { min: 2, max: 25, unit: 'ng/mL', displayMin: 0, displayMax: 40 },
  luteinizingHormone: { min: 0.5, max: 100, unit: 'mIU/mL', displayMin: 0, displayMax: 120 },
  follicleStimulatingHormone: { min: 1, max: 30, unit: 'mIU/mL', displayMin: 0, displayMax: 50 },
  testosterone: { min: 15, max: 1000, unit: 'ng/dL', displayMin: 0, displayMax: 1200 },
  estradiol: { min: 10, max: 500, unit: 'pg/mL', displayMin: 0, displayMax: 600 },
  insulinLikeGrowthFactor1: { min: 100, max: 500, unit: 'ng/mL', displayMin: 0, displayMax: 600 },
  serumOsmolality: { min: 275, max: 295, unit: 'mOsm/kg', displayMin: 250, displayMax: 320 },
  cPeptide: { min: 0.8, max: 3.1, unit: 'ng/mL', displayMin: 0, displayMax: 5 },
};

const FIELD_GROUPS = [
  {
    title: 'Thyroid Function',
    fields: [
      { key: 'thyroidStimulatingHormone', label: 'TSH' },
      { key: 'freeThyroxineT4', label: 'Free T4' },
      { key: 'freeTriiodothyronineT3', label: 'Free T3' },
      { key: 'thyroidPeroxidaseAntibody', label: 'Anti-TPO Antibody' },
      { key: 'thyroglobulinAntibody', label: 'Thyroglobulin Antibody' },
    ],
  },
  {
    title: 'Diabetes Markers',
    fields: [
      { key: 'hemoglobinA1c', label: 'Hemoglobin A1c' },
      { key: 'fastingGlucose', label: 'Fasting Glucose' },
      { key: 'cPeptide', label: 'C-Peptide' },
    ],
  },
  {
    title: 'Adrenal Function',
    fields: [
      { key: 'cortisol', label: 'Cortisol' },
      { key: 'cortisolCollectionTime', label: 'Collection Time' },
      { key: 'adrenocorticotropicHormone', label: 'ACTH' },
    ],
  },
  {
    title: 'Calcium & Parathyroid',
    fields: [
      { key: 'parathyroidHormone', label: 'Parathyroid Hormone (PTH)' },
      { key: 'serumCalcium', label: 'Serum Calcium' },
      { key: 'ionizedCalcium', label: 'Ionized Calcium' },
      { key: 'vitamin25OHD', label: 'Vitamin D (25-OH)' },
    ],
  },
  {
    title: 'Reproductive Hormones',
    fields: [
      { key: 'prolactin', label: 'Prolactin' },
      { key: 'luteinizingHormone', label: 'Luteinizing Hormone (LH)' },
      { key: 'follicleStimulatingHormone', label: 'Follicle Stimulating Hormone (FSH)' },
      { key: 'testosterone', label: 'Testosterone' },
      { key: 'estradiol', label: 'Estradiol' },
    ],
  },
  {
    title: 'Growth & Other Markers',
    fields: [
      { key: 'insulinLikeGrowthFactor1', label: 'IGF-1' },
      { key: 'serumOsmolality', label: 'Serum Osmolality' },
    ],
  },
];

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return typeof val === 'string' ? val : String(val);
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateValue);
  }
};

const formatNumber = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return String(val);
  return num.toFixed(2);
};

// Calculate bar percentage based on display range
const calculateBarPercentage = (value, field) => {
  const range = REFERENCE_RANGES[field];
  if (!range) return 50; // Default middle
  
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return 50;
  
  const { displayMin, displayMax } = range;
  const percentage = ((num - displayMin) / (displayMax - displayMin)) * 100;
  return Math.min(100, Math.max(5, percentage));
};

// Get status for greyscale bar coloring
const getStatus = (field, value) => {
  if (value === null || value === undefined || value === '') return 'normal';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return 'normal';
  
  const range = REFERENCE_RANGES[field];
  if (!range) return 'normal';
  
  if (num < range.min) return 'low';
  if (num > range.max) return 'high';
  return 'normal';
};

// Get interpretation text
const getInterpretation = (field, value) => {
  const status = getStatus(field, value);
  if (status === 'normal') return 'Normal';
  if (status === 'high') return 'High';
  return 'Low';
};

// Bar color for greyscale (black/white/grey)
const getBarColor = (status) => {
  // Black and white/grey scheme
  if (status === 'normal') return '#4a4a4a'; // Dark grey
  if (status === 'high') return '#000000';   // Black
  return '#808080';                          // Medium grey
};

// Prepare chart data for a record
const prepareChartData = (record) => {
  const charts = [];
  
  FIELD_GROUPS.forEach(group => {
    group.fields.forEach(field => {
      const value = record[field.key];
      if (hasValue(value) && REFERENCE_RANGES[field.key]) {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (!isNaN(numValue)) {
          const range = REFERENCE_RANGES[field.key];
          const status = getStatus(field.key, value);
          charts.push({
            key: field.key,
            label: field.label,
            rawValue: formatNumber(value),
            numericValue: numValue,
            percentage: calculateBarPercentage(value, field.key),
            color: getBarColor(status),
            interpretation: getInterpretation(field.key, value),
            range: range,
            unit: range.unit,
          });
        }
      }
    });
  });
  
  return charts;
};

// Legend component
const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#4a4a4a' }]} />
      <Text style={styles.legendText}>Normal</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#000000' }]} />
      <Text style={styles.legendText}>High</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#808080' }]} />
      <Text style={styles.legendText}>Low</Text>
    </View>
  </View>
);

// Bar chart component
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation, range, unit }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barLabel}>{label}</Text>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{rawValue} {unit}</Text>
    </View>
    <Text style={styles.barReference}>
      {interpretation} | Reference: {range.min}-{range.max} {unit}
    </Text>
  </View>
);

const EndocrineLabResultsPDFTemplate = ({ document }) => {
  // Unwrap data
  let records = [];
  if (Array.isArray(document)) {
    records = document;
  } else if (document?.endocrine_lab_results) {
    records = document.endocrine_lab_results;
  } else if (document?.data) {
    records = document.data;
  } else if (document) {
    records = [document];
  }

  // Prepare chart data for all records
  const recordsWithCharts = records.map(record => ({
    record,
    chartData: prepareChartData(record),
  }));

  return (
    <Document>
      {recordsWithCharts.map(({ record, chartData }, idx) => {
        const hasChartData = chartData.length > 0;
        
        return (
          <React.Fragment key={idx}>
            {/* PAGE 1: Test Information and Non-numeric Fields */}
            <Page size="A4" style={styles.page}>
              <Text style={styles.documentTitle}>Endocrine Lab Results {idx + 1}</Text>
              
              {/* Test Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Test Information</Text>
                {record.date && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Test Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Ordering Provider:</Text>
                    <Text style={styles.infoValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Facility:</Text>
                    <Text style={styles.infoValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
              </View>

              {/* Non-numeric Fields */}
              {FIELD_GROUPS.map((group) => {
                const nonNumericFields = group.fields.filter(field => {
                  const value = record[field.key];
                  return hasValue(value) && !REFERENCE_RANGES[field.key];
                });
                if (nonNumericFields.length === 0) return null;

                return (
                  <View key={group.title} style={styles.section}>
                    <Text style={styles.sectionTitle}>{group.title}</Text>
                    {nonNumericFields.map((field) => (
                      <View key={field.key} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{field.label}:</Text>
                        <Text style={styles.fieldValue}>{safeString(record[field.key])}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}

              {/* Note about charts on next page */}
              {hasChartData && (
                <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f0f0f0' }}>
                  <Text style={{ fontSize: 10, textAlign: 'center' }}>
                    Lab Results Visualization with Bar Charts continues on next page...
                  </Text>
                </View>
              )}
            </Page>

            {/* PAGE 2: Bar Charts (if there are numeric results) */}
            {hasChartData && (
              <Page size="A4" style={styles.page}>
                <Text style={styles.documentTitle}>Endocrine Lab Results {idx + 1}</Text>
                
                <View style={styles.chartSection}>
                  <Text style={styles.chartTitle}>Lab Results Visualization</Text>
                  <PDFLegend />
                  
                  {chartData.map((chart, chartIdx) => (
                    <PDFBarChart
                      key={chartIdx}
                      label={chart.label}
                      percentage={chart.percentage}
                      rawValue={chart.rawValue}
                      color={chart.color}
                      interpretation={chart.interpretation}
                      range={chart.range}
                      unit={chart.unit}
                    />
                  ))}
                </View>
              </Page>
            )}
          </React.Fragment>
        );
      })}
    </Document>
  );
};

export default EndocrineLabResultsPDFTemplate;
