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
  subsectionTitle: {
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
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
    lineHeight: 1.5,
    marginLeft: 16,
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    marginLeft: 8,
  },
});

const PatientSpecificCarePlanTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Tailored Interventions */}
      {doc.tailoredInterventions && doc.tailoredInterventions.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>
            Tailored Interventions ({doc.tailoredInterventions.length})
          </Text>
          {doc.tailoredInterventions.map((intervention, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 14 }}>
              <Text style={styles.subsectionTitle}>
                {index + 1}. {intervention.intervention}
              </Text>

              {/* Personalization Factors */}
              {intervention.personalizationFactors && intervention.personalizationFactors.length > 0 && (
                <>
                  <Text style={styles.line}>
                    <Text style={styles.textBold}>Personalization Factors:</Text>
                  </Text>
                  {intervention.personalizationFactors.map((factor, idx) => (
                    <Text key={idx} style={styles.listItem}>
                      • {factor}
                    </Text>
                  ))}
                </>
              )}

              {/* Adherence Strategy */}
              {intervention.adherenceStrategy && (
                <Text style={[styles.line, { marginTop: 6 }]}>
                  <Text style={styles.textBold}>Adherence Strategy: </Text>
                  {intervention.adherenceStrategy}
                </Text>
              )}

              {/* Barriers */}
              {intervention.barriers && intervention.barriers.length > 0 && (
                <>
                  <Text style={[styles.line, { marginTop: 6 }]}>
                    <Text style={styles.textBold}>Barriers:</Text>
                  </Text>
                  {intervention.barriers.map((barrier, idx) => (
                    <Text key={idx} style={styles.listItem}>
                      • {barrier}
                    </Text>
                  ))}
                </>
              )}

              {/* Enablers */}
              {intervention.enablers && intervention.enablers.length > 0 && (
                <>
                  <Text style={[styles.line, { marginTop: 6 }]}>
                    <Text style={styles.textBold}>Enablers:</Text>
                  </Text>
                  {intervention.enablers.map((enabler, idx) => (
                    <Text key={idx} style={styles.listItem}>
                      • {enabler}
                    </Text>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Lifestyle Modifications */}
      {doc.lifestyleModifications && doc.lifestyleModifications.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>
            Lifestyle Modifications ({doc.lifestyleModifications.length})
          </Text>
          {doc.lifestyleModifications.map((lifestyle, index) => (
            <View key={index} wrap={false} style={{ marginBottom: 14 }}>
              <Text style={styles.subsectionTitle}>
                {lifestyle.domain}
                {lifestyle.feasibility && (
                  <Text style={styles.badge}> [{lifestyle.feasibility} Feasibility]</Text>
                )}
              </Text>

              {lifestyle.currentStatus && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Current Status: </Text>
                  {lifestyle.currentStatus}
                </Text>
              )}

              {lifestyle.recommendation && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Recommendation: </Text>
                  {lifestyle.recommendation}
                </Text>
              )}

              {lifestyle.patientContext && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Patient Context: </Text>
                  {lifestyle.patientContext}
                </Text>
              )}

              {lifestyle.expectedBenefit && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Expected Benefit: </Text>
                  {lifestyle.expectedBenefit}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Comorbidity Management */}
      {doc.comorbidityManagement && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Comorbidity Management</Text>

          {doc.comorbidityManagement.integratedApproach && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Integrated Approach: </Text>
                {doc.comorbidityManagement.integratedApproach}
              </Text>
            </View>
          )}

          {doc.comorbidityManagement.prioritization && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Priority Actions: </Text>
                {doc.comorbidityManagement.prioritization}
              </Text>
            </View>
          )}

          {doc.comorbidityManagement.interactions && doc.comorbidityManagement.interactions.length > 0 && (
            <>
              <Text style={styles.line}>
                <Text style={styles.textBold}>Clinical Interactions:</Text>
              </Text>
              {doc.comorbidityManagement.interactions.map((interaction, idx) => (
                <Text key={idx} style={styles.listItem}>
                  • {interaction}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Source Information */}
      {(doc.source || doc.aiProcessed) && (
        <View style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #cccccc' }}>
          {doc.source && (
            <Text style={[styles.line, { fontSize: 9, color: '#666666' }]}>
              Source: {doc.source}
            </Text>
          )}
          {doc.aiProcessed && (
            <Text style={[styles.line, { fontSize: 9, color: '#666666', fontStyle: 'italic' }]}>
              AI-Generated Care Plan
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default PatientSpecificCarePlanTemplate;
