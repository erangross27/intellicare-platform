import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Helvetica',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 200,
  },
  fieldValue: {
    fontSize: 12,
    color: '#404040',
    flex: 1,
  },
  listItem: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 4,
    paddingLeft: 8,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  return String(val);
};

/* Numeric fields where 0 is a MEANINGFUL clinical value (keep it). For all other numeric
   fields, 0 is a sentinel ("not measured / not done") and must be dropped — mirrors the
   on-screen template so the PDF never shows a misleading "Six Minute Walk Distance: 0". */
const MEANINGFUL_ZERO_FIELDS = ['borgDyspneaScale', 'borgExertionScale', 'mmrcDyspneaGrade'];
const keepNum = (fn, val) => {
  if (val === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn)) return false;
  return formatValue(val) !== null;
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

const PulmonaryRehabilitationNotesDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.pulmonary_rehabilitation_notes) {
        return inputData[0].pulmonary_rehabilitation_notes;
      }
      return inputData;
    }
    if (inputData.pulmonary_rehabilitation_notes) {
      return inputData.pulmonary_rehabilitation_notes;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pulmonary Rehabilitation Notes</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  // Render object section (key-value pairs) - uses formatValue for numeric safety
  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => formatValue(v) !== null && k !== '_id');
    if (entries.length === 0) return null;

    return (
      <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value], i) => (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{keyToLabel(key)}:</Text>
              <Text style={styles.fieldValue}>{safeString(value)}</Text>
            </View>
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
        <View style={styles.sectionContent}>
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderArraySection = (title, items) => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (safeItems.length === 0) return null;

    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {safeItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pulmonary Rehabilitation Notes</Text>
        </View>

        {records.map((record, index) => {
          // Build section objects (use formatValue !== null for numeric fields)
          const sessionObj = {};
          if (keepNum('sessionDurationMinutes', record.sessionDurationMinutes)) sessionObj.sessionDurationMinutes = record.sessionDurationMinutes;
          if (keepNum('exerciseIntensityPercentage', record.exerciseIntensityPercentage)) sessionObj.exerciseIntensityPercentage = record.exerciseIntensityPercentage;
          if (keepNum('mmrcDyspneaGrade', record.mmrcDyspneaGrade)) sessionObj.mmrcDyspneaGrade = record.mmrcDyspneaGrade;

          const vitalsObj = {};
          if (keepNum('preExerciseOxygenSaturation', record.preExerciseOxygenSaturation)) vitalsObj.preExerciseOxygenSaturation = record.preExerciseOxygenSaturation;
          if (keepNum('postExerciseOxygenSaturation', record.postExerciseOxygenSaturation)) vitalsObj.postExerciseOxygenSaturation = record.postExerciseOxygenSaturation;
          if (record.restingBloodPressure) vitalsObj.restingBloodPressure = record.restingBloodPressure;
          if (record.postExerciseBloodPressure) vitalsObj.postExerciseBloodPressure = record.postExerciseBloodPressure;
          if (keepNum('peakHeartRate', record.peakHeartRate)) vitalsObj.peakHeartRate = record.peakHeartRate;
          if (keepNum('targetHeartRate', record.targetHeartRate)) vitalsObj.targetHeartRate = record.targetHeartRate;

          const exerciseObj = {};
          if (keepNum('sixMinuteWalkDistance', record.sixMinuteWalkDistance)) exerciseObj.sixMinuteWalkDistance = record.sixMinuteWalkDistance;
          if (keepNum('exerciseToleranceMinutes', record.exerciseToleranceMinutes)) exerciseObj.exerciseToleranceMinutes = record.exerciseToleranceMinutes;
          if (formatValue(record.exerciseInducedDesaturation) !== null) exerciseObj.exerciseInducedDesaturation = record.exerciseInducedDesaturation;
          if (keepNum('oxygenFlowRateExercise', record.oxygenFlowRateExercise)) exerciseObj.oxygenFlowRateExercise = record.oxygenFlowRateExercise;

          const scoresObj = {};
          if (keepNum('borgDyspneaScale', record.borgDyspneaScale)) scoresObj.borgDyspneaScale = record.borgDyspneaScale;
          if (keepNum('borgExertionScale', record.borgExertionScale)) scoresObj.borgExertionScale = record.borgExertionScale;
          if (keepNum('copyCatScore', record.copyCatScore)) scoresObj.copyCatScore = record.copyCatScore;
          if (keepNum('chronicRespiratoryQuestionnaire', record.chronicRespiratoryQuestionnaire)) scoresObj.chronicRespiratoryQuestionnaire = record.chronicRespiratoryQuestionnaire;

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.createdAt && (
                    <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>Pulmonary Rehabilitation Note {index + 1}</Text>
              </View>

              {renderObjectSection('Session Overview', sessionObj)}
              {renderObjectSection('Vital Signs', vitalsObj)}
              {renderObjectSection('Exercise Performance', exerciseObj)}
              {renderObjectSection('Assessment Scores', scoresObj)}
              {renderArraySection('Exercise Modalities', record.exerciseModalitiesPerformed)}
              {renderArraySection('Breathing Techniques', record.breathingTechniques)}
              {renderArraySection('Energy Conservation Techniques', record.energyConservationTechniques)}
              {renderArraySection('Nutritional Counseling Topics', record.nutritionalCounselingTopics)}
              {renderTextSection('Psychosocial Support', record.psychosocialSupport)}
              {renderTextSection('Medication Adherence', record.medicationAdherence)}
              {renderTextSection('Progress Toward Goals', record.progressTowardGoals)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PulmonaryRehabilitationNotesDocumentPDFTemplate;
