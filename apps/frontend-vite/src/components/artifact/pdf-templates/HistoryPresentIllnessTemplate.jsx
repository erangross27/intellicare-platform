import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  historyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#000000',
    marginBottom: 4
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
});

const HistoryPresentIllnessTemplate = ({ document }) => {
  const formatDate = (dateString) => {
    if (!dateString) return null;
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

  const splitIntoSentences = (text) => {
    if (!text) return [];
    // Temporarily replace spaces after common abbreviations with placeholder
    let processedText = text
      .replace(/Ms\. /g, 'Ms.nn')
      .replace(/Mrs\. /g, 'Mrs.nn')
      .replace(/Mr\. /g, 'Mr.nn')
      .replace(/Dr\. /g, 'Dr.nn')
      .replace(/Prof\. /g, 'Prof.nn')
      .replace(/Sr\. /g, 'Sr.nn')
      .replace(/Jr\. /g, 'Jr.nn');

    // Split on period followed by space
    let sentences = processedText.split('. ');

    // Restore abbreviations and clean up
    sentences = sentences.map(s => s.replace(/nn/g, ' ').trim());

    // Add period back to all except last sentence (if it already has punctuation)
    sentences = sentences.map((s, i) => {
      if (i === sentences.length - 1) return s;
      if (s.endsWith('.') || s.endsWith('?') || s.endsWith('!')) return s;
      return s + '.';
    });

    return sentences.filter(s => s.length > 0);
  };

  const sentences = splitIntoSentences(document.history || 'No history documented');

  return (
    <View wrap={false}>
      {/* Main History Narrative - Each sentence on its own line */}
      {sentences.map((sentence, index) => (
        <Text key={index} style={styles.historyText}>
          {sentence}
        </Text>
      ))}

      {/* Provider Information */}
      {document.provider && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Documented By: </Text>
          {document.provider}
        </Text>
      )}

      {/* Source */}
      {document.source && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Source: </Text>
          {document.source.replace(/_/g, ' ')}
        </Text>
      )}

      {/* Date */}
      {document.date && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Date: </Text>
          {formatDate(document.date)}
        </Text>
      )}
    </View>
  );
};

export default HistoryPresentIllnessTemplate;
