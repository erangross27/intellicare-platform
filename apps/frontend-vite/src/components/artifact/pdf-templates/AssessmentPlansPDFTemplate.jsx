import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AssessmentPlansPDFTemplate - February 2026 (page-break fix June 2026)
 * Helvetica font, 14pt minimum body text, BLACK/WHITE ONLY. Box-free, subtitle grouping.
 *
 * PAGE BREAKS — anti-orphan WITHOUT overprint (verified by rendering to PDF, June 21 2026):
 *   - The OLD approach (whole section <View wrap={rows > 8 ? undefined : false}>) OVERPRINTS:
 *     an <=8-row section whose rows wrap to 2 lines is taller than the page remainder, and
 *     @react-pdf cannot split a wrap={false} View, so it paints the rows on top of each other
 *     ("Node of type VIEW can't wrap between pages and it's bigger than available page height").
 *   - FIX: the section <View> flows normally (NO wrap=false). Only the sectionTitle + its FIRST
 *     row are glued together in a small <View wrap={false}> — that atom always fits a page, so it
 *     moves cleanly (title never orphaned) and is too small to overprint. The remaining rows are
 *     flowing siblings, so they advance correctly and never overlap.
 *   - Body rows keep lineHeight (>=1.4 unitless) so wrapped lines space correctly.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.4,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#000000',
  },
  subtitleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 14,
    marginBottom: 6,
    paddingLeft: 4,
  },
  fieldRow: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 1.4,
    color: '#000000',
    marginBottom: 10,
    paddingLeft: 12,
  },
  groupedListItem: {
    fontSize: 14,
    lineHeight: 1.4,
    color: '#000000',
    marginBottom: 10,
    paddingLeft: 24,
  },
  noData: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Safe string helper for Unicode
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  return str;
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateValue);
  }
};

const getRecordDate = (record) => record.date || record.createdAt || record.createdAtUTC || null;

// splitItemsAnd — matches JSX: break on . ; (paren-aware) always, and on a comma (paren-aware)
// UNLESS it is immediately followed by "and". Commas inside parentheses never split.
const splitItemsAnd = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  const ANDNEXT = /^\s*and\b/i;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    const isSentenceEnd = (ch === '.' || ch === ';') && i + 1 < text.length && /\s/.test(text[i + 1]);
    const isSplitComma = ch === ',' && depth === 0 && !ANDNEXT.test(text.slice(i + 1));
    if (depth === 0 && (isSentenceEnd || isSplitComma)) {
      if (isSentenceEnd && ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      continue;
    }
    current += ch;
  }
  const t = current.replace(/[.;,]+$/, '').trim(); if (t) result.push(t);
  return result;
};

// groupBySubtitles — detects embedded "Label:" patterns (matches JSX version)
const groupBySubtitles = (sentences) => {
  if (!sentences || sentences.length === 0) return [];
  const subtitleRegex = /^([A-Z][A-Za-z]+(?:\s+[A-Za-z,()0-9/-]+)+?):\s+(.+)$/;
  const groups = [];
  let currentGroup = null;
  let hasSubtitles = false;

  for (let i = 0; i < sentences.length; i++) {
    const match = sentences[i].match(subtitleRegex);
    if (match) {
      hasSubtitles = true;
      currentGroup = { subtitle: match[1].trim(), items: [match[2].trim()] };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.items.push(sentences[i]);
    } else {
      if (groups.length === 0 || groups[groups.length - 1].subtitle !== null) {
        groups.push({ subtitle: null, items: [] });
      }
      groups[groups.length - 1].items.push(sentences[i]);
    }
  }

  if (!hasSubtitles) {
    return [{ subtitle: null, items: sentences }];
  }
  return groups;
};

const hasValue = (val) => val !== null && val !== undefined && val !== '';
const hasItems = (arr) => Array.isArray(arr) && arr.length > 0;

