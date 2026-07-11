import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  consultationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  line: {
    fontSize: 11,
    marginBottom: 3,
  },
  divider: {
    marginTop: 16,
    marginBottom: 16,
    borderBottom: '1px solid #ccc',
  },
  // PFT Bar Chart Styles
  chartContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 4,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#606060',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    color: '#727272',
  },
  barRow: {
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#606060',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    width: 80,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 8,
    marginTop: 2,
    paddingLeft: 4,
  },
  pftInterpretation: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    fontSize: 10,
  },
  interpretationLabel: {
    fontWeight: 'bold',
    color: '#606060',
  },
});

// Helper to safely convert values to strings
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    if (val.value !== undefined) return String(val.value);
    if (val.text !== undefined) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

// Extract percentage from PFT values like "2.48 L (62% predicted)" or "60%"
const extractPFTPercentage = (text) => {
  if (!text) return null;
  const str = String(text);
  const percentMatch = str.match(/(\d+(?:\.\d+)?)\s*%/i);
  if (percentMatch) return parseFloat(percentMatch[1]);
  return null;
};

// Color coding for lung function (higher = better = green)
const getPFTScoreColor = (percentage) => {
  if (percentage >= 80) return '#898989'; // Green - Normal
  if (percentage >= 60) return '#7a7a7a'; // Blue - Mild obstruction
  if (percentage >= 40) return '#a7a7a7'; // Orange - Moderate obstruction
  return '#777777'; // Red - Severe obstruction
};

// Get interpretation text based on percentage
const getPFTInterpretation = (percentage) => {
  if (percentage >= 80) return 'Normal';
  if (percentage >= 60) return 'Mild obstruction';
  if (percentage >= 40) return 'Moderate obstruction';
  return 'Severe obstruction';
};

// Prepare PFT data for bar chart
const preparePFTChartData = (consult) => {
  const chartData = [];
  const pft = consult.pulmonaryFunctionTests || {};

  // FEV1
  const fev1Percent = extractPFTPercentage(pft.fev1);
  if (fev1Percent !== null) {
    chartData.push({
      label: 'FEV1 (% predicted)',
      value: fev1Percent,
      rawValue: safeString(pft.fev1),
      color: getPFTScoreColor(fev1Percent),
      interpretation: getPFTInterpretation(fev1Percent)
    });
  }

  // FVC
  const fvcPercent = extractPFTPercentage(pft.fvc);
  if (fvcPercent !== null) {
    chartData.push({
      label: 'FVC (% predicted)',
      value: fvcPercent,
      rawValue: safeString(pft.fvc),
      color: getPFTScoreColor(fvcPercent),
      interpretation: getPFTInterpretation(fvcPercent)
    });
  }

  // FEV1/FVC Ratio
  const ratioPercent = extractPFTPercentage(pft.fev1FvcRatio);
  if (ratioPercent !== null) {
    chartData.push({
      label: 'FEV1/FVC Ratio',
      value: ratioPercent,
      rawValue: safeString(pft.fev1FvcRatio),
      color: getPFTScoreColor(ratioPercent),
      interpretation: getPFTInterpretation(ratioPercent)
    });
  }

  return chartData;
};

