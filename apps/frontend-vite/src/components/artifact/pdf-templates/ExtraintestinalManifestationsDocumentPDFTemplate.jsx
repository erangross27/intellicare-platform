import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Extraintestinal Manifestations PDF Template — March 2026
 * BLACK & WHITE ONLY - No colors per standard
 * Block layout: subtitle on own line, content below (matches JSX)
 * Prop aliasing: ({ document: data })
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: '#000000',
  },
  recordCard: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  recordTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldContent: {
    fontSize: 9,
    color: '#000000',
  },
  listItem: {
    fontSize: 9,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    width: 50,
  },
  statusValue: {
    fontSize: 9,
    color: '#000000',
  },
});

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

// prettyKey: camel/snake key -> Title Case label
const prettyKey = (key) => {
  if (!key && key !== 0) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

// flattenResultsObject: recursively flatten a dynamic-key object into readable rows.
// Empty {} / [] / null -> no rows (content-gated).
const flattenResultsObject = (obj) => {
  const rows = [];
  const walk = (val, labels) => {
    if (val === null || val === undefined || val === '') return;
    if (Array.isArray(val)) {
      if (val.length === 0) return;
      const allPrimitive = val.every(it => it === null || typeof it !== 'object');
      if (allPrimitive) {
        const joined = val.filter(it => it !== null && it !== undefined && String(it).trim() !== '')
          .map(it => (typeof it === 'boolean' ? (it ? 'Yes' : 'No') : String(it))).join(', ');
        if (joined) rows.push({ label: labels.join(' > '), value: joined });
      } else {
        val.forEach((it, i) => walk(it, [...labels, `#${i + 1}`]));
      }
      return;
    }
    if (typeof val === 'object') {
      if (val.$date) { rows.push({ label: labels.join(' > '), value: formatDate(val) }); return; }
      const keys = Object.keys(val);
      if (keys.length === 0) return;
      keys.forEach(k => walk(val[k], [...labels, prettyKey(k)]));
      return;
    }
    const display = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
    if (display.trim() === '') return;
    rows.push({ label: labels.join(' > '), value: display });
  };
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.$date) {
    Object.keys(obj).forEach(k => walk(obj[k], [prettyKey(k)]));
  }
  return rows;
};

// Split text into sentences
const splitIntoSentences = (text) => {
  if (!text) return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const ExtraintestinalManifestationsDocumentPDFTemplate = ({ document: data }) => {
  // Handle various data formats
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.extraintestinal_manifestations) {
    records = Array.isArray(data.extraintestinal_manifestations) ? data.extraintestinal_manifestations : [data.extraintestinal_manifestations];
  } else if (data?.documentData) {
    records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Extraintestinal Manifestations</Text>
            <Text style={styles.subtitle}>No records available</Text>
          </View>
        </Page>
      </Document>
    );
  }

  // Manifestation sections configuration
  const manifestationSections = [
    { name: 'Articular Manifestations', field: 'articular' },
    { name: 'Dermatologic Manifestations', field: 'dermatologic' },
    { name: 'Ocular Manifestations', field: 'ocular' },
    { name: 'Hepatobiliary Manifestations', field: 'hepatobiliary' },
    { name: 'Renal Manifestations', field: 'renal' },
    { name: 'Pulmonary Manifestations', field: 'pulmonary' },
    { name: 'Hematologic Manifestations', field: 'hematologic' }
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Extraintestinal Manifestations</Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>Extraintestinal Manifestations Report {idx + 1}</Text>

            {/* Date and Status */}
            {(record.date || record.status) && (
              <View style={styles.section}>
                {record.date && (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>DATE:</Text>
                    <Text style={styles.statusValue}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.status && (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>STATUS:</Text>
                    <Text style={styles.statusValue}>{record.status}</Text>
                  </View>
                )}
              </View>
            )}

            {/* General Information */}
            {(record.type || record.provider || record.facility) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>General Information</Text>
                {record.type && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>TYPE</Text>
                    <Text style={styles.fieldContent}>{record.type}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>PROVIDER</Text>
                    <Text style={styles.fieldContent}>{record.provider}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>FACILITY</Text>
                    <Text style={styles.fieldContent}>{record.facility}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Manifestation Categories */}
            {manifestationSections.map((section) => {
              const items = record[section.field];
              if (!items || items.length === 0) return null;

              return (
                <View key={section.field} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.name}</Text>
                  {items.map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>- {typeof item === 'string' ? item : String(item)}</Text>
                  ))}
                </View>
              );
            })}

            {/* Findings */}
            {record.findings && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Findings</Text>
                {splitIntoSentences(record.findings).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Assessment */}
            {record.assessment && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                {splitIntoSentences(record.assessment).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Plan */}
            {record.plan && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {splitIntoSentences(record.plan).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Results (dynamic-key object) */}
            {(() => {
              const resultRows = flattenResultsObject(record.results);
              if (resultRows.length === 0) return null;
              return (
                <View style={styles.section} wrap={resultRows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultRows.map((r, rIdx) => (
                    <View key={rIdx} style={styles.fieldBlock}>
                      {r.label ? <Text style={styles.fieldSubtitle}>{r.label}</Text> : null}
                      <Text style={styles.fieldContent}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations */}
            {record.recommendations?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, recIdx) => {
                  const recText = typeof rec === 'string' ? rec : rec.recommendation;
                  return (
                    <Text key={recIdx} style={styles.listItem}>- {recText}</Text>
                  );
                })}
              </View>
            )}

            {/* Notes */}
            {record.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {splitIntoSentences(record.notes).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ExtraintestinalManifestationsDocumentPDFTemplate;
