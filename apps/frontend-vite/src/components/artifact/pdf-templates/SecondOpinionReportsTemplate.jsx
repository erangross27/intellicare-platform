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
    marginBottom: 10,
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  opinionBlock: {
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #7a7a7a',
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  recommendationBlock: {
    backgroundColor: '#f1f1f1',
    borderLeft: '4px solid #a7a7a7',
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  agreementBlock: {
    backgroundColor: '#f0f0f0',
    borderLeft: '4px solid #808080',
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  disagreementBlock: {
    backgroundColor: '#eaeaea',
    borderLeft: '4px solid #777777',
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: 4,
    color: '#ffffff',
    marginBottom: 8,
  },
  badgeBlue: {
    backgroundColor: '#7a7a7a',
  },
  badgeGreen: {
    backgroundColor: '#808080',
  },
  badgeRed: {
    backgroundColor: '#777777',
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
});

const SecondOpinionReportsTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Consulting Physician */}
      {doc.consultingPhysician && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍⚕️ Consulting Physician</Text>
          <View style={styles.card}>
            <Text style={styles.text}>
              <Text style={styles.textBold}>Name: </Text>
              {doc.consultingPhysician.name || doc.consultingPhysician}
            </Text>
            {doc.consultingPhysician.specialty && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Specialty: </Text>
                {doc.consultingPhysician.specialty}
              </Text>
            )}
            {doc.consultingPhysician.credentials && (
              <Text style={styles.text}>
                <Text style={styles.textBold}>Credentials: </Text>
                {doc.consultingPhysician.credentials}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Review of Original Diagnosis */}
      {doc.originalDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Review of Original Diagnosis</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.originalDiagnosis}</Text>
          </View>
        </View>
      )}

      {/* Clinical Opinion */}
      {doc.clinicalOpinion && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Clinical Opinion</Text>
          <View style={styles.opinionBlock}>
            <Text style={styles.text}>{doc.clinicalOpinion}</Text>
          </View>
        </View>
      )}

      {/* Agreement/Disagreement with Original Assessment */}
      {doc.agreement !== undefined && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✓ Assessment Comparison</Text>
          {doc.agreement === true || doc.agreement === 'agree' ? (
            <View style={styles.agreementBlock}>
              <Text style={[styles.badge, styles.badgeGreen]}>AGREES</Text>
              <Text style={styles.text}>
                The consulting physician agrees with the original assessment.
              </Text>
              {doc.agreementDetails && (
                <Text style={[styles.text, { marginTop: 6 }]}>{doc.agreementDetails}</Text>
              )}
            </View>
          ) : (
            <View style={styles.disagreementBlock}>
              <Text style={[styles.badge, styles.badgeRed]}>DISAGREES</Text>
              <Text style={styles.text}>
                The consulting physician has a different assessment.
              </Text>
              {doc.disagreementDetails && (
                <Text style={[styles.text, { marginTop: 6 }]}>{doc.disagreementDetails}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Alternative Diagnosis */}
      {doc.alternativeDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔬 Alternative Diagnosis</Text>
          <View style={styles.card}>
            <Text style={[styles.text, styles.textBold]}>{doc.alternativeDiagnosis}</Text>
          </View>
        </View>
      )}

      {/* Recommended Treatment Plan */}
      {doc.recommendedTreatment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Recommended Treatment Plan</Text>
          <View style={styles.recommendationBlock}>
            <Text style={styles.text}>{doc.recommendedTreatment}</Text>
          </View>
        </View>
      )}

      {/* Additional Testing Recommended */}
      {doc.additionalTesting && doc.additionalTesting.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Additional Testing Recommended</Text>
          <View style={styles.card}>
            {doc.additionalTesting.map((test, index) => (
              <Text key={index} style={styles.listItem}>• {test}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Key Recommendations */}
      {doc.keyRecommendations && doc.keyRecommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Key Recommendations</Text>
          <View style={styles.recommendationBlock}>
            {doc.keyRecommendations.map((rec, index) => (
              <Text key={index} style={styles.listItem}>• {rec}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Prognosis */}
      {doc.prognosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Prognosis</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.prognosis}</Text>
          </View>
        </View>
      )}

      {/* References/Literature */}
      {doc.references && doc.references.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 References</Text>
          <View style={styles.card}>
            {doc.references.map((ref, index) => (
              <Text key={index} style={[styles.text, { fontSize: 9 }]}>
                {index + 1}. {ref}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Date */}
      {doc.date && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.badge, styles.badgeBlue]}>
            📅 {new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
      )}
    </View>
  );
};

export default SecondOpinionReportsTemplate;
