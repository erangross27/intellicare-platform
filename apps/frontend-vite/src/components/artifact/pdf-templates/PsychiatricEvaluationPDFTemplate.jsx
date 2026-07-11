import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PsychiatricEvaluationPDFTemplate - PDF export for psychiatric evaluations
 * March 2026 Standards - Helvetica font, LETTER size, 20pt title / 12pt body
 *
 * Schema (11 fields):
 * - date, chiefComplaint, historyOfPresentIllness
 * - psychiatricHistory, substanceUseHistory, mentalStatusExam
 * - riskAssessment, diagnosis, treatmentPlan, medications, psychiatrist
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.6,
    color: '#000'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#606060'
  },
  fieldBlock: {
    marginBottom: 8
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
    textTransform: 'uppercase'
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.5
  },
  arrayItem: {
    fontSize: 12,
    marginBottom: 3,
    paddingLeft: 10
  },
  divider: {
    borderBottom: '1px solid #ccc',
    marginVertical: 16
  },
  scoreSection: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#606060',
    borderRadius: 4,
    backgroundColor: '#f0f7ff'
  },
  scoreSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    color: '#606060'
  },
  scoreRow: {
    marginBottom: 10
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  scoreBarBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 3
  },
  scoreBarFill: {
    height: 16,
    borderRadius: 3
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
    minWidth: 50
  },
  scoreInterpretation: {
    fontSize: 11,
    fontStyle: 'italic'
  }
});

