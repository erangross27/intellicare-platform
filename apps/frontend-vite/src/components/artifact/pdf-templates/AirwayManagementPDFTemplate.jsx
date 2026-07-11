import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/μm/g, 'um')
    .replace(/°/g, 'deg')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 13,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#000000',
    textAlign: 'center',
    borderBottom: '2pt solid #000000',
    paddingBottom: 12,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: '1pt solid #000000',
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1pt solid #000000',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBlock: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 13,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 13,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  nestedSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 8,
  },
  noRecords: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const AirwayManagementPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

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

  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const match = text.match(/^([^:]{2,40}):\s*(.+)/);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: '', value: text };
  };

  const getRecords = () => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.airway_management_records) return item.airway_management_records;
        return item;
      });
    }
    if (templateData.airway_management_records) return templateData.airway_management_records;
    if (templateData.documentData?.airway_management_records) return templateData.documentData.airway_management_records;
    return [templateData];
  };

  const records = getRecords();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  // Numeric "show" check — zero is treated as "no value" (extractor default for unmeasured)
  const numberShows = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const n = parseFloat(val);
    return !isNaN(n) && n !== 0;
  };

  // Render a numeric field only when it has a non-zero value, with an optional unit suffix
  const renderNumberField = (label, val, unit) => {
    if (!numberShows(val)) return null;
    const n = parseFloat(val);
    return renderField(label, unit ? `${n} ${unit}` : String(n));
  };

  const formatBoolean = (val) => {
    if (val === true || val === 'true' || val === 'Yes') return 'Yes';
    if (val === false || val === 'false' || val === 'No') return 'No';
    return val != null ? String(val) : '';
  };

  const getVal = (record, fieldName) => {
    const raw = record[fieldName];
    if (Array.isArray(raw)) return raw.join('. ');
    return raw;
  };

  const renderField = (label, value) => {
    if (!hasValue(value)) return null;
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{safeString(String(value))}</Text>
      </View>
    );
  };

  const renderSentenceField = (label, value) => {
    if (!hasValue(value)) return null;
    const text = String(value);
    const sentences = splitBySentence(text);
    if (sentences.length <= 1 && splitByComma(text).length < 2) {
      return renderField(label, value);
    }
    let n = 1;
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {sentences.map((s, sIdx) => {
          const parsed = parseLabel(s);
          const textToSplit = parsed.isLabeled ? parsed.value : s;
          const parts = splitByComma(textToSplit);
          if (parts.length >= 2) {
            return (
              <View key={sIdx}>
                {parsed.isLabeled && <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>}
                {parts.map((item, pi) => (
                  <Text key={pi} style={styles.listItem}>{n++}. {safeString(item)}</Text>
                ))}
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{n++}. {safeString(s)}</Text>;
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Airway Management Records</Text>

        {records.length === 0 ? (
          <Text style={styles.noRecords}>No airway management records available.</Text>
        ) : (
          records.map((record, index) => (
            <View key={record._id || index} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(`Airway Management Record ${index + 1}`)}</Text>
                {(record.date || record.createdAt) && (
                  <Text style={styles.recordDate}>{formatDate(record.date || record.createdAt)}</Text>
                )}
              </View>

              {/* Airway Assessment */}
              {(hasValue(record.airwayAssessmentScore) || numberShows(record.thyromentalDistance) ||
                numberShows(record.mouthOpeningDistance) || numberShows(record.neckCircumference) ||
                hasValue(record.neckMobilityRestriction)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Airway Assessment</Text>
                  {renderField('Airway Assessment Score', record.airwayAssessmentScore)}
                  {renderNumberField('Thyromental Distance', record.thyromentalDistance, 'cm')}
                  {renderNumberField('Mouth Opening', record.mouthOpeningDistance, 'cm')}
                  {renderNumberField('Neck Circumference', record.neckCircumference, 'cm')}
                  {hasValue(record.neckMobilityRestriction) && renderField('Neck Mobility Restriction', formatBoolean(record.neckMobilityRestriction))}
                </View>
              )}

              {/* Intubation Details */}
              {(hasValue(record.intubationMethod) || hasValue(record.laryngoscopeBladeType) ||
                numberShows(record.endotrachealTubeSize) || hasValue(record.endotrachealTubeType) ||
                numberShows(record.tubeDepthAtTeeth) || hasValue(record.cormackLehaneGrade) ||
                numberShows(record.intubationAttempts)) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Intubation Details</Text>
                    {renderField('Intubation Method', record.intubationMethod)}
                  </View>
                  {renderField('Laryngoscope Blade', record.laryngoscopeBladeType)}
                  {renderNumberField('ET Tube Size', record.endotrachealTubeSize)}
                  {renderField('ET Tube Type', record.endotrachealTubeType)}
                  {renderNumberField('Tube Depth at Teeth', record.tubeDepthAtTeeth, 'cm')}
                  {renderField('Cormack-Lehane Grade', record.cormackLehaneGrade)}
                  {renderNumberField('Intubation Attempts', record.intubationAttempts)}
                </View>
              )}

              {/* Preoxygenation & Induction */}
              {(hasValue(record.preoxygenationMethod) || hasValue(getVal(record, 'inductionAgents')) ||
                hasValue(record.neuromusculatBlocker)) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Preoxygenation & Induction</Text>
                    {renderField('Preoxygenation Method', record.preoxygenationMethod)}
                  </View>
                  {renderSentenceField('Induction Agents', getVal(record, 'inductionAgents'))}
                  {renderField('Neuromuscular Blocker', record.neuromusculatBlocker)}
                </View>
              )}

              {/* Procedure Flags */}
              {(hasValue(record.rapidSequenceIntubation) || hasValue(record.cricoidPressureApplied) ||
                hasValue(record.difficultAirwayEncountered)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Procedure Flags</Text>
                  {hasValue(record.rapidSequenceIntubation) && renderField('Rapid Sequence Intubation', formatBoolean(record.rapidSequenceIntubation))}
                  {hasValue(record.cricoidPressureApplied) && renderField('Cricoid Pressure Applied', formatBoolean(record.cricoidPressureApplied))}
                  {hasValue(record.difficultAirwayEncountered) && renderField('Difficult Airway', formatBoolean(record.difficultAirwayEncountered))}
                </View>
              )}

              {/* Alternative Devices & Confirmation */}
              {(hasValue(getVal(record, 'alternativeAirwayDevices')) || hasValue(getVal(record, 'tubePlacementConfirmation'))) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Alternative Devices & Confirmation</Text>
                  </View>
                  {renderSentenceField('Alternative Airway Devices', getVal(record, 'alternativeAirwayDevices'))}
                  {renderSentenceField('Tube Placement Confirmation', getVal(record, 'tubePlacementConfirmation'))}
                </View>
              )}

              {/* Post-Intubation Values */}
              {(numberShows(record.endTidalCO2Value) || numberShows(record.cuffPressure) ||
                numberShows(record.oxygenSaturationPostIntubation) || hasValue(record.extubationTime)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Post-Intubation Values</Text>
                  {renderNumberField('End-Tidal CO2', record.endTidalCO2Value, 'mmHg')}
                  {renderNumberField('Cuff Pressure', record.cuffPressure, 'cmH2O')}
                  {renderNumberField('SpO2 Post-Intubation', record.oxygenSaturationPostIntubation, '%')}
                  {hasValue(record.extubationTime) && renderField('Extubation Time', formatDate(record.extubationTime))}
                </View>
              )}

              {/* Complications */}
              {hasValue(getVal(record, 'complicationsDuringIntubation')) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Complications</Text>
                  </View>
                  {renderSentenceField('Complications During Intubation', getVal(record, 'complicationsDuringIntubation'))}
                </View>
              )}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default AirwayManagementPDFTemplate;
