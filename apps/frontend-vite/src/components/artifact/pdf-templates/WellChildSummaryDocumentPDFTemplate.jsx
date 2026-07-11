import React, { useMemo } from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * WellChildSummaryDocumentPDFTemplate — March 2026
 *
 * PDF export for well child summary records.
 * Helvetica font, LETTER size, 20pt title / 12pt body.
 * Includes bar chart visualization for growth percentiles.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
  },
  dateText: {
    fontSize: 10,
    color: '#6b7280',
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
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 140,
  },
  fieldValue: {
    fontSize: 12,
    color: '#1f2937',
    flex: 1,
  },
  listItem: {
    fontSize: 12,
    color: '#1f2937',
    marginBottom: 4,
    paddingLeft: 12,
  },
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#000000',
  },
  barRow: {
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 16,
    borderRadius: 4,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginLeft: 8,
    width: 45,
    textAlign: 'right',
  },
  barMeasurement: {
    fontSize: 9,
    color: '#000000',
    marginTop: 2,
    paddingLeft: 4,
  },
  noData: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
  },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μ/g, 'u').replace(/µ/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->');
  return str;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const date = new Date(dateValue.$date || dateValue); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const hasValue = (val) => val !== null && val !== undefined && val !== '' && val !== 0;
const hasArrayValue = (arr) => Array.isArray(arr) && arr.length > 0 && arr.some(item => item && item.trim && item.trim() !== '');

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0);
};

const getPercentileColor = (percentile) => {
  if (percentile === null || percentile === undefined) return '#6b7280';
  if (percentile >= 85 || percentile <= 5) return '#777777';
  if (percentile >= 75 || percentile <= 10) return '#a7a7a7';
  if (percentile >= 25 && percentile <= 75) return '#898989';
  return '#7a7a7a';
};

const BarChart = ({ label, percentile, measurement, unit }) => {
  const percentage = percentile !== null && percentile !== undefined ? Math.min(100, Math.max(0, percentile)) : null;
  const color = getPercentileColor(percentile);
  const suffix = percentile === 1 ? 'st' : percentile === 2 ? 'nd' : percentile === 3 ? 'rd' : 'th';
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{safeString(label)}</Text>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          {percentage !== null && <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />}
        </View>
        <Text style={[styles.barValue, { color }]}>{percentage !== null ? `${percentage}${suffix}` : 'N/A'}</Text>
      </View>
      {measurement !== null && measurement !== undefined && (
        <Text style={styles.barMeasurement}>{safeString(`${measurement} ${unit || ''}`.trim())}</Text>
      )}
    </View>
  );
};

const Legend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#898989' }]} /><Text style={styles.legendText}>25-75th (Normal)</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={styles.legendText}>10-25th / 75-85th</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={styles.legendText}>5-10th / 85-95th</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#777777' }]} /><Text style={styles.legendText}>&lt;5th / &gt;95th</Text></View>
  </View>
);

const WellChildSummaryDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item.well_child_summary) return item.well_child_summary;
        if (item.records) return item.records;
        return item;
      });
    }
    if (templateData.data) {
      if (Array.isArray(templateData.data)) {
        return templateData.data.flatMap(item => {
          if (item.well_child_summary) return item.well_child_summary;
          if (item.records) return item.records;
          return item;
        });
      }
      return [templateData.data];
    }
    return [templateData];
  }, [templateData]);

  const renderRecord = (record, recordIdx) => {
    const hasGrowthData = hasValue(record.weightPercentile) || hasValue(record.heightPercentile) ||
                          hasValue(record.headCircumferencePercentile) || hasValue(record.bmiPercentile);

    return (
      <View key={recordIdx} style={styles.recordContainer}>
        <Text style={styles.recordTitle}>Well Child Summary {recordIdx + 1}</Text>
        {record.date && <Text style={styles.dateText}>{formatDate(record.date)}</Text>}

        {/* Visit Information */}
        {(hasValue(record.provider) || hasValue(record.facility) || hasValue(record.childAge) || hasValue(record.dateOfBirth) || hasValue(record.gestationalAgeAtBirth)) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Visit Information</Text>
            {hasValue(record.provider) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Provider:</Text><Text style={styles.fieldValue}>{safeString(record.provider)}</Text></View>}
            {hasValue(record.facility) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Facility:</Text><Text style={styles.fieldValue}>{safeString(record.facility)}</Text></View>}
            {hasValue(record.childAge) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Child Age:</Text><Text style={styles.fieldValue}>{safeString(record.childAge)}</Text></View>}
            {hasValue(record.dateOfBirth) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Date of Birth:</Text><Text style={styles.fieldValue}>{formatDate(record.dateOfBirth)}</Text></View>}
            {hasValue(record.gestationalAgeAtBirth) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Gestational Age:</Text><Text style={styles.fieldValue}>{safeString(record.gestationalAgeAtBirth)}</Text></View>}
          </View>
        )}

        {/* Growth Percentile Overview (Bar Chart) */}
        {hasGrowthData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Growth Percentile Overview</Text>
            <View style={styles.chartSection}>
              <Legend />
              {hasValue(record.weightPercentile) && <BarChart label="Weight" percentile={record.weightPercentile} measurement={record.weightMeasurement} unit="lbs" />}
              {hasValue(record.heightPercentile) && <BarChart label="Height" percentile={record.heightPercentile} measurement={record.heightMeasurement} unit="in" />}
              {hasValue(record.headCircumferencePercentile) && <BarChart label="Head Circumference" percentile={record.headCircumferencePercentile} measurement={record.headCircumference} unit="cm" />}
              {hasValue(record.bmiPercentile) && <BarChart label="BMI" percentile={record.bmiPercentile} measurement={record.bodyMassIndex} unit="" />}
            </View>
          </View>
        )}

        {/* Vaccines Administered */}
        {hasArrayValue(record.vaccinesAdministered) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Vaccines Administered</Text>{record.vaccinesAdministered.slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {record.vaccinesAdministered.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Vaccines Due */}
        {hasArrayValue(record.vaccinesDue) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Vaccines Due</Text>{record.vaccinesDue.slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {record.vaccinesDue.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Developmental Milestones */}
        {hasArrayValue(record.developmentalMilestones) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Developmental Milestones</Text>{record.developmentalMilestones.slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {record.developmentalMilestones.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Screenings */}
        {(hasValue(record.visionScreeningResult) || hasValue(record.hearingScreeningResult) || (hasValue(record.hemoglobinLevel) && record.hemoglobinLevel > 0) || hasValue(record.leadScreeningResult)) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Screenings</Text>
            {hasValue(record.visionScreeningResult) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Vision:</Text><Text style={styles.fieldValue}>{safeString(record.visionScreeningResult)}</Text></View>}
            {hasValue(record.hearingScreeningResult) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Hearing:</Text><Text style={styles.fieldValue}>{safeString(record.hearingScreeningResult)}</Text></View>}
            {hasValue(record.hemoglobinLevel) && record.hemoglobinLevel > 0 && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Hemoglobin:</Text><Text style={styles.fieldValue}>{safeString(record.hemoglobinLevel)} g/dL</Text></View>}
            {hasValue(record.leadScreeningResult) && <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Lead:</Text><Text style={styles.fieldValue}>{safeString(record.leadScreeningResult)}</Text></View>}
          </View>
        )}

        {/* Nutrition Counseling */}
        {hasValue(record.nutritionCounseling) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Nutrition Counseling</Text>{splitByComma(record.nutritionCounseling).slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {splitByComma(record.nutritionCounseling).slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Safety Guidance */}
        {hasArrayValue(record.safetyGuidanceProvided) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Safety Guidance</Text>{record.safetyGuidanceProvided.slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {record.safetyGuidanceProvided.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Parental Concerns */}
        {hasArrayValue(record.parentalConcerns) && (
          <View style={styles.section}>
            <View wrap={false}><Text style={styles.sectionTitle}>Parental Concerns</Text>{record.parentalConcerns.slice(0, 1).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}</View>
            {record.parentalConcerns.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>)}
          </View>
        )}

        {/* Next Visit */}
        {hasValue(record.nextVisitScheduled) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Next Visit</Text>
            <Text style={styles.listItem}>{safeString(record.nextVisitScheduled)}</Text>
          </View>
        )}
      </View>
    );
  };

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Well Child Summary</Text>
          <Text style={styles.noData}>No well child summary records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Well Child Summary</Text>
        {unwrappedData.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default WellChildSummaryDocumentPDFTemplate;
