import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * IntelligentRecommendationsPDFTemplate - Simple line-by-line PDF template
 *
 * CRITICAL: NO flexDirection:'row', NO complex layouts - just line-by-line text
 * Pattern: Simple Courier 11pt, tight spacing, line-by-line format
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  line: {
    fontSize: 11,
    marginBottom: 2,
    lineHeight: 1.4
  },
  emptyLine: {
    fontSize: 11,
    marginBottom: 6
  }
});

const IntelligentRecommendationsPDFTemplate = ({ documents, patientName }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Document>
      {documents.map((record, docIndex) => {
        // Unwrap the intelligent_recommendations array if wrapped
        const data = record?.intelligent_recommendations?.[0] || record;

        return (
          <Page key={docIndex} size="A4" style={styles.page} wrap>

            {/* Immediate Actions Section - HIGHEST PRIORITY */}
            {data.immediate?.length > 0 && (
              <View>
                <Text style={styles.line}>IMMEDIATE ACTIONS ({data.immediate.length})</Text>
                <Text style={styles.line}>{'='.repeat(60)}</Text>
                <Text style={styles.emptyLine}> </Text>
                {data.immediate.map((action, idx) => (
                  <View key={idx}>
                    <Text style={styles.line}>{idx + 1}. {action.action || `Action ${idx + 1}`}</Text>
                    {action.priority && (
                      <Text style={styles.line}>   Priority: {action.priority}</Text>
                    )}
                    {action.rationale && (
                      <Text style={styles.line}>   Rationale: {action.rationale}</Text>
                    )}
                    {action.evidence && (
                      <Text style={styles.line}>   Evidence: {action.evidence}</Text>
                    )}
                    {action.successMetrics?.primaryMetric && (
                      <Text style={styles.line}>   Success Metric: {action.successMetrics.primaryMetric}</Text>
                    )}
                    {action.backupOptions?.length > 0 && (
                      <View>
                        <Text style={styles.line}>   Backup Options:</Text>
                        {action.backupOptions.map((backup, bIdx) => (
                          <View key={bIdx}>
                            <Text style={styles.line}>     • {backup.option}</Text>
                            {backup.indication && (
                              <Text style={styles.line}>       {backup.indication}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                ))}
                <Text style={styles.emptyLine}> </Text>
              </View>
            )}

            {/* Short-Term Recommendations Section */}
            {data.shortTerm?.length > 0 && (
              <View>
                <Text style={styles.line}>SHORT-TERM RECOMMENDATIONS ({data.shortTerm.length})</Text>
                <Text style={styles.line}>{'='.repeat(60)}</Text>
                <Text style={styles.line}>(1-4 weeks)</Text>
                <Text style={styles.emptyLine}> </Text>
                {data.shortTerm.map((item, idx) => (
                  <View key={idx}>
                    <Text style={styles.line}>{idx + 1}. {item.action || `Recommendation ${idx + 1}`}</Text>
                    {item.timeframe && (
                      <Text style={styles.line}>   Timeframe: {item.timeframe}</Text>
                    )}
                    {item.rationale && (
                      <Text style={styles.line}>   Rationale: {item.rationale}</Text>
                    )}
                    {item.expectedOutcome && (
                      <Text style={styles.line}>   Expected Outcome: {item.expectedOutcome}</Text>
                    )}
                    {item.successMetrics?.metrics?.length > 0 && (
                      <View>
                        <Text style={styles.line}>   Success Metrics:</Text>
                        {item.successMetrics.metrics.map((metric, mIdx) => (
                          <Text key={mIdx} style={styles.line}>     • {metric}</Text>
                        ))}
                      </View>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                ))}
                <Text style={styles.emptyLine}> </Text>
              </View>
            )}

            {/* Long-Term Goals Section */}
            {data.longTerm?.length > 0 && (
              <View>
                <Text style={styles.line}>LONG-TERM GOALS ({data.longTerm.length})</Text>
                <Text style={styles.line}>{'='.repeat(60)}</Text>
                <Text style={styles.line}>(&gt;1 month)</Text>
                <Text style={styles.emptyLine}> </Text>
                {data.longTerm.map((goal, idx) => (
                  <View key={idx}>
                    <Text style={styles.line}>{idx + 1}. {goal.goal || `Goal ${idx + 1}`}</Text>
                    {goal.timeline && (
                      <Text style={styles.line}>   Timeline: {goal.timeline}</Text>
                    )}
                    {goal.interventions?.length > 0 && (
                      <View>
                        <Text style={styles.line}>   Interventions:</Text>
                        {goal.interventions.map((intervention, iIdx) => (
                          <Text key={iIdx} style={styles.line}>     • {intervention}</Text>
                        ))}
                      </View>
                    )}
                    {goal.successMetrics?.length > 0 && (
                      <View>
                        <Text style={styles.line}>   Success Metrics:</Text>
                        {goal.successMetrics.map((metric, mIdx) => (
                          <Text key={mIdx} style={styles.line}>     • {metric}</Text>
                        ))}
                      </View>
                    )}
                    {goal.backupPlan && (
                      <Text style={styles.line}>   Backup Plan: {goal.backupPlan}</Text>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                ))}
                <Text style={styles.emptyLine}> </Text>
              </View>
            )}

            {/* Preventive Care Section */}
            {data.preventive?.length > 0 && (
              <View>
                <Text style={styles.line}>PREVENTIVE CARE ({data.preventive.length})</Text>
                <Text style={styles.line}>{'='.repeat(60)}</Text>
                <Text style={styles.emptyLine}> </Text>
                {data.preventive.map((screening, idx) => (
                  <View key={idx}>
                    <Text style={styles.line}>{idx + 1}. {screening.screening || `Screening ${idx + 1}`}</Text>
                    {screening.dueDate && (
                      <Text style={styles.line}>   Due Date: {formatDate(screening.dueDate)}</Text>
                    )}
                    {screening.indication && (
                      <Text style={styles.line}>   Indication: {screening.indication}</Text>
                    )}
                    {screening.guidelines && (
                      <Text style={styles.line}>   Guidelines: {screening.guidelines}</Text>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                ))}
                <Text style={styles.emptyLine}> </Text>
              </View>
            )}

            {/* Psycho-Behavioral Support Section */}
            {data.psychoBehavioralSupport?.length > 0 && (
              <View>
                <Text style={styles.line}>PSYCHO-BEHAVIORAL SUPPORT ({data.psychoBehavioralSupport.length})</Text>
                <Text style={styles.line}>{'='.repeat(60)}</Text>
                <Text style={styles.emptyLine}> </Text>
                {data.psychoBehavioralSupport.map((support, idx) => (
                  <View key={idx}>
                    <Text style={styles.line}>{idx + 1}. {support.concern || `Concern ${idx + 1}`}</Text>
                    {support.recommendation && (
                      <Text style={styles.line}>   Recommendation: {support.recommendation}</Text>
                    )}
                    {support.rationale && (
                      <Text style={styles.line}>   Rationale: {support.rationale}</Text>
                    )}
                    {support.priority && (
                      <Text style={styles.line}>   Priority: {support.priority}</Text>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                ))}
                <Text style={styles.emptyLine}> </Text>
              </View>
            )}

            {/* Empty State */}
            {!data.immediate?.length &&
             !data.shortTerm?.length &&
             !data.longTerm?.length &&
             !data.preventive?.length &&
             !data.psychoBehavioralSupport?.length && (
              <Text style={styles.line}>No intelligent recommendations available</Text>
            )}
          </Page>
        );
      })}
    </Document>
  );
};

export default IntelligentRecommendationsPDFTemplate;
