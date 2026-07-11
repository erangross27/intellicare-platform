/**
 * SportsMedicineEvaluationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sports medicine evaluations
 * Collection: sports_medicine_evaluations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordStatus: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordSubtitle: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  fieldRow: { flexDirection: 'row', marginBottom: 6 },
  fieldRowLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', width: 200 },
  fieldRowValue: { fontSize: 12, color: '#3a3a3a', flex: 1 },
  listItem: { fontSize: 12, color: '#3a3a3a', marginBottom: 4, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const safeArray = (val) => (Array.isArray(val) ? val.filter(Boolean) : []);

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  return String(val);
};

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const splitIntoItems = (text) => {
  if (!text) return [];
  const numbered = text.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  const bySemicolon = text.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  const bySentence = text.split(/(?<=[.!?])\s+/).filter(s => s.trim()).map(s => s.trim());
  if (bySentence.length > 1) return bySentence;
  return [text.trim()];
};

const stripNumber = (text) => String(text).replace(/^\d+\.\s*/, '');

const SportsMedicineEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.sports_medicine_evaluations) {
        return inputData[0].sports_medicine_evaluations;
      }
      return inputData;
    }
    if (inputData.sports_medicine_evaluations) {
      return inputData.sports_medicine_evaluations;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sports Medicine Evaluation</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => formatValue(v) !== null && k !== '_id');
    if (entries.length === 0) return null;

    return (
      <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View>
          {entries.map(([key, value], i) => (
            <View key={i} style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{keyToLabel(key)}</Text>
              <Text style={styles.fieldValue}>{safeString(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderArraySection = (title, items) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;

    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View>
          {safeItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderTextSection = (title, text) => {
    if (!text) return null;
    const items = splitIntoItems(text);

    return (
      <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View>
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sports Medicine Evaluation</Text>
        </View>

        {records.map((record, index) => {
          const cs = record.cardiacScreening || {};
          const msk = record.musculoskeletalExam || {};

          // Sport info object
          const sportInfo = {};
          if (record.sport) sportInfo.sport = record.sport;
          if (record.level) sportInfo.level = record.level;
          if (record.position) sportInfo.position = record.position;
          if (record.competitionLevel) sportInfo.competitionLevel = record.competitionLevel;

          // Cardiac assessment object
          const csAssessment = {};
          if (cs.ecgPerformed !== undefined && cs.ecgPerformed !== null) csAssessment.ecgPerformed = cs.ecgPerformed;
          if (cs.ecgFindings) csAssessment.ecgFindings = cs.ecgFindings;
          if (cs.echoRecommended !== undefined && cs.echoRecommended !== null) csAssessment.echoRecommended = cs.echoRecommended;
          if (cs.clearanceDecision) csAssessment.clearanceDecision = cs.clearanceDecision;

          // MSK base fields
          const mskBase = {};
          if (msk.rom) mskBase.rangeOfMotion = msk.rom;
          if (msk.strength) mskBase.strength = msk.strength;

          // Provider object
          const providerObj = {};
          if (record.provider) providerObj.provider = record.provider;
          if (record.facility) providerObj.facility = record.facility;

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.evaluationDate && (
                    <Text style={styles.recordDate}>{formatDate(record.evaluationDate)}</Text>
                  )}
                  {record.clearanceStatus && (
                    <Text style={styles.recordStatus}>{record.clearanceStatus}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>Sports Medicine Evaluation {index + 1}</Text>
                {record.evaluationType && (
                  <Text style={styles.recordSubtitle}>{record.evaluationType}</Text>
                )}
              </View>

              {renderObjectSection('Sport Information', sportInfo)}
              {renderArraySection('Cardiac Screening - Personal History', cs.personalHistory)}
              {renderArraySection('Cardiac Screening - Family History', cs.familyHistory)}
              {renderObjectSection('Cardiac Screening - Physical Exam', cs.physicalExam)}
              {renderObjectSection('Cardiac Screening - Assessment', csAssessment)}
              {renderObjectSection('Musculoskeletal Exam', mskBase)}
              {renderArraySection('Musculoskeletal Exam - Instability', msk.instability)}
              {renderArraySection('Musculoskeletal Exam - Previous Injuries', msk.previousInjuries)}
              {renderArraySection('Musculoskeletal Exam - Concerns', msk.concerns)}
              {renderArraySection('Restrictions', record.restrictions)}
              {renderArraySection('Previous Injuries', record.previousInjuries)}
              {renderArraySection('Return to Play Criteria', record.returnToPlayCriteria)}
              {renderObjectSection('Rehabilitation Plan', record.rehabilitationPlan)}
              {renderTextSection('Return to Play Plan', record.returnToPlayPlan)}
              {renderObjectSection('Provider Information', providerObj)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SportsMedicineEvaluationsDocumentPDFTemplate;
