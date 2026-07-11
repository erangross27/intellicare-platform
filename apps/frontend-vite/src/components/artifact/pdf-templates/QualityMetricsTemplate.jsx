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
    borderBottom: '2px solid #7a7a7a',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '6px 12px',
    borderRadius: 10,
    marginLeft: 4,
  },
  badgeCompliant: {
    backgroundColor: '#ebebeb',
    color: '#808080',
    border: '2px solid #808080',
  },
  badgePartial: {
    backgroundColor: '#f1f1f1',
    color: '#a7a7a7',
    border: '2px solid #a7a7a7',
  },
  badgeNonCompliant: {
    backgroundColor: '#eaeaea',
    color: '#777777',
    border: '2px solid #777777',
  },
  scoreBox: {
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderLeft: '4px solid #7a7a7a',
  },
  scoreText: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
  },
  scoreBold: {
    fontWeight: 'bold',
    color: '#7a7a7a',
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    lineHeight: 1.5,
    marginBottom: 6,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 6,
    marginLeft: 12,
    lineHeight: 1.4,
  },
  gapCard: {
    backgroundColor: '#eaeaea',
    borderLeft: '4px solid #777777',
    padding: 10,
    marginBottom: 10,
  },
  gapTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#777777',
    marginBottom: 6,
  },
  predictionCard: {
    backgroundColor: '#f1f1f1',
    borderLeft: '4px solid #a7a7a7',
    padding: 10,
    marginBottom: 10,
  },
  predictionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a7a7a7',
    marginBottom: 6,
  },
  overallScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7a7a7a',
    marginBottom: 16,
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
});

const QualityMetricsTemplate = ({ document }) => {
  const doc = document;
  const compliance = doc.guidelineCompliance || [];
  const careGaps = doc.careGaps || [];
  const outcomes = doc.outcomesPrediction || [];

  const getComplianceStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'compliant':
        return styles.badgeCompliant;
      case 'partial':
        return styles.badgePartial;
      case 'non-compliant':
        return styles.badgeNonCompliant;
      default:
        return styles.badgePartial;
    }
  };

  return (
    <View>
      {/* Overall Quality Score */}
      {doc.overallScore && (
        <Text style={styles.overallScore}>
          📊 Overall Quality Score: {doc.overallScore}/100
        </Text>
      )}

      {/* Guideline Compliance */}
      {compliance.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✓ Guideline Compliance</Text>
          {compliance.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>{item.guideline}</Text>
                {item.status && (
                  <Text style={[styles.badge, getComplianceStyle(item.status)]}>
                    {item.status}
                  </Text>
                )}
              </View>

              {item.score !== undefined && (
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreText}>
                    <Text style={styles.scoreBold}>Score: </Text>
                    {item.score}/100
                  </Text>
                </View>
              )}

              {item.details && (
                <Text style={styles.text}>{item.details}</Text>
              )}

              {item.recommendations && item.recommendations.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.textBold, { fontSize: 9, marginBottom: 4 }]}>
                    Recommendations:
                  </Text>
                  {item.recommendations.map((rec, recIdx) => (
                    <Text key={recIdx} style={styles.listItem}>• {rec}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Care Gaps */}
      {careGaps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Care Gaps Identified</Text>
          {careGaps.map((gap, index) => (
            <View key={index} style={styles.gapCard}>
              <Text style={styles.gapTitle}>{gap.category}</Text>

              {gap.issue && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Issue: </Text>
                  {gap.issue}
                </Text>
              )}

              {gap.impact && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Impact: </Text>
                  {gap.impact}
                </Text>
              )}

              {gap.recommendedAction && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Action: </Text>
                  {gap.recommendedAction}
                </Text>
              )}

              {gap.priority && (
                <Text style={[styles.text, { fontSize: 9, color: '#6b7280' }]}>
                  <Text style={styles.textBold}>Priority: </Text>
                  {gap.priority}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Outcomes Prediction */}
      {outcomes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔮 Outcomes Prediction</Text>
          {outcomes.map((outcome, index) => (
            <View key={index} style={styles.predictionCard}>
              <Text style={styles.predictionTitle}>{outcome.metric}</Text>

              {outcome.prediction && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Prediction: </Text>
                  {outcome.prediction}
                </Text>
              )}

              {outcome.confidence && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Confidence: </Text>
                  {outcome.confidence}%
                </Text>
              )}

              {outcome.timeframe && (
                <Text style={styles.text}>
                  <Text style={styles.textBold}>Timeframe: </Text>
                  {outcome.timeframe}
                </Text>
              )}

              {outcome.factors && outcome.factors.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.textBold, { fontSize: 9, marginBottom: 4 }]}>
                    Key Factors:
                  </Text>
                  {outcome.factors.map((factor, factorIdx) => (
                    <Text key={factorIdx} style={styles.listItem}>• {factor}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Performance Metrics */}
      {doc.performanceMetrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Performance Metrics</Text>
          <View style={styles.card}>
            {doc.performanceMetrics.readmissionRate !== undefined && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Readmission Rate: </Text>
                {doc.performanceMetrics.readmissionRate}%
              </Text>
            )}

            {doc.performanceMetrics.patientSatisfaction !== undefined && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Patient Satisfaction: </Text>
                {doc.performanceMetrics.patientSatisfaction}/5
              </Text>
            )}

            {doc.performanceMetrics.treatmentAdherence !== undefined && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Treatment Adherence: </Text>
                {doc.performanceMetrics.treatmentAdherence}%
              </Text>
            )}

            {doc.performanceMetrics.outcomeSuccess !== undefined && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Outcome Success Rate: </Text>
                {doc.performanceMetrics.outcomeSuccess}%
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default QualityMetricsTemplate;
