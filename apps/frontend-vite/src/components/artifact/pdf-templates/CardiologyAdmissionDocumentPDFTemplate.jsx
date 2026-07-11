import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Cardiology Admission Document PDF Template - December 2025
 * Professional color-coded bar charts for cardiac parameters
 * Helvetica font (NOT Courier!)
 * Matches actual MongoDB schema from cardiology_admission_notes
 */

// Clinical color coding for cardiac parameters
const COLORS = {
  normal: '#898989',      // Green - Normal values
  borderline: '#7a7a7a',  // Blue - Borderline/Mild
  elevated: '#a7a7a7',    // Orange - Elevated/Moderate
  critical: '#777777',    // Red - Critical/Severe
  header: '#424242',      // Deep blue for headers
  headerLight: '#e8e8e8', // Light blue for header background
  categoryBg: '#f0f9ff',  // Very light blue for category sections
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: COLORS.header,
    color: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: COLORS.headerLight,
    padding: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.header,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    color: COLORS.header,
  },
  recordMeta: {
    fontSize: 10,
    marginBottom: 3,
    color: '#4b5563',
  },
  badge: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    color: COLORS.critical,
    backgroundColor: '#fef2f2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  sectionContainer: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: COLORS.header,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.header,
    paddingBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingVertical: 2,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '35%',
    color: '#404040',
  },
  fieldValue: {
    fontSize: 9,
    flex: 1,
    lineHeight: 1.4,
    color: '#1f2937',
  },
  fieldContent: {
    fontSize: 9,
    lineHeight: 1.5,
    paddingLeft: 8,
    marginBottom: 3,
    color: '#1f2937',
  },
  listItem: {
    fontSize: 9,
    lineHeight: 1.4,
    paddingLeft: 8,
    marginBottom: 3,
    color: '#1f2937',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#6b7280',
  },
  // Chart styles - Professional color-coded bars
  chartSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
    color: COLORS.header,
    textAlign: 'center',
  },
  chartCategory: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chartCategoryHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    color: '#424242',
  },
  chartBar: {
    marginBottom: 10,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1f2937',
  },
  chartBarTrack: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 3,
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  chartBarInfo: {
    fontSize: 9,
    marginBottom: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#404040',
    fontWeight: 'bold',
  },
});

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString.$date || dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateString || '');
  }
};

// Safe string helper - prevents "Eo is not a function" crash
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Get color based on clinical interpretation
const getInterpretationColor = (interpretation) => {
  const interp = String(interpretation || '').toLowerCase();
  // Critical/Severe conditions
  if (interp.includes('stemi') || interp.includes('cardiogenic') ||
      interp.includes('severely') || interp.includes('heart failure') ||
      interp.includes('hypoxemia') || interp.includes('tachycardia') ||
      interp.includes('bradycardia') || interp.includes('severe')) {
    return COLORS.critical;
  }
  // Elevated/Moderate conditions
  if (interp.includes('elevated') || interp.includes('pulmonary edema') ||
      interp.includes('moderate') || interp.includes('reduced')) {
    return COLORS.elevated;
  }
  // Borderline/Mild conditions
  if (interp.includes('borderline') || interp.includes('mildly') ||
      interp.includes('mild') || interp.includes('rales') ||
      interp.includes('low normal') || interp.includes('high normal')) {
    return COLORS.borderline;
  }
  // Normal
  return COLORS.normal;
};

