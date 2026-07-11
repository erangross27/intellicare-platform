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
    marginTop: 8,
    marginBottom: 6,
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
});

const PatientEducationContextTemplate = ({ document }) => {
  console.log('🎯 PatientEducationContextTemplate - Received document:', document);

  const doc = document;

  if (!doc) {
    console.error('❌ Document is null or undefined!');
    return (
      <View>
        <Text style={styles.line}>No document data</Text>
      </View>
    );
  }

  console.log('✅ Document keys:', Object.keys(doc));
  console.log('   - conditionExplanation:', !!doc.conditionExplanation);
  console.log('   - medicationInstructions:', doc.medicationInstructions?.length || 0);
  console.log('   - lifestyleGuidance:', doc.lifestyleGuidance?.length || 0);
  console.log('   - resources:', doc.resources?.length || 0);

  console.log('🔨 Starting to render template...');

  return (
    <View>
      {/* Understanding Your Condition */}
      {doc.conditionExplanation && (
        <View>
          {console.log('📘 Rendering Understanding Your Condition section')}

          {/* Title + first paragraph together */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Understanding Your Condition</Text>
            {doc.conditionExplanation.simplifiedSummary && (
              <Text style={[styles.line, { marginBottom: 8 }]}>
                {doc.conditionExplanation.simplifiedSummary}
              </Text>
            )}
          </View>

          {doc.conditionExplanation.keyPoints && Array.isArray(doc.conditionExplanation.keyPoints) && doc.conditionExplanation.keyPoints.length > 0 && (
            <View wrap={false}>
              <Text style={styles.subsectionTitle}>Key Points:</Text>
              {doc.conditionExplanation.keyPoints.filter(point => point != null).map((point, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {point}
                </Text>
              ))}
            </View>
          )}

          {doc.conditionExplanation.whatToExpect && (
            <View wrap={false}>
              <Text style={styles.subsectionTitle}>What to Expect:</Text>
              <Text style={styles.line}>{doc.conditionExplanation.whatToExpect}</Text>
            </View>
          )}

          {doc.conditionExplanation.warningSignsToWatch && Array.isArray(doc.conditionExplanation.warningSignsToWatch) && doc.conditionExplanation.warningSignsToWatch.length > 0 && (
            <View wrap={false}>
              <Text style={[styles.subsectionTitle, { marginTop: 12 }]}>Warning Signs - Call Doctor:</Text>
              {doc.conditionExplanation.warningSignsToWatch.filter(sign => sign != null).map((sign, idx) => (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {sign}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Your Medications */}
      {doc.medicationInstructions && Array.isArray(doc.medicationInstructions) && doc.medicationInstructions.length > 0 && (
        <View>
          {console.log('💊 Rendering Your Medications section')}
          {doc.medicationInstructions.filter(med => med != null).map((med, index) => (
            <View key={index} style={{ marginBottom: 12, marginTop: index === 0 ? 16 : 8 }} wrap={false}>
              {/* Include section title with first medication */}
              {index === 0 && (
                <Text style={styles.sectionTitle}>Your Medications</Text>
              )}
              <Text style={[styles.subsectionTitle, { marginTop: 8 }]}>
                {index + 1}. {med.medication || 'Medication'}
              </Text>

              {med.purpose && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Why you take this: </Text>
                  {med.purpose}
                </Text>
              )}

              {med.howToTake && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>How to take: </Text>
                  {med.howToTake}
                </Text>
              )}

              {med.commonSideEffects && Array.isArray(med.commonSideEffects) && med.commonSideEffects.length > 0 && (
                <View>
                  <Text style={[styles.line, { marginTop: 4 }]}>
                    <Text style={styles.textBold}>Common side effects:</Text>
                  </Text>
                  {med.commonSideEffects.filter(effect => effect != null).map((effect, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {effect}
                    </Text>
                  ))}
                </View>
              )}

              {med.whenToCallDoctor && Array.isArray(med.whenToCallDoctor) && med.whenToCallDoctor.length > 0 && (
                <View>
                  <Text style={[styles.line, { marginTop: 4 }]}>
                    <Text style={styles.textBold}>Call your doctor if:</Text>
                  </Text>
                  {med.whenToCallDoctor.filter(reason => reason != null).map((reason, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {reason}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Lifestyle Guidance */}
      {doc.lifestyleGuidance && Array.isArray(doc.lifestyleGuidance) && doc.lifestyleGuidance.length > 0 && (
        <View>
          {console.log('🏃 Rendering Lifestyle Guidance section')}
          {doc.lifestyleGuidance.filter(guidance => guidance != null).map((guidance, index) => (
            <View key={index} style={{ marginBottom: 12, marginTop: index === 0 ? 16 : 8 }} wrap={false}>
              {/* Include section title with first guidance */}
              {index === 0 && (
                <Text style={styles.sectionTitle}>Lifestyle & Self-Care</Text>
              )}
              <Text style={[styles.subsectionTitle, { marginTop: 8 }]}>
                {index + 1}. {guidance.topic || guidance.category || 'Guidance'}
              </Text>

              {guidance.recommendation && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Recommendation: </Text>
                  {guidance.recommendation}
                </Text>
              )}

              {guidance.reasoning && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Why: </Text>
                  {guidance.reasoning}
                </Text>
              )}

              {guidance.practicalTips && Array.isArray(guidance.practicalTips) && guidance.practicalTips.length > 0 && (
                <View>
                  <Text style={[styles.line, { marginTop: 4 }]}>
                    <Text style={styles.textBold}>Practical Tips:</Text>
                  </Text>
                  {guidance.practicalTips.filter(tip => tip != null).map((tip, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {tip}
                    </Text>
                  ))}
                </View>
              )}

              {guidance.patientSpecificTips && Array.isArray(guidance.patientSpecificTips) && guidance.patientSpecificTips.length > 0 && (
                <View>
                  <Text style={[styles.line, { marginTop: 4 }]}>
                    <Text style={styles.textBold}>Tips for You:</Text>
                  </Text>
                  {guidance.patientSpecificTips.filter(tip => tip != null).map((tip, idx) => (
                    <Text key={idx} style={[styles.line, styles.indent]}>
                      • {tip}
                    </Text>
                  ))}
                </View>
              )}

              {guidance.reasonableGoal && (
                <Text style={[styles.line, { marginTop: 4 }]}>
                  <Text style={styles.textBold}>Reasonable Goal: </Text>
                  {guidance.reasonableGoal}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Resources */}
      {doc.resources && Array.isArray(doc.resources) && doc.resources.length > 0 && (
        <View>
          {console.log('📚 Rendering Resources section')}
          <Text style={styles.sectionTitle}>Resources & Support</Text>
          {doc.resources.filter(resource => resource != null).map((resource, idx) => {
            // Resources can be either strings or objects with {name, type, purpose, relevance}
            if (typeof resource === 'string') {
              return (
                <Text key={idx} style={[styles.line, styles.indent]}>
                  • {resource}
                </Text>
              );
            } else if (resource.name) {
              return (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <Text style={[styles.line, styles.indent]}>
                    • <Text style={styles.textBold}>{resource.name}</Text>
                    {resource.type && ` (${resource.type})`}
                  </Text>
                  {resource.purpose && (
                    <Text style={[styles.line, { marginLeft: 24, fontSize: 9 }]}>
                      {resource.purpose}
                    </Text>
                  )}
                </View>
              );
            }
            return null;
          })}
        </View>
      )}
    </View>
  );
};

export default PatientEducationContextTemplate;
