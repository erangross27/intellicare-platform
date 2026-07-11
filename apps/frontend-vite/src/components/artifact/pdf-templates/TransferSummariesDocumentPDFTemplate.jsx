import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// June 2026 PDF Standards - Helvetica font, BLACK & WHITE only (no color), numbered lists, fieldBox
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    paddingBottom: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#666666',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
  },
  miniCard: {
    marginBottom: 8,
    paddingBottom: 4,
  },
  miniCardLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  miniCardValue: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.5,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#9ca3af',
  },
});

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

// Split text into sentences — splits on BOTH period and semicolon, with title protection
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
    .map(s => s.replace(/[;.]+$/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

// Constants
const SECTION_TITLES = {
  'report-info': 'Report Information',
  'clinical-indication': 'Clinical Indication',
  'findings-urgency': 'Findings & Urgency',
  'followup-recs': 'Follow-Up & Recommendations',
};

const FIELD_LABELS = {
  reportDate: 'Report Date',
  reportType: 'Report Type',
  clinicalIndication: 'Clinical Indication',
  findings: 'Findings',
  urgency: 'Urgency',
  followUp: 'Follow-Up',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'report-info': ['reportDate', 'reportType'],
  'clinical-indication': ['clinicalIndication'],
  'findings-urgency': ['findings', 'urgency'],
  'followup-recs': ['followUp', 'recommendations'],
};

const DATE_FIELDS = ['reportDate'];

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const TransferSummariesDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping for wrapped collections
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.transfer_summaries) {
        return inputData[0].transfer_summaries;
      }
      return inputData;
    }
    if (inputData.transfer_summaries) {
      return inputData.transfer_summaries;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  // Render a single field's rows (mini-cards), with the section title as first child when fIdx===0
  const renderField = (record, field, idx, sectionTitle, fIdx) => {
    const val = record[field];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[field] || field;
    // SINGLE-NAME SKIP: omit the field label when it equals the section title
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();

    let rows;
    if (DATE_FIELDS.includes(field)) {
      rows = [formatDate(val)];
    } else {
      const sentences = splitBySentence(String(val));
      rows = sentences.length > 0 ? sentences : [String(val)];
    }

    return (
      <View key={field} style={styles.miniCard}>
        {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
        {rows.map((row, rIdx) => (
          <Text key={rIdx} style={styles.miniCardValue}>{rows.length > 1 ? `${rIdx + 1}. ` : ''}{row}</Text>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Transfer Summaries</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {String(record._recordNumber || idx + 1)}. Transfer Summary
              </Text>
              {record.reportDate && (
                <Text style={styles.recordDate}>{formatDate(record.reportDate)}</Text>
              )}
            </View>

            {/* Sections — Rule #74: each section = ONE wrap-gated View, sectionTitle FIRST CHILD */}
            {Object.keys(SECTION_FIELDS).map(sid => {
              const fields = SECTION_FIELDS[sid];
              const sectionTitle = SECTION_TITLES[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;

              return (
                <View key={sid} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                  <View style={styles.sectionContent}>
                    {presentFields.map((field, fIdx) => renderField(record, field, idx, sectionTitle, fIdx))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default TransferSummariesDocumentPDFTemplate;