const PulmonologyConsultationsPDFTemplate = ({ document }) => {
  const consultations = Array.isArray(document) ? document : [document];
  const validConsultations = consultations.filter(c => c && typeof c === 'object');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>PULMONOLOGY CONSULTATIONS</Text>

        {validConsultations.map((consult, index) => (
          <View key={index}>
            <Text style={styles.consultationTitle}>Consultation {index + 1} - {formatDate(consult.date)}</Text>

            {/* General Information */}
            {(consult.type || consult.provider || consult.facility) && (
              <View>
                <Text style={styles.sectionTitle}>GENERAL INFORMATION</Text>
                {consult.type && <Text style={styles.line}>Type: {safeString(consult.type)}</Text>}
                {consult.provider && <Text style={styles.line}>Provider: {safeString(consult.provider)}</Text>}
                {consult.facility && <Text style={styles.line}>Facility: {safeString(consult.facility)}</Text>}
              </View>
            )}

            {/* PFT Bar Chart Visualization */}
            {(() => {
              const pftChartData = preparePFTChartData(consult);
              if (pftChartData.length === 0) return null;

              const pft = consult.pulmonaryFunctionTests || {};
              return (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>PULMONARY FUNCTION TESTS</Text>

                  {/* Legend */}
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#898989' }]} />
                      <Text style={styles.legendText}>Normal (≥80%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} />
                      <Text style={styles.legendText}>Mild (60-79%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} />
                      <Text style={styles.legendText}>Moderate (40-59%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#777777' }]} />
                      <Text style={styles.legendText}>Severe (&lt;40%)</Text>
                    </View>
                  </View>

                  {/* Bar Chart Rows */}
                  {pftChartData.map((item, idx) => (
                    <View key={idx} style={styles.barRow}>
                      <Text style={styles.barLabel}>{item.label}</Text>
                      <View style={styles.barContainer}>
                        <View style={styles.barBackground}>
                          <View style={[styles.barFill, {
                            width: `${Math.min(item.value, 100)}%`,
                            backgroundColor: item.color
                          }]} />
                        </View>
                        <Text style={styles.barValue}>{item.rawValue}</Text>
                      </View>
                      <Text style={[styles.barInterpretation, { color: item.color }]}>
                        {item.interpretation}
                      </Text>
                    </View>
                  ))}

                  {/* Interpretation */}
                  {pft.interpretation && (
                    <View style={styles.pftInterpretation}>
                      <Text>
                        <Text style={styles.interpretationLabel}>Interpretation: </Text>
                        {safeString(pft.interpretation)}
                      </Text>
                    </View>
                  )}

                  {/* Test Date */}
                  {pft.date && (
                    <Text style={{ fontSize: 9, color: '#727272', marginTop: 4 }}>
                      Test Date: {formatDate(pft.date)}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* Respiratory Assessment */}
            {(consult.respiratoryRate || consult.oxygenSaturation || consult.oxygenTherapy || consult.peakFlow) && (
              <View>
                <Text style={styles.sectionTitle}>RESPIRATORY ASSESSMENT</Text>
                {consult.respiratoryRate && <Text style={styles.line}>Respiratory Rate: {safeString(consult.respiratoryRate)}</Text>}
                {consult.oxygenSaturation && <Text style={styles.line}>Oxygen Saturation: {safeString(consult.oxygenSaturation)}</Text>}
                {consult.oxygenTherapy && (
                  <>
                    <Text style={styles.line}>Oxygen Therapy:</Text>
                    {typeof consult.oxygenTherapy === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.oxygenTherapy)}</Text>
                    ) : (
                      <>
                        {consult.oxygenTherapy.prescribed && <Text style={styles.line}>  Prescribed: {safeString(consult.oxygenTherapy.prescribed)}</Text>}
                        {consult.oxygenTherapy.deliveryMethod && <Text style={styles.line}>  Delivery Method: {safeString(consult.oxygenTherapy.deliveryMethod)}</Text>}
                        {consult.oxygenTherapy.flowRate && <Text style={styles.line}>  Flow Rate: {safeString(consult.oxygenTherapy.flowRate)}</Text>}
                        {consult.oxygenTherapy.duration && <Text style={styles.line}>  Duration: {safeString(consult.oxygenTherapy.duration)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.peakFlow && <Text style={styles.line}>Peak Flow: {safeString(consult.peakFlow)}</Text>}
              </View>
            )}

            {/* Diagnosis */}
            {(consult.primaryDiagnosis || (consult.secondaryDiagnoses && consult.secondaryDiagnoses.length > 0) || consult.severity || consult.exacerbationRisk) && (
              <View>
                <Text style={styles.sectionTitle}>DIAGNOSIS</Text>
                {consult.primaryDiagnosis && <Text style={styles.line}>Primary Diagnosis: {safeString(consult.primaryDiagnosis)}</Text>}
                {consult.secondaryDiagnoses && consult.secondaryDiagnoses.length > 0 && (
                  <>
                    <Text style={styles.line}>Secondary Diagnoses:</Text>
                    {consult.secondaryDiagnoses.map((diag, idx) => (
                      <Text key={idx} style={styles.line}>  - {safeString(diag)}</Text>
                    ))}
                  </>
                )}
                {consult.severity && <Text style={styles.line}>Severity: {safeString(consult.severity)}</Text>}
                {consult.exacerbationRisk && <Text style={styles.line}>Exacerbation Risk: {safeString(consult.exacerbationRisk)}</Text>}
              </View>
            )}

            {/* Medications */}
            {(consult.bronchodilator || consult.corticosteroid || consult.respiratoryMedication) && (
              <View>
                <Text style={styles.sectionTitle}>MEDICATIONS</Text>
                {consult.bronchodilator && (
                  <>
                    <Text style={styles.line}>Bronchodilator:</Text>
                    {typeof consult.bronchodilator === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.bronchodilator)}</Text>
                    ) : (
                      <>
                        {consult.bronchodilator.medication && <Text style={styles.line}>  Medication: {safeString(consult.bronchodilator.medication)}</Text>}
                        {consult.bronchodilator.dose && <Text style={styles.line}>  Dose: {safeString(consult.bronchodilator.dose)}</Text>}
                        {consult.bronchodilator.device && <Text style={styles.line}>  Device: {safeString(consult.bronchodilator.device)}</Text>}
                        {consult.bronchodilator.type && <Text style={styles.line}>  Type: {safeString(consult.bronchodilator.type)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.corticosteroid && (
                  <>
                    <Text style={styles.line}>Corticosteroid:</Text>
                    {typeof consult.corticosteroid === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.corticosteroid)}</Text>
                    ) : (
                      <>
                        {consult.corticosteroid.medication && <Text style={styles.line}>  Medication: {safeString(consult.corticosteroid.medication)}</Text>}
                        {consult.corticosteroid.dose && <Text style={styles.line}>  Dose: {safeString(consult.corticosteroid.dose)}</Text>}
                        {consult.corticosteroid.route && <Text style={styles.line}>  Route: {safeString(consult.corticosteroid.route)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.respiratoryMedication && <Text style={styles.line}>Respiratory Medication: {safeString(consult.respiratoryMedication)}</Text>}
              </View>
            )}

            {/* Smoking History */}
            {(consult.smokingStatus || consult.packYears !== undefined || consult.quitDate || consult.smokingCessation) && (
              <View>
                <Text style={styles.sectionTitle}>SMOKING HISTORY</Text>
                {consult.smokingStatus && <Text style={styles.line}>Status: {safeString(consult.smokingStatus)}</Text>}
                {consult.packYears !== undefined && consult.packYears !== null && <Text style={styles.line}>Pack Years: {safeString(consult.packYears)}</Text>}
                {consult.quitDate && <Text style={styles.line}>Quit Date: {formatDate(consult.quitDate)}</Text>}
                {consult.smokingCessation && (
                  <>
                    <Text style={styles.line}>Smoking Cessation:</Text>
                    {typeof consult.smokingCessation === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.smokingCessation)}</Text>
                    ) : (
                      <>
                        {consult.smokingCessation.counselingProvided && <Text style={styles.line}>  Counseling Provided: {safeString(consult.smokingCessation.counselingProvided)}</Text>}
                        {consult.smokingCessation.pharmacotherapy && <Text style={styles.line}>  Pharmacotherapy: {safeString(consult.smokingCessation.pharmacotherapy)}</Text>}
                        {consult.smokingCessation.referral && <Text style={styles.line}>  Referral: {safeString(consult.smokingCessation.referral)}</Text>}
                      </>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Imaging Findings */}
            {(consult.chestXRay || consult.ctScan || consult.imagingDate) && (
              <View>
                <Text style={styles.sectionTitle}>IMAGING FINDINGS</Text>
                {consult.chestXRay && (
                  <>
                    <Text style={styles.line}>Chest X-Ray:</Text>
                    <Text style={styles.line}>  {safeString(consult.chestXRay)}</Text>
                  </>
                )}
                {consult.ctScan && (
                  <>
                    <Text style={styles.line}>CT Scan:</Text>
                    <Text style={styles.line}>  {safeString(consult.ctScan)}</Text>
                  </>
                )}
                {consult.imagingDate && <Text style={styles.line}>Imaging Date: {formatDate(consult.imagingDate)}</Text>}
              </View>
            )}

            {/* Physical Exam */}
            {(consult.breathingSounds || consult.cough || consult.dyspnea || consult.chestPain) && (
              <View>
                <Text style={styles.sectionTitle}>PHYSICAL EXAM</Text>
                {consult.breathingSounds && (
                  <>
                    <Text style={styles.line}>Breathing Sounds:</Text>
                    {typeof consult.breathingSounds === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.breathingSounds)}</Text>
                    ) : (
                      <>
                        {consult.breathingSounds.normal !== undefined && <Text style={styles.line}>  Normal: {consult.breathingSounds.normal ? 'Yes' : 'No'}</Text>}
                        {consult.breathingSounds.abnormalSounds && <Text style={styles.line}>  Abnormal Sounds: {safeString(consult.breathingSounds.abnormalSounds)}</Text>}
                        {consult.breathingSounds.location && <Text style={styles.line}>  Location: {safeString(consult.breathingSounds.location)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.cough && (
                  <>
                    <Text style={styles.line}>Cough:</Text>
                    {typeof consult.cough === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.cough)}</Text>
                    ) : (
                      <>
                        {consult.cough.present !== undefined && <Text style={styles.line}>  Present: {consult.cough.present ? 'Yes' : 'No'}</Text>}
                        {consult.cough.type && <Text style={styles.line}>  Type: {safeString(consult.cough.type)}</Text>}
                        {consult.cough.sputum && <Text style={styles.line}>  Sputum: {safeString(consult.cough.sputum)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.dyspnea && (
                  <>
                    <Text style={styles.line}>Dyspnea:</Text>
                    {typeof consult.dyspnea === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.dyspnea)}</Text>
                    ) : (
                      <>
                        {consult.dyspnea.severity && <Text style={styles.line}>  Severity: {safeString(consult.dyspnea.severity)}</Text>}
                        {consult.dyspnea.triggers && <Text style={styles.line}>  Triggers: {safeString(consult.dyspnea.triggers)}</Text>}
                      </>
                    )}
                  </>
                )}
                {consult.chestPain && (
                  <>
                    <Text style={styles.line}>Chest Pain:</Text>
                    {typeof consult.chestPain === 'string' ? (
                      <Text style={styles.line}>  {safeString(consult.chestPain)}</Text>
                    ) : (
                      <>
                        {consult.chestPain.present !== undefined && <Text style={styles.line}>  Present: {consult.chestPain.present ? 'Yes' : 'No'}</Text>}
                        {consult.chestPain.description && <Text style={styles.line}>  Description: {safeString(consult.chestPain.description)}</Text>}
                      </>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Findings */}
            {consult.findings && (
              <View>
                <Text style={styles.sectionTitle}>FINDINGS</Text>
                <Text style={styles.line}>{safeString(consult.findings)}</Text>
              </View>
            )}

            {/* Assessment */}
            {consult.assessment && (
              <View>
                <Text style={styles.sectionTitle}>ASSESSMENT</Text>
                <Text style={styles.line}>{safeString(consult.assessment)}</Text>
              </View>
            )}

            {/* Plan */}
            {consult.plan && (
              <View>
                <Text style={styles.sectionTitle}>PLAN</Text>
                <Text style={styles.line}>{safeString(consult.plan)}</Text>
              </View>
            )}

            {/* Recommendations */}
            {consult.recommendations && consult.recommendations.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
                {consult.recommendations.map((rec, idx) => {
                  const recText = typeof rec === 'string' ? rec : rec.recommendation;
                  const recDate = typeof rec === 'object' ? rec.date : null;
                  return (
                    <View key={idx}>
                      <Text style={styles.line}>{idx + 1}. {safeString(recText)}</Text>
                      {recDate && <Text style={styles.line}>   Date: {formatDate(recDate)}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Test Results */}
            {consult.results && Object.keys(consult.results).length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>TEST RESULTS</Text>
                {Object.entries(consult.results).map(([key, value]) => (
                  <Text key={key} style={styles.line}>{safeString(key)}: {safeString(value)}</Text>
                ))}
              </View>
            )}

            {/* Notes */}
            {consult.notes && (
              <View>
                <Text style={styles.sectionTitle}>NOTES</Text>
                <Text style={styles.line}>{safeString(consult.notes)}</Text>
              </View>
            )}

            {/* Status */}
            {consult.status && <Text style={styles.line}>Status: {safeString(consult.status)}</Text>}

            {/* Divider between consultations */}
            {index < validConsultations.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PulmonologyConsultationsPDFTemplate;
