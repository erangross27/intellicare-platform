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
    borderBottomColor: '#9ca3af',
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
    borderBottomColor: '#9ca3af',
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
    color: '#1f2937',
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
    width: 180,
  },
  fieldValue: {
    fontSize: 12,
    color: '#404040',
    flex: 1,
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginTop: 6,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 4,
    paddingLeft: 8,
  },
  nestedGroup: {
    paddingLeft: 10,
    marginBottom: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#d1d5db',
    borderLeftStyle: 'solid',
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

// Scale label mapping
const SCALE_LABELS = {
  phq9: 'PHQ-9 (Patient Health Questionnaire-9)',
  gad7: 'GAD-7 (Generalized Anxiety Disorder-7)',
  phq15: 'PHQ-15 (Patient Health Questionnaire-15)',
  mdq: 'MDQ (Mood Disorder Questionnaire)',
  pcl5: 'PCL-5 (PTSD Checklist for DSM-5)',
  audit: 'AUDIT (Alcohol Use Disorders Identification Test)',
  mmse: 'MMSE (Mini-Mental State Examination)',
  moca: 'MoCA (Montreal Cognitive Assessment)',
};
const SCALE_KEYS = ['phq9', 'gad7', 'phq15', 'mdq', 'pcl5', 'audit', 'mmse', 'moca'];

// Helper: format date
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

// Helper: safe string
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val.$date) return formatDate(val.$date);
    return JSON.stringify(val);
  }
  return String(val);
};

// Helper: camelCase/snake_case to readable label
const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Helper: safe array
const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];

// Helper: check if value is displayable
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  return true;
};

// Helper: split text into items
const splitIntoItems = (text) => {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];
  const numbered = str.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  const bySemicolon = str.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  return [str];
};

// Helper: strip number prefix
const stripNumber = (text) => String(text).replace(/^\d+\.\s*/, '');

// Helper: parse text with embedded subtitle labels
const parseSubtitleItems = (text) => {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];
  const regex = /([A-Z][A-Za-z0-9\-]+(?:\s+[a-zA-Z\-]+){1,})\s*:\s*/g;
  const matches = [];
  let m;
  while ((m = regex.exec(str)) !== null) {
    matches.push({ label: m[1], start: m.index, contentStart: m.index + m[0].length });
  }
  if (matches.length === 0) return [{ label: '', value: str }];
  const result = [];
  if (matches[0].start > 0) {
    const prefix = str.substring(0, matches[0].start).trim().replace(/\.\s*$/, '');
    if (prefix) result.push({ label: '', value: prefix });
  }
  for (let i = 0; i < matches.length; i++) {
    const contentEnd = i + 1 < matches.length ? matches[i + 1].start : str.length;
    const value = str.substring(matches[i].contentStart, contentEnd).trim().replace(/\.\s*$/, '');
    if (value) result.push({ label: matches[i].label, value });
  }
  return result;
};

// Helper: is scalar (leaf) value
const isScalarVal = (v) => v === null || v === undefined || typeof v !== 'object' || (v && v.$date);

// Helper: deep-empty check for nested OBJECT fields
const objectIsEmpty = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.filter(x => !objectIsEmpty(x)).length === 0;
  if (typeof v === 'object' && !v.$date) {
    return Object.entries(v).filter(([k]) => k !== '_id').every(([, val]) => objectIsEmpty(val));
  }
  return false;
};

// Helper: count leaves for wrap-gating (Rule #74)
const countObjectLeaves = (v) => {
  if (objectIsEmpty(v)) return 0;
  if (isScalarVal(v)) return 1;
  return Object.entries(v).filter(([k, val]) => k !== '_id' && !objectIsEmpty(val))
    .reduce((sum, [, val]) => sum + countObjectLeaves(val), 0);
};

// Check if a scale has displayable data
const scaleHasData = (scale) => {
  if (!scale || typeof scale !== 'object') return false;
  return Object.entries(scale).filter(([k]) => k !== '_id').some(([, v]) => hasValue(v));
};

const PsychiatricAssessmentScalesDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.psychiatric_assessment_scales) {
        return inputData[0].psychiatric_assessment_scales;
      }
      return inputData;
    }
    if (inputData.psychiatric_assessment_scales) {
      return inputData.psychiatric_assessment_scales;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychiatric Assessment Scales</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  // Render scales section
  const renderScalesSection = (record) => {
    const activeScales = SCALE_KEYS.filter(key => scaleHasData(record[key]));
    if (activeScales.length === 0) return null;

    let totalItems = 0;
    activeScales.forEach(key => {
      const scale = record[key];
      totalItems += 1 + Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k])).length;
    });

    return (
      <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>Assessment Scales</Text>
        <View style={styles.sectionContent}>
          {activeScales.map((key, scaleIdx) => {
            const label = SCALE_LABELS[key] || keyToLabel(key);
            const scale = record[key];
            const entries = Object.entries(scale).filter(([k]) => k !== '_id' && hasValue(scale[k]));
            return (
              <View key={scaleIdx}>
                <Text style={styles.subSectionTitle}>{label}</Text>
                {entries.map(([k, v], entryIdx) => (
                  <View key={entryIdx} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{keyToLabel(k)}:</Text>
                    <Text style={styles.fieldValue}>{safeString(v)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Render array section
  const renderArraySection = (title, items) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;
    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {safeItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  // Render text section (simple splitIntoItems)
  const renderTextSection = (title, text) => {
    if (!text || !String(text).trim()) return null;
    const items = splitIntoItems(text);
    if (items.length === 0) return null;
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

  // Render subtitle text section (findings, notes with embedded labels)
  const renderSubtitleTextSection = (title, text) => {
    if (!text || !String(text).trim()) return null;
    const parsed = parseSubtitleItems(text);
    const hasSubtitles = parsed.some(item => item.label);

    // If no subtitles found, fall back to regular text section
    if (!hasSubtitles) return renderTextSection(title, text);

    return (
      <View style={styles.section} wrap={parsed.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {parsed.map((item, i) => {
            if (item.label) {
              return (
                <View key={i}>
                  <Text style={styles.subSectionTitle}>{item.label}:</Text>
                  <Text style={styles.listItem}>{item.value}</Text>
                </View>
              );
            }
            return (
              <Text key={i} style={styles.listItem}>{i + 1}. {item.value}</Text>
            );
          })}
        </View>
      </View>
    );
  };

  // Render nested OBJECT node (results) — recursive, grayscale
  const renderObjectNode = (label, value, depth, keyPrefix) => {
    if (objectIsEmpty(value)) return null;
    if (isScalarVal(value)) {
      return (
        <View key={keyPrefix} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{label}:</Text>
          <Text style={styles.fieldValue}>{safeString(value)}</Text>
        </View>
      );
    }
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !objectIsEmpty(v));
    if (entries.length === 0) return null;
    return (
      <View key={keyPrefix}>
        {label ? <Text style={styles.subSectionTitle}>{label}</Text> : null}
        <View style={depth > 0 ? styles.nestedGroup : undefined}>
          {entries.map(([k, v]) => (
            isScalarVal(v)
              ? (
                <View key={`${keyPrefix}-${k}`} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{keyToLabel(k)}:</Text>
                  <Text style={styles.fieldValue}>{safeString(v)}</Text>
                </View>
              )
              : renderObjectNode(keyToLabel(k), v, depth + 1, `${keyPrefix}-${k}`)
          ))}
        </View>
      </View>
    );
  };

  // Render results OBJECT section (recursive, grayscale)
  const renderResultsSection = (record) => {
    const value = record.results;
    if (!value || typeof value !== 'object' || objectIsEmpty(value)) return null;
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !objectIsEmpty(v));
    if (entries.length === 0) return null;
    const leafCount = countObjectLeaves(value);
    return (
      <View style={styles.section} wrap={leafCount > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>Results</Text>
        <View style={styles.sectionContent}>
          {entries.map(([k, v]) => (
            isScalarVal(v)
              ? (
                <View key={k} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{keyToLabel(k)}:</Text>
                  <Text style={styles.fieldValue}>{safeString(v)}</Text>
                </View>
              )
              : renderObjectNode(keyToLabel(k), v, 1, k)
          ))}
        </View>
      </View>
    );
  };

  // Render status (simple string)
  const renderStatusSection = (record) => {
    if (!hasValue(record.status)) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.sectionContent}>
          <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychiatric Assessment Scales</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                Psychiatric Assessment Scales {index + 1}
              </Text>
              {record.provider && (
                <Text style={styles.recordDate}>Provider: {record.provider}</Text>
              )}
              {record.facility && (
                <Text style={styles.recordDate}>Facility: {record.facility}</Text>
              )}
            </View>

            {/* Assessment Scales */}
            {renderScalesSection(record)}

            {/* Results */}
            {renderResultsSection(record)}

            {/* Custom Scales */}
            {renderArraySection('Custom Scales', record.customScales)}

            {/* Findings */}
            {renderSubtitleTextSection('Findings', record.findings)}

            {/* Assessment */}
            {renderTextSection('Assessment', record.assessment)}

            {/* Plan */}
            {renderTextSection('Plan', record.plan)}

            {/* Recommendations */}
            {renderArraySection('Recommendations', record.recommendations)}

            {/* Notes */}
            {renderSubtitleTextSection('Notes', record.notes)}

            {/* Status */}
            {renderStatusSection(record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychiatricAssessmentScalesDocumentPDFTemplate;
