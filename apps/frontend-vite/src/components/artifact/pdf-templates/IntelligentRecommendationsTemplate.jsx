import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  actionTitle: {
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

const IntelligentRecommendationsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Immediate Recommendations */}
      {doc.immediate && doc.immediate.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Immediate Actions</Text>
          {doc.immediate.map((rec, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 12 }}>
              <Text style={styles.actionTitle}>{rec.action}</Text>

              {rec.priority && (
                <Text style={[styles.line, { marginTop: 4 }]}>
                  <Text style={styles.textBold}>Priority: </Text>
                  {rec.priority}
                </Text>
              )}

              {rec.rationale && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Rationale: </Text>
                  {rec.rationale}
                </Text>
              )}

              {rec.evidence && (
                <Text style={[styles.line, { marginTop: 4 }]}>
                  <Text style={styles.textBold}>Evidence: </Text>
                  {rec.evidence}
                </Text>
              )}

              {rec.successMetrics && (
                <>
                  <Text style={[styles.line, { marginTop: 4 }]}>
                    <Text style={styles.textBold}>Success Metrics:</Text>
                  </Text>
                  {rec.successMetrics.primaryMetric && (
                    <Text style={[styles.line, styles.indent]}>
                      <Text style={styles.textBold}>Primary Metric: </Text>
                      {rec.successMetrics.primaryMetric}
                    </Text>
                  )}
                  {rec.successMetrics.assessmentMethod && (
                    <Text style={[styles.line, styles.indent]}>
                      <Text style={styles.textBold}>Assessment Method: </Text>
                      {rec.successMetrics.assessmentMethod}
                    </Text>
                  )}
                  {rec.successMetrics.targetDate && (
                    <Text style={[styles.line, styles.indent]}>
                      <Text style={styles.textBold}>Target Date: </Text>
                      {rec.successMetrics.targetDate}
                    </Text>
                  )}
                </>
              )}

              {rec.backupOptions && rec.backupOptions.length > 0 && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.textBold}>Backup Options:</Text>
                  </Text>
                  {rec.backupOptions.map((backup, idx) => (
                    <View key={idx}>
                      <Text style={[styles.line, styles.indent]}>
                        <Text style={styles.textBold}>{backup.option}</Text>
                      </Text>
                      {backup.indication && (
                        <Text style={[styles.line, styles.indent2]}>
                          <Text style={styles.textBold}>When: </Text>
                          {backup.indication}
                        </Text>
                      )}
                      {backup.mechanism && (
                        <Text style={[styles.line, styles.indent2]}>
                          <Text style={styles.textBold}>Mechanism: </Text>
                          {backup.mechanism}
                        </Text>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Short-term Recommendations */}
      {doc.shortTerm && doc.shortTerm.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Short-term Plan (2-4 weeks)</Text>
          {doc.shortTerm.map((rec, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 12 }}>
              <Text style={styles.actionTitle}>{rec.action}</Text>

              {rec.timeframe && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Timeframe: </Text>
                  {rec.timeframe}
                </Text>
              )}

              {rec.expectedOutcome && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Expected Outcome: </Text>
                  {rec.expectedOutcome}
                </Text>
              )}

              {rec.rationale && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Rationale: </Text>
                  {rec.rationale}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Long-term Recommendations */}
      {doc.longTerm && doc.longTerm.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Long-term Goals</Text>
          {doc.longTerm.map((goal, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 12 }}>
              <Text style={styles.actionTitle}>{goal.goal}</Text>

              {goal.timeline && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Timeline: </Text>
                  {goal.timeline}
                </Text>
              )}

              {goal.interventions && goal.interventions.length > 0 && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.textBold}>Interventions:</Text>
                  </Text>
                  {goal.interventions.map((intervention, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {intervention}
                    </Text>
                  ))}
                </>
              )}

              {goal.successMetrics && goal.successMetrics.length > 0 && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.textBold}>Success Metrics:</Text>
                  </Text>
                  {goal.successMetrics.map((metric, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {metric}
                    </Text>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Preventive Recommendations */}
      {doc.preventive && doc.preventive.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Preventive Care</Text>
          {doc.preventive.map((prev, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 12 }}>
              <Text style={styles.actionTitle}>{prev.screening}</Text>

              {prev.indication && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Indication: </Text>
                  {prev.indication}
                </Text>
              )}

              {prev.guidelines && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Guidelines: </Text>
                  {prev.guidelines}
                </Text>
              )}

              {prev.dueDate && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Due Date: </Text>
                  {prev.dueDate}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default IntelligentRecommendationsTemplate;
