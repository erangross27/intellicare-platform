import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #000000',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #cccccc',
    padding: 10,
    marginBottom: 10,
  },
  finding: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  text: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  medications: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 12,
  },
});

const ClinicalDecisionSupportTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Red Flags */}
      {doc.redFlags && doc.redFlags.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Critical Red Flags</Text>
          {doc.redFlags.map((flag, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.finding}>{flag.finding}</Text>
              <Text style={styles.text}>{flag.action}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Drug Interactions */}
      {doc.drugInteractions && doc.drugInteractions.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Drug Interactions</Text>
          {doc.drugInteractions.map((interaction, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.medications}>
                {Array.isArray(interaction.medications)
                  ? interaction.medications.join(' + ')
                  : interaction.medications} ({interaction.severity})
              </Text>
              <Text style={styles.text}>{interaction.clinicalEffect}</Text>
              <Text style={styles.text}>
                <Text style={styles.textBold}>Recommendation: </Text>
                {interaction.recommendation}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Contraindications */}
      {doc.contraindications && doc.contraindications.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Contraindications</Text>
          {doc.contraindications.map((contra, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.finding}>{contra.medication}</Text>
              <Text style={styles.text}>{contra.condition} ({contra.severity})</Text>
              {contra.alternative && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Alternative: </Text>
                  {contra.alternative}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Risk Assessment */}
      {doc.riskAssessment && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>
          <View style={styles.card}>
            <Text style={styles.text}>
              <Text style={styles.textBold}>Overall Risk: </Text>
              {doc.riskAssessment.overallRisk}
            </Text>

            {doc.riskAssessment.riskFactors && doc.riskAssessment.riskFactors.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.textBold, { marginBottom: 4 }]}>Risk Factors:</Text>
                {doc.riskAssessment.riskFactors.map((factor, index) => (
                  <View key={index} style={{ marginBottom: 4 }}>
                    <Text style={styles.text}>
                      • {factor.factor} ({factor.severity})
                    </Text>
                    {factor.evidence && (
                      <Text style={[styles.text, { marginLeft: 12, fontSize: 9 }]}>
                        {factor.evidence}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {doc.riskAssessment.mitigatingFactors && doc.riskAssessment.mitigatingFactors.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.textBold, { marginBottom: 4 }]}>Mitigating Factors:</Text>
                {doc.riskAssessment.mitigatingFactors.map((factor, index) => (
                  <Text key={index} style={styles.listItem}>• {factor}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default ClinicalDecisionSupportTemplate;
