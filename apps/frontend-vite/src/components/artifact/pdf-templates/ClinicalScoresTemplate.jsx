import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #cccccc',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 4,
  },
  value: {
    fontSize: 10,
    color: '#333333',
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline',
  },
  scoreHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  interpretation: {
    fontSize: 10,
    color: '#333333',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  componentsList: {
    marginLeft: 12,
    marginTop: 4,
  },
  componentItem: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 2,
  },
});

const ClinicalScoresTemplate = ({ document }) => {
  const doc = document;

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

  const scores = doc.scores || {};

  return (
    <View style={styles.container}>
      {/* Header Information */}
      {(doc.date || doc.diagnosis || doc.provider) && (
        <View style={styles.section}>
          {doc.date && (
            <View style={styles.row}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.value}>{formatDate(doc.date)}</Text>
            </View>
          )}
          {doc.diagnosis && (
            <View style={styles.row}>
              <Text style={styles.label}>Diagnosis:</Text>
              <Text style={styles.value}>{doc.diagnosis}</Text>
            </View>
          )}
          {doc.provider && (
            <View style={styles.row}>
              <Text style={styles.label}>Provider:</Text>
              <Text style={styles.value}>{doc.provider}</Text>
            </View>
          )}
        </View>
      )}

      {/* ASA Score */}
      {scores.ASA && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ASA Physical Status Classification</Text>
          <Text style={styles.scoreHeader}>Score: {scores.ASA.score}</Text>
          {scores.ASA.interpretation && (
            <Text style={styles.interpretation}>{scores.ASA.interpretation}</Text>
          )}
        </View>
      )}

      {/* RCRI Score */}
      {scores.RCRI && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revised Cardiac Risk Index (RCRI)</Text>
          <Text style={styles.scoreHeader}>Score: {scores.RCRI.score}</Text>
          {scores.RCRI.interpretation && (
            <Text style={styles.interpretation}>{scores.RCRI.interpretation}</Text>
          )}
        </View>
      )}

      {/* NSQIP Score */}
      {scores.NSQIP && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NSQIP Surgical Risk Calculator</Text>
          {scores.NSQIP.seriousComplication && (
            <View style={styles.row}>
              <Text style={styles.label}>Serious Complication:</Text>
              <Text style={styles.value}>{scores.NSQIP.seriousComplication}</Text>
            </View>
          )}
          {scores.NSQIP.anyComplication && (
            <View style={styles.row}>
              <Text style={styles.label}>Any Complication:</Text>
              <Text style={styles.value}>{scores.NSQIP.anyComplication}</Text>
            </View>
          )}
          {scores.NSQIP.pneumonia && (
            <View style={styles.row}>
              <Text style={styles.label}>Pneumonia Risk:</Text>
              <Text style={styles.value}>{scores.NSQIP.pneumonia}</Text>
            </View>
          )}
          {scores.NSQIP.cardiac && (
            <View style={styles.row}>
              <Text style={styles.label}>Cardiac Risk:</Text>
              <Text style={styles.value}>{scores.NSQIP.cardiac}</Text>
            </View>
          )}
          {scores.NSQIP.vte && (
            <View style={styles.row}>
              <Text style={styles.label}>VTE Risk:</Text>
              <Text style={styles.value}>{scores.NSQIP.vte}</Text>
            </View>
          )}
        </View>
      )}

      {/* STOP-BANG Score */}
      {scores.STOPBANG && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STOP-BANG Score (OSA Screening)</Text>
          <Text style={styles.scoreHeader}>
            Score: {scores.STOPBANG.score}
            {scores.STOPBANG.denominator && ` / ${scores.STOPBANG.denominator}`}
          </Text>
          {scores.STOPBANG.interpretation && (
            <Text style={styles.interpretation}>{scores.STOPBANG.interpretation}</Text>
          )}
        </View>
      )}

      {/* Apfel Score */}
      {scores.Apfel && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apfel Score (PONV Risk)</Text>
          <Text style={styles.scoreHeader}>
            Score: {scores.Apfel.score}
            {scores.Apfel.denominator && ` / ${scores.Apfel.denominator}`}
          </Text>
          {scores.Apfel.interpretation && (
            <Text style={styles.interpretation}>{scores.Apfel.interpretation}</Text>
          )}
          {scores.Apfel.components && scores.Apfel.components.length > 0 && (
            <View style={styles.componentsList}>
              <Text style={styles.label}>Risk Factors:</Text>
              {scores.Apfel.components.map((component, idx) => (
                <Text key={idx} style={styles.componentItem}>• {component}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Other Scores */}
      {Object.keys(scores).filter(key =>
        !['ASA', 'RCRI', 'NSQIP', 'STOPBANG', 'Apfel'].includes(key)
      ).map((scoreKey) => {
        const score = scores[scoreKey];
        return (
          <View key={scoreKey} style={styles.section}>
            <Text style={styles.sectionTitle}>{scoreKey}</Text>
            {typeof score === 'object' ? (
              <>
                {score.score !== undefined && (
                  <Text style={styles.scoreHeader}>
                    Score: {score.score}
                    {score.denominator && ` / ${score.denominator}`}
                  </Text>
                )}
                {score.interpretation && (
                  <Text style={styles.interpretation}>{score.interpretation}</Text>
                )}
                {score.components && score.components.length > 0 && (
                  <View style={styles.componentsList}>
                    {score.components.map((component, idx) => (
                      <Text key={idx} style={styles.componentItem}>• {component}</Text>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.value}>{String(score)}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default ClinicalScoresTemplate;