// Extract chart data from record
const extractChartData = (record) => {
  const categories = [];

  const extractNumeric = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const match = String(value).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  };

  const classToNumeric = (value) => {
    if (!value) return null;
    const classMatch = String(value).match(/(?:class\s*)?([IViv]+|\d)/i);
    if (!classMatch) return null;
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
    return romanMap[classMatch[1].toUpperCase()] || parseInt(classMatch[1]) || null;
  };

  // Category 1: Cardiac Biomarkers
  const biomarkers = [];
  if (record.troponinLevel !== undefined && record.troponinLevel !== null) {
    const val = extractNumeric(record.troponinLevel);
    if (val !== null) {
      let interpretation = 'Normal';
      if (val >= 2.0) interpretation = 'STEMI';
      else if (val >= 0.4) interpretation = 'Elevated';
      else if (val >= 0.04) interpretation = 'Borderline';
      biomarkers.push({
        label: 'Troponin I',
        value: val,
        unit: 'ng/mL',
        max: Math.max(val * 1.5, 10),
        reference: '<0.04 ng/mL',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (record.bnpLevel !== undefined && record.bnpLevel !== null) {
    const val = extractNumeric(record.bnpLevel);
    if (val !== null) {
      let interpretation = 'Normal';
      if (val >= 400) interpretation = 'Heart Failure';
      else if (val >= 100) interpretation = 'Elevated';
      biomarkers.push({
        label: 'BNP',
        value: val,
        unit: 'pg/mL',
        max: Math.max(val * 1.5, 500),
        reference: '<100 pg/mL',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (biomarkers.length > 0) {
    categories.push({ name: 'Cardiac Biomarkers', charts: biomarkers });
  }

  // Category 2: Cardiac Function
  const cardiacFunction = [];
  const lvef = record.leftVentricularEjectionFraction ||
               (record.echocardiogramResults?.ejectionFraction ? extractNumeric(record.echocardiogramResults.ejectionFraction) : null);
  if (lvef !== undefined && lvef !== null) {
    const val = extractNumeric(lvef);
    if (val !== null) {
      let interpretation = 'Normal';
      if (val < 30) interpretation = 'Severely Reduced';
      else if (val < 40) interpretation = 'Reduced';
      else if (val < 55) interpretation = 'Mildly Reduced';
      cardiacFunction.push({
        label: 'Ejection Fraction',
        value: val,
        unit: '%',
        max: 100,
        reference: '55-70%',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (cardiacFunction.length > 0) {
    categories.push({ name: 'Cardiac Function', charts: cardiacFunction });
  }

  // Category 3: Clinical Classifications
  const classifications = [];
  if (record.nyhaClassification) {
    const val = classToNumeric(record.nyhaClassification);
    if (val !== null) {
      let interpretation = 'Class ' + ['I', 'II', 'III', 'IV'][val - 1];
      if (val >= 4) interpretation += ' (Severe)';
      else if (val >= 3) interpretation += ' (Moderate)';
      else if (val >= 2) interpretation += ' (Mild)';
      else interpretation += ' (No Limitation)';
      classifications.push({
        label: 'NYHA Class',
        value: val,
        max: 4,
        reference: 'Class I-IV',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (record.killipClassification) {
    const val = classToNumeric(record.killipClassification);
    if (val !== null) {
      let interpretation = 'Killip ' + ['I', 'II', 'III', 'IV'][val - 1];
      if (val >= 4) interpretation += ' (Cardiogenic Shock)';
      else if (val >= 3) interpretation += ' (Pulmonary Edema)';
      else if (val >= 2) interpretation += ' (Rales/Crackles)';
      else interpretation += ' (No CHF Signs)';
      classifications.push({
        label: 'Killip Class',
        value: val,
        max: 4,
        reference: 'Class I-IV',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (classifications.length > 0) {
    categories.push({ name: 'Clinical Classifications', charts: classifications });
  }

  // Category 4: Hemodynamics
  const hemodynamics = [];
  if (record.hemodynamicParameters?.heartRate) {
    const val = extractNumeric(record.hemodynamicParameters.heartRate);
    if (val !== null) {
      let interpretation = 'Normal';
      if (val < 50 || val > 120) interpretation = val < 50 ? 'Bradycardia' : 'Tachycardia';
      else if (val < 60 || val > 100) interpretation = val < 60 ? 'Low Normal' : 'High Normal';
      hemodynamics.push({
        label: 'Heart Rate',
        value: val,
        unit: 'bpm',
        max: 150,
        reference: '60-100 bpm',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (record.hemodynamicParameters?.oxygenSaturation) {
    const val = extractNumeric(record.hemodynamicParameters.oxygenSaturation);
    if (val !== null) {
      let interpretation = 'Normal';
      if (val < 90) interpretation = 'Hypoxemia';
      else if (val < 95) interpretation = 'Low Normal';
      hemodynamics.push({
        label: 'O2 Saturation',
        value: val,
        unit: '%',
        max: 100,
        reference: '>=95%',
        interpretation,
        color: getInterpretationColor(interpretation)
      });
    }
  }
  if (hemodynamics.length > 0) {
    categories.push({ name: 'Hemodynamics', charts: hemodynamics });
  }

  return categories;
};

const CardiologyAdmissionDocumentPDFTemplate = ({ document: templateData }) => {
  // Data unwrapping
  const records = React.useMemo(() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0].records) {
        return templateData[0].records;
      }
      return templateData;
    }
    if (templateData.records) return templateData.records;
    return [templateData];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Cardiology Admission Notes</Text>
          <Text style={styles.emptyState}>No cardiology admission records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiology Admission Notes</Text>

        {records.map((record, idx) => {
          const chartData = record._chartData || extractChartData(record);
          const hasChartData = chartData.length > 0;

          return (
            <View key={idx} style={styles.recordSection}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {String(record._documentTitle || record._docTitle || `Cardiology Admission ${idx + 1}`)}
                </Text>
                {record.admissionDate && (
                  <Text style={styles.recordMeta}>
                    Admission Date: {formatDate(record.admissionDate)}
                  </Text>
                )}
                {record.acuteCoronarySyndromeType && (
                  <Text style={styles.badge}>
                    ACS Type: {safeString(record.acuteCoronarySyndromeType)}
                  </Text>
                )}
              </View>

              {/* Chart Section - Professional color-coded bars */}
              {hasChartData && (
                <View style={styles.chartSection}>
                  {/* Title + Legend stay together */}
                  <View wrap={false}>
                    <Text style={styles.chartTitle}>Cardiac Parameters Overview</Text>
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.normal }]} />
                        <Text style={styles.legendText}>Normal</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.borderline }]} />
                        <Text style={styles.legendText}>Borderline</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.elevated }]} />
                        <Text style={styles.legendText}>Elevated</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.critical }]} />
                        <Text style={styles.legendText}>Critical</Text>
                      </View>
                    </View>
                  </View>
                  {/* Each category stays together but can break between categories */}
                  {chartData.map((category, catIdx) => (
                    <View key={catIdx} style={styles.chartCategory} wrap={false}>
                      <Text style={[styles.chartCategoryHeader, { borderBottomColor: COLORS.header }]}>
                        {String(category.name)}
                      </Text>
                      {category.charts.map((chart, chartIdx) => (
                        <View key={chartIdx} style={styles.chartBar}>
                          <Text style={styles.chartBarLabel}>
                            {String(chart.label)}: {String(chart.value)}{chart.unit ? ` ${chart.unit}` : ''}
                          </Text>
                          <View style={styles.chartBarTrack}>
                            <View
                              style={[
                                styles.chartBarFill,
                                {
                                  width: `${Math.min((chart.value / chart.max) * 100, 100)}%`,
                                  backgroundColor: chart.color || COLORS.normal
                                }
                              ]}
                            />
                          </View>
                          <Text style={[styles.chartBarInfo, { color: chart.color || COLORS.normal }]}>
                            {String(chart.interpretation)} (Ref: {String(chart.reference)})
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Chief Complaint */}
              {record.chiefCardiacComplaint && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Chief Complaint</Text>
                  <Text style={styles.fieldContent}>{safeString(record.chiefCardiacComplaint)}</Text>
                </View>
              )}

              {/* Chest Pain Characteristics */}
              {record.chestPainCharacteristics && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Chest Pain Characteristics</Text>
                  {record.chestPainCharacteristics.quality && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Quality:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.quality)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.severity && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Severity:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.severity)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.location && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Location:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.location)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.radiation && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Radiation:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.radiation)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.duration && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Duration:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.duration)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.onset && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Onset:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.onset)}</Text>
                    </View>
                  )}
                  {record.chestPainCharacteristics.associatedSymptoms?.length > 0 && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Associated Symptoms:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.chestPainCharacteristics.associatedSymptoms.join(', '))}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Clinical Classifications - HIDDEN when bar chart has data (duplicates) */}
              {!hasChartData && (record.nyhaClassification || record.killipClassification) && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Classifications</Text>
                  {record.nyhaClassification && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>NYHA Classification:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.nyhaClassification)}</Text>
                    </View>
                  )}
                  {record.killipClassification && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Killip Classification:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.killipClassification)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* EKG Findings */}
              {record.ekgFindings && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>EKG Findings</Text>
                  <Text style={styles.fieldContent}>{safeString(record.ekgFindings)}</Text>
                </View>
              )}

              {/* Echocardiogram Results - EF hidden when bar chart has it */}
              {record.echocardiogramResults && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Echocardiogram Results</Text>
                  {/* EF hidden when bar chart shows it (duplicate removal) */}
                  {!hasChartData && record.echocardiogramResults.ejectionFraction && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Ejection Fraction:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.echocardiogramResults.ejectionFraction)}</Text>
                    </View>
                  )}
                  {record.echocardiogramResults.wallMotion && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Wall Motion:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.echocardiogramResults.wallMotion)}</Text>
                    </View>
                  )}
                  {(record.echocardiogramResults.valves || record.echocardiogramResults.valvularDisease) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Valves:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.echocardiogramResults.valves || record.echocardiogramResults.valvularDisease)}</Text>
                    </View>
                  )}
                  {(record.echocardiogramResults.complications || record.echocardiogramResults.pericardialEffusion) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Complications:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.echocardiogramResults.complications || record.echocardiogramResults.pericardialEffusion)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Hemodynamic Parameters - HR and O2 hidden when bar chart has them */}
              {record.hemodynamicParameters && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Hemodynamic Parameters</Text>
                  {/* Blood Pressure stays (NOT in bar chart) */}
                  {record.hemodynamicParameters.bloodPressure && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Blood Pressure:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.hemodynamicParameters.bloodPressure)}</Text>
                    </View>
                  )}
                  {/* Heart Rate and O2 hidden when bar chart shows them (duplicate removal) */}
                  {!hasChartData && record.hemodynamicParameters.heartRate && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Heart Rate:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.hemodynamicParameters.heartRate)}</Text>
                    </View>
                  )}
                  {!hasChartData && record.hemodynamicParameters.oxygenSaturation && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>O2 Saturation:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.hemodynamicParameters.oxygenSaturation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Cardiac Risk Factors */}
              {record.cardiacRiskFactors?.length > 0 && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Cardiac Risk Factors</Text>
                  {record.cardiacRiskFactors.map((rf, rfIdx) => (
                    <Text key={rfIdx} style={styles.listItem}>
                      {rfIdx + 1}. {safeString(rf)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Current Cardiac Medications */}
              {record.currentCardiacMedications?.length > 0 && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Current Cardiac Medications</Text>
                  {record.currentCardiacMedications.map((med, medIdx) => (
                    <Text key={medIdx} style={styles.listItem}>
                      {medIdx + 1}. {safeString(med)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Cardiac Biomarker Trend */}
              {record.cardiacBiomarkerTrend?.length > 0 && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Cardiac Biomarker Trend</Text>
                  {record.cardiacBiomarkerTrend.map((trend, trendIdx) => (
                    <Text key={trendIdx} style={styles.listItem}>
                      {trendIdx + 1}. {safeString(trend)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Anticoagulation Status */}
              {record.anticoagulationStatus && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Anticoagulation Status</Text>
                  {record.anticoagulationStatus.therapy && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Therapy:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.anticoagulationStatus.therapy)}</Text>
                    </View>
                  )}
                  {record.anticoagulationStatus.indication && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Indication:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.anticoagulationStatus.indication)}</Text>
                    </View>
                  )}
                  {record.anticoagulationStatus.duration && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Duration:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.anticoagulationStatus.duration)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Treatment & Procedures */}
              {(record.coronaryArteryDiseaseHistory || record.cardiacCatheterizationPlanned || record.thrombolyticEligibility) && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment and Procedures</Text>
                  {record.coronaryArteryDiseaseHistory && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>CAD History:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.coronaryArteryDiseaseHistory)}</Text>
                    </View>
                  )}
                  {record.cardiacCatheterizationPlanned && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Catheterization:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.cardiacCatheterizationPlanned)}</Text>
                    </View>
                  )}
                  {record.thrombolyticEligibility && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Thrombolytic Eligibility:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.thrombolyticEligibility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Pulmonary Status */}
              {record.pulmonaryEdemaPresence && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Pulmonary Status</Text>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pulmonary Edema:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.pulmonaryEdemaPresence)}</Text>
                  </View>
                </View>
              )}

              {/* Monitoring Plan */}
              {(record.telemetryMonitoring || record.functionalCapacity || record.arrhythmiaType) && (
                <View style={styles.sectionContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Monitoring Plan</Text>
                  {record.telemetryMonitoring && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Telemetry:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.telemetryMonitoring)}</Text>
                    </View>
                  )}
                  {record.functionalCapacity && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Functional Capacity:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.functionalCapacity)}</Text>
                    </View>
                  )}
                  {record.arrhythmiaType && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Arrhythmia Type:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.arrhythmiaType)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CardiologyAdmissionDocumentPDFTemplate;
