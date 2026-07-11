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
  cardWithBorder: {
    borderLeft: '4px solid #7a7a7a',
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
    color: '#7a7a7a',
    marginBottom: 6,
  },
});

const FunctionalAssessmentTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Global Assessment */}
      {doc.globalAssessment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Global Assessment</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.globalAssessment}</Text>
          </View>
        </View>
      )}

      {/* Occupational Functioning */}
      {doc.occupationalFunctioning && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💼 Occupational Functioning</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.occupationalFunctioning}</Text>
          </View>
        </View>
      )}

      {/* Social Functioning */}
      {doc.socialFunctioning && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Social Functioning</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.socialFunctioning}</Text>
          </View>
        </View>
      )}

      {/* Academic Functioning */}
      {doc.academicFunctioning && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 Academic Functioning</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.academicFunctioning}</Text>
          </View>
        </View>
      )}

      {/* Self-Care */}
      {doc.selfCare && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧼 Self-Care</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.selfCare}</Text>
          </View>
        </View>
      )}

      {/* Independent Living */}
      {doc.independentLiving && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Independent Living</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.independentLiving}</Text>
          </View>
        </View>
      )}

      {/* Financial Management */}
      {doc.financialManagement && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Financial Management</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.financialManagement}</Text>
          </View>
        </View>
      )}

      {/* Medication Management */}
      {doc.medicationManagement && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Medication Management</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.medicationManagement}</Text>
          </View>
        </View>
      )}

      {/* FIM Score (if available) */}
      {doc.fimScore && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 FIM Score</Text>
          <View style={styles.card}>
            {typeof doc.fimScore === 'object' ? (
              <>
                {doc.fimScore.total && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Total Score</Text>
                    <Text style={styles.text}>{doc.fimScore.total}</Text>
                  </View>
                )}
                {doc.fimScore.selfCare && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Self-Care</Text>
                    <Text style={styles.text}>{doc.fimScore.selfCare}</Text>
                  </View>
                )}
                {doc.fimScore.transfers && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Transfers</Text>
                    <Text style={styles.text}>{doc.fimScore.transfers}</Text>
                  </View>
                )}
                {doc.fimScore.locomotion && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Locomotion</Text>
                    <Text style={styles.text}>{doc.fimScore.locomotion}</Text>
                  </View>
                )}
                {doc.fimScore.communication && (
                  <View style={styles.assessmentItem}>
                    <Text style={styles.domainTitle}>Communication</Text>
                    <Text style={styles.text}>{doc.fimScore.communication}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.text}>{doc.fimScore}</Text>
            )}
          </View>
        </View>
      )}

      {/* ADL/IADL */}
      {(doc.adl || doc.iadl) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚶 Activities of Daily Living</Text>
          <View style={styles.card}>
            {doc.adl && (
              <View style={styles.assessmentItem}>
                <Text style={styles.domainTitle}>ADL (Activities of Daily Living)</Text>
                <Text style={styles.text}>{doc.adl}</Text>
              </View>
            )}
            {doc.iadl && (
              <View>
                <Text style={styles.domainTitle}>IADL (Instrumental Activities of Daily Living)</Text>
                <Text style={styles.text}>{doc.iadl}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Summary/Notes */}
      {doc.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Summary</Text>
          <View style={[styles.card, styles.cardWithBorder]}>
            <Text style={styles.text}>{doc.summary}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default FunctionalAssessmentTemplate;
