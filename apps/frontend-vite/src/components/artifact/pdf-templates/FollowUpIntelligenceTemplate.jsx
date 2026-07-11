import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  sectionTitle: {
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
  indent2: {
    marginLeft: 24,
  },
});

const FollowUpIntelligenceTemplate = ({ document }) => {
  const doc = document;
  const deadlines = doc.deadlines || [];
  const prioritization = doc.prioritization || [];
  const coordinationNeeds = doc.coordinationNeeds || [];
  const overallTreatmentGoals = doc.overallTreatmentGoals;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View>
      {/* Upcoming Deadlines */}
      {deadlines.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          {deadlines.map((deadline, index) => (
            <View key={index} wrap={false}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>{deadline.item}</Text>
                {deadline.criticality && ` (${deadline.criticality})`}
                {deadline.autoSchedule && ' - Auto-Schedule'}
              </Text>
              <Text style={[styles.line, styles.indent]}>
                <Text style={styles.textBold}>Due: </Text>
                {formatDate(deadline.dueDate)}
              </Text>
              {deadline.consequences && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Consequences: </Text>
                  {deadline.consequences}
                </Text>
              )}
              {deadline.successMetrics && (
                <>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Success Metrics:</Text>
                  </Text>
                  <Text style={[styles.line, styles.indent2]}>
                    <Text style={styles.textBold}>Primary Metric: </Text>
                    {deadline.successMetrics.primaryMetric}
                  </Text>
                  {deadline.successMetrics.baselineValue && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Baseline: </Text>
                      {deadline.successMetrics.baselineValue}
                    </Text>
                  )}
                  {deadline.successMetrics.targetValue && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Target: </Text>
                      {deadline.successMetrics.targetValue}
                    </Text>
                  )}
                  {deadline.successMetrics.outcomeAssessment && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Assessment: </Text>
                      {deadline.successMetrics.outcomeAssessment}
                    </Text>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Task Prioritization */}
      {prioritization.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Task Prioritization</Text>
          {prioritization.map((task, index) => (
            <View key={index} wrap={false}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Priority {task.priority}: {task.task}</Text>
              </Text>
              <Text style={[styles.line, styles.indent]}>
                <Text style={styles.textBold}>Urgency: </Text>
                {task.urgency}
              </Text>
              <Text style={[styles.line, styles.indent]}>
                <Text style={styles.textBold}>Importance: </Text>
                {task.importance}
              </Text>
              {task.dependencies && task.dependencies.length > 0 && (
                <>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Dependencies:</Text>
                  </Text>
                  {task.dependencies.map((dep, depIdx) => (
                    <Text key={depIdx} style={[styles.line, styles.indent2]}>• {dep}</Text>
                  ))}
                </>
              )}
              {task.successMetrics && (
                <>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Success Metrics:</Text>
                  </Text>
                  {task.successMetrics.expectedOutcome && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Expected Outcome: </Text>
                      {task.successMetrics.expectedOutcome}
                    </Text>
                  )}
                  {task.successMetrics.completionCriteria && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Completion Criteria: </Text>
                      {task.successMetrics.completionCriteria}
                    </Text>
                  )}
                  {task.successMetrics.measurableIndicator && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Measurable Indicator: </Text>
                      {task.successMetrics.measurableIndicator}
                    </Text>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Coordination Needs */}
      {coordinationNeeds.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Coordination Needs</Text>
          {coordinationNeeds.map((coord, index) => (
            <View key={index} wrap={false}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>{coord.specialist}</Text>
                {coord.urgency && ` (${coord.urgency})`}
              </Text>
              {coord.reason && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Reason: </Text>
                  {coord.reason}
                </Text>
              )}
              {coord.informationNeeded && coord.informationNeeded.length > 0 && (
                <>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Information Needed:</Text>
                  </Text>
                  {coord.informationNeeded.map((info, infoIdx) => (
                    <Text key={infoIdx} style={[styles.line, styles.indent2]}>• {info}</Text>
                  ))}
                </>
              )}
              {coord.expectedOutcome && (
                <Text style={[styles.line, styles.indent]}>
                  <Text style={styles.textBold}>Expected Outcome: </Text>
                  {coord.expectedOutcome}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Overall Treatment Goals */}
      {overallTreatmentGoals && (
        <View>
          <Text style={styles.sectionTitle}>Overall Treatment Goals</Text>
          {overallTreatmentGoals.primaryGoal && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Primary Goal: </Text>
              {overallTreatmentGoals.primaryGoal}
            </Text>
          )}
          {overallTreatmentGoals.quantitativeTargets && overallTreatmentGoals.quantitativeTargets.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Quantitative Targets:</Text>
              </Text>
              {overallTreatmentGoals.quantitativeTargets.map((target, index) => (
                <View key={index} wrap={false}>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>{target.parameter}</Text>
                  </Text>
                  {target.currentValue && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Current: </Text>
                      {target.currentValue}
                    </Text>
                  )}
                  {target.targetValue && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Target: </Text>
                      {target.targetValue}
                    </Text>
                  )}
                  {target.timeframe && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Timeframe: </Text>
                      {target.timeframe}
                    </Text>
                  )}
                  {target.assessmentMethod && (
                    <Text style={[styles.line, styles.indent2]}>
                      <Text style={styles.textBold}>Assessment: </Text>
                      {target.assessmentMethod}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}
          {overallTreatmentGoals.adaptationCriteria && overallTreatmentGoals.adaptationCriteria.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Adaptation Criteria:</Text>
              </Text>
              {overallTreatmentGoals.adaptationCriteria.map((criteria, index) => (
                <View key={index} wrap={false}>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Trigger: </Text>
                    {criteria.trigger}
                  </Text>
                  <Text style={[styles.line, styles.indent]}>
                    <Text style={styles.textBold}>Response: </Text>
                    {criteria.response}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default FollowUpIntelligenceTemplate;
