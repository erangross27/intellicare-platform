import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'left',
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
    textAlign: 'left',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
  indent2: {
    marginLeft: 24,
  },
});

const MedicationsOptimizationsTemplate = ({ document }) => {
  const doc = document;
  const costAnalysis = doc.costAnalysis || [];
  const adherenceRisk = doc.adherenceRisk;

  return (
    <View>
      {costAnalysis.map((analysis, index) => (
        <View key={index} wrap={false} style={{ marginBottom: 16 }}>
          {/* Current Medication */}
          <Text style={styles.medicationName}>{analysis.medication}</Text>

          <Text style={[styles.line, { marginTop: 4 }]}>
            <Text style={styles.textBold}>Current Cost: </Text>
            {analysis.estimatedCost}
          </Text>

          {analysis.insuranceCoverage && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Insurance: </Text>
              {analysis.insuranceCoverage}
            </Text>
          )}

          {analysis.conditionsTreated && analysis.conditionsTreated.length > 0 && (
            <>
              <Text style={[styles.line, { marginTop: 4 }]}>
                <Text style={styles.textBold}>Conditions Treated:</Text>
              </Text>
              {analysis.conditionsTreated.map((condition, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {condition}
                </Text>
              ))}
            </>
          )}

          {/* Alternative Medications */}
          {analysis.alternatives && analysis.alternatives.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Alternative Options</Text>
              {analysis.alternatives.map((alt, altIdx) => (
                <View key={altIdx} style={{ marginBottom: 10 }}>
                  <Text style={[styles.line, { fontWeight: 'bold', marginTop: 4 }]}>
                    {alt.name}
                  </Text>

                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Cost: </Text>
                    {alt.cost}
                  </Text>

                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Efficacy: </Text>
                    {alt.efficacyComparison}
                  </Text>

                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Safety: </Text>
                    {alt.safetyCheck}
                  </Text>

                  {alt.clinicalBenefitScore && alt.clinicalBenefitScore.score && (
                    <Text style={[styles.line, styles.indent]}>
                      <Text style={styles.textBold}>Clinical Benefit Score: </Text>
                      {alt.clinicalBenefitScore.score}/10
                    </Text>
                  )}

                  {alt.clinicalBenefitScore && alt.clinicalBenefitScore.rationale && (
                    <>
                      <Text style={[styles.line, styles.indent, { marginTop: 4 }]}>
                        <Text style={styles.textBold}>Rationale:</Text>
                      </Text>
                      <Text style={[styles.line, styles.indent2]}>
                        {alt.clinicalBenefitScore.rationale}
                      </Text>
                    </>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      ))}

      {/* Adherence Risk Assessment */}
      {adherenceRisk && (
        <View wrap={false} style={{ marginTop: 16 }}>
          <Text style={styles.medicationName}>Adherence Risk Assessment</Text>

          <Text style={[styles.line, { marginTop: 4 }]}>
            <Text style={styles.textBold}>Risk Level: </Text>
            {adherenceRisk.riskLevel}
          </Text>

          {adherenceRisk.riskFactors && adherenceRisk.riskFactors.length > 0 && (
            <>
              <Text style={[styles.line, { marginTop: 4 }]}>
                <Text style={styles.textBold}>Risk Factors:</Text>
              </Text>
              {adherenceRisk.riskFactors.map((factor, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {factor}
                </Text>
              ))}
            </>
          )}

          {adherenceRisk.mitigationStrategies && adherenceRisk.mitigationStrategies.length > 0 && (
            <>
              <Text style={[styles.line, { marginTop: 4 }]}>
                <Text style={styles.textBold}>Mitigation Strategies:</Text>
              </Text>
              {adherenceRisk.mitigationStrategies.map((strategy, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {strategy}
                </Text>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default MedicationsOptimizationsTemplate;
