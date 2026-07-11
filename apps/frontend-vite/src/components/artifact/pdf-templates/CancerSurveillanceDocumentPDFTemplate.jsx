import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Cancer Surveillance PDF Template - March 2026
 * Professional Black & White Format for Printing (US Letter)
 *
 * Anti-orphaning: Section titles INSIDE fieldBox
 * wrap={false} on fieldBox for <=8 items, undefined for >8
 * NO borderBottom on sectionTitle
 * NO wrap={false} on sections or recordContainer
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

// Format any date/date-ish value to "Month D, YYYY" (parses ISO and "February 2026"); passes through non-dates.
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 16,
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
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordHeader: {
    marginBottom: 12,
  },
  recordTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 15,
    color: '#444444',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  // Box-free: no border/background — content flows; only section titles carry a line below them.
  fieldBox: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: '#000000',
    marginLeft: 20,
    marginBottom: 4,
  },
  metaItem: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: '#555555',
    marginRight: 12,
  },
  statusBadge: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
});

const CancerSurveillanceDocumentPDFTemplate = ({ data }) => {
  const records = Array.isArray(data) ? data : [];

  // Split by sentence
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

  // Parse label
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text };
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < text.length - 1) {
      const label = text.substring(0, colonIdx).trim();
      const value = text.substring(colonIdx + 1).trim();
      if (label.length > 0 && label.length < 50 && value.length > 0) {
        return { isLabeled: true, label, value };
      }
    }
    return { isLabeled: false, label: '', value: text };
  };

  // Split by comma (parenthesis-aware)
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

  // Render sentence field — sectionTitle INSIDE fieldBox (anti-orphaning)
  const renderSentenceField = (sectionTitle, label, value, keyPrefix) => {
    const sentences = splitBySentence(value || '');
    if (sentences.length === 0) return null;

    const parsed = sentences.map((s, i) => ({ ...parseLabel(s), origIdx: i, raw: s }));
    parsed.sort((a, b) => {
      if (a.isLabeled && !b.isLabeled) return -1;
      if (!a.isLabeled && b.isLabeled) return 1;
      return 0;
    });

    // Count total items for wrap decision
    let totalItems = 0;
    parsed.forEach((item) => {
      if (item.isLabeled) {
        const parts = splitByComma(item.value);
        totalItems += parts.length >= 3 ? parts.length + 1 : 1;
      } else {
        totalItems += 1;
      }
    });

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {parsed.map((item, idx) => {
            if (item.isLabeled) {
              const parts = splitByComma(item.value);
              if (parts.length >= 3) {
                return (
                  <View key={`${keyPrefix}-labeled-${idx}`}>
                    <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>
                    {parts.map((part, pi) => (
                      <Text key={`${keyPrefix}-item-${idx}-${pi}`} style={styles.listItem}>
                        {pi + 1}. {safeString(part)}
                      </Text>
                    ))}
                  </View>
                );
              } else {
                return (
                  <View key={`${keyPrefix}-labeled-${idx}`} style={{ marginBottom: 4 }}>
                    <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>
                    <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                  </View>
                );
              }
            } else {
              return (
                <Text key={`${keyPrefix}-generic-${idx}`} style={styles.listItem}>
                  {idx + 1}. {safeString(item.raw)}
                </Text>
              );
            }
          })}
        </View>
      </View>
    );
  };

  // Render simple field — sectionTitle INSIDE fieldBox (anti-orphaning)
  const renderSimpleField = (sectionTitle, fields, keyPrefix) => {
    const validFields = fields.filter(f => f.value);
    if (validFields.length === 0) return null;

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {validFields.map((f, idx) => (
            <View key={`${keyPrefix}-${idx}`} style={{ marginBottom: idx < validFields.length - 1 ? 6 : 0 }}>
              <Text style={styles.fieldLabel}>{safeString(f.label)}</Text>
              <Text style={styles.fieldValue}>{safeString(f.value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render recommendations array — sectionTitle INSIDE fieldBox (anti-orphaning)
  const renderRecommendations = (sectionTitle, items, keyPrefix) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {items.map((rec, idx) => (
            <Text key={idx} style={styles.listItem}>
              {idx + 1}. {safeString(rec.recommendation)}{rec.date ? ` (${safeString(rec.date)})` : ''}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  // Render object field (results) — sectionTitle INSIDE fieldBox (anti-orphaning)
  const renderObjectField = (sectionTitle, obj, keyPrefix) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;

    return (
      <View key={keyPrefix} style={styles.section}>
        <View style={styles.fieldBox} wrap={entries.length > 8 ? undefined : false}>
          <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
          {entries.map(([k, v]) => (
            <View key={k} style={{ marginBottom: 4 }}>
              <Text style={styles.fieldLabel}>{safeString(k)}</Text>
              <Text style={styles.fieldValue}>{safeString(v)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>CANCER SURVEILLANCE</Text>
        </View>

        {records.map((record, idx) => {
          const recordTitle = `Cancer Surveillance Record ${idx + 1}`;
          return (
            // Rule #75: every record after the first starts on a NEW page (break = page-break-before; not on record 0).
            <View key={record._id || idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(recordTitle)}</Text>
                {record.status && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.statusBadge}>{safeString(record.status)}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                  {record.type && <Text style={styles.metaItem}>{safeString(record.type)}</Text>}
                  {record.frequency && <Text style={styles.metaItem}>Freq: {safeString(record.frequency)}</Text>}
                  {record.nextDue && <Text style={styles.metaItem}>Next: {safeString(formatDate(record.nextDue))}</Text>}
                </View>
              </View>

              {/* Provider Details — title inside fieldBox */}
              {renderSimpleField('Provider Details', [
                { label: 'Status', value: record.status },
                { label: 'Frequency', value: record.frequency },
                { label: 'Next Due', value: record.nextDue ? formatDate(record.nextDue) : '' },
              ], `provider-${idx}`)}

              {/* Method & Protocol — title inside fieldBox */}
              {(record.method || record.biopsyProtocol) && renderSimpleField('Method & Protocol', [
                { label: 'Method', value: record.method },
                { label: 'Biopsy Protocol', value: record.biopsyProtocol },
              ], `method-${idx}`)}

              {/* Findings — sentence field, title inside fieldBox */}
              {record.findings && renderSentenceField('Findings', 'Findings', record.findings, `findings-${idx}`)}

              {/* Assessment — sentence field, title inside fieldBox */}
              {record.assessment && renderSentenceField('Assessment', 'Assessment', record.assessment, `assessment-${idx}`)}

              {/* Plan — sentence field, title inside fieldBox */}
              {record.plan && renderSentenceField('Plan', 'Plan', record.plan, `plan-${idx}`)}

              {/* Recommendations — array, title inside fieldBox */}
              {renderRecommendations('Recommendations', record.recommendations, `recs-${idx}`)}

              {/* Results — object, title inside fieldBox */}
              {record.results && typeof record.results === 'object' && renderObjectField('Results', record.results, `results-${idx}`)}

              {/* Notes — sentence field, title inside fieldBox */}
              {record.notes && renderSentenceField('Notes', 'Notes', record.notes, `notes-${idx}`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CancerSurveillanceDocumentPDFTemplate;
