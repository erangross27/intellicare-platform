import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
});

const DoctorsMedicationsRecommendationsOptimizationsTemplate = ({ document }) => {
  const doc = document;
  const costAnalysis = doc.costAnalysis || [];
  const adherenceRisk = doc.adherenceRisk;

  return (
    <View>
      {/* Cost Analysis for Each Medication */}
      {costAnalysis.map((analysis, index) => (
        <View key={index}>
          <Text style={styles.medicationName}>{analysis.medication}</Text>

          <Text style={styles.line}>
            <Text style={styles.textBold}>Cost: </Text>{analysis.estimatedCost}
          </Text>

          {analysis.costPerCondition && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Per Condition: </Text>{analysis.costPerCondition}
            </Text>
          )}

          <Text style={styles.line}>
            <Text style={styles.textBold}>Insurance: </Text>{analysis.insuranceCoverage}
          </Text>

          {/* Clinical Benefit Score */}
          {analysis.clinicalBenefitScore && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Clinical Benefit Score: </Text>
                {analysis.clinicalBenefitScore.score}/10
              </Text>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Efficacy: </Text>
                {analysis.clinicalBenefitScore.efficacy}/10
              </Text>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Safety: </Text>
                {analysis.clinicalBenefitScore.safety}/10
              </Text>
              {analysis.clinicalBenefitScore.convenience && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Convenience: </Text>
                  {analysis.clinicalBenefitScore.convenience}/10
                </Text>
              )}
              {analysis.clinicalBenefitScore.rationale && (
                <Text style={styles.line}>{analysis.clinicalBenefitScore.rationale}</Text>
              )}
            </>
          )}

          {/* Conditions Treated */}
          {analysis.conditionsTreated && analysis.conditionsTreated.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Conditions Treated:</Text>
              </Text>
              {analysis.conditionsTreated.map((condition, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>• {condition}</Text>
              ))}
            </>
          )}

          {/* Value Assessment */}
          {analysis.valueAssessment && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Value Assessment:</Text>
              </Text>
              <Text style={styles.line}>{analysis.valueAssessment}</Text>
            </>
          )}

          {/* Quality of Life */}
          {analysis.qualityOfLifeMetrics && Object.keys(analysis.qualityOfLifeMetrics).length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Quality of Life Improvements:</Text>
              </Text>
              {Object.entries(analysis.qualityOfLifeMetrics).map(([key, value], idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • <Text style={styles.textBold}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: </Text>
                  {value}
                </Text>
              ))}
            </>
          )}

          {/* Guideline Support */}
          {analysis.guidelineSupport && analysis.guidelineSupport.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Guideline Support:</Text>
              </Text>
              {analysis.guidelineSupport.map((guideline, idx) => (
                <View key={idx}>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>{guideline.guideline}</Text>
                  </Text>
                  <Text style={[styles.line, styles.indent]}>{guideline.recommendation}</Text>
                  {guideline.criteria && guideline.criteria.length > 0 && (
                    <>
                      <Text style={[styles.line, styles.indent]}>
                        <Text style={styles.textBold}>Criteria Met:</Text>
                      </Text>
                      {guideline.criteria.map((criterion, cIdx) => (
                        <Text key={cIdx} style={[styles.line, { marginLeft: 24 }]}>• {criterion}</Text>
                      ))}
                    </>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Alternative Medications */}
          {analysis.alternatives && analysis.alternatives.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Alternative Medications:</Text>
              </Text>
              {analysis.alternatives.map((alt, idx) => (
                <View key={idx}>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>
                      {alt.name} - {alt.cost}
                      {alt.clinicalBenefitScore && ` (Score: ${alt.clinicalBenefitScore.score}/10)`}
                    </Text>
                  </Text>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Efficacy: </Text>
                    {alt.efficacyComparison}
                  </Text>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Safety: </Text>
                    {alt.safetyCheck}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      ))}

      {/* Adherence Risk Assessment */}
      {adherenceRisk && (
        <View>
          <Text style={styles.medicationName}>Adherence Risk Assessment</Text>

          <Text style={styles.line}>
            <Text style={styles.textBold}>Risk Level: </Text>{adherenceRisk.riskLevel}
          </Text>

          {adherenceRisk.riskFactors && adherenceRisk.riskFactors.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Risk Factors:</Text>
              </Text>
              {adherenceRisk.riskFactors.map((factor, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>• {factor}</Text>
              ))}
            </>
          )}

          {adherenceRisk.mitigationStrategies && adherenceRisk.mitigationStrategies.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Mitigation Strategies:</Text>
              </Text>
              {adherenceRisk.mitigationStrategies.map((strategy, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>• {strategy}</Text>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default DoctorsMedicationsRecommendationsOptimizationsTemplate;
