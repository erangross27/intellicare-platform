import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

/**
 * Admission Recommendations PDF Template - December 2025
 * BLACK & WHITE only for professional printing
 * Numbers in lists (no dashes)
 * Keep-With-Next pattern for section titles
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 10,
    color: '#333333'
  },
  recordContainer: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    borderBottomStyle: 'solid'
  },
  recordHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid'
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4
  },
  recordMeta: {
    fontSize: 9,
    color: '#666666'
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid',
    paddingBottom: 3
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    width: 140,
    flexShrink: 0
  },
  fieldValue: {
    fontSize: 10,
    color: '#333333',
    flex: 1
  },
  listItem: {
    fontSize: 10,
    color: '#333333',
    marginBottom: 3,
    paddingLeft: 12,
    lineHeight: 1.4
  },
  paragraph: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.5,
    marginBottom: 6,
    paddingLeft: 8
  },
  nestedLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 8,
    textTransform: 'uppercase'
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    paddingLeft: 8
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderTopStyle: 'solid',
    paddingTop: 8
  }
});

const AdmissionRecommendationsDocumentPDFTemplate = ({ document }) => {
  // Handle data unwrapping
  const records = Array.isArray(document) ? document :
                  document?.admission_recommendations ? document.admission_recommendations :
                  document ? [document] : [];

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
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

  // Split into sentences on '.'/';' + whitespace (paren-aware, abbreviation-protected) — mirrors the JSX template's splitBySentence
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
          current += ch;
          continue;
        }
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      } else {
        current += ch;
      }
    }
    const tail = current.replace(/[.;]+$/, '').trim();
    if (tail) result.push(tail);
    return result;
  };

  // Split by comma, respecting parentheses
  const splitByComma = (text) => {
    if (!text) return [];
    const items = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      // Skip thousands separators: a comma directly between two digits (e.g. 85,000) is part of the number, not a list separator
      else if (char === ',' && parenDepth === 0 &&
               !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) {
        if (current.trim()) items.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) items.push(current.trim());
    return items;
  };

  // Mirror the JSX renderSentenceEditableField: split into sentences, then per sentence detect a "Label:"
  // and comma-split the value (>=2 items) into nested-subtitle blocks. Keeps the PDF and JSX in lockstep.
  const parseSentenceBlocks = (text) => {
    if (!text || typeof text !== 'string') return [];
    return splitBySentence(text).map((sentence) => {
      const colonIdx = sentence.indexOf(':');
      if (colonIdx > 0 && colonIdx < 50) {
        const label = sentence.substring(0, colonIdx).trim();
        const value = sentence.substring(colonIdx + 1).trim();
        const parts = splitByComma(value);
        return { label, items: parts.length >= 2 ? parts : [value] };
      }
      const parts = splitByComma(sentence);
      return { label: null, items: parts.length >= 2 ? parts : [sentence] };
    });
  };

  // Render a sentence field as nested-subtitle blocks (optional label header + numbered items), matching the JSX layout.
  // Page-break rule #74: section title INSIDE the conditional-wrap View; <=8 lines stay together, longer flows.
  const renderSentenceSection = (title, text) => {
    const blocks = parseSentenceBlocks(text);
    if (blocks.length === 0) return null;
    // Group consecutive UNLABELED blocks into ONE unit (mirrors the JSX: Findings collapses to one card,
    // numbered continuously; Follow-Up keeps Week 2/4/12 + Monthly as separate units).
    const units = [];
    blocks.forEach((b) => {
      const last = units[units.length - 1];
      if (!b.label && last && !last.label) {
        last.items.push(...b.items);
      } else {
        units.push({ label: b.label, items: [...b.items] });
      }
    });
    const totalLines = units.reduce((n, u) => n + (u.label ? 1 : 0) + u.items.length, 0);
    return (
      <View>
        <View wrap={totalLines > 8 ? undefined : false}>
          <Text style={styles.sectionHeader}>{title}</Text>
          {units.map((u, ui) => (
            <View key={ui}>
              {u.label && <Text style={styles.nestedLabel}>{u.label}</Text>}
              {u.items.length > 1
                ? u.items.map((item, ii) => (
                    <Text key={ii} style={styles.listItem}>{ii + 1}. {item}</Text>
                  ))
                : <Text style={u.label ? styles.listItem : styles.paragraph}>{u.items[0]}</Text>}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Admission Recommendations</Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Admission Recommendation {idx + 1}</Text>
              <Text style={styles.recordMeta}>
                {record.reportDate && `Date: ${formatDate(record.reportDate)}`}
                {record.reportDate && record.reportType && ' | '}
                {record.reportType && `Type: ${record.reportType}`}
                {(record.reportDate || record.reportType) && record.urgency && ' | '}
                {record.urgency && `Urgency: ${record.urgency.split(' - ')[0] || record.urgency}`}
              </Text>
            </View>

            {/* Report Type */}
            {record.reportType && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionHeader}>Report Type</Text>
                  <Text style={styles.paragraph}>{record.reportType}</Text>
                </View>
              </View>
            )}

            {/* Clinical Indication */}
            {record.clinicalIndication && renderSentenceSection('Clinical Indication', record.clinicalIndication)}

            {/* Findings */}
            {record.findings && renderSentenceSection('Findings', record.findings)}

            {/* Urgency */}
            {record.urgency && (
              <View>
                <View wrap={false}>
                  <Text style={styles.sectionHeader}>Urgency</Text>
                  <Text style={styles.urgencyText}>{record.urgency}</Text>
                </View>
              </View>
            )}

            {/* Recommendations */}
            {record.recommendations && renderSentenceSection('Recommendations', record.recommendations)}

            {/* Follow-up */}
            {record.followUp && renderSentenceSection('Follow-Up', record.followUp)}
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Admission Recommendations - Confidential Medical Record
        </Text>
      </Page>
    </Document>
  );
};

export default AdmissionRecommendationsDocumentPDFTemplate;
