import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Stress Management Referrals PDF Template - February 2026
 * Professional Black & White Format for Printing
 *
 * wrap={false} strategy:
 * - recordHeader: small, stays together
 * - Section title grouped INSIDE fieldBox: prevents orphaned titles
 * - fieldBox: wrap={false} for <=8 items, undefined for >8
 * - NEVER on sections or recordContainer (causes overlapping)
 *
 * NO borderBottom on sectionTitle (causes react-pdf to orphan titles)
 * NO headers or footers
 */

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, 'deg')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00f7/g, '/')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 13,
    color: '#444444',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  // NO borderBottom - causes react-pdf to orphan titles
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  subtitleLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    marginTop: 6,
  },
  subtitleValue: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  noRecords: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return dateString; }
};

// Sentence splitter with parenthesis + title protection (matches JSX)
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
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// Parse "Label: value" from a single sentence
const parseLabel = (sentence) => {
  if (!sentence || typeof sentence !== 'string') return { label: null, value: sentence || '', isLabeled: false };
  const colonMatch = sentence.match(/^([^:]+?):\s*(.+)$/s);
  if (colonMatch && colonMatch[1].length < 80) {
    return { label: colonMatch[1].trim(), value: colonMatch[2].trim(), isLabeled: true };
  }
  return { label: null, value: sentence.trim(), isLabeled: false };
};

// Render a simple field inside fieldBox (title inside fieldBox for anti-orphan)
const renderField = (label, value) => {
  if (!value) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

// Render a text field split by sentences with label:value support (title inside fieldBox)
// Labeled items (with nested subtitles) sorted first, then generic items
const renderSentenceField = (label, value) => {
  if (!value) return null;
  const sentences = splitBySentence(value);
  if (sentences.length <= 1) {
    // Single sentence — check for label:value
    const parsed = parseLabel(value.replace(/[.;]+$/, '').trim());
    if (parsed.isLabeled) {
      return (
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.fieldLabel}>{safeString(label)}</Text>
          <Text style={styles.subtitleLabel}>{safeString(parsed.label)}</Text>
          <Text style={styles.subtitleValue}>1. {safeString(parsed.value)}</Text>
        </View>
      );
    }
    return renderField(label, value);
  }

  // Parse and sort: labeled items first, then generic
  const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
  parsed.sort((a, b) => {
    if (a.isLabeled && !b.isLabeled) return -1;
    if (!a.isLabeled && b.isLabeled) return 1;
    return 0;
  });

  return (
    <View style={styles.fieldBox} wrap={parsed.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      {parsed.map((p, i) => {
        if (p.isLabeled) {
          return (
            <View key={i} style={{ marginBottom: 4 }}>
              <Text style={styles.subtitleLabel}>{safeString(p.label)}</Text>
              <Text style={styles.subtitleValue}>{i + 1}. {safeString(p.value)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p.raw)}</Text>
        );
      })}
    </View>
  );
};

const StressManagementReferralsDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Stress Management Referrals</Text>
          </View>
          <Text style={styles.noRecords}>No stress management referral records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Stress Management Referrals</Text>
          <Text style={styles.documentSubtitle}>Confidential Medical Document</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={index < records.length - 1 ? styles.recordContainer : undefined}>
            {/* Record Header with left accent */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Stress Management Referral {index + 1}</Text>
              {record.date && (
                <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
              )}
            </View>

            {/* Referral Information */}
            {renderField('Status', record.status)}
            {renderField('Urgency', record.urgency)}
            {renderField('Specialty', record.specialty)}
            {renderField('Referring Provider', record.referringProvider)}

            {/* Reason for Referral — sentence-split with label:value support */}
            {renderSentenceField('Reason for Referral', record.reason)}

            {/* Notes — sentence-split with label:value support */}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StressManagementReferralsDocumentPDFTemplate;