const PsychiatricEvaluationPDFTemplate = ({ document }) => {
  let evaluationsArray = [];

  if (Array.isArray(document)) {
    evaluationsArray = document;
  } else if (document?.psychiatric_evaluations && Array.isArray(document.psychiatric_evaluations)) {
    evaluationsArray = document.psychiatric_evaluations;
  } else if (document?.psychiatric_evaluation && Array.isArray(document.psychiatric_evaluation)) {
    evaluationsArray = document.psychiatric_evaluation;
  } else if (document?.documentData) {
    evaluationsArray = [document.documentData];
  } else {
    evaluationsArray = [document];
  }

  const validRecords = evaluationsArray.filter(record => record && typeof record === 'object');

  const formatDate = (date) => {
    if (!date) return '';
    try {
      return new Date(date.$date || date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(date);
    }
  };

  const extractScoresFromDiagnosis = (diagnosis) => {
    if (!diagnosis || !Array.isArray(diagnosis)) return { phq9: null, gad7: null };
    const diagnosisText = diagnosis.join(' ');
    const phq9Match = diagnosisText.match(/PHQ[-\s]?9[:\s]+(\d+)\s*\/\s*(\d+)/i);
    const phq9 = phq9Match ? { value: parseInt(phq9Match[1]), max: parseInt(phq9Match[2]) } : null;
    const gad7Match = diagnosisText.match(/GAD[-\s]?7[:\s]+(\d+)\s*\/\s*(\d+)/i);
    const gad7 = gad7Match ? { value: parseInt(gad7Match[1]), max: parseInt(gad7Match[2]) } : null;
    return { phq9, gad7 };
  };

  const getSymptomScoreColor = (percentage) => {
    if (percentage <= 20) return '#898989';
    if (percentage <= 40) return '#7a7a7a';
    if (percentage <= 60) return '#a7a7a7';
    return '#777777';
  };

  const getPHQ9Interpretation = (value) => {
    if (value <= 4) return 'Minimal depression';
    if (value <= 9) return 'Mild depression';
    if (value <= 14) return 'Moderate depression';
    if (value <= 19) return 'Moderately severe depression';
    return 'Severe depression';
  };

  const getGAD7Interpretation = (value) => {
    if (value <= 4) return 'Minimal anxiety';
    if (value <= 9) return 'Mild anxiety';
    if (value <= 14) return 'Moderate anxiety';
    return 'Severe anxiety';
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Psychiatric Evaluation</Text>

        {validRecords.map((record, idx) => {
          const scores = extractScoresFromDiagnosis(record.diagnosis);
          const hasScores = scores.phq9 || scores.gad7;

          return (
          <View key={idx}>
            {idx > 0 && <View style={styles.divider} />}

            {/* Score Overview - At the TOP */}
            {hasScores && (
              <View style={styles.scoreSection} wrap={false}>
                <Text style={styles.scoreSectionTitle}>Score Overview</Text>

                {scores.phq9 && (() => {
                  const percentage = (scores.phq9.value / scores.phq9.max) * 100;
                  const color = getSymptomScoreColor(percentage);
                  const interpretation = getPHQ9Interpretation(scores.phq9.value);
                  return (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>PHQ-9 (Depression)</Text>
                      <View style={styles.scoreBarContainer}>
                        <View style={styles.scoreBarBackground}>
                          <View style={[styles.scoreBarFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.scoreValue}>{scores.phq9.value}/{scores.phq9.max}</Text>
                      </View>
                      <Text style={[styles.scoreInterpretation, { color }]}>{interpretation}</Text>
                    </View>
                  );
                })()}

                {scores.gad7 && (() => {
                  const percentage = (scores.gad7.value / scores.gad7.max) * 100;
                  const color = getSymptomScoreColor(percentage);
                  const interpretation = getGAD7Interpretation(scores.gad7.value);
                  return (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>GAD-7 (Anxiety)</Text>
                      <View style={styles.scoreBarContainer}>
                        <View style={styles.scoreBarBackground}>
                          <View style={[styles.scoreBarFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.scoreValue}>{scores.gad7.value}/{scores.gad7.max}</Text>
                      </View>
                      <Text style={[styles.scoreInterpretation, { color }]}>{interpretation}</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Section 1: Evaluation Details */}
            {(record.date || record.psychiatrist) && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Evaluation Details</Text>
                  {record.date && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                </View>

                {record.psychiatrist && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Psychiatrist</Text>
                    <Text style={styles.fieldValue}>{record.psychiatrist}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Section 2: Presenting Problem */}
            {record.chiefComplaint && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Chief Complaint</Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldValue}>{record.chiefComplaint}</Text>
                  </View>
                </View>
              </View>
            )}

            {record.historyOfPresentIllness && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>History of Present Illness</Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldValue}>{record.historyOfPresentIllness}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Section 3: Psychiatric History */}
            {record.psychiatricHistory && typeof record.psychiatricHistory === 'object' && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Psychiatric History</Text>
                  {record.psychiatricHistory.previousDiagnoses && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Previous Diagnoses</Text>
                      <Text style={styles.fieldValue}>
                        {Array.isArray(record.psychiatricHistory.previousDiagnoses)
                          ? record.psychiatricHistory.previousDiagnoses.join(', ')
                          : record.psychiatricHistory.previousDiagnoses}
                      </Text>
                    </View>
                  )}
                </View>

                {record.psychiatricHistory.previousHospitalizations && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Previous Hospitalizations</Text>
                    <Text style={styles.fieldValue}>{record.psychiatricHistory.previousHospitalizations}</Text>
                  </View>
                )}

                {record.psychiatricHistory.previousTreatments && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Previous Treatments</Text>
                    <Text style={styles.fieldValue}>{record.psychiatricHistory.previousTreatments}</Text>
                  </View>
                )}

                {record.psychiatricHistory.familyPsychiatricHistory && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Family Psychiatric History</Text>
                    <Text style={styles.fieldValue}>{record.psychiatricHistory.familyPsychiatricHistory}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Section 4: Substance Use History */}
            {record.substanceUseHistory && typeof record.substanceUseHistory === 'object' && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Substance Use History</Text>
                  {record.substanceUseHistory.primarySubstance && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Primary Substance</Text>
                      <Text style={styles.fieldValue}>{record.substanceUseHistory.primarySubstance}</Text>
                    </View>
                  )}
                </View>

                {record.substanceUseHistory.otherSubstances && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Other Substances</Text>
                    <Text style={styles.fieldValue}>{record.substanceUseHistory.otherSubstances}</Text>
                  </View>
                )}

                {record.substanceUseHistory.substanceUseTimeline && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Timeline</Text>
                    <Text style={styles.fieldValue}>{record.substanceUseHistory.substanceUseTimeline}</Text>
                  </View>
                )}

                {record.substanceUseHistory.overdoses && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Overdoses</Text>
                    <Text style={styles.fieldValue}>{record.substanceUseHistory.overdoses}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Section 5: Mental Status Exam */}
            {record.mentalStatusExam && typeof record.mentalStatusExam === 'object' && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Mental Status Exam</Text>
                  {record.mentalStatusExam.appearance && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Appearance</Text>
                      <Text style={styles.fieldValue}>{record.mentalStatusExam.appearance}</Text>
                    </View>
                  )}
                </View>

                {record.mentalStatusExam.behavior && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Behavior</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.behavior}</Text>
                  </View>
                )}

                {record.mentalStatusExam.speech && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Speech</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.speech}</Text>
                  </View>
                )}

                {record.mentalStatusExam.mood && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Mood</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.mood}</Text>
                  </View>
                )}

                {record.mentalStatusExam.affect && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Affect</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.affect}</Text>
                  </View>
                )}

                {record.mentalStatusExam.thoughtProcess && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Thought Process</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.thoughtProcess}</Text>
                  </View>
                )}

                {record.mentalStatusExam.thoughtContent && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Thought Content</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.thoughtContent}</Text>
                  </View>
                )}

                {record.mentalStatusExam.perceptions && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Perceptions</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.perceptions}</Text>
                  </View>
                )}

                {record.mentalStatusExam.cognition && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Cognition</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.cognition}</Text>
                  </View>
                )}

                {record.mentalStatusExam.insight && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Insight</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.insight}</Text>
                  </View>
                )}

                {record.mentalStatusExam.judgment && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Judgment</Text>
                    <Text style={styles.fieldValue}>{record.mentalStatusExam.judgment}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Section 6: Risk Assessment */}
            {record.riskAssessment && typeof record.riskAssessment === 'object' && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Risk Assessment</Text>
                  {record.riskAssessment.suicideRisk && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Suicide Risk</Text>
                      <Text style={styles.fieldValue}>{record.riskAssessment.suicideRisk}</Text>
                    </View>
                  )}
                </View>

                {record.riskAssessment.homicideRisk && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Homicide Risk</Text>
                    <Text style={styles.fieldValue}>{record.riskAssessment.homicideRisk}</Text>
                  </View>
                )}

                {record.riskAssessment.protectiveFactors && Array.isArray(record.riskAssessment.protectiveFactors) && record.riskAssessment.protectiveFactors.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Protective Factors</Text>
                    {record.riskAssessment.protectiveFactors.map((factor, factorIdx) => (
                      <Text key={factorIdx} style={styles.arrayItem}>{factorIdx + 1}. {factor}</Text>
                    ))}
                  </View>
                )}

                {record.riskAssessment.riskFactors && Array.isArray(record.riskAssessment.riskFactors) && record.riskAssessment.riskFactors.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Risk Factors</Text>
                    {record.riskAssessment.riskFactors.map((factor, factorIdx) => (
                      <Text key={factorIdx} style={styles.arrayItem}>{factorIdx + 1}. {factor}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Section 7: Diagnosis */}
            {record.diagnosis && Array.isArray(record.diagnosis) && record.diagnosis.length > 0 && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Diagnosis</Text>
                  {record.diagnosis.map((dx, dxIdx) => (
                    <Text key={dxIdx} style={styles.arrayItem}>{dxIdx + 1}. {dx}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Section 8: Treatment Plan */}
            {record.treatmentPlan && typeof record.treatmentPlan === 'object' && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment Plan</Text>
                  {record.treatmentPlan.pharmacotherapy && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Pharmacotherapy</Text>
                      <Text style={styles.fieldValue}>{record.treatmentPlan.pharmacotherapy}</Text>
                    </View>
                  )}
                </View>

                {record.treatmentPlan.psychotherapy && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Psychotherapy</Text>
                    <Text style={styles.fieldValue}>{record.treatmentPlan.psychotherapy}</Text>
                  </View>
                )}

                {record.treatmentPlan.substanceTreatment && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Substance Treatment</Text>
                    <Text style={styles.fieldValue}>{record.treatmentPlan.substanceTreatment}</Text>
                  </View>
                )}

                {record.treatmentPlan.safetyPlanning && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Safety Planning</Text>
                    <Text style={styles.fieldValue}>{record.treatmentPlan.safetyPlanning}</Text>
                  </View>
                )}

                {record.treatmentPlan.followUp && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Follow Up</Text>
                    <Text style={styles.fieldValue}>{record.treatmentPlan.followUp}</Text>
                  </View>
                )}

                {record.treatmentPlan.monitoring && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Monitoring</Text>
                    <Text style={styles.fieldValue}>{record.treatmentPlan.monitoring}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Section 9: Medications */}
            {record.medications && Array.isArray(record.medications) && record.medications.length > 0 && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Medications</Text>
                  {record.medications.map((med, medIdx) => (
                    <Text key={medIdx} style={styles.arrayItem}>{medIdx + 1}. {med}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PsychiatricEvaluationPDFTemplate;
