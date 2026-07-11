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
  }
});

const AllergyAssessmentTemplate = ({ document }) => {
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

  return (
    <View style={styles.card}>
      {/* Date */}
      {document.date && (
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{formatDate(document.date)}</Text>
        </View>
      )}

      {/* Severity */}
      {document.severity && (
        <View style={styles.row}>
          <Text style={styles.label}>Severity:</Text>
          <Text style={styles.value}>{document.severity}</Text>
        </View>
      )}

      {/* Control */}
      {document.control && (
        <View style={styles.row}>
          <Text style={styles.label}>Control:</Text>
          <Text style={styles.value}>{document.control}</Text>
        </View>
      )}

      {/* Triggers */}
      {document.triggers && Array.isArray(document.triggers) && document.triggers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Triggers:</Text>
          <Text style={styles.listItem}>{document.triggers.join(', ')}</Text>
        </View>
      )}

      {/* Total IgE (lowercase 'e' in database) */}
      {document.totalIge && (
        <View style={styles.row}>
          <Text style={styles.label}>Total IgE:</Text>
          <Text style={styles.value}>{document.totalIge}</Text>
        </View>
      )}

      {/* Specific IgE - Array of objects (lowercase 'e' in database) */}
      {document.specificIge && Array.isArray(document.specificIge) && document.specificIge.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specific IgE:</Text>
          {[...document.specificIge]
            .sort((a, b) => {
              // Sort by severity class: 6 -> 1 (descending)
              const getClass = (sev) => parseInt(sev.match(/(\d+)/)?.[1] || 0);
              return getClass(b.severity) - getClass(a.severity);
            })
            .map((item, i) => (
              <Text key={i} style={styles.listItem}>
                • {item.allergen}: {item.igeLevel} ({item.severity})
              </Text>
            ))}
        </View>
      )}

      {/* Environmental Allergens - Array of objects */}
      {document.environmentalAllergens && Array.isArray(document.environmentalAllergens) && document.environmentalAllergens.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environmental Allergens:</Text>
          {document.environmentalAllergens.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item.allergen || 'Unknown'}: {item.igeLevel || 'N/A'} ({item.severity || 'N/A'})
              {item.skinTestResult && ` - ${item.skinTestResult}`}
            </Text>
          ))}
        </View>
      )}

      {/* Eosinophil Count */}
      {document.eosinophilCount && (
        <View style={styles.row}>
          <Text style={styles.label}>Eosinophil Count:</Text>
          <Text style={styles.value}>{document.eosinophilCount}</Text>
        </View>
      )}

      {/* Rescue Use Frequency */}
      {document.rescueUseFrequency && (
        <View style={styles.row}>
          <Text style={styles.label}>Rescue Use:</Text>
          <Text style={styles.value}>{document.rescueUseFrequency}</Text>
        </View>
      )}

      {/* Nocturnal Symptoms */}
      {document.nocturnal && (
        <View style={styles.row}>
          <Text style={styles.label}>Nocturnal Symptoms:</Text>
          <Text style={styles.value}>{document.nocturnal}</Text>
        </View>
      )}

      {/* Exercise Limitation */}
      {document.exerciseLimitation && (
        <View style={styles.row}>
          <Text style={styles.label}>Exercise Limitation:</Text>
          <Text style={styles.value}>{document.exerciseLimitation}</Text>
        </View>
      )}

      {/* FeNO Level */}
      {document.fenoLevel && (
        <View style={styles.row}>
          <Text style={styles.label}>FeNO Level:</Text>
          <Text style={styles.value}>{document.fenoLevel}</Text>
        </View>
      )}

      {/* Peak Flow Personal Best */}
      {document.peakFlowPersonalBest && (
        <View style={styles.row}>
          <Text style={styles.label}>Peak Flow:</Text>
          <Text style={styles.value}>
            {typeof document.peakFlowPersonalBest === 'object'
              ? document.peakFlowPersonalBest.current || JSON.stringify(document.peakFlowPersonalBest)
              : document.peakFlowPersonalBest}
          </Text>
        </View>
      )}

      {/* Sputum Eosinophils */}
      {document.sputumEosinophils && (
        <View style={styles.row}>
          <Text style={styles.label}>Sputum Eosinophils:</Text>
          <Text style={styles.value}>{document.sputumEosinophils}</Text>
        </View>
      )}

      {/* Exacerbation History - Array of objects */}
      {document.exacerbationHistory && Array.isArray(document.exacerbationHistory) && document.exacerbationHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exacerbation History:</Text>
          {document.exacerbationHistory.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              • {item.treatment || 'Treatment'}: {item.frequency || 'N/A'}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

export default AllergyAssessmentTemplate;
