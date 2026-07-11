import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2px solid #a0a0a0',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardWithBorder: {
    borderLeft: '4px solid #a0a0a0',
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  assessmentItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #e5e7eb',
  },
  domainTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a0a0a0',
    marginBottom: 6,
  },
  scoreText: {
    fontSize: 10,
    color: '#757575',
    marginBottom: 4,
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
});

const GeriatricAssessmentsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Functional Status */}
      {doc.functionalStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Functional Status</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {typeof doc.functionalStatus === 'object' ? (
              <>
                {doc.functionalStatus.adl && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Activities of Daily Living (ADL)</Text>
                    <Text style={styles.text}>{doc.functionalStatus.adl}</Text>
                  </View>
                )}
                {doc.functionalStatus.iadl && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Instrumental ADL (IADL)</Text>
                    <Text style={styles.text}>{doc.functionalStatus.iadl}</Text>
                  </View>
                )}
                {doc.functionalStatus.mobility && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Mobility</Text>
                    <Text style={styles.text}>{doc.functionalStatus.mobility}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.text}>{doc.functionalStatus}</Text>
            )}
          </View>
        </View>
      )}

      {/* Cognitive Assessment */}
      {doc.cognitiveAssessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Cognitive Assessment</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {typeof doc.cognitiveAssessment === 'object' ? (
              <>
                {doc.cognitiveAssessment.mmse && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>MMSE Score</Text>
                    <Text style={styles.scoreText}>{doc.cognitiveAssessment.mmse}</Text>
                  </View>
                )}
                {doc.cognitiveAssessment.moca && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>MoCA Score</Text>
                    <Text style={styles.scoreText}>{doc.cognitiveAssessment.moca}</Text>
                  </View>
                )}
                {doc.cognitiveAssessment.interpretation && (
                  <View>
                    <Text style={styles.domainTitle}>Interpretation</Text>
                    <Text style={styles.text}>{doc.cognitiveAssessment.interpretation}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.text}>{doc.cognitiveAssessment}</Text>
            )}
          </View>
        </View>
      )}

      {/* Nutritional Assessment */}
      {doc.nutritionalAssessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍽️ Nutritional Assessment</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {typeof doc.nutritionalAssessment === 'object' ? (
              <>
                {doc.nutritionalAssessment.mna && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>MNA Score</Text>
                    <Text style={styles.scoreText}>{doc.nutritionalAssessment.mna}</Text>
                  </View>
                )}
                {doc.nutritionalAssessment.bmi && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>BMI</Text>
                    <Text style={styles.scoreText}>{doc.nutritionalAssessment.bmi}</Text>
                  </View>
                )}
                {doc.nutritionalAssessment.albumin && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Albumin</Text>
                    <Text style={styles.scoreText}>{doc.nutritionalAssessment.albumin}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.text}>{doc.nutritionalAssessment}</Text>
            )}
          </View>
        </View>
      )}

      {/* Falls Risk */}
      {doc.fallsRisk && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Falls Risk Assessment</Text>
          <View style={[styles.card, { borderLeft: '4px solid #a7a7a7' }]}>
            <Text style={styles.text}>{doc.fallsRisk}</Text>
          </View>
        </View>
      )}

      {/* Frailty Assessment */}
      {doc.frailtyAssessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🩺 Frailty Assessment</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.frailtyAssessment}</Text>
          </View>
        </View>
      )}

      {/* Polypharmacy Review */}
      {doc.polypharmacy && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Polypharmacy Review</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            {typeof doc.polypharmacy === 'object' ? (
              <>
                {doc.polypharmacy.medicationCount && (
                  <Text style={styles.text}>
                    <Text style={styles.textBold}>Medication Count: </Text>
                    {doc.polypharmacy.medicationCount}
                  </Text>
                )}
                {doc.polypharmacy.concerns && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.textBold}>Concerns:</Text>
                    <Text style={styles.text}>{doc.polypharmacy.concerns}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.text}>{doc.polypharmacy}</Text>
            )}
          </View>
        </View>
      )}

      {/* Social Support */}
      {doc.socialSupport && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Social Support</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.socialSupport}</Text>
          </View>
        </View>
      )}

      {/* Recommendations */}
      {doc.recommendations && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Recommendations</Text>
          <View style={[styles.card, { borderLeft: '4px solid #6f6f6f' }]}>
            {Array.isArray(doc.recommendations) ? (
              doc.recommendations.map((rec, idx) => (
                <Text key={idx} style={styles.listItem}>
                  • {rec}
                </Text>
              ))
            ) : (
              <Text style={styles.text}>{doc.recommendations}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default GeriatricAssessmentsTemplate;
