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
  documentHeader: {
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 20,
  },
  recordHeader: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordMeta: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 2,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 180,
  },
  fieldContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 3,
  },
  objectNode: {
    marginLeft: 12,
    marginBottom: 3,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#999999',
  },
  objectLeaf: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  objectKey: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginRight: 4,
  },
  objectVal: {
    fontSize: 11,
    color: '#000000',
    flex: 1,
  },
  recDateLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
    marginBottom: 2,
    paddingLeft: 8,
  },
});

// Humanize object keys
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

// Recursive object renderer (grayscale, B&W)
const renderObjectTree = (value, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View style={styles.objectLeaf} key={keyPrefix} wrap={false}>
        <Text style={styles.objectVal}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  return entries.map(([k, v], i) => {
    const nodeKey = `${keyPrefix}-${k}-${i}`;
    if (isScalar(v)) {
      return (
        <View style={styles.objectLeaf} key={nodeKey} wrap={false}>
          <Text style={styles.objectKey}>{humanizeKey(k)}:</Text>
          <Text style={styles.objectVal}>{fmtScalar(v)}</Text>
        </View>
      );
    }
    return (
      <View style={styles.objectNode} key={nodeKey} wrap={false}>
        <Text style={styles.objectKey}>{humanizeKey(k)}:</Text>
        {renderObjectTree(v, nodeKey)}
      </View>
    );
  });
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

// Split text into sentences (with abbreviation handling)
const splitIntoSentences = (text) => {
  if (!text) return [];
  const abbreviations = ['Dr', 'Mr', 'Mrs', 'Ms', 'Jr', 'Sr', 'St', 'vs', 'etc', 'Inc', 'Ltd', 'Corp', 'Ave', 'Blvd', 'Rd', 'Prof', 'Gen', 'Col', 'Lt', 'Sgt', 'Rev', 'Hon', 'Gov', 'Sen', 'Rep', 'Pres', 'Amb', 'Ph', 'Sc', 'Vol', 'No', 'Fig', 'pt', 'pts', 'GDM', 'T2DM', 'MD'];
  const sentences = [];
  let currentSentence = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1] || '';

    if (char === '.' && nextChar === ' ') {
      const words = currentSentence.trim().split(/\s+/);
      let lastWord = words[words.length - 1] || '';
      lastWord = lastWord.replace(/^[(\[{]+/, '');
      const isAbbreviation = abbreviations.some(abbr =>
        lastWord.toLowerCase() === abbr.toLowerCase() ||
        lastWord === abbr
      );

      if (isAbbreviation) {
        currentSentence += char;
      } else {
        currentSentence += char;
        const trimmed = currentSentence.trim();
        if (trimmed) sentences.push(trimmed);
        currentSentence = '';
        i++;
      }
    } else {
      currentSentence += char;
    }
  }

  const trimmed = currentSentence.trim();
  if (trimmed) sentences.push(trimmed);

  return sentences.filter(s => s.length > 0);
};

const PrenatalEducationDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) {
      rawRecords = data[0].records;
    } else {
      rawRecords = data;
    }
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields from JSX filtering
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) {
        cleanRecord[key] = record[key];
      }
    }
    return cleanRecord;
  });

  // Safety check for empty records
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Prenatal Education</Text>
          </View>
          <Text style={styles.contentText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Prenatal Education</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={150}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Prenatal Education {idx + 1}</Text>
              {record.date && (
                <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>
              )}
            </View>

            {/* Clinical Information Section */}
            {(record.date || record.provider || record.facility) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Information</Text>
                {record.date && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Date:</Text>
                    <Text style={styles.fieldContent}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldContent}>{String(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldContent}>{String(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Education Topics Section */}
            {record.topicsDiscussed && record.topicsDiscussed.length > 0 && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Education Topics</Text>
                {record.topicsDiscussed.map((topic, tIdx) => (
                  <Text key={tIdx} style={styles.listItem}>{tIdx + 1}. {String(topic || '')}</Text>
                ))}
              </View>
            )}

            {/* Education Status Section */}
            {(record.childbirtClassesEnrolled !== undefined || record.breastfeedingEducation !== undefined ||
              record.pretermLaborPrecautions !== undefined || record.nutritionCounseling !== undefined ||
              record.exerciseGuidance !== undefined) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Education Status</Text>
                {record.childbirtClassesEnrolled !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Childbirth Classes Enrolled:</Text>
                    <Text style={styles.fieldContent}>{record.childbirtClassesEnrolled ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {record.breastfeedingEducation !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Breastfeeding Education:</Text>
                    <Text style={styles.fieldContent}>{record.breastfeedingEducation ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {record.pretermLaborPrecautions !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Preterm Labor Precautions:</Text>
                    <Text style={styles.fieldContent}>{record.pretermLaborPrecautions ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {record.nutritionCounseling !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Nutrition Counseling:</Text>
                    <Text style={styles.fieldContent}>{record.nutritionCounseling ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {record.exerciseGuidance !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Exercise Guidance:</Text>
                    <Text style={styles.fieldContent}>{record.exerciseGuidance ? 'Yes' : 'No'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Classes Attended Section */}
            {record.classesAttended && record.classesAttended.length > 0 && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Classes Attended</Text>
                {record.classesAttended.map((cls, cIdx) => (
                  <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {String(cls || '')}</Text>
                ))}
              </View>
            )}

            {/* Warning Signs Reviewed Section */}
            {record.warningSignsReviewed && record.warningSignsReviewed.length > 0 && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Warning Signs Reviewed</Text>
                {record.warningSignsReviewed.map((sign, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sign || '')}</Text>
                ))}
              </View>
            )}

            {/* Restrictions & Modifications Section */}
            {(record.travelRestrictions || (record.workModifications && record.workModifications.length > 0)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Restrictions and Modifications</Text>
                {record.travelRestrictions && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Travel Restrictions:</Text>
                    <Text style={styles.fieldContent}>{String(record.travelRestrictions)}</Text>
                  </View>
                )}
                {record.workModifications && record.workModifications.length > 0 && (
                  <>
                    <Text style={{ ...styles.fieldLabel, marginBottom: 4, paddingLeft: 8 }}>Work Modifications:</Text>
                    {record.workModifications.map((mod, mIdx) => (
                      <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {String(mod || '')}</Text>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.contentText}>{String(record.findings)}</Text>
              </View>
            )}

            {/* Results Section (OBJECT, recursive) */}
            {record.results && !isEmptyDeep(record.results) && !isScalar(record.results) && (() => {
              const resEntries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={resEntries.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {renderObjectTree(record.results, 'results')}
                </View>
              );
            })()}

            {/* Assessment Section */}
            {record.assessment && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.contentText}>{String(record.assessment)}</Text>
              </View>
            )}

            {/* Plan Section */}
            {record.plan && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {splitIntoSentences(String(record.plan)).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Recommendations Section (array of {recommendation, date}, date-grouped) */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const groups = [];
              recs.forEach((rec) => {
                const d = (rec?.date || '').trim();
                const last = groups[groups.length - 1];
                if (last && last.date === d) last.items.push(rec);
                else groups.push({ date: d, items: [rec] });
              });
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx}>
                      {group.date && <Text style={styles.recDateLabel}>{String(group.date)}</Text>}
                      {group.items.map((rec, rIdx) => (
                        <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {String(rec?.recommendation || '')}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Notes Section */}
            {record.notes && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {splitIntoSentences(String(record.notes)).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Status Section */}
            {record.status && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Status</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Status:</Text>
                  <Text style={styles.fieldContent}>{String(record.status)}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrenatalEducationDocumentPDFTemplate;
