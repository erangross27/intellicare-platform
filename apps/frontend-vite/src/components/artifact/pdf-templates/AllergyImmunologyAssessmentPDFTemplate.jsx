import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
  },
  fieldBox: {
    marginBottom: 12,
  },
  listItem: {
    fontSize: 11,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  subsectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  noData: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue || '');
  }
};

const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Split text into sentences (matching JSX pattern)
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
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// Split by comma (parenthesis-aware)
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
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
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// Parse "Label: Value" pattern
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Flatten nested object into key-value pairs (array-aware: one row per item,
// empty arrays/items skipped, object items flattened readably — no [object Object])
const flattenObject = (obj, prefix = '') => {
  const entries = [];
  if (!obj || typeof obj !== 'object') return entries;
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim();
    const fullKey = prefix ? `${prefix} > ${displayKey}` : displayKey;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined || item === '') return;
        if (typeof item === 'object') {
          const inner = flattenObject(item).map(e => `${e.key}: ${e.value}`).join('; ');
          if (inner) entries.push({ key: fullKey, value: inner });
        } else {
          entries.push({ key: fullKey, value: String(item) });
        }
      });
    } else if (value && typeof value === 'object') {
      entries.push(...flattenObject(value, fullKey));
    } else if (value !== null && value !== undefined && value !== '') {
      entries.push({ key: fullKey, value: toSafeString(value) });
    }
  }
  return entries;
};

// Render a sentence field with numbering and comma-split
const renderSentenceField = (sectionTitle, text) => {
  if (!text) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;

  let n = 1;
  const items = [];

  sentences.forEach((sentence, sIdx) => {
    const parsed = parseLabel(sentence);
    const textToSplit = parsed.isLabeled ? parsed.value : sentence;
    const commaParts = splitByComma(textToSplit);
    const displayParts = commaParts.length >= 2 ? commaParts : [textToSplit];

    if (parsed.isLabeled && displayParts.length >= 2) {
      items.push({ type: 'sublabel', text: parsed.label, key: `sub-${sIdx}` });
      displayParts.forEach((part, pi) => {
        items.push({ type: 'numbered', text: part, num: n++, key: `${sIdx}-${pi}` });
      });
    } else if (displayParts.length >= 2) {
      displayParts.forEach((part, pi) => {
        items.push({ type: 'numbered', text: part, num: n++, key: `${sIdx}-${pi}` });
      });
    } else {
      items.push({ type: 'numbered', text: sentence, num: n++, key: `${sIdx}` });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {items.map(item => {
        if (item.type === 'sublabel') {
          return <Text key={item.key} style={styles.subsectionTitle}>{item.text}</Text>;
        }
        return (
          <Text key={item.key} style={styles.listItem}>
            {item.num}. {item.text}
          </Text>
        );
      })}
    </View>
  );
};

// Render object field (flattened key-value pairs)
const renderObjectField = (sectionTitle, obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const entries = flattenObject(obj);
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={entries.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {entries.map((entry, idx) => (
        <View key={idx} style={styles.row}>
          <Text style={styles.label}>{idx + 1}. {entry.key}</Text>
          <Text style={styles.value}>{entry.value}</Text>
        </View>
      ))}
    </View>
  );
};

const AllergyImmunologyAssessmentPDFTemplate = ({ document: documentProp }) => {
  let records = [];
  if (Array.isArray(documentProp)) {
    records = documentProp;
  } else if (documentProp) {
    records = [documentProp];
  }

  const validRecords = records.filter(Boolean);

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Allergy & Immunology Assessment</Text>
          <Text style={styles.noData}>No allergy immunology assessment data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Allergy & Immunology Assessment</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                Assessment {validRecords.length > 1 ? `${idx + 1}` : ''}{record.date ? ` — ${formatDate(record.date)}` : ''}
              </Text>
            </View>

            {/* Provider Details */}
            {(record.type || record.provider || record.facility || record.status) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>PROVIDER DETAILS</Text>
                {record.type && (
                  <View style={styles.row}>
                    <Text style={styles.label}>1. Type</Text>
                    <Text style={styles.value}>{toSafeString(record.type)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.row}>
                    <Text style={styles.label}>2. Provider</Text>
                    <Text style={styles.value}>{toSafeString(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.row}>
                    <Text style={styles.label}>3. Facility</Text>
                    <Text style={styles.value}>{toSafeString(record.facility)}</Text>
                  </View>
                )}
                {record.status && (
                  <View style={styles.row}>
                    <Text style={styles.label}>4. Status</Text>
                    <Text style={styles.value}>{toSafeString(record.status)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Immune Function (object) */}
            {renderObjectField('IMMUNE FUNCTION', record.immuneFunction)}

            {/* Skin Testing (object) */}
            {renderObjectField('SKIN TESTING', record.skinTesting)}

            {/* Specific IgE (object) */}
            {renderObjectField('SPECIFIC IGE', record.specificIge)}

            {/* Component Testing (object) */}
            {renderObjectField('COMPONENT TESTING', record.componentTesting)}

            {/* Challenge Tests (object) */}
            {renderObjectField('CHALLENGE TESTS', record.challengeTests)}

            {/* Findings (sentence field) */}
            {renderSentenceField('FINDINGS', record.findings)}

            {/* Assessment (sentence field) */}
            {renderSentenceField('ASSESSMENT', record.assessment)}

            {/* Plan (sentence field) */}
            {renderSentenceField('PLAN', record.plan)}

            {/* Recommendations (array) */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View style={styles.fieldBox} wrap={record.recommendations.length > 8 ? true : false}>
                <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
                {record.recommendations.map((rec, recIdx) => (
                  <View key={recIdx} style={styles.row}>
                    <Text style={styles.label}>{recIdx + 1}. Recommendation</Text>
                    <Text style={styles.value}>
                      {toSafeString(rec.recommendation || rec)}
                      {rec.date ? ` (${formatDate(rec.date)})` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Results (object) */}
            {renderObjectField('RESULTS', record.results)}

            {/* Notes (sentence field) */}
            {renderSentenceField('NOTES', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AllergyImmunologyAssessmentPDFTemplate;