// Render a text section with subtitle grouping
const renderGroupedTextSection = (title, text, forceBreak = false) => {
  if (!hasValue(text)) return null;
  const sentences = splitItemsAnd(text);
  if (sentences.length === 0) return null;
  const groups = groupBySubtitles(sentences);

  // FLAT children — NO per-group <View> wrapper (nested Views compress/overlap in @react-pdf).
  const children = [];
  groups.forEach((group, gIdx) => {
    if (group.subtitle) {
      children.push(<Text key={`s-${gIdx}`} style={styles.subtitleLabel}>{safeString(group.subtitle)}:</Text>);
      group.items.forEach((item, iIdx) => children.push(
        <Text key={`gi-${gIdx}-${iIdx}`} style={styles.groupedListItem}>{iIdx + 1}. {safeString(item)}</Text>
      ));
    } else {
      group.items.forEach((item, iIdx) => children.push(
        <Text key={`ui-${gIdx}-${iIdx}`} style={styles.listItem}>{iIdx + 1}. {safeString(item)}</Text>
      ));
    }
  });

  // Anti-orphan WITHOUT overprint: never wrap the whole section (a tall wrap={false}
  // block overflows the page and @react-pdf overprints its rows). Instead keep ONLY the
  // title glued to its first rendered row in a tiny wrap={false} atom (always fits a page,
  // so it moves cleanly and the heading is never orphaned); the remaining rows flow freely.
  const [firstChild, ...restChildren] = children;
  return (
    <View style={styles.section} break={forceBreak}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {firstChild}
      </View>
      {restChildren}
    </View>
  );
};

// Render an array section. Anti-orphan WITHOUT overprint (see header note): the section <View>
// flows normally; only the title + first item are glued in a small <View wrap={false}>. Wrapping
// the whole section overflows the page and overprints the rows.
const renderArraySection = (title, items, forceBreak = false) => {
  if (!hasItems(items)) return null;
  return (
    <View style={styles.section} break={forceBreak}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.listItem}>1. {safeString(items[0])}</Text>
      </View>
      {items.slice(1).map((item, i) => (
        <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

const AssessmentPlansPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.assessment_plans) {
      rawRecords = data.flatMap(item => item.assessment_plans || []);
    } else if (data.length > 0 && data[0]?.records) {
      rawRecords = data.flatMap(item => item.records || []);
    } else {
      rawRecords = data;
    }
  } else if (data?.assessment_plans) {
    rawRecords = data.assessment_plans;
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_') || key === '_id') cleanRecord[key] = record[key];
    }
    return cleanRecord;
  }).filter(r => r && (r.chiefComplaint || r.assessment || r.diagnoses?.length > 0));

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.noData}>No assessment plans available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Assessment Plans</Text>

        {records.map((record, idx) => {
          const recordDate = getRecordDate(record);

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View wrap={false}>
                <Text style={styles.recordTitle}>
                  {safeString(`Assessment Plan ${idx + 1}`)}
                </Text>
                {recordDate && (
                  <Text style={styles.recordMeta}>{formatDate(recordDate)}</Text>
                )}
              </View>

              {/* General Information */}
              {(hasValue(recordDate) || hasValue(record.provider) || hasValue(record.facility)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>General Information</Text>
                  {hasValue(recordDate) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(recordDate)}</Text>
                    </View>
                  )}
                  {hasValue(record.provider) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {hasValue(record.facility) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Chief Complaint — grouped text */}
              {renderGroupedTextSection('Chief Complaint', record.chiefComplaint)}

              {/* Assessment — grouped text */}
              {renderGroupedTextSection('Assessment', record.assessment)}

              {/* Diagnoses — array */}
              {renderArraySection('Diagnoses', record.diagnoses, true)}

              {/* Plan — grouped text */}
              {renderGroupedTextSection('Plan', record.plan, true)}

              {/* Medications — array */}
              {renderArraySection('Medications', record.medications)}

              {/* Procedures — array */}
              {renderArraySection('Procedures', record.procedures)}

              {/* Referrals — array */}
              {renderArraySection('Referrals', record.referrals)}

              {/* Testing — array */}
              {renderArraySection('Testing', record.testing)}

              {/* Patient Education — grouped text */}
              {renderGroupedTextSection('Patient Education', record.patientEducation)}

              {/* Follow-Up — grouped text */}
              {renderGroupedTextSection('Follow-Up', record.followUp)}

              {/* Notes — grouped text */}
              {renderGroupedTextSection('Notes', record.notes)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AssessmentPlansPDFTemplate;
