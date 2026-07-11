import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'left',
  },
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
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
  doubleIndent: {
    marginLeft: 24,
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
    lineHeight: 1.5,
    marginLeft: 12,
  },
  separator: {
    marginVertical: 12,
    borderBottom: '1px solid #000000',
  },
});

const MedicationOptimizationTemplate = ({ document }) => {
  const doc = document;
  const costAnalysis = doc.costAnalysis || [];

  const formatDate = (dateString) => {
    if (!dateString) return null;
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
    <View>
      {/* Document Date */}
      {doc.date && (
        <Text style={[styles.line, { marginBottom: 16 }]}>
          <Text style={styles.textBold}>Analysis Date: </Text>
          {formatDate(doc.date)}
        </Text>
      )}

      {/* Cost Analysis for Each Medication */}
      {costAnalysis.map((analysis, index) => (
        <View key={index} wrap={false}>
          <Text style={styles.medicationName}>{analysis.medication}</Text>

          {/* Estimated Cost */}
          {analysis.estimatedCost && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Estimated Cost: </Text>
              {analysis.estimatedCost}
            </Text>
          )}

          {/* Insurance Coverage */}
          {analysis.insuranceCoverage && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Insurance Coverage: </Text>
              {analysis.insuranceCoverage}
            </Text>
          )}

          {/* Value Assessment */}
          {analysis.valueAssessment && (
            <>
              <Text style={[styles.line, { marginTop: 8 }]}>
                <Text style={styles.textBold}>Value Assessment:</Text>
              </Text>
              <Text style={[styles.line, styles.indent]}>
                {analysis.valueAssessment}
              </Text>
            </>
          )}

          {/* Alternatives */}
          {analysis.alternatives && analysis.alternatives.length > 0 && (
            <>
              <Text style={[styles.line, { marginTop: 8 }]}>
                <Text style={styles.textBold}>Alternative Options:</Text>
              </Text>
              {analysis.alternatives.map((alt, altIdx) => (
                <View key={altIdx} style={{ marginBottom: 8 }}>
                  <Text style={styles.indent}>
                    <Text style={styles.textBold}>{altIdx + 1}. {alt.name}</Text>
                    {alt.cost && <Text> - {alt.cost}</Text>}
                  </Text>

                  {alt.efficacyComparison && (
                    <Text style={[styles.line, styles.doubleIndent]}>
                      Efficacy: {alt.efficacyComparison}
                    </Text>
                  )}

                  {alt.safetyCheck && (
                    <Text style={[styles.line, styles.doubleIndent]}>
                      Safety: {alt.safetyCheck}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {index < costAnalysis.length - 1 && <View style={styles.separator} />}
        </View>
      ))}

      {/* Overall Adherence Risks */}
      {doc.adherenceRisk && doc.adherenceRisk.riskFactors && doc.adherenceRisk.riskFactors.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Overall Adherence Risks</Text>

          {doc.adherenceRisk.riskLevel && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Risk Level: </Text>
              {doc.adherenceRisk.riskLevel}
            </Text>
          )}

          <Text style={[styles.line, { marginTop: 8 }]}>
            <Text style={styles.textBold}>Risk Factors:</Text>
          </Text>
          {doc.adherenceRisk.riskFactors.map((factor, idx) => (
            <Text key={idx} style={styles.listItem}>
              {idx + 1}. {factor}
            </Text>
          ))}
        </View>
      )}

      {/* Mitigation Strategies */}
      {doc.adherenceRisk && doc.adherenceRisk.mitigationStrategies && doc.adherenceRisk.mitigationStrategies.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Mitigation Strategies</Text>
          {doc.adherenceRisk.mitigationStrategies.map((strategy, idx) => (
            <Text key={idx} style={styles.listItem}>
              {idx + 1}. {strategy}
            </Text>
          ))}
        </View>
      )}

      {/* Simplification Opportunities */}
      {doc.simplificationOpportunities && doc.simplificationOpportunities.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Simplification Opportunities</Text>
          {doc.simplificationOpportunities.map((opp, idx) => (
            <View key={idx} style={{ marginBottom: 12 }}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Opportunity {idx + 1}:</Text>
              </Text>

              {opp.current && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Current: </Text>
                  {opp.current}
                </Text>
              )}

              {opp.proposed && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Proposed: </Text>
                  {opp.proposed}
                </Text>
              )}

              {opp.benefit && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Benefit: </Text>
                  {opp.benefit}
                </Text>
              )}

              {opp.considerations && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Considerations: </Text>
                  {opp.considerations}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default MedicationOptimizationTemplate;
