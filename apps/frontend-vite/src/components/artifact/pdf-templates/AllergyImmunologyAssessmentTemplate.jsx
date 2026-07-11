import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #7a7a7a',
    borderRadius: 2
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000'
  },
  value: {
    fontSize: 10,
    color: '#333333',
    marginLeft: 4
  },
  section: {
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline'
  },
  listItem: {
    fontSize: 9,
    color: '#333333',
    marginLeft: 0,
    marginBottom: 3,
    lineHeight: 1.4
  },
  subsection: {
    marginLeft: 8,
    marginTop: 4,
    marginBottom: 4
  }
});

const AllergyImmunologyAssessmentTemplate = ({ document }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Handle nested extractedData structure
  const extracted = document.extractedData || document;
  const data = extracted.allergyImmunologyAssessment || document;
  const allergyAssessment = extracted.allergyAssessment || {};
  const asthmaAssessment = extracted.asthmaAssessment || {};

  return (
    <View style={styles.card}>
      {/* Date */}
      {document.date && (
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{formatDate(document.date)}</Text>
        </View>
      )}

      {/* Skin Testing */}
      {data.skinTesting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skin Testing:</Text>
          {data.skinTesting.prickTest && Array.isArray(data.skinTesting.prickTest) && (
            <View style={styles.subsection}>
              <Text style={styles.label}>Prick Test:</Text>
              {data.skinTesting.prickTest.map((test, i) => (
                <Text key={i} style={styles.listItem}>• {test.allergen}: {test.result}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Specific IgE Testing */}
      {(data.specificIge || allergyAssessment.specificIge) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specific IgE:</Text>
          {Array.isArray(allergyAssessment.specificIge) && allergyAssessment.specificIge.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item.allergen}: {item.igeLevel} ({item.severity})
            </Text>
          ))}
        </View>
      )}

      {/* Total IgE */}
      {(allergyAssessment.totalIge || data.immuneFunction?.immunoglobulins?.totalIgE) && (
        <View style={styles.row}>
          <Text style={styles.label}>Total IgE:</Text>
          <Text style={styles.value}>{allergyAssessment.totalIge || data.immuneFunction?.immunoglobulins?.totalIgE}</Text>
        </View>
      )}

      {/* Environmental Allergens */}
      {allergyAssessment.environmentalAllergens && Array.isArray(allergyAssessment.environmentalAllergens) && allergyAssessment.environmentalAllergens.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environmental Allergens:</Text>
          {allergyAssessment.environmentalAllergens.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item.allergen || 'Unknown'}: {item.igeLevel || 'N/A'} ({item.severity || 'N/A'})
              {item.skinTestResult && ` - ${item.skinTestResult}`}
            </Text>
          ))}
        </View>
      )}

      {/* Component Testing */}
      {data.componentTesting && data.componentTesting.allergens && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Component Testing:</Text>
          {data.componentTesting.allergens.map((comp, i) => (
            <Text key={i} style={styles.listItem}>
              • {comp.component}: {comp.result} - {comp.interpretation}
            </Text>
          ))}
        </View>
      )}

      {/* Eosinophil Count */}
      {(allergyAssessment.eosinophilCount || asthmaAssessment.sputumEosinophils) && (
        <View style={styles.row}>
          <Text style={styles.label}>Eosinophil Count:</Text>
          <Text style={styles.value}>{allergyAssessment.eosinophilCount || asthmaAssessment.sputumEosinophils}</Text>
        </View>
      )}

      {/* Challenge Tests */}
      {data.challengeTests && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planned Challenge Tests:</Text>
          {data.challengeTests.aspirin?.planned && (
            <Text style={styles.listItem}>• Aspirin challenge: {data.challengeTests.aspirin.indication}</Text>
          )}
          {data.challengeTests.food?.planned && (
            <Text style={styles.listItem}>• Food challenge: {data.challengeTests.food.indication}</Text>
          )}
        </View>
      )}
    </View>
  );
};

export default AllergyImmunologyAssessmentTemplate;
