import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    paddingBottom: 8,
  },
  recordCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#404040',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
    color: '#4b5563',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#1f2937',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
});

const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 18,
    padding: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a1a1a1',
  },
  barChartRow: {
    marginBottom: 14,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
  },
  barCategoryValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  barBackground: {
    flex: 1,
    height: 20,
    backgroundColor: '#a1a1a1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barInterpretation: {
    fontSize: 10,
    marginTop: 3,
  },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    if (val.value !== undefined) return String(val.value);
    if (val.text !== undefined) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue || '');
  }
};

const getASAClassification = (asaValue) => {
  if (!asaValue) return null;
  const asaStr = safeString(asaValue).toUpperCase();
  let level = 0, description = '', color = '#898989';
  if (asaStr.includes('VI') || asaStr.includes('6')) { level = 6; description = 'Brain Dead Organ Donor'; color = '#1f2937'; }
  else if (asaStr.includes('V') || asaStr.includes('5')) { level = 5; description = 'Moribund'; color = '#5c5c5c'; }
  else if (asaStr.includes('IV') || asaStr.includes('4')) { level = 4; description = 'Life-Threatening Disease'; color = '#777777'; }
  else if (asaStr.includes('III') || asaStr.includes('3')) { level = 3; description = 'Severe Systemic Disease'; color = '#909090'; }
  else if (asaStr.includes('II') || asaStr.includes('2')) { level = 2; description = 'Mild Systemic Disease'; color = '#b0b0b0'; }
  else if (asaStr.includes('I') || asaStr.includes('1')) { level = 1; description = 'Healthy Patient'; color = '#898989'; }
  if (level === 0) return null;
  const percentage = level === 1 ? 17 : (level / 6) * 100;
  return { level, rawValue: safeString(asaValue), description, color, percentage };
};

const getMallampatiScore = (mallampatiValue) => {
  if (!mallampatiValue) return null;
  const s = safeString(mallampatiValue).toUpperCase();
  let level = 0, description = '', color = '#898989';
  if (s.includes('IV') || s.includes('4')) { level = 4; description = 'Soft Palate Not Visible - Difficult Intubation'; color = '#5c5c5c'; }
  else if (s.includes('III') || s.includes('3')) { level = 3; description = 'Base of Uvula Visible'; color = '#909090'; }
  else if (s.includes('II') || s.includes('2')) { level = 2; description = 'Soft Palate, Fauces, Uvula Visible'; color = '#b0b0b0'; }
  else if (s.includes('I') || s.includes('1')) { level = 1; description = 'Full Visibility - Easy Intubation'; color = '#898989'; }
  if (level === 0) return null;
  const percentage = level === 1 ? 25 : (level / 4) * 100;
  return { level, rawValue: safeString(mallampatiValue), description, color, percentage };
};

const getCardiovascularRisk = (riskValue) => {
  if (!riskValue) return null;
  const s = safeString(riskValue).toLowerCase();
  let level = 0, description = '', color = '#898989';
  if (s.includes('high') || s.includes('severe')) { level = 3; description = 'High Risk'; color = '#5c5c5c'; }
  else if (s.includes('moderate') || s.includes('medium') || s.includes('intermediate')) { level = 2; description = 'Moderate Risk'; color = '#909090'; }
  else if (s.includes('low') || s.includes('minimal')) { level = 1; description = 'Low Risk'; color = '#898989'; }
  if (level === 0) return null;
  const percentage = level === 1 ? 33 : (level / 3) * 100;
  return { level, rawValue: safeString(riskValue), description, color, percentage };
};

const PDFBarChart = ({ label, severity }) => {
  if (!severity) return null;
  return (
    <View style={chartStyles.barChartRow}>
      <Text style={chartStyles.barLabel}>{String(label)}</Text>
      <Text style={[chartStyles.barCategoryValue, { color: severity.color }]}>{String(severity.rawValue)}</Text>
      <View style={chartStyles.barContainer}>
        <View style={chartStyles.barBackground}>
          <View style={[chartStyles.barFill, { width: `${severity.percentage}%`, backgroundColor: severity.color }]} />
        </View>
      </View>
      <Text style={[chartStyles.barInterpretation, { color: severity.color }]}>{String(severity.description)}</Text>
    </View>
  );
};

const PreoperativeEvaluationDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) {
      records = document[0].records;
    } else if (document.length > 0 && document[0]?._records) {
      records = document[0]._records;
    } else {
      records = document;
    }
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preoperative Evaluation</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No preoperative evaluation data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preoperative Evaluation</Text>

        {validRecords.map((record, idx) => {
          const asaSeverity = getASAClassification(record.asaClassification);
          const mallampatiSeverity = getMallampatiScore(record.mallampatiScore);
          const cardiovascularSeverity = getCardiovascularRisk(record.cardiovascularRiskIndex);
          const hasCharts = asaSeverity || mallampatiSeverity || cardiovascularSeverity;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>{`Preoperative Evaluation ${idx + 1}`}</Text>

              {/* Risk Assessment Section with Bar Charts */}
              {hasCharts && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={styles.sectionTitle}>Risk Assessment</Text>
                  {asaSeverity && <PDFBarChart label="ASA Classification" severity={asaSeverity} />}
                  {mallampatiSeverity && <PDFBarChart label="Mallampati Score" severity={mallampatiSeverity} />}
                  {cardiovascularSeverity && <PDFBarChart label="Cardiovascular Risk Index" severity={cardiovascularSeverity} />}
                </View>
              )}

              {/* Evaluation Information Section */}
              {(record.date || record.anesthesiologistName || record.informedConsentObtained !== undefined) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Evaluation Information</Text>
                  {record.date && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date</Text>
                      <Text style={styles.fieldValue}>{String(formatDate(record.date))}</Text>
                    </View>
                  )}
                  {record.anesthesiologistName && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Anesthesiologist</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.anesthesiologistName))}</Text>
                    </View>
                  )}
                  {record.informedConsentObtained !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Informed Consent Obtained</Text>
                      <Text style={styles.fieldValue}>{record.informedConsentObtained ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Procedure Details Section */}
              {(record.proposedProcedure || record.scheduledSurgeryDate || record.anesthesiaType) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Procedure Details</Text>
                  {record.proposedProcedure && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Proposed Procedure</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.proposedProcedure))}</Text>
                    </View>
                  )}
                  {record.scheduledSurgeryDate && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Scheduled Surgery Date</Text>
                      <Text style={styles.fieldValue}>{String(formatDate(record.scheduledSurgeryDate))}</Text>
                    </View>
                  )}
                  {record.anesthesiaType && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Anesthesia Type</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.anesthesiaType))}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Airway Assessment Section */}
              {(record.neckMobility || record.thyromenthalDistance || record.mouthOpening || record.dentalCondition || (record.difficultAirwayPredictors && record.difficultAirwayPredictors.length > 0)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Airway Assessment</Text>
                  {record.neckMobility && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Neck Mobility</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.neckMobility))}</Text>
                    </View>
                  )}
                  {record.thyromenthalDistance && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Thyromental Distance</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.thyromenthalDistance))}</Text>
                    </View>
                  )}
                  {record.mouthOpening && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Mouth Opening</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.mouthOpening))}</Text>
                    </View>
                  )}
                  {record.dentalCondition && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Dental Condition</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.dentalCondition))}</Text>
                    </View>
                  )}
                  {record.difficultAirwayPredictors && record.difficultAirwayPredictors.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Difficult Airway Predictors</Text>
                      {record.difficultAirwayPredictors.map((predictor, pIdx) => (
                        <Text key={pIdx} style={styles.listItem}>{`${pIdx + 1}. ${String(safeString(predictor))}`}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Medical History Section */}
              {(record.fastingStatus || record.lastOralIntake || record.aspirationRisk || record.coagulationStatus || record.functionalCapacity || (record.activeCardiacConditions && record.activeCardiacConditions.length > 0) || (record.respiratoryRiskFactors && record.respiratoryRiskFactors.length > 0) || (record.priorAnesthesiaComplications && record.priorAnesthesiaComplications.length > 0) || record.familialAnesthesiaHistory) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Medical History</Text>
                  {record.fastingStatus && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Fasting Status</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.fastingStatus))}</Text>
                    </View>
                  )}
                  {record.lastOralIntake && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Last Oral Intake</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.lastOralIntake))}</Text>
                    </View>
                  )}
                  {record.aspirationRisk && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Aspiration Risk</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.aspirationRisk))}</Text>
                    </View>
                  )}
                  {record.coagulationStatus && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Coagulation Status</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.coagulationStatus))}</Text>
                    </View>
                  )}
                  {record.functionalCapacity && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Functional Capacity</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.functionalCapacity))}</Text>
                    </View>
                  )}
                  {record.activeCardiacConditions && record.activeCardiacConditions.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Active Cardiac Conditions</Text>
                      {record.activeCardiacConditions.map((condition, cIdx) => (
                        <Text key={cIdx} style={styles.listItem}>{`${cIdx + 1}. ${String(safeString(condition))}`}</Text>
                      ))}
                    </View>
                  )}
                  {record.respiratoryRiskFactors && record.respiratoryRiskFactors.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Respiratory Risk Factors</Text>
                      {record.respiratoryRiskFactors.map((factor, fIdx) => (
                        <Text key={fIdx} style={styles.listItem}>{`${fIdx + 1}. ${String(safeString(factor))}`}</Text>
                      ))}
                    </View>
                  )}
                  {record.priorAnesthesiaComplications && record.priorAnesthesiaComplications.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Prior Anesthesia Complications</Text>
                      {record.priorAnesthesiaComplications.map((comp, compIdx) => (
                        <Text key={compIdx} style={styles.listItem}>{`${compIdx + 1}. ${String(safeString(comp))}`}</Text>
                      ))}
                    </View>
                  )}
                  {record.familialAnesthesiaHistory && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Familial Anesthesia History</Text>
                      <Text style={styles.fieldValue}>{String(safeString(record.familialAnesthesiaHistory))}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Medications Section */}
              {((record.currentMedications && record.currentMedications.length > 0) || (record.medicationAllergies && record.medicationAllergies.length > 0) || (record.preoperativeLabValues && record.preoperativeLabValues.length > 0)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Medications</Text>
                  {record.currentMedications && record.currentMedications.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Current Medications</Text>
                      {record.currentMedications.map((med, mIdx) => (
                        <Text key={mIdx} style={styles.listItem}>{`${mIdx + 1}. ${String(safeString(med))}`}</Text>
                      ))}
                    </View>
                  )}
                  {record.medicationAllergies && record.medicationAllergies.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Medication Allergies</Text>
                      {record.medicationAllergies.map((allergy, aIdx) => (
                        <Text key={aIdx} style={styles.listItem}>{`${aIdx + 1}. ${String(safeString(allergy))}`}</Text>
                      ))}
                    </View>
                  )}
                  {record.preoperativeLabValues && record.preoperativeLabValues.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Preoperative Lab Values</Text>
                      {record.preoperativeLabValues.map((lab, lIdx) => (
                        <Text key={lIdx} style={styles.listItem}>{`${lIdx + 1}. ${String(safeString(lab))}`}</Text>
                      ))}
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

export default PreoperativeEvaluationDocumentPDFTemplate;
